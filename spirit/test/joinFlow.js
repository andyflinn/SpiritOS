'use strict';

// spirit/test/joinFlow.js
// CYCLE 12 — THE ENROLMENT SITE, ASSERTED FROM THE DOCUMENT.
//
//   Andy: "the real first try" of the working agreement.
//
// Written by wsl-claude from design/cycles/2026-09-24-join-cycle-12.md
// and from nothing else: the Windows Claude owns the source and neither
// of us reads the other until the close. A suite written from an
// implementation can only describe it.
//
// MOST OF THIS IS DECLARED RATHER THAN ASSERTED, because `join/` does not
// exist yet and a test written before the code cannot test behaviour — it
// tests presence (ANDYS_RULES_FOR_AGENTS.md, the SOP). Each declaration
// names the unit that would make it real and what the guess counts.
//
// TWO THINGS CAN BE ASSERTED TODAY AND ARE, because they are about what
// this cycle promises NOT to do, and a promise nobody checks is a wish:
// the relay is not touched, and the claim route is not touched. Those two
// are green now and turn red the moment either stops being true, which is
// the only way a "no change" requirement can be held.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const OPENED_AT = '5cd0b12';   // the commit the cycle document measured
const JOIN = path.join(REPO, 'join');

function atOpening(rel) {
  try {
    return String(execFileSync('git', ['-C', REPO, 'show', OPENED_AT + ':' + rel], { encoding: 'utf8' }));
  } catch (e) { return null; }
}

function now(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return null; }
}

function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'relay-state' || e.name === 'node_modules' || e.name === '.git') return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    });
  }(dir));
  return out;
}

const joinExists = fs.existsSync(JOIN);

test.startTest('Cycle 12 — the enrolment site, from the document');

// ── WHAT THE CYCLE PROMISES NOT TO DO ────────────────────────────────
//
// "No relay change. A cycle-12 commit touching relay.js is a signal that
// something was mis-designed, not progress." That is the strongest claim
// in the document — the whole architecture rests on the relay already
// being enough — and nothing was asserting it.
test.subHeading('cycle 12 R6 and its own "what this cycle does not do" — the relay is not touched');
[['spirit/run/js/relay.js', 'the relay'],
 ['spirit/run/js/relayServer.js', 'the relay door']].forEach(function (pair) {
  const was = atOpening(pair[0]);
  const is = now(pair[0]);
  if (was === null) {
    test.fail('could not read ' + pair[0] + ' at ' + OPENED_AT + ' — this guard cannot see what it guards');
  } else if (was === is) {
    test.check(pair[1] + ' is byte-identical to ' + OPENED_AT + ' — ' + pair[0]);
  } else {
    test.fail(pair[1] + ' CHANGED during cycle 12 (' + pair[0] + '). The document calls that "a signal that ' +
      'something was mis-designed, not progress" — read the diff before reading this suite');
  }
});

// cycle 12 R10 says the claim route is unchanged and only the SCREEN moves. The
// route is the thing a stranger's node talks to, so it is asserted apart
// from the rest of the relay: a screen change that quietly needed a route
// change is exactly what this catches.
test.subHeading('cycle 12 R10 — the claim route is untouched; only the screen collapses');
{
  const was = atOpening('spirit/run/js/relayServer.js');
  const claimNow = now('spirit/run/js/relayServer.js');
  const route = /\/api\/relay\/claim/;
  if (was && claimNow && route.test(was) && route.test(claimNow)) {
    test.check('/api/relay/claim exists at the opening commit and still exists — a screen change that needed a route change would show here');
  } else {
    test.fail('the claim route is not where the document says it is');
  }
}

// ── cycle 12 R1 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 12 R1 — join/ exists, is publishable, and carries no credential');
if (!joinExists) {
  test.awaiting('cycle-12/R1', 'the join/ directory', false,
    'join/ exists in the repository, nothing in it is a secret, and .gitignore does not exclude it',
    { there: 0, cost: 'the directory and its first file; nothing of it exists at ' + OPENED_AT });
} else {
  const files = filesUnder(JOIN);
  test.check('join/ exists — ' + files.length + ' file(s) outside relay-state/');

  // A CREDENTIAL-SHAPED LITERAL, named by shape rather than by name,
  // because a secret does not announce itself in a variable called
  // secret. GitHub's own formats are the ones this site can hold.
  const shapes = [
    [/\bgh[pousr]_[A-Za-z0-9]{16,}/, 'a GitHub token'],
    [/\b[0-9a-f]{40}\b/, 'a 40-character hex string (an OAuth client secret)'],
    [/client_secret\s*[:=]\s*['"][^'"]{8,}/i, 'an inline client_secret'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  ];
  const caught = [];
  files.forEach(function (f) {
    let text = '';
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
    shapes.forEach(function (s) {
      if (s[0].test(text)) caught.push(path.relative(REPO, f) + ': ' + s[1]);
    });
  });
  if (!caught.length) {
    test.check('and no file under join/ carries a credential-shaped literal — four shapes searched for');
  } else {
    test.fail('a credential is in the tree: ' + caught.join('; '));
  }

  const ignore = now('.gitignore') || '';
  if (!/^\s*join\/?\s*$/m.test(ignore)) {
    test.check('and .gitignore does not exclude join/ — it is publishable, which is the point of it holding nothing');
  } else {
    test.fail('.gitignore excludes join/, so the site cannot be published from this repository');
  }
}

// ── cycle 12 R2, R3 ────────────────────────────────────────────────────────────
test.subHeading('cycle 12 R2 and R3 — an ordinary member, and one identity provider');
test.awaiting('cycle-12/R2', 'the site node configuration under join/', joinExists,
  'the site is a member of spirit with no owner key and no relay-side privilege, and reaches only its own loopback door',
  { there: 0, cost: 'a node client and its configuration; the relay side already exists and is not touched' });
test.awaiting('cycle-12/R3', 'the sign-in flow under join/', joinExists,
  'one identity provider and no field anywhere that collects an address',
  { there: 0, cost: 'the sign-in page and its redirect; no mail sender exists to remove' });

// ── cycle 12 R4 — the security claim of the whole design ───────────────────────
//
// THE DOCUMENT ASKS A QUESTION HERE RATHER THAN STATING A FACT: "whether
// this can be asserted positively rather than by absence is an open
// question this cycle must answer, not assume." So this declaration says
// what the ABSENCE test is, and records that absence is the weaker of the
// two — a site that never exchanges a code looks exactly like a site
// whose exchange nobody has written yet.
test.subHeading('cycle 12 R4 — the site holds a code it cannot spend');
test.awaiting('cycle-12/R4', 'the join/ code path that receives and forwards without exchanging', joinExists,
  'no exchange request exists in join/, and the code leaves only as a peer.post payload',
  { there: 0, cost: 'the receive handler and the post; the assertion is a search for an exchange that is not there, ' +
    'and the document itself asks whether absence is enough — a positive assertion would need the site to REFUSE ' +
    'an exchange it is asked to make, which is a different thing to build' });

// ── cycle 12 R5 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 12 R5 — signed and sealed, and a stranger is not acted on');
test.awaiting('cycle-12/R5', 'the site posting the code to Andy node', joinExists,
  'the post is sealed and signed, the relay carries ciphertext, and a post from an unknown key is not acted on',
  { there: 60, cost: 'sealing, signing and the refusal of an unknown sender all exist in the node (cycle 10 R4, R5, R11); ' +
    'missing is the site calling them and the minting program checking WHICH key posted' });

// ── cycle 12 R6, R7, R8 ────────────────────────────────────────────────────────
test.subHeading('cycle 12 R6, R7, R8 — the minting program, refusal when asleep, and the off switch');
test.awaiting('cycle-12/R6', 'the minting program on Andy node', joinExists,
  'it calls net.fetch and the owner verb and nothing else, carrying the same redirect_uri and client_id to the exchange',
  { there: 50, cost: 'net.fetch under the proxy gate exists (server.js) and the owner mint verb exists (relay.js); ' +
    'missing is the program that joins them and the seat policy between' });
test.awaiting('cycle-12/R7', 'the refusal path when Andy node is unreachable', joinExists,
  'the visitor gets a refusal naming what to do, and nothing durable holds the code afterwards',
  { there: 0, cost: 'a refusal page and the proof that no queue, cache or log retains the code — the second half is ' +
    'the harder one and is what makes this a requirement rather than a message' });
test.awaiting('cycle-12/R8', 'the proxy gate shipping closed', joinExists,
  'with the host absent from proxy.json the mint path refuses, and proxyList.remove() is the only action needed',
  { there: 70, cost: 'the gate and proxyList.remove() exist and are tested; missing is join/ shipping with the host ' +
    'ABSENT by default and a test that opens it deliberately' });

// ── cycle 12 R9, R11 — what a stranger is shown ────────────────────────────────
test.subHeading('cycle 12 R9 and R11 — what a stranger sees, and what is admitted to them');
test.awaiting('cycle-12/R9', 'the visitor-facing page for a full relay', joinExists,
  'a mint refused for capacity offers the other door and shows none of the relay internal figures',
  { there: 40, cost: 'the relay already refuses with 507 and a sentence (relay.js); missing is the page that turns it ' +
    'into a door a stranger can walk through, and the check that the figures do NOT cross' });
test.awaiting('cycle-12/R11', 'the sentence on the page that admits the link', joinExists,
  'the page says that a GitHub account is linked to a node key, and nothing else about a visitor is durable',
  { there: 0, cost: 'one sentence of copy, and the search that proves nothing else about a visitor is written — the ' +
    'sentence is cheap and the search is the requirement' });

// ── C1, C2 — conditions, recorded so they cannot be forgotten ─────────
test.subHeading('cycle 12 C1 and C2 — conditions this cycle found and did not promise');
test.awaiting('cycle-12/C1', 'the second box hardened', false,
  'the site VPS has 600/700 on everything, a loopback node door with only 443 open, a synced clock and Restart=always',
  { there: 0, cost: 'not cycle-12 code at all — it is between join working and join being live, and the clock matters ' +
    'because OAuth expiry depends on it' });
test.awaiting('cycle-12/C2', 'the seat policy in Andy minting program', joinExists,
  'no account-age gate today, and the relay record is the instrument that says when to tighten',
  { there: 30, cost: 'the record exists and answers (cycle 11); missing is the policy that reads it, which lives on ' +
    'his box so tightening needs no redeploy' });

test.reportSuccessFailureCount();
