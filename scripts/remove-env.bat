@echo off
REM Remove .env.local from git index (keeps local file), commit, and push to main
echo Checking for .env.local...
if not exist .env.local (
  echo ".env.local" not found in repo root. Ensure you're running this from the repository root.
  pause
  exit /b 1
)

























pauseecho Done. Remember to rotate Supabase keys if they were exposed and update Netlify env vars.)  exit /b %ERRORLEVEL%  pause  echo Push failed. Check remote or network and run `git push` manually.git push origin main
nif %ERRORLEVEL% NEQ 0 (
necho Pushing to origin main...)  exit /b %ERRORLEVEL%  pause  echo Commit failed — maybe there is nothing to commit. Check `git status`.if %ERRORLEVEL% NEQ 0 (git commit -m "Remove .env.local from repository and ignore it"
necho Committing change...git add .gitignoreecho Adding .gitignore (if changed)...)  exit /b %ERRORLEVEL%  pause  echo Failed to git rm --cached .env.local. Resolve issues and run commands manually.git rm --cached .env.local
nif %ERRORLEVEL% NEQ 0 (necho Removing .env.local from git index...