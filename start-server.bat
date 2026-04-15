@echo off
REM This batch file starts a simple HTTP server for the RAYGAIN SYSTEM

echo Starting HTTP Server on Port 8000...
echo.
echo Open your browser and go to: http://localhost:8000/therapist-dashboard.html
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"

REM Using PowerShell to start a simple HTTP server
powershell -NoProfile -Command "& {
    $port = 8000
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add(\"http://localhost:$port/\")
    $listener.Start()
    Write-Host \"Server started on http://localhost:$port\"
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath.TrimStart('/')
        if ($path -eq '') { $path = 'therapist-dashboard.html' }
        
        $file = Join-Path $PSScriptRoot $path
        
        if (Test-Path $file) {
            $response.ContentType = 'text/html'
            $response.StatusCode = 200
            $fileStream = [System.IO.File]::OpenRead($file)
            $fileStream.CopyTo($response.OutputStream)
            $fileStream.Close()
        } else {
            $response.StatusCode = 404
            $response.Close()
        }
    }
    $listener.Stop()
}"
