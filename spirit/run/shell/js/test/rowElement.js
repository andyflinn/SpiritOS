'use strict';

// spirit/run/shell/js/test/rowElement.js
// The tests of shell/js/rowElement.js, and of no other module (spec: ./rowElement.md). The browser file runs in node on
// a window of its own; a host is a plain object with an innerHTML.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'rowElement.js');
global.window = { spirit: {} };
vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
const R = window.spirit.elements.rowElement;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
// A host that counts its paints.
function counted() {
  const h = { writes: 0, value: '' };
  Object.defineProperty(h, 'innerHTML', { get: function () { return h.value; }, set: function (v) { h.value = v; h.writes += 1; } });
  return h;
}

test.startTest('rowElement.js: one element per subject');

test.subHeading('create: what the element says of itself');
const given = { name: 'ann', age: 3 };
const a = R.create({ kind: 7, key: 42, row: given, fields: [{ name: 'name' }, { name: 'age' }],
  actions: [{ name: 'block', label: 'Block', run: function () {} }, { name: 'open', run: function () {} }] });
ok(a.kind === '7' && a.key === '42', 'kind and key are text', 'kind/key: ' + JSON.stringify([a.kind, a.key]));
a.row.name = 'changed';
ok(given.name === 'ann', 'the row is a copy: the caller\'s object is never written', 'the caller\'s row was written: ' + given.name);
ok(JSON.stringify(a.fields) === '["name","age"]', 'fields are the field names, in order', 'fields: ' + JSON.stringify(a.fields));
ok(JSON.stringify(a.actions) === '[{"name":"block","label":"Block"},{"name":"open","label":"open"}]',
  'actions are name and label, the label defaulting to the name', 'actions: ' + JSON.stringify(a.actions));
const bare = R.create();
ok(bare.kind === '' && bare.key === '' && bare.cells().length === 0 && bare.actions.length === 0,
  'no parts at all makes an empty element, no throw', 'bare: ' + JSON.stringify(bare));

test.subHeading('cells: each field painted, in field order');
const b = R.create({ key: 'k', row: { name: 'bo', n: 0, none: null },
  fields: [{ name: 'name', paint: function (r) { return '<b>' + r.name + '</b>'; } }, { name: 'n' }, { name: 'none' }, { name: 'missing' },
    { name: 'bad', paint: function () { throw new Error('boom'); } }] });
const cells = b.cells();
ok(cells.map(function (c) { return c.name; }).join() === 'name,n,none,missing,bad', 'cells come in field order', 'order: ' + JSON.stringify(cells));
ok(cells[0].html === '<b>bo</b>', 'a field with paint is painted by it', 'paint: ' + cells[0].html);
ok(cells[1].html === '0', 'a field without paint shows its value as text, a zero included', 'value: ' + JSON.stringify(cells[1].html));
ok(cells[2].html === '' && cells[3].html === '', 'a null or missing value paints empty', 'empty: ' + JSON.stringify([cells[2].html, cells[3].html]));
ok(cells[4].html === '', 'a paint that throws paints empty and costs the other cells nothing', 'thrown: ' + JSON.stringify(cells[4].html));

test.subHeading('mount: each host painted');
const hn = counted();
const ret = b.mount({ name: hn });
ok(ret === b, 'mount answers the element', 'mount answered ' + typeof ret);
ok(hn.innerHTML === '<b>bo</b>' && hn.writes === 1, 'the named host is painted once', 'host: ' + JSON.stringify(hn));

test.subHeading('apply: only what changed repaints');
const hName = counted(); const hAge = counted(); const hStatus = counted();
const c = R.create({ key: 'c', row: { name: 'cy', age: 1, on: false },
  fields: [{ name: 'name' }, { name: 'age' },
    { name: 'status', from: ['on', 'age'], paint: function (r) { return (r.on ? 'on' : 'off') + '/' + r.age; } }] });
c.mount({ name: hName, age: hAge, status: hStatus });
c.apply({ name: 'cy' });
ok(hName.writes === 1 && hAge.writes === 1 && hStatus.writes === 1, 'an unchanged value repaints nothing',
  'writes after a no-change: ' + [hName.writes, hAge.writes, hStatus.writes]);
c.apply({ name: 'cyd' });
ok(hName.writes === 2 && hName.innerHTML === 'cyd' && hAge.writes === 1 && hStatus.writes === 1,
  'a changed value repaints its own field, and only it', 'writes: ' + [hName.writes, hAge.writes, hStatus.writes]);
ok(c.row.name === 'cyd', 'apply merges the value into the row', 'row: ' + JSON.stringify(c.row));
c.apply({ on: true });
ok(hStatus.writes === 2 && hStatus.innerHTML === 'on/1' && hName.writes === 2 && hAge.writes === 1,
  'a field repaints when a value it names in from changes', 'status: ' + JSON.stringify(hStatus));
c.apply({ age: 2 });
ok(hAge.writes === 2 && hStatus.writes === 3 && hStatus.innerHTML === 'on/2', 'one change repaints every field it touches',
  'writes: ' + [hAge.writes, hStatus.writes]);
c.apply({ extra: 1 });
ok(c.row.extra === 1 && hName.writes === 2 && hAge.writes === 2 && hStatus.writes === 3,
  'a value no field shows is kept and repaints nothing', 'extra: ' + JSON.stringify(c.row));
let threw = null;
try { c.apply(null); c.apply(undefined); } catch (e) { threw = e; }
ok(!threw, 'apply with nothing is ignored', 'apply(null) threw ' + threw);
const unmounted = R.create({ key: 'u', row: { name: 'x' }, fields: [{ name: 'name' }] });
threw = null;
try { unmounted.apply({ name: 'y' }); } catch (e) { threw = e; }
ok(!threw && unmounted.row.name === 'y', 'apply before mount merges and paints nothing', 'unmounted apply: ' + threw);
const partial = R.create({ key: 'p', row: { a: 1, b: 2 }, fields: [{ name: 'a' }, { name: 'b' }] });
const hb = counted();
partial.mount({ b: hb });
threw = null;
try { partial.apply({ a: 5, b: 6 }); } catch (e) { threw = e; }
ok(!threw && hb.innerHTML === '6', 'a field with no host is skipped; the others paint', 'partial: ' + threw + ' ' + hb.innerHTML);

test.subHeading('act: an action asks, by name');
let seen = null;
const d = R.create({ key: 'd', actions: [{ name: 'add', run: function (el, ctx) { seen = [el, ctx]; return 'added'; } },
  { name: 'later', run: function () { return Promise.resolve('waited'); } }, { name: 'norun' }] });

(async function () {
  const r1 = await d.act('add', { by: 'me' });
  ok(r1 === 'added' && seen[0] === d && seen[1].by === 'me', 'act runs the named action with the element and ctx, and answers its answer',
    'act: ' + JSON.stringify([r1, seen && seen[1]]));
  await d.act('add');
  ok(seen[1] && typeof seen[1] === 'object' && Object.keys(seen[1]).length === 0, 'a missing ctx arrives as {}', 'ctx: ' + JSON.stringify(seen[1]));
  ok(await d.act('later') === 'waited', 'an action\'s promise is waited for', 'later did not wait');
  const p = d.act('nope');
  ok(p && typeof p.then === 'function' && await p === null, 'an unknown action answers null, as a promise', 'unknown: ' + JSON.stringify(await p));
  ok(await d.act('norun') === null, 'an action without run answers null', 'norun did not answer null');

  test.subHeading('expandInfo: asked once, the answer kept');
  let asked = 0;
  const e = R.create({ key: 'e', expand: function (el) { asked += 1; return { long: el.key + '!' }; } });
  const x1 = e.expandInfo(); const x2 = e.expandInfo();
  const v = await x1;
  ok(asked === 1, 'expand is called once however often expandInfo is', 'expand called ' + asked + ' times');
  ok(x1 === x2 && v.long === 'e!', 'every call answers the same kept promise', 'expandInfo: ' + JSON.stringify(v));
  ok(await R.create({ key: 'f' }).expandInfo() === null, 'with no expand the answer is null', 'no expand did not answer null');

  test.subHeading('index: one subscription per kind; destroy leaves it');
  let subs = 0; let subArg = null;
  const idx = R.index(function (i) { subs += 1; subArg = i; });
  ok(subs === 0, 'making an index subscribes nothing yet', 'subscribed at creation');
  const g1 = R.create({ key: 'g', index: idx });
  ok(subs === 1 && subArg === idx, 'the first add subscribes, handing the index over', 'subs ' + subs);
  const g2 = R.create({ key: 'g', index: idx });
  const h1 = R.create({ key: 'h', index: idx });
  ok(subs === 1, 'later adds do not subscribe again', 'subs ' + subs);
  const forG = idx.forKey('g');
  ok(forG.length === 2 && forG[0] === g1 && forG[1] === g2, 'forKey gives every element of a subject, in order', 'forKey: ' + forG.length);
  forG.length = 0;
  ok(idx.forKey('g').length === 2, 'forKey answers a copy: changing it changes nothing', 'the index was changed through forKey');
  ok(Array.isArray(idx.forKey('zz')) && idx.forKey('zz').length === 0, 'an unknown key gives []', 'unknown forKey');
  ok(idx.keys().sort().join() === 'g,h', 'keys lists the subjects registered', 'keys: ' + idx.keys());
  const hg = counted();
  g1.mount({ name: hg });
  g1.destroy();
  ok(idx.forKey('g').length === 1 && idx.forKey('g')[0] === g2, 'destroy removes the element and only it', 'after destroy: ' + idx.forKey('g').length);
  g1.destroy();
  ok(idx.forKey('g').length === 1, 'a second destroy does nothing', 'second destroy removed ' + (1 - idx.forKey('g').length));
  const before = hg.writes;
  g1.apply({ name: 'late' });
  ok(g1.row.name === undefined && hg.writes === before, 'apply after destroy changes nothing and paints nothing', 'late apply: ' + JSON.stringify(g1.row));
  g2.destroy();
  ok(idx.keys().join() === 'h', 'a key whose last element leaves is gone from keys', 'keys: ' + idx.keys());
  idx.remove('h', {});
  idx.remove('nobody', h1);
  ok(idx.forKey('h').length === 1 && idx.forKey('h')[0] === h1, 'removing an element never registered changes nothing', 'h: ' + idx.forKey('h').length);
  threw = null;
  try { const plain = R.index(); plain.add('k', {}); } catch (err) { threw = err; }
  ok(!threw, 'an index without subscribe still adds', 'index() threw ' + threw);

  test.reportSuccessFailureCount();
}()).catch(function (err) { test.fail('the test itself threw', String(err && err.stack || err)); test.reportSuccessFailureCount(); });
