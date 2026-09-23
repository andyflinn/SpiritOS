'use strict';

// Shared by relay.js (verify) and hub.js (sign). Node crypto only.
// Files live on that process's spirit/run home, never in git:
//   relay-state/allow.json     { "keys": [{ "name", "publicKey" }] }, or absent = open
//   relay-state/identity.json  { "name", "publicKey", "privateKey" }
//
// TWO MODES, NOT THREE. `{ "names": [...] }` was a third and went on
// 2026-09-15 — see loadAllow. `devicePublicKey` was a third field on a
// key row and went on 2026-09-13 — see writeAllowKeys.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// The device slot's shape and the one parser for an allow row. deviceAuth
// requires nothing from here, so this is a one-way edge: the module that
// owns the personal node's password also owns how a device key is spelled
// in a mailbox's allow list, and there is one answer to that question.
const deviceAuth = require('./deviceAuth');
// What a label and a description may be, said once for both sides of the
// wire. It requires nothing at all — that is what lets the browser have
// the same copy — so this is another one-way edge.
const labelRule = require('./labelRule');

// ── RESERVED_NAME = 'relay' STOOD HERE ───────────────────────────────
//
//   Andy: "relay is just a public-key-type. node is another one, none
//   other exist yet, but will."
//
// It was a TYPE wearing a caption's clothes, and it said so itself. The
// note above `relayPublicKey` justified it with "a node that keeps one
// file per peer cannot file the relay anywhere without one
// (CYCLE-CHAT-5.1)" — true when it was written, and obsolete since
// relayKeys.js, which files a relay by key and pins it across restarts.
//
// It never guarded routing. `postedToSelf` compares against the relay's
// own key and always has, so reserving a word protected nothing a packet
// could reach — only what a list could DISPLAY. And it could not do even
// that: the comparison is exact, so `Relay` was always claimable, and
// Unicode labels make `relaу` with a Cyrillic у free. A display name
// cannot be defended by blacklisting one string.
//
// What replaces it is what the node already had: two books, both keyed.
// relayKeys.js holds the relays, contacts.js holds the peers, and which
// book a key is in IS its type. Nothing needs to travel, because the
// node is the one who needs to know and it wrote it down itself.
//
// Deleted 2026-09-15 with `who().reserved`, the three refusals in claim,
// invite and renameSelf, and hub's `reservedName` — which was forwarded
// to the browser and read by nothing.

function claimMessage(name) {
  return 'claim\n' + name;
}

// statusMessage STOOD HERE — `'status\n' + name` — and it was the last
// signed format on this wire that named a LABEL rather than a key, and
// the only one carrying no clock. Deleted with `checkOwner` and
// `GET /api/relay/status` on 2026-09-15 (R3).
//
// Every format left here carries a minute: streamMessage, postMessage
// and receiptMessage all take `atMs` and are checked ±1. claimMessage
// does not, and is the exception that proves the rule — a claim is
// answered once, at a box you have no row on, and a registered hash is
// what stops a post being replayed rather than a clock.

// sendMessage AND inboxMessage STOOD HERE — the ring's two signed
// formats, deleted with it by R8 on 2026-09-15 and struck from the
// register in decision 0010.
//
//   sendMessage   'send\n<from>\n<to>\n<text>'    signed by LABEL
//   inboxMessage  'inbox\n<label>\n<unix-minute>' proved a read
//
// Worth recording what `inbox` cost to get right, because the lesson
// outlived the verb and is enforced two functions down. Reading a mailbox
// is as much a capability as writing to one: claim and send were
// signature-gated from the start while inbox took a bare name and handed
// over that peer's messages to anyone who asked. Peer-by-key re-opened
// the same hole. And the first fix was not enough either — `inbox\n<label>`
// never changed, it travelled in the query string, and a query string is
// written to every access log a request passes through, so one line of a
// proxy log was a standing licence to drain that mailbox with no way to
// revoke it short of changing the key. The minute in the bytes is what
// made a captured line die on its own.
//
// Both halves of that survive the verb: streamMessage below carries a
// minute for the same reason, and relay.streamSignatureFrom refuses a
// signature on the query outright.
//
// ITS OWN VERB, and that was the point of it. The argument was that the
// owner signed `status` constantly, for every roll, so a captured
// signature was always lying around — and what a STREAM opens is a
// standing grant rather than a single read, which makes it the better
// prize. Same reason deviceGate gave `device-take` its own bytes.
//
// `status` is gone (R3, 2026-09-15) and the rule outlived it, which is
// the ordinary way of these: one verb, one format, no signature that
// works in two places. There is nothing left on this wire whose bytes
// could be replayed into a stream open.
//
// The token is a public KEY, not a label. Labels duplicate by design, so
// a signature naming one identifies nobody on a relay holding two johns
// (PEER-DEVICES.md, and B2 carried it inward).
function streamMessage(key, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'stream\n' + String(key || '') + '\n' + minute;
}

// Previous, current and next: enough for two clocks a minute apart, in
// both directions, because the SIGNER may be the one running fast. The
// ring's inboxSignatureOk had the same window for the same reason, and
// this is the only one of the pair left.
function streamSignatureOk(publicKey, key, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, streamMessage(key, now + step * 60000), sig)) return true;
  }
  return false;
}

// removePeerMessage and removePeerSignatureOk STOOD HERE, under a note
// arguing that removal — the one owner action that destroys — least
// deserved a shared signature, and that it had to name the KEY because
// labels duplicate.
//
// Both claims were right and a post keeps both, for free: it binds
// sender, recipient and the exact text, carries a minute, and has its
// hash registered before anything is answered. Removal names a key
// because the packet says `key`. There is nothing left here to sign.
//
// Both ways in are packets now — the owner naming anybody, a peer naming
// themselves — see relay.answerSelf. Decision 0010.

function postMessage(from, to, text, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'post\n' + String(from || '') + '\n' + String(to || '') + '\n' +
    minute + '\n' + String(text == null ? '' : text);
}

// Returns THE MESSAGE THAT VERIFIED, not a boolean — and that is the
// whole trick. The signature is accepted across ±1 minute, so three
// different strings could have produced it, and the hash must be taken
// over whichever one actually did. Recovering it here means the minute
// never has to be transmitted: the requester, the relay and the target
// each arrive at the same string by finding the one that checks out.
function postSignatureFor(publicKey, from, to, text, sig, atMs) {
  if (!publicKey || !sig) return '';
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    var message = postMessage(from, to, text, now + step * 60000);
    if (verify(publicKey, message, sig)) return message;
  }
  return '';
}

// ── ROUTE HINTS, SIGNED BESIDE THE PACKET (cycle 2) ──────────────────
//
// design/relay/SURFACE.md §8: hints are SIBLINGS of the signed packet —
// `{ from, to, text, sig, hints, hintSig }` — consumed and dropped by the
// first relay, so they can never sit inside the packet's signature. They
// get their own, because a relay ACTS on them: an unsigned hint block is
// a forgeable route claim (ROUTE-DISCOVERY.md's harvest vector).
//
// Bound to THIS packet by signing over its `sig`: a hint block lifted off
// one post cannot be replayed onto another, and no clock is needed — the
// packet's own signature already carries the minute.
function hintMessage(postSig, hints) {
  return 'hints\n' + String(postSig || '') + '\n' +
    (Array.isArray(hints) ? hints.map(String).join('\n') : '');
}

function hintsSigned(publicKey, postSig, hints, hintSig) {
  if (!publicKey || !postSig || !hintSig || !Array.isArray(hints) || !hints.length) return false;
  return verify(publicKey, hintMessage(postSig, hints), hintSig);
}

// The name of a request, everywhere in the chain.
function requestHash(message) {
  return crypto.createHash('sha256').update(String(message || ''), 'utf8').digest('hex');
}

// "I received exactly those bytes." The hash is INSIDE the signed
// message rather than beside it: attached alongside a signature over
// something else, the relay could swap it (ROUTER.md §2).
function receiptMessage(hash, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'receipt\n' + String(hash || '') + '\n' + minute;
}

function receiptSignatureOk(publicKey, hash, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, receiptMessage(hash, now + step * 60000), sig)) return true;
  }
  return false;
}

// ── WHAT A RELAY SAYS ITS KEYS ARE (cycle 10, R9) ────────────────────
//
//   Andy, 2026-09-23: "relay needs a cypher key too, because it has
//   answerSelf()."
//
// A relay is a peer with a key (decision 0010), so after this cycle posts
// addressed to it are sealed like any other — which means a node must
// learn its CIPHER key, and learn it in a way a carrier cannot choose.
//
// `GET /api/relay/key` was unsigned, and answerRelay.js already said in
// as many words what that was worth: the re-check *"compares against an
// UNSIGNED answer and so catches nothing an attacker could not forge."*
// That was tolerable while the answer was only an identity to pin. It
// stops being tolerable the moment the same answer carries the key
// everything sent to that box is sealed to — hand over your own cipher
// key there and you read every owner verb, every invite token included.
//
// So the relay signs the statement with its IDENTITY key, and the three
// fields are signed together: a signature over the cipher key alone could
// be lifted onto another relay's answer, and key and label are a pair
// besides (Andy: *"key and label are a pair, in keyed mode"*).
//
// THIS IS SELF-SIGNED, with the same honest limit as a node's card: it
// settles tampering, not introduction. What makes it worth anything here
// is the PIN — `relayKeys` remembers the identity across restarts, so a
// substitution after first sighting is what gets caught, which is the
// case that actually happens.
function relayKeyMessage(publicKey, sealKey, label) {
  return 'relay-key\n' + String(publicKey || '') + '\n' +
    String(sealKey || '') + '\n' + String(label || '');
}

function relayKeySigned(publicKey, sealKey, label, sig) {
  if (!publicKey || !sealKey || !sig) return false;
  return verify(publicKey, relayKeyMessage(publicKey, sealKey, label), sig);
}

// ── TWO KEYPAIRS, ONE IDENTITY (cycle 10, R2) ────────────────────────
//
//   Andy, 2026-09-23, asked where the cipher key should live: *"same
//   file"*.
//
// The Ed25519 pair SIGNS; the X25519 pair SEALS. Never one key for both:
// a signing key that also decrypts is one theft away from being both, and
// the two have different lifetimes — an identity is who you are, a seal
// key is what your correspondence rests on.
//
// ONE FILE, which is the ruling and also the practical answer: one thing
// to protect with a file mode, one thing to back up, one thing to lose.
// A second file would mean a node that has half an identity, which is a
// state nothing in this tree knows how to be.
//
// X25519 is in Node's own crypto (22.x), so nothing is hand-rolled and
// nothing is added to package.json. The public half serialises to 60
// characters of base64, which is what rides on the card.
function generateIdentity(name) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const seal = crypto.generateKeyPairSync('x25519');
  return {
    name: name,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    sealPublicKey: seal.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    sealPrivateKey: seal.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

// ── AN IDENTITY FROM BEFORE THIS CYCLE GAINS A SEAL KEY ─────────────
//
// Every node in existence predates cycle 10, including Andy's own and
// both agents'. They keep their identity — the key IS the identity and
// regenerating it would make them strangers to every relay they are
// enrolled at — and gain the second pair in place.
//
// The caller saves and says so; this function only decides. Returns null
// when nothing was needed, so a start that changes nothing prints
// nothing.
function withSealKey(id) {
  if (!id || !id.privateKey) return null;
  if (id.sealPublicKey && id.sealPrivateKey) return null;
  const seal = crypto.generateKeyPairSync('x25519');
  return Object.assign({}, id, {
    sealPublicKey: seal.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    sealPrivateKey: seal.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  });
}

function privateKeyFromB64(b64) {
  return crypto.createPrivateKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
}

function publicKeyFromB64(b64) {
  return crypto.createPublicKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function sign(privateKeyB64, message) {
  return crypto.sign(null, Buffer.from(message, 'utf8'), privateKeyFromB64(privateKeyB64)).toString('base64');
}

function verify(publicKeyB64, message, sigB64) {
  try {
    return crypto.verify(
      null,
      Buffer.from(message, 'utf8'),
      publicKeyFromB64(publicKeyB64),
      Buffer.from(sigB64, 'base64')
    );
  } catch (e) {
    return false;
  }
}

// PENDING-OWNER STOOD HERE — loadPendingOwner, writePendingOwner,
// clearPendingOwner and relay-state/pending-owner.json, written by
// install-public-relay.js to reserve the first claim for a NAME. A name
// with no secret behind it: anybody who guessed it took the box. Replaced
// in cycle 3 (Part B) by the owner invite that install.js mints — a token,
// shown once over SSH (NODE-AND-RELAY, "The first claim needs a token";
// 0003 amended to "first invited claim is owner").

// TWO STATES, NAMED BY WHAT IS TRUE (cycle 3, Andy: "upon first claim, a
// relay is always key-mode, except for claims — this needs tighter
// specification"):
//
//   keys       an owner in allow.json. Claims need an owner-minted invite;
//              everything else is by key and signature.
//   unclaimed  no owner in allow.json. The ONE thing accepted is a claim
//              presenting the installer's owner invite (relay.js
//              claimAttempt). If the roll holds members, the relay refuses
//              to start instead (relayServer.js): recovery is SSH, never
//              the wire (Andy).
//
// `open` — "anyone may take the first claim" — does not exist any more.
function loadAllow(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'allow.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.keys) && parsed.keys.length) {
      const byName = Object.create(null);
      // A ROW IS A NAME AND A HOUSE KEY. `deviceByName` rode alongside
      // until 2026-09-13 and is gone: a relay keeps no device key, because
      // the binding between a device and its node is the NODE's (see
      // deviceAuth.js). A stale `devicePublicKey` in an allow.json written
      // by older code is read and dropped here, which is the migration.
      parsed.keys.forEach(function (raw) {
        const row = deviceAuth.parseKeyRow(raw);
        if (!row) return;
        byName[row.name] = row.publicKey;
      });
      return { mode: 'keys', byName: byName };
    }
    // D6 ELIMINATED (cycle 3, Part B; design/DEPRECATIONS.md). A
    // names-mode allow.json fell through to `open`. There is no `open`
    // now: any allow.json without an owner key is simply `unclaimed`, and
    // a relay whose roll holds members refuses to start on it, so no code
    // is left that is about names mode at all.
    // NAMES MODE STOOD HERE — `{ "names": [...] }`, a list of labels
    // allowed to claim with no key behind any of them. Deleted on
    // 2026-09-15.
    //
    // Not because it was unused in principle but because NOTHING IN THE
    // TREE EVER WROTE ONE. `writeAllowKeys` is the only writer of this
    // file and it writes `keys`; first-claim-is-owner (decision 0003)
    // produces a keys-mode box and always did. A names-mode allow.json
    // could only arrive by hand, and the two gates that made it mean
    // anything — checkSend and checkInbox — went with the ring in the
    // same sitting, so what was left was a mode that could claim and do
    // nothing else.
    //
  } catch (e) { /* missing = no owner */ }
  return { mode: 'unclaimed' };
}

// A row is a name and a house key. It carried a devicePublicKey until
// 2026-09-13; anything still passing one has it dropped here, which is how
// the field leaves a live allow.json on the next write.
function writeAllowKeys(rootDir, keys) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  const rows = (keys || []).map(function (raw) {
    const row = deviceAuth.parseKeyRow(raw);
    if (!row) return null;
    return { name: row.name, publicKey: row.publicKey };
  }).filter(Boolean);
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: rows }, null, 2));
}

// A KEY THAT CANNOT SIGN IS NOT AN IDENTITY.
//
// This used to check that `privateKey` was a non-empty string and stop
// there, so a torn or truncated identity.json loaded fine and threw
// ERR_OSSL_ASN1_NOT_ENOUGH_DATA at the first sign() — synchronously,
// inside an http handler, with nothing waiting to catch it. The node
// died. Found on 2026-09-13 by serverSurface.js's hub sweep, which was
// the first thing ever to call those routes against a booted process.
//
// Answering `null` is the fix rather than a try/catch at each signing
// site, because null is a state every caller ALREADY handles and handles
// well: "no identity on this node", said out loud, with a status. There
// were eleven signing sites and one of this.
//
// The parse is done once, here, and the result thrown away — crypto
// caches nothing for us, but a malformed key fails identically every
// time, so proving it once at load proves it for the process.
function loadIdentity(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'identity.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.name || !parsed.privateKey) return null;
    // Not a format check — an actual parse by the thing that will use it.
    // Anything this accepts, sign() accepts.
    privateKeyFromB64(parsed.privateKey);
    return parsed;
  } catch (e) { /* none, or none usable */ }
  return null;
}

// ── WHAT THIS NODE SAYS ABOUT ITSELF ─────────────────────────────────
//
//   Andy: "spirit/run/relay-state/identity.json store a 'description'
//   let's say max 128 characters ... the description is what I want to
//   replace the ugly end-of-key stuff with in the UI."
//
// 128 BYTES, not characters, and measured the way the wire measures it.
// A cap counted in characters is a cap somebody can walk through with
// emoji, and the thing being protected is a packet budget.
//
// It lives beside the key rather than in a preference file because it is
// answered to strangers: a node hands it over on request, so it belongs
// with the identity it describes and not with the things this machine
// keeps to itself.
//
// THE NUMBER IS labelRule's, and is read from there rather than repeated.
// A form that counts down to 128 while the file trims at 140 is the exact
// drift that file was written to stop, and it is the browser half that
// cannot require this module.
var DESCRIPTION_MAX = labelRule.DESCRIPTION_MAX_BYTES;

function setDescription(rootDir, text) {
  const id = loadIdentity(rootDir);
  if (!id) return null;
  let next = String(text == null ? '' : text).trim();
  // Trimmed to fit rather than refused. A description is prose somebody
  // typed, and the honest failure for prose that is slightly too long is
  // a shorter description, not a rejected form.
  while (Buffer.byteLength(next, 'utf8') > DESCRIPTION_MAX) {
    next = next.slice(0, -1);
  }
  id.description = next;
  saveIdentity(rootDir, id);
  return id;
}

// ── THE PRIVATE HALF IS NOT A WORLD-READABLE FILE ───────────────────
//
// `identity.json` holds the signing key and, since cycle 10, the cipher
// key. It was written at whatever the umask gave — 644 on a typical box,
// so every account on the machine could read both.
//
// 600 ON THE FILE, 700 ON THE DIRECTORY, at creation. Not checked at
// start-up and nothing refuses to run over it: Windows, WSL's drvfs and
// a deliberately widened permission are where that check would produce
// false alarms, and a relay that will not start because of a mode bit is
// worse than one that runs with a known residual.
//
// WHAT IT ACTUALLY BUYS, said plainly rather than implied. The realistic
// reader is a SERVICE ACCOUNT on the same box — www-data, a container
// user, a backup agent — not a second person at a keyboard. Root reads
// everything regardless, and on a single-tenant VPS root is the operator.
// So this closes the accidental path and none of the deliberate ones.
//
// AND IT DOES NOTHING ON WINDOWS. Measured 2026-09-24: `chmod(0o600)`
// leaves mode 666 on NTFS — it is silently inert. The node's prime
// platform is Windows, so this protects the RELAY, which runs on Ubuntu,
// and on a node it is a no-op that costs nothing. The Windows answer is
// an ACL and is deliberately not attempted here; it is a different
// mechanism and would need its own evidence.
//
// FAILURES ARE SWALLOWED. A filesystem that cannot express a mode — a
// mounted share, drvfs — must not stop a node writing its own identity.
function protectFile(file) {
  try { fs.chmodSync(file, 0o600); } catch (e) { /* a mode it cannot express */ }
}
function protectDir(dir) {
  try { fs.chmodSync(dir, 0o700); } catch (e) { /* as above */ }
}

function saveIdentity(rootDir, id) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  protectDir(dir);
  const file = path.join(dir, 'identity.json');
  fs.writeFileSync(file, JSON.stringify(id, null, 2));
  protectFile(file);
}

function ensureIdentity(rootDir, name) {
  var existing = loadIdentity(rootDir);
  if (existing && existing.privateKey && existing.publicKey) {
    // IN PLACE, KEEPING THE IDENTITY (cycle 10, R2). Every node alive
    // predates sealing, and its Ed25519 key IS its identity — every relay
    // it is enrolled at knows it by that key, so regenerating would make
    // it a stranger. It gains the second pair and stays itself.
    var grown = withSealKey(existing);
    if (grown) {
      saveIdentity(rootDir, grown);
      try { console.log('    identity gained a seal key (cycle 10) — the signing key is unchanged'); }
      catch (e) { /* nowhere to say it */ }
      return grown;
    }
    return existing;
  }
  var id = generateIdentity(name);
  saveIdentity(rootDir, id);
  return id;
}

// checkClaim STOOD HERE. Its one job left was `open` mode — "a relay
// before its first claim takes any claim" — and its one caller was the
// branch of relay.js claimAttempt that ran when a relay was neither keys
// nor pending. Both went in cycle 3 (Part B): an unclaimed relay takes
// only the installer's owner invite, and claimAttempt says so itself.

// checkSend, checkInboxKey AND checkInbox STOOD HERE — 66 lines, the
// three gates on the ring, deleted with it by R8 on 2026-09-15.
//
// The reasoning that produced them did not go with them, and two pieces
// of it are load-bearing elsewhere:
//
//   A DEVICE IS NOT A SECOND PARTY. It gets no peer row and claims no
//   label, so the second key lived on the owner RECORD and every gate
//   asking "is this the owner's signature" asked it of both strings.
//   allow.json in keys mode is the owner record, so a device key there
//   was a full copy of the owner's authority — the decision, not an
//   oversight. Reversed on 2026-09-12: checkOwner below takes the HOUSE
//   KEY ONLY, and a relay holds no device key at all now (deviceAuth.js).
//
//   A KEYLESS RELAY HAS NOTHING TO CHECK AGAINST. open and names mode
//   had no per-peer key, so both gates waved reads through. (checkClaim
//   outlived these because a claim outlived the reads; it went too, with
//   open mode, in cycle 3.)

// checkOwner STOOD HERE, and `statusMessage` above it. Both went with
// `GET /api/relay/status` on 2026-09-15 (R3,
// design/cycles/2026-09-15-labels-are-not-identities.md), which was the
// only thing either had ever gated.
//
// WHAT THE OWNER CHECK IS NOW, and it is not a replacement — it is where
// the question was already being answered better. `relay.isOwner(who)`
// compares the POST's proven sender against the key in allow.json, per
// verb, inside answerSelf. The post's own signature did the proving
// before that line ran, so there is no second place to decide who the
// owner is.
//
// WHAT WENT WITH IT, worth keeping because the reasoning outlived the
// function:
//
//   THE HOUSE KEY ONLY, and it REVERSED a decision. checkOwner used to
//   accept either key, on the reasoning that "being the owner from a
//   hotel room is the whole point of the device slot" — true of a design
//   in which a device had nowhere else to go.
//
//   Andy, 2026-09-12, shown what a device key actually reaches: "needs
//   fixing."
//
//   What it reached was ADMIN — through the console's isOwner, `status
//   peers search invites key version`, and `invites` lists LIVE TOKENS.
//   A seized phone could hand out access to the relay. Not "the owner
//   from a hotel room"; the owner's admin console in somebody else's
//   pocket.
//
// That rule is unchanged and now structural: a device signature does not
// verify against a row's key at all, so it is not narrowly refused — it
// never matches. A device is the owner's window, not the owner's
// credentials (design/relay/DEVICE.md).

function ownerName(allow) {
  if (allow.mode !== 'keys') return null;
  var names = Object.keys(allow.byName);
  return names.length ? names[0] : null;
}

module.exports = {
  setDescription: setDescription,
  DESCRIPTION_MAX: DESCRIPTION_MAX,
  claimMessage,
  streamMessage,
  streamSignatureOk,
  postMessage,
  hintMessage,
  hintsSigned,
  postSignatureFor,
  requestHash,
  receiptMessage,
  relayKeyMessage,
  relayKeySigned,
  receiptSignatureOk,
  generateIdentity,
  withSealKey,
  sign,
  verify,
  loadAllow,
  writeAllowKeys,
  loadIdentity,
  saveIdentity,
  ensureIdentity,
  ownerName,
};
