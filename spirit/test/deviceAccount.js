'use strict';

// spirit/test/deviceAccount.js
// THE ACCOUNT NAME ON THE DEVICE PAGE IS A CONSTANT, AND THE CONSTANT IS
// PART OF THE DOCUMENTATION.
//
//   Andy: "because we use the Label as 'Account' in the device page, the
//   password manager creates a new entry for every label change we make:
//   my proposal is: make the Account Field a constant, something
//   explanatory like 'MyDeviceAccountPassword'... so that 1) we generate
//   only one account/password entry for the browser password manager, and
//   2) our documentation of this process is always correct when we say
//   'MyDeviceAccountPassword'."
//
// ── WHY A SUITE AND NOT A LINE IN THE FILE ───────────────────────────
//
// This field has now been a constant, then the public label, then a
// constant again, and each move was reasonable on its own terms. The
// label was put there to fix a crowded password picker ("difficult to
// select from 13 usernames") and made it crowd faster, because renaming
// yourself does not rename a saved credential — it mints another one.
//
// The failure is silent in both directions. Nothing breaks when this
// value changes: enrolment still works, the page looks right, and the
// cost lands weeks later in somebody's password manager as a second
// entry nobody can date. And the string is QUOTED IN THE INSTRUCTIONS,
// so drifting it by a character makes documentation wrong without making
// anything fail.
//
// So the exact text is asserted, and the ways it could quietly stop being
// a constant are asserted with it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const PAGE = path.join(__dirname, '..', 'run', 'device.html');
const html = fs.readFileSync(PAGE, 'utf8');

// The value Andy named, spelled exactly as the instructions spell it.
const ACCOUNT = 'MyDeviceAccountPassword';

// Comments stripped before anything is read off the markup: this page
// discusses its own account field at length and names the old design in
// prose, so a check that grepped the whole file could be satisfied by the
// explanation of why it is not that any more.
const code = html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test.startTest('The device page account name is one constant');

// ── 1. THE STRING ────────────────────────────────────────────────────

test.subHeading('And it is the string the instructions quote');

const field = /<input[^>]*name="username"[^>]*>/.exec(code);

if (field) {
  test.check('there is a username field, which is what a password manager saves against');
} else {
  test.fail('no username field — a lone password field is saved unreliably');
}

const value = field ? (/value="([^"]*)"/.exec(field[0]) || [])[1] : undefined;

if (value === ACCOUNT) {
  test.check('and it carries exactly "' + ACCOUNT + '"');
} else {
  test.fail('account name is ' + JSON.stringify(value) + ', not ' + JSON.stringify(ACCOUNT));
}

// ── 2. AND NOTHING WRITES OVER IT ────────────────────────────────────
//
// This is the half a value check cannot see. The markup held a constant
// for as long as the label design existed too — the label was written
// into it afterwards, from the /api/relay/who answer, so the page shipped
// one string and displayed another.

test.subHeading('And nothing on the page writes a name into it afterwards');

if (!/getElementById\(['"]user['"]\)\s*\.value\s*=/.test(code) &&
    !/\buser\.value\s*=/.test(code)) {
  test.check('no script assigns to the field — what is in the markup is what is saved');
} else {
  test.fail('something writes to the account field at run time');
}

// ── AND THE LABEL IS GONE FROM THE SENTENCE TOO (2026-09-17) ─────────
//
// THIS REVERSES THE CHECK THAT STOOD HERE, which asserted the opposite:
// "you still have to be able to see whose enrolment this is before
// typing a password into it."
//
//   Andy: "the page fulfills its function without being cute and showing
//   a label that the user already knows. Unnecessary for functionality.
//   Kill it." — "the page posts a constant username and a pasted secret.
//   That's all."
//
// The old check was the stated mitigation for the constant account name:
// several of your own nodes on one relay share one password-manager
// entry, and the sentence was what told them apart. That mitigation is
// withdrawn deliberately — the page is not where you work out which
// identity you meant, the link you followed is.
//
// It also could not do the job it appeared to: a label printed by the
// page comes from whoever served the page.
if (!/who-for/.test(code)) {
  test.check('no identity label on the page — a constant username and a pasted secret, and that is all');
} else {
  test.fail('the page is still naming the identity');
}

// AND IT ASKS THE RELAY NOTHING. The label was the only reason this page
// made a request before the person typed anything.
// Comments stripped first: this file keeps a tombstone that NAMES the
// route it no longer calls, and a check that cannot tell prose from code
// would read that as a relapse.
const deviceCode = code.replace(/\/\/.*/g, '');

if (!/\/api\/relay\/who/.test(deviceCode)) {
  test.check('and it fetches nothing before the enrolment post — no roll read from a browser');
} else {
  test.fail('the device page still reads the roll');
}

// ── 3. STATED, NOT ASKED ─────────────────────────────────────────────
//
// A field somebody can edit is a field somebody will edit, and editing
// this one produces a second saved entry — the exact thing the constant
// exists to prevent.

test.subHeading('And it cannot be typed into');

if (field && /\breadonly\b/.test(field[0]) && /tabindex="-1"/.test(field[0])) {
  test.check('readonly and out of the tab order — there is nothing here to fill in');
} else {
  test.fail('the account field is editable or tabbable: ' + (field ? field[0] : ''));
}

// AND IT LOOKS LIKE WHAT IT IS (Andy: "styled more like a heading"). A
// grey dotted box still reads as something that might accept typing, and
// somebody who tries and fails learns nothing about why.
if (/\.account input\[readonly\]\s*\{[^}]*border:\s*none/.test(html) &&
    /\.account input\[readonly\]\s*\{[^}]*font-weight/.test(html)) {
  test.check('and is styled as a heading rather than a box inviting a try');
} else {
  test.fail('the account field is still drawn as a field');
}

// ── 4. THE DOCUMENT THAT ASKED FOR THE OTHER THING ───────────────────
//
// PEER-DEVICES.md section 5 called for the public label in this field,
// and a design document left saying the opposite of the tree is worse
// than one that is silent: it reads as a decision until somebody checks.
// CLAUDE.md's rule for this is to mark the supersession in place rather
// than edit it away, so the check is that the correction is THERE, not
// that the old sentence is gone.

test.subHeading('And the design note that asked for a label says it was superseded');

const doc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'design', 'relay', 'PEER-DEVICES.md'), 'utf8');

if (doc.indexOf(ACCOUNT) !== -1 && /supersed/i.test(doc)) {
  test.check('PEER-DEVICES.md names the constant and marks what it corrects');
} else {
  test.fail('the design document still asks for the label with no correction');
}

test.reportSuccessFailureCount();
