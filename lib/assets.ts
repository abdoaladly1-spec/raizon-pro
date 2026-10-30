// مخزن أصول الشعار — يعتمد على نفس مخزن kv في IndexedDB (بلا تغيير بنية القاعدة)
// الإطار اللحظي للشعار يبقى في settings.printDesign (كما هو للعرض والنسخ الاحتياطي)،
// ومخزن الأصول يحفظ النسخة الأصلية + يسمح بإدارتها (قائمة/حذف) مستقلة عن الإعدادات.

import { idbGet, idbSet, idbRemove } from './idb.ts';
import { validateLogoAsset, MAX_LOGO_BYTES } from './printDesign.ts';

export type LogoSlot = 'front' | 'back';

export interface LogoAsset {
  dataUrl: string;
  fileName: string;
  bytes: number;
  updatedAt: number;
}

const assetKey = (slot: LogoSlot) => `asset:logo:${slot}`;

/** يحفظ أصل شعار في المخزن (بعد تحقّق النوع والحجم) */
export const saveLogoAsset = async (slot: LogoSlot, asset: LogoAsset): Promise<void> => {
  if (!asset?.dataUrl) throw new Error('empty');
  await idbSet(assetKey(slot), { ...asset, updatedAt: asset.updatedAt || Date.now() });
};

/** يقرأ أصل شعار أو null */
export const loadLogoAsset = async (slot: LogoSlot): Promise<LogoAsset | null> => {
  const raw = await idbGet<LogoAsset>(assetKey(slot));
  if (!raw || typeof raw !== 'object' || !raw.dataUrl) return null;
  return raw;
};

/** يحذف أصل شعار من المخزن */
export const removeLogoAsset = async (slot: LogoSlot): Promise<void> => {
  await idbRemove(assetKey(slot));
};

/** يحذف الأصولين (أثناء تصفير الحالة) */
export const clearLogoAssets = async (): Promise<void> => {
  await idbRemove(assetKey('front'));
  await idbRemove(assetKey('back'));
};

/**
 * يحوّل ملف شعار إلى DataURL مصغّر (canvas مدمج — بلا مكتبات):
 * يتحقق من النوع/الحجم ثم يضغط إلى أقصى 512px بنسبة JPEG 0.85 (أو PNG لو صغير أصلاً).
 */
export const fileToLogoDataUrl = (file: File): Promise<string> => {
  const check = validateLogoAsset({ name: file?.name, type: file?.type, size: file?.size });
  if (!check.ok) return Promise.reject(new Error(check.error || 'invalid'));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        try {
          const maxDim = 512;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = Math.min(maxDim / width, maxDim / height);
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));
          }
          if (width === img.width && height === img.height && file.size < 400 * 1024) {
            resolve(dataUrl);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const keepPng = file.type === 'image/png' && file.size <= 400 * 1024;
          resolve(keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

/** تقدير الحجم بالبايت لـ dataUrl (لتقارير مخزن الأصول) */
export const dataUrlBytes = (dataUrl: string): number => {
  const i = String(dataUrl).indexOf(',');
  if (i < 0) return String(dataUrl).length;
  return Math.floor(((String(dataUrl).length - i - 1) * 3) / 4);
};

export const LOGO_MAX_BYTES = MAX_LOGO_BYTES;
