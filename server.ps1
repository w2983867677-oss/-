# Village Ledger System - local file helper (uses only built-in Windows PowerShell/.NET, no install)
# Purpose: let the browser page write imported data back to data/ledger-data.js and assets/ real files.
# UX: launched hidden by qidong.bat, opens the browser automatically; exits ~25s after the browser closes.
# NOTE: kept ASCII-only on purpose - Windows PowerShell 5.1 reads BOM-less files as the system ANSI
#       codepage (GBK on zh-CN), which would corrupt non-ASCII source and break parsing.

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Definition }
Set-Location $root

$rootFull   = [System.IO.Path]::GetFullPath($root)
$assetsRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'assets'))
$dataFile   = Join-Path $root 'data\ledger-data.js'
$seedFile   = Join-Path $root 'data\ledger-data.seed.js'

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.txt'='text/plain; charset=utf-8';
  '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp';
  '.gif'='image/gif'; '.bmp'='image/bmp'; '.svg'='image/svg+xml'; '.ico'='image/x-icon';
  '.pdf'='application/pdf'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'
}

$ascii = [System.Text.Encoding]::ASCII
$utf8  = [System.Text.Encoding]::UTF8
$CRLF  = [string][char]13 + [string][char]10

# ---- pick a free port and listen on loopback (TcpListener needs no admin / URL reservation) ----
$listener = $null
$port = 0
foreach ($p in 8732..8780) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener -ArgumentList ([System.Net.IPAddress]::Loopback, $p)
    $l.Start()
    $listener = $l; $port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host 'Cannot start local helper: no free port'; exit 1 }

$url = "http://127.0.0.1:$port/index.html"
Write-Host "Village Ledger local helper started: $url"
Write-Host "Just close the browser when done; this window closes itself."
Start-Process $url | Out-Null

$script:lastActive = Get-Date
$idleSeconds = 25

function Write-Response($stream, $code, $ctype, [byte[]]$body) {
  if ($null -eq $body) { $body = New-Object byte[] 0 }
  $head = "HTTP/1.1 $code$CRLF" +
          "Content-Type: $ctype$CRLF" +
          "Content-Length: $($body.Length)$CRLF" +
          "Cache-Control: no-store$CRLF" +
          "Access-Control-Allow-Origin: *$CRLF" +
          "Connection: close$CRLF$CRLF"
  $hb = $ascii.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Write-TextResp($stream, $code, $text) {
  Write-Response $stream $code 'text/plain; charset=utf-8' ($utf8.GetBytes([string]$text))
}

function Handle-Client($client) {
  $client.ReceiveTimeout = 6000
  $client.SendTimeout = 30000
  $stream = $client.GetStream()
  $stream.ReadTimeout = 6000

  # read request headers byte-by-byte until CRLFCRLF (headers are small)
  $headerBytes = New-Object System.Collections.Generic.List[byte]
  while ($true) {
    $b = $stream.ReadByte()
    if ($b -lt 0) { break }
    [void]$headerBytes.Add([byte]$b)
    $n = $headerBytes.Count
    if ($n -ge 4 -and $headerBytes[$n-4] -eq 13 -and $headerBytes[$n-3] -eq 10 -and $headerBytes[$n-2] -eq 13 -and $headerBytes[$n-1] -eq 10) { break }
    if ($n -gt 65536) { break }
  }
  if ($headerBytes.Count -eq 0) { return }

  $headerText = $ascii.GetString($headerBytes.ToArray())
  $lines = $headerText -split "\r\n"
  $parts = $lines[0] -split ' '
  if ($parts.Count -lt 2) { Write-TextResp $stream '400 Bad Request' 'bad request'; return }
  $method = $parts[0]
  $rawPath = $parts[1]

  $hdr = @{}
  for ($i = 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]; if (-not $line) { continue }
    $idx = $line.IndexOf(':'); if ($idx -lt 0) { continue }
    $hdr[$line.Substring(0, $idx).Trim().ToLower()] = $line.Substring($idx + 1).Trim()
  }

  # read request body by Content-Length
  $body = $null
  $clen = 0
  if ($hdr.ContainsKey('content-length')) { [void][int]::TryParse($hdr['content-length'], [ref]$clen) }
  if ($clen -gt 0) {
    $body = New-Object byte[] $clen
    $readTotal = 0
    while ($readTotal -lt $clen) {
      $r = $stream.Read($body, $readTotal, $clen - $readTotal)
      if ($r -le 0) { break }
      $readTotal += $r
    }
  }

  $qi = $rawPath.IndexOf('?')
  $path = if ($qi -ge 0) { $rawPath.Substring(0, $qi) } else { $rawPath }
  $path = [System.Uri]::UnescapeDataString($path)

  $script:lastActive = Get-Date

  # ---- API: heartbeat ----
  if ($path -eq '/__api/ping') { Write-TextResp $stream '200 OK' 'ok'; return }

  # ---- API: write ledger data file ----
  if ($path -eq '/__api/save-data' -and $method -eq 'POST') {
    try {
      if ((Test-Path -LiteralPath $dataFile) -and -not (Test-Path -LiteralPath $seedFile)) {
        Copy-Item -LiteralPath $dataFile -Destination $seedFile -Force
      }
      if ($null -eq $body) { $body = New-Object byte[] 0 }
      [System.IO.File]::WriteAllBytes($dataFile, $body)
      Write-TextResp $stream '200 OK' 'saved'
    } catch { Write-TextResp $stream '500 Server Error' $_.Exception.Message }
    return
  }

  # ---- API: write one photo into assets/ ----
  if ($path -eq '/__api/save-asset' -and $method -eq 'POST') {
    try {
      $rel = ''
      if ($hdr.ContainsKey('x-rel-path')) { $rel = [System.Uri]::UnescapeDataString($hdr['x-rel-path']) }
      if (-not $rel) { Write-TextResp $stream '400 Bad Request' 'missing X-Rel-Path'; return }
      $rel = $rel -replace '/', '\'
      $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $full.StartsWith($assetsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-TextResp $stream '403 Forbidden' 'path outside assets'; return
      }
      $dir = Split-Path -Parent $full
      if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      if ($null -eq $body) { $body = New-Object byte[] 0 }
      [System.IO.File]::WriteAllBytes($full, $body)
      Write-TextResp $stream '200 OK' 'saved'
    } catch { Write-TextResp $stream '500 Server Error' $_.Exception.Message }
    return
  }

  # ---- API: clear assets/imported (called before a full replace import) ----
  if ($path -eq '/__api/clear-imported' -and $method -eq 'POST') {
    try {
      $imp = Join-Path $assetsRoot 'imported'
      if (Test-Path -LiteralPath $imp) {
        Get-ChildItem -LiteralPath $imp -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
      }
      Write-TextResp $stream '200 OK' 'cleared'
    } catch { Write-TextResp $stream '500 Server Error' $_.Exception.Message }
    return
  }

  # ---- API: restore original seed data (backs "reset to initial" after an import) ----
  if ($path -eq '/__api/restore-seed' -and $method -eq 'POST') {
    try {
      if (Test-Path -LiteralPath $seedFile) {
        Copy-Item -LiteralPath $seedFile -Destination $dataFile -Force
        Write-TextResp $stream '200 OK' 'restored'
      } else {
        Write-TextResp $stream '200 OK' 'noseed'
      }
    } catch { Write-TextResp $stream '500 Server Error' $_.Exception.Message }
    return
  }

  # ---- static files ----
  if ($method -eq 'GET' -or $method -eq 'HEAD') {
    $rel = $path.TrimStart('/')
    if (-not $rel) { $rel = 'index.html' }
    $rel = $rel -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-TextResp $stream '403 Forbidden' 'forbidden'; return
    }
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($ext -eq '.ps1' -or $ext -eq '.bat') { Write-TextResp $stream '403 Forbidden' 'forbidden'; return }
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      Write-Response $stream '200 OK' $ct $bytes
    } else {
      Write-TextResp $stream '404 Not Found' 'not found'
    }
    return
  }

  Write-TextResp $stream '405 Method Not Allowed' 'method not allowed'
}

try {
  while ($true) {
    if ($listener.Pending()) {
      $client = $listener.AcceptTcpClient()
      try { Handle-Client $client } catch { } finally { try { $client.Close() } catch { } }
    } else {
      Start-Sleep -Milliseconds 150
      if (((Get-Date) - $script:lastActive).TotalSeconds -gt $idleSeconds) { break }
    }
  }
} finally {
  try { $listener.Stop() } catch { }
}
