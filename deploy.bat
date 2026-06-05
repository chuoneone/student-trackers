@echo off
echo ==================================================
echo [One-Click Deploy] Syncing GAS Backend and Git Frontend
echo ==================================================

echo.
echo 1. Pushing Grade Tracker Backend (backend-grade)...
cd backend-grade
call npx clasp push
cd ..

echo.
echo 2. Pushing Emotion Tracker Backend (backend-emotion)...
cd backend-emotion
call npx clasp push
cd ..

echo.
echo 3. Committing and Pushing all files to GitHub...
git add .
git commit -m "update: automated one-click deploy"
git push origin main

echo.
echo ==================================================
echo SUCCESS: Deploy completed!
echo ==================================================
pause
