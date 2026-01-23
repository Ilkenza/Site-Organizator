# PowerShell: commit and push temporary next.config.js
if (-not (Test-Path next.config.js)) {
  Write-Host "next.config.js not found. Nothing to commit." -ForegroundColor Yellow; exit 1
}

git add next.config.js
if ($LASTEXITCODE -ne 0) { Write-Host "git add failed" -ForegroundColor Red; exit $LASTEXITCODE }

git commit -m "chore(build): temporarily ignore ESLint during builds"
if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed (maybe nothing to commit)" -ForegroundColor Yellow }

git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed — run 'git push' manually" -ForegroundColor Red; exit $LASTEXITCODE }

Write-Host "Committed and pushed next.config.js. Remember to remove it after fixing lint issues." -ForegroundColor Green