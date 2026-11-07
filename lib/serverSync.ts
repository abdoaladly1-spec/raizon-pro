// مزامنة الفواتير مع سيرفر ProCashier (حفظ محلي فوري + طابور إعادة محاولة)
import { round2 } from './payments.ts';

export interface ServerConfig {
  url: string;
  apiKey?: string;
}

export interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
}

const QUEUE_KEY = 'procashier_sync_queue';
/** طابور المرتجعات (مستقل عن الفواتير — يُرسل ويُسحب منفصلين) */
const RET_QUEUE_KEY = 'procashier_returns_queue';
const STATUS_KEY = 'procashier_sync_status';
const MAX_ATTEMPTS = 50;
const TIMEOUT_MS = 10000;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('sync storage error', e);
  }
};

export const getQueue = (): any[] => readJson<any[]>(QUEUE_KEY, []);
export const setQueue = (q: any[]) => writeJson(QUEUE_KEY, q);

export const getSyncStatus = (): SyncStatus => {
  const status = readJson<SyncStatus>(STATUS_KEY, { pending: 0, lastSyncAt: null, lastError: null, syncing: false });
  // إذا لم يكن هناك فواتير معلقة، احذف أي خطأ قديم تلقائياً
  if (getQueue().length === 0 && status.lastError) {
    status.lastError = null;
    writeJson(STATUS_KEY, status);
  }
  return status;
};

const saveStatus = (patch: Partial<SyncStatus>) => {
  const next = { ...getSyncStatus(), ...patch, pending: getQueue().length };
  writeJson(STATUS_KEY, next);
  window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: next }));
  return next;
};

export const notifySyncStatus = () => saveStatus({});

export const clearSyncError = (): SyncStatus => saveStatus({ lastError: null });

export const onSyncStatus = (cb: (s: SyncStatus) => void): (() => void) => {
  const handler = (e: Event) => cb((e as CustomEvent).detail as SyncStatus);
  window.addEventListener('sync-status-changed', handler as EventListener);
  cb(getSyncStatus());
  return () => window.removeEventListener('sync-status-changed', handler as EventListener);
};

/** معرّف ثابت للفاتورة الجديدة (UUID) — أساس المزامنة بين الأجهزة */
export const newInvoiceUid = (): string => {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** معرّف ثابت لسجل المرتجع (UUID) — أساس منع التكرار بين الأجهزة */
export const newReturnUid = (): string => {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `ret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildInvoicePayload = (
  invoice: any,
  customer: any,
  settings: any
): any => {
  const items = (invoice.items || []).map((it: any) => ({
    itemId: it.itemId,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
  }));
  const subtotal = round2(invoice.subtotal ?? items.reduce((a: number, i: any) => a + Number(i.price || 0) * Number(i.quantity || 1), 0));
  const discount = round2(invoice.discountAmount !== undefined ? Number(invoice.discountAmount) : ((subtotal * (Number(invoice.discountPercent) || 0)) / 100));
  const taxable = round2(Math.max(0, subtotal - discount));
  const tax = round2(invoice.taxAmount !== undefined ? Number(invoice.taxAmount) : ((taxable * (Number(invoice.taxPercent) || 0)) / 100));
  // الهوية ثابتة وليست مشتقة من الترتيب/الوقت حتى لا تتطابق فاتورتان من جهازين
  const uid =
    invoice.uid ||
    `${invoice.locationId || settings?.currentLocationId || '1'}:${invoice.id}:${invoice.timestamp || 0}`;

  return {
    uid,
    local_id: invoice.id,
    client_key: uid,
    customer_id: invoice.customerId ?? null,
    customer_name: invoice.customerName || 'Guest',
    phone: customer?.phone || '',
    items,
    subtotal,
    discount,
    tax,
    total: round2(invoice.total ?? (taxable + tax)),
    payment_method: invoice.paymentMethod || 'cash',
    // تفاصيل الدفع المختلط (تُحفظ مع الفاتورة بشكل ذري في حقل واحد بالسيرفر)
    payment_parts: Array.isArray(invoice.paymentParts)
      ? invoice.paymentParts
          .map((p: any) => ({ method: p?.method, amount: round2(Number(p?.amount) || 0) }))
          .filter((p: any) => p.method && p.amount > 0)
      : null,
    cash_paid: invoice.cashPaid == null ? null : round2(Number(invoice.cashPaid)),
    received: invoice.received == null ? null : round2(Number(invoice.received)),
    change: invoice.change == null ? null : round2(Number(invoice.change)),
    status: invoice.status || 'paid',
    staff_name: invoice.staffName || '',
    created_by: invoice.createdBy || '',
    location_id: invoice.locationId || settings?.currentLocationId || '1',
    branch_name: (invoice as any).branchName || (invoice as any).branch_name || '',
    notes: invoice.notes || '',
    date: invoice.date,
    timestamp: invoice.timestamp,
  };
};

export const buildCustomerPayload = (customer: any) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  email: customer.email || '',
  total_spent: customer.totalSpent || 0,
  last_visit: customer.lastVisit || '',
  loyalty_points: customer.loyaltyPoints || 0,
  tier: customer.tier || 'Bronze',
});

/** إرسال/تحديث عميل في السيرفر (لحظي، فشل لا يوقف التطبيق) */
export const pushCustomer = async (config: ServerConfig | undefined, payload: any): Promise<void> => {
  const baseUrl = (config?.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl || !payload?.id) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config?.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    console.warn('customer push failed', e);
  } finally {
    clearTimeout(timer);
  }
};

/** يضيف فاتورة لطابور المزامنة (بدون تكرار) */
export const enqueueInvoice = (payload: any): void => {
  if (!payload?.client_key) return;
  const queue = getQueue();
  if (queue.some(q => q.payload?.client_key === payload.client_key)) return;
  queue.push({ payload, attempts: 0, lastError: null as string | null, createdAt: Date.now() });
  setQueue(queue);
  saveStatus({});
};

/** يحاول إرسال كل ما في الطابور للسيرفر */
export const flushQueue = async (config?: ServerConfig): Promise<{ sent: number; errors: number }> => {
  const cfg = config || { url: '', apiKey: '' };
  const baseUrl = (cfg.url || '').trim().replace(/\/+$/, '');
  const queue = getQueue();

  if (!baseUrl || queue.length === 0) {
    saveStatus({ lastError: null, pending: queue.length, syncing: false });
    return { sent: 0, errors: 0 };
  }

  saveStatus({ syncing: true });
  let sent = 0;
  let errors = 0;
  let lastError: string | null = null;
  const remaining: any[] = [];

  for (const entry of queue) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { 'X-API-Key': cfg.apiKey } : {}),
        },
        body: JSON.stringify(entry.payload),
        signal: controller.signal,
      });

      if (res.ok || res.status === 409) {
        sent++;
        continue;
      }
      const text = await res.text().catch(() => '');
      lastError = `HTTP ${res.status} ${text.slice(0, 160)}`;
      errors++;
    } catch (e: any) {
      lastError = e?.message || String(e);
      errors++;
    } finally {
      clearTimeout(timer);
    }

    entry.attempts = (entry.attempts || 0) + 1;
    entry.lastError = lastError;
    if (entry.attempts < MAX_ATTEMPTS) {
      remaining.push(entry);
    } else {
      console.error('Sync dropped after max attempts', entry.payload?.client_key, lastError);
    }
  }

  setQueue(remaining);
  saveStatus({ lastSyncAt: Date.now(), lastError, syncing: false });
  return { sent, errors };
};

/** اختبار الاتصال بالسيرفر */
export const testConnection = async (config: ServerConfig): Promise<{ ok: boolean; message: string; lanUrls?: string[] }> => {  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { ok: false, message: 'empty' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as any;
    const lanUrls = Array.isArray(body?.lan_urls)
      ? body.lan_urls.filter((u: any) => typeof u === 'string')
      : undefined;
    return res.ok
      ? { ok: true, message: `ok · email:${body?.email_mode || '-'}`, lanUrls }
      : { ok: false, message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
};

/** رفع نسخة احتياطية كاملة من حالة التطبيق إلى السيرفر */
export const pushBackup = async (
  config: ServerConfig,
  state: unknown
): Promise<{ ok: boolean; message: string; bytes?: number }> => {
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { ok: false, message: 'empty' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}/api/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      },
      body: JSON.stringify(state),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, message: `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}` };
    return { ok: true, message: 'ok', bytes: body?.bytes };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
};

/** جلب آخر نسخة احتياطية محفوظة على السيرفر */
export const fetchBackup = async (
  config: ServerConfig
): Promise<{ ok: boolean; message: string; state?: any; modifiedAt?: number }> => {
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { ok: false, message: 'empty' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}/api/backup`, {
      headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    return { ok: true, message: 'ok', state: body?.state, modifiedAt: body?.modified_at };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
};

// ------------------------------------------------------------------ المزامنة التنازلية (سيرفر → تطبيق)
const VALID_STATUS = ['paid', 'pending', 'void', 'refunded', 'held'];
const VALID_PAYMENT = ['cash', 'card', 'split', 'loyalty', 'wallet', 'mixed', 'visa'];

/** يحوّل صف فاتورة من السيرفر إلى شكل الفاتورة المحلي */
export const mapServerInvoice = (row: any): any | null => {
  if (!row) return null;
  const items = (row.items || []).map((it: any) => ({
    itemId: it.itemId ?? `server:${row.id}`,
    variantId: it.variantId,
    name: it.name || '',
    price: Number(it.price) || 0,
    quantity: Number(it.quantity) || 1,
    modifiers: [],
  }));
  const subtotal = Number(row.subtotal) || items.reduce((a: number, i: any) => a + i.price * i.quantity, 0);
  const discountAmount = Number(row.discount) || 0;
  const taxAmount = Number(row.tax) || 0;
  const total = Number(row.total) || subtotal - discountAmount + taxAmount;
  const ts = Number(row.timestamp) || Date.now();
  const localId = Number(row.local_id);
  const digits = String(row.id ?? '').replace(/\D/g, '');
  const fallbackId = (digits.length >= 7 ? Number(digits.slice(-7)) : Number(digits)) || Math.floor(ts / 1000) % 10000000;
  const taxable = Math.max(0, subtotal - discountAmount);

  return {
    uid: String(row.uid || row.id || ''),
    id: Number.isFinite(localId) && localId ? localId : fallbackId,
    locationId: String(row.location_id || ''),
    customerId: Number(row.customer_id) || 0,
    customerName: row.customer_name || 'زائر',
    items,
    subtotal,
    discountPercent: subtotal > 0 ? Math.round((discountAmount / subtotal) * 10000) / 100 : 0,
    taxPercent: taxable > 0 ? Math.round((taxAmount / taxable) * 10000) / 100 : 0,
    total,
    date: row.date || new Date(ts).toISOString().split('T')[0],
    timestamp: ts,
    status: VALID_STATUS.includes(row.status) ? row.status : 'paid',
    notes: row.notes || '',
    paymentMethod: VALID_PAYMENT.includes(row.payment_method) ? row.payment_method : 'cash',
    /** تفاصيل الدفع المختلط القادمة من السيرفر (اختيارية للفواتير القديمة) */
    paymentParts: Array.isArray(row.payment_parts) && row.payment_parts.length
      ? row.payment_parts
          .map((p: any) => ({ method: p?.method, amount: round2(Number(p?.amount) || 0) }))
          .filter((p: any) => p.method && p.amount > 0)
      : undefined,
    cashPaid: row.cash_paid == null ? undefined : round2(Number(row.cash_paid)),
    received: row.received == null ? undefined : round2(Number(row.received)),
    change: row.change == null ? undefined : round2(Number(row.change)),
    createdBy: row.created_by || '',
    staffName: row.staff_name || '',
    serverKey: row.uid || row.client_key || String(row.id),
    /** حذف منطقي (tombstone) — يُحذف محلياً عند السحب */
    deleted: Number(row.deleted) === 1,
    /** وقت آخر تعديل على السيرفر (basis لـ pull_since) */
    updatedAt: Number(row.updated_at) || 0,
  };
};

/** توقيع الفاتورة القديم — يُستخدم فقط كفلاحية احتياطية للفواتير بلا uid */
export const invoiceSignature = (inv: any): string =>
  `${inv?.timestamp ?? ''}|${Number(inv?.total) || 0}|${inv?.customerName || ''}`;

/**
 * دمج فواتير السيرفر مع المحلية (دالة نقية قابلة للاختبار).
 *
 * القواعد:
 * 1) الهوية هي uid؛ إن غاب uid محلياً ندمج بالبصمة ونمنحه هوية السيرفر (توافق مع بيانات قديمة).
 * 2) الفاتورة المدفوعة مُقفلة بعد البيع: لا نستبدل محتوى نسخة موجودة.
 * 3) الحذف المنطقي (deleted) يحذف النسخة المحلية ولا يحذف فيزيائياً على السيرفر.
 * 4) فاتورة جديدة تُضاف؛ فاتورة ملغاة لا نعرفها محلياً تُتجاهل.
 */
export const mergePulledInvoices = (
  prev: any[],
  remote: any[]
): { invoices: any[]; changed: boolean } => {
  const list = [...prev];
  const indexOfUid = new Map<string, number>();
  const indexOfSig = new Map<string, number>();
  list.forEach((inv, i) => {
    // uid هو الأساس؛ serverKey (المعرّف القديم على السيرفر) مطابقة احتياطية
    // للبيانات التي سُحبت قبل تفعيل uid حتى لا تُضاف نسخة مكررة.
    for (const id of [inv?.uid, inv?.serverKey]) {
      if (id && !indexOfUid.has(id)) indexOfUid.set(id, i);
    }
    const sig = invoiceSignature(inv);
    if (!indexOfSig.has(sig)) indexOfSig.set(sig, i);
  });

  let changed = false;
  const removals = new Set<number>();
  const register = (key: string | undefined, idx: number) => {
    if (key && !indexOfUid.has(key)) indexOfUid.set(key, idx);
  };

  for (const incoming of remote || []) {
    if (!incoming) continue;
    const sig = invoiceSignature(incoming);
    const identity = incoming.uid || incoming.serverKey;
    let idx = identity && indexOfUid.has(identity) ? indexOfUid.get(identity)! : -1;
    let adopted = false;
    if (idx < 0 && incoming.uid && indexOfSig.has(sig)) {
      const candidate = list[indexOfSig.get(sig)!];
      if (candidate && !candidate.uid) {
        idx = indexOfSig.get(sig)!;
        adopted = true;
      }
    }

    if (idx < 0) {
      if (incoming.deleted) continue;
      list.push(incoming);
      changed = true;
      const at = list.length - 1;
      register(incoming.uid, at);
      register(incoming.serverKey, at);
      indexOfSig.set(sig, at);
      continue;
    }

    if (incoming.deleted) {
      removals.add(idx);
      changed = true;
      continue;
    }

    if (adopted) {
      list[idx] = { ...list[idx], uid: incoming.uid };
      register(incoming.uid, idx);
      changed = true;
    }
    // غير ذلك: النسخة موجودة ومقفلة بعد البيع → لا تغيير
  }

  if (!changed) return { invoices: prev, changed: false };
  return { invoices: list.filter((_, i) => !removals.has(i)), changed: true };
};

/** يسحب فواتير السيرفر منذ وقت معيّن (تتبّع الصفحات حتى 2000 فاتورة) */
export const pullInvoices = async (
  config: ServerConfig,
  since: number
): Promise<{ invoices: any[]; maxTs: number }> => {
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { invoices: [], maxTs: 0 };
  const start = Number(since) || 0;
  const invoices: any[] = [];
  let maxTs = start;

  for (let page = 1; page <= 10; page++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${baseUrl}/api/invoices?since=${start}&page=${page}&page_size=200`, {
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
        signal: controller.signal,
      });
      if (!res.ok) break;
      const body = (await res.json().catch(() => ({}))) as any;
      const rows: any[] = Array.isArray(body?.invoices) ? body.invoices : [];
      for (const row of rows) {
        invoices.push(row);
        // الأساس لـ pull_since هو وقت آخر تعديل لا وقت البيع
        const ts = Number(row.updated_at) || Number(row.timestamp) || 0;
        if (ts > maxTs) maxTs = ts;
      }
      if (rows.length < 200) break;
    } catch {
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return { invoices, maxTs };
};

// ============================================================
// المرتجعات: طابور الإرسال + السحب + الدمج (مستقل عن طابور الفواتير)
// ============================================================

export const getReturnQueue = (): any[] => readJson<any[]>(RET_QUEUE_KEY, []);
export const setReturnQueue = (q: any[]) => writeJson(RET_QUEUE_KEY, q);
/** عدد المرتجعات المعلّقة في الطابور (لم يأتِ رد من السيرفر) */
export const returnQueueCount = (): number => getReturnQueue().length;

/** يبني حمولة مرتجع واحدة للسيرفر (المبالغ جاهزة، uid ثابت لمنع التكرار) */
export const buildReturnPayload = (ret: any, invoice: any, settings: any): any => ({
  uid: ret.uid,
  id: ret.uid,
  client_key: ret.uid,
  invoice_uid: invoice?.uid || ret.invoiceUid || '',
  invoice_id: invoice?.id ?? ret.invoiceId ?? null,
  items: (ret.items || []).map((it: any) => ({
    itemId: it.itemId,
    name: it.name,
    quantity: Number(it.quantity) || 0,
    price: round2(Number(it.price) || 0),
    discount_amount: round2(Number(it.discountAmount) || 0),
    tax_amount: round2(Number(it.taxAmount) || 0),
    refund_amount: round2(Number(it.refundAmount) || 0),
    returnable: !!it.returnable,
    track_stock: !!it.trackStock,
    type: it.type || 'service',
    restocked: !!it.restocked,
  })),
  refund_amount: round2(Number(ret.refundAmount) || 0),
  refund_parts: (ret.refundParts || [])
    .map((p: any) => ({ method: p?.method, amount: round2(Number(p?.amount) || 0) }))
    .filter((p: any) => p.method && p.amount > 0),
  cash_refund: round2(Number(ret.cashRefund) || 0),
  type: ret.type === 'full' ? 'full' : 'partial',
  // على السلك دائماً "معتمد": الرد 200 هو ما يُحوّل السجل محلياً إلى معتمد
  status: 'approved',
  reason: ret.reason || '',
  notes: ret.notes || '',
  staff_id: ret.staffId || '',
  staff_name: ret.staffName || '',
  created_by: ret.createdBy || '',
  customer_id: Number(ret.customerId) || 0,
  customer_name: ret.customerName || '',
  location_id: ret.locationId || settings?.currentLocationId || '1',
  points_reversed: Number(ret.pointsReversed) || 0,
  commission_reversed: round2(Number(ret.commissionReversed) || 0),
  date: ret.date || '',
  timestamp: Number(ret.timestamp) || 0,
  updated_at: Number(ret.updatedAt) || Number(ret.timestamp) || 0,
  deleted: 0,
});

/** يضيف مرتجعاً لطابور الإرسال (بدون تكرار بـ uid) */
export const enqueueReturn = (payload: any): void => {
  if (!payload?.uid) return;
  const queue = getReturnQueue();
  if (queue.some(q => q.payload?.uid === payload.uid || q.payload?.client_key === payload.uid)) return;
  queue.push({ payload, attempts: 0, lastError: null as string | null, createdAt: Date.now() });
  setReturnQueue(queue);
};

export interface ReturnFlushResult {
  sent: number;
  errors: number;
  /** مرتجعات اعتمدها السيرفر (رد 200) */
  approved: string[];
  /** مرتجعات رفضها السيرفر نهائياً (بيانات غير صالحة/كمية ناقصة/تعارض) */
  rejected: { uid: string; detail: string }[];
}

/**
 * يرسل طابور المرتجعات. الفشل الشبكي يبقي السجل في الطابور (يُعاد محاولته)،
 * أما ردود 400/404/409 فهي رفض دائم (يُخرَج من الطابور مع رسالة السبب).
 */
export const flushReturnQueue = async (config?: ServerConfig): Promise<ReturnFlushResult> => {
  const out: ReturnFlushResult = { sent: 0, errors: 0, approved: [], rejected: [] };
  const cfg = config || { url: '', apiKey: '' };
  const baseUrl = (cfg.url || '').trim().replace(/\/+$/, '');
  const queue = getReturnQueue();
  if (!baseUrl || queue.length === 0) return out;

  const remaining: any[] = [];
  for (const entry of queue) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let outcome: 'ok' | 'rejected' | 'retry' = 'retry';
    let detail = '';
    try {
      const res = await fetch(`${baseUrl}/api/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { 'X-API-Key': cfg.apiKey } : {}),
        },
        body: JSON.stringify(entry.payload),
        signal: controller.signal,
      });
      if (res.ok) {
        out.sent++;
        out.approved.push(String(entry.payload?.uid || ''));
        outcome = 'ok';
      } else if (res.status === 400 || res.status === 404 || res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as any;
        detail = String(body?.detail || `HTTP ${res.status}`);
        out.errors++;
        outcome = 'rejected';
        out.rejected.push({ uid: String(entry.payload?.uid || ''), detail });
      } else {
        const text = await res.text().catch(() => '');
        detail = `HTTP ${res.status} ${text.slice(0, 160)}`;
        out.errors++;
      }
    } catch (e: any) {
      detail = e?.message || String(e);
      out.errors++;
    } finally {
      clearTimeout(timer);
    }

    if (outcome === 'retry') {
      entry.attempts = (entry.attempts || 0) + 1;
      entry.lastError = detail;
      remaining.push(entry);
    }
  }

  setReturnQueue(remaining);
  return out;
};

/** يحوّل صف مرتجع من السيرفر إلى شكل السجل المحلي */
export const mapServerReturn = (row: any): any | null => {
  if (!row) return null;
  const uid = String(row.uid || '');
  const id = Number(row.id);
  const ts = Number(row.timestamp) || 0;
  const digits = String(uid).replace(/\D/g, '');
  const localId =
    Number.isFinite(id) && id ? id : (digits.length >= 7 ? Number(digits.slice(-7)) : Number(digits)) || Math.floor(ts / 1000) % 10000000;
  const items = (row.items || []).map((it: any) => ({
    itemId: String(it.itemId ?? ''),
    name: it.name || '',
    quantity: Number(it.quantity) || 0,
    price: round2(Number(it.price) || 0),
    discountAmount: round2(Number(it.discountAmount) || 0),
    taxAmount: round2(Number(it.taxAmount) || 0),
    refundAmount: round2(Number(it.refundAmount) || 0),
    returnable: !!it.returnable,
    trackStock: !!it.trackStock,
    type: it.type === 'product' ? 'product' : 'service',
    restocked: !!it.restocked,
  }));
  const status = row.status;
  return {
    uid,
    id: localId,
    invoiceUid: String(row.invoice_uid || ''),
    invoiceId: Number(row.invoice_id) || 0,
    items,
    refundAmount: round2(Number(row.refund_amount) || 0),
    refundParts: Array.isArray(row.refund_parts)
      ? row.refund_parts
          .map((p: any) => ({ method: p?.method, amount: round2(Number(p?.amount) || 0) }))
          .filter((p: any) => p.method && p.amount > 0)
      : [],
    cashRefund: round2(Number(row.cash_refund) || 0),
    type: row.type === 'full' ? 'full' : 'partial',
    status: status === 'pending' || status === 'rejected' ? status : 'approved',
    reason: row.reason || '',
    notes: row.notes || '',
    staffId: row.staff_id || '',
    staffName: row.staff_name || '',
    createdBy: row.created_by || '',
    customerId: Number(row.customer_id) || 0,
    customerName: row.customer_name || '',
    locationId: row.location_id || '',
    pointsReversed: Number(row.points_reversed) || 0,
    commissionReversed: round2(Number(row.commission_reversed) || 0),
    date: row.date || (ts ? new Date(ts).toISOString().split('T')[0] : ''),
    timestamp: ts,
    createdAt: row.created_at || '',
    updatedAt: Number(row.updated_at) || ts,
    serverKey: uid || String(row.id || ''),
    deleted: Number(row.deleted) === 1 ? 1 : 0,
  };
};

/**
 * دمج مرتجعات السيرفر مع المحلية (دالة نقية قابلة للاختبار).
 *
 * القواعد:
 * 1) uid هو الأساس.
 * 2) سجل جديد من جهاز آخر يُضاف — **معتمد ⇒ يجب تطبيق آثاره محلياً** (مخزون/نقاط/عمولة).
 * 3) سجلنا "معلّق" ووصل اعتماده من السيرفر ⇒ ندمجه ونعيد تطبيق آثاره مرة واحدة.
 * 4) سجل معتمد/مرفوض محلياً لا يُستبدل بمحتوى بعيد (الاعتماد نهائي محلياً).
 */
export const mergePulledReturns = (
  prev: any[],
  remote: any[]
): { returns: any[]; changed: boolean; toApply: any[] } => {
  const byUid = new Map<string, any>((prev || []).filter(r => r?.uid).map(r => [r.uid, r]));
  let changed = false;
  const toApply: any[] = [];

  for (const rec of remote || []) {
    if (!rec?.uid || rec.deleted) continue;
    const local = byUid.get(rec.uid);
    if (!local) {
      byUid.set(rec.uid, rec);
      changed = true;
      if (rec.status === 'approved') toApply.push(rec);
      continue;
    }
    if (local.status === 'pending' && rec.status === 'approved') {
      const merged = { ...local, ...rec, status: 'approved' };
      byUid.set(rec.uid, merged);
      changed = true;
      toApply.push(merged);
      continue;
    }
    // محلي معتمد/مرفوض + بعيد جديد ⇒ نُبقي معتمد محلياً ولا نُعيد التأثير
    if (local.status === 'pending' && rec.status === 'rejected') {
      byUid.set(rec.uid, { ...local, ...rec, status: 'rejected' });
      changed = true;
    }
  }

  if (!changed) return { returns: prev, changed: false, toApply: [] };
  return { returns: [...byUid.values()], changed: true, toApply };
};

/** يسحب مرتجعات السيرفر منذ وقت معيّن (تتبّع الصفحات) */
export const pullReturns = async (
  config: ServerConfig,
  since: number
): Promise<{ returns: any[]; maxTs: number }> => {
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return { returns: [], maxTs: 0 };
  const start = Number(since) || 0;
  const records: any[] = [];
  let maxTs = start;

  for (let page = 1; page <= 10; page++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${baseUrl}/api/returns?since=${start}&page=${page}&page_size=200`, {
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
        signal: controller.signal,
      });
      if (!res.ok) break;
      const body = (await res.json().catch(() => ({}))) as any;
      const rows: any[] = Array.isArray(body?.returns) ? body.returns : [];
      for (const raw of rows) {
        const mapped = mapServerReturn(raw);
        if (mapped) {
          records.push(mapped);
          const ts = Number(mapped.updatedAt) || Number(mapped.timestamp) || 0;
          if (ts > maxTs) maxTs = ts;
        }
      }
      if (rows.length < 200) break;
    } catch {
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  return { returns: records, maxTs };
};
