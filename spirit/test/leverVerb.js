'use strict';

// spirit/test/leverVerb.js
// THE OWNER MOVES A LEVER, AND NOBODY ELSE DOES.
//
//   Andy: "the only real-time tool the owner gets while node and relay
//   are running: injecting foreign partners." — and, from cycle 4,
//   moving a lever.
//   Andy: "a setting below the present count closes streams... only the
//   owner and posts in flight are spared."
//
// What this asserts is not that a field changed. It is the four things
// the owner is entitled to: that a member cannot move his programme and
// cannot tell the verb exists; that a refusal says WHY in the relay's
// own words; that a setting below the present count carries out the
// remedy and reports what it cost; and that `dynamic` hands the lever
// back to the Governor.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

// A relay with a Governor: ramLimitMB is what gives it one at all.
function relayWith(tag, memberNames, ramLimitMB) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-lever-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);

  // A relay has a Governor only when it is HANDED a configuration
  // (relay.js:422-423). relayServer.js is what reads
  // relay-state/config.json and passes it in; in process a suite passes
  // it directly, which is also why every other in-process suite has no
  // Governor and behaves as it did before cycle 1.
  // `settable` IS A DEP NOW, NOT PART OF THE CONFIG (Andy, 2026-09-20:
  // "lets revoke the owner's grant, because the code needs to decide what
  // is settable... a software decision, not an owner's decision"). It
  // moved out of `config` because that is a file on the box which its
  // owner writes; `deps` is what the caller passes, and here the caller
  // is this suite. relayServer.js passes none, which settableCensus.js
  // checks — so these seventeen checks prove the owner verb works without
  // any relay in the world having a lever to point it at.
  const box = createRelay(home, {
    config: { ramLimitMB: ramLimitMB || 32 },
    settable: ['connections1'],
  });
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)),
    owner.publicKey);

  const members = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    members[name] = id;
  });

  return { home: home, box: box, owner: owner, members: members };
}

// Collects what a held stream was sent, the way sseClient would parse it.
function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () { bag.closed = true; },
  };
}

// A signed post, exactly as one arrives off the wire.
function post(box, from, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)));
}

function lastReply(bag) {
  const replies = bag.filter(function (m) { return m.event === 'reply'; });
  if (!replies.length) return null;
  let parsed = null;
  try { parsed = JSON.parse(replies[replies.length - 1].data.text); }
  catch (e) { return null; }
  return (parsed && parsed.body) || null;
}

test.startTest('The lever verb — the owner moves it, and nobody else');

function run() {
  const R = relayWith('a', ['mia', 'nils'], 32);
  const relayKey = R.box.relayPublicKey();

  // Sinks, so the relay can answer and so there is something to close.
  const bags = {};
  function open(id, ident) {
    bags[id] = [];
    R.box.streamOpen(ident.publicKey,
      auth.sign(ident.privateKey, auth.streamMessage(ident.publicKey)),
      sinkFor(bags[id]));
  }
  open('owner', R.owner);
  open('mia', R.members.mia);
  open('nils', R.members.nils);

  test.subHeading('A member cannot move the programme, and cannot learn the verb exists');

  post(R.box, R.members.mia, relayKey, { lever: { name: 'connections1', set: 4 } });
  const memberAnswer = lastReply(bags.mia);
  if (memberAnswer && memberAnswer.error === 'no such peer') {
    test.check('refused with `no such peer` — the same answer an unknown verb gets');
  } else {
    test.fail('a member got: ' + JSON.stringify(memberAnswer));
  }

  test.subHeading('The owner is refused with a reason he can act on');

  [
    [{ name: 'conn_1', set: 4 }, 'not a lever name', 'a name the rule refuses'],
    [{ name: 'nosuch1', set: 4 }, 'no such lever', 'a lever this relay does not have'],
    [{ name: 'connections1', set: 0 }, 'floor', 'below the floor'],
    [{ name: 'connections1', set: 999999 }, 'ceiling', 'above the ceiling'],
    [{ name: 'connections1', set: 'seven' }, 'whole number', 'not a number at all']
  ].forEach(function (c) {
    post(R.box, R.owner, relayKey, { lever: c[0] });
    const a = lastReply(bags.owner);
    if (a && a.ok === false && String(a.error || '').indexOf(c[1]) !== -1) {
      test.check('refused, ' + c[2] + ': ' + a.error);
    } else {
      test.fail(c[2] + ' gave ' + JSON.stringify(a));
    }
  });

  test.subHeading('A good setting moves it, records the owner, and reports');

  post(R.box, R.owner, relayKey, { lever: { name: 'connections1', set: 6 } });
  const ok = lastReply(bags.owner);
  if (ok && ok.ok === true && ok.to === 6) {
    test.check('the relay says what it set');
  } else {
    test.fail('a good setting answered ' + JSON.stringify(ok));
  }

  const statuses = bags.owner.filter(function (m) { return m.event === 'relay-status'; });
  const report = statuses.length ? statuses[statuses.length - 1].data : null;
  const lev = report && report.levers && report.levers.connections1;

  if (lev && lev.value === 6) {
    test.check('and a report follows, carrying the new value');
  } else {
    test.fail('no report, or the wrong value: ' + JSON.stringify(lev));
  }
  if (lev && lev.lastMove && lev.lastMove.by === 'owner' && lev.lastMove.why === 'set by owner') {
    test.check('attributed to the owner — which is how he tells his move from the programme’s');
  } else {
    test.fail('the move was not attributed: ' + JSON.stringify(lev && lev.lastMove));
  }
  if (lev && lev.locked === true) {
    test.check('and the lever reads as held, so the monitor can say who is driving');
  } else {
    test.fail('held was not set on a lever the owner took');
  }
  if (report && typeof report.at === 'string' && report.at.length > 0) {
    test.check('the report carries a capture time — so a stale view can read as stale');
  } else {
    test.fail('no capture time on the report');
  }

  test.subHeading('`dynamic` hands it back, and the answer says so');

  post(R.box, R.owner, relayKey, { lever: { name: 'connections1', set: 'dynamic' } });
  const back = lastReply(bags.owner);
  const st2 = bags.owner.filter(function (m) { return m.event === 'relay-status'; });
  const lev2 = st2.length ? st2[st2.length - 1].data.levers.connections1 : null;
  if (back && back.ok === true && back.to === 'dynamic') {
    test.check('the relay takes `dynamic` as a value like any other');
  } else {
    test.fail('dynamic answered ' + JSON.stringify(back));
  }
  if (lev2 && lev2.locked === false) {
    test.check('and the lever is no longer held — the programme has it again');
  } else {
    test.fail('dynamic did not release the lever: ' + JSON.stringify(lev2));
  }

  test.subHeading('A setting below the present count closes streams, and says how many');

  // Three sinks are open. Setting the allowance to 1 leaves room for the
  // owner alone, so both members have to go — and the owner never does.
  post(R.box, R.owner, relayKey, { lever: { name: 'connections1', set: 1 } });
  const shed = lastReply(bags.owner);

  if (shed && shed.ok === true && shed.closed === 2) {
    test.check('the verb’s own answer carries the cost: closed ' + shed.closed);
  } else {
    test.fail('the shed was not reported: ' + JSON.stringify(shed));
  }
  // The sinks themselves say who went: a closed stream is what the member
  // actually experiences, and it is what the owner is spared.
  if (!bags.owner.closed) {
    test.check('the owner is spared — the monitor does not go blind under the load worth watching');
  } else {
    test.fail('the owner stream was closed');
  }
  if (bags.mia.closed && bags.nils.closed) {
    test.check('and the members are closed, by the same rule a Governor step uses');
  } else {
    test.fail('a member survived a setting below the present count');
  }
  const told = bags.owner.filter(function (m) {
    return m.event === 'presence' && m.data && m.data.present === false;
  });
  if (told.length >= 2) {
    test.check('each closure is broadcast, so nobody is dropped silently');
  } else {
    test.fail('closures were not announced: ' + told.length);
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
