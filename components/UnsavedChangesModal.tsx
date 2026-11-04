import React from 'react';
import { Check, X, AlertCircle, Save } from './Icons';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" 
      dir="rtl"
    >
      <div 
        className="relative w-full max-w-md p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl text-slate-100 flex flex-col items-center text-center space-y-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر إغلاق X في الزاوية */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="إلغاء وبقاء"
        >
          <X size={16} />
        </button>

        {/* أيقونة التنبيه العصرية */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl shadow-lg shadow-amber-500/10">
          <Save size={28} className="text-amber-400" />
        </div>

        {/* النصوص التوضيحية */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white">
            تأكيد حفظ الإجراءات والتعديلات
          </h3>
          <p className="text-base font-bold text-slate-200">
            هل أنت تود حفظ الإجراءات التي تمت؟
          </p>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            تم إجراء تعديلات في إعدادات النظام ولم يتم حفظها بعد. يمكنك حفظ هذه التعديلات الآن، أو تجاهلها للعودة للوضع السابق.
          </p>
        </div>

        {/* الأزرار: حفظ (أخضر) - تجاهل (أحمر) */}
        <div className="grid grid-cols-2 gap-3 w-full pt-2">
          {/* زر حفظ - أخضر */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check size={18} className="shrink-0" />
            <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</span>
          </button>

          {/* زر تجاهل - أحمر */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-sm shadow-lg shadow-red-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <X size={18} className="shrink-0" />
            <span>تجاهل</span>
          </button>
        </div>

        {/* زر البقاء في الصفحة */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors pt-1 cursor-pointer"
        >
          البقاء في هذه الصفحة
        </button>

      </div>
    </div>
  );
};
