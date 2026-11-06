import { PATCHER_ART_DATA_URI, POS_BG_DATA_URI, PATCHER_LOGO_URI } from '../lib/patcherArt';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Key,
  XCircle,
  CheckCircle, 
  Users, 
  PlusCircle, 
  Copy, 
  Check, 
  Trash2, 
  Clock, 
  Laptop, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  X, 
  Search, 
  Lock, 
  Eye, 
  EyeOff,
  Maximize2,
  Minimize2,
  SecurityIcon,
  UserIcon
} from './Icons';

interface PatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivationSuccess?: () => void;
}

interface ClientRecord {
  id: string;
  tid: string;
  clientName: string;
  machineId: string;
  durationLabel: string;
  durationValue: string;
  createdAt: string;
  expiresAt: string | null;
  licenseKey: string;
  status: 'active' | 'expired' | 'revoked';
}

const DURATIONS = [
  { value: '30m', label: '30 دقيقة' },
  { value: '1d', label: 'يوم واحد' },
  { value: '7d', label: 'أسبوع' },
  { value: '30d', label: 'شهر' },
  { value: '3m', label: '3 شهور' },
  { value: '6m', label: '6 شهور' },
  { value: '1y', label: 'سنة كاملة' },
  { value: 'lifetime', label: 'طوال الحياة' },
];

export const PatcherModal: React.FC<PatcherModalProps> = ({ isOpen, onClose, onActivationSuccess }) => {
  // هل التطبيق يعمل في وضع الباتشر المستقل (--patcher)
  const isPatcherMode = useMemo(() => {
    return typeof window !== 'undefined' && window.location.search.includes('mode=patcher');
  }, []);

  // المصادقة
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUsername, setAuthUsername] = useState('admin');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // حجم النافذة بعد تسجيل الدخول (يمكن تعديل حجمها)
  const [isMaximized, setIsMaximized] = useState(false);

  // التنقل بعد الدخول: 'home' (الزرين) | 'new' (تفعيل جديد) | 'clients' (قائمة العملاء)
  const [currentView, setCurrentView] = useState<'home' | 'new' | 'clients'>('home');

  // قائمة العملاء
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // نموذج التفعيل الجديد
  const [clientName, setClientName] = useState('');
  const [machineId, setMachineId] = useState('');
  const [currentMachineId, setCurrentMachineId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('30m');
  const [formError, setFormError] = useState('');

  // المعاينة وتأكيد التوليد
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedRecord, setGeneratedRecord] = useState<ClientRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedMid, setCopiedMid] = useState(false);
  const [activatingCurrent, setActivatingCurrent] = useState(false);
  const [currentMachineLicense, setCurrentMachineLicense] = useState<{
    valid?: boolean;
    isPerpetual?: boolean;
    expiresAt?: string | null;
  } | null>(null);

  const checkCurrentMachineLicense = async () => {
    try {
      const bridge = window.procashier;
      if (bridge?.getLicenseStatus) {
        const st = await bridge.getLicenseStatus();
        setCurrentMachineLicense(st);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkCurrentMachineLicense();
    }
  }, [isAuthenticated]);
  const [activateSuccessMsg, setActivateSuccessMsg] = useState('');

  // التحكم في مقاس النافذة الخارجية (Electron BrowserWindow)
  useEffect(() => {
    if (!isOpen) return;

    const bridge = window.procashier;
    if (bridge?.patcherSetWindowSize) {
      if (!isAuthenticated) {
        // حجم النافذة الخارجية صغير وثابت لا يمكن تكبيره لشاشة الدخول
        bridge.patcherSetWindowSize({ state: 'login', width: 725, height: 440 });
      } else {
        // بعد تسجيل الدخول: نافذة كبيرة قابلة لتغيير الحجم
        bridge.patcherSetWindowSize({ state: 'dashboard', width: 1100, height: 750 });
      }
    }
  }, [isOpen, isAuthenticated]);

  // استعادة مقاس النافذة الخارجية عند إغلاق الباتشر
  const handleClose = () => {
    if (!isPatcherMode) {
      window.procashier?.patcherSetWindowSize?.({ state: 'restore' });
    }
    onClose();
  };

  // جلب معرف الجهاز الحالي
  useEffect(() => {
    if (!isOpen) return;
    const bridge = window.procashier;
    if (bridge?.patcherGetCurrentMid) {
      bridge.patcherGetCurrentMid().then(mid => {
        if (mid) {
          setCurrentMachineId(mid);
          if (!machineId) setMachineId(mid);
        }
      }).catch(console.error);
    } else if (bridge?.getLicenseStatus) {
      bridge.getLicenseStatus().then(st => {
        if (st.machineId) {
          setCurrentMachineId(st.machineId);
          if (!machineId) setMachineId(st.machineId);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  // جلب قائمة العملاء
  const loadClients = async () => {
    try {
      const bridge = window.procashier;
      if (bridge?.patcherGetClients) {
        const list = await bridge.patcherGetClients();
        if (Array.isArray(list)) setClients(list);
      } else {
        const raw = localStorage.getItem('patcher_dev_clients');
        if (raw) setClients(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);

    try {
      const bridge = window.procashier;
      if (bridge?.patcherLogin) {
        const res = await bridge.patcherLogin(authUsername.trim(), authPassword);
        if (res.ok) {
          setIsAuthenticated(true);
          if (res.currentMachineId) {
            setCurrentMachineId(res.currentMachineId);
            setMachineId(res.currentMachineId);
          }
          await loadClients();
          setCurrentView('home');
        } else {
          setAuthError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        }
      } else {
        if (authUsername === 'admin' && (authPassword === '22122005Me#' || authPassword === '2212205Me#')) {
          setIsAuthenticated(true);
          await loadClients();
          setCurrentView('home');
        } else {
          setAuthError('كلمة المرور غير صحيحة');
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || 'خطأ أثناء تسجيل الدخول');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOpenPreview = () => {
    setFormError('');
    if (!clientName.trim()) {
      setFormError('يرجى إدخال اسم العميل أولاً');
      return;
    }
    if (!machineId.trim() || machineId.trim().length < 10) {
      setFormError('يرجى إدخال معرف الجهاز بشكل صحيح');
      return;
    }
    setShowPreviewModal(true);
  };

  const handleConfirmGenerate = async () => {
    setShowPreviewModal(false);
    setFormError('');
    setCopiedKey(false);
    setActivateSuccessMsg('');

    try {
      const bridge = window.procashier;
      if (bridge?.patcherGenerate) {
        const res = await bridge.patcherGenerate({
          clientName: clientName.trim(),
          machineId: machineId.trim(),
          duration: selectedDuration,
        });

        if (res.ok && res.licenseKey) {
          setGeneratedKey(res.licenseKey);
          setGeneratedRecord(res.record);
          if (res.clients) setClients(res.clients);
          else await loadClients();
        } else {
          setFormError(res.error || 'فشل توليد المفتاح');
        }
      } else {
        setFormError('محرك التفعيل غير متاح في المتصفح');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء التوليد');
    }
  };

  const handleCopyKey = async (keyToCopy: string) => {
    try {
      await navigator.clipboard.writeText(keyToCopy);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyMid = async () => {
    if (!currentMachineId) return;
    try {
      await navigator.clipboard.writeText(currentMachineId);
      setCopiedMid(true);
      setTimeout(() => setCopiedMid(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleActivateCurrentPc = async (key: string) => {
    setActivatingCurrent(true);
    setActivateSuccessMsg('');
    try {
      const bridge = window.procashier;
      if (bridge?.patcherActivateCurrent) {
        const res = await bridge.patcherActivateCurrent(key);
        if (res.ok) {
          setActivateSuccessMsg('تم تفعيل هذا الجهاز بنجاح وفورياً!');
          if (onActivationSuccess) {
            setTimeout(() => onActivationSuccess(), 1000);
          }
        } else {
          setFormError(res.error || 'فشل تفعيل هذا الجهاز');
        }
      } else if (bridge?.activateLicense) {
        const res = await bridge.activateLicense(key);
        if (res.success) {
          setActivateSuccessMsg('تم التفعيل بنجاح!');
          if (onActivationSuccess) {
            setTimeout(() => onActivationSuccess(), 1000);
          }
        } else {
          setFormError(res.message || 'فشل تفعيل المفتاح');
        }
      }
    } catch (e: any) {
      setFormError(e?.message || 'خطأ أثناء التفعيل');
    } finally {
      setActivatingCurrent(false);
    }
  };

  const handleDeactivateCurrentPc = async () => {
    if (!window.confirm('هل تريد بالتأكيد إلغاء اشتراك وتفعيل هذا الجهاز؟ سيعود النظام لوضع غير مفعل ولن يمكن الدخول إلا بعد تفعيل جديد.')) {
      return;
    }
    setActivatingCurrent(true);
    setActivateSuccessMsg('');
    setFormError('');
    try {
      const bridge = window.procashier;
      if (bridge?.patcherDeactivateCurrent) {
        const res = await bridge.patcherDeactivateCurrent();
        if (res.ok) {
          setActivateSuccessMsg('تم إلغاء تفعيل واشتراك هذا الجهاز بنجاح! أصبح النظام غير مفعل.');
          if (res.clients) setClients(res.clients);
          await checkCurrentMachineLicense();
        } else {
          setFormError(res.error || 'فشل إلغاء التفعيل');
        }
      } else {
        localStorage.removeItem('raizon_license');
        setActivateSuccessMsg('تم إلغاء التفعيل.');
      }
    } catch (e: any) {
      setFormError(e?.message || 'خطأ أثناء إلغاء التفعيل');
    } finally {
      setActivatingCurrent(false);
    }
  };

  const handleToggleClientStatus = async (id: string) => {
    try {
      const bridge = window.procashier;
      if (bridge?.patcherToggleClientStatus) {
        const res = await bridge.patcherToggleClientStatus(id);
        if (res.ok && res.clients) {
          setClients(res.clients);
          await checkCurrentMachineLicense();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('هل تريد بالتأكيد حذف هذا الترخيص من القائمة؟')) return;
    try {
      const bridge = window.procashier;
      if (bridge?.patcherDeleteClient) {
        const res = await bridge.patcherDeleteClient(id);
        if (res.ok) setClients(res.clients);
      } else {
        const next = clients.filter(c => c.id !== id);
        setClients(next);
        localStorage.setItem('patcher_dev_clients', JSON.stringify(next));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.machineId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.durationLabel && c.durationLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [clients, searchQuery]);

  if (!isOpen) return null;

  /* =========================================================================
     1. شاشة الدخول: النافذة الخارجية والداخلية صغيرة وثابتة لا يمكن تكبيرها
     ========================================================================= */
  if (!isAuthenticated) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-start select-none bg-cover bg-center overflow-hidden" 
        style={{ backgroundImage: `url(${POS_BG_DATA_URI})` }}
        dir="ltr"
      >
        {/* الحاوية المتناسقة على اليسار كما في التصميم تماماً */}
        <div className="relative z-10 w-full max-w-[340px] ms-6 sm:ms-10 my-auto" dir="rtl">
          
          {/* زر إغلاق النافذة */}
          {!isPatcherMode && (
            <button
              type="button"
              onClick={handleClose}
              className="absolute -top-9 left-0 p-1.5 rounded-full bg-black/60 hover:bg-red-500/50 text-slate-300 hover:text-red-300 transition-colors"
              title="إغلاق"
            >
              <X size={15} />
            </button>
          )}

          {/* بطاقة تسجيل الدخول الزجاجية المتناسقة تماماً مع خلفية الكاشير */}
          <div className="bg-[#13072b]/90 border border-[#432378]/90 rounded-3xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.9)] space-y-4 backdrop-blur-sm">
            
            <div className="text-center pt-1 pb-1">
              <img 
                src={PATCHER_LOGO_URI} 
                alt="Rizon Patcher" 
                className="w-16 h-16 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.45)] hover:scale-105 transition-transform duration-300" 
              />
              <h3 className="text-lg font-bold text-white tracking-wide">
                تسجيل الدخول للوحة التحكم
              </h3>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
              {/* اسم المستخدم */}
              <div className="relative">
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 ps-10 rounded-xl bg-[#0c041c]/95 border border-[#4c1d95]/80 text-white text-sm font-semibold focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/30 outline-none transition-all placeholder:text-slate-500"
                  placeholder="اسم المستخدم"
                  dir="ltr"
                  required
                />
                <div className="absolute left-3.5 top-3 pointer-events-none flex items-center justify-center">
                  <UserIcon size={16} />
                </div>
              </div>

              {/* كلمة المرور */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 ps-10 pe-10 rounded-xl bg-[#0c041c]/95 border border-[#4c1d95]/80 text-white text-sm font-semibold focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/30 outline-none transition-all placeholder:text-slate-500 tracking-wider"
                  placeholder="كلمة المرور"
                  dir="ltr"
                  required
                />
                <div className="absolute left-3.5 top-3 pointer-events-none flex items-center justify-center">
                  <SecurityIcon size={16} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-purple-300/60 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {authError && (
                <div className="p-2 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-1.5 shadow-sm">
                  <AlertCircle size={14} className="shrink-0 text-red-400" />
                  <span>{authError}</span>
                </div>
              )}

              {/* زر الدخول البنفسجي المتوهج */}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-3 bg-gradient-to-r from-[#9b26f2] via-[#8516e0] to-[#6d28d9] hover:from-[#aa36fc] hover:to-[#7c3aed] text-white font-bold rounded-xl shadow-[0_0_25px_rgba(155,38,242,0.65)] transition-all active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <span>{authBusy ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
              </button>

              {/* تذكرني ونسيت كلمة المرور بتناسق كامل مع الصورة */}
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <button
                  type="button"
                  onClick={() => alert('كلمة المرور الافتراضية للمطور هي: 22122005Me#')}
                  className="text-slate-400 hover:text-purple-300 transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span>تذكرني</span>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-[#0c041c] border-[#f97316] text-[#f97316] accent-[#f97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
              </div>
            </form>

          </div>
        </div>

      </div>
    );
  }

  /* =========================================================================
     2. بعد الدخول: النافذة الخارجية تتمدد للنافذة الكبيرة وتكون قابلة لتغيير الحجم
     ========================================================================= */
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isPatcherMode ? 'bg-slate-950' : 'bg-black/80 backdrop-blur-md p-3 sm:p-5'}`} dir="rtl">
      
      <div className={`relative w-full ${isPatcherMode ? 'h-full rounded-none border-none' : isMaximized ? 'max-w-[98vw] h-[95vh] rounded-3xl' : 'max-w-4xl max-h-[92vh] rounded-3xl'} flex flex-col bg-slate-900 border-2 border-purple-500/50 shadow-2xl text-slate-100 overflow-hidden font-sans transition-all duration-300`}>
        
        {/* شريط العنوان - ألوان اللوجو (عنبر وبنفسجي) مع زر تكبير/تصغير */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-950 via-slate-900 to-amber-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src={PATCHER_LOGO_URI} 
              alt="Rizon Patcher" 
              className="w-10 h-10 rounded-full object-cover shadow-lg shadow-purple-500/30 hover:scale-105 transition-transform" 
            />
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="text-amber-400">لوحة تحكم</span> <span className="text-purple-400">التراخيص — Rizon Patcher</span>
              </h2>
              <p className="text-[11px] text-slate-400">نظام إدارة وتوليد مفاتيح RaiZon Pro</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView !== 'home' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentView('home');
                  setGeneratedKey(null);
                  setGeneratedRecord(null);
                  setFormError('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 transition-colors flex items-center gap-1.5"
              >
                <ArrowRight size={14} /> الرئيسية
              </button>
            )}

            {/* زر تكبير وتصغير النافذة */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isMaximized ? 'استعادة الحجم الطبيعي' : 'تكبير النافذة'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* زر الإغلاق */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* جسم النافذة */}
        <div className="p-6 overflow-y-auto flex-1">
          {currentView === 'home' ? (
            /* الواجهة الرئيسية - زرين كبيرين */
            <div className="max-w-2xl mx-auto py-6 space-y-6">
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-white">اختر الإجراء المطلوب</h3>
                <p className="text-xs text-slate-400">توليد تراخيص أو مراجعة العملاء المسجلين</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* زر 1: تفعيل جديد */}
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedKey(null);
                    setGeneratedRecord(null);
                    setFormError('');
                    setCurrentView('new');
                  }}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-amber-600/20 via-amber-500/10 to-slate-800 border-2 border-amber-500/40 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/15 transition-all text-right flex flex-col justify-between h-56 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <PlusCircle size={30} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300">
                      فوري
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                      <span>تفعيل جديد</span>
                      <ArrowRight size={18} className="text-amber-400 group-hover:translate-x-[-3px] transition-transform" />
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      توليد مفتاح ترخيص جديد وربطه بجهاز العميل
                    </p>
                  </div>
                </button>

                {/* زر 2: قائمة العملاء */}
                <button
                  type="button"
                  onClick={() => {
                    loadClients();
                    setCurrentView('clients');
                  }}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-purple-600/20 via-purple-500/10 to-slate-800 border-2 border-purple-500/40 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/15 transition-all text-right flex flex-col justify-between h-56 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Users size={30} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300">
                      {clients.length} عميل
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                      <span>قائمة العملاء</span>
                      <ArrowRight size={18} className="text-purple-400 group-hover:translate-x-[-3px] transition-transform" />
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      عرض التراخيص وحالتها (ساري أو انتهت المدة)
                    </p>
                  </div>
                </button>

              </div>

              {/* قسم إدارة اشتراك وتفعيل هذا الجهاز */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 space-y-3 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Laptop size={18} className="text-amber-400 shrink-0" />
                    <span className="font-bold text-white text-sm">اشتراك وترخيص هذا الجهاز:</span>
                    {currentMachineLicense?.valid ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>مفعل (اشتراك ساري)</span>
                        {currentMachineLicense.isPerpetual ? ' دائم' : currentMachineLicense.expiresAt ? ` (ينتهي ${new Date(currentMachineLicense.expiresAt).toLocaleDateString('ar-EG')})` : ''}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <span>غير مفعل (الاشتراك متوقف أو ملغي)</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyMid}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold self-start sm:self-auto transition-colors flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>{copiedMid ? 'تم نسخ المعرف' : 'نسخ المعرف'}</span>
                  </button>
                </div>

                {activateSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{activateSuccessMsg}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* زر إلغاء اشتراك هذا الجهاز */}
                  <button
                    type="button"
                    onClick={handleDeactivateCurrentPc}
                    disabled={activatingCurrent || !currentMachineLicense?.valid}
                    className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <XCircle size={15} className="text-red-400" />
                    <span>إلغاء اشتراك وتفعيل هذا الجهاز</span>
                  </button>

                  {/* زر تفعيل هذا الجهاز */}
                  <button
                    type="button"
                    onClick={() => {
                      setMachineId(currentMachineId);
                      setClientName('الجهاز الحالي');
                      setGeneratedKey(null);
                      setGeneratedRecord(null);
                      setFormError('');
                      setCurrentView('new');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Key size={15} className="text-amber-400" />
                    <span>توليد وتفعيل اشتراك جديد لهذا الجهاز</span>
                  </button>
                </div>
              </div>
            </div>
          ) : currentView === 'new' ? (
            /* شاشة تفعيل جديد */
            <div className="max-w-xl mx-auto space-y-4">
              
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Key className="text-amber-400" size={20} />
                  <span>توليد مفتاح ترخيص جديد</span>
                </h3>
              </div>

              {/* اسم العميل */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User size={15} className="text-purple-400" />
                  <span>اسم المستخدم / العميل (للتذكر والمراجعة) <span className="text-amber-400">*</span></span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="مثال: أحمد محمد - فرع المهندسين"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-bold focus:border-purple-400 outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* معرف الجهاز */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Laptop size={15} className="text-amber-400" />
                    <span>معرف الجهاز (Machine ID) <span className="text-amber-400">*</span></span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {currentMachineId && (
                      <button
                        type="button"
                        onClick={() => setMachineId(currentMachineId)}
                        className="text-amber-400 hover:text-amber-300 font-bold underline"
                      >
                        معرف هذا الجهاز
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setMachineId(text.trim());
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      لصق من الحافظة
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  placeholder="ألصق معرف جهاز العميل هنا"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-mono text-xs font-bold focus:border-amber-400 outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* اختيار المدة */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Clock size={15} className="text-purple-400" />
                  <span>مدة الترخيص (من 30 دقيقة حتى طوال الحياة):</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((dur) => (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setSelectedDuration(dur.value)}
                      className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                        selectedDuration === dur.value
                          ? 'bg-gradient-to-r from-amber-500 to-purple-600 text-white border-transparent shadow-lg shadow-purple-600/20'
                          : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* زر التوليد */}
              <button
                type="button"
                onClick={handleOpenPreview}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black rounded-xl shadow-lg shadow-purple-600/20 transition-all active:scale-95 text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={18} />
                <span>معاينة وتوليد مفتاح الترخيص</span>
              </button>

              {/* المفتاح المتولد */}
              {generatedKey && (
                <div className="p-5 rounded-2xl bg-slate-800/90 border-2 border-amber-500/50 shadow-xl space-y-3.5 animate-scale-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={16} /> تم التوليد بنجاح وحفظه في قائمة العملاء
                    </span>
                    <span className="text-slate-300">المدة: {generatedRecord?.durationLabel}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-amber-300 break-all select-all leading-relaxed" dir="ltr">
                    {generatedKey}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopyKey(generatedKey)}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}</span>
                    </button>

                    {machineId.trim() === currentMachineId && (
                      <button
                        type="button"
                        onClick={() => handleActivateCurrentPc(generatedKey)}
                        disabled={activatingCurrent}
                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles size={16} />
                        <span>{activatingCurrent ? 'جاري التفعيل...' : 'تفعيل هذا الجهاز فوراً'}</span>
                      </button>
                    )}
                  </div>

                  {activateSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span>{activateSuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* قائمة العملاء - مع عرض ساري (أخضر) أو انتهت المدة (أحمر) */
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Users className="text-purple-400" size={20} />
                    <span>قائمة العملاء والتراخيص ({clients.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">عرض حالة كل ترخيص مع إمكانية النسخ والحذف</p>
                </div>

                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث باسم العميل أو المعرف..."
                    className="w-full px-3.5 py-2 ps-8 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold focus:border-purple-400 outline-none"
                  />
                  <Search size={14} className="absolute start-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Users size={44} className="mx-auto opacity-30 text-purple-400" />
                  <p className="text-sm font-bold">لا يوجد عملاء مسجلين حالياً</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pe-1">
                  {filteredClients.map((client) => {
                    const isPerpetual = !client.expiresAt;
                    const isExpired = client.expiresAt ? Date.now() > Date.parse(client.expiresAt) : false;
                    const isValid = isPerpetual || !isExpired;

                    return (
                      <div
                        key={client.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isValid
                            ? 'bg-slate-800/80 border-slate-700/80 hover:border-purple-500/50'
                            : 'bg-red-950/20 border-red-900/40 hover:border-red-600/50'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-black text-white text-sm truncate">{client.clientName}</span>

                            {client.machineId === currentMachineId && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                                هذا الجهاز
                              </span>
                            )}

                            {/* شارة الحالة: ساري (أخضر) أو منتهي/ملغي (أحمر) */}
                            {client.status === 'revoked' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5">
                                <XCircle size={13} className="text-rose-400" />
                                <span>ملغي / مجمد</span>
                                <span className="opacity-80 font-normal">({client.durationLabel})</span>
                              </span>
                            ) : isValid ? (
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>ساري</span>
                                <span className="opacity-80 font-normal">({client.durationLabel})</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/50 flex items-center gap-1.5 shadow-sm shadow-red-500/10">
                                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                <span>انتهت المدة</span>
                                <span className="opacity-80 font-normal">({client.durationLabel})</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                            <span className="truncate" dir="ltr">{client.machineId.substring(0, 24)}...</span>
                            {client.expiresAt && (
                              <span className="font-sans text-[11px] text-amber-300/90">
                                الانتهاء: {new Date(client.expiresAt).toLocaleDateString('ar-EG')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyKey(client.licenseKey)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="نسخ مفتاح الترخيص"
                          >
                            <Copy size={14} /> نسخ المفتاح
                          </button>

                          <button type="button" onClick={() => handleToggleClientStatus(client.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${client.status === "revoked" ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300" : "bg-red-500/20 hover:bg-red-500/30 text-red-300"}`} title={client.status === "revoked" ? "إعادة تفعيل الاشتراك" : "إلغاء الاشتراك"}>{client.status === "revoked" ? <CheckCircle size={14} /> : <XCircle size={14} />}<span>{client.status === "revoked" ? "تفعيل" : "إلغاء"}</span></button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client.id)}
                            className="p-2 rounded-xl bg-slate-700/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                            title="حذف من السجل"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>

        {/* الشريط السفلي */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>باتشر تراخيص RaiZon Pro</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsAuthenticated(false)}
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              تسجيل خروج
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>

      {/* نافذة التأكيد والمعاينة */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-scale-in" dir="rtl">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 max-w-xs w-full shadow-2xl text-slate-100 space-y-4">
            <div className="text-center">
              <h3 className="text-base font-black text-white">تأكيد توليد المفتاح</h3>
              <p className="text-xs text-slate-400 mt-0.5">يرجى مراجعة البيانات قبل الإصدار</p>
            </div>

            <div className="space-y-2 bg-slate-850 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">العميل:</span>
                <span className="font-bold text-white">{clientName}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">المدة:</span>
                <span className="font-bold text-amber-400">
                  {DURATIONS.find(d => d.value === selectedDuration)?.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerate}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black text-xs transition-all shadow-md active:scale-95"
              >
                تأكيد التوليد
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
