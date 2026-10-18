'use strict';

// spirit/test/oldSearchGone.js
// goal/G29.22: the last old searches move to the probability modules, and the old search is deleted. Red on today's
// tree; claude-windows writes it and builds it (one agent). The item's box (v1):
//   - jobs.search (the node verb behind the Jobs app) ranks jobs by the probability modules, cut by bytes.
//   - owner.boxSearch (the box search) ranks by the probability modules, cut by bytes.
//   - The module list search (config.searchModules) ranks by the probability modules, cut by bytes.
//   - With no user left, the old search is deleted: gradedSearch.js, searchBucket.js and bucket.js, with tests that they
//     are gone. A bounded single-object answer still needed (searchBucket.boundedGet) moves to a home of its own first.
// NAMED HERE where the box names none: the home of the bounded single-object answer is limits.js, as
// limits.boundedGet(answer, maxBytes), the same refusal (413, answer-too-large); "ranks" means every row comes back, the
// best match first, none filtered out by the words, as the shared list shows them.
// rule/11: through testSupport only; its own scratch folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.22: ';
const RUN = path.join(__dirname, '..', 'run');
const JS = path.join(RUN, 'js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function keysOf(r) { return ((r && r.items) || []).map(function (i) { return i.key; }); }
function load(name) { try { return require(path.join(JS, name)); } catch (e) { return null; } }

test.startTest('goal/G29.22: the last old searches ranked by probability; the old search deleted');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-oldsearchgone-'));

test.subHeading('1. jobs.search ranks every job, the best match first');
const nodeSearches = load('nodeSearches.js');
const JOBS = [
  { id: '1', type: 'fs-watcher', status: 'running', kind: 'permanent' },
  { id: '2', type: 'chatClerver', status: 'running', kind: 'process' },
  { id: '3', type: 'deskVerify', status: 'running', kind: 'process' },
];
const ns = nodeSearches && nodeSearches.createNodeSearches({ jobs: { listJobs: function () { return JOBS.slice(); }, getJob: function () { return null; }, fsTreeEntries: function () { return []; } }, rootDir: scratch });
const jr = ns ? ns.jobsSearch({ q: 'verify desk' }) : null;
const jk = keysOf(jr);
if (jr && jr.ok !== false && jk[0] === '3' && jk.length === 3) test.check('"verify desk" puts deskVerify first and still answers all three jobs (' + jk.join(', ') + ')');
else test.fail(OWED + 'jobs.search "verify desk" answered ' + short(jk) + ', where deskVerify first of all three is owed');
const jall = ns ? keysOf(ns.jobsSearch({ q: '' })) : [];
if (jall.length === 3) test.check('no words: every job');
else test.fail(OWED + 'jobs.search with no words answered ' + short(jall));

test.subHeading('2. the box search ranks every box, the best match first');
const boxes = load('boxes.js');
fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(scratch, 'relay-state', 'servers.json'), JSON.stringify({ keys: ['K1', 'K2', 'K3'] }));
const bx = boxes && boxes.createBoxes({ rootDir: scratch });
const report = function (key, label, fp) { bx.onArrival({ fromKey: key, envelope: { body: { box: { boxLabel: label, fingerprint: fp, allottedMB: 1, boxTotalMB: 10 } } } }); };
if (bx) { report('K1', 'Attic', 'fpA'); report('K2', 'Harbour box', 'fpH'); report('K3', 'Cellar', 'fpC'); }
const br = bx ? bx.search('box harbour') : null;
const bk = keysOf(br);
if (bk[0] === 'fpH' && bk.length === 3) test.check('"box harbour" puts the harbour box first and still answers all three (' + bk.join(', ') + ')');
else test.fail(OWED + 'the box search "box harbour" answered ' + short(bk) + ', where fpH first of all three is owed');

test.subHeading('3. the module list search ranks every module, the best match first');
const includeList = load('includeList.js');
const modRoot = path.join(scratch, 'mods');
fs.mkdirSync(path.join(modRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(modRoot, 'relay-state', 'include.json'), JSON.stringify({ modules: ['process/js/backup', 'process/js/desk', 'shell/textEditor'] }));
const mr = includeList ? includeList.search(modRoot, 'editor text', 4000) : null;
const mk = keysOf(mr);
if (mk[0] === 'shell/textEditor' && mk.length === 3) test.check('"editor text" puts shell/textEditor first and still answers all three (' + mk.join(', ') + ')');
else test.fail(OWED + 'the module search "editor text" answered ' + short(mk) + ', where shell/textEditor first of all three is owed');
const mcut = includeList ? includeList.search(modRoot, '', 120) : null;
if (mcut && mcut.more === true && mcut.items.length >= 1 && Buffer.byteLength(JSON.stringify(mcut.items), 'utf8') <= 120) test.check('cut by bytes: 120 bytes hold ' + mcut.items.length + ' and say more');
else test.fail(OWED + 'the module search cut at 120 bytes answered ' + short(mcut));

test.subHeading('4. the bounded single-object answer lives in limits.js');
const limits = load('limits.js');
const bg = limits && limits.boundedGet;
const small = typeof bg === 'function' ? bg({ ok: true, x: 'a' }, 100) : null;
const big = typeof bg === 'function' ? bg({ ok: true, x: 'a'.repeat(200) }, 100) : null;
if (small && small.ok === true && big && big.status === 413 && big.code === 'answer-too-large') test.check('limits.boundedGet passes a small answer and refuses a big one 413 answer-too-large');
else test.fail(OWED + 'limits.boundedGet is ' + (typeof bg) + '; small ' + short(small) + ', big ' + short(big));

test.subHeading('5. the old search is gone');
const files = ['gradedSearch.js', 'searchBucket.js', 'bucket.js'].filter(function (f) { return fs.existsSync(path.join(JS, f)); });
if (!files.length) test.check('gradedSearch.js, searchBucket.js and bucket.js are deleted');
else test.fail(OWED + 'still in js/: ' + files.join(', '));
const users = [];
(function walk(dir) {
  let es = [];
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  es.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'relay-state' && e.name !== 'brains') walk(p); return; }
    if (!/\.(js|html)$/.test(e.name)) return;
    const code = fs.readFileSync(p, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
    if (/require\([^)]*(searchBucket|gradedSearch|\/bucket(\.js)?['"])|src=["'][^"']*(searchBucket|gradedSearch|\/bucket)\.js/.test(code)) users.push(path.relative(RUN, p));
  });
}(RUN));
if (!users.length) test.check('nothing under spirit/run loads them');
else test.fail(OWED + 'still loaded by ' + users.join(', '));

setTimeout(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
}, 100);
