import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _ctrl = TextEditingController();
  List<Customer> _results = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final list = await SupabaseRepository.searchCustomers(q.trim());
      if (!mounted) return;
      setState(() {
        _results = list;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFmt = NumberFormat('#,##0.00', 'en_US');

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
            onPressed: () => _search(_ctrl.text),
          ),
        ],
        title: const Align(
          alignment: Alignment.centerRight,
          child: Text(
            "سجل العملاء والمديونيات",
            style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      ),
      body: Column(
        children: [
          // Search Box
          Container(
            padding: const EdgeInsets.all(14),
            color: AppColors.slate900,
            child: TextField(
              controller: _ctrl,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              onChanged: (v) => _search(v),
              decoration: InputDecoration(
                hintText: "بحث باسم العميل أو رقم الهاتف...",
                hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 12),
                prefixIcon: const Icon(Icons.search, color: AppColors.emerald400),
                suffixIcon: _ctrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, color: AppColors.slate400, size: 18),
                        onPressed: () {
                          _ctrl.clear();
                          _search('');
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.slate800,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
          ),

          // Count Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.slate900.withOpacity(0.5),
              border: const Border(bottom: BorderSide(color: AppColors.slate800)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "${_results.where((c) => c.balance > 0).length} مدينون",
                  style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                Text(
                  "${_results.length} عميل مسجل",
                  style: const TextStyle(color: AppColors.slate300, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // Customers List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.emerald500))
                : _results.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.people_outline, size: 48, color: AppColors.slate600),
                            SizedBox(height: 12),
                            Text("لا يوجد عملاء مطابقون للبحث", style: TextStyle(color: AppColors.slate400, fontSize: 14)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _results.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, i) {
                          final c = _results[i];
                          final hasDebt = c.balance > 0;
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.slate900,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: hasDebt ? Colors.redAccent.withOpacity(0.4) : AppColors.slate800,
                              ),
                            ),
                            child: Row(
                              children: [
                                // Balance / Debt
                                Column(
                                  crossAxisAlignment: CrossAlignment.start,
                                  children: [
                                    Text(
                                      "${currencyFmt.format(c.balance)} ج.م",
                                      style: TextStyle(
                                        color: hasDebt ? Colors.redAccent : AppColors.emerald400,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    Text(
                                      hasDebt ? "مبلغ مستحق (آجل)" : "رصيد مسدد",
                                      style: TextStyle(
                                        color: hasDebt ? Colors.red.shade300 : AppColors.slate500,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ],
                                ),
                                const Spacer(),

                                // Name & Phone
                                Column(
                                  crossAxisAlignment: CrossAlignment.end,
                                  children: [
                                    Text(
                                      c.name,
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                    const SizedBox(height: 3),
                                    if (c.phone != null && c.phone!.isNotEmpty)
                                      Text(
                                        c.phone!,
                                        style: const TextStyle(color: AppColors.slate400, fontSize: 12),
                                      ),
                                  ],
                                ),
                                const SizedBox(width: 12),

                                // Avatar Icon
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: hasDebt ? Colors.redAccent.withOpacity(0.12) : AppColors.emerald500.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: hasDebt ? Colors.redAccent.withOpacity(0.3) : AppColors.emerald500.withOpacity(0.3),
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.person,
                                    color: hasDebt ? Colors.redAccent : AppColors.emerald400,
                                    size: 20,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
