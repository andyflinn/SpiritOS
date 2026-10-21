'use strict';

// spirit/test/rowElements.js
// goal/G30.18: elements for a single file and a single contact, the rowElements. Red on today's tree; claude-windows
// writes it and builds it (one agent). The box, in short:
//   - rowElements carry the listeners and painters a subject needs for real-time updates, wherever they are used: a
//     list row and a details panel show the same element, so nothing has to keep the two in sync. The family:
//     fileElement and contactElement now (shell/js/rows/), jobElement and goalElement later.
//   - shell/js/rowElement.js does the shared work once: paints each field into its cell, registers the one listener,
//     drops it on destroy, runs expandInfo and keeps its answer. rowElement.create(parts) builds an element from the parts
//     fileElement or contactElement hands in.
//   - The stream dispatch lives per kind, in the element's own file: one stream subscription for all rows of a kind and
//     an index by path or key; a row registers on create and leaves on destroy.
//   - Fields in order: name, fieldRule (js/fieldRules.js), painter, editor. A changed field repaints only itself. An
//     editor asks and never paints; the confirmed change on the stream repaints.
//   - A rowElement carries its actions (add, block, remove, open). expandInfo fetches what is too large for a row.
// NAMED HERE where the box names none:
//   - window.spiritElements.rowElement.create(parts): parts { kind, key, row, index, fields: [{ name, rule, paint(row),
//     edit }], actions: [{ name, label, run(el, ctx) }], expand(el) } -> el { kind, key, row, cells() [{ name, html }],
//     mount(hosts by field name), apply(changes), act(name, ctx), expandInfo(), destroy() }.
//   - window.spiritElements.rowElement.index(subscribe) -> { add(key, el), remove(key, el), forKey(key) }: subscribe(index)
//     is called once, on the first add.
//   - window.spiritElements.fileElement.create(row): row { path, kind, size, modified }; key path; fields icon, name,
//     size, changed; fed by fs-watcher job-updated commands for its path. Actions open and remove.
//   - window.spiritElements.contactElement.create(row): row { key, name, owned, blocked, held }; fields presence, status,
//     label; fed by the relay-presence job and contact renames. Actions open, block, unblock, remove.
// The elements are browser scripts; this runs them in a sandbox with a stand-in window and spirit.core, and checks what
// they paint and ask. rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.18: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setTimeout(r, 10); }); }

test.startTest('goal/G30.18: the rowElements, fileElement and contactElement');

// The page: a window, spirit.core with ask and jobs.subscribe, the field rules, and the three element files.
const asked = [];
const subscribers = [];
const window = { spiritElements: {} };
const spirit = { core: {
  ask: function (verb, args) { asked.push({ verb: verb, args: args }); return Promise.resolve({ status: 200, body: { ok: true, verb: verb } }); },
  jobs: { subscribe: function (h) { subscribers.push(h); return function () { subscribers.splice(subscribers.indexOf(h), 1); }; } },
  util: { escapeHtml: function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); } },
  const: { ICON: { FOLDER: 'F', FILE: 'f', GREEN_CIRCLE: 'G', WHITE_CIRCLE: 'W', RED_CIRCLE: 'R', NO: 'N', WAITING: 'H' } },
} };
window.spirit = spirit;
const ctx = vm.createContext({ window: window, spirit: spirit, console: console, Promise: Promise, document: { addEventListener: function () {} } });
const loaded = {};
['js/fieldRules.js', 'shell/js/rowElement.js', 'shell/js/rows/fileElement.js', 'shell/js/rows/contactElement.js'].forEach(function (rel) {
  try { vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), ctx, { filename: rel }); loaded[rel] = true; }
  catch (e) { loaded[rel] = e.message; }
});
const E = window.spiritElements;
function host() { return { innerHTML: '', paints: 0, set html(v) { this.innerHTML = v; this.paints += 1; } }; }
// A host whose innerHTML setter counts paints.
function counted() {
  const h = { paints: 0, _v: '' };
  Object.defineProperty(h, 'innerHTML', { get: function () { return h._v; }, set: function (v) { h._v = v; h.paints += 1; } });
  return h;
}

const done = (async function () {
  test.subHeading('1. rowElement: the shared contract');
  let base = null;
  try {
    let expands = 0;
    const idx = E.rowElement.index(function () {});
    const el = E.rowElement.create({ kind: 'thing', key: 'k1', row: { a: 1, b: 2 }, index: idx,
      fields: [{ name: 'a', paint: function (r) { return 'A' + r.a; } }, { name: 'b', paint: function (r) { return 'B' + r.b; } }],
      actions: [{ name: 'poke', label: 'Poke', run: function (e, c) { c.poked = e.key; } }],
      expand: function () { expands += 1; return Promise.resolve({ more: 'text' }); } });
    const hosts = { a: counted(), b: counted() };
    el.mount(hosts);
    el.apply({ b: 3 });
    const c = {};
    await el.act('poke', c);
    const x1 = await el.expandInfo(); const x2 = await el.expandInfo();
    base = { cells: el.cells().map(function (z) { return z.name + '=' + z.html; }).join(','), a: hosts.a.paints, b: hosts.b.paints, bHtml: hosts.b.innerHTML,
      poked: c.poked, expands: expands, x: x1 && x1.more, same: x1 === x2, inIndex: idx.forKey('k1').length };
    el.destroy();
    base.afterDestroy = idx.forKey('k1').length;
  } catch (e) { base = { threw: e.message }; }
  if (base && base.cells === 'a=A1,b=B3' && base.a === 1 && base.b === 2 && base.bHtml === 'B3' && base.poked === 'k1'
      && base.expands === 1 && base.x === 'text' && base.same === true && base.inIndex === 1 && base.afterDestroy === 0)
    test.check('create paints each field into its cell, a change repaints only that cell, an action runs, expandInfo asks once and keeps the answer, destroy leaves the index');
  else test.fail(OWED + 'rowElement: ' + short(base) + ' (loaded ' + short(loaded) + ')');

  test.subHeading('2. fileElement: one subscription for all file rows, an event repaints only its path');
  let files = null;
  try {
    const before = subscribers.length;
    const a = E.fileElement.create({ path: 'shell/a.js', kind: 'file', size: 10, modified: '2026-10-21T00:00:00Z' });
    const b = E.fileElement.create({ path: 'shell/b.js', kind: 'file', size: 20, modified: '2026-10-21T00:00:00Z' });
    const ha = { icon: counted(), name: counted(), size: counted(), changed: counted() };
    const hb = { icon: counted(), name: counted(), size: counted(), changed: counted() };
    a.mount(ha); b.mount(hb);
    const subs = subscribers.length - before;
    const fire = function (cmd) { subscribers.slice().forEach(function (h) { if (h.onUpdate) h.onUpdate({ id: 'j-fs', type: 'fs-watcher', data: { command: cmd } }); }); };
    fire({ op: 'changeFile', path: 'shell/a.js', size: 99, modified: '2026-10-21T01:00:00Z' });
    files = { subs: subs, aSize: ha.size.innerHTML, aSizePaints: ha.size.paints, aNamePaints: ha.name.paints, bSizePaints: hb.size.paints,
      fields: a.cells().map(function (z) { return z.name; }).join(',') };
    a.destroy();
    fire({ op: 'changeFile', path: 'shell/a.js', size: 5, modified: '2026-10-21T02:00:00Z' });
    files.afterDestroy = ha.size.paints;
    await a.act('remove', {});
    files.removeAsked = asked.filter(function (q) { return q.verb === 'fs.delete'; }).map(function (q) { return q.args.path; }).join(',');
    files.sizeAfterRemove = ha.size.innerHTML;
    asked.length = 0;
    await b.expandInfo(); await b.expandInfo();
    files.expand = asked.map(function (q) { return q.verb; }).sort().join(',');
  } catch (e) { files = { threw: e.message }; }
  if (files && files.subs === 1 && /99/.test(files.aSize) && files.aSizePaints === 2 && files.aNamePaints === 1 && files.bSizePaints === 1
      && files.fields === 'icon,name,size,changed' && files.afterDestroy === 2 && files.removeAsked === 'shell/a.js'
      && files.expand === 'fs.annotations,fs.stat')
    test.check('two file rows share one subscription; a change to a.js repaints a.js\'s size alone; after destroy nothing; remove asks fs.delete and paints nothing; expandInfo asks fs.stat and fs.annotations once');
  else test.fail(OWED + 'fileElement: ' + short(files));

  test.subHeading('3. contactElement: presence and renames by key; actions ask, the stream paints');
  let people = null;
  try {
    const before = subscribers.length;
    const p = E.contactElement.create({ key: 'KEY-P', name: 'Pia', owned: false, blocked: false, held: false });
    const q = E.contactElement.create({ key: 'KEY-Q', name: 'Quin', owned: false, blocked: false, held: false });
    const hp = { presence: counted(), status: counted(), label: counted() };
    const hq = { presence: counted(), status: counted(), label: counted() };
    p.mount(hp); q.mount(hq);
    const subs = subscribers.length - before;
    subscribers.slice().forEach(function (h) { if (h.onUpdate) h.onUpdate({ id: 'j-pr', type: 'relay-presence', data: { presence: { 'KEY-P': { present: true, at: 1 } } } }); });
    subscribers.slice().forEach(function (h) { if (h.onContactRename) h.onContactRename({ key: 'KEY-Q', caption: 'Quinn' }); });
    asked.length = 0;
    await p.act('block', {});
    const blockAsked = asked.filter(function (x) { return x.verb === 'contact.block'; }).map(function (x) { return x.args.publicKey; }).join(',');
    let opened = null;
    await p.act('open', { callDialog: function (id, params) { opened = id + ' ' + params.key; return Promise.resolve(null); } });
    asked.length = 0;
    await q.expandInfo();
    people = { subs: subs, pPresence: hp.presence.innerHTML, pPresencePaints: hp.presence.paints, qPresencePaints: hq.presence.paints,
      qLabel: hq.label.innerHTML, pLabelPaints: hp.label.paints, pStatusPaints: hp.status.paints, blockAsked: blockAsked, opened: opened,
      expand: asked.map(function (x) { return x.verb + ':' + x.args.key; }).join(','),
      fields: p.cells().map(function (z) { return z.name; }).join(','), rule: !!(window.spiritFieldRules && window.spiritFieldRules.label) };
  } catch (e) { people = { threw: e.message }; }
  if (people && people.subs === 1 && />G<\/span>/.test(people.pPresence) && people.pPresencePaints === 2 && people.qPresencePaints === 1
      && /Quinn/.test(people.qLabel) && people.pLabelPaints === 1 && people.pStatusPaints === 1 && people.blockAsked === 'KEY-P'
      && people.opened === 'shell/contactsDetails KEY-P' && people.expand === 'contact.get:KEY-Q' && people.fields === 'presence,status,label,add')
    test.check('two contact rows share one subscription; presence repaints only Pia\'s dot, a rename only Quin\'s label; block asks and paints nothing; open opens Contact; expandInfo asks contact.get');
  else test.fail(OWED + 'contactElement: ' + short(people));
}());

done.then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
