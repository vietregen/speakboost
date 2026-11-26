# Máy chủ tĩnh nhỏ để chạy SpeakBoost trên máy (không cần cài Node hay Python).
# Chạy: powershell -ExecutionPolicy Bypass -File serve.ps1   rồi mở http://localhost:8080
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.mp3' = 'audio/mpeg'; '.m4a' = 'audio/mp4'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "SpeakBoost dang chay tai http://localhost:$Port  (Ctrl+C de dung)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    $res = $ctx.Response
    if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
}
