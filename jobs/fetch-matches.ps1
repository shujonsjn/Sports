# Daily Match Fetcher
# Protidin SportScore theke live data fetch korbe

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $root "logs\fetch-matches.log"
$dataFile = Join-Path $root "data\matches-cache.json"

# Create folders
$logDir = Split-Path -Parent $logFile
$dataDir = Split-Path -Parent $dataFile
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

function Write-Log {
    param($message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

Write-Log "========================================="
Write-Log "Starting Match Fetch Job"
Write-Log "========================================="

# Sports to fetch
$sports = @("football", "cricket", "basketball", "tennis")

# Load existing cache
$cache = @{}
if (Test-Path $dataFile) {
    try {
        $cache = Get-Content $dataFile -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $cache = @{}
    }
}

$today = Get-Date -Format "yyyy-MM-dd"
$fetchCount = 0

foreach ($sport in $sports) {
    try {
        Write-Log "Fetching $sport..."
        $response = Invoke-WebRequest -Uri "https://sportscore.com/api/widget/matches/?sport=$sport&limit=50" -UseBasicParsing -TimeoutSec 30
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.matches) {
            $cache[$today] = @{
                sport = $sport
                matches = $data.matches
                fetchedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            }
            $fetchCount += $data.matches.Count
            Write-Log "  Found $($data.matches.Count) $sport matches"
        }
    } catch {
        Write-Log "  Error fetching $sport : $($_.Exception.Message)"
    }
}

# Save cache
$cache | ConvertTo-Json -Depth 10 | Set-Content $dataFile -Encoding UTF8

Write-Log "========================================="
Write-Log "Completed! Total matches: $fetchCount"
Write-Log "========================================="
