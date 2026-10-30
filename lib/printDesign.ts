// منطق تصميم الطباعة (دوال صافية قابلة للاختبار بلا DOM وبلا React).
// يغطي: 3 قوالب × 4 مقاسات، قواعد @page بالميليمتر، عرض المحتوى،
// ترتيب العناصر المسموح بها، هوية تاريخية لكل فاتورة، تحقق أصول الشعار،
// وتحويل المقاسات لـ Electron (ميكرون للطباعة / CSS للـ PDF).

import type { Invoice, InvoicePrintIdentity } from '../types.ts';

export type PageSizeId = 'A4' | 'A5' | '80mm' | '58mm';
export type TemplateId = 'classic' | 'professional' | 'thermal';
export type LogoAlign = 'left' | 'center' | 'right';

export interface PrintDesign {
  pageSize: PageSizeId;
  marginMm: number;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  titleText: string;
  footerText: string;
  baseFontSize: number;
  logoFrontDataUrl?: string;
  logoBackDataUrl?: string;
  logoSizePx: number;
  template: string;
  logoFrontAlign: LogoAlign;
  logoBackAlign: LogoAlign;
  showBarcode: boolean;
  maxItemsPerPage?: number;
  elements?: string[];
}

export interface PageSpec {
  id: PageSizeId;
  /** عرض الورق بالمليمتر */
  widthMm: number;
  /** ارتفاع الورق (null = بكرة حرّة مثل 80mm/58mm) */
  heightMm: number | null;
  labelKey: string;
}

/** القياسات الأربعة المدعومة */
export const PAGE_SIZES: PageSpec[] = [
  { id: 'A4', widthMm: 210, heightMm: 297, labelKey: 'paper_a4' },
  { id: 'A5', widthMm: 148, heightMm: 210, labelKey: 'paper_a5' },
  { id: '80mm', widthMm: 80, heightMm: null, labelKey: 'paper_80mm' },
  { id: '58mm', widthMm: 58, heightMm: null, labelKey: 'paper_58mm' },
];

/** الترتيب المرجعي لعناصر الإيصال (للفلترة والتحقق من الترتيب) */
export const ELEMENT_ORDER = ['header', 'info', 'items', 'notes', 'totals', 'footer'] as const;

export const DEFAULT_ELEMENTS: string[] = ['header', 'info', 'items', 'notes', 'totals', 'footer'];

export const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;
export const ALLOWED_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** القوالب الثلاثة + إعداداتها المسبقة */
export const TEMPLATE_PRESETS: Record<
  TemplateId,
  Pick<PrintDesign, 'pageSize' | 'marginMm' | 'primaryColor' | 'accentColor' | 'textColor' | 'baseFontSize'>
> = {
  classic: { pageSize: 'A4', marginMm: 12, primaryColor: '#0ea5e9', accentColor: '#4facfe', textColor: '#000000', baseFontSize: 14 },
  professional: { pageSize: 'A4', marginMm: 10, primaryColor: '#0369a1', accentColor: '#0ea5e9', textColor: '#0b1323', baseFontSize: 13 },
  thermal: { pageSize: '80mm', marginMm: 4, primaryColor: '#000000', accentColor: '#333333', textColor: '#000000', baseFontSize: 12 },
};

/** أسماء القوالب القديمة (مخزّنة في بيانات سابقة) → أقرب قالب حديث */
export const LEGACY_TEMPLATE_MAP: Record<string, TemplateId> = {
  template1: 'classic',
  template2: 'professional',
};

/** يحوّل أي قيمة قالب (حتى القديمة/المجهولة) لقالب من الثلاثة المدعومة */
export const normalizeTemplate = (tpl: string | undefined): TemplateId => {
  if (tpl === 'classic' || tpl === 'professional' || tpl === 'thermal') return tpl;
  if (tpl && LEGACY_TEMPLATE_MAP[tpl]) return LEGACY_TEMPLATE_MAP[tpl];
  return 'thermal';
};

/** يطبّق preset القالب الثلاثي على التصميم الحالي (يقعد مكان applyTemplate المهجور) */
export const applyTemplatePreset = (current: PrintDesign, tpl: string): PrintDesign => {
  const id = normalizeTemplate(tpl);
  return { ...current, template: id, ...TEMPLATE_PRESETS[id] };
};

export const paperSpec = (size: string): PageSpec =>
  PAGE_SIZES.find(p => p.id === size) || PAGE_SIZES[2]; // الافتراضي 80mm

export const paperWidthMm = (size: string): number => paperSpec(size).widthMm;

/** عرض منطقة المحتوى بعد أطراف الهامش (حسابات داخلية/اختبارات) */
export const printableWidth = (size: string, marginMm: number): string => {
  const m = Number.isFinite(marginMm) ? Math.max(0, marginMm) : 0;
  return `${Math.max(1, paperWidthMm(size) - m * 2)}mm`;
};

/** عرض الورقة نفسه (الغلاف على الشاشة) — الهامش يُعطى كـ padding داخلي */
export const sheetCssWidth = (size: string): string => `${paperWidthMm(size)}mm`;

/** حدّ ارتفاع المعاينة: الورق المستقيم بارتفاعه، والبكرة بضعف عرضها */
export const printableMinHeight = (size: string): string => {
  const spec = paperSpec(size);
  if (spec.heightMm) return `${spec.heightMm - 4}mm`;
  return `${spec.widthMm * 2}mm`;
};

/** قاعدة @page بالوحدات (A4/A5 بالاسم، والبونات بالطول) + الهامش بالمليمتر */
export const pageCss = (size: string, marginMm: number): string => {
  const m = Number.isFinite(marginMm) ? Math.max(0, marginMm) : 0;
  const spec = paperSpec(size);
  const sizeCss = spec.heightMm
    ? `${spec.id} portrait`
    : `${spec.widthMm}mm auto`;
  return `@page { size: ${sizeCss}; margin: ${m}mm; }`;
};

/** عدد الصفوف في الصفحة الواحدة (افتراضي 10، مقيّد بين 1 و50) */
export const itemsPerPageOf = (design: Partial<PrintDesign> | undefined): number => {
  const raw = Number(design?.maxItemsPerPage);
  if (!Number.isFinite(raw) || raw <= 0) return 10;
  return Math.min(50, Math.floor(raw));
};

/** يفلتر قائمة عناصر غير مكتملة/خاطئة مع الحفاظ على الترتيب المرجعي */
export const filterElements = (elements: string[] | undefined): string[] => {
  const list = Array.isArray(elements) && elements.length > 0 ? elements : DEFAULT_ELEMENTS;
  return ELEMENT_ORDER.filter(e => list.includes(e));
};

/**
 * يبني هوية الطباعة التاريخية من الإعدادات وقت البيع.
 * عمداً بلا بيانات الشعار الثنائية (تبقى في الإعدادات الحية) حتى لا تُثقّل كل فاتورة.
 */
export const buildPrintIdentity = (
  settings: {
    shopName: string;
    phone: string;
    address: string;
    printDesign: PrintDesign;
  },
  now: number = Date.now()
): InvoicePrintIdentity => {
  const d = settings.printDesign;
  return {
    shopName: settings.shopName || '',
    phone: settings.phone || '',
    address: settings.address || '',
    template: normalizeTemplate(d?.template),
    pageSize: paperSpec(d?.pageSize).id,
    marginMm: Number.isFinite(d?.marginMm) ? d.marginMm : 5,
    primaryColor: d?.primaryColor || '#000000',
    accentColor: d?.accentColor || '#333333',
    textColor: d?.textColor || '#000000',
    titleText: d?.titleText || '',
    footerText: d?.footerText || '',
    baseFontSize: Number.isFinite(d?.baseFontSize) ? d.baseFontSize : 10,
    logoSizePx: Number.isFinite(d?.logoSizePx) ? d.logoSizePx : 80,
    logoFrontAlign: d?.logoFrontAlign || 'center',
    logoBackAlign: d?.logoBackAlign || 'center',
    elements: filterElements(d?.elements),
    capturedAt: now,
  };
};

/**
 * يوحّد التصميم المستخدم في الطباعة:
 * فاتورة بهوية تاريخية → هويتها تغلب (الحقول الناقصة تكمل من الإعدادات الحية كالشعار)؛
 * فاتورة قديمة بلا هوية → الإعدادات الحية كما هي.
 */
export const resolvePrintDesign = (
  invoice: Invoice | null | undefined,
  live: PrintDesign
): PrintDesign => {
  const snap = invoice?.printSnapshot;
  if (!snap) return live;
  const merged: PrintDesign = {
    ...live,
    pageSize: paperSpec(snap.pageSize).id as PageSizeId,
    marginMm: snap.marginMm,
    primaryColor: snap.primaryColor,
    accentColor: snap.accentColor,
    textColor: snap.textColor,
    titleText: snap.titleText,
    footerText: snap.footerText,
    baseFontSize: snap.baseFontSize,
    logoSizePx: snap.logoSizePx,
    logoFrontAlign: snap.logoFrontAlign as LogoAlign,
    logoBackAlign: snap.logoBackAlign as LogoAlign,
    template: normalizeTemplate(snap.template),
    elements: filterElements(snap.elements),
  };
  return merged;
};

/** يملأ حقول تصميم قديم/ناقص من القيم الافتراضية (لا يرمي شيئاً ولا يترك undefined خطر) */
export const normalizePrintDesign = (raw: Partial<PrintDesign> | undefined): PrintDesign => {
  const base: PrintDesign = {
    pageSize: '80mm',
    marginMm: 5,
    primaryColor: '#000000',
    accentColor: '#333333',
    textColor: '#000000',
    titleText: '',
    footerText: '',
    baseFontSize: 10,
    logoSizePx: 80,
    template: 'thermal',
    logoFrontAlign: 'center',
    logoBackAlign: 'center',
    showBarcode: false,
    elements: DEFAULT_ELEMENTS,
  };
  if (!raw || typeof raw !== 'object') return base;
  const out: PrintDesign = { ...base, ...raw };
  out.pageSize = paperSpec(raw.pageSize).id as PageSizeId;
  out.template = normalizeTemplate(raw.template);
  out.marginMm = Number.isFinite(out.marginMm) ? Math.max(0, out.marginMm) : 5;
  out.baseFontSize = Number.isFinite(out.baseFontSize) ? out.baseFontSize : 10;
  out.logoSizePx = Number.isFinite(out.logoSizePx) ? out.logoSizePx : 80;
  out.elements = filterElements(raw.elements);
  if (out.maxItemsPerPage != null) {
    out.maxItemsPerPage = itemsPerPageOf(out);
  }
  return out;
};

/**
 * تحويل المقاس لخيار Electron في `webContents.print`.
 * A4/A5 بالأسماء المدعومة، والبونات بالميكرون (وحدات Electron المخصصة).
 */
export const electronPageSize = (size: string): string | { width: number; height: number } => {
  if (size === 'A4' || size === 'A5') return size;
  const spec = paperSpec(size);
  return { width: spec.widthMm * 1000, height: (spec.heightMm || Math.max(200, spec.widthMm * 2.5)) * 1000 };
};

/** تحقق أصول الشعار قبل الحفظ (نوع + حجم + اسم) */
export const validateLogoAsset = (file: { name?: string; type?: string; size?: number }): { ok: boolean; error?: string } => {
  if (!file || typeof file !== 'object') return { ok: false, error: 'missing' };
  if (!file.name || !String(file.name).trim()) return { ok: false, error: 'name' };
  if (!file.type || !ALLOWED_LOGO_MIME.includes(file.type)) return { ok: false, error: 'type' };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: 'size' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: 'too_big' };
  return { ok: true };
};

/** من يحق له إعادة طباعة فاتورة (يركّب نفس منطق فلترة القائمة الجانبية) */
export const canReprint = (user: { role?: string; permissions?: string[] } | null | undefined): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!Array.isArray(user.permissions)) return true;
  if (user.permissions.includes('invoices')) return true;
  if (user.permissions.includes('settings')) return true;
  return false;
};

/** سطر التدقيق الموحّد لعمليات الطباعة (طباعة/PDF/إعادة طباعة/تعديل تصميم) */
export const printAuditInfo = (
  kind: 'print' | 'pdf' | 'reprint' | 'design',
  ref?: number | string
): { action: string; details: string } => {
  const suffix = ref == null ? '' : ` #${ref}`;
  switch (kind) {
    case 'print': return { action: 'Print', details: `Printed invoice${suffix}` };
    case 'pdf': return { action: 'Print', details: `Exported invoice PDF${suffix}` };
    case 'reprint': return { action: 'Print', details: `Reprinted invoice${suffix}` };
    case 'design': return { action: 'Print', details: 'Updated print design settings' };
    default: return { action: 'Print', details: 'Print action' };
  }
};
