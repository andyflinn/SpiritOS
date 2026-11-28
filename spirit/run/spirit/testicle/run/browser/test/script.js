'use strict';
const SPIRIT = require('../../../../script.js');

// spirit/run/spirit/testicle/run/browser/test/script.js
// THE RUNNER OF THE RESOURCE browser, ON MODULES PLANTED FOR IT (goal/G49.27, step 3; spec: ./script.md). The box: "all
// browser modules run in one runner: one Chrome, one scratch node, a fresh page and a fresh spirit object per module, never a
// Chrome per file"; "setup is its own timed step with its own limit: a node or Chrome that does not come up is red as that, by
// name". Two tiny browser modules are planted in a tree of their own, one drawing a page a while for each script, and a module
// of no browser; the runner's main() runs them, its node and Chrome stand-ins, on a reporter kept here, whose tests are run here
// and not reported. No node and no Chrome are started.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const NONE = SPIRIT.requireScript('spirit/testicle/run/none/script.js');
const BROWSER = SPIRIT.requireScript('spirit/testicle/run/browser/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/run/browser/test/script';
const PLANT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }
// A planted browser module: each call kept on global.zzPageCalls, when it started and ended, with what it was handed; its page
// takes 50 ms.
function rule(name, resource) {
  return "'use strict';\n" +
    "function checks(p, tools) { const c = { name: '" + name + "', path: p, runner: tools.runner, batch: tools.batch, start: Date.now(), end: 0 };\n" +
    "  (global.zzPageCalls = global.zzPageCalls || []).push(c);\n" +
    "  return new Promise(function (r) { setTimeout(function () { c.end = Date.now(); r(); }, 50); }); }\n" +
    "module.exports = { appliesTo: function () { return true; }, resource: '" + resource + "', own: false, forbids: [], checks: checks };\n";
}
const G = 'spirit/testicle/general/zz/';
plant(G + 'zzPage/script.js', rule('zzPage', 'browser'));
plant(G + 'zzMount/script.js', rule('zzMount', 'browser'));
plant(G + 'zzNone/script.js', rule('zzNone', 'none'));
const LIST = NONE.found(PLANT, function (rel) { return require(path.join(PLANT, rel)); });

function keeper() {
  const kept = [];
  const T = {
    limit: test.limit,
    run: function (title, severity, body) { kept.push({ title: title, body: body }); },
    forScript: function (s, fn) { fn(); }, after: function () {}, hold: function () {}, release: function () {},
  };
  return { T: T, kept: kept };
}
// One run of the runner on the scripts given, its node never up and its Chrome a stand-in found or not, with the run's own
// handed node and Chrome named nowhere while it runs (testicle may hand this suite its own).
async function ran(given, chromeFound) {
  global.zzPageCalls = [];
  const K = keeper();
  const was = { base: process.env.SPIRIT_MOUNT_BASE, run: process.env.SPIRIT_MOUNT_RUN, port: process.env.SPIRIT_CHROME_PORT };
  delete process.env.SPIRIT_MOUNT_BASE; delete process.env.SPIRIT_MOUNT_RUN; delete process.env.SPIRIT_CHROME_PORT;
  try {
    await BROWSER.main(given, { list: LIST, test: K.T, scratch: function () { return Promise.resolve({ up: false }); },
      find: function () { return chromeFound ? 'chrome' : null; }, share: function () { return Promise.resolve({ port: 1, close: function () {} }); } });
  } finally {
    ['SPIRIT_MOUNT_BASE', 'SPIRIT_MOUNT_RUN', 'SPIRIT_CHROME_PORT'].forEach(function (k) { delete process.env[k]; });
    if (was.base !== undefined) process.env.SPIRIT_MOUNT_BASE = was.base;
    if (was.run !== undefined) process.env.SPIRIT_MOUNT_RUN = was.run;
    if (was.port !== undefined) process.env.SPIRIT_CHROME_PORT = was.port;
  }
  return { kept: K.kept, calls: global.zzPageCalls };
}
async function verdict(r, title) { const k = r.kept.filter(function (x) { return x.title === title; }); return k.length === 1 ? (await k[0].body()) === true : null; }

test.run('its node not coming up, its setup step is red by its name', 0.4, async function () {
  return (await verdict(await ran([], true), 'the shared scratch node comes up')) === false;
}, test.limit.quick);
test.run('no Chrome found, its setup step is red by its name; one found, green', 0.4, async function () {
  const none = await verdict(await ran([], false), 'the shared Chrome comes up');
  const one = await verdict(await ran([], true), 'the shared Chrome comes up');
  return (none === false && one === true) || false;
}, test.limit.quick);
test.run('it runs every browser module and no module of another resource, each handed this runner', 0.4, async function () {
  const r = await ran([], true);
  const names = r.calls.map(function (c) { return c.name; }).sort();
  const runner = path.join(NONE.RUN, 'spirit', 'testicle', 'run', 'browser', 'script.js');
  return (names.join() === 'zzMount,zzPage' && r.calls.every(function (c) { return c.runner === runner; })) || false;
}, test.limit.quick);
test.run('handed several scripts, each module draws them one after the other, and in a batch', 0.4, async function () {
  const r = await ran(['spirit/zzA.js', 'spirit/zzB.js'], true);
  const c = r.calls;
  const apart = c.length === 4 && c.every(function (x, i) { return i === 0 || x.start >= c[i - 1].end; });
  return (apart && c[0].name === c[1].name && c[0].path === 'spirit/zzA.js' && c[1].path === 'spirit/zzB.js' && c.every(function (x) { return x.batch === true; })) || false;
}, test.limit.quick);
test.run('the servers of a script of an app whose manifest mounts one are turned on with the agent\'s', 0.4, function () {
  const s = BROWSER.serversFor(['spirit/app/desk/desk.js', 'spirit/fs/script.js']);
  return (s[0] === 'spirit.app.agent' && s.indexOf('spirit.app.desk') !== -1 && s.length === 2) || false;
}, test.limit.quick);
