'use strict';

// spirit/run/spirit/test/appServer-stateCache.js
// The tests of spirit/appServer.js by name: ITS CACHE IN spirit/state/<name>/cache/ (goal/G43.20, its box; spec:
// ./appServer-stateCache.md). Andy: "cache, which is written by spirit/appServer.js was ALWAYS supposed to go into
// spirit/state/<name>/cache/", and "NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs." A throwaway
// follower app, planted in a scratch copy of the tracked files, is run as the node runs a server: what it kept is read back
// at its start, and its saveCaches (deskClient's cache.dump) writes it again. Never a live node.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const NAME = 'follower';
// A sender whose family has a data.js on the node: desk's (spirit/app/desk/data.js), so what is kept of it comes back.
const SENDER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';
const FAMILY = 'desk';

test.startTest('appServer-stateCache.js: appServer reads and writes its cache in spirit/state/<name>/cache/, and nowhere else (goal/G43.20)');

(async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-state-cache-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const app = path.join(run, 'spirit', 'app', NAME);
  fs.mkdirSync(app, { recursive: true });
  // The follower: a server of spirit/app/ following a stream with its cache on. Its translator says by a file what came
  // back; once read back, it saves its caches (saveCaches) and says which files it wrote.
  fs.writeFileSync(path.join(app, 'rows.js'), [
    "const D = require('../../data.js');",
    "D.addTranslator({ onJob: function (job) { if (job && job.app) require('fs').writeFileSync(process.env.ROW_SEEN, JSON.stringify(job.app)); } });",
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(app, NAME + '.js'), [
    "require('../../spirit.js');",
    "const path = require('path');",
    "const S = require('../../appServer.js');",
    "S.serve({}, { stream: { translator: path.join(__dirname, 'rows.js'), cache: true, module: 'a.test' } });",
    "setTimeout(function () { require('fs').writeFileSync(process.env.SAVED, JSON.stringify(S.saveCaches())); }, 1500);",
  ].join('\n') + '\n');
  const id = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./spirit/data.js').nodeId(" + JSON.stringify(SENDER) + "))"], { cwd: run, encoding: 'utf8' }).stdout;
  const state = path.join(run, 'spirit', 'state', NAME);
  const cache = path.join(state, 'cache');
  const kids = [];
  // One start of the follower over a kept file planted at where: what came back, and what it saved.
  const startWith = async function (where) {
    fs.rmSync(state, { recursive: true, force: true });
    fs.mkdirSync(where, { recursive: true });
    fs.writeFileSync(path.join(where, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: where }] }));
    const seen = path.join(root, 'seen-' + kids.length + '.json');
    const saved = path.join(root, 'saved-' + kids.length + '.json');
    const pipe = require(path.join(run, 'spirit', 'appClient.js')).pipePathFor(root, NAME, process.platform, 'app');
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
    kids.push(kid);
    await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
    await sleep(200);
    try { kid.kill(); } catch (e) { /* gone */ }
    return { seen: readJson(seen), saved: readJson(saved) };
  };
  try {
    ok(id.length > 10, 'the world: the sender\'s file name is its node id, ' + id.slice(0, 12) + '…', 'no node id for the sender: nothing judged');

    test.subHeading('"cache ... was ALWAYS supposed to go into spirit/state/<name>/cache/": read back from there');
    const inCache = await startWith(cache);
    ok(!!inCache.seen && inCache.seen.kept === cache, 'what it kept in spirit/state/follower/cache/ comes back at its start', 'came back: ' + short(inCache.seen));
    const wrote = Array.isArray(inCache.saved) ? inCache.saved.map(function (f) { return f.file; }) : [];
    ok(wrote.indexOf(id + '.json') !== -1 && fs.existsSync(path.join(cache, id + '.json')), 'and its cache.dump writes it there again, spirit/state/follower/cache/<id>.json', 'saved: ' + short(inCache.saved));
    const top = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return /\.json$/.test(f) && f !== 'node.json'; }) : [];
    ok(!top.length, 'no cache file is written in spirit/state/follower/ itself', 'written there: ' + short(top));

    test.subHeading('"NO FUCKING RESCUE CODE": a cache file left at the old place is not read');
    const atTop = await startWith(state);
    ok(!atTop.seen, 'a file at spirit/state/follower/<id>.json is not read back: a cache left behind is rebuilt from the stream', 'came back: ' + short(atTop.seen));
    ok(fs.existsSync(path.join(state, id + '.json')), 'and it is left where it was, not moved', 'the old file was moved or removed');

    // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
    // startWith plants a good file; each case below then spoils cache/ before the follower starts again.
    const spoiled = async function (spoil) {
      fs.rmSync(state, { recursive: true, force: true });
      fs.mkdirSync(cache, { recursive: true });
      spoil();
      const seen = path.join(root, 'seen-x' + kids.length + '.json');
      const saved = path.join(root, 'saved-x' + kids.length + '.json');
      const pipe = require(path.join(run, 'spirit', 'appClient.js')).pipePathFor(root, NAME, process.platform, 'app');
      if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
      const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
      kids.push(kid);
      const up = await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
      await sleep(200);
      try { kid.kill(); } catch (e) { /* gone */ }
      return { up: !!up, seen: readJson(seen), saved: readJson(saved) };
    };
    const OTHER = 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ=';
    test.subHeading('the attacker: a file named for one sender, holding another\'s key');
    const swapped = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: OTHER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'swapped' }] })); });
    ok(swapped.up && !swapped.seen, 'it is not read: a file is read only under its own sender\'s name', 'came back: ' + short(swapped.seen));
    test.subHeading('the attacker: only a half-written .tmp, as a kill leaves it');
    const half = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json.tmp'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'half' }] })); });
    ok(half.up && !half.seen, 'a .tmp is never read back', 'came back: ' + short(half.seen));
    test.subHeading('the attacker: a cache file that is no JSON, and one that is JSON of the wrong shape');
    const broken = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), '{"key": "' + SENDER + '", "rows": [ {"kept": '); });
    ok(broken.up && !broken.seen && Array.isArray(broken.saved), 'a broken file: the server still starts, reads nothing back, and saves', 'up ' + broken.up + ', seen ' + short(broken.seen) + ', saved ' + short(broken.saved));
    const shape = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 7, n: -3, rows: 'not a list' })); });
    ok(shape.up && !shape.seen && Array.isArray(shape.saved), 'rows that are no list: nothing read back, and the server saves on', 'up ' + shape.up + ', seen ' + short(shape.seen));
    const strays = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return ['cache', 'data', 'node.json', 'door.sock'].indexOf(f) === -1; }) : [];
    ok(!strays.length, 'and after all of it spirit/state/follower/ holds nothing beside cache/ (and its socket)', 'also there: ' + short(strays));
  } catch (e) {
    test.fail('the suite threw ' + (e && e.stack || e));
  } finally {
    kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
    await sleep(300);
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
  test.reportSuccessFailureCount();
  process.exit(0);
}());
