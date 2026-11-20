'use strict';

// spirit/run/spirit/app/desk/test/desk.js
// The tests of spirit/app/desk/desk.js, and of no other module (spec: ./desk.md; goal/G41.11). The desk runs as it
// runs on a node: a process on its own pipe and a state folder of its own, seeded with a goal before it starts. A
// pretend node stands where Andy's node is: it keeps what the desk publishes for his pages and what it sends each
// subscribed deskClient, and answers a family's interface the way a node's door does.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/desk/test/desk/' + name + tempAsked); }
// Its folder is removed by the last after of this file, once its databases are closed and its servers stopped: on
// Windows a folder holding an open database cannot be removed, and the suite was red on 'it leaves no temp folder behind'.
const appClient = require(path.join(RUN, 'spirit', 'appClient.js'));
const packet = require(path.join(RUN, 'spirit', 'client', 'packet.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
// THE DESK RUNS FROM A COPY OF THE RUN TREE (never this checkout's own): spirit.js finds its node by the run tree's
// spirit/state/environment.json, so a desk started from this tree would publish to the real node beside it. The copy's
// environment.json names the pretend node below, and nothing reaches a real one.
const SKIP = ['app-state', 'media', 'published', 'brains', 'test'];
function runCopy(dir, port) {
  fs.cpSync(RUN, dir, { recursive: true, filter: function (src) {
    const rel = path.relative(RUN, src).split(path.sep);
    return !(rel.length === 1 && SKIP.indexOf(rel[0]) !== -1) && !/\.log$/.test(src) && !VENDORED_FOLDERS.holds(path.relative(RUN, src)) && rel.indexOf('state') === -1;
  } });
  fs.mkdirSync(path.join(dir, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
  return path.join(dir, 'spirit', 'app', 'desk', 'desk.js');
}

const CW = { key: 'MCowBQYDK2VwAyEAdeskProductTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskProductTestWSLAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskProductTestUBIAAAAAAAAAAAAAAAAAAAAA=', label: 'ubuntu-claude' };
const KEYED = { key: 'MCowBQYDK2VwAyEAdeskProductTestKEYEDAAAAAAAAAAAAAAAAAAA=', label: 'keyed-only' };
const OUT = { key: 'MCowBQYDK2VwAyEAdeskProductTestOUTAAAAAAAAAAAAAAAAAAAAA=', label: 'excluded' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskProductTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// A DESK'S WORLD BEFORE IT STARTS, in today's tables as the desk writes them: each goal and its items, ids as written,
// the goal in design, its items out of design, the last goal current. The desk reads them at start; no old file is
// moved in (Andy, goal/G47.1: "old files or tables should not be mended, THE SHOULD BE FUCKING KILLED AND ELIMINATED
// FOREVER!"), and a verb cannot make a goal of a chosen number.
function seed(stateDir, sessions) {
  fs.mkdirSync(stateDir, { recursive: true });
  const db = new DatabaseSync(path.join(stateDir, 'desk.db'));
  db.exec("CREATE TABLE IF NOT EXISTS items (goal INTEGER NOT NULL, item INTEGER NOT NULL, creator TEXT NOT NULL, special INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL DEFAULT '', data TEXT NOT NULL," +
    ' change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item));' +
    'CREATE TABLE IF NOT EXISTS desk_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);');
  const add = db.prepare("INSERT INTO items (goal, item, creator, special, at, data, change) VALUES (?, ?, 'andy', 0, ?, ?, ?)");
  const nums = function (id) { const m = /^goal\/G(\d+)(?:\.(\d+))?$/.exec(id); return [Number(m[1]), Number(m[2] || 0)]; };
  let t = Date.now() - 60000;
  let n = 0;
  sessions.forEach(function (s) {
    t += 10;
    const at = new Date(t).toISOString();
    const ids = s.items.map(function (x) { return String(x.id); });
    const g = nums(s.goal.id);
    n += 1;
    add.run(g[0], g[1], at, JSON.stringify({ id: s.goal.id, title: s.goal.title, goal: true, goalId: '', made: 'andy', at: at,
      goalState: { design: true, abandoned: false, members: ids } }), n);
    s.items.forEach(function (x) {
      const k = nums(String(x.id));
      n += 1;
      add.run(k[0], k[1], at, JSON.stringify({ id: String(x.id), title: String(x.title || ''), goal: false, goalId: s.goal.id, made: 'andy',
        blocks: (Array.isArray(x.blocks) ? x.blocks : [x.blocks || s.goal.id]).map(String), design: false }), n);
    });
  });
  const state = db.prepare('INSERT INTO desk_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
  state.run('change', JSON.stringify(n));
  state.run('current', JSON.stringify(sessions.length ? String(sessions[sessions.length - 1].goal.id) : ''));
  db.close();
}
function plantOldRules(stateDir) {
  const db = new DatabaseSync(path.join(stateDir, 'desk.db'));
  try {
    // As the desk made them before rules went out (spirit/app/desk/nodeDesk.js, before goal/G47.4).
    db.exec('CREATE TABLE IF NOT EXISTS rules (n INTEGER PRIMARY KEY AUTOINCREMENT, rule INTEGER NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, text TEXT NOT NULL, autoAttach INTEGER NOT NULL DEFAULT 0);' +
      'CREATE INDEX IF NOT EXISTS rules_rule ON rules (rule);' +
      'CREATE TABLE IF NOT EXISTS rule_drafts (rule INTEGER PRIMARY KEY, at TEXT NOT NULL, text TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS rule_chat (rule INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, creator TEXT NOT NULL, text TEXT NOT NULL, born INTEGER NOT NULL, PRIMARY KEY (rule, seq));' +
      'CREATE INDEX IF NOT EXISTS rule_chat_born ON rule_chat (born);');
    const at = new Date().toISOString();
    db.prepare('INSERT INTO rules (rule, at, by, type, label, status, text, autoAttach) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(1, at, 'andy', 'code', 'an old rule', 'active', 'an old rule', 0);
    db.prepare('INSERT INTO rule_drafts (rule, at, text) VALUES (?, ?, ?)').run(1, at, 'an old draft');
    db.prepare('INSERT INTO rule_chat (rule, seq, at, by, creator, text, born) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 1, at, 'andy', 'andy', 'an old line', 1);
  } finally { db.close(); }
}
// A SCRATCH GIT WORLD, never this checkout's (goal/G41.22): a bare origin, the desk's checkout cloned from it, and another
// clone that pushes new commits onto origin the way an agent's push does.
function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'init.defaultBranch=master', '-c', 'user.name=desk test', '-c', 'user.email=desk@test.invalid', '-c', 'commit.gpgsign=false'].concat(args),
    { cwd: cwd, encoding: 'utf8', env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
  return { status: r.status, out: String(r.stdout || '').trim() };
}
function gitWorld(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const origin = path.join(dir, 'origin.git'); const checkout = path.join(dir, 'checkout'); const other = path.join(dir, 'other');
  git(dir, ['init', '-q', '--bare', origin]);
  git(dir, ['clone', '-q', origin, other]);
  fs.writeFileSync(path.join(other, 'a.txt'), 'one\n');
  git(other, ['add', 'a.txt']); git(other, ['commit', '-q', '-m', 'first']); git(other, ['push', '-q', 'origin', 'HEAD:master']);
  git(dir, ['clone', '-q', origin, checkout]);
  // Its own identity, for whatever commits in it (a rebase).
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
  // A node family's, an app's (spirit/app/<name>/api.js, where deskClient is since goal/G43.27), or a server's.
  const tried = [path.join(RUN, 'spirit', f, 'api.js'), path.join(RUN, 'spirit', 'app', f, 'api.js'), path.join(RUN, require(path.join(RUN, 'spirit', 'spirit.js')).familyPath(f))];
  for (const file of tried) if (fs.existsSync(file)) return { family: f, interface: fs.readFileSync(file, 'utf8') };
  return { ok: false, code: 'no-interface' };
}
function entriesOf(got) { return Array.isArray(got) ? got : got && Array.isArray(got.rows) ? got.rows : got ? [got] : []; }
// ANDY'S NODE AS THE DESK SEES IT, on its one door (POST /api/spirit {verb, ...}): his pages' publishes
// (event.publish, the row as app) into pages; the event stream peerPost reads its answers on (event.subscribe); a
// family's interface (api {family}); each post to a deskClient's listener (peer.post) into posts as {to, json},
// every row of it into sent as {to, row}.
// A job (job.create {command, args}) is started for real, as a node starts it, and kept in jobs with its exit.
function pretendNode() {
  const pages = []; const posts = []; const sent = []; const streams = []; const deaf = new Set(); const jobs = [];
  // THE NODE'S GRANT TABLE (goal/G43.3), as auth.search answers it: every test agent holds the desk unless a case says otherwise.
  const grants = [CW, WSL, UBI, KEYED, OUT].map(function (a) { return { key: a.key, path: 'desk', name: a.label }; });
  const server = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      // ONE ENVELOPE (goal/G41.15): { call, args } at the door, read here as the verb and its arguments.
      if (b && typeof b.call === 'string') b = Object.assign({}, b.args || {}, { verb: b.call });
      if (b.verb === 'event.subscribe') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (b.verb === 'event.publish') { if (b.app) pages.push(b.app); res.end('{"ok":true}'); return; }
      if (b.verb === 'auth.search') { res.end(JSON.stringify({ ok: true, more: false, items: grants.map(function (g) { return { key: g.key + '\n' + g.path, label: JSON.stringify(g) }; }) })); return; }
      if (b.verb === 'job.create' && typeof b.command === 'string') {
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
      const sl = body.deskClient && body.deskClient.listener;
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
  // A grant given or revoked, as the node publishes it: news of its permanent job spirit.auth (goal/G43.20, spirit/server.js).
  const grantEvent = function (row, gone) {
    const job = { id: 'spirit.auth', kind: 'permanent', status: 'running', data: { table: 'grant', row: row, gone: gone === true } };
    streams.forEach(function (st) { try { st.write('event: job-updated\ndata: ' + JSON.stringify(job) + '\n\n'); } catch (e) { /* gone */ } });
  };
  return { server: server, pages: pages, posts: posts, sent: sent, deaf: deaf, jobs: jobs, grants: grants, grantEvent: grantEvent };
}

const GOAL = { id: 'goal/G100', title: 'Desk test' };
const ITEMS = ['goal/G100.1', 'goal/G100.2', 'goal/G100.3', 'goal/G100.4', 'goal/G100.5', 'goal/G100.6'];
const OTHER = { id: 'goal/G200', title: 'Another goal' };
const OTHER_ITEMS = ['goal/G200.1', 'goal/G200.2', 'goal/G200.3', 'goal/G200.4', 'goal/G200.5', 'goal/G200.6'];


// ── THE WORLD, SHARED BY THE TESTS IN ORDER ─────────────────────────────────────────────────────────────────────────────
// What one test makes and a later one reads; a test whose world is missing says so and fails.
const W = { pullKids: [] };
const PULL = { id: 'goal/G300', title: 'Pull test' };
const PULL_ITEMS = ['goal/G300.1', 'goal/G300.2', 'goal/G300.3'];
const pullSession = { goal: PULL, items: PULL_ITEMS.map(function (id) { return { id: id, title: 'Pull ' + id, blocks: [PULL.id] }; }) };

const call = function (verb, args, caller) { const q = {}; q[verb] = args; return W.client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
const filesOf = async function (id) { return ((await call('item.files', { id: id }, ANDY)).files) || []; };
const why = function (r) { return r && r.extra && r.extra.why ? String(r.extra.why) : ''; };
// The to list his line was published with, as his pages heard it.
const toOf = async function (text) {
  for (let i = 0; i < 40; i++) {
    const hit = W.node.pages.filter(function (o) { return o && o.table === 'chat' && o.row && o.row.text === text; })[0];
    if (hit) return { heard: true, to: Array.isArray(hit.to) ? hit.to : null };
    await sleep(100);
  }
  return { heard: false, to: null };
};

// ── THE POSITION (goal/G41.11, 0ebb4abd; Andy: "(if it restarts or similar) it calls the "subscribe/(connect)"
// verb do desk, (re-use that verb) with the position number as argument") ─────────────────────────────────────────
const rowsTo = function (key, from) { return W.node.sent.slice(from).filter(function (x) { return x.to === key; }).map(function (x) { return x.row; }); };
const isEnd = function (r) { return !!r && r.full === true && r.end === true; };
const pushEnded = function (key, from) { return rowsTo(key, from).some(isEnd); };
const waitEnd = async function (key, from, ms) { for (let i = 0; i < (ms || 15000) / 100; i++) { if (pushEnded(key, from)) return true; await sleep(100); } return false; };
const memberIds = [GOAL.id].concat(ITEMS);
const wholeOf = function (rows) { return rows.filter(function (r) { return r && r.verb === 'goal.whole' && r.item; }); };
const sideOf = function (rows) { return rows.filter(function (r) { return r && typeof r.table === 'string' && !r.verb; }); };
const lastOf = function (rows) { return rows[rows.length - 1]; };

// ── AUTO PULL (goal/G41.22, box v22; Andy: "when the desk gets a claim red/build done. it pulls it's repo
// automatically"; agreed: "it never pulls a checkout with edits of its own, or while a test run is going on in it:
// then it pulls nothing and says so under the item.") ──────────────────────────────────────────────────────────────
// Each case is a desk of its own, on a scratch git world of its own: it runs from inside that world's checkout, which
// it finds by itself as the checkout it sits in (startDesk, its world). The pretend node runs the
// jobs it is asked to, as a node does, so a pull made as a job runs as one made in the desk does.
// A DESK IN A SCRATCH GIT WORLD RUNS FROM INSIDE IT (goal/G43.28, box line 9; Andy: "desk fucking well knows which repo
// it sits in"): world given, the run tree is copied into its checkout, so the desk finds that checkout by walking up to
// its .git, as it finds Andy's; it is handed no repo. Without a world it runs from the scratch copy, no checkout.
const startDesk = async function (name, values, sessions, world) {
  if (!W.node || !W.SERVER) return null;
  const root = path.join(W.scratch, name);
  const server = world ? runCopy(path.join(world.checkout, 'spirit', 'run'), W.node.server.address().port) : W.SERVER;
  const st = path.join(root, 'state');
  seed(st, sessions || [pullSession]);
  const p = appClient.pipePathFor(root, 'desk', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(p), { recursive: true });
  const c = appClient.createAppClient({ rootDir: root });
  c.register('desk', p);
  W.pullKids.push(spawn(process.execPath, [server, JSON.stringify(values), '--pipe', p, '--state', st], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: name + '-job' }) }));
  let on = false;
  for (let i = 0; i < 60 && !on; i++) { await sleep(150); try { const r = await c.ask('api'); on = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!on) return null;
  return function (verb, args, caller) { const q = {}; q[verb] = args; return c.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
};
// A code item with his Go and its file listed, held by the agent: a claim of it is taken.
const ready = async function (ask, id, agent) {
  await ask('press', { id: PULL.id, what: 'end-design' }, ANDY);
  await ask('press', { id: id, what: 'code' }, ANDY);
  await ask('item.take', { id: id }, agent);
  await ask('item.files.add', { id: id, path: 'spirit/run/pulled-' + id.replace(/\W/g, '') + '.js' }, agent);
  return ask('press', { id: id, what: 'go' }, ANDY);
};
const profiles = async function (ask) {
  await ask('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true }, ANDY);
  await ask('profile.set', { agent: UBI.key, name: 'Ubuntu Claude', nick: 'ubi', included: true, cap: true }, ANDY);
};
// Every job the node was asked to run has exited (the goal file's share fetches in the same checkout).
const jobsDone = async function () { for (let i = 0; i < 150 && W.node.jobs.some(function (j) { return j.exit === null; }); i++) await sleep(100); };
const deskLines = async function (ask, id) { return (((await ask('item.chat', { id: id }, ANDY)).chat) || []).filter(function (l) { return l && l.by === 'desk'; }); };
const waitFor = async function (cond, ms) { for (let i = 0; i < ms / 100; i++) { if (await cond()) return true; await sleep(100); } return !!(await cond()); };

test.run('a desk server starts for this suite', 0.2, async function () {
  // A ONE-LETTER NAME: each desk of the cases below listens on a unix socket under <scratch>/<its name>/, and a socket's
  // path is short (108 bytes); under this suite's route a longer name put desk-grants' socket past it.
  const scratch = W.scratch = ownTemp('d');
  const state = path.join(scratch, 'state');
  seed(state, [
    { goal: OTHER, items: OTHER_ITEMS.map(function (id) { return { id: id, title: 'Other ' + id, blocks: [OTHER.id] }; }) },
    { goal: GOAL, items: ITEMS.map(function (id) { return { id: id, title: 'Item ' + id, blocks: [GOAL.id] }; }) },
  ]);
  // AN OLD DESK DATABASE'S RULE TABLES (goal/G47.4, box v36: "The old rule tables in an existing desk database: dropped by
  // the node at start"): the three, each with a row, as a desk made before rules went out wrote them.
  plantOldRules(state);
  // THE PIPE BY appClient.pipePathFor ALONE (Andy, 2026-10-27: "don't use unix sockets in tests, use
  // appClient.pipePathFor"): a \\.\pipe\ name on Windows, the door's own place under the scratch folder elsewhere.
  const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  W.client = appClient.createAppClient({ rootDir: scratch });
  W.client.register('desk', pipe);
  const node = W.node = pretendNode();
  await new Promise(function (r) { node.server.listen(0, '127.0.0.1', r); });
  W.SERVER = runCopy(path.join(scratch, 'run'), node.server.address().port);
  W.kid = spawn(process.execPath, [W.SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job' }),
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await W.client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) return false;
  W.up = true;
  await call('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true }, ANDY);
  await call('profile.set', { agent: WSL.key, name: 'WSL Claude', nick: 'wsl', included: true, cap: false }, ANDY);
  await call('profile.set', { agent: UBI.key, name: 'Ubuntu Claude', nick: 'ubi', included: true, cap: true }, ANDY);
  await call('profile.set', { agent: OUT.key, name: 'Out', nick: 'out', included: false, cap: true }, ANDY);
  await call('agent.state', { word: 'listening' }, CW);
  await call('agent.state', { word: 'listening' }, WSL);
  await call('agent.state', { word: 'listening' }, KEYED);
  await call('subscribe', { family: 'deskClient' }, CW);
  return true;
}, test.limit.slow);

// bundles: item.files.add takes a list of paths (Desk only)
test.run('adding a list of paths to an item lands every path of the list on the caller\'s file list', 0.2, async function () {
  if (!W.up) return false;
  await call('item.take', { id: 'goal/G100.1' }, CW);
  const paths = ['spirit/run/a.js', 'spirit/run/b.js', 'spirit/run/c.js'];
  const bundle = await call('item.files.add', { id: 'goal/G100.1', paths: JSON.stringify(paths) }, CW);
  const listed = (await filesOf('goal/G100.1')).map(function (f) { return f.path; });
  return (bundle.ok !== false && paths.every(function (p) { return listed.indexOf(p) !== -1; })) ||
    false;
}, test.limit.quick);

// RULES GO OUT OF DESK (goal/G47.4, box v36; Andy: "Next we kill rules from desk. nobody observes them", "are we ready to
// strip rules out of desk now?", "go!"): "The rules list on each goal and item goes", "The part that works out which rules
// apply in which phase goes", "The three rule tables in the desk database (the rules, their drafts, their chat) are no
// longer made", and the old ones are "dropped by the node at start". This world's desk.db had the three planted before it
// started (plantOldRules, above).
const tablesOf = function () {
  const db = new DatabaseSync(path.join(W.scratch, 'state', 'desk.db'), { readOnly: true });
  try { return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; }); } finally { db.close(); }
};
test.run('once the desk runs, its database has no rules, rule_drafts or rule_chat table, though an old one had them', 0.2, function () {
  if (!W.up) return false;
  const t = tablesOf();
  return (t.indexOf('items') !== -1 && ['rules', 'rule_drafts', 'rule_chat'].every(function (n) { return t.indexOf(n) === -1; })) || false;
}, test.limit.quick);
const itemOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); let it = r.item; try { if (typeof it === 'string') it = JSON.parse(it); } catch (e) { it = null; } return it; };
test.run('an item answers no rules and no phase rules', 0.2, async function () {
  if (!W.up) return false;
  const it = await itemOf(ITEMS[0]);
  return (!!it && !('rules' in it) && !('phaseRules' in it)) || false;
}, test.limit.quick);
// THE LISTENER AND THE PUBLISHER'S VERBS, AUTO-VERBS OF EVERY appServer (goal/G47.5; Andy: "the streamListener must be an
// auto-verb of spirit/appServer.js!", "they're both auto-verbs. MUST BE.", "PLEASE call the damn thing jus \"listener\", we
// won't start using camelCase on intrinsic verbs"): the desk, a publisher only, names listener, subscribe, unsubscribe and
// remote in its api tree in server mode, and no streamListener.
test.run('the desk names listener, subscribe, unsubscribe and remote in its api tree in server mode, and no streamListener', 0.2, async function () {
  if (!W.up) return false;
  let t = null; try { t = (await W.client.ask('api')).body; } catch (e) { t = null; }
  const desk = (t && t.desk) || {};
  return (['listener', 'subscribe', 'unsubscribe', 'remote'].every(function (v) { return v in desk; }) && !('streamListener' in desk)) || false;
}, test.limit.quick);
test.run('a goal answers no rules and no phase rules', 0.2, async function () {
  if (!W.up) return false;
  const g = await itemOf(GOAL.id);
  return (!!g && !('rules' in g) && !('phaseRules' in g)) || false;
}, test.limit.quick);

// bundles: a goal pushed whole reaches a subscribed client as bundles of rows
test.run('a goal pushed whole sends its seven rows several to a post, not one post a row', 0.2, async function () {
  if (!W.up) return false;
  const node = W.node;
  const before = node.posts.length;
  await call('press', { id: OTHER.id, what: 'make-current' }, ANDY);
  const wholeRows = function (p) {
    const rows = entriesOf(p.got).map(function (e) { return e && e.row ? e.row : e; });
    return rows.filter(function (r) { return r && r.verb === 'goal.whole' && r.item && String(r.item.id).indexOf(OTHER.id) === 0; }).length;
  };
  const mine = function () { return node.posts.slice(before).filter(function (p) { return p.to === CW.key; }); };
  for (let i = 0; i < 60; i++) { await sleep(100); if (mine().reduce(function (m, p) { return m + wholeRows(p); }, 0) >= OTHER_ITEMS.length + 1) break; }
  const pushed = W.pushed = mine();
  const most = pushed.reduce(function (m, p) { return Math.max(m, wholeRows(p)); }, 0);
  const total = pushed.reduce(function (m, p) { return m + wholeRows(p); }, 0);
  return (total >= OTHER_ITEMS.length + 1 && most > 1) || false;
}, test.limit.quick);
test.run('each post stays within one payload', 0.2, function () {
  if (!W.pushed) return false;
  return W.pushed.every(function (p) { return Buffer.byteLength(String(p.json), 'utf8') <= 16384; }) || false;
}, test.limit.quick);
test.run('the goal leaves design mode', 0.2, async function () {
  if (!W.up) return false;
  await call('press', { id: GOAL.id, what: 'make-current' }, ANDY);
  // Out of design, so his Go is offered: what refuses it below is the file list alone.
  const ended = await call('press', { id: GOAL.id, what: 'end-design' }, ANDY);
  return !!ended.change || false;
}, test.limit.quick);

// files known in design: a code item is not green with an empty file list
test.run('a code item with no file listed is not green', 0.2, async function () {
  if (!W.up) return false;
  await call('press', { id: 'goal/G100.2', what: 'code' }, ANDY);
  const bare = await facts('goal/G100.2');
  return (bare.code === true && bare.green === false) || false;
}, test.limit.quick);
test.run('his Go on a code item with no file listed is refused, the why naming its empty file list', 0.2, async function () {
  if (!W.up) return false;
  const goEmpty = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  return (goEmpty.ok === false && /file/i.test(why(goEmpty) + ' ' + String(goEmpty.error || ''))) || false;
}, test.limit.quick);
test.run('a code item with a file listed is green', 0.2, async function () {
  if (!W.up) return false;
  await call('item.take', { id: 'goal/G100.2' }, UBI);
  await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/early.js' }, UBI);
  const listedOne = await facts('goal/G100.2');
  return listedOne.green === true || false;
}, test.limit.quick);
test.run('his Go on a code item with a file listed is taken', 0.2, async function () {
  if (!W.up) return false;
  const goNow = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  return (!!goNow.change && goNow.ok !== false) || false;
}, test.limit.quick);
test.run('a file added after his Go is allowed', 0.2, async function () {
  if (!W.up) return false;
  const lateAdd = await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/late.js' }, UBI);
  const entries = await filesOf('goal/G100.2');
  W.early = entries.filter(function (f) { return f.path === 'spirit/run/early.js'; })[0] || {};
  W.late = entries.filter(function (f) { return f.path === 'spirit/run/late.js'; })[0] || null;
  return (!!lateAdd.change && !!W.late) || false;
}, test.limit.quick);
test.run('a file added after his Go is marked late on the item, and the file listed before Go is not', 0.2, function () {
  const late = W.late; const early = W.early || {};
  return (!!late && late.late === true && early.late !== true) || false;
}, test.limit.quick);

// addresses: all or a nick counts only when punctuation follows
test.run('"all agents seem busy" is addressed to nobody', 0.2, async function () {
  if (!W.up) return false;
  const plainAll = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'all agents seem busy' }, ANDY), 'all agents seem busy'));
  return (plainAll.heard && !(plainAll.to && plainAll.to.length)) || false;
}, test.limit.quick);
test.run('"wsl is here" is addressed to nobody', 0.2, async function () {
  if (!W.up) return false;
  const plainNick = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'wsl is here' }, ANDY), 'wsl is here'));
  return (plainNick.heard && !(plainNick.to && plainNick.to.length)) || false;
}, test.limit.quick);
test.run('a chat line starting "wsl," is addressed to wsl alone', 0.2, async function () {
  if (!W.up) return false;
  const commaNick = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'wsl, look here' }, ANDY), 'wsl, look here'));
  return (!!commaNick.to && commaNick.to.length === 1 && commaNick.to[0] === WSL.key) || false;
}, test.limit.quick);
test.run('a chat line starting "all:" is addressed to the included agents', 0.2, async function () {
  if (!W.up) return false;
  const allColon = await toOf((await call('chat.add', { id: 'goal/G100.3', text: 'all: your thoughts?' }, ANDY), 'all: your thoughts?'));
  const to = W.to = allColon.to || [];
  return (to.indexOf(CW.key) !== -1 && to.indexOf(WSL.key) !== -1) || false;
}, test.limit.quick);
test.run('a line addressed to all reaches an agent known by its profile alone and one known by its key alone', 0.2, function () {
  const to = W.to || [];
  return (to.indexOf(UBI.key) !== -1 && to.indexOf(KEYED.key) !== -1) || false;
}, test.limit.quick);
test.run('a line addressed to all never reaches an agent he excluded', 0.2, function () {
  if (!W.to) return false;
  return W.to.indexOf(OUT.key) === -1 || false;
}, test.limit.quick);

// auto-cap: a box write into red offers the cap to the agents with cap on
test.run('a box write too big for one answer has the desk name the room of one answer', 0.2, async function () {
  if (!W.up) return false;
  const tooBig = await call('box.write', { id: 'goal/G100.4', text: 'x'.repeat(20000), version: 0 }, ANDY);
  W.room = tooBig && tooBig.extra && Number(tooBig.extra.max) > 0 ? Number(tooBig.extra.max) : 0;
  return W.room > 0 || false;
}, test.limit.quick);
test.run('a box write below red offers nothing: an agent with cap off takes it plainly', 0.2, async function () {
  if (!(W.room > 0)) return false;
  const v0 = (await facts('goal/G100.4')).version || 0;
  const small = await call('box.write', { id: 'goal/G100.4', text: 'a short box', version: v0 }, ANDY);
  const takeSmall = await call('box.take', { id: 'goal/G100.4' }, WSL);
  return (!!small.change && !!takeSmall.change) || false;
}, test.limit.quick);
test.run('a box write to 80% of one answer lands', 0.2, async function () {
  if (!(W.room > 0)) return false;
  await call('box.release', { id: 'goal/G100.4' }, WSL);
  const v1 = (await facts('goal/G100.4')).version || 0;
  const red = 'y'.repeat(Math.ceil(W.room * 0.8));
  const big = await call('box.write', { id: 'goal/G100.4', text: red, version: v1 }, ANDY);
  return !!big.change || false;
}, test.limit.quick);
// goal/G47.1, Q16 (Andy, of the old box versions: "ALL OF THEM. KILL THEM. NOBODY READ THAT SHIT, THEY SHOULD NOT
// EXIST."): after two writes of goal/G100.4's box the table holds one row of it, the newest, carrying the version
// item.box answers.
test.run('after two box writes the desk keeps only the item\'s newest box, with the version it answers', 0.2, async function () {
  if (!(W.room > 0)) return false;
  const v = (await facts('goal/G100.4')).version || 0;
  const db = new DatabaseSync(path.join(W.scratch, 'state', 'desk.db'), { readOnly: true });
  let rows = [];
  try { rows = db.prepare('SELECT version FROM box WHERE goal = 100 AND item = 4').all(); } finally { db.close(); }
  return (v >= 2 && rows.length === 1 && Number(rows[0].version) === v) || false;
}, test.limit.quick);
test.run('after that box write an agent with cap off is refused the box, with the cap as the why', 0.2, async function () {
  if (!(W.room > 0)) return false;
  const offOff = await call('box.take', { id: 'goal/G100.4' }, WSL);
  return (offOff.ok === false && /cap/i.test(why(offOff))) || false;
}, test.limit.quick);
test.run('after that box write an agent with cap on takes the box, held for one write', 0.2, async function () {
  if (!(W.room > 0)) return false;
  const onTake = await call('box.take', { id: 'goal/G100.4' }, UBI);
  const held = await facts('goal/G100.4');
  return (!!onTake.change && held.boxTaken === UBI.label) || false;
}, test.limit.quick);

// the position: a subscribe without since bootstraps as before
const FRESH = { key: 'MCowBQYDK2VwAyEAdeskProductTestFRESHAAAAAAAAAAAAAAAAAAA=', label: 'fresh' };
test.run('a subscribe with no since brings the current goal\'s facts whole, the goal and each of its six items', 0.2, async function () {
  if (!W.up) return false;
  const f0 = W.node.sent.length;
  const plain = await call('subscribe', { family: 'deskClient' }, FRESH);
  W.plainEnded = await waitEnd(FRESH.key, f0);
  W.plainRows = rowsTo(FRESH.key, f0);
  const plainIds = wholeOf(W.plainRows).map(function (r) { return String(r.item.id); });
  return (plain.subscribed === true && W.plainEnded && memberIds.every(function (id) { return plainIds.indexOf(id) !== -1; })) ||
    false;
}, test.limit.quick);
test.run('a subscribe with no since brings no chat line, check or box, since it named no position to follow', 0.2, function () {
  if (!W.plainRows) return false;
  return (W.plainEnded && sideOf(W.plainRows).length === 0) || false;
}, test.limit.quick);
test.run('a subscribe with since 0 is the same as one with no since', 0.2, async function () {
  if (!W.up) return false;
  const zero = W.node.sent.length;
  await call('subscribe', { family: 'deskClient', since: 0 }, FRESH);
  await waitEnd(FRESH.key, zero);
  return (sideOf(rowsTo(FRESH.key, zero)).length === 0 && wholeOf(rowsTo(FRESH.key, zero)).length >= memberIds.length) || false;
}, test.limit.quick);

// NOT CHECKED: a catch-up from a desk change number (the one stream protocol of goal/G41.12: a push is the whole
// goal, then its end), and a subscriber kept after a failed delivery (Andy: "take the 3 seconds out, appServer.js
// calls peerPost in the most basic way": a delivery left unanswered drops its subscriber, which subscribes again).

// the position: every push ends with its end mark, { full: true, end: true }
test.run('the last entry of a push is its end mark, with full and end both true', 0.2, function () {
  if (!W.plainRows) return false;
  return isEnd(lastOf(W.plainRows)) || false;
}, test.limit.quick);
test.run('the end mark comes once per push', 0.2, function () {
  if (!W.plainRows) return false;
  return W.plainRows.filter(isEnd).length === 1 || false;
}, test.limit.quick);

// ── goal/G43.3, THE BOX (Andy: "desk cannot refuse the box to the user. agent updates will fail it the user takes the
// box, and desk will note so in the chat."). This replaces his G9.3 and G21.1 words on a hold. ───────────────────
// goal/G43.3: the desk never refuses him the box; an agent's update fails, and the chat says so
const factsB = async function (id) { const r = await W.askB('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
const failsAndSays = async function (id, agent) {
  const askB = W.askB;
  const lines0 = (await deskLines(askB, id)).length;
  const v = (await factsB(id)).version || 0;
  const before = (await askB('item.box', { id: id }, ANDY)).box;
  const up = await askB('box.write', { id: id, text: 'the agent\'s update', version: v }, agent);
  const after = (await askB('item.box', { id: id }, ANDY)).box;
  const failed = up.ok === false && up.code === 'taken' && after === before;
  const said = await waitFor(async function () { return (await deskLines(askB, id)).length > lines0; }, 3000);
  return { failed: failed, said: said };
};
test.run('a desk of its own starts for the box cases', 0.2, async function () {
  // The main desk's own subscriber is stopped here, as before: the cases below each run a desk of their own.
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  W.askB = await startDesk('desk-box', {});
  if (W.askB) await profiles(W.askB);
  return !!W.askB || false;
}, test.limit.slow);
test.run('while an agent holds the box his take is not refused, and the box is his', 0.2, async function () {
  if (!W.askB) return false;
  await W.askB('box.take', { id: 'goal/G300.1' }, CW);
  const overTake = await W.askB('box.take', { id: 'goal/G300.1' }, ANDY);
  return (!!overTake.change && (await factsB('goal/G300.1')).boxTaken === 'andy') || false;
}, test.limit.quick);
test.run('after his take over cw, the agent\'s update fails and the box stays his', 0.2, async function () {
  if (!W.askB) return false;
  W.faCw = await failsAndSays('goal/G300.1', CW);
  return W.faCw.failed || false;
}, test.limit.quick);
test.run('after his take over cw, the desk notes the failed update in the chat', 0.2, function () {
  if (!W.faCw) return false;
  return W.faCw.said || false;
}, test.limit.quick);
// The one-write hold of the cap (goal/G21.1) is an agent's hold too: "nobody else takes it meanwhile, Andy included" goes.
test.run('ubi holds the box under the one-write hold of the cap', 0.2, async function () {
  if (!W.askB) return false;
  const askB = W.askB;
  const tooBigB = await askB('box.write', { id: 'goal/G300.2', text: 'x'.repeat(20000), version: 0 }, ANDY);
  const roomB = tooBigB && tooBigB.extra ? Number(tooBigB.extra.max) || 0 : 0;
  const v2 = (await factsB('goal/G300.2')).version || 0;
  const bigB = await askB('box.write', { id: 'goal/G300.2', text: 'y'.repeat(Math.ceil(roomB * 0.8)), version: v2 }, ANDY);
  const heldB = await askB('box.take', { id: 'goal/G300.2' }, UBI);
  return (roomB > 0 && !!bigB.change && !!heldB.change && (await factsB('goal/G300.2')).boxTaken === UBI.label) || false;
}, test.limit.quick);
test.run('over an agent\'s one-write hold his take is not refused either', 0.2, async function () {
  if (!W.askB) return false;
  const overHold = await W.askB('box.take', { id: 'goal/G300.2' }, ANDY);
  return (!!overHold.change && (await factsB('goal/G300.2')).boxTaken === 'andy') || false;
}, test.limit.quick);
test.run('after his take over ubi\'s hold, the agent\'s update fails and the box stays his', 0.2, async function () {
  if (!W.askB) return false;
  W.faUbi = await failsAndSays('goal/G300.2', UBI);
  return W.faUbi.failed || false;
}, test.limit.quick);
test.run('after his take over ubi\'s hold, the desk notes the failed update in the chat', 0.2, function () {
  if (!W.faUbi) return false;
  return W.faUbi.said || false;
}, test.limit.quick);
test.run('his own write under his take lands', 0.2, async function () {
  if (!W.askB) return false;
  const v3 = (await factsB('goal/G300.1')).version || 0;
  const hisWrite = await W.askB('box.write', { id: 'goal/G300.1', text: 'his own text', version: v3 }, ANDY);
  return (!!hisWrite.change && (await W.askB('item.box', { id: 'goal/G300.1' }, ANDY)).box === 'his own text') || false;
}, test.limit.quick);

// ── goal/G43.3, THE PHASE WAKE (Andy: "when the red phase ends, the desk must summon/wake another agent to take the
// build phase, or the same agent that did the red phase, if that's the only one available", and "a red-claim or a
// code-done should automatically trigger a phase-wake for all agents, since there could be only 1."). What wakes a
// deskClient is a row of an item with an open phase, nobody holding it (deskClient.js, streamed). ─────────────────
// goal/G43.3: a red claim, and a code-done, wake every agent for the next phase
const factsW = async function (id) { const r = await W.askW('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
const opened = function (from, key, id, phase) {
  return W.node.sent.slice(from).some(function (x) { return x.to === key && x.row && x.row.item && x.row.item.id === id && x.row.item.phase === phase && !x.row.item.phaseWith; });
};
test.run('a desk of its own starts for the phase wake cases', 0.2, async function () {
  if (!W.scratch) return false;
  W.worldW = gitWorld(path.join(W.scratch, 'git-w'));
  W.askW = await startDesk('desk-wake', {}, undefined, W.worldW);
  if (W.askW) {
    await profiles(W.askW);
    await W.askW('subscribe', { family: 'deskClient' }, CW);
    await W.askW('subscribe', { family: 'deskClient' }, UBI);
  }
  return !!W.askW || false;
}, test.limit.slow);
test.run('ubi takes the red phase', 0.2, async function () {
  if (!W.askW) return false;
  await ready(W.askW, 'goal/G300.1', UBI);
  await jobsDone();
  const tookRed = await W.askW('phase.take', { id: 'goal/G300.1', phase: 'red' }, UBI);
  return !!tookRed.change || false;
}, test.limit.quick);
test.run('ubi\'s red claim is taken', 0.2, async function () {
  if (!W.askW) return false;
  const hW = W.worldW.push();
  W.fromR = W.node.sent.length;
  const redW = await W.askW('claim', { id: 'goal/G300.1', phase: 'red', commit: hW }, UBI);
  return !!redW.change || false;
}, test.limit.quick);
test.run('the red claim alone ends the red phase and opens the build, with nobody holding it', 0.2, async function () {
  if (!W.askW) return false;
  const fW = await factsW('goal/G300.1');
  return (fW.phase === 'build' && !fW.phaseWith) || false;
}, test.limit.quick);
test.run('the row that opens the build reaches every subscribed agent, the red\'s author included', 0.2, async function () {
  if (!W.askW || W.fromR === undefined) return false;
  const wokeCW = await waitFor(function () { return opened(W.fromR, CW.key, 'goal/G300.1', 'build'); }, 5000);
  const wokeUBI = await waitFor(function () { return opened(W.fromR, UBI.key, 'goal/G300.1', 'build'); }, 2000);
  return (wokeCW && wokeUBI) || false;
}, test.limit.quick);
test.run('with another agent here, the red\'s author does not take the build', 0.2, async function () {
  if (!W.askW) return false;
  await W.askW('agent.state', { word: 'listening' }, CW);
  const redAuthor = await W.askW('phase.take', { id: 'goal/G300.1', phase: 'build' }, UBI);
  return redAuthor.ok === false || false;
}, test.limit.quick);
test.run('the other agent takes the build', 0.2, async function () {
  if (!W.askW) return false;
  const tookBuild = await W.askW('phase.take', { id: 'goal/G300.1', phase: 'build' }, CW);
  return !!tookBuild.change || false;
}, test.limit.quick);
test.run('cw\'s code-done is taken', 0.2, async function () {
  if (!W.askW) return false;
  const hB = W.worldW.push();
  W.fromB = W.node.sent.length;
  const doneW = await W.askW('claim', { id: 'goal/G300.1', phase: 'build', commit: hB }, CW);
  return !!doneW.change || false;
}, test.limit.quick);
test.run('the code-done alone opens the verify, nobody holding it', 0.2, async function () {
  if (!W.askW) return false;
  const fV = await factsW('goal/G300.1');
  return (fV.phase === 'verify' && !fV.phaseWith) || false;
}, test.limit.quick);
test.run('the row that opens the verify reaches every subscribed agent', 0.2, async function () {
  if (!W.askW || W.fromB === undefined) return false;
  const wokeCW2 = await waitFor(function () { return opened(W.fromB, CW.key, 'goal/G300.1', 'verify'); }, 5000);
  const wokeUBI2 = await waitFor(function () { return opened(W.fromB, UBI.key, 'goal/G300.1', 'verify'); }, 2000);
  return (wokeCW2 && wokeUBI2) || false;
}, test.limit.quick);

// goal/G43.3: alone, the agent that wrote the red takes the build itself
test.run('a desk of its own starts for an agent alone', 0.2, async function () {
  if (!W.scratch) return false;
  W.worldL = gitWorld(path.join(W.scratch, 'git-l'));
  W.askL = await startDesk('desk-alone', {}, undefined, W.worldL);
  return !!W.askL || false;
}, test.limit.slow);
test.run('the only agent here claims the red and takes the build, with no press of his', 0.2, async function () {
  const askL = W.askL;
  if (!askL) return false;
  await profiles(askL);
  await ready(askL, 'goal/G300.1', CW);
  await jobsDone();
  await askL('phase.take', { id: 'goal/G300.1', phase: 'red' }, CW);
  const redL = await askL('claim', { id: 'goal/G300.1', phase: 'red', commit: W.worldL.push() }, CW);
  const tookL = await askL('phase.take', { id: 'goal/G300.1', phase: 'build' }, CW);
  return (!!redL.change && !!tookL.change) || false;
}, test.limit.quick);

// ── goal/G43.3, THE LIST'S SEARCH (Andy: "reduce the number of fields that a front page ("list-tab") search returns for
// every returned rows, so MORE rows fit into a search result. the search needs only those fields of a row that it
// actually displays."; "when i open desk, i want to see immediately, the current goal, with all open items, or as many
// as fit into the first search."; "the search filter [include closed] doesn't mean "exclude open ones"!!!!") ─────
// goal/G43.3: items.search answers a row with what the List draws, so more rows fit
const LIST_GOAL = { id: 'goal/G400', title: 'The list' };
const LIST_ITEMS = Array.from({ length: 25 }, function (x, i) { return 'goal/G400.' + (i + 1); });
// What the List's cells, its presses and its filters read (spirit/app/desk/element/desk/desk.js deskRowCells, deskRowPresses, deskRowShown),
// and nothing else.
const LIST_FIELDS = ['id', 'goal', 'title', 'status', 'statusTone', 'buttons', 'asks', 'alert', 'with', 'names', 'blocking', 'blocked'];
// THE GOAL'S ROW DRAWS MORE (found at the verify of f181acfb): the page reads the agent bubbles, the working blink, the
// waiting count and the design state from it (spirit/app/desk/element/desk/desk.js deskBubblesHtml, deskWorkingAgents, deskWaitingOnAndy,
// deskDesignOn), and at open this answer is all it has.
const GOAL_FIELDS = ['live', 'agents', 'working', 'waiting', 'design', 'excluded'];
const search = async function (ask, o) { const r = await ask('items.search', Object.assign({ text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, o || {}), ANDY); return { more: r.more === true, rows: (r.items || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return {}; } }), keys: (r.items || []).map(function (x) { return x.key; }) }; };
test.run('a desk of its own starts for the search cases', 0.2, async function () {
  W.askS = await startDesk('desk-list', {}, [{ goal: LIST_GOAL, items: LIST_ITEMS.map(function (id) { return { id: id, title: 'Item ' + id, blocks: [LIST_GOAL.id] }; }) }]);
  if (W.askS) await profiles(W.askS);
  return !!W.askS || false;
}, test.limit.slow);
test.run('a search row holds only what the List draws, presses and filters on', 0.2, async function () {
  if (!W.askS) return false;
  const first = W.first = await search(W.askS);
  const extra = {};
  first.rows.forEach(function (row) { Object.keys(row).forEach(function (k) { if (LIST_FIELDS.indexOf(k) === -1 && !(row.goal === '' && GOAL_FIELDS.indexOf(k) !== -1)) extra[k] = true; }); });
  return (first.rows.length > 0 && !Object.keys(extra).length) || false;
}, test.limit.quick);
test.run('the first search holds the current goal and all its 25 open items', 0.2, function () {
  const first = W.first;
  if (!first) return false;
  const openShown = LIST_ITEMS.filter(function (id) { return first.keys.indexOf(id) !== -1; });
  return (first.keys.indexOf(LIST_GOAL.id) !== -1 && openShown.length === LIST_ITEMS.length && !first.more) || false;
}, test.limit.quick);
test.run('the goal\'s row still names the agents here and who is working: the page draws its bubbles from it', 0.2, async function () {
  if (!W.askS) return false;
  await W.askS('agent.state', { word: 'working' }, CW);
  await W.askS('press', { id: LIST_GOAL.id, what: 'start-design' }, ANDY);
  const goalRow = W.goalRow = (await search(W.askS)).rows.filter(function (r) { return r.id === LIST_GOAL.id; })[0] || {};
  W.whole = JSON.parse((await W.askS('item.get', { id: LIST_GOAL.id }, ANDY)).item || '{}');
  return (Array.isArray(goalRow.live) && goalRow.live.indexOf(CW.label) !== -1 && Array.isArray(goalRow.working) && goalRow.working.indexOf(CW.label) !== -1) || false;
}, test.limit.quick);
test.run('the goal\'s row also names the agents the desk knows', 0.2, function () {
  const goalRow = W.goalRow || {};
  return (!!goalRow.agents && Object.keys(goalRow.agents).length > 0) || false;
}, test.limit.quick);
test.run('the goal\'s row also carries the design state, as item.get says it', 0.2, function () {
  if (!W.goalRow || !W.whole) return false;
  return W.goalRow.design === W.whole.design || false;
}, test.limit.quick);
// His ruling of goal/G41.28 stands on the server: a search covers the whole row, and the chat.
test.run('the server still searches what the row no longer carries: a chat word finds its item first', 0.2, async function () {
  if (!W.askS) return false;
  await W.askS('chat.add', { id: 'goal/G400.20', text: 'zebrafinch' }, ANDY);
  const byChat = await search(W.askS, { text: 'zebrafinch' });
  return byChat.keys[0] === 'goal/G400.20' || false;
}, test.limit.quick);

// goal/G43.3: Andy: "file list should not show duplicates". A path two agents added is one row.
test.run('two agents add one path: it is one row, and the other file stays', 0.2, async function () {
  const askS = W.askS;
  if (!askS) return false;
  await askS('item.take', { id: 'goal/G400.1' }, CW);
  await askS('item.files.add', { id: 'goal/G400.1', path: 'spirit/run/twice.js' }, CW);
  await askS('item.take', { id: 'goal/G400.1' }, UBI);
  await askS('item.files.add', { id: 'goal/G400.1', path: 'spirit/run/twice.js' }, UBI);
  await askS('item.files.add', { id: 'goal/G400.1', path: 'spirit/run/once.js' }, UBI);
  const twice = (((await askS('item.files', { id: 'goal/G400.1' }, ANDY)).files) || []).map(function (e) { return e.path; });
  return (twice.filter(function (p) { return p === 'spirit/run/twice.js'; }).length === 1 && twice.indexOf('spirit/run/once.js') !== -1) || false;
}, test.limit.quick);


// ── goal/G43.3, THE AGENT BUBBLES FOLLOW THE GRANTS. Andy: "the real thing would be: the desk listens to the grants and
// adds/removes thos bubbles accordingly", and "if the ID has grants to desk, desk should list it as one of it's agents, it
// keeps all agent rows in its db, to preserve label and nick, but without grant, no matter how small, there's no point
// showing an agent bubble." The page draws its bubbles from the goal row's agents and live. ─────────────────────
// goal/G43.3: a bubble for each key with a grant to desk, and for no other
const NOBODY = { key: 'MCowBQYDK2VwAyEAdeskProductTestNOGRANTAAAAAAAAAAAAAAAAA=', label: 'no-grant' };
const CLIENT_ONLY = { key: 'MCowBQYDK2VwAyEAdeskProductTestCLIENTAAAAAAAAAAAAAAAAA=', label: 'client-only' };
const goalG = async function () { const r = await W.askG('item.get', { id: PULL.id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
const bubbled = function (f) {
  const byKey = Object.keys(f.agents || {}).map(function (l) { return f.agents[l]; });
  return { keys: byKey, labels: Object.keys(f.agents || {}).concat(f.live || []) };
};
const has = function (f, a) { return bubbled(f).keys.indexOf(a.key) !== -1; };
const shows = function (f, a) { return bubbled(f).labels.indexOf(a.label) !== -1; };
const profileRow = async function (key) { const r = await W.askG('agents.search', { text: '' }, ANDY); return (r.items || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return {}; } }).filter(function (x) { return x.key === key; })[0] || null; };
test.run('a desk of its own starts for the bubble cases', 0.2, async function () {
  if (!W.node) return false;
  const node = W.node;
  W.heldGrants = node.grants.splice(0, node.grants.length);
  node.grants.push({ key: CW.key, path: 'desk', name: CW.label }, { key: UBI.key, path: 'desk.item.get', name: UBI.label }, { key: CLIENT_ONLY.key, path: 'deskClient.listener', name: CLIENT_ONLY.label }, { key: OUT.key, path: 'desk.item.get', name: 'never written' });
  W.askG = await startDesk('desk-grants', {});
  if (W.askG) {
    await profiles(W.askG);
    await W.askG('profile.set', { agent: NOBODY.key, name: 'No Grant', nick: 'nog', included: true, cap: true }, ANDY);
    for (const a of [CW, UBI, NOBODY, CLIENT_ONLY]) await W.askG('agent.state', { word: 'listening' }, a);
  }
  return !!W.askG || false;
}, test.limit.slow);
test.run('at start a key holding the whole desk has a bubble, and so does a key holding one small desk verb', 0.2, async function () {
  if (!W.askG) return false;
  const settled = await waitFor(async function () { return has(await goalG(), CW); }, 5000);
  const fg = W.fg0 = await goalG();
  return (settled && has(fg, CW) && has(fg, UBI)) || false;
}, test.limit.quick);
test.run('a key with a grant that has never written to this desk has one too', 0.2, function () {
  const fg = W.fg0;
  if (!fg) return false;
  return has(fg, OUT) || false;
}, test.limit.quick);
test.run('a key that has written, with a profile and no grant, has no bubble', 0.2, function () {
  const fg = W.fg0;
  if (!fg) return false;
  return (!has(fg, NOBODY) && !shows(fg, NOBODY)) || false;
}, test.limit.quick);
test.run('a key with a grant on deskClient alone has no bubble, since that is no grant to desk', 0.2, function () {
  const fg = W.fg0;
  if (!fg) return false;
  return (!has(fg, CLIENT_ONLY) && !shows(fg, CLIENT_ONLY)) || false;
}, test.limit.quick);
test.run('a grant given while the desk runs brings the bubble, with nothing else asked', 0.2, async function () {
  if (!W.askG) return false;
  W.node.grants.push({ key: NOBODY.key, path: 'desk.item.get', name: NOBODY.label });
  W.node.grantEvent({ key: NOBODY.key, path: 'desk.item.get', label: NOBODY.label });
  const given = await waitFor(async function () { return has(await goalG(), NOBODY); }, 5000);
  return given || false;
}, test.limit.quick);
test.run('when a key\'s last grant is revoked its bubble goes', 0.2, async function () {
  if (!W.askG) return false;
  W.node.grants.splice(W.node.grants.findIndex(function (g) { return g.key === NOBODY.key; }), 1);
  W.node.grantEvent({ key: NOBODY.key, path: 'desk.item.get' }, true);
  const revoked = await waitFor(async function () { const f = await goalG(); return !has(f, NOBODY) && !shows(f, NOBODY); }, 5000);
  return revoked || false;
}, test.limit.quick);
test.run('a key whose last grant is revoked keeps its row in the desk, its profile with it', 0.2, async function () {
  if (!W.askG) return false;
  const kept = await profileRow(NOBODY.key);
  return (!!kept && kept.name === 'No Grant') || false;
}, test.limit.quick);
test.run('when one of a key\'s two grants is revoked its bubble stays', 0.2, async function () {
  if (!W.askG) return false;
  const node = W.node;
  node.grants.push({ key: UBI.key, path: 'desk.chat.add', name: UBI.label });
  node.grantEvent({ key: UBI.key, path: 'desk.chat.add', label: UBI.label });
  node.grants.splice(node.grants.findIndex(function (g) { return g.key === UBI.key && g.path === 'desk.item.get'; }), 1);
  node.grantEvent({ key: UBI.key, path: 'desk.item.get' }, true);
  await sleep(800);
  return has(await goalG(), UBI) || false;
}, test.limit.slow);

// goal/G43.3: [include closed] adds the closed rows, and the open ones stay in the first answer
const MIX_GOAL = { id: 'goal/G500', title: 'Closed first' };
const MIX_ITEMS = Array.from({ length: 45 }, function (x, i) { return 'goal/G500.' + (i + 1); });
const CLOSED = MIX_ITEMS.slice(0, 40); const OPEN = MIX_ITEMS.slice(40);
const searchM = async function (o) { const r = await W.askM('items.search', Object.assign({ text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, o), ANDY); return (r.items || []).map(function (x) { return x.key; }); };
test.run('a desk of its own starts for the include closed filter', 0.2, async function () {
  // The grants of the bubbles' case put back, as they were before it.
  if (W.node && W.heldGrants) { W.node.grants.splice(0, W.node.grants.length); W.heldGrants.forEach(function (g) { W.node.grants.push(g); }); }
  W.askM = await startDesk('desk-mixed', {}, [{ goal: MIX_GOAL, items: MIX_ITEMS.map(function (id) { return { id: id, title: 'Item ' + id, blocks: [MIX_GOAL.id] }; }) }]);
  return !!W.askM || false;
}, test.limit.slow);
test.run('with the 40 oldest items closed, a search without the filter shows only the 5 open ones', 0.2, async function () {
  if (!W.askM) return false;
  await W.askM('press', { id: MIX_GOAL.id, what: 'end-design' }, ANDY);
  for (const id of CLOSED) await W.askM('press', { id: id, what: 'close' }, ANDY);
  const without = await searchM({ includeClosed: false });
  return (without.filter(function (k) { return CLOSED.indexOf(k) !== -1; }).length === 0 && OPEN.every(function (k) { return without.indexOf(k) !== -1; })) || false;
}, test.limit.slow);
test.run('with the include closed filter every open item is still in the answer', 0.2, async function () {
  if (!W.askM) return false;
  const withC = W.withC = await searchM({ includeClosed: true });
  const missing = OPEN.filter(function (k) { return withC.indexOf(k) === -1; });
  return !missing.length || false;
}, test.limit.quick);
test.run('with the include closed filter the open items come before the closed ones, and the closed ones show', 0.2, function () {
  const withC = W.withC;
  if (!withC) return false;
  const firstClosed = withC.findIndex(function (k) { return CLOSED.indexOf(k) !== -1; });
  return (firstClosed !== -1 && OPEN.every(function (k) { const at = withC.indexOf(k); return at !== -1 && at < firstClosed; })) || false;
}, test.limit.quick);

// auto pull: a red claim or a build claim taken, the desk pulls its own checkout
test.run('a desk of its own starts on a scratch checkout of a scratch origin', 0.2, async function () {
  if (!W.scratch) return false;
  const worldA = W.worldA = gitWorld(path.join(W.scratch, 'git-a'));
  W.askA = await startDesk('desk-a', {}, undefined, worldA);
  return (!!W.askA && !!worldA.head()) || false;
}, test.limit.slow);
test.run('a commit lands on origin, and cw\'s red claim is taken', 0.2, async function () {
  if (!W.askA) return false;
  await profiles(W.askA);
  await ready(W.askA, 'goal/G300.1', CW);
  await jobsDone();
  const h1 = W.h1 = W.worldA.push();
  const redA = await W.askA('claim', { id: 'goal/G300.1', phase: 'red', commit: h1 }, CW);
  return (!!h1 && !!redA.change) || false;
}, test.limit.quick);
test.run('once the red claim is taken the desk\'s checkout pulls, and holds the commit pushed onto origin since', 0.2, async function () {
  if (!W.askA) return false;
  const pulledRed = await waitFor(function () { return W.worldA.holds(W.h1); }, 15000);
  return pulledRed || false;
}, test.limit.quick);
test.run('another commit lands on origin, and cw\'s build claim is taken', 0.2, async function () {
  if (!W.askA) return false;
  await jobsDone();
  const h2 = W.h2 = W.worldA.push();
  const buildA = await W.askA('claim', { id: 'goal/G300.1', phase: 'build', commit: h2 }, CW);
  return (!!h2 && !!buildA.change) || false;
}, test.limit.quick);
test.run('once the build claim is taken the desk\'s checkout pulls again', 0.2, async function () {
  if (!W.askA) return false;
  const pulledBuild = await waitFor(function () { return W.worldA.holds(W.h2); }, 15000);
  return pulledBuild || false;
}, test.limit.quick);

// auto pull: never over edits of its own: it pulls nothing and says so under the item
test.run('a commit lands on origin, the desk\'s checkout holds an edit, and ubi\'s red claim is taken', 0.2, async function () {
  if (!W.askA) return false;
  await jobsDone();
  W.edited = path.join(W.worldA.checkout, 'a.txt');
  fs.writeFileSync(W.edited, 'an edit of its own, not committed\n');
  W.headE = W.worldA.head();
  const h3 = W.h3 = W.worldA.push();
  W.linesE = (await deskLines(W.askA, 'goal/G300.2')).length;
  await ready(W.askA, 'goal/G300.2', UBI);
  const redE = await W.askA('claim', { id: 'goal/G300.2', phase: 'red', commit: h3 }, UBI);
  return (!!h3 && !!redE.change) || false;
}, test.limit.quick);
test.run('a claim on a checkout with an uncommitted edit pulls nothing and keeps the edit, and the desk says so under the item', 0.2, async function () {
  if (!W.askA || W.linesE === undefined) return false;
  const worldA = W.worldA;
  const saidE = await waitFor(async function () { return (await deskLines(W.askA, 'goal/G300.2')).length > W.linesE; }, 15000);
  await sleep(1000);
  const keptE = fs.readFileSync(W.edited, 'utf8') === 'an edit of its own, not committed\n';
  return (saidE && !worldA.holds(W.h3) && worldA.head() === W.headE && keptE) ||
    false;
}, test.limit.slow);

// A DESK OWNER BY HIS MARK (goal/G47.5; Andy: "desk has a unique way of gating access, and it sees me as an agent, with
// bubble and all. all it it would need is: the bubble contains a checkmark for desk-owner on loopback", "NO NEW VERB, just
// the checkmark in the agent-bubble that can only be set via loopback"; Q7, owner "as one more yes/no on profile.set, beside
// included and cap": "yes"). His WSL node reaches this desk as a peer, andy-wsl; marked owner in its profile, its calls are
// his: a line by andy with no take, his presses accepted. The mark is set by the loopback owner alone.
const ANDY_WSL = { key: 'MCowBQYDK2VwAyEAdeskProductTestANDYWSLAAAAAAAAAAAAAAAA=', label: 'andy-wsl' };
const OWNER_ITEM = 'goal/G300.1';
// The owner on his node's loopback, as its loopback door marks him (Q8): the one caller that may change the mark.
const ANDY_LOOP = Object.assign({}, ANDY, { loopback: true });
const ownerRow = function (key) { return W.askO('profile.get', { agent: key }, ANDY); };
test.run('a desk of its own starts for the desk-owner cases', 0.2, async function () {
  W.askO = await startDesk('desk-owner', {});
  if (W.askO) await profiles(W.askO);
  return !!W.askO || false;
}, test.limit.slow);
test.run('the owner marks andy-wsl desk owner through profile.set, and its profile then holds owner', 0.2, async function () {
  if (!W.askO) return false;
  await W.askO('profile.set', { agent: ANDY_WSL.key, name: 'Andy WSL', nick: 'awsl', included: true, cap: true, owner: true }, ANDY_LOOP);
  const row = await ownerRow(ANDY_WSL.key);
  return !!row && row.owner === true || false;
}, test.limit.quick);
test.run('a later profile.set that leaves owner out keeps it', 0.2, async function () {
  if (!W.askO) return false;
  await W.askO('profile.set', { agent: ANDY_WSL.key, name: 'Andy WSL', nick: 'awsl', included: true, cap: true }, ANDY);
  const row = await ownerRow(ANDY_WSL.key);
  return !!row && row.owner === true || false;
}, test.limit.quick);
test.run('a line andy-wsl adds, holding no take, is accepted and stands by andy', 0.2, async function () {
  if (!W.askO) return false;
  const text = 'zz a line from his other node ' + Date.now();
  const r = await W.askO('chat.add', { id: OWNER_ITEM, text: text }, ANDY_WSL);
  if (r.ok === false) return false;
  const line = (((await W.askO('item.chat', { id: OWNER_ITEM }, ANDY)).chat) || []).filter(function (l) { return l && l.text === text; })[0];
  return !!line && line.by === 'andy' || false;
}, test.limit.quick);
test.run('andy-wsl\'s press seen, an owner press, is accepted', 0.2, async function () {
  if (!W.askO) return false;
  const r = await W.askO('press', { id: OWNER_ITEM, what: 'seen' }, ANDY_WSL);
  return r.ok !== false && r.code !== 'not-owner' || false;
}, test.limit.quick);
test.run('andy-wsl, a desk owner through a peer, cannot mark another agent desk owner', 0.2, async function () {
  if (!W.askO) return false;
  const r = await W.askO('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true, owner: true }, ANDY_WSL);
  const cw = await ownerRow(CW.key);
  return r.ok === false && !!cw && cw.owner !== true || false;
}, test.limit.quick);
test.run('the owner not on loopback, a puppeteered call, cannot mark an agent desk owner', 0.2, async function () {
  if (!W.askO) return false;
  const r = await W.askO('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true, owner: true }, ANDY);
  const cw = await ownerRow(CW.key);
  return r.ok === false && !!cw && cw.owner !== true || false;
}, test.limit.quick);
test.run('claude-windows, not marked, still has its press seen refused not-owner', 0.2, async function () {
  if (!W.askO) return false;
  const r = await W.askO('press', { id: OWNER_ITEM, what: 'seen' }, CW);
  return r.code === 'not-owner' || false;
}, test.limit.quick);
test.run('unmarked again by the owner, andy-wsl\'s press seen is refused not-owner', 0.2, async function () {
  if (!W.askO) return false;
  await W.askO('profile.set', { agent: ANDY_WSL.key, name: 'Andy WSL', nick: 'awsl', included: true, cap: true, owner: false }, ANDY_LOOP);
  const r = await W.askO('press', { id: OWNER_ITEM, what: 'seen' }, ANDY_WSL);
  return r.code === 'not-owner' || false;
}, test.limit.quick);

test.after(async function () {
  W.pullKids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) W.node.server.close(); } catch (e) { /* closed */ }
  await sleep(200);
});

// THE LAST AFTER: its temp folder, once everything in it is closed (see the top of this file).
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/desk/test/desk'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
