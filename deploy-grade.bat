@echo off
echo ==================================================
echo [One-Click Deploy] Syncing Grade Tracker Backend and Frontend
echo ==================================================

echo.
echo 1. Pushing Grade Tracker Backend (backend-grade)...
cd backend-grade
call npx clasp push
cd ..

echo.
echo 2. Committing and Pushing files to GitHub...
git add .
git commit -m "update: deploy grade tracker"
git push origin main

echo.
echo ==================================================
echo SUCCESS: Grade Tracker deployed!
echo ==================================================
pause
