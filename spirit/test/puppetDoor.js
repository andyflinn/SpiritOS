'use strict';

// spirit/test/puppetDoor.js
// THE OWNER DOOR: A PUPPET RUNS WHAT ITS OWNER SIGNS, FOR THE GROUPS IT
// CARRIES, AND NOTHING ELSE (puppets/G7, slice 1).
//
//   Andy, approving the shape: "yes. that specifies my proposed boundary
//   much clearer." And on what may be reached: "the node api is orthogonal,
//   however: not every group is supported in every context/environment".
//
// Built by claude-windows at 3feddc5. Driven here through
// puppetMode.puppetDoor with the node's real packet codec and relayAuth, a
// real relay-state/owner.json on disc, and fake handlers standing in for
// loopbackVerbs. The tester read the shim once, to learn the calling
// convention a fake handler must follow (handler(req, res), req a readable
// holding the body, res catching status and body) — said here because the
// division of labour between the agents is Andy's rule.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const puppetMode = require('../run/js/puppetMode');
const auth = require('../run/js/relayAuth');
const packet = require('../run/js/client/packet');

test.startTest('A puppet runs what its owner signs, across its whole surface, and nothing else');

const owner = auth.generateIdentity('owner');
const newOwner = auth.generateIdentity('new-owner');
const stranger = auth.generateIdentity('stranger');
const self = auth.generateIdentity('puppet');

// ownerCommand.js's builder, the same signed bytes G5 checks.
function command(verb, body, signer, opts) {
  const o = opts || {};
  const id = packet.randomId();
  const cmd = JSON.stringify({ verb: verb, body: body || {} });
  const sig = o.sig !== undefined ? o.sig : auth.sign((signer || owner).privateKey,
    auth.commandMessage((signer || owner).publicKey, self.publicKey, id, cmd));
  return packet.encode('', { cmd: cmd, sig: sig }, { id: id }).text;
}

function world(puppetJson) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-puppet-door-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const file = path.join(root, 'relay-state', 'owner.json');
  if (puppetJson) fs.writeFileSync(file, JSON.stringify(puppetJson));
  const ran = [];
  const sent = [];
  const handlers = {
    'contact.list': function (req, res) {
      let text = '';
      req.on('data', function (c) { text += c; });
      req.on('end', function () {
        ran.push('contact.list');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, echo: JSON.parse(text) }));
      });
    },
    'node.info': function (req, res) { ran.push('node.info'); res.writeHead(200); res.end('{"ok":true}'); },
    // Reaches for what only a real HTTP request has — the G3 hazard. The
    // socket, since goal/G14.1: the shim carries the two headers the shared
    // body reader needs (puppetCommands.js), and still no socket.
    'contact.headers': function (req, res) { ran.push('contact.headers'); res.end(String(req.socket.remoteAddress)); },
    // Fails LATER, in its promise, as a handler reading its body would.
    'contact.later': function () { ran.push('contact.later'); return Promise.reject(new Error('failed after reading')); },
    // Answers more than a packet can carry, as jobs.list does (42,570 bytes).
    'contact.huge': function (req, res) {
      ran.push('contact.huge');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, rows: 'x'.repeat(40000) }));
    },
  };
  const door = puppetMode.puppetDoor({
    rootDir: root,
    handlerFor: function (verb) { return handlers[verb] || null; },
    post: function (relay, to, text) { sent.push({ relay: relay, to: to, reply: packet.decode(text) }); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode, isEnvelope: packet.isEnvelope,
    auth: auth,
    selfKey: function () { return self.publicKey; },
    log: function () {},
  });
  let n = 0;
  return {
    ran: ran, sent: sent, file: file,
    edit: function (doc) { fs.writeFileSync(file, JSON.stringify(doc)); },
    arrive: function (from, text) {
      n += 1;
      door({ from: from, text: text, hash: 'H' + n, relay: 'https://relay.example' });
      return new Promise(function (r) { setTimeout(r, 30); });
    },
  };
}

(async function () {
  const OWNED = { owner: owner.publicKey };

  // ── THE CONTROL: THE OWNER'S COMMAND TO A CARRIED GROUP IS RUN ──────
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('contact.list', { of: 'all' }));
    const r = w.sent[0];
    if (w.ran.join() === 'contact.list' && r && r.to === owner.publicKey && r.reply.re === 'H1'
        && r.reply.body && r.reply.body.ok && r.reply.body.body && r.reply.body.body.echo.of === 'all') {
      test.check('the owner\'s signed command to a carried group runs its handler with the body, and the '
        + 'answer goes back to him with re = the command\'s hash — the positive every refusal below leans on');
    } else {
      test.fail('owner command: ran ' + JSON.stringify(w.ran) + ', sent ' + JSON.stringify(w.sent));
    }
  }

  // ── THE WHOLE SURFACE: ANY GROUP THE OWNER SIGNS FOR RUNS ──────────
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('node.info', {}));
    const b = w.sent[0] && w.sent[0].reply.body;
    if (w.ran.join() === 'node.info' && b && b.ok) {
      test.check('a command for another group (node.info) runs too: the owner has the node\'s whole '
        + 'surface, as a loopback client would');
    } else {
      test.fail('node.info from the owner: ran ' + JSON.stringify(w.ran) + ', answer ' + JSON.stringify(b));
    }
  }

  // ── NOT A PUPPET: THE NODE BEHAVES AS ANY NODE ─────────────────────
  {
    const w = world(null);
    await w.arrive(owner.publicKey, command('contact.list', {}));
    if (!w.ran.length && !w.sent.length) {
      test.check('with no owner.json a node runs no command and answers nothing — it cannot even be '
        + 'told apart from a node that is not a puppet');
    } else {
      test.fail('a non-puppet acted: ran ' + JSON.stringify(w.ran) + ', sent ' + w.sent.length);
    }
  }

  // ── STRANGERS AND APP PACKETS: SILENCE ─────────────────────────────
  {
    const w = world(OWNED);
    await w.arrive(stranger.publicKey, command('contact.list', {}, stranger));
    await w.arrive(owner.publicKey, packet.encode('someApp', { cmd: '{"verb":"contact.list"}' }).text);
    if (!w.ran.length && !w.sent.length) {
      test.check('a stranger\'s command and an app\'s packet get silence and run nothing — answering '
        + 'strangers would tell them this node is a puppet');
    } else {
      test.fail('stranger or app packet: ran ' + JSON.stringify(w.ran) + ', sent ' + w.sent.length);
    }
  }

  // ── FROM THE OWNER'S KEY BUT NOT SIGNED BY HIM: REFUSED ────────────
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('contact.list', {}, stranger));
    const b = w.sent[0] && w.sent[0].reply.body;
    if (!w.ran.length && b && b.ok === false) {
      test.check('a command arriving from the owner\'s key but signed by someone else is refused to him '
        + 'and runs nothing (G5\'s signature rule, on the door)');
    } else {
      test.fail('forged signature: ran ' + JSON.stringify(w.ran) + ', answer ' + JSON.stringify(b));
    }
  }

  // ── A NEW OWNER IS OBEYED AT ONCE; THE OLD ONE IS NOT ──────────────
  {
    const w = world(OWNED);
    w.edit({ owner: newOwner.publicKey });
    await w.arrive(owner.publicKey, command('contact.list', {}));
    const oldRan = w.ran.length;
    await w.arrive(newOwner.publicKey, command('contact.list', {}, newOwner));
    if (oldRan === 0 && w.ran.length === 1) {
      test.check('after the owner changes owner.json, the very next command obeys the new owner and the '
        + 'old one runs nothing — read on every arrival, no restart');
    } else {
      test.fail('owner edit: old owner ran ' + oldRan + ', new owner total ' + w.ran.length);
    }
  }

  // ── NO SUCH VERB: NAMED ────────────────────────────────────────────
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('contact.nothingLikeThis', {}));
    const b = w.sent[0] && w.sent[0].reply.body;
    if (b && b.code === 'no-such-verb') {
      test.check('a carried group but an unknown verb is refused by name, no-such-verb');
    } else {
      test.fail('unknown verb answered ' + JSON.stringify(b));
    }
  }

  // ── A HANDLER THAT FAILS AT ONCE FAILS ALONE ───────────────────────
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('contact.headers', {}));
    const failed = w.sent[0] && w.sent[0].reply.body;
    await w.arrive(owner.publicKey, command('contact.list', {}));
    if (failed && failed.code === 'handler-failed' && w.ran.indexOf('contact.list') !== -1) {
      test.check('a handler that reaches for a real request\'s socket fails ALONE: that command is '
        + 'refused handler-failed, and the next command runs normally (the G3 hazard)');
    } else {
      test.fail('sync failure: answer ' + JSON.stringify(failed) + ', then ran ' + JSON.stringify(w.ran));
    }
  }

  // ── A HANDLER THAT FAILS LATER MUST FAIL ALONE TOO ─────────────────
  //
  // Real handlers read their body asynchronously, so their failures arrive
  // as a rejected promise, after the shim's try/catch has returned. Left
  // unhandled, a rejection stops the Node process by default — the whole
  // node, for one bad command. The owner should get handler-failed, as for
  // a failure that happens at once.
  {
    const w = world(OWNED);
    let escaped = 0;
    const onRej = function () { escaped += 1; };
    process.on('unhandledRejection', onRej);
    await w.arrive(owner.publicKey, command('contact.later', {}));
    await new Promise(function (r) { setTimeout(r, 50); });
    process.removeListener('unhandledRejection', onRej);
    const b = w.sent[0] && w.sent[0].reply.body;
    if (!escaped && b && b.code === 'handler-failed') {
      test.check('a handler that fails LATER, in its promise, is caught too: the owner gets '
        + 'handler-failed and nothing escapes to take the node down');
    } else {
      test.fail('a handler failing in its promise: ' + (escaped ? escaped + ' rejection(s) ESCAPED the door, '
        + 'which in a real node stops the process for one bad command' : 'nothing escaped')
        + '; the owner got ' + JSON.stringify(b || 'no answer at all'));
    }
  }

  // ── AN ANSWER TOO BIG FOR A PACKET IS REFUSED BY NAME, NOT DROPPED ──
  //
  // packet.encode refuses an oversize body, and reply() used to return on
  // that refusal and send nothing, so the owner waited out the whole timeout
  // and was told "no reply from puppet". Agreed with claude-windows,
  // 2026-09-27: {ok:false, status:413, code:'answer-too-large', verb, bytes}.
  {
    const w = world(OWNED);
    await w.arrive(owner.publicKey, command('contact.huge', {}));
    const b = w.sent[0] && w.sent[0].reply.body;
    const fine = world(OWNED);
    await fine.arrive(owner.publicKey, command('contact.list', { of: 'small' }));
    const ok = fine.sent[0] && fine.sent[0].reply.body;
    if (b && b.ok === false && b.status === 413 && b.code === 'answer-too-large' && b.verb === 'contact.huge'
        && b.bytes > 40000 && w.ran.join() === 'contact.huge' && ok && ok.ok) {
      test.check('an answer too big for a packet reaches the owner as answer-too-large, naming the verb and its '
        + b.bytes + ' bytes, instead of silence; a small answer still arrives whole');
    } else {
      test.fail('AN OVERSIZE ANSWER WAS ' + (w.sent.length ? 'answered as ' + JSON.stringify(b) : 'DROPPED: nothing '
        + 'was sent back, so the owner times out with no-reply-from-puppet and never learns why')
        + '. The handler ran: ' + JSON.stringify(w.ran));
    }
  }

  test.reportSuccessFailureCount();
}());
