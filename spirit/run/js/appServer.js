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
// ── WHAT THIS SERVER SAYS ABOUT THE BOX IT SITS ON (G10) ────────
//
// Four fields, and one opinion deliberately withheld.
//
// THE GAP THIS CLOSES, which Andy found and neither agent had: remote
// resource configuration is PER SERVER; division of a box is PER BOX;
// nothing reconciles them. An owner can legitimately raise two servers
// on one VPS to eighty percent each from his own node and nothing
// notices until the box does. The INTERFACE that would show him is
// deferred by his ruling; the DATA is not, because adding it later
// touches every deployed server.
//
// A SERVER REPORTS FACTS AND NEVER AN OPINION. It says which box it
// believes it is on, what it was allotted, and what that box measures in
// total. It does NOT say "this box is over-committed", because it cannot
// know — it holds one report and the contradiction lives across
// several. The arithmetic belongs to the party holding all the reports,
// which is the owner's node, and which is also the party that will one
// day draw the screen. So no server here needs to know its siblings
// exist, and that is what keeps the deferral honest rather than
// half-kept.
//
// AND ONE FIELD IS DELIBERATELY ABSENT: anything about what the server
// is FOR. That is the app's business — *"a box view that starts
// carrying app facts is how the general layer acquires its first
// join-shaped wart"* (wsl-claude).
const os = require('os');
const crypto = require('crypto');
const relayLimits = require('./relayLimits');

// ── THE LABEL IS MINTED BY THE OWNER, LIKE AN INVITE ────────────────
//
// Not declared by the operator — two different boxes both saying
// `box-1` collide SILENTLY, and the owner then tunes a pair that does
// not exist. Not derived either: cloned VMs share a machine-id and
// containers inherit one from an image, so "unique per box" is a
// property no derived value actually has.
//
// The owner minting it makes collision IMPOSSIBLE rather than visible,
// and it is the pattern this system already uses for the only other
// thing that must be unique across strangers: an invite. One party does
// the naming, refuses a duplicate because it holds the whole list, and
// the server carries what it was given and echoes it back.
//
// Empty until the owner assigns one. An empty label is not a fault —
// it is a server that has not been named yet, which is every server
// before its first bind completes.
function boxLabel(cfg) {
  return String((cfg && cfg.boxLabel) || '');
}

// ── AND A LABEL CANNOT NOTICE IT HAS BECOME WRONG ──────────────────
//
// A server moved to another VPS, or an image cloned with its state,
// carries its label with it: still unique, now attached to the wrong
// machine, FAILING IN THE DIRECTION OF LOOKING CORRECT.
//
// So the server reports a second value it derives itself. Not to
// identify the box — this identifies nothing to anybody and carries
// nothing about a person — but so the owner's node can SEE A
// CONTRADICTION: two servers claiming one label with different
// fingerprints, or one server whose fingerprint changed between reports.
//
// Neither value is trustworthy alone. Together they are loud. This is
// the morning's rule in a new place: *freshness and citation are gates
// on provenance; the only gate on meaning is an independent derivation.*
// The label is the claim; this is the derivation; the owner has to trust
// neither.
//
// ── THE INGREDIENTS ARE NOT SETTLED, AND THEY ARE IN ONE PLACE ────
//
// Deliberately open in the design: a fingerprint must survive a reboot,
// change when the machine genuinely changes, and reveal nothing — and
// on WSL half the obvious ingredients lie. wsl-claude measures them on
// both platforms when Andy rules, and until then this is the SEAM and
// not the answer: one function, one list, one edit. What is required of
// it is fixed (stable, opaque, changes with the machine); what it is
// made of is not.
const FINGERPRINT_INGREDIENTS = ['hostname', 'platform', 'arch', 'totalmem'];

function fingerprint() {
  const parts = FINGERPRINT_INGREDIENTS.map(function (name) {
    if (name === 'hostname') return os.hostname();
    if (name === 'platform') return process.platform;
    if (name === 'arch') return process.arch;
    if (name === 'totalmem') return String(os.totalmem());
    return '';
  });
  // Hashed, so nothing about the box is legible in it — a value that
  // identifies nothing is the only kind that may travel to an owner who
  // did not ask for a machine's name.
  return crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32);
}

function boxReport(rootDir, appName) {
  const cfg = loadConfig(rootDir, appName);
  let measured = {};
  try { measured = relayLimits.measure(rootDir) || {}; } catch (e) { measured = {}; }
  return {
    // The label the owner minted, echoed back. Empty until named.
    boxLabel: boxLabel(cfg),
    // The independent derivation. Opaque, and it identifies nothing.
    fingerprint: fingerprint(),
    // What this server was given at install. Null rather than a guess:
    // a figure invented here is a figure the owner would have to
    // disbelieve, and he cannot tell an invented one from a real one.
    allottedMB: typeof cfg.allottedMB === 'number' ? cfg.allottedMB : null,
    // Free — measure() already produces it. It is what lets the owner
    // compute over-commitment without asking anybody, AND it lets two
    // servers on one box contradict each other about the box's own
    // size, which is another way the same lie surfaces.
    boxTotalMB: typeof measured.totalMB === 'number' ? measured.totalMB : null,
  };
}

// ── ASKING THE RELAY WHO IT IS, THROUGH THE ONE DOOR ────────────────
//
// `relayRequest` is the interface, and this module reaches for no socket
// of its own beyond the one it listens on. `/api/relay/key` is what a
// node already asks when it learns a relay's key (`hub.js:203`), and it
// answers the two things a bind needs: the relay's own public key, and
// `ownerKey` — which is the EMPTY STRING until the relay's first invited
// claim.
//
// That emptiness is not an error and it is why an app server WAITS: a
// relay is born unclaimed, so there is a window — exactly one per
// deployment — in which the app has a relay, no owner, and nothing
// wrong.
const relayRequestRaw = require('./relayRequest').relayRequest;

// ── AND IT IS BOUNDED HERE, BECAUSE relayRequest IS NOT ──────────────
//
// Measured: `relayRequest` has no timeout of any kind, so a relay that
// accepts a connection and never answers holds this process for as long
// as the far end likes. That is tolerable for a personal node where a
// human is watching; it is not tolerable for a server strangers reach,
// and it is absurd in the ONE state this module exists to handle
// gracefully — the owner being asleep IS the far end not answering.
//
// Found the honest way: wsl-claude's suite drove it against a world with
// no owner in it and took 103 SECONDS instead of failing. A hang is the
// worst failure shape available, because it is indistinguishable from
// work.
//
// The bound is set HERE and not in relayRequest, deliberately. Andy
// ruled for the proxy that *"wait times are not the proxies concern"* —
// the caller's timeout is honoured when given. The same holds one layer
// down: the interface carries the socket, the caller carries the
// patience, and a shared module that imposed one would be deciding for
// callers it cannot see.
const REACH_MS = 8000;

function relayRequest(url, method, pathname, body) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      // Not an error — an ANSWER, and the one the states are written
      // around. A timeout that threw would make "the owner is asleep"
      // arrive as a stack trace.
      resolve({ status: 0, text: '', timedOut: true });
    }, REACH_MS);
    relayRequestRaw(url, method, pathname, body).then(function (r) {
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(r);
    }, function (e) {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(e);
    });
  });
}

function askRelay(url) {
  return relayRequest(url, 'GET', '/api/relay/key', null)
    .then(function (r) {
      // `relayRequest` resolves `{ status, text }` and parses nothing —
      // checked rather than assumed, after this read `r.json` and
      // treated every successful answer as a relay that did not reply.
      // A 200 reported as silence is the worst shape of wrong: it looks
      // like the network and it is the caller.
      let b = {};
      try { b = JSON.parse((r && r.text) || '{}'); } catch (e) { b = {}; }
      return {
        ok: r && r.status === 200,
        status: (r && r.status) || 0,
        relayKey: String(b.relayPublicKey || ''),
        ownerKey: String(b.ownerKey || ''),
        ownerLabel: String(b.ownerLabel || ''),
      };
    })
    .catch(function (e) { return { ok: false, status: 0, error: e.message }; });
}

// ── THE PIN, AND WHY IT IS THE KEY AND NEVER THE URL ────────────────
//
// A URL is a name somebody else controls. An expired domain, a DNS
// change, a restored backup or a typo answers once and — under a plain
// *learns its owner* — owns the app for good. So the first answer's
// relay key is written into `app-state/<name>/config.json`, and from
// then on it is the thing that must match.
//
// A LATER DIFFERENT KEY IS REFUSED, KEPT AND REPORTED. Refused, so a
// wrong owner cannot take over. Kept, so the contradiction survives
// rather than being a thing somebody remembers. Reported, because a
// relay answering with a different key is either a migration the owner
// made or an attack, and **only the owner can tell which** — which is
// also why this module does not try to guess.
function pin(rootDir, appName, seen) {
  const cfg = loadConfig(rootDir, appName);
  if (!cfg.relayKey) {
    cfg.relayKey = seen;
    cfg.boundAt = new Date().toISOString();
    return { ok: true, key: seen, first: true, config: saveConfig(rootDir, appName, cfg) };
  }
  if (cfg.relayKey !== seen) {
    // KEPT. The contradiction is written down, once, with both halves
    // and when it was first seen — a deterrent nobody can produce is
    // not a deterrent.
    if (!cfg.contradiction) {
      cfg.contradiction = { held: cfg.relayKey, offered: seen, at: new Date().toISOString() };
      saveConfig(rootDir, appName, cfg);
    }
    return { ok: false, code: 'app-relay-key-changed', held: cfg.relayKey, offered: seen };
  }
  return { ok: true, key: seen, first: false, config: cfg };
}

// ── THE APP SERVER'S OWN IDENTITY, AND WHERE ITS KEY LIVES ──────
//
// An app server is an ordinary member of the relay it serves — no
// privileged status, no second protocol. Its only power is that the
// owner's node answers it. So it needs a key, and the key is a file.
//
// WRITTEN BY relayAuth.saveIdentity AND NOT BY A SECOND WRITER, which
// costs a nested path: `app-state/<name>/relay-state/identity.json`.
// That is uglier than it should be and it is the right trade. A second
// identity writer would drift from the first, and this design spent a
// whole sitting on three things that forked for exactly that reason —
// `ask`, `relayLimits`, `lib.sh`. Reusing it also gets the 600/700
// permissions for free, which is the difference between a private key
// and a readable file on a box strangers can reach.
//
// It is under `app-state/` rather than `app/` for G12's reason: a
// deployment replaces CODE. An identity inside the code folder is an
// identity a redeployment destroys, and a node that loses its key does
// not lose a password — it ceases to be that person.
const auth = require('./relayAuth');

function identity(rootDir, appName) {
  const home = stateDir(rootDir, appName);
  let id = null;
  try { id = auth.loadIdentity(home); } catch (e) { id = null; }
  if (id) return id;
  id = auth.generateIdentity(appName);
  auth.saveIdentity(home, id);
  return id;
}

// ── REACHING THE OWNER, AND THE THREE WAYS IT FAILS ────────────────
//
// The starter's whole job, per G13: bind, learn the owner, serve a page,
// post to the owner's node — and nothing else. This is the post.
//
// IT IS WHAT MAKES THREE OF THE FOUR FAILURE STATES REAL RATHER THAN
// DESCRIBED. Without an actual attempt, `app-owner-asleep` and
// `app-not-a-member` are sentences in a catalogue that nothing can
// produce, which is the thing G11 exists to prevent: *if a state cannot
// be reached from outside, it is not testable by anyone, ever.*
//
//   no owner yet          → app-unbound     (the relay is unclaimed)
//   the relay refuses us   → app-not-a-member (no seat; a relay routes
//                            between members, so there is nothing to
//                            route)
//   routed, nobody home    → app-owner-asleep (the relay waited on the
//                            owner's node and gave up)
//
// AND THE SECOND IS NOT INFERRED FROM THE THIRD. A relay that refuses
// the post answers; a relay that routes it and gets nothing back times
// out. Those are different facts and an app that reported them alike
// would tell an operator to fix the wrong thing.
function reachOwner(rootDir, appName, state, body) {
  if (!state.relay) return Promise.resolve({ ok: false, code: 'app-unbound' });
  if (!state.ownerKey) return Promise.resolve({ ok: false, code: 'app-unbound' });

  const me = identity(rootDir, appName);
  const sending = {
    to: state.ownerKey,
    from: me.publicKey,
    text: JSON.stringify(body || {}),
    sentAt: new Date().toISOString(),
  };
  sending.sig = auth.sign(me.privateKey, auth.postMessage(sending));

  return relayRequest(state.relay, 'POST', '/api/relay/post', sending)
    .then(function (r) {
      if (r.status === 200) return { ok: true, status: 200 };
      // 403/404 from the relay is the relay declining to route FOR us,
      // which means this server holds no seat.
      if (r.status === 403 || r.status === 404) {
        return { ok: false, code: 'app-not-a-member', status: r.status };
      }
      // A timeout is the relay waiting on the owner's node. The owner
      // exists, the seat exists, the person is not there.
      return { ok: false, code: 'app-owner-asleep', status: r.status };
    })
    .catch(function () {
      return { ok: false, code: 'app-owner-asleep', status: 0 };
    });
}

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
    ownerLabel: '',
    selfKey: '',
    lastBind: null,
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

  // ── THE BIND, RUN ONCE AT START AND RE-CHECKABLE ────────────────────
  //
  // Nothing here is cached as a decision. The relay's answer is stored
  // so the page can be served without a round trip per request, but the
  // ROLE is derived from it every time it is asked (G7) — a cached "I
  // own this" is how a node believes it owns something it no longer
  // does, and the tempting implementation is exactly a one-minute cache.
  //
  // FAILS CLOSED. An unreachable relay leaves `ownerKey` empty, which
  // means unbound, which means the app acts on nothing. Unknown is never
  // "assume yes because it was yes a minute ago".
  function bind() {
    if (!state.relay) {
      state.lastBind = { ok: false, code: 'app-unbound', why: 'no relay configured' };
      return Promise.resolve(state.lastBind);
    }
    return askRelay(state.relay).then(function (seen) {
      if (!seen.ok || !seen.relayKey) {
        // The relay did not answer, or answered without a key. Not a
        // contradiction — an absence. The app waits.
        state.ownerKey = '';
        state.lastBind = { ok: false, code: 'app-unbound', why: 'relay did not answer', status: seen.status };
        return state.lastBind;
      }
      const p = pin(rootDir, appName, seen.relayKey);
      if (!p.ok) {
        state.relayRefusal = p;
        state.ownerKey = '';
        state.lastBind = p;
        return p;
      }
      state.boundKey = p.key;
      // LEARNED, NEVER CONFIGURED. Empty is the unclaimed relay, and
      // that is a state the app serves through rather than fails on.
      state.ownerKey = seen.ownerKey;
      state.ownerLabel = seen.ownerLabel;
      state.lastBind = { ok: true, first: p.first, relayKey: p.key, unbound: !seen.ownerKey };
      return state.lastBind;
    });
  }

  return {
    bind: bind,
    // The starter's one outward act, and the thing that makes three of
    // the four failure states producible rather than merely catalogued.
    reachOwner: function (body) { return reachOwner(rootDir, appName, state, body); },
    identity: function () { return identity(rootDir, appName); },
    state: function () {
      const r = roleOf(state);
      return {
        appName: state.appName,
        port: state.port,
        relay: state.relay,
        boundKey: state.boundKey,
        ownerKey: state.ownerKey,
        ownerLabel: state.ownerLabel || '',
        unbound: !state.ownerKey,
        lastBind: state.lastBind || null,
        contract: state.contract,
        refusals: PLATFORM_REFUSALS.slice(),
        nodeIsOwnerNode: r.nodeIsOwnerNode,
        nodeIsPublicApp: r.nodeIsPublicApp,
        // G10. Facts about the box, and no opinion about them.
        box: boxReport(rootDir, appName),
        // This server's own public key. It is an ordinary member of the
        // relay it serves; its only power is that the owner answers it.
        selfKey: (function () { try { return identity(rootDir, appName).publicKey; } catch (e) { return ''; } }()),
        stateDir: stateDir(rootDir, appName),
      };
    },
    handle: handle,
    start: function (cb) {
      // The bind is attempted at start and its failure is NOT a reason
      // not to listen: an unclaimed relay, or one that is simply down,
      // leaves the app serving its page and acting on nothing. That is
      // the waiting state, and it is a state rather than a fault.
      bind();
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
  boxReport: boxReport,
  FINGERPRINT_INGREDIENTS: FINGERPRINT_INGREDIENTS,
};
