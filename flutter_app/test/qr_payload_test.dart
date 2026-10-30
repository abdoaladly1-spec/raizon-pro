import 'package:flutter_test/flutter_test.dart';

import 'package:procashier_flutter/screens/qr_scanner_screen.dart';

void main() {
  test('يفكّ رمز الاتصال procashier://connect', () {
    final p = parseConnectPayload(
      'procashier://connect?url=${Uri.encodeComponent('http://192.168.1.11:8087')}&key=abc123',
    );
    expect(p['url'], 'http://192.168.1.11:8087');
    expect(p['key'], 'abc123');
  });

  test('يقبل رابط سيرفر عادي', () {
    final p = parseConnectPayload('  http://192.168.1.11:8087  ');
    expect(p['url'], 'http://192.168.1.11:8087');
    expect(p['key'], '');
  });

  test('تجاهل القيم غير الصالحة', () {
    expect(parseConnectPayload(''), isEmpty);
    expect(parseConnectPayload('غير مرتبط'), isEmpty);
    expect(parseConnectPayload('procashier://connect'), isEmpty);
  });
}
