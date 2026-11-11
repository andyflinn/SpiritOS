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
const NO_LIST = 'no contacts list: the world failed';
const NO_OPTS = 'the list was never created';

test.run('the world: the contacts list runs on a window of its own, its row element and the data set real', 0.2, function () {
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
test.run('loading, it requires its row and the search element through spirit.require, and no data script', 0.2, function () {
  const own = ['spirit/element/search/contact/rowElement.js', 'spirit/element/search.js'];
  return own.every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'as it loaded, the list required: ' + JSON.stringify(required);
}, test.limit.quick);

// the show filter: all, then each kind the list holds
const values = function (rows) { return F.show.choices(rows).map(function (c) { return c.value; }).join(','); };
test.run('only all over plain kept rows; mine, blocked, relays in that order when there are any', 0.2, function () {
  if (!F) return NO_LIST;
  return values([{ keep: true }]) === 'all' && values([{ mine: true }, { blocked: true }, { relay: true }]) === 'all,mine,blocked,relay' ? true : 'choices: ' + values([{ mine: true }, { blocked: true }, { relay: true }]);
}, test.limit.quick);
test.run('its buttons show only when there is a kind to choose', 0.2, function () {
  if (!F) return NO_LIST;
  return F.show.when([{ keep: true }]) === false && F.show.when([{ relay: true }]) === true ? true : 'show.when';
}, test.limit.quick);
test.run('all lets every row through; a kind only rows whose flag is exactly true', 0.2, function () {
  if (!F) return NO_LIST;
  return F.show.test({ keep: true }, 'all') === 1 && F.show.test({ keep: true }, '') === 1 && F.show.test({ mine: true }, 'mine') === 1
    && F.show.test({ keep: true }, 'mine') === 0 && F.show.test({ mine: 'yes' }, 'mine') === 0 ? true : 'show.test';
}, test.limit.quick);

// the network toggle and the named rule
const stranger = {}; const keptRow = { keep: true }; const relayRow = { relay: true };
test.run('a row nobody decided about, a network find, shows only with network on', 0.2, function () {
  if (!F) return NO_LIST;
  return F.network.toggle === true && F.network.test(stranger, false) === 0 && F.network.test(stranger, true) === 1 ? true : 'network on a stranger';
}, test.limit.quick);
test.run('a row that is kept, a relay or blocked shows with network off', 0.2, function () {
  if (!F) return NO_LIST;
  return F.network.test(keptRow, false) === 1 && F.network.test(relayRow, false) === 1 && F.network.test({ blocked: true }, false) === 1 ? true : 'network on decided rows';
}, test.limit.quick);
test.run('named, never a button: a row with a name or a relay, never a bare presence', 0.2, function () {
  if (!F) return NO_LIST;
  return F.named.when() === false && F.named.test({ name: 'a' }) === 1 && F.named.test({ relay: true }) === 1 && F.named.test({ present: true }) === 0 && F.named.test(null) === 0 ? true : 'named';
}, test.limit.quick);

// create hands the search element the one table
test.run('a view of the contact family\'s contacts (spirit.data.contact.data.branch), the list\'s filters, columns presence, status, label, add', 0.2, function () {
  if (!L) return NO_LIST;
  const host = { isConnected: true, addEventListener: function (t, fn) { if (t === 'click') clicks.push(fn); } };
  // The mounter's panel stack's open (goal/G43.18), filling its pane at once.
  const openLayer = function (key, spec) { return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); };
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): it is handed no api; its search is its own data source.
  pane = L.create(host, { open: openLayer, say: function (t) { said.push(t); }, onAdded: function (r) { added.push(r); } });
  o = made.opts;
  CD = ((window.spirit.data || {}).contact || {}).data;
  return managers.indexOf('contact') !== -1 && CD && typeof CD.branch === 'string' && CD.branch !== '' && o.data === CD.branch && Array.isArray(o.filters) && o.filters.length === L.filters.length && L.filters.every(function (f, i) { return o.filters[i] === f; }) && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add'
    ? true : 'the opts: ' + JSON.stringify({ data: o.data, contactBranch: CD && CD.branch, managers: managers, columns: o.columns });
}, test.limit.quick);
test.run('it fills as soon as it is drawn: one refresh at create', 0.2, function () {
  if (!o) return NO_OPTS;
  return made.refreshes === 1 ? true : 'refreshes at create: ' + made.refreshes;
}, test.limit.quick);
test.run('its search asks contact.search with the text trimmed, and answers as a reply', 0.2, async function () {
  if (!o) return NO_OPTS;
  const got = await o.search({ q: '  an ' }, 'search');
  const s = asked.pop();
  return s.verb === 'contact.search' && s.body.q === 'an' && got.status === 200 && got.body.ok === true && got.body.items.length === 1 && got.body.more === true ? true : 'search: ' + JSON.stringify({ s: s, got: got });
}, test.limit.quick);
test.run('an empty answer is an empty list, like any other', 0.2, async function () {
  if (!o) return NO_OPTS;
  searchAnswer = null;
  const empty = await o.search({}, 'search');
  return empty.body.ok === true && Array.isArray(empty.body.items) && empty.body.items.length === 0 && empty.body.more === false ? true : 'an empty answer: ' + JSON.stringify(empty);
}, test.limit.quick);
test.run('each row is a contactElement, keyed by the row\'s key', 0.2, function () {
  if (!o) return NO_OPTS;
  el = o.element({ keep: true, name: 'anna' }, 'K1');
  return el.kind === 'contact' && el.key === 'K1' && el.row.name === 'anna' ? true : 'the element: ' + JSON.stringify({ kind: el.kind, key: el.key });
}, test.limit.quick);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row"):
// the list hands its search no matched() of its own.
test.run('it hands its search no matched(): the whole row is matched (goal/G41.28)', 0.2, function () {
  if (!o) return NO_OPTS;
  return typeof o.matched !== 'function' ? true : 'it still hands matched()';
}, test.limit.quick);

// pressing a row
test.run('a kept row opens its Contact', 0.2, async function () {
  if (!o) return NO_OPTS;
  o.details({ keep: true }, 'K1', el);
  await tick();
  const open = asked.pop();
  return open.verb === 'contactDetails' && open.body.key === 'K1' ? true : 'pressing a kept row: ' + JSON.stringify(open);
}, test.limit.quick);
test.run('a row nobody decided about asks that node who it is (peer.post through the spirit object, a card ask in its envelope), and says its card', 0.2, async function () {
  if (!o) return NO_OPTS;
  o.details({ name: 'z' }, 'KZ', null);
  await tick();
  const card = asked.pop();
  return card.verb === 'peer.post' && card.key === 'KZ' && card.body && card.body.card === true && card.legacy === false && card.app === null && said[said.length - 1] === 'zed: hi'
    ? true : 'pressing an undecided row: ' + JSON.stringify({ card: card, said: said });
}, test.limit.quick);
test.run('a card from a different key is said as such', 0.2, async function () {
  if (!o) return NO_OPTS;
  o.details({}, 'KW', null);
  await tick();
  return /answered by a different key/.test(said[said.length - 1]) ? true : 'a wrong key said: ' + said[said.length - 1];
}, test.limit.quick);

// a row's Add button
function target(action, key) {
  const b = { getAttribute: function (n) { return n === 'data-action' ? action : null; },
    closest: function (sel) { return sel === '[data-action]' ? (action ? b : null) : tr; } };
  const tr = { getAttribute: function () { return key; } };
  return { target: b };
}
test.run('Add runs the row\'s add, says it, tells onAdded, and searches again', 0.2, async function () {
  if (!o) return NO_OPTS;
  o.element({ publicLabel: 'bob' }, 'K2');
  r0 = made.refreshes;
  clicks[0](target('add', 'K2'));
  await tick();
  const acq = asked.pop();
  return acq.verb === 'peer.acquire' && acq.body.publicKey === 'K2' && said[said.length - 1] === 'added bob' && added.length === 1 && made.refreshes === r0 + 1
    ? true : 'Add: ' + JSON.stringify({ acq: acq, said: said.slice(-2), added: added, refreshes: made.refreshes - r0 });
}, test.limit.quick);
test.run('a click on no button, or on a row the list did not make, does nothing', 0.2, async function () {
  if (!o) return NO_OPTS;
  const n = asked.length;
  clicks[0](target(null, 'K2'));
  clicks[0](target('add', 'NOPE'));
  await tick();
  return asked.length === n && made.refreshes === r0 + 1 ? true : 'a stray click asked ' + JSON.stringify(asked.slice(n));
}, test.limit.quick);

// ONE CONTACT LIST (goal/G43.32; Andy: "contact: there should be only 1 list, i didn't even know there where two...."): what the
// contact picker drew as a list of its own until then, this list does.
// what the picker alone did: hidden filters, marks, a press that picks
const hid = { name: 'offered', when: function () { return false; }, test: function () { return 1; } };
let marked = null;
test.run('a caller\'s hidden filters (opts.filters) come after its own (Andy: "Why can\'t chatter insert a hidden filter when it draws contacts?")', 0.2, function () {
  if (!L) return NO_LIST;
  marked = L.create({ isConnected: true, addEventListener: function () {} }, { filters: [hid], statuses: [{ status: 'none' }, { status: 'waiting', glyph: '⌛' }], details: null });
  mo = made.opts;
  return mo.filters.length === L.filters.length + 1 && mo.filters[mo.filters.length - 1] === hid ? true : 'filters: ' + mo.filters.map(function (f) { return f.name; }).join(',');
}, test.limit.quick);
test.run('statuses give it a mark column, last', 0.2, function () {
  if (!mo) return NO_OPTS;
  return mo.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add,mark' ? true : 'columns: ' + mo.columns.map(function (c) { return c.field; }).join(',');
}, test.limit.quick);
test.run('details: null, and a pane\'s press picks instead of opening the row (Chat\'s peers pane)', 0.2, function () {
  if (!mo) return NO_OPTS;
  return mo.details === undefined ? true : 'details: ' + typeof mo.details;
}, test.limit.quick);
test.run('mark(key, status) gives that row its glyph from statuses, the first the default (none: no glyph)', 0.2, function () {
  if (!mo) return NO_OPTS;
  const me = mo.element({ keep: true, name: 'mo' }, 'K5');
  const markOf = function () { const c = me.cells().filter(function (x) { return x.name === 'mark'; })[0]; return c ? c.html : null; };
  const before = markOf();
  marked.mark('K5', 'waiting');
  const after = markOf();
  marked.mark('K5', 'none');
  return before === '' && after === '⌛' && markOf() === '' ? true : 'mark: ' + JSON.stringify([before, after, markOf()]);
}, test.limit.quick);

// any ID table of the shadow roll's shape (goal/G41.13, Andy, Q2)
const tableAsked = [];
let realReady = null;
test.run('a table names its family and verb, has no contact filters, nothing to open, and one column, the label', 0.2, function () {
  if (!L) return NO_LIST;
  realReady = window.spirit.ready;
  window.spirit.ready = Promise.resolve({ agent: { job: function (b) { tableAsked.push(b); return Promise.resolve({ items: [{ key: 'row1', label: JSON.stringify({ id: 'KJ', title: 'Night job' }) }] }); } },
    contact: { search: function (b) { tableAsked.push({ contact: b }); return Promise.resolve({ items: [] }); } } });
  global.spirit = window.spirit;
  L.create({ isConnected: true, addEventListener: function () {} }, { table: 'loopback://api/agent/job', key: 'id', label: 'title', face: 'dropdown' });
  to = made.opts;
  return to.server === 'agent' && to.verb === 'job' && to.filters.length === 0 && to.details === undefined && to.columns.map(function (c) { return c.field; }).join(',') === 'label'
    ? true : 'opts: ' + JSON.stringify({ server: to.server, verb: to.verb, filters: to.filters.length, details: typeof to.details, columns: to.columns });
}, test.limit.quick);
test.run('a table of the agent tables\' norm is asked { op: search, text } through the spirit object, at that family and verb', 0.2, async function () {
  if (!to) return NO_OPTS;
  tg = await to.search({ text: ' night ' });
  trow = tg.body.items[0] ? JSON.parse(tg.body.items[0].label) : null;
  return tableAsked[0] && tableAsked[0].op === 'search' && tableAsked[0].text === 'night' ? true : 'asked: ' + JSON.stringify(tableAsked[0]);
}, test.limit.quick);
test.run('opts.key names the field a row\'s ID is in, opts.label the field its label is in', 0.2, function () {
  if (!tg) return 'the table was never searched';
  return tg.body.items.length === 1 && tg.body.items[0].key === 'KJ' && trow && trow.name === 'Night job' ? true : 'rows: ' + JSON.stringify(tg.body.items);
}, test.limit.quick);
test.run('a table\'s row is a plain row of its label, no contact', 0.2, function () {
  if (!to) return NO_OPTS;
  const tel = to.element(trow, 'KJ');
  return tel && tel.kind === 'id' && tel.key === 'KJ' ? true : 'row: ' + JSON.stringify(tel && { kind: tel.kind, key: tel.key });
}, test.limit.quick);
test.run('naming the contacts\' own table is the same as naming none', 0.2, function () {
  if (!L) return NO_LIST;
  L.create({ isConnected: true, addEventListener: function () {} }, { table: 'loopback://api/contact/search' });
  const res = made.opts.server === 'contact' && made.opts.filters.length === L.filters.length ? true : 'opts: ' + JSON.stringify({ server: made.opts.server });
  window.spirit.ready = realReady;
  global.spirit = window.spirit;
  return res;
}, test.limit.quick);

// the one table is the contact family's cache, and the list takes no stream itself (goal/G41.28)
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions."
test.run('loaded and created, the list subscribes to no stream of its own', 0.2, function () {
  if (!L) return NO_LIST;
  return subscribers.length === dataSubscribed ? true : 'the list subscribed to the stream ' + (subscribers.length - dataSubscribed) + ' times';
}, test.limit.quick);
test.run('a row the node\'s shadow job hands is in the branch the list handed its search', 0.2, async function () {
  if (!o) return NO_OPTS;
  window.spirit.data.takeJob({ id: 'spirit.contact', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
  await tick();
  const kept = CD && CD.contact('K1');
  return kept && kept.blocked === true && o.data === CD.branch ? true : 'after the shadow job: ' + JSON.stringify(kept);
}, test.limit.quick);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element', 0.2, function () {
  if (!pane) return NO_OPTS;
  const r2 = made.refreshes;
  pane.refresh(); pane.destroy();
  return made.refreshes === r2 + 1 && made.destroyed === true && pane.list ? true : 'refresh/destroy';
}, test.limit.quick);

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(m) { Object.keys(m).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = m[k]; delete m[k]; var ks = k.split('.'); var at = m; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return m; }
