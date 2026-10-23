'use strict';

// spirit/test/deskRealtimeServer.js
// goal/G27.9, slice S1: every write that changes what a page shows publishes its row. Red on today's tree;
// claude-windows wrote it and builds it (one agent). The item's box, strategy A: "every write that changes visible
// state publishes a row-level event (item facts, row, checks, box, chat, rule row). log.add publishes its line; rule
// writes publish the rule row."
//
// WHAT IS ASSERTED
//   1. (log.add publishing its line went with log.add itself, goal/G33.4: "log.add, log.search and pending.get: delete
//      them.")
//   2. rule.add, rule.draft and rule.version publish {rule: <key>, row: <the rule as rule.get answers it>}.
//   3. a guard: an item write still publishes its item's facts (as today).
// NOT ASSERTED: deskVerify's and deskAgent's own publishes (they publish whole objects already).
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G27.9 (S1): ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRealtimeServerTestAndyAAAAAAAAAAAA=', label: 'Andy' };
const AGENT = { key: 'MCowBQYDK2VwAyEAdeskRealtimeServerTestAgentAAAAAAAAAAA=', label: 'claude-windows' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 4000)) { if (fn()) return true; await sleep(30); } return fn(); }

test.startTest('goal/G27.9 S1: the rule writes publish their row');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-realtime-server-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};

// The node the desk publishes to: every jobs.update carrying an app object is one publish.
const published = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update' && b.app && typeof b.app === 'object') published.push(b.app);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
let kid = null;

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', deskState], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-realtime-server', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: the desk did not start'); return; }
  const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Realtime' }, items: [{ id: 'goal/G100.1', title: 'one', blocks: ['goal/G100'] }] }) }, ANDY);
  if (set.status !== 200) { test.fail('the world: no session: ' + short(set.body)); return; }

  test.subHeading('3. guard: an item write publishes its facts');
  let n = published.length;
  await call('item.rename', { id: 'goal/G100.1', title: 'one, renamed' }, ANDY);
  await until(function () { return published.slice(n).some(function (p) { return p && p.verb === 'item.rename'; }); });
  const renamed = published.slice(n).filter(function (p) { return p && p.verb === 'item.rename'; })[0];
  let facts = renamed && renamed.item;
  if (typeof facts === 'string') { try { facts = JSON.parse(facts); } catch (e) { facts = null; } }
  if (facts && facts.title === 'one, renamed') test.check('item.rename publishes the item\'s facts with the new title');
  else test.fail('the world: item.rename published ' + short(published.slice(n)));

  test.subHeading('2. the rule writes publish the rule row');
  n = published.length;
  const ruleAdd = await call('rule.add', { type: 'ui', label: 'A rule of the test', text: 'its first text' }, ANDY);
  const key = (ruleAdd.body || {}).key;
  await until(function () { return published.slice(n).some(function (p) { return p && p.rule && p.row; }); }, 2000);
  const r1 = published.slice(n).filter(function (p) { return p && p.rule === key; })[0];
  if (r1 && r1.row && r1.row.key === key && r1.row.label === 'A rule of the test' && r1.row.status === 'proposed' && r1.row.text === 'its first text') test.check('rule.add publishes {rule, row}, the row as rule.get answers it');
  else test.fail(OWED + 'rule.add published ' + short(published.slice(n)));
  n = published.length;
  await call('rule.draft', { key: key, text: 'a draft of it' }, ANDY);
  await until(function () { return published.slice(n).some(function (p) { return p && p.rule && p.row; }); }, 2000);
  const r2 = published.slice(n).filter(function (p) { return p && p.rule === key; })[0];
  if (r2 && r2.row && r2.row.draft === 'a draft of it') test.check('rule.draft publishes the row with its draft');
  else test.fail(OWED + 'rule.draft published ' + short(published.slice(n)));
  n = published.length;
  await call('rule.version', { key: key, text: 'its second text', status: 'active' }, ANDY);
  await until(function () { return published.slice(n).some(function (p) { return p && p.rule && p.row; }); }, 2000);
  const r3 = published.slice(n).filter(function (p) { return p && p.rule === key; })[0];
  if (r3 && r3.row && r3.row.status === 'active' && r3.row.text === 'its second text') test.check('rule.version publishes the row as versioned');
  else test.fail(OWED + 'rule.version published ' + short(published.slice(n)));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
