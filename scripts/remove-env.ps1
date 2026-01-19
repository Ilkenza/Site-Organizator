# PowerShell script to remove .env.local from git index and push change
if (-not (Test-Path -Path .env.local)) {
  Write-Host ".env.local not found in repo root. Run this from the repository root." -ForegroundColor Yellow
  exit 1
}




nWrite-Host "Pushing to origin main..." -ForegroundColor Cyan
ngit push origin main
nif ($LASTEXITCODE -ne 0) { Write-Host "Push failed — run 'git push' manually" -ForegroundColor Red; exit $LASTEXITCODE }
n
nWrite-Host "Done. Rotate Supabase keys if they were exposed and update Netlify env vars." -ForegroundColor Green
nWrite-Host "Adding .gitignore (if changed)" -ForegroundColor Cyan
ngit add .gitignore
n
nWrite-Host "Committing change..." -ForegroundColor Cyan
ngit commit -m 'Remove .env.local from repository and ignore it'
nif ($LASTEXITCODE -ne 0) { Write-Host "Commit failed (maybe nothing to commit)" -ForegroundColor Yellow }nWrite-Host "Removing .env.local from git index..." -ForegroundColor Cyan
ngit rm --cached .env.local
nif ($LASTEXITCODE -ne 0) { Write-Host "git rm failed" -ForegroundColor Red; exit $LASTEXITCODE }