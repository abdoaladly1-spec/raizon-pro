// وحدة تحويل وتنسيق سجلات التدقيق والنظام إلى اللغة العربية بدقة وتفصيل متناهي
import type { AuditLog } from '../types';

export interface AuditLogFormatted {
  id: string;
  timestamp: number;
  user: string;
  actionOriginal: string;
  actionAr: string;
  detailsAr: string;
  badgeColor: string;
}

export const ACTION_CATEGORIES_AR: Record<string, { label: string; badge: string }> = {
  Invoice: { label: 'فاتورة مبيعات', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  Closing: { label: 'تقفيل الوردية', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Drawer: { label: 'حركة الخزينة والدرج', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  Payment: { label: 'سداد ديون العملاء', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Expense: { label: 'مصروفات تشغيلية', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  Inventory: { label: 'إدارة المخزون', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  Customer: { label: 'بيانات العملاء', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  User: { label: 'المستخدمين والصلاحيات', badge: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  Security: { label: 'الأمان والحسابات', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  Settings: { label: 'إعدادات النظام', badge: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  System: { label: 'النظام والنسخ الاحتياطي', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  Login: { label: 'تسجيل دخول', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Logout: { label: 'تسجيل خروج', badge: 'bg-slate-700/60 text-slate-400 border-slate-600' },
  Notes: { label: 'الملاحظات', badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  WhatsApp: { label: 'إرسال واتساب', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Print: { label: 'طباعة إيصال', badge: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  PDF: { label: 'تصدير PDF', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  Loyalty: { label: 'نقاط الولاء', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Return: { label: 'مرتجع مالي', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Setup: { label: 'إعداد النظام الأولي', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

/**
 * تحويل نص السجل الإنجليزي القديم إلى نص عربي فصيح ودقيق للغاية
 */
export const translateAuditLogToAr = (action: string, details: string, detailsAr?: string): { actionAr: string; detailsAr: string; badgeColor: string } => {
  const cat = ACTION_CATEGORIES_AR[action] || {
    label: action,
    badge: 'bg-slate-700/60 text-slate-300 border-slate-600'
  };

  if (detailsAr && detailsAr.trim()) {
    return { actionAr: cat.label, detailsAr: detailsAr.trim(), badgeColor: cat.badge };
  }

  const raw = (details || '').trim();

  // 1. الفواتير
  let m = raw.match(/^Created invoice #(\d+) for ([\d.]+) EGP(?:\s*\((.*)\))?/i);
  if (m) {
    const [, invId, amount, method] = m;
    const methodStr = method ? ` — طريقة الدفع: ${translateMethod(method)}` : '';
    return { actionAr: cat.label, detailsAr: `إنشاء فاتورة مبيعات جديدة رقم #${invId} بقيمة ${formatMoney(amount)} ج.م${methodStr}`, badgeColor: cat.badge };
  }

  m = raw.match(/^Updated invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تعديل بيانات الفاتورة رقم #${m[1]} وحفظ التغييرات`, badgeColor: cat.badge };
  }

  m = raw.match(/^Held invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تعليق فاتورة مبيعات برقم #${m[1]} في قائمة الفواتير المعلقة`, badgeColor: cat.badge };
  }

  m = raw.match(/^Restored held invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `استرجاع الفاتورة المعلقة رقم #${m[1]} لاستكمال عملية الدفع`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted held invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف الفاتورة المعلقة رقم #${m[1]} نهائياً من القائمة`, badgeColor: cat.badge };
  }

  m = raw.match(/^Shared invoice #(\d+) via WhatsApp/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `مشاركة إيصال الفاتورة رقم #${m[1]} مع العميل عبر تطبيق واتساب`, badgeColor: cat.badge };
  }

  m = raw.match(/^Printed invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `طباعة إيصال الفاتورة رقم #${m[1]} على طابعة الإيصالات`, badgeColor: cat.badge };
  }

  m = raw.match(/^Saved receipt PDF for invoice #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تصدير إيصال الفاتورة رقم #${m[1]} وحفظه كملف PDF على الجهاز`, badgeColor: cat.badge };
  }

  // 1.5. المرتجعات
  m = raw.match(/^Return\s+(full|partial)\s+on invoice #(\d+):\s*([\d.]+)\s*EGP/i);
  if (m) {
    const [, type, invId, amount] = m;
    const isFull = type.toLowerCase() === 'full';
    return { actionAr: cat.label, detailsAr: `مرتجع مالي ${isFull ? 'كامل' : 'جزئي'} للفاتورة #${invId} بقيمة ${formatMoney(amount)} ج.م`, badgeColor: cat.badge };
  }

  // 2. تقفيل الوردية
  m = raw.match(/^Added closing report #(\d+) - (matched|shortage|surplus)/i);
  if (m) {
    const [, rId, status] = m;
    const stAr = status === 'matched' ? 'متطابق بدون عجز أو زيادة' : (status === 'shortage' ? 'يوجد عجز في الدرج' : 'يوجد زيادة نقدية');
    return { actionAr: cat.label, detailsAr: `اعتماد تقرير تقفيل الوردية والخزينة رقم #${rId} — الحالة: ${stAr}`, badgeColor: cat.badge };
  }

  // 3. حركات الخزينة
  m = raw.match(/^(Withdrawal|Deposit)\s+([\d.]+)\s+EGP\s*-\s*(.*)/i);
  if (m) {
    const [, type, amount, reason] = m;
    const isW = type.toLowerCase() === 'withdrawal';
    const actionText = isW ? 'سحب نقدي من الدرج' : 'إيداع نقدي في الدرج';
    return { actionAr: cat.label, detailsAr: `${actionText} بقيمة ${formatMoney(amount)} ج.م — السبب/البيان: "${reason || 'بدون تفاصيل'}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Removed movement #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف حركة نقدية من سجل حركات الدرج رقم #${m[1]}`, badgeColor: cat.badge };
  }

  // 4. المصروفات
  m = raw.match(/^Added expense:\s*(.*?)\s*\(([\d.]+)\)/i);
  if (m) {
    const [, title, amount] = m;
    return { actionAr: cat.label, detailsAr: `تسجيل مصروف تشغيلي جديد: "${title}" بقيمة ${formatMoney(amount)} ج.م`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted expense #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف بند مصروف تشغيلي برقم المعرف #${m[1]}`, badgeColor: cat.badge };
  }

  // 5. العملاء وسداد الديون
  m = raw.match(/^Customer credit payment:\s*(.*?)\s*-\s*([\d.]+)\s*EGP\s*\((.*?)\)/i);
  if (m) {
    const [, cName, amount, method] = m;
    return { actionAr: cat.label, detailsAr: `سداد مديونية عميل: "${cName || 'عميل نقدي'}" — المبلغ المسدد: ${formatMoney(amount)} ج.م — وسيلة السداد: ${translateMethod(method)}`, badgeColor: cat.badge };
  }

  m = raw.match(/^Added customer:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `إضافة عميل جديد إلى قاعدة البيانات: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Updated customer:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تحديث وتعديل بيانات العميل: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted customer #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف حساب العميل برقم المعرف #${m[1]} من النظام`, badgeColor: cat.badge };
  }

  // 6. إدارة المخزون
  m = raw.match(/^Added item:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `إضافة منتج/خدمة جديدة إلى المخزون: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Updated item:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تعديل بيانات الصنف في المخزون: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted item:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف صنف من المخزون برقم/اسم: "${m[1]}"`, badgeColor: cat.badge };
  }

  // 7. المستخدمين والأمان وتسجيل الدخول
  m = raw.match(/^User\s+(.*?)\s+logged in\s*\(PIN\)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تسجيل دخول سريع للنظام بواسطة رمز PIN للمستخدم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^User\s+(.*?)\s+logged in/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تسجيل دخول ناجح إلى النظام باسم المستخدم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^User\s+(.*?)\s+logged out/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تسجيل خروج آمن من النظام للمستخدم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Password changed for\s+(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تغيير وتحديث كلمة المرور لحساب المستخدم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Quick PIN (set|cleared) for\s+(.*)/i);
  if (m) {
    const isSet = m[1].toLowerCase() === 'set';
    return { actionAr: cat.label, detailsAr: isSet ? `تعيين رمز PIN سريع للمستخدم: "${m[2]}"` : `إلغاء رمز PIN السريع للمستخدم: "${m[2]}"`, badgeColor: cat.badge };
  }

  if (raw.toLowerCase().includes('pin lockout triggered')) {
    return { actionAr: cat.label, detailsAr: 'تفعيل قفل الحماية المؤقت للنظام بعد تكرار إدخال رمز PIN غير صحيح', badgeColor: cat.badge };
  }

  m = raw.match(/^Added user:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `إضافة مستخدم جديد للنظام باسم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Updated user:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `تحديث بيانات وصلاحيات المستخدم: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted user #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف حساب المستخدم رقم #${m[1]} من النظام`, badgeColor: cat.badge };
  }

  // 8. النظام والإعدادات والنسخ الاحتياطي
  if (raw.toLowerCase().includes('updated system settings')) {
    return { actionAr: cat.label, detailsAr: 'تحديث وتعديل إعدادات وتفضيلات النظام وبيانات المنشأة', badgeColor: cat.badge };
  }

  if (raw.toLowerCase().includes('restored state from backup')) {
    return { actionAr: cat.label, detailsAr: 'استعادة كاملة لقاعدة بيانات وبيانات النظام من ملف نسخة احتياطية', badgeColor: cat.badge };
  }

  if (raw.toLowerCase().includes('reset all loyalty points')) {
    return { actionAr: cat.label, detailsAr: 'تصفير نقاط برنامج ولاء ومكافآت العملاء بالكامل', badgeColor: cat.badge };
  }

  m = raw.match(/^Completed initial admin setup:\s*Name=(.*?),\s*CashDrawer=(.*?)\s*EGP/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `إكمال معالج إعداد النظام لأول مرة — اسم المدير: "${m[1]}"، رصيد بداية الدرج: ${formatMoney(m[2])} ج.م`, badgeColor: cat.badge };
  }

  m = raw.match(/^Created note:\s*(.*)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `إضافة ملاحظة جديدة: "${m[1]}"`, badgeColor: cat.badge };
  }

  m = raw.match(/^Deleted note #(\d+)/i);
  if (m) {
    return { actionAr: cat.label, detailsAr: `حذف ملاحظة مسجلة رقم #${m[1]}`, badgeColor: cat.badge };
  }

  return { actionAr: cat.label, detailsAr: raw, badgeColor: cat.badge };
};

const formatMoney = (n: any): string => {
  const num = Number(n);
  return isNaN(num) ? String(n) : num.toLocaleString('en-US');
};

const translateMethod = (m: string): string => {
  const lower = String(m || '').toLowerCase();
  if (lower === 'cash') return 'نقداً (كاش)';
  if (lower === 'card' || lower === 'visa') return 'بطاقة بنكية';
  if (lower === 'wallet') return 'محفظة إلكترونية';
  if (lower === 'instapay') return 'إنستاباي';
  if (lower === 'mixed') return 'دفع مركب (متعدد)';
  return m;
};

/**
 * تصدير سجلات التدقيق باللغة العربية إلى ملف CSV متوافق مع Excel 100%
 */
export const exportAuditLogsToCsv = (logs: AuditLog[]) => {
  const headers = ['#', 'التاريخ والوقت', 'نوع الإجراء', 'المستخدم المسؤول', 'تفاصيل العملية الدقيقة'];
  const rows = logs.map((log, index) => {
    const formatted = translateAuditLogToAr(log.action, log.details, log.detailsAr);
    const dateStr = new Date(log.timestamp).toLocaleString('ar-EG-u-nu-latn');
    return [
      String(index + 1),
      dateStr,
      formatted.actionAr,
      log.user || 'المدير',
      `"${formatted.detailsAr.replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const todayStr = new Date().toISOString().split('T')[0];
  a.download = `سجلات_النظام_التدقيق_${todayStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
