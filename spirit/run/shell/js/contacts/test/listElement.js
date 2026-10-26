'use strict';

// spirit/run/shell/js/contacts/test/listElement.js
// The tests of shell/js/contacts/listElement.js, and of no other module: the contacts list's filters, and what its
// create hands the search element and does with the stream, a row's button and a pressed row (spec: ./listElement.md).
// The browser file runs in node on a window of its own; probabilitySearch is a recorder in its place, so this tests the
// list and not the search under it; the rows are the real contactElement (contacts/rowElement.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../../..'), 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..');
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
window.spirit.elements = {
  probabilitySearch: { create: function (host, o) {
    made = { host: host, opts: o, refreshes: 0, destroyed: false };
    return { refresh: function () { made.refreshes += 1; }, destroy: function () { made.destroyed = true; } };
  } },
  contactDetails: { open: function (o) { asked.push({ verb: 'contactDetails', body: o }); } },
  natterDetails: { open: function (o) { asked.push({ verb: 'natterDetails', body: o }); } },
};
let onUpdate = null; let unsubscribed = 0;
window.spirit.events = { subscribe: function (h) { onUpdate = h.onUpdate; return function () { unsubscribed += 1; }; } };
load(path.join(JS, 'spiritData.js'));
load(path.join(JS, 'rowElement.js'));
load(path.join(JS, 'contacts', 'rowElement.js'));
load(path.join(JS, 'contacts', 'listElement.js'));
const L = window.spirit.elements.contactList;
const F = {}; L.filters.forEach(function (f) { F[f.name] = f; });
const tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

(async function () {
  test.startTest('contacts/listElement.js: the contacts list');

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
  if (o.data === 'contacts' && o.filters === L.filters && o.columns.map(function (c) { return c.field; }).join(',') === 'presence,status,label,add')
    test.check('data.contacts, the list\'s filters, columns presence, status, label, add');
  else test.fail('the opts: ' + JSON.stringify({ data: o.data, columns: o.columns }));
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
  const m = o.matched({ name: 'anna', publicLabel: 'A', keep: true });
  if (JSON.stringify(m) === '{"name":"anna","publicLabel":"A"}' && JSON.stringify(o.matched(null)) === '{"name":"","publicLabel":""}') test.check('a row is matched on its name and public label, as text');
  else test.fail('matched: ' + JSON.stringify(m));

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

  test.subHeading('the one table on the stream');
  const r1 = made.refreshes;
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'K1', keep: true, present: true } } });
  if (made.refreshes === r1) test.check('a row it shows whose flags did not move repaints nothing here');
  else test.fail('an unmoved row refreshed');
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'K1', keep: true, blocked: true } } });
  if (made.refreshes === r1 + 1) test.check('a row it shows whose flags moved makes it search again');
  else test.fail('a moved row did not refresh');
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'K1', keep: true, gone: true } } });
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'NEW', held: true } } });
  if (made.refreshes === r1 + 3) test.check('a row gone, or one not shown that the owner now lists, searches again');
  else test.fail('gone/new refreshed ' + (made.refreshes - r1 - 1));
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'NEW2', present: true } } });
  onUpdate({ type: 'relay-presence', data: { row: { publicKey: 'NEW3', keep: true } } });
  if (made.refreshes === r1 + 3) test.check('an unlisted row, or another job, searches nothing');
  else test.fail('an unlisted row or another job refreshed');
  host.isConnected = false;
  onUpdate({ type: 'shadow', data: { row: { publicKey: 'NEW4', keep: true } } });
  if (unsubscribed === 1 && made.refreshes === r1 + 3) test.check('once off the page it lets go of the stream, and searches nothing');
  else test.fail('off the page: ' + JSON.stringify({ unsubscribed: unsubscribed, refreshes: made.refreshes - r1 }));

  test.subHeading('refresh and destroy are the search element\'s');
  const r2 = made.refreshes;
  pane.refresh(); pane.destroy();
  if (made.refreshes === r2 + 1 && made.destroyed === true && pane.list) test.check('refresh and destroy reach the search element');
  else test.fail('refresh/destroy');

  test.reportSuccessFailureCount();
}());
