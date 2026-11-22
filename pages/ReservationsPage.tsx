/* تم تطوير هذا الملف لنظام ProCashier — واجهة الحجز السريعة والذكية بمراحل خطوة بخطوة وتقويم وساعة احترافية */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Calendar, Users, Clock, Plus, Trash2, FileText, Search, 
    Filter, X, Scissors, User, Check, Sparkles, AlertCircle, Phone, Tag,
    ChevronRight, ArrowLeft, MessageSquare, Printer
} from '../components/Icons';
import { Reservation, Staff, Item } from '../types';
import { Card, Button, ModalShell } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { localIsoToday, toIsoDate } from '../lib/dates';
import { pushBookingSettingsToSupabase, pullBookingSettingsFromSupabase, pushCustomerNotificationToSupabase } from '../lib/supabaseSync';

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
    const { state } = useApp();
    const today = useMemo(() => new Date(), []);
    const todayIso = useMemo(() => localIsoToday(), []);

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const resStats = useMemo(() => {
        const list = (state.reservations || []).filter(r => !r.locationId || String(r.locationId) === activeLocationId);
        const todayCount = list.filter(r => r.date === todayIso).length;
        const confirmedCount = list.filter(r => r.status === 'confirmed').length;
        const completedCount = list.filter(r => r.status === 'completed').length;
        const pendingCount = list.filter(r => r.status === 'pending').length;
        return {
            total: list.length,
            today: todayCount,
            confirmed: confirmedCount,
            completed: completedCount,
            pending: pendingCount
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

export const ReservationsPage = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
    const { state, t, language, addReservation, updateReservation, deleteReservation, addCustomer, addToast } = useApp();
    const rtl = language === 'ar';

    const todayIso = useMemo(() => localIsoToday(), []);

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const resStats = useMemo(() => {
        const list = (state.reservations || []).filter(r => !r.locationId || String(r.locationId) === activeLocationId);
        const todayCount = list.filter(r => r.date === todayIso).length;
        const confirmedCount = list.filter(r => r.status === 'confirmed').length;
        const completedCount = list.filter(r => r.status === 'completed').length;
        const pendingCount = list.filter(r => r.status === 'pending').length;
        return {
            total: list.length,
            today: todayCount,
            confirmed: confirmedCount,
            completed: completedCount,
            pending: pendingCount
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

    // النمط الإبداعي للعرض: جدول تقليدي أو مخطط كراسي ومقاعد الصالون التفاعلي
    const [viewMode, setViewMode] = useState<'table' | 'chairs'>('table');
    const [chairsDate, setChairsDate] = useState<string>(() => localIsoToday());
    const [vipPassRes, setVipPassRes] = useState<Reservation | null>(null);

    // حالة نافذة إعدادات مواعيد الحجز والعطلات وإجازات الحلاقين
    const [showAdminSettings, setShowAdminSettings] = useState(false);
    const [adminSettingsTab, setAdminSettingsTab] = useState<'hours' | 'holidays' | 'leaves'>('hours');
    const [bookingConfig, setBookingConfig] = useState<{
        workingHours: {
            startTime: string;
            endTime: string;
            slotDurationMinutes: number;
        };
        weeklyOffDays: number[];
        holidays: { id: string; date: string; title: string }[];
        staffLeaves: { id: string; staffId: string; staffName: string; startDate: string; endDate: string; isSingleDay: boolean; reason: string }[];
    }>(() => {
        try {
            const local = localStorage.getItem('salon_booking_settings');
            if (local) return JSON.parse(local);
        } catch(e) {}
        return {
            workingHours: { startTime: '10:00', endTime: '23:30', slotDurationMinutes: 30 },
            weeklyOffDays: [],
            holidays: [],
            staffLeaves: []
        };
    });

    // حقول إضافة إجازة حلاق
    const [leaveStaffId, setLeaveStaffId] = useState('');
    const [leaveStartDate, setLeaveStartDate] = useState(todayIso);
    const [leaveEndDate, setLeaveEndDate] = useState(todayIso);
    const [leaveIsSingleDay, setLeaveIsSingleDay] = useState(true);
    const [leaveReason, setLeaveReason] = useState('إجازة سنوية');

    // حقول إضافة عطلة للصالون
    const [holidayDate, setHolidayDate] = useState(todayIso);
    const [holidayTitle, setHolidayTitle] = useState('');

    // سحب الإعدادات الحالية من Supabase عند الفتح
    useEffect(() => {
        pullBookingSettingsFromSupabase(state.settings.supabaseUrl, state.settings.supabaseKey).then(res => {
            if (res.ok && res.settings) {
                setBookingConfig(res.settings);
                try { localStorage.setItem('salon_booking_settings', JSON.stringify(res.settings)); } catch(e) {}
            }
        }).catch(() => {});
    }, [state.settings.supabaseUrl, state.settings.supabaseKey]);

    const handleToggleWeeklyOff = (dayIndex: number) => {
        setBookingConfig(prev => {
            const current = prev.weeklyOffDays || [];
            const exists = current.includes(dayIndex);
            const next = exists ? current.filter(d => d !== dayIndex) : [...current, dayIndex];
            return { ...prev, weeklyOffDays: next };
        });
    };

    const handleAddLeave = () => {
        if (!leaveStaffId) {
            addToast(rtl ? 'يرجى اختيار الحلاق أولاً' : 'Please select a staff member', 'error');
            return;
        }
        const staffObj = state.staff.find(s => String(s.id) === String(leaveStaffId));
        const newLeave = {
            id: `leave_${Date.now()}`,
            staffId: String(leaveStaffId),
            staffName: staffObj?.name || 'مصفف',
            startDate: leaveStartDate,
            endDate: leaveIsSingleDay ? leaveStartDate : leaveEndDate,
            isSingleDay: leaveIsSingleDay,
            reason: leaveReason.trim() || 'إجازة اعتيادية'
        };
        setBookingConfig(prev => ({
            ...prev,
            staffLeaves: [newLeave, ...(prev.staffLeaves || [])]
        }));
        addToast(rtl ? `تم تسجيل إجازة ${staffObj?.name}` : 'Staff leave registered', 'success');
        setLeaveReason('إجازة سنوية');
    };

    const handleDeleteLeave = (leaveId: string) => {
        setBookingConfig(prev => ({
            ...prev,
            staffLeaves: (prev.staffLeaves || []).filter(l => l.id !== leaveId)
        }));
        addToast(rtl ? 'تم حذف الإجازة' : 'Leave removed', 'info');
    };

    const handleAddHoliday = () => {
        if (!holidayTitle.trim() || !holidayDate) {
            addToast(rtl ? 'يرجى إدخال اسم العطلة وتاريخها' : 'Please provide holiday title & date', 'error');
            return;
        }
        const newHol = {
            id: `hol_${Date.now()}`,
            date: holidayDate,
            title: holidayTitle.trim()
        };
        setBookingConfig(prev => ({
            ...prev,
            holidays: [...(prev.holidays || []), newHol]
        }));
        setHolidayTitle('');
        addToast(rtl ? 'تمت إضافة العطلة بنجاح' : 'Holiday added', 'success');
    };

    const handleDeleteHoliday = (holId: string) => {
        setBookingConfig(prev => ({
            ...prev,
            holidays: (prev.holidays || []).filter(h => h.id !== holId)
        }));
        addToast(rtl ? 'تم حذف العطلة' : 'Holiday deleted', 'info');
    };

    const handleSaveAllBookingSettings = async () => {
        try {
            localStorage.setItem('salon_booking_settings', JSON.stringify(bookingConfig));
            await pushBookingSettingsToSupabase(bookingConfig, state.settings.supabaseUrl, state.settings.supabaseKey);
            addToast(rtl ? '✅ تم حفظ وتعميم إعدادات الحجز والإجازات سحابياً بنجاح!' : 'Booking settings saved & synced to cloud!', 'success');
            setShowAdminSettings(false);
        } catch(e: any) {
            addToast(rtl ? 'فشل حفظ الإعدادات سحابياً' : 'Failed to save settings', 'error');
        }
    };

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

        let custId = selectedCustomerId;
        if (!custId) {
            const cleanP = customerPhone ? customerPhone.trim() : '';
            const existing = state.customers.find(c => 
                c.name.trim().toLowerCase() === finalName.toLowerCase() || 
                (cleanP && c.phone === cleanP)
            );
            if (existing) {
                custId = existing.id;
            } else {
                const newId = addCustomer({
                    name: finalName,
                    phone: cleanP,
                    creditLimit: 2000,
                    balance: 0,
                    locationId: state.settings.currentLocationId || '',
                    notes: 'تم تسجيله تلقائياً من شاشة الحجوزات'
                } as any);
                custId = typeof newId === 'number' ? newId : 0;
            }
        }

        const newRes: Reservation = {
            id: crypto.randomUUID(),
            locationId: state.settings.currentLocationId || '',
            customerId: custId,
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

    // تنسيق التاريخ والوقت للموعد وفق طلب المستخدم:
    // يسجل الوقت واسفله التاريخ مثل:
    // 12:00 | PM
    // 1/1/2027
    const formatAppointmentDate = (dateStr: string): string => {
        if (!dateStr) return '-';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const y = parts[0];
                const m = parseInt(parts[1], 10);
                const d = parseInt(parts[2], 10);
                return `${d}/${m}/${y}`;
            }
        } catch {}
        return dateStr;
    };

    const formatAppointmentTime = (timeStr: string): string => {
        if (!timeStr) return '-';
        let s = timeStr.trim();
        s = s.replace(/\s*م\s*$/, ' PM').replace(/\s*ص\s*$/, ' AM');
        if (s.includes(' | ')) return s;
        const m = s.match(/^(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
        if (m) {
            const hhmm = m[1];
            const period = m[2] ? m[2].toUpperCase() : '';
            return period ? `${hhmm} | ${period}` : hhmm;
        }
        if (/[\s]+[Pp][Mm]/.test(s)) return s.replace(/[\s]+[Pp][Mm]/, ' | PM');
        if (/[\s]+[Aa][Mm]/.test(s)) return s.replace(/[\s]+[Aa][Mm]/, ' | AM');
        return s;
    };

    const extractCustomerInfo = (r: Partial<Reservation> | null | undefined) => {
        const rawName = (r?.customerName || (r as any)?.customer_name || '').trim();
        const pMatch = rawName ? rawName.match(/\(([^)]+)\)/) : null;
        const rawPhone = (r as any)?.phone || (pMatch ? pMatch[1] : (state.customers.find(c => c.id === r?.customerId)?.phone || ''));
        const cleanPhone = (rawPhone || '').replace(/[^0-9+]/g, '');
        const cleanCustomerName = rawName ? rawName.replace(/\s*\([^)]*\)/, '').trim() : 'عميل بدون اسم';
        return { rawName, cleanCustomerName, rawPhone, cleanPhone };
    };

    const filteredReservations = state.reservations.filter(r => {
        if (r.locationId && String(r.locationId) !== activeLocationId) return false;
        const query = (activeFilters.search || '').toLowerCase().trim();
        let matchesSearch = true;
        if (query) {
            const { rawName, cleanCustomerName, rawPhone } = extractCustomerInfo(r);
            matchesSearch = rawName.toLowerCase().includes(query) || 
                            cleanCustomerName.toLowerCase().includes(query) ||
                            rawPhone.toLowerCase().includes(query) || 
                            (r.time || '').toLowerCase().includes(query) || 
                            (r.date || '').includes(query);
        }
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

    const activeBranch = useMemo(() => {
        return state.locations.find(l => String(l.id) === activeLocationId) || state.locations[0];
    }, [state.locations, activeLocationId]);

    const activeStaffCount = useMemo(() => {
        return (state.staff || []).filter(s => s.active !== false).length || 1;
    }, [state.staff]);

    const todayBookingsCount = useMemo(() => {
        const todayIso = localIsoToday();
        return (state.reservations || []).filter(r => r.date === todayIso && (!r.locationId || String(r.locationId) === activeLocationId) && r.status !== 'cancelled').length;
    }, [state.reservations, activeLocationId]);

    const occupancyPercentage = useMemo(() => {
        const capacity = Math.max(1, activeStaffCount * 8);
        return Math.min(100, Math.round((todayBookingsCount / capacity) * 100));
    }, [todayBookingsCount, activeStaffCount]);

    const handleSendWhatsAppMessage = (res: Reservation) => {
        const barberName = getStaffName(res.staffId);
        const { cleanCustomerName: cleanName, cleanPhone } = extractCustomerInfo(res);
        if (!cleanPhone) {
            addToast(rtl ? 'رقم هاتف العميل غير متوفر للمراسلة' : 'Customer phone not available', 'error');
            return;
        }

        const timeFormatted = formatAppointmentTime(res.time);
        const dateFormatted = formatAppointmentDate(res.date);
        const branchName = activeBranch?.name || 'Flare One Barbershop';

        const msg = `أهلاً بك أستاذ ${cleanName} في صالون Flare One ✂️✨\n\nيسعدنا تأكيد تفاصيل موعدك المحجوز لدينا:\n💈 المصفف: ${barberName}\n⏰ الوقت: ${timeFormatted}\n📅 التاريخ: ${dateFormatted}\n📍 الفرع: ${branchName}\n\nنتشرف بحضورك ونتمنى لك تجربة استثنائية! 🙏`;

        const waPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
        const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        addToast(rtl ? `تم تجهيز رسالة تأكيد الحجز لأستاذ ${cleanName}` : 'WhatsApp message prepared', 'success');
    };

    const handlePrintVipTicket = (res: Reservation) => {
        const printWindow = window.open('', '', 'width=450,height=600');
        if (!printWindow) return;

        const barberName = getStaffName(res.staffId);
        const { cleanCustomerName: cleanName, rawPhone: pPhone } = extractCustomerInfo(res);
        const timeFormatted = formatAppointmentTime(res.time);
        const dateFormatted = formatAppointmentDate(res.date);

        const html = `
            <!DOCTYPE html>
            <html dir="${rtl ? 'rtl' : 'ltr'}">
            <head>
                <meta charset="utf-8" />
                <title>تذكرة موعد صالون Flare One</title>
                <style>
                    @media print {
                        @page { size: 80mm auto; margin: 0; }
                        body { margin: 0; padding: 6px; width: 76mm; }
                    }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 10px 8px; width: 76mm; margin: 0 auto; color: #111; font-size: 11px; text-align: center; background: #fff; }
                    .header { border-bottom: 2px dashed #333; padding-bottom: 8px; margin-bottom: 8px; }
                    .salon-name { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
                    .salon-sub { font-size: 9px; color: #555; margin-top: 2px; }
                    .ticket-title { font-size: 11px; font-weight: 800; background: #111; color: #fff; padding: 3px 8px; border-radius: 4px; display: inline-block; margin: 6px 0; }
                    .info-box { text-align: ${rtl ? 'right' : 'left'}; margin: 8px 0; border: 1px solid #ddd; border-radius: 8px; padding: 8px; font-size: 10px; }
                    .info-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e5e5e5; }
                    .info-row:last-child { border-bottom: none; }
                    .info-label { font-weight: bold; color: #555; }
                    .info-value { font-weight: 800; }
                    .timing-box { background: #f8fafc; border: 1.5px solid #0f172a; border-radius: 8px; padding: 8px; margin: 8px 0; }
                    .timing-time { font-size: 16px; font-weight: 900; font-family: monospace; letter-spacing: 0.5px; }
                    .timing-date { font-size: 11px; font-weight: 700; color: #475569; margin-top: 2px; }
                    .footer { border-top: 1px dashed #333; padding-top: 6px; margin-top: 8px; font-size: 9px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="salon-name">FLARE ONE BARBERSHOP</div>
                    <div class="salon-sub">صالون الحلاقة والعناية الرجالية الفاخرة</div>
                    <div class="ticket-title">تذكرة موعد مؤكد</div>
                </div>

                <div class="timing-box">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 2px;">الموعد المحجوز</div>
                    <div class="timing-time">${timeFormatted}</div>
                    <div class="timing-date">${dateFormatted}</div>
                </div>

                <div class="info-box">
                    <div class="info-row">
                        <span class="info-label">العميل:</span>
                        <span class="info-value">${cleanName}</span>
                    </div>
                    ${pPhone ? `
                    <div class="info-row">
                        <span class="info-label">الهاتف:</span>
                        <span class="info-value" dir="ltr">${pPhone}</span>
                    </div>` : ''}
                    <div class="info-row">
                        <span class="info-label">المصفف:</span>
                        <span class="info-value">${barberName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الفرع:</span>
                        <span class="info-value">${activeBranch?.name || 'الفرع الرئيسي'}</span>
                    </div>
                    ${res.notes ? `
                    <div class="info-row">
                        <span class="info-label">ملاحظات:</span>
                        <span class="info-value">${res.notes}</span>
                    </div>` : ''}
                </div>

                <div class="footer">
                    <div>نتشرف بزيارتكم دائماً ونرجو الحضور قبل الموعد بـ 5 دقائق</div>
                    <div style="margin-top: 3px; font-family: monospace; font-size: 8px;">REF: #${res.id} • ${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            try { printWindow.focus(); printWindow.print(); } catch {}
            setTimeout(() => { try { printWindow.close(); } catch {} }, 500);
        };
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
                    @media print {
                        @page { size: 80mm auto; margin: 0; }
                        body { margin: 0; padding: 4px; width: 76mm; }
                    }
                    * { box-sizing: border-box; }
                    body { font-family: Tahoma, Arial, sans-serif; padding: 6px 4px; width: 76mm; margin: 0 auto; color: #000; font-size: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #000; font-size: 9.5px; }
                    th, td { border: 1px solid #000; padding: 4px 2px; text-align: center; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    h2 { text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 6px; }
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
                    {/* زر التبديل الإبداعي بين جدول المواعيد ومخطط مقاعد الصالون */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <FileText size={14} />
                            <span>{rtl ? 'جدول المواعيد' : 'Table View'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('chairs')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'chairs'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Scissors size={14} />
                            <span>{rtl ? 'مخطط كراسي الصالون' : 'Chairs Grid'}</span>
                        </button>
                    </div>

                    <Button variant="secondary" onClick={handleExportPDF} className="px-3 hidden md:flex items-center gap-1.5" title={t('export_pdf')}>
                        <Printer size={18} />
                        <span>{rtl ? 'طباعة' : 'Print'}</span>
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
                        onClick={() => setShowAdminSettings(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95 border border-slate-300 dark:border-slate-600"
                        title={rtl ? 'إعداد ساعات عمل الحجز والعطلات وإجازات الحلاقين' : 'Booking Hours & Leaves Settings'}
                    >
                        <Clock size={16} className="text-primary-600 dark:text-primary-400" />
                        <span>{rtl ? 'أوقات الحجز والإجازات' : 'Hours & Leaves'}</span>
                    </button>

                    <button 
                        type="button"
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer active:scale-95"
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
                    <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                        {resStats.total} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'حجوزات اليوم' : 'Today'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800/40">اليوم</span>
                    </div>
                    <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                        {resStats.today} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'مؤكدة' : 'Confirmed'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">مؤكد</span>
                    </div>
                    <div className="text-2xl font-extrabold text-emerald-500 font-mono tracking-tight">
                        {resStats.confirmed} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{rtl ? 'مكتملة' : 'Completed'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/40">مكتمل</span>
                    </div>
                    <div className="text-2xl font-extrabold text-emerald-500 font-mono tracking-tight">
                        {resStats.completed} <span className="text-xs font-bold text-slate-400">{rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>
            </div>

            {/* مؤشر نبض ومقاعد الصالون التفاعلي */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 border border-emerald-500/25 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <Scissors size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-white">{rtl ? 'نبض ومقاعد الصالون اليوم' : 'Salon Live Chairs Pulse'}</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 animate-pulse">
                                {rtl ? 'مباشر' : 'Live'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            {rtl ? 'متابعة فورية للمقاعد والمواعيد مع كباتن الصالون، وإشعار العملاء المباشر عبر واتساب والتحويل لفواتير' : 'Real-time chair schedule, WhatsApp confirmations, and direct checkout'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="text-center px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-slate-400 block">{rtl ? 'نسبة الإشغال اليوم' : 'Occupancy'}</span>
                        <span className="font-bold text-emerald-400 text-sm">{occupancyPercentage}%</span>
                    </div>
                    <div className="text-center px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-slate-400 block">{rtl ? 'الكباتن المتاحون' : 'Barbers'}</span>
                        <span className="font-bold text-slate-100 text-sm">{activeStaffCount} {rtl ? 'كابتن' : 'Staff'}</span>
                    </div>
                    <div className="text-center px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-slate-400 block">{rtl ? 'قيد الانتظار' : 'Pending'}</span>
                        <span className="font-bold text-amber-400 text-sm">{resStats.pending} {rtl ? 'موعد' : 'res'}</span>
                    </div>
                </div>
            </div>

            {/* جدول الحجوزات */}
            {viewMode === 'table' && (
            <Card id="reservations-table" className="overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-sm rounded-2xl animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-5 py-3.5 font-bold">{t('customer_name')}</th>
                                <th className="px-5 py-3.5 font-bold">{rtl ? 'رقم الهاتف' : 'Phone Number'}</th>
                                <th className="px-5 py-3.5 font-bold">{t('barber')}</th>
                                <th className="px-5 py-3.5 font-bold">{rtl ? 'الموعد' : 'Appointment'}</th>
                                <th className="px-5 py-3.5 font-bold">{t('status')}</th>
                                <th className="px-5 py-3.5 font-bold">{rtl ? 'ملاحظات' : 'Notes'}</th>
                                <th className="px-5 py-3.5 font-bold text-center">{rtl ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredReservations.map(r => {
                                const { cleanCustomerName, rawPhone, cleanPhone } = extractCustomerInfo(r);

                                return (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold shrink-0">
                                            {cleanCustomerName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate">{cleanCustomerName}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
                                        {cleanPhone ? (
                                            <div className="flex items-center gap-1.5" dir="ltr">
                                                <a
                                                    href={`tel:${cleanPhone}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-colors"
                                                    title={rtl ? 'اتصال بالعميل' : 'Call customer'}
                                                >
                                                    <Phone size={12} className="text-emerald-600" />
                                                    <span>{cleanPhone}</span>
                                                </a>
                                                <a
                                                    href={`https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : (cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 transition-colors"
                                                    title={rtl ? 'مراسلة واتساب' : 'WhatsApp'}
                                                >
                                                    <MessageSquare size={13} />
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 font-mono">-</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                                        {getStaffName(r.staffId)}
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 font-mono text-xs">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1">
                                                <Clock size={13} className="text-emerald-600 shrink-0" />
                                                <span>{formatAppointmentTime(r.time)}</span>
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                                <Calendar size={11} className="text-slate-400 shrink-0" />
                                                <span>{formatAppointmentDate(r.date)}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1
                                            ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 
                                              r.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 
                                              r.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                              r.status === 'cancelled' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'confirmed' ? 'bg-emerald-500' : r.status === 'pending' ? 'bg-amber-500' : r.status === 'completed' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                                            {r.status === 'confirmed' ? (rtl ? 'مؤكد' : 'Confirmed') : 
                                             r.status === 'pending' ? (rtl ? 'قيد الانتظار' : 'Pending') : 
                                             r.status === 'completed' ? (rtl ? 'مكتمل' : 'Completed') :
                                             r.status === 'cancelled' ? (rtl ? 'ملغي' : 'Cancelled') : t(r.status)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                        {r.notes || '-'}
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {r.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const { cleanCustomerName: cName, cleanPhone: pPhone } = extractCustomerInfo(r);
                                                        updateReservation({ ...r, status: 'confirmed' });
                                                        addToast(rtl ? `تم تأكيد حجز ${cName}` : 'Booking confirmed', 'success');
                                                        if (pPhone) {
                                                            pushCustomerNotificationToSupabase({
                                                                phone: pPhone,
                                                                title: '✅ تم تأكيد حجزك في Flare One',
                                                                body: `تم تأكيد موعدك بنجاح بتاريخ ${r.date} الساعة ${r.time} مع ${getStaffName(r.staffId)}. نتشرف بزيارتك!`
                                                            }, state.settings.supabaseUrl, state.settings.supabaseKey).catch(() => {});
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold transition-all cursor-pointer shadow-xs"
                                                    title={rtl ? 'تأكيد الحجز' : 'Confirm'}
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}

                                            {r.status === 'confirmed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateReservation({ ...r, status: 'completed' });
                                                        addToast(rtl ? `تم إتمام موعد ${r.customerName}` : 'Booking completed', 'success');
                                                    }}
                                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold transition-all cursor-pointer shadow-xs"
                                                    title={rtl ? 'تم تقديم الخدمة بنجاح' : 'Mark Completed'}
                                                >
                                                    <Sparkles size={16} />
                                                </button>
                                            )}

                                            {r.status !== 'cancelled' && r.status !== 'completed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const { cleanCustomerName: cName, cleanPhone: pPhone } = extractCustomerInfo(r);
                                                        updateReservation({ ...r, status: 'cancelled' });
                                                        addToast(rtl ? `تم إلغاء حجز ${cName}` : 'Booking cancelled', 'info');
                                                        if (pPhone) {
                                                            pushCustomerNotificationToSupabase({
                                                                phone: pPhone,
                                                                title: '❌ إشعار بخصوص حجزك في Flare One',
                                                                body: `نعتذر منك، تم إلغاء موعدك بتاريخ ${r.date} الساعة ${r.time}. يمكنك حجز موعد جديد في أي وقت يناسبك.`
                                                            }, state.settings.supabaseUrl, state.settings.supabaseKey).catch(() => {});
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-bold transition-all cursor-pointer shadow-xs"
                                                    title={rtl ? 'إلغاء الموعد' : 'Cancel'}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleSendWhatsAppMessage(r)}
                                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 font-bold transition-all cursor-pointer shadow-xs"
                                                title={rtl ? 'إرسال تأكيد الموعد عبر واتساب' : 'Send WhatsApp Confirmation'}
                                            >
                                                <MessageSquare size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setVipPassRes(r)}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer shadow-xs"
                                                title={rtl ? 'تذكرة موعد VIP وطباعة إيصال' : 'VIP Pass Ticket & Print'}
                                            >
                                                <Printer size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const { cleanCustomerName: cleanName, rawPhone: pPhone } = extractCustomerInfo(r);
                                                    sessionStorage.setItem('pending_pos_reservation', JSON.stringify({
                                                        customerName: cleanName,
                                                        phone: pPhone,
                                                        staffId: r.staffId,
                                                        serviceName: r.serviceName,
                                                        notes: `حجز موعد ${r.date} ${r.time}`
                                                    }));
                                                    if (r.status === 'pending') {
                                                        updateReservation({ ...r, status: 'confirmed' });
                                                    }
                                                    if (onNavigate) {
                                                        onNavigate('create_invoice');
                                                    } else {
                                                        window.location.hash = '#/create_invoice';
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold transition-all cursor-pointer shadow-xs"
                                                title={rtl ? 'تحويل الحجز إلى فاتورة بيع بالكاشير' : 'Convert to POS Invoice'}
                                            >
                                                <FileText size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm(rtl ? `هل أنت متأكد من حذف حجز ${r.customerName}؟` : 'Delete this reservation?')) {
                                                        deleteReservation(r.id);
                                                        addToast(rtl ? 'تم حذف الحجز بنجاح' : 'Reservation deleted', 'info');
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-all cursor-pointer shadow-xs"
                                                title={rtl ? 'حذف الحجز' : 'Delete'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
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
            )}

            {/* عرض مخطط مقاعد وكراسي الصالون التفاعلي */}
            {viewMode === 'chairs' && (
                <div className="space-y-4 animate-fade-in">
                    {/* شريط اختيار تاريخ المخطط */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Calendar size={16} className="text-emerald-600" />
                                <span>{rtl ? 'تاريخ المخطط:' : 'Date:'}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                                {[
                                    { label: rtl ? 'اليوم' : 'Today', offset: 0 },
                                    { label: rtl ? 'غداً' : 'Tomorrow', offset: 1 },
                                    { label: rtl ? 'بعد غد' : 'Day After', offset: 2 }
                                ].map(btn => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + btn.offset);
                                    const iso = toIsoDate(d);
                                    const isSel = (chairsDate === iso);
                                    return (
                                        <button
                                            key={btn.offset}
                                            type="button"
                                            onClick={() => setChairsDate(iso)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                isSel 
                                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                            }`}
                                        >
                                            {btn.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={chairsDate}
                                onChange={(e) => setChairsDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-bold text-slate-500 font-mono">
                                {formatAppointmentDate(chairsDate)}
                            </span>
                        </div>
                    </div>

                    {/* شبكة كراسي الصالون لكل كابتن */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {state.staff.map((st, idx) => {
                            const isStaffOnLeave = bookingConfig.staffLeaves.some(l => 
                                l.staffId === st.id && (l.isSingleDay ? l.startDate === chairsDate : (chairsDate >= l.startDate && chairsDate <= l.endDate))
                            );
                            const staffResvs = state.reservations.filter(r => 
                                r.staffId === st.id && 
                                r.date === chairsDate && 
                                (!r.locationId || String(r.locationId) === activeLocationId) && 
                                r.status !== 'cancelled'
                            );
                            staffResvs.sort((a, b) => a.time.localeCompare(b.time));

                            return (
                                <div 
                                    key={st.id}
                                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm ${
                                        isStaffOnLeave 
                                            ? 'bg-slate-100/70 dark:bg-slate-900/40 border-red-200/80 dark:border-red-950/60 opacity-80' 
                                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                                    }`}
                                >
                                    {/* Chair Header */}
                                    <div className="p-3.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                {st.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{st.name}</h4>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                                                        #{idx + 1}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{st.role || (rtl ? 'مصفف شعر' : 'Stylist')}</p>
                                            </div>
                                        </div>

                                        <div>
                                            {isStaffOnLeave ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 font-bold">
                                                    {rtl ? 'في إجازة' : 'On Leave'}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-mono font-bold">
                                                    {staffResvs.length} {rtl ? 'موعد' : 'res'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Chair Appointments List */}
                                    <div className="p-3 space-y-2.5 flex-1 min-h-[220px] max-h-[460px] overflow-y-auto">
                                        {isStaffOnLeave ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                                <AlertCircle size={28} className="text-red-400 mb-2" />
                                                <p className="text-xs font-bold text-red-500">{rtl ? 'الكابتن في إجازة بهذا التاريخ' : 'Staff is on leave'}</p>
                                                <p className="text-[11px] text-slate-400 mt-1">{rtl ? 'لا يمكن استقبال حجوزات جديدة' : 'No bookings available'}</p>
                                            </div>
                                        ) : staffResvs.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                                <Scissors size={24} className="text-slate-300 dark:text-slate-600 mb-1.5" />
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{rtl ? 'الكرسي متاح بالكامل' : 'Chair Free All Day'}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{rtl ? 'لا توجد مواعيد محجوزة' : 'No appointments scheduled'}</p>
                                            </div>
                                        ) : (
                                            staffResvs.map(res => {
                                                const isConfirmed = res.status === 'confirmed';
                                                const isPending = res.status === 'pending';
                                                const isCompleted = res.status === 'completed';
                                                const { cleanCustomerName: cleanName, cleanPhone } = extractCustomerInfo(res);

                                                return (
                                                    <div 
                                                        key={res.id}
                                                        className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                                                            isConfirmed 
                                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800/50' 
                                                                : isPending 
                                                                ? 'bg-amber-50/50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/50' 
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-1.5">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                                                    <Clock size={12} className="text-emerald-600" />
                                                                    <span>{formatAppointmentTime(res.time)}</span>
                                                                </span>
                                                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                                                    {formatAppointmentDate(res.date)}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                                isConfirmed 
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' 
                                                                    : isPending 
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' 
                                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                                            }`}>
                                                                {isConfirmed ? (rtl ? 'مؤكد' : 'Confirmed') : 
                                                                 isPending ? (rtl ? 'انتظار' : 'Pending') : 
                                                                 isCompleted ? (rtl ? 'مكتمل' : 'Completed') : res.status}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{cleanName}</h5>
                                                            {cleanPhone && (
                                                                <a 
                                                                    href={`tel:${cleanPhone}`}
                                                                    className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 mt-0.5" 
                                                                    dir="ltr"
                                                                >
                                                                    <Phone size={10} />
                                                                    <span>{cleanPhone}</span>
                                                                </a>
                                                            )}
                                                        </div>

                                                        {/* Chair Slot Actions */}
                                                        <div className="flex items-center gap-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    sessionStorage.setItem('pending_pos_reservation', JSON.stringify({
                                                                        customerName: cleanName,
                                                                        phone: cleanPhone,
                                                                        staffId: res.staffId,
                                                                        serviceName: res.serviceName,
                                                                        notes: `حجز موعد ${res.date} ${res.time}`
                                                                    }));
                                                                    if (onNavigate) onNavigate('create_invoice');
                                                                    else window.location.hash = '#/create_invoice';
                                                                }}
                                                                className="flex-1 py-1 px-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                                                title={rtl ? 'تحويل لفاتورة كاشير' : 'POS Checkout'}
                                                            >
                                                                <FileText size={11} />
                                                                <span>{rtl ? 'فاتورة' : 'Invoice'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendWhatsAppMessage(res)}
                                                                className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer"
                                                                title={rtl ? 'إرسال تأكيد واتساب' : 'WhatsApp'}
                                                            >
                                                                <MessageSquare size={13} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => setVipPassRes(res)}
                                                                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                                                                title={rtl ? 'تذكرة VIP وطباعة' : 'VIP Ticket'}
                                                            >
                                                                <Printer size={13} />
                                                            </button>

                                                            {isPending && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        updateReservation({ ...res, status: 'confirmed' });
                                                                        addToast(rtl ? `تم تأكيد حجز ${cleanName}` : 'Confirmed', 'success');
                                                                    }}
                                                                    className="p-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold cursor-pointer"
                                                                    title={rtl ? 'تأكيد الحجز' : 'Confirm'}
                                                                >
                                                                    <Check size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Chair Footer: Quick New Booking Button */}
                                    {!isStaffOnLeave && (
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    resetForm();
                                                    setSelectedStaffId(st.id);
                                                    setDate(chairsDate);
                                                    setShowModal(true);
                                                }}
                                                className="w-full py-1.5 px-3 rounded-xl border border-dashed border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <Plus size={14} />
                                                <span>{rtl ? `حجز موعد مع ${st.name.split(' ')[0]}` : 'Book on this chair'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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

            {/* نافذة الإدارة الإدارية لساعات العمل وأيام الإجازات وإجازات الحلاقين */}
            {showAdminSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
                    <div 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100"
                        dir={rtl ? 'rtl' : 'ltr'}
                    >
                        {/* ترويسة النافذة */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold">
                                            {rtl ? 'إعدادات ساعات الحجز وأيام الإجازات' : 'Booking Hours & Leaves Settings'}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {rtl ? 'تحديد مواعيد العمل، عطلات الصالون، وإجازات الحلاقين المخصصة' : 'Configure operating hours, holidays, and staff leaves'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowAdminSettings(false)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* تبويبات الإدارة */}
                            <div className="grid grid-cols-3 gap-2 mt-3 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/60 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setAdminSettingsTab('hours')}
                                    className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        adminSettingsTab === 'hours'
                                            ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Clock size={15} />
                                    <span>{rtl ? 'ساعات المواعيد' : 'Hours'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setAdminSettingsTab('holidays')}
                                    className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        adminSettingsTab === 'holidays'
                                            ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Calendar size={15} />
                                    <span>{rtl ? 'عطلات الصالون' : 'Holidays'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setAdminSettingsTab('leaves')}
                                    className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        adminSettingsTab === 'leaves'
                                            ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Scissors size={15} />
                                    <span>{rtl ? 'إجازات الحلاقين' : 'Staff Leaves'}</span>
                                </button>
                            </div>
                        </div>

                        {/* محتوى التبويبات */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm">
                            {/* 1. ساعات العمل للمواعيد */}
                            {adminSettingsTab === 'hours' && (
                                <div className="space-y-4">
                                    <div className="p-3.5 rounded-2xl bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/40 text-xs text-primary-800 dark:text-primary-200 flex items-start gap-2.5">
                                        <Sparkles size={18} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
                                        <div>
                                            <p className="font-bold">{rtl ? 'توليد أوقات الحجز تلقائياً:' : 'Dynamic Slot Generation'}</p>
                                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                                                {rtl 
                                                    ? 'يتم تقسيم اليوم إلى مواعيد متتالية بناءً على وقت الفتح ووقت الإغلاق والفاصل الزمني المختار، ويتم تطبيقها فوراً على تطبيق الويب.'
                                                    : 'Slots are dynamically created between start and end times based on slot duration.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                {rtl ? 'وقت بدء استقبال الحجوزات (صباحاً)' : 'Opening Time'}
                                            </label>
                                            <input 
                                                type="time" 
                                                value={bookingConfig.workingHours?.startTime || '10:00'}
                                                onChange={(e) => setBookingConfig({
                                                    ...bookingConfig,
                                                    workingHours: { ...bookingConfig.workingHours, startTime: e.target.value }
                                                })}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                {rtl ? 'وقت انتهاء آخر موعد (مساءً)' : 'Closing Time'}
                                            </label>
                                            <input 
                                                type="time" 
                                                value={bookingConfig.workingHours?.endTime || '23:30'}
                                                onChange={(e) => setBookingConfig({
                                                    ...bookingConfig,
                                                    workingHours: { ...bookingConfig.workingHours, endTime: e.target.value }
                                                })}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            {rtl ? 'المدة بين كل موعد والآخر (الفاصل الزمني)' : 'Slot Duration'}
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[15, 30, 45, 60].map(mins => {
                                                const isSel = (bookingConfig.workingHours?.slotDurationMinutes === mins);
                                                return (
                                                    <button
                                                        key={mins}
                                                        type="button"
                                                        onClick={() => setBookingConfig({
                                                            ...bookingConfig,
                                                            workingHours: { ...bookingConfig.workingHours, slotDurationMinutes: mins }
                                                        })}
                                                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                            isSel 
                                                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-primary-400'
                                                        }`}
                                                    >
                                                        {mins} {rtl ? 'دقيقة' : 'min'}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. عطلات الصالون الأسبوعية والرسمية */}
                            {adminSettingsTab === 'holidays' && (
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            {rtl ? 'العطلات الأسبوعية الثابتة للصالون:' : 'Weekly Recurring Off-Days:'}
                                        </label>
                                        <div className="grid grid-cols-7 gap-1.5">
                                            {[
                                                { day: 6, label: 'سبت' },
                                                { day: 0, label: 'أحد' },
                                                { day: 1, label: 'اثنين' },
                                                { day: 2, label: 'ثلاثاء' },
                                                { day: 3, label: 'أربعاء' },
                                                { day: 4, label: 'خميس' },
                                                { day: 5, label: 'جمعة' },
                                            ].map(item => {
                                                const isOff = (bookingConfig.weeklyOffDays || []).includes(item.day);
                                                return (
                                                    <button
                                                        key={item.day}
                                                        type="button"
                                                        onClick={() => handleToggleWeeklyOff(item.day)}
                                                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                                                            isOff 
                                                                ? 'bg-red-500 text-white border-red-500 shadow-sm' 
                                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400'
                                                        }`}
                                                    >
                                                        <span>{item.label}</span>
                                                        <span className="text-[10px] opacity-80 mt-0.5">{isOff ? (rtl ? 'عطلة' : 'Off') : (rtl ? 'عمل' : 'Open')}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            {rtl ? 'إضافة عطلة رسمية أو مناسبة خاصة:' : 'Add Salon Holiday:'}
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input 
                                                type="date"
                                                value={holidayDate}
                                                onChange={(e) => setHolidayDate(e.target.value)}
                                                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono outline-none"
                                            />
                                            <input 
                                                type="text"
                                                placeholder={rtl ? 'اسم المناسبة (مثلاً: وقفة عيد الأضحى)' : 'Holiday Name'}
                                                value={holidayTitle}
                                                onChange={(e) => setHolidayTitle(e.target.value)}
                                                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
                                            />
                                            <button 
                                                type="button"
                                                onClick={handleAddHoliday}
                                                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                                            >
                                                {rtl ? '+ إضافة عطلة' : '+ Add Holiday'}
                                            </button>
                                        </div>

                                        {/* قائمة العطلات المسجلة */}
                                        <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                                            {(bookingConfig.holidays || []).length === 0 ? (
                                                <p className="text-xs text-slate-400 py-2 text-center">{rtl ? 'لا توجد عطلات رسمية مضافة بعد' : 'No holidays recorded'}</p>
                                            ) : (
                                                bookingConfig.holidays.map(h => (
                                                    <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{h.title}</span>
                                                            <span className="text-[11px] text-slate-400 font-mono">({h.date})</span>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDeleteHoliday(h.id)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                                            title="حذف"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. إجازات الحلاقين المخصصة */}
                            {adminSettingsTab === 'leaves' && (
                                <div className="space-y-4">
                                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <Scissors size={15} className="text-primary-600" />
                                            <span>{rtl ? 'تسجيل إجازة لحلاق محدد:' : 'Register Staff Leave:'}</span>
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    {rtl ? 'اختر الحلاق:' : 'Select Staff:'}
                                                </label>
                                                <select 
                                                    value={leaveStaffId}
                                                    onChange={(e) => setLeaveStaffId(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                                                >
                                                    <option value="">{rtl ? '-- اختر الحلاق --' : '-- Select --'}</option>
                                                    {state.staff.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} ({s.role || 'حلاق'})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    {rtl ? 'نوع الإجازة:' : 'Leave Type:'}
                                                </label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer font-bold">
                                                        <input 
                                                            type="radio" 
                                                            name="leaveType" 
                                                            checked={leaveIsSingleDay}
                                                            onChange={() => setLeaveIsSingleDay(true)}
                                                            className="text-primary-600"
                                                        />
                                                        <span>{rtl ? 'يوم واحد فقط' : 'Single Day'}</span>
                                                    </label>
                                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer font-bold mr-3 rtl:mr-0 rtl:ml-3">
                                                        <input 
                                                            type="radio" 
                                                            name="leaveType" 
                                                            checked={!leaveIsSingleDay}
                                                            onChange={() => setLeaveIsSingleDay(false)}
                                                            className="text-primary-600"
                                                        />
                                                        <span>{rtl ? 'فترة ممتدة' : 'Date Range'}</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    {leaveIsSingleDay ? (rtl ? 'تاريخ اليوم:' : 'Date:') : (rtl ? 'من تاريخ:' : 'From Date:')}
                                                </label>
                                                <input 
                                                    type="date"
                                                    value={leaveStartDate}
                                                    onChange={(e) => setLeaveStartDate(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono outline-none"
                                                />
                                            </div>

                                            {!leaveIsSingleDay && (
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                        {rtl ? 'إلى تاريخ:' : 'To Date:'}
                                                    </label>
                                                    <input 
                                                        type="date"
                                                        value={leaveEndDate}
                                                        onChange={(e) => setLeaveEndDate(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono outline-none"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                {rtl ? 'سبب الإجازة:' : 'Reason:'}
                                            </label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={leaveReason}
                                                    placeholder={rtl ? 'مثال: إجازة سنوية، عذر مرضي، راحة دورية' : 'Leave reason'}
                                                    onChange={(e) => setLeaveReason(e.target.value)}
                                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddLeave}
                                                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                                                >
                                                    {rtl ? 'تسجيل الإجازة' : 'Record Leave'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* قائمة إجازات الحلاقين المسجلة */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            {rtl ? 'الإجازات المسجلة حالياً:' : 'Active Staff Leaves:'}
                                        </h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {(bookingConfig.staffLeaves || []).length === 0 ? (
                                                <p className="text-xs text-slate-400 py-3 text-center">{rtl ? 'لا توجد إجازات حلاقين مسجلة' : 'No staff leaves recorded'}</p>
                                            ) : (
                                                bookingConfig.staffLeaves.map(l => (
                                                    <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-primary-600 dark:text-primary-400">{l.staffName}</span>
                                                                <span className="badge badge-emerald text-[10px] px-1.5 py-0.2">{l.reason}</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                                {l.isSingleDay 
                                                                    ? `يوم: ${l.startDate}` 
                                                                    : `من ${l.startDate} إلى ${l.endDate}`}
                                                            </p>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDeleteLeave(l.id)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                                            title="إلغاء الإجازة"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* تذييل النافذة مع زر الحفظ السحابي */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowAdminSettings(false)}
                                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                            >
                                {t('cancel')}
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveAllBookingSettings}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                            >
                                <Check size={18} />
                                <span>{rtl ? 'حفظ وتعميم الإعدادات سحابياً' : 'Save & Sync Cloud'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* نافذة تذكرة موعد عميل VIP الفاخرة للطباعة ومراسلة الواتساب */}
            {vipPassRes && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
                    <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100 flex flex-col" dir={rtl ? 'rtl' : 'ltr'}>
                        {/* Ticket Header */}
                        <div className="p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 border-b border-emerald-500/20 text-center relative">
                            <button
                                type="button"
                                onClick={() => setVipPassRes(null)}
                                className="absolute left-4 rtl:left-auto rtl:right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow-inner">
                                <Scissors size={24} />
                            </div>
                            <h3 className="font-black text-lg text-white tracking-wide">FLARE ONE LUXURY BARBERSHOP</h3>
                            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-widest">
                                VIP Appointment Pass
                            </span>
                        </div>

                        {/* Ticket Body */}
                        <div className="p-5 space-y-4">
                            {/* Appointment Time & Date Highlight */}
                            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">الموعد المحجوز</span>
                                <div className="text-2xl font-black text-white font-mono tracking-tight" dir="ltr">
                                    {formatAppointmentTime(vipPassRes.time)}
                                </div>
                                <div className="text-xs font-bold text-slate-300 font-mono mt-1" dir="ltr">
                                    {formatAppointmentDate(vipPassRes.date)}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-2.5 text-xs bg-white/5 rounded-2xl p-4 border border-white/5">
                                <div className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-slate-400">اسم العميل:</span>
                                    <span className="font-extrabold text-white text-sm">
                                        {vipPassRes.customerName.replace(/\s*\([^)]*\)/, '')}
                                    </span>
                                </div>

                                {Boolean(extractCustomerInfo(vipPassRes).cleanPhone) && (
                                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                                        <span className="text-slate-400">رقم الهاتف:</span>
                                        <span className="font-mono font-bold text-emerald-400" dir="ltr">
                                            {extractCustomerInfo(vipPassRes).cleanPhone}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-slate-400">مصفف الشعر:</span>
                                    <span className="font-bold text-white flex items-center gap-1">
                                        <Scissors size={12} className="text-emerald-400" />
                                        <span>{getStaffName(vipPassRes.staffId)}</span>
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-slate-400">الفرع:</span>
                                    <span className="font-bold text-slate-200">
                                        {activeBranch?.name || 'الفرع الرئيسي'}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center py-1">
                                    <span className="text-slate-400">حالة الموعد:</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                        vipPassRes.status === 'confirmed' 
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                            : vipPassRes.status === 'pending' 
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                        {vipPassRes.status === 'confirmed' ? 'موعد مؤكد' : vipPassRes.status === 'pending' ? 'قيد الانتظار' : vipPassRes.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Ticket Actions */}
                        <div className="p-5 pt-0 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => handlePrintVipTicket(vipPassRes)}
                                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-98"
                            >
                                <Printer size={16} />
                                <span>طباعة تذكرة موعد حرارية (80mm)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSendWhatsAppMessage(vipPassRes)}
                                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <MessageSquare size={15} className="text-emerald-400" />
                                <span>إرسال تأكيد الموعد للعميل عبر واتساب</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
