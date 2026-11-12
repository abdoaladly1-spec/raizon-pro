// إيصال المرتجع الحراري الاحترافي — مطابق لفاتورة المبيعات 100% بخط Tahoma والأبيض والأسود
// متوافق مع طابعات البون الحرارية 80mm و 58mm و A4، مع التظليل وتنسيق الفاتورة الأصلي

import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { ReturnRecord, Invoice } from '../types';
import {
  resolvePrintDesign,
  normalizePrintDesign,
  pageCss,
  sheetCssWidth,
  printableMinHeight,
} from '../lib/printDesign';
import { round2 } from '../lib/payments';

const PAGE_RULES_ID = 'procashier-page-rules';

export const ReturnReceipt = ({
  record,
  invoice,
}: {
  record: ReturnRecord;
  invoice?: Invoice;
}) => {
  const { state, t, language } = useApp();
  const live = normalizePrintDesign(state.settings.printDesign);
  const design = resolvePrintDesign(invoice, live);

  const shopName = (state.settings.shopName || 'RaiZon Pro').trim();
  const shopPhone = (state.settings.phone || '').trim();
  const shopAddress = (state.settings.address || '').trim();

  // إعداد قواعد @page للطباعة
  useEffect(() => {
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
  }, [design.pageSize, design.marginMm]);

  const rtl = language === 'ar';
  const isRoll = design.pageSize === '80mm' || design.pageSize === '58mm';
  const isShadingEnabled = design.enableShading !== false;
  const lightHeaderBg = isShadingEnabled ? '#c4c8d0' : '#ffffff';

  const recDate = record.date || new Date().toISOString().slice(0, 10);
  const recTime = record.timestamp
    ? new Date(record.timestamp).toLocaleTimeString(rtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  const customerName = record.customerName || invoice?.customerName || (rtl ? 'عميل نقدي' : 'Cash Client');
  const cashierName = record.staffName || record.createdBy || 'Admin';

  const fmt = (n: number) => String(Math.round(Number(n) * 100) / 100);

  return (
    <div
      className="bg-white text-black font-bold border-0 shadow-none print:shadow-none print:border-0 print:block print:w-full print:absolute print:top-0 print:left-0 print:z-[9999]"
      id="printable-invoice"
      style={{
        color: '#000000',
        backgroundColor: '#ffffff',
        fontSize: '12px',
        width: sheetCssWidth(design.pageSize),
        padding: '3mm',
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
      data-print-template={design.template || 'thermal'}
      data-print-size={design.pageSize}
    >
      <div className="w-full relative flex flex-col font-bold border-0 p-0 text-black">
        {/* 1. ترويسة المتجر واللوجو */}
        <div className="text-center mb-1">
          {design.logoFrontDataUrl ? (
            <div className="flex justify-center mb-1">
              <img
                src={design.logoFrontDataUrl}
                alt="Logo"
                style={{
                  width: `${design.logoSizePx || 90}px`,
                  maxHeight: `${design.logoSizePx || 90}px`,
                  objectFit: 'contain',
                }}
              />
            </div>
          ) : (
            <div className="flex justify-center my-1">
              <svg viewBox="0 0 140 140" style={{ width: '70px', height: '70px' }}>
                <circle cx="70" cy="70" r="62" fill="none" stroke="#000000" strokeWidth="4" />
                <path d="M45 55 Q70 35 95 55 Q70 75 45 55 Z" fill="#000000" />
                <circle cx="70" cy="70" r="16" fill="#000000" />
                <text x="70" y="105" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="Tahoma">
                  RETURN
                </text>
              </svg>
            </div>
          )}

          {shopName && (
            <h1
              className="text-black font-extrabold uppercase tracking-wide leading-tight"
              style={{ fontSize: '15px', fontFamily: 'Tahoma, Arial, sans-serif' }}
            >
              {shopName}
            </h1>
          )}
          {shopAddress && (
            <p className="text-black text-center mt-0.5" style={{ fontSize: '10px' }}>
              {shopAddress}
            </p>
          )}
          {shopPhone && (
            <p className="text-black text-center mt-0.5 font-mono" style={{ fontSize: '10px' }}>
              {shopPhone}
            </p>
          )}
        </div>

        {/* 2. شريط عنوان الإيصال مع التظليل */}
        <div
          className="invoice-header-shaded text-center text-black font-extrabold py-1 my-1 border-t border-b border-black"
          style={{
            backgroundColor: lightHeaderBg,
            fontSize: '13px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            letterSpacing: '0.5px',
          }}
        >
          {rtl ? '★ إيصال مرتجع مبيعات ★' : '★ SALES RETURN RECEIPT ★'}
        </div>

        {/* 3. صندوق بيانات المرتجع والفاتورة الأصلية */}
        <div
          className="border border-black my-1"
          style={{
            fontSize: '11px',
            fontFamily: 'Tahoma, Arial, sans-serif',
            lineHeight: '1.4',
          }}
        >
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-black">
            <span>{rtl ? 'رقم إيصال المرتجع:' : 'Return No:'}</span>
            <span className="font-mono font-extrabold">#RET-{record.id}</span>
          </div>

          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-black">
            <span>{rtl ? 'رقم الفاتورة الأصلية:' : 'Original Invoice:'}</span>
            <span className="font-mono font-bold">#{record.invoiceId || invoice?.id || '-'}</span>
          </div>

          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-black">
            <span>{rtl ? 'نوع المرتجع:' : 'Return Type:'}</span>
            <span className="font-bold">
              {record.type === 'full' ? (rtl ? 'مرتجع كامل' : 'Full Return') : (rtl ? 'مرتجع جزئي' : 'Partial Return')}
            </span>
          </div>

          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-black">
            <span>{rtl ? 'التاريخ والوقت:' : 'Date & Time:'}</span>
            <span className="font-mono">{recDate} {recTime ? `| ${recTime}` : ''}</span>
          </div>

          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-black">
            <span>{rtl ? 'العميل:' : 'Customer:'}</span>
            <span className="font-bold">{customerName}</span>
          </div>

          <div className="flex justify-between items-center px-1.5 py-0.5">
            <span>{rtl ? 'الكاشير:' : 'Cashier:'}</span>
            <span className="font-bold">{cashierName}</span>
          </div>
        </div>

        {/* 4. جدول الأصناف المسترجعة الحراري */}
        <div className="my-1">
          <table
            className="w-full text-black border-collapse"
            style={{
              fontSize: '11px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              border: '1px solid #000000',
            }}
          >
            <thead>
              <tr
                className="invoice-header-shaded"
                style={{
                  backgroundColor: lightHeaderBg,
                  borderBottom: '1px solid #000000',
                }}
              >
                <th
                  className="text-start py-1 px-1 font-extrabold"
                  style={{ width: '46%', borderInlineEnd: '1px solid #000000' }}
                >
                  {rtl ? 'الصنف المسترجع' : 'Returned Item'}
                </th>
                <th
                  className="text-center py-1 px-1 font-extrabold"
                  style={{ width: '16%', borderInlineEnd: '1px solid #000000' }}
                >
                  {rtl ? 'العدد' : 'Qty'}
                </th>
                <th
                  className="text-center py-1 px-1 font-extrabold"
                  style={{ width: '18%', borderInlineEnd: '1px solid #000000' }}
                >
                  {rtl ? 'السعر' : 'Price'}
                </th>
                <th className="text-end py-1 px-1 font-extrabold" style={{ width: '20%' }}>
                  {rtl ? 'المسترد' : 'Refund'}
                </th>
              </tr>
            </thead>
            <tbody>
              {(record.items || []).map((it, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: idx === (record.items.length - 1) ? 'none' : '1px dashed #777777',
                  }}
                >
                  <td className="py-1 px-1 text-start" style={{ borderInlineEnd: '1px solid #000000' }}>
                    <div className="font-bold leading-tight">{it.name}</div>
                    {(it as any).reason && (
                      <div className="text-[9px] text-slate-700 italic">
                        {rtl ? 'السبب: ' : 'Reason: '}{(it as any).reason}
                      </div>
                    )}
                  </td>
                  <td className="py-1 px-1 text-center font-mono font-bold" style={{ borderInlineEnd: '1px solid #000000' }}>
                    {it.quantity}
                  </td>
                  <td className="py-1 px-1 text-center font-mono" style={{ borderInlineEnd: '1px solid #000000' }}>
                    {fmt(it.price)}
                  </td>
                  <td className="py-1 px-1 text-end font-mono font-bold">
                    {fmt(it.refundAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. جدول الإجماليات واسترداد المبالغ */}
        <div className="my-1">
          <table
            className="w-full text-black border-collapse"
            style={{
              fontSize: '11px',
              fontFamily: 'Tahoma, Arial, sans-serif',
              border: '1px solid #000000',
            }}
          >
            <tbody>
              {/* إجمالي المسترد البارز */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td
                  className="invoice-header-shaded px-2 py-1 text-start font-extrabold"
                  style={{
                    backgroundColor: lightHeaderBg,
                    width: '50%',
                    borderInlineEnd: '1px solid #000000',
                    fontSize: '12px',
                  }}
                >
                  {rtl ? 'إجمالي المبلغ المسترد:' : 'Total Refund:'}
                </td>
                <td className="px-2 py-1 text-end font-mono font-extrabold text-[13px]">
                  {fmt(record.refundAmount)} {rtl ? 'ج.م' : 'EGP'}
                </td>
              </tr>

              {/* تفاصيل طرق الرد (نقدي / بنكي / محفظة) */}
              {(record.refundParts && record.refundParts.length > 0) ? (
                record.refundParts.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px dashed #999999' }}>
                    <td className="px-2 py-0.5 text-start" style={{ borderInlineEnd: '1px solid #000000' }}>
                      {rtl ? 'المسترد عبر ' : 'Refunded via '}{t(p.method)}:
                    </td>
                    <td className="px-2 py-0.5 text-end font-mono font-bold">
                      {fmt(p.amount)} {rtl ? 'ج.م' : 'EGP'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: '1px dashed #999999' }}>
                  <td className="px-2 py-0.5 text-start" style={{ borderInlineEnd: '1px solid #000000' }}>
                    {rtl ? 'المسترد نقداً من الدرج:' : 'Cash Refunded:'}
                  </td>
                  <td className="px-2 py-0.5 text-end font-mono font-bold">
                    {fmt(record.cashRefund || record.refundAmount)} {rtl ? 'ج.م' : 'EGP'}
                  </td>
                </tr>
              )}

              {/* النقاط المعكوسة إن وُجدت */}
              {Boolean(record.pointsReversed) && (
                <tr style={{ borderBottom: '1px dashed #999999' }}>
                  <td className="px-2 py-0.5 text-start" style={{ borderInlineEnd: '1px solid #000000' }}>
                    {rtl ? 'نقاط الولاء المعكوسة:' : 'Reversed Points:'}
                  </td>
                  <td className="px-2 py-0.5 text-end font-mono">
                    -{record.pointsReversed} {rtl ? 'نقطة' : 'pts'}
                  </td>
                </tr>
              )}

              {/* عمولة الموظف المعكوسة إن وُجدت */}
              {Boolean(record.commissionReversed) && (
                <tr style={{ borderBottom: '1px dashed #999999' }}>
                  <td className="px-2 py-0.5 text-start" style={{ borderInlineEnd: '1px solid #000000' }}>
                    {rtl ? 'عمولة الموظف المعكوسة:' : 'Reversed Commission:'}
                  </td>
                  <td className="px-2 py-0.5 text-end font-mono">
                    -{fmt(record.commissionReversed)} {rtl ? 'ج.م' : 'EGP'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 6. سبب المرتجع العام إن وُجد */}
        {record.reason && (
          <div
            className="border border-black p-1.5 my-1"
            style={{ fontSize: '10.5px', fontFamily: 'Tahoma, Arial, sans-serif' }}
          >
            <span className="font-bold underline">{rtl ? 'سبب المرتجع العام:' : 'Return Reason:'}</span>{' '}
            <span>{record.reason}</span>
          </div>
        )}

        {/* 7. باركود المرتجع والتأكيد الأمني */}
        <div className="text-center my-1.5">
          <div className="inline-block p-1 border border-black bg-white">
            <svg
              className="mx-auto"
              style={{ width: '130px', height: '32px' }}
              viewBox="0 0 130 32"
            >
              {/* خطوط باركود واقعية للتأكيد */}
              <rect x="5" y="2" width="2" height="22" fill="#000" />
              <rect x="9" y="2" width="4" height="22" fill="#000" />
              <rect x="15" y="2" width="1" height="22" fill="#000" />
              <rect x="18" y="2" width="3" height="22" fill="#000" />
              <rect x="23" y="2" width="2" height="22" fill="#000" />
              <rect x="28" y="2" width="5" height="22" fill="#000" />
              <rect x="35" y="2" width="2" height="22" fill="#000" />
              <rect x="40" y="2" width="3" height="22" fill="#000" />
              <rect x="45" y="2" width="1" height="22" fill="#000" />
              <rect x="48" y="2" width="4" height="22" fill="#000" />
              <rect x="54" y="2" width="2" height="22" fill="#000" />
              <rect x="58" y="2" width="3" height="22" fill="#000" />
              <rect x="63" y="2" width="1" height="22" fill="#000" />
              <rect x="66" y="2" width="5" height="22" fill="#000" />
              <rect x="73" y="2" width="2" height="22" fill="#000" />
              <rect x="77" y="2" width="3" height="22" fill="#000" />
              <rect x="82" y="2" width="2" height="22" fill="#000" />
              <rect x="86" y="2" width="4" height="22" fill="#000" />
              <rect x="92" y="2" width="1" height="22" fill="#000" />
              <rect x="95" y="2" width="3" height="22" fill="#000" />
              <rect x="100" y="2" width="5" height="22" fill="#000" />
              <rect x="107" y="2" width="2" height="22" fill="#000" />
              <rect x="111" y="2" width="3" height="22" fill="#000" />
              <rect x="116" y="2" width="2" height="22" fill="#000" />
              <rect x="120" y="2" width="4" height="22" fill="#000" />
              <text x="65" y="30" textAnchor="middle" fontSize="7" fontFamily="monospace" fontWeight="bold">
                *RET-{record.id}*
              </text>
            </svg>
          </div>
        </div>

        {/* 8. تذييل الإيصال */}
        <div className="text-center mt-1 pt-1 border-t border-dashed border-black">
          <p className="text-[10px] text-black">
            {rtl ? 'تم استرجاع الأصناف وإعادتها للمخزون بنجاح' : 'Items returned & restocked successfully'}
          </p>
          <p className="text-[11px] font-extrabold text-black mt-0.5">
            {rtl ? 'نسعد دائماً بخدمتكم' : 'Thank you for your business'}
          </p>
          <p className="text-[8px] text-slate-600 font-mono mt-0.5">
            RaiZon Pro POS System
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReturnReceipt;

export const openReturnWhatsApp = (
  record: ReturnRecord,
  targetPhone: string = '',
  shopInfo?: { shopName?: string; phone?: string; address?: string }
) => {
  const shopTitle = shopInfo?.shopName ? ` - ${shopInfo.shopName}` : '';
  const dateStr = record.date || new Date().toISOString().slice(0, 10);
  const itemsText = (record.items || [])
    .map(it => `• ${it.name} × ${it.quantity} = ${it.refundAmount.toLocaleString('en-US')} ج.م`)
    .join('\n');

  const text = `*إيصال مرتجع مبيعات${shopTitle}*
━━━━━━━━━━━━━━━━━━
*رقم المرتجع:* #RET-${record.id}
*رقم الفاتورة الأصلية:* #${record.invoiceId}
*التاريخ:* ${dateStr}
*العميل:* ${record.customerName || 'عميل نقدي'}
*نوع المرتجع:* ${record.type === 'full' ? 'مرتجع كامل' : 'مرتجع جزئي'}
━━━━━━━━━━━━━━━━━━
*الأصناف المسترجعة:*
${itemsText}
━━━━━━━━━━━━━━━━━━
*إجمالي المبلغ المسترد:* ${record.refundAmount.toLocaleString('en-US')} ج.م
${record.reason ? `*السبب:* ${record.reason}\n` : ''}
تم استرجاع وإعادة الأصناف للمخزون بنجاح.
نسعد دائماً بخدمتكم.`;

  let cleanPhone = (targetPhone || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    cleanPhone = '2' + cleanPhone;
  }
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
};

