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
const box = require('./tools/box.js');

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
// ── AND THE SUBJECT IS RESOLVED TOO, NOT ONLY THE LOCATION ──────────
//
// v2 of this file made the VAULT box-aware and left the AGENT hardcoded,
// so on the Windows box it asserted that claude's guard must be silent
// about input/wsl-claude/ — and the guard's own refusal said why it was
// not: "is not in claude's folders." Rules 7 and 8 working correctly read
// as four failures, and the two `still asks` cases about claude/ read as
// two more. A suite that names one agent asserts that each guard should
// behave like the other one.
//
// "MY OWN FOLDER" AND "THE OTHER AGENT'S FOLDER" ARE ROLES, NOT PATHS,
// and they swap with whoever is running. So every case below is built
// from MINE and OTHER, and the same fourteen assertions mean the right
// thing on either box. `tools/box.js` answers who this box is, from the
// rule hooks/pre-commit has used since 2026-09-21.
const BOX = box.resolve();
const VAULT = BOX.ok ? BOX.vault : null;
const MINE = BOX.ok ? BOX.agent : null;
const OTHER = BOX.ok ? BOX.other : null;

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
if (!BOX.ok) {
  test.standsDown('this box does not identify its agent — ' + BOX.why + '. ' +
    'An unidentified box must not default to either agent: it would assert that one ' +
    'guard should behave like the other, which is how this suite read eight failures ' +
    'against a guard that was right every time');
  test.reportSuccessFailureCount();
  return;
}
if (!OTHER) {
  test.standsDown('the vault holds only ' + MINE + "'s folders, so there is no other " +
    'agent for the rule 7 and 8 half to be about');
  test.reportSuccessFailureCount();
  return;
}
test.check('the guard is installed on this box and the vault resolves to ' + VAULT +
  ' — so the assertions below are about a gate that exists');
test.check('this box is ' + MINE + ' (' + BOX.source + '), and the other agent is ' + OTHER +
  ' — so "own folder" and "the other agent\'s folder" below mean what they say');

// THE SHELL TWIN MUST AGREE. box.js states in node the rule that
// hooks/pre-commit states in shell, because node on Windows sees win32 and
// never MINGW. Two statements of one rule is the fork this whole day was
// about, so the drift is asserted rather than hoped for: if the box DECLARES
// an agent and the platform MEASURES a different one, that is a box whose
// environment and whose kernel disagree, and no assertion below is safe.
if (!BOX.agreed) {
  test.fail('this box declares agent "' + MINE + '" but measures as "' + BOX.measured +
    '" — the environment and the platform disagree, so one of them is lying about which ' +
    'agent is running, and hooks/pre-commit would refuse a commit this suite calls fine');
} else {
  test.check('the declared agent and the measured platform agree (' + BOX.source + '), so ' +
    'box.js and hooks/pre-commit would name the same agent here');
}

// ── HALF ONE: THE CLOSE'S OWN WORK MUST BE SILENT ────────────────────
//
// Each of these fired at Andy at least once. Rules 9a (widened) and 9b
// say filing a closing note into this agent's own input folder needs no
// per-draft yes, and his API ruling says a closing ask carries extract,
// write, compile and push.
test.subHeading('silent — the steps a close consists of');
[
  ['filing a note into input/' + MINE + ' by redirect',
    bash('perl -0pe s/a/b/ x.md > ../x.md', VAULT + '/input/' + MINE + '/suggested')],
  ['writing a note into input/' + MINE,
    write(VAULT + '/input/' + MINE + '/2026-09-24-a-note.md')],
  ['writing a compile page in ' + MINE + '/',
    write(VAULT + '/' + MINE + '/facts/A-PAGE.md')],
  ['appending to the compile ledger',
    bash('cat >> COMPILED.md', VAULT + '/' + MINE)],
  // Correction 2: an arrow function is not a redirect.
  ['an inline node script containing an arrow function',
    bash('node -e "const a = rows.map(x => x.text)"')],
  // Correction 3: a write that lands outside, in a command that merely
  // MENTIONS the vault. This is the one that fired while the problem was
  // being measured.
  ['a script written to /tmp whose text names vault paths',
    bash('cat > /tmp/probe.sh <<SH\nV=' + VAULT + '/input/' + MINE + '\nSH')],
  ['staging by name', bash('git add ' + MINE + '/INDEX.md input/' + MINE + '/x.md')],
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
  ['the other agent\'s own compile', write(VAULT + '/' + OTHER + '/COMPILED.md')],
  ['a redirect into a shared vault file', bash('echo x > README.md')],
  ['sed -i on a shared vault file', bash('sed -i s/a/b/ VAULT_RULES.md')],
  ['rm inside the other agent\'s folder', bash('rm ' + OTHER + '/INDEX.md')],
  // Rule 2a: input/andy/ is HIS hand, and no agent writes there on either
  // box. It is in this half because it is the one folder whose owner is
  // never the agent running — so it must ask whichever box this is.
  ['Andy\'s own input folder', write(VAULT + '/input/andy/2026-09-24-15-46.md')],
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
