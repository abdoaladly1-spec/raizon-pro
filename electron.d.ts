export {};

// جسر Electron الآمن بين الصفحة وmain.js (يُنشأ في electron/preload.cjs)
declare global {
  interface Window {
    procashier?: {
      platform: string;
      getLicenseStatus: () => Promise<{
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
      patcherActivateCurrent?: (key: string) => Promise<{ ok: boolean; error?: string }>;
      patcherDeactivateCurrent?: () => Promise<{ ok: boolean; clients?: any[]; error?: string; message?: string }>;
      patcherToggleClientStatus?: (id: string) => Promise<{ ok: boolean; clients?: any[]; status?: string; error?: string }>;
      patcherSetWindowSize?: (opts: { state: 'login' | 'dashboard' | 'restore'; width?: number; height?: number }) => Promise<{ ok: boolean }>;
      activateLicense: (key: string) => Promise<{ success: boolean; message?: string }>;
      getServerApiKey: () => Promise<string>;
      /** قائمة طابعات النظام (Electron فقط) */
      listPrinters?: () => Promise<{ name: string; displayName: string; isDefault: boolean }[]>;
      /** طباعة نافذة التطبيق الحالية (اختيار الطابعة/المقاس) */
      printJob?: (opts: {
        silent?: boolean;
        deviceName?: string;
        pageSize?: string | { width: number; height: number };
        printBackground?: boolean;
      }) => Promise<{ success: boolean; errorReason?: string }>;
      /** تصدير PDF قابل للبحث عبر printToPDF + حوار الحفظ */
      printToPdf?: () => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      openBackupFile?: () => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; filename?: string; data?: any; error?: string }>;
      /** التحديثات التلقائية عبر GitHub Releases */
      checkForUpdates?: (opts?: { owner?: string; repo?: string; token?: string }) => Promise<{
        ok: boolean;
        hasUpdate?: boolean;
        currentVersion?: string;
        latestVersion?: string;
        releaseName?: string;
        releaseNotes?: string;
        publishedAt?: string;
        downloadUrl?: string;
        installerAsset?: any;
        htmlUrl?: string;
        error?: string;
      }>;
      downloadUpdate?: (opts?: { downloadUrl?: string; filename?: string }) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
      getAppVersion?: () => Promise<string>;
      openExternalUrl?: (url: string) => Promise<boolean>;
      onUpdaterStatus?: (callback: (status: {
        stage: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        percent?: number;
        bytesPerSec?: number;
        transferred?: number;
        total?: number;
        filePath?: string;
        info?: any;
        error?: string;
      }) => void) => () => void;
    };
  }
}
