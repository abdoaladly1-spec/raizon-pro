// أدوات حماية كلمات المرور والرموز السريعة — PBKDF2-SHA256 عبر WebCrypto
// لا تُخزَّن كلمة المرور نفسها أبداً؛ يُخزَّن hash + salt فقط.
// ملاحظة: في Electron (file://) وlocalhost يعتبر السياق آمناً فتتوفر crypto.subtle.

const enc = new TextEncoder();

/** عدد التكرارات — متوافق مع توصيات 2025+ */
const ITERATIONS = 210_000;
const KEY_BITS = 256;

const bytesToB64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
};

export const cryptoAvailable = (): boolean =>
  typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.subtle.deriveBits === 'function';

/** salt عشوائي 16 بايت (base64) — salt مختلف لكل مستخدم */
export const randomSalt = (): string =>
  bytesToB64(crypto.getRandomValues(new Uint8Array(16)));

export const hashSecret = async (secret: string, salt: string): Promise<string> => {
  if (!cryptoAvailable()) throw new Error('webcrypto-unavailable');
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return bytesToB64(new Uint8Array(bits));
};

/** مقارنة ثابتة الزمن (تمنع timing attacks بدون الحاجة إلى Node Buffer) */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const verifySecret = async (secret: string, hash: string, salt: string): Promise<boolean> => {
  if (!hash || !salt) return false;
  try {
    return timingSafeEqual(await hashSecret(secret, salt), hash);
  } catch {
    return false;
  }
};

/** يبني حقول كلمة مرور آمنة جاهزة للحفظ */
export const makePasswordRecord = async (password: string) => {
  const passwordSalt = randomSalt();
  return { passwordHash: await hashSecret(password, passwordSalt), passwordSalt };
};

/** يبني حقول رمز سريع آمنة جاهزة للحفظ */
export const makePinRecord = async (pin: string) => {
  const pinSalt = randomSalt();
  return { pinHash: await hashSecret(pin, pinSalt), pinSalt };
};
