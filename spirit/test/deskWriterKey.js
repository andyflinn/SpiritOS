'use strict';

// apiAuth/G1.13, desk's half: desk tracks every writer by the key it is handed, and shows the label. Red on today's code.
//   Andy: "yes. the label will only be used for labeling in chat, and for referencing members, internally desk
//   server will use keys for tracking.", "my key will at least confirm it came from my node...", and the team's
//   settled shape: by: leaves desk's verbs.
// The contract the builder follows:
//   - desk's verbs take no by: a by argument is no-such-argument. The writer is the caller appServer hands the
//     handler (forwardKey.js): a member { key, label }, the owner { owner: true, key, label }.
//   - each record keeps the writer's key (records.key in desk.db) and shows its label (a chat line's by); the
//     owner shows as andy.
//   - a press that is the owner's (go, done, close, ...) is the owner's caller, never a by: andy; a member's is
//     refused not-owner.
//   - agents.js and the Desk page and dialog send no by.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const { pipeRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by apiAuth/G1.13: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const KEY = 'MCowBQYDK2VwAyEAdeskWriterKeyTestPeerAAAAAAAAAAAAAAAA=';
const OWNKEY = 'MCowBQYDK2VwAyEAdeskWriterKeyTestOwnerAAAAAAAAAAAAAAA=';
const MEMBER = { 'X-Spirit-Caller': KEY, 'X-Spirit-Label': 'alice' };
const OWNER = { 'X-Spirit-Owner': '1', 'X-Spirit-Caller': OWNKEY, 'X-Spirit-Label': 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('apiAuth/G1.13: desk tracks writers by key and shows the label; by: is gone');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskkey-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'desk', process.platform, 'process');
if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
let kid = null;

function call(verb, args, headers) {
  const b = {}; b[verb] = args;
  return pipeRequest(pipe, 'POST', '/', JSON.stringify(b), { type: 'application/json', headers: headers || {}, timeoutMs: 5000 })
    .then(function (r) { let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; } return { status: r.status, body: j || {} }; },
      function () { return { status: 0, body: {} }; });
}

(async function () {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); const r = await pipeRequest(pipe, 'POST', '/', '"api"', { type: 'application/json', timeoutMs: 1000 }).catch(function () { return null; }); if (r && r.status === 200) break; }

  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Goal' }, items: [{ id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }] }) }, OWNER);

  test.subHeading('a member\'s write is tracked by its key and shown by its label');
  // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
  await call('item.take', { id: 'goal/G100.1' }, MEMBER);
  const w = await call('chat.add', { id: 'goal/G100.1', text: 'FROM-ALICE' }, MEMBER);
  const chat = (await call('item.chat', { id: 'goal/G100.1' }, MEMBER)).body.chat || [];
  const line = chat.filter(function (l) { return l.text === 'FROM-ALICE'; })[0];
  if (w.status === 200 && line && line.by === 'alice') test.check('chat.add with no by: the line shows alice, the caller\'s label');
  else test.fail(OWED + 'a member\'s chat.add answered ' + JSON.stringify(w.body).slice(0, 120) + ', line ' + JSON.stringify(line));

  test.subHeading('by: is no longer an argument');
  const withBy = await call('chat.add', { id: 'goal/G100.1', text: 'SPOOF', by: 'wsl-claude' }, MEMBER);
  if (withBy.body.code === 'no-such-argument') test.check('chat.add with a by is no-such-argument: nobody names their own writer');
  else test.fail(OWED + 'chat.add with a by answered ' + JSON.stringify(withBy.body).slice(0, 140));

  test.subHeading('the owner\'s presses are his caller\'s, a member\'s refused');
  const mine = await call('press', { id: 'goal/G100', what: 'end-design' }, OWNER);
  const theirs = await call('press', { id: 'goal/G100', what: 'start-design' }, MEMBER);
  if (mine.status === 200 && theirs.body.code === 'not-owner') test.check('the owner\'s press is taken; a member\'s press is refused not-owner');
  else test.fail(OWED + 'presses answered ' + JSON.stringify([mine.body, theirs.body]).slice(0, 180));
  const oc = await call('chat.add', { id: 'goal/G100.1', text: 'FROM-ANDY' }, OWNER);
  const chat2 = (await call('item.chat', { id: 'goal/G100.1' }, OWNER)).body.chat || [];
  const own = chat2.filter(function (l) { return l.text === 'FROM-ANDY'; })[0];
  if (oc.status === 200 && own && own.by === 'andy') test.check('the owner\'s line shows andy');
  else test.fail(OWED + 'the owner\'s chat line was ' + JSON.stringify(own));

  test.subHeading('desk keeps the key with every chat row (goal/G33.4: its creator)');
  if (kid) { kid.kill(); kid = null; await sleep(400); }
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(state, 'desk.db'), { readOnly: true });
    // goal/G33.4: the log of writes went; every chat row carries its creator, the writer's key.
    const cols = db.prepare('PRAGMA table_info(chat)').all().map(function (c) { return c.name; });
    const rows = cols.indexOf('creator') !== -1 ? db.prepare('SELECT creator AS key FROM chat').all() : [];
    db.close();
    if (rows.length >= 2 && rows.some(function (r) { return r.key === KEY; }) && rows.some(function (r) { return r.key === OWNKEY; })) {
      test.check('the chat rows\' creator holds alice\'s key and the owner\'s, so a relabel never orphans who wrote what');
    } else test.fail(OWED + 'chat columns ' + JSON.stringify(cols) + ', chat rows ' + JSON.stringify(rows).slice(0, 160));
  } catch (e) { test.fail(OWED + 'desk.db could not be read: ' + e.message); }

  test.subHeading('nobody sends by any more');
  const page = fs.readFileSync(path.join(RUN, 'shell', 'desk', 'desk.js'), 'utf8') + fs.readFileSync(path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js'), 'utf8');
  // Any spelling of setting a by: as a property (by: ...) or by assignment (x.by = ...). The first check looked
  // for by: 'andy' alone and missed deskDetails' args.by = 'andy', which reached Andy's live Desk.
  const sets = /(\.by\s*=(?!=)|[{,]\s*by\s*:)/;
  // A READ'S EMPTY FILTER IS NOT A WRITER (goal/G18.5). appServer takes exactly a verb's declared keys, so the
  // dialog's chat search sends chat.search's by, its "only lines by" filter, always empty. A line calling a read verb
  // with by: '' is let through; any other by, on a read or a write, still fails. Andy, 2026-10-12: "yes. fix that
  // test to be in line with the revised design."
  const readFilter = /'(chat\.search|items\.find)'.*[{,]\s*by\s*:\s*''/;
  const lines = page.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); });
  const pageSends = sets.test(lines.filter(function (l) { return !readFilter.test(l); }).join('\n'));
  // agents.js was read here too; the agents app is gone (goal/G3.2).
  if (!pageSends) test.check('the Desk page and dialog send no by, but a read\'s empty filter');
  else test.fail(OWED + 'still sending by: Desk page or dialog ' + pageSends);
  if (readFilter.test("ddAsk('chat.search', { id: id, by: '' })") && !readFilter.test("ddAsk('chat.search', { id: id, by: 'andy' })") && !readFilter.test("ddWrite('chat.add', { id: id, by: '' })")) test.check('the exception is narrow: a read with by \'andy\', or a write with any by, is not excused');
  else test.fail('the read exception is too wide');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
