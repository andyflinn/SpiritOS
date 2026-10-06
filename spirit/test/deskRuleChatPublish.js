'use strict';

// goal/G2.18: a rule chat line reaches the open rule dialog without a reload. Red on today's tree; claude-windows
// wrote it from G2.18's box and does not build it unless Andy waives the phase (one agent in the sitting).
//   Andy, 2026-10-06, rule/3 chat: "problem, your answers to this chat only appear after hard-refresh, so this
//   dialog fails to listen to updates, or they are not streamed..." / "i need shit fixed fast."
//
// THE CAUSE (G2.18's box): a chat line under a rule is stored as a rule.chat record and published by the generic
// write as {change, verb: 'rule.chat', item: null} (process/js/desk/desk.js, the publish after a write); rule.add,
// rule.draft and rule.version publish {rule: key}. The rule dialog (shell/ruleDetails) repaints only on a publish
// that names its rule, so a chat line waits for a reload.
//
// THE SHAPE: the publish of a rule.chat write names its rule, `rule: 'rule/N'`, as the other rule verbs do. Server
// only; the face is unchanged. Whatever else the object carries (change, verb) is not asserted here.
//
// HOW IT WATCHES: appServer.publish reports through spirit.core.jobs.report, a POST to SPIRIT_CALLBACK_URL with
// {verb: 'jobs.update', id, app: <the object>} (kernel.js, jobCallback.js). The desk server is spawned with those two
// variables pointing at a throwaway HTTP door here, which keeps every object it is handed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.18: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskRuleChatTestCWAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRuleChatTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('goal/G2.18: a rule chat line is published naming its rule');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskrulechat-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };

// THE STAND-IN DOOR: every published object, in the order it arrived.
const published = [];
const door = http.createServer(function (req, res) {
  let body = '';
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    try { const sent = JSON.parse(body); if (sent && sent.verb === 'jobs.update' && sent.app) published.push(sent.app); } catch (e) { /* not a report */ }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{}');
  });
});

let kid = null;
async function start(url) {
  const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-rule-chat-test', SPIRIT_CALLBACK_URL: url });
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }
// A publish is a POST of its own; wait until one naming the verb (or the rule) has landed, or the time is up.
async function settled(pick) { for (let i = 0; i < 40; i++) { if (published.some(pick)) return true; await sleep(100); } return false; }

(async function () {
  await new Promise(function (r) { door.listen(0, '127.0.0.1', r); });
  const url = 'http://127.0.0.1:' + door.address().port + '/api/spirit';
  if (!await start(url)) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'rc/G1', title: 'Rule chat' }, items: [{ id: 'rc/G1.1', title: 'Work', blocks: ['rc/G1'] }] }) }, CW);

  test.subHeading('A. the other rule verbs publish the rule key (the contrast, green today)');
  const added = await call('rule.add', { type: 'desk', label: 'Questions as checks', text: 'A question goes on its item as a Q check.' }, CW);
  const key = added.body && added.body.key;
  await settled(function (o) { return o.rule === key; });
  if (added.status === 200 && key && published.some(function (o) { return o.rule === key; })) test.check('rule.add ' + key + ' is published as {rule: ' + key + '}');
  else test.fail('rule.add answered ' + added.status + ' ' + short(added.body) + '; published ' + short(published));

  test.subHeading('B. a chat line under the rule is published naming the rule');
  published.length = 0;
  const said = key ? await call('chat.add', { id: key, text: 'I would widen it to every phase.' }, CW) : {};
  await settled(function (o) { return o.verb === 'rule.chat' || o.rule === key; });
  const ofChat = published.filter(function (o) { return o.verb === 'rule.chat' || o.rule === key; });
  if (said.status !== 200) test.fail('chat.add under ' + key + ' answered ' + said.status + ' ' + short(said.body));
  else if (!ofChat.length) test.fail(OWED + 'the rule chat line published nothing that names rule.chat or ' + key + ': ' + short(published));
  else if (ofChat.some(function (o) { return o.rule === key; })) test.check('the rule chat line is published naming ' + key);
  else test.fail(OWED + 'the rule chat line is published without its rule: ' + short(ofChat));

  test.subHeading('C. a line by him under the rule is published the same way');
  published.length = 0;
  const his = key ? await call('chat.add', { id: key, text: 'agreed.' }, ANDY) : {};
  await settled(function (o) { return o.rule === key; });
  if (his.status === 200 && published.some(function (o) { return o.rule === key; })) test.check('his line under ' + key + ' is published naming the rule');
  else test.fail(OWED + 'his line answered ' + his.status + '; published ' + short(published));

  test.subHeading('D. an item\'s chat line is published as before, with no rule key');
  published.length = 0;
  const item = await call('chat.add', { id: 'rc/G1.1', text: 'a line under an item' }, CW);
  await settled(function (o) { return o.verb === 'chat.add'; });
  const ofItem = published.filter(function (o) { return o.verb === 'chat.add'; });
  if (item.status === 200 && ofItem.length && ofItem.every(function (o) { return !('rule' in o) && o.item && o.item.id === 'rc/G1.1'; })) test.check('an item line publishes its item and no rule');
  else test.fail('an item line answered ' + item.status + '; published ' + short(ofItem));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  door.close();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
