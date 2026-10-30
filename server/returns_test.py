"""اختبارات المرتجعات على سيرفر معزول: python server/returns_test.py

بدون معطيات: قاعدة مؤقتة + مفتاح API خاص (test_harness) فلا يُلمس الإنتاج.
النطاق المُختبَر هنا (جهة السيرفر):
  * المبلغ يُعاد حسابه من سعر/خصم/ضريبة وقت البيع.
  * منع تجاوز الكمية/المبلغ بعد المرتجعات السابقة داخل معاملة واحدة.
  * أجزاء الرد (كاش/بطاقة/محفظة) ومطابقتها للمدفوع لكل طريقة.
  * idempotent بإعادة الإرسال بنفس uid.
  * جهازان: المحاولة الثانية للكمية نفسها تُرفض 409.
  * التحقق من أكواد الأخطاء (400/404/409) وردّ summary بعد المرتجعات.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import atexit

import test_harness

test_harness.prepare_env()
BASE, API_KEY, _stop = test_harness.start()
atexit.register(_stop)


def call(method: str, path: str, payload=None):
    url = BASE + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if API_KEY:
        req.add_header("X-API-Key", API_KEY)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")
    except Exception as e:  # noqa: BLE001
        return 0, {"error": str(e)}


def check(label: str, ok: bool, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {label} {detail}")
    return ok


def detail_of(res):
    return str((res or {}).get("detail", ""))


results = []
RUN = int(time.time())

# فاتورة: خصم 10% + ضريبة 5%، دفع مختلط كاش 300 + بطاقة 361.5
INV_UID = f"ret-inv-{RUN}"
invoice = {
    "uid": INV_UID,
    "local_id": 900000 + RUN % 100000,
    "customer_name": f"زبون مرتجع {RUN}",
    "items": [
        {"itemId": "itemA", "name": "منتج أ", "price": 100, "quantity": 5},
        {"itemId": "itemB", "name": "منتج ب", "price": 50, "quantity": 4},
    ],
    "subtotal": 700,
    "discount": 70,
    "tax": 31.5,
    "total": 661.5,
    "payment_method": "split",
    "payment_parts": [
        {"method": "cash", "amount": 300},
        {"method": "card", "amount": 361.5},
    ],
    "cash_paid": 300,
    "received": 300,
    "change": 0,
    "status": "paid",
    "created_by": "admin",
    "location_id": "1",
    "date": "2026-09-30",
    "timestamp": RUN * 1000,
}
st, res = call("POST", "/api/invoices", invoice)
results.append(check("seed invoice", st == 200 and res.get("is_new") is True, str(res)))

NOW = RUN * 1000 + 60000


def ret(uid, items, refund, parts, **kw):
    payload = {
        "uid": uid,
        "invoice_uid": INV_UID,
        "invoice_id": 1,
        "items": items,
        "refund_amount": refund,
        "refund_parts": parts,
        "status": "approved",
        "reason": "عيب مصنعي",
        "staff_name": "admin",
        "created_by": "admin",
        "location_id": "1",
        "date": "2026-09-30",
        "timestamp": NOW,
        "updated_at": NOW,
    }
    payload.update(kw)
    return call("POST", "/api/returns", payload)


# --- مبالغ وقت البيع -------------------------------------------------------
# itemA×1: 100 - خصم10 + ضريبة4.5 = 94.5
# itemA×4: 400 - خصم40 + ضريبة18 = 378
# itemB×4: 200 - خصم20 + ضريبة9  = 189
# itemA×5: 500 - خصم50 + ضريبة22.5 = 472.5  (= 700-70+31.5 مع itemB)
st, r1 = ret(
    "ret-a1",
    [{"itemId": "itemA", "quantity": 1, "refund_amount": 94.5,
      "returnable": True, "track_stock": True, "type": "product"}],
    94.5,
    [{"method": "cash", "amount": 94.5}],
)
results.append(check(
    "partial return (sale-time amounts)",
    st == 200 and r1.get("is_new") is True
    and abs(float(r1.get("refund_amount")) - 94.5) < 0.01
    and abs(float(r1.get("cash_refund")) - 94.5) < 0.01
    and r1.get("type") == "partial",
    json.dumps({k: r1.get(k) for k in ("is_new", "refund_amount", "cash_refund", "type")},
               ensure_ascii=False),
))

# idempotent: إعادة الإرسال بنفس uid لا تنشئ نسخة
st, r1b = ret(
    "ret-a1",
    [{"itemId": "itemA", "quantity": 1, "refund_amount": 94.5}],
    94.5,
    [{"method": "cash", "amount": 94.5}],
)
results.append(check("idempotent resend", st == 200 and r1b.get("is_new") is False, str(r1b.get("is_new"))))

st, lst = call("GET", f"/api/returns?invoice={urllib.parse.quote(INV_UID)}&since=0")
results.append(check("list returns by invoice", st == 200 and lst.get("total") == 1, f"total={lst.get('total')}"))

# --- منع تجاوز الكمية ------------------------------------------------------
st, r = ret(
    "ret-qty1",
    [{"itemId": "itemA", "quantity": 5}],
    472.5,
    [{"method": "cash", "amount": 472.5}],
)
results.append(check("qty exceeds remaining -> 409", st == 409 and detail_of(r) == "return_qty_exceeded",
                     f"{st} {detail_of(r)}"))

# --- مبلغ غير مطابق لحساب السيرفر ------------------------------------------
st, r = ret(
    "ret-amt1",
    [{"itemId": "itemA", "quantity": 1, "refund_amount": 10}],
    10,
    [{"method": "cash", "amount": 10}],
)
results.append(check("wrong amount -> 400", st == 400 and detail_of(r) == "return_amount_exceeded",
                     f"{st} {detail_of(r)}"))

# --- مجموع الأجزاء ≠ المسترد -----------------------------------------------
st, r = ret(
    "ret-parts1",
    [{"itemId": "itemA", "quantity": 1, "refund_amount": 94.5}],
    94.5,
    [{"method": "cash", "amount": 50}],
)
results.append(check("parts mismatch -> 400", st == 400 and detail_of(r) == "return_parts_mismatch",
                     f"{st} {detail_of(r)}"))

# --- رد نقدي أكبر مما "تبقّى" من الكاش المدفوع (تراكمي عبر المرتجعات) -----
# دُفع كاش 300 ورُدَّ 94.5 سابقاً => المسموح كاش الآن 205.5 فقط
st, r = ret(
    "ret-cum-cash",
    [{"itemId": "itemA", "quantity": 4, "refund_amount": 378}],
    378,
    [{"method": "cash", "amount": 300}, {"method": "card", "amount": 78}],
)
results.append(check("cumulative cash cap -> 400", st == 400 and detail_of(r) == "return_cash_exceeds_paid",
                     f"{st} {detail_of(r)}"))

# --- جهاز أول: استرجاع باقي itemA (4) بدفع مختلط ---------------------------
st, r2 = ret(
    "ret-b4",
    [{"itemId": "itemA", "quantity": 4, "refund_amount": 378,
      "returnable": True, "track_stock": True, "type": "product"}],
    378,
    [{"method": "cash", "amount": 205.5}, {"method": "card", "amount": 172.5}],
)
results.append(check(
    "second device partial return",
    st == 200 and r2.get("is_new") is True and abs(float(r2.get("refund_amount")) - 378) < 0.01
    and abs(float(r2.get("cash_refund")) - 205.5) < 0.01,
    json.dumps({k: r2.get(k) for k in ("is_new", "refund_amount", "cash_refund")}, ensure_ascii=False),
))

# --- جهاز ثانٍ: نفس الكمية بعد اعتماد الأولى -> تعارض ----------------------
st, r = ret(
    "ret-c1",
    [{"itemId": "itemA", "quantity": 1}],
    94.5,
    [{"method": "cash", "amount": 94.5}],
)
results.append(check("device conflict -> 409", st == 409 and detail_of(r) == "return_qty_exceeded",
                     f"{st} {detail_of(r)}"))

# --- المرتجع الكامل: itemB بالكامل => type=full ----------------------------
st, r3 = ret(
    "ret-full-b",
    [{"itemId": "itemB", "quantity": 4, "refund_amount": 189,
      "returnable": True, "track_stock": True, "type": "product"}],
    189,
    [{"method": "card", "amount": 189}],
)
results.append(check(
    "full invoice return",
    st == 200 and r3.get("type") == "full" and abs(float(r3.get("refund_amount")) - 189) < 0.01,
    f"{st} {r3.get('type')} {r3.get('refund_amount')}",
))

# --- كل شيء مرتجع: أي محاولة جديدة تُرفض -----------------------------------
st, r = ret(
    "ret-nothing",
    [{"itemId": "itemB", "quantity": 1}],
    47.25,
    [{"method": "card", "amount": 47.25}],
)
results.append(check("all returned -> 409", st == 409 and detail_of(r) == "return_qty_exceeded",
                     f"{st} {detail_of(r)}"))

# --- فاتورة غير موجودة / بنود فارغة ----------------------------------------
st, r = call("POST", "/api/returns", {
    "uid": f"ret-missing-{RUN}", "invoice_uid": "does-not-exist",
    "items": [{"itemId": "x", "quantity": 1}], "refund_amount": 10,
    "refund_parts": [{"method": "cash", "amount": 10}],
})
results.append(check("missing invoice -> 404", st == 404 and detail_of(r) == "return_invoice_not_found",
                     f"{st} {detail_of(r)}"))

st, r = call("POST", "/api/returns", {
    "uid": f"ret-empty-{RUN}", "invoice_uid": INV_UID, "items": [], "refund_amount": 0,
})
results.append(check("empty items -> 400", st == 400 and detail_of(r) == "return_no_items",
                     f"{st} {detail_of(r)}"))

# --- السحب التنازلية --------------------------------------------------------
st, lst = call("GET", f"/api/returns?since=0&page_size=200")
mine = [x for x in (lst.get("returns") or []) if x.get("invoice_uid") == INV_UID]
results.append(check("pull since=0 lists 3", st == 200 and len(mine) == 3, f"got={len(mine)}"))
st, lst2 = call("GET", f"/api/returns?since={NOW + 10_000_000}")
results.append(check("pull since future empty", st == 200 and lst2.get("total") == 0,
                     f"total={lst2.get('total')}"))

# --- summary بعد المرتجعات --------------------------------------------------
st, summary = call("GET", "/api/stats/summary")
expected_returns = 94.5 + 378 + 189
# كاش مرجَع: 94.5 (الأولى) + 205.5 (الثانية) = 300 من أصل 300 مدفوعة كاشاً
expected_cash_refunds = 94.5 + 205.5
results.append(check(
    "summary returns_total",
    st == 200
    and abs(float(summary.get("returns_total", 0)) - expected_returns) < 0.01
    and abs(float(summary.get("cash_refunds", 0)) - expected_cash_refunds) < 0.01
    and int(summary.get("returns", 0)) == 3
    and abs(float(summary.get("net_sales", 0)) - (float(summary.get("sales", 0)) - expected_returns)) < 0.01,
    json.dumps({k: summary.get(k) for k in ("sales", "returns", "returns_total", "cash_refunds", "net_sales")},
               ensure_ascii=False),
))
# الدرج: مبيعات الكاش (من الفواتير فقط) ناقص المرتجعات النقدية = صافي الحركة
cash_sales = float(summary.get("cash_sales", 0))
results.append(check(
    "summary cash_sales is invoice cash only",
    abs(cash_sales - 300) < 0.01,
    f"cash_sales={cash_sales}",
))
drawer_delta = cash_sales - expected_cash_refunds
results.append(check(
    "drawer movement after returns",
    abs(drawer_delta - (300 - 300)) < 0.01,
    f"delta={drawer_delta}",
))

print("-" * 50)
passed = sum(1 for r in results if r)
print(f"{passed}/{len(results)} اختبارات ناجحة")
sys.exit(0 if passed == len(results) else 1)
