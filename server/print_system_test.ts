// اختبارات نظام تخصيص الطباعة (نقية — بلا DOM وبلا سيرفر):
//   node server/print_system_test.ts
// تغطي: 3 قوالب × 4 مقاسات، قواعد @page بالوحدات، الفلترة، الهوية التاريخية،
// تحقق أصول الشعار، تحويل مقاسات Electron، صلاحية إعادة الطباعة، وسطور التدقيق.

import {
  PAGE_SIZES,
  TEMPLATE_PRESETS,
  LEGACY_TEMPLATE_MAP,
  ELEMENT_ORDER,
  DEFAULT_ELEMENTS,
  MAX_LOGO_BYTES,
  normalizeTemplate,
  applyTemplatePreset,
  paperWidthMm,
  printableWidth,
  sheetCssWidth,
  printableMinHeight,
  pageCss,
  itemsPerPageOf,
  filterElements,
  buildPrintIdentity,
  resolvePrintDesign,
  normalizePrintDesign,
  electronPageSize,
  validateLogoAsset,
  canReprint,
  printAuditInfo,
  type PrintDesign,
} from '../lib/printDesign.ts';

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} ${detail}`);
  if (ok) passed++;
  else failed++;
};

const baseDesign = (): PrintDesign => normalizePrintDesign({});

// ---------- المقاسات والقوالب (3 × 4) ----------
check('4 paper sizes (A4/A5/80mm/58mm)',
  PAGE_SIZES.length === 4 && PAGE_SIZES.map(p => p.id).join(',') === 'A4,A5,80mm,58mm');

check('exactly 3 templates',
  Object.keys(TEMPLATE_PRESETS).length === 3 &&
  ['classic', 'professional', 'thermal'].every(t => t in TEMPLATE_PRESETS));

check('legacy template1/template2 mapped',
  normalizeTemplate('template1') === 'classic' && normalizeTemplate('template2') === 'professional' &&
  LEGACY_TEMPLATE_MAP['template1'] === 'classic');

check('unknown template falls back to thermal',
  normalizeTemplate('wat') === 'thermal' && normalizeTemplate(undefined) === 'thermal' &&
  normalizeTemplate('thermal') === 'thermal');

check('classic preset applied (A4, margin 12, sky)',
  (() => {
    const next = applyTemplatePreset(baseDesign(), 'classic');
    return next.template === 'classic' && next.pageSize === 'A4' && next.marginMm === 12 && next.primaryColor === '#0ea5e9';
  })());

check('thermal preset applied (80mm, margin 4, black)',
  (() => {
    const next = applyTemplatePreset(baseDesign(), 'template2'); // قالب قديم → احترافي بعده؟ template2→professional
    const th = applyTemplatePreset(baseDesign(), 'thermal');
    return th.template === 'thermal' && th.pageSize === '80mm' && th.marginMm === 4 && th.primaryColor === '#000000' &&
      next.template === 'professional' && next.pageSize === 'A4';
  })());

// ---------- قواعد @page والوحدات ----------
check('pageCss A4 portrait + margin mm',
  pageCss('A4', 12) === '@page { size: A4 portrait; margin: 12mm; }');

check('pageCss A5 + zero margin',
  pageCss('A5', 0) === '@page { size: A5 portrait; margin: 0mm; }');

check('pageCss 80mm roll (auto height)',
  pageCss('80mm', 5) === '@page { size: 80mm auto; margin: 5mm; }');

check('sheet/content/min-height math',
  paperWidthMm('A5') === 148 &&
  printableWidth('A4', 10) === '190mm' &&
  sheetCssWidth('58mm') === '58mm' &&
  printableMinHeight('A4').endsWith('mm') &&
  printableMinHeight('80mm') === '160mm');

// ---------- التقسيم وعناصر الإيصال ----------
check('itemsPerPage default 10 / custom / clamp',
  itemsPerPageOf(undefined) === 10 && itemsPerPageOf({ maxItemsPerPage: 5 }) === 5 &&
  itemsPerPageOf({ maxItemsPerPage: 0 }) === 10 && itemsPerPageOf({ maxItemsPerPage: 99 }) === 50);

check('filterElements default keeps historical default list',
  JSON.stringify(filterElements(undefined)) === JSON.stringify(DEFAULT_ELEMENTS));

check('filterElements canonical order + junk dropped',
  JSON.stringify(filterElements(['totals', 'bogus', 'header', 'notes'])) ===
  JSON.stringify(ELEMENT_ORDER.filter(e => ['totals', 'header', 'notes'].includes(e))));

// ---------- الهوية التاريخية ----------
const settings = {
  shopName: 'Test Salon',
  phone: '01000000000',
  address: 'Somewhere',
  printDesign: {
    ...baseDesign(),
    template: 'template2',
    pageSize: 'A5' as const,
    primaryColor: '#123456',
    elements: ['header', 'totals', 'footer'],
    logoFrontDataUrl: 'data:image/png;base64,AAAA',
  },
};

const ident = buildPrintIdentity(settings, 1700000000000);

check('identity captures shop + design + capturedAt',
  ident.shopName === 'Test Salon' && ident.phone === '01000000000' &&
  ident.capturedAt === 1700000000000 && ident.primaryColor === '#123456' &&
  ident.pageSize === 'A5' && ident.template === 'professional');

check('identity excludes logo binary (no dataUrl keys)',
  !Object.prototype.hasOwnProperty.call(ident, 'logoFrontDataUrl') &&
  !Object.prototype.hasOwnProperty.call(ident, 'logoBackDataUrl'));

check('identity elements filtered to known list',
  JSON.stringify(ident.elements) === JSON.stringify(['header', 'totals', 'footer']));

const invoiceNoSnap: any = { id: 7, uid: 'u-7', total: 250 };
const live = baseDesign();

check('resolve without snapshot → live design unchanged',
  resolvePrintDesign(invoiceNoSnap, live) === live);

const invoiceSnap: any = {
  id: 8, uid: 'u-8', total: 100,
  printSnapshot: { ...ident, primaryColor: '#abcdef', pageSize: '80mm', marginMm: 2 },
};
const resolved = resolvePrintDesign(invoiceSnap, { ...live, logoFrontDataUrl: 'data:image/png;base64,LIVE' });

check('resolve with snapshot → snapshot wins on design fields',
  resolved.primaryColor === '#abcdef' && resolved.pageSize === '80mm' && resolved.marginMm === 2 &&
  (resolved as any).template === 'professional');

check('resolve keeps live logo (not in snapshot)',
  resolved.logoFrontDataUrl === 'data:image/png;base64,LIVE');

// ---------- تطبيع الإعدادات القديمة ----------
const normalized = normalizePrintDesign({ pageSize: 'A4' as any, template: 'template1' as any, marginMm: -5 as any, elements: ['header', 'items', 'items'] as any, maxItemsPerPage: 0 as any });

check('normalize fills defaults + legacy values',
  normalized.pageSize === 'A4' && normalized.template === 'classic' &&
  normalized.marginMm === 0 && normalized.baseFontSize === 10 &&
  JSON.stringify(normalized.elements) === JSON.stringify(['header', 'items']) &&
  normalized.maxItemsPerPage === 10);

check('normalize rejects junk (null input)',
  normalizePrintDesign(null as any).pageSize === '80mm' &&
  normalizePrintDesign(undefined as any).template === 'thermal');

// ---------- إزالة QR من نموذج الطباعة (الورقة تعرض معلومات المحل فقط) ----------
check('showQRCode removed from design model + identity',
  !('showQRCode' in baseDesign()) &&
  !('showQRCode' in buildPrintIdentity({ shopName: 'صالون', phone: '', address: '', printDesign: baseDesign() })));

// ---------- أصول الشعار ----------
check('validateLogoAsset accepts png within size',
  validateLogoAsset({ name: 'logo.png', type: 'image/png', size: 50 * 1024 }).ok === true);

check('validateLogoAsset rejects oversize / bad mime / no name',
  (() => {
    const big = validateLogoAsset({ name: 'l.png', type: 'image/png', size: MAX_LOGO_BYTES + 1 });
    const mime = validateLogoAsset({ name: 'l.svg', type: 'image/svg+xml', size: 1000 });
    const name = validateLogoAsset({ name: '  ', type: 'image/png', size: 1000 });
    const zero = validateLogoAsset({ name: 'l.png', type: 'image/png', size: 0 });
    return big.ok === false && big.error === 'too_big' &&
      mime.ok === false && mime.error === 'type' &&
      name.ok === false && name.error === 'name' &&
      zero.ok === false && zero.error === 'size';
  })());

// ---------- تحويل Electron ----------
check('electronPageSize A4/A5 by name',
  electronPageSize('A4') === 'A4' && electronPageSize('A5') === 'A5');

check('electronPageSize rolls in microns',
  JSON.stringify(electronPageSize('80mm')) === JSON.stringify({ width: 80000, height: 200000 }) &&
  JSON.stringify(electronPageSize('58mm')) === JSON.stringify({ width: 58000, height: 200000 }));

// ---------- الصلاحيات والتدقيق ----------
check('canReprint: admin yes, guest no, invoices/permissions yes',
  canReprint({ role: 'admin' }) === true &&
  canReprint(null) === false &&
  canReprint({ role: 'cashier', permissions: ['invoices'] }) === true &&
  canReprint({ role: 'waiter', permissions: ['dashboard'] }) === false &&
  canReprint({ role: 'cashier' }) === true);

check('printAuditInfo structured per action kind',
  (() => {
    const r = printAuditInfo('reprint', 6);
    const p = printAuditInfo('print');
    const d = printAuditInfo('design');
    return r.action === 'Print' && r.details.includes('#6') && r.details.includes('Reprinted') &&
      p.action === 'Print' && p.details === 'Printed invoice' &&
      d.action === 'Print' && d.details.includes('design');
  })());

console.log('------------------------------------------------------------');
console.log(`${passed}/${passed + failed} اختبارات ناجحة`);
if (failed > 0) process.exit(1);
