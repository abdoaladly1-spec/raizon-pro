// نظام المزامنة والربط اللحظي للفروع عبر Supabase السحابي (RaiZon Pro)
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://cifijxcmmnosocnfizra.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl';

export const CLOUD_ACCOUNT_KEY = 'procashier_cloud_account';

export interface CloudAccountInfo {
  username: string; // اسم الحساب السحابي / المنشأة
  password?: string; // كلمة مرور حساب المدير للتحقق عند تسجيل الخروج
  passwordHash?: string;
  branchId: string; // معرف الفرع المربوط به هذا الجهاز
  branchName: string; // اسم الفرع
  deviceId: string; // معرف الجهاز الفريد
  deviceName: string; // اسم الجهاز (مثلاً كاشير 1)
  connectedAt: number; // وقت الاتصال لأول مرة
  lastSyncAt: number; // وقت آخر مزامنة
  avatarSeed?: string; // رمز شكل صورة البروفايل
  supabaseUrl?: string;
  supabaseKey?: string;
}

/** قراءة بيانات الحساب السحابي المحفوظ */
export const getCloudAccount = (): CloudAccountInfo | null => {
  try {
    const raw = localStorage.getItem(CLOUD_ACCOUNT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

/** حفظ بيانات الحساب السحابي والفرع */
export const saveCloudAccount = (account: CloudAccountInfo) => {
  try {
    localStorage.setItem(CLOUD_ACCOUNT_KEY, JSON.stringify(account));
    localStorage.setItem('supabase_account_user', account.username);
  } catch (e) {
    console.error('Failed to save cloud account', e);
  }
};

/** حذف الحساب السحابي عند تسجيل الخروج التام */
export const clearCloudAccount = () => {
  try {
    localStorage.removeItem(CLOUD_ACCOUNT_KEY);
    localStorage.removeItem('supabase_account_user');
  } catch (e) {
    console.error('Failed to clear cloud account', e);
  }
};

/** هل الحساب السحابي معد بالفعل مسبقاً؟ */
export const isCloudAccountConfigured = (): boolean => {
  const acc = getCloudAccount();
  return !!(acc && acc.username?.trim() && acc.branchId);
};

let supabaseInstance: SupabaseClient | null = null;
let lastConfig = { url: '', key: '' };

let activeRealtimeChannel: RealtimeChannel | null = null;
let activePresenceChannel: RealtimeChannel | null = null;

let currentDevicesCount = 1;
let currentDevicesList: any[] = [];
let lastSyncTimestamp = Date.now();

const devicesListeners = new Set<(count: number, devices: any[]) => void>();
const syncListeners = new Set<(ts: number) => void>();

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

/** تحديث وتنبيه بآخر توقيت مزامنة */
export const touchLastSync = () => {
  lastSyncTimestamp = Date.now();
  syncListeners.forEach(listener => {
    try { listener(lastSyncTimestamp); } catch (e) {}
  });
};

export const getLastSyncTimestamp = () => lastSyncTimestamp;

export const subscribeLastSync = (cb: (ts: number) => void) => {
  syncListeners.add(cb);
  cb(lastSyncTimestamp);
  return () => {
    syncListeners.delete(cb);
  };
};

/** عدد الأجهزة المتصلة حالياً */
export const getConnectedDevicesCount = () => Math.max(1, currentDevicesCount);
export const getConnectedDevicesList = () => currentDevicesList;

export const subscribeDevicesCount = (cb: (count: number, devices: any[]) => void) => {
  devicesListeners.add(cb);
  cb(Math.max(1, currentDevicesCount), currentDevicesList);
  return () => {
    devicesListeners.delete(cb);
  };
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
    return { ok: true, message: 'متصل بالسحابة اللحظية بنجاح' };
  } catch (e: any) {
    return { ok: false, message: e.message || 'فشل الاتصال بقاعدة البيانات السحابية' };
  }
};

/** رفع فاتورة جديدة إلى سحابة Supabase فور حفظها */
export const pushInvoiceToSupabase = async (invoice: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const clientKey = invoice.client_key || invoice.uid || `inv_${invoice.id}_${invoice.timestamp || Date.now()}`;
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
    touchLastSync();
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
    touchLastSync();
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
    touchLastSync();
    if (error) console.warn('[Supabase Branch Sync Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    console.warn('[Supabase Branch Sync Exception]', e);
    return { ok: false };
  }
};

/** حذف فرع من سحابة Supabase */
export const deleteBranchFromSupabase = async (branchId: string, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const { error } = await client.from('branches').delete().eq('id', String(branchId));
    touchLastSync();
    if (error) console.warn('[Supabase Branch Delete Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    console.warn('[Supabase Branch Delete Exception]', e);
    return { ok: false };
  }
};

/** مزامنة مستخدمي النظام سحابياً (إضافة، تعديل باسورد، أو صلاحيات فرع آخر) */
export const pushUserToSupabase = async (user: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    // 1. إرسال broadcast فوري لجميع الأجهزة النشطة في الفروع الأخرى
    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'user_sync',
        payload: { action: 'upsert', user }
      }).catch(() => {});
    }

    // 2. محاولة الحفظ في جدول system_users أولاً
    const sysUserPayload = {
      id: String(user.id),
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      active: user.active !== false,
      location_id: user.locationId || null,
      password_hash: user.passwordHash || null,
      password_salt: user.passwordSalt || null,
      pin_hash: user.pinHash || null,
      pin_salt: user.pinSalt || null,
      must_change_password: !!user.mustChangePassword,
      last_login: user.lastLogin || null,
      updated_at: new Date().toISOString()
    };

    const { error: sysError } = await client.from('system_users').upsert(sysUserPayload, { onConflict: 'id' });
    
    // 3. حفظ نسخة احتياطية في مساحة تخزين متوافقة (جدول customers مع بادئة __sys_user_)
    // لضمان التزامن حتى لو لم يتم إنشاء جدول system_users بعد
    const fallbackId = `__sys_user_${user.id}`;
    try {
      await client.from('customers').upsert({
        id: fallbackId,
        name: user.username,
        phone: user.role,
        balance: 0,
        credit_limit: 0,
        notes: JSON.stringify(user),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {}

    if (sysError && sysError.code !== 'PGRST205') {
      console.warn('[Supabase pushUser Error]', sysError.message);
    }
    return { ok: true };
  } catch (e: any) {
    console.warn('[Supabase pushUser Exception]', e);
    return { ok: false, error: e.message };
  }
};

/** حذف مستخدم سحابياً */
export const deleteUserFromSupabase = async (userId: string, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    // 1. Broadcast فوري للفروع الأخرى
    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'user_sync',
        payload: { action: 'delete', userId }
      }).catch(() => {});
    }

    // 2. الحذف من system_users
    try {
      await client.from('system_users').delete().eq('id', String(userId));
    } catch (e) {}
    
    // 3. الحذف من جدول النسخ الاحتياطي
    const fallbackId = `__sys_user_${userId}`;
    try {
      await client.from('customers').delete().eq('id', fallbackId);
    } catch (e) {}

    return { ok: true };
  } catch (e: any) {
    console.warn('[Supabase deleteUser Exception]', e);
    return { ok: false };
  }
};

/** سحب مستخدمي النظام من السحابة */
export const pullUsersFromSupabase = async (url?: string, key?: string): Promise<{ ok: boolean; users: any[] }> => {
  try {
    const client = getSupabaseClient(url, key);
    const usersMap = new Map<string, any>();

    // محاولة القراءة من system_users
    const { data: sysUsers, error: sysError } = await client.from('system_users').select('*');
    if (!sysError && sysUsers && sysUsers.length > 0) {
      for (const u of sysUsers) {
        usersMap.set(String(u.id), {
          id: String(u.id),
          username: u.username,
          name: u.name,
          role: u.role,
          permissions: u.permissions || [],
          active: u.active !== false,
          locationId: u.location_id || undefined,
          passwordHash: u.password_hash || undefined,
          passwordSalt: u.password_salt || undefined,
          pinHash: u.pin_hash || undefined,
          pinSalt: u.pin_salt || undefined,
          mustChangePassword: !!u.must_change_password,
          lastLogin: u.last_login ? Number(u.last_login) : undefined
        });
      }
    }

    // قراءة من النسخ الاحتياطي (__sys_user_)
    const { data: fbUsers, error: fbError } = await client
      .from('customers')
      .select('*')
      .ilike('id', '__sys_user_%');

    if (!fbError && fbUsers && fbUsers.length > 0) {
      for (const row of fbUsers) {
        try {
          if (row.notes) {
            const parsed = JSON.parse(row.notes);
            if (parsed && parsed.id && !usersMap.has(String(parsed.id))) {
              usersMap.set(String(parsed.id), parsed);
            }
          }
        } catch (e) {}
      }
    }

    return { ok: true, users: Array.from(usersMap.values()) };
  } catch (e: any) {
    return { ok: false, users: [] };
  }
};

/** سحب كافة البيانات الحديثة من السحابة (فواتير، عملاء، فروع) */
export const pullFromSupabase = async (url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const [invoicesRes, customersRes, branchesRes] = await Promise.all([
      client.from('invoices').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('customers').select('*').limit(500),
      client.from('branches').select('*').limit(50),
    ]);
    touchLastSync();
    
    // تصفية العملاء العاديين من السجلات الخاصة بـ __sys_
    const rawCustomers = customersRes.data || [];
    const regularCustomers = rawCustomers.filter((c: any) => !String(c.id).startsWith('__sys_'));

    return {
      ok: true,
      invoices: invoicesRes.data || [],
      customers: regularCustomers,
      branches: branchesRes.data || [],
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

/** الاشتراك اللحظي الفوري لتلقي أي فواتير أو تعديلات ومستخدمين من الفروع الأخرى */
export const subscribeSupabaseRealtime = (
  callbacks: {
    onNewInvoice?: (invoice: any) => void;
    onCustomerChange?: (customer: any) => void;
    onBranchChange?: (branch: any, eventType?: string, oldRecord?: any) => void;
    onUserChange?: (action: 'upsert' | 'delete', userOrId: any) => void;
    onDevicesCountChange?: (count: number, devices: any[]) => void;
    onSyncTick?: (lastSyncTs: number) => void;
  },
  url?: string,
  key?: string
) => {
  const client = getSupabaseClient(url, key);
  const account = getCloudAccount();
  const accountUser = (account?.username || 'procashier_main').trim().toLowerCase();
  const deviceId = account?.deviceId || `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const branchName = account?.branchName || 'الفرع الرئيسي';

  // قناة التبادل اللحظي للبيانات والمستخدمين
  const channel = client.channel('procashier_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, payload => {
      touchLastSync();
      callbacks.onNewInvoice?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
      touchLastSync();
      const rec: any = payload.new || payload.old;
      if (rec && String(rec.id).startsWith('__sys_user_')) {
        // تحديث مستخدم احتياطي
        if (payload.eventType === 'DELETE') {
          const uId = String(rec.id).replace('__sys_user_', '');
          callbacks.onUserChange?.('delete', uId);
        } else if (rec.notes) {
          try {
            const u = JSON.parse(rec.notes);
            callbacks.onUserChange?.('upsert', u);
          } catch (e) {}
        }
        return;
      }
      callbacks.onCustomerChange?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, payload => {
      touchLastSync();
      callbacks.onBranchChange?.(payload.new, payload.eventType, payload.old);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, payload => {
      touchLastSync();
      if (payload.eventType === 'DELETE') {
        callbacks.onUserChange?.('delete', String(payload.old?.id));
      } else if (payload.new) {
        const u = payload.new;
        callbacks.onUserChange?.('upsert', {
          id: String(u.id),
          username: u.username,
          name: u.name,
          role: u.role,
          permissions: u.permissions || [],
          active: u.active !== false,
          locationId: u.location_id || undefined,
          passwordHash: u.password_hash || undefined,
          passwordSalt: u.password_salt || undefined,
          pinHash: u.pin_hash || undefined,
          pinSalt: u.pin_salt || undefined,
          mustChangePassword: !!u.must_change_password,
          lastLogin: u.last_login ? Number(u.last_login) : undefined
        });
      }
    })
    .on('broadcast', { event: 'user_sync' }, payload => {
      touchLastSync();
      const p = payload.payload;
      if (p && p.action && (p.user || p.userId)) {
        callbacks.onUserChange?.(p.action, p.user || p.userId);
      }
    })
    .subscribe();

  activeRealtimeChannel = channel;

  // قناة تتبع الأجهزة المتصلة على نفس الحساب السحابي (Supabase Presence)
  const presenceRoom = client.channel(`procashier_pres_${accountUser}`, {
    config: { presence: { key: deviceId } }
  });

  presenceRoom.on('presence', { event: 'sync' }, () => {
    touchLastSync();
    const presState = presenceRoom.presenceState();
    const keys = Object.keys(presState);
    const count = Math.max(1, keys.length);
    currentDevicesCount = count;
    currentDevicesList = Object.values(presState).flat();
    callbacks.onDevicesCountChange?.(count, currentDevicesList);
    devicesListeners.forEach(listener => {
      try { listener(count, currentDevicesList); } catch (e) {}
    });
  });

  presenceRoom.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      try {
        await presenceRoom.track({
          deviceId,
          deviceName: account?.deviceName || 'كاشير الجهاز',
          branchId: account?.branchId || '1',
          branchName,
          accountUser,
          onlineAt: Date.now()
        });
      } catch (e) {}
    }
  });

  activePresenceChannel = presenceRoom;

  return () => {
    try {
      if (activeRealtimeChannel) {
        client.removeChannel(activeRealtimeChannel);
        activeRealtimeChannel = null;
      }
      if (activePresenceChannel) {
        presenceRoom.untrack().catch(() => {});
        client.removeChannel(activePresenceChannel);
        activePresenceChannel = null;
      }
    } catch (e) {
      console.warn('[Supabase Realtime unsubscribe error]', e);
    }
  };
};
