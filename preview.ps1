param([ValidateRange(1024,65535)][int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$types = @{
    '/index.html' = 'text/html; charset=utf-8'
    '/styles.css' = 'text/css; charset=utf-8'
    '/model.js' = 'text/javascript; charset=utf-8'
    '/app.js' = 'text/javascript; charset=utf-8'
    '/runs.json' = 'application/json; charset=utf-8'
    '/assets/favicon.svg' = 'image/svg+xml'
    '/tests/browser.html' = 'text/html; charset=utf-8'
    '/tests/browser.js' = 'text/javascript; charset=utf-8'
    '/tests/model.test.cjs' = 'text/javascript; charset=utf-8'
}
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Local preview at http://localhost:$Port/"
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 2000
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream)
            $request = $reader.ReadLine()
            if (!$request -or $request -notmatch '^GET (/[^ ]*) HTTP/1\.[01]$') { continue }
            $path = ($Matches[1] -split '\?', 2)[0]
            while ($line = $reader.ReadLine()) { }
            if ($path.StartsWith('/running-from-responsibilities/')) {
                $path = $path.Substring('/running-from-responsibilities'.Length)
            }
            if ($path -eq '/') { $path = '/index.html' }
            if ($types.ContainsKey($path)) {
                $status = '200 OK'
                $content = [IO.File]::ReadAllBytes((Join-Path $root $path.TrimStart('/')))
                $type = $types[$path]
            } else {
                $status = '404 Not Found'
                $content = [Text.Encoding]::UTF8.GetBytes('Not found')
                $type = 'text/plain; charset=utf-8'
            }
            $header = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($content.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $bytes = [Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Write($content, 0, $content.Length)
        } catch [IO.IOException] {
            # Browsers may close speculative connections without a request.
        } finally {
            $client.Dispose()
        }
    }
} finally {
    $listener.Stop()
}
