'use strict';

// spirit/test/oneDoor.js
// ALL COMMS GO THROUGH ONE INTERFACE. EVERY FILE. ALWAYS.
//
//   Andy: "we have one component that provides signed requests over http
//   in public. all other components must use that interface. no
//   exception... we are done, reaching for require('http') when something
//   needs doing."
//   Andy: "how MANY times do we have to go through this??? ... it's not
//   only new files. it's all files! Always! we need to enforce this
//   stronger."
//
// ── WHAT THE FIRST VERSION OF THIS FILE GOT WRONG ────────────────────
//
// It shipped this morning and was already too soft in two ways, both of
// which let exactly the thing it exists to stop happen again the same day:
//
//   1. AN UNCOUNTED EXEMPT LIST. server.js and kernel.js were "structural"
//      and therefore unbounded — they could grow any number of new reaches
//      and this file would say nothing. Fourteen live in kernel.js. A
//      ceiling nobody counts is not a ceiling.
//
//   2. IT NEVER LOOKED AT spirit/test/. Sixty-odd reaches, unwatched — and
//      a test is where the rule gets escaped FIRST, because bypassing the
//      interface is always the quickest way to make a thing go green. That
//      is the "prototyping" exception Andy is refusing, and partnerGate.js
//      is a live example: it drives B by calling B.box.routePost() rather
//      than by reaching B the way anything real would.
//
// ── SO THERE IS ONE CENSUS AND NOTHING SITS OUTSIDE IT ───────────────
//
// Every .js under run/js, run/js/client, run/app and test is counted. A
// file's number may FALL freely and may never RISE. A file not in the
// census must have zero. There is no category that means "unlimited",
// because that category is what got used.
//
// The interface is `peerPost` — signing, the hash computed and never sent
// and derived again on the answering side, dispatch by that hash — over
// `relayRequest` for the outbound half and `sseClient` for the inbound.
// Those two files are in the census like everything else; being the
// transport earns a number, not an exemption.
//
// WHY A TEST AND NOT A CONVENTION: `fetch` is a global in both runtimes.
// Nothing fails, nothing warns, and the wrong thing is three characters
// shorter than the right thing.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const SPIRIT = path.join(__dirname, '..');

const REACHES = [
  { what: 'fetch(',            re: /\bfetch\s*\(/ },
  { what: "require('http')",   re: /require\(\s*['"]https?['"]\s*\)/ },
  { what: 'http.request',      re: /\bhttps?\.request\s*\(/ },
  { what: 'new EventSource',   re: /\bnew\s+EventSource\b/ },
  { what: 'XMLHttpRequest',    re: /\bnew\s+XMLHttpRequest\b/ },
];

// ── THE CENSUS, TAKEN 2026-09-16 ──────────────────────────────────────
//
// Every number here is a decision somebody has to defend. Lowering one is
// ordinary work and needs no ceremony; RAISING one, or adding a line, is
// Andy granting an exception out loud.
//
// Read it as a bill. The two at the top are the interface itself; the rest
// is what has not been moved onto it yet.
const CENSUS = {
  // THE INTERFACE. Counted like everything else.
  'js/relayRequest.js': 2,   // http + https, the outbound socket
  'js/sseClient.js': 0,      // global fetch, via a capability probe

  // THE BROWSER'S TRANSPORT. A page cannot require a node module, so
  // kernel.js is the other side of the same rule rather than an exception
  // to it — but FOURTEEN is not a design, it is a drawer. It has a number
  // now and the number may only fall.
  'js/kernel.js': 14,

  // THE SERVER ITSELF: http.createServer, and fetchExternal, the gated
  // door apps ask for by verb rather than by URL.
  'js/server.js': 2,

  // AGENT.md: unused, do not assume it is loaded, do not delete.
  'js/client/browser.js': 1,

  // ── TESTS ───────────────────────────────────────────────────────────
  //
  // Counted for the first time. Some of these are legitimate — a suite
  // that spawns a real relay must be able to ask it something at the
  // transport level, and asserting a 404 needs a request rather than a
  // verb. Others are the quick way to green. The census does not judge
  // which is which; it stops the number growing while nobody looks.
  'test/chatPeople.js': 1,
  'test/cycleA.js': 1,
  'test/htmlEscaping.js': 1,
  'test/jobCallback.js': 1,
  'test/labLifecycle.js': 1,
  'test/labPersistence.js': 2,
  'test/labPopulate.js': 4,
  'test/labRefusals.js': 3,
  'test/labRelaySurface.js': 2,
  'test/labServableStatic.js': 2,
  'test/labWorld.js': 5,
  'test/liveFrontDoor.js': 3,
  'test/liveRelay.js': 2,
  'test/oneDoor.js': 3,        // this file: the patterns it searches for
  'test/presenceShow.js': 5,
  'test/presenceWire.js': 6,
  'test/relayGates.js': 2,
  'test/relayProbe.js': 1,
  'test/serverSurface.js': 3,

  // labMaster: the lab control plane, which spawns and drives fake nodes.
  // FOUND BY THIS REWRITE and not by the hand count that preceded it — the
  // old scan stopped at the top of each directory and never descended, so
  // nine reaches sat one level down, unwatched, for as long as the guard
  // has existed. The recursive walk is the difference between "every file"
  // and "every file I happened to list".
  'test/labMaster/ensureMaster.js': 2,
  'test/labMaster/labMaster.js': 7,
};

// Not code this project ships or runs in a node: spawned scripts talking
// to third parties, and dependencies.
const SKIP = ['process', 'node_modules'];

function walk(dir, prefix, out) {
  fs.readdirSync(dir).forEach(function (name) {
    if (SKIP.indexOf(name) !== -1) return;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full, prefix + name + '/', out); return; }
    if (name.endsWith('.js')) out.push({ rel: prefix + name, full: full });
  });
  return out;
}

// Comments stripped: a file explaining why it no longer fetches must not
// read as fetching, and this tree writes its reasoning down at length.
function reachesIn(file) {
  const src = fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
  let n = 0;
  src.split('\n').forEach(function (line) {
    REACHES.forEach(function (r) { if (r.re.test(line)) n++; });
  });
  return n;
}

test.startTest('One door — every file, always');

const files = walk(path.join(SPIRIT, 'run', 'js'), 'js/', [])
  .concat(walk(path.join(SPIRIT, 'run', 'app'), 'app/', []))
  .concat(walk(path.join(SPIRIT, 'test'), 'test/', []));

// ── 1. NOBODY OUTSIDE THE CENSUS TOUCHES THE WIRE ──────────────────────
test.subHeading('A file not in the census reaches for nothing');

{
  const strangers = [];
  files.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(CENSUS, f.rel)) return;
    const n = reachesIn(f.full);
    if (n > 0) strangers.push(f.rel + ' (' + n + ')');
  });

  if (strangers.length === 0) {
    test.check(files.length + ' files scanned; everything outside the census is clean');
  } else {
    test.fail('reaching past the interface: ' + strangers.join(', ') +
      ' — use peerPost, or decide to modify the interface. Do not add a line to the census.');
  }
}

// ── 2. AND THE CENSUS ONLY FALLS ───────────────────────────────────────
test.subHeading('Every counted file is at or below its number');

{
  const grown = [];
  const fell = [];
  const gone = [];
  Object.keys(CENSUS).forEach(function (rel) {
    const full = path.join(SPIRIT, rel.indexOf('test/') === 0 ? '' : 'run', rel);
    if (!fs.existsSync(full)) { gone.push(rel); return; }
    const n = reachesIn(full);
    if (n > CENSUS[rel]) grown.push(rel + ': ' + CENSUS[rel] + ' -> ' + n);
    if (n < CENSUS[rel]) fell.push(rel + ': ' + CENSUS[rel] + ' -> ' + n);
  });

  if (grown.length === 0) {
    const total = Object.keys(CENSUS).reduce(function (n, k) { return n + CENSUS[k]; }, 0);
    test.check('no file grew a reach — ' + total + ' across ' +
      Object.keys(CENSUS).length + ' files, and that number may only fall');
  } else {
    test.fail('THE COUNT WENT UP: ' + grown.join(', ') +
      ' — that is the back-sliding this suite exists to stop');
  }

  // Falling is the point, and it still has to be recorded: the next rise
  // must start from a floor somebody checked, not from whatever the file
  // happened to be at.
  if (fell.length === 0 && gone.length === 0) {
    test.check('and the recorded numbers still match the tree');
  } else {
    test.fail('good news, needs recording: ' + fell.concat(gone.map(function (g) {
      return g + ' (file gone)';
    })).join(', ') + ' — lower it in CENSUS');
  }
}

// ── 3. THE INTERFACE IS STILL THE INTERFACE ────────────────────────────
test.subHeading('peerPost owns the mechanics, and is handed its socket');

{
  const code = function (rel) {
    return fs.readFileSync(path.join(SPIRIT, 'run', rel), 'utf8')
      .split('\n')
      .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
      .join('\n');
  };
  const peerPost = code('js/peerPost.js');

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

  if (reachesIn(path.join(SPIRIT, 'run', 'js', 'peerPost.js')) === 0) {
    test.check('and it reaches for no socket of its own — the transport is injected');
  } else {
    test.fail('peerPost reached for a socket; opts.request is the only way out');
  }

  // THE PROPERTY THAT MAKES RELAY-TO-RELAY NEED NO NEW PROTOCOL. If this
  // breaks, partner work silently grows a second transport.
  const trafficInjected = /opts\.traffic/.test(peerPost);
  const whoBookUses = (peerPost.match(/whoBook\./g) || []).length;
  if (trafficInjected && whoBookUses <= 2) {
    test.check('traffic is injected and whoBook is inbound-only, so a relay may construct one');
  } else {
    test.fail('peerPost grew node-only coupling: traffic injected=' +
      trafficInjected + ', whoBook uses=' + whoBookUses);
  }

  // AND THE TRANSPORT IS REACHABLE BY BOTH. It sat inside hub.js until
  // 2026-09-16, which is why a relay had no way to obey the rule and the
  // shortcut was available to take.
  const wire = code('js/relayRequest.js');
  if (/function relayRequest/.test(wire) && !/whoBook|ownerBadge|peerStats/.test(wire)) {
    test.check('and relayRequest is its own module, with none of the node on it');
  } else {
    test.fail('the transport is back inside something');
  }
}

// ── 4. AN INTERFACE IS OPAQUE, OR IT IS NOT AN INTERFACE ───────────────
//
//   Andy: "this whole enforcement rule must include calling inside-the
//   interface helpers. that is the whole point of interfaces. they must be
//   opaque. their internal mechanics shouldn't even be reachable."
//
// The reach that a `fetch` census cannot see. I gave peerSearch and
// gradedSearch an `internal: {...}` bag holding eleven helpers, labelled
// "for the suite alone" — an escape hatch with a note on it. Reachable is
// reachable: a caller will eventually reach for the same reason a test
// did, and a mechanic with a caller is a mechanic that cannot change,
// which was the whole reason that module was separated out.
//
// WHAT IT COST TO CLOSE IT, which is the argument for closing it: two of
// the thirteen assertions that went through the bag turned out to be
// testing branches NO CALLER CAN REACH. `globMatches('abcd','abc')` is
// false and irrelevant — a query with no wildcard never consults the
// matcher. `tokenScore('two','twelve')` is 0.667 and unreachable — a
// one-word query that is not a substring is not a result at all. An escape
// hatch does not only permit bad calls; it hides which calls are possible.
test.subHeading('No module offers a way past its own front door');

{
  const HATCHES = [/\binternal\s*:/, /\b_[a-z]\w*\s*:\s*function/];
  const offenders = [];
  files.forEach(function (f) {
    if (f.rel.indexOf('js/') !== 0) return;
    const src = fs.readFileSync(f.full, 'utf8')
      .split('\n')
      .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
      .join('\n');
    // THE WHOLE FILE, not just module.exports. A first draft looked only
    // at the export block and missed four underscore hooks on the object
    // presenceNode's FACTORY returns — which is a public surface too, and
    // is where a hook is likeliest to be added because it feels private.
    HATCHES.forEach(function (re) {
      if (re.test(src)) offenders.push(f.rel + ' (' + re.source + ')');
    });
  });

  if (offenders.length === 0) {
    test.check('no module exports an `internal` bag or an underscore hook');
  } else {
    test.fail('escape hatches: ' + offenders.join(', ') +
      ' — if the mechanics are reachable they are not encapsulated');
  }
}

{
  // And nothing reaches through one, wherever it came from.
  const reaching = [];
  files.forEach(function (f) {
    const src = fs.readFileSync(f.full, 'utf8')
      .split('\n')
      .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
      .join('\n');
    if (/\.internal\./.test(src)) reaching.push(f.rel);
  });

  if (reaching.length === 0) {
    test.check('and nothing reaches through one — tests included, first of all');
  } else {
    test.fail('reaching into internals: ' + reaching.join(', '));
  }
}

test.reportSuccessFailureCount();
