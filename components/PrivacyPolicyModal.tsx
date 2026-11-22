import React from 'react';
import { Shield, Lock, Check, X, FileText, Phone, Cloud, Users } from './Icons';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  onAccept
}) => {
  if (!isOpen) return null;

  const sections = [
    {
      icon: <Lock size={18} className="text-emerald-400" />,
      title: '1. التشفير وحماية كلمات المرور',
      text: 'يتم تشفير كلمات المرور باستخدام خوارزميات التشفير المتقدمة (PBKDF2-SHA256 مع Salt عشوائي 128-بت فريد لكل مستخدم). لا يتم حفظ كلمات المرور بنص صريح أبداً، مما يضمن استحالة كشفها أو استخراجها حتى من قِبل المشرفين التقنيين.'
    },
    {
      icon: <FileText size={18} className="text-cyan-400" />,
      title: '2. سرية المعاملات والبيانات المالية',
      text: 'كافة بيانات المبيعات، الفواتير، المصروفات، وأرصدة درج الكاشير والخزينة هي ملكية خاصة وحصرية لمنشأتك. لا يتم مشاركة أي سجلات مالية أو تفاصيل عملاء مع أي طرف ثالث تحت أي ظرف.'
    },
    {
      icon: <Users size={18} className="text-amber-400" />,
      title: '3. خصوصية بيانات العملاء وسجلات الديون',
      text: 'بيانات العملاء (الأسماء، أرقام الهواتف، سجلات المشتريات والديون) تخضع لأعلى معايير الخصوصية. تُستخدم فقط داخل نطاق إصدار الفواتير، برامج الولاء، وتذكير الحجوزات، ولا يتم استغلالها في أي حملات تسويقية خارجية دون إذنك.'
    },
    {
      icon: <Cloud size={18} className="text-purple-400" />,
      title: '4. المزامنة السحابية والنسخ الاحتياطي',
      text: 'عند تفعيل المزامنة السحابية (Supabase) أو النسخ الاحتياطي، يتم نقل البيانات عبر بروتوكولات آمنة ومشفرة بالكامل (SSL/TLS 256-bit). يمكنك تصدير نسخ احتياطية محلياً وحفظها على جهازك في أي وقت وبكل سهولة.'
    },
    {
      icon: <Shield size={18} className="text-emerald-400" />,
      title: '5. صلاحيات المستخدمين وأمان نقاط البيع',
      text: 'يتيح النظام تحديد صلاحيات دقيقة ومستويات وصول لكل كاشير وموظف، مع تسجيل سجل تدقيق إلكتروني مفصل (Audit Log) لأي حركة محاسبية أو تعديل، لضمان أعلى مستويات النزاهة الإدارية.'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans select-none" 
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden text-slate-100 animate-scale-in flex flex-col max-h-[88vh]"
        style={{
          background: 'linear-gradient(180deg, #131d2e 0%, #0b111e 100%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 pb-4 border-b border-slate-800/80 relative text-center">
          <button 
            type="button" 
            onClick={onClose}
            className="absolute left-5 top-5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
            <Shield size={28} />
          </div>

          <h3 className="text-xl font-black text-white">
            سياسة الخصوصية وحماية البيانات
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            نظام إدارة نقاط البيع والمبيعات فلير وان (Flare One)
          </p>
        </div>

        {/* Scrollable Policy Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-right">
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-200 leading-relaxed font-medium">
            نحن في <strong>فلير وان (Flare One)</strong> نلتزم بأعلى معايير الحماية الرقمية والسرية المصرفية لبيانات منشأتك وعملائك، ونضمن لك حماية تامة لجميع حركات البيع والنقدية.
          </div>

          {sections.map((sec, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 transition-all hover:border-slate-700">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <span className="p-1 rounded-lg bg-slate-800/90">{sec.icon}</span>
                <span>{sec.title}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-normal pr-7">
                {sec.text}
              </p>
            </div>
          ))}

          <div className="text-[11px] text-slate-400 text-center pt-2">
            آخر تحديث للسياسة: نوفمبر 2026 • معتمد ومحمي تقنياً
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-5 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-3">
          {onAccept && (
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              <span>موافق على السياسة ومتابعة</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`py-3 px-6 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer transition-all ${!onAccept ? 'w-full' : ''}`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
