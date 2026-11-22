/**
 * أدوات معالجة والتحقق من أرقام الهواتف (Phone Utilities)
 * تحويل الأرقام العربية، إزالة المسافات، ومعالجة كود الدولة تلقائياً
 */

/**
 * تنظيف وتوحيد رقم الهاتف الذكي:
 * 1. تحويل الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى أرقام إنجليزية (0-9).
 * 2. إزالة كافة المسافات والشرطات والأقواس والرموز غير الرقمية.
 * 3. تحويل البادئات الدولية لمصر (+20, 0020, 20) إلى الصيغة المحلية (01...).
 */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed === '--') return '--';

  let str = trimmed;

  // تحويل الأرقام العربية المشرقية (٠١٢٣٤٥٦٧٨٩)
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  str = str.replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)));

  // تحويل الأرقام الفارسية (۰۱۲۳۴۵۶۷۸۹)
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  str = str.replace(/[۰-۹]/g, d => String(persianDigits.indexOf(d)));

  // إزالة أي مسافات أو شرطات أو فواصل أو أقواس
  str = str.replace(/[\s\-_.\(\),/\\+]/g, '');

  // معالجة كود الدولة لمصر إن وجد
  // +2010... أو 002010...
  if (trimmed.startsWith('+20') || trimmed.startsWith('0020')) {
    const withoutPrefix = trimmed.replace(/^(\+20|0020)/, '');
    const cleanWithout = normalizePhone(withoutPrefix);
    return cleanWithout.startsWith('0') ? cleanWithout : '0' + cleanWithout;
  }

  // إذا أدخل المستخدم 201xxxxxxxxx (12 رقماً)
  if (str.startsWith('201') && str.length === 12) {
    str = '0' + str.slice(2);
  }

  // إذا أدخل المستخدم 2001xxxxxxxxx (13 رقماً)
  if (str.startsWith('2001') && str.length === 13) {
    str = '0' + str.slice(3);
  }

  // إبقاء الأرقام فقط
  return str.replace(/\D/g, '');
}

/**
 * فحص صحة رقم الهاتف:
 * - يدعم الأرقام المصرية القياسية (11 رقماً تبدأ بـ 01)
 * - يدعم أيضاً الأرقام الدولية المعيارية (10 إلى 15 رقماً)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = normalizePhone(phone);

  // استثناءات الكاش والعميل العابر
  if (clean === '--' || clean === '01000000000') return true;

  // 1. رقم محمول مصري نظامي: 11 رقماً يبدأ بـ 01
  if (/^01\d{9}$/.test(clean)) {
    return true;
  }

  // 2. أرقام دولية صالحة (مثلاً من دول الخليج أو دول أخرى 9-14 رقماً)
  if (/^[1-9]\d{8,14}$/.test(clean)) {
    return true;
  }

  return false;
}
