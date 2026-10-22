'use strict';

// spirit/test/deskVerifyDoneGates.js
// goal/G19.2: Goal Done gates: reds, stop, reopen, restart; and Andy's undo. Red on today's tree (cf326a8a);
// claude-windows wrote it and builds it (one agent).
//   Andy, 2026-10-12: "i said the verifier can not press done, i never said that the verifier cannot undo a
//   done/close...", "a done becomes unsettles when an associated suite shows regression.", and "yes." to the reading:
//   any run showing a suite red unsettles every done or closed item listing it, and its goal, counted only from a clean,
//   pulled tree holding the item's commit. "a regression must come back as a red." The four fixes that hold back an
//   unearned Done: "the four go in, where they don't contradict the idea that verifier must reverse done/closed when
//   the item/goal regresses."
//
// WHAT IS ASSERTED
//   1. THE DESK: a reopen of a goal clears its deskVerify pass and its emptied mark, so Done waits for a fresh run (and
//      the desk asks that run with a new goal.emptied); verify.again on a goal is taken, from an agent too, and its
//      record says it is a goal; verify.regress {id, why} is the owner's alone and refused with a why otherwise, refused
//      on an item that is neither done nor closed, and on a done or closed one takes back done and closed, its pass and
//      its verify, puts a code item back to build and says 'regressed' in its status; on the goal the same, and the
//      goal's emptied mark goes, so the item's next Done asks a new goal run. verify.reject still refuses a done item.
//   2. deskVerify: a goal run with a red, a missing file or a Stop asks no verify.pass on the goal and its line says
//      why; verify.again on a goal runs the goal run; a goal reopened runs again on its next goal.emptied; a red suite
//      in a goal run or an item's check unsettles every done or closed item listing it, and that item's goal, but never
//      an item whose commit the tree lacks, an open item, or anything when the tree was not pulled clean.
//   3. THE FACE: the full-run button with no goal row on screen sends the desk's current goal, asked of the desk.
// rule/11: through testSupport only; a fake node, a real desk; deskVerify runs from a scratch git repo of its own, so the
// tree it pulls and measures is clean and never his clone; the pull is a probe, never a real git pull.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G19.2: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const RUN_JS = path.join(__dirname, '..', 'run', 'js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyDoneGatesTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSLX = { key: 'MCowBQYDK2VwAyEAdeskVerifyDoneGatesTestWSLAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyDoneGatesTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const MISSING = '0123456789abcdef0123456789abcdef01234567';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); }

test.startTest('goal/G19.2: a goal\'s Done is earned by a green run, and a red takes a Done back');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifydonegates-'));

function server(script, name, values, cwd) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: cwd || root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// A node that says a desk and a deskVerify run on it, so the desk's goal Done waits for deskVerify (goal/G8.12).
function apiNode() {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {}, deskVerify: {} } : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

// ── 1. THE DESK ─────────────────────────────────────────────────────────
async function deskHalf() {
  test.subHeading('1. the desk: reopen clears the goal\'s pass, verify.again takes a goal, verify.regress unsettles');
  const node = await apiNode();
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const d = server(DESK, 'desk', {}, root);
  const get = async function (id) { return parse(((await d.call('item.get', { id: id }, ANDY)).body || {}).item) || {}; };
  const records = async function (verb, id) {
    // Every page of the record, not the first one alone.
    let all = [];
    for (let n = 0, i = 0; i < 200; i++) {
      const ch = (await d.call('changes', { n: n, line: 0 }, ANDY)).body || {};
      const recs = ch.records || [];
      all = all.concat(recs);
      if (!ch.more || !recs.length || !(Number(ch.n) > n)) break;
      n = Number(ch.n);
    }
    return all.filter(function (r) { return r.verb === verb && (!id || (parse(r.body) || {}).id === id); });
  };
  const whyOf = function (r) { return String((r.body && r.body.extra && r.body.extra.why) || ''); };
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await sleep(600);

    // A REOPENED GOAL WAITS FOR A FRESH RUN (fix 2).
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dg/G1', title: 'Reopen' }, items: [{ id: 'dg/G1.1', title: 'One', blocks: ['dg/G1'] }] }) }, ANDY);
    await d.call('press', { id: 'dg/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'dg/G1.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'dg/G1.1', what: 'claim-done' }, CW);
    await d.call('verify.pass', { id: 'dg/G1.1' }, ANDY);
    await d.call('press', { id: 'dg/G1.1', what: 'done' }, ANDY);
    await d.call('verify.pass', { id: 'dg/G1' }, ANDY);
    const offered = (await get('dg/G1')).buttons || [];
    await d.call('press', { id: 'dg/G1', what: 'done' }, ANDY);
    await d.call('press', { id: 'dg/G1', what: 'reopen' }, ANDY);
    const reopened = await get('dg/G1');
    if (offered.indexOf('done') !== -1 && (reopened.buttons || []).indexOf('done') === -1) test.check('a reopened goal offers no Done until a fresh run passes it');
    else test.fail(OWED + 'goal buttons before its Done ' + short(offered) + ', after a reopen ' + short(reopened.buttons));
    if ((await records('goal.emptied', 'dg/G1')).length === 2) test.check('and its emptied mark went with it: the desk asked a fresh goal run');
    else test.fail(OWED + 'goal.emptied records for the reopened goal: ' + (await records('goal.emptied', 'dg/G1')).length + ' (2 wanted)');
    const again = await d.call('verify.pass', { id: 'dg/G1' }, ANDY);
    if (took(again) && ((await get('dg/G1')).buttons || []).indexOf('done') !== -1) test.check('the fresh run\'s pass brings the Done back');
    else test.fail(OWED + 'verify.pass after the reopen answered ' + short(again.body));

    // verify.again ON A GOAL (fix 3), from an agent too.
    const va = await d.call('verify.again', { id: 'dg/G1' }, CW);
    const vaRec = (await records('verify.again', 'dg/G1'))[0];
    if (took(va) && vaRec && (parse(vaRec.body) || {}).goal === true) test.check('verify.again on a goal is taken from an agent, and its record says it is a goal');
    else test.fail(OWED + 'verify.again on a goal answered ' + short(va.body) + '; record ' + short(vaRec));

    // verify.regress (the undo).
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dg/G2', title: 'Regress' }, items: [{ id: 'dg/G2.1', title: 'Code', blocks: ['dg/G2'], code: true }] }) }, ANDY);
    await d.call('press', { id: 'dg/G2', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'dg/G2.1', what: 'go' }, ANDY);
    const answers = [];
    const round = async function () {
      answers.length = 0;
      const one = async function (verb, a, who) { const r = await d.call(verb, a, who); if (!took(r)) answers.push(verb + ' ' + short(r.body)); };
      await one('phase.take', { id: 'dg/G2.1', phase: 'build' }, WSLX); await one('phase.done', { id: 'dg/G2.1', phase: 'build' }, WSLX);
      await one('phase.take', { id: 'dg/G2.1', phase: 'verify' }, CW); await one('phase.done', { id: 'dg/G2.1', phase: 'verify', pass: true }, CW);
      await one('verify.pass', { id: 'dg/G2.1' }, ANDY);
      await one('press', { id: 'dg/G2.1', what: 'done' }, ANDY);
    };
    await d.call('phase.take', { id: 'dg/G2.1', phase: 'red' }, CW); await d.call('phase.done', { id: 'dg/G2.1', phase: 'red' }, CW);
    await round();
    await d.call('verify.pass', { id: 'dg/G2' }, ANDY);
    await d.call('press', { id: 'dg/G2', what: 'done' }, ANDY);
    const rj = await d.call('verify.reject', { id: 'dg/G2.1', why: 'red' }, ANDY);
    if (!took(rj) && (await get('dg/G2.1')).status === 'done') test.check('verify.reject still refuses a done item: the undo is not its job');
    else test.fail(OWED + 'verify.reject on a done item answered ' + short(rj.body));
    const byAgent = await d.call('verify.regress', { id: 'dg/G2.1', why: 'spirit/test/zzX.js' }, CW);
    if (!took(byAgent) && byAgent.body && byAgent.body.code !== 'no-such-verb' && whyOf(byAgent)) test.check('verify.regress from an agent is refused, saying why (' + whyOf(byAgent) + ')');
    else test.fail(OWED + 'verify.regress from an agent answered ' + byAgent.status + ' ' + short(byAgent.body));
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'dg/G3', title: 'Open' }, items: [{ id: 'dg/G3.1', title: 'Open one', blocks: ['dg/G3'] }, { id: 'dg/G3.2', title: 'Closed one', blocks: ['dg/G3'] }] }) }, ANDY);
    await d.call('press', { id: 'dg/G3', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'dg/G3.2', what: 'close' }, ANDY);
    const onOpen = await d.call('verify.regress', { id: 'dg/G3.1', why: 'spirit/test/zzX.js' }, ANDY);
    if (!took(onOpen) && onOpen.body && onOpen.body.code !== 'no-such-verb' && whyOf(onOpen)) test.check('verify.regress on an item neither done nor closed is refused, saying why (' + whyOf(onOpen) + ')');
    else test.fail(OWED + 'verify.regress on an open item answered ' + onOpen.status + ' ' + short(onOpen.body));

    const ri = await d.call('verify.regress', { id: 'dg/G2.1', why: 'spirit/test/zzX.js' }, ANDY);
    const it = await get('dg/G2.1');
    if (took(ri) && it.status !== 'done' && it.status !== 'closed' && /regress/i.test(String(it.status)) && it.phase === 'build' && (it.buttons || []).indexOf('done') === -1) test.check('verify.regress on a done code item: not done, back to build, the status says regressed (' + it.status + ')');
    else test.fail(OWED + 'after verify.regress the item reads ' + short({ answer: ri.body, status: it.status, phase: it.phase, buttons: it.buttons }));
    const rg = await d.call('verify.regress', { id: 'dg/G2', why: 'spirit/test/zzX.js' }, ANDY);
    const g = await get('dg/G2');
    if (took(rg) && g.status !== 'done' && g.status !== 'closed' && /regress/i.test(String(g.status)) && (g.buttons || []).indexOf('done') === -1) test.check('and on its done goal: not done, the status says regressed');
    else test.fail(OWED + 'after verify.regress the goal reads ' + short({ answer: rg.body, status: g.status, buttons: g.buttons }));
    const rc = await d.call('verify.regress', { id: 'dg/G3.2', why: 'spirit/test/zzX.js' }, ANDY);
    const c = await get('dg/G3.2');
    if (took(rc) && c.status !== 'closed' && /regress/i.test(String(c.status))) test.check('a closed plain item is unsettled too');
    else test.fail(OWED + 'after verify.regress the closed item reads ' + short({ answer: rc.body, status: c.status }));
    const before = (await records('goal.emptied', 'dg/G2')).length;
    await round();
    const after = (await records('goal.emptied', 'dg/G2')).length;
    if (after === before + 1 && ((await get('dg/G2')).buttons || []).indexOf('done') === -1) test.check('the item done again asks a new goal run, and the goal waits for its pass');
    else test.fail(OWED + 'goal.emptied for the regressed goal ' + before + ' -> ' + after + '; goal buttons ' + short((await get('dg/G2')).buttons) + '; refused on the way: ' + short(answers));
  } finally { await d.stop(); node.close(); }
}

// ── 2. deskVerify ───────────────────────────────────────────────────────
// A git repo of its own: the deskVerify under test, the modules it loads (ignored, so the tree stays clean) and the
// probe suites, committed. Its HEAD is the commit an item holds; MISSING is one it lacks.
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
  probe('zzGatesGreen.js', "console.log('SUCCESS #1 green');\n");
  probe('zzGatesRed.js', "console.log('FAILURE #1 red probe');\n");
  probe('zzGatesRed2.js', "console.log('FAILURE #1 red probe 2');\n");
  probe('zzGatesRed3.js', "console.log('FAILURE #1 red probe 3');\n");
  probe('zzGatesSlow.js', "setTimeout(function () { console.log('SUCCESS #1 slow'); }, 6000);\n");
  fs.writeFileSync(path.join(repo, '.gitignore'), 'spirit/run/\n');
  const git = function (args) { return spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.autocrlf=false'].concat(args), { cwd: repo, encoding: 'utf8' }); };
  git(['init', '-q']);
  git(['add', '.gitignore', 'spirit/test']);
  git(['commit', '-q', '-m', 'probes']);
  const head = String(git(['rev-parse', 'HEAD']).stdout || '').trim();
  return { dir: repo, head: head, verify: path.join(repo, 'spirit', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js') };
}

async function verifyHalf() {
  test.subHeading('2. deskVerify: no goal pass on a red, a gap or a Stop; verify.again runs a goal; a red takes a Done back');
  const repo = scratchRepo();
  if (!/^[0-9a-f]{40}$/.test(repo.head)) { test.fail('the world: the scratch repo has no commit: ' + short(repo.head)); return; }
  const f = function (name) { return [{ path: 'spirit/test/' + name, by: 'claude-windows', core: false }]; };
  const commitLine = function (hash) { return { by: 'claude-windows', at: new Date().toISOString(), text: 'commit ' + hash + ': a commit', taken: '' }; };
  const items = [
    // A: a goal run with a red. A.1 done at a commit the tree holds: unsettled. A.2 closed at one it lacks: kept.
    // A.3 open: nothing to unsettle. A.4 done, listing only a green suite: kept.
    { id: 'ga/G1', goal: '', status: 'goal run started', go: false, files: [] },
    { id: 'ga/G1.1', goal: 'ga/G1', status: 'done', go: true, files: f('zzGatesRed.js') },
    { id: 'ga/G1.2', goal: 'ga/G1', status: 'closed', go: true, files: f('zzGatesRed.js') },
    { id: 'ga/G1.3', goal: 'ga/G1', status: 'running', go: true, files: f('zzGatesRed.js') },
    { id: 'ga/G1.4', goal: 'ga/G1', status: 'done', go: true, files: f('zzGatesGreen.js') },
    // B: a listed file that is missing. C: a slow suite he stops. D: all green, run by verify.again and by a reopen.
    { id: 'gb/G1', goal: '', status: '', go: false, files: [] },
    { id: 'gb/G1.1', goal: 'gb/G1', status: 'done', go: true, files: f('zzGatesGone.js') },
    { id: 'gc/G1', goal: '', status: '', go: false, files: [] },
    { id: 'gc/G1.1', goal: 'gc/G1', status: 'done', go: true, files: f('zzGatesSlow.js') },
    { id: 'gd/G1', goal: '', status: '', go: false, files: [] },
    { id: 'gd/G1.1', goal: 'gd/G1', status: 'done', go: true, files: f('zzGatesGreen.js') },
    // F: an item's own check goes red; F.1, done elsewhere, lists the same suite and is unsettled.
    { id: 'gf/G1', goal: '', status: '', go: false, files: [] },
    { id: 'gf/G1.1', goal: 'gf/G1', status: 'done', go: true, files: f('zzGatesRed2.js') },
    { id: 'gf/G1.2', goal: 'gf/G1', status: 'running', go: true, files: f('zzGatesRed2.js') },
    // E: done at a commit the tree holds, listing a red suite, run on a dirty tree: kept.
    { id: 'ge/G1', goal: '', status: '', go: false, files: [] },
    { id: 'ge/G1.1', goal: 'ge/G1', status: 'done', go: true, files: f('zzGatesRed3.js') },
  ];
  const CHATS = { 'ga/G1.1': [commitLine(repo.head)], 'ga/G1.2': [commitLine(MISSING)], 'gf/G1.1': [commitLine(repo.head)], 'ge/G1.1': [commitLine(repo.head)] };
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'desk', key: '', body: JSON.stringify(body) }); };
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
            asks.push({ verb: verb, args: a });
            if (verb === 'item.files') out = { files: (items.filter(function (i) { return i.id === a.id; })[0] || {}).files || [], filesMore: false };
            else if (verb === 'items.search') out = { items: items.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
            else if (verb === 'item.get') out = { item: JSON.stringify(items.filter(function (i) { return i.id === a.id; })[0] || null), version: 1, change: 1 };
            else if (verb === 'item.chat') out = { chat: (CHATS[a.id] || []).slice(), chatMore: false };
            else if (verb === 'item.checks') out = { checks: [] };
            else if (verb === 'verify.regress') {
              // As the desk does: a settled item or goal is unsettled; anything else is refused.
              const it = items.filter(function (i) { return i.id === a.id; })[0];
              if (it && (it.status === 'done' || it.status === 'closed' || it.goal === '')) { it.status = 'regressed: ' + a.why; out = { change: 1 }; }
              else out = { ok: false, code: 'not-offered' };
            } else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const pullProbe = path.join(scratch, 'pullProbe.js');
  fs.writeFileSync(pullProbe, '// a pull that changes nothing\n');
  const run = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(run, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(repo.verify, 'verify', { db: path.join(run, 'verify.db'), watchMs: 300, suiteMs: 20000, pull: '"' + process.execPath + '" "' + pullProbe + '"' }, run);
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && (!id || x.args.id === id); }); };
  const lineOn = function (id) { return said('chat.add', id).map(function (x) { return String(x.args.text || ''); }); };
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(1500);

    // A: a red in the goal run.
    rec('goal.emptied', { id: 'ga/G1' });
    await waitFor(function () { return lineOn('ga/G1').some(function (l) { return /^goal run on/.test(l); }); }, 30000);
    await sleep(1500);
    if (!said('verify.pass', 'ga/G1').length) test.check('a goal run with a red suite asks no verify.pass on the goal');
    else test.fail(OWED + 'the goal run with a red asked verify.pass on the goal');
    if (lineOn('ga/G1').some(function (l) { return /zzGatesRed\.js/.test(l); })) test.check('and its line on the goal names the red suite');
    else test.fail(OWED + 'goal lines ' + short(lineOn('ga/G1')));
    if (said('verify.regress', 'ga/G1.1').length === 1 && said('verify.regress', 'ga/G1').length >= 1) test.check('the red unsettles the done item listing it, and that item\'s goal');
    else test.fail(OWED + 'verify.regress asked: ' + short(said('verify.regress')));
    if (lineOn('ga/G1.1').some(function (l) { return /zzGatesRed\.js/.test(l); })) test.check('and one line on the unsettled item names the red suite');
    else test.fail(OWED + 'lines on the unsettled item: ' + short(lineOn('ga/G1.1')));
    if (!said('verify.regress', 'ga/G1.2').length) test.check('a closed item whose commit the tree lacks is not unsettled');
    else test.fail(OWED + 'the item whose commit the tree lacks was unsettled');
    if (!said('verify.regress', 'ga/G1.3').length && !said('verify.regress', 'ga/G1.4').length) test.check('nor an open item, nor a done one listing only green suites');
    else test.fail(OWED + 'verify.regress asked ' + short(said('verify.regress')));

    // B: a missing file.
    rec('goal.emptied', { id: 'gb/G1' });
    await waitFor(function () { return lineOn('gb/G1').length > 0; }, 20000);
    await sleep(800);
    if (!said('verify.pass', 'gb/G1').length && lineOn('gb/G1').some(function (l) { return /zzGatesGone\.js/.test(l); })) test.check('a goal run with a listed file missing asks no pass, and its line names the file');
    else test.fail(OWED + 'missing file: passes ' + said('verify.pass', 'gb/G1').length + ', lines ' + short(lineOn('gb/G1')));

    // C: a Stop.
    rec('goal.emptied', { id: 'gc/G1' });
    for (let i = 0; i < 60; i++) {
      const now = await v.call('now', {});
      if (now.body && now.body.running && /zzGatesSlow\.js/.test(String(now.body.running.suite))) break;
      await sleep(250);
    }
    const stop = await v.call('stop', {});
    await waitFor(function () { return lineOn('gc/G1').length > 0; }, 15000);
    await sleep(800);
    if (took(stop) && stop.body.stopped === true && !said('verify.pass', 'gc/G1').length && lineOn('gc/G1').some(function (l) { return /stop/i.test(l); })) test.check('a goal run stopped by hand asks no pass, and its line says it was stopped');
    else test.fail(OWED + 'stop answered ' + short(stop.body) + '; passes ' + said('verify.pass', 'gc/G1').length + ', lines ' + short(lineOn('gc/G1')));

    // D: verify.again on a goal runs its goal run; a reopened goal runs again on its next goal.emptied.
    rec('verify.again', { id: 'gd/G1', goal: true });
    await waitFor(function () { return said('verify.pass', 'gd/G1').length > 0; }, 20000);
    if (said('verify.pass', 'gd/G1').length === 1 && !said('verify.reject', 'gd/G1').length) test.check('verify.again on a goal runs the goal run, and green brings its pass');
    else test.fail(OWED + 'after verify.again on a goal: passes ' + said('verify.pass', 'gd/G1').length + ', rejects ' + said('verify.reject', 'gd/G1').length);
    rec('goal.emptied', { id: 'gd/G1' });
    await waitFor(function () { return said('verify.pass', 'gd/G1').length > 1; }, 20000);
    rec('press', { id: 'gd/G1', what: 'reopen' });
    rec('goal.emptied', { id: 'gd/G1' });
    await waitFor(function () { return said('verify.pass', 'gd/G1').length > 2; }, 20000);
    if (said('verify.pass', 'gd/G1').length === 3) test.check('a goal reopened is run again on its next goal.emptied');
    else test.fail(OWED + 'passes on the reopened goal: ' + said('verify.pass', 'gd/G1').length + ' (3 wanted)');

    // F: an item's own check goes red, and a done item listing that suite is unsettled.
    rec('press', { id: 'gf/G1.2', what: 'claim-done' });
    await waitFor(function () { return said('verify.reject', 'gf/G1.2').length > 0 || lineOn('gf/G1.2').length > 0; }, 20000);
    await waitFor(function () { return said('verify.regress', 'gf/G1.1').length > 0; }, 5000);
    if (said('verify.regress', 'gf/G1.1').length === 1 && !said('verify.regress', 'gf/G1.2').length) test.check('a red in an item\'s check unsettles the done item listing that suite, and not the open one checked');
    else test.fail(OWED + 'after the item check: ' + short(said('verify.regress')));

    // E: a dirty tree is never the ground for an undo.
    const regressBefore = said('verify.regress').length;
    fs.writeFileSync(path.join(repo.dir, 'spirit', 'test', 'zzUncommitted.txt'), 'dirty\n');
    rec('goal.emptied', { id: 'ge/G1' });
    await waitFor(function () { return lineOn('ge/G1').some(function (l) { return /^goal run on/.test(l); }); }, 30000);
    await sleep(1500);
    if (lineOn('ge/G1').some(function (l) { return /^goal run on/.test(l); }) && said('verify.regress').length === regressBefore) test.check('on a tree not pulled clean a red unsettles nothing');
    else test.fail(OWED + 'dirty tree: goal lines ' + short(lineOn('ge/G1')) + ', regress asked ' + short(said('verify.regress').slice(regressBefore)));
  } finally {
    await v.stop();
    node.close();
  }
}

// ── 3. THE FACE ─────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null }; }

async function faceHalf() {
  test.subHeading('3. the full-run button with no goal row on screen sends the desk\'s current goal');
  const fake = require('./deskFake.js').create([]);
  // The List shows an item and no goal row (a search, say).
  fake.items = [{ id: 'tf/G1.1', title: 'An item', goal: 'tf/G1', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = {
    now: function () { return { running: { id: '', suite: '', since: '' }, queued: [] }; },
    stop: function () { return { stopped: true }; },
    'full.run': function () { return { queued: true }; },
  };
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const tabs = doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(50); await settled();
  // What the desk answers when asked for its current goal alone.
  fake.items = [{ id: 'tf/G1', title: 'Current', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  const before = fake.calls.length;
  const body = doc.getElementById('desk-verifier');
  body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
  await settled();
  body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
  await settled(); await sleep(50); await settled();
  const sent = fake.calls.slice(before).filter(function (c) { return c.server === 'deskVerify' && c.verb === 'full.run'; });
  if (sent.length === 1 && sent[0].args && sent[0].args.id === 'tf/G1') test.check('it asks the desk for the current goal and sends that');
  else test.fail(OWED + 'with no goal row the button sent ' + short(sent) + '; calls ' + short(fake.calls.slice(before)));
}

(async function () {
  await deskHalf();
  await verifyHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
