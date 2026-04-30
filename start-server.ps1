$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started on http://localhost:$port"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath.TrimStart('/')
    if ($path -eq '') { $path = 'therapist-dashboard.html' }

    $cwd = Get-Location
    $file = Join-Path $cwd $path

    if (Test-Path $file) {
        $ext = [System.IO.Path]::GetExtension($file)
        switch ($ext) {
            '.html' { $response.ContentType = 'text/html' }
            '.css'  { $response.ContentType = 'text/css' }
            '.js'   { $response.ContentType = 'application/javascript' }
            '.png'  { $response.ContentType = 'image/png' }
            '.jpg'  { $response.ContentType = 'image/jpeg' }
            '.jpeg' { $response.ContentType = 'image/jpeg' }
            '.svg'  { $response.ContentType = 'image/svg+xml' }
            '.pdf'  { $response.ContentType = 'application/pdf' }
            default { $response.ContentType = 'application/octet-stream' }
        }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.OutputStream.Close()
    } else {
        $response.StatusCode = 404
        $response.Close()
    }
}

$listener.Stop()
Write-Host "Server stopped"