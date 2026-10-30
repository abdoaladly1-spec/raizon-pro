// اختبار مولّد الإيصال الحراري (57مم / 80مم): عرض السطر، الهوامش،
// أحجام الخط، ترميز العربي، أوامر التهيئة/الغامق/القص، وغياب QR/الباركود.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:procashier_flutter/printing/thermal_receipt.dart';

Future<List<int>> _build(String paperSize, {String shopName = 'صالون إبراهيم نوار', bool rtl = true}) {
  return buildReceipt(
    paperSize: paperSize,
    shopName: shopName,
    total: 250,
    items: const [
      ReceiptItem(name: 'قص شعر', quantity: 1, price: 150),
      ReceiptItem(name: 'شامبو', quantity: 2, price: 50),
    ],
    phone: '01102002750',
    invoiceNo: '#1001',
    date: '2026-10-01',
    cashier: 'admin',
    customer: 'محمد',
    paid: 300,
    change: 50,
    rtl: rtl,
  );
}

/// محتوى كل سطر بعد أوامر التنسيق (يبدأ بعد آخر أمر KanjiOff = \x1C.)
List<String> _lines(List<int> bytes) {
  final decoded = utf8.decode(bytes, allowMalformed: true);
  final out = <String>[];
  for (final seg in decoded.split('\n')) {
    final i = seg.lastIndexOf('\x1C.');
    if (i >= 0) out.add(seg.substring(i + 2));
  }
  return out;
}

bool _contains(List<int> hay, List<int> needle) {
  outer:
  for (var i = 0; i + needle.length <= hay.length; i++) {
    for (var j = 0; j < needle.length; j++) {
      if (hay[i + j] != needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

void main() {
  // يلزم تهيئة الـ binding لتحميل أصل capabilities.json عبر rootBundle
  TestWidgetsFlutterBinding.ensureInitialized();

  test('57مم: كل سطر بعرض 32 خانة (أو 16 للخط المكبّر)', () async {
    final b = await _build('57');
    expect(b, isNotEmpty);
    final lines = _lines(b);
    expect(lines, isNotEmpty);
    expect(lines.every((l) => l.length == 32 || l.length == 16), isTrue,
        reason: 'أطوال السطور: ${lines.map((l) => l.length).toSet()}');
    expect(lines.any((l) => l.length == 32), isTrue);
  });

  test('80مم: كل سطر بعرض 48 خانة (أو 24/16 للخط المكبّر)', () async {
    final b = await _build('80');
    final lines = _lines(b);
    expect(lines, isNotEmpty);
    expect(lines.every((l) => l.length == 48 || l.length == 24 || l.length == 16), isTrue,
        reason: 'أطوال السطور: ${lines.map((l) => l.length).toSet()}');
    expect(lines.any((l) => l.length == 48), isTrue);
  });

  test('المقاسان يختلفان + أوامر التهيئة والقص والغامق والأحجام', () async {
    final b57 = await _build('57');
    final b80 = await _build('80');
    expect(b57.length, isNot(b80.length));
    // تهيئة ESC @ ثم قص GS V 0
    expect(_contains(b57, [0x1B, 0x40]), isTrue);
    expect(_contains(b57, [0x1D, 0x56, 0x30]), isTrue);
    expect(_contains(b80, [0x1D, 0x56, 0x30]), isTrue);
    // غامق ESC E 1 + أحجام: ×2 على 57 (GS ! 17) و×3 على 80 (GS ! 34)
    expect(_contains(b57, [0x1B, 0x45, 0x01]), isTrue);
    expect(_contains(b57, [0x1D, 0x21, 17]), isTrue);
    expect(_contains(b80, [0x1D, 0x21, 34]), isTrue);
  });

  test('العربي يُرمَّز UTF-8 (وليس latin1)', () async {
    final b = await _build('57');
    expect(_contains(b, utf8.encode('صالون')), isTrue);
    expect(_contains(b, utf8.encode('قص شعر')), isTrue);
    expect(_contains(b, utf8.encode('الإجمالي')), isTrue);
    expect(_contains(b, utf8.encode('شكراً لزيارتكم!')), isTrue);
  });

  test('لا QR ولا باركود في البايتات', () async {
    for (final size in ['57', '80']) {
      final b = await _build(size);
      expect(_contains(b, [0x1D, 0x28, 0x6B]), isFalse, reason: 'GS ( k = أمر QR');
      expect(_contains(b, [0x1D, 0x6B]), isFalse, reason: 'GS k = أمر باركود');
    }
  });

  test('مقاس غير مدعوم يرمي ArgumentError', () async {
    expect(_build('A4'), throwsA(isA<ArgumentError>()));
    expect(_build('999'), throwsA(isA<ArgumentError>()));
  });

  test('rtl: false يعرض الجدول بترتيب إنجليزي وأسطر بنفس العرض', () async {
    final b = await _build('57', rtl: false);
    final decoded = utf8.decode(b, allowMalformed: true);
    expect(decoded, contains('Item'));
    expect(decoded, contains('TOTAL'));
    final lines = _lines(b);
    expect(lines.every((l) => l.length == 32 || l.length == 16), isTrue);
  });

  test('اسم طويل يُقصّ ولا يكسر عرض السطر', () async {
    final b = await _build('57', shopName: 'صالون إبراهيم نوار للحلاقة الرجالية والأطفال');
    final lines = _lines(b);
    expect(lines.every((l) => l.length == 32 || l.length == 16), isTrue,
        reason: 'أطوال السطور: ${lines.map((l) => l.length).toSet()}');
  });
}
