/**
 * مجدول النسخ الاحتياطي التلقائي (محلي كل 6 ساعات + سحابي بالبريد 12:00 منتصف الليل)
 * ويحتفظ بآخر نسختين فقط محلياً لتوفير المساحة وعدم استهلاك الذاكرة.
 */

import { AppState } from '../types';

let schedulerInterval: any = null;
let isBackupRunning = false;

export interface AutoBackupContext {
  getState: () => AppState;
  updateSettings: (patch: Partial<AppState['settings']>) => void;
  addAuditLog?: (action: string, details: string, detailsAr?: string) => void;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const executeBackup = async (
  state: AppState, 
  sendEmail: boolean = false
): Promise<{ ok: boolean; message?: string }> => {
  const serverUrl = (state.settings?.serverUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const apiKey = state.settings?.serverApiKey || 'procashier-secret-key-2026';
  const emailConfig = state.settings?.emailConfig || {
    emailTo: state.settings?.managerEmail || '',
    notifyOnInvoice: true,
    notifyOnClosing: true,
    notifyOnReturn: true,
    notifyOnExpense: true,
    smtpUser: 'rizon.pro.app@gmail.com'
  };

  const backupPayload = {
    settings: { ...state.settings, emailConfig },
    emailConfig,
    managerEmail: emailConfig.emailTo || state.settings?.managerEmail || '',
    users: state.users,
    locations: state.locations,
    categories: state.categories,
    items: state.items,
    invoices: state.invoices,
    returns: state.returns,
    expenses: state.expenses,
    notes: state.notes,
    reservations: state.reservations,
    auditLogs: state.auditLogs,
    heldInvoices: state.heldInvoices,
    timestamp: Date.now(),
    version: '2.0.0'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`${serverUrl}/api/backup?send_email=${sendEmail}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(backupPayload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, message: errData.detail || `Server error: ${res.status}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
};

export const startAutoBackupScheduler = (ctx: AutoBackupContext) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const checkAndRun = async () => {
    if (isBackupRunning) return;
    const state = ctx.getState();
    const settings = state?.settings;
    if (!settings) return;

    // فحص ما إذا كان النسخ الاحتياطي التلقائي مفعلاً
    const isAutoBackupEnabled = settings.autoBackupEnabled !== false;
    if (!isAutoBackupEnabled) return;

    const now = new Date();
    const nowTime = now.getTime();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    // 1. النسخ السحابي عبر البريد: كل يوم الساعة 12 منتصف الليل (بين 00:00 و 00:15)
    const managerEmail = settings.emailConfig?.emailTo || settings.managerEmail;
    const lastEmailDate = settings.lastEmailBackupDate || '';

    if (hours === 0 && minutes <= 15 && lastEmailDate !== todayStr && managerEmail) {
      isBackupRunning = true;
      try {
        const result = await executeBackup(state, true);
        if (result.ok) {
          ctx.updateSettings({
            lastEmailBackupDate: todayStr,
            lastLocalBackupTime: nowTime
          });
          if (ctx.addAuditLog) {
            ctx.addAuditLog(
              'Backup',
              `Daily midnight backup sent to ${managerEmail}`,
              `تم إرسال النسخة الاحتياطية اليومية بنجاح إلى بريد المدير (${managerEmail}) الساعة 12:00 منتصف الليل`
            );
          }
        }
      } catch (e) {
        console.error('[AutoBackup] Midnight email backup failed:', e);
      } finally {
        isBackupRunning = false;
      }
      return;
    }

    // 2. النسخ المحلي الذكي: كل 6 ساعات مع الاحتفاظ بآخر نسختين فقط
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const lastLocalTime = settings.lastLocalBackupTime || 0;

    if (nowTime - lastLocalTime >= SIX_HOURS) {
      isBackupRunning = true;
      try {
        const result = await executeBackup(state, false);
        if (result.ok) {
          ctx.updateSettings({
            lastLocalBackupTime: nowTime
          });
          if (ctx.addAuditLog) {
            ctx.addAuditLog(
              'Backup',
              'Automatic local backup created (6h cycle - 2 copies max)',
              'تم إنشاء نسخة احتياطية محلية تلقائية (دورة كل 6 ساعات) والاحتفاظ بآخر نسختين فقط لتوفير المساحة'
            );
          }
        }
      } catch (e) {
        console.error('[AutoBackup] 6-hour local backup failed:', e);
      } finally {
        isBackupRunning = false;
      }
    }
  };

  // تشغيل الفحص بعد 5 ثوانٍ من بدء التشغيل، ثم كل دقيقة (60 ثانية)
  setTimeout(checkAndRun, 5000);
  schedulerInterval = setInterval(checkAndRun, 60 * 1000);

  return () => {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  };
};
