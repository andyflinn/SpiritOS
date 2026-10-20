'use strict';

// spirit/test/natterShellFixes.js
// goal/G30.7, "Fix Shell problems related to face-name and email first". Red on today's tree; claude-windows writes it
// and builds it (one agent).
// The item's box (v18), in short:
//   - Natter: the relay list is built on the shared list search, with its search field; relay.search answers each row
//     as JSON, as the other searches do.
//   - The public label field shows the relay's current label: the node keeps the label from the relay card beside its
//     services, and relay.get's row carries it.
//   - natterDetails reads lever.value, as relayMonitor does, instead of position and allowed.
//   - First-run defaults live in serveCommon, called at boot by the node and the relay alike: an identity with no
//     description gets the first description (moved from nodeCard ensureDescription, worded for a node or a relay),
//     and a relay with no public label gets a first one.
//   - On boot, if the owner (relay-state/owner.json) has no seat, the relay creates one: label owner.
//   - Relays are peers: a relay is a peer in the shadow (seenPeers) with its key, its label and its own URL as route;
//     each row carries kind, node or relay. peer.search finds both; the Contacts app's list of peers seen gains a
//     relay filter, and a click on a relay opens natterDetails. The seeded relay (noderoutes.net) enters the shadow at
//     boot as a relay peer. Membership stays in the relays table.
// NAMED HERE where the box names none:
//   - serveCommon.ensureFirstRun(rootDir, {kind: 'node' | 'relay', now}). The first description reads "this <kind>
//     described for the first time <date> UTC"; a relay's first label is "relay " and the last 8 characters of its
//     key, written as its identity's name when the name is empty or the installer's 'relay'.
//   - seenPeers.note(key, {kind}) keeps kind on the row, get(key).kind answers it ('node' when never said).
//   - peer.search rows carry kind in their label JSON; peerPost keeps the card label as labelOf(url).
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.7: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const homes = [];
function home(name) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'g307-' + name + '-')); homes.push(d); return d; }

test.startTest('goal/G30.7: Natter and Info show what is true; relays are peers; a relay seats its owner at boot');

test.subHeading('1. natterDetails reads what the relay sends');
const nd = code('shell/natterDetails/natterDetails.js');
if (/lever\.value/.test(nd) && !/lever\.position|lever\.allowed/.test(nd)) test.check('the connections line reads lever.value, not position or allowed');
else test.fail(OWED + 'natterDetails still reads lever.position or lever.allowed');

test.subHeading('2. the public label is the relay\'s own');
const peerPost = code('js/peerPost.js');
const hub = code('js/hub.js');
if (/labelOf/.test(peerPost) && /labelOf:\s*labelOf/.test(peerPost)) test.check('peerPost keeps the relay card\'s label and answers labelOf(url)');
else test.fail(OWED + 'peerPost keeps no label from the relay card');
if (/relayLabel:\s*''/.test(hub) || !/labelOf\(/.test(hub)) test.fail(OWED + 'hub relaySummary still answers relayLabel empty');
else test.check('hub relaySummary fills relayLabel from labelOf');

test.subHeading('3. Natter searches');
const natter = code('shell/natter/natter.js');
if (/shellCreateListSearch\(/.test(natter)) test.check('Natter\'s relay list is built on the shared list search');
else test.fail(OWED + 'Natter\'s relay list is a plain table');
const relaySearch = (/function relaySearch\(body, deps\) \{[\s\S]*?\n  \}/.exec(hub) || [''])[0];
if (/label:\s*JSON\.stringify\(/.test(relaySearch)) test.check('relay.search answers each row\'s label as JSON');
else test.fail(OWED + 'relay.search answers a plain string label');

test.subHeading('4. first-run defaults in serveCommon');
const common = require('../run/js/serveCommon');
const auth = require('../run/js/relayAuth');
const plant = require('./plantIdentity.js');
const nodeHome = home('node');
plant.ensureAt(nodeHome, 'andy');
const relayHome = home('relay');
plant.ensureAt(relayHome, 'relay');
let ran = null;
try {
  common.ensureFirstRun(nodeHome, { kind: 'node', now: new Date('2026-10-20T08:00:00Z') });
  common.ensureFirstRun(relayHome, { kind: 'relay', now: new Date('2026-10-20T08:00:00Z') });
  ran = true;
} catch (e) { ran = e.message; }
const nodeId = auth.loadIdentity(nodeHome);
const relayId = auth.loadIdentity(relayHome);
if (ran === true && nodeId.description === 'this node described for the first time 2026-10-20 08:00:00 UTC' && nodeId.name === 'andy')
  test.check('a node with no description gets the first one; its name is left alone');
else test.fail(OWED + 'ensureFirstRun for a node: ' + short(ran) + ', ' + short({ name: nodeId.name, description: nodeId.description }));
if (ran === true && relayId.description === 'this relay described for the first time 2026-10-20 08:00:00 UTC' && relayId.name === 'relay ' + String(relayId.publicKey).slice(-8))
  test.check('a relay gets the first description and a first public label, relay and its key\'s tail');
else test.fail(OWED + 'ensureFirstRun for a relay: ' + short({ name: relayId.name, description: relayId.description }));
const nodeCard = code('js/nodeCard.js');
const server = code('js/server.js');
const relayServer = code('js/relayServer.js');
if (!/function ensureDescription/.test(nodeCard) && /ensureFirstRun\([^)]*kind:\s*'node'/.test(server) && /ensureFirstRun\([^)]*kind:\s*'relay'/.test(relayServer))
  test.check('the node and the relay call serveCommon.ensureFirstRun at boot; nodeCard keeps no ensureDescription of its own');
else test.fail(OWED + 'the boot calls or the move from nodeCard are missing');

test.subHeading('5. a relay seats its owner at boot');
const { createRelay } = require('../run/js/relay');
const boxHome = home('box');
plant.ensureAt(boxHome, 'relay');
const owner = auth.generateIdentity('andy');
auth.writeOwner(boxHome, owner.publicKey);
let snap = null;
try { snap = createRelay(boxHome).snapshot(); } catch (e) { snap = { threw: e.message }; }
if (snap && snap.peers === 1 && snap.owner === 'owner') test.check('a relay whose owner holds no seat seats him at boot, labelled owner (Peers 1, Owner owner)');
else test.fail(OWED + 'the snapshot after boot: ' + short(snap && { peers: snap.peers, owner: snap.owner, threw: snap.threw }));
let again = null;
try { again = createRelay(boxHome).snapshot(); } catch (e) { again = { threw: e.message }; }
if (again && again.peers === 1) test.check('a second boot finds the seat and adds none');
else test.fail(OWED + 'a second boot left ' + short(again && again.peers) + ' peers');

test.subHeading('6. relays are peers in the shadow');
const hubMod = require('../run/js/hub');
const peerHome = home('peers');
plant.ensureAt(peerHome, 'andy');
let kinds = null;
try {
  const S = hubMod.shadow(peerHome);
  S.note('RELAYKEY-A', { label: 'a relay', at: 'https://relay.example', kind: 'relay' });
  S.note('NODEKEY-B', { label: 'a node', at: 'https://relay.example' });
  kinds = { relay: (S.get('RELAYKEY-A') || {}).kind, node: (S.get('NODEKEY-B') || {}).kind };
} catch (e) { kinds = { threw: e.message }; }
if (kinds && kinds.relay === 'relay' && kinds.node === 'node') test.check('a shadow row carries kind: relay when said, node when never said');
else test.fail(OWED + 'the shadow rows answered ' + short(kinds));
let seed = null;
try {
  require('../run/js/ownerBadge').ensureRelays(peerHome);
  const KEY = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
  const row = hubMod.shadow(peerHome).get(KEY) || {};
  seed = { kind: row.kind, at: row.at };
} catch (e) { seed = { threw: e.message }; }
if (seed && seed.kind === 'relay' && seed.at === 'https://noderoutes.net') test.check('the seeded relay noderoutes.net enters the shadow at boot as a relay peer, its route its own URL');
else test.fail(OWED + 'the seed in the shadow: ' + short(seed));
if (/kind:/.test((/function fromMemory[\s\S]*?\n  \}/.exec(hub) || [''])[0])) test.check('peer.search rows carry kind in their label');
else test.fail(OWED + 'peer.search rows carry no kind');
const contacts = code('shell/contacts/contacts.js');
if (/kind\s*===\s*'relay'/.test(contacts) && /callDialog\('shell\/natterDetails'/.test(contacts)) test.check('the Contacts list of peers seen has a relay filter, and a relay opens natterDetails');
else test.fail(OWED + 'the Contacts peer list has no relay filter or no way to natterDetails');

homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
test.reportSuccessFailureCount();
process.exit(0);
