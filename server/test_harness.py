"""سيرفر معزول للاختبارات: قاعدة مؤقتة + مفتاح API خاص + مجلد نسخ احتياطي مؤقت.

الهدف: ألا تلمس أي اختبارات قاعدة الإنتاج (server/procashier.db) أو مفتاحها
أو مجلد النسخ الاحتياطي الحقيقي.

الاستخدام:
    import test_harness
    base, api_key, stop = test_harness.start()
    ...
    stop()   # يوقف السيرفر ويحذف الملفات المؤقتة

ملاحظة: prepare_env() يجب أن يُستدعى قبل استيراد database/emailer في نفس
العملية لو أردت أن تكتب الاستيرادات داخل العملية على القاعدة المؤقتة نفسها.
"""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Callable, Dict, Optional, Tuple

SERVER_DIR = Path(__file__).resolve().parent
TEST_API_KEY = "test-key-isolated-do-not-use"

_TMP: Optional[Path] = None
_ENV_READY = False
_KEYS = (
    "SERVER_HOST", "SERVER_PORT", "DB_PATH", "PROCASHIER_BACKUP_DIR",
    "API_KEY", "EMAIL_MODE", "NOTIFY_ON_INVOICE", "SMTP_USER",
    "SMTP_PASSWORD", "EMAIL_TO",
)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def prepare_env(prefix: str = "procashier_test_") -> Dict[str, str]:
    """يجهّز متغيرات البيئة المعزولة داخل os.environ ويرجعها.

    يستدعى قبل استيراد database/emailer (التي تقرأ config لمرة واحدة).
    """
    global _TMP, _ENV_READY
    if _ENV_READY and _TMP is not None:
        return {k: os.environ[k] for k in _KEYS}
    _TMP = Path(tempfile.mkdtemp(prefix=prefix))
    port = _free_port()
    env = {
        "SERVER_HOST": "127.0.0.1",
        "SERVER_PORT": str(port),
        "DB_PATH": str(_TMP / "test.db"),
        "PROCASHIER_BACKUP_DIR": str(_TMP / "backups"),
        "API_KEY": TEST_API_KEY,
        "EMAIL_MODE": "simulation",
        "NOTIFY_ON_INVOICE": "true",
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "EMAIL_TO": "tests@example.com",
    }
    os.environ.update(env)
    _ENV_READY = True
    return {k: env[k] for k in _KEYS}


def _health(base: str) -> bool:
    try:
        with urllib.request.urlopen(base + "/health", timeout=1) as resp:
            return resp.status == 200
    except Exception:  # noqa: BLE001
        return False


def start(timeout: float = 30.0) -> Tuple[str, str, Callable[[], None]]:
    """يشغّل سيرفراً معزولاً ويرجع (base_url, api_key, stop)."""
    prepare_env()
    port = os.environ["SERVER_PORT"]
    proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=str(SERVER_DIR),
        env=os.environ.copy(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    base = f"http://127.0.0.1:{port}"
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            stop_process(proc)
            raise RuntimeError(f"isolated server exited early (rc={proc.returncode})")
        if _health(base):
            return base, os.environ["API_KEY"], lambda: stop_process(proc)
        time.sleep(0.2)
    stop_process(proc)
    raise TimeoutError("isolated server did not become healthy in time")


def stop_process(proc: subprocess.Popen) -> None:
    """يوقف السيرفر المعزول ويلغي الملفات المؤقتة."""
    global _TMP
    # 1) نُغلق اتصال SQLite في هذه العملية (لو الاختبار استورد database)
    try:
        import database  # noqa: PLC0415

        database.close_conn()
    except Exception:  # noqa: BLE001
        pass
    # 2) نوقف السيرفر وننتظر انتهاءه حتى يُفلت ملف القاعدة
    try:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
    except Exception:  # noqa: BLE001
        pass
    # 3) محاولات حذف متتالية (Windows قد يبقي القفل لحظة)
    if _TMP is not None:
        target, _TMP = _TMP, None
        for attempt in range(5):
            shutil.rmtree(target, ignore_errors=True)
            if not target.exists():
                return
            time.sleep(0.2)
        shutil.rmtree(target, ignore_errors=True)
