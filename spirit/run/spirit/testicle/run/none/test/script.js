'use strict';
const SPIRIT = require('../../../../script.js');

// spirit/run/spirit/testicle/run/none/test/script.js
// THE RUNNER OF THE RESOURCE none, ON MODULES PLANTED FOR IT (goal/G49.27, step 3; spec: ./script.md). The box: "the runner of
// a resource requires every module naming it, asks each appliesTo, and runs its checks"; no central list. Tiny rule modules
// are planted in a tree of their own under spirit/testicle/general/: one of each resource, one that does not load, and one in
// a test folder; the runner's found() walks that tree and its runModules() runs them on a reporter kept here, whose tests are
// run here and not reported.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const NONE = SPIRIT.requireScript('spirit/testicle/run/none/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/run/none/test/script';
const PLANT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

// A planted module: its resource, own, the script it does not apply to, and what it says: one test a call, its title the
// module's name, its body true; each call kept on global.zzCalls with the path it was handed and the node holder it got.
function rule(name, resource, own, applies) {
  return "'use strict';\n" +
    "function appliesTo(p) { return " + (applies || "p !== 'spirit/zzSkip.js'") + "; }\n" +
    "function checks(p, tools) { (global.zzCalls = global.zzCalls || []).push({ name: '" + name + "', path: p, node: tools.node, forbids: tools.forbids });\n" +
    "  tools.test.run('" + name + " said', 0.2, function () { return true; }, tools.test.limit.quick); }\n" +
    "module.exports = { appliesTo: appliesTo, resource: '" + resource + "', own: " + own + ", forbids: ['zz" + name + "'], checks: checks };\n";
}
const G = 'spirit/testicle/general/zz/';
plant(G + 'zzNone/script.js', rule('zzNone', 'none', false));
plant(G + 'zzShared/script.js', rule('zzShared', 'node', false));
plant(G + 'zzOwn/script.js', rule('zzOwn', 'node', true));
plant(G + 'zzPage/script.js', rule('zzPage', 'browser', false));
// A module judging only a file handed, never the whole tree (as the page rules).
plant(G + 'zzFileOnly/script.js', rule('zzFileOnly', 'none', false, '!!p'));
plant(G + 'zzBroken/script.js', "'use strict';\nthrow new Error('zzBroken does not load');\n");
// In a test folder: a module's test, no module.
plant(G + 'zzNone/test/script.js', rule('zzInTest', 'none', false));
const LOAD = function (rel) { return require(path.join(PLANT, rel)); };

// A reporter kept here: every test said, with its module, and the script it was said for.
function keeper() {
  const kept = [];
  let forScript = '';
  const T = {
    limit: test.limit,
    run: function (title, severity, body, limit, opts) { kept.push({ title: title, body: body, script: forScript, module: (opts && opts.module) || '' }); },
    forScript: function (s, fn) { const was = forScript; forScript = s; try { fn(); } finally { forScript = was; } },
    after: function () {}, hold: function () {}, release: function () {},
  };
  return { T: T, kept: kept };
}
const W = {};
async function ran(resource, given) {
  global.zzCalls = [];
  const K = keeper();
  const list = NONE.found(PLANT, LOAD);
  await NONE.runModules(resource, list, given, { test: K.T, run: PLANT, spirit: SPIRIT, node: { node: 'shared' }, forbids: NONE.forbidsOf(list) });
  return { kept: K.kept, calls: global.zzCalls };
}

test.run('it finds every planted rule module by walking spirit/testicle/general/, none in a test folder', 0.4, function () {
  W.list = NONE.found(PLANT, LOAD);
  const dirs = W.list.map(function (r) { return r.dir; });
  return dirs.join() === [G + 'zzBroken', G + 'zzFileOnly', G + 'zzNone', G + 'zzOwn', G + 'zzPage', G + 'zzShared'].join() || false;
}, test.limit.quick);
test.run('a module that does not load is found with no module, the others with theirs', 0.4, function () {
  if (!W.list) return false;
  return W.list.every(function (r) { return (r.dir === G + 'zzBroken') === (r.module === null); }) || false;
}, test.limit.quick);
test.run('handed nothing, it runs every module of its resource and no other, each judging all', 0.4, async function () {
  const r = await ran('none', []);
  const none = r.calls.filter(function (c) { return c.name === 'zzNone'; });
  return (none.length === 1 && none[0].path === '' && r.calls.every(function (c) { return c.name === 'zzNone' || c.name === 'zzFileOnly'; })) || false;
}, test.limit.quick);
test.run('a module that does not load is red, as a part that throws', 0.4, async function () {
  const r = await ran('none', []);
  const red = r.kept.filter(function (k) { return k.title === 'a general part of it makes its tests without throwing'; });
  return (red.length === 1 && (await red[0].body()) === false) || false;
}, test.limit.quick);
test.run('handed scripts, a module judges each it applies to, reported for that script, and none it does not apply to', 0.4, async function () {
  const r = await ran('none', ['spirit/zzOne.js', 'spirit/zzSkip.js']);
  const said = r.kept.filter(function (k) { return k.title === 'zzNone said'; });
  const none = r.calls.filter(function (c) { return c.name === 'zzNone'; });
  return (none.length === 1 && none[0].path === 'spirit/zzOne.js' && said.length === 1 && said[0].script === 'spirit/zzOne.js') || false;
}, test.limit.quick);
test.run('a module that judges only a file handed is asked, and runs on a script handed but not on the whole tree', 0.4, async function () {
  const whole = await ran('none', []);
  const one = await ran('none', ['spirit/zzOne.js']);
  const named = function (r) { return r.calls.filter(function (c) { return c.name === 'zzFileOnly'; }); };
  return (named(whole).length === 0 && named(one).length === 1 && named(one)[0].path === 'spirit/zzOne.js') || false;
}, test.limit.quick);
test.run('each test a module says names its module', 0.4, async function () {
  const r = await ran('none', []);
  const said = r.kept.filter(function (k) { return k.title === 'zzNone said'; });
  return (said.length === 1 && said[0].module === G + 'zzNone') || false;
}, test.limit.quick);
test.run('a module with own true gets a node holder of its own, a module sharing gets the run\'s', 0.4, async function () {
  const r = await ran('node', []);
  const shared = r.calls.filter(function (c) { return c.name === 'zzShared'; })[0];
  const own = r.calls.filter(function (c) { return c.name === 'zzOwn'; })[0];
  return (!!shared && !!own && shared.node.node === 'shared' && own.node.node === null && own.node.own === true) || false;
}, test.limit.quick);
test.run('every module is handed the forbids of every module found, by its folder', 0.4, async function () {
  const r = await ran('none', []);
  const f = r.calls[0] && r.calls[0].forbids;
  if (f && !(G + 'zzFileOnly' in f)) return false;
  return (!!f && f[G + 'zzPage'] && f[G + 'zzPage'][0] === 'zzzzPage' && f[G + 'zzNone'][0] === 'zzzzNone' && !(G + 'zzBroken' in f)) || false;
}, test.limit.quick);
test.run('a setup step that does not come up within its limit is not up', 0.4, async function () {
  const late = await NONE.timed(function () { return new Promise(function () {}); }, 200);
  const refused = await NONE.timed(function () { return Promise.reject(new Error('no')); }, 200);
  const up = await NONE.timed(function () { return Promise.resolve(true); }, 200);
  return (late === false && refused === false && up === true) || false;
}, test.limit.quick);
test.run('a module is needed only when one of its resource applies to a script handed', 0.4, function () {
  if (!W.list) return false;
  return (NONE.needed('node', W.list, [], false) && NONE.needed('node', W.list, ['spirit/zzOne.js'], true) &&
    !NONE.needed('node', W.list, ['spirit/zzSkip.js'], false) && !NONE.needed('relay', W.list, [])) || false;
}, test.limit.quick);
