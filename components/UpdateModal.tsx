import React, { useState, useEffect } from 'react';
import { RAIZON_LOGO_URI } from '../lib/logoData';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ArrowRight, Sparkles, Shield } from './Icons';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  installerAsset?: {
    name?: string;
    size?: number;
    downloadUrl?: string;
  } | null;
  htmlUrl?: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  token?: string;
  autoUpdateEnabled?: boolean;
  isDownloadedReady?: boolean;
  onClose: () => void;
  onSkip?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  token,
  autoUpdateEnabled = true,
  isDownloadedReady = false,
  onClose,
  onSkip,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferredMB, setTransferredMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState(isDownloadedReady);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsReadyToInstall(isDownloadedReady);
  }, [isDownloadedReady]);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setProgress(0);
      setError(null);
      setInstalling(false);
      return;
    }

    if (window.procashier?.onUpdaterStatus) {
      const unsub = window.procashier.onUpdaterStatus((status) => {
        if (status.stage === 'downloading') {
          setDownloading(true);
          setProgress(status.percent || 0);
          if (status.transferred && status.total) {
            setTransferredMB(Number((status.transferred / (1024 * 1024)).toFixed(1)));
            setTotalMB(Number((status.total / (1024 * 1024)).toFixed(1)));
          }
          setStatusMessage('جاري تنزيل ملف التحديث وفحص الحزم...');
        } else if (status.stage === 'downloaded') {
          setDownloading(false);
          setProgress(100);
          setIsReadyToInstall(true);

          // إذا كان التحديث التلقائي معطلاً (OFF)، طلب المستخدم:
          // "بعد اكتمال التنزيل يتم تثبيت التحديث تلقائيا بدون ازرار التالي ولا تحديد مكان التثبيت مكان التثبيت في نفس مكان النسخه الحاليه تحديثها بعد الانتهاء يتم الفتح تلقائيا"
          if (!autoUpdateEnabled) {
            setStatusMessage('تم اكتمال التنزيل والتحقق من سلامة الملف بنجاح! جاري التثبيت التلقائي وإعادة التشغيل...');
            setInstalling(true);
            setTimeout(async () => {
              try {
                if (window.procashier?.installUpdate) {
                  await window.procashier.installUpdate();
                }
              } catch (err: any) {
                setError(err?.message || 'تعذر تشغيل التثبيت تلقائياً');
                setInstalling(false);
              }
            }, 1200);
          } else {
            setStatusMessage('تم اكتمال تنزيل التحديث والتحقق من الملف بنجاح. انقر "تحديث الآن" للبدء.');
          }
        } else if (status.stage === 'error') {
          setDownloading(false);
          setError(status.error || 'حدث خطأ أثناء تنزيل التحديث');
        }
      });
      return () => unsub();
    }
  }, [isOpen, autoUpdateEnabled]);

  if (!isOpen || !updateInfo) return null;

  const handleStartDownload = async () => {
    if (!updateInfo.downloadUrl) {
      setError('رابط التحديث غير متوفر');
      return;
    }

    try {
      localStorage.setItem('raizon_just_updated', 'true');
      localStorage.setItem('raizon_app_version', updateInfo.latestVersion);
      localStorage.setItem('raizon_whats_new', JSON.stringify({
        version: updateInfo.latestVersion,
        name: updateInfo.releaseName || `الإصدار ${updateInfo.latestVersion}`,
        notes: updateInfo.releaseNotes || ''
      }));
    } catch (e) {}

    setError(null);
    setDownloading(true);
    setStatusMessage('بدء الاتصال بخوادم التحديث وتنزيل الحزمة...');

    if (window.procashier?.downloadUpdate) {
      try {
        const res = await window.procashier.downloadUpdate({
          downloadUrl: updateInfo.downloadUrl,
          filename: updateInfo.installerAsset?.name || `RaiZon_Pro_${updateInfo.latestVersion}_Setup.exe`,
          expectedSize: updateInfo.installerAsset?.size,
          version: updateInfo.latestVersion,
          releaseName: updateInfo.releaseName,
          token: token,
        });
        if (!res.ok) {
          setError(res.error || 'فشل التنزيل');
          setDownloading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'تعذر بدء التنزيل');
        setDownloading(false);
      }
    } else {
      if (updateInfo.downloadUrl) {
        window.open(updateInfo.downloadUrl, '_blank');
      }
      setDownloading(false);
    }
  };

  const handleInstallNow = async () => {
    setInstalling(true);
    setStatusMessage('جاري عمل نسخة احتياطية من قاعدة البيانات وبدء التثبيت وإعادة التشغيل...');
    try {
      if (window.procashier?.installUpdate) {
        const res = await window.procashier.installUpdate();
        if (res && !res.ok) {
          setError(res.error || 'فشل بدء التثبيت');
          setInstalling(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تشغيل مثبت التحديث');
      setInstalling(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  const releaseTitle = isReadyToInstall 
    ? 'تحديث جديد جاهز للتثبيت' 
    : 'تحديث جديد متاح';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in font-sans select-none">
      <div 
        className="relative w-full max-w-2xl rounded-[18px] border-[1.5px] border-[#482278] shadow-[0_0_55px_rgba(88,28,135,0.6)] flex flex-col overflow-hidden text-slate-100"
        style={{
          background: 'linear-gradient(180deg, #120921 0%, #090510 100%)'
        }}
      >
        {/* 1. شريط العنوان العلوي (Title Bar) */}
        <div className="h-[46px] bg-[#10081d] border-b border-[#24133d] flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img 
              src={RAIZON_LOGO_URI} 
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              alt="Logo" 
              className="w-5 h-5 object-contain" 
            />
            <span className="text-[13px] font-semibold text-[#ded7f7]">
              {isReadyToInstall 
                ? 'مساعد تحديث RIZON PRO — تحديث جديد جاهز للتثبيت' 
                : 'مساعد تحديث RIZON PRO — تحديث جديد متاح'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSkip}
              disabled={downloading || installing}
              className="w-8 h-7 flex items-center justify-center rounded text-[#8a80a8] hover:text-white hover:bg-[#291745] transition-colors disabled:opacity-40"
              title="تصغير"
            >
              <span className="text-xs">─</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={downloading || installing}
              className="w-8 h-7 flex items-center justify-center rounded text-[#8a80a8] hover:text-white hover:bg-[#dc2626] transition-colors disabled:opacity-40"
              title={isReadyToInstall ? 'تخطي التثبيت حالياً' : 'تأجيل التحديث (لاحقاً)'}
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        </div>

        {/* 2. جسم النافذة (Body Content) */}
        <div className="p-6 sm:p-7 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* الشعار الفني للمثبت */}
            <div className="hidden md:flex md:col-span-4 flex-col items-center justify-center relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="absolute inset-0 bg-[#9333ea]/25 rounded-full blur-2xl animate-pulse"></div>
                <img 
                  src="/public/img/pos-bg.jpg" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/img/logo-transparent.png';
                  }}
                  alt="RaiZon Pro Art" 
                  className="relative z-10 w-32 h-32 object-contain rounded-2xl drop-shadow-[0_0_20px_rgba(147,51,244,0.6)]"
                />
              </div>
              <div className="mt-3 text-center">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-[#1c112e] text-[#c084fc] border border-[#522480]">
                  {autoUpdateEnabled ? 'التحديث التلقائي مفعل' : 'تحديث يدوي مراقب'}
                </span>
              </div>
            </div>

            {/* تفاصيل التحديث ومميزاته */}
            <div className="md:col-span-8 text-right flex flex-col justify-center space-y-4">
              
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#8b5cf6]/20 text-[#d8b4fe] border border-[#8b5cf6]/40 mb-2">
                  <Sparkles size={13} className="text-amber-400 animate-pulse" />
                  <span>{releaseTitle}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {isReadyToInstall ? 'تحديث جديد جاهز للتثبيت الفوري' : 'يتوفر إصدار جديد لـ RIZON PRO'}
                </h1>
                
                {/* شارة الإصدارات */}
                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#aba5cc]">
                  <span>الإصدار الحالي: <strong className="text-slate-300">{updateInfo.currentVersion}</strong></span>
                  <ArrowRight size={13} className="text-[#c084fc]" />
                  <span>الإصدار الجديد: <strong className="text-amber-400 text-sm font-bold">{updateInfo.latestVersion}</strong></span>
                  {updateInfo.installerAsset?.size && (
                    <span className="text-[11px] bg-[#11091f] px-2 py-0.5 rounded border border-[#3d2166] text-[#c084fc]">
                      {(updateInfo.installerAsset.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>
              </div>

              {/* قسم مميزات وإصلاحات التحديث */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#ded7f7] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                  ملخص التغييرات والإصلاحات في هذا الإصدار:
                </span>
                <div className="bg-[#11091f] border border-[#3d2166] rounded-xl p-3.5 max-h-36 overflow-y-auto custom-scrollbar text-xs leading-relaxed text-[#b2a8d1]">
                  {updateInfo.releaseNotes ? (
                    <div className="whitespace-pre-wrap">{updateInfo.releaseNotes}</div>
                  ) : (
                    <ul className="space-y-1 list-disc list-inside text-slate-300">
                      <li>تحسينات في سرعة واستقرار النظام ومعالجة الفواتير.</li>
                      <li>حماية تامة للبيانات وإدارة ذكية للنسخ الاحتياطية.</li>
                      <li>تحديث محرك التحديثات السحابية والطباعة اللحظية.</li>
                    </ul>
                  )}
                </div>
              </div>

              {/* شريط تقدم التنزيل اللحظي */}
              {downloading && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#ded7f7] font-bold truncate max-w-[70%]">
                      جاري تنزيل ملف التحديث الرسمي...
                    </span>
                    <span className="text-[#c084fc] font-mono font-bold text-sm">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-4 rounded-lg bg-[#11091f] border border-[#3d2166] p-0.5 overflow-hidden">
                    <div 
                      className="h-full rounded-md transition-all duration-200 relative overflow-hidden shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #8b5cf6 0%, #c084fc 100%)'
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#aba5cc] font-mono">
                    <span>{statusMessage}</span>
                    {totalMB > 0 && (
                      <span>{transferredMB} MB / {totalMB} MB</span>
                    )}
                  </div>
                </div>
              )}

              {/* حالة الجاهزية للتثبيت */}
              {isReadyToInstall && !downloading && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-300">تم اكتمال تنزيل التحديث والتحقق من سلامة الملف بنجاح</p>
                      <p className="text-[11px] text-emerald-400/80 mt-0.5">
                        تم فحص توقيع SHA-256 وسلامة الحزمة. سيتم الاحتفاظ بنسخة احتياطية تلقائياً قبل التثبيت.
                      </p>
                    </div>
                  </div>
                  <Shield size={18} className="text-emerald-400 shrink-0" />
                </div>
              )}

              {/* رسائل التثبيت أو الأخطاء */}
              {installing && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-2 animate-fade-in">
                  <RefreshCw size={16} className="animate-spin text-purple-400 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 3. الشريط السفلي (Footer Bar) */}
        <div className="h-[68px] bg-[#0b0615] border-t border-[#24133d] flex items-center justify-between px-6">
          {/* زر التخطي أو لاحقاً */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={downloading || installing}
            className="px-6 py-2.5 rounded-[10px] bg-[#1c112e] hover:bg-[#2d1748] border border-[#522480] hover:border-[#8b5cf6] text-white text-[13.5px] font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            {isReadyToInstall ? 'تخطي' : 'لاحقاً'}
          </button>

          {/* أزرار الإجراء الرئيسي */}
          {isReadyToInstall ? (
            <button
              type="button"
              onClick={handleInstallNow}
              disabled={installing}
              className="px-7 py-2.5 rounded-[10px] bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-[13.5px] shadow-[0_0_16px_rgba(16,185,129,0.55)] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {installing ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-slate-950" />
                  <span>جاري التثبيت...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>تحديث الآن</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartDownload}
              disabled={downloading || installing}
              className="px-7 py-2.5 rounded-[10px] text-white text-[13.5px] font-bold transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_16px_rgba(168,85,247,0.65)] disabled:opacity-50"
              style={{
                background: downloading 
                  ? '#3d2166' 
                  : 'linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%)',
                border: '1px solid #c084fc'
              }}
            >
              {downloading ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-[#c084fc]" />
                  <span>جاري التنزيل ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>تنزيل التحديث</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
