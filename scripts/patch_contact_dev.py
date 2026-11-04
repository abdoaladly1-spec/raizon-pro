import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add Phone to imports in App.tsx if missing
if "Phone" not in text.split("from './components/Icons';")[0]:
    text = text.replace(
        "from './components/Icons';",
        ", Phone } from './components/Icons';"
    ).replace(", Phone, Phone", ", Phone")
    print("Added Phone import to App.tsx")

# 2. Add showContactDev state and modal inside ActivationScreen
old_activation_states = """const ActivationScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [machineId, setMachineId] = useState(localStorage.getItem('machineId') || '');
    const [copied, setCopied] = useState(false);
    const { t } = useApp();"""

new_activation_states = """const ActivationScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [machineId, setMachineId] = useState(localStorage.getItem('machineId') || '');
    const [copied, setCopied] = useState(false);
    const [showContactDev, setShowContactDev] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);
    const { t } = useApp();"""

text = text.replace(old_activation_states, new_activation_states, 1)

# 3. Add Contact Developer button under onOpenPatcher
old_patcher_btn = """                {onOpenPatcher && (
                    <button
                        type="button"
                        onClick={onOpenPatcher}
                        className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <Shield size={16} />
                        <span>فتح أداة الترخيص المباشر (Patcher للمطور)</span>
                    </button>
                )}"""

new_patcher_btn = """                {onOpenPatcher && (
                    <button
                        type="button"
                        onClick={onOpenPatcher}
                        className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <Shield size={16} />
                        <span>فتح أداة الترخيص المباشر (Patcher للمطور)</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setShowContactDev(true)}
                    className="w-full py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                    <Phone size={15} />
                    <span>تواصل مع المطور</span>
                </button>"""

text = text.replace(old_patcher_btn, new_patcher_btn, 1)

# 4. Add the Contact Developer modal before closing ActivationScreen
old_activation_end = """                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {t('secure_license')}
                    </p>
                </div>
            </div>
        </div>
    );
};"""

new_activation_end = """                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {t('secure_license')}
                    </p>
                </div>
            </div>

            {/* نافذة التواصل مع المطور */}
            {showContactDev && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-scale-in" dir="rtl">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl max-w-xs w-full border border-purple-500/40 text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
                            <Phone size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">تواصل مع المطور</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">للحصول على كود التفعيل والدعم الفني</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">رقم الهاتف / واتساب:</span>
                            <div className="font-mono text-xl font-black text-purple-600 dark:text-purple-300 tracking-wider" dir="ltr">
                                01026695879
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText('01026695879');
                                    setCopiedPhone(true);
                                    setTimeout(() => setCopiedPhone(false), 2000);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedPhone ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                            </button>
                            <a
                                href="tel:01026695879"
                                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                                <Phone size={14} />
                                <span>اتصال</span>
                            </a>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowContactDev(false)}
                            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};"""

text = text.replace(old_activation_end, new_activation_end, 1)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated App.tsx with Contact Developer button and modal")
