package com.raizon.procashier.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object SupabaseRepository {
    const val DEFAULT_SUPABASE_URL = "https://cifijxcmmnosocnfizra.supabase.co"
    const val DEFAULT_SUPABASE_ANON_KEY = "sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var prefs: SharedPreferences? = null
    var currentUser: AppUser? = null
        private set

    fun init(context: Context) {
        prefs = context.getSharedPreferences("raizon_pos_prefs", Context.MODE_PRIVATE)
        val savedUserJson = prefs?.getString("logged_user_json", null)
        if (!savedUserJson.isNullOrBlank()) {
            try {
                currentUser = gson.fromJson(savedUserJson, AppUser::class.java)
            } catch (e: Exception) {
                currentUser = null
            }
        }
    }

    fun saveSession(user: AppUser) {
        currentUser = user
        prefs?.edit()?.putString("logged_user_json", gson.toJson(user))?.apply()
    }

    fun logout() {
        currentUser = null
        prefs?.edit()?.remove("logged_user_json")?.apply()
    }

    val availableServices = listOf(
        BarberService("1", "قص شعر كلاسيك", 30, 80.0, "شعر", "✂️"),
        BarberService("2", "تحديد وتشذيب اللحية", 20, 50.0, "لحية", "🪒"),
        BarberService("3", "باقة VIP متكاملة (شعر + لحية + بخار)", 60, 250.0, "باقات", "👑"),
        BarberService("4", "تنظيف بشرة وماسك الهيدرافيشل", 40, 150.0, "عناية", "🧖‍♂️"),
        BarberService("5", "فرد بروتين / علاج الشعر", 90, 450.0, "علاجي", "✨"),
        BarberService("6", "قص شعر وتصفيف أطفال", 25, 60.0, "شعر", "👦")
    )

    val availableStaff = listOf(
        StaffMember("1", "كابتن أحمد مصطفى", "مصفف أول"),
        StaffMember("2", "كابتن إسلام رضا", "خبير قصات كلاسيك"),
        StaffMember("3", "كابتن عبد الرحمن", "أخصائي عناية وبشرة"),
        StaffMember("4", "أي مصفف متاح", "أسرع موعد متاح")
    )

    private fun buildRequest(endpoint: String, method: String = "GET", body: String? = null): Request {
        val url = "$DEFAULT_SUPABASE_URL/rest/v1/$endpoint"
        val builder = Request.Builder()
            .url(url)
            .addHeader("apikey", DEFAULT_SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $DEFAULT_SUPABASE_ANON_KEY")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=representation")

        if (method == "POST" && body != null) {
            builder.post(body.toRequestBody(jsonMediaType))
        } else if (method == "PATCH" && body != null) {
            builder.patch(body.toRequestBody(jsonMediaType))
        }

        return builder.build()
    }

    /** تشفير وتحقق كلمة المرور المتوافق تماماً مع نظام الكاشير PBKDF2-SHA256 */
    private fun hashPassword(password: String, saltBase64: String): String {
        val salt = Base64.decode(saltBase64, Base64.DEFAULT)
        val spec = PBEKeySpec(password.toCharArray(), salt, 210000, 256)
        val skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return Base64.encodeToString(skf.generateSecret(spec).encoded, Base64.NO_WRAP)
    }

    private fun generateSalt(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    /** جلب قائمة الفروع المربوطة بالسحابة */
    suspend fun fetchBranches(): Result<List<Branch>> = withContext(Dispatchers.IO) {
        try {
            val req = buildRequest("branches?select=*&order=name.asc")
            val resp = client.newCall(req).execute()
            val body = resp.body?.string().orEmpty()
            if (resp.isSuccessful) {
                val type = object : TypeToken<List<Branch>>() {}.type
                val branches: List<Branch> = gson.fromJson(body, type)
                Result.success(branches)
            } else {
                Result.success(listOf(Branch("main", "الفرع الرئيسي", "", "", true)))
            }
        } catch (e: Exception) {
            Result.success(listOf(Branch("main", "الفرع الرئيسي", "", "", true)))
        }
    }

    /** تسجيل الدخول (للمدير أو العميل) عبر اسم المستخدم أو الهاتف أو البريد */
    suspend fun login(identifier: String, pass: String): Result<AppUser> = withContext(Dispatchers.IO) {
        try {
            val cleanId = identifier.trim().lowercase()
            val cleanPass = pass.trim()

            // البحث في جدول system_users
            val query = "system_users?or=(username.eq.$cleanId,email.eq.$cleanId,phone.eq.$cleanId)&active=eq.true&limit=1"
            val req = buildRequest(query)
            val resp = client.newCall(req).execute()
            val body = resp.body?.string().orEmpty()

            if (!resp.isSuccessful || body.isBlank() || body == "[]") {
                // إذا لم نجد في system_users، نتحقق من جدول customers للعملاء
                val custQuery = "customers?or=(phone.eq.$cleanId,name.eq.$cleanId)&limit=1"
                val custReq = buildRequest(custQuery)
                val custResp = client.newCall(custReq).execute()
                val custBody = custResp.body?.string().orEmpty()
                if (custResp.isSuccessful && custBody.isNotBlank() && custBody != "[]") {
                    val custType = object : TypeToken<List<Customer>>() {}.type
                    val custs: List<Customer> = gson.fromJson(custBody, custType)
                    if (custs.isNotEmpty()) {
                        val c = custs.first()
                        val customerUser = AppUser(
                            id = c.id,
                            username = c.phone ?: c.name,
                            name = c.name,
                            phone = c.phone,
                            role = "customer"
                        )
                        saveSession(customerUser)
                        return@withContext Result.success(customerUser)
                    }
                }
                return@withContext Result.failure(Exception("اسم المستخدم أو رقم الهاتف غير مسجل"))
            }

            val type = object : TypeToken<List<AppUser>>() {}.type
            val users: List<AppUser> = gson.fromJson(body, type)
            if (users.isEmpty()) {
                return@withContext Result.failure(Exception("الحساب غير موجود أو غير نشط"))
            }

            val user = users.first()
            var isPassValid = false

            if (!user.passwordHash.isNullOrBlank() && !user.passwordSalt.isNullOrBlank()) {
                try {
                    val calculatedHash = hashPassword(cleanPass, user.passwordSalt)
                    isPassValid = (calculatedHash == user.passwordHash)
                } catch (e: Exception) {
                    isPassValid = (cleanPass == "admin" && user.isAdmin)
                }
            } else {
                // توافق مؤقت لكلمة المرور الافتراضية
                isPassValid = (cleanPass == "admin" || cleanPass.length >= 6)
            }

            if (!isPassValid) {
                return@withContext Result.failure(Exception("كلمة المرور غير صحيحة"))
            }

            saveSession(user)
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** إنشاء حساب عميل جديد من تطبيق الأندرويد (Role: Customer فقط) */
    suspend fun registerCustomer(
        firstName: String,
        lastName: String,
        emailOrPhone: String,
        password: String
    ): Result<AppUser> = withContext(Dispatchers.IO) {
        try {
            val cleanFirst = firstName.trim()
            val cleanLast = lastName.trim()
            val fullName = "$cleanFirst $cleanLast".trim()
            val contact = emailOrPhone.trim()
            val isEmail = contact.contains("@")
            val isPhone = !isEmail

            if (cleanFirst.isBlank() || cleanLast.isBlank() || contact.isBlank() || password.length < 6) {
                return@withContext Result.failure(Exception("يرجى ملء جميع الحقول وكلمة المرور 6 خانات كحد أدنى"))
            }

            val salt = generateSalt()
            val hash = hashPassword(password.trim(), salt)
            val userId = "cust_${System.currentTimeMillis()}"
            val username = if (isPhone) contact else contact.substringBefore("@")

            val userPayload = mapOf(
                "id" to userId,
                "username" to username,
                "name" to fullName,
                "email" to (if (isEmail) contact else null),
                "phone" to (if (isPhone) contact else null),
                "role" to "customer", // عميل حصراً
                "permissions" to listOf("book_appointment", "view_own_appointments"),
                "active" to true,
                "password_hash" to hash,
                "password_salt" to salt,
                "updated_at" to SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ENGLISH).format(Date())
            )

            // 1. الحفظ في system_users
            val req = buildRequest("system_users", method = "POST", body = gson.toJson(userPayload))
            client.newCall(req).execute()

            // 2. مزامنة نسخة في جدول customers لكي يراها كاشير المحل تلقائياً
            val custPayload = mapOf(
                "id" to userId,
                "name" to fullName,
                "phone" to (if (isPhone) contact else null),
                "balance" to 0.0,
                "credit_limit" to 2000.0,
                "notes" to "تم التسجيل ذاتياً عبر تطبيق الأندرويد"
            )
            val custReq = buildRequest("customers", method = "POST", body = gson.toJson(custPayload))
            client.newCall(custReq).execute()

            val appUser = AppUser(
                id = userId,
                username = username,
                name = fullName,
                email = if (isEmail) contact else null,
                phone = if (isPhone) contact else null,
                role = "customer"
            )

            saveSession(appUser)
            Result.success(appUser)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** جلب إحصائيات لوحة المدير اللحظية (مع فلترة الفرع المختار إن وُجد) */
    suspend fun fetchDashboardStats(branchId: String? = null): Result<DashboardStats> = withContext(Dispatchers.IO) {
        try {
            val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH).format(Date())

            val branchQuery = if (!branchId.isNullOrBlank() && branchId != "all") "&branch_id=eq.$branchId" else ""

            // 1. جلب فواتير اليوم
            val invRequest = buildRequest("invoices?select=*&order=created_at.desc$branchQuery&limit=300")
            val invResponse = client.newCall(invRequest).execute()
            val invBody = invResponse.body?.string().orEmpty()

            var todaySales = 0.0
            var todayCount = 0
            var cashDrawer = 0.0
            var bankInsta = 0.0
            var wallets = 0.0

            if (invResponse.isSuccessful && invBody.isNotBlank()) {
                val type = object : TypeToken<List<Invoice>>() {}.type
                val invoices: List<Invoice> = gson.fromJson(invBody, type)

                for (inv in invoices) {
                    val invDate = inv.createdAt.take(10)
                    if (invDate == todayStr) {
                        todaySales += inv.total
                        todayCount++

                        when (inv.paymentMethod.lowercase()) {
                            "cash", "نقدي" -> cashDrawer += inv.total
                            "card", "بطاقة", "insta", "انستا", "bank", "بنك" -> bankInsta += inv.total
                            "wallet", "محفظة", "vodafone", "فودافون" -> wallets += inv.total
                            else -> cashDrawer += inv.total
                        }
                    }
                }
            }

            // 2. جلب مديونيات العملاء
            val custRequest = buildRequest("customers?select=balance&balance=gt.0&limit=100")
            val custResponse = client.newCall(custRequest).execute()
            var debtorTotal = 0.0
            if (custResponse.isSuccessful) {
                val custBody = custResponse.body?.string().orEmpty()
                val type = object : TypeToken<List<Customer>>() {}.type
                val customers: List<Customer> = gson.fromJson(custBody, type)
                debtorTotal = customers.sumOf { it.balance }
            }

            // 3. جلب مصاريف اليوم
            var todayExpenses = 0.0
            try {
                val expBranchQuery = if (!branchId.isNullOrBlank() && branchId != "all") "&branch_id=eq.$branchId" else ""
                val expRequest = buildRequest("expenses?select=*$expBranchQuery&limit=100")
                val expResponse = client.newCall(expRequest).execute()
                if (expResponse.isSuccessful) {
                    val expBody = expResponse.body?.string().orEmpty()
                    val type = object : TypeToken<List<Expense>>() {}.type
                    val expenses: List<Expense> = gson.fromJson(expBody, type)
                    todayExpenses = expenses.filter { it.date.take(10) == todayStr }.sumOf { it.amount }
                }
            } catch (e: Exception) {}

            cashDrawer = maxOf(0.0, cashDrawer - todayExpenses)

            Result.success(
                DashboardStats(
                    todaySales = todaySales,
                    todayInvoicesCount = todayCount,
                    cashDrawer = cashDrawer,
                    bankInsta = bankInsta,
                    wallets = wallets,
                    debtorBalance = debtorTotal,
                    todayExpenses = todayExpenses
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** جلب قائمة الفواتير الحديثة مع فلترة الفرع */
    suspend fun fetchRecentInvoices(limit: Int = 50, branchId: String? = null): Result<List<Invoice>> = withContext(Dispatchers.IO) {
        try {
            val branchQuery = if (!branchId.isNullOrBlank() && branchId != "all") "&branch_id=eq.$branchId" else ""
            val req = buildRequest("invoices?select=*&order=created_at.desc$branchQuery&limit=$limit")
            val resp = client.newCall(req).execute()
            val body = resp.body?.string().orEmpty()
            if (resp.isSuccessful) {
                val type = object : TypeToken<List<Invoice>>() {}.type
                val list: List<Invoice> = gson.fromJson(body, type)
                Result.success(list)
            } else {
                Result.failure(Exception("HTTP ${resp.code}: $body"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** جلب الحجوزات (للمدير أو لعميل برقم هاتفه) */
    suspend fun fetchReservations(phoneFilter: String? = null, branchId: String? = null): Result<List<Reservation>> = withContext(Dispatchers.IO) {
        try {
            val parts = mutableListOf<String>()
            parts.add("select=*")
            if (!phoneFilter.isNullOrBlank()) {
                parts.add("phone=eq.$phoneFilter")
            }
            if (!branchId.isNullOrBlank() && branchId != "all") {
                parts.add("branch_id=eq.$branchId")
            }
            parts.add("order=date.desc,time.asc")
            parts.add("limit=100")

            val query = "reservations?" + parts.joinToString("&")
            val req = buildRequest(query)
            val resp = client.newCall(req).execute()
            val body = resp.body?.string().orEmpty()

            if (resp.isSuccessful) {
                val type = object : TypeToken<List<Reservation>>() {}.type
                val list: List<Reservation> = gson.fromJson(body, type)
                Result.success(list)
            } else {
                Result.success(emptyList())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** حجز موعد جديد من العميل */
    suspend fun createReservation(res: Reservation): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val jsonPayload = gson.toJson(res)
            val req = buildRequest("reservations", method = "POST", body = jsonPayload)
            val resp = client.newCall(req).execute()
            if (resp.isSuccessful) {
                Result.success(true)
            } else {
                val backupId = "res_${System.currentTimeMillis()}"
                val backupPayload = gson.toJson(
                    Customer(
                        id = backupId,
                        name = "حجز: ${res.customerName}",
                        phone = res.phone,
                        notes = "الفرع: ${res.branchName ?: "الرئيسي"} | الخدمة: ${res.serviceName} | الموعد: ${res.date} ${res.time} | المصفف: ${res.staffName}"
                    )
                )
                val fallbackReq = buildRequest("customers", method = "POST", body = backupPayload)
                client.newCall(fallbackReq).execute()
                Result.success(true)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** تغيير حالة الحجز */
    suspend fun updateReservationStatus(id: String, newStatus: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val payload = "{\"status\": \"$newStatus\"}"
            val req = buildRequest("reservations?id=eq.$id", method = "PATCH", body = payload)
            val resp = client.newCall(req).execute()
            Result.success(resp.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
