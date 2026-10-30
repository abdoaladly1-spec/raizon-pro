// اختبار حي ضد السيرفر المحلي — يتحقق أن api.dart يعمل فعلياً مع /api/*
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:procashier_flutter/api.dart';

/// قراءة API_KEY من server/.env (المولّد تلقائياً عند أول تشغيل للسيرفر)
String _readEnvKey() {
  try {
    final f = File('../server/.env');
    if (!f.existsSync()) return '';
    for (final line in f.readAsLinesSync()) {
      final s = line.trim();
      if (s.startsWith('API_KEY=')) {
        final v = s
            .substring(s.indexOf('=') + 1)
            .trim()
            .replaceAll('"', '')
            .replaceAll("'", '');
        final lower = v.toLowerCase();
        if (lower == 'off' || lower == 'none' || lower == 'disabled') return '';
        return v;
      }
    }
  } catch (_) {}
  return '';
}

const _base = 'http://127.0.0.1:8087';
final _key = _readEnvKey();

void main() {
  final client = ApiClient(ServerConfig(url: _base, apiKey: _key));

  test('health check', () async {
    if (!await client.health()) {
      markTestSkipped('السيرفر غير شغّال على 127.0.0.1:8087');
      return;
    }
    expect(await client.health(), isTrue);
  });

  test('fetch invoices', () async {
    if (!await client.health()) {
      markTestSkipped('server down');
      return;
    }
    final list = await client.fetchInvoices();
    expect(list, isNotEmpty);
    expect(list.first.total, greaterThan(0));
    expect(list.first.date, matches(RegExp(r'^\d{4}-\d{2}-\d{2}')));
  });

  test('search + date filter', () async {
    if (!await client.health()) {
      markTestSkipped('server down');
      return;
    }
    final name = (await client.fetchInvoices()).first.customerName;
    final byName = await client.fetchInvoices(search: name);
    expect(byName, isNotEmpty);

    final inMonth = await client.fetchInvoices(
      dateFrom: '2000-01-01',
      dateTo: '2100-01-01',
    );
    expect(inMonth.length, greaterThanOrEqualTo(byName.length));
  });

  test('summary + daily + monthly', () async {
    if (!await client.health()) {
      markTestSkipped('server down');
      return;
    }
    final s = await client.fetchSummary();
    expect(s.invoices, greaterThan(0));
    expect(s.sales, greaterThan(0));

    final daily = await client.fetchDaily(days: 30);
    expect(daily, isNotEmpty);
    expect(daily.first.keys, containsAll(['date', 'sales']));

    final monthly = await client.fetchMonthly(months: 12);
    expect(monthly, isNotEmpty);
  });

  test('customers search', () async {
    if (!await client.health()) {
      markTestSkipped('server down');
      return;
    }
    final all = await client.searchCustomers('');
    expect(all, isNotEmpty);
    final one = await client.searchCustomers(all.first.name);
    expect(one, isNotEmpty);
    expect(one.first.name, isNotEmpty);
  });

  test('bad url throws ApiException', () async {
    final bad = ApiClient(ServerConfig(url: 'http://127.0.0.1:9'));
    expect(bad.fetchInvoices, throwsA(isA<ApiException>()));
  });

  test('empty url throws ApiException', () async {
    final empty = ApiClient(ServerConfig());
    expect(empty.fetchInvoices, throwsA(isA<ApiException>()));
  });

  test('since (مزامنة تنازلية)', () async {
    if (!await client.health()) {
      markTestSkipped('server down');
      return;
    }
    final all = await client.fetchInvoicesSince(0);
    expect(all, isNotEmpty);
    final future = await client.fetchInvoicesSince(DateTime.now().millisecondsSinceEpoch + 86400000);
    expect(future, isEmpty);
  });

  test('401 بدون مفتاح API (لو المصادقة مفعّلة)', () async {
    if (_key.isEmpty) {
      markTestSkipped('المصادقة معطّلة (API_KEY=off)');
      return;
    }
    final noKey = ApiClient(ServerConfig(url: _base));
    expect(noKey.fetchInvoices, throwsA(isA<ApiException>()));
  });
}
