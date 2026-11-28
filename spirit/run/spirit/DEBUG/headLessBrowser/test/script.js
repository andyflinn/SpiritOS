'use strict';

// spirit/run/spirit/DEBUG/headLessBrowser/test/script.js
// The tests of spirit/DEBUG/headLessBrowser/script.js, and of no other module (spec: ./headLessBrowser.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// The bare mount page of one module (goal/G41.19). In process: make's page is read as text, and its one inline script is
// run on a window of its own, with a planted spirit, for an element, an app, and a file that places nothing.

const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const B = LOADER.requireScript('spirit/DEBUG/headLessBrowser/script.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// The page's inline script, run on a window of its own. place(spirit) is what the file hands back once it is required:
// spirit.requireScript's answer, the page's one read of it (goal/G49.23: no spirit.required).
async function mountIn(page, place) {
  const m = /<script>\n([\s\S]*?)\n<\/script>/.exec(page);
  const box = { id: 'mount-box' };
  const calls = { required: [], started: 0, created: [], mounted: [], rendered: 0, destroyed: 0 };
  const sp = {
    startPage: function () { calls.started += 1; return Promise.resolve(); },
    requireScript: function (p) { calls.required.push(p); return Promise.resolve(place(sp, calls)); },
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

// Andy: "the response will be the most minimal web page, NO COMMENTS, NOTHING with a script tag <script src="/spirit/script.js">"
// (the loader is spirit/script.js, the sheet spirit/shell/shell.css: goal/G49.23, their places in the tree)
test.run('the page has a script tag loading /spirit/script.js and one inline script, and nothing more', 0.2, function () {
  if (!page) return false;
  const tags = page.body.match(/<script[^>]*>/g) || [];
  return JSON.stringify(tags) === JSON.stringify(['<script src="/spirit/script.js">', '<script>']) || false;
}, test.limit.quick);
test.run('the page has no comments', 0.2, function () {
  if (!page) return false;
  const inline = (/<script>\n([\s\S]*?)\n<\/script>/.exec(page.body) || [])[1] || '';
  return (!/<!--/.test(page.body) && !/(^|[^:"\\])\/\/|\/\*/.test(inline)) || false;
}, test.limit.quick);
test.run('the page links /spirit/shell/shell.css, its box is mount-box, and its title is the module\'s name', 0.2, function () {
  if (!page) return false;
  const b = page.body;
  return (/<link rel="stylesheet" href="\/spirit\/shell\/shell\.css"/.test(b) && /<div id="mount-box" class="fill"><\/div>/.test(b) && /<title>zzThing<\/title>/.test(b)) || false;
}, test.limit.quick);
test.run('/spirit/script.js comes before the inline script', 0.2, function () {
  if (!page) return false;
  const at = page.body.indexOf('src="/spirit/script.js"');
  return (at >= 0 && at < page.body.indexOf('<script>\n')) || false;
}, test.limit.quick);

// an element (goal/G43.32): what spirit.requireScript hands back, .create(box), no options (goal/G49.23)
test.run('an element spirit.requireScript hands back is mounted', 0.2, async function () {
  if (!page) return false;
  el = await mountIn(page.body, function (sp, calls) {
    return { create: function () { calls.created.push(Array.prototype.slice.call(arguments)); return { destroy: function () { calls.destroyed += 1; } }; } };
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

// AN OLD APP, THROUGH activateApp, IS GONE (goal/G49.23, cw's 5458d7c39; Andy, of spirit.shell's hand-made members: "that sounds
// like spirit/fuckingGarbage/ to me...."): the debug page mounts elements alone, so its three old-app checks went with it.

// a file that places nothing: it fails and says where it looked
test.run('a file that hands back no element fails, and names the file it required', 0.2, async function () {
  if (!page) return false;
  none = await mountIn(page.body, function () {});
  const r = none.report || {};
  return (r.state === 'failed' && /spirit\/element\/zzThing\.js/.test(r.error)) || false;
}, test.limit.quick);
// ITS STAND-IN FOR OLD APPS STAYS INSIDE ITS PAGE (goal/G49.23, box v21: "activateApp, the debug page's stand-in for old
// apps, made inside that page, no longer on spirit.shell").
test.run('the debug page puts no activateApp on spirit.shell', 0.2, function () {
  const c = require('fs').readFileSync(path.join(RUN, 'spirit', 'DEBUG', 'headLessBrowser', 'script.js'), 'utf8');
  return !/spirit\.shell[^;\n]*activateApp/.test(c) || false;
}, test.limit.quick);
