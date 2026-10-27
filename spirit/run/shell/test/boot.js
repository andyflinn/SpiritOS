'use strict';

// spirit/run/shell/test/boot.js
// The tests of shell/boot.js, and of no other module (spec: ./boot.md; goal/G41.3): where the face's boot lives and
// what moved with it, what it loads, and every face app loading alone. An app is loaded in a vm of its own, with nothing
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
  const moved = ['shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/login/login.js', 'shell/login/login.json'].filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  ok(!moved.length, 'the seal, the sheet, the icon and the login app are in shell/ under the same names', 'not in shell/: ' + moved.join(', '));
  const loader = code('spirit.js') || '';
  ok(/var FACE = \['shell\/boot\.js'\]/.test(loader) && !/face\/shell\.js/.test(loader), 'spirit.js loads shell/boot.js on a face page', 'spirit.js still names face/shell.js, or not shell/boot.js');
  const page = read('face.html') || '';
  ok(/\/shell\/face\.css/.test(page) && /\/shell\/favicon\.svg/.test(page) && !/\/face\/(face\.css|favicon\.svg)/.test(page), 'face.html links /shell/face.css and /shell/favicon.svg', 'face.html still links the old face/ files');
  if (boot) {
    const oldPaths = (boot.match(/face\/(shell\.js|seal\.js|face\.css|favicon\.svg|login\/[\w.]+)/g) || []);
    ok(!oldPaths.length && /shell\/seal\.js/.test(boot) && /shell\/login\//.test(boot), 'boot names its parts by their new paths: shell/seal.js and shell/login/', 'old paths in boot: ' + short(oldPaths));
  }

  test.subHeading('what it loads: only what it runs itself');
  if (boot) {
    const paths = (boot.match(/['"](?:spirit|shell)\/[\w/.-]+\.(?:js|css|json)['"]|['"]shell\.css['"]/g) || []).map(function (s) { return s.slice(1, -1); });
    const allowed = function (p) {
      return p === 'shell.css' || /^spirit\/[\w.-]+\.js$/.test(p) || /^spirit\/client\/[\w.-]+\.js$/.test(p) || p === 'shell/seal.js' || p === 'shell/boot.js' ||
        /^shell\/login\//.test(p) || /^shell\/join\//.test(p) || p === 'shell/js/navigationWrapper.js' || p === 'shell/js/joinSteps.js';
    };
    const extra = paths.filter(function (p) { return !allowed(p); }).filter(function (p, i, all) { return all.indexOf(p) === i; });
    ok(!extra.length, 'boot names no component but its own: spirit\'s libraries, the sheet, the seal, the login app, Join and the navigation (' + paths.length + ' paths read)',
      'boot loads components that are no part of it: ' + short(extra));
    ok(/shell\/login\/login\.js/.test(boot) && /shell\/join\b/.test(boot), 'login and Join are hard-coded in boot by their paths', 'boot does not name shell/login/login.js and shell/join');
    ok(!/(login|join)[\w.]*\.sidecar\.json/.test(boot), 'boot reads no sidecar of login or Join', 'boot reads the sidecar of login or Join');
  }
  const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
  const mustCore = ['shell/boot.js', 'shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/login/login.js', 'shell/login/login.json',
    'shell/join/join.js', 'shell/join/join.json'];
  const notCore = mustCore.filter(function (p) { return core.isCore('spirit/run/' + p, REPO) !== true; });
  ok(!notCore.length, 'boot, the seal, the sheet, the icon, and the login and Join apps whole are core', 'not core: ' + notCore.join(', '));

  // AN APP SHOWS ONLY WHILE ITS SERVER RUNS, ON THE FACE TOO (goal/G27.16; goal/G41.1, box v14): boot reads the server a
  // face app's manifest names, shows the app only while a server job of that module runs or is pending, and when the
  // server stops, or the app's face mark goes, takes its icon down and closes a page of it that is open.
  test.subHeading('an app shows only while its server runs (G27.16)');
  if (boot) {
    const readFaceAt = (/function readFace\(id\) \{([\s\S]*?)\n  \}/.exec(boot) || [])[1] || '';
    ok(/\.json'/.test(readFaceAt) && /\.server\b/.test(readFaceAt), 'a face app\'s manifest is read for the server it names', 'readFace reads no manifest server');
    ok(/function serverUp\(/.test(boot) && /'process\/js\/' \+/.test(boot) && /'running'/.test(boot) && /'pending'/.test(boot),
      'a server is up while a server job of its module runs or is pending', 'boot has no serverUp over its server jobs');
    const drawAt = (/function drawDesktop\(\) \{([\s\S]*?)\n  \}/.exec(boot) || [])[1] || '';
    ok(/serverUp\(/.test(drawAt), 'the desktop draws an app only while its server is up', 'drawDesktop does not ask serverUp');
    ok(/function closePages\(/.test(boot) && /\.close\(\)/.test(boot) && /closePages\(/.test(readFaceAt), 'an app whose server stops or whose face mark goes has its open pages closed',
      'boot keeps no pages to close, or readFace does not close them');
    // box v17: a node shows its intrinsic apps (Andy: "minimal == intrinsic"; found on his face: "the face shall does not
    // let me see even the intrinsic apps."): one with no face part of the node's is named and iconed from its manifest;
    // Join stays boot's own, drawn by its open step.
    // An app naming a server rides with that server (box v14: its button "activates and deactivates every shell app that
    // depends on it"); it has no row in Apps and no face mark of its own, so it shows while its server runs. Found on his
    // face: "the agent app-face doesn't show up in my Apps app, and i don't see it anymore".
    ok(/mf\.server/.test(readFaceAt) && /face\.app === true \|\| face\.intrinsic === true \|\| /.test(readFaceAt),
      'an app that names a server shows with its server, no face mark needed', 'readFace shows an app naming a server only with a face mark nothing can set');
    // Andy: "the login-app should not show in face-loopback mode": login and Join are boot's own, never app icons.
    ok(/'shell\/login'/.test(readFaceAt), 'the login app is never an app icon: readFace skips it as it skips Join', 'readFace does not skip the login app');
    ok(/face\.intrinsic === true/.test(readFaceAt) && /iconIndex/.test(readFaceAt) && /JOIN/.test(readFaceAt),
      'an intrinsic app shows on the face, named and iconed from its manifest when the node has no face part for it; Join stays boot\'s',
      'readFace shows only apps whose face part says app, so the intrinsic ones hide');
    // box v15: the node streams an app's face part when its sidecar changes, and the face follows it.
    ok(/'app-face'/.test(boot) && /function followFace\(/.test(boot) && /readFace\(/.test((/function followFace\(job\) \{([\s\S]*?)\n  \}/.exec(boot) || [])[1] || ''),
      'a face part streamed (an app-face job) has the face read that app again, so it comes or goes at once', 'boot does not follow app-face jobs');
  }

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
