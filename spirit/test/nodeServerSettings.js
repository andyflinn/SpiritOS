'use strict';

// spirit/test/nodeServerSettings.js
// A NODE'S OWN SETTINGS FOR THE SERVERS IT RUNS — goal/G33.9, written FIRST,
// red on today's code (wsl-claude tests, another agent builds).
//
//   The box (v3): "A node keeps its own settings for the servers it runs, in its own state (relay-state), never in a
//   tracked file", "A per-node setting overrides the server manifest's default for that node only; with none set, the
//   manifest's default stands", "The same mechanism covers which servers a node runs", "A value that is not a setting
//   the manifest names is ignored and named once in the node log at start", "It is for the node's servers under
//   process/js only", "The override reaches every place the node decides from a manifest: starting its servers, and a
//   server started by hand".
//
// THE FILE. "One plain file in the node's state folder, written by the node's owner": the node already has that file,
// relay-state/node.json, the owner's and only read by the node (js/nodeSettings.js). The servers' settings are one
// more entry in it, by the server's name:
//
//   { "servers": { "deskClient": { "runs": ["home"] }, "deskVerify": { "chores": "node ... publishData.js" } } }
//
// THE CONTRACT:
//   T1 with no settings, the manifest stands: runs [] is not started, runs ["home"] is, with its defaults
//   T2 a node's runs ["home"] starts a server whose manifest says runs []
//   T3 a node's runs [] keeps a server from starting whose manifest says runs ["home"]
//   T4 a node's value for an argument the manifest names is the one the server is handed; the others keep their defaults
//   T5 a value the manifest does not name is not handed over, and the node log names it once at start
//   T6 a server started by hand follows the node's runs too, both ways
//   T7 the settings file is not tracked: relay-state/node.json is ignored by git

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');
const auth = require('../run/spirit/relayAuth.js');

const OWED = 'OWED by goal/G33.9: ';
const REPO = path.join(__dirname, '..', '..');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const jobs = require('../run/spirit/jobs.js')(kernel, 65433);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodeserversettings-'));
const started = [];

// A server that writes the values it was handed into its state folder, so the suite reads what the node gave it.
const TELLER = [
  "const fs = require('fs'); const path = require('path');",
  "const i = process.argv.indexOf('--state');",
  "try { fs.writeFileSync(path.join(process.argv[i + 1], 'values.json'), process.argv[2] || ''); } catch (e) {}",
  'setInterval(function () {}, 1000);',
].join('\n') + '\n';

// A node's run folder of its own (nodeSettings reads node.json once per home), with two servers: 'quiet', whose
// manifest says it runs nowhere, and 'teller', whose manifest says home, each with two arguments.
let homes = 0;
function plantNode(settings) {
  const run = path.join(scratch, 'node' + (++homes), 'spirit', 'run');
  [['quiet', []], ['teller', ['home']]].forEach(function (s) {
    const dir = path.join(run, 'process', 'js', s[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, s[0] + '.json'), JSON.stringify({
      runs: s[1], label: s[0], kind: 'server', operated: 'node',
      args: [{ name: 'chores', default: '' }, { name: 'pollMs', default: '60000' }],
    }));
    fs.writeFileSync(path.join(dir, s[0] + '.js'), TELLER);
  });
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  auth.saveIdentity(run, auth.generateIdentity('settings' + homes));
  if (settings) fs.writeFileSync(path.join(run, 'relay-state', 'node.json'), JSON.stringify(settings));
  return run;
}

// The boot of one node, with what it said while booting.
function boot(run) {
  const said = [];
  const keep = { log: console.log, warn: console.warn, error: console.error };
  ['log', 'warn', 'error'].forEach(function (k) { console[k] = function () { said.push(Array.prototype.join.call(arguments, ' ')); }; });
  let booted = [];
  try { booted = jobs.startNodeServers(run) || []; } catch (e) { said.push('threw ' + e.message); }
  finally { console.log = keep.log; console.warn = keep.warn; console.error = keep.error; }
  booted.forEach(function (j) { started.push(j); });
  return { names: booted.map(function (j) { return j && j.type; }).sort(), said: said };
}

// What a booted server was handed, once it has written it.
async function handed(run, name) {
  const file = path.join(run, 'relay-state', 'process', name, 'values.json');
  for (let i = 0; i < 40; i++) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { await sleep(100); }
  }
  return null;
}

function byHand(run, name) {
  try {
    const j = jobs.startJob('node', [path.join(run, 'process', 'js', name, name + '.js'), '{}'], { type: name + '-by-hand' });
    if (j && j.id) started.push(j);
    return { started: !!(j && j.id) };
  } catch (e) { return { refusal: e.refusal || e.message }; }
}

test.startTest('goal/G33.9: a node keeps its own settings for the servers it runs');

(async function () {
  test.subHeading('T1: with no settings, the manifest stands');
  const plain = plantNode(null);
  const b1 = boot(plain);
  const v1 = b1.names.indexOf('teller') !== -1 ? await handed(plain, 'teller') : null;
  if (JSON.stringify(b1.names) === '["teller"]' && v1 && v1.chores === '' && v1.pollMs === '60000') {
    test.check('only teller starts, handed its manifest defaults');
  } else test.fail('the manifest no longer stands without settings: started ' + JSON.stringify(b1.names) + ', teller handed ' + JSON.stringify(v1));

  test.subHeading('T2: the node\'s runs ["home"] starts a server whose manifest says runs []');
  const on = plantNode({ servers: { quiet: { runs: ['home'] } } });
  const b2 = boot(on);
  if (b2.names.indexOf('quiet') !== -1) test.check('quiet starts on this node');
  else test.fail(OWED + 'node.json says quiet runs home, started ' + JSON.stringify(b2.names));

  test.subHeading('T3: the node\'s runs [] keeps a server from starting whose manifest says runs ["home"]');
  const off = plantNode({ servers: { teller: { runs: [] } } });
  const b3 = boot(off);
  if (b3.names.indexOf('teller') === -1) test.check('teller does not start on this node');
  else test.fail(OWED + 'node.json says teller runs nowhere, started ' + JSON.stringify(b3.names));

  test.subHeading('T4: the node\'s value for a named argument is what the server is handed; the rest keep their defaults');
  const chore = 'node spirit/run/process/js/deskClient/publishData.js';
  const set = plantNode({ servers: { teller: { chores: chore } } });
  const b4 = boot(set);
  const v4 = b4.names.indexOf('teller') !== -1 ? await handed(set, 'teller') : null;
  if (v4 && v4.chores === chore && v4.pollMs === '60000') test.check('teller is handed chores from node.json and pollMs from its manifest');
  else test.fail(OWED + 'teller handed ' + JSON.stringify(v4) + ', node.json says chores ' + JSON.stringify(chore));

  test.subHeading('T5: a value the manifest does not name is not handed over, and the node log names it once');
  const typo = plantNode({ servers: { teller: { chorse: 'x' } } });
  const b5 = boot(typo);
  const v5 = b5.names.indexOf('teller') !== -1 ? await handed(typo, 'teller') : null;
  const named = b5.said.filter(function (l) { return /chorse/.test(l); });
  if (v5 && !('chorse' in v5) && v5.chores === '') test.check('chorse is not handed to teller');
  else test.fail('teller handed ' + JSON.stringify(v5) + ' for a setting its manifest does not name');
  if (named.length === 1 && /teller/.test(named[0])) test.check('the boot names it once, with its server: ' + named[0]);
  else test.fail(OWED + 'the boot said of chorse ' + JSON.stringify(named) + ' (all it said: ' + JSON.stringify(b5.said.slice(0, 5)) + ')');

  test.subHeading('T6: a server started by hand follows the node\'s runs, both ways');
  const h1 = byHand(on, 'quiet');
  if (h1.started) test.check('quiet starts by hand on the node whose node.json runs it');
  else test.fail(OWED + 'quiet by hand where node.json runs it: ' + JSON.stringify(h1));
  const h2 = byHand(off, 'teller');
  if (h2.refusal === 'process-not-included') test.check('teller by hand is refused process-not-included where node.json runs it nowhere');
  else test.fail(OWED + 'teller by hand where node.json runs it nowhere: ' + JSON.stringify(h2));

  test.subHeading('T7: the settings file is not tracked');
  let ignored = false;
  try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', 'spirit/run/relay-state/node.json']); ignored = true; } catch (e) { ignored = false; }
  if (ignored) test.check('git ignores spirit/run/relay-state/node.json, so a clone pulls clean');
  else test.fail('spirit/run/relay-state/node.json is not ignored by git');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
