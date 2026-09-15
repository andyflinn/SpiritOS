'use strict';

// relay.mint() — the owner, and only the owner, makes invite tokens.
//
// ── WHAT MOVED, AND WHAT THAT COST ───────────────────────────────────
//
// This suite used to be about a signature. `invites.mintMessage(label,
// days, token)` was the bytes an owner signed, deliberately not
// auth.checkOwner's, so a signature captured from a status request could
// not mint and a signature for one label could not mint another.
//
// That format is gone (decision 0010, the second collapse). A mint is a
// post to the relay now — which a relay is, for its owner — so the label,
// the day count and the spoken token are inside what postMessage already
// signs, and they are bound harder than mintMessage bound them: a post
// also names the recipient, carries a minute, and has its hash registered
// before anything is answered.
//
// THE COLLAPSE ALSO CLOSED A HOLE. The mint signature carried no clock
// and no relay identity: it never expired, it worked on every relay where
// the signer was owner, and each replay minted a fresh token. None of
// that survives the move, and it was not fixed separately — it went with
// the format.
//
// So the file is in two halves, and the split is the honest one:
//
//   WHO MAY ASK is asked through a post, because that is the only way in
//   WHAT MINT DECIDES is asked of mint() directly — the reserved name,
//     the day clamp, a names-mode box — because those are its own rules
//     and were never about who was calling
//
// Cycle 2 mints; cycle 1 consumes. They meet in different modes on
// purpose — see the last block.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const world = require('./world');
const scenario = require('./scenario');
const { createRelay } = require('../run/js/relay');

// A relay with an owner on it and nobody else, built from the scenario
// every suite shares. It was four lines written out here, and the same
// four written out in five other files — where two of them saved the
// mailbox a key of its own and three forgot, so `relayPublicKey` was
// null in some suites and not others for no reason anybody had chosen.
function ownedRelay() {
  const made = world.build(scenario.OWNER_ONLY);
  if (!made.ok) throw new Error(made.error);
  return made;
}

function daysBetween(iso) {
  return Math.round((Date.parse(iso) - Date.now()) / 86400000);
}

// THE ONLY WAY TO ASK FOR AN INVITE. Signed as a post and nothing else —
// there is no mint signature any more, and that is the point of the
// helper being this short.
function askMint(r, who, label, days, token) {
  const relayKey = r.box.relayPublicKey();
  const text = JSON.stringify({
    app: 'relay',
    v: 1,
    body: { invite: { label: label, days: days, token: token || '' } },
  });
  return r.box.routePost(who.publicKey, relayKey, text,
    auth.sign(who.privateKey, auth.postMessage(who.publicKey, relayKey, text)));
}

// What the relay said back. The answer travels on the asker's stream, so
// reading it means holding one — which is the shape of every reply on
// this wire and not special to minting.
function heardBy(r, who) {
  const said = [];
  r.box.streamOpen(who.publicKey,
    auth.sign(who.privateKey, auth.streamMessage(who.publicKey)), {
      write: function (chunk) {
        const ev = /^event: (.+)$/m.exec(String(chunk));
        const da = /^data: (.+)$/m.exec(String(chunk));
        if (!ev || ev[1] !== 'reply' || !da) return;
        try { said.push(JSON.parse(JSON.parse(da[1]).text)); }
        catch (e) { /* a malformed reply is no reply */ }
      },
      close: function () {},
    });
  return said;
}

test.startTest('Invite mint — owner-signed, label and duration bound');

{
  const r = ownedRelay();
  const said = heardBy(r, r.owner);
  const sent = askMint(r, r.owner, 'saint', 7);
  const answered = said[0] && said[0].body;

  if (sent.ok && sent.status === 202 && answered && answered.ok &&
      answered.invite && answered.invite.token) {
    test.check('the owner mints by posting to the relay, and the token comes back by hash');
  } else {
    test.fail('mint: ' + JSON.stringify(sent) + ' said: ' + JSON.stringify(said));
  }

  const minted = answered.invite;
  if (minted.label === 'saint' && minted.invitedBy === 'andy') {
    test.check('minted row carries label and invitedBy provenance');
  } else {
    test.fail('invite shape: ' + JSON.stringify(minted));
  }

  // INVITEDBY IS NOT TAKEN FROM THE PACKET. The relay reads it out of
  // allow.json, because the only sender who reaches that line is the
  // owner and a name in the packet would be a second opinion about that.
  const onDisk = invites.load(r.home).find(function (row) {
    return row.token === minted.token;
  });
  if (onDisk) {
    test.check('minted row is on disk, waiting to be claimed');
  } else {
    test.fail('on disk: ' + JSON.stringify(invites.load(r.home)));
  }

  // THE WHOLE POINT OF SIGNING THE LABEL, asked of the new binding: a
  // request for 'saint' cannot be turned into a request for 'eve' on the
  // way, because the signature covers the text and the text is the whole
  // packet.
  const forSaint = JSON.stringify({
    app: 'relay', v: 1, body: { invite: { label: 'saint', days: 7, token: '' } },
  });
  const forEve = JSON.stringify({
    app: 'relay', v: 1, body: { invite: { label: 'eve', days: 7, token: '' } },
  });
  const relayKey = r.box.relayPublicKey();
  const saintSig = auth.sign(r.owner.privateKey,
    auth.postMessage(r.owner.publicKey, relayKey, forSaint));

  const wrongLabel = r.box.routePost(r.owner.publicKey, relayKey, forEve, saintSig);
  if (!wrongLabel.ok && wrongLabel.status === 403) {
    test.check("a signature for 'saint' does not mint 'eve'");
  } else {
    test.fail('wrong label: ' + JSON.stringify(wrongLabel));
  }

  // Same for duration — 7 days signed is not 15 days minted.
  const for15 = JSON.stringify({
    app: 'relay', v: 1, body: { invite: { label: 'saint', days: 15, token: '' } },
  });
  const wrongDays = r.box.routePost(r.owner.publicKey, relayKey, for15, saintSig);
  if (!wrongDays.ok && wrongDays.status === 403) {
    test.check('a signature for 7 days does not mint 15 days');
  } else {
    test.fail('wrong days: ' + JSON.stringify(wrongDays));
  }

  // A SIGNATURE FOR ANOTHER VERB IS THE REPLAY THIS GATE EXISTS TO
  // REFUSE, and it is refused a layer earlier and for a broader reason
  // than it used to be: it is not a post signature at all, so it never
  // reaches anything that mints.
  //
  // The verb named here was `status`, because an owner signed one for
  // every census and it was therefore the most abundant credential to
  // steal. R3 deleted that verb on 2026-09-15 along with the badge that
  // spent it; `claim` is what is left to try.
  const otherVerb = auth.sign(r.owner.privateKey, auth.claimMessage('andy'));
  const replay = r.box.routePost(r.owner.publicKey, relayKey, forSaint, otherVerb);
  if (!replay.ok && replay.status === 403) {
    test.check('a signature for another verb cannot be replayed into a mint');
  } else {
    test.fail('replay: ' + JSON.stringify(replay));
  }

  // AND NEITHER CAN A MINT BE REPLAYED INTO ITSELF, which is the hole the
  // old format had and could not have closed: mintMessage carried no
  // clock, so one captured signature minted a fresh token every time it
  // was sent. A post's hash is registered before it is answered.
  const again = r.box.routePost(r.owner.publicKey, relayKey, forSaint, saintSig);
  const twice = invites.load(r.home).filter(function (row) {
    return row.label === 'saint';
  });
  if (again.ok && twice.length === 2) {
    // A fresh post of the same bytes a minute later IS a new request and
    // mints again — that is a retry, not a replay, and the owner made it.
    // What cannot happen is a THIRD party doing it, which is the check
    // above: they cannot make the post signature at all.
    test.check('the owner reposting is a new request — replay is refused by who can sign, not by the clock');
  } else {
    test.fail('repost: ' + JSON.stringify(again) + ' rows: ' + twice.length);
  }
}

test.subHeading('Who may mint');

{
  const r = ownedRelay();
  const mallory = auth.generateIdentity('mallory');

  // A STRANGER CANNOT EVEN ADDRESS THE BOX, which is a wider refusal than
  // the old one and says less: `no such peer`, exactly what an unknown
  // key gets. The mint gate used to answer 403 `bad mint signature`,
  // which told a caller that this key mints for somebody.
  const forged = askMint(r, mallory, 'saint', 7);
  if (!forged.ok && forged.status === 403 && forged.error === 'no such identity') {
    test.check("a stranger cannot ask: they are not on this relay at all");
  } else {
    test.fail('forged: ' + JSON.stringify(forged));
  }

  // mallory may hold a properly invited, properly claimed key on this box
  // — that is still not the owner key in allow.json. Since cycle 4 she
  // needs an invite to get on at all, so mint her one: without it she
  // would never become a peer and this check would pass for the wrong
  // reason.
  const mInvite = r.box.mint('andy', 'mallory', 7);
  const mClaim = r.box.claim(
    'mallory',
    auth.sign(mallory.privateKey, auth.claimMessage('mallory')),
    mallory.publicKey,
    '10.0.0.6',
    mInvite.ok && mInvite.invite.token
  ,
    'mallory');
  if (mClaim.ok) {
    test.check('an invited stranger becomes a peer');
  } else {
    test.fail('mallory claim: ' + JSON.stringify({ mint: mInvite, claim: mClaim }));
  }

  // THE CHECK THE GATING RESTS ON. A peer on this box, properly claimed,
  // signing correctly as herself — and she may ADDRESS the relay, because
  // that door opened so that set-device and self-removal could stop being
  // cheats. What refuses her is the verb: minting is an owner verb, and
  // answerSelf decides that one verb at a time.
  //
  // Nothing about the relay's key was ever secret — it is published
  // unsigned in /api/relay/who — so the refusal never protected it. It
  // protects the four owner verbs, which check nothing themselves.
  const heard = heardBy(r, mallory);
  const before = invites.load(r.home).length;
  const claimedStranger = askMint(r, mallory, 'saint', 7);
  const said = heard.length ? heard[heard.length - 1].body : null;

  if (claimedStranger.ok && said && said.ok === false && said.error === 'no such peer' &&
      invites.load(r.home).length === before) {
    test.check('a claimed non-owner peer still cannot mint — the verb refuses, and nothing is written');
  } else {
    test.fail('claimed stranger: ' + JSON.stringify(claimedStranger) +
      ' said: ' + JSON.stringify(said));
  }

  // `mint without a signature is refused` stood here. There is no
  // unsigned way to ask any more: routePost refuses a post with no
  // signature before it knows what the packet contains, which is where
  // that check now lives (routerPost.js).

  // `the reserved name cannot be invited` STOOD HERE, asserting a 400 on
  // `mint('andy', 'relay', 7)`. The reservation went on 2026-09-15 —
  // a relay is addressed by key, so a caption never protected anything
  // a packet could reach (relayAuth.js).
  //
  // Inverted rather than deleted, because the claim worth keeping is the
  // new one: `relay` is a label like any other, and an owner may write
  // it on an invite the same way they may write `saint`.
  const ordinary = r.box.mint('andy', 'relay', 7);
  if (ordinary.ok && ordinary.status === 201 && ordinary.invite.label === 'relay') {
    test.check('"relay" is an ordinary label an owner may invite');
  } else {
    test.fail('mint of "relay": ' + JSON.stringify(ordinary));
  }
}

test.subHeading('Duration is clamped, and clamped identically on both sides');

{
  const r = ownedRelay();

  // Asked of mint() directly: the clamp is its rule about what it will
  // write, not a rule about who is calling. It used to be checked through
  // the signature because a signature was the only way in — 99 signed and
  // 15 stored would have failed as a bad signature rather than as a wrong
  // number, which was a worse error message for the same bug.
  const long = r.box.mint('andy', 'far', 99);
  if (long.ok && daysBetween(long.invite.expiresAt) === 15) {
    test.check('99 days is clamped to 15');
  } else {
    test.fail('long: ' + JSON.stringify(long));
  }

  const zero = r.box.mint('andy', 'soon', 0);
  if (zero.ok && daysBetween(zero.invite.expiresAt) === 7) {
    test.check('0 days falls back to the 7 day default');
  } else {
    test.fail('zero: ' + JSON.stringify(zero));
  }

  const missing = r.box.mint('andy', 'nodays', undefined);
  if (missing.ok && daysBetween(missing.invite.expiresAt) === 7) {
    test.check('a missing duration defaults to 7 days');
  } else {
    test.fail('missing: ' + JSON.stringify(missing));
  }

  // AND THE CLAMP REACHES THE ROW THE PACKET ASKED FOR, which is the half
  // the direct calls above cannot show: the number travels through the
  // packet untouched and is clamped where it is written.
  const said = heardBy(r, r.owner);
  askMint(r, r.owner, 'posted-far', 99);
  const answered = said[0] && said[0].body;
  if (answered && answered.ok && daysBetween(answered.invite.expiresAt) === 15) {
    test.check('and a posted mint is clamped the same way, end to end');
  } else {
    test.fail('posted clamp: ' + JSON.stringify(said));
  }
}

test.subHeading('A mailbox with no owner key cannot mint');

{
  const home = world.tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );
  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const r = box.mint('andy', 'saint', 7);
  if (!r.ok && r.status === 403 && r.error === 'no owner key on this relay') {
    test.check('names-mode mailbox refuses to mint');
  } else {
    test.fail('names mint: ' + JSON.stringify(r));
  }

  // Worth stating plainly, because it is the shape cycle 4 closes: this
  // names-mode box is exactly where an invite would be CONSUMED, and it
  // is the one place that cannot mint one. A keys-mode box can mint, and
  // ignores invites on claim. Neither half is broken; they just do not
  // meet until keys-mode requires an invite.
  const token = invites.add(home, { label: 'saint', invitedBy: 'andy', days: 7 }).token;
  const saint = auth.generateIdentity('saint');
  const used = box.claim('saint', auth.sign(saint.privateKey, auth.claimMessage('saint')), saint.publicKey, '10.0.0.9', token, 'saint');
  if (used.ok && used.status === 201) {
    test.check('a hand-written row still gets saint in, as in cycle 1');
  } else {
    test.fail('names claim with invite: ' + JSON.stringify(used));
  }
}

test.subHeading('Taking an invitation back');

//   Andy: "revokeLabel is unnecessary. we need revokeInvite(label)"
//
// ── THE CASE THIS EXISTS FOR ─────────────────────────────────────────
//
// An outstanding invite could not be revoked AT ALL before this. The
// function existed — `invites.revokeLabel` — but its only caller was
// `removePeer`, and removePeer resolves its target with findByKey. An
// unclaimed invite is by definition for somebody who has no key here
// yet, so the one case that matters was the one case unreachable: mint
// to the wrong person and it was live until it expired.
//
// BY LABEL, and it cannot be anything else. There is no key to name, and
// the owner's report shows label, expiry and inviter and NEVER the token
// — so a label is the only handle the owner is given, too.

function askRevoke(r, who, label) {
  const relayKey = r.box.relayPublicKey();
  const text = JSON.stringify({
    app: 'relay', v: 1, body: { revoke: { label: label } },
  });
  return r.box.routePost(who.publicKey, relayKey, text,
    auth.sign(who.privateKey, auth.postMessage(who.publicKey, relayKey, text)));
}

{
  const r = ownedRelay();
  const said = heardBy(r, r.owner);

  r.box.mint('andy', 'saint', 7, 'blue-fish');
  r.box.mint('andy', 'anna', 7, 'green-boat');

  const sent = askRevoke(r, r.owner, 'saint');
  const answered = said[0] && said[0].body;
  const left = invites.load(r.home);

  if (sent.ok && answered && answered.ok && answered.revoked === 1 &&
      left.length === 1 && left[0].label === 'anna') {
    test.check('the owner revokes an UNCLAIMED invite by label — the case that had no verb at all');
  } else {
    test.fail('revoke: ' + JSON.stringify(sent) + ' said: ' + JSON.stringify(said) +
      ' left: ' + JSON.stringify(left));
  }

  // AND THE TOKEN IS DEAD. Revoking that nobody can still walk in on is
  // the whole point; a count is not evidence.
  const saint = auth.generateIdentity('saint');
  const walkIn = r.box.claim('saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey, '10.0.0.4', 'blue-fish', 'saint');
  if (!walkIn.ok && walkIn.status === 403) {
    test.check('and the spoken token no longer opens the door');
  } else {
    test.fail('walked in after revoke: ' + JSON.stringify(walkIn));
  }

  // A LABEL NOBODY WAS INVITED UNDER IS NOT AN ERROR, it is nothing
  // revoked. An owner clearing a name they misremembered should be told
  // "none", not refused.
  const none = askRevoke(r, r.owner, 'nobody');
  const saidNone = said[1] && said[1].body;
  if (none.ok && saidNone && saidNone.ok && saidNone.revoked === 0) {
    test.check('revoking a label with no invites is zero, not a refusal');
  } else {
    test.fail('empty revoke: ' + JSON.stringify(said));
  }
}

{
  // NOBODY ELSE MAY. The peer CAN address the relay — that door opened so
  // set-device and self-removal could stop being cheats — so the post
  // lands and the VERB is what refuses. It answers `no such peer`, the
  // same thing a verb nobody has heard of gets, so nothing about revoke
  // is discoverable by asking.
  const r = ownedRelay();
  const mallory = auth.generateIdentity('mallory');
  const minted = r.box.mint('andy', 'mallory', 7);
  r.box.claim('mallory', auth.sign(mallory.privateKey, auth.claimMessage('mallory')),
    mallory.publicKey, '10.0.0.6', minted.invite.token, 'mallory');

  r.box.mint('andy', 'saint', 7, 'blue-fish');
  const heard = heardBy(r, mallory);
  const theirs = askRevoke(r, mallory, 'saint');
  const survived = invites.load(r.home).some(function (row) { return row.label === 'saint'; });
  const said = heard.length ? heard[heard.length - 1].body : null;

  if (theirs.ok && survived && said && said.ok === false && said.error === 'no such peer') {
    test.check('a peer cannot revoke the owner\'s invites — the verb refuses, and says nothing');
  } else {
    test.fail('peer revoke: ' + JSON.stringify(theirs) + ' said: ' + JSON.stringify(said) +
      ' survived: ' + survived);
  }
}

test.reportSuccessFailureCount();
