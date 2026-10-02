'use strict';

// spirit/test/deskBucket.js
// THE DESK SERVER CUTS ITS ANSWERS WITH bucket.js — slim/G1.2, written FIRST,
// red on today's code.
//
//   Andy, on slim/G1.2: "Desk must adhere to standards as well. use the
//   bucket.js", and "the 182 too-big lines already stored get split once, so
//   their history shows again, but from now on the MAX_PAYLOAD applies."
//
// THE CONTRACT (claude-windows' tests, wsl-claude's build). The room is one
// answer: appClient.ANSWER_MAX - 512 bytes, measured as log.search counts a
// line (the stored line, JSON-escaped once more).
//   T1 log.search and pending.get answer through searchBucket.js in its own
//      shape, {items: [{key, label}], more}, a line being its label; cut on
//      whole items by bytes, `more` (not `partial`) telling the truth;
//      desk.js keeps no cut of its own.
//   T2 a stored line too big for the room is skipped: what is older still
//      comes back, and `more` is true.
//   T3 at start, every stored line too big for the room is split once into
//      parts, keys <key>#1, <key>#2 ..., each fitting the room, with the
//      same todo, kind and from; part i of n is at the old at minus (n - i)
//      ms, so they page in order and the last keeps the old time
//      (wsl-claude); their texts joined in order are the old text; the old
//      line is gone, and a second start splits nothing more. The parts
//      together are bigger than one answer, so they are read page by page.
//   T4 log.add refuses a line too big for the room with a declared error
//      {ok: false, code: 'line-too-large'}, status 413.
//   T5 was agents.js's own refusal of such a line before sending; it went
//      with the agents app (goal/G3.2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by slim/G1.2: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const ROOM = appClient.ANSWER_MAX - 512;
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// The standard search answer (searchBucket.js): {items: [{key, label}], more}; a line is its label.
function linesOf(r) { return ((r && r.items) || []).map(function (i) { return i.label; }); }
function cost(lineJson) { return Buffer.byteLength(JSON.stringify(lineJson), 'utf8'); }

let n = 0;
function row(todo, text, extra) {
  n += 1;
  return Object.assign({ key: 'b' + String(n).padStart(4, '0'), at: new Date(Date.UTC(2026, 8, 29, 6, 0, n)).toISOString(), dir: 'in',
    peer: 'K', outcome: 'received', from: 'claude-windows', kind: 'note', text: text, todo: todo }, extra || {});
}
function plantRows(dbFile, rows) {
  const db = new DatabaseSync(dbFile);
  db.exec('CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);');
  const ins = db.prepare('INSERT OR REPLACE INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)');
  rows.forEach(function (m) { ins.run(m.key, m.at, m.todo, m.from, m.kind, m.text, JSON.stringify(m)); });
  db.close();
}

test.startTest('slim/G1.2: the desk server cuts its answers with bucket.js');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskbucket-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const kids = [];

(async function () {
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const ask = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }); };
  const call = function (verb, args) { return ask(verb, args).then(function (r) { return r.body || {}; }); };
  async function start() {
    const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    kids.push(kid);
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return kid; } catch (e) { /* not yet */ }
    }
    return kid;
  }
  function stop(kid) { return new Promise(function (r) { if (kid.exitCode !== null) return r(); kid.once('exit', r); kid.kill(); }); }
  const all = { text: '', todo: '', since: '', kind: '', before: '' };

  // ── T3: planted before the first start ───────────────────────────────
  const small = row('t/G1.1', 'a small line before');
  const big = row('t/G1.1', 'BIG-' + 'y"'.repeat(6000) + '-END');
  const after = row('t/G1.1', 'a small line after');
  plantRows(path.join(state, 'desk.db'), [small, big, after]);
  let kid = await start();

  test.subHeading('T3: a stored line too big for one answer is split once into parts that fit');
  // THE PARTS TOGETHER ARE BIGGER THAN ONE ANSWER (wsl-claude), so T3 reads
  // every page, before the oldest line so far, as Desk does.
  async function readAll(todo) {
    const got = [];
    let before = '';
    for (let i = 0; i < 20; i++) {
      const r = await call('log.search', Object.assign({}, all, { todo: todo, before: before }));
      const page = linesOf(r).map(function (l) { return JSON.parse(l); });
      page.forEach(function (m) { got.push(m); });
      if (!r.more || !page.length) break;
      before = page[page.length - 1].at;
    }
    return got;
  }
  const got3 = await readAll('t/G1.1');
  const parts = got3.filter(function (m) { return m.key.indexOf(big.key + '#') === 0; })
    .sort(function (a, b) { return Number(a.key.split('#')[1]) - Number(b.key.split('#')[1]); });
  const joined = parts.map(function (m) { return m.text; }).join('');
  const fit = parts.every(function (m) { return cost(JSON.stringify(m)) <= ROOM && m.at <= big.at && m.todo === big.todo && m.kind === big.kind && m.from === big.from; });
  const oldGone = !got3.some(function (m) { return m.key === big.key; });
  const inOrder = parts.every(function (m, i) { return i === 0 || parts[i - 1].at < m.at; }) && parts.length && parts[parts.length - 1].at === big.at;
  if (parts.length >= 2 && joined === big.text && fit && oldGone && inOrder) test.check('the big line came back as ' + parts.length + ' parts, each fitting, together its whole text');
  else test.fail(OWED + parts.length + ' parts, text whole ' + (joined === big.text) + ', each fits ' + fit + ', old line gone ' + oldGone + ', times in order ending at the old one ' + inOrder);

  await stop(kid);
  kid = await start();
  const got3b = await readAll('t/G1.1');
  if (got3b.length === got3.length && got3.length >= 4) test.check('a second start splits nothing more: still ' + got3b.length + ' lines');
  else test.fail(OWED + 'after a second start ' + got3b.length + ' lines, before ' + got3.length);

  // ── T2: an oversized line that got in some other way ─────────────────
  test.subHeading('T2: a line too big for one answer never stops a read');
  await stop(kid);
  const olderT2 = row('t/G1.2', 'older than the big one');
  const bigT2 = row('t/G1.2', 'Z'.repeat(ROOM + 500));
  const newerT2 = row('t/G1.2', 'newer than the big one');
  plantRows(path.join(state, 'desk.db'), [olderT2, newerT2]);
  kid = await start();
  // Only now, with the server up, so no start splits it (wsl-claude).
  plantRows(path.join(state, 'desk.db'), [bigT2]);
  const r2 = await call('log.search', Object.assign({}, all, { todo: 't/G1.2' }));
  const keys2 = linesOf(r2).map(function (l) { return JSON.parse(l).key; });
  if (keys2.indexOf(newerT2.key) !== -1 && keys2.indexOf(olderT2.key) !== -1 && keys2.indexOf(bigT2.key) === -1 && r2.more === true) {
    test.check('the newer and the older line both come back, the big one is skipped, and more is true');
  } else test.fail(OWED + 'keys ' + JSON.stringify(keys2) + ', more ' + JSON.stringify(r2.more));

  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: log.search and pending.get answer through searchBucket.js, with more');
  for (let i = 0; i < 40; i++) await call('log.add', { json: JSON.stringify(row('t/G1.3', 'filler ' + i + ' ' + 'w'.repeat(300))) });
  const r1 = await call('log.search', Object.assign({}, all, { todo: 't/G1.3' }));
  const p1 = await call('pending.get', { who: 'andy' });
  const bytes = linesOf(r1).reduce(function (s, l) { return s + cost(l); }, 0);
  const src = fs.readFileSync(DESK, 'utf8');
  const usesBucket = /require\([^)]*searchBucket/.test(src);
  const handCut = /ANSWER_ROOM\)\s*\{\s*partial\s*=\s*true/.test(src);
  if (r1.more === true && !('partial' in r1) && typeof p1.more === 'boolean' && !('partial' in p1) && bytes <= ROOM && linesOf(r1).length > 0 && usesBucket && !handCut) {
    test.check('cut at ' + linesOf(r1).length + ' whole lines within one answer, more says so; pending.get answers more too; desk.js uses searchBucket and cuts nothing itself');
  } else test.fail(OWED + 'more ' + JSON.stringify(r1.more) + ', partial present ' + ('partial' in r1) + ', pending more ' + JSON.stringify(p1.more) +
    ', bytes ' + bytes + '/' + ROOM + ', requires searchBucket ' + usesBucket + ', hand cut left ' + handCut);

  // ── T4 ──────────────────────────────────────────────────────────────
  test.subHeading('T4: log.add refuses a line too big for one answer, by name');
  const r4 = await ask('log.add', { json: JSON.stringify(row('t/G1.4', 'Q'.repeat(ROOM + 100))) });
  if (r4.status === 413 && r4.body && r4.body.ok === false && r4.body.code === 'line-too-large') test.check('413, line-too-large');
  else test.fail(OWED + 'log.add of a too-big line answered ' + r4.status + ' ' + JSON.stringify(r4.body).slice(0, 160));
  await stop(kid);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
