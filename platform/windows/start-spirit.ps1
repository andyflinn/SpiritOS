# platform/windows/start-spirit.ps1
# EVERYTHING SPIRITOS NEEDS ON THIS BOX, IN ONE GO — and only what is down.
#
#   Andy, 2026-09-22: "starting all of them your personal nodes, labMaster
#   and personal node for me should occur in one fell swoop when SpiritOS
#   sessions start."
#
# Run by the VS Code task "SpiritOS: start everything" when the SpiritOS
# folder opens (.vscode/tasks.json, runOn folderOpen), or by hand:
#   powershell -ExecutionPolicy Bypass -File platform\windows\start-spirit.ps1
#
# Each piece is started only if its port is not already listening, so
# running this twice changes nothing. Every process is started detached:
# closing VS Code does not take a node with it.
#
#   1. labMaster        127.0.0.1:65420   (spirit/test/labMaster)
#   2. Andy's work node 127.0.0.1:65432   (through labMaster, its permanent row)
#   3. claude-windows   127.0.0.1:45440   (D:\SpiritOS-agent-claude — the
#                                           Windows agent's own node, AGENT.md)
#   4. the WSL side     platform/wsl/start-spirit.sh in wsl-claude's clone,
#                       if it exists (wsl-claude's to keep)
#
# The agent's LISTENER is not started here: it runs inside the agent's
# session and is armed by the agent when a sitting opens.

$ErrorActionPreference = 'Continue'
$repo  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$agent = 'D:\SpiritOS-agent-claude'
$node  = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Output 'node is not on PATH; nothing started'; exit 1 }

function Listening([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function WaitFor([int]$port, [int]$seconds) {
  for ($i = 0; $i -lt $seconds; $i++) { if (Listening $port) { return $true }; Start-Sleep -Seconds 1 }
  return $false
}

# The keys a node fills in for its proxy (relay-state/proxy.json). A process
# started from a session older than a key change would not see it, so they
# are read from the machine's own settings each time.
foreach ($k in 'GROK_API_KEY', 'GROK_MANAGEMENT_KEY', 'ANTHROPIC_API_KEY') {
  $v = [Environment]::GetEnvironmentVariable($k, 'Machine')
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($k, 'User') }
  if ($v) { Set-Item -Path "env:$k" -Value $v }
}

# 1. labMaster
if (Listening 65420) { Write-Output 'labMaster: already running' }
else {
  Start-Process -FilePath $node -ArgumentList 'spirit/test/labMaster/labMaster.js' -WorkingDirectory $repo -WindowStyle Hidden | Out-Null
  Write-Output ('labMaster: ' + $(if (WaitFor 65420 20) { 'started' } else { 'DID NOT COME UP' }))
}

# 2. Andy's work node, through labMaster — so labMaster owns it, as it does
#    for every restart (AGENT.md, update rule 6).
if (Listening 65432) { Write-Output 'work node: already running' }
elseif (Listening 65420) {
  try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:65420/api/nodes/work/start' -TimeoutSec 30 | Out-Null } catch {}
  Write-Output ('work node: ' + $(if (WaitFor 65432 30) { 'started' } else { 'DID NOT COME UP' }))
}

# 3. The Windows agent's node.
if (Listening 45440) { Write-Output 'claude-windows node: already running' }
elseif (Test-Path "$agent\spirit\run\js\server.js") {
  Start-Process -FilePath $node -ArgumentList 'js/server.js', '--port', '45440' -WorkingDirectory "$agent\spirit\run" -WindowStyle Hidden `
    -RedirectStandardOutput "$agent\node.log" -RedirectStandardError "$agent\node.err" | Out-Null
  Write-Output ('claude-windows node: ' + $(if (WaitFor 45440 20) { 'started' } else { 'DID NOT COME UP' }))
} else { Write-Output "claude-windows node: no clone at $agent" }

# 4. The WSL side, if wsl-claude has given it a start script.
$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if ($wsl) {
  # No double quotes inside: PowerShell mangles them on the way to wsl.exe.
  $out = & wsl.exe -e bash -lc 'test -x ~/SpiritOS-agent-wsl-claude/platform/wsl/start-spirit.sh && ~/SpiritOS-agent-wsl-claude/platform/wsl/start-spirit.sh || echo wsl: no start script yet' 2>&1
  ($out -join "`n") -replace "`0", '' | Write-Output
}
