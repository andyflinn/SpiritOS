'use strict';

// spirit/test/testHome.js
// A SUITE NEVER WRITES INTO THE REAL HOME — found verifying desk/G1.7,
// written FIRST, red on today's code.
//
//   Since desk/G1.7 every node boots a backup server that writes to
//   <home>/.SpiritOS/backups/. A full run by wsl-claude left four test nodes
//   (alfa, bravo, charlie, asbowner) in its real ~/.SpiritOS, and
//   claude-windows' run left six in Andy's C:\Users\Andre\.SpiritOS. Andy:
//   "test suites need their own copy of node"; their home is part of it.
//
// THE CONTRACT (claude-windows' fix, wsl-claude's test): testSupport.js,
// which every suite requires, gives its process a temp HOME and USERPROFILE,
// so every node a suite boots inherits it; the real one is kept as
// SPIRIT_REAL_HOME for the suite that needs it. The real home is read here
// from the account (os.userInfo), never from HOME, so this does not trust
// the thing it checks.

const os = require('os');
const REAL = os.userInfo().homedir;
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const auth = require('../run/js/relayAuth.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by the harness (desk/G1.7 finding): ';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('A suite never writes into the real home');

(async function () {
  test.subHeading('T1: once testSupport is loaded, home is a temp folder, and the real one is kept aside');
  const home = os.homedir();
  const tmp = fs.realpathSync(os.tmpdir());
  let homeReal = home;
  try { homeReal = fs.realpathSync(home); } catch (e) { homeReal = home; }
  if (home !== REAL && homeReal.indexOf(tmp) === 0 && process.env.SPIRIT_REAL_HOME === REAL) {
    test.check('os.homedir() is under the temp folder; SPIRIT_REAL_HOME holds the real one');
  } else test.fail(OWED + 'os.homedir() is ' + home + ' (real ' + REAL + '), SPIRIT_REAL_HOME ' + JSON.stringify(process.env.SPIRIT_REAL_HOME));

  test.subHeading('T2: a node a suite boots backs up into the suite\'s home, never the real one');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-testhome-'));
  const run = path.join(scratch, 'spirit', 'run');
  plantRun.plantRunTree(run);
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  const name = 'homeprobe-' + crypto.randomBytes(3).toString('hex');
  const id = auth.generateIdentity(name);
  auth.saveIdentity(run, id);
  const tag = crypto.createHash('sha256').update(id.publicKey).digest('hex').slice(0, 12);
  const realCopy = path.join(REAL, '.SpiritOS', 'backups', tag);
  const suiteCopy = path.join(os.homedir(), '.SpiritOS', 'backups', tag);
  const port = await freePort();
  // It backs up only if it includes the backup (slim/G1.3 T6).
  require('../run/js/includeList.js').add(run, 'process/js/backup');
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(250);
    try { up = (await relayRequest('http://127.0.0.1:' + port, 'GET', '/', null)).status === 200; } catch (e) { up = false; }
  }
  // Its backup runs once at start; give it a moment either way.
  for (let i = 0; i < 40 && !fs.existsSync(path.join(realCopy, 'node.json')) && !fs.existsSync(path.join(suiteCopy, 'node.json')); i++) await sleep(250);
  const leaked = fs.existsSync(realCopy);
  const inSuite = fs.existsSync(path.join(suiteCopy, 'node.json'));
  // Never leave it there, red or green.
  if (leaked) { try { fs.rmSync(realCopy, { recursive: true, force: true }); } catch (e) { /* reported below */ } }
  kid.kill();
  if (up && !leaked && inSuite) test.check('the booted node\'s copy is in the suite\'s home, and nothing of it in the real one');
  else test.fail(OWED + 'node up ' + up + ', copy in the real home ' + leaked + (leaked ? ' (removed)' : '') + ', in the suite\'s home ' + inSuite);
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
