'use strict';

// spirit/test/budgetChain.js
// THE ASKER SAYS HOW LONG IT WILL WAIT, AND EVERY HOP INWARD GETS LESS.
//
//   Andy: "the relay has no business waiting for 15 seconds, if it
//   doesn't have a reply or an error in 5 seconds it's wasted time. What
//   you are saying is: your concept of diminishing timeouts down the
//   request chain is not implemented."
//   "N1 sets a limit on its patience, which gets reduced down the chain
//   by the formula you proposed." — "part of the request's
//   sidecar/envelope."
//   "we start with 5 seconds at the most. the willing to wait time in a
//   request is informational, and the next station down the chain better
//   hurry."
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────
//
// The chain was inverted and flat in the middle. A node waited 8 s, the
// relay's note about that request lived 20 s, and the relay's hop to a
// partner waited 8 s again — so the INNER hop outlived the OUTER waiter,
// and at a ceiling of one request per member that orphans a member's only
// slot for twelve seconds. Every retry in that window is refused by the
// member's own abandoned route, and the refusal is indistinguishable at
// the node from somebody else being busy.
//
// ── WHAT MAKES IT UNEXPRESSIBLE RATHER THAN FIXED ────────────────────
//
// Each hop grants `min(what it was asked for, its own ceiling)`. So a hop
// can never hold longer than the hop outside it intends to wait, whatever
// numbers anybody chooses, and however long the chain is. There is no
// ladder of constants to keep in step and no way to drift.
//
// That is the claim this file checks, at three levels: the table, the
// forward, and the wire.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const router = require('../run/js/router');
const { createRelay } = require('../run/js/relay');

// Below 49152, outside Windows' ephemeral range — see partnerWire.js.
const PORT = 48791;

let kids = [];
function cleanup() {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  kids = [];
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('The timeout budget — declared by the asker, tightening inward');

test.subHeading('The table grants, and may only ever grant less');

{
  let t = 1000;
  const R = router.createRouter({ now: function () { return t; }, ttlMs: 5000 });

  // ASKING FOR LESS GETS LESS. This is the half that makes a chain
  // possible at all: a hop that could not ask for less could not tighten.
  R.open('a', 'me', 'you', function () { return true; }, null, { ttlMs: 1000 });
  t += 1200;
  if (!R.has('a')) {
    test.check('a request that asked for 1 s is gone at 1.2 s, not held to the ceiling');
  } else {
    test.fail('an entry outlived the budget its requester declared');
  }

  // ASKING FOR MORE GETS THE CEILING. "Informational" means exactly this:
  // the number travels and buys nothing the box did not already allow.
  R.open('b', 'me', 'you', function () { return true; }, null, { ttlMs: 60000 });
  t += 5100;
  if (!R.has('b')) {
    test.check('and one that asked for a minute is gone at 5.1 s — the ceiling is the box’s');
  } else {
    test.fail('a requester bought more time than the relay allows');
  }

  // ABSENT IS NOT ZERO. A caller with no opinion gets the default.
  const quiet = R.open('c', 'me', 'other', function () { return true; });
  t += 4000;
  if (quiet.ok && R.has('c')) {
    test.check('a request that declared nothing gets the default, and is still live at 4 s');
  } else {
    test.fail('an undeclared budget was read as no budget');
  }
}

test.subHeading('A target this box can reach is simply asked');

{
  //   Andy: "the actual target may as well just answer the request. since
  //   a packet has to travel all the way back, it may as well carry good
  //   information. it is the request-originator who has to mark the
  //   incoming reply as too-late."
  //
  // The reply travels either way, so a refusal costs what an answer costs
  // and carries less. Refusing only pays when it saves a trip that has
  // not been made — which is the FORWARD decision, checked further down,
  // and not this one.
  const R = router.createRouter({ ttlMs: 5000 });
  let delivered = false;
  const thin = R.open('d', 'me', 'you', function () { delivered = true; return true; },
    null, { ttlMs: 200 });

  if (thin.ok === true && delivered) {
    test.check('a 200 ms budget is delivered, not refused — the member may well answer inside it');
  } else {
    test.fail('a short budget was refused on the target’s behalf: ' + JSON.stringify(thin));
  }

  // NO TIME AT ALL IS NOT A SHORT DEADLINE, IT IS AN EXPIRED ONE. And
  // zero is a declaration rather than an absence: reading it as "no
  // opinion" would hand it the ceiling and restart the chain at every
  // hop, which is the opposite of diminishing.
  let ran = false;
  const spent = R.open('e', 'me', 'you', function () { ran = true; return true; },
    null, { ttlMs: 0 });
  if (spent.ok === false && spent.tooLittleTime === true && !ran) {
    test.check('while an exhausted budget of zero is refused, and nothing is delivered');
  } else {
    test.fail('zero was read as absent: ' + JSON.stringify(spent) + ' ran=' + ran);
  }
}

test.subHeading('A partner is handed less than this relay has');

{
  // THE HOP ITSELF, observed by injection. `askPartner` is a dependency
  // (relay.js), so a suite can be the partner and read what it was given
  // without a second process.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bc-'));
  const seen = [];
  const box = createRelay(home, {
    askPartner: function (url, relayKey, text, budgetMs) {
      seen.push(budgetMs);
      return Promise.resolve(null);
    },
  });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx');

  const alice = auth.generateIdentity('alice');
  const minted = box.mint('owner', 'alice', 7, '');
  box.claim('alice', auth.sign(alice.privateKey, auth.claimMessage('alice')),
    alice.publicKey, 'fx-alice', minted.invite.token, 'alice');

  // A partner to aim at, and a peer that lives only there.
  const far = auth.generateIdentity('farrelay');
  const farOwner = auth.generateIdentity('farowner');
  const fminted = box.mint('owner', 'farowner', 7, '');
  box.claim('farowner', auth.sign(farOwner.privateKey, auth.claimMessage('farowner')),
    farOwner.publicKey, 'fx-far', fminted.invite.token, 'farowner');
  box.setPartner(owner, farOwner.publicKey, 'https://far.example', far.publicKey, 'h');

  const bertrand = auth.generateIdentity('bertrand');
  const text = JSON.stringify({ v: 1, body: { hello: 1 } });
  const sig = auth.sign(alice.privateKey, auth.postMessage(alice.publicKey, bertrand.publicKey, text));

  box.routePost(alice.publicKey, bertrand.publicKey, text, sig,
    { hints: [far.publicKey], hintSig: auth.sign(alice.privateKey, auth.hintMessage(sig, [far.publicKey])) },
    4000);

  if (seen.length === 1 && seen[0] < 4000 && seen[0] > 0) {
    test.check('the partner is given ' + seen[0] + ' ms of the 4000 this relay was asked for');
  } else {
    test.fail('what the partner was handed: ' + JSON.stringify(seen));
  }

  // AND THE MARGIN IS WHAT MAKES IT SAFE. The far end finishes first, so
  // this relay still has time to carry the answer back to alice.
  if (seen[0] <= 4000 - 400) {
    test.check('and the margin left is enough to carry an answer home — that is why it tightens');
  } else {
    test.fail('the partner got almost everything: ' + seen[0]);
  }
}

test.subHeading('A hop refuses before the wire when the far side could not use it');

{
  // ANDY'S QUESTION, ASKED OF THE CODE: "if the timeout is diminished to 0
  // at any point in the request chain, an error is returned immediately?"
  //
  // It was not, at first. The floor in `routes.open` guards what a box
  // GRANTS; it does not guard what the box is about to HAND ON, and those
  // differ by HOP_MARGIN_MS. So a 600 ms budget passed the local floor,
  // left 100 ms for the partner, and was refused at the far end — after a
  // round trip spent learning something computable here.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bcf-'));
  const asked = [];
  const box = createRelay(home, {
    askPartner: function (url, relayKey, text, budgetMs) {
      asked.push(budgetMs);
      return Promise.resolve(null);
    },
  });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx');
  const alice = auth.generateIdentity('alice');
  const m = box.mint('owner', 'alice', 7, '');
  box.claim('alice', auth.sign(alice.privateKey, auth.claimMessage('alice')),
    alice.publicKey, 'fx-a', m.invite.token, 'alice');
  const far = auth.generateIdentity('far');
  const fo = auth.generateIdentity('fo');
  const fm = box.mint('owner', 'fo', 7, '');
  box.claim('fo', auth.sign(fo.privateKey, auth.claimMessage('fo')),
    fo.publicKey, 'fx-f', fm.invite.token, 'fo');
  box.setPartner(owner, fo.publicKey, 'https://far.example', far.publicKey, 'h');

  function forwardWith(budget) {
    const bert = auth.generateIdentity('bert' + budget);
    const text = JSON.stringify({ v: 1, body: { hello: budget } });
    const sig = auth.sign(alice.privateKey, auth.postMessage(alice.publicKey, bert.publicKey, text));
    return box.routePost(alice.publicKey, bert.publicKey, text, sig, {
      hints: [far.publicKey],
      hintSig: auth.sign(alice.privateKey, auth.hintMessage(sig, [far.publicKey])),
    }, budget);
  }

  const thin = forwardWith(600);
  if (thin && thin.ok === false && thin.tooLittleTime === true) {
    test.check('600 ms is refused here, because 100 would be left and 100 is not enough');
  } else {
    test.fail('600 ms forward: ' + JSON.stringify(thin));
  }
  if (asked.length === 0) {
    test.check('and nothing crossed the wire to find that out');
  } else {
    test.fail('a doomed forward was sent anyway, with ' + JSON.stringify(asked));
  }

  // AND IT IS A FLOOR, NOT A FEAR. Enough is enough: what remains has
  // only to clear the far side's floor, not to be generous.
  const ok = forwardWith(800);
  if (ok && ok.status === 202 && asked.length === 1 && asked[0] === 300) {
    test.check('while 800 goes, leaving 300 — above the floor is above the floor');
  } else {
    test.fail('800 ms forward: ' + JSON.stringify(ok) + ' asked ' + JSON.stringify(asked));
  }
}

test.subHeading('And it crosses the wire, refusal and all');

async function overTheWire() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bcw-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx');
  const alice = auth.generateIdentity('alice');
  const m = box.mint('owner', 'alice', 7, '');
  box.claim('alice', auth.sign(alice.privateKey, auth.claimMessage('alice')),
    alice.publicKey, 'fx-a', m.invite.token, 'alice');

  const runDir = path.join(home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);

  const kid = spawn(process.execPath, ['js/server.js', '--port', String(PORT), '--relay'],
    { cwd: runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  let why = '';
  kid.stderr.on('data', function (b) { why += String(b); });

  const base = 'http://127.0.0.1:' + PORT;
  let up = false;
  for (let n = 0; n < 40 && !up; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) up = true;
    } catch (e) { /* not yet */ }
  }
  if (!up) {
    test.fail('the relay did not come up on ' + PORT +
      (why.trim() ? ' — it said: ' + why.trim() : ' — and said nothing on stderr'));
    cleanup();
    test.reportSuccessFailureCount();
    return;
  }

  // A budget too small to use, sent from the wire. The relay must refuse
  // it AND the marker must survive relayServer's whitelist — the trap
  // that has already eaten `busy` and `maxPerTarget` on the way through
  // this file, which is why it is checked end to end rather than in
  // memory.
  // ADDRESSED TO THE RELAY ITSELF, which is a member-legal post that
  // still opens a route — a search. Aimed at an absent peer instead, the
  // post is refused for presence (0006, "deliver or refuse, refuse
  // instantly") long before the budget is looked at, and the suite would
  // be asserting nothing about time.
  const relayKey = box.relayPublicKey();
  const text = JSON.stringify({ v: 1, body: { search: { q: 'nobody-here' } } });
  const sig = auth.sign(alice.privateKey, auth.postMessage(alice.publicKey, relayKey, text));
  const res = await hub.relayRequest(base, 'POST', '/api/relay/post', {
    from: alice.publicKey, to: relayKey, text: text, sig: sig, budgetMs: 0,
  });
  let body = {};
  try { body = JSON.parse(res.text); } catch (e) { body = {}; }

  if (res.status === 503) {
    test.check('an exhausted budget of 0 is refused over the wire');
  } else {
    test.fail('thin budget on the wire: ' + res.status + ' ' + res.text);
  }
  if (body && body.tooLittleTime === true) {
    test.check('and `tooLittleTime` survives the trip — not a bare 503 to guess at');
  } else {
    test.fail('the marker was lost on the wire: ' + JSON.stringify(body));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

overTheWire().catch(function (e) {
  test.fail('threw: ' + (e && e.stack ? e.stack : e));
  cleanup();
  test.reportSuccessFailureCount();
});
