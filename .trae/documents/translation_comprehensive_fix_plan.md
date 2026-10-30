# خطة إصلاح الترجمة الشاملة - Pro Cashier System

## ملخص البحث والتشخيص

تم إجراء مسح كامل لجميع ملفات المشروع وتبين وجود النصوص الصلبة (Hardcoded) والبنى التالية تمنع استقلالية اللغتين:

### الأسباب الجذرية للمشكلة
1. **نظام الـ Fallback الخطير**: دالة `t(key)` تعود بالمفتاح نفسه كنص (`|| key`) إذا لم يجد الترجمة، مما يعرض مفاتيح snake_case إنجليزية في واجهة العربية.
2. **نصوص صلبة مباشرة بين وسمات JSX**: ~30 موضع مثل `<th>User</th>`، `<option>Any</option>`.
3. **Fallbacks إنجليزية مشفرة بقيمة OR**: ~115 موضع بنمط `t('key') || 'English Text'`.
4. **خصائص props صلبة**: `error=""`, `placeholder=""`, `title=""` في المكونات.
5. **قوالب الطباعة (Print Templates)**: نصوص عربية صلبة في قوالب الفواتير والإيصالات تكسر الوضع الإنجليزي.
6. **صفحة تفعيل الترخيص**: كل النصوص إنجليزية صلبة بالكامل.
7. **نافذة الاختصارات**: عناوين الأقسام وأوصاف الاختصارات كلها إنجليزية.
8. **حقوق النشر/Footer**: نص عربي صلب + نص إنجليزي صلب في مواضع مختلفة.
9. **مفاتيح ترجمة كاملة غير موجودة**: ~100 مفتاح مفقود من كائن `translations`.

---

## الملفات المتأثرة

| الملف | التغيير المتوقع |
|---|---|
| `context/AppContext.tsx` | إضافة ~100 مفتاح ترجمة مزدوج اللغة + تحسين دالة `t()` |
| `App.tsx` | إصلاح ~200 موقع (نصوص مباشرة، fallbacks، props، قوالب طباعة) |
| `components/Intro.tsx` | مراجعة نهائية (تمت ترجمته مسبقاً) |
| `components/Icons.tsx` | NO TOUCH (SVG فقط) |
| `types.ts` | NO TOUCH (typedef فقط) |

---

## الخطوة 1: إضافة مفاتيح الترجمة المفقودة في AppContext.tsx

**تطبيق أولاً قبل أي تعديل على App.tsx** لتفادي ظهور مفاتيح raw للمستخدم.

### أ) تحسين دالة `t()` (حماية إضافية)
تغيير النمط الحالي:
```ts
// BEFORE
return translations[language][key] || key;

// AFTER
return translations[language][key] ?? translations['en'][key] ?? '';
```
*السبب: منع ظهور مفاتيح snake_case في واجهة المستخدم نهائياً.*

### ب) قائمة المفاتيح الجديدة (عربي + إنجليزي مزدوج)

| المفتاح | القيمة العربية | القيمة الإنجليزية |
|---|---|---|
| `pending` | قيد الانتظار | Pending |
| `confirmed` | مؤكد | Confirmed |
| `completed` | مكتمل | Completed |
| `cancelled` | ملغي | Cancelled |
| `paid` | مدفوع | Paid |
| `void` | ملغى نهائياً | Void |
| `refunded` | مسترد | Refunded |
| `reservations_list` | قائمة الحجوزات | Reservations List |
| `new_reservation` | حجز جديد | New Reservation |
| `invoice_no` | رقم الفاتورة | Invoice No. |
| `services` | الخدمات | Services |
| `type` | النوع | Type |
| `method` | طريقة الدفع | Method |
| `amount` | المبلغ | Amount |
| `add_payment` | إضافة دفعة | Add Payment |
| `total_payments` | إجمالي المدفوعات | Total Payments |
| `print_report` | طباعة التقرير | Print Report |
| `staff_management` | إدارة الموظفين | Staff Management |
| `active_staff` | الموظفون النشطون | Active Staff |
| `add_staff` | إضافة موظف | Add Staff |
| `edit_staff` | تعديل بيانات موظف | Edit Staff |
| `total_staff` | إجمالي الموظفين | Total Staff |
| `today_reservations` | حجوزات اليوم | Today's Reservations |
| `receptionist` | موظف الاستقبال | Receptionist |
| `manager` | مدير | Manager |
| `barber` | حلاق | Barber |
| `total_sales` | إجمالي المبيعات | Total Sales |
| `total_expenses` | إجمالي المصاريف | Total Expenses |
| `print` | طباعة | Print |
| `logout_system` | تسجيل الخروج | Logout System |
| `closing` | الإقفال | Closing |
| `today_revenue` | إيرادات اليوم | Today's Revenue |
| `drawer_closing` | إقفال الدرج | Drawer Closing |
| `close_drawer` | إغلاق الدرج | Close Drawer |
| `new_note` | ملاحظة جديدة | New Note |
| `page` | صفحة | Page |
| `of` | من | of |
| `edit_item` | تعديل الصنف | Edit Item |
| `select_category` | اختر التصنيف | Select Category |
| `track_stock` | تتبع المخزون | Track Stock |
| `alert_threshold` | حد التنبيه | Alert Threshold |
| `add_tool` | إضافة أداة | Add Tool |
| `tool_name` | اسم الأداة | Tool Name |
| `condition_new` | جديد | New |
| `condition_used` | مستخدم | Used |
| `condition_damaged` | تالف | Damaged |
| `clients` | العملاء | Clients |
| `product` | منتج | Product |
| `service` | خدمة | Service |
| `general_shortcuts` | عام | General |
| `invoice_shortcuts` | الفاتورة | Invoice |
| `global_search` | البحث الشامل | Global Search |
| `show_shortcuts` | إظهار الاختصارات | Show Shortcuts |
| `print_invoice` | طباعة الفاتورة | Print Invoice |
| `save_print` | حفظ وطباعة | Save & Print |
| `new_invoice_shortcut` | فاتورة جديدة | New Invoice |
| `cancel_shortcut` | إلغاء | Cancel |
| `system_activation` | تفعيل النظام | System Activation |
| `product_key` | مفتاح المنتج | Product Key |
| `invalid_license` | مفتاح ترخيص غير صالح | Invalid License Key |
| `electron_env_required` | بيئة إلكترون غير متاحة. استخدم DEV-KEY للتجربة | Electron environment not detected. Use "DEV-KEY" to simulate. |
| `activation_failed` | فشل التفعيل. تواصل مع الدعم الفني | Activation failed. Contact support. |
| `activate_system` | تفعيل النظام | Activate System |
| `activation_welcome` | مرحباً بك في ProCashier. يرجى إدخال مفتاح المنتج لتفعيل الجهاز. | Welcome to ProCashier. Please enter your Product Key to activate this device. |
| `secure_license` | محمي بمحرك الترخيص الآمن | Protected by Secure License Engine |
| `touch_resume` | المس الشاشة للاستئناف | Touch screen to resume |
| `offline_status` | غير متصل | Offline |
| `management_suffix` | إدارة | Management |
| `recorded_by` | مسجل بواسطة | Recorded By |
| `expense_description` | وصف المصروف | Expense Description |
| `add_expense` | إضافة مصروف | Add Expense |
| `expense_added` | تمت إضافة المصروف بنجاح | Expense added successfully |
| `expense_deleted` | تم حذف المصروف | Expense deleted |
| `expense_restored` | تمت استعادة المصروف | Expense restored |
| `confirm_delete_expense` | متأكد من حذف هذا المصروف؟ | Are you sure you want to delete this expense? |
| `expense_title` | عنوان المصروف | Expense Title |
| `expense_category` | تصنيف المصروف | Expense Category |
| `expense_amount` | قيمة المصروف | Expense Amount |
| `ph_expense_name` | مثال: إيجار، فواتير، رواتب... | e.g. Rent, Bills, Salaries... |
| `sold_today` | مبيعات اليوم | Sold Today |
| `copyright_footer` | جميع الحقوق محفوظة - المبرمج عبد الرحمن فتحي العادلي - ت. 01026695879 | All Rights Reserved - Dev: Eng. Abdelrahman Fathy El-Adly - Tel. 01026695879 |
| `brand_header_text` | صالون إبراهيم نوار | Ibrahim Nawar Salon |
| `invoice_footer_greeting` | نورت الصالون.. شرفتونا! | Thank you for visiting! See you soon! |
| `invoice_print_title` | فاتورة | Invoice |
| `time_label` | الوقت | Time |
| `date_label` | التاريخ | Date |
| `customer_label` | العميل | Customer |
| `phone_label` | الهاتف | Phone |
| `cashier_label` | الكاشير | Cashier |
| `branch_label` | الفرع | Branch |
| `items_table_header` | الصنف | Item |
| `qty_table_header` | الكمية | Qty |
| `price_table_header` | السعر | Price |
| `total_table_header` | الإجمالي | Total |
| `subtotal_label` | المجموع الفرعي | Subtotal |
| `discount_label` | الخصم | Discount |
| `tax_label` | الضريبة | Tax |
| `total_label` | الإجمالي | Total |
| `thank_you_label` | شكراً لاختياركم | Thank you for your business |
| `invoices_list_title` | قائمة الفواتير | Invoices List |
| `any_option` | الكل | Any |
| `details_header` | التفاصيل | Details |
| `action_header` | الإجراء | Action |
| `user_header` | المستخدم | User |
| `unknown_staff` | غير معروف | Unknown |
| `undo_action` | تراجع | UNDO |
| `quick_access` | الوصول السريع | Quick Access |
| `invalid_format` | تنسيق غير صالح | Invalid format |
| `add_item` | إضافة صنف | Add Item |
| `edit_product` | تعديل المنتج | Edit Product |
| `add_product` | إضافة منتج | Add Product |

---

## الخطوة 2: إصلاح النصوص المباشرة بين وسمات JSX في App.tsx (27+ موضع)

مسح وتغيير جميع النصوص التي تكتب مباشرة مثل:
```tsx
// قبل
<th>User</th>
<th>Action</th>
<th>Details</th>

// بعد
<th>{t('user_header')}</th>
<th>{t('action_header')}</th>
<th>{t('details_header')}</th>
```

**المواضع المستهدفة:**
- `L1779-1781`: جدول Audit Logs headers
- `L2417, L2459`: "Barber" labels في صفحة الحجوزات
- `L2465`: `<option value="">Any</option>` → `{t('any_option')}`
- `L4586`: ScreenSaver "Touch screen to resume"
- `L4744`: Offline status label
- `L4796`: GlobalSearch → زر ESC (يُبقى ESC كاسم مفتاح قياسي)
- `L4824, L4830`: Shortcuts section headers "General" / "Invoice"
- `L4825-4833`: Shortcuts labels (5 labels)
- `L4882`: Activation `<h2>System Activation</h2>`
- `L4883`: Activation description paragraph
- `L4888`: Activation `<label>Product Key</label>`
- `L4914`: Activation button "Activate System"
- `L4919`: Activation footer "Protected by Secure License Engine"
- `L4780`: Footer copyright → استبدال النص العربي الصلب بـ `{t('copyright_footer')}`
- `L4679`: Sidebar header "صالون ابراهيم نوار" → `{t('brand_header_text')}`
- `L4399`: Expenses page subtitle "... Management" → استخدم `{t('expenses')} {t('management_suffix')}`
- `L68`: Input component default `error='Invalid format'` → `{t('invalid_format')}`

---

## الخطوة 3: إزالة جميع أنماط `|| 'English Fallback'` (~115 موضع)

النقطة الأكثر خطورة. حتى لو كان المفتاح موجوداً، الـ `||` يقوم بعرض الإنجليزي إذا رجع المفتاح قيمة falsy.

النمط:
```tsx
// قبل
t('edit_item') || 'Edit Item'
t('select_category') || 'Select Category'

// بعد
t('edit_item')
t('select_category')
```

**المواضع الكثيفة:**
- CreateInvoice: L600-L1500 (أكبر تجمع)
- StaffPage: L2650-L3120 (~30 موضع)
- SettingsPage → Items tab: L4274, L4282, L4288, L4290, L4291, L4297, L4302
- ClosingPage: L3330-L3560
- ReservationsPage, ClientsPage, InvoicesList, Inventory, AuditLogs, NotesPage

---

## الخطوة 4: إصلاح جميع الخصائص الصلبة (error/placeholder/title props)

بدل النصوص الإنجليزية في props:
```tsx
// قبل
<Input error="Phone must start with 01 and be 11 digits" />
<Input placeholder="Add invoice notes here..." />
<Button title="Export to PDF" />

// بعد - يتم استبدال كل نص بمفتاح ترجمة جديد في القائمة أعلاه
```

---

## الخطوة 5: فصل قوالب الطباعة عن اللغة الواحدة

### 5 أ) قالب فاتورة الطباعة (L1015-L1139)
استبدال جميع النصوص العربية الصلبة بمفاتيح ترجمة:
```tsx
// قبل (صلب عربي)
<h2>صالون ابراهيم نوار</h2>
<h1>فـــــــاتـــــــورة</h1>
<p>نورت الصالون.. شرفتونا!</p>

// بعد (ثنائي اللغة)
<h1>{state.settings.shopName}</h1>  {/* أو t('brand_header_text') */}
<h1>{t('invoice_print_title')}</h1>
<p>{t('invoice_footer_greeting')}</p>
```
وتطبيق نفس الشيء على جميع labels: الوقت، التاريخ، العميل، الهاتف، إجمالي، الخصم، الضريبة، الخ.

### 5 ب) قائمة الفواتير قالب الطباعة L1602
"Invoices List" → `{t('invoices_list_title')}`

### 5 ج) NotesPage print footer L3695
"Page 1 of 1" → `{t('page')} 1 {t('of')} 1` (المفاتيح موجودة في الخطوة 1)

---

## الخطوة 6: ترجمة أسماء الأدوار (Roles) وأنواع الأصناف

```tsx
// قبل
<p className="text-xs text-slate-500 capitalize">{currentUser?.role}</p>
<span>{item.type}</span>

// بعد
<p className="text-xs text-slate-500 capitalize">{t(currentUser?.role || '')}</p>
<span>{t(item.type)}</span>
```
المفاتيح المطلوبة موجودة بالفعل: `admin`, `receptionist`, `manager`, `barber`, `product`, `service`.

---

## الخطوة 7: الاحتفاظ بالأشياء التي لا يجب ترجمتها

هذه الاستثناءات **مقبولة صناعياً** ولا نلمسها:
| النص | السبب |
|---|---|
| أزرار تغيير اللغة: `English` / `العربية` | معيار عالمي - كل لغة تعرض اسم اللغة الأخرى |
| اختصارات التنسيق: `PDF` / `IMG` / `DOC` / `TXT` | اختصارات عالمية معروفة |
| أسماء الخطوط: `Arial` / `Tahoma` / `Verdana` / ... | أسماء خطوط قياسية |
| `ESC` في زر إغلاق البحث | اسم مفتاح لوحة مفاتيح قياسي |
| أسماء العلامات التجارية: `WhatsApp` / `Visa` / `Mastercard` | أسماء تجارية دولية |
| الأرقام: `0-9` | بالفعل مفروضة عبر `ar-u-nu-latn` ✓ |
| `ProCashier` اسم الماركة | اسم تجاري للمشروع |
| `DEV-KEY` مفتاح المطور | ثابت تقني |

---

## القيود الصارمة التي يجب الحفاظ عليها (DO NOT BREAK)

1. **لا تغير كود الـ Locale أو الـ Formatters** في `AppContext.tsx` L970-L989
   - `locale = language === 'ar' ? 'ar-u-nu-latn' : 'en-US'` — صحيح بالفعل
   - دوال `formatNumber`, `formatDate`, `formatTime`, `formatDateTime` — لا نستبدلها بـ `.toLocaleString()` مباشرة
2. **لا تغير قواعد CSS للأرقام**: `font-variant-numeric: lining-nums tabular-nums` موجودة بالفعل
3. **لا تغير تبديل الاتجاه**: `document.dir = language === 'ar' ? 'rtl' : 'ltr'` (L993)
4. **لا تترجم بيانات المستخدم**: `nameAr`/`nameEn` للأصناف/الخدمات/التصنيفات تستخدم بنمط ternary بالفعل → أحفظ هذا النمط ولا تغلفه بـ `t()`

---

## خطوات التحقق والاعتماد (Validation)

بعد تطبيق كل التغييرات، تنفيذ هذه الفحوصات يدوياً:

### مرحلة العربية (Zero English policy)
تشغيل التطبيق → التبديل للعربية → فحص:
- [ ] صفحة الداشبورد (كل الكروت، الأزرار، القائمة الجانبية، الهيدر)
- [ ] إنشاء فاتورة جديدة (كل الحقول، الأخطاء، placeholders، زر الطباعة preview)
- [ ] قائمة الفواتير + فلترة + PDF preview
- [ ] صفحة المخزون + إضافة/تعديل صنف
- [ ] صفحة العملاء + بطاقة العميل + تقارير PDF
- [ ] صفحة الحجوزات + نافذة حجز جديد
- [ ] صفحة الموظفين + الملف الشخصي + Custody + كشوف الرواتب
- [ ] صفحة الإقفال + تقرير الإقفال
- [ ] صفحة الملاحظات + شريط الأدوات + زر الطباعة
- [ ] صفحة المصاريف + نافذة الإضافة
- [ ] صفحة الإعدادات (كل التابات 4)
- [ ] شاشة التوفير (Screen Saver)
- [ ] نافذة الاختصارات (Ctrl + ؟)
- [ ] البحث الشامل (Ctrl + K)
- [ ] شاشة تفعيل الترخيص (Logout ثم DEV-KEY)
- [ ] رسائل Toast كلها (نجاح / خطأ / معلومة)
- [ ] **النتيجة المتوقعة**: لا يظهر أي كلمة إنجليزية إلا الأرقام 0-9 واختصارات PDF/IMG/DOC/TXT وWhatsApp/Visa وأسماء الخطوط وESC وEnglish زر تبديل اللغة.

### مرحلة الإنجليزية (Zero Arabic policy)
التبديل للإنجليزية → نفس الفحص السابق:
- [ ] **النتيجة المتوقعة**: لا يظهر أي حرف عربي على الإطلاق.

---

## الترتيب التنفيذي الموصى به (5 Passes)

لتفادي ظهور مفاتيح raw أثناء العمل:

1. **Pass 1 (AppContext.tsx فقط)**: إضافة كل مفاتيح الخطوة 1 + تحسين دالة `t()`
2. **Pass 2 (App.tsx)**: استبدال النصوص المباشرة JSX (الخطوة 2)
3. **Pass 3 (App.tsx)**: إزالة كل الـ `|| "English"` (الخطوة 3)
4. **Pass 4 (App.tsx)**: إصلاح props الصلبة + قوالب الطباعة (الخطوات 4 و5)
5. **Pass 5 (App.tsx)**: ترجمة Roles / Types + الفوتر / Sidebar (الخطوة 6)

---

## المخاطر والتخفيف

| المخاطرة | التخفيف |
|---|---|
| نسيان بعض المواضع (الملف 5000 سطر) | استخدام نتيجتي Grep كـ checklist: ملفات الـ 115 fallback + 27 JSX tag |
| اختلاف ترتيب المفاتيح بين ar و en في الكائن | التزام بالترتيب نفسه عند الإضافة في المصفوفة |
| بعض المفاتيح القديمة لم تكن موجودة حتى قبل العمل | تم تسجيلها في الجدول أعلاه كـ missing keys |
| خطأ Typo في اسم المفتاح | البحث عن المفتاح في AppContext قبل استخدامه في App.tsx |
