$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()

Write-Host "Server running at http://localhost:8080/"
Write-Host "Press Ctrl+C to stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath

    if ($localPath -eq '/') { $localPath = '/index.html' }

    if ($localPath -eq '/api') {
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
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.StatusCode = 404
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404 - $localPath"
        }
    }

    $response.OutputStream.Close()
}
