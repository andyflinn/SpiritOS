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

// ── TELLING WHOEVER IS LISTENING THAT THIS PROCESS IS GOING ───────────
//
//   Andy: "node and relay must have these safeguards, from the same
//   code?"
//
// Yes, and this is that code — outside `createRegistry` on purpose. A
// RELAY's listeners are members, held in a registry keyed by identity. A
// NODE's listener is its own browser on /api/events, which is a plain
// response in a Set and has no identity, no rate limit and no presence.
// Two very different books, one thing to say when the lights go out, so
// the saying is a function over sinks and not a method on either book.
//
// `retry:` is SSE's own field for when to reconnect. The browser's
// EventSource honours it with no code of ours at all, and sseClient
// honours it for a node or a partner relay — so one write serves every
// listener this system has.
//
// Bounded the same way the parser bounds what it will accept, because the
// two numbers have to agree about what is sayable.
function sayGoingAway(sinkList, backInMs) {
  var ms = Math.max(0, Math.min(3600000, Math.round(backInMs || 0)));
  var told = 0;
  (sinkList || []).forEach(function (sink) {
    if (!sink || typeof sink.write !== 'function') return;
    try {
      sink.write('retry: ' + ms + '\n\n');
      told += 1;
    } catch (e) { /* already gone, and nothing to do about it */ }
  });
  // CLOSED HERE rather than left to the process exiting, so the FIN is
  // this process's decision and arrives BEHIND the hint. A socket the
  // kernel reaps on exit would race the write.
  (sinkList || []).forEach(function (sink) {
    if (!sink || typeof sink.close !== 'function') return;
    try { sink.close(); } catch (e) { /* already gone */ }
  });
  return told;
}

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

  // ── GOING AWAY, ON PURPOSE ─────────────────────────────────────────
  //
  //   Andy: "can a relay that knows it's shutting down send a message down
  //   the SSE connections to prepare its counterparts to re-connect?"
  //
  // It can, and `retry:` is the field for it — part of SSE, so nothing new
  // crosses the wire and no client needs to be taught a word.
  //
  // WHAT IT BUYS, since a clean exit already closes the sockets and the
  // clients already come back. Pacing. A relay with a hundred members that
  // simply dies gets a hundred reconnects about a second later, jittered
  // across half a second — all of them landing while the box is still
  // BOOTING, all refused, all backing off further. `bash/update` restarts
  // a relay every time it takes a tag, so this is a routine Tuesday.
  // Telling them to come back in three seconds means the first attempt
  // arrives when there is something to attach to.
  //
  // IT CANNOT HELP AN UNPLANNED DEATH — a box that is killed says nothing.
  // That case is the idle watchdog's, and the two are complements: this
  // makes a restart invisible, the watchdog makes a disappearance finite.
  function goingAway(backInMs) {
    var told = sayGoingAway(Object.keys(sinks).map(function (id) { return sinks[id]; }), backInMs);
    sinks = Object.create(null);
    return told;
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
    goingAway: goingAway,
    reset: reset,
    perMin: perMin,
  };
}

module.exports = {
  createRegistry: createRegistry,
  sayGoingAway: sayGoingAway,
  DEFAULT_PER_MIN: DEFAULT_PER_MIN,
};
