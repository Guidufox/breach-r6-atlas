$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Source = 'https://www.r6calls.com/'
try {
  $installedText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'data.js'), [Text.Encoding]::UTF8)
  $installed = ($installedText.Substring($installedText.IndexOf('=') + 1).Trim().TrimEnd(';') | ConvertFrom-Json)
  Write-Host 'Breach: consultando R6Calls...' -ForegroundColor Yellow
  $catalog = Invoke-RestMethod ($Source + 'data/dataMap.json') -TimeoutSec 90
  $available = @($catalog.maps | Where-Object { $m = $_; @($installed.maps | Where-Object { $_.id -eq $m.id -and $_.revision -lt $m.revision }).Count -gt 0 })
  if ($available.Count -eq 0) { Write-Host 'No hay nuevas revisiones para los mapas instalados.'; exit 0 }
  $available | ForEach-Object { Write-Host ($_.id + ' / r' + $_.revision) }
  $choice = Read-Host 'Escribe el ID del mapa que queres descargar'
  $map = $available | Where-Object { $_.id -eq $choice } | Select-Object -First 1
  if (-not $map -or $choice -notmatch '^[a-z]+$') { throw 'ID no valido. No se cambio ningun mapa.' }
  $languages = @{}
  foreach ($lang in @('es','pt-br')) {
    $data = Invoke-RestMethod ($Source + 'language/' + $lang + '.json') -TimeoutSec 90
    $languages[$lang] = @{ calls=$data.calls.$choice; spawns=$data.spawns.$choice; legend=$data.legend }
  }
  $outputDir = Join-Path $PSScriptRoot 'Actualizaciones'
  [IO.Directory]::CreateDirectory($outputDir) | Out-Null
  $temp = Join-Path $outputDir ($choice + '.download.svg')
  try {
    Invoke-WebRequest ($Source + 'img/maps/' + $choice + '.svg') -OutFile $temp -UseBasicParsing -TimeoutSec 120
    $raw = [IO.File]::ReadAllBytes($temp)
    if ($raw.Length -gt 80MB) { throw 'El archivo excede el limite compatible.' }
    $hash = ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($raw))).Replace('-','').ToLowerInvariant()
    $packet = @{app='breach-map-update';version=1;source=$Source;date=[DateTime]::UtcNow.ToString('o');map=$map;sourceSha256=$hash;svg=[Text.Encoding]::UTF8.GetString($raw);languages=$languages}
    $bytes = [Text.Encoding]::UTF8.GetBytes(($packet | ConvertTo-Json -Depth 30 -Compress))
    $target = Join-Path $outputDir ($choice + '-r' + $map.revision + '.json.gz')
    $file = [IO.File]::Create($target)
    try { $gzip = New-Object IO.Compression.GZipStream($file,[IO.Compression.CompressionMode]::Compress); try { $gzip.Write($bytes,0,$bytes.Length) } finally { $gzip.Dispose() } } finally { $file.Dispose() }
    Write-Host ('Guardado: ' + $target) -ForegroundColor Green
    Write-Host 'Abri Breach > Mapas > Importar actualizacion. Revisa el cambio y pulsa Aplicar.'
  } finally { if (Test-Path $temp) { Remove-Item -LiteralPath $temp } }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
