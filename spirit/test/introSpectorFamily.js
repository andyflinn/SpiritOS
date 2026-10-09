'use strict';

// goal/G10.5: the AGENTS family on a process server's door. Red on today's code; wsl-claude wrote it from the item's
// box at d6e9df7d and does not build it.
//   Andy, 2026-10-09: "that is a decision. make it so."; "the verb-file should be readable/fetchable by the loopback
//   client through a multiplexed AGENTS interface"; "plus one verb AGENTS.introspect that will return only the verbs
//   available?"; ".. and if there's no AGENTS.md the verb is closed for the agent, period."; "this way we can slowly
//   add verbs that are agent-safe".
//
// WHAT IS TRUE TODAY (read in the tree at d6e9df7d): appServer gives a server one AGENTS verb, {} to {text}, when an
// AGENTS.md sits beside its script (appServer.js:357, withAgents); there is no AGENTS.introspect, no AGENTS.<verb>,
// no folder of verb files, and nothing is said at boot about a file naming a verb that does not exist. A verb name
// may already be dotted and up to 64 characters (appServer.js:47), so the family needs no new mechanism, which is
// why the item's box says so.
//
// WHAT IS ASSERTED, on a scratch process server of this suite's own:
//   1. AGENTS {} still answers the AGENTS.md (the world, unchanged).
//   2. AGENTS.introspect lists the verbs that have a file, in the list form {items: [{key, label}], more}, and
//      nothing else: a declared verb with no file is not listed.
//   3. AGENTS.<verb> answers that verb's file as it stands on disc.
//   4. A verb with no file is closed to the family (the world check: it is refused, today for want of the verb).
//   5. A verb file naming a verb the server never declared is said at boot.
// The node's own namespaces are the sibling suite's (introSpectorNode.js).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G10.5: ';
const REPO = path.join(__dirname, '..', '..');
const INTROSPECTOR_REL = 'spirit/run/js/introSpector.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// THE SCRATCH SERVER: two declared verbs, one of them with a verb file, plus a file naming a verb nobody declared.
const AGENTS_MD = '# Probe: rules for agents\n\nThis server exists for one suite and answers two verbs.\n';
const ADD_FILE = { description: 'Add one row to the probe, and answer its id.' };
const GHOST_FILE = { description: 'A verb this server never declared.' };
// serve() takes the verb table itself, and finds the AGENTS.md beside argv[1] (appServer.js:392).
const SERVER_JS = [
  "'use strict';",
  "const appServer = require(process.env.PROBE_APPSERVER);",
  'appServer.serve({',
  "  'item.add': { request: { title: '' }, reply: { id: '' }, handler: function (a) { return { id: 'probe/' + String(a.title || '') }; } },",
  "  'secret.burn': { request: {}, reply: { burned: false }, handler: function () { return { burned: true }; } },",
  '});',
  '',
].join('\n');

test.startTest('goal/G10.5: the AGENTS family on a process server');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-introspectorfamily-'));
const dir = path.join(scratch, 'probe');
const state = path.join(scratch, 'state');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(state, { recursive: true });
const script = path.join(dir, 'probe.js');
fs.writeFileSync(script, SERVER_JS);
fs.writeFileSync(path.join(dir, 'AGENTS.md'), AGENTS_MD);
// One file per allowed verb, in the server's own folder, the verb name as the file name (the box's FILE NAMES).
fs.writeFileSync(path.join(dir, 'item.add.json'), JSON.stringify(ADD_FILE, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'ghost.walk.json'), JSON.stringify(GHOST_FILE, null, 2) + '\n');

const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'probe', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('probe', pipe);
const call = function (verb, args) {
  const q = {}; q[verb] = args || {};
  return client.ask({ probe: q }).then(
    function (r) { return { status: (r || {}).status, body: (r || {}).body, thrown: null }; },
    function (e) { return { status: 0, body: null, thrown: { message: e && e.message, refusal: e && e.refusal } }; });
};
let kid = null;
let boot = '';
async function start() {
  kid = spawn(process.execPath, [script, '{}', '--pipe', pipe, '--state', state],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: Object.assign({}, process.env, { PROBE_APPSERVER: path.join(REPO, 'spirit', 'run', 'js', 'appServer.js') }) });
  kid.stdout.on('data', function (d) { boot += String(d); });
  kid.stderr.on('data', function (d) { boot += String(d); });
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.probe && r.body.probe.ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }

(async function () {
  // ONE SENTENCE FOR THE ABSENT UNIT, not one per assertion it would have fed.
  if (!fs.existsSync(path.join(REPO, INTROSPECTOR_REL))) test.fail(OWED + INTROSPECTOR_REL + ' is not in the tree yet, so nothing below can be answered by it');

  if (!await start()) { test.fail('the probe server did not start: ' + short(boot)); return; }

  test.subHeading('1. AGENTS {} still answers the file beside the script');
  const md = await call('AGENTS', {});
  if (md.body && String(md.body.text || '').indexOf('Probe: rules for agents') !== -1) test.check('the world: AGENTS answers the AGENTS.md (appServer.js withAgents)');
  else { test.fail('the world: AGENTS answered ' + short(md) + '; the shape of slim/G1.8 moved'); return; }

  test.subHeading('2. AGENTS.introspect lists the verbs that have a file, and nothing else');
  const list = await call('AGENTS.introspect', {});
  const items = list.body && Array.isArray(list.body.items) ? list.body.items : null;
  if (items) test.check('AGENTS.introspect answers the list form {items, more}');
  else test.fail(OWED + 'AGENTS.introspect answered ' + short(list));
  const keys = (items || []).map(function (x) { return x && x.key; });
  if (items && keys.indexOf('item.add') !== -1) test.check('it lists item.add, the verb that has a file');
  else if (items) test.fail(OWED + 'it lists ' + short(keys) + ', without item.add');
  if (items && keys.indexOf('secret.burn') === -1) test.check('it leaves out secret.burn, declared with no file');
  else if (items) test.fail(OWED + 'it lists secret.burn, which has no verb file: ' + short(keys));
  if (items && (items[0] || {}).label) test.check('each entry carries its label');
  else if (items) test.fail(OWED + 'the entries carry no label: ' + short(items));

  test.subHeading('3. AGENTS.<verb> answers that verb\'s file as it stands');
  const one = await call('AGENTS.item.add', {});
  if (one.body && JSON.stringify(one.body).indexOf('Add one row to the probe') !== -1) test.check('AGENTS.item.add answers the file, its description with it');
  else test.fail(OWED + 'AGENTS.item.add answered ' + short(one));

  test.subHeading('4. a declared verb with no file is closed to the family');
  const closed = await call('AGENTS.secret.burn', {});
  const refused = !closed.body || closed.body.ok === false || closed.thrown;
  if (refused) test.check('the world: AGENTS.secret.burn is refused (today for want of the verb itself)');
  else test.fail(OWED + 'AGENTS.secret.burn answered ' + short(closed) + ', although no file allows it');

  test.subHeading('5. a verb file naming a verb nobody declared is said at boot');
  if (/ghost\.walk/.test(boot)) test.check('the boot names ghost.walk.json, the stale file');
  else test.fail(OWED + 'the boot says nothing of ghost.walk.json; it said: ' + short(boot.replace(/\s+/g, ' ')));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
