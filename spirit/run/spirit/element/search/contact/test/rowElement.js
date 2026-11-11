'use strict';

// spirit/run/spirit/element/search/contact/test/rowElement.js
// The tests of spirit/element/search/contact/rowElement.js, and of no other module: one contact as a row element (spec:
// ./rowElement.md). The browser file runs in node on a window of its own, over the shared rowElement.js and the
// faceless layer it reads, with the contact family's data.js (goal/G41.28) loaded as a page's
// spirit.cacheManager('contact') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.homeNode); the node behind spirit.ready is a recorder. After it, the parts once files of their own: noHeld (the
// row offers no heldActions, its code read) and relayOnFace (a relay's row opens the relay on a real face, in a real
// Chrome). The one test file of contact/rowElement.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const JS = path.join(__dirname, '..', '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
const asked = [];
const layers = [];
const required = [];
const managers = [];
function verb(name) { return function (body) { asked.push({ verb: name, body: body }); return Promise.resolve({ ok: name }); }; }
// The mounter's panel stack's open (spirit/element/panel.js): it records the layer asked for and fills a pane at once.
function openLayer(key, spec) { layers.push({ key: key, label: spec.label }); return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); }
const names = function (el) { return el.actions.map(function (a) { return a.name; }).join(','); };
const cell = function (el, name) { return el.cells().filter(function (c) { return c.name === name; })[0].html; };
function hostsFor(el) { const h = {}; el.fields.forEach(function (f) { h[f] = { innerHTML: '' }; }); return h; }
let C = null, D = null, CD = null, V = null;
let kept, stranger, relay, blocked, ha, hb, ho, found, hf, labelField, gets = null, m = 0;
const NO_ROW = 'no contact row element: the world failed';
const NO_CD = 'no contact data on the page: the row never loaded the contact family\'s cache manager';
const NO_ROWS = 'the rows were never made';

test.run('the world: the contact row runs on a window of its own, the data set and the contact family\'s data real', 0.2, function () {
  global.window = { spirit: {} };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = window.spirit;
  window.spirit.ready = Promise.resolve({ contact: { block: verb('contact.block'), unblock: verb('contact.unblock'),
    forget: verb('contact.forget'), label: verb('contact.label'), get: verb('contact.get') }, peer: { acquire: verb('peer.acquire') } });
  window.spirit.fieldRules = { normalize: function (t) { return String(t || '').trim(); },
    problem: function (t) { return t ? '' : 'a name is needed'; }, MAX_BYTES: 64 };
  // The details, made in a panel's pane (goal/G43.18): each records what it was made with.
  // goal/G43.32: what the row opens stands where an element now finds it, spirit.element.spirit.element.
  (((window.spirit.element = window.spirit.element || {}).spirit = window.spirit.element.spirit || {})).element = { search: { contact: { detailElement: { create: function (pane, o) { asked.push({ verb: 'contactDetails', body: o }); return {}; } } } } };
  // The one loader, a recorder: what the row requires, answered at once (the pages above stand in for what it loads).
  // goal/G43.32: the helper an element places itself with comes from the page stand-in (headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  const pageRequire = window.spirit.require;
  window.spirit.require = function (p) { required.push(p); return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : Promise.resolve({}); };
  load(path.join(JS, '..', '..', 'spirit', 'data.js'));
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  window.spirit.node = { key: NODE_KEY };
  window.spirit.data.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    load(path.join(JS, '..', '..', 'spirit', String(name), 'data.js'));
    return Promise.resolve(true);
  };
  load(path.join(JS, 'rowElement.js'));
  load(path.join(JS, 'search', 'contact', 'rowElement.js'));
  C = window.spirit.element.spirit.element.search.contact.rowElement;
  D = window.spirit.data;
  CD = ((window.spirit.data || {}).contact || {}).data;
  // The direct writes below are the contact family's own view of the home node, as its manager files them.
  V = D.viewAt(null, 'contact');
  return true;
}, 1000);

// what a row offers depends on what it is
test.run('a kept or blocked row: open, block, unblock, remove', 0.2, function () {
  if (!C) return NO_ROW;
  kept = C.create({ key: 'K1', name: 'anna', keep: true }, { open: openLayer });
  stranger = C.create({ key: 'K2', publicLabel: 'bob' }, { open: openLayer });
  relay = C.create({ key: 'R1', relay: true, keep: true, url: 'wss://r.example' }, { open: openLayer });
  blocked = C.create({ key: 'K3', blocked: true });
  return names(kept) === 'open,block,unblock,remove' && names(blocked) === 'open,block,unblock,remove' ? true : 'kept: ' + names(kept) + ', blocked: ' + names(blocked);
}, 1000);
test.run('a row not in the book: add, and only add', 0.2, function () {
  if (!stranger) return NO_ROWS;
  return names(stranger) === 'add' ? true : 'not in the book: ' + names(stranger);
}, 1000);
test.run('a relay: open, even when kept', 0.2, function () {
  if (!relay) return NO_ROWS;
  return names(relay) === 'open' ? true : 'relay: ' + names(relay);
}, 1000);
test.run('kind contact, keyed by the public key, fields presence, status, label, add, and the caller\'s mark (goal/G43.32)', 0.2, function () {
  if (!kept) return NO_ROWS;
  return kept.kind === 'contact' && kept.key === 'K1' && kept.fields.join(',') === 'presence,status,label,add,mark' ? true : 'the element: ' + JSON.stringify({ kind: kept.kind, key: kept.key, fields: kept.fields });
}, 1000);
test.run('a row carrying publicKey instead of key is keyed by it', 0.2, function () {
  if (!C) return NO_ROW;
  const byPublic = C.create({ publicKey: 'K9', keep: true });
  return byPublic.key === 'K9' ? true : 'publicKey row keyed ' + byPublic.key;
}, 1000);
test.run('the row loads the contact family\'s cache manager, which puts ((spirit.data || {}).contact || {}).data on the page', 0.2, function () {
  return managers.indexOf('contact') !== -1 && CD && typeof CD.contact === 'function' ? true : 'managers asked: ' + JSON.stringify(managers);
}, 1000);

// the actions ask the node, and paint nothing
test.run('add asks peer.acquire with the key and the name it gave the relay', 0.2, async function () {
  if (!stranger) return NO_ROWS;
  await stranger.act('add');
  const add = asked.pop();
  return add && add.verb === 'peer.acquire' && add.body.publicKey === 'K2' && add.body.publicLabel === 'bob' ? true : 'add asked: ' + JSON.stringify(add);
}, 1000);
test.run('block, unblock, remove ask contact.block, contact.unblock, contact.forget by the key', 0.2, async function () {
  if (!kept) return NO_ROWS;
  await kept.act('block'); await kept.act('unblock'); await kept.act('remove');
  const three = asked.splice(-3).map(function (a) { return a.verb + ':' + a.body.publicKey; }).join(',');
  return three === 'contact.block:K1,contact.unblock:K1,contact.forget:K1' ? true : 'the book actions asked: ' + three;
}, 1000);
let opens = null;
// GOAL/G43.32 (Andy: "the contact list already knows the difference between contact types. so should the detail panel."): one
// detail opens for both, told what the row is; it draws a relay's panel or a person's.
test.run('open: the one contact detail, by key, told a person from a relay (goal/G43.32)', 0.2, async function () {
  if (!kept) return NO_ROWS;
  await kept.act('open'); await relay.act('open');
  opens = asked.splice(-2);
  return opens[0].verb === 'contactDetails' && opens[0].body.key === 'K1' && opens[0].body.relay === false && opens[1].verb === 'contactDetails' && opens[1].body.key === 'R1' && opens[1].body.relay === true ? true : 'opens: ' + JSON.stringify(opens);
}, 1000);
// GOAL/G43.18: as a panel over the list, through the mounter's open; handed the layer, no api (goal/G43.24).
test.run('each opens as a layer of the mounter\'s panel stack, handed that layer\'s close and title and no api (goal/G43.24)', 0.2, function () {
  if (!opens) return 'nothing was opened';
  return layers.length === 2 && layers[0].key === 'contact/contact/K1' && layers[1].key === 'contact/relay/R1' && opens.every(function (o) { return !('api' in o.body) && o.body.layer && typeof o.body.layer.close === 'function' && typeof o.body.layer.setTitle === 'function'; })
    ? true : 'layers: ' + JSON.stringify(layers) + ', made with ' + JSON.stringify(opens.map(function (o) { return Object.keys(o.body); }));
}, 1000);
test.run('open loads the detail it opens first, through spirit.require, for a person and a relay alike', 0.2, function () {
  const pages = required.slice(-2).join(',');
  return pages === 'spirit/element/search/contact/detailElement.js,spirit/element/search/contact/detailElement.js' ? true : 'open required: ' + pages;
}, 1000);
// goal/G43.32, decided 5: every element script also requires installSpiritElement, to place itself; that is no part it draws with.
test.run('the row loads the shared row element it is built on itself, through spirit.require', 0.2, function () {
  const parts = required.filter(function (p) { return p !== 'spirit/element/installSpiritElement.js'; });
  return parts[0] === 'spirit/element/rowElement.js' ? true : 'as it loaded, the row required: ' + JSON.stringify(parts.slice(0, 1));
}, 1000);
test.run('an action the row does not offer asks nothing', 0.2, async function () {
  if (!stranger) return NO_ROWS;
  const before = asked.length;
  const none = await stranger.act('block');
  return none === null && asked.length === before ? true : 'a row not in the book: its block asked ' + JSON.stringify(asked.slice(before));
}, 1000);

// the cells
test.run('presence: 🟢 present, 🔴 absent, ⚪ not known', 0.2, function () {
  if (!kept) return NO_ROWS;
  return cell(kept, 'presence').indexOf('⚪') !== -1 && cell(C.create({ key: 'K4', keep: true, present: true }), 'presence').indexOf('🟢') !== -1
    && cell(C.create({ key: 'K5', keep: true, present: false }), 'presence').indexOf('🔴') !== -1 ? true : 'presence cells';
}, 1000);
test.run('status: blocked ❌ over mine ⭐, a plain kept row and a row not in the book blank', 0.2, function () {
  if (!kept) return NO_ROWS;
  const statuses = { blocked: cell(blocked, 'status'), stranger: cell(stranger, 'status'), mine: cell(C.create({ key: 'K7', mine: true }), 'status'), kept: cell(kept, 'status') };
  return statuses.blocked === '❌' && statuses.stranger === '' && statuses.mine === '⭐' && statuses.kept === '' ? true : 'status cells: ' + JSON.stringify(statuses);
}, 1000);
test.run('the label is the name, escaped', 0.2, function () {
  if (!C) return NO_ROW;
  const l = cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label');
  return l === '&lt;b&gt;x&lt;/b&gt;' ? true : 'label cell: ' + l;
}, 1000);
test.run('the Add button only on a row not in the book and not a relay', 0.2, function () {
  if (!kept) return NO_ROWS;
  return cell(stranger, 'add').indexOf('data-action="add"') !== -1 && cell(kept, 'add') === '' && cell(C.create({ key: 'R2', relay: true }), 'add') === '' ? true : 'add cells: ' + JSON.stringify([cell(stranger, 'add'), cell(kept, 'add')]);
}, 1000);

// the contacts repaint the rows that show that key, only the fields that changed
test.run('a row made after presence is known starts with the known dot', 0.2, function () {
  if (!V) return NO_CD;
  V.set('contacts/K10', { present: true });
  const late = C.create({ key: 'K10', keep: true, present: false });
  return cell(late, 'presence').indexOf('🟢') !== -1 ? true : 'a late row\'s dot: ' + cell(late, 'presence');
}, 1000);
let a = null, b = null;
test.run('a write to a key repaints every row of that key', 0.2, function () {
  if (!V) return NO_CD;
  a = C.create({ key: 'K11', keep: true, name: 'carl' });
  b = C.create({ key: 'K11', keep: true, name: 'carl' });
  const other = C.create({ key: 'K12', keep: true, name: 'dora' });
  ha = hostsFor(a); a.mount(ha);
  hb = hostsFor(b); b.mount(hb);
  ho = hostsFor(other); other.mount(ho);
  ha.status.innerHTML = 'untouched'; hb.label.innerHTML = 'stale'; ho.presence.innerHTML = 'untouched';
  V.merge('contacts/K11', { present: true, name: 'Carl' });
  return ha.presence.innerHTML.indexOf('🟢') !== -1 && ha.label.innerHTML === 'Carl' && hb.label.innerHTML === 'Carl' ? true : 'after the write: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML });
}, 1000);
test.run('a field whose value did not change, and another key\'s row, are not repainted', 0.2, function () {
  if (!ha) return NO_ROWS;
  return ha.status.innerHTML === 'untouched' && ho.presence.innerHTML === 'untouched' ? true : 'repainted beyond the change: ' + JSON.stringify({ status: ha.status.innerHTML, other: ho.presence.innerHTML });
}, 1000);
test.run('a flag the status is drawn from repaints the status', 0.2, function () {
  if (!ha) return NO_ROWS;
  V.merge('contacts/K11', { blocked: true });
  return ha.status.innerHTML === '❌' ? true : 'status after block: ' + ha.status.innerHTML;
}, 1000);
// A row added stays on the page and becomes a row of the book: its Add goes, and it offers what a kept row offers.
test.run('a row the owner adds loses its Add, and offers open, block, unblock, remove', 0.2, function () {
  if (!V) return NO_CD;
  found = C.create({ key: 'K14', publicLabel: 'finn' });
  hf = hostsFor(found); found.mount(hf);
  const beforeAdd = names(found) + '|' + (hf.add.innerHTML.indexOf('data-action="add"') !== -1);
  V.merge('contacts/K14', { keep: true });
  return beforeAdd === 'add|true' && hf.add.innerHTML === '' && names(found) === 'open,block,unblock,remove' ? true : 'a row after its add: ' + JSON.stringify({ before: beforeAdd, add: hf.add.innerHTML, actions: names(found) });
}, 1000);
test.run('and its new actions ask the node', 0.2, async function () {
  if (!found) return NO_ROWS;
  await found.act('block');
  const blockAfterAdd = asked.pop();
  return blockAfterAdd && blockAfterAdd.verb === 'contact.block' && blockAfterAdd.body.publicKey === 'K14' ? true : 'block after the add asked: ' + JSON.stringify(blockAfterAdd);
}, 1000);
test.run('a row that leaves the book offers Add again', 0.2, function () {
  if (!found) return NO_ROWS;
  V.merge('contacts/K14', { keep: false });
  return names(found) === 'add' && hf.add.innerHTML.indexOf('data-action="add"') !== -1 ? true : 'a row out of the book: ' + JSON.stringify({ add: hf.add.innerHTML, actions: names(found) });
}, 1000);
test.run('a destroyed row leaves the dispatch; the others stay', 0.2, function () {
  if (!b) return NO_ROWS;
  b.destroy();
  hb.label.innerHTML = 'after destroy';
  V.merge('contacts/K11', { name: 'Carla' });
  return hb.label.innerHTML === 'after destroy' && ha.label.innerHTML === 'Carla' ? true : 'after destroy: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML });
}, 1000);

// the label's editor checks the rule before it asks
test.run('a name the rule refuses is refused here, and not asked', 0.2, async function () {
  if (!C) return NO_ROW;
  labelField = (function () { let f = null; const p = window.spirit.element.spirit.element.rowElement.create;
    window.spirit.element.spirit.element.rowElement.create = function (parts) { f = parts.fields.filter(function (x) { return x.name === 'label'; })[0]; return p(parts); };
    C.create({ key: 'K13', keep: true }); window.spirit.element.spirit.element.rowElement.create = p; return f; }());
  const n = asked.length;
  const bad = await labelField.edit({ key: 'K13' }, '   ');
  return bad.ok === false && bad.error === 'a name is needed' && asked.length === n ? true : 'a bad name: ' + JSON.stringify(bad);
}, 1000);
test.run('a good name is normalized and asked of contact.label', 0.2, async function () {
  if (!labelField) return 'no label field';
  const good = await labelField.edit({ key: 'K13' }, '  Eve  ');
  const lab = asked.pop();
  return good.ok === true && lab.verb === 'contact.label' && lab.body.publicKey === 'K13' && lab.body.myLabel === 'Eve' ? true : 'a good name: ' + JSON.stringify({ good: good, lab: lab });
}, 1000);

// expandInfo asks contact.get once, for a row in the book
test.run('contact.get by key, once, the answer kept', 0.2, async function () {
  if (!kept) return NO_ROWS;
  m = asked.length;
  await kept.expandInfo(); await kept.expandInfo();
  gets = asked.slice(m).filter(function (x) { return x.verb === 'contact.get'; });
  return gets.length === 1 && gets[0].body.key === 'K1' ? true : 'contact.get asked ' + gets.length + ' times';
}, 1000);
test.run('a row not in the book and a relay expand to nothing, asking nothing', 0.2, async function () {
  if (!gets) return NO_ROWS;
  const nothing = [await stranger.expandInfo(), await relay.expandInfo()];
  return nothing[0] === null && nothing[1] === null && asked.length === m + 1 ? true : 'not in the book/relay expand: ' + JSON.stringify(nothing);
}, 1000);

// ── WHAT THE STREAM MEANS FOR CONTACTS, IN THE TYPE'S OWN ELEMENT (goal/G41.16; Andy: "get rid of thos FUCKING data.js
// scripts, DIDN't WE INSIST on the PROPER way to do this shit?"). The contacts' translation, spirit/element/search/contact/data.js
// until then, was the row element's (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates"), and is since goal/G41.28 the contact family's cache manager's, which the row element loads: no data script required.
// the type's own element takes the contacts' stream: no data script
test.run('the contact row element requires no data script', 0.2, function () {
  if (!C) return NO_ROW;
  return !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'the contact row element still requires ' + required.filter(function (p) { return /data\.js$/.test(p); }).join(', ');
}, 1000);
const row = function (k) { return CD.contact(k); };
// relay-presence sets present, by key
test.run('a present key reads present, an absent one absent', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  return row('KA') && row('KA').present === true && row('KB') && row('KB').present === false ? true : 'presence: ' + JSON.stringify({ a: row('KA'), b: row('KB') });
}, 1000);
test.run('the same table again writes nothing', 0.2, function () {
  if (!CD) return NO_CD;
  let writes = 0;
  const stop = CD.watch(function (key) { if (key === 'KA') writes += 1; });
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  stop();
  return writes === 0 ? true : 'an unchanged presence wrote ' + writes + ' times';
}, 1000);
test.run('a key the table drops goes back to not known; the others stand', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KB: { present: false } } } });
  return row('KA') && row('KA').present === undefined && (row('KB') || {}).present === false ? true : 'a dropped key: ' + JSON.stringify(row('KA'));
}, 1000);
test.run('an entry that is no proof writes nothing', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KC: 'not a proof', KD: null } } });
  return row('KC') === null && row('KD') === null ? true : 'a bad entry wrote: ' + JSON.stringify({ c: row('KC'), d: row('KD') });
}, 1000);

// peer-search seats the row the network found
test.run('the item\'s label is merged into its row, by key', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeJob({ id: 'spirit.contact', data: { q: 'be', item: { key: 'KE', label: JSON.stringify({ name: 'bert', blocked: true }) } } });
  return row('KE') && row('KE').name === 'bert' && row('KE').blocked === true ? true : 'the network row: ' + JSON.stringify(row('KE'));
}, 1000);
test.run('a peer-search update with no item seats nothing', 0.2, function () {
  if (!CD) return NO_CD;
  const seated = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.contact', data: { q: 'be' } });
  // The branch read is the one the rows are in (KE just seated there), so an equal answer judges something.
  return 'KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === seated ? true : 'rows after an empty update: ' + Object.keys(D.branchAt(CD.branch)).join(',');
}, 1000);
test.run('a label that is not JSON seats nothing', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeJob({ id: 'spirit.contact', data: { item: { key: 'KF', label: 'not json' } } });
  return row('KF') === null ? true : 'a bad label seated ' + JSON.stringify(row('KF'));
}, 1000);

// a rename sets the name, and keeps the rest
test.run('contact.rename sets name on the row, its other fields kept', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeRename({ key: 'KE', caption: 'Bertie' });
  return (row('KE') || {}).name === 'Bertie' && (row('KE') || {}).blocked === true ? true : 'after a rename: ' + JSON.stringify(row('KE'));
}, 1000);
test.run('a rename of a key never seen makes its row, the caption as text', 0.2, function () {
  if (!CD) return NO_CD;
  D.takeRename({ key: 'KG', caption: 7 });
  return row('KG') && row('KG').name === '7' ? true : 'a rename of a new key: ' + JSON.stringify(row('KG'));
}, 1000);

// other jobs are not contacts' business
test.run('a job of another type changes no contact', 0.2, function () {
  if (!CD) return NO_CD;
  const beforeC = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.fs', data: { presence: { KZ: { present: true } }, item: { key: 'KZ', label: '{"name":"z"}' } } });
  return 'KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === beforeC ? true : 'another job changed contacts';
}, 1000);

// ── THE PARTS ONCE FILES OF THEIR OWN (rowElement-noHeld.js, rowElement-relayOnFace.js): one test file per script
// (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, run in order.

// ── noHeld (once rowElement-noHeld.js): THE CONTACT ROW OFFERS NO heldActions (goal/G43.23, item 6, after goal/G43.17;
// spec: ./rowElement.md, its noHeld section). Andy, G43.17: "Didn't i say remove ALL code referencing "admit" and "hold". it
// was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.
// A file's code, comments blanked (line numbers kept); null when the file is not there.
function code(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (x) { return x.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}
// The lines of a file's code matching re, as "name:line text".
function hits(file, re) {
  const c = code(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(path.basename(file) + ':' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  return out;
}
const HELD_ROW = path.join(RUN, 'spirit', 'element', 'search', 'contact', 'rowElement.js');
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
test.run('the world: the file is read, and its code, comments left out, still holds a line of code', 0.2, function () {
  const c = code(HELD_ROW);
  const anchor = /rowElement\.create\(/;
  return c !== null && anchor.test(c) ? true
    : (c === null ? path.relative(RUN, HELD_ROW) + ' is not there: nothing judged' : path.relative(RUN, HELD_ROW) + '\'s code holds no ' + anchor + ': the comment stripper ate it, nothing judged');
}, 1000);
test.run('the contact row\'s code holds no heldActions, nothing held', 0.2, function () {
  const h = hits(HELD_ROW, /\bheld/i);
  if (h === null) return path.relative(RUN, HELD_ROW) + ' is not there: nothing judged';
  return !h.length ? true : 'the contact row still offers held actions: ' + short(h);
}, 1000);

// ── relayOnFace (once rowElement-relayOnFace.js): A RELAY'S ROW IS A RELAY'S, ON A FACE (goal/G41.32; spec: ./rowElement.md,
// its relayOnFace section). A contact row follows its row: the presence stream puts a relay's row in the page before
// Contacts' search says relay: yes, and the row must open the relay, never the person's page. What it draws is
// spirit/element/search/contact/rowElement.js's, so it is judged beside it (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS
// WHERE THEY FUCKING BELONG"; moved from the relay row section of shell/test/navigationWrapper-faceStarApps.js). A real
// Chrome: a real scratch node, a real relay, a real face and its login. A face at <name>.localhost is a secure context, as
// a face over https is. A step that could not run is red, never skipped.
const DOMAIN = 'localhost';
const NAME = 'apps';
const MAIL = 'bert@example.org';
const DRAWN_MS = 6000;
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function home(base, v, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: v, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
function page(relayServer, p, body) {
  return new Promise(function (resolve) {
    const bd = JSON.stringify(body);
    const host = NAME + '.' + DOMAIN + ':' + relayServer.port;
    const q = http.request({ host: '127.0.0.1', port: relayServer.port, path: p, method: 'POST', headers: { Host: host, Origin: 'http://' + host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bd) } }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { resolve({ status: r.statusCode, text: text, cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function (e) { resolve({ status: 0, text: String(e && e.message) }); });
    q.end(bd);
  });
}
// A real join, a real face, a real login; answers the session, or why not.
async function faceOf(N, R) {
  await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const joinCode = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!joinCode) return { why: 'the relay mailed no join code' };
  await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: joinCode });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return { why: 'relay.face: ' + short(f && f.text) };
  await until(function () { return page(R, '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await page(R, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await page(R, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short(done.text) };
}
// The names on a desktop, as it reads: icon and name line by line, the name lines only.
async function desktop(chrome, url) {
  await chrome.send('Page.navigate', { url: url });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.event)'); }, 20000);
  await sleep(DRAWN_MS);
  const text = String(await chrome.evaluate('document.body.innerText'));
  return text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return /[A-Za-z]/.test(l); });
}
// What the relayOnFace part makes, for its tests after: the scratch node, the relay, the face's login, Chrome.
const RF = { N: null, R: null, F: null, chrome: null, FACE: '', relayOpened: null };
test.after(function () {
  const chrome = RF.chrome;
  try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  try { if (RF.R) RF.R.stop(); } catch (e) { /* gone */ }
  try { if (RF.N && RF.N.child) RF.N.child.kill(); } catch (e) { /* gone */ }
  try { if (RF.N && RF.N.root) fs.rmSync(RF.N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
// rowElement-relayOnFace: a relay's row in Contacts opens the relay on a face, whichever came first (goal/G41.32)
test.run('the world: a scratch node and a scratch face relay come up', 0.2, async function () {
  RF.N = await scratchNode();
  RF.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  return RF.N.up && RF.R.up ? true : 'the scratch node or relay did not come up: nothing judged';
}, 7000);
test.run('a real node has a real face, logged in', 0.2, async function () {
  if (!RF.N || !RF.N.up || !RF.R || !RF.R.up) return 'no scratch node or relay: the world failed';
  RF.F = await faceOf(RF.N, RF.R);
  return RF.F.sid ? true : 'nothing judged: ' + RF.F.why;
}, 27000);
test.run('the browser holds the login', 0.2, async function () {
  if (!RF.F || !RF.F.sid) return 'no face login: nothing judged';
  const where = findChrome();
  if (!where) return 'no Chrome here: nothing judged';
  RF.chrome = await chromePage(where);
  if (RF.chrome.error) return 'Chrome: ' + RF.chrome.error;
  RF.FACE = 'http://' + NAME + '.' + DOMAIN + ':' + RF.R.port + '/';
  const set = await RF.chrome.send('Network.setCookie', { name: 'spirit_face', value: RF.F.sid, url: RF.FACE, path: '/' });
  return set.result && set.result.success ? true : 'the browser would not take the cookie: ' + short(set);
}, 2000);
// The face's desktop is drawn, so Contacts is there to press.
test.run('the world: the face\'s desktop is drawn, Contacts on it', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return 'no Chrome on the face: nothing judged';
  const plain = await desktop(RF.chrome, RF.FACE);
  return plain.indexOf('Contacts') !== -1 ? true : 'the face drew no desktop, nothing judged: ' + short(plain);
}, 20000);
// A RELAY'S ROW IS A RELAY'S (goal/G41.32; Andy: "where the fuck did the contents of the relayPanel disappear to", "No
// folding panels anymore"; cw, on his node: the presence stream puts the row in the page before Contacts' search says
// relay: yes, so it was made as a person and stayed one). On a face that order is the usual one; a row follows its row.
// a relay's row in Contacts opens the relay, whichever came first
const TILE = '(function () { var a = Array.prototype.slice.call(document.querySelectorAll("*")); var e = a.filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === WORDS; })[0]; if (!e) return false; e.click(); return true; }())';
test.run('Contacts opens, and the relay\'s row is pressed', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return 'no Chrome on the face: nothing judged';
  const press = function (words) { return RF.chrome.evaluate(TILE.replace('WORDS', JSON.stringify(words))); };
  const pressedApp = await press('Contacts');
  await sleep(DRAWN_MS / 2);
  const pressedRow = await press('scratch');
  return pressedApp === true && pressedRow === true ? true : 'Contacts ' + pressedApp + ', row ' + pressedRow + ': ' + short(await RF.chrome.evaluate('document.body.innerText'));
}, 10000);
test.run('its panel opens, with its folds', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return 'no Chrome on the face: nothing judged';
  await until(function () { return RF.chrome.evaluate('document.querySelectorAll(".nd-fold").length > 0'); }, 8000);
  RF.relayOpened = await RF.chrome.evaluate('JSON.stringify({ folds: document.querySelectorAll(".nd-fold").length, person: /Public Handle/.test(document.body.innerText) })').then(JSON.parse);
  return RF.relayOpened.folds > 0 ? true : 'no folds: ' + short(await RF.chrome.evaluate('document.body.innerText'));
}, 25000);
test.run('and not the person\'s page', 0.2, function () {
  if (!RF.relayOpened) return 'the panel was never read: nothing judged';
  return RF.relayOpened.person === false ? true : 'the person\'s page opened for a relay';
}, 1000);
