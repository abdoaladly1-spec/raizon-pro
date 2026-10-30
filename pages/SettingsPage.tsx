/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier, AppState } from '../types';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { fileToLogoDataUrl, saveLogoAsset, removeLogoAsset } from '../lib/assets';
import { listPrinters, type PrinterInfoLite } from '../lib/printBridge';
import { PAGE_SIZES, ELEMENT_ORDER, TEMPLATE_PRESETS, applyTemplatePreset, normalizeTemplate, DEFAULT_ELEMENTS, type PrintDesign } from '../lib/printDesign';

export const SettingsPage = () => {
    const { state, t, language, updateSettings, addItem, updateItem, deleteItem, currentUser, resetSystem, restoreState, resetLoyaltyPoints, addToast } = useApp();
    const [activeTab, setActiveTab] = useState('general' as 'general' | 'items' | 'users' | 'logs' | 'print');
    const [form, setForm] = useState(state.settings);

    // مزامنة تلقائية: أي تغيير في الإعدادات من أي قسم/صفحة ينعكس هنا فوراً
    useEffect(() => {
        setForm(state.settings);
    }, [state.settings]);

    const [serverTest, setServerTest] = useState(null as null | { ok: boolean; message: string; lanUrls?: string[] });
    const [pendingCount, setPendingCount] = useState(0);
    const [syncingNow, setSyncingNow] = useState(false);

    useEffect(() => {
        const tick = () => setPendingCount(getSyncStatus().pending);
        tick();
        const id = setInterval(tick, 3000);
        return () => clearInterval(id);
    }, []);

    const handleSyncNow = async () => {
        if (syncingNow) return;
        setSyncingNow(true);
        try {
            const res = await flushQueue({ url: form.serverUrl || '', apiKey: form.serverApiKey || '' });
            setPendingCount(getSyncStatus().pending);
            addToast(
                res.errors > 0 ? `${t('server_failed')} (${res.errors})` : `${t('sync_done')}: ${res.sent}`,
                res.errors > 0 ? 'error' : 'success'
            );
        } finally {
            setSyncingNow(false);
        }
    };

    const handleTestServer = async () => {
        const res = await testConnection({ url: form.serverUrl || '', apiKey: form.serverApiKey || '' });
        setServerTest(res);
        addToast(res.ok ? t('server_connected') : `${t('server_failed')}: ${res.message}`, res.ok ? 'success' : 'error');
    };

    // نسخ احتياطي للحالة كاملة على السيرفر + استعادتها منه
    const [backupBusy, setBackupBusy] = useState(false);
    const serverCfg = () => ({ url: form.serverUrl || '', apiKey: form.serverApiKey || '' });

    const handlePushBackup = async () => {
        if (backupBusy) return;
        setBackupBusy(true);
        try {
            const res = await pushBackup(serverCfg(), state);
            addToast(
                res.ok
                    ? `${t('backup_created')}${res.bytes ? ` (${res.bytes} B)` : ''}`
                    : `${t('server_failed')}: ${res.message}`,
                res.ok ? 'success' : 'error'
            );
        } finally {
            setBackupBusy(false);
        }
    };

    const handleRestoreBackup = async () => {
        if (backupBusy) return;
        if (!window.confirm(t('confirm_restore_server'))) return;
        setBackupBusy(true);
        try {
            const res = await fetchBackup(serverCfg());
            if (!res.ok || !res.state) {
                addToast(`${t('server_failed')}: ${res.message}`, 'error');
                return;
            }
            restoreState(res.state);
            addToast(t('restore_done'), 'success');
        } finally {
            setBackupBusy(false);
        }
    };

    // فحص صامت للسيرفر عند فتح الإعدادات + كل 30 ثانية (لتوليد روابط الشبكة ورمز QR)
    useEffect(() => {
        let alive = true;
        const refresh = async () => {
            const res = await testConnection({ url: form.serverUrl || '', apiKey: form.serverApiKey || '' });
            if (alive) setServerTest(res);
        };
        refresh();
        const id = setInterval(refresh, 30000);
        return () => { alive = false; clearInterval(id); };
    }, [form.serverUrl, form.serverApiKey]);

    // رمز QR للاتصال بالهاتف: يحمل رابط السيرفر على الشبكة المحلية + مفتاح API
    const [qr, setQr] = useState({ dataUrl: '', text: '' });
    useEffect(() => {
        const lan = (serverTest?.lanUrls && serverTest.lanUrls[0]) || '';
        const url = lan || (form.serverUrl || '').trim();
        if (!url) {
            setQr({ dataUrl: '', text: '' });
            return;
        }
        const key = (form.serverApiKey || '').trim();
        const text = `procashier://connect?url=${encodeURIComponent(url)}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
        let cancelled = false;
        (async () => {
            try {
                const QRCode = await import('qrcode');
                const dataUrl = await QRCode.toDataURL(text, {
                    width: 480,
                    margin: 1,
                    color: { dark: '#0f172a', light: '#ffffff' },
                });
                if (!cancelled) setQr({ dataUrl, text });
            } catch (e) {
                console.error('QR generate failed', e);
            }
        })();
        return () => { cancelled = true; };
    }, [serverTest?.lanUrls, form.serverUrl, form.serverApiKey]);
    
    // Item Form
    const [itemForm, setItemForm] = useState({ id: '', nameAr: '', nameEn: '', categoryId: '', price: 0, trackStock: false, quantity: 0, alertThreshold: 0, variants: [], modifiers: [], type: 'product' } as Item);
    const [isEditingItem, setIsEditingItem] = useState(false);

    const save = () => {
        updateSettings(form);
        addToast(t('settings_saved'), 'success');
    };

    // ---------- تبويب تخصيص الطباعة (هوية الصالون + الشعار + القوالب) ----------
    const setDesign = (patch: Partial<PrintDesign>) => {
        setForm(prev => ({ ...prev, printDesign: { ...prev.printDesign, ...patch } as AppState['settings']['printDesign'] }));
    };

    // تطبيق قالب فوري (3 قوالب) — يطبّب preset ثم يحفظ مباشرة
    const applyTemplate = (tpl: string) => {
        const next = applyTemplatePreset({ ...form.printDesign } as PrintDesign, tpl);
        updateSettings({ ...form, printDesign: next as any });
        addToast(`${t('template_applied')}: ${t('template_' + normalizeTemplate(tpl))}`, 'success');
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
            addToast(
                code === 'too_big' ? t('logo_too_big') : code === 'type' ? t('logo_invalid_type') : t('logo_invalid'),
                'error'
            );
        }
    };

    const handleLogoRemove = async (slot: 'front' | 'back') => {
        await removeLogoAsset(slot);
        const patch = slot === 'front' ? { logoFrontDataUrl: undefined } : { logoBackDataUrl: undefined };
        updateSettings({ ...form, printDesign: { ...form.printDesign, ...patch } as any });
        addToast(t('logo_removed'), 'success');
    };

    // طابعات النظام (Electron فقط) — خارجه يبقى الحقل اليدوي
    const [printers, setPrinters] = useState([] as PrinterInfoLite[]);
    useEffect(() => {
        let alive = true;
        listPrinters().then(list => { if (alive) setPrinters(list); });
        return () => { alive = false; };
    }, []);

    // فاتورة تجريبية للمعاينة الحية داخل تبويب الطباعة
    const demoInvoice = useMemo(() => ({
        id: 9001,
        locationId: state.settings.currentLocationId,
        customerId: 0,
        customerName: language === 'ar' ? 'عميل تجريبي' : 'Demo Customer',
        items: [
            { itemId: 'demo-1', name: language === 'ar' ? 'قص شعر' : 'Haircut', price: 150, quantity: 1, modifiers: [] },
            { itemId: 'demo-2', name: language === 'ar' ? 'شامبو' : 'Shampoo', price: 120, quantity: 2, modifiers: [] },
        ],
        subtotal: 390,
        discountPercent: 0,
        taxPercent: 0,
        total: 390,
        date: '2026-01-01',
        timestamp: Date.now(),
        status: 'paid',
        paymentMethod: 'cash',
        createdBy: 'Demo',
    } as any), [language, state.settings.currentLocationId]);

    const handleItemSubmit = (e: any) => {
        e.preventDefault();
        if (isEditingItem) {
            updateItem(itemForm);
        } else {
            addItem({ ...itemForm, id: crypto.randomUUID() });
        }
        setItemForm({ id: '', nameAr: '', nameEn: '', categoryId: '', price: 0, trackStock: false, quantity: 0, alertThreshold: 0, variants: [], modifiers: [], type: 'product' } as Item);
        setIsEditingItem(false);
    };

    const renderGeneral = () => (
        <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('shop_name')} value={form.shopName} onChange={(e:any)=>setForm({...form, shopName: e.target.value})} />
                <Input label={t('phone')} value={form.phone} onChange={(e:any)=>setForm({...form, phone: e.target.value})} />
                <Input label={t('address')} value={form.address} onChange={(e:any)=>setForm({...form, address: e.target.value})} />
                <Input label={t('default_discount_percent')} type="number" value={form.defaultDiscountPercent} onChange={(e:any)=>setForm({...form, defaultDiscountPercent: parseFloat(e.target.value || 0)})} />
                <Input label={t('default_tax_percent')} type="number" value={form.defaultTaxPercent} onChange={(e:any)=>setForm({...form, defaultTaxPercent: parseFloat(e.target.value || 0)})} />
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.autoApplyDiscount} onChange={(e:any)=>setForm({...form, autoApplyDiscount: e.target.checked})} />
                  {t('auto_apply_discount')}
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.autoApplyTax} onChange={(e:any)=>setForm({...form, autoApplyTax: e.target.checked})} />
                  {t('auto_apply_tax')}
                </label>
            </div>
            
            <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-bold mb-4">{t('appearance')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('theme_color')}</label>
                        <div className="flex gap-3 flex-wrap">
                            {[
                                        { id: 'blue', color: '#0ea5e9' },
                                        { id: 'ocean', color: '#06b6d4' },
                                        { id: 'sunset', color: '#f97316' },
                                        { id: 'forest', color: '#22c55e' },
                                        { id: 'midnight', color: '#8b5cf6' },
                                        { id: 'luxury', color: '#CA8A04' }
                                    ].map(theme => (
                                <button 
                                    key={theme.id}
                                    onClick={() => setForm({...form, themeColor: theme.id as any})}
                                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${form.themeColor === theme.id ? 'border-slate-800 dark:border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                    title={theme.id}
                                >
                                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.color }}></div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                                <input type="checkbox" checked={form.touchMode} onChange={(e:any)=>setForm({...form, touchMode: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                <span className="text-sm font-medium">{t('touch_mode')}</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-bold mb-1">{t('server_sync')}</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('server_sync_hint')}</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <Input label={t('server_url')} value={form.serverUrl || ''} placeholder={t('ph_server_url')} onChange={(e:any)=>setForm({...form, serverUrl: e.target.value})} />
                                 <Input label={t('server_api_key')} value={form.serverApiKey || ''} onChange={(e:any)=>setForm({...form, serverApiKey: e.target.value})} />
                             </div>
                             <div className="flex items-center gap-3">
                                 <button
                                     onClick={handleTestServer}
                                     className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                                 >
                                     <Wifi size={18} /> {t('test_connection')}
                                 </button>
                                  {serverTest && (
                                     <span className={`text-xs font-bold px-2 py-1 rounded ${serverTest.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                         {serverTest.ok ? t('server_connected') : t('server_failed')}
                                     </span>
                                 )}
                             </div>
                             <div className="flex items-center gap-3 flex-wrap">
                                 <button
                                     onClick={handleSyncNow}
                                     disabled={syncingNow}
                                     className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                                 >
                                     <RefreshCw size={18} className={syncingNow ? 'animate-spin' : ''} /> {t('sync_now')}
                                 </button>
                                 <span className={`text-xs font-bold px-2 py-1 rounded ${pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                     {pendingCount > 0 ? `${pendingCount} ${t('pending_sync')}` : t('sync_done')}
                                 </span>
                             </div>
                             {serverTest?.ok && (serverTest.lanUrls?.length || 0) > 0 && (
                                 <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('server_suggested_urls')}</p>
                                     <div className="flex flex-wrap gap-2">
                                         {serverTest.lanUrls!.map(url => (
                                             <button
                                                 key={url}
                                                 title={t('server_phone_hint')}
                                                 onClick={() => {
                                                     setForm(prev => ({ ...prev, serverUrl: url }));
                                                     navigator.clipboard?.writeText(url);
                                                     addToast(`${t('copied')}: ${url}`, 'success');
                                                 }}
                                                 className="text-xs font-mono px-3 py-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary-400 hover:text-primary-600 transition-colors"
                                             >
                                                 {url}
                                             </button>
                                         ))}
                                     </div>
                                      <p className="text-[11px] text-slate-400 mt-2">{t('server_phone_hint')}</p>
                                  </div>
                              )}
                              {qr.dataUrl && (
                                  <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">{t('server_qr_title')}</p>
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                          <img src={qr.dataUrl} alt="server QR" className="w-36 h-36 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-600" />
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                                              <p>{t('server_qr_hint')}</p>
                                              <p className="font-mono break-all text-slate-600 dark:text-slate-300">{qr.text}</p>
                                              <button
                                                  onClick={() => {
                                                      navigator.clipboard?.writeText(qr.text);
                                                      addToast(`${t('copied')}`, 'success');
                                                  }}
                                                  className="mt-1 text-xs px-3 py-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                                              >
                                                  {t('copy')}
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-bold mb-4">{t('data_management')}</h3>
                             <div className="flex flex-wrap gap-3">
                                 <button 
                                    onClick={() => {
                                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
                                        const downloadAnchorNode = document.createElement('a');
                                        downloadAnchorNode.setAttribute("href", dataStr);
                                        downloadAnchorNode.setAttribute("download", "procashier_backup_" + new Date().toISOString().split('T')[0] + ".json");
                                        document.body.appendChild(downloadAnchorNode);
                                        downloadAnchorNode.click();
                                        downloadAnchorNode.remove();
                                        addToast(t('backup_created'), 'success');
                                    }}
                                    className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                                >
                                    <FileText size={18} />
                                    {t('backup_data')}
                                </button>
                                
                                <button 
                                    onClick={() => { 
                                        if(confirm(t('confirm_system_reset'))) {
                                            // Auto-backup before reset
                                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
                                            const downloadAnchorNode = document.createElement('a');
                                            downloadAnchorNode.setAttribute("href", dataStr);
                                            downloadAnchorNode.setAttribute("download", "procashier_auto_backup_" + new Date().toISOString().split('T')[0] + ".json");
                                            document.body.appendChild(downloadAnchorNode);
                                            downloadAnchorNode.click();
                                            downloadAnchorNode.remove();
                                            
                                            resetSystem(); 
                                        }
                                    }}
                                    className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                                >
                                    <AlertCircle size={18} />
                                    {t('restore_defaults')}
                                </button>
                             </div>

                             <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
                                 <button
                                     onClick={handlePushBackup}
                                     disabled={backupBusy}
                                     className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     <ArrowUp size={18} />
                                     {t('backup_to_server')}
                                 </button>
                                 <button
                                     onClick={handleRestoreBackup}
                                     disabled={backupBusy}
                                     className="px-4 py-2 border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     <ArrowDown size={18} />
                                     {t('restore_from_server')}
                                 </button>
                                 {backupBusy && <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">…</span>}
                             </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-bold mb-4">{t('loyalty_settings')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 py-2">
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input type="checkbox" className="sr-only peer" checked={form.loyaltyEnabled} onChange={(e:any)=>setForm({...form, loyaltyEnabled: e.target.checked})} />
                            <div className="relative w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full dark:bg-slate-700 peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            <span className="mx-3 text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                                {t('loyalty_program')} 
                                <span className={`text-xs mx-4 px-2 py-0.5 rounded-full ${form.loyaltyEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {form.loyaltyEnabled ? t('active') : t('inactive')}
                                </span>
                            </span>
                        </label>
                    </div>
                    <Input label={t('loyalty_min_spend')} type="number" value={form.loyaltyMinSpend} onChange={(e:any)=>setForm({...form, loyaltyMinSpend: parseFloat(e.target.value)})} />
                    <Input label={t('loyalty_points_award')} type="number" value={form.loyaltyPointsAward} onChange={(e:any)=>setForm({...form, loyaltyPointsAward: parseFloat(e.target.value)})} />
                    <Input label={t('loyalty_redeem_rate')} type="number" value={form.loyaltyRedeemRate} onChange={(e:any)=>setForm({...form, loyaltyRedeemRate: parseFloat(e.target.value)})} />
                    <div className="md:col-span-2 mt-4">
                        <Button 
                            variant="danger" 
                            onClick={() => {
                                if (confirm(t('confirm_reset_loyalty'))) {
                                    resetLoyaltyPoints();
                                }
                            }}
                            className="w-full md:w-auto"
                        >
                            <Trash2 size={16} /> {t('reset_loyalty_btn')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-3">
                <Button onClick={save} className="justify-center">{t('save')}</Button>
            </div>
        </Card>
    );

    const renderPrint = () => {
        const d = form.printDesign;
        const elementLabels: Record<string, string> = {
            header: t('element_header'),
            info: t('element_info'),
            items: t('element_items'),
            notes: t('element_notes'),
            totals: t('element_totals'),
            footer: t('element_footer'),
        };
        const selectCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100';
        return (
            <div className="space-y-6">
                <Card>
                    <h3 className="text-lg font-bold mb-1">{t('identity_section')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('identity_hint')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label={t('shop_name')} value={form.shopName} onChange={(e:any)=>setForm({...form, shopName: e.target.value})} />
                        <Input label={t('phone')} value={form.phone} onChange={(e:any)=>setForm({...form, phone: e.target.value})} />
                        <Input label={t('address')} value={form.address} onChange={(e:any)=>setForm({...form, address: e.target.value})} />
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-1">{t('logo_section')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('logo_hint')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(['front', 'back'] as const).map(slot => {
                            const src = slot === 'front' ? d.logoFrontDataUrl : d.logoBackDataUrl;
                            return (
                                <div key={slot} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-sm">{slot === 'front' ? t('logo_front') : t('logo_back')}</span>
                                        {src && (
                                            <button onClick={() => handleLogoRemove(slot)} className="text-xs text-red-600 hover:underline">{t('remove_logo')}</button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 border border-dashed border-slate-300 dark:border-slate-600 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden shrink-0">
                                            {src ? <img src={src} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">{t('no_logo')}</span>}
                                        </div>
                                        <label className="text-sm cursor-pointer">
                                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e:any) => { handleLogoUpload(slot, e.target.files?.[0]); e.target.value = ''; }} />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('logo_size')} ({d.logoSizePx}px)</label>
                            <input type="range" min={24} max={220} value={d.logoSizePx} onChange={(e:any)=>setDesign({ logoSizePx: Number(e.target.value) })} className="w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('logo_front_align')}</label>
                            <select className={selectCls} value={d.logoFrontAlign} onChange={(e:any)=>setDesign({ logoFrontAlign: e.target.value as any })}>
                                <option value="left">{t('left')}</option>
                                <option value="center">{t('center')}</option>
                                <option value="right">{t('right')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('logo_back_align')}</label>
                            <select className={selectCls} value={d.logoBackAlign} onChange={(e:any)=>setDesign({ logoBackAlign: e.target.value as any })}>
                                <option value="left">{t('left')}</option>
                                <option value="center">{t('center')}</option>
                                <option value="right">{t('right')}</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-1">{t('template_section')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('template_hint')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        {(Object.keys(TEMPLATE_PRESETS) as (keyof typeof TEMPLATE_PRESETS)[]).map(tplId => (
                            <button
                                key={tplId}
                                onClick={() => applyTemplate(tplId)}
                                className={`p-4 rounded-lg border-2 text-start transition ${normalizeTemplate(d.template) === tplId ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                            >
                                <div className="font-bold">{t('template_' + tplId)}</div>
                                <div className="text-xs opacity-70 mt-1">
                                    {t('template_' + tplId + '_desc')}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('paper_size')}</label>
                            <select className={selectCls} value={d.pageSize} onChange={(e:any)=>setDesign({ pageSize: e.target.value as any })}>
                                {PAGE_SIZES.map(p => <option key={p.id} value={p.id}>{t(p.labelKey)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('margin_mm')} ({d.marginMm}mm)</label>
                            <input type="range" min={0} max={25} value={d.marginMm} onChange={(e:any)=>setDesign({ marginMm: Number(e.target.value) })} className="w-full mt-3" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('font_size')} ({d.baseFontSize}px)</label>
                            <input type="range" min={8} max={20} value={d.baseFontSize} onChange={(e:any)=>setDesign({ baseFontSize: Number(e.target.value) })} className="w-full mt-3" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-4">{t('style_section')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('primary_color')}</label>
                            <input type="color" value={d.primaryColor} onChange={(e:any)=>setDesign({ primaryColor: e.target.value })} className="w-full h-10 rounded cursor-pointer" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('accent_color')}</label>
                            <input type="color" value={d.accentColor} onChange={(e:any)=>setDesign({ accentColor: e.target.value })} className="w-full h-10 rounded cursor-pointer" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">{t('text_color')}</label>
                            <input type="color" value={d.textColor} onChange={(e:any)=>setDesign({ textColor: e.target.value })} className="w-full h-10 rounded cursor-pointer" />
                        </div>
                        <Input label={t('title_text')} value={d.titleText} placeholder={t('invoice_print_title')} onChange={(e:any)=>setDesign({ titleText: e.target.value })} />
                        <Input label={t('footer_text')} value={d.footerText} placeholder={t('thank_you_label')} onChange={(e:any)=>setDesign({ footerText: e.target.value })} />
                        <Input label={t('items_per_page')} type="number" value={d.maxItemsPerPage ?? 10} onChange={(e:any)=>setDesign({ maxItemsPerPage: Math.max(1, Math.floor(Number(e.target.value) || 10)) })} />
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-4">{t('fields_section')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {ELEMENT_ORDER.map(el => {
                            const active = (d.elements && d.elements.length > 0 ? d.elements : DEFAULT_ELEMENTS).includes(el);
                            return (
                                <label key={el} className="flex items-center gap-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={active}
                                        onChange={(e:any) => {
                                            const cur = new Set(d.elements && d.elements.length > 0 ? d.elements : DEFAULT_ELEMENTS);
                                            if (e.target.checked) cur.add(el); else cur.delete(el);
                                            setDesign({ elements: ELEMENT_ORDER.filter(x => cur.has(x)) });
                                        }}
                                    />
                                    {elementLabels[el]}
                                </label>
                            );
                        })}
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-1">{t('printer_section')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('printer_hint')}</p>
                    {printers.length > 0 ? (
                        <div className="max-w-md">
                            <label className="block text-sm font-medium mb-2">{t('select_printer')}</label>
                            <select className={selectCls} value={form.printerName || 'Default'} onChange={(e:any)=>setForm({...form, printerName: e.target.value})}>
                                <option value="Default">{t('printer_default')}</option>
                                {printers.map(p => (
                                    <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ` (${t('printer_default')})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="max-w-md">
                            <Input label={t('select_printer')} value={form.printerName} onChange={(e:any)=>setForm({...form, printerName: e.target.value})} />
                            <p className="text-xs text-slate-400 mt-1">{t('printer_unavailable')}</p>
                        </div>
                    )}
                </Card>

                <Card>
                    <h3 className="text-lg font-bold mb-1">{t('preview_section')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('preview_hint')}</p>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto" style={{ maxHeight: 560, background: '#e5e7eb' }}>
                        <InvoiceReceipt
                            invoice={demoInvoice}
                            demo
                            designOverride={form.printDesign}
                            identityOverride={{ shopName: form.shopName, phone: form.phone, address: form.address }}
                        />
                    </div>
                </Card>

                <div className="mt-4 flex gap-3">
                    <Button onClick={save} className="justify-center">{t('save')}</Button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t('settings')}</h2>
                <Button onClick={save}>{t('save')}</Button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button onClick={() => setActiveTab('general')} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('general')}</button>
                <button onClick={() => setActiveTab('print')} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'print' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('print_branding')}</button>
                <button onClick={() => setActiveTab('items')} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'items' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('items')}</button>
                <button onClick={() => setActiveTab('users')} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('users')}</button>
                <button onClick={() => setActiveTab('logs')} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t('audit_logs')}</button>
            </div>

            {activeTab === 'general' && renderGeneral()}
            {activeTab === 'print' && renderPrint()}
            
            {activeTab === 'items' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-bold mb-4">{isEditingItem ? t('edit_item') : t('add_item')}</h3>
                        <form onSubmit={handleItemSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label={t('name_ar')} value={itemForm.nameAr} onChange={(e:any)=>setItemForm({...itemForm, nameAr: e.target.value})} required />
                                <Input label={t('name_en')} value={itemForm.nameEn} onChange={(e:any)=>setItemForm({...itemForm, nameEn: e.target.value})} required />
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">{t('category')}</label>
                                    <select className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" value={itemForm.categoryId} onChange={(e)=>setItemForm({...itemForm, categoryId: e.target.value})} required>
                                        <option value="">{t('select_category')}</option>
                                        {state.categories.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr : c.nameEn}</option>)}
                                    </select>
                                </div>
                                <Input label={t('price')} type="number" value={itemForm.price} onChange={(e:any)=>setItemForm({...itemForm, price: parseFloat(e.target.value)})} required />
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium">{t('type')}</label>
                                    <select className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" value={itemForm.type} onChange={(e)=>setItemForm({...itemForm, type: e.target.value as any})}>
                                        <option value="product">{t('product')}</option>
                                        <option value="service">{t('service')}</option>
                                    </select>
                                </div>
                            </div>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={itemForm.trackStock} onChange={(e)=>setItemForm({...itemForm, trackStock: e.target.checked})} />
                                <span className="text-sm">{t('track_stock')}</span>
                            </label>
                            {itemForm.trackStock && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label={t('quantity')} type="number" value={itemForm.quantity} onChange={(e:any)=>setItemForm({...itemForm, quantity: parseFloat(e.target.value)})} />
                                    <Input label={t('alert_threshold')} type="number" value={itemForm.alertThreshold} onChange={(e:any)=>setItemForm({...itemForm, alertThreshold: parseFloat(e.target.value)})} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button className="justify-center">{t('save')}</Button>
                                {isEditingItem && <Button variant="secondary" onClick={() => { setIsEditingItem(false); setItemForm({ id: '', nameAr: '', nameEn: '', categoryId: '', price: 0, trackStock: false, quantity: 0, alertThreshold: 0, variants: [], modifiers: [], type: 'product' } as Item); }}>{t('cancel')}</Button>}
                            </div>
                        </form>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {state.items.map(item => (
                            <Card key={item.id}>
                                <h4 className="font-bold">{language === 'ar' ? item.nameAr : item.nameEn}</h4>
                                <p className="text-sm text-slate-500">{item.price} {t('egp')} • {t(item.type)}</p>
                                <div className="mt-4 flex gap-2">
                                    <Button variant="secondary" onClick={() => { setItemForm(item); setIsEditingItem(true); }} className="flex-1 text-sm py-1">{t('edit')}</Button>
                                    <Button variant="danger" onClick={() => { if(confirm(t('confirm_delete'))) deleteItem(item.id); }} className="flex-1 text-sm py-1">{t('delete')}</Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'users' && <AdminUsers />}
            {activeTab === 'logs' && <AuditLogs />}
        </div>
    );
};
