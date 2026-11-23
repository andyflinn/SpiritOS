'use strict';

// spirit/run/spirit/test/ownerBadge.js
// The tests of spirit/ownerBadge.js, and of no other module (spec: ./ownerBadge.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The owner badge and the relay list's rules: which relays this node lists (its own state, goal/G16.3), which may come
// off it, and, per listed relay, whether its card names this node's key as owner (probe). The rules are pure; the list
// is kept in a scratch home of its own, and probe's request is planted: it answers a card's text per url.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/ownerBadge/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db at <root>/spirit/state/node.db) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () {
  const top = tempFolder.path('spirit/test/ownerBadge');
  closeStoresUnder(top);
  try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
const B = S.requireScript('spirit/ownerBadge.js');
const relayKeys = S.requireScript('spirit/relayKeys.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function scratch() { return ownTemp('spirit-ownerbadge-'); }
const KEPT = 'https://noderoutes.net';
const MINE = 'https://mine.example';
const OTHER = 'https://other.example';
const KEY_MINE = 'MCowBQYDK2VwAyEAMINEMINEMINEMINEMINEMINEMINEMINEMINEMINEMINEMIN=';
const KEY_OTHER = 'MCowBQYDK2VwAyEAOTHROTHROTHROTHROTHROTHROTHROTHROTHROTHROTHROTH=';
const ME = 'my-node-key';

// ── the rules, pure ──
test.run('normalizeUrl trims the url and its trailing slashes', 0.2, function () {
  return (B.normalizeUrl('  https://a.example//  ') === 'https://a.example' && B.normalizeUrl(null) === '') || false;
}, test.limit.quick);
test.run('a public relay is https to a host that is not loopback', 0.2, function () {
  const yes = ['https://relay.example', 'https://noderoutes.net/'].map(B.isPublicRelay);
  const no = ['http://relay.example', 'https://127.0.0.1:8443', 'https://localhost', 'http://[::1]:80', 'ftp://relay.example', 'not a url', ''].map(B.isPublicRelay);
  return (yes.every(Boolean) && no.every(function (x) { return x === false; })) || false;
}, test.limit.quick);
test.run('the relay kept by name is noderoutes.net, seeded with its key, and it is the only seed', 0.2, function () {
  return (B.KEPT_RELAY.url === KEPT && /^MCowBQYDK2VwAyEA/.test(B.KEPT_RELAY.key) && B.SEED_RELAYS.length === 1 && B.SEED_RELAYS[0] === B.KEPT_RELAY) || false;
}, test.limit.quick);
test.run('noderoutes.net is never removed, even with another public relay left', 0.2, function () {
  const why = B.removalRefusal([{ url: KEPT }, { url: OTHER }], KEPT + '/');
  return why === 'noderoutes.net is kept on every node' || false;
}, test.limit.quick);
test.run('a relay this node owns, or holds a seat on, is not removed, and the refusal says why in Andy\'s sentences', 0.2, function () {
  const a = B.removalRefusal([{ url: KEPT }, { url: MINE, owned: true }], MINE), b = B.removalRefusal([{ url: KEPT }, { url: MINE, claimed: true }], MINE);
  return (a === 'you cannot remove a relay you own' && b === 'you must remove yourself from this relay before you can remove the relay from your contacts') || false;
}, test.limit.quick);
test.run('a row may go only if another public row survives, and a lab relay does not count as one', 0.2, function () {
  const lab = B.removalRefusal([{ url: OTHER }, { url: 'http://127.0.0.1:9000' }], OTHER);
  const fine = B.removalRefusal([{ url: OTHER }, { url: MINE }], OTHER);
  const plain = B.removalRefusal(['http://127.0.0.1:9000', MINE], 'http://127.0.0.1:9000');
  return (lab === 'this node must keep one public relay' && fine === '' && plain === '') || false;
}, test.limit.quick);
test.run('a removal handed a count in place of the list is refused, because no is the safe half of wrong', 0.2, function () {
  return B.removalRefusal(2, OTHER) === 'this node must keep one public relay' || false;
}, test.limit.quick);
test.run('ownedBy says owned only when the owner the box states is this node\'s key', 0.2, function () {
  const got = [B.ownedBy(ME, ME), B.ownedBy('someone', ME), B.ownedBy('', ''), B.ownedBy(null, ME), B.ownedBy(ME, '')];
  return short(got) === short([true, false, false, false, false]) || false;
}, test.limit.quick);
test.run('summarize lists the owned urls and the claimed urls, owning implying claiming, and asks for a pick only when two are owned', 0.2, function () {
  const one = B.summarize([{ url: 'a', owned: true }, { url: 'b', claimed: true }, { url: 'c' }]);
  const two = B.summarize([{ url: 'a', owned: true }, { url: 'b', owned: true }]);
  return (short(one.ownedUrls) === '["a"]' && short(one.claimedUrls) === '["a","b"]' && one.mustPick === false && two.mustPick === true && one.rows.length === 3) || false;
}, test.limit.quick);
test.run('chooseUrl takes the url picked if it is listed, the one url when there is no choice, and never the first out of habit', 0.2, function () {
  const got = [B.chooseUrl([MINE, OTHER], OTHER + '/'), B.chooseUrl([MINE, OTHER], 'https://elsewhere.example'), B.chooseUrl([MINE], ''), B.chooseUrl([], ''), B.chooseUrl([MINE, OTHER], '')];
  return (got[0].ok && got[0].url === OTHER && got[1].status === 403 && got[2].url === MINE && got[3].status === 503 && got[4].status === 400 && got[4].error === 'pick a relay url') || false;
}, test.limit.quick);

// ── the list, the node's own state ──
const W = { home: null };
test.run('a fresh home gets noderoutes.net at boot, and nothing else', 0.2, function () {
  W.home = scratch();
  const rows = B.ensureRelays(W.home);
  return (rows.length === 1 && rows[0].url === KEPT && rows[0].key === B.KEPT_RELAY.key) || false;
}, test.limit.quick);
test.run('the seed asserted again at the next boot is left as it is, still one row', 0.2, function () {
  if (!W.home) return false;
  const rows = B.ensureRelays(W.home);
  return (rows.length === 1 && short(B.configuredUrls(W.home)) === short([KEPT])) || false;
}, test.limit.quick);
test.run('a successful claim appends its relay under the key it learned', 0.2, function () {
  if (!W.home) return false;
  B.addRelay(W.home, MINE + '/', 'mine', KEY_MINE);
  const rows = B.addRelay(W.home, OTHER, 'other', KEY_OTHER);
  return short(rows.map(function (r) { return r.url; })) === short([KEPT, MINE, OTHER]) || false;
}, test.limit.quick);
test.run('a url never met, named without a key, is not listed', 0.2, function () {
  if (!W.home) return false;
  const rows = B.addRelay(W.home, 'https://stranger.example', 'stranger');
  return rows.every(function (r) { return r.url !== 'https://stranger.example'; }) || false;
}, test.limit.quick);
test.run('removeRelay refuses noderoutes.net with 409, an unknown url with 404 and no url with 400', 0.2, function () {
  if (!W.home) return false;
  const got = [B.removeRelay(W.home, KEPT), B.removeRelay(W.home, 'https://nope.example'), B.removeRelay(W.home, '')];
  return (got[0].status === 409 && got[1].status === 404 && got[2].status === 400 && B.configuredUrls(W.home).length === 3) || false;
}, test.limit.quick);
test.run('removeRelay refuses a relay this node owns, and one where it holds a seat', 0.2, function () {
  if (!W.home) return false;
  const owned = B.removeRelay(W.home, MINE, { owned: true });
  relayKeys.seat(W.home, MINE);
  const seated = B.removeRelay(W.home, MINE);
  relayKeys.unseat(W.home, MINE);
  return (owned.status === 409 && /you own/.test(owned.error) && seated.status === 409 && /remove yourself/.test(seated.error)) || false;
}, test.limit.quick);
test.run('removeRelay takes any other relay off the list', 0.2, function () {
  if (!W.home) return false;
  const r = B.removeRelay(W.home, OTHER + '/');
  return (r.ok && r.key === OTHER && short(B.configuredUrls(W.home)) === short([KEPT, MINE])) || false;
}, test.limit.quick);
test.run('a list that cannot be read gives no relays and never throws', 0.2, function () {
  // A home that is a file: its store cannot be opened.
  const notAHome = path.join(scratch(), 'a-file');
  fs.writeFileSync(notAHome, 'not a folder');
  let rows = null;
  try { rows = B.loadRelays(notAHome); } catch (e) { return false; }
  return (Array.isArray(rows) && rows.length === 0) || false;
}, test.limit.quick);

// ── probe: who each listed relay says owns it ──
let P = null;
test.run('probe asks each listed relay for its card and signs nothing', 0.2, async function () {
  const h = scratch();
  B.ensureRelays(h);
  B.addRelay(h, MINE, 'mine', KEY_MINE);
  B.addRelay(h, OTHER, 'other', KEY_OTHER);
  const asked = [];
  P = await B.probe(h, function (url) {
    asked.push(url);
    if (url === MINE) return { status: 200, text: JSON.stringify({ ownerKey: ME, ownerLabel: 'andy', relayPublicKey: KEY_MINE, relayLabel: 'mine' }) };
    if (url === OTHER) throw new Error('connect ECONNREFUSED');
    return { status: 200, text: JSON.stringify({ ownerKey: 'someone else' }) };
  }, ME);
  P.asked = asked;
  return asked.length === 3 || false;
}, test.limit.quick);
function rowOf(url) { return ((P && P.rows) || []).filter(function (r) { return r.url === url; })[0] || null; }
test.run('a relay whose card names this node\'s key is owned, and so claimed, with its roll taken from the card', 0.2, function () {
  const r = rowOf(MINE);
  if (!r) return false;
  return (r.owned === true && r.claimed === true && r.status === 200 && r.roll && r.roll.ownerKey === ME && r.roll.relayKey === KEY_MINE && short(P.ownedUrls) === short([MINE])) || false;
}, test.limit.quick);
test.run('a relay owned by someone else, where this node has no seat, says no row here', 0.2, function () {
  const r = rowOf(KEPT);
  if (!r) return false;
  return (r.owned === false && r.claimed === false && r.error === 'no row here' && !r.roll) || false;
}, test.limit.quick);
test.run('a relay that is down is a row of its own with status 0, and never a failed probe', 0.2, function () {
  const r = rowOf(OTHER);
  if (!r) return false;
  return (r.owned === false && r.status === 0 && /ECONNREFUSED/.test(r.error) && P.rows.length === 3) || false;
}, test.limit.quick);
test.run('a seat this node holds makes the relay claimed, though its card names another owner', 0.2, async function () {
  const h = scratch();
  B.addRelay(h, OTHER, 'other', KEY_OTHER);
  relayKeys.seat(h, OTHER);
  const s = await B.probe(h, function () { return { status: 200, text: JSON.stringify({ ownerKey: 'someone else' }) }; }, ME);
  const r = s.rows[0] || {};
  return (r.owned === false && r.claimed === true && short(s.claimedUrls) === short([OTHER]) && !r.error) || false;
}, test.limit.quick);
test.run('without this node\'s key nothing is owned', 0.2, async function () {
  const h = scratch();
  B.addRelay(h, MINE, 'mine', KEY_MINE);
  const s = await B.probe(h, function () { return { status: 200, text: JSON.stringify({ ownerKey: ME }) }; }, '');
  return s.ownedUrls.length === 0 || false;
}, test.limit.quick);
