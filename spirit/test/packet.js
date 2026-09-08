'use strict';

// The envelope every app's traffic travels in — inside the mailbox's own
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
//   2. Every live mailbox and every peerfile is already full of plain
//      strings. They are chat, they stay chat, and nothing about packets
//      may make yesterday's mail unreadable.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const packet = require('../run/js/packet.js');
const hub = require('../run/js/hub.js');

test.startTest('Packets — an envelope the mailbox never has to understand');

test.subHeading('A body goes in, a string comes out');

{
  const line = packet.encode('relay-chat', 'are you there', { id: 'abc123' });
  if (line.ok && line.text === '{"app":"relay-chat","v":1,"id":"abc123","body":"are you there"}') {
    test.check('a string body encodes to exactly the envelope, and nothing more');
  } else {
    test.fail('encoded: ' + JSON.stringify(line));
  }

  // An object body is the whole point of the door: chess moves, contact
  // cards, a bridge bid. JSON carries it; the mailbox still sees a
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

  // An id per send, unasked. The mailbox assigns one too, but that one
  // is the mailbox's — an app that wants to know its own traffic across
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
  const huge = packet.encode('relay-chat', 'x'.repeat(packet.MAX_TEXT));
  if (!huge.ok && /too long/.test(huge.error) && huge.limit === 1024) {
    test.check('an envelope over the limit is refused before the wire');
  } else {
    test.fail('oversize: ' + JSON.stringify(huge).slice(0, 120));
  }

  // The envelope counts. A body that only just fits alone does not fit
  // once wrapped, and finding that out at the mailbox would be finding
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

test.subHeading('Yesterday’s mail is still mail');

{
  // Every live mailbox holds these. They decode as legacy, which is what
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
    '{"v":1,"id":"x","body":"hi"}',                // no app
    '{"app":"","v":1,"id":"x","body":"hi"}',       // empty app
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

test.subHeading('The hub wraps on the way out and names on the way in');

{
  // What the inbox route now hands the browser: the message exactly as
  // the mailbox stored it, plus what its text turned out to be.
  const legacy = hub.decorateWithPacket({ id: '1', from: 'bert', text: 'hello from before' });
  if (legacy.packet.legacy && legacy.packet.body === 'hello from before' && legacy.text === 'hello from before') {
    test.check('a stored plain line arrives named legacy, text untouched');
  } else {
    test.fail('legacy decoration: ' + JSON.stringify(legacy));
  }

  const chess = packet.encode('chess', { move: 'e4' }, { id: 'x1' });
  const decorated = hub.decorateWithPacket({ id: '2', from: 'bert', text: chess.text });
  if (decorated.packet.app === 'chess' && decorated.packet.body.move === 'e4' && decorated.text === chess.text) {
    test.check('and another app’s packet arrives named, with its text left as signed');
  } else {
    test.fail('packet decoration: ' + JSON.stringify(decorated));
  }
}

test.subHeading('Relay Chat keeps another app’s traffic out of its archive');

{
  // The rule that keeps a chess move out of a chat log, asserted where
  // it lives. relayChat.js is loaded in the browser, so this reads the
  // decision rather than driving it — chatSession.js drives the app.
  const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'app', 'relayChat', 'relayChat.js'), 'utf8');
  if (/RC_PACKET_APP = 'relay-chat'/.test(src)) {
    test.check('it says what it is called on the wire');
  } else {
    test.fail('no packet name in relayChat.js');
  }

  const fn = src.slice(src.indexOf('function chatLineFrom'), src.indexOf('function asChatMessage'));
  if (/info\.legacy/.test(fn) && /info\.app !== RC_PACKET_APP/.test(fn) && /return null/.test(fn)) {
    test.check('legacy is a chat line, and another app’s packet is not');
  } else {
    test.fail('chatLineFrom: ' + fn);
  }
}

test.subHeading('relay.js did not have to change');

{
  // The whole reason the envelope lives inside `text`. If this file
  // starts naming packets, the mailbox has learned something it does not
  // need to know, and every relay in the world needs updating.
  const relaySrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
  if (relaySrc.indexOf('packet') === -1 && relaySrc.indexOf('envelope') === -1) {
    test.check('the mailbox still knows nothing about envelopes');
  } else {
    test.fail('relay.js has learned about packets');
  }
}

test.reportSuccessFailureCount();
