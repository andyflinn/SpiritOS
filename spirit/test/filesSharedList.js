'use strict';

// spirit/test/filesSharedList.js
// goal/G29.8: Files on the shared list, the tree streamed with its stat, the node's fs.search on words. Red on today's
// tree; claude-windows writes it and builds it (one agent). The item's box, in short:
//   THE STREAM: the watcher's updates each carry the stat, size and modified, for every create and change; a delete
//   carries none. The first load is the same commands. The shell holds every path, its kind and its stat.
//   FILES ON THE SHARED LIST: fileSelector (shell/js/fileSelector.js), a wrapper on shellCreateListSearch over the
//   shell's mirror, as contactSelector is, with a pane face and a dropdown face. Names and paths are searched in the page.
//   Every display has size and modified, right-justified, and the mimetype icon before the name. No words: the tree,
//   rows in path order, one indent per slash, a folder row folding the rows under it. Words: the rows ranked, each with
//   its full path, the matched parts marked. fileSelector replaces pathSelector, which is deleted; the text editor
//   picks its file with the dropdown; Files is a container for the pane.
//   THE DROPDOWN: its field stands inline like any input control; only the pane pops up under it.
//   THE NODE'S fs.search: stays, on the node's own tree; words ranked by the probability modules, best first; the
//   patterns (* and ?) go.
//   THE CORE'S FOLDER LISTINGS: no node search for them; Desk's plugin finder reads the shell's tree.
//
// NAMED HERE where the box names none (argue them in Desk first if the build disagrees):
//   - a command's stat: size (bytes, a number) and modified (an ISO time) beside op, path and at; the shell's rows
//     carry the same two keys.
//   - window.spiritElements.createFileSelector(options): options.face 'pane', else the dropdown; options.files() the
//     rows, as spirit.shell.currentFiles answers them; the root's value is the picked path, its row the row, and a
//     pick fires one bubbling change on it.
//   - one indent is an element of class file-selector-indent in the row.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G29.8: ';
const RUN = path.join(__dirname, '..', 'run');
const FILE = path.join(RUN, 'shell', 'js', 'fileSelector.js');
const LIST = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');
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

let DOC = null;
// The element the shared list writes into: the one holding its markup.
function hostOf(root) { return all(root).filter(function (n) { return /id="listsearch-\d+-/.test(n.innerHTML); })[0] || null; }
function partOf(root, name) {
  const h = hostOf(root);
  const m = h && /id="(listsearch-\d+-)text"/.exec(h.innerHTML);
  return m && DOC ? DOC.getElementById(m[1] + name) : null;
}
function rowsOf(root) {
  const list = partOf(root, 'list');
  const popup = partOf(root, 'popup');
  if (!list || list.hidden || (popup && popup.hidden)) return [];
  const out = [];
  const re = /<tr[^>]*\bdata-key="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(list.innerHTML))) {
    const cells = [];
    const cre = /<td[^>]*>[\s\S]*?<\/td>/g;
    let c;
    while ((c = cre.exec(m[2]))) cells.push(c[0]);
    out.push({ key: m[1], html: m[2], cells: cells });
  }
  return out;
}
function keysOf(root) { return rowsOf(root).map(function (r) { return r.key; }); }
function rowFor(root, key) { return rowsOf(root).filter(function (r) { return r.key === key; })[0] || null; }
function typeInto(root, text) { const box = partOf(root, 'text'); if (!box) return false; box.value = text; fire(hostOf(root), 'input', { target: box }); return true; }
function press(root, key) { fire(hostOf(root), 'click', { target: { id: '', getAttribute: function (k) { return k === 'data-key' ? key : null; }, closest: function () { return null; } } }); }

function load() {
  const byId = {};
  const doc = { createElement: node, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; },
    getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; },
    listeners: {}, addEventListener: function (t, fn) { (doc.listeners[t] = doc.listeners[t] || []).push(fn); }, removeEventListener: function () {}, dispatchEvent: function () { return true; } };
  DOC = doc;
  const win = {};
  const asked = [];
  const sp = { core: {
    ask: function (verb, body) { asked.push(verb); return Promise.resolve({ status: 200, body: { items: [], more: false } }); },
    util: { escapeHtml: kernel.core.util.escapeHtml, formatBytes: kernel.core.util.formatBytes },
    const: { ICON: ICON, MIME: {} } },
    // The shell's own mimetype lookup, as the page has it on spirit.shell (shell.js mimeTypeForName, iconForFile).
    shell: {
      mimeTypeForName: function (name) { const d = name.lastIndexOf('.'); return kernel.core.const.MIME_TYPES[d >= 0 ? name.slice(d).toLowerCase() : ''] || 'application/octet-stream'; },
      iconForFile: function (mime) { return /^(image|audio|video)\//.test(mime) ? ICON.VIEW : /^text\/|javascript|json/.test(mime) ? ICON.CODE : ICON.FILE; },
    } };
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  new Function('document', 'window', fs.readFileSync(LIST, 'utf8'))(doc, win);
  if (fs.existsSync(FILE)) new Function('spirit', 'document', 'window', 'Event', 'CustomEvent', fs.readFileSync(FILE, 'utf8'))(sp, doc, win, Event, CustomEvent);
  return { make: win.spiritElements && win.spiritElements.createFileSelector, asked: asked, doc: doc };
}

const MOD = '2026-10-17T12:00:00.000Z';
function entry(p, kind, size) {
  const cut = p.lastIndexOf('/');
  return { name: p.slice(cut + 1), relativePath: p, kind: kind, fullPath: p, parentPath: cut === -1 ? '' : p.slice(0, cut), size: kind === 'file' ? size : 0, modified: MOD };
}
const TREE = [
  entry('js', 'folder'), entry('js/server.js', 'file', 2048),
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
    const spirit = require('../run/js/kernel.js');
    jobs = require('../run/js/jobs.js')(spirit, 65432);
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

  // ── 3. the pane ──
  test.subHeading('3. fileSelector\'s pane: the tree with no words, the ranked list with words');
  const m = load();
  if (typeof m.make !== 'function') {
    test.fail(OWED + 'no window.spiritElements.createFileSelector (shell/js/fileSelector.js)');
  } else {
    const src = code(FILE);
    if (/shellCreateListSearch\s*\(/.test(src)) test.check('fileSelector.js is a wrapper on shellCreateListSearch');
    else test.fail(OWED + 'fileSelector.js does not call shellCreateListSearch');
    const pane = m.make({ face: 'pane', files: function () { return TREE; } });
    await settle();
    // AFTER THE FIRST BUILD (Andy, 2026-10-18): "the initial presentation (when search box is empty) should always be
    // collapsed, as soon as a search string is active, everything is visible (not collapsed)."
    const start = keysOf(pane);
    if (JSON.stringify(start) === JSON.stringify(['js', 'media', 'shell'])) test.check('with no words every folder starts folded: only js, media and shell show');
    else test.fail(OWED + 'with no words the rows are ' + short(start));
    for (const k of ['shell', 'shell/shared', 'shell/shared/js', 'js', 'media']) { press(pane, k); await settle(); }
    const order = keysOf(pane);
    const want = TREE.map(function (f) { return f.relativePath; });
    if (JSON.stringify(order) === JSON.stringify(want)) test.check('pressed open, every row stands in path order');
    else test.fail(OWED + 'unfolded, the rows are ' + short(order));
    const indents = function (k) { return ((rowFor(pane, k) || { html: '' }).html.match(/class="[^"]*\bfile-selector-indent\b/g) || []).length; };
    if (indents('js') === 0 && indents('js/server.js') === 1 && indents('shell/shared/js/listSearch.js') === 3) test.check('one indent per slash: 0, 1 and 3');
    else test.fail(OWED + 'indents: js ' + indents('js') + ', js/server.js ' + indents('js/server.js') + ', listSearch.js ' + indents('shell/shared/js/listSearch.js'));
    const server = rowFor(pane, 'js/server.js') || { html: '', cells: [] };
    const rightCells = server.cells.filter(function (c) { return /text-align:\s*right/.test(c); });
    const bytes = kernel.core.util.formatBytes(2048);
    if (rightCells.some(function (c) { return c.indexOf(bytes) !== -1; }) && rightCells.some(function (c) { return /2026/.test(c); })) test.check('size (' + bytes + ') and modified stand in right-justified cells');
    else test.fail(OWED + 'js/server.js\'s cells: ' + short(server.cells));
    const icon = function (r, glyph) { return r && r.html.indexOf(glyph) !== -1 && r.html.indexOf(glyph) < r.html.indexOf(r.key.slice(r.key.lastIndexOf('/') + 1)); };
    if (icon(server, ICON.CODE) && icon(rowFor(pane, 'media/cat.png'), ICON.VIEW)) test.check('the mimetype icon stands before the name: code for server.js, view for cat.png');
    else test.fail(OWED + 'icons: server.js ' + short(server.html) + ' | cat.png ' + short((rowFor(pane, 'media/cat.png') || {}).html));
    // "Is it possible to have the icons right next to the file name in \"tree\" mode."
    const deep = (rowFor(pane, 'shell/shared/js/listSearch.js') || { html: '' }).html;
    const lastIndent = deep.lastIndexOf('file-selector-indent');
    const iconAt = deep.indexOf(ICON.CODE);
    if (lastIndent !== -1 && iconAt > lastIndent && iconAt < deep.indexOf('listSearch.js')) test.check('in the tree the icon stands after the indent, right before the name');
    else test.fail(OWED + 'the deep row draws ' + short(deep));

    press(pane, 'shell');
    await settle();
    const folded = keysOf(pane);
    press(pane, 'shell');
    await settle();
    const unfolded = keysOf(pane);
    if (folded.indexOf('shell') !== -1 && !folded.some(function (k) { return k.indexOf('shell/') === 0; }) && folded.indexOf('js/server.js') !== -1) test.check('a press on an open folder folds the rows under it, and only those');
    else test.fail(OWED + 'after a press on shell the rows are ' + short(folded));
    if (unfolded.indexOf('shell/shared/js/listSearch.js') !== -1) test.check('a second press unfolds them as they were');
    else test.fail(OWED + 'after a second press the rows are ' + short(unfolded));

    const fresh = m.make({ face: 'pane', files: function () { return TREE; } });
    await settle();
    typeInto(fresh, 'js');
    await settle();
    if (keysOf(fresh).indexOf('shell/shared/js/listSearch.js') !== -1) test.check('with words every match shows, though no folder was ever opened');
    else test.fail(OWED + 'typing js in a folded pane shows ' + short(keysOf(fresh)));

    typeInto(pane, 'listsearch');
    await settle();
    const top = rowsOf(pane)[0] || { key: '', html: '' };
    if (top.key === 'shell/shared/js/listSearch.js') test.check('words rank the rows: listsearch puts shell/shared/js/listSearch.js on top');
    else test.fail(OWED + 'typing listsearch puts on top ' + short(top.key));
    if (top.html.indexOf('shell/shared/js/') !== -1 && /<mark[^>]*>/.test(top.html) && !/file-selector-indent/.test(top.html)) test.check('in list mode a row shows its full path, the match marked, no indent');
    else test.fail(OWED + 'the top row draws ' + short(top.html));
    if (m.asked.length === 0) test.check('nothing asked the node: names and paths are searched in the page');
    else test.fail(OWED + 'the pane asked the node ' + short(m.asked));

    typeInto(pane, '');
    await settle();
    let changes = 0;
    pane.addEventListener('change', function () { changes += 1; });
    press(pane, 'js/server.js');
    await settle();
    if (pane.value === 'js/server.js' && pane.row && pane.row.relativePath === 'js/server.js' && changes === 1) test.check('a press on a file makes it the value, with its row, and fires one change');
    else test.fail(OWED + 'after a press on js/server.js: value ' + short(pane.value) + ', changes ' + changes);

    // ── 4. the dropdown ──
    test.subHeading('4. the dropdown: an inline field, only the pane pops up');
    const drop = m.make({ files: function () { return TREE; } });
    await settle();
    const host = hostOf(drop);
    const html = host ? host.innerHTML : '';
    const fieldTag = (/<button[^>]*id="listsearch-\d+-field"[^>]*>/.exec(html) || [''])[0];
    const popupAt = html.indexOf('-popup"');
    if (fieldTag && !/position:\s*absolute/.test(fieldTag) && popupAt > html.indexOf(fieldTag)) test.check('the field is a plain button in the flow, the popup after it');
    else test.fail(OWED + 'the dropdown\'s markup: ' + short(html));
    const field = partOf(drop, 'field');
    let picked = 0;
    drop.addEventListener('change', function () { picked += 1; });
    if (field) fire(hostOf(drop), 'click', { target: field });
    await settle();
    if (drop.value === '' && picked === 0) test.check('the world: opened, nothing picked yet');
    else test.fail('the world: the dropdown reads ' + short(drop.value) + ', changes ' + picked);
    // "when i click on a folder in the dropdown, it treats that folder as chosen? when it should just expand/collapse it"
    press(drop, 'js');
    await settle();
    // In a browser the pressed row is gone from the page once the rows are drawn again; the click then reaches document.
    (m.doc.listeners.click || []).forEach(function (fn) { fn({ target: { isConnected: false, parentNode: null } }); });
    await settle();
    const popup = partOf(drop, 'popup');
    if (popup && !popup.hidden && drop.value === '' && picked === 0 && keysOf(drop).indexOf('js/server.js') !== -1) test.check('a press on a folder in the dropdown unfolds it: the popup stays open, nothing is picked');
    else test.fail(OWED + 'after a press on the folder js: popup hidden ' + (popup && popup.hidden) + ', value ' + short(drop.value) + ', changes ' + picked + ', rows ' + short(keysOf(drop)));
    press(drop, 'js/server.js');
    await settle();
    if (drop.value === 'js/server.js' && picked === 1) test.check('a press on a file picks it: its value is the path and one change fires');
    else test.fail(OWED + 'the dropdown picked ' + short(drop.value) + ', changes ' + picked);

    // "when i scroll outside of view in the dropdown, the drobdown should make sure that the \"current\" line is visible,
    // and the the current selection is reflected in the dropdown input."
    const keyed = m.make({ files: function () { return TREE; } });
    await settle();
    const kField = partOf(keyed, 'field');
    if (kField) fire(hostOf(keyed), 'click', { target: kField });
    await settle();
    const kList = partOf(keyed, 'list');
    let scrolled = 0;
    if (kList) kList.querySelector = function (sel) { return /current/.test(sel) ? { scrollIntoView: function () { scrolled += 1; } } : null; };
    fire(hostOf(keyed), 'keydown', { key: 'ArrowDown', target: partOf(keyed, 'text') || {} });
    fire(hostOf(keyed), 'keydown', { key: 'ArrowDown', target: partOf(keyed, 'text') || {} });
    await settle();
    const fieldText = kField ? String(kField.innerHTML || kField.textContent || '') : '';
    if (scrolled > 0) test.check('as the keys move the current row, the list scrolls it into view');
    else test.fail(OWED + 'the keys moved the current row; nothing was scrolled into view');
    if (/\bmedia\b/.test(fieldText) && !/choose/.test(fieldText)) test.check('the field shows the current row while the keys move it: media');
    else test.fail(OWED + 'after two downs the field reads ' + short(fieldText));

    // Andy, 2026-10-18: "The home and End keys don't work in the dropdown.", then "after the user uses up and down arrow
    // keys the home and end should belong to the list". The open dropdown's focus is its search box; the downs above
    // moved the current row, so Home and End are the list's now.
    const keyedRows = function () { return keysOf(keyed); };
    fire(hostOf(keyed), 'keydown', { key: 'End', target: partOf(keyed, 'text') || {} });
    await settle();
    const atEnd = (/<tr[^>]*data-key="([^"]*)"[^>]*class="current"/.exec((partOf(keyed, 'list') || { innerHTML: '' }).innerHTML) || [])[1];
    fire(hostOf(keyed), 'keydown', { key: 'Home', target: partOf(keyed, 'text') || {} });
    await settle();
    const atHome = (/<tr[^>]*data-key="([^"]*)"[^>]*class="current"/.exec((partOf(keyed, 'list') || { innerHTML: '' }).innerHTML) || [])[1];
    const kr = keyedRows();
    if (atEnd === kr[kr.length - 1] && atHome === kr[0]) test.check('after the downs, End and Home move the current row to the bottom and the top, from the search box');
    else test.fail(OWED + 'End made ' + short(atEnd) + ' current, Home ' + short(atHome) + '; rows ' + short(kr));
    const before = m.make({ files: function () { return TREE; } });
    await settle();
    const bField = partOf(before, 'field');
    if (bField) fire(hostOf(before), 'click', { target: bField });
    await settle();
    fire(hostOf(before), 'keydown', { key: 'End', target: partOf(before, 'text') || {} });
    await settle();
    // Andy, 2026-10-18: "Give home and end to the list, same as up and down arrow keys."
    const endFirst = (/<tr[^>]*data-key="([^"]*)"[^>]*class="current"/.exec((partOf(before, 'list') || { innerHTML: '' }).innerHTML) || [])[1];
    if (endFirst === 'shell') test.check('End in the search box goes to the bottom with no arrow before it: Home and End are the list\'s');
    else test.fail(OWED + 'End as the first key made ' + short(endFirst) + ' current');
    // "is there a reason the dropdown is constrained wo that narrow width? ... can it be the required with to display
    // everything, constrained by page width?"
    const popTag = (/<div[^>]*id="listsearch-\d+-popup"[^>]*>/.exec((hostOf(keyed) || { innerHTML: '' }).innerHTML) || [''])[0];
    if (/width:\s*max-content/.test(popTag) && /max-width:\s*(calc\()?[0-9.]+vw/.test(popTag)) test.check('the popup takes the width its rows need, up to the page width');
    else test.fail(OWED + 'the popup is drawn ' + short(popTag));

    // Andy, 2026-10-18: "it expands only as wide as the search string plus button need, and neglects the width of the
    // table rows", and to the proposal: "let's try your width solution for the dropdown. max width should still be page
    // width though". The rows' table takes its own width in a popup; a name is never cut short (no label-cell cap).
    const kHtml = (partOf(keyed, 'list') || { innerHTML: '' }).innerHTML;
    const tableTag = (/<table[^>]*>/.exec(kHtml) || [''])[0];
    if (/style="[^"]*width:\s*(auto|max-content)/.test(tableTag)) test.check('in a popup the rows\' table takes its own width');
    else test.fail(OWED + 'the popup\'s table is drawn ' + short(tableTag));
    if (kHtml && !/label-cell/.test(kHtml)) test.check('a file name cell carries no width cap (no label-cell)');
    else test.fail(OWED + 'the name cells still carry label-cell: ' + short(kHtml));

    // "and the default for your filter should be filename only" (the box: words in: names | paths, names the default).
    const named = m.make({ face: 'pane', files: function () { return TREE; } });
    await settle();
    typeInto(named, 'shared');
    await settle();
    const byName = keysOf(named);
    // The strip is drawn with the pane's markup, into the element the list lives in.
    const strip = (hostOf(named) || { innerHTML: '' }).innerHTML;
    if (/data-filter="in"[^>]*data-value="names"/.test(strip) && /data-value="paths"/.test(strip)) test.check('the file list draws one filter, words in: names | paths');
    else test.fail(OWED + 'the filter strip reads ' + short(strip));
    // Every row stands in the shared list, ranked (goal/G29.4): a row the words miss sinks below every row they match.
    const deepFile = 'shell/shared/js/listSearch.js';
    if (byName[0] === 'shell/shared' && byName.indexOf(deepFile) > byName.indexOf('js')) test.check('by default the words match names only: shared ranks the folder shared first, and the files under it no higher than any miss');
    else test.fail(OWED + 'with names, shared ranks ' + short(byName));
    fire(hostOf(named), 'click', { target: { id: '', getAttribute: function (k) { return k === 'data-filter' ? 'in' : k === 'data-value' ? 'paths' : null; }, closest: function () { return null; } } });
    await settle();
    const byPathKeys = keysOf(named);
    if (byPathKeys.indexOf(deepFile) !== -1 && byPathKeys.indexOf(deepFile) < byPathKeys.indexOf('js')) test.check('with paths the words match the whole path: shared ranks shell/shared/js/listSearch.js above the misses');
    else test.fail(OWED + 'with paths, shared ranks ' + short(byPathKeys));

    // "it maybe neccessary for file dropdowns to have a hidden mime-type filter that an app can configure"
    const typed = m.make({ face: 'pane', accept: ['.js'], files: function () { return TREE; } });
    await settle();
    typeInto(typed, 's');
    await settle();
    const tk = keysOf(typed);
    if (tk.indexOf('media/cat.png') === -1 && tk.indexOf('js/server.js') !== -1) test.check('accept [.js] keeps cat.png out and server.js in');
    else test.fail(OWED + 'with accept [.js] the rows are ' + short(tk));
    typeInto(typed, '');
    await settle();
    if (keysOf(typed).indexOf('media') !== -1) test.check('folders always show under a type filter');
    else test.fail(OWED + 'with accept [.js] the folders are ' + short(keysOf(typed)));
  }

  // ── 5. the node's fs.search ──
  test.subHeading('5. the node\'s fs.search ranks words over its own tree');
  const searches = require('../run/js/nodeSearches.js').createNodeSearches({
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
  if (typeof searches.cleanPattern !== 'function' && !/\bcleanPattern\b|\bgradedSearch\b/.test(code(path.join(RUN, 'js', 'nodeSearches.js')))) test.check('the patterns are gone from nodeSearches.js (no cleanPattern, no gradedSearch)');
  else test.fail(OWED + 'nodeSearches.js still holds the patterns');

  // ── 6. what moves and what goes ──
  test.subHeading('6. Files, the text editor and Desk on the shell\'s tree; pathSelector gone');
  const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  const at = function (s) { return index.indexOf(s); };
  if (at('/shell/js/fileSelector.js') > at('/shell/shared/js/listSearch.js') && at('/shell/shared/js/listSearch.js') !== -1) test.check('index.html loads fileSelector.js after listSearch.js');
  else test.fail(OWED + 'index.html: fileSelector.js at ' + at('/shell/js/fileSelector.js') + ', listSearch.js at ' + at('/shell/shared/js/listSearch.js'));
  if (!fs.existsSync(path.join(RUN, 'shell', 'js', 'pathSelector.js')) && at('pathSelector') === -1 && !/createPathSelector/.test(code(path.join(RUN, 'js', 'client', 'shell.js')))) test.check('pathSelector is deleted: its file, its script tag, createPathSelector');
  else test.fail(OWED + 'pathSelector remains: file ' + fs.existsSync(path.join(RUN, 'shell', 'js', 'pathSelector.js')) + ', in index.html ' + (at('pathSelector') !== -1) + ', in shell.js ' + /createPathSelector/.test(code(path.join(RUN, 'js', 'client', 'shell.js'))));
  if (!/contact-selector-face-dropdown\s+\.contact-selector-pane\s*\{[^}]*position:\s*absolute/.test(index)) test.check('index.html no longer floats the contact selector\'s whole pane');
  else test.fail(OWED + 'index.html still floats .contact-selector-face-dropdown .contact-selector-pane');
  const files = code(path.join(RUN, 'shell', 'files', 'files.js'));
  if (/createFileSelector\s*\(/.test(files) && /face\s*:\s*['"]pane['"]/.test(files) && !/<details/.test(files)) test.check('Files is a container for the fileSelector pane');
  else test.fail(OWED + 'files.js: createFileSelector ' + /createFileSelector\s*\(/.test(files) + ', its own <details> tree ' + /<details/.test(files));
  const editor = code(path.join(RUN, 'shell', 'textEditor', 'textEditor.js'));
  if (/createFileSelector\s*\(\s*\{[^}]*accept\s*:/.test(editor) && !/<input[^>]*id="editor-path"/.test(editor)) test.check('the text editor picks its file with the fileSelector dropdown, passing its text types; its path field gone');
  else test.fail(OWED + 'textEditor.js: createFileSelector ' + /createFileSelector\s*\(/.test(editor) + ', path field ' + /<input[^>]*id="editor-path"/.test(editor));
  const desk = code(path.join(RUN, 'shell', 'desk', 'desk.js'));
  if (!/['"]fs\.search['"]/.test(desk)) test.check('Desk\'s plugin finder asks the node nothing: it reads the shell\'s tree');
  else test.fail(OWED + 'shell/desk/desk.js still asks fs.search');
  // The box: "an app's own folder (kernel's scanDirectory) keeps the rows under its folder", from the shell's tree.
  const kern = code(path.join(RUN, 'js', 'kernel.js'));
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
    keyTail: kernel.keyTail,
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
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(path.join(RUN, 'js', 'client', 'shell.js'), 'utf8'))(
    sp, doc, function () {}, { spiritPacket: require('../run/js/client/packet'), spiritLimits: require('../run/js/limits.js') });
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
