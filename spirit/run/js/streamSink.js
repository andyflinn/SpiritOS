'use strict';

// spirit/run/js/streamSink.js
// The sink a relay hands to relay.js for one held stream — and the one
// place that notices when the far end has stopped reading (R35).
//
//   Andy: "if the output buffer goes past 2x MAX_FULL_PACKET, shouldn't
//   the relay just send a disconnect, then cut the connection loose?"
//
// NO DISCONNECT IS SENT, only the cut. A reader that has stopped will not
// read a goodbye either: anything written now lands behind the bytes it
// is already not reading. The socket closing is the only signal that
// reaches it.
//
// WHY IT HAD TO EXIST. `res.write` returns false once the kernel's send
// buffer is full and keeps accepting anyway — Node holds the rest in the
// process, without limit. Every cap on this relay counts REQUESTS, and a
// member who has stopped reading costs memory without making one: each
// packet aimed at them, each heartbeat and presence event, stays in this
// process until the TCP connection dies, which a live peer that simply
// does not read never lets happen.
//
// Moved out of relayServer.js so it can be tested against a real socket
// without booting a relay.

const limits = require('./limits');

// `res` is the held response. `onStall(backlog)` is called once, on the
// next turn after the socket is destroyed, with the backlog that tripped
// it. `stalled()` says whether this sink was cut for not reading, which
// is what a teardown reached by the socket's own 'close' has to ask.
function createStreamSink(res, opts) {
  opts = opts || {};
  const backlogMax = opts.backlogMax || limits.STREAM_BACKLOG_MAX;
  const onStall = typeof opts.onStall === 'function' ? opts.onStall : function () {};

  // THE HEAD IS WRITTEN LAZILY, on the first write, and that is not a
  // micro-optimisation. It shipped the other way — head first, so the
  // roster had somewhere to go — and a refusal then had to travel as
  // an event inside a 200, because the status line was already spent.
  // A client cannot see a status the server has committed to, so every
  // refusal looked to it like a connection that opened and closed, it
  // reset its backoff on that, and a stale credential became a
  // one-per-second hammer against a relay that was refusing it.
  //
  // Written this way the gate answers first and a refusal is a 403 that
  // says so.
  let headed = false;
  let stalled = false;

  return {
    write: function (chunk) {
      // A cut stream takes nothing more: presence.write reads a throw as
      // "not delivered", which is what it is.
      if (stalled) throw new Error('stream cut: the reader stopped reading');
      if (!headed) {
        headed = true;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
      }
      res.write(chunk);
      // Checked AFTER the write, so the backlog measured includes the
      // packet that tipped it — which is the one that will now never
      // arrive, and the caller learns so from the throw below.
      const backlog = res.writableLength || 0;
      if (backlog > backlogMax) {
        stalled = true;
        try { res.destroy(); } catch (e) { /* already gone */ }
        // DEFERRED, because this write is usually somebody's delivery:
        // routes.open is inside it with the route filed. Tearing down now
        // would answer that asker twice — once from the teardown, once as
        // the 502 open() returns when this throw makes the delivery fail.
        setImmediate(function () { onStall(backlog); });
        throw new Error('stream cut: the reader stopped reading');
      }
    },
    close: function () { try { res.end(); } catch (e) { /* gone */ } },
    stalled: function () { return stalled; },
  };
}

module.exports = { createStreamSink };
