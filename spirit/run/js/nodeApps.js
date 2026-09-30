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
//   ./spirit/run/shell/<appname>/<appname>.js"
//
// So a booted app gets `read`/`write`/`exists` and they resolve inside
// its own folder and nowhere else. That is the same boundary
// `kernel.js:176` already draws for a page — `shell/` is writable, and an
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

const OWNER_KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
// A node is a puppet when relay-state/owner.json names a key that is not its
// own (Andy: "pupped is the fate of having an owner that is not the self").
function selfKeyIn(rootDir) {
  try {
    const id = JSON.parse(fs.readFileSync(path.join(String(rootDir || ''), 'relay-state', 'identity.json'), 'utf8'));
    return id && typeof id.publicKey === 'string' ? id.publicKey : '';
  } catch (e) { return ''; }
}
function puppetIn(rootDir, log) {
  const say = log || function () {};
  const file = path.join(String(rootDir || ''), 'relay-state', 'owner.json');
  let moaned = null;
  return function () {
    let raw = null;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { raw = null; }
    if (!raw || !String(raw).trim()) return { puppet: false, owner: '' };
    let doc = null;
    try { doc = JSON.parse(raw); } catch (e) { doc = null; }
    const owner = doc && typeof doc.owner === 'string' && OWNER_KEY.test(doc.owner) ? doc.owner : '';
    if (!owner) {
      if (moaned !== raw) {
        moaned = raw;
        say('owner.json names no owner as { "owner": "MCowBQYDK2VwAyEA..." }, so this node takes no owner commands until it is fixed');
      }
      return { puppet: false, owner: '' };
    }
    moaned = null;
    if (owner === selfKeyIn(rootDir)) return { puppet: false, owner: '' };
    return { puppet: true, owner: owner };
  };
}

// The app's own folder, and refusing anything that climbs out of it.
// `path.relative` rather than a prefix test, because a prefix test says
// yes to `shell/appFaceAppEvil` for the scope `shell/appFaceApp`.
function scopedFs(dir) {
  function resolve(rel) {
    const full = path.resolve(dir, String(rel || ''));
    const away = path.relative(dir, full);
    if (away.startsWith('..') || path.isAbsolute(away)) {
      throw new Error('outside the app scope: ' + rel);
    }
    return full;
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
      const file = resolve(rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, String(text));
      fs.renameSync(tmp, file);
      return true;
    },
  };
}

// `rootDir` is the node's home; `shell/` beneath it is where apps live and
// is writable (kernel.js:176). Returns the mounted names, for the log
// and for a suite that wants to know the boot happened at all.
function mountAll(opts) {
  const rootDir = String((opts && opts.rootDir) || '');
  const arrivals = opts && opts.arrivals;
  const post = opts && opts.post;
  const face = opts && opts.face;
  const servers = opts && opts.servers;
  const log = (opts && opts.log) || function () {};
  const appsDir = path.join(rootDir, 'shell');

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
      const appFs = scopedFs(dir);
      mod.mount({
        name: name,
        dir: dir,
        fs: appFs,
        // WHO OWNS IT, read-only to it: the owner's key, or '' for none.
        // WHO OWNS THIS PUPPET: the node's, one for all its apps (puppetIn).
        owner: function () { return puppet().owner; },
        // Every booted app sees every admitted arrival; none of them is
        // routed to, which is what keeps the node ignorant of payloads.
        // AS A WITNESS, NOT A READER (arrivals.witness). A booted app is not
        // a page: as a subscriber it took the backlog at boot and marked
        // every arrival taken 2 ms after it landed, so a page that opened
        // later was handed nothing (wsl-claude, live, on fixList and
        // appFaceApp).
        subscribe: arrivals && typeof arrivals.witness === 'function'
          ? arrivals.witness
          : function () { return function () {}; },
        // Reply-as-packet. Signature is peerPost's own
        // (relayUrl, toKey, text, hints, how) so nothing is re-spelled
        // here — a second spelling of an existing interface is the thing
        // the wire probe exists to catch.
        post: typeof post === 'function' ? post : null,
        // THE FACE, only on a node that has one (relay-state/face.json;
        // puppetPost.js, public-app-server/G17). face(handler) claims the
        // visitors' requests for this app: the same app may claim again, any
        // other app is refused. Absent on every other node, so an app cannot
        // mistake a node without a face for one that has it.
        face: face && typeof face.claim === 'function'
          ? function (handler) { return face.claim(name, handler); }
          : undefined,
        // THE HOP TO AN APP SERVER ON THIS BOX (appClient.js, G17's last
        // leg): toLocalApp(appName, { method, path, body, type }) answers
        // { status, body, type }, named refusals included. BY APP NAME: which
        // app answers a visitor is appFaceApp's table, never the node's
        // (Andy: "the core only knows about puppets"). A booted app may
        // not reach for http itself (appFaceGrant.js), so the node makes
        // this one hop for it. A node verb by Andy's own gate: "i explicitly
        // permit the two new/proposed interfaces/api' for communication
        // from node to appserver" (2026-09-27, Desk, G17). Absent on a node
        // that starts no app servers.
        toLocalApp: servers && typeof servers.toLocalApp === 'function'
          ? function (appName, request) { return servers.toLocalApp(appName, request); }
          : undefined,
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
// Commands the owner signs reach the whole node surface, as a loopback
// client would (Andy's puppet ruling).
//
// One arrival at a time, straight from arrivals.subscribe:
//   - not a puppet, not a command, or not from the owner: SILENT. A node
//     that answered strangers would tell them it is a puppet, and a
//     non-puppet must behave exactly as one.
//   - from the owner but failing ownerCommandIn (G5): refused to him.
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
    let made = o.encode('', answer, { re: message.hash });
    // TOO BIG FOR A PACKET IS SAID, NEVER DROPPED (puppets/G1). packet.encode
    // refuses an answer that cannot travel, and this returned without a
    // word, so the owner waited out its wait for 'no reply from puppet'
    // instead of the reason (wsl-claude: jobs.list on a puppet, 42,570
    // bytes). The refusal names the verb and the size, and always fits.
    if (!made || !made.text) {
      const bytes = Buffer.byteLength(JSON.stringify(answer || {}), 'utf8');
      say('puppet door: the answer to ' + String(message.hash).slice(0, 8) + ' (' + String(answer && answer.verb) +
        ', ' + bytes + ' bytes) is too large for a packet; refused by name');
      made = o.encode('', { ok: false, status: 413, code: 'answer-too-large', verb: answer && answer.verb, bytes: bytes,
        error: 'answer too large for a packet' }, { re: message.hash });
      if (!made || !made.text) return;
    }
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
      // A HANDLER CAN FAIL TWICE: at once, or later in the promise it returns.
      // wsl-claude found the second escaping: no answer to the owner, and an
      // unhandled rejection, which stops a Node 24 process. Both land here,
      // and resolve settles only once.
      const failed = function () {
        resolve({ ok: false, status: 500, code: 'handler-failed', error: 'the handler failed', verb: verb });
      };
      let ran = null;
      try { ran = handler(req, res); }
      catch (e) { failed(); return; }
      if (ran && typeof ran.then === 'function') ran.then(null, failed);
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
    shim(got.verb, got.body).then(function (answer) {
      reply(message, p.owner, Object.assign({ verb: got.verb }, answer));
    });
  };
}

module.exports = {
  mountAll: mountAll, boots: boots, scopedFs: scopedFs,
  puppetIn: puppetIn, puppetDoor: puppetDoor, ownerCommandIn: ownerCommandIn,
};
