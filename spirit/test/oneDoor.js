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
// ── SO THERE IS ONE TALLY AND NOTHING SITS OUTSIDE IT ───────────────
//
// Every .js under run/js, run/js/client, run/app and test is counted. A
// file's number may FALL freely and may never RISE. A file not in the
// tally must have zero. There is no category that means "unlimited",
// because that category is what got used.
//
// The interface is `peerPost` — signing, the hash computed and never sent
// and derived again on the answering side, dispatch by that hash — over
// `relayRequest` for the outbound half and `sseClient` for the inbound.
// Those two files are in the tally like everything else; being the
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

// ── THE TALLY, TAKEN 2026-09-16 ──────────────────────────────────────
//
// Every number here is a decision somebody has to defend. Lowering one is
// ordinary work and needs no ceremony; RAISING one, or adding a line, is
// Andy granting an exception out loud.
//
// Read it as a bill. The two at the top are the interface itself; the rest
// is what has not been moved onto it yet.
const TALLY = {
  // THE INTERFACE. Counted like everything else.
  'js/relayRequest.js': 2,   // http + https, the outbound socket
  'js/sseClient.js': 0,      // global fetch, via a capability probe

  // kernel.js HAS NO ENTRY — EXEMPT BY ANDY'S RULING, 2026-10-02:
  // "we exempt kernel.js from the oneDoor contract." and "because
  // kernel.js is an environment-splitter." It is the one shared loopback
  // client for every environment ("i like to have javascipt interfaces
  // shared by all loopback clients via kernel.js, it is exactly to
  // encourage/enforce a oneDoor policy"), so counting its lines counted
  // the interface against itself. The walk below skips it by name; a raw
  // reach anywhere else still has nowhere to hide.

  // THE SAME RULE FOR AN APP SERVED WITHOUT A SHELL — a new line, and so
  // an exception. GRANTED BY ANDY 2026-09-24, asked for out loud as this
  // tally requires: *"i grant ask.js (app/shared/ask.js), i approve of
  // where it sits in the folder tree. go. it's a useful tool"*.
  //
  // `kernel.js` above is here because a page cannot require a node
  // module. This is that sentence again for a page the shell never
  // serves: an app on a public app server loads no kernel, and peerPost
  // is node-side, so the browser needs one door of its own.
  //
  // IT EXISTS TO MAKE THIS NUMBER SMALLER, NOT LARGER. G3 counted four
  // raw callers and the fourth was in `shell/starter` — the sample every
  // stranger copies, where a fork does not add one caller, IT TEACHES
  // THE HABIT. One home means app pages stop writing their own.
  //
  // ONE REACH, AND THE NUMBER MAY ONLY FALL. The moment it is two, this
  // suite fails, which is what makes the grant safe to have given.
  'shell/shared/ask.js': 1,

  // THE FORK DETECTOR, which has to touch the wire to watch the wire — a
  // new line, and so an exception. GRANTED BY ANDY 2026-09-25, asked for
  // out loud as this tally requires: he was given the argument and
  // answered *"Yes."*
  //
  // The two are `require('http')` and `require('https')`, and it PATCHES
  // them rather than calling them: it wraps `.request` to record which
  // stacks in our own code reach it, and forwards every call untouched.
  // It sends nothing and receives nothing.
  //
  // IT EXISTS TO MAKE THIS TALLY TRUE RATHER THAN MERELY KEPT. This
  // suite gates which FILES may reach the wire; it cannot see which
  // ROUTES do, because a fork has no reference for anything to follow.
  // On its first real run it found `GET /api/relay/key` composed from
  // three places — and the duplicate was a security defect, not
  // untidiness: the app server pinned the relay's identity and then
  // `sealedClaim` fetched it again and sealed an invite to whatever
  // answered.
  //
  // TWO, AND THE NUMBER MAY ONLY FALL. It runs only when invoked
  // (`node spirit/test/tools/wirePaths.js`) and instruments nothing
  // during an ordinary harness run.
  //
  // ── 2 -> 0 ON 2026-09-25, AND THE REASON IS A BLIND SPOT IN THIS FILE
  //
  // The probe was generalised so its bottom is DATA — `{ mod: 'http', fn:
  // 'request' }` — and patched with `require(b.mod)`. It reaches exactly
  // as far as it did yesterday. THE LITERAL `require('http')` IS GONE, SO
  // THIS SUITE CAN NO LONGER SEE IT.
  //
  // Lowering is ordinary and needs no ceremony, so the number falls. But
  // the number is now WRONG IN THE HONEST DIRECTION, and the finding
  // matters more than the entry: **`require(<variable>)` is invisible to
  // every pattern in REACHES.** Anything wanting to bypass this gate can
  // do it by not writing the module's name, and it would show as a file
  // with a clean zero.
  //
  // FOUND BY ACCIDENT, by the tool built to find forks, while being made
  // reusable. It is not fixed here: a regex cannot follow a variable, and
  // what would close it is the probe itself — arrival rather than
  // resemblance, which is the argument for the SOP that produced this
  // change. Recorded so the zero is not read as "this file is clean".
  // (wirePaths' own entry left with the rest of spirit/test, Andy's
  // ruling below; the blind spot it found is this file's and stands.)

  // THE SERVER ITSELF: http.createServer, and fetchExternal, the gated
  // door apps ask for by verb rather than by URL.
  'js/server.js': 2,
  // THE RELAY'S OWN SERVER: http.createServer, moved out of server.js when
  // node and relay became separate startup modules (cycle 0). A new line,
  // and so an exception — GRANTED BY ANDY 2026-09-19 in the cycle 0 plan.
  // The reach is the one the relay always had; it now lives in its own file.
  'js/relayServer.js': 1,
  // THE APP SERVER'S, and it is the same reach for the same reason: the
  // THIRD startup module (cycle 2, G1) calling http.createServer once.
  //
  // RESTING ON "go 2" AND G1 RATHER THAN ON A SEPARATE GRANT, and said
  // so rather than assumed. Andy authorised the stage-1 build, whose
  // first requirement is a third startup module that serves one app —
  // and a server that cannot listen is not a server, so the one socket
  // is contained in what was authorised. If he reads this and disagrees,
  // it is one line and the reasoning is here rather than in a commit.
  // ZERO SINCE appPair/G1.4: faceServer listens through appServer.js, whose
  // line below is the one socket for every app server now.
  'js/faceServer.js': 0,
  // THE FACE'S ENTRY POINT ON THE VPS PUPPET NODE (public-app-server/G17,
  // slice 1): http.createServer once, on loopback, for Caddy. RESTING ON
  // ANDY'S "go." ON THAT SLICE, 2026-09-27, whose whole content is this
  // listener, and said so rather than assumed, as faceServer.js above. A
  // listener that cannot listen is not one. If he reads this and
  // disagrees, it is one line.
  'js/puppetPost.js': 1,
  // THE SERVER-SIDE REQUEST ROUTER (appPair/G1.2): http.createServer once,
  // on the pipe the node names. RESTING ON ANDY'S "go." ON G1.2, 2026-09-29,
  // whose whole content is that listener, and told him the same hour
  // ("say no if you want it done differently"), as faceServer.js above.
  // It netted to zero at appPair/G1.4: faceServer's own listener moved onto
  // this helper, and its line went to 0.
  'js/appServer.js': 1,

  // ── TESTS ARE NOT COUNTED ── ANDY'S RULING, 2026-10-02 ─────────────────
  //
  //   Andy: "tests are not subject to the same rules as production code."
  //   (goal/G1.3, when the fileCore red's fake node was asked for as a
  //   granted line.)
  //
  // So the walk no longer descends into spirit/test, and every granted
  // test entry left with it — forwardKey's, the labs', the worlds'. This
  // gate guards the production trees: a suite may stand up fake servers
  // and raw sockets to PROVE them, and needs nobody's grant to do it.

  // The agents program held a granted exception here (Andy, 2026-09-22:
  // "exception granted"), one reach. The app is gone, and its line with it
  // (goal/G3.2; Andy: "the agents APP is no longer permitted in this REPO").

  // ── THE GROK REVIEW PROGRAM — A GRANTED EXCEPTION ─────────────────────
  //
  //   Andy, 2026-09-22: "this is where the env-variable proxy-call in node
  //   should come in" — "may as well excercise that aspect of the SpiritOS"
  //
  // It looks like a third-party script — it reviews with Grok — but it
  // never calls Grok: it asks its OWN node's door (`net.fetch`), which
  // holds the key and fills it in for api.x.ai only. So it is a client of
  // the loopback door like agents.js, walked and counted, not skipped.
  // 2 since 2026-09-22: require('http') and its one call — Node's fetch cut
  // the script off from its own node at 300 s while Grok was still thinking.
  'process/js/grokReview/grokReview.js': 2,

  // ── THE WSL DESKTOP — A PLATFORM TOOL, THE SAME KIND OF EXCEPTION ────
  //
  //   Andy, 2026-09-22: "wsl may proceed with the desktop project" —
  //   relayed by the Windows Claude on the agent wire (post 64593916…),
  //   after the count below had been put to him.
  //
  // Not a node component: platform/ is tools for Andy's machines, and this
  // one talks to no node and no peer. But it serves a page, so it reaches
  // twice — require('http') for its own server, and the page's fetch back
  // to that same server — and every file is counted, so platform/ is
  // walked and it is counted here rather than living outside the tally.
  'platform/wsl/desktop/desktop.js': 2,
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
  // kernel.js is exempt (Andy, 2026-10-02: "we exempt kernel.js from the
  // oneDoor contract") — it IS the shared loopback client, see the tally.
  .filter(function (f) { return f.rel !== 'js/kernel.js'; })
  .concat(walk(path.join(SPIRIT, 'run', 'shell'), 'shell/', []))
  // spirit/test is not walked: tests are not subject to the same rules (Andy, 2026-10-02).
  // The folders of process/ that are walked: the granted exceptions above.
  .concat(walk(path.join(SPIRIT, 'run', 'process', 'js', 'grokReview'), 'process/js/grokReview/', []))
  // platform/ — tools for Andy's machines, beside spirit/ (platform/README.md).
  .concat(walk(path.join(SPIRIT, '..', 'platform'), 'platform/', []));

// ── 1. NOBODY OUTSIDE THE TALLY TOUCHES THE WIRE ──────────────────────
test.subHeading('A file not in the tally reaches for nothing');

{
  const strangers = [];
  files.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(TALLY, f.rel)) return;
    const n = reachesIn(f.full);
    if (n > 0) strangers.push(f.rel + ' (' + n + ')');
  });

  if (strangers.length === 0) {
    test.check(files.length + ' files scanned; everything outside the tally is clean');
  } else {
    test.fail('reaching past the interface: ' + strangers.join(', ') +
      ' — use peerPost, or decide to modify the interface. Do not add a line to the tally.');
  }
}

// ── 2. AND THE TALLY ONLY FALLS ───────────────────────────────────────
test.subHeading('Every counted file is at or below its number');

{
  const grown = [];
  const fell = [];
  const gone = [];
  Object.keys(TALLY).forEach(function (rel) {
    // Three roots: test/ is spirit/test, platform/ sits beside spirit/, and
    // every other entry is under spirit/run.
    const full = rel.indexOf('platform/') === 0 ? path.join(SPIRIT, '..', rel)
      : path.join(SPIRIT, rel.indexOf('test/') === 0 ? '' : 'run', rel);
    if (!fs.existsSync(full)) { gone.push(rel); return; }
    const n = reachesIn(full);
    if (n > TALLY[rel]) grown.push(rel + ': ' + TALLY[rel] + ' -> ' + n);
    if (n < TALLY[rel]) fell.push(rel + ': ' + TALLY[rel] + ' -> ' + n);
  });

  if (grown.length === 0) {
    const total = Object.keys(TALLY).reduce(function (n, k) { return n + TALLY[k]; }, 0);
    test.check('no file grew a reach — ' + total + ' across ' +
      Object.keys(TALLY).length + ' files, and that number may only fall');
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
    })).join(', ') + ' — lower it in TALLY');
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
  const contactBookUses = (peerPost.match(/contactBook\./g) || []).length;
  if (trafficInjected && contactBookUses <= 2) {
    test.check('traffic is injected and contactBook is inbound-only, so a relay may construct one');
  } else {
    test.fail('peerPost grew node-only coupling: traffic injected=' +
      trafficInjected + ', contactBook uses=' + contactBookUses);
  }

  // AND THE TRANSPORT IS REACHABLE BY BOTH. It sat inside hub.js until
  // 2026-09-16, which is why a relay had no way to obey the rule and the
  // shortcut was available to take.
  const wire = code('js/relayRequest.js');
  if (/function relayRequest/.test(wire) && !/contactBook|ownerBadge|peerStats/.test(wire)) {
    test.check('and relayRequest is its own module, with none of the node on it');
  } else {
    test.fail('the transport is back inside something');
  }

  // ── ONE SEALING SITE AND ONE OPENING SITE (cycle 10, R8 amended) ────
  //
  // wsl-claude, reviewing: counting CALL SITES is not enough — *"one
  // composing site does not catch a second SEALING function beside the
  // first, and two seal functions differing in one detail is how AAD gets
  // dropped on one path."*
  //
  // So this counts IMPLEMENTATIONS. Anything that derives a shared
  // secret, stretches it or drives the cipher belongs in seal.js and
  // nowhere else; a second one is how the associated data — which is the
  // whole difference between "this decrypts" and "this was sent to me by
  // them" — goes missing on one route while the suite stays green on the
  // other.
  //
  // A test may not implement one either. A suite that seals by hand is a
  // suite asserting its own construction rather than the one that ships.
  {
    const PRIMITIVES = /createCipheriv|createDecipheriv|diffieHellman|hkdfSync/;
    const owners = [];
    ['js', 'shell', 'process'].forEach(function (rel) {
      walk(path.join(SPIRIT, 'run', rel), rel + '/', []).forEach(function (f) {
        if (PRIMITIVES.test(fs.readFileSync(f.full, 'utf8'))) owners.push(f.rel);
      });
    });
    if (owners.length === 1 && owners[0] === 'js/seal.js') {
      test.check('the sealing primitives exist in exactly one file — seal.js, and nothing beside it');
    } else {
      test.fail('sealing is implemented in ' + owners.length + ' places: ' + owners.join(', '));
    }
  }
}

// ── 4. AN INTERFACE IS OPAQUE, OR IT IS NOT AN INTERFACE ───────────────
//
//   Andy: "this whole enforcement rule must include calling inside-the
//   interface helpers. that is the whole point of interfaces. they must be
//   opaque. their internal mechanics shouldn't even be reachable."
//
// The reach that a `fetch` tally cannot see. I gave peerSearch and
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
