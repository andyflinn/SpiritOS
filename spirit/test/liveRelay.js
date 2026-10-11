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
// The device enrolment sections went with the device enrolment, removed
// by goal/G16.2.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');

const FAKES = path.join(
  process.env.TEMP || process.env.TMPDIR || '/tmp', 'spiritos-relay-fakes'
);
const SUBJECT = path.join(FAKES, 'lw-lab-bella', 'spirit', 'run');

const RELAY = process.argv[2] || 'https://spirit.andyflinn.com';

function get(url, headers) {
  return fetch(url, { headers: headers || {} })
    .then(function (r) {
      return r.text().then(function (t) { return { status: r.status, text: t }; });
    })
    .catch(function (e) { return { status: 0, text: String(e.message || e) }; });
}

function parsed(answer) {
  try { return JSON.parse(answer.text); } catch (e) { return null; }
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

  // ── THE ROSTER IS NOT SOMETHING TO ASK FOR (2026-09-18) ──────────
  //
  // This listed every peer off `GET /api/relay/who` to show the routing
  // table had survived a rename. The route is gone — a cheat named in
  // 0010 and eradicated — and 0012 rules out any door that answers "who
  // is on this box", to anyone, owner included.
  //
  // What survives is the weaker but askable claim: the box is up and is
  // still the same box, which is what a rename must not change. Whether
  // the table survived is visible to its OWNER, on the owner's own
  // stream, and not over a route.
  const itself = parsed(await get(RELAY + '/api/relay/key'));
  if (itself && itself.relayPublicKey) {
    test.check('the relay answers as itself after the rename: ' +
      (itself.relayLabel || '(unlabelled)') + ', owner ' + (itself.ownerLabel || '(none)'));
  } else {
    test.fail('no answer from the key door — the relay did not come back'); 
  }

  // mailbox.json became routingTable.json. A relay that could not read
  // the old name would have come up with nobody on it, and this is the
  // only place that can prove it read one written by older code.
  const owner = peers.filter(function (p) { return p.owner; })[0];
  if (owner) {
    test.check('and it still knows its owner (' + (owner.publicLabel || owner.name) + ')');
  } else {
    test.fail('no owner in the roll');
  }

  // THE RELAY'S OWN KEY, which is not its owner's. Everything below
  // needs it, and a node needs it to tell this relay apart from a peer.
  if (roll.relayPublicKey && roll.relayPublicKey !== (owner && owner.publicKey)) {
    test.check("and publishes a key of its own, which is not its owner's");
  } else {
    test.fail('relayPublicKey: ' + String(roll.relayPublicKey).slice(-12));
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

  // THE DEVICE ENROLMENT SECTIONS STOOD HERE ("An enrolment, end to end",
  // "A device opens nothing on a relay"), removed by goal/G16.2. What a
  // real relay still owes is that the identity's own key opens its stream.
  async function canOpen(where, id) {
    // The header names the relay it is for (goal/G16.12), so ask that relay
    // for its key first.
    const door = parsed(await get(where + '/api/relay/key'));
    const whereKey = (door && door.relayPublicKey) || '';
    const r = await get(
      where + '/api/relay/stream?key=' + encodeURIComponent(subject.publicKey),
      { 'X-Spirit-Sig': auth.sign(id.privateKey, auth.streamMessage(subject.publicKey, whereKey)) }
    );
    return r.status === 200;
  }

  if (await canOpen(RELAY, subject)) {
    test.check('the identity’s own key opens its stream on the real relay');
  } else {
    test.fail('the house key could not open the wire');
  }

  // ── Node-side pinning, against a real relay ──────────────────────
  //
  // Each of these is node-side, but the thing each one reasons about is
  // a REAL relay's real key, and a fake that agrees with itself is how
  // the two-conventions bug shipped.

  test.subHeading('The relay it accepted, and one that answers differently');

  {
    const relayKeys = require('../run/js/relayKeys');
    const answerRelay = require('../run/js/answerRelay');
    const hub = require('../run/js/hub');

    // A FRESH HOME, so this is genuinely first contact. Not the subject's:
    // pinning is about a node meeting a relay, and reusing a home that has
    // already met it would test the cache rather than the pin.
    const meeting = path.join(FAKES, 'lw-pin-' + Date.now(), 'spirit', 'run');
    fs.mkdirSync(path.join(meeting, 'relay-state'), { recursive: true });
    auth.saveIdentity(meeting, auth.generateIdentity('pin-probe'));

    const door = parsed(await get(RELAY + '/api/relay/key'));
    const realKey = door && door.relayPublicKey;
    if (!realKey) { test.fail('no relayPublicKey from the key door'); return; }

    // First contact: nothing on record, so it is accepted and written down.
    if (relayKeys.check(meeting, RELAY, realKey) === 'new') {
      test.check('a relay this node has never met reads as new');
    } else {
      test.fail('first contact: ' + relayKeys.check(meeting, RELAY, realKey));
    }
    relayKeys.accept(meeting, RELAY, realKey);
    if (relayKeys.check(meeting, RELAY, realKey) === 'match' &&
        relayKeys.pinned(meeting, RELAY) === realKey) {
      test.check('and once accepted it is pinned on disk to the key spirit-3 actually publishes');
    } else {
      test.fail('pin: ' + relayKeys.pinned(meeting, RELAY).slice(-12));
    }

    // THE SUBSTITUTION, done the only way it can be done to a relay we do
    // not control: corrupt the pin rather than the relay. The refusal is
    // node-side, so this exercises exactly the code that matters.
    const impostorKey = auth.generateIdentity('other-relay').publicKey;
    relayKeys.accept(meeting, RELAY, impostorKey);
    const changes = [];
    const B = answerRelay.createAnswerer({
      rootDir: meeting,
      request: require('../run/js/hub').relayRequest,
      onKeyChanged: function (url, had, got) { changes.push({ had: had, got: got }); },
    });
    const key = await B.relayKey(RELAY);
    if (key === '' && changes.length === 1 && changes[0].got === realKey) {
      test.check('and a relay answering a key other than the pin is refused, and says which');
    } else {
      test.fail('substitution: key=' + String(key).slice(-12) + ' changes=' + changes.length);
    }

    // THE FRONT DOOR AND THE REAL RELAY KEY. This is the exception the
    // inbox path never needed: a relay may post in its own name, and a
    // relay is not a contact — checked against the key spirit-3 actually
    // publishes, not a fixture.
    relayKeys.accept(meeting, RELAY, realKey);
    if (hub.frontDoor(meeting, realKey) === 'known') {
      test.check("the front door knows spirit-3's own key, so what it posts in its own name is not refused");
    } else {
      test.fail('frontDoor on the real relay key: ' + hub.frontDoor(meeting, realKey));
    }
    // And only because it was accepted. A relay's key is not special by
    // being a relay's — it is special by having been pinned.
    if (hub.frontDoor(meeting, impostorKey) === 'drop') {
      test.check('and refuses a key claiming to be a relay that this node never accepted');
    } else {
      test.fail('impostor relay key: ' + hub.frontDoor(meeting, impostorKey));
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
