/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------------
// نسخة واحدة فقط من التطبيق (يمنع فتح نافذتين على نفس قاعدة البيانات)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;

app.on('second-instance', (event, commandLine) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (commandLine && Array.isArray(commandLine) && commandLine.some(arg => arg.includes('--patcher'))) {
    mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "P", shiftKey: true, ctrlKey: true }));');
  }
});
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// تشغيل سيرفر ProCashier تلقائياً لو مش شغّال (8087)
const SERVER_PORT = Number(process.env.PROCASHIER_SERVER_PORT || 8087);
let serverStartTried = false;

function findServerDir() {
  const candidates = [
    path.join(__dirname, '..', 'server'),
    app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server') : '',
    path.join(path.dirname(process.execPath), 'server'),
    path.join(process.cwd(), 'server'),
  ].filter(Boolean);
  return (
    candidates.find((dir) => !dir.includes('app.asar') && fs.existsSync(path.join(dir, 'main.py'))) || null
  );
}

// قراءة ملف إعدادات (.env) وإضافته على متغيرات البيئة
function loadEnvFile(file, env) {
  try {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#') || !s.includes('=')) continue;
      const i = s.indexOf('=');
      const key = s.slice(0, i).trim();
      const value = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (key) env[key] = value;
    }
  } catch (e) {
    console.warn('[server] env file read failed:', e?.message || e);
  }
}

async function isServerUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// مسار ملف الإعدادات (بيستخدمه السيرفر في التطوير، وفي النسخة المثبتة userData)
function apiKeyFile() {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'server.env');
  const dir = findServerDir();
  return dir ? path.join(dir, '.env') : path.join(app.getPath('userData'), 'server.env');
}

// يضمن وجود API_KEY في ملف الإعدادات ويرجعه (فراغ لو المصادقة معطّلة API_KEY=off)
function ensureApiKey(envFile) {
  try {
    const raw = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const lines = raw ? raw.split(/\r?\n/) : [];
    const out = [];
    let existing = '';
    let disabled = false;
    for (const line of lines) {
      const s = line.trim();
      if (s.startsWith('API_KEY=')) {
        const v = s.slice(s.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
        if (v) {
          if (/^(off|none|disabled)$/i.test(v)) {
            disabled = true;
          } else {
            existing = v;
          }
          out.push(line);
          continue;
        }
      }
      out.push(line);
    }
    if (existing) return existing; // مفتاح موجود مسبقاً
    if (disabled) return ''; // المستخدم عطّل المصادقة
    const key = crypto.randomBytes(18).toString('base64url');
    let replaced = false;
    const finalLines = [];
    for (const line of out) {
      if (line.trim().startsWith('API_KEY=') && !replaced) {
        finalLines.push(`API_KEY=${key}`);
        replaced = true;
      } else {
        finalLines.push(line);
      }
    }
    if (!replaced) {
      while (finalLines.length && !finalLines[finalLines.length - 1].trim()) finalLines.pop();
      finalLines.push(`API_KEY=${key}`);
    }
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, finalLines.join('\n').replace(/\n*$/, '\n'), 'utf8');
    return key;
  } catch (e) {
    console.warn('[server] api-key ensure failed:', e?.message || e);
    return '';
  }
}

// مسار السيرفر المضمَّن (PyInstaller) — يُنسخ إلى موارد التطبيق عند البناء
function findBundledServer() {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'procashier-server.exe') : '',
    path.join(path.dirname(app.getPath('exe')), 'procashier-server.exe'),
    path.join(__dirname, '..', 'server', 'dist', 'procashier-server.exe'),
  ].filter(Boolean);
  return candidates.find((file) => fs.existsSync(file)) || null;
}

async function maybeStartServer() {
  if (serverStartTried) return;
  serverStartTried = true;
  try {
    if (await isServerUp()) return;

    const userData = app.getPath('userData');
    const env = { ...process.env };
    if (app.isPackaged) {
      // مجلد التنصيب قد يكون غير قابل للكتابة (Program Files) => قاعدة البيانات في userData
      env.DB_PATH = path.join(userData, 'procashier.db');
      // النسخ الاحتياطية أيضاً في userData (مجلد التنصيب للقراءة فقط)
      env.PROCASHIER_BACKUP_DIR = path.join(userData, 'backups');
      // إعدادات Gmail للنسخة المثبتة: server.env بجانب قاعدة البيانات في userData
      loadEnvFile(path.join(userData, 'server.env'), env);
    }
    // نفس ملف الإعدادات للسيرفر وللـ Electron (يضمن تطابق API_KEY)
    env.PROCASHIER_ENV_FILE = apiKeyFile();
    const key = ensureApiKey(apiKeyFile());
    if (key) env.API_KEY = key;

    const bundled = findBundledServer();
    let command = bundled || 'python';
    let args = bundled ? [] : ['main.py'];
    let cwd = bundled ? path.dirname(bundled) : findServerDir();

    // احتياطي: لو مفيش exe ولا مجلد سيرفر، لا شيء لنشغّله
    if (!bundled && !cwd) return;

    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', (err) => console.warn('[server] auto-start failed:', err?.message || err));
    child.unref();
  } catch (err) {
    console.warn('[server] auto-start failed:', err?.message || err);
  }
}
// ------------------------------------------------------------------

function createWindow() {
  const isPatcher = process.argv.includes('--patcher');
  const win = new BrowserWindow({
    width: isPatcher ? 725 : 1200,
    height: isPatcher ? 440 : 800,
    resizable: !isPatcher,
    maximizable: !isPatcher,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
    icon: isPatcher ? path.join(__dirname, '../public/patcher.ico') : path.join(__dirname, '../public/icon.ico')
  });

  mainWindow = win;

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL(isPatcher ? 'http://localhost:4189?mode=patcher' : 'http://localhost:4189');
    // win.webContents.openDevTools();
  } else {
    if (isPatcher) {
      win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode: 'patcher' } });
    } else {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }
  
  win.setMenuBarVisibility(false);

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

// ------------------------------------------------------------------
// تقوية الأمان: منع التنقل الخارجي وفتح نوافذ غير موثوقة
// نسمح فقط بـ: صفحات التطبيق المحلية (file://) ونوافذ الطباعة about:blank
const ALLOWED_INTERNAL_ORIGINS = new Set([
  'http://localhost:4189',
  'http://127.0.0.1:4189',
]);

const isInternalUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') return true;
    if (url.protocol === 'about:' && url.href === 'about:blank') return true;
    return ALLOWED_INTERNAL_ORIGINS.has(url.origin) && !app.isPackaged;
  } catch {
    return false;
  }
};

app.on('web-contents-created', (_event, contents) => {
  // منع أي تنقل إلى موقع خارجي داخل نافذة التطبيق
  contents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      console.warn('[security] blocked navigation:', url);
    }
  });

  // نافذة جديدة: نسمح فقط بنوافذ الطباعة الفارغة، ونفتح الروابط الخارجية في المتصفح
  contents.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webviewTag: false,
            preload: undefined,
          },
        },
      };
    }
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    } else {
      console.warn('[security] blocked window.open:', url);
    }
    return { action: 'deny' };
  });

  // منع تحميل أي preload/webview إضافي
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
// ------------------------------------------------------------------

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  maybeStartServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getMachineId() {
  const platform = os.platform();
  const hostname = os.hostname();
  const arch = os.arch();
  return crypto.createHash('sha256').update(`${platform}-${hostname}-${arch}`).digest('hex');
}

// ---------------- الترخيص (Ed25519) ----------------
// المفتاح العام فقط يُشحن مع التطبيق. المفتاح الخاص يبقى عند المطوّر (tools/keys، غير مُتتبَّع).
const RAIZON_PUBLIC_KEY_B64 = 'MCowBQYDK2VwAyEA/GFgoO0KxX7/iUWoViRfRvE/kz0VaP73s0MxR4gDhMk=';
const RAIZON_APP_ID = 'RAIZON_PRO';
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.key');
const licensePublicKey = crypto.createPublicKey({
    key: Buffer.from(RAIZON_PUBLIC_KEY_B64, 'base64'),
    format: 'der',
    type: 'spki',
});

/** يتحقق من توقيع المفتاح ويرجعه للبيانات أو سبب الرفض */
function verifyLicenseKey(rawKey) {
    try {
        const [payloadPart, sigPart] = String(rawKey || '').trim().split('.');
        if (!payloadPart || !sigPart) return { ok: false, reason: 'format' };

        // التوقيع على نفس بايتات النص (base64url) التي وُقّعت في tools/make-license.mjs
        const valid = crypto.verify(
            null,
            Buffer.from(payloadPart),
            licensePublicKey,
            Buffer.from(sigPart, 'base64url'),
        );
        if (!valid) return { ok: false, reason: 'signature' };

        const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
        if (payload.app !== RAIZON_APP_ID) return { ok: false, reason: 'app' };
        if (payload.mid !== getMachineId()) return { ok: false, reason: 'machine' };
        if (payload.exp) {
            const exp = payload.exp.includes('T') ? Date.parse(payload.exp) : Date.parse(`${payload.exp}T23:59:59Z`);
            if (!Number.isFinite(exp) || Date.now() > exp) {
                return { ok: false, reason: 'expired', expiresAt: new Date(exp).toISOString() };
            }
        }
        return { ok: true, payload };
    } catch {
        return { ok: false, reason: 'error' };
    }
}

function verifyLicense() {
    const machineId = getMachineId();
    try {
        if (!fs.existsSync(LICENSE_FILE)) return { valid: false, machineId, reason: 'missing' };
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        const res = verifyLicenseKey(licenseData.key);
        if (!res.ok) return { valid: false, machineId, reason: res.reason };

        let remainingMs = null;
        let expiresAt = null;
        let isPerpetual = true;
        if (res.payload && res.payload.exp) {
            const expMs = res.payload.exp.includes('T') ? Date.parse(res.payload.exp) : Date.parse(`${res.payload.exp}T23:59:59Z`);
            remainingMs = Math.max(0, expMs - Date.now());
            expiresAt = new Date(expMs).toISOString();
            isPerpetual = false;
        }

        return {
            valid: true,
            machineId,
            payload: res.payload,
            remainingMs,
            expiresAt,
            isPerpetual,
        };
    } catch {
        return { valid: false, machineId, reason: 'error' };
    }
}

// IPC Handlers for Security
ipcMain.handle('get-license-status', () => {
    return verifyLicense();
});

// مفتاح API للسيرفر: يقرأ/يضمن نفس القيمة التي يستخدمها السيرفر
ipcMain.handle('get-server-api-key', () => ensureApiKey(apiKeyFile()));

// ---------------- الطباعة (IPC) ----------------
// قائمة طابعات النظام
ipcMain.handle('print:list', async (event) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return [];
        const printers = await win.webContents.getPrintersAsync();
        return printers.map(p => ({
            name: p.name,
            displayName: p.displayName || p.name,
            isDefault: !!p.isDefault,
        }));
    } catch (e) {
        return [];
    }
});

// طباعة النافذة الحالية (تُطبع فقط منطقة #printable-invoice بفضل قواعد @media print)
ipcMain.handle('print:job', (event, opts = {}) => new Promise((resolve) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return resolve({ success: false, errorReason: 'no-window' });
    const options = {
        silent: !!opts.silent,
        printBackground: opts.printBackground !== false,
        pageSize: opts.pageSize || 'A4',
    };
    if (opts.deviceName) options.deviceName = String(opts.deviceName);
    try {
        win.webContents.print(options, (success, failureReason) => {
            resolve({ success: !!success, errorReason: success ? '' : String(failureReason || 'failed') });
        });
    } catch (e) {
        resolve({ success: false, errorReason: String((e && e.message) || e) });
    }
}));

// تصدير PDF قابل للبحث: printToPDF مع preferCSSPageSize (يحترم @page بالمللي)
// + مسافر CSS فقط (الهامش يأتي من قواعد الصفحة) + حوار حفظ في مستندات المستخدم
ipcMain.handle('print:pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: 'no-window' };
    try {
        const data = await win.webContents.printToPDF({
            preferCSSPageSize: true,
            printBackground: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'Save invoice PDF',
            defaultPath: path.join(app.getPath('documents'), `procashier-invoice-${stamp}.pdf`),
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (canceled || !filePath) return { ok: false, canceled: true };
        fs.writeFileSync(filePath, data);
        return { ok: true, filePath };
    } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
    }
});


// فتح حوار اختيار ملف نسخة احتياطية محلي وقراءته بشكل موثوق 100%
ipcMain.handle('dialog:open-backup', async (event) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'استيراد نسخة احتياطية (Import Backup)',
            filters: [
                { name: 'JSON Backup', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        if (canceled || !filePaths || filePaths.length === 0) {
            return { ok: false, canceled: true };
        }
        const filePath = filePaths[0];
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        return {
            ok: true,
            filePath,
            filename: path.basename(filePath),
            data: parsed
        };
    } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
    }
});

ipcMain.handle('activate-license', (event, arg) => {
    const key = typeof arg === 'string' ? arg : arg?.key;
    const res = verifyLicenseKey(key);

    if (!res.ok) {
        const messages = {
            machine: 'License is bound to another machine',
            expired: 'License expired',
            app: 'Invalid Product Key',
            signature: 'Invalid Product Key',
            format: 'Invalid Product Key',
        };
        return { success: false, message: messages[res.reason] || 'Invalid Product Key' };
    }

    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify({
            machineId: getMachineId(),
            key: String(key).trim(),
            activatedAt: new Date().toISOString(),
        }));
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Write Error' };
    }
});

// -------------------------------------------------------------
// PATCHER SYSTEM (المولّد والمتحكم في التراخيص للمطور)
// -------------------------------------------------------------
const PATCHER_SALT = '7261697a6f6e2d706174636865722d7365637572652d73616c742d32303236';

// دعم الباسورد 22122005Me# (الأساسي) مع الباسورد السابق كاحتياط
const PATCHER_CIPHERS = [
    {
        iv: '08988ae8a0e50a144d411550',
        tag: '9fdc18d120a5d36e5a0c884faf21ba5b',
        cipher: 'a53607b589d5388b084cd0b0828655a9c4641a2f85d1309b5068cb1081e84573af6a735cba618fc37a765e479cd3086b5801c17bb7a037f3f9b1cf7e4635f0d79c93188d76b4be19bdfe6aa26c9f7175f03fa991344b8ebda8c720b0882b2d461d5c3f944e61f2c29d0bb755e6dcc1b971e7c1c54470'
    },
    {
        iv: '1a6d48407f4ed941ead33452',
        tag: 'c3aee33dc3553489a6af8ea1483f1537',
        cipher: 'd8258fda15a21b7f84421ca336a2a444671d31e055338aa209f774aa26f1e0bcac90a135135e6088101f796ddf1bd47d6af6eaa2758533d1ae48e0cfa4216a2d3d9a5f23bc58a4d66580b4f2f4d18684f6f6fc4cb806d465b2e9514686077ae183843a65617463e219ff84ef8f046572aabd33dcf1d5'
    }
];

let patcherPrivateKeyPem = null;

function decryptPatcherPrivateKey(password) {
    try {
        const salt = Buffer.from(PATCHER_SALT, 'hex');
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

        for (const item of PATCHER_CIPHERS) {
            try {
                const iv = Buffer.from(item.iv, 'hex');
                const tag = Buffer.from(item.tag, 'hex');
                const cipher = Buffer.from(item.cipher, 'hex');

                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(tag);
                const pem = Buffer.concat([decipher.update(cipher), decipher.final()]).toString('utf8');
                if (pem && pem.includes('BEGIN PRIVATE KEY')) {
                    return pem;
                }
            } catch (err) {}
        }
        return null;
    } catch (e) {
        return null;
    }
}

function getPatcherClientsFile() {
    return path.join(app.getPath('userData'), 'patcher-clients.json');
}

function readPatcherClients() {
    try {
        const file = getPatcherClientsFile();
        if (fs.existsSync(file)) {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (Array.isArray(data)) return data;
        }
    } catch (e) {
        console.warn('[patcher] error reading clients:', e?.message || e);
    }
    return [];
}

function writePatcherClients(clients) {
    try {
        const file = getPatcherClientsFile();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(clients, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('[patcher] error writing clients:', e?.message || e);
        return false;
    }
}

// 1. تسجيل دخول المطور
ipcMain.handle('patcher:login', (event, { username, password }) => {
    if (username !== 'admin') {
        return { ok: false, error: 'اسم المستخدم غير صحيح' };
    }
    const pem = decryptPatcherPrivateKey(password);
    if (!pem) {
        return { ok: false, error: 'كلمة المرور غير صحيحة' };
    }
    patcherPrivateKeyPem = pem;
    return { ok: true, currentMachineId: getMachineId() };
});

// 2. جلب قائمة العملاء
ipcMain.handle('patcher:get-clients', () => {
    return readPatcherClients();
});

// 3. حذف سجل عميل من القائمة
ipcMain.handle('patcher:delete-client', (event, id) => {
    const clients = readPatcherClients().filter(c => c.id !== id);
    writePatcherClients(clients);
    return { ok: true, clients };
});

// 4. معرف الجهاز الحالي
ipcMain.handle('patcher:get-current-mid', () => {
    return getMachineId();
});

// 5. توليد مفتاح ترخيص فريد وحفظه في قائمة العملاء
ipcMain.handle('patcher:generate', (event, { machineId, clientName, duration }) => {
    if (!patcherPrivateKeyPem) {
        return { ok: false, error: 'جلسة المطور منتهية، يرجى تسجيل الدخول مجدداً' };
    }
    if (!machineId || !machineId.trim()) {
        return { ok: false, error: 'يرجى إدخال معرف الجهاز (Machine ID)' };
    }
    if (!clientName || !clientName.trim()) {
        return { ok: false, error: 'يرجى إدخال اسم العميل' };
    }

    try {
        const now = new Date();
        const iat = now.toISOString();
        const tid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
        
        let exp = null;
        let durationLabel = '';

        switch (duration) {
            case '30m':
                exp = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
                durationLabel = '30 دقيقة';
                break;
            case '1d':
                exp = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '1 يوم';
                break;
            case '7d':
                exp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = 'أسبوع (7 أيام)';
                break;
            case '30d':
                exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = 'شهر (30 يوم)';
                break;
            case '3m':
                exp = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '3 شهور';
                break;
            case '6m':
                exp = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '6 شهور';
                break;
            case '1y':
                exp = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
                durationLabel = '1 سنة';
                break;
            case 'lifetime':
            case 'perpetual':
            default:
                exp = null;
                durationLabel = 'طوال الحياة (مدى الحياة)';
                break;
        }

        const payload = {
            app: RAIZON_APP_ID,
            mid: machineId.trim(),
            tid,
            client: clientName.trim(),
            iat,
            ...(exp ? { exp } : {})
        };

        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto.sign(null, Buffer.from(payloadB64), patcherPrivateKeyPem).toString('base64url');
        const licenseKey = `${payloadB64}.${sig}`;

        const record = {
            id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            tid,
            clientName: clientName.trim(),
            machineId: machineId.trim(),
            durationLabel,
            durationValue: duration,
            createdAt: iat,
            expiresAt: exp,
            licenseKey,
            status: 'active'
        };

        const clients = readPatcherClients();
        // أحدث مفتاح يوضع في الأول
        clients.unshift(record);
        writePatcherClients(clients);

        return { ok: true, licenseKey, record, clients };
    } catch (e) {
        console.error('[patcher] generation error:', e);
        return { ok: false, error: e?.message || 'فشل في توليد المفتاح' };
    }
});

// 6. تفعيل فوري للجهاز الحالي بدون الحاجة للنسخ واللصق
ipcMain.handle('patcher:activate-current', (event, key) => {
    const res = verifyLicenseKey(key);
    if (!res.ok) {
        return { ok: false, error: 'المفتاح غير صالح للجهاز الحالي' };
    }
    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify({
            machineId: getMachineId(),
            key: String(key).trim(),
            activatedAt: new Date().toISOString(),
        }));
        return { ok: true };
    } catch (e) {
        return { ok: false, error: 'فشل حفظ ملف الترخيص' };
    }
});


// 7. إلغاء الاشتراك والتفعيل للجهاز الحالي
ipcMain.handle('patcher:deactivate-current', () => {
    if (!patcherPrivateKeyPem) {
        return { ok: false, error: 'جلسة المطور منتهية، يرجى تسجيل الدخول مجدداً' };
    }
    try {
        const mid = getMachineId();
        if (fs.existsSync(LICENSE_FILE)) {
            fs.unlinkSync(LICENSE_FILE);
        }
        const clients = readPatcherClients();
        let updated = false;
        clients.forEach(c => {
            if (c.machineId === mid) {
                c.status = 'revoked';
                updated = true;
            }
        });
        if (updated) {
            writePatcherClients(clients);
        }
        return { ok: true, clients, message: 'تم إلغاء تفعيل واشتراك هذا الجهاز بنجاح' };
    } catch (e) {
        return { ok: false, error: e?.message || 'فشل في إلغاء التفعيل' };
    }
});

// 8. إلغاء أو إعادة تفعيل اشتراك عميل محدد من القائمة
ipcMain.handle('patcher:toggle-client-status', (event, id) => {
    if (!patcherPrivateKeyPem) {
        return { ok: false, error: 'جلسة المطور منتهية، يرجى تسجيل الدخول مجدداً' };
    }
    try {
        const clients = readPatcherClients();
        const client = clients.find(c => c.id === id);
        if (!client) {
            return { ok: false, error: 'العميل غير موجود' };
        }
        client.status = client.status === 'revoked' ? 'active' : 'revoked';

        const mid = getMachineId();
        if (client.machineId === mid && client.status === 'revoked') {
            if (fs.existsSync(LICENSE_FILE)) {
                fs.unlinkSync(LICENSE_FILE);
            }
        }
        writePatcherClients(clients);
        return { ok: true, clients, status: client.status };
    } catch (e) {
        return { ok: false, error: e?.message || 'حدث خطأ أثناء تعديل حالة الاشتراك' };
    }
});

// التحكم في مقاس النافذة الخارجية (BrowserWindow) من أجل الباتشر
let savedWindowBounds = null;

ipcMain.handle('patcher:set-window-size', (event, opts = {}) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { ok: false };
        const { state, width, height } = opts;

        if (state === 'login') {
            if (!savedWindowBounds) {
                savedWindowBounds = win.getBounds();
            }
            win.setResizable(false);
            win.setMaximizable(false);
            win.setSize(width || 725, height || 440, true);
            win.center();
        } else if (state === 'dashboard') {
            win.setResizable(true);
            win.setMaximizable(true);
            win.setSize(width || 1100, height || 750, true);
            win.center();
        } else if (state === 'restore') {
            win.setResizable(true);
            win.setMaximizable(true);
            if (savedWindowBounds) {
                win.setBounds(savedWindowBounds);
                savedWindowBounds = null;
            } else {
                win.setSize(1200, 800, true);
                win.center();
            }
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message };
    }
});


// ==================================================================
// التحديثات التلقائية المجانية عبر GitHub Releases (Free Cloud Updater)
// ==================================================================
let autoUpdaterInstance = null;
try {
  const updaterPkg = await import('electron-updater');
  autoUpdaterInstance = updaterPkg.default?.autoUpdater || updaterPkg.autoUpdater;
  if (autoUpdaterInstance) {
    autoUpdaterInstance.autoDownload = false;
    autoUpdaterInstance.autoInstallOnAppQuit = true;
  }
} catch (e) {
  console.warn('[Updater] electron-updater fallback active:', e?.message);
}

function isNewerVersion(latest, current) {
  const cleanLatest = String(latest || '').replace(/^[^\d]*/i, '').trim();
  const cleanCurrent = String(current || '').replace(/^[^\d]*/i, '').trim();
  if (!cleanLatest || !cleanCurrent) return false;
  const lParts = cleanLatest.split('.').map(n => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] || 0;
    const c = cParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

let downloadedInstallerPath = null;

ipcMain.handle('updater:get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('updater:open-url', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('updater:check', async (event, opts = {}) => {
  const currentVersion = app.getVersion();
  let repoPath = (opts.repo || 'abdoaladly1-spec/raizon-pro').trim();
  if (repoPath.startsWith('https://github.com/')) {
    repoPath = repoPath.replace('https://github.com/', '').replace(/\/$/, '');
  }
  const [owner, repo] = repoPath.split('/');
  if (!owner || !repo) {
    return { ok: false, error: 'يرجى تحديد مستودع GitHub بالشكل الصحيح: username/repo' };
  }

  const token = (opts.token || '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').trim();
  const headers = {
    'User-Agent': 'RaiZonPro-Desktop-App',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = 'token ' + token;
  }

  try {
    const apiUrl = 'https://api.github.com/repos/' + owner + '/' + repo + '/releases/latest';
    const res = await fetch(apiUrl, { headers });
    
    if (res.status === 404) {
      return { 
        ok: false, 
        currentVersion,
        error: 'لم يتم العثور على مستودع أو إصدارات منشورة على GitHub (' + owner + '/' + repo + '). يرجى التأكد من رفع أول Release.'
      };
    }
    if (res.status === 401 || res.status === 403) {
      return { 
        ok: false, 
        currentVersion,
        error: 'انتهت صلاحية رمز الدخول أو تم تجاوز حد طلبات GitHub. يرجى المحاولة لاحقاً.' 
      };
    }
    if (!res.ok) {
      return { ok: false, currentVersion, error: 'استجابة غير متوقعة من GitHub (كود ' + res.status + ')' };
    }

    const data = await res.json();
    const latestVersion = (data.tag_name || data.name || '').replace(/^[^\d]*/, '');
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);

    // البحث عن ملف التثبيت في assets
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const installerAsset = assets.find(a => 
      a.name.toLowerCase().endsWith('.exe') || 
      a.name.toLowerCase().includes('setup') ||
      a.name.toLowerCase().endsWith('.zip')
    ) || assets[0] || null;

    return {
      ok: true,
      hasUpdate,
      currentVersion,
      latestVersion: data.tag_name || latestVersion,
      releaseName: data.name || data.tag_name || 'تحديث جديد',
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      downloadUrl: installerAsset ? (installerAsset.url || installerAsset.browser_download_url) : data.html_url,
      installerAsset: installerAsset ? {
        name: installerAsset.name,
        size: installerAsset.size,
        downloadUrl: installerAsset.browser_download_url
      } : null,
      htmlUrl: data.html_url
    };
  } catch (err) {
    return { 
      ok: false, 
      currentVersion, 
      error: 'تعذر الاتصال بخوادم GitHub: ' + (err?.message || 'تحقق من اتصال الإنترنت') 
    };
  }
});

ipcMain.handle('updater:download', async (event, opts = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const downloadUrl = opts.downloadUrl;
  if (!downloadUrl) {
    return { ok: false, error: 'رابط التحميل غير متوفر' };
  }

  const filename = opts.filename || 'RaiZon_Pro_Update_Setup.exe';
  const targetDir = os.tmpdir();
  const destPath = path.join(targetDir, filename);

  try {
    const token = (opts.token || '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').trim();
    const fetchHeaders = { 'User-Agent': 'RaiZonPro-Desktop-App' };
    if (token) {
      fetchHeaders['Authorization'] = 'token ' + token;
      fetchHeaders['Accept'] = 'application/octet-stream';
    }
    const res = await fetch(downloadUrl, { headers: fetchHeaders, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP error ' + res.status);

    const totalBytes = Number(res.headers.get('content-length')) || 0;
    let receivedBytes = 0;

    const fileStream = fs.createWriteStream(destPath);
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.length;
      fileStream.write(value);

      if (totalBytes > 0 && win && !win.isDestroyed()) {
        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        win.webContents.send('updater:status-changed', {
          stage: 'downloading',
          percent,
          transferred: receivedBytes,
          total: totalBytes
        });
      }
    }

    fileStream.end();
    downloadedInstallerPath = destPath;

    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:status-changed', {
        stage: 'downloaded',
        percent: 100,
        filePath: destPath
      });
    }

    return { ok: true, filePath: destPath };
  } catch (err) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:status-changed', {
        stage: 'error',
        error: err?.message
      });
    }
    return { ok: false, error: err?.message || 'فشل تحميل ملف التحديث' };
  }
});

ipcMain.handle('updater:install', async () => {
  if (!downloadedInstallerPath || !fs.existsSync(downloadedInstallerPath)) {
    return { ok: false, error: 'ملف التحديث غير موجود، يرجى التنزيل أولاً' };
  }

  try {
    // تحديد مجلد التثبيت الحالي لضمان التثبيت والتحديث فوق نفس النسخة تماماً
    const currentAppDir = path.dirname(process.execPath);
    const args = [
      `--dir=${currentAppDir}`,
      `/DIR=${currentAppDir}`,
      `/D=${currentAppDir}`,
      `--target=${currentAppDir}`
    ];
    const child = spawn(downloadedInstallerPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 500);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'تعذر تشغيل مثبت التحديث' };
  }
});
