// جسر الطباعة من صفحة Electron — يعمل أيضاً في المتصفح العادي ببدائل آمنة.
// المسارات الأساسية عبر window.procashier (IPC): قائمة الطابعات، طباعة صامتة/محددة،
// وتصدير PDF قابل للبحث عبر printToPDF (يحترم قواعد @page بالوحدات).

import { electronPageSize, printAuditInfo, type PrintDesign } from './printDesign.ts';

export interface PrinterInfoLite {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export type PrintResult = { success: boolean; errorReason?: string; fallback?: boolean };
export type PdfResult = { ok: boolean; filePath?: string; canceled?: boolean; error?: string; fallback?: boolean };

/** هل الجسر متاح (Electron)؟ */
export const hasPrintBridge = (): boolean =>
  typeof window !== 'undefined' && !!(window.procashier?.listPrinters || window.procashier?.printJob || window.procashier?.printToPdf);

/** قائمة طابعات النظام (فارغة خارج Electron — اليدوي يبقى متاحاً) */
export const listPrinters = async (): Promise<PrinterInfoLite[]> => {
  const bridge = typeof window !== 'undefined' ? window.procashier : undefined;
  if (!bridge?.listPrinters) return [];
  try {
    const list = await bridge.listPrinters();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/**
 * يطبع الفاتورة الحالية:
 * Electron → webContents.print (اختيار الطابعة المحفوظة + مقاس مخصص للمقاسات الحرّة)،
 * متصفح → window.print() (قواعد @page في الصفحة تتكفّل بالمقاس).
 */
export const printReceipt = async (
  design: PrintDesign,
  printerName?: string
): Promise<PrintResult> => {
  const bridge = typeof window !== 'undefined' ? window.procashier : undefined;
  if (bridge?.printJob) {
    try {
      const res = await bridge.printJob({
        silent: false,
        deviceName: printerName && printerName !== 'Default' ? printerName : '',
        pageSize: electronPageSize(design.pageSize),
        printBackground: true,
      });
      return { success: !!(res && res.success), errorReason: res?.errorReason || '' };
    } catch (e: any) {
      return { success: false, errorReason: String(e?.message || e) };
    }
  }
  // متصفح/تطوير: طباعة عبر نافذة المتصفح (القوالب تضبط المقاس تلقائياً)
  try {
    window.print();
    return { success: true, fallback: true };
  } catch (e: any) {
    return { success: false, errorReason: String(e?.message || e) };
  }
};

/**
 * تصدير PDF قابل للبحث:
 * Electron → printToPDF بـ preferCSSPageSize (نص حقيقي قابل للتحديد/البحث) + حوار حفظ،
 * متصفح → يعيد fallback ليستخدم المتصفح (حفظ PDF من نافذة الطباعة).
 */
export const saveReceiptPdf = async (): Promise<PdfResult> => {
  const bridge = typeof window !== 'undefined' ? window.procashier : undefined;
  if (bridge?.printToPdf) {
    try {
      return await bridge.printToPdf();
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }
  return { ok: false, fallback: true, canceled: false };
};

/** تنفيذ عملية طباعة موحّدة مع سطر تدقيق (يُستدعى من أزرار الطباعة) */
export const runPrintAction = async (
  kind: 'print' | 'reprint',
  design: PrintDesign,
  printerName: string | undefined,
  audit: (action: string, details: string) => void,
  invoiceId?: number
): Promise<PrintResult> => {
  const info = printAuditInfo(kind, invoiceId);
  const res = await printReceipt(design, printerName);
  if (res.success) audit(info.action, info.details);
  return res;
};
