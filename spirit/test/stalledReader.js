'use strict';

// spirit/test/stalledReader.js
// A MEMBER WHO HAS STOPPED READING IS CUT LOOSE, AND NOBODY IS LEFT
// WAITING ON THEM (R35).
//
//   Andy: "if the output buffer goes past 2x MAX_FULL_PACKET, shouldn't
//   the relay just send a disconnect, then cut the connection loose?"
//   — "checking if a pending foreign request is still pending, so that
//   one can be returned with an error" — "and vice versa".
//
// Three parts. The bound the cut is measured against is checked against a
// built worst case, not believed. The cut is proved on a REAL socket,
// because the whole premise — that Node keeps accepting writes nobody is
// reading, and `writableLength` shows it — is a claim about the platform.
// And the routes a cut member leaves are settled, both ways.

const net = require('net');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const limits = require('../run/js/limits');
const streamSink = require('../run/js/streamSink');
const world = require('./world');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function fakeSink() {
  const sink = { lines: [] };
  sink.write = function (chunk) { sink.lines.push(chunk); };
  sink.close = function () {};
  sink.stalled = function () { return false; };
  sink.last = function (name) {
    let found = null;
    sink.lines.forEach(function (chunk) {
      const ev = /event: (.*)/.exec(chunk);
      const da = /data: (.*)/.exec(chunk);
      if (!ev || ev[1] !== name) return;
      try { found = da ? JSON.parse(da[1]) : null; } catch (e) { found = null; }
    });
    return found;
  };
  return sink;
}

function openStream(box, id, sink) {
  return box.streamOpen(id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sink);
}

function ping(box, from, to, text) {
  const msg = auth.postMessage(from.publicKey, to.publicKey, text);
  return {
    hash: auth.requestHash(msg),
    result: box.routePost(from.publicKey, to.publicKey, text, auth.sign(from.privateKey, msg)),
  };
}

// A held stream on a real socket, fed one packet every `everyMs` until it
// is cut or `max` have gone. The client decides whether it reads.
//
// A BARE TCP SOCKET, NOT AN HTTP SERVER, and the difference is none that
// matters here: once the head is out, a ServerResponse writes straight
// to its socket, and its `writableLength` is the socket's plus whatever
// it holds itself (Node's OutgoingMessage). The claim under test is the
// socket's — that it keeps accepting what nobody reads — and this suite
// stays out of the oneDoor roll, which counts HTTP reaches and would
// need a line granted for a fixture that asks nothing of anybody.
function streamServer() {
  const state = { sink: null, written: 0, cutAt: null };
  const server = net.createServer(function (socket) {
    socket.on('error', function () { /* the cut */ });
    const res = {
      writeHead: function () { socket.write('HTTP/1.1 200 OK\r\n\r\n'); },
      write: function (chunk) { return socket.write(chunk); },
      end: function () { socket.end(); },
      destroy: function () { socket.destroy(); },
      get writableLength() { return socket.writableLength; },
    };
    state.sink = streamSink.createStreamSink(res, {
      onStall: function (backlog) { state.cutAt = backlog; },
    });
  });
  return { server: server, state: state };
}

async function feed(state, packet, everyMs, max) {
  for (let i = 0; i < max; i++) {
    if (!state.sink) { await sleep(5); i--; continue; }
    try { state.sink.write(packet); state.written += packet.length; }
    catch (e) { return 'cut'; }
    if (everyMs) await sleep(everyMs);
    else if (i % 16 === 0) await sleep(0);
  }
  return 'done';
}

test.startTest('A reader that stops reading is cut loose');

async function run() {
  test.subHeading('The bound: what one packet can cost on a stream');

  {
    // THE WORST CASE THAT IS SAYABLE: a text at the payload limit made
    // entirely of a control character, which JSON writes as six bytes.
    // Nothing refuses it — the relay checks a text's length, not its
    // alphabet — so the bound has to hold for it.
    const key = 'K'.repeat(60);
    const worst = 'event: request\ndata: ' + JSON.stringify({
      from: key, to: key, text: '\u0001'.repeat(limits.PAYLOAD_MAX), sig: 'S'.repeat(88),
    }) + '\n\n';
    const bytes = Buffer.byteLength(worst);
    if (bytes <= limits.STREAM_EVENT_MAX && bytes > 5 * limits.PAYLOAD_MAX) {
      test.check('the largest event one packet can make (' + bytes + ' B) fits STREAM_EVENT_MAX (' +
        limits.STREAM_EVENT_MAX + ' B), and the six is not slack');
    } else {
      test.fail('worst event is ' + bytes + ' B against a bound of ' + limits.STREAM_EVENT_MAX);
    }
    if (limits.STREAM_BACKLOG_MAX === 2 * limits.STREAM_EVENT_MAX) {
      test.check('and the backlog a stream may hold is two of them');
    } else {
      test.fail('STREAM_BACKLOG_MAX is ' + limits.STREAM_BACKLOG_MAX);
    }
  }

  const packet = 'event: request\ndata: ' + JSON.stringify({ text: 'x'.repeat(limits.PAYLOAD_MAX) }) + '\n\n';

  test.subHeading('On a real socket: a reader that stops is cut');

  {
    const s = streamServer();
    await new Promise(function (r) { s.server.listen(0, '127.0.0.1', r); });
    const port = s.server.address().port;

    // A client that connects and then never reads a byte.
    const client = net.connect(port, '127.0.0.1');
    let closed = false;
    client.on('close', function () { closed = true; });
    client.on('error', function () { /* the cut */ });
    client.pause();

    // 50 MB offered. Without the cut, all of it would sit in this process.
    const how = await feed(s.state, packet, 0, 3200);
    await sleep(50);

    if (how === 'cut' && s.state.cutAt !== null) {
      test.check('the stream is cut after ' + Math.round(s.state.written / 1024) +
        ' KB offered, not after the 50 MB it would otherwise have taken');
    } else {
      test.fail('never cut: ' + how + ', ' + s.state.written + ' B written');
    }
    if (s.state.cutAt !== null && s.state.cutAt <= limits.STREAM_BACKLOG_MAX + packet.length) {
      test.check('with ' + Math.round(s.state.cutAt / 1024) + ' KB held in the process — the backlog bound plus the packet that tipped it');
    } else {
      test.fail('held ' + s.state.cutAt + ' B at the cut');
    }

    // NO GOODBYE IS SENT, only the cut: the client learns by the socket
    // closing, which reaches it whether or not it reads.
    client.resume();
    await sleep(100);
    if (closed) {
      test.check('and the reader finds its connection closed — the one signal that reaches a reader that is not reading');
    } else {
      test.fail('the client never saw the close');
    }

    let refused = false;
    try { s.state.sink.write(packet); } catch (e) { refused = true; }
    if (refused) {
      test.check('a cut sink refuses further writes, so a delivery to it reads as not delivered');
    } else {
      test.fail('the cut sink accepted a write');
    }
    client.destroy();
    s.server.close();
  }

  test.subHeading('On a real socket: a reader that is only slow is not');

  {
    const s = streamServer();
    await new Promise(function (r) { s.server.listen(0, '127.0.0.1', r); });
    const port = s.server.address().port;

    let got = 0;
    const client = net.connect(port, '127.0.0.1');
    client.on('data', function (d) { got += d.length; });
    client.on('error', function () {});

    // Reads in fits: half the time paused, half the time reading.
    let slow = true;
    (async function () {
      while (slow) { client.pause(); await sleep(25); client.resume(); await sleep(25); }
    })();

    const how = await feed(s.state, packet, 5, 120);
    await sleep(300);
    slow = false;
    client.resume();
    await sleep(100);

    if (how === 'done' && s.state.cutAt === null && got >= s.state.written) {
      test.check('a reader that pauses half the time takes all ' + Math.round(s.state.written / 1024) +
        ' KB, a full packet every 5 ms, and is never cut');
    } else {
      test.fail('slow reader: ' + how + ', cut at ' + s.state.cutAt + ', got ' + got + ' of ' + s.state.written);
    }
    client.destroy();
    s.server.close();
  }

  test.subHeading('The routes a cut member leaves: asked of them');

  const L = world.build({ title: 'three members', peers: ['bert', 'john', 'mary'] });
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); process.exit(1); }
  const bert = L.peer('bert');
  const john = L.peer('john');
  const mary = L.peer('mary');
  const bertSink = fakeSink();
  const johnSink = fakeSink();
  const marySink = fakeSink();
  openStream(L.box, bert, bertSink);
  openStream(L.box, john, johnSink);
  openStream(L.box, mary, marySink);

  {
    // bert asks john; john's stream is cut before he could have read it.
    const sent = ping(L.box, bert, john, '{"ping":1}');
    if (!sent.result.ok) test.fail('post refused: ' + JSON.stringify(sent.result));

    L.box.streamClose(john.publicKey, johnSink, 'stalled');

    const told = bertSink.last('reply');
    let said = null;
    try { said = JSON.parse(told.text).body; } catch (e) { said = null; }
    if (told && told.hash === sent.hash && said && said.status === 503 &&
        said.error === 'peer not reachable' && said.relayed === true) {
      test.check('the asker is told at once, for the hash it holds: peer not reachable');
    } else {
      test.fail('bert was told: ' + JSON.stringify(told));
    }
    // Signed by the relay, never passed off as john's receipt.
    if (told && told.from === L.box.relayPublicKey() &&
        auth.receiptSignatureOk(told.from, told.hash, told.sig)) {
      test.check('and the reply is signed by the relay, so the node cannot take it for the target\'s answer');
    } else {
      test.fail('reply signed by ' + (told && told.from));
    }
    if (!L.box.presence.isPresent(john.publicKey)) {
      test.check('and the member who stopped reading is absent — which the error says, and is true');
    } else {
      test.fail('john still reads as present after the cut');
    }
  }

  test.subHeading('The routes a cut member leaves: asked by them');

  {
    // mary asks bert; mary's stream is cut; bert answers anyway.
    const sent = ping(L.box, mary, bert, '{"ping":2}');
    if (!sent.result.ok) test.fail('post refused: ' + JSON.stringify(sent.result));

    L.box.streamClose(mary.publicKey, marySink, 'stalled');

    const answered = L.box.routeReply(bert.publicKey, sent.hash, '{"ack":2}',
      auth.sign(bert.privateKey, auth.receiptMessage(sent.hash)));
    if (answered && !answered.ok && answered.status === 404 && answered.error === 'no such request') {
      test.check('the target\'s late answer meets "no such request" rather than a stream that is not there');
    } else {
      test.fail('bert\'s answer got: ' + JSON.stringify(answered));
    }
  }

  test.subHeading('An ordinary close settles nothing');

  {
    // A member whose stream merely dropped may still answer by POST —
    // /reply needs no stream — so its routes must survive the close.
    const L2 = world.build({ title: 'two members', peers: ['ann', 'bob'] });
    const ann = L2.peer('ann');
    const bob = L2.peer('bob');
    const annSink = fakeSink();
    const bobSink = fakeSink();
    openStream(L2.box, ann, annSink);
    openStream(L2.box, bob, bobSink);

    const sent = ping(L2.box, ann, bob, '{"ping":3}');
    L2.box.streamClose(bob.publicKey, bobSink);

    const early = annSink.last('reply');
    const answered = L2.box.routeReply(bob.publicKey, sent.hash, '{"ack":3}',
      auth.sign(bob.privateKey, auth.receiptMessage(sent.hash)));
    if (!early && answered && answered.ok) {
      test.check('a member whose stream closed can still answer what it read, and nobody was told otherwise first');
    } else {
      test.fail('early: ' + JSON.stringify(early) + ', answer: ' + JSON.stringify(answered));
    }
  }

  test.reportSuccessFailureCount();
  process.exit(0);
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
