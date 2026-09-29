'use strict';

// spirit/run/js/appServer.js
// THE SERVER-SIDE REQUEST ROUTER — appPair/G1.2.
//
//   Andy, 2026-09-28: "the appServer is the request-router server-side".
//   The other half of appClient.js: that one runs in the node and knocks on
//   an app server's pipe; this one runs INSIDE the app server and answers.
//
// An app hands it its verbs and nothing else:
//
//   require('.../appServer.js').serve({
//     greet: { request: { name: '' }, reply: { text: '' },
//              handler: function (args) { return { text: 'hi ' + args.name }; } },
//   });
//
// DECIDED in the design session (Desk, appPair/G1), not this file's to undo:
//
//   'api' answers {verb: {request, reply}}, handlers left out (D3, D10).
//   A call is {verb: {args}}, one verb (D10). The args are key-matched
//   against the verb's request prototype: exactly its keys, each value of
//   the prototype value's type, nested objects the same way. A mismatch is
//   refused here as no-such-argument and the verb never runs, so an app
//   writes no validation (Andy: "these are all generic validations the app
//   doesnt have to do, if appServer supplies those tools uniformly";
//   "intolerance to malformed requests, at every level").
//   The reply is the verb's own, no wrapper (D11: "the shape defined by the
//   server is the shabe that arrives as reply to the caller").
//   Every error is {ok: false, code, error}, a code spiritErrors knows
//   (D12: "our error-register should generate them"). So 'ok' can never be
//   a verb name, and neither can 'api' (D13, D14).
//   Nothing about the caller reaches a verb: the app knows no callers,
//   only the node does (D4). Validation is here; authorization is the
//   node's, and deferred (D9, D5).
//   The app never names its pipe. The node names it (appClient.pipePathFor)
//   and hands it over as --pipe; serve() reads it (D15).

const fs = require('fs');
const path = require('path');
const http = require('http');
const errors = require('./spiritErrors');
const limits = require('./limits');

const RESERVED = ['api', 'ok'];
const VERB_RE = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;

function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// Does `value` have the shape of `proto`? Exact keys for an object, the
// first element's shape for every element of an array, the same typeof
// for anything else.
function matches(proto, value) {
  if (isPlain(proto)) {
    if (!isPlain(value)) return false;
    const want = Object.keys(proto).sort();
    const got = Object.keys(value).sort();
    if (want.join('\n') !== got.join('\n')) return false;
    return want.every(function (k) { return matches(proto[k], value[k]); });
  }
  if (Array.isArray(proto)) {
    if (!Array.isArray(value)) return false;
    return proto.length === 0 || value.every(function (v) { return matches(proto[0], v); });
  }
  if (proto === null) return value === null;
  return typeof value === typeof proto;
}

// The one error shape (D12), built from the catalogue so no text is
// invented here.
function refusal(code, extra) {
  const e = errors.byCode(code);
  const out = { ok: false, code: code, error: e ? e.text : code };
  if (extra) out.extra = extra;
  return { status: e ? e.status : 500, body: out };
}

function checkVerbs(verbs) {
  if (!isPlain(verbs)) throw new Error('appServer: verbs must be an object of {name: {request, reply, handler}}');
  Object.keys(verbs).forEach(function (name) {
    if (RESERVED.indexOf(name) !== -1) throw new Error('appServer: "' + name + '" is reserved and cannot be a verb');
    if (!VERB_RE.test(name)) throw new Error('appServer: "' + name + '" is not a verb name');
    const v = verbs[name];
    if (!isPlain(v) || typeof v.handler !== 'function' || !isPlain(v.request) || !('reply' in v)) {
      throw new Error('appServer: verb "' + name + '" needs request (an object), reply and handler');
    }
    // 'ok' is the reserved reply key (D12): a reply carrying it could pass
    // for an error.
    if (isPlain(v.reply) && Object.prototype.hasOwnProperty.call(v.reply, 'ok')) {
      throw new Error('appServer: verb "' + name + '" declares a reply with the reserved key "ok"');
    }
  });
}

// opts.fallback(req, res): THE PASSTHROUGH (appPair/G1.4). An app server
// that already answers pages and a door of its own (faceServer.js) keeps
// them: the helper claims only a JSON POST to '/', which is how appClient
// asks, and hands every other request on untouched.
function createAppServer(verbs, opts) {
  checkVerbs(verbs);
  const fallback = opts && typeof opts.fallback === 'function' ? opts.fallback : null;
  const tree = {};
  Object.keys(verbs).forEach(function (name) { tree[name] = { request: verbs[name].request, reply: verbs[name].reply }; });

  // One request body, already parsed, to { status, body }.
  function route(req) {
    if (req === 'api') return Promise.resolve({ status: 200, body: tree });
    if (!isPlain(req) || Object.keys(req).length !== 1) return Promise.resolve(refusal('bad-request', { why: 'one verb per call, as {verb: {args}}' }));
    const name = Object.keys(req)[0];
    if (!Object.prototype.hasOwnProperty.call(verbs, name)) return Promise.resolve(refusal('no-such-verb', { verb: name }));
    const args = req[name];
    if (!matches(verbs[name].request, args)) return Promise.resolve(refusal('no-such-argument', { verb: name }));
    return Promise.resolve().then(function () { return verbs[name].handler(args); }).then(function (reply) {
      // THE REPLY IS CHECKED TOO (wsl-claude's review; Andy: "go for the
      // proposed fix"). What arrives is the verb's declared shape or
      // nothing (D11), so a reply that is not is the verb's failure.
      if (!matches(verbs[name].reply, reply)) return refusal('handler-failed', { verb: name, why: 'reply does not match its prototype' });
      return { status: 200, body: reply };
    }, function (e) {
      // A DECLARED REFUSAL PASSES THROUGH (slim/G1.2): a handler that throws
      // {refusal: code}, a code the catalogue knows, is refused by that name
      // (D12), so an app can say line-too-large rather than handler-failed.
      // Its own key, not e.code: a system error's code (ENOENT) must never
      // pass for a refusal. Anything else a handler throws stays handler-failed.
      if (e && typeof e.refusal === 'string' && errors.byCode(e.refusal)) return refusal(e.refusal, { verb: name });
      return refusal('handler-failed', { verb: name });
    });
  }

  function claims(httpReq) {
    const p = String(httpReq.url || '').split('?')[0];
    return httpReq.method === 'POST' && p === '/' && /^application\/json\b/i.test(String(httpReq.headers['content-type'] || ''));
  }

  function handle(httpReq, res) {
    if (fallback && !claims(httpReq)) return fallback(httpReq, res);
    const chunks = [];
    let size = 0;
    let over = false;
    httpReq.on('data', function (c) {
      size += c.length;
      if (size > limits.BODY_MAX) over = true; else chunks.push(c);
    });
    httpReq.on('end', function () {
      let answer;
      if (over) answer = Promise.resolve(refusal('app-request-too-large'));
      else if (httpReq.method !== 'POST') answer = Promise.resolve(refusal('bad-request', { why: 'POST only' }));
      else {
        let parsed;
        let ok = true;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { ok = false; }
        answer = ok ? route(parsed) : Promise.resolve(refusal('bad-request', { why: 'not JSON' }));
      }
      answer.then(function (a) {
        res.writeHead(a.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(a.body));
      });
    });
  }

  let server = null;
  return {
    route: route,
    // Listen on the pipe the node named. A socket file left by a process
    // that died holds the name off Windows, as faceServer.js found.
    // A number is a port instead, on loopback only (faceServer's --port):
    // publicness is never this process's.
    listen: function (target, cb) {
      server = http.createServer(handle);
      if (typeof target === 'number') {
        server.listen(target, '127.0.0.1', cb);
        return server;
      }
      if (process.platform !== 'win32') { try { fs.unlinkSync(target); } catch (e) { /* none */ } }
      server.listen(target, cb);
      return server;
    },
    close: function (cb) { if (server) server.close(cb); else if (cb) cb(); },
  };
}

// A prototype as it reads in code: {a: 0, b: 0}, {name: ''}, [''].
function shape(v) {
  if (Array.isArray(v)) return '[' + (v.length ? shape(v[0]) : '') + ']';
  if (isPlain(v)) return '{' + Object.keys(v).map(function (k) { return k + ': ' + shape(v[k]); }).join(', ') + '}';
  return typeof v === 'string' ? "'" + v + "'" : String(v);
}
function announce(name, pipe, verbs) {
  const names = Object.keys(verbs).sort();
  const width = names.reduce(function (w, n) { return Math.max(w, n.length); }, 0);
  return [name + ': listening on ' + pipe + ', ' + names.length + ' verb' + (names.length === 1 ? '' : 's')]
    .concat(names.map(function (n) {
      return '  ' + n + ' '.repeat(width - n.length) + '  ' + shape(verbs[n].request) + '  ->  ' + shape(verbs[n].reply);
    })).join('\n');
}

// ── AGENTS: AN APP'S RULES FOR AGENTS, FROM A FILE (slim/G1.8) ────────
//
//   Andy, 2026-09-29: "the verb would be upper-case "AGENTS"", "the response
//   to agents is a file on disc called AGENTS?"; 2026-09-30: "great idea!
//   than agent participation on an app cen be introduced without changing
//   code", "i can live with the AGENTS.md auto-detection mechanism in
//   appServer", "there is a file-size-limit (MAX_PAYLOAD)".
//
// An AGENTS.md beside the server's script, there when it starts, gives it
// the verb AGENTS {} -> {text}: the file, read on every ask, so an edit is
// the next answer. No file, no verb. An answer that would not fit one
// answer is refused by name (answer-too-large), never cut. An app that
// declares AGENTS itself keeps its own.
const AGENTS_FILE = 'AGENTS.md';
function withAgents(verbs, script) {
  const file = path.join(path.dirname(path.resolve(String(script || ''))), AGENTS_FILE);
  if (Object.prototype.hasOwnProperty.call(verbs, 'AGENTS') || !fs.existsSync(file)) return verbs;
  const all = Object.assign({}, verbs);
  all.AGENTS = {
    request: {}, reply: { text: '' },
    handler: function () {
      const text = fs.readFileSync(file, 'utf8');
      // The bound appClient holds every answer to (read at the ask: appClient
      // itself requires this file's neighbours).
      if (Buffer.byteLength(JSON.stringify({ text: text }), 'utf8') > require('./appClient').ANSWER_MAX) {
        const e = new Error(AGENTS_FILE + ' is too large for one answer');
        e.refusal = 'answer-too-large';
        throw e;
      }
      return { text: text };
    },
  };
  return all;
}

// THE WHOLE OF AN APP SERVER'S START: verbs in, the node's pipe from argv.
// Started by the node, it ends with the node (processes/G1.3).
function serve(verbs) {
  const argv = process.argv;
  const at = argv.indexOf('--pipe');
  const pipe = at !== -1 ? argv[at + 1] : '';
  if (!pipe) {
    console.error('appServer: no --pipe; the node that starts an app server names its pipe');
    process.exit(2);
  }
  if (typeof process.send === 'function') process.on('disconnect', function () { process.exit(0); });
  verbs = withAgents(verbs, argv[1]);
  const s = createAppServer(verbs);
  // IT SAYS WHO IT IS, AND WHAT IT ANSWERS. Andy, 2026-09-29: "after
  // starting the listener, it should announce itself with its name, and a
  // nicely formatted overview of it's api." Its stdout is its job's console.
  const name = path.basename(String(argv[1] || 'server'), '.js');
  const srv = s.listen(pipe, function () { console.log(announce(name, pipe, verbs)); });
  srv.on('error', function (e) {
    console.error('appServer: could not listen on ' + pipe + ': ' + ((e && e.code) || e));
    process.exit(1);
  });
  return s;
}

module.exports = {
  createAppServer: createAppServer,
  serve: serve,
  matches: matches,
  RESERVED: RESERVED,
};
