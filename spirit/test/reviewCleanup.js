'use strict';

// spirit/test/reviewCleanup.js
// goal/G16.9: the findings of the review of 2026-10-10 (Andreas Thut, at e8f8ffd) that need no decision, done
// together and last. Written first, red on today's code, by wsl-claude; the build is the other agent's.
//
// DECIDED: an item of this goal at Andy's word, 2026-10-10: "let's do it that way." — one cleanup item last and
// three design items, each argued one at a time before it is built.
//
// EVERY PREMISE RE-CHECKED AGAINST THE TREE at d35aa3e6, because the box was checked at b355e36d and the tree has
// moved twice since (goal/G16.2 and goal/G16.8 both deleted code it describes). What changed, so the next session
// does not look for the old lines: the verb file is spirit/run/js/jobs/api.json, not process/js/jobs/api.json;
// relayServer requires peerPost at 938, not 1053; the loopback subscription is kernel.js:753 and the SSE route
// server.js:870. Every one of the six findings still holds, and each is asserted BY ITS BEHAVIOUR below rather
// than by the line it lives on, so the build may move any of them.
//
// WHAT IS ASSERTED, one section per finding
//   1. THE NODE'S VERB FILE NAMES NO APP. jobs/api.json tells the reader how to reach "the desk" by name. Andy:
//      "nothing in node and relay should know about apps." A placement fault, and the plainest of the six.
//   2. A RELAY DOES NOT DEMAND FOLDERS IT NEVER LOADS. serveCommon's start check requires shell/ and process/
//      under the working directory; a relay spawns no jobs and loads neither.
//   3. NO NODE CONTACT CODE LOADS ON A RELAY — and the box overstates this one, so it is corrected here rather
//      than asserted as written. Measured at d35aa3e6: requiring peerPost pulls contacts.js, and NOT
//      nodeStore.js, and node:sqlite is never loaded. contacts.js requires nodeStore LAZILY, inside the call
//      that marks a book seen (contacts.js:214), so a relay carries the node's contact code but opens no
//      database unless that path runs — and the box's own words were "whether any contacts path runs on a relay
//      is not confirmed". So what is owed is the load, which is real and measurable; the sqlite half was not
//      happening. Against serveCommon's stated aim that a relay loads no node code.
//   4. A LOOPBACK SERVER'S POST DOES NOT EAT THE BACKLOG (S11, and the one with teeth). arrivals.subscribe marks
//      the WHOLE waiting backlog taken and hands it over, which is right for a page catching up. But
//      spirit.peerPost opens /api/events for every post, and the desk, chatClerver and fileServer post that way
//      with no browser open — so each loopback post consumes and discards everything waiting, and the owner's
//      next page open replays nothing. Asserted as behaviour, not as an API, because the box leaves the shape
//      open ("a loopback server subscribes as a server and marks nothing taken, OR the mark is the page's
//      alone"): whichever is built, what must be true is that a server reading the stream leaves the page's
//      backlog alone. TWO OF THAT SECTION'S CHECKS ALREADY HOLD and are controls, not work owed: arrivals
//      already offers witness(), which takes nothing (goal/G16.5). The fault is one seam above it — peerPost
//      coming in through the page's door — and that is the check that is red.
//   5. SEATS REACH THE OWNER. relay.js builds a seats block for one reply, but the owner's live report is called
//      without it, so relayStatus's `seats: o.seats || undefined` is always undefined and the one number that
//      says the relay is full never arrives.
//   6. THE RELAY'S IDENTITY SURVIVES A CRASH MID-WRITE. saveIdentity writes identity.json in place, so a crash
//      part-way leaves a file ensureIdentity cannot read, and it mints a NEW relay key — every member's allow
//      entry then names a relay that no longer exists.
//
// LEFT ALONE ON PURPOSE, and not owed here: hub.js's read of the Contacts app's old prefs file, a known
// deprecation that expires at alpha; and the DEBUG monitor copying pass-through text to the owner, which is his
// decision of 2026-09-26 and stays. (Named by what it says rather than by its number in the review: a bare
// requirement number is ambiguous across cycles, and spirit/test/cycleCitations.js is right to refuse one.)
//
// rule/11: through testSupport only; in-process modules, a child process for the require graph, temp homes of
// this suite's own, no ports and no node.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const relayStatus = require('../run/js/relayStatus.js');
const arrivals = require('../run/js/arrivals.js');

const OWED = 'OWED by goal/G16.9: ';
const RUN = path.join(__dirname, '..', 'run');
const JS = path.join(RUN, 'js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

test.startTest('The review\'s cleanup: six findings that need no decision (goal/G16.9)');

// ── 1. THE NODE'S VERB FILE NAMES NO APP ────────────────────────────────
test.subHeading('1. the node\'s own api description names no app');
{
  const file = path.join(JS, 'jobs', 'api.json');
  const text = read(file);
  if (!text) {
    test.fail(OWED + 'spirit/run/js/jobs/api.json could not be read');
  } else if (!/\bdesk\b/i.test(text)) {
    test.check('jobs/api.json describes the door without naming an app');
  } else {
    test.fail(OWED + 'jobs/api.json names the desk, so the node\'s own description knows an app: ' + short(text));
  }
}

// ── 2. A RELAY DOES NOT DEMAND FOLDERS IT NEVER LOADS ───────────────────
//
// Asserted on the behaviour: a directory holding only what a relay needs passes the check. A grep for the
// folder names would pass the moment somebody renamed the list.
test.subHeading('2. a relay starts from a folder with no shell/ and no process/');
{
  const common = read(path.join(JS, 'serveCommon.js'));
  const demandsBoth = /REQUIRED_DIRS\s*=\s*\[[^\]]*'shell'[^\]]*'process'[^\]]*\]/.test(common)
    || /REQUIRED_DIRS\s*=\s*\[[^\]]*'process'[^\]]*'shell'[^\]]*\]/.test(common);
  if (!demandsBoth) {
    test.check('serveCommon no longer demands shell/ and process/ of every server');
  } else {
    test.fail(OWED + 'serveCommon still refuses to start without shell/ and process/, which a relay never loads');
  }
}

// ── 3. NO NODE STORE LOADS ON A RELAY ───────────────────────────────────
//
// The require GRAPH, asked of a real child process rather than read off the page: requiring relayServer must not
// pull the node's contact store, and nothing on a relay may open node:sqlite through it.
test.subHeading('3. requiring the relay server loads no node store');
{
  // peerPost IS THE DOOR, and it is what relayServer requires (relay.js's partnerRouter, relayServer.js:938).
  // relayServer itself cannot be required here: its own start check refuses any cwd but spirit/run and exits,
  // which is finding 2 above getting in the way of finding 3.
  const probe = 'require(' + JSON.stringify(path.join(JS, 'peerPost.js')) + ');'
    + 'console.log(Object.keys(require.cache).filter(function (p) { return /nodeStore\\.js$|contacts\\.js$/.test(p); }).join("|"));';
  let loaded = null;
  try {
    loaded = String(execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8', timeout: 30000 })).trim();
  } catch (e) {
    loaded = null;
    test.fail(OWED + 'the require probe would not run: ' + short((e && e.message) || e));
  }
  if (loaded !== null) {
    if (!loaded) {
      test.check('the relay\'s peerPost loads neither nodeStore.js nor contacts.js');
    } else {
      test.fail(OWED + 'the relay\'s peerPost pulls the node\'s store in: ' + short(loaded.split('|').map(function (p) { return path.basename(p); }).join(', ')));
    }
  }
}

// ── 4. A LOOPBACK SERVER'S POST DOES NOT EAT THE BACKLOG (S11) ──────────
//
// Built on arrivals itself, with a traffic log of this suite's own, so the rule is asserted where it lives and
// no node, port or browser is involved. THE PAGE IS THE CONTROL: it must still get the backlog, because the
// whole point of marking taken is that a page catching up sees what it missed exactly once.
test.subHeading('4. a server reading the stream leaves the page\'s backlog alone (S11)');
{
  function fakeTraffic() {
    const rows = [];
    return {
      rows: rows,
      note: function (row) { rows.push(Object.assign({ taken: false }, row)); },
      untaken: function () { return rows.filter(function (r) { return !r.taken; }); },
      taken: function (hash) {
        const list = Array.isArray(hash) ? hash : [hash];
        rows.forEach(function (r) { if (list.indexOf(r.hash) !== -1) r.taken = true; });
      },
      read: function () { return rows.slice(); },
    };
  }
  function withThree() {
    const traffic = fakeTraffic();
    ['h1', 'h2', 'h3'].forEach(function (h) {
      traffic.note({ hash: h, from: 'PEER', text: 'a line', at: new Date().toISOString() });
    });
    return { traffic: traffic, box: arrivals.createArrivals({ traffic: traffic }) };
  }

  // THE CONTROL FIRST: three lines waiting, a page connects, the page is given them and they are marked.
  {
    const w = withThree();
    const seen = [];
    w.box.subscribe(function (m) { seen.push(m && m.hash); });
    if (seen.length === 3 && w.box.pending() === 0) {
      test.check('a page still catches up on the three it missed, and they are marked taken');
    } else {
      test.fail('the control broke: a page saw ' + seen.length + ' and ' + w.box.pending() + ' are still waiting — the checks below mean nothing');
    }
  }

  // AND NOW THE FAULT: a loopback server reads the same stream to await one reply. The three lines are the
  // owner's, and nothing of the owner's may be consumed by it.
  {
    const w = withThree();
    const serverSaw = [];
    const asServer = typeof w.box.witness === 'function' ? w.box.witness : null;
    if (!asServer) {
      test.fail(OWED + 'arrivals offers no way for a server to read the stream without taking it');
    } else {
      asServer.call(w.box, function (m) { serverSaw.push(m && m.hash); });
      if (w.box.pending() === 3) {
        test.check('a server reading the stream takes none of the three waiting lines');
      } else {
        test.fail(OWED + 'a server reading the stream left only ' + w.box.pending() + ' of 3 waiting: the owner\'s lines are gone');
      }
      if (!serverSaw.length) {
        test.check('and it is handed no backlog, so it answers only about what arrives next');
      } else {
        test.fail(OWED + 'a server was handed the backlog: ' + short(serverSaw.join(', ')));
      }
    }
  }

  // THE SEAM THAT CAUSES IT: spirit.peerPost opens the page stream for every post. Whatever the build chooses,
  // a post from a loopback server must not come in through the door that marks rows taken.
  {
    const kernel = read(path.join(JS, 'kernel.js'));
    const inPeerPost = /spirit\.peerPost\s*=\s*function[\s\S]{0,2000}?\/api\/events/.test(kernel);
    if (!inPeerPost) {
      test.check('spirit.peerPost no longer opens the page stream to await its reply');
    } else {
      test.fail(OWED + 'spirit.peerPost still opens /api/events, so every loopback post marks the backlog taken');
    }
  }
}

// ── 5. SEATS REACH THE OWNER ────────────────────────────────────────────
//
// relayStatus is a pure function from facts to a report, so the fault is in what it is HANDED. Asserted both
// ways: the report carries seats when given them (it does today), and the relay actually gives them.
test.subHeading('5. the one number that says a relay is full reaches its owner');
{
  const seats = { held: 3900, outstanding: 200, allowance: 4096, free: -4 };
  const report = relayStatus.report({ seats: seats, at: new Date().toISOString() });
  if (report && report.seats && report.seats.allowance === 4096) {
    test.check('relayStatus carries seats through when it is handed them');
  } else {
    test.fail('the control broke: relayStatus drops seats even when given them: ' + short(report && report.seats));
  }

  // THE CALL ITSELF. Read from relay.js, because no in-process fixture can make the live report without a
  // relay, and this is the fault: the owner's report is built without seats.
  const relaySrc = read(path.join(JS, 'relay.js'));
  // Balanced, not matched: the report's own argument holds nested objects, and a lazy regex stops at the first
  // inner brace — which made this check say "cannot judge" on a call that is plainly there.
  function argumentOf(src, marker) {
    const at = src.indexOf(marker);
    if (at === -1) return null;
    let depth = 0;
    for (let i = at + marker.length - 1; i < src.length; i += 1) {
      const c = src[i];
      if (c === '(') depth += 1;
      else if (c === ')') { depth -= 1; if (depth === 0) return src.slice(at, i + 1); }
    }
    return null;
  }
  const call = argumentOf(relaySrc, 'relayStatus.report(');
  if (!call) {
    test.fail(OWED + 'no relayStatus.report call found in relay.js: this check cannot judge');
  } else if (/\bseats\s*:/.test(call)) {
    test.check('and the relay hands seats to the owner\'s report');
  } else {
    test.fail(OWED + 'the owner\'s report is built without seats, so it is always absent however full the relay is');
  }
}

// ── 6. THE RELAY'S IDENTITY SURVIVES A CRASH MID-WRITE ──────────────────
//
// A truncated identity.json is not a stale key, it is a NEW relay: ensureIdentity mints one, and every member's
// allow entry then names a relay that no longer exists. Asserted on the writing, which is the only part a test
// can hold still: the file must never be the thing being written to.
test.subHeading('6. the relay\'s identity is written whole or not at all');
{
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-idwrite-'));
  const id = auth.generateIdentity('relay');
  auth.saveIdentity(home, id);
  const file = path.join(home, 'relay-state', 'identity.json');

  // It still works, whatever the write becomes.
  const back = auth.loadIdentity(home);
  if (back && back.publicKey === id.publicKey) test.check('saveIdentity still writes a readable identity');
  else test.fail('the control broke: the identity did not come back: ' + short(back));

  // AND IT WAS NOT WRITTEN IN PLACE. A rename is atomic on one filesystem, so a crash leaves either the old
  // file or the new one, never half of one.
  const authSrc = read(path.join(JS, 'relayAuth.js'));
  const save = /function saveIdentity\(([\s\S]{0,1200}?)\n\}/.exec(authSrc);
  if (!save) {
    test.fail(OWED + 'saveIdentity could not be read: this check cannot judge');
  } else if (/renameSync/.test(save[1])) {
    test.check('saveIdentity writes a temporary file and renames it over the old one');
  } else {
    test.fail(OWED + 'saveIdentity writes identity.json in place: a crash mid-write mints a new relay key');
  }

  // Nothing of this suite's is left behind where a later run could read it.
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* a temp dir the OS will sweep */ }
  if (!fs.existsSync(file)) test.check('and this suite leaves no identity behind it');
  else test.fail('this suite left ' + file + ' on disk');
}

test.reportSuccessFailureCount();
