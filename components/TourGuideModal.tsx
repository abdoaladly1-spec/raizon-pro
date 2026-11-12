import React, { useState } from 'react';
import { 
  Sparkles, Check, ArrowRight, ArrowLeft, X, 
  LayoutDashboard, FileText, Package, Users, Wallet, Settings, 
  Keyboard, Shield, Smartphone 
} from './Icons';

interface TourGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const TourGuideModal: React.FC<TourGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'لوحة التحكم والتحليلات اللحظية',
      badge: 'الخطوة 1 من 6',
      subtitle: 'نظرة شاملة ومباشرة على نشاط متجرك وأرباحك',
      icon: LayoutDashboard,
      iconColor: 'from-amber-500 to-amber-600',
      highlights: [
        'مؤشرات فورية (KPIs) للإيرادات، صافي الأرباح، والمصروفات',
        'متابعة النقدية المتوقعة بالدرج بدقة وسندات الخزينة',
        'مخطط بياني للمبيعات مع فلترة مرنة (اليوم، الأسبوع، الشهر، السنة)',
        'إمكانية التبديل بين 4 مؤشرات تنفيذية سريعة أو 10 مؤشرات تفصيلية'
      ],
      quickActionLabel: 'استعراض لوحة التحكم',
      tabId: 'dashboard'
    },
    {
      title: 'شاشة الكاشير والبيع السريع (POS)',
      badge: 'الخطوة 2 من 6',
      subtitle: 'إصدار الفواتير بسرعة فائقة وبدون أي نوافذ منبثقة مزعجة',
      icon: FileText,
      iconColor: 'from-emerald-500 to-teal-600',
      highlights: [
        'دعم ماسح الباركود التلقائي (USB وبلوتوث) دون الحاجة للنقر',
        'اختصارات لوحة المفاتيح: F7 لفتح الدرج، F8 للدفع، F9 للخصم',
        'تعدد وسائل الدفع: نقد كاش، بطاقات فيزا، محافظ إلكترونية، وإنستا باي',
        'حفظ تلقائي للمسودات وإمكانية تعليق الفاتورة واسترجاعها لاحقاً'
      ],
      quickActionLabel: 'فتح شاشة الكاشير',
      tabId: 'create_invoice'
    },
    {
      title: 'إدارة المخزون والكتالوج الذكي',
      badge: 'الخطوة 3 من 6',
      subtitle: 'تحكم كامل في الأصناف والخدمات والكميات وتكاليف الشراء',
      icon: Package,
      iconColor: 'from-blue-500 to-indigo-600',
      highlights: [
        'دعم المنتجات المادية (مع تتبع المخزون) والخدمات العامة',
        'تنبيهات تلقائية عند وصول الصنف لحد الطلب المنخفض',
        'طباعة وتوليد ملصقات الباركود بمختلف المقاسات الحرارية',
        'تصدير واستيراد قوائم المنتجات عبر ملفات Excel و CSV'
      ],
      quickActionLabel: 'إدارة المخزون',
      tabId: 'inventory'
    },
    {
      title: 'سجل العملاء، الديون، والولاء',
      badge: 'الخطوة 4 من 6',
      subtitle: 'إدارة ذكية لعلاقات العملاء وحسابات البيع الآجل',
      icon: Users,
      iconColor: 'from-purple-500 to-indigo-600',
      highlights: [
        'ملف متكامل لكل عميل مع كشف حساب تفصيلي وسجل المشتريات',
        'متابعة المديونيات وسندات القبض والسداد الجزئي أو الكلي',
        'نظام نقاط ولاء ومكافآت تلقائي لكل عملية شراء',
        'مراسلة العميل عبر واتساب مباشرة ببيانات حسابه أو فاتورته'
      ],
      quickActionLabel: 'سجل العملاء',
      tabId: 'clients'
    },
    {
      title: 'الإقفال اليومي وحركة النقدية',
      badge: 'الخطوة 5 من 6',
      subtitle: 'مطابقة دقيقة لنقدية الدرج مع مبيعات اليوم لمنع العجز والتلاعب',
      icon: Wallet,
      iconColor: 'from-rose-500 to-orange-600',
      highlights: [
        'جرد فئات النقدية بالدرج وحساب العجز أو الزيادة آلياً',
        'تسجيل حركات الإيداع والسحب وسندات مصروفات الوردية',
        'طباعة إيصال إقفال حراري فورياً (80mm / 58mm)',
        'إرسال تقرير الإقفال اليومي تلقائياً لإيميل المدير'
      ],
      quickActionLabel: 'شاشة الإقفال',
      tabId: 'closing'
    },
    {
      title: 'تخصيص النظام والعمل دون إنترنت',
      badge: 'الخطوة 6 من 6',
      subtitle: '3 ثيمات ملكية فاخرة، دعم كامل للأوفلاين وتطبيق PWA',
      icon: Settings,
      iconColor: 'from-amber-400 to-yellow-600',
      highlights: [
        '3 ثيمات فاخرة (ذهبي فاخر، أزرق محيطي، أسود زمردي) بالوضعين الليلي والنهاري',
        'يعمل بدون إنترنت (Offline First) مع حفظ مشفر على IndexedDB',
        'إمكانية التثبيت كتطبيق (PWA) على أجهزة الكمبيوتر والأجهزة اللوحية (iPad / Tablets)',
        'لوحة اختصارات مرجعية تظهر في أي وقت بالضغط على زر (?)'
      ],
      quickActionLabel: 'إعدادات النظام',
      tabId: 'settings'
    }
  ];

  const cur = steps[currentStep];
  const StepIcon = cur.icon;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('raizon_tour_completed', 'true');
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinishAndNavigate = (tabId: string) => {
    localStorage.setItem('raizon_tour_completed', 'true');
    onClose();
    if (onNavigateToTab) {
      onNavigateToTab(tabId);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans select-none" dir="rtl">
      <div 
        className="relative w-full max-w-lg rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-100 animate-scale-in flex flex-col bg-slate-900/95"
      >
        {/* Glow highlight */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-primary-500 to-purple-600"></div>

        {/* Top Header */}
        <div className="p-6 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${cur.iconColor} text-white flex items-center justify-center shadow-lg shrink-0`}>
              <StepIcon size={24} />
            </div>
            <div>
              <span className="inline-block text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 border border-white/10 mb-1">
                {cur.badge}
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                {cur.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق الجولة"
          >
            <X size={16} />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-6 pb-2">
          <p className="text-xs text-slate-300 font-medium">
            {cur.subtitle}
          </p>
        </div>

        {/* Highlights List */}
        <div className="px-6 py-3">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2.5">
            {cur.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 border border-emerald-500/30">
                  <Check size={12} />
                </span>
                <span className="text-xs text-slate-200 leading-relaxed font-sans">
                  {h}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Indicator Dots */}
        <div className="flex items-center justify-center gap-2 py-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className={`transition-all rounded-full cursor-pointer ${
                idx === currentStep 
                  ? 'w-6 h-2 bg-gradient-to-r from-amber-400 to-primary-500 shadow-sm' 
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
              title={`انتقال للخطوة ${idx + 1}`}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-6 pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleFinishAndNavigate(cur.tabId)}
            className="text-xs font-bold text-primary-400 hover:text-primary-300 underline underline-offset-4 cursor-pointer transition-colors"
          >
            انتقل إلى {cur.quickActionLabel} ↗
          </button>

          <div className="flex items-center gap-2 ms-auto">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight size={14} />
                <span>السابق</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-primary-600 hover:from-amber-400 hover:to-primary-500 text-white font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <span>{isLast ? 'إنهاء وبدء العمل ✓' : 'التالي'}</span>
              {!isLast && <ArrowLeft size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
