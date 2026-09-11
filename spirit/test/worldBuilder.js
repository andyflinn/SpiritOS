'use strict';

// spirit/test/worldBuilder.js
// The thing every other suite now stands on.
//
// scenario.js and world.js replaced a lab() helper that had been copied
// into a dozen files and had drifted in every one — and a shared fixture
// with no tests of its own is worse than twelve that drift, because when
// it is wrong it is wrong everywhere at once and quietly.
//
// Two of the checks below are here because the builder HAD those bugs:
// it wrote the owner's key into the relay's home (where relay.js keeps
// the mailbox's own key, explicitly not the owner's), and it claimed
// every peer from one address, so the eleventh peer in a scenario would
// have been refused by a rate limit and the scenario blamed.
//
// Neither would have shown up as a failure. Both would have shown up as
// a suite passing for the wrong reason.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const scenario = require('./scenario');
const world = require('./world');

test.startTest('The scenario builder — what every other suite stands on');

function run() {
  test.subHeading('A scenario says what it means, and the gaps are filled the same way twice');

  const bare = scenario.normalize({ peers: ['bert'] });
  if (bare.owner === 'andy' && bare.relays.join(',') === 'lab') {
    test.check('an unsaid owner is andy, and an unsaid relay is lab');
  } else {
    test.fail('defaults: ' + JSON.stringify({ owner: bare.owner, relays: bare.relays }));
  }

  if (bare.peers[0].label === 'bert' && bare.peers[0].running === true &&
      bare.peers[0].on.join(',') === 'lab') {
    test.check('a peer named as a bare string is on the lab relay, running, wearing its own name');
  } else {
    test.fail('peer default: ' + JSON.stringify(bare.peers[0]));
  }

  // The distinction the whole device and router arc turns on.
  const twins = scenario.normalize({ peers: [{ name: 'johnA', label: 'john' }, 'johnB'] });
  if (twins.peers[0].label === 'john' && twins.peers[1].label === 'johnB') {
    test.check('a label given is kept, a label omitted is the name — two johns, two keys');
  } else {
    test.fail('labels: ' + JSON.stringify(twins.peers.map(function (p) { return p.label; })));
  }

  // `owner: null` has to survive normalisation. Read as "unset" it would
  // become andy, and the first-run world would silently stop existing.
  if (scenario.normalize({ owner: null, peers: [] }).owner === null) {
    test.check('and `owner: null` stays null — nobody has claimed is a world, not a gap');
  } else {
    test.fail('owner null became ' + JSON.stringify(scenario.normalize({ owner: null }).owner));
  }

  test.subHeading('It complains about everything at once, not the first thing');

  const messy = scenario.problems({
    hwhat: 1,
    peers: [{ name: 'a', colour: 'red' }, { name: 'a' }, { name: 'b', on: ['nowhere'] }],
    knows: [['a', 'ghost']],
    messages: [{ from: 'nobody', text: 'hi' }],
    then: [{ remove: 'phantom', from: 'lab' }],
  });
  const wanted = ['unknown field `hwhat`', 'unknown field `colour`', 'two peers named `a`',
    'unknown relay `nowhere`', 'stranger: `ghost`', 'from a stranger: `nobody`',
    'removes a stranger: `phantom`'];
  const missed = wanted.filter(function (w) {
    return !messy.some(function (m) { return m.indexOf(w) !== -1; });
  });
  if (!missed.length) {
    test.check('seven mistakes in one scenario are reported as seven, in one reading');
  } else {
    test.fail('not reported: ' + missed.join(' | ') + '  — got: ' + messy.join('; '));
  }

  if (scenario.valid({ peers: ['bert'] })) test.check('and a good one draws no complaint');
  else test.fail('good scenario complained: ' + scenario.problems({ peers: ['bert'] }).join('; '));

  // A well-formed world with nobody in it is legal. It is what the whole
  // device arc happens in, and refusing it would push every device suite
  // back to building its own relay by hand.
  if (scenario.valid(scenario.OWNER_ONLY) && scenario.valid(scenario.UNCLAIMED)) {
    test.check('an owner alone, and a relay nobody has claimed, are both well-formed');
  } else {
    test.fail('stock scenarios complained');
  }

  // But neither is worth spawning four processes to stare at, and that is
  // a different question asked by a different caller.
  if (scenario.exhibitProblems(scenario.OWNER_ONLY).length &&
      !scenario.exhibitProblems({
        title: 't', why: 'w', look: ['a'], covers: ['world.js'], peers: ['bert'],
      }).length) {
    test.check('and only the ones somebody LOOKS at owe a title, a reason and peers');
  } else {
    test.fail('exhibit rules are not separate from grammar rules');
  }

  test.subHeading('A refusal comes back as a refusal');

  // Every caller checks `ok`. A builder that sometimes returns and
  // sometimes throws makes each of them handle two shapes, so half of
  // them handle one — which is how a bad scenario surfaces as a stack
  // trace in the middle of an unrelated suite.
  const refused = world.build({ peers: [{ name: 'x', on: ['mars'] }] });
  if (refused.ok === false && /mars/.test(refused.error)) {
    test.check('a scenario naming a relay nobody defined is refused, not thrown');
  } else {
    test.fail('refusal: ' + JSON.stringify(refused).slice(0, 120));
  }

  let threw = false;
  let broke = null;
  try { broke = world.build({ peers: [{ name: 'a' }, { name: 'a2', label: 'a' }], owner: null }); }
  catch (e) { threw = true; }
  // Two peers wearing one label on an UNCLAIMED box: the first claim
  // takes the box, the second has no owner to mint it an invite. A real
  // refusal from relay.js, and it must arrive as one.
  if (!threw && broke && broke.ok === false) {
    test.check('and a relay refusing mid-build comes back as an error, never a stack trace');
  } else {
    test.fail('threw=' + threw + ' got=' + JSON.stringify(broke && broke.ok));
  }

  test.subHeading('The world it builds is the world it described');

  const L = world.build({
    peers: ['bert', { name: 'johnA', label: 'john' }, { name: 'johnB', label: 'john' }],
    messages: [{ from: 'bert', text: 'morning' }],
  });
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const roster = L.box.who().map(function (p) { return p.publicLabel || p.name; }).sort();
  if (roster.join(',') === 'andy,bert,john,john') {
    test.check('three peers and an owner are on the box, and both johns are there');
  } else {
    test.fail('roster: ' + roster.join(','));
  }

  if (L.peer('johnA').publicKey !== L.peer('johnB').publicKey &&
      L.peerLabel('johnA') === L.peerLabel('johnB')) {
    test.check('wearing one label with two keys, which is what makes them two invites');
  } else {
    test.fail('the two johns are not two keys');
  }

  const mail = L.box.inbox('andy', L.sign.inbox('andy'));
  if (mail.ok && (mail.messages || []).some(function (m) { return m.text === 'morning'; })) {
    test.check('and the message the scenario declared is in the owner\'s inbox');
  } else {
    test.fail('inbox: ' + JSON.stringify(mail).slice(0, 140));
  }

  test.subHeading('The mailbox has a key of its own');

  // relay.js, mailboxPublicKey(): "the owner is a peer who claimed, the
  // mailbox is the box." The builder used to save the OWNER's identity
  // into the relay's home, so the two were the same key and any check
  // that told them apart passed without telling anything apart.
  const mine = L.box.snapshot().mailboxPublicKey;
  if (mine && mine !== L.owner.publicKey && mine === L.relayKey().publicKey) {
    test.check('the relay\'s own key is not its owner\'s — the two are different parties');
  } else {
    test.fail('mailbox key: ' + (mine === L.owner.publicKey ? 'IS the owner' : String(mine).slice(0, 30)));
  }

  // The owner's key belongs on the owner's node, which is a different
  // machine in production and is a different directory here.
  const node = L.ownerHome();
  const onNode = auth.loadIdentity(node);
  if (onNode && onNode.publicKey === L.owner.publicKey) {
    test.check('and the owner\'s key is on the owner\'s node, where deviceTick reads it');
  } else {
    test.fail('owner home identity: ' + JSON.stringify(onNode && onNode.name));
  }

  if (fs.existsSync(path.join(L.nodeHome('bert'), 'app', 'natter', 'session.json'))) {
    test.check('and a peer\'s node has the session file that decides firstRun()');
  } else {
    test.fail('no session.json — the shell would open on Natter');
  }

  test.subHeading('Two things that would have broken a scenario nobody had written yet');

  // `live` is the visual builder's second relay. In process there is no
  // second relay, so it folds onto the first — and must fold ONCE, or a
  // peer declared on both claims the same box twice and the build dies
  // on "key already claimed". Every visual scenario in the tree does
  // exactly this.
  const folded = world.build({ peers: [{ name: 'bella', on: ['lab', 'live'] }] });
  if (folded.ok && folded.box.who().length === 2) {
    test.check('a peer on both `lab` and `live` joins the one in-process relay exactly once');
  } else {
    test.fail('folding: ' + (folded.ok ? folded.box.who().length + ' rows' : folded.error));
  }

  // CLAIM_PER_MIN is 10, keyed on the address. One address for everybody
  // meant the eleventh peer was refused by a rate limit — and the error
  // would have named the scenario, which would have been innocent.
  const names = [];
  for (let i = 0; i < 14; i++) names.push('p' + i);
  const crowd = world.build({ peers: names });
  if (crowd.ok && crowd.box.who().length === 15) {
    test.check('and fourteen peers all get on, because each claims from its own address');
  } else {
    test.fail('crowd: ' + (crowd.ok ? crowd.box.who().length + ' of 15' : crowd.error));
  }

  test.subHeading('Nobody has claimed, and somebody leaves');

  const empty = world.build(scenario.UNCLAIMED);
  if (empty.ok && empty.owner === null && empty.box.who().length === 0) {
    test.check('an unclaimed relay has no owner and no rows — the state first-run needs');
  } else {
    test.fail('unclaimed: ' + JSON.stringify(empty.ok && empty.box.who()));
  }

  // The step that produces the third presence colour. A peer that is
  // merely stopped is red; a peer with no row at all is white, and there
  // is no way to reach white without somebody leaving.
  const after = world.build({
    peers: ['bert', 'zoe'],
    then: [{ remove: 'zoe', from: 'lab' }],
  });
  const left = after.ok && after.box.who().map(function (p) { return p.publicLabel || p.name; });
  if (after.ok && left.indexOf('zoe') === -1 && left.indexOf('bert') !== -1) {
    test.check('and a `then` removal actually takes the row away, which is the only way to white');
  } else {
    test.fail('after removal: ' + JSON.stringify(left));
  }

  test.subHeading('And the builder Andy looks at reads the same scenarios');

  // The lab has as many peers as it has ports. It used to clamp instead
  // of refusing — Math.min(PEER_PORTS.length, wanted) — so a scenario
  // with five peers built three and reported success, and the world on
  // the screen was not the scenario anybody had asked for.
  //
  // Checked here rather than in a lab suite because the refusal happens
  // before anything is spawned, which is the point of it.
  const lab = require('./labWorld');
  return lab.createWorld({ peers: 99 }).build().then(function (big) {
    if (big.ok === false && /99 peers/.test(big.error) && /ports/.test(big.error)) {
      test.check('a scenario with more peers than the lab has ports is refused, and says why');
    } else {
      test.fail('over-capacity: ' + JSON.stringify(big).slice(0, 140));
    }
    rest();
  });
}

function rest() {
  test.subHeading('Two builds are two worlds');

  // Suites run in one process and build several worlds. If two shared a
  // directory they would share a mailbox, and a test would pass or fail
  // depending on which ran first.
  const a = world.build({ peers: ['bert'] });
  const b = world.build({ peers: ['bert'] });
  if (a.home !== b.home && a.peer('bert').publicKey !== b.peer('bert').publicKey) {
    test.check('separate homes and separate keys, so no suite can leak into the next');
  } else {
    test.fail('two builds shared state');
  }

  test.reportSuccessFailureCount();
}

// run() goes async partway through — the lab's refusal is a promise — so
// a rejection has to be caught as well as a throw. Without the .catch a
// failure after that point would leave the process with no report at
// all, and runAll reads "never reported" as worse than red, correctly.
function died(e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}

try {
  const running = run();
  if (running && typeof running.catch === 'function') running.catch(died);
} catch (e) { died(e); }
