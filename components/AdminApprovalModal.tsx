import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Keypad, X, Check, AlertTriangle, KeyRound } from './Icons';
import { useApp } from '../context/AppContext';
import { User } from '../types';

export interface AdminApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved: (adminUser: User) => void;
  actionTitle: string;
  actionDescription?: string;
  targetDetails?: string;
}

export const AdminApprovalModal: React.FC<AdminApprovalModalProps> = ({
  isOpen,
  onClose,
  onApproved,
  actionTitle,
  actionDescription,
  targetDetails
}) => {
  const { verifyAdminApproval, t, language, addAuditLog, currentUser } = useApp();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPassword('');
      setErrorMsg('');
      setIsVerifying(false);
      setIsShake(false);
      setMode('pin');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && mode === 'password') {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // استماع الكيبورد الفيزيائي في وضع الـ PIN
  useEffect(() => {
    if (!isOpen || mode !== 'pin' || isVerifying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setPin(prev => (prev.length < 6 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, isVerifying, onClose]);

  // عند اكتمال إدخال الـ PIN تلقائياً (4 إلى 6 أرقام)
  const submitVerification = async (secretToVerify: string) => {
    if (!secretToVerify || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await verifyAdminApproval(secretToVerify);
      if (res.ok && res.adminUser) {
        addAuditLog(
          'Security',
          `Admin authorization granted by ${res.adminUser.username} for action: ${actionTitle}`,
          `تفويض إداري معتمد: وافق المدير "${res.adminUser.name || res.adminUser.username}" على إجراء "${actionTitle}" للمستخدم "${currentUser?.name || currentUser?.username || 'كاشير'}"`
        );
        onApproved(res.adminUser);
        onClose();
      } else {
        setErrorMsg(res.error || (language === 'ar' ? 'الرمز غير صحيح أو الحساب ليس مديراً' : 'Invalid PIN/Password'));
        setIsShake(true);
        setTimeout(() => setIsShake(false), 500);
        setPin('');
      }
    } catch (e: any) {
      setErrorMsg(language === 'ar' ? 'حدث خطأ أثناء فحص التفويض' : 'Verification failed');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (isVerifying) return;
    setErrorMsg('');
    if (val === 'backspace') {
      setPin(prev => prev.slice(0, -1));
    } else if (val === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      const next = pin + val;
      setPin(next);
      if (next.length >= 4) {
        // فحص مباشر إذا كان 4 أو 6 أرقام
        submitVerification(next);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in select-none">
      <div 
        className={`w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-200 ${
          isShake ? 'rz-card-shake' : ''
        }`}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Shield size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                {language === 'ar' ? 'موافقة وتفويض المدير' : 'Manager Authorization'}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'صلاحية أمنية لحماية الإيرادات' : 'Loss Prevention Control'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Details Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-extrabold text-slate-800 dark:text-slate-200">
                {actionTitle}
              </p>
              {actionDescription && (
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  {actionDescription}
                </p>
              )}
              {targetDetails && (
                <p className="text-primary-600 dark:text-primary-400 font-mono font-bold text-[11px] mt-1 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-md inline-block border border-primary-200/50 dark:border-primary-800/40">
                  {targetDetails}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mode Switcher (PIN vs Password) */}
        <div className="px-5 pt-3 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => { setMode('pin'); setErrorMsg(''); }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'pin'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Keypad size={13} />
            <span>{language === 'ar' ? 'رمز PIN السريع' : 'Quick PIN'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('password'); setErrorMsg(''); }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'password'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lock size={13} />
            <span>{language === 'ar' ? 'كلمة المرور' : 'Password'}</span>
          </button>
        </div>

        {/* PIN Entry Mode */}
        {mode === 'pin' && (
          <div className="p-5 pt-3">
            {/* PIN Indicator Dots */}
            <div className="flex justify-center items-center gap-3 py-3 mb-2">
              {[0, 1, 2, 3, 4, 5].map(idx => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    idx < pin.length
                      ? 'bg-primary-600 scale-110 shadow-xs shadow-primary-500/30'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {errorMsg && (
              <p className="text-center text-xs font-bold text-rose-500 mb-3 animate-fade-in">
                {errorMsg}
              </p>
            )}

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => {
                const isClear = btn === 'C';
                const isBack = btn === '⌫';
                return (
                  <button
                    key={btn}
                    type="button"
                    disabled={isVerifying}
                    onClick={() => {
                      if (isClear) handleKeypadPress('clear');
                      else if (isBack) handleKeypadPress('backspace');
                      else handleKeypadPress(btn);
                    }}
                    className={`h-12 rounded-2xl font-mono text-base font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                      isClear
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-sans'
                        : isBack
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm'
                        : 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs hover:border-primary-400'
                    }`}
                  >
                    {btn}
                  </button>
                );
              })}
            </div>

            {pin.length >= 4 && (
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => submitVerification(pin)}
                className="w-full mt-3 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isVerifying ? (language === 'ar' ? 'جارٍ التحقق...' : 'Verifying...') : (language === 'ar' ? 'تأكيد الموافقة' : 'Authorize')}</span>
              </button>
            )}
          </div>
        )}

        {/* Password Entry Mode */}
        {mode === 'password' && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              submitVerification(password);
            }} 
            className="p-5 pt-3 space-y-3"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'ar' ? 'كلمة مرور المدير المعتمد:' : 'Admin Password:'}
              </label>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={language === 'ar' ? 'أدخل كلمة مرور المشرف أو المدير' : 'Enter admin password'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary-500 transition-all font-mono"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-rose-500 animate-fade-in">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={!password.trim() || isVerifying}
                className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-500/20 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                <span>{isVerifying ? (language === 'ar' ? 'جارٍ التحقق...' : 'Verifying...') : (language === 'ar' ? 'اعتماد' : 'Approve')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
