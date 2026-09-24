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

// ── WHAT AN APP MAY ASK FOR, AS TWO CLOSED SETS ─────────────────────
//
// DATA, NOT CODE — the plugin pattern this design arrived at three times
// from different directions: the manifest declares data and inherits the
// mechanism. A member outside these sets cannot be supplied, and the
// difference between saying so at LOAD and at REACH is the difference
// between naming the member and naming a runtime symptom while the
// author guesses.
//
// `verb` is the whole surface today, and that is not a placeholder: the
// sample declares it and nothing else, and an app that asks for nothing
// is handed nothing.
const SURFACE_MEMBERS = ['verb'];

// The optional layer (G4), and SEPARATELY optional — taking elements
// must not bring dialogs along. The files that satisfy these live in
// `app/shell/`, which every clone carries whether or not anything
// launches the shell; the vocabulary is here because the grant is a
// contract decision and the files are a deployment fact.
const UTILITIES = ['elements', 'tokens', 'dialogs'];

// ── THE CONTRACT IS CHECKED AT LOAD, AND THE MEMBER IS NAMED ────────
//
// Returns a standing refusal or null. G14: "refused at reach, the
// failure names a runtime symptom and the author guesses; refused at
// load, it names the member."
function checkContract(contract, appName) {
  const unknown = contract.surface.filter(function (m) { return SURFACE_MEMBERS.indexOf(m) === -1; });
  if (unknown.length) {
    return {
      code: 'app-surface-undeclared',
      app: appName,
      // NAMED, and the whole vocabulary beside it — an author who is
      // told only that something is wrong reads the source next.
      members: unknown,
      why: 'this server cannot supply ' + unknown.join(', ') + '; the surface is ' + SURFACE_MEMBERS.join(', '),
    };
  }
  return null;
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
    // THE REFUSAL CARRIES THE CONFIG, AND THAT IS THE WHOLE OF G16'S
    // FIRST HALF. Written without it, the caller had a refusal and no
    // relay, set `state.relay = ''`, and the running server then reported
    // "no relay configured" — FALSE, and the sentence an operator acts
    // on, while `app-state/<name>/config.json` still held relay, relayKey
    // and boundAt the entire time.
    //
    // A server that meets an impostor GOES ON SERVING THE RELAY IT IS
    // PINNED TO and reports the conflict. Going dark is the one response
    // that rewards the impostor: it costs the operator the service AND
    // tells them the wrong thing about why.
    // KEPT, NOT ONLY REFUSED — the same deterrent `pin()` writes when a
    // KEY contradicts. Refusing the second relay and writing nothing down
    // leaves the owner unable to tell a migration they made from an
    // attack they did not, and that is the whole value of the record.
    // Written ONCE, with both halves and when it was first seen.
    if (!cfg.contradiction) {
      cfg.contradiction = { held: cfg.relay, offered: String(asked), at: new Date().toISOString() };
      saveConfig(rootDir, appName, cfg);
    }
    return {
      ok: false,
      code: 'app-relay-key-changed',
      held: cfg.relay,
      offered: String(asked),
      config: cfg,
      relay: cfg.relay,
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
const relayRequest = require('./relayRequest').relayRequest;

// ── WHERE PATIENCE LIVES, AND WHERE IT DOES NOT ────────────────────
//
// `relayRequest` has no timeout, and that is CORRECT rather than a gap:
// it is the raw interface, and Andy ruled for the proxy that *"wait
// times are not the proxies concern"* — the caller's timeout is
// honoured when given. A shared module that imposed one would be
// deciding for callers it cannot see.
//
// THE PATIENCE OF A PEER POST LIVES IN peerPost, AND IT DIMINISHES.
// Andy asked where the diminishing-timeout logic was, and it is
// `peerPost.js:553-564`: the relay answers `grantedMs` = min(what we
// asked, its own ceiling), and the node SHRINKS ITS OWN TIMER to match,
// because *"asking 8 s of a relay that allows 5 s means the route is
// gone at 5 s… waiting the remaining three seconds holds this member's
// only slot for nothing — the asker blocking itself, which looks
// exactly like the relay blocking it."*
//
// ── WHICH MAKES THE FIRST VERSION OF THIS FILE A FOURTH FORK ────
//
// It reached the owner over `relayRequest` directly and bolted on a
// fixed eight-second timer of its own. That is a second copy of a
// policy that already exists, is negotiated with the relay, and is
// better than the copy — written twenty minutes after this design
// recorded three such forks (`ask`, `relayLimits`, `lib.sh`) as the
// disease it exists to prevent. Andy found it with one question.
//
// The reach goes through `peerPost` now. `relayRequest` is used for one
// thing only: `GET /api/relay/key`, which is not a peer post, has no
// route to hold open, and is what `hub.js:203` already uses it for.
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

// ── TAKING THE SEAT THE OWNER INSTALLED ─────────────────────────────
//
//   Andy, 2026-09-24: "The owner knows about the app. so he can install
//   the minted, relay invites, when he installs the app on a VPS." And:
//   "WE already have all those mechanisms proven during the
//   relay-install."
//
// DEPLOYMENT IS THE ENROLMENT, and that is the whole design. This server
// never asks to be seated: an app that could request its own membership
// would be negotiating its own position, and it does not have one. The
// owner mints an invite with the verb he already has and installs it
// beside the app, exactly as he installs the relay URL.
//
// So there is no enrolment flow, no approval screen and no in-band
// negotiation to build — the thing that looked like the next requirement
// turned out to be a line in a deployment.
//
// THE BUILDER IS `hub.sealedClaim` AND NOT A SECOND ONE. It seals to the
// relay's published cipher key, refuses a relay that publishes no signed
// key, and is the same motion the relay install is proven on.
function claimSeat(rootDir, appName, relayUrl, invite, inviteLabel) {
  const home = stateDir(rootDir, appName);
  const id = identity(rootDir, appName);
  // TWO WORDS, AND THEY ARE NOT THE SAME WORD. `name` is what this key
  // asks to be called on the relay; `inviteLabel` is what the owner wrote
  // on the invite when he minted it, matched and then forgotten. Passing
  // the app's name as both is what produced "invite label mismatch".
  const name = String(appName);
  return require('./hub').sealedClaim(relayUrl, home, name, invite, String(inviteLabel || appName))
    .then(function (sending) {
      // THE OBJECT, NOT ITS TEXT. `relayRequest` serialises the body
      // itself, so stringifying here sent the relay a JSON *string* where
      // it expected an object — and its refusal, "a claim must be sealed
      // to the cipher key this relay publishes", was true of what it
      // received and told me nothing about why. `hub.handleClaim` passes
      // `sending` straight through; copying the builder and not its call
      // was the whole of the bug.
      return relayRequest(relayUrl, 'POST', '/api/relay/claim', sending);
    })
    .then(function (r) {
      let said = null;
      try { said = JSON.parse((r && r.text) || '{}'); } catch (e) { said = null; }
      // ── A SEAT ALREADY HELD IS THE NORMAL CASE ──────────────────────
      //
      // Every restart after the first meets a spent invite, and a
      // deployment whose ordinary restart reads as an error is a
      // deployment somebody will "fix". 409 on our OWN key is us.
      if (r && r.status === 409 && said && said.peer && said.peer.publicKey === id.publicKey) {
        return { ok: true, already: true };
      }
      // 2xx, NOT 200. The relay answers 201 for a seat it just created,
      // and a check written as `=== 200` called a successful claim a
      // refusal — then reported "the relay refused this invite" about an
      // invite the relay had just accepted. `hub.handleClaim` has always
      // read it as a RANGE; I copied the builder and wrote my own
      // narrower test of its answer, which is the third time in this
      // cycle that taking a mechanism without its call site cost a bug.
      if (r && r.status >= 200 && r.status < 300) return { ok: true, already: false, reason: 'seated' };
      // ── AN EXPIRED INVITE IS ITS OWN ANSWER ─────────────────────────
      //
      // wsl-claude, refusing the first version: invites carry days and
      // the sweep removes them, so a deployment prepared on Monday and
      // started on Friday meets a token that is well-formed, correctly
      // stored, and DEAD. "Not yet a member" is true and useless there —
      // the operator pastes the same dead token again and again, because
      // THE ONE STATE THEY CAN ACTUALLY FIX READS EXACTLY LIKE THE TWO
      // THEY CANNOT.
      //
      // The relay already says it plainly (`invites.js:136`, 403 "invite
      // expired"), and a spent invite is DELETED rather than marked, so
      // an unknown token is the spent case. Three answers, three
      // sentences, and the owner is told which one he has to act on.
      const why = String((said && said.error) || '');
      return {
        ok: false,
        status: (r && r.status) || 0,
        reason: /expired/i.test(why) ? 'invite-expired' : 'invite-refused',
        error: why || 'the claim was refused',
        fix: /expired/i.test(why)
          ? 'this invite has expired — the owner mints a fresh one and installs it'
          : 'the relay refused this invite; a spent invite is deleted rather than marked, so an unknown token is one already used',
      };
    })
    .catch(function (e) { return { ok: false, status: 0, error: String((e && e.message) || e) }; });
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
// ── ONE ROUTER, HELD — AND EVERY OMISSION IS A DECISION ─────────────
//
// Andy: *"so we again have multiple implementations of peerPost()?"* No —
// ONE implementation and three instantiations: the node's
// (`server.js:1213`), the relay's partner router
// (`relayServer.js:1057`), and this. But the question found two real
// defects in this one.
//
// FIRST, IT WAS BUILT PER REACH. The other two build one per process and
// hold it, because peerPost carries a QUEUE and in-flight state, and
// cycle R16 made that queue outlive the process. A fresh router per call
// throws all of it away every time. Worse, the comment justifying it —
// *"a router kept alive is a queue kept alive, which is state this
// module has no business holding"* — was a shortcut dressed as a
// principle. It is built once now.
//
// SECOND, IT WAS WIRED BARE, WHICH IS HOW arrivals.js HAPPENED. Until
// 2026-09-13 `server.js` built its router without `onArrival`, so every
// packet a peer posted was *"admitted at the front door, written to the
// traffic log, answered with a bare receipt, and dropped. Nothing above
// the node boundary could ever see it"* — for months, because one call
// site was wired differently than the code assumed. An absent hook that
// nobody DECIDED is a dropped packet.
//
// So each absence here is a decision and says so:
//
//   store       ABSENT BY DECISION. peerPost's durable queue would make
//               an app server hold a post for an owner who is asleep —
//               and "refuse, never queue" is the design's own rule for
//               exactly that state, because whatever a visitor handed
//               over is short-lived and queueing it means STORING it.
//   answer      ABSENT. This server answers no verbs. It posts.
//   onArrival   ABSENT. It receives nothing; there is no app above the
//               node boundary here to hand a packet to.
//   admit /
//   remember /
//   traffic     ABSENT. It keeps no whoBook and no traffic log, because
//               it persists nothing about anybody by default.
//   checkTunnel TRUE, and the one that is present: a packet that would
//               not fit once wrapped must be refused at COMPOSE, since
//               a signed packet cannot be trimmed at the far hop.
// Keyed by the home it was built for: one process serves ONE app, but a
// suite drives several in one process, and a router silently shared
// between two identities would sign with the wrong key — a failure that
// would look like a permissions problem and be a bookkeeping one.
const heldRouters = Object.create(null);
function router(home) {
  if (heldRouters[home]) return heldRouters[home];
  heldRouters[home] = require('./peerPost').createPeerPost({
    rootDir: home,

    // ── A SLAVE TAKES ITS MASTER'S KEY FROM ITS MASTER ───────────────
    //
    //   Andy, 2026-09-24, ruling the shape of this: "think of it as: a
    //   public app-server under SpiritOS is a slave to it's owner, as it
    //   should." And on the procedure: "the join app needs the owner to
    //   be awake, an owner who is live is the suggested SOP."
    //
    // THIS IS WHY THE RELAY WAS THE WRONG ANSWER AND NOT MERELY THE
    // EXPENSIVE ONE. The relay holds the owner's card (relayStore.js,
    // members.card) and a route could have handed it over, which would
    // let an app server come up while its owner has never been reachable
    // — cold start. That is a slave arranging its master's business
    // behind the master's back, and it buys an autonomy nothing here is
    // supposed to have. Ruled out by Andy rather than by cost.
    //
    // SO THE CARD COMES FROM THE OWNER, OVER THE WIRE, SIGNED. If the
    // owner is not there, this server does nothing and says so — it does
    // not improvise a second source. A card request is the ONE packet
    // that may travel unsealed (`peerPost.js:697`, Andy: "card is the
    // only possible un-cyphered peerPost ... yes. VERY strict about
    // that!"), which is exactly what makes the first introduction
    // possible without a prior key, and why there was never a deadlock
    // here to break.
    keepCard: function (toKey, cardText) {
      const book = require('./contacts');
      // A card needs a row to sit on — `setCard` refuses one for a key it
      // has no row for, which is right: a card must not be smuggled in
      // beside an unverified one. The row is made at the lowest rank,
      // exactly as the node's own door does it (`server.js:1262`): seen,
      // not known, not listened to.
      //
      // THE ONE ROW THIS SERVER EVER WRITES ABOUT ANYBODY, and it is
      // about its OWNER — not a visitor. G9's "acts on nothing" is a
      // promise about strangers, and the suite checks the app's state
      // home for exactly that; the owner is the one party this server is
      // definitionally not anonymous to.
      if (!book.byPublicKey(home, toKey)) {
        book.upsert(home, { publicKey: toKey, acquiredVia: book.ROLL });
      }
      return book.setCard(home, toKey, cardText, 'reply');
    },

    // Read per post, never captured: a card can arrive, and a key can
    // rotate, while the process runs. Empty means the post is refused
    // rather than sent plain — the same rule the node holds itself to.
    sealKeyFor: function (toKey) {
      const book = require('./contacts');
      const row = book.byPublicKey(home, toKey);
      return (row && book.sealKeyOf(row)) || '';
    },

    // The node-to-relay leg, and it is the SAME FUNCTION a node uses —
    // `require('./hub').relayRequest === require('./relayRequest')
    // .relayRequest` is true, verified rather than assumed. They were
    // moved into one module on 2026-09-16 so a caller that is not the
    // node's hub could reach the one interface without dragging the
    // node's machinery behind it.
    request: relayRequest,
    checkTunnel: true,
  });
  return heldRouters[home];
}

function reachOwner(rootDir, appName, state, body) {
  if (!state.relay) return Promise.resolve({ ok: false, code: 'app-unbound' });
  if (!state.ownerKey) return Promise.resolve({ ok: false, code: 'app-unbound' });

  // THE KEY MUST EXIST BEFORE peerPost LOOKS FOR IT. Rewiring onto
  // peerPost dropped this call and the reach answered "this node has no
  // identity" — correct, and entirely my doing.
  identity(rootDir, appName);
  const poster = router(stateDir(rootDir, appName));

  // ── INTRODUCE YOURSELF BEFORE YOU SPEAK ─────────────────────────────
  //
  // A post to somebody whose card this server does not hold is refused at
  // 428 BEFORE ANYTHING LEAVES — `peerPost.js:749`, "no cipher key for
  // that peer — ask for their card first". That is not a fact about the
  // owner and must never be reported as one: this suite's owner-asleep
  // world passed for four minutes carrying that 428, and the state it
  // claimed to test had never happened.
  //
  // THE MOVE THE PROTOCOL ALREADY HAS. A card request travels unsealed,
  // by Andy's rule and only for this, so the introduction needs no prior
  // key. Contacts does exactly this to strangers; nothing here is new.
  //
  // AND IT MAKES THE SLEEPING OWNER HONEST. The request DEPARTS, so an
  // owner who is not answering produces a timeout — `app-owner-asleep`,
  // a fact about the owner — instead of this server's own refusal. The
  // wrong-code bug and the missing introduction were one defect.
  //
  // ONCE, AND THEN NEVER AGAIN: the card is kept, so this costs one
  // extra round trip on the first reach of a deployment's life.
  function introduced() {
    const book = require('./contacts');
    // THE SEAT COMES FIRST. A card request from a non-member is refused
    // by the relay before it is routed, which is how "owner asleep" read
    // as `app-not-a-member` for the second false green of the day.
    const row = book.byPublicKey(stateDir(rootDir, appName), state.ownerKey);
    if (row && book.sealKeyOf(row)) return Promise.resolve({ ok: true, held: true });
    return poster.post(state.relay, state.ownerKey, JSON.stringify({ v: 1, body: { card: true } }));
  }

  // post(relayUrl, toKey, text) — positional, and it answers a promise.
  // The identity it signs with is read from the rootDir it was built
  // with, which is why the app's key sits at
  // app-state/<name>/relay-state/identity.json: the nested path that
  // looked ugly an hour ago is what lets the one identity reader find
  // it without a second convention.
  // ── AND A FAILED INTRODUCTION IS THE ANSWER ─────────────────────────
  //
  // Written first as "introduce, then post regardless", which posted into
  // a peer this server still held no card for — so the real post was
  // refused at 428 by THIS server and the sleeping owner was reported as
  // the sender's own precondition all over again. The introduction had
  // been added and the bug it was added to fix survived it.
  //
  // IF THE INTRODUCTION DID NOT ARRIVE, NOTHING ELSE WILL. The card
  // request departs, so its failure is already a fact about the owner or
  // the relay, and it goes through the same classifier as any other
  // answer rather than being retold here.
  return Promise.resolve(state.seated)
    .catch(function () { return null; })
    .then(introduced)
    .then(function (hello) {
      if (hello && hello.held) return poster.post(state.relay, state.ownerKey, JSON.stringify(body || {}));
      if (!hello || !hello.ok) return hello || { ok: false, status: 0 };
      return poster.post(state.relay, state.ownerKey, JSON.stringify(body || {}));
    })
    .then(function (answer) {
      const a = answer || {};
      if (a.ok) return { ok: true, status: a.status || 200 };

      // ── CLASSIFIED BY THE CATALOGUE, NOT BY A TABLE IN THIS FILE ────
      //
      // `spiritErrors.classifyAnswer` already turns `{ok,status,error}`
      // into a known condition, and 66 of them were catalogued before
      // this module existed. A hand-rolled status map here would be the
      // FIFTH fork of something the tree already owns — and the first
      // version of this function nearly was one: it read 428 as
      // "the owner is asleep", when 428 is `no-cipher-key`, the
      // SENDER'S OWN refusal before anything leaves. Two different
      // facts, and only one of them is about the owner.
      const known = errors.classifyAnswer(a);
      // ── THE THREE FAILURES ARE DISTINGUISHED, NOT LUMPED ──────
      //
      // A relay that REFUSES to route answers; a relay that routes and
      // gets nothing back TIMES OUT. Those are different facts, and an
      // app that reported them alike would send an operator to fix the
      // wrong thing.
      // The relay declining to route FOR us: no seat, so there is
      // nothing to route. It ANSWERS, which is what distinguishes it.
      if (a.status === 403 || a.status === 404) {
        return { ok: false, code: 'app-not-a-member', status: a.status };
      }
      // Routed, and nobody home. 504 is peerPost's verdict after the
      // window THE RELAY granted — not after a number this file
      // invented, which is the whole point of going through peerPost.
      if (a.status === 504) {
        return {
          ok: false, code: 'app-owner-asleep',
          status: a.status, grantedMs: a.grantedMs,
        };
      }
      // ── AND THE RELAY SAYING SO OUTRIGHT ────────────────────────────
      //
      // `peer-unreachable`, 503: the relay knows the owner is not
      // connected and refuses immediately rather than holding the post
      // for a window — decision 0006, "refused instantly if the peer is
      // not there to receive it". THE SAME FACT AS THE 504, learned
      // sooner and more cheaply, and it is the answer a real deployment
      // meets most often because the relay usually knows.
      //
      // Translated into THIS server's closed set rather than forwarded.
      // `peer-unreachable` is the platform's word for any peer; an app
      // has exactly one peer it ever posts to, and for a visitor reading
      // the page the fact is that THE OWNER is not there.
      if (known && known.code === 'peer-unreachable') {
        return { ok: false, code: 'app-owner-asleep', status: a.status };
      }
      // Anything else is a real condition with a real name, and this
      // module does not get to rename it. A 428 here means this server
      // holds no card for its owner yet — a step of the bind sequence
      // that has not happened, and emphatically not a sleeping owner.
      return {
        ok: false,
        code: (known && known.code) || 'app-owner-asleep',
        status: a.status || 0,
        error: (known && known.text) || a.error,
      };
    })
    .catch(function () { return { ok: false, code: 'app-owner-asleep', status: 0 }; });
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
  // ── THE INVITE, AT FIRST START ONLY, LIKE THE RELAY ─────────────────
  //
  // Accepted once and read thereafter. A seat that can be re-pointed by
  // typing a different invite is not a seat the first bind settled, and
  // `--relay` is refused on the same grounds one function above.
  //
  // It is KEPT after it is spent, because "which invite seated this
  // server" is the owner's audit trail — he minted it, and he is the one
  // who has to tell a deployment he made from one he did not.
  const seatCfg = settled.config || loadConfig(rootDir, appName);
  if (o.invite && !seatCfg.invite) {
    seatCfg.invite = String(o.invite);
    // ── THE LABEL TRAVELS WITH THE INVITE, AND IS NOT THE APP'S NAME ──
    //
    // `inviteLabel` is what the OWNER wrote down to identify who he was
    // inviting; `name` is what this key wants to be called. Two different
    // words, and the relay matches the first (`relay.js`, "the word on
    // the invite, which is not the name being claimed").
    //
    // Built first as `cfg.label || appName`, which guessed — and guessed
    // wrong the moment a fixture minted an invite labelled anything but
    // the app's name, with the relay answering "invite label mismatch".
    // AN APP CANNOT DERIVE THIS: it is a word in the owner's head at the
    // moment he minted. So it is installed WITH the invite, by the
    // installer that already has both.
    if (o.inviteLabel) seatCfg.inviteLabel = String(o.inviteLabel);
    saveConfig(rootDir, appName, seatCfg);
  }

  let server = null;
  const state = {
    appName: appName,
    rootDir: rootDir,
    port: port,
    manifest: manifest,
    contract: contract,
    // THE HELD RELAY, WHETHER OR NOT THE CHANGE WAS REFUSED. `settled.relay`
    // is the pinned one in both cases now, so a refused `--relay` no longer
    // blinds the server to what it is bound to (G16).
    relay: settled.relay || '',
    relayRefusal: settled.ok ? null : settled,
    // The last reach this server attempted, so a refusal that happened is
    // OBSERVABLE rather than merely returned to whoever caused it. A state
    // a suite cannot read is a state nobody can monitor.
    lastReach: null,
    // The claim in flight, and how it ended. `seated` is the promise so a
    // reach can wait for it rather than racing it; `lastClaim` is the
    // verdict, reported like every other one.
    seated: null,
    lastClaim: null,
    // ── WHAT THE CONTRACT REFUSED, DECIDED ONCE AT LOAD ──────────────
    //
    // An impossible member and a non-strict posture are both properties
    // of the manifest, so they are settled when it is read rather than
    // re-decided per request. The ENFORCEMENT moment for posture is D1
    // and is Andy's to rule; this is the REPORT, which is needed either
    // way — a condition nothing can observe cannot be monitored, whether
    // it bites at load or at the door.
    contractRefusal: checkContract(contract, appName) ||
      (contract.posture !== 'strict'
        ? { code: 'app-not-strict', app: appName, posture: contract.posture || '(none declared)',
            why: 'a public app server serves strict apps; this manifest says ' + (contract.posture || 'nothing') }
        : null),
    // GRANTED, AND ONLY WHAT WAS ASKED FOR. Absent means nothing, so the
    // grant is the declaration intersected with what exists — never the
    // vocabulary handed out because nothing said otherwise.
    granted: {
      surface: contract.surface.filter(function (m) { return SURFACE_MEMBERS.indexOf(m) !== -1; }),
      // SEPARATELY OPTIONAL, which is G4 made observable instead of
      // described: this is a filter over what THIS app declared, so
      // asking for elements cannot bring dialogs along.
      utilities: contract.utilities.filter(function (u) { return UTILITIES.indexOf(u) !== -1; }),
    },
    // Learned from the relay, never configured. Empty until the relay is
    // claimed — which is why an app server WAITS rather than failing
    // while its relay is unclaimed: it has a relay, no owner, and
    // nothing wrong.
    ownerKey: '',
    ownerLabel: '',
    selfKey: '',
    lastBind: null,
    boundKey: (settled.config && settled.config.relayKey) || '',
  };

  // ── ONE APP, ONE WHITELIST, NO DISPATCH ─────────────────────────────
  //
  // A path outside the list is 404 before anything looks at it, which is
  // the same shape a relay's public surface already has. There is no app
  // dispatch here and there is not meant to be: fanning out to other apps
  // is the SHELL's job, which is what the shell's own app happens to do,
  // and a node that serves one app has nothing to fan.
  // ── THESE FILES ARE OFFERED; NO FOLDER IS SERVABLE ──────────────────
  //
  // G2's open question, answered the way it framed itself: *"offering
  // shell files widens the whitelist. It must be `these files are
  // offered`, never `the shell's folder is servable`."* So the shared
  // file is named, one entry, and a path that is not in this function is
  // 404 before anything looks at it. There is still no directory read
  // anywhere in this module.
  //
  // `app/shared/ask.js` is G3's one home. It is offered to every app
  // because the app contract is mandatory, not optional — the OPTIONAL
  // layer is `app/shell`'s elements and tokens (G4), and those are
  // granted per manifest, not handed out here.
  function servable(pathname) {
    const own = function (f) { return path.join(appDir(rootDir, appName), f); };
    if (pathname === '/' || pathname === '/index.html') return own(appName + '.html');
    const m = /^\/([A-Za-z0-9._-]+)$/.exec(pathname);
    if (!m) return null;
    if (m[1] === appName + '.html' || m[1] === appName + '.js') return own(m[1]);
    if (m[1] === 'ask.js') return path.join(rootDir, 'app', 'shared', 'ask.js');
    // ── A GRANT THAT SERVES NOTHING IS NOT A GRANT ──────────────────
    //
    // The optional layer is offered only to an app that DECLARED it, so
    // separability is enforced and not merely reported: an app granted
    // `elements` and not `tokens` gets 404 on tokens.css, and the
    // stylesheet is built to render without it for exactly that reason.
    //
    // Still one named file per entry — G2's rule holds here too, and
    // app/shell is never a servable folder.
    const util = { 'elements.css': 'elements', 'tokens.css': 'tokens' }[m[1]];
    if (util) {
      return state.granted.utilities.indexOf(util) === -1
        ? null
        : path.join(rootDir, 'app', 'shell', m[1]);
    }
    if (m[1] === 'favicon.svg') return null;
    return null;
  }

  // ── ONE SNAPSHOT, READ BY BOTH DOORS ────────────────────────────────
  //
  // `state()` is what a suite and an operator read in process; `app.state`
  // is what the page reads over HTTP. THEY MUST BE THE SAME FACTS. Two
  // builders would drift, and the drift would be invisible exactly the way
  // a fork is: nothing calls the other, so nothing can tell they disagree.
  function snapshot() {
    const r = roleOf(state);
    const standing = state.contractRefusal ||
      (state.relayRefusal
        ? { code: state.relayRefusal.code, held: state.relayRefusal.held, offered: state.relayRefusal.offered }
        : null);
    return {
      appName: state.appName,
      port: state.port,
      relay: state.relay,
      boundKey: state.boundKey,
      ownerKey: state.ownerKey,
      ownerLabel: state.ownerLabel || '',
      unbound: !state.ownerKey,
      lastBind: state.lastBind || null,
      // The last outward reach and how it ended. G16: a refusal that
      // happened must be observable, not merely returned to whoever
      // caused it.
      lastReach: state.lastReach || null,
      // Whether this server has a seat on the relay it serves. An owner
      // reading a server that cannot reach anybody needs to see this
      // before he looks at the relay.
      lastClaim: state.lastClaim || null,
      seated: !!(state.lastClaim && state.lastClaim.ok),
      // ── THE STANDING REFUSAL, AND IT CARRIES ITS CODE ───────────────
      //
      // A standing refusal must be walkable against the declared set, so
      // it is reported with its code and never as prose. The CONTRACT's
      // refusal comes first because it is decided at load and an app that
      // cannot be served at all is not made servable by its relay being
      // fine.
      //
      // `code` sits at the top as well as inside, because two different
      // readers ask this two different ways — one walks `refusal.code`
      // against the declared set, the other asks whether the server is
      // refusing at all. One fact, and neither reader has to know the
      // other's shape.
      code: standing ? standing.code : null,
      refusal: standing,
      // And this is the KEPT one, read back off the disc: what was held,
      // what was offered, and when it was first seen. Two questions about
      // one event — is it refusing now, and can the owner still tell a
      // migration from an attack tomorrow — so they are answered
      // separately rather than by one field doing double duty.
      contradiction: (function () {
        try { return loadConfig(rootDir, appName).contradiction || null; } catch (e) { return null; }
      }()),
      contract: state.contract,
      // WHAT WAS GRANTED, beside what was declared. The declaration is
      // the app's claim; these two are the server's answer, and a reader
      // comparing them can see a member that was asked for and withheld.
      surface: state.granted.surface.slice(),
      utilities: state.granted.utilities.slice(),
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
  }

  // ── THE DOOR'S VERBS, AND THE SURFACE IS WHAT WAS DECLARED ──────────
  //
  // `verb` is the one member the sample declares, and the door hands out
  // nothing that was not asked for: absent means nothing, here as
  // everywhere else in this file.
  function door(body) {
    const verb = String((body && body.verb) || '');
    if (!verb) return Promise.resolve({ ok: false, code: 'app-surface-undeclared', extra: { why: 'no verb named' } });
    if (contract.surface.indexOf('verb') === -1) {
      return Promise.resolve({ ok: false, code: 'app-surface-undeclared', extra: { app: appName, asked: verb } });
    }
    if (verb === 'app.state') return Promise.resolve({ ok: true, value: snapshot() });
    if (verb === 'app.reach') {
      // THE ONE OUTWARD ACT, and the thing that makes three of the four
      // failure states producible rather than merely catalogued. It was
      // written, classified correctly, and NEVER CALLED — the declared
      // surface had no route, so every refusal it could raise was
      // unreachable from outside this process.
      return reachOwner(rootDir, appName, state, body && body.args).then(function (r) {
        state.lastReach = r;
        if (r && r.ok) return { ok: true, value: { reached: true, status: r.status } };
        return { ok: false, code: (r && r.code) || 'app-owner-asleep', extra: { status: (r && r.status) || 0 } };
      });
    }
    return Promise.resolve({ ok: false, code: 'app-surface-undeclared', extra: { asked: verb } });
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
    // ── DECIDED AT LOAD, ENFORCED HERE ──────────────────────────────
    //
    // The contract was judged once when the manifest was read, and this
    // is where that judgement bites. Re-deriving it per request would be
    // two decisions about one manifest, which is a fork with extra steps.
    //
    // WHETHER IT SHOULD ALSO REFUSE TO START is D1, and it is ANDY'S to
    // rule — written apart from the settled half on purpose, because the
    // two sit one line from each other and the second would otherwise be
    // built on the momentum of the first. Until he rules, the condition
    // is decided at load, reported in state(), and refused at the door.
    if (state.contractRefusal) {
      const r = state.contractRefusal;
      return refuse(res, r.code, { app: r.app, members: r.members, posture: r.posture, why: r.why });
    }
    // ── THE CONFLICT IS REPORTED, NOT SERVED THROUGH THE DOOR ─────────
    //
    // This used to refuse EVERY request with `app-relay-key-changed`, so
    // a server that met an impostor went dark — which is the one response
    // that rewards the impostor twice: the operator loses the service and
    // is told the wrong reason. G16: a server meeting an impostor KEEPS
    // SERVING ITS PINNED RELAY and reports the conflict.
    //
    // So the conflict rides in `state()` and in the door's answer, where
    // an operator and a suite can both read it, and the page is still
    // served — the app is bound to the relay it was always bound to.

    // ── THE DOOR: ONE PATH, VERBS IN THE BODY ─────────────────────────
    //
    // `POST /api/spirit` is the whole of the app surface, and it is the
    // contract the sample's fourteen-line `ask` already speaks. It exists
    // here because a refusal that never reaches HTTP is a refusal nobody
    // outside this process can observe: `reachOwner` classified its
    // failures correctly from the day it was written, and NOTHING CALLED
    // IT — the declared `verb` surface had no route at all.
    if (pathname === '/api/spirit') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('the door takes POST');
      }
      // `serveCommon.readJsonBody` — the reader the node's own door has
      // used since before this module existed, already bounded and
      // already holding the chunked-body case. A private one here would
      // have been the sixth fork of the day.
      return common.readJsonBody(req).then(function (body) {
        return door(body || {});
      }).then(function (answer) {
        if (answer && answer.ok === false && answer.code) {
          return refuse(res, answer.code, answer.extra || {});
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(Object.assign({ ok: true }, answer && answer.value)));
      }).catch(function (e) {
        return refuse(res, 'app-owner-asleep', { why: String((e && e.message) || e) });
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
    return common.sendFile(res, file);
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
      if (p.ok && !state.seated) {
        // ── AND THEN TAKE THE SEAT, ONCE THE RELAY IS THE RIGHT ONE ───
        //
        // AFTER the pin, never before: claiming on a relay whose key has
        // not been checked would hand this server's identity to whoever
        // answered the URL, which is the whole thing the pin exists to
        // stop. The seat is worthless if it is taken at an impostor.
        const cfg = loadConfig(rootDir, appName);
        if (cfg.invite) {
          state.seated = claimSeat(rootDir, appName, state.relay, cfg.invite, cfg.inviteLabel || cfg.label || appName)
            .then(function (r) { state.lastClaim = r; return r; });
        } else {
          // NOT A FAULT, AN UNFINISHED DEPLOYMENT. The owner installs the
          // invite with the app; until he has, this server is not a
          // member and nothing it posts will be routed. Said plainly so
          // nobody debugs the relay for it.
          state.lastClaim = { ok: false, code: 'app-not-a-member', reason: 'no-invite', why: 'no invite installed — the owner mints one and installs it into app-state/<name>/config.json when he installs the app' };
        }
      }
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
    state: snapshot,
    handle: handle,
    start: function (cb) {
      // ── D1, RULED: A BAD MANIFEST REFUSES TO START ──────────────────
      //
      // Decided by Andy 2026-09-24, on two independent recommendations.
      //
      // MINE WAS ABOUT THE OPERATOR'S SCREEN: a public app server that
      // starts while it cannot serve anyone LOOKS HEALTHY AND IS NOT, and
      // on a box nobody is sitting at that is the worst failure
      // available. At load it lands at deploy time, the one moment
      // somebody is watching.
      //
      // WSL-CLAUDE'S WAS ABOUT THE AUDIENCE, and it is the better one, so
      // it is the one the rule should carry: A MISCONFIGURED MANIFEST IS
      // NOT A VISITOR STATE. The four G11 states are conditions a visitor
      // legitimately meets — nobody's fault, the world is simply like
      // that today. A non-strict app is a DEPLOYMENT THAT SHOULD NOT HAVE
      // HAPPENED, and the person owed an explanation is the operator at
      // deploy time, not a stranger at request time. Keeping the server
      // up to apologise to strangers for an error the operator fixes in
      // one line is the wrong audience.
      //
      // WHAT IT COSTS, SAID PLAINLY: the port is dead, so a visitor meets
      // connection-refused, which is indistinguishable from the box being
      // switched off. That is a real loss and it is accepted for the
      // reason above — NOT because failing early is generally better.
      //
      // AND IT CARRIES ITS DECLARED CODE — wsl-claude's condition, and
      // the thing most likely to be got wrong. A bare Error here would
      // trade a walkable refusal for a stack trace at the one moment it
      // matters most, putting the manifest error OUTSIDE the closed set
      // in the only path where nothing downstream can classify it. The
      // operator's screen gets a code they can search.
      if (state.contractRefusal) {
        const r = state.contractRefusal;
        const e = new Error(r.why || r.code);
        e.code = r.code;
        e.app = r.app;
        if (r.members) e.members = r.members;
        if (r.posture) e.posture = r.posture;
        throw e;
      }

      // The bind is attempted at start and its failure is NOT a reason
      // not to listen: an unclaimed relay, or one that is simply down,
      // leaves the app serving its page and acting on nothing. That is
      // the waiting state, and it is a state rather than a fault. THE
      // MANIFEST IS A DIFFERENT KIND OF WRONG from the relay being down,
      // which is why one refuses above and the other does not.
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

  // ── THE INVITE DOES NOT COME FROM ARGV, AND THAT WAS A DEFECT ───────
  //
  // Written first as `--invite <token>`, refused by wsl-claude before it
  // had been running an hour: AN INVITE ON THE COMMAND LINE IS A BEARER
  // TOKEN IN `ps`. `--relay` is a URL and `--port` is a number; an invite
  // is the first SECRET this module would have taken that way, and on a
  // VPS it lands in the process list for every user on the box, in shell
  // history, and in the unit file. First-bind-is-final stops it being
  // re-pointed; it does nothing about it being read.
  //
  // AND THE TREE ALREADY DOES IT THE OTHER WAY. `ownerClaim.js`: the
  // owner invite is minted by the installer, shown once, and pasted in.
  // Andy's words were "he can install the minted relay invites, WHEN HE
  // INSTALLS the app on a VPS" — INSTALL, not a flag.
  //
  // So the installer writes it into `app-state/<name>/config.json`, which
  // is where the pinned relay key already lives: gitignored, and safe
  // across a redeployment by G12 precisely because code is replaced and
  // state is not.

  if (!appName) {
    console.error('Refusing to start: --app needs the name of the app to serve,\n' +
      '  e.g. node js/server.js --app starter --port 65431');
    process.exit(1);
  }

  const h = create({ rootDir: ROOT_DIR, appName: appName, port: port, relay: relay });
  const s = h.state();

  // ── THE OPERATOR GETS A CODE, NOT A STACK TRACE ─────────────────────
  //
  // D1 refuses a bad manifest at start, and this is the screen that
  // refusal was ruled FOR: the operator, at deploy time, on the one
  // machine somebody is watching. An unhandled throw here would print a
  // trace of this file's internals — true, useless, and the opposite of
  // "refused at load names the member".
  try {
    h.start(started);
  } catch (e) {
    console.error('Refusing to start "' + appName + '" — ' + (e.code || 'app-refused'));
    console.error('    ' + (e.message || String(e)));
    if (e.members) console.error('    members: ' + e.members.join(', '));
    console.error('    the manifest is app/' + appName + '/' + appName + '.json');
    process.exit(1);
  }
  return h;

  function started(err, bound) {
    console.log('App server for "' + appName + '" listening on http://127.0.0.1:' + bound);
    console.log('    relay: ' + (s.relay || 'none configured yet (--relay <url> at first start)'));
    console.log('    state: ' + s.stateDir);
    if (s.unbound) {
      console.log('    UNBOUND — this relay has no owner yet. Serving, and acting on nothing.');
    }
    if (s.lastClaim && !s.lastClaim.ok) {
      console.log('    NO SEAT — ' + (s.lastClaim.why || s.lastClaim.error || s.lastClaim.reason));
    }
  }
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
