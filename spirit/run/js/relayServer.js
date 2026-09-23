// ── THE PUBLIC RELAY'S OWN STARTUP MODULE ────────────────────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, decided by Andy
// 2026-09-19): a node and a relay are two different things, and the first
// step of separating them is two startup modules. Until then one
// js/server.js booted either, and a --relay process loaded the node's half
// and left it sitting in memory — hub, the traffic log, the jobs module
// with an fs-watcher scanning the whole root for a Files app a relay never
// serves. A relay's RAM is the most expensive thing it has (standing rule,
// same document), so it no longer loads any of that.
//
// `node js/server.js --relay` still works: server.js hands off to this
// file before it loads anything (the systemd unit starts it that way).
// `node js/relayServer.js` is the same process without the hand-off.
// (The Procfile and install-public-relay.js used to as well; both went in
// cycle 3 — a relay needs a persistent disc and SSH.)
//
// What a relay IS stays in relay.js. This file is only the HTTP in front
// of it: the public surface, the bind, the partner router and the
// goodbye.
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const relayConfig = require('./relayConfig');
const relayLimits = require('./relayLimits');
const spirit = require('./kernel');
const createRelay = require('./relay');
// For keyFromUrl only — translating a URL segment back to the stored key
// form. No secret reaches this side of the wire.
const deviceAuth = require('./deviceAuth');
// Resolved ONCE, here, as the process loads — see buildStamp.js. Asking
// again later would report whatever is on disk now, which is the lie
// this is meant to catch.
const buildStamp = require('./buildStamp');
const common = require('./serveCommon');
const streamSink = require('./streamSink');
// R36 phase B: a refusal carries the catalogue's code beside its sentence.
const spiritErrors = require('./spiritErrors');
const readJsonBody = common.readJsonBody;
const deviceRefusal = common.deviceRefusal;

// THE RELAY'S PORT, which is not the node's (65432). Caddy proxies :443 to
// 127.0.0.1:65430 on spirit-3 (bash/caddy/Caddyfile, bash/lib.sh), so a
// bare `node js/relayServer.js` lands where Caddy looks. Andy, 2026-09-19.
// --port and PORT still override it, and every deploy script passes one.
const DEFAULT_RELAY_PORT = 65430;

// How long a stream refused for being FULL is told to wait. The allowance
// is fixed at boot now (cycle 8), so it frees only when somebody leaves:
// half a minute is a guess at that, not a Governor's tick any more.
const FULL_RETRY_S = 30;

const BUILD = buildStamp.resolve(spirit.core.node.const.ROOT_DIR);
const STARTED_AT = new Date().toISOString();

// A relay's half: the peerPost it posts to partners from. Built after the
// server is listening. (The streams it held to them, partnerLinks, went in
// R13: a partner's answer is now the reply to the post that asked.)
let partnerRouter = null;

// Checked before verifyStartupCwd, on purpose — --help should work
// regardless of which directory this was launched from.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node js/relayServer.js [--port <number>]\n' +
    '   or: node js/server.js --relay [--port <number>]   (the same process)\n\n' +
    '  Runs a public relay: serves relay.html at / and /index.html, answers only\n' +
    '  the relay routes (/api/relay/*) and 404s everything else.\n' +
    '  Binds 0.0.0.0 (not loopback) and accepts any Host, since a relay is meant\n' +
    '  to be reached from the internet. A personal node is js/server.js.\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + DEFAULT_RELAY_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit").'
  );
  process.exit(0);
}

common.verifyStartupCwd('js/relayServer.js');

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const port = common.portFromArgs(process.argv.slice(2)) || process.env.PORT || DEFAULT_RELAY_PORT;

// ── ONE EXIT CODE FOR EVERY REFUSAL TO START (cycle 3, Part B) ───────
//
// 78 is EX_CONFIG (sysexits.h): "something was found in an unconfigured or
// misconfigured state". Every refusal below — node:sqlite missing, a store
// that cannot be opened, a config.json the box cannot honour, members with
// no owner — is a state a restart cannot fix. bash/systemd/
// spirit-relay.service names this code in RestartPreventExitStatus, so
// systemd stops retrying it every three seconds, and bash/restart and
// bash/update print the refusal from the journal (Andy: "forcing the owner
// to ssh and investigate").
const STARTUP_REFUSED = 78;

function refuseToStart(why) {
  console.error('Refusing to start: ' + why);
  process.exit(STARTUP_REFUSED);
}

// ── THE RELAY'S DATA IS ON DISC, OR THERE IS NO RELAY (cycle 3) ──────
//
// Members, invites and the partner roll live in relay-state/relay.db
// through node:sqlite (relayStore.js), and RAM is its client — there is
// no in-memory copy to fall back on. A Node too old to load the driver
// (floor 22.13) cannot be a relay, and says so now rather than on the
// first claim. The node never loads this module.
const relayStore = require('./relayStore');
if (!relayStore.available()) {
  refuseToStart('node:sqlite is not available in Node ' +
    process.version + ' — a relay needs 22.13 or later (relayStore.js)');
}
// Opened here, not on the first request, so a store that cannot be opened
// — a pre-cycle-3 file that cannot be imported — stops the start instead
// of the first member who knocks.
try { relayStore.open(spirit.core.node.const.ROOT_DIR); }
catch (e) {
  refuseToStart(e.message);
}

// ── COMPACTED BEFORE IT SERVES ANYTHING (cycle 9) ───────────────────
//
//   Andy, 2026-09-22: "compacting at restart sound like a good
//   stop-gap-measure."
//
// A deleted row frees a page and does not shorten the file, and cycle 9
// bounds the roll by the file's size — so without this, an owner who
// removes members to make room would be refused the shrink he just made
// room for. Here, before `server.listen`, because `node:sqlite` is
// synchronous and a VACUUM while serving is dead air for every member.
// It refuses itself when the disc cannot afford the copy, and says so.
{
  const room = relayLimits.measure(ROOT_DIR);
  const squeezed = relayStore.compact(ROOT_DIR, room.discFreeMB);
  if (squeezed.ok && squeezed.after < squeezed.before) {
    console.log('    compacted relay.db: ' + (squeezed.before / 1048576).toFixed(2) + ' MB → ' +
      (squeezed.after / 1048576).toFixed(2) + ' MB in ' + squeezed.ms + ' ms');
  } else if (!squeezed.ok && squeezed.why && !/no database yet/.test(squeezed.why)) {
    console.log('    relay.db NOT compacted: ' + squeezed.why);
  }
}

// ── MEMBERS BUT NO OWNER: REFUSE, AND LET SSH DECIDE (cycle 3, B4) ───
//
// Decided (Andy): a relay whose store holds members but whose allow.json
// has no owner refuses to start — "forcing the owner to ssh and
// investigate". The alternative is a relay that looks UNCLAIMED with
// people on it, where whoever holds the next owner invite takes the box
// and everyone in it. No members and no owner is simply UNCLAIMED, which
// is the state install.js is for.
if (require('./relayAuth').loadAllow(ROOT_DIR).mode !== 'keys' &&
    relayStore.open(ROOT_DIR).members.count() > 0) {
  refuseToStart('relay-state/relay.db holds ' + relayStore.open(ROOT_DIR).members.count() +
    ' member(s) but relay-state/allow.json names no owner. Restore allow.json over SSH ' +
    '({ "keys": [{ "name": "<owner>", "publicKey": "<key>" }] }); the wire cannot prove ownership.');
}

// ── THE OWNER'S BOUND, READ ONCE (cycle 1) ───────────────────────────
//
// relay-state/config.json, beside allow.json. Bounded by the box: a
// ceiling larger than this machine can GIVE refuses to start rather than
// being honoured (relayConfig.js, relayLimits.js). Never re-read — the
// configuration is not a real-time tool (NODE-AND-RELAY §5, scope).
//
// ── AND WRITTEN, THE FIRST TIME, SO NOTHING IS IMPLICIT (cycle 9) ────
//
//   Andy, 2026-09-22: "on first start, relay may initialize config.json
//   with a default, or the command-line provides args so the first start
//   already confines the relay to those sizes."
//
// A relay used to fall back to a 256 MB constant and write nothing, so
// the figures it was running on existed nowhere an owner could read. Now
// the first start writes what it measured — half of the box, clamped to
// what the box can give — or what `--ram` / `--disc` asked for. After
// that the file is the record, and `source: 'default'` stops being a
// state that hides.
//
// THE SAME ARITHMETIC THE INSTALLER USES (relayLimits.js), so `node
// install` and a bare first start cannot propose different figures for
// the same machine.
const MEASURED = relayLimits.measure(ROOT_DIR);
const CONFIG = (function () {
  const file = path.join(ROOT_DIR, 'relay-state', 'config.json');
  let text = null;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { text = null; }

  // Args are only read when there is no file: they configure a relay's
  // first start, they do not override an owner's written choice. A figure
  // on the command line of an already-configured relay would be a limit
  // that changes on a restart nobody remembers typing.
  let fromArgs = false;
  if (text == null) {
    const ramAsked = argMB('--ram');
    const discAsked = argMB('--disc');
    if (ramAsked !== null || discAsked !== null) {
      const proposed = relayLimits.defaults(MEASURED);
      text = relayConfig.fileText({
        ramLimitMB: ramAsked === null ? proposed.ramLimitMB : ramAsked,
        discLimitMB: discAsked === null ? proposed.discLimitMB : discAsked,
      });
      fromArgs = true;
    }
  }

  // AT BOOT the ceiling clamps rather than refuses (relayConfig.js): a
  // figure that stopped fitting because the box filled up is not a reason
  // to keep a relay down. Nonsense in the file still refuses — that is a
  // state a restart cannot fix.
  const read = relayConfig.parse(text, MEASURED, { atBoot: true });
  if (!read.ok) refuseToStart(read.error);

  // `--ram` / `--disc` CONFIGURE A FIRST START; they do not haunt it.
  //
  // Found by wsl-claude on Linux, 2026-09-22: figures given as arguments
  // were honoured for that run and never written, so the next start —
  // from systemd, from a script, from anywhere without the flags —
  // silently went back to the measured defaults. A limit that evaporates
  // when somebody restarts the box is not a limit. They are written like
  // any other first start, and the source says where they came from
  // rather than claiming a file that did not exist.
  if (fromArgs) read.config.source = 'argument';

  if (text == null || fromArgs || read.config.source === 'default') {
    // Written before the relay serves anything, so a box that dies in its
    // first minute still says what it had decided. A failure here is not
    // fatal: a relay that cannot write its own config can still run on
    // what it measured, and the owner has a bigger problem to find.
    try {
      fs.mkdirSync(path.join(ROOT_DIR, 'relay-state'), { recursive: true });
      // What was ASKED for, never a boot-time clamp: a busy afternoon
      // must not shrink a relay's configuration permanently.
      fs.writeFileSync(file, relayConfig.fileText(relayConfig.asked(read.config)));
      console.log('    wrote relay-state/config.json (' + (fromArgs ? 'from --ram/--disc' : 'measured') + ': ' +
        read.config.ramLimitMB + ' MB RAM, ' + read.config.discLimitMB + ' MB disc)');
    } catch (e) {
      console.error('    could not write relay-state/config.json: ' + e.message);
    }
  } else if (text !== null && read.config.source === 'file') {
    try {
      const had = JSON.parse(text);
      if (had && had.discLimitMB === undefined) {
        fs.writeFileSync(file, relayConfig.fileText(relayConfig.asked(read.config)));
        console.log('    added discLimitMB ' + read.config.discLimitMB + ' MB to relay-state/config.json');
      }
    } catch (e) { /* an unreadable file already refused above */ }
  }
  return read.config;
}());

// `--ram 256`, `--disc 64`. Megabytes, positive, integers; anything else
// is refused rather than rounded, because a typed limit that silently
// becomes something else is worse than no limit at all.
function argMB(flag) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  if (i === -1) return null;
  const raw = args[i + 1];
  const mb = Number(raw);
  if (!isFinite(mb) || mb <= 0 || Math.floor(mb) !== mb) {
    refuseToStart(flag + ' wants a positive whole number of megabytes, got ' + JSON.stringify(raw));
  }
  return mb;
}

// HOW THIS RELAY ASKS A PARTNER, injected rather than reached for.
//
// LATE-BOUND on purpose: createRelay runs at module load and partnerRouter
// is built after the server is listening, so this closes over the variable
// rather than the value. A relay still booting answers from its own
// members and propagates nothing.
//
// `post` is peerPost's, so the hash, the proof the partner read it, and
// the dispatch of the answer back to this exact question are all the
// interface's and none of relay.js's (AGENT.md, Comms).
const relay = createRelay.createRelay(undefined, {
  askPartner: function (url, relayKey, text, budgetMs) {
    if (!partnerRouter) return Promise.resolve(null);
    // The partner is given LESS than this relay has (relay.js,
    // HOP_MARGIN_MS), so it finishes first and this relay still has time
    // to carry its answer back to the member waiting.
    return partnerRouter.post(url, relayKey, text, null, { budgetMs: budgetMs });
  },
  config: CONFIG,

  // ── THE OWNER'S `config` VERB NEEDS HANDS (cycle 9) ───────────────
  //
  // relay.js decides — is this the owner, is the figure inside the
  // ceiling, would it strand members — and these three do the parts that
  // touch the box. Injected rather than reached for, so a relay built in
  // a suite simply has no hands and says so honestly instead of writing
  // into somebody's checkout.
  measure: function () { return relayLimits.measure(ROOT_DIR); },

  writeConfig: function (next) {
    try {
      fs.writeFileSync(path.join(ROOT_DIR, 'relay-state', 'config.json'), relayConfig.fileText(next));
      console.log(`    owner reconfigured: ${next.ramLimitMB} MB RAM, ${next.discLimitMB} MB disc (applies at next start)`);
      return true;
    } catch (e) {
      console.error('    could not write relay-state/config.json: ' + e.message);
      return false;
    }
  },

  // ── A RESTART THIS PROCESS CANNOT PROMISE ON ITS OWN ──────────────
  //
  // Exiting is easy; COMING BACK is somebody else's job. Under systemd
  // with `Restart=always` the unit brings it back in seconds; started
  // from a shell it just stops, and an owner in a datacentre would be
  // left with a box that went quiet because he changed a number.
  //
  // So it answers first and acts second, and it only claims a restart
  // when systemd is the thing that started it — INVOCATION_ID is set by
  // systemd for every service it runs, and by nothing else.
  //
  // The goodbye is the one that already exists: members are told to come
  // back in three seconds, the store is closed, and the process exits 0.
  // `Restart=on-failure` would NOT bring back a clean exit, which is why
  // bash/systemd/spirit-relay.service now says `always`.
  restart: function () {
    if (!process.env.INVOCATION_ID) {
      return {
        will: false,
        why: 'this relay was not started by systemd, so nothing would bring it back — ' +
          'the figures are written and apply the next time it starts',
      };
    }
    // ── SYSTEMD IS NOT ENOUGH; THE POLICY HAS TO SAY `always` ────────
    //
    // A unit with `Restart=on-failure` does NOT bring back a clean exit,
    // and the goodbye exits 0 on purpose so members are told to come
    // back rather than seeing a crash. So a relay running under the
    // old unit would take this verb, stop, and stay stopped until
    // somebody SSH'd in — the exact outage this verb exists to avoid.
    //
    // `bash/update` pulls and restarts but does not reinstall the unit,
    // so this is the live state of every relay between a pull and the
    // next `./bash/install-units`. Asked of systemd rather than assumed,
    // and a box that will not answer is treated as "will not come back".
    const policy = restartPolicy();
    if (policy !== 'always' && policy !== 'on-success') {
      // TWO DIFFERENT TRUTHS, AND THEY READ DIFFERENTLY AT 3AM. A policy
      // that was read says what it said; a miss means no unit answered at
      // all, and claiming "Restart=unknown" there would put words in
      // systemd's mouth. wsl-claude, staging the miss by moving a running
      // relay into a cgroup nothing had loaded: the old sentence "is the
      // one sentence in that answer that is not true".
      return {
        will: false,
        why: policy
          ? 'the unit says Restart=' + policy + ', which does not bring back a clean exit — ' +
            'the figures are written; run ./bash/install-units and ./bash/restart to apply them'
          : 'no unit by that name is loaded, so nothing is known to bring this relay back — ' +
            'the figures are written and apply the next time it starts',
      };
    }
    // After the answer has been written to the wire, not before: an owner
    // who asked for a restart should still receive the report of what he
    // just changed.
    setTimeout(function () { restartNow(); }, 250);
    return { will: true };
  },
});

// A relay is a party to conversations, and `relay` is the caption it
// answers to, not an identity. A node that keeps one file per peer cannot
// file the relay anywhere without a key, so the relay gets one: made
// once, on the first relay boot, into this process's own relay-state
// beside allow.json. It is handed out through /api/relay/key
// (relay.relayPublicKey), and it is NOT the owner's key — the owner is a
// peer who claimed, the relay is the box.
require('./relayAuth').ensureIdentity(ROOT_DIR, 'relay');

// The browser's half. This request is HELD — the relay does not answer
// until the personal node has been posted to and replied, or the wait
// runs out. It used to be held past a poll; it is now held for a round
// trip, which is under a second when the node is there.
//
// Nothing here reads the password: it is carried to the node and the node
// compares it (DEVICE-CYCLE2.md).
function handleDeviceOffer(req, res) {
  readJsonBody(req).then(function (body) {
    // The name may be absent, and is on the bare /device page: relay.js
    // resolves an omitted one to the owner label, which is who that page
    // enrols. A per-key page sends its own segment, which is decoded to
    // the stored key form here — the one place that translation happens.
    const asked = (body && body.name) || '';
    const asKey = deviceAuth.keyFromUrl(asked);
    return relay.deviceOffer(
      asKey && relay.deviceIdentityPublic(asKey) ? asKey : asked,
      body && body.password,
      body && body.devicePublicKey
    );
  }).then(function (result) {
    if (!result || !result.ok) {
      deviceRefusal(res, result && result.status);
      return;
    }
    // THE ENROLLED IDENTITY'S label goes back with the yes, because from
    // here the page has to sign as somebody: every line it sends is
    // `send\n<from>\nrelay\n<text>`, and `from` is whoever this device
    // now belongs to.
    //
    // It said the relay's OWNER until 2026-09-12, and that was true
    // when it was written — the bare /device page enrolled the owner and
    // nobody else, so there was only one answer it could be. B2 gave
    // every identity with a row its own /<key>/device page and its own
    // slot, and this did not follow: every page on the box came back
    // "signed in as andy", bella's included.
    //
    // Nothing is given away by saying it: this answer only ever follows a
    // password the node itself accepted. An empty name simply leaves the
    // page unable to sign, which is the honest outcome for an enrolment
    // that named nobody.
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      devicePublicKey: result.devicePublicKey,
      // WHOEVER WAS ENROLLED, which is not the same as whoever owns this
      // relay. It read `snapshot().owner` and therefore said "andy" to
      // every page on the box, bella's included.
      name: result.name || '',
    }));
  }).catch(function () {
    deviceRefusal(res, 403);
  });
}

// handleSetDevice STOOD HERE, and POST /api/relay/set-device with it.
// Enrolment is a post now — relay.answerSelf, body.setDevice — because
// installing a key on your own row was never an owner verb and so could
// never have gone through a door only the owner may knock on.

function handleRelayClaim(req, res) {
  readJsonBody(req).then(function (body) {
    const result = relay.claim(
      body && body.name,
      body && body.sig,
      body && body.publicKey,
      common.clientKeyFor(req),
      body && body.invite,
      // THE WORD ON THE INVITE, which is not the name being claimed.
      // `name` is what this key wants to be called; `inviteLabel` is what
      // the owner wrote down to identify the person they were inviting,
      // and it is matched and then forgotten (R1, 2026-09-15). A caller
      // that sends only `name` gets the old behaviour, where the two were
      // one string.
      body && body.inviteLabel
    );
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    // A 409 carries the peer that is already there so the caller can tell
    // "that name is mine already" from "that name is someone else's". The
    // key is public.
    var payload = result.ok
      ? result.peer
      : (result.peer ? { error: result.error, peer: result.peer } : { error: result.error });
    res.end(JSON.stringify(payload));
  }).catch(function () {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// `/<key>/device`, and nothing else beneath `/<key>/`. A CLOSED set of
// surfaces, deliberately: if an arbitrary suffix resolved to a file, the
// URL would be building a filesystem path out of input a stranger picked,
// which is where directory traversal lives. Shared assets stay at the
// root, where they are literals and belong to nobody.
//
// Returns the stored-form key, or '' — the caller still has to ask the
// relay whether anybody owns it.
const DEVICE_PAGE_PATH = /^\/([A-Za-z0-9_-]{16,512})\/device$/;
function devicePageKey(pathname) {
  const m = DEVICE_PAGE_PATH.exec(pathname || '');
  if (!m) return '';
  return deviceAuth.keyFromUrl(m[1]);
}

function isRelayPublicPath(method, pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/relay.html' || pathname === '/favicon.svg') {
    return method === 'GET';
  }
  // The enroll page, and ONLY addressed by whose it is. The bare /device
  // is gone from a relay (Andy, 2026-09-11: "should /device still work?
  // I think not"): it meant "the owner" by implication, which is the one
  // thing the key-addressed form removes. Two ways to reach one page is
  // drift waiting to happen, and the implicit one names nobody.
  //
  // /device.html goes with it, for the same reason and by the same
  // reasoning that made it public in the first place — it is the same
  // page without an identity.
  //
  // Unlisted rather than hidden: nothing links to these, they carry
  // noindex, and they are reachable by anyone who types one. What
  // protects them is the password and the window, not obscurity. The key
  // in the path is a LOCATOR, and holding one grants nothing.
  if (method === 'GET' && devicePageKey(pathname)) return true;
  // ── WHO THIS RELAY IS, AND NOTHING ELSE (2026-09-18) ───────────────
  //
  //   Andy: "the first two are easily replaced with GET /api/relay/key
  //   or whatever."
  //
  // The two being the front door's "is this sender a relay?" and search's
  // "which key do I address this box as" — both of which need a PIN, and
  // the pin was being derived from the whole roll, once per relay per
  // boot. ~147 KB at a thousand members to learn 44 bytes.
  //
  // Fixed cost per request, with no membership term in it, which is what
  // earns it the exemption the roll is losing (0013, and 0010's
  // granted-GET table).
  if (method === 'GET' && pathname === '/api/relay/key') return true;
  // The presence wire. Public in the same sense the rest is: reachable
  // from the internet, and gated inside relay.streamOpen, which refuses
  // an identity this box does not hold before it allocates anything.
  if (method === 'GET' && pathname === '/api/relay/stream') return true;
  // WHAT IS THIS BOX MADE OF. Public, deliberately: the question a
  // deploy check asks must not need a private key, or the check cannot
  // run from anywhere but the owner's own machine — and a relay you
  // cannot identify is one you cannot harden. What it gives away is a
  // commit id for code the repository already holds.
  if (method === 'GET' && pathname === '/api/version') return true;
  if (method === 'POST' && pathname === '/api/relay/device') return true;
  if (method === 'POST' && pathname === '/api/relay/claim') return true;
  // The router, and now the only way onto this box. Public in the sense
  // the rest is: reachable from the internet, gated inside relay.js by a
  // signature, and refused instantly if the peer is not there to receive
  // it (decision 0006).
  if (method === 'POST' && (pathname === '/api/relay/post' || pathname === '/api/relay/reply')) return true;
  return false;
}

// The brochure: what a browser gets at a relay's own address. relay.html
// loads no scripts, so these four are the whole of it.
const BROCHURE = {
  '/': 'relay.html',
  '/index.html': 'relay.html',
  '/relay.html': 'relay.html',
  '/favicon.svg': 'favicon.svg',
};

const server = http.createServer((req, res) => {
  // NO LOOPBACK OR HOST GATE, which is the node's first line and not this
  // one's: a relay is meant to be reached from the internet, and a
  // deployed relay is reached by whatever name the platform gave it. What
  // stands in for that gate is not "nothing": isRelayPublicPath (below)
  // reduces the answerable surface to the relay routes and the brochure,
  // and the relay routes themselves are gated by the allow list and
  // signature checks in relayAuth.js.
  if (common.refuseTooBig(req, res)) return;

  const parsed = common.parseRequestPath(req, res);
  if (!parsed) return;
  const url = parsed.url;
  const pathname = parsed.pathname;

  if (!isRelayPublicPath(req.method, pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (req.method === 'GET' && pathname === '/api/relay/key') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    // KEY AND LABEL ARE A PAIR (Andy), so a caller that reads one reads
    // both, and nothing has to learn a second shape. Null on a relay that
    // has not been restarted since it grew a key of its own.
    // AND WHO RUNS IT, which a caller can ask for without asking for a
    // membership list. It is what `relay.partnerCheck` needed the roll
    // for, and the last thing it needed it for.
    // AND WHAT POSTS TO IT ARE SEALED TO (cycle 10, R9), signed by the
    // identity key named beside it. This answer was unsigned, and
    // answerRelay.js said what that was worth — the re-check "compares
    // against an UNSIGNED answer and so catches nothing an attacker could
    // not forge". Tolerable for an identity to pin; not tolerable once
    // the same answer carries the key every owner verb is sealed to,
    // invite tokens included.
    var own = relay.ownerPublic();
    res.end(JSON.stringify({
      relayPublicKey: relay.relayPublicKey(),
      relaySealKey: relay.relaySealKey(),
      keySig: relay.relayKeyStatement(),
      relayLabel: relay.relayLabel(),
      ownerKey: own.ownerKey,
      ownerLabel: own.ownerLabel,
    }));
    return;
  }

  // GET /api/relay/who STOOD HERE — THE ROLL, DELETED 2026-09-18. See
  // the tombstone in server.js's history and decision 0012: no party may
  // ask a relay for its whole enrolment list.

  // THE DEVICE PAGE. One file for everybody: the key lives only in the
  // URL, and the page reads it off its own address — nothing is templated
  // and nothing is generated per person.
  //
  // An identity nobody holds is a 404 here rather than a working-looking
  // form that can never succeed.
  //
  // RESTORED 2026-09-12. It was deleted by accident in the same commit
  // that removed the poll — the cut ran from the `device-pending` route to
  // the next one and this sat between them, so every keyed device URL
  // 404'd from that moment. Nothing caught it: no suite asks for the page,
  // and relayProbe's surface list does not name it. Andy found it by
  // clicking the link in natterDetails.
  if (req.method === 'GET' && devicePageKey(pathname)) {
    if (!relay.deviceIdentityPublic(devicePageKey(pathname))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('no such identity here');
      return;
    }
    common.sendFile(res, path.join(ROOT_DIR, 'device.html'));
    return;
  }

  // One held connection per identity, carrying who is reachable. The
  // signature is a HEADER for the same reason device-pending's is: a
  // query string is written to every access log the request passes, and
  // this one buys a STANDING grant rather than a single read. Same
  // function enforces it, so there is one rule and not two.
  if (req.method === 'GET' && pathname === '/api/relay/stream') {
    const from = createRelay.streamSignatureFrom(url.searchParams.get('sig'), req.headers);
    if (!from.ok) {
      deviceRefusal(res, from.status);
      return;
    }
    const token = url.searchParams.get('key') || '';

    // A sink, not a response: relay.js and presence.js hold this and
    // neither knows what http is. Why its head is written lazily, and
    // why it cuts a reader that has stopped reading (R35), is in
    // streamSink.js.
    //
    // Declared before the sink, because the sink can call teardown: a
    // stream cut for not reading is torn down by the cut, not left to
    // whether the socket's own close event comes.
    let torndown = false;
    let heartbeat = null;
    let live = false;
    const sink = streamSink.createStreamSink(res, {
      onStall: function () { if (live) teardown(); },
    });

    const opened = relay.streamOpen(token, from.sig, sink);
    if (!opened || !opened.ok) {
      // SAY HOW LONG, because this box is the only one that knows. A 429
      // here is the connect allowance — six a minute, one per ten seconds
      // — and a client left to guess will guess with a constant that has
      // no idea what this relay allows.
      //
      // RFC 9110 Retry-After, in seconds. sseClient honours it over its
      // own backoff, so the number that governs the retry is the number
      // that governs the refusal.
      if (opened && opened.status === 429) {
        try { res.setHeader('Retry-After', String(Math.ceil(60 / relay.presence.perMin) + 5)); }
        catch (e) { /* headers already sent */ }
      }
      // FULL: the fixed allowance (cycle 8) is taken. Come back when
      // somebody may have left — not in a second.
      if (opened && opened.status === 503) {
        try { res.setHeader('Retry-After', String(FULL_RETRY_S)); }
        catch (e) { /* headers already sent */ }
      }
      // A PARTNER IS TOLD WHY (gap R13; found by Grok's review of the gap
      // cycle, 2026-09-22). deviceRefusal says only "not now" — right for a
      // member or a stranger, whose refusal must not say which gate held —
      // but its code's retry is "after", so an older relay that still dials
      // its partners at boot was told to try again for ever. A partner's key
      // is already known to be a partner, so the sentence tells nobody
      // anything, and "retry: no" is what stops the dialling.
      if (opened && opened.status === 403 && opened.error === 'a partner holds no stream here') {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: opened.error, code: spiritErrors.classify(403, opened.error).code }));
        return;
      }
      deviceRefusal(res, opened && opened.status);
      return;
    }

    live = true;

    // Through the sink, so a heartbeat counts toward the backlog like
    // any other byte a stopped reader is not taking.
    heartbeat = setInterval(() => {
      try { sink.write(':\n\n'); } catch (e) { /* teardown will follow */ }
    }, 20000);

    // Bound to 'error' as well as 'close', and once-guarded. The bug
    // that guards against is worse here than anywhere: a socket that
    // dies without a clean close would leave a peer reading as PRESENT
    // forever, which is the relay lying — and lying is the one thing this
    // design cannot afford.
    //
    // WHICH CLOSE IT WAS is asked of the sink, not of which event came
    // first: the cut destroys the socket, so 'close' may well beat the
    // sink's own call, and the stalled path must run either way.
    function teardown() {
      if (torndown) return;
      torndown = true;
      clearInterval(heartbeat);
      relay.streamClose(token, sink, sink.stalled() ? 'stalled' : undefined);
    }
    req.on('close', teardown);
    req.on('error', teardown);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/version') {
    common.sendVersion(res, BUILD, STARTED_AT, true);
    return;
  }

  if (req.method === 'GET' && BROCHURE[pathname]) {
    common.sendFile(res, path.join(ROOT_DIR, BROCHURE[pathname]));
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/api/relay/claim') {
      handleRelayClaim(req, res);
      return;
    }

    if (pathname === '/api/relay/post') {
      readJsonBody(req).then(function (body) {
        // ROUTE HINTS, when the sender gave any (cycle 2): the relays its
        // contact is enrolled at, signed beside the packet. Passed as an
        // object, never as a bare key — a key from the wire must be
        // verified before this box acts on it, and relay.routePost only
        // trusts a bare string from in-process callers.
        const route = body && Array.isArray(body.hints) && body.hints.length
          ? { hints: body.hints, hintSig: body.hintSig }
          : undefined;
        // `budgetMs` — how long the ASKER is still willing to wait, a
        // remaining duration and never a deadline. Informational: the
        // relay grants min(asked, its own ceiling), so a number from the
        // wire can only ever buy less than this box already allows
        // (0017, and the gap cycle's R5).
        // A number is a DECLARATION, including zero — a chain that has
        // run out of time says so, and is refused rather than being
        // handed this box's default and starting again.
        const budgetMs = (body && typeof body.budgetMs === 'number' && isFinite(body.budgetMs))
          ? Math.max(0, body.budgetMs)
          : undefined;
        const posted = relay.routePost(
          body && body.from, body && body.to, body && body.text, body && body.sig,
          route, budgetMs
        );
        // A PARTNER'S POST IS ANSWERED ON ITSELF (R13): relay.js hands back
        // `held`, a promise of the answer, and this request stays open
        // until it settles — with the reply packet, or with the refusal
        // when the time this relay granted runs out. Every other post is
        // answered at once, exactly as before.
        // It never rejects: holdForPartner settles with the answer or, when
        // the time runs out, with 504 "no answer yet".
        if (posted && posted.held && typeof posted.held.then === 'function') {
          posted.held.then(writePosted);
          return;
        }
        writePosted(posted);
      }).catch(function () {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid JSON body');
      });

      function writePosted(result) {
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        // A WHITELIST, AND IT STAYS ONE. What a refusal carries is part of
        // the protocol, so it is named here rather than being whatever
        // relay.js happened to put on the object — the alternative leaks
        // internals to anybody who can provoke an error.
        //
        // The cost is that a new field is invisible until it is added
        // here, which `busy` nearly paid: the router refuses with
        // { busy, retryAfterMs } and this dropped both on the floor, so
        // the wire would have said 503 "target is busy" and no scheduler
        // could have told it from 503 "peer not reachable".
        res.end(JSON.stringify(result.ok ? result : {
          error: result.error,
          inFlight: !!result.inFlight,
          // THE TARGET IS FINE AND SIMPLY OCCUPIED (0016). Distinct from
          // "peer not reachable", which is the same status and the
          // opposite situation: that one says do not expect an answer,
          // this one says ask again in `retryAfterMs`.
          busy: !!result.busy,
          retryAfterMs: typeof result.retryAfterMs === 'number' ? result.retryAfterMs : 0,
          // NOT ENOUGH TIME TO TRY, which is a third kind of no: the peer
          // is fine and this box is fine, and what was offered was too
          // little to attempt anything with. Named here for the reason
          // `busy` is — a whitelist means a new field is invisible until
          // somebody adds it, and that has cost this file twice.
          tooLittleTime: !!result.tooLittleTime,
          // WHAT IT MEANS, by the catalogue (R36 phase B), BESIDE the
          // sentence and never instead of it: an older node still reads
          // `error`. Grok's review: "{ status, error, code } … Keep the
          // sentence."
          code: spiritErrors.classify(result.status, result.error, result).code,
        }));
      }
      return;
    }

    if (pathname === '/api/relay/reply') {
      readJsonBody(req).then(function (body) {
        const result = relay.routeReply(
          body && body.from, body && body.hash, body && body.text, body && body.sig
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result.ok ? result : {
          error: result.error,
          code: spiritErrors.classify(result.status, result.error, result).code,
        }));
      }).catch(function () {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid JSON body');
      });
      return;
    }

    if (pathname === '/api/relay/device') {
      handleDeviceOffer(req, res);
      return;
    }
  }

  // Unreachable while isRelayPublicPath and the branches above agree; a
  // 404 rather than a hang if they ever stop agreeing.
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

// A relay binds 0.0.0.0: it is the one server that genuinely needs to be
// reachable from another machine — required by every platform that
// health-checks the port it assigned (Heroku, Fly, a plain VPS). Bind
// loopback there and the health check fails, the dyno is killed, and it
// reads as "SpiritOS is broken" rather than as a bind mistake.
const BIND_HOST = '0.0.0.0';

common.refuseListenError(server, port, 'js/relayServer.js');

// ── A RELAY THAT KNOWS IT IS GOING SAYS SO ───────────────────────────
//
//   Andy: "can a relay that knows its shutting down (lab.andyflinn.com
//   reboot by your request) send a message down the SSE connections to
//   prepare its counterparts to re-connect?"
//
// It spends its moment on `retry:`, which is SSE's own field for when to
// come back. So a hundred members do not all reconnect one second later
// into a box that is still booting, get refused, and back off further
// than they needed to. `bash/update` restarts a relay every time it takes
// a tag: this is a routine Tuesday, not an outage.
//
// THREE SECONDS is a guess at a node boot, and a cheap one to be wrong
// about: too low and a member is refused once and retries on its own
// backoff, which is where it would have been anyway.
//
// The node's own goodbye (server.js) tells its browser pages the same
// thing, through the same presence.sayGoingAway.
// WHAT SYSTEMD WOULD DO IF THIS PROCESS EXITED CLEANLY.
//
// The unit's own name is not handed to a service, so it is read from the
// cgroup path, which ends in `<unit>.service` for anything systemd runs.
// Then systemd is asked directly: no guessing from a file in the
// checkout, which may not be the file that was installed.
//
// Every failure answers null, and the caller reads null as "will not come
// back" — the safe direction: a relay that refuses to restart itself is
// an inconvenience, one that stops and stays stopped is an outage.
function restartPolicy() {
  try {
    const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
    // THE LEAF, not the first thing that looks like a unit. A user unit's
    // path holds two — `user@1000.service` and the unit itself — and the
    // one that owns this process is the last.
    const units = String(cgroup).match(/[A-Za-z0-9@_.\\-]+\.service/g);
    if (!units || !units.length) return null;
    const unit = units[units.length - 1];

    // ── WHICH MANAGER, AND WHY IT IS NOT ALWAYS THE SYSTEM ONE ──────
    //
    // Found by wsl-claude, 2026-09-22, rehearsing the restart on a real
    // transient unit: the unit was `Restart=always` and this read `no`,
    // because it asked the SYSTEM manager about a unit only the USER
    // manager knows. A relay under a user unit could therefore never
    // restart itself.
    //
    // The cgroup path says which: anything under `/user@<uid>.service/`
    // belongs to that user's manager.
    const user = /\/user@\d+\.service\//.test(cgroup);
    const args = (user ? ['--user'] : []).concat(['show', '-p', 'LoadState', '-p', 'Restart', unit]);
    const out = String(require('child_process').execFileSync('systemctl', args,
      { encoding: 'utf8', timeout: 2000 }) || '');

    // ── A MISS ANSWERS "no", CONFIDENTLY, AND EXITS 0 ───────────────
    //
    // The same finding's second half: `systemctl show -p Restart` for a
    // unit the manager has never heard of prints `Restart=no` and
    // succeeds. So a name that misses did not read as "unknown", it read
    // as "this will not come back" — right by luck — and, worse, a
    // DIFFERENT unit of that name would have been answered for.
    //
    // LoadState is what tells the two apart: only `loaded` means the
    // manager is talking about this unit.
    const loaded = /^LoadState=(.*)$/m.exec(out);
    if (!loaded || loaded[1].trim() !== 'loaded') return null;
    const restart = /^Restart=(.*)$/m.exec(out);
    return restart ? restart[1].trim() || null : null;
  } catch (e) {
    return null;
  }
}

// The owner's `config` verb asks for this one by name (relay.js
// reconfigure), so it is reachable from outside the block that arms the
// signal handlers. One goodbye, three ways in: SIGTERM, SIGINT, and an
// owner who asked.
let goodbyeFn = null;
function restartNow() {
  if (goodbyeFn) goodbyeFn('the owner asked for a restart');
}

{
  let leaving = false;
  const goodbye = function (signal) {
    if (leaving) return;
    leaving = true;
    let told = 0;
    try { told += relay.presence.goingAway(3000); }
    catch (e) { /* nothing to tell, or already gone */ }
    console.log(`${signal} — told ${told} stream(s) to come back in 3s`);
    try { server.close(); } catch (e) { /* not listening */ }
    // Every commit is already on disc (synchronous=FULL); closing is so
    // the journal is gone before the next process opens the file.
    try { relayStore.closeAll(); } catch (e) { /* never opened */ }
    process.exit(0);
  };
  goodbyeFn = goodbye;
  process.on('SIGTERM', function () { goodbye('SIGTERM'); });
  process.on('SIGINT', function () { goodbye('SIGINT'); });
}

server.listen(port, BIND_HOST, () => {
  console.log(`Relay listening on ${BIND_HOST}:${port} — PUBLIC, no loopback or Host restriction`);
  // UNCLAIMED, SAID OUT LOUD (cycle 3, Part B). There is no `open` mode
  // any more: a relay with no owner takes exactly one claim, the one
  // presenting the owner invite install.js mints over SSH. Saying so at
  // boot is what tells an operator why nobody else can get in. The TOKEN
  // is never printed here: systemd's journal would keep it (NODE-AND-RELAY,
  // "The first claim needs a token").
  if (require('./relayAuth').loadAllow(ROOT_DIR).mode !== 'keys') {
    console.warn(
      '    UNCLAIMED — no owner in relay-state/allow.json. The only claim this relay\n' +
      '    accepts is the owner invite: run `node install.js` over SSH, then claim with\n' +
      '    the name and token it prints (decision 0003, amended: first invited claim is owner).'
    );
  }

  // THE HEARTBEAT STOOD HERE, and it was wrong from the day it shipped.
  // R9 pushed a status report every ten seconds for ever, watched or not.
  // What replaced it: the owner POSTS to the relay and the relay answers
  // by hash on their own stream. A relay nobody is watching now does
  // exactly nothing about being watched.

  // -- AND IT ASKS ITS PARTNERS ------------------------------------
  //
  // THROUGH ITS OWN POSTS, AND NOTHING HELD (R13, cycle 8). This dialled a
  // stream to every partner at boot — "Both partners must have the mutual
  // sseClients alive in this pass" (Andy, then) — because a partner's
  // answer could only arrive on a stream. Grok's review: "The forward path
  // is already request-in / reply-out. A held stream is a second bus."
  // Andy agreed. The answer now comes back as the reply to the post, so
  // there is nothing to dial and nothing to hold, and partnerLink.js is
  // gone.
  //
  // Its own peerPost, signing as this relay's identity, with
  // relayRequest injected — the same interface a node uses.
  partnerRouter = require('./peerPost').createPeerPost({
    rootDir: ROOT_DIR,
    request: require('./relayRequest').relayRequest,
    // NO TRAFFIC LOG. peerPost takes it injected precisely so a relay
    // can omit it: that file is correct on a personal node and is "the
    // worst thing in the system on a relay" (peerPost.js).
  });

  // THE GOVERNOR'S TICK STOOD HERE (cycle 1), every five seconds. Deleted in
  // cycle 8: the relay manages itself within a fixed allowance, set once at
  // boot from the owner's RAM, and tells the owner on every event instead.
  console.log(`    RAM limit ${CONFIG.ramLimitMB} MB (${CONFIG.source}); ${relay.allowance()} streams allowed, fixed`);

  // ── BOTH BOUNDS ON ONE LINE, AND THE OVERFLOW IF THERE IS ONE ──────
  //
  // A relay can be over its disc figure without anybody shrinking
  // anything: a later boot measures a lower ceiling on a box that has
  // filled up, or an owner edits the file downward while it is stopped.
  //
  // IT STILL STARTS. A relay that refused to boot because a number moved
  // would take everybody's messages down to enforce an accounting rule,
  // and the owner would need SSH to undo it. So it comes up, says so
  // here and in the owner's report, takes no new claims — and evicts
  // nobody. Andy: "the owner must evict before shrinkage."
  const usedMB = Math.round((relayStore.open(ROOT_DIR).bytes() / (1024 * 1024)) * 100) / 100;
  console.log(`    disc limit ${CONFIG.discLimitMB} MB; ${usedMB} MB used by relay-state/relay.db`);
  if (CONFIG.overflow) {
    const o = CONFIG.overflow;
    if (o.ramAsked) {
      console.log(`    NOTE: config.json asks for ${o.ramAsked} MB of RAM and the box can give ` +
        `${CONFIG.ramLimitMB} MB today — running on what it can give. The file is unchanged.`);
    }
    if (o.discAsked) {
      console.log(`    NOTE: config.json asks for ${o.discAsked} MB of disc and ${CONFIG.discLimitMB} MB ` +
        `is free today — running on what is free. The file is unchanged.`);
    }
  }
  if (usedMB >= CONFIG.discLimitMB) {
    console.log(`    FULL: the roll is at its disc limit — no new claims until discLimitMB is raised ` +
      `or members are removed. Nobody has been evicted.`);
  }
});
