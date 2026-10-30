import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ServerConfig {
  String url;
  String apiKey;
  ServerConfig({this.url = '', this.apiKey = ''});
}

class InvoiceItem {
  final String name;
  final int quantity;
  final double price;

  InvoiceItem({required this.name, required this.quantity, required this.price});

  double get lineTotal => price * quantity;

  factory InvoiceItem.fromJson(Map<String, dynamic> json) => InvoiceItem(
        name: (json['name'] ?? '').toString(),
        quantity: (json['quantity'] ?? 1) as int,
        price: ((json['price'] ?? 0) as num).toDouble(),
      );
}

class Invoice {
  final String id;
  final int? localId;
  final String customerName;
  final String phone;
  final double subtotal;
  final double discount;
  final double tax;
  final double total;
  final String date;
  final String paymentMethod;
  final String status;
  final String createdBy;
  final String staffName;
  final List<InvoiceItem> items;
  final int timestamp;

  Invoice({
    required this.id,
    this.localId,
    required this.customerName,
    required this.phone,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.total,
    required this.date,
    required this.paymentMethod,
    required this.status,
    required this.createdBy,
    required this.staffName,
    required this.items,
    this.timestamp = 0,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: (json['id'] ?? '').toString(),
        localId: json['local_id'] as int?,
        customerName: (json['customer_name'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
        subtotal: ((json['subtotal'] ?? 0) as num).toDouble(),
        discount: ((json['discount'] ?? 0) as num).toDouble(),
        tax: ((json['tax'] ?? 0) as num).toDouble(),
        total: ((json['total'] ?? 0) as num).toDouble(),
        date: (json['date'] ?? '').toString(),
        paymentMethod: (json['payment_method'] ?? 'cash').toString(),
        status: (json['status'] ?? 'paid').toString(),
        createdBy: (json['created_by'] ?? '').toString(),
        staffName: (json['staff_name'] ?? '').toString(),
        timestamp: ((json['timestamp'] ?? 0) as num).toInt(),
        items: ((json['items'] ?? []) as List)
            .map((e) => InvoiceItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class Summary {
  final int invoices;
  final double sales;
  final double discounts;
  final double taxes;

  Summary({required this.invoices, required this.sales, required this.discounts, required this.taxes});

  factory Summary.fromJson(Map<String, dynamic> json) => Summary(
        invoices: (json['invoices'] ?? 0) as int,
        sales: ((json['sales'] ?? 0) as num).toDouble(),
        discounts: ((json['discounts'] ?? 0) as num).toDouble(),
        taxes: ((json['taxes'] ?? 0) as num).toDouble(),
      );
}

class Customer {
  final dynamic id;
  final String name;
  final String phone;
  final double totalSpent;
  final int loyaltyPoints;
  final String tier;
  final String lastVisit;
  final int invoices;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.totalSpent,
    required this.loyaltyPoints,
    required this.tier,
    required this.lastVisit,
    required this.invoices,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id'],
        name: (json['name'] ?? '').toString(),
        phone: (json['phone'] ?? '').toString(),
        totalSpent: ((json['total_spent'] ?? 0) as num).toDouble(),
        loyaltyPoints: ((json['loyalty_points'] ?? 0) as num).toInt(),
        tier: (json['tier'] ?? 'Bronze').toString(),
        lastVisit: (json['last_visit'] ?? '').toString(),
        invoices: ((json['invoices'] ?? 0) as num).toInt(),
      );
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}

class ApiClient {
  ServerConfig config;
  ApiClient(this.config);

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = config.url.trim().replaceAll(RegExp(r'/+$'), '');
    if (base.isEmpty) throw ApiException('لم يتم إعداد رابط السيرفر بعد');
    return Uri.parse('$base$path').replace(queryParameters: {
      if (query != null) ...query,
    });
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (config.apiKey.trim().isNotEmpty) 'X-API-Key': config.apiKey.trim(),
      };

  Future<dynamic> _get(String path, {Map<String, String>? query}) async {
    try {
      final res = await http.get(_uri(path, query), headers: _headers).timeout(const Duration(seconds: 20));
      if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
      throw ApiException('خطأ من السيرفر: ${res.statusCode}');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('تعذر الاتصال بالسيرفر: $e');
    }
  }

  Future<bool> health() async {
    try {
      final res = await http.get(_uri('/health'), headers: _headers).timeout(const Duration(seconds: 10));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// الحذف المنطقي (tombstone) لا يُعرض: الفواتير الملغاة تُستبعد من العارض
  static bool _live(dynamic row) =>
      row is Map && ((row['deleted'] as num?) ?? 0) != 1;

  Future<List<Invoice>> fetchInvoices({
    String search = '',
    String dateFrom = '',
    String dateTo = '',
    int page = 1,
    int pageSize = 100,
  }) async {
    final data = await _get('/api/invoices', query: {
      if (search.isNotEmpty) 'search': search,
      if (dateFrom.isNotEmpty) 'date_from': dateFrom,
      if (dateTo.isNotEmpty) 'date_to': dateTo,
      'page': '$page',
      'page_size': '$pageSize',
    }) as Map<String, dynamic>;
    return ((data['invoices'] ?? []) as List)
        .where(_live)
        .map((e) => Invoice.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// مزامنة تنازلية: كل ما تغيّر بعد ملّي ثانية زمنية (تحديثات وإلغاءات وليس جدداً فقط)
  Future<List<Invoice>> fetchInvoicesSince(int since, {int pageSize = 200}) async {
    final data = await _get('/api/invoices', query: {
      'since': '$since',
      'page': '1',
      'page_size': '$pageSize',
    }) as Map<String, dynamic>;
    return ((data['invoices'] ?? []) as List)
        .where(_live)
        .map((e) => Invoice.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// معلومات السيرفر (حالة قاعدة البيانات، وضع الإيميل، روابط الشبكة المحلية)
  Future<Map<String, dynamic>> fetchHealth() async {
    final data = await _get('/health') as Map<String, dynamic>;
    return data;
  }

  Future<Summary> fetchSummary({String dateFrom = '', String dateTo = ''}) async {
    final data = await _get('/api/stats/summary', query: {
      if (dateFrom.isNotEmpty) 'date_from': dateFrom,
      if (dateTo.isNotEmpty) 'date_to': dateTo,
    }) as Map<String, dynamic>;
    return Summary.fromJson(data);
  }

  Future<List<Map<String, dynamic>>> fetchDaily({int days = 30}) async {
    final data = await _get('/api/stats/daily', query: {'days': '$days'}) as Map<String, dynamic>;
    return ((data['series'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<List<Map<String, dynamic>>> fetchMonthly({int months = 12}) async {
    final data = await _get('/api/stats/monthly', query: {'months': '$months'}) as Map<String, dynamic>;
    return ((data['series'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<List<Customer>> searchCustomers(String q) async {
    final data = await _get('/api/customers', query: {'q': q, 'limit': '50'}) as Map<String, dynamic>;
    return ((data['results'] ?? []) as List)
        .map((e) => Customer.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

/// نسخة واحدة من العميل تستخدمها كل الشاشات
class AppApi {
  static ApiClient? _client;
  static ApiClient get i => _client ??= ApiClient(ServerConfig());

  static const _kUrl = 'server_url';
  static const _kKey = 'server_api_key';

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    i.config = ServerConfig(
      url: prefs.getString(_kUrl) ?? '',
      apiKey: prefs.getString(_kKey) ?? '',
    );
  }

  static Future<void> save(ServerConfig config) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kUrl, config.url.trim());
    await prefs.setString(_kKey, config.apiKey.trim());
    i.config = ServerConfig(url: config.url.trim(), apiKey: config.apiKey.trim());
  }
}
