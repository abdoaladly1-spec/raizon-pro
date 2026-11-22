import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';
import 'auth_screen.dart';
import 'invoices_screen.dart';
import 'customers_screen.dart';

class ManagerDashboardScreen extends StatefulWidget {
  const ManagerDashboardScreen({super.key});

  @override
  State<ManagerDashboardScreen> createState() => _ManagerDashboardScreenState();
}

class _ManagerDashboardScreenState extends State<ManagerDashboardScreen> {
  bool isLoading = true;
  DashboardStats stats = const DashboardStats();
  List<Invoice> invoices = [];
  List<Reservation> reservations = [];
  List<Branch> branches = [];
  String? selectedBranchId;
  int activeTab = 0; // 0: invoices, 1: reservations

  final currencyFormatter = NumberFormat("#,##0", "en_US");

  @override
  void initState() {
    super.initState();
    loadData();
  }

  void loadData() async {
    setState(() => isLoading = true);

    final bList = await SupabaseRepository.fetchBranches();
    final s = await SupabaseRepository.fetchDashboardStats(branchId: selectedBranchId);
    final invs = await SupabaseRepository.fetchRecentInvoices(limit: 40, branchId: selectedBranchId);
    final resvs = await SupabaseRepository.fetchReservations(branchId: selectedBranchId);

    if (!mounted) return;

    setState(() {
      branches = bList;
      stats = s;
      invoices = invs;
      reservations = resvs;
      isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate950,
      appBar: AppBar(
        backgroundColor: AppColors.slate900,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.emerald400),
            onPressed: loadData,
          ),
          IconButton(
            icon: const Icon(Icons.exit_to_app, color: Colors.redAccent),
            tooltip: "تسجيل خروج",
            onPressed: () {
              SupabaseRepository.logout();
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const AuthScreen()),
                (route) => false,
              );
            },
          ),
        ],
        title: const Align(
          alignment: Alignment.centerRight,
          child: Column(
            crossAxisAlignment: CrossAlignment.end,
            children: [
              Text(
                "لوحة المدير اللحظية",
                style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Text(
                "متابعة مباشرة عبر السحابة",
                style: TextStyle(color: AppColors.emerald400, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.emerald500))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Branch Selector Filter Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: AppColors.slate900,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.slate800),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              selectedBranchId == null ? "عرض كافة الفروع المتصلة" : "بيانات الفرع المحدد",
                              style: const TextStyle(color: AppColors.emerald400, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                            const Text(
                              "تصفية حسب الفرع:",
                              style: TextStyle(color: AppColors.slate400, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          reverse: true, // RTL feel
                          child: Row(
                            children: [
                              GestureDetector(
                                onTap: () {
                                  setState(() => selectedBranchId = null);
                                  loadData();
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  margin: const EdgeInsets.only(left: 8),
                                  decoration: BoxDecoration(
                                    color: selectedBranchId == null ? AppColors.emerald500 : AppColors.slate800,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: selectedBranchId == null ? AppColors.emerald400 : AppColors.slate700,
                                    ),
                                  ),
                                  child: Text(
                                    "جميع الفروع",
                                    style: TextStyle(
                                      color: selectedBranchId == null ? Colors.white : AppColors.slate300,
                                      fontSize: 12,
                                      fontWeight: selectedBranchId == null ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                ),
                              ),
                              ...branches.map((b) {
                                final isSel = selectedBranchId == b.id;
                                return GestureDetector(
                                  onTap: () {
                                    setState(() => selectedBranchId = b.id);
                                    loadData();
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                    margin: const EdgeInsets.only(left: 8),
                                    decoration: BoxDecoration(
                                      color: isSel ? AppColors.emerald500 : AppColors.slate800,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isSel ? AppColors.emerald400 : AppColors.slate700,
                                      ),
                                    ),
                                    child: Text(
                                      b.name,
                                      style: TextStyle(
                                        color: isSel ? Colors.white : AppColors.slate300,
                                        fontSize: 12,
                                        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Top Hero Sales Card (Clickable to view Invoices)
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => InvoicesScreen(initialBranchId: selectedBranchId),
                        ),
                      );
                    },
                    child: _HeroSalesCard(
                      amount: currencyFormatter.format(stats.todaySales),
                      invoicesCount: stats.todayInvoicesCount,
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Metrics Row 1
                  Row(
                    children: [
                      Expanded(
                        child: _MetricCard(
                          title: "رصيد بنكي / انستا",
                          amount: "${currencyFormatter.format(stats.bankInsta)} ج.م",
                          tag: "لحظي",
                          accentColor: AppColors.cyan500,
                          icon: Icons.credit_card,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MetricCard(
                          title: "درج النقدية الفعلي",
                          amount: "${currencyFormatter.format(stats.cashDrawer)} ج.م",
                          tag: "كاش",
                          accentColor: AppColors.emerald500,
                          icon: Icons.account_balance_wallet,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Metrics Row 2
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const CustomersScreen()),
                            );
                          },
                          child: _MetricCard(
                            title: "بطاقة المدينون (الآجل)",
                            amount: "${currencyFormatter.format(stats.debtorBalance)} ج.م",
                            tag: "ديون",
                            accentColor: AppColors.red500,
                            icon: Icons.people,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MetricCard(
                          title: "المحافظ الإلكترونية",
                          amount: "${currencyFormatter.format(stats.wallets)} ج.م",
                          tag: "فودافون كاش",
                          accentColor: AppColors.amber500,
                          icon: Icons.phone_android,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Expenses Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.slate900,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.slate800),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "${currencyFormatter.format(stats.todayExpenses)} ج.م",
                          style: const TextStyle(color: AppColors.red500, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const Column(
                          crossAxisAlignment: CrossAlignment.end,
                          children: [
                            Text("مصاريف اليوم", style: TextStyle(color: AppColors.slate200, fontSize: 14, fontWeight: FontWeight.w600)),
                            Text("المصروفات المسجلة اليوم", style: TextStyle(color: AppColors.slate400, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Quick Actions & Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => InvoicesScreen(initialBranchId: selectedBranchId),
                            ),
                          );
                        },
                        icon: const Icon(Icons.arrow_back, color: AppColors.cyan500, size: 16),
                        label: const Text(
                          "عرض وبحث كل الفواتير",
                          style: TextStyle(color: AppColors.cyan500, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                      const Text(
                        "العمليات اللحظية",
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Tab Buttons
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.slate900,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => activeTab = 0),
                            child: Container(
                              padding: const EdgeInsets.vertical(12),
                              decoration: BoxDecoration(
                                color: activeTab == 0 ? AppColors.emerald500.withOpacity(0.2) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: activeTab == 0 ? AppColors.emerald500 : Colors.transparent),
                              ),
                              child: Text(
                                "آخر الفواتير (${invoices.length})",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: activeTab == 0 ? AppColors.emerald400 : AppColors.slate400,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => activeTab = 1),
                            child: Container(
                              padding: const EdgeInsets.vertical(12),
                              decoration: BoxDecoration(
                                color: activeTab == 1 ? AppColors.emerald500.withOpacity(0.2) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: activeTab == 1 ? AppColors.emerald500 : Colors.transparent),
                              ),
                              child: Text(
                                "حجوزات العملاء (${reservations.length})",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: activeTab == 1 ? AppColors.emerald400 : AppColors.slate400,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  if (activeTab == 0) ...[
                    if (invoices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 36),
                        child: Text("لا توجد فواتير مسجلة اليوم حتى الآن", style: TextStyle(color: AppColors.slate400, fontSize: 14)),
                      )
                    else
                      ...invoices.map((inv) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _InvoiceRow(invoice: inv),
                          )),
                  ] else ...[
                    if (reservations.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 36),
                        child: Text("لا توجد حجوزات واردة حالياً", style: TextStyle(color: AppColors.slate400, fontSize: 14)),
                      )
                    else
                      ...reservations.map((res) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _ReservationAdminRow(
                              reservation: res,
                              onConfirm: () async {
                                await SupabaseRepository.updateReservationStatus(res.id, "confirmed");
                                loadData();
                              },
                              onCancel: () async {
                                await SupabaseRepository.updateReservationStatus(res.id, "cancelled");
                                loadData();
                              },
                            ),
                          )),
                  ],

                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}

class _HeroSalesCard extends StatelessWidget {
  final String amount;
  final int invoicesCount;

  const _HeroSalesCard({required this.amount, required this.invoicesCount});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.slate900,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.emerald500.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.emerald500.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "$invoicesCount فاتورة اليوم",
                  style: const TextStyle(color: AppColors.emerald400, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
              const Text("مبيعات اليوم الإجمالية", style: TextStyle(color: AppColors.slate400, fontSize: 13, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              const Text("ج.م", style: TextStyle(color: AppColors.emerald500, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(width: 6),
              Text(amount, style: const TextStyle(color: AppColors.emerald400, fontSize: 34, fontWeight: FontWeight.w900)),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String amount;
  final String tag;
  final Color accentColor;
  final IconData icon;

  const _MetricCard({
    required this.title,
    required this.amount,
    required this.tag,
    required this.accentColor,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.slate900,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Column(
        crossAxisAlignment: CrossAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(tag, style: TextStyle(color: accentColor, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: accentColor, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(color: AppColors.slate400, fontSize: 11), textAlign: TextAlign.right),
          const SizedBox(height: 4),
          Text(amount, style: const TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  final Invoice invoice;

  const _InvoiceRow({required this.invoice});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.slate900,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            "${invoice.total} ج.م",
            style: const TextStyle(color: AppColors.amber400, fontSize: 15, fontWeight: FontWeight.w900),
          ),
          Column(
            crossAxisAlignment: CrossAlignment.end,
            children: [
              Row(
                children: [
                  Text("#${invoice.invoiceNumber}", style: const TextStyle(color: AppColors.amber500, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 6),
                  Text(
                    invoice.customerName ?? "عميل نقدي",
                    style: const TextStyle(color: AppColors.white, fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Row(
                children: [
                  Text(
                    invoice.createdAt.length >= 16 ? invoice.createdAt.substring(0, 16).replaceAll("T", " ") : invoice.createdAt,
                    style: const TextStyle(color: AppColors.slate400, fontSize: 11),
                  ),
                  const SizedBox(width: 8),
                  Text("• ${invoice.paymentMethod}", style: const TextStyle(color: AppColors.emerald400, fontSize: 11)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReservationAdminRow extends StatelessWidget {
  final Reservation reservation;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  const _ReservationAdminRow({
    required this.reservation,
    required this.onConfirm,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    Color statusBg;
    String statusText;

    switch (reservation.status) {
      case "confirmed":
        statusBg = AppColors.emerald500;
        statusText = "مؤكد";
        break;
      case "cancelled":
        statusBg = AppColors.red500;
        statusText = "ملغي";
        break;
      default:
        statusBg = AppColors.amber500;
        statusText = "قيد المراجعة";
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.slate900,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Column(
        crossAxisAlignment: CrossAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBg.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusText, style: TextStyle(color: statusBg, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              Text(
                reservation.customerName,
                style: const TextStyle(color: AppColors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text("الخدمة: ${reservation.serviceName} | المصفف: ${reservation.staffName}", style: const TextStyle(color: AppColors.slate300, fontSize: 13)),
          Text("الموعد: ${reservation.date} الساعة ${reservation.time} | هاتف: ${reservation.phone}", style: const TextStyle(color: AppColors.slate400, fontSize: 12)),

          if (reservation.status == "pending") ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.emerald600, shape: RoundedCornerShape(8)),
                    onPressed: onConfirm,
                    child: const Text("تأكيد الحجز", style: TextStyle(color: AppColors.white, fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.red500),
                      shape: RoundedCornerShape(8),
                    ),
                    onPressed: onCancel,
                    child: const Text("إلغاء", style: TextStyle(color: AppColors.red500, fontSize: 12)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
