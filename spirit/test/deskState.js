'use strict';

// desk/G2.1: the desk server holds all state and decides all content.
// Andy: "The server determines all the content to be drawn. buttons, the text in the one text box, the status of
// items, the title of items etc." The one canonical state is desk.db; the browser holds none.
// The contract the builder follows (names from claude-windows's proposal under desk/G2.1, each write carrying `by`):
//   reads   items.search {text, currentGoalOnly, goalsOnly} -> {items: [{key, label}], more}, each label JSON
//           {id, title, status, buttons, blocking, blocked, ...}; item.get {id} -> {item, box, version, checks, chat}
//   writes  session.set {json, by}; box.write {id, text, version, by}; check.add {id, kind, words, test, by};
//           check.set {id, check, state, by}; chat.add {id, text, by}; item.rename {id, title, by};
//           item.status {id, word, by}; item.take {id, by}; press {id, what, by}
//   rules   Go! only after 'end-design' and only for an item nothing open blocks; Done after one agent's
//           claim-done; Close and Reopen after done; a closed item leaves the list; the first box text wins and an
//           alteration against an old version is refused; state survives a restart; items from before the redesign
//           (old `session` lines) are not served; fresh.get is gone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by desk/G2.1: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const WRITES = ['session.set', 'box.write', 'check.add', 'check.set', 'chat.add', 'item.rename', 'item.status', 'item.take', 'press'];
const READS = ['items.search', 'item.get'];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('desk/G2.1: the desk server holds all state and decides all content');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskstate-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];

// An item from before the redesign, in the old shape: a `session` line. It must not be served.
const db = new DatabaseSync(path.join(state, 'desk.db'));
db.exec('CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);' +
  'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);');
const oldSession = JSON.stringify({ goal: { id: 'old/G1', title: 'An old goal' }, rules: [], items: [{ id: 'old/G1.1', title: 'OLD-ITEM', description: 'OLD-TEXT', blocks: ['old/G1'] }] });
const oldLine = { key: 'o1', at: '2026-09-29T08:00:00.000Z', dir: 'in', from: 'claude-windows', kind: 'session', text: oldSession, todo: 'team/chat' };
db.prepare('INSERT INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(oldLine.key, oldLine.at, oldLine.todo, oldLine.from, oldLine.kind, oldLine.text, JSON.stringify(oldLine));
db.close();

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r || {}; }, function () { return {}; }); };
async function start() {
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return r.body.desk; } catch (e) { /* not yet */ }
  }
  return null;
}
function stop(kid) { return new Promise(function (r) { if (kid.exitCode !== null || kid.signalCode !== null) return r(); kid.once('exit', r); kid.kill(); }); }
async function items(args) {
  const r = await call('items.search', Object.assign({ text: '', currentGoalOnly: false, goalsOnly: false }, args || {}));
  const by = {};
  (((r.body || {}).items) || []).forEach(function (i) { try { const o = JSON.parse(i.label); by[o.id] = o; } catch (e) { /* not one */ } });
  return by;
}
const btns = function (it) { return (it && Array.isArray(it.buttons) ? it.buttons.slice().sort() : null); };
const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b.slice().sort()); };

(async function () {
  const api = await start();
  test.subHeading('its verbs');
  const names = Object.keys(api || {});
  const missing = READS.concat(WRITES).filter(function (v) { return names.indexOf(v) === -1; });
  if (!missing.length) test.check('it answers ' + READS.concat(WRITES).join(', '));
  else test.fail(OWED + 'missing verbs: ' + missing.join(', '));
  if (names.indexOf('fresh.get') === -1) test.check('fresh.get is gone');
  else test.fail(OWED + 'fresh.get is still served');

  const session = { goal: { id: 't/G1', title: 'The goal' }, rules: [], items: [
    { id: 't/G1.1', title: 'Alpha', blocks: ['t/G1.2'] },
    { id: 't/G1.2', title: 'Beta', blocks: ['t/G1'] },
  ] };
  await call('session.set', { json: JSON.stringify(session), by: 'claude-windows' });

  test.subHeading('the session: rows, and nothing from before the redesign');
  let by = await items();
  if (by['t/G1.1'] && by['t/G1.1'].title === 'Alpha' && by['t/G1.2']) test.check('session.set puts its items on the list');
  else test.fail(OWED + 'after session.set, items.search answered ' + JSON.stringify(Object.keys(by)));
  if (!by['old/G1.1'] && !JSON.stringify(by).includes('OLD-')) test.check('an item from an old session line is not served');
  else test.fail(OWED + 'an old item was served');

  test.subHeading('Go! only after design ends, and only for an unblocked item');
  await call('press', { id: 't/G1', what: 'start-design', by: 'andy' });
  by = await items();
  if (btns(by['t/G1.1']) && !btns(by['t/G1.1']).includes('go')) test.check('in design mode, no Go!');
  else test.fail(OWED + 'in design mode Alpha has ' + JSON.stringify(by['t/G1.1']));
  await call('press', { id: 't/G1', what: 'end-design', by: 'andy' });
  by = await items();
  if (btns(by['t/G1.1']) && btns(by['t/G1.1']).includes('go')) test.check('after end-design, Alpha (unblocked) shows Go!');
  else test.fail(OWED + 'after end-design Alpha has ' + JSON.stringify(by['t/G1.1']));
  if (btns(by['t/G1.2']) && !btns(by['t/G1.2']).includes('go')) test.check('Beta, blocked by open Alpha, shows no Go!');
  else test.fail(OWED + 'Beta has ' + JSON.stringify(by['t/G1.2']));

  test.subHeading('Done after one agent\'s claim; Close and Reopen after done; closed leaves the list');
  await call('press', { id: 't/G1.1', what: 'go', by: 'andy' });
  await call('press', { id: 't/G1.1', what: 'claim-done', by: 'wsl-claude' });
  by = await items();
  if (btns(by['t/G1.1']) && btns(by['t/G1.1']).includes('done')) test.check('one agent\'s claim-done offers Done');
  else test.fail(OWED + 'after one claim Alpha has ' + JSON.stringify(by['t/G1.1']));
  await call('press', { id: 't/G1.1', what: 'done', by: 'andy' });
  by = await items();
  if (same(btns(by['t/G1.1']) || [], ['close', 'reopen'])) test.check('after done: Close and Reopen');
  else test.fail(OWED + 'after done Alpha has ' + JSON.stringify(by['t/G1.1']));
  if (btns(by['t/G1.2']) && btns(by['t/G1.2']).includes('go')) test.check('Beta, no longer blocked, now shows Go!');
  else test.fail(OWED + 'Beta after Alpha done has ' + JSON.stringify(by['t/G1.2']));
  await call('press', { id: 't/G1.1', what: 'close', by: 'andy' });
  by = await items();
  if (!by['t/G1.1'] && by['t/G1.2']) test.check('a closed item leaves the list');
  else test.fail(OWED + 'after close the list holds ' + JSON.stringify(Object.keys(by)));

  test.subHeading('the one box: the first text wins, alterations name their version');
  const w1 = await call('box.write', { id: 't/G1.2', text: 'FIRST', version: 0, by: 'claude-windows' });
  const g1 = (await call('item.get', { id: 't/G1.2' })).body || {};
  if (g1.box === 'FIRST' && g1.version >= 1) test.check('the first write becomes the box');
  else test.fail(OWED + 'after the first write: ' + JSON.stringify({ w1: w1.body, g1: g1 }));
  const stale = await call('box.write', { id: 't/G1.2', text: 'SECOND-ON-STALE', version: 0, by: 'wsl-claude' });
  const g2 = (await call('item.get', { id: 't/G1.2' })).body || {};
  if (stale.status >= 400 && g2.box === 'FIRST') test.check('an alteration against an old version is refused, and the box keeps its text');
  else test.fail(OWED + 'a stale alteration: ' + JSON.stringify({ status: stale.status, box: g2.box }));
  await call('box.write', { id: 't/G1.2', text: 'MERGED', version: g2.version, by: 'wsl-claude' });
  const g3 = (await call('item.get', { id: 't/G1.2' })).body || {};
  if (g3.box === 'MERGED') test.check('an alteration against the current version replaces it');
  else test.fail(OWED + 'after a current alteration the box is ' + JSON.stringify(g3.box));

  test.subHeading('checks, chat, rename and status');
  await call('check.add', { id: 't/G1.2', kind: 'C', words: 'look at it', test: '', by: 'claude-windows' });
  const c0 = ((await call('item.get', { id: 't/G1.2' })).body || {}).checks || [];
  const first = c0[0] || {};
  await call('check.set', { id: 't/G1.2', check: first.number || 'C1', state: 'passed', by: 'andy' });
  const c1 = ((await call('item.get', { id: 't/G1.2' })).body || {}).checks || [];
  if (c1.length === 1 && c1[0].state === 'passed' && /C1/.test(String(c1[0].number))) test.check('a C check is added as C1, and its tick is recorded');
  else test.fail(OWED + 'checks: ' + JSON.stringify(c1));
  await call('chat.add', { id: 't/G1.2', text: 'a line', by: 'andy' });
  await call('item.rename', { id: 't/G1.2', title: 'Beta renamed', by: 'andy' });
  await call('item.status', { id: 't/G1.2', word: 'coding', by: 'wsl-claude' });
  const g4 = (await call('item.get', { id: 't/G1.2' })).body || {};
  by = await items();
  const chatOk = (g4.chat || []).some(function (l) { return l.text === 'a line'; });
  if (chatOk && by['t/G1.2'] && by['t/G1.2'].title === 'Beta renamed' && by['t/G1.2'].status === 'coding') test.check('chat, rename and status word all show');
  else test.fail(OWED + 'chat ' + chatOk + ', item ' + JSON.stringify(by['t/G1.2']));

  test.subHeading('filters, searched by the server');
  const goals = await items({ goalsOnly: true });
  if (goals['t/G1'] && !goals['t/G1.2']) test.check('goalsOnly answers the goal and no items');
  else test.fail(OWED + 'goalsOnly answered ' + JSON.stringify(Object.keys(goals)));
  const found = await items({ text: 'renamed' });
  if (found['t/G1.2'] && !found['t/G1']) test.check('text search answers what matches');
  else test.fail(OWED + 'search "renamed" answered ' + JSON.stringify(Object.keys(found)));

  // Owner presses are Andy's (G2.1 review): go, done, reopen, close, abandon, start-design, end-design, and the
  // rename ("rename (you)"). An agent's press of one is refused and changes nothing.
  test.subHeading('owner presses are refused to an agent');
  const beforeOwner = JSON.stringify((await items())['t/G1.2']);
  const tries = ['done', 'close', 'abandon', 'start-design', 'end-design'];
  const answered = [];
  for (const what of tries) answered.push((await call('press', { id: 't/G1.2', what: what, by: 'wsl-claude' })).status);
  answered.push((await call('item.rename', { id: 't/G1.2', title: 'AGENT-RENAME', by: 'wsl-claude' })).status);
  const afterOwner = JSON.stringify((await items())['t/G1.2']);
  if (answered.every(function (st) { return st >= 400; }) && afterOwner === beforeOwner) test.check('an agent\'s done, close, abandon, start/end-design and rename are refused, and Beta is unchanged');
  else test.fail(OWED + 'agent owner-presses answered ' + JSON.stringify(answered) + ', Beta ' + (afterOwner === beforeOwner ? 'unchanged' : 'changed: ' + afterOwner));
  const claim = await call('press', { id: 't/G1.2', what: 'claim-done', by: 'wsl-claude' });
  if (claim.status === 200) test.check('an agent\'s claim-done still passes');
  else test.fail('an agent\'s claim-done was refused: ' + JSON.stringify(claim));

  test.subHeading('stars come from what Andy has seen');
  await call('chat.add', { id: 't/G1.2', text: 'agent says', by: 'wsl-claude' });
  const starred = (await items())['t/G1.2'] || {};
  await call('press', { id: 't/G1.2', what: 'seen', by: 'andy' });
  const cleared = (await items())['t/G1.2'] || {};
  if (starred.star === true && cleared.star === false) test.check('an agent\'s new line stars the item, and Andy\'s seen clears it');
  else test.fail(OWED + 'star before seen ' + starred.star + ', after ' + cleared.star);

  test.subHeading('an unknown press is refused by name');
  const odd = await call('press', { id: 't/G1.2', what: 'fly', by: 'andy' });
  if (odd.status === 400 && odd.body && odd.body.code === 'bad-request') test.check('press what:fly answers bad-request');
  else test.fail(OWED + 'press what:fly answered ' + JSON.stringify(odd));

  // wsl-claude: `by` is self-declared, so a member over peerPost could say 'andy'. Andy's presses come by jobs.api;
  // the member path (apiDoor) refuses a desk write that says by 'andy', and never passes it on.
  test.subHeading('a member cannot write as andy');
  const packet = require('../run/js/client/packet');
  const MEMBER = 'MCowBQYDK2VwAyEAmembermembermembermembermembermemb=';
  const askedDoor = [];
  const repliedDoor = [];
  const door = require('../run/js/apiDoor.js').createApiDoor({
    servers: { ask: function (b) { askedDoor.push(b); return Promise.resolve({ status: 200, body: {} }); } },
    post: function (relay, to, text) { repliedDoor.push(packet.decode(text)); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode, isKnown: function (k) { return k === MEMBER; }, log: function () {},
  });
  await door({ fromKey: MEMBER, hash: 'D1', relay: 'https://relay.example', text: packet.encode('api', { desk: { press: { id: 't/G1.2', what: 'done', by: 'andy' } } }).text });
  await sleep(50);
  const refusedDoor = repliedDoor[0] && repliedDoor[0].body;
  if (!askedDoor.length && refusedDoor && refusedDoor.ok === false) test.check('a member\'s desk write saying by andy is refused before the server');
  else test.fail(OWED + 'a member wrote as andy: asked ' + JSON.stringify(askedDoor) + ', answered ' + JSON.stringify(refusedDoor));
  await door({ fromKey: MEMBER, hash: 'D2', relay: 'https://relay.example', text: packet.encode('api', { desk: { press: { id: 't/G1.2', what: 'claim-done', by: 'wsl-claude' } } }).text });
  await sleep(50);
  if (askedDoor.length === 1) test.check('a member\'s write under its own name passes');
  else test.fail('a member\'s own write did not pass: ' + JSON.stringify(askedDoor));

  test.subHeading('it all survives a restart');
  await stop(kids[kids.length - 1]);
  await start();
  by = await items();
  const g5 = (await call('item.get', { id: 't/G1.2' })).body || {};
  if (!by['t/G1.1'] && by['t/G1.2'] && by['t/G1.2'].title === 'Beta renamed' && g5.box === 'MERGED') test.check('after a restart: Alpha still closed, Beta renamed, its box kept');
  else test.fail(OWED + 'after a restart: ' + JSON.stringify({ keys: Object.keys(by), box: g5.box }));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  for (const k of kids) await stop(k);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
