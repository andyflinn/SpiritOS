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
const asked = [];
let searchAnswer = { items: [{ key: 'K1' }], more: true };
global.window = { spirit: {} };
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
    const made = PK.encode(app, body);
    return Promise.resolve(window.spirit.ready).then(function (f) { return f.peer.post({ to: String(peer), text: made.text }); }).then(function (said) {
      const text = said && typeof said.text === 'string' ? said.text : '';
      const got = text ? PK.decode(text).body : null;
      const yes = !got || got.ok === undefined || !!got.ok;
      if (how && how.answer === true) return { ok: !!(said && said.ok) && yes, status: 200, body: got, card: (said && said.card) || null, from: (said && said.from) || '', error: (said && said.error) || '' };
      return got;
    });
  },
});
let made = null;
window.spirit.element = nestSearch({
  'search': { create: function (host, o) {
    made = { host: host, opts: o, refreshes: 0, destroyed: false };
    return { refresh: function () { made.refreshes += 1; }, destroy: function () { made.destroyed = true; } };
  } },
  // Made in a panel's pane (goal/G43.18), recording what it was made with.
  'search.contact.detailElement': { create: function (pane, o) { asked.push({ verb: 'contactDetails', body: o }); return {}; } },
  natterDetails: { open: function (o) { asked.push({ verb: 'natterDetails', body: o }); } },
});
// The one loader, a recorder: what the list requires, answered at once (the elements above stand in for what it loads).
const required = [];
window.spirit.require = function (p) { required.push(p); return Promise.resolve({}); };
// The page's stream, a recorder: who subscribes to it (goal/G41.28: no client but spirit.data takes it itself).
const subscribers = [];
window.spirit.events = { subscribe: function (h) { subscribers.push(h); return function () {}; } };
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
const dataSubscribed = subscribers.length;
load(path.join(JS, 'search', 'contact', 'listElement.js'));
const L = window.spirit.element.search.contact.listElement;
const F = {}; L.filters.forEach(function (f) { F[f.name] = f; });
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

(async function () {
  test.startTest('contacts/listElement.js: the contacts list');

  test.subHeading('it loads what it uses');
  // goal/G41.16: no data script; what the stream means for contacts is the contact family's manager's (goal/G41.28).
  const own = ['spirit/element/search/contact/rowElement.js', 'spirit/element/search.js'];
  if (own.every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); })) test.check('loading, it requires its row and the search element through spirit.require, and no data script');
  else test.fail('as it loaded, the list required: ' + JSON.stringify(required));

  test.subHeading('the show filter: all, then each kind the list holds');
  const values = function (rows) { return F.show.choices(rows).map(function (c) { return c.value; }).join(','); };
  if (values([{ keep: true }]) === 'all' && values([{ mine: true }, { blocked: true }, { relay: true }]) === 'all,mine,blocked,relay')
    test.check('only all over plain kept rows; mine, blocked, relays in that order when there are any');
  else test.fail('choices: ' + values([{ mine: true }, { blocked: true }, { relay: true }]));
  if (F.show.when([{ keep: true }]) === false && F.show.when([{ relay: true }]) === true) test.check('its buttons show only when there is a kind to choose');
  else test.fail('show.when');
  if (F.show.test({ keep: true }, 'all') === 1 && F.show.test({ keep: true }, '') === 1 && F.show.test({ mine: true }, 'mine') === 1
    && F.show.test({ keep: true }, 'mine') === 0 && F.show.test({ mine: 'yes' }, 'mine') === 0) test.check('all lets every row through; a kind only rows whose flag is exactly true');
  else test.fail('show.test');

  test.subHeading('the network toggle and the named rule');
  const stranger = {}; const keptRow = { keep: true }; const relayRow = { relay: true };
  if (F.network.toggle === true && F.network.test(stranger, false) === 0 && F.network.test(stranger, true) === 1) test.check('a row nobody decided about, a network find, shows only with network on');
  else test.fail('network on a stranger');
  if (F.network.test(keptRow, false) === 1 && F.network.test(relayRow, false) === 1 && F.network.test({ blocked: true }, false) === 1)
    test.check('a row that is kept, a relay or blocked shows with network off');
  else test.fail('network on decided rows');
  if (F.named.when() === false && F.named.test({ name: 'a' }) === 1 && F.named.test({ relay: true }) === 1 && F.named.test({ present: true }) === 0 && F.named.test(null) === 0)
    test.check('named, never a button: a row with a name or a relay, never a bare presence');
  else test.fail('named');

  test.subHeading('create hands the search element the one table');
  const clicks = [];
  const host = { isConnected: true, addEventListener: function (t, fn) { if (t === 'click') clicks.push(fn); } };
  const said = []; const added = [];
  // The mounter's panel stack's open (goal/G43.18), filling its pane at once.
  const openLayer = function (key, spec) { return Promise.resolve(spec.fill({})).then(function () { return { hide: function () {}, set: function () {}, shown: function () { return true; } }; }); };
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): it is handed no api; its search is its own data source.
  const pane = L.create(host, { open: openLayer, say: function (t) { said.push(t); }, onAdded: function (r) { added.push(r); } });
  const o = made.opts;
  const CD = ((window.spirit.data || {}).contact || {}).data;
  if (managers.indexOf('contact') !== -1 && CD && typeof CD.branch === 'string' && CD.branch !== '' && o.data === CD.branch && o.filters === L.filters && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add')
    test.check('a view of the contact family\'s contacts (spirit.data.contact.data.branch), the list\'s filters, columns presence, status, label, add');
  else test.fail('the opts: ' + JSON.stringify({ data: o.data, contactBranch: CD && CD.branch, managers: managers, columns: o.columns }));
  if (made.refreshes === 1) test.check('it fills as soon as it is drawn: one refresh at create');
  else test.fail('refreshes at create: ' + made.refreshes);
  const got = await o.search({ q: '  an ' }, 'search');
  const s = asked.pop();
  if (s.verb === 'contact.search' && s.body.q === 'an' && got.status === 200 && got.body.ok === true && got.body.items.length === 1 && got.body.more === true)
    test.check('its search asks contact.search with the text trimmed, and answers as a reply');
  else test.fail('search: ' + JSON.stringify({ s: s, got: got }));
  searchAnswer = null;
  const empty = await o.search({}, 'search');
  if (empty.body.ok === true && Array.isArray(empty.body.items) && empty.body.items.length === 0 && empty.body.more === false) test.check('an empty answer is an empty list, like any other');
  else test.fail('an empty answer: ' + JSON.stringify(empty));
  const el = o.element({ keep: true, name: 'anna' }, 'K1');
  if (el.kind === 'contact' && el.key === 'K1' && el.row.name === 'anna') test.check('each row is a contactElement, keyed by the row\'s key');
  else test.fail('the element: ' + JSON.stringify({ kind: el.kind, key: el.key }));
  // THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row"):
  // the list hands its search no matched() of its own.
  if (typeof o.matched !== 'function') test.check('it hands its search no matched(): the whole row is matched (goal/G41.28)');
  else test.fail('it still hands matched()');

  test.subHeading('pressing a row');
  o.details({ keep: true }, 'K1', el);
  await tick();
  const open = asked.pop();
  if (open.verb === 'contactDetails' && open.body.key === 'K1') test.check('a kept row opens its Contact');
  else test.fail('pressing a kept row: ' + JSON.stringify(open));
  o.details({ name: 'z' }, 'KZ', null);
  await tick();
  const card = asked.pop();
  if (card.verb === 'peer.post' && card.key === 'KZ' && card.body && card.body.card === true && card.legacy === false && card.app === null && said[said.length - 1] === 'zed: hi')
    test.check('a row nobody decided about asks that node who it is (peer.post through the spirit object, a card ask in its envelope), and says its card');
  else test.fail('pressing an undecided row: ' + JSON.stringify({ card: card, said: said }));
  o.details({}, 'KW', null);
  await tick();
  if (/answered by a different key/.test(said[said.length - 1])) test.check('a card from a different key is said as such');
  else test.fail('a wrong key said: ' + said[said.length - 1]);

  test.subHeading('a row\'s Add button');
  o.element({ publicLabel: 'bob' }, 'K2');
  function target(action, key) {
    const b = { getAttribute: function (n) { return n === 'data-action' ? action : null; },
      closest: function (sel) { return sel === '[data-action]' ? (action ? b : null) : tr; } };
    const tr = { getAttribute: function () { return key; } };
    return { target: b };
  }
  const r0 = made.refreshes;
  clicks[0](target('add', 'K2'));
  await tick();
  const acq = asked.pop();
  if (acq.verb === 'peer.acquire' && acq.body.publicKey === 'K2' && said[said.length - 1] === 'added bob' && added.length === 1 && made.refreshes === r0 + 1)
    test.check('Add runs the row\'s add, says it, tells onAdded, and searches again');
  else test.fail('Add: ' + JSON.stringify({ acq: acq, said: said.slice(-2), added: added, refreshes: made.refreshes - r0 }));
  const n = asked.length;
  clicks[0](target(null, 'K2'));
  clicks[0](target('add', 'NOPE'));
  await tick();
  if (asked.length === n && made.refreshes === r0 + 1) test.check('a click on no button, or on a row the list did not make, does nothing');
  else test.fail('a stray click asked ' + JSON.stringify(asked.slice(n)));

  test.subHeading('the one table is the contact family\'s cache, and the list takes no stream itself (goal/G41.28)');
  // Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
  // item. no exceptions."
  if (subscribers.length === dataSubscribed) test.check('loaded and created, the list subscribes to no stream of its own');
  else test.fail('the list subscribed to the stream ' + (subscribers.length - dataSubscribed) + ' times');
  window.spirit.data.takeJob({ id: 'spirit.contact', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
  await tick();
  const kept = CD && CD.contact('K1');
  if (kept && kept.blocked === true && o.data === CD.branch) test.check('a row the node\'s shadow job hands is in the branch the list handed its search');
  else test.fail('after the shadow job: ' + JSON.stringify(kept));

  test.subHeading('refresh and destroy are the search element\'s');
  const r2 = made.refreshes;
  pane.refresh(); pane.destroy();
  if (made.refreshes === r2 + 1 && made.destroyed === true && pane.list) test.check('refresh and destroy reach the search element');
  else test.fail('refresh/destroy');

  test.reportSuccessFailureCount();
}());

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
