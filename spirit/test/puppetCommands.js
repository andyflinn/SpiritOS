'use strict';

// spirit/test/puppetCommands.js
// AN OWNER COMMAND REACHES A VERB THAT READS ITS BODY — goal/G14.1, written first, red on today's code.
//
//   Andy, 2026-10-10: "First we fix the puppet-issue", "all changes required to make puppeteering work".
//
// Found live the same day, from his node to his puppet on 11111: owner.command with jobs.api came back on the
// command's hash, as the door promises, and the answer was 400 bad-request, Invalid JSON body. The cause: the shim
// in puppetMode.puppetDoor hands the verb a request stream with no headers, and every verb in the node reads its
// body through the one shared reader, serveCommon.readJsonBody, which begins by reading content-length off the
// headers and throws before it parses. puppetDoor.js never saw it because its handlers are fakes that read the
// stream by hand. This suite drives the same door with handlers that read through the real reader.
//
// Held here: a command with a body is answered with what the body held, verb included; a command with no body
// parses to the verb alone; the request the shim hands over carries the two headers the reader needs, content-type
// application/json and the body's content-length in bytes; and a handler that reaches for the socket still fails
// alone (G3), which this suite does not weaken.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const puppetMode = require('../run/js/puppetMode');
const auth = require('../run/js/relayAuth');
const packet = require('../run/js/client/packet');
const common = require('../run/js/serveCommon');

const OWED = 'OWED by goal/G14.1: ';

test.startTest('goal/G14.1: an owner command reaches a verb that reads its body through the shared reader');

const owner = auth.generateIdentity('owner');
const self = auth.generateIdentity('puppet');

function command(verb, body) {
  const id = packet.randomId();
  const cmd = JSON.stringify({ verb: verb, body: body || {} });
  const sig = auth.sign(owner.privateKey, auth.commandMessage(owner.publicKey, self.publicKey, id, cmd));
  return packet.encode('', { cmd: cmd, sig: sig }, { id: id }).text;
}

function answerJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function world() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-puppet-commands-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'owner.json'), JSON.stringify({ owner: owner.publicKey }));
  const sent = [];
  const seen = [];
  const handlers = {
    // The shape every node verb has: the body through the shared reader, the answer as json.
    'jobs.echo': function (req, res) {
      return common.readJsonBody(req).then(function (b) { answerJson(res, 200, { ok: true, got: b }); },
        function () { answerJson(res, 400, { ok: false, code: 'bad-request', error: 'Invalid JSON body' }); });
    },
    // What the shim hands over, as the reader sees it.
    'jobs.headers': function (req, res) {
      seen.push({ headers: req.headers ? Object.assign({}, req.headers) : null, socket: req.socket === undefined ? 'none' : 'some' });
      return common.readJsonBody(req).then(function (b) {
        answerJson(res, 200, { ok: true, bytes: common.bodyBytes(req), got: b });
      }, function (e) { answerJson(res, 400, { ok: false, error: String(e && e.message) }); });
    },
    // G3: a handler that reaches for the socket fails alone, now as before.
    'jobs.socket': function (req, res) { res.end(String(req.socket.remoteAddress)); },
  };
  const door = puppetMode.puppetDoor({
    rootDir: root,
    handlerFor: function (verb) { return handlers[verb] || null; },
    post: function (relay, to, text) { sent.push({ to: to, reply: packet.decode(text) }); return Promise.resolve({ ok: true }); },
    encode: packet.encode, decode: packet.decode, isEnvelope: packet.isEnvelope,
    auth: auth,
    selfKey: function () { return self.publicKey; },
    log: function () {},
  });
  let n = 0;
  return {
    sent: sent, seen: seen,
    arrive: function (text) {
      n += 1;
      door({ from: owner.publicKey, text: text, hash: 'H' + n, relay: 'https://relay.example' });
      return new Promise(function (r) { setTimeout(r, 40); });
    },
  };
}

(async function () {
  // ── 1. A COMMAND WITH A BODY IS ANSWERED WITH WHAT THE BODY HELD ─────
  {
    const w = world();
    await w.arrive(command('jobs.echo', { ask: 'api', n: 7 }));
    const r = w.sent[0] && w.sent[0].reply;
    const b = r && r.body && r.body.body;
    if (r && r.re === 'H1' && r.body && r.body.ok === true && b && b.ok === true && b.got && b.got.ask === 'api' && b.got.n === 7 && b.got.verb === 'jobs.echo') {
      test.check('an owner command carrying {ask, n} reaches a verb that reads its body through readJsonBody, and the answer holds ask, n and the verb, on the command\'s hash');
    } else {
      test.fail(OWED + 'the body did not reach the verb: ' + JSON.stringify(r).slice(0, 300));
    }
  }

  // ── 2. NO BODY: THE VERB ALONE ──────────────────────────────────────
  {
    const w = world();
    await w.arrive(command('jobs.echo', {}));
    const b = w.sent[0] && w.sent[0].reply.body && w.sent[0].reply.body.body;
    if (b && b.ok === true && b.got && b.got.verb === 'jobs.echo' && Object.keys(b.got).length === 1) {
      test.check('a command with an empty body parses to the verb alone');
    } else {
      test.fail(OWED + 'an empty body: ' + JSON.stringify(w.sent[0] && w.sent[0].reply).slice(0, 300));
    }
  }

  // ── 3. THE HEADERS THE READER NEEDS, AND NO SOCKET ─────────────────
  {
    const w = world();
    const body = { ask: { deskClient: { next: {} } } };
    await w.arrive(command('jobs.headers', body));
    const text = JSON.stringify(Object.assign({}, body, { verb: 'jobs.headers' }));
    const want = Buffer.byteLength(text, 'utf8');
    const s = w.seen[0] || {};
    const h = s.headers || {};
    const b = w.sent[0] && w.sent[0].reply.body && w.sent[0].reply.body.body;
    if (h['content-type'] === 'application/json' && Number(h['content-length']) === want && s.socket === 'none' && b && b.ok === true && b.bytes === want) {
      test.check('the request the shim hands over carries content-type application/json and content-length ' + want + ', the body\'s bytes, and still no socket');
    } else {
      test.fail(OWED + 'the shim\'s request: headers ' + JSON.stringify(s.headers) + ', socket ' + s.socket + ', answer ' + JSON.stringify(b).slice(0, 200));
    }
  }

  // ── 4. G3 STANDS: A HANDLER REACHING FOR THE SOCKET FAILS ALONE ─────
  {
    const w = world();
    await w.arrive(command('jobs.socket', {}));
    await w.arrive(command('jobs.echo', { after: true }));
    const first = w.sent[0] && w.sent[0].reply.body;
    const second = w.sent[1] && w.sent[1].reply.body && w.sent[1].reply.body.body;
    if (first && first.ok === false && first.code === 'handler-failed' && second && second.ok === true && second.got && second.got.after === true) {
      test.check('a handler that reaches for the socket is refused handler-failed, and the next command runs untouched (G3)');
    } else {
      test.fail('G3: first ' + JSON.stringify(first).slice(0, 160) + ', second ' + JSON.stringify(second).slice(0, 160));
    }
  }

  test.reportSuccessFailureCount();
}()).catch(function (e) {
  test.fail('the suite itself failed: ' + ((e && e.stack) || e));
  test.reportSuccessFailureCount();
});
