@echo off
REM ========================================
REM Remove .env.local from Git Repository
REM Removes file from index while keeping local copy
REM ========================================

REM Configuration
set ENV_FILE=.env.local
set GITIGNORE_FILE=.gitignore
set COMMIT_MESSAGE=Remove .env.local from repository and ignore it
set BRANCH_NAME=main
set EXIT_CODE_SUCCESS=0
set EXIT_CODE_FAILURE=1

REM Messages
set MSG_CHECKING=Checking for %ENV_FILE%...
set MSG_NOT_FOUND="%ENV_FILE%" not found in repo root. Ensure you're running this from the repository root.
set MSG_REMOVING=Removing %ENV_FILE% from git index...
set MSG_REMOVE_FAILED=Failed to git rm --cached %ENV_FILE%. Resolve issues and run commands manually.
set MSG_ADDING_GITIGNORE=Adding %GITIGNORE_FILE% (if changed)...
set MSG_COMMITTING=Committing change...
set MSG_COMMIT_FAILED=Commit failed — maybe there is nothing to commit. Check `git status`.
set MSG_PUSHING=Pushing to origin %BRANCH_NAME%...
set MSG_PUSH_FAILED=Push failed. Check remote or network and run `git push` manually.
set MSG_DONE=Done. Remember to rotate Supabase keys if they were exposed and update Netlify env vars.

REM Check if .env.local exists
echo %MSG_CHECKING%
if not exist "%ENV_FILE%" (
  echo %MSG_NOT_FOUND%
  pause
  exit /b %EXIT_CODE_FAILURE%
)

REM Remove from git index (keeps local file)
echo %MSG_REMOVING%
git rm --cached "%ENV_FILE%"
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_REMOVE_FAILED%
  pause
  exit /b %ERRORLEVEL%
)

REM Stage .gitignore if it was modified
echo %MSG_ADDING_GITIGNORE%
git add "%GITIGNORE_FILE%"

REM Commit the changes
echo %MSG_COMMITTING%
git commit -m "%COMMIT_MESSAGE%"
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_COMMIT_FAILED%
  pause
  exit /b %ERRORLEVEL%
)

REM Push to remote
echo %MSG_PUSHING%
git push origin %BRANCH_NAME%
if %ERRORLEVEL% NEQ %EXIT_CODE_SUCCESS% (
  echo %MSG_PUSH_FAILED%
  pause
  exit /b %ERRORLEVEL%
)

echo %MSG_DONE%
pause