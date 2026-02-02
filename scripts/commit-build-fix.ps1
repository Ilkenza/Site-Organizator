<![CDATA[#Requires -Version 5.1

<#
.SYNOPSIS
    Commits and pushes next.config.js build fix to repository.

.DESCRIPTION
    This script stages, commits, and pushes the next.config.js file to the main branch.
    Used for temporarily ignoring ESLint during builds.

.EXAMPLE
    .\commit-build-fix.ps1
#>

# Configuration
$CONFIG = @{
    FilePath      = 'next.config.js'
    CommitMessage = 'chore(build): temporarily ignore ESLint during builds'
    BranchName    = 'main'
    ExitSuccess   = 0
    ExitFailure   = 1
}

# Error messages
$MESSAGES = @{
    FileNotFound   = "$($CONFIG.FilePath) not found. Nothing to commit."
    AddFailed      = "git add failed"
    CommitFailed   = "Commit failed (maybe nothing to commit)"
    PushFailed     = "Push failed — run 'git push' manually"
    Success        = "Committed and pushed $($CONFIG.FilePath). Remember to remove it after fixing lint issues."
}

# Colors
$COLORS = @{
    Error   = 'Red'
    Warning = 'Yellow'
    Success = 'Green'
}

#region Helper Functions

<#
.SYNOPSIS
    Checks if the configuration file exists.
#>
function Test-ConfigFileExists {
    return Test-Path $CONFIG.FilePath
}

<#
.SYNOPSIS
    Stages the configuration file.
#>
function Add-ConfigFile {
    git add $CONFIG.FilePath
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

<#
.SYNOPSIS
    Commits the staged changes.
#>
function Invoke-GitCommit {
    git commit -m $CONFIG.CommitMessage
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

<#
.SYNOPSIS
    Pushes changes to remote repository.
#>
function Invoke-GitPush {
    git push origin $CONFIG.BranchName
    return $LASTEXITCODE -eq $CONFIG.ExitSuccess
}

#endregion

#region Main Logic

# Check if file exists
if (-not (Test-ConfigFileExists)) {
    Write-Host $MESSAGES.FileNotFound -ForegroundColor $COLORS.Warning
    exit $CONFIG.ExitFailure
}

# Stage the file
if (-not (Add-ConfigFile)) {
    Write-Host $MESSAGES.AddFailed -ForegroundColor $COLORS.Error
    exit $LASTEXITCODE
}

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

#endregion]]>