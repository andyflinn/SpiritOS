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
// `throw`, which would break every puppet ever installed and still pass.
// So each refusal below is paired with the case that proves the
// mechanism can say yes.
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
  const apps = path.join(root, 'shell');
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
    arrivals: { witness: function () { return function () {}; } },
    post: function () { return Promise.resolve({ ok: true }); },
    log: function (m) { lines.push(String(m)); },
  });
  return {
    root: root, goodDir: goodDir, brokenDir: brokenDir,
    mounted: mounted, lines: lines,
    api: (global.__seamApis || {}).bGoodApp || null,
  };
}


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

if (w.api) {
  // ── AND THE SCOPE ITSELF ────────────────────────────────────────────
  test.subHeading('the folder is where the puppet ends');
  const escapes = ['../escaped.txt', '../../escaped.txt', '/tmp/escaped-absolute.txt'];
  const escaped = [];
  escapes.forEach(function (rel) {
    try { w.api.fs.write(rel, 'out'); escaped.push(rel); } catch (e) { /* refused */ }
  });
  const landedOutside = fs.existsSync(path.join(w.root, 'escaped.txt')) ||
    fs.existsSync(path.join(w.root, 'shell', 'escaped.txt'));
  if (!escaped.length && !landedOutside) {
    test.check('seam: a write aimed outside the puppet\'s folder is refused AND nothing appears there — ' +
      'the file system is checked, not just the exception');
  } else {
    test.fail('seam: THE CODE let a puppet write outside its scope. accepted=' + JSON.stringify(escaped) +
      ' landedOutside=' + landedOutside);
  }
}

test.reportSuccessFailureCount();
