// أزرار الطباعة الموحدة (طباعة + حفظ PDF + مشاركة واتساب مع حماية تداخل فروع النظام)
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Printer, FileText, WhatsAppIcon, AlertCircle, Lock, Shield, Eye, EyeOff } from '../components/Icons';
import { Button, ModalShell } from '../components/ui';
import type { Invoice } from '../types';
import { normalizePrintDesign, resolvePrintDesign, printAuditInfo } from '../lib/printDesign';
import { printReceipt, saveReceiptPdf } from '../lib/printBridge';
import { isMainBranch, getMainBranch, getActiveBranch, verifyAdminPassword } from '../lib/branchUtils';

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
    ? `*الخصم:* -${discountAmount.toLocaleString('en-US')} ج.م (${invoice.discountPercent}%)\n`
    : '';

  const receivedLine = (invoice.received !== undefined && invoice.received > (invoice.total || 0))
    ? `*المدفوع:* ${invoice.received.toLocaleString('en-US')} ج.م\n`
    : '';

  const changeLine = (invoice.change !== undefined && invoice.change > 0)
    ? `*المتبقي:* ${invoice.change.toLocaleString('en-US')} ج.م\n`
    : '';

  const staffLine = invoice.staffName
    ? `*الموظف:* ${invoice.staffName}\n`
    : '';

  const notesLine = invoice.notes
    ? `*ملاحظات:* ${invoice.notes}\n`
    : '';

  const addressLine = shop.address ? `\n*العنوان:* ${shop.address}` : '';
  const phoneLine = shop.phone ? `\n*للتواصل:* ${shop.phone}` : '';

  return `*فاتورة إلكترونية${shopTitle}*
━━━━━━━━━━━━━━━━━━
*رقم الفاتورة:* #${invoice.id}
*التاريخ:* ${dateStr}
*الوقت:* ${timeStr}
*العميل:* ${invoice.customerName || 'عميل نقدي'}
${staffLine}━━━━━━━━━━━━━━━━━━
*الأصناف:*
${itemsText}
━━━━━━━━━━━━━━━━━━
${discountLine}*المجموع:* ${(invoice.total || 0).toLocaleString('en-US')} ج.م
*طريقة الدفع:* ${paymentText}
${receivedLine}${changeLine}${notesLine}
شكراً لزيارتكم، نسعد دائماً بخدمتكم.${addressLine}${phoneLine}`;
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

  // حالة نافذة التحذير عند محاولة الطباعة من فرع غير رئيسي
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'print' | 'pdf' | null>(null);
  const [step, setStep] = useState<'warning' | 'password'>('warning');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // التحقق من كون الفرع الحالي هو الرئيسي
  const isMain = isMainBranch(state.settings.currentLocationId, state.locations);
  const mainBranch = getMainBranch(state.locations);
  const activeBranch = getActiveBranch(state.settings.currentLocationId, state.locations);

  const executePrint = async () => {
    const res = await printReceipt(design, printerName);
    if (res.success) {
      const info = printAuditInfo('print', invoice.id);
      addAuditLog(info.action, info.details);
    } else {
      addToast(`${t('print_failed')}${res.errorReason ? `: ${res.errorReason}` : ''}`, 'error');
    }
  };

  const executePdf = async () => {
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

  const handlePrint = async () => {
    if (isMain) {
      await executePrint();
    } else {
      setPendingAction('print');
      setStep('warning');
      setPassword('');
      setPasswordError('');
      setShowWarningModal(true);
    }
  };

  const handlePdf = async () => {
    if (isMain) {
      await executePdf();
    } else {
      setPendingAction('pdf');
      setStep('warning');
      setPassword('');
      setPasswordError('');
      setShowWarningModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowWarningModal(false);
    setStep('warning');
    setPassword('');
    setPasswordError('');
    setPendingAction(null);
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError(language === 'ar' ? 'يرجى إدخال كلمة مرور المدير' : 'Please enter manager password');
      return;
    }
    setIsVerifying(true);
    try {
      const isValid = await verifyAdminPassword(password, state.users);
      if (!isValid) {
        setPasswordError(language === 'ar' ? 'كلمة مرور المدير غير صحيحة!' : 'Incorrect manager password!');
        setIsVerifying(false);
        return;
      }

      setShowWarningModal(false);
      setPassword('');
      setPasswordError('');
      addToast(
        language === 'ar' 
          ? 'تم التحقق من صلاحية المدير بنجاح، جاري إرسال الفاتورة للطباعة' 
          : 'Manager authorization confirmed. Printing...', 
        'success'
      );

      addAuditLog(
        'Print Override',
        `Manager authorized print for invoice #${invoice.id} on non-main branch ${activeBranch?.name || 'unknown'}`,
        `موافقة المدير بكلمة المرور على طباعة فاتورة #${invoice.id} من فرع غير رئيسي (${activeBranch?.name || 'غير محدد'})`
      );

      if (pendingAction === 'pdf') {
        await executePdf();
      } else {
        await executePrint();
      }
    } catch {
      setPasswordError(language === 'ar' ? 'حدث خطأ أثناء فحص كلمة المرور' : 'Password verification error');
    } finally {
      setIsVerifying(false);
    }
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
    addAuditLog(
      'WhatsApp',
      `Shared invoice #${invoice.id} via WhatsApp`,
      `مشاركة إيصال الفاتورة رقم #${invoice.id} عبر واتساب${phone ? ` مع العميل (${phone})` : ''}`
    );
    addToast(language === 'ar' ? 'جاري فتح واتساب لمشاركة الفاتورة...' : 'Opening WhatsApp...', 'success');
  };

  return (
    <>
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
          <WhatsAppIcon size={16} />
          <span>{language === 'ar' ? 'مشاركة واتساب' : 'WhatsApp'}</span>
        </Button>
      </div>

      {/* نافذة التحذير ومصادقة المدير للطباعة من فرع غير رئيسي */}
      {showWarningModal && (
        <ModalShell
          title={
            step === 'warning'
              ? (language === 'ar' ? 'تحذير: فرع غير رئيسي' : 'Warning: Not Main Branch')
              : (language === 'ar' ? 'تأكيد كلمة مرور المدير' : 'Manager Password Confirmation')
          }
          onClose={handleCloseModal}
          maxWidth="max-w-md"
        >
          {step === 'warning' ? (
            <div className="space-y-4 py-1">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={26} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-black text-sm md:text-base leading-snug text-amber-900 dark:text-amber-200">
                      {language === 'ar'
                        ? 'هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير'
                        : 'This is not the main branch. Please be careful to avoid invoice conflicts.'}
                    </p>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 space-y-1 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20">
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الفرع النشط حالياً:' : 'Active Branch:'}</span>
                        <strong className="text-amber-800 dark:text-amber-300">{activeBranch?.name || state.settings.shopName}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الفرع الرئيسي:' : 'Main Branch:'}</span>
                        <strong className="text-slate-800 dark:text-slate-200">{mainBranch?.name || 'الفرع الرئيسي'}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">#{invoice.id}</strong>
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed border-t border-amber-500/20 pt-2 font-medium">
                  {language === 'ar'
                    ? 'تنبيه أمني: لحماية ترقيم وتسلسل الفواتير من التكرار أو التضارب، تتطلب الطباعة من الفروع الثانوية تأكيداً مسؤولاً بكلمة مرور المدير.'
                    : 'Security notice: To protect invoice sequencing from conflicts, printing from secondary branches requires manager confirmation.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  onClick={() => setStep('password')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm px-4 py-2"
                >
                  <Shield size={15} />
                  <span>{language === 'ar' ? 'طباعة وعلي مسؤوليتي' : 'Print Under My Responsibility'}</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  className="text-xs px-3.5 py-2 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuthorize} className="space-y-4 py-1">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Lock size={14} className="text-amber-500" />
                  {language === 'ar' ? 'مصادقة المدير للطباعة' : 'Manager Authorization Required'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'ar'
                    ? `لإتمام الطباعة على مسؤوليتك في فرع «${activeBranch?.name}»، يرجى إدخال كلمة مرور المدير:`
                    : `Enter manager password to authorize printing on branch "${activeBranch?.name}":`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'ar' ? 'كلمة مرور المدير *' : 'Manager Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    placeholder={language === 'ar' ? 'أدخل كلمة مرور المدير...' : 'Enter manager password...'}
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-rose-500 dark:text-rose-400 font-bold mt-2 flex items-center gap-1 animate-fade-in">
                    <AlertCircle size={14} /> {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="submit"
                  disabled={isVerifying}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={15} />
                  <span>{isVerifying ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...') : (language === 'ar' ? 'تأكيد والطباعة الآن' : 'Confirm & Print')}</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setStep('warning'); setPasswordError(''); }}
                  className="text-xs"
                >
                  {language === 'ar' ? 'رجوع' : 'Back'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  className="text-xs"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </form>
          )}
        </ModalShell>
      )}
    </>
  );
};

export default PrintActions;
