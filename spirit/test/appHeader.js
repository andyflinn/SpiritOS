'use strict';

// goal/G6.1: the header-area shell element, a sticky div an app fills, held under the shell's titlebar. Red on today's
// tree; wsl-claude wrote it from G6.1's box and does not build it.
//   Andy, FACE.md: "shell app apps/dialog apps can have a header area. this header area behaves like the header area in
//   both desk and deskDetails. we want a shell element that facilitates that."; "it's upper edge sticks to the the lower
//   edge of the shell's titlebar, when the user scrolls down in the dialog". In goal/G6.1: "the shape only produces the
//   div container for the app to fill in, and provides only the sticking functionality?", and "fill in the shape and"
//   "cap"; his Go.
//
// THE SHAPES (the box's):
//   1  spirit/run/shell/js/appHeader/appHeader.js adds createAppHeader to window.spiritElements, on the shell's globals.
//   2  createAppHeader() returns an empty div: position sticky, its top the titlebar's measured height, a background, a
//      z-index above the content; measured again when the window resizes.
//   3  index.html loads it beside iconSelector.js, before the shell; the shell hands it to apps as api.ui.elements.
//   4  desk and deskDetails move onto it: their own copies of the sticky div's measuring are removed.
// THE NAMES that are wsl-claude's picks (the box names none): the titlebar is the shell's #app-header, the element desk
// and deskDetails measure today (desk.js 830, deskDetails.js 92); its height is read as offsetHeight or as
// getBoundingClientRect().height, either; the div's top is read from its inline style (style.top, setProperty, or
// cssText; a var(--x) is resolved), so the builder may write it any of those ways.
// LEFT OPEN, with the reason, not asserted here:
//   - "measured in one place": a source shape, not behaviour; the removal of desk's and deskDetails' copies (4) is.
//   - ruleDetails using it: goal/G6.4's.
//   - the grants (appHeader.js, index.html, shell.js are core): the commit check holds those, not this suite.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G6.1: ';
const RUN = path.join(__dirname, '..', 'run');
const FILE = path.join(RUN, 'shell', 'js', 'appHeader', 'appHeader.js');
const INDEX = path.join(RUN, 'index.html');
const SHELL = path.join(RUN, 'js', 'client', 'shell.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

// An inline style as a browser keeps it: properties set by name, by setProperty, or through cssText.
function fakeStyle() {
  const props = {};
  const norm = function (n) { return String(n).trim().replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); };
  const st = new Proxy({}, {
    get: function (t, k) {
      if (k === 'setProperty') return function (n, v) { props[norm(n)] = String(v); };
      if (k === 'getPropertyValue') return function (n) { return props[norm(n)] || ''; };
      if (k === 'removeProperty') return function (n) { delete props[norm(n)]; };
      if (k === 'cssText') return Object.keys(props).map(function (n) { return n + ':' + props[n]; }).join(';');
      if (k === '__props') return props;
      if (typeof k !== 'string') return undefined;
      return props[norm(k)] || '';
    },
    set: function (t, k, v) {
      if (k === 'cssText') { Object.keys(props).forEach(function (n) { delete props[n]; }); String(v).split(';').forEach(function (d) { const i = d.indexOf(':'); if (i > 0) props[norm(d.slice(0, i))] = d.slice(i + 1).trim(); }); }
      else props[norm(k)] = String(v);
      return true;
    },
  });
  return st;
}
function resolved(style, name) {
  let v = style.getPropertyValue(name);
  for (let i = 0; i < 4 && /var\(/.test(v); i++) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/, function (m, n, dflt) { return style.getPropertyValue(n) || (dflt || '').trim(); });
  }
  return v.trim();
}
function fakeElement(tag) {
  const el = { tagName: String(tag).toUpperCase(), className: '', id: '', children: [], listeners: {}, dataset: {}, style: fakeStyle(), attributes: {}, textContent: '' };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  el.appendChild = function (c) { el.children.push(c); c.parentNode = el; return c; };
  el.addEventListener = function (ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); };
  el.setAttribute = function (n, v) { el.attributes[n] = String(v); if (n === 'style') el.style.cssText = v; };
  el.getAttribute = function (n) { return el.attributes[n] === undefined ? null : el.attributes[n]; };
  el.querySelector = function () { return null; };
  el.querySelectorAll = function () { return []; };
  return el;
}

test.startTest('goal/G6.1: the header-area shell element, sticky under the titlebar');

const src = read(FILE);
const index = read(INDEX) || '';
const shell = read(SHELL) || '';

test.subHeading('1. appHeader.js adds createAppHeader to spiritElements');
if (src && src.indexOf('createAppHeader') !== -1 && /spiritElements/.test(src)) test.check('spirit/run/shell/js/appHeader/appHeader.js defines createAppHeader and adds it to spiritElements');
else test.fail(OWED + (src ? 'appHeader.js has no createAppHeader added to spiritElements' : 'no spirit/run/shell/js/appHeader/appHeader.js'));

test.subHeading('2. the div: empty, sticky at the titlebar\'s height, opaque, above, measured again on resize');
let pending = Promise.resolve();
if (!src) test.fail(OWED + 'the element is owed with its file');
else {
  const titlebar = { id: 'app-header', offsetHeight: 48, getBoundingClientRect: function () { return { height: titlebar.offsetHeight, top: 0, bottom: titlebar.offsetHeight }; } };
  const winListeners = {};
  const observers = [];
  const window = { addEventListener: function (ev, fn) { (winListeners[ev] = winListeners[ev] || []).push(fn); }, removeEventListener: function () {}, innerHeight: 800, innerWidth: 1200 };
  const document = { createElement: fakeElement, body: fakeElement('body'), addEventListener: function () {},
    getElementById: function (id) { return id === 'app-header' ? titlebar : null; },
    querySelector: function (q) { return q === '#app-header' ? titlebar : null; } };
  function ResizeObserver(fn) { this.fn = fn; observers.push(this); }
  ResizeObserver.prototype.observe = function () {}; ResizeObserver.prototype.disconnect = function () {}; ResizeObserver.prototype.unobserve = function () {};
  const ctx = { window: window, document: document, console: console, ResizeObserver: ResizeObserver,
    requestAnimationFrame: function (fn) { return setImmediate(fn); }, cancelAnimationFrame: function () {}, setTimeout: setTimeout, clearTimeout: clearTimeout,
    getComputedStyle: function (el) { return el.style; }, spirit: { core: { util: { escapeHtml: function (s) { return String(s); } } } } };
  ctx.self = ctx.window;
  let tripped = null; let div = null;
  try { vm.createContext(ctx); vm.runInContext(src, ctx); div = window.spiritElements && window.spiritElements.createAppHeader && window.spiritElements.createAppHeader(); } catch (e) { tripped = e; }
  const tick = function () { return new Promise(function (r) { setTimeout(r, 20); }); };
  pending = tick().then(function () {
    if (tripped || !div) { test.fail(OWED + (tripped ? 'appHeader.js or createAppHeader() threw: ' + tripped.message : 'createAppHeader() returned nothing')); return; }
    const st = div.style;
    const z = Number(resolved(st, 'z-index'));
    const bg = resolved(st, 'background') || resolved(st, 'background-color');
    if (div.tagName === 'DIV' && !div.children.length && !div.innerHTML && resolved(st, 'position') === 'sticky' && z > 0 && bg && bg !== 'transparent') test.check('createAppHeader() returns an empty div, position sticky, a background and a z-index above 0');
    else test.fail(OWED + 'the div: ' + short({ tag: div.tagName, children: div.children.length, html: div.innerHTML, position: resolved(st, 'position'), zIndex: resolved(st, 'z-index'), background: bg }));
    const top1 = resolved(st, 'top');
    if (top1 === '48px') test.check('its top is the titlebar\'s measured height (48px)');
    else test.fail(OWED + 'top with the titlebar at 48px: ' + short(top1));
    titlebar.offsetHeight = 60;
    (winListeners.resize || []).forEach(function (fn) { fn({ type: 'resize' }); });
    observers.forEach(function (o) { o.fn([{ target: titlebar, contentRect: { height: 60 } }], o); });
    return tick().then(function () {
      const top2 = resolved(st, 'top');
      if (top1 === '48px' && top2 === '60px') test.check('after the window resizes and the titlebar grows to 60px, its top is 60px');
      else test.fail(OWED + 'top after a resize to 60px: ' + short({ before: top1, after: top2 }));
    });
  });
}

pending = pending.then(function () {
  test.subHeading('3. loaded by index.html before the shell, handed to apps as api.ui.elements');
  const at = index.indexOf('src="/shell/js/appHeader/appHeader.js"');
  const atShell = index.indexOf('src="/js/client/shell.js"');
  if (at !== -1 && atShell !== -1 && at < atShell) test.check('index.html loads /shell/js/appHeader/appHeader.js before /js/client/shell.js');
  else test.fail(OWED + 'index.html: appHeader at ' + at + ', shell at ' + atShell);
  if (/createAppHeader\s*:\s*spiritElements\.createAppHeader/.test(shell)) test.check('shell.js hands createAppHeader to apps from spiritElements, beside the others');
  else test.fail(OWED + 'shell.js does not hand createAppHeader: spiritElements.createAppHeader under ui.elements (shell.js 1338-1344 hands each by name)');

  test.subHeading('4. desk and deskDetails move onto it, their own copies gone');
  [['desk', read(DESK) || '', 'deskBarTop'], ['deskDetails', read(DETAILS) || '', 'ddBarTop']].forEach(function (a) {
    const name = a[0]; const old = a[2];
    // COMMENTS DO NOT COUNT (found by claude-windows building it): a comment naming createAppHeader() passed this
    // before desk called anything. Line and block comments are cut first, so both the call and the leftovers are
    // looked for in code only (a comment recalling deskBarTop is no leftover).
    const s = a[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
    const uses = /createAppHeader\s*\(/.test(s);
    const left = [old, '--desk-bar-top', "getElementById('app-header')"].filter(function (k) { return s.indexOf(k) !== -1; });
    if (uses && !left.length) test.check(name + ' builds its header area with createAppHeader(), and its own measuring is gone');
    else test.fail(OWED + name + ': ' + short({ callsCreateAppHeader: uses, stillHas: left }));
  });
});

pending.catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () { test.reportSuccessFailureCount(); });
