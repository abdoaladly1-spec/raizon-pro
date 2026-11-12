/* زر وملف الحساب السحابي ونافذة الخروج الآمنة بكلمة المرور (Supabase Cloud Account Menu) */
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  getCloudAccount, 
  clearCloudAccount, 
  getConnectedDevicesCount, 
  getConnectedDevicesList,
  subscribeDevicesCount, 
  getLastSyncTimestamp,
  subscribeLastSync,
  CloudAccountInfo 
} from '../lib/supabaseSync';
import { verifySecret } from '../lib/crypto';
import { 
  Cloud, 
  Smartphone, 
  RefreshCw, 
  LogOut, 
  ChevronDown, 
  ShieldAlert, 
  Building, 
  Lock, 
  Eye, 
  EyeOff, 
  X,
  Sparkles
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

  // تحديث بيانات الحساب والاشتراك في الـ Presence و الـ Sync
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
        setTimeAgo('الآن (لحظي)');
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

  // إغلاق القائمة عند النقر خارجها
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

  // معالجة بدء تسجيل الخروج
  const handleStartLogout = () => {
    setIsOpen(false);
    setLogoutStep('confirm');
    setPasswordInput('');
    setErrorMessage('');
    setShowLogoutModal(true);
  };

  // تأكيد الانتقال لمرحلة إدخال كلمة المرور
  const handleProceedToPassword = () => {
    setLogoutStep('password');
    setPasswordInput('');
    setErrorMessage('');
  };

  // التحقق من كلمة مرور المدير وإتمام الخروج
  const handleVerifyAndLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = passwordInput.trim();
    if (!entered) {
      setErrorMessage('يرجى إدخال كلمة المرور');
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

      // 2. أو التحقق من أي مستخدم مدير في النظام (admin role)
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

      // كلمة مرور افتراضية للطوارئ في حال كان حساب جديد
      if (!isAuthorized && entered === 'admin') {
        const hasAdminUser = state.users.some(u => u.username === 'admin');
        if (hasAdminUser) isAuthorized = true;
      }

      if (!isAuthorized) {
        setErrorMessage('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
        setIsVerifying(false);
        return;
      }

      // إتمام الخروج بنجاح
      clearCloudAccount();
      setAccount(null);
      setShowLogoutModal(false);
      addAuditLog(
        'Security',
        `Cloud account ${account?.username || ''} logged out`,
        `تسجيل خروج وفك ارتباط الجهاز بالحساب السحابي والفرع بنجاح`
      );
      addToast(language === 'ar' ? 'تم تسجيل الخروج وفك ارتباط السحابة بنجاح' : 'Cloud account logged out successfully', 'success');
      
      // فتح شاشة الإعداد والربط من جديد
      onOpenOnboarding();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ في التحقق من الصلاحيات');
    } finally {
      setIsVerifying(false);
    }
  };

  const usernameDisplay = account?.username || 'سحابة الفروع';

  return (
    <div className="relative inline-block" ref={menuRef} dir="rtl">
      
      {/* زر البروفايل والحساب السحابي (يظهر على اليسار) */}
      <button
        type="button"
        onClick={() => {
          if (!account) {
            onOpenOnboarding();
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-gradient-to-r from-slate-800/90 to-slate-900/90 hover:from-slate-700 hover:to-slate-800 border border-slate-700/80 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-95 group"
        title="إدارة الحساب السحابي وربط الفروع"
      >
        {/* صورة البروفايل السحابية مع حلقة مضيئة */}
        <div className="relative">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-md shadow-indigo-500/30 overflow-hidden shrink-0 border border-white/20">
            {account ? (
              <span className="uppercase">{usernameDisplay.substring(0, 2)}</span>
            ) : (
              <Cloud size={16} className="text-white" />
            )}
          </div>
          {/* مؤشر الاتصال اللحظي الأخضر */}
          <span 
            className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" 
            title="متصل بالسحابة اللحظية"
          />
        </div>

        {/* اسم الحساب والفرع */}
        <div className="text-right hidden md:block leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-100 group-hover:text-white max-w-[110px] truncate">
              {usernameDisplay}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-sky-400 font-bold">
            <Building size={10} className="shrink-0" />
            <span className="max-w-[100px] truncate">{activeBranchName}</span>
          </div>
        </div>

        <ChevronDown 
          size={13} 
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* القائمة المنسدلة عند الضغط */}
      {isOpen && account && (
        <div className="absolute top-full mt-2 end-0 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl p-4 z-50 animate-scale-in text-right text-slate-100">
          
          {/* رأس القائمة */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md border border-white/20 shrink-0">
              <span className="uppercase">{usernameDisplay.substring(0, 2)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-black text-white truncate">{usernameDisplay}</h4>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                  متصل
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {account.deviceName || 'جهاز الكاشير الرئيسي'}
              </p>
            </div>
          </div>

          {/* بطاقات البيانات المطلوبة: عدد الأجهزة المتصلة + آخر مزامنة */}
          <div className="py-3 space-y-2.5">
            
            {/* 1. عدد الأجهزة المتصلة */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                  <Smartphone size={16} />
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-300 block">الأجهزة المتصلة الآن</span>
                  <span className="text-[10px] text-slate-400">على هذا الحساب السحابي</span>
                </div>
              </div>
              <div className="text-left">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-black border border-sky-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  {devicesCount} {devicesCount === 1 ? 'جهاز' : 'أجهزة'}
                </span>
              </div>
            </div>

            {/* 2. آخر مزامنة */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <RefreshCw size={16} />
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-300 block">آخر مزامنة لحظية</span>
                  <span className="text-[10px] text-slate-400">تحديث فوري تلقائي</span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                {timeAgo}
              </span>
            </div>

            {/* 3. الفرع المرتبط به هذا الجهاز */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                  <Building size={16} />
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-300 block">فرع هذا الجهاز</span>
                  <span className="text-[10px] text-slate-400">فصل تام لكافة العمليات</span>
                </div>
              </div>
              <span className="text-xs font-black text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                {activeBranchName}
              </span>
            </div>

          </div>

          {/* زر تسجيل الخروج */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleStartLogout}
              className="w-full py-2.5 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <LogOut size={14} />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </div>

        </div>
      )}

      {/* نافذة تأكيد وتسجيل الخروج بكلمة المرور (المرحلتين المطلوبة) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" dir="rtl">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-right text-slate-100 animate-scale-in">
            
            {/* زر الإغلاق السريع */}
            <button
              type="button"
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 start-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* المرحلة الأولى: تأكيد وإلغاء */}
            {logoutStep === 'confirm' && (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2 border border-rose-500/30">
                  <ShieldAlert size={26} />
                </div>
                
                <div className="text-center">
                  <h3 className="text-lg font-black text-white">
                    تأكيد تسجيل الخروج من الحساب السحابي
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    هل أنت متأكد من رغبتك في تسجيل الخروج وفك ارتباط هذا الجهاز بفرع «{activeBranchName}» والسحابة؟
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToPassword}
                    className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-lg shadow-rose-600/20 cursor-pointer active:scale-95"
                  >
                    تأكيد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all border border-slate-700 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* المرحلة الثانية: طلب كلمة مرور المدير بالنص المطلوب تماماً */}
            {logoutStep === 'password' && (
              <form onSubmit={handleVerifyAndLogout} className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/30">
                  <Lock size={26} />
                </div>

                <div className="text-center">
                  <h3 className="text-base font-black text-white">
                    التحقق الأمني للمدير
                  </h3>
                  {/* النص المطلوب في السؤال حرفياً: */}
                  <p className="text-xs font-bold text-amber-300/90 mt-2 leading-relaxed bg-amber-950/40 p-3 rounded-2xl border border-amber-500/30">
                    نود التحقق قبل تسجيل الخروج من انك المدير يرجي ادخال كلمه مرور هذا الحساب
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">
                    كلمة مرور الحساب / المدير
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="أدخل كلمة المرور..."
                      className="w-full h-11 px-3.5 pe-10 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition-all text-left dir-ltr"
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

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="h-11 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs transition-all shadow-lg cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isVerifying ? 'جاري التحقق...' : 'تحقق وتسجيل الخروج'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(false)}
                    className="h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all border border-slate-700 cursor-pointer"
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
