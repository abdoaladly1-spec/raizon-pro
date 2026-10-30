"""إرسال إشعارات الفواتير عبر Gmail SMTP (مع وضع محاكاة آمن)."""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List

import database
from config import (
    EMAIL_FROM,
    EMAIL_SUBJECT_PREFIX,
    EMAIL_TO,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
    email_mode,
)


def _format_items(items: List[Dict[str, Any]]) -> str:
    if not items:
        return "<tr><td colspan='4' style='color:#888'>-</td></tr>"
    rows = []
    for it in items:
        name = it.get("name", "")
        qty = it.get("quantity", 1)
        price = it.get("price", 0)
        rows.append(
            f"<tr>"
            f"<td style='padding:6px;border-bottom:1px solid #eee'>{name}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:center'>{qty}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:right'>{price:,.2f}</td>"
            f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:right'>{(price * qty):,.2f}</td>"
            f"</tr>"
        )
    return "".join(rows)


def build_invoice_email(inv: Dict[str, Any]) -> Dict[str, str]:
    subject = f"{EMAIL_SUBJECT_PREFIX} فاتورة جديدة #{inv.get('local_id') or inv.get('id')} - {inv.get('total', 0):,.2f} ج.م"
    total = inv.get("total", 0) or 0
    subtotal = inv.get("subtotal", 0) or 0
    discount = inv.get("discount", 0) or 0
    tax = inv.get("tax", 0) or 0
    body_html = f"""
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f6f7fb;padding:20px">
      <div style="max-width:640px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:linear-gradient(90deg,#0ea5e9,#2563eb);padding:18px 24px;color:#fff">
          <h2 style="margin:0">📦 فاتورة جديدة</h2>
          <p style="margin:4px 0 0;opacity:.9">تم تسجيل فاتورة جديدة في نظام ProCashier</p>
        </div>
        <div style="padding:20px 24px;color:#111">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#6b7280">رقم الفاتورة</td><td style="text-align:left;font-weight:bold">#{inv.get('local_id') or inv.get('id')}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">العميل</td><td style="text-align:left;font-weight:bold">{inv.get('customer_name') or 'زائر'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">الهاتف</td><td style="text-align:left">{inv.get('phone') or '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">التاريخ</td><td style="text-align:left">{inv.get('date')} {inv.get('time', '')}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">الكاشير</td><td style="text-align:left">{inv.get('created_by') or '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">طريقة الدفع</td><td style="text-align:left">{inv.get('payment_method') or 'cash'}</td></tr>
          </table>

          <h3 style="margin:18px 0 8px;font-size:15px">الأصناف</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;text-align:right">الصنف</th>
                <th style="padding:8px;text-align:center">الكمية</th>
                <th style="padding:8px;text-align:right">السعر</th>
                <th style="padding:8px;text-align:right">الإجمالي</th>
              </tr>
            </thead>
            <tbody>{_format_items(inv.get('items') or [])}</tbody>
          </table>

          <table style="width:100%;margin-top:16px;font-size:14px">
            <tr><td style="color:#6b7280">المجموع الفرعي</td><td style="text-align:left">{subtotal:,.2f} ج.م</td></tr>
            <tr><td style="color:#6b7280">الخصم</td><td style="text-align:left">{discount:,.2f} ج.م</td></tr>
            <tr><td style="color:#6b7280">الضريبة</td><td style="text-align:left">{tax:,.2f} ج.م</td></tr>
            <tr style="background:#ecfdf5">
              <td style="padding:10px;font-weight:bold">الإجمالي</td>
              <td style="padding:10px;text-align:left;font-weight:bold;font-size:18px;color:#059669">{total:,.2f} ج.م</td>
            </tr>
          </table>
        </div>
        <div style="background:#f9fafb;padding:12px 24px;color:#6b7280;font-size:12px;text-align:center">
          إرسال تلقائي من سيرفر ProCashier
        </div>
      </div>
    </div>
    """
    plain = (
        f"فاتورة جديدة #{inv.get('local_id') or inv.get('id')}\n"
        f"العميل: {inv.get('customer_name') or 'زائر'}\n"
        f"التاريخ: {inv.get('date')}\n"
        f"الإجمالي: {total:,.2f} ج.م\n"
    )
    return {"subject": subject, "html": body_html, "plain": plain}


def send_invoice_notification(inv: Dict[str, Any]) -> Dict[str, str]:
    """يبعت إشعار الفاتورة الجديدة. يرجّع {status, mode, error}."""
    mode = email_mode()
    mail = build_invoice_email(inv)
    invoice_id = str(inv.get("id") or "")

    if mode == "off":
        database.log_email(invoice_id, EMAIL_TO, mail["subject"], mail["plain"], "off", "skipped")
        return {"status": "skipped", "mode": "off"}

    if mode == "simulation" or not EMAIL_TO:
        database.log_email(invoice_id, EMAIL_TO or "(غير محدد)", mail["subject"], mail["plain"],
                           "simulation", "simulated")
        print(f"[EMAIL][SIMULATION] {mail['subject']} -> {EMAIL_TO or '(غير محدد)'}")
        return {"status": "simulated", "mode": "simulation"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = mail["subject"]
        msg["From"] = EMAIL_FROM or SMTP_USER
        msg["To"] = EMAIL_TO
        msg.attach(MIMEText(mail["plain"], "plain", "utf-8"))
        msg.attach(MIMEText(mail["html"], "html", "utf-8"))

        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [EMAIL_TO], msg.as_string())

        database.log_email(invoice_id, EMAIL_TO, mail["subject"], mail["plain"], "live", "sent")
        print(f"[EMAIL][SENT] {mail['subject']} -> {EMAIL_TO}")
        return {"status": "sent", "mode": "live"}
    except Exception as exc:  # noqa: BLE001
        database.log_email(invoice_id, EMAIL_TO, mail["subject"], mail["plain"], "live", "failed", str(exc))
        print(f"[EMAIL][FAILED] {exc}")
        return {"status": "failed", "mode": "live", "error": str(exc)}
