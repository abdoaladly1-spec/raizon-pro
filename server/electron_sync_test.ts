// اختبار شامل لمسار مزامنة تطبيق الويندوز -> السيرفر
// التشغيل:  node server/electron_sync_test.ts   (من جذر المشروع)
// يختبر: بناء الـ payload -> الطابور -> الإرسال -> idempotent -> إعادة المحاولة بعد الفشل

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const winTarget = new EventTarget();
(globalThis as any).window = {
  dispatchEvent: (e: Event) => winTarget.dispatchEvent(e),
  addEventListener: (...a: any[]) => (winTarget.addEventListener as any)(...a),
  removeEventListener: (...a: any[]) => (winTarget.removeEventListener as any)(...a),
};

// العزل: بدون SERVER_URL صريح نُشغّل سيرفراً معزولاً (قاعدة مؤقتة + مفتاح اختبار)
// فلا يلمس هذا الاختبار قاعدة الإنتاج ولا مفتاحها ولا مجلد النسخ الاحتياطي الحقيقي.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import net from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST_API_KEY = 'test-key-isolated-do-not-use';

const readEnvKey = (): string => {
  try {
    const envPath = join(HERE, '.env');
    if (!existsSync(envPath)) return '';
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (s.startsWith('API_KEY=')) {
        const v = s.slice(s.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
        return /^(off|none|disabled)$/i.test(v) ? '' : v;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
};

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });

let isolated: { proc: ChildProcess; dir: string } | null = null;

const cleanupIsolated = () => {
  if (!isolated) return;
  const { proc, dir } = isolated;
  isolated = null;
  try {
    if (proc.exitCode === null) proc.kill();
  } catch {
    /* ignore */
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
};
process.on('exit', cleanupIsolated);

/** إيقاف السيرفر وانتظاره فعلياً ثم حذف الملفات المؤقتة (Windows قد يبقي القفل). */
const cleanupIsolatedAsync = async () => {
  if (!isolated) return;
  const { proc, dir } = isolated;
  isolated = null;
  await new Promise<void>((resolve) => {
    if (proc.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        /* ignore */
      }
      resolve();
    }, 3000);
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      proc.kill();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
  for (let i = 0; i < 6; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (!existsSync(dir)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
};

let SERVER = '';
let API_KEY = '';

if (process.env.SERVER_URL) {
  SERVER = process.env.SERVER_URL;
  API_KEY = process.env.API_KEY || readEnvKey();
} else {
  const dir = mkdtempSync(join(tmpdir(), 'procashier_test_'));
  const port = await freePort();
  const proc = spawn('python', ['main.py'], {
    cwd: HERE,
    env: {
      ...process.env,
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: String(port),
      DB_PATH: join(dir, 'test.db'),
      PROCASHIER_BACKUP_DIR: join(dir, 'backups'),
      API_KEY: TEST_API_KEY,
      EMAIL_MODE: 'simulation',
      NOTIFY_ON_INVOICE: 'true',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      EMAIL_TO: 'tests@example.com',
    },
    stdio: 'ignore',
  });
  isolated = { proc, dir };
  SERVER = `http://127.0.0.1:${port}`;
  API_KEY = TEST_API_KEY;

  const deadline = Date.now() + 30000;
  let healthy = false;
  while (Date.now() < deadline && !healthy) {
    if (proc.exitCode !== null) break;
    try {
      const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(1000) });
      healthy = res.status === 200;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!healthy) {
    cleanupIsolated();
    throw new Error('isolated server did not become healthy in time');
  }
  console.log(`[isolated] server at ${SERVER} db=${join(dir, 'test.db')}`);
}
const CFG = { url: SERVER, apiKey: API_KEY };

let passed = 0;
let failed = 0;

const check = (name: string, ok: boolean, extra = '') => {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}${extra ? ' ' + extra : ''}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${extra ? ' ' + extra : ''}`);
  }
};

const sync: any = await import('../lib/serverSync.ts');

const api = async (path: string, init?: RequestInit) => {
  const headers: Record<string, string> = {
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...(((init?.headers as Record<string, string>) || {})),
  };
  const res = await fetch(`${SERVER}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
};

// --- 1) الاتصال ---
const conn = await sync.testConnection(CFG);
check('testConnection', conn.ok === true, conn.message);
check('lan_urls returned', Array.isArray(conn.lanUrls) && conn.lanUrls.length > 0, JSON.stringify(conn.lanUrls));
const health = (await api('/health')).body as any;
check('auth_required flag', health?.auth_required === !!API_KEY, `auth_required=${health?.auth_required}`);

// --- 1.1) المصادقة (لو المفتاح مفعّل) ---
if (API_KEY) {
  const noAuth = await fetch(`${SERVER}/api/invoices`);
  check('401 without API key', noAuth.status === 401, `status=${noAuth.status}`);
  const badKey = await fetch(`${SERVER}/api/invoices`, { headers: { 'X-API-Key': 'wrong-key' } });
  check('401 with wrong key', badKey.status === 401, `status=${badKey.status}`);
} else {
  check('API key disabled (API_KEY=off)', true, 'auth off');
}

// --- 2) بناء payload من فاتورة واقعية ---
const invoice = {
  id: 99001,
  locationId: '1',
  customerId: 7,
  customerName: 'زبون الاختبار',
  items: [
    { itemId: 'i1', name: 'قهوة', price: 25, quantity: 2 },
    { itemId: 'i2', name: 'شاي', price: 15, quantity: 1 },
  ],
  subtotal: 65,
  discountPercent: 10,
  taxPercent: 0,
  total: 58.5,
  date: new Date().toISOString().slice(0, 10),
  timestamp: 1790000000000,
  status: 'paid' as const,
  paymentMethod: 'cash' as const,
  createdBy: 'admin',
  staffName: 'أحمد',
};
const customer = { id: 7, name: 'زبون الاختبار', phone: '01000000001', loyaltyPoints: 5, tier: 'Silver' };
const settings = { currentLocationId: '1' };

const payload = sync.buildInvoicePayload(invoice, customer, settings);
check('payload fields', payload.local_id === 99001 && payload.customer_name === 'زبون الاختبار' && payload.phone === '01000000001');
check('payload math', payload.subtotal === 65 && payload.discount === 6.5 && payload.total === 58.5, JSON.stringify({ sub: payload.subtotal, disc: payload.discount, total: payload.total }));
check('payload items', payload.items.length === 2 && payload.items[0].name === 'قهوة');
check('client_key', typeof payload.client_key === 'string' && payload.client_key.split(':').length === 3, payload.client_key);

// --- 3) الطابور + منع التكرار ---
sync.setQueue([]);
sync.enqueueInvoice(payload);
sync.enqueueInvoice(payload);
check('queue dedupe', sync.getQueue().length === 1, `queue=${sync.getQueue().length}`);
check('status pending', sync.getSyncStatus().pending === 1);

// --- 4) الإرسال الفعلي ---
const r1 = await sync.flushQueue(CFG);
check('flush sends', r1.sent === 1 && r1.errors === 0, JSON.stringify(r1));
check('queue cleared', sync.getQueue().length === 0);

// --- 5) وصلت للسيرفر؟ ---
const found = await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}`);
const list: any[] = found.body?.invoices || [];
const row = list.find((i) => i.local_id === 99001);
check('server stored invoice', !!row, `found=${list.length}`);
check('server totals', row && Number(row.total) === 58.5 && Number(row.subtotal) === 65, row ? `total=${row.total}` : '');
check('server items', row && Array.isArray(row.items) && row.items.length === 2, row ? `items=${row.items.length}` : '');

// --- 5.1) المزامنة التنازلية (?since) تعتمد على وقت آخر تعديل لا وقت البيع ---
const rowTs = Number(row.updated_at) || 0;
check('server row has updated_at', rowTs > 0, `updated_at=${rowTs}`);
const sinceOld = await api(`/api/invoices?since=${Math.max(0, rowTs - 1)}&page_size=200`);
const oldList: any[] = sinceOld.body?.invoices || [];
check('since includes newer', oldList.some((i) => i.local_id === 99001), `count=${oldList.length}`);
const sinceNew = await api(`/api/invoices?since=${rowTs}&page_size=200`);
const newList: any[] = sinceNew.body?.invoices || [];
check('since excludes unchanged', !newList.some((i) => i.local_id === 99001), `count=${newList.length}`);

// --- 6) idempotent: إعادة الإرسال لا تكرر ---
sync.enqueueInvoice(payload);
const r2 = await sync.flushQueue(CFG);
check('reflush accepted', r2.sent === 1, JSON.stringify(r2));
const after = await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}`);
const rows: any[] = after.body?.invoices || [];
const dupes = rows.filter((i) => i.local_id === 99001);
check('no duplicate', dupes.length === 1, `count=${dupes.length}`);

// --- 7) الفشل يعيد المحاولة ---
sync.setQueue([]);
sync.enqueueInvoice(payload);
const bad = await sync.flushQueue({ url: 'http://127.0.0.1:9', apiKey: '' });
check('offline keeps queue', bad.errors === 1 && sync.getQueue().length === 1, JSON.stringify({ bad, q: sync.getQueue().length }));
check('status records error', !!sync.getSyncStatus().lastError, String(sync.getSyncStatus().lastError));
const retry = await sync.flushQueue(CFG);
check('retry succeeds', retry.sent === 1 && sync.getQueue().length === 0, JSON.stringify(retry));

// --- 8) عميل ---
const custPayload = sync.buildCustomerPayload(customer);
const before = await api(`/api/customers?q=${encodeURIComponent('زبون الاختبار')}`);
const beforeCount = (before.body?.results || []).length;
await sync.pushCustomer(CFG, custPayload);
const afterC = await api(`/api/customers?q=${encodeURIComponent('زبون الاختبار')}`);
const afterCount = (afterC.body?.results || []).length;
check('customer upsert', afterCount >= beforeCount, `before=${beforeCount} after=${afterCount}`);

// --- 9) الـ status events ---
let gotEvent = false;
sync.onSyncStatus(() => {
  gotEvent = true;
});
sync.notifySyncStatus();
check('status event fires', gotEvent);

// --- 10) نسخ احتياطي واستعادة من السيرفر ---
const backupState = { version: 1, note: 'نسخة الاختبار', items: [{ id: 'a', name: 'خدمة' }], invoices: [{ id: 1, total: 100 }] };
const push = await sync.pushBackup(CFG, backupState);
check('backup push', push.ok === true, JSON.stringify(push));
const pull = await sync.fetchBackup(CFG);
check(
  'backup fetch round-trip',
  pull.ok === true && pull.state?.note === backupState.note && pull.state?.items?.[0]?.name === 'خدمة',
  JSON.stringify({ ok: pull.ok, message: pull.message })
);
if (API_KEY) {
  const noAuth = await fetch(`${SERVER}/api/backup`);
  check('backup requires key (GET)', noAuth.status === 401, `status=${noAuth.status}`);
  const noAuthPost = await fetch(`${SERVER}/api/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupState),
  });
  check('backup requires key (POST)', noAuthPost.status === 401, `status=${noAuthPost.status}`);
}
const missing = await fetch(`${SERVER.replace(/\/+$/, '')}/api/backup`, { headers: { ...(API_KEY ? { 'X-API-Key': API_KEY } : {}) } });
check('backup endpoint present', missing.status === 200 || missing.status === 404, `status=${missing.status}`);

// --- 11) الهوية الثابتة uid ---
const payloadUid = sync.buildInvoicePayload({ ...invoice, uid: 'uid-e2e-1', id: 99002 }, customer, settings);
check('payload uid identity', payloadUid.uid === 'uid-e2e-1' && payloadUid.client_key === 'uid-e2e-1', String(payloadUid.client_key));

// --- 12) دمج السحب (دالة نقية) ---
const base = { uid: 'u-1', timestamp: 1790000001000, total: 42, customerName: 'merged' };
const rDup = sync.mergePulledInvoices([base], [{ ...base }]);
check('merge: لا تكرار بنفس الهوية', rDup.changed === false && rDup.invoices.length === 1, `n=${rDup.invoices.length}`);
const rLock = sync.mergePulledInvoices([base], [{ ...base, total: 999, customerName: 'other' }]);
check('merge: الفاتورة مقفلة بعد البيع', rLock.changed === false && rLock.invoices[0].total === 42, `total=${rLock.invoices[0].total}`);
const rDel = sync.mergePulledInvoices([base], [{ ...base, deleted: 1 }]);
check('merge: tombstone يحذف النسخة المحلية', rDel.changed === true && rDel.invoices.length === 0, `n=${rDel.invoices.length}`);
const legacy = { timestamp: 1790000002000, total: 77, customerName: 'legacy' };
const rAdopt = sync.mergePulledInvoices([legacy], [{ ...legacy, uid: 'u-2' }]);
check('merge: تبنّي uid لبيانات قديمة', rAdopt.changed === true && rAdopt.invoices.length === 1 && rAdopt.invoices[0].uid === 'u-2', String(rAdopt.invoices[0]?.uid));
const rNew = sync.mergePulledInvoices([], [{ uid: 'u-3', timestamp: 3, total: 5, customerName: 'new' }]);
check('merge: إضافة فاتورة جديدة', rNew.changed === true && rNew.invoices.length === 1, `n=${rNew.invoices.length}`);
const rUnknownTomb = sync.mergePulledInvoices([], [{ uid: 'u-9', timestamp: 4, total: 5, customerName: 'x', deleted: 1 }]);
check('merge: تجاهل ملغاة لا نعرفها', rUnknownTomb.changed === false && rUnknownTomb.invoices.length === 0, `n=${rUnknownTomb.invoices.length}`);

// --- 13) uid على السيرفر + حذف منطقي ينتشر بالسحب ---
const pushUid = sync.buildInvoicePayload({ ...invoice, uid: 'e2e-uid-1', id: 99003 }, customer, settings);
sync.enqueueInvoice(pushUid);
const sentUid = await sync.flushQueue(CFG);
check('push uid invoice', sentUid.sent === 1 && sentUid.errors === 0, JSON.stringify(sentUid));
const sumBefore = await api('/api/stats/summary');
const beforeDel = await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}&page_size=200`);
const rowUid = ((beforeDel.body?.invoices || []) as any[]).find((i) => i.uid === 'e2e-uid-1');
check('server stores uid', !!rowUid, rowUid ? `id=${rowUid.id}` : 'missing');
const mark = Date.now() - 1;
const delRes = await fetch(`${SERVER}/api/invoices/e2e-uid-1`, {
  method: 'DELETE',
  headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
});
check('DELETE soft delete', delRes.status === 200, `status=${delRes.status}`);
const pullTomb = await api(`/api/invoices?since=${mark}&page_size=200`);
const tombRow = ((pullTomb.body?.invoices || []) as any[]).find((i) => i.uid === 'e2e-uid-1');
check('pull returns tombstone', !!tombRow && Number(tombRow.deleted) === 1, tombRow ? `deleted=${tombRow.deleted}` : 'missing');
const plain = await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}&page_size=200`);
check('list hides deleted', !((plain.body?.invoices || []) as any[]).some((i) => i.uid === 'e2e-uid-1'));
const sumAfter = await api('/api/stats/summary');
check(
  'summary excludes deleted',
  Number(sumAfter.body?.invoices) === Number(sumBefore.body?.invoices) - 1,
  `before=${sumBefore.body?.invoices} after=${sumAfter.body?.invoices}`,
);
const delAgain = await fetch(`${SERVER}/api/invoices/e2e-uid-1`, {
  method: 'DELETE',
  headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
});
check('DELETE idempotent', delAgain.status === 200, `status=${delAgain.status}`);

// --- 14) الدفع المختلط عبر مسار المزامنة (جزء نقدي + غير نقدي) ---
const cashBefore = Number((await api('/api/stats/summary')).body?.cash_sales);
const splitInvoice = {
  ...invoice,
  uid: 'e2e-split-1',
  id: 99004,
  total: 300,
  subtotal: 300,
  discountPercent: 0,
  paymentMethod: 'mixed',
  paymentParts: [
    { method: 'card', amount: 200 },
    { method: 'cash', amount: 100 },
  ],
  cashPaid: 100,
  received: 150,
  change: 50,
};
const splitPayload = sync.buildInvoicePayload(splitInvoice, customer, settings);
check(
  'split payload fields',
  Array.isArray(splitPayload.payment_parts)
    && splitPayload.payment_parts.length === 2
    && splitPayload.cash_paid === 100
    && splitPayload.received === 150
    && splitPayload.change === 50,
  JSON.stringify({ parts: splitPayload.payment_parts, cash: splitPayload.cash_paid, received: splitPayload.received }),
);
const splitSum = (splitPayload.payment_parts || []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
check('split payload sum == total', splitSum === 300 && splitSum === splitPayload.total, `sum=${splitSum} total=${splitPayload.total}`);

sync.setQueue([]);
sync.enqueueInvoice(splitPayload);
const splitSent = await sync.flushQueue(CFG);
check('split flush', splitSent.sent === 1 && splitSent.errors === 0, JSON.stringify(splitSent));

// انقطاع الاتصال ثم إعادة الإرسال: الطابور يحتفظ بالفاتورة ولا تضيع
sync.enqueueInvoice(splitPayload);
const splitOffline = await sync.flushQueue({ url: 'http://127.0.0.1:9', apiKey: '' });
check(
  'split offline keeps queue',
  splitOffline.errors === 1 && sync.getQueue().length === 1,
  JSON.stringify({ splitOffline, q: sync.getQueue().length }),
);
const splitRetry = await sync.flushQueue(CFG);
check('split retry succeeds', splitRetry.sent === 1 && sync.getQueue().length === 0, JSON.stringify(splitRetry));

const splitList = ((await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}&page_size=200`)).body?.invoices || []) as any[];
const splitRows = splitList.filter((i) => i.uid === 'e2e-split-1');
const splitRow = splitRows[0];
check('split no duplicate', splitRows.length === 1, `count=${splitRows.length}`);
check(
  'server stores split parts',
  !!splitRow
    && Array.isArray(splitRow.payment_parts)
    && splitRow.payment_parts.length === 2
    && Number(splitRow.cash_paid) === 100
    && Number(splitRow.received) === 150
    && Number(splitRow.change) === 50,
  splitRow ? JSON.stringify({ parts: splitRow.payment_parts, cash: splitRow.cash_paid }) : 'missing',
);

const cashAfter = Number((await api('/api/stats/summary')).body?.cash_sales);
check('split cash_sales adds 100 only', Math.abs(cashAfter - cashBefore - 100) < 0.01, `${cashBefore} -> ${cashAfter}`);

// فاتورة قديمة (بلا تقسيم): الحقول تصل null والسيرفر يشتقها من payment_method
const legacyPayload = sync.buildInvoicePayload({ ...invoice, uid: 'e2e-legacy-1', id: 99005, paymentMethod: 'cash' }, customer, settings);
check('legacy payload has no parts', legacyPayload.payment_parts === null && legacyPayload.cash_paid === null, JSON.stringify({ parts: legacyPayload.payment_parts }));
sync.setQueue([]);
sync.enqueueInvoice(legacyPayload);
await sync.flushQueue(CFG);
const legacyRow = (((await api(`/api/invoices?search=${encodeURIComponent('زبون الاختبار')}&page_size=200`)).body?.invoices || []) as any[]).find((i) => i.uid === 'e2e-legacy-1');
check(
  'legacy round-trip empty parts',
  !!legacyRow && (legacyRow.payment_parts === null || legacyRow.payment_parts === undefined)
    && (legacyRow.received === null || legacyRow.received === undefined),
  legacyRow ? JSON.stringify({ parts: legacyRow.payment_parts, received: legacyRow.received }) : 'missing',
);

// ============================================================
// --- المرتجعات: payload -> طابور -> اعتماد/رفض -> سحب/دمج ---
// ============================================================
const INV_UID = payload.uid;
const retItem = {
  itemId: 'i1', name: 'قهوة', quantity: 1, price: 25,
  discountAmount: 2.5, taxAmount: 0, refundAmount: 22.5,
  returnable: true, trackStock: true, type: 'product', restocked: false,
};
const retRec: any = {
  uid: 'ret-e2e-1', id: 1, invoiceUid: INV_UID, invoiceId: 99001,
  items: [retItem], refundAmount: 22.5, refundParts: [{ method: 'cash', amount: 22.5 }],
  cashRefund: 22.5, type: 'partial', status: 'pending', reason: 'عيب مصنعي',
  staffName: 'أحمد', createdBy: 'admin', customerId: 7, customerName: 'زبون الاختبار',
  locationId: '1', pointsReversed: 0, commissionReversed: 0,
  date: '2026-09-30', timestamp: Date.now(), createdAt: '', updatedAt: Date.now(),
};
const retPayload = sync.buildReturnPayload(retRec, invoice, settings);
check(
  'return payload fields (wire status=approved)',
  retPayload.uid === 'ret-e2e-1' && retPayload.invoice_uid === INV_UID && retPayload.status === 'approved',
  JSON.stringify({ uid: retPayload.uid, invoice: retPayload.invoice_uid, status: retPayload.status }),
);
check(
  'return payload amounts',
  retPayload.refund_amount === 22.5 && retPayload.cash_refund === 22.5
    && retPayload.refund_parts.length === 1 && retPayload.refund_parts[0].method === 'cash',
  JSON.stringify(retPayload.refund_parts),
);

sync.setReturnQueue([]);
sync.enqueueReturn(retPayload);
sync.enqueueReturn(retPayload);
check('return queue dedupe', sync.getReturnQueue().length === 1, `q=${sync.getReturnQueue().length}`);
check('return queue count helper', sync.returnQueueCount() === 1, `count=${sync.returnQueueCount()}`);

const retSent = await sync.flushReturnQueue(CFG);
check(
  'return flush approves (server 200)',
  retSent.sent === 1 && retSent.errors === 0 && retSent.approved.includes('ret-e2e-1') && sync.getReturnQueue().length === 0,
  JSON.stringify(retSent),
);

const retList = ((await api(`/api/returns?since=0&page_size=200`)).body?.returns || []) as any[];
const retRow = retList.find((r) => r.uid === 'ret-e2e-1');
check(
  'return stored on server',
  !!retRow && Math.abs(Number(retRow.refund_amount) - 22.5) < 0.01 && retRow.status === 'approved',
  retRow ? JSON.stringify({ amount: retRow.refund_amount, status: retRow.status, parts: retRow.refund_parts }) : 'missing',
);

// انقطاع الاتصال ثم إعادة الإرسال: الطابور يحتفظ بالمرتجع ولا يضيع
sync.enqueueReturn(retPayload);
const retOffline = await sync.flushReturnQueue({ url: 'http://127.0.0.1:9', apiKey: '' });
check('return offline keeps queue', retOffline.errors === 1 && sync.getReturnQueue().length === 1, JSON.stringify(retOffline));
const retRetry = await sync.flushReturnQueue(CFG);
check(
  'return retry succeeds idempotently',
  retRetry.sent === 1 && sync.getReturnQueue().length === 0 && retRetry.approved.includes('ret-e2e-1'),
  JSON.stringify(retRetry),
);
const retCount = (((await api(`/api/returns?since=0&page_size=200`)).body?.returns || []) as any[])
  .filter((r) => r.uid === 'ret-e2e-1').length;
check('return no duplicate', retCount === 1, `count=${retCount}`);

// جهاز ثانٍ: نفس الكمية (للكمية المتبقية فقط قطعة واحدة) -> 409 ويُخرَج نهائياً
const conflictRec = { ...retRec, uid: 'ret-e2e-conflict', items: [{ ...retItem, quantity: 2, refundAmount: 45 }], refundAmount: 45, timestamp: Date.now(), updatedAt: Date.now() };
const conflictPayload = sync.buildReturnPayload(conflictRec, invoice, settings);
sync.setReturnQueue([]);
sync.enqueueReturn(conflictPayload);
const conflictFlush = await sync.flushReturnQueue(CFG);
check(
  'return qty conflict rejected permanently (409)',
  conflictFlush.rejected.length === 1 && conflictFlush.rejected[0].detail === 'return_qty_exceeded'
    && sync.getReturnQueue().length === 0,
  JSON.stringify(conflictFlush),
);

// مبلغ غير مطابق لحساب السيرفر -> 400 ورفض دائم
const badRec = { ...retRec, uid: 'ret-e2e-bad', refundAmount: 5, items: [{ ...retItem, refundAmount: 5 }], timestamp: Date.now(), updatedAt: Date.now() };
const badPayload = sync.buildReturnPayload(badRec, invoice, settings);
sync.setReturnQueue([]);
sync.enqueueReturn(badPayload);
const badFlush = await sync.flushReturnQueue(CFG);
check(
  'return bad amount rejected permanently (400)',
  badFlush.rejected.length === 1 && badFlush.rejected[0].detail === 'return_amount_exceeded'
    && sync.getReturnQueue().length === 0,
  JSON.stringify(badFlush),
);

// مرتجع ثانٍ ناجح (باقٍ من نفس الصنف) حتى يصبح المجموع 45
const ret2Rec = { ...retRec, uid: 'ret-e2e-2', id: 2, timestamp: Date.now(), updatedAt: Date.now() };
sync.setReturnQueue([]);
sync.enqueueReturn(sync.buildReturnPayload(ret2Rec, invoice, settings));
const ret2Sent = await sync.flushReturnQueue(CFG);
check('second return flush', ret2Sent.sent === 1 && ret2Sent.approved.includes('ret-e2e-2'), JSON.stringify(ret2Sent));
const returnsTotal = Number((await api('/api/stats/summary')).body?.returns_total);
check('summary returns_total = 45', Math.abs(returnsTotal - 45) < 0.01, `returns_total=${returnsTotal}`);

// --- السحب التنازلية + الدمج ---
const pulled = await sync.pullReturns(CFG, 0);
const ours = pulled.returns.filter((r: any) => r.invoiceUid === INV_UID);
check(
  'pull returns maps server rows',
  ours.length === 2 && ours.every((r: any) => r.status === 'approved')
    && ours.some((r: any) => Math.abs(r.refundAmount - 22.5) < 0.01),
  JSON.stringify(ours.map((r: any) => ({ uid: r.uid, amount: r.refundAmount, status: r.status }))),
);
check('pull returns maxTs', pulled.maxTs > 0, String(pulled.maxTs));

// سجلات جديدة من جهاز آخر => تُضاف مع تطبيق آثارها محلياً
const mergeNew = sync.mergePulledReturns([], pulled.returns);
check(
  'merge adds remote returns with effects',
  mergeNew.changed === true
    && mergeNew.returns.length === pulled.returns.length
    && mergeNew.toApply.filter((r: any) => r.status === 'approved').length === pulled.returns.length,
  JSON.stringify({ returns: mergeNew.returns.length, apply: mergeNew.toApply.length }),
);

// سجل محلي "معلّق" وصل اعتماده => انتقال لمعتمد + تأثير واحد
const pendingLocal = { ...ours[0], status: 'pending' };
const mergePending = sync.mergePulledReturns([pendingLocal], pulled.returns);
check(
  'merge promotes pending to approved',
  mergePending.changed === true
    && mergePending.returns.find((r: any) => r.uid === ours[0].uid)?.status === 'approved'
    && mergePending.toApply.some((r: any) => r.uid === ours[0].uid),
  JSON.stringify(mergePending.returns.map((r: any) => r.status)),
);

// سجل معتمد محلياً لا يُستبدل ولا يُعاد تأثيره (يُضاف فقط البعيد الغريب)
const approvedLocal = { ...ours[0], status: 'approved' };
const mergeAgain = sync.mergePulledReturns([approvedLocal], pulled.returns);
check(
  'merge keeps approved without reapplying',
  !mergeAgain.toApply.some((r: any) => r.uid === approvedLocal.uid)
    && mergeAgain.returns.find((r: any) => r.uid === approvedLocal.uid)?.status === 'approved'
    && mergeAgain.returns.length === pulled.returns.length,
  JSON.stringify({ changed: mergeAgain.changed, apply: mergeAgain.toApply.map((r: any) => r.uid) }),
);

// سحب منذ وقت حديث = لا شيء جديد
const pulledFresh = await sync.pullReturns(CFG, pulled.maxTs);
check('pull returns since fresh is empty', pulledFresh.returns.length === 0, `count=${pulledFresh.returns.length}`);
sync.setReturnQueue([]);

console.log('-'.repeat(60));
console.log(`${passed}/${passed + failed} اختبارات ناجحة`);
if (failed > 0) {
  console.log(`${failed} اختبار فاشل`);
}
await cleanupIsolatedAsync();
process.exitCode = failed > 0 ? 1 : 0;
// انتظار قصير لإغلاق اتصالات HTTP قبل خروج Node
await new Promise((r) => setTimeout(r, 500));
