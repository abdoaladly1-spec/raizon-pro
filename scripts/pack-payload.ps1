Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = Join-Path $PSScriptRoot "..\release\win-unpacked"
$dest = Join-Path $PSScriptRoot "..\release\payload.zip"

if (Test-Path $dest) {
    Remove-Item -Force $dest
}

Write-Host "Compressing $src to $dest..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dest, [System.IO.Compression.CompressionLevel]::Fastest, $false)

$len = (Get-Item $dest).Length / 1MB
Write-Host ("Payload created successfully: {0:N1} MB" -f $len)
