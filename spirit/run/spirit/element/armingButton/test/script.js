'use strict';

// spirit/run/spirit/element/armingButton/test/script.js
// The tests of spirit/element/armingButton/script.js, and of no other module (spec: ./script.md; goal/G41.9). The browser file
// runs in node on a window of its own: a button is a small element that keeps its attributes and its listeners, and
// the document keeps the click listeners the button adds while armed (goal/G43.24: it is handed no shell hook).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/armingButton/script.js';
const FILE = path.join(RUN, SUBJECT);

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
    // A busy mark goes in first and comes out again (goal/G47.1, Q25).
    disabled: false,
    insertBefore: function (c) { el.children.unshift(c); c.parentNode = el; return c; },
    removeChild: function (c) { el.children = el.children.filter(function (k) { return k !== c; }); c.parentNode = null; return c; },
    get firstChild() { return el.children[0] || null; },
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
  LOADER.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(win.spirit, null, { window: win, real: [SUBJECT] });
  if (fs.existsSync(FILE)) win.spirit.requireScript(SUBJECT);
  return win;
}
const isArmed = function (b) { return b.hasAttribute('data-armed'); };

// What the tests make, shared by the tests after them.
let win, E, ran, box, b, threw, ran2, one, two, ran4, drawn, same, other, SRC, ran3, bare, blank, kept;
test.run('spirit/element/armingButton/script.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('it adds armingButton.create(container, options) to window.spirit.element', 0.2, async function () {
  win = world();
  await settle();
  // goal/G43.32: it stands at its path; goal/G49.23: on the spirit object itself, spirit.element.armingButton.
  E = (win.spirit.element || {}).armingButton;
  return (!!E && typeof E.create === 'function' && E.create.length === 2) ? true : false;
}, test.limit.quick);
test.run('create answers a button of type button', 0.2, function () {
  // the first press arms it, and runs nothing
  ran = [];
  // Box v23: "every element gets a container and appends itself".
  box = element('div');
  b = E.create(box, { label: 'Revoke', run: function () { ran.push('revoke'); return 'done'; }, title: 'take it back', className: 'gr-revoke' });
  return (!!b && b.tagName === 'BUTTON' && b.type === 'button') ? true : false;
}, test.limit.quick);
test.run('it is appended to the container it is given', 0.2, function () {
  return (box.children.length === 1 && box.children[0] === b) ? true : false;
}, test.limit.quick);
test.run('unarmed, it says its label', 0.2, function () {
  return (b.textContent === 'Revoke' && !isArmed(b)) ? true : false;
}, test.limit.quick);
test.run('its title and class are put on it', 0.2, function () {
  return (b.title === 'take it back' && /gr-revoke/.test(b.className)) ? true : false;
}, test.limit.quick);
test.run('a first press runs nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 0) ? true : false;
}, test.limit.quick);
test.run('it is armed, marked data-armed, and it says Revoke? Press again', 0.2, function () {
  return (isArmed(b) && b.textContent === 'Revoke? Press again') ? true : false;
}, test.limit.quick);
test.run('armed, it listens itself for a click elsewhere on the document', 0.2, function () {
  return (docClicks.length === 1) ? true : false;
}, test.limit.quick);
test.run('its armed function says it is armed', 0.2, function () {
  return (typeof b.armed === 'function' && b.armed() === true) ? true : false;
}, test.limit.quick);
test.run('the second press runs it once', 0.2, async function () {
  // the second press runs it, once
  b.press();
  await settle();
  return (ran.length === 1) ? true : false;
}, test.limit.quick);
test.run('after running it is back to its label', 0.2, function () {
  return (!isArmed(b) && b.textContent === 'Revoke') ? true : false;
}, test.limit.quick);
test.run('disarmed, it no longer listens on the document', 0.2, function () {
  return (docClicks.length === 0) ? true : false;
}, test.limit.quick);
test.run('the next press arms again from scratch, running nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 1 && isArmed(b)) ? true : false;
}, test.limit.quick);
test.run('a click anywhere else puts it back, with no data-armed, its label shown and nothing run', 0.2, function () {
  // a click elsewhere puts it back (its own document listener)
  elsewhere();
  return (!isArmed(b) && b.textContent === 'Revoke' && b.armed() === false && ran.length === 1) ? true : false;
}, test.limit.quick);
test.run('put back by a click elsewhere, it lets go of the document', 0.2, function () {
  return (docClicks.length === 0) ? true : false;
}, test.limit.quick);
test.run('a disarm called twice is harmless', 0.2, function () {
  threw = null;
  try { b.disarm(); b.disarm(); elsewhere(); } catch (e) { threw = e; }
  return (!threw && !isArmed(b)) ? true : false;
}, test.limit.quick);
test.run('after a disarm the next press arms again, running nothing', 0.2, async function () {
  b.press();
  await settle();
  return (ran.length === 1 && isArmed(b)) ? true : false;
}, test.limit.quick);
test.run('calling disarm puts it back from the app\'s side', 0.2, function () {
  b.disarm();
  return (!isArmed(b)) ? true : false;
}, test.limit.quick);
test.run('armedLabel is said when armed', 0.2, async function () {
  // one loaded at a time
  ran2 = [];
  one = E.create(element('div'), { label: 'Block', armedLabel: 'Block them? Press again', run: function () { ran2.push('block'); } });
  two = E.create(element('div'), { label: 'Forget', run: function () { ran2.push('forget'); } });
  one.press();
  await settle();
  return (one.textContent === 'Block them? Press again') ? true : false;
}, test.limit.quick);
test.run('arming one disarms the other', 0.2, async function () {
  two.press();
  await settle();
  return (isArmed(two) && !isArmed(one) && one.textContent === 'Block') ? true : false;
}, test.limit.quick);
test.run('the first one, pressed again, arms anew and runs nothing', 0.2, async function () {
  one.press();
  await settle();
  return (ran2.length === 0) ? true : false;
}, test.limit.quick);
test.run('one listener on the document, for the one armed', 0.2, function () {
  return (docClicks.length === 1) ? true : false;
}, test.limit.quick);
test.run('attach answers the button it was handed', 0.2, function () {
  one.disarm();
  // attach: a button already in the page
  ran4 = [];
  drawn = element('button');
  drawn.textContent = 'Delete';
  drawn.type = 'button';
  same = typeof E.attach === 'function' ? E.attach(drawn, { run: function () { ran4.push('delete'); } }) : null;
  return (same === drawn) ? true : false;
}, test.limit.quick);
test.run('an attached button\'s first press arms it, its own text kept as the label', 0.2, async function () {
  drawn.press();
  await settle();
  return (isArmed(drawn) && drawn.textContent === 'Delete? Press again' && ran4.length === 0) ? true : false;
}, test.limit.quick);
test.run('an attached button\'s second press runs it, and it says Delete again', 0.2, async function () {
  drawn.press();
  await settle();
  return (!isArmed(drawn) && drawn.textContent === 'Delete' && ran4.length === 1) ? true : false;
}, test.limit.quick);
test.run('an attached button and a made one are one loaded at a time too', 0.2, async function () {
  other = E.create(element('div'), { label: 'Waive', run: function () {} });
  drawn.press();
  await settle();
  other.press();
  await settle();
  return (!isArmed(drawn) && isArmed(other)) ? true : false;
}, test.limit.quick);
// goal/G47.1, Q25 (Andy: "sure."): busy after its confirming press, until the answer: disabled, with the shell's turning mark.
let held = null, waits = null;
const marked = function (x) { return x.children.some(function (c) { return /\bshell-busy\b/.test(c.className); }); };
test.run('a run that answers a promise leaves it busy after its confirming press: disabled, with its turning mark', 0.2, async function () {
  other.disarm();
  waits = E.create(element('div'), { label: 'Wait', run: function () { return new Promise(function (r) { held = r; }); } });
  waits.press();
  await settle();
  const plainArmed = !waits.disabled && !marked(waits);
  waits.press();
  await settle();
  return (plainArmed && waits.disabled === true && marked(waits) && !isArmed(waits)) ? true : false;
}, test.limit.quick);
test.run('once that answer comes, it is plain again, its label said', 0.2, async function () {
  if (!held) return false;
  held();
  await settle();
  return (waits.disabled === false && !marked(waits) && waits.textContent === 'Wait') ? true : false;
}, test.limit.quick);
test.run('a run that answers no promise marks nothing', 0.2, function () {
  return (!drawn.disabled && !marked(drawn)) ? true : false;
}, test.limit.quick);
test.run('its code names no api, as no hook is handed to it', 0.2, function () {
  other.disarm();
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
  // needs...."): mounted with its container alone it arms, disarms on a click elsewhere and runs; it reads no api.
  // mounted with its container alone, it does all of it
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (!/\bapi\b/.test(SRC)) ? true : false;
}, test.limit.quick);
test.run('mounted with its container alone, it arms, running nothing', 0.2, async function () {
  ran3 = [];
  bare = E.create(element('div'), { label: 'Close', run: function () { ran3.push('close'); } });
  bare.press();
  await settle();
  return (isArmed(bare) && ran3.length === 0) ? true : false;
}, test.limit.quick);
test.run('mounted with its container alone, a click elsewhere disarms it', 0.2, function () {
  elsewhere();
  return (!isArmed(bare) && ran3.length === 0) ? true : false;
}, test.limit.quick);
test.run('mounted with its container alone, two presses run it once', 0.2, async function () {
  bare.press();
  await settle();
  bare.press();
  await settle();
  return (!isArmed(bare) && ran3.length === 1) ? true : false;
}, test.limit.quick);
test.run('a button drawn empty says its label as soon as it is attached', 0.2, function () {
  // A BUTTON SAYS WHAT IT DOES BEFORE IT IS PRESSED (goal/G41.30; Andy: "the button for that has nothing written on it"):
  // attach with a label, on a button drawn empty, shows that label at once, not only after its first disarm.
  // attach: the label it is given shows from the start
  blank = element('button');
  E.attach(blank, { label: 'Give it the star', armedLabel: 'Give it the star: press again', run: function () {} });
  return (blank.textContent === 'Give it the star') ? true : false;
}, test.limit.quick);
test.run('with no label given, it keeps its own words', 0.2, function () {
  kept = element('button');
  kept.textContent = 'Delete';
  E.attach(kept, { run: function () {} });
  return (kept.textContent === 'Delete') ? true : false;
}, test.limit.quick);
