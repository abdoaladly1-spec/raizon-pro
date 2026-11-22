import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';

class InvoicesScreen extends StatefulWidget {
  final String? initialBranchId;
  const InvoicesScreen({super.key, this.initialBranchId});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

enum _Range { all, today, week, month, custom }

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _searchCtrl = TextEditingController();
  List<Invoice> _invoices = [];
  List<Branch> _branches = [];
  String? _selectedBranchId;
  bool _loading = false;
  String? _error;
  _Range _range = _Range.today;
  DateTimeRange? _custom;

  final _currencyFormat = NumberFormat("#,##0", "en_US");

  @override
  void initState() {
    super.initState();
    _selectedBranchId = widget.initialBranchId;
    _loadBranches();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _loadBranches() async {
    final list = await SupabaseRepository.fetchBranches();
    if (mounted) {
      setState(() => _branches = list);
    }
  }

  String _fmtDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  ({String from, String to}) _bounds() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    switch (_range) {
      case _Range.today:
        return (from: _fmtDate(today), to: _fmtDate(today));
      case _Range.week:
        return (from: _fmtDate(today.subtract(const Duration(days: 7))), to: _fmtDate(today));
      case _Range.month:
        return (from: _fmtDate(today.subtract(const Duration(days: 30))), to: _fmtDate(today));
      case _Range.custom:
        final r = _custom;
        if (r == null) return (from: '', to: '');
        return (from: _fmtDate(r.start), to: _fmtDate(r.end));
      case _Range.all:
        return (from: '', to: '');
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final b = _bounds();
    try {
      final list = await SupabaseRepository.fetchRecentInvoices(
        limit: 100,
        branchId: _selectedBranchId,
        search: _searchCtrl.text.trim(),
        dateFrom: b.from,
        dateTo: b.to,
      );
      if (!mounted) return;
      setState(() {
        _invoices = list;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange: _custom,
    );
    if (picked != null) {
      setState(() {
        _custom = picked;
        _range = _Range.custom;
      });
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    double totalSum = _invoices.fold(0.0, (acc, i) => acc + i.total);

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
            onPressed: _load,
          ),
        ],
        title: const Align(
          alignment: Alignment.centerRight,
          child: Text(
            "سجل الفواتير والمبيعات",
            style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter Section
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.slate900,
            child: Column(
              children: [
                // Search Box
                TextField(
                  controller: _searchCtrl,
                  textAlign: TextAlign.right,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  onSubmitted: (_) => _load(),
                  decoration: InputDecoration(
                    hintText: "بحث برقم الفاتورة، اسم العميل، أو الهاتف...",
                    hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 12),
                    prefixIcon: IconButton(
                      icon: const Icon(Icons.search, color: AppColors.emerald400),
                      onPressed: _load,
                    ),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close, color: AppColors.slate400, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              _load();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppColors.slate800,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),

                // Range Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  reverse: true,
                  child: Row(
                    children: [
                      _rangeChip("الكل", _Range.all),
                      _rangeChip("اليوم", _Range.today),
                      _rangeChip("أسبوع", _Range.week),
                      _rangeChip("شهر", _Range.month),
                      GestureDetector(
                        onTap: _pickRange,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          margin: const EdgeInsets.only(left: 6),
                          decoration: BoxDecoration(
                            color: _range == _Range.custom ? AppColors.emerald500 : AppColors.slate800,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _range == _Range.custom ? AppColors.emerald400 : AppColors.slate700,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(Icons.calendar_today, size: 12, color: Colors.white),
                              SizedBox(width: 4),
                              Text("مخصص", style: TextStyle(color: Colors.white, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Branch Filter Chips
                if (_branches.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    reverse: true,
                    child: Row(
                      children: [
                        _branchChip("جميع الفروع", null),
                        ..._branches.map((b) => _branchChip(b.name, b.id)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Summary Strip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.slate900.withOpacity(0.5),
              border: const Border(bottom: BorderSide(color: AppColors.slate800)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text("الإجمالي: ", style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                    Text(
                      "${_currencyFormat.format(totalSum)} ج.م",
                      style: const TextStyle(color: AppColors.emerald400, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
                Text(
                  "${_invoices.length} فاتورة",
                  style: const TextStyle(color: AppColors.slate300, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ],
            ),
          ),

          // Invoices List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.emerald500))
                : _invoices.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.receipt_long, size: 48, color: AppColors.slate600),
                            SizedBox(height: 12),
                            Text("لا توجد فواتير في هذه الفترة", style: TextStyle(color: AppColors.slate400, fontSize: 14)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.emerald500,
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _invoices.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (ctx, i) => _InvoiceItemCard(invoice: _invoices[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _rangeChip(String label, _Range r) {
    final sel = _range == r;
    return GestureDetector(
      onTap: () {
        setState(() => _range = r);
        _load();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        margin: const EdgeInsets.only(left: 6),
        decoration: BoxDecoration(
          color: sel ? AppColors.emerald500 : AppColors.slate800,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: sel ? AppColors.emerald400 : AppColors.slate700),
        ),
        child: Text(
          label,
          style: TextStyle(color: sel ? Colors.white : AppColors.slate300, fontSize: 11, fontWeight: sel ? FontWeight.bold : FontWeight.normal),
        ),
      ),
    );
  }

  Widget _branchChip(String label, String? id) {
    final sel = _selectedBranchId == id;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedBranchId = id);
        _load();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        margin: const EdgeInsets.only(left: 6),
        decoration: BoxDecoration(
          color: sel ? AppColors.cyan500.withOpacity(0.2) : AppColors.slate800,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: sel ? AppColors.cyan500 : AppColors.slate700),
        ),
        child: Text(
          label,
          style: TextStyle(color: sel ? AppColors.cyan500 : AppColors.slate400, fontSize: 11, fontWeight: sel ? FontWeight.bold : FontWeight.normal),
        ),
      ),
    );
  }
}

class _InvoiceItemCard extends StatelessWidget {
  final Invoice invoice;
  const _InvoiceItemCard({required this.invoice});

  Color _getMethodColor(String method) {
    final m = method.toLowerCase();
    if (m.contains('كاش') || m.contains('cash')) return AppColors.emerald500;
    if (m.contains('card') || m.contains('insta') || m.contains('بنك')) return AppColors.cyan500;
    if (m.contains('محفظة') || m.contains('wallet')) return AppColors.amber500;
    if (m.contains('آجل') || m.contains('credit')) return Colors.redAccent;
    return AppColors.slate400;
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat("#,##0", "en_US");
    final methodColor = _getMethodColor(invoice.paymentMethod);

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
          // Top Row: Number & Amount
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "${formatter.format(invoice.total)} ج.م",
                style: const TextStyle(color: AppColors.emerald400, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              Row(
                children: [
                  if (invoice.branchName != null && invoice.branchName!.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.slate800,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        invoice.branchName!,
                        style: const TextStyle(color: AppColors.slate400, fontSize: 10),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    "#${invoice.invoiceNumber.isNotEmpty ? invoice.invoiceNumber : (invoice.clientKey ?? '')}",
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Customer and Staff info
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: methodColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: methodColor.withOpacity(0.4)),
                ),
                child: Text(
                  invoice.paymentMethod,
                  style: TextStyle(color: methodColor, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAlignment.end,
                children: [
                  Text(
                    invoice.customerName ?? "عميل نقدي",
                    style: const TextStyle(color: AppColors.slate200, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if (invoice.phone != null && invoice.phone!.isNotEmpty)
                    Text(invoice.phone!, style: const TextStyle(color: AppColors.slate500, fontSize: 11)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Date and Time
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (invoice.staffName != null && invoice.staffName!.isNotEmpty)
                Text("الموظف: ${invoice.staffName}", style: const TextStyle(color: AppColors.slate500, fontSize: 11)),
              Text(
                invoice.createdAt.length >= 16 ? invoice.createdAt.substring(0, 16).replaceAll("T", " ") : invoice.createdAt,
                style: const TextStyle(color: AppColors.slate500, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
