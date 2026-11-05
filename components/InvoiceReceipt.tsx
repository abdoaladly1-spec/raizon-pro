// إيصال الفاتورة الحراري — مطابق لصورة الإيصال 100% بخط Tahoma بالأبيض والأسود
// تظليل أسود خفيف (monochrome) مع إمكانية التفعيل والإلغاء في أي وقت
// دعم التحكم المتسلسل في ظهور كل عنصر (لوجو، عنوان، هاتف، تاريخ، عميل، أصناف، إجماليات، وداع)
// فاصل التاريخ والوقت بـ | فقط ورسالة الوداع متأقلمة أسفل الجدول مباشرة

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice } from '../types';
import { parseInvoiceDate } from '../lib/dates';
import {
  resolvePrintDesign,
  normalizePrintDesign,
  pageCss,
  sheetCssWidth,
  printableMinHeight,
  itemsPerPageOf,
} from '../lib/printDesign';

const PAGE_RULES_ID = 'procashier-page-rules';

// تنسيق الوقت بحسب النظام المختار: 12 ساعة (02:47PM) أو 24 ساعة (14:47)
const formatTime = (dateObj: Date, format: '12h' | '24h' = '12h'): string => {
  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  if (format === '24h') {
    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `${hStr}:${mStr}`;
  }
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const hStr = h12 < 10 ? `0${h12}` : `${h12}`;
  return `${hStr}:${mStr}${ampm}`;
};

// تنسيق التاريخ والوقت بفاصل | فقط
const formatDateTimeBanner = (timeObj: Date, dateObj: Date, format: '12h' | '24h' = '12h'): string => {
  const time = formatTime(timeObj, format);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}/${month}/${day} | ${time}`;
};

export const InvoiceReceipt = ({
  invoice,
  demo = false,
  designOverride,
  identityOverride,
}: {
  invoice: Invoice;
  demo?: boolean;
  designOverride?: Parameters<typeof normalizePrintDesign>[0];
  identityOverride?: { shopName?: string; phone?: string; address?: string };
}) => {
  const { state, t, language, currentUser, updateInvoice } = useApp();
  const live = normalizePrintDesign(designOverride ?? state.settings.printDesign);
  const design = resolvePrintDesign(invoice, live);
  const ident = invoice.printSnapshot;

  // هوية المحل مطابقة للصورة المرفقة
  const shopName = (
    ident?.shopName ||
    identityOverride?.shopName ||
    state.settings.shopName ||
    'صالون ابراهيم نوار'
  ).trim();

  const shopPhone = (
    ident?.phone ||
    identityOverride?.phone ||
    state.settings.phone ||
    '01000000000-01000000001'
  ).trim();

  const shopAddress = (
    ident?.address ||
    identityOverride?.address ||
    state.settings.address ||
    'العنوان هنا'
  ).trim();

  // بيانات نظام الولاء المرتبطة بالعميل والفاتورة
  const customerObj = state.customers.find(
    (c) => c.id === invoice.customerId || (c.phone && invoice.customerName && c.phone === invoice.customerName)
  );
  const loyaltyPointsEarned = 0;


  // قاعدة @page للطباعة
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

  const itemsPerPage = itemsPerPageOf(design);
  const totalPages = Math.ceil((invoice.items || []).length / itemsPerPage) || 1;
  const rtl = language === 'ar';

  const invDate = parseInvoiceDate(invoice.date);
  const invTimestamp = invoice.timestamp ? new Date(invoice.timestamp) : invDate;
  const printTimeObj = new Date();

  // نظام الوقت المختار من الإعدادات (12 ساعة أو 24 ساعة)
  const timeFormat = (state.settings?.timeFormat as '12h' | '24h') || '12h';

  // القيم المحسوبة للأوقات والتاريخ بفاصل | فقط
  const dateTimeBanner = formatDateTimeBanner(invTimestamp, invDate, timeFormat);
  const entryTimeText = formatTime(invTimestamp, timeFormat);
  const printTimeText = formatTime(printTimeObj, timeFormat);

  const fmt = (n: number) => String(Math.round(Number(n) * 100) / 100);

  // حسابات الإجمالي الفرعي، الخصم، والضريبة
  const subtotalVal = Number(invoice.subtotal) || 0;
  const discountPercent = Number(invoice.discountPercent) || 0;
  const taxPercent = Number(invoice.taxPercent) || 0;
  const discountAmount = (subtotalVal * discountPercent) / 100;
  const taxableBase = Math.max(0, subtotalVal - discountAmount);
  const taxAmount = (taxableBase * taxPercent) / 100;
  const hasExtras = discountAmount > 0 || taxAmount > 0;
  const finalInvoiceTotal = invoice.total !== undefined && invoice.total !== null
    ? Number(invoice.total)
    : (hasExtras ? taxableBase + taxAmount : (invoice.items?.reduce((a, b) => a + (b.price * b.quantity), 0) || 80));

  const tpl = design.template || 'thermal';

  // تظليل أسود خفيف (monochrome) متناسب 100% مع الطباعة بالأبيض والأسود مع إمكانية التفعيل أو الإلغاء
  const isShadingEnabled = design.enableShading !== false;
  const lightHeaderBg = isShadingEnabled ? '#c4c8d0' : '#ffffff';

  // حالة ظهور العناصر المتسلسلة بحسب الإعدادات
  const vis = {
    logo: design.visibleElements?.logo !== false,
    shopName: design.visibleElements?.shopName !== false,
    address: design.visibleElements?.address !== false,
    phone: design.visibleElements?.phone !== false,
    dateTime: design.visibleElements?.dateTime !== false,
    customer: design.visibleElements?.customer !== false,
    items: design.visibleElements?.items !== false,
    totals: design.visibleElements?.totals !== false,
    footer: design.visibleElements?.footer !== false,
  };

  // بكرة الورق الحراري (80 مم و 58 مم) بدون حد أدنى مصطنع للارتفاع حتى يتأقلم تلقائياً مع محتوى الفاتورة
  const isRoll = design.pageSize === '80mm' || design.pageSize === '58mm';

  return (
    <>
      <div
        className="bg-white text-black font-bold border-0 shadow-none print:shadow-none print:border-0 print:block print:w-full print:absolute print:top-0 print:left-0 print:z-[9999]"
        id={demo ? 'printable-invoice-demo' : 'printable-invoice'}
        style={{
          color: '#000000',
          backgroundColor: '#ffffff',
          fontSize: '12px',
          width: sheetCssWidth(design.pageSize),
          padding: '2.5mm',
          minHeight: isRoll ? 'auto' : printableMinHeight(design.pageSize),
          margin: '0 auto',
          boxSizing: 'border-box',
          fontFamily: 'Tahoma, Arial, sans-serif',
          fontWeight: 700,
          border: 'none',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        dir={rtl ? 'rtl' : 'ltr'}
        data-print-template={tpl}
        data-print-size={design.pageSize}
      >
        {Array.from({ length: totalPages }).map((_, pageIndex) => {
          const pageItems = (invoice.items || []).slice(
            pageIndex * itemsPerPage,
            (pageIndex + 1) * itemsPerPage
          );
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div
              key={pageIndex}
              className="w-full relative flex flex-col font-bold border-0 p-0 text-black"
              style={{
                color: '#000000',
                backgroundColor: '#ffffff',
                minHeight: isRoll ? 'auto' : printableMinHeight(design.pageSize),
                pageBreakAfter: isLastPage ? 'auto' : 'always',
                boxSizing: 'border-box',
                fontFamily: 'Tahoma, Arial, sans-serif',
                fontWeight: 700,
                border: 'none',
              }}
            >
              <div>
                {/* 1. ترويسة الفاتورة: الشعار واسم المحل والعنوان والهاتف (حسب خيارات الظهور) */}
                {(vis.logo || vis.address || vis.phone) && (
                  <div className="text-center mb-1">
                    {vis.logo && (
                      design.logoFrontDataUrl ? (
                        <img
                          src={design.logoFrontDataUrl}
                          alt="Logo"
                          className="mx-auto block filter grayscale contrast-200"
                          style={{
                            width: '120px',
                            maxHeight: '120px',
                            objectFit: 'contain',
                            marginBottom: '4px',
                          }}
                        />
                      ) : (
                        <div className="mx-auto my-1 flex flex-col items-center justify-center">
                          <svg
                            viewBox="0 0 140 140"
                            className="w-[105px] h-[105px] text-black"
                            fill="none"
                          >
                            {/* دائرة مظللة بها كلمة اللوجو هنا */}
                            <circle cx="70" cy="70" r="65" fill="#f1f3f5" stroke="#000000" strokeWidth="2.5" />
                            <circle cx="70" cy="70" r="58" stroke="#000000" strokeWidth="1" strokeDasharray="4 2" />
                            <text
                              x="70"
                              y="76"
                              textAnchor="middle"
                              fill="#000000"
                              style={{
                                fontFamily: 'Tahoma, Arial, sans-serif',
                                fontSize: '15px',
                                fontWeight: 900,
                              }}
                            >
                              {rtl ? 'اللوجو هنا' : 'LOGO HERE'}
                            </text>
                          </svg>
                        </div>
                      )
                    )}

                    {/* 2. العنوان أسفل اللوجو */}
                    {vis.address && (
                      <p
                        className="text-black font-bold text-center leading-snug mt-1"
                        style={{ fontSize: '11px', fontFamily: 'Tahoma, Arial, sans-serif' }}
                      >
                        {shopAddress}
                      </p>
                    )}

                    {/* 3. رقم الهاتف أسفل العنوان */}
                    {vis.phone && (
                      <p
                        className="text-black font-bold text-center mt-0.5"
                        dir="ltr"
                        style={{ fontSize: '12px', fontFamily: 'Tahoma, Arial, sans-serif' }}
                      >
                        {shopPhone}
                      </p>
                    )}
                  </div>
                )}

                {/* 4. جدول التاريخ والوقت: بفاصل | فقط مع تظليل خانة "التاريخ" */}
                {vis.dateTime && (
                  <div style={{ marginTop: '5px', marginBottom: '5px' }}>
                    <table
                      className="w-full border-collapse font-bold"
                      style={{
                        border: '1px solid #000000',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                        fontSize: '11.5px',
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                            style={{
                              width: '28%',
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'التاريخ' : 'Date'}
                          </td>
                          <td
                            className="text-black text-center align-middle font-mono font-bold"
                            dir="ltr"
                            style={{
                              padding: '3px 4px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {dateTimeBanner}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 5. جدول بيانات العميل: مع تظليل العناوين (اسم العميل / وقت الدخول / وقت الطباعة) */}
                {vis.customer && (
                  <div style={{ marginTop: '5px', marginBottom: '5px' }}>
                    <table
                      className="w-full border-collapse font-bold"
                      style={{
                        border: '1px solid #000000',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                        fontSize: '11.5px',
                      }}
                    >
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #000000' }}>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                            style={{
                              width: '28%',
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'اسم العميل' : 'Client Name'}
                          </td>
                          <td
                            className="text-black text-center align-middle"
                            style={{
                              padding: '3px 4px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {invoice.customerName || 'عبدالرحمن فتحي العدلي'}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #000000' }}>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                            style={{
                              width: '28%',
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'وقت الدخول' : 'Entry Time'}
                          </td>
                          <td
                            className="text-black text-center align-middle font-mono font-bold"
                            dir="ltr"
                            style={{
                              padding: '3px 4px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {entryTimeText}
                          </td>
                        </tr>
                        <tr>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                            style={{
                              width: '28%',
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'وقت الطباعة' : 'Print Time'}
                          </td>
                          <td
                            className="text-black text-center align-middle font-mono font-bold"
                            dir="ltr"
                            style={{
                              padding: '3px 4px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {printTimeText}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 6. جدول الأصناف: تظليل صف العناوين (الكمية | الصنف | الإجمالي) */}
                {vis.items && (
                  <div style={{ marginTop: '5px', marginBottom: '5px' }}>
                    <table
                      className="w-full border-collapse font-bold"
                      style={{
                        border: '1px solid #000000',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                        fontSize: '11.5px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid #000000',
                            backgroundColor: lightHeaderBg,
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          }}
                        >
                          <td
                            className="invoice-header-shaded text-black text-center align-middle"
                            style={{
                              width: '22%',
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'الكمية' : 'Qty'}
                          </td>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle"
                            style={{
                              padding: '3px 4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'الصنف' : 'Item'}
                          </td>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle"
                            style={{
                              width: '26%',
                              padding: '3px 4px',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                            }}
                          >
                            {rtl ? 'الإجمالي' : 'Total'}
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.length > 0 ? (
                          pageItems.map((item, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: idx === pageItems.length - 1 ? 'none' : '1px solid #000000',
                              }}
                            >
                              <td
                                className="text-center align-middle text-black font-mono font-bold"
                                style={{
                                  padding: '3px 4px',
                                  borderInlineEnd: '1px solid #000000',
                                  fontFamily: 'Tahoma, Arial, sans-serif',
                                }}
                              >
                                {item.quantity}
                              </td>
                              <td
                                className="text-center align-middle text-black"
                                style={{
                                  padding: '3px 4px',
                                  borderInlineEnd: '1px solid #000000',
                                  fontFamily: 'Tahoma, Arial, sans-serif',
                                }}
                              >
                                {rtl ? item.name : ((item as { nameEn?: string }).nameEn || item.name)}
                              </td>
                              <td
                                className="text-center align-middle text-black font-mono font-bold"
                                style={{
                                  padding: '3px 4px',
                                  fontFamily: 'Tahoma, Arial, sans-serif',
                                }}
                              >
                                {fmt(item.price * item.quantity)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              className="text-center align-middle text-black font-mono font-bold"
                              style={{
                                padding: '3px 4px',
                                borderInlineEnd: '1px solid #000000',
                                fontFamily: 'Tahoma, Arial, sans-serif',
                              }}
                            >
                              1
                            </td>
                            <td
                              className="text-center align-middle text-black"
                              style={{
                                padding: '3px 4px',
                                borderInlineEnd: '1px solid #000000',
                                fontFamily: 'Tahoma, Arial, sans-serif',
                              }}
                            >
                              قص شعر
                            </td>
                            <td
                              className="text-center align-middle text-black font-mono font-bold"
                              style={{
                                padding: '3px 4px',
                                fontFamily: 'Tahoma, Arial, sans-serif',
                              }}
                            >
                              80
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 7. جدول الإجماليات: الإجمالي الفرعي، الخصم، والضريبة عند توفرهم، مع تظليل خانات العناوين */}
                {vis.totals && isLastPage && (
                  <div style={{ marginTop: '5px', marginBottom: '5px' }}>
                    <table
                      className="w-full border-collapse font-bold"
                      style={{
                        border: '1px solid #000000',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                      }}
                    >
                      <tbody>
                        {/* الإجمالي الفرعي والخصم والضريبة يظهرون عند وجود خصم أو ضريبة محددة */}
                        {hasExtras && (
                          <>
                            <tr style={{ borderBottom: '1px solid #000000' }}>
                              <td
                                className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                                style={{
                                  width: '45%',
                                  padding: '3.5px 4px',
                                  borderInlineEnd: '1px solid #000000',
                                  backgroundColor: lightHeaderBg,
                                  WebkitPrintColorAdjust: 'exact',
                                  printColorAdjust: 'exact',
                                  fontSize: '11.5px',
                                  fontFamily: 'Tahoma, Arial, sans-serif',
                                }}
                              >
                                {rtl ? 'الإجمالي الفرعي' : 'Subtotal'}
                              </td>
                              <td
                                className="text-center align-middle text-black font-mono font-bold"
                                style={{
                                  padding: '3.5px 4px',
                                  fontSize: '12px',
                                  fontFamily: 'Tahoma, Arial, sans-serif',
                                }}
                              >
                                {fmt(subtotalVal)} {rtl ? 'ج.م' : 'EGP'}
                              </td>
                            </tr>

                            {/* الخصم (إذا توفر) */}
                            {discountAmount > 0 && (
                              <tr style={{ borderBottom: '1px solid #000000' }}>
                                <td
                                  className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                                  style={{
                                    width: '45%',
                                    padding: '3.5px 4px',
                                    borderInlineEnd: '1px solid #000000',
                                    backgroundColor: lightHeaderBg,
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                    fontSize: '11.5px',
                                    fontFamily: 'Tahoma, Arial, sans-serif',
                                  }}
                                >
                                  {rtl ? 'الخصم' : 'Discount'} {discountPercent > 0 ? `(${discountPercent}%)` : ''}
                                </td>
                                <td
                                  className="text-center align-middle text-black font-mono font-bold"
                                  style={{
                                    padding: '3.5px 4px',
                                    fontSize: '12px',
                                    fontFamily: 'Tahoma, Arial, sans-serif',
                                  }}
                                >
                                  -{fmt(discountAmount)} {rtl ? 'ج.م' : 'EGP'}
                                </td>
                              </tr>
                            )}

                            {/* الضريبة (إذا توفرت) */}
                            {taxAmount > 0 && (
                              <tr style={{ borderBottom: '1px solid #000000' }}>
                                <td
                                  className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                                  style={{
                                    width: '45%',
                                    padding: '3.5px 4px',
                                    borderInlineEnd: '1px solid #000000',
                                    backgroundColor: lightHeaderBg,
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                    fontSize: '11.5px',
                                    fontFamily: 'Tahoma, Arial, sans-serif',
                                  }}
                                >
                                  {rtl ? 'الضريبة' : 'Tax'} {taxPercent > 0 ? `(${taxPercent}%)` : ''}
                                </td>
                                <td
                                  className="text-center align-middle text-black font-mono font-bold"
                                  style={{
                                    padding: '3.5px 4px',
                                    fontSize: '12px',
                                    fontFamily: 'Tahoma, Arial, sans-serif',
                                  }}
                                >
                                  +{fmt(taxAmount)} {rtl ? 'ج.م' : 'EGP'}
                                </td>
                              </tr>
                            )}
                          </>
                        )}

                        {/* صف إجمالي الفاتورة الأساسي مع تظليل خانة العنوان */}
                        <tr>
                          <td
                            className="invoice-header-shaded text-black text-center align-middle whitespace-nowrap"
                            style={{
                              width: '45%',
                              padding: '4px',
                              borderInlineEnd: '1px solid #000000',
                              backgroundColor: lightHeaderBg,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontSize: '13px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                              fontWeight: 900,
                            }}
                          >
                            {rtl ? 'إجمالي الفاتورة' : 'Total'}
                          </td>
                          <td
                            className="text-center align-middle text-black font-bold"
                            style={{
                              padding: '4px',
                              fontSize: '14px',
                              fontFamily: 'Tahoma, Arial, sans-serif',
                              fontWeight: 900,
                            }}
                          >
                            {fmt(finalInvoiceTotal)} {rtl ? 'ج.م' : 'EGP'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 7.5 ملاحظات الفاتورة ونظام الولاء (فوق رسالة الوداع مباشرة) */}
                {isLastPage && (
                  <div style={{ marginTop: '6px', marginBottom: '6px' }} className="w-full">
                    {/* عرض رصيد الحساب الآجل إن وُجد */}
                    {customerObj && (customerObj.balance || 0) > 0 && (
                      <div
                        className="text-center font-bold text-black"
                        style={{
                          fontSize: '10.5px',
                          border: '1px dashed #000000',
                          padding: '3px 5px',
                          marginBottom: '5px',
                          backgroundColor: isShadingEnabled ? '#f1f3f5' : '#ffffff',
                          fontFamily: 'Tahoma, Arial, sans-serif',
                        }}
                      >
                        <span className="inline-block">
                          {rtl ? 'الرصيد المتبقي على الحساب (المديونية):' : 'Outstanding Credit Balance:'}{' '}
                          {Number(customerObj.balance).toLocaleString('en-US')} {rtl ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                    )}

                    {/* ملاحظات الفاتورة: تظهر فقط في حال تعيين ملاحظة عند إنشاء الفاتورة */}
                    {Boolean(invoice.notes && invoice.notes.trim()) && (
                      <div
                        style={{
                          border: '1px solid #000000',
                          padding: '4px 6px',
                          marginBottom: '4px',
                          fontFamily: 'Tahoma, Arial, sans-serif',
                          fontSize: '11px',
                        }}
                      >
                        <div className="mb-1">
                          <span className="font-bold underline text-black">
                            {rtl ? 'ملاحظات الفاتورة:' : 'Invoice Notes:'}
                          </span>
                        </div>
                        <p className="whitespace-pre-line text-black font-semibold text-[11px] leading-tight">
                          {invoice.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

{/* 8. تذييل الفاتورة: رسالة الوداع والتذييل أسفل جدول الإجمالي مباشرة وبشكل متأقلم */}
                {vis.footer && isLastPage && (
                  <div style={{ marginTop: '8px', paddingTop: '4px', textAlign: 'center' }}>
                    <p
                      className="text-black text-center tracking-wide"
                      style={{
                        fontSize: '11px',
                        fontFamily: 'Tahoma, Arial, sans-serif',
                        fontWeight: 700,
                      }}
                    >
                      {design.footerText?.trim() || design.greetingText?.trim() || 'شكراً لزيارتكم'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default InvoiceReceipt;
