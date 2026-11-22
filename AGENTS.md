# 🚀 Flare One (فلير وان) - Developer & AI Agent Context Guide

> **ملاحظة لأي ذكاء اصطناعي (AI Agent) أو مطور يعمل على هذا المشروع مستقبلاً:**
> هذا الملف يحتوي على التوثيق الفني الكامل، المعمارية البرمجية، بيانات الاعتماد والمفاتيح، وخريطة الملفات لتتمكن من فهم وتعديل النظام مباشرة دون أي التباس.

---

## 🌟 1. هوية المشروع (Brand Identity)
* **الاسم الرسمي:** **فلير وان - Flare One** (نظام نقاط البيع والكاشير وإدارة صالونات الحلاقة والعناية الرجالية).
* **الشعار الرسمي (Logo):** موجود في `logo.png`، `public/logo.png`، ومضمّن كـ Base64 Data URI في `lib/logoData.ts` (`FLARE_ONE_LOGO_URI` و `RAIZON_LOGO_URI`) لضمان ظهوره في كافة الفواتير، الإيصالات، شاشات التوقف، والتطبيق بدون مشاكل مسارات.
* **الألوان والسمات البصرية:**
  - الطابع الفاخر الداكن (Executive Midnight Dark / Charcoal): `#0B0D18` و `#070A12`.
  - لون التمييز الرئيسي (Emerald Green & Cosmic Purple): `#10B981` (زمردي هادئ للمواعيد والتأكيدات) و `#7C3AED` (بنفسجي ملكي للعلامة التجارية).

---

## 🔑 2. مفاتيح الأمان وبيانات الاعتماد (Security & Credentials)

| البيان | القيمة المعتمدة | الاستخدام |
| :--- | :--- | :--- |
| **DEVELOPER_PASSCODE** | `22122005Me#` | كود المطور الأساسي لفتح الباتشر وتوليد التراخيص |
| **DEVELOPER_PASSCODE_BACKUP** | `2212205Me#` | كود المطور الاحتياطي (Fallback) في Electron والباتشر |
| **ADMIN_PASSCODE (Master)** | `22122005` | كود الماستر للمدير لتسجيل الدخول الفوري وتخطي الصلاحيات |
| **Default Admin Login** | اسم المستخدم: `admin`<br>كلمة المرور: `admin` | الحساب الافتراضي عند أول تشغيل |
| **SUPABASE_URL** | `https://cifijxcmmnosocnfizra.supabase.co` | رابط قاعدة البيانات السحابية |
| **SUPABASE_KEY** | `sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl` | مفتاح سوبابيز العام (Anon Key) |
| **SESSION_SECRET** | `rz_cloud_pos_session_hmac_key_9875_#v2` | مفتاح توقيع وحماية الجلسات HMAC |
| **SYSTEM_SALT** | `rz_cloud_pos_secure_2026_@#salT!` | الملح الأمني لتشفير جلسات الويب |
| **GitHub Token & Repo** | `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`<br>`abdoaladly1-spec/raizon-pro` | التحديثات التلقائية ومستودع الكود |

---

## 🏗️ 3. المعمارية الفنية للمشروع (Architecture Overview)

يتكون المشروع من 4 مكونات رئيسية مترابطة سحابياً ولحظياً:

```mermaid
flowchart TD
    Customer["العميل (Web PWA / Mobile)"] -->|حجز موعد / استعلام| Supabase[("Supabase Cloud\nRealtime + DB")]
    Supabase -->|مزامنة فورية + رنين صوتي| CashierApp["تطبيق الكاشير المكتبي\n(React + Electron)"]
    CashierApp -->|تحويل الحجز لفاتورة| POS["نقاط البيع والمبيعات"]
    CashierApp -->|مزامنة الفروع المركزية| BranchHub["مركز الفروع الموحد"]
    FlutterApp["تطبيق الموبايل (Flutter)\nAndroid & iOS"] -->|إدارة المدير وحجز العملاء| Supabase
```

### 1. تطبيق الكاشير المكتبي (Desktop POS Application)
* **المسار:** مجلد المشروع الرئيسي.
* **التقنيات:** React 18, TypeScript, Vite, Tailwind CSS, Electron.
* **المسارات الرئيسية:**
  - `http://localhost:4189/`: مركز الفروع الموحد والـ Dashboard الرئيسي.
  - `http://localhost:4189/#/reservations`: شاشة إدارة الحجوزات، كراسي الصالون، وإعدادات ساعات العمل والإجازات.
  - `http://localhost:4189/#/create_invoice`: إنشاء الفواتير وإجراءات الكاشير السريعة.

### 2. بوابة حجز المواعيد للعملاء (Web App - PWA)
* **المسار:** `web_app/index.html`.
* **الرابط المباشر:** `http://localhost:4189/web_app/`.
* **المميزات:**
  - واجهة حجز فاخرة بـ 4 خطوات (1 الفرع | 2 المصفف | 3 الموعد | 4 التأكيد).
  - لا يوجد خيار "أول حلاق متاح" نهائياً؛ الاختيار محصور في الحلاقين الفعليين بالصالون مع بيان الحلاقين الذين في إجازة.
  - استعلام فوري عن الحجوزات برقم الهاتف.
  - حزم التوزيع: مضغوطة تلقائياً في `web_app.zip` و `android_app/web_app.zip`.

### 3. خادم المزامنة المحلي (Local Python Microservice)
* **المسار:** `server/` (`main.py`, `config.py`, `emailer.py`).
* **التقنيات:** Python FastAPI / SQLite على المنفذ `8087`.
* **الوظيفة:** النسخ الاحتياطي المحلي، وإرسال التقارير التلقائية عبر البريد الإلكتروني.

### 4. تطبيق الموبايل (Flutter Cross-Platform)
* **المسار:** `flutter_app/`.
* **التقنيات:** Flutter 3, Dart. يعمل على Android و iOS.
* **الوظيفة:** لوحة تحكم للمدير لمتابعة الفروع ومبيعات اليوم ولحظة بلحظة، وبوابة حجز للعملاء.

---

## 📁 4. خريطة الملفات الحيوية (Key Files Reference)

| الملف | الوظيفة |
| :--- | :--- |
| `context/AppContext.tsx` | إدارة الحالة العامة، المزامنة الدورية كل 20 ثانية للحجوزات، اشتراك سوبابيز Realtime، رنين التنبيه الصوتي `playChime`، وصلاحيات المستخدمين. |
| `pages/ReservationsPage.tsx` | صفحة الحجوزات الكاملة: تبديل العرض بين (جدول المواعيد) و (مخطط كراسي الصالون)، نافذة إعدادات مواعيد الحجز والإجازات والعطلات، تذكرة VIP الحرارية (80mm)، رسائل واتساب التلقائية، وزر تحويل الحجز لفاتورة كاشير. |
| `pages/DashboardPage.tsx` | لوحة تحكم الفرع: المؤشرات المالية، ودجت حجوزات اليوم بصيغة الموعد الموحدة (`12:00 \| PM` بالأعلى والتاريخ بالأسفل) ورقم الهاتف بدلاً من الخدمة. |
| `pages/CreateInvoicePage.tsx` | شاشة إنشاء الفاتورة وقراءة الحجز المعلق تلقائياً من `sessionStorage` (`pending_pos_reservation`). |
| `components/AdminBranchSelectionScreen.tsx` | شاشة مركز الفروع الموحد والتقارير المجمعة. |
| `components/PatcherModal.tsx` | نافذة الباتشر لتوليد وتفعيل تراخيص الأجهزة. |
| `lib/supabaseSync.ts` | دوال الاتصال والمزامنة السحابية: الحجوزات، الموظفين، الفروع، والفواتير. |
| `lib/thermalPrinter.ts` | محرك طباعة الإيصالات الحرارية (ESC/POS 80mm). |
| `lib/logoData.ts` | الشعار الرسمي Base64 الموحد للنظام. |
| `web_app/index.html` | بوابة الويب PWA المستقلة لحجز المواعيد. |

---

## 🛠️ 5. أوامر التشغيل والبناء (Commands Quick Reference)

* **تشغيل خادم التطوير (Port 4189):**
  ```powershell
  npm run dev
  ```
* **فحص أنواع TypeScript بدون أخطاء:**
  ```powershell
  npx tsc --noEmit
  ```
* **بناء نسخة الإنتاج:**
  ```powershell
  npm run build
  ```
* **تشغيل تطبيق Electron المكتبي:**
  ```powershell
  npm run electron
  ```
* **تحديث حزم الويب وأندرويد بعد أي تعديل في `web_app/`:**
  ```powershell
  powershell -Command "Compress-Archive -Path 'web_app/*' -DestinationPath 'web_app.zip' -Force; Copy-Item 'web_app.zip' 'android_app/web_app.zip' -Force"
  ```

---

## ⚠️ 6. قواعد هامة لأي AI Agent معدّل (Rules & Commitments)
1. **اسم النظام:** **فلير وان (Flare One)** فقط، وعدم العودة لأي أسماء قديمة.
2. **صيغة الموعد:** الوقت بالأعلى `12:00 | PM` والتاريخ بالأسفل `1/1/2027` في كافة واجهات الحجوزات والودجات.
3. **أمان البيانات:** دائماً استخدم المعالجة الآمنة للأسماء وأرقام الهواتف:
   ```ts
   const rawName = (r?.customerName || (r as any)?.customer_name || '').trim();
   const pMatch = rawName ? rawName.match(/\(([^)]+)\)/) : null;
   ```
4. **الحفاظ على المزامنة السحابية:** أي حجز جديد أو تعديل في الإجازات وساعات العمل يجب أن يتم رفعه وتعميمه عبر Supabase لضمان وصوله لجميع الأجهزة والعملاء لحظياً.
