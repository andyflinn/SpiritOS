'use strict';

// spirit/test/appShellGrant.js
// THE GRANT MECHANISM — the bottom of the public-face vision, asserted
// before it is built.
//
//   Andy, 2026-09-25: "so the bottom is the grant mechanism that underpins
//   the installation of join into the DNS namespace as well as member
//   subdomain assignments."
//   And the two constraints on it, his words: "faceless, no shortcut."
//   And the minimum: "the appShellApp could implement the bare minimum,
//   and this is the no-face negotiation, without any local shell interface
//   yet or anything."
//
// Written by wsl-claude from the interface the other agent named, after
// asking for it rather than guessing — which is G15 from cycle 2 applied
// to the next thing. Every name called here came from that message and
// none from reading the source.
//
// ── FACELESS IS WHAT MAKES THESE ASSERTIONS HONEST ──────────────────
//
// No public face, no control panel, no HTTP surface, no UI. THE ONLY WAY
// TO DRIVE IT IS THE EXCHANGE — so this suite drives it exactly the way
// join's installer will, because there is no other way to drive it at
// all. There is no UI path that could diverge from the tested one and no
// local path that could skip the wire.
//
// ── RED IS THE EXPECTED STATE, AND RED IS THE POINT ─────────────────
//
// Andy ruled the minimum this morning and nothing is built. An assertion
// written now says "not built AND here is exactly what built looks like",
// which catches a WRONG build; a declaration says only "not built". The
// other agent asked for reds over awaitings and was right to.
//
// WHAT IS NOT ASSERTED HERE, deliberately: anything about join's hostname
// or path (join's shape is not settled), and anything about the generic
// shell layer (app/shell does not exist). Both are declared elsewhere and
// a suite that guesses at an unsettled API has to be rewritten when the
// design lands.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const APP_DIR_REL = 'spirit/run/app/appShellApp';

function has(rel) { return fs.existsSync(path.join(REPO, rel)); }

const appThere = has(APP_DIR_REL);

// ONE SENTENCE PER ABSENT UNIT rather than one per assertion it would
// have fed — the same shape as the app-server board, for the same reason:
// forty failures about one missing folder tell the reader one thing forty
// times.
function needs(req, what) {
  test.fail(req + ' — `' + APP_DIR_REL + '` is not built yet, so this cannot pass: ' + what);
}

test.startTest('The grant mechanism — faceless, no shortcut, and no special case');

// ── THE REFUSAL IS DECLARED BEFORE ANYTHING USES IT ──────────────────
//
// G9's rule, and the one half of this that is checkable with nothing
// built: a refusal an app can emit is a member of a declared set. The
// code was named in the interface, so this either finds it or says the
// catalogue has not caught up.
test.subHeading('the refusal is a member of the declared set');
{
  let errors = null;
  try { errors = require(path.join(REPO, 'spirit/run/js/spiritErrors.js')); } catch (e) { errors = null; }
  if (!errors || typeof errors.byCode !== 'function') {
    test.fail('grant: spiritErrors no longer exposes byCode(), so "every refusal is declared" cannot be walked');
  } else if (errors.byCode('name-already-granted')) {
    test.check('grant: name-already-granted is in the catalogue — the refusal is walkable before anything emits it');
  } else {
    test.fail('grant: name-already-granted is not in spiritErrors. The interface names it as the refusal, and a code ' +
      'that exists only in the emitting file is outside the closed set at the one moment it matters');
  }
}

// ── FACELESS, WHICH IS ASSERTABLE TODAY AND FOREVER ──────────────────
//
// This is the constraint most likely to erode, because a control panel is
// the obvious next convenience and nothing would go red. It is also the
// constraint that makes every other assertion here honest — the moment
// there is a second way in, the suite stops driving what the installer
// drives.
test.subHeading('faceless — the exchange is the only door');
{
  if (!appThere) {
    needs('grant: faceless', 'the app must carry no HTTP surface, no page and no control panel');
  } else {
    const offenders = [];
    const stack = [path.join(REPO, APP_DIR_REL)];
    while (stack.length) {
      const p = stack.pop();
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); }); continue; }
      if (/\.(html|htm|css)$/i.test(p)) { offenders.push(path.relative(REPO, p) + ' (a face)'); continue; }
      if (!/\.js$/.test(p)) continue;
      const body = fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Match what it DOES, not what it says — the third costume of a
      // lesson this suite family has paid for twice.
      if (/createServer\(|\.listen\(|require\(['"]https?['"]\)/.test(body)) {
        offenders.push(path.relative(REPO, p) + ' (serves)');
      }
    }
    if (!offenders.length) {
      test.check('grant: the app has no face — no page, no stylesheet, nothing that listens. The exchange is the only door, ' +
        'which is what lets this suite drive it the way join\'s installer will');
    } else {
      test.fail('grant: a face appeared on the faceless app: ' + offenders.join(', ') +
        '. Andy: "faceless, no shortcut" — and a second door means the tested path and the used path can diverge');
    }
  }
}

// ── THE EXCHANGE ITSELF ──────────────────────────────────────────────
//
// Two nodes, one relay, one puppet mounted by the real seam.
//
// NO labMaster. The gate that used to stand this suite down was written
// when the driver was expected to need a node built from the tree, and
// it does not: peerPost, the router, the signing, the hashes, the
// envelope and nodeApps are all the real modules here, and the relay is
// a transport. Same fixture shape as peerPost.js's own suite and the
// same argument — anything this gets wrong, the real one would get
// wrong too, because it IS the same module.
//
// THE APP IS COPIED, NOT POINTED AT. Its code is the real file byte for
// byte; its DATASET must not be written into the checkout, because a
// suite that leaves grants.json behind plants its own state into every
// node home built afterwards (plantRun.js:56, and the .gitignore line
// that exists for exactly that).
const os = require('os');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const trafficLog = require('../run/js/trafficLog');
const routerTable = require('../run/js/router');
const arrivalsMod = require('../run/js/arrivals');
const nodeApps = require('../run/js/nodeApps');
const packet = require('../run/js/client/packet.js');

const sealKeys = Object.create(null);
function sealKeyFor(key) { return sealKeys[key] || ''; }

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grant-'));
  const id = auth.generateIdentity(name);
  auth.saveIdentity(home, id);
  sealKeys[id.publicKey] = id.sealPublicKey;
  return home;
}

function fakeRelay() {
  const routes = routerTable.createRouter({});
  const streams = Object.create(null);
  return {
    listen: function (key, onEvent) { streams[key] = onEvent; },
    request: function (url, method, pathname, body) {
      if (/\/api\/relay\/post$/.test(pathname)) {
        const verified = auth.postSignatureFor(body.from, body.from, body.to, body.text, body.sig);
        if (!verified) return Promise.resolve({ status: 403, text: '{"error":"bad sig"}' });
        if (!streams[body.to]) return Promise.resolve({ status: 503, text: '{"error":"peer not reachable"}' });
        const hash = auth.requestHash(verified);
        const opened = routes.open(hash, body.from, body.to, function () {
          streams[body.to]('request', { from: body.from, to: body.to, text: body.text, sig: body.sig });
          return true;
        });
        if (!opened.ok) {
          return Promise.resolve({ status: opened.status, text: JSON.stringify({ error: opened.error }) });
        }
        return Promise.resolve({ status: 202, text: JSON.stringify({ ok: true, hash: hash }) });
      }
      if (/\/api\/relay\/reply$/.test(pathname)) {
        const matched = routes.answer(body.hash, body.from);
        if (!matched.ok) return Promise.resolve({ status: matched.status, text: JSON.stringify(matched) });
        if (streams[matched.requester]) {
          streams[matched.requester]('reply', { hash: body.hash, from: body.from, text: body.text, sig: body.sig });
        }
        return Promise.resolve({ status: 200, text: '{"ok":true}' });
      }
      return Promise.resolve({ status: 404, text: '{}' });
    },
  };
}

function nodeFor(name, relay) {
  const home = tmpHome(name);
  const id = auth.loadIdentity(home);
  const traffic = trafficLog.createTrafficLog({ rootDir: home });
  const arrivals = arrivalsMod.createArrivals({ traffic: traffic });
  const P = peerPost.createPeerPost({
    rootDir: home, request: relay.request, waitMs: 800, traffic: traffic,
    onArrival: arrivals.note,
    sealKeyFor: sealKeyFor,
  });
  relay.listen(id.publicKey, function (event, body) {
    if (event === 'request') P.onRequest('http://relay', body);
    else if (event === 'reply') P.onReply(body);
  });
  return { name: name, home: home, id: id, P: P, traffic: traffic, arrivals: arrivals };
}

// The owner's node with the puppet actually mounted on it, through
// nodeApps.mountAll — so the manifest's `boots: true` is what causes the
// mount, rather than this suite calling mount() itself and proving only
// that a function it imported runs.
function mountPuppet(owner, relay, listed) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grant-root-'));
  const appDir = path.join(root, 'app', 'appShellApp');
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.cpSync(path.join(REPO, APP_DIR_REL), appDir, { recursive: true });
  // AND ITS SIBLINGS COME WITH IT. The app requires `../../js/client/
  // packet.js` — the shared envelope, which is the whole point of the
  // conversion — so a copied app with no `js/` beside it does not mount
  // at all. The first version of this fixture copied only the folder and
  // every assertion failed with a null reply, which read as "the exchange
  // is broken" and was "the app was never there". Linked where the
  // platform allows it, copied where it does not.
  try {
    fs.symlinkSync(path.join(REPO, 'spirit', 'run', 'js'), path.join(root, 'js'), 'junction');
  } catch (e) {
    fs.cpSync(path.join(REPO, 'spirit', 'run', 'js'), path.join(root, 'js'), { recursive: true });
  }
  fs.writeFileSync(path.join(appDir, 'allow.json'),
    JSON.stringify({ keys: listed }, null, 2) + '\n');
  const mounted = nodeApps.mountAll({
    rootDir: root,
    arrivals: owner.arrivals,
    post: function (url, to, text) { return owner.P.post('http://relay', to, text); },
    log: function (m) { if (process.env.GRANT_DEBUG) console.log('APP: ' + m); },
  });
  return { root: root, appDir: appDir, mounted: mounted };
}

// Ask, and wait for the reply to land as an arrival on the asker's own
// node. The reply is a SECOND POST, not an answer, so it comes back
// through arrivals like any other packet — which is the shape the
// no-synchronous-answer ruling chose.
function askFor(asker, ownerKey, name) {
  return new Promise(function (resolve) {
    let done = false;
    const off = asker.arrivals.subscribe(function (message) {
      if (done) return;
      const said = packet.decode(message && message.text);
      if (!said || said.app !== 'appShellApp') return;
      done = true;
      if (typeof off === 'function') off();
      resolve({ reply: said, message: message });
    });
    const made = packet.encode('appShellApp', { verb: 'grant', name: name });
    asker.P.post('http://relay', ownerKey, made.text).then(function (posted) {
      setTimeout(function () {
        if (done) return;
        done = true;
        resolve({ reply: null, message: null, posted: posted });
      }, 1200);
    });
  });
}

(async function () {
  if (!appThere) {
    needs('grant: an install grants a name', 'a packet asks for a name, the reply carries it, and a second ask for the same name is refused');
    needs('grant: the grant is durable', 'a granted name is still granted after the app restarts, or the dataset is not a dataset');
    needs('grant: no system-face special case', 'the same exchange refuses a collision identically whoever asked — join\'s installer or a member');
    needs('grant: a local exchange goes over the wire', 'a packet, a hash and a receipt exist for an exchange whose two ends are on one node');
    test.reportSuccessFailureCount();
    return;
  }

  const relay = fakeRelay();
  const owner = nodeFor('grant-owner', relay);
  const alice = nodeFor('grant-alice', relay);
  const bob = nodeFor('grant-bob', relay);
  const world = mountPuppet(owner, relay, [alice.id.publicKey, bob.id.publicKey]);

  test.subHeading('an install grants a name, and the second ask for it is refused');
  const first = await askFor(alice, owner.id.publicKey, 'join');
  if (first.reply && first.reply.body && first.reply.body.ok === true && first.reply.body.name === 'join') {
    test.check('grant: a packet asked for "join" and the reply carried it — ' +
      'granted at ' + String(first.reply.body.at));
  } else {
    test.fail('grant: the first ask for "join" was not granted: ' + JSON.stringify(first.reply));
  }

  const second = await askFor(bob, owner.id.publicKey, 'join');
  if (second.reply && second.reply.body && second.reply.body.ok === false &&
      second.reply.body.code === 'name-already-granted') {
    test.check('grant: a second peer asking for the same name is refused with the catalogued code');
  } else {
    test.fail('grant: the collision was not refused with name-already-granted: ' + JSON.stringify(second.reply));
  }

  test.subHeading('a local exchange goes over the wire');
  // ASSERTED POSITIVELY. "No local shortcut" is a negative about code
  // that does not exist and would be green on an empty tree.
  const crossings = owner.traffic.read();
  if (first.message && first.message.hash && first.reply && first.reply.re &&
      crossings.length > 0) {
    test.check('grant: the exchange left wire artefacts — the reply carries `re` ' +
      String(first.reply.re).slice(0, 12) + ' and the owner\'s traffic log holds ' +
      crossings.length + ' crossing(s), for two ends on one machine');
  } else {
    test.fail('grant: no wire artefacts: re=' + (first.reply && first.reply.re) +
      ' crossings=' + crossings.length);
  }

  test.subHeading('no system-face special case');
  const bobName = await askFor(bob, owner.id.publicKey, 'bobshop');
  const aliceOnBobs = await askFor(alice, owner.id.publicKey, 'bobshop');
  if (bobName.reply && bobName.reply.body && bobName.reply.body.ok === true &&
      aliceOnBobs.reply && aliceOnBobs.reply.body &&
      aliceOnBobs.reply.body.code === 'name-already-granted') {
    test.check('grant: the refusal is the same code in both directions — whoever asks first holds it, ' +
      'and there is no caller the exchange treats differently');
  } else {
    test.fail('grant: the collision was not symmetric: bob=' + JSON.stringify(bobName.reply) +
      ' alice=' + JSON.stringify(aliceOnBobs.reply));
  }

  // ── THE CONTROL, AND THIS SUITE HAS EARNED IT ───────────────────────
  //
  // Six greens above all depend on a reply arriving. A fixture that
  // fabricated replies, or an `allows` that said yes to everybody, would
  // look exactly like this. So: a peer who is NOT in allow.json asks for
  // a free name and must get SILENCE — which proves both that the gate
  // bites and that nothing here manufactures an answer.
  //
  // An earlier suite of mine went green because nothing had been loaded
  // (appServerBoundary, "an app that declares no surface is handed
  // none"). One control is cheaper than finding that out twice.
  test.subHeading('the control — an unlisted peer gets nothing');
  const carol = nodeFor('grant-carol', relay);
  const unlisted = await askFor(carol, owner.id.publicKey, 'carolshop');
  if (unlisted.reply === null) {
    test.check('grant: a peer absent from the puppet\'s contact list asked for a free name and got ' +
      'silence — the gate bites, and these assertions are capable of failing');
  } else {
    test.fail('grant: an unlisted peer was answered, so allows() is not gating and every green above ' +
      'is suspect: ' + JSON.stringify(unlisted.reply));
  }

  test.subHeading('the grant is durable');
  // REMOUNTED, not re-read. Asserted through the exchange rather than by
  // reading grants.json, because the file's name is an implementation and
  // a suite that reads storage asserts the implementation instead of the
  // promise.
  nodeApps.mountAll({
    rootDir: world.root,
    arrivals: owner.arrivals,
    post: function (url, to, text) { return owner.P.post('http://relay', to, text); },
    log: function (m) { if (process.env.GRANT_DEBUG) console.log('APP: ' + m); },
  });
  const afterRestart = await askFor(bob, owner.id.publicKey, 'join');
  if (afterRestart.reply && afterRestart.reply.body &&
      afterRestart.reply.body.code === 'name-already-granted') {
    test.check('grant: the name is still granted after the app is mounted again — ' +
      'the dataset is a dataset');
  } else {
    test.fail('grant: the grant did not survive a remount: ' + JSON.stringify(afterRestart.reply));
  }

  test.reportSuccessFailureCount();
}());
