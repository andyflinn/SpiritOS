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
// WHAT IS ASSERTED, on a scratch process server of this suite's own. SINCE goal/G30.4 the AGENTS verbs are gone and
// the family folder (<script>.family beside the script) is read through its FS verbs, so each point asks FS:
//   1. FS.loadFile {path: 'AGENTS.md'} answers the AGENTS.md, and AGENTS is no verb any more.
//   2. FS.search {q: ''} lists the folder's files in the list form {items: [{key, label}], more}: the verb that has a
//      file is there as <verb>.json, a declared verb with no file is not.
//   3. FS.loadJsonValue {path: '<verb>.json'} answers that verb's file as it stands on disc.
//   4. A verb with no file is closed to the family: its FS.loadJsonValue has no value.
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

test.startTest('goal/G10.5: the family folder on a process server, read through FS (goal/G30.4)');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-introspectorfamily-'));
const dir = path.join(scratch, 'probe');
const state = path.join(scratch, 'state');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(state, { recursive: true });
const script = path.join(dir, 'probe.js');
fs.writeFileSync(script, SERVER_JS);
// The family folder is probe.family beside probe.js (goal/G30.4).
const familyDir = path.join(dir, 'probe.family');
fs.mkdirSync(familyDir, { recursive: true });
fs.writeFileSync(path.join(familyDir, 'AGENTS.md'), AGENTS_MD);
// One file per allowed verb, in the server's family folder, the verb name as the file name (the box's FILE NAMES).
fs.writeFileSync(path.join(familyDir, 'item.add.json'), JSON.stringify(ADD_FILE, null, 2) + '\n');
fs.writeFileSync(path.join(familyDir, 'ghost.walk.json'), JSON.stringify(GHOST_FILE, null, 2) + '\n');

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

  test.subHeading('1. FS.loadFile answers the AGENTS.md in the family folder');
  const md = await call('FS.loadFile', { path: 'AGENTS.md' });
  if (md.body && String(md.body.text || '').indexOf('Probe: rules for agents') !== -1) test.check('the world: FS.loadFile answers the AGENTS.md (appServer.js withAgents)');
  else { test.fail('the world: FS.loadFile answered ' + short(md) + '; the shape of goal/G30.4 moved'); return; }
  const gone = await call('AGENTS', {});
  if (gone.body && gone.body.code === 'no-such-verb') test.check('AGENTS is no verb any more (goal/G30.4)');
  else test.fail(OWED + 'AGENTS still answered ' + short(gone));

  test.subHeading('2. FS.search lists the folder\'s files: the verb with a file, not the one without');
  const list = await call('FS.search', { q: '' });
  const items = list.body && Array.isArray(list.body.items) ? list.body.items : null;
  if (items) test.check('FS.search answers the list form {items, more}');
  else test.fail(OWED + 'FS.search answered ' + short(list));
  const keys = (items || []).map(function (x) { return x && x.key; });
  if (items && keys.indexOf('item.add.json') !== -1) test.check('it lists item.add.json, the verb that has a file');
  else if (items) test.fail(OWED + 'it lists ' + short(keys) + ', without item.add.json');
  if (items && keys.indexOf('secret.burn.json') === -1) test.check('it leaves out secret.burn, declared with no file');
  else if (items) test.fail(OWED + 'it lists secret.burn.json, which has no verb file: ' + short(keys));
  if (items && (items[0] || {}).label) test.check('each entry carries its label');
  else if (items) test.fail(OWED + 'the entries carry no label: ' + short(items));

  test.subHeading('3. FS.loadJsonValue answers that verb\'s file as it stands');
  const one = await call('FS.loadJsonValue', { path: 'item.add.json' });
  if (one.body && one.body.value && String(one.body.value.description || '').indexOf('Add one row to the probe') !== -1) test.check('FS.loadJsonValue of item.add.json answers the file, its description with it');
  else test.fail(OWED + 'FS.loadJsonValue of item.add.json answered ' + short(one));

  test.subHeading('4. a declared verb with no file is closed to the family');
  const closed = await call('FS.loadJsonValue', { path: 'secret.burn.json' });
  const noFile = closed.body && closed.body.value == null;
  if (noFile) test.check('secret.burn has no verb file: FS.loadJsonValue of secret.burn.json has no value, so nothing describes it');
  else test.fail(OWED + 'FS.loadJsonValue of secret.burn.json answered ' + short(closed) + ', although no file allows it');

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
