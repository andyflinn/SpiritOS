'use strict';

// Opening the wire is proved with a signature that expires, and the proof
// never travels in the URL.
//
// THIS SUITE WAS `inboxSig.js` AND IS THE SAME LESSON. It was written for
// `GET /api/relay/inbox`: `inbox\n<label>` never changed, and the hub put
// it on the query string of a public GET. Caddy writes query strings to
// its access log, so one line of that log was a standing licence to drain
// that mailbox — no expiry, no revocation short of changing the key, and
// nothing in the system that would ever notice it had leaked.
//
// R8 deleted that route on 2026-09-15 and both halves of the fix outlived
// it, because neither belonged to the ring:
//
//   THE BYTES CARRY A MINUTE, so a captured signature dies on its own.
//   `streamMessage` is `stream\n<key>\n<unix-minute>` for exactly the
//   reason `inboxMessage` was.
//
//   THE PROOF IS A HEADER, so it is not written down in the first place —
//   and a request that still puts it on the query is refused even with a
//   good header, because a signature that has been in a URL is already in
//   a log whatever the relay does next. `relay.streamSignatureFrom` is
//   `inboxSignatureFrom` renamed, not rewritten.
//
// `GET /api/relay/stream` is now the ONLY signed GET on a relay, which
// makes it the only place this rule can be broken. The stream also wants
// it more than the inbox did: opening the wire buys a STANDING grant
// rather than a single read.
//
// The clock is injected. Nothing here sleeps.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const world = require('./world');
const scenario = require('./scenario');

const MINUTE = 60000;
// A fixed instant, so a test that runs at 23:59 reads the same as one
// that runs at noon.
const NOW = Date.parse('2026-09-08T10:30:20.000Z');

// A keys-mode relay with one claimed peer, which is the only mode where
// anything is proved at all. `andy` is the owner; the builder names it
// `owner`, and this file has called it andy since before there was a
// builder.
function box() {
  const made = world.build(scenario.OWNER_ONLY);
  if (!made.ok) throw new Error(made.error);
  made.andy = made.owner;
  return made;
}

// The KEY, not the label. That is the one difference from the verb this
// replaces, and it is deliberate: labels duplicate by design, so a
// signature naming one identifies nobody on a relay holding two johns.
function signFor(id, key, atMs) {
  return auth.sign(id.privateKey, auth.streamMessage(key, atMs));
}

test.startTest('Stream signature — a minute wide, and never in the URL');

test.subHeading('The bytes say when');

{
  const at = Date.parse('2026-09-08T10:30:20.000Z');
  if (auth.streamMessage('KEY', at) === 'stream\nKEY\n' + Math.floor(at / 60000)) {
    test.check('key and unix-minute, decimal and unpadded');
  } else {
    test.fail('bytes: ' + JSON.stringify(auth.streamMessage('KEY', at)));
  }

  // Every second of the same minute signs the same string; the next
  // minute is a different one. That is the whole of the expiry.
  const early = auth.streamMessage('KEY', Date.parse('2026-09-08T10:30:00.000Z'));
  const late = auth.streamMessage('KEY', Date.parse('2026-09-08T10:30:59.999Z'));
  const next = auth.streamMessage('KEY', Date.parse('2026-09-08T10:31:00.000Z'));
  if (early === late && next !== early) {
    test.check('one string per minute, and a new one at the turn');
  } else {
    test.fail('minute boundary: ' + [early, late, next].join(' | '));
  }

  // ITS OWN VERB, and that is what stops a captured `status` signature —
  // which an owner makes for every census — being replayed into a
  // standing grant on the wire.
  if (auth.streamMessage('KEY', at).indexOf('status') === -1 &&
      auth.statusMessage('KEY') !== auth.streamMessage('KEY', at)) {
    test.check('and it is not the bytes any other verb signs');
  } else {
    test.fail('stream and status share bytes');
  }
}

test.subHeading('A minute either side, and no further');

{
  const m = box();
  const key = m.andy.publicKey;
  const sig = signFor(m.andy, key, NOW);

  if (auth.streamSignatureOk(key, key, sig, NOW)) {
    test.check('signed this minute, opened this minute');
  } else {
    test.fail('same minute refused');
  }

  // Two clocks a minute apart is ordinary; either of them may be the
  // fast one, so the window opens both ways.
  if (auth.streamSignatureOk(key, key, sig, NOW + MINUTE) &&
      auth.streamSignatureOk(key, key, sig, NOW - MINUTE)) {
    test.check('and a minute of clock skew, in both directions');
  } else {
    test.fail('skew: +1 ' + auth.streamSignatureOk(key, key, sig, NOW + MINUTE) +
      ' -1 ' + auth.streamSignatureOk(key, key, sig, NOW - MINUTE));
  }

  if (!auth.streamSignatureOk(key, key, sig, NOW + 2 * MINUTE) &&
      !auth.streamSignatureOk(key, key, sig, NOW - 2 * MINUTE)) {
    test.check('two minutes out is refused, which is what makes a captured line die');
  } else {
    test.fail('two minutes out still opened the wire');
  }

  // Bytes with no minute in them at all — the shape the inbox proof had
  // before it learned to expire. A caller that was never updated does not
  // quietly keep working.
  const old = auth.sign(m.andy.privateKey, 'stream\n' + key);
  if (!auth.streamSignatureOk(key, key, old, NOW)) {
    test.check('and a permanent token opens nothing');
  } else {
    test.fail('the old permanent token still worked');
  }
}

test.subHeading('Somebody else’s key, and no key at all');

{
  const m = box();
  const key = m.andy.publicKey;
  const mallory = auth.generateIdentity('mallory');

  if (!auth.streamSignatureOk(key, key, signFor(mallory, key, NOW), NOW)) {
    test.check('a current signature from the wrong key is still the wrong key');
  } else {
    test.fail('a forged signature opened the wire');
  }

  if (!auth.streamSignatureOk(key, key, '', NOW)) {
    test.check('and no signature opens nothing');
  } else {
    test.fail('an empty signature opened the wire');
  }

  // A signature for one identity is not a signature for another: the key
  // is inside the signed bytes.
  const bert = auth.generateIdentity('bert');
  if (!auth.streamSignatureOk(key, bert.publicKey, signFor(m.andy, key, NOW), NOW)) {
    test.check('and a proof for one identity does not open the next one');
  } else {
    test.fail('andy opened bert with his own signature');
  }
}

test.subHeading('The gate refuses before it allocates');

{
  const m = box();
  const key = m.andy.publicKey;

  // Unknown identity FIRST, before any crypto and before any registry
  // entry: a registry keyed by caller-chosen input grows when a stranger
  // reaches it, so a stranger must not reach it (B1).
  const stranger = m.box.streamOpen('nobody-here', 'ANYTHING', function () {});
  if (!stranger.ok && stranger.status === 403 && stranger.error === 'no such identity') {
    test.check('an identity this box does not hold is refused, and says so first');
  } else {
    test.fail('stranger: ' + JSON.stringify(stranger));
  }

  const badSig = m.box.streamOpen(key, 'NOT-A-SIGNATURE', function () {});
  if (!badSig.ok && badSig.status === 403 && badSig.error === 'bad stream signature') {
    test.check('a row with a bad signature is refused after it');
  } else {
    test.fail('bad signature: ' + JSON.stringify(badSig));
  }

  // And the real thing opens. Signed for the minute the relay is actually
  // in, because streamOpen reads its own clock.
  const good = m.box.streamOpen(key, signFor(m.andy, key, Date.now()), function () {});
  if (good.ok && good.id === key) {
    test.check('and the row’s own key, signed for this minute, opens the wire');
  } else {
    test.fail('good open: ' + JSON.stringify(good));
  }
  m.box.streamClose(key);
}

test.subHeading('The route takes it from a header, and only a header');

{
  const { streamSignatureFrom } = require('../run/js/relay.js');

  const fromHeader = streamSignatureFrom(null, { 'x-spirit-sig': 'SIGNATURE' });
  if (fromHeader.ok && fromHeader.sig === 'SIGNATURE') {
    test.check('a header is where the proof comes from');
  } else {
    test.fail('header read: ' + JSON.stringify(fromHeader));
  }

  // Refused outright, not merely ignored: a signature that has been in a
  // URL is already in an access log, so there is nothing left to protect
  // by accepting the header this time.
  const bothWays = streamSignatureFrom('SIGNATURE', { 'x-spirit-sig': 'SIGNATURE' });
  if (!bothWays.ok && bothWays.status === 403 &&
      bothWays.error === 'stream signature must be a header') {
    test.check('and a query sig is refused even when the header is good');
  } else {
    test.fail('query + header: ' + JSON.stringify(bothWays));
  }

  const queryOnly = streamSignatureFrom('SIGNATURE', {});
  if (!queryOnly.ok && queryOnly.status === 403) {
    test.check('the same bytes on the query alone open nothing');
  } else {
    test.fail('query only: ' + JSON.stringify(queryOnly));
  }

  // No signature at all is not the route's business — the gate inside
  // streamOpen is where that is decided, and it refuses.
  const none = streamSignatureFrom(null, {});
  if (none.ok && none.sig === '') {
    test.check('and nothing at all is passed along for the gate to judge');
  } else {
    test.fail('no sig: ' + JSON.stringify(none));
  }

  // THE NAME IS GONE, not aliased. `inboxSignatureFrom` was the only
  // export of this rule and keeping it alive under both names is how a
  // caller stays unfixed.
  const relayModule = require('../run/js/relay.js');
  if (typeof relayModule.inboxSignatureFrom === 'undefined') {
    test.check('and the name it had under the ring is not still exported');
  } else {
    test.fail('inboxSignatureFrom is still reachable');
  }
}

test.subHeading('Nothing puts it back on the URL');

{
  const RUN = path.join(__dirname, '..', 'run', 'js');

  // presenceNode is the one caller now: the node opening its stream to
  // every relay it holds a row on. It must not be building a query
  // signature, and it is the file that would.
  const pn = fs.readFileSync(path.join(RUN, 'presenceNode.js'), 'utf8');
  if (/X-Spirit-Sig/.test(pn) && pn.indexOf("'&sig='") === -1 && pn.indexOf('&sig=') === -1) {
    test.check('presenceNode sends it as a header, not on the query');
  } else {
    test.fail('presenceNode still builds a query signature');
  }

  // And nothing anywhere under run/ builds one for the STREAM. The ring's
  // hub did it once, and the fix was a header; this is what stops the
  // next caller repeating it.
  //
  // ── ONE KNOWN EXCEPTION, AND IT IS NOT THIS SITTING'S ────────────────
  //
  // `ownerBadge.statusPath` puts a signature on the query of
  // `GET /api/relay/status`:
  //
  //     q += '&sig=' + encodeURIComponent(
  //            auth.sign(id.privateKey, auth.statusMessage(name)));
  //
  // That is the same hazard this suite was written about, on the other
  // signed GET — and WORSE than the one it replaced, because
  // `statusMessage` is `status\n<name>` with no minute in it. A captured
  // line of Caddy's access log is a PERMANENT owner-status credential,
  // with no expiry and no revocation short of changing the key. The
  // inbox proof had exactly this shape before it was fixed twice.
  //
  // Deliberately NOT fixed here. `GET /api/relay/status` is the one thing
  // decision 0010 leaves open — *"it owes an argument rather than a
  // classification"* — and moving it is a reordering of
  // `presenceNode.start`, which is its own sitting. Found while deleting
  // the ring (R8) and written down rather than folded in, so it is a
  // decision and not a discovery twice.
  //
  // The scan below therefore excludes the status path by name. When
  // status moves, delete the exclusion rather than the check.
  const KNOWN = [/&sig='\s*\+\s*encodeURIComponent\(\s*auth\.sign\([^)]*statusMessage/];
  const offenders = [];
  const scanned = fs.readdirSync(RUN).filter(function (f) { return /\.js$/.test(f); });
  scanned.forEach(function (name) {
    var src = fs.readFileSync(path.join(RUN, name), 'utf8')
      .replace(/searchParams\.get\('sig'\)/g, '');
    KNOWN.forEach(function (re) { src = src.replace(re, ''); });
    if (/[?&]sig=/.test(src)) offenders.push(name);
  });
  if (!offenders.length) {
    test.check('and no file under run/js builds one for the stream — ' +
      scanned.length + ' scanned, status excluded by name');
  } else {
    test.fail('these build a query signature: ' + offenders.join(', '));
  }
}

test.reportSuccessFailureCount();
