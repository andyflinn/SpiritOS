'use strict';

// spirit/run/js/sseClient.js
// Reading Server-Sent Events from node, which has no client for them.
//
// SSE is less than the name suggests: an ordinary HTTP GET whose response
// never ends. The server writes `event:` and `data:` lines separated by
// blank lines, and a lone `:` is a comment used as a heartbeat so nothing
// in between decides an idle connection is dead. That is the whole
// protocol, so this is a parser and a reconnect loop and nothing else.
//
// WHY NOT `EventSource`. The browser has one and kernel.js already wraps
// it for the shell. Node 24 has one behind --experimental-eventsource.
// Neither is usable here, and the reason is a rule rather than a taste:
// **EventSource cannot set request headers**, and the proof for a relay
// read rides in X-Spirit-Sig and never the query string, because a query
// string is written to every access log the request passes —
// inboxSignatureFrom refuses a query `sig` outright. An EventSource
// client could not authenticate to a relay without undoing that.
// (design/relay/PRESENCE.md §4.)
//
// No relay concepts in this file. It is given a URL, headers and a
// callback, and it knows nothing about presence, keys or signatures.

// Doubling from a second, capped at half a minute. The cap matters more
// than the curve: a relay that is down must not be hammered, and a node
// that has been asleep must not take ten minutes to notice it is back.
var FIRST_RETRY_MS = 1000;

// CLINGY. Andy: "the sseClient needs to be clingy."
//
// This was 30 seconds, on the reasoning that a relay which is down must
// not be hammered. True, and it answered the wrong question: the case that
// actually happens is not a relay that is DOWN, it is a relay that is
// RESTARTING — `bash/update` restarts one every time it takes a tag, and
// that gap is two to five seconds. Waiting thirty is a node asleep through
// four of them.
//
// Eight seconds is the worst a node waits to find a relay that came back.
// A relay that is genuinely gone costs one request per node per eight
// seconds, which is a rounding error next to a member's ordinary traffic —
// and the jitter below is what stops those requests arriving together.
var MAX_RETRY_MS = 8000;

// ── HOW LONG SILENCE IS ALLOWED TO LAST ──────────────────────────────
//
//   Andy: "when a partner receives a connect request from a partner, does
//   it verify the health of its own connect/sseReader?"
//
// It could not. `await reader.read()` blocks until bytes arrive or the
// socket errors, and a HALF-OPEN connection does neither: the peer is
// gone — a killed VM, a dropped NAT mapping, a firewall reaping an idle
// flow — but no FIN ever arrived, so the read never returns and never
// throws. Nothing fails, so the retry loop never fires, and the client
// believes it is attached FOREVER.
//
// That is the worst shape a failure can take here and it is the one the
// backoff work above cannot help with: being clingy about reconnecting is
// no use to a client that does not know it has been disconnected.
//
// The relay writes `:` every twenty seconds for exactly this purpose, and
// until now the only thing listening was a proxy. Three missed in a row is
// a connection to nobody.
var IDLE_MS = 65000;

function parseChunk(text) {
  // One SSE message: any number of field lines, terminated by a blank
  // line. A line starting with `:` is a comment — the heartbeat — and
  // carries no data, which is the one case a naive parser reports as an
  // event with an empty name.
  var event = 'message';
  var data = [];
  var retry = null;
  text.split('\n').forEach(function (line) {
    if (!line || line.charAt(0) === ':') return;
    var colon = line.indexOf(':');
    var field = colon === -1 ? line : line.slice(0, colon);
    var value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    // `retry:` IS IN THE SPEC and was being dropped on the floor. It is
    // the server saying when to come back, in milliseconds.
    //
    //   Andy: "can a relay that knows it's shutting down send a message
    //   down the SSE connections to prepare its counterparts to
    //   re-connect?"
    //
    // It can, and it needs no message of its own — this is the field for
    // exactly that, which is why honouring it adds no relay concept to a
    // file that must not have one.
    //
    // Bounded at an hour: the value arrives from whatever is on the other
    // end of the socket, and a client that accepted `retry: 999999999`
    // would have been told to go away for eleven days by anything that
    // could get a frame in front of it.
    else if (field === 'retry') {
      var ms = parseInt(value, 10);
      if (ms >= 0 && ms < 3600000) retry = ms;
    }
  });
  // A frame carrying ONLY `retry:` is valid and carries no event. It must
  // not answer null — that means "nothing here" and the caller drops it —
  // and it must not reach onEvent, because there is no event.
  if (!data.length) return retry === null ? null : { retry: retry };
  var parsed = null;
  try { parsed = JSON.parse(data.join('\n')); }
  catch (e) { parsed = data.join('\n'); }
  return { event: event, data: parsed, retry: retry };
}

// opts:
//   url        absolute, including query
//   headers    an object, or a FUNCTION returning one. Prefer the
//              function: a header computed once and reused for the life
//              of a reconnect loop is a header that goes stale, and this
//              client's whole reason for existing is that it can send a
//              signed one (see below).
//   onEvent    ({event, data})
//   onOpen     ()                  — a connection was accepted
//   onClose    (reason)            — it ended, for any reason
//   fetchImpl  for tests
//   setTimeoutImpl / clearTimeoutImpl  for tests
//   retryMs    first backoff, for tests
function connect(opts) {
  opts = opts || {};
  var doFetch = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  var setT = opts.setTimeoutImpl || setTimeout;
  var rand = opts.randomImpl || Math.random;
  var clearT = opts.clearTimeoutImpl || clearTimeout;
  var firstRetry = opts.retryMs || FIRST_RETRY_MS;

  var stopped = false;
  var retryMs = firstRetry;
  var timer = null;
  var controller = null;
  var idleTimer = null;
  var idleMs = opts.idleMs || IDLE_MS;
  // ITS OWN TIMER SEAM, so a test measuring the backoff curve does not
  // have to sieve the watchdog out of the same list of delays by
  // recognising its number. Two clocks, two questions.
  var idleSetT = opts.idleTimeoutImpl || setT;
  var idleClearT = opts.idleClearTimeoutImpl || clearT;

  // Restarted on every byte. When it fires, the connection is abandoned
  // rather than waited on: abort() makes the pending read throw, which
  // lands in the same catch a real network error would, so there is one
  // recovery path and not two.
  function touch() {
    if (idleTimer) idleClearT(idleTimer);
    if (stopped) return;
    idleTimer = idleSetT(function () {
      idleTimer = null;
      untouch();
      if (controller) { try { controller.abort(); } catch (e) { /* gone */ } }
    }, idleMs);
  }

  function untouch() {
    if (idleTimer) { idleClearT(idleTimer); idleTimer = null; }
  }

  function say(fn, arg) {
    if (typeof fn !== 'function') return;
    // A callback that throws must not kill the reconnect loop with it —
    // this is a long-lived client and the thing it is reporting to is
    // not answerable for its survival.
    try { fn(arg); } catch (e) { /* the caller's problem, not ours */ }
  }

  function scheduleRetry(reason) {
    untouch();
    say(opts.onClose, reason);
    if (stopped) return;
    // JITTERED, and that is what makes a short cap safe rather than
    // reckless. Without it every member of a relay backs off on the same
    // curve from the same instant — the box dies, a hundred nodes count to
    // one together, and it is hit by a hundred simultaneous reconnects
    // exactly as it tries to come up. Spreading them over the back half of
    // each interval costs nothing and turns a wave into a trickle.
    //
    // The NOMINAL curve still doubles, which is what a test can assert;
    // `randomImpl` pinned to 1 gives the undisturbed sequence.
    var spread = 0.5 + (0.5 * rand());
    timer = setT(function () {
      timer = null;
      run();
    }, Math.round(retryMs * spread));
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  async function run() {
    if (stopped) return;
    if (!doFetch) { scheduleRetry('no fetch'); return; }

    controller = typeof AbortController === 'function' ? new AbortController() : null;
    // Armed before the fetch, so a request that hangs before any response
    // is abandoned on the same clock as one that goes quiet afterwards.
    touch();
    var res;
    try {
      res = await doFetch(opts.url, {
        headers: (typeof opts.headers === 'function' ? opts.headers() : opts.headers) || {},
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      scheduleRetry('unreachable: ' + (e && e.message ? e.message : e));
      return;
    }

    if (!res || !res.ok || !res.body) {
      scheduleRetry('refused: ' + ((res && res.status) || 0));
      return;
    }

    // NOT reset here, and that cost a live incident. A refusal can arrive
    // as a 200 whose body closes at once — this client cannot see a status
    // the server has already committed to — so "the server accepted my
    // socket" is not evidence that anything worked. Resetting on it turned
    // a stale credential into a one-per-second hammer that then spent the
    // relay's rate limit, which guaranteed the refusals continued.
    //
    // AND IT IS NOT RESET HERE, still. A draft of the clingy change did
    // exactly what the paragraph above forbids, and this comment is what
    // caught it — the incident it describes is not visible from anywhere
    // else in the tree.
    //
    // THE RESET MOVED TO BYTES, which distinguishes the two cases cleanly
    // where neither "on connect" nor "on an event" could:
    //
    //   stale credential   200, body closes, ZERO bytes -> no reset, the
    //                      backoff keeps climbing, the hammer never starts
    //   healthy but quiet  heartbeats arrive every 20s -> reset, so a node
    //                      on a relay nobody talks through does not climb
    //                      to the cap and stay there
    //
    // The old rule reset only where an EVENT was parsed, and
    // `parseChunk(':')` answers null for a heartbeat and returns first —
    // so a stream that was connected, healthy and merely QUIET kept
    // whatever backoff it had. The symptom was a node that re-attached
    // more slowly the longer it had behaved.
    say(opts.onOpen);

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    try {
      for (;;) {
        var step = await reader.read();
        if (step.done) { scheduleRetry('ended'); return; }

        // BYTES. Not a parsed event, not an accepted socket — bytes this
        // relay chose to send down this stream. A heartbeat is the relay
        // saying it is there, which is the whole reason it sends one, and
        // until now the only thing listening for it was a proxy.
        retryMs = firstRetry;
        touch();

        buffer += decoder.decode(step.value, { stream: true });
        // \r\n\r\n as well as \n\n: the spec allows either, and a proxy
        // that rewrites line endings would otherwise make every message
        // invisible rather than malformed, which is far harder to see.
        var parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop();
        parts.forEach(function (raw) {
          var msg = parseChunk(raw);
          if (!msg) return;

          // THE SERVER'S OWN ANSWER WINS, and it is set AFTER the
          // byte-reset above, deliberately: bytes just put the backoff
          // back to its floor, and a box that said "three seconds"
          // because it is about to restart knows better than the floor
          // does. It holds until the next byte resets it — which is the
          // next thing that arrives if the box came back.
          if (typeof msg.retry === 'number') retryMs = msg.retry;

          // A frame that carried only `retry:` is not an event.
          if (msg.data === undefined) return;
          say(opts.onEvent, msg);
        });
      }
    } catch (e) {
      untouch();
      scheduleRetry('read failed: ' + (e && e.message ? e.message : e));
    }
  }

  run();

  return {
    close: function () {
      stopped = true;
      if (timer) { clearT(timer); timer = null; }
      if (controller) { try { controller.abort(); } catch (e) { /* gone */ } }
    },
    // For tests and for the Jobs row: how far the backoff has walked.
    retryMs: function () { return retryMs; },
  };
}

module.exports = {
  connect: connect,
  parseChunk: parseChunk,
  FIRST_RETRY_MS: FIRST_RETRY_MS,
  MAX_RETRY_MS: MAX_RETRY_MS,
  IDLE_MS: IDLE_MS,
};
