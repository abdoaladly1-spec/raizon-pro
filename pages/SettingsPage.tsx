import { UnsavedChangesModal } from '../components/UnsavedChangesModal';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, 
    Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, 
    Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, 
    ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, 
    ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw,
    Building, Bell, Lock, Save, Key, Shield, Download
} from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier, AppState } from '../types';
import { Card, Button, Input, ToastContainer } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, flushQueue, getSyncStatus, pushBackup, fetchBackup } from '../lib/serverSync';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { fileToLogoDataUrl, saveLogoAsset, removeLogoAsset } from '../lib/assets';
import { listPrinters, type PrinterInfoLite } from '../lib/printBridge';
import { PAGE_SIZES, ELEMENT_ORDER, TEMPLATE_PRESETS, applyTemplatePreset, normalizeTemplate, DEFAULT_ELEMENTS, normalizePrintDesign, type PrintDesign, type TemplateId } from '../lib/printDesign';

type SettingsTab = 'general' | 'email' | 'print' | 'security' | 'users' | 'logs' | 'updates';

const TABS = [
    { id: 'general', icon: Building, labelAr: 'بيانات المحل', labelEn: 'Shop Profile' },
    { id: 'email', icon: Bell, labelAr: 'إشعارات المدير', labelEn: 'Manager Alerts' },
    { id: 'print', icon: Printer, labelAr: 'الطباعة والتصميم', labelEn: 'Print Design' },
    { id: 'security', icon: Shield, labelAr: 'النسخ الاحتياطي والأمان', labelEn: 'Backup & Security' },
    { id: 'users', icon: Users, labelAr: 'المستخدمين', labelEn: 'Users' },
    { id: 'logs', icon: Activity, labelAr: 'سجل التدقيق', labelEn: 'Audit Logs' },
    { id: 'updates', icon: RefreshCw, labelAr: 'التحديثات السحابية', labelEn: 'Cloud Updates' },
] as const;

export const SettingsPage = () => {
    const { 
        state, t, language, updateSettings, currentUser, resetSystem, 
        resetLoyaltyPoints, addToast, changeOwnPassword, setQuickPin, restoreState,
        setSettingsDirty, saveSettingsHandlerRef, discardSettingsHandlerRef
    } = useApp();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [form, setForm] = useState(state.settings);
    const initialFormJsonRef = useRef(JSON.stringify(state.settings));
    const initialEmailJsonRef = useRef('');

    // --- GitHub Releases Cloud Updater State & Handlers ---
    const [appVersion, setAppVersion] = useState<string>('1.0.0');
    const [updateChecking, setUpdateChecking] = useState<boolean>(false);
    const [updateDownloading, setUpdateDownloading] = useState<boolean>(false);
    const [downloadPercent, setDownloadPercent] = useState<number>(0);
    const [downloadTransferredMb, setDownloadTransferredMb] = useState<string>('0');
    const [downloadTotalMb, setDownloadTotalMb] = useState<string>('0');
    const [updateResult, setUpdateResult] = useState<{
        checked: boolean;
        hasUpdate: boolean;
        latestVersion?: string;
        releaseName?: string;
        releaseNotes?: string;
        publishedAt?: string;
        downloadUrl?: string;
        htmlUrl?: string;
        installerAsset?: any;
        error?: string;
    } | null>(null);
    const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
    const [customRepo, setCustomRepo] = useState<string>(state.settings?.githubRepo || 'abdoaladly1-spec/raizon-pro');
    const [customToken, setCustomToken] = useState<string>(state.settings?.githubToken || '');
    const [autoCheck, setAutoCheck] = useState<boolean>(state.settings?.autoCheckUpdates !== false);

    useEffect(() => {
        if (window.procashier?.getAppVersion) {
            window.procashier.getAppVersion().then(v => {
                if (v) setAppVersion(v);
            }).catch(() => {});
        }
        if (window.procashier?.onUpdaterStatus) {
            const unsub = window.procashier.onUpdaterStatus((status) => {
                if (status.stage === 'downloading') {
                    setUpdateDownloading(true);
                    setDownloadPercent(status.percent || 0);
                    if (status.transferred && status.total) {
                        setDownloadTransferredMb((status.transferred / (1024 * 1024)).toFixed(1));
                        setDownloadTotalMb((status.total / (1024 * 1024)).toFixed(1));
                    }
                } else if (status.stage === 'downloaded') {
                    setUpdateDownloading(false);
                    setIsDownloaded(true);
                    addToast(language === 'ar' ? 'تم تنزيل ملف التحديث بنجاح! جاهز للتثبيت' : 'Update downloaded! Ready to install', 'success');
                } else if (status.stage === 'error') {
                    setUpdateDownloading(false);
                    addToast(status.error || (language === 'ar' ? 'حدث خطأ أثناء تنزيل التحديث' : 'Error downloading update'), 'error');
                }
            });
            return () => unsub();
        }
    }, [language, addToast]);

    const handleCheckForUpdates = async () => {
        setUpdateChecking(true);
        setUpdateResult(null);
        setIsDownloaded(false);
        try {
            if (window.procashier?.checkForUpdates) {
                const res = await window.procashier.checkForUpdates({
                    repo: customRepo,
                    token: customToken
                });
                if (res && res.ok && res.hasUpdate) {
                    setUpdateResult({
                        checked: true,
                        hasUpdate: true,
                        latestVersion: res.latestVersion,
                        releaseName: res.releaseName,
                        releaseNotes: res.releaseNotes,
                        publishedAt: res.publishedAt,
                        downloadUrl: res.downloadUrl,
                        htmlUrl: res.htmlUrl,
                        installerAsset: res.installerAsset
                    });
                    addToast(language === 'ar' ? `يتوفر إصدار جديد: ${res.latestVersion}` : `New update available: ${res.latestVersion}`, 'info');
                } else {
                    setUpdateResult({
                        checked: true,
                        hasUpdate: false
                    });
                    addToast(language === 'ar' ? 'أنت على أحدث إصدار من RaiZon Pro' : 'You are on the latest version of RaiZon Pro', 'success');
                }
            } else {
                const cleanRepo = customRepo.replace('https://github.com/', '').trim();
                const response = await fetch(`https://api.github.com/repos/${cleanRepo}/releases/latest`);
                if (response.ok) {
                    const data = await response.json();
                    const latest = (data.tag_name || data.name || '').replace(/^[^\d]*/, '');
                    const hasNew = latest && latest !== appVersion && latest !== `v${appVersion}`;
                    if (hasNew) {
                        setUpdateResult({
                            checked: true,
                            hasUpdate: true,
                            latestVersion: data.tag_name,
                            releaseName: data.name,
                            releaseNotes: data.body,
                            publishedAt: data.published_at,
                            htmlUrl: data.html_url,
                            downloadUrl: data.assets?.[0]?.browser_download_url || data.html_url
                        });
                        addToast(language === 'ar' ? `يتوفر إصدار جديد: ${data.tag_name}` : `New update available: ${data.tag_name}`, 'info');
                    } else {
                        setUpdateResult({
                            checked: true,
                            hasUpdate: false
                        });
                        addToast(language === 'ar' ? 'أنت على أحدث إصدار من RaiZon Pro' : 'You are on the latest version of RaiZon Pro', 'success');
                    }
                } else {
                    setUpdateResult({
                        checked: true,
                        hasUpdate: false
                    });
                    addToast(language === 'ar' ? 'أنت على أحدث إصدار من RaiZon Pro' : 'You are on the latest version of RaiZon Pro', 'success');
                }
            }
        } catch (e: any) {
            setUpdateResult({
                checked: true,
                hasUpdate: false
            });
            addToast(language === 'ar' ? 'أنت على أحدث إصدار من RaiZon Pro' : 'You are on the latest version of RaiZon Pro', 'success');
        } finally {
            setUpdateChecking(false);
        }
    };

    const handleDownloadUpdate = async () => {
        if (!updateResult?.downloadUrl) return;
        setUpdateDownloading(true);
        setDownloadPercent(0);
        try {
            if (updateResult?.latestVersion) {
                localStorage.setItem('raizon_just_updated', 'true');
                localStorage.setItem('raizon_app_version', updateResult.latestVersion);
                localStorage.setItem('raizon_whats_new', JSON.stringify({
                    version: updateResult.latestVersion,
                    name: updateResult.releaseName || `الإصدار ${updateResult.latestVersion}`,
                    notes: updateResult.releaseNotes || ''
                }));
            }
            if (window.procashier?.downloadUpdate) {
                const res = await window.procashier.downloadUpdate({
                    downloadUrl: updateResult.downloadUrl,
                    filename: updateResult.installerAsset?.name || 'RaiZon_Pro_Update.exe'
                });
                if (res.ok) {
                    setIsDownloaded(true);
                    // إغلاق التطبيق والتحديث وإعادة التشغيل تلقائياً
                    setTimeout(async () => {
                        if (window.procashier?.installUpdate) {
                            await window.procashier.installUpdate();
                        }
                    }, 800);
                } else {
                    addToast(res.error || 'فشل التنزيل', 'error');
                }
            } else if (window.procashier?.openExternalUrl) {
                window.procashier.openExternalUrl(updateResult.downloadUrl);
            } else {
                window.open(updateResult.downloadUrl, '_blank');
            }
        } catch (err: any) {
            addToast(err?.message || 'فشل التنزيل', 'error');
        } finally {
            setUpdateDownloading(false);
        }
    };

    const handleInstallUpdate = async () => {
        try {
            if (updateResult?.latestVersion) {
                localStorage.setItem('raizon_just_updated', 'true');
                localStorage.setItem('raizon_app_version', updateResult.latestVersion);
                localStorage.setItem('raizon_whats_new', JSON.stringify({
                    version: updateResult.latestVersion,
                    name: updateResult.releaseName || `الإصدار ${updateResult.latestVersion}`,
                    notes: updateResult.releaseNotes || ''
                }));
            }
            if (window.procashier?.installUpdate) {
                await window.procashier.installUpdate();
            }
        } catch (err: any) {
            addToast(err?.message || 'تعذر تشغيل التثبيت', 'error');
        }
    };

    const handleSaveRepoSettings = () => {
        updateSettings({
            ...state.settings,
            githubRepo: customRepo.trim(),
            githubToken: customToken.trim(),
            autoCheckUpdates: autoCheck
        });
        addToast(language === 'ar' ? 'تم حفظ إعدادات مستودع التحديث بنجاح' : 'GitHub repo settings saved successfully', 'success');
    };


    // مزامنة عند التحديث الخارجي
    useEffect(() => {
        setForm(state.settings);
        initialFormJsonRef.current = JSON.stringify(state.settings);
    }, [state.settings]);

    const [serverTest, setServerTest] = useState<null | { ok: boolean; message: string; lanUrls?: string[] }>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncingNow, setSyncingNow] = useState(false);

    // Email Notification Configuration (إشعارات Gmail للمدير)
    const [emailConfig, setEmailConfig] = useState({
        smtpUser: 'rizon.pro.app@gmail.com',
        smtpPassword: '',
        emailTo: '',
        notifyOnInvoice: true,
        notifyOnClosing: true,
        notifyOnReturn: true,
        notifyOnExpense: true,
        mode: 'live',
        hasPassword: true
    });
    const [isSavingEmail, setIsSavingEmail] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState<any>(null);

    const fetchEmailConfig = async () => {
        // 1. استرجاع الإعدادات المحفوظة محلياً فوراً لمنع تفريغ الحقول
        const savedEmail = state.settings?.emailConfig?.emailTo || state.settings?.managerEmail || '';
        if (savedEmail) {
            setEmailConfig(prev => ({
                ...prev,
                emailTo: savedEmail,
                notifyOnInvoice: state.settings.emailConfig?.notifyOnInvoice ?? prev.notifyOnInvoice,
                notifyOnClosing: state.settings.emailConfig?.notifyOnClosing ?? prev.notifyOnClosing,
                notifyOnReturn: state.settings.emailConfig?.notifyOnReturn ?? prev.notifyOnReturn,
                notifyOnExpense: state.settings.emailConfig?.notifyOnExpense ?? prev.notifyOnExpense,
            }));
        }

        // 2. محاولة المزامنة مع السيرفر المحلي إن كان نشطاً
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const res = await fetch(`${serverUrl}/api/email/config`, {
                headers: { 'X-API-Key': apiKey },
                signal: AbortSignal.timeout(2000)
            });
            if (res.ok) {
                const data = await res.json();
                setEmailConfig(prev => ({
                    ...prev,
                    smtpUser: data.smtp_user || 'rizon.pro.app@gmail.com',
                    emailTo: data.email_to || prev.emailTo || savedEmail,
                    notifyOnInvoice: data.notify_on_invoice !== undefined ? Boolean(data.notify_on_invoice) : prev.notifyOnInvoice,
                    notifyOnClosing: data.notify_on_closing !== undefined ? Boolean(data.notify_on_closing) : prev.notifyOnClosing,
                    notifyOnReturn: data.notify_on_return !== undefined ? Boolean(data.notify_on_return) : prev.notifyOnReturn,
                    notifyOnExpense: data.notify_on_expense !== undefined ? Boolean(data.notify_on_expense) : prev.notifyOnExpense,
                    mode: data.mode || 'live',
                    hasPassword: Boolean(data.has_password)
                }));
                if (data.api_key && !form.serverApiKey) {
                    setForm(prev => ({ ...prev, serverApiKey: data.api_key }));
                    updateSettings({ ...state.settings, serverApiKey: data.api_key });
                }
            }
        } catch (e) {
            // السيرفر غير متصل: الإعدادات المحلية تعمل بشكل طبيعي ومستقر
        }
    };

    useEffect(() => {
        fetchEmailConfig();
    }, [form.serverUrl, form.serverApiKey]);

    const handleSaveEmailConfig = async () => {
        const cleanEmail = emailConfig.emailTo.trim();
        if (!cleanEmail) {
            addToast(language === 'ar' ? 'يرجى إدخال عنوان البريد الإلكتروني للمدير' : 'Please enter manager email', 'error');
            return;
        }

        setIsSavingEmail(true);

        // 1. الحفظ الفوري الدائم في إعدادات التطبيق محلياً (AppContext + localStorage)
        const currentEmailConfig = {
            emailTo: cleanEmail,
            notifyOnInvoice: emailConfig.notifyOnInvoice,
            notifyOnClosing: emailConfig.notifyOnClosing,
            notifyOnReturn: emailConfig.notifyOnReturn,
            notifyOnExpense: emailConfig.notifyOnExpense,
            smtpUser: emailConfig.smtpUser || 'rizon.pro.app@gmail.com'
        };

        try {
            updateSettings({
                ...state.settings,
                managerEmail: cleanEmail,
                emailConfig: currentEmailConfig
            });
            setForm(prev => ({ ...prev, managerEmail: cleanEmail }));

            // 2. محاولة المزامنة مع السيرفر المحلي في الخلفية
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';

            try {
                const res = await fetch(`${serverUrl}/api/email/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': apiKey
                    },
                    body: JSON.stringify({
                        email_to: cleanEmail,
                        notify_on_invoice: emailConfig.notifyOnInvoice,
                        notify_on_closing: emailConfig.notifyOnClosing,
                        notify_on_return: emailConfig.notifyOnReturn,
                        notify_on_expense: emailConfig.notifyOnExpense,
                    }),
                    signal: AbortSignal.timeout(3000)
                });

                if (res.ok) {
                    const data = await res.json();
                    setEmailConfig(prev => ({ ...prev, emailTo: cleanEmail, mode: data.mode, hasPassword: true }));
                    addToast(language === 'ar' ? 'تم حفظ بريد المدير وتفعيل الإشعارات بنجاح' : 'Manager email saved successfully', 'success');
                } else {
                    setEmailConfig(prev => ({ ...prev, emailTo: cleanEmail }));
                    addToast(language === 'ar' ? 'تم حفظ بريد المدير بنجاح في إعدادات النظام' : 'Manager email saved locally', 'success');
                }
            } catch (networkErr) {
                // حتى لو لم يستجب السيرفر الخارجي، تم الحفظ محلياً بنجاح تام وبدون أي خطأ للمستخدم
                setEmailConfig(prev => ({ ...prev, emailTo: cleanEmail }));
                addToast(language === 'ar' ? 'تم حفظ بريد المدير بنجاح في إعدادات النظام' : 'Manager email saved locally', 'success');
            }
        } catch (e: any) {
            addToast(e?.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
        } finally {
            setIsSavingEmail(false);
        }
    };

    const handleSendTestEmail = async (service: string = 'invoice') => {
        const cleanEmail = emailConfig.emailTo.trim();
        if (!cleanEmail) {
            addToast(language === 'ar' ? 'يرجى إدخال بريد المدير وحفظه أولاً' : 'Please enter manager email first', 'error');
            return;
        }

        setIsTestingEmail(true);
        setTestEmailResult(null);
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const res = await fetch(`${serverUrl}/api/email/test`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey 
                },
                body: JSON.stringify({ service }),
                signal: AbortSignal.timeout(6000)
            });
            if (res.ok) {
                const data = await res.json();
                setTestEmailResult({ ...data, testedService: service });
                if (data.status === 'sent') {
                    const serviceLabel = 
                        service === 'closing' ? (language === 'ar' ? 'تقرير التقفيل' : 'Closing report') :
                        service === 'return' ? (language === 'ar' ? 'إشعار المرتجع' : 'Return notice') :
                        service === 'expense' ? (language === 'ar' ? 'إشعار المصروف' : 'Expense notice') :
                        (language === 'ar' ? 'فاتورة البيع' : 'Invoice');
                    addToast(language === 'ar' ? `تم إرسال تجربة (${serviceLabel}) بنجاح إلى ${cleanEmail}` : `Test email (${service}) sent successfully!`, 'success');
                } else if (data.status === 'simulated') {
                    addToast(language === 'ar' ? 'وضع المحاكاة: الإيميل مسجل لكن لم يتم إرسال حقيقي' : 'Simulated mode', 'info');
                } else {
                    addToast(language === 'ar' ? `فشل الإرسال: ${data.error || 'خطأ غير معروف'}` : `Failed: ${data.error}`, 'error');
                }
            } else {
                addToast(language === 'ar' ? 'السيرفر المحلي مشغول أو يحتاج مفتاح API صحيح' : 'Failed to send test email', 'error');
            }
        } catch (e: any) {
            addToast(language === 'ar' ? 'السيرفر المحلي (8087) غير متصل حالياً للإرسال الفعلي' : 'Local server is currently unreachable', 'error');
        } finally {
            setIsTestingEmail(false);
        }
    };

    useEffect(() => {
        const tick = () => setPendingCount(getSyncStatus().pending);
        tick();
        const tId = setInterval(tick, 3000);
        return () => clearInterval(tId);
    }, []);

    const handleSyncNow = async () => {
        setSyncingNow(true);
        try {
            const res = await flushQueue({ url: form.serverUrl || 'http://127.0.0.1:8087', apiKey: form.serverApiKey || '' });
            setPendingCount(getSyncStatus().pending);
            if (res.errors === 0) {
                addToast(language === 'ar' ? `تمت المزامنة بنجاح (${res.sent} فاتورة)` : `Synced ${res.sent} invoices`, 'success');
            } else {
                addToast(language === 'ar' ? `اكتملت المزامنة مع ${res.errors} أخطاء` : `Sync had ${res.errors} errors`, 'error');
            }
        } finally {
            setSyncingNow(false);
        }
    };

    const handleTestServer = async () => {
        const res = await testConnection({ url: form.serverUrl || 'http://127.0.0.1:8087', apiKey: form.serverApiKey || '' });
        setServerTest(res);
        if (res.ok) {
            addToast(t('server_connected'), 'success');
        } else {
            addToast(t('server_failed'), 'error');
        }
    };

    // تغيير كلمة المرور للمستخدم الحالي
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pinValue, setPinValue] = useState('');
    const [secBusy, setSecBusy] = useState(false);

    const handleChangePassword = async () => {
        setSecBusy(true);
        try {
            const ok = await changeOwnPassword(pwCurrent, pwNew);
            if (ok) {
                addToast(t('password_changed'), 'success');
                setPwCurrent('');
                setPwNew('');
            } else {
                addToast(t('current_password_wrong'), 'error');
            }
        } finally {
            setSecBusy(false);
        }
    };

    const handleSavePin = async () => {
        setSecBusy(true);
        try {
            const ok = await setQuickPin(pwCurrent, pinValue);
            if (ok) {
                addToast(t('quick_pin_saved'), 'success');
                setPinValue('');
                setPwCurrent('');
            } else {
                addToast(t('current_password_wrong'), 'error');
            }
        } finally {
            setSecBusy(false);
        }
    };

    const handleClearPin = async () => {
        setSecBusy(true);
        try {
            const ok = await setQuickPin(pwCurrent, null);
            if (ok) {
                addToast(t('quick_pin_cleared'), 'success');
                setPinValue('');
                setPwCurrent('');
            } else {
                addToast(t('current_password_wrong'), 'error');
            }
        } finally {
            setSecBusy(false);
        }
    };

    // إدارة النسخ الاحتياطي الذكي (مجلد Backup محلياً + سحابي على الجيميل)
    const [backupBusy, setBackupBusy] = useState(false);
    const [backupFiles, setBackupFiles] = useState<Array<{ filename: string; size_kb: number; date_str: string; modified_at: number }>>([]);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBackupFiles = async () => {
        setIsLoadingBackups(true);
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const res = await fetch(`${serverUrl}/api/backup/list`, {
                headers: { 'X-API-Key': apiKey }
            });
            if (res.ok) {
                const data = await res.json();
                setBackupFiles(data.backups || []);
            }
        } catch (e) {
            console.log('Failed to fetch backup files', e);
        } finally {
            setIsLoadingBackups(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'security') {
            fetchBackupFiles();
        }
    }, [activeTab]);

    const handleCreateBackupNow = async () => {
        setBackupBusy(true);
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const currentEmailConfig = {
                emailTo: emailConfig.emailTo || form.managerEmail || '',
                notifyOnInvoice: emailConfig.notifyOnInvoice,
                notifyOnClosing: emailConfig.notifyOnClosing,
                notifyOnReturn: emailConfig.notifyOnReturn,
                notifyOnExpense: emailConfig.notifyOnExpense,
                smtpUser: emailConfig.smtpUser || 'rizon.pro.app@gmail.com'
            };
            const backupPayload = {
                ...state,
                managerEmail: currentEmailConfig.emailTo,
                emailConfig: currentEmailConfig,
                settings: {
                    ...state.settings,
                    ...form,
                    managerEmail: currentEmailConfig.emailTo,
                    emailConfig: currentEmailConfig
                }
            };
            const res = await fetch(`${serverUrl}/api/backup?send_email=true`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify(backupPayload)
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                if (data.email?.status === 'sent') {
                    addToast(language === 'ar' ? `تم حفظ النسخة في مجلد Backup وإرسالها لميل المدير سحابياً بنجاح!` : 'Backup saved locally and emailed to manager!', 'success');
                } else {
                    addToast(language === 'ar' ? 'تم حفظ النسخة بنجاح في مجلد Backup على جهازك' : 'Backup saved locally in Backup folder', 'success');
                }
                fetchBackupFiles();
            } else {
                addToast(data.detail || 'فشل حفظ النسخة الاحتياطية', 'error');
            }
        } catch (e: any) {
            addToast(e.message || 'خطأ في النسخ الاحتياطي', 'error');
        } finally {
            setBackupBusy(false);
        }
    };

    const handleRestoreBackupFile = async (filename: string) => {
        setBackupBusy(true);
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const res = await fetch(`${serverUrl}/api/backup/restore/${encodeURIComponent(filename)}`, {
                headers: { 'X-API-Key': apiKey }
            });
            const data = await res.json();
            if (res.ok && data.state) {
                await applyRestoredData(data.state, filename);
            } else {
                addToast(data.detail || 'فشل استرجاع الملف', 'error');
            }
        } catch (e: any) {
            addToast(e.message || 'خطأ أثناء الاسترجاع', 'error');
        } finally {
            setBackupBusy(false);
        }
    };

    const handleDownloadBackupFile = async (filename: string) => {
        try {
            const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
            const apiKey = form.serverApiKey || '';
            const res = await fetch(`${serverUrl}/api/backup/restore/${encodeURIComponent(filename)}`, {
                headers: { 'X-API-Key': apiKey }
            });
            const data = await res.json();
            if (res.ok && data.state) {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data.state, null, 2));
                const dlNode = document.createElement('a');
                dlNode.setAttribute("href", dataStr);
                dlNode.setAttribute("download", filename);
                document.body.appendChild(dlNode);
                dlNode.click();
                dlNode.remove();
                addToast(language === 'ar' ? `تم بدء تحميل (${filename})` : 'Download started', 'info');
            }
        } catch (e: any) {
            addToast(e.message || 'Error downloading file', 'error');
        }
    };

    const applyRestoredData = async (parsedData: any, filename: string) => {
        const actualState = parsedData.state || parsedData.appState || parsedData.data || parsedData;
        if (!actualState || typeof actualState !== 'object') {
            addToast(language === 'ar' ? 'الملف غير صالح أو لا يحتوي على بنية بيانات صحيحة' : 'Invalid data structure in file', 'error');
            return;
        }

        const invCount = Array.isArray(actualState.invoices) ? actualState.invoices.length : 0;
        const itemsCount = Array.isArray(actualState.items) ? actualState.items.length : (Array.isArray(actualState.products) ? actualState.products.length : 0);
        const custCount = Array.isArray(actualState.customers) ? actualState.customers.length : 0;

        // استخراج بريد المدير وإعدادات الإشعارات من النسخة
        const restoredEmail = actualState.settings?.emailConfig?.emailTo 
            || actualState.settings?.managerEmail 
            || actualState.emailConfig?.emailTo 
            || actualState.managerEmail;
        const restoredEmailConfig = actualState.settings?.emailConfig || actualState.emailConfig;

        const emailNote = restoredEmail ? `• بريد المدير للتقارير: ${restoredEmail}` : '• بريد المدير: (غير مسجل في هذه النسخة)';

        const confirmMsg = language === 'ar'
            ? `هل أنت متأكد من استعادة النسخة الاحتياطية (${filename})؟\n\nملخص محتويات الملف:\n• الفواتير: ${invCount}\n• الأصناف والمنتجات: ${itemsCount}\n• العملاء: ${custCount}\n${emailNote}\n\nسيتم استبدال البيانات الحالية وتطبيق بيانات هذا الملف وبريد المدير بالكامل.`
            : `Are you sure you want to restore (${filename})?\nInvoices: ${invCount}, Items: ${itemsCount}, Customers: ${custCount}\nManager Email: ${restoredEmail || 'None'}`;

        if (!confirm(confirmMsg)) return;

        setBackupBusy(true);
        try {
            restoreState(actualState);

            // استعادة بريد المدير فوراً في الواجهة وعلى السيرفر
            if (restoredEmail) {
                setEmailConfig(prev => ({
                    ...prev,
                    emailTo: restoredEmail,
                    notifyOnInvoice: restoredEmailConfig?.notifyOnInvoice ?? prev.notifyOnInvoice,
                    notifyOnClosing: restoredEmailConfig?.notifyOnClosing ?? prev.notifyOnClosing,
                    notifyOnReturn: restoredEmailConfig?.notifyOnReturn ?? prev.notifyOnReturn,
                    notifyOnExpense: restoredEmailConfig?.notifyOnExpense ?? prev.notifyOnExpense,
                }));

                try {
                    const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
                    const apiKey = form.serverApiKey || '';
                    await fetch(`${serverUrl}/api/email/config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
                        body: JSON.stringify({
                            email_to: restoredEmail,
                            notify_on_invoice: restoredEmailConfig?.notifyOnInvoice ?? true,
                            notify_on_closing: restoredEmailConfig?.notifyOnClosing ?? true,
                            notify_on_return: restoredEmailConfig?.notifyOnReturn ?? true,
                            notify_on_expense: restoredEmailConfig?.notifyOnExpense ?? true,
                        })
                    });
                } catch (e) {
                    console.warn('Failed to push restored email to server:', e);
                }
            }

            // حفظ نسخة من الملف في مجلد Backup الخاص بالسيرفر المحلي ليظهر في جدول النسخ بالأسفل
            try {
                const serverUrl = form.serverUrl || 'http://127.0.0.1:8087';
                const apiKey = form.serverApiKey || '';
                await fetch(`${serverUrl}/api/backup?send_email=false`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
                    body: JSON.stringify(actualState)
                });
                fetchBackupFiles();
            } catch {
                // صامت إذا كان السيرفر غير متصل
            }

            addToast(
                language === 'ar' 
                    ? `تم استعادة كافة البيانات وبريد المدير (${restoredEmail || 'الافتراضي'}) بنجاح!` 
                    : 'All data and manager email restored successfully!', 
                'success'
            );
        } catch (e: any) {
            console.error('Error applying restored data', e);
            addToast(e?.message || 'خطأ أثناء تطبيق البيانات', 'error');
        } finally {
            setBackupBusy(false);
        }
    };

    const handleTriggerFileRestore = async () => {
        // إذا كان التطبيق يعمل داخل بيئة Electron نستخدم حوار فتح الملفات الأصلي الموثوق 100%
        if (typeof window !== 'undefined' && (window as any).procashier?.openBackupFile) {
            try {
                const res = await (window as any).procashier.openBackupFile();
                if (res.canceled) return;
                if (!res.ok || !res.data) {
                    addToast(res.error || (language === 'ar' ? 'فشل قراءة الملف المختار' : 'Failed to read file'), 'error');
                    return;
                }
                await applyRestoredData(res.data, res.filename || 'backup.json');
            } catch (err: any) {
                console.error(err);
                addToast(err?.message || 'Error opening file', 'error');
            }
            return;
        }

        // في بيئة المتصفح العادية نفتح الـ file input
        fileInputRef.current?.click();
    };

    const handleRestoreFromLocalFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text || !text.trim()) {
                    addToast(language === 'ar' ? 'الملف المحدد فارغ' : 'File is empty', 'error');
                    return;
                }
                const parsed = JSON.parse(text);
                await applyRestoredData(parsed, file.name);
            } catch (err: any) {
                console.error('Failed to parse backup file', err);
                addToast(language === 'ar' ? 'الملف غير صالح أو تالف: ' + (err?.message || '') : 'Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // QR Code للربط بالشبكة المحلية
    const [qr, setQr] = useState({ dataUrl: '', text: '' });
    useEffect(() => {
        if (!form.serverApiKey && typeof window !== 'undefined' && (window as any).procashier?.getServerApiKey) {
            (window as any).procashier.getServerApiKey().then((k: string) => {
                if (k) setForm(prev => ({ ...prev, serverApiKey: k }));
            }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await testConnection({ url: form.serverUrl || 'http://127.0.0.1:8087', apiKey: form.serverApiKey || '' });
            if (!cancelled) setServerTest(res);
        })();
        return () => { cancelled = true; };
    }, [form.serverUrl, form.serverApiKey]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const bestLan = (serverTest?.lanUrls && serverTest.lanUrls[0]) || '';
            const rawUrl = (form.serverUrl || bestLan || '').trim().replace(/\/+$/, '');
            const key = (form.serverApiKey || '').trim();
            if (!rawUrl) {
                if (!cancelled) setQr({ dataUrl: '', text: '' });
                return;
            }
            const payload = JSON.stringify({ url: rawUrl, ...(key ? { apiKey: key } : {}) });
            try {
                const QRCode = (await import('qrcode')).default;
                const url = await QRCode.toDataURL(payload, { width: 180, margin: 1 });
                if (!cancelled) setQr({ dataUrl: url, text: payload });
            } catch (e) {
                if (!cancelled) setQr({ dataUrl: '', text: payload });
            }
        })();
        return () => { cancelled = true; };
    }, [serverTest?.lanUrls, form.serverUrl, form.serverApiKey]);

    // مقارنة الحالة الحالية بالحالة المحفوظة لمعرفة وجود تعديلات غير محفوظة
    const isDirty = useMemo(() => {
        const formDirty = JSON.stringify(form) !== initialFormJsonRef.current;
        const emailDirty = initialEmailJsonRef.current ? JSON.stringify(emailConfig) !== initialEmailJsonRef.current : false;
        return formDirty || emailDirty;
    }, [form, emailConfig]);

    // مزامنة حالة التعديل مع السياق العام لحماية التنقل بين صفحات البرنامج
    useEffect(() => {
        setSettingsDirty(isDirty);
        return () => {
            setSettingsDirty(false);
        };
    }, [isDirty, setSettingsDirty]);

    const handleSaveAll = async () => {
        updateSettings(form);
        initialFormJsonRef.current = JSON.stringify(form);
        
        // إذا تغيرت إعدادات بريد المدير يتم حفظها على السيرفر أيضاً
        if (initialEmailJsonRef.current && JSON.stringify(emailConfig) !== initialEmailJsonRef.current) {
            await handleSaveEmailConfig();
            initialEmailJsonRef.current = JSON.stringify(emailConfig);
        }
        
        setSettingsDirty(false);
        addToast(t('settings_saved'), 'success');
    };

    const handleDiscardAll = () => {
        setForm(state.settings);
        initialFormJsonRef.current = JSON.stringify(state.settings);
        if (initialEmailJsonRef.current) {
            try {
                setEmailConfig(JSON.parse(initialEmailJsonRef.current));
            } catch {}
        }
        setSettingsDirty(false);
        addToast(language === 'ar' ? 'تم تجاهل التعديلات والعودة للوضع السابق' : 'Changes discarded', 'info');
    };

    const save = handleSaveAll;

    // تسجيل دوال الحفظ والتجاهل للتنقل الخارجي
    useEffect(() => {
        saveSettingsHandlerRef.current = handleSaveAll;
        discardSettingsHandlerRef.current = handleDiscardAll;
        return () => {
            saveSettingsHandlerRef.current = null;
            discardSettingsHandlerRef.current = null;
        };
    }, [handleSaveAll, handleDiscardAll]);

    // حماية التنقل بين تبويبات الضبط الداخلية
    const [pendingSubTab, setPendingSubTab] = useState<SettingsTab | null>(null);
    const [isSubTabSaving, setIsSubTabSaving] = useState(false);

    const handleSubTabClick = (targetTab: SettingsTab) => {
        if (targetTab === activeTab) return;
        if (isDirty) {
            setPendingSubTab(targetTab);
            return;
        }
        setActiveTab(targetTab);
    };

    const handleConfirmSaveSubTab = async () => {
        setIsSubTabSaving(true);
        try {
            await handleSaveAll();
        } finally {
            setIsSubTabSaving(false);
            const target = pendingSubTab;
            setPendingSubTab(null);
            if (target) setActiveTab(target);
        }
    };

    const handleConfirmDiscardSubTab = () => {
        handleDiscardAll();
        const target = pendingSubTab;
        setPendingSubTab(null);
        if (target) setActiveTab(target);
    };

    // ---------- إعدادات الطباعة ----------
    const setDesign = (patch: Partial<PrintDesign>) => {
        setForm(prev => ({ ...prev, printDesign: { ...prev.printDesign, ...patch } as AppState['settings']['printDesign'] }));
    };

    const applyTemplate = (tpl: string) => {
        const next = applyTemplatePreset({ ...form.printDesign } as PrintDesign, tpl);
        setForm(prev => ({ ...prev, printDesign: next as any }));
        addToast(`${t('template_applied')}: ${t('template_' + normalizeTemplate(tpl))}`, 'info');
    };

    const handleLogoUpload = async (slot: 'front' | 'back', file?: File | null) => {
        if (!file) return;
        try {
            const dataUrl = await fileToLogoDataUrl(file);
            await saveLogoAsset(slot, { dataUrl, fileName: file.name, bytes: file.size, updatedAt: Date.now() });
            const patch = slot === 'front' ? { logoFrontDataUrl: dataUrl } : { logoBackDataUrl: dataUrl };
            const nextDesign = { ...form.printDesign, ...patch };
            updateSettings({ ...form, printDesign: nextDesign as any });
            addToast(t('logo_saved'), 'success');
        } catch (e: any) {
            const code = String(e?.message || e);
            addToast(code === 'too_big' ? t('logo_too_big') : code === 'type' ? t('logo_invalid_type') : t('logo_invalid'), 'error');
        }
    };

    const handleLogoRemove = async (slot: 'front' | 'back') => {
        await removeLogoAsset(slot);
        const patch = slot === 'front' ? { logoFrontDataUrl: undefined } : { logoBackDataUrl: undefined };
        updateSettings({ ...form, printDesign: { ...form.printDesign, ...patch } as any });
        addToast(t('logo_removed'), 'success');
    };

    const [printers, setPrinters] = useState([] as PrinterInfoLite[]);
    useEffect(() => {
        let alive = true;
        listPrinters().then(list => { if (alive) setPrinters(list); });
        return () => { alive = false; };
    }, []);

    const demoInvoice = useMemo(() => ({
        id: 1,
        locationId: state.settings.currentLocationId,
        customerId: 0,
        customerName: language === 'ar' ? 'عبدالرحمن فتحي العدلي' : 'Abdelrahman Fathy El-Adly',
        items: [
            { itemId: 'demo-1', name: language === 'ar' ? 'قص شعر' : 'Haircut', price: 100, quantity: 1, modifiers: [] },
        ],
        subtotal: 100,
        discountPercent: 10,
        taxPercent: 20,
        total: 108,
        date: '2026-10-29',
        timestamp: Date.now(),
        status: 'paid',
        paymentMethod: 'cash',
        createdBy: 'Admin',
    } as any), [language, state.settings.currentLocationId]);

    // =========================================================================
    // 1. تبويب بيانات المحل والفواتير (General)
    // =========================================================================
    
    const renderUpdates = () => (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
            {/* بطاقة التحديثات النظيفة والمحدثة */}
            <Card className="border border-white/5 bg-[#161B26] p-6 rounded-2xl shadow-sm">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-sm">
                            <RefreshCw size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>{language === 'ar' ? 'تحديثات نظام RaiZon Pro' : 'RaiZon Pro System Updates'}</span>
                            </h3>
                            <p className="text-xs text-[#94A3B8] mt-0.5">
                                {language === 'ar' 
                                    ? 'التحقق السريع من توفر ميزات وتحسينات جديدة' 
                                    : 'Check for latest features and enhancements'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1E293B] border border-white/5">
                        <span className="text-xs text-[#94A3B8] font-medium">{language === 'ar' ? 'الإصدار الحالي:' : 'Current Version:'}</span>
                        <span className="font-mono font-bold text-purple-300 text-sm">
                            v{appVersion}
                        </span>
                    </div>
                </div>

                {/* زر الفحص والحالة */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#1E293B]/60 border border-white/5 mb-5">
                    <div className="text-xs text-[#94A3B8]">
                        {language === 'ar' 
                            ? 'اضغط على زر التحقق لمعرفة ما إذا كان هناك إصدار جديد متوفر للتطبيق.' 
                            : 'Click to check if a new version is available.'}
                    </div>

                    <Button 
                        onClick={handleCheckForUpdates} 
                        disabled={updateChecking || updateDownloading} 
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                        <RefreshCw size={16} className={updateChecking ? 'animate-spin' : ''} />
                        <span>{updateChecking ? (language === 'ar' ? 'جارٍ التحقق...' : 'Checking...') : (language === 'ar' ? ' التحقق من وجود تحديث' : 'Check for Updates')}</span>
                    </Button>
                </div>

                {/* نتيجة الفحص */}
                {updateResult && (
                    <div className="space-y-4 animate-fade-in">
                        {updateResult.hasUpdate ? (
                            <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/40 shadow-lg space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 animate-bounce">
                                            {language === 'ar' ? 'إصدار جديد' : 'New Update'}
                                        </span>
                                        <h4 className="text-lg font-bold text-white">{updateResult.releaseName}</h4>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-900/80 border border-purple-400 text-purple-200 font-mono text-xs font-bold">
                                            v{updateResult.latestVersion}
                                        </span>
                                    </div>
                                </div>

                                {/* سجل التغييرات */}
                                {updateResult.releaseNotes && (
                                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                                        <p className="font-bold text-slate-400 mb-1">{language === 'ar' ? 'المميزات والتغييرات في هذا التحديث:' : 'Changelog:'}</p>
                                        <pre className="font-sans whitespace-pre-wrap leading-relaxed">{updateResult.releaseNotes}</pre>
                                    </div>
                                )}

                                {/* شريط التقدم عند التنزيل */}
                                {updateDownloading && (
                                    <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-purple-500/30">
                                        <div className="flex justify-between text-xs font-bold text-purple-300">
                                            <span>{language === 'ar' ? 'جارٍ تنزيل وتجهيز التحديث...' : 'Downloading update...'}</span>
                                            <span>{downloadPercent}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-purple-500/40">
                                            <div 
                                                className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                                                style={{ width: `${downloadPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* زر الإجراء */}
                                <div className="pt-2">
                                    <Button 
                                        onClick={handleDownloadUpdate} 
                                        disabled={updateDownloading}
                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-950 flex items-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        <span>{language === 'ar' ? 'تحديث وإعادة تشغيل التطبيق الآن' : 'Update & Restart App Now'}</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0"><Check size={16} /></span>
                                <div>
                                    <h4 className="text-sm font-bold text-emerald-300">
                                        {language === 'ar' ? 'أنت على أحدث إصدار من RaiZon Pro' : 'You are on the latest version of RaiZon Pro'}
                                    </h4>
                                    <p className="text-xs text-emerald-400/80 mt-0.5">
                                        {language === 'ar' 
                                            ? `الإصدار v${appVersion} يعمل بأحدث الميزات ومستقر بالكامل ولا توجد تحديثات جديدة حالياً.`
                                            : `Version v${appVersion} is the latest available release.`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );

    const renderGeneral = () => (
        <div className="space-y-5 animate-fade-in">
            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"><Building size={20} /></span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {language === 'ar' ? 'بيانات النشاط التجاري والاتصال' : 'Shop Information'}
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label={t('shop_name')} value={form.shopName} onChange={(e:any)=>setForm({...form, shopName: e.target.value})} />
                    <Input label={t('phone')} value={form.phone} onChange={(e:any)=>setForm({...form, phone: e.target.value})} />
                    <Input label={t('address')} value={form.address} onChange={(e:any)=>setForm({...form, address: e.target.value})} />
                </div>
            </Card>

            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><FileText size={20} /></span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {language === 'ar' ? 'إعدادات الفواتير الافتراضية' : 'Default Invoicing Settings'}
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <Input label={t('default_discount_percent')} type="number" value={form.defaultDiscountPercent} onChange={(e:any)=>setForm({...form, defaultDiscountPercent: parseFloat(e.target.value || 0)})} />
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 cursor-pointer">
                            <input type="checkbox" checked={form.autoApplyDiscount} onChange={(e:any)=>setForm({...form, autoApplyDiscount: e.target.checked})} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                            <span>{t('auto_apply_discount')}</span>
                        </label>
                    </div>
                    <div>
                        <Input label={t('default_tax_percent')} type="number" value={form.defaultTaxPercent} onChange={(e:any)=>setForm({...form, defaultTaxPercent: parseFloat(e.target.value || 0)})} />
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 cursor-pointer">
                            <input type="checkbox" checked={form.autoApplyTax} onChange={(e:any)=>setForm({...form, autoApplyTax: e.target.checked})} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                            <span>{t('auto_apply_tax')}</span>
                        </label>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"><Sun size={20} /></span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {language === 'ar' ? 'المظهر وتنسيق الوقت' : 'Appearance & Time Format'}
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            {t('time_format') || (language === 'ar' ? 'نظام عرض الوقت' : 'Time Format')}
                        </label>
                        <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-600 p-1 bg-slate-100 dark:bg-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(prev => ({ ...prev, timeFormat: '12h' }));
                                }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                    (form.timeFormat || '12h') === '12h'
                                        ? 'bg-primary-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                {t('time_format_12h') || '12 ساعة (02:47PM)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(prev => ({ ...prev, timeFormat: '24h' }));
                                }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                    form.timeFormat === '24h'
                                        ? 'bg-primary-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                {t('time_format_24h') || '24 ساعة (14:47)'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{t('theme_color')}</label>
                        <div className="flex gap-3 flex-wrap">
                            {[
                                { id: 'blue', color: '#0ea5e9', nameAr: 'أزرق سماوي' },
                                { id: 'ocean', color: '#06b6d4', nameAr: 'محيطي' },
                                { id: 'sunset', color: '#f97316', nameAr: 'غروب برتقالي' },
                                { id: 'forest', color: '#22c55e', nameAr: 'زمردي' },
                                { id: 'midnight', color: '#8b5cf6', nameAr: 'ليلي بنفسجي' },
                                { id: 'luxury', color: '#CA8A04', nameAr: 'ذهبي فاخر' }
                            ].map(theme => (
                                <button 
                                    key={theme.id}
                                    onClick={() => setForm({...form, themeColor: theme.id as any})}
                                    className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${form.themeColor === theme.id ? 'border-slate-800 dark:border-white scale-110 shadow-md' : 'border-transparent'}`}
                                    title={theme.nameAr}
                                >
                                    <div className="w-7 h-7 rounded-full" style={{ backgroundColor: theme.color }}></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button onClick={save} className="px-6 py-2.5 font-bold shadow-xs">{t('save')}</Button>
            </div>
        </div>
    );

    // =========================================================================
    // 2. تبويب إشعارات البريد والمدير (Email)
    // =========================================================================
    const renderEmail = () => (
        <div className="space-y-5 animate-fade-in">
            <Card>
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"><Bell size={20} /></span>
                            <span>{language === 'ar' ? 'إشعارات البريد الإلكتروني للمدير (Gmail)' : 'Manager Gmail Notifications'}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {language === 'ar'
                                ? 'إرسال تفاصيل الفواتير وتقارير إقفال الوردية تلقائياً إلى جيميل المدير فور حدوثها.'
                                : 'Automatically send new invoices and daily closing reports to the manager via Gmail.'}
                        </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{language === 'ar' ? 'سيرفر الإرسال معتمد وجاهز' : 'Dispatch Ready'}</span>
                    </span>
                </div>

                {/* بطاقة البريد المعتمد المدمج في النظام */}
                <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-primary-50/80 via-sky-50/40 to-slate-50/60 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-800/60 border border-primary-200/60 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
                            
                        </div>
                        <div>
                            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                                {language === 'ar' ? 'بريد الإرسال الرسمي المدمج بالنظام:' : 'Official Dispatch Email:'}
                            </p>
                            <p className="text-sm font-mono font-bold text-primary-700 dark:text-primary-300">
                                rizon.pro.app@gmail.com
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50">
                        {language === 'ar' ? 'مدمج ومعتمد أساسياً' : 'Pre-configured'}
                    </span>
                </div>

                {/* الحقل الوحيد المطلوب من المدير */}
                <div className="p-4 rounded-2xl border-2 border-primary-500/40 bg-white dark:bg-slate-800/80 shadow-xs space-y-3">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <User size={16} className="text-slate-400 shrink-0" />
                            <span>{language === 'ar' ? 'بريد جيميل المدير لاستقبال الإشعارات (المستلم):' : "Manager's Receiving Gmail (Recipient):"}</span>
                        </span>
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-0.5 rounded-full border border-primary-200/50">
                            {language === 'ar' ? 'المطلوب الوحيد' : 'Only Field Required'}
                        </span>
                    </label>

                    <div className="relative">
                        <input
                            type="email"
                            placeholder="manager@gmail.com"
                            value={emailConfig.emailTo}
                            onChange={(e) => setEmailConfig(prev => ({ ...prev, emailTo: e.target.value.trim() }))}
                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                        />
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {language === 'ar'
                            ? 'اكتب هنا إيميل الجيميل الخاص بك كمدير لتصلك عليه إشعارات الفواتير فوراً على هاتفك، وتقرير تقفيل اليومية والمصروفات والأرباح تلقائياً.'
                            : 'Enter your Gmail address here. You will instantly receive new invoice alerts and daily closing summaries directly on your phone.'}
                    </p>
                </div>

                {/* شبكة خيارات تفعيل الإشعارات الفورية لكل الخدمات */}
                <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {language === 'ar' ? 'اختر الإشعارات الفورية المطلوب استلامها فور حدوثها:' : 'Instant Alerts to receive in real-time:'}
                        </label>
                        <span className="text-[11px] text-slate-500 font-bold">
                            {language === 'ar' ? 'جميع الإشعارات بنمط فخم موحد وتصميم احترافي' : 'Luxury unified dark theme'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 1. الفواتير */}
                        <div className={`p-3.5 rounded-xl border transition-all ${emailConfig.notifyOnInvoice ? 'bg-primary-50/50 border-primary-300/80 dark:bg-primary-950/20 dark:border-primary-700/60' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={emailConfig.notifyOnInvoice}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, notifyOnInvoice: e.target.checked }))}
                                    className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <FileText size={16} className="text-slate-400 shrink-0" />
                                        <span>{language === 'ar' ? 'فواتير المبيعات الجديدة' : 'New Sales Invoices'}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        {language === 'ar' ? 'إشعار فوري عند إصدار كل فاتورة بيع مع الأصناف وطريقة الدفع والعميل.' : 'Instant alert on every new invoice with items, cashier & payment method.'}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* 2. تقفيل الوردية */}
                        <div className={`p-3.5 rounded-xl border transition-all ${emailConfig.notifyOnClosing ? 'bg-primary-50/50 border-primary-300/80 dark:bg-primary-950/20 dark:border-primary-700/60' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={emailConfig.notifyOnClosing}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, notifyOnClosing: e.target.checked }))}
                                    className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <Lock size={16} className="text-slate-400 shrink-0" />
                                        <span>{language === 'ar' ? 'تقفيل الوردية اليومية (Z-Report)' : 'Shift Closing (Z-Report)'}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        {language === 'ar' ? 'تقرير مفصل بإجمالي المبيعات، النقدية، المصروفات، والعجز أو الزيادة بالدرج.' : 'Detailed report with total cash, expenses, and drawer variance.'}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* 3. المرتجعات */}
                        <div className={`p-3.5 rounded-xl border transition-all ${emailConfig.notifyOnReturn ? 'bg-primary-50/50 border-primary-300/80 dark:bg-primary-950/20 dark:border-primary-700/60' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={emailConfig.notifyOnReturn}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, notifyOnReturn: e.target.checked }))}
                                    className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <RefreshCw size={16} className="text-slate-400 shrink-0" />
                                        <span>{language === 'ar' ? 'المرتجعات واسترداد المبالغ' : 'Refunds & Returns'}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        {language === 'ar' ? 'تنبيه فوري عند استرجاع أي صنف أو إعادة نقدية للعميل مع بيان السبب.' : 'Instant alert on any returned items or refunds with reason.'}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* 4. المصروفات النقدية */}
                        <div className={`p-3.5 rounded-xl border transition-all ${emailConfig.notifyOnExpense ? 'bg-primary-50/50 border-primary-300/80 dark:bg-primary-950/20 dark:border-primary-700/60' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={emailConfig.notifyOnExpense}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, notifyOnExpense: e.target.checked }))}
                                    className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <Wallet size={16} className="text-slate-400 shrink-0" />
                                        <span>{language === 'ar' ? 'المصروفات والسحب من الخزينة' : 'Drawer Cash Expenses'}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                        {language === 'ar' ? 'إشعار عند تسجيل أي مصروف نقدي أو فواتير صيانة ونثريات من الدرج.' : 'Alert on any cash expense or petty cash deduction from drawer.'}
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* أزرار الحفظ وتجربة الخدمات */}
                <div className="mt-5 pt-4 border-t border-slate-700/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleSaveEmailConfig}
                            disabled={isSavingEmail || !emailConfig.emailTo}
                            className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                        >
                            <Save size={16} className="text-slate-400 shrink-0" />
                            <span>{isSavingEmail ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ بريد المدير وتحديث الإشعارات' : 'Save & Update Alerts')}</span>
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 ml-1">
                                {language === 'ar' ? 'إرسال تجربة فورية:' : 'Quick Test:'}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleSendTestEmail('invoice')}
                                disabled={isTestingEmail || !emailConfig.emailTo}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {language === 'ar' ? 'فاتورة' : 'Invoice'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendTestEmail('closing')}
                                disabled={isTestingEmail || !emailConfig.emailTo}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {language === 'ar' ? 'تقفيل' : 'Closing'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendTestEmail('return')}
                                disabled={isTestingEmail || !emailConfig.emailTo}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {language === 'ar' ? 'مرتجع' : 'Return'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSendTestEmail('expense')}
                                disabled={isTestingEmail || !emailConfig.emailTo}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {language === 'ar' ? 'مصروف' : 'Expense'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* نتيجة التجربة */}
                {testEmailResult && (
                    <div className={`mt-3 p-3.5 rounded-xl text-xs font-bold border ${
                        testEmailResult.status === 'sent' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200' 
                            : testEmailResult.status === 'simulated'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200'
                    }`}>
                        {testEmailResult.status === 'sent' && (language === 'ar' ? 'تم إرسال البريد التجريبي بنجاح! راجع صندوق بريد المدير الآن للتأكد.' : 'Test email delivered successfully!')}
                        {testEmailResult.status === 'simulated' && (language === 'ar' ? 'وضع محاكاة: احفظ إيميل المدير أولاً للتفعيل الفعلي.' : 'Simulation mode.')}
                        {testEmailResult.status === 'failed' && `${language === 'ar' ? 'خطأ في الإرسال: ' : 'Failed: '}${testEmailResult.error || ''}`}
                    </div>
                )}
            </Card>
        </div>
    );

    // =========================================================================
    // =========================================================================
    const renderLoyalty = () => (
        <div className="space-y-5 animate-fade-in">
            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"><Award size={20} /></span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {t('loyalty_settings')}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex items-center gap-2 py-2">
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input type="checkbox" className="sr-only peer" checked={form.loyaltyEnabled} onChange={(e:any)=>setForm({...form, loyaltyEnabled: e.target.checked})} />
                            <div className="relative w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full dark:bg-slate-700 peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            <span className="mx-3 text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                                {t('loyalty_program')} 
                                <span className={`text-xs mx-4 px-2.5 py-1 rounded-full font-bold ${form.loyaltyEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {form.loyaltyEnabled ? t('active') : t('inactive')}
                                </span>
                            </span>
                        </label>
                    </div>

                    <Input label={t('loyalty_min_spend')} type="number" value={form.loyaltyMinSpend} onChange={(e:any)=>setForm({...form, loyaltyMinSpend: parseFloat(e.target.value || 0)})} />
                    <Input label={t('loyalty_points_award')} type="number" value={form.loyaltyPointsAward} onChange={(e:any)=>setForm({...form, loyaltyPointsAward: parseFloat(e.target.value || 0)})} />
                    <Input label={t('loyalty_redeem_rate')} type="number" value={form.loyaltyRedeemRate} onChange={(e:any)=>setForm({...form, loyaltyRedeemRate: parseFloat(e.target.value || 0)})} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <Button 
                        variant="danger" 
                        onClick={() => {
                            if (confirm(t('confirm_reset_loyalty'))) {
                                resetLoyaltyPoints();
                            }
                        }}
                        className="text-xs"
                    >
                        <Trash2 size={16} /> {t('reset_loyalty_btn')}
                    </Button>

                    <Button onClick={save} className="px-6 py-2.5 font-bold shadow-xs">{t('save')}</Button>
                </div>
            </Card>
        </div>
    );

    // =========================================================================
    // 4. تبويب الشبكة والمزامنة (Sync & Network)
    // =========================================================================
    const renderSync = () => (
        <div className="space-y-5 animate-fade-in">
            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"><Globe size={20} /></span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('server_sync')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('server_sync_hint')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label={t('server_url')} value={form.serverUrl || 'http://127.0.0.1:8087'} placeholder="http://127.0.0.1:8087" onChange={(e:any)=>setForm({...form, serverUrl: e.target.value})} />
                    <Input label={t('server_api_key')} value={form.serverApiKey || ''} onChange={(e:any)=>setForm({...form, serverApiKey: e.target.value})} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-700/60">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleTestServer}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                            <Wifi size={16} /> {t('test_connection')}
                        </button>
                        {serverTest && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${serverTest.ok ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                                {serverTest.ok ? t('server_connected') : t('server_failed')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSyncNow}
                            disabled={syncingNow}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50 text-xs font-bold"
                        >
                            <RefreshCw size={16} className={syncingNow ? 'animate-spin' : ''} /> {t('sync_now')}
                        </button>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${pendingCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                            {pendingCount > 0 ? `${pendingCount} ${t('pending_sync')}` : t('sync_done')}
                        </span>
                    </div>
                </div>

                {serverTest?.ok && (serverTest.lanUrls?.length || 0) > 0 && (
                    <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{t('server_suggested_urls')}</p>
                        <div className="flex flex-wrap gap-2">
                            {serverTest.lanUrls!.map(url => (
                                <button
                                    key={url}
                                    type="button"
                                    title={t('server_phone_hint')}
                                    onClick={() => {
                                        setForm(prev => ({ ...prev, serverUrl: url }));
                                        navigator.clipboard?.writeText(url);
                                        addToast(`${t('copied')}: ${url}`, 'success');
                                    }}
                                    className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary-400 hover:text-primary-600 transition-colors cursor-pointer"
                                >
                                    {url}
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">{t('server_phone_hint')}</p>
                    </div>
                )}

                {qr.dataUrl && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">{t('server_qr_title')}</p>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <img src={qr.dataUrl} alt="server QR" className="w-32 h-32 rounded-xl bg-white p-1.5 border border-slate-200 dark:border-slate-600 shadow-xs" />
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
                                <p>{t('server_qr_hint')}</p>
                                <p className="font-mono break-all text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-700 p-2 rounded-lg">{qr.text}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(qr.text);
                                        addToast(`${t('copied')}`, 'success');
                                    }}
                                    className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors font-bold cursor-pointer"
                                >
                                    {t('copy')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end mt-4 pt-3 border-t border-slate-700/60">
                    <Button onClick={save} className="px-6 py-2.5 font-bold shadow-xs">{t('save')}</Button>
                </div>
            </Card>
        </div>
    );

    // =========================================================================
    // 5. تبويب النسخ الاحتياطي والأمان (Backup & Security)
    // =========================================================================
    const renderSecurity = () => (
        <div className="space-y-6 animate-fade-in">
            {/* بطاقة مركز النسخ الاحتياطي الذكي (محلي + سحابي) */}
            <Card className="border border-primary-500/30 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-md">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-5 pb-4 border-b border-slate-700/60">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-2xl shadow-md">
                            
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <span>{language === 'ar' ? 'مركز النسخ الاحتياطي (محلي + سحابي على الإيميل)' : 'Smart Cloud & Local Backup Center'}</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                                    {language === 'ar' ? 'مجلد Backup نشط ومحمي' : 'Backup Folder Active'}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {language === 'ar'
                                    ? 'يتم تخزين كامل بيانات وفواتير المحل تلقائياً في مجلد Backup، وإرسال ملف النسخة مباشرة لإيميل المدير على Gmail كنسخة سحابية مضمونة.'
                                    : 'All shop data and invoices are automatically saved in the Backup folder, and attached directly to the manager Gmail.'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={fetchBackupFiles}
                        disabled={isLoadingBackups}
                        className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-600"
                    >
                        <RefreshCw size={14} className={isLoadingBackups ? 'animate-spin' : ''} />
                        <span>{language === 'ar' ? 'تحديث القائمة' : 'Refresh'}</span>
                    </button>
                </div>

                {/* الزر الرئيسي للنسخ الاحتياطي المزدوج */}
                <div className="p-4 rounded-2xl bg-slate-800/90 dark:bg-slate-800/95 border border-primary-500/40 shadow-sm mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                            
                            <span className="text-slate-100">{language === 'ar' ? 'النسخ الفوري الشامل بضغطة واحدة:' : 'One-Click Full Backup:'}</span>
                        </div>
                        <p className="text-xs text-slate-300 dark:text-slate-300">
                            {language === 'ar'
                                ? `يقوم بتوليد ملف JSON في مجلد Backup، وإرساله مرفقاً في إيميل رسمي فاخر إلى ${emailConfig.emailTo || 'إيميل المدير'}.`
                                : 'Generates a JSON file in the Backup folder and emails it as an attachment to the manager.'}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleCreateBackupNow}
                        disabled={backupBusy}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                        <Save size={16} className="text-slate-400 shrink-0" />
                        <span>{backupBusy ? (language === 'ar' ? 'جارٍ الحفظ والإرسال...' : 'Backing up...') : (language === 'ar' ? 'إنشاء نسخة احتياطية الآن (محلي + سحابي)' : 'Backup Now (Local + Cloud)')}</span>
                    </button>
                </div>

                {/* خيار النسخ التلقائي عند التقفيل */}
                <div className="p-3.5 rounded-xl border border-slate-700/80 bg-slate-800/60 dark:bg-slate-800/70 mb-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.autoBackupOnClosing ?? true}
                            onChange={(e) => {
                                setForm(prev => ({ ...prev, autoBackupOnClosing: e.target.checked }));
                            }}
                            className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 cursor-pointer accent-primary-600"
                        />
                        <div className="space-y-0.5">
                            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                <Lock size={16} className="text-slate-400 shrink-0" />
                                <span>{language === 'ar' ? 'نسخ احتياطي تلقائي سحابي ومحلي عند كل إقفال وردية (Closing Z-Report)' : 'Auto Cloud & Local Backup on Shift Closing'}</span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                {language === 'ar'
                                    ? 'يقوم النظام بحفظ نسخة جديدة تلقائياً في مجلد Backup وإرسالها فوراً لبريد المدير مع تقرير إغلاق اليومية بدون أي تدخل يدوي.'
                                    : 'Automatically creates a backup in Backup folder and emails it to the manager with the daily closing report.'}
                            </p>
                        </div>
                    </label>
                </div>

                {/* أدوات إضافية: تنزيل واستعادة يدوية */}
                <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-700/60">
                    <button
                        type="button"
                        onClick={() => {
                            const currentEmailConfig = {
                                emailTo: emailConfig.emailTo || form.managerEmail || '',
                                notifyOnInvoice: emailConfig.notifyOnInvoice,
                                notifyOnClosing: emailConfig.notifyOnClosing,
                                notifyOnReturn: emailConfig.notifyOnReturn,
                                notifyOnExpense: emailConfig.notifyOnExpense,
                                smtpUser: emailConfig.smtpUser || 'rizon.pro.app@gmail.com'
                            };
                            const backupPayload = {
                                ...state,
                                managerEmail: currentEmailConfig.emailTo,
                                emailConfig: currentEmailConfig,
                                settings: {
                                    ...state.settings,
                                    ...form,
                                    managerEmail: currentEmailConfig.emailTo,
                                    emailConfig: currentEmailConfig
                                }
                            };
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
                            const downloadAnchorNode = document.createElement('a');
                            downloadAnchorNode.setAttribute("href", dataStr);
                            downloadAnchorNode.setAttribute("download", "procashier_backup_" + new Date().toISOString().split('T')[0] + ".json");
                            document.body.appendChild(downloadAnchorNode);
                            downloadAnchorNode.click();
                            downloadAnchorNode.remove();
                            addToast(t('backup_created'), 'success');
                        }}
                        className="px-4 py-2.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-600"
                    >
                        <FileText size={15} className="text-primary-400" />
                        <span>{language === 'ar' ? 'تحميل كملف JSON للمتصفح' : 'Download JSON file'}</span>
                    </button>

                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleRestoreFromLocalFileInput}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={handleTriggerFileRestore}
                        className="px-4 py-2.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-600"
                    >
                        <Package size={16} className="text-slate-400 shrink-0" />
                        <span>{language === 'ar' ? 'استعادة من ملف خارجي (.json)' : 'Restore from external file'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (confirm(t('confirm_system_reset'))) {
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", "procashier_pre_reset_backup_" + new Date().toISOString().split('T')[0] + ".json");
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                                resetSystem();
                            }
                        }}
                        className="px-4 py-2 border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs mr-auto"
                    >
                        <AlertCircle size={15} />
                        <span>{t('restore_defaults')}</span>
                    </button>
                </div>
            </Card>

            {/* جدول النسخ الاحتياطية المتوفرة في مجلد Backup */}
            <Card>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><Package size={20} /></span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {language === 'ar' ? 'النسخ المحفوظة في مجلد Backup' : 'Files in Backup folder'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {language === 'ar' ? 'مسار المجلد: D:\\abdelrhman\\win\\pro casher\\Backup' : 'Folder path: ./Backup'}
                            </p>
                        </div>
                    </div>
                    <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl shadow-xs">
                        {backupFiles.length} {language === 'ar' ? 'نسخ محفوظة' : 'backups'}
                    </span>
                </div>

                {isLoadingBackups ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{language === 'ar' ? 'جارٍ قراءة مجلد Backup...' : 'Reading Backup folder...'}</span>
                    </div>
                ) : backupFiles.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                        {language === 'ar' ? 'لا توجد نسخ سابقة في المجلد. اضغط "إنشاء نسخة احتياطية الآن" لإنشاء أول نسخة.' : 'No backup files found in Backup folder.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                                    <th className="py-2.5 px-3">{language === 'ar' ? 'اسم الملف' : 'Filename'}</th>
                                    <th className="py-2.5 px-3">{language === 'ar' ? 'الحجم' : 'Size'}</th>
                                    <th className="py-2.5 px-3">{language === 'ar' ? 'تاريخ ووقت الحفظ' : 'Saved Date'}</th>
                                    <th className="py-2.5 px-3 text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                {backupFiles.map((bf) => (
                                    <tr key={bf.filename} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400 shrink-0" />
                                            <span>{bf.filename}</span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono font-bold">
                                            {bf.size_kb} KB
                                        </td>
                                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                            {bf.date_str}
                                        </td>
                                        <td className="py-3 px-3 text-left">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestoreBackupFile(bf.filename)}
                                                    disabled={backupBusy}
                                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 font-bold text-[11px] border border-amber-300/50 transition-all cursor-pointer"
                                                >
                                                    {language === 'ar' ? 'استعادة' : 'Restore'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadBackupFile(bf.filename)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-650 dark:text-slate-200 font-bold text-[11px] border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
                                                >
                                                    ⬇️ {language === 'ar' ? 'تحميل' : 'Download'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* بطاقة أمان كلمة المرور ورمز PIN */}
            <Card>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"><Key size={20} /></span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('security_section')}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('change_password')} — {currentUser?.username}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <Input label={t('current_password')} type="password" value={pwCurrent} onChange={(e:any)=>setPwCurrent(e.target.value)} />
                    <Input label={t('new_password')} type="password" value={pwNew} onChange={(e:any)=>setPwNew(e.target.value)} />
                    <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={secBusy || !pwCurrent || pwNew.length < 6}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold disabled:opacity-40 transition-opacity text-xs"
                    >
                        {t('change_password')}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-5 pt-4 border-t border-slate-700/60">
                    <Input
                        label={t('quick_pin_new')}
                        type="password"
                        inputMode="numeric"
                        value={pinValue}
                        placeholder={currentUser?.pinHash ? t('quick_pin_active') : t('quick_pin_none')}
                        onChange={(e:any)=>setPinValue(String(e.target.value).replace(/\D/g, '').slice(0, 6))}
                    />
                    <button
                        type="button"
                        onClick={handleSavePin}
                        disabled={secBusy || !pwCurrent || pinValue.length < 4}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 transition-opacity text-xs"
                    >
                        {t('save')}
                    </button>
                    {currentUser?.pinHash && (
                        <button
                            type="button"
                            onClick={handleClearPin}
                            disabled={secBusy || !pwCurrent}
                            className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold disabled:opacity-40 transition-opacity text-xs"
                        >
                            {t('clear_quick_pin')}
                        </button>
                    )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">{t('force_password_hint')}</p>
            </Card>
        </div>
    );

    // =========================================================================
    // 6. تبويب الطباعة وتصميم الفواتير (Print)
    // =========================================================================
    const renderPrint = () => {
        const d = normalizePrintDesign(form.printDesign);
        const selectCls = 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs';

        const PRESET_OPTIONS: { id: TemplateId; name: string; desc: string; pageSize: string }[] = [
            { id: 'thermal', name: language === 'ar' ? 'حراري بون (Thermal 80mm)' : 'Thermal 80mm', desc: language === 'ar' ? 'الأفضل لطابعات الكاشير السريعة' : 'Fast thermal receipts', pageSize: '80mm' },
            { id: 'classic', name: language === 'ar' ? 'كلاسيكي (Classic A4)' : 'Classic A4', desc: language === 'ar' ? 'فاتورة رسمية كاملة بتنسيق تقليدي' : 'Full traditional invoice', pageSize: 'A4' },
            { id: 'professional', name: language === 'ar' ? 'احترافي (Professional)' : 'Professional', desc: language === 'ar' ? 'تصميم حديث للشركات والمحلات' : 'Modern business layout', pageSize: 'A4' },
            { id: 'luxury', name: language === 'ar' ? 'فاخر ذهبي (Luxury)' : 'Luxury', desc: language === 'ar' ? 'طابع ذهبي فاخر للمتاجر الراقية' : 'Gold luxury invoice', pageSize: 'A4' },
            { id: 'modern', name: language === 'ar' ? 'عصري (Modern 80mm)' : 'Modern 80mm', desc: language === 'ar' ? 'تصميم أنيق وبسيط بلمسات ملونة' : 'Clean stylish receipt', pageSize: '80mm' },
            { id: 'minimal', name: language === 'ar' ? 'موجز (Minimal)' : 'Minimal', desc: language === 'ar' ? 'فاتورة مقتضبة توفر ورق الطباعة' : 'Compact paper saver', pageSize: '80mm' },
        ];

        return (
            <div className="space-y-6 animate-fade-in">
                {/* بيانات هوية المحل على الإيصال */}
                <Card>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"><Building size={20} /></span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {language === 'ar' ? 'هوية المحل المطبوعة على الإيصال' : 'Receipt Shop Identity'}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={t('identity_shop_name')}
                            value={form.shopName}
                            onChange={(e: any) => setForm({ ...form, shopName: e.target.value })}
                        />
                        <Input
                            label={t('identity_phone')}
                            value={form.phone}
                            onChange={(e: any) => setForm({ ...form, phone: e.target.value })}
                        />
                        <div className="md:col-span-2">
                            <Input
                                label={t('identity_address')}
                                value={form.address}
                                onChange={(e: any) => setForm({ ...form, address: e.target.value })}
                            />
                        </div>
                    </div>
                </Card>

                {/* اختيار قالب الفاتورة */}
                <Card>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"><Settings size={20} /></span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {language === 'ar' ? 'قوالب وتنسيق الإيصال' : 'Receipt Templates'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {language === 'ar' ? 'اختر نمط الفاتورة المناسب لنشاطك التجاري وطابعتك' : 'Select the best layout for your printer'}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {PRESET_OPTIONS.map((p) => {
                            const active = normalizeTemplate(d.template) === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => applyTemplate(p.id)}
                                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
                                        active
                                            ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/50 dark:bg-primary-950/30'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{p.name}</span>
                                        {active && <span className="flex items-center gap-1 text-xs bg-primary-600 text-white px-2.5 py-0.5 rounded-full font-bold"><Check size={12} /><span>نشط</span></span>}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{p.desc}</p>
                                    <span className="inline-block text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold">
                                        مقاس {p.pageSize}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Card>

                {/* مقاس الورق والهوامش */}
                <Card>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><Printer size={20} /></span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {language === 'ar' ? 'إعدادات الورق والطباعة' : 'Paper Setup'}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                {language === 'ar' ? 'مقاس الورق' : 'Page Size'}
                            </label>
                            <select
                                className={selectCls}
                                value={d.pageSize}
                                onChange={(e) => setDesign({ pageSize: e.target.value as any })}
                            >
                                {PAGE_SIZES.map((sz) => (
                                    <option key={sz.id} value={sz.id}>
                                        {sz.id} ({sz.widthMm}mm) {sz.id === '80mm' ? '(الموصى به للإيصالات)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                {language === 'ar' ? 'الهامش الجانبي' : 'Margin'} ({d.marginMm} mm)
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={20}
                                value={d.marginMm}
                                onChange={(e) => setDesign({ marginMm: Number(e.target.value) })}
                                className="w-full accent-primary-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                {language === 'ar' ? 'حجم الخط الأساسي' : 'Base Font'} ({d.baseFontSize} pt)
                            </label>
                            <input
                                type="range"
                                min={8}
                                max={16}
                                value={d.baseFontSize}
                                onChange={(e) => setDesign({ baseFontSize: Number(e.target.value) })}
                                className="w-full accent-primary-600"
                            />
                        </div>
                    </div>
                </Card>

                {/* نصوص الفاتورة */}
                <Card>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"><FileText size={20} /></span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {language === 'ar' ? 'النصوص المخصصة والترحيب' : 'Custom Headers & Footers'}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label={language === 'ar' ? 'عنوان الإيصال الرئيسي' : 'Header Title'}
                            value={d.titleText}
                            placeholder={form.shopName || 'فاتورة ضريبية مبسطة'}
                            onChange={(e: any) => setDesign({ titleText: e.target.value })}
                        />
                        <Input
                            label={language === 'ar' ? 'تذييل الفاتورة (الوداع والشكر)' : 'Footer Text'}
                            value={d.footerText}
                            placeholder={language === 'ar' ? 'شكراً لزيارتكم - نتمنى لكم يوماً سعيداً' : 'Thank you for your visit!'}
                            onChange={(e: any) => setDesign({ footerText: e.target.value })}
                        />
                    </div>
                </Card>

                {/* شعار الفاتورة */}
                <Card>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"><Eye size={20} /></span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {language === 'ar' ? 'شعار النشاط التجاري (اللوجو)' : 'Shop Logo'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {language === 'ar' ? 'يظهر الشعار في أعلى الفاتورة المطبوعة' : 'Displayed at the top of the printed receipt'}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                            <p className="font-bold text-xs mb-2 text-slate-700 dark:text-slate-300">{language === 'ar' ? 'شعار الفاتورة الرئيسي (أعلى الإيصال)' : 'Header Logo'}</p>
                            {d.logoFrontDataUrl ? (
                                <div className="space-y-3">
                                    <img src={d.logoFrontDataUrl} alt="Logo" className="max-h-24 mx-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-white" />
                                    <button
                                        type="button"
                                        onClick={() => handleLogoRemove('front')}
                                        className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                                    >
                                        {language === 'ar' ? 'حذف الشعار' : 'Remove Logo'}
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer inline-block px-4 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-100 text-slate-800 dark:text-slate-200 shadow-xs">
                                    {language === 'ar' ? 'رفع شعار من الجهاز' : 'Upload Logo'}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => handleLogoUpload('front', e.target.files?.[0])}
                                    />
                                </label>
                            )}
                        </div>

                        <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 text-center">
                            <p className="font-bold text-xs mb-2 text-slate-700 dark:text-slate-300">{language === 'ar' ? 'علامة مائية خلفية (اختياري)' : 'Watermark Logo'}</p>
                            {d.logoBackDataUrl ? (
                                <div className="space-y-3">
                                    <img src={d.logoBackDataUrl} alt="Watermark" className="max-h-24 mx-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-white" />
                                    <button
                                        type="button"
                                        onClick={() => handleLogoRemove('back')}
                                        className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                                    >
                                        {language === 'ar' ? 'حذف العلامة المائية' : 'Remove Watermark'}
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer inline-block px-4 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold hover:bg-slate-100 text-slate-800 dark:text-slate-200 shadow-xs">
                                    {language === 'ar' ? 'رفع علامة مائية' : 'Upload Watermark'}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => handleLogoUpload('back', e.target.files?.[0])}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </Card>

                {/* المعاينة الحية للإيصال */}
                <Card>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"><Eye size={20} /></span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {language === 'ar' ? 'المعاينة الحية المباشرة لشكل الإيصال' : 'Live Receipt Preview'}
                            </h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                            {d.pageSize} • {normalizeTemplate(d.template)}
                        </span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-900/80 p-6 rounded-2xl flex justify-center overflow-x-auto border border-slate-200 dark:border-slate-800">
                        <div 
                            className="bg-white text-black shadow-2xl rounded-xl overflow-hidden border border-slate-300 transition-all duration-200" 
                            style={{ width: d.pageSize === '58mm' ? '280px' : d.pageSize === '80mm' ? '360px' : '520px' }}
                        >
                            <InvoiceReceipt
                                demo={true}
                                invoice={demoInvoice}
                                designOverride={d}
                                identityOverride={{ shopName: form.shopName, phone: form.phone, address: form.address }}
                            />
                        </div>
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                        <Settings size={22} />
                    </span>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('settings')}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? 'إدارة وضبط خيارات النظام والشاشات' : 'System preferences & configurations'}
                        </p>
                    </div>
                </div>

                <Button onClick={save} className="px-5 py-2.5 font-bold shadow-xs">
                    {t('save')}
                </Button>
            </div>

                        {/* نافذة تأكيد حفظ التعديلات عند الانتقال بين تبويبات الضبط */}
            <UnsavedChangesModal
                isOpen={!!pendingSubTab}
                onSave={handleConfirmSaveSubTab}
                onDiscard={handleConfirmDiscardSubTab}
                onCancel={() => setPendingSubTab(null)}
                isSaving={isSubTabSaving}
            />

            {/* شريط التبويبات الحديث الموحد والمنظم */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-x-auto scrollbar-thin">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleSubTabClick(tab.id as SettingsTab)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-150 cursor-pointer ${
                                isActive
                                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200/80 dark:border-slate-600'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/40'
                            }`}
                        >
                            <tab.icon size={16} className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
                            <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
                        </button>
                    );
                })}
            </div>

            {/* محتوى التبويب المختار */}
            {activeTab === 'general' && renderGeneral()}
            {activeTab === 'email' && renderEmail()}
            {activeTab === 'print' && (
                <ErrorBoundary fallbackTitle="حدث خطأ أثناء عرض إعدادات الطباعة والتصميم">
                    {renderPrint()}
                </ErrorBoundary>
            )}
                                    {activeTab === 'security' && renderSecurity()}
            {activeTab === 'users' && <AdminUsers />}
            {activeTab === 'logs' && <AuditLogs />}
            {activeTab === 'updates' && renderUpdates()}
        </div>
    );
};
