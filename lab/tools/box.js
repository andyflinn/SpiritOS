'use strict';

// lab/tools/box.js
// WHICH BOX IS THIS, AND WHICH AGENT IS ITS AGENT — resolved, never guessed.
//
// Read by vaultGuardBattery.js and runAll.js.
//
// A FILE AT A SHARED PATH IS NOT SHARED IF ITS CONTENTS NAME ONE BOX.
// That is worse than two admitted copies, because the instrument then
// claims to be one file while the drift hides inside it.
//
// ── THE HOOK IS THE AUTHORITY ────────────────────────────────────────
//
// The vault's `hooks/pre-commit` tells the two agents apart on the process
// doing the commit, never on where the clone sits:
//
//   WSL      `uname -r` contains microsoft, and VSCODE_IPC_HOOK_CLI is set
//   Windows  `uname -s` is MINGW*/MSYS*
//
// This module states the same rule in node's terms, because node on
// Windows sees `win32` and never MINGW. The twin is named here so the
// drift is DETECTABLE rather than merely possible (`claude/FORMAT.md`) —
// and the battery asserts that the two agree on whatever box it runs on.
//
// ── WHAT IT WILL NOT DO ──────────────────────────────────────────────
//
// IT WILL NOT GUESS. A box it cannot identify returns {ok:false} and the
// caller stands down: an unidentified box must not default to either
// agent. An unanswerable precondition that reads as a passing one is the
// worst failure available to a test.
//
// AND THE ENVIRONMENT BEATS THE FILE, always. A constant that overrides
// process.env is a lock, not a default.

const fs = require('fs');
const path = require('path');

// The vault folders an agent owns are named for the agent, and the two
// agents are declared — not sniffed. An unknown name is a stand-down, so a
// third agent arriving is a deliberate edit here rather than a silent
// mis-attribution of somebody's folder.
const AGENTS = {
  'claude': { folder: 'claude', wire: 'claude-windows' },
  'claude-windows': { folder: 'claude', wire: 'claude-windows' },
  'claude-windows-2': { folder: 'claude', wire: 'claude-windows-2' },
  'wsl-claude': { folder: 'wsl-claude', wire: 'wsl-claude' },
};

// THE MEASURED RULE, in node's terms. The shell twin is the vault's
// hooks/pre-commit; see the note above.
function measure() {
  if (process.platform === 'win32') return 'claude';
  if (process.platform === 'linux') {
    let v = '';
    try { v = fs.readFileSync('/proc/version', 'utf8'); } catch (e) { v = ''; }
    if (/microsoft/i.test(v)) return 'wsl-claude';
  }
  return null;
}

// ── WHERE A BOX SAYS THINGS ABOUT ITSELF, ONCE ──────────────────────
//
// Every question below is answered by an environment variable, and a box
// may set none of them. A result that depends on somebody remembering to
// export a variable is a result that will be missing the day it matters:
// an exported variable dies with the session; a file does not.
//
// So `.spiritbox` at the checkout root, gitignored, is the box speaking
// ONCE. It is not a candidate list and it is not inference — it is the
// same answer the environment gives, written down. `.spiritbox.example`
// is tracked and documents the keys.
//
// The alternative was to put these facts in whatever starts the session —
// Andy's ~/.bashrc or his settings — which are HIS files, and would spend
// one of his decisions on a thing the tree can hold.
function spiritbox() {
  const p = path.join(__dirname, '..', '..', '.spiritbox');
  let raw = '';
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { return {}; }
  const out = {};
  raw.split(/\r?\n/).forEach(function (line) {
    const t = line.trim();
    if (!t || t[0] === '#') return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    out[t.slice(0, eq).trim().toLowerCase()] = t.slice(eq + 1).trim();
  });
  return out;
}

function isVault(p) {
  try { return !!p && fs.existsSync(path.join(p, 'VAULT_RULES.md')); }
  catch (e) { return false; }
}

// ── WHERE THE VAULT IS, AND THIS FILE'S OWN BOX ASSUMPTION ──────────
//
// ON THE WSL BOX THE VAULT IS NOT BESIDE THE CHECKOUT: that agent works
// in an agent clone (SpiritOS-agent-wsl-claude) which does not carry the
// vault; the vault sits in Andy's own checkout. So deriving the vault from
// the checkout is one box's topology, not a rule.
//
// THE ANSWER IS THE ONE THIS FILE ALREADY USES TWICE: THE BOX SAYS, AND
// THE FILE DOES NOT INFER. SPIRIT_VAULT first; the checkout-relative guess
// is the FALLBACK and not the rule. A box that can answer neither still
// stands down, because an unset variable and a missing folder both leave
// it unanswered — no list, no default to either agent.
function vaultFrom(start, box) {
  const declared = String(process.env.SPIRIT_VAULT || box.vault || '').trim();
  if (declared) return isVault(declared) ? path.resolve(declared) : null;
  const p = path.join(start, '..', '..', 'spirit', 'run', 'brains');
  return isVault(p) ? path.resolve(p) : null;
}

function resolve() {
  // ENVIRONMENT FIRST. SPIRIT_BOX_AGENT is the explicit override; AGENTS_SELF
  // is an older name for the same answer, still read.
  const said = spiritbox();
  const declared = String(process.env.SPIRIT_BOX_AGENT || process.env.AGENTS_SELF || said.agent || '').trim();
  const measured = measure();
  const name = declared || measured;

  if (!name) {
    return { ok: false, why: 'this box does not say which agent it is: neither SPIRIT_BOX_AGENT nor AGENTS_SELF is set, and the platform is ' + process.platform + ', which is neither Windows nor WSL' };
  }
  const me = AGENTS[name];
  if (!me) {
    return { ok: false, why: 'agent "' + name + '" is not one of the declared agents (' + Object.keys(AGENTS).join(', ') + ')' };
  }

  const vault = vaultFrom(__dirname, said);
  if (!vault) {
    const stated = process.env.SPIRIT_VAULT || said.vault;
    return { ok: false, why: stated
      ? 'the vault is declared as "' + stated + '" (' + (process.env.SPIRIT_VAULT ? 'SPIRIT_VAULT' : '.spiritbox') +
        ') but there is no VAULT_RULES.md there'
      : 'this box does not say where its vault is: SPIRIT_VAULT is unset, no .spiritbox at the checkout root, ' +
        'and none beside this checkout (expected spirit/run/brains/VAULT_RULES.md). On a box whose agent works ' +
        'in a clone of its own, the vault sits elsewhere and only the box can say where — write .spiritbox, ' +
        'see .spiritbox.example' };
  }

  // The OTHER agents are the vault's own agent folders minus mine, read off
  // the disc rather than listed here — so a folder added to the vault is
  // seen without editing this file.
  const others = fs.readdirSync(vault, { withFileTypes: true })
    .filter(function (d) { return d.isDirectory(); })
    .map(function (d) { return d.name; })
    .filter(function (n) {
      if (n === me.folder) return false;
      try { return fs.existsSync(path.join(vault, 'input', n)); } catch (e) { return false; }
    })
    .filter(function (n) { return n !== 'andy'; });

  return {
    ok: true,
    agent: me.folder,
    wire: me.wire,
    source: declared ? 'declared' : 'measured',
    agreed: !declared || !measured || AGENTS[measured].folder === me.folder,
    measured: measured,
    vault: vault,
    // The box's outbox, resolved by the same order so one file answers every
    // question a box is asked about itself.
    outbox: String(process.env.SPIRIT_OUTBOX || said.outbox || '').trim() || null,
    said: said,
    mine: [me.folder, 'input/' + me.folder, 'output/' + me.folder],
    others: others,
    other: others[0] || null,
  };
}

module.exports = { resolve: resolve, AGENTS: AGENTS };
