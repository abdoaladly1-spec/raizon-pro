export {};

// جسر Electron الآمن بين الصفحة وmain.js (يُنشأ في electron/preload.cjs)
declare global {
  interface Window {
    procashier?: {
      platform: string;
      getLicenseStatus: () => Promise<{ valid: boolean; machineId?: string; reason?: string }>;
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
    };
  }
}
