'use strict';

// spirit/test/arrivals.js
// The router's arrival seam — the thing that did not exist.
//
// ── WHAT THIS SUITE IS GUARDING ──────────────────────────────────────
//
// peerPost has had an `onArrival` hook since the router landed. Until
// 2026-09-13 its only caller in the tree was spirit/test/frontDoor.js,
// and server.js built createPeerPost without it — so a packet from a
// peer was admitted, logged, receipted and dropped, and no app could
// ever see it.
//
// That is the shape of failure this suite exists for, and it is worth
// naming because it is not the obvious one: the hook WORKED. A test of
// the hook alone passed the whole time the feature did not exist. So the
// checks below are about the seam being CONNECTED and about the message
// an app is actually handed, never about the hook being callable.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const packet = require('../run/js/client/packet');
const arrivalsModule = require('../run/js/arrivals');
const trafficLog = require('../run/js/trafficLog');

test.startTest('Arrivals — a packet from a peer reaches something');

// ---------------------------------------------------------------------
test.subHeading('The seam itself');
// ---------------------------------------------------------------------

function itemWith(text) {
  return {
    item: 'in_1',
    hash: 'abc123',
    from: 'PEERKEY',
    text: text,
    at: '2026-09-13T10:00:00.000Z',
    relay: 'https://relay.example',
  };
}

(function oneSubscriberGetsIt() {
  const arrivals = arrivalsModule.createArrivals();
  const seen = [];
  arrivals.subscribe(function (m) { seen.push(m); });

  const encoded = packet.encode('chess', { move: 'e4' });
  arrivals.note(itemWith(encoded.text));

  // ── AS SIGNED, NOT AS READ ─────────────────────────────────────────
  //
  //   Andy: "nothing in node and relay should know about apps."
  //
  // This asserted `seen[0].packet.app` — the node having decoded the
  // envelope before handing the row on. It carries the payload verbatim
  // now and the shell decodes it, because the shell is the only thing
  // that routes on `app`.
  if (seen.length === 1 && seen[0].packet === undefined && seen[0].text === encoded.text) {
    test.check('a packet noted on the seam reaches a subscriber, payload exactly as signed');
  } else {
    test.fail('subscriber got ' + JSON.stringify(seen));
  }

  // The body is still an object where it is READ. An app asked for
  // `{move:'e4'}` and that is what deliverPackets hands its handler —
  // decoded by the shell rather than by the node, which changes who does
  // it and not what an app receives.
  const read = packet.decode(seen[0].text);
  if (read.app === 'chess' && read.body && read.body.move === 'e4') {
    test.check('and decoding it where it is routed gives the object the sender encoded');
  } else {
    test.fail('decoded as ' + JSON.stringify(read));
  }

  // THE FIELD THE TWO TRANSPORTS MUST AGREE ON. The ring's messages
  // carry fromKey and its readers reach for it; the router's item calls
  // the same thing `from`. If they differ, every reader grows a branch
  // for which road a line came down — which is the seam this cycle is
  // removing, not one to add.
  if (seen[0] && seen[0].fromKey === 'PEERKEY' && seen[0].from === 'PEERKEY') {
    test.check('and it carries fromKey, so a reader cannot tell which transport it came down');
  } else {
    test.fail('identity fields were ' + JSON.stringify({ from: seen[0] && seen[0].from, fromKey: seen[0] && seen[0].fromKey }));
  }
})();

(function everySubscriberGetsIt() {
  const arrivals = arrivalsModule.createArrivals();
  let a = 0;
  let b = 0;
  arrivals.subscribe(function () { a += 1; });
  arrivals.subscribe(function () { b += 1; });

  const delivered = arrivals.note(itemWith(packet.encode('chess', {}).text));

  if (a === 1 && b === 1 && delivered === 2) {
    test.check('two open pages both get it — a second tab is not a second node');
  } else {
    test.fail('a=' + a + ' b=' + b + ' delivered=' + delivered);
  }
})();

(function unsubscribeReallyStops() {
  const arrivals = arrivalsModule.createArrivals();
  let hits = 0;
  const off = arrivals.subscribe(function () { hits += 1; });
  off();
  arrivals.note(itemWith(packet.encode('chess', {}).text));

  if (hits === 0 && arrivals.count() === 0) {
    test.check('an unsubscribed page stops receiving, and is not still counted');
  } else {
    test.fail('hits=' + hits + ' count=' + arrivals.count());
  }
})();

(function aThrowingSubscriberIsContained() {
  const arrivals = arrivalsModule.createArrivals();
  let good = 0;
  arrivals.subscribe(function () { throw new Error('a bad browser handler'); });
  arrivals.subscribe(function () { good += 1; });

  let threw = false;
  try { arrivals.note(itemWith(packet.encode('chess', {}).text)); }
  catch (e) { threw = true; }

  // This matters more than it looks: note() is called by peerPost while
  // it still owes the sender a receipt. A browser handler that throws
  // must not be able to turn an arrival into a refusal.
  if (!threw && good === 1) {
    test.check('one page throwing does not reach peerPost, and does not rob the other page');
  } else {
    test.fail('threw=' + threw + ' good=' + good);
  }
})();

// REPLACED, NOT DELETED. Until R10 was answered this check read "with no
// page open the packet is dropped, and says so" — and it recorded a known
// gap rather than a rule. The gap is closed; the check had to change with
// it or it would go on passing for the wrong reason, since 0 delivered is
// still 0 delivered whether the packet was thrown away or kept.
(function nobodyHomeMeansItWaits() {
  const arrivals = arrivalsModule.createArrivals();
  let threw = false;
  let delivered = -1;
  try { delivered = arrivals.note(itemWith(packet.encode('chess', { move: 'e4' }).text)); }
  catch (e) { threw = true; }

  if (!threw && delivered === 0) {
    test.check('with no page open nothing is delivered, and the seam says so rather than throwing');
  } else {
    test.fail('threw=' + threw + ' delivered=' + delivered);
  }

  // THE HALF THAT MATTERS. Holding it is worthless unless the next page
  // to open is actually given it.
  // The holding and the replay are the LOG's job now, and are checked
  // against a real one below. In memory, with no log, there is nothing to
  // hold it in — which is the honest behaviour for a seam nobody gave a
  // store to.
  const late = [];
  arrivals.subscribe(function (m) { late.push(m); });
  if (late.length === 0) {
    test.check('and with no log behind it there is nothing to replay — this file keeps no store of its own');
  } else {
    test.fail('a storeless seam replayed something: ' + late.length);
  }
})();

(function deliveredMeansSomebodyActuallyTookIt() {
  const arrivals = arrivalsModule.createArrivals();
  arrivals.subscribe(function () { throw new Error('a page that is broken'); });
  const delivered = arrivals.note(itemWith(packet.encode('chess', {}).text));

  // A subscriber that threw received nothing, whatever it claims by
  // existing. Counting a broken page as a reader would lose the packet at
  // exactly the moment something is already wrong — so it is held, and
  // the next page that opens properly gets it.
  if (delivered === 0) {
    test.check('a page that throws does not count as having received it — so nothing is marked taken');
  } else {
    test.fail('delivered=' + delivered);
  }
})();

// ONE STORE, AND IT IS THE LOG.
//
// These drove a private relay-state/pendingArrivals.json until the fold.
// Keeping a second copy of "what is still waiting" beside the traffic log
// was two facts that could drift, and the traffic log could not be used
// only because it could not be READ back safely — it records arrival, not
// admission. That was fixed at the source (rows carry `admitted`) rather
// than worked around here.
//
//   Andy: "tests can read what they need to read, production code MUST
//   read through the API."
//
// So this file reaches the log through its api block, and so does
// everything else in run/.
function logAt(home) {
  return trafficLog.createTrafficLog({ rootDir: home, relayMode: false });
}

// What peerPost writes before it calls onArrival: the row first, the fan
// out second. Reproduced here so these checks drive the same order.
function landed(log, hash, text, admitted) {
  log.note({
    dir: 'in', kind: 'request', peer: 'PEERKEY', relay: 'https://relay.example',
    hash: hash, outcome: admitted === false ? 'ignored' : 'delivered',
    payload: text, admitted: admitted !== false,
  });
}

(function theBacklogSurvivesARestart() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlog-'));

  // A laptop closing is the ordinary case, and a backlog that lived only
  // in memory would lose exactly the packets it exists for.
  const log = logAt(home);
  landed(log, 'h1', packet.encode('chess', { move: 'e4' }).text);

  const after = arrivalsModule.createArrivals({ traffic: logAt(home) });
  const got = [];
  after.subscribe(function (m) { got.push(m); });

  // THE BYTES THAT WERE SIGNED, which is the stronger claim than the
  // node's reading of them — see the note on the first subscriber above.
  if (got.length === 1 && got[0].packet === undefined &&
      packet.decode(got[0].text).app === 'chess') {
    test.check('a packet held while the node was down is still there when it comes back');
  } else {
    test.fail('after restart: ' + JSON.stringify(got));
  }

  // And it is marked, so it is not replayed for ever to every page that
  // ever opens.
  const third = arrivalsModule.createArrivals({ traffic: logAt(home) });
  const again = [];
  third.subscribe(function (m) { again.push(m); });
  if (again.length === 0) {
    test.check('and is marked taken afterwards, rather than replayed to every page that opens');
  } else {
    test.fail('replayed again after delivery: ' + again.length);
  }

  fs.rmSync(home, { recursive: true, force: true });
})();

(function aHeldStrangerIsNotBacklog() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlog-held-'));
  const log = logAt(home);

  // THE REASON THE LOG COULD NOT BE USED BEFORE, now checked. A packet
  // the front door held is in the log with its payload and must never be
  // replayed to an app — a stranger waiting to be accepted is a decision
  // a human makes, not a line an app is handed first.
  landed(log, 'admitted', packet.encode('chess', { move: 'e4' }).text, true);
  landed(log, 'held', packet.encode('chess', { move: 'e5' }).text, false);

  const got = [];
  arrivalsModule.createArrivals({ traffic: logAt(home) })
    .subscribe(function (m) { got.push(m); });

  if (got.length === 1 && got[0].hash === 'admitted') {
    test.check('a packet the front door HELD is in the log and is never replayed as backlog');
  } else {
    test.fail('replayed: ' + JSON.stringify(got.map(function (m) { return m.hash; })));
  }

  fs.rmSync(home, { recursive: true, force: true });
})();

(function undeliveredMailHasNoClock() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlogage-'));
  const clock = { value: Date.parse('2026-09-13T12:00:00.000Z') };
  const log = trafficLog.createTrafficLog({
    rootDir: home, relayMode: false, now: function () { return clock.value; },
  });

  landed(log, 'old', packet.encode('chess', { move: 'e4' }).text);

  // A YEAR later. The window is right for a record and wrong for
  // undelivered mail: ageing it out would make a receipt this node
  // already signed true when signed and a lie by morning.
  clock.value += 365 * 24 * 60 * 60 * 1000;

  const got = [];
  arrivalsModule.createArrivals({
    traffic: trafficLog.createTrafficLog({
      rootDir: home, relayMode: false, now: function () { return clock.value; },
    }),
  }).subscribe(function (m) { got.push(m); });

  if (got.length === 1 && got[0].hash === 'old') {
    test.check('a packet a YEAR old is still waiting — undelivered mail has no clock, whatever the receipt promised');
  } else {
    test.fail('kept: ' + JSON.stringify(got.map(function (m) { return m.hash; })));
  }

  fs.rmSync(home, { recursive: true, force: true });
})();

(function abrokenLogIsNotACrash() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlogjunk-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'traffic.json'), '{ not json at all');

  let threw = false;
  const got = [];
  try {
    const arrivals = arrivalsModule.createArrivals({ traffic: logAt(home) });
    arrivals.subscribe(function (m) { got.push(m); });
    arrivals.note(itemWith(packet.encode('chess', {}).text));
  } catch (e) { threw = true; }

  if (!threw && got.length === 1) {
    test.check('a truncated log reads as nothing held, and the live path keeps working');
  } else {
    test.fail('threw=' + threw + ' got=' + got.length);
  }

  fs.rmSync(home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('One shape, both transports');
// ---------------------------------------------------------------------

// bothRoadsDecorateTheSame STOOD HERE. It compared hub.decorateWithPacket
// against the arrivals path to prove one shape whichever road a line
// travelled — the ring and the router.
//
// Three things ended it. The ring went with R8, so there is one road.
// The node stopped decoding altogether, so there is nothing to compare.
// And hub.decorateWithPacket does not exist: an app envelope is not the
// node’s to read (Andy: "nothing in node and relay should know about
// apps").
//
// What replaces it is the absence, asserted in spirit/test/packet.js —
// no module under run/js requires packet.js at all.


// ---------------------------------------------------------------------
test.subHeading('Connected: peerPost actually notes into it');
// ---------------------------------------------------------------------

// THE CHECK THAT WOULD HAVE FAILED. Everything above passes against a
// seam nothing calls. This drives the real peerPost, with the real front
// door, and asks whether a packet came out the other side.

(function peerPostFeedsTheSeam() {
  const peerPost = require('../run/js/peerPost');
  const trafficLog = require('../run/js/trafficLog');
  const whoBook = require('../run/js/whoBook');

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-arrivals-'));
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  const them = auth.generateIdentity('them');

  // Known, or the front door refuses before the seam is ever reached —
  // which is correct and is exactly why this has to be set up rather
  // than assumed. See frontDoor.js.
  whoBook.hold(home, { publicKey: them.publicKey, publicLabel: 'them' });
  whoBook.accept(home, them.publicKey);

  const arrivals = arrivalsModule.createArrivals();
  const seen = [];
  arrivals.subscribe(function (m) { seen.push(m); });

  const router = peerPost.createPeerPost({
    rootDir: home,
    request: function () { return Promise.resolve({ status: 200, text: '{}' }); },
    admit: function (from) { return require('../run/js/hub').frontDoor(home, from); },
    remember: function () {},
    traffic: trafficLog.createTrafficLog({ rootDir: home, relayMode: false }),
    onArrival: arrivals.note,
  });

  const encoded = packet.encode('chess', { move: 'e4' });
  const text = encoded.text;
  const sig = auth.sign(them.privateKey, auth.postMessage(them.publicKey, me.publicKey, text));

  return router.onRequest('https://relay.example', {
    from: them.publicKey, to: me.publicKey, text: text, sig: sig,
  }).then(function () {
    // Decoded here, not by the node — see the first subscriber above.
    if (seen.length === 1 && seen[0].packet === undefined &&
        packet.decode(seen[0].text).app === 'chess') {
      test.check('a real post from a known peer comes out of the seam as a chess packet');
    } else {
      test.fail('peerPost delivered ' + JSON.stringify(seen));
    }

    // And the negative half, or the check above passes for a node that
    // hands every stranger straight to its apps.
    const stranger = auth.generateIdentity('stranger');
    const sSig = auth.sign(stranger.privateKey, auth.postMessage(stranger.publicKey, me.publicKey, text));
    return router.onRequest('https://relay.example', {
      from: stranger.publicKey, to: me.publicKey, text: text, sig: sSig,
    }).then(function () {
      if (seen.length === 1) {
        test.check('and a stranger reaches no app at all — the front door binds before the seam');
      } else {
        test.fail('a stranger reached the seam: ' + JSON.stringify(seen));
      }
      theLastHop();
      test.reportSuccessFailureCount();
    });
  });
})();

// ---------------------------------------------------------------------
// The browser half, against the real shell.js.
// ---------------------------------------------------------------------
//
// The node side above proves a packet comes out of the seam. This proves
// the other three lines — kernel's `packet` listener, the shell's
// onPacket, and deliverPackets — actually hand it to an app. Without it
// the wiring is asserted by clicking, which is the thing this cycle's
// method exists to stop.

function theLastHop() {
  test.subHeading('The last hop: a registered app handler is called');

  // Only what shell.js touches at load. Deliberately smaller than
  // natterIntrinsic's fixture: that one exercises desktop rendering, and
  // this one only needs an app to mount.
  function fakeElement(tag) {
    var html = '';
    var el = {
      tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [],
      appendChild: function (child) { el.children.push(child); return child; },
      addEventListener: function () {},
      querySelector: function () { return fakeElement('div'); },
      querySelectorAll: function () { return []; },
      remove: function () {},
    };
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return html; },
      set: function (v) { html = String(v); el.children.length = 0; },
      enumerable: true,
    });
    return el;
  }

  var byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home']
    .forEach(function (id) { byId[id] = fakeElement('div'); });
  var doc = {
    body: fakeElement('body'),
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
  };

  var subscribers = [];
  var shellSpirit = {
    core: {
      // This fixture drives no verb, so the mouth is present and
      // loud: a suite that starts posting should say so, not quietly
      // reach a global.
      ask: function () { throw new Error('this fixture hands shell.js no fetch'); },
      const: { ICON: require('../run/js/kernel').core.const.ICON, MIME: {} },
      util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
          if (rel === 'app/natter/session.json') {
            return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
          }
          return null;
        },
        saveFile: function () { return Promise.resolve(); },
        statFile: function () { return null; },
        getAnnotations: function () { return {}; },
        createScopedFs: function () { return {}; },
      },
      jobs: { subscribe: function (handlers) { subscribers.push(handlers); } },
    },
  };

  var src = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js'), 'utf8'
  );
  new Function('spirit', 'document', src)(shellSpirit, doc);

  // THE WIRE ITSELF. If shell.js stops passing onPacket to subscribe,
  // this is the check that goes red — and it is the exact failure the
  // whole feature had for months on the node side.
  var wired = subscribers.filter(function (h) { return typeof h.onPacket === 'function'; });
  if (wired.length === 1) {
    test.check('the shell subscribes to `packet` on the node event stream');
  } else {
    test.fail('shell registered onPacket handlers: ' + wired.length);
  }

  var got = [];
  shellSpirit.shell.registerApp({
    id: 'chess',
    name: 'Chess',
    icon: 'FILE',
    mount: function (el, api) {
      api.onPacket('chess', function (body, message) { got.push({ body: body, message: message }); });
    },
    render: function () {},
  });
  shellSpirit.shell.launchApp('chess');

  var encoded = packet.encode('chess', { move: 'e4' });
  var message = packet.decorate({ id: 'in_1', from: 'PEERKEY', fromKey: 'PEERKEY', text: encoded.text });

  if (wired.length) wired[0].onPacket(message);

  if (got.length === 1 && got[0].body && got[0].body.move === 'e4') {
    test.check('a packet on that stream reaches the app that asked for it, body first');
  } else {
    test.fail('the app received ' + JSON.stringify(got));
  }

  // Not a broadcast. An app that did not ask for `chess` must not be
  // handed somebody else's traffic just because it was mounted.
  var otherGot = 0;
  shellSpirit.shell.registerApp({
    id: 'notchess',
    name: 'Not Chess',
    icon: 'FILE',
    mount: function (el, api) { api.onPacket('draughts', function () { otherGot += 1; }); },
    render: function () {},
  });
  shellSpirit.shell.launchApp('notchess');
  if (wired.length) wired[0].onPacket(message);

  if (otherGot === 0) {
    test.check('and an app listening for a different packet app is not handed it');
  } else {
    test.fail('an unrelated app received ' + otherGot + ' packet(s)');
  }
}
