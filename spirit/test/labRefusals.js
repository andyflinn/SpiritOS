'use strict';

// spirit/test/labRefusals.js
// What a real relay process refuses, over real HTTP.
//
// ── THIS WAS labMaster/relayAbuse.test.js ────────────────────────────
//
// Eight checks: three were labMaster's lifecycle (labLifecycle.js has
// them now), one was a send rate limit that died with `sendHits`, and
// one was a claim-flood limit that spirit/test/relayGates.js already
// drives in process.
//
// Two subjects survive, and both are worth a real process:
//
//   THE LABEL RULE, enforced by the RELAY. labelShape.js drives the rule
//   module; nothing asked whether the relay applies it, and a rule
//   nobody enforces is a comment.
//
//   MAX_ROUTED_TEXT, which is asserted NOWHERE in this tree. relay.js
//   checks it in four places and no test has ever sent a byte over it.
//   That is the gap this file was closest to covering and missed,
//   because it was aimed at MAX_TEXT — the ring's cap, now deleted.
//
// ── ONE CHECK IS DELETED RATHER THAN MOVED, AND IT MATTERS ───────────
//
// `slash name rejected` sent `../etc` and expected a 400. That label is
// ACCEPTED now, deliberately: a public label is a caption, addressing is
// by key, and there is nothing a label can traverse into. Had this suite
// been in the harness when labels became Unicode it would have gone red
// on a change that was correct — which is the other failure mode of an
// unwatched test, and the reason this note is longer than the check was.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const rule = require('../run/js/labelRule.js');
const lab = require('./labMaster/ensureMaster.js');

const RELAY_PORT = 65415;
const RELAY_NAME = 'abuse-relay';
const ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function post(pathname, body) {
  try {
    const res = await fetch(ORIGIN + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text: text };
  } catch (e) {
    return { status: 0, text: String((e && e.message) || e) };
  }
}

// A claim is signed or it is nothing (decision 0003). Every label case
// below travels with a real signature, so a 400 is the RULE refusing and
// never the gate.
function claim(label) {
  const id = auth.generateIdentity('probe');
  return post('/api/relay/claim', {
    name: label,
    publicKey: id.publicKey,
    sig: auth.sign(id.privateKey, auth.claimMessage(label)),
  });
}

async function waitServing(timeoutMs) {
  const startedAt = Date.now();
  for (;;) {
    /* eslint-disable no-await-in-loop */
    try {
      const res = await fetch(ORIGIN + '/api/relay/key');
      if (res.status === 200) return true;
    } catch (e) { /* not yet */ }
    if (Date.now() - startedAt > timeoutMs) return false;
    await sleep(200);
  }
}

test.startTest('What a relay refuses — the label rule and the packet cap, on the wire');

async function run() {
  const ready = await lab.ensure();
  if (!ready.ok) { test.fail('no lab: ' + ready.error); return; }

  try { await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/delete', {}); } catch (e) { /* fine */ }

  const made = await lab.api('POST', '/api/nodes',
    { name: RELAY_NAME, type: 'relay', port: RELAY_PORT , kind: 'fixture' });
  if (made.status !== 201) { test.fail('create: ' + made.status + ' ' + made.text); return; }

  const started = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/start', {});
  if (started.status !== 200 || !(await waitServing(10000))) {
    test.fail('the relay never came up on ' + RELAY_PORT);
    return;
  }

  test.subHeading('A label is a caption, and the relay holds it to the shared rule');

  // TOO LONG, measured in GRAPHEMES rather than characters, which is the
  // rule's own unit — 48 of them. Taken from the module rather than
  // written as a number here, so the relay and this suite cannot drift
  // apart the way a copied constant would.
  const tooLong = 'a'.repeat(rule.MAX_GRAPHEMES + 1);
  const long = await claim(tooLong);
  if (long.status === 400) {
    test.check('a label past ' + rule.MAX_GRAPHEMES + ' graphemes is refused BY THE RELAY, not only by the rule module');
  } else {
    test.fail('long label: ' + long.status + ' ' + long.text);
  }

  // A ZERO-WIDTH SPACE. The one class of character a permissive label
  // rule still cannot allow: two labels that are indistinguishable on
  // screen and different on the wire is how somebody is impersonated in
  // a list.
  const invisible = await claim('and​y');
  if (invisible.status === 400) {
    test.check('and so is one carrying an invisible character, which is what impersonation looks like');
  } else {
    test.fail('invisible label: ' + invisible.status + ' ' + invisible.text);
  }

  // ACCEPTED, and this is the check that replaces `slash name rejected`.
  // Unicode, spaces, punctuation and a path-looking thing are all just
  // captions — there is nothing to traverse into, because nothing on
  // this wire is addressed by label.
  //
  // THIS CLAIM IS ALSO THE SETUP for the section below: it is the first
  // claim this box has accepted, so `sender` now owns it and holds a
  // row. That matters, and it cost a red line to learn — see there.
  const sender = auth.generateIdentity('sender');
  const ordinary = await post('/api/relay/claim', {
    name: '../etc: Andy Flinn 🌱',
    publicKey: sender.publicKey,
    sig: auth.sign(sender.privateKey, auth.claimMessage('../etc: Andy Flinn 🌱')),
  });
  if (ordinary.status === 201) {
    test.check('while spaces, punctuation, emoji and even ../etc are a fine caption — addressing is by key');
  } else {
    test.fail('ordinary label: ' + ordinary.status + ' ' + ordinary.text);
  }

  test.subHeading('And a packet has a size, which nothing else in this tree checks');

  // THE SENDER HAS TO HOLD A ROW TO GET THIS FAR, and that is the whole
  // lesson of this section. Written first with a freshly generated key,
  // it read 403 "no such identity" — the relay judges WHO before it
  // judges how much, so the cap was never reached and the check was
  // measuring the wrong refusal.
  //
  // Worse, the control below passed anyway: both calls got 403, and
  // `!== 400` is true of 403, so a check written to prove the two
  // answers DIFFER was satisfied by them being identical. A control is
  // only a control if it can fail.
  //
  // AND THE RECIPIENT IS CHECKED TOO — a generated `to` answered 404
  // "no such peer" for the same reason. So the destination here is THE
  // RELAY'S OWN KEY: a relay is a peer to every member, it publishes
  // that key in its own census, and posts addressed to it are answered
  // like anybody's. It is the one address guaranteed to exist on a box
  // this suite has not spent an invite on.
  const relayKey = (await (await fetch(ORIGIN + '/api/relay/key')).json()).relayPublicKey;
  if (!relayKey) { test.fail('the relay published no key of its own'); return; }
  const target = { publicKey: relayKey };
  const huge = 'x'.repeat(16385);

  const over = await post('/api/relay/post', {
    from: sender.publicKey, to: target.publicKey, text: huge,
    sig: auth.sign(sender.privateKey,
      auth.postMessage(sender.publicKey, target.publicKey, huge)),
  });
  // 413, AND THE NUMBER IS PART OF THE CLAIM. The cap answers "too big"
  // with the status that means it, rather than folding into the 400 that
  // every malformed request gets — so a caller can tell "I said too
  // much" from "I said it wrong" without reading the prose.
  if (over.status === 413) {
    test.check('16385 bytes is refused 413 — the 16 KB router cap is real on the wire, not only in the source');
  } else {
    test.fail('oversized post: ' + over.status + ' ' + over.text.slice(0, 160));
  }

  // THE CONTROL, and it is a real one now: same sender, same target,
  // same signature scheme, one byte. It must NOT be refused the way the
  // oversized one was, or "the cap works" is also explained by "this
  // sender cannot post at all".
  //
  // 503 is the expected pass — the target holds no stream, which is a
  // delivery outcome rather than a refusal of the request. 202 would do
  // too and cannot happen here.
  const small = await post('/api/relay/post', {
    from: sender.publicKey, to: target.publicKey, text: 'x',
    sig: auth.sign(sender.privateKey,
      auth.postMessage(sender.publicKey, target.publicKey, 'x')),
  });
  if (small.status === 503 || small.status === 202) {
    test.check('while one byte reaches delivery (' + small.status +
      '), so it is the LENGTH being judged and not the sender');
  } else {
    test.fail('a one-byte post from the same sender answered ' + small.status +
      ' ' + small.text.slice(0, 160) + ' — the cap check above proves nothing ' +
      'unless this one gets past the gates the oversized one hit');
  }

  await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/delete', {});
}

run()
  .catch(function (err) { test.fail(String((err && err.message) || err)); })
  .then(function () {
    lab.stop();
    test.reportSuccessFailureCount();
  });
