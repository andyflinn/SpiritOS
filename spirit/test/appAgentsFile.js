'use strict';

// spirit/test/appAgentsFile.js
// AN APP SERVER WITH AN AGENTS.md ANSWERS AGENTS — slim/G1.8, written FIRST,
// red on today's code (wsl-claude tests, claude-windows builds).
//
//   Andy, 2026-09-29: "the verb would be upper-case "AGENTS"", "the response
//   to agents is a file on disc called AGENTS?"; 2026-09-30: "great idea!
//   than agent participation on an app can be introduced without changing
//   code", "i can live with the AGENTS.md auto-detection mechanism in
//   appServer".
//
// THE CONTRACT:
//   T1 a server whose script has an AGENTS.md beside it lists AGENTS in its
//      api, {request: {}, reply: {text: ''}}, and AGENTS {} answers the file
//   T2 read per ask: an edit to the file is the next answer, no restart
//   T3 no AGENTS.md, no verb: api does not list it, and asking it is
//      no-such-verb, as any verb the server lacks
//   T4 bounded: a file too big for one answer is refused by name, never cut
//   T5 the desk server has one (process/js/desk/AGENTS.md), and answers it

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by slim/G1.8: ';
const HELPER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('slim/G1.8: an app server with an AGENTS.md answers AGENTS');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agentsfile-'));
const kids = [];
const client = appClient.createAppClient({ rootDir: scratch });

// One tiny server in its own folder, one verb of its own.
function plant(name, agentsText) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.js'),
    'require(' + JSON.stringify(HELPER) + ').serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } });\n');
  if (agentsText != null) fs.writeFileSync(path.join(dir, 'AGENTS.md'), agentsText);
  return dir;
}
async function start(name, script, extra) {
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, name, 'win32', 'process') : path.join(scratch, name + '.sock');
  kids.push(spawn(process.execPath, [script].concat(extra || []).concat(['--pipe', pipe]), { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  client.register(name, pipe);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[name] && r.body[name].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function ask(name, verb, args) { const b = {}; b[verb] = args || {}; const q = {}; q[name] = b; return client.ask(q); }

(async function () {
  const withDir = plant('withrules', 'RULE-ONE: say READY TO CLOSE first.\n');
  const noDir = plant('norules', null);
  const bigDir = plant('bigrules', 'X'.repeat(appClient.ANSWER_MAX + 100));
  await start('withrules', path.join(withDir, 'withrules.js'));
  await start('norules', path.join(noDir, 'norules.js'));
  await start('bigrules', path.join(bigDir, 'bigrules.js'));
  const api = (await client.ask('api')).body || {};

  test.subHeading('T1: an AGENTS.md beside the script: AGENTS is in its api, and answers the file');
  const listed = api.withrules && api.withrules.AGENTS;
  const r1 = await ask('withrules', 'AGENTS');
  if (listed && JSON.stringify(listed) === JSON.stringify({ request: {}, reply: { text: '' } }) &&
      r1.status === 200 && r1.body && r1.body.text === 'RULE-ONE: say READY TO CLOSE first.\n') {
    test.check('api lists AGENTS {} -> {text}, and AGENTS answers the file word for word');
  } else test.fail(OWED + 'api lists ' + JSON.stringify(listed) + ', AGENTS answered ' + r1.status + ' ' + JSON.stringify(r1.body).slice(0, 120));

  test.subHeading('T2: read per ask: an edit is the next answer');
  fs.writeFileSync(path.join(withDir, 'AGENTS.md'), 'RULE-TWO: edited.\n');
  const r2 = await ask('withrules', 'AGENTS');
  if (r2.status === 200 && r2.body && r2.body.text === 'RULE-TWO: edited.\n') test.check('the edited file came back, no restart');
  else test.fail(OWED + 'after an edit AGENTS answered ' + JSON.stringify(r2.body).slice(0, 120));

  test.subHeading('T3: no AGENTS.md, no verb');
  const r3 = await ask('norules', 'AGENTS');
  if (api.norules && !api.norules.AGENTS && api.norules.ping && r3.body && r3.body.code === 'no-such-verb') {
    test.check('its api lists ping and no AGENTS, and asking AGENTS is no-such-verb');
  } else test.fail(OWED + 'api ' + JSON.stringify(api.norules) + ', AGENTS answered ' + JSON.stringify(r3.body).slice(0, 120));

  test.subHeading('T4: a file too big for one answer is refused by name, never cut');
  const r4 = await ask('bigrules', 'AGENTS');
  const text4 = r4.body && typeof r4.body.text === 'string' ? r4.body.text : '';
  // Not vacuous: the verb exists for this server (it has the file), so the
  // refusal must be for its size, not no-such-verb.
  if (api.bigrules && api.bigrules.AGENTS && r4.body && r4.body.ok === false && typeof r4.body.code === 'string' &&
      r4.body.code && r4.body.code !== 'no-such-verb' && !text4) {
    test.check('refused as ' + r4.body.code + ', no partial text');
  } else test.fail(OWED + 'a too-big AGENTS.md answered ' + r4.status + ' ' + JSON.stringify(r4.body).slice(0, 120));

  test.subHeading('T5: the desk server has its AGENTS.md, and answers it');
  const deskFile = path.join(path.dirname(DESK), 'AGENTS.md');
  const state = path.join(scratch, 'deskstate');
  fs.mkdirSync(state, { recursive: true });
  const up = await start('desk', DESK, ['{}', '--state', state]);
  const r5 = up ? await ask('desk', 'AGENTS') : { status: 0 };
  let onDisk = null;
  try { onDisk = fs.readFileSync(deskFile, 'utf8'); } catch (e) { onDisk = null; }
  if (onDisk && onDisk.trim() && r5.status === 200 && r5.body && r5.body.text === onDisk) test.check('process/js/desk/AGENTS.md exists and the desk server answers it');
  else test.fail(OWED + 'desk AGENTS.md ' + (onDisk ? onDisk.length + ' bytes' : 'missing') + ', desk answered ' + r5.status + ' ' + JSON.stringify(r5.body).slice(0, 100));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
