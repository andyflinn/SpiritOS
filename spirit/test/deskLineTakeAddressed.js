'use strict';

// spirit/test/deskLineTakeAddressed.js
// goal/G21.6: Desk: line.take takes the newest line of Andy's that is the agent's to take. Red on today's tree;
// claude-windows wrote it and builds it (one agent). The rules, Andy's decision in the item's box:
//   - line.take takes the newest of Andy's lines under the item that is addressed to the taking agent or to nobody, and
//     not yet taken; not only his latest line.
//   - A line addressed to another agent is never takeable (goal/G21.1).
//   - Taking it lets the agent answer it once (goal/G21.4), even when Andy has written to someone else below it.
// So takes are per line: several agents each hold one open take on different lines of one item at once. A take is open
// until its agent's next post under the item answers it.
//
// WHAT IS ASSERTED
//   a. the case found live: his line to A, then his line to B; B's take stands on the second, A's on the first; each
//      answers.
//   b. once A has answered, its take is closed: a second post of A's is refused, and a take with no line left for it is
//      refused with a why.
//   c. a line addressed to B alone is never A's, even when it is the only line of his not taken.
//   d. an older line addressed to nobody, under a newer line B holds, is A's to take.
//   e. his exclusion of A frees A's open take alone; B's stands, and a third agent takes the freed line.
//   f. a restart of the desk replays the records to the same takes.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G21.6: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const A = { key: 'MCowBQYDK2VwAyEAdeskLineTakeAddressedAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const B = { key: 'MCowBQYDK2VwAyEAdeskLineTakeAddressedBBBBBBBBBBBBBBBBBBB=', label: 'levant-node' };
const C = { key: 'MCowBQYDK2VwAyEAdeskLineTakeAddressedCCCCCCCCCCCCCCCCCCC=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskLineTakeAddressedOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G21.6: line.take takes the newest line of Andy\'s that is the agent\'s to take');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklinetake-'));

(async function () {
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const out = j && j.ask === 'api' ? { desk: {} } : { ok: true };
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
  const start = function () {
    return spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  };
  const waitUp = async function () {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
    return false;
  };
  let kid = start();
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const say = function (id, text, who) { return call('chat.add', { id: id, text: text }, who); };
  const chatOf = async function (id) { return ((await call('item.chat', { id: id }, ANDY)).chat) || []; };
  const lineOf = async function (id, text) { return (await chatOf(id)).filter(function (l) { return l.text === text; })[0] || {}; };
  const landed = function (r) { return !!(r && r.change); };
  const why = function (r) { return r && r.ok === false && r.extra && typeof r.extra.why === 'string' ? r.extra.why : ''; };
  try {
    if (!await waitUp()) { test.fail('the world: the desk did not start'); return; }
    await sleep(500);
    const items = ['lt/G1.1', 'lt/G1.2', 'lt/G1.3', 'lt/G1.4', 'lt/G1.5'].map(function (id) { return { id: id, title: 'Item ' + id, blocks: ['lt/G1'] }; });
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'lt/G1', title: 'Line takes' }, items: items }) }, ANDY);
    await call('press', { id: 'lt/G1', what: 'end-design' }, ANDY);
    await call('agent.state', { word: 'listening' }, A);
    await call('agent.state', { word: 'listening' }, B);
    await call('agent.state', { word: 'listening' }, C);
    // Only B with cap on: his bare "cap" is addressed to B alone (section c).
    await call('profile.set', { agent: A.key, name: 'Claude Windows', nick: 'cw', included: true, cap: false }, ANDY);
    await call('profile.set', { agent: B.key, name: 'Levant', nick: 'levant', included: true, cap: true }, ANDY);
    await call('profile.set', { agent: C.key, name: 'Claude Ubuntu', nick: 'ubi', included: true, cap: false }, ANDY);

    test.subHeading('a. his line to A, then his line to B: each takes its own and answers');
    const toA = 'cw: is my node up?';
    const toB = 'levant: do you see this item?';
    await say('lt/G1.1', toA, ANDY);
    await say('lt/G1.1', toB, ANDY);
    const bTake = await call('line.take', { id: 'lt/G1.1' }, B);
    const aTake = await call('line.take', { id: 'lt/G1.1' }, A);
    if (landed(bTake)) test.check('B\'s take of the line to it stands');
    else test.fail(OWED + 'B\'s take answered ' + short(bTake));
    if (landed(aTake)) test.check('A\'s take stands too, though his latest line is B\'s');
    else test.fail(OWED + 'A\'s take answered ' + short(aTake));
    const l1 = await lineOf('lt/G1.1', toA);
    const l2 = await lineOf('lt/G1.1', toB);
    if (l1.taken === A.label && l2.taken === B.label) test.check('A holds the first line, B the second');
    else test.fail(OWED + 'the lines read taken ' + short([l1.taken, l2.taken]));
    const aAns = await say('lt/G1.1', 'yes, your node answers', A);
    if (landed(aAns)) test.check('A answers the line it holds, under B\'s newer one');
    else test.fail(OWED + 'A\'s answer answered ' + short(aAns));
    const bAns = await say('lt/G1.1', 'yes, I see it', B);
    if (landed(bAns)) test.check('B answers its line');
    else test.fail(OWED + 'B\'s answer answered ' + short(bAns));

    test.subHeading('b. answered once: A\'s take is closed');
    const aAgain = await say('lt/G1.1', 'and one more thing', A);
    if (aAgain.ok === false && why(aAgain)) test.check('a second post of A\'s is refused: ' + why(aAgain));
    else test.fail(OWED + 'A\'s second post answered ' + short(aAgain));
    const aRetake = await call('line.take', { id: 'lt/G1.1' }, A);
    if (aRetake.ok === false && why(aRetake)) test.check('a take with no line left for A is refused: ' + why(aRetake));
    else test.fail(OWED + 'A\'s second take answered ' + short(aRetake));

    test.subHeading('c. a line addressed to B alone is never A\'s');
    await say('lt/G1.3', 'cap', ANDY);
    const capLine = await lineOf('lt/G1.3', 'cap');
    const aOnB = await call('line.take', { id: 'lt/G1.3' }, A);
    if (!capLine.taken && aOnB.ok === false && why(aOnB)) test.check('the only line of his, not taken, addressed to B: A\'s take is refused: ' + why(aOnB));
    else test.fail(OWED + 'A\'s take of B\'s line answered ' + short(aOnB) + ' (the line taken ' + short(capLine.taken) + ')');
    const aSays = await say('lt/G1.3', 'butting in', A);
    if (aSays.ok === false) test.check('and A cannot answer it');
    else test.fail(OWED + 'A answered B\'s line: ' + short(aSays));
    const bOnB = await call('line.take', { id: 'lt/G1.3' }, B);
    if (landed(bOnB) && (await lineOf('lt/G1.3', 'cap')).taken === B.label) test.check('B takes it');
    else test.fail(OWED + 'B\'s take of its line answered ' + short(bOnB));

    test.subHeading('d. an older line to nobody, under a newer one B holds, is A\'s to take');
    const open = 'what is left on this item?';
    const toB2 = 'levant, and the tests?';
    await say('lt/G1.4', open, ANDY);
    await say('lt/G1.4', toB2, ANDY);
    const aOld = await call('line.take', { id: 'lt/G1.4' }, A);
    const lOpen = await lineOf('lt/G1.4', open);
    const lB2 = await lineOf('lt/G1.4', toB2);
    if (landed(aOld) && lOpen.taken === A.label && lB2.taken === B.label) test.check('A takes the older unaddressed line; B keeps the newer');
    else test.fail(OWED + 'A\'s take answered ' + short(aOld) + '; the lines read taken ' + short([lOpen.taken, lB2.taken]));
    const aOldAns = await say('lt/G1.4', 'two parts are left', A);
    const bAns2 = await say('lt/G1.4', 'the tests are green', B);
    if (landed(aOldAns) && landed(bAns2)) test.check('both answer');
    else test.fail(OWED + 'the answers: A ' + short(aOldAns) + ', B ' + short(bAns2));

    test.subHeading('e. his exclusion of A frees A\'s take alone');
    const first = 'first question';
    const second = 'second question';
    await say('lt/G1.5', first, ANDY);
    await say('lt/G1.5', second, ANDY);
    const aNew = await call('line.take', { id: 'lt/G1.5' }, A);
    const bOld = await call('line.take', { id: 'lt/G1.5' }, B);
    const e1 = await lineOf('lt/G1.5', first);
    const e2 = await lineOf('lt/G1.5', second);
    if (landed(aNew) && landed(bOld) && e2.taken === A.label && e1.taken === B.label) test.check('A takes the newest, B the one before it');
    else test.fail(OWED + 'the takes: A ' + short(aNew) + ', B ' + short(bOld) + '; the lines read taken ' + short([e1.taken, e2.taken]));
    const off = await call('profile.set', { agent: A.key, name: 'Claude Windows', nick: 'cw', included: false, cap: false }, ANDY);
    if (!landed(off)) test.fail('the world: his exclusion answered ' + short(off));
    const x1 = await lineOf('lt/G1.5', first);
    const x2 = await lineOf('lt/G1.5', second);
    if (!x2.taken && x1.taken === B.label) test.check('A\'s line is untaken again; B\'s take stands');
    else test.fail(OWED + 'after A\'s exclusion the lines read taken ' + short([x1.taken, x2.taken]));
    const cTake = await call('line.take', { id: 'lt/G1.5' }, C);
    const bStill = await say('lt/G1.5', 'my answer to the first', B);
    if (landed(cTake) && (await lineOf('lt/G1.5', second)).taken === C.label) test.check('a third agent takes the freed line');
    else test.fail(OWED + 'C\'s take answered ' + short(cTake));
    if (landed(bStill)) test.check('B still answers its line');
    else test.fail(OWED + 'B\'s answer after A\'s exclusion answered ' + short(bStill));

    test.subHeading('f. a restart replays the same takes');
    const before = JSON.stringify([await chatOf('lt/G1.1'), await chatOf('lt/G1.4'), await chatOf('lt/G1.5')].map(function (c) { return c.map(function (l) { return [l.text, l.taken]; }); }));
    try { kid.kill(); } catch (e) { /* gone */ }
    await sleep(800);
    kid = start();
    if (!await waitUp()) { test.fail('the world: the desk did not start again'); return; }
    const after = JSON.stringify([await chatOf('lt/G1.1'), await chatOf('lt/G1.4'), await chatOf('lt/G1.5')].map(function (c) { return c.map(function (l) { return [l.text, l.taken]; }); }));
    if (after === before) test.check('the replayed records give the same takes');
    else test.fail(OWED + 'replayed: ' + short(after) + ' against ' + short(before));
    const cAns = await say('lt/G1.5', 'my answer to the second', C);
    if (landed(cAns)) test.check('after the restart C still holds its open take and answers');
    else test.fail(OWED + 'C\'s answer after the restart answered ' + short(cAns));
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
