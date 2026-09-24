'use strict';

// spirit/run/js/appServer.js
// A NODE THAT SERVES ONE APP, AND NOTHING ELSE.
//
// The third startup module, beside `server.js` (a personal node) and
// `relayServer.js` (a relay). Cycle 0 decided the shape and this follows
// it: node and relay are separate startup modules so a relay loads no
// node code, and the same holds here — an app server loads neither the
// shell nor the relay.
//
//   node js/server.js --app <name> --port <n> [--relay <url>]
//
// ── IT IS NOT NAMED FOR PUBLICNESS, AND THAT WAS ARGUED ──────────────
//
// The obvious name was `publicAppServer.js`. It is wrong, and the design
// says why (design/shell/PUBLIC-APP-SERVER.md): **publicness is a
// DEPLOYMENT fact** — a Caddy block, a whitelist, `noindex`, a DNS
// record — and not an architectural one. The same module on loopback is
// the same module. So the mode names what the process IS — one app, no
// dispatch — rather than where it sits.
//
// ── WHAT A NODE IS, IN ONE SENTENCE ──────────────────────────────────
//
// **A node serves exactly one intrinsic app.** The tree already used the
// words before this module existed: *"an intrinsic app is what this node
// IS"* (`client/shell.js:478`). A personal node's one app is the shell,
// whose particular job is fanning out to others. This one's is whatever
// `--app` names, and it fans out to nothing.
//
// ── REQUIRING THIS FILE STARTS NOTHING ───────────────────────────────
//
// `create()` builds a handle and listens on nothing until `start()`.
// That is deliberate and it is a requirement (G15): the suite that holds
// this honest drives the MODULE, not a command line, and a module that
// listened on require could not be driven at all. `fromArgv` is the only
// thing that reads process arguments, and `server.js` calls it.

const http = require('http');
const fs = require('fs');
const path = require('path');
const common = require('./serveCommon');
const errors = require('./spiritErrors');

const ROOT_DIR = path.join(__dirname, '..');

// ── WHERE AN APP'S STATE LIVES, AND WHY NOT BESIDE ITS CODE ──────────
//
// `app-state/<name>/`, never `app/<name>/`. The convention that code and
// data share a folder was written when apps were files inside a private
// shell; an app served to strangers is **deployed by replacement**, and
// then the two cannot share:
//
//   replace the folder  → whatever sat beside the code is destroyed
//   merge the folder    → orphans nobody can reason about
//
// wsl-claude, deciding it: *"both are wrong and the second is worse,
// because it looks fine."* `relay-state/` is the shape being copied —
// gitignored, deployment-safe, never confused with code.
//
// It costs almost nothing today, because an app serving strangers
// persists nothing about a visitor by default. It prevents the one thing
// that is unrecoverable later: a redeployment silently eating data an app
// was trusted with.
function stateDir(rootDir, appName) {
  return path.join(rootDir, 'app-state', appName);
}

function appDir(rootDir, appName) {
  return path.join(rootDir, 'app', appName);
}

// The manifest is `app/<name>/<name>.json` — the convention the tree
// already enforces and protects (`kernel.js`'s MANIFEST_PATTERN, which
// refuses to let anything write one). Nothing new is invented here.
function manifestPath(rootDir, appName) {
  return path.join(appDir(rootDir, appName), appName + '.json');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

// ── THE APP CONTRACT: NOTHING IS GRANTED THAT WAS NOT ASKED FOR ──────
//
// An app declares what it takes, in the manifest it already has:
//
//   "surface":   which members of api.* it relies on
//   "utilities": "elements", "dialogs", "tokens" — separately
//   "posture":   "strict" for an app serving strangers
//
// **ABSENT MEANS NOTHING.** An app that declares no surface is handed
// none. The tempting default is absent-means-everything, because it
// makes the first app easy to write — and wsl-claude killed it with the
// argument that decides it: *"absent-means-everything is UNASSERTABLE.
// If an undeclared app gets the whole surface, then 'every member an app
// touches is in its surface' is vacuously satisfied by every app that
// declares nothing, and dead surface can never be counted."*
//
// So the permissive default would have made the app contract a check
// that cannot fail — inside the requirement written to make the boundary
// checkable.
function contractOf(manifest) {
  const m = manifest || {};
  const list = function (v) { return Array.isArray(v) ? v.slice() : []; };
  return {
    surface: list(m.surface),
    utilities: list(m.utilities),
    posture: typeof m.posture === 'string' ? m.posture : '',
    // An app's own refusals, in the same shape as the platform's. Data,
    // closed, and reviewable once — never assembled at the moment of
    // refusing, which is how a figure ends up inside a sentence.
    refusals: (m.refusals && typeof m.refusals === 'object') ? m.refusals : {},
  };
}

// ── WHAT THIS SERVER CAN REFUSE, AS A CLOSED SET ─────────────────────
//
// The platform's refusals are `spiritErrors` entries, because that
// catalogue is already closed, already answers `byCode()`, and already
// has a suite holding it honest. Nothing here invents a second
// mechanism — it names the codes this module may emit, so a walk can ask
// whether anything outside the set was ever sent.
//
// A refusal carries a CODE and not only prose. Prose cannot be matched
// against a set, and a set that cannot be matched is a list of good
// intentions.
const PLATFORM_REFUSALS = [
  'app-unbound',
  'app-relay-full',
  'app-owner-asleep',
  'app-relay-key-changed',
  'app-not-a-member',
  'app-surface-undeclared',
  'app-not-strict',
];

function refuse(res, code, extra) {
  const e = errors.byCode(code);
  const status = (e && e.status) || 500;
  const body = { ok: false, status: status, code: code, error: (e && e.text) || code };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// ── THE BIND: ONE RELAY, PINNED BY ITS KEY AND NOT BY ITS URL ────────
//
// An app server serves exactly one relay and learns its owner FROM that
// relay. Two properties make that safe, and both lived only in an
// exchange between the agents until the design was signed:
//
//   PIN THE IDENTITY KEY, NEVER THE URL. A URL is a name somebody else
//   controls — an expired domain, a DNS change, a restored backup or a
//   typo answers once and, under "learns its owner", owns the app for
//   good.
//
//   THE FIRST BIND IS FINAL. A later different answer is REFUSED, KEPT
//   and REPORTED: refused so a wrong owner cannot take over, kept so the
//   contradiction survives, reported because a relay answering with a
//   different key is either a migration the owner made or an attack, and
//   only the owner can tell which.
//
// This is cycle 10's card-ordering argument arriving at the bind:
// *accepted once, from whoever got there first* is not the same as
// *accepted from anywhere the signature holds*.
function configFile(rootDir, appName) {
  return path.join(stateDir(rootDir, appName), 'config.json');
}

function loadConfig(rootDir, appName) {
  return readJson(configFile(rootDir, appName)) || {};
}

function saveConfig(rootDir, appName, cfg) {
  const dir = stateDir(rootDir, appName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configFile(rootDir, appName), JSON.stringify(cfg, null, 2));
  return cfg;
}

// `--relay` is accepted at FIRST START ONLY. Afterwards it is read, and a
// different one is refused rather than obeyed — because first-bind-is-
// final is trivially bypassed at a command line otherwise, and a
// property that can be undone by typing is not a property.
function settleRelay(rootDir, appName, asked) {
  const cfg = loadConfig(rootDir, appName);
  if (!cfg.relay) {
    if (!asked) return { ok: true, config: cfg, relay: '' };
    cfg.relay = String(asked);
    return { ok: true, config: saveConfig(rootDir, appName, cfg), relay: cfg.relay };
  }
  if (asked && String(asked) !== cfg.relay) {
    return {
      ok: false,
      code: 'app-relay-key-changed',
      held: cfg.relay,
      offered: String(asked),
    };
  }
  return { ok: true, config: cfg, relay: cfg.relay };
}

// ── THE ROLE IS ASKED, NEVER CACHED, AND FAILS CLOSED ────────────────
//
// `nodeIsOwnerNode` and `nodeIsPublicApp` would be the first constants
// of their kind — the shell holds no concept of a node's role at all,
// only four constants, none of which say what kind of node this is.
//
// The danger is the reason for the rule: a cached "I own this" is how a
// node believes it owns something it no longer does. So it is derived on
// demand and **unknown means NOT the owner node** — never "assume yes
// because it was yes a minute ago", because the tempting implementation
// is a one-minute cache that reintroduces exactly what the rule prevents.
function roleOf(state) {
  return {
    nodeIsPublicApp: true,
    // FAIL CLOSED. An unreachable relay means unknown, and unknown is
    // not the owner.
    nodeIsOwnerNode: state.ownerKey ? state.ownerKey === state.selfKey : false,
  };
}

function create(opts) {
  const o = opts || {};
  const rootDir = o.rootDir || ROOT_DIR;
  const appName = String(o.appName || '');
  const port = Number(o.port) || 0;

  if (!appName) throw new Error('appServer.create needs an appName');

  const manifest = readJson(manifestPath(rootDir, appName));
  const contract = contractOf(manifest);
  const settled = settleRelay(rootDir, appName, o.relay);

  let server = null;
  const state = {
    appName: appName,
    rootDir: rootDir,
    port: port,
    manifest: manifest,
    contract: contract,
    relay: settled.ok ? settled.relay : '',
    relayRefusal: settled.ok ? null : settled,
    // Learned from the relay, never configured. Empty until the relay is
    // claimed — which is why an app server WAITS rather than failing
    // while its relay is unclaimed: it has a relay, no owner, and
    // nothing wrong.
    ownerKey: '',
    selfKey: '',
    boundKey: (settled.ok && settled.config && settled.config.relayKey) || '',
  };

  // ── ONE APP, ONE WHITELIST, NO DISPATCH ─────────────────────────────
  //
  // A path outside the list is 404 before anything looks at it, which is
  // the same shape a relay's public surface already has. There is no app
  // dispatch here and there is not meant to be: fanning out to other apps
  // is the SHELL's job, which is what the shell's own app happens to do,
  // and a node that serves one app has nothing to fan.
  function servable(pathname) {
    if (pathname === '/' || pathname === '/index.html') return appName + '.html';
    const m = /^\/([A-Za-z0-9._-]+)$/.exec(pathname);
    if (!m) return null;
    if (m[1] === appName + '.html' || m[1] === appName + '.js') return m[1];
    if (m[1] === 'favicon.svg') return null;
    return null;
  }

  function handle(req, res) {
    const pathname = common.parseRequestPath
      ? common.parseRequestPath(req).pathname
      : String(req.url || '').split('?')[0];

    // THE APP CONTRACT IS CHECKED BEFORE ANYTHING IS SERVED, not at the
    // moment an app reaches for something. Refused at load the message
    // names the member; refused at reach it names a runtime symptom and
    // the author guesses.
    // ABSENT MEANS NOTHING, AND THIS IS WHERE THAT IS TRUE OR MERELY
    // ARGUED. Written first as `!manifest`, which only caught an app
    // with no manifest FILE — so an app that shipped a manifest and
    // declared no surface was served as though it had asked for
    // nothing and been granted it, which is the permissive default
    // arriving by accident in the one place the design refused it.
    // Found by probing rather than by reading.
    if (!manifest || !contract.surface.length) {
      return refuse(res, 'app-surface-undeclared', {
        app: appName, manifest: manifest ? 'present' : 'missing',
      });
    }
    if (contract.posture !== 'strict') {
      return refuse(res, 'app-not-strict', { app: appName });
    }
    if (state.relayRefusal) {
      return refuse(res, 'app-relay-key-changed', {
        held: state.relayRefusal.held, offered: state.relayRefusal.offered,
      });
    }

    const file = servable(pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('no such path here');
    }

    // WAITING IS NOT FAILING. A relay that has no owner yet is the state
    // every deployment passes through exactly once, in production, seen
    // by a stranger — so it serves the app's page and acts on nothing,
    // rather than refusing to start.
    res.setHeader('X-Robots-Tag', 'noindex');
    return common.sendFile(res, path.join(appDir(rootDir, appName), file));
  }

  return {
    state: function () {
      const r = roleOf(state);
      return {
        appName: state.appName,
        port: state.port,
        relay: state.relay,
        boundKey: state.boundKey,
        ownerKey: state.ownerKey,
        unbound: !state.ownerKey,
        contract: state.contract,
        refusals: PLATFORM_REFUSALS.slice(),
        nodeIsOwnerNode: r.nodeIsOwnerNode,
        nodeIsPublicApp: r.nodeIsPublicApp,
        stateDir: stateDir(rootDir, appName),
      };
    },
    handle: handle,
    start: function (cb) {
      server = http.createServer(handle);
      // LOOPBACK ONLY. Publicness is Caddy's, a whitelist's and a DNS
      // record's — never this process's.
      server.listen(port, '127.0.0.1', function () {
        if (typeof cb === 'function') cb(null, server.address().port);
      });
      if (common.refuseListenError) common.refuseListenError(server, port, 'js/server.js --app ' + appName);
      return server;
    },
    stop: function (cb) {
      if (!server) { if (cb) cb(); return; }
      server.close(function () { server = null; if (cb) cb(); });
    },
  };
}

// The ONLY thing here that reads process arguments. `server.js` calls it;
// nothing else does, and requiring this file runs none of it.
function fromArgv(argv) {
  const args = (argv || []).slice(2);
  const at = function (flag) {
    const i = args.indexOf(flag);
    return i === -1 ? '' : String(args[i + 1] || '');
  };
  const appName = at('--app');
  const port = Number(common.portFromArgs(args)) || 0;
  const relay = at('--relay');

  if (!appName) {
    console.error('Refusing to start: --app needs the name of the app to serve,\n' +
      '  e.g. node js/server.js --app starter --port 65431');
    process.exit(1);
  }

  const h = create({ rootDir: ROOT_DIR, appName: appName, port: port, relay: relay });
  const s = h.state();
  h.start(function (err, bound) {
    console.log('App server for "' + appName + '" listening on http://127.0.0.1:' + bound);
    console.log('    relay: ' + (s.relay || 'none configured yet (--relay <url> at first start)'));
    console.log('    state: ' + s.stateDir);
    if (s.unbound) {
      console.log('    UNBOUND — this relay has no owner yet. Serving, and acting on nothing.');
    }
  });
  return h;
}

module.exports = {
  create: create,
  fromArgv: fromArgv,
  PLATFORM_REFUSALS: PLATFORM_REFUSALS,
  stateDir: stateDir,
  manifestPath: manifestPath,
  contractOf: contractOf,
};
