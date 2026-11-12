/* نافذة إعداد وربط الحساب السحابي والفروع (Supabase Cloud Setup) */
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
import { Building, Plus, Eye, EyeOff, X, RefreshCw } from './Icons';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (account: CloudAccountInfo) => void;
}

export const SupabaseOnboardingModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { state, addLocation, updateSettings, addToast, language } = useApp();
  
  const [username, setUsername] = useState('procashier_main');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceName, setDeviceName] = useState('كاشير 1');
  const [selectedBranchId, setSelectedBranchId] = useState('1');
  
  // فروع جديدة
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // إعدادات السيرفر الافتراضية تعمل تلقائياً دون إظهارها للمستخدم
  const [supabaseUrl] = useState(DEFAULT_SUPABASE_URL);
  const [supabaseKey] = useState(DEFAULT_SUPABASE_ANON_KEY);

  // حالة الاتصال
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<any[]>([]);

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
        setIsConnected(testRes.ok);
        if (testRes.ok) {
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
        }
      } catch {
        if (isMounted) setIsConnected(false);
      } finally {
        if (isMounted) setIsTesting(false);
      }
    };

    fetchRemote();
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  // دمج الفروع
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

  const handleAddBranch = async () => {
    const trimmed = newBranchName.trim();
    if (!trimmed) {
      addToast(language === 'ar' ? 'يرجى كتابة اسم الفرع' : 'Please enter branch name', 'error');
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
    addToast(language === 'ar' ? `تمت إضافة فرع «${trimmed}» بنجاح` : `Branch ${trimmed} added`, 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      addToast(language === 'ar' ? 'يرجى إدخال اسم الحساب' : 'Please enter account username', 'error');
      return;
    }
    if (!password.trim()) {
      addToast(language === 'ar' ? 'يرجى إدخال كلمة مرور المدير' : 'Please enter manager password', 'error');
      return;
    }
    if (!selectedBranchId) {
      addToast(language === 'ar' ? 'يرجى تحديد الفرع' : 'Please select branch', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const chosenBranch = allBranches.find(b => String(b.id) === String(selectedBranchId)) || {
        id: selectedBranchId,
        name: 'الفرع الرئيسي'
      };

      await pushBranchToSupabase(chosenBranch, supabaseUrl, supabaseKey);
      const deviceId = `pos_dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const cloudAccount: CloudAccountInfo = {
        username: cleanUsername,
        password: password.trim(),
        branchId: String(chosenBranch.id),
        branchName: chosenBranch.name,
        deviceId,
        deviceName: deviceName.trim() || 'كاشير 1',
        connectedAt: Date.now(),
        lastSyncAt: Date.now(),
        supabaseUrl,
        supabaseKey
      };

      saveCloudAccount(cloudAccount);
      updateSettings({
        currentLocationId: String(chosenBranch.id),
        supabaseUrl,
        supabaseKey
      });

      addToast(language === 'ar' ? `تم ربط الجهاز بفرع «${chosenBranch.name}» بنجاح` : `Branch linked successfully`, 'success');
      onSuccess(cloudAccount);
    } catch (err: any) {
      addToast(err.message || 'حدث خطأ أثناء الربط', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-right text-slate-200">
        
        {/* رأس النافذة المنظم بدون أي تداخل */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white tracking-tight">
              ربط الفرع والحساب
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              تحديد حساب المنشأة وفرع هذا الجهاز لمزامنة البيانات.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : isConnected === false ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
              <span className={isConnected ? 'text-emerald-400' : 'text-slate-400'}>
                {isConnected ? 'متصل' : isConnected === false ? 'غير متصل' : 'جاري الفحص...'}
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* نموذج الإدخال الهادئ */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* اسم الحساب */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              اسم الحساب (المنشأة)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: main_store"
              className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-primary-500 transition-all text-left dir-ltr"
            />
          </div>

          {/* كلمة مرور المدير */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              كلمة مرور المدير
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          {/* تحديد الفرع */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                الفرع الحالي
              </label>
              {!isCreatingBranch && (
                <button
                  type="button"
                  onClick={() => setIsCreatingBranch(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 font-semibold cursor-pointer"
                >
                  + فرع جديد
                </button>
              )}
            </div>

            {!isCreatingBranch ? (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-primary-500 cursor-pointer"
              >
                {allBranches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    فرع: {branch.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>إضافة فرع جديد</span>
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
                  placeholder="اسم الفرع (مثال: فرع المعادي)"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={handleAddBranch}
                  className="w-full py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs transition-colors"
                >
                  حفظ الفرع
                </button>
              </div>
            )}
          </div>

          {/* اسم الجهاز */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              اسم هذا الجهاز
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="مثال: كاشير 1"
              className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* الأزرار العملية */}
          <div className="pt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ وربط الجهاز'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
              >
                إلغاء
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};
