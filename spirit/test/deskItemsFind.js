'use strict';

// spirit/test/deskItemsFind.js
// goal/G3.13: a search over items for agents, with the chat's filters, matched against the items' lines on the desk
// server. RED on today's tree: the desk server has no verb items.find; items.search matches text against an item's
// id and title only (desk.js searchItems), never a line.
//
//   Andy, 2026-10-03 (the musing, verbatim): "2. Complete search architecture for Agents - There are two main main
//   search vectors for Agents, items and chats, - items can be searched with filters akin to the ones the current
//   chat-search has - addition to chat search filters: lines by contributor."; then under the item: "OPEN: yes the
//   item search should consider searching chat items, on the deskServer side, and the resulting item titles (or
//   keys) should be returned. Is this what you mean?", "the implication: Server-Side searches can expand to
//   chat-lines without cost to the wire", "returned is only the item itself, but now the searching agent already
//   knows the chat was matched against the search criteria...", and, asked widened items.search or a second verb:
//   "items.find". His Go is his go-all on goal/G3 (2026-10-03).
//
// THE CONTRACT (claude-windows's shape, in the box of goal/G3.13; wsl-claude builds). One verb on the desk server,
// process/js/desk/desk.js; no core module.
//   1. items.find {text, by, since, before} -> {items: [{key, label}], more}: each label an item's facts as
//      items.search answers them (key its id), through the same bucket as every search, in half an answer
//      (SEARCH_ROOM, as chat.search: deskClient packs the answer once more). A read: it writes no record. An
//      argument it does not name is refused no-such-argument.
//   2. What matches. by, since and before are filters on an item's chat lines, as chat.search reads them (by the
//      writer, since from that time on, before earlier than it). text is found whatever the case in a line, or in
//      the item's id or title. An item is answered when ONE of its lines passes every filter set together; with no
//      line filter set (by, since, before all empty), also when text is in its id or title. Nothing set: every item
//      the search may answer.
//   3. Which items. Every goal's items, goals too, abandoned goals' never; CLOSED ITEMS ARE ANSWERED (unlike
//      items.search, which hides them in an open goal): a search is not the List, and the lines worth finding are
//      mostly under closed items. Andy: "close is more of an 'visibility' issue than a process issue".
//   4. Order: by the time of the newest line that matched, newest first; an item matched by its id or title alone
//      after those, newest written first. Cut to fit, more says so; nothing pages (Andy, goal/G3.11: "none of this
//      joing shit").
// Not asserted, the builder's: what the order is among items matched the same instant; how the bucket cuts.
// Not proven: the suite has run only against the missing verb.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G3.13: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const ROOM = Math.floor((appClient.ANSWER_MAX - 512) / 2);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskItemsFindTestDeskNodeAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskItemsFindTestPeerCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskItemsFindTestPeerWSLAAAAAAAAAAAAA=', label: 'wsl-claude' };

test.startTest('goal/G3.13: items.find, a search over items by their lines');
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
const NONE = { text: '', by: '', since: '', before: '' };
// One search, as an agent asks it: { status, code, ids, facts, more, bytes }.
async function find(f, caller) {
  const r = await call('items.find', Object.assign({}, NONE, f), caller || CW);
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  const facts = items.map(function (p) { try { return JSON.parse(p.label); } catch (e) { return {}; } });
  return { status: r.status, code: (r.body || {}).code, ids: items.map(function (p) { return p.key; }), facts: facts, more: (r.body || {}).more, body: r.body,
    bytes: Buffer.byteLength(JSON.stringify(r.body || null), 'utf8') };
}
const say = function (id, text, who) { return call('chat.add', { id: id, text: text }, who); };
async function lastAt(id) { const r = await call('item.chat', { id: id }, ANDY); const c = (r.body && r.body.chat) || []; return c.length ? c[c.length - 1].at : ''; }
async function up() {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return r.body.desk; } catch (e) { /* not yet */ }
  }
  return null;
}
async function changeNow() { const r = await call('item.get', { id: 'f/G1' }, ANDY); return (r.body || {}).change; }

async function main() {
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  const tree = await up() || {};

  test.subHeading('1. the verb and its shape');
  if (JSON.stringify(tree['items.find'] || null) !== JSON.stringify({ request: { text: '', by: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false } })) {
    test.fail(OWED + 'the desk server answered items.find ' + JSON.stringify(tree['items.find'] || null) + ', where {text, by, since, before} -> {items, more} is owed');
    ['2. text in a title or a line', '3. by, since, before on lines', '4. filters together on one line', '5. closed items answered, abandoned never',
      '6. a read, and an unknown argument refused', '7. order and cut'].forEach(function (what) { test.fail(OWED + what + ': the desk server has no verb items.find'); });
    return;
  }
  test.check('items.find {text, by, since, before} -> {items: [{key, label}], more}');

  // The world: one goal, four items; a second goal abandoned with a matching line.
  const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'f/G1', title: 'Finding' }, items: [
    { id: 'f/G1.1', title: 'Plain', blocks: ['f/G1'] },
    { id: 'f/G1.2', title: 'Rails for the List', blocks: ['f/G1'] },
    { id: 'f/G1.3', title: 'Third', blocks: ['f/G1'] },
    { id: 'f/G1.4', title: 'Closed early', blocks: ['f/G1'] },
  ] }) }, CW);
  if (set.status !== 200) { test.fail(OWED + 'the test desk took no session: ' + JSON.stringify(set.body)); return; }
  await call('press', { id: 'f/G1', what: 'end-design' }, ANDY);
  await say('f/G1.1', 'first word, nothing special', ANDY);
  await sleep(30);
  await say('f/G1.3', 'the RAILS line sits here, by andy', ANDY);
  const t1 = await lastAt('f/G1.3');
  await sleep(30);
  await say('f/G1.3', 'wsl answers, nothing of the sort in it', WSL);
  await sleep(30);
  await say('f/G1.4', 'closed later, but it says rails too', WSL);
  const t2 = await lastAt('f/G1.4');
  await sleep(30);
  await say('f/G1.1', 'claude-windows on the plain item', CW);
  const t3 = await lastAt('f/G1.1');
  // f/G1.4 closes before Go (goal/G3.9), and stays findable.
  await call('press', { id: 'f/G1.4', what: 'close' }, ANDY);
  const n0 = await changeNow();

  test.subHeading('2. text in a title or a line');
  const rails = await find({ text: 'rails' });
  if (rails.status === 200 && rails.ids.indexOf('f/G1.2') !== -1 && rails.ids.indexOf('f/G1.3') !== -1 && rails.ids.indexOf('f/G1.1') === -1 && rails.ids.indexOf('f/G1') === -1) test.check('text: the item titled Rails and the item with a RAILS line, whatever the case; not the item with neither');
  else test.fail(OWED + 'text rails answered ' + rails.status + ' ' + JSON.stringify(rails.ids) + ' ' + JSON.stringify(rails.body).slice(0, 160));
  const all = await find({});
  if (all.status === 200 && ['f/G1', 'f/G1.1', 'f/G1.2', 'f/G1.3', 'f/G1.4'].every(function (id) { return all.ids.indexOf(id) !== -1; }) && all.facts.every(function (f) { return f && f.id && typeof f.status === 'string' && Array.isArray(f.buttons); })) test.check('nothing set: every item, goal too, each label its facts');
  else test.fail(OWED + 'nothing set answered ' + JSON.stringify(all.ids) + '; a label: ' + JSON.stringify(all.facts[0]).slice(0, 120));

  test.subHeading('3. by, since, before on lines');
  const byWsl = await find({ by: 'wsl-claude' });
  if (byWsl.status === 200 && byWsl.ids.indexOf('f/G1.3') !== -1 && byWsl.ids.indexOf('f/G1.4') !== -1 && byWsl.ids.indexOf('f/G1.1') === -1 && byWsl.ids.indexOf('f/G1.2') === -1) test.check('by wsl-claude: the two items it wrote under, not the others');
  else test.fail(OWED + 'by wsl-claude answered ' + JSON.stringify(byWsl.ids));
  const since = await find({ since: t2 });
  if (since.status === 200 && since.ids.indexOf('f/G1.4') !== -1 && since.ids.indexOf('f/G1.1') !== -1 && since.ids.indexOf('f/G1.3') === -1 && since.ids.indexOf('f/G1.2') === -1) test.check('since: items with a line from that time on, the item whose lines are all older left out');
  else test.fail(OWED + 'since ' + t2 + ' answered ' + JSON.stringify(since.ids));
  const before = await find({ before: t2 });
  if (before.status === 200 && before.ids.indexOf('f/G1.1') !== -1 && before.ids.indexOf('f/G1.3') !== -1 && before.ids.indexOf('f/G1.4') === -1 && before.ids.indexOf('f/G1.2') === -1) test.check('before: items with a line earlier than that time; an item titled to match but without a line is not one');
  else test.fail(OWED + 'before ' + t2 + ' answered ' + JSON.stringify(before.ids));

  test.subHeading('4. filters together on one line');
  const andyRails = await find({ text: 'rails', by: 'andy' });
  const wslRails = await find({ text: 'rails', by: 'wsl-claude' });
  const window = await find({ by: 'wsl-claude', since: t1, before: t3, text: 'rails' });
  if (andyRails.ids.join() === 'f/G1.3' && wslRails.ids.join() === 'f/G1.4' && window.ids.join() === 'f/G1.4') test.check('text and by on the same line: rails by andy is f/G1.3 alone, rails by wsl-claude f/G1.4 alone; all four together f/G1.4');
  else test.fail(OWED + 'together: rails+andy ' + JSON.stringify(andyRails.ids) + ', rails+wsl ' + JSON.stringify(wslRails.ids) + ', all four ' + JSON.stringify(window.ids));
  const titleOnly = await find({ text: 'rails', by: 'claude-windows' });
  if (titleOnly.status === 200 && titleOnly.ids.length === 0) test.check('with a line filter set, a title alone matches nothing: rails by claude-windows is no item');
  else test.fail(OWED + 'rails by claude-windows answered ' + JSON.stringify(titleOnly.ids));

  test.subHeading('5. closed items answered, abandoned never');
  const listed = await call('items.search', { text: 'rails', currentGoalOnly: true, goalsOnly: false }, CW);
  const listedIds = ((listed.body && listed.body.items) || []).map(function (p) { return p.key; });
  if (listedIds.indexOf('f/G1.4') === -1 && wslRails.ids.indexOf('f/G1.4') !== -1) test.check('f/G1.4, closed: hidden from items.search, answered by items.find');
  else test.fail(OWED + 'closed f/G1.4: items.search ' + JSON.stringify(listedIds) + ', items.find ' + JSON.stringify(wslRails.ids));
  // A second goal with a matching line, then abandoned: its items are gone from every search.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'f/G2', title: 'Left' }, items: [{ id: 'f/G2.1', title: 'Also rails', blocks: ['f/G2'] }] }) }, CW);
  await say('f/G2.1', 'rails here too', ANDY);
  const seen = await find({ text: 'rails' });
  await call('press', { id: 'f/G2', what: 'abandon' }, ANDY);
  const gone = await find({ text: 'rails' });
  if (seen.ids.indexOf('f/G2.1') !== -1 && gone.ids.indexOf('f/G2.1') === -1 && gone.ids.indexOf('f/G1.3') !== -1) test.check('an item of another goal is found until its goal is abandoned; the first goal\'s items still are');
  else test.fail(OWED + 'before abandon ' + JSON.stringify(seen.ids) + ', after ' + JSON.stringify(gone.ids));

  test.subHeading('6. a read, and an unknown argument refused');
  const n1 = await changeNow();
  const extra = await call('items.find', Object.assign({}, NONE, { currentGoalOnly: true }), CW);
  // n0 was read before this heading's own writes; the finds between n1 and now wrote nothing.
  const n2 = await changeNow();
  if (n1 === n2 && typeof n0 === 'number' && extra.body && extra.body.ok === false && extra.body.code === 'no-such-argument') test.check('finds write no record (change ' + n1 + ' before and after); an argument it does not name is refused no-such-argument');
  else test.fail(OWED + 'change ' + n1 + ' -> ' + n2 + ' across reads; the unknown argument answered ' + JSON.stringify(extra.body).slice(0, 120));

  test.subHeading('7. order and cut');
  // The newest matching line first: f/G1.4's rails line (t2) is newer than f/G1.3's (t1); then the title-only match.
  const order = await find({ text: 'rails' });
  if (order.ids.slice(0, 3).join() === ['f/G1.4', 'f/G1.3', 'f/G1.2'].join()) test.check('newest matching line first: f/G1.4, f/G1.3, then f/G1.2 matched by its title alone');
  else test.fail(OWED + 'text rails came in the order ' + JSON.stringify(order.ids));
  // Many items with a matching line: the answer fits half a room and more says the rest were left out.
  const many = [];
  for (let i = 0; i < 90; i++) many.push({ id: 'f/G1.' + (10 + i), title: 'Filler ' + i + ' with a long enough title to take room in the answer', blocks: ['f/G1'] });
  const base = [{ id: 'f/G1.1', title: 'Plain' }, { id: 'f/G1.2', title: 'Rails for the List' }, { id: 'f/G1.3', title: 'Third' }, { id: 'f/G1.4', title: 'Closed early' }].map(function (x) { x.blocks = ['f/G1']; return x; });
  await call('session.set', { json: JSON.stringify({ goal: { id: 'f/G1', title: 'Finding' }, items: base.concat(many) }) }, CW);
  for (let i = 0; i < 90; i++) await say('f/G1.' + (10 + i), 'filler line ' + i + ' says sideways', ANDY);
  const cut = await find({ text: 'sideways' });
  if (cut.status === 200 && cut.more === true && cut.ids.length > 0 && cut.ids.length < 90 && cut.bytes <= ROOM && cut.ids[0] === 'f/G1.99') test.check('90 matching items: ' + cut.ids.length + ' came back in ' + cut.bytes + ' bytes (half a room is ' + ROOM + '), the newest first, more true');
  else test.fail(OWED + '90 matching items answered ' + cut.status + ', ' + cut.ids.length + ' item(s), ' + cut.bytes + ' bytes, more ' + cut.more + ', first ' + cut.ids[0]);
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
