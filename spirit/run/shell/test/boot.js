'use strict';

// spirit/run/shell/test/boot.js
// The tests of shell/boot.js, and of no other module (spec: ./boot.md; goal/G41.3): where the face's boot lives and
// what moved with it, what it loads, the shell it loads (goal/G43.18), and every face app loading alone. An app is loaded in a vm of its own, with nothing
// but a spirit.require that serves the run tree's files, each once, a page stub that answers anything, and an empty set
// of elements: an app that uses a component it did not ask for fails, by name.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'boot.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } }
function code(p) { const t = read(p); return t == null ? null : t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

// ── A PAGE STUB THAT ANSWERS ANYTHING ──────────────────────────────────────────────────────────────────────────────
// A node answers every property: a function that hands back another node, a string where one is read, and a then, so
// a family call or spirit.ready awaited answers an empty object (never itself, or an await would never end).
// plain: a node with no then of its own, what an awaited node resolves to (spirit.ready answers spirit, its families on it).
function anything(name, plain) {
  const store = { innerHTML: '', textContent: '', value: '', hidden: false, checked: false, className: '', id: '' };
  const fn = function () { return anything(name + '()'); };
  return new Proxy(fn, {
    get: function (t, k) {
      if (k === Symbol.toPrimitive) return function () { return ''; };
      if (k === 'then') return plain ? undefined : function (resolve) { const v = anything(name + '>', true); if (typeof resolve === 'function') resolve(v); return Promise.resolve(v); };
      if (k === 'catch' || k === 'finally') return plain ? anything(name + '.' + String(k)) : function () { return Promise.resolve(anything(name + '>', true)); };
      if (typeof k === 'symbol') return undefined;
      if (k in store) return store[k];
      if (k === 'style' || k === 'dataset') return store[k] || (store[k] = {});
      if (k === 'length') return 0;
      if (k === 'children' || k === 'childNodes') return [];
      if (/^querySelectorAll$|^getElementsBy/.test(k)) return function () { return []; };
      return anything(name + '.' + String(k));
    },
    set: function (t, k, v) { store[k] = v; return true; },
    apply: function () { return anything(name + '()'); },
  });
}
// The shell's api for the app: every verb answers an empty, accepted body; every subscription is a no-op.
function apiFor(elements) {
  // An answer's body has the fields every search answers, and answers any other field as the page stub does.
  const body = function () {
    return new Proxy({ ok: true, items: [], more: false }, { get: function (t, k) { if (k in t) return t[k]; if (k === 'then' || typeof k === 'symbol') return undefined; return anything('body.' + String(k)); } });
  };
  const answer = function () { return Promise.resolve({ status: 200, body: body(), text: '{}' }); };
  return new Proxy({ ui: { elements: elements } }, {
    get: function (t, k) {
      if (k in t) return t[k];
      if (k === 'then') return undefined;
      if (/^on[A-Z]/.test(String(k))) return function () { return function () {}; };
      if (k === 'escapeHtml') return function (s) { return String(s == null ? '' : s); };
      return answer;
    },
  });
}

// One face app, alone: its own vm, its own require tree. Answers { mounted, error }.
async function loadAlone(app) {
  const errors = [];
  const required = [];
  const elements = {};
  const ran = {};
  let collecting = null;
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function () { return 0; }, clearInterval: function () {}, setImmediate: setImmediate, Promise: Promise, JSON: JSON, Math: Math, Date: Date,
    TextEncoder: TextEncoder, TextDecoder: TextDecoder, URL: URL, URLSearchParams: URLSearchParams, Uint8Array: Uint8Array, Buffer: Buffer,
    document: anything('document'), localStorage: anything('localStorage'), navigator: anything('navigator'), location: anything('location'),
    fetch: function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(''); }, json: function () { return Promise.resolve({}); } }); } };
  ctx.window = ctx; ctx.globalThis = ctx;
  let def = null;
  const spirit = {
    elements: elements,
    shell: { activateApp: function (d) { def = d; } },
    // THE ONE LOADER, as spirit.js has it: de-duped as node's require is (a path is read from the run tree and run
    // once), and a tree: what a component requires while it runs is waited for before its own require answers.
    require: function (p) {
      const rel = String(p || '').replace(/^\/+/, '');
      required.push(rel);
      if (ran[rel]) { if (collecting) collecting.push(ran[rel]); return ran[rel]; }
      ran[rel] = new Promise(function (resolve, reject) {
        const text = read(rel);
        if (text == null) { reject(Object.assign(new Error('not-found: ' + rel), { code: 'not-found' })); return; }
        const outer = collecting;
        const tree = collecting = [];
        try { vm.runInContext(text, ctx, { filename: rel }); } catch (e) { collecting = outer; reject(e); return; }
        collecting = outer;
        Promise.all(tree).then(function () { resolve(true); }, reject);
      });
      if (collecting) collecting.push(ran[rel]);
      return ran[rel];
    },
  };
  // Anything else of spirit's answers like the page stub (its families, fs, events), so only the elements are bare.
  ctx.spirit = new Proxy(spirit, { get: function (t, k) { if (k in t) return t[k]; if (k === 'then') return undefined; return anything('spirit.' + String(k)); } });
  vm.createContext(ctx);
  const onRejection = function (e) { errors.push(e); };
  process.on('unhandledRejection', onRejection);
  try {
    vm.runInContext(read('shell/' + app + '/' + app + '.js'), ctx, { filename: 'shell/' + app + '/' + app + '.js' });
    if (!def || typeof def.mount !== 'function') return { mounted: false, error: 'no activateApp with mount', required: required };
    try { await def.mount(anything('container'), apiFor(elements)); } catch (e) { errors.push(e); }
    for (let i = 0; i < 40; i++) await new Promise(function (r) { setImmediate(r); });
  } catch (e) { errors.push(e); }
  finally { process.removeListener('unhandledRejection', onRejection); }
  return { mounted: !errors.length, error: errors.length ? String(errors[0] && errors[0].message || errors[0]) : '', required: required };
}

test.startTest('boot.js: the face\'s boot, and every face app loading alone');

(async function () {
  test.subHeading('where it lives, and what moved with it');
  const boot = code('shell/boot.js');
  ok(!!boot, 'shell/boot.js is there', 'shell/boot.js is not there');
  const left = ['face/shell.js', 'face/seal.js', 'face/face.css', 'face/favicon.svg', 'face/login/login.js', 'face/login/login.json'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  ok(!left.length, 'nothing of face/ is left: its files moved into shell/', 'still in face/: ' + left.join(', '));
  const moved = ['shell/seal.js', 'shell/face.css', 'shell/favicon.svg'].filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  ok(!moved.length, 'the seal, the sheet and the icon are in shell/ under the same names', 'not in shell/: ' + moved.join(', '));
  // goal/G43.18, box v29: "The login is spirit.login, in spirit.js, no app ... shell/login/ and its login.json go."
  ok(!fs.existsSync(path.join(RUN, 'shell', 'login')), 'shell/login/ is gone: the login is spirit.login (goal/G43.18)', 'shell/login/ is still there');
  const loader = code('spirit.js') || '';
  ok(/var FACE = \['shell\/boot\.js'\]/.test(loader) && !/face\/shell\.js/.test(loader), 'spirit.js loads shell/boot.js on a face page', 'spirit.js still names face/shell.js, or not shell/boot.js');
  const page = read('face.html') || '';
  // Box v29: "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link".
  ok(/\/shell\/favicon\.svg/.test(page) && !/rel="stylesheet"/.test(page) && !/\/face\/(face\.css|favicon\.svg)/.test(page), 'face.html links /shell/favicon.svg and no sheet', 'face.html still links a sheet or the old face/ files');
  if (boot) {
    const oldPaths = (boot.match(/face\/(shell\.js|seal\.js|face\.css|favicon\.svg|login\/[\w.]+)/g) || []);
    ok(!oldPaths.length && !/shell\/login\//.test(boot), 'boot names no old face/ path, and no login app', 'old paths in boot: ' + short(oldPaths));
  }

  test.subHeading('what it loads: only what it runs itself');
  if (boot) {
    const paths = (boot.match(/['"](?:spirit|shell)\/[\w/.-]+\.(?:js|css|json)['"]|['"]shell\.css['"]/g) || []).map(function (s) { return s.slice(1, -1); });
    const allowed = function (p) {
      return p === 'shell.css' || p === 'shell/face.css' || /^spirit\/[\w.-]+\.js$/.test(p) || /^spirit\/client\/[\w.-]+\.js$/.test(p) ||
        p === 'shell/join/join.js' || p === 'shell/navigationWrapper.js' || p === 'spirit/element/joinSteps.js' ||
        // goal/G41.19: the file tree's row element, which spirit.js does not load.
        p === 'spirit/element/search/file/rowElement.js';
    };
    const extra = paths.filter(function (p) { return !allowed(p); }).filter(function (p, i, all) { return all.indexOf(p) === i; });
    ok(!extra.length, 'boot names no component but its own: spirit\'s libraries, the sheets, Join, the navigation and the tree\'s row (' + paths.length + ' paths read)',
      'boot loads components that are no part of it: ' + short(extra));
    ok(/shell\/join\/join\.js/.test(boot), 'Join is hard-coded in boot by its path', 'boot does not name shell/join/join.js');
    ok(!/join[\w.]*\.sidecar\.json/.test(boot), 'boot reads no sidecar of Join', 'boot reads the sidecar of Join');
  }
  const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
  const mustCore = ['shell/boot.js', 'shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/join/join.js', 'shell/join/join.json'];
  const notCore = mustCore.filter(function (p) { return core.isCore('spirit/run/' + p, REPO) !== true; });
  ok(!notCore.length, 'boot, the seal, the sheet, the icon and the Join app whole are core', 'not core: ' + notCore.join(', '));

  // GOAL/G43.18, BOX V29, "The shell": "boot.js does the link home and the face stream only, then loads the shell the node
  // names, spirit/app/<name>"; Q22: the link is spirit.js's; Q23: no desktop of boot's own; Q18: Join shows itself.
  test.subHeading('the shell the node names, and no desktop of its own (goal/G43.18)');
  if (boot) {
    ok(/node\.shell\(\{ at: at \}\)/.test(boot) && /'spirit\/app\/' \+ name \+ '\/' \+ name \+ '\.js'/.test(boot), 'boot asks node.shell and loads spirit/app/<name>/<name>.js', 'boot does not load the shell the node names');
    ok(!/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/.test(boot), 'no desktop of its own: no drawDesktop, readFace, listApps, openApp, loadApp or serverUp', 'boot still draws a desktop: ' + short((boot.match(/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/g) || [])));
    ok(!/function (postCall|uploadSave)\(/.test(boot) && !/'\/face\/api'/.test(boot), 'no link and no relay login of its own: spirit.link and spirit.login are spirit.js\'s', 'boot still holds the link or the login');
    ok(!/joinNow|joinOpenStep|handJoin/.test(boot), 'Join decides where it stands itself: boot works out no join step', 'boot still works out Join\'s steps');
  }

  // THE ICON SET IS THE ONLY SOURCE OF ICONS ON THE FACE (goal/G41.1, box v19-v20; Andy: iconIndex.js "MUST BE DELETED,
  // KILLED, ERADICATED"): iconIndex.js and chatLog.js are gone; boot loads neither and looks nothing up by key; every app
  // manifest names its icon as the glyph itself.
  test.subHeading('no icon table on the face');
  const gone = ['spirit/client/iconIndex.js', 'spirit/client/chatLog.js'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  ok(!gone.length, 'spirit/client/iconIndex.js and chatLog.js are gone', 'still there: ' + gone.join(', '));
  if (boot) {
    ok(!/iconIndex|chatLog|\bICON\b/.test(boot), 'boot names neither, and no icon table', 'boot still names iconIndex, chatLog or ICON');
  }
  const keyed = [];
  ['shell', 'process/js'].forEach(function (dir) {
    let names = []; try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
    names.forEach(function (n) {
      let m = null; try { m = JSON.parse(fs.readFileSync(path.join(RUN, dir, n, n + '.json'), 'utf8')); } catch (e) { m = null; }
      if (m && typeof m.icon === 'string' && /^[A-Z_]+$/.test(m.icon)) keyed.push(dir + '/' + n + ':' + m.icon);
    });
  });
  ok(!keyed.length, 'every app manifest names its icon as the glyph itself', keyed.length + ' manifests name a key: ' + short(keyed));

  test.subHeading('every face app loads alone');
  // THE FACE APPS SHIPPED TO DATE, named here: a face mark is each node's own state since goal/G41.1 (box v16-v17), so
  // the tree no longer says which apps a face shows.
  const FACE_APPS = ['agent', 'apps', 'contacts', 'files', 'icons', 'info', 'mediaViewer'];
  const apps = FACE_APPS.filter(function (a) { return fs.existsSync(path.join(RUN, 'shell', a, a + '.js')); });
  ok(apps.length === FACE_APPS.length, apps.length + ' face apps: ' + apps.join(', '), 'face apps missing: ' + FACE_APPS.filter(function (a) { return apps.indexOf(a) === -1; }).join(', '));
  for (const a of apps) {
    const r = await loadAlone(a);
    ok(r.mounted, a + ' loads alone: it asks for what it uses' + (r.required.length ? ' (' + r.required.filter(function (p, i, all) { return all.indexOf(p) === i; }).join(', ') + ')' : ''),
      a + ' does not load alone: ' + r.error);
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
