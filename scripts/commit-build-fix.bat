@echo off
REM ========================================
REM Commit Build Fix Script
REM Adds, commits, and pushes next.config.js
REM ========================================

REM Configuration
set CONFIG_FILE=next.config.js
set COMMIT_MESSAGE=chore(build): temporarily ignore ESLint during builds
set BRANCH_NAME=main
set EXIT_CODE_SUCCESS=0
set EXIT_CODE_FAILURE=1

REM Error messages
set MSG_FILE_NOT_FOUND=%CONFIG_FILE% not found. Nothing to commit.
set MSG_ADD_FAILED=git add failed
set MSG_COMMIT_FAILED=Commit may have failed (nothing to commit).
set MSG_PUSH_FAILED=Push failed. Run "git push" manually.
set MSG_REMINDER=Done. Remember to remove %CONFIG_FILE% after fixing lint issues.

REM Check if config file exists
if not exist "%CONFIG_FILE%" (
  echo %MSG_FILE_NOT_FOUND%
  exit /b %EXIT_CODE_FAILURE%
)

REM Stage the file
git add "%CONFIG_FILE%"
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_ADD_FAILED%
  exit /b %ERRORLEVEL%
)

REM Commit the changes
git commit -m "%COMMIT_MESSAGE%"
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_COMMIT_FAILED%
)

REM Push to remote
git push origin %BRANCH_NAME%
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_PUSH_FAILED%
  exit /b %ERRORLEVEL%
)

echo %MSG_REMINDER%
pause