'use strict';

// spirit/run/js/nodeApps.js
// APPS THAT RUN IN THE NODE, AND THE ONE SEAM THEY GET.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
// Every app until now has been a page: the shell loads it, it talks to
// the door, and when no browser is open it does not exist. THAT SHAPE
// CANNOT HOLD A NEGOTIATION. The appShellApp grants subdomain names to
// members, and a grant asked for while the owner's browser is shut must
// still be answered — the owner's node is what is always on, not the
// owner's screen.
//
//   Andy, 2026-09-25: "the appShellApp could implement the bare minimum,
//   and this is the no-face negotiation, without any local shell
//   interface yet or anything."
//
// So: an app with no page, booted by the node, reachable only over the
// wire. `appShellGrant.js` asserts the facelessness directly — no HTML,
// no stylesheet, nothing that listens — because a control panel is the
// obvious next convenience and nothing would go red.
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

// The app's own folder, and refusing anything that climbs out of it.
// `path.relative` rather than a prefix test, because a prefix test says
// yes to `app/appShellAppEvil` for the scope `app/appShellApp`.
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
      mod.mount({
        name: name,
        dir: dir,
        fs: scopedFs(dir),
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

module.exports = { mountAll: mountAll, boots: boots, scopedFs: scopedFs };
