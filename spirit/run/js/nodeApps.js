'use strict';

// spirit/run/js/nodeApps.js
// APPS THAT RUN IN THE NODE, AND THE ONE SEAM THEY GET.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
// Every app until now has been a page: the shell loads it, it talks to
// the door, and when no browser is open it does not exist. THAT SHAPE
// CANNOT HOLD A NEGOTIATION. The appFaceApp grants subdomain names to
// members, and a grant asked for while the owner's browser is shut must
// still be answered — the owner's node is what is always on, not the
// owner's screen.
//
//   Andy, 2026-09-25: "the appShellApp could implement the bare minimum,
//   and this is the no-face negotiation, without any local shell
//   interface yet or anything."
//
// So: an app with no page, booted by the node, reachable only over the
// wire.
//
// ── NO FACE IS THE DEFAULT, NOT THE EXCEPTION ────────────────────────
//
//   Andy, 2026-09-25: "the app-puppet has no face by default, that's an
//   add-on-option"
//
// WHICH WAY ROUND THIS SITS IS THE WHOLE OF IT. A puppet does not
// "lack" a face waiting for somebody to supply one — it has none, and a
// face is a thing its master adds on purpose. So the seam offers a
// subscription, a scoped filesystem and a way to post, and NOTHING that
// serves: a puppet that wanted a face would have to build the serving
// itself, which is precisely the second door the faceless scan looks
// for.
//
// Said as a default because it generalises: every app-puppet starts
// here, and a face is an option declared later. Said as an absolute for
// `appFaceApp` alone, where `appFaceGrant.js` walks the directory and
// goes red on an .html, a .css or anything that listens — because there
// the exchange being the only door is what makes the suite's assertions
// honest, and a control panel is the obvious next convenience that
// nothing else would catch.
//
// ── THE SCOPE IS ANDY'S, VERBATIM ────────────────────────────────────
//
//   Andy, 2026-09-24: "an orthogonal filesystem interface given to the
//   mounting (booting) app, where it can treat the fs api like the shell
//   apps treat it. and [master] supplies the scope:
//   ./spirit/run/app/<appname>/<appname>.js"
//
// So a booted app gets `read`/`write`/`exists` and they resolve inside
// its own folder and nowhere else. That is the same boundary
// `kernel.js:176` already draws for a page — `app/` is writable, and an
// app persists in its own directory — reached by a different door.
//
// ── TWO RULES THAT LOOK LIKE ONE, AND ARE NOT ────────────────────────
//
//   Andy: "nothing in node and relay should know about apps."
//
// That rule is about PAYLOADS. `arrivals.js:176` cites it for the thing
// it forbids: the node used to call packet.decorate and parse an app's
// envelope on behalf of a layer that can parse it itself. The node does
// not read what is in a packet.
//
// LOADING AN APP IS NOT READING ONE. The node boots a program and hands
// it a subscription; it never looks inside the text, never routes by app
// name, and has no table of which app wants which packet. Every booted
// app sees every admitted arrival and decides for itself — the filtering
// is the app's, in the app's code, which is exactly what the rule asks
// for. If this file ever grows a switch on the payload, the rule has
// been broken and this paragraph is the evidence.
//
// ── ONE FUNCTION, AND A LIST OF WHO MAY CALL IT ──────────────────────
//
//   Andy, 2026-09-25: "concept. app provides 1 function, app-owner
//   manages permission list (contacts on app"
//   and: "since the owner gates which peers can use that app..... it's
//   implicit permission to deposit a request on the owners hard drive"
//
// SO THERE ARE TWO GATES AND THEY ANSWER DIFFERENT QUESTIONS. The node's
// front door decides who may reach this node at all — `peerPost.js`
// calls onArrival only on verdict `known` or `admit`, and a held
// stranger reaches no app (asserted at `arrivals.js:405`). The APP'S
// list then decides which of those admitted peers may use THIS app.
// Being on it is the permission: an app does not ask a second question
// about what a listed peer may do, because that is what the list said.
//
// ONE MECHANISM, HERE, NOT ONE PER APP. Every booted app needs this and
// two implementations of it would be the duplication this tree keeps
// catching — so `allows(key)` is handed to the app already built, and an
// app that grows its own key list is the thing to go red on.
//
// ── AN ABSENT LIST MEANS NOBODY ──────────────────────────────────────
//
// Not everybody. A missing `allow.json`, an unreadable one and an empty
// one all mean the same thing: this app has no users yet. That is G14 —
// an optional guard whose absence means "do the unsafe thing" IS
// absent-means-everything, and it is how a permission list becomes
// decoration. A freshly installed app therefore does nothing until its
// owner puts a key in the file, and that is the correct amount of
// nothing.
//
// The shape is `relayAuth.js:392`'s, deliberately: `{ "keys": [...] }`,
// because the relay's member list already answers "which keys may do
// this here" and a second spelling of an answer is how two lists drift.
//
// ── HOW THE OWNER MANAGES IT, AND WHERE THAT SCREEN WILL LIVE ────────
//
//   Andy, 2026-09-25: "the puppets contact configuration goes into a
//   shell frame (LATER)"
//
// DECIDED, AND DELIBERATELY NOT BUILT. The owner edits `allow.json` by
// hand today. The screen for it belongs in a SHELL FRAME — the master's
// own console — and never in the puppet's folder: a puppet with a face
// for configuring itself is a second door onto its own permissions, and
// `appFaceGrant.js` goes red on a face appearing in that directory for
// exactly this class of reason.
//
// His "(LATER)" is the whole of the schedule. Nobody should read this
// paragraph as work owed, and a frame appearing before he asks for one
// is scope taken rather than given.
//
// What this file guarantees in the meantime is what that frame will need
// when it comes: ONE list shape, in ONE place, per puppet — so the frame
// reads and writes `app/<name>/allow.json` for every puppet alike and
// needs no per-app knowledge to do it.
//
// ── WHAT A BOOTED APP MAY NOT DO ─────────────────────────────────────
//
// Compose the answer. `peerPost.js:1327` closes that door and states its
// reason — an answerer that hangs holds the sender's connection open,
// because the receipt is awaited. THE BOUNDARY, in the words it was
// agreed in (wsl-claude, 2026-09-25, correcting a wider sentence that
// would not have held):
//
//   NO APP-SUPPLIED CODE IS AWAITED INSIDE THE RECEIPT. A promise it
//   returns is never waited on and a throw never reaches the sender. A
//   SYNCHRONOUS handler still blocks, exactly as arrivals.note does
//   today.
//
// So an app REPLIES BY POSTING BACK: two packets, two hashes, two
// receipts, correlated by the first packet's hash. Andy ruled the
// exchange must be a packet "even when both ends are on the same node"
// — "faceless, no shortcut" — and reply-as-packet satisfies that
// literally rather than by promise.
//
// The synchronous-answer case — a public face holding a browser open
// while the owner computes a body — is G17, declared awaiting at
// `appServerBoundary.js:485` and DELIBERATELY NOT DECIDED HERE. It
// arrives with join, when a real held browser is the evidence. A
// deadline hook was proposed for it and withdrawn (wsl-claude,
// 2026-09-25) on the grounds that the easy case must not make the rule
// for the hard one.

const fs = require('fs');
const path = require('path');

// A manifest opts in. Absent means a page app, which is every app that
// exists today — ABSENT MEANS NOTHING NEW, never "boot it and see".
function boots(manifest) {
  return !!(manifest && manifest.boots === true);
}

// Who the app-owner has let use this app. Read on every ask rather than
// cached at mount, because the owner edits the file while the node runs
// and a cache would mean a revoked key kept working until a restart —
// which is the failure that makes a permission list worth nothing at the
// one moment it matters.
const ALLOW = 'allow.json';
function allowsIn(appFs, log, name) {
  const say = log || function () {};
  // THE VERDICT COLLAPSES THREE CASES; THE DIAGNOSTIC MUST NOT.
  //
  //   wsl-claude, 2026-09-25: "AN ABSENCE THE SYSTEM CHOSE AND AN
  //   ABSENCE THE SYSTEM COULD NOT READ MUST NOT BE INDISTINGUISHABLE
  //   TO THE PERSON WHO WROTE THE FILE."
  //
  // Missing and empty are the owner SAYING something — this puppet has
  // no contacts yet — and deserve silence. A file that exists and does
  // not parse is the owner's MISTAKE, and a mistake that produces the
  // same silence as an intention is a file the owner will stare at
  // wondering why nobody can reach their puppet.
  //
  // Said once per distinct broken content, not once per packet: the list
  // is read on every ask, so logging naively would turn one typo into a
  // line per arrival for as long as it stood.
  let moaned = null;
  return function (key) {
    const want = String(key || '');
    if (!want) return false;
    const raw = appFs.read(ALLOW);
    if (!raw) return false;
    let keys = null;
    try { keys = JSON.parse(raw).keys; }
    catch (e) { keys = null; }
    // Unreadable is not permissive. A torn or hand-broken file means the
    // owner's intent cannot be read, and the safe reading of "I cannot
    // tell who is allowed" is nobody.
    if (!Array.isArray(keys)) {
      if (moaned !== raw) {
        moaned = raw;
        say((name || 'app') + ': ' + ALLOW + ' exists but does not parse as { "keys": [...] }, ' +
          'so nobody may use this app until it is fixed');
      }
      return false;
    }
    moaned = null;
    return keys.indexOf(want) !== -1;
  };
}

// ── WHO OWNS THIS PUPPET (puppets/G6), AND WHAT IT CARRIES (G7) ──────
//
//   Andy: "the app must know who owns it, it stores the key of it's
//   owner", naming the requirement in Desk on 2026-09-27 "Lock puppet out
//   of Self-Ownership", and then ruling what a puppet IS: a node OWNED by
//   another node's ID is a puppet, one puppet per node, several apps on it
//   being apps of ONE puppet ("that is what ties a puppet to its owner").
//
// So the owner belongs to the NODE, not to each app: ONE file at the
// node's home, relay-state/puppet.json, { "owner": "<key>", "carries":
// ["contact", ...] }, written by the owner. ITS PRESENCE makes the node a
// puppet: absent means not a puppet; an owner that is absent or not a key
// means owned by nobody; carries absent means no node group is reachable
// by command. One file, one read per ask, so an owner and a carried list
// never come from two different moments (wsl-claude). Named puppet.json,
// not owner.json, because a relay box already keeps pending-owner.json and
// allow.json for the RELAY's owner in that folder, and two owners with
// near-identical file names is how the next reader picks the wrong one.
//
// THE LOCK is stronger than read-only: relay-state is outside every app's
// scope (scopedFs), so no app can reach the file at all, and "within
// loopback, trust is the responsibility of the box-owner" covers code he
// chose to run. Read on every call, never cached, for allow.json's
// reason, with the same collapse: missing is silent, a broken file is said
// once per distinct content, and the answer is then "nobody".
const PUPPET = 'puppet.json';
const OWNER_KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
const GROUP = /^[a-z][a-z0-9]*$/;
function puppetIn(rootDir, log) {
  const say = log || function () {};
  const file = path.join(String(rootDir || ''), 'relay-state', PUPPET);
  let moaned = null;
  return function () {
    let raw = null;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { raw = null; }
    if (!raw || !String(raw).trim()) return { puppet: false, owner: '', carries: [] };
    let doc = null;
    try { doc = JSON.parse(raw); } catch (e) { doc = null; }
    const owner = doc && typeof doc.owner === 'string' && OWNER_KEY.test(doc.owner) ? doc.owner : '';
    const carries = doc && Array.isArray(doc.carries)
      ? doc.carries.filter(function (g) { return typeof g === 'string' && GROUP.test(g); })
      : [];
    if (!owner) {
      if (moaned !== raw) {
        moaned = raw;
        say(PUPPET + ' exists but names no owner as { "owner": "MCowBQYDK2VwAyEA...", "carries": [...] }, ' +
          'so this puppet is owned by nobody and takes no commands until it is fixed');
      }
    } else {
      moaned = null;
    }
    return { puppet: true, owner: owner, carries: carries };
  };
}

// The app's own folder, and refusing anything that climbs out of it.
// `path.relative` rather than a prefix test, because a prefix test says
// yes to `app/appFaceAppEvil` for the scope `app/appFaceApp`.
function scopedFs(dir, opts) {
  // Files inside the app's own folder that the app may READ but never
  // WRITE. See `OWNER-ONLY` below for why the list exists at all.
  const readOnly = (opts && opts.readOnly) || [];
  function resolve(rel) {
    const full = path.resolve(dir, String(rel || ''));
    const away = path.relative(dir, full);
    if (away.startsWith('..') || path.isAbsolute(away)) {
      throw new Error('outside the app scope: ' + rel);
    }
    return full;
  }
  // COMPARED RESOLVED, NOT AS TYPED. './allow.json', 'x/../allow.json'
  // and 'ALLOW.JSON' on a case-insensitive disc are all the same file,
  // and a guard that compares the string a caller typed is a guard that
  // is bypassed by typing it differently.
  function isReadOnly(rel) {
    const full = resolve(rel);
    return readOnly.some(function (name) {
      const a = path.resolve(dir, name);
      return a === full || a.toLowerCase() === full.toLowerCase();
    });
  }
  return {
    exists: function (rel) { return fs.existsSync(resolve(rel)); },
    read: function (rel) {
      try { return fs.readFileSync(resolve(rel), 'utf8'); }
      catch (e) { return null; }
    },
    // tmp-then-rename, because a half-written grant table is worse than
    // no grant table: the name is either granted or it is not, and a
    // torn file is a third state nobody has a rule for.
    write: function (rel, text) {
      // OWNER-ONLY. Andy, 2026-09-25: "the puppet has it's own contact
      // list, BUT, only the puppets owner has write-authority over that
      // contact list" — and, on whether the puppet holds that authority:
      // "the puppet doesn't".
      //
      // The list lives in the puppet's folder because that is where a
      // puppet's things live, and the folder is where its scope ends —
      // so WITHOUT THIS the puppet could write its own guest list and
      // the permission would be its own to grant. A puppet that can
      // choose its audience has no master.
      if (isReadOnly(rel)) {
        throw new Error('owner-only, a puppet may read this and never write it: ' + rel);
      }
      const file = resolve(rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, String(text));
      fs.renameSync(tmp, file);
      return true;
    },
  };
}

// `rootDir` is the node's home; `app/` beneath it is where apps live and
// is writable (kernel.js:176). Returns the mounted names, for the log
// and for a suite that wants to know the boot happened at all.
function mountAll(opts) {
  const rootDir = String((opts && opts.rootDir) || '');
  const arrivals = opts && opts.arrivals;
  const post = opts && opts.post;
  const log = (opts && opts.log) || function () {};
  const appsDir = path.join(rootDir, 'app');

  let names = [];
  try { names = fs.readdirSync(appsDir); } catch (e) { return []; }

  // Read per ask, never cached: see puppetIn.
  const puppet = puppetIn(rootDir, log);
  const mounted = [];
  names.forEach(function (name) {
    const dir = path.join(appsDir, name);
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8')); }
    catch (e) { return; }
    if (!boots(manifest)) return;

    // A BOOT THAT FAILS TAKES NOTHING WITH IT. One app's bad require
    // must not stop the node coming up or stop the next app mounting —
    // the node is the always-on thing in this system and an app is not
    // allowed to be the reason it is not.
    try {
      const mod = require(path.join(dir, name + '.js'));
      if (!mod || typeof mod.mount !== 'function') return;
      // TWO HANDLES ONTO ONE FOLDER, and the difference is the whole of
      // the owner's authority. `ownerFs` is used by the seam to READ the
      // list; `appFs` is what the puppet gets, and it cannot write it.
      const ownerFs = scopedFs(dir);
      const appFs = scopedFs(dir, { readOnly: [ALLOW] });
      mod.mount({
        name: name,
        dir: dir,
        fs: appFs,
        // WHO MAY USE THIS APP — handed over already built, so no app
        // writes its own. See the header: absent means nobody.
        allows: allowsIn(ownerFs, log, name),
        // WHO OWNS IT, read-only to it: the owner's key, or '' for none.
        // WHO OWNS THIS PUPPET: the node's, one for all its apps (puppetIn).
        owner: function () { return puppet().owner; },
        // The same seam a page subscribes through (arrivals.js:137).
        // Every booted app sees every admitted arrival; none of them is
        // routed to, which is what keeps the node ignorant of payloads.
        subscribe: arrivals && typeof arrivals.subscribe === 'function'
          ? arrivals.subscribe
          : function () { return function () {}; },
        // Reply-as-packet. Signature is peerPost's own
        // (relayUrl, toKey, text, hints, how) so nothing is re-spelled
        // here — a second spelling of an existing interface is the thing
        // the wire probe exists to catch.
        post: typeof post === 'function' ? post : null,
        log: log,
      });
      mounted.push(name);
      log('mounted node app: ' + name);
    } catch (e) {
      log('node app ' + name + ' did not mount: ' + ((e && e.message) || e));
    }
  });
  return mounted;
}

// ── THE SWITCH: WHERE A REMOTE PACKET BECOMES LOCAL AUTHORITY (puppets/G5)
//
//   Andy, 2026-09-26: "so we must make sure in code, that the signature is
//   verified in the pupped, else request is refused."
//
// ONE FUNCTION AND NO DISPATCH. It answers whether an arrival is a command
// from this puppet's owner, and nothing else: the loopback dispatch is its own
// requirement (the shim) and building both together would be two halves
// agreeing with each other instead of with the design. So this returns the
// verb and body to run, or a refusal to answer with.
//
// ── WHAT IT REFUSES, AND WHY EACH ONE MATTERS ────────────────────────
//
// NOT IN PUPPET MODE — Andy's own gate, and the strongest one here because it
// is not a check on the packet at all: "the owner is never in puppet-mode, to
// that gate closes automatically." A node with no owner takes no commands, so
// a forged command arriving at an OWNER is not a command that fails a test; it
// is not a command. That closes puppet -> owner by construction.
//
// NOT FROM THE OWNER — the sender key must be the stored owner key. Necessary
// and nowhere near sufficient, which is the whole finding wsl-claude brought:
// a sibling puppet posting through the shared node arrives WITH the owner's
// key, because that is the only key any puppet can post with.
//
// NO COMMAND SIGNATURE, OR A WRONG ONE — the part that actually closes the
// sibling case. The owner signs `cmd` with its identity key; a puppet holds no
// owner private key and cannot mint one. ABSENT AND WRONG ARE ONE REFUSAL on
// purpose: they are the same security event, and two answers would tell a
// caller which of the two it managed.
//
// The recipient key and the envelope id are inside the signed bytes
// (relayAuth commandMessage), so a command signed for this puppet does not
// verify at a sibling, and the same signature cannot be lifted onto another
// envelope. The tag makes a transport signature fail as an inner one by
// signing different bytes rather than by being noticed.
function ownerCommandIn(arrival, opts) {
  const o = opts || {};
  const ownerKey = String(o.ownerKey || '');
  const selfKey = String(o.selfKey || '');
  const decode = o.decode;
  const auth = o.auth;

  // Andy's mode gate. Absent means nobody: a puppet with no owner established
  // takes no commands from anyone (the same shape as allow.json).
  if (!ownerKey) return { ok: false, status: 403, error: 'not a puppet' };

  const from = String((arrival && arrival.from) || '');
  if (!from || from !== ownerKey) return { ok: false, status: 403, error: 'not the owner' };

  const text = arrival && typeof arrival.text === 'string' ? arrival.text : '';
  // A COMMAND IS A SYSTEM PACKET: AN ENVELOPE ADDRESSED TO NO APP, and the two
  // halves of that are asked separately on purpose. `decode` answers
  // `legacy: false, app: null` for a system packet AND `app: null` for a plain
  // chat line a peer typed — so testing the app alone would dispatch chat as a
  // verb. wsl-claude found that in this rule before it was built; `isEnvelope`
  // is the half that keeps it found.
  if (!o.isEnvelope || !o.isEnvelope(text)) return { ok: false, status: 400, error: 'not a command' };
  const info = decode ? decode(text) : null;
  if (!info || info.app) return { ok: false, status: 400, error: 'not a command' };

  const body = info.body || {};
  const cmd = typeof body.cmd === 'string' ? body.cmd : '';
  const sig = typeof body.sig === 'string' ? body.sig : '';
  if (!cmd || !sig ||
      !auth.commandSignatureOk(ownerKey, ownerKey, selfKey, info.id, cmd, sig)) {
    return { ok: false, status: 403, error: 'bad command signature' };
  }

  let parsed = null;
  try { parsed = JSON.parse(cmd); }
  catch (e) { return { ok: false, status: 400, error: 'not a command' }; }
  if (!parsed || typeof parsed.verb !== 'string' || !parsed.verb) {
    return { ok: false, status: 400, error: 'not a command' };
  }
  return { ok: true, verb: parsed.verb, body: parsed.body || {} };
}

// ── THE OWNER DOOR (puppets/G7, slice 1) ─────────────────────────────
//
// The approved shape (PUPPETS.md G7): commands the owner signs reach the
// node groups this puppet CARRIES, and that is the only route to them.
// The face door and the `puppet` group come in slice 2, after
// public-app-server/G14 and G17.
//
// One arrival at a time, straight from arrivals.subscribe:
//   - not a puppet, not a command, or not from the owner: SILENT. A node
//     that answered strangers would tell them it is a puppet, and a
//     non-puppet must behave exactly as one.
//   - from the owner but failing ownerCommandIn (G5): refused to him.
//   - a verb whose group is not carried here: refused BY NAME,
//     not-carried-here, and the handler never runs. Andy: "not every group
//     is supported in every context/environment".
//   - otherwise the shim runs the verb's own handler with the unwrapped
//     body, as the door in server.js does, and the answer goes back to the
//     owner as a second packet carrying re = the command's hash
//     (transport/R12: "where a hash must match").
//
// THE SHIM: a readable holding the body and a writable catching status and
// body. It carries no headers and no socket on purpose, so a handler that
// reaches for them fails ALONE (G3): that one command is refused, and the
// node and the next command are untouched.
function puppetDoor(opts) {
  const o = opts || {};
  const puppet = o.puppet || puppetIn(o.rootDir, o.log);
  const say = o.log || function () {};
  function reply(message, owner, answer) {
    const made = o.encode('', answer, { re: message.hash });
    if (!made || !made.text) return;
    Promise.resolve(o.post(message.relay, owner, made.text)).catch(function (e) {
      say('puppet door: the answer to ' + String(message.hash).slice(0, 8) + ' could not be sent: ' + e.message);
    });
  }
  function shim(verb, body) {
    return new Promise(function (resolve) {
      const handler = o.handlerFor(verb);
      if (!handler) { resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: verb }); return; }
      const req = require('stream').Readable.from([JSON.stringify(Object.assign({}, body, { verb: verb }))]);
      let status = 200;
      const res = {
        writeHead: function (code) { status = Number(code) || 200; return res; },
        setHeader: function () {},
        write: function () { return true; },
        end: function (text) {
          let parsed = null;
          try { parsed = JSON.parse(String(text || '')); } catch (e) { parsed = null; }
          resolve({ ok: status < 400, status: status, body: parsed, text: parsed ? undefined : String(text || '') });
        },
      };
      try { handler(req, res); }
      catch (e) { resolve({ ok: false, status: 500, code: 'handler-failed', error: 'the handler failed', verb: verb }); }
    });
  }
  return function (message) {
    const p = puppet();
    if (!p.puppet || !p.owner) return;
    const from = String((message && (message.fromKey || message.from)) || '');
    if (from !== p.owner) return;
    const text = message && typeof message.text === 'string' ? message.text : '';
    if (!o.isEnvelope(text)) return;
    const info = o.decode(text);
    if (!info || info.app || !info.body || typeof info.body.cmd !== 'string') return;
    const got = ownerCommandIn({ from: from, text: text }, {
      ownerKey: p.owner, selfKey: o.selfKey(), decode: o.decode, isEnvelope: o.isEnvelope, auth: o.auth,
    });
    if (!got.ok) { reply(message, p.owner, got); return; }
    const group = got.verb.split('.')[0];
    if (p.carries.indexOf(group) === -1) {
      reply(message, p.owner, { ok: false, status: 403, code: 'not-carried-here', verb: got.verb,
        error: 'not carried by this puppet' });
      return;
    }
    shim(got.verb, got.body).then(function (answer) {
      reply(message, p.owner, Object.assign({ verb: got.verb }, answer));
    });
  };
}

module.exports = {
  mountAll: mountAll, boots: boots, scopedFs: scopedFs, allowsIn: allowsIn,
  puppetIn: puppetIn, puppetDoor: puppetDoor, ownerCommandIn: ownerCommandIn,
};
