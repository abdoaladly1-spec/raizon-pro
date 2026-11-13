"""طبقة قاعدة البيانات SQLite (الفواتير + سجل الإيميلات)."""
import json
import re
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import DB_PATH

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
_LEGACY_DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def normalize_date(value: Any, timestamp: int = 0) -> str:
    """يُوحّد تاريخ الفاتورة إلى YYYY-MM-DD.

    يقبل الصيغة الحالية (ISO) والصيغة القديمة DD/MM/YYYY القادمة من المتصفح،
    وإلا تنكسر فلاتر النطاق الزمني (`date_from/date_to`) لأن المقارنة نصية.
    """
    text = (str(value) if value is not None else "").strip()
    if _ISO_DATE_RE.match(text):
        return text[:10]
    legacy = _LEGACY_DATE_RE.match(text)
    if legacy:
        day, month, year = legacy.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"
    if timestamp:
        try:
            return datetime.fromtimestamp(int(timestamp) / 1000, tz=timezone.utc).astimezone().strftime("%Y-%m-%d")
        except (TypeError, ValueError, OSError, OverflowError):
            pass
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")

SCHEMA = """
CREATE TABLE IF NOT EXISTS invoices (
    id            TEXT PRIMARY KEY,
    uid           TEXT,
    local_id      INTEGER,
    customer_id   INTEGER,
    customer_name TEXT DEFAULT '',
    phone         TEXT DEFAULT '',
    items_json    TEXT DEFAULT '[]',
    subtotal      REAL DEFAULT 0,
    discount      REAL DEFAULT 0,
    tax           REAL DEFAULT 0,
    total         REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    payment_json  TEXT DEFAULT '',
    status        TEXT DEFAULT 'paid',
    staff_name    TEXT DEFAULT '',
    created_by    TEXT DEFAULT '',
    location_id   TEXT DEFAULT '',
    notes         TEXT DEFAULT '',
    date          TEXT DEFAULT '',
    timestamp     INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT '',
    updated_at    INTEGER DEFAULT 0,
    deleted       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
    id           INTEGER PRIMARY KEY,
    name         TEXT DEFAULT '',
    phone        TEXT DEFAULT '',
    email        TEXT DEFAULT '',
    total_spent  REAL DEFAULT 0,
    last_visit   TEXT DEFAULT '',
    loyalty_points INTEGER DEFAULT 0,
    tier         TEXT DEFAULT 'Bronze',
    updated_at   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS returns (
    id            TEXT PRIMARY KEY,
    uid           TEXT,
    invoice_uid   TEXT DEFAULT '',
    invoice_id    INTEGER DEFAULT 0,
    items_json    TEXT DEFAULT '[]',
    refund_amount REAL DEFAULT 0,
    refund_parts  TEXT DEFAULT '[]',
    cash_refund   REAL DEFAULT 0,
    type          TEXT DEFAULT 'partial',
    status        TEXT DEFAULT 'approved',
    reason        TEXT DEFAULT '',
    notes         TEXT DEFAULT '',
    staff_id      TEXT DEFAULT '',
    staff_name    TEXT DEFAULT '',
    created_by    TEXT DEFAULT '',
    customer_id   INTEGER DEFAULT 0,
    customer_name TEXT DEFAULT '',
    location_id   TEXT DEFAULT '',
    points_reversed    INTEGER DEFAULT 0,
    commission_reversed REAL DEFAULT 0,
    date          TEXT DEFAULT '',
    timestamp     INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT '',
    updated_at    INTEGER DEFAULT 0,
    deleted       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id  TEXT,
    recipient   TEXT,
    subject     TEXT,
    body        TEXT,
    mode        TEXT,
    status      TEXT,
    error       TEXT,
    created_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_ts ON invoices(timestamp);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_uid ON returns(uid);
CREATE INDEX IF NOT EXISTS idx_returns_invoice ON returns(invoice_uid);
CREATE INDEX IF NOT EXISTS idx_returns_ts ON returns(timestamp);
"""


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(SCHEMA)
        _migrate(_conn)
        _conn.commit()
    return _conn


def _migrate(conn: sqlite3.Connection) -> None:
    """ترقية قواعد قديمة: هوية ثابتة (uid) + طابع تحديث + حذف منطقي (tombstone)."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
    for ddl in (
        "ALTER TABLE invoices ADD COLUMN uid TEXT",
        "ALTER TABLE invoices ADD COLUMN updated_at INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN deleted INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN payment_json TEXT DEFAULT ''",
    ):
        column = ddl.split()[5]
        if column not in cols:
            conn.execute(ddl)
    # الصفوف القديمة: الهوية = المفتاح القديم، ووقت التحديث = وقت البيع
    conn.execute("UPDATE invoices SET uid = id WHERE uid IS NULL OR uid = ''")
    conn.execute("UPDATE invoices SET updated_at = COALESCE(timestamp, 0) WHERE updated_at IS NULL OR updated_at = 0")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_uid ON invoices(uid)")
    # توحيد تواريخ legacy (DD/MM/YYYY) إلى YYYY-MM-DD حتى تعمل فلاتر النطاق الزمني
    for row in conn.execute("SELECT id, date, timestamp FROM invoices WHERE date LIKE '%/%'").fetchall():
        iso = normalize_date(row["date"], row["timestamp"])
        if iso != row["date"]:
            conn.execute("UPDATE invoices SET date = ? WHERE id = ?", (iso, row["id"]))


def close_conn() -> None:
    """يُغلق الاتصال الحالي (مفيد لإنهاء الاختبارات وحذف الملفات المؤقتة)."""
    global _conn
    with _lock:
        if _conn is not None:
            try:
                _conn.close()
            except Exception:  # noqa: BLE001
                pass
            _conn = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# الدفع المختلط: حفذ JSON ذري واحد (payment_json) لتفاصيل الدفع بالفواتير
# ---------------------------------------------------------------------------

_PART_METHODS = ("cash", "card", "wallet", "instapay", "credit", "visa")


def _clean_parts(value: Any) -> List[Dict[str, Any]]:
    """يُنقّي أجزاء الدفع: طرق معروفة + مبالغ موجبة فقط (تقريب لخانتين)."""
    if not isinstance(value, list):
        return []
    parts: List[Dict[str, Any]] = []
    for part in value:
        if not isinstance(part, dict):
            continue
        method = str(part.get("method") or "").strip().lower()
        if method not in _PART_METHODS:
            continue
        try:
            amount = round(float(part.get("amount") or 0), 2)
        except (TypeError, ValueError):
            continue
        if amount > 0:
            parts.append({"method": method, "amount": amount})
    return parts


def _payment_json(payload: Dict[str, Any]) -> str:
    """يبني محتوى payment_json (فارغ للفواتير القديمة/الدفع الواحد البسيط)."""
    parts = _clean_parts(payload.get("payment_parts"))
    cash_paid = payload.get("cash_paid")
    received = payload.get("received")
    change = payload.get("change")
    if not parts and cash_paid is None and received is None and change is None:
        return ""
    data = {
        "parts": parts,
        "cashPaid": round(float(cash_paid or 0), 2),
        "received": round(float(received or 0), 2),
        "change": round(float(change or 0), 2),
    }
    return json.dumps(data, ensure_ascii=False)


def _payment_fields(raw: Any) -> Dict[str, Any]:
    """payment_json → حقول مستوية تفهمها الواجهة (None للفواتير القديمة)."""
    text = str(raw or "").strip()
    if not text:
        return {"payment_parts": None, "cash_paid": None, "received": None, "change": None}
    try:
        data = json.loads(text)
    except Exception:  # noqa: BLE001
        return {"payment_parts": None, "cash_paid": None, "received": None, "change": None}
    if not isinstance(data, dict):
        return {"payment_parts": None, "cash_paid": None, "received": None, "change": None}
    parts = _clean_parts(data.get("parts"))
    return {
        "payment_parts": parts or None,
        "cash_paid": data.get("cashPaid"),
        "received": data.get("received"),
        "change": data.get("change"),
    }


def _cash_amount(total: Any, payment_method: Any, payment_json: Any) -> float:
    """النقدي المستلم من فاتورة (جزء الدفع النقدية فقط) — أساس حساب الدرج."""
    fields = _payment_fields(payment_json)
    parts = fields["payment_parts"]
    if parts:
        return round(sum(float(p.get("amount") or 0) for p in parts if p.get("method") == "cash"), 2)
    try:
        value = round(float(total or 0), 2)
    except (TypeError, ValueError):
        return 0.0
    return value if str(payment_method or "cash").lower() == "cash" else 0.0


def insert_invoice(payload: Dict[str, Any]) -> bool:
    """إدراج فاتورة (idempotent). يرجع True لو الفاتورة جديدة فعلاً.

    المعرّف uid ثابت لكل فاتورة؛ إعادة الإرسال لنفس uid لا تنشئ نسخة إضافية.
    """
    conn = get_conn()
    uid = str(payload.get("uid") or payload.get("id") or "")
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    with _lock:
        cur = conn.execute(
            """INSERT OR IGNORE INTO invoices
               (id, uid, local_id, customer_id, customer_name, phone, items_json,
                subtotal, discount, tax, total, payment_method, payment_json, status,
                staff_name, created_by, location_id, notes, date, timestamp, created_at,
                updated_at, deleted)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                payload.get("id"),
                uid,
                payload.get("local_id"),
                payload.get("customer_id"),
                payload.get("customer_name") or "Guest",
                payload.get("phone") or "",
                json.dumps(payload.get("items") or [], ensure_ascii=False),
                payload.get("subtotal") or 0,
                payload.get("discount") or 0,
                payload.get("tax") or 0,
                payload.get("total") or 0,
                payload.get("payment_method") or "cash",
                _payment_json(payload),
                payload.get("status") or "paid",
                payload.get("staff_name") or "",
                payload.get("created_by") or "",
                payload.get("location_id") or "",
                payload.get("notes") or "",
                payload.get("date") or "",
                payload.get("timestamp") or 0,
                _now(),
                int(payload.get("updated_at") or now_ms),
                int(payload.get("deleted") or 0),
            ),
        )
        conn.commit()
        return cur.rowcount > 0


def soft_delete_invoice(invoice_id: str) -> Optional[int]:
    """حذف منطقي (tombstone): يُبقي الفاتورة لكن يعلّمها ملغاة ويحدّث وقت التحديث.

    يرجع قيمة updated_at الجديدة لو تم التحديث، أو None لو الفاتورة غير موجودة.
    الفواتير لا تُحذف فيزيائياً حتى تبقى مرجعية حسابية موثّقة.
    """
    conn = get_conn()
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    with _lock:
        cur = conn.execute(
            "UPDATE invoices SET deleted = 1, updated_at = ? WHERE id = ?",
            (now_ms, str(invoice_id)),
        )
        conn.commit()
        if cur.rowcount <= 0:
            return None
        return now_ms


def upsert_customer(c: Dict[str, Any]) -> None:
    if not c.get("id"):
        return
    conn = get_conn()
    with _lock:
        conn.execute(
            """INSERT INTO customers (id, name, phone, email, total_spent, last_visit, loyalty_points, tier, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name, phone=excluded.phone, email=excluded.email,
                 total_spent=excluded.total_spent, last_visit=excluded.last_visit,
                 loyalty_points=excluded.loyalty_points, tier=excluded.tier,
                 updated_at=excluded.updated_at""",
            (
                c.get("id"), c.get("name") or "", c.get("phone") or "", c.get("email") or "",
                c.get("total_spent") or 0, c.get("last_visit") or "",
                c.get("loyalty_points") or 0, c.get("tier") or "Bronze", _now(),
            ),
        )
        conn.commit()


def list_invoices(search: str = "", date_from: str = "", date_to: str = "",
                  since: int = 0, page: int = 1, page_size: int = 50,
                  include_deleted: bool = False) -> Dict[str, Any]:
    conn = get_conn()
    where: List[str] = []
    params: List[Any] = []
    if search:
        where.append("(customer_name LIKE ? OR phone LIKE ? OR CAST(id AS TEXT) LIKE ? OR CAST(local_id AS TEXT) LIKE ?)")
        like = f"%{search}%"
        params += [like, like, like, like]
    if date_from:
        where.append("date >= ?")
        params.append(date_from)
    if date_to:
        where.append("date <= ?")
        params.append(date_to)
    if since:
        # المزامنة التنازلية تعتمد على وقت آخر تعديل، فتشمل التحديثات والإلغاءات
        # (وليس وقت البيع فقط) — والحذف المنطقي يعود كـ tombstone ليحذفه الجهاز.
        where.append("updated_at > ?")
        params.append(int(since))
    elif not include_deleted:
        where.append("deleted = 0")

    clause = ("WHERE " + " AND ".join(where)) if where else ""
    page = max(1, page)
    page_size = max(1, min(200, page_size))

    total = conn.execute(f"SELECT COUNT(*) c FROM invoices {clause}", params).fetchone()["c"]
    rows = conn.execute(
        f"SELECT * FROM invoices {clause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?",
        params + [page_size, (page - 1) * page_size],
    ).fetchall()

    items = []
    for r in rows:
        d = dict(r)
        try:
            d["items"] = json.loads(d.pop("items_json") or "[]")
        except Exception:
            d["items"] = []
        d.update(_payment_fields(d.pop("payment_json", "")))
        items.append(d)

    return {"total": total, "page": page, "page_size": page_size, "invoices": items}


def get_invoice(invoice_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["items"] = json.loads(d.pop("items_json") or "[]")
    except Exception:
        d["items"] = []
    d.update(_payment_fields(d.pop("payment_json", "")))
    return d


# ---------------------------------------------------------------------------
# المرتجعات: سجل مستقل + تحقق داخل معاملة واحدة (منع تعارض الأجهزة)
# ---------------------------------------------------------------------------

class ReturnError(Exception):
    """خطأ منطق مرتجعات يُحوَّل في main.py إلى رد HTTP بالرمز المناسب."""

    def __init__(self, detail: str, status: int = 400):
        super().__init__(detail)
        self.detail = detail
        self.status = status


def _round2(value: Any) -> float:
    try:
        return round(float(value or 0) + 0.0, 2)
    except (TypeError, ValueError):
        return 0.0


def _legacy_paid_method(payment_method: Any) -> str:
    """نفس قاعدة العميل legacyKind: visa/split/loyalty → بطاقة، wallet → محفظة، الباقي كاش."""
    m = str(payment_method or "cash").strip().lower()
    if m == "wallet":
        return "wallet"
    if m == "instapay":
        return "instapay"
    if m in ("credit", "آجل", "on_account"):
        return "credit"
    if m in ("card", "visa", "split", "loyalty"):
        return "card"
    return "cash"


def _invoice_for_return(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    try:
        d["items"] = json.loads(d.pop("items_json") or "[]")
    except Exception:
        d["items"] = []
    d.update(_payment_fields(d.pop("payment_json", "")))
    return d


def _paid_by_method(inv: Dict[str, Any]) -> Dict[str, float]:
    """ما دُفع فعلياً لكل طريقة (من أجزاء الدفع أو من الطريقة القديمة)."""
    parts = inv.get("payment_parts")
    paid: Dict[str, float] = {"cash": 0.0, "card": 0.0, "wallet": 0.0, "instapay": 0.0, "credit": 0.0}
    if isinstance(parts, list) and parts:
        for p in parts:
            if not isinstance(p, dict):
                continue
            method = str(p.get("method") or "").lower()
            if method == "visa":
                method = "card"
            if method in paid:
                paid[method] = round(paid[method] + _round2(p.get("amount")), 2)
        return paid
    method = _legacy_paid_method(inv.get("payment_method"))
    paid[method] = _round2(inv.get("total"))
    return paid


def _line_sale_amounts(inv: Dict[str, Any], line: Dict[str, Any], qty: int) -> Dict[str, float]:
    """مبالغ بيع لسطر بيع بكمية — من خصم/ضريبة **الفاتورة وقت البيع** لا من الأسعار الحالية.

    الخصم تناسبي على (سعر × كمية) من إجمالي الفاتورة، والضريبة على الأساس بعد الخصم.
    """
    subtotal = _round2(inv.get("subtotal"))
    inv_discount = _round2(inv.get("discount"))
    inv_tax = _round2(inv.get("tax"))
    gross = _round2(_round2(line.get("price")) * qty)
    discount = 0.0
    if subtotal > 0:
        discount = _round2(gross * (inv_discount / subtotal))
    taxable = _round2(gross - discount)
    after_discount_total = _round2(subtotal - inv_discount)
    tax = _round2(taxable * (inv_tax / after_discount_total)) if after_discount_total > 0 else 0.0
    return {
        "gross": gross,
        "discount_amount": discount,
        "tax_amount": tax,
        "refund_amount": _round2(taxable + tax),
    }


def _return_row(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    try:
        d["items"] = json.loads(d.pop("items_json") or "[]")
    except Exception:  # noqa: BLE001
        d["items"] = []
    raw_parts = d.pop("refund_parts", [])
    if isinstance(raw_parts, str):
        try:
            raw_parts = json.loads(raw_parts or "[]")
        except Exception:  # noqa: BLE001
            raw_parts = []
    d["refund_parts"] = raw_parts if isinstance(raw_parts, list) else []
    return d


def create_return(payload: Dict[str, Any]) -> Dict[str, Any]:
    """إنشاء سجل مرتجع معتمد — التحقق والإدراج داخل معاملة SQLite واحدة.

    القواعد:
      * uid ثابت → إعادة الإرسال لا تنشئ نسخة (idempotent).
      * لا يُقبل مرتجع لفاتورة غير موجودة/ملغاة.
      * الكمية ≤ (كمية البيع − مجموع مرتجعات هذه الفاتورة المعتمدة سابقاً).
      * المبلغ يُعاد حسابه من سعر/خصم/ضريبة وقت البيع.
      * أجزاء الرد (كاش/بطاقة/محفظة) مجموعها = المبلغ، ولا تتجاوز ما دُفع لكل طريقة.
    """
    uid = str(payload.get("uid") or payload.get("id") or "").strip()
    if not uid:
        raise ReturnError("return_no_uid", 400)
    invoice_uid = str(payload.get("invoice_uid") or "").strip()
    raw_items = payload.get("items") if isinstance(payload.get("items"), list) else []
    if not raw_items:
        raise ReturnError("return_no_items", 400)

    conn = get_conn()
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    with _lock:
        if conn.in_transaction:
            conn.commit()
        conn.execute("BEGIN IMMEDIATE")
        try:
            existing = conn.execute("SELECT * FROM returns WHERE uid = ?", (uid,)).fetchone()
            if existing:
                conn.commit()
                return {"is_new": False, **_return_row(existing)}

            inv_row = None
            if invoice_uid:
                inv_row = conn.execute(
                    "SELECT * FROM invoices WHERE (uid = ? OR id = ?) AND deleted = 0",
                    (invoice_uid, invoice_uid),
                ).fetchone()
            if inv_row is None:
                raise ReturnError("return_invoice_not_found", 404)
            inv = _invoice_for_return(inv_row)
            inv_key = str(inv.get("uid") or inv.get("id"))

            # المرتجعات المعتمدة السابقة لهذه الفاتورة (من أي جهاز)
            prev_rows = conn.execute(
                "SELECT items_json, refund_parts FROM returns WHERE invoice_uid = ? AND deleted = 0 AND status = 'approved'",
                (inv_key,),
            ).fetchall()
            returned_qty: Dict[str, int] = {}
            prior_refunded: Dict[str, float] = {"cash": 0.0, "card": 0.0, "wallet": 0.0, "instapay": 0.0, "credit": 0.0}
            for prev in prev_rows:
                try:
                    prev_items = json.loads(prev["items_json"] or "[]")
                except Exception:
                    prev_items = []
                for it in prev_items:
                    if isinstance(it, dict):
                        key = str(it.get("itemId") or "")
                        returned_qty[key] = returned_qty.get(key, 0) + int(it.get("quantity") or 0)
                try:
                    prev_parts = json.loads(prev["refund_parts"] or "[]")
                except Exception:
                    prev_parts = []
                for pp in prev_parts if isinstance(prev_parts, list) else []:
                    if isinstance(pp, dict) and str(pp.get("method")) in prior_refunded:
                        m = str(pp.get("method"))
                        prior_refunded[m] = _round2(prior_refunded[m] + _round2(pp.get("amount")))

            line_by_id = {str(l.get("itemId")): l for l in (inv.get("items") or [])}
            clean_items: List[Dict[str, Any]] = []
            refund_total = 0.0
            for raw in raw_items:
                if not isinstance(raw, dict):
                    raise ReturnError("return_invalid_item", 400)
                item_id = str(raw.get("itemId") or "")
                line = line_by_id.get(item_id)
                if line is None:
                    raise ReturnError("return_invalid_item", 400)
                try:
                    qty_val = float(raw.get("quantity") or 0)
                except (TypeError, ValueError):
                    raise ReturnError("return_invalid_item", 400)
                if qty_val <= 0 or abs(qty_val - round(qty_val)) > 1e-6:
                    raise ReturnError("return_invalid_item", 400)
                qty = int(round(qty_val))
                already = int(returned_qty.get(item_id, 0))
                line_qty = int(line.get("quantity") or 0)
                # تعارض الأجهزة: الكمية المتبقية تُحسب من كل مرتجعات هذه الفاتورة
                if qty > (line_qty - already):
                    raise ReturnError("return_qty_exceeded", 409)

                amounts = _line_sale_amounts(inv, line, qty)
                client_amount = _round2(raw.get("refund_amount")) if raw.get("refund_amount") is not None else None
                # السيرفر هو المرجع؛ نتسامح فقط مع فرق التقريب الناتج عن اشتقاق
                # النِسب من نسب المئوية المخزَّنة (دقّة 1e-4) عند العميل.
                if client_amount is not None:
                    tol = max(0.05, round(float(amounts["gross"]) * 0.002, 2))
                    if abs(client_amount - amounts["refund_amount"]) > tol:
                        raise ReturnError("return_amount_exceeded", 400)

                track_stock = raw.get("trackStock")
                if track_stock is None:
                    track_stock = raw.get("track_stock")
                clean_items.append({
                    "itemId": item_id,
                    "name": str(line.get("name") or ""),
                    "quantity": qty,
                    "price": _round2(line.get("price")),
                    "discountAmount": amounts["discount_amount"],
                    "taxAmount": amounts["tax_amount"],
                    "refundAmount": amounts["refund_amount"],
                    "returnable": bool(raw.get("returnable")),
                    "trackStock": bool(track_stock),
                    "type": str(raw.get("type") or "service"),
                    "restocked": bool(raw.get("restocked")),
                })
                refund_total = _round2(refund_total + amounts["refund_amount"])

            if refund_total <= 0:
                raise ReturnError("return_no_items", 400)

            client_total = _round2(payload.get("refund_amount"))
            total_tol = max(0.05, _round2(inv.get("subtotal")) * 0.002)
            if abs(client_total - refund_total) > total_tol:
                raise ReturnError("return_amount_exceeded", 400)

            # أجزاء رد المبلغ
            raw_parts = payload.get("refund_parts") if isinstance(payload.get("refund_parts"), list) else []
            parts: List[Dict[str, Any]] = []
            for part in raw_parts:
                if not isinstance(part, dict):
                    raise ReturnError("return_parts_mismatch", 400)
                method = str(part.get("method") or "").strip().lower()
                if method not in _PART_METHODS:
                    raise ReturnError("return_parts_mismatch", 400)
                amount = _round2(part.get("amount"))
                if amount < 0:
                    raise ReturnError("return_negative", 400)
                if amount > 0:
                    parts.append({"method": method, "amount": amount})
            parts_sum = _round2(sum(p["amount"] for p in parts))
            if abs(parts_sum - refund_total) > 0.01:
                raise ReturnError("return_parts_mismatch", 400)

            paid = _paid_by_method(inv)
            for part in parts:
                # الحد المسموح = ما دُفع لكل طريقة − ما رُدَّ سابقاً بنفس الطريقة
                allowed = _round2(_round2(paid.get(part["method"])) - prior_refunded.get(part["method"], 0.0))
                if part["amount"] > allowed + 0.01:
                    raise ReturnError("return_cash_exceeds_paid", 400)
            cash_refund = _round2(sum(p["amount"] for p in parts if p["method"] == "cash"))

            # كامل = رُجعت كل بنود الفاتورة بالكامل بعد هذه العملية
            ret_type = "full"
            for line in inv.get("items") or []:
                key = str(line.get("itemId") or "")
                got = int(line.get("quantity") or 0)
                already = int(returned_qty.get(key, 0)) + sum(
                    i["quantity"] for i in clean_items if i["itemId"] == key
                )
                if already < got:
                    ret_type = "partial"
                    break

            status = str(payload.get("status") or "approved").strip().lower()
            if status not in ("pending", "approved"):
                status = "approved"
            date = normalize_date(payload.get("date"), int(payload.get("timestamp") or 0))
            return_id = f"{inv_key}:ret:{uid}"

            conn.execute(
                """INSERT OR IGNORE INTO returns
                   (id, uid, invoice_uid, invoice_id, items_json, refund_amount, refund_parts,
                    cash_refund, type, status, reason, notes, staff_id, staff_name, created_by,
                    customer_id, customer_name, location_id, points_reversed, commission_reversed,
                    date, timestamp, created_at, updated_at, deleted)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    return_id,
                    uid,
                    inv_key,
                    int(payload.get("invoice_id") or 0),
                    json.dumps(clean_items, ensure_ascii=False),
                    refund_total,
                    json.dumps(parts, ensure_ascii=False),
                    cash_refund,
                    ret_type,
                    status,
                    str(payload.get("reason") or ""),
                    str(payload.get("notes") or ""),
                    str(payload.get("staff_id") or ""),
                    str(payload.get("staff_name") or ""),
                    str(payload.get("created_by") or ""),
                    int(payload.get("customer_id") or 0),
                    str(payload.get("customer_name") or ""),
                    str(payload.get("location_id") or ""),
                    int(payload.get("points_reversed") or 0),
                    _round2(payload.get("commission_reversed")),
                    date,
                    int(payload.get("timestamp") or now_ms),
                    _now(),
                    int(payload.get("updated_at") or now_ms),
                    int(payload.get("deleted") or 0),
                ),
            )
            row = conn.execute("SELECT * FROM returns WHERE uid = ?", (uid,)).fetchone()
            conn.commit()
            if row is None:
                raise ReturnError("return_conflict", 409)
            return {"is_new": True, **_return_row(row)}
        except BaseException:
            try:
                if conn.in_transaction:
                    conn.rollback()
            except Exception:  # noqa: BLE001
                pass
            raise


def list_returns(since: int = 0, page: int = 1, page_size: int = 50,
                 invoice_uid: str = "", include_deleted: bool = False) -> Dict[str, Any]:
    """قائمة المرتجعات — منذ وقت آخر تعديل (للمزامنة التنازلية بين الأجهزة)."""
    conn = get_conn()
    where: List[str] = []
    params: List[Any] = []
    if since:
        where.append("updated_at > ?")
        params.append(int(since))
    elif not include_deleted:
        where.append("deleted = 0")
    if invoice_uid:
        where.append("invoice_uid = ?")
        params.append(invoice_uid)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    page = max(1, int(page or 1))
    page_size = max(1, min(200, int(page_size or 50)))

    total = conn.execute(f"SELECT COUNT(*) c FROM returns {clause}", params).fetchone()["c"]
    rows = conn.execute(
        f"SELECT * FROM returns {clause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?",
        params + [page_size, (page - 1) * page_size],
    ).fetchall()
    items = [_return_row(r) for r in rows]
    return {"total": total, "page": page, "page_size": page_size, "returns": items}


def search_customers(q: str = "", limit: int = 30) -> List[Dict[str, Any]]:
    conn = get_conn()
    limit = max(1, min(100, limit))
    if q:
        like = f"%{q}%"
        rows = conn.execute(
            """SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR CAST(id AS TEXT) = ?
               ORDER BY total_spent DESC LIMIT ?""",
            (like, like, q, limit),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM customers ORDER BY total_spent DESC LIMIT ?", (limit,)).fetchall()
    if rows:
        return [dict(r) for r in rows]

    # fallback: عملاء محليين من الفواتير لو جدول العملاء فاضي
    rows = conn.execute(
        """SELECT customer_name AS name, phone, COUNT(*) AS invoices, SUM(total) AS total_spent
           FROM invoices WHERE customer_name != '' AND customer_name != 'Guest' AND deleted = 0
           GROUP BY customer_name, phone ORDER BY total_spent DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def summary(date_from: str = "", date_to: str = "") -> Dict[str, Any]:
    conn = get_conn()
    where, params = ["deleted = 0"], []
    if date_from:
        where.append("date >= ?")
        params.append(date_from)
    if date_to:
        where.append("date <= ?")
        params.append(date_to)
    clause = "WHERE " + " AND ".join(where)
    row = conn.execute(
        f"""SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS sales,
                   COALESCE(SUM(discount),0) AS discounts, COALESCE(SUM(tax),0) AS taxes
            FROM invoices {clause}""",
        params,
    ).fetchone()
    by_method = conn.execute(
        f"SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total),0) AS sales FROM invoices {clause} GROUP BY payment_method",
        params,
    ).fetchall()
    # المبيعات النقدية = جزء الدفع النقدي فقط (للفواتير المختلطة لا يُحتسب غير النقدي)
    cash_rows = conn.execute(
        f"SELECT total, payment_method, payment_json FROM invoices {clause}",
        params,
    ).fetchall()
    cash_sales = round(
        sum(_cash_amount(r["total"], r["payment_method"], r["payment_json"]) for r in cash_rows), 2
    )
    # المرتجعات المعتمدة في نفس النطاق (تُخصم من المبيعات ومن الدرج نقداً)
    ret_where, ret_params = ["deleted = 0", "status = 'approved'"], []
    if date_from:
        ret_where.append("date >= ?")
        ret_params.append(date_from)
    if date_to:
        ret_where.append("date <= ?")
        ret_params.append(date_to)
    ret_clause = "WHERE " + " AND ".join(ret_where)
    ret = conn.execute(
        f"SELECT COUNT(*) AS returns, COALESCE(SUM(refund_amount),0) AS refund_total, "
        f"COALESCE(SUM(cash_refund),0) AS cash_refunds FROM returns {ret_clause}",
        ret_params,
    ).fetchone()
    returns_total = round(float(ret["refund_total"] or 0), 2)
    sales = round(float(row["sales"] or 0), 2)
    return {
        "date_from": date_from,
        "date_to": date_to,
        "invoices": row["invoices"],
        "sales": sales,
        "cash_sales": cash_sales,
        "returns": ret["returns"],
        "returns_total": returns_total,
        "cash_refunds": round(float(ret["cash_refunds"] or 0), 2),
        "net_sales": round(sales - returns_total, 2),
        "discounts": row["discounts"],
        "taxes": row["taxes"],
        "by_payment_method": [dict(r) for r in by_method],
    }


def daily_series(days: int = 30) -> List[Dict[str, Any]]:
    conn = get_conn()
    days = max(1, min(365, days))
    rows = conn.execute(
        """SELECT date, COUNT(*) AS invoices, COALESCE(SUM(total),0) AS sales
           FROM invoices WHERE date != '' AND deleted = 0
           GROUP BY date ORDER BY date DESC LIMIT ?""",
        (days,),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def monthly_series(months: int = 12) -> List[Dict[str, Any]]:
    conn = get_conn()
    months = max(1, min(60, months))
    rows = conn.execute(
        """SELECT substr(date,1,7) AS month, COUNT(*) AS invoices, COALESCE(SUM(total),0) AS sales
           FROM invoices WHERE date != '' AND deleted = 0
           GROUP BY month ORDER BY month DESC LIMIT ?""",
        (months,),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def log_email(invoice_id: str, recipient: str, subject: str, body: str,
              mode: str, status: str, error: str = "") -> None:
    conn = get_conn()
    with _lock:
        conn.execute(
            "INSERT INTO email_log (invoice_id, recipient, subject, body, mode, status, error, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (invoice_id, recipient, subject, body, mode, status, error, _now()),
        )
        conn.commit()


def list_email_log(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM email_log ORDER BY id DESC LIMIT ?", (max(1, min(200, limit)),)).fetchall()
    return [dict(r) for r in rows]


def stats_overview() -> Dict[str, Any]:
    conn = get_conn()
    invoices = conn.execute("SELECT COUNT(*) c FROM invoices WHERE deleted = 0").fetchone()["c"]
    sales = conn.execute("SELECT COALESCE(SUM(total),0) s FROM invoices WHERE deleted = 0").fetchone()["s"]
    customers = conn.execute("SELECT COUNT(*) c FROM customers").fetchone()["c"]
    return {"invoices": invoices, "sales": sales, "customers": customers}
