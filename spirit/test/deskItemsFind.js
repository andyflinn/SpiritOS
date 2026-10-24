'use strict';

// spirit/test/deskItemsFind.js
// goal/G3.13, as goal/G33.7 leaves it: finding items by their lines. items.find WENT WITH goal/G33.7 (the approved verb
// list: "items.find (agents only; items.search covers it)"), so what this suite asserts is that items.search covers it.
//
//   Andy, 2026-10-03 (goal/G3.13): "the item search should consider searching chat items, on the deskServer side, and
//   the resulting item titles (or keys) should be returned", "Server-Side searches can expand to chat-lines without cost
//   to the wire"; and goal/G18.5: "the item search must probability search the chat-lines, and weigh the chat lines in
//   the item result as 50% overall."
//
// WHAT IS ASSERTED
//   1. items.find is refused no-such-verb, and no interface names it.
//   2. items.search ranks items by text in a title or a line: the item titled Rails and the item with a RAILS line,
//      whatever the case, ahead of the items with neither; with no text every item, goal too, each label its facts;
//      a closed item is answered when includeClosed asks for it.
//   3. A search is a read: it writes no record; an argument it does not name is refused no-such-argument.
//   4. Cut: with 90 items matching by a line, the answer fits one answer and says more, a filler first.
// No longer asserted, with items.find gone: the line filters by, since and before over items (chat.search keeps them over
// lines, deskChatSearch.js), and the order by the newest matching line.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G3.13 (goal/G33.7): ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const ROOM = appClient.ANSWER_MAX - 512;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskItemsFindTestDeskNodeAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskItemsFindTestPeerCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskItemsFindTestPeerWSLAAAAAAAAAAAAA=', label: 'wsl-claude' };

test.startTest('goal/G3.13: items are found by their lines through items.search (items.find went with goal/G33.7)');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskitemsfind-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const win = process.platform === 'win32';
const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
const kids = [];
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const NONE = { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false };
// One search, as an agent asks it: { status, code, ids, facts, more, bytes }.
async function find(f, caller) {
  const r = await call('items.search', Object.assign({}, NONE, f), caller || CW);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  const facts = items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } });
  return { status: r.status, code: (r.body || {}).code, ids: items.map(function (p) { return p.key; }), facts: facts, more: (r.body || {}).more, body: r.body,
    bytes: Buffer.byteLength(JSON.stringify(r.body || null), 'utf8') };
}
const say = function (id, text, who) { return call('chat.add', { id: id, text: text }, who); };
async function up() {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return r.body.desk; } catch (e) { /* not yet */ }
  }
  return null;
}
async function changeNow() { const r = await call('item.get', { id: 'goal/G100' }, ANDY); return (r.body || {}).change; }

async function main() {
  // The world: one goal, four items, written by the owner (goal/G29.21), seeded before the desk starts (goal/G33.7:
  // session.set went).
  test.seedDesk(deskState, { goal: { id: 'goal/G100', title: 'Finding' }, items: [
    { id: 'goal/G100.1', title: 'Plain', blocks: ['goal/G100'] },
    { id: 'goal/G100.2', title: 'Rails for the List', blocks: ['goal/G100'] },
    { id: 'goal/G100.3', title: 'Third', blocks: ['goal/G100'] },
    { id: 'goal/G100.4', title: 'Closed early', blocks: ['goal/G100'] },
  ] });
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  const tree = await up() || {};

  test.subHeading('1. items.find is gone');
  const gone = await call('items.find', { text: '', by: '', since: '', before: '' }, CW);
  const iface = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'api.js'), 'utf8');
  if (!tree['items.find'] && gone.body && gone.body.code === 'no-such-verb' && iface.indexOf("'items.find'") === -1 && !fs.existsSync(path.join(RUN, 'process', 'js', 'desk', 'desk.family', 'items.find.json'))) test.check('items.find is refused no-such-verb, and neither the interface nor a verb file names it');
  else test.fail(OWED + 'items.find answered ' + JSON.stringify(gone.body) + '; in the tree ' + !!tree['items.find']);

  await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  await say('goal/G100.1', 'first word, nothing special', ANDY);
  await say('goal/G100.3', 'the RAILS line sits here, by andy', ANDY);
  // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
  await call('line.take', { id: 'goal/G100.3' }, WSL);
  await say('goal/G100.3', 'wsl answers, nothing of the sort in it', WSL);
  await call('item.take', { id: 'goal/G100.4' }, WSL);
  await say('goal/G100.4', 'closed later, but it says rails too', WSL);
  // goal/G100.4 closes before Go (goal/G3.9), and stays findable when closed items are asked for.
  await call('press', { id: 'goal/G100.4', what: 'close' }, ANDY);
  const n0 = await changeNow();

  test.subHeading('2. text in a title or a line');
  const rails = await find({ text: 'rails' });
  // goal/G18.5: the text ranks, it does not filter. Every item is answered; the ones that match come first.
  const at = function (id) { const i = rails.ids.indexOf(id); return i === -1 ? Infinity : i; };
  if (rails.status === 200 && Math.max(at('goal/G100.2'), at('goal/G100.3')) < Math.min(at('goal/G100.1'), at('goal/G100'))) test.check('text ranks: the item titled Rails and the item with a RAILS line, whatever the case, ahead of the items with neither');
  else test.fail(OWED + 'text rails answered ' + rails.status + ' ' + JSON.stringify(rails.ids) + ' ' + JSON.stringify(rails.body).slice(0, 160));
  const all = await find({});
  if (all.status === 200 && ['goal/G100', 'goal/G100.1', 'goal/G100.2', 'goal/G100.3'].every(function (id) { return all.ids.indexOf(id) !== -1; }) && all.facts.every(function (f) { return f && f.id && typeof f.status === 'string' && Array.isArray(f.buttons); })) test.check('nothing set: every open item, goal too, each label its facts');
  else test.fail(OWED + 'nothing set answered ' + JSON.stringify(all.ids) + '; a label: ' + JSON.stringify(all.facts[0]).slice(0, 120));
  const hidden = await find({ text: 'rails' });
  const closed = await find({ text: 'rails', includeClosed: true });
  if (hidden.ids.indexOf('goal/G100.4') === -1 && closed.ids.indexOf('goal/G100.4') !== -1 && closed.ids.indexOf('goal/G100.4') < closed.ids.indexOf('goal/G100.1')) test.check('goal/G100.4, closed: left out by default, found by its rails line when includeClosed asks for it');
  else test.fail(OWED + 'closed goal/G100.4: by default ' + JSON.stringify(hidden.ids) + ', with includeClosed ' + JSON.stringify(closed.ids));

  test.subHeading('3. a read, and an unknown argument refused');
  const n1 = await changeNow();
  const extra = await call('items.search', Object.assign({}, NONE, { by: 'andy' }), CW);
  const n2 = await changeNow();
  if (n1 === n2 && typeof n0 === 'number' && extra.body && extra.body.ok === false && extra.body.code === 'no-such-argument') test.check('searches write no record (change ' + n1 + ' before and after); an argument it does not name is refused no-such-argument');
  else test.fail(OWED + 'change ' + n1 + ' -> ' + n2 + ' across reads; the unknown argument answered ' + JSON.stringify(extra.body).slice(0, 120));

  test.subHeading('4. the cut');
  // Many items with a matching line: the answer fits one answer and more says the rest were left out. The fillers
  // differ only in their number, so they rank by probability, not by age (goal/G18.5).
  const fillers = [];
  for (let i = 0; i < 90; i++) {
    const r = await call('item.add', { goal: 'goal/G100', title: 'Filler ' + i + ' with a long enough title to take room in the answer' }, ANDY);
    if (r.body && r.body.id) { fillers.push(r.body.id); await say(r.body.id, 'filler line ' + i + ' says sideways', ANDY); }
  }
  const cut = await find({ text: 'sideways' });
  if (fillers.length === 90 && cut.status === 200 && cut.more === true && cut.ids.length > 0 && cut.ids.length < 94 && cut.bytes <= ROOM + 512 && fillers.indexOf(cut.ids[0]) !== -1) test.check('90 matching items: ' + cut.ids.length + ' came back in ' + cut.bytes + ' bytes (one answer is ' + appClient.ANSWER_MAX + '), a filler first, more true');
  else test.fail(OWED + '90 matching items (' + fillers.length + ' added) answered ' + cut.status + ', ' + cut.ids.length + ' item(s), ' + cut.bytes + ' bytes, more ' + cut.more + ', first ' + cut.ids[0]);
}

main().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
