/* واجهة تسجيل الدخول وإنشاء الحساب السحابي الموحد (Cloud Auth & Multi-Branch Setup) */
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  DEFAULT_SUPABASE_URL, 
  DEFAULT_SUPABASE_ANON_KEY, 
  getCloudAccount, 
  saveCloudAccount, 
  testSupabaseConnection, 
  pullFromSupabase, 
  pullUsersFromSupabase,
  pushBranchToSupabase,
  pushUserToSupabase,
  CloudAccountInfo 
} from '../lib/supabaseSync';
import { verifySecret } from '../lib/crypto';
import { normalizePhone, isValidPhone } from '../lib/phoneUtils';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { AnimatedBackground } from './AnimatedBackground';
import { 
  Building, Plus, Eye, EyeOff, X, Check, Lock, User, 
  Phone, Cloud, Shield, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Banknote, ChevronDown
} from './Icons';
import { RAIZON_LOGO_URI } from '../lib/logoData';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (account: CloudAccountInfo) => void;
  isStandalone?: boolean;
}

export const SupabaseOnboardingModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, isStandalone = false }) => {
  const { state, addLocation, updateSettings, addToast, language, login, registerUser, addDrawerMovement } = useApp();
  
  // التبديل بين تسجيل الدخول وإنشاء الحساب
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('register');

  // بيانات إنشاء الحساب (Register)
  const [registerStep, setRegisterStep] = useState<'account_info' | 'setup_shop_drawer'>('account_info');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState(state.settings.shopName || 'صالون ابراهيم لوار');
  const [registerDeviceName, setRegisterDeviceName] = useState('كاشير 1');
  const [drawerOpeningCash, setDrawerOpeningCash] = useState<string>('0');
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // بيانات تسجيل الدخول (Sign In)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginDeviceName, setLoginDeviceName] = useState('كاشير 1');
  const [selectedBranchId, setSelectedBranchId] = useState('1');
  const [signInStep, setSignInStep] = useState<'credentials' | 'branch_selection'>('credentials');

  // تحكم إظهار كلمات المرور
  const [showPass, setShowPass] = useState(false);

  // إضافة فرع جديد أثناء تسجيل الدخول
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // سيرفر Supabase الافتراضي
  const [supabaseUrl] = useState(DEFAULT_SUPABASE_URL);
  const [supabaseKey] = useState(DEFAULT_SUPABASE_ANON_KEY);

  // حالة الاتصال بالسحابة
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const existing = getCloudAccount();
    if (existing) {
      setLoginIdentifier(existing.username || '');
      if (existing.deviceName) {
        setLoginDeviceName(existing.deviceName);
        setRegisterDeviceName(existing.deviceName);
      }
      if (existing.branchId) setSelectedBranchId(existing.branchId);
      // إذا كان مسجلاً من قبل، نجعل الوضع الافتراضي تسجيل دخول
      setAuthMode('signin');
    } else {
      setAuthMode('register');
    }

    let isMounted = true;
    const checkConnection = async () => {
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

    checkConnection();
    return () => { isMounted = false; };
  }, [isOpen]);

  // إغلاق قائمة الفروع المنسدلة عند النقر بالخارج
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

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

  // فحص هل المدخل في emailOrPhone هو بريد أم هاتف
  const isEmailInput = emailOrPhone.includes('@');
  const normalizedPhoneInput = !isEmailInput ? normalizePhone(emailOrPhone) : '';
  const isPhoneValid = !isEmailInput && emailOrPhone.trim().length > 0 && isValidPhone(normalizedPhoneInput);
  const passwordsMatch = registerPassword.length > 0 && registerPassword === confirmPassword;

  // 1. التحقق من بيانات الحساب والانتقال للخطوة 2 (Register Step 1)
  const handleValidateAccountInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanContact = emailOrPhone.trim();

    if (!cleanFirst || !cleanLast) {
      addToast(language === 'ar' ? 'يرجى إدخال الاسم الأول واسم العائلة' : 'Please enter your first and last name', 'error');
      return;
    }
    if (!cleanContact) {
      addToast(language === 'ar' ? 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف' : 'Please enter email or phone', 'error');
      return;
    }
    if (!isEmailInput && !isValidPhone(normalizedPhoneInput)) {
      addToast(language === 'ar' ? 'رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ 01' : 'Phone must be valid 11 digits starting with 01', 'error');
      return;
    }
    if (registerPassword.length < 6) {
      addToast(language === 'ar' ? 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام' : 'Password must be at least 6 characters', 'error');
      return;
    }
    if (registerPassword !== confirmPassword) {
      addToast(language === 'ar' ? 'كلمتا المرور غير متطابقتين، يرجى التأكد' : 'Passwords do not match', 'error');
      return;
    }
    if (!agreedToPrivacy) {
      addToast(language === 'ar' ? 'يرجى الموافقة على سياسة الخصوصية والشروط أولاً للمتابعة' : 'Please agree to privacy policy to continue', 'warning');
      return;
    }

    // الانتقال للنافذة التالية لإعداد المنشأة والدرج
    setRegisterStep('setup_shop_drawer');
  };

  // 2. إتمام إنشاء الحساب وإعداد المنشأة ومبلغ الدرج (Register Step 2)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanContact = emailOrPhone.trim();
    const branchName = shopName.trim() || 'صالون ابراهيم لوار';

    if (!shopName.trim()) {
      addToast(language === 'ar' ? 'يرجى إدخال اسم المنشأة أو المحل' : 'Please enter shop name', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. تسجيل المستخدم في النظام المحلي كمدير
      const regRes = await registerUser({
        firstName: cleanFirst,
        lastName: cleanLast,
        emailOrPhone: isEmailInput ? cleanContact : normalizedPhoneInput,
        password: registerPassword,
        role: 'admin'
      });

      if (!regRes.ok) {
        addToast(regRes.error || (language === 'ar' ? 'تعذر إنشاء الحساب' : 'Registration failed'), 'error');
        setIsSubmitting(false);
        return;
      }

      // 2. إنشاء فرع رئيسي باسم المنشأة
      const branchId = '1';
      const defaultBranch = {
        id: branchId,
        name: branchName,
        address: branchName,
        phone: !isEmailInput ? normalizedPhoneInput : '',
        active: true
      };

      // رفع الفرع للسحابة
      try {
        await pushBranchToSupabase(defaultBranch, supabaseUrl, supabaseKey);
      } catch {}

      // 3. رفع حساب المستخدم لسحابة Supabase
      if (regRes.user) {
        try {
          await pushUserToSupabase({
            ...regRes.user,
            locationId: branchId
          }, supabaseUrl, supabaseKey);
        } catch {}
      }

      // 4. حفظ بيانات الربط السحابي
      const deviceId = `pos_dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cloudAccount: CloudAccountInfo = {
        username: regRes.user?.username || cleanFirst.toLowerCase(),
        password: registerPassword,
        branchId,
        branchName,
        deviceId,
        deviceName: registerDeviceName.trim() || 'كاشير 1',
        connectedAt: Date.now(),
        lastSyncAt: Date.now(),
        supabaseUrl,
        supabaseKey
      };

      saveCloudAccount(cloudAccount);
      localStorage.setItem('savedUsername', cloudAccount.username);

      // 5. حفظ الإعدادات وتحديد المبلغ الموجود بالدرج
      const openingAmount = Math.max(0, parseFloat(drawerOpeningCash) || 0);

      // تسجيل حركة الرصيد الافتتاحي في الخزينة إذا كان المبلغ أكبر من 0
      if (openingAmount > 0) {
        try {
          addDrawerMovement({
            type: 'deposit',
            amount: openingAmount,
            reason: language === 'ar' ? 'رصيد افتتاحي في الدرج عند إعداد المنشأة' : 'Initial drawer opening cash',
            category: 'opening_balance'
          });
        } catch {}
      }

      updateSettings({
        shopName: branchName,
        currentLocationId: branchId,
        cashDrawerOpening: openingAmount,
        manualOpeningDate: new Date().toISOString().split('T')[0],
        branchDrawerOpenings: {
          ...(state.settings.branchDrawerOpenings || {}),
          [branchId]: {
            cashDrawerOpening: openingAmount,
            manualOpeningDate: new Date().toISOString().split('T')[0]
          }
        },
        supabaseUrl,
        supabaseKey
      });

      addToast(language === 'ar' ? `مرحباً بك يا ${cleanFirst}! تم إنشاء حساب «${branchName}» وتحديد درج النقدية بنجاح` : `Welcome ${cleanFirst}! Setup completed successfully`, 'success');
      onSuccess(cloudAccount);
    } catch (err: any) {
      addToast(err.message || 'حدث خطأ أثناء إعداد الحساب', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. التحقق من بيانات الدخول وفحص الفروع سحابياً ومحلياً (Step 1)
  const handleVerifyCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginIdentifier.trim();
    if (!cleanId) {
      addToast(language === 'ar' ? 'يرجى إدخال اسم المستخدم أو البريد أو الهاتف' : 'Please enter username, email or phone', 'error');
      return;
    }
    if (!loginPassword) {
      addToast(language === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter password', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let authSuccess = false;

      // أ) كلمة مرور المدير المعتمدة 22122005 أو admin
      if (loginPassword.trim() === '22122005' || loginPassword.trim() === 'admin') {
        authSuccess = true;
      }

      // ب) فحص المستخدمين في النظام المحلي
      if (!authSuccess) {
        const targetClean = cleanId.toLowerCase().replace(/\s+/g, '');
        const localMatch = state.users.find(u => {
          const uName = u.username.toLowerCase();
          const uEmail = (u.email || '').toLowerCase();
          const uPhone = (u.phone || '').replace(/\s+/g, '');
          return (uName === targetClean || uEmail === targetClean || uPhone === targetClean) && u.active;
        });

        if (localMatch) {
          if (localMatch.passwordHash && localMatch.passwordSalt) {
            authSuccess = await verifySecret(loginPassword.trim(), localMatch.passwordHash, localMatch.passwordSalt);
          } else if (localMatch.password) {
            authSuccess = localMatch.password === loginPassword.trim();
          }
        }
      }

      // ج) فحص المستخدمين في سحابة Supabase إذا لم يُعثر عليه محلياً
      if (!authSuccess) {
        try {
          const remoteUsersRes = await pullUsersFromSupabase(supabaseUrl, supabaseKey);
          if (remoteUsersRes.ok && remoteUsersRes.users.length > 0) {
            const targetClean = cleanId.toLowerCase().replace(/\s+/g, '');
            const remoteMatch = remoteUsersRes.users.find((u: any) => {
              const uName = (u.username || '').toLowerCase();
              const uEmail = (u.email || '').toLowerCase();
              const uPhone = (u.phone || '').replace(/\s+/g, '');
              return (uName === targetClean || uEmail === targetClean || uPhone === targetClean) && u.active !== false;
            });

            if (remoteMatch) {
              if (remoteMatch.passwordHash && remoteMatch.passwordSalt) {
                authSuccess = await verifySecret(loginPassword.trim(), remoteMatch.passwordHash, remoteMatch.passwordSalt);
              } else if (remoteMatch.password) {
                authSuccess = remoteMatch.password === loginPassword.trim();
              }
              if (authSuccess) {
                // حفظ المستخدم محلياً ليعمل بدون إنترنت
                if (!state.users.some(u => u.id === remoteMatch.id || u.username === remoteMatch.username)) {
                  registerUser({
                    firstName: remoteMatch.name || remoteMatch.username,
                    lastName: '',
                    emailOrPhone: remoteMatch.email || remoteMatch.phone || remoteMatch.username,
                    password: loginPassword,
                    role: remoteMatch.role || 'admin'
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Supabase Remote User Verification]', e);
        }
      }

      if (!authSuccess) {
        addToast(language === 'ar' ? 'بيانات الدخول غير صحيحة، يرجى التأكد من اسم المستخدم وكلمة المرور' : 'Invalid credentials', 'error');
        setIsSubmitting(false);
        return;
      }

      // 3. فحص الفروع الموجودة محلياً والموجودة على السحابة ومزامنتها
      try {
        const pulled = await pullFromSupabase(supabaseUrl, supabaseKey);
        if (pulled.ok && pulled.branches && pulled.branches.length > 0) {
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
        }
      } catch (err) {
        console.warn('[Supabase Pull Branches]', err);
      }

      // تحديد الفرع الافتراضي المختار
      const existingAcc = getCloudAccount();
      if (existingAcc?.branchId) {
        setSelectedBranchId(existingAcc.branchId);
      } else if (state.locations.length > 0) {
        setSelectedBranchId(String(state.locations[0].id));
      }

      addToast(
        language === 'ar' 
          ? `تم التحقق بنجاح! تم فحص ومزامنة الفروع.` 
          : `Verified! Branches scanned and synced.`, 
        'success'
      );

      // الانتقال للنافذة التالية (المرحلة 2: ربط الفرع والجهاز)
      setSignInStep('branch_selection');
    } catch (err: any) {
      addToast(err.message || 'حدث خطأ أثناء فحص البيانات', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. حفظ وربط الجهاز بالفرع المختار (Step 2)
  const handleConfirmBranchLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      addToast(language === 'ar' ? 'يرجى تحديد الفرع أولاً' : 'Please select branch', 'error');
      return;
    }

    const cleanId = loginIdentifier.trim();
    const chosenBranch = allBranches.find(b => String(b.id) === String(selectedBranchId)) || {
      id: selectedBranchId,
      name: 'الفرع الرئيسي'
    };

    setIsSubmitting(true);
    try {
      try {
        await pushBranchToSupabase(chosenBranch, supabaseUrl, supabaseKey);
      } catch {}

      const deviceId = `pos_dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cloudAccount: CloudAccountInfo = {
        username: cleanId,
        password: loginPassword,
        branchId: String(chosenBranch.id),
        branchName: chosenBranch.name,
        deviceId,
        deviceName: loginDeviceName.trim() || 'كاشير 1',
        connectedAt: Date.now(),
        lastSyncAt: Date.now(),
        supabaseUrl,
        supabaseKey
      };

      saveCloudAccount(cloudAccount);
      localStorage.setItem('savedUsername', cleanId);
      updateSettings({
        currentLocationId: String(chosenBranch.id),
        shopName: chosenBranch.name,
        supabaseUrl,
        supabaseKey
      });

      // تسجيل الدخول محلياً لإتاحة الجلسة
      await login(cleanId, loginPassword);

      addToast(
        language === 'ar' 
          ? `تم تسجيل الدخول وربط فرع «${chosenBranch.name}» وتعيين «${loginDeviceName.trim() || 'كاشير 1'}» بنجاح` 
          : `Branch linked successfully`, 
        'success'
      );
      onSuccess(cloudAccount);
    } catch (err: any) {
      addToast(err.message || 'حدث خطأ أثناء ربط الجهاز بالفرع', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // إضافة فرع جديد سريع
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
    try {
      await pushBranchToSupabase(newBranch, supabaseUrl, supabaseKey);
    } catch {}
    setRemoteBranches(prev => [...prev, newBranch]);
    setSelectedBranchId(newId);
    setIsCreatingBranch(false);
    setNewBranchName('');
    setNewBranchAddress('');
    addToast(language === 'ar' ? `تمت إضافة فرع «${trimmed}» بنجاح` : `Branch added`, 'success');
  };

  return (
    <>
      <div className={isStandalone ? "min-h-screen w-full flex flex-col items-center justify-center select-none relative overflow-hidden p-3 sm:p-6 bg-slate-950 font-sans" : "fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in font-sans"} dir="rtl">
        {isStandalone && <AnimatedBackground isDark={true} />}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl relative text-right text-slate-800 dark:text-slate-100 max-h-[92vh] overflow-y-auto custom-scrollbar ${isStandalone ? 'z-10 animate-scale-in' : ''}`}>
          
          {/* شريط الإغلاق وحالة الاتصال بالسحابة */}
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" className="w-8 h-8 object-contain" />
              <div>
                <span className="font-extrabold text-sm block leading-tight text-slate-900 dark:text-white">
                  فلير وان <span className="text-primary-600 dark:text-primary-400 font-bold">Flare One Cloud</span>
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {isStandalone ? 'ربط الحساب السحابي والفرع (الإعداد الأولي للجهاز)' : 'منظومة نقاط البيع والربط السحابي للفروع'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : isConnected === false ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
                <span className={isConnected ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'}>
                  {isConnected ? 'السحابة متصلة' : isConnected === false ? 'غير متصل' : 'جاري الفحص...'}
                </span>
              </div>

              {!isStandalone && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* تبويبات التبديل: تسجيل دخول / إنشاء حساب */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-5 border border-slate-200/80 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setSignInStep('credentials'); setRegisterStep('account_info'); }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User size={14} />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setSignInStep('credentials'); setRegisterStep('account_info'); }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: إنشاء حساب جديد - المرحلة 1: بيانات المدير والحساب */}
          {/* ========================================================= */}
          {authMode === 'register' && registerStep === 'account_info' && (
            <form onSubmit={handleValidateAccountInfo} className="space-y-3.5 animate-fade-in">
              <div className="mb-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">إنشاء حساب مدير المنشأة</h3>
                <p className="text-xs text-slate-400 mt-0.5">أدخل بياناتك لربط هذا الجهاز وإدارة الفروع سحابياً بلحظية تامة.</p>
              </div>

              {/* الاسم الأول واسم العائلة */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الأول <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثال: أحمد"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم العائلة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثال: العادلي"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              {/* بريد إلكتروني أو رقم هاتف في نفس التكست بوكس */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    البريد الإلكتروني أو رقم الهاتف <span className="text-rose-500">*</span>
                  </label>
                  {emailOrPhone.trim().length > 0 && (
                    <span className="text-[10px] font-mono font-bold text-primary-600 dark:text-primary-400">
                      {isEmailInput ? 'بريد إلكتروني' : isPhoneValid ? 'رقم هاتف صحيح' : 'أدخل 11 رقماً يبدأ بـ 01'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val.includes('@')) {
                        setEmailOrPhone(normalizePhone(val));
                      } else {
                        setEmailOrPhone(val);
                      }
                    }}
                    placeholder="name@example.com أو 010xxxxxxxx"
                    className="w-full h-10 px-3.5 pl-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono dir-ltr text-right"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    {isEmailInput ? '@' : <Phone size={14} />}
                  </div>
                </div>
              </div>

              {/* كلمة المرور وتأكيدها مرتين للتأكد من المطابقة */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      كلمة المرور <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="6 أحرف أو أرقام على الأقل"
                      className="w-full h-10 px-3.5 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                      title={showPass ? 'إخفاء' : 'إظهار'}
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تأكيد كلمة المرور <span className="text-rose-500">*</span>
                    </label>
                    {confirmPassword && (
                      <span className={`text-[10px] font-bold ${passwordsMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {passwordsMatch ? 'متطابقتان' : 'غير متطابقة'}
                      </span>
                    )}
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className={`w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs font-bold text-slate-900 dark:text-white focus:outline-none transition-all ${
                      confirmPassword && passwordsMatch
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                        : confirmPassword && !passwordsMatch
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-primary-500'
                    }`}
                  />
                </div>
              </div>

              {/* زر الموافقة وسياسة الخصوصية التفاعلية بتصميم موحد وأنيق */}
              <div className="py-1">
                <label 
                  htmlFor="privacy-agree-checkbox" 
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer border select-none ${
                    agreedToPrivacy 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold leading-tight">
                    <Shield size={15} className={agreedToPrivacy ? 'text-emerald-400' : 'text-slate-400'} />
                    <span>أوافق على كافة الشروط و</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPrivacyModal(true);
                      }}
                      className="text-primary-400 hover:text-primary-300 underline font-black cursor-pointer inline-flex items-center gap-0.5"
                    >
                      سياسة الخصوصية
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    id="privacy-agree-checkbox"
                    checked={agreedToPrivacy}
                    onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 border-slate-600 bg-slate-800 cursor-pointer shrink-0 accent-emerald-500"
                  />
                </label>
              </div>

              {/* زر المتابعة إلى الخطوة التالية (إعداد المنشأة والدرج) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!agreedToPrivacy || !passwordsMatch || registerPassword.length < 6 || !firstName.trim() || !lastName.trim() || !emailOrPhone.trim()}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-600 hover:from-primary-500 hover:to-emerald-500 text-white font-black text-sm shadow-lg shadow-primary-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>متابعة إعداد المنشأة والدرج</span>
                  <ArrowRight size={17} className="rotate-180" />
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setSignInStep('credentials'); setRegisterStep('account_info'); }}
                  className="text-xs font-bold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                >
                  لديك حساب منشأة بالفعل؟ اضغط هنا لتسجيل الدخول ←
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 1: إنشاء حساب جديد - المرحلة 2: نافذة إعداد المنشأة والدرج */}
          {/* ========================================================= */}
          {authMode === 'register' && registerStep === 'setup_shop_drawer' && (
            <form onSubmit={handleRegister} className="space-y-4 animate-scale-in">
              {/* شريط حالة اعتماد بيانات المدير */}
              <div className="p-3 rounded-2xl bg-primary-500/10 border border-primary-500/25 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-500/20 text-primary-500 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-primary-400">بيانات المدير معتمدة</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-500/20 text-primary-300">
                      الخطوة 2 من 2
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    المدير: <strong className="text-slate-200">{firstName} {lastName}</strong> ({emailOrPhone})
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">إعداد المنشأة والخزينة النقدية</h3>
                <p className="text-xs text-slate-400 mt-0.5">حدد اسم المحل، اسم هذا الجهاز، والمبلغ النقدي الموجود بالدرج لبدء العمل.</p>
              </div>

              {/* اسم المنشأة أو المحل واسم هذا الجهاز */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المنشأة أو المحل <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="مثال: صالون ابراهيم لوار"
                      className="w-full h-10 px-3.5 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                    />
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم هذا الجهاز
                  </label>
                  <input
                    type="text"
                    value={registerDeviceName}
                    onChange={(e) => setRegisterDeviceName(e.target.value)}
                    placeholder="كاشير 1"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              {/* تحديد المبلغ الموجود بالدرج (الرصيد الافتتاحي للنقدية) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المبلغ الموجود بالدرج (رصيد افتتاحي للنقدية) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={drawerOpeningCash}
                    onChange={(e) => setDrawerOpeningCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-11 px-3.5 pl-16 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all font-mono dir-ltr text-right"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 font-bold text-xs pointer-events-none">
                    <Banknote size={15} />
                    <span>ج.م</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  المبلغ النقدي الفعلي الموجود بالدرج قبل بداية عمليات البيع لبدء الوردية بدقة.
                </p>
              </div>

              {/* أزرار الحفظ والبدء والرجوع */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !shopName.trim()}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-600 hover:from-primary-500 hover:to-emerald-500 text-white font-black text-sm shadow-lg shadow-primary-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري إعداد المنشأة والدرج...</span>
                    </>
                  ) : (
                    <>
                      <span>ابدأ الآن وحفظ البيانات</span>
                      <ArrowRight size={17} className="rotate-180" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setRegisterStep('account_info')}
                  className="w-full h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>← العودة لتعديل بيانات الحساب</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: تسجيل الدخول (Sign In) - المرحلة 1: بيانات الدخول */}
          {/* ========================================================= */}
          {authMode === 'signin' && signInStep === 'credentials' && (
            <form onSubmit={handleVerifyCredentials} className="space-y-4 animate-fade-in">
              <div className="mb-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">تسجيل دخول المنشأة</h3>
                <p className="text-xs text-slate-400 mt-0.5">سجل دخولك ليتم فحص الفروع محلياً وسحابياً وربط هذا الجهاز.</p>
              </div>

              {/* اسم المستخدم أو البريد أو الهاتف */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستخدم أو البريد أو الهاتف <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="مثال: admin أو 010xxxxxxxx"
                    className="w-full h-10 px-3.5 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                  />
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="w-full h-10 px-3.5 pl-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    title={showPass ? 'إخفاء' : 'إظهار'}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* زر تسجيل الدخول وفحص الفروع */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !loginIdentifier.trim() || !loginPassword}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-emerald-600 hover:from-primary-500 hover:to-emerald-500 text-white font-black text-sm shadow-lg shadow-primary-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري فحص الحساب ومزامنة الفروع...</span>
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول وفحص الفروع</span>
                      <ArrowRight size={17} className="rotate-180" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setSignInStep('credentials'); setRegisterStep('account_info'); }}
                  className="text-xs font-bold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                >
                  ليس لديك حساب منشأة؟ اضغط هنا لإنشاء حساب جديد ←
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: نافذة ربط الفرع وتسمية الجهاز (المرحلة 2 المنفصلة) */}
          {/* ========================================================= */}
          {authMode === 'signin' && signInStep === 'branch_selection' && (
            <form onSubmit={handleConfirmBranchLink} className="space-y-4 animate-scale-in">
              {/* شريط حالة فحص الفروع بنجاح */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-400">تم فحص ومزامنة الفروع بنجاح</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      {allBranches.length} {allBranches.length === 1 ? 'فرع متوفر' : 'فروع متوفرة'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    الحساب المعتمد: <strong className="text-slate-200">{loginIdentifier}</strong>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">ربط هذا الجهاز بالفرع</h3>
                <p className="text-xs text-slate-400 mt-0.5">حدد الفرع الذي سيعمل عليه هذا الجهاز واسم نقطة البيع للمتابعة.</p>
              </div>

              {/* اختيار الفرع لهذا الجهاز */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    الفرع المراد ربطه بهذا الجهاز <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingBranch(!isCreatingBranch)}
                    className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={12} /> {isCreatingBranch ? 'إلغاء' : 'فرع جديد +'}
                  </button>
                </div>

                {isCreatingBranch ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 mb-2 animate-scale-in">
                    <input
                      type="text"
                      placeholder="اسم الفرع الجديد (مثال: فرع المعادي)"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="عنوان الفرع (اختياري)"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBranch}
                      className="w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      إضافة وتفعيل الفرع
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={branchDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-primary-500/50 dark:hover:border-primary-500/50 text-xs font-bold text-slate-900 dark:text-white focus:outline-none transition-all flex items-center justify-between cursor-pointer group shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0">
                          <Building size={14} />
                        </div>
                        <div className="text-right truncate">
                          <span className="block text-xs font-black text-slate-900 dark:text-white truncate">
                            {allBranches.find(b => String(b.id) === String(selectedBranchId))?.name 
                              ? `فرع: ${allBranches.find(b => String(b.id) === String(selectedBranchId))?.name}`
                              : 'اختر الفرع...'}
                          </span>
                          {allBranches.find(b => String(b.id) === String(selectedBranchId))?.address && (
                            <span className="block text-[10px] text-slate-400 font-medium truncate">
                              {allBranches.find(b => String(b.id) === String(selectedBranchId))?.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                          تغيير
                        </span>
                        <ChevronDown
                          size={15}
                          className={`text-slate-400 group-hover:text-primary-500 transition-transform duration-200 ${
                            isBranchDropdownOpen ? 'rotate-180 text-primary-500' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {/* القائمة المنسدلة المخصصة فائقة الجمال */}
                    {isBranchDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-2xl space-y-1 max-h-56 overflow-y-auto custom-scrollbar animate-scale-in">
                        <div className="px-2.5 py-1.5 text-[11px] font-black text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                          <span>الفروع المتاحة ({allBranches.length})</span>
                          <span className="text-[10px] font-normal text-emerald-500">سحابي ومحلي</span>
                        </div>

                        {allBranches.map((b) => {
                          const isSelected = String(b.id) === String(selectedBranchId);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setSelectedBranchId(String(b.id));
                                setIsBranchDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-right ${
                                isSelected
                                  ? 'bg-primary-500/10 border border-primary-500/30 text-primary-600 dark:text-primary-400 font-black'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'bg-primary-500/20 text-primary-500'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  <Building size={14} />
                                </div>
                                <div className="truncate">
                                  <div className="text-xs truncate">فرع: {b.name}</div>
                                  {b.address && (
                                    <div className="text-[10px] text-slate-400 font-normal truncate">{b.address}</div>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                                  <Check size={12} />
                                </div>
                              )}
                            </button>
                          );
                        })}

                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setIsBranchDropdownOpen(false);
                              setIsCreatingBranch(true);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>إضافة فرع جديد +</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* اسم هذا الجهاز */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم هذا الجهاز (مثال: كاشير 1)
                </label>
                <input
                  type="text"
                  value={loginDeviceName}
                  onChange={(e) => setLoginDeviceName(e.target.value)}
                  placeholder="كاشير 1"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                />
              </div>

              {/* أزرار الحفظ والرجوع */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedBranchId}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>جاري ربط الجهاز وحفظ الإعدادات...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <span>حفظ وربط الجهاز بالفرع</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSignInStep('credentials')}
                  className="w-full h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>← العودة لتعديل بيانات الدخول</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* نافذة سياسة الخصوصية المنبثقة التفاعلية */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setAgreedToPrivacy(true);
          setShowPrivacyModal(false);
          addToast(language === 'ar' ? 'تمت الموافقة على سياسة الخصوصية والشروط بنجاح' : 'Privacy policy accepted', 'success');
        }}
      />
    </>
  );
};
