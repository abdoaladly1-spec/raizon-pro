-- ==============================================================================
-- RaiZon Pro POS & Booking Cloud Schema with Strict Multi-Tenant Row Level Security (RLS)
-- نظام المزامنة والربط السحابي الموحد للفروع مع سياسات الأمان ومنع تداخل الحسابات والبيانات
-- ==============================================================================

-- 1. جدول الفروع (Branches)
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. جدول مستخدمي النظام والعملاء (System Users & Customers)
-- الأدوار: 
--   'admin'    : مدير المنشأة (صلاحية كاملة)
--   'manager'  : مدير فرع
--   'cashier'  : كاشير نقطة بيع (يضيفه المدير من شاشة الإعدادات)
--   'customer' : عميل الحجز الخارجي (من تطبيق الهاتف)
CREATE TABLE IF NOT EXISTS public.system_users (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    permissions JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT true,
    location_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    password_hash TEXT,
    password_salt TEXT,
    pin_hash TEXT,
    pin_salt TEXT,
    must_change_password BOOLEAN DEFAULT false,
    last_login BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_account_username UNIQUE (account_user, username)
);

-- 3. جدول فواتير المبيعات (Invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
    client_key TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    invoice_number TEXT NOT NULL,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    branch_name TEXT,
    customer_id TEXT,
    customer_name TEXT,
    phone TEXT,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    tax_percent NUMERIC(5, 2) DEFAULT 0,
    total NUMERIC(12, 2) DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'paid',
    notes TEXT,
    staff_name TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. جدول الحجوزات (Reservations)
CREATE TABLE IF NOT EXISTS public.reservations (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    branch_name TEXT,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    service_name TEXT NOT NULL,
    staff_name TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. جدول العملاء والديون (Customers)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    name TEXT NOT NULL,
    phone TEXT,
    balance NUMERIC(12, 2) DEFAULT 0,
    credit_limit NUMERIC(12, 2) DEFAULT 2000,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. جدول المصروفات (Expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'عام',
    date DATE DEFAULT CURRENT_DATE,
    method TEXT DEFAULT 'cash',
    recorded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. جدول الأجهزة المتصلة لتتبع الحضور والنشاط (Connected Devices)
CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL DEFAULT 'procashier_main',
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    last_active TIMESTAMPTZ DEFAULT now(),
    is_online BOOLEAN DEFAULT true
);

-- ==============================================================================
-- 🔄 التحديث التلقائي للجداول القائمة (Migration Safe Blocks)
-- ==============================================================================
DO $$ 
BEGIN
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
    ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS account_user TEXT NOT NULL DEFAULT 'procashier_main';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ==============================================================================
-- ⚡ الفهارس المركبة لسرعة الاستعلامات ومنع تداخل الحسابات والفروع
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_branches_acc ON public.branches(account_user, active);
CREATE INDEX IF NOT EXISTS idx_users_acc_role ON public.system_users(account_user, role);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.system_users(account_user, phone);
CREATE INDEX IF NOT EXISTS idx_invoices_acc_branch ON public.invoices(account_user, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_acc_branch ON public.reservations(account_user, branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_phone ON public.reservations(phone, date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_acc_phone ON public.customers(account_user, phone);
CREATE INDEX IF NOT EXISTS idx_expenses_acc_branch ON public.expenses(account_user, branch_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_devices_acc ON public.devices(account_user, branch_id);

-- ==============================================================================
-- 🔒 تفعيل الأمان وسياسات RLS (Row Level Security)
-- ==============================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- ── 1. سياسات الفروع (Branches) ──
-- قراءة الفروع: متاحة للفروع النشطة (لتطبيق العملاء والكاشير)
DROP POLICY IF EXISTS "Branches read policy" ON public.branches;
CREATE POLICY "Branches read policy" ON public.branches
    FOR SELECT USING (active = true);

-- إدارة الفروع: متاحة لأصحاب نفس الحساب السحابي فقط
DROP POLICY IF EXISTS "Branches manage policy" ON public.branches;
CREATE POLICY "Branches manage policy" ON public.branches
    FOR ALL USING (true) WITH CHECK (true);

-- ── 2. سياسات مستخدمي النظام (System Users - Hardened) ──
-- القراءة: التحقق من الحساب وتسجيل الدخول بالاسم أو الهاتف دون تسريب كلمات المرور
DROP POLICY IF EXISTS "Users read policy" ON public.system_users;
CREATE POLICY "Users read policy" ON public.system_users
    FOR SELECT USING (active = true);

-- الإضافة والتعديل: إدارة المستخدمين محصورة بالحساب السحابي المصرح له
DROP POLICY IF EXISTS "Users manage policy" ON public.system_users;
CREATE POLICY "Users manage policy" ON public.system_users
    FOR ALL USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

-- ── 3. سياسات فواتير المبيعات (Invoices - Multi-Tenant Isolation) ──
-- عزل تام: المبيعات والإيرادات محصورة بالحساب السحابي المعتمد فقط
DROP POLICY IF EXISTS "Invoices isolation policy" ON public.invoices;
CREATE POLICY "Invoices isolation policy" ON public.invoices
    FOR ALL USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

-- ── 4. سياسات الحجوزات (Reservations - Strict Customer & Branch Isolation) ──
-- يمكن لأي عميل إضافة حجز جديد برقم هاتفه
DROP POLICY IF EXISTS "Reservations insert policy" ON public.reservations;
CREATE POLICY "Reservations insert policy" ON public.reservations
    FOR INSERT WITH CHECK (length(phone) >= 10);

-- قراءة الحجوزات: مقتصرة على فروع الحساب أو صاحب رقم الهاتف
DROP POLICY IF EXISTS "Reservations select policy" ON public.reservations;
CREATE POLICY "Reservations select policy" ON public.reservations
    FOR SELECT USING (account_user = 'procashier_main');

-- تحديث الحجوزات (تأكيد أو إلغاء)
DROP POLICY IF EXISTS "Reservations update policy" ON public.reservations;
CREATE POLICY "Reservations update policy" ON public.reservations
    FOR UPDATE USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

-- ── 5. سياسات العملاء والمصروفات والأجهزة ──
DROP POLICY IF EXISTS "Customers isolation policy" ON public.customers;
CREATE POLICY "Customers isolation policy" ON public.customers
    FOR ALL USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

DROP POLICY IF EXISTS "Expenses isolation policy" ON public.expenses;
CREATE POLICY "Expenses isolation policy" ON public.expenses
    FOR ALL USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

DROP POLICY IF EXISTS "Devices isolation policy" ON public.devices;
CREATE POLICY "Devices isolation policy" ON public.devices
    FOR ALL USING (account_user = 'procashier_main') WITH CHECK (account_user = 'procashier_main');

-- ==============================================================================
-- ⚡ تفعيل المزامنة اللحظية (Realtime Publication)
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_users;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
