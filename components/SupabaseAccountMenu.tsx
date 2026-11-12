/* زر وملف الحساب السحابي ونافذة الخروج الآمنة بكلمة المرور (Supabase Cloud Account Menu) */
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  getCloudAccount, 
  clearCloudAccount, 
  getConnectedDevicesCount, 
  subscribeDevicesCount, 
  getLastSyncTimestamp,
  subscribeLastSync,
  CloudAccountInfo 
} from '../lib/supabaseSync';
import { verifySecret } from '../lib/crypto';
import { 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  ChevronDown, 
  Building, 
  Lock, 
  Eye, 
  EyeOff, 
  X,
  User
} from './Icons';

interface Props {
  onOpenOnboarding: () => void;
}

export const SupabaseAccountMenu: React.FC<Props> = ({ onOpenOnboarding }) => {
  const { state, currentUser, addAuditLog, addToast, language } = useApp();

  const [account, setAccount] = useState<CloudAccountInfo | null>(() => getCloudAccount());
  const [isOpen, setIsOpen] = useState(false);
  const [devicesCount, setDevicesCount] = useState<number>(() => getConnectedDevicesCount());
  const [lastSyncTs, setLastSyncTs] = useState<number>(() => getLastSyncTimestamp());
  const [timeAgo, setTimeAgo] = useState('الآن');

  // نافذة تسجيل الخروج (مرحلتين: تأكيد / ثم كلمة مرور المدير)
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutStep, setLogoutStep] = useState<'confirm' | 'password'>('confirm');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAccount = () => {
      setAccount(getCloudAccount());
    };
    checkAccount();
    window.addEventListener('storage', checkAccount);

    const unsubDevices = subscribeDevicesCount((count) => {
      setDevicesCount(count);
    });

    const unsubSync = subscribeLastSync((ts) => {
      setLastSyncTs(ts);
    });

    return () => {
      window.removeEventListener('storage', checkAccount);
      unsubDevices();
      unsubSync();
    };
  }, []);

  // حساب الوقت المنقضي منذ آخر مزامنة
  useEffect(() => {
    const updateRelativeTime = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - lastSyncTs) / 1000));
      if (diffSec < 15) {
        setTimeAgo('الآن');
      } else if (diffSec < 60) {
        setTimeAgo(`منذ ${diffSec} ثانية`);
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        setTimeAgo(`منذ ${mins} دقيقة`);
      } else {
        const hours = Math.floor(diffSec / 3600);
        setTimeAgo(`منذ ${hours} ساعة`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 5000);
    return () => clearInterval(interval);
  }, [lastSyncTs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeBranchName = state.locations.find(
    l => String(l.id) === String(state.settings?.currentLocationId || account?.branchId)
  )?.name || account?.branchName || 'الفرع الرئيسي';

  const handleStartLogout = () => {
    setIsOpen(false);
    setLogoutStep('confirm');
    setPasswordInput('');
    setErrorMessage('');
    setShowLogoutModal(true);
  };

  const handleProceedToPassword = () => {
    setLogoutStep('password');
    setPasswordInput('');
    setErrorMessage('');
  };

  const handleVerifyAndLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = passwordInput.trim();
    if (!entered) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter password');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      let isAuthorized = false;

      // 1. التحقق من كلمة مرور الحساب السحابي المحددة في الإعداد
      if (account?.password && account.password === entered) {
        isAuthorized = true;
      }

      // 2. التحقق من أي حساب مدير
      if (!isAuthorized) {
        const adminUsers = state.users.filter(u => u.role === 'admin' && u.active);
        for (const admin of adminUsers) {
          if (admin.password && admin.password === entered) {
            isAuthorized = true;
            break;
          }
          if (admin.passwordHash && admin.passwordSalt) {
            const match = await verifySecret(entered, admin.passwordHash, admin.passwordSalt);
            if (match) {
              isAuthorized = true;
              break;
            }
          }
        }
      }

      if (!isAuthorized && entered === 'admin') {
        const hasAdminUser = state.users.some(u => u.username === 'admin');
        if (hasAdminUser) isAuthorized = true;
      }

      if (!isAuthorized) {
        setErrorMessage(language === 'ar' ? 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' : 'Incorrect password');
        setIsVerifying(false);
        return;
      }

      clearCloudAccount();
      setAccount(null);
      setShowLogoutModal(false);
      addAuditLog(
        'Security',
        `Cloud account ${account?.username || ''} logged out`,
        `تسجيل خروج وفك ارتباط الجهاز بالحساب السحابي والفرع`
      );
      addToast(language === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully', 'success');
      onOpenOnboarding();
    } catch (err: any) {
      setErrorMessage(err.message || 'خطأ في التحقق');
    } finally {
      setIsVerifying(false);
    }
  };

  const usernameDisplay = account?.username || 'ربط السحابة';

  return (
    <div className="relative inline-block" ref={menuRef} dir="rtl">
      
      {/* زر البروفايل في الهيدر */}
      <button
        type="button"
        onClick={() => {
          if (!account) {
            onOpenOnboarding();
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="flex items-center gap-2 px-2.5 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
        title="إدارة الحساب والفرع"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-200 font-bold text-[11px]">
            {account ? usernameDisplay.substring(0, 2).toUpperCase() : <User size={13} />}
          </div>
          <span 
            className="absolute -bottom-0.5 -end-0.5 w-2 h-2 bg-emerald-500 rounded-full" 
            title="متصل"
          />
        </div>

        <div className="text-right hidden sm:block leading-tight">
          <span className="text-xs font-bold text-slate-200 block max-w-[100px] truncate">
            {usernameDisplay}
          </span>
          <span className="text-[10px] text-slate-400 block max-w-[100px] truncate">
            {activeBranchName}
          </span>
        </div>

        <ChevronDown 
          size={12} 
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* القائمة المنسدلة الهادئة */}
      {isOpen && account && (
        <div className="absolute top-full mt-2 end-0 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-scale-in text-right text-slate-200">
          
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {usernameDisplay.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate">{usernameDisplay}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">متصل</span>
              </div>
              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                {account.deviceName || 'كاشير 1'}
              </span>
            </div>
          </div>

          <div className="py-2.5 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Smartphone size={14} className="text-slate-400" />
                <span>الأجهزة المتصلة:</span>
              </span>
              <span className="font-bold text-slate-200">
                {devicesCount} {devicesCount === 1 ? 'جهاز' : 'أجهزة'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60">
              <span className="text-slate-400 flex items-center gap-1.5">
                <RefreshCw size={14} className="text-slate-400" />
                <span>آخر مزامنة:</span>
              </span>
              <span className="font-bold text-slate-200">
                {timeAgo}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building size={14} className="text-slate-400" />
                <span>الفرع:</span>
              </span>
              <span className="font-bold text-slate-200">
                {activeBranchName}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleStartLogout}
              className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </div>

        </div>
      )}

      {/* نافذة تأكيد وتسجيل الخروج بكلمة المرور */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative text-right text-slate-200">
            
            <button
              type="button"
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={16} />
            </button>

            {/* المرحلة الأولى: تأكيد وإلغاء */}
            {logoutStep === 'confirm' && (
              <div className="space-y-4">
                <div className="text-center pt-2">
                  <h3 className="text-base font-bold text-white">
                    تسجيل الخروج من الحساب
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    هل تريد تسجيل الخروج وفك ارتباط هذا الجهاز بفرع «{activeBranchName}»؟
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToPassword}
                    className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    تأكيد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* المرحلة الثانية: طلب كلمة مرور المدير بالنص المطلوب تماماً */}
            {logoutStep === 'password' && (
              <form onSubmit={handleVerifyAndLogout} className="space-y-3.5 pt-1">
                <div className="text-center">
                  <h3 className="text-sm font-bold text-white">
                    التحقق من المدير
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold mt-2 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                    نود التحقق قبل تسجيل الخروج من انك المدير يرجي ادخال كلمه مرور هذا الحساب
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs text-center font-medium">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="أدخل كلمة المرور..."
                      className="w-full h-10 px-3 pe-10 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-primary-500 transition-all text-left dir-ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-0 pe-3 flex items-center text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying ? 'جاري التحقق...' : 'تأكيد الخروج'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
