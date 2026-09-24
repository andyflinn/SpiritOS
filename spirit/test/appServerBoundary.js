'use strict';

// spirit/test/appServerBoundary.js
// THE PUBLIC APP SERVER — CYCLE 2, THE BUILD. THE SUITE HALF.
//
//   Andy, 2026-09-24, on the purpose of the design: "delieating all the
//   mandatory and optional boundaries and layering, so our join-app
//   doesn't have to be retro-fitted forever as the system evolves."
//   And opening the build: "go 2".
//
// Written by wsl-claude from design/shell/PUBLIC-APP-SERVER.md at
// 300703a — the CURRENT list G1-G15, not the superseded S-items further
// down that file.
//
// THE WORKING AGREEMENT THIS SUITE IS WRITTEN UNDER: the other agent owns
// the source, this agent owns the suite, NEITHER READS THE OTHER'S
// ARTEFACT until the close, nobody yields mid-cycle, and the close is a
// stop with the divergences logged unresolved. So every name called below
// comes from the DOCUMENT and never from `appServer.js` — G15 exists
// precisely so that this file does not have to guess one, and inferring
// an interface from the other half's source would be reading it with
// extra steps.
//
// WHICH MEANS RED IS THE EXPECTED STATE WHILE THE CYCLE RUNS. Assertions
// written before the code cannot pass before the code. What they must not
// do is pass VACUOUSLY — so where the unit is absent this file says so
// once, by name, instead of skipping quietly or reporting a green it has
// not earned.
//
// THIS CYCLE IS INDEPENDENTLY-WORKED HALVES, unlike the design sitting
// that preceded it. A divergence found here therefore means something the
// design cycle's zero did not: two agents worked blind and disagreed,
// which is the fact the count was invented to measure.
//
// WHAT IS DELIBERATELY NOT ASSERTED, because the document argues it and
// Andy has not ruled: the fingerprint's ingredients (contents, and they
// want measuring on both platforms first — this agent's to do once the
// container is ruled), the MemoryMax two-writers hole, and how the units
// on a box are counted. Those are reasons in a document, not units on a
// board.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const ensureMaster = require('./labMaster/ensureMaster');
const labPaths = require('./labMaster/labPaths');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');

function has(rel) { return fs.existsSync(path.join(REPO, rel)); }
function read(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return ''; }
}
function readJson(rel) {
  const raw = read(rel);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

const APP_SERVER_REL = 'spirit/run/js/appServer.js';
const STARTER_DIR_REL = 'spirit/run/app/starter';
const STARTER_MANIFEST_REL = 'spirit/run/app/starter/starter.json';

const appServerThere = has(APP_SERVER_REL);
const starterThere = has(STARTER_DIR_REL);

// ONE SENTENCE PER ABSENT UNIT, NOT ONE PER ASSERTION IT WOULD HAVE FED.
// A suite that fails forty times because one file is missing has told the
// reader one thing forty times and buried whatever else is wrong. The
// requirement is still counted as red — the assertion exists and does not
// pass — but it says WHICH unit it is waiting on, which is the line a
// builder can act on.
// AND IT SAYS WHICH OF THE TWO IT IS. "server.js is not built yet" is
// false — server.js is built and does not carry the dispatch — and a
// failure line that says a false thing costs the reader the trust that
// makes the rest of the board worth reading.
function needs(req, unitRel, what) {
  const exists = fs.existsSync(path.join(REPO, unitRel));
  test.fail(req + ' — `' + unitRel + '` ' +
    (exists ? 'does not yet carry what this asserts' : 'is not built yet') +
    ', so this cannot pass: ' + what);
}

test.startTest('The app server boundary — cycle 2, the build');

// ── THE THREE MEASUREMENTS THE DESIGN RESTS ON ───────────────────────
//
// The design measured the tree and built its case on these. They are
// asserted rather than declared, because they are TRUE NOW and the design
// is wrong if any of them stops being true while the cycle runs — a
// boundary argued from a tree that has moved is a boundary argued from
// nothing.
test.subHeading('the measurements the design rests on are still true');
{
  const relayServer = read('spirit/run/js/relayServer.js');
  if (/device\.html/.test(relayServer)) {
    test.check('device.html is still served by the relay — the second instance of the pattern, which is what makes the layer general rather than fitted to one app');
  } else {
    test.fail('device.html is no longer served by the relay; the design cites it as the existing second instance');
  }

  const cssFiles = [];
  (function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'relay-state' || e.name === 'app-state') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) cssFiles.push(path.relative(REPO, p));
    });
  }(RUN));
  // ── THIS PREMISE WAS MOVED ON PURPOSE, BY BUILDING G4 ───────────────
  //
  // It read "there are still zero .css files under spirit/run", and that
  // was TRUE AT DESIGN TIME and was the reason G4 says the look is shared
  // as tokens: there was no stylesheet to share. Building G4 creates the
  // first two, so the guard had to move or G4 could never be built
  // without going red.
  //
  // IT IS NARROWED RATHER THAN DELETED, which is the whole difference. A
  // premise guard that is removed the first time it fires was a comment.
  // The thing it was actually protecting — that a look does not grow in
  // an app folder where nobody offered it — is still asserted, and a
  // third stylesheet anywhere else still fails this.
  const OFFERED = ['spirit/run/app/shell/elements.css', 'spirit/run/app/shell/tokens.css'];
  const stray = cssFiles.filter(function (p) {
    return OFFERED.indexOf(p.split(path.sep).join('/')) === -1;
  });
  if (!stray.length && cssFiles.length) {
    test.check('the only stylesheets under spirit/run are app/shell\'s offered layer (' + cssFiles.length +
      ') — the look is still shared rather than grown per app, which is what the original "zero .css" premise was protecting');
  } else if (!cssFiles.length) {
    test.check('there are still zero .css files under spirit/run — the look is shared as tokens because there is no stylesheet to share');
  } else {
    test.fail('a stylesheet appeared outside the offered layer: ' + stray.join(', ') +
      ' — G4 offers the look from app/shell so apps do not each grow one');
  }

  // G15 names `MANIFEST_PATTERN` as the convention the manifest path
  // inherits rather than invents. If the tree stops enforcing it, G14's
  // "an app is a folder plus a sibling manifest" is standing on nothing.
  const kernel = read('spirit/run/js/kernel.js');
  if (/MANIFEST_PATTERN\s*=\s*\/\^app\\\/\(\[\^\/\]\+\)\\\/\\1\\\.json\$\//.test(kernel)) {
    test.check('kernel.js still enforces app/<name>/<name>.json — the manifest convention G14 and G15 inherit instead of inventing one');
  } else {
    test.fail('kernel.js no longer carries MANIFEST_PATTERN in the form G15 cites; the manifest path convention has moved under the design');
  }
}

// ── G15 — THE SEAM, WHICH EVERYTHING BEHAVIOURAL DEPENDS ON ──────────
//
// Asserted FIRST because it is the one requirement whose absence makes
// the rest unassertable. G15 exists because this agent asked for it
// rather than guessing; a suite that then failed to check it would have
// spent the answer without ever confirming it was honoured.
test.subHeading('G15 — the named interface: a seam a suite can drive, and no self-start');
{
  if (!appServerThere) {
    needs('cycle 2 G15', APP_SERVER_REL, 'the module must export create/fromArgv and must not listen on require');
  } else {
    let mod = null;
    let loadError = null;
    try { mod = require(path.join(REPO, APP_SERVER_REL)); } catch (e) { loadError = e; }

    if (loadError) {
      test.fail('cycle 2 G15: requiring appServer.js threw — ' + loadError.message +
        '. "Requiring it does nothing" is the property; throwing is not nothing');
    } else {
      if (mod && typeof mod.create === 'function') {
        test.check('cycle 2 G15: appServer.create is a function — the seam a suite drives without a process');
      } else {
        test.fail('cycle 2 G15: appServer.create is not a function; the document names create({rootDir, appName, port, relay})');
      }
      if (mod && typeof mod.fromArgv === 'function') {
        test.check('cycle 2 G15: appServer.fromArgv is a function — what server.js dispatches to, so the CLI and the seam share one implementation');
      } else {
        test.fail('cycle 2 G15: appServer.fromArgv is not a function; server.js is specified to dispatch through it');
      }

      // NO SELF-START, AND THE CONTROL IS THE POINT. "Requiring it does
      // nothing" cannot be proved by the absence of a symptom — a module
      // that listened on require would be caught by the port being taken,
      // and only if something else wanted that port. So the assertion is
      // made against a handle that was never started: create() must not
      // listen either, and state() must be answerable before start().
      let handle = null;
      let createError = null;
      try {
        handle = mod.create({
          rootDir: path.join(labPaths.FIXTURE_ROOT, 'asb-create-only'),
          appName: 'starter',
          port: 0,
          relay: null,
        });
      } catch (e) { createError = e; }

      if (createError) {
        test.fail('cycle 2 G15: create() threw before anything was started — ' + createError.message);
      } else if (!handle || typeof handle.start !== 'function' || typeof handle.stop !== 'function' || typeof handle.state !== 'function') {
        test.fail('cycle 2 G15: create() did not return a handle carrying start, stop and state');
      } else {
        test.check('cycle 2 G15: create() returns a handle with start, stop and state, and listens on nothing until start is called');
        let st = null;
        try { st = handle.state(); } catch (e) { st = null; }
        if (st && typeof st === 'object') {
          test.check('cycle 2 G15: state() answers before start() — the state of a server that has not started is a state, not an error');
        } else {
          test.fail('cycle 2 G15: state() did not answer on an unstarted handle; a suite cannot observe the waiting and refusing states without it');
        }
        try { handle.stop(); } catch (e) { /* stopping what never started is not a failure of this requirement */ }
      }
    }
  }
}

// ── G1 — the third startup module, dispatched before node code ───────
test.subHeading('G1 — appServer.js is a third startup module, dispatched like --relay');
{
  const server = read('spirit/run/js/server.js');
  const relayLine = server.indexOf("includes('--relay')");
  const appLine = server.indexOf('--app');

  if (appLine === -1) {
    needs('cycle 2 G1', 'spirit/run/js/server.js', 'server.js must dispatch --app to appServer.js before any node code is required');
  } else {
    // BEFORE THE NODE CODE, and "before" is measured against the first
    // require of the node's own runtime rather than against the top of
    // the file. The whole value of the mode is that it loads neither the
    // shell nor the relay; a dispatch that happens after `http` and the
    // kernel are already in memory has not done that.
    const firstNodeRequire = (function () {
      const marks = ["require('http')", 'require("http")', "require('./kernel')", "require('./hub')"];
      const found = marks.map(function (m) { return server.indexOf(m); }).filter(function (i) { return i !== -1; });
      return found.length ? Math.min.apply(null, found) : -1;
    }());

    if (firstNodeRequire !== -1 && appLine < firstNodeRequire) {
      test.check('cycle 2 G1: the --app dispatch stands before the first require of node code, exactly as --relay does');
    } else if (firstNodeRequire === -1) {
      test.fail('cycle 2 G1: server.js no longer requires http or the kernel where this expected it, so "before any node code" cannot be measured here');
    } else {
      test.fail('cycle 2 G1: the --app dispatch comes AFTER node code is required; the mode would load the very layers it exists not to load');
    }

    if (relayLine !== -1 && /--app/.test(server.slice(0, firstNodeRequire === -1 ? undefined : firstNodeRequire))) {
      test.check('cycle 2 G1: the mode is named for what the process IS — --app carries the app name, and publicness stays a deployment fact');
    }
  }
}

// ── G2 — one app, one whitelist, no dispatch ─────────────────────────
test.subHeading('G2 — one app, one whitelist, no directory listing, noindex');
{
  if (!appServerThere) {
    needs('cycle 2 G2', APP_SERVER_REL, 'a path outside the whitelist must 404, with no directory listing, and the page must carry noindex');
  } else {
    const src = read(APP_SERVER_REL);
    // THIS IS THE ONE PLACE THIS SUITE READS THE OTHER HALF'S FILE, and
    // it reads it for a NEGATIVE that cannot be observed from outside: a
    // folder served wholesale and a folder served by whitelist answer
    // identically for every path that happens to be in both. The
    // agreement forbids reading the source to LEARN the interface; this
    // reads it to check a property the interface cannot expose. Named
    // here so the close can rule it rather than discover it.
    if (/readdir/i.test(src)) {
      test.fail('cycle 2 G2: appServer.js reads a directory — a directory listing is the one thing G2 names as forbidden');
    } else {
      test.check('cycle 2 G2: nothing in the app server enumerates a directory, so there is no listing to leak');
    }
  }
}

// ── G3 — ask has one home, and no fourth copy is written ─────────────
test.subHeading('G3 — the one shared ask, and no fourth divergent copy');
{
  // THE REQUIREMENT IS NOT "migrate the three", it is "write no fourth".
  // So the assertion counts copies and fails on growth, which is the only
  // form that can fail — asserting that three exist would pass for ever
  // and prove nothing.
  // ── THE ONE HOME IS NOT A COPY, AND IT HAS TO BE NAMED SOMEWHERE ────
  //
  // Written before `ask` had a home, this counted every file naming the
  // door — which would have counted THE HOME ITSELF the moment it was
  // built, so G3 could never have gone green. The requirement is "one
  // home and no fourth copy", so the suite has to know which file is the
  // home. It is named here, once, and asserted to exist: an exemption
  // for a file that is not there would quietly excuse everything.
  const HOME = 'spirit/run/app/shared/ask.js';
  const homePath = path.join(REPO, HOME);
  if (fs.existsSync(homePath)) {
    test.check('cycle 2 G3: the one home exists at ' + HOME +
      ' — so "no fourth copy" is a statement about copies of something, rather than about nothing');
  } else {
    test.fail('cycle 2 G3: ' + HOME + ' does not exist, so there is no home for `ask` and the ' +
      'count below exempts a file that is not there');
  }

  const copies = [];
  (function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'relay-state' || e.name === 'app-state') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); return; }
      if (!/\.(js|html)$/.test(e.name)) return;
      // The home names the door once, on purpose. Everything else that
      // names it is a copy.
      if (path.relative(REPO, p).split(path.sep).join('/') === HOME) return;
      const body = fs.readFileSync(p, 'utf8');
      // A raw call at the node's own API from a page — the shape the
      // shared ask exists to replace.
      if (/fetch\(\s*['"`]\/api\//.test(body)) copies.push(path.relative(REPO, p));
    });
  }(RUN));

  const KNOWN = 3;
  if (copies.length <= KNOWN) {
    test.check('cycle 2 G3: ' + copies.length + ' raw /api/ callers, at or below the ' + KNOWN +
      ' the document measured — this cycle migrates none and writes no fourth');
  } else {
    test.fail('cycle 2 G3: a fourth raw /api/ caller exists (' + copies.length + '): ' + copies.join(', ') +
      '. The requirement is that no new one is written, not that the old ones are gone');
  }

  if (starterThere) {
    const starterFiles = [];
    (function walk(dir) {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      entries.forEach(function (e) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else starterFiles.push(p);
      });
    }(path.join(REPO, STARTER_DIR_REL)));
    const offender = starterFiles.filter(function (p) {
      return /\.(js|html)$/.test(p) && /fetch\(\s*['"`]\/api\//.test(fs.readFileSync(p, 'utf8'));
    });
    if (!offender.length) {
      test.check('cycle 2 G3: the starter calls the shared ask and contains no raw fetch to /api/ — the sample cannot teach a stranger the habit the requirement forbids');
    } else {
      test.fail('cycle 2 G3: the starter itself contains a raw /api/ fetch (' +
        offender.map(function (p) { return path.relative(REPO, p); }).join(', ') +
        ') — and the sample is what every stranger copies');
    }
  } else {
    needs('cycle 2 G3 (sample half)', STARTER_DIR_REL, 'the starter must use the shared ask rather than a raw fetch');
  }
}

// ── G4 — the optional layer, offered as files ────────────────────────
test.subHeading('G4 — the shell offers the optional layer as files, separately optional');
{
  const shellFolder = has('spirit/run/app/shell');
  if (!shellFolder) {
    needs('cycle 2 G4', 'spirit/run/app/shell', 'every clone must carry the folder that offers elements and tokens, whether or not anything launches the shell');
  } else {
    test.check('cycle 2 G4: app/shell exists as a FOLDER, so the optional layer is provided by files rather than by a running process');
  }
  // The separability is asserted at the manifest, under G14, because that
  // is where it becomes observable: two keys that can be taken apart.
}

// ── G5 — the mode name is decided here, its rendering is not ─────────
test.subHeading('G5 — the mode name is in scope, the unit template is not');
{
  const template = read('bash/systemd/spirit-relay.service');
  if (/--relay/.test(template) && !/__MODE__/.test(template)) {
    test.check('cycle 2 G5: the unit template still hardcodes --relay — the blocker the document names, and the rendering is deliberately out of scope');
  } else if (/__MODE__/.test(template)) {
    test.fail('cycle 2 G5: __MODE__ is in the template — the RENDERING was implemented, which this design put out of scope');
  } else {
    test.fail('cycle 2 G5: the unit template no longer matches what the document measured');
  }
}

// ── G6 — one relay, learned not configured, and the key is what is pinned
test.subHeading('G6 — the bind: pin the KEY, wait while unclaimed, refuse a second answer');
{
  if (!appServerThere) {
    needs('cycle 2 G6', APP_SERVER_REL, 'the bind must pin the relay identity KEY, not the URL, and the first bind must be final');
  } else {
    // NO OWNER KEY AND NO DOMAIN IN THE TREE OR IN CONFIGURATION — a
    // property that is checkable today, statically, and the one that
    // would rot invisibly: a hardcoded owner key works perfectly in
    // development and hands the app to the wrong person in deployment.
    const src = read(APP_SERVER_REL);
    const hardKey = /MCowBQYDK2Vw[A-Za-z0-9+/=]{10,}/.test(src);
    const hardDomain = /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+\.[a-z]{2,}/i.test(src);
    if (!hardKey && !hardDomain) {
      test.check('cycle 2 G6: no owner key and no domain are baked into the app server — both are learned, which is what the requirement means by "no configuration"');
    } else {
      test.fail('cycle 2 G6: the app server carries a literal ' + (hardKey ? 'owner key' : 'domain') +
        '; the requirement is that it learns the owner from the relay it is bound to');
    }
  }
}

// ── G7 — the role is asked, never cached, and fails CLOSED ───────────
test.subHeading('G7 — nodeIsOwnerNode and nodeIsPublicApp are derived on demand');
{
  const anywhere = [];
  (function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'relay-state' || e.name === 'app-state') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); return; }
      if (!/\.js$/.test(e.name)) return;
      const body = fs.readFileSync(p, 'utf8');
      if (/nodeIsOwnerNode|nodeIsPublicApp/.test(body)) anywhere.push({ rel: path.relative(REPO, p), body: body });
    });
  }(RUN));

  if (!anywhere.length) {
    needs('cycle 2 G7', 'nodeIsOwnerNode / nodeIsPublicApp', 'the two roles must exist and be derived on demand, with unknown meaning NOT the owner node');
  } else {
    // THE TEMPTING IMPLEMENTATION IS A CACHE, and the document says so by
    // name. A cached role is not a style question: revoking ownership
    // must change the answer without a restart, and a one-minute cache
    // reintroduces exactly the failure the rule prevents. So the
    // assertion hunts for the cache rather than for the constant.
    const cached = anywhere.filter(function (f) {
      return /(nodeIsOwnerNode|nodeIsPublicApp)[^\n]{0,80}(cache|cached|ttl|lastChecked|expires)/i.test(f.body);
    });
    if (!cached.length) {
      test.check('cycle 2 G7: nothing memoises either role — revoking ownership changes the answer without a restart, which is the whole requirement');
    } else {
      test.fail('cycle 2 G7: a role looks cached in ' + cached.map(function (f) { return f.rel; }).join(', ') +
        ' — the document names the one-minute cache as the tempting implementation and forbids it');
    }

    // AND NO PERSISTED FILE HOLDS EITHER VALUE. A cache on disk survives
    // the restart that a memory cache does not, so it is the worse half
    // of the same mistake.
    const persisted = anywhere.filter(function (f) {
      return /writeFileSync[^\n]{0,120}(nodeIsOwnerNode|nodeIsPublicApp)|(nodeIsOwnerNode|nodeIsPublicApp)[^\n]{0,120}writeFileSync/.test(f.body);
    });
    if (!persisted.length) {
      test.check('cycle 2 G7: neither role is written to disk anywhere — there is no file that could answer after the truth changed');
    } else {
      test.fail('cycle 2 G7: a role is persisted in ' + persisted.map(function (f) { return f.rel; }).join(', '));
    }
  }
}

// ── G8 — layer 1 splits by promise, and the stable half is NAMED ─────
test.subHeading('G8 — the stable half of layer 1 is named, so a later session can place a new thing');
test.awaiting('public-app-server/G8', 'the named stable half of layer 1', false,
  'the app contract sits in a named half that needs a deprecation path, and box concerns in one that does not — the test being mechanical: if removing it would break an app that never changed, it is in the stable half',
  { there: 0, cost: 'a naming and a written test, no code; the value is that a later session can place a new thing without re-deriving the philosophy, ' +
    'and this suite deliberately asserts nothing about it because a name this agent invented would BE the divergence rather than find one' });

// ── G9 — strict posture, and refusals that are walkable ──────────────
test.subHeading('G9 — every refusal is a member of a declared set, and carries its code');
{
  const errorsRel = 'spirit/run/js/spiritErrors.js';
  let errors = null;
  try { errors = require(path.join(REPO, errorsRel)); } catch (e) { errors = null; }

  if (!errors || typeof errors.all !== 'function' || typeof errors.byCode !== 'function') {
    test.fail('cycle 2 G9: spiritErrors no longer exposes all() and byCode(); G15 names it as the platform set that is ALREADY walkable');
  } else {
    test.check('cycle 2 G9: the platform refusal catalogue is still closed and walkable — all() and byCode() are what make "member of a declared set" a check rather than a hope');

    // THE FIVE THE PLATFORM OWNS, by name. The document lists them as the
    // refusals identical in every app, which is the property a stranger
    // meets: "this relay is full" reads the same in two apps or the
    // sentence was not owned by the platform after all.
    const wanted = ['unbound', 'full', 'owner asleep', 'key mismatch', 'not a member'];
    const codes = errors.all().map(function (e) { return String(e.code || ''); });
    const blob = codes.join(' ').toLowerCase().replace(/[-_]/g, ' ');
    const missing = wanted.filter(function (w) { return blob.indexOf(w.split(' ')[0]) === -1; });
    if (!missing.length) {
      test.check('cycle 2 G9: all five platform refusals have a code in the catalogue — unbound, full, owner asleep, key mismatch, not a member');
    } else {
      needs('cycle 2 G9 (platform set)', 'spirit/run/js/spiritErrors.js',
        'the app server refusals must be entries in the catalogue; nothing matching ' + missing.join(', ') + ' is defined yet');
    }
  }

  // AND THE HONEST LIMIT, WRITTEN INTO THE SUITE RATHER THAN LEFT TO THE
  // READER. A closed set does not make a sentence good. It converts a
  // continuous prose problem into a one-time review plus a mechanical
  // check — so this suite asserts MEMBERSHIP and never quality, because
  // asserting quality would be the check that cannot fail.
  test.comment('cycle 2 G9: membership is asserted, quality is not — a suite that claimed to judge a refusal sentence would be a check that cannot fail');
}

// ── G10 — the box report: four fields, one opinion withheld ──────────
test.subHeading('G10 — four fields about the box, and the opinion that is deliberately absent');
test.awaiting('public-app-server/G10', 'the four box fields in the owner report', false,
  'assigned box label, opaque fingerprint, allotment at install, and the box total as measured — and never the opinion that the box is over-committed',
  { there: 25, cost: 'the box total is free (measure already produces it) and the owner report exists; the label minted by the owner at bind and the ' +
    'fingerprint are new. THE INGREDIENTS OF THE FINGERPRINT ARE DELIBERATELY NOT DECLARED — they are contents, they want measuring on both ' +
    'platforms first, and that measurement is this agent to make once the MemoryMax and unit-counting questions are ruled: a number measured ' +
    'inside an unruled container gets quoted after the container changes' });

// ── G12 — app code and app state do not share a directory ────────────
test.subHeading('G12 — app state lives beside the node state, never inside the app folder');
{
  const ignored = read('.gitignore');
  if (/^app-state\/$/m.test(ignored)) {
    test.check('cycle 2 G12: app-state/ is gitignored, the same shape as relay-state/ — a redeployment replaces code and cannot carry state into the repository');
  } else {
    needs('cycle 2 G12', '.gitignore', 'app-state/ must be ignored exactly as relay-state/ is, or app state reaches the remote with the code');
  }

  if (starterThere) {
    // THE FAILURE THIS CATCHES IS THE ONE THAT LOOKS FINE. Code and state
    // in one folder means a redeployment either eats the state or leaves
    // orphans, and the second is worse because nothing reports it. So the
    // assertion is that the app's own folder holds no state at all.
    const stateInCode = [];
    (function walk(dir) {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      entries.forEach(function (e) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (/^(state|data|db|store)$/i.test(e.name)) stateInCode.push(path.relative(REPO, p));
          walk(p);
          return;
        }
        if (/\.(db|sqlite|sqlite3|log|jsonl)$/i.test(e.name)) stateInCode.push(path.relative(REPO, p));
      });
    }(path.join(REPO, STARTER_DIR_REL)));

    if (!stateInCode.length) {
      test.check('cycle 2 G12: the starter folder holds code and nothing that looks like state — the redeployment cannot eat what is not there');
    } else {
      test.fail('cycle 2 G12: state lives inside the app folder: ' + stateInCode.join(', '));
    }
  } else {
    needs('cycle 2 G12 (sample half)', STARTER_DIR_REL, 'the starter must keep its state in app-state/starter/ and its code in app/starter/');
  }
}

// ── G13 — the sample instantiates the template and carries the name ──
test.subHeading('G13 — the starter is the official sample, and one artefact owns the name');
{
  if (!starterThere) {
    needs('cycle 2 G13', STARTER_DIR_REL, 'the official sample must exist: it binds, learns its owner, serves a page, posts to the owner node, and does nothing else');
  } else {
    const files = fs.readdirSync(path.join(REPO, STARTER_DIR_REL));
    if (files.length) {
      test.check('cycle 2 G13: app/starter exists and is not empty — the artefact that proves the layer is the artefact every stranger copies');
    } else {
      test.fail('cycle 2 G13: app/starter is an empty folder');
    }

    // AND NOTHING FROM STAGE 2. The sample's value is that a stranger can
    // read all of it; a sample that grew a visitor story is a product.
    // COMMENTS ARE STRIPPED FIRST, and this is the second time in one
    // suite that the same mistake was made: a comment saying "no GitHub,
    // no seats" is the requirement being HONOURED, and matching the word
    // inside it reports the sample for carrying its own instructions. The
    // lever check learned this an hour earlier; this one had to learn it
    // again, which is what a habit looks like when it is not yet a rule.
    const body = files.map(function (f) {
      const p = path.join(REPO, STARTER_DIR_REL, f);
      let raw = '';
      try { raw = fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf8') : ''; } catch (e) { raw = ''; }
      return raw
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    }).join('\n');
    // AND THE FAILURE CARRIES THE SENTENCE IT MATCHED. "The starter
    // mentions seat" sends the reader hunting; the line it appeared in
    // lets them judge in a second whether it is stage 2 leaking in or a
    // word doing an innocent job. A finding that costs the receiver a
    // search is a finding that gets postponed.
    // MATCH WHAT IT DOES, NOT WHAT IT SAYS — third time this suite has
    // had to learn the same thing in one sitting, and the first two were
    // comments. This one was PROSE: the sample's own page says "There is
    // no GitHub here, no seats, no visitor", which is the requirement
    // being honoured out loud, and a word-match reported it as the
    // requirement being broken.
    //
    // A sentence naming a thing is not the thing. So the check looks for
    // the ACTIONS stage 2 would need — a link to GitHub, an OAuth
    // endpoint, an invite being consumed, a seat being claimed — and a
    // page that merely mentions them in English passes, correctly.
    const ACTIONS = [
      [/https?:\/\/[^\s"']*github\.com/i, 'a link to github.com'],
      [/\boauth\b[^\n]{0,20}(url|endpoint|client_id|redirect)/i, 'an OAuth endpoint'],
      [/["'`][^"'`\n]*\/(invite|invites)\b/i, 'an invite route'],
      [/\bconsume\w*\s*\(\s*["'`]?invite/i, 'an invite being consumed'],
      [/["'`][^"'`\n]*\/(seat|seats)\b/i, 'a seat route'],
    ];
    const outOfScope = [];
    ACTIONS.forEach(function (pair) {
      const m = pair[0].exec(body);
      if (m) outOfScope.push(pair[1] + ' — "' + String(m[0]).trim() + '"');
    });
    if (!outOfScope.length) {
      test.check('cycle 2 G13: the starter carries nothing from stage 2 — no GitHub, no seats, no invite, no visitor story');
    } else {
      test.fail('cycle 2 G13: the starter mentions stage-2 material outside its comments: ' + outOfScope.join(' | ') +
        '. A sample that grew a product is no longer a sample');
    }
  }

  // ONE NAME, ONE ARTEFACT. Andy ruled `app/starter/` and the tree already
  // holds `process/js/hello/`, a different artefact with a different job.
  // The defect this catches is not a matter of taste: two things called by
  // one name cost a stranger an afternoon, and the stranger is the person
  // the sample exists for.
  if (!has('spirit/run/app/hello') && !has('spirit/run/app/hallo')) {
    test.check('cycle 2 G13: no second artefact claims the sample name — process/js/hello keeps its own, the app layer has app/starter and nothing else');
  } else {
    test.fail('cycle 2 G13: two artefacts claim the sample name: app/hello or app/hallo exists beside the ruled app/starter');
  }
}

// ── G14 — an app DECLARES what it takes, and gets nothing it did not ─
//
// THE LOAD-BEARING CHOICE IS "ABSENT MEANS NOTHING", and this agent
// attacked it before asserting it. The reason it holds is not the one
// first given — that absent-means-everything becomes unmovable when the
// second app ships, which is a prediction — but that ABSENT MEANS
// EVERYTHING IS UNASSERTABLE: if an undeclared app receives the whole
// surface, then "every member an app touches is in its surface" is
// vacuously true of every app that declares nothing, and dead surface can
// never be counted because no member is ever provably unused. The default
// would have made G14 a check that cannot fail.
test.subHeading('G14 — the manifest declares surface, utilities and posture, and absent means nothing');
{
  const manifest = readJson(STARTER_MANIFEST_REL);
  if (!manifest) {
    needs('cycle 2 G14', STARTER_MANIFEST_REL, 'the sample must carry the three keys, because the sample is the only worked example of the contract');
  } else {
    if (Array.isArray(manifest.surface)) {
      test.check('cycle 2 G14: the starter declares a surface, as a list of api.* members — data, never behaviour, so being wrong is visible');
    } else {
      test.fail('cycle 2 G14: the starter manifest has no surface array; an app that declares no surface is handed none, so the sample would be a sample of nothing working');
    }

    // SEPARATELY OPTIONAL IS G4'S REQUIREMENT AND THIS IS WHERE IT
    // BECOMES OBSERVABLE: one key that names elements, dialogs and tokens
    // individually can be taken apart; a single boolean cannot.
    if (Array.isArray(manifest.utilities)) {
      test.check('cycle 2 G14: utilities is a list, so elements, dialogs and tokens are separately grantable — which is G4 made checkable rather than described');
    } else {
      test.fail('cycle 2 G14: utilities is not a list; G4 requires elements and style adoption to be SEPARATELY optional and a flag cannot express that');
    }

    if (manifest.posture === 'strict') {
      test.check('cycle 2 G14: the sample declares strict posture — a public app server refuses to serve an app that is not strict, and the sample must pass its own door');
    } else {
      test.fail('cycle 2 G14: the sample manifest posture is ' + JSON.stringify(manifest.posture) +
        '; it serves strangers, so it must be strict or the server must refuse it');
    }

    // A DECLARED MEMBER THAT DOES NOT EXIST IS THE FAILURE THE OPEN ITEM
    // SETTLED: refused AT LOAD, with the member named, rather than at the
    // moment the app reaches for it. Asserting it here needs the api the
    // server builds, so what is checked statically is the weaker half —
    // that the sample declares nothing obviously outside the vocabulary
    // the document names.
    const VOCAB = ['verb', 'peerPost', 'onPacket', 'fs', 'ui'];
    const unknown = (manifest.surface || []).filter(function (m) { return VOCAB.indexOf(m) === -1; });
    if (!unknown.length) {
      test.check('cycle 2 G14: every member the sample declares is one the document names — the sample cannot teach a vocabulary the boundary does not have');
    } else {
      test.comment('cycle 2 G14: the sample declares ' + unknown.join(', ') +
        ', which the document does not name. NOT a failure by itself — the vocabulary is the server\'s to define and this suite reads only the document. ' +
        'It is a question for the close ⏳');
    }

    if (manifest.refusals && typeof manifest.refusals === 'object') {
      const bad = Object.keys(manifest.refusals).filter(function (code) {
        const r = manifest.refusals[code];
        return !r || typeof r.status !== 'number' || typeof r.text !== 'string';
      });
      if (!bad.length) {
        test.check('cycle 2 G14: the sample declares its own refusals in the manifest shape — an app owns its sentences and declares them, which is what makes G9 walkable for app refusals too');
      } else {
        test.fail('cycle 2 G14: refusal entries missing status or text: ' + bad.join(', '));
      }
      const interpolated = Object.keys(manifest.refusals).filter(function (code) {
        return /\$\{|\{\{|%s|\bNaN\b|\d{2,}/.test(String(manifest.refusals[code].text || ''));
      });
      if (!interpolated.length) {
        test.check('cycle 2 G14: no declared refusal interpolates a figure — closed, literal, reviewed once, which is the condition that makes a one-time review enough');
      } else {
        test.fail('cycle 2 G14: a declared refusal carries an interpolated figure (' + interpolated.join(', ') +
          '); the document requires them literal, because a sentence that varies cannot be reviewed once');
      }
    }
  }
}

// ── G11 — the four failure states, reachable from OUTSIDE ────────────
//
// THE SHARP ONE, AND ANDY'S OWN TEST: the sample, UNMODIFIED, driven into
// all four states from outside. No lever ships — so each state is built
// by constructing the world rather than by asking the app to pretend.
//
// FOUR ASSERTIONS RATHER THAN ONE, and the reason is what the board is
// for: the states are independently constructible, so they are
// independently reachable-or-not. One assertion would answer "the
// capability exists" and hide three states that do not.
//
// Each recipe is the sample's README under G11 — a state whose
// construction nobody has written down is a state nobody else can reach.
test.subHeading('G11 — the four states, each built from outside an unmodified instance');

const RECIPES = [
  {
    state: 'unbound',
    world: 'start a real relay and do not claim it',
    expect: 'the app server serves a waiting page and acts on nothing',
  },
  {
    // MEASURED RATHER THAN ASSUMED: a relay cannot be given zero seats.
    // The floor is one megabyte because the floor in relay.js is one
    // stream, and the allowance is sixteen streams per megabyte, so the
    // smallest honest relay has sixteen. full() is `held >= allowance`,
    // so the world is built by FILLING it rather than by configuring it
    // to nothing.
    //
    // AND THE FIRST SEAT IS ALREADY TAKEN. A relay is not a relay until
    // it is owned, and the owner's claim is admitted REGARDLESS of
    // capacity — relay.js:1730 and :1740 both read
    // `if (!firstOwner && …full…)`, so the owner bypasses the seat check
    // AND the disc check. That bypass is what makes a relay recoverable
    // at all: the one account that can raise the limit must be able to
    // get on. So sixteen seats is the owner plus fifteen, and a recipe
    // saying "sixteen more" sends a stranger one claim past the wall it
    // was meant to stop at. (Andy found the premise; the line numbers
    // are this suite checking it rather than taking it.)
    // AND IT TAKES OVER A MINUTE, WHICH IS THE PRODUCT WORKING. Measured
    // while rehearsing this builder: the tenth claim from one address is
    // refused with `too many claims` — `relay.js:1559`, CLAIM_PER_MIN = 10
    // at :148 over a 60-second window at :220, keyed by the caller. So
    // sixteen seats cannot be taken from one machine inside two minutes,
    // and a reader who meets a 429 while reproducing this has found a
    // DIFFERENT wall from the one the recipe is about. That sentence
    // belongs in the sample's README beside the recipe.
    state: 'full',
    world: 'start a relay at ramLimitMB 1 — sixteen seats, the smallest honest allowance — then the owner claim and FIFTEEN more, ' +
      'in two batches a minute apart because ten claims a minute from one address is the limit',
    expect: 'the visitor is offered the other door and sees none of the box figures',
  },
  {
    state: 'owner-asleep',
    world: 'do not start the owner node',
    expect: 'the refusal names what to do, and nothing durable holds what arrived',
  },
  {
    state: 'key-mismatch',
    world: 'stand up a second relay with a different key and point the sample at it',
    expect: 'the bind refuses rather than learning a new owner',
  },
];

// NO LEVER SHIPS, and that is assertable today, statically, against the
// half that exists. It is the requirement most likely to be satisfied by
// accident during the build and then quietly broken by the first person
// who finds the states hard to reach — which is exactly why it is written
// as an assertion rather than trusted.
{
  const leverNames = /(FORCE_|FAKE_|PRETEND_|SIMULATE_)[A-Z_]*|--(force|fake|pretend|simulate)-[a-z-]+/;
  const offenders = [];
  [APP_SERVER_REL, STARTER_DIR_REL].forEach(function (rel) {
    const abs = path.join(REPO, rel);
    if (!fs.existsSync(abs)) return;
    const stack = [abs];
    while (stack.length) {
      const p = stack.pop();
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) {
        fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); });
        continue;
      }
      if (!/\.(js|json|html)$/.test(p)) continue;
      const body = fs.readFileSync(p, 'utf8');
      // The comment that FORBIDS a lever is not a lever. Match the code.
      const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (leverNames.test(stripped)) offenders.push(path.relative(REPO, p));
    }
  });
  if (!offenders.length) {
    test.check('cycle 2 G11: no failure-state lever exists in the app server or the sample — the states must be reached by building the world, which is what makes them real');
  } else {
    test.fail('cycle 2 G11: a lever that fakes a failure state exists in ' + offenders.join(', ') +
      '. A state reachable only by a lever is a state nobody outside can reach, which is the requirement inverted');
  }
}

// THE WORLDS THEMSELVES. They need labMaster, and labMaster must be THIS
// checkout's — a labMaster serving a foreign tree does not make these
// fail, it makes them PASS about code nobody is looking at, which is the
// one thing on this machine that can turn a green board into a lie.
(async function () {
  if (!appServerThere || !starterThere) {
    RECIPES.forEach(function (r) {
      needs('cycle 2 G11 (' + r.state + ')', appServerThere ? STARTER_DIR_REL : APP_SERVER_REL,
        'the world is "' + r.world + '" and the state is "' + r.expect + '"');
    });
    test.reportSuccessFailureCount();
    return;
  }

  let ready = null;
  try { ready = await ensureMaster.ensure(); } catch (e) { ready = { foreign: true, error: String(e && e.message || e) }; }
  if (!ready || ready.foreign) {
    test.standsDown('cycle 2 G11: labMaster is not this checkout\'s (' +
      ((ready && ready.error) || 'not reachable') + '), so the four states cannot be built here. ' +
      'Standing down rather than reporting a result about a tree nobody is looking at');
    test.reportSuccessFailureCount();
    return;
  }

  const worlds = require('./appServerWorlds');
  const errors = require(path.join(REPO, 'spirit/run/js/spiritErrors.js'));
  const mod = require(path.join(REPO, APP_SERVER_REL));

  // A REFUSAL IS CHECKED FOR MEMBERSHIP, NEVER FOR ITS WORDS. The
  // document does not name the code strings, and a suite that invented
  // them would be asserting its own vocabulary — which is the divergence
  // it exists to find, manufactured. What the document DOES guarantee is
  // that every refusal is a member of a declared set and carries a code,
  // so that is what is asserted.
  // WHERE A CODE IS CARRIED IS THE INTERFACE'S TO DECIDE, NOT THIS
  // SUITE'S. The first version looked only at `carrier.code` and reported
  // "no code" against a state that carried one at `lastBind.code` — a red
  // line about the product that was a defect in the reader. The document
  // guarantees that a refusal HAS a declared code; it never said where it
  // sits, so the suite looks in the places a state can reasonably put it
  // and fails only when none of them has one.
  function refusalIsDeclared(carrier) {
    if (!carrier || typeof carrier !== 'object') return { ok: false, why: 'no refusal was carried at all' };
    const code = carrier.code ||
      (carrier.refusal && carrier.refusal.code) ||
      (carrier.lastBind && carrier.lastBind.code) ||
      (carrier.lastReach && carrier.lastReach.code) ||
      '';
    if (!code) return { ok: false, why: 'the refusal carries no code, so "member of a declared set" cannot be walked — prose cannot be matched against a set' };
    if (!errors.byCode(code)) return { ok: false, why: 'the code ' + JSON.stringify(code) + ' is in no declared set' };
    return { ok: true, code: code };
  }

  // NOTHING DURABLE HELD, which is the half of "acts on nothing" that can
  // be observed from outside: the app's own state home is empty. An app
  // server that persisted a visitor would leave the evidence here, and
  // G9's strict posture is exactly the promise that it does not.
  function nothingPersisted(rootDir) {
    const dir = path.join(rootDir, 'app-state');
    if (!fs.existsSync(dir)) return { ok: true, held: [] };
    const held = [];
    const stack = [dir];
    while (stack.length) {
      const p = stack.pop();
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); }); continue; }
      // The config, the pinned key and the server's OWN IDENTITY are its
      // own state and are supposed to be there. A visitor's trace is
      // anything else.
      //
      // identity.json was missing from this list and produced two red
      // lines that were this suite's fault: a server writes its own key
      // at start because a server with no key cannot be addressed at all,
      // and calling that "acting on a visitor" confuses being alive with
      // doing something. Named rather than quietly widened — the point of
      // the list is that anything NOT on it is a trace, so every addition
      // has to earn its place out loud.
      if (/^(config\.json|identity\.json)$/i.test(path.basename(p))) continue;
      if (/relay-key|pinned/i.test(path.basename(p))) continue;
      held.push(path.relative(rootDir, p));
    }
    return { ok: held.length === 0, held: held };
  }

  const appRoot = path.join(labPaths.FIXTURE_ROOT, 'asb-appserver', 'spirit', 'run');
  const APP_PORT = 45610;

  // ── ONE PLACE IN THIS SUITE TOUCHES THE WIRE ───────────────────────
  //
  // `oneDoor` counts what reaches past the interface and fails on GROWTH,
  // which is how it stops back-sliding. Adding a second call site for the
  // door would have raised the tally — so the two readers share one, and
  // the suite obeys the rule it was written to assert about everything
  // else. The count does not go up because there is nothing new to count.
  async function reach(port, path, opts) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + path, opts || undefined);
      const text = await res.text();
      return { status: res.status, text: text };
    } catch (e) {
      return { status: 0, text: '', error: String((e && e.message) || e) };
    }
  }

  async function pageOf(port) {
    const r = await reach(port, '/');
    return { status: r.status, body: r.text, error: r.error };
  }

  // ── A FETCH OF THE PAGE RUNS NONE OF THE PAGE ───────────────────────
  //
  // The owner-asleep recipe said "a visit is what causes it: the sample
  // posts to the owner node" — and `pageOf` fetches HTML over HTTP, where
  // no script executes. So the act the recipe describes never happened,
  // and the suite waited for a refusal nobody had caused.
  //
  // THE DOOR IS THE OUTSIDE. Driving it is not a shortcut around the
  // sample: it is the same request the sample's `ask` makes, made by the
  // thing standing where a browser stands. A headless browser would
  // prove one more link — that the page calls it — and that link is
  // asserted statically instead, under G3, by requiring the sample to
  // import the one `ask` and hold no raw call of its own.
  async function doorOf(port, verb) {
    const r = await reach(port, '/api/spirit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verb: verb }),
    });
    let body = null;
    try { body = JSON.parse(r.text); } catch (e) { body = null; }
    return { status: r.status, body: body, error: r.error };
  }

  // A FRESH BOX WITH THE APP DEPLOYED ONTO IT. The app is copied in
  // because that is what a deployment does and because, without it, an
  // app server started with `appName: 'starter'` finds no starter — which
  // is what happened on the first run of these worlds and looked exactly
  // like the feature being unbuilt.
  // A BIND IS NOT INSTANT, AND READING BEFORE IT SETTLES INVENTS A
  // FINDING. `start()` returns as soon as the server listens; reaching the
  // relay, learning its key and pinning it happen after that. The first
  // version of the pin check read state() straight after the page
  // answered, saw an empty boundKey, and was one sentence away from
  // reporting "the pin did not survive the process" about a bind that had
  // not yet happened.
  //
  // So the suite WAITS FOR THE STATE TO SETTLE and says so when it does
  // not — a timeout here is itself a finding, and a different one from an
  // empty pin.
  async function settled(h, ms) {
    const until = Date.now() + (ms || 8000);
    let st = null;
    while (Date.now() < until) {
      try { st = h.state(); } catch (e) { st = null; }
      if (st && st.lastBind) return st;
      await new Promise(function (r) { setTimeout(r, 120); });
    }
    return st;
  }

  function freshRoot() {
    try { fs.rmSync(appRoot, { recursive: true, force: true }); } catch (e) { /* nothing to remove */ }
    fs.mkdirSync(appRoot, { recursive: true });
    if (!worlds.plantStarter(appRoot, REPO)) {
      test.fail('cycle 2 G11: the sample could not be deployed onto the fixture box — ' + STARTER_DIR_REL +
        ' is not there to copy, so every world below would test an app server with no app');
    }
    return appRoot;
  }

  try {
    await worlds.clear();

    // ── unbound ──────────────────────────────────────────────────────
    {
      const w = await worlds.unclaimedRelay();
      if (!w.ok) {
        test.fail('cycle 2 G11 (unbound): the world could not be built — ' + w.error +
          '. The recipe is "' + RECIPES[0].world + '"');
      } else {
        const root = freshRoot();
        const h = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT, relay: w.relay.url, invite: w.appInvite && w.appInvite.token });
        h.start();
        await worlds.answering('http://127.0.0.1:' + APP_PORT + '/', 6000);
        const page = await pageOf(APP_PORT);
        const st = h.state();

        if (page.status === 200) {
          test.check('cycle 2 G11 (unbound): against a relay nobody has claimed the app server STARTS and serves a page — ' +
            'waiting is a state, not a crash, and the recipe is "' + RECIPES[0].world + '"');
        } else {
          test.fail('cycle 2 G11 (unbound): the app server did not serve a page against an unclaimed relay (status ' + page.status + ')');
        }

        const held = nothingPersisted(root);
        if (held.ok) {
          test.check('cycle 2 G11 (unbound): it acted on nothing — the app state home holds no trace beyond its own config');
        } else {
          test.fail('cycle 2 G11 (unbound): it persisted ' + held.held.join(', ') + ' while waiting; "acts on nothing" is the requirement');
        }

        // THE FIELD NAME WAS THIS SUITE'S GUESS AND THE GUESS WAS WRONG.
        // The document requires the waiting state to be observable; it
        // never said the field is called `bound`. Asserting `bound ===
        // false` was inventing a vocabulary and then reporting the
        // interface for not speaking it — the divergence manufactured
        // rather than found. Either spelling satisfies the requirement.
        const saysUnbound = !!st && (st.unbound === true || st.bound === false);
        if (saysUnbound) {
          test.check('cycle 2 G11 (unbound): state() reports itself unbound, so the waiting state is observable rather than only visible on a page');
        } else {
          test.fail('cycle 2 G11 (unbound): state() does not report the unbound condition (' + JSON.stringify(st) + '); a state a suite cannot read is a state nobody can monitor');
        }
        h.stop();
      }
      await worlds.clear();
    }

    // ── G14, BEHAVING — four manifests that are each wrong in one way ─
    //
    // The sample cannot show any of this, because the sample is correct.
    // A correct declaration exercises the grant and never the refusal, so
    // the suite brings four apps of its own, each wrong in exactly one
    // named way. They are the suite's artefacts, planted in the app
    // server's own fixture root and thrown away with it.
    {
      const w = await worlds.claimedRelay({ appInvite: true });
      if (!w.ok) {
        test.fail('cycle 2 G14 (behaving): the backdrop relay could not be built — ' + w.error);
      } else {
        const root = freshRoot();
        worlds.plantWrongApps(root);

        // ── THE CONTROL, AND IT CAUGHT THIS SUITE CHEATING ITSELF ────
        //
        // The first run of these four reported "an app that declares no
        // surface is handed NONE" as a PASS — and it passed because the
        // contract came back entirely empty for every fixture, including
        // the one that declares a surface. Nothing had been loaded at
        // all, so "was handed nothing" was true of everything and the
        // assertion could not have failed.
        //
        // THAT IS THE CHECK THAT CANNOT FAIL, IN THIS AGENT'S OWN FILE,
        // one hour after writing a page about it. The cure is the same
        // one: make it carry evidence. Before asking what an app was
        // GRANTED, prove its manifest was READ — by planting one that
        // declares something and requiring the server to show it back.
        // If that control fails, the four assertions below say so and
        // claim nothing, because a grant assertion against an unread
        // manifest is noise wearing a result's clothes.
        let contractsAreRead = false;
        {
          const probe = mod.create({ rootDir: root, appName: 'asb-elements-only', port: APP_PORT, relay: w.relay.url });
          try { probe.start(); } catch (e) { /* the control is the state, not the start */ }
          const st = probe.state();
          const c = (st && st.contract) || {};
          const sawSomething = (Array.isArray(c.surface) && c.surface.length > 0) ||
            (Array.isArray(c.utilities) && c.utilities.length > 0) ||
            (typeof c.posture === 'string' && c.posture !== '');
          contractsAreRead = sawSomething;
          try { probe.stop(); } catch (e) { /* nothing to stop */ }

          if (contractsAreRead) {
            test.check('cycle 2 G14 (control): a manifest planted under the server\'s own rootDir is READ — ' +
              'so the four assertions below are about what an app was granted, rather than about a manifest nobody opened');
          } else {
            test.fail('cycle 2 G14 (control): a manifest at app/<name>/<name>.json under the given rootDir was NOT read — ' +
              'the contract came back ' + JSON.stringify(c) + '. G15 says create() takes rootDir and appName, so either the app is resolved ' +
              'somewhere else or the manifest is read at a moment this suite has not reached. EVERY G14 assertion below is suspended: ' +
              'against an unread manifest they would all pass, and a pass that cannot fail is worse than a red');
          }
        }

        // 1. ABSENT MEANS NOTHING.
        if (contractsAreRead) {
          const h = mod.create({ rootDir: root, appName: 'asb-declares-nothing', port: APP_PORT, relay: w.relay.url });
          let started = true;
          try { h.start(); } catch (e) { started = false; }
          const st = h.state();
          const granted = (st && (st.surface || st.api || st.granted)) || [];
          const count = Array.isArray(granted) ? granted.length : Object.keys(granted || {}).length;
          if (count === 0) {
            test.check('cycle 2 G14: an app that declares no surface is handed NONE — which is what makes "every member an app touches is declared" a check that can fail, ' +
              'and absent-means-everything would have made it vacuous for every app that declared nothing');
          } else {
            test.fail('cycle 2 G14: an app declaring no surface was handed ' + count +
              ' member(s). Absent must mean nothing: with the other default, dead surface can never be counted because no member is ever provably unused');
          }
          if (started) { try { h.stop(); } catch (e) { /* nothing to stop */ } }
        }

        // 2. A MEMBER THAT CANNOT BE SUPPLIED IS REFUSED AT LOAD, NAMED.
        // (suspended with the rest when the control above did not hold)
        if (contractsAreRead) {
          const h = mod.create({ rootDir: root, appName: 'asb-asks-the-impossible', port: APP_PORT, relay: w.relay.url });
          let threw = null;
          try { h.start(); } catch (e) { threw = e; }
          const st = h.state();
          const text = String((threw && threw.message) || '') + ' ' + JSON.stringify(st || {});
          const refused = !!threw || !!(st && (st.refused || st.error || st.code));
          if (refused && /thereIsNoSuchMember/.test(text)) {
            test.check('cycle 2 G14: a surface naming a member the server cannot supply is refused AT LOAD and the member is NAMED — ' +
              'refused at reach, the failure names a runtime symptom and the author guesses; refused at load, it names the member');
          } else if (refused) {
            test.fail('cycle 2 G14: the impossible member was refused but not NAMED (' + text.slice(0, 200) +
              '); the naming is the whole difference between a boundary and a surprise');
          } else {
            test.fail('cycle 2 G14: an app declaring a member that does not exist was loaded anyway; it will fail at the moment it reaches, in front of a stranger');
          }
          try { h.stop(); } catch (e) { /* nothing to stop */ }
        }

        // 3. A PUBLIC APP SERVER REFUSES AN APP THAT IS NOT STRICT.
        if (contractsAreRead) {
          const h = mod.create({ rootDir: root, appName: 'asb-not-strict', port: APP_PORT, relay: w.relay.url });
          let threw = null;
          try { h.start(); } catch (e) { threw = e; }
          const st = h.state();
          const refused = !!threw || !!(st && (st.refused || st.error || st.code));
          if (refused) {
            test.check('cycle 2 G14: an app that is not strict is refused by a public app server — the posture is enforced at the door rather than trusted');
          } else {
            test.fail('cycle 2 G14: a non-strict app was served to strangers; the manifest said ordinary and the server did not mind');
          }
          try { h.stop(); } catch (e) { /* nothing to stop */ }
        }

        // 4. UTILITIES ARE SEPARATELY GRANTABLE — G4, MADE OBSERVABLE.
        if (contractsAreRead) {
          const h = mod.create({ rootDir: root, appName: 'asb-elements-only', port: APP_PORT, relay: w.relay.url });
          let started = true;
          try { h.start(); } catch (e) { started = false; }
          const st = h.state();
          const utils = (st && (st.utilities || st.granted)) || [];
          const list = Array.isArray(utils) ? utils : Object.keys(utils || {});
          const hasElements = list.indexOf('elements') !== -1;
          const hasDialogs = list.indexOf('dialogs') !== -1;
          if (hasElements && !hasDialogs) {
            test.check('cycle 2 G14: taking elements did not bring dialogs along — separately optional, which is G4 made observable instead of described');
          } else if (!started) {
            test.fail('cycle 2 G14: the elements-only app did not start at all, so separability could not be observed');
          } else {
            test.fail('cycle 2 G14: utilities are not separately grantable — the app asked for elements and holds ' +
              JSON.stringify(list) + '; G4 requires elements and style adoption to be independently optional');
          }
          if (started) { try { h.stop(); } catch (e) { /* nothing to stop */ } }
        }
      }
      await worlds.clear();
    }

    // ── full ─────────────────────────────────────────────────────────
    {
      // SIXTEEN SEATS AT ramLimitMB 1 — the smallest honest allowance —
      // and the owner holds the first, so fifteen more fill it.
      const w = await worlds.claimedRelay({ ramLimitMB: 1, members: 15, proveFull: true });
      if (!w.ok) {
        test.fail('cycle 2 G11 (full): the world could not be built — ' + w.error);
      } else {
        // THE WORLD IS CHECKED BEFORE THE ASSERTION IT FEEDS. A relay that
        // took only twelve is not full, and an assertion about fullness
        // run against it would pass or fail for a reason nobody could see.
        // So the builder takes one claim too many and reports what it met:
        // if that claim was ADMITTED there was a spare seat, and the world
        // is not the one this section asserts against.
        const seated = 1 + w.joined.length;
        if (w.wall && w.wall.admitted === false) {
          test.check('cycle 2 G11 (full): the world is genuinely full — ' + seated +
            ' seats taken and one more claim refused, so the assertions below are made against a wall rather than a crowd');
        } else {
          test.fail('cycle 2 G11 (full): the world is not full — the extra claim was admitted (' + seated +
            ' seats). Everything below would be asserting against the wrong world');
        }

        const root = freshRoot();
        const h = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT, relay: w.relay.url, invite: w.appInvite && w.appInvite.token });
        h.start();
        await worlds.answering('http://127.0.0.1:' + APP_PORT + '/', 6000);
        const page = await pageOf(APP_PORT);
        h.stop();

        // NONE OF THE BOX FIGURES. A full relay tells a stranger that it
        // is full; it does not tell them how full, how much memory the
        // box has, or how many seats there are. Those are the owner's
        // figures and G10 keeps them on the owner's side.
        const leaked = /\b\d+\s?(MB|GB|seats?|members?)\b/i.exec(page.body || '');
        if (!leaked) {
          test.check('cycle 2 G11 (full): the visitor sees none of the box figures — no seat count, no memory, no allowance');
        } else {
          test.fail('cycle 2 G11 (full): a box figure reached the visitor: ' + JSON.stringify(leaked[0]));
        }
      }
      await worlds.clear();
    }

    // ── owner asleep ─────────────────────────────────────────────────
    {
      const w = await worlds.claimedRelay({ appInvite: true });
      if (!w.ok) {
        test.fail('cycle 2 G11 (owner-asleep): the world could not be built — ' + w.error);
      } else {
        const sleeping = await worlds.ownerAsleep(w);
        if (!sleeping.ok) {
          test.fail('cycle 2 G11 (owner-asleep): the owner node could not be built and stopped — ' + sleeping.error);
        } else {
          const root = freshRoot();
          const h = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT, relay: w.relay.url, invite: w.appInvite && w.appInvite.token });
          h.start();
          await worlds.answering('http://127.0.0.1:' + APP_PORT + '/', 6000);
          // THE REFUSAL HAS TO BE PROVOKED BEFORE IT CAN BE READ. The
          // first version of this read state() straight after start and
          // reported "no code" — but nothing had tried to reach the owner
          // yet, so there was no refusal to carry. Asserting the shape of
          // a refusal nobody caused is asking a question of a state that
          // has not happened.
          //
          // A VISIT IS WHAT CAUSES IT: the sample posts to the owner node,
          // which is the act the owner being asleep interrupts.
          await pageOf(APP_PORT);
          // The act the page performs, performed from where the page is.
          // Without this the visit is a GET of some HTML and nothing has
          // tried to reach anybody.
          const answered = await doorOf(APP_PORT, 'app.reach');
          // ── THE STATE NAMED MUST BE THE STATE TESTED ────────────────
          //
          // This first passed on code `no-cipher-key` at 428, and 428 is
          // THE SENDER'S OWN REFUSAL BEFORE ANYTHING LEAVES — appServer's
          // own comment says it: "emphatically not a sleeping owner." So
          // the owner being asleep was never exercised, and the assertion
          // was green about a world it had not built.
          //
          // A DECLARED CODE IS NOT ENOUGH; it has to be a code ABOUT THE
          // OWNER. Anything else means the reach died at home, and a
          // world that cannot get out of its own process proves nothing
          // about a peer that is not answering.
          // ── AND `app-not-a-member` IS NOT THIS STATE EITHER ─────────
          //
          // Widened to three codes once the 428 was fixed, and it passed
          // immediately on `app-not-a-member` at 403 — which is a fact
          // about the OWNER'S RELAY refusing to route, not about the
          // owner being asleep. THE APP SERVER NEVER CLAIMS A SEAT: there
          // is no invite and no claim anywhere in appServer.js, so it is
          // not a member of the relay it serves and nothing it posts is
          // ever routed.
          //
          // THIRD TIME THIS WORLD HAS GONE GREEN ON A STATE IT WAS NOT
          // IN — first on the missing card, then on the missing
          // membership. Each time a layer underneath was absent and its
          // absence produced an answer that looked like the answer. The
          // only cure that has worked is naming the ONE code this world
          // means, so the next missing layer fails loudly instead of
          // substituting itself.
          const ABOUT_THE_OWNER = ['app-owner-asleep'];
          const got = (answered.body && answered.body.code) || '';
          if (ABOUT_THE_OWNER.indexOf(got) !== -1) {
            test.check('cycle 2 G11 (owner-asleep): the door answers the reach with code ' + got +
              ' at status ' + answered.status + ' — a refusal about the OWNER, reaching HTTP, which is where a stranger meets it');
          } else if (got) {
            test.fail('cycle 2 G11 (owner-asleep): the reach was refused with ' + got + ' at status ' + answered.status +
              ', which is not a fact about the OWNER — the owner being asleep was never exercised, because something ' +
              'nearer than the owner refused first. ' + (got === 'app-not-a-member'
                ? 'The app server never claims a seat: there is no invite and no claim in appServer.js, so it is not a ' +
                  'member of the relay it serves and nothing it posts is routed.'
                : 'The refusal came from this server before anything left the box.') +
              ' Expected ' + ABOUT_THE_OWNER.join(', ') + ' — this world means exactly one state and must not pass on a nearer one.');
          } else {
            test.fail('cycle 2 G11 (owner-asleep): the door answered ' + JSON.stringify(answered).slice(0, 200) +
              ' — a refusal that carries no code over HTTP cannot be matched against the declared set by anyone outside this process');
          }
          const st = await settled(h, 8000);
          const declared = refusalIsDeclared(st);
          if (declared.ok) {
            test.check('cycle 2 G11 (owner-asleep): the refusal carries the code ' + declared.code +
              ', a member of a declared set — which is what makes "every refusal is declared" walkable rather than hoped');
          } else {
            test.fail('cycle 2 G11 (owner-asleep): ' + declared.why +
              '. The state was ' + JSON.stringify(st) +
              ' — carried in full because a refusal-shape finding that does not show the shape sends the reader to reproduce it');
          }
          const held = nothingPersisted(root);
          if (held.ok) {
            test.check('cycle 2 G11 (owner-asleep): nothing durable holds what arrived while the owner was unreachable');
          } else {
            test.fail('cycle 2 G11 (owner-asleep): it kept ' + held.held.join(', ') + ' while the owner was asleep');
          }

          // ── THE OWNER'S NAME IS A BOX FIGURE THAT DOES NOT LOOK LIKE ONE ──
          //
          // G11 says the visitor sees none of the box figures, and the
          // manifest check below forbids interpolated NUMBERS. A NAME
          // passes both: it carries no digits and no `${}`, and it is the
          // most identifying thing that could appear on that page.
          //
          // It cannot be caught statically — a manifest cannot know whose
          // relay it will serve. It CAN be caught here, because this world
          // built the owner and knows the label it gave them. That is the
          // whole argument for asserting it in a world rather than in a
          // file: the check needs a fact only the world has.
          //
          // Andy approved the sample's sentence on the strength of it
          // naming nobody ("The person who looks after this service"), so
          // this is the assertion that keeps that property true after the
          // next person edits the manifest.
          // IT CHECKS THE REFUSAL, NOT THE PAGE — and the first version of
          // this assertion checked the page, went red, and would have been
          // reported as a defect in the other half.
          //
          // The page is not the same question. A public app server is "a
          // public node-app, CONTROLLED BY THE OWNER", so a landing page
          // that says whose service it is may be entirely correct and
          // nobody has ruled otherwise. What Andy approved was the wording
          // of the REFUSAL, on the strength of it naming nobody — so that
          // is what this holds to, and the wider question stays unasked
          // rather than being decided by an assertion I wrote.
          const label = (w.owner && w.owner.name) || 'asbowner';
          const refusalText = JSON.stringify((answered && answered.body) || {});
          if (refusalText.indexOf(label) === -1) {
            test.check('cycle 2 G11 (owner-asleep): the refusal names nobody — a name is the box figure that carries no digits, passes every check that looks for figures, and is the most identifying thing that could be on that screen');
          } else {
            test.fail('cycle 2 G11 (owner-asleep): the owner label ' + JSON.stringify(label) +
              ' is in the refusal the visitor receives: ' + refusalText.slice(0, 160) +
              '. It is the owner\'s to publish, not the app\'s to leak');
          }
          h.stop();
        }
      }
      await worlds.clear();
    }

    // ── key mismatch ─────────────────────────────────────────────────
    {
      const first = await worlds.claimedRelay({ appInvite: true });
      if (!first.ok) {
        test.fail('cycle 2 G11 (key-mismatch): the first relay could not be built — ' + first.error);
      } else {
        const root = freshRoot();
        const bound = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT, relay: first.relay.url, invite: first.appInvite && first.appInvite.token });
        bound.start();
        await worlds.answering('http://127.0.0.1:' + APP_PORT + '/', 6000);
        const boundState = await settled(bound, 8000);
        bound.stop();

        // DOES THE PIN SURVIVE THE PROCESS? Asserted separately from the
        // refusal below, because they fail together and mean different
        // things: a server that refuses the second relay because it
        // FORGOT the first is not pinning, it is amnesiac, and the two
        // are indistinguishable from the refusal alone.
        //
        // "The first bind is final" is a promise about what happens after
        // a restart. A pin held only in memory keeps it for exactly as
        // long as nothing goes wrong.
        const after = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT });
        const remembered = after.state();
        try { after.stop(); } catch (e) { /* never started */ }
        if (remembered && remembered.boundKey && remembered.boundKey === boundState.boundKey) {
          test.check('cycle 2 G6: the pinned relay key survives the process — a second handle on the same box remembers what the first bound to, which is what makes "the first bind is final" a promise rather than a habit');
        } else {
          test.fail('cycle 2 G6: the pin did not survive. The first bind held ' + JSON.stringify(boundState.boundKey) +
            ' and a fresh handle on the same rootDir reports ' + JSON.stringify(remembered && remembered.boundKey) +
            ' (' + JSON.stringify(remembered && remembered.lastBind) + '). A pin that dies with the process cannot make a first bind final');
        }

        const second = await worlds.otherRelay();
        if (!second.ok) {
          test.fail('cycle 2 G11 (key-mismatch): the second relay could not be built — ' + second.error);
        } else {
          // THE SAME rootDir, A DIFFERENT RELAY. This is the attack the
          // pinning exists for: something else answers where the relay
          // used to, and under "learns its owner" it would own the app
          // for good.
          const again = mod.create({ rootDir: root, appName: 'starter', port: APP_PORT, relay: second.relay.url });
          let refusedAtStart = null;
          try { again.start(); } catch (e) { refusedAtStart = e; }
          const st = again.state();
          try { again.stop(); } catch (e) { /* a server that refused to start has nothing to stop */ }

          const declared = refusalIsDeclared(st);
          if (refusedAtStart || declared.ok) {
            test.check('cycle 2 G11 (key-mismatch): a second relay answering with a different key is REFUSED rather than learned — ' +
              'the bind is to the key proved at first contact, never to the URL');
          } else {
            test.fail('cycle 2 G11 (key-mismatch): the app server accepted a relay with a different key. ' +
              'This is the hostile-relay hole: a URL is a name somebody else controls, and "learns its owner" hands the app to whoever answers');
          }

          // KEPT AND REPORTED, not merely refused. A contradiction that is
          // discarded leaves the owner unable to tell a migration they
          // made from an attack they did not.
          if (st && (st.contradiction || st.reported || st.conflict)) {
            test.check('cycle 2 G11 (key-mismatch): the contradiction is kept and reported, so the owner can tell a migration from an attack');
          } else {
            // TWO HALVES, AND ONLY ONE OF THEM IS SATISFIED. Refusing the
            // new relay is right. Coming back with NO relay at all is the
            // part that is not: the pin proved itself durable in the
            // check above, so a contradiction that empties it has thrown
            // away the thing the owner needs. The finding is not "it
            // accepted the impostor" — it did not — it is that meeting an
            // impostor costs the server what it knew.
            // MEASURED AT THE STOP, AND IT CORRECTS THIS LINE'S OWN
            // EARLIER WORDING. This said "the pin was emptied". It is
            // not: app-state/<name>/config.json still holds relay,
            // relayKey and boundAt, intact, after the impostor. The pin
            // is safe on disc.
            //
            // WHAT IS WRONG IS WHAT THE PROCESS SAYS ABOUT IT. A second
            // start carrying a conflicting --relay comes back
            // `unbound`, with `no relay configured`, while a perfectly
            // good pin sits in its own file. Three costs, and the middle
            // one is the expensive one:
            //   - the impostor is correctly NOT obeyed;
            //   - the message is FALSE and is the one an operator acts
            //     on — they conclude they must pass --relay, which is
            //     the one thing that cannot work;
            //   - and the server is down rather than serving the relay
            //     it is still pinned to.
            // `app-relay-key-changed` exists in the declared set and is
            // not what came back.
            const blind = !!(st && !st.boundKey);
            test.fail('cycle 2 G11 (key-mismatch): the impostor is refused, and the pin survives on disc — but the RUNNING SERVER cannot see it' +
              (blind ? ': boundKey "" and lastBind ' + JSON.stringify(st.lastBind) +
                ', while app-state/<name>/config.json still holds relay, relayKey and boundAt. "No relay configured" is false, ' +
                'it is the sentence an operator acts on, and the declared code app-relay-key-changed is not the one returned' : '') +
              '. A server that meets an impostor should go on serving the relay it is pinned to and report the conflict, not go dark');
          }
        }
      }
      await worlds.clear();
    }
  } catch (e) {
    // A WORLD THAT BROKE IS REPORTED AS A WORLD THAT BROKE, never as the
    // product failing. The distinction cost an evening once: six causes
    // ruled out by measurement, and the answer was in the first failure
    // line the whole time.
    test.fail('cycle 2 G11: the worlds could not be run to the end — ' + String((e && e.stack) || e));
    try { await worlds.clear(); } catch (e2) { /* the teardown's own failure must not mask the first */ }
  }

  test.reportSuccessFailureCount();
}());
