$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()

Write-Host "Server running at http://localhost:8080/"
Write-Host "Press Ctrl+C to stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath

        if ($localPath -eq '/') { $localPath = '/index.html' }

        if ($localPath -eq '/api' -or $localPath -eq '/api/matches') {
            $sport = $request.QueryString['sport']
            $limit = if ($request.QueryString['limit']) { $request.QueryString['limit'] } else { "20" }

            if ($sport) {
                try {
                    $targetUrl = "https://sportscore.com/api/widget/matches/?sport=$sport&limit=$limit"
                    $webClient = New-Object System.Net.WebClient
                    $webClient.Encoding = [System.Text.Encoding]::UTF8
                    $data = $webClient.DownloadString($targetUrl)
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
                    $response.ContentType = 'application/json'
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    Write-Host "200 api - $sport (limit=$limit)"
                } catch {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("Proxy error: $($_.Exception.Message)")
                    $response.StatusCode = 500
                    $response.ContentLength64 = $msg.Length
                    $response.OutputStream.Write($msg, 0, $msg.Length)
                    Write-Host "500 api - $sport"
                }
            } else {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Missing sport parameter")
                $response.StatusCode = 400
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        } elseif ($localPath -eq '/api/espn-cricket') {
            try {
                $targetUrl = "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia/Calcutta"
                $webClient = New-Object System.Net.WebClient
                $webClient.Encoding = [System.Text.Encoding]::UTF8
                $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                $webClient.Headers.Add("Accept", "application/json")
                $data = $webClient.DownloadString($targetUrl)
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
                $response.ContentType = 'application/json'
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "200 api/espn-cricket"
            } catch {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("ESPN proxy error: $($_.Exception.Message)")
                $response.StatusCode = 500
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "500 api/espn-cricket"
            }
        } elseif ($localPath -eq '/api/thesportsdb') {
            $path = $request.QueryString['path']
            if ($path) {
                try {
                    $targetUrl = "https://www.thesportsdb.com/api/v1/json/3/$path"
                    $webClient = New-Object System.Net.WebClient
                    $webClient.Encoding = [System.Text.Encoding]::UTF8
                    $webClient.Headers.Add("User-Agent", "Mozilla/5.0")
                    $data = $webClient.DownloadString($targetUrl)
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
                    $response.ContentType = 'application/json'
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    Write-Host "200 api/thesportsdb - $path"
                } catch {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("TheSportsDB proxy error: $($_.Exception.Message)")
                    $response.StatusCode = 500
                    $response.ContentLength64 = $msg.Length
                    $response.OutputStream.Write($msg, 0, $msg.Length)
                    Write-Host "500 api/thesportsdb"
                }
            } else {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("Missing path parameter")
                $response.StatusCode = 400
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        } elseif ($localPath -eq '/api/nfldata') {
            $season = if ($request.QueryString['season']) { $request.QueryString['season'] } else { "2026" }
            $seasonType = if ($request.QueryString['season_type']) { $request.QueryString['season_type'] } else { "2" }
            try {
                $targetUrl = "https://api.nfldata.org/v1/games?season=$season&season_type=$seasonType"
                $webClient = New-Object System.Net.WebClient
                $webClient.Encoding = [System.Text.Encoding]::UTF8
                $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                $data = $webClient.DownloadString($targetUrl)
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
                $response.ContentType = 'application/json'
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "200 api/nfldata - season=$season type=$seasonType"
            } catch {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("nfldata.org proxy error: $($_.Exception.Message)")
                $response.StatusCode = 500
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "500 api/nfldata"
            }
        } elseif ($localPath -eq '/health') {
            $data = '{"status":"ok"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
            $response.ContentType = 'application/json'
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200 health"
        } elseif ($localPath -eq '/api/sportsrc') {
            $category = if ($request.QueryString['category']) { $request.QueryString['category'] } else { "football" }
            try {
                $targetUrl = "https://api.sportsrc.org/?data=matches&category=$category"
                $webClient = New-Object System.Net.WebClient
                $webClient.Encoding = [System.Text.Encoding]::UTF8
                $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                $data = $webClient.DownloadString($targetUrl)
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($data)
                $response.ContentType = 'application/json'
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "200 api/sportsrc - $category"
            } catch {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("SportSRC proxy error: $($_.Exception.Message)")
                $response.StatusCode = 500
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "500 api/sportsrc"
            }
        } else {
            $filePath = Join-Path $root ($localPath.TrimStart('/'))

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath)
                $mimeTypes = @{
                    '.html' = 'text/html'
                    '.css'  = 'text/css'
                    '.js'   = 'application/javascript'
                    '.json' = 'application/json'
                    '.png'  = 'image/png'
                    '.jpg'  = 'image/jpeg'
                    '.gif'  = 'image/gif'
                    '.svg'  = 'image/svg+xml'
                    '.ico'  = 'image/x-icon'
                }
                $contentType = $mimeTypes[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }

                $content = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $contentType
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
                Write-Host "200 - $localPath"
            } else {
                $ext = [System.IO.Path]::GetExtension($localPath)
                if ($ext -and $ext -ne '') {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $response.StatusCode = 404
                    $response.ContentLength64 = $msg.Length
                    $response.OutputStream.Write($msg, 0, $msg.Length)
                    Write-Host "404 - $localPath"
                } else {
                    $spaPath = Join-Path $root 'index.html'
                    if (Test-Path $spaPath -PathType Leaf) {
                        $content = [System.IO.File]::ReadAllBytes($spaPath)
                        $response.ContentType = 'text/html'
                        $response.ContentLength64 = $content.Length
                        $response.OutputStream.Write($content, 0, $content.Length)
                        Write-Host "SPA - $localPath -> index.html"
                    } else {
                        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                        $response.StatusCode = 404
                        $response.ContentLength64 = $msg.Length
                        $response.OutputStream.Write($msg, 0, $msg.Length)
                        Write-Host "404 - $localPath"
                    }
                }
            }
        }

        $response.OutputStream.Close()
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        try { $response.OutputStream.Close() } catch {}
        try { $response.Close() } catch {}
    }
}
