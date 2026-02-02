#Requires -Version 5.1

<#
.SYNOPSIS
    Removes .env.local from Git repository while keeping local file.

.DESCRIPTION
    This script removes .env.local from the Git index, commits the change,
    and pushes to the main branch. The local file is preserved.

.EXAMPLE
    .\remove-env.ps1
#>

# Configuration
$CONFIG = @{
    EnvFile       = '.env.local'
    GitIgnoreFile = '.gitignore'
    CommitMessage = 'Remove .env.local from repository and ignore it'
    BranchName    = 'main'
    ExitSuccess   = 0
    ExitFailure   = 1
}

# Messages
$MESSAGES = @{
    NotFound        = "$($CONFIG.EnvFile) not found in repo root. Run this from the repository root."
    Removing        = "Removing $($CONFIG.EnvFile) from git index..."
    RemoveFailed    = "git rm failed"
    AddingGitIgnore = "Adding $($CONFIG.GitIgnoreFile) (if changed)"
    Committing      = "Committing change..."
    CommitFailed    = "Commit failed (maybe nothing to commit)"
    Pushing         = "Pushing to origin $($CONFIG.BranchName)..."
    PushFailed      = "Push failed — run 'git push' manually"
    Success         = "Done. Rotate Supabase keys if they were exposed and update Netlify env vars."
}

# Colors
$COLORS = @{
    Error   = 'Red'
    Warning = 'Yellow'
    Info    = 'Cyan'
    Success = 'Green'
}

#region Helper Functions

<#
.SYNOPSIS
    Checks if the environment file exists.
#>
function Test-EnvFileExists {
    return Test-Path -Path $CONFIG.EnvFile
}

<#
.SYNOPSIS
    Removes environment file from Git index.
#>
function Remove-EnvFileFromIndex {
    Write-Host $MESSAGES.Removing -ForegroundColor $COLORS.Info
    git rm --cached $CONFIG.EnvFile
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

<#
.SYNOPSIS
    Stages .gitignore file if modified.
#>
function Add-GitIgnoreFile {
    Write-Host $MESSAGES.AddingGitIgnore -ForegroundColor $COLORS.Info
    git add $CONFIG.GitIgnoreFile
}

<#
.SYNOPSIS
    Commits the staged changes.
#>
function Invoke-GitCommit {
    Write-Host $MESSAGES.Committing -ForegroundColor $COLORS.Info
    git commit -m $CONFIG.CommitMessage
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

<#
.SYNOPSIS
    Pushes changes to remote repository.
#>
function Invoke-GitPush {
    Write-Host $MESSAGES.Pushing -ForegroundColor $COLORS.Info
    git push origin $CONFIG.BranchName
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

#endregion

#region Main Logic

# Check if file exists
if (-not (Test-EnvFileExists)) {
    Write-Host $MESSAGES.NotFound -ForegroundColor $COLORS.Warning
    exit $CONFIG.ExitFailure
}

# Remove from git index
if (-not (Remove-EnvFileFromIndex)) {
    Write-Host $MESSAGES.RemoveFailed -ForegroundColor $COLORS.Error
    exit $LASTEXITCODE
}

# Stage .gitignore
Add-GitIgnoreFile

# Commit the changes
if (-not (Invoke-GitCommit)) {
    Write-Host $MESSAGES.CommitFailed -ForegroundColor $COLORS.Warning
}

# Push to remote
if (-not (Invoke-GitPush)) {
    Write-Host $MESSAGES.PushFailed -ForegroundColor $COLORS.Error
    exit $LASTEXITCODE
}

# Success message
Write-Host $MESSAGES.Success -ForegroundColor $COLORS.Success

#endregion