# Sports Live Hub - Daily SportSRC Cache
# Fetches match data for next 7 days and caches to JSON files
# Run daily via Task Scheduler

$ErrorActionPreference = "Continue"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataPath = Join-Path $scriptPath "data"
$logPath = Join-Path $scriptPath "cache.log"

if (-not (Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
}

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $logPath -Value $logEntry
    Write-Output $logEntry
}

function Fetch-SportSRC {
    param($Category, $DateStr)
    
    $url = "https://api.sportsrc.org/?data=matches&category=$Category"
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
        $data = $response.Content | ConvertFrom-Json
        $items = if ($data.data) { $data.data } else { @() }
        
        $targetDate = [DateTime]::Parse($DateStr)
        $nextDay = $targetDate.AddDays(1)
        
        $dayMatches = $items | Where-Object {
            $matchDate = [DateTimeOffset]::FromUnixTimeMilliseconds($_.date).DateTime
            $matchDate -ge $targetDate -and $matchDate -lt $nextDay
        }
        
        return $dayMatches
    } catch {
        Write-Log "ERROR: Failed to fetch $Category for $DateStr - $($_.Exception.Message)"
        return @()
    }
}

function Convert-ToMatch {
    param($Match, $Category)
    
    $matchDate = [DateTimeOffset]::FromUnixTimeMilliseconds($Match.date).DateTime
    
    return @{
        id = $Match.id
        sport = $Category
        team1 = @{
            name = $Match.teams.home.name
            logo = $Match.teams.home.badge
        }
        team2 = @{
            name = $Match.teams.away.name
            logo = $Match.teams.away.badge
        }
        league = $Match.title
        date = $matchDate.ToString("yyyy-MM-dd")
        time = $matchDate.ToString("HH:mm")
        status = "upcoming"
        timestamp = $Match.date
    }
}

Write-Log "Starting daily SportSRC cache update..."

$categories = @("football", "cricket", "basketball", "tennis")
$today = Get-Date
$dates = @()

for ($i = 0; $i -lt 7; $i++) {
    $date = $today.AddDays($i)
    $dates += $date.ToString("yyyy-MM-dd")
}

foreach ($dateStr in $dates) {
    Write-Log "Fetching matches for $dateStr..."
    
    $allMatches = @{}
    
    foreach ($cat in $categories) {
        $rawMatches = Fetch-SportSRC -Category $cat -DateStr $dateStr
        $converted = @()
        
        foreach ($m in $rawMatches) {
            $converted += Convert-ToMatch -Match $m -Category $cat
        }
        
        $allMatches[$cat] = $converted
        Write-Log "  $cat : $($converted.Count) matches"
    }
    
    $cacheFile = Join-Path $dataPath "sportsrc-$dateStr.json"
    $allMatches | ConvertTo-Json -Depth 10 | Set-Content -Path $cacheFile -Encoding UTF8
    Write-Log "Saved to $cacheFile"
}

$summaryFile = Join-Path $dataPath "sportsrc-summary.json"
$summary = @{
    lastUpdated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    dates = $dates
    categories = $categories
}
$summary | ConvertTo-Json | Set-Content -Path $summaryFile -Encoding UTF8

Write-Log "Cache update complete!"
Write-Log "Summary saved to $summaryFile"
