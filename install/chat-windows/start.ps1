# SpiritOS-chat bootstrap. Run from the zip root (beside spirit\).
# Portable Node into .\node\ — no admin, no PATH.
# Wrap later as start.exe (ps2exe, or a 50-line Go stub with the same steps).

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Run = Join-Path $Root 'spirit\run'
$NodeDir = Join-Path $Root 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
$UrlFile = 'https://nodejs.org/dist/latest-v22.x/win-x64/node.exe'

function Have-Node {
  if (Test-Path $NodeExe) { return $NodeExe }
  $fromPath = Get-Command node -ErrorAction SilentlyContinue
  if ($fromPath) { return $fromPath.Source }
  return $null
}

function Ask-Download {
  Add-Type -AssemblyName System.Windows.Forms
  $r = [System.Windows.Forms.MessageBox]::Show(
    "SpiritOS needs Node.js to run the local chat node.`r`n`r`nDownload Node LTS (~30 MB) into this folder? No administrator password.",
    'SpiritOS',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  return $r -eq [System.Windows.Forms.DialogResult]::Yes
}

function Install-PortableNode {
  New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null
  $tmp = Join-Path $env:TEMP 'spiritos-node.exe'
  Write-Host 'Downloading Node.js LTS...'
  Invoke-WebRequest -Uri $UrlFile -OutFile $tmp -UseBasicParsing
  Copy-Item $tmp $NodeExe -Force
  Remove-Item $tmp -Force
  if (-not (Test-Path $NodeExe)) { throw 'Download finished but node.exe is missing.' }
}

if (-not (Test-Path (Join-Path $Run 'js\server.js'))) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    'spirit\run\js\server.js is missing. Unzip the whole SpiritOS-chat folder.',
    'SpiritOS'
  )
  exit 1
}

$bin = Have-Node
if (-not $bin) {
  if (-not (Ask-Download)) { exit 1 }
  try { Install-PortableNode } catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("Could not download Node.`r`n$_", 'SpiritOS')
    exit 1
  }
  $bin = $NodeExe
}

Start-Process "http://127.0.0.1:65432/"
Set-Location $Run
& $bin js\server.js --port 65432
