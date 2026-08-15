# Schedule Daily Update Job
# Windows Task Scheduler e job add korbe

$jobName = "SportsLiveHub-DailyUpdate"
$scriptPath = Join-Path $PSScriptRoot "daily-update.ps1"

Write-Host "Setting up daily update job..." -ForegroundColor Cyan

# Remove existing job if exists
$existingJob = Get-ScheduledTask -TaskName $jobName -ErrorAction SilentlyContinue
if ($existingJob) {
    Unregister-ScheduledTask -TaskName $jobName -Confirm:$false
    Write-Host "Removed existing job" -ForegroundColor Yellow
}

# Create new scheduled task
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At "12:00AM"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $jobName -Action $action -Trigger $trigger -Settings $settings -Description "Daily sports date update for Sports Live Hub"

Write-Host "Job scheduled successfully!" -ForegroundColor Green
Write-Host "Task Name: $jobName" -ForegroundColor White
Write-Host "Schedule: Daily at 12:00 AM" -ForegroundColor White
Write-Host "Script: $scriptPath" -ForegroundColor White

# Run the job now
Write-Host "`nRunning job now..." -ForegroundColor Cyan
& $scriptPath

Write-Host "`nSetup complete!" -ForegroundColor Green
