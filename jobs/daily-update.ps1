# Daily Sports Update Job
# Protidin present date theke 1 year porjonto date update korbe

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $root "logs\daily-update.log"

# Create logs folder if not exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param($message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

Write-Log "========================================="
Write-Log "Starting Daily Sports Update Job"
Write-Log "========================================="

# Calculate date range: today to 1 year ahead
$startDate = Get-Date
$endDate = $startDate.AddYears(1)

Write-Log "Date Range: $($startDate.ToString('yyyy-MM-dd')) to $($endDate.ToString('yyyy-MM-dd'))"

# Generate all dates for the year
$dates = @()
$currentDate = $startDate
while ($currentDate -le $endDate) {
    $dates += $currentDate.ToString('yyyy-MM-dd')
    $currentDate = $currentDate.AddDays(1)
}

Write-Log "Total dates to update: $($dates.Count)"

# Create date cache file
$cacheFile = Join-Path $root "data\date-cache.json"
$dataDir = Split-Path -Parent $cacheFile
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

# Load existing cache or create new
$cache = @{}
if (Test-Path $cacheFile) {
    try {
        $cache = Get-Content $cacheFile -Raw | ConvertFrom-Json -AsHashtable
        Write-Log "Loaded existing cache with $($cache.Count) entries"
    } catch {
        Write-Log "Error loading cache, creating new"
        $cache = @{}
    }
}

# Update cache with all dates
foreach ($date in $dates) {
    if (-not $cache.ContainsKey($date)) {
        $cache[$date] = @{
            date = $date
            status = "pending"
            lastUpdated = $null
        }
    }
}

# Save cache
$cache | ConvertTo-Json -Depth 10 | Set-Content $cacheFile -Encoding UTF8
Write-Log "Saved date cache with $($cache.Count) entries"

# Mark today as active
$today = Get-Date -Format "yyyy-MM-dd"
if ($cache.ContainsKey($today)) {
    $cache[$today].status = "active"
    $cache[$today].lastUpdated = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $cache | ConvertTo-Json -Depth 10 | Set-Content $cacheFile -Encoding UTF8
}

Write-Log "Today ($today) marked as active"

# Summary
Write-Log "========================================="
Write-Log "Job completed successfully!"
Write-Log "Dates cached: $($dates.Count)"
Write-Log "Today: $today"
Write-Log "End date: $($endDate.ToString('yyyy-MM-dd'))"
Write-Log "========================================="
