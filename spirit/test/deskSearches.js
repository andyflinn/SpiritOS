'use strict';

// spirit/test/deskSearches.js
// goal/G29.21: every Desk-related search and list on the probability modules, and a goal's chats searched at once. Red
// on today's tree; claude-windows writes it and builds it (one agent). The item's box (v2):
//   - desk: walked() (pending.get, work.open, rule.history) and item.chat cut by bytes through the probability bucket;
//     rules.search ranks rules by title and text; chat.search on a goal takes scope: goal (its own chat only) or items
//     (the goal's chat and every one of its items' chats, ranked together); each line found carries the item it was said
//     in, and the goal dialog draws it as a link to that item; block.targets in goal order through the probability bucket.
//   - deskClient history.search ranks by verb and outcome; deskAgent's models search by id and quant, loaded first.
//   - desk, deskClient and deskAgent no longer require the old graded search.
// NAMED HERE where the box names none: scope '' is the item's own chat, as chat.search always was; a goal-wide line's
// label carries item, the id of the item (or goal) it was said in; deskDetails asks chat.search with scope 'items' on a
// goal and draws a found line's item as a link (data-open-item).
// rule/11: through testSupport only; its own scratch folder and pipe.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.21: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSearchesTestDeskNodeAAAAAAAAAAAAA=', label: 'andy' };

test.startTest('goal/G29.21: the Desk searches on the probability modules; a goal\'s chats searched at once');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksearches-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const deskPipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller || ANDY).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const listed = function (r) {
  const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
  return { status: r.status, body: r.body, keys: items.map(function (i) { return i.key; }), rows: items.map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } }), more: (r.body || {}).more };
};

async function main() {
  test.subHeading('0. no graded bucket in the Desk servers');
  const left = ['process/js/desk/desk.js', 'process/js/deskClient/deskClient.js', 'process/js/deskAgent/deskAgent.js'].filter(function (f) { return /searchBucket/.test(code(f)); });
  if (!left.length) test.check('desk, deskClient and deskAgent require no searchBucket');
  else test.fail(OWED + 'still on searchBucket: ' + left.join(', '));
  const details = code('shell/deskDetails/deskDetails.js');
  if (/ddAsk\('chat\.search', \{[^}]*scope:/.test(details) && /data-open-item/.test(details)) test.check('the dialog asks chat.search with a scope and draws a found line\'s item as a link');
  else test.fail(OWED + 'deskDetails neither asks a scope nor links a found line to its item');

  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let tree = null;
  for (let i = 0; i < 60 && !tree; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) tree = r.body.desk; } catch (e) { /* not yet */ }
  }
  try {
    test.subHeading('1. chat.search takes a scope');
    const want = { request: { id: '', text: '', by: '', since: '', before: '', scope: '' }, reply: { items: [{ key: '', label: '' }], more: false } };
    if (tree && JSON.stringify(tree['chat.search'] || null) === JSON.stringify(want)) test.check('chat.search {id, text, by, since, before, scope}');
    else test.fail(OWED + 'chat.search is ' + short(tree && tree['chat.search']));

    await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'A goal' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Two', blocks: ['goal/G100'] }] }) });
    await call('chat.add', { id: 'goal/G100', text: 'the harbour plan for the goal' });
    await sleep(15);
    await call('chat.add', { id: 'goal/G100.1', text: 'a harbour wall in item one' });
    await sleep(15);
    await call('chat.add', { id: 'goal/G100.2', text: 'nothing about water here' });
    const ask = function (id, text, scope) { return call('chat.search', { id: id, text: text, by: '', since: '', before: '', scope: scope }).then(listed); };

    test.subHeading('2. a goal\'s chats, at once');
    const goalOnly = await ask('goal/G100', 'harbour', 'goal');
    if (goalOnly.status === 200 && goalOnly.rows.length && goalOnly.rows.every(function (r) { return r.item === 'goal/G100'; }) && /harbour plan/.test(goalOnly.rows[0].text)) test.check('scope goal: the goal\'s own chat only');
    else test.fail(OWED + 'scope goal answered ' + goalOnly.status + ' ' + short(goalOnly.rows));
    const withItems = await ask('goal/G100', 'harbour', 'items');
    const items = withItems.rows.map(function (r) { return r.item; });
    if (withItems.status === 200 && items.indexOf('goal/G100') !== -1 && items.indexOf('goal/G100.1') !== -1 && withItems.rows.slice(0, 2).every(function (r) { return /harbour/.test(r.text); }) && new Set(withItems.keys).size === withItems.keys.length) {
      test.check('scope items: the goal\'s chat and its items\' chats ranked together, the harbour lines first, each carrying its item (' + items.join(', ') + ')');
    } else test.fail(OWED + 'scope items answered ' + withItems.status + ' ' + short(withItems.rows));
    const plain = await ask('goal/G100.1', 'harbour', '');
    if (plain.status === 200 && plain.rows.length === 1 && /harbour wall/.test(plain.rows[0].text)) test.check('no scope on an item: that item\'s chat, as always');
    else test.fail(OWED + 'chat.search on an item answered ' + short(plain.rows));

    test.subHeading('3. rules.search ranks by title and text');
    // Older first, so newest-first order alone would put the wrong one on top; and two words, which no substring holds.
    await call('rule.add', { type: 'ui', label: 'Ports are shown', text: 'the port of a node is shown in Stats' });
    await sleep(15);
    await call('rule.add', { type: 'code', label: 'Tests run alone', text: 'every suite gets its own port' });
    await sleep(15);
    await call('rule.add', { type: 'desk', label: 'Short posts', text: 'three lines at most' });
    const rules = listed(await call('rules.search', { text: 'port shown', types: [''], statuses: [''] }));
    const labels = rules.rows.map(function (r) { return r.label; });
    if (rules.status === 200 && labels[0] === 'Ports are shown' && labels[1] === 'Tests run alone') test.check('port shown: the rule that says both words first, the one that says port second — ranked, not filtered by a substring');
    else test.fail(OWED + 'rules.search port shown answered ' + short(labels));
    const every = listed(await call('rules.search', { text: '', types: [''], statuses: [''] }));
    if (every.rows.length === 3) test.check('no words: every rule');
    else test.fail(OWED + 'rules.search with no words answered ' + every.rows.length + ' rules');
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
  }

  test.subHeading('4. deskClient and deskAgent rank on the probability modules');
  const client2 = code('process/js/deskClient/deskClient.js');
  const historyHandler = (/'history\.search': \{[\s\S]*?\r?\n {2}\},\r?\n/.exec(client2) || [''])[0];
  if (/probabilityStringObjectMatch|probabilityStringMatch/.test(historyHandler)) test.check('deskClient history.search ranks with the probability modules');
  else test.fail(OWED + 'deskClient history.search does not rank with the probability modules');
  const agent = code('process/js/deskAgent/deskAgent.js');
  const modelsFn = (/function modelsSearch\([\s\S]*?\r?\n\}\r?\n/.exec(agent) || [''])[0];
  if (/probabilityStringObjectMatch|probabilityStringMatch/.test(modelsFn) && /createProbabilityBucket/.test(modelsFn)) test.check('deskAgent\'s models search ranks with the probability modules');
  else test.fail(OWED + 'deskAgent\'s models search does not rank with the probability modules');
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
