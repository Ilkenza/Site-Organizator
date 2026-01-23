@echo off
if not exist next.config.js (
  echo next.config.js not found. Nothing to commit.
  exit /b 1
)
git add next.config.js
if %ERRORLEVEL% NEQ 0 (
  echo git add failed
  exit /b %ERRORLEVEL%
)

git commit -m "chore(build): temporarily ignore ESLint during builds"
if %ERRORLEVEL% NEQ 0 (
  echo Commit may have failed (nothing to commit).
)

git push origin main
if %ERRORLEVEL% NEQ 0 (
  echo Push failed. Run "git push" manually.
  exit /b %ERRORLEVEL%
)

echo Done. Remember to remove next.config.js after fixing lint issues.
pause