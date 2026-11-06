'use strict';

// spirit/run/spirit/element/search/contact/test/listElement.js
// The tests of spirit/element/search/contact/listElement.js, and of no other module: the contacts list's filters, and what its
// create hands the search element, a row's button and a pressed row (spec: ./listElement.md).
// The browser file runs in node on a window of its own; probabilitySearch is a recorder in its place, so this tests the
// list and not the search under it; the rows are the real contactElement (contacts/rowElement.js), over the real data set
// and the contact family's data.js (goal/G41.28), loaded as a page's spirit.cacheManager('contact') loads it,
// the page's node known as spirit.start makes it known (spirit.node.key, then data.home).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '..', '..', '..', '..', '..'), 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const asked = [];
let searchAnswer = { items: [{ key: 'K1' }], more: true };
global.window = { spirit: {} };
global.spirit = window.spirit;
window.spirit.ready = Promise.resolve({
  contact: { search: function (b) { asked.push({ verb: 'contact.search', body: b }); return Promise.resolve(searchAnswer); } },
  peer: { acquire: function (b) { asked.push({ verb: 'peer.acquire', body: b }); return Promise.resolve({ publicLabel: b.publicLabel }); } },
});
let made = null;
window.spirit.element = {
  probabilitySearch: { create: function (host, o) {
    made = { host: host, opts: o, refreshes: 0, destroyed: false };
    return { refresh: function () { made.refreshes += 1; }, destroy: function () { made.destroyed = true; } };
  } },
  contactDetails: { open: function (o) { asked.push({ verb: 'contactDetails', body: o }); } },
  natterDetails: { open: function (o) { asked.push({ verb: 'natterDetails', body: o }); } },
};
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
load(path.join(JS, 'contact', 'rowElement.js'));
const dataSubscribed = subscribers.length;
load(path.join(JS, 'contact', 'listElement.js'));
const L = window.spirit.element.contactList;
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
  if (values([{ keep: true }]) === 'all' && values([{ mine: true }, { blocked: true }, { held: true }, { relay: true }]) === 'all,mine,blocked,held,relay')
    test.check('only all over plain kept rows; mine, blocked, held, relays in that order when there are any');
  else test.fail('choices: ' + values([{ mine: true }, { blocked: true }, { held: true }, { relay: true }]));
  if (F.show.when([{ keep: true }]) === false && F.show.when([{ relay: true }]) === true) test.check('its buttons show only when there is a kind to choose');
  else test.fail('show.when');
  if (F.show.test({ keep: true }, 'all') === 1 && F.show.test({ keep: true }, '') === 1 && F.show.test({ mine: true }, 'mine') === 1
    && F.show.test({ keep: true }, 'mine') === 0 && F.show.test({ mine: 'yes' }, 'mine') === 0) test.check('all lets every row through; a kind only rows whose flag is exactly true');
  else test.fail('show.test');

  test.subHeading('the network toggle and the named rule');
  const stranger = { held: true }; const keptHeld = { held: true, keep: true }; const heldRelay = { held: true, relay: true };
  if (F.network.toggle === true && F.network.test(stranger, false) === 0 && F.network.test(stranger, true) === 1) test.check('a held row nobody decided about shows only with network on');
  else test.fail('network on a stranger');
  if (F.network.test(keptHeld, false) === 1 && F.network.test(heldRelay, false) === 1 && F.network.test({ blocked: true, held: true }, false) === 1)
    test.check('a held row that is also kept, a relay or blocked shows with network off');
  else test.fail('network on decided rows');
  if (F.named.when() === false && F.named.test({ name: 'a' }) === 1 && F.named.test({ relay: true }) === 1 && F.named.test({ present: true }) === 0 && F.named.test(null) === 0)
    test.check('named, never a button: a row with a name or a relay, never a bare presence');
  else test.fail('named');

  test.subHeading('create hands the search element the one table');
  const clicks = [];
  const host = { isConnected: true, addEventListener: function (t, fn) { if (t === 'click') clicks.push(fn); } };
  const said = []; const added = [];
  const api = { peerPost: function (to, key, b) { asked.push({ verb: 'peerPost', key: key, body: b });
    return Promise.resolve(key === 'KW' ? { ok: true, card: { ok: false, why: 'wrong key' } } : { ok: true, card: { ok: true, name: 'zed', description: 'hi' } }); } };
  const pane = L.create(host, { api: api, say: function (t) { said.push(t); }, onAdded: function (r) { added.push(r); } });
  const o = made.opts;
  const CD = ((window.spirit.data || {}).contact || {}).data;
  if (managers.indexOf('contact') !== -1 && CD && typeof CD.branch === 'string' && CD.branch !== '' && o.data === CD.branch && o.filters === L.filters && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add')
    test.check('a view of the contact family\'s contacts (spirit.data.contact.data.branch), the list\'s filters, columns presence, status, label, add');
  else test.fail('the opts: ' + JSON.stringify({ data: o.data, contactBranch: CD && CD.branch, managers: managers, columns: o.columns }));
  if (made.refreshes === 1) test.check('it fills as soon as it is drawn: one refresh at create');
  else test.fail('refreshes at create: ' + made.refreshes);
  const got = await o.api.verb('search', { q: '  an ' });
  const s = asked.pop();
  if (s.verb === 'contact.search' && s.body.q === 'an' && got.status === 200 && got.body.ok === true && got.body.items.length === 1 && got.body.more === true)
    test.check('its search asks contact.search with the text trimmed, and answers as a reply');
  else test.fail('search: ' + JSON.stringify({ s: s, got: got }));
  searchAnswer = null;
  const empty = await o.api.verb('search', {});
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
  o.details({ held: true, name: 'z' }, 'KZ', null);
  await tick();
  const card = asked.pop();
  if (card.verb === 'peerPost' && card.key === 'KZ' && card.body.card === true && said[said.length - 1] === 'zed: hi') test.check('a held row asks that node who it is, and says its card');
  else test.fail('pressing a held row: ' + JSON.stringify({ card: card, said: said }));
  o.details({ held: true }, 'KW', null);
  await tick();
  if (/answered by a different key/.test(said[said.length - 1])) test.check('a card from a different key is said as such');
  else test.fail('a wrong key said: ' + said[said.length - 1]);

  test.subHeading('a row\'s Add button');
  o.element({ held: true, publicLabel: 'bob' }, 'K2');
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
  window.spirit.data.takeJob({ id: 'job_shadow', type: 'shadow', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
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
