# Máy chủ tĩnh nhỏ để chạy SpeakBoost trên máy (không cần cài Node hay Python).
# Chạy: powershell -ExecutionPolicy Bypass -File serve.ps1   rồi mở http://localhost:8080
# Tùy chọn -AllowSave: cho phép trang trên CHÍNH máy này lưu tệp bài học vào data/units (dùng khi soạn nội dung).
param([int]$Port = 8080, [switch]$AllowSave)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.mp3' = 'audio/mpeg'; '.m4a' = 'audio/mp4'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'
  '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "SpeakBoost dang chay tai http://localhost:$Port  (Ctrl+C de dung)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $req = $ctx.Request
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ($path -eq '') { $path = 'index.html' }

      # Lưu tệp bài học (chỉ khi bật -AllowSave, chỉ vào data/units/unit-NN.json)
      if ($req.HttpMethod -eq 'PUT') {
        if ($AllowSave -and $path -match '^__save/(data/units/unit-\d{2,3}\.json)$') {
          $target = [IO.Path]::GetFullPath((Join-Path $root $Matches[1]))
          $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
          $body = $reader.ReadToEnd(); $reader.Close()
          $null = $body | ConvertFrom-Json   # chỉ lưu khi là JSON hợp lệ
          [IO.File]::WriteAllText($target, $body, (New-Object Text.UTF8Encoding($false)))
          $res.StatusCode = 204
        } else { $res.StatusCode = 403 }
        continue
      }

      $full = [IO.Path]::GetFullPath((Join-Path $root $path))
      if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [IO.File]::ReadAllBytes($full)
        $res.ContentLength64 = $bytes.Length
        if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else {
        $res.StatusCode = 404
      }
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
