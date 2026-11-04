// نظام المزامنة والربط اللحظي للفروع عبر Supabase السحابي (RaiZon Pro)
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://cifijxcmmnosocnfizra.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl';

let supabaseInstance: SupabaseClient | null = null;
let lastConfig = { url: '', key: '' };

/** الحصول على كائن عميل Supabase مفرد ومضبوط */
export const getSupabaseClient = (url?: string, key?: string): SupabaseClient => {
  const targetUrl = (url || DEFAULT_SUPABASE_URL).trim();
  const targetKey = (key || DEFAULT_SUPABASE_ANON_KEY).trim();

  if (!supabaseInstance || lastConfig.url !== targetUrl || lastConfig.key !== targetKey) {
    supabaseInstance = createClient(targetUrl, targetKey, {
      auth: { persistSession: false },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastConfig = { url: targetUrl, key: targetKey };
  }
  return supabaseInstance;
};

/** اختبار الاتصال بالسيرفر السحابي والتحقق من الجداول */
export const testSupabaseConnection = async (url?: string, key?: string): Promise<{ ok: boolean; message: string }> => {
  try {
    const client = getSupabaseClient(url, key);
    const { error } = await client.from('branches').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        return { ok: false, message: 'الجداول غير موجودة بعد. يرجى تشغيل كود SQL في Supabase أولاً.' };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'متصل بالسحابة اللحظية بنجاح 🟢' };
  } catch (e: any) {
    return { ok: false, message: e.message || 'فشل الاتصال بقاعدة البيانات السحابية' };
  }
};

/** رفع فاتورة جديدة إلى سحابة Supabase فور حفظها */
export const pushInvoiceToSupabase = async (invoice: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const clientKey = invoice.client_key || `inv_${invoice.id}_${invoice.timestamp || Date.now()}`;
    const payload = {
      client_key: clientKey,
      invoice_number: String(invoice.id),
      branch_id: invoice.branchId || invoice.locationId || null,
      branch_name: invoice.branchName || null,
      customer_id: invoice.customerId ? String(invoice.customerId) : null,
      customer_name: invoice.customerName || null,
      phone: invoice.phone || null,
      subtotal: Number(invoice.subtotal || 0),
      discount_percent: Number(invoice.discountPercent || 0),
      tax_percent: Number(invoice.taxPercent || 0),
      total: Number(invoice.total || 0),
      payment_method: invoice.paymentMethod || 'cash',
      status: invoice.status || 'paid',
      notes: invoice.notes || null,
      staff_name: invoice.staffName || null,
      items: invoice.items || [],
      created_at: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
    };
    const { error } = await client.from('invoices').upsert(payload, { onConflict: 'client_key' });
    if (error) {
      console.warn('[Supabase Sync Invoice Error]', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    console.warn('[Supabase Sync Exception]', e);
    return { ok: false, error: e.message };
  }
};

/** مزامنة عميل جديد أو تحديث الرصيد/الديون سحابياً */
export const pushCustomerToSupabase = async (customer: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const payload = {
      id: String(customer.id),
      name: customer.name,
      phone: customer.phone || null,
      balance: Number(customer.balance || 0),
      credit_limit: Number(customer.creditLimit || 2000),
      notes: customer.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('customers').upsert(payload, { onConflict: 'id' });
    if (error) console.warn('[Supabase Customer Sync Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    console.warn('[Supabase Customer Sync Exception]', e);
    return { ok: false };
  }
};

/** مزامنة فرع جديد أو تعديل بيانات فرع */
export const pushBranchToSupabase = async (branch: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const payload = {
      id: String(branch.id),
      name: branch.name,
      address: branch.address || null,
      phone: branch.phone || null,
      active: branch.active !== false,
    };
    const { error } = await client.from('branches').upsert(payload, { onConflict: 'id' });
    if (error) console.warn('[Supabase Branch Sync Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    console.warn('[Supabase Branch Sync Exception]', e);
    return { ok: false };
  }
};

/** سحب كافة البيانات الحديثة من السحابة */
export const pullFromSupabase = async (url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const [invoicesRes, customersRes, branchesRes] = await Promise.all([
      client.from('invoices').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('customers').select('*').limit(500),
      client.from('branches').select('*').limit(50),
    ]);
    return {
      ok: true,
      invoices: invoicesRes.data || [],
      customers: customersRes.data || [],
      branches: branchesRes.data || [],
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

/** الاشتراك اللحظي الفوري لتلقي أي فواتير أو تعديلات من الفروع الأخرى */
export const subscribeSupabaseRealtime = (
  callbacks: {
    onNewInvoice?: (invoice: any) => void;
    onCustomerChange?: (customer: any) => void;
    onBranchChange?: (branch: any) => void;
  },
  url?: string,
  key?: string
) => {
  const client = getSupabaseClient(url, key);
  const channel = client.channel('procashier_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, payload => {
      callbacks.onNewInvoice?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
      callbacks.onCustomerChange?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, payload => {
      callbacks.onBranchChange?.(payload.new);
    })
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch (e) {
      console.warn('[Supabase Realtime unsubscribe error]', e);
    }
  };
};
