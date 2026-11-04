/* تم تطوير هذا الملف لنظام ProCashier — واجهة الحجز السريعة والذكية بمراحل خطوة بخطوة وتقويم وساعة احترافية */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Calendar, Users, Clock, Plus, Trash2, FileText, Search, 
    Filter, X, Scissors, User, Check, Sparkles, AlertCircle, Phone, Tag,
    ChevronRight, ArrowLeft
} from '../components/Icons';
import { Reservation, Staff, Item } from '../types';
import { Card, Button, ModalShell } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { localIsoToday, toIsoDate } from '../lib/dates';

// أسماء الأشهر العربية
const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// أيام الأسبوع ابتداءً من السبت
const WEEKDAYS_AR = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

// أوقات الحجز السريعة الأكثر طلباً
const QUICK_TIME_SLOTS = [
    { labelAr: '10:00 ص', labelEn: '10:00 AM', value: '10:00 AM' },
    { labelAr: '11:00 ص', labelEn: '11:00 AM', value: '11:00 AM' },
    { labelAr: '12:00 م', labelEn: '12:00 PM', value: '12:00 PM' },
    { labelAr: '01:00 م', labelEn: '01:00 PM', value: '01:00 PM' },
    { labelAr: '02:00 م', labelEn: '02:00 PM', value: '02:00 PM' },
    { labelAr: '03:00 م', labelEn: '03:00 PM', value: '03:00 PM' },
    { labelAr: '04:00 م', labelEn: '04:00 PM', value: '04:00 PM' },
    { labelAr: '05:00 م', labelEn: '05:00 PM', value: '05:00 PM' },
    { labelAr: '06:00 م', labelEn: '06:00 PM', value: '06:00 PM' },
    { labelAr: '07:00 م', labelEn: '07:00 PM', value: '07:00 PM' },
    { labelAr: '08:00 م', labelEn: '08:00 PM', value: '08:00 PM' },
    { labelAr: '09:00 م', labelEn: '09:00 PM', value: '09:00 PM' },
    { labelAr: '10:00 م', labelEn: '10:00 PM', value: '10:00 PM' },
];

/**
 * مكون التقويم الاحترافي باللغة العربية
 */
const ArabicCalendarPicker = ({ 
    value, 
    onChange 
}: { 
    value: string; 
    onChange: (date: string) => void;
}) => {
    const today = useMemo(() => new Date(), []);
    const todayIso = useMemo(() => localIsoToday(), []);

    const resStats = useMemo(() => {
        const list = state.reservations || [];
        const todayCount = list.filter(r => r.date === todayIso).length;
        const confirmedCount = list.filter(r => r.status === 'confirmed').length;
        const completedCount = list.filter(r => r.status === 'completed').length;
        return {
            total: list.length,
            today: todayCount,
            confirmed: confirmedCount,
            completed: completedCount
        };
    }, [state.reservations, todayIso]);

    // تحليل التاريخ المختار
    const parsed = useMemo(() => {
        if (!value) return new Date();
        const parts = value.split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        return new Date();
    }, [value]);

    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());

    useEffect(() => {
        if (value) {
            const parts = value.split('-');
            if (parts.length === 3) {
                setViewYear(Number(parts[0]));
                setViewMonth(Number(parts[1]) - 1);
            }
        }
    }, [value]);

    // التنقل بين الشهور
    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    // حسابات أيام الشهر والسبت كأول يوم
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    // Sunday=0, Monday=1, ..., Saturday=6 => offset from Saturday
    const startOffset = (firstDayIndex + 1) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // فحص الأيام الماضية
    const isPastDate = (dayNum: number) => {
        const check = new Date(viewYear, viewMonth, dayNum, 23, 59, 59);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return check < todayStart;
    };

    const selectDay = (dayNum: number) => {
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(dayNum).padStart(2, '0');
        onChange(`${viewYear}-${m}-${d}`);
    };

    // تواريخ سريعة
    const setQuickDate = (offsetDays: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        onChange(`${yr}-${mo}-${dy}`);
    };

    return (
        <div className="space-y-3.5 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            {/* أزرار سريعة لاختيار التاريخ */}
            <div className="flex flex-wrap items-center gap-1.5 justify-center">
                <button
                    type="button"
                    onClick={() => setQuickDate(0)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                    اليوم
                </button>
                <button
                    type="button"
                    onClick={() => setQuickDate(1)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                    غداً
                </button>
                <button
                    type="button"
                    onClick={() => setQuickDate(2)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                    بعد غد
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const d = new Date();
                        const day = d.getDay();
                        // Next Friday (Friday=5 in JS)
                        const diff = (5 - day + 7) % 7 || 7;
                        setQuickDate(diff);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                    الجمعة القادمة
                </button>
            </div>

            {/* شريط رأس التقويم والشهر */}
            <div className="flex items-center justify-between px-2">
                <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    title="الشهر القادم"
                >
                    <ChevronRight size={18} />
                </button>

                <div className="text-center">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {ARABIC_MONTHS[viewMonth]} {viewYear}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    title="الشهر السابق"
                >
                    <ArrowLeft size={18} />
                </button>
            </div>

            {/* شبكة أيام الأسبوع */}
            <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS_AR.map((w, idx) => (
                    <div 
                        key={w} 
                        className={`text-[11px] font-bold py-1 ${idx === 6 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        {w}
                    </div>
                ))}

                {/* فراغات بداية الشهر */}
                {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`blank-${i}`} className="h-9" />
                ))}

                {/* أيام الشهر */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isSelected = value === dateStr;
                    const isToday = todayIso === dateStr;
                    const isPast = isPastDate(dayNum);

                    return (
                        <button
                            key={dayNum}
                            type="button"
                            disabled={isPast}
                            onClick={() => selectDay(dayNum)}
                            className={`h-9 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                                isSelected
                                    ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-500/30 scale-105 z-10 font-bold'
                                    : isToday
                                    ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 border border-primary-300 dark:border-primary-700 font-bold'
                                    : isPast
                                    ? 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs'
                            }`}
                        >
                            <span>{dayNum}</span>
                            {isToday && !isSelected && (
                                <span className="w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400 absolute bottom-1" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * مكون الساعة التفاعلية لاختيار الوقت بلمسة واحدة
 */
const VisualClockPicker = ({
    value,
    onChange
}: {
    value: string;
    onChange: (timeStr: string) => void;
}) => {
    // تحليل الوقت (12h format: e.g. "04:30 PM")
    const { hour, minute, period } = useMemo(() => {
        let h = 4;
        let m = 0;
        let p = 'PM';
        if (value) {
            const parts = value.trim().split(' ');
            if (parts.length >= 2) {
                p = parts[1].toUpperCase() === 'AM' ? 'AM' : 'PM';
                const timeParts = parts[0].split(':');
                if (timeParts.length >= 2) {
                    h = parseInt(timeParts[0], 10) || 4;
                    m = parseInt(timeParts[1], 10) || 0;
                }
            }
        }
        return { hour: h, minute: m, period: p };
    }, [value]);

    const setTimeComponents = (newH: number, newM: number, newP: string) => {
        const hStr = String(newH).padStart(2, '0');
        const mStr = String(newM).padStart(2, '0');
        onChange(`${hStr}:${mStr} ${newP}`);
    };

    const togglePeriod = (p: 'AM' | 'PM') => {
        setTimeComponents(hour, minute, p);
    };

    const selectHour = (h: number) => {
        setTimeComponents(h, minute, period);
    };

    const selectMinute = (m: number) => {
        setTimeComponents(hour, m, period);
    };

    // زوايا الساعات 1 إلى 12
    const clockHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    // زاوية عقرب الساعات
    const hourAngle = ((hour % 12) + minute / 60) * 30;

    return (
        <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            {/* شريط العرض الرقمي والصباح والمساء */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-primary-600 text-white flex items-center justify-center shadow-xs">
                        <Clock size={20} />
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-400 font-bold">الوقت المحدد</div>
                        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wider">
                            {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')} {period === 'AM' ? 'صباحاً' : 'مساءً'}
                        </div>
                    </div>
                </div>

                {/* زر التبديل صباحاً ومساءً */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => togglePeriod('AM')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            period === 'AM'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                        }`}
                    >
                        ص
                    </button>
                    <button
                        type="button"
                        onClick={() => togglePeriod('PM')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            period === 'PM'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                        }`}
                    >
                        م
                    </button>
                </div>
            </div>

            {/* شكل الساعة الدائرية التفاعلية */}
            <div className="flex flex-col items-center justify-center py-2">
                <div className="relative w-56 h-56 rounded-full border-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-inner flex items-center justify-center">
                    {/* النقطة المركزية وعقرب الساعات */}
                    <div className="w-3.5 h-3.5 rounded-full bg-primary-600 z-20 shadow-xs" />
                    
                    {/* العقرب المتحرك */}
                    <div 
                        className="absolute w-1 bg-gradient-to-t from-primary-600 to-indigo-500 rounded-full origin-bottom z-10 transition-transform duration-300 pointer-events-none"
                        style={{
                            height: '62px',
                            bottom: '50%',
                            transform: `rotate(${hourAngle}deg)`
                        }}
                    />

                    {/* أزرار الساعات حول الدائرة */}
                    {clockHours.map((h) => {
                        // زاوية كل ساعة بالراديان (الساعة 12 بالأعلى = -90 درجة)
                        const angleDeg = (h * 30) - 90;
                        const angleRad = (angleDeg * Math.PI) / 180;
                        const radius = 80; // بكسل من المركز
                        const x = Math.round(radius * Math.cos(angleRad));
                        const y = Math.round(radius * Math.sin(angleRad));

                        const isSelected = hour === h;

                        return (
                            <button
                                key={h}
                                type="button"
                                onClick={() => selectHour(h)}
                                style={{
                                    transform: `translate(${x}px, ${y}px)`
                                }}
                                className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-500/40 scale-110 font-bold z-20'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {h}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* أزرار اختيار الدقائق السريعة */}
            <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 text-center">
                    اختيار الدقائق
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {[
                        { label: ':00 تماماً', val: 0 },
                        { label: ':15 وربع', val: 15 },
                        { label: ':30 ونصف', val: 30 },
                        { label: ':45 إلا ربع', val: 45 },
                    ].map((mItem) => {
                        const isSelected = minute === mItem.val;
                        return (
                            <button
                                key={mItem.val}
                                type="button"
                                onClick={() => selectMinute(mItem.val)}
                                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                                    isSelected
                                        ? 'bg-primary-600 text-white shadow-xs font-bold'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary-400'
                                }`}
                            >
                                {mItem.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* مواعيد سريعة جاهزة بلمسة واحدة */}
            <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    أوقات الحجز الشائعة (اختر مباشرة):
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 custom-scrollbar">
                    {QUICK_TIME_SLOTS.map((slot) => {
                        const isSelected = value === slot.value;
                        return (
                            <button
                                key={slot.value}
                                type="button"
                                onClick={() => onChange(slot.value)}
                                className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                                    isSelected
                                        ? 'bg-primary-600 text-white font-bold'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {slot.labelAr}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const ReservationsPage = () => {
    const { state, t, language, addReservation, addToast } = useApp();
    const rtl = language === 'ar';

    const todayIso = useMemo(() => localIsoToday(), []);

    const resStats = useMemo(() => {
        const list = state.reservations || [];
        const todayCount = list.filter(r => r.date === todayIso).length;
        const confirmedCount = list.filter(r => r.status === 'confirmed').length;
        const completedCount = list.filter(r => r.status === 'completed').length;
        return {
            total: list.length,
            today: todayCount,
            confirmed: confirmedCount,
            completed: completedCount
        };
    }, [state.reservations, todayIso]);

    // حالة حقول الحجز الجديد
    const [name, setName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState(0);
    const [date, setDate] = useState(todayIso);
    const [time, setTime] = useState('04:00 PM');
    const [selectedService, setSelectedService] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [reservationStatus, setReservationStatus] = useState<'confirmed' | 'pending'>('confirmed');
    const [notes, setNotes] = useState('');
    const [showModal, setShowModal] = useState(false);

    // مرحلة الخطوات (1: العميل والخدمة، 2: التاريخ، 3: الوقت، 4: المراجعة والتأكيد)
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // البحث عن عميل في الإكمال التلقائي
    const [customerQuery, setCustomerQuery] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
                setShowCustomerSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCustomerSuggestions = useMemo(() => {
        const q = (customerQuery || '').trim().toLowerCase();
        if (!q) return state.customers.slice(0, 8);
        return state.customers.filter(c =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        ).slice(0, 10);
    }, [customerQuery, state.customers]);

    // الخدمات المسجلة في النظام لاستخدامها كأزرار سريعة
    const availableServices = useMemo(() => {
        const services = state.items.filter(i => i.type === 'service');
        if (services.length > 0) return services.slice(0, 8);
        return [
            { id: '1', nameAr: 'قص شعر', nameEn: 'Haircut' },
            { id: '2', nameAr: 'حلاقة ذقن', nameEn: 'Beard Trim' },
            { id: '3', nameAr: 'قص + ذقن', nameEn: 'Hair & Beard' },
            { id: '4', nameAr: 'تنظيف وتفتيح بشرة', nameEn: 'Facial' },
            { id: '5', nameAr: 'استشوار وكرياتين', nameEn: 'Styling' },
            { id: '6', nameAr: 'صبغة وتلوين', nameEn: 'Coloring' },
            { id: '7', nameAr: 'باقة VIP كاملة', nameEn: 'VIP Package' },
        ];
    }, [state.items]);

    const activeStaff = useMemo(() => {
        const list = state.staff.filter(s => s.active !== false);
        return list.length > 0 ? list : state.staff;
    }, [state.staff]);

    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ search: '', startDate: '', endDate: '', staffId: '' });

    const resetForm = () => {
        setName('');
        setCustomerPhone('');
        setSelectedCustomerId(0);
        setCustomerQuery('');
        setDate(todayIso);
        setTime('04:00 PM');
        setSelectedService('');
        setSelectedStaffId('');
        setReservationStatus('confirmed');
        setNotes('');
        setStep(1);
    };

    // التحقق من صحة الخطوات قبل التقدم
    const handleNextStep = () => {
        if (step === 1) {
            const finalName = (name || customerQuery).trim();
            if (!finalName) {
                addToast(rtl ? 'يرجى إدخال اسم العميل أولاً' : 'Please enter customer name', 'error');
                return;
            }
            setStep(2);
        } else if (step === 2) {
            if (!date) {
                addToast(rtl ? 'يرجى اختيار تاريخ الموعد' : 'Please select date', 'error');
                return;
            }
            setStep(3);
        } else if (step === 3) {
            if (!time) {
                addToast(rtl ? 'يرجى اختيار وقت الموعد' : 'Please select time', 'error');
                return;
            }
            setStep(4);
        }
    };

    const handlePrevStep = () => {
        if (step > 1) {
            setStep((step - 1) as any);
        }
    };

    // حفظ الحجز النهائي
    const handleSaveReservation = () => {
        const finalName = (name || customerQuery).trim();
        if (!finalName) {
            addToast(rtl ? 'يرجى إدخال اسم العميل' : 'Please enter customer name', 'error');
            setStep(1);
            return;
        }

        const newRes: Reservation = {
            id: crypto.randomUUID(),
            locationId: state.settings.currentLocationId || '',
            customerId: selectedCustomerId,
            customerName: customerPhone ? `${finalName} (${customerPhone})` : finalName,
            date,
            time,
            serviceName: selectedService,
            notes: notes.trim(),
            status: reservationStatus,
            staffId: selectedStaffId || undefined,
        };

        addReservation(newRes);
        addToast(rtl ? `تم تسجيل موعد ${finalName} بنجاح` : 'Reservation added successfully', 'success');
        resetForm();
        setShowModal(false);
    };

    // تنسيق التاريخ للعرض باللغة العربية
    const formatDateDisplay = (isoDate: string) => {
        if (!isoDate) return '';
        try {
            const parts = isoDate.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                return d.toLocaleDateString(rtl ? 'ar-EG' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        } catch {
            // fallback
        }
        return isoDate;
    };

    const filteredReservations = state.reservations.filter(r => {
        const matchesSearch = activeFilters.search ? (r.customerName.toLowerCase().includes(activeFilters.search.toLowerCase())) : true;
        let matchesDate = true;
        if (activeFilters.startDate && r.date < activeFilters.startDate) matchesDate = false;
        if (activeFilters.endDate && r.date > activeFilters.endDate) matchesDate = false;
        const matchesStaff = activeFilters.staffId ? r.staffId === activeFilters.staffId : true;
        return matchesSearch && matchesDate && matchesStaff;
    });

    const getStaffName = (id?: string) => {
        if (!id) return rtl ? 'أي متخصص' : 'Any Staff';
        return state.staff.find(s => s.id === id)?.name || '-';
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const tableContent = document.getElementById('reservations-table')?.outerHTML;
        if (!tableContent) {
            addToast(t('table_not_found'), 'error');
            printWindow.close();
            return;
        }

        const html = `
            <html dir="${rtl ? 'rtl' : 'ltr'}">
            <head>
                <title>${t('reservations_list')}</title>
                <style>
                    body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: ${rtl ? 'right' : 'left'}; font-size: 13px; }
                    th { background-color: #f2f2f2; }
                    h2 { text-align: center; font-size: 18px; margin-bottom: 10px; }
                    .status-confirmed { color: #16a34a; font-weight: bold; }
                    .status-pending { color: #ca8a04; font-weight: bold; }
                    .status-cancelled { color: #dc2626; font-weight: bold; }
                    button { display: none !important; }
                </style>
            </head>
            <body>
                <h2>${t('reservations_list')}</h2>
                ${tableContent}
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            try { printWindow.focus(); printWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { printWindow.close(); } catch { /* ignore */ } }, 500);
        };
    };

    return (
        <div className="space-y-6">
            {/* الترويسة الرئيسية مع شريط البحث والفلترة والزر البارز */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm backdrop-blur-sm">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Calendar className="text-primary-600 dark:text-primary-400" size={26} />
                        <span>{t('reservations_list')}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {rtl ? 'إدارة مواعيد وحجوزات العملاء بسهولة وسرعة' : 'Manage customer appointments quickly and easily'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={handleExportPDF} className="px-3 hidden md:flex items-center gap-1.5" title={t('export_pdf')}>
                        <FileText size={18} />
                        <span>PDF</span>
                    </Button>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={rtl ? 'بحث باسم العميل...' : t('search_placeholder')} 
                            value={activeFilters.search}
                            onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
                            className="pl-9 pr-4 rtl:pr-9 rtl:pl-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-full outline-none focus:ring-2 focus:ring-primary-500 transition-all text-xs font-medium shadow-inner"
                        />
                    </div>

                    <Button variant="secondary" onClick={() => setShowFilterModal(true)} className="px-3">
                        <Filter size={18} className="mr-1.5 rtl:mr-0 rtl:ml-1.5" />
                        <span>{t('filter')}</span>
                        {(activeFilters.startDate || activeFilters.endDate || activeFilters.staffId) && (
                            <span className="w-2 h-2 bg-red-500 rounded-full inline-block mr-1"></span>
                        )}
                    </Button>

                    <button 
                        type="button"
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                    >
                        <Plus size={20} />
                        <span>{t('new_reservation')}</span>
                    </button>
                </div>
            </div>
            
            <FilterModal 
                isOpen={showFilterModal} 
                onClose={() => setShowFilterModal(false)}
                onApply={setActiveFilters}
                initialFilters={activeFilters}
                showSearch={false}
                staffList={state.staff}
            />

                        {/* بطاقات إحصائيات الحجوزات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'إجمالي الحجوزات' : 'Total Bookings'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/40">الكل</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                        {resStats.total} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'حجوزات اليوم' : 'Today'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800/40">اليوم</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                        {resStats.today} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'مؤكدة' : 'Confirmed'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">مؤكد</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                        {resStats.confirmed} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'مكتملة' : 'Completed'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/40">مكتمل</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                        {resStats.completed} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>
            </div>

            {/* جدول الحجوزات */}
            <Card id="reservations-table" className="overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-sm rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3.5 font-bold">{t('customer_name')}</th>
                                <th className="px-5 py-3.5 font-bold">{rtl ? 'الخدمة' : 'Service'}</th>
                                <th className="px-5 py-3.5 font-bold">{t('barber')}</th>
                                <th className="px-5 py-3.5 font-bold">{t('date')}</th>
                                <th className="px-5 py-3.5 font-bold">{t('time')}</th>
                                <th className="px-5 py-3.5 font-bold">{t('status')}</th>
                                <th className="px-5 py-3.5 font-bold">{rtl ? 'ملاحظات' : 'Notes'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredReservations.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold">
                                            {r.customerName.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{r.customerName}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                                        {r.serviceName ? (
                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                                                {r.serviceName}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                                        {getStaffName(r.staffId)}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 font-mono text-xs">
                                        {formatDateDisplay(r.date)}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1">
                                        <Clock size={13} className="text-slate-400" />
                                        <span>{r.time}</span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1
                                            ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 
                                              r.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 
                                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'confirmed' ? 'bg-emerald-500' : r.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                                            {r.status === 'confirmed' ? (rtl ? 'مؤكد' : 'Confirmed') : r.status === 'pending' ? (rtl ? 'قيد الانتظار' : 'Pending') : t(r.status)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                        {r.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                            {filteredReservations.length === 0 && (
                                <tr>
                                    <td className="px-5 py-12 text-center text-slate-400" colSpan={7}>
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Calendar size={36} className="text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm font-bold">{rtl ? 'لا توجد حجوزات مسجلة' : t('no_data')}</p>
                                            <p className="text-xs text-slate-400">{rtl ? 'اضغط زر "حجز جديد" بالأعلى لإضافة موعد للعميل' : 'Click "New Reservation" to book an appointment'}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* نافذة الحجز الجديد الاحترافية بنظام المراحل خطوة بخطوة وتقويم وساعة مخصصة */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    <div 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100"
                        dir={rtl ? 'rtl' : 'ltr'}
                    >
                        {/* ترويسة المودال مع مؤشر المراحل (Step Indicator) */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold">
                                            {rtl ? 'حجز موعد جديد' : 'New Appointment'}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {step === 1 && (rtl ? 'المرحلة 1 من 4: بيانات العميل والخدمة' : 'Step 1 of 4: Client & Service')}
                                            {step === 2 && (rtl ? 'المرحلة 2 من 4: تحديد يوم الموعد' : 'Step 2 of 4: Choose Date')}
                                            {step === 3 && (rtl ? 'المرحلة 3 من 4: ضبط وقت وساعة الموعد' : 'Step 3 of 4: Choose Time')}
                                            {step === 4 && (rtl ? 'المرحلة 4 من 4: مراجعة وتأكيد الحجز' : 'Step 4 of 4: Review & Confirm')}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* شريط المراحل التفاعلي */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { s: 1, label: 'العميل', icon: null },
                                    { s: 2, label: 'التاريخ', icon: null },
                                    { s: 3, label: 'الوقت', icon: null },
                                    { s: 4, label: 'التأكيد', icon: null },
                                ].map((item) => (
                                    <button
                                        key={item.s}
                                        type="button"
                                        onClick={() => {
                                            // السماح بالرجوع أو التنقل إذا تم التحقق من العميل
                                            if (item.s < step || (name || customerQuery).trim()) {
                                                setStep(item.s as any);
                                            }
                                        }}
                                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            step === item.s
                                                ? 'bg-primary-600 text-white shadow-xs font-bold'
                                                : step > item.s
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                                : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 opacity-60'
                                        }`}
                                    >
                                        <span>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* محتوى المرحلة الحالية القابل للتمرير */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                            
                            {/* المرحلة 1: بيانات العميل، الخدمة، والحلاق */}
                            {step === 1 && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* اسم العميل ورقم الهاتف */}
                                    <div className="space-y-1.5" ref={customerDropdownRef}>
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <User size={15} className="text-primary-500" />
                                                <span>{rtl ? 'اسم العميل / رقم الهاتف' : 'Customer Name / Phone'}</span>
                                                <span className="text-red-500">*</span>
                                            </span>
                                            {selectedCustomerId > 0 && (
                                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    {rtl ? 'عميل مسجل في النظام' : 'Registered Client'}
                                                </span>
                                            )}
                                        </label>

                                        <div className="relative">
                                            <input 
                                                type="text"
                                                autoFocus
                                                placeholder={rtl ? 'ابحث باسم العميل أو رقمه، أو اكتب اسماً جديداً...' : 'Search customer or type name...'}
                                                value={customerQuery || name}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCustomerQuery(val);
                                                    setName(val);
                                                    setShowCustomerSuggestions(true);
                                                    if (!val) {
                                                        setSelectedCustomerId(0);
                                                        setCustomerPhone('');
                                                    }
                                                }}
                                                onFocus={() => setShowCustomerSuggestions(true)}
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium text-sm transition-all shadow-xs"
                                            />

                                            {/* قائمة الاقتراحات السريعة للعملاء */}
                                            {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                                    {filteredCustomerSuggestions.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setName(c.name);
                                                                setCustomerQuery(c.name);
                                                                setCustomerPhone(c.phone || '');
                                                                setSelectedCustomerId(c.id);
                                                                setShowCustomerSuggestions(false);
                                                            }}
                                                            className="w-full px-4 py-2.5 flex items-center justify-between text-right hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-600 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
                                                                    {c.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-xs text-slate-800 dark:text-slate-100">{c.name}</div>
                                                                    <div className="text-[11px] text-slate-400 font-mono">{c.phone || '-'}</div>
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                                                {c.tier || 'Client'}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* الخدمة المطلوبة */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Scissors size={15} className="text-primary-500" />
                                                <span>{rtl ? 'الخدمة المطلوبة' : 'Requested Service'}</span>
                                                <span className="text-[10px] text-slate-400 font-normal">({rtl ? 'اختياري' : 'optional'})</span>
                                            </span>
                                            {selectedService && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => setSelectedService('')} 
                                                    className="text-[10px] text-red-500 hover:underline"
                                                >
                                                    {rtl ? 'إلغاء التحديد' : 'Clear'}
                                                </button>
                                            )}
                                        </label>

                                        <div className="flex flex-wrap gap-1.5">
                                            {availableServices.map((srv) => {
                                                const srvName = rtl ? srv.nameAr : (srv.nameEn || srv.nameAr);
                                                const isSelected = selectedService === srvName;
                                                return (
                                                    <button
                                                        key={srv.id}
                                                        type="button"
                                                        onClick={() => setSelectedService(isSelected ? '' : srvName)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            isSelected
                                                                ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-400'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        {isSelected && <Check size={12} />}
                                                        <span>{srvName}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* الحلاق / المتخصص */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Users size={15} className="text-primary-500" />
                                            <span>{rtl ? 'المتخصص أو الحلاق' : 'Staff / Specialist'}</span>
                                        </label>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStaffId('')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    !selectedStaffId
                                                        ? 'bg-primary-600 text-white shadow-xs ring-2 ring-primary-400'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <span>{rtl ? 'أي متخصص متاح' : 'Any Available'}</span>
                                            </button>

                                            {activeStaff.map((s) => {
                                                const isSelected = selectedStaffId === s.id;
                                                return (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        onClick={() => setSelectedStaffId(s.id)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            isSelected
                                                                ? 'bg-primary-600 text-white shadow-xs ring-2 ring-primary-400'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${isSelected ? 'bg-white text-primary-600' : 'bg-primary-100 dark:bg-primary-900 text-primary-700'}`}>
                                                            {s.name.charAt(0)}
                                                        </div>
                                                        <span>{s.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* المرحلة 2: اختيار التاريخ بالتقويم العربي الاحترافي */}
                            {step === 2 && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Calendar size={16} className="text-primary-500" />
                                            <span>{rtl ? 'حدد يوم وتاريخ الموعد' : 'Select Date'}</span>
                                        </label>
                                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-3 py-1 rounded-xl">
                                            {formatDateDisplay(date)}
                                        </span>
                                    </div>

                                    {/* مكون التقويم العربي الاحترافي */}
                                    <ArabicCalendarPicker value={date} onChange={setDate} />
                                </div>
                            )}

                            {/* المرحلة 3: اختيار الوقت بالساعة التفاعلية */}
                            {step === 3 && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <Clock size={16} className="text-primary-500" />
                                            <span>{rtl ? 'حدد وقت وساعة الموعد' : 'Select Appointment Time'}</span>
                                        </label>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl font-mono">
                                            {time}
                                        </span>
                                    </div>

                                    {/* مكون الساعة التفاعلية */}
                                    <VisualClockPicker value={time} onChange={setTime} />
                                </div>
                            )}

                            {/* المرحلة 4: مراجعة وتأكيد الحجز النهائي */}
                            {step === 4 && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* بطاقة ملخص الحجز */}
                                    <div className="bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-slate-800/80 dark:to-slate-800/40 p-5 rounded-2xl border border-primary-200 dark:border-slate-700 space-y-3">
                                        <div className="text-xs font-bold text-primary-700 dark:text-primary-300 flex items-center gap-1.5 border-b border-primary-100 dark:border-slate-700 pb-2">
                                            <Sparkles size={16} />
                                            <span>{rtl ? 'ملخص بيانات الموعد قبل التأكيد' : 'Appointment Summary'}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-slate-400 block text-[11px]">{rtl ? 'العميل:' : 'Client:'}</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                                    {name || customerQuery}
                                                </span>
                                                {customerPhone && (
                                                    <span className="text-slate-500 block text-[11px] font-mono">{customerPhone}</span>
                                                )}
                                            </div>

                                            <div>
                                                <span className="text-slate-400 block text-[11px]">{rtl ? 'الخدمة المطلوبة:' : 'Service:'}</span>
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                                    {selectedService || (rtl ? 'غير محددة' : 'Not specified')}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-slate-400 block text-[11px]">{rtl ? 'التاريخ المحدد:' : 'Date:'}</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {formatDateDisplay(date)}
                                                </span>
                                            </div>

                                            <div>
                                                <span className="text-slate-400 block text-[11px]">{rtl ? 'الوقت المحدد:' : 'Time:'}</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono text-sm">
                                                    {time}
                                                </span>
                                            </div>

                                            <div className="col-span-2">
                                                <span className="text-slate-400 block text-[11px]">{rtl ? 'المتخصص أو الحلاق:' : 'Staff:'}</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {getStaffName(selectedStaffId)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* حالة الحجز وملاحظات إضافية */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {rtl ? 'حالة الحجز' : 'Status'}
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setReservationStatus('confirmed')}
                                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        reservationStatus === 'confirmed'
                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <Check size={14} />
                                                    <span>{rtl ? 'مؤكد' : 'Confirmed'}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setReservationStatus('pending')}
                                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        reservationStatus === 'pending'
                                                            ? 'bg-amber-600 text-white shadow-xs'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <Clock size={14} />
                                                    <span>{rtl ? 'قيد الانتظار' : 'Pending'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {rtl ? 'ملاحظات إضافية' : 'Notes'}
                                            </label>
                                            <input 
                                                type="text"
                                                placeholder={rtl ? 'أية طلبات أو ملاحظات خاصة...' : 'Any special notes...'}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium outline-none focus:ring-1 focus:ring-primary-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* شريط الإجراءات السفلي مع التنقل خطوة بخطوة */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                            <div>
                                {step > 1 ? (
                                    <button
                                        type="button"
                                        onClick={handlePrevStep}
                                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                                    >
                                        {rtl ? '← السابق' : 'Back'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                                    >
                                        {t('cancel')}
                                    </button>
                                )}
                            </div>

                            <div>
                                {step < 4 ? (
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                                    >
                                        <span>
                                            {step === 1 && (rtl ? 'التالي: اختيار التاريخ' : 'Next: Pick Date')}
                                            {step === 2 && (rtl ? 'التالي: اختيار الوقت' : 'Next: Pick Time')}
                                            {step === 3 && (rtl ? 'التالي: مراجعة الحجز' : 'Next: Review')}
                                        </span>
                                        <ChevronRight size={16} className="rtl:rotate-180" />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSaveReservation}
                                        className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                                    >
                                        <Check size={18} />
                                        <span>{rtl ? 'تأكيد وحفظ الحجز' : 'Confirm & Save'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
