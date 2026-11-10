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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
  vm.createContext(win);
  if (fs.existsSync(FILE)) {
    try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { test.fail('it threw as it loaded: ' + e.message); }
  }
  return win;
}
const isArmed = function (b) { return b.hasAttribute('data-armed'); };

test.startTest('armingButton.js: the are-you-sure button');

(async function () {
  ok(fs.existsSync(FILE), 'spirit/element/armingButton.js exists', 'there is no spirit/element/armingButton.js');
  const win = world();
  const E = win.spirit.element.armingButton;
  ok(!!E && typeof E.create === 'function' && E.create.length === 2, 'it adds armingButton.create(container, options) to window.spirit.element', 'no window.spirit.element.armingButton.create of a container and options');
  if (!E) return;

  test.subHeading('the first press arms it, and runs nothing');
  const ran = [];
  // Box v23: "every element gets a container and appends itself".
  const box = element('div');
  const b = E.create(box, { label: 'Revoke', run: function () { ran.push('revoke'); return 'done'; }, title: 'take it back', className: 'gr-revoke' });
  ok(!!b && b.tagName === 'BUTTON' && b.type === 'button', 'create answers a button of type button', 'answered ' + short(b && b.tagName));
  if (!b) return;
  ok(box.children.length === 1 && box.children[0] === b, 'it is appended to the container it is given', 'container holds ' + box.children.length + (box.children[0] === b ? ', the button' : ', not the button'));
  ok(b.textContent === 'Revoke' && !isArmed(b), 'unarmed, it says its label', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  ok(b.title === 'take it back' && /gr-revoke/.test(b.className), 'its title and class are put on it', 'title ' + short(b.title) + ', class ' + short(b.className));
  b.press(); await settle();
  ok(ran.length === 0, 'a first press runs nothing', 'ran: ' + short(ran));
  ok(isArmed(b) && b.textContent === 'Revoke? Press again', 'it is armed: data-armed, and it says Revoke? Press again', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  ok(docClicks.length === 1, 'and listens for a click elsewhere on the document, itself', 'document click listeners: ' + docClicks.length);
  ok(typeof b.armed === 'function' && b.armed() === true, 'armed() says so', 'armed(): ' + short(b.armed && b.armed()));

  test.subHeading('the second press runs it, once');
  b.press(); await settle();
  ok(ran.length === 1, 'the second press runs it once', 'ran: ' + short(ran));
  ok(!isArmed(b) && b.textContent === 'Revoke', 'and it is back to its label', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  ok(docClicks.length === 0, 'disarmed, it no longer listens on the document', 'document click listeners: ' + docClicks.length);
  b.press(); await settle();
  ok(ran.length === 1 && isArmed(b), 'the next press arms again from scratch, running nothing', 'ran ' + ran.length + ', armed ' + isArmed(b));

  test.subHeading('a click elsewhere puts it back (its own document listener)');
  elsewhere();
  ok(!isArmed(b) && b.textContent === 'Revoke' && b.armed() === false && ran.length === 1, 'a click anywhere else puts it back: no data-armed, its label, nothing run', 'text ' + short(b.textContent) + ', armed ' + isArmed(b) + ', ran ' + ran.length);
  ok(docClicks.length === 0, 'and it lets go of the document', 'document click listeners: ' + docClicks.length);
  let threw = null;
  try { b.disarm(); b.disarm(); elsewhere(); } catch (e) { threw = e; }
  ok(!threw && !isArmed(b), 'a disarm called twice is harmless', 'threw: ' + short(threw && threw.message));
  b.press(); await settle();
  ok(ran.length === 1 && isArmed(b), 'after a disarm the next press arms again, running nothing', 'ran ' + ran.length + ', armed ' + isArmed(b));
  b.disarm();
  ok(!isArmed(b), 'disarm() puts it back from the app\'s side', 'still armed');

  test.subHeading('one loaded at a time');
  const ran2 = [];
  const one = E.create(element('div'), { label: 'Block', armedLabel: 'Block them? Press again', run: function () { ran2.push('block'); } });
  const two = E.create(element('div'), { label: 'Forget', run: function () { ran2.push('forget'); } });
  one.press(); await settle();
  ok(one.textContent === 'Block them? Press again', 'armedLabel is said when armed', 'text ' + short(one.textContent));
  two.press(); await settle();
  ok(isArmed(two) && !isArmed(one) && one.textContent === 'Block', 'arming one disarms the other', 'one ' + isArmed(one) + ' ' + short(one.textContent) + ', two ' + isArmed(two));
  one.press(); await settle();
  ok(ran2.length === 0, 'so the first, pressed again, arms anew and runs nothing', 'ran: ' + short(ran2));
  ok(docClicks.length === 1, 'one listener on the document, for the one armed', 'document click listeners: ' + docClicks.length);
  one.disarm();

  test.subHeading('attach: a button already in the page');
  const ran4 = [];
  const drawn = element('button'); drawn.textContent = 'Delete'; drawn.type = 'button';
  const same = typeof E.attach === 'function' ? E.attach(drawn, { run: function () { ran4.push('delete'); } }) : null;
  ok(same === drawn, 'attach answers the button it was handed', 'attach answered ' + short(same && same.tagName));
  if (same) {
    drawn.press(); await settle();
    ok(isArmed(drawn) && drawn.textContent === 'Delete? Press again' && ran4.length === 0, 'its first press arms it, its own text the label', 'text ' + short(drawn.textContent) + ', ran ' + ran4.length);
    drawn.press(); await settle();
    ok(!isArmed(drawn) && drawn.textContent === 'Delete' && ran4.length === 1, 'its second press runs it, and it says Delete again', 'text ' + short(drawn.textContent) + ', ran ' + ran4.length);
    const other = E.create(element('div'), { label: 'Waive', run: function () {} });
    drawn.press(); await settle();
    other.press(); await settle();
    ok(!isArmed(drawn) && isArmed(other), 'an attached button and a made one are one loaded at a time too', 'drawn ' + isArmed(drawn) + ', other ' + isArmed(other));
    other.disarm();
  }

  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "anybody can mount any element without knowing what it actually
  // needs...."): mounted with its container alone it arms, disarms on a click elsewhere and runs; it reads no api.
  test.subHeading('mounted with its container alone, it does all of it');
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  ok(!/\bapi\b/.test(SRC), 'its code names no api: no hook is handed to it', 'its code still names an api');
  const ran3 = [];
  const bare = E.create(element('div'), { label: 'Close', run: function () { ran3.push('close'); } });
  bare.press(); await settle();
  ok(isArmed(bare) && ran3.length === 0, 'it arms, running nothing', 'armed ' + isArmed(bare) + ', ran ' + ran3.length);
  elsewhere();
  ok(!isArmed(bare) && ran3.length === 0, 'a click elsewhere disarms it', 'armed ' + isArmed(bare) + ', ran ' + ran3.length);
  bare.press(); await settle();
  bare.press(); await settle();
  ok(!isArmed(bare) && ran3.length === 1, 'and two presses run it', 'armed ' + isArmed(bare) + ', ran ' + ran3.length);

  // A BUTTON SAYS WHAT IT DOES BEFORE IT IS PRESSED (goal/G41.30; Andy: "the button for that has nothing written on it"):
  // attach with a label, on a button drawn empty, shows that label at once, not only after its first disarm.
  test.subHeading('attach: the label it is given shows from the start');
  const blank = element('button');
  E.attach(blank, { label: 'Give it the star', armedLabel: 'Give it the star: press again', run: function () {} });
  ok(blank.textContent === 'Give it the star', 'a button drawn empty says its label as soon as it is attached', 'it says "' + blank.textContent + '"');
  const kept = element('button'); kept.textContent = 'Delete';
  E.attach(kept, { run: function () {} });
  ok(kept.textContent === 'Delete', 'with no label given, it keeps its own words', 'it says "' + kept.textContent + '"');
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
