'use strict';

// spirit/test/deskOnServer.js
// DESK READS AND WRITES THROUGH THE DESK SERVER; ITS FILES ARE IMPORTED ONCE
// AND LEAVE THE APP FOLDER — desk/G1.4, written FIRST, red on today's code.
//
//   Andy's go on desk/G1.4, after O9: "desk creates a lot of file-clutter",
//   "SpiritOS list.load rules are probably vialoated", "lazy-fill of pages
//   seems appropriate", "the most recent 10 Kilobytes are very likely
//   enough", and "desk loads down the dependency tree ... it skips closed
//   items", "the list only loads key/title, and the rest lazy loads".
//
// THE CONTRACT (claude-windows' tests, agreed with wsl-claude before the
// build; Desk walks and folds, the server is storage plus bounded search):
//
//   THE SERVER (process/js/desk/desk.js)
//   - It never reads Desk's old files in shell/desk (cleanup/G1.6).
//   - log.search gains two filters, both '' for any: kind, and before (only
//     lines older than it); every caller sends all five keys (the helper
//     matches keys exactly, D8). todo '-' means lines with no todo (an
//     agent's direct chat). Still newest first, bounded, partial when cut (T6).
//
//   DESK (app/desk/desk.js), through api.verb('jobs.api', {ask: {desk:
//   {verb: args}}}) and never api.fs for its record:
//   - T5: it reads the newest session (log.search kind 'session') and draws
//     every open item as id and title at once; each row then fills its
//     state from log.search {todo: that id}, newest first, a next page only
//     while its state is unknown. An item the newest session no longer
//     names is closed, and is never searched.
//   - T5b: the Team chat opens with one bounded log.search {todo:
//     'team/chat'}: its newest lines; the whole log is never read.
//   - T6: scrolling #desk-team to its top asks log.search {todo:
//     'team/chat', before: <the oldest line shown>} and shows what comes.
//   - T3: what arrives is recorded by log.add; what he types by voice.add;
//     state and seen by state.set and seen.set; api.fs.saveFile is never
//     called for any of them.
//   - T7 (moved from G1.7): it asks backup's status.get and shows the last
//     check and last copy in #desk-backup, marked job-start-error when an
//     item was closed after the last check.
//
// The suites that mount Desk with a log/log.json fixture move onto
// deskFake.js (a desk server in memory) with the build.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');
const deskFake = require('./deskFake.js');

const OWED = 'OWED by desk/G1.4: ';
const G16 = 'OWED by cleanup/G1.6: ';
const SCRIPT = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwslw=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settleLong() { for (let i = 0; i < 12; i++) await settle(); }

let n = 0;
const T0 = Date.UTC(2026, 8, 20, 8, 0, 0);
function row(from, kind, text, todo, extra) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return Object.assign({ key: 'k' + String(n).padStart(4, '0'), at: new Date(T0 + n * 60000).toISOString(), dir: dir,
    peer: from === 'wsl-claude' ? WSL : LEAD, outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo }, extra || {});
}

// ── THE SERVER ────────────────────────────────────────────────────────
async function serverPart(scratch) {
  const run = path.join(scratch, 'spirit', 'run');
  const app = path.join(run, 'shell', 'desk');
  const state = path.join(run, 'relay-state', 'process', 'desk');
  fs.mkdirSync(path.join(app, 'log'), { recursive: true });
  fs.mkdirSync(path.join(app, 'voice'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  const old = [];
  for (let i = 0; i < 30; i++) old.push(row(i % 2 ? 'andy' : 'claude-windows', 'note', 'imported line ' + i, 'team/chat'));
  function plant() {
    // The import removes the emptied log/ and voice/ (T2), so a replant makes them again.
    fs.mkdirSync(path.join(app, 'log'), { recursive: true });
    fs.mkdirSync(path.join(app, 'voice'), { recursive: true });
    fs.writeFileSync(path.join(app, 'desk.js'), '// the app\n');
    fs.writeFileSync(path.join(app, 'desk.json'), '{}\n');
    fs.writeFileSync(path.join(app, 'log', 'log.json'), JSON.stringify(old.slice(0, 12)));
    fs.writeFileSync(path.join(app, 'log', 'log-1.json'), JSON.stringify(old.slice(12, 25)));
    fs.writeFileSync(path.join(app, 'log', 'log-2.json'), JSON.stringify(old.slice(25)));
    fs.writeFileSync(path.join(app, 'state.json'), JSON.stringify({ design: { on: false }, marker: 'STATE-IMPORTED' }));
    fs.writeFileSync(path.join(app, 'seen.json'), JSON.stringify({ rows: {}, team: 5, marker: 'SEEN-IMPORTED' }));
    fs.writeFileSync(path.join(app, 'voice', 'voice.jsonl'), JSON.stringify({ text: 'voice one', day: '2026-09-20' }) + '\n');
    fs.writeFileSync(path.join(app, 'voice', 'voice-2.jsonl'), JSON.stringify({ text: 'voice two', day: '2026-09-21' }) + '\n');
  }
  plant();
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(run, 'desk', 'win32', 'process') : path.join(state, 'door.sock');
  const client = appClient.createAppClient({ rootDir: run });
  client.register('desk', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r.body || {}; }); };
  async function start() {
    const kid = spawn(process.execPath, [SCRIPT, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return kid; } catch (e) { /* not yet */ }
    }
    return kid;
  }
  function stop(kid) { return new Promise(function (r) { if (kid.exitCode !== null) return r(); kid.once('exit', r); kid.kill(); }); }
  const keysOf = function (res) { return (res.items || []).map(function (i) { try { return JSON.parse(i.label).key; } catch (e) { return '?'; } }); };
  // EVERY PAGE, newest first (slim/G1.2): one answer holds what fits, and
  // `before` (the oldest line's at) asks for the next until more is false.
  async function everything() {
    let res = { items: [], more: false };
    let before = '';
    for (let page = 0; page < 20; page++) {
      const r = await call('log.search', { text: '', todo: '', since: '', kind: '', before: before });
      res.items = res.items.concat(r.items || []);
      if (!r.more || !(r.items || []).length) break;
      before = JSON.parse(r.items[r.items.length - 1].label).at;
    }
    return res;
  }

  const kid = await start();
  test.subHeading('cleanup/G1.6: the server never reads Desk\'s old files in shell/desk');
  const got = keysOf(await everything());
  const st = await call('state.get', {});
  const sn = await call('seen.get', {});
  const voiceFile = path.join(state, 'voice.jsonl');
  const imported = got.length || /IMPORTED/.test((st.json || '') + (sn.json || '')) || fs.existsSync(voiceFile);
  if (!imported) test.check('old log, state, seen and voice files planted; the server started with none of them');
  else test.fail(G16 + got.length + ' lines, state ' + JSON.stringify(st).slice(0, 60) + ', voice file ' + fs.existsSync(voiceFile));
  const planted = ['log/log.json', 'log/log-1.json', 'log/log-2.json', 'state.json', 'seen.json', 'voice/voice.jsonl', 'voice/voice-2.jsonl'];
  const gone = planted.filter(function (f) { return !fs.existsSync(path.join(app, ...f.split('/'))); });
  if (!gone.length) test.check('and deleted none of them');
  else test.fail(G16 + 'the server deleted ' + JSON.stringify(gone));
  if (!/'shell', 'desk'|shell\/desk/.test(fs.readFileSync(SCRIPT, 'utf8'))) test.check('process/js/desk/desk.js no longer names shell/desk');
  else test.fail(G16 + 'process/js/desk/desk.js still names shell/desk');

  for (const m of old) await call('log.add', { json: JSON.stringify(m) });

  test.subHeading('T6 (server): log.search filters by kind, and by before');
  await call('log.add', { json: JSON.stringify(row('claude-windows', 'session', '{"goal":{"id":"t/G1","title":"G"},"items":[]}', 'team/chat')) });
  const sessions = keysOf(await call('log.search', { text: '', todo: '', since: '', kind: 'session', before: '' }));
  const cut = old[10].at;
  const before = keysOf(await call('log.search', { text: '', todo: 'team/chat', since: '', kind: '', before: cut }));
  if (sessions.length === 1 && before.length === 10 && before[0] === old[9].key && before[9] === old[0].key) {
    test.check('kind: session finds the one session; before: finds the 10 older lines, newest first');
  } else test.fail(OWED + 'kind: ' + JSON.stringify(sessions) + ', before ' + cut + ': ' + before.length + ' lines, first ' + before[0]);

  await stop(kid);
}

// ── DESK ──────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, scrollTop: 500, scrollHeight: 1000, clientHeight: 300,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {}, scrollTo: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function mount(fake, files, saved) {
  const doc = fakeDocument();
  const loaded = [];
  load(DESK, doc).mount(fakeElement('container'), {
    fs: {
      loadFile: function (f) { loaded.push(f); return Object.prototype.hasOwnProperty.call(files, f) ? files[f] : null; },
      saveFile: function (f, c) { saved.push(f); files[f] = c; return Promise.resolve(); },
    },
    escapeHtml: kernel.core.util.escapeHtml,
    verb: fake.verb,
    onPublished: function () {}, onPacket: function (app, fn) { doc.arrive = fn; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' + Date.now() }); },
    callDialog: function () { return new Promise(function () {}); },
    armUntilElsewhere: function () {},
  });
  doc.loaded = loaded;
  return doc;
}

async function deskPart() {
  // Two sessions: the older names t/G1.1 and t/G1.2; the newest names t/G1.1
  // and t/G1.3, so t/G1.2 is closed and must never be searched.
  const s1 = JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: [
    { id: 't/G1.1', title: 'ITEM-ONE' }, { id: 't/G1.2', title: 'ITEM-TWO-CLOSED' }] });
  const s2 = JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: [
    { id: 't/G1.1', title: 'ITEM-ONE', inPlace: [{ what: 'x', where: 'a.js:1 x' }] }, { id: 't/G1.3', title: 'ITEM-THREE' }] });
  const log = [
    row('claude-windows', 'session', s1, 'team/chat'),
    row('claude-windows', 'note', 'about two', 't/G1.2'),
    row('claude-windows', 'session', s2, 'team/chat'),
    row('wsl-claude', 'note', 'IN PLACE VERIFIED t/G1.1 at abc', 't/G1.1'),
    row('claude-windows', 'ask', 'Go on one?', 't/G1.1'),
    row('wsl-claude', 'note', 'STATUS: coding', 't/G1.3'),
  ];
  // Then a long Team chat, far more than one answer holds: an approach that
  // read only the newest lines of everything would never see the ask above.
  for (let i = 0; i < 60; i++) log.push(row(i % 2 ? 'andy' : 'claude-windows', 'note', 'TEAMLINE-' + String(i).padStart(2, '0') + ' ' + 'x'.repeat(260), 'team/chat'));
  // Andy closed t/G1.2 after the backup's last check (T7).
  log.push(row('andy', 'answer', 'closed.', 't/G1.2'));

  const fake = deskFake.create(log);
  fake.backup = { lastCheck: new Date(T0 + 10 * 60000).toISOString(), lastCopy: new Date(T0 + 9 * 60000).toISOString(), lastError: '' };
  const files = {};
  const saved = [];
  // T5's List checks (drawn from the session, filled per item) retired with
  // desk/G2.6: the List is items.search's answer, in deskList.js.
  const doc = mount(fake, files, saved);
  await settleLong();
  test.subHeading('T5: nothing is read from Desk\'s folder');
  if (!doc.loaded.some(function (f) { return /^log\//.test(f) || f === 'state.json' || f === 'seen.json'; })) test.check('no log, state or seen file was read from Desk\'s folder');
  else test.fail(OWED + 'Desk still read ' + JSON.stringify(doc.loaded));

  test.subHeading('T5b: the Team chat opens with one bounded search, its newest lines');
  const team = doc.getElementById('desk-team').innerHTML;
  const teamSearches = fake.searches().filter(function (c) { return (c.args || {}).todo === 'team/chat' && !(c.args || {}).kind; });
  if (teamSearches.length === 1 && /TEAMLINE-59/.test(team) && !/TEAMLINE-00/.test(team)) test.check('one search on team/chat; the newest line shows, the oldest does not yet');
  else test.fail(OWED + teamSearches.length + ' team/chat searches; newest shown ' + /TEAMLINE-59/.test(team) + ', oldest shown ' + /TEAMLINE-00/.test(team));
  const whole = fake.searches().filter(function (c) { const a = c.args || {}; return !a.todo && !a.kind && !a.text; });
  if (fake.searches().length && !whole.length) test.check('no search without a todo or kind: the whole log is never read');
  else test.fail(OWED + (whole.length ? whole.length + ' unfiltered searches: ' + JSON.stringify(whole[0].args) : 'Desk made no searches'));

  test.subHeading('T6: scrolling Team to its top fills the next older lines');
  const shownAts = fake.lines.filter(function (m) { return m.todo === 'team/chat' && /TEAMLINE-/.test(m.text) && team.indexOf(m.text.slice(0, 11)) !== -1; }).map(function (m) { return m.at; }).sort();
  const oldestShown = shownAts[0] || '';
  const teamEl = doc.getElementById('desk-team');
  teamEl.scrollTop = 0;
  teamEl.fire('scroll', { target: teamEl, currentTarget: teamEl });
  await settleLong();
  const older = fake.searches().filter(function (c) { return (c.args || {}).todo === 'team/chat' && (c.args || {}).before; });
  const after = doc.getElementById('desk-team').innerHTML;
  // One scroll brings one page: the line just older than the oldest shown
  // (wsl-claude: 60 lines are about three pages, so TEAMLINE-00 is further).
  const nextOlder = fake.lines.filter(function (m) { return m.todo === 'team/chat' && /TEAMLINE-/.test(m.text) && m.at < oldestShown; }).map(function (m) { return m.text.slice(0, 11); }).pop() || 'none';
  if (older.length && older[0].args.before === oldestShown && team.indexOf(nextOlder) === -1 && after.indexOf(nextOlder) !== -1) test.check('a search before ' + oldestShown + ' brought ' + nextOlder + ', the next older line, in');
  else test.fail(OWED + 'after scrolling to the top: ' + older.length + ' searches with before' + (older[0] ? ' (' + older[0].args.before + ', oldest shown ' + oldestShown + ')' : '') + ', ' + nextOlder + ' shown ' + (after.indexOf(nextOlder) !== -1));

  test.subHeading('T3: what arrives, what he types and what Desk decides go to the server, never to files');
  const before = fake.lines.length;
  if (doc.arrive) doc.arrive({ from: 'wsl-claude', kind: 'note', text: 'ARRIVED-LINE', todo: 't/G1.3' }, { hash: 'arrived-1', fromKey: WSL, sentAt: new Date().toISOString() });
  const say = doc.getElementById('desk-team-say');
  say.value = 'TYPED-BY-ANDY';
  doc.getElementById('desk-team-send').fire('click', { preventDefault: function () {} });
  await settleLong();
  const added = fake.calls.filter(function (c) { return c.verb === 'log.add'; }).map(function (c) { return JSON.parse(c.args.json).text; });
  if (fake.lines.length > before && added.indexOf('ARRIVED-LINE') !== -1) test.check('an arrival was recorded by log.add');
  else test.fail(OWED + 'log.add calls: ' + JSON.stringify(added));
  // NO voice.add ANY MORE (goal/G2.1 note 8): his typed line is in the log; nothing is sent to a voice file.
  if (!fake.voice.length) test.check('his typed line went to the log alone, nothing to voice.add');
  else test.fail('OWED by goal/G2.1: the page still sends voice.add ' + JSON.stringify(fake.voice));
  const sets = fake.calls.filter(function (c) { return c.verb === 'state.set' || c.verb === 'seen.set'; });
  if (!saved.length && sets.length) test.check('state and seen went by state.set / seen.set; api.fs.saveFile was never called');
  else test.fail(OWED + 'saveFile called for ' + JSON.stringify(saved) + '; state/seen sets ' + sets.length);

  // The red mark for "an item closed after the check" read Andy's "closed."
  // line, and a close is a press since desk/G2.6: that mark waits on the desk
  // server saying when it last closed something.
  test.subHeading('T7: Desk shows the backup\'s last check and copy');
  const hhmm = function (iso) { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const bk = doc.getElementById('desk-backup').innerHTML;
  const askedBackup = fake.calls.some(function (c) { return c.server === 'backup' && c.verb === 'status.get'; });
  if (askedBackup && bk.indexOf(hhmm(fake.backup.lastCheck)) !== -1 && bk.indexOf(hhmm(fake.backup.lastCopy)) !== -1) {
    test.check('#desk-backup names the last check and copy');
  } else test.fail(OWED + 'asked backup ' + askedBackup + '; #desk-backup: ' + JSON.stringify(bk.slice(0, 200)));
}

test.startTest('desk/G1.4: Desk reads and writes through the desk server');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskonserver-'));
(async function () {
  await serverPart(scratch);
  await deskPart();
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
