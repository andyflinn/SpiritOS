'use strict';

// spirit/run/spirit/test/spirit-sibling-generalRules.js <file>
// THE GENERAL RULES OF A SHELL APP OR ELEMENT (goal/G41.18), run once per file it judges, the file its argument, as
// ./spirit-child-generalRules.js is for a module (spec: ./spirit-sibling-generalRules.md). ITS NAME IS ITS REACH
// (./TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a -sibling-
// test beside spirit.js judges every module in spirit/run/ and below that has its own test, shell/ and the agent tables'
// pages alike (goal/G41.27; Andy: "1. The checks judge every module under spirit/run/: the test is
// spirit/run/test/spirit-sibling-generalRules.js instead of shell-child. No page moves; one test covers shell/ and the
// agent tables alike."). It was shell/test/boot-sibling-generalRules.js, its reach shell/ and hung on shell/boot.js. Andy: "we may require a
// ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing, THAT's were a general
// test belongs"; "shell-child-generalRules.js can also run headless chrome test to assert UI standards..."; "who says it
// shouln't check general \"mountability\" of elements and apps?", "mount each element or app all by itself, to \"unit\"
// tests?"; "add that test: shell-child-generalRules.js". Each file is its own test id; a rule a file breaks fails that
// file's test.
// DISCREPANCY WITH ANDY's RULES: the reach above runs once per file (goal/G41.19, goal/G43.2); since goal/G43.18 moved
// spirit.js to spirit/run/spirit/spirit.js, testModule.js no longer counts this as a general test (./TEST_SYSTEM.md). It
// is run once with no file, every() below finds no file in its reach, and it goes red with "testModule.js gives it no
// file to judge" after its icon-loading checks.
//
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, ../spirit/test/DEBUG.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
// Its arguments: the file it judges, if any; the verifier's --verify-port <n> is the reporter's, and passed on.
const ARGS = process.argv.slice(2);
const VERIFY = ARGS.indexOf('--verify-port') !== -1 ? ARGS.slice(ARGS.indexOf('--verify-port'), ARGS.indexOf('--verify-port') + 2) : [];
const arg = String(ARGS.filter(function (a) { return VERIFY.indexOf(a) === -1; })[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
// EVERY TEST NAME STARTS WITH THE PATH (goal/G41.19; Andy: "please start the test descriptions always with the exact URL
// to the server, without \"/DEBUG\" service", and, box v13, "EVERY MOTHERFUCKING TEST NAME in the product three STARTS
// WITH THE MUTHERCUCKING PATH"): each section is named by the address this file's page is opened at, /DEBUG left off.
const ADDRESS = '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html';
const NAMED = ADDRESS.slice('/DEBUG'.length);
// WHAT IS MOUNTED IS KNOWN BY ITS PATH (goal/G41.19, box v17; Andy: "the test knows bloody fucking well if a scripts is
// an app (from the path pattern), why the fuck would would it need manifests for standard patterns?",
// "the test knows fucking well, which are elements scripts in ./shell/js/"): an app is shell/<app>/<app>.js, an element any script
// under spirit/element/. Anything else in its reach is neither, and is not mounted.
// THE AGENT TABLES' PAGES (goal/G41.27; Andy, Q5: "it covers them, too"): the tables' shared element, its row editor
// (goal/G41.28) and each table's list and editor live in spirit/app/agent/table/ since goal/G43.12, which no pattern below
// matches; there they are neither, and are not mounted. spirit/app/agent/agent.js is an element by the new-folder rule.
function kindOf(file) {
  const f = String(file || '');
  if (/^spirit\/element\/.+\.js$/.test(f)) return 'element';
  // THE APP FAMILY'S SELECTOR (goal/G43.2): an element in the new folder, judged as the shell's are.
  if (/^spirit\/app\/appSelector(\/[^/]+)?\.js$/.test(f)) return 'element';
  // AN APP IN THE NEW FOLDER IS AN ELEMENT TOO (goal/G43.2; Andy, box: "both of these apps are face-app skeletons (elements)").
  if (/^spirit\/app\/([^/]+)\/\1\.js$/.test(f)) return 'element';
  const m = /^shell\/([^/]+)\/([^/]+)\.js$/.exec(f);
  return m && m[1] === m[2] ? 'app' : '';
}
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/agent/node.json (spirit/jobs.js).
const SERVERS = { servers: ['agent'] };
// A REDRAW PROVED IN THE PAGE'S OWN TEST (Andy, Q24, "yes."): a page whose watch draws only for an item open, which a
// bare mount never has; its own test's check, by its words, stands for it here.
const OWN_PROOF = {
  'spirit/app/desk/element/deskDetails/deskDetails.js': { test: 'spirit/app/desk/element/deskDetails/test/deskDetails.js', check: 'a verifier publish taken into spirit.data redraws the run' },
};
// THE LONGEST FIELD THE RULES ALLOW (spirit/fieldRules.js): a field that keeps more than this holds no rule at all.
const FIELD_RULES = require(path.join(RUN, 'spirit', 'fieldRules.js'));
const MOST_BYTES = Math.max.apply(null, Object.keys(FIELD_RULES).filter(function (k) { return /MAX_BYTES$/.test(k) && typeof FIELD_RULES[k] === 'number'; }).map(function (k) { return FIELD_RULES[k]; }));
// THE PAGE WATCHED FROM BEFORE ITS FIRST SCRIPT (goal/G41.27): put on the page ahead of spirit.js, it keeps what the
// rules below are judged by, each call known by the file whose code made it (a module runs with its path as its
// sourceURL). Spirit's own code is spirit.js, its families (spirit-interface/), spirit/client/ and the page's data set
// (spirit/data.js); shell/boot.js, the face's own transport, is the one exception the network rule names
// (Andy: "boot.js MUST be an exception to the rules.").
//   net:   every fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon, with the file that made it;
//   subs:  every spirit.events.subscribe and spirit.data.watchPath (a family view's, spirit.data.viewAt(node, family).watch, among them), live until let go, and whether a module made it;
//   writes: every call to the node a module made that changes something (not the stream or an interface, no read op,
//           no read verb);
//   moved: what the box changed while a write was out, other than a busy mark, a button's disabled state or fine print.
const WATCH = String.raw`(function () {
  var W = window.spiritWatch = { net: [], subs: [], writes: [], moved: [], out: 0, searches: [] };
  var SPIRIT = /(\/spirit\.js|spirit-interface\/|spirit\/client\/|spirit\/data\.js|shell\/boot\.js)$/;
  function frames() { return String(new Error().stack || '').split('\n').slice(1).map(function (l) { return l.trim(); }).filter(function (l) { return l.indexOf('spiritWatch.js') === -1 && /^at /.test(l); }); }
  function file(f) { var m = /\(?([^()\s]+?):\d+:\d+\)?$/.exec(f); return m ? m[1].replace(/^https?:\/\/[^/]+/, '') : ''; }
  function spirits(f) { return SPIRIT.test(file(f)); }
  function caller() { var f = frames()[0] || ''; return { file: file(f), spirit: spirits(f) }; }
  function moduleMade() { return frames().some(function (f) { var x = file(f); return !!x && !SPIRIT.test(x); }); }
  var READ_OPS = ['search', 'get', 'list', 'status', 'card', 'read', 'tree', 'history'];
  var READ_VERB = /\.(search|get|list|status|card|read|tree|history|load|loadFile|ls|stat)$/;
  function isWrite(body) {
    var b = null; try { b = JSON.parse(String(body || '')); } catch (e) { return null; }
    // Spirit's own asks are no write: the stream (events.subscribe) and a family's interface (api).
    if (!b || typeof b.call !== 'string' || b.call === 'events.subscribe' || b.call === 'api') return null;
    var op = b.args && b.args.op;
    if (op ? READ_OPS.indexOf(String(op)) !== -1 : READ_VERB.test(b.call)) return null;
    return b.call + (op ? ' ' + op : '');
  }
  // A PRESS WATCHED: from the press until the node has answered every write it sent; judged only when it sent one.
  var watching = null; var buf = []; var w0 = 0;
  function allowed(r) {
    var t = r.target && r.target.nodeType === 1 ? r.target : r.target && r.target.parentElement;
    if (!t) return true;
    if (r.type === 'attributes' && t.tagName === 'BUTTON' && /^(disabled|aria-busy|class)$/.test(r.attributeName)) return true;
    var nodes = [t].concat(Array.prototype.slice.call(r.addedNodes || []), Array.prototype.slice.call(r.removedNodes || []));
    if (nodes.every(function (n) { return n.nodeType === 1 ? (n.classList.contains('shell-busy') || !!n.closest('.shell-busy')) : !!(t.closest && t.closest('.shell-busy')); })) return true;
    return !!(t.closest && t.closest('.job-manifest-note, .job-start-error, .job-refusal, .fine-print'));
  }
  function chain(el) { var box = window.spiritMount && window.spiritMount.box; var parts = []; for (var n = el; n && n !== box && n.tagName; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '')); } return parts.join(' > '); }
  function stop() { if (!watching) return; buf = buf.concat(watching.takeRecords()); watching.disconnect(); watching = null; }
  function opened() { W.out += 1; }
  function closed() { W.out = Math.max(0, W.out - 1); if (!W.out && W.writes.length > w0) stop(); }
  W.press = function (i) {
    var box = window.spiritMount && window.spiritMount.box;
    var b = box && Array.prototype.slice.call(box.querySelectorAll('button')).filter(function (x) { return x.isConnected && !x.disabled && x.getClientRects().length; })[i];
    if (!b) return false;
    stop(); buf = []; w0 = W.writes.length;
    watching = new MutationObserver(function (list) { buf = buf.concat(list); });
    watching.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
    try { b.click(); } catch (e) { /* its own fault, judged above */ }
    return true;
  };
  W.settle = function () {
    stop();
    if (W.writes.length > w0) buf.forEach(function (r) { if (!allowed(r)) W.moved.push(r.type + ' ' + chain(r.target.nodeType === 1 ? r.target : r.target.parentElement)); });
    buf = [];
    return W.out;
  };
  var realFetch = window.fetch;
  window.fetch = function (url, o) {
    W.net.push(Object.assign({ kind: 'fetch', url: String(url) }, caller()));
    // A write is the module's: made with its code on the way, spirit carrying it.
    var w = moduleMade() ? isWrite(o && o.body) : null;
    if (!w) return realFetch.apply(this, arguments);
    W.writes.push(w); opened();
    return realFetch.apply(this, arguments).then(function (r) { setTimeout(closed, 0); return r; }, function (e) { setTimeout(closed, 0); throw e; });
  };
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) { W.net.push(Object.assign({ kind: 'XMLHttpRequest', url: String(url) }, caller())); return xo.apply(this, arguments); };
  ['WebSocket', 'EventSource'].forEach(function (k) { var C = window[k]; if (!C) return; window[k] = function (url) { W.net.push(Object.assign({ kind: k, url: String(url) }, caller())); return new (Function.prototype.bind.apply(C, [null].concat(Array.prototype.slice.call(arguments))))(); }; window[k].prototype = C.prototype; });
  if (navigator.sendBeacon) { var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (url) { W.net.push(Object.assign({ kind: 'sendBeacon', url: String(url) }, caller())); return sb.apply(null, arguments); }; }
  function kept(kind, fn) {
    return function () {
      var s = { kind: kind, mine: moduleMade(), live: true, path: kind === 'data.watch' ? String(arguments[0] || '') : '' }; W.subs.push(s);
      var off = fn.apply(this, arguments);
      return function () { s.live = false; return typeof off === 'function' ? off.apply(this, arguments) : undefined; };
    };
  }
  // EVERY SEARCH THE PAGE MAKES, as it is made (goal/G41.28): its spirit.data branch, and whether it ranks rows of its own.
  function searches(els) {
    if (!els || typeof els !== 'object' || els.__searched) return;
    try { Object.defineProperty(els, '__searched', { value: true }); } catch (e) { return; }
    var cur = window.spirit.element.search;
    function wrap(v) { if (v && typeof v.create === 'function' && !v.create.__kept) { var c = v.create; v.create = function (host, o) { var x = o || {}; W.searches.push({ data: typeof x.data === 'string' ? x.data : '', rows: typeof x.rows === 'function', verb: String(x.verb || ''), face: String(x.face || 'pane') }); (window.spiritSearchHosts = window.spiritSearchHosts || []).push(host); return c.apply(this, arguments); }; v.create.__kept = true; } }
  // WHAT IT WATCHES, IT DRAWS FROM: a marked row written into each spirit.data path the module watches, and whether its
  // box changed for it within a second. A watch path is by server node first (goal/G41.28): '<node>/<family>/<branch>',
  // a branch, or '<node>/<family>/<branch>/<row>', a row; a watch of the home node holds '~' for the node, the page's
  // own node (data.home()) once it knows it.
  W.probe = function () {
    var D = window.spirit && window.spirit.data;
    var box = window.spiritMount && window.spiritMount.box;
    var paths = []; W.subs.forEach(function (x) { if (x.mine && x.live && x.kind === 'data.watch' && x.path && paths.indexOf(x.path) === -1) paths.push(x.path); });
    if (!D || !box || typeof D.setPath !== 'function') return Promise.resolve([]);
    // A box that shows nothing (a selector hidden until its family is chosen) has nothing to redraw: not judged.
    var shown = Array.prototype.some.call(box.querySelectorAll('*'), function (el) { return el.getClientRects().length > 0; });
    if (!shown) return Promise.resolve(paths.slice(0, 6).map(function (p) { return { path: p, hidden: true }; }));
    return paths.slice(0, 6).reduce(function (chain, p, i) {
      return chain.then(function (out) {
        var real = p.charAt(0) === '~' && typeof D.homeNode === 'function' ? D.homeNode() + p.slice(1) : p;
        var parts = real.split('/');
        // A row's path names its row; a branch's gets a marked row of its own; a family's whole watch, a branch of its own.
        var whole = parts.length >= 4 && parts[3] !== '';
        var at = whole ? real : parts.length >= 3 && parts[2] !== '' ? parts.slice(0, 3).join('/') + '/zz-probe-' + i : parts.slice(0, 2).join('/') + '/zz-probe/zz-probe-' + i;
        var before = whole && typeof D.getPath === 'function' ? D.getPath(at) : undefined;
        var mark = 'zzprobe' + i;
        var changed = 0;
        var mo = new MutationObserver(function (l) { changed += l.length; });
        mo.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
        // A row that is there keeps its shape, each of its text fields marked, so a reader that checks its fields still
        // takes it; a new row is the marked fields alone.
        var probe = { key: whole ? undefined : 'zz-probe-' + i, label: mark, name: mark, title: mark, text: mark, id: whole ? undefined : 'zz-probe-' + i };
        if (whole && before && typeof before === 'object') {
          probe = Object.assign({}, before);
          Object.keys(probe).forEach(function (k) { if (typeof probe[k] === 'string') probe[k] = mark; });
        }
        try { D.setPath(at, probe); } catch (e) { /* the branch refused it */ }
        return new Promise(function (r) { setTimeout(r, 1000); }).then(function () {
          mo.disconnect();
          try { if (whole && before !== undefined) D.setPath(at, before); else D.delPath(at); } catch (e) { /* left */ }
          out.push({ path: p, redrew: changed > 0 });
          return out;
        });
      });
    }, Promise.resolve([]));
  };
  // What each search draws that its spirit.data branch does not hold: the keys of its rows on screen, against the branch.
  W.drawnOutside = function () {
    var D = window.spirit && window.spirit.data;
    return W.searches.map(function (x, i) {
      var host = (window.spiritSearchHosts || [])[i];
      if (!host || !host.isConnected || !x.data || !D || typeof D.rowsOf !== 'function') return { verb: x.verb, data: x.data, drawn: 0, outside: [] };
      var held = {}; (D.rowsOf(x.data) || []).forEach(function (r) { held[String(r.key)] = true; });
      var keys = Array.prototype.map.call(host.querySelectorAll('[data-key]'), function (el) { return String(el.getAttribute('data-key')); });
      return { verb: x.verb, data: x.data, drawn: keys.length, outside: keys.filter(function (k) { return !held[k]; }).slice(0, 5) };
    });
  };
    // spirit.element.search since goal/G43.18: its create is assigned into it after it is made, so it is wrapped when read.
    Object.defineProperty(els, 'search', { configurable: true, enumerable: true, get: function () { wrap(cur); return cur; }, set: function (v) { cur = v; wrap(v); } });
    wrap(cur);
  }
  function hook(o) {
    if (!o || typeof o !== 'object' || o.__watched) return;
    Object.defineProperty(o, '__watched', { value: true });
    var els = o.element;
    Object.defineProperty(o, 'element', { configurable: true, enumerable: true, get: function () { return els; }, set: function (v) { els = v; searches(v); } });
    searches(els);
    [['events', 'subscribe'], ['data', 'watch']].forEach(function (k) {
      var cur = o[k[0]];
      function wrap(v) {
        if (v && typeof v[k[1]] === 'function' && !v[k[1]].__kept) { var f = kept(k[0] + '.' + k[1], v[k[1]]); f.__kept = true; v[k[1]] = f; }
        // A family's view (goal/G41.28), spirit.data.viewAt(node, family): a manager watches through it, so its watch is kept
        // as one on spirit.data, under the whole path it watches.
        if (k[0] === 'data' && v && typeof v.at === 'function' && !v.at.__kept) {
          var at = v.at;
          v.at = function () {
            var view = at.apply(this, arguments);
            var node = arguments[0];
            if (view && typeof view.watch === 'function') {
              // The path as the view watches it: the node's id, or '~' for the home node, then the family, then p.
              var own = view.watch;
              var vw = kept('data.watch', function (whole, fn) { return own(whole.rel, fn); });
              view.watch = function (p, fn) {
                var whole = new String((node ? v.nodeId(node) : '~') + '/' + view.family + '/' + String(p || ''));
                whole.rel = p;
                return vw(whole, fn);
              };
            }
            return view;
          };
          v.at.__kept = true;
        }
      }
      Object.defineProperty(o, k[0], { configurable: true, enumerable: true, get: function () { return cur; }, set: function (v) { cur = v; wrap(v); } });
      wrap(cur);
    });
  }
  var real = window.spirit;
  Object.defineProperty(window, 'spirit', { configurable: true, get: function () { return real; }, set: function (v) { real = v; hook(v); } });
  hook(real);
}());
//# sourceURL=spiritWatch.js`;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
// NOTHING JUDGED IS NO PASS (goal/G41.28; Andy: "You fucking fudge tests to get away with total fucking sloppyness!"):
// a rule that found nothing to judge on this page says so, and counts as neither green nor red. It is judged where it
// can be: in the code, or on a page that gives it something.
function unjudged(what) { test.comment('not judged on this page: ' + what); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The scratch node and headless Chrome, shared with any test that opens a page (spirit/test/headLessChrome.js).
const { sleep, until, findChrome, scratchNode, chromePage } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (spirit/test/testReport.js). This run records one line per file, named by its address.
// EVERY FILE THAT PAINTS AN ICON LOADS THE ICON ELEMENT (goal/G41.23; Q1, Andy: "plus the intrinsic apps, plus the
// icons app. all apps that use icons."; "wsl, Go" on: a second rule reads the code, so that it misses none). A bare mount
// draws no data, so most icons are seen only here. AN ICON STANDS ALONE (Andy: "isn't a glyph inside flowing text just
// like another inline character? ... glyphs are legal in labels and description true, and in that context they don't
// need special handling", then "narrow the rules so."): a shell script (no test, no vendor code) whose code, comments
// left out, holds a pictograph (Unicode Extended_Pictographic) alone in a string or alone between two tags, or that
// paints icons it is handed (named below, read by hand), loads spirit/element/icon.js. A glyph among words is text. Each is
// its own check, named by its path. painters() reads only the files git tracks under shell/, so the spirit/ entries of
// FROM_DATA and TEXT_ONLY are never read, and shell/boot.js (now spirit/shell/boot.js, goal/G43.18), shell/apps/apps.js
// and shell/icons/icons.js are no longer in the tree.
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'spirit/app/contact/contact.js', 'spirit/element/search/icon/listElement.js',
  'spirit/element/search/icon/rowElement.js', 'spirit/element/search/icon.js', 'spirit/element/workBench.js'];
// A pictograph, its variation selectors and joiners with it, alone in quotes or alone between > and <.
const ALONE = /(['"`]|>)\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*(['"`]|<)/u;
// A glyph alone in a string that is drawn only among words, read by hand: a status or a mark put before a name
// (Andy: "glyphs are legal in labels and description true").
const TEXT_ONLY = {
  'spirit/element/search/contact/detailElement.js': 'its blocked mark is drawn before the person\'s name',
  'spirit/element/search/contact/listElement.js': 'its filter icons are drawn before their words by the search element\'s chips',
};
function painters() {
  const tracked = require('child_process').execFileSync('git', ['ls-files', 'shell'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    if (!/\.js$/.test(f) || /\/test\//.test(f) || VENDORED_FOLDERS.holds(f) || f ==='spirit/element/icon.js' || !fs.existsSync(path.join(RUN, f))) return false;
    if (FROM_DATA.indexOf(f) !== -1) return true;
    if (TEXT_ONLY[f]) return false;
    const code = fs.readFileSync(path.join(RUN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    return ALONE.test(code);
  });
}
function iconsLoaded() {
  test.subHeading('every shell file that paints an icon loads the icon element');
  const files = painters();
  test.comment(files.length + ' shell files paint icons: ' + files.join(', '));
  test.comment('glyphs among words only, read by hand: ' + Object.keys(TEXT_ONLY).map(function (f) { return f + ' (' + TEXT_ONLY[f] + ')'; }).join('; '));
  files.forEach(function (f) {
    const src = fs.readFileSync(path.join(RUN, f), 'utf8');
    // A file that hands its glyphs to the one-row form (goal/G41.27) paints them through it: rowForm loads the icon element
    // itself (rule/26).
    const through = src.indexOf('spirit/element/icon.js') !== -1 ? 'loads spirit/element/icon.js' : src.indexOf('spirit/element/rowForm.js') !== -1 ? 'paints them through spirit/element/rowForm.js, which loads it' : '';
    ok(!!through, f + ': it paints icons and ' + through, f + ': it paints icons and never loads spirit/element/icon.js');
  });
}

// RUN://PROCESS IS NAMED NOWHERE (goal/G43.20, goal/G43.30). Andy, G43.20: "that whole run://process folder NEEDS killing
// with ALL references to it in code, test and documentation."; G43.30: "WSL, your tests make sure that none of the affected
// modules even mention "spirit/run/process/"". Even mention: the module's whole text is read, its comments too.
const PROCESS_NAMED = /spirit\/run\/process\b|run:\/\/?process\b/;
function namesProcess(f) { try { return PROCESS_NAMED.test(fs.readFileSync(path.join(RUN, f), 'utf8')); } catch (e) { return false; } }
function processNamers() {
  const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)) && namesProcess(f);
  });
}
function noProcessAnywhere() {
  test.subHeading('no module of spirit/run/ mentions spirit/run/process/');
  const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f); });
  ok(tracked.length > 0, 'the world: ' + tracked.length + ' modules read', 'git ls-files gave no module to read');
  const named = processNamers();
  ok(tracked.length > 0 && !named.length, 'none of the ' + tracked.length + ' names spirit/run/process or run://process, in code or comment', named.length + ' still name it: ' + short(named));
}

// EVERY BRANCH IS NAMED AS ITS FOLDER (goal/G43.31). Andy: "The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
// motherfucking <name> in spirit/app/<name>....", and "make sure, IN THIS ITEM that family names MATCH folder names". The
// branch a data.js makes (makeFamily('<name>')) is the name of the folder it stands in, spirit/<name>/ or spirit/app/<name>/.
function branchOf(f) {
  const m = /\bmakeFamily\(\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(path.join(RUN, f), 'utf8'));
  return m ? m[1] : null;
}
function branchFolders() {
  const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) { return /^spirit\/(app\/)?[^/]+\/data\.js$/.test(f) && fs.existsSync(path.join(RUN, f)); });
}
function branchesNamedAsFolders() {
  test.subHeading('every branch is named as its folder: spirit/<name>/ and spirit/app/<name>/ make <name>');
  const files = branchFolders();
  const named = files.filter(function (f) { return branchOf(f) !== null; });
  ok(named.length > 0, 'the world: ' + named.length + ' data.js files make a branch', 'no data.js makes a branch: nothing judged');
  const off = named.filter(function (f) { return branchOf(f) !== path.basename(path.dirname(f)); }).map(function (f) { return f + ' makes ' + branchOf(f); });
  ok(named.length > 0 && !off.length, 'each of the ' + named.length + ' makes the branch of its folder\'s name', off.length + ' do not: ' + short(off));
}

// RUN://TEST/ MOVES INTO RUN://SPIRIT/TEST/ (goal/G43.32, the box). Andy: "we'll move the contents of run://test/   into
// run://spirit/test/ first.", on Q2: "We need special rules for run://spirit/test/  it will be where run://spirit/app/test/
// finds it's main tools.", and his concluding point: "this move will free the run:// folder namespace and SpiritOS will
// only take up 1 name ("spirit") in it. .gitignore will be updated to ignore the run:/ folder except for run://spirit/".
// The old folder's name is built, never written, so this file and its .md are the only ones that may name it, and the
// scan leaves those two out.
const OLD_TEST = 'spirit/run/' + 'test/';
const OLD_NAMED = new RegExp(OLD_TEST.replace(/\//g, '\\/') + '|run:\\/\\/?' + 'test\\/');
// The 19 files of run://test/ on 2026-11-10, by their place inside it.
const MOVED = ['TEST_SYSTEM.md', 'headLessChrome.js', 'testModule.js', 'testReport.js', 'spirit-child-generalRules.js',
  'spirit-sibling-generalRules.js', 'spirit-sibling-generalRules.md', 'spirit-sibling-noFuckingGarbage.js', 'spirit-sibling-noFuckingGarbage.md',
  'spirit-sibling-searchRules.js', 'spirit-sibling-searchRules.md', 'spirit-sibling-testReachRules.js', 'spirit-sibling-testReachRules.md',
  'test/testModule.js', 'test/testModule.md', 'test/testReport.js', 'test/testReport.md', 'test/testReport-verifier.js', 'test/testReport-verifier.md'];
// The tools of run://spirit/test/: tools, not tests (Q2).
const TOOLS = ['testReport.js', 'testModule.js', 'headLessChrome.js'];
const SELF = ['spirit-sibling-generalRules.js', 'spirit-sibling-generalRules.md'];
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
function ignoredByGit(rel) {
  try { require('child_process').execFileSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: REPO, stdio: 'ignore' }); return true; }
  catch (e) { return false; }
}
function runTestMoved() {
  test.subHeading('run://test/ is moved into run://spirit/test/');
  const left = gitIn(RUN, ['ls-files', '--', 'test/']);
  ok(!left.length, 'run://test/ holds no tracked file', left.length + ' still tracked there: ' + short(left));
  const missing = MOVED.filter(function (f) { return !fs.existsSync(path.join(RUN, 'spirit', 'test', f)); });
  ok(!missing.length, 'run://spirit/test/ holds all ' + MOVED.length + ' moved files, test/test/ included', missing.length + ' are not there: ' + short(missing));

  test.subHeading('nothing under spirit/run/ names run://test/');
  const tracked = gitIn(RUN, ['ls-files']).filter(function (f) {
    return /\.(js|md|html|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && SELF.indexOf(path.basename(f)) === -1 && fs.existsSync(path.join(RUN, f));
  });
  ok(tracked.length > 0, 'the world: ' + tracked.length + ' files read, tests and documents included', 'git ls-files gave no file to read');
  const naming = tracked.filter(function (f) { try { return OLD_NAMED.test(fs.readFileSync(path.join(RUN, f), 'utf8')); } catch (e) { return false; } });
  ok(tracked.length > 0 && !naming.length, 'none of the ' + tracked.length + ' names the old run://test/, in code, comment or document', naming.length + ' still name it: ' + short(naming));

  test.subHeading('run://spirit/test/\'s tools are not tests');
  const moduleAt = [path.join(RUN, 'spirit', 'test', 'testModule.js'), path.join(RUN, 'test', 'testModule.js')].filter(function (p) { return fs.existsSync(p); })[0];
  const listed = moduleAt ? require(moduleAt).testsFor('').map(function (t) { return t.test; }) : [];
  ok(listed.length > 0, 'the world: testModule.js lists ' + listed.length + ' tests', 'no testModule.js to ask');
  const toolsListed = listed.filter(function (t) { return TOOLS.indexOf(path.posix.basename(t)) !== -1 && /^(spirit\/)?test\/[^/]+$/.test(t); });
  ok(listed.length > 0 && !toolsListed.length, 'testModule.js lists none of ' + TOOLS.join(', ') + ' as a test', 'it lists them as tests: ' + short(toolsListed));

  test.subHeading('git ignores run:// except run://spirit/');
  const lines = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; });
  ok(lines.indexOf('/spirit/run/*') !== -1 && lines.indexOf('!/spirit/run/spirit/') !== -1, '.gitignore holds /spirit/run/* and !/spirit/run/spirit/', 'it lacks ' + short(['/spirit/run/*', '!/spirit/run/spirit/'].filter(function (l) { return lines.indexOf(l) === -1; })));
  const dead = lines.filter(function (l) {
    const p = l.replace(/^!/, '').replace(/^\//, '');
    return p.indexOf('spirit/run/') === 0 && p.indexOf('spirit/run/spirit/') !== 0 && l !== '/spirit/run/*';
  });
  ok(!dead.length, 'no other line names a path under run:// outside run://spirit/, since run://* covers it', dead.length + ' left: ' + short(dead));
  const outside = 'spirit/run/zz-g4332-not-tracked.txt';
  const inside = 'spirit/run/spirit/zz-g4332-not-tracked.txt';
  ok(ignoredByGit(outside), 'a new file in run:// outside spirit/ is ignored (' + outside + ')', 'git does not ignore ' + outside);
  ok(!ignoredByGit(inside), 'a new file in run://spirit/ is not ignored (' + inside + ')', 'git ignores ' + inside);
}

// EVERY PRODUCT SCRIPT LOADS THE TREE THROUGH spirit.require (goal/G43.32, the box, testing point 2). Andy: "every script
// (other than spirit/spirit.js) must start with ... 'use strict'; 'let spirit = require(spirit) or the html pages <script
// href=spirit/spirit.js> kind of thing; all other scripts should be loaded using spirit.require()", "node modules
// designated to provide node.js functionality: require('http' | 'fs' etc.) are exempt", "i see no reason codemirrors
// vendored scripts cannot be spirit.required....", and "just rename the bloody script" for a name with a dot of its own.
// Judged by reading each product file (the box: "this item deals with PRODUCT files, NOT tests"); vendored code is
// spirit.required by others and not judged as ours.
const BUILTIN = require('module').builtinModules;
// The code with its comments blanked, strings and line breaks kept; with bare, the strings' insides blanked too, every
// offset the same, so a require written inside a string is found as none.
function codeOf(src, bare) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += bare ? c + src.slice(i + 1, j).replace(/[^\n]/g, ' ') + (j < src.length ? c : '') : src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
// Why a product script breaks the shape, one reason a break; [] when it holds.
function shapeBreaks(rel) {
  const why = [];
  const stem = path.posix.basename(rel, '.js');
  if (stem.indexOf('.') !== -1) why.push('its name holds a dot of its own (' + path.posix.basename(rel) + '): "just rename the bloody script"');
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ['it cannot be read']; }
  const code = codeOf(src);
  if (!/^\s*(['"])use strict\1\s*;/.test(code)) why.push('it does not start with \'use strict\';');
  if (rel === 'spirit/spirit.js') return why;
  // Every plain require: the first takes spirit.js; any other names one of node's own modules.
  const bare = codeOf(src, true);
  const re = /(^|[^.\w$])require\s*\(/g;
  let m;
  let first = true;
  while ((m = re.exec(bare))) {
    const open = m.index + m[0].length;
    const arg = (/^\s*([^)]*)\)/.exec(code.slice(open)) || ['', ''])[1].trim();
    const lit = /^(['"])([^'"]*)\1$/.exec(arg);
    const named = lit ? lit[2] : '';
    const spiritJs = /(^|\/)spirit\.js$/.test(named) || /['"]spirit\.js['"]\s*\)?$/.test(arg);
    const line = code.slice(0, m.index).split('\n').length;
    if (spiritJs) { first = false; continue; }
    if (!first && lit && (BUILTIN.indexOf(named) !== -1 || BUILTIN.indexOf(named.replace(/^node:/, '')) !== -1)) continue;
    why.push(first ? 'its first load is not spirit.js: require(' + arg.slice(0, 80) + ') at line ' + line : 'it loads require(' + arg.slice(0, 80) + ') at line ' + line + ', not through spirit.require');
    first = false;
  }
  return why;
}
function productScripts() {
  return require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
}
function everyScriptShaped() {
  test.subHeading('every product script: use strict, spirit first, the tree only through spirit.require');
  const all = productScripts();
  ok(all.length > 100, 'the world: ' + all.length + ' product scripts read (tests and vendored code left out)', 'only ' + all.length + ' product scripts found: too few to judge');
  const broken = all.map(function (f) { return { f: f, why: shapeBreaks(f) }; }).filter(function (x) { return x.why.length; });
  ok(all.length > 100 && !broken.length, 'all ' + all.length + ' hold the shape', broken.length + ' of ' + all.length + ' do not; the first: ' + short(broken.slice(0, 5).map(function (x) { return x.f + ': ' + x.why[0]; })));
}

// EVERY PRODUCT SCRIPT, PLACED WHERE IT IS REQUIRED (goal/G43.32, the box, testing point 3; Andy: "a general test for
// any scriptFile.js is to spirit.require() it.", Q5: "doesn't spirit.require() only load a script, store it at
// spirit.required.<path>  and run it once.", "element scripts themselves are who installs the element factory at
// spirit.element.<path-of-element-script>", and "I'm NOT demanding that all scripts load in all environments, I'm
// demanding that they're placed in the spirit object according to these rules IF they are required."). Each script is
// spirit.require()d alone on the node and on a page; where it loads, it stands at spirit.required.<its path>, and on
// the node the answer came at once. Where it does not load (a page element on the node, a server on a page) nothing is
// judged. An element script, one that calls installSpiritElement, has a factory with a create at spirit.element.<its
// path> once required on a page. The node side runs in the scratch copy beside the scratch node, each script in a
// process of its own; the page side on the scratch node's face page, a fresh page each. Never Andy's tree or node.
function placeKeys(rel) { return rel.replace(/\.js$/, '').split('/'); }
function isElementScript(rel) { return /\binstallSpiritElement\s*\(/.test(codeOf(fs.readFileSync(path.join(RUN, rel), 'utf8'), true)); }
function requireOnNode(run, rel) {
  return new Promise(function (resolve) {
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "spirit.js"));' +
      'let at = null, err = ""; try { at = s.require(' + JSON.stringify(rel) + '); } catch (e) { err = String(e && e.message || e); }' +
      'const keys = ' + JSON.stringify(placeKeys(rel)) + '; const place = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, s.required);' +
      'process.stdout.write("\\n@@" + JSON.stringify({ err: err, promise: !!(at && typeof at.then === "function"), placed: place !== undefined && place === at }) + "\\n"); process.exit(0);';
    const kid = spawn(process.execPath, ['-e', probe], { cwd: run, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    kid.stdout.on('data', function (d) { out += d; });
    kid.stderr.on('data', function (d) { out += d; });
    const t = setTimeout(function () { kid.kill('SIGKILL'); }, 20000);
    kid.on('close', function () {
      clearTimeout(t);
      const m = /\n@@(.*)\n/.exec(out);
      let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
      resolve(r || { err: 'it did not finish loading', promise: false, placed: false });
    });
  });
}
async function everyScriptRequired(node) {
  test.subHeading('every product script, placed in spirit.required where it is required');
  const all = productScripts().filter(function (f) { return f !== 'spirit/spirit.js'; });
  ok(all.length > 100, 'the world: ' + all.length + ' product scripts, each required alone on the node and on a page', 'too few scripts to judge: ' + all.length);
  const run = node.root ? path.join(node.root, 'spirit', 'run') : '';
  if (!run) test.fail('no scratch copy to require the node\'s scripts in: nothing judged on the node');
  else {
    const loaded = [];
    const bad = [];
    for (const f of all) {
      const r = await requireOnNode(run, f);
      if (r.err) continue;
      loaded.push(f);
      if (r.promise) bad.push(f + ': spirit.require answered a promise, not the module at once');
      else if (!r.placed) bad.push(f + ': nothing stands at spirit.required.' + placeKeys(f).join('.'));
    }
    ok(loaded.length > 0, 'the world: ' + loaded.length + ' of them load on the node', 'none loads on the node: nothing judged there');
    ok(loaded.length > 0 && !bad.length, 'on the node: all ' + loaded.length + ' that load answer at once and stand at spirit.required.<path>', bad.length + ' of ' + loaded.length + ' do not; the first: ' + short(bad.slice(0, 5)));
  }
  const chrome = findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: nothing judged on a page'); return; }
  const page = await chromePage(chrome);
  if (!page || page.error) { test.fail('no Chrome page: ' + short(page && page.error)); return; }
  try {
    const loaded = [];
    const bad = [];
    const noFactory = [];
    const elements = all.filter(isElementScript);
    for (const f of all) {
      await page.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, WAIT);
      const keys = JSON.stringify(placeKeys(f));
      const got = await page.evaluate('window.spirit.ready.then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); return spirit.require(' + JSON.stringify(f) + '); })' +
        '.then(function () { var k = ' + keys + '; var at = function (root) { return k.reduce(function (o, x) { return o == null ? undefined : o[x]; }, root); };' +
        ' var el = at(spirit.element); return JSON.stringify({ err: (window.pageErrors || []).join("; "), placed: at(spirit.required) !== undefined, factory: !!el && typeof el.create === "function" }); },' +
        ' function (e) { return JSON.stringify({ err: String(e && e.message || e), placed: false, factory: false }); })');
      let r = null; try { r = JSON.parse(got); } catch (e) { r = { err: 'the page answered ' + short(got), placed: false, factory: false }; }
      if (r.err) { if (elements.indexOf(f) !== -1) noFactory.push(f + ' (it did not load: ' + r.err.slice(0, 80) + ')'); continue; }
      loaded.push(f);
      if (!r.placed) bad.push(f + ': nothing stands at spirit.required.' + placeKeys(f).join('.'));
      if (elements.indexOf(f) !== -1 && !r.factory) noFactory.push(f);
    }
    ok(loaded.length > 0, 'the world: ' + loaded.length + ' of them load on a page', 'none loads on a page: nothing judged there');
    ok(loaded.length > 0 && !bad.length, 'on a page: all ' + loaded.length + ' that load stand at spirit.required.<path>', bad.length + ' of ' + loaded.length + ' do not; the first: ' + short(bad.slice(0, 5)));
    ok(elements.length > 0 && !noFactory.length, 'every element script (' + elements.length + ') has its factory at spirit.element.<its path>, by its own installSpiritElement', elements.length ? noFactory.length + ' of ' + elements.length + ' have none there: ' + short(noFactory.slice(0, 5)) : 'no script calls installSpiritElement: no element is placed by its path');
  } finally {
    try { if (page.kid) page.kid.kill(); } catch (e) { /* gone */ }
    try { if (page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}
// THE ONE HELPER (goal/G43.32; Andy: "this can be done with ONE single helper function
// spirit/element/installSpiritElement(spirit,elementPath)"): no element script puts itself on spirit.element or
// spirit.elements by hand.
function placedByHand() {
  return productScripts().filter(function (f) {
    if (f === 'spirit/element/installSpiritElement.js' || f === 'spirit/spirit.js') return false;
    const code = codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true);
    return /\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*=(?!=)|\bspirit\.elements?\s*(\.\s*[\w$]+\s*)*\[[^\]]*\]\s*=(?!=)|Object\.assign\s*\([^)]*\bspirit\.elements?\b/.test(code);
  });
}
function oneHelper() {
  test.subHeading('elements are placed by installSpiritElement alone');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js')), 'spirit/element/installSpiritElement.js is there', 'there is no spirit/element/installSpiritElement.js');
  const hand = placedByHand();
  ok(!hand.length, 'no product script puts an element on spirit.element or spirit.elements by hand', hand.length + ' still do: ' + short(hand.slice(0, 8)));
}

async function every() {
  noProcessAnywhere();
  oneHelper();
  branchesNamedAsFolders();
  runTestMoved();
  everyScriptShaped();
  iconsLoaded();
  const reach = require(path.join(RUN, 'spirit', 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'spirit/test/spirit-sibling-generalRules.js' && t.file; }).map(function (t) { return t.file; });
  const files = reach.filter(kindOf);
  test.comment('every app and element in its reach: ' + files.length + ' of ' + reach.length + '; not mounted, being neither: ' + reach.filter(function (f) { return !kindOf(f); }).join(', '));
  if (!files.length) { test.fail('testModule.js gives it no file to judge'); return; }
  const node = await scratchNode(SERVERS);
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on: every file would blame the wrong thing'); return; }
    await everyScriptRequired(node);
    for (const f of files) {
      const out = await new Promise(function (resolve) {
        const kid = spawn(process.execPath, [__filename, f].concat(VERIFY), { cwd: RUN, env: Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: node.base }), stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        kid.stdout.on('data', function (d) { text += d; });
        kid.stderr.on('data', function (d) { text += d; });
        kid.on('close', function () { resolve(text); });
      });
      const greens = Number((/✅:(\d+)/.exec(out) || [])[1] || 0);
      const reds = Number((/❌:(\d+)/.exec(out) || [])[1] || 0);
      const first = (/FAILURE #[\d.]+: ([^\n]*)/.exec(out) || [])[1] || '';
      const at = '/' + f.replace(/\.js$/, '') + '/headLessBrowser.html';
      test.subHeading(at);
      ok(reds === 0 && greens > 0, at + ': ' + greens + ' green', at + ': ' + reds + ' red, ' + greens + ' green; first: ' + first.slice(0, 200));
    }
  } finally {
    try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

test.startTest((full ? NAMED : 'every page module') + ': the general rules of an app or element');

(async function () {
  if (!arg) return every();
  if (!full) { test.fail('no shell app or element to judge: ' + JSON.stringify(arg)); return; }
  // goal/G43.31: a data.js of a branch folder makes the branch of the folder's name (branchesNamedAsFolders).
  if (/^spirit\/(app\/)?[^/]+\/data\.js$/.test(rel) && branchOf(rel) !== null) {
    test.subHeading(NAMED + ': ' + 'its branch is named as its folder');
    ok(branchOf(rel) === path.basename(path.dirname(rel)), 'it makes the branch ' + path.basename(path.dirname(rel)) + ', its folder\'s name', 'it makes the branch ' + branchOf(rel) + ' in the folder ' + path.basename(path.dirname(rel)));
  }
  // goal/G43.30: every file judged here, app, element or neither, mentions no spirit/run/process (noProcessAnywhere).
  test.subHeading(NAMED + ': ' + 'it mentions no spirit/run/process');
  ok(!namesProcess(rel), 'it names neither spirit/run/process nor run://process, in code or comment', 'it mentions spirit/run/process: ' + short((fs.readFileSync(full, 'utf8').match(PROCESS_NAMED) || [])[0]));
  // goal/G43.32: a product script holds the shape (everyScriptShaped), each reason its own red.
  if (/^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel)) {
    test.subHeading(NAMED + ': ' + 'use strict, spirit first, the tree only through spirit.require');
    const why = shapeBreaks(rel);
    if (!why.length) test.check('it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.require');
    why.forEach(function (w) { test.fail(w); });
  }
  if (!kindOf(rel)) { test.subHeading(NAMED); test.check(rel + ' is neither an app (shell/<app>/<app>.js) nor an element (under spirit/element/, or an agent table\'s page): not mounted'); return; }
  // THE WHOLE ROW, NEVER A FEW FIELDS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and
  // search the whole row, as cached in spirit.data."): no app or element hands a search a matched(row) of its own; the
  // search element itself matches the whole row.
  if (rel !== 'spirit/element/search.js') {
    test.subHeading(NAMED + ': ' + 'its searches match the whole row');
    const src = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    ok(!/\bmatched\s*:/.test(src), 'it hands no search a matched() of its own', 'it hands a search matched(), a few fields in place of the whole row');
  }
  // WHAT IT CHANGES, IT LISTENS FOR, IN ITS CODE (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when
  // it changes shit it listens to fucking update via the spirit object"): judged without a page, since a bare mount
  // seldom has a row to change. A module whose code sends a write (an op that changes a row, or a verb that sets) watches
  // spirit.data: a .watch( of its own, or a search made on a spirit.data branch (its data: option), the branch named as
  // text or by the one that keeps it (data: K.branch, the cache manager's own name for it).
  {
    const own = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    // A write in code: an op that changes a row ({ op: 'set' }), a verb named as a string that changes one
    // ('node.setName', 'chat.add', 'box.write'), or a spirit family's setting verb called (spirit.relay.join(...)).
    const WRITE = /\bop\s*:\s*['"](add|set|delete|remove|grant|revoke|ask|claim|press)['"]|['"][a-z]\w*(?:\.[a-z]\w*)*\.(?:set[A-Z]\w*|set|add|delete|remove|grant|revoke|join|face|write|press|claim)['"]|\bspirit\.\w+\.(?:set[A-Z]\w*|join|face|grant|revoke)\s*\(|\.relay\.(?:join|face)\s*\(|\.(?:saveFile|grant|revoke)\s*\(\s*\w/;
    const writes = WRITE.exec(own);
    test.subHeading(NAMED + ': ' + 'what its code changes, it watches in spirit.data');
    if (!writes) unjudged('its code sends no write');
    else ok(/\.watch\s*\(/.test(own) || /\bdata\s*:\s*(?:['"][\w.\/-]+['"]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/.test(own), 'it sends writes (' + writes[0].replace(/\s+/g, ' ') + ') and watches spirit.data', 'it sends writes (' + writes[0].replace(/\s+/g, ' ') + ') and its code watches nothing in spirit.data');
  }
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves, (fast if an other element already required it), that way anybody can mount any element without knowing
  // what it actually needs...."): its code takes no interface from what it is handed, no api.verb or api.escapeHtml and
  // no api off its options; it reaches its verbs through spirit itself.
  {
    const own = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    const handed = own.match(/\b(?:opts|options|o|op)\s*\.\s*api\b|(?<![.\w$])api\s*\.\s*(?:verb|escapeHtml)\b/g) || [];
    test.subHeading(NAMED + ': ' + 'what it needs, it requires itself');
    ok(!handed.length, 'it takes no api from what it is handed', 'it uses an api handed to it: ' + short(handed.filter(function (h, i) { return handed.indexOf(h) === i; })));
  }
  const chrome = findChrome();
  if (!chrome) { test.fail('no Chrome on this machine (set SPIRIT_CHROME to its path): the UI rules cannot be judged'); return; }
  const node = await scratchNode(SERVERS);
  let page = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: every rule here would blame the wrong thing'); return; }
    if (!node.debug) { test.fail('the scratch node\'s DEBUG could not be switched on (node.debug)'); return; }
    page = await chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }

    test.subHeading(NAMED + ': ' + 'it loads by itself');
    // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
    // parts via spirit.require; nothing is preloaded"). The node's DEBUG page for it, made from its address.
    const address = ADDRESS;
    const mountPage = await fetch(node.base + address);
    ok(mountPage.status === 200, 'the node answers its DEBUG page for it, ' + address, address + ' answered ' + mountPage.status);
    if (mountPage.status !== 200) return;
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: WATCH });
    await page.send('Page.navigate', { url: node.base + address });
    let report = null;
    await until(function () {
      return page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)').then(function (s) {
        report = s ? JSON.parse(s) : null; return !!report && report.state !== 'loading';
      });
    }, WAIT);
    await sleep(500);
    const thrown = page.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    // A file asked for and not there is missing; the door's answers (a refusal answers 404 too) and the browser's own
    // favicon ask are not files the page asked for.
    const notFile = function (url) { return /\/api\/|\/favicon\.ico$/.test(String(url || '')); };
    const errors = page.heard.filter(function (m) { return (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !notFile(m.params.entry.url)); })
      .map(function (m) { return m.params.entry ? m.params.entry.text : (m.params.args || []).map(function (a) { return a.value || a.description; }).join(' '); });
    const missing = page.heard.filter(function (m) { return m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !notFile(m.params.response.url); }).map(function (m) { return m.params.response.status + ' ' + m.params.response.url.replace(node.base, ''); })
      .concat(page.heard.filter(function (m) { return m.method === 'Network.loadingFailed' && !m.params.canceled; }).map(function (m) { return 'failed ' + m.params.errorText; }));
    ok(report && report.state === 'mounted', 'it mounts by itself on a bare page: spirit.js, then this file alone', 'the page said: ' + short(report));
    ok(!thrown.length, 'nothing it runs throws', 'thrown: ' + short(thrown));
    ok(!missing.length, 'every file it asks for is there', 'missing: ' + short(missing));
    ok(!errors.length, 'and it says no error on the console', 'console: ' + short(errors));
    if (!report || report.state !== 'mounted') return;

    // EVERY BOX INSIDE IT BOUNDED, TALL AND WIDE (goal/G41.19, box v23; rule/16; Andy: "list-in-a-sized-box
    // (anything-in-a-sized-box) are really a test of the container", "any container that mounts unknown stuff inside it
    // should be bounded in vertically and horizontally"). Judged by the layout itself, so the page names no element:
    // every box it drew that scrolls (overflow auto or scroll, either way), shown, is given a child far taller than it,
    // then one far wider, and must keep its height and its width, inside the mount box. A box only as tall or as wide as
    // its content, anywhere above it, lets it grow. A dropdown's list is hidden until it opens, and is not asked. It is
    // judged as drawn, and again after each tool and tab button it draws is pressed in turn. EACH BOX IS ITS OWN CHECK,
    // named by this file's path and the box's id chain (Andy: "only if the test is properly named can the problem be
    // diagnosed quickly").
    const PROBE = '(function () { var box = window.spiritMount.box; var out = [];' +
      ' function chain(el) { var parts = []; for (var n = el; n && n !== box; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "")); } return parts.join(" > "); }' +
      // WHAT IS SEEN, NOT THE BOX (goal/G41.27; Andy: "change the test for codeMirror."): a box is judged by what the
      // boxes above it that clip (overflow other than visible) leave of it on screen. CodeMirror's scroller is 50px
      // larger than its frame on purpose, to hide the browser's own scrollbars, and its frame cuts it off: nothing spills.
      ' function seen(el) { var r = el.getBoundingClientRect(); var v = { top: r.top, left: r.left, bottom: r.bottom, right: r.right };' +
      '  for (var n = el.parentElement; n; n = n.parentElement) { var cs = getComputedStyle(n); if (cs.overflowX === "visible" && cs.overflowY === "visible") { if (n === box) break; continue; } var c = n.getBoundingClientRect();' +
      '   if (cs.overflowX !== "visible") { v.left = Math.max(v.left, c.left); v.right = Math.min(v.right, c.right); } if (cs.overflowY !== "visible") { v.top = Math.max(v.top, c.top); v.bottom = Math.min(v.bottom, c.bottom); } if (n === box) break; }' +
      '  v.height = Math.max(0, v.bottom - v.top); v.width = Math.max(0, v.right - v.left); return v; }' +
      ' function grows(el, prop, kid) { var before = seen(el)[prop]; el.appendChild(kid); var after = seen(el); var bx = box.getBoundingClientRect();' +
      '  var r = { kept: Math.abs(after[prop] - before) <= 1, inside: after.bottom <= bx.bottom + 1 && after.right <= bx.right + 1, spilt: box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1 }; el.removeChild(kid); return r; }' +
      // CODEMIRROR'S OWN SCROLLBARS ARE NOT CONTAINERS (goal/G41.28): each holds only the library's own sizer, which
      // the library makes as long as the text; nothing is ever mounted in one. The editor's scroller is still judged.
      ' Array.prototype.forEach.call(box.querySelectorAll("*"), function (el) { var cs = getComputedStyle(el); if (!/auto|scroll/.test(cs.overflowY + cs.overflowX) || !el.getClientRects().length) return;' +
      '  if (el.closest(".CodeMirror") && /(^|\\s)CodeMirror-[vh]scrollbar(\\s|$)/.test(el.className)) return;' +
      '  var tall = document.createElement("div"); tall.style.cssText = "height:5000px;width:1px;flex:none";' +
      '  var wide = document.createElement("div"); wide.style.cssText = "width:5000px;min-width:5000px;height:1px;flex:none";' +
      '  var t = grows(el, "height", tall), w = grows(el, "width", wide);' +
      '  out.push({ box: chain(el), tall: t, wide: w }); }); return out; }())';
    // EVERY ICON THROUGH THE ICON ELEMENT (goal/G41.23; Andy, goal/G41.21: "this element will replace icons painting all
    // shell elements and apps."; box v5: "new-face apps will be updated to use the new \"icon\" element."; Q1: "all apps
    // that use icons."): every glyph it draws that is a pictograph (Unicode Extended_Pictographic, as its icons are) and
    // stands alone, its element's whole text, lies inside an element of the class the icon element carries. A glyph among
    // words is a character of the text (Andy: "glyphs are legal in labels and description true, and in that context they
    // don't need special handling"; "narrow the rules so."). The class is read from an icon made after the mount, so
    // nothing is preloaded (rule/26). Judged as drawn, and after each press, as the boxes are.
    const ICONS = '(function () { var box = window.spiritMount.box; var mark = window.spiritIconMark || ""; var out = [];' +
      ' var walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); var n;' +
      ' while ((n = walk.nextNode())) { var g = n.textContent.match(/\\p{Extended_Pictographic}/gu); if (!g) continue; var el = n.parentElement;' +
      '  if (!el || el.textContent.replace(/[\\p{Extended_Pictographic}\\uFE0F\\u200D\\u{1F3FB}-\\u{1F3FF}\\s]/gu, "") !== "") continue;' +
      '  var inIcon = !!mark && !!el && !!el.closest("." + mark); if (inIcon || !el.getClientRects().length) continue;' +
      '  var parts = []; for (var e = el; e && e !== box; e = e.parentNode) { if (e.id || e === el) parts.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "")); }' +
      '  out.push(g.join("") + " in " + parts.join(" > ")); } return out; }())';
    await page.evaluate('Promise.resolve().then(function () { return spirit.require("spirit/element/icon.js"); }).then(function () { var p = document.createElement("div"); var i = spirit.element.icon.create(p, { glyph: "A" }); window.spiritIconMark = String(i && i.className || "").trim().split(/\\s+/)[0] || ""; }, function () { window.spiritIconMark = ""; })');
    const iconMark = await page.evaluate('window.spiritIconMark || ""');
    const loose = {};
    const iconProbe = async function () { const s = await page.evaluate('JSON.stringify(' + ICONS + ')'); (s ? JSON.parse(s) : []).forEach(function (x) { loose[x] = true; }); };
    await iconProbe();
    const seen = {};
    const bounded = function (p) { return p.tall.kept && p.tall.inside && !p.tall.spilt && p.wide.kept && p.wide.inside && !p.wide.spilt; };
    const probe = async function () { const s = await page.evaluate('JSON.stringify(' + PROBE + ')'); (s ? JSON.parse(s) : []).forEach(function (p) { if (!seen[p.box] || bounded(seen[p.box])) seen[p.box] = p; }); };
    await probe();
    const count = await page.evaluate('window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]").length');
    for (let i = 0; i < count; i++) {
      await page.evaluate('(function () { var b = window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]")[' + i + ']; if (b) b.click(); }())');
      await sleep(400);
      await probe();
      await iconProbe();
    }
    test.comment('pressed ' + count + ' tool and tab buttons; ' + Object.keys(seen).length + ' scrolling boxes');
    Object.keys(seen).forEach(function (k) {
      const p = seen[k];
      test.subHeading(NAMED + ': sized box ' + k);
      const why = [];
      if (!p.tall.kept) why.push('it grows taller with its content');
      if (!p.wide.kept) why.push('it grows wider with its content');
      if (!p.tall.inside || !p.wide.inside) why.push('it reaches past the mount box');
      if (p.tall.spilt || p.wide.spilt) why.push('the mount box overflows');
      ok(!why.length, k + ' keeps its height and its width when given far more than it holds', k + ': ' + why.join('; '));
    });
    test.subHeading(NAMED + ': ' + 'every icon it paints is the icon element');
    const looseList = Object.keys(loose);
    ok(!!iconMark && !looseList.length, 'every pictograph it draws lies inside the icon element (class ' + iconMark + ')',
      iconMark ? looseList.length + ' drawn outside the icon element: ' + short(looseList.slice(0, 5)) : 'no icon element to paint through: spirit/element/icon.js made no element with a class');
    test.subHeading(NAMED + ': ' + 'its box never grows');
    const spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');
    ok(spills === false, 'it never grows its box, and the page never scrolls sideways', 'its box overflows, or the page scrolls sideways');

    // EVERY INPUT HELD AT ITS LIMIT (goal/G41.27; Andy: "in the general UI tests (headless browser), any input field must
    // be checked for size-limits, and get a \"red\" if it violates that rule."): every text field it draws, as drawn and
    // after its tools are pressed, is typed far past the longest field the rules allow, as a hand would type it, and must
    // keep no more than that. A field nothing holds keeps it all.
    test.subHeading(NAMED + ': ' + 'every field it draws stops at its limit');
    const typed = 'x'.repeat(MOST_BYTES * 2);
    // Typed through the browser's own input (Input.insertText), which fires beforeinput as a hand's typing does; a script's
    // execCommand does not, and would type past any field.
    const FIELDS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("textarea, input"), function (el) { return (el.tagName === "TEXTAREA" || /^(|text|email|search|url|tel|password)$/.test(el.type || "")) && el.getClientRects().length && !el.disabled && !el.readOnly; })';
    const fieldCount = await page.evaluate(FIELDS + '.length');
    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      const at = await page.evaluate('(function () { var box = window.spiritMount.box; var el = ' + FIELDS + '[' + i + ']; if (!el) return ""; el.focus(); el.value = "";' +
        ' var parts = []; for (var n = el; n && n !== box; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n === el && el.placeholder ? "[" + el.placeholder + "]" : "")); } return parts.join(" > "); }())');
      if (!at) continue;
      await page.send('Input.insertText', { text: typed });
      const kept = await page.evaluate('(function () { var el = ' + FIELDS + '[' + i + ']; var n = el ? new TextEncoder().encode(el.value).length : 0; if (el) el.value = ""; return n; }())');
      fields.push({ at: at, kept: kept });
    }
    const free = fields.filter(function (f) { return f.kept > MOST_BYTES; });
    test.comment(fields.length + ' fields typed past ' + MOST_BYTES + ' bytes');
    if (!fields.length) unjudged('it draws no text field');
    else ok(!free.length, 'every field it draws stops at its limit (' + fields.length + ' typed past ' + MOST_BYTES + ' bytes)', free.length + ' kept more than any rule allows: ' + short(free.map(function (f) { return f.at + ' kept ' + f.kept; })));

    // EVERY BUTTON PRESSED, AND WHAT A PRESS DOES WATCHED (goal/G41.27): each button it draws is pressed in turn, and what
    // leaves the page, what it listens to and what it draws are judged by the rules that follow.
    let pressed = 0;
    for (let i = 0; i < 60; i++) {
      if (!(await page.evaluate('window.spiritWatch && window.spiritWatch.press(' + i + ')'))) break;
      pressed += 1;
      // Its writes answered, or two seconds, whichever comes first.
      const t0 = Date.now();
      await sleep(150);
      while (Date.now() - t0 < 2000 && await page.evaluate('window.spiritWatch.out')) await sleep(100);
      await page.evaluate('window.spiritWatch.settle()');
    }
    const W = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch || null)')) || { net: [], subs: [], writes: [], moved: [] };
    test.comment('pressed ' + pressed + ' buttons; ' + W.net.length + ' calls on the wire; ' + W.writes.length + ' writes; ' + W.subs.length + ' subscriptions');

    // EVERY CALL ON THE WIRE THROUGH SPIRIT (goal/G41.27; Andy: "can it assert that no element posts or fetches by itself,
    // and that all wire-stuff goes through spirit?", "boot.js MUST be an exception to the rules."): each one the page made
    // was made by spirit's own code.
    test.subHeading(NAMED + ': ' + 'all it sends goes through spirit');
    const own = W.net.filter(function (c) { return !c.spirit; });
    // OUTSIDE goal/G41.28, AND STILL RED (Andy, G41.28: "WSL will drop Q23 from this item, and mark those two related reds as
    // outside it"): login fetches its steps file before the page has a link to its node, and the file viewer fetches a
    // file at home piece by piece. Each red names that it is outside the item; it is not met, so it is not green.
    // shell/login/login.js is no longer in the tree; the file viewer's spirit/element/fstat.js is.
    const OUTSIDE = own.some(function (c) { return /^(shell\/login\/login|spirit\/element\/fstat)\.js$/.test(String(c.file || '')); }) ? ' (outside goal/G41.28, Andy: "WSL will drop Q23 from this item, and mark those two related reds as outside it")' : '';
    ok(!own.length, 'every call it puts on the wire goes through spirit (' + W.net.length + ' made)', own.length + ' made by itself: ' + short(own.map(function (c) { return c.kind + ' ' + c.url.replace(node.base, '') + ' from ' + (c.file || 'an unnamed script'); })) + OUTSIDE);

    // WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27; Andy: "elements that change things, also subscribe to the changes
    // they cause, since andy request an element generates would imply that it must listen for confirmation of the
    // results"): one that sent a write holds, while mounted, a listener on the page's stream of its own making.
    // THROUGH SPIRIT.DATA, NOT THE RAW STREAM (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
    // changes shit it listens to fucking update via the spirit object"): what it listens with is a spirit.data.watchPath of
    // its own making, its searches' included. A subscription of its own to the raw stream, taken into a store of its own,
    // is how the Desk List kept rows spirit.data never held: it does not count.
    test.subHeading(NAMED + ': ' + 'what it changes, it listens for through spirit.data');
    const watching = W.subs.filter(function (x) { return x.mine && x.live && x.kind === 'data.watch'; }).length;
    const raw = W.subs.filter(function (x) { return x.mine && x.live && x.kind !== 'data.watch'; }).length;
    // AND ITS WATCHING REDRAWS IT (goal/G41.28; Andy: "YOUR TEST WILL MAKE SURE THAT THE CACHING AND LISTENING IS DONE TO
    // FUCKING SPEC AS GOOD AS YOU POSSIBLY CAN"): a marked row written into each spirit.data path it watches must change
    // its box. A watch that redraws nothing is not listening.
    let probed = JSON.parse(await page.evaluate('Promise.resolve(window.spiritWatch && window.spiritWatch.probe ? window.spiritWatch.probe() : []).then(function (x) { return JSON.stringify(x); })'));
    // A CLOSED DROPDOWN DRAWS ITS LIST WHEN IT OPENS (spirit/element/search.js, setOpen: "opened, ... draw()"): while
    // nothing it watches has redrawn, each closed dropdown on the page is opened in turn, what it watches written again,
    // and shut. A path that redrew in any of them redrew.
    const DROPDOWNS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("button[id$=field]"), function (b) { var p = document.getElementById(b.id.replace(/field$/, "popup")); return p && p.hidden && b.getClientRects().length; })';
    const closed = probed.some(function (x) { return x.redrew; }) ? 0 : await page.evaluate(DROPDOWNS + '.length');
    for (let i = 0; i < closed; i++) {
      await page.evaluate('(function () { var b = ' + DROPDOWNS + '[' + i + ']; if (b) b.click(); }())');
      await sleep(300);
      const again = JSON.parse(await page.evaluate('Promise.resolve(window.spiritWatch.probe()).then(function (x) { return JSON.stringify(x); })'));
      probed = probed.map(function (x) { const y = again.filter(function (z) { return z.path === x.path; })[0]; return y && y.redrew ? Object.assign({}, x, { redrew: true, hidden: false }) : x; });
      await page.evaluate('document.body.click()');
      await sleep(200);
    }
    test.subHeading(NAMED + ': ' + 'what it watches in spirit.data redraws it');
    const seenProbe = probed.filter(function (x) { return !x.hidden; });
    if (!probed.length) unjudged('it watches no spirit.data path');
    else if (!seenProbe.length) unjudged('it shows nothing on this page, so there is nothing to redraw');
    else if (OWN_PROOF[rel] && !seenProbe.some(function (x) { return x.redrew; })) {
      // PROVED IN ITS OWN TEST (Andy, Q24: "Shall deskDetails' own test be the proof that it redraws from the verifier,
      // since the page sweep opens no item?" "yes."): what it watches draws only for an item open, and this page opens
      // none. Its own test is run here, and the check is green only if its own redraw check passed.
      const p = OWN_PROOF[rel];
      const said = require('child_process').spawnSync(process.execPath, [path.join(RUN, p.test)], { cwd: RUN, encoding: 'utf8', timeout: 120000 }).stdout || '';
      ok(said.split('\n').some(function (l) { return /SUCCESS/.test(l) && l.indexOf(p.check) !== -1; }), 'what it watches redraws it, proved in its own test (' + p.test + '): ' + p.check, 'its own test (' + p.test + ') did not pass: ' + p.check);
    }
    else ok(seenProbe.some(function (x) { return x.redrew; }), 'a change written into what it watches redraws it: ' + seenProbe.filter(function (x) { return x.redrew; }).map(function (x) { return x.path; }).join(', '), 'it watches ' + seenProbe.map(function (x) { return x.path; }).join(', ') + ' and redraws for none of them');
    if (!W.writes.length) unjudged('its presses sent no write (its code is judged for it, above)');
    else ok(watching > 0, 'it sent ' + W.writes.length + ' writes and watches ' + watching + ' spirit.data paths for them', 'it sent ' + short(W.writes) + ' and watches no spirit.data path' + (raw ? '; it listens to the raw stream ' + raw + ' times instead' : ''));

    // IT DRAWS ONLY WHAT THE STREAM SAYS (rule/19; goal/G41.27, the box: "after a press, until the stream answers, an
    // element may change only its busy spinner, its button's disabled state and its fine print; any other change it makes
    // is red"): judged while a write it sent is out, until the node answers it.
    test.subHeading(NAMED + ': ' + 'while a write is out, it draws nothing of its own');
    if (!W.writes.length) unjudged('its presses sent no write');
    else ok(!W.moved.length, 'while its writes were out it changed only busy marks, disabled buttons and fine print', W.moved.length + ' changes while a write was out: ' + short(W.moved.slice(0, 6)));

    // EVERY SEARCH FROM SPIRIT.DATA (goal/G41.28; Andy, box v15: "general test for screen objects will make sure that all
    // damn data is cached in spirit data.", and "every probabilitySearch on a page is made with a spirit.data branch (its
    // data option), and draws only rows that branch holds. A list fed by its own rows() or by answers alone goes red.").
    test.subHeading(NAMED + ': ' + 'every search it makes ranks spirit.data');
    const made = W.searches || [];
    const off = made.filter(function (x) { return !x.data || x.rows; });
    // ONE EXCEPTION, DEFERRED, AND STILL RED (Andy, the box: "the only exception is introspector, deferred for network-scope
    // design reasons."): the probability search keeps rows of its own for introSpector's selectors over another node, so
    // its own page, mounted bare, still makes one. The red names the deferral; it is not met, so it is not green.
    const DEFERRED = rel === 'spirit/element/search.js' || rel === 'spirit/element/introSpector.js' || rel === 'spirit/app/introSpector/introSpector.js' ?' (introSpector\'s deferral, the box: "the only exception is introspector, deferred for network-scope design reasons.")' : '';
    if (!made.length) unjudged('it makes no search');
    else ok(!off.length, 'its ' + made.length + ' searches are each made with a spirit.data branch, no rows of their own', off.length + ' not from spirit.data: ' + short(off.map(function (x) { return (x.verb || 'a search') + (x.data ? '' : ' with no data branch') + (x.rows ? ' fed by its own rows()' : ''); })) + DEFERRED);
    // "and draws only rows that branch holds": every row a search shows, after its tools and buttons are pressed, is a
    // row of its branch in spirit.data. A list that keeps its rows anywhere else draws what the branch does not hold.
    const outside = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch && window.spiritWatch.drawnOutside ? window.spiritWatch.drawnOutside() : [])'));
    const drew = outside.reduce(function (n, x) { return n + x.drawn; }, 0);
    const strays = outside.filter(function (x) { return x.outside.length; });
    if (!drew) unjudged('its searches draw no row');
    else ok(!strays.length, 'every row its searches draw (' + drew + ') is a row their spirit.data branch holds', strays.length + ' searches draw rows their branch does not hold: ' + short(strays.map(function (x) { return (x.verb || 'a search') + ' on ' + x.data + ': ' + x.outside.join(', '); })));

    test.subHeading(NAMED + ': ' + 'destroy leaves its box empty');
    const destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
    ok(destroyed === 'empty' || destroyed === 'none', destroyed === 'none' ? 'it has no destroy of its own (an app is closed by the face)' : 'destroyed, its box is empty', 'after destroy its box still holds what it drew');
    // EVERY ELEMENT BRINGS ITS OWN SUBSCRIPTIONS, AND LETS THEM GO (rule/8; goal/G41.27): destroyed, nothing it listened to
    // is still held.
    if (destroyed !== 'none') {
      await sleep(200);
      const after = JSON.parse(await page.evaluate('JSON.stringify((window.spiritWatch || { subs: [] }).subs)'));
      const held = after.filter(function (x) { return x.mine && x.live; });
      if (!after.filter(function (x) { return x.mine; }).length) unjudged('it made no subscription');
      else ok(!held.length, 'destroyed, it lets every subscription it made go (' + after.filter(function (x) { return x.mine; }).length + ' made)', held.length + ' still held after destroy: ' + short(held.map(function (x) { return x.kind; })));
    }
  } finally {
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    if (!node.shared) try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [node.shared ? '' : node.root, page && page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
