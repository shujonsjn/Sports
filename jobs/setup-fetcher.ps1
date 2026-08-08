# Schedule Match Fetcher Job
# Protidin data fetch korbe

$jobName = "SportsLiveHub-FetchMatches"
$scriptPath = Join-Path $PSScriptRoot "fetch-matches.ps1"

Write-Host "Setting up match fetcher job..." -ForegroundColor Cyan

# Remove existing
$existing = Get-ScheduledTask -TaskName $jobName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $jobName -Confirm:$false
}

# Create task - runs every 6 hours
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $jobName -Action $action -Trigger $trigger -Settings $settings -Description "Fetch live sports matches every 6 hours"

Write-Host "Job scheduled: Every 6 hours" -ForegroundColor Green
Write-Host "Running now..." -ForegroundColor Cyan

& $scriptPath

Write-Host "`nDone!" -ForegroundColor Green
