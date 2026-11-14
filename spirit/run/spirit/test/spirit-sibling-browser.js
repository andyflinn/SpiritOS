'use strict';

// spirit/run/spirit/test/spirit-sibling-browser.js [<script> ...]
// THE -browser GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests", "existing general tests fold into the appropriate of the 3 new general test name-formats"; its contract:
// ./spirit-sibling-browser.md): generalRules' page checks, every title kept; its file-reading checks are
// spirit-sibling-general.js's, its node checks spirit-sibling-node.js's. "browser only scripts are tested by -general and
// -browser general tests": testicle hands it no node-only script. Several scripts: each in a run of its own (below).
// As it stood under its own name:
// THE GENERAL RULES OF A MODULE, A SHELL APP OR AN ELEMENT (goal/G41.18; the module rules of goal/G40.6 folded in from
// spirit-child-generalRules.js, goal/G47.1), run once per file it judges, the file its argument (spec:
// ./spirit-sibling-generalRules.md). ITS NAME IS ITS REACH
// (./TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a -sibling-
// test beside spirit.js judges every module in spirit/run/ and below (goal/G47.1: no opting in), shell/ and the agent tables'
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
// Its arguments: the file it judges, if any.
const ARGS = process.argv.slice(2);
const arg = String(ARGS[0] || '');
// SEVERAL SCRIPTS (box v94, 2: "else it will process all scripts listed in the arguments that fit"): each in a run of its own,
// so each draws its own page and reports for itself.
const GIVEN = ARGS.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGS[i - 1] !== '--test'; });
if (GIVEN.length > 1) {
  let failed = 0;
  GIVEN.forEach(function (one) {
    const r = require('child_process').spawnSync(process.execPath, [__filename, one], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 });
    process.stdout.write(String(r.stdout || '') + String(r.stderr || ''));
    if (r.status !== 0) failed += 1;
  });
  process.exit(failed ? 1 : 0);
}
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
// WHAT IS A PAGE MODULE (goal/G43.32; Andy: "helpers with no create are no fucking elements. they live in require.
// element scripts place their factories in spirit.element.<their path>"): a file is mounted when its own code places its
// factory by installSpiritElement; a switch (agent.js), a server or a helper is not. Read from the file, not guessed from
// its path.
function kindOf(file) {
  const f = String(file || '');
  if (!/^spirit\/.+\.js$/.test(f) || /(^|\/)test\//.test(f)) return '';
  if (f === 'spirit/element/installSpiritElement.js') return '';
  try { return /\binstallSpiritElement\s*\(/.test(codeOf(fs.readFileSync(path.join(RUN, f), 'utf8'), true)) ? 'element' : ''; } catch (e) { return ''; }
}
// A PAGE SCRIPT IT JUDGES (goal/G47.1, box v121: "it judges the scripts scriptClassify says load in a page"; testicle hands it
// only those): known by its path alone, no code read; whether it installs an element the bare page says (session).
function pageScript(file) {
  const f = String(file || '');
  return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && f !== 'spirit/element/installSpiritElement.js';
}
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/agent/node.json (spirit/job.js).
const SERVERS = { servers: ['agent'] };
// A REDRAW PROVED IN THE PAGE'S OWN TEST (Andy, Q24, "yes."): a page whose watch draws only for an item open, which a
// bare mount never has; its own test's check, by its words, stands for it here.
const OWN_PROOF = {
  'spirit/app/desk/element/deskDetails/deskDetails.js': { test: 'spirit/app/desk/element/deskDetails/test/deskDetails.js', check: 'a verifier publish taken into spirit.data redraws the run' },
  // Join draws only the join news on the spirit job, which a marked row in the jobs or the contacts cannot change (Andy,
  // goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you ruled for deskDetails in Q24?"). The
  // Join app is joinList mounted, so its page takes the same proof.
  'spirit/element/joinList.js': { test: 'spirit/element/test/joinList.js', check: 'a new join on the spirit job, taken into spirit.data, redraws the steps' },
  'spirit/app/join/element.js': { test: 'spirit/element/test/joinList.js', check: 'a new join on the spirit job, taken into spirit.data, redraws the steps' },
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
//   subs:  every spirit.event.subscribe and spirit.data.watchPath (a family view's, spirit.data.viewAt(node, family).watch, among them), live until let go, and whether a module made it;
//   writes: every call to the node a module made that changes something (not the stream or an interface, no read op,
//           no read verb);
//   moved: what the box changed while a write was out, other than a busy mark, a button's disabled state or fine print.
const WATCH = String.raw`(function () {
  var W = window.spiritWatch = { net: [], subs: [], writes: [], moved: [], out: 0, searches: [], families: [] };
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
    // Spirit's own asks are no write: the stream (event.subscribe) and a family's interface (api).
    if (!b || typeof b.call !== 'string' || b.call === 'event.subscribe' || b.call === 'api') return null;
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
    // EVERY FAMILY IT CALLS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING INTERFACES IT FUCKING NEEDS"): the
    // family of each call its code made, read or write, spirit's own asks (the stream, an interface) left out.
    if (moduleMade()) { try { var cb = JSON.parse(String((o && o.body) || '')); var fam = cb && typeof cb.call === 'string' && cb.call !== 'api' && cb.call !== 'event.subscribe' ? cb.call.split('.')[0] : ''; if (fam && W.families.indexOf(fam) === -1) W.families.push(fam); } catch (e) { /* no call */ } }
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
    // The search element stands at its path since goal/G43.32, spirit.element.spirit.element.search: every step of the path
    // is followed as it is made, and the element wrapped when it is placed or read.
    function along(o, keys, done) {
      if (!o || typeof o !== 'object') return;
      var k = keys[0];
      var last = keys.length === 1;
      var at = o[k];
      function took(v) { if (last) done(v); else along(v, keys.slice(1), done); }
      try { Object.defineProperty(o, k, { configurable: true, enumerable: true, get: function () { if (last) done(at); return at; }, set: function (v) { at = v; took(v); } }); } catch (e) { /* kept as it is */ }
      if (at) took(at);
    }
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
      // A search mounted inside another's host (branch's family filter in its 🪣 row) draws its own rows: they are judged
      // against its own branch, not this one's.
      var inner = (window.spiritSearchHosts || []).filter(function (h, j) { return j !== i && h && h !== host && host.contains(h); });
      var keys = Array.prototype.filter.call(host.querySelectorAll('[data-key]'), function (el) { return !inner.some(function (h) { return h.contains(el); }); }).map(function (el) { return String(el.getAttribute('data-key')); });
      return { verb: x.verb, data: x.data, drawn: keys.length, outside: keys.filter(function (k) { return !held[k]; }).slice(0, 5) };
    });
  };
    along(els, ['spirit', 'element', 'search'], wrap);
  }
  function hook(o) {
    if (!o || typeof o !== 'object' || o.__watched) return;
    Object.defineProperty(o, '__watched', { value: true });
    var els = o.element;
    Object.defineProperty(o, 'element', { configurable: true, enumerable: true, get: function () { return els; }, set: function (v) { els = v; searches(v); } });
    searches(els);
    [['event', 'subscribe'], ['data', 'watch']].forEach(function (k) {
      var cur = o[k[0]];
      function wrap(v) {
        if (v && typeof v[k[1]] === 'function' && !v[k[1]].__kept) { var f = kept(k[0] + '.' + k[1], v[k[1]]); f.__kept = true; v[k[1]] = f; }
        // A family's view (goal/G41.28), spirit.data.viewAt(node, family): a manager watches through it, so its watch is kept
        // as one on spirit.data, under the whole path it watches.
        // spirit.data names it viewAt (spirit/data.js); a watch through the view is the module's own watch.
        var VIEW = v && typeof v.viewAt === 'function' ? 'viewAt' : 'at';
        if (k[0] === 'data' && v && typeof v[VIEW] === 'function' && !v[VIEW].__kept) {
          var at = v[VIEW];
          v[VIEW] = function () {
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
          v[VIEW].__kept = true;
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

// NOTHING JUDGED IS NO PASS (goal/G41.28; Andy: "You fucking fudge tests to get away with total fucking sloppyness!"):
// a rule that found nothing to judge on this page says so, and counts as neither green nor red. It is judged where it
// can be: in the code, or on a page that gives it something. So a rule is said (its test.run) only when its page gave it
// something to judge (goal/G47.2: every test one test.run); the rest are said as comments.
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
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'spirit/app/contact/element.js', 'spirit/element/search/icon/listElement.js',
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
// RUN://TEST/ MOVES INTO RUN://SPIRIT/TEST/ (goal/G43.32, the box). Andy: "we'll move the contents of run://test/   into
// run://spirit/test/ first.", on Q2: "We need special rules for run://spirit/test/  it will be where run://spirit/app/test/
// finds it's main tools.", and his concluding point: "this move will free the run:// folder namespace and SpiritOS will
// only take up 1 name ("spirit") in it. .gitignore will be updated to ignore the run:/ folder except for run://spirit/".
// The old folder's name is built, never written, so this file and its .md are the only ones that may name it, and the
// scan leaves those two out.
const OLD_TEST = 'spirit/run/' + 'test/';
const OLD_NAMED = new RegExp(OLD_TEST.replace(/\//g, '\\/') + '|run:\\/\\/?' + 'test\\/');
// The files of run://test/ on 2026-11-10, by their place inside it; test/testReport-verifier.js and .md were folded into
// test/testReport.js and .md since (goal/G45.1: one test file per script); spirit-child-generalRules.js was folded into this
// file since (goal/G47.1).
const MOVED = ['TEST_SYSTEM.md', 'headLessChrome.js', 'testModule.js', 'testReport.js',
  'spirit-sibling-generalRules.js', 'spirit-sibling-generalRules.md', 'spirit-sibling-noFuckingGarbage.js', 'spirit-sibling-noFuckingGarbage.md',
  'spirit-sibling-searchRules.js', 'spirit-sibling-searchRules.md', 'spirit-sibling-testReachRules.js', 'spirit-sibling-testReachRules.md',
  'test/testModule.js', 'test/testModule.md', 'test/testReport.js', 'test/testReport.md'];
// The tools of run://spirit/test/: tools, not tests (Q2).
const TOOLS = ['testReport.js', 'testModule.js', 'headLessChrome.js'];
const SELF = ['spirit-sibling-browser.js', 'spirit-sibling-browser.md'];
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
function ignoredByGit(rel) {
  try { require('child_process').execFileSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: REPO, stdio: 'ignore' }); return true; }
  catch (e) { return false; }
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
// THE GENERAL RULES OF A MODULE, judged in its code (goal/G40.6; folded in from spirit-child-generalRules.js, goal/G47.1;
// Andy: "for now, fold those two into spirit-sibling-generalRules.js"). Andy: "it will assert, the require path rule it
// will assert that the spirit-object becomes a global at the top of all modules"; spirit.js itself is judged too: "it
// must establish the global spirit object early in the code, it must follow the require-path restrictions we discussed."
// THE GLOBAL EARLY: a module's first require is spirit.js, so spirit is a plain global before anything else is loaded;
// spirit.js itself sets the global before its first require. Page code (no module.exports, speaks to window) runs on
// the page, where spirit.js is already there, and node never loads it.
// THE REQUIRE RULE (goal/G40's box): "a require path that starts with ../ may only add a file name, never descend into a
// subfolder of an ancestor; any other require path starts with <module>/, the module's own children. A sibling in the
// module's own folder is legal." A package or a node built-in is not a path; a computed path cannot be read.
// moduleRules(full) -> { early: '' when it holds, else why; page: true for page code; bad: [require paths breaking the rule] }
function moduleRules(full) {
  const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const requires = [];
  // Plain requires only: spirit.require(...) is the door the rule asks for, never a plain require.
  const re = /(^|[^.\w$])require\(\s*(['"])([^'"]+)\2\s*\)/g;
  let m;
  while ((m = re.exec(code))) requires.push({ at: m.index, path: m[3] });
  const own = path.basename(full, '.js');
  const isSpirit = path.resolve(full) === path.join(RUN, 'spirit', 'spirit.js');
  const first = requires[0];
  const page = !isSpirit && /\bwindow\b/.test(code) && !/\bmodule\.exports\b/.test(code);
  // THE RULE (Andy, 2026-11-13, goal/G47.1 box v73, replacing his api.js exemption of v72: "if a module requires
  // anything, it must require spirit.js first. Other modules are required using spirit.require(), unless they are
  // native node.js modules."). A module that requires nothing holds it.
  let early = '';
  if (page || !requires.length) early = '';
  else if (isSpirit) {
    const sets = code.search(/\broot\.spirit\s*=|\bglobalThis\.spirit\s*=|\bglobal\.spirit\s*=/);
    if (sets === -1 || (first && sets > first.at)) early = 'it sets the global spirit ' + (sets === -1 ? 'nowhere' : 'only after its first require, ' + JSON.stringify(first.path));
  } else if (!(/(^|\/)spirit\.js$/.test(first.path) && path.resolve(path.dirname(full), first.path) === path.join(RUN, 'spirit', 'spirit.js'))) {
    early = 'it does not require spirit.js first: its first require is ' + JSON.stringify(first.path);
  } else {
    const native = function (p) { return BUILTIN.indexOf(p) !== -1 || BUILTIN.indexOf(p.replace(/^node:/, '')) !== -1; };
    const other = requires.slice(1).filter(function (r) { return !native(r.path) && !/(^|\/)spirit\.js$/.test(r.path); })[0];
    if (other) early = 'it requires ' + JSON.stringify(other.path) + ', not through spirit.require(): only node\'s own modules are required plainly';
  }
  const bad = requires.filter(function (r) {
    const p = r.path;
    if (!/^[./]/.test(p)) return false;
    if (/^\.\.\//.test(p)) return /\//.test(p.replace(/^(\.\.\/)+/, ''));
    if (/^\.\//.test(p)) { const rest = p.slice(2); return rest.indexOf('/') !== -1 && rest.indexOf(own + '/') !== 0; }
    return true;
  }).map(function (r) { return r.path; });
  return { early: early, page: page, spirit: isSpirit, bad: bad };
}
function productScripts() {
  return require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f)); });
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
// The helper itself defines installSpiritElement and places nothing: it is required, no element.
function isElementScript(rel) { return rel !== 'spirit/element/installSpiritElement.js' && /\binstallSpiritElement\s*\(/.test(codeOf(fs.readFileSync(path.join(RUN, rel), 'utf8'), true)); }
function requireOnNode(run, rel) {
  return new Promise(function (resolve) {
    // A branch's api.js (decided 8) binds the branch, so it is waited on and judged by its place alone; every other script
    // answers at once and stands at its place as that answer.
    const iface = /\/api\.js$/.test(rel);
    const probe = 'const path = require("path"); const s = require(path.join(process.cwd(), "spirit", "spirit.js"));' +
      '(async function () { let at = null, err = "", promise = false; try { at = s.require(' + JSON.stringify(rel) + '); promise = !!(at && typeof at.then === "function"); if (' + iface + ' && promise) at = await at; } catch (e) { err = String(e && e.message || e); }' +
      'const keys = ' + JSON.stringify(placeKeys(rel)) + '; const place = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, s.required);' +
      'process.stdout.write("\\n@@" + JSON.stringify({ err: err, promise: ' + iface + ' ? false : promise, placed: ' + iface + ' ? place !== undefined : place !== undefined && place === at }) + "\\n"); process.exit(0); }());';
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
// What each rule broke, named in its answer: '' when none did.
function listed(bad) { return !bad.length || bad.join('; '); }

// ── GIVEN NO FILE: THE TREE'S RULES, THEN EVERY PAGE MODULE ─────────────────────────────────────────────────────────────
function every() {
  // no module of spirit/run/ mentions spirit/run/process/
  const E = {};

  // The page modules in its reach, and the one scratch node they are judged on.
  test.run('the world: testModule.js gives it files to judge', 0.2, function () {
    const reach = require(path.join(RUN, 'spirit', 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'spirit/test/spirit-sibling-browser.js' && t.file; }).map(function (t) { return t.file; });
    // Every page script in its reach, each judged by its own page (goal/G47.1, box v121: no code reading).
    E.files2 = reach.filter(pageScript);
    test.comment('every page script in its reach: ' + E.files2.length + ' of ' + reach.length);
    return E.files2.length > 0 || 'testModule.js gives it no file to judge';
  }, test.limit.quick);
  test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
    E.node = await scratchNode(SERVERS);
    return (E.node.up && E.node.debug) || 'the scratch node did not come up with its DEBUG on: every file would blame the wrong thing';
  }, test.limit.slow);
  const NO_NODE = 'no scratch node with its DEBUG on: the world failed';
  const nodeUp = function () { return !!E.node && E.node.up && E.node.debug; };

  // every product script, placed in spirit.required where it is required
  test.run('the world: the product scripts, each required alone on the node and on a page', 0.2, function () {
    E.req = productScripts().filter(function (f) { return f !== 'spirit/spirit.js'; });
    return E.req.length > 100 || 'too few scripts to judge: ' + E.req.length;
  }, test.limit.quick);
  test.run('the world: some of them load on a page', 0.2, async function () {
    if (!nodeUp()) return NO_NODE;
    const chrome = findChrome();
    if (!chrome) return 'no Chrome on this machine: nothing judged on a page';
    const page = E.page = await chromePage(chrome);
    if (!page || page.error) return 'no Chrome page: ' + short(page && page.error);
    E.pageLoaded = []; E.pageBad = []; E.noFactory = [];
    E.elements = E.req.filter(isElementScript);
    for (const f of E.req) {
      await page.send('Page.navigate', { url: E.node.base + '/face.html' });
      await until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, WAIT);
      const keys = JSON.stringify(placeKeys(f));
      const got = await page.evaluate('window.spirit.ready.then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); return spirit.require(' + JSON.stringify(f) + '); })' +
        '.then(function () { var k = ' + keys + '; var at = function (root) { return k.reduce(function (o, x) { return o == null ? undefined : o[x]; }, root); };' +
        ' var el = at(spirit.element); return JSON.stringify({ err: (window.pageErrors || []).join("; "), placed: at(spirit.required) !== undefined, factory: !!el && typeof el.create === "function" }); },' +
        ' function (e) { return JSON.stringify({ err: String(e && e.message || e), placed: false, factory: false }); })');
      let r = null; try { r = JSON.parse(got); } catch (e) { r = { err: 'the page answered ' + short(got), placed: false, factory: false }; }
      if (r.err) { if (E.elements.indexOf(f) !== -1) E.noFactory.push(f + ' (it did not load: ' + r.err.slice(0, 80) + ')'); continue; }
      E.pageLoaded.push(f);
      if (!r.placed) E.pageBad.push(f + ': nothing stands at spirit.required.' + placeKeys(f).join('.'));
      if (E.elements.indexOf(f) !== -1 && !r.factory) E.noFactory.push(f);
    }
    try { if (page.kid) page.kid.kill(); } catch (e) { /* gone */ }
    try { if (page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    return E.pageLoaded.length > 0 || 'none loads on a page: nothing judged there';
  }, test.limit.long);
  test.run('on a page: all that load stand at spirit.required.<path>', 0.4, function () {
    if (!E.pageLoaded) return 'nothing required on a page: the world failed';
    return (E.pageLoaded.length > 0 && !E.pageBad.length) || E.pageBad.length + ' of ' + E.pageLoaded.length + ' do not; the first: ' + short(E.pageBad.slice(0, 5));
  }, test.limit.quick);
  test.run('every element script has its factory at spirit.element.<its path>, by its own installSpiritElement', 0.4, function () {
    if (!E.pageLoaded) return 'nothing required on a page: the world failed';
    return (E.elements.length > 0 && !E.noFactory.length) || (E.elements.length ? E.noFactory.length + ' of ' + E.elements.length + ' have none there: ' + short(E.noFactory.slice(0, 5)) : 'no script calls installSpiritElement: no element is placed by its path');
  }, test.limit.quick);

  // Each page module in a run of its own, so each is recorded under its own module (spirit/test/testReport.js); each page
  // that is not green named in the answer, by its address.
  test.run('its page is green', 0.4, async function () {
    if (!nodeUp()) return NO_NODE;
    if (!E.files2 || !E.files2.length) return 'testModule.js gives it no file to judge: the world failed';
    const red = [];
    for (const f of E.files2) {
      const out = await new Promise(function (resolve) {
        const kid = spawn(process.execPath, [__filename, f], { cwd: RUN, env: Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: E.node.base }), stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        kid.stdout.on('data', function (d) { text += d; });
        kid.stderr.on('data', function (d) { text += d; });
        kid.on('close', function () { resolve(text); });
      });
      const greens = Number((/✅:(\d+)/.exec(out) || [])[1] || 0);
      const reds = Number((/❌:(\d+)/.exec(out) || [])[1] || 0);
      // A FAILURE line is its title, then ' — ' and what went wrong (spirit/test/testReport.js).
      const first = (/FAILURE #[\d.]+: ([^\n]*)/.exec(out) || [])[1] || '';
      const at = '/' + f.replace(/\.js$/, '') + '/headLessBrowser.html';
      test.comment(at + ': ' + reds + ' red, ' + greens + ' green');
      if (!(reds === 0 && greens > 0)) red.push(at + ': ' + reds + ' red, ' + greens + ' green; first: ' + first.slice(0, 200));
    }
    return listed(red);
  }, test.limit.long);

  test.after(async function () {
    if (E.page) { try { if (E.page.kid) E.page.kid.kill(); } catch (e) { /* gone */ } }
    if (E.node) {
      try { E.node.child.kill(); } catch (e) { /* gone */ }
      await sleep(300);
      try { require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(E.node); } catch (e) { /* scratch */ }
    }
  });
}

// ── GIVEN A FILE: ITS CODE, THEN ITS PAGE ───────────────────────────────────────────────────────────────────────────────
// The page is drawn, pressed and probed first, in one session (below), and what it drew kept in P; then each rule is
// said, a rule its page gave nothing to judge said as a comment only. A step that could not run fails "the world:" test of
// it, and every rule after it fails on it, so nothing is skipped in silence.
const PAGE_MS = 300000;
async function session() {
  const P = { stage: 'chrome', fail: '', notes: [] };
  const chrome = findChrome();
  if (!chrome) { P.fail = 'no Chrome on this machine (set SPIRIT_CHROME to its path): the UI rules cannot be judged'; return P; }
  // ITS OWN APP'S SERVER ON TOO (goal/G47.1, cleaning, Andy's testicle's first red: spirit/app/backup/api.js never loaded,
  // "no interface for the family backup", since backup was not turned on on the scratch node): a script of
  // spirit/app/<name>/ is loaded with <name>'s server running, as on a node that uses it.
  // APP-OWNED ELEMENTS, THEIR SERVER STARTED FIRST (goal/G47.1; Andy: "for any element in a spirit/app/<name>/<name>.json
  // folder\" a server MUST be mounted if a mountable server exists in that app folder before a test is conducted", "wsl,
  // quickly fix the -browser.js general test to account for app-owned elements and the required server start when
  // necessary"): an app whose folder holds its server, spirit/app/<name>/<name>.js, is turned on, and the page is opened only
  // once that server answers its interface; one that never does fails the world, never the element.
  const own = (/^spirit\/app\/([^/]+)\//.exec(rel) || [])[1];
  // Mountable: its manifest mounts it (node.mount true); a program app (publishData, pushOrigin: node.run) mounts none.
  let ownServer = false;
  try { const m = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', own, own + '.json'), 'utf8')); ownServer = !!own && !!(m && m.node && m.node.mount === true) && fs.existsSync(path.join(RUN, 'spirit', 'app', own, own + '.js')); } catch (e) { ownServer = false; }
  const node = P.node = await scratchNode({ servers: SERVERS.servers.concat(ownServer && SERVERS.servers.indexOf(own) === -1 ? [own] : []) });
  if (!node.up) { P.fail = 'the scratch node did not come up: every rule here would blame the wrong thing'; return P; }
  if (!node.debug) { P.fail = 'the scratch node\'s DEBUG could not be switched on (node.debug)'; return P; }
  if (ownServer) {
    const served = await until(function () {
      return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: { family: own } }) })
        .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.interface); }, function () { return false; });
    }, 30000);
    if (!served) { P.fail = 'its app\'s server, spirit/app/' + own + '/' + own + '.js, did not come up on the scratch node in 30 s: nothing of it judged'; return P; }
    P.notes.push('its app\'s server ' + own + ' answers its interface');
  }
  const page = P.page = await chromePage(chrome);
  if (page.error) { P.fail = page.error; return P; }

  // it loads by itself
  // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
  // parts via spirit.require; nothing is preloaded"). The node's DEBUG page for it, made from its address.
  P.stage = 'debug page';
  const address = ADDRESS;
  const mountPage = await fetch(node.base + address);
  P.debugStatus = mountPage.status;
  if (mountPage.status !== 200) return P;
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: WATCH });
  await page.send('Page.navigate', { url: node.base + address });
  let report = null;
  await until(function () {
    return page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)').then(function (s) {
      report = s ? JSON.parse(s) : null; return !!report && report.state !== 'loading';
    });
  }, WAIT);
  await sleep(500);
  P.report = report;
  P.thrown = page.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
  // A file asked for and not there is missing; the door's answers (a refusal answers 404 too) and the browser's own
  // favicon ask are not files the page asked for.
  const notFile = function (url) { return /\/api\/|\/favicon\.ico$/.test(String(url || '')); };
  P.errors = page.heard.filter(function (m) { return (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !notFile(m.params.entry.url)); })
    .map(function (m) { return m.params.entry ? m.params.entry.text : (m.params.args || []).map(function (a) { return a.value || a.description; }).join(' '); });
  P.missing = page.heard.filter(function (m) { return m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !notFile(m.params.response.url); }).map(function (m) { return m.params.response.status + ' ' + m.params.response.url.replace(node.base, ''); })
    .concat(page.heard.filter(function (m) { return m.method === 'Network.loadingFailed' && !m.params.canceled; }).map(function (m) { return 'failed ' + m.params.errorText; }));
  // NO ELEMENT INSTALLED, KNOWN BY THE PAGE, NOT BY READING ITS CODE (goal/G47.1, box v121: "no code reading: after
  // loading, the page looks at window.spirit.element at the script's own path, where installSpiritElement puts an element
  // with its create (a helper goes to spirit.required)"; "with no element installed these are skipped, never counted
  // green"): the bare page says so when nothing with a create stands there (spirit/DEBUG/headLessBrowser.js).
  if (report && report.state === 'failed' && /places no element with a create at spirit\.element\./.test(report.error)) { P.noElement = true; P.stage = 'no element'; return P; }
  if (!report || report.state !== 'mounted') return P;
  P.stage = 'mounted';

  // MOUNTED EMPTY, JUDGED AS DRAWN (goal/G47.1, box v121, before any press or typing). What create() put into its
  // container is the element's box: the mount box's own children (Q4, "create() returns a node in some elements and a
  // handle like { destroy() } in others (chat, desk): may the check judge the node create() puts into its container?";
  // Andy: "wsl, yes.").
  // 1. "its create() box declares a constraint in its computed style: overflow not visible (hidden, clip, auto, scroll);
  //    wrapping and ellipsis only on top of that. overflow visible is red."
  P.unbounded = JSON.parse(await page.evaluate('JSON.stringify(Array.prototype.map.call(window.spiritMount.box.children, function (el) { var cs = getComputedStyle(el); return { node: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).join(".") : ""), x: cs.overflowX, y: cs.overflowY }; }).filter(function (b) { return b.x === "visible" || b.y === "visible"; }))'));
  P.boxCount = await page.evaluate('window.spiritMount.box.children.length');
  // 2. "every input in it has a maxlength."
  const INPUTS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("textarea, input"), function (el) { return el.tagName === "TEXTAREA" || /^(|text|email|search|url|tel|password|number)$/.test(el.type || ""); })';
  const nameOf = 'function (el) { var box = window.spiritMount.box; var parts = []; for (var n = el; n && n !== box; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n === el && el.placeholder ? "[" + el.placeholder + "]" : "") + (n === el && el.tagName === "BUTTON" ? "[" + String(el.textContent || el.title || "").trim().slice(0, 30) + "]" : "")); } return parts.join(" > "); }';
  P.inputCount = await page.evaluate(INPUTS + '.length');
  P.noMax = JSON.parse(await page.evaluate('JSON.stringify(' + INPUTS + '.filter(function (el) { return !(el.maxLength > 0); }).map(' + nameOf + '))'));
  // 3. "every input and button in it has a listener on itself or on a node between it and the mounted element's box (read
  //    through Chrome's debugger, DOMDebugger.getEventListeners, no code reading); one on the document or window does not
  //    count. none: red at 0.6."
  const PRESSABLE = 'Array.prototype.concat.call([], ' + INPUTS + ', Array.prototype.slice.call(window.spiritMount.box.querySelectorAll("button")))';
  P.pressableCount = await page.evaluate(PRESSABLE + '.length');
  P.deaf = [];
  for (let i = 0; i < P.pressableCount; i++) {
    const way = await page.send('Runtime.evaluate', { expression: '(function () { var box = window.spiritMount.box; var el = ' + PRESSABLE + '[' + i + ']; var a = []; for (var n = el; n && n !== box; n = n.parentElement) a.push(n); return a; }())' });
    const arr = way.result && way.result.result && way.result.result.objectId;
    if (!arr) { P.deaf.push('item ' + i + ': its way up could not be read'); continue; }
    const props = await page.send('Runtime.getProperties', { objectId: arr, ownProperties: true });
    const nodes = ((props.result && props.result.result) || []).filter(function (p) { return /^\d+$/.test(p.name) && p.value && p.value.objectId; });
    let heard = false;
    for (const n of nodes) {
      const l = await page.send('DOMDebugger.getEventListeners', { objectId: n.value.objectId });
      if (l.result && (l.result.listeners || []).length) { heard = true; break; }
    }
    if (!heard) P.deaf.push(await page.evaluate('(' + nameOf + ')(' + PRESSABLE + '[' + i + '])'));
  }
  // 4. "no node of it carries margin, padding or gap in its style attribute, and no <style> block it adds sets them (read
  //    from the page's style sheets)". The bare page's own <style> (html, body) is the page's, not the element's.
  const SPACING = '/(^|;)\\s*(margin|padding|gap|row-gap|column-gap)(-[a-z-]+)?\\s*:/i';
  P.spacedNodes = JSON.parse(await page.evaluate('JSON.stringify(Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("*"), function (el) { return ' + SPACING + '.test(el.getAttribute("style") || ""); }).map(function (el) { return (' + nameOf + ')(el) + " style=\\"" + el.getAttribute("style").slice(0, 80) + "\\""; }))'));
  P.spacedRules = JSON.parse(await page.evaluate('JSON.stringify([].concat.apply([], Array.prototype.filter.call(document.styleSheets, function (s) { var o = s.ownerNode; return o && o.tagName === "STYLE" && !/^\\s*html, body \\{ height: 100%; margin: 0; \\}/.test(o.textContent); }).map(function (s) { var out = []; try { Array.prototype.forEach.call(s.cssRules, function (r) { if (r.style && ' + SPACING + '.test(r.style.cssText)) out.push(r.selectorText + " { " + r.style.cssText.slice(0, 80) + " }"); }); } catch (e) { out.push("a style block that cannot be read: " + e.message); } return out; })))'));

  // EVERY BOX INSIDE IT BOUNDED, TALL AND WIDE (goal/G41.19, box v23; rule/16; Andy: "list-in-a-sized-box
  // (anything-in-a-sized-box) are really a test of the container", "any container that mounts unknown stuff inside it
  // should be bounded in vertically and horizontally"). Judged by the layout itself, so the page names no element:
  // every box it drew that scrolls (overflow auto or scroll, either way), shown, is given a child far taller than it,
  // then one far wider, and must keep its height and its width, inside the mount box. A box only as tall or as wide as
  // its content, anywhere above it, lets it grow. A dropdown's list is hidden until it opens, and is not asked. It is
  // judged as drawn, and again after each tool and tab button it draws is pressed in turn. Each box that grows is named
  // by this file's path and the box's id chain (Andy: "only if the test is properly named can the problem be diagnosed
  // quickly").
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
  await page.evaluate('Promise.resolve().then(function () { return spirit.require("spirit/element/icon.js"); }).then(function () { var p = document.createElement("div"); var i = spirit.element.spirit.element.icon.create(p, { glyph: "A" }); window.spiritIconMark = String(i && i.className || "").trim().split(/\\s+/)[0] || ""; }, function () { window.spiritIconMark = ""; })');
  P.iconMark = await page.evaluate('window.spiritIconMark || ""');
  const loose = {};
  const iconProbe = async function () { const s = await page.evaluate('JSON.stringify(' + ICONS + ')'); (s ? JSON.parse(s) : []).forEach(function (x) { loose[x] = true; }); };
  await iconProbe();
  const seen = P.boxes = {};
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
  P.notes.push('pressed ' + count + ' tool and tab buttons; ' + Object.keys(seen).length + ' scrolling boxes');
  P.loose = Object.keys(loose);
  P.spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');

  // EVERY INPUT HELD AT ITS LIMIT (goal/G41.27; Andy: "in the general UI tests (headless browser), any input field must
  // be checked for size-limits, and get a \"red\" if it violates that rule."): every text field it draws, as drawn and
  // after its tools are pressed, is typed far past the longest field the rules allow, as a hand would type it, and must
  // keep no more than that. A field nothing holds keeps it all.
  const typed = 'x'.repeat(MOST_BYTES * 2);
  // Typed through the browser's own input (Input.insertText), which fires beforeinput as a hand's typing does; a script's
  // execCommand does not, and would type past any field.
  const FIELDS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("textarea, input"), function (el) { return (el.tagName === "TEXTAREA" || /^(|text|email|search|url|tel|password)$/.test(el.type || "")) && el.getClientRects().length && !el.disabled && !el.readOnly; })';
  const fieldCount = await page.evaluate(FIELDS + '.length');
  const fields = P.fields = [];
  for (let i = 0; i < fieldCount; i++) {
    const at = await page.evaluate('(function () { var box = window.spiritMount.box; var el = ' + FIELDS + '[' + i + ']; if (!el) return ""; el.focus(); el.value = "";' +
      ' var parts = []; for (var n = el; n && n !== box; n = n.parentNode) { if (n.id || n === el) parts.unshift(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n === el && el.placeholder ? "[" + el.placeholder + "]" : "")); } return parts.join(" > "); }())');
    if (!at) continue;
    await page.send('Input.insertText', { text: typed });
    const kept = await page.evaluate('(function () { var el = ' + FIELDS + '[' + i + ']; var n = el ? new TextEncoder().encode(el.value).length : 0; if (el) el.value = ""; return n; }())');
    fields.push({ at: at, kept: kept });
  }
  P.notes.push(fields.length + ' fields typed past ' + MOST_BYTES + ' bytes');

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
  const W = P.W = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch || null)')) || { net: [], subs: [], writes: [], moved: [] };
  // THE FAMILIES IT USES, AND WHETHER IT LOADED THEIR INTERFACES ITSELF (Andy: "JUST BECAUSE api branches are intrinsic doesn't
  // fucking mean the browser has interfaces for them already loaded, EVERY FUCKING ELEMENT REQUIRES THE FUCKING INTERFACES IT
  // FUCKING NEEDS"): the families it called, and those whose spirit.data branches it watched; on a bare page each one's api.js
  // (spirit/<family>/api.js or spirit/app/<family>/api.js) stands in spirit.required only if this file loaded it.
  P.usedFamilies = (W.families || []).slice();
  (W.subs || []).forEach(function (x) { if (x.mine && x.kind === 'data.watch' && x.path) { const f = String(x.path).split('/')[1]; if (f && P.usedFamilies.indexOf(f) === -1) P.usedFamilies.push(f); } });
  P.unloaded = JSON.parse(await page.evaluate('JSON.stringify(' + JSON.stringify(P.usedFamilies) + '.filter(function (f) { var r = (window.spirit && window.spirit.required) || {}; var s = r.spirit || {}; return !((s[f] && s[f].api) || (s.app && s.app[f] && s.app[f].api)); }))'));
  P.notes.push('pressed ' + pressed + ' buttons; ' + W.net.length + ' calls on the wire; ' + W.writes.length + ' writes; ' + W.subs.length + ' subscriptions');

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
  P.probed = probed;
  P.outside = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch && window.spiritWatch.drawnOutside ? window.spiritWatch.drawnOutside() : [])'));
  P.destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
  // EVERY ELEMENT BRINGS ITS OWN SUBSCRIPTIONS, AND LETS THEM GO (rule/8; goal/G41.27): destroyed, nothing it listened to
  // is still held.
  if (P.destroyed !== 'none') {
    await sleep(200);
    P.after = JSON.parse(await page.evaluate('JSON.stringify((window.spiritWatch || { subs: [] }).subs)'));
  }
  P.stage = 'done';
  return P;
}
// The session, bounded: one that has not finished in PAGE_MS fails its world, as a hang does.
function bounded(work) {
  return Promise.race([work.then(null, function (e) { return { stage: 'chrome', fail: 'it crashed: ' + (e && e.stack || e) }; }),
    new Promise(function (r) { setTimeout(function () { r({ stage: 'chrome', fail: 'it hung: the page session took more than ' + (PAGE_MS / 1000) + ' s' }); }, PAGE_MS); })]);
}

function oneFile(P) {
  // ON ITS PAGE: what the session drew, each rule said as the old checks were.
  test.run('the world: a scratch node with its DEBUG on, and a Chrome page', 0.2, function () {
    (P.notes || []).forEach(function (n) { test.comment(n); });
    return !P.fail || P.fail;
  }, test.limit.quick);
  const before = function () { return P.fail ? 'no page: the world failed' : ''; };
  // <address>: it loads by itself
  test.run('the node answers its DEBUG page for it', 0.4, function () {
    return before() || P.debugStatus === 200 || ADDRESS + ' answered ' + P.debugStatus;
  }, test.limit.quick);
  const noMount = function () { return before() || (P.debugStatus !== 200 ? 'no DEBUG page: the world failed' : ''); };
  // A PAGE SCRIPT THAT INSTALLS NO ELEMENT (goal/G47.1, box v121): loaded on the bare page, what it runs is judged; the
  // element rules are skipped, said as a comment, never counted green.
  if (P.noElement) {
    test.run('with no element installed, nothing it runs throws', 0.8, function () { return noMount() || !P.thrown.length || 'thrown: ' + short(P.thrown); }, test.limit.quick);
    test.run('with no element installed, every file it asks for is there', 0.4, function () { return noMount() || !P.missing.length || 'missing: ' + short(P.missing); }, test.limit.quick);
    test.run('with no element installed, it says no error on the console', 0.4, function () { return noMount() || !P.errors.length || 'console: ' + short(P.errors); }, test.limit.quick);
    unjudged('it installs no element at spirit.element.' + rel.replace(/\.js$/, '').split('/').join('.') + ': the element rules are skipped');
    pageAfter(P);
    return;
  }
  const ownCode = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  // "if it throws when mounted empty, red at 0.8; this enforces rule 26 (an element loads its own stuff)" (box v121).
  test.run('it mounts by itself on a bare page: spirit.js, then this file alone', 0.8, function () {
    return noMount() || (!!P.report && P.report.state === 'mounted') || 'the page said: ' + short(P.report);
  }, test.limit.quick);
  test.run('nothing it runs throws', 0.8, function () { return noMount() || !P.thrown.length || 'thrown: ' + short(P.thrown); }, test.limit.quick);
  test.run('every file it asks for is there', 0.4, function () { return noMount() || !P.missing.length || 'missing: ' + short(P.missing); }, test.limit.quick);
  test.run('and it says no error on the console', 0.4, function () { return noMount() || !P.errors.length || 'console: ' + short(P.errors); }, test.limit.quick);
  const mounted = P.stage === 'done';
  const notDrawn = function () { return noMount() || (!mounted ? 'it did not mount: the world failed' : ''); };
  // MOUNTED EMPTY (goal/G47.1, box v121): the four element rules, judged as drawn before any press.
  // A ROW ELEMENT PUTS NO BOX INTO A CONTAINER (cw: "a row's create takes a row, not a container, and draws into the cells
  // its list hands it"): with nothing put into its container there is no box of its own to judge (Q4); said as a comment,
  // never green. Its list's box is judged with the list.
  if (mounted && !P.boxCount) unjudged('mounted empty, it puts nothing into the container it is given (a row element): no box of its own');
  else test.run('mounted empty, the box it puts into its container declares a constraint: overflow not visible', 0.4, function () {
    if (notDrawn()) return notDrawn();
    return !P.unbounded.length || P.unbounded.length + ' with overflow visible: ' + short(P.unbounded.map(function (b) { return b.node + ' (overflow-x ' + b.x + ', overflow-y ' + b.y + ')'; }));
  }, test.limit.quick);
  if (mounted && !P.inputCount) unjudged('mounted empty, it draws no input');
  else {
    test.run('mounted empty, every input it draws has a maxlength', 0.4, function () {
      if (notDrawn()) return notDrawn();
      return !P.noMax.length || P.noMax.length + ' of ' + P.inputCount + ' have none: ' + short(P.noMax);
    }, test.limit.quick);
  }
  if (mounted && !P.pressableCount) unjudged('mounted empty, it draws no input and no button');
  else {
    test.run('mounted empty, every input and button it draws has a listener on itself or on a node between it and its box', 0.6, function () {
      if (notDrawn()) return notDrawn();
      return !P.deaf.length || P.deaf.length + ' of ' + P.pressableCount + ' have none on their way up: ' + short(P.deaf);
    }, test.limit.quick);
  }
  test.run('mounted empty, no node of it carries margin, padding or gap in its style attribute, and no <style> block it adds sets them', 0.4, function () {
    if (notDrawn()) return notDrawn();
    const bad = (P.spacedNodes || []).concat(P.spacedRules || []);
    return !bad.length || bad.length + ' set spacing: ' + short(bad);
  }, test.limit.quick);
  // Said when it drew a scrolling box; each box that grows named in the answer.
  if (!mounted || Object.keys(P.boxes).length) {
    // <address>: sized box <id chain>
    test.run('it keeps its height and its width when given far more than it holds', 0.4, function () {
      if (notDrawn()) return notDrawn();
      return listed(Object.keys(P.boxes).map(function (k) {
        const p = P.boxes[k];
        const why = [];
        if (!p.tall.kept) why.push('it grows taller with its content');
        if (!p.wide.kept) why.push('it grows wider with its content');
        if (!p.tall.inside || !p.wide.inside) why.push('it reaches past the mount box');
        if (p.tall.spilt || p.wide.spilt) why.push('the mount box overflows');
        return why.length ? k + ': ' + why.join('; ') : '';
      }).filter(Boolean));
    }, test.limit.quick);
  }
  // <address>: every icon it paints is the icon element
  test.run('every pictograph it draws lies inside the icon element', 0.4, function () {
    if (notDrawn()) return notDrawn();
    return (!!P.iconMark && !P.loose.length) || (P.iconMark ? P.loose.length + ' drawn outside the icon element: ' + short(P.loose.slice(0, 5)) : 'no icon element to paint through: spirit/element/icon.js made no element with a class');
  }, test.limit.quick);
  // <address>: its box never grows
  test.run('it never grows its box, and the page never scrolls sideways', 0.4, function () {
    if (notDrawn()) return notDrawn();
    return P.spills === false || 'its box overflows, or the page scrolls sideways';
  }, test.limit.quick);
  // <address>: every field it draws stops at its limit
  if (mounted && !P.fields.length) unjudged('it draws no text field');
  else {
    test.run('every field it draws stops at its limit, typed past it', 0.4, function () {
      if (notDrawn()) return notDrawn();
      const free = P.fields.filter(function (f) { return f.kept > MOST_BYTES; });
      return !free.length || free.length + ' kept more than any rule allows: ' + short(free.map(function (f) { return f.at + ' kept ' + f.kept; }));
    }, test.limit.quick);
  }
  const W = (P.W) || { net: [], subs: [], writes: [], moved: [], searches: [] };
  // EVERY CALL ON THE WIRE THROUGH SPIRIT (goal/G41.27; Andy: "can it assert that no element posts or fetches by itself,
  // and that all wire-stuff goes through spirit?", "boot.js MUST be an exception to the rules."): each one the page made
  // was made by spirit's own code.
  // <address>: all it sends goes through spirit
  test.run('every call it puts on the wire goes through spirit', 0.4, function () {
    if (notDrawn()) return notDrawn();
    const own = W.net.filter(function (c) { return !c.spirit; });
    // OUTSIDE goal/G41.28, AND STILL RED (Andy, G41.28: "WSL will drop Q23 from this item, and mark those two related reds as
    // outside it"): login fetches its steps file before the page has a link to its node, and the file viewer fetches a
    // file at home piece by piece. Each red names that it is outside the item; it is not met, so it is not green.
    // shell/login/login.js is no longer in the tree; the file viewer's spirit/element/fstat.js is.
    const OUTSIDE = own.some(function (c) { return /^(shell\/login\/login|spirit\/element\/fstat)\.js$/.test(String(c.file || '')); }) ? ' (outside goal/G41.28, Andy: "WSL will drop Q23 from this item, and mark those two related reds as outside it")' : '';
    return !own.length || own.length + ' made by itself: ' + short(own.map(function (c) { return c.kind + ' ' + c.url.replace(P.node.base, '') + ' from ' + (c.file || 'an unnamed script'); })) + OUTSIDE;
  }, test.limit.quick);

  // WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27; Andy: "elements that change things, also subscribe to the changes
  // they cause, since andy request an element generates would imply that it must listen for confirmation of the
  // results"): one that sent a write holds, while mounted, a listener on the page's stream of its own making.
  // THROUGH SPIRIT.DATA, NOT THE RAW STREAM (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
  // changes shit it listens to fucking update via the spirit object"): what it listens with is a spirit.data.watchPath of
  // its own making, its searches' included. A subscription of its own to the raw stream, taken into a store of its own,
  // is how the Desk List kept rows spirit.data never held: it does not count.
  // <address>: what it watches in spirit.data redraws it
  const probed = P.probed || [];
  const seenProbe = probed.filter(function (x) { return !x.hidden; });
  if (mounted && !probed.length) unjudged('it watches no spirit.data path');
  else if (mounted && !seenProbe.length) unjudged('it shows nothing on this page, so there is nothing to redraw');
  else if (mounted && OWN_PROOF[rel] && !seenProbe.some(function (x) { return x.redrew; })) {
    // PROVED IN ITS OWN TEST (Andy, Q24: "Shall deskDetails' own test be the proof that it redraws from the verifier,
    // since the page sweep opens no item?" "yes."): what it watches draws only for an item open, and this page opens
    // none. Its own test is run here, and the check is green only if its own redraw check passed.
    test.run('what it watches redraws it, proved in its own test', 0.4, function () {
      const p = OWN_PROOF[rel];
      const said = require('child_process').spawnSync(process.execPath, [path.join(RUN, p.test)], { cwd: RUN, encoding: 'utf8', timeout: 120000 }).stdout || '';
      return said.split('\n').some(function (l) { return /SUCCESS/.test(l) && l.indexOf(p.check) !== -1; }) || 'its own test (' + p.test + ') did not pass: ' + p.check;
    }, test.limit.long);
  }
  else {
    test.run('a change written into what it watches redraws it', 0.4, function () {
      if (notDrawn()) return notDrawn();
      return seenProbe.some(function (x) { return x.redrew; }) || 'it watches ' + seenProbe.map(function (x) { return x.path; }).join(', ') + ' and redraws for none of them';
    }, test.limit.quick);
  }
  // <address>: every interface it needs, it requires itself
  if (mounted && !(P.usedFamilies || []).length) unjudged('it calls and watches no family');
  else {
    test.run('every family it calls or watches, it required that family\'s interface itself', 0.8, function () {
      if (notDrawn()) return notDrawn();
      return !P.unloaded.length || 'it uses ' + P.unloaded.join(', ') + ' with no api.js of it in spirit.required: it leans on what another part loaded';
    }, test.limit.quick);
  }
  // <address>: what it changes, it listens for through spirit.data
  if (mounted && !W.writes.length) unjudged('its presses sent no write (its code is judged for it, above)');
  else {
    test.run('it sent writes and watches spirit.data paths for them', 0.4, function () {
      if (notDrawn()) return notDrawn();
      const watching = W.subs.filter(function (x) { return x.mine && x.live && x.kind === 'data.watch'; }).length;
      const raw = W.subs.filter(function (x) { return x.mine && x.live && x.kind !== 'data.watch'; }).length;
      return watching > 0 || 'it sent ' + short(W.writes) + ' and watches no spirit.data path' + (raw ? '; it listens to the raw stream ' + raw + ' times instead' : '');
    }, test.limit.quick);
  }
  // IT DRAWS ONLY WHAT THE STREAM SAYS (rule/19; goal/G41.27, the box: "after a press, until the stream answers, an
  // element may change only its busy spinner, its button's disabled state and its fine print; any other change it makes
  // is red"): judged while a write it sent is out, until the node answers it.
  // <address>: while a write is out, it draws nothing of its own
  if (mounted && !W.writes.length) unjudged('its presses sent no write');
  else {
    test.run('while its writes were out it changed only busy marks, disabled buttons and fine print', 0.4, function () {
      if (notDrawn()) return notDrawn();
      return !W.moved.length || W.moved.length + ' changes while a write was out: ' + short(W.moved.slice(0, 6));
    }, test.limit.quick);
  }
  // EVERY SEARCH FROM SPIRIT.DATA (goal/G41.28; Andy, box v15: "general test for screen objects will make sure that all
  // damn data is cached in spirit data.", and "every probabilitySearch on a page is made with a spirit.data branch (its
  // data option), and draws only rows that branch holds. A list fed by its own rows() or by answers alone goes red.").
  // <address>: every search it makes ranks spirit.data
  const made = W.searches || [];
  // ONE EXCEPTION, DEFERRED, AND STILL RED (Andy, the box: "the only exception is introspector, deferred for network-scope
  // design reasons."): the probability search keeps rows of its own for introSpector's selectors over another node, so
  // its own page, mounted bare, still makes one. The red names the deferral; it is not met, so it is not green.
    const DEFERRED = rel === 'spirit/element/search.js' || rel === 'spirit/element/introSpector.js' || rel === 'spirit/app/introSpector/element.js' ?' (introSpector\'s deferral, the box: "the only exception is introspector, deferred for network-scope design reasons.")' : '';
  if (mounted && !made.length) unjudged('it makes no search');
  else {
    test.run('its searches are each made with a spirit.data branch, no rows of their own', 0.4, function () {
      if (notDrawn()) return notDrawn();
      const off = made.filter(function (x) { return !x.data || x.rows; });
      return !off.length || off.length + ' not from spirit.data: ' + short(off.map(function (x) { return (x.verb || 'a search') + (x.data ? '' : ' with no data branch') + (x.rows ? ' fed by its own rows()' : ''); })) + DEFERRED;
    }, test.limit.quick);
  }
  // "and draws only rows that branch holds": every row a search shows, after its tools and buttons are pressed, is a
  // row of its branch in spirit.data. A list that keeps its rows anywhere else draws what the branch does not hold.
  const outside = P.outside || [];
  const drew = outside.reduce(function (n, x) { return n + x.drawn; }, 0);
  if (mounted && !drew) unjudged('its searches draw no row');
  else {
    test.run('every row its searches draw is a row their spirit.data branch holds', 0.4, function () {
      if (notDrawn()) return notDrawn();
      const strays = outside.filter(function (x) { return x.outside.length; });
      return !strays.length || strays.length + ' searches draw rows their branch does not hold: ' + short(strays.map(function (x) { return (x.verb || 'a search') + ' on ' + x.data + ': ' + x.outside.join(', '); }));
    }, test.limit.quick);
  }
  // <address>: destroy leaves its box empty
  if (mounted && P.destroyed === 'none') test.run('it has no destroy of its own (an app is closed by the face)', 0.4, function () { return P.destroyed === 'none' || 'after destroy its box still holds what it drew'; }, test.limit.quick);
  else {
    test.run('destroyed, its box is empty', 0.4, function () {
      if (notDrawn()) return notDrawn();
      return P.destroyed === 'empty' || 'after destroy its box still holds what it drew';
    }, test.limit.quick);
    const mine = (P.after || []).filter(function (x) { return x.mine; });
    if (mounted && !mine.length) unjudged('it made no subscription');
    else {
      test.run('destroyed, it lets every subscription it made go', 0.4, function () {
        if (notDrawn()) return notDrawn();
        const held = mine.filter(function (x) { return x.live; });
        return !held.length || held.length + ' still held after destroy: ' + short(held.map(function (x) { return x.kind; }));
      }, test.limit.quick);
    }
  }
  pageAfter(P);
}
// The page and its scratch node, gone when the file's checks are said.
function pageAfter(P) {
  test.after(async function () {
    const page = P.page; const node = P.node;
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    if (node && !node.shared) try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [node && !node.shared ? node.root : '', page && page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  });
}

// What it judges: given no file, the tree and every page module; given a file, that file. A page module's page is drawn
// before its rules are said (session above), so a rule its page gives nothing to judge is never said green.
if (!arg) every();
else if (!full) {
  test.run('the world: the file handed is there', 0.2, function () { return 'no shell app or element to judge: ' + JSON.stringify(arg); }, test.limit.quick);
} else if (!pageScript(rel)) {
  test.run('the world: the file handed is a page script of the tree', 0.2, function () { return 'not a script under spirit/ outside a test folder: ' + JSON.stringify(rel); }, test.limit.quick);
} else bounded(session()).then(oneFile);
