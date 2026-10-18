'use strict';

// spirit/test/deskItemAddGrant.js
// goal/G29.21, its second part: an agent adds items only under Andy's words, and a new item is code. Red on today's
// tree; claude-windows writes it and builds it (one agent). The item's box (v3), DESK: ITEM ADDS NEED HIS WORDS:
//   - Desk lets an agent add items only while Andy's newest Desk line holds the words "add item" (one item) or "add
//     items" (several items) in sequence. The grant ends with his next line. Proposing items stays free.
//   - A new item is kind code unless said otherwise.
// NAMED HERE where the box names none: his newest line is his newest chat line anywhere in Desk; the words match
// whatever the case; his own adds need no grant; "code" is the item's code mark (item.get's code), and an item whose
// plugin refuses the code press (codeOffered false) is not marked.
// rule/11: through testSupport only; its own scratch folder and pipe.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.21: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskItemAddGrantTestOwnerAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskItemAddGrantTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };

test.startTest('goal/G29.21: an agent adds items only under his "add item" or "add items"; a new item is code');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskitemaddgrant-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const deskPipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const took = function (r) { return r.status === 200 && r.body && typeof r.body.id === 'string' && r.body.id; };
const add = function (goal, title, caller) { return call('item.add', { goal: goal, title: title }, caller); };
const say = function (id, text) { return call('chat.add', { id: id, text: text }, ANDY); };

async function main() {
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ }
  }
  try {
    if (!up) { test.fail('the desk server did not start'); return; }
    const g = await call('goal.add', { title: 'A goal' }, ANDY);
    const gid = g.body && g.body.id;
    if (!gid) { test.fail('the world: goal.add answered ' + g.status + ' ' + short(g.body)); return; }

    test.subHeading('1. no words, no add');
    const bare = await add(gid, 'Unasked', CW);
    if (bare.status >= 400 && !took(bare)) test.check('an agent\'s item.add with no grant is refused (' + bare.status + ' ' + short(bare.body && (bare.body.error || bare.body.why)) + ')');
    else test.fail(OWED + 'an agent added an item with no grant: ' + bare.status + ' ' + short(bare.body));
    const his = await add(gid, 'His own', ANDY);
    if (took(his)) test.check('his own item.add needs no grant');
    else test.fail('his own item.add answered ' + his.status + ' ' + short(his.body));

    test.subHeading('2. "add item" grants one');
    await say(gid, 'ok, Add Item for the harbour wall');
    const one = await add(gid, 'Harbour wall', CW);
    const two = await add(gid, 'One too many', CW);
    if (took(one)) test.check('after "Add Item" the agent adds one item');
    else test.fail(OWED + 'after "Add Item" the add answered ' + one.status + ' ' + short(one.body));
    if (two.status >= 400 && !took(two)) test.check('a second add under the same line is refused');
    else test.fail(OWED + 'a second add under one "add item" answered ' + two.status + ' ' + short(two.body));

    test.subHeading('3. "add items" grants several, until his next line');
    await say(gid, 'yes, add items for all three');
    const many = [await add(gid, 'First', CW), await add(gid, 'Second', CW), await add(gid, 'Third', CW)];
    if (many.every(took)) test.check('after "add items" the agent adds three items');
    else test.fail(OWED + 'after "add items" the adds answered ' + short(many.map(function (r) { return r.status; })));
    await say(gid, 'thanks');
    const after = await add(gid, 'Fourth', CW);
    if (after.status >= 400 && !took(after)) test.check('his next line ends the grant: the next add is refused');
    else test.fail(OWED + 'after his next line an add answered ' + after.status + ' ' + short(after.body));
    await say(gid, 'adding items is fine');
    const apart = await add(gid, 'Not in sequence', CW);
    if (apart.status >= 400 && !took(apart)) test.check('"add" and "item" not in sequence grant nothing');
    else test.fail(OWED + '"adding items" granted an add: ' + apart.status + ' ' + short(apart.body));

    test.subHeading('4. a new item is code');
    const fresh = parse(((await call('item.get', { id: took(one) || took(his) || '' }, ANDY)).body || {}).item) || {};
    const own = parse(((await call('item.get', { id: took(his) || '' }, ANDY)).body || {}).item) || {};
    if (fresh.code === true && own.code === true) test.check('an item added by item.add is code, his and the agent\'s');
    else test.fail(OWED + 'a new item reads code ' + short(fresh.code) + ' (agent\'s) and ' + short(own.code) + ' (his)');
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
  }
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
