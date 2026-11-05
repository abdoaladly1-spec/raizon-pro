import React, { useState, useEffect } from 'react';
import { RAIZON_LOGO_URI } from '../lib/logoData';
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
          setStatusMessage('تم اكتمال التنزيل بنجاح! جاري التثبيت الآن...');
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
    setStatusMessage('بدء الاتصال وتحميل التحديث...');

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

  // عنوان التحديث الرئيسي
  const releaseTitle = updateInfo.releaseName || `تحديث جديد ${updateInfo.latestVersion}`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans select-none">
      {/* نافذة مطابقة تماماً لثيم برنامج تثبيت التطبيق (Setup Wizard) */}
      <div 
        className="relative w-full max-w-2xl rounded-[18px] border-[1.5px] border-[#482278] shadow-[0_0_50px_rgba(88,28,135,0.55)] flex flex-col overflow-hidden text-slate-100"
        style={{
          background: 'linear-gradient(180deg, #120921 0%, #090510 100%)'
        }}
      >
        {/* 1. شريط العنوان العلوي (Title Bar) كالمثبت تماماً */}
        <div className="h-[44px] bg-[#10081d] border-b border-[#24133d] flex items-center justify-between px-4">
          {/* الجانب الأيمن (بالعربية): أيقونة وعنوان النافذة */}
          <div className="flex items-center gap-2.5">
            <img 
              src={RAIZON_LOGO_URI} 
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              alt="Logo" 
              className="w-5 h-5 object-contain" 
            />
            <span className="text-[13px] font-semibold text-[#ded7f7]">
              مساعد تحديث RaiZon Pro — التحديث التلقائي
            </span>
          </div>

          {/* الجانب الأيسر: أزرار التحكم بالنافذة (— و ✕) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSkip}
              disabled={downloading}
              className="w-8 h-7 flex items-center justify-center rounded text-[#8a80a8] hover:text-white hover:bg-[#291745] transition-colors disabled:opacity-40"
              title="تصغير"
            >
              <span className="text-xs">─</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={downloading}
              className="w-8 h-7 flex items-center justify-center rounded text-[#8a80a8] hover:text-white hover:bg-[#dc2626] transition-colors disabled:opacity-40"
              title="إغلاق وتخطي التحديث"
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        </div>

        {/* 2. جسم النافذة (Body Content) مقسم إلى شعار فني + نصوص ومعلومات */}
        <div className="p-6 sm:p-7 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* الشعار الفني للمثبت (Left Emblem / 3D Art) */}
            <div className="hidden md:flex md:col-span-4 flex-col items-center justify-center relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div className="absolute inset-0 bg-[#9333ea]/25 rounded-full blur-2xl animate-pulse"></div>
                <img 
                  src="/public/img/pos-bg.jpg" 
                  onError={(e) => {
                    // Fallback to logo transparent
                    (e.target as HTMLImageElement).src = '/img/logo-transparent.png';
                  }}
                  alt="RaiZon Pro Art" 
                  className="relative z-10 w-32 h-32 object-contain rounded-2xl drop-shadow-[0_0_20px_rgba(147,51,244,0.6)]"
                />
              </div>
              <div className="mt-3 text-center">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-[#1c112e] text-[#c084fc] border border-[#522480]">
                  RaiZon Pro Updater
                </span>
              </div>
            </div>

            {/* تفاصيل التحديث ومميزاته */}
            <div className="md:col-span-8 text-right flex flex-col justify-center space-y-4">
              
              {/* الرأس: يتوفر تحديث جديد */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#8b5cf6]/20 text-[#d8b4fe] border border-[#8b5cf6]/40 mb-2">
                  <Sparkles size={13} className="text-amber-400 animate-pulse" />
                  <span>يتوفر تحديث جديد</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  يتوفر تحديث جديد لـ RaiZon Pro
                </h1>
                
                {/* شارة الإصدارات */}
                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#aba5cc]">
                  <span>الإصدار المثبت: <strong className="text-slate-300">{updateInfo.currentVersion}</strong></span>
                  <ArrowRight size={13} className="text-[#c084fc]" />
                  <span>الإصدار الجديد: <strong className="text-amber-400 text-sm">{updateInfo.latestVersion}</strong></span>
                  {updateInfo.installerAsset?.size && (
                    <span className="text-[11px] bg-[#11091f] px-2 py-0.5 rounded border border-[#3d2166] text-[#c084fc]">
                      {(updateInfo.installerAsset.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>
              </div>

              {/* قسم مميزات التحديث */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#ded7f7] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                  مميزات التحديث:
                </span>
                <div className="bg-[#11091f] border border-[#3d2166] rounded-xl p-3.5 max-h-36 overflow-y-auto custom-scrollbar text-xs leading-relaxed text-[#b2a8d1]">
                  {updateInfo.releaseNotes ? (
                    <div className="whitespace-pre-wrap">{updateInfo.releaseNotes}</div>
                  ) : (
                    <ul className="space-y-1 list-disc list-inside text-slate-300">
                      <li>تحسينات في سرعة وأداء النظام ومعالجة الفواتير.</li>
                      <li>إصلاحات لاستقرار النظام وتزامن البيانات.</li>
                      <li>تحديث محرك الطباعة والتقارير اليومية والشهرية.</li>
                    </ul>
                  )}
                </div>
              </div>

              {/* قسم شريط التقدم: وفوق الشريط عنوان التحديث */}
              {downloading && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  {/* فوق الشريط: عنوان التحديث والنسبة المئوية */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#ded7f7] font-bold truncate max-w-[70%]" title={releaseTitle}>
                      {releaseTitle}
                    </span>
                    <span className="text-[#c084fc] font-mono font-bold text-sm">
                      {progress}%
                    </span>
                  </div>

                  {/* شريط التقدم بتصميم متطابق تماماً مع Setup Wizard */}
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

                  {/* تفاصيل التنزيل والحجم المنقول */}
                  <div className="flex items-center justify-between text-[11px] text-[#aba5cc] font-mono">
                    <span>{statusMessage}</span>
                    {totalMB > 0 && (
                      <span>{transferredMB} MB / {totalMB} MB</span>
                    )}
                  </div>
                </div>
              )}

              {/* في حال تم التنزيل وجاهز للتثبيت */}
              {isReadyToInstall && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle size={18} className="shrink-0" />
                  <span>اكتمل تنزيل ملف التحديث بنجاح! جاري التثبيت وإعادة التشغيل...</span>
                </div>
              )}

              {/* في حال وجود خطأ */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 3. الشريط السفلي (Footer Bar) مطابق للمثبت مع زري التحديث والتخطي */}
        <div className="h-[64px] bg-[#0b0615] border-t border-[#24133d] flex items-center justify-between px-6">
          {/* زر التخطي (يسار) */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={downloading}
            className="px-6 py-2.5 rounded-[10px] bg-[#1c112e] hover:bg-[#2d1748] border border-[#522480] hover:border-[#8b5cf6] text-white text-[13.5px] font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            تخطي
          </button>

          {/* زر التحديث (يمين) */}
          {isReadyToInstall ? (
            <button
              type="button"
              onClick={handleManualInstall}
              className="px-7 py-2.5 rounded-[10px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[13.5px] font-bold shadow-[0_0_14px_rgba(16,185,129,0.5)] transition-all cursor-pointer flex items-center gap-2"
            >
              <CheckCircle size={16} />
              <span>تثبيت التحديث الآن</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartUpdate}
              disabled={downloading}
              className="px-7 py-2.5 rounded-[10px] text-white text-[13.5px] font-bold transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_14px_rgba(168,85,247,0.65)] disabled:opacity-50"
              style={{
                background: downloading 
                  ? '#3d2166' 
                  : 'linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%)',
                border: '1px solid #c084fc'
              }}
              onMouseEnter={(e) => {
                if (!downloading) e.currentTarget.style.background = 'linear-gradient(90deg, #a855f7 0%, #7c3aed 100%)';
              }}
              onMouseLeave={(e) => {
                if (!downloading) e.currentTarget.style.background = 'linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%)';
              }}
            >
              {downloading ? (
                <>
                  <RefreshCw size={15} className="animate-spin text-[#c084fc]" />
                  <span>جاري التحديث ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>تحديث</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
