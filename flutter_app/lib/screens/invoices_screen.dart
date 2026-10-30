import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

enum _Range { all, today, week, month, custom }

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _searchCtrl = TextEditingController();
  List<Invoice> _invoices = [];
  bool _loading = false;
  String? _error;
  _Range _range = _Range.all;
  DateTimeRange? _custom;

  // مزامنة تلقائية: نجلب فقط ما هو أحدث من آخر فاتورة مستلمة
  Timer? _pollTimer;
  int _lastTimestamp = 0;
  DateTime? _lastSync;
  static const _pollInterval = Duration(seconds: 10);

  @override
  void initState() {
    super.initState();
    _load().then((_) => _startPolling());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) => _pollNewInvoices());
  }

  /// جلب الفواتير الجديدة من السيرفر بدون إعادة تحميل القائمة كاملة
  Future<void> _pollNewInvoices() async {
    if (!mounted || _loading) return;
    if (AppApi.i.config.url.trim().isEmpty) return;
    // لا نعيد تحميل القائمة أثناء وجود بحث أو فلتر مفعّل
    if (_searchCtrl.text.trim().isNotEmpty || _range != _Range.all) return;

    if (_error != null) {
      // كان هناك خطأ (سيرفر متوقف مثلاً) → نعيد التحميل الكامل عند التعافي
      await _load();
      return;
    }

    try {
      final fresh = await AppApi.i.fetchInvoicesSince(_lastTimestamp);
      if (!mounted) return;
      if (fresh.isEmpty) {
        setState(() => _lastSync = DateTime.now());
        return;
      }
      final known = _invoices.map((e) => e.id).toSet();
      final added = fresh.where((e) => !known.contains(e.id)).toList();
      if (added.isEmpty) {
        setState(() => _lastSync = DateTime.now());
        return;
      }
      setState(() {
        _invoices = [...added, ..._invoices];
        _lastTimestamp = _invoices
            .map((e) => e.timestamp)
            .fold(_lastTimestamp, (a, b) => b > a ? b : a);
        _lastSync = DateTime.now();
      });
    } catch (_) {
      // صامت: نعيد المحاولة في الدورة التالية
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
    if (AppApi.i.config.url.trim().isEmpty) {
      setState(() {
        _error = 'لم يتم إعداد رابط السيرفر بعد — افتح تبويب الإعدادات';
        _loading = false;
        _invoices = [];
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final b = _bounds();
      final list = await AppApi.i.fetchInvoices(
        search: _searchCtrl.text.trim(),
        dateFrom: b.from,
        dateTo: b.to,
      );
      if (!mounted) return;
      setState(() {
        _invoices = list;
        _error = null;
        _loading = false;
        _lastSync = DateTime.now();
        _lastTimestamp = list
            .map((e) => e.timestamp)
            .fold(0, (a, b) => b > a ? b : a);
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
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('الفواتير'),
        actions: [
          if (_lastSync != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Text(
                  'تحديث ${DateFormat('HH:mm').format(_lastSync!)}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
            ),
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: TextField(
              controller: _searchCtrl,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _load(),
              decoration: InputDecoration(
                hintText: 'بحث باسم العميل، الهاتف أو رقم الفاتورة...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchCtrl.clear();
                    _load();
                  },
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                isDense: true,
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                _chip('الكل', _Range.all),
                _chip('اليوم', _Range.today),
                _chip('آخر 7 أيام', _Range.week),
                _chip('آخر 30 يوم', _Range.month),
                FilterChip(
                  label: const Text('فترة مخصصة'),
                  selected: _range == _Range.custom,
                  onSelected: (_) => _pickRange(),
                  avatar: const Icon(Icons.date_range, size: 18),
                ),
              ],
            ),
          ),
          if (_error != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cloud_off, size: 56, color: theme.colorScheme.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
                    ],
                  ),
                ),
              ),
            )
          else if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_invoices.isEmpty)
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.receipt_long, size: 56, color: Colors.grey),
                    SizedBox(height: 12),
                    Text('لا توجد فواتير'),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: _invoices.length,
                  itemBuilder: (_, i) => _invoiceTile(_invoices[i]),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip(String label, _Range value) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ChoiceChip(
        label: Text(label),
        selected: _range == value,
        onSelected: (_) {
          setState(() => _range = value);
          _load();
        },
      ),
    );
  }

  Widget _invoiceTile(Invoice inv) {
    final f = NumberFormat('#,##0.00');
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: ExpansionTile(
        shape: const Border(),
        title: Text(
          'فاتورة #${inv.localId ?? inv.id}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text('${inv.customerName} • ${inv.date}'),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('${f.format(inv.total)} ج.م',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669))),
            Text(inv.paymentMethod == 'card' ? 'بطاقة' : 'نقداً',
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        children: [
          if (inv.items.isEmpty)
            const ListTile(title: Text('بدون أصناف'))
          else
            ...inv.items.map(
              (it) => ListTile(
                dense: true,
                title: Text(it.name),
                subtitle: Text('${it.quantity} × ${f.format(it.price)}'),
                trailing: Text('${f.format(it.lineTotal)} ج.م'),
              ),
            ),
          if (inv.discount > 0 || inv.tax > 0)
            ListTile(
              dense: true,
              title: Text('خصم: ${f.format(inv.discount)} • ضريبة: ${f.format(inv.tax)}'),
              trailing: Text('الكاشير: ${inv.createdBy.isEmpty ? '-' : inv.createdBy}'),
            ),
        ],
      ),
    );
  }
}
