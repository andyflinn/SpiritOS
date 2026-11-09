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
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function json(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
const bare = function (g) { return String(g || '').replace(/[︎️]/g, ''); };

test.startTest('nodeIcons.js: the icon set, one table, written only here (goal/G43.19)');

(async function () {
  const node = await scratchNode({ servers: ['icons'] });
  try {
    if (!node.up || !node.root) { test.fail('no scratch node of its own: nothing judged'); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const SET = path.join(run, 'spirit', 'state', 'icons', 'data', 'iconSet.json');
    const SYSTEM = path.join(run, 'spirit', 'iconSet.json');
    const system = json(SYSTEM) || {};
    const systemText = read(SYSTEM);
    const icon = async function (args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'icons.icon', args: args }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    const items = function (r) { return ((r.body && r.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }); };
    // Glyphs the system set does not hold, one code point each, from the pictograph blocks.
    const known = Object.keys(system).map(bare);
    const fresh = [];
    for (let cp = 0x1F300; cp <= 0x1FAFF && fresh.length < 20; cp++) { const g = String.fromCodePoint(cp); if (/\p{Extended_Pictographic}/u.test(g) && known.indexOf(g) === -1) fresh.push(g); }
    const sys = Object.keys(system)[0];
    ok(fresh.length >= 12 && !!sys, 'the world: the system set, and glyphs it does not hold: ' + fresh.slice(0, 12).join(' '), 'no system set or too few free glyphs: nothing judged');
    if (fresh.length < 12 || !sys) return;
    const up = await until(function () { return icon({ op: 'search', text: '' }).then(function (r) { return r.status === 200; }); }, 20000);
    ok(up, 'the world: icons.icon answers', 'icons.icon never answered: nothing judged');
    if (!up) return;

    test.subHeading('the box: "initialized from run://spirit/iconSet.json when it does not exist yet"; reads write nothing');
    const all = await icon({ op: 'search', text: '' });
    const shown = items(all).map(function (r) { return r && r.glyph; });
    ok(all.status === 200 && shown.indexOf(sys) !== -1, 'with no own set, search answers the system set, ' + sys + ' among it', 'search: ' + short(all.text));
    ok(items(all).every(function (r) { return r && typeof r.glyph === 'string' && Array.isArray(r.keywords); }), 'each item\'s label is a row, { glyph, keywords }', 'items: ' + short(all.body && all.body.items && all.body.items.slice(0, 3)));
    const g1 = await icon({ op: 'get', glyph: sys });
    ok(g1.status === 200 && g1.body && g1.body.row && g1.body.row.glyph === sys && JSON.stringify(g1.body.row.keywords) === JSON.stringify(system[sys]), 'get answers a system icon with its keywords', 'get ' + sys + ': ' + short(g1.text));
    const g0 = await icon({ op: 'get', glyph: fresh[11] });
    ok(g0.status === 200 && g0.body && g0.body.row === null, 'get of an icon not there answers row null', 'get of a stranger: ' + short(g0.text));
    const kw = (system[sys] || [])[0];
    const byWord = await icon({ op: 'search', text: String(kw || '') });
    ok(!!kw && items(byWord).some(function (r) { return r && r.glyph === sys; }), 'search by a keyword, ' + kw + ', finds ' + sys, 'search ' + kw + ': ' + short(byWord.text));
    ok(!fs.existsSync(SET), 'and none of these wrote spirit/state/icons/data/iconSet.json', 'a read wrote the set: ' + short(read(SET)));

    test.subHeading('add: the first write begins the own set from the system set, the new icon on top');
    const a1 = await icon({ op: 'add', glyph: fresh[0], keywords: ['first', 'one'] });
    const s1 = json(SET) || {};
    ok(a1.status === 200 && a1.body && a1.body.added === true, 'add answers added', 'add: ' + short(a1.text));
    ok(JSON.stringify(s1[fresh[0]]) === '["first","one"]', 'the set holds ' + fresh[0] + ' with its keywords', 'the set: ' + short(s1[fresh[0]]));
    ok(Object.keys(s1)[0] === fresh[0], 'on top', 'the first icon of the set is ' + short(Object.keys(s1)[0]));
    const lost = Object.keys(system).filter(function (g) { return !(g in s1); });
    ok(!lost.length, 'every system icon is in it', lost.length + ' system icons are not: ' + short(lost.slice(0, 5)));
    ok(read(SYSTEM) === systemText, 'spirit/iconSet.json is not written', 'spirit/iconSet.json changed');
    ok(!fs.existsSync(SET + '.tmp'), 'and no half-written file is left beside it', SET + '.tmp is left');

    test.subHeading('Andy: a duplicate "shouldn\'t work", under any spelling');
    const t1 = read(SET);
    const d1 = await icon({ op: 'add', glyph: fresh[0], keywords: ['again'] });
    ok(d1.status === 200 && d1.body && d1.body.added === false && d1.body.known === fresh[0], 'a second add of ' + fresh[0] + ' answers added false and names it', 'a duplicate: ' + short(d1.text));
    const withSel = sys.indexOf('️') === -1 ? sys + '️' : bare(sys);
    const d2 = await icon({ op: 'add', glyph: withSel, keywords: ['spelled'] });
    ok(d2.body && d2.body.added === false, 'a system icon spelled with or without its invisible selector is the same icon', 'the other spelling of ' + sys + ': ' + short(d2.text));
    ok(read(SET) === t1, 'and the set is not written', 'a duplicate changed the set');

    test.subHeading('set and delete');
    const c1 = await icon({ op: 'set', glyph: fresh[0], keywords: ['changed'] });
    ok(c1.body && c1.body.changed === true && JSON.stringify((json(SET) || {})[fresh[0]]) === '["changed"]', 'set writes the new keywords', 'set: ' + short(c1.text) + ' the set holds ' + short((json(SET) || {})[fresh[0]]));
    const t2 = read(SET);
    const c0 = await icon({ op: 'set', glyph: fresh[10], keywords: ['nobody'] });
    ok(c0.body && c0.body.changed === false && read(SET) === t2, 'set of an icon not there changes nothing and adds nothing', 'set of a stranger: ' + short(c0.text));
    const x1 = await icon({ op: 'delete', glyph: fresh[0] });
    ok(x1.body && x1.body.deleted === true && !(fresh[0] in (json(SET) || {})), 'delete takes it out of the set', 'delete: ' + short(x1.text));
    const t3 = read(SET);
    const x0 = await icon({ op: 'delete', glyph: fresh[10] });
    ok(x0.body && x0.body.deleted === false && read(SET) === t3, 'delete of an icon not there changes nothing', 'delete of a stranger: ' + short(x0.text));
    const xs = await icon({ op: 'delete', glyph: sys });
    ok(xs.body && xs.body.deleted === true && !(sys in (json(SET) || {})) && read(SYSTEM) === systemText, 'a system icon is deleted from the own set; the system set keeps it', 'delete ' + sys + ': ' + short(xs.text));

    test.subHeading('the box, 9: "two saves never write iconSet.json at once": eight adds at once');
    const eight = fresh.slice(1, 9);
    const answers = await Promise.all(eight.map(function (g, i) { return icon({ op: 'add', glyph: g, keywords: ['at', 'once' + i] }); }));
    const s8 = json(SET);
    ok(answers.every(function (r) { return r.body && r.body.added === true; }), 'each of the eight answers added', 'answers: ' + short(answers.map(function (r) { return r.body && r.body.added; })));
    ok(!!s8 && eight.every(function (g) { return g in s8; }), 'all eight are in the set, none lost to another\'s write', 'in the set: ' + short(eight.filter(function (g) { return s8 && g in s8; })));
    ok(!!s8 && Object.keys(system).filter(function (g) { return g !== sys; }).every(function (g) { return g in s8; }), 'and the rest of the set stands, the file whole JSON', 'after eight at once the set is ' + short(read(SET)));

    test.subHeading('the box, 10: the change is published on the job spirit.app.icons before the answer');
    const job = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'jobs.get', args: { key: 'spirit.app.icons' } }) }).then(function (r) { return r.json(); }, function () { return null; });
    const j = (job && job.job) || null;
    ok(!!j && j.module === 'spirit.app.icons', 'the world: the job spirit.app.icons is there', 'jobs.get: ' + short(job));
    const last = JSON.stringify(j && (j.app || j.data || {}));
    ok(!!j && last.indexOf(eight[eight.length - 1]) !== -1 || !!j && eight.some(function (g) { return last.indexOf(g) !== -1; }), 'the job holds a row a run published, the moment the add has answered', 'the job holds no published row: ' + short(j && { app: j.app, data: j.data }));

    test.subHeading('the attacker: crooked calls write nothing');
    const t4 = read(SET);
    const crooked = [{}, { op: 'drop', glyph: fresh[12] || 'x' }, { op: 'add' }, { op: 'add', glyph: '' }, { op: 'add', glyph: '   ' }, { op: 'add', glyph: 5 }, { op: 'add', glyph: fresh[11], keywords: 'not a list' },
      { op: 'add', glyph: fresh[11], keywords: [1, 2] }, { op: 'add', glyph: fresh[11], extra: true }, { op: 'delete' }, { op: 'set', keywords: ['x'] }];
    for (const a of crooked) {
      const r = await icon(a);
      ok(r.status >= 400 && r.status < 500, 'refused: ' + short(a), short(a) + ' answered ' + r.status + ' ' + short(r.text));
    }
    await sleep(300);
    ok(read(SET) === t4, 'and the set is as it was', 'a crooked call changed the set');

    test.subHeading('"no list, a search": a set past one answer is cut, with more past it');
    const big = {};
    for (let i = 0; i < 4000; i++) big[String.fromCodePoint(0x10000 + i)] = ['many' + i, 'words' + i];
    fs.writeFileSync(SET, JSON.stringify(big));
    const cut = await icon({ op: 'search', text: '' });
    ok(cut.status === 200 && cut.body && cut.body.more === true && items(cut).length > 0 && items(cut).length < 4000, 'a search of 4000 icons answers some, and more', 'search of 4000: ' + cut.status + ' ' + short({ more: cut.body && cut.body.more, n: items(cut).length }));
    ok(Buffer.byteLength(cut.text) <= limits.ANSWER_MAX, 'within one answer (' + limits.ANSWER_MAX + ' bytes)', 'the answer is ' + Buffer.byteLength(cut.text) + ' bytes');
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
