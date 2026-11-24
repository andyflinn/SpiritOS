'use strict';

// spirit/run/spirit/app/desk/test/desk.js
// The tests of spirit/app/desk/desk.js, and of no other module (spec: ./desk.md; goal/G41.11). The desk runs as it
// runs on a node: a process on its own pipe and a state folder of its own, seeded with a goal before it starts. A
// pretend node stands where Andy's node is: it keeps what the desk publishes for his pages and what it sends each
// subscribed desk in client mode, and answers a family's interface the way a node's door does.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/desk/test/desk/' + name + tempAsked); }
// Its folder is removed by the last after of this file, once its databases are closed and its servers stopped: on
// Windows a folder holding an open database cannot be removed, and the suite was red on 'it leaves no temp folder behind'.
const appClient = SPIRIT.requireScript('spirit/appClient.js');
const packet = SPIRIT.requireScript('spirit/client/packet.js');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem.js').VENDORED_FOLDERS;
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

const CW = { key: 'MCowBQYDK2VwAyEA' + 'deskProductTestCW'.padEnd(43, 'A') + '=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEA' + 'deskProductTestOwner'.padEnd(43, 'A') + '=', label: 'andy' };

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
        design: false }), n);
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
    // As the desk made them before rules went out (spirit/app/desk/server/server.js, before goal/G47.4).
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
// A branch's interface, as a node's door answers {api: {branch}}.
function interfaceOf(body) {
  if (!body || !body.api || typeof body.api.branch !== 'string' || !/^[A-Za-z]\w*$/.test(body.api.branch)) return null;
  const f = body.api.branch;
  // A node family's, an app's (spirit/app/<name>/api.js, goal/G43.27), or a server's.
  const tried = [path.join(RUN, 'spirit', f, 'api.js'), path.join(RUN, 'spirit', 'app', f, 'api.js')];
  for (const file of tried) if (fs.existsSync(file)) return { branch: f, interface: fs.readFileSync(file, 'utf8') };
  return { ok: false, code: 'no-interface' };
}
function entriesOf(got) { return Array.isArray(got) ? got : got && Array.isArray(got.rows) ? got.rows : got ? [got] : []; }
// ANDY'S NODE AS THE DESK SEES IT, on its one door (POST /api/spirit {verb, ...}): his pages' publishes
// (event.publish, the row as app) into pages; the event stream peerPost reads its answers on (event.subscribe); a
// family's interface (api {family}); each post to a subscriber's desk listener (peer.post) into posts as {to, json},
// every row of it into sent as {to, row}.
// A job (job.create {command, args}) is started for real, as a node starts it, and kept in jobs with its exit.
function pretendNode() {
  const pages = []; const posts = []; const sent = []; const streams = []; const deaf = new Set();
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
      if (b.verb === 'api' && typeof b.branch === 'string') { res.end(JSON.stringify(interfaceOf({ api: { branch: b.branch } }))); return; }
      if (b.verb !== 'peer.post') { res.end('{"ok":true}'); return; }
      const hash = 'H' + Date.now() + Math.random();
      res.end(JSON.stringify({ ok: true, hash: hash }));
      let ask = null; try { ask = packet.decode(b.text); } catch (e) { ask = null; }
      const body = (ask && ask.body) || {};
      let answer = interfaceOf(body);
      // A subscriber is another node's desk in client mode (goal/G47.5): deskClient went with goal/G48.8.
      const sl = body.desk && body.desk.listener;
      if (!answer && sl) {
        let got = null; try { got = JSON.parse(sl.json); } catch (e) { got = null; }
        posts.push({ to: String(b.to), json: sl.json, got: got });
        // A delivery is one bundle of entries (spirit/server/app.js, goal/G41.12): { run, n, row, full? }, or the end of a
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
  return { server: server, pages: pages, posts: posts, sent: sent, deaf: deaf };
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
const pullSession = { goal: PULL, items: PULL_ITEMS.map(function (id) { return { id: id, title: 'Pull ' + id }; }) };

const call = function (verb, args, caller) { const q = {}; q[verb] = args; return W.client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };

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

const startDesk = async function (name, values, sessions) {
  if (!W.node || !W.SERVER) return null;
  const root = path.join(W.scratch, name);
  const server = W.SERVER;
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

test.run('a desk server starts for this suite', 0.2, async function () {
  // A ONE-LETTER NAME: each desk of the cases below listens on a unix socket under <scratch>/<its name>/, and a socket's
  // path is short (108 bytes); under this suite's route a longer name put desk-grants' socket past it.
  const scratch = W.scratch = ownTemp('d');
  const state = path.join(scratch, 'state');
  seed(state, [
    { goal: OTHER, items: OTHER_ITEMS.map(function (id) { return { id: id, title: 'Other ' + id }; }) },
    { goal: GOAL, items: ITEMS.map(function (id) { return { id: id, title: 'Item ' + id }; }) },
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
  await call('subscribe', { branch: 'desk' }, CW);
  return true;
}, test.limit.slow);

// chat.search's since and before are UTC times (goal/G48.4, Q5): since keeps the lines from that time on, before the lines
// before it; 0 is no limit.
test.run('chat.search keeps the lines since a UTC time, and before one', 0.2, async function () {
  if (!W.up) return false;
  const pause = function () { return new Promise(function (r) { setTimeout(r, 30); }); };
  await call('chat.add', { id: 'goal/G100.1', text: 'zzOlderLine' }, CW);
  await pause();
  const mid = Date.now();
  await pause();
  await call('chat.add', { id: 'goal/G100.1', text: 'zzNewerLine' }, CW);
  const said = function (r) { return ((r && r.items) || []).map(function (x) { try { return JSON.parse(x.label).text; } catch (e) { return ''; } }); };
  const since = said(await call('chat.search', { id: 'goal/G100.1', text: '', by: '', since: mid, before: 0, scope: '' }, CW));
  const before = said(await call('chat.search', { id: 'goal/G100.1', text: '', by: '', since: 0, before: mid, scope: '' }, CW));
  return (since.indexOf('zzNewerLine') !== -1 && since.indexOf('zzOlderLine') === -1 && before.indexOf('zzOlderLine') !== -1 && before.indexOf('zzNewerLine') === -1) || false;
}, test.limit.quick);

// A LINE'S FIRST WORD IS ITS to (goal/G48.8; Andy: "all desk needs to do is scan for a line starting with a \"word:\" ... and
// throw it into a \"to\" field, that your wait can check. the field will contain \"all\", \"cw\", \"wsl\" or \"ubi\"", "desk
// doesn't need to know and we can avoid unnecessary wakes", and of cw's "the first word of every chat line, lowercased, goes
// into its to, checked against nothing": "agreed, no punctuation."). His lines here are his own forms of today.
// The chat row a line was published with, as his pages heard it, and as the subscriber cw was sent it.
const chatRowOf = async function (text) {
  for (let i = 0; i < 40; i++) {
    const page = W.node.pages.filter(function (o) { return o && o.table === 'chat' && o.row && o.row.text === text; })[0];
    const sent = W.node.sent.filter(function (x) { return x.to === CW.key && x.row && x.row.table === 'chat' && x.row.row && x.row.row.text === text; })[0];
    if (page && sent) return { page: page, sent: sent.row };
    await sleep(100);
  }
  return { page: null, sent: null };
};
const toIs = async function (text, word) {
  if (!W.up) return false;
  await call('chat.add', { id: 'goal/G100.3', text: text }, ANDY);
  const r = await chatRowOf(text);
  return (!!r.page && !!r.sent && r.page.to === word && r.sent.to === word) || false;
};
test.run('a line "wsl, look here" is published with to wsl, to his pages and to a subscriber', 0.4, function () {
  return toIs('wsl, look here', 'wsl');
}, test.limit.quick);
test.run('a line "all: your thoughts?" is published with to all', 0.4, function () {
  return toIs('all: your thoughts?', 'all');
}, test.limit.quick);
test.run('a line "cw (a) leaves it clean", its word followed by a space, is published with to cw', 0.4, function () {
  return toIs('cw (a) leaves it clean', 'cw');
}, test.limit.quick);
test.run('a line "The plainest rule" is published with to the, its first word lowercased, checked against nothing', 0.4, function () {
  return toIs('The plainest rule', 'the');
}, test.limit.quick);

// THE PLUNGER (goal/G49; Andy: "put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input] [Add-button],
// which will add an item with <Title> blocking the goal/item it was created from."): the item item.add makes, given blocks,
// names in its facts the item it blocks.
test.run('item.add with blocks makes an item of that title whose facts name the item it blocks', 0.4, async function () {
  if (!W.up) return false;
  const made = await call('item.add', { goal: GOAL.id, title: 'zz blocking item', blocks: ITEMS[5] }, ANDY);
  if (!made || typeof made.id !== 'string' || !made.id) return false;
  const f = await facts(made.id);
  return (f.title === 'zz blocking item' && JSON.stringify(f).indexOf('"' + ITEMS[5] + '"') !== -1) || false;
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
// auto-verb of spirit/server/app.js!", "they're both auto-verbs. MUST BE.", "PLEASE call the damn thing jus \"listener\", we
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
// THE CURRENT GOAL IS ITS OWN STREAMED ROW (goal/G49.8, point 2; Andy: "the \"current\" selection is just another streamed
// item, that part of the apps (desks) state....that's all.", "go!"; cw: { change, current: <goal id> }): the press above
// made the other goal current, and that one row says so, to his pages and to a subscriber alike.
const currentRows = function (rows) { return rows.filter(function (r) { return r && typeof r === 'object' && typeof r.current === 'string' && !r.verb && !r.table; }); };
test.run('a goal made current is published as one current row naming it, to his pages and to a subscriber', 0.4, function () {
  if (!W.up) return false;
  const toPages = currentRows(W.node.pages).filter(function (r) { return r.current === OTHER.id; });
  const toCw = currentRows(rowsTo(CW.key, 0)).filter(function (r) { return r.current === OTHER.id; });
  return (toPages.length === 1 && toCw.length === 1 && typeof toCw[0].change === 'number') || false;
}, test.limit.quick);
test.run('the goal leaves design mode', 0.2, async function () {
  if (!W.up) return false;
  await call('press', { id: GOAL.id, what: 'make-current' }, ANDY);
  const ended = await call('press', { id: GOAL.id, what: 'end-design' }, ANDY);
  return !!ended.change || false;
}, test.limit.quick);

// THE FILES AND CODE GO (goal/G48.8; Andy: "get rid of all item.files logic", "get rid of the idea that i need files before i
// can end design", "\"code\" and all its logic goes"): an item with no file listed is his to Go, and there is no code press.
test.run('his Go on an item with no file listed is taken', 0.2, async function () {
  if (!W.up) return false;
  const go = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  return (!!go.change && go.ok !== false) || false;
}, test.limit.quick);


// the box: a write too big for one answer is refused with the room of one, a write within it lands
test.run('a box write too big for one answer has the desk name the room of one answer', 0.2, async function () {
  if (!W.up) return false;
  const tooBig = await call('box.write', { id: 'goal/G100.4', text: 'x'.repeat(20000), version: 0 }, ANDY);
  W.room = tooBig && tooBig.extra && Number(tooBig.extra.max) > 0 ? Number(tooBig.extra.max) : 0;
  return W.room > 0 || false;
}, test.limit.quick);
test.run('a box write to 80% of one answer lands', 0.2, async function () {
  if (!(W.room > 0)) return false;
  // A short write first, so the box has been written twice for the check after this one.
  const v0 = (await facts('goal/G100.4')).version || 0;
  await call('box.write', { id: 'goal/G100.4', text: 'a short box', version: v0 }, ANDY);
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

// the position: a subscribe without since bootstraps as before
const FRESH = { key: 'MCowBQYDK2VwAyEA' + 'deskProductTestFRESH'.padEnd(43, 'A') + '=', label: 'fresh' };
test.run('a subscribe with no since brings the current goal\'s facts whole, the goal and each of its six items', 0.2, async function () {
  if (!W.up) return false;
  const f0 = W.node.sent.length;
  const plain = await call('subscribe', { branch: 'desk' }, FRESH);
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
  await call('subscribe', { branch: 'desk', since: 0 }, FRESH);
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
// goal/G49.8, point 2: a new subscriber learns the current goal from its row, not from the order its goal.whole rows come in.
test.run('a subscribe with no since brings the current row, naming the goal it pushes whole', 0.4, function () {
  if (!W.plainRows) return false;
  const goalRow = wholeOf(W.plainRows).filter(function (r) { return r.item.goal === ''; })[0];
  const cur = currentRows(W.plainRows);
  return (!!goalRow && cur.length === 1 && cur[0].current === String(goalRow.item.id)) || false;
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
const LIST_FIELDS = ['id', 'goal', 'title', 'status', 'statusTone', 'buttons', 'asks', 'alert'];
// THE GOAL'S ROW DRAWS MORE (found at the verify of f181acfb): the page reads the waiting count and the design state from
// it (spirit/app/desk/element/desk/desk.js deskWaitingOnAndy, deskDesignOn), and at open this answer is all it has. The
// agent bubbles and the working blink went with goal/G48.8 (Andy: "get rid of the fucking bubbles").
const GOAL_FIELDS = ['waiting', 'design'];
const search = async function (ask, o) { const r = await ask('items.search', Object.assign({ text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, o || {}), ANDY); return { more: r.more === true, rows: (r.items || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return {}; } }), keys: (r.items || []).map(function (x) { return x.key; }) }; };
test.run('a desk of its own starts for the search cases', 0.2, async function () {
  W.askS = await startDesk('desk-list', {}, [{ goal: LIST_GOAL, items: LIST_ITEMS.map(function (id) { return { id: id, title: 'Item ' + id }; }) }]);
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
test.run('the goal\'s row carries the design state, as item.get says it', 0.2, async function () {
  if (!W.askS) return false;
  await W.askS('press', { id: LIST_GOAL.id, what: 'start-design' }, ANDY);
  const goalRow = (await search(W.askS)).rows.filter(function (r) { return r.id === LIST_GOAL.id; })[0] || {};
  const whole = JSON.parse((await W.askS('item.get', { id: LIST_GOAL.id }, ANDY)).item || '{}');
  return ('design' in goalRow && goalRow.design === whole.design) || false;
}, test.limit.quick);
// His ruling of goal/G41.28 stands on the server: a search covers the whole row, and the chat.
test.run('the server still searches what the row no longer carries: a chat word finds its item first', 0.2, async function () {
  if (!W.askS) return false;
  await W.askS('chat.add', { id: 'goal/G400.20', text: 'zebrafinch' }, ANDY);
  const byChat = await search(W.askS, { text: 'zebrafinch' });
  return byChat.keys[0] === 'goal/G400.20' || false;
}, test.limit.quick);



// goal/G43.3: [include closed] adds the closed rows, and the open ones stay in the first answer
const MIX_GOAL = { id: 'goal/G500', title: 'Closed first' };
const MIX_ITEMS = Array.from({ length: 45 }, function (x, i) { return 'goal/G500.' + (i + 1); });
const CLOSED = MIX_ITEMS.slice(0, 40); const OPEN = MIX_ITEMS.slice(40);
const searchM = async function (o) { const r = await W.askM('items.search', Object.assign({ text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, o), ANDY); return (r.items || []).map(function (x) { return x.key; }); };
test.run('a desk of its own starts for the include closed filter', 0.2, async function () {
  W.askM = await startDesk('desk-mixed', {}, [{ goal: MIX_GOAL, items: MIX_ITEMS.map(function (id) { return { id: id, title: 'Item ' + id }; }) }]);
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


test.after(async function () {
  W.pullKids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  try { if (W.node) W.node.server.close(); } catch (e) { /* closed */ }
  await sleep(200);
});

// THE LAST AFTER: its temp folder, once everything in it is closed (see the top of this file).
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/desk/test/desk'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
