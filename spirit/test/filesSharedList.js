'use strict';

// spirit/test/filesSharedList.js
// goal/G29.8: the tree streamed with its stat, the node's fs.search on words. The item's box, in short:
//   THE STREAM: the watcher's updates each carry the stat, size and modified, for every create and change; a delete
//   carries none. The first load is the same commands. The shell holds every path, its kind and its stat.
//   FILES ON THE SHARED LIST: the files list element is spirit/run/spirit/element/search/file.js, tested in
//   spirit/run/spirit/element/search/file/test/; this suite does not drive it.
//   THE DROPDOWN: its field stands inline like any input control; only the pane pops up under it.
//   THE NODE'S fs.search: stays, on the node's own tree; words ranked by the probability modules, best first; the
//   patterns (* and ?) go.
//   THE CORE'S FOLDER LISTINGS: no node search for them; kernel.js's scanDirectory reads the shell's tree.
//
// NAMED HERE where the box names none:
//   - a command's stat: size (bytes, a number) and modified (an ISO time) beside op, path and at; the shell's rows
// Part 1 calls jobs.js as (spirit, 65432), but installJobs takes (port) only: the kernel lands in port.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G29.8: ';
const RUN = path.join(__dirname, '..', 'run');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function code(file) { try { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }

test.startTest('goal/G29.8: Files on the shared list, the tree streamed with its stat, fs.search on words');

// ── a small DOM, like contactSelectorPane.js's ──
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
  const index = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'index.html'), 'utf8');
  const at = function (s) { return index.indexOf(s); };
  if (!fs.existsSync(path.join(RUN, 'spirit', 'element', 'pathSelector.js')) && at('pathSelector') === -1 && !/createPathSelector/.test(code(path.join(RUN, 'spirit', 'client', 'shell.js')))) test.check('pathSelector is deleted: its file, its script tag, createPathSelector');
  else test.fail(OWED + 'pathSelector remains: file ' + fs.existsSync(path.join(RUN, 'spirit', 'element', 'pathSelector.js')) + ', in index.html ' + (at('pathSelector') !== -1) + ', in shell.js ' + /createPathSelector/.test(code(path.join(RUN, 'spirit', 'client', 'shell.js'))));
  if (!/contact-selector-face-dropdown\s+\.contact-selector-pane\s*\{[^}]*position:\s*absolute/.test(index)) test.check('index.html no longer floats the contact selector\'s whole pane');
  else test.fail(OWED + 'index.html still floats .contact-selector-face-dropdown .contact-selector-pane');
  // The box: "an app's own folder (kernel's scanDirectory) keeps the rows under its folder", from the shell's tree.
  const kern = code(path.join(RUN, 'spirit', 'kernel.js'));
  const scan = (/scanDirectory\s*:\s*function[\s\S]*?\n {6}\},/.exec(kern) || [''])[0];
  if (scan && !/fs\.search/.test(scan) && /currentFiles/.test(scan)) test.check('kernel.js\'s scanDirectory reads the shell\'s tree, not fs.search');
  else test.fail(OWED + 'kernel.js\'s scanDirectory: ' + short(scan));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});
