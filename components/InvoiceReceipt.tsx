// إيصال الفاتورة القابل للطباعة — مُستخرج من CreateInvoicePage ليُعاد طباعته من
// قائمة الفواتير أيضاً، ويعمل بـ 3 قوالب × 4 مقاسات مع هوية تاريخية لكل فاتورة.
// قواعد @page (بالمللي/المقاس) تُحقن لهذا العنصر فقط أثناء وجوده في DOM.

import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice } from '../types';
import { parseInvoiceDate } from '../lib/dates';
import { paymentOf } from '../lib/payments';
import {
  resolvePrintDesign,
  normalizePrintDesign,
  pageCss,
  sheetCssWidth,
  printableMinHeight,
  itemsPerPageOf,
  filterElements,
} from '../lib/printDesign';

const PAGE_RULES_ID = 'procashier-page-rules';

// أسماء النظام الافتراضية لا تُطبع على الورقة — تعرض معلومات المحل/الصالون فقط
const SYSTEM_NAMES = new Set(['pro cashier', 'procashier', 'pro casher', 'raizon pro', 'raizon']);
const printableShopName = (value: string) => {
  const s = (value || '').trim();
  return !s || SYSTEM_NAMES.has(s.toLowerCase()) ? '' : s;
};

export const InvoiceReceipt = ({
  invoice,
  demo = false,
  designOverride,
  identityOverride,
}: {
  invoice: Invoice;
  demo?: boolean;
  /** المعاينة التجريبية: تصميم من نموذج الإعدادات (قبل الحفظ) */
  designOverride?: Parameters<typeof normalizePrintDesign>[0];
  /** هوية بديلة للمعاينة (اسم/هاتف/عنوان الشعار من النموذج) */
  identityOverride?: { shopName?: string; phone?: string; address?: string };
}) => {
  const { state, t, language } = useApp();
  const live = normalizePrintDesign(designOverride ?? state.settings.printDesign);
  const design = resolvePrintDesign(invoice, live);
  const ident = invoice.printSnapshot;

  // هوية تاريخية: توقيع الصالون وقت البيع (الفواتير القديمة تستخدم الإعدادات الحية)
  const shopName = printableShopName(
    ident ? ident.shopName : (identityOverride?.shopName ?? state.settings.shopName) || ''
  );
  const shopPhone = ident ? ident.phone : (identityOverride?.phone ?? state.settings.phone) || '';
  const shopAddress = ident ? ident.address : (identityOverride?.address ?? state.settings.address) || '';

  // قاعدة @page الحية (مقاس الورق + الهامش بالمليمتر) — لا تُحقن في المعاينة التجريبية
  useEffect(() => {
    if (demo) return;
    const css = pageCss(design.pageSize, design.marginMm);
    let el = document.getElementById(PAGE_RULES_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = PAGE_RULES_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [demo, design.pageSize, design.marginMm]);

  const accent = design.primaryColor;
  const elements = filterElements(design.elements);
  const itemsPerPage = itemsPerPageOf(design);
  const totalPages = Math.ceil((invoice.items || []).length / itemsPerPage) || 1;
  const rtl = language === 'ar';
  const dateLocale = rtl ? 'ar-u-nu-latn' : 'en-US';
  const textAlign = rtl ? 'text-right' : 'text-left';
  const customer = state.customers.find(c => c.id === invoice.customerId);
  const invDate = parseInvoiceDate(invoice.date);
  const timeText = new Date().toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateText = invDate.toLocaleDateString(dateLocale);

  // حدود الجداول بلون الهوية + أنماط الصفوف (رأس أسود وظلال متبادلة كالصورة المرجعية)
  const bd = `1px solid ${accent}`;
  const ink: React.CSSProperties = { backgroundColor: accent, color: '#ffffff', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' };
  const zebra: React.CSSProperties = { backgroundColor: `${accent}10`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' };
  const fmt = (n: number) => String(Math.round(Number(n) * 100) / 100);

  // الخصم والضريبة يُطبعان ضمن صفوف الإجماليات أسفل جدول الأصناف
  const discountAmount = (invoice.subtotal * invoice.discountPercent) / 100;
  const taxAmount = (invoice.subtotal - discountAmount) * invoice.taxPercent / 100;
  const payInfo = paymentOf(invoice);

  // صفوف الإجماليات: مدمجة في جدول الأصناف (span) أو كجدول مستقل بعمودين
  const totalsRows = (span: boolean): React.ReactNode => (
    <>
      <tr key="t-sub" style={zebra}>
        <td colSpan={span ? 3 : undefined} className={`py-1.5 px-2 font-bold ${span ? '' : 'w-3/4'} ${textAlign}`} style={{ border: bd }}>{t('subtotal_label')}</td>
        <td className="py-1.5 text-center font-bold" style={{ border: bd }}>{fmt(invoice.subtotal)}</td>
      </tr>
      <tr key="t-disc">
        <td colSpan={span ? 3 : undefined} className={`py-1.5 px-2 font-bold ${span ? '' : 'w-3/4'} ${textAlign}`} style={{ border: bd }}>{t('discount_label')}</td>
        <td className="py-1.5 text-center font-bold" style={{ border: bd }}>{discountAmount > 0 ? fmt(discountAmount) : '--'}</td>
      </tr>
      <tr key="t-tax">
        <td colSpan={span ? 3 : undefined} className={`py-1.5 px-2 font-bold ${span ? '' : 'w-3/4'} ${textAlign}`} style={{ border: bd }}>{t('tax_label')}</td>
        <td className="py-1.5 text-center font-bold" style={{ border: bd }}>{taxAmount > 0 ? fmt(taxAmount) : '--'}</td>
      </tr>
      <tr key="t-total" style={ink}>
        <td colSpan={span ? 3 : undefined} className={`py-1.5 px-2 text-sm font-bold ${span ? '' : 'w-3/4'} ${textAlign}`} style={{ border: bd }}>{t('total_label')}</td>
        <td className="py-1.5 text-center text-lg font-bold" style={{ border: bd }}>{fmt(invoice.total)}</td>
      </tr>
    </>
  );

  return (
    <>
      <div
        className={`bg-white border shadow-lg print:shadow-none print:border-0 print:block print:w-full print:absolute print:top-0 print:left-0 print:z-[9999] ${demo ? '' : 'neon-frame'}`}
        id={demo ? 'printable-invoice-demo' : 'printable-invoice'}
        style={{
          color: design.textColor,
          fontSize: `${design.baseFontSize}px`,
          width: sheetCssWidth(design.pageSize),
          padding: `${Math.max(0, design.marginMm)}mm`,
          minHeight: printableMinHeight(design.pageSize),
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
        dir={rtl ? 'rtl' : 'ltr'}
        data-print-template={design.template}
        data-print-size={design.pageSize}
      >
        {Array.from({ length: totalPages }).map((_, pageIndex) => {
          const pageItems = (invoice.items || []).slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage);
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div
              key={pageIndex}
              className={`w-full relative font-cairo ${rtl ? '' : 'font-sans'}`}
              dir={rtl ? 'rtl' : 'ltr'}
              style={{
                color: design.primaryColor,
                padding: 0,
                width: '100%',
                minHeight: printableMinHeight(design.pageSize),
                pageBreakAfter: isLastPage ? 'auto' : 'always',
              }}
            >
              {elements.map(element => {
                switch (element) {
                  case 'header':
                    return (
                      <div key="header" className="text-center mb-4">
                        {design.logoFrontDataUrl ? (
                          <img
                            src={design.logoFrontDataUrl}
                            alt="Logo"
                            style={{
                              width: `min(100%, ${design.logoSizePx * 2}px)`,
                              maxWidth: '200px',
                              height: 'auto',
                              display: 'block',
                              marginLeft: design.logoFrontAlign === 'right' ? 'auto' : design.logoFrontAlign === 'center' ? 'auto' : '0',
                              marginRight: design.logoFrontAlign === 'left' ? 'auto' : design.logoFrontAlign === 'center' ? 'auto' : '0',
                              marginBottom: '1rem',
                            }}
                          />
                        ) : (
                          <div className="text-sm font-bold mb-1">
                            {shopAddress || shopName || t('brand_header_text')}
                            {' - '}
                            {shopPhone || '01102002750'}
                          </div>
                        )}
                        {design.titleText ? (
                          <h1 className="text-3xl font-bold mb-2 font-cairo" style={{ color: design.primaryColor }}>
                            {design.titleText}
                          </h1>
                        ) : null}
                      </div>
                    );
                  case 'info':
                    return (
                      <div key="info" className="mb-4 text-xs font-bold">
                        <div className={`leading-6 whitespace-nowrap ${textAlign}`}>
                          {t('customer_label')}: {invoice.customerName}
                          {customer?.id ? ` · #${customer.id}` : ''}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 leading-6 ${textAlign}`}>
                            <div>{t('phone_label')}: {customer?.phone || shopPhone || '01102002750'}</div>
                            <div>{t('date_label')}: {dateText}</div>
                            <div>{t('time_label')}: {timeText}</div>
                          </div>
                          <div className={`flex-1 ${textAlign}`}>
                            {t('invoice_no')}: {invoice.id}
                          </div>
                        </div>
                      </div>
                    );
                  case 'items':
                    return (
                      <table
                        key="items"
                        className="w-full mb-3"
                        style={{ borderCollapse: 'collapse', border: `2px solid ${accent}` }}
                      >
                        <thead>
                          <tr style={ink}>
                            <th className="py-1.5 text-center font-bold w-1/3" style={{ border: bd }}>{t('items_table_header')}</th>
                            <th className="py-1.5 text-center font-bold w-1/6" style={{ border: bd }}>{t('qty_table_header')}</th>
                            <th className="py-1.5 text-center font-bold w-1/4" style={{ border: bd }}>{t('price_table_header')}</th>
                            <th className="py-1.5 text-center font-bold w-1/4" style={{ border: bd }}>{t('total_label')}</th>
                          </tr>
                        </thead>
                        <tbody className="font-bold">
                          {pageItems.map((item, idx) => (
                            <tr key={idx} style={idx % 2 === 1 ? zebra : undefined}>
                              <td className={`py-1.5 px-1 ${textAlign}`} style={{ border: bd }}>{rtl ? item.name : ((item as { nameEn?: string }).nameEn || item.name)}</td>
                              <td className="py-1.5 text-center" style={{ border: bd }}>{item.quantity}</td>
                              <td className="py-1.5 text-center" style={{ border: bd }}>{fmt(item.price)}</td>
                              <td className="py-1.5 text-center font-bold" style={{ border: bd }}>{fmt(item.quantity * item.price)}</td>
                            </tr>
                          ))}
                          {isLastPage && elements.includes('totals') ? totalsRows(true) : null}
                        </tbody>
                      </table>
                    );
                  case 'notes':
                    return isLastPage && (invoice.notes || state.settings.loyaltyEnabled || payInfo.parts.length > 0) ? (
                      <div key="notes" className="mb-6 border-t border-b py-2" style={{ borderColor: accent }}>
                        {payInfo.parts.length > 0 && (
                          <div className={`${textAlign} text-xs mb-2`}>
                            <div className="font-bold mb-1">{t('payment_method')}:</div>
                            {payInfo.parts.map((p, i) => (
                              <div key={i}>{t(p.method)}: {fmt(p.amount)}</div>
                            ))}
                            {payInfo.change > 0 && (
                              <div className="font-bold">{t('change_due')}: {fmt(payInfo.change)}</div>
                            )}
                          </div>
                        )}
                        {invoice.notes && (
                          <div className={`${textAlign} text-xs mb-2`}>
                            <div className="font-bold mb-1">{t('notes')}:</div>
                            <div className="whitespace-pre-wrap">{invoice.notes}</div>
                          </div>
                        )}
                        {state.settings.loyaltyEnabled && (
                          <div className={`${textAlign} text-[10px] opacity-90 mt-2 pt-2`} style={{ borderTop: `1px solid ${accent}33` }}>
          <div className="font-bold mb-1">{t('loyalty_program')}:</div>
          <div>{t('loyalty_rule_desc')}</div>
          <div className="mt-1 font-bold">{t('points_earned')}{Math.floor(invoice.total / 20)}</div>
                          </div>
                        )}
                      </div>
                    ) : null;
                  case 'totals':
                    // مدمجة داخل جدول الأصناف — هنا فقط إذا كان جدول الأصناف مطفأ
                    return isLastPage && !elements.includes('items') ? (
                      <table
                        key="totals"
                        className="w-full mb-3 font-bold"
                        style={{ borderCollapse: 'collapse', border: `2px solid ${accent}` }}
                      >
                        <tbody>{totalsRows(false)}</tbody>
                      </table>
                    ) : null;
                  case 'footer':
                    return (
                      <div key="footer" className="mt-auto pt-4 flex flex-col items-center text-center font-bold">
                        <div className={`w-full mb-3 ${textAlign}`}>
                          <div className="text-sm">{shopAddress || shopName || t('brand_header_text')}</div>
                          <div className="text-xs">{shopPhone || '01102002750'}</div>
                        </div>
                        <p className="text-sm mb-1">{t('invoice_footer_greeting')}</p>
                        <p className="text-xs underline">{design.footerText || t('thank_you_label')}</p>
                        <p className="text-[8px] mt-1 opacity-60">{t('page')} {pageIndex + 1} {t('of')} {totalPages}</p>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          );
        })}
      </div>
      {design.logoBackDataUrl && (
        <div
          className="print-only"
          style={{ pageBreakBefore: 'always', width: sheetCssWidth(design.pageSize), margin: '0 auto', textAlign: design.logoBackAlign === 'left' ? 'left' : design.logoBackAlign === 'right' ? 'right' : 'center', padding: `${Math.max(0, design.marginMm)}mm`, boxSizing: 'border-box' }}
          id={demo ? 'printable-invoice-back-demo' : 'printable-invoice-back'}
        >
          <img src={design.logoBackDataUrl} alt="Back Logo" style={{ width: design.logoSizePx, height: 'auto', display: 'inline-block' }} />
          <div style={{ marginTop: 16, color: design.primaryColor, fontSize: `${design.baseFontSize}px` }}>
            <h2 style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{shopName || t('brand_header_text')}</h2>
            <p>{shopAddress} - {shopPhone}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoiceReceipt;
