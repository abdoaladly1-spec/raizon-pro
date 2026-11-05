/* صفحة إدارة الموظفين وفريق العمل - نظام RIZON PRO */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
    Users, Plus, Trash2, Printer, DollarSign, Clock, Search, Award, X,
    User, ArrowLeft, Wallet, Banknote, Calendar, FileText, Package,
    Check, Phone, CheckCircle2, XCircle, AlertCircle, RefreshCw, Scissors,
    CreditCard, ArrowUpRight, ChevronRight, BarChart2
} from '../components/Icons';
import { Staff, StaffPayment } from '../types';
import { Card, Button, Input, ModalShell } from '../components/ui';

// قائمة المسميات الوظيفية الشائعة لتسهيل وتنسيق الاختيار
const PRESET_ROLES = [
    { id: 'Cashier', labelAr: 'كاشير / صراف', labelEn: 'Cashier', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { id: 'Sales', labelAr: 'بائع / موظف مبيعات', labelEn: 'Sales Representative', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    { id: 'Barber', labelAr: 'مصفف / حلاق', labelEn: 'Barber / Stylist', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    { id: 'Technician', labelAr: 'فني / صنايعي', labelEn: 'Technician', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    { id: 'Receptionist', labelAr: 'استقبال وخدمة عملاء', labelEn: 'Receptionist', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
    { id: 'Manager', labelAr: 'مشرف / مدير فرع', labelEn: 'Manager / Supervisor', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
    { id: 'Accountant', labelAr: 'محاسب', labelEn: 'Accountant', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
    { id: 'Storekeeper', labelAr: 'أمين مخزن', labelEn: 'Storekeeper', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { id: 'Assistant', labelAr: 'مساعد / خدمات مساندة', labelEn: 'Assistant', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
];

export const StaffPage = () => {
    const { state, t, language, addStaff, updateStaff, deleteStaff, addStaffPayment, deleteStaffPayment, currentUser, addToast, formatDate, formatNumber } = useApp();
    const isAr = language === 'ar';

    // التبديل بين العرض العام (القائمة) والملف المالي والشخصي للموظف
    const [view, setView] = useState<'list' | 'profile'>('list');
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

    // البحث والفلترة في القائمة الرئيسية
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // تبويب العرض داخل الملف الشخصي للموظف
    const [profileTab, setProfileTab] = useState<'payroll' | 'invoices' | 'reservations' | 'custody'>('payroll');

    // نموذج إضافة وتعديل موظف
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const initialStaffForm = {
        id: '',
        name: '',
        phone: '',
        role: 'Cashier',
        services: [] as string[],
        locationIds: [] as string[],
        active: true,
        commissionType: 'none' as 'none' | 'percent' | 'fixed',
        commissionValue: '' as string | number,
        nationalId: '',
        address: ''
    };
    const [staffForm, setStaffForm] = useState(initialStaffForm);

    // نموذج سحب السلفة (Advance Modal)
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceStaffId, setAdvanceStaffId] = useState<string>('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceMethod, setAdvanceMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [advanceNotes, setAdvanceNotes] = useState('');

    // نموذج تسجيل دفعة / راتب / تسوية (Payment Modal)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStaffId, setPaymentStaffId] = useState<string>('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState<'salary' | 'commission' | 'bonus' | 'advance'>('salary');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [paymentNotes, setPaymentNotes] = useState('');

    // كشف حساب موظف للطباعة (Statement Print Modal)
    const [showStatementModal, setShowStatementModal] = useState(false);
    const [statementStaffId, setStatementStaffId] = useState<string>('');

    // إدارة العهدة والأدوات
    const [showToolsModal, setShowToolsModal] = useState(false);
    const [toolForm, setToolForm] = useState({ name: '', condition: 'New', notes: '' });
    const [staffTools, setStaffTools] = useState<Array<{ id: string; staffId: string; name: string; condition: string; assignedDate: string }>>([]);

    // تقرير مسير الرواتب والمستحقات المجمعة
    const [showPayrollReports, setShowPayrollReports] = useState(false);

    // الموظف المختار حالياً
    const selectedStaff = useMemo(() => {
        return (state.staff || []).find(s => s.id === selectedStaffId) || null;
    }, [state.staff, selectedStaffId]);

    // حساب الحسابات المالية لكل موظف بشكل لحظي
    const staffFinancials = useMemo(() => {
        const map = new Map<string, {
            totalCommissions: number;
            totalAdvances: number;
            totalSalaries: number;
            netDue: number;
            invoicesCount: number;
            invoicesTotal: number;
        }>();

        (state.staff || []).forEach(st => {
            const payments = (state.staffPayments || []).filter(p => p.staffId === st.id);
            const invoices = (state.invoices || []).filter(inv => inv.staffId === st.id);

            const totalCommissions = payments
                .filter(p => p.type === 'commission' || p.type === 'commission_reversal')
                .reduce((acc, p) => acc + (p.type === 'commission_reversal' ? -p.amount : p.amount), 0);

            const totalAdvances = payments
                .filter(p => p.type === 'advance')
                .reduce((acc, p) => acc + p.amount, 0);

            const totalSalaries = payments
                .filter(p => p.type === 'salary' || p.type === 'bonus')
                .reduce((acc, p) => acc + p.amount, 0);

            const netDue = Math.max(0, totalCommissions - totalAdvances);
            const invoicesTotal = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

            map.set(st.id, {
                totalCommissions,
                totalAdvances,
                totalSalaries,
                netDue,
                invoicesCount: invoices.length,
                invoicesTotal
            });
        });

        return map;
    }, [state.staff, state.staffPayments, state.invoices]);

    // الإحصائيات العامة للمنشأة ككل (فريق العمل)
    const teamSummary = useMemo(() => {
        const total = (state.staff || []).length;
        const active = (state.staff || []).filter(s => s.active).length;

        let totalCommissions = 0;
        let totalAdvances = 0;
        let totalNetDue = 0;

        staffFinancials.forEach(val => {
            totalCommissions += val.totalCommissions;
            totalAdvances += val.totalAdvances;
            totalNetDue += val.netDue;
        });

        return {
            total,
            active,
            inactive: total - active,
            totalCommissions,
            totalAdvances,
            totalNetDue
        };
    }, [state.staff, staffFinancials]);

    // فلترة الموظفين بالقائمة
    const filteredStaff = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return (state.staff || []).filter(s => {
            if (statusFilter === 'active' && !s.active) return false;
            if (statusFilter === 'inactive' && s.active) return false;
            if (roleFilter !== 'all' && s.role !== roleFilter) return false;
            if (!q) return true;
            return (
                (s.name || '').toLowerCase().includes(q) ||
                (s.phone || '').includes(q) ||
                (s.role || '').toLowerCase().includes(q)
            );
        });
    }, [state.staff, searchQuery, statusFilter, roleFilter]);

    // فتح مودال إضافة موظف
    const handleOpenAddModal = () => {
        setIsEditing(false);
        setStaffForm(initialStaffForm);
        setShowStaffModal(true);
    };

    // فتح مودال التعديل
    const handleOpenEditModal = (staff: Staff) => {
        const hasComm = Number(staff.commissionValue) > 0;
        setStaffForm({
            id: staff.id,
            name: staff.name,
            phone: staff.phone || '',
            role: staff.role || 'Cashier',
            services: staff.services || [],
            locationIds: staff.locationIds || [],
            active: staff.active !== false,
            commissionType: hasComm ? (staff.commissionType || 'percent') : 'none',
            commissionValue: hasComm ? staff.commissionValue! : '',
            nationalId: staff.nationalId || '',
            address: staff.address || ''
        });
        setIsEditing(true);
        setShowStaffModal(true);
    };

    // حفظ بيانات الموظف
    const handleSaveStaff = () => {
        if (!staffForm.name.trim()) {
            addToast(isAr ? 'يرجى كتابة اسم الموظف' : 'Staff name is required', 'error');
            return;
        }

        const commVal = staffForm.commissionType === 'none'
            ? 0
            : (parseFloat(String(staffForm.commissionValue)) || 0);

        const payload: Staff = {
            id: isEditing ? staffForm.id : crypto.randomUUID(),
            name: staffForm.name.trim(),
            phone: staffForm.phone.trim(),
            role: staffForm.role || 'Cashier',
            services: staffForm.services,
            locationIds: staffForm.locationIds,
            active: staffForm.active,
            commissionType: staffForm.commissionType === 'none' ? undefined : staffForm.commissionType,
            commissionValue: commVal,
            nationalId: staffForm.nationalId?.trim(),
            address: staffForm.address?.trim()
        };

        if (isEditing) {
            updateStaff(payload);
            addToast(isAr ? 'تم تحديث بيانات الموظف بنجاح' : 'Staff updated successfully', 'success');
        } else {
            addStaff(payload);
            addToast(isAr ? 'تم إضافة الموظف الجديد بنجاح' : 'Staff added successfully', 'success');
        }

        setShowStaffModal(false);
        setIsEditing(false);
        setStaffForm(initialStaffForm);
    };

    // حذف موظف مع تأكيد
    const handleDeleteStaff = (staff: Staff) => {
        if (window.confirm(isAr ? `هل أنت متأكد من حذف الموظف "${staff.name}"؟` : `Delete staff member "${staff.name}"?`)) {
            deleteStaff(staff.id);
            addToast(isAr ? 'تم حذف الموظف من النظام' : 'Staff deleted', 'info');
            if (selectedStaffId === staff.id) {
                setView('list');
                setSelectedStaffId(null);
            }
        }
    };

    // تبديل حالة نشط / غير نشط بنقرة واحدة سريعة
    const handleToggleActive = (staff: Staff) => {
        const nextActive = !staff.active;
        updateStaff({ ...staff, active: nextActive });
        addToast(
            nextActive
                ? (isAr ? `الموظف "${staff.name}" أصبح الآن نشطاً` : `${staff.name} is now active`)
                : (isAr ? `تم تحويل الموظف "${staff.name}" إلى غير نشط` : `${staff.name} is now inactive`),
            'info'
        );
    };

    // فتح مودال سحب سلفة
    const handleOpenAdvanceModal = (staffId?: string) => {
        const defaultId = staffId || selectedStaffId || (filteredStaff[0]?.id || (state.staff && state.staff[0]?.id) || '');
        setAdvanceStaffId(defaultId);
        setAdvanceAmount('');
        setAdvanceMethod('cash');
        setAdvanceNotes('');
        setShowAdvanceModal(true);
    };

    // تنفيذ سحب سلفة
    const handleConfirmAdvance = () => {
        const amt = parseFloat(advanceAmount);
        const targetStaff = (state.staff || []).find(s => s.id === advanceStaffId);

        if (!targetStaff) {
            addToast(isAr ? 'يرجى اختيار الموظف أولاً' : 'Select staff member', 'error');
            return;
        }
        if (!amt || amt <= 0) {
            addToast(isAr ? 'يرجى إدخال مبلغ السلفة بشكل صحيح' : 'Enter valid advance amount', 'error');
            return;
        }

        addStaffPayment({
            id: crypto.randomUUID(),
            staffId: targetStaff.id,
            staffName: targetStaff.name,
            amount: amt,
            type: 'advance',
            method: advanceMethod,
            notes: advanceNotes.trim() || (isAr ? 'سحب سلفة نقدية' : 'Advance payment'),
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            createdBy: currentUser?.username || 'Admin'
        });

        setShowAdvanceModal(false);
        setAdvanceAmount('');
        setAdvanceNotes('');
        addToast(
            isAr
                ? `تم تسجيل سلفة بمبلغ ${formatNumber(amt)} ج.م للموظف "${targetStaff.name}"`
                : `Advance of ${amt} EGP recorded for ${targetStaff.name}`,
            'success'
        );
    };

    // فتح مودال تسجيل دفعة / راتب / تسوية
    const handleOpenPaymentModal = (staffId?: string, defaultType: 'salary' | 'commission' | 'bonus' = 'salary', prefilledAmount?: number) => {
        const targetId = staffId || selectedStaffId || (filteredStaff[0]?.id || (state.staff && state.staff[0]?.id) || '');
        setPaymentStaffId(targetId);
        setPaymentType(defaultType);
        setPaymentAmount(prefilledAmount && prefilledAmount > 0 ? String(prefilledAmount) : '');
        setPaymentMethod('cash');
        setPaymentNotes(defaultType === 'commission' ? (isAr ? 'تصفية عمولات ومستحقات المبيعات' : 'Commission settlement') : '');
        setShowPaymentModal(true);
    };

    // تنفيذ تسجيل الدفعة
    const handleConfirmPayment = () => {
        const amt = parseFloat(paymentAmount);
        const targetStaff = (state.staff || []).find(s => s.id === paymentStaffId) || selectedStaff;

        if (!targetStaff) {
            addToast(isAr ? 'يرجى اختيار الموظف أولاً' : 'Select staff member', 'error');
            return;
        }

        if (!amt || amt <= 0) {
            addToast(isAr ? 'يرجى كتابة المبلغ المصروف' : 'Enter valid amount', 'error');
            return;
        }

        addStaffPayment({
            id: crypto.randomUUID(),
            staffId: targetStaff.id,
            staffName: targetStaff.name,
            amount: amt,
            type: paymentType,
            method: paymentMethod,
            notes: paymentNotes.trim(),
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            createdBy: currentUser?.username || 'Admin'
        });

        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        addToast(
            isAr
                ? `تم تسجيل صرف ${formatNumber(amt)} ج.م للموظف "${targetStaff.name}"`
                : `Payment of ${amt} EGP recorded for ${targetStaff.name}`,
            'success'
        );
    };

    // فتح مودال كشف الحساب
    const handleOpenStatement = (staffId?: string) => {
        const targetId = staffId || selectedStaffId || (filteredStaff[0]?.id || (state.staff && state.staff[0]?.id) || '');
        setStatementStaffId(targetId);
        setShowStatementModal(true);
    };

    // إضافة عهدة
    const handleAddTool = () => {
        const targetId = selectedStaffId || statementStaffId || (state.staff && state.staff[0]?.id);
        if (!targetId || !toolForm.name.trim()) {
            addToast(isAr ? 'يرجى إدخال اسم الأداة أو العهدة' : 'Enter tool name', 'error');
            return;
        }
        const newTool = {
            id: crypto.randomUUID(),
            staffId: targetId,
            name: toolForm.name.trim(),
            condition: toolForm.condition,
            assignedDate: new Date().toISOString().split('T')[0]
        };
        setStaffTools(prev => [...prev, newTool]);
        setToolForm({ name: '', condition: 'New', notes: '' });
        setShowToolsModal(false);
        addToast(isAr ? 'تم تسليم العهدة وتسجيلها للموظف' : 'Tool assigned to staff', 'success');
    };

    // حذف عهدة
    const handleDeleteTool = (toolId: string) => {
        if (window.confirm(isAr ? 'هل أنت متأكد من استرجاع / إزالة هذه العهدة؟' : 'Return / remove this custody item?')) {
            setStaffTools(prev => prev.filter(t => t.id !== toolId));
            addToast(isAr ? 'تم إزالة العهدة' : 'Custody item removed', 'info');
        }
    };

    // بيانات الموظف المختار التفصيلية
    const staffPaymentsList = useMemo(() => {
        if (!selectedStaffId) return [];
        return (state.staffPayments || [])
            .filter(p => p.staffId === selectedStaffId)
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [state.staffPayments, selectedStaffId]);

    const staffInvoicesList = useMemo(() => {
        if (!selectedStaffId) return [];
        return (state.invoices || [])
            .filter(i => i.staffId === selectedStaffId)
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [state.invoices, selectedStaffId]);

    const staffReservationsList = useMemo(() => {
        if (!selectedStaffId) return [];
        return (state.reservations || [])
            .filter(r => r.staffId === selectedStaffId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [state.reservations, selectedStaffId]);

    const currentStaffFin = selectedStaffId ? staffFinancials.get(selectedStaffId) : null;
    const statementStaff = useMemo(() => {
        const id = statementStaffId || selectedStaffId;
        return (state.staff || []).find(s => s.id === id) || null;
    }, [state.staff, statementStaffId, selectedStaffId]);
    const statementStaffFin = statementStaff ? staffFinancials.get(statementStaff.id) : null;

    // الحصول على نص المسمى الوظيفي بالعربية
    const getRoleLabel = (roleId?: string) => {
        const found = PRESET_ROLES.find(r => r.id.toLowerCase() === (roleId || '').toLowerCase());
        return found ? (isAr ? found.labelAr : found.labelEn) : (roleId || (isAr ? 'موظف' : 'Staff'));
    };

    const getRoleColor = (roleId?: string) => {
        const found = PRESET_ROLES.find(r => r.id.toLowerCase() === (roleId || '').toLowerCase());
        return found ? found.color : 'bg-slate-700/60 text-slate-300 border-slate-600';
    };

    return (
        <div className="space-y-6 animate-fade-in pb-16 text-right" dir={isAr ? 'rtl' : 'ltr'}>
            {/* ─────────────────────────────────────────────────────────────────────────────
                1. عرض الملف الشخصي والمالي للموظف (PROFILE VIEW)
               ───────────────────────────────────────────────────────────────────────────── */}
            {view === 'profile' && selectedStaff ? (
                <div className="space-y-6">
                    {/* ترويسة الرجوع ومعلومات الموظف */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="flex items-center gap-3.5">
                            <button
                                type="button"
                                onClick={() => setView('list')}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                                title={isAr ? 'العودة لقائمة الموظفين' : 'Back to staff list'}
                            >
                                <ArrowLeft size={18} className={isAr ? 'rotate-180' : ''} />
                            </button>

                            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold text-xl flex items-center justify-center shrink-0">
                                {selectedStaff.name.charAt(0).toUpperCase()}
                            </div>

                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedStaff.name}</h2>
                                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getRoleColor(selectedStaff.role)}`}>
                                        {getRoleLabel(selectedStaff.role)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleActive(selectedStaff)}
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${selectedStaff.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                                        title={isAr ? 'انقر لتغيير الحالة' : 'Toggle active'}
                                    >
                                        {selectedStaff.active ? (isAr ? 'على رأس العمل (نشط)' : 'Active') : (isAr ? 'غير نشط / إجازة' : 'Inactive')}
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {selectedStaff.phone && (
                                        <span className="flex items-center gap-1 font-mono">
                                            <Phone size={12} className="text-slate-400" />
                                            <span>{selectedStaff.phone}</span>
                                        </span>
                                    )}
                                    <span>•</span>
                                    <span>
                                        {Number(selectedStaff.commissionValue) > 0
                                            ? (selectedStaff.commissionType === 'fixed'
                                                ? `${isAr ? 'عمولة ثابتة:' : 'Commission:'} ${selectedStaff.commissionValue} ج.م / فاتورة`
                                                : `${isAr ? 'عمولة نسبة:' : 'Commission:'} ${selectedStaff.commissionValue}% على الفاتورة`)
                                            : (isAr ? 'راتب ثابت (بدون عمولة مبيعات)' : 'Fixed Salary (No Commission)')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* أزرار الإجراءات السريعة للموظف */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleOpenAdvanceModal(selectedStaff.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 cursor-pointer transition-all shadow-2xs"
                            >
                                <Banknote size={15} />
                                <span>{isAr ? 'سحب سلفة' : 'Draw Advance'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(selectedStaff.id, 'salary')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 cursor-pointer transition-all shadow-2xs"
                            >
                                <Wallet size={15} />
                                <span>{isAr ? 'صرف راتب / دفعة' : 'Pay Salary'}</span>
                            </button>

                            {currentStaffFin && currentStaffFin.netDue > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenPaymentModal(selectedStaff.id, 'commission', currentStaffFin.netDue)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer transition-all"
                                    title={isAr ? 'صرف وتصفية كامل المبلغ الصافي المستحق للموظف' : 'Settle remaining due balance'}
                                >
                                    <Check size={15} />
                                    <span>{isAr ? `تصفية المستحق (${formatNumber(currentStaffFin.netDue)} ج.م)` : `Settle (${currentStaffFin.netDue} EGP)`}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => handleOpenStatement(selectedStaff.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shadow-2xs"
                            >
                                <Printer size={15} />
                                <span>{isAr ? 'كشف حساب' : 'Statement'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOpenEditModal(selectedStaff)}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-all"
                                title={isAr ? 'تعديل بيانات الموظف' : 'Edit staff'}
                            >
                                <Scissors size={16} />
                            </button>
                        </div>
                    </div>

                    {/* البطاقات المالية الأربعة لحساب الموظف */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'مبيعات الموظف' : 'Sales Revenue'}</span>
                                <DollarSign size={16} className="text-blue-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                                    {formatNumber(currentStaffFin?.invoicesTotal || 0)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? `من إجمالي ${currentStaffFin?.invoicesCount || 0} فاتورة تم تنفيذها` : `${currentStaffFin?.invoicesCount || 0} invoices completed`}
                            </p>
                        </Card>

                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'إجمالي العمولات' : 'Commissions'}</span>
                                <Award size={16} className="text-purple-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                                    {formatNumber(currentStaffFin?.totalCommissions || 0)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? 'عمولات مكتسبة محسوبة تلقائياً' : 'Earned on sales invoices'}
                            </p>
                        </Card>

                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'إجمالي السلف المسحوبة' : 'Total Advances'}</span>
                                <Banknote size={16} className="text-amber-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-amber-500">
                                    {formatNumber(currentStaffFin?.totalAdvances || 0)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? 'تُخصم تلقائياً من رصيد المستحقات' : 'Deducted from due balance'}
                            </p>
                        </Card>

                        <Card className={`border p-4 ${currentStaffFin && currentStaffFin.netDue > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <span>{isAr ? 'صافي المستحق للصرف' : 'Net Due Balance'}</span>
                                <Wallet size={16} className={currentStaffFin && currentStaffFin.netDue > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className={`text-2xl font-bold font-mono ${currentStaffFin && currentStaffFin.netDue > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {formatNumber(currentStaffFin?.netDue || 0)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {currentStaffFin && currentStaffFin.netDue > 0
                                    ? (isAr ? 'المبلغ المتبقي واجب السداد للموظف' : 'Outstanding amount to pay')
                                    : (isAr ? 'الحساب مسوى بالكامل (لا توجد مديونية)' : 'Account fully settled')}
                            </p>
                        </Card>
                    </div>

                    {/* أزرار التبويبات الداخلية */}
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <button
                            type="button"
                            onClick={() => setProfileTab('payroll')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${profileTab === 'payroll' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Wallet size={15} />
                            <span>{isAr ? 'سجل المدفوعات والسلف' : 'Payroll & Advances'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">{staffPaymentsList.length}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setProfileTab('invoices')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${profileTab === 'invoices' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <FileText size={15} />
                            <span>{isAr ? 'فواتير ومبيعات الموظف' : 'Invoices & Sales'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">{staffInvoicesList.length}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setProfileTab('reservations')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${profileTab === 'reservations' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Calendar size={15} />
                            <span>{isAr ? 'الحجوزات والمهام' : 'Reservations'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">{staffReservationsList.length}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setProfileTab('custody')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${profileTab === 'custody' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Package size={15} />
                            <span>{isAr ? 'العهدة والأدوات' : 'Custody & Tools'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">
                                {staffTools.filter(t => t.staffId === selectedStaff.id).length}
                            </span>
                        </button>
                    </div>

                    {/* 1. تبويب المدفوعات والسلف */}
                    {profileTab === 'payroll' && (
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {isAr ? 'سجل الحركات النقدية والرواتب والسلف' : 'Staff Cash Movements & Payroll'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isAr ? 'جميع مبالغ السلف والرواتب والعمولات المسجلة للموظف مرتبة زمنياً' : 'All payroll entries, advances, and commission settlements'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenAdvanceModal(selectedStaff.id)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-all"
                                    >
                                        + {isAr ? 'تسجيل سلفة' : 'Add Advance'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPaymentModal(selectedStaff.id, 'salary')}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 cursor-pointer transition-all shadow-xs"
                                    >
                                        + {isAr ? 'تسجيل صرف دفعة' : 'Add Payment'}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                                            <th className="py-3 px-3">{isAr ? 'التاريخ والوقت' : 'Date'}</th>
                                            <th className="py-3 px-3">{isAr ? 'نوع الحركة' : 'Type'}</th>
                                            <th className="py-3 px-3">{isAr ? 'المبلغ' : 'Amount'}</th>
                                            <th className="py-3 px-3">{isAr ? 'طريقة الدفع' : 'Method'}</th>
                                            <th className="py-3 px-3">{isAr ? 'البيان والملاحظات' : 'Notes'}</th>
                                            <th className="py-3 px-3">{isAr ? 'المسجل' : 'Recorded By'}</th>
                                            <th className="py-3 px-3 text-center">{isAr ? 'حذف' : 'Delete'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                        {staffPaymentsList.map(pay => {
                                            const isAdv = pay.type === 'advance';
                                            const isComm = pay.type === 'commission';
                                            const isRev = pay.type === 'commission_reversal';
                                            const isSal = pay.type === 'salary';

                                            return (
                                                <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                                                        {formatDate(pay.timestamp)}
                                                    </td>
                                                    <td className="py-3 px-3 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                                            isAdv
                                                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                : isComm
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                                : isRev
                                                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                                : isSal
                                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                                : 'bg-slate-700/60 text-slate-300 border-slate-600'
                                                        }`}>
                                                            {isAdv ? (isAr ? 'سحب سلفة' : 'Advance') :
                                                             isComm ? (isAr ? 'صرف عمولة' : 'Commission') :
                                                             isRev ? (isAr ? 'استرداد عمولة مرتجع' : 'Commission Reversal') :
                                                             isSal ? (isAr ? 'راتب دوري' : 'Salary') :
                                                             (isAr ? 'مكافأة' : 'Bonus')}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                                                        <span className={isAdv ? 'text-amber-500' : isRev ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'}>
                                                            {isRev ? '-' : ''}{formatNumber(pay.amount)} ج.م
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                                                        {pay.method === 'cash' ? (isAr ? 'نقداً (من الخزينة)' : 'Cash') :
                                                         pay.method === 'transfer' ? (isAr ? 'تحويل بنكي / محفظة' : 'Bank Transfer') :
                                                         (isAr ? 'بطاقة بنكية' : 'Card')}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                                                        {pay.notes || '—'}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                                                        {pay.createdBy || 'Admin'}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذا القيد؟' : 'Delete this payment record?')) {
                                                                    deleteStaffPayment(pay.id);
                                                                    addToast(isAr ? 'تم حذف القيد' : 'Payment record removed', 'info');
                                                                }
                                                            }}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                            title={isAr ? 'حذف القيد' : 'Delete'}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {staffPaymentsList.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                                                    {isAr ? 'لا توجد أي مسحوبات أو سلف أو مدفوعات مسجلة لهذا الموظف حتى الآن.' : 'No payment records for this staff yet.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* 2. تبويب فواتير ومبيعات الموظف */}
                    {profileTab === 'invoices' && (
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {isAr ? 'سجل الفواتير والمبيعات المنفذة' : 'Invoices Handled by Staff'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isAr ? `إجمالي ${staffInvoicesList.length} فاتورة بقيمة ${formatNumber(currentStaffFin?.invoicesTotal || 0)} ج.م` : 'Invoices linked to this staff member'}
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                                            <th className="py-3 px-3">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                                            <th className="py-3 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                            <th className="py-3 px-3">{isAr ? 'اسم العميل' : 'Customer'}</th>
                                            <th className="py-3 px-3">{isAr ? 'الإجمالي' : 'Total'}</th>
                                            <th className="py-3 px-3">{isAr ? 'طريقة الدفع' : 'Payment'}</th>
                                            <th className="py-3 px-3">{isAr ? 'الأصناف والخدمات' : 'Items'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                        {staffInvoicesList.map(inv => (
                                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-3 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                                                    #{inv.id}
                                                </td>
                                                <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                                                    {inv.date}
                                                </td>
                                                <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-bold">
                                                    {inv.customerName || (isAr ? 'عميل نقدي' : 'Cash Client')}
                                                </td>
                                                <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                                    {formatNumber(inv.total)} ج.م
                                                </td>
                                                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                                                    {inv.paymentMethod === 'cash' ? (isAr ? 'نقداً' : 'Cash') :
                                                     inv.paymentMethod === 'card' ? (isAr ? 'بطاقة/فيزا' : 'Card') :
                                                     inv.paymentMethod === 'credit' ? (isAr ? 'آجل' : 'Credit') : inv.paymentMethod}
                                                </td>
                                                <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                                                    {(inv.items || []).map(i => i.name).join(', ')}
                                                </td>
                                            </tr>
                                        ))}
                                        {staffInvoicesList.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                                                    {isAr ? 'لم يتم ربط أي فواتير بيع بهذا الموظف حتى الآن.' : 'No invoices associated with this staff yet.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* 3. تبويب الحجوزات والمهام */}
                    {profileTab === 'reservations' && (
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {isAr ? 'سجل الحجوزات والمواعيد' : 'Staff Reservations'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isAr ? 'المواعيد والحجوزات المجدولة مع العملاء' : 'Scheduled client bookings'}
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                                            <th className="py-3 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                            <th className="py-3 px-3">{isAr ? 'الوقت' : 'Time'}</th>
                                            <th className="py-3 px-3">{isAr ? 'اسم العميل' : 'Customer'}</th>
                                            <th className="py-3 px-3">{isAr ? 'الخدمة' : 'Service'}</th>
                                            <th className="py-3 px-3">{isAr ? 'الحالة' : 'Status'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                        {staffReservationsList.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-3 px-3 font-mono">{r.date}</td>
                                                <td className="py-3 px-3 font-mono">{r.time}</td>
                                                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{r.customerName}</td>
                                                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.serviceName || '—'}</td>
                                                <td className="py-3 px-3">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                        r.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        r.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                        {t(r.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {staffReservationsList.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                                                    {isAr ? 'لا توجد حجوزات مسجلة لهذا الموظف.' : 'No reservations recorded.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* 4. تبويب العهدة والأدوات */}
                    {profileTab === 'custody' && (
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        {isAr ? 'عهدة الأدوات والمعدات المسلمة للموظف' : 'Staff Custody & Equipment'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isAr ? 'تتبع الأجهزة والأدوات المسلمة في حوزة الموظف' : 'Track equipment assigned to this staff member'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowToolsModal(true)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                                >
                                    <Plus size={14} />
                                    <span>{isAr ? 'تسليم عهدة جديدة' : 'Assign Tool'}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {staffTools.filter(t => t.staffId === selectedStaff.id).map(tool => (
                                    <div key={tool.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{tool.name}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                {tool.assignedDate} • {tool.condition}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTool(tool.id)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                            title={isAr ? 'إرجاع أو حذف العهدة' : 'Return tool'}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                                {staffTools.filter(t => t.staffId === selectedStaff.id).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                                        {isAr ? 'لم يتم تسليم أي عهدة أو أدوات لهذا الموظف.' : 'No custody items assigned yet.'}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            ) : (
                /* ─────────────────────────────────────────────────────────────────────────────
                    2. عرض القائمة الرئيسية لكروت الموظفين (LIST VIEW)
                   ───────────────────────────────────────────────────────────────────────────── */
                <div className="space-y-6">
                    {/* الترويسة الرئيسية + أزرار الإجراءات السريعة */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                                <span className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    <Users size={20} />
                                </span>
                                <span>{isAr ? 'إدارة الموظفين وفريق العمل' : 'Staff Management'}</span>
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {teamSummary.active} {isAr ? 'نشط' : 'active'} / {teamSummary.total}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {isAr ? 'إدارة حسابات وبيانات الموظفين، تحديد العمولات، تسجيل السلف، وتصفية المستحقات بنقرة واحدة.' : 'Manage staff profiles, commissions, advances, and payroll settlements.'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* زر مسير رواتب ومستحقات الموظفين */}
                            <button
                                type="button"
                                onClick={() => setShowPayrollReports(true)}
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shadow-2xs"
                            >
                                <BarChart2 size={16} />
                                <span>{isAr ? 'مسير الرواتب المجمع' : 'Payroll Sheet'}</span>
                            </button>

                            {/* زر سحب سلفة سريع لأي موظف */}
                            <button
                                type="button"
                                onClick={() => handleOpenAdvanceModal()}
                                disabled={(state.staff || []).length === 0}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 cursor-pointer transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Banknote size={16} />
                                <span>{isAr ? 'سحب سلفة سريعة' : 'Quick Advance'}</span>
                            </button>

                            {/* زر إضافة موظف جديد */}
                            <button
                                type="button"
                                onClick={handleOpenAddModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer transition-all"
                            >
                                <Plus size={16} />
                                <span>{isAr ? 'إضافة موظف جديد' : 'Add Staff'}</span>
                            </button>
                        </div>
                    </div>

                    {/* بطاقات الإحصائيات الأربعة الذكية لفريق العمل */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'إجمالي فريق العمل' : 'Total Staff'}</span>
                                <Users size={16} className="text-purple-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{teamSummary.total}</span>
                                <span className="text-xs text-emerald-500 font-bold">({teamSummary.active} {isAr ? 'نشط' : 'active'})</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? 'كافة الموظفين المسجلين بالنظام' : 'All registered employees'}
                            </p>
                        </Card>

                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'عمولات الفريق المكتسبة' : 'Total Commissions'}</span>
                                <Award size={16} className="text-purple-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                                    {formatNumber(teamSummary.totalCommissions)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? 'محسوبة من فواتير البيع المنجزة' : 'Earned across all invoices'}
                            </p>
                        </Card>

                        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                                <span>{isAr ? 'إجمالي السلف المسحوبة' : 'Total Advances'}</span>
                                <Banknote size={16} className="text-amber-500" />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold font-mono text-amber-500">
                                    {formatNumber(teamSummary.totalAdvances)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {isAr ? 'مسحوبات سلف قيد الخصم' : 'Pending deducted advances'}
                            </p>
                        </Card>

                        <Card className={`border p-4 ${teamSummary.totalNetDue > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <span>{isAr ? 'صافي مستحقات الصرف' : 'Net Due to Team'}</span>
                                <Wallet size={16} className={teamSummary.totalNetDue > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                            </div>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className={`text-2xl font-bold font-mono ${teamSummary.totalNetDue > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {formatNumber(teamSummary.totalNetDue)}
                                </span>
                                <span className="text-xs text-slate-400">ج.م</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {teamSummary.totalNetDue > 0
                                    ? (isAr ? 'إجمالي المطلوب تسويته للفريق' : 'Total balance to settle')
                                    : (isAr ? 'لا توجد مستحقات معلقة حالياً' : 'All accounts settled')}
                            </p>
                        </Card>
                    </div>

                    {/* شريط البحث وتصفية الموظفين */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                        {/* البحث الفوري */}
                        <div className="relative flex-1 min-w-[240px] max-w-md">
                            <Search size={16} className="absolute inset-y-0 start-3 my-auto text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={isAr ? 'بحث بالاسم، رقم الهاتف، أو الوظيفة...' : 'Search by name, phone or role...'}
                                className="w-full ps-9 pe-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-purple-500 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 end-2.5 my-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* تبويبات فلترة الحالة */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                {isAr ? 'الكل' : 'All'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('active')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === 'active' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{isAr ? 'نشط' : 'Active'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('inactive')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === 'inactive' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                {isAr ? 'إجازة / غير نشط' : 'Inactive'}
                            </button>
                        </div>

                        {/* فلترة الوظائف */}
                        <div className="flex items-center gap-2">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                            >
                                <option value="all">{isAr ? 'جميع الوظائف' : 'All Roles'}</option>
                                {PRESET_ROLES.map(r => (
                                    <option key={r.id} value={r.id}>{isAr ? r.labelAr : r.labelEn}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* شبكة بطاقات الموظفين (Cards Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStaff.map(staff => {
                            const fin = staffFinancials.get(staff.id);
                            const commVal = Number(staff.commissionValue) || 0;

                            return (
                                <div
                                    key={staff.id}
                                    className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                                        staff.active
                                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-500/40 hover:shadow-md'
                                            : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/50 opacity-75'
                                    }`}
                                >
                                    {/* رأس الكارت: الأفاتار، الاسم، المسمى، والحالة */}
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 font-bold text-lg flex items-center justify-center shrink-0">
                                                    {staff.name.charAt(0).toUpperCase()}
                                                </div>

                                                <div>
                                                    <h3
                                                        onClick={() => { setSelectedStaffId(staff.id); setView('profile'); }}
                                                        className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-purple-600 transition-colors cursor-pointer"
                                                    >
                                                        {staff.name}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getRoleColor(staff.role)}`}>
                                                            {getRoleLabel(staff.role)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* زر تبديل الحالة بنقرة واحدة */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(staff)}
                                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${
                                                    staff.active
                                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-slate-300'
                                                }`}
                                                title={isAr ? 'انقر لتغيير الحالة (نشط / غير نشط)' : 'Click to toggle active status'}
                                            >
                                                {staff.active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'إجازة' : 'Inactive')}
                                            </button>
                                        </div>

                                        {/* بيانات الاتصال والعمولة */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                                            {staff.phone && (
                                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono">
                                                    <Phone size={13} className="text-slate-400 shrink-0" />
                                                    <span>{staff.phone}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 text-[11px]">
                                                <span className="text-slate-400">{isAr ? 'العمولة:' : 'Commission:'}</span>
                                                {commVal > 0 ? (
                                                    <span className="font-bold text-purple-600 dark:text-purple-400">
                                                        {staff.commissionType === 'fixed'
                                                            ? `${commVal} ج.م / فاتورة`
                                                            : `${commVal}% على الفاتورة`}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">
                                                        {isAr ? 'بدون عمولة مبيعات' : 'No Commission'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* صندوق الأرقام المالية للموظف */}
                                        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'العمولات' : 'Commissions'}</p>
                                                <p className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                                                    {formatNumber(fin?.totalCommissions || 0)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'السلف' : 'Advances'}</p>
                                                <p className="text-xs font-bold font-mono text-amber-500 mt-0.5">
                                                    {formatNumber(fin?.totalAdvances || 0)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold">{isAr ? 'المستحق' : 'Net Due'}</p>
                                                <p className={`text-xs font-bold font-mono mt-0.5 ${(fin?.netDue || 0) > 0 ? 'text-emerald-500 font-extrabold' : 'text-slate-400'}`}>
                                                    {formatNumber(fin?.netDue || 0)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* أزرار الإجراءات السفلية */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedStaffId(staff.id); setView('profile'); }}
                                            className="flex-1 min-w-[100px] py-2 rounded-xl text-xs font-bold bg-purple-600/10 hover:bg-purple-600 text-purple-600 hover:text-white dark:text-purple-300 dark:hover:text-white border border-purple-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <User size={14} />
                                            <span>{isAr ? 'الملف والحسابات' : 'Profile & Ledger'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenAdvanceModal(staff.id)}
                                            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/25 transition-all cursor-pointer flex items-center gap-1"
                                            title={isAr ? 'سحب سلفة لهذا الموظف' : 'Draw Advance'}
                                        >
                                            <Banknote size={14} />
                                            <span>{isAr ? 'سلفة' : 'Advance'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenPaymentModal(staff.id, 'salary')}
                                            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/25 transition-all cursor-pointer flex items-center gap-1"
                                            title={isAr ? 'صرف راتب أو دفعة' : 'Pay Salary'}
                                        >
                                            <Wallet size={14} />
                                            <span>{isAr ? 'صرف' : 'Pay'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenStatement(staff.id)}
                                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                            title={isAr ? 'كشف حساب' : 'Statement'}
                                        >
                                            <Printer size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(staff)}
                                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                            title={isAr ? 'تعديل البيانات والعمولة' : 'Edit staff'}
                                        >
                                            <Scissors size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteStaff(staff)}
                                            className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/30 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                            title={isAr ? 'حذف الموظف' : 'Delete staff'}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredStaff.length === 0 && (
                            <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <Users size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                    {isAr ? 'لا توجد نتائج تطابق معايير البحث الحالية' : 'No staff found matching current filter'}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {isAr ? 'يمكنك تعديل البحث أو الضغط على "إضافة موظف جديد".' : 'Try adjusting your search query or add a new staff member.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleOpenAddModal}
                                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition-all cursor-pointer shadow-xs"
                                >
                                    + {isAr ? 'إضافة موظف جديد الآن' : 'Add Staff Now'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────────
                المودالات المشتركة - متاحة دائماً في كل الشاشات والتبويبات
               ───────────────────────────────────────────────────────────────────────────── */}

            {/* مودال إضافة وتعديل موظف */}
            {showStaffModal && (
                <ModalShell
                    title={isEditing ? (isAr ? 'تعديل بيانات الموظف والعمولة' : 'Edit Staff') : (isAr ? 'إضافة موظف جديد' : 'Add New Staff')}
                    onClose={() => setShowStaffModal(false)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                        <div>
                            <Input
                                label={isAr ? 'اسم الموظف الكامل *' : 'Full Name *'}
                                value={staffForm.name}
                                onChange={(e: any) => setStaffForm({ ...staffForm, name: e.target.value })}
                                placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                                required
                            />
                        </div>

                        <div>
                            <Input
                                label={isAr ? 'رقم الهاتف / واتساب' : 'Phone Number'}
                                value={staffForm.phone}
                                onChange={(e: any) => setStaffForm({ ...staffForm, phone: e.target.value })}
                                placeholder="01000000000"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                {isAr ? 'المسمى الوظيفي والدور *' : 'Role & Position *'}
                            </label>
                            <select
                                value={staffForm.role}
                                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:border-purple-500"
                            >
                                {PRESET_ROLES.map(r => (
                                    <option key={r.id} value={r.id}>{isAr ? r.labelAr : r.labelEn}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                                    {isAr ? 'نظام احتساب عمولة الموظف' : 'Staff Commission System'}
                                </label>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {isAr ? 'تُحسب وتُضاف تلقائياً لرصيد الموظف عند اختياره في فواتير المبيعات.' : 'Auto-credited when staff is selected on sales invoice.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setStaffForm({ ...staffForm, commissionType: 'none', commissionValue: '' })}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${staffForm.commissionType === 'none' ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                >
                                    {isAr ? 'بدون عمولة' : 'No Comm'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStaffForm({ ...staffForm, commissionType: 'percent' })}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${staffForm.commissionType === 'percent' ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                >
                                    {isAr ? 'نسبة مئوية %' : 'Percent %'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStaffForm({ ...staffForm, commissionType: 'fixed' })}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${staffForm.commissionType === 'fixed' ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                >
                                    {isAr ? 'مبلغ ثابت ج.م' : 'Fixed EGP'}
                                </button>
                            </div>

                            {staffForm.commissionType !== 'none' && (
                                <div className="pt-1">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        {staffForm.commissionType === 'fixed'
                                            ? (isAr ? 'قيمة العمولة الثابتة لكل فاتورة (ج.م):' : 'Fixed amount per invoice (EGP):')
                                            : (isAr ? 'نسبة العمولة من إجمالي الفاتورة (%):' : 'Commission percentage (%):')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            step={staffForm.commissionType === 'fixed' ? '1' : '0.5'}
                                            max={staffForm.commissionType === 'percent' ? '100' : undefined}
                                            value={staffForm.commissionValue}
                                            onChange={(e) => setStaffForm({ ...staffForm, commissionValue: e.target.value })}
                                            placeholder={staffForm.commissionType === 'fixed' ? 'مثال: 20' : 'مثال: 10'}
                                            className="w-full px-3.5 py-2.5 pe-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-purple-500 font-mono"
                                        />
                                        <span className="absolute inset-y-0 end-0 pe-3 flex items-center text-xs font-bold text-slate-500 pointer-events-none">
                                            {staffForm.commissionType === 'fixed' ? 'ج.م' : '%'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 pt-1">
                            <input
                                type="checkbox"
                                id="staffActiveCheckbox"
                                checked={staffForm.active}
                                onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <label htmlFor="staffActiveCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                {isAr ? 'الموظف على رأس العمل حالياً (نشط)' : 'Staff member is currently active'}
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setShowStaffModal(false)}>
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button variant="primary" onClick={handleSaveStaff}>
                                {isAr ? 'حفظ بيانات الموظف' : 'Save Staff'}
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* مودال سحب سلفة */}
            {showAdvanceModal && (
                <ModalShell
                    title={isAr ? 'تسجيل سحب سلفة نقدية' : 'Draw Cash Advance'}
                    onClose={() => setShowAdvanceModal(false)}
                    maxWidth="max-w-sm"
                >
                    <div className="space-y-3.5 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'الموظف المستفيد من السلفة *' : 'Staff Member *'}
                            </label>
                            <select
                                value={advanceStaffId}
                                onChange={(e) => setAdvanceStaffId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:border-purple-500"
                            >
                                {(state.staff || []).map(st => (
                                    <option key={st.id} value={st.id}>
                                        {st.name} — ({getRoleLabel(st.role)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'مبلغ السلفة (ج.م) *' : 'Advance Amount (EGP) *'}
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={advanceAmount}
                                onChange={(e) => setAdvanceAmount(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-base font-bold font-mono outline-none focus:border-purple-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'طريقة صرف السلفة' : 'Payment Method'}
                            </label>
                            <select
                                value={advanceMethod}
                                onChange={(e: any) => setAdvanceMethod(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            >
                                <option value="cash">{isAr ? 'نقداً (من درج الكاشير)' : 'Cash (from drawer)'}</option>
                                <option value="transfer">{isAr ? 'تحويل بنكي / محفظة فودافون كاش' : 'Bank / Wallet'}</option>
                                <option value="card">{isAr ? 'بطاقة بنكية' : 'Card'}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'سبب / بيان السلفة (اختياري)' : 'Notes (optional)'}
                            </label>
                            <textarea
                                value={advanceNotes}
                                onChange={(e) => setAdvanceNotes(e.target.value)}
                                rows={2}
                                placeholder={isAr ? 'مثال: سلفة شخصية على حساب الراتب' : 'e.g. personal advance'}
                                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setShowAdvanceModal(false)}>
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button variant="warning" onClick={handleConfirmAdvance} className="flex items-center gap-1.5">
                                <Banknote size={15} />
                                <span>{isAr ? 'تأكيد وصرف السلفة' : 'Confirm Advance'}</span>
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* مودال صرف راتب / دفعة / تصفية */}
            {showPaymentModal && (
                <ModalShell
                    title={isAr ? 'تسجيل وصرف دفعة / راتب للموظف' : 'Record Staff Payment'}
                    onClose={() => setShowPaymentModal(false)}
                    maxWidth="max-w-sm"
                >
                    <div className="space-y-3.5 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'الموظف المستفيد *' : 'Staff Member *'}
                            </label>
                            <select
                                value={paymentStaffId}
                                onChange={(e) => setPaymentStaffId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:border-purple-500"
                            >
                                {(state.staff || []).map(st => {
                                    const fin = staffFinancials.get(st.id);
                                    return (
                                        <option key={st.id} value={st.id}>
                                            {st.name} — (مستحق له: {formatNumber(fin?.netDue || 0)} ج.م)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'نوع الدفعة *' : 'Payment Type *'}
                            </label>
                            <select
                                value={paymentType}
                                onChange={(e: any) => setPaymentType(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:border-purple-500"
                            >
                                <option value="salary">{isAr ? 'راتب دوري / مرتب شهر' : 'Salary'}</option>
                                <option value="commission">{isAr ? 'صرف عمولات مبيعات / تصفية مستحق' : 'Commission'}</option>
                                <option value="bonus">{isAr ? 'مكافأة تشجيعية / حافز' : 'Bonus'}</option>
                                <option value="advance">{isAr ? 'سلفة على الراتب' : 'Advance'}</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {isAr ? 'المبلغ المصروف (ج.م) *' : 'Amount (EGP) *'}
                                </label>
                                {paymentStaffId && staffFinancials.get(paymentStaffId)?.netDue ? (
                                    <button
                                        type="button"
                                        onClick={() => setPaymentAmount(String(staffFinancials.get(paymentStaffId)!.netDue))}
                                        className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                                    >
                                        {isAr ? `تعبئة كامل المستحق (${formatNumber(staffFinancials.get(paymentStaffId)!.netDue)} ج.م)` : 'Fill Net Due'}
                                    </button>
                                ) : null}
                            </div>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-base font-bold font-mono outline-none focus:border-purple-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'طريقة الدفع' : 'Payment Method'}
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e: any) => setPaymentMethod(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            >
                                <option value="cash">{isAr ? 'نقداً (من الخزينة)' : 'Cash'}</option>
                                <option value="transfer">{isAr ? 'تحويل بنكي / محفظة' : 'Transfer'}</option>
                                <option value="card">{isAr ? 'بطاقة بنكية' : 'Card'}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'البيان والملاحظات' : 'Notes'}
                            </label>
                            <textarea
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                rows={2}
                                placeholder={isAr ? 'مثال: راتب شهر، أو تصفية عمولات' : 'Notes'}
                                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button variant="primary" onClick={handleConfirmPayment}>
                                {isAr ? 'تسجيل وصرف الدفعة' : 'Confirm Payment'}
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* مودال كشف حساب الموظف للطباعة */}
            {showStatementModal && statementStaff && (
                <ModalShell
                    title={isAr ? `كشف حساب موظف: ${statementStaff.name}` : `Statement: ${statementStaff.name}`}
                    onClose={() => setShowStatementModal(false)}
                    maxWidth="max-w-xl"
                >
                    <div className="space-y-4 text-slate-800 dark:text-slate-200 text-xs p-2">
                        {/* بطاقة كشف الحساب الرسمية */}
                        <div className="p-5 bg-white text-black border border-slate-300 rounded-2xl space-y-4 shadow-sm" id="printable-staff-statement">
                            <div className="text-center border-b border-slate-200 pb-3">
                                <h2 className="text-base font-extrabold">{state.settings.shopName || 'RIZON PRO'}</h2>
                                <p className="text-xs text-slate-600 font-bold mt-1">
                                    {isAr ? 'كشف حساب ومستحقات موظف' : 'Staff Account & Due Settlement Statement'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                                    {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'full' })}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div><b>{isAr ? 'اسم الموظف:' : 'Staff Name:'}</b> {statementStaff.name}</div>
                                <div><b>{isAr ? 'الوظيفة:' : 'Role:'}</b> {getRoleLabel(statementStaff.role)}</div>
                                <div><b>{isAr ? 'الهاتف:' : 'Phone:'}</b> {statementStaff.phone || '—'}</div>
                                <div><b>{isAr ? 'نظام العمولة:' : 'Commission:'}</b> {statementStaff.commissionValue ? `${statementStaff.commissionValue} (${statementStaff.commissionType === 'fixed' ? 'ج.م' : '%'})` : (isAr ? 'راتب ثابت' : 'Fixed')}</div>
                            </div>

                            <div className="space-y-1.5 border-t border-b border-slate-200 py-3">
                                <div className="flex justify-between font-bold">
                                    <span>{isAr ? 'إجمالي المبيعات المنفذة:' : 'Total Sales Revenue:'}</span>
                                    <span className="font-mono">{formatNumber(statementStaffFin?.invoicesTotal || 0)} ج.م</span>
                                </div>
                                <div className="flex justify-between font-bold text-purple-700">
                                    <span>{isAr ? '(+) إجمالي العمولات المكتسبة:' : '(+) Earned Commissions:'}</span>
                                    <span className="font-mono">{formatNumber(statementStaffFin?.totalCommissions || 0)} ج.م</span>
                                </div>
                                <div className="flex justify-between font-bold text-amber-700">
                                    <span>{isAr ? '(-) إجمالي السلف والمسحوبات:' : '(-) Drawn Advances:'}</span>
                                    <span className="font-mono">-{formatNumber(statementStaffFin?.totalAdvances || 0)} ج.م</span>
                                </div>
                                <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-2 text-emerald-700">
                                    <span>{isAr ? '(=) صافي المستحق للصرف الآن:' : '(=) Net Outstanding Due:'}</span>
                                    <span className="font-mono">{formatNumber(statementStaffFin?.netDue || 0)} ج.م</span>
                                </div>
                            </div>

                            {/* توقيعات */}
                            <div className="grid grid-cols-2 gap-6 pt-4 text-center text-[11px] text-slate-700">
                                <div className="border-t border-dashed border-slate-400 pt-2">
                                    {isAr ? 'توقيع واستلام الموظف' : 'Staff Signature'}
                                </div>
                                <div className="border-t border-dashed border-slate-400 pt-2">
                                    {isAr ? 'توقيع واعتماد الإدارة' : 'Manager Signature'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setShowStatementModal(false)}>
                                {isAr ? 'إغلاق' : 'Close'}
                            </Button>
                            <Button variant="primary" onClick={() => window.print()} className="flex items-center gap-1.5">
                                <Printer size={15} />
                                <span>{isAr ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* مودال تقرير مسير الرواتب والمستحقات المجمعة لفريق العمل بالكامل */}
            {showPayrollReports && (
                <ModalShell
                    title={isAr ? 'مسير الرواتب والمستحقات المجمعة لفريق العمل' : 'Consolidated Payroll Sheet'}
                    onClose={() => setShowPayrollReports(false)}
                    maxWidth="max-w-3xl"
                >
                    <div className="space-y-4 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                        {/* بطاقة المسير المطبوعة */}
                        <div className="p-4 bg-white text-black border border-slate-300 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div>
                                    <h3 className="font-extrabold text-sm">{state.settings.shopName || 'RIZON PRO'}</h3>
                                    <p className="text-xs text-slate-600 font-bold">{isAr ? 'كشف مسير رواتب وعمولات الموظفين' : 'Staff Payroll Sheet'}</p>
                                </div>
                                <span className="font-mono text-xs text-slate-500">{new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-300 text-slate-600 font-bold bg-slate-50">
                                            <th className="py-2 px-2">#</th>
                                            <th className="py-2 px-2">{isAr ? 'الموظف' : 'Staff'}</th>
                                            <th className="py-2 px-2">{isAr ? 'الوظيفة' : 'Role'}</th>
                                            <th className="py-2 px-2">{isAr ? 'المبيعات' : 'Sales'}</th>
                                            <th className="py-2 px-2 text-purple-700">{isAr ? 'العمولات (+)' : 'Comm'}</th>
                                            <th className="py-2 px-2 text-amber-700">{isAr ? 'السلف (-)' : 'Advances'}</th>
                                            <th className="py-2 px-2 text-emerald-700">{isAr ? 'الصافي المستحق' : 'Net Due'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 font-medium">
                                        {(state.staff || []).map((st, idx) => {
                                            const fin = staffFinancials.get(st.id);
                                            return (
                                                <tr key={st.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                                                    <td className="py-2 px-2 font-bold text-slate-900">{st.name}</td>
                                                    <td className="py-2 px-2 text-slate-600">{getRoleLabel(st.role)}</td>
                                                    <td className="py-2 px-2 font-mono">{formatNumber(fin?.invoicesTotal || 0)}</td>
                                                    <td className="py-2 px-2 font-mono text-purple-700 font-bold">{formatNumber(fin?.totalCommissions || 0)}</td>
                                                    <td className="py-2 px-2 font-mono text-amber-700 font-bold">{formatNumber(fin?.totalAdvances || 0)}</td>
                                                    <td className="py-2 px-2 font-mono text-emerald-700 font-bold">{formatNumber(fin?.netDue || 0)} ج.م</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-400 font-extrabold bg-slate-100 text-slate-900">
                                            <td colSpan={4} className="py-2 px-2 text-left pe-4">{isAr ? 'الإجمالي العام للمنشأة:' : 'Total:'}</td>
                                            <td className="py-2 px-2 font-mono text-purple-700">{formatNumber(teamSummary.totalCommissions)}</td>
                                            <td className="py-2 px-2 font-mono text-amber-700">{formatNumber(teamSummary.totalAdvances)}</td>
                                            <td className="py-2 px-2 font-mono text-emerald-700">{formatNumber(teamSummary.totalNetDue)} ج.م</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setShowPayrollReports(false)}>
                                {isAr ? 'إلغاء' : 'Close'}
                            </Button>
                            <Button variant="primary" onClick={() => window.print()} className="flex items-center gap-1.5">
                                <Printer size={15} />
                                <span>{isAr ? 'طباعة كشف المسير' : 'Print Sheet'}</span>
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* مودال إضافة عهدة وأدوات */}
            {showToolsModal && (
                <ModalShell
                    title={isAr ? 'تسليم عهدة وأدوات للموظف' : 'Assign Tool / Custody'}
                    onClose={() => setShowToolsModal(false)}
                    maxWidth="max-w-sm"
                >
                    <div className="space-y-3.5 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                        <div>
                            <Input
                                label={isAr ? 'اسم الأداة / العهدة *' : 'Tool / Item Name *'}
                                value={toolForm.name}
                                onChange={(e: any) => setToolForm({ ...toolForm, name: e.target.value })}
                                placeholder={isAr ? 'مثال: جهاز باركود، ماكينة حلاقة، مفتاح فرع' : 'e.g. Barcode scanner'}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {isAr ? 'حالة الأداة عند التسليم' : 'Condition'}
                            </label>
                            <select
                                value={toolForm.condition}
                                onChange={(e) => setToolForm({ ...toolForm, condition: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            >
                                <option value="New">{isAr ? 'جديدة بالكامل (New)' : 'New'}</option>
                                <option value="Used">{isAr ? 'مستعملة وبحالة جيدة (Used)' : 'Used'}</option>
                                <option value="Fair">{isAr ? 'متوسطة الحالة (Fair)' : 'Fair'}</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setShowToolsModal(false)}>
                                {isAr ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button variant="primary" onClick={handleAddTool}>
                                {isAr ? 'تسجيل العهدة' : 'Assign'}
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};
