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
// Three things, and nothing else:
//
//   WHICH APP SERVES A NAME. The app's own manifest says so: "face": "hello"
//   in app/faceProof/faceProof.json. The node reads its own manifests, nothing
//   crosses the wire, and appFaceApp's grants.json stays { to }.
//
//   KEEPING IT RUNNING. At boot the node starts one app server per such
//   manifest (node js/server.js --app <name> --pipe <path>) as a 'server'
//   job (jobs.startServerJob), which starts it again when it exits. Nothing
//   calls jobs.create for it: the loopback door gains nothing.
//
//   THE HOP. toLocalApp(name, request) hands { method, path, body, type }
//   to that app's door over its pipe (relayRequest.pipeRequest) and answers
//   { status, body, type }. A booted app gets it as api.toLocalApp; that is
//   the one new surface, and it is inside the node, not on its door.
//
// NOT ON A PUPPET. A node with relay-state/puppet.json serves its owner, and
// the app servers live on the owner's box (THE PATH, G17). So the VPS face
// node never starts one, whatever manifests its clone carries.
//
// Every refusal is by name (spiritErrors.js), so a visitor at the far end of
// the face reads which link failed, never a hang:
//   app-not-served        no manifest here says it serves that name     404
//   app-request-too-large the request is over BODY_MAX, not sent        413
//   app-not-running       nothing answers on its pipe                   503
//   app-did-not-answer    it took longer than DOOR_WAIT_MS              504
//   app-answer-too-large  its answer cannot travel back as one packet   502

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const relayRequest = require('./relayRequest');
const limits = require('./limits');

// One label, as faceRoute.nameOf reads a host: a manifest cannot claim a
// name no visitor could ever type.
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Nests inside appFaceApp's SERVE_WAIT_MS (18 s), which nests inside
// puppetPost's FACE_WAIT_MS (30 s), so each wait gives its own named answer.
const DOOR_WAIT_MS = 12000;

// The answer rides back to the face inside one sealed packet, as JSON, so
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

function faceNameOf(manifest) {
  const f = manifest && manifest.face;
  return typeof f === 'string' && NAME_RE.test(f) ? f : '';
}

// THE NODE NAMES THE PIPE, and hands it to the process it starts, so it
// always knows where to knock and the app never chooses. A socket file in
// the app's own state folder off Windows (gitignored, file permissions). A
// Windows pipe name is global to the machine, and one box can run two nodes
// (Andy's and the agents'), so the name carries this checkout: a short hash
// of its root, or both nodes' 'hello' would collide.
function pipePathFor(rootDir, appName, platform) {
  if ((platform || process.platform) === 'win32') {
    const tag = crypto.createHash('sha256').update(path.resolve(String(rootDir))).digest('hex').slice(0, 12);
    return '\\\\.\\pipe\\spirit-' + tag + '-' + appName;
  }
  return path.join(rootDir, 'app-state', appName, 'door.sock');
}

// Every manifest that names a face, first by folder order; a second app
// naming the same face is not started, and said so.
function readFaces(rootDir, log) {
  const say = log || function () {};
  const byFace = Object.create(null);
  let names = [];
  try { names = fs.readdirSync(path.join(rootDir, 'app')).sort(); } catch (e) { return byFace; }
  names.forEach(function (app) {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'app', app, app + '.json'), 'utf8')); }
    catch (e) { return; }
    const face = faceNameOf(manifest);
    if (!face) return;
    if (byFace[face]) { say('app ' + app + ' also names the face "' + face + '", which ' + byFace[face] + ' serves: not started'); return; }
    byFace[face] = app;
  });
  return byFace;
}

function refusal(code, name) {
  return { status: STATUS[code], body: { ok: false, code: code, name: String(name || '') }, type: 'application/json; charset=utf-8' };
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
    const faces = readFaces(rootDir, log);
    return Object.keys(faces).map(function (face) {
      const app = faces[face];
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
      table[face] = row;
      log('app server for the face "' + face + '": ' + app);
      return face;
    });
  }

  function toLocalApp(name, req) {
    const face = String(name || '');
    const row = Object.prototype.hasOwnProperty.call(table, face) ? table[face] : null;
    if (!row) return Promise.resolve(refusal('app-not-served', face));
    const r = req || {};
    const body = typeof r.body === 'string' ? r.body : (r.body == null ? '' : JSON.stringify(r.body));
    if (Buffer.byteLength(body, 'utf8') > limits.BODY_MAX) return Promise.resolve(refusal('app-request-too-large', face));
    const p = String(r.path || '/');
    return Promise.resolve(request(row.pipe, String(r.method || 'GET'), p.charAt(0) === '/' ? p : '/' + p, body, {
      type: typeof r.type === 'string' ? r.type : '',
      timeoutMs: DOOR_WAIT_MS,
      answerMax: ANSWER_MAX,
    })).then(function (a) {
      if (!a || a.refused) return refusal((a && STATUS[a.refused]) ? a.refused : 'app-not-running', face);
      return { status: a.status, body: a.text, type: a.type };
    });
  }

  return {
    startAll: startAll,
    toLocalApp: toLocalApp,
    faces: function () { return Object.keys(table); },
  };
}

module.exports = {
  createAppServers: createAppServers,
  pipePathFor: pipePathFor,
  faceNameOf: faceNameOf,
  readFaces: readFaces,
  DOOR_WAIT_MS: DOOR_WAIT_MS,
  ANSWER_MAX: ANSWER_MAX,
  STATUS: STATUS,
};
