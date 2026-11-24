'use strict';
// spirit/run/spirit/element/test/search-child-browser.js [<script> ...]
// THE -browser GENERAL TEST BESIDE spirit/element/search/script.js (goal/G47.1, box v121, its section
// "spirit/element/test/search-child-browser.js": "new, the page twin of search-child-general.js: every search (selector,
// list, row, detail) mounted in a page on a scratch node, more rows than fit"). Its contract:
// ./search-child-browser.md. A -child- test beside search.js (../../test/TEST_SYSTEM.md): it judges search.js and search/ and
// below. Given scripts, the searches they are of; given none, or search.js itself, every search.
//
// HOW: a scratch node (the tracked files) and a headless Chrome on its face page, one fresh page per search. The selector is
// mounted in a pane of a stated size; the probabilitySearch it makes is watched (spirit.required.spirit.element.search.create,
// as spirit/test/spirit-sibling-browser.js's WATCH does) to learn the spirit.required.spirit.data branch it is a view of, and more rows than
// fit are planted in that branch, each a copy of a row the branch holds (or the plain fields alone), its text a long value
// with no place to break. The detail is mounted by the search's detail in a panel layer (spirit/element/panel/script.js), as
// the apps open one. EACH CHECK ONCE PER SEARCH (goal/G47.6), reported for that search's script: a search a check has nothing
// to judge in gets no test, never a green; a check no search could be judged by is red.
require('../../spirit.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { sleep, until, findChrome, scratchNode, chromePage } = LOADER.requireScript('spirit/test/headLessChrome.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function isFile(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
function runRel(a) {
  const abs = path.isAbsolute(String(a)) ? String(a) : path.resolve(String(a));
  const r = path.relative(RUN, abs).split(path.sep).join('/');
  if (r && r.indexOf('..') !== 0 && !path.isAbsolute(r) && fs.existsSync(abs)) return r;
  return String(a).split(path.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '');
}
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; }).map(runRel);

const SEARCH = 'spirit/element/search';
const TREE = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(isFile);
// Every search: its selector, search/<name>/script.js since goal/G49.5's element batch (search/script.js is the search element
// itself, no search).
const NAMES = TREE.map(function (f) { const m = new RegExp('^' + SEARCH + '/([^/]+)/script\\.js$').exec(f); return m ? m[1] : ''; })
  .filter(function (n) { return n && n !== 'test'; }).sort();
const selectorOf = function (n) { return SEARCH + '/' + n + '/script.js'; };
const nameOf = function (f) { const n = (new RegExp('^' + SEARCH + '/([^/.]+)/').exec(f) || [])[1] || ''; return n === 'test' ? '' : n; };
const ALL = !GIVEN.length || GIVEN.some(function (f) { return f === 'spirit/element/search/script.js'; });
const TARGETS = ALL ? NAMES : NAMES.filter(function (n) { return GIVEN.some(function (f) { return nameOf(f) === n; }); });
// Held open until each search's checks are said (judgeAll, after the searches are opened).
test.hold();

// THE PANE OF A STATED SIZE (rule 16: "a box that states its size: class fill ... inside a pane that fills its app").
const PANE_W = 640;
const PANE_H = 420;
const ROWS = 60;
// WHAT A SEARCH NEEDS TO DRAW A LIST AT ALL, mounted alone (cw, checking these reds: "suite: its list shows one script's
// suites and needs a script; mounted alone with none, it draws nothing. testicle and grant list from their servers
// (testicle, grants), and the scratch node does not run testicle. the world should give a script and turn testicle on").
const SERVERS = { servers: ['testicle', 'grants'] };
const OPTIONS = { suite: { script: 'spirit/spirit.js' } };
// Judged by its list, its selector drawing no pane (api: two dropdowns side by side, Andy's G29.7).
const VIA_LIST = { api: true };
// A ROW'S SHAPE WHERE THE SCRATCH NODE HOLDS NONE TO COPY (its branches and suite rows are empty on a fresh node): the fields
// each row element reads, every text one of them the long value when planted.
const SHAPES = { branch: { family: 'zzfamily', verb: 'zzverb' }, suite: { script: 'spirit/spirit.js', suite: 'spirit/test/zz.js', status: '' },
  testicle: { script: 'spirit/spirit.js', suite: 'spirit/test/zz.js', test: 'zz', current: true, verified: false, severity: 0.4 } };
// The fields a list filters its rows by, kept as they are when a row is planted (suite shows the rows of its script alone).
const KEEP = { suite: ['script'] };
// What a planted row must say to be shown at all: testicle's list shows current reds alone at the start (Andy: "reds only").
// The contact list opens on People with Search Network off (goal/G47.4, box v29: "The default is \"People\""): it shows a row
// that is no relay, not blocked, and decided about (kept); a planted copy of a fresh node's relay row showed nothing, and
// every check judged an empty list (goal/G47.1, Andy's reds on spirit/element/search/contact/script.js).
const FORCE = { testicle: { current: true, verified: false }, suite: { script: OPTIONS.suite.script }, contact: { relay: false, blocked: false, keep: true } };
// A long value with no place to break: a row and a detail must wrap or clip it.
const LONG = 'zzLongValue' + 'W'.repeat(300);

// What the page does for one search, as one script: mounted, planted, measured, the details opened. Its answer is a report.
const PAGE = String.raw`(function (name, ROWS, LONG, PANE_W, PANE_H, VIA_LIST, OPTIONS, SHAPES, KEEP, FORCE) {
  var S = window.spirit;
  var R = { name: name };
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // What is seen of an element: its rect cut by every box above it, up to stop, that clips (overflow other than visible).
  function seen(el, stop) {
    var r = el.getBoundingClientRect(); var v = { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
    for (var n = el.parentElement; n; n = n.parentElement) {
      var cs = getComputedStyle(n); var c = n.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { v.left = Math.max(v.left, c.left); v.right = Math.min(v.right, c.right); }
      if (cs.overflowY !== 'visible') { v.top = Math.max(v.top, c.top); v.bottom = Math.min(v.bottom, c.bottom); }
      if (n === stop) break;
    }
    return v;
  }
  // How many of box's contents show past its edge: each element with a rect, seen, against box's own rect.
  function spills(box) {
    var b = box.getBoundingClientRect(); var out = 0;
    Array.prototype.forEach.call(box.querySelectorAll('*'), function (el) {
      if (!el.getClientRects().length) return;
      var v = seen(el, box);
      if (v.right <= v.left || v.bottom <= v.top) return;
      if (v.right > b.right + 1 || v.bottom > b.bottom + 1 || v.left < b.left - 1) out++;
    });
    return out;
  }
  // A planted row: a copy of a row the branch holds, every text field of it (and of its label json) the long value.
  function plant(template, i) {
    function longer(o, keep) { var c = {}; Object.keys(o || {}).forEach(function (k) { var v = o[k]; c[k] = typeof v === 'string' && k !== 'key' && v !== keep && (KEEP[name] || []).indexOf(k) === -1 ? LONG + i : v; }); return c; }
    var row = template ? longer(template, template.key) : { label: LONG + i, name: LONG + i, title: LONG + i, text: LONG + i };
    if (template && typeof template.label === 'string' && /^\s*\{/.test(template.label)) {
      try { row.label = JSON.stringify(longer(JSON.parse(template.label), template.key)); } catch (e) { /* kept */ }
    }
    delete row.key;
    Object.assign(row, FORCE[name] || {});
    return row;
  }
  return Promise.resolve(S.readyPromise).then(function () {
    return Promise.all([S.requireScript('spirit/element/search/script.js'), S.requireScript('spirit/element/panel/script.js')]);
  }).then(function () {
    // The probabilitySearch watched: the spirit.required.spirit.data branch each one is made with.
    var made = R.made = [];
    var f = S.required.spirit.element.search; var real = f.create;
    f.create = function (host, o) { var x = o || {}; made.push({ data: typeof x.data === 'string' ? x.data : '', host: host }); return real.apply(this, arguments); };
    return S.requireScript('spirit/element/search/' + name + '/script.js').then(function () { return VIA_LIST[name] ? S.requireScript('spirit/element/search/' + name + '/list/script.js') : null; })
      // THE GRANT LIST NEEDS ITS TABLE (spirit/element/search/grant/list/script.js: "opts.grants the grants table, required"):
      // the node's own, as the Grants app hands it (grantsPanel.nodeGrants).
      .then(function () { return name === 'grant' ? S.requireScript('spirit/element/search/grant/grantsPanel/script.js').then(function () { OPTIONS.grant = { grants: S.required.spirit.element.search.grant.grantsPanel.nodeGrants }; }) : null; });
  }).then(function () {
    var box = document.createElement('div');
    box.id = 'zz-host';
    box.style.cssText = 'position:fixed;left:0;top:0;width:' + PANE_W + 'px;height:' + PANE_H + 'px;display:flex;flex-direction:column;overflow:hidden';
    document.body.innerHTML = '';
    document.body.appendChild(box);
    var pane = document.createElement('div'); pane.className = 'fill'; pane.id = 'zz-pane'; pane.style.cssText = 'display:flex;flex-direction:column;min-height:0';
    box.appendChild(pane);
    var under = document.createElement('div'); under.className = 'fill'; under.id = 'zz-under'; under.style.cssText = 'display:flex;flex-direction:column;min-height:0';
    pane.appendChild(under);
    R.stack = null;
    var stack = S.required.spirit.element.panel.create(pane, under);
    window.zzStack = stack;
    var sel = S.required.spirit.element.search[name];
    if (!sel || typeof sel.create !== 'function') { R.fail = true; return R; }
    // THE LIST IN PANE FACE (cw, checking these reds: "api: its selector is two dropdowns side by side by your ruling
    // (G29.7) and takes no face: pane, so it never draws a list. the test should judge api's list in pane face
    // instead"): a search whose selector draws no pane is judged by its own list.
    var maker = VIA_LIST[name] && sel.list && typeof sel.list.create === 'function' ? sel.list : sel;
    // Only the searches it makes in its own pane count (the face page makes its own).
    R.made.length = 0;
    try { window.zzMade = maker.create(under, Object.assign({ face: 'pane', open: stack.open }, OPTIONS[name] || {})); } catch (e) { R.fail = true; return R; }
    return wait(1500).then(function () {
      var mine = R.made.filter(function (x) { return x.host && under.contains(x.host); });
      // The search's own, not a filter's search in its selector row (made first by some lists).
      var outer = function (x) { return !(x.host && x.host.closest && x.host.closest('[id$="-selectors"]')); };
      var m = mine.filter(function (x) { return x.data && outer(x); })[0] || mine.filter(function (x) { return x.data; })[0] || null;
      R.data = m ? m.data : '';
      var list = m ? m.host : (mine[0] ? mine[0].host : null);
      // The list: the box the probabilitySearch draws its rows in (its id ends in list), whether it scrolls or not.
      // NOT A FILTER'S OWN LIST (cw: "the branch list has a selector row (🪣) on top of its own list, and in it the family
      // selector, a search of its own with its own list. the test takes the first [id$=\"list\"] under the host"): the list
      // outside every probsearch-N-selectors row.
      var L = list ? Array.prototype.filter.call(list.querySelectorAll('[id$="list"]'), function (x) { return !x.closest('[id$="-selectors"]'); })[0] || null : null;
      if (!L) { R.noList = true; return R; }
      window.zzList = L;
      var before = L.getBoundingClientRect();
      R.listBefore = { h: before.height, w: before.width };
      var keysBefore = L.querySelectorAll('[data-key]').length;
      if (!R.data || !S.required.spirit.data || typeof S.required.spirit.data.setPath !== 'function') { R.noData = true; return R; }
      // A ROW OF ITS OWN SHAPE FIRST: a list whose rows read fields of their own (branch: family and verb) draws no row
      // made of label, name, title and text alone; so the server's first answer is waited for, up to 8 s, and copied.
      function heldRow() { return (S.required.spirit.data.rowsOf(R.data) || []).filter(function (r) { return r && typeof r === 'object' && !/^zz-plant-/.test(String(r.key)); })[0] || null; }
      var t0 = Date.now();
      function shaped() { var t = heldRow(); if (t || Date.now() - t0 > 8000) return Promise.resolve(t); return wait(250).then(shaped); }
      return shaped().then(function (template) {
      template = template || SHAPES[name] || null;
      R.template = !!template;
      R.planted = [];
      for (var i = 0; i < ROWS; i++) { var k = 'zz-plant-' + i; R.planted.push(k); try { S.required.spirit.data.setPath(R.data + '/' + k, plant(template, i)); } catch (e) { R.plantError = true; } }
      return wait(1500).then(function () {
        var after = L.getBoundingClientRect();
        var p = pane.getBoundingClientRect();
        R.listAfter = { h: after.height, w: after.width, bottom: after.bottom, right: after.right };
        R.pane = { bottom: p.bottom, right: p.right };
        R.drawn = Array.prototype.filter.call(L.querySelectorAll('[data-key]'), function (el) { return /^zz-plant-/.test(el.getAttribute('data-key')); }).length;
        R.keysBefore = keysBefore;
        R.textHits = Array.prototype.filter.call(L.querySelectorAll('*'), function (el) { return !el.children.length && String(el.textContent || '').indexOf('zzLongValue') !== -1; }).length;
        R.held = (S.required.spirit.data.rowsOf(R.data) || []).filter(function (x) { return /^zz-plant-/.test(String(x.key)); }).length;
        R.scrolls = { sh: L.scrollHeight, ch: L.clientHeight, y: getComputedStyle(L).overflowY };
        // 3: the title and buttons: every button and input of the list's host outside the list.
        var fixed = Array.prototype.filter.call(list.querySelectorAll('button, input'), function (el) { return !L.contains(el) && el.getClientRects().length; });
        var tops = fixed.map(function (el) { return el.getBoundingClientRect().top; });
        L.scrollTop = L.scrollHeight;
        return wait(300).then(function () {
          R.fixedCount = fixed.length;
          R.moved = fixed.filter(function (el, i) { return Math.abs(el.getBoundingClientRect().top - tops[i]) > 1; }).length;
          L.scrollTop = 0;
          // 4: a planted row: what shows past its edge.
          var row = L.querySelector('[data-key="zz-plant-0"]');
          R.rowSpill = row ? spills(row) : null;
          R.rowWidth = row ? row.getBoundingClientRect().width : 0;
          return R;
        });
      });
      });
    });
  }).then(function () {
    // 5, 6, 8: the detail, by the search's detail, in a panel layer as the apps open one.
    return S.requireScript('spirit/element/search/' + name + '/detail/script.js').then(function () { return true; }, function () { return false; });
  }).then(function (has) {
    var D = has && S.required.spirit.element.search[name] && S.required.spirit.element.search[name].detail;
    if (!D || typeof D.create !== 'function') { R.noDetail = true; return R; }
    if (!R.data || !R.planted) { R.noDetailRow = true; return R; }
    var rowOf = function (k) { var r = S.required.spirit.data.getPath(R.data + '/' + k); return Object.assign({ key: k }, r || {}); };
    // WHAT THE LIST WAS HANDED, THE DETAIL IS TOO (the grant detail, handed no grants table, draws its not-configured note and
    // nothing of a grant): OPTIONS first, the row's own fields over them.
    var optsOf = function (row) { var o = Object.assign({}, OPTIONS[name] || {}, row); try { if (typeof row.label === 'string' && /^\s*\{/.test(row.label)) Object.assign(o, JSON.parse(row.label)); } catch (e) { /* kept */ } o.row = row; o.panel = true; return o; };
    var open = function (k) { return Promise.resolve(window.zzStack.open(k, { label: LONG, fill: function (p) { return D.create(p, optsOf(rowOf(k))); } })); };
    return open('zz-plant-1').then(function (a) {
      return wait(1500).then(function () {
        var pane = a.box.querySelector('.app-container-pane') || a.box.lastElementChild;
        R.detailDrew = !!pane && pane.childElementCount > 0;
        if (!R.detailDrew) return R;
        R.detailSpill = spills(pane);
        // Taller than its panel: some element reaches below it, and nothing between scrolls.
        var pr = pane.getBoundingClientRect();
        var tall = Array.prototype.filter.call(pane.querySelectorAll('*'), function (el) { return el.getClientRects().length && el.getBoundingClientRect().bottom > pr.bottom + 1; });
        R.detailTaller = tall.length > 0;
        R.detailNoScroll = tall.filter(function (el) { for (var n = el.parentElement; n; n = n.parentElement) { if (/auto|scroll/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1) return false; if (n === a.box) break; } return true; }).length;
        // 6: its title bar, the layer's first part, before and after its scrolling box is scrolled to its end. Made taller
        // than its panel by a part far taller put at the end of what it drew, as the browser general test grows a box.
        var bar = a.box.firstElementChild;
        var tallPart = document.createElement('div'); tallPart.style.cssText = 'height:5000px;width:1px;flex:none';
        (pane.lastElementChild || pane).appendChild(tallPart);
        var scroller = Array.prototype.filter.call(a.box.querySelectorAll('*'), function (n) { return /auto|scroll/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1; })[0] || null;
        R.detailScrolls = !!scroller;
        var top = bar.getBoundingClientRect().top;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
        a.box.scrollTop = a.box.scrollHeight;
        return wait(300).then(function () {
          R.barMoved = Math.abs(bar.getBoundingClientRect().top - top) > 1;
          if (scroller) scroller.scrollTop = 0;
          if (tallPart.parentNode) tallPart.parentNode.removeChild(tallPart);
          // 8: two details open, one closed: the other still draws in its own panel.
          var aHtml = pane.innerHTML;
          a.hide();
          return open('zz-plant-2').then(function (b) {
            return wait(1500).then(function () {
              var bp = b.box.querySelector('.app-container-pane') || b.box.lastElementChild;
              R.secondDrew = !!bp && bp.childElementCount > 0 && Array.prototype.some.call(bp.querySelectorAll('*'), function (el) { return el.getClientRects().length > 0; });
              R.firstTouched = pane.innerHTML !== aHtml;
              return R;
            });
          });
        });
      });
    });
  }).then(function () {
    // 9: THE SELECTOR ITSELF IN PANE FACE (box v123: "every search supports both pane and dropdown; a selector with only one
    // is red"): mounted alone in a sized box, given face pane, it draws its own list there, outside any selector row.
    var paneBox = document.createElement('div');
    paneBox.style.cssText = 'position:fixed;left:0;top:0;width:' + PANE_W + 'px;height:' + PANE_H + 'px;display:flex;flex-direction:column;overflow:hidden';
    document.body.appendChild(paneBox);
    var selP = S.required.spirit.element.search[name];
    try { selP.create(paneBox, Object.assign({}, OPTIONS[name] || {}, { face: 'pane' })); } catch (e) { R.paneError = true; }
    return wait(1000).then(function () {
      R.selectorPane = Array.prototype.some.call(paneBox.querySelectorAll('[id$="list"]'), function (x) { return !x.closest('[id$="-selectors"]') && x.getClientRects().length > 0; });
      if (paneBox.parentNode) paneBox.parentNode.removeChild(paneBox);
    });
  }).then(function () {
    // 7: the dropdown, its field near the right and bottom edges of the window.
    var corner = document.createElement('div');
    corner.style.cssText = 'position:fixed;right:4px;bottom:4px';
    document.body.appendChild(corner);
    var sel = S.required.spirit.element.search[name];
    try { sel.create(corner, Object.assign({}, OPTIONS[name] || {}, { face: 'dropdown' })); } catch (e) { R.dropError = true; return R; }
    return wait(1000).then(function () {
      var field = corner.querySelector('button[id$="field"]');
      if (!field) { R.noDropdown = true; return R; }
      field.click();
      return wait(800).then(function () {
        var pop = corner.querySelector('[id$="popup"]');
        if (!pop || pop.hidden || !pop.getClientRects().length) { R.dropNotOpen = true; return R; }
        var r = pop.getBoundingClientRect();
        R.drop = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight };
        return R;
      });
    });
  }).then(function () { delete R.made; return R; }, function () { delete R.made; R.fail = true; return R; });
})`;

// What each search reported, the page sessions first.
const REPORTS = {};
let world = false;
test.after(async function () {
  if (W.page) { try { W.page.sock.close(); } catch (e) { /* gone */ } try { W.page.kid.kill(); } catch (e) { /* gone */ } try { fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  if (W.node && !W.node.shared) { try { W.node.child.kill(); } catch (e) { /* gone */ } await sleep(300); try { LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(W.node); } catch (e) { /* scratch */ } }
});
const W = {};
test.run('there are searches to judge, a scratch node and a Chrome page', 0.2, async function () {
  if (!TARGETS.length) { world = true; return false; }
  const chrome = findChrome();
  if (!chrome) { world = true; return false; }
  W.node = await scratchNode(SERVERS);
  if (!W.node.up) { world = true; return false; }
  W.page = await chromePage(chrome);
  if (W.page.error) { world = true; return false; }
  return true;
}, test.limit.slow);
test.run('each search is mounted, planted and opened on a page of its own', 0.2, async function () {
  // Each search's checks are said once this ends, however it ends, and the run let go.
  try { return await openEach(); } finally { judgeAll(); test.release(); }
}, test.limit.long);
async function openEach() {
  if (world) return false;
  const failed = [];
  for (const n of TARGETS) {
    await W.page.send('Page.navigate', { url: W.node.base + '/face.html' });
    await until(function () { return W.page.evaluate('!!(window.spirit && window.spirit.readyPromise)').then(Boolean); }, 20000);
    let got = null;
    try { got = await Promise.race([W.page.evaluate('Promise.resolve(' + PAGE + '(' + JSON.stringify(n) + ',' + ROWS + ',' + JSON.stringify(LONG) + ',' + PANE_W + ',' + PANE_H + ',' + JSON.stringify(VIA_LIST) + ',' + JSON.stringify(OPTIONS) + ',' + JSON.stringify(SHAPES) + ',' + JSON.stringify(KEEP) + ',' + JSON.stringify(FORCE) + ')).then(function (r) { return JSON.stringify(r); })'), sleep(60000).then(function () { return null; })]); } catch (e) { got = null; }
    let r = null; try { r = JSON.parse(got); } catch (e) { r = null; }
    REPORTS[n] = r || { name: n, fail: true };
    if (REPORTS[n].fail) failed.push(n);
  }
  return !failed.length || false;
}

// Each check: true when search n breaks it, false when n keeps it, or { skip } when n gives it nothing to judge.
// ONE RED PER SEARCH (goal/G47.6, box: "the search test runs each search inside test.forScript for that search's script ...
// The key then names the item that failed; the title stays the same and greppable."): each check is said once per search
// it judges, reported for that search's script, spirit/element/search/<name>.js, while the run is held open; a search a
// check has nothing to judge in gets no test (a comment, never a green); a check no search could be judged by is red, said
// for this suite's own script.
const CHECKS = [];
// A PART OF A SEARCH HANDED TO THIS SUITE GETS ITS OWN LINE (goal/G47.1, Andy's contact list reds: "why the system doesn't
// catch them by itself"; wsl: "go from me"): testicle hands this suite a search and its parts in one run; with every check
// said for the search's own script, a part (its list.js, row.js, detail.js) got no result at all, testicle called that run
// crashed, and the part's old reds stood. Each part given says one line, green or red with its search; the faults stay said
// once, on the search.
const PARTS = GIVEN.filter(function (f) { const n = nameOf(f); return n && f !== selectorOf(n) && TARGETS.indexOf(n) !== -1; });
function judgeAll() {
  const redIn = {};
  CHECKS.forEach(function (c) {
    let judged = false;
    TARGETS.forEach(function (n) {
      const r = REPORTS[n];
      let red = true;
      if (!world && r && !r.fail) {
        const w = c.why(r);
        if (w && typeof w === 'object' && w.skip) return;
        red = !!w;
      }
      judged = true;
      if (red) redIn[n] = true;
      test.forScript(selectorOf(n), function () {
        test.run(c.title, 0.4, function () { return !red; }, test.limit.quick);
      });
    });
    if (!judged) test.run(c.title, 0.4, function () { return false; }, test.limit.quick);
  });
  PARTS.forEach(function (f) {
    const n = nameOf(f);
    const red = !!world || !REPORTS[n] || !!REPORTS[n].fail || !!redIn[n];
    test.forScript(f, function () {
      test.run('its search keeps the search rules', 0.4, function () { return !red; }, test.limit.quick);
    });
  });
}
const listOf = function (r) { return r.noList ? { skip: true } : r.noData ? { skip: true } : null; };
const plantedOf = function (r) { return listOf(r) || !r.drawn; };

CHECKS.push({ title: 'the list\'s box has a stated size, from its pane and not from its rows', why: function (r) {
    const pre = plantedOf(r); if (pre) return pre;
    return Math.abs(r.listAfter.h - r.listBefore.h) > 1 || r.listAfter.bottom > r.pane.bottom + 1;
  } });
CHECKS.push({ title: 'the list scrolls: its box keeps its size and its scrollHeight is greater than its clientHeight', why: function (r) {
    const pre = plantedOf(r); if (pre) return pre;
    return Math.abs(r.listAfter.h - r.listBefore.h) > 1 || !(r.scrolls.sh > r.scrolls.ch) || !/auto|scroll/.test(r.scrolls.y);
  } });
CHECKS.push({ title: 'when the list is scrolled, its title and buttons stay at the top', why: function (r) {
    const pre = plantedOf(r); if (pre) return pre;
    if (!r.fixedCount) return { skip: true };
    return r.moved > 0;
  } });
CHECKS.push({ title: 'a planted long value in a row wraps or clips, and nothing shows past the row\'s edge', why: function (r) {
    const pre = plantedOf(r); if (pre) return pre;
    if (r.rowSpill === null) return true;
    return r.rowSpill > 0;
  } });
const detailOf = function (r) {
  if (r.noDetail) return { skip: true };
  if (r.noDetailRow) return { skip: true };
  if (!r.detailDrew) return { skip: true };
  return null;
};
CHECKS.push({ title: 'the detail keeps a planted long value inside its panel, and scrolls when taller', why: function (r) {
    const pre = detailOf(r); if (pre) return pre;
    return r.detailSpill > 0 || (!!r.detailTaller && r.detailNoScroll > 0);
  } });
CHECKS.push({ title: 'the detail\'s title bar stays pinned when it scrolls', why: function (r) {
    const pre = detailOf(r); if (pre) return pre;
    if (!r.detailScrolls) return true;
    return !!r.barMoved;
  } });
CHECKS.push({ title: 'the selector\'s dropdown stays inside the window when opened near the right and bottom edges', why: function (r) {
    if (r.dropError) return true;
    if (r.noDropdown) return true;
    if (r.dropNotOpen) return true;
    const d = r.drop;
    return d.left < -1 || d.top < -1 || d.right > d.w + 1 || d.bottom > d.h + 1;
  } });
// Box v123: "every search supports both pane and dropdown; a selector with only one is red (today testicle.js, pane only,
// and api.js, dropdown only)". Andy: "any search must support both pane AND dropdown". The dropdown is 7's.
CHECKS.push({ title: 'the selector, given the pane face, draws its own list in the pane', why: function (r) {
    if (r.paneError) return true;
    return !r.selectorPane;
  } });
CHECKS.push({ title: 'with two details open and one closed, the other still draws in its own panel in a page', why: function (r) {
    const pre = detailOf(r); if (pre) return pre;
    return !r.secondDrew || !!r.firstTouched;
  } });
