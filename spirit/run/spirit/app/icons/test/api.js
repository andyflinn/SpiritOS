'use strict';

// spirit/run/spirit/app/icons/test/api.js
// The tests of spirit/app/icons/api.js, and of no other module (spec: ./api.md; goal/G43.19, box v16). The box, 7: "api.js is
// the branch's interface, the verbs and arguments the node checks a call against and a page binds by, not the code that
// handles a call (Andy: "appClient does NOT route to api.js, that file has a different purpose")"; Q5: "api.js at the app's
// top with no api/ folder"; 5: "the api branch is icons, and icons.<verb> can be granted to a peer like any branch". A
// scratch node with Icons switched on, raw calls and a real Chrome on its face page; whether a call started a run is read
// from the job spirit.app.icons, which names the pid of its last run. Who checks a call is goal/G43.32's decided 9: the
// app's run, spirit/server/app.js in front of icons.js, not the node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// api.js: the icons branch's interface, which the node checks a call against and a page binds by (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
test.after(function () {
  const chrome = W.chrome || {}, node = W.node || {};
  try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});
const call = async function (name, args) {
  const r = await fetch(W.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args }) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
  return { status: r.status, body: b, text: t };
};
const lastRun = async function () { const j = await call('job.get', { key: 'spirit.app.icons' }); return j.body && j.body.job && j.body.job.data ? String(j.body.job.data.pid || '') : ''; };

test.run('the icons api.js names its verbs', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  let api = null;
  try { api = require(FILE); } catch (e) { api = null; }
  W.api = api;
  W.verbs = Object.keys((api && api.verbs) || {});
  W.v = W.verbs[0];
  return W.verbs.length >= 1 || false;
}, test.limit.quick);
// Its one verb, icon, written out so that its check has a plain title.
// A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
test.run('each argument of the icon verb carries a rule', 0.2, function () {
  if (!W.verbs || !W.verbs.length) return false;
  const rules = W.api.verbs.icon || {};
  const bad = Object.keys(rules).filter(function (a) { return typeof rules[a] !== 'string' || !(/^[a-z]+\??$/i.test(rules[a]) || /^spirit\.type(\.[A-Za-z]+)+\??$/.test(rules[a])); });
  return !bad.length || false;
}, test.limit.quick);
// goal/G47.1, Andy: "every api.js requires it's companion data.js, and is the only script to require that data.js": the one
// path it asks for, in node and on a page, is spirit/app/icons/data.js (spirit.js itself, its door in node, aside).
test.run('the icons api.js handles nothing: it requires only its companion data.js', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const code = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const asked = (code.match(/require\s*\(\s*['"][^'"]+['"]\s*\)/g) || []).map(function (r) { return /['"]([^'"]+)['"]/.exec(r)[1]; })
    .filter(function (p) { return !/(^|\/)spirit\.js$/.test(p); });
  return asked.length > 0 && asked.every(function (p) { return p === 'spirit/app/icons/data.js'; }) || false;
}, test.limit.quick);

test.run('a scratch node comes up with Icons switched on, and a Chrome page opens', 0.2, async function () {
  if (!W.verbs || !W.verbs.length) return false;
  W.node = await scratchNode({ servers: ['icons'] });
  W.chrome = await chromePage(findChrome());
  W.up = !!(W.node.up && W.node.root && !W.chrome.error);
  return W.up || false;
}, test.limit.slow);

// the node finds it at the app's top: api {family: icons} answers this file
test.run('the api verb asked for the icons branch answers spirit/app/icons/api.js, word for word', 0.2, async function () {
  if (!W.up) return false;
  const fam = await call('api', { branch: 'icons' });
  return fam.status === 200 && fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8') ? true : false;
}, test.limit.quick);

// goal/G43.32, decided 9, which replaces this box's 7 on who checks: the check runs in the app's process, its run started
// as spirit/server/app.js in front of icons.js, never in the node. Andy: "isolation, we don't want the NODE to run the
// validation", "for one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js"".
// goal/G43.32, decided 9: a call that breaks it is refused by a run of the app, appServer.js in front of it, not by the node
test.run('a call the icons api allows starts a run, and the job names a new pid each time', 0.2, async function () {
  if (!W.up) return false;
  const r0 = await call('icons.' + W.v, { op: 'search', text: '' });
  await sleep(300);
  const p1 = await lastRun();
  const r1 = await call('icons.' + W.v, { op: 'search', text: '' });
  await sleep(300);
  const p2 = await lastRun();
  return r0.status === 200 && r1.status === 200 && !!p1 && !!p2 && p1 !== p2 ? true : false;
}, test.limit.slow);
// One crooked call: its answer, and whether a run of the app was started for it.
const crooked = async function (name, args) {
  if (!W.up) return null;
  const before = await lastRun();
  const r = await call(name, args);
  await sleep(400);
  const after = await lastRun();
  W.last = { refused: r.status >= 400 && r.status < 500, byRun: !!after && after !== before };
  return W.last;
};
const byRun = function () { return !W.up ? false : !W.last ? false : W.last.byRun || false; };
test.run('a verb the icons api does not name is refused', 0.2, async function () {
  const c = await crooked('icons.zzNoSuchVerb', {});
  return !c ? false : c.refused || false;
}, test.limit.slow);
test.run('a verb the icons api does not name is refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('an argument the icons api does not name is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'search', zzExtra: 1 });
  return !c ? false : c.refused || false;
}, test.limit.quick);
test.run('an argument the icons api does not name is refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('a glyph that is no text is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'add', glyph: 5 });
  return !c ? false : c.refused || false;
}, test.limit.quick);
test.run('a glyph that is no text is refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('keywords that are no list are refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'add', glyph: 'x', keywords: '"not a list"' });
  return !c ? false : c.refused || false;
}, test.limit.quick);
test.run('keywords that are no list are refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('an op that is no id is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: { nested: true } });
  return !c ? false : c.refused || false;
}, test.limit.quick);
test.run('an op that is no id is refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);

// "a page binds by" it: spirit.icons.<verb> on a page
test.run('spirit.icons.icon is a function on a page', 0.2, async function () {
  if (!W.up) return false;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  const bound = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return typeof (s.icons && s.icons[' + JSON.stringify(W.v) + ']); }, function () { return false; })');
  return bound === 'function' || false;
}, test.limit.quick);
test.run('spirit.icons.icon on a page answers a search', 0.2, async function () {
  if (!W.up) return false;
  const answered = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(W.v) + ']({ op: "search", text: "" }); }).then(function (b) { return JSON.stringify({ items: Array.isArray(b && b.items) }); }, function () { return false; })');
  return answered === '{"items":true}' || false;
}, test.limit.quick);
test.run('an argument the icons api does not name is refused on the page too', 0.2, async function () {
  if (!W.up) return false;
  const pageBad = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(W.v) + ']({ op: "search", zzExtra: 1 }); }).then(function () { return false; }, function () { return "refused"; })');
  return pageBad === 'refused' || false;
}, test.limit.quick);
