// اختبار بسيط: يتأكد أن تطبيق العرض يُبنى ويعرض شاشة الفواتير
import 'package:flutter_test/flutter_test.dart';

import 'package:procashier_flutter/main.dart';

void main() {
  testWidgets('Viewer app renders invoices tab', (WidgetTester tester) async {
    await tester.pumpWidget(const ViewerApp());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('الفواتير'), findsWidgets);
    expect(find.text('الإحصائيات'), findsOneWidget);
    expect(find.text('العملاء'), findsOneWidget);
    expect(find.text('الإعدادات'), findsOneWidget);
  });
}
