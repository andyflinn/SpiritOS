'use strict';

// spirit/test/fsOwnerUnlimited.js
// goal/G33.10: the fs family is owner only, hard-coded, and its loadFile and saveFile have no size limit. Written first,
// red on today's code, by wsl-claude, who does not build it. Andy, 2026-10-24: "would i allow a peer fs access, ever? it
// could un-install apps from my face etc...", "i want fs to be hard-coded owner only, with no size limits on it's
// loadFile and saveFile....", and on the work file: "it is understood, we will always copy, then delete the temp
// file.... but that's what a temp folder is for, if garbage accidentally remains (node-restart etc) the garbage is where
// it belongs....".
//
// WHAT IS ASSERTED
//   1. No peer reaches any fs verb, whatever the grants: apiDoor refuses an fs ask from a member holding fs or fs.save
//      and never passes it on; a member's api tree carries no fs branch; api {family: fs} is refused to it.
//   2. A grant naming fs cannot be made: auth.grant refuses fs and fs.<verb>, while the tree serves them.
//   3. No size limit at the owner's door: on a node of its own (rule/11), fs.save of a file several times one request
//      is taken and lands whole; fs.load answers it whole.
//   4. The face's save in parts (named size, parts streamed to a work file in the system temp folder, copied to the
//      target, then deleted; dropped after an hour without a part) is declared AWAITING: the box fixes what it does,
//      not the wire shape of the sized save, which the builder names. Each goes red the moment its unit lands.

const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by goal/G33.10: ';
const RUN = path.join(__dirname, '..', 'run');
const BODY_MAX = require('../run/js/limits.js').BODY_MAX;
const PEER = 'MCowBQYDK2VwAyEAfsOwnerUnlimitedPeerKeyXXXXXXXXXXXXXXXXXXXXX=';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function code(rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } }

test.startTest('goal/G33.10: fs is owner only, and its loadFile and saveFile have no size limit');

// The servers a member's ask would reach: every ask is recorded, fs among them as the node's flat table holds it.
function fakeServers() {
  const asked = [];
  return {
    asked: asked,
    ask: function (body) {
      asked.push(body);
      if (body === 'api') return Promise.resolve({ status: 200, body: { fs: { save: {}, load: {} }, node: { card: {} } } });
      if (body && body.api) return Promise.resolve({ status: 200, body: { family: body.api.family, interface: 'module.exports = {};' } });
      return Promise.resolve({ status: 200, body: { ok: true } });
    },
  };
}
function member(paths) { return { key: PEER, auth: { pathsOf: function () { return paths; }, labelOf: function () { return 'peer'; } } }; }

function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () { const p = probe.address().port; probe.close(function () { resolve(p); }); });
  });
}
function call(port, body) {
  return new Promise(function (resolve) {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: port, path: '/api/spirit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }); });
    });
    req.on('error', function (e) { resolve({ status: 0, text: String(e.code || e) }); });
    req.setTimeout(20000, function () { req.destroy(new Error('timeout')); });
    req.end(payload);
  });
}
function waitForBoot(port) {
  const started = Date.now();
  return (function poll() {
    return new Promise(function (resolve) {
      http.get({ hostname: '127.0.0.1', port: port, path: '/' }, function (res) { res.resume(); resolve(res.statusCode); })
        .on('error', function () { resolve(0); });
    }).then(function (s) {
      if (s === 200) return true;
      if (Date.now() - started > 10000) throw new Error('the node did not boot on ' + port);
      return sleep(150).then(poll);
    });
  }());
}

(async function () {
  // ── 1. THE GATE ──────────────────────────────────────────────────────
  test.subHeading('1. no peer reaches any fs verb, whatever the grants');
  const door = require('../run/js/apiDoor.js');
  for (const held of [['fs'], ['fs.save']]) {
    const servers = fakeServers();
    const r = await door.answer(servers, { fs: { save: { path: 'shell/icons/iconSet.json', content: '{}' } } }, member(held));
    if (r && r.status === 403 && r.body && r.body.ok === false && !servers.asked.length) test.check('a member holding ' + held[0] + ' asking fs.save is refused, ' + r.body.code + ', and nothing is asked');
    else test.fail(OWED + 'a member holding ' + held[0] + ' asking fs.save got ' + short(r) + ', the servers asked ' + servers.asked.length + ' time(s)');
  }
  {
    const servers = fakeServers();
    const r = await door.answer(servers, { fs: { load: { path: 'shell/icons/iconSet.json' } } }, member(['fs.load']));
    if (r && r.status === 403 && !servers.asked.length) test.check('a member holding fs.load asking it is refused');
    else test.fail(OWED + 'a member holding fs.load asking it got ' + short(r));
  }
  {
    const r = await door.answer(fakeServers(), 'api', member(['fs', 'node']));
    if (r && r.status === 200 && r.body && !r.body.fs && r.body.node) test.check('a member\'s api tree carries no fs branch, though it holds fs');
    else test.fail(OWED + 'a member holding fs and node sees the tree ' + short(r && r.body));
  }
  {
    const servers = fakeServers();
    const r = await door.answer(servers, { api: { family: 'fs' } }, member(['fs']));
    if (r && r.status === 403 && !servers.asked.length) test.check('api {family: fs} is refused to a member');
    else test.fail(OWED + 'api {family: fs} to a member holding fs got ' + short(r));
  }

  // ── 2. NO GRANT NAMES fs ─────────────────────────────────────────────
  test.subHeading('2. a grant naming fs cannot be made');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fsowner-'));
  try {
    const auth = require('../run/js/apiAuth').createApiAuth({
      rootDir: root,
      tree: function () { return Promise.resolve({ fs: { save: {}, load: {} }, node: { card: {} } }); },
    });
    for (const p of ['fs', 'fs.save', 'fs.load']) {
      const r = await auth.grant({ key: PEER, path: p });
      const held = require('../run/js/nodeStore').open(root).auth.paths(PEER);
      if (r && r.refusal && held.indexOf(p) === -1) test.check('auth.grant ' + p + ' is refused, ' + r.refusal + ', and nothing is stored');
      else test.fail(OWED + 'auth.grant ' + p + ' answered ' + short(r) + ', stored ' + short(held));
    }
    const ok = await auth.grant({ key: PEER, path: 'node.card' });
    if (ok && !ok.refusal) test.check('a grant outside fs is still made (node.card)');
    else test.fail('auth.grant node.card answered ' + short(ok) + ': the fixture is wrong, not the build');
  } catch (e) {
    test.fail(OWED + 'the grant table could not be driven: ' + (e && e.message || e));
  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

  // ── 3. NO SIZE LIMIT AT THE OWNER'S DOOR ─────────────────────────────
  test.subHeading('3. fs.save and fs.load take and answer a file of any size, on a node of its own');
  const home = setupRelayFakes('fsOwnerUnlimited').andy;
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  const rel = 'shell/fsOwnerUnlimited/big.txt';
  try { fs.rmSync(path.join(home, 'shell', 'fsOwnerUnlimited'), { recursive: true, force: true }); } catch (e) { /* a first run */ }
  // Many times one request, and past the 64 pieces the face's join holds today.
  const big = 'abcdefghij'.repeat(Math.ceil((80 * BODY_MAX) / 10));
  const port = await freePort();
  let said = '';
  const child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', function (c) { said = (said + c).slice(-4096); });
  try {
    await waitForBoot(port);
    const saved = await call(port, { verb: 'fs.save', path: rel, content: big });
    let onDisk = null;
    try { onDisk = fs.readFileSync(path.join(home, rel), 'utf8'); } catch (e) { onDisk = null; }
    if (saved.status >= 200 && saved.status < 300 && onDisk === big) test.check('fs.save of ' + big.length + ' bytes (' + Math.round(big.length / BODY_MAX) + ' times one request) is taken and lands whole');
    else test.fail(OWED + 'fs.save of ' + big.length + ' bytes answered ' + saved.status + ' ' + short(saved.text) + ', on disk ' + (onDisk === null ? 'nothing' : onDisk.length + ' bytes'));
    // The load is asked of a file put there by hand, so it is judged apart from the save.
    const rel2 = 'shell/fsOwnerUnlimited/planted.txt';
    fs.mkdirSync(path.join(home, 'shell', 'fsOwnerUnlimited'), { recursive: true });
    fs.writeFileSync(path.join(home, rel2), big, 'utf8');
    const loaded = await call(port, { verb: 'fs.load', path: rel2 });
    let text = null;
    try { text = JSON.parse(loaded.text).text; } catch (e) { text = null; }
    if (loaded.status === 200 && text === big) test.check('fs.load answers a ' + big.length + '-byte file whole');
    else test.fail(OWED + 'fs.load of ' + big.length + ' bytes answered ' + loaded.status + ', ' + (text === null ? short(loaded.text) : text.length + ' bytes'));
  } catch (e) {
    test.fail(e.message + ': ' + said.trim().split('\n').slice(-6).join(' | '));
  } finally { child.kill(); }

  // ── 4. THE FACE'S SAVE IN PARTS ──────────────────────────────────────
  // The box fixes what the save does, not its wire shape; the builder names that under the item, and each line below
  // turns red when its unit lands, to be written as the assertion it stands in for.
  test.subHeading('4. the face\'s save in parts, streamed to a work file (awaiting the shape)');
  const faceHome = code('js/faceHome.js');
  const faceShell = code('face/shell.js');
  test.awaiting('goal/G33.10', 'a sized save from the face', /size/.test(faceShell) && /size/.test(faceHome) && !/PIECES_MAX = 64/.test(faceHome),
    'a save from the face names its size up front, and any size is taken: no 64 pieces, no PIECES_BYTES_MAX');
  test.awaiting('goal/G33.10', 'a work file in the system temp folder', /os\.tmpdir\(\)|require\('os'\)\.tmpdir/.test(faceHome),
    'each part is streamed, as it arrives, into a work file under os.tmpdir(), never the whole file in memory; on the last part it is copied to the target, then deleted');
  test.awaiting('goal/G33.10', 'an hour without a part drops the transfer', /60 \* 60 \* 1000|3600000/.test(faceHome),
    'a work file with no new part for an hour is deleted, and the target is left as it was');
  test.awaiting('goal/G33.10', 'the whole icon set saves from the face', false,
    'end to end through the face; written with the three above');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
