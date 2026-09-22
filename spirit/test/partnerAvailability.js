'use strict';

// spirit/test/partnerAvailability.js
// A PARTNER'S AVAILABILITY, TOLD TO EVERY MEMBER WHEN IT CHANGES (R42).
//
//   Andy: "why put the answer in search when it could be broadcast?" —
//   "the partnership lies dormant without remedy ?" — "the broadcast says
//   "unavailable" (right now) it doesn't say "dead" ?" — "understood.
//   mechanism accepted, as just discussed." (2026-09-22, gap cycle)
//
// The relay half, in process with an injected clock:
//   - a partner benched by gap R13's rule is announced unavailable, once
//   - a request FROM that partner revives it and is announced, once
//   - a stranger cannot revive anything
// The node half, partnerAvailability.js:
//   - "unavailable as of", stale after fifteen minutes
//   - hints reordered, never shortened
//   - an older word never overwrites a newer one

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');
const partnerAvailability = require('../run/js/partnerAvailability');

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

function said(bag, key) {
  return bag.filter(function (m) { return m.event === 'partner' && m.data && m.data.relayKey === key; })
    .map(function (m) { return m.data; });
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

test.startTest('A partner\'s availability, broadcast when it changes');

async function relayHalf() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-availability-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);

  let now = Date.parse('2026-09-22T12:00:00Z');
  const partner = auth.generateIdentity('relay-partner');
  const store = relayStore.open(home);
  store.partners.put({ relayKey: partner.publicKey, url: 'http://partner.example', ownerKey: 'o', status: 'partnered', since: 'x', last: new Date(now - 20 * MIN).toISOString() });

  let partnerUp = false;
  const box = createRelay(home, {
    now: function () { return now; },
    askPartner: function () {
      if (!partnerUp) return Promise.resolve({ ok: false, status: 0, error: 'connect ECONNREFUSED' });
      return Promise.resolve({ ok: true, status: 200, text: JSON.stringify({ v: 1, body: { ok: true, matches: [] } }) });
    },
  });
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  const heard = [];
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard));

  async function search() {
    const before = heard.filter(function (m) { return m.event === 'reply'; }).length;
    post(box, owner, box.relayPublicKey(), { search: { q: 'x' } });
    await until(function () { return heard.filter(function (m) { return m.event === 'reply'; }).length > before; }, 3000);
  }

  test.subHeading('Benched, and said so — once');

  await search();
  let words = said(heard, partner.publicKey);
  if (words.length === 1 && words[0].live === false && words[0].at === new Date(now).toISOString()) {
    test.check('its one try failed after twenty quiet minutes: every member is told "unavailable", with when');
  } else {
    test.fail('after the failed try: ' + JSON.stringify(words));
  }

  now += 16 * MIN;   // past the bench, so it is tried again — and fails again
  await search();
  words = said(heard, partner.publicKey);
  if (words.length === 1) {
    test.check('failing again is not news: nothing more is broadcast');
  } else {
    test.fail('repeated: ' + JSON.stringify(words));
  }

  test.subHeading('A request from the partner revives it');

  const stranger = auth.generateIdentity('relay-stranger');
  const refused = post(box, stranger, box.relayPublicKey(), { search: { q: 'x' } });
  if (refused && refused.ok === false && said(heard, partner.publicKey).length === 1) {
    test.check('a stranger\'s post is refused and revives nothing');
  } else {
    test.fail('stranger: ' + JSON.stringify(refused));
  }

  now += 1 * MIN;
  const asked = post(box, partner, box.relayPublicKey(), { search: { q: 'x' } });
  if (asked && asked.held) await asked.held;
  words = said(heard, partner.publicKey);
  const row = store.partners.get(partner.publicKey);
  if (words.length === 2 && words[1].live === true && row && row.last === new Date(now).toISOString()) {
    test.check('the partner asks something: it is stamped as answered, and every member is told it is back');
  } else {
    test.fail('after the partner spoke: ' + JSON.stringify(words) + ' / ' + JSON.stringify(row));
  }

  partnerUp = true;
  await search();
  if (said(heard, partner.publicKey).length === 2) {
    test.check('and answering after that is not news either');
  } else {
    test.fail('answering repeated the news: ' + JSON.stringify(said(heard, partner.publicKey)));
  }

  relayStore.closeAll();
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* windows */ }
}

function nodeHalf() {
  test.subHeading('On the node: "unavailable as of", never "dead"');

  let now = Date.parse('2026-09-22T12:00:00Z');
  const av = partnerAvailability.createAvailability({ now: function () { return now; } });
  const url = 'https://r.example';
  av.note(url, { relayKey: 'P', live: false, at: new Date(now).toISOString() });

  if (av.unavailable(url, 'P') && !av.unavailable('https://other.example', 'P')) {
    test.check('a relay\'s word is about its own partners — another relay\'s P is untouched');
  } else {
    test.fail('unavailable read wrong');
  }
  const ordered = av.order(url, ['P', 'Q', 'R']);
  if (JSON.stringify(ordered) === JSON.stringify(['Q', 'R', 'P'])) {
    test.check('hints are reordered, never shortened: [P, Q, R] → [Q, R, P]');
  } else {
    test.fail('order: ' + JSON.stringify(ordered));
  }

  av.note(url, { relayKey: 'P', live: true, at: new Date(now - MIN).toISOString() });
  if (av.unavailable(url, 'P')) {
    test.check('an older word that crossed on the wire does not overwrite a newer one');
  } else {
    test.fail('an older "live" overwrote a newer "unavailable"');
  }

  now += partnerAvailability.QUIET_MS;
  if (!av.unavailable(url, 'P') && JSON.stringify(av.order(url, ['P', 'Q'])) === '["P","Q"]') {
    test.check('fifteen minutes later the word is stale: P is tried first again, and that send is the relay\'s next try');
  } else {
    test.fail('the word did not go stale');
  }

  av.note(url, { relayKey: 'Q', live: false, at: new Date(now).toISOString() });
  av.note(url, { relayKey: 'Q', live: true, at: new Date(now + 1).toISOString() });
  if (!av.unavailable(url, 'Q')) {
    test.check('"back" clears it at once');
  } else {
    test.fail('back did not clear it');
  }
}

relayHalf()
  .then(nodeHalf)
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
