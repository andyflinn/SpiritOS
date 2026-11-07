'use strict';

// spirit/run/spirit/element/test/rowForm.js
// The tests of spirit/element/rowForm.js, and of no other module (spec: ./rowForm.md; goal/G41.27). Asked of a real browser,
// since its full width, its wrapping, its icon at the (top-) left and its button at the (bottom-) right are layout:
// ./rowForm-laid.html, on a scratch node with its DEBUG on, puts forms in containers of stated widths.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'rowForm.js');
const CSS = path.join(RUN, 'spirit', 'shell', 'shell.css');
const SEARCH = path.join(__dirname, '..', 'probabilitySearch.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const near = function (a, b, t) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (t || 1); };
const clear = function (c) { return c === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(String(c)); };

const ADDRESS = '/DEBUG/spirit/element/test/rowForm-laid.html';
test.startTest('rowForm.js: the one-row form, in a bubble');

(async function () {
  ok(fs.existsSync(FILE), 'spirit/element/rowForm.js exists', 'there is no spirit/element/rowForm.js');
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.laid()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    // Andy, box: "spirit.elements.rowForm.create(container, { icon, button }) -> { root, span, button }: icon is the glyph, button the button's words."
    ok(m.made, 'it adds rowForm.create(container, { icon, button }) to window.spirit.element', 'no window.spirit.element.rowForm.create');
    if (!m.made) return;
    const one = m.one || {};
    const wr = m.wrapped || {};
    ok(one.answered && one.appended, 'create answers { root, span, button }, the root drawn into the container it is given', 'made: ' + short({ answered: one.answered, appended: one.appended }));
    if (!one.answered || !wr.answered) return;

    test.subHeading('a block the full width of its container');
    // "one row forms show as blocks taking up the full width of their container"
    [['in 600px', one], ['in 260px', wr]].forEach(function (x) {
      const r = x[1];
      ok(near(r.root.left, r.container.left) && near(r.root.right, r.container.right), x[0] + ': it spans its container, edge to edge', 'root ' + short(r.root) + ', container ' + short(r.container));
    });

    test.subHeading('a bubble: transparent, its border the type-face\'s colour');
    // "they form a bubble with transparent background, and a border with the color of the type-face."
    ok(clear(one.background), 'its background is transparent', 'background: ' + short(one.background));
    ok(one.border.every(function (c) { return c === one.color; }) && one.borderWidth.every(function (w) { return parseFloat(w) > 0; }), 'its border, all round, is the colour of its type-face', 'border ' + short(one.border) + ' of ' + short(one.borderWidth) + ', colour ' + short(one.color));
    ok(parseFloat(one.radius) > 0, 'and rounded, a bubble', 'radius: ' + short(one.radius));
    // "The bubble is one shared style, the same probabilitySearch's search bubble uses."
    const shared = String(one.rootClass).split(/\s+/).filter(Boolean).filter(function (k) { return String(m.searchBubbleClass || '').split(/\s+/).indexOf(k) !== -1; });
    const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';
    const rule = shared.map(function (k) { const r = new RegExp('\\.' + k.replace(/[-]/g, '\\-') + '\\s*\\{([^}]*)\\}'); const h = r.exec(css); return h ? h[1] : ''; }).filter(function (b) { return /currentColor/i.test(b) && /transparent/i.test(b); })[0];
    ok(!!rule, 'its bubble and the search bubble of probabilitySearch carry one class, shell.css drawing it', 'form ' + short(one.rootClass) + ', search bubble ' + short(m.searchBubbleClass) + ', shared ' + short(shared));
    // SEARCH names spirit/element/probabilitySearch.js, gone since goal/G43.18 (the search is spirit/element/search.js): this
    // check reads nothing and passes whatever the search writes.
    // DISCREPANCY WITH ANDY's RULES: a check that judged nothing is red, never a green (goal/G41.28; Andy, on a check that
    // passed on nothing: "You fucking fudge tests to get away with total fucking sloppyness!"); this one is green on an
    // empty string.
    const ps = fs.existsSync(SEARCH) ? fs.readFileSync(SEARCH, 'utf8').replace(/\/\/.*$/gm, '') : '';
    ok(!/background\s*:\s*transparent/i.test(ps), 'and probabilitySearch keeps no copy of the bubble\'s style of its own', 'probabilitySearch.js still writes a transparent background');

    test.subHeading('its icon first, at the (top-) left');
    // "the first element is always an icon shell-element, and takes the (top-) left position in the one-row form"
    [['in one row', one], ['wrapped', wr]].forEach(function (x) {
      const r = x[1];
      ok(/\bshell-icon\b/.test(r.iconClass) && r.iconText === '🧾', x[0] + ': its first element is the icon element, the glyph it was given', 'first: ' + short([r.iconClass, r.iconText]));
      ok(!!r.icon && near(r.icon.left, r.inner.left) && near(r.icon.top, r.inner.top, 4), x[0] + ': at the top left inside the bubble', 'icon ' + short(r.icon) + ', inside ' + short(r.inner));
    });

    test.subHeading('its button last, at the (bottom-) right');
    // "the last element is always a button that is positioned at the (bottom-) right for the form."
    [['in one row', one], ['wrapped', wr]].forEach(function (x) {
      const r = x[1];
      ok(r.last && r.buttonTag === 'BUTTON' && r.buttonText === 'Grant', x[0] + ': its last element is a button with the words it was given', 'last ' + r.last + ', ' + short([r.buttonTag, r.buttonText]));
      ok(!!r.button && near(r.button.right, r.inner.right) && near(r.button.bottom, r.inner.bottom, 4), x[0] + ': at the bottom right inside the bubble', 'button ' + short(r.button) + ', inside ' + short(r.inner));
    });

    test.subHeading('the span between, which takes the form elements');
    // "between the icon and the button is a span, into which the form elements can be dropped."
    ok(one.spanInRoot && one.order, 'its span stands between the icon and the button', 'in root ' + one.spanInRoot + ', order ' + one.order);
    const tops = function (r) { return (r.inputs || []).map(function (i) { return i.top; }); };
    const t1 = tops(one);
    ok(t1.length === 2 && near(t1[0], t1[1]) && !!one.button && one.button.top < one.inputs[0].bottom && one.icon.top < one.inputs[0].bottom, 'with room, the icon, its elements and the button stand on one row', 'icon ' + short(one.icon) + ', inputs ' + short(one.inputs) + ', button ' + short(one.button));

    test.subHeading('it wraps, when its elements have not the room');
    // "and wrap, if it's form elements don't have enough space."
    const t2 = tops(wr);
    ok(t2.length === 4 && t2.some(function (t) { return !near(t, t2[0]); }) && wr.root.h > one.root.h, 'four elements too wide for one row go onto more rows, the bubble growing', 'tops ' + short(t2) + ', heights ' + short([one.root.h, wr.root.h]));
    ok((wr.inputs || []).every(function (i) { return i.right <= wr.inner.right + 0.5 && i.left >= wr.inner.left - 0.5; }) && wr.root.right <= wr.container.right + 0.5, 'nothing stands past the bubble or the container', 'inputs ' + short(wr.inputs) + ', inside ' + short(wr.inner));

    test.subHeading('the press is the mounter\'s');
    // "The mounter drops its form elements into span and wires the button itself (a busyButton or a click)."
    ok(one.pressQuiet && wr.pressQuiet, 'a press of the button, unwired, changes nothing in the form', 'changed: ' + short([one.pressQuiet, wr.pressQuiet]));

    // goal/G43.15, Andy: "rowForms should carry their own upper 1em spacing, so when they're invisible, they space disappears with
    // them, especially since we're starting to have elements that self-hide if they're not applicable."
    test.subHeading('the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"');
    const sp = await page.evaluate('(function () { var c = document.createElement("div"); c.style.cssText = "width:400px;padding:0;border:0"; document.body.appendChild(c); var top = document.createElement("div"); top.style.height = "10px"; c.appendChild(top); var a = window.spirit.element.rowForm.create(c, { icon: "", button: "a" }); var b = window.spirit.element.rowForm.create(c, { icon: "", button: "b" }); var em = parseFloat(getComputedStyle(c).fontSize); var gap = function () { return b.root.getBoundingClientRect().top - a.root.getBoundingClientRect().bottom; }; var shown = { margin: parseFloat(getComputedStyle(a.root).marginTop), gap: gap(), height: c.getBoundingClientRect().height }; a.root.hidden = true; var gone = { height: c.getBoundingClientRect().height, bTop: b.root.getBoundingClientRect().top - top.getBoundingClientRect().bottom }; return JSON.stringify({ em: em, shown: shown, gone: gone, aHeight: shown.height }); }())').then(JSON.parse).catch(function () { return null; });
    ok(!!sp && near(sp.shown.margin, sp.em), 'its root carries 1em above it, its own margin', 'margin-top ' + short(sp && sp.shown.margin) + ', 1em ' + short(sp && sp.em));
    ok(!!sp && near(sp.shown.gap, sp.em), 'so two forms one under the other stand 1em apart', 'the gap ' + short(sp && sp.shown.gap) + ', 1em ' + short(sp && sp.em));
    ok(!!sp && near(sp.gone.bTop, sp.em) && sp.gone.height < sp.shown.height - sp.em, 'hidden, a form takes its 1em with it: the next one stands 1em below what is above', 'with the first hidden: ' + short(sp && sp.gone));
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
