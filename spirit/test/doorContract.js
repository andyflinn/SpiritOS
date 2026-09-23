'use strict';

// spirit/test/doorContract.js
// THE PUBLISHED DOOR MATCHES THE DOOR.
//
// `design/protocol/THE-DOOR.md` is the contract a developer in any
// language reads before writing a line — the positioning note calls the
// any-language local port our strongest differentiator and, until that
// page existed, our least documented thing.
//
// ── WHY IT IS GATED THE DAY IT IS WRITTEN ────────────────────────────
//
// Because the same document, on the same day it is published, is the one
// most likely to rot. `README.md` carried "197 bytes a member" for two
// days after cycle 10 made it 603, and it was typed by somebody who had
// measured it correctly at the time. A figure nobody re-derives is a
// claim, and this repository's whole argument is that its claims are
// checkable.
//
// So every NUMBER on that page is compared against the running tree: the
// verb count, the error count, and each limit. The page may say more than
// the tree proves — it says so itself, in "What this page does not yet
// have" — but it may not say anything the tree contradicts.
//
// WHAT THIS DOES NOT CHECK, said so nobody reads more into a green: that
// each verb behaves as described. `serverSurface.js` insists every
// claimed verb is actually posted to; this insists the published LIST is
// the real list. Neither reads the prose.
//
// ── AND IT GUARDS THE EXAMPLES, WHICH ARE THE PITCH ──────────────────
//
// 2026-09-24 closed this page's own first admitted gap: `examples/`
// holds a shell and a Python program, both exercised live against a node
// and a relay. What a suite can hold them to is their SHAPE — that they
// exist, that the page sends people to them, and that neither ever
// acquires a dependency. It cannot hold them to working, which needs a
// live node with a peer, and the page says so in its gaps rather than
// letting a green here be read as more than it is.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const limits = require('../run/js/limits');
const errors = require('../run/js/spiritErrors');

test.startTest('The door contract matches the door');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'design', 'protocol', 'THE-DOOR.md');

const page = fs.readFileSync(PAGE, 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'spirit', 'run', 'js', 'server.js'), 'utf8');

test.subHeading('Every verb the door answers is on the page, and nothing else is');

{
  const real = [...server.matchAll(/^ {4}'([a-z]+\.[a-zA-Z]+)':/gm)].map(function (m) { return m[1]; });
  const listed = [...page.matchAll(/^- `([a-z]+\.[a-zA-Z]+)`$/gm)].map(function (m) { return m[1]; });

  const missing = real.filter(function (v) { return listed.indexOf(v) === -1; });
  const phantom = listed.filter(function (v) { return real.indexOf(v) === -1; });

  if (!missing.length && !phantom.length && real.length > 0) {
    test.check('all ' + real.length + ' verbs are published, and the page invents none');
  } else {
    test.fail('undocumented: ' + (missing.join(', ') || 'none') +
      ' | on the page but not in the tree: ' + (phantom.join(', ') || 'none'));
  }

  // THE COUNT IS STATED IN PROSE TOO, and prose drifts from its own list.
  const said = /\*\*(\d+) verbs, in (\d+) families/.exec(page);
  const families = new Set(real.map(function (v) { return v.split('.')[0]; }));
  if (said && Number(said[1]) === real.length && Number(said[2]) === families.size) {
    test.check('and the sentence agrees with the list it introduces — ' +
      real.length + ' in ' + families.size + ' families');
  } else {
    test.fail('the page says ' + (said ? said[1] + '/' + said[2] : 'nothing') +
      ', the tree has ' + real.length + '/' + families.size);
  }
}

test.subHeading('Every limit on the page is the limit in the tree');

{
  // Each figure is looked up by the number as printed, so a changed
  // constant fails here rather than being discovered by a developer whose
  // packet was refused at a size the contract promised.
  const claims = [
    ['a packet you compose', limits.PLAINTEXT_MAX],
    ['the same packet on the wire', limits.PAYLOAD_MAX],
    ['the HTTP body', limits.BODY_MAX],
    ['a stream event', limits.STREAM_EVENT_MAX],
  ];
  const wrong = claims.filter(function (c) {
    const printed = Number(c[1]).toLocaleString('en-US');
    const row = new RegExp('\\|\\s*' + c[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '\\s*\\|\\s*\\*\\*' + printed.replace(/,/g, ',') + '\\s*bytes\\*\\*');
    return !row.test(page);
  });

  if (!wrong.length) {
    test.check('all four size limits are published exactly as the tree enforces them');
  } else {
    test.fail('these rows do not match the tree: ' +
      wrong.map(function (c) { return c[0] + ' should be ' + Number(c[1]).toLocaleString('en-US'); }).join('; '));
  }

  // The hint count and the in-flight rules are single figures in prose.
  const hints = new RegExp('\\*\\*' + limits.HINTS_PER_POST + '\\*\\*').test(page);
  const perTarget = /\*\*posts in flight per recipient\*\* \| \*\*1\*\*/.test(page);
  if (hints && perTarget) {
    test.check('and the hint bound and the one-inbound-route rule are stated as the tree has them');
  } else {
    test.fail('hints stated: ' + hints + ', per-recipient stated: ' + perTarget);
  }
}

test.subHeading('The error catalogue is as large as the page claims');

{
  // THE PAGE PROMISES A NUMBER a developer will plan around: how many
  // conditions are named. If the catalogue grows and the page does not,
  // the page understates what it can tell you — which is a smaller sin
  // than overstating, and still a drifted claim.
  const real = errors.all ? errors.all().length
    : (fs.readFileSync(path.join(ROOT, 'spirit', 'run', 'js', 'spiritErrors.js'), 'utf8')
      .match(/^define\(/gm) || []).length;
  const said = /\*\*(\d+) conditions are catalogued\*\*/.exec(page);

  if (said && Number(said[1]) === real) {
    test.check(real + ' conditions catalogued, and the page says ' + real);
  } else {
    test.fail('the page says ' + (said ? said[1] : 'nothing') + ', the catalogue has ' + real);
  }
}

test.subHeading('The any-language claim has examples, and they are not JavaScript');

{
  // THE PITCH IS THE EXAMPLES. "A developer in any language gets a local
  // port" was prose on this page until 2026-09-24, and the page said so
  // in its own gaps section. Two examples closed it — so what is gated
  // now is that they keep existing and keep being what they claim.
  const dir = path.join(ROOT, 'design', 'protocol', 'examples');
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { names = []; }

  const nonJs = names.filter(function (nm) { return !/\.(js|mjs|cjs|ts)$/i.test(nm); });

  if (nonJs.length >= 2) {
    test.check(nonJs.length + ' worked examples beside the page, none of them JavaScript — ' +
      nonJs.join(', '));
  } else {
    test.fail('the any-language claim has ' + nonJs.length +
      ' non-JavaScript example(s): ' + (names.join(', ') || 'the folder is empty or missing'));
  }

  // AND THE PAGE POINTS AT THEM. An example nobody is sent to is an
  // example nobody runs, and the contract is what a stranger reads.
  const unlinked = nonJs.filter(function (nm) { return page.indexOf(nm) === -1; });
  if (!unlinked.length && nonJs.length) {
    test.check('and the contract links every one of them');
  } else {
    test.fail('on disc but not linked from the page: ' + unlinked.join(', '));
  }
}

test.subHeading('THE THING ABOUT AN EXAMPLE THAT ROTS FIRST — a dependency');

{
  // Forty lines with no package is the CLAIM, not a style preference.
  // The natural improvement to `hello.py` is `import requests`, and the
  // natural improvement to `hello.sh` is a helper — and either one turns
  // "anything that can POST JSON" into "install this first", which is the
  // sentence this whole page exists to avoid. So it is asserted rather
  // than left to a reviewer's taste.
  const dir = path.join(ROOT, 'design', 'protocol', 'examples');
  const STDLIB = ['json', 'os', 'sys', 'urllib', 'urllib.request', 'urllib.error',
    'base64', 'time', 'http', 'http.client', 'argparse'];

  const offenders = [];
  let checked = 0;

  (fs.existsSync(dir) ? fs.readdirSync(dir) : []).forEach(function (nm) {
    const text = fs.readFileSync(path.join(dir, nm), 'utf8');
    checked += 1;

    if (/\.py$/i.test(nm)) {
      [...text.matchAll(/^\s*(?:import|from)\s+([A-Za-z_][\w.]*)/gm)].forEach(function (m) {
        if (STDLIB.indexOf(m[1]) === -1) offenders.push(nm + ' imports ' + m[1]);
      });
    }
    // Any example at all: no installer is ever the first step.
    if (/\b(pip|pip3)\s+install\b|\bnpm\s+i(nstall)?\b|\bapt(-get)?\s+install\b/.test(text)) {
      offenders.push(nm + ' tells the reader to install something');
    }
  });

  if (!offenders.length && checked > 0) {
    test.check('all ' + checked + ' examples run on a stock machine — no package, no installer, ' +
      'which is the claim and not a preference');
  } else {
    test.fail(checked ? offenders.join('; ') : 'no examples to check');
  }
}

test.subHeading('And the page still admits what it has not got');

{
  // A contract that lists only what it covers reads as complete. Two gaps
  // remain named, and one NEW admission replaced the closed one: the
  // examples above are held to their shape by this suite but are not RUN
  // by it, because running them needs a live node and a peer. Gating the
  // promise is not gating the proof, and the page says which it has.
  const admits = /## What this page does not yet have/.test(page) &&
    /not run by the harness/i.test(page) &&
    /Per-verb arguments/i.test(page) &&
    /\*\*A version\.\*\*/.test(page);

  if (admits) {
    test.check('the page still names its own gaps — the examples are unexercised by the harness, ' +
      'no per-verb arguments, no stated version');
  } else {
    test.fail('the "what this page does not yet have" section is gone or no longer names the gaps');
  }
}

test.reportSuccessFailureCount();
