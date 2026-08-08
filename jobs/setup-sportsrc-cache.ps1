# Setup SportSRC Cache Task Scheduler Job
# Run this script as Administrator

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$cacheScript = Join-Path $scriptPath "sportsrc-cache.ps1"
$taskName = "SportsLiveHub-SportSRCCache"

Write-Host "Setting up SportSRC Cache Task Scheduler job..." -ForegroundColor Cyan

try {
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Task '$taskName' already exists. Removing..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$cacheScript`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "01:00AM"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily SportSRC cache update for Sports Live Hub" | Out-Null

    Write-Host "✅ Task '$taskName' created successfully!" -ForegroundColor Green
    Write-Host "Schedule: Daily at 1:00 AM" -ForegroundColor Gray
    Write-Host "Script: $cacheScript" -ForegroundColor Gray

    Write-Host ""
    Write-Host "Running initial cache..." -ForegroundColor Cyan
    & $cacheScript
    Write-Host ""
    Write-Host "✅ Initial cache complete!" -ForegroundColor Green

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
