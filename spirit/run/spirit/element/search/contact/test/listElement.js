'use strict';

// spirit/run/spirit/element/search/contact/test/listElement.js
// The tests of spirit/element/search/contact/listElement.js, and of no other module: the contacts list's filters, and what its
// create hands the search element, a row's button and a pressed row (spec: ./listElement.md).
// The browser file runs in node on a window of its own; probabilitySearch is a recorder in its place, so this tests the
// list and not the search under it; the rows are the real contact row element (search/contact/rowElement.js), over the real data set
// and the contact family's data.js (goal/G41.28), loaded as a page's spirit.cacheManager('contact') loads it,
// the page's node known as spirit.start makes it known (spirit.node.key, then data.homeNode).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '..', '..', '..', '..', '..'), 'spirit', 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
const asked = [];
const required = [];
const subscribers = [];
const managers = [];
const clicks = [];
const said = [];
const added = [];
let searchAnswer = { items: [{ key: 'K1' }], more: true };
let made = null;
let L = null, F = null, dataSubscribed = 0, pane = null, o = null, CD = null, el = null, r0 = 0, mo = null, to = null, tg = null, trow = null;

test.run('the contacts list runs on a window of its own, with its row element and the data set real', 0.2, function () {
  global.window = { spirit: {} };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(__dirname, '..', '..', '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = window.spirit;
  window.spirit.ready = Promise.resolve({
    contact: { search: function (b) { asked.push({ verb: 'contact.search', body: b }); return Promise.resolve(searchAnswer); } },
    peer: { acquire: function (b) { asked.push({ verb: 'peer.acquire', body: b }); return Promise.resolve({ publicLabel: b.publicLabel }); },
      // A card ask through the spirit object (goal/G43.24): the packet as it went, and the card the node verified.
      post: function (b) {
        const sent = window.spirit.packet.decode(b.text);
        asked.push({ verb: 'peer.post', key: b.to, body: sent.body, app: sent.app, legacy: sent.legacy });
        return Promise.resolve(b.to === 'KW' ? { ok: true, card: { ok: false, why: 'wrong key' } } : { ok: true, card: { ok: true, name: 'zed', description: 'hi' } });
      } },
  });
  // The packet envelope, the real one (spirit/client/packet.js), as the list requires it.
  window.spirit.packet = require(path.join(__dirname, '..', '..', '..', '..', 'client', 'packet.js'));
  Object.assign(window.spirit, {
    // spirit.peerPost as spirit.js has it on a page (goal/G43.24): the body in its packet envelope, posted through the
    // node's peer.post (the stand-in above); how.answer resolves the node's whole answer, { ok, status, body, card, from, error }.
    peerPost: function (peer, app, body, how) {
      const PK = window.spirit.packet;
      const m = PK.encode(app, body);
      return Promise.resolve(window.spirit.ready).then(function (f) { return f.peer.post({ to: String(peer), text: m.text }); }).then(function (s) {
        const text = s && typeof s.text === 'string' ? s.text : '';
        const got = text ? PK.decode(text).body : null;
        const yes = !got || got.ok === undefined || !!got.ok;
        if (how && how.answer === true) return { ok: !!(s && s.ok) && yes, status: 200, body: got, card: (s && s.card) || null, from: (s && s.from) || '', error: (s && s.error) || '' };
        return got;
      });
    },
  });
  // goal/G43.32: what the list draws with stands where an element now finds it, spirit.element.spirit.element.
  (((window.spirit.element = window.spirit.element || {}).spirit = window.spirit.element.spirit || {})).element = nestSearch({
    'search': { create: function (host, opts) {
      made = { host: host, opts: opts, refreshes: 0, destroyed: false };
      return { refresh: function () { made.refreshes += 1; }, destroy: function () { made.destroyed = true; } };
    } },
    // Made in a panel's pane (goal/G43.18), recording what it was made with.
    'search.contact.detailElement': { create: function (p, opts) { asked.push({ verb: 'contactDetails', body: opts }); return {}; } },
    natterDetails: { open: function (opts) { asked.push({ verb: 'natterDetails', body: opts }); } },
  });
  // The one loader, a recorder: what the list requires, answered at once (the elements above stand in for what it loads).
  // goal/G43.32: the helper an element places itself with comes from the page stand-in (headLessChrome.js pageSpirit).
  // packet.js above takes the real spirit.js, whose require is the node's; the page stand-in goes back on top of it.
  require(path.join(__dirname, '..', '..', '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  const pageRequire = window.spirit.require;
  window.spirit.require = function (p) { required.push(p); return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : Promise.resolve({}); };
  // The page's stream, a recorder: who subscribes to it (goal/G41.28: no client but spirit.data takes it itself).
  window.spirit.event = { subscribe: function (h) { subscribers.push(h); return function () {}; } };
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
  dataSubscribed = subscribers.length;
  load(path.join(JS, 'search', 'contact', 'listElement.js'));
  L = window.spirit.element.spirit.element.search.contact.listElement;
  F = {}; L.filters.forEach(function (f) { F[f.name] = f; });
  return true;
}, test.limit.quick);

// it loads what it uses
// goal/G41.16: no data script; what the stream means for contacts is the contact family's manager's (goal/G41.28).
test.run('when it loads, it requires its row and the search element through spirit.require, and no data script', 0.2, function () {
  const own = ['spirit/element/search/contact/rowElement.js', 'spirit/element/search.js'];
  return own.every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);

// the show filter: all, then each kind the list holds
const values = function (rows) { return F.show.choices(rows).map(function (c) { return c.value; }).join(','); };
test.run('the show filter offers only all over plain kept rows, and mine, blocked and relay after it in that order when there are such rows', 0.2, function () {
  if (!F) return false;
  return values([{ keep: true }]) === 'all' && values([{ mine: true }, { blocked: true }, { relay: true }]) === 'all,mine,blocked,relay' ? true : false;
}, test.limit.quick);
test.run('its buttons show only when there is a kind to choose', 0.2, function () {
  if (!F) return false;
  return F.show.when([{ keep: true }]) === false && F.show.when([{ relay: true }]) === true ? true : false;
}, test.limit.quick);
test.run('all lets every row through, and a kind lets through only the rows whose flag is exactly true', 0.2, function () {
  if (!F) return false;
  return F.show.test({ keep: true }, 'all') === 1 && F.show.test({ keep: true }, '') === 1 && F.show.test({ mine: true }, 'mine') === 1
    && F.show.test({ keep: true }, 'mine') === 0 && F.show.test({ mine: 'yes' }, 'mine') === 0 ? true : false;
}, test.limit.quick);

// the network toggle and the named rule
const stranger = {}; const keptRow = { keep: true }; const relayRow = { relay: true };
test.run('a row nobody decided about, a network find, shows only with network on', 0.2, function () {
  if (!F) return false;
  return F.network.toggle === true && F.network.test(stranger, false) === 0 && F.network.test(stranger, true) === 1 ? true : false;
}, test.limit.quick);
test.run('a row that is kept, a relay or blocked shows with network off', 0.2, function () {
  if (!F) return false;
  return F.network.test(keptRow, false) === 1 && F.network.test(relayRow, false) === 1 && F.network.test({ blocked: true }, false) === 1 ? true : false;
}, test.limit.quick);
test.run('the named filter is never a button, and it lets through a row with a name or a relay, never a bare presence', 0.2, function () {
  if (!F) return false;
  return F.named.when() === false && F.named.test({ name: 'a' }) === 1 && F.named.test({ relay: true }) === 1 && F.named.test({ present: true }) === 0 && F.named.test(null) === 0 ? true : false;
}, test.limit.quick);

// create hands the search element the one table
test.run('the list is a view of the contact family\'s contacts in spirit.data.contact.data.branch, with the list\'s filters and the columns presence, status, label and add', 0.2, function () {
  if (!L) return false;
  const host = { isConnected: true, addEventListener: function (t, fn) { if (t === 'click') clicks.push(fn); } };
  // The mounter's panel stack's open (goal/G43.18), filling its pane at once.
  const openLayer = function (key, spec) { return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); };
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): it is handed no api; its search is its own data source.
  pane = L.create(host, { open: openLayer, say: function (t) { said.push(t); }, onAdded: function (r) { added.push(r); } });
  o = made.opts;
  CD = ((window.spirit.data || {}).contact || {}).data;
  return managers.indexOf('contact') !== -1 && CD && typeof CD.branch === 'string' && CD.branch !== '' && o.data === CD.branch && Array.isArray(o.filters) && o.filters.length === L.filters.length && L.filters.every(function (f, i) { return o.filters[i] === f; }) && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add'
    ? true : false;
}, test.limit.quick);
test.run('it fills as soon as it is drawn: one refresh at create', 0.2, function () {
  if (!o) return false;
  return made.refreshes === 1 ? true : false;
}, test.limit.quick);
test.run('its search asks contact.search with the text trimmed, and answers as a reply', 0.2, async function () {
  if (!o) return false;
  const got = await o.search({ q: '  an ' }, 'search');
  const s = asked.pop();
  return s.verb === 'contact.search' && s.body.q === 'an' && got.status === 200 && got.body.ok === true && got.body.items.length === 1 && got.body.more === true ? true : false;
}, test.limit.quick);
test.run('an empty answer is an empty list, like any other', 0.2, async function () {
  if (!o) return false;
  searchAnswer = null;
  const empty = await o.search({}, 'search');
  return empty.body.ok === true && Array.isArray(empty.body.items) && empty.body.items.length === 0 && empty.body.more === false ? true : false;
}, test.limit.quick);
test.run('each row is a contactElement, keyed by the row\'s key', 0.2, function () {
  if (!o) return false;
  el = o.element({ keep: true, name: 'anna' }, 'K1');
  return el.kind === 'contact' && el.key === 'K1' && el.row.name === 'anna' ? true : false;
}, test.limit.quick);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row"):
// the list hands its search no matched() of its own.
test.run('it hands its search no matched function of its own, so the whole row is matched', 0.2, function () {
  if (!o) return false;
  return typeof o.matched !== 'function' ? true : false;
}, test.limit.quick);

// pressing a row
test.run('a kept row opens its Contact', 0.2, async function () {
  if (!o) return false;
  o.details({ keep: true }, 'K1', el);
  await tick();
  const open = asked.pop();
  return open.verb === 'contactDetails' && open.body.key === 'K1' ? true : false;
}, test.limit.quick);
test.run('a row nobody decided about asks that node who it is (peer.post through the spirit object, a card ask in its envelope), and says its card', 0.2, async function () {
  if (!o) return false;
  o.details({ name: 'z' }, 'KZ', null);
  await tick();
  const card = asked.pop();
  return card.verb === 'peer.post' && card.key === 'KZ' && card.body && card.body.card === true && card.legacy === false && card.app === null && said[said.length - 1] === 'zed: hi'
    ? true : false;
}, test.limit.quick);
test.run('a card from a different key is said as such', 0.2, async function () {
  if (!o) return false;
  o.details({}, 'KW', null);
  await tick();
  return /answered by a different key/.test(said[said.length - 1]) ? true : false;
}, test.limit.quick);

// a row's Add button
function target(action, key) {
  const b = { getAttribute: function (n) { return n === 'data-action' ? action : null; },
    closest: function (sel) { return sel === '[data-action]' ? (action ? b : null) : tr; } };
  const tr = { getAttribute: function () { return key; } };
  return { target: b };
}
test.run('Add runs the row\'s add, says it, tells onAdded, and searches again', 0.2, async function () {
  if (!o) return false;
  o.element({ publicLabel: 'bob' }, 'K2');
  r0 = made.refreshes;
  clicks[0](target('add', 'K2'));
  await tick();
  const acq = asked.pop();
  return acq.verb === 'peer.acquire' && acq.body.publicKey === 'K2' && said[said.length - 1] === 'added bob' && added.length === 1 && made.refreshes === r0 + 1
    ? true : false;
}, test.limit.quick);
test.run('a click on no button, or on a row the list did not make, does nothing', 0.2, async function () {
  if (!o) return false;
  const n = asked.length;
  clicks[0](target(null, 'K2'));
  clicks[0](target('add', 'NOPE'));
  await tick();
  return asked.length === n && made.refreshes === r0 + 1 ? true : false;
}, test.limit.quick);

// ONE CONTACT LIST (goal/G43.32; Andy: "contact: there should be only 1 list, i didn't even know there where two...."): what the
// contact picker drew as a list of its own until then, this list does.
// what the picker alone did: hidden filters, marks, a press that picks
const hid = { name: 'offered', when: function () { return false; }, test: function () { return 1; } };
let marked = null;
test.run('the hidden filters a caller hands in opts.filters come after the list\'s own', 0.2, function () {
  if (!L) return false;
  marked = L.create({ isConnected: true, addEventListener: function () {} }, { filters: [hid], statuses: [{ status: 'none' }, { status: 'waiting', glyph: '⌛' }], details: null });
  mo = made.opts;
  return mo.filters.length === L.filters.length + 1 && mo.filters[mo.filters.length - 1] === hid ? true : false;
}, test.limit.quick);
test.run('given statuses, the list has a mark column as its last column', 0.2, function () {
  if (!mo) return false;
  return mo.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add,mark' ? true : false;
}, test.limit.quick);
test.run('with details set to null, a press in the pane picks the row instead of opening it, as in Chat\'s peers pane', 0.2, function () {
  if (!mo) return false;
  return mo.details === undefined ? true : false;
}, test.limit.quick);
test.run('marking a row with a status gives it that status\'s glyph, and the first status, the default none, gives no glyph', 0.2, function () {
  if (!mo) return false;
  const me = mo.element({ keep: true, name: 'mo' }, 'K5');
  const markOf = function () { const c = me.cells().filter(function (x) { return x.name === 'mark'; })[0]; return c ? c.html : null; };
  const before = markOf();
  marked.mark('K5', 'waiting');
  const after = markOf();
  marked.mark('K5', 'none');
  return before === '' && after === '⌛' && markOf() === '' ? true : false;
}, test.limit.quick);

// any ID table of the shadow roll's shape (goal/G41.13, Andy, Q2)
const tableAsked = [];
let realReady = null;
test.run('a table names its family and verb, has no contact filters, nothing to open, and one column, the label', 0.2, function () {
  if (!L) return false;
  realReady = window.spirit.ready;
  window.spirit.ready = Promise.resolve({ agent: { job: function (b) { tableAsked.push(b); return Promise.resolve({ items: [{ key: 'row1', label: JSON.stringify({ id: 'KJ', title: 'Night job' }) }] }); } },
    contact: { search: function (b) { tableAsked.push({ contact: b }); return Promise.resolve({ items: [] }); } } });
  global.spirit = window.spirit;
  L.create({ isConnected: true, addEventListener: function () {} }, { table: 'loopback://api/agent/job', key: 'id', label: 'title', face: 'dropdown' });
  to = made.opts;
  return to.server === 'agent' && to.verb === 'job' && to.filters.length === 0 && to.details === undefined && to.columns.map(function (c) { return c.field; }).join(',') === 'label'
    ? true : false;
}, test.limit.quick);
test.run('a table of the agent tables\' norm is asked a search with the text trimmed, through the spirit object, at that family and verb', 0.2, async function () {
  if (!to) return false;
  tg = await to.search({ text: ' night ' });
  trow = tg.body.items[0] ? JSON.parse(tg.body.items[0].label) : null;
  return tableAsked[0] && tableAsked[0].op === 'search' && tableAsked[0].text === 'night' ? true : false;
}, test.limit.quick);
test.run('opts.key names the field a row\'s ID is in, opts.label the field its label is in', 0.2, function () {
  if (!tg) return false;
  return tg.body.items.length === 1 && tg.body.items[0].key === 'KJ' && trow && trow.name === 'Night job' ? true : false;
}, test.limit.quick);
test.run('a table\'s row is a plain row of its label, no contact', 0.2, function () {
  if (!to) return false;
  const tel = to.element(trow, 'KJ');
  return tel && tel.kind === 'id' && tel.key === 'KJ' ? true : false;
}, test.limit.quick);
test.run('naming the contacts\' own table is the same as naming none', 0.2, function () {
  if (!L) return false;
  L.create({ isConnected: true, addEventListener: function () {} }, { table: 'loopback://api/contact/search' });
  const res = made.opts.server === 'contact' && made.opts.filters.length === L.filters.length ? true : false;
  window.spirit.ready = realReady;
  global.spirit = window.spirit;
  return res;
}, test.limit.quick);

// the one table is the contact family's cache, and the list takes no stream itself (goal/G41.28)
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions."
test.run('loaded and created, the list subscribes to no stream of its own', 0.2, function () {
  if (!L) return false;
  return subscribers.length === dataSubscribed ? true : false;
}, test.limit.quick);
test.run('a row the node\'s shadow job hands is in the branch the list handed its search', 0.2, async function () {
  if (!o) return false;
  window.spirit.data.takeJob({ id: 'spirit.contact', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
  await tick();
  const kept = CD && CD.contact('K1');
  return kept && kept.blocked === true && o.data === CD.branch ? true : false;
}, test.limit.quick);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element', 0.2, function () {
  if (!pane) return false;
  const r2 = made.refreshes;
  pane.refresh(); pane.destroy();
  return made.refreshes === r2 + 1 && made.destroyed === true && pane.list ? true : false;
}, test.limit.quick);

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(m) { Object.keys(m).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = m[k]; delete m[k]; var ks = k.split('.'); var at = m; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return m; }
