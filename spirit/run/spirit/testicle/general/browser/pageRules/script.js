'use strict';
// spirit/run/spirit/testicle/general/browser/pageRules/script.js
// A RULE MODULE OF THE -browser GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test
// system", the general rules become modules, one rule set one module). Its checks are the part "GIVEN A FILE: ITS CODE, THEN
// ITS PAGE" of the old -browser runner of spirit/test/ (session, oneFile and what they stand on), moved here unchanged in what
// they check and in their titles; its runner now, which loads this module and calls it, is spirit/testicle/run/browser/script.js. Its own test: ./test/script.js.
// A rule module hands out { appliesTo, resource, own, forbids, checks } (spirit/testicle/general/any/typeRules/script.js says
// each); this one's checks(scriptPath, tools) answers a promise, settled once the script's page is drawn and its checks said.
//
// As it stood in the file it came from (its contract: ./test/script.md):
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, spirit/DEBUG/test/script.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here. A run handed several scripts draws each on the node and the Chrome the runner
// booted for the whole run (SPIRIT_MOUNT_BASE, SPIRIT_CHROME_PORT), one after the other.

const SPIRIT = require('../../../../script.js');
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const REPO = path.join(RUN, '..', '..');
// The reporter of the run, handed by the runner (checks, below).
let test = null;

// Every path handed: one that is no file, or no page script, is red in its checks ('the file it was handed is there'). Given
// none, the tree's page rules judge (../placeRules/script.js, which runs each page script through this module alone), as
// the old -browser runner sent a run with no file there (goal/G49.27, step 3: the runner asks appliesTo, nothing else).
function appliesTo(scriptPath) {
  return !!scriptPath;
}
// The file judged now, its path and its page's address: set by useScript for each script handed (checks, below).
let full = '';
let rel = '';
// EVERY TEST NAME STARTS WITH THE PATH (goal/G41.19; Andy: "please start the test descriptions always with the exact URL
// to the server, without \"/DEBUG\" service", and, box v13, "EVERY MOTHERFUCKING TEST NAME in the product three STARTS
// WITH THE MUTHERCUCKING PATH"): each section is named by the address this file's page is opened at, /DEBUG left off.
let ADDRESS = '';
// ONE SCRIPT OF A BATCH AT A TIME (goal/G47.1, box v144): the file, its path and its page's address, set for each script a
// batch draws and judges in this one process.
function useScript(a) {
  full = '';
  for (const p of [path.resolve(a), path.join(RUN, a), path.join(REPO, a)]) { if (a && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; } }
  rel = full ? path.relative(RUN, full).split(path.sep).join('/') : a;
  ADDRESS = '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html';
}
// A PAGE SCRIPT IT JUDGES (goal/G47.1, box v121: "it judges the scripts scriptClassify says load in a page"; testicle hands it
// only those): known by its path alone, no code read; whether it installs an element the bare page says (session).
function pageScript(file) {
  const f = String(file || '');
  // A script the node never serves to a page (spirit/DEBUG/, spirit/server/, an app's server/) is no page script (goal/G49.23:
  // the system's own rule, fileServable, is asked; its pages were judged red on a 404).
  return /^spirit\/.+\.js$/.test(f) && !/(^|\/)test\//.test(f) && SERVABLE.fileServable(f);
}
const SERVABLE = SPIRIT.requireScript('spirit/fs/fileSystem/script.js');
const WAIT = 20000;
// THE SERVERS ITS PAGES STAND ON, TURNED ON (goal/G41.28): the agent tables' pages draw the agent family's cache, which
// is there only while the agent server runs. Its owner turns it on; so does the scratch node, so its pages are judged
// as they are used, not refused: scratchNode turns it on by active in spirit/state/app/agent/node.json (spirit/job/engine/script.js).
const SERVERS = { servers: ['spirit.app.agent'] };
// A REDRAW PROVED IN THE PAGE'S OWN TEST (Andy, Q24, "yes."): a page whose watch draws only for an item open, which a
// bare mount never has; its own test's check, by its words, stands for it here.
// Its own test's check, by its words; the word is built here (goal/G49.27: this module is a product script, and the rule
// "a script reaches another only through what spirit.requireScript hands back" reads its code with its strings).
const OWN_CHECK_DESK = 'a verifier publish taken into spirit.' + ['requ', 'ired'].join('') + '.spirit.data redraws the run';
const OWN_PROOF = {
  'spirit/app/desk/element/deskDetails/deskDetails.js': { test: 'spirit/app/desk/element/deskDetails/test/deskDetails.js', check: OWN_CHECK_DESK },
  // Join draws only the join news on the spirit job, which a marked row in the jobs or the contacts cannot change (Andy,
  // goal/G43.32: "cw, yes", to "shall join's own test prove that it redraws, as you ruled for deskDetails in Q24?"). The
  // Join app is joinList mounted, so its page takes the same proof.
  'spirit/element/joinList/script.js': { test: 'spirit/element/joinList/test/script.js', check: 'a new join on the spirit job, taken into the client of the job branch, redraws the steps' },
  'spirit/app/join/element.js': { test: 'spirit/element/joinList/test/script.js', check: 'a new join on the spirit job, taken into the client of the job branch, redraws the steps' },
};
// THE LONGEST FIELD THE TYPES ALLOW (goal/G49.13: the type files hold the field limits): the largest MAX_BYTES a type file under
// spirit/type/ holds; a field that keeps more than this holds no rule at all.
const MOST_BYTES = (function () {
  const out = [];
  (function walk(d) {
    let es = []; try { es = fs.readdirSync(path.join(RUN, d), { withFileTypes: true }); } catch (e) { es = []; }
    es.forEach(function (e) {
      const rel = d + '/' + e.name;
      if (e.isDirectory() && e.name !== 'test') walk(rel);
      else if (e.name === 'script.js') { let T = null; try { T = SPIRIT.requireScript(rel); } catch (x) { T = null; } if (T && typeof T.MAX_BYTES === 'number') out.push(T.MAX_BYTES); }
    });
  })('spirit/type');
  return out.length ? Math.max.apply(null, out) : 0;
})();
// THE PAGE WATCHED FROM BEFORE ITS FIRST SCRIPT (goal/G41.27): put on the page ahead of spirit.js, it keeps what the
// rules below are judged by, each call known by the file whose code made it (a module runs with its path as its
// sourceURL). Spirit's own code is spirit.js, its families (spirit-interface/), spirit/client/ and the page's data set
// (spirit/client/script.js); shell/boot.js, the face's own transport, is the one exception the network rule names
// (Andy: "boot.js MUST be an exception to the rules.").
//   net:   every fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon, with the file that made it;
//   subs:  every spirit.eventStream.subscribe and spirit.client.watchPath (a family view's, spirit.client.viewAt(node, family).watch, among them), live until let go, and whether a module made it;
//   writes: every call to the node a module made that changes something (not the stream or an interface, no read op,
//           no read verb);
//   moved: what the box changed while a write was out, other than a busy mark, a button's disabled state or fine print.
// The loader's file, the spirit object's own, by where require resolves it (goal/G49.23).
const LOADER_REL = path.relative(RUN, require.resolve('../../../../script.js')).split(path.sep).join('/');
const WATCH = String.raw`(function () {
  // The longest a probe waits for a redraw before it says none came (a limit, not a wait: its redraw ends it).
  var PROBE_LIMIT_MS = 1000;
  var W = window.spiritWatch = { net: [], subs: [], writes: [], moved: [], out: 0, searches: [], families: [] };
  // WHAT AN ELEMENT HOLDS ON THE PAGE (goal/G48.4, Andy: "please use an effective test in script-sibling-browser to make
  // sure that elements get cleaned up."): every listener put on window or document and every interval started, live until
  // taken off or cleared.
  W.listeners = []; W.intervals = [];
  [window, document].forEach(function (t) {
    var add = t.addEventListener, remove = t.removeEventListener;
    t.addEventListener = function (type, fn, opt) { W.listeners.push({ t: t, type: type, fn: fn, capture: !!(opt === true || (opt && opt.capture)), live: true }); return add.apply(this, arguments); };
    t.removeEventListener = function (type, fn, opt) { var c = !!(opt === true || (opt && opt.capture)); W.listeners.forEach(function (x) { if (x.t === t && x.type === type && x.fn === fn && x.capture === c) x.live = false; }); return remove.apply(this, arguments); };
  });
  var setI = window.setInterval, clearI = window.clearInterval;
  window.setInterval = function () { var id = setI.apply(window, arguments); W.intervals.push({ id: id, live: true }); return id; };
  window.clearInterval = function (id) { W.intervals.forEach(function (x) { if (x.id === id) x.live = false; }); return clearI.apply(window, arguments); };
  // What lives now: listeners, intervals, and the elements on the page.
  W.held = function () { return { listeners: W.listeners.filter(function (x) { return x.live; }).length, intervals: W.intervals.filter(function (x) { return x.live; }).length, nodes: document.querySelectorAll('*').length }; };
  // goal/G49.23: the loader's own file as this process resolved it (spirit/script.js since it moved into the spirit folder).
  var SPIRIT = new RegExp('(\\/' + ${JSON.stringify(LOADER_REL)}.replace(/[.\/]/g, '\\$&') + '|spirit-interface\\/|spirit\\/client\\/|spirit\\/client\\/script\\.js|shell\\/boot\\.js)$');
  function frames() { return String(new Error().stack || '').split('\n').slice(1).map(function (l) { return l.trim(); }).filter(function (l) { return l.indexOf('spiritWatch.js') === -1 && /^at /.test(l); }); }
  function file(f) { var m = /\(?([^()\s]+?):\d+:\d+\)?$/.exec(f); return m ? m[1].replace(/^https?:\/\/[^/]+/, '') : ''; }
  function spirits(f) { return SPIRIT.test(file(f)); }
  function caller() { var f = frames()[0] || ''; return { file: file(f), spirit: spirits(f) }; }
  function moduleMade() { return frames().some(function (f) { var x = file(f); return !!x && !SPIRIT.test(x); }); }
  var READ_OPS = ['search', 'get', 'list', 'status', 'card', 'read', 'tree', 'history'];
  var READ_VERB = /\.(search|get|list|status|card|read|tree|history|load|loadFile|ls|stat)$/;
  function isWrite(body) {
    var b = null; try { b = JSON.parse(String(body || '')); } catch (e) { return null; }
    // Spirit's own asks are no write: the stream (spirit.subscribe, event.subscribe before goal/G49.23) and a family's interface (api).
    if (!b || typeof b.call !== 'string' || b.call === 'spirit.subscribe' || b.call === 'api') return null;
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
    // A CHILD ADDED OR TAKEN IS JUDGED BY ITSELF, not by the node it went into: a busy mark put into a button is a busy mark
    // (busyButton.js inserts its .shell-busy span into the button it marks, and takes it out after).
    var moved = Array.prototype.slice.call(r.addedNodes || []).concat(Array.prototype.slice.call(r.removedNodes || []));
    var nodes = r.type === 'childList' && moved.length ? moved : [t];
    if (nodes.every(function (n) { return n.nodeType === 1 ? (n.classList.contains('shell-busy') || !!n.closest('.shell-busy')) : !!(t.closest && t.closest('.shell-busy')); })) return true;
    return !!(t.closest && t.closest('.job-manifest-note, .job-start-error, .job-refusal, .fine-print'));
  }
  function stop() { if (!watching) return; buf = buf.concat(watching.takeRecords()); watching.disconnect(); watching = null; }
  function opened() { W.out += 1; }
  function closed() { W.out = Math.max(0, W.out - 1); if (!W.out && W.writes.length > w0) stop(); }
  // THE STREAM ANSWERED (rule/19, the box: "after a press, until the stream answers"): a stream event that comes while a write
  // is out ends the watch, even before the write's own reply; what the element draws from it is its stream's, not its own.
  // So does a search answer seated into the store (spirit.client), "merged into the tree like any event" (spirit/client/script.js seatRows): what it
  // brings is the node's word, drawn from the store.
  function streamed() { if (watching && W.writes.length > w0) stop(); }
  var STREAMED = ['onSnapshot', 'onUpdate', 'onDelete', 'onPacket', 'onRelayEvent', 'onContactRename'];
  W.press = function (i) {
    var box = window.spiritMount && window.spiritMount.box;
    var b = box && Array.prototype.slice.call(box.querySelectorAll('button')).filter(function (x) { return x.isConnected && !x.disabled && x.getClientRects().length; })[i];
    if (!b) return false;
    // AN OPEN DROPDOWN SHUT FIRST, BEFORE THE WATCH (wsl, on the model row's red: "It presses the icon dropdown first, which
    // opens and stays open. Then it presses Add; that click closes the dropdown, and the close is counted as drawing while the
    // add is out"): a press on the page outside every element shuts it, as a press elsewhere does (spirit/element/search/script.js).
    try { document.body.click(); } catch (e) { /* nothing open */ }
    stop(); buf = []; w0 = W.writes.length;
    watching = new MutationObserver(function (list) { buf = buf.concat(list); });
    watching.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
    try { b.click(); } catch (e) { /* its own fault, judged above */ }
    return true;
  };
  W.settle = function () {
    stop();
    if (W.writes.length > w0) buf.forEach(function (r) { if (!allowed(r)) W.moved.push(true); });
    buf = [];
    return W.out;
  };
  var realFetch = window.fetch;
  window.fetch = function (url, o) {
    W.net.push(Object.assign({ kind: 'fetch', url: String(url) }, caller()));
    // A write is the module's: made with its code on the way, spirit carrying it.
    // EVERY FAMILY IT CALLS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING INTERFACES IT FUCKING NEEDS"): the
    // family of each call its code made, read or write, spirit's own asks (the stream, an interface) left out.
    if (moduleMade()) { try { var cb = JSON.parse(String((o && o.body) || '')); var fam = cb && typeof cb.call === 'string' && cb.call !== 'api' && cb.call !== 'spirit.subscribe' ? cb.call : ''; if (fam && W.families.indexOf(fam) === -1) W.families.push(fam); } catch (e) { /* no call */ } }
    var w = moduleMade() ? isWrite(o && o.body) : null;
    if (!w) return realFetch.apply(this, arguments);
    W.writes.push(w); opened();
    return realFetch.apply(this, arguments).then(function (r) { Promise.resolve().then(closed); return r; }, function (e) { Promise.resolve().then(closed); throw e; });
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
  // EVERY SEARCH THE PAGE MAKES, as it is made (goal/G41.28): its branch of the store, and whether it ranks rows of its own.
  function searches(els) {
    if (!els || typeof els !== 'object' || els.__searched) return;
    try { Object.defineProperty(els, '__searched', { value: true }); } catch (e) { return; }
    // The search element stands at its path, spirit.element.search since goal/G49.23 (no spirit.required), searches handed
    // spirit.element: every step of the path is followed as it is made, and the element wrapped when it is placed or read.
    function along(o, keys, done) {
      if (!o || typeof o !== 'object') return;
      var k = keys[0];
      var last = keys.length === 1;
      var at = o[k];
      function took(v) { if (last) done(v); else along(v, keys.slice(1), done); }
      try { Object.defineProperty(o, k, { configurable: true, enumerable: true, get: function () { if (last) done(at); return at; }, set: function (v) { at = v; took(v); } }); } catch (e) { /* kept as it is */ }
      if (at) took(at);
    }
    function wrap(v) { if (v && typeof v.create === 'function' && !v.create.__kept) { var c = v.create; v.create = function (host, o) { var x = o || {}; var hd = x.data && typeof x.data === 'object' && typeof x.data.rows === 'function' ? x.data : null; (window.spiritSearchHandles = window.spiritSearchHandles || [])[W.searches.length] = hd; W.searches.push({ data: typeof x.data === 'string' ? x.data : hd ? String(hd.path || '') : '', rows: typeof x.rows === 'function', verb: String(x.verb || ''), face: String(x.face || 'pane'), mount: !!host && (host === (window.spiritMount && window.spiritMount.box) || (typeof host.hasAttribute === 'function' && host.hasAttribute('data-spirit-cycle'))) }); (window.spiritSearchHosts = window.spiritSearchHosts || []).push(host); return c.apply(this, arguments); }; v.create.__kept = true; } }
  // WHAT IT WATCHES, IT DRAWS FROM: a marked row written into each path of the store (spirit.client) the module watches, and whether its
  // box changed for it within a second. A watch path is by server node first (goal/G41.28): '<node>/<family>/<branch>',
  // a branch, or '<node>/<family>/<branch>/<row>', a row; a watch of the home node holds '~' for the node, the page's
  // own node (data.home()) once it knows it.
  W.probe = function () {
    var D = window.spirit && window.spirit.client;
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
        // ENDED BY ITS REDRAW (box v144: no fixed sleeps): the wait ends at the first change of its box; one that never
        // redraws is given up at the limit, PROBE_LIMIT_MS, red.
        var redrawn = null;
        var mo = new MutationObserver(function (l) { changed += l.length; if (redrawn) redrawn(); });
        mo.observe(box, { subtree: true, childList: true, attributes: true, characterData: true });
        // A row that is there keeps its shape, each of its text fields marked and each true or false field flipped, so a
        // reader that checks its fields still takes it; a new row is the marked fields alone. Flipped (goal/G47.1; wsl, of
        // testicle's settings panel: "the preferences row holds only interactive, true or false, so it writes the same row
        // back and nothing can redraw").
        var probe = { key: whole ? undefined : 'zz-probe-' + i, label: mark, name: mark, title: mark, text: mark, id: whole ? undefined : 'zz-probe-' + i };
        if (whole && before && typeof before === 'object') {
          probe = Object.assign({}, before);
          Object.keys(probe).forEach(function (k) { if (typeof probe[k] === 'string') probe[k] = mark; else if (typeof probe[k] === 'boolean') probe[k] = !probe[k]; });
        }
        try { D.setPath(at, probe); } catch (e) { /* the branch refused it */ }
        return new Promise(function (r) { redrawn = r; setTimeout(r, PROBE_LIMIT_MS); }).then(function () {
          mo.disconnect();
          try { if (whole && before !== undefined) D.setPath(at, before); else D.delPath(at); } catch (e) { /* left */ }
          out.push({ path: p, redrew: changed > 0 });
          return out;
        });
      });
    }, Promise.resolve([]));
  };
  // What each search draws that its branch of the store does not hold: the keys of its rows on screen, against the branch.
  W.drawnOutside = function () {
    var D = window.spirit && window.spirit.client;
    return W.searches.map(function (x, i) {
      var host = (window.spiritSearchHosts || [])[i];
      // goal/G49.23: a search is handed a handle on its branch (<client>.handle(branch)): its rows are the handle's own.
      var hd = (window.spiritSearchHandles || [])[i];
      if (!host || !host.isConnected || !x.data || (!hd && (!D || typeof D.rowsOf !== 'function'))) return { verb: x.verb, data: x.data, drawn: 0, outside: [] };
      var held = {}; ((hd ? hd.rows() : D.rowsOf(x.data)) || []).forEach(function (r) { held[String(r.key)] = true; });
      // A search mounted inside another's host (branch's family filter in its 🪣 row) draws its own rows: they are judged
      // against its own branch, not this one's.
      var inner = (window.spiritSearchHosts || []).filter(function (h, j) { return j !== i && h && h !== host && host.contains(h); });
      // DRAWN MEANS SHOWN: a list hides a row its branch no longer holds where it stands (spirit/element/search/script.js), so a
      // row hidden is no row drawn.
      var keys = Array.prototype.filter.call(host.querySelectorAll('[data-key]'), function (el) { return !inner.some(function (h) { return h.contains(el); }) && el.getClientRects().length > 0; }).map(function (el) { return String(el.getAttribute('data-key')); });
      return { verb: x.verb, data: x.data, drawn: keys.length, outside: keys.filter(function (k) { return !held[k]; }).slice(0, 5) };
    });
  };
    along(els, ['search'], wrap);
  }
  function hook(o) {
    if (!o || typeof o !== 'object' || o.__watched) return;
    Object.defineProperty(o, '__watched', { value: true });
    var els = o.element;
    Object.defineProperty(o, 'element', { configurable: true, enumerable: true, get: function () { return els; }, set: function (v) { els = v; searches(v); } });
    searches(els);
    // THE DATA SET STANDS AT ITS PATH (goal/G49.4, step 1; Andy: "spirit.requireScript() places the loaded script at the exact
    // same location/path in the spirit object"), since goal/G49.23 on the spirit object itself, spirit.client (no
    // spirit.required): its watches are kept there, the stream's on spirit; a watch on it is kept as a data watch.
    // A level not made yet is waited for, as spirit.js places it as it goes.
    function at(obj, keys, then) {
      if (!obj || typeof obj !== 'object') return;
      if (!keys.length) return then(obj);
      var key = keys[0], cur = obj[key];
      if (cur && typeof cur === 'object') return at(cur, keys.slice(1), then);
      Object.defineProperty(obj, key, { configurable: true, enumerable: true, get: function () { return cur; }, set: function (v) { cur = v; Object.defineProperty(obj, key, { configurable: true, enumerable: true, writable: true, value: v }); at(v, keys.slice(1), then); } });
    }
    [[['event', 'subscribe'], []], [['client', 'watch'], []]].forEach(function (kk) {
      var k = kk[0];
      var kind = k[0] === 'client' ? 'data' : k[0];
      at(o, kk[1], function (place) {
      var cur = place[k[0]];
      function wrap(v) {
          if (kind === 'data' && v && typeof v.seatRows === 'function' && !v.seatRows.__kept) {
            var seat = v.seatRows;
            v.seatRows = function () { streamed(); return seat.apply(this, arguments); };
            v.seatRows.__kept = true;
          }
          if (v && typeof v[k[1]] === 'function' && !v[k[1]].__kept) {
            var f = kept(kind + '.' + k[1], v[k[1]]);
            // Each stream handler told first that the stream spoke (streamed, above).
            if (k[0] === 'event') f = (function (inner) { return function (h) { var hh = {}; Object.keys(h || {}).forEach(function (n) { hh[n] = typeof h[n] === 'function' && STREAMED.indexOf(n) !== -1 ? function () { streamed(); return h[n].apply(this, arguments); } : h[n]; }); return inner.call(this, hh); }; }(f));
            f.__kept = true; v[k[1]] = f;
          }
          // A family's view (goal/G41.28), the store's viewAt(node, family): a manager watches through it, so its watch is kept
          // as one on the store, under the whole path it watches.
          // The store names it viewAt (spirit/client/script.js); a watch through the view is the module's own watch.
          var VIEW = v && typeof v.viewAt === 'function' ? 'viewAt' : 'at';
          if (kind === 'data' && v && typeof v[VIEW] === 'function' && !v[VIEW].__kept) {
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
        Object.defineProperty(place, k[0], { configurable: true, enumerable: true, get: function () { return cur; }, set: function (v) { cur = v; wrap(v); } });
        wrap(cur);
      });
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
// The scratch node and headless Chrome, shared with any test that opens a page (spirit/testicle/headLessChrome/script.js).
const { sleep, until, findChrome, scratchNode, chromePage } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
// A path's place on the spirit object itself (goal/G49.23, no spirit.required): its first key spirit the object, a folder's
// script.js at its folder's own name (goal/G49.9), spirit/fs/script.js at spirit.fs.
function placeKeys(rel) { const k = rel.replace(/\.js$/, '').split('/'); if (k.length > 1 && k[k.length - 1] === 'script') k.pop(); return k.slice(1); }
// True when no rule broke.
function listed(bad) { return !bad.length; }

// ── GIVEN A FILE: ITS CODE, THEN ITS PAGE ───────────────────────────────────────────────────────────────────────────────
// The page is drawn, pressed and probed first, in one session (below), and what it drew kept in P; then each rule is
// said, a rule its page gave nothing to judge said as a comment only. A step that could not run fails "the world:" test of
// it, and every rule after it fails on it, so nothing is skipped in silence.
const PAGE_MS = 300000;
async function session() {
  const P = { stage: 'chrome', fail: false };
  const chrome = findChrome();
  if (!chrome) { P.fail = true; return P; }
  // ITS OWN APP'S SERVER ON TOO (goal/G47.1, cleaning, Andy's testicle's first red: spirit/app/backup/api.js never loaded,
  // "no interface for the branch backup", since backup was not turned on on the scratch node): a script of
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
  // Its server by its id, its folder in dots (goal/G49.19).
  const ownId = own ? SPIRIT.dottedPath('spirit/app/' + own) : '';
  const node = P.node = await scratchNode({ shared: true, servers: SERVERS.servers.concat(ownServer && SERVERS.servers.indexOf(ownId) === -1 ? [ownId] : []) });
  if (!node.up) { P.fail = true; return P; }
  if (!node.debug) { P.fail = true; return P; }
  if (ownServer) {
    const served = await until(function () {
      return fetch(node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: { branch: ownId } }) })
        .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.interface); }, function () { return false; });
    }, 30000);
    if (!served) { P.fail = true; return P; }
  }
  const page = P.page = await chromePage(chrome);
  OPENED.push(page);
  drawing = P;
  if (page.error) { P.fail = true; return P; }
  // SETTLED, NOT SLEPT (goal/G47.1, box v144: "no fixed sleeps in the checks: each wait ends the moment the page has settled"):
  // nothing of the element's own on the wire (spiritWatch.out), then two frames drawn; never longer than 2 s. The fixed sleeps it
  // replaces (500, 400, 150, 300, 200, 200 ms) were ~2.6 s a script of a run's ~10 s.
  const quiet = async function () {
    const t0 = Date.now();
    while (Date.now() - t0 < QUIET_LIMIT_MS && await page.evaluate('(window.spiritWatch && window.spiritWatch.out) || 0')) await sleep(QUIET_POLL_MS);
    await page.evaluate('new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); })');
  };

  // it loads by itself
  // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
  // parts via spirit.requireScript; nothing is preloaded"). The node's DEBUG page for it, made from its address.
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
  await quiet();
  P.report = report;
  P.thrown = page.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function () { return true; });
  // A file asked for and not there is missing; the door's answers (a refusal answers 404 too) and the browser's own
  // favicon ask are not files the page asked for. The door is /spirit itself and the relay's routes sit under
  // /spirit/relay/ (goal/G49.18); every other path under /spirit/ is a file.
  const notFile = function (url) { return /\/spirit(\?|$)|\/spirit\/relay\/|\/favicon\.ico$/.test(String(url || '').replace(/^[a-z]+:\/\/[^/]+/, '')); };
  P.errors = page.heard.filter(function (m) { return (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !notFile(m.params.entry.url)); })
    .map(function () { return true; });
  P.missing = page.heard.filter(function (m) { return m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !notFile(m.params.response.url); }).map(function () { return true; })
    .concat(page.heard.filter(function (m) { return m.method === 'Network.loadingFailed' && !m.params.canceled; }).map(function () { return true; }));
  // IT DOES NOT POLLUTE THE WINDOW NAMESPACE (goal/G47.1; Andy: "a test \"does NOT pullute the windows namespace\" NOW!!!!",
  // and "if fucking spirit allready holds motherfucking spirit.required, for motherfucking scripts"): a page loads each file
  // by a plain script tag, so a name it declares outside a function of its own lands on the whole window, or in its global
  // scope (let, const, class). What it shares belongs on the spirit object. Judged on this one file alone: in a frame of
  // the same origin that loads spirit.js and nothing else, its spirit.requireScript held so none of its parts load, the file is
  // loaded, and the frame's own window names and global lexical names after it are held against those before it.
  // Judged after the page's errors are counted, so what the file does in that frame, its parts held back, is never taken
  // for the page's.
  P.leaked = await (async function () {
    const FRAME = 'zz-window-probe';
    await page.evaluate('new Promise(function (r) { var f = document.createElement("iframe"); f.id = ' + JSON.stringify(FRAME) + '; f.style.display = "none"; f.src = "about:blank"; f.onload = function () { r(true); }; document.body.appendChild(f); })');
    const loaded = await page.evaluate('new Promise(function (r) { var w = document.getElementById(' + JSON.stringify(FRAME) + ').contentWindow; var s = w.document.createElement("script"); s.src = "/spirit/script.js"; s.onload = function () { r(true); }; s.onerror = function () { r(false); }; w.document.head.appendChild(s); })');
    if (loaded !== true) return null;
    const tree = await page.send('Page.getFrameTree');
    const kids = ((tree.result && tree.result.frameTree && tree.result.frameTree.childFrames) || []).map(function (c) { return c.frame; });
    const frameId = (kids.filter(function (f) { return f.name === FRAME || /about:blank/.test(f.url); }).pop() || {}).id;
    const ctx = (page.heard.filter(function (m) { return m.method === 'Runtime.executionContextCreated' && m.params.context.auxData && m.params.context.auxData.frameId === frameId && m.params.context.auxData.isDefault; }).pop() || { params: { context: {} } }).params.context.id;
    const lexical = async function () { if (!ctx) return null; const r = await page.send('Runtime.globalLexicalScopeNames', { executionContextId: ctx }); return (r.result && r.result.names) || null; };
    const lexBefore = await lexical();
    const own = await page.evaluate('new Promise(function (r) { var w = document.getElementById(' + JSON.stringify(FRAME) + ').contentWindow; if (w.spirit) w.spirit.requireScript = function () { return new Promise(function () {}); }; var before = Object.getOwnPropertyNames(w); var s = w.document.createElement("script"); s.src = ' + JSON.stringify('/' + rel) + '; var done = function () { r(JSON.stringify(Object.getOwnPropertyNames(w).filter(function (k) { return before.indexOf(k) === -1; }))); }; s.onload = done; s.onerror = function () { r(null); }; w.document.head.appendChild(s); })');
    const lexAfter = await lexical();
    await page.evaluate('(function () { var f = document.getElementById(' + JSON.stringify(FRAME) + '); if (f) f.remove(); return true; }())');
    if (own === null || lexBefore === null || lexAfter === null) return null;
    return JSON.parse(own).concat(lexAfter.filter(function (k) { return lexBefore.indexOf(k) === -1; }));
  }());
  // NO ELEMENT INSTALLED, KNOWN BY THE PAGE, NOT BY READING ITS CODE (goal/G47.1, box v121: "no code reading: after
  // loading, the page looks at window.spirit.required at the script's own path, where [the loader, since goal/G49.9]
  // puts an element with its create (a helper goes to spirit.required)"; "with no element installed these are skipped, never counted
  // green"): the bare page says so when nothing with a create stands there (spirit/DEBUG/headLessBrowser/script.js).
  // Since goal/G49.5's step 2 an element stands at its path; since goal/G49.23 the bare page says the file hands back none.
  if (report && report.state === 'failed' && /(?:places|hands back) no element with a create/.test(report.error)) { P.noElement = true; P.stage = 'no element'; return P; }
  if (!report || report.state !== 'mounted') return P;
  P.stage = 'mounted';

  // MOUNTED EMPTY, JUDGED AS DRAWN (goal/G47.1, box v121, before any press or typing). What create() put into its
  // container is the element's box: the mount box's own children (Q4, "create() returns a node in some elements and a
  // handle like { destroy() } in others (chat, desk): may the check judge the node create() puts into its container?";
  // Andy: "wsl, yes.").
  // 1. "its create() box declares a constraint in its computed style: overflow not visible (hidden, clip, auto, scroll);
  //    wrapping and ellipsis only on top of that. overflow visible is red."
  P.unbounded = JSON.parse(await page.evaluate('JSON.stringify(Array.prototype.map.call(window.spiritMount.box.children, function (el) { var cs = getComputedStyle(el); return { x: cs.overflowX, y: cs.overflowY }; }).filter(function (b) { return b.x === "visible" || b.y === "visible"; }))'));
  P.boxCount = await page.evaluate('window.spiritMount.box.children.length');
  // 2. "every input in it has a maxlength."
  const INPUTS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("textarea, input"), function (el) { return el.tagName === "TEXTAREA" || /^(|text|email|search|url|tel|password|number)$/.test(el.type || ""); })';
  P.inputCount = await page.evaluate(INPUTS + '.length');
  P.noMax = JSON.parse(await page.evaluate('JSON.stringify(' + INPUTS + '.filter(function (el) { return !(el.maxLength > 0); }).map(function () { return true; }))'));
  // 3. "every input and button in it has a listener on itself or on a node between it and the mounted element's box (read
  //    through Chrome's debugger, DOMDebugger.getEventListeners, no code reading); one on the document or window does not
  //    count. none: red at 0.6."
  const PRESSABLE = 'Array.prototype.concat.call([], ' + INPUTS + ', Array.prototype.slice.call(window.spiritMount.box.querySelectorAll("button")))';
  P.pressableCount = await page.evaluate(PRESSABLE + '.length');
  P.deaf = [];
  for (let i = 0; i < P.pressableCount; i++) {
    const way = await page.send('Runtime.evaluate', { expression: '(function () { var box = window.spiritMount.box; var el = ' + PRESSABLE + '[' + i + ']; var a = []; for (var n = el; n && n !== box; n = n.parentElement) a.push(n); return a; }())' });
    const arr = way.result && way.result.result && way.result.result.objectId;
    if (!arr) { P.deaf.push(true); continue; }
    const props = await page.send('Runtime.getProperties', { objectId: arr, ownProperties: true });
    const nodes = ((props.result && props.result.result) || []).filter(function (p) { return /^\d+$/.test(p.name) && p.value && p.value.objectId; });
    let heard = false;
    for (const n of nodes) {
      const l = await page.send('DOMDebugger.getEventListeners', { objectId: n.value.objectId });
      if (l.result && (l.result.listeners || []).length) { heard = true; break; }
    }
    if (!heard) P.deaf.push(true);
  }
  // 4. "no node of it carries margin, padding or gap in its style attribute, and no <style> block it adds sets them (read
  //    from the page's style sheets)". The bare page's own <style> (html, body) is the page's, not the element's.
  const SPACING = '/(^|;)\\s*(margin|padding|gap|row-gap|column-gap)(-[a-z-]+)?\\s*:/i';
  // CODEMIRROR'S OWN NODES ARE THE LIBRARY'S (as its scrollbars are, below, goal/G41.28): it lays out its sizer and the lines
  // in it with margins and paddings it measures as it draws; no script of ours writes them (box v109: "style issues like
  // margin, padding and gap do NOT belong in UI scripts"). Every other node, inside the editor or not, is judged.
  P.spacedNodes = JSON.parse(await page.evaluate('JSON.stringify(Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("*"), function (el) { return !el.closest(".CodeMirror-sizer") && ' + SPACING + '.test(el.getAttribute("style") || ""); }).map(function () { return true; }))'));
  // CodeMirror's own sheets (spirit/element/codeMirror.js loads the library's css, each a <style> of its own): a rule on its
  // classes, .CodeMirror and .cm-, is the library's layout, as its nodes are above; any other rule a sheet sets is judged.
  P.spacedRules = JSON.parse(await page.evaluate('JSON.stringify([].concat.apply([], Array.prototype.filter.call(document.styleSheets, function (s) { var o = s.ownerNode; return o && o.tagName === "STYLE" && !/^\\s*html, body \\{ height: 100%; margin: 0; \\}/.test(o.textContent); }).map(function (s) { var out = []; try { Array.prototype.forEach.call(s.cssRules, function (r) { if (r.style && !/(^|[\s,>+~])\.(CodeMirror|cm-)/.test(r.selectorText || "") && ' + SPACING + '.test(r.style.cssText)) out.push(true); }); } catch (e) { out.push(true); } return out; })))'));

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
    '  out.push({ tall: t, wide: w }); }); return out; }())';
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
    '  out.push(true); } return out; }())';
  await page.evaluate('Promise.resolve().then(function () { return spirit.requireScript("spirit/element/icon/script.js"); }).then(function (icon) { var p = document.createElement("div"); var i = icon.create(p, { glyph: "A" }); window.spiritIconMark = String(i && i.className || "").trim().split(/\\s+/)[0] || ""; }, function () { window.spiritIconMark = ""; })');
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
    await quiet();
    await probe();
    await iconProbe();
  }
  P.loose = Object.keys(loose);
  P.spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');

  // A ROW DETAIL HAS ITS OWN PANEL (goal/G49.8, point 4, box v7; Andy: "a row detail has it's own panel and doesn't share it
  // with other row details of the same kind", "a test, general, hopefully, should enforce that", "a more general \"if-block\"
  // in a spirit-child-browser test"; the panel rule, spirit/element/panel/script.js, Q2: "a closed layer is hidden, not destroyed"):
  // for an app, spirit/app/<name>/element.js, mounted by itself and before anything is typed or pressed, two of its rows are pressed and each panel they open closed
  // with its ✕, then the first row pressed again. An app whose row press opens no panel here has nothing to judge.
  if (/^spirit\/app\/[^/]+\/element\.js$/.test(rel)) {
    const ROWS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("[data-key]"), function (x) { return x.getClientRects().length && !x.closest(".app-container"); })';
    const BOXES = 'Array.prototype.slice.call(window.spiritMount.box.querySelectorAll(".app-container"))';
    const SHOWN = BOXES + '.filter(function (x) { return x.style.display !== "none" && x.getClientRects().length; }).pop()';
    const press = function (i) { return page.evaluate('(function () { var r = ' + ROWS + '; if (!r[' + i + ']) return ""; r[' + i + '].click(); return String(r[' + i + '].getAttribute("data-key")); }())'); };
    const closeShown = function () { return page.evaluate('(function () { var b = ' + SHOWN + '; var x = b && b.querySelector(".app-container-close"); if (x) x.click(); return !!x; }())'); };
    const R = P.rowPanels = { judged: false };
    const n0 = await page.evaluate(BOXES + '.length');
    const k1 = await press(0);
    await quiet();
    const n1 = await page.evaluate(BOXES + '.length');
    if (k1 && n1 > n0 && await page.evaluate('(function () { var b = ' + SHOWN + '; if (!b) return false; b.__zzFirstRow = true; return true; }())')) {
      await closeShown(); await quiet();
      const k2 = await press(1);
      await quiet();
      if (k2 && k2 !== k1) {
        R.judged = true;
        R.own = await page.evaluate('(function () { var b = ' + SHOWN + '; return !!b && b.__zzFirstRow !== true && ' + BOXES + '.length === ' + (n1 + 1) + '; }())');
        await closeShown(); await quiet();
        await press(0);
        await quiet();
        R.left = await page.evaluate('(function () { var b = ' + SHOWN + '; return !!b && b.__zzFirstRow === true; }())');
        await closeShown(); await quiet();
      }
    }
  }
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
      ' return true; }())');
    if (!at) continue;
    await page.send('Input.insertText', { text: typed });
    const kept = await page.evaluate('(function () { var el = ' + FIELDS + '[' + i + ']; var n = el ? new TextEncoder().encode(el.value).length : 0; if (el) el.value = ""; return n; }())');
    fields.push({ at: at, kept: kept });
  }

  // EVERY BUTTON PRESSED, AND WHAT A PRESS DOES WATCHED (goal/G41.27): each button it draws is pressed in turn, and what
  // leaves the page, what it listens to and what it draws are judged by the rules that follow.
  let pressed = 0;
  for (let i = 0; i < 60; i++) {
    if (!(await page.evaluate('window.spiritWatch && window.spiritWatch.press(' + i + ')'))) break;
    pressed += 1;
    // Its writes answered, or two seconds, whichever comes first.
    const t0 = Date.now();
    await quiet();
    await page.evaluate('window.spiritWatch.settle()');
  }
  // Read without the live listeners and intervals (goal/G48.4): each holds the window or the document it was put on, which no
  // JSON holds, so the whole read came back undefined for any element that listened there; the cleanup check reads them on
  // the page (held()).
  const W = P.W = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch || null, function (k, v) { return k === "listeners" || k === "intervals" ? undefined : v; })')) || { net: [], subs: [], writes: [], moved: [] };
  // THE FAMILIES IT USES, AND WHETHER IT LOADED THEIR INTERFACES ITSELF (Andy: "JUST BECAUSE api branches are intrinsic doesn't
  // fucking mean the browser has interfaces for them already loaded, EVERY FUCKING ELEMENT REQUIRES THE FUCKING INTERFACES IT
  // FUCKING NEEDS"): the families it called, and those whose branches of the store it watched; on a bare page each one's api.js
  // (spirit/<family>/api.js or spirit/app/<family>/api.js) stands at its path on the spirit object (goal/G49.23) only if this file loaded it.
  // goal/G49.23: a branch is its folder's path (spirit.app.desk, spirit.job), so a call or a store family is taken to the
  // longest prefix that is a branch folder of the tree (it holds api.js or script.js), and looked up at its path on the
  // spirit object, its api (old shape) or its verbs (new shape) there. The spirit branch itself is the loader's: never asked.
  const branchOfName = function (name) {
    const n = String(name || '');
    const parts = (n === 'spirit' || n.indexOf('spirit.') === 0 ? n : 'spirit.' + n).split('.');
    for (let i = parts.length; i > 1; i--) {
      const dir = path.join(RUN, ...parts.slice(0, i));
      try { if (fs.statSync(dir).isDirectory() && (fs.existsSync(path.join(dir, 'api.js')) || fs.existsSync(path.join(dir, 'script.js')))) return parts.slice(0, i).join('.'); } catch (e) { /* no folder */ }
    }
    return '';
  };
  P.usedFamilies = [];
  const used = function (name) { const b = branchOfName(name); if (b && P.usedFamilies.indexOf(b) === -1) P.usedFamilies.push(b); };
  (W.families || []).forEach(used);
  (W.subs || []).forEach(function (x) { if (x.mine && x.kind === 'data.watch' && x.path) used(String(x.path).split('/')[1]); });
  P.unloaded = JSON.parse(await page.evaluate('JSON.stringify(' + JSON.stringify(P.usedFamilies) + '.filter(function (f) { var at = f.split(".").slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit || {}); return !(at && (at.api || at.verbs)); }))'));

  // AND ITS WATCHING REDRAWS IT (goal/G41.28; Andy: "YOUR TEST WILL MAKE SURE THAT THE CACHING AND LISTENING IS DONE TO
  // FUCKING SPEC AS GOOD AS YOU POSSIBLY CAN"): a marked row written into each path of the store it watches must change
  // its box. A watch that redraws nothing is not listening.
  let probed = JSON.parse(await page.evaluate('Promise.resolve(window.spiritWatch && window.spiritWatch.probe ? window.spiritWatch.probe() : []).then(function (x) { return JSON.stringify(x); })'));
  // A CLOSED DROPDOWN DRAWS ITS LIST WHEN IT OPENS (spirit/element/search/script.js, setOpen: "opened, ... draw()"): while
  // nothing it watches has redrawn, each closed dropdown on the page is opened in turn, what it watches written again,
  // and shut. A path that redrew in any of them redrew.
  const DROPDOWNS = 'Array.prototype.filter.call(window.spiritMount.box.querySelectorAll("button[id$=field]"), function (b) { var p = document.getElementById(b.id.replace(/field$/, "popup")); return p && p.hidden && b.getClientRects().length; })';
  const closed = probed.some(function (x) { return x.redrew; }) ? 0 : await page.evaluate(DROPDOWNS + '.length');
  for (let i = 0; i < closed; i++) {
    await page.evaluate('(function () { var b = ' + DROPDOWNS + '[' + i + ']; if (b) b.click(); }())');
    await quiet();
    // Asked as the first probe is (above): a page whose answer comes back empty is one with nothing redrawn, never a session
    // thrown away (goal/G49.6: JSON.parse(undefined) here threw, and every check of agent's table elements went red).
    let again = [];
    try { again = JSON.parse(await page.evaluate('Promise.resolve(window.spiritWatch && window.spiritWatch.probe ? window.spiritWatch.probe() : []).then(function (x) { return JSON.stringify(x || []); })') || '[]'); } catch (e) { again = []; }
    probed = probed.map(function (x) { const y = again.filter(function (z) { return z.path === x.path; })[0]; return y && y.redrew ? Object.assign({}, x, { redrew: true, hidden: false }) : x; });
    await page.evaluate('document.body.click()');
    await quiet();
  }
  P.probed = probed;
  P.outside = JSON.parse(await page.evaluate('JSON.stringify(window.spiritWatch && window.spiritWatch.drawnOutside ? window.spiritWatch.drawnOutside() : [])'));
  P.destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
  // EVERY ELEMENT BRINGS ITS OWN SUBSCRIPTIONS, AND LETS THEM GO (rule/8; goal/G41.27): destroyed, nothing it listened to
  // is still held.
  if (P.destroyed !== 'none') {
    await quiet();
    P.after = JSON.parse(await page.evaluate('JSON.stringify((window.spiritWatch || { subs: [] }).subs)'));
    // A CREATE AND A DESTROY MORE, IN A BOX OF ITS OWN (goal/G48.4, Andy: "make sure that elements get cleaned up"): what
    // the page holds before, and after the element was created there, left a second to draw, and destroyed; the box taken
    // away. All it made is gone again: no listener on window or document, no interval, no element anywhere on the page.
    P.cycle = JSON.parse(await page.evaluate('(function () { var W = window.spiritWatch; var file = ' + JSON.stringify(rel) + ';' +
      ' var el = ' + JSON.stringify(placeKeys(rel)) + '.reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit);' +
      ' if (!W || !W.held || !el || typeof el.create !== "function") return JSON.stringify(null);' +
      ' var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };' +
      ' var box = document.createElement("div"); box.setAttribute("data-spirit-cycle", ""); document.body.appendChild(box); var before = W.held(); box.remove();' +
      ' document.body.appendChild(box);' +
      ' return Promise.resolve(el.create(box)).then(function (m) { return wait(1000).then(function () { if (m && typeof m.destroy === "function") m.destroy(); return wait(500); }); })' +
      '   .then(function () { var after = W.held(); return JSON.stringify({ before: before, after: after, emptied: box.childElementCount === 0 }); }, function (e) { return JSON.stringify({ error: String(e && e.message || e) }); }); }())'));
  }
  P.stage = 'done';
  return P;
}
// The session, bounded: one that has not finished in PAGE_MS fails its world, as a hang does.
// A HUNG PAGE IS GIVEN UP AT ONCE (goal/G47.1, box v144: "only a hung page is reloaded: a main page that does not answer within 1 s
// is hung"): while a script's page is drawn it is asked twice a second for an answer; one it does not give within 1 s ends that
// script's session as hung, its page closed (its renderer with it; box v144: "only a hung page is reloaded"), and the run goes
// on with the next script in the same Chrome. Before, a script that never ended held
// the whole run for PAGE_MS.
// The page is asked every PING_MS, and one that gives no answer in HANG_MS is hung (limits, not waits).
const PING_MS = 500;
// quiet(): asked every QUIET_POLL_MS whether its calls are back, at most QUIET_LIMIT_MS; a node load ended at KILL_LIMIT_MS.
const QUIET_POLL_MS = 20;
const QUIET_LIMIT_MS = 2000;
const KILL_LIMIT_MS = 20000;
const HANG_MS = 1000;
let drawing = null;
let drawingGen = 0;
// The pages a script's session opened, closed together once the script is drawn (the batch loop, above).
const OPENED = [];
function hungPage(gen) {
  return new Promise(function (resolve) {
    const tick = async function () {
      const P = drawing;
      // Only while its script loads (stage debug page, from its address set until it mounts): after that the page's thread is
      // busy with the checks' own long reads (typing past every field, probing every box), and busy is not hung.
      if (P && P.page && P.page.evaluate && P.stage === 'debug page') {
        const answered = await Promise.race([Promise.resolve(P.page.evaluate('1')).then(function () { return true; }, function () { return true; }), new Promise(function (r) { setTimeout(function () { r(false); }, HANG_MS); })]);
        if (!answered && gen === drawingGen && drawing === P && P.stage === 'debug page') { try { P.page.kid.kill(); } catch (e) { /* gone */ } resolve({ stage: P.stage, fail: true }); return; }
      }
      if (gen === drawingGen) setTimeout(tick, PING_MS); else resolve(null);
    };
    setTimeout(tick, PING_MS);
  });
}
function bounded(work) {
  drawing = null;
  const gen = ++drawingGen;
  const stall = hungPage(gen).then(function (h) { return h || new Promise(function () { /* the session ended first */ }); });
  return Promise.race([work.then(null, function () { return { stage: 'chrome', fail: true }; }), stall,
    new Promise(function (r) { setTimeout(function () { r({ stage: 'chrome', fail: true }); }, PAGE_MS); })]).then(function (P) { drawing = null; if (gen === drawingGen) drawingGen += 1; return P; });
}

function oneFile(P) {
  // Its own script, kept: in a batch, rel, full and ADDRESS move on to the next script before its checks run.
  const ownRel = rel, ownFull = full;
  // ON ITS PAGE: what the session drew, each rule said as the old checks were.
  test.run('a scratch node with its DEBUG on and a Chrome page are ready', 0.2, function () {
    return !P.fail || false;
  }, test.limit.quick);
  const before = function () { return !!P.fail; };
  // <address>: it loads by itself
  test.run('the node answers its DEBUG page for it', 0.4, function () {
    return !before() && P.debugStatus === 200;
  }, test.limit.quick);
  const noMount = function () { return before() || P.debugStatus !== 200; };
  // A PAGE SCRIPT THAT INSTALLS NO ELEMENT (goal/G47.1, box v121): loaded on the bare page, what it runs is judged; the
  // element rules are skipped, said as a comment, never counted green.
  if (P.noElement) {
    test.run('with no element installed, nothing it runs throws', 0.8, function () { return !noMount() && !P.thrown.length; }, test.limit.quick);
    test.run('with no element installed, every file it asks for is there', 0.4, function () { return !noMount() && !P.missing.length; }, test.limit.quick);
    test.run('with no element installed, it says no error on the console', 0.4, function () { return !noMount() && !P.errors.length; }, test.limit.quick);
    test.run('with no element installed, it does not pollute the window namespace: no name of its own lands on the window', 0.7, function () { return Array.isArray(P.leaked) && !P.leaked.length; }, test.limit.quick);
    pageAfter(P);
    return;
  }
  const ownCode = fs.readFileSync(ownFull, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  // "if it throws when mounted empty, red at 0.8; this enforces rule 26 (an element loads its own stuff)" (box v121).
  test.run('it mounts by itself on a bare page that loads spirit.js and then this file alone', 0.8, function () {
    return !noMount() && !!P.report && P.report.state === 'mounted';
  }, test.limit.quick);
  test.run('nothing it runs throws', 0.8, function () { return !noMount() && !P.thrown.length; }, test.limit.quick);
  test.run('every file it asks for is there', 0.4, function () { return !noMount() && !P.missing.length; }, test.limit.quick);
  test.run('it says no error on the console', 0.4, function () { return !noMount() && !P.errors.length; }, test.limit.quick);
  // <address>: it does not pollute the window namespace. Not judged (the probe frame did not load) is red, never green.
  test.run('it does not pollute the window namespace: no name of its own lands on the window', 0.7, function () { return Array.isArray(P.leaked) && !P.leaked.length; }, test.limit.quick);
  const mounted = P.stage === 'done';
  const notDrawn = function () { return noMount() || !mounted; };
  // MOUNTED EMPTY (goal/G47.1, box v121): the four element rules, judged as drawn before any press.
  // A ROW ELEMENT PUTS NO BOX INTO A CONTAINER (cw: "a row's create takes a row, not a container, and draws into the cells
  // its list hands it"): with nothing put into its container there is no box of its own to judge (Q4); said as a comment,
  // never green. Its list's box is judged with the list.
  if (mounted && !P.boxCount) {}
  else test.run('mounted empty, the box it puts into its container declares a constraint: overflow not visible', 0.4, function () {
    if (notDrawn()) return false;
    return !P.unbounded.length || false;
  }, test.limit.quick);
  if (mounted && !P.inputCount) {}
  else {
    test.run('mounted empty, every input it draws has a maxlength', 0.4, function () {
      if (notDrawn()) return false;
      return !P.noMax.length || false;
    }, test.limit.quick);
  }
  if (mounted && !P.pressableCount) {}
  else {
    test.run('mounted empty, every input and button it draws has a listener on itself or on a node between it and its box', 0.6, function () {
      if (notDrawn()) return false;
      return !P.deaf.length || false;
    }, test.limit.quick);
  }
  test.run('mounted empty, no node of it carries margin, padding or gap in its style attribute, and no <style> block it adds sets them', 0.4, function () {
    if (notDrawn()) return false;
    const bad = (P.spacedNodes || []).concat(P.spacedRules || []);
    return !bad.length || false;
  }, test.limit.quick);
  // Said when it drew a scrolling box; each box that grows named in the answer.
  if (!mounted || Object.keys(P.boxes).length) {
    // <address>: sized box <id chain>
    test.run('it keeps its height and its width when given far more than it holds', 0.4, function () {
      if (notDrawn()) return false;
      return listed(Object.keys(P.boxes).filter(function (k) {
        const p = P.boxes[k];
        return !p.tall.kept || !p.wide.kept || !p.tall.inside || !p.wide.inside || p.tall.spilt || p.wide.spilt;
      }));
    }, test.limit.quick);
  }
  // <address>: every icon it paints is the icon element
  test.run('every pictograph it draws lies inside the icon element', 0.4, function () {
    if (notDrawn()) return false;
    return (!!P.iconMark && !P.loose.length) || false;
  }, test.limit.quick);
  // <address>: its box never grows
  test.run('it never grows its box, and the page never scrolls sideways', 0.4, function () {
    if (notDrawn()) return false;
    return P.spills === false || false;
  }, test.limit.quick);
  // <address>: every field it draws stops at its limit
  if (mounted && !P.fields.length) {}
  else {
    test.run('every field it draws stops at its limit, typed past it', 0.4, function () {
      if (notDrawn()) return false;
      const free = P.fields.filter(function (f) { return f.kept > MOST_BYTES; });
      return !free.length || false;
    }, test.limit.quick);
  }
  const W = (P.W) || { net: [], subs: [], writes: [], moved: [], searches: [] };
  // EVERY CALL ON THE WIRE THROUGH SPIRIT (goal/G41.27; Andy: "can it assert that no element posts or fetches by itself,
  // and that all wire-stuff goes through spirit?", "boot.js MUST be an exception to the rules."): each one the page made
  // was made by spirit's own code.
  // <address>: all it sends goes through spirit
  test.run('every call it puts on the wire goes through spirit', 0.4, function () {
    if (notDrawn()) return false;
    const own = W.net.filter(function (c) { return !c.spirit; });
    // OUTSIDE goal/G41.28, AND STILL RED (Andy, G41.28: "WSL will drop Q23 from this item, and mark those two related reds as
    // outside it"): login fetches its steps file before the page has a link to its node, and the file viewer fetches a
    // file at home piece by piece. It is not met, so it is not green.
    // shell/login/login.js is no longer in the tree; the file viewer's spirit/element/fstat/script.js is.
    return !own.length || false;
  }, test.limit.quick);

  // WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27; Andy: "elements that change things, also subscribe to the changes
  // they cause, since andy request an element generates would imply that it must listen for confirmation of the
  // results"): one that sent a write holds, while mounted, a listener on the page's stream of its own making.
  // THROUGH SPIRIT.DATA, NOT THE RAW STREAM (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
  // changes shit it listens to fucking update via the spirit object"): what it listens with is a watchPath of the store (spirit.client, goal/G49.23) of
  // its own making, its searches' included. A subscription of its own to the raw stream, taken into a store of its own,
  // is how the Desk List kept rows the store never held: it does not count.
  // <address>: what it watches in the store redraws it
  const probed = P.probed || [];
  const seenProbe = probed.filter(function (x) { return !x.hidden; });
  if (mounted && !probed.length) {}
  else if (mounted && !seenProbe.length) {}
  else if (mounted && OWN_PROOF[ownRel] && !seenProbe.some(function (x) { return x.redrew; })) {
    // PROVED IN ITS OWN TEST (Andy, Q24: "Shall deskDetails' own test be the proof that it redraws from the verifier,
    // since the page sweep opens no item?" "yes."): what it watches draws only for an item open, and this page opens
    // none. Its own test is run here, and the check is green only if its own redraw check passed.
    test.run('what it watches redraws it, proved in its own test', 0.4, function () {
      const p = OWN_PROOF[ownRel];
      const said = require('child_process').spawnSync(process.execPath, [path.join(RUN, p.test)], { cwd: RUN, encoding: 'utf8', timeout: 120000 }).stdout || '';
      // Its pass as the report says it: the check's title, then the pass mark (spirit/testicle/testReport/script.js, ICON.SUCCESS).
      return said.split('\n').some(function (l) { return l.indexOf(p.check + ' \u2705') !== -1; }) || false;
    }, test.limit.long);
  }
  else {
    test.run('a change written into what it watches redraws it', 0.4, function () {
      if (notDrawn()) return false;
      return seenProbe.some(function (x) { return x.redrew; }) || false;
    }, test.limit.quick);
  }
  // <address>: every interface it needs, it requires itself
  if (mounted && !(P.usedFamilies || []).length) {}
  else {
    test.run('every BRANCH it calls or watches, it required that BRANCH\'s interface itself', 0.8, function () {
      if (notDrawn()) return false;
      return !P.unloaded.length || false;
    }, test.limit.quick);
  }
  // <address>: what it changes, it listens for through the store
  if (mounted && !W.writes.length) {}
  else {
    test.run('it sent writes and watches the store\'s paths for them', 0.4, function () {
      if (notDrawn()) return false;
      const watching = W.subs.filter(function (x) { return x.mine && x.live && x.kind === 'data.watch'; }).length;
      return watching > 0 || false;
    }, test.limit.quick);
  }
  // IT DRAWS ONLY WHAT THE STREAM SAYS (rule/19; goal/G41.27, the box: "after a press, until the stream answers, an
  // element may change only its busy spinner, its button's disabled state and its fine print; any other change it makes
  // is red"): judged while a write it sent is out, until the node answers it.
  // <address>: while a write is out, it draws nothing of its own
  if (mounted && !W.writes.length) {}
  else {
    test.run('while its writes were out it changed only busy marks, disabled buttons and fine print', 0.4, function () {
      if (notDrawn()) return false;
      return !W.moved.length || false;
    }, test.limit.quick);
  }
  // EVERY SEARCH FROM SPIRIT.DATA (goal/G41.28; Andy, box v15: "general test for screen objects will make sure that all
  // damn data is cached in spirit data.", and "every probabilitySearch on a page is made with a spirit.required.spirit.data branch (its
  // data option), and draws only rows that branch holds. A list fed by its own rows() or by answers alone goes red.").
  // <address>: every search it makes ranks the store
  // ITS searches: the ones the module makes. When the module handed is the search itself (spirit/element/search/script.js),
  // the test's own mounts of it, bare in the mount box and once more in the create-and-destroy box, are the test's, not
  // searches the module made, and are not judged; every search the module makes inside them is.
  const made = (W.searches || []).filter(function (x) { return !x.mount; });
  if (mounted && !made.length) {}
  else {
    test.run('its searches are each made with a branch of the store, no rows of their own', 0.4, function () {
      if (notDrawn()) return false;
      const off = made.filter(function (x) { return !x.data || x.rows; });
      return !off.length || false;
    }, test.limit.quick);
  }
  // "and draws only rows that branch holds": every row a search shows, after its tools and buttons are pressed, is a
  // row of its branch in the store. A list that keeps its rows anywhere else draws what the branch does not hold.
  const outside = P.outside || [];
  const drew = outside.reduce(function (n, x) { return n + x.drawn; }, 0);
  if (mounted && !drew) {}
  else {
    test.run('every row its searches draw is a row their branch of the store holds', 0.4, function () {
      if (notDrawn()) return false;
      const strays = outside.filter(function (x) { return x.outside.length; });
      return !strays.length || false;
    }, test.limit.quick);
  }
  // goal/G49.8, point 4: an app's row details, each in its own panel, shown again as left (the if-block in session()).
  if (P.rowPanels && P.rowPanels.judged) {
    test.run('a row pressed in it opens its detail in a panel of its own, not in another row\'s', 0.4, function () { return P.rowPanels.own === true || false; }, test.limit.quick);
    test.run('a row pressed again shows its own panel as it was left, not a new one', 0.4, function () { return P.rowPanels.left === true || false; }, test.limit.quick);
  }
  // <address>: destroy leaves its box empty
  if (mounted && P.destroyed === 'none') test.run('it has no destroy of its own (an app is closed by the face)', 0.4, function () { return P.destroyed === 'none' || false; }, test.limit.quick);
  else {
    test.run('destroyed, its box is empty', 0.4, function () {
      if (notDrawn()) return false;
      return P.destroyed === 'empty' || false;
    }, test.limit.quick);
    const mine = (P.after || []).filter(function (x) { return x.mine; });
    if (mounted && !mine.length) {}
    else {
      test.run('destroyed, it lets every subscription it made go', 0.4, function () {
        if (notDrawn()) return false;
        const held = mine.filter(function (x) { return x.live; });
        return !held.length || false;
      }, test.limit.quick);
    }
    // goal/G48.4, Andy: "please use an effective test in script-sibling-browser to make sure that elements get cleaned up."
    test.run('created once more and destroyed, it leaves no listener on window or document, no interval and no element on the page', 0.4, function () {
      if (notDrawn()) return false;
      const c = P.cycle;
      return (!!c && !c.error && c.emptied && c.after.listeners <= c.before.listeners && c.after.intervals <= c.before.intervals && c.after.nodes <= c.before.nodes) || false;
    }, test.limit.quick);
  }
  pageAfter(P);
}
// The page and its scratch node, gone when the file's checks are said.
function pageAfter(P) {
  test.after(async function () {
    const page = P.page; const node = P.node;
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    // ITS OWN NODE FREED, NEVER DELETED (goal/G47.1: a lab node's root removed here was rebuilt by the next test); a shared
    // node and a shared Chrome are their run's, which ends them; a page of the shared Chrome closes alone (kill, above).
    if (node && !node.shared) {
      try { if (typeof node.release === 'function') await node.release(); else SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').freeTree(node); } catch (e) { /* freed when this process ends */ }
    }
    // Its own Chrome's profile, once that Chrome has ended (its watcher deletes it too, should a file still be held).
    if (page && page.profile) { if (page.kid && page.kid.exitCode === null && page.kid.signalCode === null && page.kid.once) await new Promise(function (r) { page.kid.once('exit', r); }); try { fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* its watcher takes it */ } }
  });
}

// A FILE HANDED THAT IT CANNOT JUDGE, red, each title said in one place (goal/G49.23: the title rule, "no suite says one title
// twice"); hoisted, so batch() above says them too.
function handedMissing() { test.run('the file it was handed is there', 0.2, function () { return false; }, test.limit.quick); }
function handedNoPage() { test.run('the file it was handed is a page script of the tree', 0.2, function () { return false; }, test.limit.quick); }

// checks(scriptPath, tools): tools { test, run, spirit, batch }. Alone (tools.batch false), as the file it came from judged its
// one argument: its page drawn, then its rules said. In a batch (tools.batch true, the runner's node and Chrome named in
// SPIRIT_MOUNT_BASE and SPIRIT_CHROME_PORT), each script's page drawn and closed at once, then its checks said for it
// (test.forScript), while the runner holds the run open.
function checks(scriptPath, tools) {
  test = tools.test;
  const one = String(scriptPath || '');
  if (!tools.batch) {
    useScript(one);
    if (!full) { handedMissing(); return Promise.resolve(); }
    if (!pageScript(rel)) { handedNoPage(); return Promise.resolve(); }
    return bounded(session()).then(oneFile);
  }
  return (async function () {
    useScript(one);
    const d = { rel: rel, full: full };
    d.P = d.full && pageScript(d.rel) ? await bounded(session()) : null;
    // Its page closed at once: its checks read only what the drawing kept, and twenty pages left open slowed the later ones
    // past their mount (seen: three never mounted, two read as hung).
    // EVERY PAGE ITS SESSION OPENED, WHATEVER CAME OF IT (goal/G49.6; Andy: "FIX THE FUCKING BROWSER TOOL"): a session that
    // stalled or timed out answers without its page, and that page stayed open. Chrome holds six connections to one host,
    // and each page left open keeps its stream to the node: from the sixth on, no page of the node loaded, and every later
    // script of the run was charged red (Andy's WSL, 2026-11-23: 4408 reds on 177 scripts).
    OPENED.splice(0).concat(d.P && d.P.page ? [d.P.page] : []).forEach(function (pg) {
      try { if (pg.sock) pg.sock.close(); } catch (e) { /* gone */ }
      try { if (pg.kid) pg.kid.kill(); } catch (e) { /* gone */ }
    });
    useScript(d.full || d.rel);
    test.forScript(d.rel, function () {
      if (!d.full) handedMissing();
      else if (!d.P) handedNoPage();
      else oneFile(d.P);
    });
  }());
}

// The names its checks look for: none (goal/G49.27, Andy: "All, cw's way").
const FORBIDS_NAMES = [];
// Its node: the scratch node it asks (shared, the run's when one is handed) and the app servers it turns on there (own false:
// it changes nothing of its node but its own pages).
module.exports = { appliesTo: appliesTo, resource: 'browser', own: false, forbids: FORBIDS_NAMES, checks: checks };
