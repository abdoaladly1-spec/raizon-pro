// جسر آمن بين نافذة Electron والكود المحلي (contextIsolation = true)
// لا يوجد Node داخل الصفحة: الصفحة تتواصل عبر window.procashier فقط
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('procashier', {
  platform: process.platform,
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', { key }),
  getServerApiKey: () => ipcRenderer.invoke('get-server-api-key'),
  // الطباعة: قائمة الطابعات، طباعة (اختياري صامت/طابعة محددة)، وتصدير PDF قابل للبحث
  listPrinters: () => ipcRenderer.invoke('print:list'),
  printJob: (opts) => ipcRenderer.invoke('print:job', opts || {}),
  printToPdf: () => ipcRenderer.invoke('print:pdf'),
  // أدوات Patcher للمطور
  patcherLogin: (username, password) => ipcRenderer.invoke('patcher:login', { username, password }),
  patcherGetClients: () => ipcRenderer.invoke('patcher:get-clients'),
  patcherDeleteClient: (id) => ipcRenderer.invoke('patcher:delete-client', id),
  patcherGetCurrentMid: () => ipcRenderer.invoke('patcher:get-current-mid'),
  patcherGenerate: (data) => ipcRenderer.invoke('patcher:generate', data),
  patcherActivateCurrent: (key) => ipcRenderer.invoke('patcher:activate-current', key),
  patcherDeactivateCurrent: () => ipcRenderer.invoke('patcher:deactivate-current'),
  patcherToggleClientStatus: (id) => ipcRenderer.invoke('patcher:toggle-client-status', id),
  patcherSetWindowSize: (opts) => ipcRenderer.invoke('patcher:set-window-size', opts || {}),
  openBackupFile: () => ipcRenderer.invoke('dialog:open-backup'),
  // التحديثات التلقائية عبر GitHub Releases
  checkForUpdates: (opts) => ipcRenderer.invoke('updater:check', opts || {}),
  downloadUpdate: (opts) => ipcRenderer.invoke('updater:download', opts || {}),
  cancelDownloadUpdate: () => ipcRenderer.invoke('updater:cancel-download'),
  getReadyUpdateInfo: () => ipcRenderer.invoke('updater:get-ready-info'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('updater:get-app-version'),
  openExternalUrl: (url) => ipcRenderer.invoke('updater:open-url', url),
  onUpdaterStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:status-changed', handler);
    return () => ipcRenderer.removeListener('updater:status-changed', handler);
  },
});
