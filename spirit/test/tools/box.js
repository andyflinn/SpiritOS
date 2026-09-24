'use strict';

// spirit/test/tools/box.js
// WHICH BOX IS THIS, AND WHICH AGENT IS ITS AGENT — resolved, never guessed.
//
// ── WHY THIS EXISTS, AND WHY IT IS AN EXTRACTION AND NOT AN INVENTION ──
//
// Three artefacts written on 2026-09-24 to cure Andy's prompt fatigue each
// hardcoded a different facet of one box and broke on the other:
//
//   vaultGuardBattery v1  hardcoded the box's PATH      — 6 red off its box
//   vaultGuardBattery v2  hardcoded the box's IDENTITY  — 8 red, confidently
//   tools/say.js          hardcoded outbox, self, node and peers, with the
//                         constants placed AFTER process.env so they
//                         OVERRIDE it, which is not a default, it is a lock
//
// The rule that came out of it (claude, agreed by wsl-claude, 2026-09-24):
// A FILE AT A SHARED PATH IS NOT SHARED IF ITS CONTENTS NAME ONE BOX.
// That is worse than two admitted copies, because the instrument then
// claims to be one file while the drift hides inside it.
//
// ── AND THE ANSWER WAS ALREADY IN THE TREE, WHICH IS THE REAL FINDING ──
//
// `spirit/run/brains/hooks/pre-commit` has told the two agents apart since
// 2026-09-21 and does it on the right thing:
//
//   "two checks, both on the process doing the commit, never on where the
//    clone sits: the two clones can each reach the other's files, and only
//    the committer's environment says who is writing"
//       — spirit/run/brains/hooks/pre-commit:82-85 @ 4d157c0
//
//   WSL      `uname -r` contains microsoft, and VSCODE_IPC_HOOK_CLI is set
//   Windows  `uname -s` is MINGW*/MSYS*
//
// THE HOOK IS THE AUTHORITY. This module states the same rule in node's
// terms, because node on Windows sees `win32` and never MINGW. The twin is
// named here so the drift is DETECTABLE rather than merely possible, which
// is `claude/FORMAT.md`'s whole argument — and the battery asserts that the
// two agree on whatever box it runs on.
//
// ── WHAT IT WILL NOT DO ──────────────────────────────────────────────
//
// IT WILL NOT GUESS. A box it cannot identify returns {ok:false} and the
// caller stands down. wsl-claude, handing this over: "an unidentified box
// must not default to either of us; it must skip. A default here is
// exactly the absent-means-everything trap one level down." His v1 proved
// the cost: an unanswerable precondition that reads as a passing one is
// the worst failure available to a test.
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

// THE MEASURED RULE, in node's terms. The shell twin is
// hooks/pre-commit:88-130; see the note above.
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
// Every question below is answered by an environment variable, and on one
// of the two boxes NOTHING SETS THEM. wsl-claude, after producing 17 green
// by hand: "in the one run that produces the board, my box still does not
// exercise the guard. A result that depends on somebody remembering is a
// result that will be missing the day it matters."
//
// That is the inline-pipeline defect one level up: THE KNOWLEDGE LIVES IN
// A STRING SOMEBODY TYPES RATHER THAN AT A PATH. An exported variable dies
// with the session; a file does not.
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
  const p = path.join(__dirname, '..', '..', '..', '.spiritbox');
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
// The first version derived the vault from where this file sits and said
// so proudly: "not a candidate list — a candidate list is how v1 found the
// wrong box's vault." The rejection of the list was right. The replacement
// was the same mistake wearing the other box's clothes.
//
// ON THE WSL BOX THE VAULT IS NOT BESIDE THE CHECKOUT. That agent works in
// an agent clone (SpiritOS-agent-wsl-claude) which has never carried the
// vault; the vault sits in Andy's own checkout, and the installed guard's
// constant says so: WSL_VAULT = '/home/andy/SpiritOS/spirit/run/brains'.
// So `derive from the checkout` is one box's TOPOLOGY, exactly as a
// candidate list was the other box's. wsl-claude, finding it in one run:
// "the assumption is invisible from the box that holds it, and visible in
// one run from the box that does not — so the instrument is the OTHER BOX
// and not more care."
//
// FOUR FOR FOUR, TWO EACH: path, identity, everything, topology. That is
// the honest version of the tally, and it is why neither agent reviews its
// own box assumptions.
//
// THE ANSWER IS THE ONE THIS FILE ALREADY USES TWICE: THE BOX SAYS, AND
// THE FILE DOES NOT INFER. SPIRIT_VAULT first; the checkout-relative guess
// is the FALLBACK and not the rule. A box that can answer neither still
// stands down, because an unset variable and a missing folder both leave
// it unanswered — no list, no default to either agent.
function vaultFrom(start, box) {
  const declared = String(process.env.SPIRIT_VAULT || box.vault || '').trim();
  if (declared) return isVault(declared) ? path.resolve(declared) : null;
  const p = path.join(start, '..', '..', 'run', 'brains');
  return isVault(p) ? path.resolve(p) : null;
}

function resolve() {
  // ENVIRONMENT FIRST. SPIRIT_BOX_AGENT is the explicit override; AGENTS_SELF
  // is what the box already tells agents.js (`agents.js:108`), so a box that
  // has configured one agent has already answered this question once.
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
    // say.js's outbox, resolved by the same order so one file answers every
    // question a box is asked about itself.
    outbox: String(process.env.SPIRIT_OUTBOX || said.outbox || '').trim() || null,
    said: said,
    mine: [me.folder, 'input/' + me.folder, 'output/' + me.folder],
    others: others,
    other: others[0] || null,
  };
}

module.exports = { resolve: resolve, AGENTS: AGENTS };
