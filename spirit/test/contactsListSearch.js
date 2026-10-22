'use strict';

// spirit/test/contactsListSearch.js
// goal/G29.6: THE PEER PICKER ON THE SHARED LIST, CONTACTS FIRST. Red on today's tree; claude-windows writes it and
// builds it. The item's box (v10), in short:
//   - contactSelector becomes a thin wrapper around shellCreateListSearch (goal/G29.4), for Contacts, chatter and every
//     place a peer is picked.
//   - Columns: fixed ★ (my puppet: an owned contact, its card naming this node its owner, goal/G19.8; a tooltip says
//     so), presence (green or white), the name; then one configurable status column [{status, iconKey}].
//   - A star says it all: the word " — owned" leaves the label.
//   - Filters: one per state, owned (★), blocked and held, each shown only when the list holds any.
//   - contact.search (a node verb, changed by Andy's grant) answers {key: public key, label: json {name, owned, blocked,
//     held}} and takes owned, blocked and held as yes-filters beside q; shell.js finds the puppets with owned: yes.
//   - The app repaints one row when presence or status changes, without asking the server.
//   - ONE BY ONE, STARTING WITH CONTACTS: hub's contact.search ranks with the probability modules.
// Andy, 2026-10-17, on the old design: "no fucking protecting old design." A row's name comes from the row; a rename is
// a publish on the node's stream, and the list asks again.
// rule/11: through testSupport only. No node: hub's pure functions, and a fake page.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.6: ';
const RUN = path.join(__dirname, '..', 'run');
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const short = function (x) { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > 300 ? s.slice(0, 300) + '…' : s; };
const strip = function (src) { return src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };

test.startTest('goal/G29.6: the peer picker on the shared list, Contacts first');

// ── THE NODE: contact.search's rows and its ranking ──
const hub = require('../run/js/hub.js');
const PEOPLE = [
  { publicKey: 'K-bert', tail: 'aaaaaa', publicLabel: 'Bert', myLabel: '', held: false, blocked: false, owned: false },
  { publicKey: 'K-bertie', tail: 'bbbbbb', publicLabel: 'Bertie', myLabel: '', held: false, blocked: false, owned: false },
  { publicKey: 'K-pup', tail: 'cccccc', publicLabel: 'pup', myLabel: '', held: false, blocked: false, owned: true },
  { publicKey: 'K-dave', tail: 'dddddd', publicLabel: 'dave', myLabel: '', held: false, blocked: true, owned: false },
  { publicKey: 'K-carol', tail: 'eeeeee', publicLabel: 'carol', myLabel: '', held: true, blocked: false, owned: false },
];
const rowsOf = function (r) { return ((r && r.items) || []).map(function (i) { let l = null; try { l = JSON.parse(i.label); } catch (e) { l = null; } return { key: i.key, label: l, raw: i.label }; }); };

test.subHeading('1. contact.search answers each peer as {key, label: json {name, owned, blocked, held}}');
let pupLabel = null;
try { pupLabel = JSON.parse(hub.contactLabel(PEOPLE[2])); } catch (e) { pupLabel = null; }
if (pupLabel && pupLabel.name === 'pup' && pupLabel.owned === true && pupLabel.blocked === false && pupLabel.held === false) test.check('a label is json {name, owned, blocked, held}: ' + hub.contactLabel(PEOPLE[2]));
else test.fail(OWED + 'the label reads ' + short(hub.contactLabel(PEOPLE[2])));
const all = rowsOf(hub.searchPeople(PEOPLE, ''));
if (all.length === 5 && all.every(function (r) { return r.label && !/ — /.test(r.label.name || ''); })) test.check('no state word in any name: a star says it all');
else test.fail(OWED + 'the book answers ' + short(all.map(function (r) { return r.raw; })));

test.subHeading('2. it ranks with the probability modules');
const bert = rowsOf(hub.searchPeople(PEOPLE, 'Bert'));
if (bert.length && bert[0].key === 'K-bert' && bert.some(function (r) { return r.key === 'K-bertie'; }) && !bert.some(function (r) { return r.key === 'K-carol'; })) test.check('"Bert" answers Bert first, then Bertie, and not carol');
else test.fail(OWED + '"Bert" answers ' + short(bert.map(function (r) { return r.key; })));
const hubSrc = strip(fs.readFileSync(path.join(RUN, 'js', 'hub.js'), 'utf8'));
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

test.subHeading('3. owned, blocked and held are yes-filters beside q');
const only = function (f) { return rowsOf(hub.searchPeople(PEOPLE, '', f)).map(function (r) { return r.key; }); };
if (JSON.stringify(only({ owned: 'yes' })) === '["K-pup"]' && JSON.stringify(only({ blocked: 'yes' })) === '["K-dave"]' && JSON.stringify(only({ held: 'yes' })) === '["K-carol"]') test.check('owned: yes answers the puppets only; blocked: yes and held: yes alike');
else test.fail(OWED + 'filters answer ' + short([only({ owned: 'yes' }), only({ blocked: 'yes' }), only({ held: 'yes' })]));
const cs = fnBody(hubSrc, 'contactSearch');
const server = fs.readFileSync(path.join(RUN, 'js', 'server.js'), 'utf8');
// The contact family's search in the flat door's tables since goal/G30.5: the 'search' whose handler is hub.contactSearch.
const route = (server.match(/'search':\s*\{\s*request:\s*\{[^}]*\}[^\n]*hub\.contactSearch/) || [''])[0];
if (/searchPeople\([^;]*body\s*\)/.test(cs) && /owned/.test(route) && /blocked/.test(route) && /held/.test(route)) test.check('the node hands the filters through: contactSearch passes the body, the route declares owned, blocked and held');
else test.fail(OWED + 'contactSearch ' + short(cs.slice(0, 200)) + '; the route ' + short(route));
const shellJs = strip(fs.readFileSync(path.join(RUN, 'js', 'client', 'shell.js'), 'utf8'));
if (/contact\.search['"],\s*\{[^}]*owned:\s*['"]yes['"]/.test(shellJs) && !/contact\.search['"],\s*\{\s*q:\s*['"]owned['"]/.test(shellJs)) test.check('shell.js finds the puppets with owned: yes, not by the word owned');
else test.fail(OWED + 'shell.js still finds puppets by the word: ' + short((shellJs.match(/contact\.search[^)]*\)/g) || []).join(' | ')));

// ── THE PICKER: contactSelector on shellCreateListSearch ──
function fakeElement(tag, id) {
  let html = '';
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', value: '', textContent: '', hidden: false, style: {}, listeners: {}, children: [], className: '', attrs: {}, title: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    dispatchEvent: function (event) { el.fire(event.type, event); if (event.bubbles) el.bubbled = (el.bubbled || 0) + 1; return true; },
    getAttribute: function (n) { return el.attrs[n] == null ? null : el.attrs[n]; }, setAttribute: function (n, v) { el.attrs[n] = String(v); },
    appendChild: function (c) { el.children.push(c); c.parentNode = el; return c; }, contains: function () { return true; },
    focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html + el.children.map(function (c) { return c.innerHTML || ''; }).join(''); }, set: function (v) { html = String(v); el.children = []; }, enumerable: true });
  return el;
}
function page(asks) {
  const byId = {};
  const doc = {
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div', id)); },
    createElement: function (tag) { return fakeElement(tag, ''); },
    addEventListener: function () {}, body: fakeElement('body'),
  };
  const win = {};
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  const ICON = { STAR: '⭐', GREEN_CIRCLE: '🟢', WHITE_CIRCLE: '⚪', WAITING: '⏳', NO: '🚫' };
  const spirit = { core: { util: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }, const: { ICON: ICON },
    ask: function (verb, args) { asks.push([verb, args]); return Promise.resolve({ status: 200, body: verb === 'contact.search' ? hub.searchPeople(PEOPLE, args && args.q, args) : { ok: false } }); } } };
  test.spiritFor(spirit.core.ask, spirit);
  function Event(type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); }
  const LIST = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');
  new Function('document', 'window', fs.readFileSync(LIST, 'utf8'))(doc, win);
  const made = [];
  const real = win.spirit.elements.shellCreateListSearch;
  win.spirit.elements.shellCreateListSearch = function (el, cfg) { const l = real(el, cfg); made.push({ el: el, cfg: cfg, list: l }); return l; };
  new Function('spirit', 'document', 'window', 'Event', fs.readFileSync(path.join(RUN, 'shell', 'js', 'contactSelector.js'), 'utf8'))(spirit, doc, win, Event);
  return { byId: byId, doc: doc, win: win, made: made, ICON: ICON };
}
const listHtml = function (p, m) {
  const ids = (m.el.innerHTML.match(/id="([^"]+)"/g) || []).map(function (s) { return s.slice(4, -1); });
  const listId = ids.filter(function (i) { return /list$/.test(i); })[0];
  const filtersId = ids.filter(function (i) { return /filters$/.test(i); })[0];
  return { list: listId ? p.doc.getElementById(listId).innerHTML : '', filters: filtersId ? p.doc.getElementById(filtersId).innerHTML : m.el.innerHTML, ids: ids };
};

(async function main() {
  test.subHeading('4. contactSelector is a wrapper around shellCreateListSearch');
  const asks = [];
  const p = page(asks);
  const make = p.win.spirit.elements && p.win.spirit.elements.createContactSelector;
  if (typeof make !== 'function') { test.fail(OWED + 'no createContactSelector'); test.reportSuccessFailureCount(); process.exit(0); }
  const changes = [];
  const root = make({ face: 'pane', statuses: [{ status: 'none' }, { status: 'unanswered', iconKey: 'WAITING' }] });
  root.addEventListener('change', function (e) { changes.push(e); });
  await sleep(30);
  const m = p.made[0];
  if (p.made.length === 1 && m.cfg && typeof m.cfg.paint === 'function') test.check('it makes one shellCreateListSearch and paints its rows');
  else { test.fail(OWED + 'contactSelector made ' + p.made.length + ' shared list(s)'); test.reportSuccessFailureCount(); process.exit(0); }
  const firstAsk = asks.filter(function (a) { return a[0] === 'contact.search'; })[0];
  if (firstAsk) test.check('with no search of its own it asks the node\'s contact.search');
  else test.fail(OWED + 'it asked ' + short(asks));

  test.subHeading('5. its columns: ★, presence, name, status');
  let h = listHtml(p, m);
  const pupRow = (h.list.match(/<tr[^>]*data-key="K-pup"[^>]*>[\s\S]*?<\/tr>/) || [''])[0];
  const bertRow = (h.list.match(/<tr[^>]*data-key="K-bert"[^>]*>[\s\S]*?<\/tr>/) || [''])[0];
  const order = [pupRow.indexOf('⭐'), pupRow.indexOf('⚪'), pupRow.indexOf('pup', pupRow.indexOf('⚪'))];
  if (pupRow && order.every(function (i, n) { return i !== -1 && (n === 0 || i > order[n - 1]); })) test.check('a puppet\'s row: ★, then the presence dot, then its name');
  else test.fail(OWED + 'the puppet\'s row reads ' + short(pupRow));
  if (/title="[^"]*puppet[^"]*"/i.test(pupRow)) test.check('the star carries a tooltip saying it is your puppet');
  else test.fail(OWED + 'no tooltip on the star: ' + short(pupRow));
  if (bertRow && bertRow.indexOf('⭐') === -1 && /Bert/.test(bertRow)) test.check('a contact that is not yours has an empty star cell');
  else test.fail(OWED + 'Bert\'s row reads ' + short(bertRow));
  if (!/ — owned| — blocked| — waiting/.test(h.list)) test.check('no state word is drawn in any name');
  else test.fail(OWED + 'state words still drawn: ' + short(h.list));

  test.subHeading('6. filters per state, shown only when the list holds any');
  const hf = h.filters;
  if (/⭐/.test(hf) && /blocked/i.test(hf) && /held|waiting/i.test(hf)) test.check('the book holds a puppet, a blocked and a held contact: all three filters show');
  else test.fail(OWED + 'the filters read ' + short(hf));
  const asks2 = [];
  const p2 = page(asks2);
  p2.win.spirit.elements.createContactSelector({ face: 'pane', search: function () { return { items: [{ key: 'K-bert', label: hub.contactLabel(PEOPLE[0]) }], more: false }; } });
  await sleep(30);
  const hf2 = listHtml(p2, p2.made[0]).filters;
  if (!/⭐/.test(hf2) && !/blocked/i.test(hf2) && !/held|waiting/i.test(hf2)) test.check('a list holding none of them shows none of those filters');
  else test.fail(OWED + 'a plain list shows filters ' + short(hf2));
  // One row of mutually exclusive choices since goal/G30.7 (Andy: "Gimme 3 Buttons ... where all 3 are mutually
  // exclusive"): the filter is 'show', and my puppets is its value 'owned'.
  const fOwned = (m.cfg.filters || []).filter(function (f) { return f.name === 'show'; })[0];
  const argsOn = m.cfg.args('', { show: 'owned' });
  if (fOwned && fOwned.test({ owned: true }, 'owned') === 1 && fOwned.test({ owned: false }, 'owned') === 0 && argsOn && argsOn.owned === 'yes') test.check('the ★ choice passes puppets only, and asks contact.search with owned: yes');
  else test.fail(OWED + 'the owned filter ' + short(fOwned) + ', args ' + short(argsOn));

  test.subHeading('7. presence and status repaint one row, without asking the node');
  const before = asks.length;
  root.present('K-bert', true);
  root.mark('K-bert', 'unanswered');
  h = listHtml(p, m);
  const bert2 = (h.list.match(/<tr[^>]*data-key="K-bert"[^>]*>[\s\S]*?<\/tr>/) || [''])[0];
  if (/🟢/.test(bert2) && /⏳/.test(bert2) && asks.length === before) test.check('present() and mark() redraw Bert green and waiting, and the node is not asked');
  else test.fail(OWED + 'after present and mark Bert reads ' + short(bert2) + ', asks ' + (asks.length - before));

  test.subHeading('8. a pick sets its value and says so');
  // goal/G29.9: a press on the row, as a click lands on the list; in the pane with no details hook it is a pick.
  m.el.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-key' ? 'K-pup' : null; }, closest: function () { return null; } } });
  if (root.value === 'K-pup' && changes.length === 1 && changes[0].bubbles) test.check('a press on a row sets value to its key and fires one bubbling change');
  else test.fail(OWED + 'after a press value is ' + short(root.value) + ', ' + changes.length + ' change(s)');
  // goal/G4.14 stands: "the pane usually has a \"current\" which is the equivalent of selected in the drop-box".
  const chosen = listHtml(p, m).list;
  const pupNow = (chosen.match(/<tr[^>]*data-key="K-pup"[^>]*>[\s\S]*?<\/tr>/) || [''])[0];
  const bertNow = (chosen.match(/<tr[^>]*data-key="K-bert"[^>]*>[\s\S]*?<\/tr>/) || [''])[0];
  // Since goal/G29.9 the list draws the current row itself, the same in every list.
  if (/<tr[^>]*class="current"/.test(pupNow) && !/current/.test(bertNow)) test.check('the chosen row alone is drawn current, by the shared list');
  else test.fail(OWED + 'after the pick the rows read ' + short([pupNow, bertNow]));

  test.subHeading('9. callers with their own rows still work');
  const asks3 = [];
  const p3 = page(asks3);
  p3.win.spirit.elements.createContactSelector({ face: 'pane', search: function () { return { items: [{ key: 'K-chat' }], more: false }; } });
  p3.win.spirit.elements.createContactSelector({ face: 'pane', contacts: [{ key: 'K-own', label: 'Ownrow' }] });
  await sleep(30);
  const l3a = listHtml(p3, p3.made[0]).list;
  const l3b = listHtml(p3, p3.made[1]).list;
  if (/data-key="K-chat"/.test(l3a) && /data-key="K-own"/.test(l3b) && /Ownrow/.test(l3b) && !asks3.length) test.check('options.search rows without a label, and options.contacts rows, are listed without asking the node');
  else test.fail(OWED + 'own rows read ' + short([l3a, l3b, asks3]));

  // Since goal/G30.19 Contacts' book is its one list, contactSearch (the book, the shadow and the network), not the
  // picker; the rule this section kept stands: no state words read off a label.
  test.subHeading('10. Contacts lists its book with the one list');
  const contacts = strip(fs.readFileSync(path.join(RUN, 'shell', 'contacts', 'contacts.js'), 'utf8'));
  if (/spirit\.elements\.contactList\.create\(/.test(contacts) && !/CONTACTS_STATE_BLOCKED|CONTACTS_STATE_WAITING|contactsLabelHtml/.test(contacts)) test.check('Contacts\' book is its one list (contactSearch); it reads no state words off a label');
  else test.fail(OWED + 'Contacts still draws its own book table from label words');
  const sel = strip(fs.readFileSync(path.join(RUN, 'shell', 'js', 'contactSelector.js'), 'utf8'));
  if (!/contact-selector-rows|contact-selector-search/.test(sel) && !/createContactLabel/.test(sel)) test.check('the selector draws no list or search box of its own any more');
  else test.fail(OWED + 'contactSelector still builds its own list and search box');

  test.reportSuccessFailureCount();
  process.exit(0);
}()).catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
