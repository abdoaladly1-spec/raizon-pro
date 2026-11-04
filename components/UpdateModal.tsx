import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ArrowRight, Sparkles } from './Icons';

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
  onClose: () => void;
  onSkip?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  token,
  onClose,
  onSkip,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferredMB, setTransferredMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setProgress(0);
      setError(null);
      setIsReadyToInstall(false);
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
          setStatusMessage('جاري تنزيل ملف التحديث...');
        } else if (status.stage === 'downloaded') {
          setDownloading(false);
          setProgress(100);
          setIsReadyToInstall(true);
          setStatusMessage('تم اكتمال التنزيل! جاري التحضير للتثبيت...');
          // تشغيل التثبيت تلقائياً بعد ثانية ونصف
          setTimeout(async () => {
            try {
              if (window.procashier?.installUpdate) {
                await window.procashier.installUpdate();
              }
            } catch (err: any) {
              setError(err?.message || 'تعذر تشغيل التثبيت تلقائياً');
            }
          }, 1200);
        } else if (status.stage === 'error') {
          setDownloading(false);
          setError(status.error || 'حدث خطأ أثناء تنزيل التحديث');
        }
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const handleStartUpdate = async () => {
    if (!updateInfo.downloadUrl) {
      setError('رابط التحديث غير متوفر');
      return;
    }

    setError(null);
    setDownloading(true);
    setStatusMessage('جاري بدء التنزيل...');

    if (window.procashier?.downloadUpdate) {
      try {
        const res = await window.procashier.downloadUpdate({
          downloadUrl: updateInfo.downloadUrl,
          filename: updateInfo.installerAsset?.name || `RaiZon_Pro_${updateInfo.latestVersion}_Setup.exe`,
          // @ts-ignore
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
      // فتح الرابط خارجياً إذا لم يكن متاحاً في Electron
      if (updateInfo.downloadUrl) {
        window.open(updateInfo.downloadUrl, '_blank');
      }
      setDownloading(false);
    }
  };

  const handleManualInstall = async () => {
    if (window.procashier?.installUpdate) {
      await window.procashier.installUpdate();
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/60 text-slate-100 overflow-hidden">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close / Skip button */}
        {!downloading && !isReadyToInstall && (
          <button
            onClick={handleSkip}
            className="absolute top-5 left-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
            title="تخطي التحديث الآن"
          >
            <X size={20} />
          </button>
        )}

        {/* Header Icon + Title */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-amber-500 p-0.5 shadow-lg shadow-purple-500/30">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-amber-400">
              {isReadyToInstall ? (
                <CheckCircle size={32} className="text-emerald-400 animate-bounce" />
              ) : (
                <Sparkles size={32} className="animate-pulse" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-purple-300 to-white bg-clip-text text-transparent">
            تحديث جديد متوفر للنظام!
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            تم إطلاق إصدار جديد من RaiZon Pro يتضمن تحسينات وميزات جديدة.
          </p>

          {/* Versions Pill */}
          <div className="inline-flex items-center gap-3 mt-3 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-mono">
            <span className="text-slate-400">الإصدار الحالي: <span className="text-slate-200 font-bold">{updateInfo.currentVersion}</span></span>
            <ArrowRight size={14} className="text-purple-400" />
            <span className="text-amber-400 font-bold">الجديد: {updateInfo.latestVersion}</span>
          </div>
        </div>

        {/* Release Notes */}
        <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 mb-6 max-h-44 overflow-y-auto text-right text-xs leading-relaxed custom-scrollbar">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 text-slate-400 font-semibold">
            <span>{updateInfo.releaseName || 'ملاحظات وتفاصيل التحديث'}</span>
            {updateInfo.installerAsset?.size && (
              <span className="text-[11px] font-mono text-slate-500">
                {(updateInfo.installerAsset.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>
          {updateInfo.releaseNotes ? (
            <div className="text-slate-300 whitespace-pre-wrap font-sans text-xs">
              {updateInfo.releaseNotes}
            </div>
          ) : (
            <p className="text-slate-500 italic">يتضمن هذا التحديث تحسينات في الأداء وإصلاحات للنظام واستقرار التشغيل.</p>
          )}
        </div>

        {/* Progress bar when downloading */}
        {downloading && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-xs font-mono text-purple-300">
              <span>{statusMessage}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-purple-500/20">
              <div
                className="bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-200 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
              </div>
            </div>
            {totalMB > 0 && (
              <div className="text-right text-[11px] font-mono text-slate-400">
                تم تنزيل {transferredMB} MB من أصل {totalMB} MB
              </div>
            )}
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {isReadyToInstall ? (
            <button
              onClick={handleManualInstall}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle size={18} />
              <span>إعادة التشغيل وتثبيت التحديث الآن</span>
            </button>
          ) : (
            <>
              {/* زر التحديث */}
              <button
                onClick={handleStartUpdate}
                disabled={downloading}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {downloading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>جاري التنزيل ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>تحديث الآن (مجاناً)</span>
                  </>
                )}
              </button>

              {/* زر التخطي */}
              <button
                onClick={handleSkip}
                disabled={downloading}
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white font-bold text-sm border border-slate-700 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                تخطي
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
