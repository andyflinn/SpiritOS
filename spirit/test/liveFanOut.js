'use strict';

// spirit/test/liveFanOut.js
// A MEMBER'S SEARCH GOES TO LIVE PARTNERS ONLY — AND LIVE IS THE LAST ANSWER.
//
//   Andy: "… or the concept that peer acquisition for nodes requires
//   liveness of the partners; this would accelerate search
//   significantly." — "Search vs. roll is already a loss in
//   completeness." (cycle 3, NODE-AND-RELAY §10)
//
// Until cycle 3 a search was propagated to every `partnered` row and the
// answer waited on all of them — so one partner that was down held every
// search for the full timeout. Live meant "holds its stream on this relay
// now".
//
// R13 (cycle 8) took the partner streams away. Grok's review, agreed by
// Andy: liveness is the last answer — "N = 15 minutes. Quiet is normal.
// After 15 min still try one post before you skip that partner." So:
//
//   answered within 15 minutes                  → asked
//   quieter than that, no failed try since      → asked, once
//   quieter than that, and that one try failed  → skipped, for 15 minutes
//
// Nothing runs: `askPartner` is the injected hook relayServer.js supplies,
// replaced here by one that records who was asked, and the relay's clock
// is injected so fifteen minutes pass without being waited.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

const MIN = 60 * 1000;

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

function replies(bag) {
  return bag.filter(function (m) { return m.event === 'reply'; });
}

function lastReply(bag) {
  const r = replies(bag);
  if (!r.length) return null;
  try { return JSON.parse(r[r.length - 1].data.text).body || null; }
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

test.startTest('A search goes to live partners only, and live is the last answer');

async function run() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-livefan-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  let now = Date.parse('2026-09-22T12:00:00Z');
  const iso = function (t) { return new Date(t).toISOString(); };

  // Two partner relays on the roll, both `partnered`. Planted directly: how
  // a partnership is minted is not this suite's business. `talky` answered
  // a minute ago; `quiet` last answered twenty minutes ago and is, in
  // fact, down.
  const talky = auth.generateIdentity('relay-talky');
  const quiet = auth.generateIdentity('relay-quiet');
  const store = relayStore.open(home);
  store.partners.put({ relayKey: talky.publicKey, url: 'http://talky.example', ownerKey: 'o1', status: 'partnered', since: 'x', last: iso(now - 1 * MIN) });
  store.partners.put({ relayKey: quiet.publicKey, url: 'http://quiet.example', ownerKey: 'o2', status: 'partnered', since: 'x', last: iso(now - 20 * MIN) });

  let quietIsUp = false;
  let flakyDown = false;
  const asked = [];
  const box = createRelay(home, {
    now: function () { return now; },
    askPartner: function (url) {
      asked.push(url);
      if ((url === 'http://quiet.example' && !quietIsUp) || (url === 'http://flaky.example' && flakyDown)) {
        // What peerPost settles with when nobody answered: our own wait ran out.
        return Promise.resolve({ ok: false, status: 504, error: 'no answer yet', stillOpen: true });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: JSON.stringify({ v: 1, body: { ok: true, matches: [], more: false } }),
      });
    },
  });
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  const bag = [];
  box.streamOpen(owner.publicKey,
    auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(bag));

  async function search() {
    asked.length = 0;
    const before = replies(bag).length;
    post(box, owner, box.relayPublicKey(), { search: { q: 'any' } });
    await until(function () { return replies(bag).length > before; }, 3000);
    return asked.slice().sort();
  }

  test.subHeading('No partner holds a stream any more');

  const tried = box.streamOpen(talky.publicKey,
    auth.sign(talky.privateKey, auth.streamMessage(talky.publicKey)), sinkFor([]));
  if (tried && tried.ok === false && tried.status === 403 && /partner holds no stream/.test(tried.error)) {
    test.check('a partner relay that dials is refused by name — "a partner holds no stream here"');
  } else {
    test.fail('a partner stream was admitted: ' + JSON.stringify(tried));
  }

  test.subHeading('Quiet is normal: the quiet partner still gets its one try');

  let got = await search();
  if (got.length === 2) {
    test.check('the first search asks both: the one that answered a minute ago, and the one quiet for twenty');
  } else {
    test.fail('first search asked: ' + JSON.stringify(got));
  }
  if (lastReply(bag) && lastReply(bag).ok) {
    test.check('and the member is answered although the quiet one said nothing');
  } else {
    test.fail('answer: ' + JSON.stringify(lastReply(bag)));
  }

  test.subHeading('Its try failed, so it is skipped — for fifteen minutes, not for ever');

  got = await search();
  if (got.length === 1 && got[0] === 'http://talky.example') {
    test.check('the next search skips the partner whose one try failed');
  } else {
    test.fail('second search asked: ' + JSON.stringify(got));
  }

  now += 14 * MIN;
  got = await search();
  if (got.length === 1 && got[0] === 'http://talky.example') {
    test.check('still skipped fourteen minutes later');
  } else {
    test.fail('at +14 min asked: ' + JSON.stringify(got));
  }

  now += 2 * MIN;
  quietIsUp = true;
  got = await search();
  if (got.length === 2) {
    test.check('at sixteen minutes it gets another try — and this time it answers');
  } else {
    test.fail('at +16 min asked: ' + JSON.stringify(got));
  }
  const row = store.partners.get(quiet.publicKey);
  if (row && row.last === iso(now)) {
    test.check('its answer is stamped as its last, by the relay\'s own clock (R12\'s column)');
  } else {
    test.fail('quiet row after answering: ' + JSON.stringify(row));
  }

  test.subHeading('Answering keeps a partner live; only silence ages it');

  now += 10 * MIN;
  got = await search();
  if (got.length === 2) {
    test.check('ten minutes after both answered, both are asked');
  } else {
    test.fail('at +10 after answers, asked: ' + JSON.stringify(got));
  }

  test.subHeading('A failure while still live does not spend the post-quiet try');

  // Found by Grok's review of the gap cycle (2026-09-22): a miss was
  // recorded even while the partner's last answer was fresh, and when that
  // answer aged out the old miss benched it — no try after the quiet
  // window, and no "unavailable" said.
  const flaky = auth.generateIdentity('relay-flaky');
  store.partners.put({ relayKey: flaky.publicKey, url: 'http://flaky.example', ownerKey: 'o3', status: 'partnered', since: 'x', last: iso(now - 10 * MIN) });
  flakyDown = true;
  got = await search();
  if (got.indexOf('http://flaky.example') !== -1) {
    test.check('answered ten minutes ago, it is asked — and this time it fails');
  } else {
    test.fail('flaky not asked while live: ' + JSON.stringify(got));
  }
  now += 6 * MIN;
  got = await search();
  if (got.indexOf('http://flaky.example') !== -1) {
    test.check('six minutes on, its last answer is sixteen minutes old: it still gets its one try — the earlier failure did not bench it');
  } else {
    test.fail('a failure while live benched it without its post-quiet try: ' + JSON.stringify(got));
  }

  relayStore.closeAll();
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* windows */ }
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
