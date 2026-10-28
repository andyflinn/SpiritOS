'use strict';

// spirit/run/shell/js/test/tabContainer.js
// The tests of shell/js/tabContainer.js, and of no other module (spec: ./tabContainer.md; goal/G41.1). The browser file
// runs in node on a window of its own; the container is a stub that keeps a node per id it draws and hears its
// listeners, and a box made by document.createElement is a stub node too.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'tabContainer.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
function node(id) {
  const n = { id: id || '', hidden: false, hiddenAttr: false, style: {}, innerHTML: '', children: [], className: '',
    appendChild: function (c) { n.children.push(c); c.parent = n; return c; },
    setAttribute: function (k, v) { if (k === 'hidden') n.hidden = true; n['attr_' + k] = String(v); },
    removeAttribute: function (k) { if (k === 'hidden') { n.hidden = false; n.hiddenAttr = false; } delete n['attr_' + k]; },
    getAttribute: function (k) { return n['attr_' + k] == null ? null : n['attr_' + k]; },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, closest: function () { return null; } };
  return n;
}
global.document = { createElement: function () { return node(''); }, addEventListener: function () {}, removeEventListener: function () {} };
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
function clickOn(name) {
  const button = { getAttribute: function (k) { return k === 'data-tab' ? name : null; }, dataset: { tab: name } };
  return { target: { closest: function (sel) { return /data-tab|button/.test(sel) ? button : null; }, getAttribute: button.getAttribute, dataset: button.dataset },
    preventDefault: function () {}, stopPropagation: function () {} };
}
const hiddenNow = function (n) { return !!n && (n.hidden === true || n.hiddenAttr === true || n.style.display === 'none'); };
// What the row says is selected: the aria-selected of each button, by its tab.
function marks(html) {
  const out = {}; const re = /<button[^>]*>/g; let m;
  while ((m = re.exec(html))) {
    const tab = /data-tab="([^"]*)"/.exec(m[0]); const sel = /aria-selected="([^"]*)"/.exec(m[0]);
    if (tab) out[tab[1]] = sel ? sel[1] : null;
  }
  return out;
}

test.startTest('tabContainer.js: a row of tabs, the content below');

if (!fs.existsSync(FILE)) {
  test.fail('shell/js/tabContainer.js is not there');
  test.reportSuccessFailureCount();
  process.exit(0);
}
global.window = { spirit: { elements: {} } };
let loadError = null;
try { vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE }); } catch (e) { loadError = e; }
const T = window.spirit.elements.tabContainer;
ok(!loadError && T && typeof T.create === 'function', 'it loads on window.spirit.elements.tabContainer with create',
  'loading: ' + (loadError ? loadError.message : 'no window.spirit.elements.tabContainer.create'));
if (!T || typeof T.create !== 'function') { test.reportSuccessFailureCount(); process.exit(0); }

const mounted = [];
function tab(name) { return { name: name, label: 'L' + name, mount: function (box) { mounted.push({ name: name, box: box }); } }; }

test.subHeading('the row and the content, in a box it does not size');
const c1 = container();
const tc = T.create(c1, { tabs: [tab('one'), tab('two'), tab('three')] });
const ids = c1.order();
const iTabs = ids.findIndex(function (id) { return /tabs$/.test(id); });
const iContent = ids.findIndex(function (id) { return /content$/.test(id); });
ok(iTabs !== -1 && iContent > iTabs, 'it draws the row of tabs, then the content area', 'parts: ' + JSON.stringify(ids));
ok(iTabs !== -1 && iContent !== -1 && ids[iTabs].replace(/tabs$/, '') === ids[iContent].replace(/content$/, '') && ids[iTabs] !== 'tabs',
  'both ids start with the same prefix of its own element', 'ids: ' + JSON.stringify(ids));
const c1b = container(); T.create(c1b, { tabs: [tab('second')] });
ok(c1b.order()[0] !== ids[0], 'two tab containers never share a prefix', 'the second drew ' + JSON.stringify(c1b.order()[0]));
ok(/class="[^"]*\bfill\b/.test(c1.innerHTML) && new RegExp('id="' + (ids[iContent] || 'x') + '"[^>]*class="[^"]*\\bfill\\b|class="[^"]*\\bfill\\b[^"]*"[^>]*id="' + (ids[iContent] || 'x') + '"').test(c1.innerHTML),
  'its root and its content area take the shell\'s fill class', 'markup: ' + c1.innerHTML.slice(0, 300));
ok(!c1.style.width && !c1.style.height && !c1.style.flex, 'it sets no size on the container it is given', 'container style: ' + JSON.stringify(c1.style));

test.subHeading('the buttons');
const m0 = marks(c1.innerHTML);
ok(JSON.stringify(Object.keys(m0)) === '["one","two","three"]' && /Lone/.test(c1.innerHTML) && /Ltwo/.test(c1.innerHTML),
  'one button per tab, with its name and its label', 'buttons: ' + JSON.stringify(m0));
ok(m0.one === 'true' && m0.two === 'false' && m0.three === 'false', 'the selected tab\'s button carries aria-selected true, every other false',
  'marks: ' + JSON.stringify(m0));

test.subHeading('selecting');
const firstMounts = mounted.filter(function (m) { return m.name === 'one' || m.name === 'two' || m.name === 'three'; });
ok(tc.selected() === 'one' && firstMounts.length === 1 && firstMounts[0].name === 'one' && firstMounts[0].box && typeof firstMounts[0].box === 'object',
  'at start the first tab is selected and mounted once, into a box of its own', 'selected ' + tc.selected() + ', mounted ' + JSON.stringify(mounted.map(function (m) { return m.name; })));
const c2 = container(); const before = mounted.length;
const tc2 = T.create(c2, { tabs: [tab('p'), tab('q')], selected: 'q' });
ok(tc2.selected() === 'q' && mounted.length === before + 1 && mounted[before].name === 'q', 'selected names the tab shown first',
  'selected ' + tc2.selected());
const c3 = container(); const tc3 = T.create(c3, { tabs: [tab('r'), tab('s')], selected: 'nosuch' });
ok(tc3.selected() === 'r', 'a selected that names no tab falls back to the first', 'selected ' + tc3.selected());
tc.select('two');
const boxOne = mounted.filter(function (m) { return m.name === 'one'; })[0].box;
const boxTwo = (mounted.filter(function (m) { return m.name === 'two'; })[0] || {}).box;
ok(tc.selected() === 'two' && boxTwo && boxTwo !== boxOne, 'select shows that tab, mounted into its own box', 'selected ' + tc.selected());
ok(hiddenNow(boxOne) && !hiddenNow(boxTwo), 'only the selected tab\'s box shows; the others are hidden', 'one hidden ' + hiddenNow(boxOne) + ', two hidden ' + hiddenNow(boxTwo));
// The row as it is now: drawn again on its own (its node's markup), or with the whole container. A browser reflects either
// in the container's markup; this stub does not, so the row's own node is read when it was drawn on its own.
const rowNow = function (c) { const r = c.part('tabs'); return r && r.innerHTML ? r.innerHTML : c.innerHTML; };
const m1 = marks(rowNow(c1));
ok(m1.two === 'true' && m1.one === 'false', 'the marks follow the selection', 'marks: ' + JSON.stringify(m1));
tc.select('one');
ok(tc.selected() === 'one' && mounted.filter(function (m) { return m.name === 'one'; }).length === 1 && !hiddenNow(boxOne) && hiddenNow(boxTwo),
  'a tab selected again is not mounted again: its box is kept and shown', 'mounts of one: ' + mounted.filter(function (m) { return m.name === 'one'; }).length);
tc.select('nosuch');
ok(tc.selected() === 'one', 'select with a name that is no tab changes nothing', 'selected ' + tc.selected());

test.subHeading('its listeners: on its container, a click selects');
ok(c1.perType() && c1.heardTypes().indexOf('click') !== -1, 'it listens on its container, one listener per event type', 'listeners: ' + JSON.stringify(c1.heardTypes()));
c1.fire('click', clickOn('three'));
ok(tc.selected() === 'three', 'a click on a tab button selects that tab', 'selected after a click on three: ' + tc.selected());

test.subHeading('destroy');
tc.destroy();
ok(c1.innerHTML === '' && c1.listenerCount() === 0, 'destroy empties the container and drops its listeners', 'after destroy: ' + c1.listenerCount() + ' listeners');
let threw = null;
try { c1.fire('click', clickOn('one')); tc.select('two'); } catch (e) { threw = e; }
ok(!threw, 'a click or a select after destroy does nothing and throws nothing', 'threw ' + (threw && threw.message));

// THE CONTENT IS A BUBBLE (goal/G41.13; Andy: "the container pain of the tabs content, must have our standard 0.5em
// padding", "it must occupy all remaining vertical space, that it must be constrained to", and "it should present as a
// bubble of of darker green than already is on the page"). Its look is the shell's one sheet, a class, never inline.
test.subHeading('the content pane: a bubble, padded, taking the height left');
const c4 = container();
const tc4 = T.create(c4, { tabs: [tab('u'), tab('v')] });
const contentTag = (/<div\b[^>]*\bid="[^"]*content"[^>]*>/.exec(c4.innerHTML) || [''])[0];
const cls = (/class="([^"]*)"/.exec(contentTag) || [])[1] || '';
ok(/\btab-content\b/.test(cls) && /\bfill\b/.test(cls), 'the content area takes the classes tab-content and fill', 'content: ' + contentTag);
ok(!/style="[^"]*(padding|background|overflow)/.test(contentTag), 'and carries no look of its own inline: the sheet gives it', 'content: ' + contentTag);
const boxU = (mounted.filter(function (m) { return m.name === 'u'; })[0] || {}).box;
ok(boxU && /\bfill\b/.test(String(boxU.className || '')), 'each tab\'s box takes fill, so what a tab holds gets the height left', 'box class: ' + (boxU && boxU.className));
tc4.destroy();
const RUN_DIR = require('path').resolve(__dirname, '../../..');
const sheet = fs.readFileSync(require('path').join(RUN_DIR, 'shell.css'), 'utf8');
const face = fs.readFileSync(require('path').join(RUN_DIR, 'shell', 'face.css'), 'utf8');
const rule = (/\.tab-content\s*\{([^}]*)\}/.exec(sheet) || [])[1] || '';
ok(/padding:\s*0\.5em/.test(rule), 'shell.css pads .tab-content 0.5em, the standard', '.tab-content: ' + rule.trim());
ok(/min-height:\s*0/.test(rule) && /overflow:\s*auto/.test(rule), 'and holds it to the height left: min-height 0, scrolling inside itself', '.tab-content: ' + rule.trim());
ok(/border-radius:/.test(rule) && /background:\s*var\(--shell-well\)/.test(rule), 'a bubble: rounded, its background the shell\'s --shell-well', '.tab-content: ' + rule.trim());
function hexOf(css, name) { const m = new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})').exec(css); return m ? m[1] : null; }
function light(hex) { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255); }
const greens = [['shell.css', sheet], ['face.css', face]].map(function (p) { return { file: p[0], well: hexOf(p[1], '--shell-well'), pane: hexOf(p[1], '--shell-pane') }; });
ok(greens.every(function (g) { return g.well && g.pane && light(g.well) < light(g.pane); }),
  '--shell-well is set in shell.css and face.css, darker than each one\'s --shell-pane: on the face a darker green than the page has', 'colours: ' + JSON.stringify(greens));
const fw = greens[1].well;
ok(fw && (parseInt(fw.slice(3, 5), 16) > parseInt(fw.slice(1, 3), 16)) && (parseInt(fw.slice(3, 5), 16) > parseInt(fw.slice(5, 7), 16)), 'and on the face it is a green', 'face well: ' + fw);

// THE TAB BUTTONS (goal/G41.13, box; Andy: "the top row tab buttons: the bottom corners should not be rounded", "the
// background color of those buttons should be same as the pane's background color, when they're NOT the active tab,
// while the active tab has the same background color as all tabs currently have").
test.subHeading('the tab buttons: square bottoms, the unselected ones the pane\'s colour');
const c5 = container();
T.create(c5, { tabs: [tab('w'), tab('x')] });
const buttons = (c5.innerHTML.match(/<button\b[^>]*>/g) || []);
ok(buttons.length === 2 && buttons.every(function (b) { return /class="[^"]*\btab-button\b/.test(b); }), 'each tab is a button of the class tab-button', 'buttons: ' + JSON.stringify(buttons));
ok(buttons.every(function (b) { return !/style="[^"]*(background|radius)/.test(b); }), 'with no colour or corners of its own inline: the sheet gives them', 'buttons: ' + JSON.stringify(buttons));
// Every rule of the sheet with its selectors, and the CSS weight of a selector (ids, classes and attributes, tags).
const rules = []; sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^}]*)\}/g, function (m, sel, body) { sel.split(',').forEach(function (x) { rules.push({ sel: x.replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: body }); }); return m; });
function weight(sel) { const ids = (sel.match(/#[\w-]+/g) || []).length; const cls = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length; const tags = (sel.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, ' ').match(/\b[a-z]+\b/g) || []).length; return ids * 10000 + cls * 100 + tags; }
const tabRules = rules.filter(function (r) { return /\.tab-button\b/.test(r.sel); });
ok(tabRules.some(function (r) { return /border-bottom-left-radius:\s*0/.test(r.body) && /border-bottom-right-radius:\s*0/.test(r.body); }), 'shell.css squares a tab button\'s bottom corners', 'tab rules: ' + JSON.stringify(tabRules));
const off = tabRules.filter(function (r) { return /aria-selected="false"/.test(r.sel) && /background:\s*var\(--shell-well\)/.test(r.body); })[0];
ok(!!off, 'an unselected tab\'s background is the content pane\'s, var(--shell-well)', 'tab rules: ' + JSON.stringify(tabRules));
// A tab inside an app is a button under #app-content, whose own rule paints every button (shell.css); the tab's rules
// must win there, or the page shows no change at all.
const appButton = rules.filter(function (r) { return r.sel === '#app-content button' && /background/.test(r.body); })[0];
ok(off && (!appButton || weight(off.sel) > weight(appButton.sel) || /!important/.test(off.body)), 'and it outweighs #app-content button, so it holds inside an app',
  'unselected rule ' + JSON.stringify(off && off.sel) + ' (' + (off ? weight(off.sel) : 0) + ') against ' + JSON.stringify(appButton && appButton.sel) + ' (' + (appButton ? weight(appButton.sel) : 0) + ')');
const squared = tabRules.filter(function (r) { return /border-bottom-left-radius:\s*0/.test(r.body); })[0];
const appRadius = rules.filter(function (r) { return r.sel === '#app-content button' && /border-radius/.test(r.body); })[0];
ok(squared && (!appRadius || weight(squared.sel) > weight(appRadius.sel) || /!important/.test(squared.body)), 'the square corners outweigh it too',
  'squared ' + JSON.stringify(squared && squared.sel) + ' against ' + JSON.stringify(appRadius && appRadius.sel));
ok(!tabRules.some(function (r) { return /aria-selected="true"/.test(r.sel) && /background/.test(r.body); }), 'the selected tab keeps the colour every button has: no rule repaints it', 'tab rules: ' + JSON.stringify(tabRules));

test.reportSuccessFailureCount();
