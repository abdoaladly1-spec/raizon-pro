import React from 'react';
import { Sparkles, Check, X, ArrowRight, Shield } from './Icons';

interface WhatsNewModalProps {
  isOpen: boolean;
  version?: string;
  releaseName?: string;
  releaseNotes?: string;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  version = 'v1.0.1',
  releaseName,
  releaseNotes,
  onClose
}) => {
  if (!isOpen) return null;

  // Default highlights if release notes are empty or brief
  const defaultFeatures = [
    { title: 'سجل الديون والعملاء الآجل', desc: 'متابعة شاملة للمديونيات وسندات القبض وكشوف الحساب التفصيلية.' },
    { title: 'طرق دفع حديثة والخزينة اللحظية', desc: 'دعم إنستا باي والمحافظ الإلكترونية مع شريط أرصدة الخزينة الحية.' },
    { title: 'نظام عمولات ونسب الموظفين', desc: 'حساب دقيق لنسبة الموظف لكل عميل أو خدمة وتعديلها بسهولة.' },
    { title: 'تحسينات التصميم والخطوط العربية', desc: 'خط عربي حديث وواجهات داكنة فائقة التباين والوضوح والسرعة.' },
  ];

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans select-none" dir="rtl">
      <div 
        className="relative w-full max-w-md rounded-2xl border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.35)] overflow-hidden text-slate-100 animate-scale-in"
        style={{
          background: 'linear-gradient(180deg, #161026 0%, #0d0917 100%)'
        }}
      >
        {/* Header decoration */}
        <div className="p-6 pb-4 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-purple-300 mx-auto flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20 mb-3">
            <Sparkles size={28} className="text-amber-400 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
            <Check size={14} />
            <span>تم التحديث بنجاح!</span>
          </div>

          <h3 className="text-xl font-black text-white">
            {releaseName || `ما الجديد في الإصدار ${version}`}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            تمت ترقية نظام RaiZon Pro بنجاح بأحدث الميزات والأمان
          </p>
        </div>

        {/* Features List */}
        <div className="px-6 py-2">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-3 max-h-60 overflow-y-auto">
            {releaseNotes ? (
              <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                {releaseNotes}
              </div>
            ) : (
              defaultFeatures.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    <Check size={12} />
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-white">{item.title}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <span>رائع! بدء الاستخدام</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
