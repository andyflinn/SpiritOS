'use strict';

// spirit/run/process/js/desk/test/commitCheck.js
// The tests of process/js/desk/commitCheck.js, and of no other module (spec: ./commitCheck.md; goal/G41.11). The check
// runs as git runs it, `node commitCheck.js check <port> <message file>`, in a throwaway git repository with files
// staged. Its deskClient is a fake, put in place by a preload before the script runs: it keeps a cache (the kept reads
// a test hands it) and plays the desk behind it, answering live or lagging. Every ask is written to a log the test reads.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SCRIPT = path.join(__dirname, '..', 'commitCheck.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// deskClient's kept reads, as the file says them: the only verbs a cache-only ask may name.
const KEPT = (function () {
  const src = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js'), 'utf8');
  const m = /const KEPT_READS = \[([^\]]*)\]/.exec(src);
  return m ? m[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }).filter(Boolean) : [];
}());

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'commitCheck-test-'));
const PRELOAD = path.join(WORK, 'fakeDeskClient.js');
// THE FAKE deskClient: the family's desk verb. A kept ask (kept: true) is answered from the cache the scenario holds,
// or refused not-kept; any other ask is live, logged as such, and answered by the desk the scenario plays: 'lag' (no
// answer: a 504, at once, so no test waits out the check's 20 s) or 'live' (answers from the same facts, as today's desk).
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('fs');",
  "require(" + JSON.stringify(path.join(RUN, 'spirit.js')) + ");",
  "const S = JSON.parse(fs.readFileSync(process.env.FAKE_SCENARIO, 'utf8'));",
  "function log(x) { fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(x) + '\\n'); }",
  "function keptAnswer(name, args) {",
  "  const k = name + ' ' + String((args && args.id) || '');",
  "  return Object.prototype.hasOwnProperty.call(S.cache, k) ? S.cache[k] : null;",
  "}",
  "function liveAnswer(name, args) {",
  "  const f = S.facts;",
  "  const row = function (o) { return { key: String(o.path || o.id || o.number), label: JSON.stringify(o) }; };",
  "  if (name === 'items.search') return { items: [row({ id: f.goal })], more: false };",
  "  if (name === 'item.get') return { item: JSON.stringify(f), version: 1, change: 1 };",
  "  if (name === 'item.files.search') return { items: S.files.filter(function (x) { return x.path === args.text; }).map(row), more: false };",
  "  if (name === 'item.checks.search') return { items: S.checks.map(row), more: false };",
  "  if (name === 'phase.may') return { allowed: true, why: '' };",
  "  if (name === 'profile.get') return { name: 'wsl-claude' };",
  "  return { ok: false, code: 'no-such-verb' };",
  "}",
  "const fake = { desk: function (a) {",
  "  const name = String(a && a.name); let args = {}; try { args = JSON.parse(a.json || '{}'); } catch (e) { args = {}; }",
  "  if (a && a.kept === true) {",
  "    const got = S.keptOk && " + JSON.stringify(KEPT) + ".indexOf(name) !== -1 ? keptAnswer(name, args) : null;",
  "    log({ name: name, args: args, kept: true, hit: !!got });",
  "    if (got) return Promise.resolve(got);",
  "    return Promise.resolve({ ok: false, code: 'not-kept', why: name + ' of ' + String(args.id || '') + ' is not in the cache' });",
  "  }",
  "  log({ name: name, args: args, kept: false });",
  "  if (S.desk === 'lag') { const e = new Error('no answer'); e.status = 504; e.body = { ok: false, code: 'no-answer', error: 'no answer yet' }; return Promise.reject(e); }",
  "  return Promise.resolve(liveAnswer(name, args));",
  "} };",
  "const real = globalThis.spirit.require;",
  "globalThis.spirit.require = function (p) { return /deskClient\\.family\\/api\\.js$/.test(String(p)) ? Promise.resolve(fake) : real.apply(this, arguments); };",
].join('\n'));

const ID = 'goal/G41.11';
const CORE = 'spirit/run/shell/js/someElement.js';
const PLAIN = 'docs/notes.md';
const STRAY = 'docs/stray.md';
const FACTS = { id: ID, goal: 'goal/G41', go: true, status: 'build', phase: 'build', red: 'claude-windows', phaseWith: 'wsl-claude', with: 'wsl-claude' };
const GRANT = { number: 'G1', kind: 'G', words: "core grant: every core file on this item's list", state: 'granted' };

// The cache as deskClient keeps it: the item's facts with the current goal and its own agent beside them, its whole file
// list, its checks.
function cacheOf(files, opts) {
  const o = opts || {};
  const c = {};
  c['item.get ' + ID] = { item: JSON.stringify(FACTS), version: 1, change: 1, current: 'goal/G41', self: 'wsl-claude' };
  if (!o.noFiles) c['item.files ' + ID] = { files: files.map(function (p) { return { path: p, by: 'wsl-claude', core: p === CORE }; }), filesMore: false };
  c['item.checks ' + ID] = { checks: [GRANT] };
  return c;
}

// One check: a fresh repo with the given files staged, the scenario written, commitCheck run as git runs it.
let n = 0;
function run(scenario, staged) {
  n += 1;
  const repo = path.join(WORK, 'repo' + n);
  fs.mkdirSync(repo, { recursive: true });
  const g = function (args) { return spawnSync('git', args, { cwd: repo, encoding: 'utf8' }); };
  g(['init', '-q']); g(['config', 'user.email', 't@t']); g(['config', 'user.name', 't']);
  staged.forEach(function (f) { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), 'x\n'); });
  g(['add'].concat(staged));
  const scen = path.join(WORK, 'scenario' + n + '.json');
  const logf = path.join(WORK, 'log' + n + '.jsonl');
  fs.writeFileSync(scen, JSON.stringify(scenario));
  fs.writeFileSync(logf, '');
  const msg = path.join(WORK, 'msg' + n);
  fs.writeFileSync(msg, ID + ': a change\n');
  const r = spawnSync(process.execPath, ['-r', PRELOAD, SCRIPT, 'check', '45441', msg], {
    cwd: repo, encoding: 'utf8', timeout: 60000, env: Object.assign({}, process.env, { FAKE_SCENARIO: scen, FAKE_LOG: logf }) });
  const asks = fs.readFileSync(logf, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  return { status: r.status, out: String(r.stdout || '') + String(r.stderr || ''), asks: asks, live: asks.filter(function (a) { return !a.kept; }) };
}
const names = function (asks) { return asks.map(function (a) { return a.name + (a.kept ? '(kept)' : '(live)'); }).join(', '); };

test.startTest('commitCheck.js: a commit asks the desk nothing (goal/G41.11)');

ok(KEPT.length > 0 && KEPT.indexOf('item.get') !== -1 && KEPT.indexOf('item.files') !== -1 && KEPT.indexOf('item.checks') !== -1,
  'deskClient keeps item.get, item.files and item.checks (its KEPT_READS)', 'KEPT_READS read as ' + short(KEPT));

test.subHeading('the facts in the cache, the desk lagging: the commit is taken, the desk never asked');
const files = [CORE, PLAIN];
const lag = run({ desk: 'lag', keptOk: true, cache: cacheOf(files), facts: FACTS, files: files.map(function (p) { return { path: p }; }), checks: [GRANT] }, files);
ok(lag.live.length === 0, 'no ask goes live to the desk', 'live asks: ' + names(lag.live));
ok(lag.asks.length > 0 && lag.asks.every(function (a) { return a.kept && KEPT.indexOf(a.name) !== -1; }), 'every ask is a kept read, cache only', 'asks: ' + names(lag.asks));
ok(lag.status === 0 && /taken/.test(lag.out), 'a lagging desk does not refuse a commit whose facts are in the cache', 'exit ' + lag.status + ': ' + short(lag.out));

test.subHeading('a cache miss refuses, says why, and asks the desk nothing');
const miss = run({ desk: 'live', keptOk: true, cache: cacheOf(files, { noFiles: true }), facts: FACTS, files: files.map(function (p) { return { path: p }; }), checks: [GRANT] }, files);
ok(miss.live.length === 0, 'a miss does not fall through to the desk, even one that answers', 'live asks: ' + names(miss.live));
ok(miss.status === 1 && /cache/i.test(miss.out), 'the commit is refused, saying what was not in the cache', 'exit ' + miss.status + ': ' + short(miss.out));

const cutCache = cacheOf(files);
cutCache['item.files ' + ID] = Object.assign({}, cutCache['item.files ' + ID], { filesMore: true });
const cut = run({ desk: 'live', keptOk: true, cache: cutCache, facts: FACTS, files: files.map(function (p) { return { path: p }; }), checks: [GRANT] }, files);
ok(cut.status === 1 && cut.live.length === 0, 'a file list cut short in the cache refuses too, asking the desk nothing', 'exit ' + cut.status + ', live: ' + names(cut.live) + ': ' + short(cut.out));

test.subHeading('every staged file must be on the list, core or not');
const stray = run({ desk: 'live', keptOk: true, cache: cacheOf(files), facts: FACTS, files: files.map(function (p) { return { path: p }; }), checks: [GRANT] }, files.concat([STRAY]));
ok(stray.status === 1 && stray.out.indexOf(STRAY) !== -1, 'a staged non-core file not on the list is refused, by name', 'exit ' + stray.status + ': ' + short(stray.out));
const listed = run({ desk: 'live', keptOk: true, cache: cacheOf(files.concat([STRAY])), facts: FACTS, files: files.concat([STRAY]).map(function (p) { return { path: p }; }), checks: [GRANT] }, files.concat([STRAY]));
ok(listed.status === 0 && listed.live.length === 0, 'the same files, all on the list, are taken from the cache alone', 'exit ' + listed.status + ', live: ' + names(listed.live) + ': ' + short(listed.out));

fs.rmSync(WORK, { recursive: true, force: true });
test.reportSuccessFailureCount();
