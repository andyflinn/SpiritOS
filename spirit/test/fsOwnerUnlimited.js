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
const BODY_MAX = require('../run/spirit/limits.js').BODY_MAX;
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
  const door = require('../run/spirit/apiDoor.js');
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
    const auth = require('../run/spirit/apiAuth').createApiAuth({
      rootDir: root,
      tree: function () { return Promise.resolve({ fs: { save: {}, load: {} }, node: { card: {} } }); },
    });
    for (const p of ['fs', 'fs.save', 'fs.load']) {
      const r = await auth.grant({ key: PEER, path: p });
      const held = require('../run/spirit/nodeStore').open(root).auth.paths(PEER);
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
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
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
  // The shape, named by the builder under the item: {upload: {id, n, of, size, path, bytes}}, each part sealed on its own
  // and sent as its own call (face/shell.js uploadSave, UPLOAD_PART bytes a part); the home node appends each part to
  // os.tmpdir()/spirit-upload-<id>, answers 202 to each but the last, and on the last checks the size, copies the work
  // file to the target through o.saveFrom, then deletes it. Driven here on faceHome itself, its clock handed in.
  test.subHeading('4. the face\'s save in parts, streamed to a work file in the system temp folder');
  const FH = require('../run/spirit/faceHome.js');
  const me = require('../run/spirit/relayAuth').generateIdentity('fsowner');
  let clock = Date.now();
  const saved = [];
  const answers = [];
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fsowner-target-'));
  const home2 = FH.createFaceHome({
    call: function () { return Promise.resolve({ status: 500, body: null }); },
    saveFrom: function (work, rel) {
      saved.push({ work: work, rel: rel, bytes: fs.readFileSync(work).length });
      fs.copyFileSync(work, path.join(target, path.basename(rel)));
      return { ok: true };
    },
    serveFile: function () {}, identity: function () { return me; }, relayKey: function () { return ''; },
    jobs: { subscribe: function () { return function () {}; } }, renames: null, log: function () {}, now: function () { return clock; },
    upload: function (url, at, headers) {
      const got = { status: Number(headers && headers['x-spirit-status']), body: '' };
      answers.push(got);
      return { on: function () {}, write: function (c) { got.body += String(c); return true; }, end: function (c) { if (c) got.body += String(c); } };
    },
  });
  const content = Buffer.from(fs.readFileSync(path.join(RUN, 'shell', 'icons', 'iconSet.json')));
  const PART = 8192;
  const of = Math.ceil(content.length / PART);
  const id = 'fsownerunlimited01';
  const work = path.join(os.tmpdir(), 'spirit-upload-' + id);
  const part = function (pid, n) { return { upload: { id: pid, n: n, of: of, size: content.length, path: 'shell/icons/iconSet.json', bytes: content.subarray(n * PART, (n + 1) * PART).toString('base64') } }; };
  home2.request('http://relay.test', { id: 'c0', request: part(id, 0) });
  await sleep(20);
  const afterFirst = fs.existsSync(work) ? fs.statSync(work).size : -1;
  if (answers[0] && answers[0].status === 202 && afterFirst === Math.min(PART, content.length) && !saved.length)
    test.check('the first part is appended to a work file in the system temp folder (' + afterFirst + ' bytes), answered 202, nothing saved yet');
  else test.fail(OWED + 'after the first part: answer ' + short(answers[0]) + ', work file ' + afterFirst + ' bytes, saved ' + saved.length);
  for (let n = 1; n < of; n++) { home2.request('http://relay.test', { id: 'c' + n, request: part(id, n) }); await sleep(20); }
  const last = answers[answers.length - 1];
  const landed = fs.existsSync(path.join(target, 'iconSet.json')) ? fs.readFileSync(path.join(target, 'iconSet.json')) : null;
  if (of > 1 && last && last.status === 200 && saved.length === 1 && saved[0].rel === 'shell/icons/iconSet.json' && landed && landed.equals(content) && !fs.existsSync(work))
    test.check('the whole icon set (' + content.length + ' bytes, ' + of + ' parts) is copied to its target on the last part, and the work file is deleted');
  else test.fail(OWED + 'after the last part: answer ' + short(last) + ', saved ' + short(saved) + ', landed ' + (landed ? landed.length : 'nothing') + ', work file left ' + fs.existsSync(work));

  // The size named up front is held to: parts past it are refused, and the transfer is dropped.
  const id2 = 'fsownerunlimited02';
  const lie = part(id2, 0);
  lie.upload.size = 10;
  home2.request('http://relay.test', { id: 'd0', request: lie });
  await sleep(20);
  if (answers[answers.length - 1].status === 413 && !fs.existsSync(path.join(os.tmpdir(), 'spirit-upload-' + id2))) test.check('a part past the size named up front is refused 413 and its work file deleted');
  else test.fail(OWED + 'a part past the named size answered ' + short(answers[answers.length - 1]));

  // An hour without a new part drops the transfer; the target is left as it was.
  const id3 = 'fsownerunlimited03';
  const before = saved.length;
  home2.request('http://relay.test', { id: 'e0', request: part(id3, 0) });
  await sleep(20);
  const work3 = path.join(os.tmpdir(), 'spirit-upload-' + id3);
  const made3 = fs.existsSync(work3);
  clock += 59 * 60 * 1000;
  home2.sweepUploads();
  const kept = fs.existsSync(work3);
  clock += 2 * 60 * 1000;
  home2.sweepUploads();
  if (made3 && kept && !fs.existsSync(work3) && saved.length === before) test.check('a work file is kept for 59 minutes without a part, deleted after the hour, and nothing is saved');
  else test.fail(OWED + 'the hour: made ' + made3 + ', kept at 59 minutes ' + kept + ', there after the hour ' + fs.existsSync(work3) + ', saves ' + (saved.length - before));
  try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) { /* scratch */ }

  // Each part fits one trip once sealed: the face seals it as one request, which the relay takes up to BODY_MAX.
  const seal = require('../run/spirit/seal');
  const sealedPart = JSON.stringify(Object.assign(seal.seal(me.sealPublicKey, me.publicKey, me.publicKey, JSON.stringify({ upload: { id: 'x'.repeat(24), n: 99, of: 100, size: 99999999, path: 'shell/icons/iconSet.json', bytes: Buffer.alloc(PART, 255).toString('base64') } })), { k: me.publicKey }));
  const faceShell = code('face/shell.js');
  if (Buffer.byteLength(sealedPart) < BODY_MAX && /var UPLOAD_PART = 8192;/.test(faceShell) && /String\(verb\) === 'fs\.save'[\s\S]{0,200}uploadSave\(args\)/.test(faceShell))
    test.check('the face sends an fs.save larger than one part in parts of ' + PART + ' bytes, each ' + Buffer.byteLength(sealedPart) + ' bytes sealed, inside one trip (' + BODY_MAX + ')');
  else test.fail(OWED + 'a sealed part is ' + Buffer.byteLength(sealedPart) + ' bytes against ' + BODY_MAX + ', or the face does not send fs.save in parts');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
