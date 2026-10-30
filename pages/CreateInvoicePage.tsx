/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';
import { localIsoToday, parseInvoiceDate } from '../lib/dates';
import { round2, validatePayment, paymentOf, type PaymentPart } from '../lib/payments';
import { buildPrintIdentity } from '../lib/printDesign';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { PrintActions } from '../components/PrintActions';

export const CreateInvoice = ({ onClose }: any) => {
  const { state, addInvoice, holdInvoice, restoreInvoice, deleteHeldInvoice, t, addToast, addCustomer, updateSettings, language, addItem, formatNumber, formatDate, formatTime, formatDateTime } = useApp();
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [showHeldInvoices, setShowHeldInvoices] = useState(false);

  // Quick Add Service State
  const [isQuickAddingService, setIsQuickAddingService] = useState(false);
  const [quickServiceForm, setQuickServiceForm] = useState({ nameAr: '', nameEn: '', price: '' });

  const handleQuickAddService = (e: any) => {
    e.preventDefault();
    if (!quickServiceForm.nameAr || !quickServiceForm.price) return;
    
    const newService: Item = {
      id: crypto.randomUUID(),
      nameAr: quickServiceForm.nameAr,
      nameEn: quickServiceForm.nameEn || quickServiceForm.nameAr,
      categoryId: '',
      price: parseFloat(quickServiceForm.price),
      trackStock: false,
      quantity: 0,
      alertThreshold: 0,
      variants: [],
      modifiers: [],
      type: 'service'
    };
    
    addItem(newService);
    addToast(t('item_added'), 'success');
    setIsQuickAddingService(false);
    setQuickServiceForm({ nameAr: '', nameEn: '', price: '' });
  };

  // Auto-detect customer
  const existingCustomer = useMemo(() => state.customers.find(c => c.phone === phone), [state.customers, phone]);
  useEffect(() => {
    if (existingCustomer) {
      setCustomerName(existingCustomer.name);
      setCustomerIdInput(existingCustomer.id.toString());
    }
  }, [existingCustomer]);

  // Lookup by ID
  useEffect(() => {
      if (customerIdInput) {
          const c = state.customers.find(c => c.id.toString() === customerIdInput);
          if (c) {
              setPhone(c.phone);
              // Name will be set by existingCustomer effect since phone changes
          }
      }
  }, [customerIdInput, state.customers]);

  const [selectedItems, setSelectedItems] = useState([] as any);
  const [showPreview, setShowPreview] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null as any);
  const [discountPercent, setDiscountPercent] = useState(state.settings.autoApplyDiscount ? state.settings.defaultDiscountPercent : 0);
  const [taxPercent, setTaxPercent] = useState(state.settings.autoApplyTax ? state.settings.defaultTaxPercent : 0);
  
  // Payment Modal State (دفع مختلط: كاش / بطاقة / محفظة)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [partCash, setPartCash] = useState('');
  const [partCard, setPartCard] = useState('');
  const [partWallet, setPartWallet] = useState('');
  const [cashReceived, setCashReceived] = useState('');

  // Effects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showPaymentModal) {
          if (e.key === 'Escape') setShowPaymentModal(false);
          return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); window.print(); }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setSelectedItems([]); setPhone(''); setCustomerName(''); setNotes(''); setShowPreview(false); setCreatedInvoice(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPaymentModal]);

  const addToInvoice = (item: Item) => {
    setSelectedItems(prev => {
        const exists = prev.find(i => i.item.id === item.id);
        if(exists) {
            return prev.map(i => i.item.id === item.id ? {...i, qty: i.qty + 1} : i);
        }
        return [...prev, { item, qty: 1, modifiers: [] }];
    });
  };

  const removeFromInvoice = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.item.id !== id));
  };

  const subtotal = selectedItems.reduce((acc, item) => acc + (item.item.price * item.qty), 0);
  const discountAmount = Math.max(0, Math.min(100, discountPercent)) / 100 * subtotal;
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.max(0, Math.min(100, taxPercent)) / 100 * taxableBase;
  const total = Math.max(0, taxableBase + taxAmount);

  // --- حالة الدفع المختلط (محسوبة لحظياً من حقول التقسيم) ---
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? round2(n) : 0; };
  const partsRaw: PaymentPart[] = [
      { method: 'cash', amount: num(partCash) },
      { method: 'card', amount: num(partCard) },
      { method: 'wallet', amount: num(partWallet) }
  ];
  const draftParts: PaymentPart[] = partsRaw.filter(p => p.amount > 0);
  const draftCashPart = round2(draftParts.filter(p => p.method === 'cash').reduce((a, p) => a + p.amount, 0));
  const draftReceived = draftCashPart > 0 ? num(cashReceived) : 0;
  const paymentCheck = validatePayment(total, draftParts, draftReceived);
  const paymentRemaining = paymentCheck.remaining;
  const paymentChange = paymentCheck.info.change;

  const openPaymentModal = () => {
      // افتراضي: كل المبلغ كاش والمستلم = الإجمالي (كاشير واحد بلمسة)
      setPartCash(String(round2(total)));
      setPartCard('0');
      setPartWallet('0');
      setCashReceived(String(round2(total)));
      setShowPaymentModal(true);
  };

  const setPart = (kind: 'cash' | 'card' | 'wallet', value: string) => {
      if (kind === 'cash') setPartCash(value);
      else if (kind === 'card') setPartCard(value);
      else setPartWallet(value);
  };

  /** يوزّع أي مبلغ متبقي على طريقة واحدة (زر "الباقي كاش" مثلاً) */
  const fillRest = (kind: 'cash' | 'card' | 'wallet') => {
      const others = round2(draftParts.filter(p => p.method !== kind).reduce((a, p) => a + p.amount, 0));
      const rest = Math.max(0, round2(total - others));
      setPart(kind, String(rest));
      if (kind === 'cash') setCashReceived(String(rest));
  };

  // Loyalty Redemption Logic
  const redeemPoints = () => {
      if (!existingCustomer) return;
      const maxRedeemablePoints = existingCustomer.loyaltyPoints;
      
      // Rule: Minimum 50 points to redeem
      if (maxRedeemablePoints < 50) {
          addToast(t('loyalty_min_points_error'), 'error');
          return;
      }

      const maxRedeemableValue = maxRedeemablePoints / state.settings.loyaltyRedeemRate;
      
      // Prompt user for points to redeem
      const input = prompt(`${t('available_points')}: ${maxRedeemablePoints} (${maxRedeemableValue.toFixed(2)} ${t('egp')})\n${t('points_per_egp')}: ${state.settings.loyaltyRedeemRate}\n${t('min_points')}: 50\n${t('enter_points_redeem')}:`);
      
      if (input === null) return; // Cancelled
      
      const pointsToRedeem = parseFloat(input || '0');
      
      if (pointsToRedeem < 50) {
        if (pointsToRedeem > 0) addToast(t('cannot_redeem_less_50'), 'error');
        return;
      }

      if (pointsToRedeem > maxRedeemablePoints) {
          addToast(t('loyalty_insufficient_points'), 'error');
          return;
      }

      if (pointsToRedeem > 0) {
          const discountValue = pointsToRedeem / state.settings.loyaltyRedeemRate;
          
          // Apply as discount percentage to keep logic simple, or add a fixed discount field
          // Current architecture uses discountPercent. Let's convert value to percent of subtotal.
          if (subtotal > 0) {
              const additionalDiscountPercent = (discountValue / subtotal) * 100;
              // Cap at 100%
              const newTotalPercent = Math.min(100, discountPercent + additionalDiscountPercent);
              
              setDiscountPercent(newTotalPercent);
              
              // We need to actually deduct points ONLY when invoice is saved. 
              // But requirements say "deduct directly". 
              // However, if we deduct now and user cancels invoice, we have a problem.
              // Best practice: "Block" points now, deduct on save. 
              // For this implementation: We will just calculate it here visually, and pass `pointsRedeemed` to `addInvoice`
              // which will handle the actual deduction.
              
              // To support this, we need to store pointsRedeemed in state
              setPointsRedeemed(pointsToRedeem);
              addToast(`${t('points_redeemed_success')}: ${pointsToRedeem} (${discountValue.toFixed(2)} ${t('egp')})`, 'success');
          } else {
              addToast(t('add_items_first'), 'error');
          }
      }
  };
  
  // State to track redeemed points for the current session
  const [pointsRedeemed, setPointsRedeemed] = useState(0);

  const handleRestore = (invoice: Invoice) => {
      setPhone(invoice.customerName === 'Guest' ? '' : (state.customers.find(c => c.name === invoice.customerName)?.phone || '')); 
      setCustomerName(invoice.customerName);
      setSelectedItems(invoice.items.map(item => {
          // استرجاع العنصر من قائمة الأصناف أو بناء نسخة مؤقتة من بيانات الفاتورة
          const found = state.items.find(i => i.id === item.itemId);
          const restored: Item = found || {
             id: item.itemId, nameAr: item.name, nameEn: item.name, categoryId: '', price: item.price,
             trackStock: false, quantity: 0, alertThreshold: 0, variants: [], modifiers: [], type: 'service'
          };
          return { item: restored, qty: item.quantity, modifiers: item.modifiers || [] };
      }));
      setDiscountPercent(invoice.discountPercent);
      setTaxPercent(invoice.taxPercent);
      setNotes(invoice.notes || '');
      restoreInvoice(invoice.id); // Remove from held list
      setShowHeldInvoices(false);
      addToast(t('invoice_restored'), 'info');
  };

  const handleHold = () => {
      if (selectedItems.length === 0) return addToast(t('no_items_to_hold'), 'error');
      
      const invoiceData: any = {
          customerId: existingCustomer ? existingCustomer.id : 0,
          customerName: customerName || t('guest'),
          items: selectedItems.map((i: any) => ({
              itemId: i.item.id,
              name: language === 'ar' ? i.item.nameAr : i.item.nameEn,
              price: i.item.price,
              quantity: i.qty,
              modifiers: i.modifiers || []
          })),
          subtotal,
          discountPercent,
          taxPercent,
          total,
          date: localIsoToday(),
          timestamp: Date.now(),
          status: 'pending',
          notes,
          paymentMethod: 'cash'
      };
      
      holdInvoice(invoiceData);
      // Reset form
      setSelectedItems([]);
      setPhone('');
      setCustomerName('');
      setNotes('');
  };

  const handleSave = () => {
      // Strict Validation
      const phoneRegex = /^01\d{9}$/;
      const nameRegex = /^(\S+)\s+(\S+)\s+(\S+).*$/; // At least 3 parts

      if(!phone || !customerName || selectedItems.length === 0) return alert(t('fill_all_fields'));
      
      if (!phoneRegex.test(phone)) {
          return alert(t('invalid_phone_format'));
      }
      // Only validate name if it's a new customer or name is manually entered (to enforce 3 parts)
      if (!existingCustomer && !nameRegex.test(customerName)) {
           return alert(t('invalid_name_format'));
      }

      openPaymentModal();
  };

  const confirmSave = () => {
      if (!selectedStaffId) {
          alert(t('select_barber_alert'));
          return;
      }
      // منع إتمام البيع: مجموع الأجزاء = الإجمالي والمستلم يغطي الجزء الكاش
      if (!paymentCheck.ok) {
          alert(t(paymentCheck.error || 'payment_sum_mismatch'));
          return;
      }
      setShowPaymentModal(false);
      const existing = state.customers.find(c => c.phone === phone);
      const customerId = addCustomer({ 
        name: customerName, 
        phone 
      } as any);

      if (!existing) {
        addToast(`${t('customer_added')}: ${customerName}`, 'success');
      }
      
      const selectedStaff = state.staff.find(s => s.id === selectedStaffId);

      const invoiceData = {
          customerId,
          customerName,
          items: selectedItems.map(i => ({ 
              itemId: i.item.id, 
              name: language === 'ar' ? i.item.nameAr : i.item.nameEn,
              price: i.item.price,
              quantity: i.qty,
              modifiers: i.modifiers
          })),
          subtotal,
          discountPercent,
          taxPercent,
          total,
          date: localIsoToday(),
          timestamp: Date.now(),
          status: 'paid',
          paymentMethod: paymentCheck.info.method,
          paymentParts: paymentCheck.info.parts,
          cashPaid: paymentCheck.info.cashPaid,
          received: paymentCheck.info.received,
          change: paymentCheck.info.change,
          notes: notes,
          staffId: selectedStaffId,
          staffName: selectedStaff?.name
      };
      
      addInvoice(invoiceData as any);
      // Hack to get the ID just generated (length + 1)
      setCreatedInvoice({ ...invoiceData, id: state.invoices.length + 1, printSnapshot: buildPrintIdentity(state.settings) });
      setShowPreview(true);
      setPointsRedeemed(0); // Reset after save
  };

  if (showPreview && createdInvoice) {
      return (
        <div className="animate-fade-in space-y-4 neon-bg">
             <InvoiceReceipt invoice={createdInvoice} />
             <div className="no-print flex gap-4 justify-end">
                 <Button onClick={() => {
                     // Determine phone number (use customer's phone if available)
                     const targetPhone = state.customers.find(c => c.id === createdInvoice.customerId)?.phone || '';
                     let formattedPhone = targetPhone;
                     // Simple formatting for Egypt if needed, or leave as is if user inputs 01...
                     // WhatsApp API expects international format without +, e.g. 201xxxxxxxxx
                     if (formattedPhone.startsWith('01')) {
                         formattedPhone = '2' + formattedPhone;
                     }

                     // Construct Professional Message
                     const itemsList = createdInvoice.items.map((i: any, idx: number) =>
                        `${idx + 1}. ${i.name}\n    ▫ ${t('qty_table_header')}: ${i.quantity} | ${t('price_table_header')}: ${i.price.toLocaleString('en-US')} ${t('egp')}`
                     ).join('\n\n');

                     // Calculate Points
                     const earnedPoints = Math.floor(createdInvoice.total / 20);
                     const totalPoints = state.customers.find(c => c.id === createdInvoice.customerId)?.loyaltyPoints || 0;
                     const previousPoints = Math.max(0, totalPoints - earnedPoints);

                     // Get Cashier Name
                     const cashierName = createdInvoice.createdBy || t('unknown_staff');

                     // Format Date / Time (locale-aware: ص/م بالعربية، AM/PM بالإنجليزية)
                     const invoiceDate = formatDate(parseInvoiceDate(createdInvoice.date), { day: '2-digit', month: '2-digit', year: 'numeric' });
                     const invoiceTime = formatTime(createdInvoice.timestamp || Date.now(), { hour: '2-digit', minute: '2-digit', hour12: true });

                     const msg = `💈 *${state.settings.shopName} - ${t('wa_einvoice_title')}* 💈

${t('wa_welcome')} ${createdInvoice.customerName} 👋
${t('wa_visit_thanks')}

📄 *${t('wa_invoice_details')}:*
• ${t('invoice_no')}: #${createdInvoice.id}
• ${t('date_label')}: ${invoiceDate} | ${t('time_label')}: ${invoiceTime}
${(() => {
    const pay = paymentOf(createdInvoice);
    const lines = [`• ${t('payment_method')}: ${t(pay.method)}`];
    pay.parts.forEach(p => lines.push(`   - ${t(p.method)}: ${p.amount.toLocaleString('en-US')} ${t('egp')}`));
    if (pay.cashPaid > 0) {
        lines.push(`• ${t('cash_received')}: ${pay.received.toLocaleString('en-US')} ${t('egp')}`);
        if (pay.change > 0) lines.push(`• ${t('change_due')}: ${pay.change.toLocaleString('en-US')} ${t('egp')}`);
    }
    return lines.join('\n');
})()}
• ${t('cashier_label')}: ${cashierName}

💎 *${t('loyalty_points')}:*
• ${t('wa_prev_points')}: ${previousPoints}
• ${t('wa_earned_points')}: +${earnedPoints} 🌟
• ${t('wa_total_points')}: ${totalPoints} ${t('wa_points_unit')}

✂ *${t('wa_services_details')}:*
--------------------------
${itemsList}
--------------------------

💰 *${t('wa_final_total')}:* ${createdInvoice.total.toLocaleString('en-US')} ${t('egp')}

${t('wa_thanks_trust')} ${state.settings.shopName} 💇‍♂
${t('wa_contact_booking')}: ${state.settings.phone}`;

                     window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                 }} variant="success">WhatsApp</Button>
                 <PrintActions invoice={createdInvoice} />
                 <Button onClick={onClose} variant="secondary">{t('back')}</Button>
             </div>
        </div>
      );
  }

  const clearInvoice = () => {
        if (confirm(t('confirm_delete'))) {
            setSelectedItems([]);
            setCustomerName('');
            setPhone('');
            setDiscountPercent(0);
            setTaxPercent(0);
        }
    };

    return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full relative">
        <div className="lg:col-span-2 space-y-6">
             <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Users size={20} /> {t('customer_name')}</h3>
                    {state.heldInvoices.length > 0 && (
                        <button onClick={() => setShowHeldInvoices(true)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors font-bold animate-pulse-slow">
                            <PauseCircle size={14}/> {state.heldInvoices.length} {t('held')}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input 
                        label={t('customer_id')}
                        value={customerIdInput}
                        onChange={(e: any) => setCustomerIdInput(e.target.value)}
                        placeholder={t('ph_invoice_id')}
                    />
                    <div>
                        <Input 
                            list="customer-phones"
                            label={t('phone')} 
                            value={phone} 
                            onChange={(e: any) => setPhone(e.target.value)} 
                            placeholder={t('ph_phone')} 
                            validationRegex={/^01\d{9}$/}
                            error={t('invalid_phone_format')}
                            onEnter={() => document.getElementById('customerNameInput')?.focus()}
                        />
                        <datalist id="customer-phones">
                            {state.customers.map(c => (
                                <option key={c.id} value={c.phone}>{c.name}</option>
                            ))}
                        </datalist>
                    </div>
                    <Input 
                        id="customerNameInput"
                        label={t('customer_name')} 
                        value={customerName} 
                        onChange={(e: any) => setCustomerName(e.target.value)} 
                        placeholder={t('customer_name')} 
                        validationRegex={/^(\S+)\s+(\S+)\s+(\S+).*$/}
                        error={t('invalid_name_format')}
                    />
                </div>
                {existingCustomer && (
                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                             <div className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 p-2 rounded-full"><Award size={18}/></div>
                             <div>
                                 <p className="font-bold text-purple-900 dark:text-purple-200">{t('loyalty_points')}: {existingCustomer.loyaltyPoints || 0}</p>
                                 <p className="text-xs text-purple-600 dark:text-purple-400">{t('last_visit')}: {formatDate(new Date(existingCustomer.lastVisit))}</p>
                             </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${existingCustomer.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' : existingCustomer.tier === 'Silver' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-800'}`}>
                            {t(existingCustomer.tier?.toLowerCase() || 'bronze')}
                        </span>
                    </div>
                )}
             </Card>
             <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Package size={20}/> {t('items')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {state.items.map((item, idx) => {
                        const palettes = [
                            { bg: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-emerald-600/40', shadow: 'shadow-emerald-500/20' },
                            { bg: 'from-rose-500 to-pink-600', ring: 'ring-rose-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-rose-600/40', shadow: 'shadow-rose-500/20' },
                            { bg: 'from-sky-500 to-blue-600', ring: 'ring-sky-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-sky-600/40', shadow: 'shadow-sky-500/20' },
                            { bg: 'from-violet-500 to-purple-600', ring: 'ring-violet-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-violet-600/40', shadow: 'shadow-violet-500/20' },
                            { bg: 'from-amber-500 to-orange-600', ring: 'ring-amber-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-amber-600/40', shadow: 'shadow-amber-500/20' },
                            { bg: 'from-cyan-500 to-sky-600', ring: 'ring-cyan-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-cyan-600/40', shadow: 'shadow-cyan-500/20' },
                            { bg: 'from-lime-500 to-green-600', ring: 'ring-lime-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-lime-600/40', shadow: 'shadow-lime-500/20' },
                            { bg: 'from-fuchsia-500 to-pink-600', ring: 'ring-fuchsia-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-fuchsia-600/40', shadow: 'shadow-fuchsia-500/20' },
                            { bg: 'from-indigo-500 to-blue-700', ring: 'ring-indigo-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-indigo-600/40', shadow: 'shadow-indigo-500/20' },
                            { bg: 'from-yellow-500 to-amber-600', ring: 'ring-yellow-300/50', iconBg: 'bg-white/20', label: 'bg-white/20 border-white/30', badge: 'bg-yellow-600/40', shadow: 'shadow-yellow-500/20' },
                        ];
                        let hash = 0;
                        for (let i = 0; i < item.id.length; i++) hash = (hash * 31 + item.id.charCodeAt(i)) >>> 0;
                        const styleIdx = hash % palettes.length;
                        const p = palettes[styleIdx];
                        const isService = item.type === 'service';
                        return (
                            <button key={item.id} onClick={() => addToInvoice(item)} className={`relative overflow-hidden rounded-2xl p-4 min-h-[120px] flex flex-col items-start justify-between group transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 active:scale-95 shadow-lg ${p.shadow} bg-gradient-to-br ${p.bg} text-white ring-1 ${p.ring}`}>
                                <div className="w-full flex items-start justify-between mb-2">
                                    <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center backdrop-blur-sm shadow-inner ring-1 ring-white/20 transition-transform group-hover:scale-110 duration-300`}>
                                        {isService ? <Scissors size={20} /> : <Package size={20} />}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm border border-white/30 ${p.badge}`}>
                                        {isService ? t('service') : t('product')}
                                    </span>
                                </div>
                                <div className="w-full">
                                    <div className="font-bold text-base mb-2 leading-tight text-left line-clamp-2 drop-shadow-sm">{language === 'ar' ? item.nameAr : item.nameEn}</div>
                                    <div className={`font-mono text-lg font-black ${p.label} px-3 py-1 rounded-full border backdrop-blur-sm inline-block shadow-inner`}>
                                        {formatNumber(item.price)} {t('egp')}
                                    </div>
                                </div>
                                <div className="absolute -bottom-4 -right-4 opacity-10 transition-all duration-500 group-hover:opacity-20 group-hover:scale-125">
                                    {isService ? <Scissors size={64} /> : <Package size={64} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
             </Card>
             <Card>
                <h3 className="text-lg font-bold mb-4">{t('billing')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label={t('discount_percent')} type="number" value={discountPercent} onChange={(e:any)=>setDiscountPercent(parseFloat(e.target.value || 0))} />
                    <Input label={t('tax_percent')} type="number" value={taxPercent} onChange={(e:any)=>setTaxPercent(parseFloat(e.target.value || 0))} />
                    <div className="flex flex-col justify-end gap-2">
                        <div className="text-sm text-slate-600 dark:text-slate-300">{t('subtotal')}: <span className="font-bold">{subtotal.toLocaleString('en-US')} {t('egp')}</span></div>
                        {existingCustomer && state.settings.loyaltyEnabled && (
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-xs text-purple-600 font-bold">{t('loyalty_points')}: {existingCustomer.loyaltyPoints}</div>
                                <button 
                                    onClick={redeemPoints} 
                                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors flex items-center gap-1"
                                >
                                    <Award size={14}/> {t('redeem_points_btn')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4">
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('barber')}</label>
                     <select 
                         className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500" 
                         value={selectedStaffId} 
                         onChange={(e) => setSelectedStaffId(e.target.value)}
                     >
                         <option value="">{t('select_barber')}</option>
                         {state.staff.filter(s => s.role === 'Barber' && s.active).map(s => (
                             <option key={s.id} value={s.id}>{s.name}</option>
                         ))}
                     </select>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notes')}</label>
                    <textarea 
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-500"
                        rows={2}
                        placeholder={t('ph_invoice_notes')}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                </div>
             </Card>
        </div>
        
        <div className="lg:col-span-1 h-full">
            <Card className="h-full flex flex-col border-2 border-primary-500/20">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="font-bold text-lg">{t('invoice')} #{state.invoices.length + 1}</h3>
                    <div className="flex items-center gap-2">
                         {selectedItems.length > 0 && (
                             <button onClick={clearInvoice} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors">{t('clear')}</button>
                         )}
                         <span className="text-sm text-slate-500">{formatDate(new Date())}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                    {selectedItems.length === 0 && (
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                            <Package size={48} className="opacity-20"/>
                            <p>{t('no_items')}</p>
                        </div>
                    )}
                    {selectedItems.map((item: any) => {
                        const cartPalettes = [
                            { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-l-4 border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', tag: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/50 dark:text-emerald-300', qty: 'bg-emerald-500 text-white', ring: 'ring-emerald-200 dark:ring-emerald-700' },
                            { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-l-4 border-rose-500', text: 'text-rose-700 dark:text-rose-300', tag: 'bg-rose-100 text-rose-700 dark:bg-rose-800/50 dark:text-rose-300', qty: 'bg-rose-500 text-white', ring: 'ring-rose-200 dark:ring-rose-700' },
                            { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-l-4 border-sky-500', text: 'text-sky-700 dark:text-sky-300', tag: 'bg-sky-100 text-sky-700 dark:bg-sky-800/50 dark:text-sky-300', qty: 'bg-sky-500 text-white', ring: 'ring-sky-200 dark:ring-sky-700' },
                            { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-l-4 border-violet-500', text: 'text-violet-700 dark:text-violet-300', tag: 'bg-violet-100 text-violet-700 dark:bg-violet-800/50 dark:text-violet-300', qty: 'bg-violet-500 text-white', ring: 'ring-violet-200 dark:ring-violet-700' },
                            { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-l-4 border-amber-500', text: 'text-amber-700 dark:text-amber-300', tag: 'bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-300', qty: 'bg-amber-500 text-white', ring: 'ring-amber-200 dark:ring-amber-700' },
                            { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-l-4 border-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', tag: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-800/50 dark:text-cyan-300', qty: 'bg-cyan-500 text-white', ring: 'ring-cyan-200 dark:ring-cyan-700' },
                            { bg: 'bg-lime-50 dark:bg-lime-900/20', border: 'border-l-4 border-lime-500', text: 'text-lime-700 dark:text-lime-300', tag: 'bg-lime-100 text-lime-700 dark:bg-lime-800/50 dark:text-lime-300', qty: 'bg-lime-600 text-white', ring: 'ring-lime-200 dark:ring-lime-700' },
                            { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', border: 'border-l-4 border-fuchsia-500', text: 'text-fuchsia-700 dark:text-fuchsia-300', tag: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-800/50 dark:text-fuchsia-300', qty: 'bg-fuchsia-500 text-white', ring: 'ring-fuchsia-200 dark:ring-fuchsia-700' },
                            { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-l-4 border-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', tag: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800/50 dark:text-indigo-300', qty: 'bg-indigo-500 text-white', ring: 'ring-indigo-200 dark:ring-indigo-700' },
                            { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-l-4 border-yellow-500', text: 'text-yellow-700 dark:text-yellow-300', tag: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800/50 dark:text-yellow-300', qty: 'bg-yellow-500 text-white', ring: 'ring-yellow-200 dark:ring-yellow-700' },
                        ];
                        let hash = 0;
                        for (let i = 0; i < item.item.id.length; i++) hash = (hash * 31 + item.item.id.charCodeAt(i)) >>> 0;
                        const cp = cartPalettes[hash % cartPalettes.length];
                        const isService = item.item.type === 'service';
                        return (
                            <div key={item.item.id} className={`relative ${cp.bg} ${cp.border} p-3 rounded-xl group animate-fade-in-right shadow-sm hover:shadow-md transition-all duration-200`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${cp.ring} ${cp.tag} flex-shrink-0`}>
                                            {isService ? <Scissors size={14} /> : <Package size={14} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{language === 'ar' ? item.item.nameAr : item.item.nameEn}</h4>
                                            <div className={`text-[10px] font-bold uppercase tracking-wide ${cp.text}`}>
                                                {isService ? t('service') : t('product')} • {formatNumber(item.item.price)} {t('egp')}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => removeFromInvoice(item.item.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex-shrink-0"><Trash2 size={16}/></button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md ${cp.qty}`}>
                                            {formatNumber(item.qty)}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            × {formatNumber(item.item.price)} {t('egp')}
                                        </div>
                                    </div>
                                    <div className={`text-lg font-black font-mono ${cp.text}`}>
                                        {formatNumber(item.qty * item.item.price)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="border-t pt-4">
                    <div className="flex justify-between text-xl font-bold mb-4">
                        <span>{t('total')}</span>
                        <span className="text-primary-600">{total.toLocaleString('en-US')} {t('egp')}</span>
                    </div>
                    <div className="flex gap-2">
                         <Button onClick={handleHold} variant="secondary" className="px-3" title={t('hold_invoice')}><PauseCircle size={20}/></Button>
                         <Button onClick={handleSave} className="flex-1 justify-center">{t('save')}</Button>
                         <Button onClick={onClose} variant="danger" className="px-3"><Trash2 size={20}/></Button>
                    </div>
                </div>
            </Card>
        </div>

        {/* Payment Modal — تقسيم الدفع (كاش / بطاقة / محفظة) */}
        {showPaymentModal && (
            <ModalShell
                title={t('payment_details')}
                onClose={() => setShowPaymentModal(false)}
                maxWidth="max-w-lg"
            >
                <p className="text-center text-sm text-slate-400 mb-4">
                        {t('total')}: <span className="font-bold text-slate-700 dark:text-slate-200">{round2(total).toLocaleString('en-US')} {t('egp')}</span>
                    </p>

                    {/* أجزاء السداد */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {([['cash', partCash, setPartCash], ['card', partCard, setPartCard], ['wallet', partWallet, setPartWallet]] as const).map(([kind, value, setValue]) => (
                            <div key={kind} className="border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1 text-center">{t(kind)}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="w-full px-2 py-2 text-center font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                    placeholder="0.00"
                                />
                                <button
                                    type="button"
                                    onClick={() => { fillRest(kind); }}
                                    className="w-full mt-1 text-[10px] font-bold py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                                >
                                    {t('all_on_method')}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* النقد المستلم مقابل الكاش المخصص */}
                    {draftCashPart > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-sm font-bold text-green-700 dark:text-green-300">{t('cash_for_invoice')}:</span>
                                <span className="font-bold text-green-800 dark:text-green-200">{draftCashPart.toLocaleString('en-US')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{t('cash_received')}:</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    className="flex-1 px-3 py-2 text-center font-bold rounded-lg border-2 border-green-300 dark:border-green-700 bg-white dark:bg-slate-900"
                                    placeholder="0.00"
                                />
                                <button
                                    type="button"
                                    onClick={() => setCashReceived(String(draftCashPart))}
                                    className="px-2 py-2 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700"
                                >
                                    {t('exact_amount')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* الملخص */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 text-sm mb-3">
                        <div className="flex justify-between px-3 py-2">
                            <span className="text-slate-500">{t('paid_total')}</span>
                            <span className="font-bold">{round2(paymentCheck.info.total).toLocaleString('en-US')} {t('egp')}</span>
                        </div>
                        <div className={`flex justify-between px-3 py-2 ${paymentRemaining !== 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-bold' : ''}`}>
                            <span>{t('payment_remaining')}</span>
                            <span>{paymentRemaining.toLocaleString('en-US')} {t('egp')}</span>
                        </div>
                        {draftCashPart > 0 && (
                            <div className="flex justify-between px-3 py-2">
                                <span className="text-slate-500">{t('change_due')}</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{paymentChange.toLocaleString('en-US')} {t('egp')}</span>
                            </div>
                        )}
                        <div className="flex justify-between px-3 py-2">
                            <span className="text-slate-500">{t('drawer_increase')}</span>
                            <span className="font-bold text-green-600 dark:text-green-400">+{paymentCheck.info.cashPaid.toLocaleString('en-US')} {t('egp')}</span>
                        </div>
                    </div>

                    {!paymentCheck.ok && (
                        <p className="text-xs font-bold text-red-500 text-center mb-2">{t(paymentCheck.error!)}</p>
                    )}

                    <div className="flex gap-3">
                        <Button variant="success" onClick={confirmSave} disabled={!paymentCheck.ok} className="flex-1 justify-center py-3 text-lg">{t('confirm')}</Button>
                        <Button variant="secondary" onClick={() => setShowPaymentModal(false)} className="flex-1 justify-center py-3 text-lg">{t('cancel')}</Button>
                    </div>
            </ModalShell>
        )}

        {/* Held Invoices Modal */}
        {showHeldInvoices && (
            <ModalShell
                title={t('held_invoices')}
                onClose={() => setShowHeldInvoices(false)}
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                        {state.heldInvoices.length === 0 && <p className="text-center text-slate-500 py-8">{t('no_held_invoices')}</p>}
                        {state.heldInvoices.map(inv => (
                            <div key={inv.id} className="border border-slate-100 dark:border-slate-700 p-4 rounded-xl flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{inv.customerName}</h4>
                                    <p className="text-sm text-slate-500">{formatDateTime(inv.timestamp)} • {t('items')}: {inv.items.length}</p>
                                    <p className="font-bold text-primary-600">{inv.total} {t('egp')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="info" onClick={() => handleRestore(inv)} className="text-sm py-1">{t('restore')}</Button>
                                    <Button variant="danger" onClick={() => deleteHeldInvoice(inv.id)} className="text-sm py-1"><Trash2 size={16}/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
            </ModalShell>
        )}

        {/* Quick Add Service Modal */}
        {isQuickAddingService && (
            <ModalShell
                title={t('add_service')}
                onClose={() => setIsQuickAddingService(false)}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleQuickAddService} className="space-y-4">
                        <Input 
                            label={t('name_ar')} 
                            value={quickServiceForm.nameAr} 
                            onChange={(e:any) => setQuickServiceForm({...quickServiceForm, nameAr: e.target.value})} 
                            required 
                            autoFocus 
                            placeholder={t('ph_service_ar')}
                        />
                        <Input 
                            label={t('name_en')} 
                            value={quickServiceForm.nameEn} 
                            onChange={(e:any) => setQuickServiceForm({...quickServiceForm, nameEn: e.target.value})} 
                            placeholder={t('ph_service_en')}
                        />
                        <Input 
                            label={t('price')} 
                            type="number" 
                            value={quickServiceForm.price} 
                            onChange={(e:any) => setQuickServiceForm({...quickServiceForm, price: e.target.value})} 
                            required 
                            placeholder="0.00"
                        />
                        <div className="flex gap-3 pt-2">
                            <Button variant="success" className="flex-1 justify-center">{t('save')}</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsQuickAddingService(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                        </div>
                    </form>
            </ModalShell>
        )}
    </div>
  );
};

