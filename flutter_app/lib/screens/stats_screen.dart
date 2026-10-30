import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  Summary? _summary;
  Summary? _month;
  List<Map<String, dynamic>> _daily = [];
  List<Map<String, dynamic>> _monthly = [];
  bool _loading = false;
  String? _error;
  Timer? _autoRefresh;

  @override
  void initState() {
    super.initState();
    _load();
    // تحديث تلقائي خلفي كل 15 ثانية بدون مؤشر تحميل
    _autoRefresh = Timer.periodic(const Duration(seconds: 15), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _autoRefresh?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (AppApi.i.config.url.trim().isEmpty) {
      if (silent) return;
      setState(() {
        _error = 'لم يتم إعداد رابط السيرفر بعد — افتح تبويب الإعدادات';
        _loading = false;
      });
      return;
    }
    if (!silent) setState(() => _loading = true);
    try {
      final now = DateTime.now();
      final monthStart = DateTime(now.year, now.month, 1);
      final results = await Future.wait([
        AppApi.i.fetchSummary(),
        AppApi.i.fetchSummary(
          dateFrom: DateFormat('yyyy-MM-dd').format(monthStart),
          dateTo: DateFormat('yyyy-MM-dd').format(now),
        ),
        AppApi.i.fetchDaily(days: 30),
        AppApi.i.fetchMonthly(months: 12),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = results[0] as Summary;
        _month = results[1] as Summary;
        _daily = results[2] as List<Map<String, dynamic>>;
        _monthly = results[3] as List<Map<String, dynamic>>;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (silent) return; // تحديث خلفي فاشل: نحتفظ بالبيانات الحالية
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = NumberFormat('#,##0');
    return Scaffold(
      appBar: AppBar(
        title: const Text('الإحصائيات'),
        actions: [IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.cloud_off, size: 56, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 1.6,
                        children: [
                          _card('إجمالي المبيعات', '${f.format(_summary?.sales ?? 0)} ج.م', Icons.payments, Colors.green),
                          _card('عدد الفواتير', '${_summary?.invoices ?? 0}', Icons.receipt_long, Colors.blue),
                          _card('مبيعات الشهر', '${f.format(_month?.sales ?? 0)} ج.م', Icons.calendar_month, Colors.orange),
                          _card(
                            'متوسط الفاتورة',
                            '${f.format((_summary?.invoices ?? 0) == 0 ? 0 : (_summary!.sales / _summary!.invoices))} ج.م',
                            Icons.analytics,
                            Colors.purple,
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _sectionTitle('المبيعات آخر 30 يوم'),
                      _bars(_daily, (e) => (e['date'] ?? '').toString().substring(5), (e) => (e['sales'] ?? 0).toDouble()),
                      const SizedBox(height: 20),
                      _sectionTitle('المبيعات شهرياً'),
                      _bars(_monthly, (e) => (e['month'] ?? '').toString(), (e) => (e['sales'] ?? 0).toDouble()),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      );

  Widget _card(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey), overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
      ),
    );
  }

  Widget _bars(
    List<Map<String, dynamic>> data,
    String Function(Map<String, dynamic>) label,
    double Function(Map<String, dynamic>) value,
  ) {
    if (data.isEmpty) {
      return const Card(
        child: SizedBox(height: 90, child: Center(child: Text('لا توجد بيانات بعد'))),
      );
    }
    final max = data.map(value).reduce((a, b) => a > b ? a : b);
    final f = NumberFormat('#,##0');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: data.reversed.take(15).map((e) {
            final v = value(e);
            final ratio = max <= 0 ? 0.0 : (v / max);
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(width: 54, child: Text(label(e), style: const TextStyle(fontSize: 11, color: Colors.grey))),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: ratio,
                        minHeight: 14,
                        backgroundColor: Colors.grey.shade200,
                        color: const Color(0xFF0EA5E9),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 78,
                    child: Text(
                      f.format(v),
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
