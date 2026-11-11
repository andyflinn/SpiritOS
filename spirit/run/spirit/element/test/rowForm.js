'use strict';

// spirit/run/spirit/element/test/rowForm.js
// The tests of spirit/element/rowForm.js, and of no other module (spec: ./rowForm.md; goal/G41.27). Asked of a real browser,
// since its full width, its wrapping, its icon at the (top-) left and its button at the (bottom-) right are layout:
// ./rowForm-laid.html, on a scratch node with its DEBUG on, puts forms in containers of stated widths.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'rowForm.js');
const CSS = path.join(RUN, 'spirit', 'shell', 'shell.css');
const SEARCH = path.join(__dirname, '..', 'probabilitySearch.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const near = function (a, b, t) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (t || 1); };
const clear = function (c) { return c === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(String(c)); };

const ADDRESS = '/DEBUG/spirit/element/test/rowForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let one, wr, shared, css, rule, ps, tops, t1, t2, sp;
test.run('spirit/element/rowForm.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : 'there is no spirit/element/rowForm.js';
}, test.limit.quick);
test.run('the world: Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, test.limit.quick);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, test.limit.slow);
test.run('the world: the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return 'no Chrome or no scratch node: the world failed';
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return W.page.error;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) fs.rmSync(W.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
test.run('it adds rowForm.create(container, { icon, button }) to window.spirit.element', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // Andy, box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }: icon is the glyph, button the button's words."
  return (m.made) ? true : 'no window.spirit.element.spirit.element.rowForm.create';
}, test.limit.quick);
test.run('create answers { root, span, button }, the root drawn into the container it is given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  one = m.one || {};
  wr = m.wrapped || {};
  return (one.answered && one.appended) ? true : 'made: ' + short({ answered: one.answered, appended: one.appended });
}, test.limit.quick);
test.run('in 600px: it spans its container, edge to edge', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a block the full width of its container
  // "one row forms show as blocks taking up the full width of their container"
  return (near(one.root.left, one.container.left) && near(one.root.right, one.container.right)) ? true : 'root ' + short(one.root) + ', container ' + short(one.container);
}, test.limit.quick);
test.run('in 260px: it spans its container, edge to edge', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (near(wr.root.left, wr.container.left) && near(wr.root.right, wr.container.right)) ? true : 'root ' + short(wr.root) + ', container ' + short(wr.container);
}, test.limit.quick);
test.run('its background is transparent', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // a bubble: transparent, its border the type-face's colour
  // "they form a bubble with transparent background, and a border with the color of the type-face."
  return (clear(one.background)) ? true : 'background: ' + short(one.background);
}, test.limit.quick);
test.run('its border, all round, is the colour of its type-face', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (one.border.every(function (c) { return c === one.color; }) && one.borderWidth.every(function (w) { return parseFloat(w) > 0; })) ? true : 'border ' + short(one.border) + ' of ' + short(one.borderWidth) + ', colour ' + short(one.color);
}, test.limit.quick);
test.run('and rounded, a bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (parseFloat(one.radius) > 0) ? true : 'radius: ' + short(one.radius);
}, test.limit.quick);
test.run('its bubble and the search bubble of probabilitySearch carry one class, shell.css drawing it', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // "The bubble is one shared style, the same probabilitySearch's search bubble uses."
  shared = String(one.rootClass).split(/\s+/).filter(Boolean).filter(function (k) { return String(m.searchBubbleClass || '').split(/\s+/).indexOf(k) !== -1; });
  css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';
  rule = shared.map(function (k) { const r = new RegExp('\\.' + k.replace(/[-]/g, '\\-') + '\\s*\\{([^}]*)\\}'); const h = r.exec(css); return h ? h[1] : ''; }).filter(function (b) { return /currentColor/i.test(b) && /transparent/i.test(b); })[0];
  return (!!rule) ? true : 'form ' + short(one.rootClass) + ', search bubble ' + short(m.searchBubbleClass) + ', shared ' + short(shared);
}, test.limit.quick);
test.run('and probabilitySearch keeps no copy of the bubble\'s style of its own', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // SEARCH names spirit/element/probabilitySearch.js, gone since goal/G43.18 (the search is spirit/element/search.js): this
  // check reads nothing and passes whatever the search writes.
  // DISCREPANCY WITH ANDY's RULES: a check that judged nothing is red, never a green (goal/G41.28; Andy, on a check that
  // passed on nothing: "You fucking fudge tests to get away with total fucking sloppyness!"); this one is green on an
  // empty string.
  ps = fs.existsSync(SEARCH) ? fs.readFileSync(SEARCH, 'utf8').replace(/\/\/.*$/gm, '') : '';
  return (!/background\s*:\s*transparent/i.test(ps)) ? true : 'probabilitySearch.js still writes a transparent background';
}, test.limit.quick);
test.run('in one row: its first element is the icon element, the glyph it was given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // its icon first, at the (top-) left
  // "the first element is always an icon shell-element, and takes the (top-) left position in the one-row form"
  return (/\bshell-icon\b/.test(one.iconClass) && one.iconText === '🧾') ? true : 'first: ' + short([one.iconClass, one.iconText]);
}, test.limit.quick);
test.run('in one row: the icon at the top left inside the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!one.icon && near(one.icon.left, one.inner.left) && near(one.icon.top, one.inner.top, 4)) ? true : 'icon ' + short(one.icon) + ', inside ' + short(one.inner);
}, test.limit.quick);
test.run('wrapped: its first element is the icon element, the glyph it was given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (/\bshell-icon\b/.test(wr.iconClass) && wr.iconText === '🧾') ? true : 'first: ' + short([wr.iconClass, wr.iconText]);
}, test.limit.quick);
test.run('wrapped: the icon at the top left inside the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!wr.icon && near(wr.icon.left, wr.inner.left) && near(wr.icon.top, wr.inner.top, 4)) ? true : 'icon ' + short(wr.icon) + ', inside ' + short(wr.inner);
}, test.limit.quick);
test.run('in one row: its last element is a button with the words it was given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // its button last, at the (bottom-) right
  // "the last element is always a button that is positioned at the (bottom-) right for the form."
  return (one.last && one.buttonTag === 'BUTTON' && one.buttonText === 'Grant') ? true : 'last ' + one.last + ', ' + short([one.buttonTag, one.buttonText]);
}, test.limit.quick);
test.run('in one row: the button at the bottom right inside the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!one.button && near(one.button.right, one.inner.right) && near(one.button.bottom, one.inner.bottom, 4)) ? true : 'button ' + short(one.button) + ', inside ' + short(one.inner);
}, test.limit.quick);
test.run('wrapped: its last element is a button with the words it was given', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (wr.last && wr.buttonTag === 'BUTTON' && wr.buttonText === 'Grant') ? true : 'last ' + wr.last + ', ' + short([wr.buttonTag, wr.buttonText]);
}, test.limit.quick);
test.run('wrapped: the button at the bottom right inside the bubble', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!wr.button && near(wr.button.right, wr.inner.right) && near(wr.button.bottom, wr.inner.bottom, 4)) ? true : 'button ' + short(wr.button) + ', inside ' + short(wr.inner);
}, test.limit.quick);
test.run('its span stands between the icon and the button', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // the span between, which takes the form elements
  // "between the icon and the button is a span, into which the form elements can be dropped."
  return (one.spanInRoot && one.order) ? true : 'in root ' + one.spanInRoot + ', order ' + one.order;
}, test.limit.quick);
test.run('with room, the icon, its elements and the button stand on one row', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  tops = function (r) { return (r.inputs || []).map(function (i) { return i.top; }); };
  t1 = tops(one);
  return (t1.length === 2 && near(t1[0], t1[1]) && !!one.button && one.button.top < one.inputs[0].bottom && one.icon.top < one.inputs[0].bottom) ? true : 'icon ' + short(one.icon) + ', inputs ' + short(one.inputs) + ', button ' + short(one.button);
}, test.limit.quick);
test.run('four elements too wide for one row go onto more rows, the bubble growing', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // it wraps, when its elements have not the room
  // "and wrap, if it's form elements don't have enough space."
  t2 = tops(wr);
  return (t2.length === 4 && t2.some(function (t) { return !near(t, t2[0]); }) && wr.root.h > one.root.h) ? true : 'tops ' + short(t2) + ', heights ' + short([one.root.h, wr.root.h]);
}, test.limit.quick);
test.run('nothing stands past the bubble or the container', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return ((wr.inputs || []).every(function (i) { return i.right <= wr.inner.right + 0.5 && i.left >= wr.inner.left - 0.5; }) && wr.root.right <= wr.container.right + 0.5) ? true : 'inputs ' + short(wr.inputs) + ', inside ' + short(wr.inner);
}, test.limit.quick);
test.run('a press of the button, unwired, changes nothing in the form', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  // the press is the mounter's
  // "The mounter drops its form elements into span and wires the button itself (a busyButton or a click)."
  return (one.pressQuiet && wr.pressQuiet) ? true : 'changed: ' + short([one.pressQuiet, wr.pressQuiet]);
}, test.limit.quick);
test.run('its root carries 1em above it, its own margin', 0.2, async function () {
  if (!m) return 'nothing measured: the world failed';
  // goal/G43.15, Andy: "rowForms should carry their own upper 1em spacing, so when they're invisible, they space disappears with
  // them, especially since we're starting to have elements that self-hide if they're not applicable."
  // the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"
  sp = await W.page.evaluate('(function () { var c = document.createElement("div"); c.style.cssText = "width:400px;padding:0;border:0"; document.body.appendChild(c); var top = document.createElement("div"); top.style.height = "10px"; c.appendChild(top); var a = window.spirit.element.spirit.element.rowForm.create(c, { icon: "", button: "a" }); var b = window.spirit.element.spirit.element.rowForm.create(c, { icon: "", button: "b" }); var em = parseFloat(getComputedStyle(c).fontSize); var gap = function () { return b.root.getBoundingClientRect().top - a.root.getBoundingClientRect().bottom; }; var shown = { margin: parseFloat(getComputedStyle(a.root).marginTop), gap: gap(), height: c.getBoundingClientRect().height }; a.root.hidden = true; var gone = { height: c.getBoundingClientRect().height, bTop: b.root.getBoundingClientRect().top - top.getBoundingClientRect().bottom }; return JSON.stringify({ em: em, shown: shown, gone: gone, aHeight: shown.height }); }())').then(JSON.parse).catch(function () { return null; });
  return (!!sp && near(sp.shown.margin, sp.em)) ? true : 'margin-top ' + short(sp && sp.shown.margin) + ', 1em ' + short(sp && sp.em);
}, test.limit.quick);
test.run('so two forms one under the other stand 1em apart', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!sp && near(sp.shown.gap, sp.em)) ? true : 'the gap ' + short(sp && sp.shown.gap) + ', 1em ' + short(sp && sp.em);
}, test.limit.quick);
test.run('hidden, a form takes its 1em with it: the next one stands 1em below what is above', 0.2, function () {
  if (!m) return 'nothing measured: the world failed';
  return (!!sp && near(sp.gone.bTop, sp.em) && sp.gone.height < sp.shown.height - sp.em) ? true : 'with the first hidden: ' + short(sp && sp.gone);
}, test.limit.quick);
