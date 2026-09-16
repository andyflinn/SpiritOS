'use strict';

// spirit/test/oneDoor.js
// ALL COMMS GO THROUGH ONE INTERFACE, and this is what holds that line.
//
//   Andy: "we have one component that provides signed requests over http
//   in public. all other components must use that interface. no
//   exception. if the interface is insufficient for the task at hand, we
//   must decide to either modify the interface or explicitly grant an
//   exception. period. we are done, reaching for require('http') when
//   something needs doing."
//
// The interface is `peerPost`, and it is not the socket — it is the
// mechanics. Signing; the hash COMPUTED AND NEVER SENT, derived on the
// answering side from the bytes that actually arrived, which is what
// proves the responder read the request; and dispatch by that hash, so a
// reply reaches the requester that asked and nobody else. The transport
// arrives as `opts.request` and `peerPost` never reaches for one.
//
// WHY A TEST AND NOT A CONVENTION. `fetch` is a global in both runtimes.
// Nothing fails, nothing warns, and the wrong thing is three characters
// shorter than the right thing — so the rule cannot survive on discipline
// and has already back-slid more than once. AGENT.md carried it as a
// *target* with a standing pass for one file; twelve direct calls across
// six apps grew in behind that pass, because an exemption nobody has to
// argue for is an exemption everybody takes.
//
// THERE IS NO EXCEPTION LIST. This shipped with twelve grandfathered
// reaches frozen at a count that could only fall; Andy: "ok, lets fully
// enforce this, and then fix where this rule has been neglected." All
// twelve are gone — six apps onto `api.verb`, one binary read into
// kernel.js where the browser's transport lives, one dead poll against a
// route deleted with the ring — so the list has nothing left to hold and
// keeping an empty one would only be an invitation.
//
// Adding a name below is Andy granting an exception, out loud, and never
// a commit that happens to pass.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');

// Reaching for the wire. `fetch(` catches the call and not the word, so
// sseClient's `typeof fetch === 'function'` capability probe does not
// register as one — that file is handed the global, it does not call it
// blind.
const REACHES = [
  { what: 'fetch(',            re: /\bfetch\s*\(/ },
  { what: "require('http')",   re: /require\(\s*['"]https?['"]\s*\)/ },
  { what: 'http.request',      re: /\bhttps?\.request\s*\(/ },
  { what: 'new EventSource',   re: /\bnew\s+EventSource\b/ },
  { what: 'XMLHttpRequest',    re: /\bnew\s+XMLHttpRequest\b/ },
];

// ── THE INTERFACE, AND THE TWO FILES THAT ARE IT ────────────────────────
//
// Not a list of doors. One interface, and these are the files it is made
// of — a node has no public address, so it has an outbound half and an
// inbound half, and the inbound half is not a way around the outbound one.
const INTERFACE = {
  'js/relayRequest.js':
    'THE outbound transport. http/https live here and nowhere else in ' +
    'node code; every caller is handed it, injected. It sat inside ' +
    'hub.js until 2026-09-16, which put the one interface everything ' +
    'must use inside the NODE’s hub — so a relay could not reach it ' +
    'without the node’s machinery, and the only ways out of that were ' +
    'to reach for http directly or to go without.',
  'js/sseClient.js':
    'the INBOUND half. A relay cannot call a node that has no public ' +
    'address, so it pushes down a held stream. Parser, reconnect, idle ' +
    'watchdog; it holds no relay concepts and takes fetchImpl for tests.',
};

// ── STRUCTURE, NOT COMMS ────────────────────────────────────────────────
const STRUCTURAL = {
  'js/server.js':
    'http.createServer — this IS the server. Inbound, and its one ' +
    'outbound fetch is fetchExternal, the gated door to third parties ' +
    'that apps ask for by verb rather than by URL.',
  'js/kernel.js':
    'the browser runtime. A page cannot require a node module; kernel.js ' +
    'is where the browser’s transport lives, and the shell is its only ' +
    'caller. Not an exception to the rule — the other side of it.',
};

// ── GRANTED EXCEPTIONS — EMPTY, AND THAT IS THE POINT ───────────────────
//
// Cleared 2026-09-16, the same day it was written. What was in it:
//
//   app/aiChat            2   -> api.verb + spirit.core.fs.loadDataUrl
//   app/contacts          2   -> api.verb
//   app/contactsDetails   1   -> api.verb
//   app/natter            2   -> api.verb
//   app/natterDetails     1   -> api.verb
//   app/relayChat         2   -> api.verb, and one dead poll deleted
//   js/client/shell.js    2   -> one postToNode, which api.verb is over
//
// `js/client/browser.js` was never here: AGENT.md says it is unused and to
// leave it, so it is skipped entirely rather than granted a pass it would
// then appear to have earned.
const GRANTED = {};

const SKIP_ENTIRELY = [
  // Spawned scripts talking to LM Studio and WordPress. They are outside
  // the node speaking to third parties, not components speaking to it.
  'process',
  // AGENT.md: unused, do not assume it is loaded, do not delete.
  path.join('js', 'client', 'browser.js'),
  'node_modules',
];

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    const full = path.join(dir, name);
    const rel = path.relative(RUN, full).split(path.sep).join('/');
    if (SKIP_ENTIRELY.some(function (s) {
      const norm = s.split(path.sep).join('/');
      return rel === norm || rel.indexOf(norm + '/') === 0;
    })) return;
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full, out); return; }
    if (name.endsWith('.js')) out.push({ rel: rel, full: full });
  });
  return out;
}

// Comments stripped, exactly as the packet scan does: a file explaining
// why it no longer fetches must not read as fetching, and this tree
// writes its reasoning down at length on purpose.
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

function reachesIn(file) {
  const src = codeOf(file);
  let n = 0;
  src.split('\n').forEach(function (line) {
    REACHES.forEach(function (r) { if (r.re.test(line)) n++; });
  });
  return n;
}

test.startTest('One door — all comms through one interface');

const files = walk(RUN, []);

// ── 1. NOBODY NEW ───────────────────────────────────────────────────────
test.subHeading('No component reaches for the wire on its own');

{
  const strangers = [];
  files.forEach(function (f) {
    if (INTERFACE[f.rel] || STRUCTURAL[f.rel] || GRANTED[f.rel]) return;
    const n = reachesIn(f.full);
    if (n > 0) strangers.push(f.rel + ' (' + n + ')');
  });

  if (strangers.length === 0) {
    test.check('nothing outside the interface touches http, fetch or a stream');
  } else {
    test.fail('reaching past the interface: ' + strangers.join(', ') +
      ' — use peerPost, or decide to modify the interface. Do not add a line here.');
  }
}

// ── 2. THE GRANTED LIST ONLY SHRINKS ────────────────────────────────────
test.subHeading('The exception list is frozen and falling');

{
  const grown = [];
  const gone = [];
  Object.keys(GRANTED).forEach(function (rel) {
    const full = path.join(RUN, rel);
    if (!fs.existsSync(full)) { gone.push(rel + ' (file gone)'); return; }
    const n = reachesIn(full);
    if (n > GRANTED[rel]) grown.push(rel + ': ' + GRANTED[rel] + ' -> ' + n);
    if (n < GRANTED[rel]) gone.push(rel + ': ' + GRANTED[rel] + ' -> ' + n);
  });

  if (grown.length === 0) {
    test.check('no granted file grew a new reach');
  } else {
    test.fail('THE COUNT WENT UP: ' + grown.join(', ') +
      ' — that is the back-sliding this suite exists to stop');
  }

  // Falling is the point, but the number is written down and must stay
  // true, or the next rise starts from a floor nobody checked.
  if (gone.length === 0) {
    test.check('and the recorded counts still match the tree');
  } else {
    test.fail('good news, needs recording: ' + gone.join(', ') +
      ' — lower the numbers in GRANTED');
  }
}

// ── 3. THE INTERFACE IS STILL THE INTERFACE ─────────────────────────────
test.subHeading('peerPost owns the mechanics, and is handed its socket');

{
  const peerPost = codeOf(path.join(RUN, 'js', 'peerPost.js'));
  const owns =
    /opts\.request/.test(peerPost) &&
    /requestHash/.test(peerPost) &&
    /waiting\[/.test(peerPost) &&
    /function settle/.test(peerPost);
  if (owns) {
    test.check('signing, the derived hash, waiting[hash] and settle() are all still here');
  } else {
    test.fail('peerPost no longer owns the request mechanics');
  }

  if (reachesIn(path.join(RUN, 'js', 'peerPost.js')) === 0) {
    test.check('and it reaches for no socket of its own — the transport is injected');
  } else {
    test.fail('peerPost reached for a socket; opts.request is the only way out');
  }
}

// ── 4. AND A RELAY CAN BE A CLIENT OF IT ────────────────────────────────
//
// The thing that makes relay-to-relay need no new protocol. If this
// breaks, partner work silently grows a second transport.
{
  const peerPost = codeOf(path.join(RUN, 'js', 'peerPost.js'));
  const trafficInjected = /opts\.traffic/.test(peerPost);
  const whoBookLines = (peerPost.match(/whoBook\./g) || []).length;
  if (trafficInjected && whoBookLines <= 2) {
    test.check('traffic is injected and whoBook is inbound-only, so a relay may construct one');
  } else {
    test.fail('peerPost grew node-only coupling: traffic injected=' +
      trafficInjected + ', whoBook uses=' + whoBookLines);
  }
}

test.reportSuccessFailureCount();
