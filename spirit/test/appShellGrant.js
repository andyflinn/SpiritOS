'use strict';

// spirit/test/appShellGrant.js
// THE GRANT MECHANISM — the bottom of the public-face vision, asserted
// before it is built.
//
//   Andy, 2026-09-25: "so the bottom is the grant mechanism that underpins
//   the installation of join into the DNS namespace as well as member
//   subdomain assignments."
//   And the two constraints on it, his words: "faceless, no shortcut."
//   And the minimum: "the appShellApp could implement the bare minimum,
//   and this is the no-face negotiation, without any local shell interface
//   yet or anything."
//
// Written by wsl-claude from the interface the other agent named, after
// asking for it rather than guessing — which is G15 from cycle 2 applied
// to the next thing. Every name called here came from that message and
// none from reading the source.
//
// ── FACELESS IS WHAT MAKES THESE ASSERTIONS HONEST ──────────────────
//
// No public face, no control panel, no HTTP surface, no UI. THE ONLY WAY
// TO DRIVE IT IS THE EXCHANGE — so this suite drives it exactly the way
// join's installer will, because there is no other way to drive it at
// all. There is no UI path that could diverge from the tested one and no
// local path that could skip the wire.
//
// ── RED IS THE EXPECTED STATE, AND RED IS THE POINT ─────────────────
//
// Andy ruled the minimum this morning and nothing is built. An assertion
// written now says "not built AND here is exactly what built looks like",
// which catches a WRONG build; a declaration says only "not built". The
// other agent asked for reds over awaitings and was right to.
//
// WHAT IS NOT ASSERTED HERE, deliberately: anything about join's hostname
// or path (join's shape is not settled), and anything about the generic
// shell layer (app/shell does not exist). Both are declared elsewhere and
// a suite that guesses at an unsettled API has to be rewritten when the
// design lands.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const ensureMaster = require('./labMaster/ensureMaster');

const REPO = path.join(__dirname, '..', '..');
const APP_DIR_REL = 'spirit/run/app/appShellApp';

function has(rel) { return fs.existsSync(path.join(REPO, rel)); }

const appThere = has(APP_DIR_REL);

// ONE SENTENCE PER ABSENT UNIT rather than one per assertion it would
// have fed — the same shape as the app-server board, for the same reason:
// forty failures about one missing folder tell the reader one thing forty
// times.
function needs(req, what) {
  test.fail(req + ' — `' + APP_DIR_REL + '` is not built yet, so this cannot pass: ' + what);
}

test.startTest('The grant mechanism — faceless, no shortcut, and no special case');

// ── THE REFUSAL IS DECLARED BEFORE ANYTHING USES IT ──────────────────
//
// G9's rule, and the one half of this that is checkable with nothing
// built: a refusal an app can emit is a member of a declared set. The
// code was named in the interface, so this either finds it or says the
// catalogue has not caught up.
test.subHeading('the refusal is a member of the declared set');
{
  let errors = null;
  try { errors = require(path.join(REPO, 'spirit/run/js/spiritErrors.js')); } catch (e) { errors = null; }
  if (!errors || typeof errors.byCode !== 'function') {
    test.fail('grant: spiritErrors no longer exposes byCode(), so "every refusal is declared" cannot be walked');
  } else if (errors.byCode('name-already-granted')) {
    test.check('grant: name-already-granted is in the catalogue — the refusal is walkable before anything emits it');
  } else {
    test.fail('grant: name-already-granted is not in spiritErrors. The interface names it as the refusal, and a code ' +
      'that exists only in the emitting file is outside the closed set at the one moment it matters');
  }
}

// ── FACELESS, WHICH IS ASSERTABLE TODAY AND FOREVER ──────────────────
//
// This is the constraint most likely to erode, because a control panel is
// the obvious next convenience and nothing would go red. It is also the
// constraint that makes every other assertion here honest — the moment
// there is a second way in, the suite stops driving what the installer
// drives.
test.subHeading('faceless — the exchange is the only door');
{
  if (!appThere) {
    needs('grant: faceless', 'the app must carry no HTTP surface, no page and no control panel');
  } else {
    const offenders = [];
    const stack = [path.join(REPO, APP_DIR_REL)];
    while (stack.length) {
      const p = stack.pop();
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { fs.readdirSync(p).forEach(function (n) { stack.push(path.join(p, n)); }); continue; }
      if (/\.(html|htm|css)$/i.test(p)) { offenders.push(path.relative(REPO, p) + ' (a face)'); continue; }
      if (!/\.js$/.test(p)) continue;
      const body = fs.readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Match what it DOES, not what it says — the third costume of a
      // lesson this suite family has paid for twice.
      if (/createServer\(|\.listen\(|require\(['"]https?['"]\)/.test(body)) {
        offenders.push(path.relative(REPO, p) + ' (serves)');
      }
    }
    if (!offenders.length) {
      test.check('grant: the app has no face — no page, no stylesheet, nothing that listens. The exchange is the only door, ' +
        'which is what lets this suite drive it the way join\'s installer will');
    } else {
      test.fail('grant: a face appeared on the faceless app: ' + offenders.join(', ') +
        '. Andy: "faceless, no shortcut" — and a second door means the tested path and the used path can diverge');
    }
  }
}

// ── THE EXCHANGE ITSELF ──────────────────────────────────────────────
//
// Driven as a packet, locally, which is the whole of the minimum: one
// node, one app, one exchange. No relay, no VPS, no member, no face.
(async function () {
  if (!appThere) {
    needs('grant: an install grants a name', 'a packet asks for a name, the answer carries it, and a second ask for the same name is refused');
    needs('grant: the grant is durable', 'a granted name is still granted after the app restarts, or the dataset is not a dataset');
    needs('grant: no system-face special case', 'the same exchange refuses a collision identically whoever asked — join\'s installer or a member');
    needs('grant: a local exchange goes over the wire', 'a packet, a hash and a receipt exist for an exchange whose two ends are on one node');
    test.reportSuccessFailureCount();
    return;
  }

  let ready = null;
  try { ready = await ensureMaster.ensure(); } catch (e) { ready = { foreign: true, error: String((e && e.message) || e) }; }
  if (!ready || ready.foreign) {
    test.standsDown('grant: labMaster is not this checkout\'s (' + ((ready && ready.error) || 'not reachable') +
      '), so the exchange cannot be driven against a node built from this tree. Standing down rather than ' +
      'reporting a result about code nobody is looking at');
    test.reportSuccessFailureCount();
    return;
  }

  // THE ASSERTIONS THIS WILL CARRY, named here rather than sketched in
  // code, because the exchange does not exist and a guessed driver is a
  // guessed interface:
  //
  //   a grant of a free name answers { ok: true, name, at }
  //   a second grant of the same name answers { ok: false, code:
  //     'name-already-granted', name } — and the code is the one in the
  //     catalogue, not a string that happens to match
  //   the grant SURVIVES A RESTART, asserted through the exchange rather
  //     than by reading the dataset, because the file's name was not part
  //     of the named interface and a suite that reads storage asserts an
  //     implementation instead of a promise
  //   the SAME exchange, driven by two different callers, refuses the
  //     second identically — which turns "itself first of all" from an
  //     ordering into a property of the code
  //   and A LOCAL EXCHANGE LEAVES WIRE ARTEFACTS: a packet with a hash in
  //     the node's own traffic log. Stated positively on purpose: "no
  //     local shortcut" is a negative about code that does not exist and
  //     would be GREEN on an empty tree, which is a check that cannot
  //     fail declared deliberately.
  test.fail('grant: the app folder exists and this suite has not been given the driver yet — ' +
    'the exchange is named but the assertions above are still prose. This line is here so that the ' +
    'moment the app appears, the board says the suite owes work rather than saying nothing');

  test.reportSuccessFailureCount();
}());
