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

const spirit = require('./kernel.js');

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
// A REPLY MAY CARRY MORE (goal/G4.19, issue 4). Andy, 2026-10-04: "the alternativeL it must have all the declared
// elements, or more...?", then "agreed." and his grant on appServer.js "to loosen constraints on reply shape".
// With `more`, every declared key must be there, of its shape, at every depth, and keys beyond them pass; a reply
// prototype {} takes any object. A REQUEST STAYS EXACT: it is checked without `more`, so a key more or less is
// still refused no-such-argument.
function matches(proto, value, more) {
  if (isPlain(proto)) {
    if (!isPlain(value)) return false;
    const want = Object.keys(proto).sort();
    if (more) {
      if (!want.every(function (k) { return Object.prototype.hasOwnProperty.call(value, k); })) return false;
    } else if (want.join('\n') !== Object.keys(value).sort().join('\n')) return false;
    return want.every(function (k) { return matches(proto[k], value[k], more); });
  }
  if (Array.isArray(proto)) {
    if (!Array.isArray(value)) return false;
    return proto.length === 0 || value.every(function (v) { return matches(proto[0], v, more); });
  }
  if (proto === null) return value === null;
  return typeof value === typeof proto;
}

// ── AN APP'S OWN CODES (goal/G16.11) ─────────────────────────────────
//
// The shared register is loaded by the node and the relay alike, so a code
// that belongs to one app has no business in it. Andy, 2026-10-11: "yes.
// get the bloody app error codes out of the core." And on the text: "and
// make sure their codes start with \"appServerName: error text\" so the
// origin of the error is clear."
//
// So an app declares its codes to serve(), each with a status and a text,
// and THE NAME IN FRONT IS PUT HERE, never typed by the app: an app cannot
// wear another's name by writing it into its own text.
//
// Module-level because one process is one app server: serve() runs once,
// before anything listens, and declares that server's codes for the life of
// the process. A second call would be a second server in one process, which
// the pipe argument already forbids.
const declared = Object.create(null);
let declaredBy = '';

function declareCodes(name, codes) {
  declaredBy = String(name || '');
  if (codes === undefined || codes === null) return;
  if (!isPlain(codes)) throw new Error('appServer: codes must be an object of {code: {status, text}}');
  Object.keys(codes).forEach(function (code) {
    const row = codes[code];
    if (!/^[a-z][a-z0-9-]*$/.test(code)) throw new Error('appServer: "' + code + '" is not a code name');
    if (!isPlain(row) || typeof row.text !== 'string' || !row.text || typeof row.status !== 'number') {
      throw new Error('appServer: code "' + code + '" needs status (a number) and text (a string)');
    }
    // A CODE THE REGISTER ALREADY OWNS STAYS THE REGISTER'S. The shared
    // ones (bad-request and its kind) are the node's and the relay's answer
    // too, and an app redefining one would make the same code mean two
    // things on one box.
    if (errors.byCode(code)) throw new Error('appServer: code "' + code + '" is the shared register\'s and cannot be declared');
    declared[code] = { status: row.status, text: row.text };
  });
}

// Is this a code this server may refuse by name — its own, or the shared
// register's? Used by the pass-through below, so a handler can throw either.
function knownCode(code) { return !!declared[code] || !!errors.byCode(code); }

// The one error shape (D12), built from the catalogue so no text is
// invented here — or from this app's own declaration, with its name in
// front so the origin of the error is clear.
function refusal(code, extra) {
  const own = declared[code];
  if (own) {
    const out = { ok: false, code: code, error: declaredBy + ': ' + own.text };
    if (extra) out.extra = extra;
    return { status: own.status, body: out };
  }
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
    // background: true marks every answer of this verb no-rush (fileTransfer
    // goal/G1.3; Andy: "same for responses."). The server declares its own
    // answers' class, locally; nothing new travels between peers.
    if ('background' in v && v.background !== true) {
      throw new Error('appServer: verb "' + name + '" declares background, which takes true or nothing');
    }
    // 'ok' is the reserved reply key (D12): a reply carrying it could pass
    // for an error.
    if (isPlain(v.reply) && Object.prototype.hasOwnProperty.call(v.reply, 'ok')) {
      throw new Error('appServer: verb "' + name + '" declares a reply with the reserved key "ok"');
    }
  });
}

// opts.fallback(req, res): THE PASSTHROUGH (appPair/G1.4). A server that
// answers pages of its own on its pipe keeps them: the helper claims only a
// JSON POST to '/', which is how appClient asks, and hands every other
// request on untouched. (Its first user, faceServer.js, is gone with
// goal/G13.2; no server in the tree passes a fallback today.)
function createAppServer(verbs, opts) {
  checkVerbs(verbs);
  const fallback = opts && typeof opts.fallback === 'function' ? opts.fallback : null;
  const tree = {};
  Object.keys(verbs).forEach(function (name) { tree[name] = { request: verbs[name].request, reply: verbs[name].reply }; });
  // Verbs born after start (fileTransfer goal/G1.3): a hash-verb appears when
  // a file lands and goes when it is deleted. Only these may be dropped — a
  // fixed verb, DEBUG or DEPENDENCIES never leaves a running server.
  const runtime = Object.create(null);

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
    // A background verb's answers all carry the mark, refusals included:
    // they are answers of the same verb (fileTransfer goal/G1.3).
    const marked = verbs[name].background === true
      ? function (a) { return Object.assign({ kind: 'background' }, a); }
      : function (a) { return a; };
    // The caller is passed only when one came: a handler called with
    // (args) alone stays called with (args) alone, to the argument.
    return Promise.resolve().then(function () {
      return caller === undefined ? verbs[name].handler(args) : verbs[name].handler(args, caller);
    }).then(function (reply) {
      // THE REPLY IS CHECKED TOO (wsl-claude's review; Andy: "go for the
      // proposed fix"). What arrives is the verb's declared shape or
      // nothing (D11), so a reply that is not is the verb's failure.
      if (!matches(verbs[name].reply, reply, true)) return marked(refusal('handler-failed', { verb: name, why: 'reply does not match its prototype' }));
      return marked({ status: 200, body: reply });
    }, function (e) {
      // A DECLARED REFUSAL PASSES THROUGH (slim/G1.2): a handler that throws
      // {refusal: code}, a code the catalogue knows, is refused by that name
      // (D12), so an app can say line-too-large rather than handler-failed.
      // Its own key, not e.code: a system error's code (ENOENT) must never
      // pass for a refusal. Anything else a handler throws stays handler-failed.
      if (e && typeof e.refusal === 'string' && knownCode(e.refusal)) return marked(refusal(e.refusal, Object.assign({ verb: name }, e.extra && typeof e.extra === 'object' ? e.extra : {})));
      return marked(refusal('handler-failed', { verb: name }));
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
        const head = { 'Content-Type': 'application/json; charset=utf-8' };
        // The mark rides the pipe out of band, as the caller headers ride in
        // (fileTransfer goal/G1.3): the body stays the verb's answer alone.
        if (a.kind === 'background') head['X-Spirit-Kind'] = 'background';
        res.writeHead(a.status, head);
        res.end(text);
      });
    });
  }

  let server = null;
  return {
    route: route,
    // ── VERBS BORN AND DROPPED AT RUNTIME (fileTransfer goal/G1.3) ────
    //
    // The api answers from the current table, so a change shows at once.
    // No republished announce: Andy, "nah, files added or dropped are
    // implicitly know to the user."
    addVerb: function (name, declaration) {
      if (Object.prototype.hasOwnProperty.call(verbs, name)) throw new Error('appServer: verb "' + name + '" already exists');
      // The whole start-up check, shapes and reserved keys included — a
      // verb born late obeys every rule a declared one does.
      const one = {};
      one[name] = declaration;
      checkVerbs(one);
      verbs[name] = declaration;
      tree[name] = { request: declaration.request, reply: declaration.reply };
      runtime[name] = true;
    },
    dropVerb: function (name) {
      if (!runtime[name]) throw new Error('appServer: "' + name + '" is not a runtime verb and cannot be dropped');
      delete verbs[name];
      delete tree[name];
      delete runtime[name];
    },
    // Listen on the pipe the node named, and on nothing else. A socket file
    // left by a process that died holds the name off Windows, so it is
    // cleared first. A number once meant a loopback port here, for the
    // by-hand start of faceServer; gone with goal/G13.2 (Andy, 2026-10-10:
    // "the \"number\" branch in appClient/appServer will be completely
    // gone."). A server that wants a port opens its own listener from its
    // own configuration; the pipe is the node's door to it.
    listen: function (target, cb) {
      server = http.createServer(handle);
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
// PUBLISHING (desk/G2.3) is not here. It is shared by every spawned process, server or transient, so it lives in
// spirit.core.jobs (kernel.js) with its size check, beside the job cycle (goal/G29.15); this file keeps only what
// serving needs.

// ── AGENTS: AN APP'S RULES FOR AGENTS, FROM A FILE (slim/G1.8) ────────
//
//   Andy, 2026-09-29: "the verb would be upper-case "AGENTS"", "the response
//   to agents is a file on disc called AGENTS?"; 2026-09-30: "great idea!
//   than agent participation on an app cen be introduced without changing
//   code", "i can live with the AGENTS.md auto-detection mechanism in
//   appServer", "there is a file-size-limit (MAX_PAYLOAD)".
//
// SINCE goal/G30.4 THERE IS NO AGENTS VERB: an app's AGENTS.md lives in its
// family folder (<script>.family beside the script) and is read through the
// family's FS (FS.loadFile {path: "AGENTS.md"}), an edit being the next read.
// (Andy, 2026-10-20: "cannot the agent simply use FS to retrieve the
// AGENTS.md file of the verb.json files?")
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

// ── streamListener: A SERVER FOLLOWS ANOTHER SERVER'S STREAM (goal/G33.4, box v40) ──────
//
//   Andy, approving it: "the streamListener verb is approved", a common component "built into the appServer module
//   rather than the application server itself, ... allowing appServers to be true clients to any other appServer".
//
// A server that follows a stream hands serve() opts.stream = { module, translator, onRow }: the module the sender
// publishes as (process/js/<name>), the stream's translator (its shell/js/<type>/data.js), and, if it wants one, a
// handler for each row. serve() then adds the verb streamListener {json} -> {heard: true}: one row, as its sender
// publishes it, JSON. Each row goes straight into the server's spirit.data (shell/js/spiritData.js) through the
// translator, exactly as a face app keeps it in the page (box v41: "appServer also maintains the data set in the
// server's spirit object"), and then to onRow(row, from). The data set is appServer.data; the server keeps no mirror
// of its own. Only a sender the server follows is heard (server.follow(key)); any other caller is refused not-granted.
// follow(key) also grants that key the verb on this server's own node (auth.grant <server>.streamListener, through the
// spirit object on the node's loopback door), so the sender's peerPost passes the node's gate; a grant the node holds
// already is no fault. The sender reaches it through this server's family interface over peerPost (face/spirit.js
// forPeer), as any call.
let streamData = null;
function dataSet() {
  if (!streamData) streamData = require('../shell/js/spiritData.js');
  return streamData;
}
function withStreamListener(verbs, stream, followed) {
  if (!stream || typeof stream !== 'object' || Object.prototype.hasOwnProperty.call(verbs, 'streamListener')) return verbs;
  const D = dataSet();
  if (stream.translator) require(path.resolve(String(stream.translator)));
  const moduleName = String(stream.module || '');
  const onRow = typeof stream.onRow === 'function' ? stream.onRow : function () {};
  const all = Object.assign({}, verbs);
  all.streamListener = {
    request: { json: '' }, reply: { heard: true },
    handler: function (a, caller) {
      if (!caller || caller.owner === true || !followed.has(String(caller.key || ''))) throw Object.assign(new Error('not-granted'), { refusal: 'not-granted', extra: { why: 'this server follows no stream from this key' } });
      let row = null;
      try { row = JSON.parse(String(a.json)); } catch (e) { row = null; }
      if (!isPlain(row)) throw Object.assign(new Error('bad-request'), { refusal: 'bad-request', extra: { why: 'a row is one JSON object' } });
      // Into the data set first, as the page takes a publish; then the server's own word on it.
      D.take({ module: moduleName, data: {}, app: row });
      return Promise.resolve(onRow(row, String(caller.key))).then(function () { return { heard: true }; });
    },
  };
  return all;
}
// The node's loopback door, as the node handed it to this process (SPIRIT_CALLBACK_URL's origin).
function nodeUrl() {
  try { return new URL(String(process.env.SPIRIT_CALLBACK_URL || '')).origin; } catch (e) { return ''; }
}

// ── publish: ONE FUNCTION FOR THE PAGES AND THE FOLLOWING SERVERS (goal/G33.4, box v43) ──────
//
//   Andy: "the desk server publishes its changes to the browser with the same function that it publishes its changes
//   to the deskClients".
//
// publish(row) puts the row on the node's job stream for its pages, and hands the same row, as it is, to every server
// that follows this one: a server that sends a stream names in serve() opts.streamTo = { family, recipients, waitMs },
// the followers' family, recipients(row) -> the keys of the nodes this row goes to, and how long one delivery may take.
// Each goes to the follower's streamListener (withStreamListener above) through its family interface over peerPost
// (face/spirit.js forPeer: no packet built here). One delivery at a time per follower, in order. A follower that does
// not answer is away: what was queued for it is dropped (no stale queue), and publish skips it until a row is sent to it
// alone (publish(row, key): the follower only, no page), which is how a sender hands a returning follower what it
// missed; listening(key) says 'on', 'away' or 'new' (never sent to). A follower whose family has no streamListener is
// sent nothing. A server that sends follows nobody by this: it receives nothing back (box v42).
let sendTo = null;
const sendQueues = new Map();   // key -> { busy, rows, away }
function deliverRow(key, row) {
  const so = require('../face/spirit.js');
  const post = function (body) { return spirit.peerPost(key, 'api', body, { waitMs: sendTo.waitMs || 10000 }); };
  return so.forPeer(key, post, sendTo.family).then(function (s) {
    const fam = s[sendTo.family];
    if (!fam || typeof fam.streamListener !== 'function') return 'no-receiver';
    return so.outcome(fam.streamListener({ json: JSON.stringify(row) })).then(function (r) { return r.status === 200 ? 'taken' : 'away'; });
  }, function () { return 'away'; });
}
function pumpTo(key) {
  const q = sendQueues.get(key);
  if (!q || q.busy || !q.rows.length) return;
  q.busy = true;
  deliverRow(key, q.rows.shift()).then(function (said) {
    q.busy = false;
    if (said === 'away') { q.rows = []; q.away = true; return; }
    if (said === 'no-receiver') { q.rows = []; return; }
    pumpTo(key);
  });
}
function publish(row, only) {
  const out = only ? undefined : spirit.core.jobs.publish(row);
  if (!sendTo) return out;
  let keys = [];
  if (only) keys = [String(only)];
  else { try { keys = sendTo.recipients(row) || []; } catch (e) { keys = []; } }
  keys.forEach(function (key) {
    const q = sendQueues.get(key) || { busy: false, rows: [], away: false };
    sendQueues.set(key, q);
    if (only) q.away = false;
    if (q.away) return;
    q.rows.push(row);
    pumpTo(key);
  });
  return out;
}
function listening(key) {
  const q = sendQueues.get(String(key || ''));
  return !q ? 'new' : q.away ? 'away' : 'on';
}

// THE FAMILY FOLDER'S VERBS (introSpector.js): since goal/G30.4 its FS verbs alone, on every server, AGENTS.md or
// not. A verb file naming a verb this server never declared is said at boot. A server that declares a name itself
// keeps its own.
// THE FAMILY FOLDER IS <script>.family, BESIDE THE SCRIPT (goal/G30.4; Andy, 2026-10-20: "the family folder should be
// the same name as the <module>.js it represents <module>.family", "a sibling"): a family folder never holds code,
// and introSpector's FS reaches nothing above it. The manifest stays with the script, so none is in the folder.
function withAgents(verbs, script) {
  const resolved = path.resolve(String(script || ''));
  const made = require('./introSpector').family(path.join(path.dirname(resolved), path.basename(resolved, '.js') + '.family'), {
    declared: Object.keys(verbs),
  });
  made.stale.forEach(function (file) {
    console.error('appServer: ' + file + ' names a verb this server does not declare');
  });
  const all = Object.assign({}, verbs);
  Object.keys(made.verbs).forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(all, name)) all[name] = made.verbs[name];
  });
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
  // goal/G33.4: the stream a server follows, if it follows one (withStreamListener).
  const followed = new Set();
  // goal/G33.4 (box v43): the servers this one's publish reaches, if it sends a stream.
  const st = opts && opts.streamTo;
  if (st && typeof st === 'object' && typeof st.recipients === 'function') sendTo = { family: String(st.family || ''), recipients: st.recipients, waitMs: Number(st.waitMs) || 10000 };
  try {
    verbs = withDependencies(withDebug(withAgents(withStreamListener(verbs, opts && opts.stream, followed), argv[1])), opts && opts.dependencies);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  // THE NAME FIRST, because this server's own codes wear it (goal/G16.11),
  // and the declaration lands before anything listens so a malformed one
  // stops the start the way a malformed dependency does.
  const name = path.basename(String(argv[1] || 'server'), '.js');
  try {
    declareCodes(name, opts && opts.codes);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const s = createAppServer(verbs, opts && typeof opts.fallback === 'function' ? { fallback: opts.fallback } : undefined);
  // IT SAYS WHO IT IS, AND WHAT IT ANSWERS. Andy, 2026-09-29: "after
  // starting the listener, it should announce itself with its name, and a
  // nicely formatted overview of it's api." Published, not printed (desk/G2.3).
  const srv = s.listen(pipe, function () {
    spirit.core.jobs.publish({ announce: { name: name, verbs: Object.keys(verbs).sort().map(function (n) {
      return { verb: n, request: shape(verbs[n].request), reply: shape(verbs[n].reply) };
    }) } });
  });
  srv.on('error', function (e) {
    console.error('appServer: could not listen on ' + pipe + ': ' + ((e && e.code) || e));
    process.exit(1);
  });
  // FOLLOW A SENDER'S STREAM (goal/G33.4): heard from now on, and granted the verb on this node. Answers whether the
  // node holds the grant (true when it did already).
  s.follow = function (key) {
    const k = String(key || '');
    if (!k || !verbs.streamListener) return Promise.resolve(false);
    followed.add(k);
    const base = nodeUrl();
    if (!base) return Promise.resolve(false);
    const so = require('../face/spirit.js');
    return so.outcome(so.forNode(base, 'auth').then(function (o) { return o.auth.grant({ key: k, path: name + '.streamListener' }); })).then(function (r) {
      return r.status === 200 || (r.body && r.body.code === 'already-granted');
    });
  };
  s.unfollow = function (key) { followed.delete(String(key || '')); };
  return s;
}

let file = null;

try {
  file = fs.readFileSync(spirit.core.node.const.SPIRIT_ENVIRONMENT_FILE, { encoding: 'utf8', flag: 'r' });
  try {
    let env = JSON.parse(file);
    spirit.core.node.const.SPIRIT_PORT = Number(env.PORT);
  } catch (e) {}
} catch (e) {}

// ── THE NODE'S FACTS ON THE SPIRIT OBJECT (goal/G19.10) ──────────────────
//
//   Andy, 2026-10-12: "The appServer have a definite need/use for all 3: the
//   node/puppets key, the owners public key, and the nodes port: if they are
//   not allowed to read the files, they should have that stuff passted with
//   the spirit object that comes with the appServers passed interface."
//
// The port is SPIRIT_PORT above. The other two, and the node's name, are what
// the node hands every server it starts as --node {name, publicKey, ownerKey}
// (jobs.startNodeServers), read here once, at the start, like --pipe:
//
//   spirit.core.node.const.NODE_NAME   the node's name ('' while it has none)
//   spirit.core.node.const.NODE_KEY    the node's public key
//   spirit.core.node.const.OWNER_KEY   its owner's public key; '' when the node
//                                      owns itself or nobody owns it
//
// All public. A server never opens identity.json or owner.json for them; no
// --node, or a malformed one, leaves all three ''.
(function nodeFacts() {
  const at = process.argv.indexOf('--node');
  let node = null;
  try { node = at !== -1 ? JSON.parse(String(process.argv[at + 1] || '')) : null; } catch (e) { node = null; }
  const o = node && typeof node === 'object' ? node : {};
  function str(v) { return typeof v === 'string' ? v : ''; }
  spirit.core.node.const.NODE_NAME = str(o.name);
  spirit.core.node.const.NODE_KEY = str(o.publicKey);
  spirit.core.node.const.OWNER_KEY = str(o.ownerKey);
}());

module.exports = {
  spirit:spirit,
  // goal/G33.4: the data set a following server keeps (shell/js/spiritData.js), filled by its stream's translator.
  get data() { return dataSet(); },
  // goal/G33.4 (box v43): the one publish, to the pages and to the following servers; and whether a follower is on.
  publish: publish,
  listening: listening,
  createAppServer: createAppServer,
  serve: serve,
  matches: matches,
  RESERVED: RESERVED,
};

