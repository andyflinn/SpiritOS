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

  // One request body, already parsed, to { status, body }. `caller` is
  // who asked (apiAuth/G1.13), handed to the handler as its second
  // argument; a handler that takes (args) alone is unchanged.
  function route(req, caller) {
    if (req === 'api') return Promise.resolve({ status: 200, body: tree });
    if (!isPlain(req) || Object.keys(req).length !== 1) return Promise.resolve(refusal('bad-request', { why: 'one verb per call, as {verb: {args}}' }));
    const name = Object.keys(req)[0];
    if (!Object.prototype.hasOwnProperty.call(verbs, name)) return Promise.resolve(refusal('no-such-verb', { verb: name }));
    const args = req[name];
    const fits = typeof verbs[name].accepts === 'function' ? verbs[name].accepts(args) : matches(verbs[name].request, args);
    if (!fits) return Promise.resolve(refusal('no-such-argument', { verb: name }));
    // The caller is passed only when one came: a handler called with
    // (args) alone stays called with (args) alone, to the argument.
    return Promise.resolve().then(function () {
      return caller === undefined ? verbs[name].handler(args) : verbs[name].handler(args, caller);
    }).then(function (reply) {
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
      if (e && typeof e.refusal === 'string' && errors.byCode(e.refusal)) return refusal(e.refusal, Object.assign({ verb: name }, e.extra && typeof e.extra === 'object' ? e.extra : {}));
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
      if (over) answer = Promise.resolve(refusal('app-request-too-large', { bytes: size, max: limits.BODY_MAX }));
      else if (httpReq.method !== 'POST') answer = Promise.resolve(refusal('bad-request', { why: 'POST only' }));
      else {
        let parsed;
        let ok = true;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { ok = false; }
        // WHO ASKS, from the door's headers (apiAuth/G1.13): the node
        // verified the key before it forwarded it, and the pipe is the
        // node's alone, so nobody else can set these. A member is
        // { key, label }, the owner { owner: true, key, label } (his
        // own key and name ride along — Andy: "my key will at least
        // confirm it came from my node..."). Nothing when none came —
        // an old caller is unchanged.
        const callerKey = String(httpReq.headers['x-spirit-caller'] || '');
        const callerLabel = String(httpReq.headers['x-spirit-label'] || '');
        let caller;
        if (httpReq.headers['x-spirit-owner'] === '1') caller = { owner: true, key: callerKey, label: callerLabel };
        else if (callerKey) caller = { key: callerKey, label: callerLabel };
        answer = ok ? route(parsed, caller) : Promise.resolve(refusal('bad-request', { why: 'not JSON' }));
      }
      answer.then(function (a) {
        // NO OVERSIZED REPLY LEAVES ANY SERVER. Andy: "the shared layer MUST instantly reject a payload, when the
        // json exceeds the maximum size, that will make this never happen again." Measured here, where every
        // server's answer is written, against one answer (appClient.ANSWER_MAX); one over it is refused by name.
        let text = JSON.stringify(a.body);
        const max = require('./appClient').ANSWER_MAX;
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > max) {
          a = refusal('app-answer-too-large', { bytes: bytes, max: max });
          text = JSON.stringify(a.body);
        }
        res.writeHead(a.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(text);
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
// PUBLISHING (desk/G2.3). Andy: "the servers should send explicit messages via an
// appServerFunction, so the ui gets structured information", "it calls with a js
// object. let the appServer to the work." The object becomes the job's `app`,
// reported through spirit.core.jobs.report; every open page gets it as job-updated.
// EVERY OBJECT GOES OUT AS IT IS HANDED IN (fileTransfer goal/G1.4). A 100 ms
// last-wins rule once sat here; it was an agent's addition (desk/G2.3, 020c339a),
// never Andy's ruling, and it dropped objects silently. Andy: "let desk worry
// about its problems, don't but shit into a common component without asking."
// An app that needs pacing does it itself.
// One limit for everything a payload passes (Andy: "the shared layer MUST instantly reject a payload"): MAX_PAYLOAD.
const PUBLISH_MAX = limits.PAYLOAD_MAX;
function send(obj) {
  Promise.resolve(require('./kernel.js').core.jobs.report({ app: obj })).catch(function () { /* not started by a node */ });
}
function publish(obj) {
  if (!isPlain(obj)) return false;
  let size = 0;
  try { size = Buffer.byteLength(JSON.stringify(obj), 'utf8'); } catch (e) { return false; }
  // SAID, NOT DROPPED (Andy: "and downstream who else didn't do their job"): an object over the cap is not
  // sent, and every page hears that one was lost, with its size and the limit, so it can ask again.
  if (size > PUBLISH_MAX) {
    process.stderr.write('publish-too-large: ' + size + ' bytes, the limit is ' + PUBLISH_MAX + '\n');
    send({ dropped: { bytes: size, max: PUBLISH_MAX } });
    return false;
  }
  send(obj);
  return true;
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
// DEBUG (desk/G2.5): "DEBUG auto-verb supplied by appServer is approved." Every server gets it:
// {} reads, {on: true|false} sets; both answer {debug} with the state that resulted. It flips this
// process's kernel DEBUG. A member never reaches it (apiDoor refuses it by name).
function withDebug(verbs) {
  if (Object.prototype.hasOwnProperty.call(verbs, 'DEBUG')) return verbs;
  const all = Object.assign({}, verbs);
  all.DEBUG = {
    request: { on: false }, reply: { debug: false },
    accepts: function (a) { return isPlain(a) && (Object.keys(a).length === 0 || (Object.keys(a).length === 1 && typeof a.on === 'boolean')); },
    handler: function (a) { return { debug: require('./kernel.js').core.util.debug(a.on) }; },
  };
  return all;
}

// DEPENDENCIES — apiAuth/G1.10. Andy: "an app knows it's requirements, it
// must provide owners with the bundle-info in an owner-only verb
// dependencies which returns a list ofminimum api-tree-paths, a peer user
// requires.", "dependencies format: a list of grant-shapes consisten of
// 'appname.verb'", "the server hard-codes that reply internaly". The
// server hands serve() its list; this builds the verb from it, as DEBUG
// is built. Owner-only is the gate's business (apiAuth/G1.2, apiDoor.js:
// a member asking it is refused not-owner by name).
const DEP_PATH = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_.-]+)?$/;

function checkDependencies(paths) {
  const list = paths == null ? [] : paths;
  if (!Array.isArray(list)) throw new Error('appServer: dependencies must be a list of api-tree-paths');
  list.forEach(function (p) {
    // A malformed path stops the start, by name: a bundle nobody can
    // grant is a bug in the server, not a row for the owner to puzzle at.
    if (typeof p !== 'string' || !DEP_PATH.test(p)) {
      throw new Error('appServer: dependency "' + String(p) + '" is not an api-tree-path (app or app.verb)');
    }
  });
  return list.slice();
}

function withDependencies(verbs, paths) {
  if (Object.prototype.hasOwnProperty.call(verbs, 'DEPENDENCIES')) return verbs;
  const list = checkDependencies(paths);
  const all = Object.assign({}, verbs);
  all.DEPENDENCIES = {
    request: {}, reply: { paths: [''] },
    handler: function () { return { paths: list.slice() }; },
  };
  return all;
}

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
// opts: { fallback } as createAppServer takes it (apiAuth/G1.1: appFaceAppServer's pass-through).
function serve(verbs, opts) {
  const argv = process.argv;
  const at = argv.indexOf('--pipe');
  const pipe = at !== -1 ? argv[at + 1] : '';
  if (!pipe) {
    console.error('appServer: no --pipe; the node that starts an app server names its pipe');
    process.exit(2);
  }
  if (typeof process.send === 'function') process.on('disconnect', function () { process.exit(0); });
  // A malformed dependency stops the start, by name (apiAuth/G1.10): the
  // throw lands before anything listens, and the exit says why.
  try {
    verbs = withDependencies(withDebug(withAgents(verbs, argv[1])), opts && opts.dependencies);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const s = createAppServer(verbs, opts && typeof opts.fallback === 'function' ? { fallback: opts.fallback } : undefined);
  // IT SAYS WHO IT IS, AND WHAT IT ANSWERS. Andy, 2026-09-29: "after
  // starting the listener, it should announce itself with its name, and a
  // nicely formatted overview of it's api." Published, not printed (desk/G2.3).
  const name = path.basename(String(argv[1] || 'server'), '.js');
  const srv = s.listen(pipe, function () {
    publish({ announce: { name: name, verbs: Object.keys(verbs).sort().map(function (n) {
      return { verb: n, request: shape(verbs[n].request), reply: shape(verbs[n].reply) };
    }) } });
  });
  srv.on('error', function (e) {
    console.error('appServer: could not listen on ' + pipe + ': ' + ((e && e.code) || e));
    process.exit(1);
  });
  return s;
}

module.exports = {
  createAppServer: createAppServer,
  serve: serve,
  publish: publish,
  matches: matches,
  RESERVED: RESERVED,
};
