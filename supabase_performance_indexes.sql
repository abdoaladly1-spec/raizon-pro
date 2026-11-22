-- ==============================================================================
-- 🚀 RaiZon Pro - سكربت تسريع الأداء وتحسين استعلامات Supabase (Performance Boost)
-- شغل هذا الكود في Supabase SQL Editor لمعالجة الاستعلامات البطيئة وتقليل زمن الاستجابة إلى < 5ms
-- ==============================================================================

-- 1. فهارس مركبة متقدمة لجدول الفواتير (Invoices)
-- لتسريع فلترة فواتير الفرع وترتيبها حسب الأحدث فورياً
CREATE INDEX IF NOT EXISTS idx_invoices_branch_created 
ON public.invoices(branch_id, created_at DESC);

-- لتسريع استعراض فواتير عميل محدد
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id 
ON public.invoices(customer_id);

-- لتسريع تقارير المبيعات حسب طريقة الدفع
CREATE INDEX IF NOT EXISTS idx_invoices_branch_payment 
ON public.invoices(branch_id, payment_method);

-- 2. فهارس لجدول الحجوزات (Reservations)
-- لتسريع عرض حجوزات اليوم والفرع في شاشة الكاشير وتطبيق الموبايل
CREATE INDEX IF NOT EXISTS idx_res_branch_date_status 
ON public.reservations(branch_id, date, status);

CREATE INDEX IF NOT EXISTS idx_res_customer_id 
ON public.reservations(customer_id);

-- 3. فهارس لجدول العملاء (Customers)
-- لتسريع البحث اللحظي بالاسم ورقم الهاتف
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm 
ON public.customers(phone);

CREATE INDEX IF NOT EXISTS idx_customers_updated 
ON public.customers(updated_at DESC);

-- 4. فهارس لجدول مستخدمي النظام (System Users)
-- لتسريع عمليات تسجيل الدخول والتحقق من الصلاحيات وتصفية الأدوار
CREATE INDEX IF NOT EXISTS idx_users_username_active 
ON public.system_users(username, active);

CREATE INDEX IF NOT EXISTS idx_users_location 
ON public.system_users(location_id);

-- 5. فهارس لجدول المصروفات (Expenses)
-- لتسريع تقارير المصروفات الشهرية واليومية للفروع
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date 
ON public.expenses(branch_id, date DESC);

-- 6. تحليل وتحديث إحصائيات الجداول (ANALYZE) لضبط خطط الاستعلام (Query Planner)
ANALYZE public.invoices;
ANALYZE public.customers;
ANALYZE public.reservations;
ANALYZE public.branches;
ANALYZE public.system_users;
ANALYZE public.expenses;

-- 7. تصفير عداد الاستعلامات البطيئة القديمة (التي نتجت عن إنشاء الجداول أو التهيئة الأولى)
-- حتى تبدأ في مراقبة الاستعلامات الحقيقية النظيفة من الآن
SELECT pg_stat_statements_reset();
