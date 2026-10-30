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
});
