'use strict';

// spirit/test/armedButtons.js
// AN ARMED BUTTON DISARMS THE MOMENT ATTENTION MOVES.
//
//   Andy: "on all are-you-sure type buttons, whenever i click anywhere
//   else on the screen (de-activate the button) the button must reset,
//   back to its original state, and the whole are-you-sure procedure must
//   be done from scratch. This is to prevent a user from seeing the
//   are-you-sure and then doing something else then accidentally
//   confirming that they are sure. this must be a hard rule for the UI."
//
// ── THE DANGER IS THE PRESS AFTER THE SECOND PRESS ───────────────────
//
// Not the confirm itself. A person arms Delete, is interrupted, does
// three other things, comes back — and the button under their finger is
// still loaded, so the confirmation they give is to a question they have
// forgotten being asked. Nothing on the screen looks wrong at any point.
//
// ── WHY THIS IS A SUITE AND NOT A PARAGRAPH ──────────────────────────
//
// Eight controls across three apps had two-press confirms, and each
// disarmed on its own terms or not at all. A rule implemented once per
// app is a rule that is true of the apps somebody remembered — and the
// failure is invisible, because an armed button that should have reset
// looks exactly like one that was just armed.
//
// So: the shell owns the mechanism (api.armUntilElsewhere), and this
// finds every app that arms anything and checks it asks for it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_DIR = path.join(RUN_DIR, 'app');
const SHELL = path.join(RUN_DIR, 'js', 'client', 'shell.js');

// Comments stripped first. These files discuss their own buttons at
// length, and a test that greps the source including its comments is a
// test a comment can satisfy — which has been the cause three times in
// this repo now.
function codeOf(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
}

// WHAT ARMING LOOKS LIKE, in the two shapes the tree uses: a flag the app
// keeps (`somethingArmed`) and a marker on the element (`data-armed`).
// Either one means a button that says "press again", and either one is a
// button that has to reset.
function armsSomething(code) {
  return /data-armed/.test(code) || /[A-Za-z]Armed\b/.test(code);
}

test.startTest('An armed button disarms when attention moves');

// ── 1. THE SHELL OWNS IT ─────────────────────────────────────────────

test.subHeading('The mechanism is the shell’s, and it is one mechanism');

const shell = codeOf(SHELL);

if (/armUntilElsewhere:\s*function/.test(shell)) {
  test.check('the shell offers armUntilElsewhere on the app surface');
} else {
  test.fail('no armUntilElsewhere in the shell api');
}

// ── TWO LISTENERS, AND THE REASON IS SUBTLE ─────────────────────────
//
// The obvious version disarms on any click and breaks at once: the click
// that ARMS the button is itself a click, so it would disarm in the same
// gesture that armed it. The capture listener stamps which event is being
// processed; the bubble listener — which runs after the app's own
// delegated handlers, since those are bound inside the container —
// disarms only if the armed state was not created during THIS event.
// Matched on the phase argument each listener ends with, because the
// handler bodies contain semicolons and a lazy `[^;]*` stops inside
// them — which made this fail against a shell that was correct.
const capture = /containerEl\.addEventListener\('click',[\s\S]*?,\s*true\)/.test(shell);
const bubble = /containerEl\.addEventListener\('click',[\s\S]*?,\s*false\)/.test(shell);
if (capture && bubble) {
  test.check('and listens in both phases, so the arming click does not disarm itself');
} else {
  test.fail('the shell does not listen in both phases');
}

if (/armedEvent === ev/.test(shell)) {
  test.check('skipping exactly the event that armed it, rather than guessing with a timer');
} else {
  test.fail('no event identity check — a timer would be a race, not a rule');
}

// ── 2. AND EVERY APP THAT ARMS ANYTHING ASKS FOR IT ──────────────────

test.subHeading('And every app with a two-press button asks for it');

const apps = fs.readdirSync(APP_DIR).filter(function (name) {
  return fs.existsSync(path.join(APP_DIR, name, name + '.js'));
});

const arming = [];
const missing = [];

apps.forEach(function (name) {
  const code = codeOf(path.join(APP_DIR, name, name + '.js'));
  if (!armsSomething(code)) return;
  arming.push(name);
  if (!/armUntilElsewhere/.test(code)) missing.push(name);
});

if (arming.length >= 3) {
  test.check('found ' + arming.length + ' apps with two-press buttons: ' + arming.join(', '));
} else {
  test.fail('only ' + arming.length + ' apps matched — the arming shapes moved: ' + arming.join(', '));
}

if (missing.length === 0) {
  test.check('and every one of them disarms through the shell');
} else {
  test.fail(missing.join(', ') + ' arm a button and never disarm it — see AGENT.md');
}

// ── 3. THE GUARD THAT MAKES THE ABOVE MEAN SOMETHING ─────────────────
//
// A silent `if (someApi && someApi.armUntilElsewhere)` on a handle that
// does not exist passes the check above and does nothing at run time.
// That is not hypothetical: it happened while this was being written —
// relayChat guarded on `rcApi`, a name the file has never had, so the
// disarm was dead code and the suite was green.
//
// So the handle each app guards on has to be one the file actually
// defines or receives.
test.subHeading('And the handle it guards on is one that exists');

const ghosts = [];
arming.forEach(function (name) {
  const code = codeOf(path.join(APP_DIR, name, name + '.js'));
  const calls = code.match(/([A-Za-z_$][\w$]*)\.armUntilElsewhere/g) || [];
  calls.forEach(function (call) {
    const handle = call.split('.')[0];
    // Defined as a variable, or received as a parameter — `function
    // (container, api)` is how the shell hands it over.
    const declared = new RegExp(
      '(var|let|const)\\s+' + handle + '\\b|function\\s*\\([^)]*\\b' + handle + '\\b'
    );
    if (!declared.test(code)) ghosts.push(name + ' -> ' + handle);
  });
});

if (ghosts.length === 0) {
  test.check('no app guards on a name it does not have');
} else {
  test.fail('dead disarm: ' + ghosts.join(', '));
}

test.reportSuccessFailureCount();
