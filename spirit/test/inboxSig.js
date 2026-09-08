'use strict';

// Reading a mailbox is proved with a signature that expires, and the
// proof never travels in the URL.
//
// `inbox\n<label>` never changed, and the hub put it on the query string
// of a public GET. Caddy writes query strings to its access log, so one
// line of that log was a standing licence to drain that mailbox — no
// expiry, no revocation short of changing the key, and nothing in the
// system that would ever notice it had leaked.
//
// Two changes, and both are needed. The bytes now carry the minute they
// were made in, so a captured signature dies on its own. The signature
// travels as X-Spirit-Sig, so it is not written down in the first place —
// and a request that still puts it on the query is refused even with a
// good header, because a signature that has been in a URL is already in
// a log whatever the relay does next.
//
// The clock is injected. Nothing here sleeps.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const { createRelay } = require('../run/js/relay.js');
const invites = require('../run/js/invites.js');

const MINUTE = 60000;
// A fixed instant, so a test that runs at 23:59 reads the same as one
// that runs at noon.
const NOW = Date.parse('2026-09-08T10:30:20.000Z');

function tmpHome(tag) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-inbox-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  return home;
}

// A keys-mode mailbox with one claimed peer, which is the only mode where
// a read is proved at all.
function mailbox() {
  const home = tmpHome('box');
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')), andy.publicKey, '10.0.0.1');
  return { home: home, box: box, andy: andy };
}

function signFor(id, name, atMs) {
  return auth.sign(id.privateKey, auth.inboxMessage(name, atMs));
}

// The first claim makes the owner and turns the mailbox to keys mode;
// every later one needs a live invite from that owner. Nothing to do
// with this cycle — it is simply what claiming costs here, and a fixture
// that skipped it would be testing a mailbox that does not exist.
function invited(m, label, id, ip) {
  const minted = m.box.mint('andy', label, 7, auth.sign(m.andy.privateKey, invites.mintMessage(label, 7)));
  const token = minted && minted.invite && minted.invite.token;
  return m.box.claim(label, auth.sign(id.privateKey, auth.claimMessage(label)), id.publicKey, ip, token);
}

test.startTest('Inbox signature — a minute wide, and never in the URL');

test.subHeading('The bytes say when');

{
  const at = Date.parse('2026-09-08T10:30:20.000Z');
  if (auth.inboxMessage('andy', at) === 'inbox\nandy\n' + Math.floor(at / 60000)) {
    test.check('label and unix-minute, decimal and unpadded');
  } else {
    test.fail('bytes: ' + JSON.stringify(auth.inboxMessage('andy', at)));
  }

  // Every second of the same minute signs the same string; the next
  // minute is a different one. That is the whole of the expiry.
  const early = auth.inboxMessage('andy', Date.parse('2026-09-08T10:30:00.000Z'));
  const late = auth.inboxMessage('andy', Date.parse('2026-09-08T10:30:59.999Z'));
  const next = auth.inboxMessage('andy', Date.parse('2026-09-08T10:31:00.000Z'));
  if (early === late && next !== early) {
    test.check('one string per minute, and a new one at the turn');
  } else {
    test.fail('minute boundary: ' + [early, late, next].join(' | '));
  }
}

test.subHeading('A minute either side, and no further');

{
  const m = mailbox();
  const sig = signFor(m.andy, 'andy', NOW);

  if (m.box.inbox('andy', sig, NOW).ok) {
    test.check('signed this minute, read this minute');
  } else {
    test.fail('same minute: ' + JSON.stringify(m.box.inbox('andy', sig, NOW)));
  }

  // Two clocks a minute apart is ordinary; either of them may be the
  // fast one, so the window opens both ways.
  if (m.box.inbox('andy', sig, NOW + MINUTE).ok && m.box.inbox('andy', sig, NOW - MINUTE).ok) {
    test.check('and a minute of clock skew, in both directions');
  } else {
    test.fail('skew: +1 ' + m.box.inbox('andy', sig, NOW + MINUTE).ok +
      ' -1 ' + m.box.inbox('andy', sig, NOW - MINUTE).ok);
  }

  const stale = m.box.inbox('andy', sig, NOW + 2 * MINUTE);
  const early = m.box.inbox('andy', sig, NOW - 2 * MINUTE);
  if (!stale.ok && stale.status === 403 && !early.ok && early.status === 403) {
    test.check('two minutes out is refused, which is what makes a captured line die');
  } else {
    test.fail('two minutes: ' + JSON.stringify(stale) + ' / ' + JSON.stringify(early));
  }

  // The old bytes, which had no minute in them at all. A hub that was
  // never updated does not quietly keep working.
  const old = auth.sign(m.andy.privateKey, 'inbox\nandy');
  if (!m.box.inbox('andy', old, NOW).ok) {
    test.check('and the signature this replaces no longer opens anything');
  } else {
    test.fail('the old permanent token still worked');
  }
}

test.subHeading('Somebody else’s key, and no key at all');

{
  const m = mailbox();
  const mallory = auth.generateIdentity('mallory');

  const forged = m.box.inbox('andy', signFor(mallory, 'andy', NOW), NOW);
  if (!forged.ok && forged.status === 403 && forged.error === 'bad inbox signature') {
    test.check('a current signature from the wrong key is still the wrong key');
  } else {
    test.fail('forged read: ' + JSON.stringify(forged));
  }

  const bare = m.box.inbox('andy', '', NOW);
  if (!bare.ok && bare.status === 403 && bare.error === 'inbox signature required') {
    test.check('and no signature says so, rather than saying it was bad');
  } else {
    test.fail('bare read: ' + JSON.stringify(bare));
  }

  // A signature for one mailbox is not a signature for another: the
  // label is inside the signed bytes.
  const bert = auth.generateIdentity('bert');
  invited(m, 'bert', bert, '10.0.0.2');
  const wrongBox = m.box.inbox('bert', signFor(m.andy, 'andy', NOW), NOW);
  if (!wrongBox.ok) {
    test.check('and a proof for one mailbox does not open the next one');
  } else {
    test.fail('andy read bert with his own signature');
  }
}

test.subHeading('Claim and send are untouched');

{
  const m = mailbox();
  const bert = auth.generateIdentity('bert');

  // Nothing about this cycle changes what a write proves. If these
  // stopped working the fix would be here, not in the deployment.
  const claimed = invited(m, 'bert', bert, '10.0.0.2');
  if (claimed.ok || claimed.status === 201) {
    test.check('claim still signs claim\\n<name>');
  } else {
    test.fail('claim broke: ' + JSON.stringify(claimed));
  }

  const sent = m.box.send('bert', 'andy', 'still working',
    auth.sign(bert.privateKey, auth.sendMessage('bert', 'andy', 'still working')), '10.0.0.2');
  if (sent.ok || sent.status === 201) {
    test.check('and send still signs send\\n<from>\\n<to>\\n<text>');
  } else {
    test.fail('send broke: ' + JSON.stringify(sent));
  }

  // Which the reader can then see, with a signature made for this minute.
  const read = m.box.inbox('andy', signFor(m.andy, 'andy', NOW), NOW);
  if (read.ok && read.messages.some(function (msg) { return msg.text === 'still working'; })) {
    test.check('and the mail is there for a proof that has not expired');
  } else {
    test.fail('read after send: ' + JSON.stringify(read));
  }
}

test.subHeading('The route takes it from a header, and only a header');

{
  const { inboxSignatureFrom } = require('../run/js/relay.js');

  const fromHeader = inboxSignatureFrom(null, { 'x-spirit-sig': 'SIGNATURE' });
  if (fromHeader.ok && fromHeader.sig === 'SIGNATURE') {
    test.check('a header is where the proof comes from');
  } else {
    test.fail('header read: ' + JSON.stringify(fromHeader));
  }

  // Refused outright, not merely ignored: a signature that has been in a
  // URL is already in an access log, so there is nothing left to protect
  // by accepting the header this time.
  const bothWays = inboxSignatureFrom('SIGNATURE', { 'x-spirit-sig': 'SIGNATURE' });
  if (!bothWays.ok && bothWays.status === 403 && bothWays.error === 'inbox signature must be a header') {
    test.check('and a query sig is refused even when the header is good');
  } else {
    test.fail('query + header: ' + JSON.stringify(bothWays));
  }

  const queryOnly = inboxSignatureFrom('SIGNATURE', {});
  if (!queryOnly.ok && queryOnly.status === 403) {
    test.check('the same bytes on the query alone open nothing');
  } else {
    test.fail('query only: ' + JSON.stringify(queryOnly));
  }

  // No signature at all is not the route's business — an open or names
  // relay never needed one, and the auth layer is where that is decided.
  const none = inboxSignatureFrom(null, {});
  if (none.ok && none.sig === '') {
    test.check('and nothing at all is passed along for the gate to judge');
  } else {
    test.fail('no sig: ' + JSON.stringify(none));
  }

  // The hub is the one caller: it must not be putting the signature back
  // on the URL.
  const hub = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'hub.js'), 'utf8');
  if (/X-Spirit-Sig/.test(hub) && hub.indexOf("'&sig='") === -1) {
    test.check('and the hub sends it as a header, not on the query');
  } else {
    test.fail('hub still builds a query signature');
  }
}

test.reportSuccessFailureCount();
