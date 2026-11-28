'use strict';

// spirit/run/spirit/element/search/contact/row/test/script.js
// The tests of spirit/element/search/contact/row/script.js, and of no other module: one contact as a row element (spec:
// ./script.md). The browser file runs in node on a window of its own, over the shared row.js and the
// faceless layer it reads, with the contact family's data.js (goal/G41.28) loaded as a page's
// spirit.requireScript('spirit/contact/script.js') brings it, the page's node known as spirit.startPage makes it known (spirit.nodeFacts.key, then
// data.homeNode); the node behind spirit.readyPromise is a recorder. After it, the parts once files of their own: noHeld (the
// row offers no heldActions, its code read) and relayOnFace (a relay's row opens the relay on a real face, in a real
// Chrome). The one test file of contact/row.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

const JS = path.join(__dirname, '..', '..', '..', '..');
function load(file) { PAGE_LOAD.runAsPage(file); }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
const asked = [];
const layers = [];
const required = [];
let loaded = null;
function verb(name) { return function (body) { asked.push({ verb: name, body: body }); return Promise.resolve({ ok: name }); }; }
// The mounter's panel stack's open (spirit/element/panel/script.js): it records the layer asked for and fills a pane at once.
function openLayer(key, spec) { layers.push({ key: key, label: spec.label }); return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); }
const names = function (el) { return el.actions.map(function (a) { return a.name; }).join(','); };
const cell = function (el, name) { return el.cells().filter(function (c) { return c.name === name; })[0].html; };
function hostsFor(el) { const h = {}; el.fields.forEach(function (f) { h[f] = { innerHTML: '' }; }); return h; }
let C = null, D = null, CD = null, V = null;
let kept, stranger, relay, blocked, ha, hb, ho, found, hf, labelField, gets = null, m = 0;

test.run('the contact row runs on a window of its own, with the data set and the contact branch\'s data real', 0.2, async function () {
  global.window = { spirit: {} };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = window.spirit;
  // What readyPromise answers holds no branch (goal/G49.6); the branches are answered by their api.js paths, below.
  window.spirit.readyPromise = Promise.resolve({});
  // goal/G49.22: the contact branch's calls are spirit.contact.<verb>.
  const BRANCHES = { contact: { block: verb('spirit.contact.block'), unblock: verb('spirit.contact.unblock'),
    forget: verb('spirit.contact.forget'), label: verb('spirit.contact.label'), get: verb('spirit.contact.get') }, peer: { acquire: verb('peer.acquire') } };
  window.spirit.normalizeString = LOADER.normalizeString;
  // The label type is the real one (goal/G49.13: the type files replaced fieldRules), loaded from its path below.
  // The details, made in a panel's pane (goal/G43.18): each records what it was made with.
  // goal/G43.32: what the row opens stands where an element now finds it, spirit.element.
  window.spirit.element = { search: { contact: { detail: { create: function (pane, o) { asked.push({ verb: 'contactDetails', body: o }); return {}; } } } } };
  // The one loader, a recorder: what the row requires, answered at once (the pages above stand in for what it loads).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  // The contact branch's interface brings its data.js, as the real api.js does: run once from its path, attaching itself
  // to the data set.
  let contactData = false;
  window.spirit.requireScript = function (p) {
    required.push(p);
    if (p === 'spirit/contact/script.js') { if (!contactData) { contactData = true; BRANCHES.contact.client = PAGE_LOAD.runAsPage(path.join(JS, '..', '..', 'spirit', 'contact', 'client', 'script.js')); } return Promise.resolve(BRANCHES.contact); }
    if (p === 'spirit/peer/api.js') return Promise.resolve(BRANCHES.peer);
    // THE DATA SET IS requireScript's ANSWER TOO (goal/G49.23): the contact client (spirit/contact/client/script.js) files into
    // what spirit/client/script.js hands back, the store this window ran below; the row reads the contact branch's client (goal/G49.23,
    // box v22 Part 1), what that client put out, on the branch its require answers.
    if (p === 'spirit/client/script.js') return Promise.resolve(window.spirit.client);
    // A type is the real one, by its full path (goal/G49.13).
    if (/^spirit\/type\/.+\/script\.js$/.test(p)) return Promise.resolve(LOADER.requireScript(p));
    // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
    // Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
    // stands at its place, a stand-in above or a real file loaded, and a path with nothing there is refused.
    const keys = String(p).replace(/\.js$/, '').split('/');
    if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
    const at = keys.slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit); // goal/G49.23: on the spirit object itself
    return at && (typeof at === 'object' || typeof at === 'function') ? Promise.resolve(at) : Promise.reject(new Error('no stand-in for ' + p));
  };
  load(path.join(JS, '..', '..', 'spirit', 'client', 'script.js'));
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  window.spirit.nodeFacts = { key: NODE_KEY };
  window.spirit.client.homeNode(NODE_KEY);
  load(path.join(JS, 'row', 'script.js'));
  load(path.join(JS, 'search', 'contact', 'row', 'script.js'));
  // goal/G49.23: the contact client files into the data set once requireScript('spirit/client/script.js') has handed it back,
  // a promise; the answers are let settle before the contact branch's data is read.
  for (let i = 0; i < 5; i += 1) await new Promise(function (r) { setImmediate(r); });
  C = window.spirit.element.search.contact.row;
  D = window.spirit.client;
  // goal/G49.23: the contact rows read from the contact branch's client, never from the store by a short name.
  CD = BRANCHES.contact.client;
  // What the row asked as it loaded; the runner's own asks after this test are not the row's.
  loaded = required.slice();
  // The direct writes below are the contact family's own view of the home node, as its manager files them.
  // goal/G49.23: the contact family is named by its branch's path, spirit.contact.
  V = D.viewAt(null, 'spirit.contact');
  return true;
}, test.limit.quick);

// what a row offers depends on what it is
test.run('a kept or blocked row offers open, block, unblock and remove', 0.2, function () {
  if (!C) return false;
  kept = C.create({ key: 'K1', name: 'anna', keep: true }, { open: openLayer });
  stranger = C.create({ key: 'K2', publicLabel: 'bob' }, { open: openLayer });
  relay = C.create({ key: 'R1', relay: true, keep: true, url: 'wss://r.example' }, { open: openLayer });
  blocked = C.create({ key: 'K3', blocked: true });
  return names(kept) === 'open,block,unblock,remove' && names(blocked) === 'open,block,unblock,remove' ? true : false;
}, test.limit.quick);
test.run('a row not in the book offers add, and only add', 0.2, function () {
  if (!stranger) return false;
  return names(stranger) === 'add' ? true : false;
}, test.limit.quick);
test.run('a relay row offers open only, even when kept', 0.2, function () {
  if (!relay) return false;
  return names(relay) === 'open' ? true : false;
}, test.limit.quick);
test.run('a row is of kind contact, keyed by the public key, with the fields presence, status, label, add and the caller\'s mark', 0.2, function () {
  if (!kept) return false;
  return kept.kind === 'contact' && kept.key === 'K1' && kept.fields.join(',') === 'presence,status,label,add,mark' ? true : false;
}, test.limit.quick);
test.run('a row carrying publicKey instead of key is keyed by it', 0.2, function () {
  if (!C) return false;
  const byPublic = C.create({ publicKey: 'K9', keep: true });
  return byPublic.key === 'K9' ? true : false;
}, test.limit.quick);
test.run('the row requires spirit/contact/script.js, which puts the contact branch\'s data on its client on the page', 0.2, function () {
  return required.indexOf('spirit/contact/script.js') !== -1 && CD && typeof CD.contact === 'function' ? true : false;
}, test.limit.quick);

// the actions ask the node, and paint nothing
test.run('add asks peer.acquire with the key and the name it gave the relay', 0.2, async function () {
  if (!stranger) return false;
  await stranger.act('add');
  const add = asked.pop();
  return add && add.verb === 'peer.acquire' && add.body.publicKey === 'K2' && add.body.publicLabel === 'bob' ? true : false;
}, test.limit.quick);
test.run('block, unblock, remove ask spirit.contact.block, spirit.contact.unblock, spirit.contact.forget by the key', 0.2, async function () {
  if (!kept) return false;
  await kept.act('block'); await kept.act('unblock'); await kept.act('remove');
  const three = asked.splice(-3).map(function (a) { return a.verb + ':' + a.body.publicKey; }).join(',');
  return three === 'spirit.contact.block:K1,spirit.contact.unblock:K1,spirit.contact.forget:K1' ? true : false;
}, test.limit.quick);
let opens = null;
// GOAL/G43.32 (Andy: "the contact list already knows the difference between contact types. so should the detail panel."): one
// detail opens for both, told what the row is; it draws a relay's panel or a person's.
test.run('open asks for the one contact detail by key, told whether it is a person or a relay', 0.2, async function () {
  if (!kept) return false;
  await kept.act('open'); await relay.act('open');
  opens = asked.splice(-2);
  return opens[0].verb === 'contactDetails' && opens[0].body.key === 'K1' && opens[0].body.relay === false && opens[1].verb === 'contactDetails' && opens[1].body.key === 'R1' && opens[1].body.relay === true ? true : false;
}, test.limit.quick);
// GOAL/G43.18: as a panel over the list, through the mounter's open; handed the layer, no api (goal/G43.24).
test.run('each opens as a layer of the mounter\'s panel stack, handed that layer\'s close and title and no api', 0.2, function () {
  if (!opens) return false;
  return layers.length === 2 && layers[0].key === 'contact/contact/K1' && layers[1].key === 'contact/relay/R1' && opens.every(function (o) { return !('api' in o.body) && o.body.layer && typeof o.body.layer.close === 'function' && typeof o.body.layer.setTitle === 'function'; })
    ? true : false;
}, test.limit.quick);
test.run('open loads the detail it opens first, through spirit.requireScript, for a person and a relay alike', 0.2, function () {
  const pages = required.slice(-2).join(',');
  return pages === 'spirit/element/search/contact/detail/script.js,spirit/element/search/contact/detail/script.js' ? true : false;
}, test.limit.quick);
test.run('the row loads the shared row element it is built on itself, through spirit.requireScript', 0.2, function () {
  const parts = required;
  // goal/G49.9: it keeps what its requires answer, the field rules among them, so the row element need not be the first asked.
  return parts.indexOf('spirit/element/row/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('an action the row does not offer asks nothing', 0.2, async function () {
  if (!stranger) return false;
  const before = asked.length;
  const none = await stranger.act('block');
  return none === null && asked.length === before ? true : false;
}, test.limit.quick);

// the cells
test.run('presence shows 🟢 when present, 🔴 when absent and ⚪ when not known', 0.2, function () {
  if (!kept) return false;
  return cell(kept, 'presence').indexOf('⚪') !== -1 && cell(C.create({ key: 'K4', keep: true, present: true }), 'presence').indexOf('🟢') !== -1
    && cell(C.create({ key: 'K5', keep: true, present: false }), 'presence').indexOf('🔴') !== -1 ? true : false;
}, test.limit.quick);
test.run('the status shows blocked ❌ over mine ⭐, and is blank on a plain kept row and on a row not in the book', 0.2, function () {
  if (!kept) return false;
  const statuses = { blocked: cell(blocked, 'status'), stranger: cell(stranger, 'status'), mine: cell(C.create({ key: 'K7', mine: true }), 'status'), kept: cell(kept, 'status') };
  return statuses.blocked === '❌' && statuses.stranger === '' && statuses.mine === '⭐' && statuses.kept === '' ? true : false;
}, test.limit.quick);
test.run('the label is the name, escaped', 0.2, function () {
  if (!C) return false;
  const l = cell(C.create({ key: 'K8', keep: true, name: '<b>x</b>' }), 'label');
  return l === '&lt;b&gt;x&lt;/b&gt;' ? true : false;
}, test.limit.quick);
test.run('the Add button shows only on a row that is not in the book and not a relay', 0.2, function () {
  if (!kept) return false;
  return cell(stranger, 'add').indexOf('data-action="add"') !== -1 && cell(kept, 'add') === '' && cell(C.create({ key: 'R2', relay: true }), 'add') === '' ? true : false;
}, test.limit.quick);

// the contacts repaint the rows that show that key, only the fields that changed
test.run('a row made after presence is known starts with the known dot', 0.2, function () {
  if (!V) return false;
  V.set('contacts/K10', { present: true });
  const late = C.create({ key: 'K10', keep: true, present: false });
  return cell(late, 'presence').indexOf('🟢') !== -1 ? true : false;
}, test.limit.quick);
let a = null, b = null;
test.run('a write to a key repaints every row of that key', 0.2, function () {
  if (!V) return false;
  a = C.create({ key: 'K11', keep: true, name: 'carl' });
  b = C.create({ key: 'K11', keep: true, name: 'carl' });
  const other = C.create({ key: 'K12', keep: true, name: 'dora' });
  ha = hostsFor(a); a.mount(ha);
  hb = hostsFor(b); b.mount(hb);
  ho = hostsFor(other); other.mount(ho);
  ha.status.innerHTML = 'untouched'; hb.label.innerHTML = 'stale'; ho.presence.innerHTML = 'untouched';
  V.merge('contacts/K11', { present: true, name: 'Carl' });
  return ha.presence.innerHTML.indexOf('🟢') !== -1 && ha.label.innerHTML === 'Carl' && hb.label.innerHTML === 'Carl' ? true : false;
}, test.limit.quick);
test.run('a field whose value did not change, and another key\'s row, are not repainted', 0.2, function () {
  if (!ha) return false;
  return ha.status.innerHTML === 'untouched' && ho.presence.innerHTML === 'untouched' ? true : false;
}, test.limit.quick);
test.run('a flag the status is drawn from repaints the status', 0.2, function () {
  if (!ha) return false;
  V.merge('contacts/K11', { blocked: true });
  return ha.status.innerHTML === '❌' ? true : false;
}, test.limit.quick);
// A row added stays on the page and becomes a row of the book: its Add goes, and it offers what a kept row offers.
test.run('a row the owner adds loses its Add, and offers open, block, unblock, remove', 0.2, function () {
  if (!V) return false;
  found = C.create({ key: 'K14', publicLabel: 'finn' });
  hf = hostsFor(found); found.mount(hf);
  const beforeAdd = names(found) + '|' + (hf.add.innerHTML.indexOf('data-action="add"') !== -1);
  V.merge('contacts/K14', { keep: true });
  return beforeAdd === 'add|true' && hf.add.innerHTML === '' && names(found) === 'open,block,unblock,remove' ? true : false;
}, test.limit.quick);
test.run('the new actions of a row the owner adds ask the node', 0.2, async function () {
  if (!found) return false;
  await found.act('block');
  const blockAfterAdd = asked.pop();
  return blockAfterAdd && blockAfterAdd.verb === 'spirit.contact.block' && blockAfterAdd.body.publicKey === 'K14' ? true : false;
}, test.limit.quick);
test.run('a row that leaves the book offers Add again', 0.2, function () {
  if (!found) return false;
  V.merge('contacts/K14', { keep: false });
  return names(found) === 'add' && hf.add.innerHTML.indexOf('data-action="add"') !== -1 ? true : false;
}, test.limit.quick);
test.run('a destroyed row leaves the dispatch; the others stay', 0.2, function () {
  if (!b) return false;
  b.destroy();
  hb.label.innerHTML = 'after destroy';
  V.merge('contacts/K11', { name: 'Carla' });
  return hb.label.innerHTML === 'after destroy' && ha.label.innerHTML === 'Carla' ? true : false;
}, test.limit.quick);

// the label's editor checks the rule before it asks
test.run('a name the rule refuses is refused here, and not asked', 0.2, async function () {
  if (!C) return false;
  labelField = (function () { let f = null; const p = window.spirit.element.row.create;
    window.spirit.element.row.create = function (parts) { f = parts.fields.filter(function (x) { return x.name === 'label'; })[0]; return p(parts); };
    C.create({ key: 'K13', keep: true }); window.spirit.element.row.create = p; return f; }());
  const n = asked.length;
  const bad = await labelField.edit({ key: 'K13' }, '   ');
  let said = ''; try { LOADER.requireScript('spirit/type/string/label/script.js').isValid(''); } catch (e) { said = e.message; }
  return bad.ok === false && !!said && bad.error === said && asked.length === n ? true : false;
}, test.limit.quick);
test.run('a good name is normalized and asked of spirit.contact.label', 0.2, async function () {
  if (!labelField) return false;
  const good = await labelField.edit({ key: 'K13' }, '  Eve  ');
  const lab = asked.pop();
  return good.ok === true && lab.verb === 'spirit.contact.label' && lab.body.publicKey === 'K13' && lab.body.myLabel === 'Eve' ? true : false;
}, test.limit.quick);

// expandInfo asks spirit.contact.get once, for a row in the book
test.run('spirit.contact.get is asked by key, once, and the answer is kept', 0.2, async function () {
  if (!kept) return false;
  m = asked.length;
  await kept.expandInfo(); await kept.expandInfo();
  gets = asked.slice(m).filter(function (x) { return x.verb === 'spirit.contact.get'; });
  return gets.length === 1 && gets[0].body.key === 'K1' ? true : false;
}, test.limit.quick);
test.run('a row not in the book and a relay expand to nothing, asking nothing', 0.2, async function () {
  if (!gets) return false;
  const nothing = [await stranger.expandInfo(), await relay.expandInfo()];
  return nothing[0] === null && nothing[1] === null && asked.length === m + 1 ? true : false;
}, test.limit.quick);

// ── WHAT THE STREAM MEANS FOR CONTACTS, IN THE TYPE'S OWN ELEMENT (goal/G41.16; Andy: "get rid of thos FUCKING data.js
// scripts, DIDN't WE INSIST on the PROPER way to do this shit?"). The contacts' translation, spirit/element/search/contact/data.js
// until then, was the row element's (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates"), and is since goal/G41.28 the contact family's cache manager's (spirit/contact/client/script.js), which only its api.js
// requires: the row element requires no data script.
// the type's own element takes the contacts' stream: no data script
test.run('as it loads, the contact row element requires no data script', 0.2, function () {
  if (!C || !loaded) return false;
  return !loaded.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
const row = function (k) { return CD.contact(k); };
// relay-presence sets present, by key
test.run('a present key reads present, an absent one absent', 0.2, function () {
  if (!CD) return false;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  return row('KA') && row('KA').present === true && row('KB') && row('KB').present === false ? true : false;
}, test.limit.quick);
test.run('the same table again writes nothing', 0.2, function () {
  if (!CD) return false;
  let writes = 0;
  const stop = CD.watch(function (key) { if (key === 'KA') writes += 1; });
  D.takeJob({ id: 'spirit.contact', data: { presence: { KA: { present: true }, KB: { present: false } } } });
  stop();
  return writes === 0 ? true : false;
}, test.limit.quick);
test.run('a key the table drops goes back to not known; the others stand', 0.2, function () {
  if (!CD) return false;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KB: { present: false } } } });
  return row('KA') && row('KA').present === undefined && (row('KB') || {}).present === false ? true : false;
}, test.limit.quick);
test.run('an entry that is no proof writes nothing', 0.2, function () {
  if (!CD) return false;
  D.takeJob({ id: 'spirit.contact', data: { presence: { KC: 'not a proof', KD: null } } });
  return row('KC') === null && row('KD') === null ? true : false;
}, test.limit.quick);

// peer-search seats the row the network found
test.run('the item\'s label is merged into its row, by key', 0.2, function () {
  if (!CD) return false;
  D.takeJob({ id: 'spirit.contact', data: { q: 'be', item: { key: 'KE', label: JSON.stringify({ name: 'bert', blocked: true }) } } });
  return row('KE') && row('KE').name === 'bert' && row('KE').blocked === true ? true : false;
}, test.limit.quick);
test.run('a peer-search update with no item seats nothing', 0.2, function () {
  if (!CD) return false;
  const seated = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.contact', data: { q: 'be' } });
  // The branch read is the one the rows are in (KE just seated there), so an equal answer judges something.
  return 'KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === seated ? true : false;
}, test.limit.quick);
test.run('a label that is not JSON seats nothing', 0.2, function () {
  if (!CD) return false;
  D.takeJob({ id: 'spirit.contact', data: { item: { key: 'KF', label: 'not json' } } });
  return row('KF') === null ? true : false;
}, test.limit.quick);

// a rename sets the name, and keeps the rest
test.run('contact.rename sets name on the row, its other fields kept', 0.2, function () {
  if (!CD) return false;
  D.takeRename({ key: 'KE', caption: 'Bertie' });
  return (row('KE') || {}).name === 'Bertie' && (row('KE') || {}).blocked === true ? true : false;
}, test.limit.quick);
test.run('a rename of a key never seen makes its row, the caption as text', 0.2, function () {
  if (!CD) return false;
  D.takeRename({ key: 'KG', caption: 7 });
  return row('KG') && row('KG').name === '7' ? true : false;
}, test.limit.quick);

// other jobs are not contacts' business
test.run('a job of another type changes no contact', 0.2, function () {
  if (!CD) return false;
  const beforeC = JSON.stringify(D.branchAt(CD.branch));
  D.takeJob({ id: 'spirit.fs', data: { presence: { KZ: { present: true } }, item: { key: 'KZ', label: '{"name":"z"}' } } });
  return 'KE' in D.branchAt(CD.branch) && JSON.stringify(D.branchAt(CD.branch)) === beforeC ? true : false;
}, test.limit.quick);

// ── THE PARTS ONCE FILES OF THEIR OWN (row-noHeld.js, row-relayOnFace.js): one test file per script
// (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, run in order.

// ── noHeld (once row-noHeld.js): THE CONTACT ROW OFFERS NO heldActions (goal/G43.23, item 6, after goal/G43.17;
// spec: ./script.md, its noHeld section). Andy, G43.17: "Didn't i say remove ALL code referencing "admit" and "hold". it
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
// The line numbers of a file's code matching re.
function hits(file, re) {
  const c = code(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(i + 1); });
  return out;
}
const HELD_ROW = path.join(RUN, 'spirit', 'element', 'search', 'contact', 'row', 'script.js');
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
test.run('the file is read, and its code with comments left out still holds a line of code', 0.2, function () {
  const c = code(HELD_ROW);
  // Since goal/G49.9 the row calls the shared row element as requireScript answered it: ANSWER[...].create(.
  const anchor = /\.create\(/;
  return c !== null && anchor.test(c) ? true : false;
}, test.limit.quick);
test.run('the contact row\'s code holds no heldActions, nothing held', 0.2, function () {
  const h = hits(HELD_ROW, /\bheld/i);
  if (h === null) return false;
  return !h.length ? true : false;
}, test.limit.quick);

// ── relayOnFace (once row-relayOnFace.js): A RELAY'S ROW IS A RELAY'S, ON A FACE (goal/G41.32; spec: ./script.md,
// its relayOnFace section). A contact row follows its row: the presence stream puts a relay's row in the page before
// Contacts' search says relay: yes, and the row must open the relay, never the person's page. What it draws is
// spirit/element/search/contact/row/script.js's, so it is judged beside it (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS
// WHERE THEY FUCKING BELONG"; moved from the relay row section of shell/test/navigationWrapper-faceStarApps.js). A real
// Chrome: a real scratch node, a real relay, a real face and its login. A face at <name>.localhost is a secure context, as
// a face over https is. A step that could not run is red, never skipped.
const DOMAIN = 'localhost';
const NAME = 'apps';
const MAIL = 'bert@example.org';
const DRAWN_MS = 6000;
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
async function home(base, v, args) {
  const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: v, args: args || {} }) });
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
    q.on('error', function () { resolve({ status: 0, text: '' }); });
    q.end(bd);
  });
}
// A real join, a real face, a real login; answers the session, or none.
async function faceOf(N, R) {
  // The relay verbs are contact's since goal/G49.11 (box v9: "each one becomes a contact verb and names the relay by its row's public
  // key"): add by its url, which answers the relay's key, then join and face by that key. goal/G49.22: spirit.contact.<verb>.
  const added = await home(N.base, 'spirit.contact.add', { url: R.base, label: 'scratch' });
  const key = (added.body && added.body.relayKey) || '';
  if (!key) return {};
  await home(N.base, 'spirit.contact.join', { key: key, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const joinCode = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!joinCode) return {};
  await home(N.base, 'spirit.contact.join', { key: key, email: MAIL, code: joinCode });
  let f = null;
  for (let i = 0; i < 10; i++) { f = await home(N.base, 'spirit.contact.face', { key: key, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return {};
  // goal/G49.25, the relay's one door: the face's state and login are spirit.relay.faceState and faceLogin at POST /spirit,
  // where /face/api's state and login stood.
  await until(function () { return page(R, '/spirit', { call: 'spirit.relay.faceState', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await page(R, '/spirit', { call: 'spirit.relay.faceLogin', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return {};
  const done = await page(R, '/spirit', { call: 'spirit.relay.faceLogin', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : {};
}
// The names on a desktop, as it reads: icon and name line by line, the name lines only.
async function desktop(chrome, url) {
  await chrome.send('Page.navigate', { url: url });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.eventStream)'); }, 20000);
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
  try { if (RF.N && RF.N.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(RF.N); } catch (e) { /* scratch */ }
});
// row-relayOnFace: a relay's row in Contacts opens the relay on a face, whichever came first (goal/G41.32)
test.run('a scratch node and a scratch face relay come up', 0.2, async function () {
  RF.N = await scratchNode();
  RF.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  return RF.N.up && RF.R.up ? true : false;
}, test.limit.slow);
test.run('a real node has a real face, logged in', 0.2, async function () {
  if (!RF.N || !RF.N.up || !RF.R || !RF.R.up) return false;
  RF.F = await faceOf(RF.N, RF.R);
  return RF.F.sid ? true : false;
}, test.limit.long);
test.run('the browser holds the login', 0.2, async function () {
  if (!RF.F || !RF.F.sid) return false;
  const where = findChrome();
  if (!where) return false;
  RF.chrome = await chromePage(where);
  if (RF.chrome.error) return false;
  RF.FACE = 'http://' + NAME + '.' + DOMAIN + ':' + RF.R.port + '/';
  const set = await RF.chrome.send('Network.setCookie', { name: 'spirit_face', value: RF.F.sid, url: RF.FACE, path: '/' });
  return set.result && set.result.success ? true : false;
}, test.limit.quick);
// THE STAR, PUT ON AT HOME (goal/G43.18, box v29: "A face is whole, or there is none"; Andy, Q18: a face with no star shows
// nothing): the relay faceable, its face draws the home desktop, Contacts on it. spirit.contact.faceable (goal/G49.22) is 😏's one writer, at home.
test.run('the relay is starred at home, so its face is whole', 0.2, async function () {
  if (!RF.N || !RF.N.up || !RF.R || !RF.R.relayKey) return false;
  const on = await home(RF.N.base, 'spirit.contact.faceable', { key: RF.R.relayKey, faceable: true });
  return on.status === 200 ? true : false;
}, test.limit.quick);
// The face's desktop is drawn, so Contacts is there to press.
test.run('the face\'s desktop is drawn with Contacts on it', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return false;
  const plain = await desktop(RF.chrome, RF.FACE);
  return plain.indexOf('Contacts') !== -1 ? true : false;
}, test.limit.slow);
// A RELAY'S ROW IS A RELAY'S (goal/G41.32; Andy: "where the fuck did the contents of the relayPanel disappear to", "No
// folding panels anymore"; cw, on his node: the presence stream puts the row in the page before Contacts' search says
// relay: yes, so it was made as a person and stayed one). On a face that order is the usual one; a row follows its row.
// a relay's row in Contacts opens the relay, whichever came first
const TILE = '(function () { var a = Array.prototype.slice.call(document.querySelectorAll("*")); var e = a.filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === WORDS; })[0]; if (!e) return false; e.click(); return true; }())';
test.run('Contacts opens, 📡 Relays is chosen, and the relay\'s row is pressed', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return false;
  const press = function (words) { return RF.chrome.evaluate(TILE.replace('WORDS', JSON.stringify(words))); };
  const pressedApp = await press('Contacts');
  await sleep(DRAWN_MS / 2);
  // The app opens on People, which shows no relay (goal/G47.4, box v29): the relay is under 📡 Relays.
  const pressedKind = await press('📡 Relays');
  await sleep(DRAWN_MS / 4);
  const pressedRow = await press('scratch');
  return pressedApp === true && pressedKind === true && pressedRow === true ? true : false;
}, test.limit.slow);
test.run('the relay\'s panel opens with its folds', 0.2, async function () {
  if (!RF.chrome || RF.chrome.error || !RF.FACE) return false;
  await until(function () { return RF.chrome.evaluate('document.querySelectorAll(".nd-fold").length > 0'); }, 8000);
  RF.relayOpened = await RF.chrome.evaluate('JSON.stringify({ folds: document.querySelectorAll(".nd-fold").length, person: /Public Handle/.test(document.body.innerText) })').then(JSON.parse);
  return RF.relayOpened.folds > 0 ? true : false;
}, test.limit.long);
test.run('the relay\'s panel is not the person\'s page', 0.2, function () {
  if (!RF.relayOpened) return false;
  return RF.relayOpened.person === false ? true : false;
}, test.limit.quick);
