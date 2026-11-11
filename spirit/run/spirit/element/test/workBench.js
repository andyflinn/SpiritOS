'use strict';

// spirit/run/spirit/element/test/workBench.js
// The tests of spirit/element/workBench.js, and of no other module (spec: ./workBench.md; goal/G41.1, goal/G41.18). The browser file runs
// in node on a window of its own; the container is a stub that keeps a node per id it draws and hears its listeners,
// and the document a stub that hears the moves of a drag.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'workBench.js');


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

// What the tests make, shared by the tests after them.
let loadError, W, mounted, tool, c1, wb, ids, want, at, prefixes, c1b, tagOf, boxA, left, c2, mountsA, boxB, c3, told,
  wb3, w0, settled, r0, threw;
test.run('it loads on window.spirit.element.spirit.element.workBench with create', 0.2, function () {
  global.window = { spirit: { element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(__dirname, '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  loadError = null;
  try { vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE }); } catch (e) { loadError = e; }
  W = window.spirit.element.spirit.element.workBench;
  return (!loadError && W && typeof W.create === 'function') ? true : 'loading: ' + (loadError ? loadError.message : 'no window.spirit.element.spirit.element.workBench.create');
}, 1000);
test.run('it draws the strips, panes, borders and centre, in order', 0.2, function () {
  mounted = [];
  tool = function (name) { return { name: name, icon: 'I' + name, title: 'T' + name, mount: function (box) { mounted.push({ name: name, box: box }); } }; };
  // the parts, in order, in a box it does not size
  c1 = container();
  wb = W.create(c1, { left: [tool('a'), tool('b')], right: [tool('x')] });
  ids = c1.order();
  want = ['strip-left', 'pane-left', 'border-left', 'center', 'border-right', 'pane-right', 'strip-right'];
  at = want.map(function (n) { return ids.findIndex(function (id) { return id.slice(-n.length) === n; }); });
  return (at.every(function (i) { return i !== -1; }) && at.every(function (i, k) { return k === 0 || i > at[k - 1]; })) ? true : 'parts in order: ' + JSON.stringify(ids);
}, 1000);
test.run('every part\'s id starts with the same prefix of its own element', 0.2, function () {
  prefixes = want.map(function (n) { const id = ids.find(function (x) { return x.slice(-n.length) === n; }) || ''; return id.slice(0, id.length - n.length); });
  return (prefixes.every(function (p) { return p === prefixes[0]; }) && prefixes[0] !== '') ? true : 'prefixes: ' + JSON.stringify(prefixes);
}, 1000);
test.run('two workbenches never share a prefix', 0.2, function () {
  c1b = container();
  W.create(c1b, { left: [tool('second')], right: [] });
  return (c1b.order()[0] !== ids[0]) ? true : 'the second drew ' + JSON.stringify(c1b.order()[0]);
}, 1000);
test.run('its root takes the shell\'s fill class, and it sets no size on the container it is given', 0.2, function () {
  return (/class="[^"]*\bfill\b/.test(c1.innerHTML) && !c1.style.width && !c1.style.height && !c1.style.flex) ? true : 'root: ' + c1.innerHTML.slice(0, 200) + ' style ' + JSON.stringify(c1.style);
}, 1000);
test.run('center is the centre pane\'s box', 0.2, function () {
  return (wb && typeof wb.center === 'object' && wb.center !== null && wb.center === c1.part('center')) ? true : 'center: ' + typeof (wb && wb.center);
}, 1000);
test.run('each side pane is a fill box', 0.2, function () {
  // every box from the app to a tool states its size (rule/16; goal/G41.18)
  // Andy, on G41.18, with many model rows: "the lists violate: rule/16 — A list gets a box of a stated size. Files and
  // contacts do it right, agents must as well." rule/16: every list stands in a box of class fill, inside a pane that fills
  // its app. A side pane that is not one lets its tool grow with its rows, and the whole pane scrolls with it.
  tagOf = function (c, name) { const m = new RegExp('<[^>]*\\bid="[^"]*' + name + '"[^>]*>').exec(c.innerHTML); return m ? m[0] : ''; };
  return (/class="[^"]*\bfill\b/.test(tagOf(c1, 'pane-left')) && /class="[^"]*\bfill\b/.test(tagOf(c1, 'pane-right'))) ? true : 'panes: ' + tagOf(c1, 'pane-left') + ' ' + tagOf(c1, 'pane-right');
}, 1000);
test.run('and so is the centre', 0.2, function () {
  return (/class="[^"]*\bfill\b/.test(tagOf(c1, 'center'))) ? true : 'centre: ' + tagOf(c1, 'center');
}, 1000);
test.run('and so is each icon strip', 0.2, function () {
  // Andy: "fix workBench for all 3 panes AND the icon strips"; "ALL lists, otherwise my took bars at the top of a container
  // keep scrolling away....". A strip of many tools scrolls inside its own height, never the app's.
  return (/class="[^"]*\bfill\b/.test(tagOf(c1, 'strip-left')) && /class="[^"]*\bfill\b/.test(tagOf(c1, 'strip-right'))) ? true : 'strips: ' + tagOf(c1, 'strip-left') + ' ' + tagOf(c1, 'strip-right');
}, 1000);
test.run('each of the five scrolls inside its own height (overflow auto), so what stands above a list in a pane stays put', 0.2, function () {
  return (['strip-left', 'pane-left', 'center', 'pane-right', 'strip-right'].every(function (n) { return /overflow(-y)?:auto/.test(tagOf(c1, n)); })) ? true : 'parts: ' + ['strip-left', 'pane-left', 'center', 'pane-right', 'strip-right'].map(function (n) { return tagOf(c1, n); }).join(' ');
}, 1000);
test.run('the box a tool is mounted in is a fill box, given before its mount', 0.2, function () {
  boxA = mounted.filter(function (m) { return m.name === 'a'; })[0];
  return (boxA && (' ' + boxA.box.className + ' ').indexOf(' fill ') !== -1) ? true : 'tool box class: ' + JSON.stringify(boxA && boxA.box.className);
}, 1000);
test.run('each strip has one button per tool, with its side and its name', 0.2, function () {
  // the strips: a button per tool
  left = (c1.innerHTML.match(/data-tool="[^"]*"/g) || []).map(function (s) { return s.slice(11, -1); });
  return (JSON.stringify(left) === '["a","b","x"]' && /data-side="left"/.test(c1.innerHTML) && /data-side="right"/.test(c1.innerHTML)) ? true : 'buttons: ' + JSON.stringify(left);
}, 1000);
test.run('each button wears the tool\'s icon and title', 0.2, function () {
  return (/Ia/.test(c1.innerHTML) && /title="Ta"/.test(c1.innerHTML) && /Ix/.test(c1.innerHTML)) ? true : 'icons and titles missing: ' + c1.innerHTML.slice(0, 300);
}, 1000);
test.run('a side with no tools draws no strip, no pane and no border', 0.2, function () {
  c2 = container();
  W.create(c2, { left: [tool('only')], right: [] });
  return (!c2.part('strip-right') && !c2.part('pane-right') && !c2.part('border-right') && !!c2.part('strip-left')) ? true : 'right side drawn: ' + JSON.stringify(c2.order());
}, 1000);
test.run('at start each side shows its first tool', 0.2, function () {
  // at start, and showing a tool
  return (wb.shown('left') === 'a' && wb.shown('right') === 'x') ? true : 'shown: ' + wb.shown('left') + ' / ' + wb.shown('right');
}, 1000);
test.run('a tool shown is mounted once, into a box of its own', 0.2, function () {
  mountsA = mounted.filter(function (m) { return m.name === 'a'; });
  return (mountsA.length === 1 && mountsA[0].box && typeof mountsA[0].box === 'object') ? true : 'mounts of a: ' + mountsA.length;
}, 1000);
test.run('a tool not yet shown is not mounted', 0.2, function () {
  return (!mounted.some(function (m) { return m.name === 'b'; })) ? true : 'b was mounted before it showed';
}, 1000);
test.run('pressing another tool\'s icon shows that tool and mounts it', 0.2, function () {
  wb.press('left', 'b');
  return (wb.shown('left') === 'b' && mounted.filter(function (m) { return m.name === 'b'; }).length === 1) ? true : 'after pressing b: ' + wb.shown('left');
}, 1000);
test.run('each tool has its own box', 0.2, function () {
  boxB = mounted.filter(function (m) { return m.name === 'b'; })[0];
  return (boxB && boxB.box !== mountsA[0].box) ? true : 'a and b share a box';
}, 1000);
test.run('a tool shown again is not mounted again: its box is kept', 0.2, function () {
  wb.press('left', 'a');
  return (wb.shown('left') === 'a' && mounted.filter(function (m) { return m.name === 'a'; }).length === 1) ? true : 'mounts of a: ' + mounted.filter(function (m) { return m.name === 'a'; }).length;
}, 1000);
test.run('pressing another icon calls changed with its side and name', 0.2, function () {
  // THE APP IS TOLD (Desk's item panel draws its left panels from this; goal/G41.31 removed it and every left icon in Desk went dead).
  // changed tells the app
  c3 = container();
  told = [];
  wb3 = W.create(c3, { left: [tool('p'), tool('q')], right: [], changed: function (side, name) { told.push(side + ':' + name); } });
  told.length = 0;
  wb3.press('left', 'q');
  return (told.join() === 'left:q') ? true : 'told: ' + JSON.stringify(told);
}, 1000);
test.run('collapsing a side calls changed with the name empty', 0.2, function () {
  wb3.press('left', 'q');
  return (told.join() === 'left:q,left:') ? true : 'told: ' + JSON.stringify(told);
}, 1000);
test.run('pressing the icon of the tool shown collapses its side: the pane is hidden', 0.2, function () {
  // collapsing
  wb.press('left', 'a');
  return (wb.shown('left') === '' && hiddenNow(c1.part('pane-left'))) ? true : 'after pressing a again: shown ' + JSON.stringify(wb.shown('left')) + ', pane ' + JSON.stringify(c1.part('pane-left') && { hidden: c1.part('pane-left').hidden, attr: c1.part('pane-left').hiddenAttr, style: c1.part('pane-left').style });
}, 1000);
test.run('a press on the left never changes the right', 0.2, function () {
  return (wb.shown('right') === 'x' && !hiddenNow(c1.part('pane-right'))) ? true : 'right after: ' + wb.shown('right');
}, 1000);
test.run('pressing any icon while collapsed shows that tool', 0.2, function () {
  wb.press('left', 'b');
  return (wb.shown('left') === 'b' && !hiddenNow(c1.part('pane-left'))) ? true : 'after: ' + wb.shown('left');
}, 1000);
test.run('a press naming no tool of that side changes nothing', 0.2, function () {
  wb.press('left', 'nosuch');
  return (wb.shown('left') === 'b') ? true : 'after nosuch: ' + wb.shown('left');
}, 1000);
test.run('a press naming a tool of the other side changes nothing', 0.2, function () {
  wb.press('right', 'b');
  return (wb.shown('right') === 'x' && wb.shown('left') === 'b') ? true : 'after right/b: ' + wb.shown('right');
}, 1000);
test.run('it listens on its container, one listener per event type', 0.2, function () {
  // its listeners: on its container, a click presses
  return (c1.perType() && c1.heardTypes().indexOf('click') !== -1) ? true : 'listeners: ' + JSON.stringify(c1.heardTypes());
}, 1000);
test.run('a click on a strip button presses it', 0.2, function () {
  c1.fire('click', clickOn('right', 'x'));
  return (wb.shown('right') === '') ? true : 'right after a click on x: ' + JSON.stringify(wb.shown('right'));
}, 1000);
test.run('a second click shows it again', 0.2, function () {
  c1.fire('click', clickOn('right', 'x'));
  return (wb.shown('right') === 'x') ? true : 'right: ' + JSON.stringify(wb.shown('right'));
}, 1000);
test.run('a side pane has a width of at least 120 pixels', 0.2, function () {
  // the movable borders
  w0 = wb.width('left');
  return (typeof w0 === 'number' && w0 >= 120) ? true : 'left width: ' + w0;
}, 1000);
test.run('dragging the left border to the right widens the left pane by the distance moved', 0.2, function () {
  c1.fire('pointerdown', onBorder('left', 300));
  docFire('pointermove', { clientX: 350, preventDefault: function () {} });
  return (wb.width('left') === w0 + 50) ? true : 'left: ' + w0 + ' -> ' + wb.width('left');
}, 1000);
test.run('never below 120 pixels', 0.2, function () {
  docFire('pointermove', { clientX: 300 - w0 - 500, preventDefault: function () {} });
  return (wb.width('left') === 120) ? true : 'left after a long drag back: ' + wb.width('left');
}, 1000);
test.run('after the pointer is up, a move changes nothing', 0.2, function () {
  docFire('pointerup', { clientX: 0 });
  settled = wb.width('left');
  docFire('pointermove', { clientX: 900, preventDefault: function () {} });
  return (wb.width('left') === settled) ? true : 'left moved after pointerup: ' + settled + ' -> ' + wb.width('left');
}, 1000);
test.run('dragging the right border to the left widens the right pane, and only it', 0.2, function () {
  r0 = wb.width('right');
  c1.fire('pointerdown', onBorder('right', 800));
  docFire('pointermove', { clientX: 760, preventDefault: function () {} });
  docFire('pointerup', { clientX: 760 });
  return (wb.width('right') === r0 + 40 && wb.width('left') === settled) ? true : 'right: ' + r0 + ' -> ' + wb.width('right') + ', left ' + wb.width('left');
}, 1000);
test.run('destroy empties the container and drops its listeners', 0.2, function () {
  // destroy
  wb.destroy();
  return (c1.innerHTML === '' && c1.listenerCount() === 0) ? true : 'after destroy: ' + c1.listenerCount() + ' listeners, html ' + c1.innerHTML.length;
}, 1000);
test.run('a press after destroy does nothing and throws nothing', 0.2, function () {
  threw = null;
  try { wb.press('left', 'a'); } catch (e) { threw = e; }
  return (!threw) ? true : 'press after destroy threw ' + (threw && threw.message);
}, 1000);
// ── goal/G41.22: KEPT TO ITS CONTAINER, IN A REAL BROWSER ────────────────────────────────────────────────────────────
// Andy: "workBench if, contained, needs to be restreicted by its container, be that the shell app itself or another
// container." The stubs above have no layout, so this is asked of Chrome: ./workBench-contained.html, on a scratch node
// with its DEBUG on, puts one workBench in each container, every pane given 5000 pixels of content.
const H = require(path.join(path.resolve(__dirname, '../../..'), 'spirit', 'test', 'headLessChrome.js'));
const ADDRESS = '/DEBUG/spirit/element/test/workBench-contained.html';
// The scratch node, the Chrome page on it, and what it measured: m by container, and the strip of one tool and of forty.
const CH = { m: {} };
const kept = function (m) { return m.bench.bottom <= m.room + 1 && m.bench.height <= m.roomHeight + 1 && !m.spilt && !m.pageScrolls; };
const keptWhy = function (label, m) {
  return label + ': the workBench is ' + m.bench.height + ' pixels tall in ' + m.roomHeight + ', its bottom at ' + m.bench.bottom + ' of ' + m.room +
    (m.spilt ? ', the container spills' : '') + (m.pageScrolls ? ', the page scrolls' : '');
};
const loose = function (m) { return Object.keys(m.panes).filter(function (k) { return !m.panes[k].scrolls || m.panes[k].bottom > m.room + 1; }); };
const scrolls = function (m) { return Object.keys(m.panes).length === 3 && !loose(m).length; };
const scrollsWhy = function (label, m) { return label + ': not scrolling inside it: ' + (Object.keys(m.panes).length === 3 ? loose(m).join(', ') : 'panes found ' + JSON.stringify(m.panes)); };
// SQUARE WHERE IT IS SHOWN (goal/G41.23; Andy: "the buttons are still not square", "the rounded shape, it that's the
// button, id DEFINITELY NOT square"): in the shell's app area too, whose sheet gives its buttons a height of their own.
const square = function (m) { return (m.buttons || []).length === 2 && !(m.buttons || []).filter(function (b) { return Math.abs(b[0] - b[1]) > 1; }).length; };
const squareWhy = function (label, m) { return label + ': strip buttons not square, width by height: ' + JSON.stringify(m.buttons); };
// workBench-contained.html: kept to its container
test.run('the world: Chrome is on this machine', 0.2, function () {
  CH.chrome = H.findChrome();
  return !!CH.chrome || 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
}, 1000);
test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
  CH.node = await H.scratchNode();
  return (CH.node.up && CH.node.debug) || 'the scratch node did not come up with its DEBUG on';
}, 4000);
test.run('the world: the page measures a workBench in each container', 0.2, async function () {
  if (!CH.chrome || !CH.node || !CH.node.up) return 'no Chrome or no scratch node: the world failed';
  CH.page = await H.chromePage(CH.chrome);
  if (CH.page.error) return CH.page.error;
  await CH.page.send('Page.navigate', { url: CH.node.base + ADDRESS });
  await H.until(function () { return CH.page.evaluate('typeof window.contained === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  const nothing = [];
  for (const c of ['block', 'flex', 'app']) {
    const s = await CH.page.evaluate('window.contained(' + JSON.stringify(c) + ')').catch(function () { return ''; });
    try { CH.m[c] = JSON.parse(s); } catch (e) { CH.m[c] = null; }
    if (!CH.m[c]) nothing.push(c + ': the page measured nothing (' + String(s).slice(0, 200) + ')');
  }
  return !nothing.length || nothing.join('; ');
}, 3000);
test.run('a box of 300 pixels, a plain block: the workBench stays inside it, and nothing outside scrolls', 0.2, function () {
  const m = CH.m.block;
  if (!m) return 'a box of 300 pixels, a plain block: the page measured nothing';
  return kept(m) || keptWhy('a box of 300 pixels, a plain block', m);
}, 1000);
test.run('a box of 300 pixels, a plain block: the left pane, the right pane and the centre each scroll inside it', 0.2, function () {
  const m = CH.m.block;
  if (!m) return 'a box of 300 pixels, a plain block: the page measured nothing';
  return scrolls(m) || scrollsWhy('a box of 300 pixels, a plain block', m);
}, 1000);
test.run('a box of 300 pixels, a plain block: each strip button is a square', 0.2, function () {
  const m = CH.m.block;
  if (!m) return 'a box of 300 pixels, a plain block: the page measured nothing';
  return square(m) || squareWhy('a box of 300 pixels, a plain block', m);
}, 1000);
test.run('a box of 300 pixels, a flex column: the workBench stays inside it, and nothing outside scrolls', 0.2, function () {
  const m = CH.m.flex;
  if (!m) return 'a box of 300 pixels, a flex column: the page measured nothing';
  return kept(m) || keptWhy('a box of 300 pixels, a flex column', m);
}, 1000);
test.run('a box of 300 pixels, a flex column: the left pane, the right pane and the centre each scroll inside it', 0.2, function () {
  const m = CH.m.flex;
  if (!m) return 'a box of 300 pixels, a flex column: the page measured nothing';
  return scrolls(m) || scrollsWhy('a box of 300 pixels, a flex column', m);
}, 1000);
test.run('a box of 300 pixels, a flex column: each strip button is a square', 0.2, function () {
  const m = CH.m.flex;
  if (!m) return 'a box of 300 pixels, a flex column: the page measured nothing';
  return square(m) || squareWhy('a box of 300 pixels, a flex column', m);
}, 1000);
test.run('the shell\'s app area, as the home page draws it: the workBench stays inside it, and nothing outside scrolls', 0.2, function () {
  const m = CH.m.app;
  if (!m) return 'the shell\'s app area, as the home page draws it: the page measured nothing';
  return kept(m) || keptWhy('the shell\'s app area, as the home page draws it', m);
}, 1000);
test.run('the shell\'s app area, as the home page draws it: the left pane, the right pane and the centre each scroll inside it', 0.2, function () {
  const m = CH.m.app;
  if (!m) return 'the shell\'s app area, as the home page draws it: the page measured nothing';
  return scrolls(m) || scrollsWhy('the shell\'s app area, as the home page draws it', m);
}, 1000);
test.run('the shell\'s app area, as the home page draws it: each strip button is a square', 0.2, function () {
  const m = CH.m.app;
  if (!m) return 'the shell\'s app area, as the home page draws it: the page measured nothing';
  return square(m) || squareWhy('the shell\'s app area, as the home page draws it', m);
}, 1000);
// THE STRIP (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all shell elements and apps.",
// and "the workBench will provide space for a possible vertical scrollbar, in the icons, strip."): one tool, and 40
// that scroll down a box of 300 pixels.
test.run('the world: the page measures the icon strip, one tool and forty', 0.2, async function () {
  if (!CH.page || CH.page.error) return 'no page: the world failed';
  const strip = async function (n) { try { return JSON.parse(await CH.page.evaluate('window.strip(' + n + ')')); } catch (e) { return null; } };
  CH.one = await strip(1);
  CH.many = await strip(40);
  return (!!CH.one && !!CH.many) || 'the page measured no strip: ' + JSON.stringify({ one: CH.one, many: CH.many });
}, 1000);
test.run('each tool\'s glyph is painted through the icon element', 0.2, function () {
  if (!CH.one || !CH.many) return 'no strip measured: the world failed';
  return (!!CH.many.mark && CH.one.painted === 1 && CH.many.painted === 40) ? true : CH.many.mark ? 'painted through the icon element: ' + CH.one.painted + ' of 1, ' + CH.many.painted + ' of 40' : 'no icon element to paint through: spirit/element/icon.js made no element with a class';
}, 1000);
test.run('forty tools scroll down the strip, its scrollbar drawn', 0.2, function () {
  if (!CH.one || !CH.many) return 'no strip measured: the world failed';
  return (CH.many.scrollsDown && CH.many.bar > 0) ? true : 'forty tools: scrolls down ' + CH.many.scrollsDown + ', scrollbar ' + CH.many.bar + ' pixels (the case needs one drawn)';
}, 1000);
test.run('with its scrollbar showing, no icon is pushed sideways: nothing scrolls across, no button past the scrollbar', 0.2, function () {
  if (!CH.one || !CH.many) return 'no strip measured: the world failed';
  return (!CH.many.sideways && CH.many.outside === 0) ? true : 'with its scrollbar showing: scrolls across ' + CH.many.sideways + ', ' + CH.many.outside + ' of ' + CH.many.buttons + ' buttons past it';
}, 1000);
test.run('the room is kept with no scrollbar too: the strip as wide, its buttons where they were and as wide', 0.2, function () {
  if (!CH.one || !CH.many) return 'no strip measured: the world failed';
  return (CH.one.width === CH.many.width && CH.one.firstLeft === CH.many.firstLeft && CH.one.firstWidth === CH.many.firstWidth) ? true : 'one tool: the strip ' + CH.one.width + ' wide, its button at ' + CH.one.firstLeft + ', ' + CH.one.firstWidth + ' wide; forty: ' + CH.many.width + ', the first at ' + CH.many.firstLeft + ', ' + CH.many.firstWidth + ' wide';
}, 1000);
test.after(function () {
  if (CH.page && CH.page.kid) CH.page.kid.kill();
  if (CH.node && CH.node.child) CH.node.child.kill();
  try { if (CH.page && CH.page.profile) fs.rmSync(CH.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (CH.node && CH.node.root) fs.rmSync(CH.node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
