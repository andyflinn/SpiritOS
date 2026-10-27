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
  const tried = [path.join(RUN, 'spirit', f, 'api.js'), path.join(RUN, 'process', 'js', f, f + '.family', 'api.js')];
  for (const file of tried) if (fs.existsSync(file)) return { family: f, interface: fs.readFileSync(file, 'utf8') };
  return { ok: false, code: 'no-interface' };
}
// ANDY'S NODE AS THE DESK SEES IT, on its one door (POST /api/spirit {verb, ...}): his pages' publishes
// (events.publish, the row as app) into pages; the event stream peerPost reads its answers on (events.subscribe); a
// family's interface (api {family}); each post to a deskClient's streamListener (peer.post) into posts as {to, json},
// every row of it into sent as {to, row}.
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
        const rows = Array.isArray(got) ? got : got && Array.isArray(got.rows) ? got.rows : got ? [got] : [];
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
      const rows = Array.isArray(p.got) ? p.got : p.got && Array.isArray(p.got.rows) ? p.got.rows : p.got ? [p.got] : [];
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
    const pushEnded = function (key, from) { return rowsTo(key, from).some(function (r) { return r && r.bootstrapped === true; }); };
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

    test.subHeading('the position: a subscribe with since hands what changed after it, oldest first');
    await sleep(500);
    const N = node.pages.reduce(function (m, o) { return Math.max(m, Number(o && o.change) || 0); }, 0);
    const oldLine = 'all agents seem busy';   // written before N, above
    const LINES = { nobody: 'after the position, for whoever', ubi: 'ubi, after the position, for you', cw: 'cw, after the position, not for ubi', group: 'after the position, in the group chat' };
    await call('chat.add', { id: 'goal/G100.3', text: LINES.nobody }, ANDY);
    await call('chat.add', { id: 'goal/G100.3', text: LINES.ubi }, ANDY);
    await call('chat.add', { id: 'goal/G100.3', text: LINES.cw }, ANDY);
    await call('chat.add', { id: 'goal/G0', text: LINES.group }, ANDY);
    const v5 = (await facts('goal/G100.5')).version || 0;
    const boxed = await call('box.write', { id: 'goal/G100.5', text: 'a box written after the position', version: v5 }, ANDY);
    await call('chat.add', { id: 'goal/G200.1', text: 'in another goal, after the position' }, ANDY);
    await sleep(500);
    const u0 = node.sent.length;
    const caught = await call('subscribe', { family: 'deskClient', since: N }, UBI);
    const caughtEnded = await waitEnd(UBI.key, u0);
    const got = rowsTo(UBI.key, u0);
    const sides = sideOf(got);
    const texts = sides.filter(function (r) { return r.table === 'chat'; }).map(function (r) { return String((r.row && r.row.text) || ''); });
    ok(caught.subscribed === true && caughtEnded, 'a subscribe with since = ' + N + ' is taken, and its push ends', 'subscribed ' + short(caught) + ', ended ' + caughtEnded);
    ok(texts.indexOf(LINES.nobody) !== -1 && texts.indexOf(LINES.group) !== -1, 'it hands the lines written after the position: the current goal\'s and the group chat\'s', 'chat rows handed: ' + short(texts));
    ok(texts.indexOf(oldLine) === -1 && sides.every(function (r) { return Number(r.change) > N; }), 'and nothing written at or before it', 'old line handed: ' + (texts.indexOf(oldLine) !== -1) + ', changes ' + short(sides.map(function (r) { return r.change; })));
    ok(texts.indexOf('in another goal, after the position') === -1, 'a line of another goal is not handed', 'chat rows handed: ' + short(texts));
    const lastWhole = got.reduce(function (m, r, i) { return r && r.verb === 'goal.whole' ? i : m; }, -1);
    const firstSide = got.findIndex(function (r) { return r && typeof r.table === 'string' && !r.verb; });
    ok(lastWhole !== -1 && firstSide !== -1 && lastWhole < firstSide, 'the goal\'s facts come first, the side rows after them', 'last facts row at ' + lastWhole + ', first side row at ' + firstSide);
    const order = sides.map(function (r) { return Number(r.change); });
    ok(order.length > 1 && order.every(function (c, i) { return i === 0 || c >= order[i - 1]; }), 'the side rows oldest first', 'changes in order handed: ' + short(order));
    ok(sides.every(function (r) { return r.table && r.id && Number(r.change) > 0 && (r.table !== 'chat' || (r.row && typeof r.row.text === 'string')); }), 'each as the side row its write published (table, id, change, row)', 'a row: ' + short(sides[0]));

    test.subHeading('the position: a line addressed to another agent never comes back in a catch-up');
    ok(texts.indexOf(LINES.cw) === -1, 'his line to cw is not handed to ubi', 'chat rows handed: ' + short(texts));
    ok(texts.indexOf(LINES.ubi) !== -1, 'his line to ubi is', 'chat rows handed: ' + short(texts));
    const c0 = node.sent.length;
    await call('subscribe', { family: 'deskClient', since: N }, CW);
    await waitEnd(CW.key, c0);
    const cwTexts = sideOf(rowsTo(CW.key, c0)).filter(function (r) { return r.table === 'chat'; }).map(function (r) { return String((r.row && r.row.text) || ''); });
    ok(cwTexts.indexOf(LINES.cw) !== -1 && cwTexts.indexOf(LINES.ubi) === -1, 'and the same catch-up for cw holds its own line and not ubi\'s', 'cw handed: ' + short(cwTexts));

    test.subHeading('the position: an item whose row changed after it hands its box');
    const boxRow = sides.filter(function (r) { return r.table === 'box' && r.id === 'goal/G100.5'; })[0];
    ok(!!boxed.change && !!boxRow && boxRow.row && /after the position/.test(String(boxRow.row.text || '')), 'the box written after the position comes with the catch-up', 'box write ' + short(boxed) + ', box row ' + short(boxRow));
    const staleBox = sides.filter(function (r) { return r.table === 'box' && r.id === 'goal/G100.4'; })[0];
    ok(!staleBox, 'a box written before the position does not', 'G100.4\'s box handed: ' + short(staleBox));

    test.subHeading('the position: every push ends with { bootstrapped: true }');
    const lastOf = function (rows) { return rows[rows.length - 1]; };
    ok(!!lastOf(got) && lastOf(got).bootstrapped === true && !!lastOf(plainRows) && lastOf(plainRows).bootstrapped === true, 'the last row of each push, with since and without, is { bootstrapped: true }',
      'last rows: ' + short([lastOf(got), lastOf(plainRows)]));
    ok(got.filter(function (r) { return r && r.bootstrapped === true; }).length === 1, 'once per push', 'ends in one push: ' + got.filter(function (r) { return r && r.bootstrapped === true; }).length);

    test.subHeading('a subscriber whose delivery failed is kept: the row is tried again, not dropped');
    // A delivery waits the publisher's waitMs (the desk's CLIENT_WAIT_MS, 10 s) for its answer, then waits as long
    // again before the next try: this section takes about half a minute.
    const AWAY = { key: 'MCowBQYDK2VwAyEAdeskProductTestAWAYAAAAAAAAAAAAAAAAAAAA=', label: 'away' };
    node.deaf.add(AWAY.key);
    const a0 = node.posts.length;
    await call('subscribe', { family: 'deskClient' }, AWAY);
    const attemptsOf = function () { return node.posts.slice(a0).filter(function (p) { return p.to === AWAY.key; }); };
    for (let i = 0; i < 300 && attemptsOf().length < 2; i++) await sleep(100);
    const tries = attemptsOf();
    ok(tries.length >= 2 && tries[0].json === tries[1].json, 'a row it did not take is posted to it again, the same row, after the wait', 'posts to it: ' + tries.length + (tries.length >= 2 ? ', same row: ' + (tries[0].json === tries[1].json) : ''));
    await call('chat.add', { id: 'goal/G100.6', text: 'written while it was away' }, ANDY);
    node.deaf.delete(AWAY.key);
    const back = async function () { for (let i = 0; i < 400; i++) { const t = node.sent.filter(function (x) { return x.to === AWAY.key; }).map(function (x) { return x.row; }); if (t.some(function (r) { return r && r.table === 'chat' && r.row && r.row.text === 'written while it was away'; })) return t; await sleep(100); } return node.sent.filter(function (x) { return x.to === AWAY.key; }).map(function (x) { return x.row; }); };
    const awayRows = await back();
    const awayWhole = wholeOf(awayRows).map(function (r) { return String(r.item.id); });
    ok(memberIds.every(function (id) { return awayWhole.indexOf(id) !== -1; }) && awayRows.some(function (r) { return r && r.bootstrapped === true; }), 'once it answers, its whole push lands: none of it was dropped', 'facts of ' + short(awayWhole));
    ok(awayRows.some(function (r) { return r && r.table === 'chat' && r.row && r.row.text === 'written while it was away'; }), 'and the line written while it was away follows', 'rows it got: ' + awayRows.length);
    // QUEUE_MAX (1000, appServer.js) is not driven here: reaching it means over a thousand rows queued behind a row
    // that waits 10 s each try; the shedding of the oldest is the publisher's own (sendTo), and spirit/test/appServer
    // is the place to drive it with a small queue.
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.server.close();
  }
}()).then(function () { test.reportSuccessFailureCount(); setTimeout(function () { process.exit(process.exitCode || 0); }, 200); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); setTimeout(function () { process.exit(1); }, 200); });
