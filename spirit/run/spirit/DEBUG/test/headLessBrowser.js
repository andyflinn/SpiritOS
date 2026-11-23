'use strict';

// spirit/run/spirit/DEBUG/test/headLessBrowser.js
// The tests of spirit/DEBUG/headLessBrowser.js, and of no other module (spec: ./headLessBrowser.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// The bare mount page of one module (goal/G41.19). In process: make's page is read as text, and its one inline script is
// run on a window of its own, with a planted spirit, for an element, an app, and a file that places nothing.

const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const B = LOADER.requireScript('spirit/DEBUG/headLessBrowser.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// The page's inline script, run on a window of its own. place(spirit) puts what the file places once it is required.
async function mountIn(page, place) {
  const m = /<script>\n([\s\S]*?)\n<\/script>/.exec(page);
  const box = { id: 'mount-box' };
  const calls = { required: [], started: 0, created: [], mounted: [], rendered: 0, destroyed: 0 };
  const sp = {
    startPage: function () { calls.started += 1; return Promise.resolve(); },
    requireScript: function (p) { calls.required.push(p); place(sp, calls); return Promise.resolve(); },
    callOutcome: function (v) { return Promise.resolve(v).then(function (b) { return { status: 200, body: b }; }); },
    escapeHtml: function (s) { return String(s); },
    thing: { hello: function (a) { return { said: a.word }; } },
  };
  const win = { document: { getElementById: function (id) { return id === 'mount-box' ? box : null; } }, Promise: Promise, JSON: JSON, String: String, Error: Error };
  win.window = win; win.spirit = sp;
  vm.createContext(win);
  if (m) vm.runInContext(m[1], win);
  await settle();
  return { report: win.spiritMount, box: box, calls: calls, spirit: sp };
}

// What the world makes, for the tests after it.
let page = null, el = null, app = null, none = null;

test.run('make answers the page of spirit/element/zzThing', 0.2, async function () {
  page = await B.make({ module: 'spirit/element/zzThing', ext: 'html' });
  return (!!page && typeof page.body === 'string') || false;
}, test.limit.quick);

// make
test.run('make answers HTML, typed as text/html with charset utf-8', 0.2, function () {
  if (!page) return false;
  return (page.type === 'text/html; charset=utf-8' && /^<!doctype html>/.test(page.body)) || false;
}, test.limit.quick);
test.run('make answers null for an address that is not .html', 0.2, async function () {
  const got = await B.make({ module: 'spirit/element/zzThing', ext: 'json' });
  return got === null || false;
}, test.limit.quick);

// Andy: "the response will be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit.js">"
test.run('the page has a script tag loading /spirit.js and one inline script, and nothing more', 0.2, function () {
  if (!page) return false;
  const tags = page.body.match(/<script[^>]*>/g) || [];
  return JSON.stringify(tags) === JSON.stringify(['<script src="/spirit.js">', '<script>']) || false;
}, test.limit.quick);
test.run('the page has no comments', 0.2, function () {
  if (!page) return false;
  const inline = (/<script>\n([\s\S]*?)\n<\/script>/.exec(page.body) || [])[1] || '';
  return (!/<!--/.test(page.body) && !/(^|[^:"\\])\/\/|\/\*/.test(inline)) || false;
}, test.limit.quick);
test.run('the page links /shell.css, its box is mount-box, and its title is the module\'s name', 0.2, function () {
  if (!page) return false;
  const b = page.body;
  return (/<link rel="stylesheet" href="\/shell.css"/.test(b) && /<div id="mount-box" class="fill"><\/div>/.test(b) && /<title>zzThing<\/title>/.test(b)) || false;
}, test.limit.quick);
test.run('/spirit.js comes before the inline script', 0.2, function () {
  if (!page) return false;
  return page.body.indexOf('src="/spirit.js"') < page.body.indexOf('<script>\n') || false;
}, test.limit.quick);

// an element (goal/G43.32): spirit.required.<its path>.create(box), no options
test.run('an element placed at its path is mounted', 0.2, async function () {
  if (!page) return false;
  el = await mountIn(page.body, function (sp, calls) {
    sp.required = { spirit: { element: { zzThing: { create: function () { calls.created.push(Array.prototype.slice.call(arguments)); return { destroy: function () { calls.destroyed += 1; } }; } } } } };
  });
  return !!el.report || false;
}, test.limit.quick);
test.run('the module is loaded through spirit.requireScript, after spirit.startPage, alone', 0.2, function () {
  if (!el || !el.report) return false;
  return (el.calls.started === 1 && JSON.stringify(el.calls.required) === JSON.stringify(['spirit/element/zzThing.js'])) || false;
}, test.limit.quick);
test.run('an element is created with the box alone and no options', 0.2, function () {
  if (!el || !el.report) return false;
  return (el.calls.created.length === 1 && el.calls.created[0].length === 1 && el.calls.created[0][0] === el.box) || false;
}, test.limit.quick);
test.run('window.spiritMount says mounted, holds the box, and its destroy is the element\'s', 0.2, function () {
  if (!el || !el.report) return false;
  const r = el.report;
  if (r.state !== 'mounted' || r.box !== el.box || typeof r.destroy !== 'function') return false;
  r.destroy();
  return el.calls.destroyed === 1 || false;
}, test.limit.quick);

// an app: activateApp, mounted into the box with an api as the face gives one
test.run('an app that calls spirit.shell.activateApp is mounted', 0.2, async function () {
  if (!page) return false;
  app = await mountIn(page.body, function (sp, calls) {
    sp.shell.activateApp({ mount: function (box, api) { calls.mounted.push({ box: box, api: api }); }, render: function () { calls.rendered += 1; } });
  });
  return !!app.report || false;
}, test.limit.quick);
test.run('an app is mounted into the box with an api, rendered, and said mounted', 0.2, function () {
  if (!app || !app.report) return false;
  const m = app.calls.mounted[0];
  return (app.calls.mounted.length === 1 && m.box === app.box && !!m.api && app.calls.rendered === 1 && app.report.state === 'mounted') || false;
}, test.limit.quick);
test.run('the app\'s api asks a verb of the spirit object\'s branch, and refuses a verb that is not there', 0.2, async function () {
  if (!app || !app.calls.mounted.length) return false;
  const api = app.calls.mounted[0].api;
  if (typeof api.verb !== 'function') return false;
  const yes = await api.verb('thing.hello', { word: 'hi' });
  const no = await api.verb('thing.nothing', {});
  return (yes.status === 200 && yes.body.said === 'hi' && no.status === 400 && no.body.code === 'no-such-verb') || false;
}, test.limit.quick);

// a file that places nothing: it fails and says where it looked
test.run('a file that places no element fails, and says where it looked', 0.2, async function () {
  if (!page) return false;
  none = await mountIn(page.body, function () {});
  const r = none.report || {};
  return (r.state === 'failed' && /spirit\.required\.spirit\.element\.zzThing/.test(r.error)) || false;
}, test.limit.quick);
