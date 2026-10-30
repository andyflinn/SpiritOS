'use strict';

// spirit/run/process/js/desk/test/desk.js
// The tests of process/js/desk/desk.js, and of no other module (spec: ./desk.md; goal/G41.11). The desk runs as it
// runs on a node: a process on its own pipe and a state folder of its own, seeded with a goal before it starts. A
// pretend node stands where Andy's node is: it keeps what the desk publishes for his pages and what it sends each
// subscribed deskClient, and answers a family's interface the way a node's door does.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));
const packet = require(path.join(RUN, 'spirit', 'client', 'packet.js'));
// THE DESK RUNS FROM A COPY OF THE RUN TREE (never this checkout's own): spirit.js finds its node by the run tree's
// relay-state/environment.json, so a desk started from this tree would publish to the real node beside it. The copy's
// environment.json names the pretend node below, and nothing reaches a real one.
const SKIP = ['relay-state', 'node_modules', 'app-state', 'media', 'published', 'brains', 'test'];
function runCopy(dir, port) {
  fs.cpSync(RUN, dir, { recursive: true, filter: function (src) {
    const rel = path.relative(RUN, src).split(path.sep);
    return !(rel.length === 1 && SKIP.indexOf(rel[0]) !== -1) && !/\.log$/.test(src) && rel.indexOf('node_modules') === -1;
  } });
  fs.mkdirSync(path.join(dir, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'relay-state', 'environment.json'), JSON.stringify({ PORT: port }));
  return path.join(dir, 'process', 'js', 'desk', 'desk.js');
}

const CW = { key: 'MCowBQYDK2VwAyEAdeskProductTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskProductTestWSLAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskProductTestUBIAAAAAAAAAAAAAAAAAAAAA=', label: 'ubuntu-claude' };
const KEYED = { key: 'MCowBQYDK2VwAyEAdeskProductTestKEYEDAAAAAAAAAAAAAAAAAAA=', label: 'keyed-only' };
const OUT = { key: 'MCowBQYDK2VwAyEAdeskProductTestOUTAAAAAAAAAAAAAAAAAAAAA=', label: 'excluded' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskProductTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// A DESK'S WORLD BEFORE IT STARTS: the old session record of each goal, which the desk migrates into its tables at start
// (its migrate), ids as written, the last goal current, its items out of design.
function seed(stateDir, sessions) {
  fs.mkdirSync(stateDir, { recursive: true });
  const db = new DatabaseSync(path.join(stateDir, 'desk.db'));
  db.exec("CREATE TABLE IF NOT EXISTS records (n INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, verb TEXT NOT NULL, by TEXT NOT NULL, body TEXT NOT NULL, key TEXT NOT NULL DEFAULT '')");
  const add = db.prepare('INSERT INTO records (at, verb, by, key, body) VALUES (?, ?, ?, ?, ?)');
  let t = Date.now() - 60000;
  sessions.forEach(function (s) { t += 10; add.run(new Date(t).toISOString(), 'session.set', 'andy', '', JSON.stringify({ session: s })); });
  db.close();
}
// A record of the desk's own, written into its db before it starts beside the sessions (the migrate replays it).
function seedRecord(stateDir, verb, by, body) {
  const db = new DatabaseSync(path.join(stateDir, 'desk.db'));
  db.prepare('INSERT INTO records (at, verb, by, key, body) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), verb, by, '', JSON.stringify(body));
  db.close();
}
// A SCRATCH GIT WORLD, never this checkout's (goal/G41.22): a bare origin, the desk's checkout cloned from it, and another
// clone that pushes new commits onto origin the way an agent's push does.
function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'init.defaultBranch=master', '-c', 'user.name=desk test', '-c', 'user.email=desk@test.invalid', '-c', 'commit.gpgsign=false'].concat(args),
    { cwd: cwd, encoding: 'utf8', env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function gitWorld(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const origin = path.join(dir, 'origin.git'); const checkout = path.join(dir, 'checkout'); const other = path.join(dir, 'other');
  git(dir, ['init', '-q', '--bare', origin]);
  git(dir, ['clone', '-q', origin, other]);
  fs.writeFileSync(path.join(other, 'a.txt'), 'one\n');
  git(other, ['add', 'a.txt']); git(other, ['commit', '-q', '-m', 'first']); git(other, ['push', '-q', 'origin', 'HEAD:master']);
  git(dir, ['clone', '-q', origin, checkout]);
  // Its own identity, for whatever commits in it (goalShare's commit-tree, a rebase).
  git(checkout, ['config', 'user.name', 'desk test']); git(checkout, ['config', 'user.email', 'desk@test.invalid']);
  let made = 0;
  return {
    checkout: checkout,
    // A new commit on origin, pushed from the other clone (pulled first: the desk may have pushed its goal file). Its hash.
    push: function () {
      made += 1;
      for (let i = 0; i < 5; i++) {
        git(other, ['pull', '-q', '--rebase', 'origin', 'master']);
        fs.writeFileSync(path.join(other, 'b.txt'), 'commit ' + made + '\n');
        git(other, ['add', 'b.txt']); git(other, ['commit', '-q', '-m', 'on origin ' + made]);
        if (git(other, ['push', '-q', 'origin', 'HEAD:master']).status === 0) return git(other, ['rev-parse', 'HEAD']).out;
        git(other, ['reset', '-q', '--hard', 'origin/master']);
      }
      return '';
    },
    holds: function (hash) { return !!hash && git(checkout, ['merge-base', '--is-ancestor', hash, 'HEAD']).status === 0; },
    head: function () { return git(checkout, ['rev-parse', 'HEAD']).out; },
  };
}
// A family's interface, as a node's door answers {api: {family}}.
function familyOf(body) {
  if (!body || !body.api || typeof body.api.family !== 'string' || !/^[A-Za-z]\w*$/.test(body.api.family)) return null;
  const f = body.api.family;
  const tried = [path.join(RUN, 'spirit', f, 'api.js'), path.join(RUN, require(path.join(RUN, 'spirit.js')).familyPath(f))];
  for (const file of tried) if (fs.existsSync(file)) return { family: f, interface: fs.readFileSync(file, 'utf8') };
  return { ok: false, code: 'no-interface' };
}
function entriesOf(got) { return Array.isArray(got) ? got : got && Array.isArray(got.rows) ? got.rows : got ? [got] : []; }
// ANDY'S NODE AS THE DESK SEES IT, on its one door (POST /api/spirit {verb, ...}): his pages' publishes
// (events.publish, the row as app) into pages; the event stream peerPost reads its answers on (events.subscribe); a
// family's interface (api {family}); each post to a deskClient's streamListener (peer.post) into posts as {to, json},
// every row of it into sent as {to, row}.
// A job (jobs.create {command, args}) is started for real, as a node starts it, and kept in jobs with its exit.
function pretendNode() {
  const pages = []; const posts = []; const sent = []; const streams = []; const deaf = new Set(); const jobs = [];
  const server = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      // ONE ENVELOPE (goal/G41.15): { call, args } at the door, read here as the verb and its arguments.
      if (b && typeof b.call === 'string') b = Object.assign({}, b.args || {}, { verb: b.call });
      if (b.verb === 'events.subscribe') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (b.verb === 'events.publish') { if (b.app) pages.push(b.app); res.end('{"ok":true}'); return; }
      if (b.verb === 'jobs.create' && typeof b.command === 'string') {
        const job = { command: b.command, args: Array.isArray(b.args) ? b.args.map(String) : [], exit: null };
        jobs.push(job);
        try { spawn(job.command, job.args, { stdio: 'ignore' }).on('exit', function (c) { job.exit = c; }).on('error', function () { job.exit = -1; }); } catch (e) { job.exit = -1; }
        res.end(JSON.stringify({ ok: true, id: 'job-' + jobs.length })); return;
      }
      if (b.verb === 'api' && typeof b.family === 'string') { res.end(JSON.stringify(familyOf({ api: { family: b.family } }))); return; }
      if (b.verb !== 'peer.post') { res.end('{"ok":true}'); return; }
      const hash = 'H' + Date.now() + Math.random();
      res.end(JSON.stringify({ ok: true, hash: hash }));
      let ask = null; try { ask = packet.decode(b.text); } catch (e) { ask = null; }
      const body = (ask && ask.body) || {};
      let answer = familyOf(body);
      const sl = body.deskClient && body.deskClient.streamListener;
      if (!answer && sl) {
        let got = null; try { got = JSON.parse(sl.json); } catch (e) { got = null; }
        posts.push({ to: String(b.to), json: sl.json, got: got });
        // A delivery is one bundle of entries (spirit/appServer.js, goal/G41.12): { run, n, row, full? }, or the end of a
        // full push, { run, n, full: true, end: true }. sent holds each entry's row, and the end entry as it is.
        const rows = entriesOf(got).map(function (e) { return e && e.row && typeof e.row === 'object' ? Object.assign({ entry: e }, e.row) : e; });
        rows.forEach(function (row) { sent.push({ to: String(b.to), row: row }); });
        answer = { heard: true };
        // A subscriber that is away: its post is seen, and never answered, so the desk's peerPost waits it out.
        if (deaf.has(String(b.to))) return;
      }
      const made = packet.encode('api', answer || { ok: false, code: 'no-verb' }, { re: hash });
      setImmediate(function () { streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: String(b.to), text: made.text }) + '\n\n'); } catch (e) { /* gone */ } }); });
    });
  });
  return { server: server, pages: pages, posts: posts, sent: sent, deaf: deaf, jobs: jobs };
}

const GOAL = { id: 'goal/G100', title: 'Desk test' };
const ITEMS = ['goal/G100.1', 'goal/G100.2', 'goal/G100.3', 'goal/G100.4', 'goal/G100.5', 'goal/G100.6'];
const OTHER = { id: 'goal/G200', title: 'Another goal' };
const OTHER_ITEMS = ['goal/G200.1', 'goal/G200.2', 'goal/G200.3', 'goal/G200.4', 'goal/G200.5', 'goal/G200.6'];

test.startTest('desk.js: the desk server (goal/G41.11)');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-product-'));
  const state = path.join(scratch, 'state');
  seed(state, [
    { goal: OTHER, items: OTHER_ITEMS.map(function (id) { return { id: id, title: 'Other ' + id, blocks: [OTHER.id] }; }) },
    { goal: GOAL, items: ITEMS.map(function (id) { return { id: id, title: 'Item ' + id, blocks: [GOAL.id] }; }) },
  ]);
  // THE PIPE BY appClient.pipePathFor ALONE (Andy, 2026-10-27: "don't use unix sockets in tests, use
  // appClient.pipePathFor"): a \\.\pipe\ name on Windows, the door's own place under the scratch folder elsewhere.
  const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const node = pretendNode();
  await new Promise(function (r) { node.server.listen(0, '127.0.0.1', r); });
  const SERVER = runCopy(path.join(scratch, 'run'), node.server.address().port);
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job' }),
  });
  // The desks of the auto pull cases, each started on its own (below), each stopped at the end.
  const pullKids = [];
  const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
  const filesOf = async function (id) { return ((await call('item.files', { id: id }, ANDY)).files) || []; };
  const why = function (r) { return r && r.extra && r.extra.why ? String(r.extra.why) : ''; };
  // The to list his line was published with, as his pages heard it.
  const toOf = async function (text) {
    for (let i = 0; i < 40; i++) {
      const hit = node.pages.filter(function (o) { return o && o.table === 'chat' && o.row && o.row.text === text; })[0];
      if (hit) return { heard: true, to: Array.isArray(hit.to) ? hit.to : null };
      await sleep(100);
    }
    return { heard: false, to: null };
  };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the desk did not start'); return; }
    await call('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true }, ANDY);
    await call('profile.set', { agent: WSL.key, name: 'WSL Claude', nick: 'wsl', included: true, cap: false }, ANDY);
    await call('profile.set', { agent: UBI.key, name: 'Ubuntu Claude', nick: 'ubi', included: true, cap: true }, ANDY);
    await call('profile.set', { agent: OUT.key, name: 'Out', nick: 'out', included: false, cap: true }, ANDY);
    await call('agent.state', { word: 'listening' }, CW);
    await call('agent.state', { word: 'listening' }, WSL);
    await call('agent.state', { word: 'listening' }, KEYED);
    await call('subscribe', { family: 'deskClient' }, CW);

    test.subHeading('bundles: item.files.add takes a list of paths (Desk only)');
    await call('item.take', { id: 'goal/G100.1' }, CW);
    const paths = ['spirit/run/a.js', 'spirit/run/b.js', 'spirit/run/c.js'];
    const bundle = await call('item.files.add', { id: 'goal/G100.1', paths: paths }, CW);
    const listed = (await filesOf('goal/G100.1')).map(function (f) { return f.path; });
    ok(bundle.ok !== false && paths.every(function (p) { return listed.indexOf(p) !== -1; }), 'item.files.add {id, paths} lands every path of the list on the caller\'s list',
      'the bundle answered ' + short(bundle) + '; listed ' + short(listed));

    test.subHeading('bundles: a goal pushed whole reaches a subscribed client as bundles of rows');
    const before = node.posts.length;
    await call('press', { id: OTHER.id, what: 'make-current' }, ANDY);
    const wholeRows = function (p) {
      const rows = entriesOf(p.got).map(function (e) { return e && e.row ? e.row : e; });
      return rows.filter(function (r) { return r && r.verb === 'goal.whole' && r.item && String(r.item.id).indexOf(OTHER.id) === 0; }).length;
    };
    const mine = function () { return node.posts.slice(before).filter(function (p) { return p.to === CW.key; }); };
    for (let i = 0; i < 60; i++) { await sleep(100); if (mine().reduce(function (m, p) { return m + wholeRows(p); }, 0) >= OTHER_ITEMS.length + 1) break; }
    const pushed = mine();
    const most = pushed.reduce(function (m, p) { return Math.max(m, wholeRows(p)); }, 0);
    const total = pushed.reduce(function (m, p) { return m + wholeRows(p); }, 0);
    ok(total >= OTHER_ITEMS.length + 1 && most > 1, 'its ' + (OTHER_ITEMS.length + 1) + ' rows come several to a post, not one post a row',
      'rows ' + total + ' in ' + pushed.length + ' posts, the most in one post ' + most);
    ok(pushed.every(function (p) { return Buffer.byteLength(String(p.json), 'utf8') <= 16384; }), 'each post stays within one payload', 'a post of ' + short(pushed.map(function (p) { return Buffer.byteLength(String(p.json), 'utf8'); })) + ' bytes');
    await call('press', { id: GOAL.id, what: 'make-current' }, ANDY);
    // Out of design, so his Go is offered: what refuses it below is the file list alone.
    const ended = await call('press', { id: GOAL.id, what: 'end-design' }, ANDY);
    ok(!!ended.change, 'the world: the goal leaves design mode', 'End design answered ' + short(ended));

    test.subHeading('files known in design: a code item is not green with an empty file list');
    await call('press', { id: 'goal/G100.2', what: 'code' }, ANDY);
    const bare = await facts('goal/G100.2');
    ok(bare.code === true && bare.green === false, 'a code item with no file listed is not green', 'code ' + short(bare.code) + ', green ' + short(bare.green) + ', files ' + short(bare.fileCount));
    const goEmpty = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    ok(goEmpty.ok === false && /file/i.test(why(goEmpty) + ' ' + String(goEmpty.error || '')), 'his Go on it is refused, the why naming its empty file list', 'Go answered ' + short(goEmpty));
    await call('item.take', { id: 'goal/G100.2' }, UBI);
    await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/early.js' }, UBI);
    const listedOne = await facts('goal/G100.2');
    ok(listedOne.green === true, 'with a file listed it is green', 'green ' + short(listedOne.green));
    const goNow = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    ok(!!goNow.change && goNow.ok !== false, 'and his Go is taken', 'Go answered ' + short(goNow));
    const lateAdd = await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/late.js' }, UBI);
    const entries = await filesOf('goal/G100.2');
    const early = entries.filter(function (f) { return f.path === 'spirit/run/early.js'; })[0] || {};
    const late = entries.filter(function (f) { return f.path === 'spirit/run/late.js'; })[0] || null;
    ok(!!lateAdd.change && !!late, 'a file added after his Go is allowed', 'the late add answered ' + short(lateAdd));
    ok(!!late && late.late === true && early.late !== true, 'and marked late on the item; the file listed before Go is not', 'late ' + short(late) + ', early ' + short(early));

    test.subHeading('addresses: all or a nick counts only when punctuation follows');
    const plainAll = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'all agents seem busy' }, ANDY), 'all agents seem busy'));
    ok(plainAll.heard && !(plainAll.to && plainAll.to.length), '"all agents seem busy" is addressed to nobody', 'its to list: ' + short(plainAll));
    const plainNick = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'wsl is here' }, ANDY), 'wsl is here'));
    ok(plainNick.heard && !(plainNick.to && plainNick.to.length), '"wsl is here" is addressed to nobody', 'its to list: ' + short(plainNick));
    const commaNick = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'wsl, look here' }, ANDY), 'wsl, look here'));
    ok(!!commaNick.to && commaNick.to.length === 1 && commaNick.to[0] === WSL.key, '"wsl, ..." is addressed to wsl alone', 'its to list: ' + short(commaNick));
    const allColon = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'all: your thoughts?' }, ANDY), 'all: your thoughts?'));
    const to = allColon.to || [];
    ok(to.indexOf(CW.key) !== -1 && to.indexOf(WSL.key) !== -1, '"all: ..." is addressed to the included agents', 'its to list: ' + short(to));
    ok(to.indexOf(UBI.key) !== -1 && to.indexOf(KEYED.key) !== -1, 'among them one known by its profile alone, and one known by its key alone', 'its to list: ' + short(to));
    ok(to.indexOf(OUT.key) === -1, 'and never one he excluded', 'its to list: ' + short(to));

    test.subHeading('auto-cap: a box write into red offers the cap to the agents with cap on');
    const tooBig = await call('box.write', { id: 'goal/G100.4', text: 'x'.repeat(20000), version: 0 }, ANDY);
    const room = tooBig && tooBig.extra && Number(tooBig.extra.max) > 0 ? Number(tooBig.extra.max) : 0;
    ok(room > 0, 'the desk names the room of one answer (' + room + ' bytes)', 'a box past one answer answered ' + short(tooBig));
    if (room > 0) {
      const v0 = (await facts('goal/G100.4')).version || 0;
      const small = await call('box.write', { id: 'goal/G100.4', text: 'a short box', version: v0 }, ANDY);
      const takeSmall = await call('box.take', { id: 'goal/G100.4' }, WSL);
      ok(!!small.change && !!takeSmall.change, 'a box write below red offers nothing: an agent with cap off takes it plainly', 'write ' + short(small) + ', take ' + short(takeSmall));
      await call('box.release', { id: 'goal/G100.4' }, WSL);
      const v1 = (await facts('goal/G100.4')).version || 0;
      const red = 'y'.repeat(Math.ceil(room * 0.8));
      const big = await call('box.write', { id: 'goal/G100.4', text: red, version: v1 }, ANDY);
      ok(!!big.change, 'a box write to 80% of one answer lands', 'it answered ' + short(big));
      const offOff = await call('box.take', { id: 'goal/G100.4' }, WSL);
      ok(offOff.ok === false && /cap/i.test(why(offOff)), 'then an agent with cap off is refused the box, the cap\'s why', 'wsl\'s take answered ' + short(offOff));
      const onTake = await call('box.take', { id: 'goal/G100.4' }, UBI);
      const held = await facts('goal/G100.4');
      ok(!!onTake.change && held.boxTaken === UBI.label, 'and an agent with cap on takes it, held for one write', 'ubi\'s take answered ' + short(onTake) + ', boxTaken ' + short(held.boxTaken));
    }

    // ── THE POSITION (goal/G41.11, 0ebb4abd; Andy: "(if it restarts or similar) it calls the "subscribe/(connect)"
    // verb do desk, (re-use that verb) with the position number as argument") ─────────────────────────────────────────
    const rowsTo = function (key, from) { return node.sent.slice(from).filter(function (x) { return x.to === key; }).map(function (x) { return x.row; }); };
    const isEnd = function (r) { return !!r && r.full === true && r.end === true; };
    const pushEnded = function (key, from) { return rowsTo(key, from).some(isEnd); };
    const waitEnd = async function (key, from, ms) { for (let i = 0; i < (ms || 15000) / 100; i++) { if (pushEnded(key, from)) return true; await sleep(100); } return false; };
    const memberIds = [GOAL.id].concat(ITEMS);
    const wholeOf = function (rows) { return rows.filter(function (r) { return r && r.verb === 'goal.whole' && r.item; }); };
    const sideOf = function (rows) { return rows.filter(function (r) { return r && typeof r.table === 'string' && !r.verb; }); };

    test.subHeading('the position: a subscribe without since bootstraps as before');
    const FRESH = { key: 'MCowBQYDK2VwAyEAdeskProductTestFRESHAAAAAAAAAAAAAAAAAAA=', label: 'fresh' };
    const f0 = node.sent.length;
    const plain = await call('subscribe', { family: 'deskClient' }, FRESH);
    const plainEnded = await waitEnd(FRESH.key, f0);
    const plainRows = rowsTo(FRESH.key, f0);
    const plainIds = wholeOf(plainRows).map(function (r) { return String(r.item.id); });
    ok(plain.subscribed === true && plainEnded && memberIds.every(function (id) { return plainIds.indexOf(id) !== -1; }), 'with no since, the current goal\'s facts come whole (the goal and each of its ' + ITEMS.length + ' items)',
      'subscribed ' + short(plain) + ', ended ' + plainEnded + ', facts of ' + short(plainIds));
    ok(plainEnded && sideOf(plainRows).length === 0, 'and no side row (no chat line, check or box): nothing after a position it never named', 'side rows: ' + short(sideOf(plainRows).map(function (r) { return r.table + ' ' + r.id; })));
    const zero = node.sent.length;
    await call('subscribe', { family: 'deskClient', since: 0 }, FRESH);
    await waitEnd(FRESH.key, zero);
    ok(sideOf(rowsTo(FRESH.key, zero)).length === 0 && wholeOf(rowsTo(FRESH.key, zero)).length >= memberIds.length, 'since 0 is the same as none', 'rows: ' + short(rowsTo(FRESH.key, zero).length));

    // GONE (goal/G41.22): the catch-up from a desk change number (a subscribe with since: what changed after it, a line to
    // another agent, a box written after it) went with the one stream protocol (74ac4c65, goal/G41.12: a push is the
    // whole goal, then its end); its checks went with it. So did "a subscriber whose delivery failed is kept": since
    // 3ad44a6b (Andy: "take the 3 seconds out, appServer.js calls peerPost in the most basic way") a delivery left
    // unanswered drops its subscriber, which subscribes again when it is back.

    test.subHeading('the position: every push ends with its end mark, { full: true, end: true }');
    const lastOf = function (rows) { return rows[rows.length - 1]; };
    ok(isEnd(lastOf(plainRows)), 'the last entry of a push is its end, { full: true, end: true }',
      'last row: ' + short(lastOf(plainRows)));
    ok(plainRows.filter(isEnd).length === 1, 'once per push', 'ends in one push: ' + plainRows.filter(isEnd).length);

    // ── PUSHGOAL (goal/G41.22, box v22; Andy: "the current goal and all its items, get a new button in the detail
    // panel: "push Goal", the ver on the desk is: "pushgoal"") ──────────────────────────────────────────────────────────
    test.subHeading('pushgoal: a verb of the desk, Andy\'s alone');
    let pgFile = null;
    try { pgFile = JSON.parse(fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'family', 'pushgoal.json'), 'utf8')); } catch (e) { pgFile = null; }
    const pgRequest = pgFile && pgFile.request && typeof pgFile.request === 'object' && !Array.isArray(pgFile.request) ? pgFile.request : null;
    ok(!!pgFile && typeof pgFile.description === 'string' && pgFile.description !== '' && !!pgRequest, 'family/pushgoal.json beside the others describes it, with its request',
      'pushgoal.json: ' + short(pgFile));
    let deskVerbs = {};
    try { deskVerbs = require(path.join(RUN, 'process', 'js', 'desk', 'family', 'api.js')).verbs || {}; } catch (e) { deskVerbs = {}; }
    ok(Object.prototype.hasOwnProperty.call(deskVerbs, 'pushgoal'), 'the family\'s api.js lists it, so a call of it leaves the spirit object',
      'api.js lists ' + Object.keys(deskVerbs).length + ' verbs, pushgoal not among them');
    // Called with the request its own file declares: an id, if it takes one, is the current goal's.
    const pgArgs = {};
    Object.keys(pgRequest || {}).forEach(function (k) { pgArgs[k] = k === 'id' ? GOAL.id : pgRequest[k]; });
    const isWhole = function (r) { return !!r && r.verb === 'goal.whole' && !!r.item; };
    const nOf = function (r) { return Number(r && r.entry ? r.entry.n : r && r.n) || 0; };
    const chatTexts = function (rows) { return rows.filter(function (r) { return r && r.table === 'chat' && r.row; }).map(function (r) { return String(r.row.text || ''); }); };
    const pgA = node.sent.length;
    const pgAgent = await call('pushgoal', pgArgs, CW);
    await sleep(1000);
    ok(pgAgent.ok === false && pgAgent.code === 'not-owner' && !wholeOf(rowsTo(CW.key, pgA)).length, 'an agent calling it is refused not-owner, and nothing is pushed',
      'cw\'s call answered ' + short(pgAgent) + '; whole rows after it: ' + wholeOf(rowsTo(CW.key, pgA)).length);

    test.subHeading('pushgoal: the current goal whole to every subscribed deskClient, and the untaken lines with it');
    // cw and ubi subscribed, as their deskClients do at start; each first push ended.
    for (const who of [UBI, CW]) { const s0 = node.sent.length; await call('subscribe', { family: 'deskClient' }, who); await waitEnd(who.key, s0); }
    // His lines to the agents, before it: one cw takes, one to cw nobody takes, one to ubi. Each reached its agent live.
    const PG = { taken: 'cw, this one you take before the push', open: 'cw, nobody took this one', ubi: 'ubi, this one is not for cw' };
    await call('chat.add', { id: 'goal/G100.6', text: PG.taken }, ANDY);
    const pgTook = await call('line.take', { id: 'goal/G100.6' }, CW);
    await call('chat.add', { id: 'goal/G100.5', text: PG.ubi }, ANDY);
    await call('chat.add', { id: 'goal/G100.5', text: PG.open }, ANDY);
    for (let i = 0; i < 100; i++) { if (chatTexts(rowsTo(CW.key, 0)).indexOf(PG.open) !== -1 && chatTexts(rowsTo(UBI.key, 0)).indexOf(PG.ubi) !== -1) break; await sleep(100); }
    ok(!!pgTook.change && chatTexts(rowsTo(CW.key, 0)).indexOf(PG.open) !== -1 && chatTexts(rowsTo(UBI.key, 0)).indexOf(PG.ubi) !== -1,
      'the world: cw took his first line, and his lines reached cw and ubi live', 'cw\'s take answered ' + short(pgTook));
    const SUBS = [CW, FRESH, UBI];
    const pgB = node.sent.length;
    const taken0 = {};
    SUBS.forEach(function (a) { taken0[a.key] = rowsTo(a.key, 0).reduce(function (m, r) { return Math.max(m, nOf(r)); }, 0); });
    const pgAndy = await call('pushgoal', pgArgs, ANDY);
    const wholeIds = function (a) { return wholeOf(rowsTo(a.key, pgB)).map(function (r) { return String(r.item.id); }); };
    const allWhole = function (a) { return memberIds.every(function (id) { return wholeIds(a).indexOf(id) !== -1; }); };
    for (let i = 0; i < 150; i++) { if (SUBS.every(allWhole) && chatTexts(rowsTo(CW.key, pgB)).indexOf(PG.open) !== -1) break; await sleep(100); }
    await sleep(500);
    ok(pgAndy.ok !== false && !pgAndy.code, 'Andy calls it, and the desk takes it', 'his call answered ' + short(pgAndy));
    ok(SUBS.every(allWhole), 'it pushes the current goal whole, the goal and each of its ' + ITEMS.length + ' items, to every subscribed deskClient (cw, fresh, ubi)',
      'whole after it: ' + short(SUBS.map(function (a) { return a.label + ' ' + wholeIds(a).length; })));
    const strays = SUBS.map(function (a) { return wholeIds(a).filter(function (id) { return memberIds.indexOf(id) === -1; }); }).reduce(function (m, x) { return m.concat(x); }, []);
    ok(SUBS.every(allWhole) && strays.length === 0, 'the current goal\'s alone: no row of another goal comes whole with it', 'other whole rows: ' + short(strays));
    // Andy, agreed in the box: "it moves each agent's read pointer to the newest change, never back to the start". What
    // the desk can be seen to do of it: what it sends is numbered on from what each had taken, never below it.
    const backwards = SUBS.filter(function (a) { const rows = rowsTo(a.key, pgB); return !rows.length || rows.some(function (r) { return nOf(r) < taken0[a.key]; }); });
    ok(backwards.length === 0, 'and each is handed it numbered at or past what it had taken: its read pointer moves on, never back to the start',
      'nothing, or numbered below what it had, to: ' + short(backwards.map(function (a) { return a.label + ' (had ' + taken0[a.key] + ', got ' + short(rowsTo(a.key, pgB).map(nOf)) + ')'; })));
    // Andy, agreed in the box: "in that same wake hands the agent every line of Andy's addressed to it that nobody took
    // yet: nothing replayed, nothing lost."
    const cwWake = chatTexts(rowsTo(CW.key, pgB));
    const ubiWake = chatTexts(rowsTo(UBI.key, pgB));
    ok(cwWake.indexOf(PG.open) !== -1 && ubiWake.indexOf(PG.ubi) !== -1, 'in the same wake each is handed his line to it that nobody took: nothing lost',
      'cw handed ' + short(cwWake) + '; ubi handed ' + short(ubiWake));
    ok(cwWake.indexOf(PG.open) !== -1 && cwWake.indexOf(PG.taken) === -1 && cwWake.indexOf(PG.ubi) === -1 && ubiWake.indexOf(PG.open) === -1,
      'and not his line cw took already, nor a line to another agent: nothing replayed', 'cw handed ' + short(cwWake) + '; ubi handed ' + short(ubiWake));

    // ── AUTO PULL (goal/G41.22, box v22; Andy: "when the desk gets a claim red/build done. it pulls it's repo
    // automatically"; agreed: "it never pulls a checkout with edits of its own, or while a test run is going on in it:
    // then it pulls nothing and says so under the item.") ──────────────────────────────────────────────────────────────
    // Each case is a desk of its own, on a scratch git world of its own: its checkout is the manifest value goalRepo,
    // the repo the desk already names as its own (default: the checkout holding desk.js). The pretend node runs the
    // jobs it is asked to, as a node does, so a pull made as a job (goalShare's way) runs as one made in the desk does.
    try { kid.kill(); } catch (e) { /* gone */ }
    const PULL = { id: 'goal/G300', title: 'Pull test' };
    const PULL_ITEMS = ['goal/G300.1', 'goal/G300.2', 'goal/G300.3'];
    const pullSession = { goal: PULL, items: PULL_ITEMS.map(function (id) { return { id: id, title: 'Pull ' + id, blocks: [PULL.id] }; }) };
    const startDesk = async function (name, records, values) {
      const root = path.join(scratch, name);
      const st = path.join(root, 'state');
      seed(st, [pullSession]);
      records.forEach(function (r) { seedRecord(st, r.verb, r.by, r.body); });
      const p = appClient.pipePathFor(root, 'desk', process.platform, 'process');
      if (process.platform !== 'win32') fs.mkdirSync(path.dirname(p), { recursive: true });
      const c = appClient.createAppClient({ rootDir: root });
      c.register('desk', p);
      pullKids.push(spawn(process.execPath, [SERVER, JSON.stringify(values), '--pipe', p, '--state', st], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: name + '-job' }) }));
      let on = false;
      for (let i = 0; i < 60 && !on; i++) { await sleep(150); try { const r = await c.ask('api'); on = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
      if (!on) return null;
      return function (verb, args, caller) { const q = {}; q[verb] = args; return c.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
    };
    // A code item with his Go, its file and its suite listed, held by the agent: a claim of it is taken.
    const ready = async function (ask, id, agent) {
      await ask('press', { id: PULL.id, what: 'end-design' }, ANDY);
      await ask('press', { id: id, what: 'code' }, ANDY);
      await ask('item.take', { id: id }, agent);
      await ask('item.files.add', { id: id, path: 'spirit/run/pulled-' + id.replace(/\W/g, '') + '.js' }, agent);
      await ask('item.suites.add', { id: id, path: 'spirit/test/pulled.js' }, ANDY);
      return ask('press', { id: id, what: 'go' }, ANDY);
    };
    const profiles = async function (ask) {
      await ask('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true }, ANDY);
      await ask('profile.set', { agent: UBI.key, name: 'Ubuntu Claude', nick: 'ubi', included: true, cap: true }, ANDY);
    };
    // Every job the node was asked to run has exited (the goal file's share fetches in the same checkout).
    const jobsDone = async function () { for (let i = 0; i < 150 && node.jobs.some(function (j) { return j.exit === null; }); i++) await sleep(100); };
    const deskLines = async function (ask, id) { return (((await ask('item.chat', { id: id }, ANDY)).chat) || []).filter(function (l) { return l && l.by === 'desk'; }); };
    const waitFor = async function (cond, ms) { for (let i = 0; i < ms / 100; i++) { if (await cond()) return true; await sleep(100); } return !!(await cond()); };

    test.subHeading('auto pull: a red claim or a build claim taken, the desk pulls its own checkout');
    const worldA = gitWorld(path.join(scratch, 'git-a'));
    const askA = await startDesk('desk-a', [], { goalRepo: worldA.checkout });
    ok(!!askA && !!worldA.head(), 'the world: a desk of its own starts on a scratch checkout of a scratch origin', 'desk ' + !!askA + ', checkout at ' + short(worldA.head()));
    if (askA) {
      await profiles(askA);
      const goA = await ready(askA, 'goal/G300.1', CW);
      await jobsDone();
      const h1 = worldA.push();
      const redA = await askA('claim', { id: 'goal/G300.1', phase: 'red', commit: h1 }, CW);
      ok(!!h1 && !!redA.change, 'the world: a commit lands on origin, and cw\'s red claim is taken', 'go ' + short(goA) + ', origin\'s new commit ' + short(h1) + ', the claim answered ' + short(redA));
      const pulledRed = await waitFor(function () { return worldA.holds(h1); }, 15000);
      ok(pulledRed, 'the red claim taken, its checkout pulls: it holds the commit pushed onto origin since', 'checkout at ' + short(worldA.head()) + ', origin\'s new commit ' + short(h1));
      await jobsDone();
      const h2 = worldA.push();
      const buildA = await askA('claim', { id: 'goal/G300.1', phase: 'build', commit: h2 }, CW);
      ok(!!h2 && !!buildA.change, 'the world: another commit lands on origin, and cw\'s build claim is taken', 'origin\'s new commit ' + short(h2) + ', the claim answered ' + short(buildA));
      const pulledBuild = await waitFor(function () { return worldA.holds(h2); }, 15000);
      ok(pulledBuild, 'the build claim taken, it pulls again', 'checkout at ' + short(worldA.head()) + ', origin\'s new commit ' + short(h2));

      test.subHeading('auto pull: never over edits of its own: it pulls nothing and says so under the item');
      await jobsDone();
      const edited = path.join(worldA.checkout, 'a.txt');
      fs.writeFileSync(edited, 'an edit of its own, not committed\n');
      const headE = worldA.head();
      const h3 = worldA.push();
      const linesE = (await deskLines(askA, 'goal/G300.2')).length;
      const goE = await ready(askA, 'goal/G300.2', UBI);
      const redE = await askA('claim', { id: 'goal/G300.2', phase: 'red', commit: h3 }, UBI);
      ok(!!h3 && !!redE.change, 'the world: a commit lands on origin, its checkout holds an edit, and ubi\'s red claim is taken', 'go ' + short(goE) + ', the claim answered ' + short(redE));
      const saidE = await waitFor(async function () { return (await deskLines(askA, 'goal/G300.2')).length > linesE; }, 15000);
      await sleep(1000);
      const keptE = fs.readFileSync(edited, 'utf8') === 'an edit of its own, not committed\n';
      ok(saidE && !worldA.holds(h3) && worldA.head() === headE && keptE, 'a claim taken over a checkout with an edit of its own pulls nothing, the edit stays, and a line of the desk\'s under the item says so',
        'a desk line ' + saidE + ', pulled ' + worldA.holds(h3) + ', head moved ' + (worldA.head() !== headE) + ', edit kept ' + keptE);
    }

    test.subHeading('auto pull: never while a test run goes on in it: it pulls nothing and says so under the item');
    // The run the desk knows of is deskVerify's: an item handed over (verify.answer taken) whose run has not been read
    // ended (no verify.state ended since) is verifyRunning. Written into its records before it starts, as the migrate
    // replays them; a test run the desk cannot know of is no case of this test.
    const worldR = gitWorld(path.join(scratch, 'git-r'));
    const askR = await startDesk('desk-r', [{ verb: 'verify.answer', by: 'desk', body: { id: 'goal/G300.3', taken: true, by: 'desk', key: '' } }], { goalRepo: worldR.checkout });
    ok(!!askR, 'the world: a desk of its own starts, a run deskVerify took on goal/G300.3 still going', 'desk ' + !!askR);
    if (askR) {
      await profiles(askR);
      const goR = await ready(askR, 'goal/G300.1', CW);
      await jobsDone();
      const headR = worldR.head();
      const h4 = worldR.push();
      const linesR = (await deskLines(askR, 'goal/G300.1')).length;
      const redR = await askR('claim', { id: 'goal/G300.1', phase: 'red', commit: h4 }, CW);
      ok(!!h4 && !!redR.change, 'the world: a commit lands on origin, and cw\'s red claim is taken', 'go ' + short(goR) + ', the claim answered ' + short(redR));
      const saidR = await waitFor(async function () { return (await deskLines(askR, 'goal/G300.1')).length > linesR; }, 15000);
      await sleep(1000);
      ok(saidR && !worldR.holds(h4) && worldR.head() === headR, 'a claim taken while a run goes on pulls nothing, and a line of the desk\'s under the item says so',
        'a desk line ' + saidR + ', pulled ' + worldR.holds(h4) + ', head moved ' + (worldR.head() !== headR));
    }
  } finally {
    pullKids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
    try { kid.kill(); } catch (e) { /* gone */ }
    node.server.close();
  }
}()).then(function () { test.reportSuccessFailureCount(); setTimeout(function () { process.exit(process.exitCode || 0); }, 200); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); setTimeout(function () { process.exit(1); }, 200); });
