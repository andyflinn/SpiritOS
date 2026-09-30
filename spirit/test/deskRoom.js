'use strict';

// HIS PAGE HOLDS UP TO MAX_PAYLOAD OF CHAT; THE AGENTS KEEP THEIR SMALLER ANSWER.
//   Andy: "on the browser the room can be larger, no rule prevents that", "in the sent messages ther MUST be a
//   MAX_PAYLOAD", and, when his answers fell off the top of a dialog: "i should have at up to MAX_PAYLOAD data in chat
//   histor and i don't."
// The contract:
//   apiDoor.answer(servers, ask, opts) hands opts to servers.ask; appClient.ask(body, {answerMax}) reads an answer up
//   to answerMax (never above limits.PAYLOAD_MAX); jobs.api, the loopback door, asks with PAYLOAD_MAX; a member's
//   packet keeps ANSWER_MAX.
//   item.get takes an optional room (bytes): its answer is filled up to that room, never below the old one and never
//   above PAYLOAD_MAX less 512. The item dialog asks with the largest.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const limits = require('../run/js/limits.js');
const apiDoor = require('../run/js/apiDoor.js');

const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const NODE = path.join(__dirname, '..', 'run', 'js', 'server.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest("his page holds up to MAX_PAYLOAD of chat; the agents keep their answer");

(async function () {
  test.subHeading('the loopback door asks with MAX_PAYLOAD, a member keeps ANSWER_MAX');
  let passed = null;
  await apiDoor.answer({ ask: function (a, o) { passed = o; return Promise.resolve({ status: 200, body: {} }); } }, { desk: { x: {} } }, { answerMax: 123 });
  if (passed && passed.answerMax === 123) test.check('apiDoor.answer hands its opts to servers.ask');
  else test.fail('apiDoor.answer handed ' + JSON.stringify(passed));
  const node = fs.readFileSync(NODE, 'utf8');
  if (/answer\(appClient, body && body\.ask, \{ answerMax: require\('\.\/limits'\)\.PAYLOAD_MAX \}\)/.test(node)) test.check('jobs.api asks with PAYLOAD_MAX');
  else test.fail('jobs.api does not ask with limits.PAYLOAD_MAX');

  test.subHeading('item.get fills the room it is given');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskroom-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const call = function (verb, args, opts) { const q = {}; q[verb] = args; return client.ask({ desk: q }, opts).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
    await call('session.set', { json: JSON.stringify({ goal: { id: 'r/G1', title: 'Room' }, items: [] }), by: 'claude-windows' });
    await call('box.write', { id: 'r/G1', text: 'B'.repeat(3000), version: 0, by: 'claude-windows' });
    for (let i = 0; i < 30; i++) await call('chat.add', { id: 'r/G1', text: 'LINE-' + String(i).padStart(2, '0') + ' ' + 'x'.repeat(600), by: 'wsl-claude' });
    const small = await call('item.get', { id: 'r/G1' });
    const big = await call('item.get', { id: 'r/G1', room: limits.PAYLOAD_MAX }, { answerMax: limits.PAYLOAD_MAX });
    const sc = ((small.body || {}).chat || []).length;
    const bc = ((big.body || {}).chat || []).length;
    const bigBytes = Buffer.byteLength(JSON.stringify(big.body || {}), 'utf8');
    if (small.status === 200 && Buffer.byteLength(JSON.stringify(small.body), 'utf8') <= appClient.ANSWER_MAX) test.check('without a room, item.get still fits one agent answer (' + sc + ' lines)');
    else test.fail('item.get without a room answered ' + small.status + ', ' + Buffer.byteLength(JSON.stringify(small.body || {}), 'utf8') + ' bytes');
    if (big.status === 200 && bc > sc * 2 && bigBytes <= limits.PAYLOAD_MAX) test.check('with the page room it holds ' + bc + ' lines, ' + bigBytes + ' bytes, within MAX_PAYLOAD');
    else test.fail('with the page room: status ' + big.status + ', ' + bc + ' lines against ' + sc + ', ' + bigBytes + ' bytes' + (big.body && big.body.code ? ', ' + big.body.code : ''));
  } catch (e) {
    test.fail('the run broke: ' + (e && e.stack || e));
  }
  kid.kill();

  test.subHeading('the item dialog asks with the page room');
  const src = fs.readFileSync(DETAILS, 'utf8');
  if (/item\.get'?,\s*\{\s*id:\s*ddId,\s*room:/.test(src)) test.check('deskDetails asks item.get with a room');
  else test.fail('deskDetails asks item.get without a room');

  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
