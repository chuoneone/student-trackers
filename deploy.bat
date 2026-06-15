@echo off
echo ==================================================
echo [One-Click Deploy] Publishing Firebase Grade Tracker Frontend
echo ==================================================

echo.
echo 1. Committing and Pushing all files to GitHub...
git add .
git commit -m "update: automated one-click deploy"
git push origin main

echo.
echo ==================================================
echo SUCCESS: Deploy completed!
echo ==================================================
pause
