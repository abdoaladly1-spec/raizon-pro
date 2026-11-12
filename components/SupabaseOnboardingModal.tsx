/* نافذة إعداد وربط الحساب السحابي والفروع لأول مرة (Supabase Cloud Onboarding) */
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  DEFAULT_SUPABASE_URL, 
  DEFAULT_SUPABASE_ANON_KEY, 
  getCloudAccount, 
  saveCloudAccount, 
  testSupabaseConnection, 
  pullFromSupabase, 
  pushBranchToSupabase,
  CloudAccountInfo 
} from '../lib/supabaseSync';
import { Building, Shield, Check, Cloud, ChevronDown, Plus, Sparkles, RefreshCw, Eye, EyeOff } from './Icons';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (account: CloudAccountInfo) => void;
}

export const SupabaseOnboardingModal: React.FC<Props> = ({ isOpen, onSuccess }) => {
  const { state, addLocation, updateSettings, addToast, language } = useApp();
  
  const [username, setUsername] = useState('procashier_main');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceName, setDeviceName] = useState('جهاز الكاشير الرئيسي #1');
  const [selectedBranchId, setSelectedBranchId] = useState('1');
  
  // فروع جديدة
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // إعدادات السيرفر السحابي
  const [supabaseUrl, setSupabaseUrl] = useState(DEFAULT_SUPABASE_URL);
  const [supabaseKey, setSupabaseKey] = useState(DEFAULT_SUPABASE_ANON_KEY);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // حالة الاتصال
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<any[]>([]);

  // عند الفتح: فحص الاتصال وسحب الفروع المسجلة على السحابة
  useEffect(() => {
    if (!isOpen) return;

    const existing = getCloudAccount();
    if (existing) {
      setUsername(existing.username || 'procashier_main');
      if (existing.deviceName) setDeviceName(existing.deviceName);
      if (existing.branchId) setSelectedBranchId(existing.branchId);
    }

    let isMounted = true;
    const fetchRemote = async () => {
      setIsTesting(true);
      try {
        const testRes = await testSupabaseConnection(supabaseUrl, supabaseKey);
        if (!isMounted) return;
        if (testRes.ok) {
          setConnectionStatus('success');
          setStatusMessage('السحابة متصلة وجاهزة للربط الفوري');
          const pulled = await pullFromSupabase(supabaseUrl, supabaseKey);
          if (isMounted && pulled.ok && pulled.branches && pulled.branches.length > 0) {
            setRemoteBranches(pulled.branches);
            pulled.branches.forEach((b: any) => {
              if (!state.locations.some(l => String(l.id) === String(b.id))) {
                addLocation({
                  id: String(b.id),
                  name: b.name,
                  address: b.address || '',
                  phone: b.phone || '',
                  active: b.active !== false
                });
              }
            });
            if (!existing?.branchId && pulled.branches[0]?.id) {
              setSelectedBranchId(String(pulled.branches[0].id));
            }
          }
        } else {
          setConnectionStatus('error');
          setStatusMessage(testRes.message);
        }
      } catch (e: any) {
        if (isMounted) {
          setConnectionStatus('error');
          setStatusMessage(e.message || 'تعذر الاتصال بالسحابة');
        }
      } finally {
        if (isMounted) setIsTesting(false);
      }
    };

    fetchRemote();
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // دمج الفروع المحلية مع السحابية
  const allBranches = [...state.locations];
  remoteBranches.forEach(rb => {
    if (!allBranches.some(b => String(b.id) === String(rb.id))) {
      allBranches.push({
        id: String(rb.id),
        name: rb.name,
        address: rb.address || '',
        phone: rb.phone || '',
        active: rb.active !== false
      });
    }
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
      if (res.ok) {
        setConnectionStatus('success');
        setStatusMessage('تم الاتصال بالسحابة بنجاح!');
        addToast('متصل بسيرفر Supabase السحابي', 'success');
        // جلب الفروع
        const pulled = await pullFromSupabase(supabaseUrl, supabaseKey);
        if (pulled.ok && pulled.branches) {
          setRemoteBranches(pulled.branches);
        }
      } else {
        setConnectionStatus('error');
        setStatusMessage(res.message);
        addToast(res.message, 'error');
      }
    } catch (e: any) {
      setConnectionStatus('error');
      setStatusMessage(e.message || 'فشل الاتصال');
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddBranch = async () => {
    const trimmed = newBranchName.trim();
    if (!trimmed) {
      addToast('يرجى كتابة اسم الفرع أولاً', 'error');
      return;
    }
    const newId = String(Date.now());
    const newBranch = {
      id: newId,
      name: trimmed,
      address: newBranchAddress.trim(),
      phone: '',
      active: true
    };
    addLocation(newBranch);
    await pushBranchToSupabase(newBranch, supabaseUrl, supabaseKey);
    setRemoteBranches(prev => [...prev, newBranch]);
    setSelectedBranchId(newId);
    setIsCreatingBranch(false);
    setNewBranchName('');
    setNewBranchAddress('');
    addToast(`تم إنشاء فرع «${trimmed}» وربطه بالسحابة بنجاح`, 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      addToast('يرجى إدخال اسم الحساب السحابي', 'error');
      return;
    }
    if (!password.trim()) {
      addToast('يرجى تحديد كلمة مرور للمدير لحماية هذا الحساب عند الخروج', 'error');
      return;
    }
    if (!selectedBranchId) {
      addToast('يرجى اختيار الفرع المربوط به هذا الجهاز', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const chosenBranch = allBranches.find(b => String(b.id) === String(selectedBranchId)) || {
        id: selectedBranchId,
        name: 'الفرع الرئيسي'
      };

      // التأكد من رفع الفرع لسوبابيس
      await pushBranchToSupabase(chosenBranch, supabaseUrl, supabaseKey);

      // توليد معرف جهاز فريد أو الحفاظ على القديم
      const deviceId = `pos_dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const cloudAccount: CloudAccountInfo = {
        username: cleanUsername,
        password: password.trim(),
        branchId: String(chosenBranch.id),
        branchName: chosenBranch.name,
        deviceId,
        deviceName: deviceName.trim() || 'جهاز الكاشير #1',
        connectedAt: Date.now(),
        lastSyncAt: Date.now(),
        supabaseUrl,
        supabaseKey
      };

      // حفظ الحساب
      saveCloudAccount(cloudAccount);

      // تحديث الفرع النشط في الإعدادات
      updateSettings({
        currentLocationId: String(chosenBranch.id),
        supabaseUrl,
        supabaseKey
      });

      addToast(`تم تفعيل الحساب السحابي وربط الجهاز بفرع «${chosenBranch.name}» بنجاح!`, 'success');
      onSuccess(cloudAccount);
    } catch (err: any) {
      addToast(err.message || 'حدث خطأ أثناء الربط السحابي', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative text-right text-slate-100 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* شارة الترحيب والرمز */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-800">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Cloud size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ربط الفروع بالسحابة اللحظية
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Supabase Realtime
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              اربط هذا الجهاز بفرعك لمزامنة الفواتير، المستخدمين، والصلاحيات لحظياً بين كل الأجهزة والفروع دون تعارض.
            </p>
          </div>
        </div>

        {/* تنبيه حالة الاتصال بالسيرفر */}
        <div className={`p-3 rounded-2xl mb-5 flex items-center justify-between text-xs font-bold border transition-colors ${
          connectionStatus === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : connectionStatus === 'error'
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            : 'bg-slate-800/60 border-slate-700 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              connectionStatus === 'success' ? 'bg-emerald-400 animate-ping' : connectionStatus === 'error' ? 'bg-rose-500' : 'bg-amber-400'
            }`} />
            <span>{statusMessage || 'جاري فحص الاتصال بالسحابة...'}</span>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
            <span>فحص الاتصال</span>
          </button>
        </div>

        {/* نموذج الإعداد */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. اسم الحساب السحابي */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">
              اسم حساب المنشأة / السحابي <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثلاً: al_rayan_chain أو procashier_main"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-left dir-ltr"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              اسم الحساب يجمع كل فروع المنشأة في شبكة سحابية واحدة متزامنة لحظياً.
            </p>
          </div>

          {/* 2. كلمة مرور حساب المدير (مطلوبة عند الخروج) */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5 flex items-center justify-between">
              <span>كلمة مرور حساب المدير <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-amber-400 font-bold">تُطلب للتحقق عند محاولة تسجيل الخروج</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية للمدير..."
                className="w-full h-11 px-3.5 pe-10 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-left dir-ltr"
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

          {/* 3. فرع هذا الجهاز (مع إمكانية إضافة فرع جديد) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                <Building size={14} className="text-sky-400" />
                <span>تحديد فرع هذا الجهاز <span className="text-rose-400">*</span></span>
              </label>
              {!isCreatingBranch && (
                <button
                  type="button"
                  onClick={() => setIsCreatingBranch(true)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>+ فرع جديد</span>
                </button>
              )}
            </div>

            {!isCreatingBranch ? (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {allBranches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    فرع: {branch.name} {branch.address ? `(${branch.address})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-sky-500/40 space-y-3 animate-scale-in">
                <div className="flex items-center justify-between text-xs font-black text-sky-300">
                  <span>إضافة فرع جديد للسحابة</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingBranch(false)}
                    className="text-slate-400 hover:text-white text-[11px]"
                  >
                    إلغاء
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="اسم الفرع الجديد (مثلاً: فرع مدينة نصر)"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                />
                <input
                  type="text"
                  placeholder="عنوان الفرع أو موقعه (اختياري)"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition-all shadow-md active:scale-95"
                >
                  حفظ وربط هذا الفرع الجديد
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              يتم عزل العمليات والفواتير والتقفيل اليومي لكل فرع بالكامل عن الفروع الأخرى.
            </p>
          </div>

          {/* 4. اسم هذا الجهاز */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">
              اسم هذا الجهاز داخل الفرع
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="مثلاً: كاشير 1، نقطة الصالة، جهاز المدير"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* 5. إعدادات متقدمة (Supabase URL & Key) */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200 py-1"
            >
              <span>إعدادات السيرفر السحابي الخاصة (اختياري)</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            
            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 animate-scale-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Supabase Project URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 text-left dir-ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Supabase Anon Key</label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 text-left dir-ltr"
                  />
                </div>
              </div>
            )}
          </div>

          {/* زر التأكيد والحفظ */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98 disabled:opacity-60"
            >
              <Sparkles size={18} className="text-amber-300" />
              <span>{isSubmitting ? 'جاري الربط والمزامنة...' : 'ربط الفرع وتفعيل الحساب السحابي الآن 🚀'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
