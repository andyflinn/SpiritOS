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
#  3b. claude-windows-2 127.0.0.1:45442   (D:\SpiritOS-agent-claude-2 — a
#                                           second identity, so the monitor's
#                                           filter has a choice)
#   4. the WSL side     platform/wsl/start-spirit.sh in wsl-claude's clone,
#                       if it exists (wsl-claude's to keep)
#
# The agent's LISTENER is not started here: it runs inside the agent's
# session and is armed by the agent when a sitting opens.

$ErrorActionPreference = 'Continue'
$repo  = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$agent = 'D:\SpiritOS-agent-claude'
$agent2 = 'D:\SpiritOS-agent-claude-2'
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

# 3. THE AGENTS NODES, THROUGH labMaster — like Andy own node.
#
#   Andy, 2026-09-23: "why does he access node starting through anything
#   but labMaster?"
#
# They used to be spawned here directly, which meant the control plane
# knew about every node on this box except the two that post to each
# other all day. Now each is an AGENT row in labMaster (its own clone as
# home, never cloned, never recycled, never swept) and this script only
# asks for it to be started. An agent therefore never spawns a process
# at all — it asks labMaster over HTTP, which is one fewer permission
# either agent needs.
function EnsureAgentNode([string]$id, [int]$port, [string]$runDir) {
  if (-not (Test-Path (Join-Path $runDir "js/server.js"))) { Write-Output ($id + " node: no clone at " + $runDir); return }
  if (-not (Listening 65420)) { Write-Output ($id + " node: no labMaster to ask"); return }

  # The ROW first, always — so labMaster knows about this node even when
  # it is already listening. A 409 means the row is already there, which
  # is the ordinary case and not a problem.
  $body = @{ name = $id; type = "avatar"; kind = "agent"; port = $port; home = ($runDir.Replace([string][char]92, "/")) } | ConvertTo-Json
  try { Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:65420/api/nodes" -Body $body -ContentType "application/json" -TimeoutSec 20 | Out-Null } catch { }

  if (Listening $port) { Write-Output ($id + " node: already running"); return }
  try { Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:65420/api/nodes/" + $id + "/start") -TimeoutSec 30 | Out-Null } catch { }
  Write-Output ($id + " node: " + $(if (WaitFor $port 25) { "started (labMaster)" } else { "DID NOT COME UP" }))
}

EnsureAgentNode "claude-windows" 45440 "$agent\spirit\run"
EnsureAgentNode "claude-windows-2" 45442 "$agent2\spirit\run"

# 4. The WSL side, if wsl-claude has given it a start script.
$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if ($wsl) {
  # No double quotes inside: PowerShell mangles them on the way to wsl.exe.
  $out = & wsl.exe -e bash -lc 'test -x ~/SpiritOS-agent-wsl-claude/platform/wsl/start-spirit.sh && ~/SpiritOS-agent-wsl-claude/platform/wsl/start-spirit.sh || echo wsl: no start script yet' 2>&1
}
