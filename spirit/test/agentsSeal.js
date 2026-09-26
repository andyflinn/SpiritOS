// ---------------------------------------------------------------------------
//  agentsSeal.js — cycle-10/R7: the agents seal like everybody else.
//
//  PROVED BY CONSTRUCTION, NOT BY INSPECTING TRAFFIC, and that is the whole
//  finding: THE AGENTS APP CANNOT SEAL DIFFERENTLY BECAUSE IT DOES NOT SEAL
//  AT ALL. It composes text and hands it to the node's own door, so it
//  inherits whatever the node does and has no way to opt out.
//
//  `cycle10Pending.js` left this one undeclared with a reason — "probably
//  already true by cycle-10/R5, and needs measuring rather than declaring" —
//  so this file is that measurement. The requirement's name stays inside it
//  so it cannot leave the board by being finished.
//
//  ── WHAT WAS TRIED FIRST AND WAS WRONG ────────────────────────────────
//
//  The first plan was to read the traffic log and assert every outbound
//  agents row carried sealed bytes. spiritos-f6 measured it and it would have
//  been RED ON EVERY ROW OF A CORRECTLY SEALING NODE: trafficLog keeps the
//  PLAINTEXT payload by design (trafficLog.js:14, and cycle-10/R14 — "the
//  endpoints keep the words"), while `hash` is taken over what travelled
//  (peerPost.js:755-757, whose own comment says "MEASURED ON WHAT TRAVELS,
//  which is the sealed bytes").
//
//  So a log-reading version would have asserted the opposite of the design,
//  gone red, and sent somebody hunting a bug that was not there. Verified
//  independently before this file existed: hash-over-logged-plaintext matched
//  on none of four delivered rows, across the whole minute window.
//
//  THE FOUR CLAIMS BELOW NEED NO LOG, NO RELAY AND NO FLAG. They hold on a
//  fresh clone.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return ''; }
};

const agents = read('spirit/run/process/js/agents/agents.js');
const peerPost = read('spirit/run/js/peerPost.js');
const relayServer = read('spirit/run/js/relayServer.js');

test.startTest('cycle-10/R7 — the agents seal like everybody else');

if (!agents || !peerPost) {
  test.fail('cycle-10/R7 cannot be measured: the agents app or peerPost.js did not read');
} else {

  test.subHeading('It holds no sealing of its own');

  {
    // NOT "it does not seal wrongly" — IT HAS NOTHING TO SEAL WITH. A file
    // that encrypts nothing cannot encrypt differently, which is a stronger
    // property than agreement and needs no comparison to check.
    //
    // `crypto` IS required, so the loose search for it is not the question.
    // The question is what it is used FOR: one call, randomBytes for an id.
    const usesCipher = /createCipher|createDecipher|diffieHellman|generateKeyPair/.test(agents);
    const sealCalls = (agents.match(/\bseal\s*\(|\bseal\.\w+\s*\(/g) || []).length;
    const cryptoCalls = (agents.match(/\bcrypto\.\w+/g) || []);

    if (!usesCipher && sealCalls === 0) {
      test.check('the agents app makes no cipher and no seal call — its only use of crypto is '
        + cryptoCalls.join(', ') + ', which is an id and not a secret');
    } else {
      test.fail('THE AGENTS APP HAS SEALING OF ITS OWN: ' + sealCalls + ' seal call(s), cipher '
        + usesCipher + '. It can now disagree with the node, and this requirement is no longer '
        + 'provable by construction — it needs a comparison instead');
    }
  }

  test.subHeading('Everything it sends goes through the node door');

  {
    // THE INHERITANCE IS THE PROOF. `/api/spirit` is the node's own door, so
    // whatever peerPost does to a post happens to an agents post too. If this
    // app ever addressed a relay directly it would be a second sender with its
    // own rules, and no amount of the node behaving well would cover it.
    const doors = (agents.match(/nodeFetch\(cfg,\s*'([^']+)'/g) || [])
      .map(function (m) { return (/'([^']+)'/.exec(m) || [])[1]; });
    const postsThroughNode = doors.indexOf('/api/spirit') !== -1;
    // A relay URL would appear as a fetch that is not nodeFetch, or as an
    // https:// literal aimed somewhere other than the configured node.
    const reachesElsewhere = /fetch\(\s*['"]https?:\/\//.test(agents);

    if (postsThroughNode && !reachesElsewhere) {
      test.check('it posts through the node door and nowhere else — doors used: '
        + doors.join(', '));
    } else {
      test.fail('the agents app reaches past its node: posts through /api/spirit '
        + postsThroughNode + ', direct http fetch ' + reachesElsewhere);
    }
  }

  test.subHeading('And it does post, or the two claims above are true of nothing');

  {
    // THE PAIRED POSITIVE. "No sealing code" and "only the node door" are both
    // true of a file that never sends anything, which is the shape wsl-claude
    // named in its fourth recommendation and the third time today it has been
    // the assertion that mattered.
    const hasPost = /function post\(cfg, toKey, env/.test(agents);
    const hasSend = /function send\(cfg, to, kind, text/.test(agents);
    const postsFromSend = /\bpost\(cfg,/.test(agents);

    if (hasPost && hasSend && postsFromSend) {
      test.check('it has a send path that reaches that door, so the claims above are about '
        + 'traffic rather than about silence');
    } else {
      test.fail('the agents app may not post at all: post() ' + hasPost + ', send() '
        + hasSend + ', send reaches post ' + postsFromSend);
    }
  }

  test.subHeading('A caller cannot ask the door not to seal');

  {
    // THE LAST WAY THE INHERITANCE COULD FAIL, and the one worth naming: if
    // sealing were something a caller could switch off, "it goes through the
    // node door" would prove nothing, because the agents app could pass the
    // switch.
    //
    // It cannot. `sealsPosts` is read once, from the options a ROUTER is
    // constructed with (peerPost.js:152), never from a request body. And the
    // only place in the tree that passes false is the partner router
    // (relayServer.js:1082), which peerPost.js:1079 already records.
    //
    // TWO BYPASSES, AND THE COUNT IS THE POINT. spiritos-f6 corrected an
    // earlier version of this that asserted ONE and would have gone red on a
    // correct tree. If a third ever appears, this goes red and the
    // inheritance argument has to be re-made rather than assumed.
    const fromOptions = /var sealsPosts = opts\.sealsPosts !== false;/.test(peerPost);
    const fromBody = /body\.sealsPosts|req\.\w+\.sealsPosts/.test(peerPost);
    const bypasses = (peerPost.match(/!nodeCard\.asks\(text\) && sealsPosts/g) || []).length;
    const falseSites = (relayServer.match(/sealsPosts:\s*false/g) || []).length;

    if (fromOptions && !fromBody && bypasses === 1 && falseSites === 1) {
      test.check('sealing is a router option and not a request field, and the only '
        + 'sealsPosts:false in the tree is the partner router — so a caller through the '
        + 'node door cannot opt out, and the agents app inherits sealing whether it '
        + 'wants to or not');
    } else {
      test.fail('the seal bypass has moved: from options ' + fromOptions + ', from a body '
        + fromBody + ', bypass conditions ' + bypasses + ', sealsPosts:false sites '
        + falseSites + '. Re-read peerPost before trusting cycle-10/R7 again');
    }
  }
}

test.reportSuccessFailureCount();
