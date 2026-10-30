"""إعدادات السيرفر - تُقرأ من ملف .env أو متغيرات البيئة."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"


def _load_env_file(path: Path) -> None:
    """قراءة ملف .env بسيط بدون مكتبات خارجية."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().lstrip("\ufeff")
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file(ENV_FILE)

# --- السيرفر ---
HOST = os.environ.get("SERVER_HOST", "0.0.0.0")
PORT = int(os.environ.get("SERVER_PORT", "8087"))
DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "procashier.db"))
# مجلد النسخ الاحتياطية (يُقدر للنسخة المثبتة لأن مجلد التنصيب قد يكون للقراءة فقط)
BACKUP_DIR = Path(os.environ.get("PROCASHIER_BACKUP_DIR") or (BASE_DIR / "backups"))

# مفتاح API: لو مش موجود يتم توليده عشوائياً وحفظه في .env
# عشان تعطّل المصادقة: ضع API_KEY=off
def _ensure_api_key() -> str:
    raw = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    for line in raw.splitlines():
        s = line.strip()
        if s.startswith("API_KEY="):
            value = s.partition("=")[2].strip().strip('"').strip("'")
            if value and value.lower() not in ("off", "none", "disabled"):
                return value
            if value.lower() in ("off", "none", "disabled"):
                return ""
    key = secrets.token_urlsafe(24)
    line = f"API_KEY={key}\n"
    if any(l.strip().startswith("API_KEY=") for l in raw.splitlines()):
        new_lines = []
        replaced = False
        for l in raw.splitlines():
            if l.strip().startswith("API_KEY=") and not replaced:
                new_lines.append(line.rstrip("\n"))
                replaced = True
            else:
                new_lines.append(l)
        raw = "\n".join(new_lines) + "\n"
    else:
        raw = (raw.rstrip("\n") + "\n" + line) if raw.strip() else line
    ENV_FILE.write_text(raw, encoding="utf-8")
    return key


API_KEY = os.environ.get("API_KEY", "").strip()
if not API_KEY:
    API_KEY = _ensure_api_key()
    os.environ["API_KEY"] = API_KEY

# --- البريد الإلكتروني (Gmail SMTP) ---
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()      # حساب Gmail المخصص للتطبيق
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()  # App Password (16 خانة)
EMAIL_FROM = os.environ.get("EMAIL_FROM", "").strip() or SMTP_USER
EMAIL_TO = os.environ.get("EMAIL_TO", "").strip()        # إيميل صاحب المشروع
EMAIL_SUBJECT_PREFIX = os.environ.get("EMAIL_SUBJECT_PREFIX", "[ProCashier]")

# auto  => يبعت فعلي لو Gmail متعملة، غير كده يسجّل محاكاة
# simulation => دايماً يسجّل بدون إرسال
# off => مفيش إيميلات
EMAIL_MODE = os.environ.get("EMAIL_MODE", "auto").strip().lower()

# إرسال إشعار عند كل فاتورة جديدة
NOTIFY_ON_INVOICE = os.environ.get("NOTIFY_ON_INVOICE", "true").strip().lower() in ("1", "true", "yes", "on")


def email_mode() -> str:
    if EMAIL_MODE in ("simulation", "sim", "off", "disabled"):
        return EMAIL_MODE if EMAIL_MODE != "sim" else "simulation"
    if SMTP_USER and SMTP_PASSWORD and EMAIL_TO:
        return "live"
    return "simulation"

