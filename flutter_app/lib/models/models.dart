class Invoice {
  final String? clientKey;
  final String invoiceNumber;
  final String? branchId;
  final String? branchName;
  final String? customerId;
  final String? customerName;
  final String? phone;
  final double subtotal;
  final double discountPercent;
  final double taxPercent;
  final double total;
  final String paymentMethod;
  final String status;
  final String? notes;
  final String? staffName;
  final String createdAt;

  Invoice({
    this.clientKey,
    this.invoiceNumber = '',
    this.branchId,
    this.branchName,
    this.customerId,
    this.customerName,
    this.phone,
    this.subtotal = 0.0,
    this.discountPercent = 0.0,
    this.taxPercent = 0.0,
    this.total = 0.0,
    this.paymentMethod = 'cash',
    this.status = 'paid',
    this.notes,
    this.staffName,
    this.createdAt = '',
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      clientKey: json['client_key'],
      invoiceNumber: json['invoice_number']?.toString() ?? '',
      branchId: json['branch_id'],
      branchName: json['branch_name'],
      customerId: json['customer_id'],
      customerName: json['customer_name'],
      phone: json['phone'],
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      discountPercent: (json['discount_percent'] as num?)?.toDouble() ?? 0.0,
      taxPercent: (json['tax_percent'] as num?)?.toDouble() ?? 0.0,
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: json['payment_method'] ?? 'cash',
      status: json['status'] ?? 'paid',
      notes: json['notes'],
      staffName: json['staff_name'],
      createdAt: json['created_at'] ?? '',
    );
  }
}

class Customer {
  final String id;
  final String name;
  final String? phone;
  final double balance;
  final double creditLimit;
  final String? notes;

  Customer({
    this.id = '',
    this.name = '',
    this.phone,
    this.balance = 0.0,
    this.creditLimit = 2000.0,
    this.notes,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      phone: json['phone'],
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      creditLimit: (json['credit_limit'] as num?)?.toDouble() ?? 2000.0,
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'balance': balance,
    'credit_limit': creditLimit,
    'notes': notes,
  };
}

class Reservation {
  final String id;
  final String customerName;
  final String phone;
  final String date;
  final String time;
  final String serviceName;
  final String staffName;
  final String status; // pending, confirmed, completed, cancelled
  final String? notes;
  final String? branchId;
  final String? createdAt;

  Reservation({
    this.id = '',
    required this.customerName,
    required this.phone,
    required this.date,
    required this.time,
    required this.serviceName,
    required this.staffName,
    this.status = 'pending',
    this.notes,
    this.branchId,
    this.createdAt,
  });

  factory Reservation.fromJson(Map<String, dynamic> json) {
    return Reservation(
      id: json['id']?.toString() ?? '',
      customerName: json['customer_name'] ?? '',
      phone: json['phone'] ?? '',
      date: json['date'] ?? '',
      time: json['time'] ?? '',
      serviceName: json['service_name'] ?? '',
      staffName: json['staff_name'] ?? '',
      status: json['status'] ?? 'pending',
      notes: json['notes'],
      branchId: json['branch_id'],
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'customer_name': customerName,
    'phone': phone,
    'date': date,
    'time': time,
    'service_name': serviceName,
    'staff_name': staffName,
    'status': status,
    if (notes != null) 'notes': notes,
    if (branchId != null) 'branch_id': branchId,
    if (createdAt != null) 'created_at': createdAt,
  };
}

class Expense {
  final String id;
  final String title;
  final double amount;
  final String category;
  final String date;
  final String method;

  Expense({
    this.id = '',
    this.title = '',
    this.amount = 0.0,
    this.category = 'عام',
    this.date = '',
    this.method = 'cash',
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      category: json['category'] ?? 'عام',
      date: json['date'] ?? '',
      method: json['method'] ?? 'cash',
    );
  }
}

class BarberService {
  final String id;
  final String name;
  final int durationMinutes;
  final double price;
  final String category;
  final String iconEmoji;

  const BarberService({
    required this.id,
    required this.name,
    required this.durationMinutes,
    required this.price,
    required this.category,
    required this.iconEmoji,
  });
}

class StaffMember {
  final String id;
  final String name;
  final String role;
  final bool isAvailable;

  const StaffMember({
    required this.id,
    required this.name,
    required this.role,
    this.isAvailable = true,
  });
}

class DashboardStats {
  final double todaySales;
  final int todayInvoicesCount;
  final double cashDrawer;
  final double bankInsta;
  final double wallets;
  final double debtorBalance;
  final double todayExpenses;

  const DashboardStats({
    this.todaySales = 0.0,
    this.todayInvoicesCount = 0,
    this.cashDrawer = 0.0,
    this.bankInsta = 0.0,
    this.wallets = 0.0,
    this.debtorBalance = 0.0,
    this.todayExpenses = 0.0,
  });
}

class Branch {
  final String id;
  final String name;
  final String? address;
  final String? phone;
  final bool isDefault;

  Branch({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    this.isDefault = false,
  });

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      address: json['address'],
      phone: json['phone'],
      isDefault: json['is_default'] == true,
    );
  }
}

class AppUser {
  final String id;
  final String username;
  final String name;
  final String role;
  final String? email;
  final String? phone;
  final String? locationId;

  AppUser({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    this.email,
    this.phone,
    this.locationId,
  });

  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isCashier => role.toLowerCase() == 'cashier';
  bool get isCustomer => role.toLowerCase() == 'customer';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id']?.toString() ?? '',
      username: json['username'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? 'customer',
      email: json['email'],
      phone: json['phone'],
      locationId: json['location_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'name': name,
    'role': role,
    if (email != null) 'email': email,
    if (phone != null) 'phone': phone,
    if (locationId != null) 'location_id': locationId,
  };
}
