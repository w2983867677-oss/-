@echo off
rem 村户慧眼台账系统 - one click launcher
rem Starts a tiny local helper using built-in Windows PowerShell (no install needed),
rem which serves the app and lets imports write back to ledger-data.js and assets/.
rem The browser opens automatically. Just close the browser when done; the helper
rem window closes itself a few seconds later.
cd /d "%~dp0"
start "VillageLedgerServer" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0server.ps1"
exit
