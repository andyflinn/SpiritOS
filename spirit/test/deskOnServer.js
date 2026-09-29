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
//   - At start it imports what Desk kept in its own folder, <run>/app/desk/
//     (<run> is --state's great-grandparent: relay-state/process/desk):
//     every row of log/log*.json into lines, state.json and seen.json into
//     state and seen, every voice/voice*.jsonl appended to <state>/
//     voice.jsonl. Then those files are gone from app/desk; desk.js and
//     desk.json stay. Importing the same rows again adds nothing (T1, T2, T4).
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
const SCRIPT = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
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
  const app = path.join(run, 'app', 'desk');
  const state = path.join(run, 'relay-state', 'process', 'desk');
  fs.mkdirSync(path.join(app, 'log'), { recursive: true });
  fs.mkdirSync(path.join(app, 'voice'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  const old = [];
  for (let i = 0; i < 30; i++) old.push(row(i % 2 ? 'andy' : 'claude-windows', 'note', 'imported line ' + i, 'team/chat'));
  function plant() {
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
  const keysOf = function (res) { return (res.lines || []).map(function (l) { try { return JSON.parse(l).key; } catch (e) { return '?'; } }); };

  let kid = await start();
  test.subHeading('T1: every old log row is imported once (count, first, last)');
  const all = await call('log.search', { text: '', todo: '', since: '', kind: '', before: '' });
  const got = keysOf(all);
  if (got.length === old.length && got[0] === old[old.length - 1].key && got[got.length - 1] === old[0].key) {
    test.check('all ' + old.length + ' rows from log.json, log-1.json and log-2.json, newest ' + got[0] + ', oldest ' + got[got.length - 1]);
  } else test.fail(OWED + 'log.search holds ' + got.length + ' of ' + old.length + ': ' + JSON.stringify(got.slice(0, 3)) + '…');

  test.subHeading('T2: app/desk holds no data files afterwards');
  const left = fs.readdirSync(app).sort();
  if (JSON.stringify(left) === JSON.stringify(['desk.js', 'desk.json'])) test.check('app/desk holds desk.js and desk.json, nothing else');
  else test.fail(OWED + 'app/desk still holds ' + JSON.stringify(left));

  test.subHeading('state.json and seen.json are the server\'s state and seen');
  const st = await call('state.get', {});
  const sn = await call('seen.get', {});
  if (/STATE-IMPORTED/.test(st.json || '') && /SEEN-IMPORTED/.test(sn.json || '')) test.check('state.get and seen.get answer what the files held');
  else test.fail(OWED + 'state.get ' + JSON.stringify(st).slice(0, 80) + ', seen.get ' + JSON.stringify(sn).slice(0, 80));

  test.subHeading('T4: the voice is a plain file in the desk server\'s state folder');
  const voice = (function () { try { return fs.readFileSync(path.join(state, 'voice.jsonl'), 'utf8'); } catch (e) { return ''; } })();
  if (/voice one[\s\S]*voice two/.test(voice)) test.check('<state>/voice.jsonl holds both voice files\' lines, in order');
  else test.fail(OWED + '<state>/voice.jsonl holds ' + JSON.stringify(voice.slice(0, 120)));

  test.subHeading('T1: importing the same rows again adds nothing');
  await stop(kid);
  plant();
  kid = await start();
  const again = keysOf(await call('log.search', { text: '', todo: '', since: '', kind: '', before: '' }));
  if (again.length === old.length) test.check('the same files planted and imported again: still ' + old.length + ' rows');
  else test.fail(OWED + 'after a second import: ' + again.length + ' rows');

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
    onPacket: function (app, fn) { doc.arrive = fn; },
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
  // The item searches wait, so the List can be seen before they answer.
  fake.hold(function (c) { return c.verb === 'log.search' && /^t\/G1\.\d/.test((c.args || {}).todo || ''); });
  const doc = mount(fake, files, saved);
  await settleLong();

  test.subHeading('T5: the List shows each open item\'s id and title before its lines arrive');
  const early = doc.getElementById('desk-top').innerHTML;
  if (/ITEM-ONE/.test(early) && /ITEM-THREE/.test(early) && !/ITEM-TWO-CLOSED/.test(early)) test.check('t/G1.1 and t/G1.3 are drawn from the session at once; the closed t/G1.2 is not');
  else test.fail(OWED + 'before the item searches answered, the List was: ' + early.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200));

  fake.release();
  await settleLong();
  const html = doc.getElementById('desk-top').innerHTML;
  const itemSearches = fake.searches().map(function (c) { return (c.args || {}).todo || ''; });
  test.subHeading('T5: each open item fills its state from its own lines; a closed one is never read');
  const hasGo = /data-go="t\/G1\.1"/.test(html);
  const coding = /<tr data-id="t\/G1\.3"[\s\S]*?coding[\s\S]*?<\/tr>/.test(html);
  if (hasGo && coding && itemSearches.indexOf('t/G1.1') !== -1 && itemSearches.indexOf('t/G1.3') !== -1) {
    test.check('t/G1.1 shows Go! from its old ask, t/G1.3 its status word, each from log.search on its own id');
  } else test.fail(OWED + 'Go! on t/G1.1 ' + hasGo + ', coding on t/G1.3 ' + coding + ', searches ' + JSON.stringify(itemSearches));
  // Judged only once Desk searches at all, or today's code passes it.
  if (itemSearches.length && itemSearches.indexOf('t/G1.2') === -1) test.check('t/G1.2, closed, was never searched');
  else test.fail(OWED + (itemSearches.length ? 't/G1.2 was searched though the newest session no longer names it' : 'Desk made no searches'));
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
  if (older.length && older[0].args.before === oldestShown && /TEAMLINE-00/.test(after)) test.check('a search before ' + oldestShown + ' brought the older lines in');
  else test.fail(OWED + 'after scrolling to the top: ' + older.length + ' searches with before' + (older[0] ? ' (' + older[0].args.before + ', oldest shown ' + oldestShown + ')' : '') + ', oldest line shown ' + /TEAMLINE-00/.test(after));

  test.subHeading('T3: what arrives, what he types and what Desk decides go to the server, never to files');
  const before = fake.lines.length;
  if (doc.arrive) doc.arrive({ from: 'wsl-claude', kind: 'note', text: 'ARRIVED-LINE', todo: 't/G1.3' }, { key: 'arrived-1', peer: WSL, at: new Date().toISOString() });
  const say = doc.getElementById('desk-team-say');
  say.value = 'TYPED-BY-ANDY';
  doc.getElementById('desk-team-send').fire('click', { preventDefault: function () {} });
  await settleLong();
  const added = fake.calls.filter(function (c) { return c.verb === 'log.add'; }).map(function (c) { return JSON.parse(c.args.json).text; });
  if (fake.lines.length > before && added.indexOf('ARRIVED-LINE') !== -1) test.check('an arrival was recorded by log.add');
  else test.fail(OWED + 'log.add calls: ' + JSON.stringify(added));
  if (fake.voice.some(function (v) { return v.text === 'TYPED-BY-ANDY'; })) test.check('his typed line went to voice.add');
  else test.fail(OWED + 'voice.add got ' + JSON.stringify(fake.voice));
  const sets = fake.calls.filter(function (c) { return c.verb === 'state.set' || c.verb === 'seen.set'; });
  if (!saved.length && sets.length) test.check('state and seen went by state.set / seen.set; api.fs.saveFile was never called');
  else test.fail(OWED + 'saveFile called for ' + JSON.stringify(saved) + '; state/seen sets ' + sets.length);

  test.subHeading('T7: Desk shows the backup\'s last check and copy, red when an item closed after the check');
  const hhmm = function (iso) { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const bk = doc.getElementById('desk-backup').innerHTML;
  const askedBackup = fake.calls.some(function (c) { return c.server === 'backup' && c.verb === 'status.get'; });
  if (askedBackup && bk.indexOf(hhmm(fake.backup.lastCheck)) !== -1 && bk.indexOf(hhmm(fake.backup.lastCopy)) !== -1 && /job-start-error/.test(bk)) {
    test.check('#desk-backup names the last check and copy, marked red: t/G1.2 was closed after the check');
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
