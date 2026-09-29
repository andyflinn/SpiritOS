'use strict';

// spirit/run/js/appClient.js
// THE LAST LEG: THE OWNER NODE AND THE APP SERVERS ON ITS OWN BOX.
//
// THE CLIENT, NOT THE SERVERS. Named for the servers (the plural) until
// appPair/G1.1.
// Andy, 2026-09-28: "we need to rename appServer to appClient. that was a
// misnomer", because in the face-to-appServer chain the node is the one
// asking. Its other half, appServer.js, runs inside each app server
// (appPair/G1.2). api.toLocalApp kept its name ("keep it").
//
//   public-app-server/G17. Andy, 2026-09-27, in Desk: "step 1) build and
//   prove the route from browser to owner-of-subdomain, and back 2) design
//   the last leg. 3) implement the last leg". Step 1 was proven live the
//   same day; this is step 3, on his "the go is officail. also: i explicitly
//   permit the two new/proposed interfaces/api' for communication from node
//   to appserver", and his "Go. and two verbs approved."
//
// Two things, and the word for what a visitor asks for is nowhere here:
//
//   KEEPING AN APP'S SERVER RUNNING. An app whose manifest says
//   "serves": true gets one app server (node js/server.js --app <name>
//   --pipe <path>) as a 'server' job (jobs.startServerJob), started at boot
//   and again when it exits. Nothing calls jobs.create for it: the loopback
//   door gains nothing.
//
//   THE HOP. toLocalApp(appName, request) hands { method, path, body, type }
//   to that app's door over its pipe (relayRequest.pipeRequest) and answers
//   { status, body, type }. A booted app gets it as api.toLocalApp; that is
//   the one new surface, and it is inside the node, not on its door.
//
// WHICH APP ANSWERS A VISITOR IS NOT THE NODE'S BUSINESS. Andy, 2026-09-27:
// "the core only knows about puppets (nodes owned by nodes, not people). the
// face-name/app-or-member table must be owned by appFaceApp, not by the
// puppet-infrastructure." So the table lives in appFaceApp's grants.json
// (a row's `app`), and this file knows apps by their own names only. It first
// read a 'face' field out of every manifest, which was appFaceApp's knowledge
// living in the node (wsl-claude found it).
//
// NOT ON A PUPPET. A node with relay-state/puppet.json serves its owner, and
// the app servers live on the owner's box (THE PATH, G17). So the VPS puppet
// never starts one, whatever manifests its clone carries.
//
// Every refusal is by name (spiritErrors.js), so whoever asked reads which
// link failed, never a hang:
//   app-not-served        no app here by that name runs a server        404
//   app-request-too-large the request is over BODY_MAX, not sent        413
//   app-not-running       nothing answers on its pipe                   503
//   app-did-not-answer    it took longer than DOOR_WAIT_MS              504
//   app-answer-too-large  its answer cannot travel back as one packet   502

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const relayRequest = require('./relayRequest');
const limits = require('./limits');
const errors = require('./spiritErrors');

// An app's folder name, as nodeApps reads it: nothing that could climb out
// of app/ or name a pipe path.
const APP_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Under every wait a caller has today (appFaceApp's SERVE_WAIT_MS, 18 s,
// under puppetPost's 30 s), so each wait gives its own named answer.
const DOOR_WAIT_MS = 12000;

// The answer may ride back inside one sealed packet, as JSON, so
// it must leave room for escaping: half the sealed ceiling. A page larger
// than this is refused by name, not cut.
const ANSWER_MAX = Math.floor(limits.SEALED_MAX / 2);

// Each app server's heap, the same way the node's own unit caps its RAM.
const RAM_MB = 128;

const STATUS = {
  'app-not-served': 404,
  'app-request-too-large': 413,
  'app-not-running': 503,
  'app-did-not-answer': 504,
  'app-answer-too-large': 502,
};

function servesOf(manifest) {
  return !!(manifest && manifest.serves === true);
}

// THE NODE NAMES THE PIPE, and hands it to the process it starts, so it
// always knows where to knock and the app never chooses. A socket file in
// the app's own state folder off Windows (gitignored, file permissions). A
// Windows pipe name is global to the machine, and one box can run two nodes
// (Andy's and the agents'), so the name carries this checkout: a short hash
// of its root, or both nodes' faceProof would collide.
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

// Every face whose manifest says it serves, by folder order. A face is a
// process since slim/G1.4 (Andy: "faceProof moves"; D11, servers live in
// process/js), so it is found there and never in shell/.
function readServers(rootDir) {
  let names = [];
  try { names = fs.readdirSync(path.join(rootDir, 'process', 'js')).sort(); } catch (e) { return []; }
  return names.filter(function (app) {
    if (!APP_RE.test(app)) return false;
    try { return servesOf(JSON.parse(fs.readFileSync(path.join(rootDir, 'process', 'js', app, app + '.json'), 'utf8'))); }
    catch (e) { return false; }
  });
}

function refusal(code, app) {
  return { status: STATUS[code], body: { ok: false, code: code, app: String(app || '') }, type: 'application/json; charset=utf-8' };
}

// opts: { rootDir, startServerJob, log, platform, execPath, request }
// `request` is relayRequest.pipeRequest, a parameter so a suite can drive
// the hop without a process.
function createAppClient(opts) {
  const o = opts || {};
  const rootDir = String(o.rootDir || '');
  const log = o.log || function () {};
  const platform = o.platform || process.platform;
  const request = o.request || relayRequest.pipeRequest;
  const table = Object.create(null);

  function isPuppet() {
    try { return fs.statSync(path.join(rootDir, 'relay-state', 'puppet.json')).isFile(); }
    catch (e) { return false; }
  }

  function startAll() {
    if (isPuppet()) { log('app servers: this node is a puppet, so it starts none'); return []; }
    // ONLY A LISTED FACE (slim/G1.3): a face is a server process like any
    // other, so a node starts one only if relay-state/include.json names it
    // (includeList.js). Seeded first, as the boot's server scan does, since
    // either may run first: a live node keeps the faces it ran.
    const includeList = require('./includeList');
    includeList.seedOnce(rootDir);
    return readServers(rootDir).filter(function (app) { return includeList.includes(rootDir, 'process/js/' + app); }).map(function (app) {
      // Its door with every process's, in relay-state/process/<name> (slim/G1.4).
      const pipe = pipePathFor(rootDir, app, platform, 'process');
      if (platform !== 'win32') {
        try { fs.mkdirSync(path.dirname(pipe), { recursive: true }); } catch (e) { /* the server says why */ }
      }
      const row = { app: app, pipe: pipe, job: null };
      if (typeof o.startServerJob === 'function') {
        row.job = o.startServerJob(o.execPath || process.execPath,
          ['--max-old-space-size=' + RAM_MB, path.join('js', 'server.js'), '--app', app, '--pipe', pipe],
          { cwd: rootDir, type: 'app-server:' + app, module: 'process/js/' + app });
      }
      table[app] = row;
      log('app server: ' + app);
      return app;
    });
  }

  function toLocalApp(appName, req) {
    const app = String(appName || '');
    const row = Object.prototype.hasOwnProperty.call(table, app) ? table[app] : null;
    if (!row) return Promise.resolve(refusal('app-not-served', app));
    const r = req || {};
    const body = typeof r.body === 'string' ? r.body : (r.body == null ? '' : JSON.stringify(r.body));
    if (Buffer.byteLength(body, 'utf8') > limits.BODY_MAX) return Promise.resolve(refusal('app-request-too-large', app));
    const p = String(r.path || '/');
    return Promise.resolve(request(row.pipe, String(r.method || 'GET'), p.charAt(0) === '/' ? p : '/' + p, body, {
      type: typeof r.type === 'string' ? r.type : '',
      timeoutMs: DOOR_WAIT_MS,
      answerMax: ANSWER_MAX,
    })).then(function (a) {
      if (!a || a.refused) return refusal((a && STATUS[a.refused]) ? a.refused : 'app-not-running', app);
      return { status: a.status, body: a.text, type: a.type };
    });
  }

  // ── THE NODE'S 'api' (appPair/G1.3) ───────────────────────────────
  //
  // DECIDED in the design session (Desk, appPair/G1), not this file's to
  // undo. Only the node receives 'api' (D2). It asks every app server at
  // once, each within DOOR_WAIT_MS (D16), keeps no copy (D6), and answers
  // {app: tree}; an app server that does not answer is its error in the
  // tree (D14). A call {app: {verb: {args}}} hands {verb: {args}} to that
  // app and brings back its reply as it came (D10, D11). The node refuses
  // only what it cannot route, and checks no verb or argument: those are
  // the app server's (D9). Every error is {ok: false, code, error} from
  // spiritErrors (D12).
  function error(code, extra) {
    const e = errors.byCode(code);
    const body = { ok: false, code: code, error: e ? e.text : code };
    if (extra) body.extra = extra;
    return { status: (e && e.status) || STATUS[code] || 500, body: body };
  }
  function knock(row, request_) {
    return Promise.resolve(request(row.pipe, 'POST', '/', JSON.stringify(request_), {
      type: 'application/json', timeoutMs: DOOR_WAIT_MS, answerMax: ANSWER_MAX,
    })).then(function (a) {
      if (!a || a.refused) return error(a && errors.byCode(a.refused) ? a.refused : 'app-not-running', { app: row.app });
      let body;
      try { body = JSON.parse(a.text); } catch (e) { return error('handler-failed', { app: row.app, why: 'not JSON' }); }
      return { status: a.status, body: body };
    }, function () { return error('app-not-running', { app: row.app }); });
  }
  function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function ask(body) {
    if (body === 'api') {
      const names = Object.keys(table);
      return Promise.all(names.map(function (app) {
        // A branch is what that app server answered, or its error (D14).
        return knock(table[app], 'api').then(function (r) { return r.body; });
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
    return knock(table[app], body[app]);
  }

  return {
    startAll: startAll,
    toLocalApp: toLocalApp,
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
  servesOf: servesOf,
  readServers: readServers,
  DOOR_WAIT_MS: DOOR_WAIT_MS,
  ANSWER_MAX: ANSWER_MAX,
  STATUS: STATUS,
};
