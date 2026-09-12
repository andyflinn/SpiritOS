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
const packet = require('../run/js/packet');
const arrivalsModule = require('../run/js/arrivals');

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

  if (seen.length === 1 && seen[0].packet && seen[0].packet.app === 'chess') {
    test.check('a packet noted on the seam reaches a subscriber, envelope already decoded');
  } else {
    test.fail('subscriber got ' + JSON.stringify(seen));
  }

  // The body, not the envelope. An app asked for `{move:'e4'}` and that
  // is what deliverPackets hands its handler — if this arrived as a JSON
  // string every app would have to parse it and they would each do it
  // slightly differently.
  if (seen[0] && seen[0].packet && seen[0].packet.body && seen[0].packet.body.move === 'e4') {
    test.check('and the body arrives as the object the sender encoded, not as text');
  } else {
    test.fail('body was ' + JSON.stringify(seen[0] && seen[0].packet));
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

(function nobodyHomeIsNotAnError() {
  const arrivals = arrivalsModule.createArrivals();
  let threw = false;
  let delivered = -1;
  try { delivered = arrivals.note(itemWith('hello')); }
  catch (e) { threw = true; }

  // Recorded as a check rather than left implicit, because it is the
  // known gap: with no browser open a packet is DROPPED. The ring it
  // replaces held 200 messages on the relay, so this is strictly less —
  // see arrivals.js, and the requirement that the ring must not be
  // deleted until catch-up is designed.
  if (!threw && delivered === 0) {
    test.check('with no page open the packet is dropped, and says so (0 delivered) rather than throwing');
  } else {
    test.fail('threw=' + threw + ' delivered=' + delivered);
  }
})();

(function aLegacyLineIsStillCarried() {
  const arrivals = arrivalsModule.createArrivals();
  const seen = [];
  arrivals.subscribe(function (m) { seen.push(m); });
  arrivals.note(itemWith('just a chat line from before packets'));

  // Delivered, marked legacy, and the shell drops it at the fan-out
  // ("legacy lines belong to whoever polls"). The seam does not get to
  // decide that — it decodes and hands over, and the reader decides.
  if (seen.length === 1 && seen[0].packet.legacy === true && seen[0].packet.app === null) {
    test.check('a line that is not an envelope is carried and marked legacy, not swallowed here');
  } else {
    test.fail('legacy line arrived as ' + JSON.stringify(seen[0] && seen[0].packet));
  }
})();

// ---------------------------------------------------------------------
test.subHeading('One shape, both transports');
// ---------------------------------------------------------------------

(function bothRoadsDecorateTheSame() {
  const hub = require('../run/js/hub');
  const encoded = packet.encode('chess', { move: 'e4' });

  // The inbox path's decoration, and the router's, on the same text.
  const viaRing = hub.decorateWithPacket({ id: 'm1', from: 'bert', text: encoded.text });
  const arrivals = arrivalsModule.createArrivals();
  let viaRouter = null;
  arrivals.subscribe(function (m) { viaRouter = m; });
  arrivals.note(itemWith(encoded.text));

  if (JSON.stringify(viaRing.packet) === JSON.stringify(viaRouter.packet)) {
    test.check('the ring and the router build an identical `packet` — one function, not two');
  } else {
    test.fail('ring ' + JSON.stringify(viaRing.packet) + ' vs router ' + JSON.stringify(viaRouter.packet));
  }
})();

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
    if (seen.length === 1 && seen[0].packet.app === 'chess') {
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
