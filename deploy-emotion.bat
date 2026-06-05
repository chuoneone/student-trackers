@echo off
echo ==================================================
echo [One-Click Deploy] Syncing Emotion Tracker Backend and Frontend
echo ==================================================

echo.
echo 1. Pushing Emotion Tracker Backend (backend-emotion)...
cd backend-emotion
call npx clasp push
cd ..

echo.
echo 2. Committing and Pushing files to GitHub...
git add .
git commit -m "update: deploy emotion tracker"
git push origin main

echo.
echo ==================================================
echo SUCCESS: Emotion Tracker deployed!
echo ==================================================
pause
