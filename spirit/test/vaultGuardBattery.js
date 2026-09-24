'use strict';

// spirit/test/vaultGuardBattery.js
// THE VAULT GUARD, HELD HONEST — a fixed battery at a stable path.
//
//   Andy, 2026-09-24, for the third time in one day and during a close he
//   had himself called: "i still get prompts from wsl during
//   close-operations."
//
// ── WHY THIS IS A FILE AND NOT A ONE-LINER, WHICH IS HALF THE CURE ──
//
// The guard had four real defects and they were found by running it
// against the exact commands a close makes. Every one of those runs was a
// fresh inline pipeline — and AN INLINE PIPELINE IS UNMATCHABLE BY
// CONSTRUCTION: each one is a new string, so each one is a new approval
// dialog, and no amount of approving makes the next one quiet.
//
// A close is precisely when the most one-off commands get run — scanning
// transcripts for his words, checking a ledger, composing blurbs — which
// is why the dialogs cluster exactly where he reports them. So the second
// half of the cure is not in the guard at all: IT IS THAT WORK WHICH WILL
// BE REPEATED LIVES AT A STABLE PATH. `node spirit/test/vaultGuardBattery.js`
// is one command, approvable once, for every close after this one.
//
// The measurement that proves it: the probe written to MEASURE the prompt
// problem popped a dialog in front of him while he was reporting it.
//
// ── WHAT IT ASSERTS ──────────────────────────────────────────────────
//
// A gate may go quiet only where it is CERTAIN and stays loud everywhere
// else. So this battery has two halves and the second matters more: the
// cases that must be SILENT are the close's own work, and the cases that
// must ASK are what rule 4b exists for. A guard tested only on the first
// half is a guard on its way to being switched off.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');

const GUARD = path.join(os.homedir(), '.claude', 'hooks', 'vault-guard.js');

// ── THE BOX THIS RUNS ON, RESOLVED RATHER THAN ASSUMED ──────────────
//
// THIS FILE BROKE MY OWN RULE ON THE DAY I WROTE IT. `PROVING-IT.md`,
// hours earlier: *a world asserts its own preconditions, and when the
// absence of a precondition produces the same observation as the defect
// you are hunting, the precondition is not context — it is the first
// assertion.* This battery hardcoded one box's vault and one box's guard,
// so on any other box it read a MISSING GUARD as a SILENT guard and
// reported six failures about a gate that was not installed. Six red on
// every box but mine, on a board whose honesty is the stated precondition
// for the longer unattended stretches Andy asked for.
//
// A guard that is not there is not a guard that permitted something.
const VAULT_CANDIDATES = [
  '/home/andy/SpiritOS/spirit/run/brains',
  '/mnt/d/SpiritOS/spirit/run/brains',
  path.join(__dirname, '..', 'run', 'brains'),
];
const VAULT = VAULT_CANDIDATES.filter(function (p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
})[0] || null;

function askedBy(input) {
  let out = '';
  try {
    out = execFileSync(process.execPath, [GUARD], {
      input: JSON.stringify(input),
      encoding: 'utf8',
    });
  } catch (e) {
    return { ran: false, why: String((e && e.message) || e) };
  }
  if (!out.trim()) return { ran: true, asked: false, reason: '' };
  let parsed = null;
  try { parsed = JSON.parse(out); } catch (e) { return { ran: true, asked: true, reason: out.slice(0, 120) }; }
  const d = (parsed && parsed.hookSpecificOutput) || {};
  return { ran: true, asked: d.permissionDecision === 'ask', reason: String(d.permissionDecisionReason || '') };
}

function bash(command, cwd) {
  return { tool_name: 'Bash', cwd: cwd || VAULT, tool_input: { command: command } };
}
function write(filePath) {
  return { tool_name: 'Write', cwd: VAULT, tool_input: { file_path: filePath } };
}

test.startTest('The vault guard — silent on a close, loud on rule 4b');

// ── STAND DOWN RATHER THAN REPORT A GATE THAT IS NOT THERE ──────────
//
// Two preconditions, each asserted separately because they fail for
// different reasons and the fixes are different: no guard installed on
// this box, and no vault on this box. Either one makes every assertion
// below meaningless — and, worse, PLAUSIBLE: a missing guard is silent,
// and silence is what half of them assert.
if (!fs.existsSync(GUARD)) {
  test.standsDown('no vault guard is installed on this box (' + GUARD + '). ' +
    'A guard that is not there is not a guard that permitted something, and reporting six ' +
    'failures about an absent gate would make the board red on every box but one');
  test.reportSuccessFailureCount();
  return;
}
if (!VAULT) {
  test.standsDown('this box carries no vault (tried ' + VAULT_CANDIDATES.join(', ') + '), ' +
    'so there is nothing for the guard to be right or wrong about');
  test.reportSuccessFailureCount();
  return;
}
test.check('the guard is installed on this box and the vault resolves to ' + VAULT +
  ' — so the assertions below are about a gate that exists');

// ── HALF ONE: THE CLOSE'S OWN WORK MUST BE SILENT ────────────────────
//
// Each of these fired at Andy at least once. Rules 9a (widened) and 9b
// say filing a closing note into this agent's own input folder needs no
// per-draft yes, and his API ruling says a closing ask carries extract,
// write, compile and push.
test.subHeading('silent — the steps a close consists of');
[
  ['filing a note into input/wsl-claude by redirect',
    bash('perl -0pe s/a/b/ x.md > ../x.md', VAULT + '/input/wsl-claude/suggested')],
  ['writing a note into input/wsl-claude',
    write(VAULT + '/input/wsl-claude/2026-09-24-a-note.md')],
  ['writing a compile page in wsl-claude/',
    write(VAULT + '/wsl-claude/facts/A-PAGE.md')],
  ['appending to the compile ledger',
    bash('cat >> COMPILED.md', VAULT + '/wsl-claude')],
  // Correction 2: an arrow function is not a redirect.
  ['an inline node script containing an arrow function',
    bash('node -e "const a = rows.map(x => x.text)"')],
  // Correction 3: a write that lands outside, in a command that merely
  // MENTIONS the vault. This is the one that fired while the problem was
  // being measured.
  ['a script written to /tmp whose text names vault paths',
    bash('cat > /tmp/probe.sh <<SH\nV=' + VAULT + '/input/wsl-claude\nSH')],
  ['staging by name', bash('git add wsl-claude/INDEX.md input/wsl-claude/x.md')],
].forEach(function (c) {
  const r = askedBy(c[1]);
  if (!r.ran) { test.fail(c[0] + ' — the guard could not be run: ' + r.why); return; }
  if (r.asked) {
    test.fail('ASKED, and should not: ' + c[0] + ' — "' + r.reason.slice(0, 110) + '"');
  } else {
    test.check('silent: ' + c[0]);
  }
});

// ── HALF TWO: WHAT 4b PROTECTS MUST STILL ASK ────────────────────────
//
// THIS HALF IS THE POINT. Andy, 2026-09-24: "current prompts from him are
// about modifying our contract, that s ok." Those prompts are correct,
// wanted, and stay — and a guard that went quiet here would have cured
// the fatigue by removing the protection, which is the trade nobody
// asked for.
test.subHeading('still asks — shared documents, the other agent, the unresolvable');
[
  ['a shared governance document', write(VAULT + '/VAULT_RULES.md')],
  ['the other agent\'s own compile', write(VAULT + '/claude/COMPILED.md')],
  ['a redirect into a shared vault file', bash('echo x > README.md')],
  ['sed -i on a shared vault file', bash('sed -i s/a/b/ VAULT_RULES.md')],
  ['rm inside the other agent\'s folder', bash('rm claude/INDEX.md')],
  ['a command naming brains from outside, unresolvable',
    bash('echo x > SpiritOS/spirit/run/brains/README.md', os.homedir())],
].forEach(function (c) {
  const r = askedBy(c[1]);
  if (!r.ran) { test.fail(c[0] + ' — the guard could not be run: ' + r.why); return; }
  if (r.asked) {
    test.check('asks, correctly: ' + c[0]);
  } else {
    test.fail('SILENT, and must not be: ' + c[0] + ' — rule 4b is what this gate is for');
  }
});

test.reportSuccessFailureCount();
