#!/usr/bin/env node
/**
 * يبني سيرفر ProCashier كملف تنفيذي واحد (PyInstaller) وينسخه إلى موارد Electron.
 *
 * الاستخدام:
 *   npm run server:build
 *
 * المتطلبات: python + PyInstaller (pip install pyinstaller).
 * لو PyInstaller غير مثبّت، يطبع تحذيراً وينتهي بلا فشل حتى لا يعطّل بقية البناء
 * (سيعمل التطبيق حينها عبر python main.py إن كان Python متاحاً على الجهاز).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');
const SPEC = path.join(SERVER_DIR, 'procashier-server.spec');
const BUILT = path.join(SERVER_DIR, 'dist', 'procashier-server.exe');
const TARGET_DIR = path.join(ROOT, 'electron', 'resources');
const TARGET = path.join(TARGET_DIR, 'procashier-server.exe');

const py = process.env.PYTHON || 'python';

const check = spawnSync(py, ['-c', 'import PyInstaller; print(PyInstaller.__version__)'], {
  encoding: 'utf8',
  shell: false,
});
if (check.status !== 0) {
  console.warn('[server:build] PyInstaller غير مثبّت — تخطي بناء exe السيرفر.');
  console.warn('[server:build] للتثبيت:  pip install pyinstaller');
  console.warn('[server:build] ثم أعد:  npm run server:build');
  process.exit(0);
}

console.log(`[server:build] PyInstaller ${check.stdout.trim()} — بدء البناء...`);
const build = spawnSync(
  py,
  ['-m', 'PyInstaller', SPEC, '--noconfirm', '--distpath', path.join(SERVER_DIR, 'dist'), '--workpath', path.join(SERVER_DIR, 'build')],
  { cwd: ROOT, stdio: 'inherit' },
);

if (build.status !== 0) {
  console.error('[server:build] فشل بناء السيرفر.');
  process.exit(build.status || 1);
}
if (!fs.existsSync(BUILT)) {
  console.error(`[server:build] لم يُعثر على الناتج: ${BUILT}`);
  process.exit(1);
}

fs.mkdirSync(TARGET_DIR, { recursive: true });
fs.copyFileSync(BUILT, TARGET);
console.log(`[server:build] تم النسخ إلى ${path.relative(ROOT, TARGET)}`);
