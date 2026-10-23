'use strict';

// spirit/test/deskTables.js
// goal/G33.4: the desk keeps state only, in tables keyed by goal number and item number. Red on today's tree;
// claude-windows writes it and builds it (one agent). The point of it all, the box's first line: narrowing the scope of
// work, traffic, wire and context to the current goal. The box, in short:
//   - Two numeric main keys: the goal number, then the item number (0 for the goal itself). 'goal/G33.4' is rendered
//     from them. No sub-goals: an item never becomes a goal, so two numbers always suffice.
//   - Tables keyed by them: goals and items, chat (goal, item, timestamp, writer), files (each with its grant status),
//     box (one row per version), checks, claims. Every row carries its creator. Each side table has its own search,
//     filtered by goal or item.
//   - The desk keeps state only: the log of writes goes. An agent's listening or working is one current value per
//     agent, never a row per word.
//   - Design mode on goal AND item level; a new item always arrives in design mode.
//   - Goal 0 is the group chat. Each special goal (a plugin's, the group chat) has a goal number of its own, its goal
//     row marks it special, and it is always open.
//   - Migration, once: each id string becomes its two numbers; records with no goal or item (agent.state, scope.set,
//     the old lines table) are dumped.
//   - The desk database sheds by itself past one constant (16 MB): whole goals, the one untouched the longest first,
//     with every row of theirs; the current goal never, special goals never.
//   - Push: each changed row is pushed on its own under PAYLOAD_MAX, a larger row in numbered pieces; a goal that
//     becomes current is pushed whole to every desk client, and a client that was away gets it whole again.
//
// THE SHAPES THIS RED READS, LOOSELY, because the box does not name them (the builder may pick, within these):
//   - a keyed table has an INTEGER column named goal (or goal_n / goalNumber ...) and one named item (likewise); its
//     role reads from its name: chat, file, box, check, claim; goals and items are a table named for goals or items.
//   - the creator is a column named creator, writer, by or created_by (with or without _key); every row fills it.
//   - a file row's grant status is a column whose name holds 'grant'.
//   - the special mark is a column of the goals' table whose name holds 'special'.
//   - an item's facts (item.get, items.search) carry design: true/false, as a goal's do today.
//   - a pushed row is one object of the publish naming goal and item as numbers; a piece of a larger row carries its
//     number in a field named piece, part, chunk, index, seq or n.
//   - the size the desk sheds by is its database's own: page_count x page_size. The suite sets the constant through the
//     manifest value shedBytes (values.shedBytes), as boxHoldMs is injected; left out, 16 MB.
//   - shedding happens at a write, or by itself within a few seconds.
// OPEN SHAPES, asserted by their outcome only:
//   - how the desk learns that a client was away: asserted on the one case the desk itself sees, its own restart, after
//     which every client is one that was away.
//   - the group chat's id string: goal/G0, goal/G0.0 and desk/G0.0 are tried; its rows must be goal 0.
//   - how a box larger than one request is written: the large box here is the largest one write carries (a little
//     over PAYLOAD_MAX), so only its push has to come in pieces.
// NOT ASSERTED HERE, OWED ELSEWHERE:
//   - the client data set's own bound (about 132 MB, one SpiritOS-wide constant, culling its oldest entries) is a
//     shell-wide feature of spirit.data, managed by no app and no server: it needs its own item.
//   - "a client never grabs, never culls": the client side (shell/js/desk/data.js, deskClient) is not driven here.
//   - each side table's own probability search: asserted only as bounded by goal (section 6), not its ranking.
//   - agent profiles keyed by agent, rules by rule number: no outcome of his names them yet.
// rule/11: through testSupport only; its own folders, its own pipes, a pretend node on a port the OS picks, every
// desk spawned in its own folder so it reads no environment file and probes no node; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const PAYLOAD_MAX = require('../run/js/limits.js').PAYLOAD_MAX;
const coreFiles = require('../run/js/coreFiles.js');

const OWED = 'OWED by goal/G33.4: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskTablesTestAndyAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const AGENT = { key: 'MCowBQYDK2VwAyEAdeskTablesTestAgentAAAAAAAAAAAAAAAAAAAA=', label: 'tables-agent' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return !!r && r.status === 200 && !!r.body && r.body.ok !== false; }
function median(xs) { const s = xs.slice().sort(function (a, b) { return a - b; }); return s[Math.floor(s.length / 2)]; }
// goal/G33.4 -> [33, 4]; goal/G33 -> [33, 0]; anything else -> null.
function numbersOf(id) { const m = /^goal\/G(\d+)(?:\.(\d+))?$/.exec(String(id)); return m ? [Number(m[1]), Number(m[2] || 0)] : null; }

test.startTest('goal/G33.4: the desk keeps state only, in tables keyed by goal and item number');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-tables-'));

// ── THE PRETEND NODE: every publish of every desk, in arrival order ────────────────────────────────────────────────
const published = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
    if (b.verb === 'jobs.update' && b.app && typeof b.app === 'object') published.push(b.app);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});

// ── A DESK OF ITS OWN: its folder, its pipe, its state, its values ─────────────────────────────────────────────────
const kids = [];
function deskAt(name) {
  const dir = path.join(scratch, name);
  const state = path.join(dir, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(dir, 'desk', 'win32', 'process') : path.join(dir, 'desk.sock');
  const client = appClient.createAppClient({ rootDir: dir });
  client.register('desk', pipe);
  const d = { name: name, dir: dir, state: state, db: path.join(state, 'desk.db'), kid: null, err: '' };
  d.call = function (verb, args, caller) {
    const q = {}; q[verb] = args;
    return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
  };
  d.start = async function (values) {
    d.err = '';
    d.kid = spawn(process.execPath, [DESK, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], {
      cwd: dir, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-tables-' + name, SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
    });
    d.kid.stderr.on('data', function (c) { d.err = (d.err + c).slice(-800); });
    kids.push(d.kid);
    // A migration of a large database may take its time: up to a minute.
    for (let i = 0; i < 400; i++) {
      await sleep(150);
      if (d.kid.exitCode !== null) return false;
      try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ }
    }
    return false;
  };
  d.stop = function () {
    return new Promise(function (r) { const k = d.kid; d.kid = null; if (!k || k.exitCode !== null) return r(); k.once('exit', function () { r(); }); k.kill(); setTimeout(r, 4000); });
  };
  d.facts = async function (id) { const r = await d.call('item.get', { id: id }, ANDY); return took(r) ? (parse(r.body.item) || {}) : null; };
  d.search = async function (a) {
    const r = await d.call('items.search', Object.assign({ text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, a), ANDY);
    return ((r.body && r.body.items) || []).map(function (i) { return parse(i.label) || {}; });
  };
  return d;
}

// ── READING THE DESK'S DATABASE, read-only, beside the running desk ────────────────────────────────────────────────
const GOAL_COL = /^goal(_?(n|no|num|number))?$/i;
const ITEM_COL = /^item(_?(n|no|num|number))?$/i;
const CREATOR_COL = /^(creator|writer|by|created_?by)(_?key)?$/i;
const ROLES = { chat: /chat/i, files: /file/i, box: /box/i, checks: /check/i, claims: /claim/i };
function q(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }
function withDb(d, fn) {
  let db = null;
  try { db = new DatabaseSync(d.db, { readOnly: true }); } catch (e) { return { error: 'the database did not open: ' + e.message }; }
  try { return fn(db); } catch (e) { return { error: e.message }; } finally { try { db.close(); } catch (e) { /* closed */ } }
}
function tablesOf(db) {
  const out = {};
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().forEach(function (t) {
    const cols = db.prepare('PRAGMA table_info(' + q(t.name) + ')').all().map(function (c) { return String(c.name); });
    const pick = function (re) { return cols.filter(function (c) { return re.test(c); })[0] || ''; };
    out[t.name] = { name: t.name, cols: cols, count: Number(db.prepare('SELECT COUNT(*) AS c FROM ' + q(t.name)).get().c),
      goal: pick(GOAL_COL), item: pick(ITEM_COL), creator: pick(CREATOR_COL), grant: pick(/grant/i), special: pick(/special/i) };
  });
  return out;
}
// The keyed table playing a role: items (the goals and items), chat, files, box, checks, claims.
function roleTable(tables, role) {
  const keyed = Object.keys(tables).map(function (k) { return tables[k]; }).filter(function (t) { return t.goal && t.item; });
  if (role === 'items') {
    return keyed.filter(function (t) { return /item|goal/i.test(t.name) && !Object.keys(ROLES).some(function (r) { return ROLES[r].test(t.name); }); })[0] || null;
  }
  return keyed.filter(function (t) { return ROLES[role].test(t.name); })[0] || null;
}
function rowsAt(db, t, goal, item) {
  return db.prepare('SELECT * FROM ' + q(t.name) + ' WHERE ' + q(t.goal) + ' = ? AND ' + q(t.item) + ' = ?').all(goal, item);
}
function countsOf(d) { return withDb(d, function (db) { const t = tablesOf(db); const o = {}; Object.keys(t).forEach(function (k) { o[k] = t[k].count; }); return o; }); }
function grown(before, after) {
  const out = {};
  Object.keys(after).forEach(function (k) { const n = after[k] - (before[k] || 0); if (n) out[k] = n; });
  return out;
}
function dbBytes(d) { return withDb(d, function (db) { return Number(db.prepare('PRAGMA page_count').get().page_count) * Number(db.prepare('PRAGMA page_size').get().page_size); }); }

// ── READING THE PUBLISHES ──────────────────────────────────────────────────────────────────────────────────────────
function each(o, fn) { if (o && typeof o === 'object') { fn(o); Object.keys(o).forEach(function (k) { each(o[k], fn); }); } }
function namesRow(pub, goal, item) { let hit = false; each(pub, function (o) { if (o.goal === goal && o.item === item) hit = true; }); return hit; }
function holds(pub, text) { return JSON.stringify(pub).indexOf(text) !== -1; }
function bytesOf(pub) { return Buffer.byteLength(JSON.stringify(pub), 'utf8'); }
function overMax(pubs) { return pubs.filter(function (p) { return bytesOf(p) > PAYLOAD_MAX || p.dropped; }); }
async function settle(ms) { await sleep(ms || 900); }

// ── AN OLD-SHAPE desk.db, as today's desk writes it: records, lines ────────────────────────────────────────────────
// goal/G7 (current) with goal/G7.1 and goal/G7.2; goal/G8 with twenty items holding `elsewhere` of his lines; box
// versions, a line of the agent's, a Q, a file, a claim, a line in the group chat; and the goal-less rows the migration
// dumps: agent.state, scope.set, and one row of the old lines table, each with a marker found nowhere else.
function makeOldDesk(d, elsewhere) {
  const db = new DatabaseSync(d.db);
  db.exec('CREATE TABLE records (n INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, verb TEXT NOT NULL, by TEXT NOT NULL, body TEXT NOT NULL, key TEXT NOT NULL DEFAULT \'\');' +
    'CREATE TABLE lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);');
  const add = db.prepare('INSERT INTO records (at, verb, by, key, body) VALUES (?, ?, ?, ?, ?)');
  let t = Date.parse('2026-10-01T00:00:00.000Z');
  const rec = function (verb, who, body) { t += 1000; add.run(new Date(t).toISOString(), verb, who.label, who.key, JSON.stringify(body)); };
  db.exec('BEGIN');
  rec('session.set', ANDY, { session: { goal: { id: 'goal/G7', title: 'Migrated' }, items: [{ id: 'goal/G7.1', title: 'One', blocks: ['goal/G7'] }, { id: 'goal/G7.2', title: 'Two', blocks: ['goal/G7'] }] } });
  rec('goal.add', ANDY, { title: 'Elsewhere', minted: 'goal/G8' });
  for (let k = 1; k <= 20; k++) rec('item.add', ANDY, { goal: 'goal/G8', title: 'Elsewhere ' + k, minted: 'goal/G8.' + k });
  rec('box.write', ANDY, { id: 'goal/G7.1', text: 'MIGRATED-BOX-V1', version: 0 });
  rec('box.write', ANDY, { id: 'goal/G7.1', text: 'MIGRATED-BOX-V2', version: 1 });
  rec('box.write', ANDY, { id: 'goal/G7.1', text: 'MIGRATED-BOX-V3', version: 2 });
  rec('chat.add', ANDY, { id: 'goal/G7.1', text: 'MIGRATED-ANDY-LINE' });
  rec('line.take', AGENT, { id: 'goal/G7.1' });
  rec('chat.add', AGENT, { id: 'goal/G7.1', text: 'MIGRATED-AGENT-LINE' });
  rec('chat.add', ANDY, { id: 'desk/G0.0', text: 'MIGRATED-GROUP-LINE' });
  rec('check.add', AGENT, { id: 'goal/G7.1', kind: 'Q', words: 'Is the migration whole?', test: '' });
  rec('item.files.add', AGENT, { id: 'goal/G7.1', paths: ['spirit/test/deskTables.js'] });
  rec('press', ANDY, { id: 'goal/G7', what: 'end-design' });
  rec('press', ANDY, { id: 'goal/G7.2', what: 'go', rules: {} });
  rec('press', AGENT, { id: 'goal/G7.2', what: 'claim-done' });
  rec('agent.state', AGENT, { word: 'AGENTSTATE-MARKER' });
  rec('scope.set', ANDY, { agent: AGENT.key, scope: 'SCOPE-MARKER' });
  for (let k = 0; k < elsewhere; k++) rec('chat.add', ANDY, { id: 'goal/G8.' + (1 + (k % 20)), text: 'elsewhere line ' + k + ' of the goal that is not current, padding padding padding padding padding' });
  db.prepare('INSERT INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)').run('old-1', '2026-09-01T00:00:00.000Z', '', 'andy', 'note', 'LINES-MARKER',
    JSON.stringify({ key: 'old-1', at: '2026-09-01T00:00:00.000Z', from: 'andy', kind: 'note', text: 'LINES-MARKER' }));
  db.exec('COMMIT');
  db.close();
}

// ── 1, 2, 3, 4 AND 8: ONE FRESH DESK ───────────────────────────────────────────────────────────────────────────────
async function freshDesk() {
  const A = deskAt('fresh');
  if (!await A.start({})) { test.fail('the world: the fresh desk did not start: ' + short(A.err)); return; }
  const g = await A.call('goal.add', { title: 'Tables' }, ANDY);
  const gid = took(g) ? String(g.body.id) : '';
  await A.call('press', { id: gid, what: 'make-current' }, ANDY);
  const i = await A.call('item.add', { goal: gid, title: 'Keyed' }, ANDY);
  const iid = took(i) ? String(i.body.id) : '';
  const gn = numbersOf(gid);
  const inn = numbersOf(iid);
  if (gn && inn && inn[0] === gn[0] && gn[1] === 0 && inn[1] > 0) test.check('the world: goal.add and item.add answer goal/G<n> and goal/G<n>.<m>');
  else { test.fail('the world: goal.add answered ' + short(g.body) + ', item.add ' + short(i.body)); await A.stop(); return; }
  const N = gn[0];
  const M = inn[1];
  // The writes every table should hold: two box versions, his line and the agent's answer, a claim, a Q, two files.
  await A.call('box.write', { id: iid, text: 'BOX-ONE', version: 0 }, ANDY);
  await A.call('box.write', { id: iid, text: 'BOX-TWO', version: 1 }, ANDY);
  await A.call('chat.add', { id: iid, text: 'TABLES-ANDY-LINE' }, ANDY);
  await A.call('line.take', { id: iid }, AGENT);
  await A.call('chat.add', { id: iid, text: 'TABLES-AGENT-LINE' }, AGENT);
  await A.call('press', { id: gid, what: 'end-design' }, ANDY);
  await A.call('press', { id: iid, what: 'end-design' }, ANDY);
  await A.call('press', { id: iid, what: 'go' }, ANDY);
  const claim = await A.call('claim', { id: iid, phase: 'build', commit: 'abcdef1' }, AGENT);
  if (!took(claim)) test.comment('the claim answered ' + short(claim.body));
  await A.call('check.add', { id: iid, kind: 'Q', words: 'Is the table keyed?', test: '' }, AGENT);
  const core = ['spirit/run/js/kernel.js', 'spirit/run/js/relay.js', 'spirit/run/js/appServer.js'].filter(function (p) { return coreFiles.isCore(p) === true; })[0] || '';
  await A.call('item.files.add', { id: iid, paths: [core, 'spirit/test/deskTables.js'] }, AGENT);

  test.subHeading('1. the database holds keyed tables, each row with its creator, and no log of writes');
  const seen = withDb(A, function (db) {
    const t = tablesOf(db);
    const roles = {};
    ['items', 'chat', 'files', 'box', 'checks', 'claims'].forEach(function (r) { roles[r] = roleTable(t, r); });
    const at = function (r, goal, item) { return roles[r] ? rowsAt(db, roles[r], goal, item) : []; };
    const blankCreators = Object.keys(roles).filter(function (r) { return roles[r]; }).map(function (r) {
      const tb = roles[r];
      return tb.creator ? { role: r, blank: Number(db.prepare('SELECT COUNT(*) AS c FROM ' + q(tb.name) + ' WHERE ' + q(tb.creator) + " IS NULL OR " + q(tb.creator) + " = ''").get().c) } : { role: r, blank: -1 };
    });
    const typed = roles.items ? db.prepare('SELECT typeof(' + q(roles.items.goal) + ') AS g, typeof(' + q(roles.items.item) + ') AS i FROM ' + q(roles.items.name) + ' WHERE ' + q(roles.items.goal) + ' = ? AND ' + q(roles.items.item) + ' = ?').get(N, M) : null;
    return { tables: t, roles: roles, blankCreators: blankCreators, typed: typed,
      goalRow: at('items', N, 0), itemRow: at('items', N, M), box: at('box', N, M), chat: at('chat', N, M), files: at('files', N, M), checks: at('checks', N, M), claims: at('claims', N, M) };
  });
  if (seen.error) { test.fail(OWED + 'the database could not be read: ' + seen.error); await A.stop(); return; }
  const names = Object.keys(seen.tables);
  if (names.indexOf('records') === -1 && names.indexOf('lines') === -1) test.check('there is no records log and no lines table');
  else test.fail(OWED + 'the log of writes is still kept: the tables are ' + short(names));
  const missing = Object.keys(seen.roles).filter(function (r) { return !seen.roles[r]; });
  if (!missing.length) test.check('keyed tables for goals and items, chat, files, box, checks and claims, each keyed by goal and item');
  else test.fail(OWED + 'no table keyed by goal and item for ' + missing.join(', ') + '; the tables are ' + short(names));
  const noCreator = seen.blankCreators.filter(function (x) { return x.blank !== 0; });
  if (!missing.length && !noCreator.length) test.check('every row of every keyed table carries its creator');
  else test.fail(OWED + 'rows without a creator: ' + short(noCreator.length ? noCreator : 'no keyed tables to read'));
  if (seen.goalRow.length === 1 && seen.itemRow.length === 1) test.check('the goal is the row (n, 0), its item the row (n, m)');
  else test.fail(OWED + 'rows for the goal ' + short(seen.goalRow) + ', for the item ' + short(seen.itemRow));
  const versions = seen.box.map(function (r) { return JSON.stringify(r); });
  if (seen.box.length === 2 && versions.some(function (v) { return v.indexOf('BOX-ONE') !== -1; }) && versions.some(function (v) { return v.indexOf('BOX-TWO') !== -1; })) test.check('the box is one row per version');
  else test.fail(OWED + 'the box rows of the item are ' + short(seen.box));
  const cr = seen.roles.chat && seen.roles.chat.creator;
  const andyLine = seen.chat.filter(function (r) { return JSON.stringify(r).indexOf('TABLES-ANDY-LINE') !== -1; })[0];
  const agentLine = seen.chat.filter(function (r) { return JSON.stringify(r).indexOf('TABLES-AGENT-LINE') !== -1; })[0];
  if (andyLine && agentLine && cr && andyLine[cr] && agentLine[cr] && andyLine[cr] !== agentLine[cr]) test.check('each chat line is a row of the item with its own writer');
  else test.fail(OWED + 'the chat rows of the item are ' + short(seen.chat));
  if (seen.checks.length >= 1 && seen.claims.length >= 1) test.check('the Q and the claim are rows of the item');
  else test.fail(OWED + 'check rows ' + short(seen.checks) + ', claim rows ' + short(seen.claims));
  const gcol = seen.roles.files && seen.roles.files.grant;
  const coreRow = seen.files.filter(function (r) { return core && JSON.stringify(r).indexOf(core) !== -1; })[0];
  const plainRow = seen.files.filter(function (r) { return JSON.stringify(r).indexOf('spirit/test/deskTables.js') !== -1; })[0];
  if (gcol && coreRow && plainRow && String(coreRow[gcol]) !== String(plainRow[gcol])) test.check('each file row holds its grant status: the core file\'s is not the plain file\'s');
  else test.fail(OWED + 'the file rows are ' + short(seen.files) + (gcol ? '' : ' (no grant column)'));
  await A.call('check.set', { id: iid, check: 'all', state: 'granted' }, ANDY);
  const granted = withDb(A, function (db) { const t = roleTable(tablesOf(db), 'files'); return t ? rowsAt(db, t, N, M) : []; });
  const coreAfter = Array.isArray(granted) ? granted.filter(function (r) { return core && JSON.stringify(r).indexOf(core) !== -1; })[0] : null;
  if (gcol && coreRow && coreAfter && String(coreAfter[gcol]) !== String(coreRow[gcol])) test.check('his grant changes the core file\'s grant status in its row');
  else test.fail(OWED + 'after his grant the core file\'s row reads ' + short(coreAfter));
  if (seen.typed && seen.typed.g === 'integer' && seen.typed.i === 'integer') test.check('goal and item are stored as numbers');
  else test.fail(OWED + 'the item row\'s keys are typed ' + short(seen.typed));
  // Only the chat grows by a chat line: no other table, no log.
  const c0 = countsOf(A);
  for (let k = 0; k < 3; k++) await A.call('chat.add', { id: iid, text: 'GROW-LINE ' + k }, ANDY);
  const c1 = countsOf(A);
  const g1 = grown(c0, c1);
  const chatName = seen.roles.chat ? seen.roles.chat.name : '';
  if (chatName && Object.keys(g1).length === 1 && g1[chatName] === 3) test.check('three chat lines grow the chat table by three rows and nothing else');
  else test.fail(OWED + 'three chat lines grew ' + short(g1));
  // An agent's word is one current value: no row per word.
  await A.call('agent.state', { word: 'working' }, AGENT);
  const s0 = countsOf(A);
  for (const w of ['listening', 'working', 'listening', 'working']) await A.call('agent.state', { word: w }, AGENT);
  const s1 = countsOf(A);
  const g2 = grown(s0, s1);
  if (!Object.keys(g2).length) test.check('four more agent words leave no row behind: one current value per agent');
  else test.fail(OWED + 'four agent words grew ' + short(g2));
  const goalFacts = await A.facts(gid);
  if (goalFacts && Array.isArray(goalFacts.working) && goalFacts.working.indexOf(AGENT.label) !== -1) test.check('guard: the goal row still says the agent is working, from its current value');
  else test.fail(OWED + 'the goal row\'s working reads ' + short(goalFacts && goalFacts.working));

  test.subHeading('2. ids are rendered from two numbers; no sub-goal can be made');
  const f = await A.facts(iid);
  if (f && f.id === iid && f.goal === gid) test.check('the item reads as goal/G<n>.<m> of goal/G<n>');
  else test.fail(OWED + 'the item reads ' + short(f));
  const sg = await A.call('goal.add', { title: 'Split' }, ANDY);
  const sgid = took(sg) ? String(sg.body.id) : '';
  const sx = await A.call('item.add', { goal: sgid, title: 'Split me' }, ANDY);
  const sy = await A.call('item.add', { goal: sgid, title: 'Beside it' }, ANDY);
  const sxid = took(sx) ? String(sx.body.id) : '';
  const syid = took(sy) ? String(sy.body.id) : '';
  const nsn = numbersOf(syid);
  const fresh = nsn ? 'goal/G' + nsn[0] + '.' + (nsn[1] + 1) : '';
  await A.call('session.set', { json: JSON.stringify({ goal: { id: sgid, title: 'Split' }, split: [sxid],
    items: [{ id: sxid, title: 'Split me', blocks: [sgid] }, { id: syid, title: 'Beside it', blocks: [sgid] }, { id: fresh, title: 'Split off', blocks: [sxid] }] }) }, ANDY);
  const split = await A.facts(sxid);
  if (split && split.subGoal !== true && split.codeOffered === true) test.check('a split leaves the item an item: no sub-goal, its Code toggle still offered');
  else test.fail(OWED + 'after a split the item reads subGoal ' + short(split && split.subGoal) + ', codeOffered ' + short(split && split.codeOffered));

  test.subHeading('3. design mode on goal and item level; a new item arrives in design mode');
  const dg = await A.call('goal.add', { title: 'Design' }, ANDY);
  const dgid = took(dg) ? String(dg.body.id) : '';
  await A.call('press', { id: dgid, what: 'end-design' }, ANDY);
  const dx = await A.call('item.add', { goal: dgid, title: 'Built first' }, ANDY);
  const dy = await A.call('item.add', { goal: dgid, title: 'Still designed' }, ANDY);
  const dxid = took(dx) ? String(dx.body.id) : '';
  const dyid = took(dy) ? String(dy.body.id) : '';
  const fx0 = await A.facts(dxid);
  const fg0 = await A.facts(dgid);
  if (fg0 && fg0.design === false && fx0 && fx0.design === true) test.check('in a goal out of design, a new item arrives in design mode');
  else test.fail(OWED + 'the goal reads design ' + short(fg0 && fg0.design) + ', its new item ' + short(fx0 && fx0.design));
  await A.call('press', { id: dxid, what: 'end-design' }, ANDY);
  const go = await A.call('press', { id: dxid, what: 'go' }, ANDY);
  const fx1 = await A.facts(dxid);
  const fy1 = await A.facts(dyid);
  if (took(go) && fx1 && fx1.design === false && fy1 && fy1.design === true && (fy1.buttons || []).indexOf('go') === -1) test.check('one item ends its design and goes while the other of the goal stays in design, with no Go');
  else test.fail(OWED + 'the go answered ' + short(go.body) + '; the built item reads design ' + short(fx1 && fx1.design) + ', the other design ' + short(fy1 && fy1.design) + ' and buttons ' + short(fy1 && fy1.buttons));

  test.subHeading('4. goal 0 is the group chat; special goals have numbers of their own and stay open');
  let groupAt = '';
  for (const id of ['goal/G0', 'goal/G0.0', 'desk/G0.0']) {
    const r = await A.call('chat.add', { id: id, text: 'TABLES-GROUP-LINE' }, ANDY);
    if (took(r)) { groupAt = id; break; }
  }
  const group = withDb(A, function (db) {
    const t = tablesOf(db);
    const chat = roleTable(t, 'chat');
    const items = roleTable(t, 'items');
    return { chat: chat ? db.prepare('SELECT * FROM ' + q(chat.name) + ' WHERE ' + q(chat.goal) + ' = 0').all() : null,
      zero: items ? rowsAt(db, items, 0, 0) : null, special: items ? items.special : '' };
  });
  const inZero = group && Array.isArray(group.chat) && group.chat.some(function (r) { return JSON.stringify(r).indexOf('TABLES-GROUP-LINE') !== -1; });
  if (groupAt && inZero) test.check('a line in the group chat is a chat row of goal 0');
  else test.fail(OWED + 'the group chat line went to ' + short(groupAt || 'no id taken') + '; goal 0\'s chat rows are ' + short(group && (group.error || group.chat)));
  if (group && group.special && Array.isArray(group.zero) && group.zero.length === 1 && group.zero[0][group.special]) test.check('goal 0\'s row is marked special');
  else test.fail(OWED + 'goal 0\'s row reads ' + short(group && (group.error || group.zero)) + (group && group.special ? '' : ' (no special column)'));
  const goals = await A.search({ goalsOnly: true, includeClosed: true });
  const plugins = goals.filter(function (x) { return x && x.plugin; });
  const badIds = plugins.filter(function (x) { const n = numbersOf(x.id); return !n || n[0] === 0 || n[1] !== 0; }).map(function (x) { return x.id; });
  if (plugins.length && !badIds.length) test.check('each plugin goal has a goal number of its own: goal/G<n>, n not 0');
  else test.fail(OWED + 'the plugin goals read ' + short(plugins.length ? badIds : 'none found'));
  const closedSpecial = plugins.filter(function (x) { return x.status === 'closed'; }).map(function (x) { return x.id; });
  const specialRows = withDb(A, function (db) {
    const items = roleTable(tablesOf(db), 'items');
    return items && items.special ? plugins.map(function (x) { const n = numbersOf(x.id); return n ? rowsAt(db, items, n[0], 0).filter(function (r) { return r[items.special]; }).length : 0; }) : null;
  });
  if (plugins.length && !closedSpecial.length && Array.isArray(specialRows) && specialRows.every(function (k) { return k === 1; })) test.check('each plugin goal\'s row is marked special, and it stays open');
  else test.fail(OWED + 'plugin goals closed: ' + short(closedSpecial) + '; their special rows ' + short(specialRows));

  test.subHeading('8. push: each changed row on its own under PAYLOAD_MAX, a large row in numbered pieces, a current goal whole');
  let n0 = published.length;
  await A.call('chat.add', { id: iid, text: 'PUSH-LINE' }, ANDY);
  await settle();
  const linePubs = published.slice(n0).filter(function (p) { return holds(p, 'PUSH-LINE'); });
  if (linePubs.length && linePubs.every(function (p) { return namesRow(p, N, M) && bytesOf(p) <= PAYLOAD_MAX && !holds(p, 'BOX-TWO'); })) test.check('a chat line is pushed as its row, naming goal and item, under PAYLOAD_MAX, without the item\'s other tables');
  else test.fail(OWED + 'the line was pushed ' + short(linePubs.length ? linePubs.map(function (p) { return { namesGoalAndItem: namesRow(p, N, M), bytes: bytesOf(p), withBox: holds(p, 'BOX-TWO'), keys: Object.keys(p) }; }) : 'nowhere'));
  // A box a little over PAYLOAD_MAX, every run of it unique, so each piece is found where it belongs. It is the largest
  // box one write can carry (the door takes a request up to PAYLOAD_MAX and some headroom), and still more than one push
  // can: so its row must travel in pieces. How a box larger than one request gets written is not this red's.
  let big = '';
  for (let k = 0; big.length < PAYLOAD_MAX + 200; k++) big += 'BIGBOX' + k.toString(36) + '.' + (k * 7919 % 100003).toString(36) + ' ';
  big = big.slice(0, PAYLOAD_MAX + 200);
  n0 = published.length;
  const wrote = await A.call('box.write', { id: iid, text: big, version: 2 }, ANDY);
  await settle(1500);
  const after = published.slice(n0);
  const pieces = [];
  after.forEach(function (p, at) {
    each(p, function (o) {
      Object.keys(o).forEach(function (k) {
        if (typeof o[k] !== 'string' || o[k].length < 64 || big.indexOf(o[k]) === -1) return;
        const num = ['piece', 'part', 'chunk', 'index', 'seq', 'n'].map(function (f) { return o[f]; }).filter(function (v) { return typeof v === 'number'; })[0];
        pieces.push({ at: at, n: num, text: o[k] });
      });
    });
  });
  const numbered = pieces.length && pieces.every(function (x) { return typeof x.n === 'number'; });
  const joined = pieces.slice().sort(function (x, y) { return numbered ? x.n - y.n : x.at - y.at; }).map(function (x) { return x.text; }).join('');
  if (took(wrote) && pieces.length >= 2 && numbered && joined === big && !overMax(after).length) test.check('a box over PAYLOAD_MAX is taken and pushed in numbered pieces, each under it, that join to the box');
  else test.fail(OWED + 'the large box answered ' + short(wrote.body) + '; ' + pieces.length + ' pieces, numbered ' + !!numbered + ', joined ' + (joined === big) + ', over the limit ' + overMax(after).length);
  // A goal becoming current is pushed whole: every item's row, its box and its chat.
  const pg = await A.call('goal.add', { title: 'Pushed' }, ANDY);
  const pgid = took(pg) ? String(pg.body.id) : '';
  const p1 = await A.call('item.add', { goal: pgid, title: 'Pushed one' }, ANDY);
  const p2 = await A.call('item.add', { goal: pgid, title: 'Pushed two' }, ANDY);
  const p1id = took(p1) ? String(p1.body.id) : '';
  const p2id = took(p2) ? String(p2.body.id) : '';
  await A.call('box.write', { id: p1id, text: 'P-BOX', version: 0 }, ANDY);
  await A.call('chat.add', { id: p2id, text: 'P-LINE' }, ANDY);
  const whole = function (pubs) {
    const want = [pgid, p1id, p2id].map(numbersOf).filter(Boolean);
    const rows = want.filter(function (k) { return pubs.some(function (p) { return namesRow(p, k[0], k[1]); }); }).length;
    return { rows: rows + '/' + want.length, box: pubs.some(function (p) { return holds(p, 'P-BOX'); }), line: pubs.some(function (p) { return holds(p, 'P-LINE'); }), over: overMax(pubs).length, ok: want.length === 3 && rows === 3 };
  };
  await settle(300);
  n0 = published.length;
  await A.call('press', { id: pgid, what: 'make-current' }, ANDY);
  await settle(1500);
  const madeCurrent = whole(published.slice(n0));
  if (madeCurrent.ok && madeCurrent.box && madeCurrent.line && !madeCurrent.over) test.check('a goal made current is pushed whole: every item\'s row, its box and its chat, each under PAYLOAD_MAX');
  else test.fail(OWED + 'making the goal current pushed ' + short(madeCurrent));
  // A client that was away: after the desk's own restart every client is one, and the current goal comes whole again.
  await A.stop();
  n0 = published.length;
  if (!await A.start({})) { test.fail('the world: the fresh desk did not start again: ' + short(A.err)); return; }
  await settle(3000);
  const again = whole(published.slice(n0));
  if (again.ok && again.box && again.line && !again.over) test.check('after the desk is back, the current goal is pushed whole again, unasked');
  else test.fail(OWED + 'after the restart the desk pushed ' + short(again));
  await A.stop();
}

// ── 5 AND 6: MIGRATION, AND A SEARCH BOUNDED BY ITS GOAL ───────────────────────────────────────────────────────────
async function timeSearches(d) {
  const lists = [];
  const chats = [];
  for (let k = 0; k < 9; k++) {
    let t0 = process.hrtime.bigint();
    await d.call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, ANDY);
    lists.push(Number(process.hrtime.bigint() - t0) / 1e6);
    t0 = process.hrtime.bigint();
    await d.call('chat.search', { id: 'goal/G7.1', text: '', by: '', since: '', before: '', scope: '' }, ANDY);
    chats.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return { list: median(lists), chat: median(chats) };
}
async function migration() {
  const S = deskAt('migrated');
  makeOldDesk(S, 10);
  test.subHeading('5. today\'s database is migrated once into the tables');
  if (!await S.start({})) { test.fail(OWED + 'the desk did not start on an old-shape database: ' + short(S.err)); return null; }
  const seen = withDb(S, function (db) {
    const t = tablesOf(db);
    const items = roleTable(t, 'items');
    const at = function (r, g, i) { const tb = roleTable(t, r); return tb ? rowsAt(db, tb, g, i) : null; };
    // Every text the database still holds, read whole once (the migrated desk is small).
    let all = '';
    Object.keys(t).forEach(function (k) { db.prepare('SELECT * FROM ' + q(k)).all().forEach(function (r) { all += JSON.stringify(r) + '\n'; }); });
    return { names: Object.keys(t), goal: at('items', 7, 0), one: at('items', 7, 1), two: at('items', 7, 2), box: at('box', 7, 1), chat: at('chat', 7, 1),
      group: at('chat', 0, 0), checks: at('checks', 7, 1), files: at('files', 7, 1), claims: at('claims', 7, 2),
      typed: items ? db.prepare('SELECT typeof(' + q(items.goal) + ') AS g, typeof(' + q(items.item) + ') AS i FROM ' + q(items.name) + ' WHERE ' + q(items.goal) + ' = 7 AND ' + q(items.item) + ' = 1').get() : null,
      markers: ['AGENTSTATE-MARKER', 'SCOPE-MARKER', 'LINES-MARKER'].filter(function (m) { return all.indexOf(m) !== -1; }) };
  });
  if (seen.error) { test.fail(OWED + 'the migrated database could not be read: ' + seen.error); return S; }
  if (seen.names.indexOf('records') === -1 && seen.names.indexOf('lines') === -1) test.check('after the migration there is no records log and no lines table');
  else test.fail(OWED + 'after the migration the tables are ' + short(seen.names));
  const len = function (x) { return Array.isArray(x) ? x.length : -1; };
  if (len(seen.goal) === 1 && len(seen.one) === 1 && len(seen.two) === 1 && seen.typed && seen.typed.g === 'integer' && seen.typed.i === 'integer') test.check('goal/G7, goal/G7.1 and goal/G7.2 became the rows (7, 0), (7, 1), (7, 2), stored as numbers');
  else test.fail(OWED + 'the migrated rows read goal ' + short(seen.goal) + ', item one ' + short(seen.one) + ', typed ' + short(seen.typed));
  const boxText = JSON.stringify(seen.box || []);
  if (len(seen.box) >= 1 && boxText.indexOf('MIGRATED-BOX-V3') !== -1) test.check('the newest box version is a row of (7, 1)');
  else test.fail(OWED + 'the box rows of (7, 1) are ' + short(seen.box));
  const chatText = JSON.stringify(seen.chat || []);
  if (chatText.indexOf('MIGRATED-ANDY-LINE') !== -1 && chatText.indexOf('MIGRATED-AGENT-LINE') !== -1 && JSON.stringify(seen.group || []).indexOf('MIGRATED-GROUP-LINE') !== -1) test.check('the chat lines kept their item, the group chat\'s went to goal 0');
  else test.fail(OWED + 'the chat rows of (7, 1) are ' + short(seen.chat) + '; of goal 0 ' + short(seen.group));
  if (len(seen.checks) >= 1 && len(seen.files) >= 1 && len(seen.claims) >= 1) test.check('the Q, the file and the claim kept their items');
  else test.fail(OWED + 'checks ' + short(seen.checks) + ', files ' + short(seen.files) + ', claims ' + short(seen.claims));
  if (!seen.markers.length) test.check('agent.state, scope.set and the old lines table are dumped');
  else test.fail(OWED + 'the database still holds ' + seen.markers.join(', '));
  const box = await S.call('item.box', { id: 'goal/G7.1' }, ANDY);
  const cur = await S.search({ currentGoalOnly: true, goalsOnly: true });
  if (took(box) && box.body.box === 'MIGRATED-BOX-V3' && box.body.version === 3 && cur[0] && cur[0].id === 'goal/G7') test.check('guard: goal/G7.1 reads its newest box, version 3, and goal/G7 is still the current goal');
  else test.fail(OWED + 'item.box answered ' + short(box.body) + ', the current goal ' + short(cur[0] && cur[0].id));
  return S;
}
async function bounded(S) {
  test.subHeading('6. a current-goal search does not grow with the other goals');
  const small = await timeSearches(S);
  await S.stop();
  const L = deskAt('large');
  makeOldDesk(L, 40000);
  if (!await L.start({})) { test.fail(OWED + 'the desk did not start on a large old-shape database: ' + short(L.err)); return; }
  const rows = await L.search({ currentGoalOnly: true });
  const large = await timeSearches(L);
  await L.stop();
  test.comment('median ms, 10 lines elsewhere: list ' + small.list.toFixed(1) + ', chat ' + small.chat.toFixed(1) + '; 40000 lines elsewhere: list ' + large.list.toFixed(1) + ', chat ' + large.chat.toFixed(1));
  if (!rows.some(function (r) { return r.id === 'goal/G7.1'; })) test.fail('the world: the large desk\'s current-goal search did not answer goal/G7.1: ' + short(rows));
  // Bounded: forty thousand lines in another goal cost a current-goal search at most three times its time without them,
  // plus 20 ms of noise; a walk of every record costs far more.
  if (large.list <= 3 * small.list + 20) test.check('the List\'s current-goal search takes as long with 40000 lines in another goal as with 10');
  else test.fail(OWED + 'the current-goal search took ' + large.list.toFixed(1) + ' ms against ' + small.list.toFixed(1) + ' ms: it reads the other goal too');
  if (large.chat <= 3 * small.chat + 20) test.check('a chat search of a current item takes as long with 40000 lines in another goal as with 10');
  else test.fail(OWED + 'the chat search took ' + large.chat.toFixed(1) + ' ms against ' + small.chat.toFixed(1) + ' ms: it reads the other goal too');
}

// ── 7. SHEDDING ────────────────────────────────────────────────────────────────────────────────────────────────────
const BOX_BYTES = 6000;
const VERSIONS = 20;
async function fill(d, id, count) {
  for (let v = 0; v < count; v++) {
    const text = (id + ' version ' + v + ' ').repeat(Math.ceil(BOX_BYTES / 24)).slice(0, BOX_BYTES);
    await d.call('box.write', { id: id, text: text, version: v }, ANDY);
  }
}
async function goalWithItem(d, title) {
  const g = await d.call('goal.add', { title: title }, ANDY);
  const gid = took(g) ? String(g.body.id) : '';
  const i = await d.call('item.add', { goal: gid, title: title + ' item' }, ANDY);
  return { gid: gid, iid: took(i) ? String(i.body.id) : '' };
}
function rowsOfGoal(d, goal) {
  return withDb(d, function (db) {
    const t = tablesOf(db);
    let n = 0;
    Object.keys(t).forEach(function (k) { const tb = t[k]; if (tb.goal && tb.item) n += Number(db.prepare('SELECT COUNT(*) AS c FROM ' + q(k) + ' WHERE ' + q(tb.goal) + ' = ?').get(goal).c); });
    return n;
  });
}
async function shedding() {
  test.subHeading('7. the desk sheds whole goals past its size, the one untouched the longest first');
  const X = deskAt('shed');
  if (!await X.start({})) { test.fail('the world: the shedding desk did not start: ' + short(X.err)); return; }
  // A and B filled, then A touched again, so B is the one untouched the longest; C current.
  const A = await goalWithItem(X, 'Shed A');
  await fill(X, A.iid, VERSIONS);
  const B = await goalWithItem(X, 'Shed B');
  await fill(X, B.iid, VERSIONS);
  await X.call('chat.add', { id: A.iid, text: 'A is touched again' }, ANDY);
  const C = await goalWithItem(X, 'Shed C');
  await X.call('press', { id: C.gid, what: 'make-current' }, ANDY);
  await fill(X, C.iid, VERSIONS / 2);
  const full = dbBytes(X);
  await X.stop();
  if (!A.iid || !B.iid || !C.iid || typeof full !== 'number') { test.fail('the world: the goals did not land or the size did not read: ' + short({ A: A, B: B, C: C, full: full })); return; }
  const an = numbersOf(A.gid)[0];
  const bn = numbersOf(B.gid)[0];
  const cn = numbersOf(C.gid)[0];
  // Half a goal's boxes under what it holds now: one goal shed is enough.
  const bound = full - Math.floor(VERSIONS * BOX_BYTES / 2);
  test.comment('the database holds ' + full + ' bytes; the desk comes back with shedBytes ' + bound);
  if (!await X.start({ shedBytes: bound })) { test.fail(OWED + 'the desk did not start with shedBytes: ' + short(X.err)); return; }
  await X.call('chat.add', { id: C.iid, text: 'a write past the bound' }, ANDY);
  let bGone = false;
  for (let k = 0; k < 25 && !bGone; k++) { await sleep(200); bGone = !(await X.facts(B.gid)) && !(await X.facts(B.iid)); }
  const aThere = !!(await X.facts(A.gid)) && !!(await X.facts(A.iid));
  const bRows = rowsOfGoal(X, bn);
  if (bGone && bRows === 0) test.check('past the bound, goal B, untouched the longest, is gone whole: its goal, its item, every row of theirs');
  else test.fail(OWED + 'past the bound B ' + (bGone ? 'is gone from the verbs' : 'is still there') + ' and holds ' + short(bRows) + ' rows');
  if (aThere && bGone) test.check('goal A, touched since, stays: shedding stops once one goal is enough');
  else test.fail(OWED + 'A ' + (aThere ? 'stays' : 'is gone') + ', B ' + (bGone ? 'is gone' : 'stays'));
  await X.stop();
  // A bound nothing fits under: every goal but the current one and the special ones goes.
  if (!await X.start({ shedBytes: 1 })) { test.fail(OWED + 'the desk did not start with shedBytes 1: ' + short(X.err)); return; }
  const before = await X.search({ goalsOnly: true, includeClosed: true });
  const specials = before.filter(function (x) { return x && x.plugin; }).map(function (x) { return x.id; });
  await X.call('chat.add', { id: C.iid, text: 'a write past every bound' }, ANDY);
  let aGone = false;
  for (let k = 0; k < 25 && !aGone; k++) { await sleep(200); aGone = !(await X.facts(A.gid)); }
  const box = await X.call('item.box', { id: C.iid }, ANDY);
  const left = await X.search({ goalsOnly: true, includeClosed: true });
  const specialsLeft = specials.filter(function (id) { return left.some(function (x) { return x.id === id; }); });
  const zero = rowsOfGoal(X, 0);
  if (aGone && rowsOfGoal(X, an) === 0) test.check('with a bound nothing fits under, goal A goes too');
  else test.fail(OWED + 'with shedBytes 1 goal A ' + (aGone ? 'is gone from the verbs but holds ' + short(rowsOfGoal(X, an)) + ' rows' : 'is still there'));
  if (took(box) && box.body.version === VERSIONS / 2 && rowsOfGoal(X, cn) > 0) test.check('the current goal is never shed, past the bound or not');
  else test.fail(OWED + 'the current goal\'s item answered version ' + short(box.body && box.body.version) + ', its rows ' + short(rowsOfGoal(X, cn)));
  if (specials.length && specialsLeft.length === specials.length && typeof zero === 'number' && zero > 0) test.check('the special goals are exempt: every plugin goal and goal 0 stay');
  else test.fail(OWED + 'special goals before ' + short(specials) + ', after ' + short(specialsLeft) + '; rows of goal 0 ' + short(zero));
  await X.stop();
}

(async function () {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await freshDesk();
  const S = await migration();
  if (S) await bounded(S);
  await shedding();
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  kids.forEach(function (k) { try { if (k.exitCode === null) k.kill(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  await sleep(500);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
