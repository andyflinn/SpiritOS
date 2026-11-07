'use strict';

// spirit/run/spirit/test/noAdmitHold.js
// ADMIT/HOLD LEFT (goal/G43.23, item 6, after goal/G43.17; spec: ./noAdmitHold.md). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO." G43.17's red (noPreferences.js)
// matched only the quoted words, so these were missed. Each file's code is read with its comments left out, and the
// node's own store is opened on a scratch folder under /tmp to read the traffic table it makes. No node, no port.
// The node verb contact.accept stays (it keeps a contact): only chatClerver's call of it for a held key is judged.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SPIRIT = path.join(RUN, 'spirit');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked (line numbers kept); null when the file is not there.
function code(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}
// The lines of a file's code matching re, as "name:line text".
function hits(file, re) {
  const c = code(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(path.basename(file) + ':' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  return out;
}
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
function world(file, anchor) {
  const c = code(file);
  ok(c !== null && anchor.test(c), 'the world: ' + path.relative(RUN, file) + ' is read, its code holding ' + anchor,
    c === null ? path.relative(RUN, file) + ' is not there: nothing judged' : path.relative(RUN, file) + '\'s code holds no ' + anchor + ': the comment stripper ate it, nothing judged');
  return c !== null;
}

test.startTest('noAdmitHold.js: the admitted mark, heldActions, chatClerver\'s held path and the preferences migration, gone (goal/G43.23 item 6)');

(async function () {
  test.subHeading('the traffic log\'s admitted mark: peerPost, trafficLog, arrivals, nodeStore');
  ['peerPost.js', 'trafficLog.js', 'arrivals.js', 'nodeStore.js'].forEach(function (n) {
    const f = path.join(SPIRIT, n);
    if (!world(f, /module\.exports/)) return;
    const h = hits(f, /admit/i);
    ok(!h.length, n + '\'s code names no admitted mark', n + '\'s code still marks or reads admitted: ' + short(h));
  });

  test.subHeading('the node\'s own store makes no admitted column in node.db\'s traffic table');
  const home = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-noadmit-'));
  try {
    let store = null;
    try { store = require(path.join(SPIRIT, 'nodeStore.js')).open(home); } catch (e) { test.fail('the store did not open on a scratch folder: ' + (e && e.message) + ': nothing judged'); }
    if (store) {
      try { store.close(); } catch (e) { /* closed */ }
      const file = path.join(home, 'spirit', 'state', 'node.db');
      let cols = null;
      try {
        const db = new (require('node:sqlite').DatabaseSync)(file, { readOnly: true });
        cols = db.prepare('PRAGMA table_info(traffic)').all().map(function (r) { return r.name; });
        db.close();
      } catch (e) { test.fail('node.db could not be read: ' + (e && e.message) + ': nothing judged'); }
      if (cols) {
        ok(cols.indexOf('dir') !== -1 && cols.indexOf('hash') !== -1, 'the world: the store made node.db with a traffic table (' + cols.length + ' columns)', 'node.db holds no traffic table of the log\'s: ' + short(cols) + ': nothing judged');
        ok(cols.indexOf('admitted') === -1, 'and that traffic table has no admitted column', 'the traffic table the store makes still has an admitted column');
      }
    }
  } finally {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }

  test.subHeading('the contact row offers no heldActions');
  const row = path.join(SPIRIT, 'element', 'search', 'contact', 'rowElement.js');
  if (world(row, /rowElement\.create\(/)) {
    const h = hits(row, /\bheld/i);
    ok(!h.length, 'the contact row\'s code holds no heldActions, nothing held', 'the contact row still offers held actions: ' + short(h));
  }

  test.subHeading('chatClerver has no held path: no person.held, no contact.accept for a held key');
  const cc = path.join(RUN, 'process', 'js', 'chatClerver', 'chatClerver.js');
  if (world(cc, /'line\.write'/)) {
    const h = hits(cc, /\bheld\b/);
    ok(!h.length, 'chatClerver\'s code asks nothing held', 'chatClerver still asks held: ' + short(h));
    const a = hits(cc, /contact\.accept\b/);
    ok(!a.length, 'and it calls no contact.accept (the node verb itself stays and is not judged here)', 'chatClerver still calls contact.accept: ' + short(a));
  }

  test.subHeading('client/shell.js migrates no preferences');
  const sh = path.join(SPIRIT, 'client', 'shell.js');
  if (world(sh, /function renderDesktop\b/)) {
    const h = hits(sh, /\bmigrateAppIds\b|\bAPP_ID_RENAMES\b|\bwithShellIds\b/);
    ok(!h.length, 'the old shell\'s code holds no preferences migration (migrateAppIds, APP_ID_RENAMES, withShellIds)', 'client/shell.js still migrates preferences: ' + short(h));
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
