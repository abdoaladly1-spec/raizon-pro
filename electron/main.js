/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function maybeStartServer() {
  if (serverStartTried) return;
  serverStartTried = true;
  try {
    if (await isServerUp()) return;
    const dir = findServerDir();
    if (!dir) return;
    const env = { ...process.env };
    if (app.isPackaged) {
      // مجلد التنصيب قد يكون غير قابل للكتابة (Program Files) => قاعدة البيانات في userData
      const userData = app.getPath('userData');
      env.DB_PATH = path.join(userData, 'procashier.db');
      // النسخ الاحتياطية أيضاً في userData (مجلد التنصيب للقراءة فقط)
      env.PROCASHIER_BACKUP_DIR = path.join(userData, 'backups');
      // إعدادات Gmail للنسخة المثبتة: server.env بجانب قاعدة البيانات في userData
      loadEnvFile(path.join(userData, 'server.env'), env);
    }
    const key = ensureApiKey(apiKeyFile());
    if (key) env.API_KEY = key;
    const child = spawn('python', ['main.py'], {
      cwd: dir,
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
      webviewTag: false,
    },
    icon: path.join(__dirname, '../public/icon.ico')
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:4189');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
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

const SECRET_SALT = 'PRO_CASHIER_IBRAHIM_NAWAR_2025_SECURE_SALT';
const ENCRYPTION_KEY = crypto.scryptSync(SECRET_SALT, 'salt', 32); // 256-bit key
const IV_LENGTH = 16;
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.key');

function decryptProductKey(encryptedKey) {
    try {
        // Key Format: IV:EncryptedData (Hex)
        const parts = encryptedKey.split(':');
        if (parts.length !== 2) return null;
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return JSON.parse(decrypted.toString());
    } catch (e) {
        return null;
    }
}

function verifyLicense() {
    try {
        if (!fs.existsSync(LICENSE_FILE)) return { valid: false, machineId: getMachineId() };
        
        const licenseData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
        const currentMachineId = getMachineId();
        
        // 1. Check if License is bound to this machine
        if (licenseData.machineId !== currentMachineId) {
            return { valid: false, machineId: currentMachineId, reason: 'Hardware Mismatch' };
        }
        
        // 2. Check Integrity (Hash of stored data)
        const integrityHash = crypto.createHmac('sha256', SECRET_SALT)
            .update(`${licenseData.machineId}${licenseData.productKey}ACTIVATED`)
            .digest('hex');
            
        if (licenseData.integrity !== integrityHash) {
            return { valid: false, machineId: currentMachineId, reason: 'License Tampered' };
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, machineId: getMachineId() };
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


ipcMain.handle('activate-license', (event, { key }) => {
    const currentMachineId = getMachineId();
    
    // 1. Validate Product Key Format & Payload
    const keyPayload = decryptProductKey(key);
    
    if (!keyPayload || keyPayload.app !== 'PROCASHIER' || !keyPayload.valid) {
        return { success: false, message: 'Invalid Product Key' };
    }
    
    // 2. Bind to Machine & Save
    // Integrity Hash: HMAC(MachineID + Key + "ACTIVATED")
    const integrityHash = crypto.createHmac('sha256', SECRET_SALT)
        .update(`${currentMachineId}${key}ACTIVATED`)
        .digest('hex');
        
    const licenseData = {
        machineId: currentMachineId,
        productKey: key,
        activatedAt: new Date().toISOString(),
        integrity: integrityHash
    };
    
    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseData));
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Write Error' };
    }
});
