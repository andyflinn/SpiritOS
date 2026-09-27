'use strict';

// spirit/test/ownerPost.js
// peerOwnerPost: THE OWNER'S SIGNED COMMAND TO ONE OF HIS PUPPETS, AND
// ONLY THAT PUPPET'S ANSWER BACK (puppets/G4).
//
//   Andy, naming it: "the interface might better be call peerOwnerPost()",
//   "it's more true." And of what reaches a puppet: "not every group is
//   supported in every context/environment".
//
// Built by claude-windows at 8c8347c. The far end is a REAL
// nodeApps.puppetDoor with its own relay-state/puppet.json, so a command
// is signed by ownerPost, checked by G5's rule and run by G7's shim --
// the whole owner door, end to end, over an in-process relay.
//
// A matching hash alone is not proof, so the answer is taken only from THE
// puppet the command went to, once, within the wait.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const packet = require('../run/js/client/packet');
const nodeApps = require('../run/js/nodeApps');
const ownerPost = require('../run/js/ownerPost');

test.startTest('The owner\'s signed command reaches his puppet, and only that puppet\'s answer comes back');

const owner = auth.generateIdentity('owner');
const puppet = auth.generateIdentity('puppet');
const other = auth.generateIdentity('other-puppet');

// A puppet node: its puppet.json, a real door, and a handler per verb.
function puppetNode(id, carries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ownerpost-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'puppet.json'),
    JSON.stringify({ owner: owner.publicKey, carries: carries }));
  const ran = [];
  const node = {
    id: id, ran: ran, deliverAnswer: null,
    door: null,
  };
  node.door = nodeApps.puppetDoor({
    rootDir: root,
    handlerFor: function (verb) {
      if (verb !== 'contact.list') return null;
      return function (req, res) {
        let t = ''; req.on('data', function (c) { t += c; });
        req.on('end', function () { ran.push(verb); res.writeHead(200); res.end(JSON.stringify({ ok: true, got: JSON.parse(t) })); });
      };
    },
    post: function (relay, to, text) { node.deliverAnswer(to, text); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode, isEnvelope: packet.isEnvelope, auth: auth,
    selfKey: function () { return id.publicKey; },
    log: function () {},
  });
  return node;
}

// The owner's side, over an in-process relay. `order` decides whether the
// puppet's answer arrives before or after the post resolves.
function ownerWith(puppets, opts) {
  const o = opts || {};
  let n = 0;
  const sent = [];
  const op = ownerPost.createOwnerPost({
    identity: function () { return owner; },
    randomId: packet.randomId,
    auth: auth, encode: packet.encode, decode: packet.decode, isEnvelope: packet.isEnvelope,
    route: function () { return { relayUrl: 'https://relay.example', hints: undefined }; },
    waitMs: o.waitMs || 200,
    post: function (relayUrl, to, text) {
      n += 1;
      const hash = 'CMD' + n;
      sent.push({ to: to, hash: hash });
      const p = puppets[to];
      if (!p) return Promise.resolve({ ok: true, hash: hash });
      if (o.silent) return Promise.resolve({ ok: true, hash: hash });
      // The puppet answers back to the owner, carrying re = the command's hash.
      p.deliverAnswer = function (toOwner, answerText) {
        const arrive = function () { op.onArrival({ from: p.id.publicKey, text: answerText }); };
        if (o.answerFirst) arrive(); else setTimeout(arrive, 5);
      };
      p.door({ from: owner.publicKey, text: text, hash: hash, relay: relayUrl });
      return new Promise(function (r) { setTimeout(function () { r({ ok: true, hash: hash }); }, o.answerFirst ? 20 : 0); });
    },
  });
  op.sent = sent;
  return op;
}

(async function () {
  const P = puppetNode(puppet, ['contact']);
  const puppets = {}; puppets[puppet.publicKey] = P;

  // ── THE CONTROL: A SIGNED COMMAND, RUN AND ANSWERED ────────────────
  {
    const op = ownerWith(puppets);
    const r = await op.send(puppet.publicKey, 'contact.list', { of: 'all' });
    // The handler's own answer rides in r.body; r.ok and r.status are the door's.
    if (r && r.ok && r.body && r.body.got && r.body.got.of === 'all' && P.ran.indexOf('contact.list') !== -1) {
      test.check('the owner\'s signed command reaches his puppet through the real door, runs there, and its '
        + 'answer comes back to him — the positive every refusal below leans on');
    } else {
      test.fail('owner command end to end: ' + JSON.stringify(r) + ', ran ' + JSON.stringify(P.ran));
    }
  }

  // ── NOT CARRIED THERE: THE CALLER GETS THAT REFUSAL, NOT A NETWORK ONE ─
  {
    const op = ownerWith(puppets);
    const r = await op.send(puppet.publicKey, 'node.info', {});
    if (r && r.ok === false && r.code === 'not-carried-here') {
      test.check('a command for a group the puppet does not carry comes back to the caller as '
        + 'not-carried-here — "not here", never mistaken for "broken"');
    } else {
      test.fail('uncarried group reached the caller as ' + JSON.stringify(r));
    }
  }

  // ── NO ANSWER: A NAMED TIMEOUT, AND A LATE ONE IS DROPPED ──────────
  {
    const op = ownerWith(puppets, { silent: true, waitMs: 60 });
    const r = await op.send(puppet.publicKey, 'contact.list', {});
    const late = packet.encode('', { ok: true, late: true }, { re: r && r.hash }).text;
    op.onArrival({ from: puppet.publicKey, text: late });
    if (r && r.ok === false && r.status === 504 && r.code === 'no-reply-from-puppet') {
      test.check('a command nobody answers comes back as a NAMED timeout, no-reply-from-puppet, within the '
        + 'wait — and a reply arriving after it has nowhere to go');
    } else {
      test.fail('an unanswered command gave ' + JSON.stringify(r));
    }
  }

  // ── THE RIGHT HASH FROM THE WRONG PUPPET IS NOT THE ANSWER ─────────
  {
    const op = ownerWith({}, { waitMs: 80 });
    const pending = op.send(puppet.publicKey, 'contact.list', {});
    await new Promise(function (r) { setTimeout(r, 5); });
    const hash = op.sent[0] && op.sent[0].hash;
    op.onArrival({ from: other.publicKey, text: packet.encode('', { ok: true, forged: true }, { re: hash }).text });
    const r = await pending;
    if (r && r.ok === false && r.code === 'no-reply-from-puppet' && !r.forged) {
      test.check('a reply carrying the right hash but coming from a DIFFERENT puppet is not taken — the '
        + 'command times out rather than accept an answer from someone it was not sent to');
    } else {
      test.fail('an answer from the wrong puppet was taken: ' + JSON.stringify(r));
    }
  }

  // ── A REPLY ANSWERS ONCE ───────────────────────────────────────────
  {
    const op = ownerWith({}, { waitMs: 80 });
    const first = op.send(puppet.publicKey, 'contact.list', {});
    await new Promise(function (r) { setTimeout(r, 5); });
    const hash = op.sent[0].hash;
    const reply = packet.encode('', { ok: true, n: 1 }, { re: hash }).text;
    op.onArrival({ from: puppet.publicKey, text: reply });
    const got = await first;
    const second = op.send(puppet.publicKey, 'contact.list', {});
    await new Promise(function (r) { setTimeout(r, 5); });
    op.onArrival({ from: puppet.publicKey, text: reply }); // the SAME reply again
    const r2 = await second;
    if (got && got.ok && got.n === 1 && r2 && r2.code === 'no-reply-from-puppet') {
      test.check('a reply answers ONE command, once: the same reply arriving again answers nothing else');
    } else {
      test.fail('replayed reply: first ' + JSON.stringify(got) + ', second ' + JSON.stringify(r2));
    }
  }

  // ── TWO COMMANDS IN FLIGHT GET THEIR OWN ANSWERS ───────────────────
  {
    const op = ownerWith(puppets);
    const both = await Promise.all([
      op.send(puppet.publicKey, 'contact.list', { which: 'first' }),
      op.send(puppet.publicKey, 'contact.list', { which: 'second' }),
    ]);
    const which = function (x) { return x && x.body && x.body.got && x.body.got.which; };
    if (which(both[0]) === 'first' && which(both[1]) === 'second') {
      test.check('two commands in flight to one puppet each get their own answer, not each other\'s');
    } else {
      test.fail('two in flight: ' + JSON.stringify(both));
    }
  }

  // ── THE ANSWER THAT ARRIVES BEFORE THE POST RETURNS ────────────────
  //
  // The command's post resolves when the relay has it; the puppet's answer
  // is a separate packet on the same stream. They can arrive in either
  // order, and in one chunk the answer can be handled before the post's
  // continuation runs. An answer must not be lost for arriving early.
  {
    const op = ownerWith(puppets, { answerFirst: true, waitMs: 150 });
    const r = await op.send(puppet.publicKey, 'contact.list', { early: true });
    if (r && r.ok && r.body && r.body.got && r.body.got.early === true) {
      test.check('an answer that arrives BEFORE the command\'s post has returned is still taken — the '
        + 'order packets happen to arrive in cannot lose one');
    } else {
      test.fail('THE ANSWER ARRIVED FIRST AND WAS LOST: ' + JSON.stringify(r) + '. send() registers its '
        + 'waiting slot only after post() resolves, so onArrival finds no slot for an answer that is '
        + 'already here, and the owner is told the puppet never answered');
    }
  }

  test.reportSuccessFailureCount();
}());
