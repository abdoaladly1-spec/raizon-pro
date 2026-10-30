// مولّد إيصال ESC/POS للطابعات الحرارية — يدعم ورق 57مم و80مم.
//
// المزايا:
//  * كل سطر يُبنى بعرض الورق الفعلي (32 خانة على 57مم، 48 خانة على 80مم)
//    مع هوامش داخلية، فتكون الطباعة مستقلة عن محاذاة الطابعة وأوامر ESC $.
//  * الترويسة والإجمالي بخط مكبّر يتغيّر مع المقاس (×2 على 57 و×3 على 80)
//    مع تدرّج تصغير تلقائي لو كان النص أطول من سعة السطر.
//  * الجدول (اسم الخدمة / الكمية / السعر) بأبعاد أعمدة مختلفة لكل مقاس.
//  * الافتراضي RTL: اسم الخدمة في يمين السطر والسعر في يساره (عكسه rtl: false).
//  * الترميز UTF-8 افتراضياً لتطابق الطابعات ذات دعم العربي/الـ UTF-8؛
//    لو طابعتك تعمل بكودبيج معيّن (مثل CP1256) مرّره في [codeTable].
//  * لا يضمّ أي QR أو باركود — الورقة معلومات المحل والأصناف فقط.
//
// الناتج List<int> جاهز لـ PrintBluetoothThermal.writeBytes أو كابل USB.

import 'dart:convert';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:intl/intl.dart';

/// بند واحد في جدول الفاتورة (السعر المعروض = سعر السطر: الكمية × السعر).
class ReceiptItem {
  const ReceiptItem({required this.name, required this.quantity, required this.price});

  final String name;
  final int quantity;
  final num price;

  num get lineTotal => price * quantity;
}

/// أبعاد التخطيط الخاصة بكل مقاس ورق.
class _Layout {
  const _Layout({
    required this.paper,
    required this.chars,
    required this.marginChars,
    required this.titleSize,
    required this.totalSize,
    required this.thanksSize,
    required this.nameW,
    required this.qtyW,
    required this.priceW,
  });

  /// مقاس الورق لدى المولّد (mm58 يخدم ورق 57/58مم).
  final PaperSize paper;

  /// عدد خانات السطر بخط A (32 على 57مم، 48 على 80مم).
  final int chars;

  /// هامش جانبي بالخانات داخل كل سطر حجم عادي.
  final int marginChars;

  /// أحجام الخط: الترويسة/الإجمالي/رسالة الشكر.
  final PosTextSize titleSize;
  final PosTextSize totalSize;
  final PosTextSize thanksSize;

  /// عرض أعمدة الجدول داخل مساحة المحتوى.
  final int nameW;
  final int qtyW;
  final int priceW;

  /// مساحة المحتوى بعد الهوامش.
  int get band => chars - 2 * marginChars;
}

// ورق 57مم (فعلياً 58مم): 384 نقطة = 32 خانة — بلا هوامش لضيق الورق،
// وعمود الاسم أضيق من 80.
const _layout57 = _Layout(
  paper: PaperSize.mm58,
  chars: 32,
  marginChars: 0,
  titleSize: PosTextSize.size2,
  totalSize: PosTextSize.size2,
  thanksSize: PosTextSize.size1,
  nameW: 14,
  qtyW: 6,
  priceW: 10,
);

// ورق 80مم: 576 نقطة = 48 خانة — خانتا هامش لكل جانب، وعمود أوسع للاسم.
const _layout80 = _Layout(
  paper: PaperSize.mm80,
  chars: 48,
  marginChars: 2,
  titleSize: PosTextSize.size3,
  totalSize: PosTextSize.size3,
  thanksSize: PosTextSize.size2,
  nameW: 22,
  qtyW: 6,
  priceW: 14,
);

_Layout _resolveLayout(String paperSize) {
  final digits = paperSize.trim().toLowerCase().replaceAll(RegExp('[^0-9]'), '');
  if (digits == '57' || digits == '58') return _layout57;
  if (digits == '80') return _layout80;
  throw ArgumentError.value(paperSize, 'paperSize', "مقاس غير مدعوم — استخدم '57' أو '80'");
}

/// يقصّ النص إلى [max] خانة (بعلامة … عند القص).
String _fit(String s, int max) {
  final t = s.trim();
  if (max <= 0) return '';
  if (t.length <= max) return t;
  return max == 1 ? t.substring(0, 1) : '${t.substring(0, max - 1)}…';
}

String _padCenter(String s, int width) {
  if (s.length >= width) return s;
  final left = (width - s.length) ~/ 2;
  return '${' ' * left}$s${' ' * (width - s.length - left)}';
}

/// سطر بعرض الورق الكامل: محتوى [content] موسّط داخل مساحة المحتوى،
/// والهوامش (على 80) محفوظة بالمسافات — لا يعتمد على محاذاة الطابعة.
String _line(_Layout l, String content, {int f = 1}) {
  final total = l.chars ~/ f;
  final margin = f == 1 ? l.marginChars : 0;
  final band = total - 2 * margin;
  final c = _fit(content, band);
  final left = margin + (band - c.length) ~/ 2;
  return '${' ' * left}$c${' ' * (total - left - c.length)}';
}

/// خلايا سطر الجدول بعرض مساحة المحتوى بالضبط.
String _cells(
  _Layout l, {
  required bool rtl,
  required String name,
  required String qty,
  required String price,
}) {
  final nameCell = rtl ? _fit(name, l.nameW).padLeft(l.nameW) : _fit(name, l.nameW).padRight(l.nameW);
  final qtyCell = _padCenter(_fit(qty, l.qtyW), l.qtyW);
  final priceCell = rtl ? _fit(price, l.priceW).padRight(l.priceW) : _fit(price, l.priceW).padLeft(l.priceW);
  return rtl ? '$priceCell $qtyCell $nameCell' : '$nameCell $qtyCell $priceCell';
}

/// يختار حجم خط من تدرّج [preferred] → ×2 → ×1 حتى يتّسع النص للسطر.
PosTextSize _sizeFor(_Layout l, String text, PosTextSize preferred) {
  final ladder = <PosTextSize>[preferred];
  if (preferred.value > 2) ladder.add(PosTextSize.size2);
  if (preferred.value > 1) ladder.add(PosTextSize.size1);
  for (final s in ladder) {
    if (text.length <= l.chars ~/ s.value) return s;
  }
  return PosTextSize.size1;
}

/// يبني إيصال ESC/POS كاملاً ويعيد بايتاته الجاهزة للإرسال.
///
/// [paperSize]: '57' أو '58' (ورق 57/58مم) أو '80' (ورق 80مم) —
/// وأي قيمة أخرى ترمي [ArgumentError].
Future<List<int>> buildReceipt({
  required String paperSize,
  required String shopName,
  required num total,
  List<ReceiptItem> items = const [],
  String? phone,
  String? address,
  String? invoiceNo,
  String? date,
  String? cashier,
  String? customer,
  num? paid,
  num? change,
  String? thanks,
  bool rtl = true,
  String? codeTable,
  Encoding codec = utf8,
}) async {
  final layout = _resolveLayout(paperSize);
  assert(layout.band == layout.nameW + layout.qtyW + layout.priceW + 2);

  final profile = await CapabilityProfile.load();
  final generator = Generator(layout.paper, profile, codec: codec);
  final money = NumberFormat('#,##0.##', 'en_US');
  var bytes = <int>[];

  bytes += generator.reset();
  if (codeTable != null && codeTable.isNotEmpty) {
    bytes += generator.setGlobalCodeTable(codeTable);
  }

  // 1) اسم الصالون — كبير مع تصغير تلقائي لو تجاوز سعة السطر.
  final titleSize = _sizeFor(layout, shopName, layout.titleSize);
  bytes += generator.text(
    _line(layout, shopName, f: titleSize.value),
    styles: PosStyles(bold: true, height: titleSize, width: titleSize),
  );
  if ((phone ?? '').trim().isNotEmpty) {
    bytes += generator.text(_line(layout, phone!), styles: const PosStyles());
  }
  if ((address ?? '').trim().isNotEmpty) {
    bytes += generator.text(_line(layout, address!), styles: const PosStyles());
  }

  // 2) بيانات الفاتورة.
  final meta = <String>[
    if ((invoiceNo ?? '').trim().isNotEmpty) rtl ? 'فاتورة: $invoiceNo' : 'Invoice: $invoiceNo',
    if ((date ?? '').trim().isNotEmpty) rtl ? 'التاريخ: $date' : 'Date: $date',
    if ((cashier ?? '').trim().isNotEmpty) rtl ? 'الكاشير: $cashier' : 'Cashier: $cashier',
    if ((customer ?? '').trim().isNotEmpty) rtl ? 'العميل: $customer' : 'Customer: $customer',
  ];
  for (final m in meta) {
    bytes += generator.text(_line(layout, m), styles: const PosStyles());
  }

  // 3) فاصل + جدول الأصناف (بعرض أعمدة مختلف لكل مقاس).
  bytes += generator.text(_line(layout, '-' * layout.band), styles: const PosStyles());
  if (items.isNotEmpty) {
    bytes += generator.text(
      _line(
        layout,
        _cells(
          layout,
          rtl: rtl,
          name: rtl ? 'الخدمة' : 'Item',
          qty: rtl ? 'الكمية' : 'Qty',
          price: rtl ? 'السعر' : 'Price',
        ),
      ),
      styles: const PosStyles(bold: true),
    );
    for (final it in items) {
      bytes += generator.text(
        _line(
          layout,
          _cells(
            layout,
            rtl: rtl,
            name: it.name,
            qty: '${it.quantity}',
            price: money.format(it.lineTotal),
          ),
        ),
        styles: const PosStyles(),
      );
    }
  }

  // 4) الإجمالي (+ المدفوع/الباقي اختيارياً).
  bytes += generator.text(
    _line(layout, rtl ? 'الإجمالي' : 'TOTAL'),
    styles: const PosStyles(bold: true),
  );
  final amount = '${money.format(total)}${rtl ? ' ج.م' : ' EGP'}';
  final amountSize = _sizeFor(layout, amount, layout.totalSize);
  bytes += generator.text(
    _line(layout, amount, f: amountSize.value),
    styles: PosStyles(bold: true, height: amountSize, width: amountSize),
  );
  if (paid != null) {
    bytes += generator.text(
      _line(layout, '${rtl ? 'المدفوع' : 'Paid'}: ${money.format(paid)}${rtl ? ' ج.م' : ' EGP'}'),
      styles: const PosStyles(),
    );
  }
  if (change != null) {
    bytes += generator.text(
      _line(layout, '${rtl ? 'الباقي' : 'Change'}: ${money.format(change)}${rtl ? ' ج.م' : ' EGP'}'),
      styles: const PosStyles(),
    );
  }

  // 5) رسالة الشكر.
  final thanksText = (thanks ?? '').trim().isNotEmpty
      ? thanks!.trim()
      : (rtl ? 'شكراً لزيارتكم!' : 'Thank you!');
  final thanksSize = _sizeFor(layout, thanksText, layout.thanksSize);
  bytes += generator.text(
    _line(layout, thanksText, f: thanksSize.value),
    styles: PosStyles(height: thanksSize, width: thanksSize),
  );

  // 6) قص الورقة (يتضمّن مسافات فراغ قبل القص).
  bytes += generator.cut();

  return bytes;
}
