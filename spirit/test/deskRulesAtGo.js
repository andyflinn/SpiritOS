'use strict';

// goal/G2.20: a Go carries the rules active at that moment, a reopened goal's new items with it, and a rule of type
// design reaches every item. Red on today's tree; claude-windows wrote it from G2.20's box and does not build it.
//   Andy, 2026-10-06, under goal/G2.18: "new added items in a re-opened current goal should consider all decision
//   made in the mean time."
//   On what the type design should mean, answering Q1 on the item: "every item".
//
// WHAT IS WRONG TODAY, found while this was written and checked live on his node: his Go recorded an empty rule set
// on goal/G2.18 while rule/3 was active, and again on all three of goal/G2's items at his Go-all. The reopening is
// not the cause. A Go stamps the rules whose type the item's box asks for (desk.js rulesFor and typesOf), and
// typesOf yields only 'desk', plus 'code' or 'ui' for the paths the box names, while a rule may be of type 'design'
// (desk.js RULE_TYPES). So a design rule matched nothing at all, on any item, ever.
//
// THE SHAPE (G2.20's box):
//   1  A rule of type 'design' applies to every item, as a 'desk' rule does: whatever paths its box names, and
//      whether or not its goal is in design mode.
//   2  His Go stamps the rules active at that moment on the item, and item.get answers them as [{key, version}].
//   3  An item added to a reopened goal gets the rules active now, not those of the goal's first life: a rule
//      activated while the goal was closed is on it.
//   4  A rule that is only proposed, or deleted, is stamped on nothing; a ui rule still only reaches a box that
//      names a face path.
// Answer shapes the box leaves open are read leniently: the stamp may be a list of {key, version} or of keys.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.20: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskRulesAtGoTestCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRulesAtGoTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
// The stamp, as a list of rule keys, however the answer carries it.
function keysOf(f) {
  const r = (f && f.rules) || [];
  return (Array.isArray(r) ? r : []).map(function (x) { return x && typeof x === 'object' ? String(x.key) : String(x); }).sort();
}

test.startTest('goal/G2.20: a Go carries today\'s rules, and a design rule reaches every item');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskrulesatgo-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }
async function factsOf(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
// A rule of a type, active, by its label; returns its key.
async function activeRule(type, label, text) {
  const added = await call('rule.add', { type: type, label: label, text: text }, CW);
  const key = added.body && added.body.key;
  if (key) await call('rule.version', { key: key, text: text, status: 'active' }, ANDY);
  return key;
}
// A session naming the goal and its items; the box of each decides which paths it names.
function session(goal, title, items) {
  return { json: JSON.stringify({ goal: { id: goal, title: title }, items: items }) };
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }

  // ONE RULE OF EVERY TYPE, all active, so what each item carries says which types reached it.
  const design = await activeRule('design', 'Questions as checks', 'A question goes on its item as a Q check at once.');
  const desk = await activeRule('desk', 'Three lines', 'A post is three lines at most.');
  const code = await activeRule('code', 'Tests first', 'Red on today\'s tree.');
  const ui = await activeRule('ui', 'Bubbles', 'One bubble per line.');
  const proposed = (await call('rule.add', { type: 'design', label: 'Not yet mine', text: 'Still being argued.' }, CW)).body;
  const gone = await activeRule('design', 'Withdrawn', 'This one is deleted.');
  if (gone) await call('rule.version', { key: gone, text: 'This one is deleted.', status: 'deleted' }, ANDY);
  if (!design || !desk || !code || !ui || !gone || !(proposed && proposed.key)) { test.fail('the world: the rules were not made, ' + short([design, desk, code, ui, gone, proposed])); return; }

  await call('session.set', session('r/G1', 'Rules at Go', [
    { id: 'r/G1.1', title: 'A plain item', blocks: ['r/G1'] },
    { id: 'r/G1.2', title: 'A face item', blocks: ['r/G1'] },
  ]), CW);
  // The box is what names the paths a type is drawn from, so each item gets one before his Go.
  await call('box.write', { id: 'r/G1.1', version: 0, text: 'A decision, no path named at all.' }, CW);
  await call('box.write', { id: 'r/G1.2', version: 0, text: 'Where: spirit/run/shell/chatter/chatter.js' }, CW);
  await call('press', { id: 'r/G1', what: 'end-design' }, ANDY);

  test.subHeading('1. a design rule reaches an item whose box names no path at all');
  const go1 = await call('press', { id: 'r/G1.1', what: 'go' }, ANDY);
  const f1 = await factsOf('r/G1.1');
  const k1 = keysOf(f1);
  if (!took(go1)) test.fail('his Go on r/G1.1 answered ' + go1.status + ' ' + short(go1.body));
  else if (k1.indexOf(design) !== -1) test.check('the design rule ' + design + ' is on an item that names no path');
  else test.fail(OWED + 'r/G1.1 carries ' + short(k1) + ', without the design rule ' + design);
  if (k1.indexOf(desk) !== -1) test.check('the desk rule is on it too, as it always was');
  else test.fail(OWED + 'r/G1.1 carries ' + short(k1) + ', without the desk rule ' + desk);

  test.subHeading('2. a proposed rule and a deleted one are stamped on nothing; ui still needs a face path');
  if (k1.indexOf(String(proposed.key)) === -1 && k1.indexOf(gone) === -1) test.check('neither the proposed rule nor the deleted one is stamped');
  else test.fail(OWED + 'r/G1.1 carries ' + short(k1) + ', with the proposed or the deleted rule');
  if (k1.indexOf(ui) === -1 && k1.indexOf(code) === -1) test.check('a ui rule and a code rule stay off an item that names neither kind of path');
  else test.fail(OWED + 'r/G1.1 carries ' + short(k1) + ', with the ui or code rule although its box names no path');
  await call('press', { id: 'r/G1.2', what: 'go' }, ANDY);
  const k2 = keysOf(await factsOf('r/G1.2'));
  if (k2.indexOf(ui) !== -1 && k2.indexOf(design) !== -1 && k2.indexOf(desk) !== -1) test.check('an item whose box names a face path carries the ui rule, and the design and desk rules with it');
  else test.fail(OWED + 'the face item carries ' + short(k2));

  test.subHeading('3. an item added to a reopened goal carries the rules active now');
  await call('press', { id: 'r/G1', what: 'close' }, ANDY);
  const late = await activeRule('design', 'Plain english', 'Plain english is always preferred by this user.');
  if (!late) { test.fail('the world: the late rule was not made'); return; }
  await call('press', { id: 'r/G1', what: 'reopen' }, ANDY);
  await call('session.set', session('r/G1', 'Rules at Go', [
    { id: 'r/G1.1', title: 'A plain item', blocks: ['r/G1'] },
    { id: 'r/G1.2', title: 'A face item', blocks: ['r/G1'] },
    { id: 'r/G1.3', title: 'Added after the reopening', blocks: ['r/G1'] },
  ]), CW);
  await call('box.write', { id: 'r/G1.3', version: 0, text: 'Added while the goal was closed and reopened.' }, CW);
  await call('press', { id: 'r/G1', what: 'end-design' }, ANDY);
  const go3 = await call('press', { id: 'r/G1.3', what: 'go' }, ANDY);
  const k3 = keysOf(await factsOf('r/G1.3'));
  if (!took(go3)) test.fail('his Go on r/G1.3 answered ' + go3.status + ' ' + short(go3.body));
  else if (k3.indexOf(late) !== -1 && k3.indexOf(design) !== -1) test.check('the item added after the reopening carries the rule activated while the goal was closed, ' + late);
  else test.fail(OWED + 'r/G1.3 carries ' + short(k3) + ', without the late rule ' + late);

  test.subHeading('4. the older items keep the stamp of their own Go');
  const k1again = keysOf(await factsOf('r/G1.1'));
  if (k1again.indexOf(late) === -1) test.check('r/G1.1 keeps the rules of its own Go, without the later one');
  else test.fail(OWED + 'r/G1.1 now carries the later rule ' + late + ': ' + short(k1again));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
