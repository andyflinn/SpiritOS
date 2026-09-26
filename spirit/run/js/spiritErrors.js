'use strict';

// spirit/run/js/spiritErrors.js
// WHAT AN ERROR MEANS — ONE PLACE, FOR THE RELAY AND THE NODE ALIKE.
//
//   Andy: "now that we know most of failure states, wouldn't it be time to
//   centralize the meaning of errors of status codes, maybe number-text
//   pairs. looks like we have a missing fundamental...."
//
// It was. About seventy error sentences were scattered across eleven HTTP
// statuses, and THE STATUS COULD NOT TELL THEM APART:
//
//   503  seven meanings — the target (unreachable, busy), the relay
//        (router full, no owner), the caller (no time left), the node
//        (no relay url)
//   413  four different "too big"s
//   403  twenty-two: signatures, invites, ownership
//
// AND THE SUITE FOUND THREE MORE ON ITS FIRST RUN that the hand inventory
// had missed — each written across two lines, where a line-based search
// could not see it. Which is the argument for the suite in one sentence.
//
// So a node reading 503 learned nothing, and the only thing separating
// "busy" from "unreachable" was free text. `busy` got a marker bolted on
// because of it (targetBusy.js); "unreachable" never did.
//
// ── WHY THIS CARRIES MEANING AND NOT JUST NAMES ──────────────────────
//
// What a caller needs from an error is not a label. It is three answers:
//
//   presence  what it says about whether the person is THERE
//   retry     whether trying again can help, and when
//   fault     whose problem it is — the caller, the target, the relay,
//             or this node
//
// Found by trying to decide what a failed post should do to a presence
// dot. The honest answer turned out to depend on WHICH failure: a busy
// refusal proves the person is there; "peer not reachable" is the relay
// saying they are not; running out of time says nothing at all. A single
// rule for "failed" would have been wrong two times out of three.
//
// ── WHY THE KEY IS A STRING, NOT A SECOND NUMBER ────────────────────
//
// Andy asked for number-text pairs. HTTP already IS the number, and it is
// exactly the part that is ambiguous. A second numbering would need a
// table to read; `peer-unreachable` reads on its own in the traffic log,
// which is permanent and meant for a person. The status stays, as
// transport; the code is what means something.
//
// ── THE RELAY SENDS THE CODE NOW (R36 phase B, cycle 7) ──────────────
//
// ~~The relay does not SEND codes.~~ — since cycle 7 it does: every refusal
// in relayServer.js's whitelist, and deviceRefusal, carries `code` beside
// `error` (Grok's review: "{ status, error, code } … Keep the sentence").
// `classify` takes a code it knows as meant, first; a code it does not
// know — a newer relay's — falls through to the sentence, and so does an
// older relay that sends none: by marker, by exact text, by prefix.
//
// ── THE ONE RULE classify KEEPS ABOVE ALL THE OTHERS ─────────────────
//
// **An error nobody catalogued says nothing about presence.** `unknown`
// has presence null, so a sentence added next month cannot quietly paint
// somebody red. The suite (spirit/test/spiritErrors.js) scans the whole
// tree for error sentences and fails on any this file does not know.

var TRUE = true;
var FALSE = false;
var NONE = null;

var CATALOGUE = [];
var BY_CODE = Object.create(null);
var BY_TEXT = Object.create(null);
var BY_PREFIX = [];

// `texts` are the exact sentences the tree emits today. `prefixes` are
// for sentences built at runtime ("gave up after 3 attempt(s)").
// `alsoStatus` records a status the same condition is ALSO emitted with,
// which is always an inconsistency worth knowing about rather than a
// feature.
function define(code, e) {
  var entry = {
    code: code,
    status: e.status,
    text: e.texts ? e.texts[0] : (e.prefixes ? e.prefixes[0] : code),
    texts: e.texts || [],
    prefixes: e.prefixes || [],
    alsoStatus: e.alsoStatus || [],
    presence: e.presence === undefined ? NONE : e.presence,
    retry: e.retry || 'no',
    fault: e.fault || 'caller',
    note: e.note || '',
  };
  CATALOGUE.push(entry);
  BY_CODE[code] = entry;
  entry.texts.forEach(function (t) { BY_TEXT[t] = entry; });
  entry.prefixes.forEach(function (p) { BY_PREFIX.push({ prefix: p, entry: entry }); });
  return entry;
}

// ── THE TARGET, AND WHAT IT SAYS ABOUT PRESENCE ──────────────────────

define('peer-unreachable', {
  status: 503, presence: FALSE, retry: 'after', fault: 'target',
  texts: ['peer not reachable', 'that peer is not reachable right now'],
  note: 'The relay speaking about its own member: nobody is on the other end. ' +
    'The one refusal that says ABSENT.',
});
define('target-busy', {
  status: 503, presence: TRUE, retry: 'after', fault: 'target',
  texts: ['target is busy'],
  note: 'They are there and occupied. A busy refusal PROVES presence, which ' +
    'is why "a failed post means absent" was never right.',
});
define('target-unreached', {
  status: 502, presence: NONE, retry: 'after', fault: 'relay',
  texts: ['target could not be reached'],
  note: 'The leg to a partner failed. Says nothing about the person, only ' +
    'about the road.',
});
define('no-answer', {
  status: 504, presence: NONE, retry: 'after', fault: 'target',
  texts: ['no answer yet'], prefixes: ['no answer within'],
  note: 'Delivered, not answered in time. Presence is left alone: a slow ' +
    'reply is not an absence, and the delivery happened before now.',
});
define('gave-up', {
  status: 504, presence: NONE, retry: 'no', fault: 'node',
  prefixes: ['gave up after'],
  note: 'This node\'s own patience ran out. A fact about the waiting, not ' +
    'about anybody.',
});

// ── BUDGET AND CAPACITY ──────────────────────────────────────────────

define('no-time-left', {
  status: 503, presence: NONE, retry: 'no', fault: 'caller',
  // Two hops, one meaning: the router refusing a grant of zero, and the
  // relay refusing to forward when what remains cannot cover a round trip
  // (MIN_USEFUL_MS). Either way the budget is spent.
  texts: ['no time left', 'not enough time to try'],
  note: 'The budget the caller carried ran out before the wire. A fact about ' +
    'the REQUEST, so retrying it cannot help (R5).',
});
define('router-full', {
  status: 503, presence: NONE, retry: 'after', fault: 'relay',
  texts: ['router full'],
});
define('too-many-posts', {
  status: 429, presence: NONE, retry: 'after', fault: 'caller',
  prefixes: ['too many posts — limit is'],
  note: 'A rate limit, not a capacity one: the caller sent too much in a minute.',
});
define('too-many-in-flight', {
  status: 429, presence: NONE, retry: 'after', fault: 'caller',
  texts: ['too many in flight'],
});
define('already-in-flight', {
  status: 409, presence: NONE, retry: 'after', fault: 'caller',
  texts: ['already in flight'],
});
define('too-many-claims', {
  status: 429, presence: NONE, retry: 'after', fault: 'caller',
  texts: ['too many claims'],
});
define('too-many-device-attempts', {
  status: 429, presence: NONE, retry: 'after', fault: 'caller',
  texts: ['too many device attempts'],
});
define('node-queue-full', {
  status: 503, presence: NONE, retry: 'after', fault: 'node',
  texts: ['this node has too much waiting to send'],
  note: 'Refused at this node\'s own door, before anything was signed.',
});
define('memory-full', {
  status: 507, presence: NONE, retry: 'no', fault: 'node',
  texts: ['memory is full of the people you added'],
  note: 'The owner\'s cache cap is spent on added people alone (0021). Not ' +
    'a retry: nothing changes until the owner raises the cap or lets ' +
    'somebody go — "it\'s just reality".',
});
// ── THE OWNER RESIZING HIS OWN BOX (cycle 9) ──────────────────────
//
// Four refusals of one verb, and the two 409s are the rule Andy set:
// "the owner must evict before shrinkage." They are `fault: 'caller'`
// because the caller here IS the owner — the box is telling him what he
// asked for cannot be done, not reporting a fault of its own.
define('relay-not-configurable', {
  status: 501, presence: NONE, retry: 'no', fault: 'target',
  texts: ['this relay has no configuration file to write'],
  note: 'A relay built in process (a suite) has no config.json and no hands ' +
    'to write one. Nothing to retry and nothing the owner can fix from here.',
});
define('shrink-would-strand', {
  status: 409, presence: NONE, retry: 'no', fault: 'caller',
  prefixes: ['that disc figure is smaller than the roll', 'that RAM figure allows'],
  note: 'The figure asked for would leave existing members outside it — off ' +
    'the disc, or past the connection allowance. Refused whole: nobody is ' +
    'evicted by a number (Andy: "the owner must evict before shrinkage"). ' +
    'The owner removes members and asks again.',
});
define('config-not-written', {
  status: 500, presence: NONE, retry: 'no', fault: 'target',
  texts: ['could not write relay-state/config.json'],
  note: 'The figures were valid and the file would not take them — a disc ' +
    'that is full or read-only. The running relay is unchanged; this is an ' +
    'SSH problem.',
});
define('relay-cannot-write', {
  status: 507, presence: NONE, retry: 'no', fault: 'target',
  prefixes: ['this relay cannot write its own state'],
  note: 'The disc is full or the store is read-only. Measured in cycle 9: ' +
    'node:sqlite throws out of mint, and the claim route calls in from a ' +
    'promise, so this used to end the PROCESS. It is now a refusal — the ' +
    'relay keeps forwarding, holding streams and answering searches, none ' +
    'of which touch the store, and takes nobody new until its owner frees ' +
    'space. The sibling of relay-full: that one is the owner\'s configured ' +
    'figure, this one is the disc itself.',
});
define('relay-full', {
  status: 507, presence: NONE, retry: 'no', fault: 'target',
  prefixes: ['this relay is full'],
  note: 'The relay\'s roll is at its configured disc limit (cycle 9, ' +
    'relayConfig discLimitMB). Not a retry and not the caller\'s doing: ' +
    'nothing changes until its owner raises the figure or removes ' +
    'members — and nobody is ever evicted to make room (Andy: "the owner ' +
    'must evict before shrinkage"). The sibling of memory-full, one level ' +
    'up: that one is a node\'s cache, this is a relay\'s disc.',
});
define('too-big', {
  status: 413, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['too big'],
});
define('too-big-to-tunnel', {
  status: 413, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['too big to tunnel'], prefixes: ['too big to tunnel'],
});
// REFUSED BY THE COMPOSER, BEFORE ANYTHING IS SIGNED OR SENT.
// `client/packet.js:215` is the only emitter: `encode` bounds what it
// builds and says so, so a caller learns its packet is too big without a
// round trip and without a relay counting it against a rate limit.
//
// Catalogued although `client/` is outside the suite's scan — an error a
// node hands back is a node's error wherever the sentence was composed,
// and `hub.peerOwnerPost` returns this one unchanged rather than wording
// it again.
//
// `fault: 'caller'`, `retry: 'no'`: the same packet will not fit next
// time. The fix is to send less, or — for an owner command — to accept
// that this verb's arguments do not fit a packet, which is a fact about
// the verb.
define('packet-too-long', {
  status: 413, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['packet too long'], prefixes: ['packet too long'],
});
define('reply-too-big', {
  status: 413, presence: NONE, retry: 'no', fault: 'target',
  texts: ['reply too big to tunnel', 'reply was oversized'],
});

// ── THIS NODE, AND THE RELAY, NOT BEING READY ────────────────────────

define('no-relay-url', {
  status: 503, presence: NONE, retry: 'no', fault: 'node',
  texts: ['no relay url in app/natter/relays.json'],
});
define('not-connected', {
  status: 503, presence: NONE, retry: 'after', fault: 'node',
  texts: ['this node is not connected to a relay'],
});
define('search-failed', {
  status: 503, presence: NONE, retry: 'after', fault: 'relay',
  texts: ['search failed'],
});
define('relay-no-owner', {
  status: 503, presence: NONE, retry: 'no', fault: 'relay',
  texts: ['relay has members but no owner — restore allow.json over SSH'],
});
define('relay-no-identity', {
  status: 503, presence: NONE, retry: 'no', fault: 'relay',
  texts: ['this relay has no identity'],
});
define('node-no-key', {
  status: 409, presence: NONE, retry: 'no', fault: 'node',
  texts: ['this node has no key yet'],
});
define('relay-no-key', {
  status: 409, presence: NONE, retry: 'no', fault: 'relay',
  texts: ['this relay has no key yet'],
});
define('node-no-identity', {
  status: 500, presence: NONE, retry: 'no', fault: 'node',
  texts: ['this node has no identity'],
});
define('request-failed', {
  status: 500, presence: NONE, retry: 'after', fault: 'node',
  prefixes: ['this node could not make the request:'],
});
define('write-failed', {
  status: 500, presence: NONE, retry: 'no', fault: 'node',
  texts: ['could not write identity.json', 'could not write preferences.json',
    'could not move the owner record'],
});
define('internal', {
  status: 500, presence: NONE, retry: 'no', fault: 'relay',
  texts: ['open() requires the delivery'], prefixes: ['unknown requester class:'],
  note: 'A programming error, not a condition. Reported so it is seen.',
});

// ── IDENTITY, SIGNATURES AND OWNERSHIP ───────────────────────────────

define('bad-signature', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['bad post signature', 'bad claim signature', 'bad hint signature',
    'bad inner signature', 'bad receipt signature', 'bad stream signature',
    'stream signature must be a header'],
});
define('no-such-identity', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['no such identity'],
});
// ── THE PROXY, UNDER THE OWNER'S LIST (2026-09-22, THE-PROXY.md) ──────
define('proxy-closed', {
  status: 403, presence: NONE, retry: 'no', fault: 'node',
  texts: ['the proxy is closed by the owner'],
  note: 'The owner closed the gate — all of it, one key, or one website ' +
    '("<key> is closed by the owner", "<host> is closed by the owner"). ' +
    'An agent stops and reports; retrying cannot help.',
});
define('proxy-list-broken', {
  status: 503, presence: NONE, retry: 'no', fault: 'node',
  prefixes: ['the proxy is closed:'],
  note: 'relay-state/proxy.json cannot be read, so the gate is closed ' +
    'rather than open. The owner repairs the file.',
});
define('proxy-no-entry', {
  status: 404, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['no such entry'], prefixes: ['no entry names', 'nothing closed for'],
  note: 'A proxy verb named an entry, key or website the list does not have.',
});
define('proxy-bad-entry', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['key: an environment variable name'],
  note: 'A proxy verb was given a malformed key name, website or method.',
});
define('partner-no-stream', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['a partner holds no stream here'],
  note: 'A partner relay tried to open a stream (R13, cycle 8). Partners ' +
    'hold none: a partner\'s answer is the reply to its own post. Only an ' +
    'older relay that still dials at boot sees this.',
});
define('no-such-peer', {
  status: 404, alsoStatus: [403], presence: NONE, retry: 'no', fault: 'caller',
  texts: ['no such peer'],
  note: 'INCONSISTENT: emitted as 404 in seven places and 403 in two. The ' +
    'same condition with two statuses. Recorded rather than changed, ' +
    'because changing a relay status is a wire change.',
});
// ── THE TWO REFUSALS SEALING ADDS (cycle 10, R5) ─────────────────────
//
// Both are FLAG-DAY errors, which is why they say so in as many words.
// Andy: "we're pre-alpha, old nodes MUST update to stay in the game." A
// node from before this cycle posts plaintext and is refused, and the
// one thing its operator needs to learn is that the box is old rather
// than broken — so neither of these may ever become a silent drop.
define('unsealed-post', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['unsealed posts are refused'],
  note: 'A post that is not a card must be sealed to the recipient\'s ' +
    'cipher key. Refused by the RECEIVER as well as the sender, because ' +
    'a sender-only check is bypassed by not being the sender. Not worth ' +
    'retrying as sent: fetch the card and seal to it.',
});
define('will-not-open', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['this did not open for me'],
  note: 'Sealed, but not to this box — or altered on the way. The three ' +
    'causes (wrong key, tampering, a blob lifted from another exchange ' +
    'and re-addressed) are deliberately not distinguished: telling them ' +
    'apart is only useful to somebody trying them.',
});
// HISTORIC TRAFFIC ROWS CARRY A SECOND NAME FOR THIS, and it is not a
// second condition. `peerPost.js` logged `code: 'no-seal-key'` while
// answering the 428 and the sentences declared here, so 11,628 rows between
// 2026-09-23 and 2026-09-26 name a code this catalogue never had. The
// emitters now log `no-cipher-key`; anything reading that history has to know
// the old string meant this entry.
//
// AND NOT ONLY THE HISTORY, UNTIL EVERY NODE IS UPDATED (spiritos-f6,
// 2026-09-26): the agents node runs from its own clone, so it keeps writing
// `no-seal-key` until this change is committed, pulled there and the node
// restarted. A reader of the log must accept both names for now — which is
// the ordinary shape of a rename on a live wire, and the reason the rename
// went to the LOG string and not to the answer, which never changed. Found by wsl-claude joining the
// agents outbox against this catalogue and getting `unknown` for the most
// frequent refusal in the system — and an outbox that reads unknown as
// "worth retrying" is what turned 158 pending rows into 11,628 refusals.
define('no-cipher-key', {
  status: 428, presence: NONE, retry: 'no', fault: 'caller',
  // THE SENTENCES AS peerPost.js:748-749 ACTUALLY EMITS THEM. This
  // held shortened paraphrases of both — 'no cipher key for that
  // peer' and 'cipher key cannot be used' — so `classifyAnswer`
  // answered UNKNOWN for a condition that was fully catalogued, in
  // the one mechanism whose whole job is to be a closed set.
  //
  // Found 2026-09-24 by an app server asking the catalogue what a
  // live 428 meant and being told nothing. A catalogue that cannot
  // name its own emitter's words is a list, and the difference only
  // shows when something actually asks.
  texts: [
    'no cipher key for that peer — ask for their card first',
    "that peer's cipher key cannot be used",
    'no cipher key for that peer',
    'cipher key cannot be used',
  ],
  note: 'THE SENDER\'S OWN REFUSAL, before anything leaves. Andy: "if ' +
    'you can\'t get the card, you can\'t post anyways." Never a plaintext ' +
    'fallback — that would hand everything to an attacker who can simply ' +
    'withhold a card. Ask for the card, then post.',
});
// ── HANDING A RELAY YOUR CARD (cycle 10, R20) ────────────────────────
//
// A member delivers its own card so the relay can seal answers to it.
// Both refusals are about WHOSE card and WHICH card, and neither is
// retryable as sent.
// THE ONE SENTENCE THAT TRAVELS IN CLEAR, and the reason it is fixed.
//
// A relay seals its answers to the card on the asker's roll row. When it
// holds no card it cannot seal, and a refusal must still be heard or the
// flag day is indistinguishable from a broken relay. So that one refusal
// goes out plain — and it says THIS, always, whatever the verb underneath
// it would have said.
//
// wsl-claude found why that matters: the plain branch used to forward
// `answer.error`, the verb's own sentence. Refusal sentences in this tree
// carry the relay's CONDITION — the disc guard says it cannot write its
// own state, the compaction refusal names megabytes free and needed, a
// full relay names the obstruction. Decision 0006 makes that the owner's
// business and not the asker's, and an asker with no card is the one
// party least entitled to it.
//
// It is also the only sentence an old node can act on: it has exactly one
// move, which is to hand over a card (cycle 10, R20).
define('no-card-for-you', {
  status: 428, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['this relay holds no card for you, so it cannot seal a reply'],
  note: 'NOT a verb failure. The verb may well have succeeded; what ' +
    'failed is the relay being able to say so privately. Fixed text AND ' +
    'fixed status, because the verb\'s status is the verb\'s information ' +
    'too, and this asker is owed one fact only: hand over a card, then ' +
    'ask again.',
});
// ── THE RECIPIENT'S REPLAY INDEX (cycle 10, R17 and C2) ──────────────
//
// A relay refuses a hash it has already registered. A blob replayed
// through a DIFFERENT relay meets a guard that has never seen it, because
// cycle 10's R4 leaves the relay out of the associated data on purpose. So the
// recipient keeps the index, and these are the three ways it says no.
//
// ALL THREE ARE 409 AND NONE IS RETRYABLE AS SENT. A sender that reseals
// gets a new hash and a new timestamp, which is a different message and
// is treated as one.
define('replayed', {
  status: 409, presence: NONE, retry: 'no', fault: 'caller',
  texts: [
    'this message has already been delivered here',
    'this message is dated further ahead than a clock can explain',
    'this message is older than this node remembers, and cannot be told from a replay',
  ],
  note: 'THE THIRD ONE IS NOT AN ACCUSATION. A message older than the ' +
    'index\'s retention is refused because the index CANNOT VOUCH either ' +
    'way — its hash may already have been swept — and the window and the ' +
    'memory are deliberately the same number (C2), so that a row leaving ' +
    'the index can never silently make an old message replayable again. ' +
    'The second is clock skew past the tolerance, not a forgery claim.',
});
// ── THE OWNER'S RELAY RECORD (cycle 11's R6) ─────────────────────────
//
// The record lives in node.db and a node that cannot open its own store
// has nothing to answer with. Distinct from an empty record, which is a
// perfectly good answer meaning "no relay has reported yet" and is a 200
// with an empty list.
define('no-record', {
  status: 503, presence: NONE, retry: 'after', fault: 'node',
  texts: ['no record on this node'],
  note: 'This node could not open node.db. Not a statement about any ' +
    'relay and not an empty history — the difference matters, because an ' +
    'empty series is a fact about the relays and this is a fact about ' +
    'the box being asked.',
});
define('card-not-yours', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['that card is not yours'],
  note: 'The card verified — it is a real card — and it was signed by a ' +
    'key other than the one that signed the post carrying it. A member ' +
    'delivers only its own, which is the same check the claim route makes.',
});
define('card-not-newer', {
  status: 409, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['not newer than the card on file'],
  note: 'THE ROLLBACK REFUSAL. A validly signed OLD card can be re-served ' +
    'after a rotation and it still verifies — a downgrade needing no ' +
    'forgery, only a copy, possibly back to the very key whose compromise ' +
    'caused the rotation. The roll takes a card only when its counter is ' +
    'strictly higher. Not an error to retry: it means the relay already ' +
    'holds this card or a better one.',
});
define('not-owner', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['not the owner', 'no owner key on this relay', 'the owner cannot be removed',
    'this relay already has an owner', 'owner invite required'],
});
define('not-target', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['not the target of that request'],
});
define('device-not-now', {
  status: 403, presence: NONE, retry: 'after', fault: 'caller',
  texts: ['not now'],
});
define('url-not-listed', {
  status: 403, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['url not in app/natter/relays.json'],
});

// ── INVITES ──────────────────────────────────────────────────────────
//
// Five codes rather than one, because a screen tells a person something
// different for each: an expired invite needs a new one, a used one needs
// asking who used it.

define('invite-required', { status: 403, texts: ['invite required'] });
define('invite-used', { status: 403, texts: ['invite already used'] });
define('invite-expired', { status: 403, texts: ['invite expired'] });
define('invite-mismatch', { status: 403, texts: ['invite label mismatch'] });
define('invite-not-found', { status: 403, texts: ['invite not found'] });

// ── NOT FOUND AND CONFLICT ───────────────────────────────────────────

define('no-row', { status: 404, texts: ['no row for that key'] });
define('no-governor', { status: 404, texts: ['no Governor'] });
define('no-such-lever', { status: 404, texts: ['no such lever'] });
define('no-such-request', { status: 404, texts: ['no such request'] });
define('key-claimed', { status: 409, texts: ['key already claimed'] });
define('minting-incomplete', { status: 409, retry: 'after', texts: ['minting incomplete'] });
define('name-reserved', { status: 409, texts: ['name reserved by a live invite'] });

// A GRANTED NAME AND A RESERVED ONE ARE NOT THE SAME REFUSAL, and the
// difference is in how long it lasts. `name-reserved` frees itself when
// the invite behind it expires, so the caller can come back. A GRANT
// DOES NOT EXPIRE — Andy, 2026-09-24: *"A name grant persists. true.
// but only on the owners node."* — so `retry: 'no'` is the honest
// answer and the caller must pick another name.
//
// Declared here BEFORE `app/appShellApp/` emits it, which is the point:
// a code that lives only in the file that throws it is outside the
// closed set at the one moment anybody needs to look it up. The
// subdomain grant is the appShellApp's whole feature (Andy: *"the
// feature of the appShellApp is: the granting/associating member ID's
// with wildcard subdomain names. that's all."*), and this is the one
// refusal that feature can give.
define('name-already-granted', {
  status: 409, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['name already granted'],
});

// ── A MALFORMED REQUEST ──────────────────────────────────────────────
//
// One code for all of them. Every one is the caller's bug, none says
// anything about presence, and none is helped by retrying — the TEXT is
// what differs, and it is kept.

define('bad-request', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['text required', 'to required', 'verb required', 'peer key required', 'bad hints', 'bad label',
    'bad token', 'claim needs publicKey', 'claim needs publicKey and sig',
    'first claim needs publicKey and sig', 'forward needs from, to, text and sig',
    'hash required', 'hash, requester and target required', 'invite label required',
    'not a lever name', 'partner relay key required', 'partner relay url required',
    'pick a relay url', 'that is the peer’s own key, not their relay’s',
    'that is this relay', 'Invalid JSON body', 'bad body',
    'publicKey and url required', 'publicKey required', 'that key is this node'],
  prefixes: ['policy must be one of:'],
});

// ── AN APP SERVER'S OWN REFUSALS (cycle 2) ──────────────────────
//
// Seven, and they are here rather than in appServer.js for the reason
// this catalogue exists at all: a refusal an app emits must be a MEMBER
// of a declared set, and nothing outside a set may be sent. A set kept
// beside the code that emits it is a list; a set kept here is walkable,
// because `all()` already answers and a suite already counts it.
//
// FOUR OF THEM ARE STATES NOBODY CAN REACH IN DEVELOPMENT, which is the
// whole reason they are enumerated before they are needed: a public
// app's failure states are the states a developer cannot produce by
// working normally. You claim the relay in the first five minutes and
// never see `app-unbound` again; your own node is always up, so
// `app-owner-asleep` never fires; a development relay is empty, so
// `app-relay-full` never fires; and the URL in your config is always
// right on the box that wrote it, so `app-relay-key-changed` never
// fires. Each will be met, once per deployment, by a stranger.
//
// NONE OF THEM CARRIES A FIGURE. An app server talks to people who are
// not members, and cycle 10's leak rule is sharper here than anywhere:
// a relay's condition is its owner's business and not a visitor's. So
// these are literals, and anything dynamic rides beside the sentence
// rather than inside it.
define('app-unbound', {
  status: 503, presence: NONE, retry: 'after', fault: 'relay',
  texts: ['this service is waiting for its relay to have an owner'],
  note: 'NOT AN ERROR AND NOT A MISCONFIGURATION. A relay is born ' +
    'unclaimed and stays so until its first invited claim; until then ' +
    'ownerKey answers the empty string and there is nobody to act for. ' +
    'The app serves its page and acts on nothing. Entered exactly once ' +
    'per deployment, in production, by a stranger.',
});
define('app-relay-full', {
  status: 507, presence: NONE, retry: 'after', fault: 'relay',
  texts: ['this relay has no seats left'],
  note: 'The relay refuses a mint with its own sentence, which names ' +
    'figures — members, allowance, invites outstanding. Those are the ' +
    'owner\'s business (decision 0006) and a visitor is the party least ' +
    'entitled to them, so this is what a visitor is told instead, and ' +
    'the other door — run your own relay — is what they are offered.',
});
define('app-owner-asleep', {
  status: 503, presence: NONE, retry: 'after', fault: 'target',
  texts: ['the owner of this service is not reachable right now'],
  note: 'REFUSE, NEVER QUEUE. Whatever a visitor handed over is ' +
    'short-lived — a one-use code dies in ten minutes — and ' +
    'queueing it means STORING it, which is the one thing an app ' +
    'serving strangers promises not to do. Nothing durable holds what ' +
    'arrived.',
});
define('app-relay-key-changed', {
  status: 409, presence: NONE, retry: 'no', fault: 'relay',
  texts: ['this service is bound to a different relay key'],
  note: 'THE FIRST BIND IS FINAL. Refused so a wrong owner cannot take ' +
    'over, kept so the contradiction survives, and reported because a ' +
    'relay answering with a different key is either a migration the ' +
    'owner made or an attack, and only the owner can tell which. The ' +
    'bind is to the KEY and never the URL: a URL is a name somebody ' +
    'else controls.',
});
define('app-not-a-member', {
  status: 403, presence: NONE, retry: 'no', fault: 'node',
  texts: ['this service is not a member of the relay it was pointed at'],
  note: 'An app server needs a seat on the relay it serves, because a ' +
    'relay routes between members. The owner mints one seat to ' +
    'bootstrap it — step 4 of the bind sequence — and without that ' +
    'there is nothing to route.',
});
define('app-surface-undeclared', {
  status: 500, presence: NONE, retry: 'no', fault: 'node',
  texts: ['this app declares no surface, so it was handed none'],
  note: 'ABSENT MEANS NOTHING. The permissive default would make the ' +
    'app contract a check that cannot fail: if an undeclared app got ' +
    'the whole surface, "every member an app touches is declared" ' +
    'would be vacuously true of every app that declares nothing, and ' +
    'dead surface could never be counted (wsl-claude). Refused at ' +
    'LOAD, naming what is missing, rather than at the moment the app ' +
    'reaches for something.',
});
define('app-not-strict', {
  status: 500, presence: NONE, retry: 'no', fault: 'node',
  texts: ['an app served to strangers must declare posture strict'],
  note: 'Posture is half enforced and half declared, and saying so is ' +
    'the honest part: persist-nothing falls out of the writable scope ' +
    'and is checkable; refusing in sentences a stranger can act on is ' +
    'prose quality, which a closed set converts into a one-time review ' +
    'of N sentences plus a mechanical check that nothing outside the ' +
    'set is emitted. An improvement, and not a guarantee.',
});

// ── WHAT NOBODY CATALOGUED ───────────────────────────────────────────
//
// Not in the table, and says nothing — above all about presence. The
// status is carried through untouched so nothing is lost; only the
// meaning is withheld.
var UNKNOWN = {
  code: 'unknown', status: 0, text: '', texts: [], prefixes: [], alsoStatus: [],
  presence: NONE, retry: 'no', fault: 'caller',
  note: 'Not catalogued. Deliberately claims nothing.',
};

// ── WHAT ARRIVES TODAY, MAPPED TO A MEANING ──────────────────────────
//
// Markers first, because they were added precisely where the sentence
// could not be trusted to disambiguate. Then the exact sentence. Then a
// prefix, for the few built at runtime. Then nothing.
function classify(status, text, body) {
  var b = body || {};
  // THE RELAY'S OWN WORD FIRST (R36 phase B). A code this catalogue knows
  // is taken as meant; one it does not know falls through to the sentence,
  // so a newer relay can never make an older node read a refusal as
  // something it is not.
  if (typeof b.code === 'string' && BY_CODE[b.code]) return BY_CODE[b.code];
  if (b.busy) return BY_CODE['target-busy'];
  if (b.tooLittleTime) return BY_CODE['no-time-left'];
  if (b.gaveUp) return BY_CODE['gave-up'];
  if (b.queueFull) return BY_CODE['node-queue-full'];
  if (b.stillOpen) return BY_CODE['no-answer'];

  var t = String(text == null ? '' : text).trim();
  if (BY_TEXT[t]) return BY_TEXT[t];
  for (var i = 0; i < BY_PREFIX.length; i += 1) {
    if (t.indexOf(BY_PREFIX[i].prefix) === 0) return BY_PREFIX[i].entry;
  }
  return Object.assign({}, UNKNOWN, { status: Number(status) || 0, text: t });
}

// A post's answer, as peerPost resolves it: `{ ok, status, error, ... }`.
function classifyAnswer(answer) {
  var a = answer || {};
  if (a.ok) return null;
  return classify(a.status, a.error, a);
}

function byCode(code) { return BY_CODE[code] || null; }

module.exports = {
  classify: classify,
  classifyAnswer: classifyAnswer,
  byCode: byCode,
  all: function () { return CATALOGUE.slice(); },
  UNKNOWN: UNKNOWN,
};
