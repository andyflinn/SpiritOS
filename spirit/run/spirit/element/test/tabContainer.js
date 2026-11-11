'use strict';

// spirit/run/spirit/element/test/tabContainer.js
// The tests of spirit/element/tabContainer.js, and of no other module (spec: ./tabContainer.md; goal/G41.1). The browser file
// runs in node on a window of its own; the container is a stub that keeps a node per id it draws and hears its
// listeners, and a box made by document.createElement is a stub node too.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../..'), 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'tabContainer.js');


// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
function node(id) {
  const n = { id: id || '', hidden: false, hiddenAttr: false, style: {}, innerHTML: '', children: [], className: '',
    appendChild: function (c) { n.children.push(c); c.parent = n; return c; },
    removeChild: function (c) { n.children.splice(n.children.indexOf(c), 1); c.parent = null; c.removed = true; return c; },
    remove: function () { if (n.parent) n.parent.removeChild(n); },
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
  return { target: { closest: function (sel) { return /data-tab(?!-close)|button/.test(sel) ? button : null; }, getAttribute: button.getAttribute, dataset: button.dataset },
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

// What the tests make, shared by the tests after them.
let loadError, T, mounted, tab, c1, tc, ids, iTabs, iContent, c1b, m0, firstMounts, c2, before, tc2, c3, tc3, boxOne,
  boxTwo, rowNow, m1, threw, gone, cd, tcd, c4, tc4, contentTag, cls, boxU, RUN_DIR, sheet, face, rule, hexOf, light,
  greens, fw, c5, buttons, rules, weight, tabRules, off, appButton, squared, appRadius, c6, made6, tab6, tc6, rowOf,
  row, mounts, press, content;
test.run('it loads on window.spirit.element.spirit.element.tabContainer with create', 0.2, function () {
  global.window = { spirit: { element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(__dirname, '..', '..', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  loadError = null;
  try { vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE }); } catch (e) { loadError = e; }
  T = window.spirit.element.spirit.element.tabContainer;
  return (!loadError && T && typeof T.create === 'function') ? true : 'loading: ' + (loadError ? loadError.message : 'no window.spirit.element.spirit.element.tabContainer.create');
}, 1000);
test.run('it draws the row of tabs, then the content area', 0.2, function () {
  mounted = [];
  tab = function (name) { return { name: name, label: 'L' + name, mount: function (box) { mounted.push({ name: name, box: box }); } }; };
  // the row and the content, in a box it does not size
  c1 = container();
  tc = T.create(c1, { tabs: [tab('one'), tab('two'), tab('three')] });
  ids = c1.order();
  iTabs = ids.findIndex(function (id) { return /tabs$/.test(id); });
  iContent = ids.findIndex(function (id) { return /content$/.test(id); });
  return (iTabs !== -1 && iContent > iTabs) ? true : 'parts: ' + JSON.stringify(ids);
}, 1000);
test.run('both ids start with the same prefix of its own element', 0.2, function () {
  return (iTabs !== -1 && iContent !== -1 && ids[iTabs].replace(/tabs$/, '') === ids[iContent].replace(/content$/, '') && ids[iTabs] !== 'tabs') ? true : 'ids: ' + JSON.stringify(ids);
}, 1000);
test.run('two tab containers never share a prefix', 0.2, function () {
  c1b = container();
  T.create(c1b, { tabs: [tab('second')] });
  return (c1b.order()[0] !== ids[0]) ? true : 'the second drew ' + JSON.stringify(c1b.order()[0]);
}, 1000);
test.run('its root and its content area take the shell\'s fill class', 0.2, function () {
  return (/class="[^"]*\bfill\b/.test(c1.innerHTML) && new RegExp('id="' + (ids[iContent] || 'x') + '"[^>]*class="[^"]*\\bfill\\b|class="[^"]*\\bfill\\b[^"]*"[^>]*id="' + (ids[iContent] || 'x') + '"').test(c1.innerHTML)) ? true : 'markup: ' + c1.innerHTML.slice(0, 300);
}, 1000);
test.run('it sets no size on the container it is given', 0.2, function () {
  return (!c1.style.width && !c1.style.height && !c1.style.flex) ? true : 'container style: ' + JSON.stringify(c1.style);
}, 1000);
test.run('one button per tab, with its name and its label', 0.2, function () {
  // the buttons
  m0 = marks(c1.innerHTML);
  return (JSON.stringify(Object.keys(m0)) === '["one","two","three"]' && /Lone/.test(c1.innerHTML) && /Ltwo/.test(c1.innerHTML)) ? true : 'buttons: ' + JSON.stringify(m0);
}, 1000);
test.run('the selected tab\'s button carries aria-selected true, every other false', 0.2, function () {
  return (m0.one === 'true' && m0.two === 'false' && m0.three === 'false') ? true : 'marks: ' + JSON.stringify(m0);
}, 1000);
test.run('at start the first tab is selected and mounted once, into a box of its own', 0.2, function () {
  // selecting
  firstMounts = mounted.filter(function (m) { return m.name === 'one' || m.name === 'two' || m.name === 'three'; });
  return (tc.selected() === 'one' && firstMounts.length === 1 && firstMounts[0].name === 'one' && firstMounts[0].box && typeof firstMounts[0].box === 'object') ? true : 'selected ' + tc.selected() + ', mounted ' + JSON.stringify(mounted.map(function (m) { return m.name; }));
}, 1000);
test.run('selected names the tab shown first', 0.2, function () {
  c2 = container();
  before = mounted.length;
  tc2 = T.create(c2, { tabs: [tab('p'), tab('q')], selected: 'q' });
  return (tc2.selected() === 'q' && mounted.length === before + 1 && mounted[before].name === 'q') ? true : 'selected ' + tc2.selected();
}, 1000);
test.run('a selected that names no tab falls back to the first', 0.2, function () {
  c3 = container();
  tc3 = T.create(c3, { tabs: [tab('r'), tab('s')], selected: 'nosuch' });
  return (tc3.selected() === 'r') ? true : 'selected ' + tc3.selected();
}, 1000);
test.run('select shows that tab, mounted into its own box', 0.2, function () {
  tc.select('two');
  boxOne = mounted.filter(function (m) { return m.name === 'one'; })[0].box;
  boxTwo = (mounted.filter(function (m) { return m.name === 'two'; })[0] || {}).box;
  return (tc.selected() === 'two' && boxTwo && boxTwo !== boxOne) ? true : 'selected ' + tc.selected();
}, 1000);
test.run('only the selected tab\'s box shows; the others are hidden', 0.2, function () {
  return (hiddenNow(boxOne) && !hiddenNow(boxTwo)) ? true : 'one hidden ' + hiddenNow(boxOne) + ', two hidden ' + hiddenNow(boxTwo);
}, 1000);
test.run('the marks follow the selection', 0.2, function () {
  // The row as it is now: drawn again on its own (its node's markup), or with the whole container. A browser reflects either
  // in the container's markup; this stub does not, so the row's own node is read when it was drawn on its own.
  rowNow = function (c) { const r = c.part('tabs'); return r && r.innerHTML ? r.innerHTML : c.innerHTML; };
  m1 = marks(rowNow(c1));
  return (m1.two === 'true' && m1.one === 'false') ? true : 'marks: ' + JSON.stringify(m1);
}, 1000);
test.run('a tab selected again is not mounted again: its box is kept and shown', 0.2, function () {
  tc.select('one');
  return (tc.selected() === 'one' && mounted.filter(function (m) { return m.name === 'one'; }).length === 1 && !hiddenNow(boxOne) && hiddenNow(boxTwo)) ? true : 'mounts of one: ' + mounted.filter(function (m) { return m.name === 'one'; }).length;
}, 1000);
test.run('select with a name that is no tab changes nothing', 0.2, function () {
  tc.select('nosuch');
  return (tc.selected() === 'one') ? true : 'selected ' + tc.selected();
}, 1000);
test.run('it listens on its container, one listener per event type', 0.2, function () {
  // its listeners: on its container, a click selects
  return (c1.perType() && c1.heardTypes().indexOf('click') !== -1) ? true : 'listeners: ' + JSON.stringify(c1.heardTypes());
}, 1000);
test.run('a click on a tab button selects that tab', 0.2, function () {
  c1.fire('click', clickOn('three'));
  return (tc.selected() === 'three') ? true : 'selected after a click on three: ' + tc.selected();
}, 1000);
test.run('destroy empties the container and drops its listeners', 0.2, function () {
  // destroy
  tc.destroy();
  return (c1.innerHTML === '' && c1.listenerCount() === 0) ? true : 'after destroy: ' + c1.listenerCount() + ' listeners';
}, 1000);
test.run('a click or a select after destroy does nothing and throws nothing', 0.2, function () {
  threw = null;
  try { c1.fire('click', clickOn('one')); tc.select('two'); } catch (e) { threw = e; }
  return (!threw) ? true : 'threw ' + (threw && threw.message);
}, 1000);
test.run('destroy destroys what every mounted tab answered', 0.2, function () {
  // rule/8: what each tab's mount answered is destroyed with the container, as close destroys it.
  gone = [];
  cd = container();
  tcd = T.create(cd, { tabs: ['a', 'b'].map(function (n) { return { name: n, label: n, mount: function () { return { destroy: function () { gone.push(n); } }; } }; }) });
  tcd.select('b');
  tcd.destroy();
  return (gone.sort().join() === 'a,b') ? true : 'destroyed: ' + JSON.stringify(gone);
}, 1000);
test.run('the content area takes the classes tab-content and fill', 0.2, function () {
  // THE CONTENT IS A BUBBLE (goal/G41.13; Andy: "the container pain of the tabs content, must have our standard 0.5em
  // padding", "it must occupy all remaining vertical space, that it must be constrained to", and "it should present as a
  // bubble of of darker green than already is on the page"). Its look is the shell's one sheet, a class, never inline.
  // the content pane: a bubble, padded, taking the height left
  c4 = container();
  tc4 = T.create(c4, { tabs: [tab('u'), tab('v')] });
  contentTag = (/<div\b[^>]*\bid="[^"]*content"[^>]*>/.exec(c4.innerHTML) || [''])[0];
  cls = (/class="([^"]*)"/.exec(contentTag) || [])[1] || '';
  return (/\btab-content\b/.test(cls) && /\bfill\b/.test(cls)) ? true : 'content: ' + contentTag;
}, 1000);
test.run('and carries no look of its own inline: the sheet gives it', 0.2, function () {
  return (!/style="[^"]*(padding|background|overflow)/.test(contentTag)) ? true : 'content: ' + contentTag;
}, 1000);
test.run('each tab\'s box takes fill, so what a tab holds gets the height left', 0.2, function () {
  boxU = (mounted.filter(function (m) { return m.name === 'u'; })[0] || {}).box;
  return (boxU && /\bfill\b/.test(String(boxU.className || ''))) ? true : 'box class: ' + (boxU && boxU.className);
}, 1000);
test.run('shell.css pads .tab-content 0.5em, the standard', 0.2, function () {
  tc4.destroy();
  RUN_DIR = require('path').resolve(__dirname, '../../..');
  sheet = fs.readFileSync(require('path').join(RUN_DIR, 'spirit', 'shell', 'shell.css'), 'utf8');
  face = fs.readFileSync(require('path').join(RUN_DIR, 'spirit', 'shell', 'face.css'), 'utf8');
  rule = (/\.tab-content\s*\{([^}]*)\}/.exec(sheet) || [])[1] || '';
  return (/padding:\s*0\.5em/.test(rule)) ? true : '.tab-content: ' + rule.trim();
}, 1000);
test.run('and holds it to the height left: min-height 0, scrolling inside itself', 0.2, function () {
  return (/min-height:\s*0/.test(rule) && /overflow:\s*auto/.test(rule)) ? true : '.tab-content: ' + rule.trim();
}, 1000);
test.run('a bubble: rounded, its background the shell\'s --shell-well', 0.2, function () {
  return (/border-radius:/.test(rule) && /background:\s*var\(--shell-well\)/.test(rule)) ? true : '.tab-content: ' + rule.trim();
}, 1000);
test.run('--shell-well is set in shell.css and face.css, darker than each one\'s --shell-pane: on the face a darker green than the page has', 0.2, function () {
  hexOf = function (css, name) { const m = new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})').exec(css); return m ? m[1] : null; };
  light = function (hex) { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255); };
  greens = [['shell.css', sheet], ['face.css', face]].map(function (p) { return { file: p[0], well: hexOf(p[1], '--shell-well'), pane: hexOf(p[1], '--shell-pane') }; });
  return (greens.every(function (g) { return g.well && g.pane && light(g.well) < light(g.pane); })) ? true : 'colours: ' + JSON.stringify(greens);
}, 1000);
test.run('and on the face it is a green', 0.2, function () {
  fw = greens[1].well;
  return (fw && (parseInt(fw.slice(3, 5), 16) > parseInt(fw.slice(1, 3), 16)) && (parseInt(fw.slice(3, 5), 16) > parseInt(fw.slice(5, 7), 16))) ? true : 'face well: ' + fw;
}, 1000);
test.run('each tab is a button of the class tab-button', 0.2, function () {
  // THE TAB BUTTONS (goal/G41.13, box; Andy: "the top row tab buttons: the bottom corners should not be rounded", "the
  // background color of those buttons should be same as the pane's background color, when they're NOT the active tab,
  // while the active tab has the same background color as all tabs currently have"; then: "for the tab button colors, i want
  // them reversed, the selected on dark, the unselected bighter.").
  // the tab buttons: square bottoms, the selected one dark as the pane, the others the button colour
  c5 = container();
  T.create(c5, { tabs: [tab('w'), tab('x')] });
  buttons = (c5.innerHTML.match(/<button\b[^>]*>/g) || []);
  return (buttons.length === 2 && buttons.every(function (b) { return (/class="[^"]*\btab-button\b/).test(b); })) ? true : 'buttons: ' + JSON.stringify(buttons);
}, 1000);
test.run('with no colour or corners of its own inline: the sheet gives them', 0.2, function () {
  return (buttons.every(function (b) { return !/style="[^"]*(background|radius)/.test(b); })) ? true : 'buttons: ' + JSON.stringify(buttons);
}, 1000);
test.run('shell.css squares a tab button\'s bottom corners', 0.2, function () {
  // Every rule of the sheet with its selectors, and the CSS weight of a selector (ids, classes and attributes, tags).
  rules = [];
  sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^}]*)\}/g, function (m, sel, body) { sel.split(',').forEach(function (x) { rules.push({ sel: x.replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: body }); }); return m; });
  weight = function (sel) { const ids = (sel.match(/#[\w-]+/g) || []).length; const cls = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length; const tags = (sel.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, ' ').match(/\b[a-z]+\b/g) || []).length; return ids * 10000 + cls * 100 + tags; };
  tabRules = rules.filter(function (r) { return /\.tab-button\b/.test(r.sel); });
  return (tabRules.some(function (r) { return /border-bottom-left-radius:\s*0/.test(r.body) && /border-bottom-right-radius:\s*0/.test(r.body); })) ? true : 'tab rules: ' + JSON.stringify(tabRules);
}, 1000);
test.run('the selected tab\'s background is the content pane\'s dark, var(--shell-well)', 0.2, function () {
  off = tabRules.filter(function (r) { return /aria-selected="true"/.test(r.sel) && /background:\s*var\(--shell-well\)/.test(r.body); })[0];
  return (!!off) ? true : 'tab rules: ' + JSON.stringify(tabRules);
}, 1000);
test.run('and it outweighs #app-content button, so it holds inside an app', 0.2, function () {
  // A tab inside an app is a button under #app-content, whose own rule paints every button (shell.css); the tab's rules
  // must win there, or the page shows no change at all.
  appButton = rules.filter(function (r) { return r.sel === '#app-content button' && /background/.test(r.body); })[0];
  return (off && (!appButton || weight(off.sel) > weight(appButton.sel) || /!important/.test(off.body))) ? true : 'selected rule ' + JSON.stringify(off && off.sel) + ' (' + (off ? weight(off.sel) : 0) + ') against ' + JSON.stringify(appButton && appButton.sel) + ' (' + (appButton ? weight(appButton.sel) : 0) + ')';
}, 1000);
test.run('the square corners outweigh it too', 0.2, function () {
  squared = tabRules.filter(function (r) { return /border-bottom-left-radius:\s*0/.test(r.body); })[0];
  appRadius = rules.filter(function (r) { return r.sel === '#app-content button' && /border-radius/.test(r.body); })[0];
  return (squared && (!appRadius || weight(squared.sel) > weight(appRadius.sel) || /!important/.test(squared.body))) ? true : 'squared ' + JSON.stringify(squared && squared.sel) + ' against ' + JSON.stringify(appRadius && appRadius.sel);
}, 1000);
test.run('the others keep the brighter colour every button has: no rule repaints them', 0.2, function () {
  return (!tabRules.some(function (r) { return /aria-selected="false"/.test(r.sel) && /background/.test(r.body); })) ? true : 'tab rules: ' + JSON.stringify(tabRules);
}, 1000);
test.run('a container answers add and close', 0.2, function () {
  // GOAL/G41.32. THE BOX: "the tabContainer will allow to add "closable" tabs, which have a little close button on the right
  // side of the tab, like browser tabs."; "if a bundle already has an branchEditor-tab in the configured tabContainer, that
  // tab will become the active tab". The contract the red asks: add({ name, label, mount, closable }), close(name), and a
  // closable tab's close button carrying data-tab-close="<name>".
  // goal/G41.32: closable tabs
  c6 = container();
  made6 = [];
  tab6 = function (n, closable) { return { name: n, label: n.toUpperCase(), closable: closable, mount: function (b) { made6.push(n); b.tag = n; } }; };
  tc6 = T.create(c6, { tabs: [tab6('fixed')] });
  return (typeof tc6.add === 'function' && typeof tc6.close === 'function') ? true : 'it answers: ' + Object.keys(tc6).join(', ');
}, 1000);
test.run('an added tab is selected and mounted', 0.2, function () {
  rowOf = function () { return c6.part('tabs') ? String(c6.part('tabs').innerHTML) : ''; };
  tc6.add(tab6('one', true));
  return (tc6.selected() === 'one' && made6.indexOf('one') !== -1) ? true : 'selected ' + tc6.selected() + ', mounted ' + made6.join();
}, 1000);
test.run('a closable tab has its close button', 0.2, function () {
  row = rowOf();
  return (row.indexOf('data-tab-close="one"') !== -1) ? true : 'row: ' + row;
}, 1000);
test.run('to the right of its label', 0.2, function () {
  return (row.indexOf('ONE') !== -1 && row.indexOf('ONE') < row.indexOf('data-tab-close="one"')) ? true : 'row: ' + row;
}, 1000);
test.run('a tab not added closable has none', 0.2, function () {
  return (row.indexOf('data-tab-close="fixed"') === -1) ? true : 'row: ' + row;
}, 1000);
test.run('adding a tab that is there makes it the active tab', 0.2, function () {
  mounts = made6.length;
  tc6.select('fixed');
  tc6.add(tab6('one', true));
  return (tc6.selected() === 'one') ? true : 'selected ' + tc6.selected();
}, 1000);
test.run('with no second tab, and no second mount', 0.2, function () {
  return ((rowOf().match(/data-tab-close="one"/g) || []).length === 1 && made6.length === mounts) ? true : 'row: ' + rowOf() + ', mounted ' + made6.join();
}, 1000);
test.run('a press on its close button takes the tab away', 0.2, function () {
  tc6.add(tab6('two', true));
  // A press on the close button closes that tab and selects nothing else by itself.
  press = function (name) { c6.fire('click', { target: { closest: function (sel) { return /data-tab-close/.test(sel) ? { getAttribute: function (k) { return k === 'data-tab-close' ? name : null; } } : null; } } }); };
  tc6.select('two');
  press('one');
  return (rowOf().indexOf('data-tab-close="one"') === -1 && rowOf().indexOf('ONE') === -1) ? true : 'row: ' + rowOf();
}, 1000);
test.run('and the tab shown stays shown when another one closes', 0.2, function () {
  return (tc6.selected() === 'two') ? true : 'selected ' + tc6.selected();
}, 1000);
test.run('the selected tab closed: a neighbour is selected', 0.2, function () {
  tc6.close('two');
  return (rowOf().indexOf('TWO') === -1 && tc6.selected() === 'fixed') ? true : 'row: ' + rowOf() + ', selected ' + tc6.selected();
}, 1000);
test.run('its box leaves the page', 0.2, function () {
  content = c6.part('content');
  return (content && !content.children.some(function (b) { return b.tag === 'two' && !b.parent; }) && content.children.filter(function (b) { return !b.removed && b.parent === content && (b.tag === 'two' || b.tag === 'one'); }).length === 0) ? true : 'boxes left: ' + (content ? content.children.map(function (b) { return b.tag; }).join() : '');
}, 1000);
test.run('closing a tab that is not there does nothing', 0.2, function () {
  tc6.close('nosuch');
  return (tc6.selected() === 'fixed') ? true : 'selected ' + tc6.selected();
}, 1000);
