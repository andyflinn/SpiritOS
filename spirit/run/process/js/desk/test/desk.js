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
const { spawn } = require('child_process');
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
// A family's interface, as a node's door answers {api: {family}}.
function familyOf(body) {
  if (!body || !body.api || typeof body.api.family !== 'string' || !/^[A-Za-z]\w*$/.test(body.api.family)) return null;
  const f = body.api.family;
  const tried = [path.join(RUN, 'spirit', f, 'api.js'), path.join(RUN, require(path.join(RUN, 'spirit.js')).familyPath(f))];
  for (const file of tried) if (fs.existsSync(file)) return { family: f, interface: fs.readFileSync(file, 'utf8') };
  return { ok: false, code: 'no-interface' };
}
// ANDY'S NODE AS THE DESK SEES IT, on its one door (POST /api/spirit {verb, ...}): his pages' publishes
// (events.publish, the row as app) into pages; the event stream peerPost reads its answers on (events.subscribe); a
// family's interface (api {family}); each post to a deskClient's streamListener (peer.post) into posts as {to, json},
// every entry of it into sent as {to, row, entry}.
function pretendNode() {
  const pages = []; const posts = []; const sent = []; const streams = []; const deaf = new Set();
  const server = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      if (b.verb === 'events.subscribe') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (b.verb === 'events.publish') { if (b.app) pages.push(b.app); res.end('{"ok":true}'); return; }
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
        // Every delivery is a bundle, one array of entries { run, n, row } (spirit/appServer.js, goal/G41.12); a full
        // push ends in { run, n, full, end }, which carries no row.
        (Array.isArray(got) ? got : []).forEach(function (e) { sent.push({ to: String(b.to), row: e && e.row, entry: e }); });
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
  // EVERY ANSWER IS "ok" (goal/G41.12, box v32: "the implementation's API is all PUT"; "The client PUTs and the server
  // STREAMs"): what a write did is read from what the desk published, as his pages hear it, never from its answer.
  const factsRows = function (id) {
    return node.pages.filter(function (o) { return o && o.item && !o.table && !o.removed; }).map(function (o) {
      let it = o.item; if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } } return it;
    }).filter(function (it) { return it && String(it.id) === id; });
  };
  // The newest facts of an item, waited for until pass holds them (3 s at most).
  const facts = async function (id, pass) {
    for (let i = 0; i < 30; i++) { const rows = factsRows(id); const last = rows[rows.length - 1]; if (last && (!pass || pass(last))) return last; await sleep(100); }
    const rows = factsRows(id); return rows[rows.length - 1] || {};
  };
  // An item nothing has published yet is pushed by his push button (box v30), so its facts are known.
  const known = async function (id) { if (!factsRows(id).length) await call('press', { id: id, what: 'push' }, ANDY); return facts(id); };
  // An item's file list, rebuilt from the files rows published, one agent's path each, waited for until pass holds it.
  const filesOf = async function (id, pass) {
    const now = function () {
      const out = new Map();
      node.pages.forEach(function (o) { if (!o || o.table !== 'files' || o.id !== id) return; if (o.removed) { out.delete(String(o.at)); return; } if (o.row) out.set(o.row.by + '|' + o.row.path, o.row); });
      return Array.from(out.values());
    };
    for (let i = 0; i < 30 && !(pass ? pass(now()) : false); i++) await sleep(100);
    return now();
  };
  const boxRows = function (id) { return node.pages.filter(function (o) { return o && o.table === 'box' && o.id === id && o.row; }).map(function (o) { return String(o.row.text || ''); }); };
  const accepted = function (r) { return r === 'ok' || !!(r && (r.ok === true || r.subscribed === true)); };
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
    await call('item.files.add', { id: 'goal/G100.1', paths: paths }, CW);
    const listed = (await filesOf('goal/G100.1', function (fs_) { return paths.every(function (p) { return fs_.some(function (f) { return f.path === p; }); }); })).map(function (f) { return f.path; });
    ok(paths.every(function (p) { return listed.indexOf(p) !== -1; }), 'item.files.add {id, paths} lands every path of the list on the caller\'s list', 'listed ' + short(listed));

    test.subHeading('bundles: a goal pushed whole reaches a subscribed client as bundles of rows');
    const before = node.posts.length;
    await call('press', { id: OTHER.id, what: 'make-current' }, ANDY);
    const wholeRows = function (p) {
      const rows = (Array.isArray(p.got) ? p.got : []).map(function (e) { return e && e.row; });
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
    await call('press', { id: GOAL.id, what: 'end-design' }, ANDY);
    const ended = await facts(GOAL.id, function (f) { return f.design === false; });
    ok(ended.design === false, 'the world: the goal leaves design mode', 'its row: ' + short(ended));

    test.subHeading('files known in design: a code item is not green with an empty file list');
    await call('press', { id: 'goal/G100.2', what: 'code' }, ANDY);
    const bare = await facts('goal/G100.2', function (f) { return f.code === true; });
    ok(bare.code === true && bare.green === false, 'a code item with no file listed is not green', 'code ' + short(bare.code) + ', green ' + short(bare.green) + ', files ' + short(bare.fileCount));
    await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    await sleep(800);
    const noGo = await facts('goal/G100.2');
    ok(noGo.code === true && noGo.go !== true, 'his Go on it does not take: its row never shows go', 'its row: ' + short({ go: noGo.go, green: noGo.green }));
    await call('item.take', { id: 'goal/G100.2' }, UBI);
    await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/early.js' }, UBI);
    const listedOne = await facts('goal/G100.2', function (f) { return f.green === true; });
    ok(listedOne.green === true, 'with a file listed it is green', 'green ' + short(listedOne.green));
    await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    const goNow = await facts('goal/G100.2', function (f) { return f.go === true; });
    ok(goNow.go === true, 'and his Go is taken', 'its row: ' + short({ go: goNow.go }));
    await call('item.files.add', { id: 'goal/G100.2', path: 'spirit/run/late.js' }, UBI);
    const entries = await filesOf('goal/G100.2', function (fs_) { return fs_.some(function (f) { return f.path === 'spirit/run/late.js'; }); });
    const early = entries.filter(function (f) { return f.path === 'spirit/run/early.js'; })[0] || {};
    const late = entries.filter(function (f) { return f.path === 'spirit/run/late.js'; })[0] || null;
    ok(!!late, 'a file added after his Go is allowed', 'files ' + short(entries));
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
    // One answer's room, as the desk cuts it (desk.js ANSWER_ROOM: limits.ANSWER_MAX - 512).
    const room = require(path.join(RUN, 'spirit', 'limits.js')).ANSWER_MAX - 512;
    const v00 = (await known('goal/G100.4')).version || 0;
    await call('box.write', { id: 'goal/G100.4', text: 'x'.repeat(room + 100), version: v00 }, ANDY);
    await sleep(800);
    ok(!boxRows('goal/G100.4').some(function (t) { return t.length > room; }), 'a box past one answer (' + room + ' bytes) never lands', 'box rows of ' + short(boxRows('goal/G100.4').map(function (t) { return t.length; })));
    const v0 = (await facts('goal/G100.4')).version || 0;
    await call('box.write', { id: 'goal/G100.4', text: 'a short box', version: v0 }, ANDY);
    await call('box.take', { id: 'goal/G100.4' }, WSL);
    const takenSmall = await facts('goal/G100.4', function (f) { return f.boxTaken === WSL.label; });
    ok(boxRows('goal/G100.4').indexOf('a short box') !== -1 && takenSmall.boxTaken === WSL.label, 'a box write below red offers nothing: an agent with cap off takes it plainly', 'box rows ' + short(boxRows('goal/G100.4')) + ', boxTaken ' + short(takenSmall.boxTaken));
    await call('box.release', { id: 'goal/G100.4' }, WSL);
    const v1 = (await facts('goal/G100.4', function (f) { return f.boxTaken !== WSL.label; })).version || 0;
    const red = 'y'.repeat(Math.ceil(room * 0.8));
    await call('box.write', { id: 'goal/G100.4', text: red, version: v1 }, ANDY);
    for (let i = 0; i < 30 && boxRows('goal/G100.4').indexOf(red) === -1; i++) await sleep(100);
    ok(boxRows('goal/G100.4').indexOf(red) !== -1, 'a box write to 80% of one answer lands', 'box rows of ' + short(boxRows('goal/G100.4').map(function (t) { return t.length; })));
    await call('box.take', { id: 'goal/G100.4' }, WSL);
    await sleep(800);
    ok((await facts('goal/G100.4')).boxTaken !== WSL.label, 'then an agent with cap off is refused the box: it never holds it', 'boxTaken ' + short((await facts('goal/G100.4')).boxTaken));
    await call('box.take', { id: 'goal/G100.4' }, UBI);
    const held = await facts('goal/G100.4', function (f) { return f.boxTaken === UBI.label; });
    ok(held.boxTaken === UBI.label, 'and an agent with cap on takes it, held for one write', 'boxTaken ' + short(held.boxTaken));

    // ── THE POSITION IS appServer'S (goal/G41.12, box v15: "Each sender numbers every row it publishes, one count per
    // sender, kept with its run id"; "The desk's change number as the stream's position" goes). A subscribe carries
    // (run, since); the desk's own part is what it publishes and its bootstrap ─────────────────────────────────────────
    const entriesTo = function (key, from) { return node.sent.slice(from).filter(function (x) { return x.to === key; }).map(function (x) { return x.entry || {}; }); };
    const rowsTo = function (key, from) { return entriesTo(key, from).filter(function (e) { return !e.end; }).map(function (e) { return e.row; }); };
    const pushEnded = function (key, from) { return entriesTo(key, from).some(function (e) { return e.end === true; }); };
    const waitEnd = async function (key, from, ms) { for (let i = 0; i < (ms || 15000) / 100; i++) { if (pushEnded(key, from)) return true; await sleep(100); } return false; };
    const waitFor = async function (key, from, test, ms) { for (let i = 0; i < (ms || 15000) / 100; i++) { if (test(rowsTo(key, from))) return true; await sleep(100); } return false; };
    const textsOf = function (rows) { return rows.filter(function (r) { return r && r.table === 'chat'; }).map(function (r) { return String((r.row && r.row.text) || ''); }); };
    const memberIds = [GOAL.id].concat(ITEMS);
    const wholeOf = function (rows) { return rows.filter(function (r) { return r && r.verb === 'goal.whole' && r.item; }); };
    const sideOf = function (rows) { return rows.filter(function (r) { return r && typeof r.table === 'string' && !r.verb; }); };
    // The position a subscriber holds: the run and the newest number of what it took.
    const positionOf = function (key, from) {
      const es = entriesTo(key, from).filter(function (e) { return e.run; });
      return es.length ? { run: es[es.length - 1].run, since: es.reduce(function (m, e) { return Math.max(m, Number(e.n) || 0); }, 0) } : null;
    };

    // goal/G41.12, box v30: "there is NO initial push for desk server, it will only PUSH the current goal row when an
    // agent reconnects".
    test.subHeading('the position: a subscribe without one is a full push of the current goal\'s row alone');
    const FRESH = { key: 'MCowBQYDK2VwAyEAdeskProductTestFRESHAAAAAAAAAAAAAAAAAAA=', label: 'fresh' };
    const f0 = node.sent.length;
    const plain = await call('subscribe', { family: 'deskClient' }, FRESH);
    const plainEnded = await waitEnd(FRESH.key, f0);
    const plainRows = rowsTo(FRESH.key, f0);
    const plainIds = wholeOf(plainRows).map(function (r) { return String(r.item.id); });
    ok(accepted(plain) && plainEnded && plainIds.indexOf(GOAL.id) !== -1, 'with no position, the current goal\'s row comes', 'subscribed ' + short(plain) + ', ended ' + plainEnded + ', facts of ' + short(plainIds));
    ok(plainEnded && ITEMS.every(function (id) { return plainIds.indexOf(id) === -1; }) && plainRows.every(function (r) { return !r || !r.item || String(r.item.id) === GOAL.id || String(r.item.id) === 'goal/G0'; }),
      'and none of its items\' rows, nor another goal\'s: no initial push', 'rows of ' + short(plainRows.map(function (r) { return r && (r.item ? r.item.id : r.rule || r.table); })));
    ok(plainEnded && sideOf(plainRows).length === 0, 'and no side row (no chat line, check or box)', 'side rows: ' + short(sideOf(plainRows).map(function (r) { return r.table + ' ' + r.id; })));
    const plainEntries = entriesTo(FRESH.key, f0);
    ok(plainEntries.length > 1 && plainEntries.every(function (e) { return e.full === true && typeof e.run === 'string' && e.run && Number.isInteger(e.n); }) && plainEntries[plainEntries.length - 1].end === true && plainEntries.filter(function (e) { return e.end; }).length === 1,
      'each of its entries is full, of one run and numbered, the last its one end', 'entries: ' + short(plainEntries.slice(-2)));
    const zero = node.sent.length;
    await call('subscribe', { family: 'deskClient', since: 0 }, FRESH);
    await waitEnd(FRESH.key, zero);
    ok(pushEnded(FRESH.key, zero) && sideOf(rowsTo(FRESH.key, zero)).length === 0 && wholeOf(rowsTo(FRESH.key, zero)).some(function (r) { return String(r.item.id) === GOAL.id; }), 'a since with no run is no position: a full push again, the goal\'s row', 'rows: ' + short(rowsTo(FRESH.key, zero).length));

    test.subHeading('the position: a subscribe with one hands what was published after it, oldest first');
    const pos = positionOf(FRESH.key, f0);
    const oldLine = 'all agents seem busy';   // written before the position, above
    const LINES = { nobody: 'after the position, for whoever', ubi: 'ubi, after the position, for you', cw: 'cw, after the position, not for ubi', group: 'after the position, in the group chat', other: 'in another goal, after the position' };
    await call('chat.add', { id: 'goal/G100.3', text: LINES.nobody }, ANDY);
    await call('chat.add', { id: 'goal/G100.3', text: LINES.ubi }, ANDY);
    await call('chat.add', { id: 'goal/G100.3', text: LINES.cw }, ANDY);
    await call('chat.add', { id: 'goal/G0', text: LINES.group }, ANDY);
    const v5 = (await known('goal/G100.5')).version || 0;
    await call('box.write', { id: 'goal/G100.5', text: 'a box written after the position', version: v5 }, ANDY);
    await call('chat.add', { id: 'goal/G200.1', text: LINES.other }, ANDY);
    await sleep(500);
    const u0 = node.sent.length;
    const caught = await call('subscribe', { family: 'deskClient', run: pos && pos.run, since: pos && pos.since }, UBI);
    await waitFor(UBI.key, u0, function (rows) { return textsOf(rows).indexOf(LINES.other) !== -1; });
    const got = rowsTo(UBI.key, u0);
    const gotEntries = entriesTo(UBI.key, u0);
    const sides = sideOf(got);
    const texts = textsOf(got);
    ok(!!pos && accepted(caught) && got.length > 0, 'a subscribe with the position (' + short(pos) + ') is taken and handed rows', 'subscribed ' + short(caught) + ', rows ' + got.length);
    ok(texts.indexOf(LINES.nobody) !== -1 && texts.indexOf(LINES.group) !== -1, 'it hands the lines written after the position: the current goal\'s and the group chat\'s', 'chat rows handed: ' + short(texts));
    ok(texts.indexOf(LINES.other) !== -1, 'and another goal\'s: the cache keeps every goal (box v15)', 'chat rows handed: ' + short(texts));
    ok(texts.indexOf(oldLine) === -1 && gotEntries.every(function (e) { return Number(e.n) > pos.since; }), 'and nothing published at or before it', 'old line handed: ' + (texts.indexOf(oldLine) !== -1) + ', numbers ' + short(gotEntries.map(function (e) { return e.n; })));
    ok(wholeOf(got).length === 0 && !gotEntries.some(function (e) { return e.full || e.end; }), 'no full push: no bootstrap row, no end', 'facts rows ' + wholeOf(got).length + ', full or end entries ' + gotEntries.filter(function (e) { return e.full || e.end; }).length);
    const order = gotEntries.map(function (e) { return Number(e.n); });
    ok(order.length > 1 && order.every(function (c, i) { return i === 0 || c > order[i - 1]; }), 'the rows oldest first, each once', 'numbers in order handed: ' + short(order));
    ok(gotEntries.every(function (e) { return e.run === pos.run; }) && sides.every(function (r) { return r.table && r.id && (r.table !== 'chat' || (r.row && typeof r.row.text === 'string')); }), 'each as the side row its write published (table, id, row), of the same run', 'a row: ' + short(sides[0]));

    test.subHeading('the position: a line addressed to another agent never comes back');
    ok(texts.indexOf(LINES.cw) === -1, 'his line to cw is not handed to ubi', 'chat rows handed: ' + short(texts));
    ok(texts.indexOf(LINES.ubi) !== -1, 'his line to ubi is', 'chat rows handed: ' + short(texts));
    const c0 = node.sent.length;
    await call('subscribe', { family: 'deskClient', run: pos && pos.run, since: pos && pos.since }, CW);
    await waitFor(CW.key, c0, function (rows) { return textsOf(rows).indexOf(LINES.other) !== -1; });
    const cwTexts = textsOf(rowsTo(CW.key, c0));
    ok(cwTexts.indexOf(LINES.cw) !== -1 && cwTexts.indexOf(LINES.ubi) === -1, 'and the same position for cw hands its own line and not ubi\'s', 'cw handed: ' + short(cwTexts));

    test.subHeading('the position: a box written after it comes, one before it does not');
    const boxRow = sides.filter(function (r) { return r.table === 'box' && r.id === 'goal/G100.5'; })[0];
    ok(!!boxRow && boxRow.row && /after the position/.test(String(boxRow.row.text || '')), 'the box written after the position comes', 'box row ' + short(boxRow));
    const staleBox = sides.filter(function (r) { return r.table === 'box' && r.id === 'goal/G100.4'; })[0];
    ok(!staleBox, 'a box written before the position does not', 'G100.4\'s box handed: ' + short(staleBox));

    // goal/G41.12, box v30: "The user get's a \"push\" button the the detail of every goal or item, to force a server push
    // of that item. chat's ar only pushed as lines happen."
    test.subHeading('the push button: his press pushes that item to the subscribers');
    const q0 = node.sent.length;
    const pushed3 = await call('press', { id: 'goal/G100.3', what: 'push' }, ANDY);
    await waitFor(CW.key, q0, function (rows) { return rows.some(function (r) { return r && r.item && String(r.item.id) === 'goal/G100.3'; }); }, 5000);
    const after3 = rowsTo(CW.key, q0);
    ok(after3.some(function (r) { return r && r.item && String(r.item.id) === 'goal/G100.3'; }), 'press push on goal/G100.3 hands its row to a subscribed client', 'press answered ' + short(pushed3) + ', rows ' + short(after3.map(function (r) { return r && (r.item ? r.item.id : r.table + ' ' + r.id); })));
    ok(!after3.some(function (r) { return r && r.item && String(r.item.id) !== 'goal/G100.3'; }), 'and no other item\'s row', 'rows ' + short(after3.map(function (r) { return r && r.item && r.item.id; })));
    const q1 = node.sent.length;
    const pushedGoal = await call('press', { id: GOAL.id, what: 'push' }, ANDY);
    await waitFor(CW.key, q1, function (rows) { return rows.some(function (r) { return r && r.item && String(r.item.id) === GOAL.id; }); }, 5000);
    ok(rowsTo(CW.key, q1).some(function (r) { return r && r.item && String(r.item.id) === GOAL.id; }), 'and on a goal, the goal\'s row', 'press answered ' + short(pushedGoal));

    test.subHeading('a subscriber whose delivery failed is dropped, and handed what it missed when it subscribes again');
    // goal/G41.12, kept: "A subscribe or a delivery not answered in 3 s fails; the sender drops that subscriber until
    // it subscribes again."
    const AWAY = { key: 'MCowBQYDK2VwAyEAdeskProductTestAWAYAAAAAAAAAAAAAAAAAAAA=', label: 'away' };
    const a0 = node.sent.length;
    await call('subscribe', { family: 'deskClient' }, AWAY);
    await waitEnd(AWAY.key, a0);
    const awayPos = positionOf(AWAY.key, a0);
    node.deaf.add(AWAY.key);
    const p0 = node.posts.length;
    const postsTo = function () { return node.posts.slice(p0).filter(function (p) { return p.to === AWAY.key; }); };
    await call('chat.add', { id: 'goal/G100.6', text: 'the first while it was away' }, ANDY);
    for (let i = 0; i < 50 && postsTo().length < 1; i++) await sleep(100);
    // Past the fast fail (3 s) it is dropped: what is written next is posted to nobody.
    await sleep(4000);
    await call('chat.add', { id: 'goal/G100.6', text: 'the second while it was away' }, ANDY);
    await sleep(2000);
    ok(postsTo().length === 1, 'the delivery it did not take is posted once, and nothing after it', 'posts to it: ' + postsTo().length);
    node.deaf.delete(AWAY.key);
    const b0 = node.sent.length;
    await call('subscribe', { family: 'deskClient', run: awayPos && awayPos.run, since: awayPos && awayPos.since }, AWAY);
    await waitFor(AWAY.key, b0, function (rows) { return textsOf(rows).indexOf('the second while it was away') !== -1; });
    const awayTexts = textsOf(rowsTo(AWAY.key, b0));
    ok(!!awayPos && awayTexts.indexOf('the first while it was away') !== -1 && awayTexts.indexOf('the second while it was away') !== -1 && wholeOf(rowsTo(AWAY.key, b0)).length === 0,
      'subscribing again with its position, it is handed both lines it missed, and no full push', 'rows it got: ' + short(awayTexts));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.server.close();
  }
}()).then(function () { test.reportSuccessFailureCount(); setTimeout(function () { process.exit(process.exitCode || 0); }, 200); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); setTimeout(function () { process.exit(1); }, 200); });
