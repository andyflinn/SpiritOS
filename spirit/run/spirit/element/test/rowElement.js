'use strict';

// spirit/run/spirit/element/test/rowElement.js
// The tests of spirit/element/rowElement.js, and of no other module (spec: ./rowElement.md). The browser file runs in node on
// a window of its own; a host is a plain object with an innerHTML.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'rowElement.js');
global.window = { spirit: {} };
// goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
require(path.join(__dirname, '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
// The element, once the first test has run its file.
let R = null;

// A host that counts its paints.
function counted() {
  const h = { writes: 0, value: '' };
  Object.defineProperty(h, 'innerHTML', { get: function () { return h.value; }, set: function (v) { h.value = v; h.writes += 1; } });
  return h;
}

// What the tests make, shared by the tests after them.
let given, a, bare, b, cells, hn, ret, hName, hAge, hStatus, c, threw, unmounted, partial, hb, seen, d;
test.run('kind and key are text', 0.2, function () {
  // create: what the element says of itself
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  R = window.spirit.element.spirit.element.rowElement;
  given = { name: 'ann', age: 3 };
  a = R.create({ kind: 7, key: 42, row: given, fields: [{ name: 'name' }, { name: 'age' }],
    actions: [{ name: 'block', label: 'Block', run: function () {} }, { name: 'open', run: function () {} }] });
  return (a.kind === '7' && a.key === '42') ? true : 'kind/key: ' + JSON.stringify([a.kind, a.key]);
}, 1000);
test.run('the row is a copy: the caller\'s object is never written', 0.2, function () {
  a.row.name = 'changed';
  return (given.name === 'ann') ? true : 'the caller\'s row was written: ' + given.name;
}, 1000);
test.run('fields are the field names, in order', 0.2, function () {
  return (JSON.stringify(a.fields) === '["name","age"]') ? true : 'fields: ' + JSON.stringify(a.fields);
}, 1000);
test.run('actions are name and label, the label defaulting to the name', 0.2, function () {
  return (JSON.stringify(a.actions) === '[{"name":"block","label":"Block"},{"name":"open","label":"open"}]') ? true : 'actions: ' + JSON.stringify(a.actions);
}, 1000);
test.run('no parts at all makes an empty element, no throw', 0.2, function () {
  bare = R.create();
  return (bare.kind === '' && bare.key === '' && bare.cells().length === 0 && bare.actions.length === 0) ? true : 'bare: ' + JSON.stringify(bare);
}, 1000);
test.run('cells come in field order', 0.2, function () {
  // cells: each field painted, in field order
  b = R.create({ key: 'k', row: { name: 'bo', n: 0, none: null },
    fields: [{ name: 'name', paint: function (r) { return '<b>' + r.name + '</b>'; } }, { name: 'n' }, { name: 'none' }, { name: 'missing' },
      { name: 'bad', paint: function () { throw new Error('boom'); } }] });
  cells = b.cells();
  return (cells.map(function (c) { return c.name; }).join() === 'name,n,none,missing,bad') ? true : 'order: ' + JSON.stringify(cells);
}, 1000);
test.run('a field with paint is painted by it', 0.2, function () {
  return (cells[0].html === '<b>bo</b>') ? true : 'paint: ' + cells[0].html;
}, 1000);
test.run('a field without paint shows its value as text, a zero included', 0.2, function () {
  return (cells[1].html === '0') ? true : 'value: ' + JSON.stringify(cells[1].html);
}, 1000);
test.run('a null or missing value paints empty', 0.2, function () {
  return (cells[2].html === '' && cells[3].html === '') ? true : 'empty: ' + JSON.stringify([cells[2].html, cells[3].html]);
}, 1000);
test.run('a paint that throws paints empty and costs the other cells nothing', 0.2, function () {
  return (cells[4].html === '') ? true : 'thrown: ' + JSON.stringify(cells[4].html);
}, 1000);
test.run('mount answers the element', 0.2, function () {
  // mount: each host painted
  hn = counted();
  ret = b.mount({ name: hn });
  return (ret === b) ? true : 'mount answered ' + typeof ret;
}, 1000);
test.run('the named host is painted once', 0.2, function () {
  return (hn.innerHTML === '<b>bo</b>' && hn.writes === 1) ? true : 'host: ' + JSON.stringify(hn);
}, 1000);
test.run('an unchanged value repaints nothing', 0.2, function () {
  // apply: only what changed repaints
  hName = counted();
  hAge = counted();
  hStatus = counted();
  c = R.create({ key: 'c', row: { name: 'cy', age: 1, on: false },
    fields: [{ name: 'name' }, { name: 'age' },
      { name: 'status', from: ['on', 'age'], paint: function (r) { return (r.on ? 'on' : 'off') + '/' + r.age; } }] });
  c.mount({ name: hName, age: hAge, status: hStatus });
  c.apply({ name: 'cy' });
  return (hName.writes === 1 && hAge.writes === 1 && hStatus.writes === 1) ? true : 'writes after a no-change: ' + [hName.writes, hAge.writes, hStatus.writes];
}, 1000);
test.run('a changed value repaints its own field, and only it', 0.2, function () {
  c.apply({ name: 'cyd' });
  return (hName.writes === 2 && hName.innerHTML === 'cyd' && hAge.writes === 1 && hStatus.writes === 1) ? true : 'writes: ' + [hName.writes, hAge.writes, hStatus.writes];
}, 1000);
test.run('apply merges the value into the row', 0.2, function () {
  return (c.row.name === 'cyd') ? true : 'row: ' + JSON.stringify(c.row);
}, 1000);
test.run('a field repaints when a value it names in from changes', 0.2, function () {
  c.apply({ on: true });
  return (hStatus.writes === 2 && hStatus.innerHTML === 'on/1' && hName.writes === 2 && hAge.writes === 1) ? true : 'status: ' + JSON.stringify(hStatus);
}, 1000);
test.run('one change repaints every field it touches', 0.2, function () {
  c.apply({ age: 2 });
  return (hAge.writes === 2 && hStatus.writes === 3 && hStatus.innerHTML === 'on/2') ? true : 'writes: ' + [hAge.writes, hStatus.writes];
}, 1000);
test.run('a value no field shows is kept and repaints nothing', 0.2, function () {
  c.apply({ extra: 1 });
  return (c.row.extra === 1 && hName.writes === 2 && hAge.writes === 2 && hStatus.writes === 3) ? true : 'extra: ' + JSON.stringify(c.row);
}, 1000);
test.run('apply with nothing is ignored', 0.2, function () {
  threw = null;
  try { c.apply(null); c.apply(undefined); } catch (e) { threw = e; }
  return (!threw) ? true : 'apply(null) threw ' + threw;
}, 1000);
test.run('apply before mount merges and paints nothing', 0.2, function () {
  unmounted = R.create({ key: 'u', row: { name: 'x' }, fields: [{ name: 'name' }] });
  threw = null;
  try { unmounted.apply({ name: 'y' }); } catch (e) { threw = e; }
  return (!threw && unmounted.row.name === 'y') ? true : 'unmounted apply: ' + threw;
}, 1000);
test.run('a field with no host is skipped; the others paint', 0.2, function () {
  partial = R.create({ key: 'p', row: { a: 1, b: 2 }, fields: [{ name: 'a' }, { name: 'b' }] });
  hb = counted();
  partial.mount({ b: hb });
  threw = null;
  try { partial.apply({ a: 5, b: 6 }); } catch (e) { threw = e; }
  return (!threw && hb.innerHTML === '6') ? true : 'partial: ' + threw + ' ' + hb.innerHTML;
}, 1000);
// What the tests make, shared by the tests after them.
let r1, p, asked, e, x1, x2, v, subs, subArg, idx, g1, g2, h1, forG, hg, before;
test.run('act runs the named action with the element and ctx, and answers its answer', 0.2, async function () {
  // act: an action asks, by name
  seen = null;
  d = R.create({ key: 'd', actions: [{ name: 'add', run: function (el, ctx) { seen = [el, ctx]; return 'added'; } },
    { name: 'later', run: function () { return Promise.resolve('waited'); } }, { name: 'norun' }] });
  r1 = await d.act('add', { by: 'me' });
  return (r1 === 'added' && seen[0] === d && seen[1].by === 'me') ? true : 'act: ' + JSON.stringify([r1, seen && seen[1]]);
}, 1000);
test.run('a missing ctx arrives as {}', 0.2, async function () {
  await d.act('add');
  return (seen[1] && typeof seen[1] === 'object' && Object.keys(seen[1]).length === 0) ? true : 'ctx: ' + JSON.stringify(seen[1]);
}, 1000);
test.run('an action\'s promise is waited for', 0.2, async function () {
  return (await d.act('later') === 'waited') ? true : 'later did not wait';
}, 1000);
test.run('an unknown action answers null, as a promise', 0.2, async function () {
  p = d.act('nope');
  return (p && typeof p.then === 'function' && await p === null) ? true : 'unknown: ' + JSON.stringify(await p);
}, 1000);
test.run('an action without run answers null', 0.2, async function () {
  return (await d.act('norun') === null) ? true : 'norun did not answer null';
}, 1000);
test.run('expand is called once however often expandInfo is', 0.2, async function () {
  // expandInfo: asked once, the answer kept
  asked = 0;
  e = R.create({ key: 'e', expand: function (el) { asked += 1; return { long: el.key + '!' }; } });
  x1 = e.expandInfo();
  x2 = e.expandInfo();
  v = await x1;
  return (asked === 1) ? true : 'expand called ' + asked + ' times';
}, 1000);
test.run('every call answers the same kept promise', 0.2, function () {
  return (x1 === x2 && v.long === 'e!') ? true : 'expandInfo: ' + JSON.stringify(v);
}, 1000);
test.run('with no expand the answer is null', 0.2, async function () {
  return (await R.create({ key: 'f' }).expandInfo() === null) ? true : 'no expand did not answer null';
}, 1000);
test.run('making an index subscribes nothing yet', 0.2, function () {
  // index: one subscription per kind; destroy leaves it
  subs = 0;
  subArg = null;
  idx = R.index(function (i) { subs += 1; subArg = i; });
  return (subs === 0) ? true : 'subscribed at creation';
}, 1000);
test.run('the first add subscribes, handing the index over', 0.2, function () {
  g1 = R.create({ key: 'g', index: idx });
  return (subs === 1 && subArg === idx) ? true : 'subs ' + subs;
}, 1000);
test.run('later adds do not subscribe again', 0.2, function () {
  g2 = R.create({ key: 'g', index: idx });
  h1 = R.create({ key: 'h', index: idx });
  return (subs === 1) ? true : 'subs ' + subs;
}, 1000);
test.run('forKey gives every element of a subject, in order', 0.2, function () {
  forG = idx.forKey('g');
  return (forG.length === 2 && forG[0] === g1 && forG[1] === g2) ? true : 'forKey: ' + forG.length;
}, 1000);
test.run('forKey answers a copy: changing it changes nothing', 0.2, function () {
  forG.length = 0;
  return (idx.forKey('g').length === 2) ? true : 'the index was changed through forKey';
}, 1000);
test.run('an unknown key gives []', 0.2, function () {
  return (Array.isArray(idx.forKey('zz')) && idx.forKey('zz').length === 0) ? true : 'unknown forKey';
}, 1000);
test.run('keys lists the subjects registered', 0.2, function () {
  return (idx.keys().sort().join() === 'g,h') ? true : 'keys: ' + idx.keys();
}, 1000);
test.run('destroy removes the element and only it', 0.2, function () {
  hg = counted();
  g1.mount({ name: hg });
  g1.destroy();
  return (idx.forKey('g').length === 1 && idx.forKey('g')[0] === g2) ? true : 'after destroy: ' + idx.forKey('g').length;
}, 1000);
test.run('a second destroy does nothing', 0.2, function () {
  g1.destroy();
  return (idx.forKey('g').length === 1) ? true : 'second destroy removed ' + (1 - idx.forKey('g').length);
}, 1000);
test.run('apply after destroy changes nothing and paints nothing', 0.2, function () {
  before = hg.writes;
  g1.apply({ name: 'late' });
  return (g1.row.name === undefined && hg.writes === before) ? true : 'late apply: ' + JSON.stringify(g1.row);
}, 1000);
test.run('a key whose last element leaves is gone from keys', 0.2, function () {
  g2.destroy();
  return (idx.keys().join() === 'h') ? true : 'keys: ' + idx.keys();
}, 1000);
test.run('removing an element never registered changes nothing', 0.2, function () {
  idx.remove('h', {});
  idx.remove('nobody', h1);
  return (idx.forKey('h').length === 1 && idx.forKey('h')[0] === h1) ? true : 'h: ' + idx.forKey('h').length;
}, 1000);
test.run('an index without subscribe still adds', 0.2, function () {
  threw = null;
  try { const plain = R.index(); plain.add('k', {}); } catch (err) { threw = err; }
  return (!threw) ? true : 'index() threw ' + threw;
}, 1000);
