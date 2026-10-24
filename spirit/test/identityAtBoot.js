'use strict';

// spirit/test/identityAtBoot.js
// A node has its key and a default name before it listens (goal/G22.5).
//
// Andy's rulings, 2026-10-13 (goal/G22.5 box): the first call to
// ensureIdentity ensures a real, permanent identity exists, and every later
// call returns that same identity and never makes another. With no name
// given, the machine's name (os.hostname()) is the default name. relayAuth
// ensures the identity of the spirit/run it sits in on its first load, so
// no other component ever has to make or check for one. The law: no
// node-boot is done until the node has a key and a default name.
//
// Two halves. (a) relayAuth.js planted alone into a spirit/run/spirit/ of its
// own: requiring it is enough to make the identity, and nothing afterwards
// re-keys it. (b) a whole planted node booted on its own port: the key is
// on disc when the port first answers, a restart keeps it, and a claim
// keeps it.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');

const RUN_JS = path.join(__dirname, '..', 'run', 'spirit');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function listening(port) {
  return new Promise(function (resolve) {
    const req = http.request({ host: '127.0.0.1', port: port, path: '/', method: 'GET' },
      function (res) { res.destroy(); resolve(true); });
    req.on('error', function () { resolve(false); });
    req.end();
  });
}
function readIdentity(run) {
  try { return JSON.parse(fs.readFileSync(path.join(run, 'relay-state', 'identity.json'), 'utf8')); }
  catch (e) { return null; }
}
function post(port, body) {
  return fetch('http://127.0.0.1:' + port + '/api/spirit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); },
    function (e) { return { status: 0, text: String(e && e.message || e) }; });
}

// A FRESH REQUIRE of a planted relayAuth.js: its own module and the one it
// requires are dropped from the cache first, so the first-load code runs.
function freshRequire(file) {
  Object.keys(require.cache).forEach(function (k) {
    if (k.indexOf(path.dirname(file)) === 0) delete require.cache[k];
  });
  return require(file);
}

test.startTest('goal/G22.5: a node has its key and a default name before it listens');

// ── (a) relayAuth on its own ─────────────────────────────────────────
function plantedModule() {
  test.subHeading('(a) relayAuth ensures the identity of the spirit/run it sits in, on first load');

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-idboot-'));
  const run = path.join(scratch, 'spirit', 'run');
  const js = path.join(run, 'spirit');
  fs.mkdirSync(js, { recursive: true });
  ['relayAuth.js', 'fieldRules.js'].forEach(function (f) { fs.copyFileSync(path.join(RUN_JS, f), path.join(js, f)); });
  const file = path.join(js, 'relayAuth.js');

  let auth = null;
  try { auth = freshRequire(file); } catch (e) { test.fail('the planted relayAuth.js would not load', String(e && e.message || e)); return; }

  const first = readIdentity(run);
  if (first && first.publicKey && first.privateKey && first.sealPublicKey && first.sealPrivateKey && first.name === os.hostname()) {
    test.check('requiring relayAuth.js made identity.json in its own spirit/run, with keys and the machine name');
  } else {
    test.fail('requiring relayAuth.js left no named identity in its own spirit/run',
      first ? 'name ' + JSON.stringify(first.name) + ', keys ' + !!(first.publicKey && first.privateKey) : 'no identity.json');
  }

  auth = freshRequire(file);
  const second = readIdentity(run);
  if (first && second && second.publicKey === first.publicKey && second.privateKey === first.privateKey) {
    test.check('a second first-load keeps the same key');
  } else {
    test.fail('a second first-load changed or lost the key');
  }

  // NO PUBLIC MINTING CALL (Andy, 2026-10-13): ensureIdentity is not exported.
  if (typeof auth.ensureIdentity === 'undefined' && typeof require('../run/spirit/relayAuth.js').ensureIdentity === 'undefined') {
    test.check('relayAuth does not export ensureIdentity: its first load is the only caller');
  } else {
    test.fail('relayAuth still exports ensureIdentity');
  }

  // THE CLAIM'S NAMING CALL names, and never re-keys.
  const named = typeof auth.nameIdentity === 'function' ? auth.nameIdentity(run, 'Andy') : null;
  const onDisc = readIdentity(run);
  if (first && named && named.publicKey === first.publicKey && onDisc && onDisc.publicKey === first.publicKey && onDisc.name === 'Andy') {
    test.check('nameIdentity over the machine-name default names it, and keeps the key');
  } else {
    test.fail('nameIdentity re-keyed or did not name the node',
      'name ' + JSON.stringify(onDisc && onDisc.name) + ', same key ' + !!(first && onDisc && onDisc.publicKey === first.publicKey));
  }

  const later = typeof auth.nameIdentity === 'function' ? auth.nameIdentity(run, 'Bob') : null;
  const after = readIdentity(run);
  if (first && later && later.publicKey === first.publicKey && after && after.name === 'Andy') {
    test.check('a later naming with another name returns the same identity: the name it has stands');
  } else {
    test.fail('a later naming changed the identity', 'name ' + JSON.stringify(after && after.name));
  }

  const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-idboot-none-'));
  const none = typeof auth.nameIdentity === 'function' ? auth.nameIdentity(nowhere, 'Carol') : 'missing';
  if (none === null && !fs.existsSync(path.join(nowhere, 'relay-state', 'identity.json'))) {
    test.check('nameIdentity over a root with no identity makes none and writes nothing');
  } else {
    test.fail('nameIdentity made an identity, or is missing');
  }

  // A NAMELESS IDENTITY WITH KEYS is still an identity, and a first load keeps it.
  const bareRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-idboot-bare-'));
  const bare = path.join(bareRoot, 'spirit', 'run');
  auth.saveIdentity(bare, auth.generateIdentity(''));
  const planted = readIdentity(bare);
  const loaded = auth.loadIdentity(bare);
  if (loaded && planted && loaded.publicKey === planted.publicKey) {
    test.check('loadIdentity answers a nameless identity that has keys');
  } else {
    test.fail('loadIdentity answered null for a nameless identity with keys');
  }
  fs.mkdirSync(path.join(bare, 'spirit'), { recursive: true });
  ['relayAuth.js', 'fieldRules.js'].forEach(function (f) { fs.copyFileSync(path.join(RUN_JS, f), path.join(bare, 'spirit', f)); });
  freshRequire(path.join(bare, 'spirit', 'relayAuth.js'));
  const keptOnDisc = readIdentity(bare);
  if (planted && keptOnDisc && keptOnDisc.publicKey === planted.publicKey && keptOnDisc.name === os.hostname()) {
    test.check('a first load keeps a nameless identity\'s key and gives it the machine name');
  } else {
    test.fail('a first load re-keyed a nameless identity, or left it nameless',
      'same key ' + !!(planted && keptOnDisc && keptOnDisc.publicKey === planted.publicKey) + ', name ' + JSON.stringify(keptOnDisc && keptOnDisc.name));
  }
}

// ── (b) a whole node, booted ─────────────────────────────────────────
async function bootedNode() {
  test.subHeading('(b) a booted node has its key before its port answers, and keeps it');

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-idboot-node-'));
  const run = path.join(scratch, 'spirit', 'run');
  plantRun.plantRunTree(run);
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });

  let kid = null;
  async function start() {
    const port = await freePort();
    kid = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'] });
    kid.stdout.on('data', function () {});
    kid.stderr.on('data', function () {});
    // The FIRST moment the port answers, the identity is read: never later.
    for (let i = 0; i < 1200; i++) {
      if (await listening(port)) return { port: port, id: readIdentity(run) };
      await sleep(25);
    }
    return { port: port, id: null, down: true };
  }
  async function stop() {
    if (!kid) return;
    const k = kid; kid = null;
    await new Promise(function (resolve) { k.once('exit', resolve); k.kill(); setTimeout(resolve, 3000); });
  }

  try {
    const one = await start();
    if (one.down) { test.fail('the planted node never answered on its port'); return; }
    const id = one.id;
    if (id && id.publicKey && id.privateKey && id.name === os.hostname()) {
      test.check('when the port first answers, identity.json already holds a key and the machine name');
    } else {
      test.fail('when the port first answered the node had no named identity',
        id ? 'name ' + JSON.stringify(id.name) + ', keys ' + !!(id.publicKey && id.privateKey) : 'no identity.json');
    }
    await stop();

    const two = await start();
    const again = two.id;
    if (id && again && again.publicKey === id.publicKey) {
      test.check('a restart keeps the same key');
    } else {
      test.fail('a restart changed the key');
    }

    // THE CLAIM PATH. hub.signedClaim runs before the relay is asked
    // anything, so a claim aimed at a port nobody holds walks the whole of
    // the node's half and then fails at the wire.
    const dead = await freePort();
    const claimed = await post(two.port, { verb: 'relay.claim', url: 'http://127.0.0.1:' + dead, name: 'idboot-claim' });
    const afterClaim = readIdentity(run);
    if (id && afterClaim && afterClaim.publicKey === id.publicKey && afterClaim.privateKey === id.privateKey) {
      test.check('a claim keeps the key the node booted with', 'claim answered ' + claimed.status);
    } else {
      test.fail('a claim replaced the key the node booted with', 'claim answered ' + claimed.status);
    }
  } finally {
    await stop();
  }
}

(async function () {
  try { plantedModule(); } catch (e) { test.fail('(a) threw', String(e && e.stack || e)); }
  try { await bootedNode(); } catch (e) { test.fail('(b) threw', String(e && e.stack || e)); }
  test.reportSuccessFailureCount();
})();
