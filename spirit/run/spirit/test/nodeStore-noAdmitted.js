'use strict';

// spirit/run/spirit/test/nodeStore-noAdmitted.js
// NODESTORE.JS MARKS NO ADMITTED, AND ITS TRAFFIC TABLE HAS NO admitted COLUMN (goal/G43.23, item 6, after goal/G43.17; spec: ./nodeStore-noAdmitted.md). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

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

test.startTest('nodeStore-noAdmitted.js: nodeStore.js names no admitted mark, and the traffic table it makes has no admitted column');

(async function () {
  test.subHeading('the traffic log\'s admitted mark: nodeStore');
  const f = path.join(RUN, 'spirit', 'nodeStore.js');
  if (world(f, /module\.exports/)) {
    const h = hits(f, /admit/i);
    ok(!h.length, 'nodeStore.js\'s code names no admitted mark', 'nodeStore.js\'s code still marks or reads admitted: ' + short(h));
  }

  test.subHeading('the node\'s own store makes no admitted column in node.db\'s traffic table');
  const home = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-noadmit-'));
  try {
    let store = null;
    try { store = require(f).open(home); } catch (e) { test.fail('the store did not open on a scratch folder: ' + (e && e.message) + ': nothing judged'); }
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
