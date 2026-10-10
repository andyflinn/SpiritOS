'use strict';

// spirit/run/js/puppetMode.js
// A NODE OWNED BY ANOTHER NODE, AND THE DOOR ITS OWNER HAS.
//
// Three units, and nothing else (goal/G13.2, Andy 2026-10-10: "nodeApps.mountAll will disappear
// forever with this goal.", "Also scopedFs and boots will also disappear completely from
// nodeApps.", and on this file's name, "puppetMode"). This file was nodeApps.js, the loader of
// apps that ran inside the node; that second way of starting a program is gone, and what is
// left is the puppet machinery that had been added into it:
//
//   puppetIn(rootDir, log)       whose puppet this node is, read on every call
//   ownerCommandIn(arrival, …)   the switch where a remote packet becomes local authority (puppets/G5)
//   puppetDoor(opts)             the owner door: a signed command runs through the node's verbs (puppets/G7)
//
// A puppet is a node OWNED by another node's ID (Andy: "pupped is the fate of having an owner
// that is not the self"). The owner's key is relay-state/owner.json, which no app can reach.

// A node is a puppet when relay-state/owner.json names a key that is not its
// own (Andy: "pupped is the fate of having an owner that is not the self").
// Read on every call, so an owner edit is seen at once.
function puppetIn(rootDir, log) {
  const auth = require('./relayAuth');
  const say = log || function () {};
  let moaned = null;
  return function () {
    let broken = null;
    const owner = auth.loadOwner(String(rootDir || ''), function (raw) { broken = raw; });
    if (broken !== null && broken !== moaned) {
      moaned = broken;
      say('owner.json names no owner as { "owner": "MCowBQYDK2VwAyEA..." }, so this node takes no owner commands until it is fixed');
    }
    if (broken === null) moaned = null;
    if (!owner) return { puppet: false, owner: '' };
    const self = auth.loadIdentity(String(rootDir || ''));
    if (self && self.publicKey === owner) return { puppet: false, owner: '' };
    return { puppet: true, owner: owner };
  };
}

// ── THE SWITCH: WHERE A REMOTE PACKET BECOMES LOCAL AUTHORITY (puppets/G5)
//
//   Andy, 2026-09-26: "so we must make sure in code, that the signature is
//   verified in the pupped, else request is refused."
//
// ONE FUNCTION AND NO DISPATCH. It answers whether an arrival is a command
// from this puppet's owner, and nothing else: the loopback dispatch is its own
// requirement (the shim) and building both together would be two halves
// agreeing with each other instead of with the design. So this returns the
// verb and body to run, or a refusal to answer with.
//
// ── WHAT IT REFUSES, AND WHY EACH ONE MATTERS ────────────────────────
//
// NOT IN PUPPET MODE — Andy's own gate, and the strongest one here because it
// is not a check on the packet at all: "the owner is never in puppet-mode, to
// that gate closes automatically." A node with no owner takes no commands, so
// a forged command arriving at an OWNER is not a command that fails a test; it
// is not a command. That closes puppet -> owner by construction.
//
// NOT FROM THE OWNER — the sender key must be the stored owner key. Necessary
// and nowhere near sufficient, which is the whole finding wsl-claude brought:
// a sibling puppet posting through the shared node arrives WITH the owner's
// key, because that is the only key any puppet can post with.
//
// NO COMMAND SIGNATURE, OR A WRONG ONE — the part that actually closes the
// sibling case. The owner signs `cmd` with its identity key; a puppet holds no
// owner private key and cannot mint one. ABSENT AND WRONG ARE ONE REFUSAL on
// purpose: they are the same security event, and two answers would tell a
// caller which of the two it managed.
//
// The recipient key and the envelope id are inside the signed bytes
// (relayAuth commandMessage), so a command signed for this puppet does not
// verify at a sibling, and the same signature cannot be lifted onto another
// envelope. The tag makes a transport signature fail as an inner one by
// signing different bytes rather than by being noticed.
function ownerCommandIn(arrival, opts) {
  const o = opts || {};
  const ownerKey = String(o.ownerKey || '');
  const selfKey = String(o.selfKey || '');
  const auth = o.auth;

  // Andy's mode gate. Absent means nobody: a puppet with no owner established
  // takes no commands from anyone (the same shape as allow.json).
  if (!ownerKey) return { ok: false, status: 403, error: 'not a puppet' };

  const from = String((arrival && arrival.from) || '');
  if (!from || from !== ownerKey) return { ok: false, status: 403, error: 'not the owner' };

  // A COMMAND IS A SYSTEM PACKET: AN ENVELOPE ADDRESSED TO NO APP, and the two
  // halves of that are asked separately on purpose. A decoder answers
  // `legacy: false, app: null` for a system packet AND `app: null` for a plain
  // chat line a peer typed — so testing the app alone would dispatch chat as a
  // verb. wsl-claude found that in this rule before it was built; the envelope
  // being ABSENT (null) for a line that is not a packet is the half that keeps
  // it found.
  //
  // THE ENVELOPE IS HANDED IN, NOT DECODED HERE (N1, goal/G16.5). This took
  // `decode` and `isEnvelope` as values and opened the text itself; the one
  // reader is arrivals.envelopeOf and the caller passes what it read.
  const info = arrival && arrival.envelope;
  if (!info || info.app) return { ok: false, status: 400, error: 'not a command' };

  const body = info.body || {};
  const cmd = typeof body.cmd === 'string' ? body.cmd : '';
  const sig = typeof body.sig === 'string' ? body.sig : '';
  if (!cmd || !sig ||
      !auth.commandSignatureOk(ownerKey, ownerKey, selfKey, info.id, cmd, sig)) {
    return { ok: false, status: 403, error: 'bad command signature' };
  }

  let parsed = null;
  try { parsed = JSON.parse(cmd); }
  catch (e) { return { ok: false, status: 400, error: 'not a command' }; }
  if (!parsed || typeof parsed.verb !== 'string' || !parsed.verb) {
    return { ok: false, status: 400, error: 'not a command' };
  }
  return { ok: true, verb: parsed.verb, body: parsed.body || {} };
}

// ── THE OWNER DOOR (puppets/G7, slice 1) ─────────────────────────────
//
// Commands the owner signs reach the whole node surface, as a loopback
// client would (Andy's puppet ruling).
//
// One arrival at a time, straight from arrivals.subscribe:
//   - not a puppet, not a command, or not from the owner: SILENT. A node
//     that answered strangers would tell them it is a puppet, and a
//     non-puppet must behave exactly as one.
//   - from the owner but failing ownerCommandIn (G5): refused to him.
//   - otherwise the shim runs the verb's own handler with the unwrapped
//     body, as the door in server.js does, and the answer goes back to the
//     owner as a second packet carrying re = the command's hash
//     (transport/R12: "where a hash must match").
//
// THE SHIM: a readable holding the body and a writable catching status and
// body. It carries the two headers the shared body reader needs and no
// socket, so a handler that reaches for the socket fails ALONE (G3): that
// one command is refused, and the node and the next command are untouched.
//
// THE HEADERS CAME WITH goal/G14.1 (Andy, 2026-10-10: "First we fix the
// puppet-issue"). Until then the request carried none, and every node verb
// reads its body through serveCommon.readJsonBody, which begins with the
// content-length header: it threw before parsing, so every command with a
// body was answered 400 Invalid JSON body, found live from his node to his
// puppet with jobs.api. puppetCommands.js holds it; puppetDoor.js never saw
// it because its handlers read the stream by hand.
function puppetDoor(opts) {
  const o = opts || {};
  const puppet = o.puppet || puppetIn(o.rootDir, o.log);
  const say = o.log || function () {};
  function reply(message, owner, answer) {
    let made = o.encode('', answer, { re: message.hash });
    // TOO BIG FOR A PACKET IS SAID, NEVER DROPPED (puppets/G1). packet.encode
    // refuses an answer that cannot travel, and this returned without a
    // word, so the owner waited out its wait for 'no reply from puppet'
    // instead of the reason (wsl-claude: jobs.list on a puppet, 42,570
    // bytes). The refusal names the verb and the size, and always fits.
    if (!made || !made.text) {
      const bytes = Buffer.byteLength(JSON.stringify(answer || {}), 'utf8');
      say('puppet door: the answer to ' + String(message.hash).slice(0, 8) + ' (' + String(answer && answer.verb) +
        ', ' + bytes + ' bytes) is too large for a packet; refused by name');
      made = o.encode('', { ok: false, status: 413, code: 'answer-too-large', verb: answer && answer.verb, bytes: bytes,
        error: 'answer too large for a packet' }, { re: message.hash });
      if (!made || !made.text) return;
    }
    Promise.resolve(o.post(message.relay, owner, made.text)).catch(function (e) {
      say('puppet door: the answer to ' + String(message.hash).slice(0, 8) + ' could not be sent: ' + e.message);
    });
  }
  function shim(verb, body) {
    return new Promise(function (resolve) {
      const handler = o.handlerFor(verb);
      if (!handler) { resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: verb }); return; }
      const text = JSON.stringify(Object.assign({}, body, { verb: verb }));
      const req = require('stream').Readable.from([text]);
      req.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text, 'utf8')) };
      let status = 200;
      const res = {
        writeHead: function (code) { status = Number(code) || 200; return res; },
        setHeader: function () {},
        write: function () { return true; },
        end: function (text) {
          let parsed = null;
          try { parsed = JSON.parse(String(text || '')); } catch (e) { parsed = null; }
          resolve({ ok: status < 400, status: status, body: parsed, text: parsed ? undefined : String(text || '') });
        },
      };
      // A HANDLER CAN FAIL TWICE: at once, or later in the promise it returns.
      // wsl-claude found the second escaping: no answer to the owner, and an
      // unhandled rejection, which stops a Node 24 process. Both land here,
      // and resolve settles only once.
      const failed = function () {
        resolve({ ok: false, status: 500, code: 'handler-failed', error: 'the handler failed', verb: verb });
      };
      let ran = null;
      try { ran = handler(req, res); }
      catch (e) { failed(); return; }
      if (ran && typeof ran.then === 'function') ran.then(null, failed);
    });
  }
  return function (message) {
    const p = puppet();
    if (!p.puppet || !p.owner) return;
    const from = String((message && (message.fromKey || message.from)) || '');
    if (from !== p.owner) return;
    // The envelope arrives read (N1, goal/G16.5), and is passed on rather
    // than read a second time inside ownerCommandIn.
    const info = message && message.envelope;
    if (!info || info.app || !info.body || typeof info.body.cmd !== 'string') return;
    const got = ownerCommandIn({ from: from, envelope: info }, {
      ownerKey: p.owner, selfKey: o.selfKey(), auth: o.auth,
    });
    if (!got.ok) { reply(message, p.owner, got); return; }
    shim(got.verb, got.body).then(function (answer) {
      reply(message, p.owner, Object.assign({ verb: got.verb }, answer));
    });
  };
}

module.exports = {
  puppetIn: puppetIn, puppetDoor: puppetDoor, ownerCommandIn: ownerCommandIn,
};
