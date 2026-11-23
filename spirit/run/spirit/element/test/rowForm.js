'use strict';

// spirit/run/spirit/element/test/rowForm.js
// The tests of spirit/element/rowForm.js, and of no other module (spec: ./rowForm.md; goal/G41.27). Asked of a real browser,
// since its full width, its wrapping, its icon at the (top-) left and its button at the (bottom-) right are layout:
// ./rowForm-laid.html, on a scratch node with its DEBUG on, puts forms in containers of stated widths.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const H = LOADER.requireScript('spirit/test/headLessChrome.js');
const FILE = path.join(__dirname, '..', 'rowForm.js');
const CSS = path.join(RUN, 'spirit', 'shell', 'shell.css');
const SEARCH = path.join(__dirname, '..', 'probabilitySearch.js');

const near = function (a, b, t) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (t || 1); };
const clear = function (c) { return c === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(String(c)); };

const ADDRESS = '/DEBUG/spirit/element/test/rowForm-laid.html';
// A scratch node with its DEBUG on, a Chrome page on it, and what the page measured (m).
const W = {};
let m = null;
// What the tests make, shared by the tests after them.
let one, wr, shared, css, rule, ps, tops, t1, t2, sp;
test.run('spirit/element/rowForm.js exists', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on', 0.2, async function () {
  W.node = await H.scratchNode();
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('the page lays out its forms', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + ADDRESS });
  await H.until(function () { return W.page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const s = await W.page.evaluate('window.laid()').catch(function () { return ''; });
  try { m = JSON.parse(s); } catch (e) { m = null; }
  return !!m || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(W.node); } catch (e) { /* left */ }
});
test.run('it adds rowForm.create, taking a container, an icon and a button, to window.spirit.required', 0.2, function () {
  if (!m) return false;
  // Andy, box: "spirit.element.spirit.element.rowForm.create(container, { icon, button }) -> { root, span, button }: icon is the glyph, button the button's words."
  return (m.made) ? true : false;
}, test.limit.quick);
test.run('create answers its root, span and button, the root drawn into the container it is given', 0.2, function () {
  if (!m) return false;
  one = m.one || {};
  wr = m.wrapped || {};
  return (one.answered && one.appended) ? true : false;
}, test.limit.quick);
test.run('in a container 600px wide it spans the container edge to edge', 0.2, function () {
  if (!m) return false;
  // a block the full width of its container
  // "one row forms show as blocks taking up the full width of their container"
  return (near(one.root.left, one.container.left) && near(one.root.right, one.container.right)) ? true : false;
}, test.limit.quick);
test.run('in a container 260px wide it spans the container edge to edge', 0.2, function () {
  if (!m) return false;
  return (near(wr.root.left, wr.container.left) && near(wr.root.right, wr.container.right)) ? true : false;
}, test.limit.quick);
test.run('its background is transparent', 0.2, function () {
  if (!m) return false;
  // a bubble: transparent, its border the type-face's colour
  // "they form a bubble with transparent background, and a border with the color of the type-face."
  return (clear(one.background)) ? true : false;
}, test.limit.quick);
test.run('its border, all round, is the colour of its type-face', 0.2, function () {
  if (!m) return false;
  return (one.border.every(function (c) { return c === one.color; }) && one.borderWidth.every(function (w) { return parseFloat(w) > 0; })) ? true : false;
}, test.limit.quick);
test.run('its border is rounded, a bubble', 0.2, function () {
  if (!m) return false;
  return (parseFloat(one.radius) > 0) ? true : false;
}, test.limit.quick);
test.run('its bubble and the search bubble of probabilitySearch carry one class, shell.css drawing it', 0.2, function () {
  if (!m) return false;
  // "The bubble is one shared style, the same probabilitySearch's search bubble uses."
  shared = String(one.rootClass).split(/\s+/).filter(Boolean).filter(function (k) { return String(m.searchBubbleClass || '').split(/\s+/).indexOf(k) !== -1; });
  css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';
  rule = shared.map(function (k) { const r = new RegExp('\\.' + k.replace(/[-]/g, '\\-') + '\\s*\\{([^}]*)\\}'); const h = r.exec(css); return h ? h[1] : ''; }).filter(function (b) { return /currentColor/i.test(b) && /transparent/i.test(b); })[0];
  return (!!rule) ? true : false;
}, test.limit.quick);
test.run('probabilitySearch keeps no copy of the bubble\'s style of its own', 0.2, function () {
  if (!m) return false;
  // SEARCH names spirit/element/probabilitySearch.js, gone since goal/G43.18 (the search is spirit/element/search.js): this
  // check reads nothing and passes whatever the search writes.
  // DISCREPANCY WITH ANDY's RULES: a check that judged nothing is red, never a green (goal/G41.28; Andy, on a check that
  // passed on nothing: "You fucking fudge tests to get away with total fucking sloppyness!"); this one is green on an
  // empty string.
  ps = fs.existsSync(SEARCH) ? fs.readFileSync(SEARCH, 'utf8').replace(/\/\/.*$/gm, '') : '';
  return (!/background\s*:\s*transparent/i.test(ps)) ? true : false;
}, test.limit.quick);
test.run('in one row, its first element is the icon element showing the glyph it was given', 0.2, function () {
  if (!m) return false;
  // its icon first, at the (top-) left
  // "the first element is always an icon shell-element, and takes the (top-) left position in the one-row form"
  return (/\bshell-icon\b/.test(one.iconClass) && one.iconText === '🧾') ? true : false;
}, test.limit.quick);
test.run('in one row, the icon stands at the top left inside the bubble', 0.2, function () {
  if (!m) return false;
  return (!!one.icon && near(one.icon.left, one.inner.left) && near(one.icon.top, one.inner.top, 4)) ? true : false;
}, test.limit.quick);
test.run('wrapped, its first element is the icon element showing the glyph it was given', 0.2, function () {
  if (!m) return false;
  return (/\bshell-icon\b/.test(wr.iconClass) && wr.iconText === '🧾') ? true : false;
}, test.limit.quick);
test.run('wrapped, the icon stands at the top left inside the bubble', 0.2, function () {
  if (!m) return false;
  return (!!wr.icon && near(wr.icon.left, wr.inner.left) && near(wr.icon.top, wr.inner.top, 4)) ? true : false;
}, test.limit.quick);
test.run('in one row, its last element is a button with the words it was given', 0.2, function () {
  if (!m) return false;
  // its button last, at the (bottom-) right
  // "the last element is always a button that is positioned at the (bottom-) right for the form."
  return (one.last && one.buttonTag === 'BUTTON' && one.buttonText === 'Grant') ? true : false;
}, test.limit.quick);
test.run('in one row, the button stands at the bottom right inside the bubble', 0.2, function () {
  if (!m) return false;
  return (!!one.button && near(one.button.right, one.inner.right) && near(one.button.bottom, one.inner.bottom, 4)) ? true : false;
}, test.limit.quick);
test.run('wrapped, its last element is a button with the words it was given', 0.2, function () {
  if (!m) return false;
  return (wr.last && wr.buttonTag === 'BUTTON' && wr.buttonText === 'Grant') ? true : false;
}, test.limit.quick);
test.run('wrapped, the button stands at the bottom right inside the bubble', 0.2, function () {
  if (!m) return false;
  return (!!wr.button && near(wr.button.right, wr.inner.right) && near(wr.button.bottom, wr.inner.bottom, 4)) ? true : false;
}, test.limit.quick);
test.run('its span stands between the icon and the button', 0.2, function () {
  if (!m) return false;
  // the span between, which takes the form elements
  // "between the icon and the button is a span, into which the form elements can be dropped."
  return (one.spanInRoot && one.order) ? true : false;
}, test.limit.quick);
test.run('with room, the icon, its elements and the button stand on one row', 0.2, function () {
  if (!m) return false;
  tops = function (r) { return (r.inputs || []).map(function (i) { return i.top; }); };
  t1 = tops(one);
  return (t1.length === 2 && near(t1[0], t1[1]) && !!one.button && one.button.top < one.inputs[0].bottom && one.icon.top < one.inputs[0].bottom) ? true : false;
}, test.limit.quick);
test.run('four elements too wide for one row go onto more rows, the bubble growing', 0.2, function () {
  if (!m) return false;
  // it wraps, when its elements have not the room
  // "and wrap, if it's form elements don't have enough space."
  t2 = tops(wr);
  return (t2.length === 4 && t2.some(function (t) { return !near(t, t2[0]); }) && wr.root.h > one.root.h) ? true : false;
}, test.limit.quick);
test.run('nothing stands past the bubble or the container', 0.2, function () {
  if (!m) return false;
  return ((wr.inputs || []).every(function (i) { return i.right <= wr.inner.right + 0.5 && i.left >= wr.inner.left - 0.5; }) && wr.root.right <= wr.container.right + 0.5) ? true : false;
}, test.limit.quick);
test.run('with no press given, a press of its button sends nothing and leaves the form as it was once the button settles', 0.2, function () {
  if (!m) return false;
  return (one.pressQuiet && wr.pressQuiet) ? true : false;
}, test.limit.quick);
// goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer comes".
test.run('given a press, a press of its button calls it and marks the button busy until its answer comes', 0.4, function () {
  if (!m) return false;
  return (m.pressCalled === true && m.busyWhilePress === true && m.stillBusy === true) ? true : false;
}, test.limit.quick);
test.run('once the answer of press comes, its button is a plain button again', 0.4, function () {
  if (!m) return false;
  return m.plainAfter === true ? true : false;
}, test.limit.quick);
test.run('its root carries 1em above it, its own margin', 0.2, async function () {
  if (!m) return false;
  // goal/G43.15, Andy: "rowForms should carry their own upper 1em spacing, so when they're invisible, they space disappears with
  // them, especially since we're starting to have elements that self-hide if they're not applicable."
  // the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"
  sp = await W.page.evaluate('(function () { var c = document.createElement("div"); c.style.cssText = "width:400px;padding:0;border:0"; document.body.appendChild(c); var top = document.createElement("div"); top.style.height = "10px"; c.appendChild(top); var a = window.spirit.required.spirit.element.rowForm.create(c, { icon: "", button: "a" }); var b = window.spirit.required.spirit.element.rowForm.create(c, { icon: "", button: "b" }); var em = parseFloat(getComputedStyle(c).fontSize); var gap = function () { return b.root.getBoundingClientRect().top - a.root.getBoundingClientRect().bottom; }; var shown = { margin: parseFloat(getComputedStyle(a.root).marginTop), gap: gap(), height: c.getBoundingClientRect().height }; a.root.hidden = true; var gone = { height: c.getBoundingClientRect().height, bTop: b.root.getBoundingClientRect().top - top.getBoundingClientRect().bottom }; return JSON.stringify({ em: em, shown: shown, gone: gone, aHeight: shown.height }); }())').then(JSON.parse).catch(function () { return null; });
  return (!!sp && near(sp.shown.margin, sp.em)) ? true : false;
}, test.limit.quick);
test.run('two forms one under the other stand 1em apart', 0.2, function () {
  if (!m) return false;
  return (!!sp && near(sp.shown.gap, sp.em)) ? true : false;
}, test.limit.quick);
test.run('a hidden form takes its 1em with it, so the next one stands 1em below what is above', 0.2, function () {
  if (!m) return false;
  return (!!sp && near(sp.gone.bTop, sp.em) && sp.gone.height < sp.shown.height - sp.em) ? true : false;
}, test.limit.quick);
// A FIELD ROW (goal/G47.4; Andy: "✏️ (pinned to left edge) \"text\" [INPUT] [change button] where the input gets any spare
// space before the change button..."): in a 600px form, the words, then a text input, then the button; the input reaches
// from the words to the button, one gap from each.
test.run('in a field row the text input takes the spare space between its words and the button', 0.2, async function () {
  if (!m) return false;
  const f = await W.page.evaluate('(function () { var c = document.createElement("div"); c.style.cssText = "width:600px;padding:0;border:0"; document.body.appendChild(c); var r = window.spirit.required.spirit.element.rowForm.create(c, { icon: "✏️", button: "Change" }); var w = document.createElement("span"); w.textContent = "Title"; var i = document.createElement("input"); i.type = "text"; r.span.appendChild(w); r.span.appendChild(i); var em = parseFloat(getComputedStyle(r.span).fontSize); var g = function (e) { return e.getBoundingClientRect(); }; return JSON.stringify({ em: em, words: g(w), input: g(i), span: g(r.span), button: g(r.button) }); }())').then(JSON.parse).catch(function () { return null; });
  if (!f) return false;
  return (near(f.input.right, f.span.right) && near(f.input.left - f.words.right, f.em) && f.input.top < f.words.bottom && f.input.width > 300) ? true : false;
}, test.limit.quick);
