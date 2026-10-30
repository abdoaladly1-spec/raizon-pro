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

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
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
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  mainWindow = win;

  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:4189');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
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
            const exp = Date.parse(`${payload.exp}T23:59:59Z`);
            if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false, reason: 'expired' };
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
        return { valid: true, machineId, payload: res.payload };
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
