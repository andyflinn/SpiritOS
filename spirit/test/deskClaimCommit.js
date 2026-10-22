'use strict';

// spirit/test/deskClaimCommit.js
// goal/G19.13: Desk: a claim carries its commit; deskVerify waits for it. Red on today's tree (eee4a204); claude-windows
// wrote it and builds it (one agent).
//   Andy, 2026-10-12: "these push things, when you report a claim on code, it should be accompanied by the commit id,
//   that way desk verify won't check something that hasn't arrived yet... ?"; asked whether it shall be claim {id,
//   commit}, as one verb: "better. that closes the door on half-ass claims."; and "and why are the reds not claimed as
//   complete that way, so the verifier can check them, they should be red. at the time", "yes" to the red phase ending
//   with its own commit, checked red by deskVerify, in this item.
// FOUND: a claim that ran ahead of its push was checked on the old tree (goal/G19.12).
//
// WHAT IS ASSERTED
//   1. THE DESK: one new verb, claim {id, phase, commit}. phase build is the press claim-done, with its refusals, and the
//      item keeps the claimed commit (item.get claimCommit); phase red is taken on a code item with his Go only and the
//      item keeps it (redCommit). A commit is 7 to 40 hex characters, or '' for a plain item's build claim. Every refusal
//      says why. The api lists claim and its verb file (claim.json, read by FS.loadJsonValue since goal/G30.4).
//   2. deskVerify: a build claim whose commit the tree lacks gets one "not checked, waiting for <short>" line, no pass and
//      no reject, quietly while it waits, and is checked once the commit arrives; a red claim runs the item's suites and
//      each must be red: "red confirmed" naming them, or "red not confirmed" naming every green one, never a pass, a
//      reject or a regress; the press claim-done still starts a check; a verify-phase pass starts none; a waiting claim
//      survives a restart (kept in verify.db with its commit); a claim still missing past the limit is given up, saying so.
// rule/11: through testSupport only; a fake node for deskVerify, a real desk; deskVerify runs from a scratch git repo of
// its own, so the tree it pulls and measures is never his clone; the pull is a probe, never a real git pull; it stops only
// the processes it started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G19.13: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const RUN_JS = path.join(__dirname, '..', 'run', 'js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskClaimCommitTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskClaimCommitTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const MISSING = '0123456789abcdef0123456789abcdef01234567';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); }

test.startTest('goal/G19.13: a claim carries its commit, and deskVerify waits for it');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclaimcommit-'));

function server(script, name, values, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  let kid = null;
  return {
    start: function () { kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); },
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    api: function () { return client.ask('api').then(function (r) { return (r && r.body && r.body[app]) || {}; }, function () { return {}; }); },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// A node that answers `api` with a desk and nothing else, so the desk under test never asks his node anything.
function apiNode() {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {} } : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

// ── 1. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('1. the desk: claim {id, phase, commit}, its acceptances and its refusals with their whys');
  const node = await apiNode();
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const d = server(DESK, 'desk', {}, root);
  const get = async function (id) { return parse(((await d.call('item.get', { id: id }, ANDY)).body || {}).item) || {}; };
  const whyOf = function (r) { return String((r.body && r.body.extra && r.body.extra.why) || ''); };
  // A refusal by the verb itself, saying why: not an unknown verb, not a shape the door refused before the handler.
  const refusedSaying = function (r) { return !took(r) && r.body && r.body.code !== 'no-such-verb' && !!whyOf(r); };
  try {
    d.start();
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    const api = await d.api();
    // The verb file is read through the family's FS since goal/G30.4 (it was AGENTS.claim).
    const claimFile = await d.call('FS.loadJsonValue', { path: 'claim.json' });
    const described = claimFile.body && claimFile.body.value && typeof claimFile.body.value.description === 'string';
    if (api.claim && described) test.check('the api lists claim, and its verb file tells the agents of it (claim.json, read by FS.loadJsonValue)');
    else test.fail(OWED + 'the api lists ' + short(Object.keys(api).filter(function (k) { return /claim/.test(k); })) + ', claim.json read as ' + short(claimFile.body));

    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'cc/G1', title: 'Claims' }, items: [
      { id: 'cc/G1.1', title: 'Code with Go', blocks: ['cc/G1'], code: true },
      { id: 'cc/G1.2', title: 'Plain with Go', blocks: ['cc/G1'] },
      { id: 'cc/G1.3', title: 'Code without Go', blocks: ['cc/G1'], code: true },
      { id: 'cc/G1.4', title: 'Plain without Go', blocks: ['cc/G1'] },
    ] }) }, ANDY);
    await d.call('press', { id: 'cc/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'cc/G1.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'cc/G1.2', what: 'go' }, ANDY);

    const cases = [
      ['a commit that is not hex', { id: 'cc/G1.1', phase: 'build', commit: 'nothex!' }],
      ['a commit of 6 characters', { id: 'cc/G1.1', phase: 'build', commit: 'abcdef' }],
      ['a commit of 41 characters', { id: 'cc/G1.1', phase: 'build', commit: MISSING + 'a' }],
      ['no commit on a code item\'s build', { id: 'cc/G1.1', phase: 'build', commit: '' }],
      ['no commit on a red', { id: 'cc/G1.1', phase: 'red', commit: '' }],
      ['a phase that is neither build nor red', { id: 'cc/G1.1', phase: 'verify', commit: 'abcdef1' }],
      ['a red on a plain item', { id: 'cc/G1.2', phase: 'red', commit: 'abcdef1' }],
      ['a red on a code item without his Go', { id: 'cc/G1.3', phase: 'red', commit: 'abcdef1' }],
      ['a build claim on an item without his Go (as the press refuses it)', { id: 'cc/G1.4', phase: 'build', commit: '' }],
      ['an item that does not exist', { id: 'cc/G9.9', phase: 'build', commit: 'abcdef1' }],
    ];
    for (const c of cases) {
      const r = await d.call('claim', c[1], CW);
      if (refusedSaying(r)) test.check('refused, saying why: ' + c[0] + ' (' + whyOf(r) + ')');
      else test.fail(OWED + c[0] + ': claim answered ' + r.status + ' ' + short(r.body));
    }
    const untouched = await get('cc/G1.1');
    if (!untouched.claims && !untouched.claimCommit && !untouched.redCommit) test.check('and nothing refused changed the item');
    else test.fail(OWED + 'after the refusals cc/G1.1 reads ' + short({ claims: untouched.claims, claimCommit: untouched.claimCommit, redCommit: untouched.redCommit }));

    const red = await d.call('claim', { id: 'cc/G1.1', phase: 'red', commit: 'abcdef1' }, CW);
    const afterRed = await get('cc/G1.1');
    if (took(red) && afterRed.redCommit === 'abcdef1' && !afterRed.claims) test.check('a red claim on a code item with his Go is taken, the item keeps its commit, and it is no Done claim');
    else test.fail(OWED + 'red claim answered ' + short(red.body) + '; item ' + short({ redCommit: afterRed.redCommit, claims: afterRed.claims }));

    const full = 'abcdef0123456789abcdef0123456789abcdef01';
    const build = await d.call('claim', { id: 'cc/G1.1', phase: 'build', commit: full }, CW);
    const afterBuild = await get('cc/G1.1');
    if (took(build) && afterBuild.claimCommit === full && afterBuild.claims === 1) test.check('a build claim is the claim-done: one claim on the item, and the item keeps the claimed commit');
    else test.fail(OWED + 'build claim answered ' + short(build.body) + '; item ' + short({ claimCommit: afterBuild.claimCommit, claims: afterBuild.claims }));

    const plain = await d.call('claim', { id: 'cc/G1.2', phase: 'build', commit: '' }, CW);
    const afterPlain = await get('cc/G1.2');
    if (took(plain) && afterPlain.claims === 1) test.check('a plain item takes a build claim with no commit');
    else test.fail(OWED + 'plain claim answered ' + short(plain.body) + '; claims ' + short(afterPlain.claims));

    const ch = (await d.call('changes', { n: 0, line: 0 }, ANDY)).body || {};
    const recs = (ch.records || []).filter(function (r) { return r.verb === 'claim'; }).map(function (r) { return parse(r.body) || {}; });
    if (recs.some(function (b) { return b.id === 'cc/G1.1' && b.phase === 'build' && b.commit === full; }) &&
        recs.some(function (b) { return b.id === 'cc/G1.1' && b.phase === 'red' && b.commit === 'abcdef1'; })) test.check('the record is one claim record, carrying its phase and its commit');
    else test.fail(OWED + 'claim records ' + short(recs));
  } finally { await d.stop(); node.close(); }
}

// ── 2. deskVerify ───────────────────────────────────────────────────────
// A git repo of its own: the deskVerify under test, the modules it loads (ignored, so the tree stays clean) and the
// probe suites, committed. Two commits wait on side branches, as a push not yet arrived: `later` (X) and `later2` (Y,
// on top of X). Merging a branch fast-forward is the push arriving.
function scratchRepo() {
  const repo = path.join(scratch, 'repo');
  fs.mkdirSync(path.join(repo, 'spirit', 'run', 'process', 'js', 'deskVerify'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  fs.cpSync(RUN_JS, path.join(repo, 'spirit', 'run', 'js'), { recursive: true });

  // deskVerify reaches its node through the spirit object (goal/G32.3), which lives in face/.

  fs.mkdirSync(path.join(repo, 'spirit', 'run', 'face'), { recursive: true });

  fs.copyFileSync(path.join(RUN_JS, '..', 'face', 'spirit.js'), path.join(repo, 'spirit', 'run', 'face', 'spirit.js'));
  fs.copyFileSync(VERIFY, path.join(repo, 'spirit', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js'));
  const probe = function (name, body) { fs.writeFileSync(path.join(repo, 'spirit', 'test', name), "'use strict';\n// startTest(\n" + body); };
  probe('zzClaimGreen.js', "console.log('SUCCESS #1 green');\n");
  probe('zzClaimRed.js', "console.log('FAILURE #1 red probe');\n");
  probe('zzClaimRed2.js', "console.log('FAILURE #1 red probe 2');\n");
  fs.writeFileSync(path.join(repo, '.gitignore'), 'spirit/run/\n');
  const git = function (args) { return spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.autocrlf=false'].concat(args), { cwd: repo, encoding: 'utf8' }); };
  git(['init', '-q']);
  git(['add', '.gitignore', 'spirit/test']);
  git(['commit', '-q', '-m', 'probes']);
  const head = String(git(['rev-parse', 'HEAD']).stdout || '').trim();
  const main = String(git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim();
  const side = function (branch, from, file) {
    git(['checkout', '-q', '-b', branch, from]);
    fs.writeFileSync(path.join(repo, 'spirit', 'test', file), 'a push not yet arrived\n');
    git(['add', 'spirit/test/' + file]);
    git(['commit', '-q', '-m', branch]);
    const at = String(git(['rev-parse', 'HEAD']).stdout || '').trim();
    git(['checkout', '-q', main]);
    return at;
  };
  const x = side('later', main, 'zzLater.txt');
  const y = side('later2', 'later', 'zzLater2.txt');
  return {
    dir: repo, head: head, x: x, y: y,
    arrive: function (branch) { return git(['merge', '-q', '--ff-only', branch]).status === 0; },
    verify: path.join(repo, 'spirit', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js'),
  };
}

async function verifyHalf() {
  test.subHeading('2. deskVerify: waits for the claimed commit, checks a red, and a verify pass starts nothing');
  const repo = scratchRepo();
  if (![repo.head, repo.x, repo.y].every(function (h) { return /^[0-9a-f]{40}$/.test(h); })) { test.fail('the world: the scratch repo is not as built: ' + short(repo)); return; }
  const f = function () { return Array.prototype.slice.call(arguments).map(function (n) { return { path: 'spirit/test/' + n, by: 'claude-windows', core: false }; }); };
  const items = [
    { id: 'cv/G1', goal: '', status: '', go: false, files: [] },
    { id: 'cv/G1.1', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimGreen.js') },
    { id: 'cv/G1.2', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimRed.js', 'zzClaimRed2.js') },
    { id: 'cv/G1.3', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimRed.js', 'zzClaimGreen.js') },
    { id: 'cv/G1.4', goal: 'cv/G1', status: 'running', go: true, files: f('zzClaimGreen.js') },
    { id: 'cv/G1.5', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimGreen.js') },
    { id: 'cv/G1.6', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimGreen.js') },
    // Done at a commit the tree holds and listing the red probe: a red check must never take it back.
    { id: 'cv/G1.8', goal: 'cv/G1', status: 'done', go: true, code: true, files: f('zzClaimRed.js') },
    { id: 'cv/G1.9', goal: 'cv/G1', status: 'running', go: true, code: true, files: f('zzClaimGreen.js') },
  ];
  const CHATS = { 'cv/G1.8': [{ by: 'claude-windows', at: new Date().toISOString(), text: 'commit ' + repo.head + ': a commit', taken: '' }] };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
  const asks = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          const a = flatCall.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a, at: Date.now() });
            if (verb === 'item.files') out = { files: (items.filter(function (i) { return i.id === a.id; })[0] || {}).files || [], filesMore: false };
            else if (verb === 'items.search') out = { items: items.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
            else if (verb === 'item.get') out = { item: JSON.stringify(items.filter(function (i) { return i.id === a.id; })[0] || null), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: (CHATS[a.id] || []).slice(), chatMore: false };
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const pullProbe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(pullProbe, '// a pull that changes nothing\n');
  const pull = '"' + process.execPath + '" "' + pullProbe + '"';
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const dbPath = path.join(run, 'verify.db');
  const v = server(repo.verify, 'verify', { db: dbPath, watchMs: 300, suiteMs: 20000, waitMs: 400, pull: pull }, run);
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && (!id || x.args.id === id); }); };
  const lineOn = function (id) { return said('chat.add', id).map(function (x) { return String(x.args.text || ''); }); };
  const spoke = function (id) { return said('verify.pass', id).length + said('verify.reject', id).length; };
  const xs = repo.x.slice(0, 7);
  const ys = repo.y.slice(0, 7);
  try {
    v.start();
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(1500);

    // A VERIFY-PHASE PASS WITHOUT A COMMIT STARTS NOTHING (goal/G19.13): it would check a tree older than the claim.
    rec('phase.done', { id: 'cv/G1.9', phase: 'verify', pass: true });
    await sleep(2500);
    if (!said('item.get', 'cv/G1.9').length && !lineOn('cv/G1.9').length && !spoke('cv/G1.9')) test.check('a verify-phase pass with no commit starts no check');
    else test.fail(OWED + 'the verify-phase pass was checked: ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.9'; })));
    // WITH THE CLAIMED COMMIT IT QUEUES THE CHECK (goal/G27.2, D11). Andy, 2026-10-17: "make that press queue it.": the
    // pass sets the item back to waiting for deskVerify, so a run must follow; the desk writes the item's claimed commit
    // on the record, and the check waits for that commit as a claim's does.
    rec('phase.done', { id: 'cv/G1.9', phase: 'verify', pass: true, commit: repo.head });
    await waitFor(function () { return spoke('cv/G1.9') > 0; }, 20000);
    if (said('verify.pass', 'cv/G1.9').length === 1 && lineOn('cv/G1.9').some(function (l) { return /passed/.test(l) && l.indexOf(repo.head.slice(0, 7)) !== -1; })) test.check('a verify-phase pass carrying the claimed commit is checked at that commit: passed');
    else test.fail('OWED by goal/G27.2: the verify-phase pass with its commit gave ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.9'; })));

    // A BUILD CLAIM WHOSE COMMIT HAS NOT ARRIVED.
    rec('claim', { id: 'cv/G1.1', phase: 'build', commit: repo.x });
    await waitFor(function () { return lineOn('cv/G1.1').length > 0; }, 15000);
    await sleep(2500);
    const waiting = lineOn('cv/G1.1');
    if (waiting.length === 1 && /not checked, waiting for/i.test(waiting[0]) && waiting[0].indexOf(xs) !== -1) test.check('a build claim at a commit the tree lacks: one line, "not checked, waiting for ' + xs + '"');
    else test.fail(OWED + 'lines on the waiting item: ' + short(waiting));
    if (!spoke('cv/G1.1')) test.check('and neither a pass nor a reject, however many ticks it waits');
    else test.fail(OWED + 'the waiting claim was passed or rejected: ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.1'; })));
    if (!repo.arrive('later')) { test.fail('the world: the push of ' + xs + ' did not fast-forward'); return; }
    await waitFor(function () { return said('verify.pass', 'cv/G1.1').length > 0; }, 15000);
    if (said('verify.pass', 'cv/G1.1').length === 1 && lineOn('cv/G1.1').some(function (l) { return /passed/.test(l); })) test.check('once the commit arrives it is checked: passed, one verify.pass');
    else test.fail(OWED + 'after the commit arrived: passes ' + said('verify.pass', 'cv/G1.1').length + ', lines ' + short(lineOn('cv/G1.1')));

    // A RED CLAIM, ITS SUITES ALL RED.
    const regressBefore = said('verify.regress').length;
    rec('claim', { id: 'cv/G1.2', phase: 'red', commit: repo.head });
    await waitFor(function () { return lineOn('cv/G1.2').length > 0; }, 20000);
    await sleep(800);
    const conf = lineOn('cv/G1.2');
    if (conf.length === 1 && /red confirmed at/.test(conf[0]) && conf[0].indexOf(repo.head.slice(0, 7)) !== -1 && /zzClaimRed\.js/.test(conf[0]) && /zzClaimRed2\.js/.test(conf[0])) test.check('a red claim whose suites are red: "red confirmed", at its commit, naming them');
    else test.fail(OWED + 'lines on the red claim: ' + short(conf));
    if (!spoke('cv/G1.2')) test.check('and a red check presses neither verify.pass nor verify.reject');
    else test.fail(OWED + 'the red check spoke: ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.2'; })));

    // A RED CLAIM WITH A GREEN SUITE AMONG ITS OWN.
    rec('claim', { id: 'cv/G1.3', phase: 'red', commit: repo.head });
    await waitFor(function () { return lineOn('cv/G1.3').length > 0; }, 20000);
    await sleep(800);
    const not = lineOn('cv/G1.3');
    // SINCE goal/G27.2's D10 (Andy, 2026-10-17: "i don't want deskVerify to refuse runs required by my agents."): a red
    // with one red suite among its own is confirmed; the green one is reported beside it, not held against it.
    if (not.length === 1 && /red confirmed at/.test(not[0]) && !/not confirmed/.test(not[0]) && /zzClaimGreen\.js is already green/.test(not[0]) && !spoke('cv/G1.3')) test.check('a red claim with a green suite among red ones: "red confirmed", the green one named beside it, and no verdict');
    else test.fail('OWED by goal/G27.2: lines on the half-red claim: ' + short(not) + '; spoke ' + spoke('cv/G1.3'));
    if (said('verify.regress').length === regressBefore) test.check('and a red, expected there, takes no Done back');
    else test.fail(OWED + 'the red check asked verify.regress: ' + short(said('verify.regress').slice(regressBefore)));

    // THE PRESS STILL STARTS A CHECK, for a caller with no commit.
    rec('press', { id: 'cv/G1.4', what: 'claim-done' });
    await waitFor(function () { return said('verify.pass', 'cv/G1.4').length > 0; }, 15000);
    if (said('verify.pass', 'cv/G1.4').length === 1) test.check('the press claim-done still starts a check');
    else test.fail(OWED + 'after a press claim-done: ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.4'; })));

    // A WAITING CLAIM SURVIVES A RESTART.
    rec('claim', { id: 'cv/G1.5', phase: 'build', commit: repo.y });
    await waitFor(function () { return lineOn('cv/G1.5').length > 0; }, 15000);
    await sleep(600);
    let rows = [];
    try { const d = new DatabaseSync(dbPath, { readOnly: true }); rows = d.prepare('SELECT kind, id, state, "commit" FROM runs WHERE id = ?').all('cv/G1.5'); d.close(); } catch (e) { rows = [{ error: String(e.message) }]; }
    if (rows.length === 1 && rows[0].state === 'waiting' && rows[0].commit === repo.y) test.check('a waiting claim is a row in verify.db: waiting, with its commit');
    else test.fail(OWED + 'verify.db rows for cv/G1.5: ' + short(rows));
    await v.stop();
    v.start();
    if (!await v.up()) { test.fail('deskVerify did not come back'); return; }
    await sleep(2000);
    if (lineOn('cv/G1.5').length === 1 && !spoke('cv/G1.5')) test.check('after a restart it still waits, quietly: no second line, no verdict');
    else test.fail(OWED + 'after the restart, lines ' + short(lineOn('cv/G1.5')) + ', spoke ' + spoke('cv/G1.5'));
    if (!repo.arrive('later2')) { test.fail('the world: the push of ' + ys + ' did not fast-forward'); return; }
    await waitFor(function () { return said('verify.pass', 'cv/G1.5').length > 0; }, 15000);
    if (said('verify.pass', 'cv/G1.5').length === 1) test.check('and once ' + ys + ' arrives, the restarted deskVerify checks it');
    else test.fail(OWED + 'after the restart and the push: ' + short(asks.filter(function (x) { return x.args.id === 'cv/G1.5'; })));
  } finally {
    await v.stop();
  }

  // GIVING UP: a deskVerify of its own, with a short limit.
  test.subHeading('3. a commit that never arrives is given up, saying so');
  const run2 = path.join(scratch, 'verify2');
  fs.mkdirSync(path.join(run2, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run2, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v2 = server(repo.verify, 'verify2', { db: path.join(run2, 'verify.db'), watchMs: 300, suiteMs: 20000, waitMs: 300, waitGiveUpMs: 2500, pull: pull }, run2);
  try {
    v2.start();
    if (!await v2.up()) { test.fail('the world: the second deskVerify did not start'); return; }
    await sleep(1500);
    rec('claim', { id: 'cv/G1.6', phase: 'build', commit: MISSING });
    await waitFor(function () { return lineOn('cv/G1.6').length > 1; }, 15000);
    const lines = lineOn('cv/G1.6');
    if (lines.length === 2 && /waiting for/.test(lines[0]) && /gave up/i.test(lines[1]) && lines[1].indexOf(MISSING.slice(0, 7)) !== -1 && !spoke('cv/G1.6')) test.check('it waits, then gives up in one line naming the commit, with no verdict');
    else test.fail(OWED + 'lines on the claim that never arrives: ' + short(lines) + '; spoke ' + spoke('cv/G1.6'));
    const now = (await v2.call('now', {})).body || {};
    if (!(now.queued || []).some(function (q) { return q && q.id === 'cv/G1.6'; })) test.check('and the claim is dropped');
    else test.fail(OWED + 'now still lists it: ' + short(now));
  } finally {
    await v2.stop();
    node.close();
  }
}

(async function () {
  await deskHalf();
  await verifyHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
