import 'package:flutter/material.dart';

import '../api.dart';
import 'qr_scanner_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _urlCtrl = TextEditingController();
  final _keyCtrl = TextEditingController();
  bool _busy = false;
  bool? _connected;
  String? _message;

  @override
  void initState() {
    super.initState();
    _urlCtrl.text = AppApi.i.config.url;
    _keyCtrl.text = AppApi.i.config.apiKey;
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _keyCtrl.dispose();
    super.dispose();
  }

  Future<void> _save({bool test = false}) async {
    setState(() {
      _busy = true;
      _message = null;
      _connected = null;
    });
    final cfg = ServerConfig(url: _urlCtrl.text.trim(), apiKey: _keyCtrl.text.trim());
    await AppApi.save(cfg);
    if (test) {
      final ok = await AppApi.i.health();
      setState(() {
        _connected = ok;
        _message = ok ? 'تم الاتصال بالسيرفر بنجاح' : 'تعذر الوصول للسيرفر — تأكد من الرابط وتشغيل السيرفر';
      });
    } else {
      setState(() => _message = 'تم حفظ الإعدادات');
    }
    setState(() => _busy = false);
  }

  Future<void> _scanQr() async {
    final result = await Navigator.of(context).push<Map<String, String>>(
      MaterialPageRoute(builder: (_) => const QrScannerScreen()),
    );
    if (result == null || (result['url'] ?? '').isEmpty) return;
    setState(() {
      _urlCtrl.text = result['url']!;
      final key = (result['key'] ?? '').trim();
      if (key.isNotEmpty) _keyCtrl.text = key;
    });
    await _save(test: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.dns),
                      SizedBox(width: 8),
                      Text('ربط السيرفر المركزي', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'تطبيق للعرض فقط: يقرأ الفواتير والإحصائيات والعملاء من السيرفر. الإدخال والإيميلات تتم من تطبيق الويندوز.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _urlCtrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'رابط السيرفر',
                      hintText: 'http://192.168.1.10:8087',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.link),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _keyCtrl,
                    decoration: const InputDecoration(
                      labelText: 'مفتاح API (اختياري)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.key),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      FilledButton.icon(
                        onPressed: _busy ? null : () => _save(),
                        icon: const Icon(Icons.save),
                        label: const Text('حفظ'),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : () => _save(test: true),
                        icon: const Icon(Icons.wifi_tethering),
                        label: const Text('اختبار الاتصال'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _scanQr,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text('مسح رمز الاتصال (QR) من تطبيق الويندوز'),
                    ),
                  ),
                  if (_busy) const Padding(padding: EdgeInsets.only(top: 16), child: LinearProgressIndicator()),
                  if (_message != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: (_connected ?? false) ? Colors.green.shade50 : Colors.red.shade50,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              (_connected ?? false) ? Icons.check_circle : Icons.error,
                              color: (_connected ?? false) ? Colors.green : Colors.red,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(_message!)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Card(
            child: ListTile(
              leading: Icon(Icons.info_outline),
              title: Text('عن التطبيق'),
              subtitle: Text(
                'ProCashier Viewer — عرض الفواتير والإحصائيات من سيرفر ProCashier\nالمبرمج: م. عبد الرحمن فتحي',
                style: TextStyle(fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
