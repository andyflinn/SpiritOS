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

  await call('session.set', { json: JSON.stringify({ goal: { id: 'k/G1', title: 'Goal' }, items: [{ id: 'k/G1.1', title: 'A', blocks: ['k/G1'] }] }) }, MEMBER);

  test.subHeading('a member\'s write is tracked by its key and shown by its label');
  const w = await call('chat.add', { id: 'k/G1.1', text: 'FROM-ALICE' }, MEMBER);
  const chat = (await call('item.chat', { id: 'k/G1.1' }, MEMBER)).body.chat || [];
  const line = chat.filter(function (l) { return l.text === 'FROM-ALICE'; })[0];
  if (w.status === 200 && line && line.by === 'alice') test.check('chat.add with no by: the line shows alice, the caller\'s label');
  else test.fail(OWED + 'a member\'s chat.add answered ' + JSON.stringify(w.body).slice(0, 120) + ', line ' + JSON.stringify(line));

  test.subHeading('by: is no longer an argument');
  const withBy = await call('chat.add', { id: 'k/G1.1', text: 'SPOOF', by: 'wsl-claude' }, MEMBER);
  if (withBy.body.code === 'no-such-argument') test.check('chat.add with a by is no-such-argument: nobody names their own writer');
  else test.fail(OWED + 'chat.add with a by answered ' + JSON.stringify(withBy.body).slice(0, 140));

  test.subHeading('the owner\'s presses are his caller\'s, a member\'s refused');
  const mine = await call('press', { id: 'k/G1', what: 'end-design' }, OWNER);
  const theirs = await call('press', { id: 'k/G1', what: 'start-design' }, MEMBER);
  if (mine.status === 200 && theirs.body.code === 'not-owner') test.check('the owner\'s press is taken; a member\'s press is refused not-owner');
  else test.fail(OWED + 'presses answered ' + JSON.stringify([mine.body, theirs.body]).slice(0, 180));
  const oc = await call('chat.add', { id: 'k/G1.1', text: 'FROM-ANDY' }, OWNER);
  const chat2 = (await call('item.chat', { id: 'k/G1.1' }, OWNER)).body.chat || [];
  const own = chat2.filter(function (l) { return l.text === 'FROM-ANDY'; })[0];
  if (oc.status === 200 && own && own.by === 'andy') test.check('the owner\'s line shows andy');
  else test.fail(OWED + 'the owner\'s chat line was ' + JSON.stringify(own));

  test.subHeading('desk keeps the key with every record');
  if (kid) { kid.kill(); kid = null; await sleep(400); }
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(state, 'desk.db'), { readOnly: true });
    const cols = db.prepare('PRAGMA table_info(records)').all().map(function (c) { return c.name; });
    const rows = cols.indexOf('key') !== -1 ? db.prepare("SELECT key, verb FROM records WHERE verb = 'chat.add'").all() : [];
    db.close();
    if (rows.length >= 2 && rows.some(function (r) { return r.key === KEY; }) && rows.some(function (r) { return r.key === OWNKEY; })) {
      test.check('records.key holds alice\'s key and the owner\'s, so a relabel never orphans who wrote what');
    } else test.fail(OWED + 'records columns ' + JSON.stringify(cols) + ', chat rows ' + JSON.stringify(rows).slice(0, 160));
  } catch (e) { test.fail(OWED + 'desk.db could not be read: ' + e.message); }

  test.subHeading('nobody sends by any more');
  const agents = fs.readFileSync(path.join(RUN, 'process', 'js', 'agents', 'agents.js'), 'utf8');
  const page = fs.readFileSync(path.join(RUN, 'shell', 'desk', 'desk.js'), 'utf8') + fs.readFileSync(path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js'), 'utf8');
  // Any spelling of setting a by: as a property (by: ...) or by assignment (x.by = ...). The first check looked
  // for by: 'andy' alone and missed deskDetails' args.by = 'andy', which reached Andy's live Desk.
  const sets = /(\.by\s*=(?!=)|[{,]\s*by\s*:)/;
  const agentsSends = sets.test(agents.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'));
  const pageSends = sets.test(page.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'));
  if (!agentsSends && !pageSends) test.check('agents.js and the Desk page and dialog send no by');
  else test.fail(OWED + 'still sending by: agents.js ' + agentsSends + ', Desk page or dialog ' + pageSends);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
