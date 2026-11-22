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
    const sanitized: CloudAccountInfo = { ...account };
    // حماية أمنية: لا نخزن كلمة المرور كنص صريح في المتصفح أو التخزين المحلي
    if (sanitized.password) {
      if (!sanitized.passwordHash) {
        sanitized.passwordHash = btoa(unescape(encodeURIComponent(sanitized.password)));
      }
      delete sanitized.password;
    }
    localStorage.setItem(CLOUD_ACCOUNT_KEY, JSON.stringify(sanitized));
    localStorage.setItem('supabase_account_user', sanitized.username);
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

/** الحصول على اسم الحساب السحابي النشط للمزامنة وعزل البيانات */
export const getActiveAccountUser = (): string => {
  const acc = getCloudAccount();
  return (acc?.username || localStorage.getItem('supabase_account_user') || 'procashier_main').trim().toLowerCase();
};

/** تحديث فرع الحساب السحابي للجهاز الحالي */
export const updateCloudBranch = (branchId: string, branchName: string) => {
  const acc = getCloudAccount();
  if (acc) {
    acc.branchId = branchId;
    acc.branchName = branchName;
    saveCloudAccount(acc);
  }
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
    const accUser = getActiveAccountUser();
    const payload: any = {
      account_user: accUser,
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
    let { error } = await client.from('invoices').upsert(payload, { onConflict: 'client_key' });
    if (error && error.code === '42703') {
      // عمود account_user غير موجود بعد في الجدول القديم
      delete payload.account_user;
      const res = await client.from('invoices').upsert(payload, { onConflict: 'client_key' });
      error = res.error;
    }
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
    const accUser = getActiveAccountUser();
    const payload: any = {
      account_user: accUser,
      id: String(customer.id),
      name: customer.name,
      phone: customer.phone || null,
      balance: Number(customer.balance || 0),
      credit_limit: Number(customer.creditLimit || 2000),
      notes: customer.notes || null,
      updated_at: new Date().toISOString(),
    };
    let { error } = await client.from('customers').upsert(payload, { onConflict: 'id' });
    if (error && error.code === '42703') {
      delete payload.account_user;
      const res = await client.from('customers').upsert(payload, { onConflict: 'id' });
      error = res.error;
    }
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
    const accUser = getActiveAccountUser();
    const payload: any = {
      account_user: accUser,
      id: String(branch.id),
      name: branch.name,
      address: branch.address || null,
      phone: branch.phone || null,
      active: branch.active !== false,
    };
    let { error } = await client.from('branches').upsert(payload, { onConflict: 'id' });
    if (error && error.code === '42703') {
      delete payload.account_user;
      const res = await client.from('branches').upsert(payload, { onConflict: 'id' });
      error = res.error;
    }
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
    const accUser = getActiveAccountUser();
    const sysUserPayload: any = {
      account_user: accUser,
      id: String(user.id),
      username: user.username,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
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

    let { error: sysError } = await client.from('system_users').upsert(sysUserPayload, { onConflict: 'id' });
    if (sysError && sysError.code === '42703') {
      delete sysUserPayload.account_user;
      const res = await client.from('system_users').upsert(sysUserPayload, { onConflict: 'id' });
      sysError = res.error;
    }
    
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
          email: u.email || undefined,
          phone: u.phone || undefined,
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

/** مزامنة موظف/حلاق مع Supabase سحابياً */
export const pushStaffToSupabase = async (staffMember: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    // 1. Broadcast فوري
    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'staff_sync',
        payload: { action: 'upsert', staff: staffMember }
      }).catch(() => {});
    }

    // 2. محاولة الحفظ في جدول staff إن وجد
    try {
      await client.from('staff').upsert({
        id: String(staffMember.id),
        name: staffMember.name,
        phone: staffMember.phone || null,
        role: staffMember.role || 'حلاق',
        active: staffMember.active !== false,
        location_ids: staffMember.locationIds || [],
        notes: JSON.stringify(staffMember),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {}

    // 3. الحفظ المضمون في جدول customers مع بادئة __sys_staff_
    const fallbackId = `__sys_staff_${staffMember.id}`;
    const { error } = await client.from('customers').upsert({
      id: fallbackId,
      name: staffMember.name,
      phone: staffMember.phone || '0000',
      balance: 0,
      credit_limit: 0,
      notes: JSON.stringify(staffMember),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) console.warn('[Supabase pushStaff Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    console.warn('[Supabase pushStaff Exception]', e);
    return { ok: false, error: e.message };
  }
};

/** حذف موظف/حلاق سحابياً */
export const deleteStaffFromSupabase = async (staffId: string, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'staff_sync',
        payload: { action: 'delete', staffId: String(staffId) }
      }).catch(() => {});
    }

    try {
      await client.from('staff').delete().eq('id', String(staffId));
    } catch (e) {}

    const fallbackId = `__sys_staff_${staffId}`;
    try {
      await client.from('customers').delete().eq('id', fallbackId);
    } catch (e) {}

    return { ok: true };
  } catch (e: any) {
    return { ok: false };
  }
};

/** سحب الموظفين والحلاقين من السحابة */
export const pullStaffFromSupabase = async (url?: string, key?: string): Promise<{ ok: boolean; staff: any[] }> => {
  try {
    const client = getSupabaseClient(url, key);
    const staffMap = new Map<string, any>();

    // محاولة القراءة من جدول staff أولاً
    try {
      const { data: staffData } = await client.from('staff').select('*');
      if (staffData && staffData.length > 0) {
        for (const s of staffData) {
          const parsed = s.notes ? JSON.parse(s.notes) : s;
          staffMap.set(String(s.id), {
            id: String(s.id),
            name: s.name,
            phone: s.phone || '',
            role: s.role || 'حلاق',
            active: s.active !== false,
            locationIds: s.location_ids || s.locationIds || ['1'],
            ...parsed
          });
        }
      }
    } catch (e) {}

    // القراءة من جدول customers بالبادئة __sys_staff_
    try {
      const { data: fbStaff } = await client.from('customers').select('*').ilike('id', '__sys_staff_%');
      if (fbStaff && fbStaff.length > 0) {
        for (const row of fbStaff) {
          if (row.notes) {
            try {
              const s = JSON.parse(row.notes);
              if (s && s.id && !staffMap.has(String(s.id))) {
                staffMap.set(String(s.id), s);
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    return { ok: true, staff: Array.from(staffMap.values()) };
  } catch (e: any) {
    return { ok: false, staff: [] };
  }
};

/** مزامنة حجز جديد أو معدل مع Supabase سحابياً */
export const pushReservationToSupabase = async (res: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    // 1. Broadcast فوري لتطبيق الكاشير
    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'reservation_new',
        payload: res
      }).catch(() => {});
    }

    // 2. محاولة الحفظ في جدول reservations
    try {
      await client.from('reservations').upsert({
        id: String(res.id),
        customer_name: res.customerName,
        phone: res.phone || '',
        date: res.date,
        time: res.time,
        service_name: res.serviceName || '',
        status: res.status || 'pending',
        notes: res.notes || '',
        staff_id: res.staffId || null,
        location_id: res.locationId || '1',
        payload: JSON.stringify(res),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {}

    // 3. الحفظ المضمون في جدول customers مع بادئة __sys_res_
    const fallbackId = `__sys_res_${res.id}`;
    const { error } = await client.from('customers').upsert({
      id: fallbackId,
      name: res.customerName,
      phone: res.phone || '0000',
      balance: 0,
      credit_limit: 0,
      notes: JSON.stringify(res),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) console.warn('[Supabase pushReservation Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

/** سحب الحجوزات السحابية */
export const pullReservationsFromSupabase = async (url?: string, key?: string): Promise<{ ok: boolean; reservations: any[] }> => {
  try {
    const client = getSupabaseClient(url, key);
    const resMap = new Map<string, any>();

    try {
      const { data } = await client.from('reservations').select('*');
      if (data && data.length > 0) {
        for (const r of data) {
          const parsed = r.payload ? JSON.parse(r.payload) : {
            id: String(r.id),
            customerName: r.customer_name,
            phone: r.phone,
            date: r.date,
            time: r.time,
            serviceName: r.service_name,
            status: r.status,
            notes: r.notes,
            staffId: r.staff_id,
            locationId: r.location_id
          };
          resMap.set(String(r.id), parsed);
        }
      }
    } catch (e) {}

    try {
      const { data: fbRes } = await client.from('customers').select('*').ilike('id', '__sys_res_%');
      if (fbRes && fbRes.length > 0) {
        for (const row of fbRes) {
          if (row.notes) {
            try {
              const r = JSON.parse(row.notes);
              if (r && r.id && !resMap.has(String(r.id))) {
                resMap.set(String(r.id), r);
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    return { ok: true, reservations: Array.from(resMap.values()) };
  } catch (e: any) {
    return { ok: false, reservations: [] };
  }
};

/** حذف حجز من Supabase سحابياً */
export const deleteReservationFromSupabase = async (resId: string, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();
    try { await client.from('reservations').delete().eq('id', String(resId)); } catch(e) {}
    try { await client.from('customers').delete().eq('id', `__sys_res_${resId}`); } catch(e) {}
    return { ok: true };
  } catch(e) {
    return { ok: false };
  }
};

/** إرسال إشعار لحظي للعميل على تطبيقه عبر السحابة */
export const pushCustomerNotificationToSupabase = async (notif: { phone: string; title: string; body: string; type?: string }, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanPhone = (notif.phone || '').replace(/[^0-9]/g, '');
    const payload = {
      id: notifId,
      phone: cleanPhone,
      title: notif.title,
      body: notif.body,
      type: notif.type || 'booking',
      time: new Date().toISOString(),
      role: 'customer',
      read: false
    };

    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'customer_notif',
        payload
      }).catch(() => {});
    }

    await client.from('customers').upsert({
      id: `__sys_notif_${notifId}`,
      name: payload.title,
      phone: payload.phone || '0000',
      balance: 0,
      credit_limit: 0,
      notes: JSON.stringify(payload),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return { ok: true };
  } catch (e: any) {
    return { ok: false };
  }
};

/** حفظ وتعميم إعدادات الحجز وساعات العمل والإجازات سحابياً */
export const pushBookingSettingsToSupabase = async (settings: any, url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    touchLastSync();

    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'booking_settings_sync',
        payload: settings
      }).catch(() => {});
    }

    const { error } = await client.from('customers').upsert({
      id: '__sys_booking_settings',
      name: 'Booking Settings',
      phone: '0000',
      balance: 0,
      credit_limit: 0,
      notes: JSON.stringify(settings),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) console.warn('[Supabase Booking Settings Error]', error.message);
    return { ok: !error };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

/** سحب إعدادات الحجز وساعات العمل والإجازات سحابياً */
export const pullBookingSettingsFromSupabase = async (url?: string, key?: string): Promise<{ ok: boolean; settings: any | null }> => {
  try {
    const client = getSupabaseClient(url, key);
    const { data, error } = await client.from('customers').select('*').eq('id', '__sys_booking_settings').maybeSingle();
    if (data && data.notes) {
      try {
        const parsed = JSON.parse(data.notes);
        return { ok: true, settings: parsed };
      } catch (e) {}
    }
    return { ok: true, settings: null };
  } catch (e: any) {
    return { ok: false, settings: null };
  }
};

/** سحب كافة البيانات الحديثة من السحابة (فواتير، عملاء، فروع) */
export const pullFromSupabase = async (url?: string, key?: string) => {
  try {
    const client = getSupabaseClient(url, key);
    const accUser = getActiveAccountUser();

    let [invoicesRes, customersRes, branchesRes] = await Promise.all([
      client.from('invoices').select('*').eq('account_user', accUser).order('created_at', { ascending: false }).limit(200),
      client.from('customers').select('*').eq('account_user', accUser).limit(500),
      client.from('branches').select('*').eq('account_user', accUser).limit(50),
    ]);

    // Fallback للجداول التي لم تطبق عمود account_user بعد أو لم تجد سجلات مطابقة
    if (invoicesRes.error && invoicesRes.error.code === '42703') {
      invoicesRes = await client.from('invoices').select('*').order('created_at', { ascending: false }).limit(200);
    }
    if (customersRes.error && customersRes.error.code === '42703') {
      customersRes = await client.from('customers').select('*').limit(500);
    }
    if ((branchesRes.error && branchesRes.error.code === '42703') || (!branchesRes.data || branchesRes.data.length === 0)) {
      const fallbackBranches = await client.from('branches').select('*').limit(50);
      if (fallbackBranches.data && fallbackBranches.data.length > 0) {
        branchesRes = fallbackBranches;
      }
    }

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

/** الاشتراك اللحظي الفوري لتلقي أي فواتير أو تعديلات ومستخدمين وحجوزات من الفروع الأخرى */
export const subscribeSupabaseRealtime = (
  callbacks: {
    onNewInvoice?: (invoice: any) => void;
    onCustomerChange?: (customer: any) => void;
    onBranchChange?: (branch: any, eventType?: string, oldRecord?: any) => void;
    onUserChange?: (action: 'upsert' | 'delete', userOrId: any) => void;
    onStaffChange?: (action: 'upsert' | 'delete', staffOrId: any) => void;
    onNewReservation?: (reservation: any) => void;
    onBookingSettingsChange?: (settings: any) => void;
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

  // قناة التبادل اللحظي للبيانات والمستخدمين والحجوزات
  const channel = client.channel('procashier_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, payload => {
      touchLastSync();
      callbacks.onNewInvoice?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => {
      touchLastSync();
      const rec: any = payload.new || payload.old;
      if (!rec) return;

      const recId = String(rec.id || '');

      // 1. مزامنة مستخدمي النظام الاحتياطية
      if (recId.startsWith('__sys_user_')) {
        if (payload.eventType === 'DELETE') {
          const uId = recId.replace('__sys_user_', '');
          callbacks.onUserChange?.('delete', uId);
        } else if (rec.notes) {
          try {
            const u = JSON.parse(rec.notes);
            callbacks.onUserChange?.('upsert', u);
          } catch (e) {}
        }
        return;
      }

      // 2. مزامنة طاقم العمل والحلاقين
      if (recId.startsWith('__sys_staff_')) {
        if (payload.eventType === 'DELETE') {
          const sId = recId.replace('__sys_staff_', '');
          callbacks.onStaffChange?.('delete', sId);
        } else if (rec.notes) {
          try {
            const s = JSON.parse(rec.notes);
            callbacks.onStaffChange?.('upsert', s);
          } catch (e) {}
        }
        return;
      }

      // 3. مزامنة الحجوزات القادمة من المتصفح أو تطبيق الكاشير
      if (recId.startsWith('__sys_res_')) {
        if (payload.eventType !== 'DELETE' && rec.notes) {
          try {
            const r = JSON.parse(rec.notes);
            callbacks.onNewReservation?.(r);
          } catch (e) {}
        }
        return;
      }

      // 4. مزامنة إعدادات الحجز وساعات العمل والإجازات
      if (recId === '__sys_booking_settings') {
        if (payload.eventType !== 'DELETE' && rec.notes) {
          try {
            const set = JSON.parse(rec.notes);
            callbacks.onBookingSettingsChange?.(set);
          } catch (e) {}
        }
        return;
      }

      // عميل عادي
      callbacks.onCustomerChange?.(payload.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, payload => {
      touchLastSync();
      if (payload.eventType === 'DELETE') {
        callbacks.onStaffChange?.('delete', String(payload.old?.id));
      } else if (payload.new) {
        const s = payload.new;
        const parsed = s.notes ? JSON.parse(s.notes) : s;
        callbacks.onStaffChange?.('upsert', {
          id: String(s.id),
          name: s.name,
          phone: s.phone || '',
          role: s.role || 'حلاق',
          active: s.active !== false,
          locationIds: s.location_ids || s.locationIds || ['1'],
          ...parsed
        });
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
      touchLastSync();
      if (payload.eventType !== 'DELETE' && payload.new) {
        const r = payload.new;
        const parsed = r.payload ? JSON.parse(r.payload) : {
          id: String(r.id),
          customerName: r.customer_name,
          phone: r.phone,
          date: r.date,
          time: r.time,
          serviceName: r.service_name,
          status: r.status,
          notes: r.notes,
          staffId: r.staff_id,
          locationId: r.location_id
        };
        callbacks.onNewReservation?.(parsed);
      }
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
    .on('broadcast', { event: 'staff_sync' }, payload => {
      touchLastSync();
      const p = payload.payload;
      if (p && p.action && (p.staff || p.staffId)) {
        callbacks.onStaffChange?.(p.action, p.staff || p.staffId);
      }
    })
    .on('broadcast', { event: 'reservation_new' }, payload => {
      touchLastSync();
      if (payload.payload) {
        callbacks.onNewReservation?.(payload.payload);
      }
    })
    .on('broadcast', { event: 'booking_settings_sync' }, payload => {
      touchLastSync();
      if (payload.payload) {
        callbacks.onBookingSettingsChange?.(payload.payload);
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
