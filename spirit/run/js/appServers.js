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

// AN APP'S OWN SERVER CODE (public-app-server/G19.1). Andy, 2026-09-28:
// grantFace "is a faceless spirit app, responding to HTTP equivalent
// requests", "it's lives while the node lives, because it is a server, as
// defined in the manifes". So a manifest may name one file in its own
// folder, "server": "grantFace.server.js", and the node runs that as the
// app's server job instead of the stock one. One plain file name: nothing
// that climbs out of the app's folder.
const SERVER_FILE_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*\.js$/;
function serverFileOf(manifest) {
  const f = manifest && manifest.server;
  return typeof f === 'string' && SERVER_FILE_RE.test(f) && f.indexOf('..') === -1 ? f : '';
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

// Every app that runs a server, by folder order: the ones whose manifest
// says "serves": true (the stock server) or names "server": "<file>" (its
// own code). Answers names; readServerRows answers what to start for each.
function readServerRows(rootDir) {
  let names = [];
  try { names = fs.readdirSync(path.join(rootDir, 'app')).sort(); } catch (e) { return []; }
  const rows = [];
  names.forEach(function (app) {
    if (!APP_RE.test(app)) return;
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'app', app, app + '.json'), 'utf8')); }
    catch (e) { return; }
    const own = serverFileOf(manifest);
    // ITS OWN DEBUG MODE, AND ONLY ITS OWN. Andy: "the process might need its
    // own debug more, (essentially --verbose)", and "prolly shouldn't be
    // node-wide, that might cause a flood of extra stuff and printouts".
    // "verbose": true turns SPIRIT_DEBUG on for this server alone, and the
    // launcher sets it explicitly either way, so a node-wide value never
    // leaks into a server that did not ask.
    const verbose = !!(manifest && manifest.verbose === true);
    if (own) rows.push({ app: app, own: own, verbose: verbose });
    else if (servesOf(manifest)) rows.push({ app: app, own: '', verbose: verbose });
  });
  return rows;
}
function readServers(rootDir) {
  return readServerRows(rootDir).map(function (r) { return r.app; });
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
    return readServerRows(rootDir).map(function (r) {
      const app = r.app;
      const pipe = pipePathFor(rootDir, app, platform);
      if (platform !== 'win32') {
        try { fs.mkdirSync(path.dirname(pipe), { recursive: true }); } catch (e) { /* the server says why */ }
      }
      const row = { app: app, pipe: pipe, job: null, own: !!r.own };
      if (typeof o.startServerJob === 'function') {
        // Its own code, told where it lives and which pipe is its door; or
        // the stock server for an app with a page and no code of its own.
        const args = r.own
          ? ['--max-old-space-size=' + RAM_MB, path.join('app', app, r.own)]
          : ['--max-old-space-size=' + RAM_MB, path.join('js', 'server.js'), '--app', app, '--pipe', pipe];
        row.job = o.startServerJob(o.execPath || process.execPath, args, {
          cwd: rootDir,
          type: 'app-server:' + app,
          env: { SPIRIT_APP: app, SPIRIT_PIPE: pipe, SPIRIT_DEBUG: r.verbose ? '1' : '' },
        });
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

  // ── THE PASSTHROUGH (public-app-server/G19.2) ─────────────────────────
  //
  // Andy, 2026-09-28: "grantFace gets requests only when their explicitly
  // forwarded via named pipe, by the owner-node", "and those request can
  // only come from verified members with signature that the owner node
  // automatically checks", and "appFaceApps owner doesn't understant
  // appFaceApp nor grantFace". So: an admitted packet addressed to an app
  // that runs its OWN server code goes down that app's pipe unread, as
  //   POST /   { from, hash, re, relay, body }
  // and whatever JSON the app answers becomes this node's reply packet to
  // the sender, for the same app, carrying re = the packet's hash, signed by
  // this node because this node posts it. An empty answer sends nothing.
  //
  // o: { decode, encode, post(relayUrl, toKey, text), isMember(key), log }.
  // Answers true when the packet was one of these, false for any other.
  function passthrough(message, o) {
    const info = message && typeof message.text === 'string' ? o.decode(message.text) : null;
    if (!info || !info.app || info.legacy) return false;
    const row = Object.prototype.hasOwnProperty.call(table, info.app) ? table[info.app] : null;
    if (!row || !row.own) return false;
    const from = String(message.fromKey || message.from || '');
    // THE FIRST LAYER OF CONSENT IS THE NODE'S: only a key in its contact
    // list reaches an app's pipe, whatever the stranger setting says.
    if (!from || !o.isMember(from)) { log('passthrough: ' + info.app + ' refused a key not in the contacts'); return true; }
    const payload = JSON.stringify({ from: from, hash: String(message.hash || ''), re: info.re || '', relay: String(message.relay || ''), body: info.body });
    const reply = function (body) {
      let made = o.encode(info.app, body, { re: message.hash });
      if (!made || !made.text) made = o.encode(info.app, { ok: false, code: 'app-answer-too-large' }, { re: message.hash });
      if (!made || !made.text) return;
      Promise.resolve(o.post(message.relay || '', from, made.text)).catch(function (e) {
        log('passthrough: the answer from ' + info.app + ' could not be sent: ' + ((e && e.message) || e));
      });
    };
    Promise.resolve(request(row.pipe, 'POST', '/', payload, {
      type: 'application/json', timeoutMs: DOOR_WAIT_MS, answerMax: ANSWER_MAX,
    })).then(function (a) {
      if (!a || a.refused) { reply({ ok: false, code: (a && a.refused) || 'app-not-running', app: info.app }); return; }
      if (!a.text) return;
      let body = null;
      try { body = JSON.parse(a.text); } catch (e) { body = null; }
      if (body === null) { reply({ ok: false, code: 'app-answer-not-json', app: info.app }); return; }
      reply(body);
    });
    return true;
  }

  return {
    startAll: startAll,
    toLocalApp: toLocalApp,
    passthrough: passthrough,
    apps: function () { return Object.keys(table); },
  };
}

module.exports = {
  createAppServers: createAppServers,
  pipePathFor: pipePathFor,
  servesOf: servesOf,
  serverFileOf: serverFileOf,
  readServers: readServers,
  DOOR_WAIT_MS: DOOR_WAIT_MS,
  ANSWER_MAX: ANSWER_MAX,
  STATUS: STATUS,
};
