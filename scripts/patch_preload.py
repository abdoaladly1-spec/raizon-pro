import re

# 1. Update electron/preload.cjs
with open('electron/preload.cjs', 'r', encoding='utf-8') as f:
    preload = f.read()

patcher_preload_methods = """  // أدوات Patcher للمطور
  patcherLogin: (username, password) => ipcRenderer.invoke('patcher:login', { username, password }),
  patcherGetClients: () => ipcRenderer.invoke('patcher:get-clients'),
  patcherDeleteClient: (id) => ipcRenderer.invoke('patcher:delete-client', id),
  patcherGetCurrentMid: () => ipcRenderer.invoke('patcher:get-current-mid'),
  patcherGenerate: (data) => ipcRenderer.invoke('patcher:generate', data),
  patcherActivateCurrent: (key) => ipcRenderer.invoke('patcher:activate-current', key),
"""

if 'patcherLogin' not in preload:
    preload = preload.replace("  printToPdf: () => ipcRenderer.invoke('print:pdf'),", "  printToPdf: () => ipcRenderer.invoke('print:pdf'),\n" + patcher_preload_methods)
    with open('electron/preload.cjs', 'w', encoding='utf-8') as f:
        f.write(preload)
    print("Updated electron/preload.cjs successfully")

# 2. Update electron.d.ts
with open('electron.d.ts', 'r', encoding='utf-8') as f:
    dts = f.read()

patcher_dts = """      getLicenseStatus: () => Promise<{
        valid: boolean;
        machineId?: string;
        reason?: string;
        expiresAt?: string | null;
        remainingMs?: number | null;
        isPerpetual?: boolean;
        payload?: any;
      }>;
      patcherLogin?: (username: string, password: string) => Promise<{ ok: boolean; error?: string; currentMachineId?: string }>;
      patcherGetClients?: () => Promise<any[]>;
      patcherDeleteClient?: (id: string) => Promise<{ ok: boolean; clients: any[] }>;
      patcherGetCurrentMid?: () => Promise<string>;
      patcherGenerate?: (data: { machineId: string; clientName: string; duration: string }) => Promise<{ ok: boolean; licenseKey?: string; record?: any; clients?: any[]; error?: string }>;
      patcherActivateCurrent?: (key: string) => Promise<{ ok: boolean; error?: string }>;"""

dts_target = "      getLicenseStatus: () => Promise<{ valid: boolean; machineId?: string; reason?: string }>;"
if dts_target in dts:
    dts = dts.replace(dts_target, patcher_dts)
    with open('electron.d.ts', 'w', encoding='utf-8') as f:
        f.write(dts)
    print("Updated electron.d.ts successfully")

print("Done step 1")
