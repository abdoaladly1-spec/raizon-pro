import io
import sys

# معالجة بيئة PyInstaller بدون نافذة كونسول (console=False / runw.exe)
# حيث تكون sys.stdout و sys.stderr و sys.stdin مساوية لـ None لمنع خطأ isatty
class _SafeStream(io.StringIO):
    def isatty(self):
        return False
    def flush(self):
        pass
    def write(self, s):
        pass

if sys.stdout is None or not hasattr(sys.stdout, "isatty"):
    sys.stdout = _SafeStream()
if sys.stderr is None or not hasattr(sys.stderr, "isatty"):
    sys.stderr = _SafeStream()
if sys.stdin is None:
    sys.stdin = _SafeStream()

"""سيرفر ProCashier المركزي - FastAPI + SQLite + إشعارات Gmail.

تشغيل:
    python main.py
    أو: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from typing import Any, Dict, List, Optional, Tuple

import hmac
import json
import socket
import threading
import time
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path

from fastapi import BackgroundTasks, Body, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import config
import database
import emailer
from config import API_KEY, BACKUP_DIR, HOST, NOTIFY_ON_INVOICE, PORT, email_mode

BACKUP_KEEP = 2

app = FastAPI(title="ProCashier Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # التطبيق يعمل من file:// (Origin: null) ومن الويب المحلي؛ لا نعتمد على Origin
    # للحماية — الحماية الفعلية عبر X-API-Key.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ Rate limit
class SlidingWindowLimiter:
    """محدِّد معدل بسيط في الذاكرة (بدون اعتماديات خارجية).

    ملاحظة: العدّاد لكل عملية (process) — كافٍ لسيرفر محلي/مكتب واحد.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: Dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return False
            bucket.append(now)
            return True


# طلبات مسيئة للمصادقة: 30 محاولة فاشلة كل دقيقة لكل IP
AUTH_FAIL_LIMITER = SlidingWindowLimiter(limit=30, window_seconds=60)
# سقف عام لكل IP: 300 طلب كل دقيقة
GENERAL_LIMITER = SlidingWindowLimiter(limit=300, window_seconds=60)


def client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = client_ip(request)
    if not GENERAL_LIMITER.allow(ip):
        return JSONResponse({"detail": "Too many requests"}, status_code=429)
    return await call_next(request)


# ------------------------------------------------------------------ Auth
def require_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
) -> None:
    if not API_KEY:
        return
    client_host = request.client.host if request.client else ""
    if client_host in ("127.0.0.1", "::1", "localhost", "testclient"):
        return
    provided = (x_api_key or "").strip()
    # مقارنة ثابتة الزمن لمنع استنتاج المفتاح من فروق التوقيت
    if not provided or not hmac.compare_digest(provided, API_KEY):
        if not AUTH_FAIL_LIMITER.allow(client_ip(request)):
            raise HTTPException(status_code=429, detail="Too many failed attempts")
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")



# ------------------------------------------------------------------ Models
class InvoiceIn(BaseModel):
    id: Optional[Any] = None
    uid: Optional[str] = None
    local_id: Optional[int] = None
    client_key: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    subtotal: float = 0
    discount: float = 0
    tax: float = 0
    total: float = 0
    payment_method: str = "cash"
    # تفاصيل الدفع المختلط (اختيارية — الفواتير القديمة ترسلها null)
    payment_parts: Optional[List[Dict[str, Any]]] = None
    cash_paid: Optional[float] = None
    received: Optional[float] = None
    change: Optional[float] = None
    status: str = "paid"
    staff_name: Optional[str] = None
    created_by: Optional[str] = None
    location_id: Optional[str] = None
    branch_name: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None
    timestamp: Optional[int] = None
    time: Optional[str] = None


class BatchIn(BaseModel):
    invoices: List[InvoiceIn] = Field(default_factory=list)
    customers: List[Dict[str, Any]] = Field(default_factory=list)


class CustomerIn(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    total_spent: float = 0
    last_visit: str = ""
    loyalty_points: int = 0
    tier: str = "Bronze"


class ReturnIn(BaseModel):
    """سجل مرتجع (جزئي/كامل) — uid ثابت لمنع التكرار بين الأجهزة."""
    uid: Optional[str] = None
    id: Optional[Any] = None
    invoice_uid: Optional[str] = None
    invoice_id: Optional[int] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    refund_amount: float = 0
    refund_parts: List[Dict[str, Any]] = Field(default_factory=list)
    cash_refund: float = 0
    type: str = "partial"
    status: str = "approved"
    reason: str = ""
    notes: Optional[str] = None
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    created_by: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    location_id: Optional[str] = None
    branch_name: Optional[str] = None
    points_reversed: int = 0
    commission_reversed: float = 0
    date: Optional[str] = None
    timestamp: Optional[int] = None
    updated_at: Optional[int] = None
    deleted: int = 0


ALLOWED_PAYMENT_METHODS = ("cash", "card", "wallet", "instapay", "credit", "visa")


def _validate_payment(data: Dict[str, Any]) -> None:
    """يتحقق من الدفع المختلط قبل الحفظ (مبالغ موجبة + مجموع == الإجمالي + مستلم كافٍ)."""
    parts = data.get("payment_parts")
    if parts is None:
        return
    if not isinstance(parts, list) or not parts:
        raise HTTPException(status_code=400, detail="payment_no_parts")
    total = round(float(data.get("total") or 0), 2)
    cleaned: List[Tuple[str, float]] = []
    for part in parts:
        if not isinstance(part, dict):
            raise HTTPException(status_code=400, detail="payment_invalid_part")
        method = str(part.get("method") or "").strip().lower()
        if method not in ALLOWED_PAYMENT_METHODS:
            raise HTTPException(status_code=400, detail="payment_invalid_part")
        try:
            amount = float(part.get("amount") or 0)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="payment_invalid_part") from exc
        if amount < 0:
            raise HTTPException(status_code=400, detail="payment_negative")
        cleaned.append((method, round(amount, 2)))
    if not cleaned:
        raise HTTPException(status_code=400, detail="payment_no_parts")
    amount_sum = round(sum(amount for _, amount in cleaned), 2)
    if abs(amount_sum - total) > 0.01:
        raise HTTPException(status_code=400, detail="payment_sum_mismatch")
    cash_part = round(sum(amount for method, amount in cleaned if method == "cash"), 2)
    received = data.get("received")
    if received is not None and str(received).strip() != "":
        try:
            received_amount = round(float(received), 2)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="payment_invalid_part") from exc
        if received_amount + 0.01 < cash_part:
            raise HTTPException(status_code=400, detail="payment_received_short")
    data["payment_parts"] = [{"method": m, "amount": a} for m, a in cleaned]
    if data.get("cash_paid") is None:
        data["cash_paid"] = cash_part


def _normalize(inv: InvoiceIn) -> Dict[str, Any]:
    data = inv.model_dump()
    local_id = data.get("local_id") if data.get("local_id") is not None else data.get("id")
    data["local_id"] = int(local_id) if local_id is not None else None
    # الهوية الثابتة: uid (UUID من الجهاز) ثم client_key ثم مفتاح قديم للتوافق
    key = (
        data.get("uid")
        or data.get("client_key")
        or f"{data.get('location_id', '')}:{local_id}:{data.get('timestamp', 0)}"
    )
    data["uid"] = str(key)
    data["id"] = str(key)
    # تاريخ موحّد YYYY-MM-DD (يقبل ISO و DD/MM/YYYY legacy) لصالح فلاتر النطاق
    data["date"] = database.normalize_date(data.get("date"), data.get("timestamp") or 0)
    _validate_payment(data)
    return data


def _store(inv: InvoiceIn) -> Dict[str, Any]:
    data = _normalize(inv)
    is_new = database.insert_invoice(data)
    if is_new and config.NOTIFY_ON_INVOICE:
        try:
            emailer.send_invoice_notification(data)
        except Exception as exc:  # noqa: BLE001
            print(f"[EMAIL][ERROR] {exc}")
    data["is_new"] = is_new
    return data


# ------------------------------------------------------------------ Routes
def lan_urls() -> List[str]:
    """روابط يصل منها الهاتف/الأجهزة الأخرى إلى السيرفر على الشبكة المحلية."""
    ips: List[str] = []

    def _add(ip: str) -> None:
        if ip and not ip.startswith("127.") and ip not in ips:
            ips.append(ip)

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            _add(info[4][0])
    except OSError:
        pass

    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        _add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass

    return [f"http://{ip}:{PORT}" for ip in ips]


@app.get("/")
def root():
    return {
        "service": "ProCashier Server",
        "status": "ok",
        "email_mode": email_mode(),
        "endpoints": [
            "GET  /health",
            "POST /api/invoices",
            "POST /api/invoices/batch",
            "GET  /api/invoices",
            "GET  /api/invoices/{id}",
            "GET  /api/stats/summary",
            "GET  /api/stats/daily",
            "GET  /api/stats/monthly",
            "GET  /api/customers",
            "GET  /api/emails",
        ],
    }


@app.get("/health")
def health():
    try:
        database.stats_overview()
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"
    return {
        "status": "ok",
        "database": db_status,
        "email_mode": email_mode(),
        "lan_urls": lan_urls(),
        "auth_required": bool(API_KEY),
    }


@app.post("/api/invoices", dependencies=[Depends(require_api_key)])
def create_invoice(inv: InvoiceIn, background: BackgroundTasks):
    data = _store(inv)
    return {"ok": True, "is_new": data["is_new"], "id": data["id"]}


@app.post("/api/invoices/batch", dependencies=[Depends(require_api_key)])
def create_invoices_batch(batch: BatchIn):
    created = []
    for c in batch.customers:
        database.upsert_customer(c)
    for inv in batch.invoices:
        data = _store(inv)
        if data["is_new"]:
            created.append(data["id"])
    return {"ok": True, "received": len(batch.invoices), "created": len(created), "ids": created}


@app.get("/api/invoices", dependencies=[Depends(require_api_key)])
def get_invoices(
    search: str = Query(default=""),
    date_from: str = Query(default="", alias="date_from"),
    date_to: str = Query(default=""),
    since: int = Query(default=0, ge=0, description="updated_at ms - ما تغيّر بعد هذا الوقت (تحديثات وإلغاءات وليس جدداً فقط)"),
    include_deleted: bool = Query(default=False, description="إظهار الحذف المنطقي (tombstones)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    return database.list_invoices(search=search, date_from=date_from, date_to=date_to,
                                  since=since, page=page, page_size=page_size,
                                  include_deleted=include_deleted)


@app.get("/api/invoices/{invoice_id}", dependencies=[Depends(require_api_key)])
def get_invoice(invoice_id: str):
    inv = database.get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@app.delete("/api/invoices/{invoice_id}", dependencies=[Depends(require_api_key)])
def delete_invoice(invoice_id: str):
    """حذف منطقي موثّق (لا حذف فيزيائي) — الفاتورة المدفوعة تبقى مرجعية حسابية."""
    updated_at = database.soft_delete_invoice(invoice_id)
    if updated_at is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"ok": True, "id": invoice_id, "deleted": True, "updated_at": updated_at}


@app.get("/api/stats/summary", dependencies=[Depends(require_api_key)])
def stats_summary(date_from: str = "", date_to: str = ""):
    return database.summary(date_from=date_from, date_to=date_to)


# ------------------------------------------------------------------ المرتجعات
@app.post("/api/returns", dependencies=[Depends(require_api_key)])
def create_return(ret: ReturnIn):
    """إنشاء/تأكيد مرتجع. التحقق (كمية/مبلغ/أدلة الدفع) داخل معاملة واحدة.

    409 = تعارض كمية مع جهاز آخر، 404 = الفاتورة غير موجودة، 400 = بيانات غير صالحة.
    """
    try:
        data = database.create_return(ret.model_dump())
    except database.ReturnError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
    is_new = data.pop("is_new", True)
    if is_new and getattr(config, "NOTIFY_ON_RETURN", True):
        try:
            emailer.send_return_notification(data)
        except Exception as exc:
            print(f"[EMAIL][RETURN_ERROR] {exc}")
    return {"ok": True, "is_new": is_new, **data}


@app.get("/api/returns", dependencies=[Depends(require_api_key)])
def list_returns(
    since: int = Query(default=0, ge=0),
    invoice: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    include_deleted: bool = False,
):
    """قائمة المرتجعات مع دعم المزامنة التنازلية (?since= وقت آخر تعديل)."""
    return database.list_returns(
        since=since, page=page, page_size=page_size,
        invoice_uid=invoice, include_deleted=include_deleted,
    )


@app.get("/api/stats/daily", dependencies=[Depends(require_api_key)])
def stats_daily(days: int = Query(default=30, ge=1, le=365)):
    return {"days": days, "series": database.daily_series(days)}


@app.get("/api/stats/monthly", dependencies=[Depends(require_api_key)])
def stats_monthly(months: int = Query(default=12, ge=1, le=60)):
    return {"months": months, "series": database.monthly_series(months)}


@app.get("/api/customers", dependencies=[Depends(require_api_key)])
def customers(q: str = "", limit: int = Query(default=30, ge=1, le=100)):
    return {"results": database.search_customers(q=q, limit=limit)}


@app.post("/api/customers", dependencies=[Depends(require_api_key)])
def upsert_customer(customer: CustomerIn):
    database.upsert_customer(customer.model_dump())
    return {"ok": True}


@app.get("/api/emails", dependencies=[Depends(require_api_key)])
def emails(limit: int = Query(default=50, ge=1, le=200)):
    return {"mode": email_mode(), "log": database.list_email_log(limit)}


@app.get("/api/email/config", dependencies=[Depends(require_api_key)])
class ExpenseIn(BaseModel):
    id: Optional[str] = None
    title: str = ""
    amount: float = 0
    category: str = "other"
    date: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    timestamp: Optional[int] = None


@app.post("/api/expenses", dependencies=[Depends(require_api_key)])
def submit_expense(expense: ExpenseIn):
    """استلام حركة المصروف وإرسال إشعار فوري للمدير عبر البريد."""
    data = expense.model_dump()
    res = {"status": "skipped"}
    if getattr(config, "NOTIFY_ON_EXPENSE", True):
        try:
            res = emailer.send_expense_notification(data)
        except Exception as exc:
            print(f"[EMAIL][EXPENSE_ERROR] {exc}")
    return {"ok": True, "email": res}


def get_email_config(request: Request):
    import config
    client_host = request.client.host if request.client else ""
    is_local = client_host in ("127.0.0.1", "::1", "localhost", "testclient")
    return {
        "ok": True,
        "smtp_user": config.SMTP_USER,
        "email_to": config.EMAIL_TO,
        "notify_on_invoice": getattr(config, "NOTIFY_ON_INVOICE", True),
        "notify_on_closing": getattr(config, "NOTIFY_ON_CLOSING", True),
        "notify_on_return": getattr(config, "NOTIFY_ON_RETURN", True),
        "notify_on_expense": getattr(config, "NOTIFY_ON_EXPENSE", True),
        "mode": config.email_mode(),
        "has_password": bool(config.SMTP_PASSWORD),
        "api_key": API_KEY if is_local else None,
    }


@app.post("/api/email/config", dependencies=[Depends(require_api_key)])
def set_email_config(payload: Dict[str, Any] = Body(...)):
    import config
    smtp_user = str(payload.get("smtp_user", "")).strip()
    smtp_password = str(payload.get("smtp_password", "")).strip()
    email_to = str(payload.get("email_to", "")).strip()
    notify_on_invoice = bool(payload.get("notify_on_invoice", True))
    notify_on_closing = bool(payload.get("notify_on_closing", True))
    notify_on_return = bool(payload.get("notify_on_return", True))
    notify_on_expense = bool(payload.get("notify_on_expense", True))

    if not smtp_user:
        smtp_user = config.SMTP_USER or "rizon.pro.app@gmail.com"
    if not smtp_password:
        smtp_password = config.SMTP_PASSWORD or "udgddndyondosvxk"

    config.SMTP_USER = smtp_user
    config.EMAIL_FROM = smtp_user
    config.SMTP_PASSWORD = smtp_password
    if email_to:
        config.EMAIL_TO = email_to
    config.NOTIFY_ON_INVOICE = notify_on_invoice
    config.NOTIFY_ON_CLOSING = notify_on_closing
    config.NOTIFY_ON_RETURN = notify_on_return
    config.NOTIFY_ON_EXPENSE = notify_on_expense
    if config.SMTP_USER and config.SMTP_PASSWORD and config.EMAIL_TO:
        config.EMAIL_MODE = "auto"

    env_file = config.ENV_FILE
    raw = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
    settings_dict = {}
    for line in raw.splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            settings_dict[k.strip()] = v.strip()

    if smtp_user:
        settings_dict["SMTP_USER"] = smtp_user
        settings_dict["EMAIL_FROM"] = smtp_user
    if smtp_password:
        settings_dict["SMTP_PASSWORD"] = smtp_password
    if email_to:
        settings_dict["EMAIL_TO"] = email_to
    settings_dict["NOTIFY_ON_INVOICE"] = "true" if notify_on_invoice else "false"
    settings_dict["NOTIFY_ON_CLOSING"] = "true" if notify_on_closing else "false"
    settings_dict["NOTIFY_ON_RETURN"] = "true" if notify_on_return else "false"
    settings_dict["NOTIFY_ON_EXPENSE"] = "true" if notify_on_expense else "false"
    settings_dict["EMAIL_MODE"] = "auto"

    new_content = [f"{k}={v}" for k, v in settings_dict.items()]
    env_file.write_text("\n".join(new_content) + "\n", encoding="utf-8")

    return {
        "ok": True,
        "mode": config.email_mode(),
        "smtp_user": config.SMTP_USER,
        "email_to": config.EMAIL_TO,
        "notify_on_invoice": config.NOTIFY_ON_INVOICE,
        "notify_on_closing": config.NOTIFY_ON_CLOSING,
        "notify_on_return": config.NOTIFY_ON_RETURN,
        "notify_on_expense": config.NOTIFY_ON_EXPENSE,
        "has_password": bool(config.SMTP_PASSWORD)
    }



@app.post("/api/closing", dependencies=[Depends(require_api_key)])
def submit_closing_report(report: Dict[str, Any] = Body(...)):
    """استلام تقرير إقفال الوردية وإرسال إشعار فوري للمدير عبر البريد."""
    res = {"status": "skipped"}
    try:
        res = emailer.send_closing_notification(report)
    except Exception as exc:
        print(f"[EMAIL][CLOSING_ERROR] {exc}")
    return {"ok": True, "email": res}


@app.post("/api/email/test", dependencies=[Depends(require_api_key)])
def send_test_email(payload: Dict[str, Any] = Body(default={})):
    service = str(payload.get("service") or payload.get("type") or "invoice").lower()

    if service == "closing":
        test_rep = {
            "id": "TEST-CLOSE",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "performedBy": "كاشير المحل",
            "openingBalance": 500.0,
            "cashSales": 2450.0,
            "totalExpenses": 150.0,
            "expectedCash": 2800.0,
            "actualCash": 2800.0,
            "difference": 0.0,
            "status": "matched",
            "notes": "إشعار تجريبي لتقفيل وردية الكاشير بنجاح"
        }
        return emailer.send_closing_notification(test_rep)

    if service == "return":
        test_ret = {
            "uid": "TEST-RET",
            "invoice_id": 9999,
            "refund_amount": 150.0,
            "cash_refund": 150.0,
            "customer_name": "عميل تجريبي للإيميل",
            "staff_name": "كاشير المحل",
            "reason": "تجربة إشعار المرتجع والاسترداد",
            "type": "full",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "items": [{"name": "قص شعر واستشوار", "quantity": 1, "price": 150.0}]
        }
        return emailer.send_return_notification(test_ret)

    if service == "expense":
        test_exp = {
            "id": "TEST-EXP",
            "title": "فاتورة كهرباء ومصروفات تشغيل",
            "amount": 180.0,
            "category": "مرافق وخدمات",
            "created_by": "كاشير المحل",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M"),
            "notes": "تجربة إشعار المصروفات النقدية الفورية"
        }
        return emailer.send_expense_notification(test_exp)
    """إرسال إيميل تجريبي للمدير للتحقق من الاتصال."""
    test_inv = {
        "id": "TEST",
        "local_id": "9999",
        "customer_name": "عميل تجريبي للإيميل",
        "phone": "01026695879",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M"),
        "created_by": "كاشير المحل",
        "payment_method": "cash",
        "items": [{"name": "قص شعر واستشوار", "quantity": 1, "price": 150.0}],
        "subtotal": 150.0,
        "discount": 0.0,
        "tax": 0.0,
        "total": 150.0
    }
    return emailer.send_invoice_notification(test_inv)

def apply_email_config_from_payload(payload: Dict[str, Any]):
    """استرجاع بريد المدير وإعدادات الإشعارات من النسخة الاحتياطية وتفعيلها فوراً."""
    import config
    if not isinstance(payload, dict):
        return
    cfg = payload.get("emailConfig") or payload.get("settings", {}).get("emailConfig") or {}
    email_to = cfg.get("emailTo") or cfg.get("email_to") or payload.get("managerEmail") or payload.get("settings", {}).get("managerEmail") or ""
    
    if email_to:
        config.EMAIL_TO = str(email_to).strip()
        if "notifyOnInvoice" in cfg:
            config.NOTIFY_ON_INVOICE = bool(cfg["notifyOnInvoice"])
        elif "notify_on_invoice" in cfg:
            config.NOTIFY_ON_INVOICE = bool(cfg["notify_on_invoice"])
            
        if "notifyOnClosing" in cfg:
            config.NOTIFY_ON_CLOSING = bool(cfg["notifyOnClosing"])
        elif "notify_on_closing" in cfg:
            config.NOTIFY_ON_CLOSING = bool(cfg["notify_on_closing"])

        if "notifyOnReturn" in cfg:
            config.NOTIFY_ON_RETURN = bool(cfg["notifyOnReturn"])
        elif "notify_on_return" in cfg:
            config.NOTIFY_ON_RETURN = bool(cfg["notify_on_return"])

        if "notifyOnExpense" in cfg:
            config.NOTIFY_ON_EXPENSE = bool(cfg["notifyOnExpense"])
        elif "notify_on_expense" in cfg:
            config.NOTIFY_ON_EXPENSE = bool(cfg["notify_on_expense"])

        config.EMAIL_MODE = "auto"

        # حفظ دائم في server.env
        try:
            env_file = config.ENV_FILE
            raw = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
            settings_dict = {}
            for line in raw.splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.partition("=")
                    settings_dict[k.strip()] = v.strip()
            settings_dict["EMAIL_TO"] = config.EMAIL_TO
            settings_dict["NOTIFY_ON_INVOICE"] = "true" if config.NOTIFY_ON_INVOICE else "false"
            settings_dict["NOTIFY_ON_CLOSING"] = "true" if config.NOTIFY_ON_CLOSING else "false"
            settings_dict["NOTIFY_ON_RETURN"] = "true" if config.NOTIFY_ON_RETURN else "false"
            settings_dict["NOTIFY_ON_EXPENSE"] = "true" if config.NOTIFY_ON_EXPENSE else "false"
            settings_dict["EMAIL_MODE"] = "auto"
            lines = [f"{k}={v}" for k, v in settings_dict.items()]
            env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
            print(f"[RESTORE] Manager email restored successfully: {config.EMAIL_TO}")
        except Exception as e:
            print(f"[RESTORE][ERROR] Failed to write env_file: {e}")

# ------------------------------------------------------------------ Backup (نسخ احتياطي محلي وسحابي)
@app.post("/api/backup", dependencies=[Depends(require_api_key)])
def save_backup(payload: Dict[str, Any] = Body(...), send_email: bool = True):
    """يستقبل نسخة من حالة التطبيق ويخزنها كملف JSON في مجلد Backup، ويرسلها بالبريد للمدير سحابياً."""
    try:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        
        # إدراج بريد المدير وإعدادات الإشعارات ضمن النسخة الاحتياطية
        email_info = {
            "emailTo": config.EMAIL_TO or "",
            "notifyOnInvoice": getattr(config, "NOTIFY_ON_INVOICE", True),
            "notifyOnClosing": getattr(config, "NOTIFY_ON_CLOSING", True),
            "notifyOnReturn": getattr(config, "NOTIFY_ON_RETURN", True),
            "notifyOnExpense": getattr(config, "NOTIFY_ON_EXPENSE", True),
            "smtpUser": config.SMTP_USER or "rizon.pro.app@gmail.com"
        }
        if isinstance(payload, dict):
            client_email = (payload.get("settings", {}) or {}).get("emailConfig", {}).get("emailTo") or (payload.get("settings", {}) or {}).get("managerEmail") or payload.get("managerEmail")
            if client_email:
                email_info["emailTo"] = str(client_email).strip()
                config.EMAIL_TO = email_info["emailTo"]
            if "settings" in payload and isinstance(payload["settings"], dict):
                payload["settings"]["emailConfig"] = email_info
                payload["settings"]["managerEmail"] = email_info["emailTo"]
            payload["emailConfig"] = email_info
            payload["managerEmail"] = email_info["emailTo"]

        data = json.dumps(payload, ensure_ascii=False, indent=2)
        data_bytes = data.encode("utf-8")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"rizon_backup_{stamp}.json"

        # حفظ دائم في مجلد Backup
        (BACKUP_DIR / "appstate-latest.json").write_text(data, encoding="utf-8")
        (BACKUP_DIR / filename).write_text(data, encoding="utf-8")

        # الاحتفاظ بآخر نسختين فقط وحذف ما قبلهما لتوفير المساحة وعدم تراكم الملفات مع الوقت
        try:
            all_backups = sorted(
                [p for p in BACKUP_DIR.glob("rizon_backup_*.json") if p.is_file()],
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            for old_file in all_backups[BACKUP_KEEP:]:
                try:
                    old_file.unlink()
                    print(f"[BACKUP] Pruned older backup: {old_file.name} to keep only latest {BACKUP_KEEP}")
                except Exception as del_err:
                    print(f"[BACKUP] Error pruning {old_file}: {del_err}")
        except Exception as prune_err:
            print(f"[BACKUP] Pruning scan failed: {prune_err}")

        invoices_count = len(payload.get("invoices", []))
        items_count = len(payload.get("items", []))
        customers_count = len(payload.get("customers", []))
        size_kb = len(data_bytes) / 1024.0

        email_res = {"status": "skipped"}
        if send_email and getattr(config, "EMAIL_TO", ""):
            summary = {
                "filename": filename,
                "size_kb": size_kb,
                "invoices_count": invoices_count,
                "items_count": items_count,
                "customers_count": customers_count,
                "performed_by": payload.get("currentUser", {}).get("name") if isinstance(payload.get("currentUser"), dict) else "مدير النظام"
            }
            try:
                email_res = emailer.send_backup_notification(data_bytes, filename, summary)
            except Exception as e:
                print(f"[EMAIL][BACKUP_ERROR] {e}")
                email_res = {"status": "error", "error": str(e)}

        return {
            "ok": True,
            "filename": filename,
            "bytes": len(data_bytes),
            "size_kb": round(size_kb, 1),
            "saved_at": stamp,
            "email": email_res
        }
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"backup write failed: {exc}") from exc


@app.get("/api/backup", dependencies=[Depends(require_api_key)])
def load_backup():
    """يرجّع آخر نسخة احتياطية محفوظة."""
    path = BACKUP_DIR / "appstate-latest.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="لا توجد نسخة احتياطية محفوظة")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"backup read failed: {exc}") from exc
    return {"ok": True, "state": state, "modified_at": path.stat().st_mtime}


@app.get("/api/backup/list", dependencies=[Depends(require_api_key)])
def list_backups():
    """عرض قائمة بملفات النسخ الاحتياطية المتوفرة في مجلد Backup."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in sorted(BACKUP_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.name == "appstate-latest.json":
            continue
        stat = p.stat()
        dt = datetime.fromtimestamp(stat.st_mtime)
        files.append({
            "filename": p.name,
            "size_kb": round(stat.st_size / 1024.0, 1),
            "modified_at": stat.st_mtime,
            "date_str": dt.strftime("%Y-%m-%d %I:%M %p")
        })
    return {"ok": True, "backups": files, "count": len(files)}


@app.get("/api/backup/restore/{filename}", dependencies=[Depends(require_api_key)])
def restore_backup_by_filename(filename: str):
    """استرجاع نسخة احتياطية محددة بالاسم من مجلد Backup."""
    clean_name = Path(filename).name
    path = BACKUP_DIR / clean_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
        apply_email_config_from_payload(state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"فشل قراءة الملف: {exc}") from exc
    return {"ok": True, "state": state, "filename": clean_name}


if __name__ == "__main__":
    import uvicorn

    database.get_conn()

    # إعداد log_config آمن يمنع خطأ AttributeError: 'NoneType' object has no attribute 'isatty'
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    if "formatters" in log_config:
        if "default" in log_config["formatters"]:
            log_config["formatters"]["default"]["use_colors"] = False
        if "access" in log_config["formatters"]:
            log_config["formatters"]["access"]["use_colors"] = False

    uvicorn.run(app, host=HOST, port=PORT, log_level="info", log_config=log_config)
