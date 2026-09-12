'use strict';

// spirit/run/js/presence.js
// Who is connected to this relay, right now. In RAM, never written to
// disk — presence is true only while a socket is open, and written down
// it is a record of something that has stopped being true.
//
// Its own file rather than another subsystem inside relay.js, for the
// same reason the device handshake was its own file while it existed: the
// relay should not grow a second thing it has to remember.
//
// THE CONNECTION IS THE PRESENCE. There is no announce message, no
// heartbeat protocol, no last-seen timestamp and no timeout to tune. A
// socket dying is an absence. That is the whole design, and everything
// below is bookkeeping around it.
//
// No `http` in this file. A `sink` is anything that can be written to and
// closed, which is a response object in production and an object with two
// functions in a test.

var DEFAULT_PER_MIN = 6;

function createRegistry(opts) {
  opts = opts || {};
  var nowFn = opts.now || Date.now;
  // Six rather than the ten a device enrolment gets, because the traffic
  // is a different kind. A device offer is a person pressing a button; a
  // connect is a machine in a loop. A healthy node spends one of these
  // and holds it for days, a flapping network spends a handful, and a
  // backoff bug spends all six in a second — which is the case this
  // exists for. An exponential backoff is meant to prevent a connect
  // storm and is also what produces one when it is wrong.
  var perMin = opts.perMin || DEFAULT_PER_MIN;

  // id -> sink. One each: a second connect replaces the first.
  var sinks = Object.create(null);
  // id -> [timestamps]
  var hits = Object.create(null);

  function rateOk(id) {
    var t = nowFn();
    var seen = (hits[id] || []).filter(function (h) { return t - h < 60000; });
    if (seen.length >= perMin) {
      hits[id] = seen;
      return false;
    }
    seen.push(t);
    hits[id] = seen;
    return true;
  }

  function close(sink) {
    if (!sink || typeof sink.close !== 'function') return;
    // A sink that throws on close must not take the caller down with it —
    // this runs while somebody else is connecting, and their connect is
    // not answerable for the state of a socket that is already dying.
    try { sink.close(); } catch (e) { /* already gone */ }
  }

  function write(sink, event, data) {
    if (!sink || typeof sink.write !== 'function') return false;
    try {
      sink.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
      return true;
    } catch (e) {
      return false;
    }
  }

  // NEWEST WINS. The relay does not worry about the node's problems
  // (Andy): a node reconnecting after a half-dead socket must not be
  // locked out by its own corpse, so the old one goes and no opinion is
  // formed about why there was one.
  //
  // The caller must have AUTHENTICATED before reaching here. That order
  // is the whole safety of it — if an unauthenticated connect could
  // displace a live one, anybody could knock any peer offline by
  // connecting badly in their name.
  function connect(id, sink) {
    if (!id || !sink) return { ok: false, status: 403 };
    if (!rateOk(id)) return { ok: false, status: 429 };
    var old = sinks[id];
    if (old && old !== sink) close(old);
    sinks[id] = sink;
    return { ok: true, status: 200, replaced: !!(old && old !== sink) };
  }

  // Idempotent, and it has to be: both `close` and `error` fire on a
  // dying socket and both call this. The sink check matters too — a
  // teardown arriving late, after the same identity reconnected, must
  // not evict the NEW connection.
  function disconnect(id, sink) {
    if (!id) return false;
    if (sink && sinks[id] !== sink) return false;
    if (!sinks[id]) return false;
    delete sinks[id];
    return true;
  }

  function isPresent(id) {
    return !!id && !!sinks[id];
  }

  function present() {
    return Object.keys(sinks);
  }

  function send(id, event, data) {
    return write(sinks[id], event, data);
  }

  // A sink that fails to take a write is gone, whatever it claims. It is
  // dropped here rather than left to a teardown that may never come —
  // the alternative is a peer reading as present forever, which is the
  // relay lying and the one thing it must not do.
  function broadcast(event, data) {
    var sent = 0;
    Object.keys(sinks).forEach(function (id) {
      if (write(sinks[id], event, data)) sent += 1;
      else delete sinks[id];
    });
    return sent;
  }

  function reset() {
    Object.keys(sinks).forEach(function (id) { close(sinks[id]); });
    sinks = Object.create(null);
    hits = Object.create(null);
  }

  return {
    connect: connect,
    disconnect: disconnect,
    isPresent: isPresent,
    present: present,
    send: send,
    broadcast: broadcast,
    reset: reset,
    perMin: perMin,
  };
}

module.exports = {
  createRegistry: createRegistry,
  DEFAULT_PER_MIN: DEFAULT_PER_MIN,
};
