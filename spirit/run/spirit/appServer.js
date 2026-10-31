'use strict';
// The spirit object first, as the global spirit (goal/G40.1): what this file took from kernel.js it now takes from spirit.
require('../spirit.js');

// spirit/run/spirit/appServer.js
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
  // fixed verb or DEBUG never leaves a running server.
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
        // server's answer is written, against one answer (limits.ANSWER_MAX); one over it is refused by name.
        let text = JSON.stringify(a.body);
        const max = limits.ANSWER_MAX;
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
// process's DEBUG, spirit.debug (goal/G40.6). A member never reaches it (apiDoor refuses it by name).
function withDebug(verbs) {
  if (Object.prototype.hasOwnProperty.call(verbs, 'DEBUG')) return verbs;
  const all = Object.assign({}, verbs);
  all.DEBUG = {
    request: { on: false }, reply: { debug: false },
    accepts: function (a) { return isPlain(a) && (Object.keys(a).length === 0 || (Object.keys(a).length === 1 && typeof a.on === 'boolean')); },
    handler: function (a) { return { debug: spirit.debug(typeof a.on === 'boolean' ? a.on : undefined) }; },
  };
  return all;
}

// ── THE STREAM: ONE PROTOCOL FOR EVERY SERVER (goal/G41.12, box v15) ──────
//
//   Andy, the box: "One general stream protocol in appServer.js for every server, replacing what Desk and deskClient
//   each do on their own." "Client and server stay. Both bundle ... The bundling is appServer's alone; neither server
//   nor client sees it."
//
// A sender (opts.publisher) publishes rows; a client (opts.stream) follows a sender and keeps what it sends in its
// spirit.data through the stream's translator. Between them every delivery is one peerPost to the client's
// streamListener {json}, json one JSON array (a bundle), each element one entry:
//   { run, n, row }                     a row the sender published, numbered n in its run
//   { run, n, row, full: true }         a row of a full push, n the sender's newest number when the push began
//   { run, n, full: true, end: true }   the full push has landed whole
// THE POSITION (box v15): each sender numbers every row it publishes, one count per run of it, and keeps a bounded log
// of them. The client keeps the last (run, n) it took per sender and subscribes with it; the sender hands what came
// after it, oldest first, leaving out rows addressed to others. A different run (the sender restarted), or a number
// older than its log, means a full push, whose rows take precedence over the kept ones and drop none (goal/G41.15).
// The position moves only with what landed: a row's own number once it is taken, a push's only at its end, so a push
// cut short is asked for again from where the client stood.
const crypto = require('crypto');
// The run root, where spirit.js sits: a family folder and a cache are found from here, never from the working folder.
const RUN_ROOT = path.resolve(__dirname, '..');

// ── streamListener: A SERVER FOLLOWS ANOTHER SERVER'S STREAM (goal/G33.4, box v40) ──────
//
//   Andy, approving it: "the streamListener verb is approved", a common component "built into the appServer module
//   rather than the application server itself, ... allowing appServers to be true clients to any other appServer".
//
// A server that follows a stream hands serve() opts.stream = { module, translator, onRow, cache }: the module the
// sender publishes as (process/js/<name>), the stream's translator (its data.js), a handler for each row if it wants
// one, and the cache switch. serve() then adds the verb streamListener {json} -> {heard: true}: one bundle. Each row
// goes straight into the server's spirit.data (shell/shared/js/spiritData.js) through the translator, exactly as a face app
// keeps it in the page, and then to onRow(row, from). The data set is appServer.data; the server keeps no mirror of its
// own. Only a sender the server follows is heard (server.follow(key)); any other caller is refused not-granted.
// follow(key) also grants that key the verb on this server's own node (auth.grant <server>.streamListener, through the
// one spirit object), so the sender's peerPost passes the node's gate; a grant the node holds already is no fault.
//
// THE CACHE (box v15). "Only a client caches. Auto-cache is one switch on the client's serve(), with a limit the client
// sets, 4 MB per sender by default." opts.stream.cache: true, or { limit } in bytes. "The cache keeps everything the
// server sends, every goal, no filtering on the client side", per sender, in
// relay-state/process/<client server>/cache-<sender key in hex>.json under the run root, saved as it changes and read
// back into the data set at the start, before any subscribe. The rows are kept as the sender sent them.
// THE SENDER'S OWN api.js DOES THE CACHE'S WORK (box v15: "That api.js is the client's own: its appServer takes it from
// the client's node ... never from the working folder and never the text a peer sends. No peer's code runs in the
// client's node. A node without a server's family folder keeps no cache of that server."; Andy, Q2: "it sits at the
// receiving end of the stream, it owns the cache, it knows the default cache limit, IT DOESN't HAVE ASK OR TELL ANYBODY
// HOW IT's JOB IS DONE"). Its export cache = { keep(rows, row) -> rows, shed(rows, limit, bytes) -> rows }: keep places
// a new row among the kept (replacing the row it makes old), shed answers the rows that stay once the kept are past the
// limit (bytes(rows) is the size of the cache file they make). A family with no cache export keeps every row and sheds
// the oldest first. What a shed row wrote into the data set goes with it.
const CACHE_LIMIT = 4 * 1024 * 1024;
const CACHE_SAVE_MS = 10;
let streamData = null;
function dataSet() {
  if (!streamData) streamData = require('../shell/shared/js/spiritData.js');
  return streamData;
}
// One per sender this server follows: where it stands and what it keeps.
//   { key, family, run, n, rows: [{ row, paths }], pushing: [{ row, paths }] | null, cached, api, saving }
// paths are what the row wrote into the data set (spiritData recording), so a row that goes takes them with it.
const senders = new Map();
let following = null;            // { module, onRow, limit, cache: bool, name } once serve() has a stream
function hexKey(key) { return Buffer.from(String(key || ''), 'base64').toString('hex'); }
function cacheFile(key) { return path.join(RUN_ROOT, 'relay-state', 'process', following.name, 'cache-' + hexKey(key) + '.json'); }
// The sender's cache rules on this node, or null: none there, no cache. They are its family folder's
// clientCacheManager.js, beside its api.js (goal/G41.24; Andy: "deskClient can get it form its own disc").
function familyApi(family) {
  if (!family || !/^[A-Za-z]\w*$/.test(String(family))) return null;
  const file = path.join(RUN_ROOT, path.dirname(spirit.familyPath(String(family))), 'clientCacheManager.js');
  if (!fs.existsSync(file)) return null;
  try { return require(file); } catch (e) { return null; }
}
function senderOf(key, family) {
  const k = String(key || '');
  let st = senders.get(k);
  if (!st) { st = { key: k, family: '', run: '', n: 0, rows: [], pushing: null, cached: false, api: null, saving: null }; senders.set(k, st); }
  if (family && st.family !== String(family)) {
    st.family = String(family);
    const api = familyApi(st.family);
    st.api = api && api.cache && typeof api.cache === 'object' ? api.cache : null;
    st.cached = !!(following && following.cache && api);
  }
  return st;
}
// A row into the data set through the translator, answering the paths it wrote.
function written(row) {
  const D = dataSet();
  return D.recording(function () { D.take({ module: following.module, data: {}, app: row }); });
}
// THE BYTES OF A CACHE FILE, counted, never characters: its envelope and each row's JSON, a comma between rows.
const rowBytes = new WeakMap();
function bytesOfRow(row) {
  if (!rowBytes.has(row)) rowBytes.set(row, Buffer.byteLength(JSON.stringify(row), 'utf8'));
  return rowBytes.get(row);
}
function bytesFor(st) {
  // The envelope as saved, its numbers at their longest, so the file never grows past what was counted.
  const envelope = Buffer.byteLength(JSON.stringify({ key: st.key, family: st.family, run: 'r'.repeat(16), n: Number.MAX_SAFE_INTEGER, rows: [] }), 'utf8');
  return function (rows) {
    let n = envelope + Math.max(0, rows.length - 1);
    rows.forEach(function (r) { n += bytesOfRow(r); });
    return n;
  };
}
function shedOldest(rows, limit, bytes) {
  let kept = rows.slice();
  while (kept.length > 1 && bytes(kept) > limit) kept.shift();
  return kept;
}
// A row taken into the kept rows: placed by the family's keep, and past the limit shed by its shed. What a shed row
// wrote goes from the data set, and every kept row that wrote the same is written again, so the data set holds what
// the kept rows make and nothing more.
function keepRow(st, rec) {
  const byRow = new Map();
  st.rows.forEach(function (r) { byRow.set(r.row, r); });
  byRow.set(rec.row, rec);
  let rows = st.rows.map(function (r) { return r.row; });
  try { rows = st.api && typeof st.api.keep === 'function' ? st.api.keep(rows, rec.row) : rows.concat([rec.row]); } catch (e) { rows = rows.concat([rec.row]); }
  if (!Array.isArray(rows)) rows = st.rows.map(function (r) { return r.row; }).concat([rec.row]);
  const placed = rows.map(function (r) { return byRow.get(r); }).filter(Boolean);
  const bytes = bytesFor(st);
  const limit = following.limit;
  let kept = placed;
  if (bytes(rows) > limit) {
    let left = rows;
    try { left = st.api && typeof st.api.shed === 'function' ? st.api.shed(rows, limit, bytes) : shedOldest(rows, limit, bytes); } catch (e) { left = shedOldest(rows, limit, bytes); }
    if (!Array.isArray(left)) left = shedOldest(rows, limit, bytes);
    const stay = new Set(left);
    kept = placed.filter(function (r) { return stay.has(r.row); });
    rewrite(kept, placed.filter(function (r) { return !stay.has(r.row); }));
  }
  st.rows = kept;
}
function rewrite(kept, gone) {
  const D = dataSet();
  const lost = new Set();
  gone.forEach(function (r) { r.paths.forEach(function (p) { lost.add(p); }); });
  if (!lost.size) return;
  lost.forEach(function (p) { D.del(p); });
  kept.forEach(function (r) { if (r.paths.some(function (p) { return lost.has(p); })) r.paths = written(r.row); });
}
// THE PUSH HAS LANDED WHOLE: its rows take precedence over what was kept, and nothing kept is dropped (goal/G41.15;
// Andy: "make sure the deskClient doesn't loose cached info outside the current goal", and Q1: "nothing drops from the
// cache, unless the api.js from the server says so"). A push carries the sender's current state, the desk's the current
// goal alone, so a push replacing the cache whole lost every other goal. Each fresh row is placed by the family's keep,
// which replaces the rows it makes old; the position moves to the push (heard, below), so no older row is waited for.
function landed(st) {
  const fresh = st.pushing || [];
  st.pushing = null;
  fresh.forEach(function (r) { keepRow(st, r); });
}
function saveSoon(st) {
  if (!st.cached || st.saving) return;
  st.saving = setTimeout(function () {
    st.saving = null;
    try { saveCache(st); } catch (e) { /* the next row saves again */ }
  }, CACHE_SAVE_MS);
}
// Whole, through a temporary file, so a kill leaves the last good one.
function saveCache(st) {
  const file = cacheFile(st.key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify({ key: st.key, family: st.family, run: st.run, n: st.n, rows: st.rows.map(function (r) { return r.row; }) }));
  fs.renameSync(file + '.tmp', file);
}
// READ BACK AT THE START, BEFORE ANY SUBSCRIBE: every sender's cache file of this server, each row written again.
function restoreCaches() {
  const dir = path.join(RUN_ROOT, 'relay-state', 'process', following.name);
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return; }
  names.filter(function (f) { return /^cache-[0-9a-f]+\.json$/.test(f); }).forEach(function (f) {
    let kept = null;
    try { kept = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { kept = null; }
    if (!isPlain(kept) || typeof kept.key !== 'string' || 'cache-' + hexKey(kept.key) + '.json' !== f || !Array.isArray(kept.rows)) return;
    const st = senderOf(kept.key, String(kept.family || ''));
    if (!st.cached) return;
    st.run = typeof kept.run === 'string' ? kept.run : '';
    st.n = Number.isInteger(kept.n) && kept.n >= 0 ? kept.n : 0;
    kept.rows.filter(isPlain).forEach(function (row) { st.rows.push({ row: row, paths: written(row) }); });
  });
}
// One entry of a bundle, taken.
function heard(st, from, e) {
  if (!isPlain(e) || typeof e.run !== 'string' || typeof e.n !== 'number') return null;
  if (e.full === true && !st.pushing) st.pushing = [];
  if (e.end === true) {
    if (st.pushing) landed(st);
    st.run = e.run; st.n = e.n;
    saveSoon(st);
    return null;
  }
  if (!isPlain(e.row)) return null;
  const rec = { row: e.row, paths: written(e.row) };
  if (e.full === true) st.pushing.push(rec);
  else { keepRow(st, rec); st.run = e.run; st.n = e.n; saveSoon(st); }
  // Then the server's own word on it.
  return following.onRow(e.row, from);
}
function withStreamListener(verbs, stream, followed, name) {
  if (!stream || typeof stream !== 'object' || Object.prototype.hasOwnProperty.call(verbs, 'streamListener')) return verbs;
  dataSet();
  // A translator that hands an attach is attached to this server's data set here (goal/G41.24: the desk's
  // clientCacheManager.js, required also for its cache rules, so its require may come before the data set).
  if (stream.translator) {
    const t = require(path.resolve(String(stream.translator)));
    if (t && typeof t.attach === 'function') t.attach(globalThis);
  }
  const cache = stream.cache === true || isPlain(stream.cache);
  following = {
    module: String(stream.module || ''),
    onRow: typeof stream.onRow === 'function' ? stream.onRow : function () {},
    cache: cache,
    limit: isPlain(stream.cache) && Number(stream.cache.limit) > 0 ? Number(stream.cache.limit) : CACHE_LIMIT,
    name: String(name || 'server'),
  };
  if (cache) restoreCaches();
  const all = Object.assign({}, verbs);
  all.streamListener = {
    request: { json: '' }, reply: { heard: true },
    handler: function (a, caller) {
      if (!caller || caller.owner === true || !followed.has(String(caller.key || ''))) throw Object.assign(new Error('not-granted'), { refusal: 'not-granted', extra: { why: 'this server follows no stream from this key' } });
      let bundle = null;
      try { bundle = JSON.parse(String(a.json)); } catch (e) { bundle = null; }
      if (!Array.isArray(bundle)) throw Object.assign(new Error('bad-request'), { refusal: 'bad-request', extra: { why: 'a delivery is one bundle: a JSON array of entries' } });
      const from = String(caller.key);
      const st = senderOf(from);
      // In order, each entry once the one before it is taken.
      let chain = Promise.resolve();
      bundle.forEach(function (e) { chain = chain.then(function () { return heard(st, from, e); }); });
      return chain.then(function () { return { heard: true }; });
    },
  };
  return all;
}

// ── streamPublisher: subscribe, unsubscribe, and the one publish (goal/G33.8, box v8) ──────
//
//   Andy: "spirit/appServer.js should provide both, a client (streamListener) interface and a server (streamPublisher)
//   interface", "the server part of it accepts connections from streamListeners in form of "ID-key.api-family" where
//   the ID is implicit by the requestor, and then the publish function fans out and publishes to it's OWN id the way it
//   always has and to the connected peer id's via peerPosts to ID-family-streamListener"; "Subscribe and unsubscribe are
//   verbs of the streamPublisher in js/appServer.js, approved and granted."
//
// A server that publishes a stream hands serve() opts.publisher = { family, bootstrap, waitMs, logMax }: the family its
// subscribers listen as when it has nothing else to go by (after a restart), bootstrap(key) -> the rows a full push
// hands (the server's own best set), how long one delivery may take, and how many published rows its log keeps. serve()
// then adds two verbs:
//   subscribe {family, run?, since?}   the caller's key subscribes as family (its streamListener), from its position
//   unsubscribe {}                     the caller's key stops being sent anything
// Who may subscribe is the node's normal grant (<server>.subscribe, or the server as a whole); the caller's key is the
// subscriber, never named. publish(row) puts the row on the node's job stream for its pages, as it always has, and hands
// the same row to every subscriber through its family's streamListener over peerPost (spirit.require with a key: no packet
// built here); a row naming keys in to goes to those subscribers alone. In order per subscriber.
// ROWS THAT BACK UP GO TOGETHER (box v15: "the server its publishings when they back up"; "A bundle is a JSON array of
// rows in one peerPost, as many as a sized probability bucket fits in one answer"): while one bundle is in flight, the
// rows behind it wait, and the next bundle takes as many of them as fit.
// A DELIVERY IS A PLAIN peerPost (goal/G41.22; Andy: "take the 3 seconds out, appServer.js calls peerPost in the most
// basic way"): the 3 s race of goal/G41.12 counted the wait for the node's one sending slot as the subscriber not
// answering, and dropped live subscribers (traced 2026-10-30: one row through every 16 s). A bundle answered no, or not
// answered within the publisher's own wait, drops its subscriber and its queue; it is sent nothing more until it
// subscribes again, with its position, and is handed what it missed then.
// Past QUEUE_MAX waiting rows it is dropped the same way, so nothing it is owed is lost on the way. NO LIST BEYOND THE
// GRANTS (box v8: "No subscriber list is kept beyond the grants"): at its start the server's subscribers are the keys the
// node grants it to (auth.search), each as the server's family; nothing else persists.
let publisher = null;
const subscribers = new Map();   // key -> { family, busy, rows: [entry] }
const QUEUE_MAX = 1000;
const LOG_MAX = 1000;
// This run of the sender, and the number of the newest row it published in it.
const RUN_ID = crypto.randomBytes(8).toString('hex');
let published = 0;
const log = [];                  // { run, n, row }, oldest first, bounded by publisher.logMax
// A server family's interface: the one family path function (spirit.js, goal/G41.12), handed out by this file too.
function familyPath(name) { return spirit.familyPath(name); }
const createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
// One answer's room, as the desk's lists were cut (ANSWER_ROOM): half a sealed packet less 512 bytes for its envelope,
// less the bytes the bundle's JSON gains as the json string of its request.
const BUNDLE_ROOM = Math.floor(limits.SEALED_MAX / 2) - 512;
function forKey(row, key) { return !(row && Array.isArray(row.to)) || row.to.map(String).indexOf(key) !== -1; }
function bundleOf(rows) {
  const bucket = createProbabilityBucket(rows.length);
  // Every row at probability 0, so the queue's order stands; measured as it travels, a string inside the request.
  rows.forEach(function (e) { bucket.seatFor(0, e); });
  const room = BUNDLE_ROOM - Buffer.byteLength(JSON.stringify({ json: '' }), 'utf8');
  const fit = bucket.serialize(null, Math.floor(room / 2)).items.length;
  return rows.slice(0, Math.max(1, fit));
}
function deliver(key, q, bundle) {
  // The subscriber's family, bound by the one spirit object under its key (goal/G40.6), with the publisher's own wait.
  return spirit.require(familyPath(q.family), key, { waitMs: publisher.waitMs }).then(function (fam) {
    if (!fam || typeof fam.streamListener !== 'function') return 'away';
    return spirit.outcome(fam.streamListener({ json: JSON.stringify(bundle) })).then(function (r) { return r.status === 200 ? 'taken' : 'away'; });
  }, function () { return 'away'; });
}
function pumpTo(key) {
  const q = subscribers.get(key);
  if (!q || q.busy || !q.rows.length) return;
  q.busy = true;
  const bundle = bundleOf(q.rows);
  deliver(key, q, bundle).then(function (said) {
    // Away: dropped, its queue with it, until it subscribes again (a later subscribe is a new queue, kept).
    if (said !== 'taken') { if (subscribers.get(key) === q) subscribers.delete(key); return; }
    q.busy = false;
    q.rows.splice(0, bundle.length);
    pumpTo(key);
  });
}
function sendTo(key, entry) {
  const q = subscribers.get(key);
  if (!q) return;
  q.rows.push(entry);
  if (q.rows.length > QUEUE_MAX) { subscribers.delete(key); return; }
  pumpTo(key);
}
// THE ONE PUBLISH (goal/G33.4, box v43: "the desk server publishes its changes to the browser with the same function
// that it publishes its changes to the deskClients"). Numbered, logged, and handed to every subscriber it is for.
function publish(row) {
  const out = spirit.events.publish(row);
  if (!publisher) return out;
  published += 1;
  const entry = { run: RUN_ID, n: published, row: row };
  log.push(entry);
  if (log.length > publisher.logMax) log.splice(0, log.length - publisher.logMax);
  subscribers.forEach(function (q, key) { if (forKey(row, key)) sendTo(key, entry); });
  return out;
}
// A SUBSCRIBE CARRIES THE POSITION (box v15): the run and the number of the last row the subscriber took. Of this run
// and within the log, it is handed what came after, oldest first, its own rows only, and nothing replaces its cache.
// Anything else (no position, another run, a number older than the log) is a full push: the bootstrap, then its end.
function subscribe(key, family, run, since) {
  const k = String(key || '');
  subscribers.set(k, { family: family, busy: false, rows: [] });
  const n = Number(since);
  const inLog = run === RUN_ID && Number.isInteger(n) && n >= 0 && n <= published && (n === published || (log.length > 0 && n >= log[0].n - 1));
  if (inLog) {
    log.forEach(function (e) { if (e.n > n && forKey(e.row, k)) sendTo(k, e); });
    return true;
  }
  let rows = [];
  try { rows = (publisher.bootstrap && publisher.bootstrap(k)) || []; } catch (e) { rows = []; }
  const at = published;
  rows.forEach(function (row) { sendTo(k, { run: RUN_ID, n: at, row: row, full: true }); });
  sendTo(k, { run: RUN_ID, n: at, full: true, end: true });
  return true;
}
function withPublisher(verbs, opts) {
  if (!opts || typeof opts !== 'object') return verbs;
  publisher = {
    family: String(opts.family || ''), bootstrap: typeof opts.bootstrap === 'function' ? opts.bootstrap : null,
    waitMs: Number(opts.waitMs) || 10000, logMax: Number(opts.logMax) > 0 ? Math.floor(Number(opts.logMax)) : LOG_MAX,
  };
  const all = Object.assign({}, verbs);
  const refusedNoKey = function () { return Object.assign(new Error('not-granted'), { refusal: 'not-granted', extra: { why: 'a subscriber is a peer\'s key' } }); };
  all.subscribe = {
    request: { family: '', run: '', since: 0 }, reply: { subscribed: true },
    // The position (run and since together) is the caller's to leave out.
    accepts: function (x) {
      return isPlain(x) && typeof x.family === 'string' && (x.run === undefined || typeof x.run === 'string') &&
        (x.since === undefined || typeof x.since === 'number') &&
        Object.keys(x).every(function (k) { return k === 'family' || k === 'run' || k === 'since'; });
    },
    handler: function (a, caller) {
      if (!caller || !caller.key) throw refusedNoKey();
      if (!/^[A-Za-z]\w*$/.test(String(a.family || ''))) throw Object.assign(new Error('bad-request'), { refusal: 'bad-request', extra: { why: 'family names the subscriber\'s family, its streamListener\'s' } });
      subscribe(caller.key, String(a.family), a.run, a.since);
      return { subscribed: true };
    },
  };
  all.unsubscribe = {
    request: {}, reply: { unsubscribed: true },
    handler: function (a, caller) {
      if (!caller || !caller.key) throw refusedNoKey();
      subscribers.delete(String(caller.key));
      return { unsubscribed: true };
    },
  };
  return all;
}
// AFTER A RESTART THE SUBSCRIBERS ARE THE GRANTS (box v8): every key the node grants this server to, or its subscribe.
function subscribersFromGrants(name) {
  if (!publisher) return Promise.resolve(0);
  return spirit.outcome(spirit.require('spirit/auth/api.js').then(function (auth) { return auth.search({ text: name }); })).then(function (r) {
    // auth.search answers the new search (goal/G29.7): items {key, label}, each label {name, key, path} as JSON. Read as
    // records, as it once answered, it restored nobody, and after every restart the desk sent its clients nothing
    // (found 2026-10-27, goal/G41.11: his "all:" lines woke nobody once the clients no longer subscribed again on a
    // silence).
    const items = (r.body && Array.isArray(r.body.items)) ? r.body.items : [];
    const records = items.map(function (it) { try { return JSON.parse(it.label); } catch (e) { return null; } }).filter(Boolean);
    let n = 0;
    records.forEach(function (g) {
      const p = String(g.path || '');
      if (!g.key || (p !== name && p !== name + '.subscribe') || subscribers.has(String(g.key))) return;
      // Each handed a full push, as a new run's subscriber is; one that does not answer subscribes again itself.
      subscribe(String(g.key), publisher.family);
      n += 1;
    });
    return n;
  }, function () { return 0; });
}

// THE FAMILY FOLDER'S VERBS (introSpector.js): since goal/G30.4 its FS verbs alone, on every server, AGENTS.md or
// not. A verb file naming a verb this server never declared is said at boot. A server that declares a name itself
// keeps its own.
// THE FAMILY FOLDER BESIDE THE SCRIPT, AS THE ONE FAMILY PATH FUNCTION NAMES IT (goal/G41.12, box v15: "Every server's
// family folder is named family: process/js/<name>/family/"): a family folder never holds code, and introSpector's FS
// reaches nothing above it. The manifest stays with the script, so none is in the folder.
function withAgents(verbs, script) {
  const resolved = path.resolve(String(script || ''));
  const folder = path.basename(path.dirname(familyPath(path.basename(resolved, '.js'))));
  const made = require('./introSpector').family(path.join(path.dirname(resolved), folder), {
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
  // A malformed declaration stops the start, by name: the throw lands
  // before anything listens, and the exit says why.
  // goal/G33.4: the stream a server follows, if it follows one (withStreamListener).
  const followed = new Set();
  // THE NAME FIRST, because this server's own codes wear it (goal/G16.11), and its cache folder is named by it
  // (goal/G41.12); the declaration lands before anything listens so a malformed one stops the start.
  const name = path.basename(String(argv[1] || 'server'), '.js');
  try {
    // goal/G33.8: both halves, the stream it publishes (withPublisher) and the streams it listens to (withStreamListener).
    verbs = withDebug(withAgents(withPublisher(withStreamListener(verbs, opts && opts.stream, followed, name), opts && opts.publisher), argv[1]));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
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
    spirit.events.publish({ announce: { name: name, verbs: Object.keys(verbs).sort().map(function (n) {
      return { verb: n, request: shape(verbs[n].request), reply: shape(verbs[n].reply) };
    }) } });
    subscribersFromGrants(name);
  });
  srv.on('error', function (e) {
    console.error('appServer: could not listen on ' + pipe + ': ' + ((e && e.code) || e));
    process.exit(1);
  });
  // THE CLIENT HALF (goal/G33.8): subscribe(key, family) follows the stream of family on the node of key: its rows are
  // heard from that key (follow, which also grants the key this server's streamListener on its own node), then the
  // publisher is asked to subscribe this server, as this server's family, over peerPost through the publisher's family
  // interface. Answers whether the publisher took it. Asked again whenever this server thinks it may have been dropped.
  // THE POSITION GOES WITH IT (box v15): the run and the number of the last row it took from that sender; with none
  // (never subscribed, or its cache gone) it is left out, and the sender pushes in full.
  s.subscribe = function (key, family) {
    const k = String(key || '');
    const fam = String(family || '');
    if (!k || !fam || !verbs.streamListener) return Promise.resolve(false);
    // THE CACHE IS KEPT THROUGH A SUBSCRIBE (goal/G41.11, Q5). Andy: "deskClient keeps it's cache (all clients using
    // spirit-client services, that's where the fix belongs) through new subscribes", and YES to: "May a subscribe keep
    // the old cache until the new push lands, then replace it whole". A push cut short is not waited for: what it brought
    // is kept as rows of the sender, and the position stays where it was.
    const st = senderOf(k, fam);
    if (st.pushing) { const cut = st.pushing; st.pushing = null; cut.forEach(function (r) { keepRow(st, r); }); }
    const position = st.run ? { family: name, run: st.run, since: st.n } : { family: name };
    // A SUBSCRIBE IS A PLAIN peerPost TOO (goal/G41.22; Andy: "take the 3 seconds out"): answered no, or not within the
    // binding's wait, it answers false, and the caller asks again later.
    return s.follow(k).catch(function () { return false; }).then(function () {
      // The publisher's family, bound by the one spirit object under its key (goal/G40.6), with its own wait.
      return spirit.outcome(spirit.require(familyPath(fam), k, { waitMs: 10000 }).then(function (p) {
        if (!p || typeof p.subscribe !== 'function') return { ok: false };
        return p.subscribe(position);
      }));
    }).then(function (r) { return !!(r && r.status === 200 && r.body && r.body.subscribed === true); }, function () { return false; });
  };
  // FOLLOW A SENDER'S STREAM (goal/G33.4): heard from now on, and granted the verb on this node. Answers whether the
  // node holds the grant (true when it did already).
  s.follow = function (key) {
    const k = String(key || '');
    if (!k || !verbs.streamListener) return Promise.resolve(false);
    followed.add(k);
    return spirit.outcome(spirit.require('spirit/auth/api.js').then(function (auth) { return auth.grant({ key: k, path: name + '.streamListener' }); })).then(function (r) {
      return r.status === 200 || (r.body && r.body.code === 'already-granted');
    });
  };
  s.unfollow = function (key) { followed.delete(String(key || '')); };
  // THE CLIENT QUERIES ITS OWN CACHE THROUGH THE SENDER'S api.js (box v15): "a query with includeServer goes on to the
  // server for what the cache lacks." query(key, verb, args, { includeServer }) answers the sender's verb from the cache
  // by its family's cache.answer(verb, args, data, room), as the sender would answer it; what the cache lacks is null,
  // or, with includeServer, the sender's own answer, asked through its family under its key and taken into the data set
  // by the family's cache.took(verb, args, answer, data) when it has one. cached(key, verb, args) is the cache's answer
  // alone, at once.
  s.cached = function (key, verb, args) {
    const st = senders.get(String(key || ''));
    if (!st || !st.api || typeof st.api.answer !== 'function') return null;
    try { return st.api.answer(String(verb), args || {}, dataSet(), ANSWER_ROOM) || null; } catch (e) { return null; }
  };
  s.query = function (key, verb, args, how) {
    const k = String(key || '');
    const kept = s.cached(k, verb, args);
    if (kept || !(how && how.includeServer === true)) return Promise.resolve(kept);
    const st = senders.get(k);
    if (!st || !st.family) return Promise.resolve(null);
    const v = String(verb);
    return spirit.outcome(spirit.require(familyPath(st.family), k, { waitMs: 10000 }).then(function (p) {
      if (!p || typeof p[v] !== 'function') throw Object.assign(new Error('the sender serves no verb ' + v), { code: 'no-such-verb' });
      return p[v](args || {});
    })).then(function (r) {
      if (r.status !== 200 || !isPlain(r.body)) return null;
      if (st.api && typeof st.api.took === 'function') { try { st.api.took(v, args || {}, r.body, dataSet()); } catch (e) { /* the answer stands */ } }
      return r.body;
    });
  };
  return s;
}
// One answer's room, as a server fills its own (the desk's ANSWER_ROOM): the answer limit less 512 bytes.
const ANSWER_ROOM = limits.ANSWER_MAX - 512;
// THE CACHE SAVED NOW (deskClient's cache.dump): every sender this server caches, each to its own file. Answers
// [{ file, bytes }], the file's name in this server's cache folder.
function saveCaches() {
  const out = [];
  senders.forEach(function (st) {
    if (!st.cached || !following) return;
    if (st.saving) { clearTimeout(st.saving); st.saving = null; }
    saveCache(st);
    const file = cacheFile(st.key);
    out.push({ file: path.basename(file), bytes: fs.statSync(file).size });
  });
  return out;
}

// THE NODE'S FACTS ON THE SPIRIT OBJECT (goal/G19.10, goal/G40.6): its port, name, key and owner are spirit.node, which
// spirit.js reads itself as it is required: the port from relay-state/environment.json, the rest from --node.

module.exports = {
  // goal/G33.4: the data set a following server keeps (shell/shared/js/spiritData.js), filled by its stream's translator.
  get data() { return dataSet(); },
  // goal/G33.8: the one publish, to the pages and to the subscribers.
  publish: publish,
  // goal/G41.12: the one family path function, spirit.js's own (Q3), handed out here too.
  familyPath: familyPath,
  // goal/G41.12: the client's cache, saved now (deskClient's cache.dump).
  saveCaches: saveCaches,
  createAppServer: createAppServer,
  serve: serve,
  matches: matches,
  RESERVED: RESERVED,
};

