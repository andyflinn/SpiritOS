'use strict';

// spirit/run/spirit/test/noPreferences.js
// PREFERENCES.JSON GONE (goal/G43.17; spec: ./noPreferences.md). Andy: "ignore or hold are enough, and safer that automatically
// adding a contact, this will be solved when we fix the filters in contact search", "i want to remove that information and all
// the code that references it, gone.", "go do it!". The tree read as it is, and a real node on a scratch copy of the tracked
// files, asked at its own loopback door. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === 'state' || e.name === 'agents' || e.name === 'test') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}

test.startTest('noPreferences.js: preferences.json and every line that reads or writes it, gone (goal/G43.17)');

(async function () {
  test.subHeading('Andy: "i want to remove that information and all the code that references it, gone."');
  const tracked = require('child_process').execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return /(^|\/)preferences\.json$/.test(f); });
  ok(!tracked.length, 'no preferences.json is tracked', 'still tracked: ' + short(tracked));
  // Andy: "MAKE SURE the code referencing preferences.json will be gone from the codebase.": every tracked code file, tests,
  // install scripts and comments included; only this suite, which must name it, and Desk's own data (currentGoal.json) aside.
  const naming = require('child_process').execSync('git ls-files -- "*.js" "*.html" "*.css" "*.json"', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return !/noPreferences\.(js|md)$/.test(f) && !/currentGoal\.json$/.test(f) && fs.existsSync(path.join(REPO, f)); })
    .filter(function (f) { return /preferences\.json|UNKNOWN_PREFS|unknownPolicy/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  ok(!naming.length, 'no tracked code, tests and comments included, names preferences.json or the policy it held', naming.length + ' still do: ' + short(naming));
  const api = require(path.join(RUN, 'spirit', 'contact', 'api.js'));
  ok(!('senders' in api.verbs) && !('setSenders' in api.verbs), 'the contact family has no senders or setSenders (wsl reviewed, Andy: "go do it!")', 'spirit/contact/api.js: ' + short(Object.keys(api.verbs)));
  const app = code(path.join(RUN, 'spirit', 'app', 'contact', 'contact.js'));
  ok(!!app && !/senders|setSenders|CONTACTS_UNKNOWN/.test(app), 'the Contacts app asks neither, and draws no choice for strangers', 'spirit/app/contact/contact.js still names senders, setSenders or its choices');

  // Andy: "so NO, we don't need a "held" "status"": a refused id stays in the traffic log, as long as there is room, and nowhere
  // else waits for a yes.
  test.subHeading('Andy: "so NO, we don\'t need a "held" "status""');
  ok(!('held' in api.verbs.search), 'contact.search has no held filter', 'contact.search: ' + short(api.verbs.search));
  const store = code(path.join(RUN, 'spirit', 'nodeStore.js'));
  const flags = (/SEEN_FLAGS\s*=\s*\[([^\]]*)\]/.exec(store) || [])[1];
  ok(flags !== undefined && !/'held'/.test(flags), 'the remembered row has no held flag', 'nodeStore.js SEEN_FLAGS: ' + short(flags));
  const book = require(path.join(RUN, 'spirit', 'contacts.js'));
  ok(typeof book.hold !== 'function', 'the contact book holds nobody: no hold', 'spirit/contacts.js still exports hold');

  // Andy: "FIX the handling of "forget" and "held", removing data base fields to end the life of "held".": a node.db from before,
  // its seen table still holding a held column with a held row, opened by the node's own store, loses the column.
  test.subHeading('Andy: "removing data base fields to end the life of "held"": a node.db from before loses its held column');
  const NS = require(path.join(RUN, 'spirit', 'nodeStore.js'));
  const old = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-noheld-'));
  try {
    NS.open(old).close();
    const D = require('node:sqlite').DatabaseSync;
    let db = new D(NS.dbPath(old));
    const cols = function () { return db.prepare('PRAGMA table_info(seen)').all().map(function (c) { return c.name; }); };
    if (cols().indexOf('held') === -1) db.exec('ALTER TABLE seen ADD COLUMN held INTEGER NOT NULL DEFAULT 0');
    ok(cols().indexOf('held') !== -1, 'the world: a node.db whose seen table holds a held column', 'no held column could be made: nothing judged');
    db.close();
    NS.open(old).close();
    db = new D(NS.dbPath(old));
    const after = cols();
    db.close();
    ok(after.length > 0 && after.indexOf('held') === -1, 'opened by the node, its seen table has no held column any more', 'the seen table after the node opened it: ' + short(after));
  } finally { try { fs.rmSync(old, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

  const N = await scratchNode();
  try {
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    for (const verb of ['contact.senders', 'contact.setSenders']) {
      const r = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: verb === 'contact.setSenders' ? { policy: 'hold' } : {} }) });
      const t = await r.text();
      ok(r.status >= 400 && /no such verb/.test(t), verb + ' is no verb on the node', verb + ' answered ' + r.status + ' ' + short(t));
    }
    if (N.root) ok(!fs.existsSync(path.join(N.root, 'spirit', 'run', 'preferences.json')), 'and the node writes no preferences.json', 'the scratch node holds a preferences.json');
  } finally {
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
