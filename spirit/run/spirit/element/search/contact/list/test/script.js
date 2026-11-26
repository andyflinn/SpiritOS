'use strict';

// spirit/run/spirit/element/search/contact/list/test/script.js
// The tests of spirit/element/search/contact/list/script.js, and of no other module: the contacts list's filters, and what its
// create hands the search element, a row's button and a pressed row (spec: ./script.md).
// The browser file runs in node on a window of its own; probabilitySearch is a recorder in its place, so this tests the
// list and not the search under it; the rows are the real contact row element (search/contact/row.js), over the real data set
// and the contact family's data.js (goal/G41.28), loaded by its api.js as a page's spirit.requireScript('spirit/contact/api.js') loads it,
// the page's node known as spirit.startPage makes it known (spirit.nodeFacts.key, then data.homeNode).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');

const JS = path.join(__dirname, '..', '..', '..', '..');
function load(file) { PAGE_LOAD.runAsPage(file); }
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
const asked = [];
const required = [];
const subscribers = [];
const clicks = [];
const said = [];
const added = [];
let searchAnswer = { items: [{ key: 'K1' }], more: true };
let made = null;
let atLoad = null;
let L = null, F = null, dataSubscribed = 0, pane = null, o = null, CD = null, el = null, r0 = 0, mo = null, to = null, tg = null, trow = null;

test.run('the contacts list runs on a window of its own, with its row element and the data set real', 0.2, function () {
  global.window = { spirit: {} };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = window.spirit;
  window.spirit.readyPromise = Promise.resolve({
    contact: { search: function (b) { asked.push({ verb: 'contact.search', body: b }); return Promise.resolve(searchAnswer); } },
    peer: { acquire: function (b) { asked.push({ verb: 'peer.acquire', body: b }); return Promise.resolve({ publicLabel: b.publicLabel }); },
      // A card ask through the spirit object (goal/G43.24): the packet as it went, and the card the node verified.
      post: function (b) {
        const sent = window.spirit.required.spirit.peer.packet.decode(b.text);
        asked.push({ verb: 'peer.post', key: b.to, body: sent.body, app: sent.app, legacy: sent.legacy });
        return Promise.resolve(b.to === 'KW' ? { ok: true, card: { ok: false, why: 'wrong key' } } : { ok: true, card: { ok: true, name: 'zed', description: 'hi' } });
      } },
  });
  // The packet envelope, the real one (spirit/peer/packet/script.js), as the list requires it.
  ((window.spirit.required = window.spirit.required || {}).spirit = window.spirit.required.spirit || {}); (window.spirit.required.spirit.peer = window.spirit.required.spirit.peer || {}); window.spirit.required.spirit.peer.packet = LOADER.requireScript('spirit/peer/packet/script.js');
  Object.assign(window.spirit, {
    // spirit.peerPost as spirit.js has it on a page (goal/G43.24): the body in its packet envelope, posted through the
    // node's peer.post (the stand-in above); how.answer resolves the node's whole answer, { ok, status, body, card, from, error }.
    peerPost: function (peer, app, body, how) {
      const PK = window.spirit.required.spirit.peer.packet;
      const m = PK.encode(app, body);
      return Promise.resolve(window.spirit.readyPromise).then(function (f) { return f.peer.post({ to: String(peer), text: m.text }); }).then(function (s) {
        const text = s && typeof s.text === 'string' ? s.text : '';
        const got = text ? PK.decode(text).body : null;
        const yes = !got || got.ok === undefined || !!got.ok;
        if (how && how.answer === true) return { ok: !!(s && s.ok) && yes, status: 200, body: got, card: (s && s.card) || null, from: (s && s.from) || '', error: (s && s.error) || '' };
        return got;
      });
    },
  });
  // goal/G43.32: what the list draws with stands where an element now finds it, spirit.required.spirit.element.
  (((window.spirit.required = window.spirit.required || {}).spirit = window.spirit.required.spirit || {})).element = nestSearch({
    'search': { create: function (host, opts) {
      made = { host: host, opts: opts, refreshes: 0, destroyed: false };
      return { refresh: function () { made.refreshes += 1; }, destroy: function () { made.destroyed = true; } };
    } },
    // Made in a panel's pane (goal/G43.18), recording what it was made with.
    'search.contact.detail': { create: function (p, opts) { asked.push({ verb: 'contactDetails', body: opts }); return {}; } },
    natterDetails: { open: function (opts) { asked.push({ verb: 'natterDetails', body: opts }); } },
  });
  // The one loader, a recorder: what the list requires, answered at once (the elements above stand in for what it loads).
  // goal/G43.32: the helper an element places itself with comes from the page stand-in (headLessChrome.js pageSpirit).
  // packet.js above takes the real spirit.js, whose require is the node's; the page stand-in goes back on top of it.
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  const pageRequire = window.spirit.requireScript;
  // A branch's api.js (spirit.requireScript('spirit/contact/api.js')): its real companion data.js runs once, attaching itself to
  // the data set loaded below, as the real api.js requires it (goal/G47.1).
  const ran = {};
  window.spirit.requireScript = function (p) {
    required.push(p);
    const m = /^spirit\/(.+)\/api\.js$/.exec(String(p));
    const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
    if (companion && !ran[companion] && fs.existsSync(path.join(JS, '..', '..', companion))) { ran[companion] = true; load(path.join(JS, '..', '..', companion)); }
    // A branch by its api.js path (goal/G49.6: never by a name): the stand-in node's branch of that name, refused when it has
    // none.
    const b = /^spirit\/(?:app\/)?([^/]+)\/api\.js$/.exec(String(p));
    if (b) return Promise.resolve(window.spirit.readyPromise).then(function (f) { if (!f || !f[b[1]]) throw new Error('not-found ' + p); return f[b[1]]; });
    if (/installSpiritElement\.js$/.test(p)) return pageRequire(p);
    // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
    // Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
    // stands at its place, a stand-in above or a real file loaded, and a path with nothing there is refused.
    const keys = String(p).replace(/\.js$/, '').split('/');
    if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
    const at = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit.required);
    return at && (typeof at === 'object' || typeof at === 'function') ? Promise.resolve(at) : Promise.reject(new Error('no stand-in for ' + p));
  };
  // The page's stream, a recorder: who subscribes to it (goal/G41.28: no client but spirit.required.spirit.data takes it itself).
  window.spirit.eventStream = { subscribe: function (h) { subscribers.push(h); return function () {}; } };
  load(path.join(JS, '..', '..', 'spirit', 'data', 'script.js'));
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  window.spirit.nodeFacts = { key: NODE_KEY };
  window.spirit.required.spirit.data.homeNode(NODE_KEY);
  load(path.join(JS, 'row', 'script.js'));
  load(path.join(JS, 'search', 'contact', 'row', 'script.js'));
  dataSubscribed = subscribers.length;
  load(path.join(JS, 'search', 'contact', 'list', 'script.js'));
  // What the list and its parts required as they loaded, before the suite's own report to testicle requires anything.
  atLoad = required.slice();
  L = window.spirit.required.spirit.element.search.contact.list;
  F = {}; L.filters.forEach(function (f) { F[f.name] = f; });
  return true;
}, test.limit.quick);

// it loads what it uses
// goal/G41.16: no data script; what the stream means for contacts is the contact branch's data.js's (goal/G41.28), which
// only its api.js requires (goal/G47.1).
test.run('when it loads, it requires its row and the search element through spirit.requireScript, and no data script', 0.2, function () {
  const own = ['spirit/element/search/contact/row/script.js', 'spirit/element/search/script.js'];
  if (!atLoad) return false;
  return own.every(function (p) { return atLoad.indexOf(p) !== -1; }) && !atLoad.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);

// THE KIND FILTERS (goal/G47.4, box: "these search filters. - 👨‍👩‍👧‍👦 People - ⭐ Puppets - 📡 Relays - ❌ Blocked are mutualy
// exclusive, only one active at the time. the all button must go."): one filter of choices, so one at a time, its choices
// those four in that order, each with its icon and word, and no all.
const KINDS = [{ keep: true, name: 'p' }, { mine: true, name: 'm' }, { relay: true, name: 'r' }, { blocked: true, name: 'b' }];
let kindF = null;
const choicesOf = function () { return !kindF ? [] : typeof kindF.choices === 'function' ? kindF.choices(KINDS) : Array.isArray(kindF.choices) ? kindF.choices : []; };
test.run('one filter of choices holds the kinds, so only one is active at a time', 0.2, function () {
  if (!F) return false;
  const withChoices = Object.keys(F).filter(function (k) { return typeof F[k].choices === 'function' || Array.isArray(F[k].choices); });
  kindF = withChoices.length === 1 ? F[withChoices[0]] : null;
  return !!kindF ? true : false;
}, test.limit.quick);
// Its title names the kinds in words: the family icon holds an invisible joiner, which the description rule refuses in a
// test title (goal/G47.4, spirit/fieldRules/script.js).
test.run('its choices are People, Puppets, Relays and Blocked, in that order', 0.2, function () {
  const c = choicesOf();
  return JSON.stringify(c.map(function (x) { return [x.icon, x.word]; })) === JSON.stringify([['👨‍👩‍👧‍👦', 'People'], ['⭐', 'Puppets'], ['📡', 'Relays'], ['❌', 'Blocked']]) ? true : false;
}, test.limit.quick);
test.run('the all choice is gone', 0.2, function () {
  if (!kindF) return false;
  return !choicesOf().some(function (x) { return x.value === 'all' || /^all$/i.test(String(x.word || '')); }) ? true : false;
}, test.limit.quick);
// Box v28: "👨‍👩‍👧‍👦 People (nodes only, includes node-puppets, excludes relays and blocked)", "⭐ Puppets (starred/owned nodes or
// relays ...)", "📡 Relays", "❌ Blocked".
const NODE = { keep: true, name: 'n' }; const NODE_PUPPET = { keep: true, mine: true, name: 'np' };
const RELAY = { relay: true, name: 'r' }; const RELAY_PUPPET = { relay: true, mine: true, name: 'rp' }; const BLOCKED = { blocked: true, name: 'b' };
const lets = function (i, row) { const c = choicesOf(); return c.length === 4 && kindF.test(row, c[i].value) === 1; };
test.run('People lets through a node and a node puppet, and no relay and no blocked row', 0.2, function () {
  return lets(0, NODE) && lets(0, NODE_PUPPET) && !lets(0, RELAY) && !lets(0, RELAY_PUPPET) && !lets(0, BLOCKED) ? true : false;
}, test.limit.quick);
// Box v29: "The default is \"People\", when the app first opens." The shared search starts a filter at its first choice
// when its choices are a list, and at nothing when they are a function (spirit/element/search/script.js, values); wherever the
// kind filter starts, it lets through what People does.
test.run('the kind filter starts at People: where the shared search starts it, a node passes and no relay and no blocked row', 0.2, function () {
  if (!kindF) return false;
  const start = Array.isArray(kindF.choices) && kindF.choices.length ? kindF.choices[0].value : '';
  return kindF.test(NODE, start) === 1 && kindF.test(NODE_PUPPET, start) === 1 && kindF.test(RELAY, start) === 0 && kindF.test(BLOCKED, start) === 0 ? true : false;
}, test.limit.quick);
test.run('Puppets lets through a starred node and a starred relay, and no plain node or relay', 0.2, function () {
  return lets(1, NODE_PUPPET) && lets(1, RELAY_PUPPET) && !lets(1, NODE) && !lets(1, RELAY) ? true : false;
}, test.limit.quick);
test.run('Relays lets through a relay, and no node', 0.2, function () {
  return lets(2, RELAY) && !lets(2, NODE) && !lets(2, NODE_PUPPET) ? true : false;
}, test.limit.quick);
test.run('Blocked lets through a blocked row, and no node or relay', 0.2, function () {
  return lets(3, BLOCKED) && !lets(3, NODE) && !lets(3, RELAY) ? true : false;
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
// "🔍 Search Network is a separate toggle, independent of the other filters" (box).
test.run('the network toggle says 🔍 Search Network', 0.2, function () {
  if (!F) return false;
  return F.network.toggle === true && F.network.icon === '🔍' && F.network.word === 'Search Network' ? true : false;
}, test.limit.quick);
test.run('the named filter is never a button, and it lets through a row with a name or a relay, never a bare presence', 0.2, function () {
  if (!F) return false;
  return F.named.when() === false && F.named.test({ name: 'a' }) === 1 && F.named.test({ relay: true }) === 1 && F.named.test({ present: true }) === 0 && F.named.test(null) === 0 ? true : false;
}, test.limit.quick);

// create hands the search element the one table
test.run('the list is a view of spirit.required.spirit.data.contact.data.branch, with filters and columns presence, status, label and add', 0.2, function () {
  if (!L) return false;
  const host = { isConnected: true, addEventListener: function (t, fn) { if (t === 'click') clicks.push(fn); } };
  // The mounter's panel stack's open (goal/G43.18), filling its pane at once.
  const openLayer = function (key, spec) { return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); };
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): it is handed no api; its search is its own data source.
  pane = L.create(host, { open: openLayer, say: function (t) { said.push(t); }, onAdded: function (r) { added.push(r); } });
  o = made.opts;
  CD = ((window.spirit.required.spirit.data || {}).contact || {}).data;
  return required.indexOf('spirit/contact/api.js') !== -1 && CD && typeof CD.branch === 'string' && CD.branch !== '' && o.data === CD.branch && Array.isArray(o.filters) && o.filters.length === L.filters.length && L.filters.every(function (f, i) { return o.filters[i] === f; }) && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add'
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
test.run('a row nobody decided about asks that node who it is (peer.post, a card ask in its envelope), and says its card', 0.2, async function () {
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
test.run('a table names its branch and verb, has no contact filters, nothing to open, and one column, the label', 0.2, function () {
  if (!L) return false;
  realReady = window.spirit.readyPromise;
  window.spirit.readyPromise = Promise.resolve({ agent: { job: function (b) { tableAsked.push(b); return Promise.resolve({ items: [{ key: 'row1', label: JSON.stringify({ id: 'KJ', title: 'Night job' }) }] }); } },
    contact: { search: function (b) { tableAsked.push({ contact: b }); return Promise.resolve({ items: [] }); } } });
  global.spirit = window.spirit;
  L.create({ isConnected: true, addEventListener: function () {} }, { table: 'loopback://api/agent/job', key: 'id', label: 'title', face: 'dropdown' });
  to = made.opts;
  return typeof to.search === 'function' && to.filters.length === 0 && to.details === undefined && to.columns.map(function (c) { return c.field; }).join(',') === 'label'
    ? true : false;
}, test.limit.quick);
test.run('a table of the agent tables\' norm is asked a search with the text trimmed, through the spirit object, at that branch and verb', 0.2, async function () {
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
  const res = made.opts.data === window.spirit.required.spirit.data.contact.data.branch && made.opts.filters.length === L.filters.length ? true : false;
  window.spirit.readyPromise = realReady;
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
  window.spirit.required.spirit.data.takeJob({ id: 'spirit.contact', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
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
