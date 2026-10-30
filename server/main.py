"""سيرفر ProCashier المركزي - FastAPI + SQLite + إشعارات Gmail.

تشغيل:
    python main.py
    أو: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from typing import Any, Dict, List, Optional, Tuple

import json
import socket
from datetime import datetime
from pathlib import Path

from fastapi import BackgroundTasks, Body, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import database
import emailer
from config import API_KEY, BACKUP_DIR, HOST, NOTIFY_ON_INVOICE, PORT, email_mode

BACKUP_KEEP = 10

app = FastAPI(title="ProCashier Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ Auth
def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if API_KEY and x_api_key != API_KEY:
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
    points_reversed: int = 0
    commission_reversed: float = 0
    date: Optional[str] = None
    timestamp: Optional[int] = None
    updated_at: Optional[int] = None
    deleted: int = 0


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
        if method not in ("cash", "card", "wallet"):
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
    if received is not None:
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
    if is_new and NOTIFY_ON_INVOICE:
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


# ------------------------------------------------------------------ Backup (نسخ احتياطي للحالة كاملة)
@app.post("/api/backup", dependencies=[Depends(require_api_key)])
def save_backup(payload: Dict[str, Any] = Body(...)):
    """يستقبل نسخة من حالة تطبيق الويندوز ويخزنها كملف JSON على السيرفر."""
    try:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        data = json.dumps(payload, ensure_ascii=False)
        (BACKUP_DIR / "appstate-latest.json").write_text(data, encoding="utf-8")
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        (BACKUP_DIR / f"appstate-{stamp}.json").write_text(data, encoding="utf-8")
        # نحتفظ بآخر N نسخ زمنية فقط
        history = sorted(BACKUP_DIR.glob("appstate-*.json"))
        for old in history[:-BACKUP_KEEP]:
            try:
                old.unlink()
            except OSError:
                pass
        return {"ok": True, "bytes": len(data.encode("utf-8")), "saved_at": stamp}
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"backup write failed: {exc}") from exc


@app.get("/api/backup", dependencies=[Depends(require_api_key)])
def load_backup():
    """يرجّع آخر نسخة احتياطية محفوظة على السيرفر."""
    path = BACKUP_DIR / "appstate-latest.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="لا توجد نسخة احتياطية على السيرفر")
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=f"backup read failed: {exc}") from exc
    return {"ok": True, "state": state, "modified_at": path.stat().st_mtime}


if __name__ == "__main__":
    import uvicorn

    database.get_conn()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
