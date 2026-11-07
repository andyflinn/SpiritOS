'use strict';

// spirit/test/contactsListSearch.js
// goal/G29.6: THE PEER PICKER ON THE SHARED LIST, CONTACTS FIRST. The item's box (v10), in short:
//   - contactSelector becomes a thin wrapper around shellCreateListSearch (goal/G29.4), for Contacts, chatter and every
//     place a peer is picked.
//   - Columns: fixed ★ (my puppet: an owned contact, its card naming this node its owner, goal/G19.8; a tooltip says
//     so), presence (green or white), the name; then one configurable status column [{status, iconKey}].
//   - A star says it all: the word " — owned" leaves the label.
//   - Filters: one per state, owned (★) and blocked, each shown only when the list holds any.
//   - contact.search (a node verb, changed by Andy's grant) answers {key: public key, label: json {name, owned,
//     blocked}} and takes owned and blocked as yes-filters beside q; shell.js finds the puppets with owned: yes.
//   - The app repaints one row when presence or status changes, without asking the server.
//   - ONE BY ONE, STARTING WITH CONTACTS: hub's contact.search ranks with the probability modules.
// SINCE goal/G40.11 owned is the one table's flag mine ("owned, puppets and owned relays"), and the label is the row's
// flags {name, keep, mine, relay, blocked, seated, ...}; the yes-filters are keep, mine, relay, seated, blocked.
// Andy, 2026-10-17, on the old design: "no fucking protecting old design." A row's name comes from the row; a rename is
// a publish on the node's stream, and the list asks again.
// rule/11: through testSupport only. No node: hub's pure functions, and a fake page.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.6: ';
const RUN = path.join(__dirname, '..', 'run');
const short = function (x) { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > 300 ? s.slice(0, 300) + '…' : s; };
const strip = function (src) { return src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };

test.startTest('goal/G29.6: the peer picker on the shared list, Contacts first');

// ── THE NODE: contact.search's rows and its ranking ──
const hub = require('../run/spirit/hub.js');
const PEOPLE = [
  { publicKey: 'K-bert', tail: 'aaaaaa', publicLabel: 'Bert', myLabel: '', blocked: false, mine: false },
  { publicKey: 'K-bertie', tail: 'bbbbbb', publicLabel: 'Bertie', myLabel: '', blocked: false, mine: false },
  { publicKey: 'K-pup', tail: 'cccccc', publicLabel: 'pup', myLabel: '', blocked: false, mine: true },
  { publicKey: 'K-dave', tail: 'dddddd', publicLabel: 'dave', myLabel: '', blocked: true, mine: false },
  { publicKey: 'K-carol', tail: 'eeeeee', publicLabel: 'carol', myLabel: '', blocked: false, mine: false },
];
const rowsOf = function (r) { return ((r && r.items) || []).map(function (i) { let l = null; try { l = JSON.parse(i.label); } catch (e) { l = null; } return { key: i.key, label: l, raw: i.label }; }); };

test.subHeading('1. contact.search answers each peer as {key, label: json {name, mine, blocked, ...}}');
let pupLabel = null;
try { pupLabel = JSON.parse(hub.contactLabel(PEOPLE[2])); } catch (e) { pupLabel = null; }
if (pupLabel && pupLabel.name === 'pup' && pupLabel.mine === true && pupLabel.blocked === false && !('owned' in pupLabel)) test.check('a label is json {name, mine, blocked, ...}, no owned: ' + hub.contactLabel(PEOPLE[2]));
else test.fail(OWED + 'the label reads ' + short(hub.contactLabel(PEOPLE[2])));
const all = rowsOf(hub.searchPeople(PEOPLE, ''));
if (all.length === 5 && all.every(function (r) { return r.label && !/ — /.test(r.label.name || ''); })) test.check('no state word in any name: a star says it all');
else test.fail(OWED + 'the book answers ' + short(all.map(function (r) { return r.raw; })));

test.subHeading('2. it ranks with the probability modules');
const bert = rowsOf(hub.searchPeople(PEOPLE, 'Bert'));
if (bert.length && bert[0].key === 'K-bert' && bert.some(function (r) { return r.key === 'K-bertie'; }) && !bert.some(function (r) { return r.key === 'K-carol'; })) test.check('"Bert" answers Bert first, then Bertie, and not carol');
else test.fail(OWED + '"Bert" answers ' + short(bert.map(function (r) { return r.key; })));
const hubSrc = strip(fs.readFileSync(path.join(RUN, 'spirit', 'hub.js'), 'utf8'));
const fnBody = function (src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) return '';
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return '';
};
const sp = fnBody(hubSrc, 'searchPeople');
if (sp && /probabilityStringObjectMatch|probabilityStringMatch/.test(sp) && /createProbabilityBucket/.test(hubSrc) && !/searchBucket/.test(sp) && !/CONTACT_STATE/.test(hubSrc)) test.check('searchPeople ranks with the probability modules; no searchBucket in it, no state words in hub.js');
else test.fail(OWED + 'searchPeople still reads ' + short(sp.slice(0, 300)));

test.subHeading('3. mine and blocked are yes-filters beside q');
const only = function (f) { return rowsOf(hub.searchPeople(PEOPLE, '', f)).map(function (r) { return r.key; }); };
if (JSON.stringify(only({ mine: 'yes' })) === '["K-pup"]' && JSON.stringify(only({ blocked: 'yes' })) === '["K-dave"]') test.check('mine: yes answers the puppets only; blocked: yes alike');
else test.fail(OWED + 'filters answer ' + short([only({ mine: 'yes' }), only({ blocked: 'yes' })]));
const cs = fnBody(hubSrc, 'contactSearch');
const server = fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8');
// The contact family's search in the flat door's tables since goal/G30.5: the 'search' whose handler is hub.contactSearch.
const route = (server.match(/'search':\s*\{\s*request:\s*\{[^}]*\}[^\n]*hub\.contactSearch/) || [''])[0];
if (/searchPeople\([^;]*body\s*\)/.test(cs) && /mine/.test(route) && /blocked/.test(route) && !/owned/.test(route)) test.check('the node hands the filters through: contactSearch passes the body, the route declares mine and blocked, and no owned');
else test.fail(OWED + 'contactSearch ' + short(cs.slice(0, 200)) + '; the route ' + short(route));
const shellJs = strip(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'shell.js'), 'utf8'));
if (/contact\.search['"],\s*\{[^}]*mine:\s*['"]yes['"]/.test(shellJs) && !/contact\.search['"],\s*\{\s*q:\s*['"]owned['"]/.test(shellJs)) test.check('shell.js finds what it owns with mine: yes, not by the word owned');
else test.fail(OWED + 'shell.js still finds puppets by the word: ' + short((shellJs.match(/contact\.search[^)]*\)/g) || []).join(' | ')));

test.reportSuccessFailureCount();
process.exit(0);
