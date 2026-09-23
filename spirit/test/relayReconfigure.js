'use strict';

// spirit/test/relayReconfigure.js
// THE OWNER RESIZES HIS BOX FROM HIS OWN NODE — cycle 9.
//
//   Andy, 2026-09-22: "i want interfaces to do this remotely." —
//   "remote adjustment with possibly restart must be there, at least in
//   the core, not neccessarily in UI." — "the owner must evict before
//   shrinkage."
//
// A signed owner grant down the same wire as every other one: no door, no
// console, no credential on the box. It writes the FILE — the
// configuration is still read once at boot — and says what will apply.
//
// The three refusals are what this suite is really for: a figure past
// what the box can give, a disc figure smaller than the roll, and a RAM
// figure whose allowance is smaller than the membership. None of them
// evicts anybody.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const { sealFor, openReply } = require('./openReply');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');
const { claimOwner } = require('./ownerClaim');

// A box this suite invents: 1 GB, 900 MB of it available, 10 GB free disc.
const BOX = { totalMB: 1024, availableMB: 900, discTotalMB: 20480, discFreeMB: 10240 };

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev || !da) return;
      try { bag.push({ event: ev[1], data: JSON.parse(da[1]) }); } catch (e) { /* not this one */ }
    },
    close: function () {},
  };
}

function relayWith(config, hands) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-reconf-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const written = [];
  const restarts = [];
  const deps = Object.assign({
    config: config,
    measure: function () { return BOX; },
    writeConfig: function (next) { written.push(next); return true; },
    restart: function () { restarts.push(true); return { will: true }; },
  }, hands || {});
  const box = createRelay(home, deps);
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'rc-owner');
  // The owner's stream, because the relay's answer to an owner verb comes
  // back as the REPLY to the post that asked — there is no second channel
  // and no verb-shaped route (decision 0010).
  const heard = [];
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard));
  return { home: home, box: box, owner: owner, written: written, restarts: restarts, heard: heard };
}

// THE VERB AS THE OWNER'S NODE ACTUALLY SENDS IT — a signed post
// addressed to the relay's own key, indistinguishable on the wire from a
// post to a person (decision 0010). Nothing here reaches past that shape,
// which is the point: the reconfiguration has no door of its own.
function ask(R, body, who) {
  const from = who || R.owner;
  const relayKey = R.box.relayPublicKey();
  const packet = JSON.stringify({ app: 'relay', v: 1, body: body });
  // SEALED TO THE RELAY, like every owner verb now (cycle 10, R9), and
  // signed over the bytes that travel (cycle 10's R11).
  const sending = sealFor(from, R.box, packet);
  const out = R.box.routePost(from.publicKey, relayKey, sending,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, relayKey, sending)));
  if (!out || !out.hash) return out;
  // The answer is the REPLY to that post, on the asker's own stream.
  const reply = R.heard.filter(function (m) {
    return m.event === 'reply' && m.data && m.data.hash === out.hash;
  }).pop();
  if (!reply) return out;
  // The relay answers in the same envelope it is addressed in, so the
  // verb's answer is `body` — as it is for every other owner verb.
  try {
    // OPENED, because a relay seals its answers now (cycle 10, R5).
    const packetBack = openReply(from, relayKey, reply.data.text);
    return packetBack && packetBack.body ? packetBack.body : packetBack;
  } catch (e) { return reply.data; }
}

function member(R, name) {
  const id = auth.generateIdentity(name);
  const minted = R.box.mint('owner', name, 7, '');
  R.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, 'rc-' + name, minted.invite.token, name);
  return id;
}

test.startTest('The owner reconfigures his relay over the wire');

test.subHeading('An empty ask READS — what is set, what is running, what the box could give');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const out = ask(R, { config: {} });
  if (out && out.ok && out.onFile.ramLimitMB === 64 && out.running.allowance === 64 * 16 &&
      out.room.ramMaxMB === 875 && out.room.discMaxMB === 10240 - 1024 &&
      out.roll.members === 1 && out.roll.discUsedMB > 0) {
    test.check('the figures, the allowance they buy, the ceilings, and what is on the roll');
  } else {
    test.fail('the read is incomplete: ' + JSON.stringify(out));
  }
  if (R.written.length === 0) {
    test.check('and reading writes nothing');
  } else {
    test.fail('a read wrote the file');
  }

  // The owner can reproduce the ceiling himself, which is what lets him
  // predict a `set` instead of trying one.
  if (out.room.availableMB - out.room.ramMarginMB === out.room.ramMaxMB &&
      out.room.discFreeMB - out.room.discMarginMB === out.room.discMaxMB) {
    test.check('the raw measurement and the margins are both there, and the arithmetic checks out');
  } else {
    test.fail('the ceiling cannot be reproduced from what was reported: ' + JSON.stringify(out.room));
  }
  // 256, not half of the 1 GB box: "We never default to more than 256 MB."
  if (out.room.wouldDefaultTo.ramLimitMB === 256 && out.room.discTotalMB === 20480) {
    test.check('…and it says what "back to standard" would mean on this box today');
  } else {
    test.fail('the defaults were not reported: ' + JSON.stringify(out.room));
  }
}

{
  // The case the read exists for: a relay running on less than its file
  // asks for, because the box could not give it at boot.
  const R = relayWith({ ramLimitMB: 275, discLimitMB: 32, source: 'file', overflow: { ramAsked: 512 } });
  const out = ask(R, { config: {} });
  if (out.ok && out.onFile.ramLimitMB === 512 && out.running.ramLimitMB === 275 && out.running.clamped === true) {
    test.check('a clamped relay says both numbers, so a shrink is not mistaken for a setting');
  } else {
    test.fail('the clamp is invisible to the owner: ' + JSON.stringify(out));
  }
}

test.subHeading('A signed owner grant writes the file and says what applies');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const out = ask(R, { config: { ramLimitMB: 128, discLimitMB: 64 } });
  if (out && out.ok && out.applies === 'next start' &&
      out.after.ramLimitMB === 128 && out.after.discLimitMB === 64 &&
      out.now.ramLimitMB === 64) {
    test.check('the answer carries both figures, before and after');
  } else {
    test.fail('the grant did not take: ' + JSON.stringify(out));
  }
  if (R.written.length === 1 && R.written[0].ramLimitMB === 128) {
    test.check('and the file was written exactly once');
  } else {
    test.fail('the file was written ' + R.written.length + ' time(s)');
  }
  if (out.after.allowance === 128 * 16) {
    test.check('the answer says what the allowance will be: 16 streams a megabyte');
  } else {
    test.fail('the allowance after was ' + out.after.allowance);
  }
}

test.subHeading('The 256 MB cap is on the DEFAULT — an owner may set more');

{
  // Andy: "We never default to more than 256 MB." — "We allow adjustment
  // upward from there." So the cap never appears in this path: the only
  // bound on a figure the owner types is what the box can give.
  const R = relayWith({ ramLimitMB: 256, discLimitMB: 256, source: 'file' });
  const out = ask(R, { config: { ramLimitMB: 800, discLimitMB: 5000 } });
  if (out && out.ok && out.after.ramLimitMB === 800 && out.after.discLimitMB === 5000) {
    test.check('800 MB on a box with 875 to give is accepted — well past the default cap');
  } else {
    test.fail('an upward adjustment was refused: ' + JSON.stringify(out));
  }
}

test.subHeading('One figure at a time — the other keeps its value');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  ask(R, { config: { discLimitMB: 100 } });
  if (R.written.length === 1 && R.written[0].ramLimitMB === 64 && R.written[0].discLimitMB === 100) {
    test.check('a disc-only change leaves the RAM figure alone');
  } else {
    test.fail('an omitted key was not kept: ' + JSON.stringify(R.written));
  }
}

test.subHeading('Nobody but the owner');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const bob = member(R, 'bob');
  const out = ask(R, { config: { ramLimitMB: 512 } }, bob);
  if (!(out && out.ok && out.after)) {
    test.check('a member\'s attempt does not resize the box');
  } else {
    test.fail('a member reconfigured the relay: ' + JSON.stringify(out));
  }
  if (R.written.length === 0) {
    test.check('and nothing was written');
  } else {
    test.fail('a member\'s attempt wrote the file');
  }
}

test.subHeading('A figure past what the box can give is refused here, not at the next boot');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const out = ask(R, { config: { ramLimitMB: 4096 } });
  if (out && !out.ok && out.status === 400 && /more than this box can give/.test(out.error)) {
    test.check('4096 MB against 900 available is refused, with the reason');
  } else {
    test.fail('an impossible figure was accepted: ' + JSON.stringify(out));
  }
  if (R.written.length === 0) {
    test.check('and the file is untouched, so a restart still comes back up');
  } else {
    test.fail('a refused figure was written anyway');
  }
}

test.subHeading('A shrink that would strand members is refused — the owner evicts first');

{
  // Sixteen streams a megabyte, so 1 MB allows 16 connections. Eighteen
  // members means two could never connect.
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  for (let i = 0; i < 18; i += 1) member(R, 'm' + i);
  const out = ask(R, { config: { ramLimitMB: 1 } });
  if (out && !out.ok && out.status === 409 && /could never connect/.test(out.error) &&
      /Remove members first/.test(out.error)) {
    test.check('19 members against 16 connections is refused, and the sentence says how many');
  } else {
    test.fail('a stranding shrink was accepted: ' + JSON.stringify(out));
  }
  if (R.written.length === 0 && require('../run/js/relayStore').open(R.home).members.count() === 19) {
    test.check('nothing was written and nobody was evicted by a number');
  } else {
    test.fail('the roll or the file changed on a refused shrink');
  }

  // …and it goes through once there is room, which is the other half of
  // the rule: this is a refusal to strand, not a refusal to shrink.
  const ok = ask(R, { config: { ramLimitMB: 2 } });
  if (ok && ok.ok && ok.after.allowance === 32) {
    test.check('the same shrink to a figure that fits everybody is accepted');
  } else {
    test.fail('a safe shrink was refused: ' + JSON.stringify(ok));
  }
}

test.subHeading('A disc figure smaller than the roll is refused the same way');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const out = ask(R, { config: { discLimitMB: 0.01 } });
  if (out && !out.ok && out.status === 409 && /smaller than the roll/.test(out.error)) {
    test.check('the roll already occupies more than that, so it is refused with the measurement');
  } else {
    test.fail('an impossible disc figure was accepted: ' + JSON.stringify(out));
  }
}

test.subHeading('The restart is asked for, and only claimed when something will bring it back');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' });
  const quiet = ask(R, { config: { ramLimitMB: 128 } });
  if (quiet.ok && quiet.restarting === undefined && R.restarts.length === 0) {
    test.check('no restart unless one is asked for');
  } else {
    test.fail('the relay restarted itself: ' + JSON.stringify(quiet));
  }

  const asked = ask(R, { config: { ramLimitMB: 128, restart: true } });
  if (asked.ok && asked.restarting === true && R.restarts.length === 1) {
    test.check('`restart: true` restarts it, and the answer says so');
  } else {
    test.fail('an asked-for restart did not happen: ' + JSON.stringify(asked));
  }
}

{
  // A relay nothing would bring back — started from a shell rather than
  // by systemd. It must say so rather than going quiet on the owner.
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 32, source: 'file' }, {
    restart: function () { return { will: false, why: 'this relay was not started by systemd' }; },
  });
  const out = ask(R, { config: { ramLimitMB: 128, restart: true } });
  if (out.ok && out.restarting === false && /systemd/.test(out.restartRefused)) {
    test.check('a relay with no restarter writes the figures and says it will not come back');
  } else {
    test.fail('a hand-started relay claimed a restart: ' + JSON.stringify(out));
  }
}

test.subHeading('A relay with no configuration says so instead of pretending');

{
  const R = relayWith(null);
  const out = ask(R, { config: { ramLimitMB: 128 } });
  if (out && !out.ok && out.status === 501) {
    test.check('no config file, no reconfiguration — every in-process suite is unaffected');
  } else {
    test.fail('an unconfigured relay accepted a resize: ' + JSON.stringify(out));
  }
}

test.reportSuccessFailureCount();
