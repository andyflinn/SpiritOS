'use strict';

// spirit/run/spirit/element/search/contact/test/rowElement.js
// The tests of spirit/element/search/contact/rowElement.js, and of no other module: one contact as a row element (spec:
// ./rowElement.md). The browser file runs in node on a window of its own, over the shared rowElement.js and the
// faceless layer it reads, with the contact family's data.js (goal/G41.28) loaded as a page's
// spirit.cacheManager('contact') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.homeNode); the node behind spirit.ready is a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '..', '..', '..', '..', '..'), 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const asked = [];
function verb(name) { return function (body) { asked.push({ verb: name, body: body }); return Promise.resolve({ ok: name }); }; }
global.window = { spirit: {} };
global.spirit = window.spirit;
window.spirit.ready = Promise.resolve({ contact: { block: verb('contact.block'), unblock: verb('contact.unblock'),
  forget: verb('contact.forget'), label: verb('contact.label'), get: verb('contact.get') }, peer: { acquire: verb('peer.acquire') } });
window.spirit.fieldRules = { normalize: function (t) { return String(t || '').trim(); },
  problem: function (t) { return t ? '' : 'a name is needed'; }, MAX_BYTES: 64 };
// The details, made in a panel's pane (goal/G43.18): each records what it was made with.
window.spirit.element = { search: { contact: { detailElement: { create: function (pane, o) { asked.push({ verb: 'contactDetails', body: o }); return {}; } },
  relayPanel: { create: function (pane, o) { asked.push({ verb: 'relayPanel', body: o }); return {}; } } } } };
// The mounter's panel stack's open (spirit/element/panel.js): it records the layer asked for and fills a pane at once.
const layers = [];
function openLayer(key, spec) { layers.push({ key: key, label: spec.label }); return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); }
// The one loader, a recorder: what the row requires, answered at once (the pages above stand in for what it loads).
const required = [];
window.spirit.require = function (p) { required.push(p); return Promise.resolve({}); };
load(path.join(JS, '..', '..', 'spirit', 'data.js'));
// THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
const NODE_KEY = 'nOdE+key/one==';
window.spirit.node = { key: NODE_KEY };
window.spirit.data.homeNode(NODE_KEY);
// spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
const managers = [];
window.spirit.cacheManager = function (name) {
  managers.push(String(name));
  load(path.join(JS, '..', '..', 'spirit', String(name), 'data.js'));
  return Promise.resolve(true);
};
load(path.join(JS, 'rowElement.js'));
load(path.join(JS, 'search', 'contact', 'rowElement.js'));
const C = window.spirit.element.search.contact.rowElement;
const D = window.spirit.data;
const CD = ((window.spirit.data || {}).contact || {}).data;
// The direct writes below are the contact family's own view of the home node, as its manager files them.
const V = D.viewAt(null, 'contact');
const names = function (el) { return el.actions.map(function (a) { return a.name; }).join(','); };
const cell = function (el, name) { return el.cells().filter(function (c) { return c.name === name; })[0].html; };
function hostsFor(el) { const h = {}; el.fields.forEach(function (f) { h[f] = { innerHTML: '' }; }); return h; }

(async function () {
  test.startTest('contacts/rowElement.js: one contact, as a row element');

  test.subHeading('what a row offers depends on what it is');
  const kept = C.create({ key: 'K1', name: 'anna', keep: true }, { open: openLayer });
  const stranger = C.create({ key: 'K2', publicLabel: 'bob' }, { open: openLayer });
  const relay = C.create({ key: 'R1', relay: true, keep: true, url: 'wss://r.example' }, { open: openLayer });
  const blocked = C.create({ key: 'K3', blocked: true });
  if (names(kept) === 'open,block,unblock,remove' && names(blocked) === 'open,block,unblock,remove') test.check('a kept or blocked row: open, block, unblock, remove');
  else test.fail('kept: ' + names(kept) + ', blocked: ' + names(blocked));
  if (names(stranger) === 'add') test.check('a row not in the book: add, and only add');
  else test.fail('not in the book: ' + names(stranger));
  if (names(relay) === 'open') test.check('a relay: open, even when kept');
  else test.fail('relay: ' + names(relay));
  if (kept.kind === 'contact' && kept.key === 'K1' && kept.fields.join(',') === 'presence,status,label,add') test.check('kind contact, keyed by the public key, fields presence, status, label, add');
  else test.fail('the element: ' + JSON.stringify({ kind: kept.kind, key: kept.key, fields: kept.fields }));
  const byPublic = C.create({ publicKey: 'K9', keep: true });
  if (byPublic.key === 'K9') test.check('a row carrying publicKey instead of key is keyed by it');
  else test.fail('publicKey row keyed ' + byPublic.key);

  if (managers.indexOf('contact') !== -1 && CD && typeof CD.contact === 'function') test.check('the row loads the contact family\'s cache manager, which puts ((spirit.data || {}).contact || {}).data on the page');
  else test.fail('managers asked: ' + JSON.stringify(managers));
  if (!CD || typeof CD.contact !== 'function') { test.reportSuccessFailureCount(); return; }

  test.subHeading('the actions ask the node, and paint nothing');
  await stranger.act('add');
  const add = asked.pop();
  if (add && add.verb === 'peer.acquire' && add.body.publicKey === 'K2' && add.body.publicLabel === 'bob') test.check('add asks peer.acquire with the key and the name it gave the relay');
  else test.fail('add asked: ' + JSON.stringify(add));
  await kept.act('block'); await kept.act('unblock'); await kept.act('remove');
  const three = asked.splice(-3).map(function (a) { return a.verb + ':' + a.body.publicKey; }).join(',');
  if (three === 'contact.block:K1,contact.unblock:K1,contact.forget:K1') test.check('block, unblock, remove ask contact.block, contact.unblock, contact.forget by the key');
  else test.fail('the book actions asked: ' + three);
  await kept.act('open'); await relay.act('open');
  const opens = asked.splice(-2);
  if (opens[0].verb === 'contactDetails' && opens[0].body.key === 'K1' && opens[1].verb === 'relayPanel' && opens[1].body.key === 'R1') test.check('open: a contact\'s details by key, a relay\'s by its key');
  else test.fail('opens: ' + JSON.stringify(opens));
  // GOAL/G43.18: as a panel over the list, through the mounter's open; handed the layer, no api (goal/G43.24).
  if (layers.length === 2 && layers[0].key === 'contact/contact/K1' && layers[1].key === 'contact/relay/R1' && opens.every(function (o) { return !('api' in o.body) && o.body.layer && typeof o.body.layer.close === 'function' && typeof o.body.layer.setTitle === 'function'; })) test.check('each opens as a layer of the mounter\'s panel stack, handed that layer\'s close and title and no api (goal/G43.24)');
  else test.fail('layers: ' + JSON.stringify(layers) + ', made with ' + JSON.stringify(opens.map(function (o) { return Object.keys(o.body); })));
  const pages = required.slice(-2).join(',');
  if (pages === 'spirit/element/search/contact/detailElement.js,spirit/element/search/contact/relayPanel.js') test.check('open loads the page it opens first, through spirit.require');
  else test.fail('open required: ' + pages);
  if (required[0] === 'spirit/element/rowElement.js') test.check('the row loads the shared row element it is built on itself, through spirit.require');
  else test.fail('as it loaded, the row required: ' + JSON.stringify(required.slice(0, 1)));
  const before = asked.length;
  const none = await stranger.act('block');
  if (none === null && asked.length === before) test.check('an action the row does not offer asks nothing');
  else test.fail('a row not in the book: its block asked ' + JSON.stringify(asked.slice(before)));

  test.subHeading('the cells');
  if (cell(kept, 'presence').indexOf('⚪') !== -1 && cell(C.create({ key: 'K4', keep: true, present: true }), 'presence').indexOf('🟢') !== -1
    && cell(C.create({ key: 'K5', keep: true, present: false }), 'presence').indexOf('🔴') !== -1) test.check('presence: 🟢 present, 🔴 absent, ⚪ not known');
  else test.fail('presence cells');
  const statuses = { blocked: cell(blocked, 'status'), stranger: cell(stranger, 'status'), mine: cell(C.create({ key: 'K7', mine: true }), 'status'), kept: cell(kept, 'status') };
  if (statuses.blocked === '❌' && statuses.stranger === '' && statuses.mine === '⭐' && statuses.kept === '') test.check('status: blocked ❌ over mine ⭐, a plain kept row and a row not in the book blank');
  else test.fail('status cells: ' + JSON.stringify(statuses));
  if (cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label') === '&lt;b&gt;x&lt;/b&gt;') test.check('the label is the name, escaped');
  else test.fail('label cell: ' + cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label'));
  if (cell(stranger, 'add').indexOf('data-action="add"') !== -1 && cell(kept, 'add') === '' && cell(C.create({ key: 'R2', relay: true }), 'add') === '') test.check('the Add button only on a row not in the book and not a relay');
  else test.fail('add cells: ' + JSON.stringify([cell(stranger, 'add'), cell(kept, 'add')]));

  test.subHeading('the contacts repaint the rows that show that key, only the fields that changed');
  V.set('contacts/K10', { present: true });
  const late = C.create({ key: 'K10', keep: true, present: false });
  if (cell(late, 'presence').indexOf('🟢') !== -1) test.check('a row made after presence is known starts with the known dot');
  else test.fail('a late row\'s dot: ' + cell(late, 'presence'));
  const a = C.create({ key: 'K11', keep: true, name: 'carl' });
  const b = C.create({ key: 'K11', keep: true, name: 'carl' });
  const other = C.create({ key: 'K12', keep: true, name: 'dora' });
  const ha = hostsFor(a); a.mount(ha);
  const hb = hostsFor(b); b.mount(hb);
  const ho = hostsFor(other); other.mount(ho);
  ha.status.innerHTML = 'untouched'; hb.label.innerHTML = 'stale'; ho.presence.innerHTML = 'untouched';
  V.merge('contacts/K11', { present: true, name: 'Carl' });
  if (ha.presence.innerHTML.indexOf('🟢') !== -1 && ha.label.innerHTML === 'Carl' && hb.label.innerHTML === 'Carl') test.check('a write to a key repaints every row of that key');
  else test.fail('after the write: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML }));
  if (ha.status.innerHTML === 'untouched' && ho.presence.innerHTML === 'untouched') test.check('a field whose value did not change, and another key\'s row, are not repainted');
  else test.fail('repainted beyond the change: ' + JSON.stringify({ status: ha.status.innerHTML, other: ho.presence.innerHTML }));
  V.merge('contacts/K11', { blocked: true });
  if (ha.status.innerHTML === '❌') test.check('a flag the status is drawn from repaints the status');
  else test.fail('status after block: ' + ha.status.innerHTML);
  // A row added stays on the page and becomes a row of the book: its Add goes, and it offers what a kept row offers.
  const found = C.create({ key: 'K14', publicLabel: 'finn' });
  const hf = hostsFor(found); found.mount(hf);
  const beforeAdd = names(found) + '|' + (hf.add.innerHTML.indexOf('data-action="add"') !== -1);
  V.merge('contacts/K14', { keep: true });
  if (beforeAdd === 'add|true' && hf.add.innerHTML === '' && names(found) === 'open,block,unblock,remove') test.check('a row the owner adds loses its Add, and offers open, block, unblock, remove');
  else test.fail('a row after its add: ' + JSON.stringify({ before: beforeAdd, add: hf.add.innerHTML, actions: names(found) }));
  await found.act('block');
  const blockAfterAdd = asked.pop();
  if (blockAfterAdd && blockAfterAdd.verb === 'contact.block' && blockAfterAdd.body.publicKey === 'K14') test.check('and its new actions ask the node');
  else test.fail('block after the add asked: ' + JSON.stringify(blockAfterAdd));
  V.merge('contacts/K14', { keep: false });
  if (names(found) === 'add' && hf.add.innerHTML.indexOf('data-action="add"') !== -1) test.check('a row that leaves the book offers Add again');
  else test.fail('a row out of the book: ' + JSON.stringify({ add: hf.add.innerHTML, actions: names(found) }));
  b.destroy();
  hb.label.innerHTML = 'after destroy';
  V.merge('contacts/K11', { name: 'Carla' });
  if (hb.label.innerHTML === 'after destroy' && ha.label.innerHTML === 'Carla') test.check('a destroyed row leaves the dispatch; the others stay');
  else test.fail('after destroy: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML }));

  test.subHeading('the label\'s editor checks the rule before it asks');
  const labelField = (function () { let f = null; const p = window.spirit.element.rowElement.create;
    window.spirit.element.rowElement.create = function (parts) { f = parts.fields.filter(function (x) { return x.name === 'label'; })[0]; return p(parts); };
    C.create({ key: 'K13', keep: true }); window.spirit.element.rowElement.create = p; return f; }());
  const n = asked.length;
  const bad = await labelField.edit({ key: 'K13' }, '   ');
  if (bad.ok === false && bad.error === 'a name is needed' && asked.length === n) test.check('a name the rule refuses is refused here, and not asked');
  else test.fail('a bad name: ' + JSON.stringify(bad));
  const good = await labelField.edit({ key: 'K13' }, '  Eve  ');
  const lab = asked.pop();
  if (good.ok === true && lab.verb === 'contact.label' && lab.body.publicKey === 'K13' && lab.body.myLabel === 'Eve') test.check('a good name is normalized and asked of contact.label');
  else test.fail('a good name: ' + JSON.stringify({ good: good, lab: lab }));

  test.subHeading('expandInfo asks contact.get once, for a row in the book');
  const m = asked.length;
  await kept.expandInfo(); await kept.expandInfo();
  const gets = asked.slice(m).filter(function (x) { return x.verb === 'contact.get'; });
  if (gets.length === 1 && gets[0].body.key === 'K1') test.check('contact.get by key, once, the answer kept');
  else test.fail('contact.get asked ' + gets.length + ' times');
  const nothing = [await stranger.expandInfo(), await relay.expandInfo()];
  if (nothing[0] === null && nothing[1] === null && asked.length === m + 1) test.check('a row not in the book and a relay expand to nothing, asking nothing');
  else test.fail('not in the book/relay expand: ' + JSON.stringify(nothing));

  // ── WHAT THE STREAM MEANS FOR CONTACTS, IN THE TYPE'S OWN ELEMENT (goal/G41.16; Andy: "get rid of thos FUCKING data.js
  // scripts, DIDN't WE INSIST on the PROPER way to do this shit?"). The contacts' translation, spirit/element/search/contact/data.js
  // until then, was the row element's (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
  // updates"), and is since goal/G41.28 the contact family's cache manager's, which the row element loads: no data script required.
  test.subHeading('the type\'s own element takes the contacts\' stream: no data script');
  if (!required.some(function (p) { return /data\.js$/.test(p); })) test.check('the contact row element requires no data script');
  else test.fail('the contact row element still requires ' + required.filter(function (p) { return /data\.js$/.test(p); }).join(', '));
  const row = function (k) { return CD.contact(k); };
  test.subHeading('relay-presence sets present, by key');
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  if (row('KA') && row('KA').present === true && row('KB') && row('KB').present === false) test.check('a present key reads present, an absent one absent');
  else test.fail('presence: ' + JSON.stringify({ a: row('KA'), b: row('KB') }));
  let writes = 0;
  const stop = CD.watch(function (key) { if (key === 'KA') writes += 1; });
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  if (writes === 0) test.check('the same table again writes nothing');
  else test.fail('an unchanged presence wrote ' + writes + ' times');
  stop();
  D.takeJob({ id: 'spirit.contact', data: { presence: { KB: { present: false } } } });
  if (row('KA') && row('KA').present === undefined && (row('KB') || {}).present === false) test.check('a key the table drops goes back to not known; the others stand');
  else test.fail('a dropped key: ' + JSON.stringify(row('KA')));
  D.takeJob({ id: 'spirit.contact', data: { presence: { KC: 'not a proof', KD: null } } });
  if (row('KC') === null && row('KD') === null) test.check('an entry that is no proof writes nothing');
  else test.fail('a bad entry wrote: ' + JSON.stringify({ c: row('KC'), d: row('KD') }));

  test.subHeading('peer-search seats the row the network found');
  D.takeJob({ id: 'spirit.contact', data: { q: 'be', item: { key: 'KE', label: JSON.stringify({ name: 'bert', blocked: true }) } } });
  if (row('KE') && row('KE').name === 'bert' && row('KE').blocked === true) test.check('the item\'s label is merged into its row, by key');
  else test.fail('the network row: ' + JSON.stringify(row('KE')));
  const seated = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.contact', data: { q: 'be' } });
  // The branch read is the one the rows are in (KE just seated there), so an equal answer judges something.
  if ('KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === seated) test.check('a peer-search update with no item seats nothing');
  else test.fail('rows after an empty update: ' + Object.keys(D.branchAt(CD.branch)).join(','));
  D.takeJob({ id: 'spirit.contact', data: { item: { key: 'KF', label: 'not json' } } });
  if (row('KF') === null) test.check('a label that is not JSON seats nothing');
  else test.fail('a bad label seated ' + JSON.stringify(row('KF')));

  test.subHeading('a rename sets the name, and keeps the rest');
  D.takeRename({ key: 'KE', caption: 'Bertie' });
  if ((row('KE') || {}).name === 'Bertie' && (row('KE') || {}).blocked === true) test.check('contact.rename sets name on the row, its other fields kept');
  else test.fail('after a rename: ' + JSON.stringify(row('KE')));
  D.takeRename({ key: 'KG', caption: 7 });
  if (row('KG') && row('KG').name === '7') test.check('a rename of a key never seen makes its row, the caption as text');
  else test.fail('a rename of a new key: ' + JSON.stringify(row('KG')));

  test.subHeading('other jobs are not contacts\' business');
  const beforeC = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.fs', data: { presence: { KZ: { present: true } }, item: { key: 'KZ', label: '{"name":"z"}' } } });
  if ('KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === beforeC) test.check('a job of another type changes no contact');
  else test.fail('another job changed contacts');


  test.reportSuccessFailureCount();
}());
