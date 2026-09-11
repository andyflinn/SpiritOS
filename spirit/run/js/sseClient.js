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
var MAX_RETRY_MS = 30000;

function parseChunk(text) {
  // One SSE message: any number of field lines, terminated by a blank
  // line. A line starting with `:` is a comment — the heartbeat — and
  // carries no data, which is the one case a naive parser reports as an
  // event with an empty name.
  var event = 'message';
  var data = [];
  text.split('\n').forEach(function (line) {
    if (!line || line.charAt(0) === ':') return;
    var colon = line.indexOf(':');
    var field = colon === -1 ? line : line.slice(0, colon);
    var value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  });
  if (!data.length) return null;
  var parsed = null;
  try { parsed = JSON.parse(data.join('\n')); }
  catch (e) { parsed = data.join('\n'); }
  return { event: event, data: parsed };
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
  var clearT = opts.clearTimeoutImpl || clearTimeout;
  var firstRetry = opts.retryMs || FIRST_RETRY_MS;

  var stopped = false;
  var retryMs = firstRetry;
  var timer = null;
  var controller = null;

  function say(fn, arg) {
    if (typeof fn !== 'function') return;
    // A callback that throws must not kill the reconnect loop with it —
    // this is a long-lived client and the thing it is reporting to is
    // not answerable for its survival.
    try { fn(arg); } catch (e) { /* the caller's problem, not ours */ }
  }

  function scheduleRetry(reason) {
    say(opts.onClose, reason);
    if (stopped) return;
    timer = setT(function () {
      timer = null;
      run();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  async function run() {
    if (stopped) return;
    if (!doFetch) { scheduleRetry('no fetch'); return; }

    controller = typeof AbortController === 'function' ? new AbortController() : null;
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
    // The backoff resets when something ARRIVES. A stream that delivers is
    // a stream that works, and nothing weaker is worth believing.
    say(opts.onOpen);

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    try {
      for (;;) {
        var step = await reader.read();
        if (step.done) { scheduleRetry('ended'); return; }
        buffer += decoder.decode(step.value, { stream: true });
        // \r\n\r\n as well as \n\n: the spec allows either, and a proxy
        // that rewrites line endings would otherwise make every message
        // invisible rather than malformed, which is far harder to see.
        var parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop();
        parts.forEach(function (raw) {
          var msg = parseChunk(raw);
          if (!msg) return;
          retryMs = firstRetry;
          say(opts.onEvent, msg);
        });
      }
    } catch (e) {
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
};
