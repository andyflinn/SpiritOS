'use strict';

// spirit/test/shellRename.js
// app/ BECOMES shell/, AND EACH NODE CARRIES ITS OWN FILES ACROSS —
// slim/G1.1.
//
//   Andy, 2026-09-29: "shell replaces app, with elements.css, README.md and
//   tokens.css being siblings of the individual shell-element folders", and
//   the rename comes first, "so nothing is renamed twice".
//
// THE CONTRACT:
//   T1 no node code names app/ as a folder; shell/ is writable in its place
//   (T2 and T3, shell/'s top files neither listed nor served, went with
//   goal/G13.2: nothing lists shell/ for anything but the page's own
//   discovery, which skips plain files.)
//   T4 on first start a node moves its leftover app/ files into shell/,
//      once, says what it moved, and removes app/
//   T5 a leftover whose name already exists in shell/ is kept, not
//      overwritten, and said
// A git mv carries only tracked files. What a live node keeps in app/ is
// gitignored, so without T4 a node would come up without it.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const test = require('./testSupport.js');
const VENDORED_FOLDERS = require('../run/spirit/fileSystem.js').VENDORED_FOLDERS;
const plantRun = require('./plantRun.js');
const auth = require('../run/spirit/relayAuth.js');
// IS IT LISTENING? A LIVENESS PROBE, NOT A PAGE FETCH (goal/G16.6).
// This asked relayRequest for GET / and read its status. Since a relay
// answer is bounded by limits.BODY_MAX (Andy, 2026-10-11: "an answer from
// a relay is ALWAYS bounded by MAX_PAYLOAD"), the 80 KB start page is
// refused and a running node reads as down. A probe wants the status line
// and nothing else, so it asks for that itself and reads no body.
function listening(port) {
  return new Promise(function (resolve) {
    const req = require('http').request(
      { host: '127.0.0.1', port: port, path: '/', method: 'GET' },
      // The status is the whole answer: the body is thrown away unread, so
      // the page's size is nothing to do with this.
      function (res) { const ok = res.statusCode === 200; res.destroy(); resolve(ok); }
    );
    req.on('error', function () { resolve(false); });
    req.end();
  });
}

const OWED = 'OWED by slim/G1.1: ';
const RUN = path.join(__dirname, '..', 'run');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } }

// ── T1 ────────────────────────────────────────────────────────────────
// 'app' as a path part, or a string starting app/ or /app/. Comments are
// dropped first. Allowed: three values that only look like it (a
// manifest's type, a log line's fallback name, a label on the page), and
// a line declaring an old location by a LEGACY name, which is how the
// move in T4 (and hub.js's older one) names where it reads from.
// The page's ?app= address parameter is a name in a URL, not a folder.
// The files read are git's under spirit/run/{js,process,index.html,app,shell}: of those only process/ and shell/
// are in the tree now, so spirit/run/spirit/ (the node's code, and its apps in spirit/run/spirit/app/) is not read.
const ALLOWED = [/manifest\.type \|\| 'app'/, /\(name \|\| 'app'\)/, /row\('app',/, /\b[A-Z_]*LEGACY[A-Z_]*\s*=/, /URLSearchParams\([^)]*\)\.get\('app'\)/];
function appFolderUses() {
  const files = execSync('git ls-files -- js process index.html app shell', { cwd: RUN, encoding: 'utf8' })
    .split('\n').filter(function (f) { return /\.(js|html)$/.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
  const hits = [];
  files.forEach(function (f) {
    fs.readFileSync(path.join(RUN, f), 'utf8').split(/\r?\n/).forEach(function (line, i) {
      const code = line.replace(/^\s*(\/\/|\*).*$/, '').replace(/\s\/\/\s.*$/, '');
      if (!/(["'])app\1|(["'])\/?app\//.test(code)) return;
      if (ALLOWED.some(function (re) { return re.test(code); })) return;
      hits.push(f + ':' + (i + 1));
    });
  });
  return hits;
}

// ── T4, T5 ────────────────────────────────────────────────────────────
// A node on this checkout's tree, with `leftovers` (relative to app/)
// written into app/ the way a live node has them, and `already` (relative
// to shell/) already in shell/. Started, then stopped; what it said is kept.
async function nodeWith(leftovers, already) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shellrename-'));
  const run = path.join(scratch, 'spirit', 'run');
  plantRun.plantRunTree(run);
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
  fs.rmSync(path.join(run, 'spirit', 'state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(run, auth.generateIdentity('renameprobe-' + crypto.randomBytes(3).toString('hex')));
  Object.keys(leftovers).forEach(function (rel) { write(path.join(run, 'app', rel), leftovers[rel]); });
  Object.keys(already || {}).forEach(function (rel) { write(path.join(run, 'shell', rel), already[rel]); });
  const said = [];
  async function start() {
    const port = await freePort();
    const kid = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    kid.stdout.on('data', function (b) { out.push(String(b)); });
    kid.stderr.on('data', function (b) { out.push(String(b)); });
    let up = false;
    for (let i = 0; i < 80 && !up; i++) {
      await sleep(250);
      up = await listening(port);
    }
    await sleep(500);
    kid.kill();
    await sleep(300);
    said.push(out.join(''));
    return up;
  }
  return { run: run, scratch: scratch, said: said, start: start };
}

const LEFTOVERS = {
  'natter/session.json': '{"relays":["OLD-RELAYS"]}',
  'contacts/prefs.json': '{"prefs":"OLD-PREFS"}',
  'fixList/fixes.md': 'OLD-FIXES',
  'shared/aiStatus.json': '{"status":"OLD-AI"}',
};

test.startTest('slim/G1.1: app/ becomes shell/, and each node carries its own files across');

(async function () {
  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: no node code names app/ as a folder; shell/ is the write root in its place');
  const hits = appFolderUses();
  const kernel = require('../run/spirit/kernel.js');
  const writable = kernel.core.fs.fileWritable;
  // Since goal/G30.21 the gate names no folder: app/ is as writable as any non-core folder, so only shell/ is asked.
  const gate = { shell: writable('shell/probeapp/data.json'), app: '(no folder is special since goal/G30.21)' };
  if (!hits.length && gate.shell) test.check('no app/ folder named in js/, process/, index.html or the shell\'s own code; the write gate takes shell/');
  else test.fail(OWED + hits.length + ' uses of app/ as a folder (' + hits.slice(0, 6).join(', ') + (hits.length > 6 ? ', …' : '') +
    '); writable shell/ ' + gate.shell + ', app/ ' + gate.app);

  // T2 and T3 went with goal/G13.2 (see the contract above).

  // ── T4 ──────────────────────────────────────────────────────────────
  test.subHeading('T4: on first start a node moves its leftover app/ files into shell/, once, says what it moved, and removes app/');
  const n4 = await nodeWith(LEFTOVERS);
  const up4 = await n4.start();
  const moved = Object.keys(LEFTOVERS).filter(function (rel) { return read(path.join(n4.run, 'shell', rel)) === LEFTOVERS[rel]; });
  const named = Object.keys(LEFTOVERS).filter(function (rel) { return n4.said[0].indexOf(rel) !== -1; });
  const appGone = !fs.existsSync(path.join(n4.run, 'app'));
  // Once: a second start moves nothing and says nothing of a move.
  const up4b = await n4.start();
  const saidAgain = Object.keys(LEFTOVERS).filter(function (rel) { return n4.said[1].indexOf(rel) !== -1; });
  if (up4 && up4b && moved.length === 4 && named.length === 4 && appGone && !saidAgain.length) {
    test.check('all four leftovers are in shell/ with their content, each named when moved, app/ is gone, and a second start says nothing of it');
  } else test.fail(OWED + 'up ' + up4 + '/' + up4b + '; moved ' + JSON.stringify(moved) + '; named ' + JSON.stringify(named) +
    '; app/ removed ' + appGone + '; named again on the second start ' + JSON.stringify(saidAgain));
  try { fs.rmSync(n4.scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }

  // ── T5 ──────────────────────────────────────────────────────────────
  test.subHeading('T5: a leftover whose name already exists in shell/ is kept, not overwritten, and said');
  const n5 = await nodeWith({ 'natter/session.json': '{"relays":["OLD-RELAYS"]}' }, { 'natter/session.json': '{"relays":["NEW-RELAYS"]}' });
  const up5 = await n5.start();
  const shellKept = read(path.join(n5.run, 'shell', 'natter', 'session.json')) === '{"relays":["NEW-RELAYS"]}';
  const oldKept = read(path.join(n5.run, 'app', 'natter', 'session.json')) === '{"relays":["OLD-RELAYS"]}';
  const said5 = n5.said[0].indexOf('natter/session.json') !== -1;
  if (up5 && shellKept && oldKept && said5) test.check('shell/natter/session.json keeps its own content, the old one stays in app/, and the node names it');
  else test.fail(OWED + 'up ' + up5 + '; shell/ copy untouched ' + shellKept + '; old one still in app/ ' + oldKept + '; named ' + said5);
  try { fs.rmSync(n5.scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
