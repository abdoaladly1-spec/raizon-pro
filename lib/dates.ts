// تواريخ الفواتير بصيغة موحّدة YYYY-MM-DD
// السبب: المقارنة على السيرفر نصية (date_from/date_to) فتنكسر مع DD/MM/YYYY،
// وأيضاً حتى تعمل محلياً `new Date(inv.date)` وفلاتر Flutter بنفس الشكل.
const ISO_RE = /^\d{4}[-/]\d{2}[-/]\d{2}/;
const LEGACY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** يُحوّل أي صيغة تاريخ معروفة إلى YYYY-MM-DD محلي (يقبل ISO و DD/MM/YYYY). */
export const toIsoDate = (value?: string | null, timestamp?: number): string => {
    const text = (value || '').trim();
    if (ISO_RE.test(text)) return text.slice(0, 10).replace(/\//g, '-');
    const legacy = LEGACY_RE.exec(text);
    if (legacy) {
        const [, day, month, year] = legacy;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const fromText = Date.parse(text);
    const ts = typeof timestamp === 'number' && isFinite(timestamp) && timestamp > 0
        ? timestamp
        : (isFinite(fromText) ? fromText : Date.now());
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** تاريخ اليوم المحلي YYYY-MM-DD. */
export const localIsoToday = (): string => toIsoDate(null, Date.now());

/** يُحوّل التاريخ إلى كائن Date محلي (ISO يُفسَّر كيوم محلي لا UTC). */
export const parseInvoiceDate = (value: string): Date => {
    if (!value) return new Date();
    const normalized = (value || '').trim().replace(/\//g, '-');
    if (ISO_RE.test(normalized)) {
        const [y, m, d] = normalized.slice(0, 10).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    }
    const legacy = LEGACY_RE.exec(value);
    if (legacy) {
        const [, day, month, year] = legacy;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};
