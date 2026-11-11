'use strict';

// spirit/run/spirit/element/test/armingButton.js
// The tests of spirit/element/armingButton.js, and of no other module (spec: ./armingButton.md; goal/G41.9). The browser file
// runs in node on a window of its own: a button is a small element that keeps its attributes and its listeners, and
// the document keeps the click listeners the button adds while armed (goal/G43.24: it is handed no shell hook).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'armingButton.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); }); };

function element(tag) {
  const attrs = {}; const heard = {};
  const el = { tagName: String(tag).toUpperCase(), textContent: '', className: '', type: '', title: '', children: [],
    appendChild: function (c) { el.children.push(c); return c; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
    hasAttribute: function (k) { return k in attrs; },
    removeAttribute: function (k) { delete attrs[k]; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    // A press is a click on the button that then bubbles to the document, as a page's does.
    press: function () { const e = { type: 'click', target: el, preventDefault: function () {} }; (heard.click || []).slice().forEach(function (fn) { fn(e); }); bubble(e); },
    contains: function (t) { return t === el; },
  };
  Object.defineProperty(el, 'dataset', { get: function () { const d = {}; Object.keys(attrs).forEach(function (k) { if (k.indexOf('data-') === 0) d[k.slice(5).replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = attrs[k]; }); return d; } });
  return el;
}

// The document's click listeners: a press anywhere bubbles to them; elsewhere() is a click on no button.
let docClicks = [];
function bubble(e) { docClicks.slice().forEach(function (fn) { fn(e); }); }
function elsewhere() { bubble({ type: 'click', target: { tagName: 'DIV' }, preventDefault: function () {} }); }
function world() {
  const win = {
    document: { createElement: element,
      addEventListener: function (t, fn) { if (t === 'click') docClicks.push(fn); },
      removeEventListener: function (t, fn) { if (t === 'click') docClicks = docClicks.filter(function (f) { return f !== fn; }); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = { element: {} };
  // goal/G43.32: armingButton.js places itself by installSpiritElement (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  if (fs.existsSync(FILE)) {
    try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { throw new Error('it threw as it loaded: ' + e.message); }
  }
  return win;
}
const isArmed = function (b) { return b.hasAttribute('data-armed'); };

// What the tests make, shared by the tests after them.
let win, E, ran, box, b, threw, ran2, one, two, ran4, drawn, same, other, SRC, ran3, bare, blank, kept;
test.run('spirit/element/armingButton.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : 'there is no spirit/element/armingButton.js';
}, test.limit.quick);
test.run('it adds armingButton.create(container, options) to window.spirit.element', 0.2, async function () {
  win = world();
  await settle();
  // goal/G43.32: it stands at its path.
  E = ((win.spirit.element.spirit || {}).element || {}).armingButton;
  return (!!E && typeof E.create === 'function' && E.create.length === 2) ? true : 'no window.spirit.element.spirit.element.armingButton.create of a container and options';
}, test.limit.quick);
test.run('create answers a button of type button', 0.2, function () {
  // the first press arms it, and runs nothing
  ran = [];
  // Box v23: "every element gets a container and appends itself".
  box = element('div');
  b = E.create(box, { label: 'Revoke', run: function () { ran.push('revoke'); return 'done'; }, title: 'take it back', className: 'gr-revoke' });
  return (!!b && b.tagName === 'BUTTON' && b.type === 'button') ? true : 'answered ' + short(b && b.tagName);
}, test.limit.quick);
test.run('it is appended to the container it is given', 0.2, function () {
  return (box.children.length === 1 && box.children[0] === b) ? true : 'container holds ' + box.children.length + (box.children[0] === b ? ', the button' : ', not the button');
}, test.limit.quick);
test.run('unarmed, it says its label', 0.2, function () {
  return (b.textContent === 'Revoke' && !isArmed(b)) ? true : 'text ' + short(b.textContent) + ', armed ' + isArmed(b);
}, test.limit.quick);
test.run('its title and class are put on it', 0.2, function () {
  return (b.title === 'take it back' && /gr-revoke/.test(b.className)) ? true : 'title ' + short(b.title) + ', class ' + short(b.className);
}, test.limit.quick);
test.run('a first press runs nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 0) ? true : 'ran: ' + short(ran);
}, test.limit.quick);
test.run('it is armed: data-armed, and it says Revoke? Press again', 0.2, function () {
  return (isArmed(b) && b.textContent === 'Revoke? Press again') ? true : 'text ' + short(b.textContent) + ', armed ' + isArmed(b);
}, test.limit.quick);
test.run('and listens for a click elsewhere on the document, itself', 0.2, function () {
  return (docClicks.length === 1) ? true : 'document click listeners: ' + docClicks.length;
}, test.limit.quick);
test.run('armed() says so', 0.2, function () {
  return (typeof b.armed === 'function' && b.armed() === true) ? true : 'armed(): ' + short(b.armed && b.armed());
}, test.limit.quick);
test.run('the second press runs it once', 0.2, async function () {
  // the second press runs it, once
  b.press();
  await settle();
  return (ran.length === 1) ? true : 'ran: ' + short(ran);
}, test.limit.quick);
test.run('and it is back to its label', 0.2, function () {
  return (!isArmed(b) && b.textContent === 'Revoke') ? true : 'text ' + short(b.textContent) + ', armed ' + isArmed(b);
}, test.limit.quick);
test.run('disarmed, it no longer listens on the document', 0.2, function () {
  return (docClicks.length === 0) ? true : 'document click listeners: ' + docClicks.length;
}, test.limit.quick);
test.run('the next press arms again from scratch, running nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 1 && isArmed(b)) ? true : 'ran ' + ran.length + ', armed ' + isArmed(b);
}, test.limit.quick);
test.run('a click anywhere else puts it back: no data-armed, its label, nothing run', 0.2, function () {
  // a click elsewhere puts it back (its own document listener)
  elsewhere();
  return (!isArmed(b) && b.textContent === 'Revoke' && b.armed() === false && ran.length === 1) ? true : 'text ' + short(b.textContent) + ', armed ' + isArmed(b) + ', ran ' + ran.length;
}, test.limit.quick);
test.run('and it lets go of the document', 0.2, function () {
  return (docClicks.length === 0) ? true : 'document click listeners: ' + docClicks.length;
}, test.limit.quick);
test.run('a disarm called twice is harmless', 0.2, function () {
  threw = null;
  try { b.disarm(); b.disarm(); elsewhere(); } catch (e) { threw = e; }
  return (!threw && !isArmed(b)) ? true : 'threw: ' + short(threw && threw.message);
}, test.limit.quick);
test.run('after a disarm the next press arms again, running nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 1 && isArmed(b)) ? true : 'ran ' + ran.length + ', armed ' + isArmed(b);
}, test.limit.quick);
test.run('disarm() puts it back from the app\'s side', 0.2, function () {
  b.disarm();
  return (!isArmed(b)) ? true : 'still armed';
}, test.limit.quick);
test.run('armedLabel is said when armed', 0.2, async function () {
  // one loaded at a time
  ran2 = [];
  one = E.create(element('div'), { label: 'Block', armedLabel: 'Block them? Press again', run: function () { ran2.push('block'); } });
  two = E.create(element('div'), { label: 'Forget', run: function () { ran2.push('forget'); } });
  one.press();
  await settle();
  return (one.textContent === 'Block them? Press again') ? true : 'text ' + short(one.textContent);
}, test.limit.quick);
test.run('arming one disarms the other', 0.2, async function () {
  two.press();
  await settle();
  return (isArmed(two) && !isArmed(one) && one.textContent === 'Block') ? true : 'one ' + isArmed(one) + ' ' + short(one.textContent) + ', two ' + isArmed(two);
}, test.limit.quick);
test.run('so the first, pressed again, arms anew and runs nothing', 0.2, async function () {
  one.press();
  await settle();
  return (ran2.length === 0) ? true : 'ran: ' + short(ran2);
}, test.limit.quick);
test.run('one listener on the document, for the one armed', 0.2, function () {
  return (docClicks.length === 1) ? true : 'document click listeners: ' + docClicks.length;
}, test.limit.quick);
test.run('attach answers the button it was handed', 0.2, function () {
  one.disarm();
  // attach: a button already in the page
  ran4 = [];
  drawn = element('button');
  drawn.textContent = 'Delete';
  drawn.type = 'button';
  same = typeof E.attach === 'function' ? E.attach(drawn, { run: function () { ran4.push('delete'); } }) : null;
  return (same === drawn) ? true : 'attach answered ' + short(same && same.tagName);
}, test.limit.quick);
test.run('its first press arms it, its own text the label', 0.2, async function () {
  drawn.press();
  await settle();
  return (isArmed(drawn) && drawn.textContent === 'Delete? Press again' && ran4.length === 0) ? true : 'text ' + short(drawn.textContent) + ', ran ' + ran4.length;
}, test.limit.quick);
test.run('its second press runs it, and it says Delete again', 0.2, async function () {
  drawn.press();
  await settle();
  return (!isArmed(drawn) && drawn.textContent === 'Delete' && ran4.length === 1) ? true : 'text ' + short(drawn.textContent) + ', ran ' + ran4.length;
}, test.limit.quick);
test.run('an attached button and a made one are one loaded at a time too', 0.2, async function () {
  other = E.create(element('div'), { label: 'Waive', run: function () {} });
  drawn.press();
  await settle();
  other.press();
  await settle();
  return (!isArmed(drawn) && isArmed(other)) ? true : 'drawn ' + isArmed(drawn) + ', other ' + isArmed(other);
}, test.limit.quick);
test.run('its code names no api: no hook is handed to it', 0.2, function () {
  other.disarm();
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
  // needs...."): mounted with its container alone it arms, disarms on a click elsewhere and runs; it reads no api.
  // mounted with its container alone, it does all of it
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (!/\bapi\b/.test(SRC)) ? true : 'its code still names an api';
}, test.limit.quick);
test.run('it arms, running nothing', 0.2, async function () {
  ran3 = [];
  bare = E.create(element('div'), { label: 'Close', run: function () { ran3.push('close'); } });
  bare.press();
  await settle();
  return (isArmed(bare) && ran3.length === 0) ? true : 'armed ' + isArmed(bare) + ', ran ' + ran3.length;
}, test.limit.quick);
test.run('a click elsewhere disarms it', 0.2, function () {
  elsewhere();
  return (!isArmed(bare) && ran3.length === 0) ? true : 'armed ' + isArmed(bare) + ', ran ' + ran3.length;
}, test.limit.quick);
test.run('and two presses run it', 0.2, async function () {
  bare.press();
  await settle();
  bare.press();
  await settle();
  return (!isArmed(bare) && ran3.length === 1) ? true : 'armed ' + isArmed(bare) + ', ran ' + ran3.length;
}, test.limit.quick);
test.run('a button drawn empty says its label as soon as it is attached', 0.2, function () {
  // A BUTTON SAYS WHAT IT DOES BEFORE IT IS PRESSED (goal/G41.30; Andy: "the button for that has nothing written on it"):
  // attach with a label, on a button drawn empty, shows that label at once, not only after its first disarm.
  // attach: the label it is given shows from the start
  blank = element('button');
  E.attach(blank, { label: 'Give it the star', armedLabel: 'Give it the star: press again', run: function () {} });
  return (blank.textContent === 'Give it the star') ? true : 'it says "' + blank.textContent + '"';
}, test.limit.quick);
test.run('with no label given, it keeps its own words', 0.2, function () {
  kept = element('button');
  kept.textContent = 'Delete';
  E.attach(kept, { run: function () {} });
  return (kept.textContent === 'Delete') ? true : 'it says "' + kept.textContent + '"';
}, test.limit.quick);
