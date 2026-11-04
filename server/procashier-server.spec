# -*- mode: python ; coding: utf-8 -*-
"""حزمة PyInstaller لسيرفر ProCashier — تُنتج procashier-server.exe واحد.

البناء (من جذر المشروع):
    npm run server:build
أو مباشرة:
    python -m PyInstaller server/procashier-server.spec --noconfirm

الناتج: server/dist/procashier-server.exe
ثم يُنسخ تلقائياً إلى موارد Electron عند `npm run electron:build`.
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(SPECPATH).resolve()
PROJECT_ROOT = SERVER_DIR.parent

hiddenimports = [
    'logging.config',
    'sqlite3',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'email.mime.text',
    'email.mime.multipart',
    'email.mime.image',
    'email.utils',
    'smtplib',
]

a = Analysis(
    [str(SERVER_DIR / 'main.py')],
    pathex=[str(SERVER_DIR)],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas', 'pytest'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='procashier-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,          # نافذة مخفية — السيرفر يعمل في الخلفية
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(PROJECT_ROOT / 'public' / 'icon.ico') if (PROJECT_ROOT / 'public' / 'icon.ico').exists() else None,
)
