'use strict';

// spirit/run/js/appClient.js
// THE NODE'S SIDE OF ITS SERVER PROCESSES: WHERE EACH PIPE IS, AND THE KNOCK.
//
// THE CLIENT, NOT THE SERVERS. Named for the servers (the plural) until
// appPair/G1.1.
// Andy, 2026-09-28: "we need to rename appServer to appClient. that was a
// misnomer", because in the chain the node is the one asking. Its other
// half, appServer.js, runs inside each server process (appPair/G1.2).
//
// Two things:
//
//   WHERE A PROCESS'S DOOR IS. The node names each pipe (pipePathFor) and
//   hands it to the process it starts (jobs.startNodeServers, --pipe); the
//   process is known here by that pipe from then on (register).
//
//   THE KNOCK. ask('api') asks every server its verb tree; ask({app: {verb:
//   {args}}}) hands one verb to one server over its pipe and brings back
//   its reply as it came (appPair/G1 D10, D11). jobs.api on the loopback
//   door and a member's 'api' packet (apiDoor.js) both end here.
//
// WHAT LEFT WITH goal/G13.2 (Andy, 2026-10-10, "no \"face\" crap belongs
// into node."): readServers, the "serves" flag, startAll spawning
// js/server.js --app for a face, and toLocalApp, the hop a booted app took
// to a server by name. A face is a process/js server like any other now
// (process/js/appFaceApp), started by startNodeServers, reached by its
// pipe, and the node knows nothing of faces.
//
// Every refusal is by name (spiritErrors.js), so whoever asked reads which
// link failed, never a hang:
//   app-not-served        no server here by that name                   404
//   app-request-too-large the request is over BODY_MAX, not sent        413
//   app-not-running       nothing answers on its pipe                   503
//   app-did-not-answer    it took longer than DOOR_WAIT_MS              504
//   app-answer-too-large  its answer cannot travel back as one packet   502

const path = require('path');
const crypto = require('crypto');
const relayRequest = require('./relayRequest');
const limits = require('./limits');
const errors = require('./spiritErrors');

// A process's folder name: nothing that could climb out of a folder or
// name a pipe path.
const APP_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Under every wait a caller has (the face's SERVE_WAIT_MS, 18 s, under its
// own 30 s), so each wait gives its own named answer.
const DOOR_WAIT_MS = 12000;

// The answer may ride back inside one sealed packet, as JSON, so
// it must leave room for escaping: half the sealed ceiling. An answer
// larger than this is refused by name, not cut.
const ANSWER_MAX = Math.floor(limits.SEALED_MAX / 2);

const STATUS = {
  'app-not-served': 404,
  'app-request-too-large': 413,
  'app-not-running': 503,
  'app-did-not-answer': 504,
  'app-answer-too-large': 502,
};

// THE NODE NAMES THE PIPE, and hands it to the process it starts, so it
// always knows where to knock and the process never chooses. A socket file
// in the process's own state folder off Windows (gitignored, file
// permissions). A Windows pipe name is global to the machine, and one box
// can run two nodes (Andy's and an agent's), so the name carries this
// checkout: a short hash of its root, or both nodes' desk would collide.
// kind 'process' (desk/G1.6): a server process in process/js. Its socket
// sits in its own state folder, relay-state/process/<name>/ (desk/G1 D5:
// a process's state is part of the node's), and its Windows pipe carries
// 'process-', so it never equals the legacy app/ pipe of the same name.
function pipePathFor(rootDir, appName, platform, kind) {
  const proc = kind === 'process';
  if ((platform || process.platform) === 'win32') {
    const tag = crypto.createHash('sha256').update(path.resolve(String(rootDir))).digest('hex').slice(0, 12);
    return '\\\\.\\pipe\\spirit-' + tag + '-' + (proc ? 'process-' : '') + appName;
  }
  return proc
    ? path.join(rootDir, 'relay-state', 'process', appName, 'door.sock')
    : path.join(rootDir, 'app-state', appName, 'door.sock');
}

// opts: { rootDir, log, request }
// `request` is relayRequest.pipeRequest, a parameter so a suite can drive
// the knock without a process.
function createAppClient(opts) {
  const o = opts || {};
  const log = o.log || function () {};
  const request = o.request || relayRequest.pipeRequest;
  const table = Object.create(null);

  // ── THE NODE'S 'api' (appPair/G1.3) ───────────────────────────────
  //
  // DECIDED in the design session (Desk, appPair/G1), not this file's to
  // undo. Only the node receives 'api' (D2). It asks every server at
  // once, each within DOOR_WAIT_MS (D16), keeps no copy (D6), and answers
  // {app: tree}; a server that does not answer is its error in the
  // tree (D14). A call {app: {verb: {args}}} hands {verb: {args}} to that
  // server and brings back its reply as it came (D10, D11). The node refuses
  // only what it cannot route, and checks no verb or argument: those are
  // the server's (D9). Every error is {ok: false, code, error} from
  // spiritErrors (D12).
  function error(code, extra) {
    const e = errors.byCode(code);
    const body = { ok: false, code: code, error: e ? e.text : code };
    if (extra) body.extra = extra;
    return { status: (e && e.status) || STATUS[code] || 500, body: body };
  }
  // WHO ASKS RIDES AS A HEADER (apiAuth/G1.13). Andy: "ok, the verified
  // key is forwarded to the appServer. i revise my ruling." and "agreed."
  // to the shape: a member's verified key as X-Spirit-Caller, the owner
  // as X-Spirit-Owner: 1 — out of band, so the body stays the app's ask
  // and no app's argument namespace is touched.
  function callerHeaders(caller) {
    if (!caller || typeof caller !== 'object') return undefined;
    const h = {};
    if (caller.owner === true) h['X-Spirit-Owner'] = '1';
    if (typeof caller.key === 'string' && caller.key) h['X-Spirit-Caller'] = caller.key;
    if (typeof caller.label === 'string' && caller.label) h['X-Spirit-Label'] = caller.label;
    return Object.keys(h).length ? h : undefined;
  }
  function knock(row, request_, caller) {
    return Promise.resolve(request(row.pipe, 'POST', '/', JSON.stringify(request_), {
      type: 'application/json', timeoutMs: DOOR_WAIT_MS, answerMax: ANSWER_MAX,
      headers: callerHeaders(caller),
    })).then(function (a) {
      if (!a || a.refused) {
        const code = a && errors.byCode(a.refused) ? a.refused : 'app-not-running';
        const extra = { app: row.app };
        if (a && typeof a.bytes === 'number') { extra.bytes = a.bytes; extra.max = a.max; }
        return error(code, extra);
      }
      let body;
      try { body = JSON.parse(a.text); } catch (e) { return error('handler-failed', { app: row.app, why: 'not JSON' }); }
      const out = { status: a.status, body: body };
      // The server's no-rush mark rides through (fileTransfer goal/G1.3),
      // so the door can post that answer with the same word.
      if (a.kind === 'background') out.kind = 'background';
      return out;
    }, function () { return error('app-not-running', { app: row.app }); });
  }
  function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // `caller` (apiAuth/G1.13): forwarded to every server this ask knocks on.
  function ask(body, caller) {
    if (body === 'api') {
      const names = Object.keys(table);
      return Promise.all(names.map(function (app) {
        // A branch is what that server answered, or its error (D14).
        return knock(table[app], 'api', caller).then(function (r) { return r.body; });
      })).then(function (parts) {
        const tree = {};
        names.forEach(function (app, i) { tree[app] = parts[i]; });
        return { status: 200, body: tree };
      });
    }
    if (!isPlain(body) || Object.keys(body).length !== 1) return Promise.resolve(error('bad-request', { why: "'api', or one app as {app: {verb: {args}}}" }));
    const app = Object.keys(body)[0];
    if (!APP_RE.test(app) || !isPlain(body[app])) return Promise.resolve(error('bad-request', { why: 'an app name, then {verb: {args}}' }));
    if (!Object.prototype.hasOwnProperty.call(table, app)) return Promise.resolve(error('app-not-served', { app: app }));
    return knock(table[app], body[app], caller);
  }

  return {
    ask: ask,
    apps: function () { return Object.keys(table); },
    // A server process the node started (jobs.startNodeServers), known from
    // now on by the pipe the node named for it (desk/G1.6, appPair D15).
    register: function (name, pipe) {
      const n = String(name || '');
      if (!APP_RE.test(n) || !pipe) return false;
      table[n] = { app: n, pipe: String(pipe), job: null };
      log('server process: ' + n);
      return true;
    },
  };
}

module.exports = {
  createAppClient: createAppClient,
  pipePathFor: pipePathFor,
  DOOR_WAIT_MS: DOOR_WAIT_MS,
  ANSWER_MAX: ANSWER_MAX,
  STATUS: STATUS,
};
