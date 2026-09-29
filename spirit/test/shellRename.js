'use strict';

// spirit/test/shellRename.js
// app/ BECOMES shell/, AND EACH NODE CARRIES ITS OWN FILES ACROSS —
// slim/G1.1, written FIRST, red on today's code.
//
//   Andy, 2026-09-29: "shell replaces app, with elements.css, README.md and
//   tokens.css being siblings of the individual shell-element folders", and
//   the rename comes first, "so nothing is renamed twice".
//
// THE CONTRACT (wsl-claude's tests, claude-windows' build):
//   T1 no node code names app/ as a folder; shell/ is the write root in its place
//   T2 listing shell elements skips the plain files at shell/'s top
//   T3 tokens.css and elements.css are still served, one named file each, to
//      a granted face, and shell/'s top is never a servable folder
//   T4 on first start a node moves its leftover app/ files into shell/,
//      once, says what it moved, and removes app/
//   T5 a leftover whose name already exists in shell/ is kept, not
//      overwritten, and said
// A git mv carries only tracked files. What a live node keeps in app/ is
// gitignored (natter's relays, contacts' prefs, fixList's fixes, the AI
// status), so without T4 Andy's node would come up without its relays.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const auth = require('../run/js/relayAuth.js');
const { relayRequest } = require('../run/js/relayRequest.js');

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
const ALLOWED = [/manifest\.type \|\| 'app'/, /\(name \|\| 'app'\)/, /row\('app',/, /\b[A-Z_]*LEGACY[A-Z_]*\s*=/];
function appFolderUses() {
  const files = execSync('git ls-files -- js process index.html app shell', { cwd: RUN, encoding: 'utf8' })
    .split('\n').filter(function (f) { return /\.(js|html)$/.test(f) && f.indexOf('node_modules') === -1 && fs.existsSync(path.join(RUN, f)); });
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

// ── T3 ────────────────────────────────────────────────────────────────
// The face's own handle(), with a request that asks for one path.
function faceGet(face, pathname) {
  return Promise.race([
    new Promise(function (resolve) {
      let body = '';
      let status = 200;
      const res = {
        headersSent: false, setHeader: function () {}, on: function () {}, once: function () {}, emit: function () {},
        writeHead: function (s) { status = s; return res; },
        write: function (c) { body += c; return true; },
        end: function (c) { if (c) body += c; resolve({ status: status, body: body }); },
      };
      const req = new (require('stream').PassThrough)();
      req.method = 'GET'; req.url = pathname; req.headers = { host: 'probe' };
      req.end();
      try { face.handle(req, res); } catch (e) { resolve({ status: 'threw ' + e.message, body: '' }); }
    }),
    sleep(2000).then(function () { return { status: 'no answer', body: '' }; }),
  ]);
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
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  auth.saveIdentity(run, auth.generateIdentity('renameprobe-' + crypto.randomBytes(3).toString('hex')));
  Object.keys(leftovers).forEach(function (rel) { write(path.join(run, 'app', rel), leftovers[rel]); });
  Object.keys(already || {}).forEach(function (rel) { write(path.join(run, 'shell', rel), already[rel]); });
  const said = [];
  async function start() {
    const port = await freePort();
    const kid = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    kid.stdout.on('data', function (b) { out.push(String(b)); });
    kid.stderr.on('data', function (b) { out.push(String(b)); });
    let up = false;
    for (let i = 0; i < 80 && !up; i++) {
      await sleep(250);
      try { up = (await relayRequest('http://127.0.0.1:' + port, 'GET', '/', null)).status === 200; } catch (e) { up = false; }
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
  'natter/relays.json': '{"relays":["OLD-RELAYS"]}',
  'contacts/prefs.json': '{"prefs":"OLD-PREFS"}',
  'fixList/fixes.md': 'OLD-FIXES',
  'shared/aiStatus.json': '{"status":"OLD-AI"}',
};

test.startTest('slim/G1.1: app/ becomes shell/, and each node carries its own files across');

(async function () {
  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: no node code names app/ as a folder; shell/ is the write root in its place');
  const hits = appFolderUses();
  const kernel = require('../run/js/kernel.js');
  const writable = kernel.core.fs.fileWritable;
  const gate = { shell: writable('shell/probeapp/data.json'), app: writable('app/probeapp/data.json') };
  if (!hits.length && gate.shell && !gate.app) test.check('no app/ folder named in js/, process/, index.html or the shell\'s own code; the write gate takes shell/ and refuses app/');
  else test.fail(OWED + hits.length + ' uses of app/ as a folder (' + hits.slice(0, 6).join(', ') + (hits.length > 6 ? ', …' : '') +
    '); writable shell/ ' + gate.shell + ', app/ ' + gate.app);

  // ── T2 ──────────────────────────────────────────────────────────────
  test.subHeading('T2: listing shell elements skips the plain files at shell/\'s top');
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shelllist-'));
  ['tokens.css', 'elements.css', 'README.md'].forEach(function (f) { write(path.join(root2, 'shell', f), '/* ' + f + ' */'); });
  // A face lives in process/js since slim/G1.4, so the serving list is read
  // there; the shell's mounted list still skips shell/'s top files.
  write(path.join(root2, 'process', 'js', 'hello', 'hello.json'), JSON.stringify({ serves: true }));
  write(path.join(root2, 'shell', 'probe', 'probe.json'), JSON.stringify({ boots: true }));
  write(path.join(root2, 'shell', 'probe', 'probe.js'), 'module.exports = { mount: function () {} };');
  let servers = [];
  let mounted = [];
  let broke = '';
  try { servers = require('../run/js/appClient.js').readServers(root2); } catch (e) { broke += 'readServers: ' + e.message + ' '; }
  try { mounted = require('../run/js/nodeApps.js').mountAll({ rootDir: root2 }) || []; } catch (e) { broke += 'mountAll: ' + e.message; }
  if (JSON.stringify(servers) === '["hello"]' && JSON.stringify(mounted) === '["probe"]' && !broke) {
    test.check('the serving list is [hello] (process/js) and the mounted list [probe] (shell/); tokens.css, elements.css and README.md are neither');
  } else test.fail(OWED + 'serving ' + JSON.stringify(servers) + ', mounted ' + JSON.stringify(mounted) + (broke ? ', broke: ' + broke : ''));
  try { fs.rmSync(root2, { recursive: true, force: true }); } catch (e) { /* busy */ }

  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: tokens.css and elements.css served one named file each to a granted face; shell/\'s top is not servable');
  const root3 = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shellface-'));
  write(path.join(root3, 'shell', 'tokens.css'), '/*TOKENS*/');
  write(path.join(root3, 'shell', 'elements.css'), '/*ELEMENTS*/');
  write(path.join(root3, 'shell', 'README.md'), 'README');
  // The face in process/js (slim/G1.4); its granted CSS still from shell/'s top.
  write(path.join(root3, 'process', 'js', 'probe', 'probe.json'), JSON.stringify({ posture: 'strict', surface: ['verb'], utilities: ['elements', 'tokens'], serves: true }));
  write(path.join(root3, 'process', 'js', 'probe', 'probe.html'), '<p>probe</p>');
  const faceServer = require('../run/js/faceServer.js');
  const got = {};
  try {
    const face = faceServer.create({ rootDir: root3, appName: 'probe' });
    for (const p of ['/tokens.css', '/elements.css', '/README.md', '/shell/tokens.css']) got[p] = await faceGet(face, p);
  } catch (e) { got.create = { status: 'threw ' + e.message }; }
  const ok3 = got['/tokens.css'] && got['/tokens.css'].status === 200 && /TOKENS/.test(got['/tokens.css'].body) &&
    got['/elements.css'] && got['/elements.css'].status === 200 && /ELEMENTS/.test(got['/elements.css'].body) &&
    got['/README.md'] && got['/README.md'].status === 404 && got['/shell/tokens.css'] && got['/shell/tokens.css'].status === 404;
  if (ok3) test.check('tokens.css and elements.css come from shell/\'s top; README.md there and any path into shell/ are 404');
  else test.fail(OWED + JSON.stringify(Object.keys(got).reduce(function (a, k) { a[k] = got[k].status; return a; }, {})));
  try { fs.rmSync(root3, { recursive: true, force: true }); } catch (e) { /* busy */ }

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
  const n5 = await nodeWith({ 'natter/relays.json': '{"relays":["OLD-RELAYS"]}' }, { 'natter/relays.json': '{"relays":["NEW-RELAYS"]}' });
  const up5 = await n5.start();
  const shellKept = read(path.join(n5.run, 'shell', 'natter', 'relays.json')) === '{"relays":["NEW-RELAYS"]}';
  const oldKept = read(path.join(n5.run, 'app', 'natter', 'relays.json')) === '{"relays":["OLD-RELAYS"]}';
  const said5 = n5.said[0].indexOf('natter/relays.json') !== -1;
  if (up5 && shellKept && oldKept && said5) test.check('shell/natter/relays.json keeps its own content, the old one stays in app/, and the node names it');
  else test.fail(OWED + 'up ' + up5 + '; shell/ copy untouched ' + shellKept + '; old one still in app/ ' + oldKept + '; named ' + said5);
  try { fs.rmSync(n5.scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
