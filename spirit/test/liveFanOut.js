'use strict';

// spirit/test/liveFanOut.js
// A MEMBER'S SEARCH GOES TO LIVE PARTNERS ONLY.
//
//   Andy: "… or the concept that peer acquisition for nodes requires
//   liveness of the partners; this would accelerate search
//   significantly." — "Search vs. census is already a loss in
//   completeness." (cycle 3, NODE-AND-RELAY §10)
//
// Until this, a search was propagated to every `partnered` row and the
// answer waited on all of them — so one partner that was down held every
// search for the full timeout. Live means the partner holds its stream on
// this relay now, which is the same test hint routing already uses.
//
// Nothing runs: `askPartner` is the injected hook relayServer.js supplies,
// replaced here by one that records who was asked and answers at once.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

function post(box, from, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)));
}

function lastReply(bag) {
  const replies = bag.filter(function (m) { return m.event === 'reply'; });
  if (!replies.length) return null;
  try { return JSON.parse(replies[replies.length - 1].data.text).body || null; }
  catch (e) { return null; }
}

function until(pred, ms) {
  const end = Date.now() + ms;
  return new Promise(function (resolve) {
    (function poll() {
      if (pred() || Date.now() > end) { resolve(pred()); return; }
      setTimeout(poll, 5);
    })();
  });
}

test.startTest('A search goes to live partners only');

async function run() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-livefan-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  // Two partner relays on A's partner roll, both `partnered`. Planted on
  // the roll directly: how a partnership is minted is cycle 5's, and this
  // suite is about which rows a search asks.
  const live = auth.generateIdentity('relay-live');
  const down = auth.generateIdentity('relay-down');
  const store = relayStore.open(home);
  store.partners.put({ relayKey: live.publicKey, url: 'http://live.example', ownerKey: 'o1', status: 'partnered', since: 'x' });
  store.partners.put({ relayKey: down.publicKey, url: 'http://down.example', ownerKey: 'o2', status: 'partnered', since: 'x' });

  const asked = [];
  const box = createRelay(home, {
    askPartner: function (url) {
      asked.push(url);
      return Promise.resolve({
        text: JSON.stringify({ v: 1, body: { ok: true, matches: [], more: false } }),
      });
    },
  });
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const bag = [];
  box.streamOpen(owner.publicKey,
    auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(bag));

  // Live: the partner holds its stream here, as a relay does after it
  // dials its partners at boot.
  const liveSink = sinkFor([]);
  const opened = box.streamOpen(live.publicKey,
    auth.sign(live.privateKey, auth.streamMessage(live.publicKey)), liveSink);
  if (opened && opened.ok !== false) {
    test.check('one partner holds its stream here; the other does not');
  } else {
    test.fail('the live partner could not open its stream: ' + JSON.stringify(opened));
  }

  post(box, owner, box.relayPublicKey(), { search: { q: 'any' } });
  await until(function () { return !!lastReply(bag); }, 3000);

  if (asked.length === 1 && asked[0] === 'http://live.example') {
    test.check('the search asked the live partner and not the one that is down');
  } else {
    test.fail('asked: ' + JSON.stringify(asked));
  }
  const answer = lastReply(bag);
  if (answer && answer.ok) {
    test.check('and the member got its answer without waiting on the absent one');
  } else {
    test.fail('answer: ' + JSON.stringify(answer));
  }

  // None live: this relay's own answer, at once, and nobody asked.
  //
  // THE CLOSE HAS TO COUNT FIRST. streamClose resolved members and the
  // owner only, so a partner whose socket died stayed present for good —
  // live-only would have gone on asking it, and hint routing still
  // treated it as live. Found by this suite.
  asked.length = 0;
  box.streamClose(live.publicKey, liveSink);
  if (!box.presence.isPresent(live.publicKey)) {
    test.check('a partner whose stream closes is no longer live');
  } else {
    test.fail('the partner stayed present after its stream closed');
  }
  const before = bag.filter(function (m) { return m.event === 'reply'; }).length;
  post(box, owner, box.relayPublicKey(), { search: { q: 'any' } });
  await until(function () {
    return bag.filter(function (m) { return m.event === 'reply'; }).length > before;
  }, 3000);
  if (asked.length === 0 && lastReply(bag) && lastReply(bag).ok) {
    test.check('with no partner live, the relay answers from its own members and asks nobody');
  } else {
    test.fail('asked with none live: ' + JSON.stringify(asked));
  }

  relayStore.closeAll();
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* windows */ }
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
