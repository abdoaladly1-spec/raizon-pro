"""اختبار سريع لسيرفر ProCashier: python smoke_test.py [base_url] [api_key]

بدون معطيات: يُشغّل سيرفراً معزولاً (قاعدة مؤقتة + مفتاح اختبار خاص) فلا يلمس
قاعدة الإنتاج ولا مجلد النسخ الاحتياطي الحقيقي.
مع base_url صريح: يختبر ذلك السيرفر تحديداً (استثناءً يتم بقرار من المستخدم).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# يعمل من أي مجلد: نضيف مجلد السيرفر لمسار الاستيراد
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _load_env_key() -> str:
    """يقرأ API_KEY من server/.env (إن وُجد) عشان الاختبارات تمشي بالمصادقة."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return ""
    with open(env_path, encoding="utf-8") as fh:
        for line in fh:
            s = line.strip()
            if s.startswith("API_KEY="):
                value = s.partition("=")[2].strip().strip('"').strip("'")
                if value.lower() in ("off", "none", "disabled"):
                    return ""
                return value
    return ""


ARGS = sys.argv[1:]
ISOLATED = len(ARGS) == 0
_stop_server = None

if ISOLATED:
    # نجهّز البيئة المعزولة (DB/API_KEY/EMAIL_MODE) قبل استيراد emailer/database
    import atexit

    import test_harness

    test_harness.prepare_env()
    BASE, API_KEY, _stop_server = test_harness.start()
    atexit.register(_stop_server)
else:
    BASE = ARGS[0]
    API_KEY = ARGS[1] if len(ARGS) > 1 else _load_env_key()

try:
    import emailer  # noqa: E402
except Exception:  # noqa: BLE001
    emailer = None


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


results = []

RUN = int(time.time())
TEST_NAME = f"عميل اختبار {RUN}"

st, health = call("GET", "/health")
results.append(check("GET /health", st == 200 and health.get("status") == "ok", str(health)))

invoice = {
    "local_id": RUN,
    "customer_name": TEST_NAME,
    "phone": "01012345678",
    "items": [
        {"name": "قص شعر", "price": 150, "quantity": 2},
        {"name": "شامبو", "price": 120, "quantity": 1},
    ],
    "subtotal": 420,
    "discount": 20,
    "tax": 0,
    "total": 400,
    "payment_method": "cash",
    "status": "paid",
    "created_by": "admin",
    "location_id": "1",
    "date": "2026-09-24",
    "timestamp": RUN * 1000,
}

st, res = call("POST", "/api/invoices", invoice)
results.append(check("POST /api/invoices (فاتورة جديدة)", st == 200 and res.get("is_new") is True, str(res)))

st, res2 = call("POST", "/api/invoices", invoice)
results.append(check("POST /api/invoices (تكرار idempotent)", st == 200 and res2.get("is_new") is False, str(res2)))

st, res = call("GET", "/api/invoices?" + urllib.parse.urlencode({"search": TEST_NAME}))
results.append(check("GET /api/invoices?search", st == 200 and res.get("total", 0) >= 1, f"total={res.get('total')}"))

st, res = call("GET", "/api/invoices?" + urllib.parse.urlencode({"date_from": "2026-09-01", "date_to": "2026-09-30"}))
results.append(check("GET /api/invoices (فلتر تاريخ)", st == 200 and res.get("total", 0) >= 1, f"total={res.get('total')}"))

inv_id = res["invoices"][0]["id"] if res.get("invoices") else ""
st, res = call("GET", f"/api/invoices/{inv_id}")
results.append(check("GET /api/invoices/{id}", st == 200 and res.get("items"), f"items={len(res.get('items', []))}"))

st, res = call("GET", "/api/stats/summary")
results.append(check("GET /api/stats/summary", st == 200 and res.get("sales", 0) >= 400, str(res)))

st, res = call("GET", "/api/stats/daily?days=30")
results.append(check("GET /api/stats/daily", st == 200 and isinstance(res.get("series"), list), str(len(res.get("series", [])))))

st, res = call("GET", "/api/stats/monthly?months=12")
results.append(check("GET /api/stats/monthly", st == 200 and isinstance(res.get("series"), list), str(len(res.get("series", [])))))

st, res = call("GET", "/api/customers?" + urllib.parse.urlencode({"q": TEST_NAME}))
results.append(check("GET /api/customers (بحث عميل)", st == 200 and len(res.get("results", [])) >= 1, str(len(res.get("results", [])))))

st, res = call("POST", "/api/invoices/batch", {"invoices": [dict(invoice, local_id=RUN + 1, total=250)]})
results.append(check("POST /api/invoices/batch", st == 200 and res.get("created") == 1, str(res)))

st, res = call("GET", "/api/emails")
results.append(check("GET /api/emails (سجل الإشعارات)", st == 200 and len(res.get("log", [])) >= 1,
                     f"mode={res.get('mode')} logs={len(res.get('log', []))}"))

# ---------------------------------------------------------------
# بروتوكول الهوية الثابتة + الحذف المنطقي (tombstones)
uid = f"smoke-uid-{RUN}"
inv_uid = dict(invoice, uid=uid, local_id=RUN + 7, timestamp=(RUN + 7) * 1000)
st, res = call("POST", "/api/invoices", inv_uid)
results.append(check("POST uid (هوية ثابتة)", st == 200 and res.get("is_new") is True and res.get("id") == uid, str(res)))
st, res = call("POST", "/api/invoices", inv_uid)
results.append(check("POST uid idempotent", st == 200 and res.get("is_new") is False, str(res)))

st, sum_before = call("GET", "/api/stats/summary")
since_mark = int(time.time() * 1000) - 1
st, res = call("DELETE", f"/api/invoices/{uid}")
results.append(check("DELETE (حذف منطقي)", st == 200 and res.get("deleted") is True, str(res)))

st, res = call("GET", "/api/invoices?" + urllib.parse.urlencode({"since": since_mark, "page_size": 200}))
tomb = [r for r in res.get("invoices", []) if r.get("id") == uid]
results.append(check(
    "since يعيد التحديثات والحذف المنطقي",
    st == 200 and len(tomb) == 1 and int(tomb[0].get("deleted") or 0) == 1 and int(tomb[0].get("updated_at") or 0) > since_mark,
    f"tomb={len(tomb)}",
))

st, res = call("GET", "/api/invoices?" + urllib.parse.urlencode({"search": TEST_NAME, "page_size": 200}))
hidden = [r for r in res.get("invoices", []) if r.get("id") == uid]
results.append(check("القائمة العادية تخفي الملغاة", st == 200 and len(hidden) == 0, f"hidden={len(hidden)}"))

st, sum_after = call("GET", "/api/stats/summary")
results.append(check(
    "الملخص يستبعد الملغاة",
    st == 200 and sum_after.get("invoices") == (sum_before.get("invoices") or 0) - 1,
    f"before={sum_before.get('invoices')} after={sum_after.get('invoices')}",
))

# ---------------------------------------------------------------
# توحيد صيغة التاريخ (legacy DD/MM/YYYY -> YYYY-MM-DD)
date_uid = f"smoke-date-{RUN}"
date_payload = dict(invoice, uid=date_uid, local_id=RUN + 8, date="05/03/2026", timestamp=(RUN + 8) * 1000)
st, res = call("POST", "/api/invoices", date_payload)
st_rec, rec = call("GET", f"/api/invoices/{date_uid}")
results.append(check(
    "POST يوحّد التاريخ DD/MM/YYYY -> ISO",
    st == 200 and st_rec == 200 and rec.get("date") == "2026-03-05",
    f"status={st} date={rec.get('date')}",
))
st, res = call("GET", "/api/invoices?" + urllib.parse.urlencode({
    "date_from": "2026-03-05", "date_to": "2026-03-05", "page_size": 200,
}))
hits = [r for r in res.get("invoices", []) if r.get("id") == date_uid]
st2, res2 = call("GET", "/api/invoices?" + urllib.parse.urlencode({
    "date_from": "2026-03-06", "date_to": "2026-03-31", "page_size": 200,
}))
miss = [r for r in res2.get("invoices", []) if r.get("id") == date_uid]
results.append(check(
    "فلترة النطاق الزمني تعمل بالتاريخ الموحّد",
    st == 200 and st2 == 200 and len(hits) == 1 and len(miss) == 0,
    f"in={len(hits)} out={len(miss)}",
))
call("DELETE", f"/api/invoices/{date_uid}")  # تنظيف أثر الاختبار

# ---------------------------------------------------------------
# الدفع المختلط: جزء نقدي + غير نقدي (يدخل الدرج الجزء النقدي فقط)
split_uid = f"smoke-split-{RUN}"
split_payload = dict(
    invoice,
    uid=split_uid,
    local_id=RUN + 9,
    total=300,
    subtotal=300,
    discount=0,
    tax=0,
    payment_method="mixed",
    timestamp=(RUN + 9) * 1000,
    payment_parts=[{"method": "card", "amount": 200}, {"method": "cash", "amount": 100}],
    cash_paid=100,
    received=150,
    change=50,
)

st, sum_before = call("GET", "/api/stats/summary?" + urllib.parse.urlencode({
    "date_from": "2026-09-01", "date_to": "2026-09-30",
}))
st, res = call("POST", "/api/invoices", split_payload)
st, rec = call("GET", f"/api/invoices/{split_uid}")
parts = rec.get("payment_parts") or []
results.append(check(
    "دفع مختلط: يُحفظ ويُقرأ بالكامل (200 كاش + 100 بطاقة، مستلم 150)",
    st == 200 and res.get("is_new") is True and len(parts) == 2
    and rec.get("cash_paid") == 100 and rec.get("received") == 150 and rec.get("change") == 50,
    f"parts={parts} cash={rec.get('cash_paid')} recv={rec.get('received')} chg={rec.get('change')}",
))

st, sum_after = call("GET", "/api/stats/summary?" + urllib.parse.urlencode({
    "date_from": "2026-09-01", "date_to": "2026-09-30",
}))
delta_sales = round((sum_after.get("sales") or 0) - (sum_before.get("sales") or 0), 2)
delta_cash = round((sum_after.get("cash_sales") or 0) - (sum_before.get("cash_sales") or 0), 2)
results.append(check(
    "الملخص: cash_sales يضيف الجزء النقدي فقط (100 من 300)",
    st == 200 and delta_sales == 300 and delta_cash == 100,
    f"sales+{delta_sales} cash+{delta_cash}",
))

st, res = call("POST", "/api/invoices", split_payload)
st, rec2 = call("GET", f"/api/invoices/{split_uid}")
results.append(check(
    "دفع مختلط: إعادة الإرسال لا تكرر ولا تمسّ التفاصيل",
    st == 200 and res.get("is_new") is False and (rec2.get("payment_parts") or []) == parts
    and rec2.get("cash_paid") == 100,
    f"is_new={res.get('is_new')} parts={rec2.get('payment_parts')}",
))

bad_uid = f"smoke-split-bad-{RUN}"
bad = dict(split_payload, uid=bad_uid, local_id=RUN + 10, timestamp=(RUN + 10) * 1000,
           payment_parts=[{"method": "card", "amount": 200}, {"method": "cash", "amount": 50}])
st, res = call("POST", "/api/invoices", bad)
results.append(check(
    "دفع مختلط: رفض مجموع != الإجمالي",
    st == 400 and res.get("detail") == "payment_sum_mismatch",
    f"st={st} detail={res.get('detail')}",
))

short_uid = f"smoke-split-short-{RUN}"
short = dict(split_payload, uid=short_uid, local_id=RUN + 11, timestamp=(RUN + 11) * 1000, received=50)
st, res = call("POST", "/api/invoices", short)
results.append(check(
    "دفع مختلط: رفض مستلم أقل من جزء الكاش",
    st == 400 and res.get("detail") == "payment_received_short",
    f"st={st} detail={res.get('detail')}",
))

neg_uid = f"smoke-split-neg-{RUN}"
neg = dict(split_payload, uid=neg_uid, local_id=RUN + 12, timestamp=(RUN + 12) * 1000,
           payment_parts=[{"method": "cash", "amount": -10}, {"method": "card", "amount": 310}])
st, res = call("POST", "/api/invoices", neg)
results.append(check(
    "دفع مختلط: رفض مبلغ سالب",
    st == 400 and res.get("detail") == "payment_negative",
    f"st={st} detail={res.get('detail')}",
))

legacy_uid = f"smoke-split-legacy-{RUN}"
legacy = dict(invoice, uid=legacy_uid, local_id=RUN + 13, total=400, timestamp=(RUN + 13) * 1000,
              payment_parts=None, cash_paid=None, received=None, change=None)
st, res = call("POST", "/api/invoices", legacy)
st, leg = call("GET", f"/api/invoices/{legacy_uid}")
results.append(check(
    "دفع مختلط: فاتورة قديمة بلا أجزاء تُقبل وتُرجع حقولاً فارغة",
    st == 200 and res.get("is_new") is True
    and leg.get("payment_parts") in (None, [])
    and leg.get("received") is None,
    f"st={st} parts={leg.get('payment_parts')} recv={leg.get('received')}",
))

call("DELETE", f"/api/invoices/{split_uid}")
call("DELETE", f"/api/invoices/{legacy_uid}")

# ---------------------------------------------------------------
# اختبارات وحدة الإيميل (بناء الرسالة فقط - بدون إرسال فعلي)
if emailer is None:
    results.append(check("import emailer", False, "تعذر استيراد emailer"))
else:
    mail = emailer.build_invoice_email(invoice)
    want_subject = f"فاتورة جديدة #{invoice['local_id']}"
    results.append(check(
        "emailer.build_invoice_email (الموضوع)",
        want_subject in mail.get("subject", "") and "400.00" in mail.get("subject", ""),
        mail.get("subject", ""),
    ))
    html = mail.get("html", "")
    results.append(check(
        "emailer.build_invoice_email (الجسم)",
        invoice["customer_name"] in html and "قص شعر" in html and "Rizon Pro System Cashier" in html and "dir=\"rtl\"" in html,
        f"len={len(html)}",
    ))
    results.append(check(
        "emailer.build_invoice_email (نص بسيط)",
        invoice["customer_name"] in mail.get("plain", "") and "400.00" in mail.get("plain", ""),
        repr(mail.get("plain", ""))[:80],
    ))

    st, res = call("GET", "/api/emails")
    results.append(check(
        "وضع الإيميل متطابق (/api/emails == email_mode)",
        st == 200 and res.get("mode") == emailer.email_mode(),
        f"api={res.get('mode')} local={emailer.email_mode()}",
    ))

    # مسار المحاكاة/الإيقاف فقط - لا نرسل إيميل حقيقي أبداً في الاختبار
    if emailer.email_mode() != "live":
        sent = emailer.send_invoice_notification(invoice)
        results.append(check(
            "send_invoice_notification (محاكاة)",
            sent.get("status") in ("simulated", "skipped") and sent.get("mode") in ("simulation", "off"),
            str(sent),
        ))

print("-" * 50)
passed = sum(1 for r in results if r)
print(f"{passed}/{len(results)} اختبارات ناجحة")
sys.exit(0 if passed == len(results) else 1)
