import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// يفكّ رمز الاتصال المولّد من تطبيق الويندوز:
///   procashier://connect?url=http://192.168.1.11:8087&key=xxxx
/// أو رابط سيرفر عادي http(s)://...
Map<String, String> parseConnectPayload(String raw) {
  final s = raw.trim();
  if (s.isEmpty) return {};
  if (s.toLowerCase().startsWith('procashier://')) {
    try {
      final uri = Uri.parse(s);
      final url = (uri.queryParameters['url'] ?? '').trim();
      final key = (uri.queryParameters['key'] ?? '').trim();
      if (url.isNotEmpty) return {'url': url, 'key': key};
    } catch (_) {}
    return {};
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return {'url': s, 'key': ''};
  }
  return {};
}

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final barcode = capture.barcodes.isEmpty ? null : capture.barcodes.first;
    final raw = barcode?.rawValue;
    if (raw == null || raw.trim().isEmpty) return;
    final parsed = parseConnectPayload(raw);
    if (parsed.isEmpty) return; // رمز غير مرتبط بنا → نكمل المسح
    _handled = true;
    Navigator.of(context).pop(parsed);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('مسح رمز الاتصال'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 3),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 40,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'وجّه الكاميرا نحو رمز QR المعروض في تطبيق الويندوز\n(الإعدادات ← مزامنة السيرفر)',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
