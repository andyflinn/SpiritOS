'use strict';

// spirit/test/agentsOutbox.js
// A QUEUED REPORT IS DESTROYED ONLY BY A REFUSAL THE NEXT FLUSH CANNOT FIX.
//
//   The plan, in Andy's words: "your node down: the program keeps the
//   reports and sends them when your node is back."
//
// ── WHY THIS SUITE EXISTS ────────────────────────────────────────────
//
// `flushReports` had NO coverage at all — found while testing the card
// fetch — and it is the one function in the agents app that DELETES
// something. Every other failure there costs a retry; this one costs the
// report.
//
// ── THE DEFECT IT WAS WRITTEN FOR ────────────────────────────────────
//
// The drop rule (agents.js:351) asks the catalogue whether waiting can
// help, and drops when the answer is no. That was RIGHT when it was
// written: `no-cipher-key` meant "nothing in this tree can ever obtain
// that card", because the card ask had no caller — the defect wsl-claude
// found and spiritos-f6 fixed at 780426a.
//
// THE FIX CHANGED WHAT THE REFUSAL MEANS. Since 780426a a post to an
// uncarded peer ASKS for the card first, so 428 no longer means "never".
// It means "the ask went unanswered THIS TIME" — the owner node was
// offline, or the answer missed the bounded wait — and the next flush,
// when the owner is back, succeeds. The catalogue still says retry 'no',
// so the drop rule now deletes reports that would have been delivered.
//
// Neither agent did anything wrong and neither could have seen it alone:
// the drop rule is wsl-claude's, the fetch is spiritos-f6's, and the
// defect is only in the JOIN. It is the reason the tester reads the
// implementor's commit rather than only its tests.
//
// THE ASSERTIONS ARE ABOUT THE OUTCOME, NOT THE MECHANISM — a report
// survives, or it does not. Whether that is fixed in the catalogue
// (`retry` for `no-cipher-key`) or in the drop rule is Andy's to rule,
// and either fix turns C2 green without touching this file.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const agents = require('../run/process/js/agents/agents.js');

test.startTest('The agents outbox keeps a report that waiting could still deliver');

// A response shaped like the one `post` unwraps: a status and a `text()`
// that answers a promise. Getting this wrong is how the first draft of
// this suite reported "retained" for a row the rule had never judged —
// `r.text()` threw, the catch kept the row, and the green meant nothing.
function fetchLike(status, errText) {
  return function () {
    return Promise.resolve({
      status: status,
      text: function () { return Promise.resolve(JSON.stringify({ error: errText })); },
    });
  };
}

function withQueue(n) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-outbox-'));
  const cfg = agents.config({
    AGENTS_NODE: 'http://127.0.0.1:1', AGENTS_ROOT: root,
    AGENTS_SELF: 'wsl-claude', AGENTS_CONTROL: 'CONTROLKEY',
  });
  const outbox = path.join(root, 'relay-state', 'agents-outbox.jsonl');
  fs.mkdirSync(path.dirname(outbox), { recursive: true });
  const rows = [];
  for (let i = 1; i <= n; i += 1) rows.push(JSON.stringify({ line: 'report ' + i }));
  fs.writeFileSync(outbox, rows.join('\n') + '\n');
  return {
    cfg: cfg,
    left: function () {
      return fs.readFileSync(outbox, 'utf8').split('\n').filter(Boolean).length;
    },
  };
}

function flushAgainst(status, errText, n) {
  const q = withQueue(n || 3);
  return agents.flushReports(q.cfg, fetchLike(status, errText), 'OWNKEY')
    .then(function (sent) { return { sent: sent, left: q.left(), of: n || 3 }; });
}

(async function () {
  // ── C1: THE PROMISE ANDY WAS GIVEN ─────────────────────────────────
  {
    const r = await flushAgainst(503, 'peer not reachable');
    if (r.left === r.of) {
      test.check('a report refused because the node is unreachable is KEPT, all ' + r.of
        + ' of them — "your node down: the program keeps the reports and sends them when '
        + 'your node is back"');
    } else {
      test.fail('only ' + r.left + ' of ' + r.of + ' survived an unreachable node');
    }
  }

  // ── C2: THE DEFECT ─────────────────────────────────────────────────
  {
    const r = await flushAgainst(428, 'no cipher key for that peer — ask for their card first');
    if (r.left === r.of) {
      test.check('a report refused for a missing card is KEPT — since 780426a the card is '
        + 'asked for automatically, so this refusal means the ask went unanswered THIS TIME '
        + 'and the next flush can still deliver');
    } else {
      test.fail('ALL ' + (r.of - r.left) + ' OF ' + r.of + ' REPORTS WERE PERMANENTLY '
        + 'DESTROYED. An agent node that does not yet hold the owner\'s card, flushing while '
        + 'the owner is offline, deletes its whole queue — the exact case the queue exists '
        + 'for. The refusal was permanent before 780426a gave the card ask a caller; it is '
        + 'transient now, and the catalogue still says retry "no" (spiritErrors.js:451), '
        + 'which agents.js:351 obeys. The words are in the traffic log; the report is not '
        + 'delivered and never will be');
    }
  }

  // ── C3: THE CONTROL — THE DROP RULE MUST STILL DROP ────────────────
  //
  // Without this, deleting the rule outright would turn C2 green and the
  // suite would be cover for the 11,628-refusal storm coming back. A
  // packet that is too long is too long on every retry: no amount of
  // waiting shortens it, and re-posting it forever is what this rule was
  // built to stop.
  {
    const r = await flushAgainst(413, 'packet too long');
    if (r.left === 0) {
      test.check('a report refused as too long is DROPPED — waiting cannot shorten a packet, '
        + 'and re-posting it forever is the storm the drop rule exists to stop');
    } else {
      test.fail(r.left + ' of ' + r.of + ' permanently-undeliverable reports were kept, so '
        + 'the outbox will re-post them forever');
    }
  }

  // ── C4: AND SILENCE IS STILL NOT A RULING ──────────────────────────
  //
  // `unknown` carries retry 'no' while its own note says it "deliberately
  // claims nothing". Guarded at agents.js:351 already; asserted here so a
  // later simplification of that condition cannot quietly remove it.
  {
    const r = await flushAgainst(418, 'a refusal nobody has catalogued');
    if (r.left === r.of) {
      test.check('a refusal the catalogue does not recognise is KEPT — `unknown` carries '
        + 'retry "no" while claiming nothing, so reading its silence as a ruling would '
        + 'discard every unrecognised failure, including transient ones');
    } else {
      test.fail('an uncatalogued refusal dropped ' + (r.of - r.left) + ' report(s): silence '
        + 'was read as a ruling');
    }
  }

  test.reportSuccessFailureCount();
}());
