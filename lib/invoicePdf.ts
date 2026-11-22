// محرك توليد فواتير PDF عالية الدقة ومشاركتها عبر واتساب كملف PDF
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Invoice } from '../types';

export interface ShopContactInfo {
  shopName?: string;
  phone?: string;
  address?: string;
  branchName?: string;
}

/** توليد QR Code للفاتورة كـ Data URL */
const generateInvoiceQr = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 140,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (e) {
    return '';
  }
};

/**
 * توليد ملف الفاتورة بصيغة PDF عالية الدقة (HTML5 Canvas -> jsPDF)
 * يدعم اللغة العربية بنسبة 100% وبخطوط واضحة وتنسيق إيصال حراري فاخر
 */
export const generateInvoicePdfBlob = async (
  invoice: Invoice,
  shopInfo?: string | ShopContactInfo,
  pageSize: 'thermal' | 'a4' = 'thermal'
): Promise<{ blob: Blob; fileName: string; dataUrl: string }> => {
  const shop: ShopContactInfo = typeof shopInfo === 'string'
    ? { shopName: shopInfo }
    : (shopInfo || {});

  const shopTitle = shop.shopName || 'فاتورة إلكترونية';
  const branchTitle = shop.branchName || invoice.branchName || 'الفرع الرئيسي';

  // إعدادات الكانفاس بدقة فائقة 2x Retina
  const scale = 2;
  const canvasWidth = 750 * scale; // عرض الكانفاس (يعادل 80mm حراري عالي الدقة)
  
  // حساب الارتفاع المطلوب ديناميكياً بحسب عدد الأصناف
  const itemsCount = (invoice.items || []).length;
  const baseHeight = 900;
  const itemRowHeight = 55;
  const canvasHeight = (baseHeight + (itemsCount * itemRowHeight)) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }

  // تفعيل أفضل إعدادات التنعيم للخطوط العربية
  ctx.scale(scale, scale);
  const w = canvasWidth / scale;
  
  // خلفية بيضاء نقية
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, canvasHeight / scale);

  // إطار خارجي رمادي أنيق
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, w - 20, (canvasHeight / scale) - 20);

  let y = 35;

  // 1. رأس الفاتورة (Header)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shopTitle, w / 2, y);
  y += 26;

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`فاتورة إلكترونية مبسطة · ${branchTitle}`, w / 2, y);
  y += 20;

  if (shop.phone || shop.address) {
    const contactText = [shop.phone ? `هاتف: ${shop.phone}` : '', shop.address].filter(Boolean).join(' · ');
    ctx.font = 'normal 11px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(contactText, w / 2, y);
    y += 18;
  }

  // خط فاصل مزدوج
  y += 6;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(25, y);
  ctx.lineTo(w - 25, y);
  ctx.stroke();

  y += 22;

  // 2. بيانات الفاتورة الأساسية (Invoice Meta)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';

  // رقم الفاتورة والتاريخ
  ctx.fillText(`رقم الفاتورة: #${invoice.id}`, w - 30, y);
  const d = invoice.timestamp ? new Date(invoice.timestamp) : (invoice.date ? new Date(invoice.date) : new Date());
  const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('ar-EG') : (invoice.date || '');
  const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

  ctx.textAlign = 'left';
  ctx.fillText(`${dateStr} | ${timeStr}`, 30, y);
  y += 22;

  // العميل والكاشير
  ctx.textAlign = 'right';
  ctx.font = 'normal 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  const customerName = invoice.customerName || 'عميل نقدي';
  ctx.fillText(`العميل: ${customerName}`, w - 30, y);

  if (invoice.staffName) {
    ctx.textAlign = 'left';
    ctx.fillText(`الكاشير: ${invoice.staffName}`, 30, y);
  }
  y += 24;

  // 3. جدول الأصناف (Items Table)
  // رأس الجدول
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(25, y, w - 50, 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('الصنف / الخدمة', w - 40, y + 21);

  ctx.textAlign = 'center';
  ctx.fillText('الكمية', w / 2 + 30, y + 21);
  ctx.fillText('السعر', w / 2 - 40, y + 21);

  ctx.textAlign = 'left';
  ctx.fillText('الإجمالي', 40, y + 21);
  y += 40;

  // صفوف الأصناف
  ctx.fillStyle = '#0f172a';
  const items = invoice.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemTotal = (item.price * item.quantity).toLocaleString('en-US');
    const isEven = i % 2 === 0;

    // خلفية متبادلة خفيفة
    if (isEven) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(25, y - 16, w - 50, 30);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.textAlign = 'right';
    
    // اقتطاع الاسم إذا كان طويلاً جداً
    const name = item.name.length > 32 ? item.name.substring(0, 30) + '..' : item.name;
    ctx.fillText(name, w - 40, y + 4);

    ctx.font = 'bold 11px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(item.quantity), w / 2 + 30, y + 4);
    ctx.fillText(`${item.price.toLocaleString('en-US')}`, w / 2 - 40, y + 4);

    ctx.textAlign = 'left';
    ctx.fillText(`${itemTotal} ج.م`, 40, y + 4);

    y += 32;
  }

  // خط منقط أسفل الأصناف
  y += 5;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(25, y);
  ctx.lineTo(w - 25, y);
  ctx.stroke();
  ctx.setLineDash([]); // إعادة الخط لمتصل

  y += 24;

  // 4. الملخص المالي (Totals)
  ctx.textAlign = 'right';
  ctx.font = 'normal 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#475569';

  // المجموع الفرعي
  if (invoice.discountAmount || invoice.discountPercent) {
    ctx.fillText('المجموع الفرعي:', w - 30, y);
    ctx.textAlign = 'left';
    ctx.fillText(`${(invoice.subtotal || invoice.total || 0).toLocaleString('en-US')} ج.م`, 30, y);
    y += 20;

    const discountAmount = invoice.discountAmount !== undefined
      ? Number(invoice.discountAmount)
      : (invoice.discountPercent && invoice.subtotal ? ((invoice.subtotal * invoice.discountPercent) / 100) : 0);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dc2626';
    ctx.fillText(`الخصم (${invoice.discountPercent || 0}%):`, w - 30, y);
    ctx.textAlign = 'left';
    ctx.fillText(`-${discountAmount.toLocaleString('en-US')} ج.م`, 30, y);
    y += 22;
  }

  // صندوق الإجمالي النهائي الفاخر
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(25, y, w - 50, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('الإجمالي المستحق:', w - 40, y + 30);

  ctx.textAlign = 'left';
  ctx.font = 'black 19px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`${(invoice.total || 0).toLocaleString('en-US')} ج.م`, 40, y + 31);
  y += 64;

  // طريقة الدفع
  let paymentText = 'نقدي (كاش)';
  if (invoice.paymentMethod === 'card' || invoice.paymentMethod === 'visa') paymentText = 'بطاقة بنكية / فيزا';
  else if (invoice.paymentMethod === 'credit') paymentText = 'على الحساب (آجل)';
  else if (invoice.paymentMethod === 'wallet') paymentText = 'محفظة إلكترونية';
  else if (invoice.paymentMethod === 'split') paymentText = 'دفع مركب / مجزأ';

  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText(`طريقة الدفع: ${paymentText}`, w - 30, y);

  if (invoice.received && invoice.received > (invoice.total || 0)) {
    ctx.textAlign = 'left';
    ctx.fillText(`المدفوع: ${invoice.received.toLocaleString('en-US')} ج.م`, 30, y);
    y += 18;
    if (invoice.change && invoice.change > 0) {
      ctx.textAlign = 'left';
      ctx.fillText(`المتبقي: ${invoice.change.toLocaleString('en-US')} ج.م`, 30, y);
    }
  }
  y += 24;

  // ملاحظات الفاتورة إن وُجدت
  if (invoice.notes) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(`ملاحظات: ${invoice.notes}`, w - 30, y);
    y += 20;
  }

  // 5. التذييل ورمز الـ QR (Footer & QR Code)
  y += 10;
  const qrDataText = `Invoice: #${invoice.id} | Shop: ${shopTitle} | Total: ${invoice.total} EGP | Date: ${dateStr}`;
  const qrDataUrl = await generateInvoiceQr(qrDataText);

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
      qrImg.onerror = resolve;
    });
    ctx.drawImage(qrImg, (w - 90) / 2, y, 90, 90);
    y += 102;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('شكراً لزيارتكم، نسعد دائماً بخدمتكم!', w / 2, y);
  y += 18;

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'normal 10px "Cairo", "Segoe UI", Tahoma, Arial, sans-serif';
  ctx.fillText('منظومة الفواتير الإلكترونية المعتمدة · فلير وان (Flare One)', w / 2, y);

  // 6. تحويل الكانفاس إلى مستند PDF متناسق
  const imgData = canvas.toDataURL('image/png', 0.98);
  const pdfWidthMm = pageSize === 'a4' ? 210 : 80;
  const pdfHeightMm = (canvasHeight / scale) * (pdfWidthMm / w);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidthMm, Math.max(120, pdfHeightMm)]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);

  const blob = pdf.output('blob');
  const fileName = `فاتورة_رقم_${invoice.id}.pdf`;

  return { blob, fileName, dataUrl: imgData };
};

/**
 * تنزيل ملف الفاتورة PDF إلى جهاز المستخدم مباشرة
 */
export const downloadInvoicePdf = async (
  invoice: Invoice,
  shopInfo?: string | ShopContactInfo
): Promise<string> => {
  const { blob, fileName } = await generateInvoicePdfBlob(invoice, shopInfo);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return fileName;
};

/**
 * إرسال ومشاركة الفاتورة كملف PDF على الواتساب
 * - في الهواتف والأجهزة الداعمة: يتم إرسال ملف الـ PDF مباشرة عبر مشاركة النظام Web Share.
 * - في المتصفح والكمبيوتر: يتم تنزيل ملف الـ PDF فوراً وفتح محادثة الواتساب مع رسالة الترحيب جاهزة لإرفاق الـ PDF.
 */
export const sendInvoicePdfToWhatsApp = async (
  invoice: Invoice,
  targetPhone: string = '',
  shopInfo?: string | ShopContactInfo
): Promise<{ ok: boolean; sharedVia: 'native_share' | 'whatsapp_web'; fileName: string }> => {
  const shop: ShopContactInfo = typeof shopInfo === 'string'
    ? { shopName: shopInfo }
    : (shopInfo || {});

  const { blob, fileName } = await generateInvoicePdfBlob(invoice, shop);

  // 1. تنظيف وتجهيز رقم الهاتف
  let cleanPhone = (targetPhone || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
    cleanPhone = '2' + cleanPhone; // كود مصر
  }

  // 2. تجهيز ملف PDF حقيقي للمشاركة
  const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

  // 3. المحاولة عبر Web Share API (ترسل الملف الفعلي للواتساب مباشرة)
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `فاتورة إلكترونية #${invoice.id}`,
        text: `مرحباً بك، مرفق فاتورتكم الإلكترونية (PDF) رقم #${invoice.id} بقيمة ${invoice.total} ج.م من ${shop.shopName || 'متجرنا'}.`
      });
      return { ok: true, sharedVia: 'native_share', fileName };
    } catch (e: any) {
      // إذا ألغى المستخدم أو فشل، نكمل بالمسار السحابي/الويب
      if (e?.name === 'AbortError') {
        return { ok: false, sharedVia: 'native_share', fileName };
      }
    }
  }

  // 4. في الكمبيوتر / المتصفحات العادية:
  // أ) تنزيل ملف الفاتورة PDF تلقائياً على جهاز المستخدم ليكون جاهزاً للإرفاق
  const fileUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = fileUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  setTimeout(() => URL.revokeObjectURL(fileUrl), 10000);

  // ب) فتح شات الواتساب مع العميل
  const shopTitle = shop.shopName ? `من ${shop.shopName}` : '';
  const message = `مرحباً بك 🌹
مرفق فاتورتكم الإلكترونية الرسمية (PDF) رقم #${invoice.id} ${shopTitle}.
━━━━━━━━━━━━━━━━━━
• إجمالي الفاتورة: ${(invoice.total || 0).toLocaleString('en-US')} ج.م
• التاريخ: ${invoice.date || new Date().toLocaleDateString('ar-EG')}
━━━━━━━━━━━━━━━━━━
📄 تم حفظ نسخة الـ PDF الرسمية؛ نسعد دائماً بخدمتكم!`;

  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  window.open(waUrl, '_blank');

  return { ok: true, sharedVia: 'whatsapp_web', fileName };
};
