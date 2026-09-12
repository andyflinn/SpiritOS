'use strict';

// spirit/test/liveRelay.js
// The suite that talks to a real relay over the real internet.
//
//   node spirit/test/liveRelay.js                    against spirit-3
//   node spirit/test/liveRelay.js http://127.0.0.1:65425   against the lab
//
// NOT PART OF THE HARNESS, and named in runAll's NOT_A_SUITE for it.
// Everything else runs in process in milliseconds and can run a thousand
// times; this opens sockets to another continent and changes state on a
// box other people use. It is run by hand, on purpose.
//
// It exists because of design/cleanup/2026-09-11-live-surface-tests.md:
// "the harness proves logic in process and has never seen TLS, Caddy or
// a held connection." Every check below is one the fast suites cannot
// make — a held stream through a proxy, a round trip with real latency,
// a build stamp, a migration that already happened on somebody's disk.
//
// WHAT IT WILL NOT DO: touch Andy's own device slot. The subject is a
// lab peer, because enrolling displaces whatever device that identity
// had, and doing that to the phone in somebody's pocket to prove a
// point is not a trade worth making. His identity is READ, to sign, and
// never written — the same rule labPopulate carries.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');

const RUN = path.join(__dirname, '..', 'run');
const FAKES = path.join(
  process.env.TEMP || process.env.TMPDIR || '/tmp', 'spiritos-relay-fakes'
);
const SUBJECT = path.join(FAKES, 'lw-lab-bella', 'spirit', 'run');
const LAB = 'http://127.0.0.1:65425';

const RELAY = process.argv[2] || 'https://spirit.andyflinn.com';

function get(url, headers) {
  return fetch(url, { headers: headers || {} })
    .then(function (r) {
      return r.text().then(function (t) { return { status: r.status, text: t }; });
    })
    .catch(function (e) { return { status: 0, text: String(e.message || e) }; });
}

function post(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  }).catch(function (e) { return { status: 0, text: String(e.message || e) }; });
}

function parsed(answer) {
  try { return JSON.parse(answer.text); } catch (e) { return null; }
}

function deviceDoc() {
  return JSON.parse(fs.readFileSync(path.join(SUBJECT, 'relay-state', 'device.json'), 'utf8'));
}

test.startTest('The live relay — ' + RELAY);

async function run() {
  test.subHeading('It is there, and it is the code we think it is');

  const version = parsed(await get(RELAY + '/api/version'));
  if (version && version.commit) {
    test.check('it answers /api/version, running ' + version.commit +
      (version.dirty ? ' (DIRTY)' : '') + ', relay=' + !!version.relay);
  } else {
    test.fail('no version: ' + RELAY);
    test.reportSuccessFailureCount();
    return;
  }

  // A relay running uncommitted code is a relay nobody can reason about
  // — the stamp exists so "which code is this" has an answer.
  //
  // ASKED OF A REMOTE BOX ONLY. A lab relay is built out of the working
  // tree by labMaster and is legitimately dirty whenever anything is
  // being worked on, which is always. Failing on it would train somebody
  // to ignore a red line that matters on spirit-3.
  const remote = /^https:/i.test(RELAY);
  if (!remote) {
    test.check('(a lab relay is built from the working tree, so its stamp is not asked to be clean)');
  } else if (version.dirty === false && version.untracked === 0) {
    test.check('and it is running committed code with nothing untracked');
  } else {
    test.fail('dirty=' + version.dirty + ' untracked=' + version.untracked);
  }

  if (version.relay === true) {
    test.check('and it says it is a relay, which decides half its behaviour');
  } else {
    test.fail('relay flag: ' + version.relay);
  }

  test.subHeading('The roster survived the rename');

  const census = parsed(await get(RELAY + '/api/relay/who'));
  const peers = (census && census.peers) || [];
  if (peers.length) {
    test.check(peers.length + ' peer(s) still listed: ' +
      peers.map(function (p) { return p.publicLabel || p.name; }).sort().join(', '));
  } else {
    test.fail('empty roster — the routing table did not survive');
  }

  // mailbox.json became routingTable.json. A relay that could not read
  // the old name would have come up with nobody on it, and this is the
  // only place that can prove it read one written by older code.
  const owner = peers.filter(function (p) { return p.owner; })[0];
  if (owner) {
    test.check('and it still knows its owner (' + (owner.publicLabel || owner.name) + ')');
  } else {
    test.fail('no owner in the census');
  }

  // THE RELAY'S OWN KEY, which is not its owner's. Everything below
  // needs it, and a node needs it to tell this relay apart from a peer.
  if (census.mailboxPublicKey && census.mailboxPublicKey !== (owner && owner.publicKey)) {
    test.check("and publishes a key of its own, which is not its owner's");
  } else {
    test.fail('mailboxPublicKey: ' + String(census.mailboxPublicKey).slice(-12));
  }

  test.subHeading('A held stream, through whatever is in front of it');

  const subject = fs.existsSync(path.join(SUBJECT, 'relay-state', 'identity.json'))
    ? auth.loadIdentity(SUBJECT) : null;
  if (!subject) {
    test.fail('no lab subject at ' + SUBJECT + ' — run labPopulate first');
    test.reportSuccessFailureCount();
    return;
  }

  // A relay this subject has no row on can answer nothing below.
  const onIt = peers.some(function (p) { return p.publicKey === subject.publicKey; });
  if (onIt) {
    test.check(subject.name + ' has a row here, so this relay can speak to them');
  } else {
    test.fail(subject.name + ' is not on this relay');
    test.reportSuccessFailureCount();
    return;
  }

  test.subHeading('An enrolment, end to end, at real latency');

  const before = deviceDoc().devicePublicKey || '';
  const impostorKey = auth.generateIdentity('impostor-device').publicKey;

  // THE NEGATIVE FIRST, because a positive that passes while this also
  // passes proves nothing. A peer posting the identical offer, with a
  // password that is genuinely the subject's — everything right except
  // being the relay.
  const me = auth.loadIdentity(RUN);
  if (me && me.privateKey) {
    const tried = parsed(await post('http://127.0.0.1:65432/api/hub/post', {
      to: subject.publicKey,
      via: RELAY,
      text: JSON.stringify({
        relay: 'device-offer',
        password: deviceDoc().password,
        devicePublicKey: impostorKey,
      }),
    }));
    const composed = tried && typeof tried.text === 'string' && tried.text.length > 0;
    if (!composed && deviceDoc().devicePublicKey === before) {
      test.check('a PEER posting that offer gets a bare receipt, and changes nothing');
    } else {
      test.fail('a peer was answered: ' + JSON.stringify(tried && tried.text));
    }
  } else {
    test.fail('no local identity to post an impostor request with');
  }

  // And now the real one, the way the device page does it.
  const phone = auth.generateIdentity('live-suite-browser');
  const started = Date.now();
  const said = await post(RELAY + '/api/relay/device', {
    name: subject.publicKey,
    password: deviceDoc().password,
    devicePublicKey: phone.publicKey,
  });
  const took = Date.now() - started;
  const answer = parsed(said);

  if (said.status === 200 && answer && answer.ok) {
    test.check('the browser POST is answered in ' + took + 'ms, against 0-60s of polling');
  } else {
    test.fail('enrolment: ' + said.status + ' ' + said.text.slice(0, 120));
  }

  // THE NAME. It said the relay's OWNER for every page on the box —
  // "signed in as andy", for bella. The page has to sign as somebody and
  // it has to be the right somebody.
  if (answer && answer.name === subject.name) {
    test.check('and it names ' + subject.name + ', whose device it is');
  } else {
    test.fail('named "' + (answer && answer.name) + '", expected "' + subject.name + '"');
  }

  if (deviceDoc().devicePublicKey === phone.publicKey) {
    test.check('and the node wrote the new key down, displacing the old');
  } else {
    test.fail('node holds: ' + String(deviceDoc().devicePublicKey).slice(-12));
  }

  test.subHeading('One device, every relay that identity is on');

  async function canRead(where) {
    const r = await get(
      where + '/api/relay/inbox?name=' + encodeURIComponent(subject.name),
      { 'X-Spirit-Sig': auth.sign(phone.privateKey, auth.inboxMessage(subject.name)) }
    );
    return r.status === 200;
  }

  if (await canRead(RELAY)) {
    test.check('the enrolled browser can read here, where it enrolled');
  } else {
    test.fail('it cannot read on the relay that enrolled it');
  }

  // THE FAN-OUT. A device belongs to the identity, not to the relay that
  // happened to enrol it — so it must work on the other one too.
  const elsewhere = RELAY === LAB ? null : LAB;
  if (elsewhere) {
    const reachable = (await get(elsewhere + '/api/relay/who')).status === 200;
    if (!reachable) {
      test.check('(the other relay is not up, so the fan-out is not checked)');
    } else if (await canRead(elsewhere)) {
      test.check('and on ' + elsewhere + ', which it never spoke to');
    } else {
      test.fail('the device did not reach ' + elsewhere);
    }
  }

  // A KEY THAT ENROLLED NOWHERE READS NOTHING, or the check above passes
  // by the relay being lax rather than by the device being installed.
  const nobody = auth.generateIdentity('never-enrolled');
  const refused = await get(
    RELAY + '/api/relay/inbox?name=' + encodeURIComponent(subject.name),
    { 'X-Spirit-Sig': auth.sign(nobody.privateKey, auth.inboxMessage(subject.name)) }
  );
  if (refused.status !== 200) {
    test.check('while a browser that enrolled nowhere is refused (' + refused.status + ')');
  } else {
    test.fail('an unenrolled key read the inbox');
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
