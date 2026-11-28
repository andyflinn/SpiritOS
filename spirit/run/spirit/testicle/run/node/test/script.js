'use strict';
const SPIRIT = require('../../../../script.js');

// spirit/run/spirit/testicle/run/node/test/script.js
// THE RUNNER OF THE RESOURCE node, ON MODULES PLANTED FOR IT (goal/G49.27, step 3; spec: ./script.md). The box: "a module that
// changes its node (grants, files, contacts) says so (own: true), and gets a node of its own; every other module shares one";
// "setup is its own timed step with its own limit: a node or Chrome that does not come up is red as that, by name". Two tiny
// node modules are planted in a tree of their own, one sharing the node and one with own: true, and a module of no node;
// the runner's main() runs them, its node started by a stand-in (up or not), on a reporter kept here, whose tests are run
// here and not reported. No node is started.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const NONE = SPIRIT.requireScript('spirit/testicle/run/none/script.js');
const NODE = SPIRIT.requireScript('spirit/testicle/run/node/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/run/node/test/script';
const PLANT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }
// A planted module of a resource: each call kept on global.zzNodeCalls with the path it was handed and the node holder it got.
function rule(name, resource, own) {
  return "'use strict';\n" +
    "function checks(p, tools) { (global.zzNodeCalls = global.zzNodeCalls || []).push({ name: '" + name + "', path: p, node: tools.node });\n" +
    "  tools.test.run('" + name + " said', 0.2, function () { return true; }, tools.test.limit.quick); }\n" +
    "module.exports = { appliesTo: function () { return true; }, resource: '" + resource + "', own: " + own + ", forbids: [], checks: checks };\n";
}
const G = 'spirit/testicle/general/zz/';
plant(G + 'zzShared/script.js', rule('zzShared', 'node', false));
plant(G + 'zzOwn/script.js', rule('zzOwn', 'node', true));
plant(G + 'zzNone/script.js', rule('zzNone', 'none', false));
const LIST = NONE.found(PLANT, function (rel) { return require(path.join(PLANT, rel)); });

// A reporter kept here: every test said, and every cleanup.
function keeper() {
  const kept = [];
  const afters = [];
  const T = {
    limit: test.limit,
    run: function (title, severity, body) { kept.push({ title: title, body: body }); },
    forScript: function (s, fn) { fn(); }, after: function (fn) { afters.push(fn); }, hold: function () {}, release: function () {},
  };
  return { T: T, kept: kept, afters: afters };
}
// One run of the runner, its node a stand-in: up or not; what it said, what each module got, and whether its node was let go.
async function ran(up) {
  global.zzNodeCalls = [];
  const K = keeper();
  const node = { up: up, released: false, release: function () { node.released = true; return Promise.resolve(); } };
  await NODE.main([], { list: LIST, test: K.T, scratch: function () { return Promise.resolve(node); } });
  for (const fn of K.afters) await fn();
  return { kept: K.kept, calls: global.zzNodeCalls, node: node };
}
async function verdict(r, title) { const k = r.kept.filter(function (x) { return x.title === title; }); return k.length === 1 ? (await k[0].body()) === true : null; }

test.run('its node set up and up, its setup step is green by its name', 0.4, async function () {
  return (await verdict(await ran(true), 'the shared scratch node comes up')) === true;
}, test.limit.quick);
test.run('its node not coming up, its setup step is red by its name, and the modules still run', 0.4, async function () {
  const r = await ran(false);
  return ((await verdict(r, 'the shared scratch node comes up')) === false && r.calls.length === 2) || false;
}, test.limit.quick);
test.run('it runs the node modules and no module of another resource', 0.4, async function () {
  const r = await ran(true);
  const names = r.calls.map(function (c) { return c.name; }).sort();
  return names.join() === 'zzOwn,zzShared' || false;
}, test.limit.quick);
test.run('the module sharing the node gets the run\'s node, the one with own true a holder of its own, empty', 0.4, async function () {
  const r = await ran(true);
  const shared = r.calls.filter(function (c) { return c.name === 'zzShared'; })[0];
  const own = r.calls.filter(function (c) { return c.name === 'zzOwn'; })[0];
  return (!!shared && !!own && shared.node.node === r.node && own.node.node === null && own.node.own === true) || false;
}, test.limit.quick);
test.run('its node is let go once the run ends', 0.4, async function () {
  return (await ran(true)).node.released === true;
}, test.limit.quick);
