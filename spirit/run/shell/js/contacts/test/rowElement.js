'use strict';

// spirit/run/shell/js/contacts/test/rowElement.js
// The tests of shell/js/contacts/rowElement.js, and of no other module: one contact as a row element (spec:
// ./rowElement.md). The browser file runs in node on a window of its own, over the shared rowElement.js and the
// faceless layer it reads; the node behind spirit.ready is a recorder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../../..'), 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const asked = [];
function verb(name) { return function (body) { asked.push({ verb: name, body: body }); return Promise.resolve({ ok: name }); }; }
global.window = { spirit: {} };
global.spirit = window.spirit;
window.spirit.ready = Promise.resolve({ contact: { block: verb('contact.block'), unblock: verb('contact.unblock'),
  forget: verb('contact.forget'), label: verb('contact.label'), get: verb('contact.get') }, peer: { acquire: verb('peer.acquire') } });
window.spirit.fieldRules = { normalize: function (t) { return String(t || '').trim(); },
  problem: function (t) { return t ? '' : 'a name is needed'; }, MAX_BYTES: 64 };
window.spirit.elements = { contactDetails: { open: function (o) { asked.push({ verb: 'contactDetails', body: o }); } },
  natterDetails: { open: function (o) { asked.push({ verb: 'natterDetails', body: o }); } } };
// The one loader, a recorder: what the row requires, answered at once (the pages above stand in for what it loads).
const required = [];
window.spirit.require = function (p) { required.push(p); return Promise.resolve({}); };
load(path.join(JS, 'spiritData.js'));
load(path.join(JS, 'rowElement.js'));
load(path.join(JS, 'contacts', 'rowElement.js'));
const C = window.spirit.elements.contactElement;
const D = window.spirit.data;
const names = function (el) { return el.actions.map(function (a) { return a.name; }).join(','); };
const cell = function (el, name) { return el.cells().filter(function (c) { return c.name === name; })[0].html; };
function hostsFor(el) { const h = {}; el.fields.forEach(function (f) { h[f] = { innerHTML: '' }; }); return h; }

(async function () {
  test.startTest('contacts/rowElement.js: one contact, as a row element');

  test.subHeading('what a row offers depends on what it is');
  const kept = C.create({ key: 'K1', name: 'anna', keep: true });
  const held = C.create({ key: 'K2', held: true, publicLabel: 'bob' });
  const relay = C.create({ key: 'R1', relay: true, keep: true, url: 'wss://r.example' });
  const blocked = C.create({ key: 'K3', blocked: true });
  if (names(kept) === 'open,block,unblock,remove' && names(blocked) === 'open,block,unblock,remove') test.check('a kept or blocked row: open, block, unblock, remove');
  else test.fail('kept: ' + names(kept) + ', blocked: ' + names(blocked));
  if (names(held) === 'add') test.check('a held row: add, and only add');
  else test.fail('held: ' + names(held));
  if (names(relay) === 'open') test.check('a relay: open, even when kept');
  else test.fail('relay: ' + names(relay));
  if (kept.kind === 'contact' && kept.key === 'K1' && kept.fields.join(',') === 'presence,status,label,add') test.check('kind contact, keyed by the public key, fields presence, status, label, add');
  else test.fail('the element: ' + JSON.stringify({ kind: kept.kind, key: kept.key, fields: kept.fields }));
  const byPublic = C.create({ publicKey: 'K9', keep: true });
  if (byPublic.key === 'K9') test.check('a row carrying publicKey instead of key is keyed by it');
  else test.fail('publicKey row keyed ' + byPublic.key);

  test.subHeading('the actions ask the node, and paint nothing');
  await held.act('add');
  const add = asked.pop();
  if (add && add.verb === 'peer.acquire' && add.body.publicKey === 'K2' && add.body.publicLabel === 'bob') test.check('add asks peer.acquire with the key and the name it gave the relay');
  else test.fail('add asked: ' + JSON.stringify(add));
  await kept.act('block'); await kept.act('unblock'); await kept.act('remove');
  const three = asked.splice(-3).map(function (a) { return a.verb + ':' + a.body.publicKey; }).join(',');
  if (three === 'contact.block:K1,contact.unblock:K1,contact.forget:K1') test.check('block, unblock, remove ask contact.block, contact.unblock, contact.forget by the key');
  else test.fail('the book actions asked: ' + three);
  await kept.act('open'); await relay.act('open');
  const opens = asked.splice(-2);
  if (opens[0].verb === 'contactDetails' && opens[0].body.key === 'K1' && opens[1].verb === 'natterDetails' && opens[1].body.url === 'wss://r.example') test.check('open: a contact\'s details by key, a relay\'s by its url');
  else test.fail('opens: ' + JSON.stringify(opens));
  const pages = required.slice(-2).join(',');
  if (pages === 'shell/js/contactDetails/contactDetails.js,shell/js/natterDetails/natterDetails.js') test.check('open loads the page it opens first, through spirit.require');
  else test.fail('open required: ' + pages);
  if (required[0] === 'shell/js/rowElement.js') test.check('the row loads the shared row element it is built on itself, through spirit.require');
  else test.fail('as it loaded, the row required: ' + JSON.stringify(required.slice(0, 1)));
  const before = asked.length;
  const none = await held.act('block');
  if (none === null && asked.length === before) test.check('an action the row does not offer asks nothing');
  else test.fail('a held row\'s block asked ' + JSON.stringify(asked.slice(before)));

  test.subHeading('the cells');
  if (cell(kept, 'presence').indexOf('⚪') !== -1 && cell(C.create({ key: 'K4', keep: true, present: true }), 'presence').indexOf('🟢') !== -1
    && cell(C.create({ key: 'K5', keep: true, present: false }), 'presence').indexOf('🔴') !== -1) test.check('presence: 🟢 present, 🔴 absent, ⚪ not known');
  else test.fail('presence cells');
  if (cell(blocked, 'status') === '❌' && cell(held, 'status') === '⌛' && cell(C.create({ key: 'K6', mine: true, held: true }), 'status') === '⌛'
    && cell(C.create({ key: 'K7', mine: true }), 'status') === '⭐' && cell(kept, 'status') === '') test.check('status: blocked ❌ over held ⌛ over mine ⭐, a plain kept row blank');
  else test.fail('status cells');
  if (cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label') === '&lt;b&gt;x&lt;/b&gt;') test.check('the label is the name, escaped');
  else test.fail('label cell: ' + cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label'));
  if (cell(held, 'add').indexOf('data-action="add"') !== -1 && cell(kept, 'add') === '' && cell(C.create({ key: 'R2', relay: true }), 'add') === '') test.check('the Add button only on a row not in the book and not a relay');
  else test.fail('add cells: ' + JSON.stringify([cell(held, 'add'), cell(kept, 'add')]));

  test.subHeading('data.contacts repaints the rows that show that key, only the fields that changed');
  D.set('contacts/K10', { present: true });
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
  D.merge('contacts/K11', { present: true, name: 'Carl' });
  if (ha.presence.innerHTML.indexOf('🟢') !== -1 && ha.label.innerHTML === 'Carl' && hb.label.innerHTML === 'Carl') test.check('a write to a key repaints every row of that key');
  else test.fail('after the write: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML }));
  if (ha.status.innerHTML === 'untouched' && ho.presence.innerHTML === 'untouched') test.check('a field whose value did not change, and another key\'s row, are not repainted');
  else test.fail('repainted beyond the change: ' + JSON.stringify({ status: ha.status.innerHTML, other: ho.presence.innerHTML }));
  D.merge('contacts/K11', { blocked: true });
  if (ha.status.innerHTML === '❌') test.check('a flag the status is drawn from repaints the status');
  else test.fail('status after block: ' + ha.status.innerHTML);
  // A row added stays on the page and becomes a row of the book: its Add goes, and it offers what a kept row offers.
  const found = C.create({ key: 'K14', publicLabel: 'finn' });
  const hf = hostsFor(found); found.mount(hf);
  const beforeAdd = names(found) + '|' + (hf.add.innerHTML.indexOf('data-action="add"') !== -1);
  D.merge('contacts/K14', { keep: true });
  if (beforeAdd === 'add|true' && hf.add.innerHTML === '' && names(found) === 'open,block,unblock,remove') test.check('a row the owner adds loses its Add, and offers open, block, unblock, remove');
  else test.fail('a row after its add: ' + JSON.stringify({ before: beforeAdd, add: hf.add.innerHTML, actions: names(found) }));
  await found.act('block');
  const blockAfterAdd = asked.pop();
  if (blockAfterAdd && blockAfterAdd.verb === 'contact.block' && blockAfterAdd.body.publicKey === 'K14') test.check('and its new actions ask the node');
  else test.fail('block after the add asked: ' + JSON.stringify(blockAfterAdd));
  D.merge('contacts/K14', { keep: false });
  if (names(found) === 'add' && hf.add.innerHTML.indexOf('data-action="add"') !== -1) test.check('a row that leaves the book offers Add again');
  else test.fail('a row out of the book: ' + JSON.stringify({ add: hf.add.innerHTML, actions: names(found) }));
  b.destroy();
  hb.label.innerHTML = 'after destroy';
  D.merge('contacts/K11', { name: 'Carla' });
  if (hb.label.innerHTML === 'after destroy' && ha.label.innerHTML === 'Carla') test.check('a destroyed row leaves the dispatch; the others stay');
  else test.fail('after destroy: ' + JSON.stringify({ a: ha.label.innerHTML, b: hb.label.innerHTML }));

  test.subHeading('the label\'s editor checks the rule before it asks');
  const labelField = (function () { let f = null; const p = window.spirit.elements.rowElement.create;
    window.spirit.elements.rowElement.create = function (parts) { f = parts.fields.filter(function (x) { return x.name === 'label'; })[0]; return p(parts); };
    C.create({ key: 'K13', keep: true }); window.spirit.elements.rowElement.create = p; return f; }());
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
  const nothing = [await held.expandInfo(), await relay.expandInfo()];
  if (nothing[0] === null && nothing[1] === null && asked.length === m + 1) test.check('a held row and a relay expand to nothing, asking nothing');
  else test.fail('held/relay expand: ' + JSON.stringify(nothing));

  test.reportSuccessFailureCount();
}());
