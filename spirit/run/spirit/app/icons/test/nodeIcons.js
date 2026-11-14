'use strict';

// spirit/run/spirit/app/icons/test/nodeIcons.js
// The tests of spirit/app/icons/nodeIcons.js, and of no other module (spec: ./nodeIcons.md; goal/G43.19, box v16): the
// icon set's node half, one table. The box: "./node<Name>.js will maintain the table (run://spirit/state/icons/data/iconSet.json)",
// "it is initialized from run://spirit/iconSet.json when it does not exist yet", "only ./nodeIcons.js writes the table";
// 9: "two saves never write iconSet.json at once"; 10: it publishes on its job before the answer. Andy, of a duplicate:
// "the icon app allowed me to add a duplicate icon.... that shouldn't work". Raw calls to a scratch node with Icons
// switched on, its verb as its api.js names it; what was written is read from the disc. Neither Andy's node nor an agent's
// is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };

// nodeIcons.js: the icon set, one table, written only here (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
const NO_WORLD = 'no scratch node, free glyphs or answer of icons.icon: the world failed';
test.after(function () {
  const node = W.node || {};
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});
const icon = async function (args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'icons.icon', args: args }) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
  return { status: r.status, body: b, text: t };
};
const items = function (r) { return ((r.body && r.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }); };

test.run('the world: a scratch node of its own with Icons switched on', 0.2, async function () {
  W.node = await scratchNode({ servers: ['icons'] });
  W.up = !!(W.node.up && W.node.root);
  return W.up || 'no scratch node of its own: nothing judged';
}, test.limit.slow);
test.run('the world: the system set, and twelve glyphs it does not hold', 0.2, function () {
  if (!W.up) return 'no scratch node of its own: the world failed';
  const run = path.join(W.node.root, 'spirit', 'run');
  W.SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
  W.SYSTEM = path.join(run, 'spirit', 'iconSet.json');
  W.system = json(W.SYSTEM) || {};
  W.systemText = read(W.SYSTEM);
  // Glyphs the system set does not hold, one code point each, from the pictograph blocks.
  const known = Object.keys(W.system).map(bare);
  const fresh = [];
  for (let cp = 0x1F300; cp <= 0x1FAFF && fresh.length < 20; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g) && known.indexOf(g) === -1) fresh.push(g); }
  W.fresh = fresh;
  W.sys = Object.keys(W.system)[0];
  W.glyphs = fresh.length >= 12 && !!W.sys;
  return W.glyphs || 'no system set or too few free glyphs: nothing judged';
}, test.limit.quick);
test.run('the world: icons.icon answers', 0.2, async function () {
  if (!W.glyphs) return 'no scratch node or free glyphs: the world failed';
  W.ready = !!(await until(function () { return icon({ op: 'search', text: '' }).then(function (r) { return r.status === 200; }); }, 20000));
  return W.ready || 'icons.icon never answered: nothing judged';
}, test.limit.quick);

// the box: "initialized from run://spirit/iconSet.json when it does not exist yet"; reads write nothing
test.run('with no own set, search answers the system set, its first glyph among it', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const all = W.all = await icon({ op: 'search', text: '' });
  const shown = items(all).map(function (r) { return r && r.glyph; });
  return all.status === 200 && shown.indexOf(W.sys) !== -1 ? true : 'search, wanting ' + W.sys + ': ' + short(all.text);
}, test.limit.quick);
test.run('each item\'s label is a row, { glyph, keywords }', 0.2, function () {
  if (!W.all) return NO_WORLD;
  const all = W.all;
  return items(all).every(function (r) { return r && typeof r.glyph === 'string' && Array.isArray(r.keywords); }) || 'items: ' + short(all.body && all.body.items && all.body.items.slice(0, 3));
}, test.limit.quick);
test.run('get answers a system icon with its keywords', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const sys = W.sys;
  const g1 = await icon({ op: 'get', glyph: sys });
  return g1.status === 200 && g1.body && g1.body.row && g1.body.row.glyph === sys && JSON.stringify(g1.body.row.keywords) === JSON.stringify(W.system[sys]) ? true : 'get ' + sys + ': ' + short(g1.text);
}, test.limit.quick);
test.run('get of an icon not there answers row null', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const g0 = await icon({ op: 'get', glyph: W.fresh[11] });
  return g0.status === 200 && g0.body && g0.body.row === null ? true : 'get of a stranger: ' + short(g0.text);
}, test.limit.quick);
test.run('search by a keyword of the first system glyph finds that glyph', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const kw = (W.system[W.sys] || [])[0];
  const byWord = await icon({ op: 'search', text: String(kw || '') });
  return !!kw && items(byWord).some(function (r) { return r && r.glyph === W.sys; }) ? true : 'search ' + kw + ', wanting ' + W.sys + ': ' + short(byWord.text);
}, test.limit.quick);
test.run('and none of these wrote spirit/state/icons/data/iconSet.json', 0.2, function () {
  if (!W.ready) return NO_WORLD;
  return !fs.existsSync(W.SET) || 'a read wrote the set: ' + short(read(W.SET));
}, test.limit.quick);

// add: the first write begins the own set from the system set, the new icon on top
test.run('add answers added', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const a1 = await icon({ op: 'add', glyph: W.fresh[0], keywords: ['first', 'one'] });
  W.s1 = json(W.SET) || {};
  return a1.status === 200 && a1.body && a1.body.added === true ? true : 'add: ' + short(a1.text);
}, test.limit.quick);
test.run('the set holds the new glyph with its keywords', 0.2, function () {
  if (!W.s1) return 'no add was made';
  return JSON.stringify(W.s1[W.fresh[0]]) === '["first","one"]' || 'the set, at ' + W.fresh[0] + ': ' + short(W.s1[W.fresh[0]]);
}, test.limit.quick);
test.run('on top', 0.2, function () {
  if (!W.s1) return 'no add was made';
  return Object.keys(W.s1)[0] === W.fresh[0] || 'the first icon of the set is ' + short(Object.keys(W.s1)[0]);
}, test.limit.quick);
test.run('every system icon is in it', 0.2, function () {
  if (!W.s1) return 'no add was made';
  const lost = Object.keys(W.system).filter(function (g) { return !(g in W.s1); });
  return !lost.length || lost.length + ' system icons are not: ' + short(lost.slice(0, 5));
}, test.limit.quick);
test.run('spirit/iconSet.json is not written', 0.2, function () {
  if (!W.ready) return NO_WORLD;
  return read(W.SYSTEM) === W.systemText || 'spirit/iconSet.json changed';
}, test.limit.quick);
test.run('and no half-written file is left beside it', 0.2, function () {
  if (!W.ready) return NO_WORLD;
  return !fs.existsSync(W.SET + '.tmp') || W.SET + '.tmp is left';
}, test.limit.quick);

// Andy: a duplicate "shouldn't work", under any spelling
test.run('a second add of the same glyph answers added false and names it', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  W.t1 = read(W.SET);
  const d1 = await icon({ op: 'add', glyph: W.fresh[0], keywords: ['again'] });
  return d1.status === 200 && d1.body && d1.body.added === false && d1.body.known === W.fresh[0] ? true : 'a duplicate of ' + W.fresh[0] + ': ' + short(d1.text);
}, test.limit.quick);
test.run('a system icon spelled with or without its invisible selector is the same icon', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const sys = W.sys;
  const withSel = sys.indexOf('️') === -1 ? sys + '️' : bare(sys);
  const d2 = await icon({ op: 'add', glyph: withSel, keywords: ['spelled'] });
  return d2.body && d2.body.added === false ? true : 'the other spelling of ' + sys + ': ' + short(d2.text);
}, test.limit.quick);
test.run('and the set is not written', 0.2, function () {
  if (!W.ready) return NO_WORLD;
  return read(W.SET) === W.t1 || 'a duplicate changed the set';
}, test.limit.quick);

// set and delete
test.run('set writes the new keywords', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const c1 = await icon({ op: 'set', glyph: W.fresh[0], keywords: ['changed'] });
  return c1.body && c1.body.changed === true && JSON.stringify((json(W.SET) || {})[W.fresh[0]]) === '["changed"]' ? true : 'set: ' + short(c1.text) + ' the set holds ' + short((json(W.SET) || {})[W.fresh[0]]);
}, test.limit.quick);
test.run('set of an icon not there changes nothing and adds nothing', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const t2 = read(W.SET);
  const c0 = await icon({ op: 'set', glyph: W.fresh[10], keywords: ['nobody'] });
  return c0.body && c0.body.changed === false && read(W.SET) === t2 ? true : 'set of a stranger: ' + short(c0.text);
}, test.limit.quick);
test.run('delete takes it out of the set', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const x1 = await icon({ op: 'delete', glyph: W.fresh[0] });
  return x1.body && x1.body.deleted === true && !(W.fresh[0] in (json(W.SET) || {})) ? true : 'delete: ' + short(x1.text);
}, test.limit.quick);
test.run('delete of an icon not there changes nothing', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const t3 = read(W.SET);
  const x0 = await icon({ op: 'delete', glyph: W.fresh[10] });
  return x0.body && x0.body.deleted === false && read(W.SET) === t3 ? true : 'delete of a stranger: ' + short(x0.text);
}, test.limit.quick);
test.run('a system icon is deleted from the own set; the system set keeps it', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const xs = await icon({ op: 'delete', glyph: W.sys });
  return xs.body && xs.body.deleted === true && !(W.sys in (json(W.SET) || {})) && read(W.SYSTEM) === W.systemText ? true : 'delete ' + W.sys + ': ' + short(xs.text);
}, test.limit.quick);

// the box, 9: "two saves never write iconSet.json at once": eight adds at once
test.run('each of the eight answers added', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const eight = W.eight = W.fresh.slice(1, 9);
  const answers = await Promise.all(eight.map(function (g, i) { return icon({ op: 'add', glyph: g, keywords: ['at', 'once' + i] }); }));
  W.s8 = json(W.SET);
  return answers.every(function (r) { return r.body && r.body.added === true; }) || 'answers: ' + short(answers.map(function (r) { return r.body && r.body.added; }));
}, test.limit.slow);
test.run('all eight are in the set, none lost to another\'s write', 0.2, function () {
  if (!W.eight) return 'the eight adds were not made';
  const s8 = W.s8;
  return !!s8 && W.eight.every(function (g) { return g in s8; }) ? true : 'in the set: ' + short(W.eight.filter(function (g) { return s8 && g in s8; }));
}, test.limit.quick);
test.run('and the rest of the set stands, the file whole JSON', 0.2, function () {
  if (!W.eight) return 'the eight adds were not made';
  const s8 = W.s8;
  return !!s8 && Object.keys(W.system).filter(function (g) { return g !== W.sys; }).every(function (g) { return g in s8; }) ? true : 'after eight at once the set is ' + short(read(W.SET));
}, test.limit.quick);

// the box, 10: the change is published on the job spirit.app.icons before the answer
test.run('the world: the job spirit.app.icons is there', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const job = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'job.get', args: { key: 'spirit.app.icons' } }) }).then(function (r) { return r.json(); }, function () { return null; });
  W.j = (job && job.job) || null;
  return !!W.j && W.j.module === 'spirit.app.icons' ? true : 'job.get: ' + short(job);
}, test.limit.quick);
test.run('the job holds a row a run published, the moment the add has answered', 0.2, function () {
  if (!W.eight) return 'the eight adds were not made';
  const j = W.j, eight = W.eight;
  const last = JSON.stringify(j && (j.app || j.data || {}));
  return !!j && last.indexOf(eight[eight.length - 1]) !== -1 || !!j && eight.some(function (g) { return last.indexOf(g) !== -1; }) ? true : 'the job holds no published row: ' + short(j && { app: j.app, data: j.data });
}, test.limit.quick);

// the attacker: crooked calls write nothing
// Each crooked call written out, so that each check has a plain title of its own.
const refusedCall = async function (a) {
  if (!W.ready) return NO_WORLD;
  if (W.t4 === undefined) W.t4 = read(W.SET);
  const r = await icon(a);
  return r.status >= 400 && r.status < 500 ? true : short(a) + ' answered ' + r.status + ' ' + short(r.text);
};
const F = function (i) { return (W.fresh || [])[i]; };
test.run('refused: no op', 0.2, function () { return refusedCall({}); }, test.limit.quick);
test.run('refused: an op it does not know, drop', 0.2, function () { return refusedCall({ op: 'drop', glyph: F(12) || 'x' }); }, test.limit.quick);
test.run('refused: an add with no glyph', 0.2, function () { return refusedCall({ op: 'add' }); }, test.limit.quick);
test.run('refused: an add with an empty glyph', 0.2, function () { return refusedCall({ op: 'add', glyph: '' }); }, test.limit.quick);
test.run('refused: an add with a glyph of spaces', 0.2, function () { return refusedCall({ op: 'add', glyph: '   ' }); }, test.limit.quick);
test.run('refused: an add with a glyph that is a number', 0.2, function () { return refusedCall({ op: 'add', glyph: 5 }); }, test.limit.quick);
test.run('refused: an add with keywords that are no list', 0.2, function () { return refusedCall({ op: 'add', glyph: F(11), keywords: 'not a list' }); }, test.limit.quick);
test.run('refused: an add with keywords that are numbers', 0.2, function () { return refusedCall({ op: 'add', glyph: F(11), keywords: [1, 2] }); }, test.limit.quick);
test.run('refused: an add with an argument it does not name', 0.2, function () { return refusedCall({ op: 'add', glyph: F(11), extra: true }); }, test.limit.quick);
test.run('refused: a delete with no glyph', 0.2, function () { return refusedCall({ op: 'delete' }); }, test.limit.quick);
test.run('refused: a set with no glyph', 0.2, function () { return refusedCall({ op: 'set', keywords: ['x'] }); }, test.limit.quick);
test.run('and the set is as it was', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  await sleep(300);
  return read(W.SET) === W.t4 || 'a crooked call changed the set';
}, test.limit.quick);

// "no list, a search": a set past one answer is cut, with more past it
test.run('a search of 4000 icons answers some, and more', 0.2, async function () {
  if (!W.ready) return NO_WORLD;
  const big = {};
  for (let i = 0; i < 4000; i++) big[String.fromCodePoint(0x10000 + i)] = ['many' + i, 'words' + i];
  fs.writeFileSync(W.SET, JSON.stringify(big));
  const cut = W.cut = await icon({ op: 'search', text: '' });
  return cut.status === 200 && cut.body && cut.body.more === true && items(cut).length > 0 && items(cut).length < 4000 ? true : 'search of 4000: ' + cut.status + ' ' + short({ more: cut.body && cut.body.more, n: items(cut).length });
}, test.limit.quick);
test.run('it fits in one answer', 0.2, function () {
  if (!W.cut) return 'no search of 4000 was made';
  return Buffer.byteLength(W.cut.text) <= limits.ANSWER_MAX || 'the answer is ' + Buffer.byteLength(W.cut.text) + ' bytes, past ' + limits.ANSWER_MAX;
}, test.limit.quick);
