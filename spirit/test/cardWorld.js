'use strict';

// spirit/test/cardWorld.js
// TWO NODES AND A RELAY, WITH AN EMPTY CONTACT BOOK — the card fixture.
//
// EXTRACTED, NOT COPIED, on the day a second suite needed it. cardFetch.js
// built it and said so: "Extract when a SECOND suite needs the empty-book
// shape, not before." cardRotation.js is that suite.
//
// NOT A SUITE. It asserts nothing; it builds the world and hands it over.
// What makes it worth sharing is what it does NOT do: it plants no seal
// key. keepCard and sealKeyFor are wired to the REAL contacts book, as
// server.js wires them, so any key a node holds here was fetched, and
// verified by contacts.setCard on the way in.

const os = require('os');
const fs = require('fs');
const path = require('path');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const trafficLog = require('../run/js/trafficLog');
const routerTable = require('../run/js/router');
const nodeCard = require('../run/js/nodeCard');
const contacts = require('../run/js/contacts');

// ── WHAT COUNTS AS "SENT" IS WHAT REACHED THE TRANSPORT ─────────────
//
// An earlier draft of this suite counted asks and hunted plaintext in the
// node's own traffic log, and C7 went red on a payload that HAD NEVER
// BEEN SENT: a post refused for a missing key is still recorded locally,
// in clear, with `outcome: 'refused', code: 'no-cipher-key'` — the log
// keeps payloads deliberately (trafficLog.js:14-17) and it is a record of
// what this node did, not of what left it. Measured rather than assumed:
// with the key absent the transport was called ZERO times.
//
// So the relay records `wire` — every body handed to it — and that is the
// only surface these assertions read. A local log cannot make a suite
// claim something crossed a network.
function fakeRelay(opts) {
  const routes = routerTable.createRouter({});
  const streams = Object.create(null);
  const wire = [];
  // How many card asks to turn away as BUSY first, the way the real relay
  // does when the target already has a request in flight (0016's one per
  // target): 503 with busy and retryAfterMs, which says "wait", not "no".
  let busyAsks = (opts && opts.busyAsks) || 0;
  return {
    wire: wire,
    listen: function (key, onEvent) { streams[key] = onEvent; },
    request: function (url, method, pathname, body) {
      wire.push({ pathname: pathname, from: (body && body.from) || '', to: (body && body.to) || '',
        text: String((body && body.text) || '') });
      if (/\/api\/relay\/post$/.test(pathname) && busyAsks > 0 && nodeCard.asks(String(body.text || ''))) {
        busyAsks -= 1;
        return Promise.resolve({ status: 503,
          text: JSON.stringify({ error: 'target is busy', busy: true, retryAfterMs: 50 }) });
      }
      if (/\/api\/relay\/post$/.test(pathname)) {
        const verified = auth.postSignatureFor(body.from, body.from, body.to, body.text, body.sig);
        if (!verified) return Promise.resolve({ status: 403, text: '{"error":"bad sig"}' });
        if (!streams[body.to]) return Promise.resolve({ status: 503, text: '{"error":"peer not reachable"}' });
        const hash = auth.requestHash(verified);
        const opened = routes.open(hash, body.from, body.to, function () {
          streams[body.to]('request', { from: body.from, to: body.to, text: body.text, sig: body.sig });
          return true;
        });
        if (!opened.ok) return Promise.resolve({ status: opened.status, text: JSON.stringify(opened) });
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

// THE KEEPER AND THE LOOKUP ARE server.js's, NOT AN IMITATION OF THEM.
// A fixture that invented its own would prove the ask happened and
// nothing about whether the answer is usable afterwards.
function nodeFor(name, relay) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cardfetch-'));
  const id = auth.generateIdentity(name);
  auth.saveIdentity(home, id);
  nodeCard.setName(home, name);
  nodeCard.setDescription(home, name + ' publishes a card worth asking for');

  const traffic = trafficLog.createTrafficLog({ rootDir: home });
  const P = peerPost.createPeerPost({
    rootDir: home, request: relay.request, waitMs: 800, traffic: traffic,
    sealKeyFor: function (toKey) {                       // server.js:1281-6
      const row = contacts.byPublicKey(home, toKey);
      return (row && contacts.sealKeyOf(row)) || '';
    },
    keepCard: function (toKey, cardText) {               // server.js:1262-5
      if (!contacts.byPublicKey(home, toKey)) {
        contacts.upsert(home, { publicKey: toKey, acquiredVia: contacts.ROLL });
      }
      return contacts.setCard(home, toKey, cardText, 'reply');
    },
  });
  relay.listen(id.publicKey, function (event, body) {
    if (event === 'request') P.onRequest('http://relay', body);
    else if (event === 'reply') P.onReply(body);
  });
  return {
    name: name, home: home, id: id, P: P, traffic: traffic,
    sealKeyHeldFor: function (toKey) {
      const row = contacts.byPublicKey(home, toKey);
      return (row && contacts.sealKeyOf(row)) || '';
    },
    // Everything THIS node put on the transport, and the subset of it
    // that is a card ask.
    wireFrom: function () {
      return relay.wire.filter(function (w) { return w.from === id.publicKey; });
    },
    asksSent: function () {
      return relay.wire.filter(function (w) {
        return w.from === id.publicKey && nodeCard.asks(w.text);
      });
    },
  };
}

// Plant a card the honest way — through the same keeper the code uses —
// for the CONTROL nodes only, and never for the node under test.
function plantCardOf(holder, subject) {
  if (!contacts.byPublicKey(holder.home, subject.id.publicKey)) {
    contacts.upsert(holder.home, { publicKey: subject.id.publicKey, acquiredVia: contacts.ROLL });
  }
  return contacts.setCard(holder.home, subject.id.publicKey,
    nodeCard.cardFrom(Object.assign({ name: subject.name }, subject.id)), 'reply');
}

module.exports = { fakeRelay: fakeRelay, nodeFor: nodeFor, plantCardOf: plantCardOf };
