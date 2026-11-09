import { printDebtsListThermal, printCustomerStatementThermal } from '../lib/thermalPrinter';
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, Search, DollarSign, CreditCard, Printer, 
  Check, X, Phone, AlertTriangle, Clock, FileText, 
  Wallet, RefreshCw, ChevronRight, MessageSquare, Plus, 
  Calendar, ArrowUp, ArrowDown, User, Tag, Sparkles, 
  ChevronDown, Filter, Trash2,
  WhatsAppIcon, StatementIcon, CustomEditIcon, CustomTrashIcon, CustomPrinterIcon
} from '../components/Icons';
import { Customer, CustomerPayment } from '../types';
import { Button, ModalShell } from '../components/ui';

export type DebtStatus = 'due' | 'overdue' | 'partial' | 'settled';

const getNowDateTimeLocal = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const DebtsPage: React.FC = () => {
  const { 
    state, t, language, formatNumber, formatDate, 
    formatDateTime, addCustomerPayment, addCustomer, 
    updateCustomer, addInvoice, addToast, currentUser,
    addDrawerMovement
  } = useApp();

  // Currency helper
  const currencySymbol = t('egp') || 'ج.م';

  // ---------------------------------------------------------------------------
  // Filters & Search State
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DebtStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'amount_desc' | 'amount_asc' | 'date_desc' | 'name_asc'>('amount_desc');

  // ---------------------------------------------------------------------------
  // Modals State
  // ---------------------------------------------------------------------------
  // 1. Payment Modal
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | 'instapay'>('cash');
  const [paymentDateTime, setPaymentDateTime] = useState(getNowDateTimeLocal());
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // 2. Profile & Ledger Modal
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);

  // 3. Add Debt Modal (تسجيل بيع آجل / مديونية)
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [debtType, setDebtType] = useState<'invoice' | 'drawer_cash'>('invoice');
  const [newDebtCustomerId, setNewDebtCustomerId] = useState<number | ''>('');
  const [debtCustomerQuery, setDebtCustomerQuery] = useState('');
  const [debtCustomerPhone, setDebtCustomerPhone] = useState('');
  const [showDebtCustomerDropdown, setShowDebtCustomerDropdown] = useState(false);
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [newDebtDescription, setNewDebtDescription] = useState('');
  const [newDebtDate, setNewDebtDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  const handleOpenAddDebtModal = (customer?: Customer) => {
    if (customer) {
      setNewDebtCustomerId(customer.id);
      setDebtCustomerQuery(customer.name);
      setDebtCustomerPhone(customer.phone || '');
    } else {
      setNewDebtCustomerId('');
      setDebtCustomerQuery('');
      setDebtCustomerPhone('');
    }
    setShowDebtCustomerDropdown(false);
    setShowAddDebtModal(true);
  };

  // 4. Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('2000');
  const [newCustInitialBalance, setNewCustInitialBalance] = useState('0');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // تحقق مباشر من شروط العميل الجديد
  const newCustNameParts = (newCustName || '').trim().split(/\s+/).filter(Boolean);
  const isNewCustNameValid = newCustNameParts.length >= 3 && newCustNameParts.every(p => p.length >= 2);
  const cleanNewCustPhone = (newCustPhone || '').replace(/\D/g, '');
  const isNewCustPhoneValid = cleanNewCustPhone.length === 11 && cleanNewCustPhone.startsWith('01');


  // ---------------------------------------------------------------------------
  // Status Determination Function
  // ---------------------------------------------------------------------------
  const getCustomerStatus = (customer: Customer): DebtStatus => {
    const bal = customer.balance || 0;
    const payments = (state.customerPayments || []).filter(p => p.customerId === customer.id);

    if (bal <= 0) {
      return 'settled';
    }
    if (customer.lastVisit) {
      const diff = (Date.now() - new Date(customer.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      if (diff > 30) return 'overdue';
    }
    if (customer.lastVisit) {
      const daysSinceVisit = (Date.now() - new Date(customer.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceVisit > 30) return 'overdue';
    }
    if (payments.length > 0 && bal > 0) {
      return 'partial';
    }
    return 'due';
  };

  const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');

  // قائمة العملاء المطابقين للبحث في نافذة تسجيل المديونية / السحب
  const matchingDebtCustomers = useMemo(() => {
    const q = debtCustomerQuery.trim().toLowerCase();
    const branchCustomers = state.customers.filter(c => {
      return c.locationId === activeLocationId ||
        state.invoices.some(inv => inv.customerId === c.id && String(inv.locationId || '1') === activeLocationId) ||
        (state.customerPayments || []).some(cp => cp.customerId === c.id && (!cp.locationId || String(cp.locationId) === activeLocationId));
    });
    const pool = branchCustomers.length > 0 ? branchCustomers : state.customers;
    if (!q) return pool.slice(0, 8);
    return pool.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    ).slice(0, 10);
  }, [state.customers, state.invoices, state.customerPayments, debtCustomerQuery, activeLocationId]);

  const selectedDebtCustomer = useMemo(() => {
    if (newDebtCustomerId) {
      return state.customers.find(c => c.id === newDebtCustomerId) || null;
    }
    const q = debtCustomerQuery.trim().toLowerCase();
    if (!q) return null;
    return state.customers.find(c => c.name.trim().toLowerCase() === q) || null;
  }, [state.customers, newDebtCustomerId, debtCustomerQuery]);

  const isNewDebtCustomer = useMemo(() => {
    const q = debtCustomerQuery.trim().toLowerCase();
    if (!q) return false;
    return !state.customers.some(c => c.name.trim().toLowerCase() === q);
  }, [state.customers, debtCustomerQuery]);

  // ---------------------------------------------------------------------------
  // Filtered & Sorted Customers (عزل تام حسب الفرع الحالي)
  // ---------------------------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    return state.customers
      .filter(c => {
        const belongsToBranch = c.locationId === activeLocationId || 
          state.invoices.some(inv => inv.customerId === c.id && String(inv.locationId || '1') === activeLocationId) ||
          (state.customerPayments || []).some(cp => cp.customerId === c.id && (!cp.locationId || String(cp.locationId) === activeLocationId));
        return belongsToBranch;
      })
      .filter(c => {
        // Search filter (name, phone, id)
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          String(c.id).includes(q)
        );
      })
      .filter(c => {
        // Status filter
        const status = getCustomerStatus(c);
        if (statusFilter === 'all') {
          // By default, if not searching for settled, show all active debts or all with history
          return (c.balance || 0) > 0 || (state.customerPayments || []).some(p => p.customerId === c.id);
        }
        return status === statusFilter;
      })
      .filter(c => {
        // Period filter (based on lastVisit)
        if (periodFilter === 'all' || !c.lastVisit) return true;
        const visitDate = new Date(c.lastVisit);
        const now = new Date();
        if (periodFilter === 'today') {
          return visitDate.toDateString() === now.toDateString();
        }
        if (periodFilter === 'week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return visitDate >= oneWeekAgo;
        }
        if (periodFilter === 'month') {
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return visitDate >= oneMonthAgo;
        }
        return true;
      })
      .sort((a, b) => {
        const balA = a.balance || 0;
        const balB = b.balance || 0;
        if (sortBy === 'amount_desc') return balB - balA;
        if (sortBy === 'amount_asc') return balA - balB;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'ar');
        if (sortBy === 'date_desc') {
          const timeA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
          const timeB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
          return timeB - timeA;
        }
        return 0;
      });
  }, [state.customers, state.customerPayments, search, statusFilter, periodFilter, sortBy]);

  // ---------------------------------------------------------------------------
  // KPI Summary Statistics
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const allDebtors = state.customers.filter(c => (c.balance || 0) > 0);
    const totalDue = allDebtors.reduce((sum, c) => sum + (c.balance || 0), 0);
    
    // Overdue debts: clients who haven't paid in > 30 days
    const overdueDebtors = allDebtors.filter(c => {
      if (c.lastVisit) {
        const diff = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
        return diff > 30;
      }
      return false;
    });
    const totalOverdue = overdueDebtors.reduce((sum, c) => sum + (c.balance || 0), 0);

    // Total collected
    const totalCollected = (state.customerPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalDue,
      debtorsCount: allDebtors.length,
      totalOverdue,
      overdueCount: overdueDebtors.length,
      totalCollected,
      collectedCount: (state.customerPayments || []).length
    };
  }, [state.customers, state.customerPayments]);

  // ---------------------------------------------------------------------------
  // Customer Ledger Calculation for Profile Modal
  // ---------------------------------------------------------------------------
  const activeCustomerLedger = useMemo(() => {
    if (!profileCustomer) return [];

    interface LedgerEntry {
      id: string;
      date: string;
      timestamp: number;
      type: 'invoice' | 'payment';
      title: string;
      ref: string;
      debit: number;
      credit: number;
      balanceAfter: number;
      method?: string;
      notes?: string;
    }

    const items: { timestamp: number; entry: Omit<LedgerEntry, 'balanceAfter'> }[] = [];

    // Credit Invoices
    (state.invoices || [])
      .filter(inv => inv.customerId === profileCustomer.id && (inv.paymentMethod === 'credit' || (inv.notes && inv.notes.includes('آجل'))))
      .forEach(inv => {
        items.push({
          timestamp: inv.timestamp || Date.parse(inv.date) || 0,
          entry: {
            id: `inv-${inv.id}`,
            date: inv.date,
            timestamp: inv.timestamp || Date.parse(inv.date) || 0,
            type: 'invoice',
            title: 'فاتورة بيع (على الحساب)',
            ref: `#${inv.id}`,
            debit: inv.total,
            credit: 0,
            notes: inv.notes
          }
        });
      });

    // Payments
    (state.customerPayments || [])
      .filter(p => p.customerId === profileCustomer.id)
      .forEach(p => {
        const methodStr = p.paymentMethod === 'cash' ? 'نقدًا' : p.paymentMethod === 'card' ? 'بطاقة' : p.paymentMethod === 'instapay' ? 'إنستا باي' : 'محفظة';
        items.push({
          timestamp: p.timestamp || Date.parse(p.date) || 0,
          entry: {
            id: `pay-${p.id}`,
            date: p.date,
            timestamp: p.timestamp || Date.parse(p.date) || 0,
            type: 'payment',
            title: `سداد دفعة (${methodStr})`,
            ref: p.receiptNumber ? `سند #${p.receiptNumber}` : `إيصال #${p.id.slice(0, 6)}`,
            debit: 0,
            credit: p.amount,
            method: methodStr,
            notes: p.notes
          }
        });
      });

    // Sort ascending to calculate running balance
    items.sort((a, b) => a.timestamp - b.timestamp);

    let running = 0;
    const ledger: LedgerEntry[] = items.map(item => {
      running += (item.entry.debit - item.entry.credit);
      return {
        ...item.entry,
        balanceAfter: Math.max(0, running)
      };
    });

    return ledger.reverse();
  }, [profileCustomer, state.invoices, state.customerPayments]);

  // Total paid by the selected profile customer
  const activeCustomerTotalPaid = useMemo(() => {
    if (!profileCustomer) return 0;
    return (state.customerPayments || [])
      .filter(p => p.customerId === profileCustomer.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [profileCustomer, state.customerPayments]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  // Open payment dialog
  const handleOpenPayment = (customer: Customer) => {
    setPaymentCustomer(customer);
    setPaymentMode('full');
    setPaymentAmount(String(customer.balance || ''));
    setPaymentMethod('cash');
    setPaymentDateTime(getNowDateTimeLocal());
    setPaymentNotes('');
  };

  // Submit payment
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

    const amt = parseFloat(paymentAmount);
    const curBal = paymentCustomer.balance || 0;

    if (isNaN(amt) || amt <= 0) {
      addToast('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر', 'error');
      return;
    }
    if (amt > curBal) {
      addToast(`المبلغ المدخل (${formatNumber(amt)} ${currencySymbol}) يتجاوز المديونية المستحقة (${formatNumber(curBal)} ${currencySymbol})`, 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const dateObj = paymentDateTime ? new Date(paymentDateTime) : new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
      const payTimestamp = dateObj.getTime();

      addCustomerPayment({
        customerId: paymentCustomer.id,
        customerName: paymentCustomer.name,
        amount: amt,
        paymentMethod,
        date: dateStr,
        timestamp: payTimestamp,
        notes: paymentNotes.trim() || undefined,
        recordedBy: currentUser?.username || 'كاشير'
      } as any);

      addToast(`تم تسجيل سداد ${formatNumber(amt)} ${currencySymbol} للعميل ${paymentCustomer.name} بنجاح`, 'success');
      
      // Update profile customer state if open
      if (profileCustomer && profileCustomer.id === paymentCustomer.id) {
        setProfileCustomer({
          ...profileCustomer,
          balance: Math.max(0, curBal - amt)
        });
      }
      setPaymentCustomer(null);
    } catch (err: any) {
      addToast(err?.message || 'تعذر تسجيل السداد، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Submit manual debt (فاتورة لظرف طارئ تسدد لاحقاً أو سحب نقدية من الدرج)
  const handleConfirmAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const queryName = debtCustomerQuery.trim();
    if (!newDebtCustomerId && !queryName) {
      addToast('يرجى إدخال أو اختيار الشخص المستلم / العميل أولاً', 'error');
      return;
    }
    const amt = parseFloat(newDebtAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    let customer = newDebtCustomerId
      ? state.customers.find(c => c.id === newDebtCustomerId)
      : state.customers.find(c => c.name.trim().toLowerCase() === queryName.toLowerCase());

    setIsSubmittingDebt(true);
    try {
      let isNewCustomerRecord = false;
      // لو الشخص غير مسجل مسبقاً، نقوم بتسجيله فوراً كعميل جديد
      if (!customer) {
        isNewCustomerRecord = true;
        const cleanPhone = debtCustomerPhone.trim();
        const newCustId = addCustomer({
          name: queryName,
          phone: cleanPhone,
          creditLimit: 5000,
          balance: 0,
          locationId: activeLocationId,
          notes: `تم تسجيله تلقائياً أثناء قيد دين/سحب طارئ: ${newDebtDescription.trim() || 'سحب طارئ'}`
        } as any);

        customer = {
          id: typeof newCustId === 'number' ? newCustId : (state.customers.length + 1),
          name: queryName,
          phone: cleanPhone,
          balance: 0,
          creditLimit: 5000,
          totalSpent: 0,
          lastVisit: new Date().toISOString(),
          loyaltyPoints: 0,
          locationId: activeLocationId
        };
      }

      const isDrawerCash = debtType === 'drawer_cash';
      const debtDesc = newDebtDescription.trim() || (isDrawerCash ? 'سحب نقدية من الدرج لظرف طارئ' : 'متبقي فاتورة لظرف طارئ');

      // 1. في حالة سحب نقدية من الدرج: خصم فوري من كاش الدرج
      if (isDrawerCash) {
        addDrawerMovement({
          type: 'withdrawal',
          amount: amt,
          locationId: activeLocationId,
          reason: `سحب نقدية من الدرج (دين/سلفة): ${customer.name} - ${debtDesc}`
        } as any);
      }

      // 2. تسجيل الفاتورة الآجلة في الحساب
      addInvoice({
        locationId: activeLocationId,
        customerId: customer.id,
        customerName: customer.name,
        paymentMethod: 'credit',
        items: [{
          itemId: isDrawerCash ? 'manual-drawer-cash-debt' : 'manual-credit-entry',
          name: isDrawerCash ? `سحب نقدية من الدرج: ${debtDesc}` : `متبقي فاتورة لظرف طارئ: ${debtDesc}`,
          price: amt,
          quantity: 1,
          modifiers: []
        }],
        subtotal: amt,
        discountPercent: 0,
        taxPercent: 0,
        total: amt,
        timestamp: Date.now(),
        date: newDebtDate,
        status: 'pending',
        notes: isDrawerCash ? `سحب نقدية من الدرج لظرف طارئ يسدد لاحقاً: ${debtDesc}` : `متبقي فاتورة لظرف طارئ يسدد لاحقاً: ${debtDesc}`
      } as any);

      // 3. تحديث رصيد دين العميل إذا كان موجوداً مسبقاً (العميل الجديد يأخذ الرصيد مباشرة عند إنشائه)
      if (!isNewCustomerRecord) {
        updateCustomer({
          ...customer,
          balance: (customer.balance || 0) + amt,
          lastVisit: new Date().toISOString()
        });
      }

      addToast(
        isDrawerCash
          ? `تم خصم ${formatNumber(amt)} ${currencySymbol} من نقدية الدرج وقيدها كدين على «${customer.name}» بنجاح`
          : `تم تسجيل متبقي الفاتورة بمبلغ ${formatNumber(amt)} ${currencySymbol} كدين على «${customer.name}» بنجاح`,
        'success'
      );
      setShowAddDebtModal(false);
      setNewDebtCustomerId('');
      setDebtCustomerQuery('');
      setDebtCustomerPhone('');
      setShowDebtCustomerDropdown(false);
      setNewDebtAmount('');
      setNewDebtDescription('');
      setDebtType('invoice');
    } catch (err: any) {
      addToast(err?.message || 'تعذر تسجيل العملية', 'error');
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  // Helper to convert Arabic numerals to English digits
  const toEnglishDigits = (str: string) => {
    return (str || '')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  };

  // Submit new customer
  const handleConfirmAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = newCustName.trim();
    if (!nameTrimmed) {
      addToast('يرجى إدخال اسم العميل', 'error');
      return;
    }

    // شرط الاسم ثلاثي على الأقل
    const nameParts = nameTrimmed.split(/\s+/).filter(Boolean);
    if (nameParts.length < 3 || nameParts.some((p) => p.length < 2)) {
      addToast('يجب كتابة اسم العميل ثلاثي على الأقل (مثال: محمد أحمد علي)', 'error');
      return;
    }

    // تطهير رقم الهاتف وشرط 11 رقماً
    let cleanPhone = toEnglishDigits(newCustPhone).replace(/\D/g, '');
    if (cleanPhone.startsWith('20') && cleanPhone.length === 13) {
      cleanPhone = cleanPhone.slice(2);
    }
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      addToast('رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ 01 (مثال: 01012345678)', 'error');
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const limit = parseFloat(newCustLimit) || 0;
      const initialBal = parseFloat(newCustInitialBalance) || 0;

      addCustomer({
        name: nameTrimmed,
        phone: cleanPhone,
        creditLimit: limit,
        balance: initialBal,
        notes: newCustNotes.trim() || undefined,
        locationId: activeLocationId
      } as any);

      addToast(`تمت إضافة العميل «${newCustName}» بنجاح`, 'success');
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustLimit('2000');
      setNewCustInitialBalance('0');
      setNewCustNotes('');
    } catch (err: any) {
      addToast(err?.message || 'تعذر إنشاء العميل', 'error');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };


  // Send WhatsApp reminder
  const handleWhatsAppReminder = (customer: Customer) => {
    const text = encodeURIComponent(
      `أهلاً بك أستاذ ${customer.name}، نود تذكير سيادتكم بلطف بوجود رصيد متبقي مستحق لدى ${state.settings?.shopName || 'الصالون'} بمبلغ (${formatNumber(customer.balance || 0)} ${currencySymbol}). نسعد دائماً بزيارتكم في أي وقت!`
    );
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    const fullPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  // Generate realistic sample data if needed
  const handleSeedSampleData = () => {
    const samples = [
      { name: 'أحمد إبراهيم الشناوي', phone: '01012345678', balance: 1250, creditLimit: 2000, notes: 'متبقي فاتورة خدمات يسدد لاحقاً' },
      { name: 'محمود عبد الرازق حسن', phone: '01198765432', balance: 3400, creditLimit: 2500, notes: 'سحب نقدية من الدرج لظرف طارئ' },
      { name: 'د. طارق السعيد العوضي', phone: '01234567890', balance: 850, creditLimit: 1500, notes: 'سدد دفعة ومتبقي جزء' },
      { name: 'م. خالد عبد الفتاح', phone: '01555544433', balance: 0, creditLimit: 1000, notes: 'حساب مسدد بالكامل' },
      { name: 'كابتن عمر يوسف كمال', phone: '01099887766', balance: 600, creditLimit: 1000, notes: 'فاتورة خدمات استشوار ومعالجة' }
    ];

    samples.forEach(s => {
      addCustomer({
        name: s.name,
        phone: s.phone,
        creditLimit: s.creditLimit,
        balance: s.balance,
        notes: s.notes
      });
    });

    addToast('تم توليد بيانات تجريبية واقعية بنجاح', 'success');
  };

  // Helper for status badge presentation
  const renderStatusBadge = (status: DebtStatus) => {
    switch (status) {
      case 'settled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>مسدد بالكامل</span>
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>مسدد جزئياً</span>
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>متأخر في السداد</span>
          </span>
        );
      case 'due':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>مستحق</span>
          </span>
        );
    }
  };

  // Initials generator for customer avatars
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]} ${parts[1][0]}`;
    return name.slice(0, 2);
  };

  // Check if any filters are currently active
  const isFiltered = search.trim() !== '' || statusFilter !== 'all' || periodFilter !== 'all' || sortBy !== 'amount_desc';

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPeriodFilter('all');
    setSortBy('amount_desc');
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-right font-sans" dir="rtl">
      {/* ===================================================================== */}
      {/* 1. Header (عنوان الصفحة والأزرار الإجرائية)                           */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center text-2xl shadow-sm shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">سجل الديون</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              نظام الديون للحالات الطارئة: متبقي فواتير لسدادها لاحقاً، أو سحب نقدية طارئ من الدرج لسداده لاحقاً.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* زر إضافة دين / بيع آجل */}
          <button
            type="button"
            onClick={() => handleOpenAddDebtModal()}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>تسجيل دين / سحب طارئ</span>
          </button>

          {/* زر إضافة عميل جديد */}
          <button
            type="button"
            onClick={() => setShowAddCustomerModal(true)}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs border border-slate-300 dark:border-slate-600/80 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <User size={15} className="text-slate-400" />
            <span>إضافة عميل</span>
          </button>

          {/* زر طباعة كشف الديون الحراري */}
          <button
            type="button"
            onClick={() => {
              printDebtsListThermal(
                filteredCustomers.map(c => ({
                  name: c.name,
                  phone: c.phone,
                  totalDebt: c.balance || 0,
                })),
                {
                  shopName: state.settings.shopName,
                  phone: state.settings.phone,
                  address: state.settings.address,
                }
              );
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-300 dark:border-slate-600/80 transition-all active:scale-95 cursor-pointer"
            title="طباعة كشف الديون"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Summary KPI Cards (بطاقات الملخص والإحصائيات)                      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* إجمالي المبالغ المستحقة */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80  p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المبالغ المستحقة</span>
            <span className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <DollarSign size={18} />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-500 tracking-tight">
            {formatNumber(summary.totalDue)} <span className="text-xs font-normal text-slate-400">{currencySymbol}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">مستحقات على {summary.debtorsCount} عميل</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" />
          </div>
        </div>

        {/* عدد العملاء المدينين */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 border-t-4 border-t-blue-500 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">عدد العملاء المدينين</span>
            <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Users size={18} />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-primary-600 dark:text-primary-400 tracking-tight">
            {summary.debtorsCount} <span className="text-xs font-normal text-slate-400">عميل مدين</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">نشطون بحسابات جارية</span>
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50" />
          </div>
        </div>

        {/* إجمالي المبالغ المتأخرة */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80  p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المبالغ المتأخرة</span>
            <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle size={18} />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-500 tracking-tight">
            {formatNumber(summary.totalOverdue)} <span className="text-xs font-normal text-slate-400">{currencySymbol}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {summary.overdueCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">{summary.overdueCount} متأخرين أكثر من 30 يوماً</span>
              ) : (
                <span>ديون مستقرة وحديثة</span>
              )}
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" />
          </div>
        </div>

        {/* المبالغ المحصلة */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80  p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي التحصيلات</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Check size={18} />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-500 tracking-tight">
            {formatNumber(summary.totalCollected)} <span className="text-xs font-normal text-slate-400">{currencySymbol}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{summary.collectedCount} سند قبض مسجل</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. Search & Filters Bar (البحث، الفلاتر والترتيب)                      */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* حقل البحث */}
          <div className="relative flex-1 min-w-[260px]">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="بحث باسم العميل، رقم الهاتف، أو كود الحساب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-8 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* فلتر الفترة والترتيب */}
          <div className="flex flex-wrap items-center gap-2">
            {/* فلتر الفترة */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600/80 text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">كل الفترات</option>
              <option value="today" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">حركات اليوم</option>
              <option value="week" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">آخر 7 أيام</option>
              <option value="month" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">آخر 30 يوم</option>
            </select>

            {/* خيارات الترتيب */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600/80 text-slate-800 dark:text-slate-200 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="amount_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">الأعلى مديونية</option>
              <option value="amount_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">الأقل مديونية</option>
              <option value="date_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">الأحدث حركة</option>
              <option value="name_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">أبجدياً بالاسم</option>
            </select>

            {/* زر مسح الفلاتر */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X size={14} />
                <span>مسح الفلاتر</span>
              </button>
            )}
          </div>
        </div>

        {/* كبسولات فلتر حالة الدين (Status Pills) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.04] text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium ml-1 flex items-center gap-1">
            <Filter size={13} />
            <span>حالة الدين:</span>
          </span>

          {[
            { id: 'all', label: 'الكل' },
            { id: 'due', label: 'مستحق (غير مسدد)' },
            { id: 'partial', label: 'مسدد جزئياً' },
            { id: 'settled', label: 'مسدد بالكامل' }
          ].map(pill => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white border border-blue-500 shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            );
          })}

          <div className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
            النتائج: <strong className="text-white font-mono">{filteredCustomers.length}</strong> عميل
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. Customers List (الجدول للشاشات الكبيرة + بطاقات للجوال)             */}
      {/* ===================================================================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-sm">
        {filteredCustomers.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center mb-4 shadow-sm shadow-emerald-500/10">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isFiltered ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد مديونيات معلقة!'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
              {isFiltered 
                ? 'جرب تعديل كلمات البحث أو مسح الفلاتر لعرض العملاء الآخرين.'
                : 'جميع حسابات العملاء مسددة بالكامل ولا توجد أي مديونيات مفتوحة حالياً.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {isFiltered ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-300 dark:border-slate-600/80 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw size={14} className="text-slate-400" />
                  <span>إعادة ضبط الفلاتر</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenAddDebtModal()}
                    className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>تسجيل عملية آجلة</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSeedSampleData}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-300 dark:border-slate-600/80 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles size={14} className="text-amber-400" />
                    <span>توليد بيانات تجريبية واقعية</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/80">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">العميل</th>
                    <th className="py-3.5 px-4 font-bold">رقم الهاتف</th>
                    <th className="py-3.5 px-4 font-bold text-center">المبلغ المستحق</th>
                    <th className="py-3.5 px-4 font-bold text-center">حالة الدين</th>
                    <th className="py-3.5 px-4 font-bold text-center">آخر حركة</th>
                    <th className="py-3.5 px-4 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                  {filteredCustomers.map(c => {
                    const balance = c.balance || 0;
                    const limit = c.creditLimit || 0;
                    const status = getCustomerStatus(c);
                    const usagePercent = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Customer Avatar & Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500/20 to-blue-500/20 border border-slate-300 dark:border-slate-600/80 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                              {getInitials(c.name)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{c.name}</span>

                              </div>
                              {c.notes && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[200px] mt-0.5">
                                  {c.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-500 dark:text-slate-400 text-xs font-mono flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        </td>

                        {/* Balance */}
                        <td className="py-3.5 px-4 text-center">
                          <div className={`font-mono text-base ${balance > 0 ? 'text-rose-500 font-extrabold' : 'text-emerald-500 font-extrabold'}`}>
                            {formatNumber(balance)} <span className="text-[11px] font-normal text-slate-400">{currencySymbol}</span>
                          </div>
                        </td>

                        {/* Debt Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(status)}
                        </td>

                        {/* Last Visit / Activity */}
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500 dark:text-slate-400">
                          {c.lastVisit ? formatDate(new Date(c.lastVisit)) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* زر سداد */}
                            {balance > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPayment(c)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                title="تحصيل دفعة أو سداد كامل المديونية"
                              >
                                <DollarSign size={13} />
                                <span>سداد</span>
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 text-slate-500 text-xs font-bold">
                                مسدد بالكامل
                              </span>
                            )}

                            {/* زر فتح ملف العميل */}
                            <button
                              type="button"
                              onClick={() => setProfileCustomer(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-600/80 transition-colors flex items-center gap-1 cursor-pointer"
                              title="عرض كشف الحساب والملف الشخصي"
                            >
                              <StatementIcon size={14} />
                              <span>كشف الحساب</span>
                            </button>

                            {/* زر واتساب */}
                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={() => handleWhatsAppReminder(c)}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer flex items-center justify-center"
                                title="إرسال تذكير بالمديونية عبر واتساب"
                              >
                                <WhatsAppIcon size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (شاشات الهواتف والتابلت الصغير) */}
            <div className="md:hidden divide-y divide-white/[0.04] p-3 space-y-3">
              {filteredCustomers.map(c => {
                const balance = c.balance || 0;
                const status = getCustomerStatus(c);

                return (
                  <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-slate-300 dark:border-slate-600/80 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</h4>
                          <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">{c.phone}</span>
                        </div>
                      </div>
                      <div>
                        {renderStatusBadge(status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-slate-200 dark:border-slate-700/80">
                      <span className="text-xs text-slate-500 dark:text-slate-400">المبلغ المستحق:</span>
                      <span className={`font-mono font-bold text-base ${balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatNumber(balance)} {currencySymbol}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(c)}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                        >
                          <DollarSign size={14} />
                          <span>سداد</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setProfileCustomer(c)}
                        className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-600/80 flex items-center justify-center gap-1 active:scale-95"
                      >
                        <FileText size={14} />
                        <span>ملف العميل</span>
                      </button>
                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => handleWhatsAppReminder(c)}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          title="واتساب"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 5. Payment Modal (نافذة تسجيل السداد)                                  */}
      {/* ===================================================================== */}
      {paymentCustomer && (
        <ModalShell
          title={`تسجيل سداد مديونية — ${paymentCustomer.name}`}
          onClose={() => setPaymentCustomer(null)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmPayment} className="space-y-4 text-right" dir="rtl">
            {/* ملخص الرصيد المستحق */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">المديونية المستحقة حالياً:</span>
                <span className="text-xl font-bold font-mono text-rose-400">
                  {formatNumber(paymentCustomer.balance || 0)} {currencySymbol}
                </span>
              </div>
            </div>

            {/* خيار نوع السداد (كامل / جزئي) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                نوع عملية السداد:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('full');
                    setPaymentAmount(String(paymentCustomer.balance || 0));
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === 'full'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900/80 text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-purple-500/50'
                  }`}
                >
                  سداد كامل المبلغ ({formatNumber(paymentCustomer.balance || 0)})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('partial');
                    setPaymentAmount('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    paymentMode === 'partial'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900/80 text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-purple-500/50'
                  }`}
                >
                  سداد جزء من المبلغ
                </button>
              </div>
            </div>

            {/* حقل مبلغ السداد */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                المبلغ المراد تحصيله الآن ({currencySymbol}):
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white font-bold font-mono text-lg outline-none focus:ring-2 focus:ring-purple-500 text-center"
              />
              {/* المديونية المتبقية المتوقعة */}
              {parseFloat(paymentAmount) > 0 && (
                <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>المبلغ المتبقي بعد السداد:</span>
                  <span className="font-mono font-bold text-purple-400">
                    {formatNumber(Math.max(0, (paymentCustomer.balance || 0) - (parseFloat(paymentAmount) || 0)))} {currencySymbol}
                  </span>
                </div>
              )}
            </div>

            {/* طريقة الدفع */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                طريقة الدفع والتحصيل:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'نقدًا', icon: null },
                  { id: 'card', label: 'بطاقة', icon: null },
                  { id: 'wallet', label: 'محفظة', icon: null },
                  { id: 'instapay', label: 'إنستا باي', icon: null },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900/80 text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-purple-400'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* تاريخ ووقت السداد */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300">
                  تاريخ ووقت السداد:
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentDateTime(getNowDateTimeLocal())}
                  className="text-[11px] text-purple-400 hover:underline font-bold cursor-pointer"
                >
                  الآن (الوقت الحالي)
                </button>
              </div>
              <input
                type="datetime-local"
                required
                value={paymentDateTime}
                onChange={(e) => setPaymentDateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                مسجل افتراضياً باليوم والوقت الحالي، ويمكنك اختيار يوم سابق إذا تم السداد في وقت مضى.
              </p>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                ملاحظات (اختياري):
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="سداد دفعة نقدية بالفرع..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* الأزرار */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-300 dark:border-slate-600/80">
              <Button
                variant="success"
                disabled={isSubmittingPayment || !parseFloat(paymentAmount)}
                className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm"
              >
                {isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد وحفظ السداد'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentCustomer(null)}
                className="flex-1 justify-center py-2.5 text-sm"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ===================================================================== */}
      {/* 6. Profile & Ledger Modal (ملف العميل الشخصي وكشف الحساب)              */}
      {/* ===================================================================== */}
      {profileCustomer && (
        <ModalShell
          title={`ملف العميل وكشف الحساب: ${profileCustomer.name}`}
          onClose={() => setProfileCustomer(null)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5 text-right font-sans" dir="rtl">
            {/* بطاقة رأس الملف الشخصي */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500/30 to-blue-500/30 border border-slate-300 dark:border-slate-600/80 text-white font-bold text-lg flex items-center justify-center shadow-sm shrink-0">
                  {getInitials(profileCustomer.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{profileCustomer.name}</h3>

                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    <span>{profileCustomer.phone}</span>
                    {profileCustomer.address && (
                      <span className="text-slate-500 mr-2">• {profileCustomer.address}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* أزرار سريعة في رأس الملف */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {(profileCustomer.balance || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenPayment(profileCustomer)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <DollarSign size={14} />
                    <span>سداد دفعة</span>
                  </button>
                )}

              </div>
            </div>

            {/* بطاقات الإحصائيات الثلاثية لملف العميل */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">إجمالي ما تم سداده:</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                  {formatNumber(activeCustomerTotalPaid)} {currencySymbol}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">الرصيد المتبقي المستحق:</span>
                <span className="text-base font-bold font-mono text-rose-400 mt-0.5 block">
                  {formatNumber(profileCustomer.balance || 0)} {currencySymbol}
                </span>
              </div>
            </div>

            {/* ملاحظات العميل */}
            {profileCustomer.notes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                
                <span>{profileCustomer.notes}</span>
              </div>
            )}

            {/* السجل الزمني لحركات العميل وكشف الحساب */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-400" />
                  <span>سجل الحركات المالية وكشف الحساب:</span>
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  عدد العمليات: {activeCustomerLedger.length}
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-300 dark:border-slate-600/80 rounded-xl bg-white dark:bg-slate-800/95">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-300 dark:border-slate-600/80">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">التاريخ</th>
                      <th className="py-2.5 px-3 font-bold">نوع الحركة / المرجع</th>
                      <th className="py-2.5 px-3 font-bold text-center text-rose-400">مدين (+)</th>
                      <th className="py-2.5 px-3 font-bold text-center text-emerald-400">دائن (-)</th>
                      <th className="py-2.5 px-3 font-bold text-center">الرصيد بعد الحركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                    {activeCustomerLedger.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          لا توجد حركات مسجلة لهذا العميل حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      activeCustomerLedger.map(row => (
                        <tr key={row.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                            {formatDate(new Date(row.timestamp))}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold block text-white">{row.title}</span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{row.ref}</span>
                            {row.notes && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">{row.notes}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-400">
                            {row.debit > 0 ? `+${formatNumber(row.debit)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                            {row.credit > 0 ? `-${formatNumber(row.credit)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                            {formatNumber(row.balanceAfter)} {currencySymbol}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* الأزرار السفلية */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  if (profileCustomer) {
                    printCustomerStatementThermal(
                      {
                        name: profileCustomer.name,
                        phone: profileCustomer.phone,
                        totalDebt: profileCustomer.balance || 0,
                      },
                      activeCustomerLedger.map(row => ({
                        date: formatDate(new Date(row.timestamp)),
                        desc: row.title + (row.notes ? ` (${row.notes})` : ''),
                        debit: row.debit,
                        credit: row.credit,
                        balance: row.balanceAfter,
                      })),
                      {
                        shopName: state.settings.shopName,
                        phone: state.settings.phone,
                        address: state.settings.address,
                      }
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-600/80 flex items-center gap-2 cursor-pointer"
              >
                <StatementIcon size={16} />
                <span>طباعة كشف الحساب</span>
              </button>

              <button
                type="button"
                onClick={() => setProfileCustomer(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-600/80 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ===================================================================== */}
      {/* 7. Add Debt Modal (نافذة تسجيل مديونية / بيع آجل)                      */}
      {/* ===================================================================== */}
      {showAddDebtModal && (
        <ModalShell
          title="تسجيل مديونية جديدة / سحب طارئ"
          onClose={() => setShowAddDebtModal(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmAddDebt} className="space-y-4 text-right" dir="rtl">
            {/* اختيار نوع المديونية: متبقي فاتورة أو سحب نقدية من الدرج لظرف طارئ */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                نوع المديونية والسبب:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDebtType('invoice')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    debtType === 'invoice'
                      ? 'border-primary-500 bg-primary-950/40 text-white font-bold ring-1 ring-primary-500'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText size={14} className="text-primary-400" />
                    <span>متبقي فاتورة</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">ظرف طارئ للعميل وسداد لاحقاً</div>
                </button>

                <button
                  type="button"
                  onClick={() => setDebtType('drawer_cash')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    debtType === 'drawer_cash'
                      ? 'border-amber-500 bg-amber-950/40 text-white font-bold ring-1 ring-amber-500'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Wallet size={14} className="text-amber-400" />
                    <span>سحب نقدية من الدرج</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">يُخصم من كاش الدرج ويُسدد لاحقاً</div>
                </button>
              </div>

              {debtType === 'drawer_cash' ? (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <span>💡 سيتم تسجيل سحب المبلغ من درج النقدية الآن كحركة مسحوبات وقيده كدين لمتابعته وسداده لاحقاً.</span>
                </div>
              ) : (
                <div className="mt-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
                  <span>💡 قيد متبقي الفاتورة كدين على العميل بسبب ظرف طارئ ليسدد لاحقاً دون التأثير على كاش الدرج.</span>
                </div>
              )}
            </div>

            {/* حقل العميل / الشخص المستلم (بحث فوري وتسجيل في نفس الوقت) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  العميل / الشخص المستلم:
                </label>
                {selectedDebtCustomer ? (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> عميل مسجل
                  </span>
                ) : debtCustomerQuery.trim() && isNewDebtCustomer ? (
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles size={12} /> شخص جديد (تسجيل فوري)
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={debtCustomerQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDebtCustomerQuery(val);
                    setShowDebtCustomerDropdown(true);
                    const exact = state.customers.find(c => c.name.trim().toLowerCase() === val.trim().toLowerCase());
                    setNewDebtCustomerId(exact ? exact.id : '');
                  }}
                  onFocus={() => setShowDebtCustomerDropdown(true)}
                  placeholder="اكتب اسم العميل للبحث أو التسجيل الجديد مباشرة..."
                  className="w-full pr-9 pl-9 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-xs outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder:text-slate-500 font-medium"
                />
                
                {/* أيقونة البحث في البداية */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Search size={14} />
                </div>

                {/* زر مسح الحقل في النهاية */}
                {debtCustomerQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setDebtCustomerQuery('');
                      setNewDebtCustomerId('');
                      setDebtCustomerPhone('');
                      setShowDebtCustomerDropdown(false);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* طبقة نقر شفافة لإغلاق القائمة عند النقر خارجها */}
              {showDebtCustomerDropdown && (
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setShowDebtCustomerDropdown(false)} 
                />
              )}

              {/* القائمة المنسدلة للنتائج والإضافة الفورية */}
              {showDebtCustomerDropdown && (
                <div className="absolute z-40 right-0 left-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl divide-y divide-slate-800 animate-scale-in text-right">
                  {/* زر تسجيل عميل جديد إذا لم يتطابق مع أي عميل مسجل */}
                  {debtCustomerQuery.trim() && isNewDebtCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewDebtCustomerId('');
                        setShowDebtCustomerDropdown(false);
                      }}
                      className="w-full p-2.5 flex items-center justify-between text-xs bg-primary-950/40 hover:bg-primary-900/50 text-primary-200 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-300 flex items-center justify-center font-bold">
                          <Plus size={13} />
                        </div>
                        <div className="text-right">
                          <span className="font-bold block">تسجيل «{debtCustomerQuery.trim()}»</span>
                          <span className="text-[10px] text-slate-400">كشخص / عميل جديد وقيد المديونية عليه فوراً</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-500/20 text-primary-300 font-bold border border-primary-500/30">
                        جديد
                      </span>
                    </button>
                  )}

                  {/* قائمة العملاء المسجلين المطابقين */}
                  {matchingDebtCustomers.length > 0 ? (
                    matchingDebtCustomers.map(c => {
                      const isSelected = newDebtCustomerId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setNewDebtCustomerId(c.id);
                            setDebtCustomerQuery(c.name);
                            setDebtCustomerPhone(c.phone || '');
                            setShowDebtCustomerDropdown(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center justify-between text-xs transition-colors hover:bg-slate-800 text-right cursor-pointer ${
                            isSelected ? 'bg-primary-950/40 text-primary-200 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                              {getInitials(c.name)}
                            </div>
                            <div>
                              <span className="font-bold block">{c.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{c.phone || 'بدون هاتف'}</span>
                            </div>
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block">الرصيد الحالي</span>
                            <span className={`text-xs font-mono font-bold ${(c.balance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {formatNumber(c.balance || 0)} {currencySymbol}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    !isNewDebtCustomer && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        لا يوجد عملاء مطابقين للبحث
                      </div>
                    )
                  )}
                </div>
              )}

              {/* بطاقة إرشادية لحالة الشخص المستلم */}
              {selectedDebtCustomer ? (
                <div className="mt-2 p-2 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      ✓
                    </div>
                    <span className="text-slate-300">
                      عميل مسجل: <strong className="text-white">{selectedDebtCustomer.name}</strong> {selectedDebtCustomer.phone && `(${selectedDebtCustomer.phone})`}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    رصيده الحالي: {formatNumber(selectedDebtCustomer.balance || 0)} {currencySymbol}
                  </span>
                </div>
              ) : debtCustomerQuery.trim() && isNewDebtCustomer ? (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300">
                    <Sparkles size={14} className="text-amber-400 shrink-0" />
                    <span>سيتم قيد الدين وتسجيل <strong>«{debtCustomerQuery.trim()}»</strong> كعميل جديد في النظام تلقائياً.</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      رقم هاتف المستلم (اختياري):
                    </label>
                    <input
                      type="tel"
                      maxLength={11}
                      value={debtCustomerPhone}
                      onChange={(e) => {
                        const clean = e.target.value
                          .replace(/[٠-٩]/g, (d: string) => String(d.charCodeAt(0) - 1632))
                          .replace(/\D/g, '')
                          .slice(0, 11);
                        setDebtCustomerPhone(clean);
                      }}
                      placeholder="01xxxxxxxxx (اختياري)"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 text-center tracking-wider"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                المبلغ المراد تقييده كدين ({currencySymbol}):
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={newDebtAmount}
                onChange={(e) => setNewDebtAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white font-bold font-mono text-base outline-none focus:ring-2 focus:ring-purple-500 text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                بيان العملية / سبب المديونية:
              </label>
              <input
                type="text"
                required
                value={newDebtDescription}
                onChange={(e) => setNewDebtDescription(e.target.value)}
                placeholder="مثال: خدمات صالون ومعالجة، منتجات عناية..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                تاريخ العملية:
              </label>
              <input
                type="date"
                value={newDebtDate}
                onChange={(e) => setNewDebtDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-300 dark:border-slate-600/80">
              <Button
                variant="primary"
                disabled={isSubmittingDebt || (!newDebtCustomerId && !debtCustomerQuery.trim()) || !parseFloat(newDebtAmount)}
                className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm"
              >
                {isSubmittingDebt ? 'جاري الحفظ...' : 'تأكيد وحفظ العملية'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAddDebtModal(false)}
                className="flex-1 justify-center py-2.5 text-sm"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ===================================================================== */}
      {/* 8. Add Customer Modal (إضافة عميل جديد)                               */}
      {/* ===================================================================== */}
      {showAddCustomerModal && (
        <ModalShell
          title="إضافة عميل جديد إلى السجل"
          onClose={() => setShowAddCustomerModal(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmAddCustomer} className="space-y-4 text-right" dir="rtl">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  اسم العميل (ثلاثي): <span className="text-rose-400">*</span>
                </label>
                <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors duration-200 ${
                  isNewCustNameValid ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isNewCustNameValid ? (
                    <>
                      <Check size={14} className="stroke-[3] text-emerald-400 shrink-0" />
                      <span>اسم ثلاثي مكتمل</span>
                    </>
                  ) : (
                    <span>شرط: اسم ثلاثي ({Math.min(newCustNameParts.length, 3)}/3)</span>
                  )}
                </span>
              </div>
              <input
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="مثال: أحمد محمد علي"
                className={`w-full px-3 py-2 rounded-xl border text-white text-xs outline-none transition-all ${
                  isNewCustNameValid
                    ? 'border-emerald-500 bg-emerald-950/20 focus:ring-2 focus:ring-emerald-500'
                    : newCustName
                      ? 'border-rose-500 bg-rose-950/20 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 focus:ring-2 focus:ring-purple-500'
                }`}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  رقم الهاتف (11 رقماً): <span className="text-rose-400">*</span>
                </label>
                <span className={`text-[11px] font-mono font-bold flex items-center gap-1 transition-colors duration-200 ${
                  isNewCustPhoneValid ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isNewCustPhoneValid ? (
                    <>
                      <Check size={14} className="stroke-[3] text-emerald-400 shrink-0" />
                      <span>رقم صحيح (11 رقماً)</span>
                    </>
                  ) : (
                    <span>شرط 11 رقماً ويبدأ بـ 01 ({cleanNewCustPhone.length}/11)</span>
                  )}
                </span>
              </div>
              <input
                type="tel"
                required
                maxLength={11}
                value={newCustPhone}
                onChange={(e) => {
                  const val = toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 11);
                  setNewCustPhone(val);
                }}
                placeholder="01xxxxxxxxx"
                className={`w-full px-3 py-2 rounded-xl border text-white text-xs font-mono outline-none transition-all ${
                  isNewCustPhoneValid
                    ? 'border-emerald-500 bg-emerald-950/20 focus:ring-2 focus:ring-emerald-500'
                    : newCustPhone
                      ? 'border-rose-500 bg-rose-950/20 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 focus:ring-2 focus:ring-purple-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رصيد افتتاحي (إن وُجد):
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={newCustInitialBalance}
                onChange={(e) => setNewCustInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                ملاحظات العميل:
              </label>
              <input
                type="text"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                placeholder="ملاحظات ائتمانية أو مواعيد سداد..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600/80 bg-slate-100 dark:bg-slate-900/80 text-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-300 dark:border-slate-600/80">
              <Button
                variant="primary"
                type="submit"
                disabled={isSubmittingCustomer || !isNewCustNameValid || !isNewCustPhoneValid}
                className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm"
              >
                {isSubmittingCustomer ? 'جاري الحفظ...' : 'حفظ العميل'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAddCustomerModal(false)}
                className="flex-1 justify-center py-2.5 text-sm"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

    </div>
  );
};
export default DebtsPage;
