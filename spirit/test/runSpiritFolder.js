'use strict';

// spirit/test/runSpiritFolder.js
// goal/G40.2: the core code tree moves from spirit/run/js/ to spirit/run/spirit/. Written first, red on today's tree, by
// claude-windows, who does not build it. The box (v4), Andy's words among it: "so to make spirit.js the first compliant
// object, we need to make that simple folder move. no other changes. that one's big enough for an item. if we can pull
// this off by only fixing require() statements through out we're on a winning path."; and to the relays' units: "teach
// bash to re-install a changed unit."
//
// WHAT IS ASSERTED
//   1. The folder: spirit/run/spirit/ holds the tree (server.js, kernel.js, relayServer.js among it); spirit/run/js/ is
//      gone; spirit.js requires its own children, ./spirit/kernel.js and ./spirit/fieldRules.js.
//   2. coreFiles names the new folder core, as it named the old.
//   3. No tracked file but the records names the old tree: no spirit/run/js/, no ../run/js/, no js/server.js or
//      js/relayServer.js as a start path, no /js/kernel.js or /js/client/ page address. The records stay as written:
//      design/, the agents' harness.txt files, the desk's currentGoal.json, relayLab/open, PRESENCE-1.md.
//   4. The relays' units start the node by spirit/server.js, and bash/update re-installs a unit whose template changed
//      before it restarts the relay.
//   5. The start paths: package.json's start script, Andy's platform/windows/start-spirit.ps1 and
//      platform/wsl/start-spirit.sh, and both installers start the node by spirit/server.js.
//   6. On a node of its own (rule/11), started by node spirit/server.js: it boots, serves /spirit/kernel.js and answers
//      404 for /js/kernel.js; index.html loads the kernel from /spirit/.
//   7. labMaster looks for spirit/server.js under a home.

const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn, execSync } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by goal/G40.2: ';
const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
// Spelled in parts, so this suite does not name the old tree itself.
const OLD = 'js' + '/';
const OLD_PATTERNS = [
  new RegExp('spirit/run/' + OLD),
  new RegExp('\\.\\./run/' + OLD),
  new RegExp('(^|[^A-Za-z0-9_/.-])' + OLD + '(server|relayServer)\\.js'),
  new RegExp('/' + OLD + '(kernel\\.js|client/)'),
];
const RECORD = /^(design\/|relayLab\/open\/)|\/harness\.txt$|currentGoal\.json$|PRESENCE-1\.md$|^spirit\/test\/runSpiritFolder\.js$/;
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(rel) { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return null; } }
function tracked() { return execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); }
function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () { const p = probe.address().port; probe.close(function () { resolve(p); }); });
  });
}
function get(port, p) {
  return new Promise(function (resolve) {
    http.get({ hostname: '127.0.0.1', port: port, path: p }, function (res) { res.resume(); resolve(res.statusCode); }).on('error', function () { resolve(0); });
  });
}

test.startTest('goal/G40.2: the core code tree at spirit/run/spirit/');

(async function () {
  // ── 1. THE FOLDER ────────────────────────────────────────────────────
  test.subHeading('1. spirit/run/spirit/ holds the tree, spirit/run/js/ is gone');
  const there = ['server.js', 'kernel.js', 'relayServer.js', 'fieldRules.js'].filter(function (f) { return fs.existsSync(path.join(RUN, 'spirit', f)); });
  const gone = !fs.existsSync(path.join(RUN, 'js'));
  if (there.length === 4 && gone) test.check('spirit/run/spirit/ holds server.js, kernel.js, relayServer.js and fieldRules.js; spirit/run/js/ is gone');
  else test.fail(OWED + 'in spirit/run/spirit/: ' + short(there) + '; the old folder ' + (gone ? 'is gone' : 'is still there'));
  const sj = read('spirit/run/spirit.js') || '';
  if (/require\('\.\/spirit\/kernel\.js'\)/.test(sj) && /require\('\.\/spirit\/fieldRules\.js'\)/.test(sj)) test.check('spirit.js requires its own children: ./spirit/kernel.js and ./spirit/fieldRules.js');
  else test.fail(OWED + 'spirit.js requires ' + short((sj.match(/require\('[^']+'\)/g) || []).join(' ')));

  // ── 2. CORE ──────────────────────────────────────────────────────────
  test.subHeading('2. the new folder is core');
  let core = null;
  try {
    const c = require('../run/' + (fs.existsSync(path.join(RUN, 'spirit', 'coreFiles.js')) ? 'spirit' : 'js') + '/coreFiles.js');
    core = c.isCore('spirit/run/spirit/server.js', REPO) === true && c.isCore('spirit/run/spirit/client/shell.js', REPO) === true;
  } catch (e) { core = 'threw ' + e.message; }
  if (core === true) test.check('coreFiles names spirit/run/spirit/ core, as it named the old tree');
  else test.fail(OWED + 'coreFiles.isCore of spirit/run/spirit/server.js and client/shell.js: ' + short(core));

  // ── 3. NOTHING NAMES THE OLD TREE ────────────────────────────────────
  test.subHeading('3. no tracked file but the records names the old tree');
  const naming = tracked().filter(function (rel) {
    if (RECORD.test(rel) || /\.(png|jpg|ico|svg|db|woff2?|gz|zip)$/.test(rel)) return false;
    const text = read(rel);
    return text !== null && OLD_PATTERNS.some(function (re) { return re.test(text); });
  });
  if (!naming.length) test.check('no tracked file outside the records names spirit/run/js/, ../run/js/, js/server.js, js/relayServer.js or /js/kernel.js');
  else test.fail(OWED + naming.length + ' tracked files still name the old tree: ' + short(naming.slice(0, 10)));

  // ── 4. THE RELAYS ────────────────────────────────────────────────────
  test.subHeading('4. the relays\' units start spirit/server.js, and bash/update re-installs a changed unit');
  const units = ['bash/systemd/spirit-relay.service', 'bash/systemd/spirit-face.service'].map(function (f) { return { f: f, exec: ((read(f) || '').match(/^ExecStart=.*$/m) || [''])[0] }; });
  if (units.every(function (u) { return / spirit\/server\.js /.test(u.exec); })) test.check('both unit templates start node spirit/server.js');
  else test.fail(OWED + 'the units start ' + short(units.map(function (u) { return u.f + ': ' + u.exec; })));
  const update = read('bash/update') || '';
  if (/install-units/.test(update)) test.check('bash/update re-installs the units (install-units) when it updates');
  else test.fail(OWED + 'bash/update does not re-install a changed unit before it restarts the relay');

  // ── 5. THE START PATHS ───────────────────────────────────────────────
  test.subHeading('5. every start path starts spirit/server.js');
  let pkg = '';
  try { pkg = String(JSON.parse(read('package.json') || '{}').scripts.start || ''); } catch (e) { pkg = ''; }
  const starts = [['package.json start', / spirit\/server\.js/.test(pkg) ? '' : pkg],
    ['platform/windows/start-spirit.ps1', /spirit[\\/]server\.js/.test(read('platform/windows/start-spirit.ps1') || '') ? '' : 'no spirit/server.js'],
    ['platform/wsl/start-spirit.sh', /spirit\/server\.js/.test(read('platform/wsl/start-spirit.sh') || '') ? '' : 'no spirit/server.js'],
    // An installer's create.js only zips; the start path lives in the files it ships: chat-windows' start.ps1 and
    // README.txt, microscopic's README.txt (wsl-claude, building goal/G40.2).
    ['install/chat-windows/start.ps1', /spirit\\server\.js/.test(read('install/chat-windows/start.ps1') || '') && !/[^A-Za-z]js\\server\.js/.test(read('install/chat-windows/start.ps1') || '') ? '' : 'no spirit\\server.js'],
    ['install/chat-windows/README.txt', /node spirit\/server\.js/.test(read('install/chat-windows/README.txt') || '') ? '' : 'no spirit/server.js'],
    ['install/microscopic/README.txt', /node spirit\/server\.js/.test(read('install/microscopic/README.txt') || '') ? '' : 'no spirit/server.js']]
    .filter(function (s) { return s[1]; });
  if (!starts.length) test.check('package.json, start-spirit.ps1, start-spirit.sh and both installers start spirit/server.js');
  else test.fail(OWED + 'still starting the old path: ' + short(starts));

  // ── 6. A NODE STARTED BY THE NEW PATH ────────────────────────────────
  test.subHeading('6. a node of its own starts by node spirit/server.js and serves the kernel from /spirit/');
  const index = read('spirit/run/index.html') || '';
  if (/<script src="\/spirit\/kernel\.js"><\/script>/.test(index)) test.check('index.html loads /spirit/kernel.js');
  else test.fail(OWED + 'index.html loads ' + short((index.match(/<script src="[^"]*kernel[^"]*"/g) || []).join(' ')));
  const home = setupRelayFakes('runSpiritFolder').andy;
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  if (!fs.existsSync(path.join(home, 'spirit', 'server.js'))) {
    test.fail(OWED + 'the fake home has no spirit/server.js to start');
  } else {
    const port = await freePort();
    let said = '';
    const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', function (c) { said = (said + c).slice(-4096); });
    try {
      let up = 0;
      for (let i = 0; i < 70 && up !== 200; i++) { await sleep(150); up = await get(port, '/'); }
      const at = await get(port, '/spirit/kernel.js');
      const old = await get(port, '/' + OLD + 'kernel.js');
      if (up === 200 && at === 200 && old === 404) test.check('it boots, serves /spirit/kernel.js (200), and the old address answers 404');
      else test.fail(OWED + 'boot ' + up + ', /spirit/kernel.js ' + at + ', the old address ' + old + ': ' + said.trim().split('\n').slice(-3).join(' | '));
    } finally { child.kill(); }
  }

  // ── 7. THE LAB ───────────────────────────────────────────────────────
  test.subHeading('7. labMaster looks for spirit/server.js');
  const lab = read('spirit/test/labMaster/labMaster.js') || '';
  if (/spirit[\\/'", ]+server\.js/.test(lab) && !OLD_PATTERNS.some(function (re) { return re.test(lab); })) test.check('labMaster looks for spirit/server.js under a home, and names the old path nowhere');
  else test.fail(OWED + 'labMaster still looks for the old start path');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
