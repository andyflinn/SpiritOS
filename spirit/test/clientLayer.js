'use strict';

// spirit/test/clientLayer.js
// THE CLIENT HALF OF A peerPost, ASSERTED RATHER THAN DESCRIBED.
//
//   Andy: "There is a common lowest shell layer that must match request
//   and replies by hash, if it is a peerPost()"
//   Andy: "it should be a generic client layer, the point will come where
//   processes want to ask peer nodes for answers."
//   Andy: "AND we need to find a way to avoid future discussion of how
//   the protocol works....."
//
// This file exists to be that last one. Every rule below was settled in
// conversation at least once and would otherwise be settled again:
//
//   1. A CLIENT CANNOT SIGN AND CANNOT VERIFY. It holds no key. It asks
//      the node on its own machine to act, and the node signs. So a hash
//      is never proof to a client — it is the only thread it has from a
//      thing it caused back to news about that thing (decision 0011).
//
//   2. THE POST CARRIES NO HASH, and neither does any request. Sender,
//      relay and destination each compute it from the signed bytes they
//      hold. It crosses the wire once, on the reply, inside a signature.
//      A client learns it from its OWN node, never from a peer.
//
//   3. THE IMMEDIATE REPLY NEEDS NO TABLE. `peer.post` resolves only
//      after the round trip settles, so the answer IS the HTTP response.
//      A pending table for that would be dead weight on every exchange.
//
//   4. `re` IS THE LATER CASE, and the only one a table is for: a peer
//      sending a NEW packet about something asked earlier. That field has
//      travelled end to end since the router landed and nothing read it
//      until this layer.
//
//   5. THIS IS THE LOOPBACK CLIENT LAYER, not a browser API.
//
//        Andy: "The browser itself is not crypte-capable but it is
//        considered a safe loop-back client, same for processes."
//
//      The line is loopback client versus PEER, not browser versus
//      process. A peer holds a key, signs, and is addressable. A
//      loopback client holds none of that and asks the node to act.
//      A process could take a key and become a peer; transience argues
//      against it, because an identity nobody can address later is not
//      worth having. So it is one POST and one JSON answer over
//      loopback, plus one stream — implementable in any language, and
//      the shell is one client of it rather than its owner.
//
// What is NOT here, deliberately: catching up on what arrived while
// nobody was listening. A table dies with the page or the process that
// held it, and the log is what survives — keyed by hash and arrival-date
// (Andy, in hub.js). That is a separate piece and must not be faked here.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel');
const packet = require('../run/js/packet');

const SHELL = path.join(__dirname, '..', 'run', 'js', 'client', 'shell.js');

function fakeElement(tag) {
  let html = '';
  const el = {
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

// The real shell.js, with a fake document and an injected fetch — so what
// is under test is the shipped file and not a description of it.
function mountShell(answerFor) {
  const byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home']
    .forEach(function (id) { byId[id] = fakeElement('div'); });
  const doc = {
    body: fakeElement('body'),
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
  };

  const posts = [];
  const fakeFetch = function (url, init) {
    posts.push({ url: url, body: init && init.body ? JSON.parse(init.body) : null });
    const answer = answerFor(url, posts[posts.length - 1].body);
    return Promise.resolve({
      status: answer.status,
      text: function () { return Promise.resolve(answer.text); },
      json: function () { return Promise.resolve(JSON.parse(answer.text)); },
    });
  };

  const subscribers = [];
  const shellSpirit = {
    core: {
      const: { ICON: kernel.core.const.ICON, MIME: {} },
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

  const src = fs.readFileSync(SHELL, 'utf8');
  // `window` carries the isomorphic rule modules in a real page
  // (index.html loads them before shell.js). The layer decodes a reply
  // envelope through spiritPacket, so the fixture supplies the real one
  // rather than a stand-in — otherwise the decode half is asserted
  // against a mock of itself.
  const win = { spiritPacket: packet };
  new Function('spirit', 'document', 'fetch', 'window', src)(shellSpirit, doc, fakeFetch, win);

  const wired = subscribers.filter(function (h) { return typeof h.onPacket === 'function'; })[0];
  return {
    shell: shellSpirit.shell,
    posts: posts,
    // A packet arriving off the node's stream, the way the real one does.
    arrive: function (message) { if (wired) wired.onPacket(message); },
  };
}

// An app that hands its api back, so the contract can be driven exactly
// as an app would drive it.
function appWithApi(world, id) {
  let handed = null;
  world.shell.registerApp({
    id: id, name: id, icon: 'FILE',
    mount: function (el, api) { handed = api; },
    render: function () {},
  });
  world.shell.launchApp(id);
  return handed;
}

// What a relay actually sends back: its answer inside a packet
// envelope, the same shape any peer replies with (relay.answerSelf).
const REPLY_ENVELOPE = JSON.stringify({ app: 'relay', v: 1, body: { ok: true, revoked: 2 } });

const NODE_ANSWER = {
  status: 200,
  text: JSON.stringify({
    ok: true, status: 200,
    hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    from: 'PEERKEY', text: REPLY_ENVELOPE, sig: 'SIG', receipt: true,
  }),
};

test.startTest('The client layer — one post, one hash, and later news about it');

// ---------------------------------------------------------------------
function aPostAnswersInTheShapeTheProtocolHas() {
  test.subHeading('A post answers in the shape the protocol has');

  const world = mountShell(function () { return NODE_ANSWER; });
  const api = appWithApi(world, 'chess');

  return api.peerPost('chess', 'PEERKEY', { move: 'e4' }).then(function (r) {
    // The envelope is the node's job; this only checks the client asked
    // for the right thing: which app, which peer, what body.
    const sent = world.posts.filter(function (p) { return p.body.verb === 'peer.post'; })[0];
    if (sent && sent.body.to === 'PEERKEY' && sent.body.app === 'chess') {
      test.check('the post names the peer and the app, and nothing else is invented');
    } else {
      test.fail('post body: ' + JSON.stringify(sent && sent.body));
    }

    // RULE 2. The client did not compute this and did not send it — it
    // learned it from its own node, which computed it from the bytes it
    // signed. A page that tried to derive one would need a key.
    if (r.hash === JSON.parse(NODE_ANSWER.text).hash) {
      test.check('the hash comes back whole, from this node, untouched');
    } else {
      test.fail('hash: ' + JSON.stringify(r.hash));
    }

    // RULE 3. The reply is in the answer, because `peer.post` resolves
    // after the round trip settles. No table was consulted to get it.
    if (r.ok === true && r.from === 'PEERKEY') {
      test.check('and the reply with it — the round trip needs no correlation table');
    } else {
      test.fail('answer: ' + JSON.stringify(r));
    }

    // A BODY OUT, A BODY BACK. The caller handed this a body; the relay
    // answers in the same envelope shape any peer replies with, and the
    // layer decodes it. Otherwise every app parses the envelope itself
    // and they drift on what an empty one means.
    if (r.body && r.body.ok === true && r.body.revoked === 2) {
      test.check('the answer arrives as a BODY, decoded from the envelope it came in');
    } else {
      test.fail('body: ' + JSON.stringify(r.body));
    }

    // The bytes stay alongside, so a caller wanting them does not have to
    // re-encode what it was just handed.
    if (r.reply === REPLY_ENVELOPE) {
      test.check('with the raw envelope kept beside it');
    } else {
      test.fail('reply: ' + JSON.stringify(r.reply));
    }

    // Structured, not a string to parse. sendMessagePacket still hands
    // back { status, text }, and every caller of that had to JSON.parse
    // for itself — which is how each app would have grown its own half
    // of this layer.
    if (typeof r.reply === 'string' && typeof r.hash === 'string' && typeof r.ok === 'boolean') {
      test.check('as fields rather than a blob every app parses for itself');
    } else {
      test.fail('shape: ' + JSON.stringify(r));
    }
  });
}

// ---------------------------------------------------------------------
function aFailureInventsNoTransaction() {
  test.subHeading('A failure is a failure, and invents no transaction');

  const world = mountShell(function () {
    return { status: 503, text: JSON.stringify({ error: 'that peer is not reachable right now' }) };
  });
  const api = appWithApi(world, 'chess');

  return api.peerPost('chess', 'NOBODY', { move: 'e4' }).then(function (r) {
    // A caller must be able to tell "no transaction happened" from "a
    // transaction happened and failed". An invented hash would make the
    // log unjoinable and the distinction unaskable.
    if (r.ok === false && r.hash === '' && /not reachable/.test(r.error)) {
      test.check('an unreachable peer answers ok:false with no hash at all');
    } else {
      test.fail('failure shape: ' + JSON.stringify(r));
    }
  });
}

// ---------------------------------------------------------------------
function aDeliveredRefusalIsNotADelivery() {
  test.subHeading('Something answered NO is not the same as nothing answered');

  // FOUND LIVE ONCE, on the first real mint through the collapsed path:
  // a relay answered `unknown request`, the POST had succeeded — status
  // 200, receipt and all — and the node handed the browser a success
  // with an error inside it. The code reached past the far end's verdict
  // to the transport's number behind it.
  //
  // hub.askRelay learned that and was then deleted along with the doors
  // it served, so the lesson lives here now. It has to: this is where the
  // two failures meet.
  const world = mountShell(function () {
    return {
      status: 200,
      text: JSON.stringify({
        ok: true, status: 200, hash: 'HASH', from: 'PEERKEY', receipt: true,
        text: JSON.stringify({ app: 'relay', v: 1, body: { ok: false, error: 'unknown request' } }),
      }),
    };
  });
  const api = appWithApi(world, 'chess');

  return api.peerPost('relay', 'PEERKEY', { rename: { label: 'x' } }).then(function (r) {
    if (r.ok === false) {
      test.check('a post that arrived and was refused reads as a refusal, not a success');
    } else {
      test.fail('a delivered refusal read as ok: ' + JSON.stringify(r));
    }

    // The transport still succeeded, and saying so is what lets a caller
    // tell this apart from a relay that is down.
    if (r.status === 200 && r.hash === 'HASH' && r.body && r.body.error === 'unknown request') {
      test.check('while the transport still reports 200, with the reason it was refused');
    } else {
      test.fail('shape: ' + JSON.stringify(r));
    }
  });
}

// ---------------------------------------------------------------------
function aReplyWithNoVerdictIsNotARefusal() {
  test.subHeading('A packet with no verdict in it is not a refusal');

  // Most packets are not verbs. A chat line answering a chat line has no
  // `ok` to give, and reading its absence as failure would make every
  // ordinary exchange look broken.
  const world = mountShell(function () {
    return {
      status: 200,
      text: JSON.stringify({
        ok: true, status: 200, hash: 'HASH', from: 'PEERKEY', receipt: true,
        text: JSON.stringify({ app: 'chess', v: 1, body: { move: 'e5' } }),
      }),
    };
  });
  const api = appWithApi(world, 'chess');

  return api.peerPost('chess', 'PEERKEY', { move: 'e4' }).then(function (r) {
    if (r.ok === true && r.body && r.body.move === 'e5') {
      test.check('a body carrying no `ok` is delivered, not judged');
    } else {
      test.fail('ordinary reply read as a failure: ' + JSON.stringify(r));
    }
  });
}

// ---------------------------------------------------------------------
function laterNewsFindsWhoAsked() {
  test.subHeading('Later news about an earlier post finds who asked');

  const world = mountShell(function () { return NODE_ANSWER; });
  const api = appWithApi(world, 'chess');
  const H = JSON.parse(NODE_ANSWER.text).hash;

  const regarding = [];
  const appGot = [];
  api.onPacket('chess', function (body) { appGot.push(body); });
  const off = api.onRegarding(H, function (body) { regarding.push(body); });

  function arrive(id, body, re) {
    world.arrive(packet.decorate({
      id: id, from: 'PEERKEY', fromKey: 'PEERKEY',
      text: packet.encode('chess', body, re ? { re: re } : undefined).text,
    }));
  }

  // RULE 4. A peer answering again, later, about the same thing. `re` has
  // travelled end to end since the router landed; this is the first thing
  // in the tree to read it.
  arrive('in_1', { move: 'e5' }, H);
  if (regarding.length === 1 && regarding[0].move === 'e5') {
    test.check('a packet carrying `re` reaches whoever asked about that hash');
  } else {
    test.fail('regarding: ' + JSON.stringify(regarding));
  }

  // MINE BEFORE THE APP'S. Otherwise every app watching its own name
  // would filter each arrival for hashes it happens to be holding, which
  // is the table this layer exists so nobody writes twice.
  if (appGot.length === 0) {
    test.check('and not also to the app handler, which did not ask about it');
  } else {
    test.fail('the app handler also got it: ' + JSON.stringify(appGot));
  }

  arrive('in_2', { move: 'd4' });
  if (appGot.length === 1 && appGot[0].move === 'd4') {
    test.check('a packet regarding nothing goes to the app, as it always did');
  } else {
    test.fail('app handler: ' + JSON.stringify(appGot));
  }

  // One regarding something NOBODY asked about is not held and not
  // announced — it falls through to the app, and if no app wants it, it
  // is dropped. There is no store here, and inventing one quietly would
  // be inventing the part that has to be designed.
  arrive('in_3', { move: 'c4' }, 'a-hash-nobody-holds');
  if (appGot.length === 2 && appGot[1].move === 'c4') {
    test.check('and one regarding a hash nobody holds falls through rather than being kept');
  } else {
    test.fail('unclaimed re: ' + JSON.stringify(appGot));
  }

  // Releasing the interest is the app's to do; the table must not grow
  // for the life of the page.
  off();
  arrive('in_4', { move: 'f4' }, H);
  if (regarding.length === 1 && appGot.length === 3) {
    test.check('off() releases it, and the packet falls back to the app');
  } else {
    test.fail('after off(): regarding=' + regarding.length + ' app=' + appGot.length);
  }

  return Promise.resolve();
}

Promise.resolve()
  .then(aPostAnswersInTheShapeTheProtocolHas)
  .then(aFailureInventsNoTransaction)
  .then(aDeliveredRefusalIsNotADelivery)
  .then(aReplyWithNoVerdictIsNotARefusal)
  .then(laterNewsFindsWhoAsked)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('clientLayer threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
