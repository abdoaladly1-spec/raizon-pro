import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    app_tsx = f.read()

# 1. Import PatcherModal
if "import { PatcherModal } from './components/PatcherModal';" not in app_tsx:
    app_tsx = app_tsx.replace(
        "import { CommandPalette } from './components/CommandPalette';",
        "import { CommandPalette } from './components/CommandPalette';\nimport { PatcherModal } from './components/PatcherModal';"
    )
    print("Added PatcherModal import")

# 2. Update ActivationScreen to accept onOpenPatcher and render Patcher button
old_activation_sig = "const ActivationScreen = () => {"
new_activation_sig = "const ActivationScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {"

old_activation_btn = """                <button 
                    onClick={handleActivate}
                    disabled={!key}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('activate_system')}
                </button>"""

new_activation_btn = """                <button 
                    onClick={handleActivate}
                    disabled={!key}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('activate_system')}
                </button>

                {onOpenPatcher && (
                    <button
                        type="button"
                        onClick={onOpenPatcher}
                        className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <Shield size={16} />
                        <span>فتح أداة الترخيص المباشر (Patcher للمطور)</span>
                    </button>
                )}"""

if old_activation_sig in app_tsx:
    app_tsx = app_tsx.replace(old_activation_sig, new_activation_sig, 1)
    print("Updated ActivationScreen signature")

if old_activation_btn in app_tsx:
    app_tsx = app_tsx.replace(old_activation_btn, new_activation_btn, 1)
    print("Updated ActivationScreen buttons")

# 3. Update AppContent to maintain showPatcher state, keyboard shortcut, and render PatcherModal
old_app_content_start = """const AppContent = () => {
  const { currentUser, state } = useApp();
  const [introFinished, setIntroFinished] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isActivated, setIsActivated] = useState(null as boolean | null);"""

new_app_content_start = """const AppContent = () => {
  const { currentUser, state } = useApp();
  const [introFinished, setIntroFinished] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isActivated, setIsActivated] = useState(null as boolean | null);
  const [showPatcher, setShowPatcher] = useState(false);

  // اختصار لوحة المفاتيح للمطور Ctrl+Shift+P أو رابط الباتشر
  useEffect(() => {
    if (window.location.search.includes('mode=patcher')) {
      setShowPatcher(true);
    }
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setShowPatcher(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);"""

if old_app_content_start in app_tsx:
    app_tsx = app_tsx.replace(old_app_content_start, new_app_content_start, 1)
    print("Updated AppContent state & keyboard shortcut")

# Update return in AppContent for ActivationScreen and LoginScreen and render PatcherModal
old_app_content_return = """  if (isActivated === false) {
      return <ActivationScreen />;
  }

  if (isIdle && state.settings.enableScreenSaver) {
      return <ScreenSaver onActive={() => setIsIdle(false)} />;
  }

  if (!introFinished) {
    return <Intro onComplete={() => setIntroFinished(true)} />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  // إجبار تغيير كلمة المرور الافتراضية قبل استخدام النظام
  if (currentUser.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return (
    <ErrorBoundary>
      <MainContent />
    </ErrorBoundary>
  );"""

new_app_content_return = """  if (isActivated === false) {
      return (
        <>
          <ActivationScreen onOpenPatcher={() => setShowPatcher(true)} />
          <PatcherModal
            isOpen={showPatcher}
            onClose={() => setShowPatcher(false)}
            onActivationSuccess={() => {
              setIsActivated(true);
              setShowPatcher(false);
              window.location.reload();
            }}
          />
        </>
      );
  }

  if (isIdle && state.settings.enableScreenSaver) {
      return <ScreenSaver onActive={() => setIsIdle(false)} />;
  }

  if (!introFinished) {
    return <Intro onComplete={() => setIntroFinished(true)} />;
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen onOpenPatcher={() => setShowPatcher(true)} />
        <PatcherModal
          isOpen={showPatcher}
          onClose={() => setShowPatcher(false)}
          onActivationSuccess={() => {
            setIsActivated(true);
            setShowPatcher(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  // إجبار تغيير كلمة المرور الافتراضية قبل استخدام النظام
  if (currentUser.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return (
    <ErrorBoundary>
      <MainContent />
      <PatcherModal
        isOpen={showPatcher}
        onClose={() => setShowPatcher(false)}
        onActivationSuccess={() => {
          setShowPatcher(false);
          window.location.reload();
        }}
      />
    </ErrorBoundary>
  );"""

if old_app_content_return in app_tsx:
    app_tsx = app_tsx.replace(old_app_content_return, new_app_content_return, 1)
    print("Updated AppContent return with PatcherModal")

# 4. Update LoginScreen to display live remaining license duration and Developer Patcher button
old_login_sig = "const LoginScreen = () => {"
new_login_sig = "const LoginScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {"

if old_login_sig in app_tsx:
    app_tsx = app_tsx.replace(old_login_sig, new_login_sig, 1)
    print("Updated LoginScreen signature")

# Inside LoginScreen, add license live countdown state and timer
old_login_states = """    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);"""

new_login_states = """    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);

    // حالة الترخيص والمدة المتبقية المعروضة للمستخدم
    const [licenseInfo, setLicenseInfo] = useState<{
        valid?: boolean;
        isPerpetual?: boolean;
        expiresAt?: string | null;
        remainingMs?: number | null;
    } | null>(null);
    const [liveRemainingText, setLiveRemainingText] = useState('');

    useEffect(() => {
        const updateLicenseStatus = async () => {
            const bridge = window.procashier;
            if (bridge?.getLicenseStatus) {
                try {
                    const st = await bridge.getLicenseStatus();
                    setLicenseInfo(st);
                    if (st.isPerpetual) {
                        setLiveRemainingText('ترخيص دائم طوال الحياة 👑');
                    } else if (st.expiresAt) {
                        const diff = Date.parse(st.expiresAt) - Date.now();
                        if (diff <= 0) {
                            setLiveRemainingText('انتهت صلاحية الترخيص - يرجى التجديد ⚠️');
                        } else {
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                            const minutes = Math.floor((diff / (1000 * 60)) % 60);
                            const seconds = Math.floor((diff / 1000) % 60);

                            if (days > 0) {
                                setLiveRemainingText(`صالح لمدة: ${days} يوم و ${hours} ساعة`);
                            } else if (hours > 0) {
                                setLiveRemainingText(`صالح لمدة: ${hours} ساعة و ${minutes} دقيقة`);
                            } else {
                                setLiveRemainingText(`صالح لمدة: ${minutes} دقيقة و ${seconds} ثانية`);
                            }
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        };

        updateLicenseStatus();
        const interval = setInterval(updateLicenseStatus, 1000);
        return () => clearInterval(interval);
    }, []);"""

if old_login_states in app_tsx:
    app_tsx = app_tsx.replace(old_login_states, new_login_states, 1)
    print("Added live license timer in LoginScreen")

# In LoginScreen Header, insert the license badge
old_login_header = """            <h1 className="text-3xl font-bold mb-2 translate-x-[2%]"><span className="text-amber-400 dark:text-amber-300">RaiZon</span> <span className="text-purple-500 dark:text-purple-400">Pro</span> <span className="text-xl align-super opacity-80">v1</span></h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm tracking-wide uppercase">{t('login_title')}</p>
          </div>"""

new_login_header = """            <h1 className="text-3xl font-bold mb-2 translate-x-[2%]"><span className="text-amber-400 dark:text-amber-300">RaiZon</span> <span className="text-purple-500 dark:text-purple-400">Pro</span> <span className="text-xl align-super opacity-80">v1</span></h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm tracking-wide uppercase">{t('login_title')}</p>

            {/* عرض المدة المتبقية على انتهاء الترخيص */}
            {liveRemainingText && (
              <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
                <Clock size={14} className="animate-pulse text-amber-500" />
                <span>{liveRemainingText}</span>
              </div>
            )}
          </div>"""

if old_login_header in app_tsx:
    app_tsx = app_tsx.replace(old_login_header, new_login_header, 1)
    print("Added license remaining badge in LoginScreen header")

# In LoginScreen Footer, insert the Patcher button
old_login_footer = """          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
                {t('developed_by')}
            </p>
          </div>"""

new_login_footer = """          <div className="mt-8 text-center space-y-2">
            <p className="text-xs text-slate-500">
                {t('developed_by')}
            </p>
            {onOpenPatcher && (
              <button
                type="button"
                onClick={onOpenPatcher}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                title="لوحة تحكم وتوليد تراخيص المطور (Patcher) - اختصار: Ctrl+Shift+P"
              >
                <Shield size={13} className="text-amber-500" />
                <span>Patcher Pro (المطور)</span>
              </button>
            )}
          </div>"""

if old_login_footer in app_tsx:
    app_tsx = app_tsx.replace(old_login_footer, new_login_footer, 1)
    print("Added Patcher developer button in LoginScreen footer")

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_tsx)

print("Saved App.tsx successfully")
