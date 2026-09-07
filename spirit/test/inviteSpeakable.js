'use strict';

// Cycle A2 — the token Andy speaks on the phone.
//
// The whole cycle is one sentence: the spoken token is INSIDE what the
// owner signs. Everything here is a consequence of that.
//
//   - Two arguments still mean "the relay picks the token", byte for byte
//     the cycle-2 message, so every signature made before A2 still works.
//   - A signature made without a token mints no spoken token, and a
//     signature for one token mints no other.
//   - The token is held to the name rules, because it is typed by one
//     human, read aloud to another, and then arrives back as a claim.
//
// See CYCLE-A2.md. relay.js keeps minting hex when the field is empty.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-invite-spoken-'));
}

function ownedRelay() {
  const home = tmpHome();
  const box = createRelay(home);
  const owner = auth.generateIdentity('andy');
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  return { home: home, box: box, owner: owner };
}

// Mint the way the hub does: sign exactly the message the relay will
// rebuild, token and all.
function mintAs(r, label, days, token) {
  return r.box.mint(
    'andy',
    label,
    days,
    auth.sign(r.owner.privateKey, invites.mintMessage(label, days, token)),
    token
  );
}

test.startTest('Invite A2 — a spoken token is signed, or it is not a token');

{
  const plain = invites.mintMessage('saint', 7);
  if (plain === 'mint\nsaint\n7') {
    test.check('the two-argument message is still the cycle-2 message, byte for byte');
  } else {
    test.fail('plain: ' + JSON.stringify(plain));
  }

  // Every old caller passes two arguments, or three with nothing in the
  // third. Neither may drift, or every signature minted before A2 breaks.
  const empties = [undefined, null, '', '   '].every(function (t) {
    return invites.mintMessage('saint', 7, t) === plain;
  });
  if (empties) {
    test.check('an absent, empty or blank token is the same message as no token at all');
  } else {
    test.fail('empty token forms differ from the two-argument message');
  }

  const spoken = invites.mintMessage('saint', 7, 'blue-fish');
  if (spoken === plain + '\nblue-fish') {
    test.check('a spoken token is appended to the message it is minted with');
  } else {
    test.fail('spoken: ' + JSON.stringify(spoken));
  }

  if (invites.mintMessage('saint', 7, '  blue-fish  ') === spoken) {
    test.check('the token is trimmed in the message, as it is in the row');
  } else {
    test.fail('untrimmed token signed differently');
  }

  // Days is still normalized inside the message, with a token as without.
  if (invites.mintMessage('far', 99, 'blue') === 'mint\nfar\n15\nblue') {
    test.check('days is still clamped inside the signed message');
  } else {
    test.fail('clamp with token: ' + JSON.stringify(invites.mintMessage('far', 99, 'blue')));
  }
}

test.subHeading('The relay stores the token that was spoken');

{
  const r = ownedRelay();
  const minted = mintAs(r, 'saint', 7, 'blue-fish');

  if (minted.ok && minted.status === 201 && minted.invite.token === 'blue-fish') {
    test.check('the minted row carries the spoken token, not hex');
  } else {
    test.fail('spoken mint: ' + JSON.stringify(minted));
  }

  const onDisk = invites.load(r.home).find(function (row) { return row.token === 'blue-fish'; });
  if (onDisk && onDisk.label === 'saint' && onDisk.consumedAt === null) {
    test.check('it is on disk under that token, unconsumed');
  } else {
    test.fail('on disk: ' + JSON.stringify(invites.load(r.home)));
  }

  // Trimming has to survive the round trip: what was signed, what was
  // stored, and what the friend will type must be one string.
  const padded = mintAs(r, 'anna', 7, '  green-boat  ');
  if (padded.ok && padded.invite.token === 'green-boat') {
    test.check('a token typed with stray spaces is stored trimmed');
  } else {
    test.fail('padded: ' + JSON.stringify(padded));
  }

  // And the point of all of it: the friend claims with the words.
  const saint = auth.generateIdentity('saint');
  const claimed = r.box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.7',
    'blue-fish'
  );
  if (claimed.ok && claimed.status === 201) {
    test.check('the friend claims with the token that was spoken to them');
  } else {
    test.fail('spoken claim: ' + JSON.stringify(claimed));
  }

  const again = auth.generateIdentity('saint2');
  const reuse = r.box.claim(
    'saint',
    auth.sign(again.privateKey, auth.claimMessage('saint')),
    again.publicKey,
    '10.0.0.8',
    'blue-fish'
  );
  if (!reuse.ok && reuse.status === 403) {
    test.check('a spoken token still burns on use, like any other');
  } else {
    test.fail('reuse: ' + JSON.stringify(reuse));
  }
}

test.subHeading('A signature made without a token mints no token');

{
  const r = ownedRelay();

  // The replay this cycle exists to refuse: an owner-signed mint for
  // "saint, 7 days, relay picks the token" must not become "saint, 7
  // days, and the token is one I chose".
  const tokenless = auth.sign(r.owner.privateKey, invites.mintMessage('saint', 7));
  const smuggled = r.box.mint('andy', 'saint', 7, tokenless, 'blue-fish');
  if (!smuggled.ok && smuggled.status === 403) {
    test.check('a tokenless signature cannot mint a spoken token');
  } else {
    test.fail('smuggled: ' + JSON.stringify(smuggled));
  }

  if (invites.load(r.home).length === 0) {
    test.check('and it wrote no row on the way out');
  } else {
    test.fail('rows after refusal: ' + JSON.stringify(invites.load(r.home)));
  }

  // The mirror image: a signature that names a token is not a licence to
  // mint a different one, nor to mint the hex the relay would have picked.
  const forBlue = auth.sign(r.owner.privateKey, invites.mintMessage('saint', 7, 'blue-fish'));
  const swapped = r.box.mint('andy', 'saint', 7, forBlue, 'red-fish');
  const dropped = r.box.mint('andy', 'saint', 7, forBlue, '');
  if (!swapped.ok && swapped.status === 403 && !dropped.ok && dropped.status === 403) {
    test.check("a signature for one token mints neither another nor the relay's hex");
  } else {
    test.fail('swap/drop: ' + JSON.stringify([swapped, dropped]));
  }

  // A status signature was never a mint, and a token does not make it one.
  const statusSig = auth.sign(r.owner.privateKey, auth.statusMessage('andy'));
  const replay = r.box.mint('andy', 'saint', 7, statusSig, 'blue-fish');
  if (!replay.ok && replay.status === 403) {
    test.check('a status signature cannot be replayed into a spoken mint');
  } else {
    test.fail('status replay: ' + JSON.stringify(replay));
  }

  const mallory = auth.generateIdentity('mallory');
  const forged = r.box.mint(
    'andy',
    'saint',
    7,
    auth.sign(mallory.privateKey, invites.mintMessage('saint', 7, 'blue-fish')),
    'blue-fish'
  );
  if (!forged.ok && forged.status === 403) {
    test.check('a stranger cannot mint a spoken token either');
  } else {
    test.fail('forged: ' + JSON.stringify(forged));
  }
}

test.subHeading('What a token may be');

{
  const r = ownedRelay();

  // Same rules as a name: this string is typed by one human, spoken to
  // another, and comes back as a claim. Anything longer or stranger than
  // a name is not something to read down a telephone.
  const bad = ['blue fish', 'blue/fish', '../etc/passwd', 'x'.repeat(33), '<script>'];
  const refused = bad.filter(function (t) {
    const res = mintAs(r, 'saint', 7, t);
    return !res.ok && res.status === 400 && res.error === 'bad token';
  });
  if (refused.length === bad.length) {
    test.check('a token with spaces, slashes, markup or over 32 characters is refused 400');
  } else {
    test.fail('accepted: ' + JSON.stringify(bad.filter(function (t) { return refused.indexOf(t) === -1; })));
  }

  if (invites.load(r.home).length === 0) {
    test.check('a refused token leaves no row behind');
  } else {
    test.fail('rows: ' + JSON.stringify(invites.load(r.home)));
  }

  const longest = mintAs(r, 'saint', 7, 'x'.repeat(32));
  if (longest.ok && longest.invite.token.length === 32) {
    test.check('32 characters is still a token');
  } else {
    test.fail('32 chars: ' + JSON.stringify(longest));
  }
}

test.subHeading('An empty field still means hex');

{
  const r = ownedRelay();
  const auto = mintAs(r, 'saint', 7, '');
  if (auto.ok && /^[0-9a-f]{32}$/.test(auto.invite.token)) {
    test.check('no spoken token, and the relay mints its own hex as before');
  } else {
    test.fail('auto: ' + JSON.stringify(auto));
  }

  // Signed with two arguments, from a caller that has never heard of A2.
  const old = r.box.mint(
    'andy',
    'anna',
    7,
    auth.sign(r.owner.privateKey, invites.mintMessage('anna', 7))
  );
  if (old.ok && old.status === 201 && old.invite.token) {
    test.check('a pre-A2 caller mints unchanged, four arguments and all');
  } else {
    test.fail('old caller: ' + JSON.stringify(old));
  }
}

test.reportSuccessFailureCount();
