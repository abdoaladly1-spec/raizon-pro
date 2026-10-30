import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api.dart';

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

  Future<void> _search(String q) async {
    if (AppApi.i.config.url.trim().isEmpty) {
      setState(() {
        _error = 'لم يتم إعداد رابط السيرفر بعد — افتح تبويب الإعدادات';
        _loading = false;
        _results = [];
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final list = await AppApi.i.searchCustomers(q.trim());
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
    final f = NumberFormat('#,##0.00');
    return Scaffold(
      appBar: AppBar(title: const Text('العملاء')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _ctrl,
              onSubmitted: _search,
              decoration: InputDecoration(
                hintText: 'ابحث عن عميل قديم بالاسم أو الهاتف...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    _ctrl.clear();
                    _search('');
                  },
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                isDense: true,
              ),
            ),
          ),
          if (_error != null)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(_error!, textAlign: TextAlign.center),
                ),
              ),
            )
          else if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_results.isEmpty)
            const Expanded(child: Center(child: Text('لا توجد نتائج')))
          else
            Expanded(
              child: ListView.builder(
                itemCount: _results.length,
                itemBuilder: (_, i) {
                  final c = _results[i];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    child: ListTile(
                      leading: CircleAvatar(
                        child: Text(c.name.isNotEmpty ? c.name.substring(0, 1) : '?'),
                      ),
                      title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text(c.phone.isEmpty ? 'بدون هاتف' : c.phone),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('${f.format(c.totalSpent)} ج.م',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                          if (c.invoices > 0) Text('${c.invoices} فاتورة', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
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
