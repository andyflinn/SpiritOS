'use strict';

// spirit/test/peerSearchShared.js
// goal/G29.17: the peer search on the probability modules and the shared list, both halves. Red on today's tree;
// claude-windows writes it and builds it (one agent). The item's box (v1):
//   THE UI: the panel's own input, Search button and list go; the panel is the shared list.
//   THE SEARCH: each relay ranks its members with the probability modules and answers a capped list; the old graded
//   search goes. The node merges the relays' answers with the same modules.
//   peer.search answers the shared shape {items: [{key, label}], more}. A wire change: every relay and node together.
// NAMED HERE where the box names none (argued in Desk first if the build disagrees):
//   - js/peerRank.js, the one ranker both use: rank(rows, q, slots) -> {rows, more}; a row is matched on its public
//     label by probabilityStringObjectMatch, best first; q '' or '*' is anyone, in the order given; a row that does not
//     match is left out; slots caps the answer and sets more.
//   - peer.search's label is the row as the node built it, json {publicKey, publicLabel, tail, relay, relayLabel,
//     present, acquiredVia, fromMemory, ...}; key is the public key. q, asked, remembered and silent stay beside items.
//   - the old graded search stays while the other old searches still need it; peerSearch.js goes. (All of it is
//     gone since goal/G29.22.)
// SINCE goal/G30.19 peer.search is gone: the network search is tier two of contact.search, its rows the peer-search
// job's updates in the same shape; Contacts' one list (contactSearch) is the panel. Sections 3 and 4 assert that.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.17: ';
const RUN = path.join(__dirname, '..', 'run');
const read = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const code = function (rel) { return read(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('goal/G29.17: the peer search on the probability modules and the shared list');

test.subHeading('1. one ranker for relay and node: js/peerRank.js');
let rank = null;
try { rank = require('../run/js/peerRank.js').rank; } catch (e) { rank = null; }
if (typeof rank === 'function') test.check('js/peerRank.js exports rank(rows, q, slots)');
else test.fail(OWED + 'no js/peerRank.js with rank()');
const row = function (label, key) { return { publicKey: key || ('K-' + label), publicLabel: label }; };
const ROWS = [row('bob'), row('alicia smith'), row('alice'), row('Alice Cooper'), row('carol')];
const run = function (q, slots) { try { return rank(ROWS, q, slots); } catch (e) { return { rows: [], more: false, error: String(e && e.message || e) }; } };
const labels = function (r) { return ((r && r.rows) || []).map(function (x) { return x.publicLabel; }); };
const a = typeof rank === 'function' ? run('alice', 32) : null;
if (a && labels(a)[0] === 'alice' && labels(a).indexOf('bob') === -1 && labels(a).indexOf('carol') === -1 && labels(a).indexOf('Alice Cooper') !== -1) {
  test.check('alice: the exact name first, the other alices after, bob and carol left out: ' + labels(a).join(', '));
} else test.fail(OWED + 'alice ranked ' + short(a));
const all = typeof rank === 'function' ? run('*', 32) : null;
if (all && labels(all).join() === ROWS.map(function (r) { return r.publicLabel; }).join() && all.more === false) test.check('* is anyone, in the order given');
else test.fail(OWED + '* answered ' + short(all));
const none = typeof rank === 'function' ? run('', 32) : null;
if (none && labels(none).length === ROWS.length) test.check('no words is anyone too');
else test.fail(OWED + 'no words answered ' + short(none));
const capped = typeof rank === 'function' ? run('*', 2) : null;
if (capped && labels(capped).length === 2 && capped.more === true) test.check('slots caps the answer and says more');
else test.fail(OWED + 'two slots answered ' + short(capped));
const kept = typeof rank === 'function' ? run('alice', 32) : null;
if (kept && kept.rows[0] === ROWS[2]) test.check('the rows come back as given, untouched');
else test.fail(OWED + 'the rows were copied or changed');

test.subHeading('2. the relay and the node rank with it; the old peer search is gone');
const relay = code('js/relay.js');
const hub = code('js/hub.js');
if (/require\('\.\/peerRank'\)/.test(relay) && /peerRank\.rank\(/.test(relay)) test.check('relay.js ranks its connected members with peerRank');
else test.fail(OWED + 'relay.js does not rank with peerRank');
if (/require\('\.\/peerRank'\)/.test(hub) && /peerRank\.rank\(/.test(hub)) test.check('hub.js merges the relays\' answers and memory with peerRank');
else test.fail(OWED + 'hub.js does not rank with peerRank');
if (!/require\('\.\/peerSearch'\)/.test(relay + hub) && !fs.existsSync(path.join(RUN, 'js', 'peerSearch.js'))) test.check('js/peerSearch.js is gone, and nothing requires it');
else test.fail(OWED + 'peerSearch.js is still there or still required');
if (!fs.existsSync(path.join(__dirname, 'peerSearch.js'))) test.check('its suite, test/peerSearch.js, is retired with it');
else test.fail(OWED + 'spirit/test/peerSearch.js still tests the graded peer search');
const ranker = code('js/peerRank.js');
if (/probabilityStringObjectMatch/.test(ranker) && /probabilityBucket/.test(ranker) && !/gradedSearch/.test(ranker)) test.check('peerRank uses the probability modules, not the graded search');
else test.fail(OWED + 'peerRank does not stand on the probability modules');

test.subHeading('3. the network search answers the shared shape (contact.search, goal/G30.19)');
const server = code('js/server.js');
// contact.search in the flat door's tables: q and the state filters in, the shared shape out.
const decl = (/'search':\s*\{\s*request:\s*\{\s*q:\s*'',\s*owned[^\n]*/.exec(server) || [''])[0];
if (/items:\s*\[\s*\{\s*key:\s*''\s*,\s*label:\s*''\s*\}\s*\]/.test(decl) && /more:\s*false/.test(decl) && /hub\.contactSearch\(/.test(decl)) test.check('server.js declares contact.search answering {items: [{key, label}], more, ...}');
else test.fail(OWED + 'server.js declares ' + short(decl));
if (/item:\s*\{\s*key:\s*row\.publicKey,\s*label:\s*label\s*\}/.test(hub)) test.check('each network row is one peer-search job update in the same shape, {key, label}');
else test.fail(OWED + 'the network search\'s rows are not {key, label}');
const onboard = code('process/js/desk/onboard.js');
if (!/body\.matches/.test(onboard) && /body\.items/.test(onboard) && /'contact\.search'/.test(onboard)) test.check('the desk\'s onboard reads items, from contact.search');
else test.fail(OWED + 'process/js/desk/onboard.js still reads matches or asks peer.search');

test.subHeading('4. Contacts\' one list is the standard list-tool');
const contacts = code('shell/contacts/contacts.js');
if (!/id="contacts-seen-q"/.test(contacts) && !/id="contacts-seen-go"/.test(contacts) && !/contacts-seen-section/.test(contacts)) test.check('the panel\'s own input, Search button and fold are gone');
else test.fail(OWED + 'Find someone on the network still has its own input, Search button or fold');
const finder = code('shell/js/contactSearch.js');
if (/spiritElements\.contactSearch\.create\(/.test(contacts) && /spiritElements\.probabilitySearch\.create\(/.test(finder) && /'contact\.search'/.test(finder) && !/function contactsSearchSeen\(/.test(contacts)) test.check('the list draws through the list-tool, asking contact.search');
else test.fail(OWED + 'the list does not draw through the list-tool');
if (/data-action="add"/.test(code('shell/js/rows/contactElement.js')) && /function askCard\(/.test(finder) && /card: true/.test(finder)) test.check('a network row has its Add, and pressing it asks that node who it is');
else test.fail(OWED + 'a network row lost Add or the card it asks');

test.reportSuccessFailureCount();
