"""إرسال إشعارات الفواتير وتقارير الإقفال عبر Gmail SMTP بهوية Rizon Pro System Cashier الفاخرة."""
import base64
import smtplib
import ssl
from datetime import datetime
import time
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from typing import Any, Dict, List, Optional, Tuple

import assets_data
import config
import database
email_mode = config.email_mode

ARABIC_MONTHS = {
    1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
    5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
    9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر"
}

PAYMENT_METHODS = {
    "cash": "نقداً",
    "card": "بطاقة دفع / فيزا",
    "mixed": "دفع مختلط (كاش + شبكة)",
    "credit": "آجل / على الحساب",
    "online": "دفع إلكتروني",
    "vodafone_cash": "محفظة إلكترونية",
    "instapay": "إنستاباي (InstaPay)",
}


def _format_datetime(date_str: Any = None, time_str: Any = None, timestamp: Any = None) -> str:
    """تنسيق التاريخ والوقت بالعربية: 01 نوفمبر 2026 - 11:30 ص."""
    dt: datetime = None  # type: ignore
    if timestamp:
        try:
            ts = float(timestamp)
            if ts > 1e11:
                ts /= 1000.0
            dt = datetime.fromtimestamp(ts)
        except Exception:
            dt = None

    if not dt and date_str:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                dt = datetime.strptime(str(date_str).strip(), fmt)
                break
            except Exception:
                dt = None

    if not dt:
        dt = datetime.now()

    hour = dt.hour
    minute = dt.minute
    if time_str and ":" in str(time_str):
        try:
            parts = str(time_str).split(":")
            hour = int(parts[0])
            minute = int(parts[1][:2])
        except Exception:
            pass

    period = "ص" if hour < 12 else "م"
    h12 = hour % 12
    if h12 == 0:
        h12 = 12

    month_name = ARABIC_MONTHS.get(dt.month, str(dt.month))
    return f"{dt.day:02d} {month_name} {dt.year} - {h12:02d}:{minute:02d} {period}"


def _format_items_rows(items: List[Dict[str, Any]]) -> str:
    if not items:
        return """
        <tr>
          <td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
            لا توجد أصناف أو خدمات مسجلة
          </td>
        </tr>
        """
    rows = []
    for it in items:
        name = it.get("name") or it.get("title") or "صنف بدون اسم"
        qty = it.get("quantity", 1) or 1
        price = float(it.get("price", 0) or 0)
        item_total = price * qty
        rows.append(
            f"""
            <tr style="border-bottom: 1px solid #1f1832;">
              <td style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 13px; font-weight: 600;">{name}</td>
              <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-size: 13px;">{qty}</td>
              <td style="padding: 12px 14px; text-align: center; color: #cbd5e1; font-size: 13px;">{price:,.2f}</td>
              <td style="padding: 12px 16px; text-align: left; color: #facc15; font-size: 13px; font-weight: 700;">{item_total:,.2f}</td>
            </tr>
            """
        )
    return "".join(rows)


def build_invoice_email(inv: Dict[str, Any]) -> Dict[str, str]:
    """بناء إيميل الفاتورة بنفس النمط الفاخر المخصص لنظام Rizon Pro System Cashier."""
    inv_num = str(inv.get("local_id") or inv.get("id") or "0000")
    total = float(inv.get("total", 0) or 0)
    subtotal = float(inv.get("subtotal", 0) or total)
    discount = float(inv.get("discount", 0) or 0)
    tax = float(inv.get("tax", 0) or 0)

    customer_name = inv.get("customer_name") or "عميل نقدي / زائر"
    phone = inv.get("phone") or "-"
    cashier = inv.get("created_by") or inv.get("cashier") or "كاشير المحل"
    raw_payment = str(inv.get("payment_method") or "cash").lower()
    payment_method_arabic = PAYMENT_METHODS.get(raw_payment, raw_payment)

    datetime_formatted = _format_datetime(
        inv.get("date"),
        inv.get("time"),
        inv.get("timestamp")
    )

    items = inv.get("items") or []
    items_html = _format_items_rows(items)

    subject = f"[{config.EMAIL_SUBJECT_PREFIX.strip('[] ')}] فاتورة جديدة #{inv_num} - {total:,.2f} ج.م"

    body_html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة جديدة #{inv_num}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #07060b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div dir="rtl" style="max-width: 620px; margin: 0 auto; background-color: #0f0c1b; border: 1px solid #28203d; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);">
    
    <!-- Top Accent Gradient Bar -->
    <div style="height: 4px; background: linear-gradient(90deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%);"></div>

    <div style="padding: 28px 24px;">
      
      <!-- Header Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <!-- Info Column (Right in RTL) -->
          <td style="vertical-align: middle; text-align: right;">
            <div style="color: #a855f7; font-size: 13px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px;">نظام إدارة المبيعات الذكي</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px;">Rizon Pro System Cashier</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">إشعار تسجيل فاتورة مبيعات جديدة</div>
            <div>
              <span style="display: inline-block; background-color: rgba(147, 51, 234, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 600; color: #d8b4fe;">✓ إشعار رسمي صادر من النظام</span>
            </div>
          </td>
          <!-- 3D Logo Column (Left in RTL) -->
          <td style="vertical-align: middle; text-align: left; width: 105px;">
            <div style="width: 96px; height: 96px; background-color: #08060f; border: 1px solid #2b2342; border-radius: 16px; padding: 4px; box-sizing: border-box; display: inline-block; text-align: center;">
              <img src="cid:rizon_logo" alt="Rizon Pro Logo" width="86" height="86" style="display: block; width: 86px; height: 86px; border: 0; object-fit: contain; margin: auto;" />
            </div>
          </td>
        </tr>
      </table>

      <!-- Success Notification Banner -->
      <div style="margin-top: 10px; margin-bottom: 20px; text-align: right;">
        <div style="color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 6px;">
          تم تسجيل الفاتورة بنجاح <span style="color: #facc15;">✓</span>
        </div>
        <div style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
          نؤكد لك أن عملية البيع التالية تم حفظها في نظام <span style="color: #cbd5e1; font-weight: 600;">Rizon Pro System Cashier</span>.
        </div>
      </div>

      <!-- Invoice Number Box -->
      <div style="background-color: #151124; border: 1px solid #2c2447; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">رقم الفاتورة</div>
              <div style="color: #facc15; font-size: 28px; font-weight: 900; font-family: 'Courier New', Courier, monospace, sans-serif; letter-spacing: 1px;">#{inv_num}</div>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <span style="display: inline-block; background-color: rgba(147, 51, 234, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 9999px; padding: 5px 14px; font-size: 12px; font-weight: 700; color: #e9d5ff;">✓ مكتملة</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Invoice Details Section -->
      <div style="text-align: right; margin-bottom: 10px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 800;">بيانات الفاتورة</span>
      </div>
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: right;">
          <!-- Row 1: العميل & الهاتف -->
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 14px 18px; width: 50%; vertical-align: top;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px;">اسم العميل</div>
              <div style="color: #ffffff; font-size: 14px; font-weight: 700;">{customer_name}</div>
            </td>
            <td style="padding: 14px 18px; width: 50%; vertical-align: top; text-align: left;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px; text-align: left;">رقم الهاتف</div>
              <div style="color: #ffffff; font-size: 14px; font-family: monospace; font-weight: 600; text-align: left;">{phone}</div>
            </td>
          </tr>
          <!-- Row 2: تاريخ ووقت الفاتورة & الكاشير -->
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 14px 18px; vertical-align: top;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px;">تاريخ ووقت الفاتورة</div>
              <div style="color: #ffffff; font-size: 13px; font-weight: 600;">{datetime_formatted}</div>
            </td>
            <td style="padding: 14px 18px; vertical-align: top; text-align: left;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px; text-align: left;">الكاشير</div>
              <div style="color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{cashier}</div>
            </td>
          </tr>
          <!-- Row 3: حالة الفاتورة & طريقة الدفع -->
          <tr>
            <td style="padding: 14px 18px; vertical-align: top;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px;">حالة الفاتورة</div>
              <div style="color: #a855f7; font-size: 13px; font-weight: 700;">تم الحفظ بنجاح</div>
            </td>
            <td style="padding: 14px 18px; vertical-align: top; text-align: left;">
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 5px; text-align: left;">طريقة الدفع</div>
              <div style="color: #facc15; font-size: 14px; font-weight: 800; text-align: left;">{payment_method_arabic}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Items Section -->
      <div style="text-align: right; margin-bottom: 10px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 800;">تفاصيل الأصناف والخدمات</span>
      </div>
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
        <thead>
          <tr style="background-color: #241743;">
            <th style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #2e2052;">الصنف / الخدمة</th>
            <th style="padding: 12px 10px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #2e2052;">الكمية</th>
            <th style="padding: 12px 14px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #2e2052;">السعر</th>
            <th style="padding: 12px 16px; text-align: left; color: #facc15; font-size: 12px; font-weight: 700; border-bottom: 1px solid #2e2052;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items_html}
        </tbody>
      </table>

      <!-- Subtotals Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <td style="vertical-align: middle; text-align: right; color: #94a3b8; font-size: 12px;">
            جميع المبالغ بالجنيه المصري
          </td>
          <td style="vertical-align: middle; text-align: left;">
            <table style="border-collapse: collapse; margin-right: auto; text-align: left;">
              <tr>
                <td style="padding: 4px 14px; color: #94a3b8; font-size: 12px;">المجموع الفرعي</td>
                <td style="padding: 4px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{subtotal:,.2f} ج.م</td>
              </tr>
              <tr>
                <td style="padding: 4px 14px; color: #94a3b8; font-size: 12px;">الخصم</td>
                <td style="padding: 4px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{discount:,.2f} ج.م</td>
              </tr>
              <tr>
                <td style="padding: 4px 14px; color: #94a3b8; font-size: 12px;">الضريبة</td>
                <td style="padding: 4px 0; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{tax:,.2f} ج.م</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Final Total Box -->
      <div style="background-color: #17122b; border: 1px solid #eab308; border-radius: 12px; padding: 18px 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <span style="color: #ffffff; font-size: 18px; font-weight: 800;">الإجمالي النهائي</span>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <span style="color: #facc15; font-size: 26px; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif;">{total:,.2f} ج.م</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Automated Notice Box -->
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; text-align: right;">
        <div style="color: #ffffff; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
          ✓ إشعار آلي من Rizon Pro System Cashier
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.6;">
          تم إنشاء هذه الرسالة تلقائياً لتأكيد حفظ بيانات الفاتورة في النظام. لا تشارك كلمة المرور أو رموز التحقق مع أي شخص.
        </div>
      </div>

      <!-- Footer Section -->
      <div style="text-align: center; padding-top: 14px; border-top: 1px solid #1f1832;">
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
          شكراً لاستخدامك <span style="color: #facc15; font-weight: 700;">Rizon Pro System Cashier</span>
        </div>
        <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">
          نظامك لإدارة المبيعات والفواتير بسهولة واحترافية
        </div>
        <div style="color: #475569; font-size: 10px; margin-bottom: 16px;">
          هذه رسالة تلقائية، يرجى عدم الرد عليها
        </div>
        <div style="color: #475569; font-size: 11px;">
          © Rizon Pro System Cashier جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""

    plain = (
        f"فاتورة مبيعات جديدة #{inv_num}\n"
        f"العميل: {customer_name}\n"
        f"الهاتف: {phone}\n"
        f"التاريخ: {datetime_formatted}\n"
        f"طريقة الدفع: {payment_method_arabic}\n"
        f"الكاشير: {cashier}\n"
        f"الإجمالي: {total:,.2f} ج.م\n"
        f"-- Rizon Pro System Cashier --\n"
    )

    return {"subject": subject, "html": body_html, "plain": plain}


def _attach_email_logo(msg: MIMEMultipart) -> None:
    """إرفاق الشعار بصيغة CID لعرضه داخل الإيميل بدون روابط خارجية."""
    try:
        if hasattr(assets_data, "RIZON_LOGO_BASE64") and assets_data.RIZON_LOGO_BASE64:
            raw = base64.b64decode(assets_data.RIZON_LOGO_BASE64)
            img = MIMEImage(raw, _subtype="png")
            img.add_header("Content-ID", "<rizon_logo>")
            img.add_header("Content-Disposition", "inline", filename="rizon_logo.png")
            msg.attach(img)
    except Exception as exc:
        print(f"[EMAIL][LOGO_ATTACH_ERROR] {exc}")


def send_invoice_notification(inv: Dict[str, Any]) -> Dict[str, str]:
    """يبعت إشعار الفاتورة الجديدة. يرجّع {status, mode, error}."""
    mode = config.email_mode()
    mail = build_invoice_email(inv)
    invoice_id = str(inv.get("id") or "")
    recipient = config.EMAIL_TO
    sender = config.EMAIL_FROM or config.SMTP_USER

    if mode == "off":
        database.log_email(invoice_id, recipient, mail["subject"], mail["plain"], "off", "skipped")
        return {"status": "skipped", "mode": "off"}

    if mode == "simulation" or not recipient:
        database.log_email(invoice_id, recipient or "(غير محدد)", mail["subject"], mail["plain"],
                           "simulation", "simulated")
        print(f"[EMAIL][SIMULATION] {mail['subject']} -> {recipient or '(غير محدد)'}")
        return {"status": "simulated", "mode": "simulation"}

    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = mail["subject"]
        msg["From"] = formataddr(("Rizon Pro System Cashier", sender))
        msg["To"] = recipient
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Mailer"] = "Rizon Pro Notification Engine v2.0"

        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(mail["plain"], "plain", "utf-8"))
        alt_part.attach(MIMEText(mail["html"], "html", "utf-8"))
        msg.attach(alt_part)

        _attach_email_logo(msg)

        context = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
            server.starttls(context=context)
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(msg["From"], [recipient], msg.as_string())

        database.log_email(invoice_id, recipient, mail["subject"], mail["plain"], "live", "sent")
        print(f"[EMAIL][SENT] {mail['subject']} -> {recipient}")
        return {"status": "sent", "mode": "live"}
    except Exception as exc:  # noqa: BLE001
        database.log_email(invoice_id, recipient, mail["subject"], mail["plain"], "live", "failed", str(exc))
        print(f"[EMAIL][FAILED] {exc}")
        return {"status": "failed", "mode": "live", "error": str(exc)}


def build_closing_email(rep: Dict[str, Any]) -> Dict[str, str]:
    """تجهيز إيميل تقرير إقفال الوردية للمدير بنفس الهوية الداكنة الفاخرة."""
    status = rep.get("status", "matched")
    diff = float(rep.get("difference", 0) or 0)
    actual = float(rep.get("actualCash", 0) or 0)
    expected = float(rep.get("expectedCash", 0) or 0)
    opening = float(rep.get("openingBalance", 0) or 0)
    cash_sales = float(rep.get("cashSales", 0) or 0)
    expenses = float(rep.get("totalExpenses", 0) or 0)
    performed_by = rep.get("performedBy") or "غير محدد"
    date_str = rep.get("date") or datetime.now().strftime("%Y-%m-%d")

    status_arabic = "متطابق تماماً بدون عجز" if status == "matched" else (
        f"عجز بقيمة {abs(diff):,.2f} ج.م" if diff < 0 else f"زيادة بقيمة {diff:,.2f} ج.م"
    )
    status_color = "#10b981" if status == "matched" else ("#f43f5e" if diff < 0 else "#8b5cf6")

    subject = f"[{config.EMAIL_SUBJECT_PREFIX.strip('[] ')}] تقرير إقفال وردية - {status_arabic} ({performed_by})"

    body_html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير إقفال وردية</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #07060b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div dir="rtl" style="max-width: 620px; margin: 0 auto; background-color: #0f0c1b; border: 1px solid #28203d; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);">
    
    <!-- Top Accent Gradient Bar -->
    <div style="height: 4px; background: linear-gradient(90deg, #8b5cf6 0%, #ec4899 50%, #f59e0b 100%);"></div>

    <div style="padding: 28px 24px;">
      
      <!-- Header Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="vertical-align: middle; text-align: right;">
            <div style="color: #a855f7; font-size: 13px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px;">نظام إدارة المبيعات الذكي</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px;">Rizon Pro System Cashier</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">إشعار تقرير إقفال الوردية اليومي</div>
            <div>
              <span style="display: inline-block; background-color: rgba(147, 51, 234, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 600; color: #d8b4fe;">🔒 تقرير مالي رسمي</span>
            </div>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 105px;">
            <div style="width: 96px; height: 96px; background-color: #08060f; border: 1px solid #2b2342; border-radius: 16px; padding: 4px; box-sizing: border-box; display: inline-block; text-align: center;">
              <img src="cid:rizon_logo" alt="Rizon Pro Logo" width="86" height="86" style="display: block; width: 86px; height: 86px; border: 0; object-fit: contain; margin: auto;" />
            </div>
          </td>
        </tr>
      </table>

      <!-- Status Banner -->
      <div style="margin-top: 10px; margin-bottom: 20px; text-align: right;">
        <div style="color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 6px;">
          تم تسجيل إقفال الوردية <span style="color: {status_color};">✓</span>
        </div>
        <div style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
          ملخص الحسابات النقدية والمبيعات المسجلة في الخزينة.
        </div>
      </div>

      <!-- Financial Breakdown Box -->
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: right;">
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">تاريخ الوردية</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{date_str}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">مسؤول الإقفال</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{performed_by}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">رصيد بداية اليوم (العهدة)</td>
            <td style="padding: 12px 18px; color: #cbd5e1; font-size: 13px; font-weight: 600; text-align: left;">{opening:,.2f} ج.م</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">المبيعات النقدية</td>
            <td style="padding: 12px 18px; color: #10b981; font-size: 13px; font-weight: 700; text-align: left;">+{cash_sales:,.2f} ج.م</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">إجمالي المصروفات</td>
            <td style="padding: 12px 18px; color: #f43f5e; font-size: 13px; font-weight: 700; text-align: left;">−{expenses:,.2f} ج.م</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">المبلغ المتوقع في الدرج</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 14px; font-weight: 800; text-align: left;">{expected:,.2f} ج.م</td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">المبلغ الفعلي المستلم</td>
            <td style="padding: 12px 18px; color: #facc15; font-size: 15px; font-weight: 900; text-align: left;">{actual:,.2f} ج.م</td>
          </tr>
        </table>
      </div>

      <!-- Difference Status Card -->
      <div style="background-color: #17122b; border: 1px solid {status_color}; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">حالة الخزينة (الفرق)</div>
              <div style="color: {status_color}; font-size: 16px; font-weight: 800;">{status_arabic}</div>
            </td>
          </tr>
        </table>
      </div>

      {f'''
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; text-align: right;">
        <div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">ملاحظات الكاشير:</div>
        <div style="color: #ffffff; font-size: 13px;">{rep.get("notes")}</div>
      </div>
      ''' if rep.get("notes") else ''}

      <!-- Footer Section -->
      <div style="text-align: center; padding-top: 14px; border-top: 1px solid #1f1832;">
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
          نظام <span style="color: #facc15; font-weight: 700;">Rizon Pro System Cashier</span>
        </div>
        <div style="color: #64748b; font-size: 11px; margin-bottom: 14px;">
          إشعار مالي آلي لتقفيل وردية الكاشير
        </div>
        <div style="color: #475569; font-size: 11px;">
          © Rizon Pro System Cashier جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""

    plain = (
        f"إقفال وردية - التاريخ: {date_str} - المسؤول: {performed_by} - "
        f"الفعلي: {actual:,.2f} ج.م - المتوقع: {expected:,.2f} ج.م - الحالة: {status_arabic}"
    )

    return {"subject": subject, "html": body_html, "plain": plain}


def send_closing_notification(rep: Dict[str, Any]) -> Dict[str, str]:
    """إرسال إشعار إقفال الوردية بالبريد الإلكتروني."""
    mode = config.email_mode()
    mail = build_closing_email(rep)
    report_id = str(rep.get("id") or "")
    recipient = config.EMAIL_TO
    sender = config.EMAIL_FROM or config.SMTP_USER

    if mode == "off":
        database.log_email(report_id, recipient, mail["subject"], mail["plain"], "off", "skipped")
        return {"status": "skipped", "mode": "off"}

    if mode == "simulation" or not recipient:
        database.log_email(report_id, recipient or "(غير محدد)", mail["subject"], mail["plain"],
                           "simulation", "simulated")
        print(f"[EMAIL][SIMULATION] {mail['subject']} -> {recipient or '(غير محدد)'}")
        return {"status": "simulated", "mode": "simulation"}

    try:
        msg = MIMEMultipart("related")
        msg["Subject"] = mail["subject"]
        msg["From"] = formataddr(("Rizon Pro System Cashier", sender))
        msg["To"] = recipient
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Mailer"] = "Rizon Pro Notification Engine v2.0"

        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(mail["plain"], "plain", "utf-8"))
        alt_part.attach(MIMEText(mail["html"], "html", "utf-8"))
        msg.attach(alt_part)

        _attach_email_logo(msg)

        context = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
            server.starttls(context=context)
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(msg["From"], [recipient], msg.as_string())

        database.log_email(report_id, recipient, mail["subject"], mail["plain"], "live", "sent")
        print(f"[EMAIL][SENT] {mail['subject']} -> {recipient}")
        return {"status": "sent", "mode": "live"}
    except Exception as exc:  # noqa: BLE001
        database.log_email(report_id, recipient, mail["subject"], mail["plain"], "live", "failed", str(exc))
        print(f"[EMAIL][FAILED] {exc}")
        return {"status": "failed", "mode": "live", "error": str(exc)}


def _dispatch_mime_email(mail: Dict[str, str], record_id: str, log_tag: str, attachments: Optional[List[Tuple[str, bytes, str]]] = None) -> Dict[str, str]:
    """إرسال موحّد وآمن لكافة أنواع الإشعارات بالبريد الإلكتروني مع دعم المرفقات."""
    mode = config.email_mode()
    recipient = config.EMAIL_TO
    sender = config.EMAIL_FROM or config.SMTP_USER

    if mode == "off":
        database.log_email(record_id, recipient, mail["subject"], mail["plain"], "off", "skipped")
        return {"status": "skipped", "mode": "off"}

    if mode == "simulation" or not recipient:
        database.log_email(record_id, recipient or "(غير محدد)", mail["subject"], mail["plain"],
                           "simulation", "simulated")
        print(f"[EMAIL][SIMULATION] {mail['subject']} -> {recipient or '(غير محدد)'}")
        return {"status": "simulated", "mode": "simulation"}

    try:
        if attachments:
            msg = MIMEMultipart("mixed")
            related = MIMEMultipart("related")
            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(mail["plain"], "plain", "utf-8"))
            alt_part.attach(MIMEText(mail["html"], "html", "utf-8"))
            related.attach(alt_part)
            _attach_email_logo(related)
            msg.attach(related)

            from email.mime.base import MIMEBase
            from email import encoders
            for att_name, att_bytes, att_mime in attachments:
                main_type, _, sub_type = att_mime.partition("/")
                part = MIMEBase(main_type or "application", sub_type or "octet-stream")
                part.set_payload(att_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{att_name}"')
                msg.attach(part)
        else:
            msg = MIMEMultipart("related")
            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(mail["plain"], "plain", "utf-8"))
            alt_part.attach(MIMEText(mail["html"], "html", "utf-8"))
            msg.attach(alt_part)
            _attach_email_logo(msg)

        msg["Subject"] = mail["subject"]
        msg["From"] = formataddr(("Rizon Pro System Cashier", sender))
        msg["To"] = recipient
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain="gmail.com")
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Mailer"] = "Rizon Pro Notification Engine v2.0"

        context = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
            server.starttls(context=context)
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(msg["From"], [recipient], msg.as_string())

        database.log_email(record_id, recipient, mail["subject"], mail["plain"], "live", "sent")
        print(f"[EMAIL][SENT] {mail['subject']} -> {recipient}")
        return {"status": "sent", "mode": "live"}
    except Exception as exc:  # noqa: BLE001
        database.log_email(record_id, recipient, mail["subject"], mail["plain"], "live", "failed", str(exc))
        print(f"[EMAIL][{log_tag}_FAILED] {exc}")
        return {"status": "failed", "mode": "live", "error": str(exc)}


def build_return_email(ret: Dict[str, Any]) -> Dict[str, str]:
    """بناء إيميل إشعار المرتجع والاسترداد المالي بنفس الهوية الفاخرة."""
    inv_num = str(ret.get("invoice_id") or ret.get("invoice_uid") or "-")
    refund_amount = float(ret.get("refund_amount", 0) or ret.get("cash_refund", 0) or 0)
    customer_name = ret.get("customer_name") or "عميل نقدي"
    staff = ret.get("staff_name") or ret.get("created_by") or "كاشير المحل"
    reason = ret.get("reason") or ret.get("notes") or "طلب العميل / مرتجع رسمي"
    ret_type = "مرتجع كامل" if ret.get("type") == "full" else "مرتجع جزئي"
    datetime_formatted = _format_datetime(ret.get("date"), None, ret.get("timestamp"))

    items = ret.get("items") or []
    items_html = _format_items_rows(items)

    subject = f"[{config.EMAIL_SUBJECT_PREFIX.strip('[] ')}] إشعار مرتجع واسترداد فاتورة #{inv_num} - {refund_amount:,.2f} ج.م"

    body_html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إشعار مرتجع فاتورة #{inv_num}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #07060b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div dir="rtl" style="max-width: 620px; margin: 0 auto; background-color: #0f0c1b; border: 1px solid #28203d; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);">
    
    <!-- Top Accent Bar: Rose to Amber -->
    <div style="height: 4px; background: linear-gradient(90deg, #f43f5e 0%, #ec4899 50%, #f59e0b 100%);"></div>

    <div style="padding: 28px 24px;">
      
      <!-- Header Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="vertical-align: middle; text-align: right;">
            <div style="color: #f43f5e; font-size: 13px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px;">نظام إدارة المبيعات والرقابة المالية</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px;">Rizon Pro System Cashier</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">إشعار تسجيل عملية استرداد / مرتجع رسمي</div>
            <div>
              <span style="display: inline-block; background-color: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 600; color: #fda4af;">🔄 عملية استرجاع مالي</span>
            </div>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 105px;">
            <div style="width: 96px; height: 96px; background-color: #08060f; border: 1px solid #2b2342; border-radius: 16px; padding: 4px; box-sizing: border-box; display: inline-block; text-align: center;">
              <img src="cid:rizon_logo" alt="Rizon Pro Logo" width="86" height="86" style="display: block; width: 86px; height: 86px; border: 0; object-fit: contain; margin: auto;" />
            </div>
          </td>
        </tr>
      </table>

      <!-- Banner -->
      <div style="margin-top: 10px; margin-bottom: 20px; text-align: right;">
        <div style="color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 6px;">
          تم تسجيل استرداد مالي <span style="color: #f43f5e;">⚠</span>
        </div>
        <div style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
          تم خصم المبلغ المسترد من الخزينة وإعادة الأصناف إلى المخزون تلقائياً.
        </div>
      </div>

      <!-- Return Card -->
      <div style="background-color: #151124; border: 1px solid #3b1d2c; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">الفاتورة الأصلية</div>
              <div style="color: #f43f5e; font-size: 26px; font-weight: 900; font-family: monospace;">#{inv_num}</div>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <span style="display: inline-block; background-color: rgba(244, 63, 94, 0.2); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 9999px; padding: 5px 14px; font-size: 12px; font-weight: 700; color: #fecdd3;">{ret_type}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Details -->
      <div style="text-align: right; margin-bottom: 10px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 800;">بيانات عملية الإرجاع</span>
      </div>
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: right;">
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px; width: 40%;">اسم العميل</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{customer_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">المسؤول عن الإرجاع</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{staff}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">تاريخ ووقت المرتجع</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{datetime_formatted}</td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">سبب الإرجاع</td>
            <td style="padding: 12px 18px; color: #fbbf24; font-size: 13px; font-weight: 600; text-align: left;">{reason}</td>
          </tr>
        </table>
      </div>

      <!-- Items Section -->
      {f"""
      <div style="text-align: right; margin-bottom: 10px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 800;">الأصناف المرتجعة</span>
      </div>
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #3b1424;">
            <th style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #4a192e;">الصنف / الخدمة</th>
            <th style="padding: 12px 10px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #4a192e;">الكمية المسترجعة</th>
            <th style="padding: 12px 14px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 700; border-bottom: 1px solid #4a192e;">السعر</th>
            <th style="padding: 12px 16px; text-align: left; color: #f43f5e; font-size: 12px; font-weight: 700; border-bottom: 1px solid #4a192e;">المبلغ المسترد</th>
          </tr>
        </thead>
        <tbody>
          {items_html}
        </tbody>
      </table>
      """ if items else ""}

      <!-- Refund Total Box -->
      <div style="background-color: #1a0e1c; border: 1px solid #f43f5e; border-radius: 12px; padding: 18px 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <span style="color: #ffffff; font-size: 17px; font-weight: 800;">إجمالي المبلغ المسترد للعميل</span>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <span style="color: #f43f5e; font-size: 26px; font-weight: 900;">−{refund_amount:,.2f} ج.م</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Automated Notice Box -->
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; text-align: right;">
        <div style="color: #ffffff; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
          ✓ إشعار رقابي آلي من Rizon Pro System Cashier
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.6;">
          تم تسجيل عملية الاسترجاع وتحديث القيود المحاسبية ورصيد الخزينة تلقائياً.
        </div>
      </div>

      <!-- Footer Section -->
      <div style="text-align: center; padding-top: 14px; border-top: 1px solid #1f1832;">
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
          نظام <span style="color: #facc15; font-weight: 700;">Rizon Pro System Cashier</span>
        </div>
        <div style="color: #475569; font-size: 11px;">
          © Rizon Pro System Cashier جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""

    plain = f"إشعار مرتجع واسترداد مالي - فاتورة #{inv_num}\nالعميل: {customer_name}\nالمبلغ: {refund_amount:,.2f} ج.م\nالمسؤول: {staff}\nالسبب: {reason}\nالتاريخ: {datetime_formatted}"

    return {"subject": subject, "html": body_html, "plain": plain}


def send_return_notification(ret: Dict[str, Any]) -> Dict[str, str]:
    """إرسال إشعار المرتجع للمدير."""
    if not getattr(config, "NOTIFY_ON_RETURN", True):
        return {"status": "skipped", "mode": config.email_mode()}
    mail = build_return_email(ret)
    record_id = str(ret.get("uid") or ret.get("id") or "")
    return _dispatch_mime_email(mail, record_id, "RETURN")


def build_expense_email(exp: Dict[str, Any]) -> Dict[str, str]:
    """بناء إيميل إشعار المصروفات النقدية المسحوبة من الخزينة."""
    title = exp.get("title") or "مصروف نقدي"
    amount = float(exp.get("amount", 0) or 0)
    category = exp.get("category") or "مصروفات عامة"
    created_by = exp.get("created_by") or exp.get("user") or "الكاشير"
    notes = exp.get("notes") or exp.get("description") or "-"
    datetime_formatted = _format_datetime(exp.get("date"), exp.get("time"), exp.get("timestamp"))

    subject = f"[{config.EMAIL_SUBJECT_PREFIX.strip('[] ')}] إشعار صرف نقدي: {title} - {amount:,.2f} ج.م"

    body_html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إشعار صرف نقدي</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #07060b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div dir="rtl" style="max-width: 620px; margin: 0 auto; background-color: #0f0c1b; border: 1px solid #28203d; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);">
    
    <!-- Top Accent Bar: Amber to Orange -->
    <div style="height: 4px; background: linear-gradient(90deg, #f59e0b 0%, #ea580c 100%);"></div>

    <div style="padding: 28px 24px;">
      
      <!-- Header Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="vertical-align: middle; text-align: right;">
            <div style="color: #f59e0b; font-size: 13px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px;">نظام إدارة ومراقبة الخزينة</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.5px;">Rizon Pro System Cashier</div>
            <div style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">إشعار تسجيل وخروج مصروف نقدي من الدرج</div>
            <div>
              <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 600; color: #fde68a;">💸 سحب نقدي مسجل</span>
            </div>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 105px;">
            <div style="width: 96px; height: 96px; background-color: #08060f; border: 1px solid #2b2342; border-radius: 16px; padding: 4px; box-sizing: border-box; display: inline-block; text-align: center;">
              <img src="cid:rizon_logo" alt="Rizon Pro Logo" width="86" height="86" style="display: block; width: 86px; height: 86px; border: 0; object-fit: contain; margin: auto;" />
            </div>
          </td>
        </tr>
      </table>

      <!-- Banner -->
      <div style="margin-top: 10px; margin-bottom: 20px; text-align: right;">
        <div style="color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 6px;">
          تم تسجيل مصروف نقدي <span style="color: #f59e0b;">✓</span>
        </div>
        <div style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
          تم خصم المبلغ من رصيد الدرج النقدي الحالي وتسجيل العملية في الحسابات.
        </div>
      </div>

      <!-- Expense Summary Box -->
      <div style="background-color: #171321; border: 1px solid #3d2b15; border-radius: 12px; padding: 18px 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="text-align: right; vertical-align: middle;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">بند المصروف</div>
              <div style="color: #ffffff; font-size: 20px; font-weight: 800;">{title}</div>
            </td>
            <td style="text-align: left; vertical-align: middle;">
              <div style="color: #f59e0b; font-size: 26px; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif;">−{amount:,.2f} ج.م</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Details Box -->
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; text-align: right;">
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px; width: 35%;">التصنيف</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{category}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">المسؤول عن الصرف</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 700; text-align: left;">{created_by}</td>
          </tr>
          <tr style="border-bottom: 1px solid #201833;">
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">التاريخ والوقت</td>
            <td style="padding: 12px 18px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">{datetime_formatted}</td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; color: #94a3b8; font-size: 12px;">البيان / الملاحظات</td>
            <td style="padding: 12px 18px; color: #cbd5e1; font-size: 13px; text-align: left;">{notes}</td>
          </tr>
        </table>
      </div>

      <!-- Automated Notice Box -->
      <div style="background-color: #131021; border: 1px solid #251d3b; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; text-align: right;">
        <div style="color: #ffffff; font-size: 13px; font-weight: 700; margin-bottom: 5px;">
          ✓ إشعار مالي آلي من Rizon Pro System Cashier
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.6;">
          تم تسجيل المصروف في حركة الخزينة اليومية وسيظهر في تقرير التقفيل النهائي.
        </div>
      </div>

      <!-- Footer Section -->
      <div style="text-align: center; padding-top: 14px; border-top: 1px solid #1f1832;">
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
          نظام <span style="color: #facc15; font-weight: 700;">Rizon Pro System Cashier</span>
        </div>
        <div style="color: #475569; font-size: 11px;">
          © Rizon Pro System Cashier جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""

    plain = f"إشعار صرف نقدي: {title}\nالمبلغ: {amount:,.2f} ج.م\nالتصنيف: {category}\nالمسؤول: {created_by}\nالتاريخ: {datetime_formatted}\nالبيان: {notes}"

    return {"subject": subject, "html": body_html, "plain": plain}


def send_expense_notification(exp: Dict[str, Any]) -> Dict[str, str]:
    """إرسال إشعار المصروف للمدير."""
    if not getattr(config, "NOTIFY_ON_EXPENSE", True):
        return {"status": "skipped", "mode": config.email_mode()}
    mail = build_expense_email(exp)
    record_id = str(exp.get("id") or "")
    return _dispatch_mime_email(mail, record_id, "EXPENSE")


def build_backup_email(summary: Dict[str, Any]) -> Dict[str, str]:
    """بناء إيميل النسخة الاحتياطية السحابية المرفقة بنفس الطراز الملكي الفاخر."""
    filename = str(summary.get("filename") or "procashier_backup.json")
    size_kb = float(summary.get("size_kb") or 0.0)
    invoices_count = int(summary.get("invoices_count") or 0)
    items_count = int(summary.get("items_count") or 0)
    customers_count = int(summary.get("customers_count") or 0)
    performed_by = str(summary.get("performed_by") or "مدير النظام")
    datetime_formatted = _format_datetime(None, None, int(time.time() * 1000))
    subject = f"[{config.EMAIL_SUBJECT_PREFIX.strip('[] ')}] نسخة احتياطية سحابية للنظام - {datetime_formatted.split(' - ')[0]}"

    body_html = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #0b0914; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; direction: rtl; text-align: right;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0f0c1b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border: 1px solid #231b38;">
    
    <!-- Top Gradient Bar -->
    <div style="height: 4px; background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6, #eab308);"></div>

    <!-- Header Section -->
    <div style="padding: 24px 24px 18px 24px; text-align: right;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: right;">
            <div style="color: #a78bfa; font-size: 11px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px;">
              نظام إدارة المبيعات والنسخ السحابي
            </div>
            <div style="color: #ffffff; font-size: 20px; font-weight: 900; margin-bottom: 2px;">
              Rizon Pro System Cashier
            </div>
            <div style="color: #94a3b8; font-size: 12px;">
              إشعار إنشاء نسخة احتياطية سحابية ومحلية
            </div>
            <div style="margin-top: 10px;">
              <span style="display: inline-block; background-color: #1e1533; border: 1px solid #7c3aed; color: #c4b5fd; font-size: 11px; font-weight: 700; padding: 4px 12px; rounded-full: 9999px; border-radius: 20px;">
                ✓ تم إرفاق ملف النسخة الاحتياطية بالرسالة
              </span>
            </div>
          </td>
          <td style="width: 76px; text-align: left; vertical-align: middle;">
            <img src="cid:rizon_logo" alt="Rizon Logo" style="width: 72px; height: 72px; object-fit: contain; filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.45));">
          </td>
        </tr>
      </table>
    </div>

    <!-- Divider -->
    <div style="height: 1px; background-color: #1f1832; margin: 0 24px;"></div>

    <div style="padding: 24px;">
      
      <!-- Success Banner -->
      <div style="margin-bottom: 20px;">
        <div style="color: #ffffff; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          تم إنشاء النسخة الاحتياطية بنجاح 💾
        </div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">
          نؤكد لك أنه تم توليد لقطة كاملة لقاعدة بيانات المحل وتضمين الملف كاملاً بهذه الرسالة.
        </div>
      </div>

      <!-- File Highlight Card -->
      <div style="background-color: #130f24; border: 1px solid #2d2249; border-radius: 14px; padding: 16px; margin-bottom: 18px;">
        <div style="color: #a78bfa; font-size: 11px; font-weight: 700; margin-bottom: 4px;">
          اسم الملف المرفق وحجمه
        </div>
        <div style="color: #facc15; font-size: 16px; font-weight: 900; font-family: monospace; direction: ltr; text-align: right;">
          {filename}
        </div>
        <div style="color: #38bdf8; font-size: 13px; font-weight: 800; margin-top: 4px;">
          حجم البيانات: {size_kb:,.1f} كيلوبايت
        </div>
      </div>

      <!-- Meta Info Box -->
      <div style="background-color: #141026; border: 1px solid #231b38; border-radius: 14px; padding: 14px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 6px 4px; color: #94a3b8;">إجمالي الفواتير:</td>
            <td style="padding: 6px 4px; color: #ffffff; font-weight: 700; text-align: left;">{invoices_count:,} فاتورة</td>
          </tr>
          <tr>
            <td style="padding: 6px 4px; color: #94a3b8;">إجمالي الأصناف بالمخزون:</td>
            <td style="padding: 6px 4px; color: #ffffff; font-weight: 700; text-align: left;">{items_count:,} صنف</td>
          </tr>
          <tr>
            <td style="padding: 6px 4px; color: #94a3b8;">سجل العملاء:</td>
            <td style="padding: 6px 4px; color: #ffffff; font-weight: 700; text-align: left;">{customers_count:,} عميل</td>
          </tr>
          <tr>
            <td style="padding: 6px 4px; color: #94a3b8;">توقيت الحفظ:</td>
            <td style="padding: 6px 4px; color: #ffffff; font-weight: 700; text-align: left;">{datetime_formatted}</td>
          </tr>
          <tr>
            <td style="padding: 6px 4px; color: #94a3b8;">تم الحفظ بواسطة:</td>
            <td style="padding: 6px 4px; color: #ffffff; font-weight: 700; text-align: left;">{performed_by}</td>
          </tr>
        </table>
      </div>

      <!-- Cloud Storage Guarantee Note -->
      <div style="background-color: #17122a; border: 1px dashed #7c3aed; border-radius: 12px; padding: 14px; margin-bottom: 22px;">
        <div style="color: #facc15; font-size: 12px; font-weight: 800; margin-bottom: 4px;">
          ☁️ الحفظ السحابي الآمن على بريدك:
        </div>
        <div style="color: #cbd5e1; font-size: 11px; line-height: 1.6;">
          تم إرفاق ملف النسخة الاحتياطية (.json) بهذه الرسالة. طالما هذه الرسالة في بريدك، فإن كامل بيانات متجرك محفوظة سحابياً بأمان ويمكنك تحميلها واستعادتها بضغطة زر واحدة في أي وقت أو عند تغيير جهاز الكمبيوتر.
        </div>
      </div>

      <!-- Security Notice -->
      <div style="background-color: #120e21; border: 1px solid #1f1832; border-radius: 10px; padding: 12px; margin-bottom: 24px; text-align: center;">
        <div style="color: #94a3b8; font-size: 11px;">
          ✓ إشعار آلي صادر من نظام Rizon Pro System Cashier • نسخة احتياطية رسمية
        </div>
      </div>

      <!-- Footer Section -->
      <div style="text-align: center; padding-top: 14px; border-top: 1px solid #1f1832;">
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
          نظام <span style="color: #facc15; font-weight: 700;">Rizon Pro System Cashier</span>
        </div>
        <div style="color: #475569; font-size: 11px;">
          © Rizon Pro System Cashier جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  </div>
</body>
</html>"""

    plain = f"نسخة احتياطية سحابية للنظام - {datetime_formatted} - الملف: {filename}"

    return {"subject": subject, "html": body_html, "plain": plain}


def send_backup_notification(backup_bytes: bytes, filename: str, summary: Dict[str, Any]) -> Dict[str, str]:
    """إرسال ملف النسخة الاحتياطية كمرفق رسمي إلى بريد المدير."""
    mail = build_backup_email(summary)
    attachments = [(filename, backup_bytes, "application/json")]
    return _dispatch_mime_email(mail, f"BACKUP-{filename}", "BACKUP", attachments=attachments)
