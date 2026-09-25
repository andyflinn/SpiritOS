'use strict';

// spirit/test/nodeAppsSeam.js
// THE SEAM THAT MOUNTS PUPPETS — asserted from the promise, not the code.
//
// Written by wsl-claude from design/principles/PUPPETS.md and the other
// agent's description of the interface, WITHOUT READING nodeApps.js.
// That is the whole reason this file is worth having: a suite written
// from the source cannot disagree with the source. Every name used here
// came from a message that said which parts were PROMISES and which were
// merely what he happened to build, and only the promises are asserted.
//
// ── EVERY GUARD HAS A PAIRED POSITIVE ────────────────────────────────
//
// A suite made only of refusals is GREEN ON A HANDLE WHOSE write() IS
// `throw`, and an allow-list suite made only of refusals is green on an
// `allows()` that is `return false`. Both would break every puppet ever
// installed and both would pass. So each refusal below is paired with
// the case that proves the mechanism can say yes.
//
// ── WHEN THIS GOES RED, IT SAYS WHOSE FAULT IT IS ───────────────────
//
// A suite written from a document can be red because the CODE is wrong
// or because the DOCUMENT is wrong, and a failure that does not name its
// side sends somebody to the wrong file. Each failure here says which it
// believes.
//
// NOT ASSERTED, on his explicit warning: the ORDER in which two mounted
// puppets see the same arrival. Both are subscribed, nothing promises
// which is first, and a suite that depended on it would pass here and
// fail on his box.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const SEAM_REL = 'spirit/run/js/nodeApps.js';

function seamThere() { return fs.existsSync(path.join(REPO, SEAM_REL)); }

if (!seamThere()) {
  test.fail('seam: `' + SEAM_REL + '` is not built yet, so nothing here can run');
  test.reportSuccessFailureCount();
  return;
}

test.startTest('The seam that mounts puppets — scope, contacts, and one bad app');

const nodeApps = require('../run/js/nodeApps');

// ── A WORLD: two puppets, one that mounts and one that cannot ────────
//
// The broken one is deliberate and it is the assertion: one bad puppet
// must not stop the node coming up, and must not stop the NEXT puppet
// mounting.
function world() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seam-'));
  const apps = path.join(root, 'app');
  fs.mkdirSync(apps, { recursive: true });

  function plant(name, body, manifest) {
    const dir = path.join(apps, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'),
      JSON.stringify(Object.assign({ name: name, boots: true }, manifest || {}), null, 2));
    fs.writeFileSync(path.join(dir, name + '.js'), body);
    return dir;
  }

  // Alphabetical order puts the broken one FIRST, so "the next app still
  // mounts" is actually exercised rather than accidentally true.
  const brokenDir = plant('aBrokenApp', 'throw new Error("deliberately unloadable");\n');
  const goodDir = plant('bGoodApp',
    'module.exports = { mount: function (api) {\n' +
    '  (global.__seamApis = global.__seamApis || {})[api.name] = api;\n' +
    '} };\n');

  const lines = [];
  const mounted = nodeApps.mountAll({
    rootDir: root,
    arrivals: { subscribe: function () { return function () {}; } },
    post: function () { return Promise.resolve({ ok: true }); },
    log: function (m) { lines.push(String(m)); },
  });
  return {
    root: root, goodDir: goodDir, brokenDir: brokenDir,
    mounted: mounted, lines: lines,
    api: (global.__seamApis || {}).bGoodApp || null,
  };
}

const ALLOW = 'allow.json';

// ── ONE BAD PUPPET DOES NOT TAKE THE NODE WITH IT ────────────────────
test.subHeading('a puppet that cannot load is skipped, and the next one still mounts');
const w = world();

if (!Array.isArray(w.mounted)) {
  test.fail('seam: mountAll did not return an array of mounted names. THE DOCUMENT says it returns ' +
    'the mounted names; the CODE returned ' + JSON.stringify(w.mounted));
} else if (w.mounted.indexOf('bGoodApp') !== -1 && w.mounted.indexOf('aBrokenApp') === -1) {
  test.check('seam: the unloadable puppet is absent from the mounted names and the one after it ' +
    'mounted anyway — a bad require does not stop the node or the next puppet');
} else {
  test.fail('seam: THE CODE disagrees with the promise that a throwing app is skipped and the next ' +
    'still mounts. mounted=' + JSON.stringify(w.mounted));
}

if (w.api) {
  test.check('seam: the mounted puppet was handed its api — mount(api) ran');
} else {
  test.fail('seam: no api reached the mounted puppet, so every assertion below would be vacuous. ' +
    'THE CODE did not call mount(api), or the api is not the shape the document describes');
}

// ── THE CONTACT LIST: THREE CASES, AND ONLY ONE OF THEM SPEAKS ───────
//
// The promise is the THREE-WAY SPLIT, not his wording, so nothing here
// matches the text of a log line — only whether one was produced.
if (w.api) {
  test.subHeading('absent and empty are the owner speaking; broken is the system unable to read him');
  const allowPath = path.join(w.goodDir, ALLOW);
  const stranger = 'KEY-NOT-LISTED';
  const friend = 'KEY-LISTED';

  function linesAfter(fn) {
    const before = w.lines.length;
    fn();
    return w.lines.length - before;
  }

  try { fs.unlinkSync(allowPath); } catch (e) { /* already absent */ }
  const absentSaid = linesAfter(function () { w.api.allows(stranger); });
  if (absentSaid === 0) {
    test.check('seam: an absent contact list is silent — a missing list is the owner saying this ' +
      'puppet has no contacts yet');
  } else {
    test.fail('seam: THE CODE logged ' + absentSaid + ' line(s) for an ABSENT list. The document ' +
      'promises silence, because absent is a statement rather than an error');
  }

  fs.writeFileSync(allowPath, JSON.stringify({ keys: [] }) + '\n');
  const emptySaid = linesAfter(function () { w.api.allows(stranger); });
  if (emptySaid === 0) {
    test.check('seam: an empty contact list is silent too — { "keys": [] } is a statement, not a fault');
  } else {
    test.fail('seam: THE CODE logged ' + emptySaid + ' line(s) for an EMPTY list, which the document ' +
      'promises is as silent as an absent one');
  }

  fs.writeFileSync(allowPath, '{ this is not json');
  const brokeSaid = linesAfter(function () { w.api.allows(stranger); });
  if (brokeSaid === 1) {
    test.check('seam: a contact list that exists and does not parse says so, once — an absence the ' +
      'system chose and an absence it could not read are not the same to the person who wrote the file');
  } else {
    test.fail('seam: THE CODE logged ' + brokeSaid + ' line(s) for a BROKEN list; the document ' +
      'promises exactly one');
  }

  const repeatSaid = linesAfter(function () { w.api.allows(stranger); w.api.allows(stranger); });
  if (repeatSaid === 0) {
    test.check('seam: the same broken content does not say it again — the list is read per ask, so a ' +
      'typo would otherwise speak once per arrival for as long as it stood');
  } else {
    test.fail('seam: THE CODE repeated the diagnostic ' + repeatSaid + ' time(s) for IDENTICAL broken ' +
      'content. The document promises once per distinct content');
  }

  fs.writeFileSync(allowPath, '} a different kind of broken');
  const againSaid = linesAfter(function () { w.api.allows(stranger); });
  if (againSaid === 1) {
    test.check('seam: broken differently says so again — fixing it and breaking it anew is a new fact ' +
      'about the file, not a repeat');
  } else {
    test.fail('seam: THE CODE said ' + againSaid + ' for a DIFFERENT broken content; the document ' +
      'promises it speaks again');
  }

  // ── THE PAIRED POSITIVE. Everything above is a refusal, and all five
  // pass on an `allows()` that is `return false` with a logger that
  // happens to de-duplicate. This is the case that proves the mechanism
  // can say yes at all.
  fs.writeFileSync(allowPath, JSON.stringify({ keys: [friend] }, null, 2) + '\n');
  let allowedSaid = 0;
  let allowed = false;
  allowedSaid = linesAfter(function () { allowed = w.api.allows(friend); });
  if (allowed === true && allowedSaid === 0) {
    test.check('seam: A LISTED PEER IS ALLOWED, and a readable list says nothing — the control, ' +
      'without which every refusal above is green on an allows() that only ever says no');
  } else {
    test.fail('seam: the control failed, so the five assertions above prove nothing: a listed peer was ' +
      (allowed ? 'allowed' : 'REFUSED') + ' and a valid list logged ' + allowedSaid + ' line(s)');
  }

  // ── PER ASK, NOT PER MOUNT ──────────────────────────────────────────
  test.subHeading('the owner edits the list while the node runs, and the next ask obeys it');
  fs.writeFileSync(allowPath, JSON.stringify({ keys: [] }, null, 2) + '\n');
  const afterRevoke = w.api.allows(friend);
  if (allowed === true && afterRevoke === false) {
    test.check('seam: the same peer, two asks, no remount — allowed, then revoked. A mount-time cache ' +
      'would pass any test that asks once, which is why two asks is the assertion');
  } else {
    test.fail('seam: THE CODE did not honour a revocation between two asks (' + allowed + ' then ' +
      afterRevoke + '). The document promises no restart, no remount, no window');
  }
}

// ── THE PUPPET MAY READ ITS AUDIENCE AND NEVER CHOOSE IT ─────────────
if (w.api) {
  test.subHeading('owner-only — a puppet that can write its own guest list has no master');
  const allowPath = path.join(w.goodDir, ALLOW);
  const kept = JSON.stringify({ keys: ['OWNER-WROTE-THIS'] }, null, 2) + '\n';
  fs.writeFileSync(allowPath, kept);

  const spellings = ['allow.json', './allow.json', 'sub/../allow.json', 'ALLOW.JSON'];
  const gotThrough = [];
  spellings.forEach(function (spelling) {
    try {
      w.api.fs.write(spelling, JSON.stringify({ keys: ['PUPPET-CHOSE-THIS'] }));
      gotThrough.push(spelling);
    } catch (e) { /* refused, which is the promise */ }
  });

  // THE ASSERTION IS THE BYTES, NOT THE THROW. Four caught exceptions
  // prove four throws; only the file proves the boundary.
  let after = '';
  try { after = fs.readFileSync(allowPath, 'utf8'); } catch (e) { after = '(unreadable)'; }
  if (!gotThrough.length && after === kept) {
    test.check('seam: the contact list is byte-for-byte what the owner wrote after four spellings ' +
      'tried to replace it — resolved rather than string-compared, so typing it differently is not a way in');
  } else {
    test.fail('seam: THE CODE let the puppet choose its own audience. accepted=' +
      JSON.stringify(gotThrough) + ' changed=' + (after !== kept));
  }

  // THE PAIRED POSITIVE, and it is the one that matters most here: a
  // handle that refuses everything would pass the four cases above and
  // break every puppet in the system.
  let ownWriteOk = false;
  try {
    w.api.fs.write('grants.json', JSON.stringify({ names: {} }));
    ownWriteOk = fs.existsSync(path.join(w.goodDir, 'grants.json'));
  } catch (e) { ownWriteOk = false; }
  if (ownWriteOk) {
    test.check('seam: and the puppet can still write its OWN data — the guard names one file rather ' +
      'than refusing the handle, without which the four refusals above are green on a broken scope');
  } else {
    test.fail('seam: the control failed — the puppet cannot write its own dataset, so the owner-only ' +
      'assertion above proves nothing. THE CODE refuses more than the document says it does');
  }

  // ── AND THE SCOPE ITSELF ────────────────────────────────────────────
  test.subHeading('the folder is where the puppet ends');
  const escapes = ['../escaped.txt', '../../escaped.txt', '/tmp/escaped-absolute.txt'];
  const escaped = [];
  escapes.forEach(function (rel) {
    try { w.api.fs.write(rel, 'out'); escaped.push(rel); } catch (e) { /* refused */ }
  });
  const landedOutside = fs.existsSync(path.join(w.root, 'escaped.txt')) ||
    fs.existsSync(path.join(w.root, 'app', 'escaped.txt'));
  if (!escaped.length && !landedOutside) {
    test.check('seam: a write aimed outside the puppet\'s folder is refused AND nothing appears there — ' +
      'the file system is checked, not just the exception');
  } else {
    test.fail('seam: THE CODE let a puppet write outside its scope. accepted=' + JSON.stringify(escaped) +
      ' landedOutside=' + landedOutside);
  }
}

test.reportSuccessFailureCount();
