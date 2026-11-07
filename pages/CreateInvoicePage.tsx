import { normalizeBarcode, useBarcodeScanner } from '../lib/barcode';
/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Smartphone } from '../components/Icons';
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
import { PrintActions, openInvoiceWhatsApp } from '../components/PrintActions';
import { isMainBranch, getActiveBranch } from '../lib/branchUtils';

const DRAFT_KEY = 'procashier_active_invoice_draft_v1';

const getInitialInvoiceDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse invoice draft', e);
  }
  return null;
};

export const CreateInvoice = ({ onClose }: any) => {
  const { state, addInvoice, holdInvoice, restoreInvoice, deleteHeldInvoice, t, addToast, addCustomer, updateSettings, language, addItem, formatNumber, formatDate, formatTime, formatDateTime } = useApp();
  const isMain = isMainBranch(state.settings.currentLocationId, state.locations);
  const activeBranch = getActiveBranch(state.settings.currentLocationId, state.locations);
  const { playBeep } = useSound();
  
  // استرجاع المسودة المحفوظة تلقائياً إذا وجدت حتى لا تضيع عند مغادرة الصفحة
  const initialDraft = useMemo(() => getInitialInvoiceDraft(), []);
  
  const [phone, setPhone] = useState(initialDraft?.phone || '');
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || '');
  const [customerIdInput, setCustomerIdInput] = useState(initialDraft?.customerIdInput || '');
  const [notes, setNotes] = useState(initialDraft?.notes || '');
  const [selectedStaffId, setSelectedStaffId] = useState(initialDraft?.selectedStaffId || '');
  const [showHeldInvoices, setShowHeldInvoices] = useState(false);
  const [showHoldPromptModal, setShowHoldPromptModal] = useState(false);
  const [holdNoteInput, setHoldNoteInput] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // ماسح الباركود العام: يعمل في أي مكان بالصفحة عند استخدام جهاز الباركود USB أو البلوتوث
  useBarcodeScanner((scannedCode) => {
    const code = normalizeBarcode(scannedCode);
    if (!code) return;

    const found = state.items.find(i => 
      (i.barcode && normalizeBarcode(i.barcode).toLowerCase() === code.toLowerCase()) ||
      (i.sku && normalizeBarcode(i.sku).toLowerCase() === code.toLowerCase()) ||
      (i.id && i.id.toLowerCase() === code.toLowerCase())
    );

    if (found) {
      playBeep();
      addToInvoice(found);
      const itemName = language === 'ar' ? found.nameAr : (found.nameEn || found.nameAr);
      addToast(`${itemName} (+1)`, 'success');
    } else {
      addToast(language === 'ar' ? `الباركود [${code}] غير مسجل في المخزون` : `Barcode [${code}] not found`, 'error');
    }
  });
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق قائمة العملاء التلقائية عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomerSuggestions = useMemo(() => {
    const qPhone = (phone || '').trim().toLowerCase();
    const qName = (customerName || '').trim().toLowerCase();
    const qId = (customerIdInput || '').trim().toLowerCase();
    const activeQuery = qPhone || qName || qId;
    if (!activeQuery) return state.customers.slice(0, 15);
    return state.customers.filter(c => {
      const matchPhone = c.phone && c.phone.includes(activeQuery);
      const matchName = c.name && c.name.toLowerCase().includes(activeQuery);
      const matchId = c.id && c.id.toString().includes(activeQuery);
      return matchPhone || matchName || matchId;
    }).slice(0, 20);
  }, [phone, customerName, customerIdInput, state.customers]);

  const updateItemQuantity = (id: string, delta: number) => {
    setSelectedItems((prev: any[]) => {
      return prev.map(i => {
        if (i.item.id === id) {
          const newQty = i.qty + delta;
          if (delta > 0 && i.item.type === 'product' && i.item.trackStock) {
            const stockItem = state.items.find(si => si.id === id);
            const maxAvailable = stockItem ? stockItem.quantity : i.item.quantity;
            if (newQty > maxAvailable) {
              addToast(language === 'ar' ? `الكمية بالمخزن (${maxAvailable}) فقط` : `Stock limit reached (${maxAvailable})`, 'error');
              return i;
            }
          }
          return newQty > 0 ? { ...i, qty: newQty } : null;
        }
        return i;
      }).filter(Boolean);
    });
  };

  // Quick Add Customer State
  const [isQuickAddingCustomer, setIsQuickAddingCustomer] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '' });

  const handleQuickAddCustomer = (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const nameTrimmed = (quickCustomerForm.name || '').trim();
    const rawPhone = (quickCustomerForm.phone || '').trim();

    if (!nameTrimmed) {
      addToast(language === 'ar' ? 'يرجى إدخال اسم العميل' : 'Please enter customer name', 'error');
      return;
    }

    // شرط: يجب أن يكون اسم العميل ثلاثياً على الأقل (3 أسماء)
    const nameParts = nameTrimmed.split(/\s+/).filter(Boolean);
    if (nameParts.length < 3) {
      addToast(
        language === 'ar'
          ? 'شرط: يجب إدخال اسم العميل ثلاثياً على الأقل (مثال: محمد أحمد علي)'
          : 'Customer name must be at least 3 parts (tripartite name)',
        'error'
      );
      return;
    }
    if (nameParts.some(part => part.length < 2)) {
      addToast(
        language === 'ar'
          ? 'يرجى كتابة أسماء صحيحة (كل مقطع يتكون من حرفين على الأقل)'
          : 'Please enter valid names (each name at least 2 characters)',
        'error'
      );
      return;
    }

    if (!rawPhone) {
      addToast(language === 'ar' ? 'يرجى إدخال رقم الهاتف' : 'Please enter phone number', 'error');
      return;
    }

    // تحويل الأرقام العربية الهندية إلى أرقام إنجليزية وتجريد أي رموز إضافية
    let cleanPhone = rawPhone
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[^\d]/g, '');

    // استبعاد كود الدولة لمصر (20) إن وُجد مثل 2010... ليصبح 010...
    if (cleanPhone.startsWith('201') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.slice(1);
    }

    // شرط: رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط
    if (cleanPhone.length !== 11) {
      addToast(
        language === 'ar'
          ? `شرط: رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط (أدخلت ${cleanPhone.length} أرقام)`
          : `Phone number must be exactly 11 digits (entered ${cleanPhone.length})`,
        'error'
      );
      return;
    }

    // التحقق من أنه رقم محمول مصري سليم يبدأ بـ 01
    if (!cleanPhone.startsWith('01')) {
      addToast(
        language === 'ar'
          ? 'شرط: رقم الهاتف المحمول يجب أن يبدأ بـ 01 (مثال: 010, 011, 012, 015)'
          : 'Phone number must start with 01',
        'error'
      );
      return;
    }

    try {
      const generatedId = addCustomer({
        name: nameTrimmed,
        phone: cleanPhone,
        creditLimit: 0,
        balance: 0,
        notes: ''
      });

      setPhone(cleanPhone);
      setCustomerName(nameTrimmed);
      if (generatedId) {
        setCustomerIdInput(String(generatedId));
      }

      setIsQuickAddingCustomer(false);
      setQuickCustomerForm({ name: '', phone: '' });
      addToast(language === 'ar' ? `تمت إضافة العميل «${nameTrimmed}» واختياره بنجاح` : 'Customer added successfully', 'success');
    } catch (err: any) {
      addToast(err?.message || 'تعذر إضافة العميل', 'error');
    }
  };

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

  const [selectedItems, setSelectedItems] = useState((initialDraft?.selectedItems || []) as any);
  const [showPreview, setShowPreview] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null as any);
  const [discountPercent, setDiscountPercent] = useState(
    initialDraft?.discountPercent !== undefined ? initialDraft.discountPercent : (state.settings.autoApplyDiscount ? state.settings.defaultDiscountPercent : 0)
  );
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    initialDraft?.discountType || 'percentage'
  );
  const [discountFixedAmount, setDiscountFixedAmount] = useState<number>(
    initialDraft?.discountFixedAmount !== undefined ? initialDraft.discountFixedAmount : 0
  );
  const [discountReason, setDiscountReason] = useState<string>(
    initialDraft?.discountReason || 'خصم عام'
  );
  const [customDiscountReason, setCustomDiscountReason] = useState<string>(
    initialDraft?.customDiscountReason || ''
  );
  const [taxPercent, setTaxPercent] = useState(
    initialDraft?.taxPercent !== undefined ? initialDraft.taxPercent : (state.settings.autoApplyTax ? state.settings.defaultTaxPercent : 0)
  );

  // حفظ مسودة الفاتورة تلقائياً عند أي تعديل لتبقى موجودة عند الخروج والرجوع
  useEffect(() => {
    if (selectedItems.length > 0 || customerName.trim() || phone.trim() || notes.trim()) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        phone,
        customerName,
        customerIdInput,
        notes,
        selectedStaffId,
        selectedItems,
        discountPercent,
        discountType,
        discountFixedAmount,
        discountReason,
        customDiscountReason,
        taxPercent
      }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [phone, customerName, customerIdInput, notes, selectedStaffId, selectedItems, discountPercent, discountType, discountFixedAmount, discountReason, customDiscountReason, taxPercent]);
  
  // Payment Modal State (دفع مختلط: كاش / بطاقة / محفظة / على الحساب)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'normal' | 'credit'>('normal');
  const [partCash, setPartCash] = useState('');
  const [partCard, setPartCard] = useState('');
  const [partWallet, setPartWallet] = useState('');
  const [partInstapay, setPartInstapay] = useState('');
  const [partCredit, setPartCredit] = useState('');
  const [cashReceived, setCashReceived] = useState('');

  // Effects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showPaymentModal) {
          if (e.key === 'Escape') setShowPaymentModal(false);
          return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          if (isMain) {
              window.print();
          } else {
              addToast(language === 'ar' ? 'هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير (يلزم تأكيد المدير للطباعة)' : 'This is not the main branch. Manager confirmation required to print.', 'warning');
          }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setSelectedItems([]); setPhone(''); setCustomerName(''); setNotes(''); setShowPreview(false); setCreatedInvoice(null); localStorage.removeItem(DRAFT_KEY); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPaymentModal]);

  const addToInvoice = (item: Item) => {
    const isProduct = item.type === 'product';
    if (isProduct && item.trackStock && item.quantity <= 0) {
        addToast(language === 'ar' ? `المنتج [${item.nameAr}] نفد من المخزون تماماً (الكمية 0)` : `[${item.nameEn || item.nameAr}] is out of stock`, 'error');
        return;
    }

    const existing = selectedItems.find(i => i.item.id === item.id);
    if (isProduct && item.trackStock && existing && (existing.qty + 1) > item.quantity) {
        addToast(language === 'ar' ? `الكمية المتوفرة بالمخزن (${item.quantity}) فقط` : `Only ${item.quantity} available in stock`, 'error');
        return;
    }

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

  const displayedItems = useMemo(() => {
    return state.items.filter(item => {
      const q = itemSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        (item.nameAr && item.nameAr.toLowerCase().includes(q)) || 
        (item.nameEn && item.nameEn.toLowerCase().includes(q));
      
      if (!matchesSearch) return false;

      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'services') return item.type === 'service';
      if (selectedCategory === 'products') return item.type === 'product';
      return item.categoryId === selectedCategory;
    });
  }, [state.items, itemSearch, selectedCategory]);

  const itemCounts = useMemo(() => {
    const total = state.items.length;
    const services = state.items.filter(i => i.type === 'service').length;
    const products = state.items.filter(i => i.type === 'product').length;
    return { total, services, products };
  }, [state.items]);

  const subtotal = round2(selectedItems.reduce((acc, item) => acc + (item.item.price * item.qty), 0));
  
  // حساب مبلغ ونسبة الخصم حسب النوع المختار (نسبة مئوية أو مبلغ ثابت)
  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return round2((Math.max(0, Math.min(100, discountPercent)) / 100) * subtotal);
    } else {
      return round2(Math.min(subtotal, Math.max(0, discountFixedAmount)));
    }
  }, [discountType, discountPercent, discountFixedAmount, subtotal]);

  const effectiveDiscountPercent = useMemo(() => {
    if (discountType === 'percentage') {
      return discountPercent;
    }
    return subtotal > 0 ? round2((discountAmount / subtotal) * 100) : 0;
  }, [discountType, discountPercent, discountAmount, subtotal]);

  const taxableBase = round2(Math.max(0, subtotal - discountAmount));
  const taxAmount = round2((Math.max(0, Math.min(100, taxPercent)) / 100) * taxableBase);
  const total = round2(Math.max(0, taxableBase + taxAmount));

  // --- حالة الدفع المختلط (محسوبة لحظياً من حقول التقسيم) ---
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? round2(n) : 0; };
  const partsRaw: PaymentPart[] = [
      { method: 'cash', amount: num(partCash) },
      { method: 'card', amount: num(partCard) },
      { method: 'wallet', amount: num(partWallet) },
      { method: 'credit', amount: num(partCredit) }
  ];
  const draftParts: PaymentPart[] = partsRaw.filter(p => p.amount > 0);
  const draftCashPart = round2(draftParts.filter(p => p.method === 'cash').reduce((a, p) => a + p.amount, 0));
  const draftReceived = draftCashPart > 0 ? num(cashReceived) : 0;
  
  // حساب الأرصدة الحية للنقدية والمحفظة وإنستا باي اليوم
  const todayDateStr = localIsoToday();
  const todayInvoices = useMemo(() => {
    return state.invoices.filter(i => i.date === todayDateStr && i.status !== 'void');
  }, [state.invoices, todayDateStr]);

  const { todayCashBalance, todayWalletBalance, todayInstapayBalance } = useMemo(() => {
    let cash = state.settings.cashDrawerOpening || 0;
    let wallet = 0;
    let instapay = 0;

    todayInvoices.forEach(inv => {
      if (inv.paymentParts && inv.paymentParts.length > 0) {
        inv.paymentParts.forEach(p => {
          if (p.method === 'cash') cash += p.amount;
          else if (p.method === 'wallet') wallet += p.amount;
          else if (p.method === 'instapay') instapay += p.amount;
        });
      } else {
        if (inv.paymentMethod === 'cash') cash += (inv.cashPaid !== undefined ? inv.cashPaid : inv.total);
        else if (inv.paymentMethod === 'wallet') wallet += inv.total;
        else if (inv.paymentMethod === 'instapay') instapay += inv.total;
      }
    });

    (state.customerPayments || []).filter(cp => cp.date === todayDateStr).forEach(cp => {
      if (cp.paymentMethod === 'cash') cash += cp.amount;
      else if (cp.paymentMethod === 'wallet') wallet += cp.amount;
      else if (cp.paymentMethod === 'instapay') instapay += cp.amount;
    });

    state.expenses.filter(e => e.date === todayDateStr && (e.method === 'cash' || !e.method)).forEach(e => {
      cash -= e.amount;
    });

    return {
      todayCashBalance: Math.max(0, cash),
      todayWalletBalance: wallet,
      todayInstapayBalance: instapay
    };
  }, [todayInvoices, state.customerPayments, state.expenses, state.settings.cashDrawerOpening, todayDateStr]);

  const paymentCheck = validatePayment(total, draftParts, draftReceived);
  const paymentRemaining = paymentCheck.remaining;
  const paymentChange = paymentCheck.info.change;

  const openPaymentModal = () => {
      setPaymentMode('normal');
      // افتراضي: كل المبلغ كاش والمستلم = الإجمالي (كاشير واحد بلمسة)
      setPartCash(String(round2(total)));
      setPartCard('0');
      setPartWallet('0');
      setPartCredit('0');
      setCashReceived(String(round2(total)));
      setShowPaymentModal(true);
  };

  const setPart = (kind: 'cash' | 'card' | 'wallet' | 'credit', value: string) => {
      if (kind === 'cash') setPartCash(value);
      else if (kind === 'card') setPartCard(value);
      else if (kind === 'wallet') setPartWallet(value);
      else if (kind === 'credit') setPartCredit(value);
  };

  /** يوزّع أي مبلغ متبقي على طريقة واحدة (مثال: دفع جزء كاش والباقي على الحساب) */
  const fillRest = (kind: 'cash' | 'card' | 'wallet' | 'credit') => {
      const others = round2(draftParts.filter(p => p.method !== kind).reduce((a, p) => a + p.amount, 0));
      const rest = Math.max(0, round2(total - others));
      setPart(kind, String(rest));
      if (kind === 'cash') setCashReceived(String(rest));
  };

  /** سداد المبلغ بالكامل بطريقة واحدة بنقرة واحدة */
  const payAllWith = (kind: 'cash' | 'card' | 'wallet' | 'credit') => {
      setPartCash(kind === 'cash' ? String(round2(total)) : '0');
      setPartCard(kind === 'card' ? String(round2(total)) : '0');
      setPartWallet(kind === 'wallet' ? String(round2(total)) : '0');
      setPartCredit(kind === 'credit' ? String(round2(total)) : '0');
      setCashReceived(kind === 'cash' ? String(round2(total)) : '0');
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
      // إذا كانت السلة فارغة، نقوم بفتح قائمة الفواتير المعلقة مباشرة
      if (selectedItems.length === 0) {
          if (state.heldInvoices.length > 0) {
              setShowHeldInvoices(true);
          } else {
              addToast(language === 'ar' ? 'السلة فارغة، ولا توجد أي فواتير معلقة حالياً' : 'Cart is empty and no held invoices', 'info');
          }
          return;
      }

      // إذا كانت السلة تحتوي على عناصر، نجهز الاسم الافتراضي ونفتح نافذة التعليق التفاعلية
      const defaultName = customerName?.trim() && customerName.trim() !== 'عميل نقدي' && customerName.trim() !== t('guest')
          ? customerName.trim()
          : (language === 'ar' ? `طلب معلق #${(state.heldInvoices || []).length + 1}` : `Held Order #${(state.heldInvoices || []).length + 1}`);

      setHoldNoteInput(defaultName);
      setShowHoldPromptModal(true);
  };

  const confirmHoldInvoice = (customName?: string) => {
      const defaultName = language === 'ar' ? `طلب معلق #${(state.heldInvoices || []).length + 1}` : `Held Order #${(state.heldInvoices || []).length + 1}`;
      const finalHoldName = (customName || holdNoteInput || '').trim() || (customerName?.trim() && customerName.trim() !== 'عميل نقدي' ? customerName.trim() : defaultName);

      const invoiceData: any = {
          customerId: existingCustomer ? existingCustomer.id : 0,
          customerName: finalHoldName,
          items: selectedItems.map((i: any) => ({
              itemId: i.item.id,
              name: language === 'ar' ? i.item.nameAr : i.item.nameEn,
              price: i.item.price,
              quantity: i.qty,
              modifiers: i.modifiers || []
          })),
          subtotal,
          discountPercent: effectiveDiscountPercent,
          discountType,
          discountAmount,
          discountReason: discountAmount > 0 ? (discountReason === 'أخرى' && customDiscountReason ? customDiscountReason : discountReason) : undefined,
          taxPercent,
          total,
          date: localIsoToday(),
          timestamp: Date.now(),
          status: 'held',
          notes: notes ? `${notes}` : '',
          paymentMethod: 'cash'
      };

      holdInvoice(invoiceData);
      setSelectedItems([]);
      setPhone('');
      setCustomerName('');
      setCustomerIdInput('');
      setNotes('');
      setShowHoldPromptModal(false);
      setHoldNoteInput('');
      localStorage.removeItem(DRAFT_KEY);
      addToast(language === 'ar' ? `تم تعليق الفاتورة «${finalHoldName}» بنجاح ⏸️` : `Invoice "${finalHoldName}" held successfully`, 'success');
  };

  const handleSave = () => {
      // Validation
      const phoneRegex = /^01\d{9}$/;
      const nameRegex = /^(\S+)\s+(\S+)\s+(\S+).*$/; // At least 3 parts
      const isCashWalkIn = phone === '01000000000' || customerName.trim() === 'عميل نقدي' || customerName.trim().toLowerCase() === 'cash customer';

      if (!phone || !customerName || selectedItems.length === 0) {
          addToast(t('fill_all_fields'), 'error');
          return;
      }
      
      if (!isCashWalkIn && !phoneRegex.test(phone)) {
          addToast(t('invalid_phone_format'), 'error');
          return;
      }
      // Only validate name if it's a new customer or name is manually entered (to enforce 3 parts)
      if (!isCashWalkIn && !existingCustomer && !nameRegex.test(customerName.trim())) {
          addToast(t('invalid_name_format'), 'error');
          return;
      }

      openPaymentModal();
  };

  const confirmSave = () => {
      if (!selectedStaffId) {
          addToast(t('select_barber_alert'), 'error');
          return;
      }
      const creditPartAmount = num(partCredit);
      if (creditPartAmount > 0) {
          const trimmedName = customerName.trim();
          if (!trimmedName || trimmedName === 'عميل نقدي' || trimmedName.toLowerCase() === 'cash customer') {
              addToast(language === 'ar' ? 'لتسجيل مبلغ على الحساب، يرجى كتابة أو اختيار اسم العميل أولاً' : 'Please provide or select a customer name for on-account balance', 'error');
              return;
          }
      }

      // منع إتمام البيع إلا إذا كان مجموع الأجزاء = الإجمالي والمستلم يغطي الجزء الكاش
      if (!paymentCheck.ok) {
          addToast(t(paymentCheck.error || 'payment_sum_mismatch'), 'error');
          return;
      }

      setShowPaymentModal(false);
      const existing = state.customers.find(c => c.phone === phone);
      const customerId = existing ? existing.id : addCustomer({ 
        name: customerName, 
        phone 
      } as any);

      if (!existing && customerName.trim() !== 'عميل نقدي') {
        addToast(`${t('customer_added')}: ${customerName}`, 'success');
      }
      
      const selectedStaff = state.staff.find(s => s.id === selectedStaffId);
      const activeBranch = state.locations.find(l => l.id === state.settings.currentLocationId) || state.locations[0];

      const isAllCredit = paymentCheck.info.creditPaid >= total && total > 0;
      const hasCredit = paymentCheck.info.creditPaid > 0;

      const invoiceData = {
          customerId,
          customerName,
          branchName: activeBranch?.name || state.settings.shopName || '',
          items: selectedItems.map(i => ({ 
              itemId: i.item.id, 
              name: language === 'ar' ? i.item.nameAr : i.item.nameEn,
              price: i.item.price,
              cost: i.item.cost || 0,
              quantity: i.qty,
              modifiers: i.modifiers
          })),
          subtotal,
          discountPercent,
          taxPercent,
          total,
          date: localIsoToday(),
          timestamp: Date.now(),
          status: isAllCredit ? 'pending' : (hasCredit ? 'partial' : 'paid'),
          paymentMethod: paymentCheck.info.method,
          paymentParts: paymentCheck.info.parts,
          cashPaid: paymentCheck.info.cashPaid,
          received: paymentCheck.info.received,
          change: paymentCheck.info.change,
          notes: hasCredit ? (notes ? `${notes} (متبقي ${paymentCheck.info.creditPaid} على الحساب)` : `متبقي ${paymentCheck.info.creditPaid} ج.م على الحساب`) : notes,
          staffId: selectedStaffId,
          staffName: selectedStaff?.name
      };
      
      addInvoice(invoiceData as any);
      localStorage.removeItem(DRAFT_KEY);
      // Hack to get the ID just generated (length + 1)
      setCreatedInvoice({ ...invoiceData, id: state.invoices.length + 1, printSnapshot: buildPrintIdentity(state.settings) });
      setShowPreview(true);
      setPointsRedeemed(0); // Reset after save
  };

  if (showPreview && createdInvoice) {
      return (
        <div className="animate-fade-in space-y-4 max-w-xl mx-auto py-4">
             <InvoiceReceipt invoice={createdInvoice} />
             <div className="no-print flex gap-4 justify-end">
                 <PrintActions invoice={createdInvoice} />
                 <Button onClick={onClose} variant="secondary">{t('back')}</Button>
             </div>
        </div>
      );
  }

  const clearInvoice = () => {
        if (confirm(t('confirm_delete') || (language === 'ar' ? 'هل أنت متأكد من مسح الفاتورة الحالية؟' : 'Clear current invoice?'))) {
            setSelectedItems([]);
            setCustomerName('');
            setPhone('');
            setCustomerIdInput('');
            setNotes('');
            setSelectedStaffId('');
            setDiscountPercent(0);
            setDiscountFixedAmount(0);
            setDiscountReason('خصم عام');
            setCustomDiscountReason('');
            setDiscountType('percentage');
            setTaxPercent(0);
            localStorage.removeItem(DRAFT_KEY);
        }
    };

    return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full relative">
        <div className="lg:col-span-2 space-y-6">
             {!isMain && (
                 <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-3 text-xs font-bold animate-fade-in shadow-xs">
                     <div className="flex items-center gap-2.5">
                         <AlertCircle size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
                         <div>
                             <span className="font-extrabold text-sm">{language === 'ar' ? 'هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير' : 'This is not the main branch. Please be careful to avoid invoice conflicts.'}</span>
                             <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                 {language === 'ar' ? `الفرع المفعّل حالياً: «${activeBranch?.name}»` : `Current active branch: "${activeBranch?.name}"`}
                             </span>
                         </div>
                     </div>
                     <span className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-semibold shrink-0">
                         {language === 'ar' ? 'الطباعة تتطلب تأكيد المدير' : 'Manager Auth Required for Print'}
                     </span>
                 </div>
             )}
             <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Users size={20} /> {t('customer_name')}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setCustomerName('عميل نقدي');
                                setPhone('01000000000');
                                setCustomerIdInput('');
                                setShowCustomerDropdown(false);
                            }}
                            className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors font-medium"
                            title={language === 'ar' ? 'تعبئة سريعة لعميل نقدي عابر' : 'Quick Cash Customer'}
                        >
                            <span>{language === 'ar' ? 'عميل نقدي' : 'Cash Client'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsQuickAddingCustomer(true)}
                            className="flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 px-3 py-1.5 rounded-lg border border-primary-200 dark:border-primary-700 transition-colors font-medium"
                        >
                            <Plus size={14}/> {language === 'ar' ? 'عميل جديد' : 'New Client'}
                        </button>
                        {state.heldInvoices.length > 0 && (
                            <button onClick={() => setShowHeldInvoices(true)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors font-bold ">
                                <PauseCircle size={14}/> {state.heldInvoices.length} {t('held')}
                            </button>
                        )}
                    </div>
                </div>
                <div ref={customerDropdownRef} className="relative">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input 
                            containerClassName="mb-0"
                            label={t('customer_id')}
                            value={customerIdInput}
                            onChange={(e: any) => setCustomerIdInput(e.target.value)}
                            placeholder={t('ph_invoice_id')}
                            autoComplete="off"
                            data-lpignore="true"
                        />
                        <Input 
                            containerClassName="mb-0"
                            label={t('phone')} 
                            value={phone} 
                            autoComplete="off"
                            data-lpignore="true"
                            onChange={(e: any) => {
                                setPhone(e.target.value);
                                setShowCustomerDropdown(true);
                            }} 
                            onFocus={() => setShowCustomerDropdown(true)}
                            placeholder={t('ph_phone')} 
                            validationRegex={/^01\d{9}$/}
                            error={t('invalid_phone_format')}
                            onEnter={() => {
                                setShowCustomerDropdown(false);
                                document.getElementById('customerNameInput')?.focus();
                            }}
                            endAdornment={
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowCustomerDropdown(prev => !prev);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors rounded-lg flex items-center justify-center cursor-pointer"
                                    title={language === 'ar' ? 'عرض قائمة العملاء' : 'Show customers'}
                                >
                                    <ChevronDown size={18} className={`transition-transform duration-200 ${showCustomerDropdown ? 'rotate-180 text-primary-600' : ''}`} />
                                </button>
                            }
                        />
                        <Input 
                            containerClassName="mb-0"
                            id="customerNameInput"
                            label={t('customer_name')} 
                            value={customerName} 
                            onChange={(e: any) => setCustomerName(e.target.value)} 
                            placeholder={t('customer_name')} 
                            validationRegex={/^.{2,}$/}
                            error={t('invalid_name_format')}
                            autoComplete="off"
                            data-lpignore="true"
                        />
                    </div>

                    {/* قائمة العملاء المنسدلة - تمتد بكامل عرض الحقول الثلاثة مع ظل ناعم */}
                    {showCustomerDropdown && (
                        <div className="absolute top-full mt-2 inset-x-0 z-[60] bg-white dark:bg-slate-800 border-2 border-primary-500/40 dark:border-primary-500/50 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-scale-in">
                            {filteredCustomerSuggestions.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-400">
                                    {language === 'ar' ? 'لا يوجد عميل مطابق للبحث' : 'No matching customers'}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                    {filteredCustomerSuggestions.map(c => (
                                        <div
                                            key={c.id}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setPhone(c.phone);
                                                setCustomerName(c.name);
                                                setCustomerIdInput(String(c.id));
                                                setShowCustomerDropdown(false);
                                            }}
                                            className="p-3.5 px-4 hover:bg-primary-50/80 dark:hover:bg-primary-950/60 cursor-pointer flex justify-between items-center transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-sky-400 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                                    {c.name ? c.name.charAt(0).toUpperCase() : '#'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                        {c.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{c.phone}</span>
                                                        <span className="opacity-40">•</span>
                                                        <span>كود: #{c.id}</span>

                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {(c.balance || 0) > 0 && (
                                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300/40">
                                                        مدين: {Number(c.balance).toLocaleString('en-US')} ج.م
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {language === 'ar' ? 'اختيار ↵' : 'Select ↵'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {existingCustomer && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                             <div className="bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 p-2 rounded-xl border border-primary-200/50 dark:border-primary-800/50"><Award size={18}/></div>
                             <div>
                                 <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                     <span>{language === 'ar' ? 'الرصيد المستحق (المديونية):' : 'Debt:'}</span>
                                     <span className={`font-black ${((existingCustomer.balance || 0) > 0) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                         {Number(existingCustomer.balance || 0).toLocaleString('en-US')} {t('egp')}
                                     </span>

                                 </p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">{t('last_visit')}: {formatDate(new Date(existingCustomer.lastVisit))}</p>
                             </div>
                        </div>

                    </div>
                )}
             </Card>
             <Card className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold flex items-center gap-2"><Package size={20} className="text-primary-500" /> {t('items')}</h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 font-mono">
                            {displayedItems.length} {language === 'ar' ? 'عنصر' : 'items'}
                        </span>
                    </div>
                    <div className="relative w-full sm:w-72 md:w-80">
                        <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`} size={16} />
                        <input
                            type="text"
                            placeholder={language === 'ar' ? 'بحث بالاسم أو الباركود (Enter للإضافة)...' : 'Search name or barcode (Enter to add)...'}
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const raw = itemSearch.trim();
                                    if (!raw) return;
                                    const q = raw.toLowerCase();
                                    const normalizedQ = normalizeBarcode(raw).toLowerCase();
                                    const exactMatch = state.items.find(i => 
                                        (i.barcode && normalizeBarcode(i.barcode).toLowerCase() === normalizedQ) ||
                                        (i.sku && normalizeBarcode(i.sku).toLowerCase() === normalizedQ) ||
                                        (i.nameAr && i.nameAr.toLowerCase() === q) ||
                                        (i.nameEn && i.nameEn.toLowerCase() === q)
                                    ) || (displayedItems.length === 1 ? displayedItems[0] : null);

                                    if (exactMatch) {
                                        playBeep();
                                        addToInvoice(exactMatch);
                                        setItemSearch('');
                                        addToast(`${language === 'ar' ? exactMatch.nameAr : exactMatch.nameEn} +1`, 'success');
                                    }
                                }
                            }}
                            className={`w-full ${language === 'ar' ? 'pr-9 pl-9' : 'pl-9 pr-9'} py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600/80 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-xs`}
                        />
                        {itemSearch && (
                            <button
                                type="button"
                                onClick={() => setItemSearch('')}
                                className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700`}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                            selectedCategory === 'all' 
                                ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20' 
                                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <span>{t('all')}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                            {itemCounts.total}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('services')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                            selectedCategory === 'services' 
                                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/20' 
                                : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                        }`}
                    >
                        <Scissors size={12} />
                        <span>{t('services')}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedCategory === 'services' ? 'bg-white/20 text-white' : 'bg-purple-200/70 dark:bg-purple-800 text-purple-700 dark:text-purple-300'}`}>
                            {itemCounts.services}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('products')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                            selectedCategory === 'products' 
                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20' 
                                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                        }`}
                    >
                        <Package size={12} />
                        <span>{t('products')}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedCategory === 'products' ? 'bg-white/20 text-white' : 'bg-blue-200/70 dark:bg-blue-800 text-blue-700 dark:text-blue-300'}`}>
                            {itemCounts.products}
                        </span>
                    </button>
                    {state.categories.map(cat => {
                        const countInCat = state.items.filter(i => i.categoryId === cat.id).length;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                                    selectedCategory === cat.id 
                                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' 
                                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                <span>{language === 'ar' ? cat.nameAr : cat.nameEn}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedCategory === cat.id ? 'bg-white/20 dark:bg-slate-900/20 text-current' : 'bg-slate-200/70 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                                    {countInCat}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Items Grid with Modern Touch-friendly Cards - Exactly 3 items per row, larger size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3.5 max-h-[520px] overflow-y-auto p-1.5 custom-scrollbar">
                    {displayedItems.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                                <Package size={24} />
                            </div>
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('no_items')}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {itemSearch 
                                    ? (language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No items match your search')
                                    : (language === 'ar' ? 'لا توجد عناصر مسجلة في هذا القسم' : 'No items found in this section')}
                            </p>
                        </div>
                    ) : (
                        displayedItems.map((item) => {
                            const isService = item.type === 'service';
                            const isOutOfStock = !isService && item.trackStock && item.quantity <= 0;
                            const isLowStock = !isService && item.trackStock && item.quantity > 0 && item.quantity <= (item.alertThreshold || 3);
                            const inCartQty = selectedItems.find(i => i.item.id === item.id)?.qty || 0;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => addToInvoice(item)}
                                    className={`group relative flex flex-col justify-between p-4 rounded-2xl border text-right transition-all duration-200 select-none min-h-[148px] cursor-pointer ${
                                        isOutOfStock 
                                            ? 'opacity-55 cursor-not-allowed bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40' 
                                            : inCartQty > 0
                                            ? 'bg-primary-50/60 dark:bg-primary-950/30 border-primary-500 dark:border-primary-500 shadow-lg ring-2 ring-primary-500/25 hover:shadow-xl active:scale-[0.98]'
                                            : 'bg-white dark:bg-slate-800/95 border-slate-200/90 dark:border-slate-700/80 hover:border-primary-500/70 dark:hover:border-primary-500/70 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]'
                                    }`}
                                >
                                    {/* شارة عدد العناصر الموجودة بالفاتورة الحالية */}
                                    {inCartQty > 0 && (
                                        <span className="absolute -top-2.5 -left-2.5 z-20 flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-primary-600 text-white font-black text-xs shadow-lg border-2 border-white dark:border-slate-800 animate-scale-in">
                                            {inCartQty}×
                                        </span>
                                    )}

                                    {/* الصف العلوي: النوع والمخزون */}
                                    <div className="w-full flex items-center justify-between gap-1.5 mb-2.5">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                                            isService 
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60' 
                                                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60'
                                        }`}>
                                            {isService ? <Scissors size={12} className="shrink-0" /> : <Package size={12} className="shrink-0" />}
                                            <span>{isService ? t('service') : t('product')}</span>
                                        </span>

                                        {item.trackStock ? (
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl ${
                                                isOutOfStock 
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-900' 
                                                    : isLowStock 
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800' 
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                                            }`}>
                                                {isOutOfStock ? (
                                                    <span>{language === 'ar' ? 'نفد' : 'Out'}</span>
                                                ) : (
                                                    <>
                                                        <span className="text-[11px] text-slate-400 font-normal">{language === 'ar' ? 'متاح:' : 'Qty:'}</span>
                                                        <span className="font-mono font-black">{item.quantity}</span>
                                                    </>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-purple-500/80 dark:text-purple-400/80 font-semibold">
                                                {isService ? (language === 'ar' ? 'خدمة فورية' : 'Service') : ''}
                                            </span>
                                        )}
                                    </div>

                                    {/* اسم العنصر بحجم أكبر وأوضح */}
                                    <div className="w-full text-right mb-3 flex-1 flex items-center">
                                        <div className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                            {language === 'ar' ? item.nameAr : (item.nameEn || item.nameAr)}
                                        </div>
                                    </div>

                                    {/* الصف السفلي: السعر وزر الإضافة بحجم أكبر */}
                                    <div className="w-full pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                                                {formatNumber(item.price)}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                {t('egp')}
                                            </span>
                                        </div>

                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-xs group-hover:scale-110">
                                            <Plus size={16} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
             </Card>
             <Card>
                <h3 className="text-lg font-bold mb-4">{t('billing')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{language === 'ar' ? 'نوع وقيمة الخصم' : 'Discount'}</span>
                                {discountAmount > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20">
                                        -{discountAmount.toLocaleString('en-US')} ج.م
                                    </span>
                                )}
                            </label>
                            {/* زر التبديل بين نوع الخصم: نسبة مئوية % أو مبلغ ثابت ج.م */}
                            <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setDiscountType('percentage')}
                                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${discountType === 'percentage' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                                >
                                    % نسبة
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDiscountType('fixed')}
                                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${discountType === 'fixed' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                                >
                                    ج.م مبلغ ثابت
                                </button>
                            </div>
                        </div>

                        {/* تحديد تصنيف / نوع الخصم */}
                        <div>
                            <span className="text-[10px] text-slate-400 block mb-1 font-semibold">{language === 'ar' ? 'تصنيف الخصم:' : 'Discount Type:'}</span>
                            <select
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-medium outline-none focus:border-primary-500"
                            >
                                <option value="خصم عام">خصم عام</option>
                                <option value="خصم عميل VIP">خصم عميل VIP / مميز</option>
                                <option value="خصم عرض ترويجي">خصم عرض ترويجي / موسم</option>
                                <option value="خصم موظفين وأقارب">خصم موظفين وأقارب</option>
                                <option value="خصم خاص / تعويض">خصم خاص / تعويض</option>
                                <option value="أخرى">نوع آخر (مخصص)...</option>
                            </select>
                        </div>

                        {discountReason === 'أخرى' && (
                            <input
                                type="text"
                                placeholder={language === 'ar' ? 'اكتب نوع أو سبب الخصم...' : 'Enter discount reason...'}
                                value={customDiscountReason}
                                onChange={(e) => setCustomDiscountReason(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-medium outline-none focus:border-primary-500"
                            />
                        )}

                        {/* إدخال قيمة الخصم حسب النوع المحدد */}
                        {discountType === 'percentage' ? (
                            <div>
                                <Input
                                    label={language === 'ar' ? 'نسبة الخصم (%)' : 'Discount (%)'}
                                    type="number"
                                    value={discountPercent}
                                    onChange={(e: any) => setDiscountPercent(parseFloat(e.target.value || 0))}
                                />
                                <div className="flex items-center gap-1 -mt-2 mb-1 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-semibold">{language === 'ar' ? 'سريع:' : 'Quick:'}</span>
                                    {[0, 5, 10, 15, 20, 25, 50].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setDiscountPercent(p)}
                                            className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${discountPercent === p ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {p}%
                                        </button>
                                    ))}
                                </div>
                                {discountPercent > 0 && subtotal > 0 && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                        = خصم {discountAmount.toLocaleString('en-US')} ج.م من الإجمالي
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <Input
                                    label={language === 'ar' ? 'قيمة الخصم (ج.م)' : 'Discount Amount (EGP)'}
                                    type="number"
                                    value={discountFixedAmount}
                                    onChange={(e: any) => setDiscountFixedAmount(parseFloat(e.target.value || 0))}
                                />
                                <div className="flex items-center gap-1 -mt-2 mb-1 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-semibold">{language === 'ar' ? 'سريع:' : 'Quick:'}</span>
                                    {[0, 10, 20, 50, 100, 200].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setDiscountFixedAmount(amt)}
                                            className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${discountFixedAmount === amt ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {amt} ج.م
                                        </button>
                                    ))}
                                </div>
                                {discountFixedAmount > 0 && subtotal > 0 && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                        = خصم {effectiveDiscountPercent}% من الإجمالي
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <Input label={t('tax_percent')} type="number" value={taxPercent} onChange={(e:any)=>setTaxPercent(parseFloat(e.target.value || 0))} />
                    <div className="flex flex-col justify-end gap-2">
                        <div className="text-sm text-slate-600 dark:text-slate-300">{t('subtotal')}: <span className="font-bold">{subtotal.toLocaleString('en-US')} {t('egp')}</span></div>
                        {existingCustomer && (existingCustomer.balance || 0) > 0 && (
                            <div className="flex flex-col items-end gap-0.5">
                                <div className="text-xs text-rose-500 font-bold">
                                    {language === 'ar' ? 'مديونية سابقة:' : 'Prev Debt:'} {Number(existingCustomer.balance).toLocaleString('en-US')} ج.م
                                </div>
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
                         {state.staff.filter(s => s.active).map(s => {
                             const commText = Number(s.commissionValue) > 0 
                                 ? (s.commissionType === 'fixed' ? ` [عمولة: ${s.commissionValue} ج.م]` : ` [عمولة: ${s.commissionValue}%]`)
                                 : '';
                             return (
                                 <option key={s.id} value={s.id}>
                                     {s.name}{commText}
                                 </option>
                             );
                         })}
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
                <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{t('invoice')} #{state.invoices.length + 1}</span>
                        </h3>
                        {selectedItems.length > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 font-bold border border-primary-200 dark:border-primary-800 font-mono">
                                {selectedItems.reduce((acc: number, cur: any) => acc + (cur.qty || 1), 0)} {language === 'ar' ? 'عنصر' : 'items'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                         {selectedItems.length > 0 && (
                             <button 
                                 type="button" 
                                 onClick={clearInvoice} 
                                 className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg transition-colors font-bold flex items-center gap-1 cursor-pointer"
                             >
                                 <Trash2 size={12} />
                                 <span>{t('clear')}</span>
                             </button>
                         )}
                         <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5" title={language === 'ar' ? 'ساعة وتاريخ النظام متزامنة مع الكمبيوتر' : 'Synced with system clock'}>
                            <Clock size={12} className="text-slate-400" />
                            <span>{formatDateTime(new Date())}</span>
                        </span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1.5 min-h-[180px]">
                    {selectedItems.length === 0 ? (
                        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center py-10 text-slate-400">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-2">
                                <Package size={26} className="opacity-50" />
                            </div>
                            <p className="font-bold text-sm text-slate-600 dark:text-slate-300">{t('no_items')}</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                                {language === 'ar' ? 'اختر العناصر من القائمة لإضافتها إلى الفاتورة' : 'Select items to add to this invoice'}
                            </p>
                        </div>
                    ) : (
                        selectedItems.map((item: any) => {
                            const isService = item.item.type === 'service';
                            return (
                                <div 
                                    key={item.item.id} 
                                    className={`relative p-2.5 rounded-xl border bg-white dark:bg-slate-800/95 transition-all duration-150 shadow-2xs hover:shadow-xs ${
                                        isService 
                                            ? 'border-slate-200 dark:border-slate-700/80 border-r-4 border-r-purple-500' 
                                            : 'border-slate-200 dark:border-slate-700/80 border-r-4 border-r-sky-500'
                                    }`}
                                >
                                    {/* السطر العلوي: الأيقونة + اسم العنصر + زر الحذف */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                                isService 
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' 
                                                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                                            }`}>
                                                {isService ? <Scissors size={12} /> : <Package size={12} />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-[13px] truncate leading-tight">
                                                    {language === 'ar' ? item.item.nameAr : item.item.nameEn}
                                                </h4>
                                            </div>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeFromInvoice(item.item.id)} 
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                                            title={t('delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* السطر السفلي: أزرار التحكم في الكمية + السعر الإجمالي */}
                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-1.5">
                                            {/* Stepper متناسق وأنيق */}
                                            <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-700/60 p-0.5 border border-slate-200 dark:border-slate-600">
                                                <button
                                                    type="button"
                                                    onClick={() => updateItemQuantity(item.item.id, -1)}
                                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 font-bold text-xs transition-colors cursor-pointer active:scale-95"
                                                    title={language === 'ar' ? 'تقليل الكمية' : 'Decrease'}
                                                >
                                                    -
                                                </button>
                                                <span className="min-w-[24px] px-1 text-center font-bold font-mono text-xs text-slate-900 dark:text-slate-100 tabular-nums">
                                                    {item.qty}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateItemQuantity(item.item.id, 1)}
                                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 font-bold text-xs transition-colors cursor-pointer active:scale-95"
                                                    title={language === 'ar' ? 'زيادة الكمية' : 'Increase'}
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <span className="text-[11px] text-slate-400 font-medium">
                                                × <span className="font-mono">{formatNumber(item.item.price)}</span>
                                            </span>
                                        </div>

                                        {/* الإجمالي للعنصر */}
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">
                                                {formatNumber(item.qty * item.item.price)}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                {t('egp')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700/80 pt-4 space-y-3.5">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-primary-500/10 border border-emerald-400/30 dark:border-emerald-600/30 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('total')}</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                                {total.toLocaleString('en-US')}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {t('egp')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="relative">
                             <Button 
                                 type="button" 
                                 onClick={handleHold} 
                                 variant="secondary" 
                                 className="px-3.5 py-3 cursor-pointer relative rounded-xl border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 active:scale-95 transition-all" 
                                 title={language === 'ar' ? 'تعليق الفاتورة أو فتح المعلقة (⏸️)' : 'Hold Invoice or View Held (⏸️)'}
                             >
                                 <PauseCircle size={20}/>
                                 {state.heldInvoices.length > 0 && (
                                     <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-pulse">
                                         {state.heldInvoices.length}
                                     </span>
                                 )}
                             </Button>
                         </div>
                         <Button 
                             onClick={handleSave} 
                             className="flex-1 justify-center py-3 font-black text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all"
                         >
                             {t('save')}
                         </Button>
                         <Button 
                             onClick={onClose} 
                             variant="danger" 
                             className="px-3.5 py-3 rounded-xl active:scale-95 transition-all"
                             title={t('clear_all')}
                         >
                             <Trash2 size={20}/>
                         </Button>
                    </div>
                </div>
            </Card>
        </div>

        {/* Payment Modal — سداد الفاتورة (نقدي / انستا / محفظة / على الحساب) */}
        {showPaymentModal && (
            <ModalShell
                title={language === 'ar' ? 'سداد وقيد الفاتورة' : t('payment_details')}
                onClose={() => setShowPaymentModal(false)}
                maxWidth="max-w-xl"
            >
                {/* إجمالي الفاتورة المطلوب */}
                <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4 text-center">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        {language === 'ar' ? 'إجمالي المبلغ المطلوب سداده' : t('total')}
                    </span>
                    <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                        {round2(total).toLocaleString('en-US')} <span className="text-lg font-bold">{t('egp')}</span>
                    </span>
                </div>

                {/* أزرار السداد السريع بالكامل بنقرة واحدة */}
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">
                        {language === 'ar' ? '⚡ سداد فوري بالكامل بنقرة واحدة:' : 'Quick Full Payment:'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={() => payAllWith('cash')}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 cursor-pointer"
                        >
                            <Banknote size={15} className="text-slate-600 dark:text-slate-400" />
                            <span>{language === 'ar' ? 'كاش بالكامل' : 'Full Cash'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => payAllWith('card')}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 cursor-pointer"
                        >
                            <CreditCard size={15} className="text-slate-600 dark:text-slate-400" />
                            <span>{language === 'ar' ? 'انستا بالكامل' : 'Full Insta'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => payAllWith('wallet')}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 cursor-pointer"
                        >
                            <Smartphone size={15} className="text-slate-600 dark:text-slate-400" />
                            <span>{language === 'ar' ? 'محفظة' : 'Full Wallet'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => payAllWith('credit')}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 cursor-pointer"
                        >
                            <FileText size={15} className="text-slate-600 dark:text-slate-400" />
                            <span>{language === 'ar' ? 'على الحساب' : 'On Account'}</span>
                        </button>
                    </div>
                </div>

                {/* تقسيم الدفع (كاش، انستا، محفظة، على الحساب) */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {language === 'ar' ? 'تقسيم الدفع أو سداد جزء نقدي والباقي على الحساب:' : 'Split / Partial Payment:'}
                        </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* نقدي */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Banknote size={13} className="text-slate-500" /> {language === 'ar' ? 'نقدي (كاش)' : 'Cash'}
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={partCash}
                                onChange={(e) => {
                                    setPartCash(e.target.value);
                                    if (!cashReceived || parseFloat(cashReceived) < parseFloat(e.target.value || '0')) {
                                        setCashReceived(e.target.value);
                                    }
                                }}
                                className="w-full px-2 py-1.5 text-center font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-slate-500"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => fillRest('cash')}
                                className="w-full mt-1.5 text-[11px] font-bold py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'الباقي كاش' : 'Rest Cash'}
                            </button>
                        </div>

                        {/* انستا */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <CreditCard size={13} className="text-slate-500" /> {language === 'ar' ? 'انستا' : 'InstaPay'}
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={partCard}
                                onChange={(e) => setPartCard(e.target.value)}
                                className="w-full px-2 py-1.5 text-center font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-slate-500"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => fillRest('card')}
                                className="w-full mt-1.5 text-[11px] font-bold py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'الباقي انستا' : 'Rest Insta'}
                            </button>
                        </div>

                        {/* محفظة */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <Smartphone size={13} className="text-slate-500" /> {language === 'ar' ? 'محفظة' : 'Wallet'}
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={partWallet}
                                onChange={(e) => setPartWallet(e.target.value)}
                                className="w-full px-2 py-1.5 text-center font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-slate-500"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => fillRest('wallet')}
                                className="w-full mt-1.5 text-[11px] font-bold py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'الباقي محفظة' : 'Rest Wallet'}
                            </button>
                        </div>

                        {/* على الحساب */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 bg-slate-50/60 dark:bg-slate-900/60">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <FileText size={13} className="text-slate-500" /> {language === 'ar' ? 'على الحساب' : 'On Account'}
                                </span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={partCredit}
                                onChange={(e) => setPartCredit(e.target.value)}
                                className="w-full px-2 py-1.5 text-center font-bold text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-slate-500 text-slate-800 dark:text-slate-100"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => fillRest('credit')}
                                className="w-full mt-1.5 text-[11px] font-bold py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'الباقي على الحساب' : 'Rest on Account'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* تفاصيل المديونية إذا كان هناك جزء على الحساب */}
                {num(partCredit) > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 mb-3 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{language === 'ar' ? 'حساب العميل:' : 'Customer Account:'}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{customerName || (language === 'ar' ? 'يرجى كتابة اسم العميل' : 'Unspecified')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'المديونية السابقة:' : 'Prior Debt:'}</span>
                            <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                                {Number(existingCustomer?.balance || 0).toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{language === 'ar' ? 'المبلغ المضاف على الحساب:' : 'Added to Account:'}</span>
                            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                                +{num(partCredit).toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold pt-1.5 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-slate-800 dark:text-slate-200">{language === 'ar' ? 'إجمالي المديونية الجديدة:' : 'New Balance:'}</span>
                            <span className="font-black font-mono text-sm text-slate-900 dark:text-slate-100">
                                {((existingCustomer?.balance || 0) + num(partCredit)).toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                    </div>
                )}

                {/* النقد المستلم وحاسبة الباقي (إذا كان هناك جزء كاش) */}
                {draftCashPart > 0 && (
                    <div className="bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mb-3 animate-fade-in">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{language === 'ar' ? 'المبلغ المطلوب سداده نقداً (كاش):' : t('cash_for_invoice')}:</span>
                            <span className="font-black text-slate-900 dark:text-white font-mono">{draftCashPart.toLocaleString('en-US')} {t('egp')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('cash_received')}:</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(e.target.value)}
                                className="flex-1 px-3 py-2 text-center font-bold text-base rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-slate-500"
                                placeholder="0.00"
                            />
                            <button
                                type="button"
                                onClick={() => setCashReceived(String(draftCashPart))}
                                className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                            >
                                {t('exact_amount')}
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[11px] text-slate-500 font-medium">{language === 'ar' ? 'فئات سريعة:' : 'Quick:'}</span>
                            {[50, 100, 200, 500].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setCashReceived(String(val))}
                                    className="px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                >
                                    {val} {t('egp')}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* الملخص المالي للفاتورة */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-xs mb-4 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">{t('paid_total')}</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{round2(paymentCheck.info.total).toLocaleString('en-US')} {t('egp')}</span>
                    </div>
                    <div className={`flex justify-between px-3 py-2 ${paymentRemaining !== 0 ? 'bg-amber-500/10 text-amber-400 font-bold' : ''}`}>
                        <span>{t('payment_remaining')}</span>
                        <span className="font-mono">{paymentRemaining.toLocaleString('en-US')} {t('egp')}</span>
                    </div>
                    {draftCashPart > 0 && (
                        <div className="flex justify-between px-3 py-2">
                            <span className="text-slate-500">{t('change_due')}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{paymentChange.toLocaleString('en-US')} {t('egp')}</span>
                        </div>
                    )}
                    <div className="flex justify-between px-3 py-2">
                        <span className="text-slate-500">{t('drawer_increase')}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">+{paymentCheck.info.cashPaid.toLocaleString('en-US')} {t('egp')}</span>
                    </div>
                </div>

                {!paymentCheck.ok && (
                    <p className="text-xs font-bold text-rose-500 text-center mb-3">{t(paymentCheck.error!)}</p>
                )}

                <div className="flex gap-3">
                    <Button 
                        variant="success" 
                        onClick={confirmSave} 
                        disabled={!paymentCheck.ok || (num(partCredit) > 0 && (!customerName.trim() || customerName.trim() === 'عميل نقدي'))} 
                        className="flex-1 justify-center py-3 text-base font-bold shadow-md"
                    >
                        {language === 'ar' ? 'تأكيد وإصدار الفاتورة' : t('confirm')}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowPaymentModal(false)} className="flex-1 justify-center py-3 text-base">{t('cancel')}</Button>
                </div>
            </ModalShell>
        )}

        {/* Hold Invoice Prompt Modal — نافذة تعليق الفاتورة التفاعلية بدون alert/prompt المتصفح */}
        {showHoldPromptModal && (
            <ModalShell
                title={language === 'ar' ? 'تعليق الفاتورة الحالية' : 'Hold Current Invoice'}
                onClose={() => setShowHoldPromptModal(false)}
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                            {language === 'ar' 
                                ? `سيتم حفظ أصناف السلة الحالية (${selectedItems.length} صنف بقيمة ${formatNumber(total)} ج.م) مؤقتاً لتتمكن من خدمة عميل آخر والرجوع لها في أي وقت.`
                                : `This cart (${selectedItems.length} items, ${formatNumber(total)} EGP) will be suspended so you can serve another customer.`}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            {language === 'ar' ? 'تسمية الطلب / رقم الطاولة / ملاحظة:' : 'Order name, table or note:'}
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={holdNoteInput}
                            onChange={(e) => setHoldNoteInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    confirmHoldInvoice();
                                }
                            }}
                            placeholder={language === 'ar' ? 'مثال: طاولة 4، سفري، أحمد...' : 'e.g. Table 4, Takeaway...'}
                            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
                        />
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            language === 'ar' ? 'طاولة 1' : 'Table 1',
                            language === 'ar' ? 'طاولة 2' : 'Table 2',
                            language === 'ar' ? 'طاولة 3' : 'Table 3',
                            language === 'ar' ? 'طلب سفري' : 'Takeaway',
                            language === 'ar' ? 'عميل صالون' : 'Salon',
                            language === 'ar' ? 'طلب خارجي' : 'External'
                        ].map(chip => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => setHoldNoteInput(chip)}
                                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2.5 pt-2">
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => confirmHoldInvoice()}
                            className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm cursor-pointer"
                        >
                            {language === 'ar' ? 'تأكيد تعليق الفاتورة' : 'Confirm Hold'}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowHoldPromptModal(false)}
                            className="py-2.5 text-sm cursor-pointer"
                        >
                            {t('cancel')}
                        </Button>
                    </div>
                </div>
            </ModalShell>
        )}

        {/* Held Invoices Modal */}
        {showHeldInvoices && (
            <ModalShell
                title={language === 'ar' ? `الفواتير المعلقة (${state.heldInvoices.length})` : `Held Invoices (${state.heldInvoices.length})`}
                onClose={() => setShowHeldInvoices(false)}
                maxWidth="max-w-3xl"
            >
                <div className="space-y-4">
                    {selectedItems.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                                {language === 'ar' ? 'لديك أصناف حالية في السلة، هل ترغب في تعليقها لخدمة عميل آخر؟' : 'You have active cart items, hold them now?'}
                            </span>
                            <button
                                type="button"
                                onClick={() => { setShowHeldInvoices(false); handleHold(); }}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                            >
                                ⏸️ {language === 'ar' ? 'تعليق السلة الحالية' : 'Hold Current Cart'}
                            </button>
                        </div>
                    )}

                    {state.heldInvoices.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs">
                            <PauseCircle size={36} className="mx-auto mb-2 opacity-40 text-amber-500" />
                            <p className="font-bold">{language === 'ar' ? 'لا توجد أي فواتير معلقة حالياً.' : 'No held invoices.'}</p>
                            <p className="mt-1 text-slate-500">{language === 'ar' ? 'يمكنك تعليق أي فاتورة في أي وقت بالضغط على زر ⏸️ أسفل السلة.' : 'You can hold any cart by clicking ⏸️ below.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
                            {state.heldInvoices.map((inv, idx) => (
                                <div key={inv.id || idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-xs flex flex-col justify-between hover:border-primary-500/60 transition-all space-y-3">
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                                <span className="text-amber-500">⏸️</span>
                                                <span>{inv.customerName || (language === 'ar' ? 'طلب معلق' : 'Held Order')}</span>
                                            </h4>
                                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {inv.total?.toLocaleString('en-US')} {t('egp')}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mb-2">
                                            <Clock size={12} />
                                            <span>{formatDateTime(inv.timestamp)}</span>
                                            <span>•</span>
                                            <span>{inv.items?.length || 0} {t('items')}</span>
                                        </p>

                                        <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 max-h-20 overflow-y-auto space-y-0.5">
                                            {(inv.items || []).map((it: any, i: number) => (
                                                <div key={i} className="flex justify-between text-[11px]">
                                                    <span className="truncate">{it.name}</span>
                                                    <span className="font-mono font-bold text-slate-400">×{it.quantity}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {inv.notes && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 italic truncate">
                                                {inv.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                        <button
                                            type="button"
                                            onClick={() => handleRestore(inv)}
                                            className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                        >
                                            <span>▶️</span>
                                            <span>{language === 'ar' ? 'استرجاع للبيع' : 'Resume Order'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة المعلقة؟' : 'Delete this held invoice?')) {
                                                    deleteHeldInvoice(inv.id);
                                                }
                                            }}
                                            className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs cursor-pointer transition-colors"
                                            title={t('delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ModalShell>
        )}

        {/* Quick Add Service Modal */}
        {isQuickAddingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users size={18} className="text-primary-500" />
                {language === 'ar' ? 'إضافة عميل سريع' : 'Quick Add Client'}
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickAddingCustomer(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            {(() => {
              const nameParts = (quickCustomerForm.name || '').trim().split(/\s+/).filter(Boolean);
              const isNameValid = nameParts.length >= 3 && nameParts.every(p => p.length >= 2);
              const cleanPhone = (quickCustomerForm.phone || '').replace(/[^\d]/g, '');
              const isPhoneValid = cleanPhone.length === 11 && cleanPhone.startsWith('01');
              return (
                <form onSubmit={handleQuickAddCustomer} className="p-4 space-y-3.5">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === 'ar' ? 'اسم العميل' : 'Client Name'} <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors duration-200 ${
                        isNameValid ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}>
                        {isNameValid ? (
                          <>
                            <Check size={14} className="stroke-[3] text-emerald-500 shrink-0" />
                            <span>{language === 'ar' ? 'اسم ثلاثي مكتمل' : 'Tripartite Name Valid'}</span>
                          </>
                        ) : (
                          <span>{language === 'ar' ? `شرط: اسم ثلاثي (${Math.min(nameParts.length, 3)}/3)` : 'Tripartite required (3 words)'}</span>
                        )}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder={language === 'ar' ? 'اسم العميل ثلاثياً (مثال: محمد أحمد علي)' : 'Full tripartite name'}
                      value={quickCustomerForm.name}
                      onChange={(e) => setQuickCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${
                        isNameValid
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500'
                          : quickCustomerForm.name
                            ? 'border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500'
                      }`}
                      autoFocus
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === 'ar' ? 'رقم الهاتف' : 'Phone'} <span className="text-rose-500">*</span>
                      </label>
                      <span className={`text-[11px] font-mono font-bold flex items-center gap-1 transition-colors duration-200 ${
                        isPhoneValid ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}>
                        {isPhoneValid ? (
                          <>
                            <Check size={14} className="stroke-[3] text-emerald-500 shrink-0" />
                            <span>{language === 'ar' ? 'رقم صحيح (11 رقماً)' : 'Valid (11 digits)'}</span>
                          </>
                        ) : (
                          <span>
                            {language === 'ar' 
                              ? `شرط 11 رقماً ويبدأ بـ 01 (${cleanPhone.length}/11)` 
                              : `11 digits starting with 01 (${cleanPhone.length}/11)`}
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={11}
                      placeholder="01xxxxxxxxx"
                      value={quickCustomerForm.phone}
                      onChange={(e) => {
                        const clean = e.target.value
                          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                          .replace(/[^\d]/g, '')
                          .slice(0, 11);
                        setQuickCustomerForm(prev => ({ ...prev, phone: clean }));
                      }}
                      className={`w-full px-3 py-2 text-sm rounded-xl border outline-none font-mono text-center tracking-wider transition-all ${
                        isPhoneValid
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500'
                          : quickCustomerForm.phone
                            ? 'border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500'
                      }`}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="submit" 
                      variant="primary" 
                      disabled={!isNameValid || !isPhoneValid}
                      className="flex-1 justify-center py-2 text-xs font-bold"
                    >
                      {language === 'ar' ? 'حفظ وإدراج' : 'Save & Select'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setIsQuickAddingCustomer(false)}
                      className="flex-1 justify-center py-2 text-xs"
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

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

