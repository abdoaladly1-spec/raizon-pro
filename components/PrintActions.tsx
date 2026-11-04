// أزرار الطباعة الموحدة (طباعة + حفظ PDF + مشاركة واتساب)
import React from 'react';
import { useApp } from '../context/AppContext';
import { Printer, FileText } from '../components/Icons';
import { Button } from '../components/ui';
import type { Invoice } from '../types';
import { normalizePrintDesign, resolvePrintDesign, printAuditInfo } from '../lib/printDesign';
import { printReceipt, saveReceiptPdf } from '../lib/printBridge';

export interface ShopContactInfo {
  shopName?: string;
  phone?: string;
  address?: string;
}

export const buildInvoiceWhatsAppMessage = (
  invoice: Invoice, 
  shopInfo?: string | ShopContactInfo
): string => {
  const shop: ShopContactInfo = typeof shopInfo === 'string'
    ? { shopName: shopInfo }
    : (shopInfo || {});

  const shopTitle = shop.shopName ? ` - ${shop.shopName}` : '';

  // 1. التاريخ والوقت
  const d = invoice.timestamp
    ? new Date(invoice.timestamp)
    : (invoice.date ? new Date(invoice.date) : new Date());

  const dateStr = (invoice.date && /^\d{4}-\d{2}-\d{2}/.test(invoice.date))
    ? invoice.date.split('T')[0]
    : (!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

  const timeStr = !isNaN(d.getTime())
    ? d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

  // 2. قائمة الأصناف
  const itemsText = (invoice.items || [])
    .map(i => `• ${i.name} × ${i.quantity} = ${(i.price * i.quantity).toLocaleString('en-US')} ج.م`)
    .join('\n');

  // 3. طريقة الدفع
  let paymentText = 'نقداً (كاش)';
  if (invoice.paymentParts && invoice.paymentParts.length > 1) {
    const partsDesc = invoice.paymentParts.map(p => {
      const name = p.method === 'cash' ? 'كاش' : p.method === 'card' ? 'فيزا' : p.method === 'wallet' ? 'محفظة' : p.method;
      return `${name}: ${p.amount.toLocaleString('en-US')} ج.م`;
    }).join(' + ');
    paymentText = `دفع مجزأ (${partsDesc})`;
  } else if (invoice.paymentMethod === 'card' || invoice.paymentMethod === 'visa') {
    paymentText = 'بطاقة بنكية (فيزا / ماستركارد)';
  } else if (invoice.paymentMethod === 'credit') {
    paymentText = 'على الحساب (آجل)';
  } else if (invoice.paymentMethod === 'wallet') {
    paymentText = 'محفظة إلكترونية';
  } else if (invoice.paymentMethod === 'loyalty') {
    paymentText = 'نقاط ولاء';
  } else if (invoice.paymentMethod === 'split' || invoice.paymentMethod === 'mixed') {
    paymentText = 'دفع مركب';
  }

  // 4. الحسابات والملاحظات
  const discountAmount = invoice.discountPercent && invoice.subtotal
    ? ((invoice.subtotal * invoice.discountPercent) / 100)
    : 0;

  const discountLine = discountAmount > 0
    ? `🏷️ *الخصم:* -${discountAmount.toLocaleString('en-US')} ج.م (${invoice.discountPercent}%)\n`
    : '';

  const receivedLine = (invoice.received !== undefined && invoice.received > (invoice.total || 0))
    ? `💵 *المدفوع:* ${invoice.received.toLocaleString('en-US')} ج.م\n`
    : '';

  const changeLine = (invoice.change !== undefined && invoice.change > 0)
    ? `🪙 *المتبقي (الفكة):* ${invoice.change.toLocaleString('en-US')} ج.م\n`
    : '';

  const staffLine = invoice.staffName
    ? `👨‍💼 *الموظف:* ${invoice.staffName}\n`
    : '';

  const notesLine = invoice.notes
    ? `📝 *ملاحظات:* ${invoice.notes}\n`
    : '';

  const addressLine = shop.address ? `\n📍 *العنوان:* ${shop.address}` : '';
  const phoneLine = shop.phone ? `\n📞 *للتواصل:* ${shop.phone}` : '';

  return `🧾 *فاتورة إلكترونية${shopTitle}*
━━━━━━━━━━━━━━━━━━
🔹 *رقم الفاتورة:* #${invoice.id}
📅 *التاريخ:* ${dateStr}
⏰ *الوقت:* ${timeStr}
👤 *العميل:* ${invoice.customerName || 'عميل نقدي'}
${staffLine}━━━━━━━━━━━━━━━━━━
📦 *الأصناف:*
${itemsText}
━━━━━━━━━━━━━━━━━━
${discountLine}💰 *المجموع:* ${(invoice.total || 0).toLocaleString('en-US')} ج.م
💳 *طريقة الدفع:* ${paymentText}
${receivedLine}${changeLine}${notesLine}
شكراً لثقتكم بنا، ونسعد دائماً بخدمتكم! ✨${addressLine}${phoneLine}`;
};

export const openInvoiceWhatsApp = (
  invoice: Invoice, 
  targetPhone: string = '', 
  shopInfo?: string | ShopContactInfo
) => {
  const text = buildInvoiceWhatsAppMessage(invoice, shopInfo);
  let cleanPhone = (targetPhone || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    cleanPhone = '2' + cleanPhone; // Egypt country code
  }
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  window.open(url, '_blank');
};

export const PrintActions = ({ invoice }: { invoice: Invoice }) => {
  const { state, t, addToast, addAuditLog, language } = useApp();
  const design = resolvePrintDesign(invoice, normalizePrintDesign(state.settings.printDesign));
  const printerName = state.settings.printerName || 'Default';

  const handlePrint = async () => {
    const res = await printReceipt(design, printerName);
    if (res.success) {
      const info = printAuditInfo('print', invoice.id);
      addAuditLog(info.action, info.details);
    } else {
      addToast(`${t('print_failed')}${res.errorReason ? `: ${res.errorReason}` : ''}`, 'error');
    }
  };

  const handlePdf = async () => {
    const res = await saveReceiptPdf();
    if (res.ok && res.filePath) {
      const info = printAuditInfo('pdf', invoice.id);
      addAuditLog(info.action, info.details);
      addToast(`${t('pdf_saved')}: ${res.filePath}`, 'success');
      return;
    }
    if (res.canceled) return;
    if (res.fallback) {
      const info = printAuditInfo('pdf', invoice.id);
      addAuditLog(info.action, info.details);
      window.print();
      return;
    }
    addToast(`${t('pdf_failed')}${res.error ? `: ${res.error}` : ''}`, 'error');
  };

  const handleWhatsApp = () => {
    const customer = (state.customers || []).find(c => c.id === invoice.customerId);
    let phone = customer?.phone || '';
    if (!phone) {
      const input = window.prompt(
        language === 'ar' ? 'أدخل رقم واتساب العميل (أو اتركه فارغاً لفتح قائمة المحادثات):' : 'Enter WhatsApp phone:'
      );
      if (input !== null) {
        phone = input.trim();
      }
    }
    openInvoiceWhatsApp(invoice, phone, {
      shopName: state.settings.shopName,
      phone: state.settings.phone,
      address: state.settings.address
    });
    addAuditLog('WhatsApp', `Shared invoice #${invoice.id} via WhatsApp`);
    addToast(language === 'ar' ? 'جاري فتح واتساب لمشاركة الفاتورة...' : 'Opening WhatsApp...', 'success');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={handlePrint} variant="primary" className="text-xs">
        <Printer size={16} className="mr-1.5" /> {t('save_print')}
      </Button>
      <Button onClick={handlePdf} variant="secondary" className="text-xs">
        <FileText size={16} className="mr-1.5" /> {t('save_pdf')}
      </Button>
      <Button
        onClick={handleWhatsApp}
        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
      >
        <span>💬</span>
        <span>{language === 'ar' ? 'مشاركة واتساب' : 'WhatsApp'}</span>
      </Button>
    </div>
  );
};

export default PrintActions;
