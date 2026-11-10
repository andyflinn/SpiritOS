'use strict';

// spirit/run/spirit/test/nodeStore.js
// The tests of spirit/nodeStore.js, and of no other module, in this one file (spec: ./nodeStore.md). Its sections: no
// admitted mark (goal/G43.23), after its own. This file holds goal/G41.30: no
// rescue of old stores is left in it (Andy, 2026-11-02: "let's get rid of those \"rescue operations\""). A store is
// opened on a scratch folder that still holds the old address book; the store must leave it as it is, unread.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'nodeStore.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Its code, comments left out.
const code = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');

test.startTest('nodeStore.js: no rescue of old stores is left (goal/G41.30)');

test.subHeading('its code holds no move of an old store');
// The move of goal/G40.11 read four old stores into the seen table on a node's first start: the old seen rows, the
// relays list, apiAuth's peer names and spirit/state/contacts.json, then deleted them.
ok(!/contacts\.json/.test(code), 'it names no contacts.json', 'nodeStore.js still names contacts.json');
ok(!/\bmoveIn\b/.test(code), 'it has no moveIn', 'nodeStore.js still has its moveIn');
ok(!/FROM\s+(relays|peers)\b/i.test(code) && !/has\(\s*['"`](relays|peers)['"`]\s*\)/.test(code), 'it reads no old relays or peers table', 'nodeStore.js still reads an old relays or peers table');

test.subHeading('an old address book beside it is left as it is, unread');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodestore-'));
const state = path.join(home, 'spirit', 'state');
fs.mkdirSync(state, { recursive: true });
const KEY = 'MCowBQYDK2VwAyEAOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLD=';
const book = JSON.stringify([{ publicKey: KEY, label: 'old friend' }]);
fs.writeFileSync(path.join(state, 'contacts.json'), book);
let store = null;
try { store = require(FILE).open(home); } catch (e) { test.fail('the store did not open beside an old book: ' + (e && e.message)); }
const left = fs.existsSync(path.join(state, 'contacts.json')) ? fs.readFileSync(path.join(state, 'contacts.json'), 'utf8') : null;
ok(left === book, 'the old contacts.json is still there, byte for byte', left === null ? 'the old contacts.json was deleted' : 'the old contacts.json was changed: ' + short(left));
let row = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(require(FILE).dbPath(home), { readOnly: true });
  row = db.prepare('SELECT publicKey FROM seen WHERE publicKey = ?').get(KEY) || null;
  db.close();
} catch (e) { row = { error: String(e && e.message) }; }
ok(!row, 'and nothing of it was read into the store', 'the store took a row from the old book: ' + short(row));
void store;

try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }

// The section below, folded in from a file of its own, runs after the checks above.
noAdmittedPart().then(null, function (e) { test.fail('the noAdmitted part threw ' + (e && e.stack || e)); })
  .then(function () { test.reportSuccessFailureCount(); process.exit(0); });

async function noAdmittedPart() {
  // ── THE NO ADMITTED PART ──
  // NODESTORE.JS MARKS NO ADMITTED, AND ITS TRAFFIC TABLE HAS NO admitted COLUMN (goal/G43.23, item 6, after goal/G43.17; spec: ./nodeStore.md, its section). Andy, G43.17: "Didn't i say remove ALL
  // code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
  // Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
  // BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

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

  test.subHeading('noAdmitted: nodeStore.js names no admitted mark, and the traffic table it makes has no admitted column');

  await (async function () {
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
  }());
}
