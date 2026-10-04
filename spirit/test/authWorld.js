'use strict';

// apiAuth/G1.0: the auth world, red on today's code.
//   Andy: "we may want to define a labWorld for this" — which node must run app servers, which ones will seek
//   grants; "a script will configure the grants, via loopback.", "it's about permutations of configurations
//   that peerPost() fails in apiAuth", and his "yes" to the three fields (team meeting under G1.0).
// The contract the builder follows:
//   - scenario.js takes three fields more: servers: [names] (the OWNER's, seeded into its include.json through
//     includeList — the owner is a name, so the field sits at the top beside it); a peer's grants: [paths] (set
//     through jobs.authGrant on the owner's loopback, never by writing node.db); and top-level cases:
//     [{ from, ask, expect }], expect one of 'answered' | 'refused <code>' | 'silence'.
//   - labWorld.createWorld({ scenario }) builds that world on real ports: the owner running its servers, each
//     peer a contact of the owner holding its grants; the built world's runCases() sends each case's ask from its
//     peer over peerPost and resolves [{ index, outcome }], outcome in expect's vocabulary.
//   'answered' is a reply that is not a refusal; 'refused <code>' names the refusal, the gate's or the server's.
//   Not here: a stranger (no reply) is appApiDoor.js T6's, at the door itself.

const test = require('./testSupport.js');
const scenario = require('./scenario');
const labWorld = require('./labWorld');

const OWED = 'OWED by apiAuth/G1.0: ';
const SEARCH = { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false };  // includeClosed since goal/G4.20

const AUTH = {
  title: 'Who may call which api',
  why: 'apiAuth/G1.0: every way a member\'s call is decided at the owner\'s gate.',
  servers: ['desk', 'backup'],
  peers: [
    { name: 'appPeer', grants: ['desk'] },
    { name: 'verbPeer', grants: ['desk.items.search'] },
    { name: 'noGrant', grants: [] },
  ],
  cases: [
    { from: 'appPeer', ask: 'api', expect: 'answered' },
    { from: 'noGrant', ask: 'api', expect: 'refused not-granted' },
    { from: 'verbPeer', ask: { desk: { 'items.search': SEARCH } }, expect: 'answered' },
    { from: 'verbPeer', ask: { desk: { 'chat.add': { id: 'x', text: 'y', by: 'verbPeer' } } }, expect: 'refused not-granted' },
    { from: 'appPeer', ask: { backup: { 'status.get': {} } }, expect: 'refused not-granted' },
    { from: 'appPeer', ask: { desk: { DEBUG: {} } }, expect: 'refused not-owner' },
    { from: 'appPeer', ask: { desk: { DEPENDENCIES: {} } }, expect: 'refused not-owner' },
    { from: 'appPeer', ask: { desk: { nosuch: {} } }, expect: 'refused no-such-verb' },
  ],
};

test.startTest('apiAuth/G1.0: the auth world, every case decided as expected');

(async function () {
  test.subHeading('scenario.js takes the three fields');
  const wrong = scenario.problems(AUTH);
  if (!wrong.length) test.check('servers, a peer\'s grants and cases are part of a world');
  else { test.fail(OWED + 'scenario.js refuses: ' + wrong.join('; ')); return; }
  const s = scenario.normalize(AUTH);
  const kept = s.servers && s.servers.join(',') === 'desk,backup' && s.cases && s.cases.length === AUTH.cases.length &&
    s.peers.every(function (p, i) { return Array.isArray(p.grants) && p.grants.join(',') === AUTH.peers[i].grants.join(','); });
  if (kept) test.check('normalize keeps them as written');
  else { test.fail(OWED + 'normalize lost them: ' + JSON.stringify({ servers: s.servers, cases: s.cases && s.cases.length }).slice(0, 160)); return; }

  test.subHeading('labWorld builds it on real ports, and every case comes out as expected');
  const world = labWorld.createWorld({ scenario: AUTH });
  if (typeof world.runCases !== 'function') { test.fail(OWED + 'labWorld\'s world has no runCases()'); return; }
  const built = await world.build();
  if (!built || built.ok === false) { test.fail(OWED + 'the auth world did not build: ' + JSON.stringify(built).slice(0, 200)); return; }
  const outcomes = await world.runCases();
  AUTH.cases.forEach(function (c, i) {
    const got = (outcomes || []).filter(function (o) { return o.index === i; })[0];
    const said = c.from + ' asks ' + JSON.stringify(c.ask).slice(0, 60);
    if (got && got.outcome === c.expect) test.check(said + ': ' + c.expect);
    else test.fail(OWED + said + ': expected ' + c.expect + ', got ' + (got ? got.outcome : 'nothing'));
  });
  if (typeof world.teardown === 'function') await world.teardown();
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
