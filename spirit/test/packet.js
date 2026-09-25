'use strict';

// The envelope every app's traffic travels in — inside the relay's own
// `text` field, so no relay has to learn anything (packet 1,
// ARCHITECTURAL-CONCERNS.md).
//
// Two properties this file exists to hold down:
//
//   1. A relay running today's code stores and returns a packet without
//      knowing what it is. The wire is `{from, to, text}` with text a
//      string, signed `send\n<from>\n<to>\n<text>`, exactly as before —
//      so there is no spirit-3 cutover and no version skew. The
//      inbox-signature cycle is what that costs when it is unavoidable.
//   2. Every live relay and every peerfile is already full of plain
//      strings. They are chat, they stay chat, and nothing about packets
//      may make yesterday's mail unreadable.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet.js');
const limits = require('../run/js/limits.js');
const hub = require('../run/js/hub.js');

test.startTest('Packets — an envelope the relay never has to understand');

test.subHeading('A body goes in, a string comes out');

{
  const line = packet.encode('relay-chat', 'are you there', { id: 'abc123' });
  if (line.ok && line.text === '{"app":"relay-chat","v":1,"id":"abc123","body":"are you there"}') {
    test.check('a string body encodes to exactly the envelope, and nothing more');
  } else {
    test.fail('encoded: ' + JSON.stringify(line));
  }

  // An object body is the whole point of the door: chess moves, contact
  // cards, a bridge bid. JSON carries it; the relay still sees a
  // string.
  const move = packet.encode('chess', { game: 'g1', move: 'e4' }, { id: 'def456' });
  if (move.ok && typeof move.text === 'string' && JSON.parse(move.text).body.move === 'e4') {
    test.check('and an object body rides in the same string');
  } else {
    test.fail('object encode: ' + JSON.stringify(move));
  }

  const back = packet.decode(move.text);
  if (!back.legacy && back.app === 'chess' && back.id === 'def456' && back.body.game === 'g1') {
    test.check('what comes out is what went in, app and id included');
  } else {
    test.fail('round trip: ' + JSON.stringify(back));
  }

  // An id per send, unasked. The relay assigns one too, but that one
  // is the relay's — an app that wants to know its own traffic across
  // a re-read needs one it minted.
  const first = packet.encode('relay-chat', 'hi');
  const second = packet.encode('relay-chat', 'hi');
  if (first.ok && second.ok && first.envelope.id && first.envelope.id !== second.envelope.id) {
    test.check('and every send gets an id of its own');
  } else {
    test.fail('ids: ' + first.envelope.id + ' / ' + second.envelope.id);
  }
}

test.subHeading('Too big is refused here, not there');

{
  // MAX_TEXT is the relay's limit, checked there against the encoded
  // string — so an oversize packet would cost a signed round trip and a
  // rate-limit slot to be told what this node already knows.
  // THE LIMIT IS ASKED FOR, NOT RESTATED. This asserted `=== 1024`, which
  // was the number packet.js held while the relay held 16384 about the
  // identical string — so the test agreed with the wrong half of a
  // disagreement and made the gap look intentional. One source now
  // (js/limits.js), and this checks the rule rather than the value.
  const huge = packet.encode('relay-chat', 'x'.repeat(packet.MAX_TEXT));
  if (!huge.ok && /too long/.test(huge.error) && huge.limit === limits.PLAINTEXT_MAX) {
    test.check('an envelope over the limit is refused before the wire');
  } else {
    test.fail('oversize: ' + JSON.stringify(huge).slice(0, 120));
  }

  // The envelope counts. A body that only just fits alone does not fit
  // once wrapped, and finding that out at the relay would be finding
  // it out too late.
  const framing = packet.encode('relay-chat', 'x'.repeat(packet.MAX_TEXT - 40), { id: 'abc123' });
  if (!framing.ok) {
    test.check('and the frame is counted, not just the body');
  } else {
    test.fail('a body plus its frame slipped past the limit: ' + framing.text.length);
  }

  const fits = packet.encode('relay-chat', 'x'.repeat(900), { id: 'abc123' });
  if (fits.ok && fits.text.length <= packet.MAX_TEXT) {
    test.check('while an ordinary line has room to spare');
  } else {
    test.fail('900 bytes should fit: ' + JSON.stringify(fits).slice(0, 120));
  }

  // A body JSON cannot express is the app's mistake, said plainly rather
  // than thrown at it.
  const cyclic = {};
  cyclic.self = cyclic;
  const refused = packet.encode('chess', cyclic);
  if (!refused.ok && /serialis/.test(refused.error)) {
    test.check('and a body JSON cannot carry is refused, not thrown');
  } else {
    test.fail('cyclic body: ' + JSON.stringify(refused));
  }
}

test.subHeading('One number, in one place');

// ── HOW THE 16× GAP HAPPENED ─────────────────────────────────────────
//
// Two modules held a limit on the same bytes. packet.js said 1024 and
// relay.js said 16384, both measuring `JSON.stringify(envelope).length`,
// and packet.js's comment claimed to be pre-refusing what the relay would
// refuse. It was refusing sixteen times more.
//
// Nothing caught it because nothing compared them — each was internally
// consistent and each had a test that restated its own number back to it.
// So this checks the property that was missing: that there is only one
// number, and that everything defers to it rather than copying it.
{
  // PLAINTEXT_MAX since cycle 10's R6. An app composes a packet and the
  // node seals it afterwards, so what the browser pre-refuses is the
  // plaintext bound — against the wire bound every app would be told it
  // has 22 KB and be refused at about 16.
  if (packet.MAX_TEXT === limits.PLAINTEXT_MAX) {
    test.check('packet.js takes its limit from js/limits.js rather than holding one');
  } else {
    test.fail('packet ' + packet.MAX_TEXT + ' vs limits ' + limits.PLAINTEXT_MAX);
  }

  // AND NOBODY ELSE DECLARES ONE. A literal here is how the gap comes
  // back: the next module needing a size writes its own, agrees with
  // itself, and disagrees with the wire.
  // js/ AND js/client/: packet.js moved down there, and shell.js — which
  // refuses an oversized send before it posts — is exactly the file that
  // would grow a second number if this scan could not see it.
  const jsDir = path.join(__dirname, '..', 'run', 'js');
  const offenders = [];
  [jsDir, path.join(jsDir, 'client')].forEach(function (dir) {
    const where = dir === jsDir ? '' : 'client/';
    fs.readdirSync(dir).forEach(function (f) {
      if (!f.endsWith('.js') || f === 'limits.js') return;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      src.split('\n').forEach(function (line, i) {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        // A declaration that assigns a bare number to a size-shaped name.
        if (/\b(MAX_TEXT|MAX_ROUTED_TEXT|PAYLOAD_MAX|BODY_MAX|MAX_BODY)\b\s*=\s*\d+/.test(line)) {
          offenders.push(where + f + ':' + (i + 1) + '  ' + line.trim());
        }
      });
    });
  });
  if (offenders.length === 0) {
    test.check('and no other module declares a payload size of its own');
  } else {
    test.fail('a second number is back: ' + offenders.join(' | '));
  }

  // THE CAP ON THE SOCKET IS DERIVED, not a third literal — it has to
  // move when the payload cap moves, or it is either strangling
  // legitimate traffic or leaving the hole it was written to close.
  //
  // Plus the route hints' own room since cycle 2: they sit beside the
  // packet, never inside PAYLOAD_MAX, so the socket accepts them on top.
  if (limits.BODY_MAX === limits.PAYLOAD_MAX + limits.WIRE_HEADROOM + limits.HINTS_MAX) {
    test.check('and the socket cap is the payload cap plus headroom plus the hints’ room, derived');
  } else {
    test.fail('BODY_MAX ' + limits.BODY_MAX + ' is not PAYLOAD_MAX + WIRE_HEADROOM + HINTS_MAX');
  }

  // Headroom over the MEASURED overhead, not under it. 246 was exact at
  // the time of writing; the slack is what stops a longer key format or
  // one more wire field turning legal traffic into 413s.
  if (limits.WIRE_HEADROOM > limits.WIRE_OVERHEAD) {
    test.check('with headroom above the measured 246-byte wire overhead');
  } else {
    test.fail('headroom ' + limits.WIRE_HEADROOM + ' <= measured ' + limits.WIRE_OVERHEAD);
  }
}

test.subHeading('Yesterday’s mail is still mail');

{
  // Every live relay holds these. They decode as legacy, which is what
  // "somebody sent this before packets existed" means, and the reader
  // decides — for Relay Chat, legacy IS a chat line.
  const plain = packet.decode('just a line');
  if (plain.legacy && plain.body === 'just a line' && plain.app === null) {
    test.check('a plain string is legacy, and its body is itself');
  } else {
    test.fail('plain: ' + JSON.stringify(plain));
  }

  // Strictness matters in one direction only: anything we are not sure
  // about must read as legacy, because guessing wrong there means a chat
  // line vanishing rather than a packet being missed.
  const notPackets = [
    '{"app":"relay-chat"}',                       // no version, no body
    '{"app":"relay-chat","v":2,"id":"x","body":1}', // a version we do not know
    // `{"v":1,"id":"x","body":"hi"}` STOOD HERE — "no app" — and it is a
    // packet now, asserted below. See the block after this one.
    '{"app":"","v":1,"id":"x","body":"hi"}',       // empty app: a claim to be
                                                  // an app, made badly
    '[1,2,3]',
    '{ not json at all',
    '',
  ];
  const misread = notPackets.filter(function (text) { return packet.isEnvelope(text); });
  if (misread.length === 0) {
    test.check('and anything short of a whole envelope reads as legacy');
  } else {
    test.fail('read as packets: ' + JSON.stringify(misread));
  }

  // A message that looks like JSON but is somebody typing braces.
  const typed = packet.decode('{"hello": "world"}');
  if (typed.legacy && typed.body === '{"hello": "world"}') {
    test.check('including JSON a person typed by hand');
  } else {
    test.fail('typed JSON: ' + JSON.stringify(typed));
  }
}

// ── A PACKET FOR THE BOX HAS NO APP ──────────────────────────────────
//
//   Andy: "nothing in node and relay should know about apps."
//
// `app` says which app ON THE RECIPIENT NODE a packet is for, and the
// shell is the only reader of it — deliverPackets opens "no envelope:
// addressed to no app". A packet addressed to a RELAY has no such app,
// and requiring one made the node and the box each invent the string
// `relay` and write it into bytes neither of them ever parses.
//
// `{"v":1,"id":"x","body":"hi"}` was in the legacy list above until
// 2026-09-16, on the rule that "anything short of a whole envelope reads
// as legacy". The rule stands; what changed is what a whole envelope IS.
// A version we know and a body still separate a packet from a chat line —
// a plain string is not JSON at all, and hand-typed JSON has neither.
//
// It also closes a hole rather than opening one. While every packet had
// to name an app, an app could name itself `relay` and be
// indistinguishable from a system call. A system packet is the one with
// NO app, and nothing claiming to be an app can forge that.
test.subHeading('A packet addressed to the box names no app');

{
  const sys = packet.encode(null, { search: { q: 'a' } }, { id: 'sys1' });
  if (sys.ok && sys.text === '{"v":1,"id":"sys1","body":{"search":{"q":"a"}}}') {
    test.check('encoding without an app omits the field rather than emptying it');
  } else {
    test.fail('system encode: ' + JSON.stringify(sys));
  }

  const back = packet.decode(sys.text);
  if (!back.legacy && back.app === null && back.body.search.q === 'a') {
    test.check('and it decodes as a packet with no app, not as legacy');
  } else {
    test.fail('system decode: ' + JSON.stringify(back));
  }

  // THE HOLE THIS CLOSES. An app may not sit where a system packet sits.
  const impostor = packet.decode('{"app":"relay","v":1,"id":"x","body":{}}');
  if (!impostor.legacy && impostor.app === 'relay') {
    test.check('while an app calling itself “relay” is still just an app with that name');
  } else {
    test.fail('impostor: ' + JSON.stringify(impostor));
  }

  // AND AN APP PACKET IS UNCHANGED, byte for byte. This is the half that
  // must not move: every live peerfile is full of them.
  const app = packet.encode('relay-chat', 'are you there', { id: 'abc123' });
  if (app.ok && app.text === '{"app":"relay-chat","v":1,"id":"abc123","body":"are you there"}') {
    test.check('and an app’s own packet is byte-for-byte what it always was');
  } else {
    test.fail('app encode moved: ' + JSON.stringify(app));
  }
}

// ── THE NODE NAMES NOTHING ───────────────────────────────────────────
//
//   Andy: "nothing in node and relay should know about apps."
//
// This drove `hub.decorateWithPacket`, which parsed an arriving payload
// and hung `message.packet` on the row so a reader could tell whose
// traffic it was. That reader is the SHELL, which loads this file
// itself — so the node was decoding an app envelope for a layer above
// it, and that was the only reason hub.js required packet.js.
//
// Gone. What is asserted now is the absence: the node exposes nothing
// that reads an envelope, and decoding still works where it belongs.
test.subHeading('The node exposes nothing that reads an envelope');

{
  if (typeof hub.decorateWithPacket !== 'function') {
    test.check('hub no longer decorates — an app envelope is not the node’s to read');
  } else {
    test.fail('hub.decorateWithPacket is back');
  }

  // AND NOTHING IN THE NODE REQUIRES packet.js. The rule is about the
  // dependency, not just the one function: a module about apps has no
  // business in a node, and through server.js it reached a relay.
  // No exclusion needed: packet.js is not in this directory any more. It
  // sits in js/client/ with the shell, which is the same rule written as
  // a path rather than as a test.
  const nodeDir = path.join(__dirname, '..', 'run', 'js');
  const offenders = fs.readdirSync(nodeDir)
    .filter(function (f) { return f.endsWith('.js'); })
    .filter(function (f) {
      // Comments stripped: this file's own history mentions packet.js all
      // over, and a scan that cannot tell code from the record of the code
      // punishes writing the record down.
      const src = fs.readFileSync(path.join(nodeDir, f), 'utf8')
        .split('\n')
        .filter(function (l) { return !/^\s*(\/\/|\*)/.test(l); })
        .join('\n');
      return /require\(['"]\.\/packet/.test(src);
    });
  if (offenders.length === 0) {
    test.check('and no module in js/ requires packet.js — the envelope is the shell’s');
  } else {
    test.fail('node code requiring packet.js: ' + offenders.join(', '));
  }

  // DECODING STILL WORKS, where it belongs. Same function, called by
  // whoever actually routes on the answer.
  const chess = packet.encode('chess', { move: 'e4' }, { id: 'x1' });
  const read = packet.decode(chess.text);
  if (read.app === 'chess' && read.body.move === 'e4') {
    test.check('while packet.decode reads it for the layer that routes on it');
  } else {
    test.fail('decode: ' + JSON.stringify(read));
  }
}
test.subHeading('Relay Chat keeps another app’s traffic out of its archive');

// THE RULE THAT KEEPS A CHESS MOVE OUT OF A CHAT LOG was asserted here,
// against relayChat.js, until 2026-09-25 — when that app left for its own
// repo and the assertion went with it (its repo's
// test/CARRIED-ASSERTIONS.md).
//
// IT IS NOT REPLACED BY AN ASSERTION ABOUT THE SUBSTITUTE, and that is
// deliberate: it was about what ONE APP must not do with a packet name,
// not about what any app does. Re-pointing it at textEditor would have
// produced a check that passes because textEditor has no packets —
// vacuous, and wearing the clothes of the thing it replaced.

test.subHeading('relay.js did not have to change');

{
  // The whole reason the envelope lives inside `text`. If the relay
  // starts PARSING packets it has learned something it does not need to
  // know, and every relay in the world needs updating.
  //
  // Anchored on USE, with comments stripped first. It was a bare search
  // for the word, and the word turned up in a comment the day relay.js
  // grew a router — prose about a packet, not knowledge of one. A check
  // a comment can fail is the /api/hub/peer trap wearing the other face,
  // and it cost a green harness to find again.
  const relaySrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
  const relayCode = relaySrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const parses =
    /require\(\s*['"]\.\/packet/.test(relayCode) ||
    /packetDecode|packetEncode|packetIsEnvelope|spiritPacket/.test(relayCode) ||
    /\.envelope/.test(relayCode);
  if (!parses) {
    test.check('the relay still knows nothing about envelopes');
  } else {
    test.fail('relay.js has learned to parse packets');
  }
}

test.subHeading('The id is a nonce, not a label');

// It was 64 bits from Math.random, which was harmless while `id` only
// helped an app recognise its own traffic across a re-read. The router
// makes the hash of an envelope a ROUTING KEY, and a predictable id is a
// predictable hash (design/relay/ROUTER.md section 6).
//
// Asserted on the OUTPUT rather than on which function was called: a
// comment naming crypto would satisfy a grep, and a weak source would
// not survive these.
{
  const seen = new Set();
  let shortest = Infinity;
  let nonHex = 0;
  for (let n = 0; n < 2000; n += 1) {
    const made = packet.encode('t', 'x');
    if (!made.ok) { nonHex += 1; continue; }
    const id = made.envelope.id;
    seen.add(id);
    shortest = Math.min(shortest, id.length);
    if (!/^[0-9a-f]+$/.test(id)) nonHex += 1;
  }
  if (seen.size === 2000 && nonHex === 0) {
    test.check('two thousand sends, two thousand distinct hex ids');
  } else {
    test.fail('distinct=' + seen.size + ' bad=' + nonHex);
  }

  // 128 bits. The collision odds were never the argument — a 64-bit id
  // is fine for collisions and useless for unpredictability — but a
  // length that silently shrank would be the first sign of a fallback.
  if (shortest === packet.ID_BYTES * 2 && packet.ID_BYTES >= 16) {
    test.check('and each is ' + shortest + ' hex characters, ' +
      (packet.ID_BYTES * 8) + ' bits');
  } else {
    test.fail('shortest=' + shortest + ' ID_BYTES=' + packet.ID_BYTES);
  }

  // The old generator built its string from toString(16) of each draw,
  // so any value with leading zeros contributed fewer than its 32 bits.
  // A fixed-width encoding is what stops that, and it shows up as every
  // id being exactly the same length.
  const lengths = new Set(Array.from(seen).map(function (id) { return id.length; }));
  if (lengths.size === 1) {
    test.check('and all of them the same length, so no draw lost its leading zeros');
  } else {
    test.fail('ragged id lengths: ' + Array.from(lengths).join(', '));
  }
}

test.subHeading('A weak source is refused, never substituted');

// THE bug this replaced would be invisible if it came back: a silent
// fall back to Math.random looks exactly like working code. So the
// absence of randomness has to be an error a caller sees.
{
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const hadProcess = globalThis.process;
  try {
    // Both sources removed: no node crypto (process hidden, so the node
    // branch is not taken) and no web crypto.
    delete globalThis.crypto;
    globalThis.process = undefined;
    const starved = packet.encode('t', 'x');
    if (starved && starved.ok === false && /randomness/.test(starved.error || '')) {
      test.check('with no secure source, a packet is refused and says why');
    } else {
      test.fail('a packet was made without randomness: ' + JSON.stringify(starved));
    }
  } finally {
    globalThis.process = hadProcess;
    if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  }
}

// And the seam a test uses is still there, so exact-string assertions
// above keep working.
{
  const fixed = packet.encode('t', 'x', { random: function () { return 0.5; } });
  if (fixed.ok && fixed.envelope.id.length === packet.ID_BYTES * 2) {
    test.check('and the injectable seam still produces a full-width id');
  } else {
    test.fail('seam: ' + JSON.stringify(fixed));
  }
}

// ---------------------------------------------------------------------
// Re: — the protocol's "regarding", and what it is NOT.
// ---------------------------------------------------------------------
//
//   Andy: "this has nothing to do with chat. it's a protocol feature,
//   similar to an email's Re: (regarding) field in meaning but much more
//   specific."
//
// Specific, because it carries a request HASH rather than a subject line
// or a sender-chosen id: a reference anyone holding the original bytes
// can recompute and check, instead of one they have to take on trust.
test.subHeading('Re: a packet regarding another packet');

(function reRidesInTheEnvelope() {
  const plain = packet.encode('chess', { move: 'e4' }, { id: 'aa' });
  const regarding = packet.encode('chess', { move: 'e5' }, { id: 'bb', re: 'HASHOFE4' });

  if (regarding.ok && JSON.parse(regarding.text).re === 'HASHOFE4') {
    test.check('a packet can say which packet it is about, in the envelope');
  } else {
    test.fail('encoded: ' + regarding.text);
  }

  // IN THE ENVELOPE, NOT THE BODY, and that is the decision. A body
  // convention would be one app's private habit; every app gets this,
  // and most will ignore it.
  if (JSON.parse(regarding.text).body.move === 'e5' &&
      JSON.parse(regarding.text).re === 'HASHOFE4') {
    test.check('and it sits beside the body rather than inside it — a protocol field, not an app convention');
  } else {
    test.fail('shape: ' + regarding.text);
  }

  // A packet that regards nothing is byte-for-byte what it was before
  // this field existed. Every peerfile, every relay running older code,
  // every stored line stays readable.
  if (plain.text.indexOf('"re"') === -1) {
    test.check('a packet regarding nothing carries no field at all — older packets are unchanged');
  } else {
    test.fail('a plain packet grew a field: ' + plain.text);
  }
})();

(function decodeAlwaysAnswers() {
  const withRe = packet.decode(packet.encode('chess', {}, { re: 'H' }).text);
  const without = packet.decode(packet.encode('chess', {}).text);
  const legacy = packet.decode('a plain chat line');

  // '' rather than undefined, so a reader never has to know whether the
  // field was absent or empty — and a legacy line answers the same way.
  if (withRe.re === 'H' && without.re === '' && legacy.re === undefined) {
    test.check("decode answers `re` for an envelope and '' when there is none");
  } else {
    test.fail(JSON.stringify({ withRe: withRe.re, without: without.re, legacy: legacy.re }));
  }

  const decorated = packet.decorate({ text: packet.encode('chess', {}, { re: 'H' }).text });
  if (decorated.packet.re === 'H') {
    test.check('and it reaches an app through decorate, like app and body do');
  } else {
    test.fail('decorated: ' + JSON.stringify(decorated.packet));
  }
})();

(function itIsNotTheRouteKey() {
  // THE DISTINCTION THAT MATTERS, recorded as a check because conflating
  // the two would give threading a twenty-second memory.
  //
  // The router's pending entry is swept after router.js DEFAULT_TTL_MS —
  // that is how long a sender stands waiting for a reply. `re` is not
  // that: it is a new post NAMING an old packet, and it works as long as
  // somebody kept the packet, not as long as a route is open.
  const router = require('../run/js/router.js');
  const ttl = router.createRouter().ttlMs;
  if (typeof ttl === 'number' && ttl <= 60000) {
    test.check('the route table forgets in ' + (ttl / 1000) + 's, which is why `re` is a stored hash and not a route key');
  } else {
    test.fail('route ttl: ' + ttl);
  }
})();

test.reportSuccessFailureCount();
