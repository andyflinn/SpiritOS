'use strict';

// spirit/test/deskTakeToAnswer.js
// goal/G18.8: Desk: an agent answers only a line it has taken. Red on today's tree (3e1fc72a); claude-windows wrote it
// and builds it (one agent). The item's box (v4), Andy, 2026-10-12: "answering a chat line is a "take" item, i will
// solicit contributions after that, from specific agents."; "no agent should answer without taking. too much chatter
// otherwise."; and, to an agent posting its own work notes on an item it holds: "yes.", with "We need to secure desk a
// little better again chatterboxes like Levant/OpenAI".
//
// WHAT IS ASSERTED
//   1. an agent that holds neither the take of his latest line nor the item is refused, with its reason.
//   2. with the take of his line it answers once; the answer frees the line, and a second word is refused.
//   3. an agent holding the item (item.take) posts its work notes there without a line of his; another agent is
//      refused on that item.
//   4. his lines and the desk's are never refused.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G18.8: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskTakeToAnswerTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const LEV = { key: 'MCowBQYDK2VwAyEAdeskTakeToAnswerTestLevantAAAAAAAAAAAAA=', label: 'ollama agent node' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskTakeToAnswerTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G18.8: an agent answers only a line it has taken, or posts on an item it holds');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desktaketoanswer-'));

(async function () {
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {} } : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; seeded before the desk starts
  // (goal/G33.7: session.set went).
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Takes' }, items: [{ id: 'goal/G100.1', title: 'Asked', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Held', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const say = function (id, text, who) { return call('chat.add', { id: id, text: text }, who); };
  const refusedWithWhy = function (r) { return r && r.ok === false && r.extra && typeof r.extra.why === 'string' && /take/i.test(r.extra.why); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await sleep(500);
    // Both agents heard from once, as at a start (an agent never heard from is nobody the desk knows).
    await call('agent.state', { word: 'listening' }, CW);
    await call('agent.state', { word: 'listening' }, LEV);

    test.subHeading('1. no take, no item: refused');
    const asked = await say('goal/G100.1', 'what do you think?', ANDY);
    if (asked.change) test.check('the world: his line is posted');
    else test.fail('the world: his line answered ' + short(asked));
    const chatter = await say('goal/G100.1', 'I think many things.', LEV);
    if (refusedWithWhy(chatter)) test.check('an agent that took nothing is refused, and told to take: ' + chatter.extra.why);
    else test.fail(OWED + 'an agent without a take answered ' + short(chatter));

    test.subHeading('2. the take answers once');
    const took = await call('line.take', { id: 'goal/G100.1' }, LEV);
    const answer = await say('goal/G100.1', 'my one answer', LEV);
    if (took.change && answer.change) test.check('with the take of his line it answers');
    else test.fail(OWED + 'the take answered ' + short(took) + ', the answer ' + short(answer));
    const again = await say('goal/G100.1', 'and one more thing', LEV);
    if (refusedWithWhy(again)) test.check('its answer frees the line: a second word is refused');
    else test.fail(OWED + 'a second word answered ' + short(again));
    const late = await call('line.take', { id: 'goal/G100.1' }, CW);
    if (late.ok === false) test.check('an answered line is taken no more');
    else test.fail(OWED + 'a take of the answered line answered ' + short(late));

    test.subHeading('3. the item\'s holder posts its work notes');
    await call('item.take', { id: 'goal/G100.2' }, CW);
    const note = await say('goal/G100.2', 'taking: red first', CW);
    if (note.change) test.check('the agent holding the item posts there without a line of his');
    else test.fail(OWED + 'the holder\'s note answered ' + short(note));
    const other = await say('goal/G100.2', 'let me help', LEV);
    if (refusedWithWhy(other)) test.check('another agent on that item is refused');
    else test.fail(OWED + 'another agent on the held item answered ' + short(other));

    test.subHeading('4. his lines and the desk\'s are never refused');
    const his = await say('goal/G100.2', 'carry on', ANDY);
    const more = await say('goal/G100.1', 'and another question', ANDY);
    if (his.change && more.change) test.check('Andy posts under any item, held or not, taken or not');
    else test.fail(OWED + 'his lines answered ' + short([his, more]));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
