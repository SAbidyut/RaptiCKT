@echo off
rem Windows: double-click this file. Needs PHP (XAMPP's php folder or php.net download) in PATH.
cd /d "%~dp0"
where php >nul 2>nul
if errorlevel 1 (
  if exist "C:\xampp\php\php.exe" ( set "PATH=C:\xampp\php;%PATH%" ) else (
    echo PHP was not found. Install XAMPP ^(https://www.apachefriends.org^) or see README.txt.
    pause
    exit /b 1
  )
)
start "" http://localhost:8000/
php -S localhost:8000 router.php
