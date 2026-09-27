'use strict';

// spirit/run/js/appServers.js
// THE LAST LEG: THE OWNER NODE AND THE APP SERVERS ON ITS OWN BOX.
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
function pipePathFor(rootDir, appName, platform) {
  if ((platform || process.platform) === 'win32') {
    const tag = crypto.createHash('sha256').update(path.resolve(String(rootDir))).digest('hex').slice(0, 12);
    return '\\\\.\\pipe\\spirit-' + tag + '-' + appName;
  }
  return path.join(rootDir, 'app-state', appName, 'door.sock');
}

// Every app whose manifest says it serves, by folder order.
function readServers(rootDir) {
  let names = [];
  try { names = fs.readdirSync(path.join(rootDir, 'app')).sort(); } catch (e) { return []; }
  return names.filter(function (app) {
    if (!APP_RE.test(app)) return false;
    try { return servesOf(JSON.parse(fs.readFileSync(path.join(rootDir, 'app', app, app + '.json'), 'utf8'))); }
    catch (e) { return false; }
  });
}

function refusal(code, app) {
  return { status: STATUS[code], body: { ok: false, code: code, app: String(app || '') }, type: 'application/json; charset=utf-8' };
}

// opts: { rootDir, startServerJob, log, platform, execPath, request }
// `request` is relayRequest.pipeRequest, a parameter so a suite can drive
// the hop without a process.
function createAppServers(opts) {
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
    return readServers(rootDir).map(function (app) {
      const pipe = pipePathFor(rootDir, app, platform);
      if (platform !== 'win32') {
        try { fs.mkdirSync(path.dirname(pipe), { recursive: true }); } catch (e) { /* the server says why */ }
      }
      const row = { app: app, pipe: pipe, job: null };
      if (typeof o.startServerJob === 'function') {
        row.job = o.startServerJob(o.execPath || process.execPath,
          ['--max-old-space-size=' + RAM_MB, path.join('js', 'server.js'), '--app', app, '--pipe', pipe],
          { cwd: rootDir, type: 'app-server:' + app });
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

  return {
    startAll: startAll,
    toLocalApp: toLocalApp,
    apps: function () { return Object.keys(table); },
  };
}

module.exports = {
  createAppServers: createAppServers,
  pipePathFor: pipePathFor,
  servesOf: servesOf,
  readServers: readServers,
  DOOR_WAIT_MS: DOOR_WAIT_MS,
  ANSWER_MAX: ANSWER_MAX,
  STATUS: STATUS,
};
