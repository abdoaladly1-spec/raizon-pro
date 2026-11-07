import type { Location, User } from '../types';
import { verifySecret } from './crypto';

/**
 * فحص ما إذا كان الفرع المعطى هو الفرع الرئيسي
 * إذا كان هناك فرع واحد فقط في النظام فهو الفرع الرئيسي تلقائياً.
 * إذا كان هناك عدة فروع، فالفرع الذي يحمل isDefault = true أو id = '1' أو أول فرع هو الرئيسي.
 */
export const isMainBranch = (locationId?: string | null, locations: Location[] = []): boolean => {
  const activeLocations = (locations || []).filter(l => l.active !== false);
  if (activeLocations.length <= 1) return true;

  const mainLoc = activeLocations.find(l => (l as any).isDefault)
    || activeLocations.find(l => String(l.id) === '1')
    || activeLocations[0];

  if (!mainLoc) return true;
  return String(mainLoc.id) === String(locationId);
};

export const getMainBranch = (locations: Location[] = []): Location | undefined => {
  const activeLocations = (locations || []).filter(l => l.active !== false);
  return activeLocations.find(l => (l as any).isDefault)
    || activeLocations.find(l => String(l.id) === '1')
    || activeLocations[0];
};

export const getActiveBranch = (locationId?: string | null, locations: Location[] = []): Location | undefined => {
  const activeLocations = (locations || []).filter(l => l.active !== false);
  if (!locationId) return getMainBranch(activeLocations);
  return activeLocations.find(l => String(l.id) === String(locationId)) || getMainBranch(activeLocations);
};

/**
 * التحقق من كلمة مرور المدير لتفويض الطباعة
 */
export const verifyAdminPassword = async (password: string, users: User[] = []): Promise<boolean> => {
  const trimmed = password.trim();
  if (!trimmed) return false;
  const adminUsers = (users || []).filter(u => u.role === 'admin' && u.active !== false);
  for (const admin of adminUsers) {
    if (admin.passwordHash && admin.passwordSalt) {
      try {
        const match = await verifySecret(trimmed, admin.passwordHash, admin.passwordSalt);
        if (match) return true;
      } catch {
        // fallback
      }
    } else if (typeof admin.password === 'string' && admin.password === trimmed) {
      return true;
    }
  }
  return false;
};
