'use strict';

// spirit/run/shell/js/test/workBench.js
// The tests of shell/js/workBench.js, and of no other module (spec: ./workBench.md; goal/G41.1, goal/G41.18). The browser file runs
// in node on a window of its own; the container is a stub that keeps a node per id it draws and hears its listeners,
// and the document a stub that hears the moves of a drag.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'workBench.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
const docHeard = {};
function node(id) {
  const n = { id: id || '', hidden: false, hiddenAttr: false, style: {}, innerHTML: '', children: [], className: '',
    appendChild: function (c) { n.children.push(c); c.parent = n; return c; },
    setAttribute: function (k, v) { if (k === 'hidden') n.hidden = true; n['attr_' + k] = String(v); },
    removeAttribute: function (k) { if (k === 'hidden') { n.hidden = false; n.hiddenAttr = false; } delete n['attr_' + k]; },
    getAttribute: function (k) { return n['attr_' + k] == null ? null : n['attr_' + k]; },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, closest: function () { return null; },
    get offsetWidth() { return parseInt(n.style.width, 10) || 0; } };
  return n;
}
global.document = {
  addEventListener: function (type, fn) { (docHeard[type] = docHeard[type] || []).push(fn); },
  removeEventListener: function (type, fn) { const l = docHeard[type] || []; const i = l.indexOf(fn); if (i !== -1) l.splice(i, 1); },
  createElement: function () { return node(''); },
};
function docFire(type, e) { (docHeard[type] || []).slice().forEach(function (fn) { fn(e); }); }
function container() {
  const nodes = {}; const heard = {}; let html = ''; let listeners = 0;
  const c = {
    nodes: nodes, style: {}, className: '',
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const re = /<[^>]*\bid="([^"]+)"[^>]*>/g; let m;
      while ((m = re.exec(html))) { const n = nodes[m[1]] = nodes[m[1]] || node(m[1]); n.hiddenAttr = /\shidden(\s|>|=|\/)/.test(m[0]); }
    },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? nodes[sel.slice(1)] || null : null; },
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); listeners += 1; },
    removeEventListener: function (type, fn) { const l = heard[type] || []; const i = l.indexOf(fn); if (i !== -1) { l.splice(i, 1); listeners -= 1; } },
    appendChild: function (ch) { return ch; },
    listenerCount: function () { return listeners; },
    heardTypes: function () { return Object.keys(heard).filter(function (t) { return heard[t].length; }); },
    perType: function () { return Object.keys(heard).every(function (t) { return heard[t].length <= 1; }); },
    fire: function (type, e) { (heard[type] || []).slice().forEach(function (fn) { fn(e); }); },
    part: function (name) { const k = Object.keys(nodes).filter(function (id) { return id.slice(-name.length) === name; })[0]; return k ? nodes[k] : null; },
    order: function () { const out = []; const re = /\bid="([^"]+)"/g; let m; while ((m = re.exec(html))) out.push(m[1]); return out; },
  };
  return c;
}
// A click on a strip button, as the browser hands it: its target answers closest() with the button.
function clickOn(side, name) {
  const button = { getAttribute: function (k) { return k === 'data-side' ? side : k === 'data-tool' ? name : null }, dataset: { side: side, tool: name } };
  return { target: { closest: function (sel) { return /data-tool|data-side|button/.test(sel) ? button : null; }, getAttribute: button.getAttribute, dataset: button.dataset },
    preventDefault: function () {}, stopPropagation: function () {} };
}
function onBorder(side, x) {
  const border = { getAttribute: function (k) { return k === 'data-border' ? side : null; }, dataset: { border: side } };
  return { clientX: x, target: { closest: function (sel) { return /data-border/.test(sel) ? border : null; }, getAttribute: border.getAttribute, dataset: border.dataset },
    preventDefault: function () {}, stopPropagation: function () {}, pointerId: 1 };
}
const hiddenNow = function (n) { return !!n && (n.hidden === true || n.hiddenAttr === true || n.style.display === 'none'); };

test.startTest('workBench.js: three panes, two icon strips');

if (!fs.existsSync(FILE)) {
  test.fail('shell/js/workBench.js is not there');
  test.reportSuccessFailureCount();
  process.exit(0);
}
global.window = { spirit: { elements: {} } };
let loadError = null;
try { vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE }); } catch (e) { loadError = e; }
const W = window.spirit.elements.workBench;
ok(!loadError && W && typeof W.create === 'function', 'it loads on window.spirit.elements.workBench with create',
  'loading: ' + (loadError ? loadError.message : 'no window.spirit.elements.workBench.create'));
if (!W || typeof W.create !== 'function') { test.reportSuccessFailureCount(); process.exit(0); }

const mounted = [];
function tool(name) { return { name: name, icon: 'I' + name, title: 'T' + name, mount: function (box) { mounted.push({ name: name, box: box }); } }; }

test.subHeading('the parts, in order, in a box it does not size');
const c1 = container();
const wb = W.create(c1, { left: [tool('a'), tool('b')], right: [tool('x')] });
const ids = c1.order();
const want = ['strip-left', 'pane-left', 'border-left', 'center', 'border-right', 'pane-right', 'strip-right'];
const at = want.map(function (n) { return ids.findIndex(function (id) { return id.slice(-n.length) === n; }); });
ok(at.every(function (i) { return i !== -1; }) && at.every(function (i, k) { return k === 0 || i > at[k - 1]; }),
  'it draws the strips, panes, borders and centre, in order', 'parts in order: ' + JSON.stringify(ids));
const prefixes = want.map(function (n) { const id = ids.find(function (x) { return x.slice(-n.length) === n; }) || ''; return id.slice(0, id.length - n.length); });
ok(prefixes.every(function (p) { return p === prefixes[0]; }) && prefixes[0] !== '', 'every part\'s id starts with the same prefix of its own element',
  'prefixes: ' + JSON.stringify(prefixes));
const c1b = container(); W.create(c1b, { left: [tool('second')], right: [] });
ok(c1b.order()[0] !== ids[0], 'two workbenches never share a prefix', 'the second drew ' + JSON.stringify(c1b.order()[0]));
ok(/class="[^"]*\bfill\b/.test(c1.innerHTML) && !c1.style.width && !c1.style.height && !c1.style.flex,
  'its root takes the shell\'s fill class, and it sets no size on the container it is given', 'root: ' + c1.innerHTML.slice(0, 200) + ' style ' + JSON.stringify(c1.style));
ok(wb && typeof wb.center === 'object' && wb.center !== null && wb.center === c1.part('center'), 'center is the centre pane\'s box',
  'center: ' + typeof (wb && wb.center));

test.subHeading('every box from the app to a tool states its size (rule/16; goal/G41.18)');
// Andy, on G41.18, with many model rows: "the lists violate: rule/16 — A list gets a box of a stated size. Files and
// contacts do it right, agents must as well." rule/16: every list stands in a box of class fill, inside a pane that fills
// its app. A side pane that is not one lets its tool grow with its rows, and the whole pane scrolls with it.
const tagOf = function (c, name) { const m = new RegExp('<[^>]*\\bid="[^"]*' + name + '"[^>]*>').exec(c.innerHTML); return m ? m[0] : ''; };
ok(/class="[^"]*\bfill\b/.test(tagOf(c1, 'pane-left')) && /class="[^"]*\bfill\b/.test(tagOf(c1, 'pane-right')), 'each side pane is a fill box', 'panes: ' + tagOf(c1, 'pane-left') + ' ' + tagOf(c1, 'pane-right'));
ok(/class="[^"]*\bfill\b/.test(tagOf(c1, 'center')), 'and so is the centre', 'centre: ' + tagOf(c1, 'center'));
// Andy: "fix workBench for all 3 panes AND the icon strips"; "ALL lists, otherwise my took bars at the top of a container
// keep scrolling away....". A strip of many tools scrolls inside its own height, never the app's.
ok(/class="[^"]*\bfill\b/.test(tagOf(c1, 'strip-left')) && /class="[^"]*\bfill\b/.test(tagOf(c1, 'strip-right')), 'and so is each icon strip', 'strips: ' + tagOf(c1, 'strip-left') + ' ' + tagOf(c1, 'strip-right'));
ok(['strip-left', 'pane-left', 'center', 'pane-right', 'strip-right'].every(function (n) { return /overflow(-y)?:auto/.test(tagOf(c1, n)); }),
  'each of the five scrolls inside its own height (overflow auto), so what stands above a list in a pane stays put', 'parts: ' + ['strip-left', 'pane-left', 'center', 'pane-right', 'strip-right'].map(function (n) { return tagOf(c1, n); }).join(' '));
const boxA = mounted.filter(function (m) { return m.name === 'a'; })[0];
ok(boxA && (' ' + boxA.box.className + ' ').indexOf(' fill ') !== -1, 'the box a tool is mounted in is a fill box, given before its mount', 'tool box class: ' + JSON.stringify(boxA && boxA.box.className));

test.subHeading('the strips: a button per tool');
const left = (c1.innerHTML.match(/data-tool="[^"]*"/g) || []).map(function (s) { return s.slice(11, -1); });
ok(JSON.stringify(left) === '["a","b","x"]' && /data-side="left"/.test(c1.innerHTML) && /data-side="right"/.test(c1.innerHTML),
  'each strip has one button per tool, with its side and its name', 'buttons: ' + JSON.stringify(left));
ok(/Ia/.test(c1.innerHTML) && /title="Ta"/.test(c1.innerHTML) && /Ix/.test(c1.innerHTML), 'each button wears the tool\'s icon and title',
  'icons and titles missing: ' + c1.innerHTML.slice(0, 300));
const c2 = container();
W.create(c2, { left: [tool('only')], right: [] });
ok(!c2.part('strip-right') && !c2.part('pane-right') && !c2.part('border-right') && !!c2.part('strip-left'),
  'a side with no tools draws no strip, no pane and no border', 'right side drawn: ' + JSON.stringify(c2.order()));

test.subHeading('at start, and showing a tool');
ok(wb.shown('left') === 'a' && wb.shown('right') === 'x', 'at start each side shows its first tool', 'shown: ' + wb.shown('left') + ' / ' + wb.shown('right'));
const mountsA = mounted.filter(function (m) { return m.name === 'a'; });
ok(mountsA.length === 1 && mountsA[0].box && typeof mountsA[0].box === 'object', 'a tool shown is mounted once, into a box of its own',
  'mounts of a: ' + mountsA.length);
ok(!mounted.some(function (m) { return m.name === 'b'; }), 'a tool not yet shown is not mounted', 'b was mounted before it showed');
wb.press('left', 'b');
ok(wb.shown('left') === 'b' && mounted.filter(function (m) { return m.name === 'b'; }).length === 1, 'pressing another tool\'s icon shows that tool and mounts it',
  'after pressing b: ' + wb.shown('left'));
const boxB = mounted.filter(function (m) { return m.name === 'b'; })[0];
ok(boxB && boxB.box !== mountsA[0].box, 'each tool has its own box', 'a and b share a box');
wb.press('left', 'a');
ok(wb.shown('left') === 'a' && mounted.filter(function (m) { return m.name === 'a'; }).length === 1, 'a tool shown again is not mounted again: its box is kept',
  'mounts of a: ' + mounted.filter(function (m) { return m.name === 'a'; }).length);

test.subHeading('collapsing');
wb.press('left', 'a');
ok(wb.shown('left') === '' && hiddenNow(c1.part('pane-left')), 'pressing the icon of the tool shown collapses its side: the pane is hidden',
  'after pressing a again: shown ' + JSON.stringify(wb.shown('left')) + ', pane ' + JSON.stringify(c1.part('pane-left') && { hidden: c1.part('pane-left').hidden, attr: c1.part('pane-left').hiddenAttr, style: c1.part('pane-left').style }));
ok(wb.shown('right') === 'x' && !hiddenNow(c1.part('pane-right')), 'a press on the left never changes the right', 'right after: ' + wb.shown('right'));
wb.press('left', 'b');
ok(wb.shown('left') === 'b' && !hiddenNow(c1.part('pane-left')), 'pressing any icon while collapsed shows that tool', 'after: ' + wb.shown('left'));
wb.press('left', 'nosuch');
ok(wb.shown('left') === 'b', 'a press naming no tool of that side changes nothing', 'after nosuch: ' + wb.shown('left'));
wb.press('right', 'b');
ok(wb.shown('right') === 'x' && wb.shown('left') === 'b', 'a press naming a tool of the other side changes nothing', 'after right/b: ' + wb.shown('right'));

test.subHeading('its listeners: on its container, a click presses');
ok(c1.perType() && c1.heardTypes().indexOf('click') !== -1, 'it listens on its container, one listener per event type', 'listeners: ' + JSON.stringify(c1.heardTypes()));
c1.fire('click', clickOn('right', 'x'));
ok(wb.shown('right') === '', 'a click on a strip button presses it', 'right after a click on x: ' + JSON.stringify(wb.shown('right')));
c1.fire('click', clickOn('right', 'x'));
ok(wb.shown('right') === 'x', 'a second click shows it again', 'right: ' + JSON.stringify(wb.shown('right')));

test.subHeading('the movable borders');
const w0 = wb.width('left');
ok(typeof w0 === 'number' && w0 >= 120, 'a side pane has a width of at least 120 pixels', 'left width: ' + w0);
c1.fire('pointerdown', onBorder('left', 300));
docFire('pointermove', { clientX: 350, preventDefault: function () {} });
ok(wb.width('left') === w0 + 50, 'dragging the left border to the right widens the left pane by the distance moved', 'left: ' + w0 + ' -> ' + wb.width('left'));
docFire('pointermove', { clientX: 300 - w0 - 500, preventDefault: function () {} });
ok(wb.width('left') === 120, 'never below 120 pixels', 'left after a long drag back: ' + wb.width('left'));
docFire('pointerup', { clientX: 0 });
const settled = wb.width('left');
docFire('pointermove', { clientX: 900, preventDefault: function () {} });
ok(wb.width('left') === settled, 'after the pointer is up, a move changes nothing', 'left moved after pointerup: ' + settled + ' -> ' + wb.width('left'));
const r0 = wb.width('right');
c1.fire('pointerdown', onBorder('right', 800));
docFire('pointermove', { clientX: 760, preventDefault: function () {} });
docFire('pointerup', { clientX: 760 });
ok(wb.width('right') === r0 + 40 && wb.width('left') === settled, 'dragging the right border to the left widens the right pane, and only it',
  'right: ' + r0 + ' -> ' + wb.width('right') + ', left ' + wb.width('left'));

test.subHeading('destroy');
wb.destroy();
ok(c1.innerHTML === '' && c1.listenerCount() === 0, 'destroy empties the container and drops its listeners', 'after destroy: ' + c1.listenerCount() + ' listeners, html ' + c1.innerHTML.length);
let threw = null;
try { wb.press('left', 'a'); } catch (e) { threw = e; }
ok(!threw, 'a press after destroy does nothing and throws nothing', 'press after destroy threw ' + (threw && threw.message));

test.reportSuccessFailureCount();
