# SpeakBoost · Tạo tệp âm thanh mẫu cho một Unit bằng giọng đọc có sẵn của Windows.
# Cách chạy (PowerShell, trong thư mục speakboost):
#   powershell -ExecutionPolicy Bypass -File tools\make-audio.ps1 -Unit 1
# Kết quả:
#   assets/audio/u1/<mã>.wav  – mỗi câu một tệp (tên tệp theo nội dung câu, đổi chữ thì tệp mới)
#   data/audio/unit-01.json   – bảng tra: câu → tệp. Câu nào không có trong bảng thì trang dùng giọng máy.
param(
  [int]$Unit = 1,
  [string]$Voice = 'Microsoft Zira Desktop',
  [int]$Rate = -1
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = Split-Path -Parent $PSScriptRoot
$nn = '{0:D2}' -f $Unit
$unitFile = Join-Path $root "data\units\unit-$nn.json"
$outDir = Join-Path $root "assets\audio\u$Unit"
$manifestFile = Join-Path $root "data\audio\unit-$nn.json"
New-Item -ItemType Directory -Force $outDir, (Split-Path $manifestFile) | Out-Null

$u = [IO.File]::ReadAllText($unitFile, $utf8) | ConvertFrom-Json

# Gom mọi câu mà học sinh có thể bấm nghe.
$texts = New-Object System.Collections.Generic.List[string]
function Add-Text($t) { if ($t -and "$t".Trim()) { $texts.Add("$t".Trim()) } }
foreach ($v in @($u.vocabulary)) { Add-Text $v.word; Add-Text $v.example }
foreach ($p in @($u.patterns)) { Add-Text $p.text; Add-Text $p.free_example }
foreach ($d in @($u.dialogues)) { foreach ($t in @($d.turns)) { Add-Text $t.text } }
foreach ($r in @($u.roleplays)) { foreach ($t in @($r.turns)) { Add-Text $t.bot; Add-Text $t.hint }; Add-Text $r.closing }
foreach ($p in @($u.picture_tasks)) { foreach ($k in '1','2','3') { if ($p.prompts.$k) { Add-Text $p.prompts.$k.model_answer } } }
$unique = $texts | Sort-Object -Unique

$sha = [Security.Cryptography.SHA1]::Create()
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

# Cắt khoảng lặng đầu/cuối (giọng Windows chèn sẵn ~0,5 giây), giữ lại 0,08 giây cho tự nhiên.
function Trim-Silence([string]$path) {
  $b = [IO.File]::ReadAllBytes($path)
  # tìm khối 'data'
  $i = 12; $dataPos = -1; $dataLen = 0
  while ($i -lt $b.Length - 8) {
    $id = [Text.Encoding]::ASCII.GetString($b, $i, 4); $len = [BitConverter]::ToInt32($b, $i + 4)
    if ($id -eq 'data') { $dataPos = $i + 8; $dataLen = $len; break }
    $i += 8 + $len
  }
  if ($dataPos -lt 0) { return }
  $n = [int]($dataLen / 2); $thr = 500; $first = 0; $last = $n - 1
  while ($first -lt $n -and [Math]::Abs([BitConverter]::ToInt16($b, $dataPos + 2 * $first)) -lt $thr) { $first++ }
  while ($last -gt $first -and [Math]::Abs([BitConverter]::ToInt16($b, $dataPos + 2 * $last)) -lt $thr) { $last-- }
  $pad = [int](22050 * 0.08)
  $first = [Math]::Max(0, $first - $pad); $last = [Math]::Min($n - 1, $last + $pad)
  $count = ($last - $first + 1) * 2
  $out = New-Object byte[] (44 + $count)
  [Array]::Copy($b, 0, $out, 0, 12)                                   # RIFF....WAVE
  [Array]::Copy([Text.Encoding]::ASCII.GetBytes('fmt '), 0, $out, 12, 4)
  [Array]::Copy([BitConverter]::GetBytes([int]16), 0, $out, 16, 4)
  [Array]::Copy([BitConverter]::GetBytes([int16]1), 0, $out, 20, 2)   # PCM
  [Array]::Copy([BitConverter]::GetBytes([int16]1), 0, $out, 22, 2)   # mono
  [Array]::Copy([BitConverter]::GetBytes([int]22050), 0, $out, 24, 4)
  [Array]::Copy([BitConverter]::GetBytes([int]44100), 0, $out, 28, 4)
  [Array]::Copy([BitConverter]::GetBytes([int16]2), 0, $out, 32, 2)
  [Array]::Copy([BitConverter]::GetBytes([int16]16), 0, $out, 34, 2)
  [Array]::Copy([Text.Encoding]::ASCII.GetBytes('data'), 0, $out, 36, 4)
  [Array]::Copy([BitConverter]::GetBytes([int]$count), 0, $out, 40, 4)
  [Array]::Copy($b, $dataPos + 2 * $first, $out, 44, $count)
  # Chuẩn hóa âm lượng: đỉnh lớn nhất = 95% (nghe to, rõ hơn trên điện thoại).
  $peak = 1
  for ($k = 44; $k -lt $out.Length; $k += 2) { $v = [Math]::Abs([int][BitConverter]::ToInt16($out, $k)); if ($v -gt $peak) { $peak = $v } }
  $gain = [Math]::Min(4.0, (0.95 * 32767) / $peak)
  if ($gain -gt 1.05) {
    for ($k = 44; $k -lt $out.Length; $k += 2) {
      $s = [int]([BitConverter]::ToInt16($out, $k) * $gain)
      $s = [Math]::Max(-32768, [Math]::Min(32767, $s))
      $bytes = [BitConverter]::GetBytes([int16]$s); $out[$k] = $bytes[0]; $out[$k + 1] = $bytes[1]
    }
  }
  [Array]::Copy([BitConverter]::GetBytes([int](36 + $count)), 0, $out, 4, 4)
  [IO.File]::WriteAllBytes($path, $out)
}

$items = [ordered]@{}
$made = 0
foreach ($t in $unique) {
  $hash = -join ($sha.ComputeHash($utf8.GetBytes($t)) | Select-Object -First 6 | ForEach-Object { $_.ToString('x2') })
  $file = Join-Path $outDir "$hash.wav"
  if (-not (Test-Path $file)) {
    $synth.SetOutputToWaveFile($file, $fmt)
    $synth.Speak($t)
    $synth.SetOutputToNull()
    Trim-Silence $file
    $made++
  }
  $items[$t] = "assets/audio/u$Unit/$hash.wav"
}
$synth.Dispose()

# Xóa tệp cũ không còn câu nào dùng (câu đã sửa chữ).
$keep = @($items.Values | ForEach-Object { Split-Path $_ -Leaf })
$removed = 0
Get-ChildItem $outDir -Filter *.wav | Where-Object { $keep -notcontains $_.Name } | ForEach-Object { Remove-Item $_.FullName; $removed++ }

$manifest = [ordered]@{
  unit = $Unit
  voice = $Voice
  note = 'Giọng đọc máy (Windows) dùng làm mẫu nghe. Giáo viên nghe thử ở trang giáo viên trước khi dùng.'
  created = (Get-Date).ToString('yyyy-MM-dd')
  items = $items
}
[IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json -Depth 4), $utf8)
$size = (Get-ChildItem $outDir -Filter *.wav | Measure-Object Length -Sum).Sum
"Câu: $($unique.Count) · tạo mới: $made · xóa cũ: $removed · tổng dung lượng: $([math]::Round($size/1MB,2)) MB"
