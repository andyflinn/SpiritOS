'use strict';

// goal/G4.33: publishData.js, one measurement run per agent, its data in agents/<agent>/. Red on today's tree;
// wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04 (the box of goal/G4.33 holds every line verbatim): "so one single script for all of you puts the
//   data into the repo"; "this is desk stuff."; "it will be automated under deskClient. so the deskClient scripts calls
//   - spirit/test/measurePlatform.js?"; "publishData.js?"; to the old folders: "yes." and "claude-ubuntu must be
//   included."; to the studies: "Studies like packet-turnaround-measurements, yes." and "they need packaging for
//   publishing."; the commit: "automated publishing will have a standing grant, attached to the script in deskClient";
//   "and the whole agent-specific folders will be included per agent."; his Go on goal/G4.33. The utility process it
//   runs on is goal/G4.34 (built, ba4d91e1).
//
// THE SHAPES (the box's; where it names none, wsl-claude's picks, the builder may argue them in Desk first):
//   1  MOVED, NOT DOUBLED: README/CAPACITY/ubuntu-24.04-wsl2 is agents/wsl-claude, windows-10.0 is agents/claude-windows
//      (capacity.json, capacity.md, harness.json, harness.txt, platform.md each), README/CAPACITY/ is gone; the desk-lanes
//      study is agents/<agent>/studies/2026-10-02-desk-lanes/ with its README.md and that agent's own .tsv, and
//      relayLab/measurements/ is gone; README.md links agents/. No test or tool writes README/CAPACITY/ any more.
//      (Two core files mention README/CAPACITY.md in comments only, nodeSettings.js 37 and relay.js 135; a doc, not a
//      path the code uses, so not asserted.)
//   2  PACKETS: node spirit/run/process/js/deskClient/publishData.js <port> --only packets --asks <N> --out <dir> makes N
//      read-only desk asks from that node and writes packets.json {posts, waitMs: {median, max}, flight: {median, max},
//      retried, refusals, measuredAt, commit} and packets.md from its own traffic rows, plus platform.md naming the
//      agent and commit, and README.md, the folder's front page (agent, date, what the files are). Every file dated.
//      --only packets skips measurePlatform.js (a harness inside the harness would never end). It reads the traffic
//      log of the node that runs from the clone it is run in, <clone>/spirit/run/relay-state/node.db (no verb reads it);
//      the node holds that file open, so a read-only copy is the safe way.
//   3  THE STANDING GRANT: a commit whose files all lie in agents/<this agent>/ passes the commit check with no item;
//      any other file, or another agent's folder, is checked as today. The agent's name is the one Andy set in its
//      profile (profile.get), as the folders are named by it.
//   4  THE TRIGGER: his group-chat line exactly "publish" (Q13) makes the agent's deskClient start publishData.js as a
//      job of type publishData on its own node, with removeWhenDone; N for that run is 20 (Q14). Any other line starts
//      nothing. Whether the job also passes --asks 20 is the builder's; not asserted.
//
// REOPENED 2026-10-05 FOR THE FIRST PUBLISH'S FLAWS (Andy pressed Reopen after "publish" ran on all three boxes; to
// Q15, pull before push, "done"). The box's FIXES, numbered as there:
//   5  (fix 1) PULL BEFORE PUSH: when another clone pushed meanwhile, a publish rebases onto it and its push goes in.
//      claude-windows's push was refused for exactly that and pushed by hand (bccf0c75). "Tries once more if refused"
//      needs a push racing inside the run, which a test cannot stage reliably; not asserted.
//   6  (fix 2) THE HARNESS IN A WORKTREE: measurePlatform.js runs in a temporary git worktree of the commit being
//      published, not in the live clone beside the running node; its files come back into agents/<agent>/ and the
//      worktree is removed. wsl-claude's run lost its deskClient during the harness (its door.sock remade at 00:40, the
//      process itself still running), so its 20 asks counted 0 posts and nothing was committed. Seen here by a stub
//      measurePlatform.js committed in the clone, which notes where it ran; the packet asks then count on a calm node.
// LEFT OPEN, not asserted: fix 3, README.md's front-page capacity block after a publish, by the publishing agent or by
// hand under an item; the box keeps it open.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const { mintOwnerInvite } = require('./ownerClaim.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const invites = require('../run/js/invites.js');
const relayStore = require('../run/js/relayStore.js');
const includeList = require('../run/js/includeList.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.33: ';
const REPO = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(REPO, 'spirit', 'run', 'process', 'js', 'desk');
// IN deskClient's FOLDER, not desk's: jobs.create refuses a script under process/js/<name>/ unless that folder is on the
// node's include list (jobs.js 404-418, refuseUnlisted), and an agent's node includes deskClient but never desk (which
// would start a desk server there). Found in the dry run of section 4. Andy: "it will be automated under deskClient."
const PUBLISH = path.join(REPO, 'spirit', 'run', 'process', 'js', 'deskClient', 'publishData.js');
const ONBOARD = path.join(DESK_DIR, 'onboard.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEApublishDataTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function exists(rel) { return fs.existsSync(path.join(REPO, rel)); }
function freePort() { return new Promise(function (resolve) { const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }
function waitFor(fn, ms) { const until = Date.now() + (ms || 15000); return (function again() { return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) { if (ok || Date.now() > until) return ok; return sleep(200).then(again); }); })(); }
function verb(port, body) {
  const once = function () { return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) { let b = {}; try { b = JSON.parse(r.text); } catch (e) { b = {}; } return { status: r.status, body: b }; }, function () { return { status: 0, body: {} }; }); };
  return once().then(function (r) { return r.status ? r : sleep(200).then(once); });
}

test.startTest('goal/G4.33: publishData, every agent\'s data in agents/<agent>/');

test.subHeading('1. moved, not doubled');
{
  const files = ['capacity.json', 'capacity.md', 'harness.json', 'harness.txt', 'platform.md'];
  ['wsl-claude', 'claude-windows'].forEach(function (agent) {
    const missing = files.filter(function (f) { return !exists('agents/' + agent + '/' + f); });
    if (!missing.length) test.check('agents/' + agent + '/ holds ' + files.join(', '));
    else test.fail(OWED + 'agents/' + agent + '/ lacks ' + missing.join(', '));
    const study = 'agents/' + agent + '/studies/2026-10-02-desk-lanes/';
    if (exists(study + 'README.md') && fs.existsSync(path.join(REPO, study)) && fs.readdirSync(path.join(REPO, study)).some(function (f) { return /\.tsv$/.test(f); })) test.check(study + ' holds the study\'s README.md and this agent\'s .tsv');
    else test.fail(OWED + study + ' is missing or lacks README.md and a .tsv');
  });
  if (!exists('README/CAPACITY')) test.check('README/CAPACITY/ is gone');
  else test.fail(OWED + 'README/CAPACITY/ still exists');
  if (!exists('relayLab/measurements')) test.check('relayLab/measurements/ is gone');
  else test.fail(OWED + 'relayLab/measurements/ still exists');
  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  if (/\]\((\.\/)?agents\/?/.test(readme)) test.check('README.md links agents/');
  else test.fail(OWED + 'README.md has no link to agents/');
  // The tools build the path as path.join(..., 'README', 'CAPACITY', ...) (measurePlatform.js 136, measureCapacity.js
  // 566, publishCapacity.js 58 and 71, capacityFresh.js 49, capacityRule.js 102), so that is what is looked for.
  const writers = ['measurePlatform.js', 'measureCapacity.js', 'publishCapacity.js', 'capacityFresh.js', 'capacityRule.js'].filter(function (f) {
    return /'README',\s*'CAPACITY'/.test(fs.readFileSync(path.join(REPO, 'spirit', 'test', f), 'utf8'));
  });
  if (!writers.length) test.check('no tool builds a README/CAPACITY path any more');
  else test.fail(OWED + 'still building README/CAPACITY as a path: ' + writers.join(', '));
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publishdata-'));
const kids = [];
function startNode(home, port, extra) { const k = spawn(process.execPath, ['js/server.js', '--port', String(port)].concat(extra || []), { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] }); kids.push(k); return k; }
function plant(name) { const h = path.join(scratch, name, 'spirit', 'run'); plantRun.plantRunTree(h); return h; }
function pointAt(home, url) { fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true }); fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'spirit', url: url }])); }

(async function () {
  if (!fs.existsSync(PUBLISH)) { test.fail(OWED + 'there is no spirit/run/process/js/deskClient/publishData.js; sections 2 and 3 cannot run'); return; }

  // THE WORLD, as agentOnboard builds it: a relay, Andy's node with the desk, an agent joined by onboard.js.
  const relayHome = plant('relay');
  fs.rmSync(path.join(relayHome, 'relay-state'), { recursive: true, force: true });
  const relayPort = await freePort();
  startNode(relayHome, relayPort, ['--relay']);
  const relayUrl = 'http://127.0.0.1:' + relayPort;
  await waitFor(function () { return fetch(relayUrl + '/api/relay/key').then(function (r) { return r.ok; }); });
  const andyHome = plant('andy');
  includeList.add(andyHome, 'process/js/desk');
  pointAt(andyHome, relayUrl);
  const andyPort = await freePort();
  startNode(andyHome, andyPort);
  await waitFor(function () { return verb(andyPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); });
  const oi = mintOwnerInvite(relayHome, 'andy');
  await verb(andyPort, { verb: 'relay.claim', url: relayUrl, name: 'andy', invite: oi.token, inviteLabel: 'andy' });
  const deskPipe = appClient.createAppClient({ rootDir: andyHome });
  deskPipe.register('desk', appClient.pipePathFor(andyHome, 'desk', process.platform, 'process'));
  const deskAsk = function (v, a) { const q = {}; q[v] = a; return deskPipe.ask({ desk: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  await waitFor(function () { return deskAsk('state.get', {}).then(function (r) { return r.status === 200; }); });
  await deskAsk('session.set', { json: JSON.stringify({ goal: { id: 'p/G1', title: 'Publish' }, items: [{ id: 'p/G1.1', title: 'Work', blocks: ['p/G1'] }] }) });
  // THE AGENT'S NODE RUNS FROM ITS OWN CLONE (AGENT_ONBOARDING.md, step 1), so publishData finds the node's traffic
  // log at <clone>/spirit/run/relay-state/node.db, the one place it can read it: no verb reads that log.
  const clone = path.join(scratch, 'clone');
  const agentHome = path.join(clone, 'spirit', 'run');
  plantRun.plantRunTree(agentHome);
  spawnSync('git', ['init', '-q'], { cwd: clone });
  pointAt(agentHome, relayUrl);
  const agentPort = await freePort();
  startNode(agentHome, agentPort);
  await waitFor(function () { return verb(agentPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); });
  spawnSync('git', ['config', 'user.email', 'test@example'], { cwd: clone });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: clone });
  const mi = invites.add(relayHome, { label: 'gemma', days: 1 });
  relayStore.open(relayHome).close();
  spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + mi.token], { cwd: clone, timeout: 180000 });
  const agentKey = (await verb(agentPort, { verb: 'node.card' })).body.publicKey || '';
  await verb(andyPort, { verb: 'jobs.authGrant', key: agentKey, path: 'desk' });
  const joined = spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + mi.token], { cwd: clone, encoding: 'utf8', timeout: 180000 });
  await waitFor(function () { return deskAsk('profile.set', { agent: agentKey, name: 'gemma', nick: 'gemma' }).then(function (r) { return r.status === 200; }); });
  await waitFor(function () { return deskAsk('scope.set', { agent: agentKey, folder: 'src/' }).then(function (r) { return r.status === 200; }); });
  if (joined.status === 0) test.check('the world: the agent joined, its profile name gemma, its scope src/');
  else { test.fail('the world: onboard.js exited ' + joined.status + ': ' + short(String(joined.stdout) + String(joined.stderr))); return; }

  test.subHeading('2. the packet figures, from the agent\'s own node');
  const out = path.join(scratch, 'out');
  const run = spawnSync(process.execPath, [PUBLISH, String(agentPort), '--only', 'packets', '--asks', '5', '--out', out], { cwd: clone, encoding: 'utf8', timeout: 240000 });
  let pk = null;
  try { pk = JSON.parse(fs.readFileSync(path.join(out, 'packets.json'), 'utf8')); } catch (e) { pk = null; }
  if (run.status === 0 && pk && pk.posts >= 5) test.check('publishData.js --only packets --asks 5 exits 0 and counts ' + pk.posts + ' posts');
  else test.fail(OWED + 'publishData exited ' + run.status + ', packets.json ' + short(pk) + '; it said ' + short(String(run.stdout) + String(run.stderr)));
  const num = function (x) { return typeof x === 'number' && isFinite(x); };
  if (pk && pk.waitMs && num(pk.waitMs.median) && num(pk.waitMs.max) && pk.flight && num(pk.flight.median) && num(pk.flight.max) && num(pk.retried) && pk.refusals && typeof pk.refusals === 'object') test.check('packets.json holds waitMs and flight (median, max), retried and refusals');
  else test.fail(OWED + 'packets.json reads ' + short(pk));
  if (fs.existsSync(path.join(out, 'packets.md'))) test.check('packets.md is written beside it');
  else test.fail(OWED + 'no packets.md in ' + out);
  let platform = '';
  try { platform = fs.readFileSync(path.join(out, 'platform.md'), 'utf8'); } catch (e) { platform = ''; }
  if (/gemma/.test(platform) && /[0-9a-f]{7,}/.test(platform)) test.check('platform.md names the agent (gemma) and a commit');
  else test.fail(OWED + 'platform.md reads ' + short(platform || '(none)'));
  // DATED, AND A README (Andy, 2026-10-05: "does it generate agents/<agent>/README.md ?"; "are all the ouputfiles
  // properly dated?"). packets.json carries measuredAt (ISO) and commit as harness.json and capacity.json already do;
  // README.md is the folder's front page, naming the agent, the date and what the files are.
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  if (pk && iso.test(String(pk.measuredAt)) && /^[0-9a-f]{7,}$/.test(String(pk.commit))) test.check('packets.json is dated (measuredAt ' + pk.measuredAt + ') and names its commit');
  else test.fail(OWED + 'packets.json lacks measuredAt or commit: ' + short(pk && { measuredAt: pk.measuredAt, commit: pk.commit }));
  let readme = '';
  try { readme = fs.readFileSync(path.join(out, 'README.md'), 'utf8'); } catch (e) { readme = ''; }
  if (/gemma/.test(readme) && /\d{4}-\d{2}-\d{2}/.test(readme) && /packets/.test(readme)) test.check('README.md is written: the agent, the date, and what the files are');
  else test.fail(OWED + 'README.md reads ' + short(readme || '(none)'));

  test.subHeading('3. the standing grant: its own folder, no item');
  const commit = function (rel, msg) {
    fs.mkdirSync(path.dirname(path.join(clone, rel)), { recursive: true });
    fs.writeFileSync(path.join(clone, rel), 'x ' + Date.now() + '\n');
    spawnSync('git', ['add', rel], { cwd: clone });
    const r = spawnSync('git', ['commit', '-q', '-m', msg], { cwd: clone, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) spawnSync('git', ['reset', '-q', 'HEAD', rel], { cwd: clone });
    return { code: r.status, said: String(r.stdout) + String(r.stderr) };
  };
  const own = commit('agents/gemma/packets.json', 'publish: gemma\'s figures');
  if (own.code === 0) test.check('a commit of agents/gemma/ alone passes with no item named');
  else test.fail(OWED + 'its own folder was refused: ' + short(own.said));
  const other = commit('agents/claude-windows/packets.json', 'publish: not mine');
  if (other.code !== 0) test.check('another agent\'s folder is refused');
  else test.fail('a commit of agents/claude-windows/ by gemma passed');
  const outside = commit('README.md', 'publish: outside');
  if (outside.code !== 0) test.check('a file outside agents/gemma/, with no item, is refused as today');
  else test.fail('README.md with no item passed');

  // ── 4. THE TRIGGER (Q13, Andy: "publish"; Q14, N: "that's a fine number", 20) ──
  // His group-chat line that is exactly "publish" makes the agent's deskClient start publishData.js as a job of type
  // publishData on its own node, with removeWhenDone (goal/G4.34). Any other line starts nothing. The agent listens as
  // a real one does (deskEar running), and the job, once seen, is cancelled here: a whole publish runs the harness,
  // which cannot run inside the harness.
  test.subHeading('4. his "publish" in the group chat starts it, nothing else does');
  const ear = spawn(process.execPath, [path.join(DESK_DIR, 'deskEar.js'), String(agentPort)], { cwd: clone, stdio: ['ignore', 'ignore', 'ignore'] });
  kids.push(ear);
  await sleep(2000);
  const publishJob = function () {
    return verb(agentPort, { verb: 'jobs.search', q: 'publishData' }).then(function (r) {
      return ((r.body && r.body.items) || []).filter(function (i) { return /^publishData /.test(String(i.label)); })[0] || null;
    });
  };
  await deskAsk('chat.add', { id: 'desk/G0.0', text: 'publish later, not now' });
  await sleep(8000);
  const early = await publishJob();
  if (!early) test.check('"publish later, not now" starts nothing');
  else test.fail('a line that is not exactly "publish" started ' + short(early));
  await deskAsk('chat.add', { id: 'desk/G0.0', text: 'publish' });
  let job = null;
  await waitFor(function () { return publishJob().then(function (j) { job = j; return !!j; }); }, 60000);
  if (job) test.check('his "publish" started a publishData job on the agent\'s node (' + job.label + ')');
  else test.fail(OWED + 'no publishData job on the agent\'s node within 60 s of his "publish"');
  if (job) await verb(agentPort, { verb: 'jobs.cancel', id: job.key });
  ear.kill();
  if (job) await waitFor(function () { return publishJob().then(function (j) { return !j || !/running/.test(String(j.label)); }); }, 15000);

  // ── 5 AND 6. A WHOLE PUBLISH, ITS HARNESS A STUB ──
  // The clone gets an origin (a bare repo) and a stub spirit/test/measurePlatform.js, committed, so a worktree of HEAD
  // holds it too. The stub writes agents/<agent>/harness.json beside ITSELF (as the real one writes into its own tree)
  // and notes the folder it ran in. Then another clone pushes a commit first, as claude-ubuntu's did before
  // claude-windows's publish pushed. Setup commits and pushes skip the hooks (--no-verify): they are the world, not the
  // publish.
  test.subHeading('5 and 6. a whole publish: pull before push, the harness in a worktree');
  const g = function (args, cwd) { return spawnSync('git', args, { cwd: cwd || clone, encoding: 'utf8', timeout: 120000 }); };
  const bare = path.join(scratch, 'origin.git');
  spawnSync('git', ['init', '-q', '--bare', bare]);
  const branch = g(['symbolic-ref', '--short', 'HEAD']).stdout.trim() || 'master';
  const stub = path.join(clone, 'spirit', 'test', 'measurePlatform.js');
  fs.mkdirSync(path.dirname(stub), { recursive: true });
  fs.writeFileSync(stub, [
    "const fs = require('fs'); const path = require('path');",
    "const agent = process.argv[process.argv.indexOf('--agent') + 1];",
    "const out = path.join(__dirname, '..', '..', 'agents', agent); fs.mkdirSync(out, { recursive: true });",
    "fs.writeFileSync(path.join(out, 'harness.json'), JSON.stringify({ measuredAt: new Date().toISOString(), commit: 'stub', ranIn: __dirname }));",
  ].join('\n'));
  g(['add', 'spirit/test/measurePlatform.js']);
  g(['commit', '-q', '--no-verify', '-m', 'the stub harness']);
  g(['remote', 'add', 'origin', bare]);
  const seeded = g(['push', '-q', '--no-verify', '-u', 'origin', branch]);
  const otherClone = path.join(scratch, 'other');
  g(['clone', '-q', '--branch', branch, bare, otherClone], scratch);
  fs.writeFileSync(path.join(otherClone, 'other.txt'), 'another agent pushed first\n');
  g(['add', 'other.txt'], otherClone);
  g(['-c', 'user.email=o@example', '-c', 'user.name=other', 'commit', '-q', '-m', 'another agent pushed first'], otherClone);
  const ahead = g(['push', '-q', 'origin', branch], otherClone);
  if (seeded.status !== 0 || ahead.status !== 0) { test.fail('the world: origin could not be seeded (' + short(seeded.stderr) + ') or advanced (' + short(ahead.stderr) + ')'); return; }

  const whole = spawnSync(process.execPath, [PUBLISH, String(agentPort), '--asks', '3'], { cwd: clone, encoding: 'utf8', timeout: 240000 });
  const said = short(String(whole.stderr).trim().slice(-260) || String(whole.stdout).trim().slice(-260));
  const onOrigin = g(['--git-dir', bare, 'log', '--format=%s', '-2', branch], scratch).stdout.trim().split('\n');
  if (whole.status === 0 && /^publish: gemma/.test(onOrigin[0] || '') && onOrigin[1] === 'another agent pushed first') test.check('5. origin moved meanwhile: the publish rebased onto it and its push went in');
  else test.fail(OWED + 'with origin one commit ahead, publishData exited ' + whole.status + ' and origin\'s last two read ' + short(onOrigin) + '; it said ' + said);

  let harness = null;
  try { harness = JSON.parse(fs.readFileSync(path.join(clone, 'agents', 'gemma', 'harness.json'), 'utf8')); } catch (e) { harness = null; }
  const ranIn = harness ? String(harness.ranIn || '') : '';
  const inClone = ranIn && !path.relative(clone, ranIn).startsWith('..');
  if (harness && ranIn && !inClone) test.check('6. measurePlatform ran outside the live clone, and its harness.json came back into agents/gemma/');
  else test.fail(OWED + (harness ? 'measurePlatform ran in the live clone (' + ranIn + ')' : 'no agents/gemma/harness.json in the clone after the publish'));
  const trees = g(['worktree', 'list', '--porcelain']).stdout.split('\n').filter(function (l) { return /^worktree /.test(l); });
  if (trees.length === 1) test.check('6. the worktree is removed afterwards');
  else test.fail(OWED + 'worktrees left: ' + short(trees));
  let pk2 = null;
  try { pk2 = JSON.parse(fs.readFileSync(path.join(clone, 'agents', 'gemma', 'packets.json'), 'utf8')); } catch (e) { pk2 = null; }
  if (pk2 && pk2.posts >= 3) test.check('6. the packet asks counted ' + pk2.posts + ' posts after the harness');
  else test.fail(OWED + 'after the harness the packet asks counted ' + short(pk2 && pk2.posts));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
