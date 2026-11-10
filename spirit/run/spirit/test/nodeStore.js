'use strict';

// spirit/run/spirit/test/nodeStore.js
// The tests of spirit/nodeStore.js, and of no other module (spec: ./nodeStore.md). This file holds goal/G41.30: no
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
test.reportSuccessFailureCount();
process.exit(0);
