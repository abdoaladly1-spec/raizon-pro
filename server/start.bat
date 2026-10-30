@echo off
REM ==========================================================
REM  تشغيل سيرفر ProCashier المركزي
REM  المنفذ: 8087   قاعدة البيانات: server\procashier.db
REM  إعدادات Gmail: عدّل ملف .env
REM ==========================================================
cd /d "%~dp0"
echo Starting ProCashier Server on http://localhost:8087 ...
python main.py
pause
