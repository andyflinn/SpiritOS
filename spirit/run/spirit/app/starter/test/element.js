'use strict';

// spirit/run/spirit/app/starter/test/element.js
// The tests of spirit/app/starter/element.js, and of no other module (spec: ./starter.md; goal/G43.27). The browser file
// runs in node on a bare window: the node's family is a stand-in that answers node.card, and spirit.outcome wraps an
// answer as spirit.js's does ({status, body}).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/starter/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const MANIFEST = path.join(__dirname, '..', 'starter.json');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function node(tag) {
  let html = '';
  const n = { tag: tag || '', kids: [], className: '', own: '',
    get textContent() { return n.own + n.kids.map(function (k) { return k.textContent; }).join(''); },
    set textContent(v) { n.own = String(v); n.kids = []; },
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); n.kids = []; n.own = ''; },
    appendChild: function (c) { n.kids.push(c); return c; },
  };
  return n;
}

// A world: card is what node.card answers (a body), or an Error for a refusal; hold delays the answer.
function world(card, hold) {
  const w = { asked: [], required: [] };
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  const family = { card: function (args) {
    w.asked.push({ verb: 'node.card', args: args });
    const answer = card instanceof Error ? Promise.reject(card) : Promise.resolve(card);
    return hold ? hold.then(function () { return answer; }) : answer;
  } };
  win.spirit = {
    ready: Promise.resolve({ node: family }),
    outcome: function (c) {
      return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; },
        function (e) { return { status: 500, body: { ok: false, error: e.message } }; });
    },
    require: function (p) { w.required.push(String(p)); return Promise.resolve({}); },
    element: {},
  };
  // goal/G43.32: a page's spirit (spirit/test/headLessChrome.js pageSpirit), so starter.js places itself by
  // installSpiritElement at spirit.element.spirit.app.starter.element as it runs.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  return w;
}

// starter.js: the smallest app, one element that shows its node. One test.run per test (goal/G47.2).
// What the tests made, for the tests after them.
const W = {};
const NO_E = 'no starter element: the first test failed';

// 1. one element
test.run('spirit.element.spirit.app.starter.element.create is there', 0.2, function () {
  W.w = world({ name: 'probe-node', description: 'a node for the test' });
  const E = ((((W.w.win.spirit.element || {}).spirit || {}).app || {}).starter || {}).element;
  W.E = E;
  return !!E && typeof E.create === 'function' ? true : 'no spirit.element.spirit.app.starter.element.create: ' + short(E && Object.keys(E));
}, test.limit.quick);
test.run('create answers { destroy }', 0.2, function () {
  if (!W.E || typeof W.E.create !== 'function') return NO_E;
  W.box = node('<div>');
  const made = W.made = W.E.create(W.box, {});
  return !!made && typeof made.destroy === 'function' ? true : 'create answered ' + short(made);
}, test.limit.quick);

// 2. it asks its node once
test.run('it asks node.card once', 0.2, async function () {
  if (!W.box) return NO_E;
  await settle();
  return W.w.asked.length === 1 && W.w.asked[0].verb === 'node.card' ? true : 'it asked ' + short(W.w.asked);
}, test.limit.quick);
test.run('it requires nothing', 0.2, function () {
  if (!W.w) return NO_E;
  return W.w.required.length === 0 || 'it required ' + short(W.w.required);
}, test.limit.quick);

// 3. it shows what the card says
test.run('the node\'s name is drawn', 0.2, function () {
  if (!W.box) return NO_E;
  const text = W.box.textContent;
  return /node: probe-node/.test(text) || 'no name in ' + short(text);
}, test.limit.quick);
test.run('its description is drawn', 0.2, function () {
  if (!W.box) return NO_E;
  const text = W.box.textContent;
  return /description: a node for the test/.test(text) || 'no description in ' + short(text);
}, test.limit.quick);

// 4. a refusal is said
test.run('a refused card draws a refused row with its error', 0.2, async function () {
  const r = world(new Error('no such verb'));
  const rbox = node('<div>');
  r.win.spirit.element.spirit.app.starter.element.create(rbox, {});
  await settle();
  return /refused: no such verb/.test(rbox.textContent) || 'a refusal drew ' + short(rbox.textContent);
}, test.limit.quick);

// 5. destroy empties its container
test.run('destroy leaves the container empty', 0.2, function () {
  if (!W.made || typeof W.made.destroy !== 'function') return NO_E;
  W.made.destroy();
  return W.box.innerHTML === '' && W.box.kids.length === 0 ? true : 'after destroy: ' + short(W.box.textContent);
}, test.limit.quick);
test.run('an answer after destroy draws nothing', 0.2, async function () {
  let release = null;
  const late = world({ name: 'late', description: 'late' }, new Promise(function (r2) { release = r2; }));
  const lbox = node('<div>');
  late.win.spirit.element.spirit.app.starter.element.create(lbox, {}).destroy();
  release();
  await settle();
  return !/late/.test(lbox.textContent) || 'a late answer drew ' + short(lbox.textContent);
}, test.limit.quick);

// 6. its starter.json is the app shape
function manifest() { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { return null; } }
test.run('identity: label Starter, not intrinsic', 0.2, function () {
  const m = manifest();
  const i = (m && m.identity) || {};
  return i.label === 'Starter' && i.intrinsic === false ? true : 'identity: ' + short(i);
}, test.limit.quick);
test.run('mount names element.js', 0.2, function () {
  const m = manifest();
  return !!(m && m.mount && m.mount['element.js'] === true) || 'mount: ' + short(m && m.mount);
}, test.limit.quick);
test.run('a shell mount and a tile', 0.2, function () {
  const m = manifest();
  return !!(m && m.shell && m.shell.mount === true && m.shell.tile === true) || 'shell: ' + short(m && m.shell);
}, test.limit.quick);
test.run('no node mount: the node starts nothing for it', 0.2, function () {
  const m = manifest();
  return !!(m && m.node && m.node.mount === false) || 'node: ' + short(m && m.node);
}, test.limit.quick);
