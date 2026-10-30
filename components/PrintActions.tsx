// أزرار الطباعة الموحدة (طباعة + حفظ PDF) — تُستخدم في معاينة الفاتورة
// وإعادة الطباعة من قائمة الفواتير، مع سطر تدقيق لكل عملية.

import React from 'react';
import { useApp } from '../context/AppContext';
import { Printer, FileText } from '../components/Icons';
import { Button } from '../components/ui';
import type { Invoice } from '../types';
import { normalizePrintDesign, resolvePrintDesign, printAuditInfo } from '../lib/printDesign';
import { printReceipt, saveReceiptPdf } from '../lib/printBridge';

export const PrintActions = ({ invoice }: { invoice: Invoice }) => {
  const { state, t, addToast, addAuditLog } = useApp();
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
      // متصفح عادي: نافذة الطباعة = حفظ كـ PDF (نص حقيقي قابل للبحث)
      const info = printAuditInfo('pdf', invoice.id);
      addAuditLog(info.action, info.details);
      window.print();
      return;
    }
    addToast(`${t('pdf_failed')}${res.error ? `: ${res.error}` : ''}`, 'error');
  };

  return (
    <>
      <Button onClick={handlePrint} variant="primary">
        <Printer size={18} className="mr-2" /> {t('save_print')}
      </Button>
      <Button onClick={handlePdf} variant="secondary">
        <FileText size={18} className="mr-2" /> {t('save_pdf')}
      </Button>
    </>
  );
};

export default PrintActions;
