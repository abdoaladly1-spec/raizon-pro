$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$wpfLib = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF"
$frameworkLib = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319"

$source = Join-Path $PSScriptRoot "..\tools\SetupWizard.cs"
$outExe = Join-Path $PSScriptRoot "..\release\RaiZon Pro Setup 1.0.0.exe"
$icon = Join-Path $PSScriptRoot "..\public\installer.ico"
$art = Join-Path $PSScriptRoot "..\tools\left_art.png"
$appIconPng = Join-Path $PSScriptRoot "..\public\icon.png"
$payload = Join-Path $PSScriptRoot "..\release\payload.zip"

if (-not (Test-Path $payload)) {
    Write-Host "Creating payload.zip first..."
    & (Join-Path $PSScriptRoot "pack-payload.ps1")
}

Write-Host "Compiling RaiZon Pro Setup Wizard..."

# Kill any lingering setup processes before building
Get-Process -Name "*Setup*", "*RaiZon*" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*pro casher*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 500

$args = @(
    "/nologo",
    "/target:winexe",
    "/optimize+",
    "/platform:anycpu",
    "/win32icon:$icon",
    "/lib:$wpfLib,$frameworkLib",
    "/r:PresentationCore.dll,PresentationFramework.dll,WindowsBase.dll,System.dll,System.Xaml.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,System.Windows.Forms.dll,System.Drawing.dll,Microsoft.CSharp.dll",
    "/resource:$payload,AppPayload",
    "/resource:$art,LeftArt",
    "/resource:$appIconPng,AppIcon",
    "/out:$outExe",
    $source
)

& $csc $args

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $outExe).Length / 1MB
    Write-Host ("Setup Wizard compiled successfully: {0:N1} MB" -f $size) -ForegroundColor Green
    Copy-Item $outExe (Join-Path $PSScriptRoot "..\release\RaiZon Pro Setup.exe") -Force
} else {
    Write-Host "Compilation failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
