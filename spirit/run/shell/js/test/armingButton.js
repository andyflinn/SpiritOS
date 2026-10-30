'use strict';

// spirit/run/shell/js/test/armingButton.js
// The tests of shell/js/armingButton.js, and of no other module (spec: ./armingButton.md; goal/G41.9). The browser file
// runs in node on a window of its own: a button is a small element that keeps its attributes and its listeners, and
// the app's api keeps the disarm handed to the shell, as both shells' armUntilElsewhere do.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
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
    press: function () { (heard.click || []).slice().forEach(function (fn) { fn({ type: 'click', target: el, preventDefault: function () {} }); }); },
  };
  Object.defineProperty(el, 'dataset', { get: function () { const d = {}; Object.keys(attrs).forEach(function (k) { if (k.indexOf('data-') === 0) d[k.slice(5).replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = attrs[k]; }); return d; } });
  return el;
}

function world() {
  const win = {
    document: { createElement: element },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = { elements: {} };
  vm.createContext(win);
  if (fs.existsSync(FILE)) {
    try { vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE }); } catch (e) { test.fail('it threw as it loaded: ' + e.message); }
  }
  return win;
}
function api() { const a = { handed: [], armUntilElsewhere: function (fn) { a.handed.push(fn); a.disarm = fn; } }; return a; }
const isArmed = function (b) { return b.hasAttribute('data-armed'); };

test.startTest('armingButton.js: the are-you-sure button');

(async function () {
  ok(fs.existsSync(FILE), 'shell/js/armingButton.js exists', 'there is no shell/js/armingButton.js');
  const win = world();
  const E = win.spirit.elements.armingButton;
  ok(!!E && typeof E.create === 'function' && E.create.length === 2, 'it adds armingButton.create(container, options) to window.spirit.elements', 'no window.spirit.elements.armingButton.create of a container and options');
  if (!E) return;

  test.subHeading('the first press arms it, and runs nothing');
  const a = api(); const ran = [];
  // Box v23: "every element gets a container and appends itself".
  const box = element('div');
  const b = E.create(box, { label: 'Revoke', run: function () { ran.push('revoke'); return 'done'; }, api: a, title: 'take it back', className: 'gr-revoke' });
  ok(!!b && b.tagName === 'BUTTON' && b.type === 'button', 'create answers a button of type button', 'answered ' + short(b && b.tagName));
  if (!b) return;
  ok(box.children.length === 1 && box.children[0] === b, 'it is appended to the container it is given', 'container holds ' + box.children.length + (box.children[0] === b ? ', the button' : ', not the button'));
  ok(b.textContent === 'Revoke' && !isArmed(b), 'unarmed, it says its label', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  ok(b.title === 'take it back' && /gr-revoke/.test(b.className), 'its title and class are put on it', 'title ' + short(b.title) + ', class ' + short(b.className));
  b.press(); await settle();
  ok(ran.length === 0, 'a first press runs nothing', 'ran: ' + short(ran));
  ok(isArmed(b) && b.textContent === 'Revoke? Press again', 'it is armed: data-armed, and it says Revoke? Press again', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  ok(a.handed.length === 1 && typeof a.disarm === 'function', 'and hands the shell its disarm (armUntilElsewhere)', 'handed: ' + a.handed.length);
  ok(typeof b.armed === 'function' && b.armed() === true, 'armed() says so', 'armed(): ' + short(b.armed && b.armed()));

  test.subHeading('the second press runs it, once');
  b.press(); await settle();
  ok(ran.length === 1, 'the second press runs it once', 'ran: ' + short(ran));
  ok(!isArmed(b) && b.textContent === 'Revoke', 'and it is back to its label', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  b.press(); await settle();
  ok(ran.length === 1 && isArmed(b), 'the next press arms again from scratch, running nothing', 'ran ' + ran.length + ', armed ' + isArmed(b));

  test.subHeading('a click elsewhere puts it back (the shell\'s disarm)');
  a.disarm();
  ok(!isArmed(b) && b.textContent === 'Revoke' && b.armed() === false, 'the disarm puts it back: no data-armed, its label', 'text ' + short(b.textContent) + ', armed ' + isArmed(b));
  let threw = null;
  try { a.disarm(); } catch (e) { threw = e; }
  ok(!threw && !isArmed(b), 'a disarm called twice is harmless', 'threw: ' + short(threw && threw.message));
  b.press(); await settle();
  ok(ran.length === 1 && isArmed(b), 'after a disarm the next press arms again, running nothing', 'ran ' + ran.length + ', armed ' + isArmed(b));
  b.disarm();
  ok(!isArmed(b), 'disarm() puts it back from the app\'s side', 'still armed');

  test.subHeading('one loaded at a time');
  const a2 = api(); const ran2 = [];
  const one = E.create(element('div'), { label: 'Block', armedLabel: 'Block them? Press again', run: function () { ran2.push('block'); }, api: a2 });
  const two = E.create(element('div'), { label: 'Forget', run: function () { ran2.push('forget'); }, api: a2 });
  one.press(); await settle();
  ok(one.textContent === 'Block them? Press again', 'armedLabel is said when armed', 'text ' + short(one.textContent));
  two.press(); await settle();
  ok(isArmed(two) && !isArmed(one) && one.textContent === 'Block', 'arming one disarms the other', 'one ' + isArmed(one) + ' ' + short(one.textContent) + ', two ' + isArmed(two));
  one.press(); await settle();
  ok(ran2.length === 0, 'so the first, pressed again, arms anew and runs nothing', 'ran: ' + short(ran2));

  test.subHeading('attach: a button already in the page');
  const a4 = api(); const ran4 = [];
  const drawn = element('button'); drawn.textContent = 'Delete'; drawn.type = 'button';
  const same = typeof E.attach === 'function' ? E.attach(drawn, { run: function () { ran4.push('delete'); }, api: a4 }) : null;
  ok(same === drawn, 'attach answers the button it was handed', 'attach answered ' + short(same && same.tagName));
  if (same) {
    drawn.press(); await settle();
    ok(isArmed(drawn) && drawn.textContent === 'Delete? Press again' && ran4.length === 0, 'its first press arms it, its own text the label', 'text ' + short(drawn.textContent) + ', ran ' + ran4.length);
    drawn.press(); await settle();
    ok(!isArmed(drawn) && drawn.textContent === 'Delete' && ran4.length === 1, 'its second press runs it, and it says Delete again', 'text ' + short(drawn.textContent) + ', ran ' + ran4.length);
    const other = E.create(element('div'), { label: 'Waive', run: function () {}, api: a4 });
    drawn.press(); await settle();
    other.press(); await settle();
    ok(!isArmed(drawn) && isArmed(other), 'an attached button and a made one are one loaded at a time too', 'drawn ' + isArmed(drawn) + ', other ' + isArmed(other));
  }

  test.subHeading('without the shell\'s hook it still arms and runs');
  const ran3 = [];
  const bare = E.create(element('div'), { label: 'Close', run: function () { ran3.push('close'); } });
  bare.press(); await settle();
  ok(isArmed(bare) && ran3.length === 0, 'without armUntilElsewhere it still arms, running nothing', 'armed ' + isArmed(bare) + ', ran ' + ran3.length);
  bare.press(); await settle();
  ok(!isArmed(bare) && ran3.length === 1, 'and the second press runs it', 'armed ' + isArmed(bare) + ', ran ' + ran3.length);
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
