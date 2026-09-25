'use strict';

// spirit/test/fixListSeam.js
// A SILENT PUPPET THAT FILES WHAT IT IS TOLD — asserted from the promise.
//
// Written by wsl-claude from the other agent's description of the
// interface, WITHOUT READING fixList.js, for the reason appShellGrant
// was: a suite written from the source cannot disagree with the source.
//
// WHAT IS HIS AND NOT ASSERTED, because he said so and he was right to:
//
//   THE FILENAME. The promise is "an admitted and listed peer's request
//   lands on the owner's disc, attributed, one line per ask". `fixes.md`
//   is an implementation and a suite that pins it pins his choice. So
//   this asks the app's FOLDER what appeared rather than naming a file.
//
//   THE 500. He chose the number before the bounded-and-truthful
//   argument existed. What is promised is TRUNCATE RATHER THAN REFUSE —
//   the line still lands. The number is read from behaviour here, not
//   asserted as a constant.
//
//   THE SINGLE SPACE. What matters is that ONE ASK PRODUCES EXACTLY ONE
//   LINE, because a request carrying a newline must not be able to look
//   like two entries in a list a person acts on. The space is his; the
//   property is the assertion.
//
// AND NOT ASSERTED AT ALL, on his warning: the ORDER two puppets see an
// arrival in. Nothing promises it.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const APP_REL = 'spirit/run/app/fixList';

if (!fs.existsSync(path.join(REPO, APP_REL))) {
  test.fail('fixList: `' + APP_REL + '` is not built yet, so nothing here can run');
  test.reportSuccessFailureCount();
  return;
}

test.startTest('A silent puppet that files what it is told');

const nodeApps = require('../run/js/nodeApps');
const packet = require('../run/js/client/packet.js');

const LISTED = 'LISTED-PEER-KEY';

function world(listed) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fixlist-'));
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  const dir = path.join(root, 'app', 'fixList');
  fs.cpSync(path.join(REPO, APP_REL), dir, { recursive: true });
  // The app requires the shared envelope from two directories up. A copy
  // with no js/ beside it does not mount at all — and a suite whose every
  // assertion then reads "nothing was filed" blames the app for the
  // fixture. Learned once, in appShellGrant, at the cost of two wrong guesses.
  try {
    fs.symlinkSync(path.join(REPO, 'spirit', 'run', 'js'), path.join(root, 'js'), 'junction');
  } catch (e) {
    fs.cpSync(path.join(REPO, 'spirit', 'run', 'js'), path.join(root, 'js'), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, 'allow.json'),
    JSON.stringify({ keys: listed || [LISTED] }, null, 2) + '\n');

  const lines = [];
  let deliver = null;
  const mounted = nodeApps.mountAll({
    rootDir: root,
    arrivals: { subscribe: function (fn) { deliver = fn; return function () {}; } },
    post: function () { return Promise.resolve({ ok: true }); },
    log: function (m) { lines.push(String(m)); },
  });
  // WHAT THE FOLDER HELD BEFORE ANYTHING ARRIVED, so "what appeared" is
  // a measurement rather than a guess at a filename.
  const before = Object.create(null);
  fs.readdirSync(dir).forEach(function (n) {
    try { before[n] = fs.readFileSync(path.join(dir, n), 'utf8'); } catch (e) { before[n] = null; }
  });
  return { root: root, dir: dir, mounted: mounted, lines: lines, before: before,
    deliver: function (m) { if (deliver) deliver(m); } };
}

// Everything the app wrote or changed since it mounted, as text.
function filedIn(w) {
  let out = '';
  fs.readdirSync(w.dir).forEach(function (n) {
    let now = null;
    try { now = fs.readFileSync(path.join(w.dir, n), 'utf8'); } catch (e) { return; }
    if (w.before[n] === undefined || w.before[n] !== now) out += now;
  });
  return out;
}

function ask(from, text, app) {
  const made = packet.encode(app || 'fixList', { verb: 'fix', text: text });
  return { fromKey: from, hash: 'HASH-' + Math.random().toString(16).slice(2), text: made.text };
}

// ── FACELESS ─────────────────────────────────────────────────────────
test.subHeading('silent — no page, nothing that listens');
{
  const offenders = [];
  const stack = [path.join(REPO, APP_REL)];
  while (stack.length) {
    const p = stack.pop();
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) { fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); }); continue; }
    if (/\.(html|htm|css)$/i.test(p)) { offenders.push(path.relative(REPO, p) + ' (a face)'); continue; }
    if (!/\.js$/.test(p)) continue;
    const body = fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/createServer\(|\.listen\(|require\(['"]https?['"]\)/.test(body)) {
      offenders.push(path.relative(REPO, p) + ' (serves)');
    }
  }
  if (!offenders.length) {
    test.check('fixList: no page, no stylesheet, nothing that listens — the arrival is the only door');
  } else {
    test.fail('fixList: THE CODE has a face the document says it does not: ' + offenders.join(', '));
  }
}

// ── A LISTED PEER'S REQUEST LANDS ────────────────────────────────────
test.subHeading('an admitted and listed peer\'s request lands on the owner\'s disc');
{
  const w = world();
  const SAID = 'the kettle needs descaling';
  w.deliver(ask(LISTED, SAID));
  const filed = filedIn(w);
  if (filed.indexOf(SAID) !== -1) {
    test.check('fixList: the request is on the owner\'s disc, in the puppet\'s own folder — asked of the ' +
      'folder rather than of a filename, so this asserts the promise and not his choice of name');
  } else {
    test.fail('fixList: THE CODE filed nothing a listed peer said. Nothing in the app folder changed, ' +
      'and the document promises the request lands');
  }

  if (filed.indexOf(String(LISTED).slice(0, 8)) !== -1 || filed.indexOf(LISTED) !== -1) {
    test.check('fixList: and it is attributed — the line says who asked');
  } else {
    test.fail('fixList: THE CODE filed the text without the asker. The document promises "attributed"');
  }
}

// ── ONE ASK IS ONE LINE, WHATEVER IT CONTAINS ────────────────────────
test.subHeading('one ask is exactly one line, and a newline cannot forge a second');
{
  // MEASURED AS A DELTA, NOT AS A FILE. The first version of this counted
  // every line the folder gained and read 6 for one ask — the app writes
  // a header the first time, and a header is not an entry. That was the
  // fixture blaming the code, caught before it was sent. Two asks and the
  // difference between them cannot be fooled by anything written once.
  const w = world();
  w.deliver(ask(LISTED, 'a plain first request'));
  const one = filedIn(w).replace(/\n+$/, '').split('\n').length;
  w.deliver(ask(LISTED, 'first half\nsecond half\nthird'));
  const two = filedIn(w).replace(/\n+$/, '').split('\n').length;
  const count = two - one;
  if (count === 1) {
    test.check('fixList: a request carrying two newlines produced ONE line — a request cannot be made ' +
      'to look like three entries in a list a person acts on');
  } else {
    test.fail('fixList: THE CODE filed ' + count + ' lines for one ask. The document promises one line ' +
      'per ask, which is what stops a newline forging an entry');
  }
}

// ── TOO LONG IS TRUNCATED, NOT REFUSED ───────────────────────────────
test.subHeading('an over-long request is bounded and still lands');
{
  const w = world();
  const TAIL = 'ZZEND';
  w.deliver(ask(LISTED, 'x'.repeat(4000) + TAIL));
  const filed = filedIn(w);
  const landed = filed.indexOf('xxxx') !== -1;
  const whole = filed.indexOf(TAIL) !== -1;
  if (landed && !whole) {
    test.check('fixList: the over-long request was cut and the line still landed — bounded and truthful ' +
      'beats refused, and a caller that gets nothing can do nothing (THE-REQUESTER-IS-RESPONSIBLE:127)');
  } else if (landed && whole) {
    test.fail('fixList: THE CODE filed the whole 4000-character request. The document promises a cap');
  } else {
    test.fail('fixList: THE CODE filed nothing for an over-long request. The document promises it ' +
      'TRUNCATES rather than refuses — the line still lands');
  }
}

// ── EMPTY FILES NOTHING, AND SAYS SO ─────────────────────────────────
test.subHeading('an empty request is not a line worth keeping');
{
  const w = world();
  const before = w.lines.length;
  w.deliver(ask(LISTED, ''));
  const filed = filedIn(w).trim();
  if (!filed && w.lines.length > before) {
    test.check('fixList: an empty request files nothing and says so — not an error worth refusing, ' +
      'not a line worth keeping');
  } else {
    test.fail('fixList: THE CODE ' + (filed ? 'filed a line for an EMPTY request' : 'filed nothing and ' +
      'said nothing') + '. The document promises nothing filed AND a log line');
  }
}

// ── THE TWO CONTROLS ─────────────────────────────────────────────────
//
// Everything above is "a listed peer's fix lands". Both of these are
// refusals, and a suite of refusals is green on an app that files
// nothing at all — so they only mean something beside the landings above.
test.subHeading('the controls — another app\'s packet, and an unlisted peer');
{
  const w = world();
  w.deliver(ask(LISTED, 'this belongs to somebody else', 'someOtherApp'));
  if (!filedIn(w).trim()) {
    test.check('fixList: a packet addressed to another puppet is not filed — every booted app sees ' +
      'every arrival and filters itself, and this one does');
  } else {
    test.fail('fixList: THE CODE filed a packet addressed to someOtherApp. Each puppet takes only ' +
      'its own');
  }
}
{
  const w = world();
  w.deliver(ask('STRANGER-NOT-ON-THE-LIST', 'let me in'));
  if (!filedIn(w).trim()) {
    test.check('fixList: a peer absent from the puppet\'s contact list files nothing — the gate bites, ' +
      'and the landings above are therefore capable of failing');
  } else {
    test.fail('fixList: THE CODE filed a request from a peer not on the contact list. Being on the ' +
      'list IS the permission');
  }
}

test.reportSuccessFailureCount();
