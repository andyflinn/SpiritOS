'use strict';

// spirit/run/spirit/app/icons/test/api.js
// The tests of spirit/app/icons/api.js, and of no other module (spec: ./api.md; goal/G43.19, box v16). The box, 7: "api.js is
// the branch's interface, the verbs and arguments the node checks a call against and a page binds by, not the code that
// handles a call (Andy: "appClient does NOT route to api.js, that file has a different purpose")"; Q5: "api.js at the app's
// top with no api/ folder"; 5: "the api branch is icons, and icons.<verb> can be granted to a peer like any branch". A
// scratch node with Icons switched on, raw calls and a real Chrome on its face page; whether a call started a run is read
// from the job spirit.app.icons, which names the pid of its last run. Who checks a call is goal/G43.32's decided 9: the
// app's run, spirit/appServer.js in front of icons.js, not the node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'api.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// api.js: the icons branch's interface, which the node checks a call against and a page binds by (goal/G43.19).
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
const NO_WORLD = 'no scratch node of its own or no Chrome: the world failed';
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

test.run('it names its verbs', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/icons/api.js is not there';
  let api = null;
  try { api = require(FILE); } catch (e) { api = null; }
  W.api = api;
  W.verbs = Object.keys((api && api.verbs) || {});
  W.v = W.verbs[0];
  return W.verbs.length >= 1 || 'api.js names no verbs: ' + short(api);
}, test.limit.quick);
// Its one verb, icon, written out so that its check has a plain title.
test.run('each argument of the icon verb carries a rule', 0.2, function () {
  if (!W.verbs || !W.verbs.length) return 'api.js names no verbs';
  const rules = W.api.verbs.icon || {};
  const bad = Object.keys(rules).filter(function (a) { return typeof rules[a] !== 'string' || !/^[a-z]+\??$/i.test(rules[a]); });
  return !bad.length || 'icon: arguments without a rule: ' + short(bad) + '; its verbs: ' + W.verbs.join(', ');
}, test.limit.quick);
test.run('it handles nothing: it requires no code (the box, 7)', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/icons/api.js is not there';
  return !/require\s*\(/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')) || 'api.js requires code, so it is more than an interface';
}, test.limit.quick);

test.run('the world: a scratch node with Icons switched on, and a Chrome page', 0.2, async function () {
  if (!W.verbs || !W.verbs.length) return 'api.js names no verbs: nothing judged';
  W.node = await scratchNode({ servers: ['icons'] });
  W.chrome = await chromePage(findChrome());
  W.up = !!(W.node.up && W.node.root && !W.chrome.error);
  return W.up || 'no scratch node of its own or no Chrome: nothing judged. ' + short(W.chrome.error || '');
}, test.limit.slow);

// the node finds it at the app's top: api {family: icons} answers this file
test.run('api {family: icons} answers spirit/app/icons/api.js, word for word', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  const fam = await call('api', { family: 'icons' });
  return fam.status === 200 && fam.body && fam.body.interface === fs.readFileSync(FILE, 'utf8') ? true : 'api {family: icons}: ' + fam.status + ' ' + short(fam.text);
}, test.limit.quick);

// goal/G43.32, decided 9, which replaces this box's 7 on who checks: the check runs in the app's process, its run started
// as spirit/appServer.js in front of icons.js, never in the node. Andy: "isolation, we don't want the NODE to run the
// validation", "for one-shot servers, appClient launches appServer with the argument "spirit/app/<name>/name.js"".
// goal/G43.32, decided 9: a call that breaks it is refused by a run of the app, appServer.js in front of it, not by the node
test.run('the world: a call it allows starts a run, and the job names a new pid each time', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  const r0 = await call('icons.' + W.v, { op: 'search', text: '' });
  await sleep(300);
  const p1 = await lastRun();
  const r1 = await call('icons.' + W.v, { op: 'search', text: '' });
  await sleep(300);
  const p2 = await lastRun();
  return r0.status === 200 && r1.status === 200 && !!p1 && !!p2 && p1 !== p2 ? true : 'a good call: ' + r1.status + ' ' + short(r1.text) + '; pids ' + short([p1, p2]) + ', so a run cannot be told from none';
}, test.limit.slow);
// One crooked call: its answer, and whether a run of the app was started for it.
const crooked = async function (name, args, what) {
  if (!W.up) return null;
  const before = await lastRun();
  const r = await call(name, args);
  await sleep(400);
  const after = await lastRun();
  W.last = { refused: r.status >= 400 && r.status < 500, refusedWhy: what + ' answered ' + r.status + ' ' + short(r.text),
    byRun: !!after && after !== before, byRunWhy: what + ': no run was started, so the node refused it (pid ' + before + ' -> ' + after + ')' };
  return W.last;
};
const byRun = function () { return !W.up ? NO_WORLD : !W.last ? 'the call before was not made' : W.last.byRun || W.last.byRunWhy; };
test.run('a verb it does not name is refused', 0.2, async function () {
  const c = await crooked('icons.zzNoSuchVerb', {}, 'a verb it does not name');
  return !c ? NO_WORLD : c.refused || c.refusedWhy;
}, test.limit.slow);
test.run('a verb it does not name: refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('an argument it does not name is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'search', zzExtra: 1 }, 'an argument it does not name');
  return !c ? NO_WORLD : c.refused || c.refusedWhy;
}, test.limit.quick);
test.run('an argument it does not name: refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('a glyph that is no text is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'add', glyph: 5 }, 'a glyph that is no text');
  return !c ? NO_WORLD : c.refused || c.refusedWhy;
}, test.limit.quick);
test.run('a glyph that is no text: refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('keywords that are no list is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: 'add', glyph: 'x', keywords: 'not a list' }, 'keywords that are no list');
  return !c ? NO_WORLD : c.refused || c.refusedWhy;
}, test.limit.quick);
test.run('keywords that are no list: refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);
test.run('an op that is no id is refused', 0.2, async function () {
  const c = await crooked('icons.' + W.v, { op: { nested: true } }, 'an op that is no id');
  return !c ? NO_WORLD : c.refused || c.refusedWhy;
}, test.limit.quick);
test.run('an op that is no id: refused by a run of the app, not by the node', 0.2, byRun, test.limit.quick);

// "a page binds by" it: spirit.icons.<verb> on a page
test.run('spirit.icons.icon is a function on a page', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  const bound = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return typeof (s.icons && s.icons[' + JSON.stringify(W.v) + ']); }, function (e) { return "refused: " + String(e && e.message || e); })');
  return bound === 'function' || 'spirit.icons.' + W.v + ' is ' + short(bound);
}, test.limit.quick);
test.run('and it answers a search', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  const answered = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(W.v) + ']({ op: "search", text: "" }); }).then(function (b) { return JSON.stringify({ items: Array.isArray(b && b.items) }); }, function (e) { return "refused: " + String(e && e.message || e); })');
  return answered === '{"items":true}' || 'spirit.icons.' + W.v + ' answered ' + short(answered);
}, test.limit.quick);
test.run('an argument it does not name is refused on the page too', 0.2, async function () {
  if (!W.up) return NO_WORLD;
  const pageBad = await W.chrome.evaluate('window.spirit.ready.then(function (s) { return s.icons[' + JSON.stringify(W.v) + ']({ op: "search", zzExtra: 1 }); }).then(function (b) { return "answered " + JSON.stringify(b); }, function (e) { return "refused"; })');
  return pageBad === 'refused' || 'the page sent it: ' + short(pageBad);
}, test.limit.quick);
