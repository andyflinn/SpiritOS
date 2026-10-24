'use strict';

// spirit/test/filesSharedList.js
// goal/G29.8: Files on the shared list, the tree streamed with its stat, the node's fs.search on words. Red on today's
// tree; claude-windows writes it and builds it (one agent). The item's box, in short:
//   THE STREAM: the watcher's updates each carry the stat, size and modified, for every create and change; a delete
//   carries none. The first load is the same commands. The shell holds every path, its kind and its stat.
//   FILES ON THE SHARED LIST: the file selector this suite drove was deleted by goal/G30.20; the files list element
//   (shell/js/files/listElement.js) took its place, asserted by listElements.js.
//   THE DROPDOWN: its field stands inline like any input control; only the pane pops up under it.
//   THE NODE'S fs.search: stays, on the node's own tree; words ranked by the probability modules, best first; the
//   patterns (* and ?) go.
//   THE CORE'S FOLDER LISTINGS: no node search for them; Desk's plugin finder reads the shell's tree.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - a command's stat: size (bytes, a number) and modified (an ISO time) beside op, path and at; the shell's rows
//   - one indent is an element of class file-selector-indent in the row.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G29.8: ';
const RUN = path.join(__dirname, '..', 'run');
const ICON = kernel.core.const.ICON;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }

test.startTest('goal/G29.8: Files on the shared list, the tree streamed with its stat, fs.search on words');

// ── the small DOM of contactSelectorPane.js ──
function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), id: '', value: '', textContent: '', className: '', style: {}, dataset: {},
    children: [], listeners: {}, parentNode: null, hidden: false, attrs: {},
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c) { return e.appendChild(c); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; },
    getAttribute: function (k) { return e.attrs[k] === undefined ? null : e.attrs[k]; },
    removeAttribute: function (k) { delete e.attrs[k]; if (k === 'hidden') e.hidden = false; },
    closest: function () { return null; },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    focus: function () {}, select: function () {}, blur: function () {},
  };
  e.classList = {
    add: function (c) { const s = String(e.className || '').split(/\s+/).filter(Boolean); if (s.indexOf(c) === -1) s.push(c); e.className = s.join(' '); },
    remove: function (c) { e.className = String(e.className || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
    toggle: function (c, on) { if (on === undefined) on = !e.classList.contains(c); if (on) e.classList.add(c); else e.classList.remove(c); return on; },
    contains: function (c) { return String(e.className || '').split(/\s+/).indexOf(c) !== -1; },
  };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
function bubble(target, ev) {
  if (!ev.target) { try { Object.defineProperty(ev, 'target', { value: target, configurable: true }); } catch (x) { ev.target = target; } }
  for (let n = target; n; n = n.parentNode) (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(n, ev); });
}
function fire(n, type, extra) { bubble(n, Object.assign({ type: type, bubbles: true, preventDefault: function () {}, stopPropagation: function () {} }, extra || {})); }
function all(root) { return [root].concat(root.children.reduce(function (acc, c) { return acc.concat(all(c)); }, [])); }


const MOD = '2026-10-17T12:00:00.000Z';
function entry(p, kind, size) {
  const cut = p.lastIndexOf('/');
  return { name: p.slice(cut + 1), relativePath: p, kind: kind, fullPath: p, parentPath: cut === -1 ? '' : p.slice(0, cut), size: kind === 'file' ? size : 0, modified: MOD };
}
const TREE = [
  entry('js', 'folder'), entry('spirit/server.js', 'file', 2048),
  entry('media', 'folder'), entry('media/cat.png', 'file', 5000),
  entry('shell', 'folder'), entry('shell/shared', 'folder'), entry('shell/shared/js', 'folder'), entry('shell/shared/js/listSearch.js', 'file', 12000),
];

(async function () {
  // ── 1. the stream ──
  test.subHeading('1. the watcher\'s commands carry the stat; a delete carries none');
  const home = path.join(RUN, 'fswatch-files-g298');
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, 'a'), { recursive: true });
  fs.writeFileSync(path.join(home, 'a', 'seed.txt'), 'seed!');
  let jobs = null;
  let job = null;
  try {
    const spirit = require('../run/spirit/kernel.js');
    jobs = require('../run/spirit/jobs.js')(spirit, 65432);
    const seen = [];
    jobs.events.on('job-updated', function (u) { if (job && u.id === job.id && u.data && u.data.command) seen.push(u.data.command); });
    job = jobs.startFsWatcherJob(home);
    await sleep(1500);
    const start = jobs.fsTreeCommands();
    const seed = start.filter(function (c) { return c.path === 'a/seed.txt'; })[0] || {};
    const mtime = fs.statSync(path.join(home, 'a', 'seed.txt')).mtime.toISOString();
    if (seed.size === 5 && seed.modified === mtime) test.check('the first load\'s createFile a/seed.txt carries size 5 and its modified time');
    else test.fail(OWED + 'the first load\'s command for a/seed.txt reads ' + short(seed) + ' (on disk: 5 bytes, ' + mtime + ')');
    fs.writeFileSync(path.join(home, 'a', 'new.txt'), 'hello');
    await sleep(800);
    fs.writeFileSync(path.join(home, 'a', 'new.txt'), 'hello world');
    await sleep(800);
    const newMtime = fs.statSync(path.join(home, 'a', 'new.txt')).mtime.toISOString();
    fs.rmSync(path.join(home, 'a', 'new.txt'));
    await sleep(1200);
    const made = seen.filter(function (c) { return c.op === 'createFile' && c.path === 'a/new.txt'; })[0] || {};
    const changed = seen.filter(function (c) { return c.op === 'changeFile' && c.path === 'a/new.txt'; }).pop() || {};
    const gone = seen.filter(function (c) { return c.op === 'deleteFile' && c.path === 'a/new.txt'; })[0];
    if (made.size === 5 && !isNaN(Date.parse(made.modified))) test.check('createFile a/new.txt carries size 5 and a modified time');
    else test.fail(OWED + 'createFile a/new.txt reads ' + short(made));
    if (changed.size === 11 && changed.modified === newMtime) test.check('its changeFile carries the new size 11 and the new modified time');
    else test.fail(OWED + 'changeFile a/new.txt reads ' + short(changed) + ' (on disk: 11 bytes, ' + newMtime + ')');
    if (gone && gone.size === undefined && gone.modified === undefined) test.check('its deleteFile carries no stat');
    else test.fail(OWED + 'deleteFile a/new.txt reads ' + short(gone));
  } catch (e) {
    test.fail(OWED + 'the watcher could not be run: ' + (e && e.message || e));
  } finally {
    try { if (job && jobs) jobs.cancelJob(job.id); } catch (e) { /* stopped */ }
    fs.rmSync(home, { recursive: true, force: true });
  }

  // ── 2. the shell's mirror ──
  test.subHeading('2. the shell holds every path, its kind and its stat');
  const shellFiles = bootShell();
  const first = (shellFiles.files() || []).filter(function (f) { return f.relativePath === 'shell/notes.txt'; })[0] || {};
  if (first.size === 10 && first.modified === MOD) test.check('currentFiles carries size and modified for shell/notes.txt');
  else test.fail(OWED + 'currentFiles reads ' + short(first));
  const v0 = shellFiles.version();
  shellFiles.send({ op: 'changeFile', path: 'shell/notes.txt', at: '', size: 30, modified: '2026-10-18T01:00:00.000Z' });
  const after = (shellFiles.files() || []).filter(function (f) { return f.relativePath === 'shell/notes.txt'; })[0] || {};
  if (after.size === 30 && after.modified === '2026-10-18T01:00:00.000Z' && shellFiles.version() !== v0) test.check('a changeFile updates the row\'s stat, and the tree\'s version moves so Files redraws');
  else test.fail(OWED + 'after a changeFile the row reads ' + short(after) + ', version ' + v0 + ' then ' + shellFiles.version());

  // ── 5. the node's fs.search ──
  test.subHeading('5. the node\'s fs.search ranks words over its own tree');
  const searches = require('../run/spirit/nodeSearches.js').createNodeSearches({
    jobs: { fsTreeEntries: function () { return TREE.map(function (f) { return { name: f.name, relativePath: f.relativePath, kind: f.kind }; }); } },
    rootDir: RUN, fsPath: function (r, raw) { const p = path.resolve(r, raw); return p.indexOf(r) === 0 ? p : null; } });
  const keysFor = function (q) { const r = searches.fsSearch({ q: q }); return ((r && r.items) || []).map(function (x) { return x.key; }); };
  // The box: the same probability modules as the shared list, best first. How well they rank a person's words over
  // path segments is goal/G29.7's (fs.search as a person's search), not asserted here.
  const words = keysFor('search list');
  if (words[0] === 'shell/shared/js/listSearch.js') test.check('words find shell/shared/js/listSearch.js first');
  else test.fail(OWED + '"search list" answered ' + short(words));
  const everything = keysFor('');
  if (JSON.stringify(everything) === JSON.stringify(TREE.map(function (f) { return f.relativePath + (f.kind === 'folder' ? '/' : ''); }))) test.check('no words: the whole tree in path order, a folder with its slash');
  else test.fail(OWED + 'no words answered ' + short(everything));
  if (typeof searches.cleanPattern !== 'function' && !/\bcleanPattern\b|\bgradedSearch\b/.test(code(path.join(RUN, 'spirit', 'nodeSearches.js')))) test.check('the patterns are gone from nodeSearches.js (no cleanPattern, no gradedSearch)');
  else test.fail(OWED + 'nodeSearches.js still holds the patterns');

  // ── 6. what moves and what goes ──
  test.subHeading('6. Files, the text editor and Desk on the shell\'s tree; pathSelector gone');
  const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  const at = function (s) { return index.indexOf(s); };
  if (!fs.existsSync(path.join(RUN, 'shell', 'js', 'pathSelector.js')) && at('pathSelector') === -1 && !/createPathSelector/.test(code(path.join(RUN, 'spirit', 'client', 'shell.js')))) test.check('pathSelector is deleted: its file, its script tag, createPathSelector');
  else test.fail(OWED + 'pathSelector remains: file ' + fs.existsSync(path.join(RUN, 'shell', 'js', 'pathSelector.js')) + ', in index.html ' + (at('pathSelector') !== -1) + ', in shell.js ' + /createPathSelector/.test(code(path.join(RUN, 'spirit', 'client', 'shell.js'))));
  if (!/contact-selector-face-dropdown\s+\.contact-selector-pane\s*\{[^}]*position:\s*absolute/.test(index)) test.check('index.html no longer floats the contact selector\'s whole pane');
  else test.fail(OWED + 'index.html still floats .contact-selector-face-dropdown .contact-selector-pane');
  const desk = code(path.join(RUN, 'shell', 'desk', 'desk.js'));
  if (!/['"]fs\.search['"]/.test(desk)) test.check('Desk\'s plugin finder asks the node nothing: it reads the shell\'s tree');
  else test.fail(OWED + 'shell/desk/desk.js still asks fs.search');
  // The box: "an app's own folder (kernel's scanDirectory) keeps the rows under its folder", from the shell's tree.
  const kern = code(path.join(RUN, 'spirit', 'kernel.js'));
  const scan = (/scanDirectory\s*:\s*function[\s\S]*?\n {6}\},/.exec(kern) || [''])[0];
  if (scan && !/fs\.search/.test(scan) && /currentFiles/.test(scan)) test.check('kernel.js\'s scanDirectory reads the shell\'s tree, not fs.search');
  else test.fail(OWED + 'kernel.js\'s scanDirectory: ' + short(scan));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});

// The real shell.js, as shellStreamSenders.js boots it: a small document, fs and jobs stubs; the tree comes as the
// watcher's commands, with their stat.
function bootShell() {
  const byId = {};
  const el = function (tag) {
    let html = '';
    const attrs = {};
    const e = { tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [],
      appendChild: function (c) { e.children.push(c); return c; }, addEventListener: function () {},
      querySelector: function () { return el('div'); }, querySelectorAll: function () { return []; },
      setAttribute: function (k, v) { attrs[k] = String(v); }, getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      remove: function () {} };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children.length = 0; }, enumerable: true });
    return e;
  };
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home'].forEach(function (id) { byId[id] = el('div'); });
  const doc = { body: el('body'), currentScript: null, getElementById: function (id) { return byId[id] || (byId[id] = el('div')); },
    createElement: el, createDocumentFragment: function () { return el('fragment'); } };
  const subscribers = [];
  const answer = function (body) { return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body }); };
  const sp = {
    core: {
      ask: function (verb) { if (verb === 'node.card') return answer({ ok: true, name: 'me', description: '', publicKey: 'OWN', descriptionMax: 0 }); return answer({ ok: true, items: [], more: false }); },
      relays: { status: function () { return answer({ name: 'me', rows: [] }); } },
      const: { ICON: ICON, MIME: {} },
      util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) { return rel === 'preferences.json' ? JSON.stringify({ apps: {}, groups: {} }) : null; },
        saveFile: function () { return Promise.resolve(); }, statFile: function () { return null; },
        getAnnotations: function () { return {}; }, createScopedFs: function () { return {}; },
      },
      jobs: { subscribe: function (h) { subscribers.push(h); } },
    },
  };
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(path.join(RUN, 'spirit', 'client', 'shell.js'), 'utf8'))(
    sp, doc, function () {}, test.withSpirit({ 'spirit.packet': require('../run/spirit/client/packet'), 'spirit.limits': require('../run/spirit/limits.js') }));
  const send = function (command) { subscribers.forEach(function (h) { if (typeof h.onUpdate === 'function') h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: command } }); }); };
  subscribers.forEach(function (h) { if (typeof h.onSnapshot === 'function') h.onSnapshot([{ id: 'fs-watcher-1', type: 'fs-watcher', data: {} }]); });
  send({ op: 'createDirectory', path: 'shell', at: '', modified: MOD });
  send({ op: 'createFile', path: 'shell/notes.txt', at: '', size: 10, modified: MOD });
  subscribers.forEach(function (h) { if (typeof h.onUpdate === 'function') h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { treeComplete: true } }); });
  return {
    send: send,
    files: function () { return sp.shell && sp.shell.currentFiles ? sp.shell.currentFiles() : null; },
    version: function () { return sp.shell && sp.shell.filesVersion ? sp.shell.filesVersion() : -1; },
  };
}
