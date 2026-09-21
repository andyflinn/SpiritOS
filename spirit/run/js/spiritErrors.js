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
// ── WHAT THIS DOES NOT DO YET ────────────────────────────────────────
//
// The relay does not SEND codes. It still sends a status and a sentence,
// so `classify` maps what arrives today back to a code — by marker where
// one exists, by exact text, by prefix for the few sentences built at
// runtime. Having the relay emit `code` directly touches its refusal
// whitelist (relayServer.js), which is a wire change and therefore the
// review pile, not this file.
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
define('too-big', {
  status: 413, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['too big'],
});
define('too-big-to-tunnel', {
  status: 413, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['too big to tunnel'], prefixes: ['too big to tunnel'],
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
define('no-such-peer', {
  status: 404, alsoStatus: [403], presence: NONE, retry: 'no', fault: 'caller',
  texts: ['no such peer'],
  note: 'INCONSISTENT: emitted as 404 in seven places and 403 in two. The ' +
    'same condition with two statuses. Recorded rather than changed, ' +
    'because changing a relay status is a wire change.',
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

// ── A MALFORMED REQUEST ──────────────────────────────────────────────
//
// One code for all of them. Every one is the caller's bug, none says
// anything about presence, and none is helped by retrying — the TEXT is
// what differs, and it is kept.

define('bad-request', {
  status: 400, presence: NONE, retry: 'no', fault: 'caller',
  texts: ['text required', 'to required', 'peer key required', 'bad hints', 'bad label',
    'bad token', 'claim needs publicKey', 'claim needs publicKey and sig',
    'first claim needs publicKey and sig', 'forward needs from, to, text and sig',
    'hash required', 'hash, requester and target required', 'invite label required',
    'not a lever name', 'partner relay key required', 'partner relay url required',
    'pick a relay url', 'that is the peer’s own key, not their relay’s',
    'that is this relay', 'Invalid JSON body', 'bad body',
    'publicKey and url required', 'publicKey required', 'that key is this node'],
  prefixes: ['policy must be one of:'],
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
