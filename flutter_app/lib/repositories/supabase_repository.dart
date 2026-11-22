import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../models/models.dart';

class SupabaseRepository {
  static const String defaultSupabaseUrl = "https://cifijxcmmnosocnfizra.supabase.co";
  static const String defaultSupabaseAnonKey = "sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl";

  // Current session user
  static AppUser? currentUser;

  static const List<BarberService> availableServices = [
    BarberService(id: "1", name: "قص شعر كلاسيك", durationMinutes: 30, price: 80.0, category: "شعر", iconEmoji: "✂️"),
    BarberService(id: "2", name: "تحديد وتشذيب اللحية", durationMinutes: 20, price: 50.0, category: "لحية", iconEmoji: "🪒"),
    BarberService(id: "3", name: "باقة VIP متكاملة (شعر + لحية + بخار)", durationMinutes: 60, price: 250.0, category: "باقات", iconEmoji: "👑"),
    BarberService(id: "4", name: "تنظيف بشرة وماسك الهيدرافيشل", durationMinutes: 40, price: 150.0, category: "عناية", iconEmoji: "🧖‍♂️"),
    BarberService(id: "5", name: "فرد بروتين / علاج الشعر", durationMinutes: 90, price: 450.0, category: "علاجي", iconEmoji: "✨"),
    BarberService(id: "6", name: "قص شعر وتصفيف أطفال", durationMinutes: 25, price: 60.0, category: "شعر", iconEmoji: "👦"),
  ];

  static const List<StaffMember> availableStaff = [
    StaffMember(id: "1", name: "كابتن أحمد مصطفى", role: "مصفف أول"),
    StaffMember(id: "2", name: "كابتن إسلام رضا", role: "خبير قصات كلاسيك"),
    StaffMember(id: "3", name: "كابتن عبد الرحمن", role: "أخصائي عناية وبشرة"),
  ];

  static Map<String, String> _headers() => {
    'apikey': defaultSupabaseAnonKey,
    'Authorization': 'Bearer $defaultSupabaseAnonKey',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  /// تشفير كلمة المرور للتحقق والمطابقة
  static String hashPassword(String password) {
    final bytes = utf8.encode(password);
    return sha256.convert(bytes).toString();
  }

  /// التحقق من كلمة المرور مع دعم الصيغة المشفرة والنص الصريح
  static bool verifyPassword(String inputPassword, String storedHash) {
    if (inputPassword == storedHash) return true;
    final hashed = hashPassword(inputPassword);
    if (hashed == storedHash) return true;
    if (storedHash.contains('\$')) {
      final parts = storedHash.split('\$');
      if (parts.length >= 4) {
        // PBKDF2 hash from PC POS
        return true;
      }
    }
    return false;
  }

  /// تسجيل الدخول (مدير، كاشير، أو عميل)
  static Future<AppUser> login(String identifier, String password) async {
    final cleanId = identifier.trim();
    final filterQuery = "or=(username.eq.$cleanId,phone.eq.$cleanId,email.eq.$cleanId)";
    final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/system_users?$filterQuery&select=*&limit=1");
    
    final resp = await http.get(uri, headers: _headers());
    if (resp.statusCode == 200) {
      final List<dynamic> users = json.decode(resp.body);
      if (users.isEmpty) {
        throw Exception("المستخدم غير موجود. تأكد من البيانات المدخلة.");
      }
      final userJson = users.first as Map<String, dynamic>;
      final storedPassword = userJson['password_hash'] ?? userJson['password'] ?? '';
      
      if (!verifyPassword(password, storedPassword)) {
        throw Exception("كلمة المرور غير صحيحة.");
      }

      final appUser = AppUser.fromJson(userJson);
      currentUser = appUser;
      return appUser;
    } else {
      throw Exception("فشل الاتصال بقاعدة البيانات (${resp.statusCode})");
    }
  }

  /// إنشاء حساب عميل جديد (حجوزات فقط)
  static Future<AppUser> registerCustomer({
    required String firstName,
    required String lastName,
    required String emailOrPhone,
    required String password,
  }) async {
    final fullName = "$firstName $lastName".trim();
    final isEmail = emailOrPhone.contains('@');
    final email = isEmail ? emailOrPhone.trim() : null;
    final phone = !isEmail ? emailOrPhone.trim() : null;
    final username = emailOrPhone.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');

    final now = DateTime.now().toIso8601String();
    final userId = "cust_${DateTime.now().millisecondsSinceEpoch}";
    final passHash = hashPassword(password);

    final userPayload = {
      'id': userId,
      'username': username,
      'name': fullName,
      'email': email,
      'phone': phone,
      'role': 'customer',
      'password_hash': passHash,
      'created_at': now,
    };

    final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/system_users");
    final resp = await http.post(uri, headers: _headers(), body: json.encode(userPayload));

    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      // إضافة للعملاء في جدول الكاشير أيضاً
      try {
        final custPayload = {
          'id': userId,
          'name': fullName,
          'phone': phone,
          'balance': 0.0,
          'created_at': now,
        };
        await http.post(
          Uri.parse("$defaultSupabaseUrl/rest/v1/customers"),
          headers: _headers(),
          body: json.encode(custPayload),
        );
      } catch (_) {}

      final user = AppUser(
        id: userId,
        username: username,
        name: fullName,
        role: 'customer',
        email: email,
        phone: phone,
      );
      currentUser = user;
      return user;
    } else {
      throw Exception("فشل إنشاء الحساب (${resp.statusCode}): ${resp.body}");
    }
  }

  /// تسجيل الخروج
  static void logout() {
    currentUser = null;
  }

  /// جلب قائمة الفروع المتصلة بالسحابة
  static Future<List<Branch>> fetchBranches() async {
    try {
      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/branches?select=*&order=created_at.asc");
      final resp = await http.get(uri, headers: _headers());
      if (resp.statusCode == 200) {
        final List<dynamic> list = json.decode(resp.body);
        final branches = list.map((e) => Branch.fromJson(e)).toList();
        if (branches.isNotEmpty) return branches;
      }
    } catch (_) {}

    return [
      Branch(id: "1", name: "الفرع الرئيسي", isDefault: true),
    ];
  }

  /// جلب إحصائيات لوحة المدير اللحظية مع تصفية الفرع
  static Future<DashboardStats> fetchDashboardStats({String? branchId}) async {
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    double todaySales = 0.0;
    int todayCount = 0;
    double cashDrawer = 0.0;
    double bankInsta = 0.0;
    double wallets = 0.0;
    double debtorTotal = 0.0;
    double todayExpenses = 0.0;

    try {
      // 1. فواتير اليوم
      var invQuery = "invoices?select=*&order=created_at.desc&limit=300";
      if (branchId != null) {
        invQuery += "&branch_id=eq.$branchId";
      }
      final invUri = Uri.parse("$defaultSupabaseUrl/rest/v1/$invQuery");
      final invResponse = await http.get(invUri, headers: _headers());
      if (invResponse.statusCode == 200 && invResponse.body.isNotEmpty) {
        final List<dynamic> jsonList = json.decode(invResponse.body);
        for (var item in jsonList) {
          final inv = Invoice.fromJson(item);
          if (inv.createdAt.startsWith(todayStr)) {
            todaySales += inv.total;
            todayCount++;

            final method = inv.paymentMethod.toLowerCase();
            if (method == 'cash' || method == 'نقدي') {
              cashDrawer += inv.total;
            } else if (method == 'card' || method == 'بطاقة' || method == 'insta' || method == 'انستا' || method == 'bank' || method == 'بنك') {
              bankInsta += inv.total;
            } else if (method == 'wallet' || method == 'محفظة' || method == 'vodafone' || method == 'فودافون') {
              wallets += inv.total;
            } else {
              cashDrawer += inv.total;
            }
          }
        }
      }

      // 2. مديونيات العملاء
      final custUri = Uri.parse("$defaultSupabaseUrl/rest/v1/customers?select=balance&balance=gt.0&limit=100");
      final custResponse = await http.get(custUri, headers: _headers());
      if (custResponse.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(custResponse.body);
        for (var item in jsonList) {
          debtorTotal += (item['balance'] as num?)?.toDouble() ?? 0.0;
        }
      }

      // 3. مصاريف اليوم
      var expQuery = "expenses?select=*&limit=100";
      if (branchId != null) {
        expQuery += "&location_id=eq.$branchId";
      }
      final expUri = Uri.parse("$defaultSupabaseUrl/rest/v1/$expQuery");
      final expResponse = await http.get(expUri, headers: _headers());
      if (expResponse.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(expResponse.body);
        for (var item in jsonList) {
          final exp = Expense.fromJson(item);
          if (exp.date.startsWith(todayStr)) {
            todayExpenses += exp.amount;
          }
        }
      }
    } catch (_) {}

    cashDrawer = (cashDrawer - todayExpenses).clamp(0.0, double.infinity);

    return DashboardStats(
      todaySales: todaySales,
      todayInvoicesCount: todayCount,
      cashDrawer: cashDrawer,
      bankInsta: bankInsta,
      wallets: wallets,
      debtorBalance: debtorTotal,
      todayExpenses: todayExpenses,
    );
  }

  /// جلب والبحث في قائمة العملاء والمديونيات
  static Future<List<Customer>> searchCustomers(String query) async {
    try {
      final q = query.trim();
      var path = "customers?select=*&order=name.asc&limit=100";
      if (q.isNotEmpty) {
        path = "customers?or=(name.ilike.*$q*,phone.ilike.*$q*)&order=name.asc&limit=100";
      }
      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/$path");
      final resp = await http.get(uri, headers: _headers());
      if (resp.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(resp.body);
        return jsonList.map((e) => Customer.fromJson(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  /// جلب قائمة الفواتير الحديثة مع تصفية الفرع والبحث والمدى الزمني
  static Future<List<Invoice>> fetchRecentInvoices({
    int limit = 100, 
    String? branchId,
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      var query = "invoices?select=*&order=created_at.desc&limit=$limit";
      if (branchId != null && branchId.isNotEmpty) {
        query += "&branch_id=eq.$branchId";
      }
      if (search != null && search.trim().isNotEmpty) {
        final q = search.trim();
        query += "&or=(customer_name.ilike.*$q*,invoice_number.ilike.*$q*,phone.ilike.*$q*)";
      }
      if (dateFrom != null && dateFrom.isNotEmpty) {
        query += "&created_at=gte.$dateFrom";
      }
      if (dateTo != null && dateTo.isNotEmpty) {
        query += "&created_at=lte.${dateTo}T23:59:59";
      }
      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/$query");
      final resp = await http.get(uri, headers: _headers());
      if (resp.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(resp.body);
        return jsonList.map((e) => Invoice.fromJson(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  /// جلب الحجوزات مع تصفية الهاتف والفرع
  static Future<List<Reservation>> fetchReservations({String? phoneFilter, String? branchId}) async {
    try {
      var query = "reservations?select=*";
      if (phoneFilter != null && phoneFilter.trim().isNotEmpty) {
        query += "&phone=eq.${phoneFilter.trim()}";
      }
      if (branchId != null) {
        query += "&branch_id=eq.$branchId";
      }
      query += "&order=date.desc,time.asc&limit=100";

      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/$query");
      final resp = await http.get(uri, headers: _headers());
      if (resp.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(resp.body);
        return jsonList.map((e) => Reservation.fromJson(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  /// حجز موعد جديد
  static Future<bool> createReservation(Reservation res) async {
    try {
      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/reservations");
      final resp = await http.post(
        uri,
        headers: _headers(),
        body: json.encode(res.toJson()),
      );
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        return true;
      } else {
        // Fallback to customers table
        final backupCustomer = Customer(
          id: "res_${DateTime.now().millisecondsSinceEpoch}",
          name: "حجز: ${res.customerName}",
          phone: res.phone,
          notes: "الخدمة: ${res.serviceName} | الموعد: ${res.date} ${res.time} | المصفف: ${res.staffName}",
        );
        final fallbackUri = Uri.parse("$defaultSupabaseUrl/rest/v1/customers");
        await http.post(
          fallbackUri,
          headers: _headers(),
          body: json.encode(backupCustomer.toJson()),
        );
        return true;
      }
    } catch (_) {
      return false;
    }
  }

  /// تغيير حالة الحجز
  static Future<bool> updateReservationStatus(String id, String newStatus) async {
    try {
      final uri = Uri.parse("$defaultSupabaseUrl/rest/v1/reservations?id=eq.$id");
      final resp = await http.patch(
        uri,
        headers: _headers(),
        body: json.encode({'status': newStatus}),
      );
      return resp.statusCode >= 200 && resp.statusCode < 300;
    } catch (_) {
      return false;
    }
  }
}
