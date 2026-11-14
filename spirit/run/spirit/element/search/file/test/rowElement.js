'use strict';

// spirit/run/spirit/element/search/file/test/rowElement.js
// The tests of spirit/element/search/file/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G30.18, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element and the page's data set are real, and so is the fs family's data.js (goal/G41.28), loaded as a
// page's spirit.cacheManager('fs') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.homeNode); the node's fs family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let asked, required, D, managers, E, F, el, hosts, page, node, put, del, row;
const cmd = function (c) { return { id: 'spirit.fs', data: { command: c } }; };
const NO_F = 'no file tree on the page: the fs family\'s cache manager never put one there';
const NO_ROW = 'no row element registered';
const NO_EL = 'no row was made';
const NO_PAGE = 'no page: the world of the browser failed';
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
function cellsOf(x) { const c = {}; (x.cells() || []).forEach(function (k) { c[k.name] = k.html; }); return c; }
function noRow() { if (!F || typeof F.file !== 'function') return NO_F; if (!E.search.file.rowElement || typeof E.search.file.rowElement.create !== 'function') return NO_ROW; return ''; }

test.run('the world: the row runs on a bare window, the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/file/rowElement.js is not there';
  asked = [];
  required = [];
  const fsFamily = {
    delete: function (a) { asked.push({ verb: 'fs.delete', args: a }); return Promise.resolve({ ok: true }); },
    stat: function (a) { asked.push({ verb: 'fs.stat', args: a }); return Promise.resolve({ size: 9 }); },
    annotations: function (a) { asked.push({ verb: 'fs.annotations', args: a }); return Promise.resolve({ note: 'n' }); },
  };
  const STANDS = { 'spirit/element/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    // What says a file's kind (goal/G43.17), the real one, should the row ask it.
    'spirit/element/fstat.js': function () { const f = path.join(RUN, 'spirit', 'element', 'fstat.js'); if (fs.existsSync(f)) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: 'fstat.js' }); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, formatBytes: function (n) { return n + ' Bytes'; },
    ready: Promise.resolve({ fs: fsFamily }), fs: fsFamily, element: {},
    // The page's table of types, as spirit.js puts it on the spirit object.
    MIME_TYPES: { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' } } };
  global.spirit = global.window.spirit;
  // goal/G43.32: every element places itself by installSpiritElement (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(global.window.spirit);
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  D = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  F = ((global.window.spirit.data || {}).fs || {}).data;
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
test.run('it requires the shared row element, and no data script', 0.2, function () {
  if (!required) return 'the row never ran: the world failed';
  return required.indexOf('spirit/element/rowElement.js') !== -1 && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(required);
}, test.limit.quick);
test.run('it loads the fs family\'s cache manager, which puts ((spirit.data || {}).fs || {}).data on the page', 0.2, function () {
  if (!managers) return 'the row never ran: the world failed';
  return managers.indexOf('fs') !== -1 && F && typeof F.file === 'function' ? true : 'managers: ' + short(managers);
}, test.limit.quick);
test.run('it registers spirit.element.spirit.element.search.file.rowElement.create', 0.2, function () {
  if (!F || typeof F.file !== 'function') return NO_F;
  return E.search.file.rowElement && typeof E.search.file.rowElement.create === 'function' ? true : 'elements: ' + short(Object.keys(E));
}, test.limit.quick);

// what the fs-watcher's stream means for data.files, in the type's own element (goal/G41.16)
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": the file tree's
// translation, spirit/element/search/file/data.js until G41.16, was this element's (G30.18), and is since goal/G41.28 the
// fs family's cache manager's, which it loads.
test.run('before the tree is whole, data.files is not ready', 0.2, function () {
  if (noRow()) return noRow();
  return F.ready() !== true ? true : 'ready: ' + short(F.ready());
}, test.limit.quick);
test.run('a createDirectory is a folder at files/<path>', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob(cmd({ op: 'createDirectory', path: 'docs' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/core.js', size: 7, core: true }));
  return F.file('docs') && F.file('docs').kind === 'folder' ? true : 'files/docs: ' + short(F.file('docs'));
}, test.limit.quick);
test.run('a createFile is a file with its size and its time, core false', 0.2, function () {
  if (noRow()) return noRow();
  const a = F.file('docs/a.md');
  return a && a.kind === 'file' && a.size === 5 && a.modified === '2030-01-01T00:00:00Z' && a.core === false ? true : 'files/docs/a.md: ' + short(a);
}, test.limit.quick);
test.run('the node\'s word that a file is core is kept', 0.2, function () {
  if (noRow()) return noRow();
  return F.file('docs/core.js') && F.file('docs/core.js').core === true ? true : 'files/docs/core.js: ' + short(F.file('docs/core.js'));
}, test.limit.quick);
test.run('treeComplete: data.files is ready', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob({ id: 'spirit.fs', data: { treeComplete: true } });
  return F.ready() === true ? true : 'ready: ' + short(F.ready());
}, test.limit.quick);
test.run('a change by path sets the file again, its kind kept', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob(cmd({ op: 'changeFile', path: 'docs/a.md', size: 6 }));
  return F.file('docs/a.md') && F.file('docs/a.md').size === 6 && F.file('docs/a.md').kind === 'file' ? true : 'files/docs/a.md: ' + short(F.file('docs/a.md'));
}, test.limit.quick);
test.run('a deleteFile takes that file out', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob(cmd({ op: 'deleteFile', path: 'docs/a.md' }));
  return F.file('docs/a.md') === null && F.file('docs') ? true : 'files: ' + short(Object.keys(F.files()));
}, test.limit.quick);
test.run('a deleteDirectory takes the folder out, and everything under it', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob(cmd({ op: 'createFile', path: 'docs/sub/x.txt', size: 1 }));
  D.takeJob(cmd({ op: 'deleteDirectory', path: 'docs' }));
  return !Object.keys(F.files()).some(function (k) { return k === 'docs' || k.indexOf('docs/') === 0; }) ? true : 'files: ' + short(Object.keys(F.files()));
}, test.limit.quick);
test.run('another job\'s command, or a command with no path, writes nothing', 0.2, function () {
  if (noRow()) return noRow();
  const before = JSON.stringify(F.files());
  D.takeJob({ id: 'j2', type: 'relay-presence', data: { command: { op: 'createFile', path: 'nope.txt' } } });
  D.takeJob(cmd({ op: 'createFile' }));
  return JSON.stringify(F.files()) === before ? true : 'files: ' + short(Object.keys(F.files()));
}, test.limit.quick);

// one file or folder as a row
test.run('a row element of kind file, keyed by its path, its facts from data.files', 0.2, function () {
  if (noRow()) return noRow();
  D.takeJob(cmd({ op: 'createFile', path: 'web/page<1>.html', size: 2048, modified: '2030-01-02T03:04:00Z', core: false }));
  el = E.search.file.rowElement.create({ path: 'web/page<1>.html' });
  return el.kind === 'file' && el.key === 'web/page<1>.html' && el.row.size === 2048 && el.row.name === 'page<1>.html' ? true : 'el: ' + short({ kind: el.kind, key: el.key, row: el.row });
}, test.limit.quick);
test.run('its fields are name, size and changed', 0.2, function () {
  if (!el) return NO_EL;
  return JSON.stringify(Object.keys(cellsOf(el))) === '["name","size","changed"]' ? true : 'fields: ' + short(Object.keys(cellsOf(el)));
}, test.limit.quick);
test.run('the name cell: a text file\'s icon 📜 (goal/G43.17), where it lives, and its name, escaped', 0.2, function () {
  if (!el) return NO_EL;
  const cells = cellsOf(el);
  return /📜/.test(cells.name) && /page&lt;1>\.html/.test(cells.name) && /web\//.test(cells.name) && !/<1>/.test(cells.name) ? true : 'name: ' + short(cells.name);
}, test.limit.quick);
test.run('its size through formatBytes, its time to the minute', 0.2, function () {
  if (!el) return NO_EL;
  const cells = cellsOf(el);
  return cells.size === '2048 Bytes' && cells.changed === '2030-01-02 03:04' ? true : 'cells: ' + short(cells);
}, test.limit.quick);
test.run('a folder: its icon, and no size', 0.2, function () {
  if (noRow()) return noRow();
  const fc = cellsOf(E.search.file.rowElement.create({ path: 'web', kind: 'folder' }));
  return /📁/.test(fc.name) && fc.size === '' ? true : 'folder: ' + short(fc);
}, test.limit.quick);
// goal/G43.17, the box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of unknown kind, ❔, in
// place of today's 📄; a file gone stays ❌".
test.run('a file\'s icon by its kind: text 📜, image 🌇, video 📹, audio 🔊, any other ❔, none 📄', 0.2, async function () {
  if (noRow()) return noRow();
  await settle();
  const KINDS = { 'web/a.txt': '📜', 'web/a.png': '🌇', 'web/a.mp4': '📹', 'web/a.mp3': '🔊', 'web/a.zzq': '❔' };
  const wrong = Object.keys(KINDS).filter(function (p) { const k = cellsOf(E.search.file.rowElement.create({ path: p })); return k.name.indexOf(KINDS[p]) === -1 || /📄/.test(k.name); });
  return !wrong.length ? true : 'wrong: ' + short(wrong);
}, test.limit.quick);
test.run('a core file\'s name in yellow, said core: write-protected', 0.2, function () {
  if (noRow()) return noRow();
  const cc = cellsOf(E.search.file.rowElement.create({ path: 'spirit/spirit.js', core: true }));
  return /spirit-core/.test(cc.name) && /core: write-protected/.test(cc.name) ? true : 'core: ' + short(cc.name);
}, test.limit.quick);

// it repaints from data.files
test.run('its path in data.files changed, the row repaints its size', 0.2, async function () {
  if (!el) return NO_EL;
  hosts = { name: { innerHTML: '' }, size: { innerHTML: '' }, changed: { innerHTML: '' } };
  el.mount(hosts);
  D.takeJob(cmd({ op: 'changeFile', path: 'web/page<1>.html', size: 4096, modified: '2030-01-02T03:04:00Z', core: false }));
  await settle();
  return el.row.size === 4096 && hosts.size.innerHTML === '4096 Bytes' ? true : 'row: ' + short(el.row) + ', size ' + short(hosts.size.innerHTML);
}, test.limit.quick);
test.run('its path gone from data.files, the row is marked gone', 0.2, async function () {
  if (!el || !hosts) return NO_EL;
  D.takeJob(cmd({ op: 'deleteFile', path: 'web/page<1>.html' }));
  await settle();
  return el.row.gone === true && /❌/.test(hosts.name.innerHTML) ? true : 'row: ' + short(el.row);
}, test.limit.quick);

// its actions ask, and paint nothing
test.run('open hands its path to the viewer the page gave', 0.2, async function () {
  if (!el) return NO_EL;
  const opened = [];
  await el.act('open', { open: function (p) { opened.push(p); } });
  return opened.length === 1 && opened[0] === 'web/page<1>.html' ? true : 'opened: ' + short(opened);
}, test.limit.quick);
test.run('with no viewer, the text launcher', 0.2, async function () {
  if (!el) return NO_EL;
  const launched = [];
  await el.act('open', { launchApp: function (app, a) { launched.push([app, a]); } });
  return launched.length === 1 && launched[0][0] === 'text-file-launcher' && launched[0][1].path === 'web/page<1>.html' ? true : 'launched: ' + short(launched);
}, test.limit.quick);
test.run('remove asks fs.delete { path } through the spirit object', 0.2, async function () {
  if (!el) return NO_EL;
  await el.act('remove', {});
  return asked.some(function (c) { return c.verb === 'fs.delete' && c.args.path === 'web/page<1>.html'; }) ? true : 'asked: ' + short(asked);
}, test.limit.quick);
test.run('expandInfo asks fs.stat, and no annotations (goal/G43.20: the node\'s only)', 0.2, async function () {
  if (!el) return NO_EL;
  const info = await el.expandInfo();
  return info && info.stat && !('annotations' in info) && asked.some(function (c) { return c.verb === 'fs.stat'; }) && !asked.some(function (c) { return c.verb === 'fs.annotations'; }) ? true : 'info: ' + short(info) + ', asked ' + short(asked);
}, test.limit.quick);

// ── goal/G43.4: THE RESERVED WORDS IN COLOUR, IN A REAL BROWSER ───────────────────────────────────
// Real rows on a scratch node (./rowElement-words.html), spirit/word.js and the node's own file stream under them.
// goal/G43.18, Andy: "file app: please change the green colored paths/files in light blue instead.", and then "ALL, ONLY
// REPLACE RED WITH LIGHT PURPLE, KEEP THE BLUE!!!!!!!!!!!!!!!!": a word that holds is light blue, one that does not is light
// purple, and no red is left.
// goal/G43.4 and G43.18: a path element is light blue where word and spirit object agree, red where they disagree
test.after(function () {
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
});
test.run('the world: a scratch node with its DEBUG on, and Chrome on the words page', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  node = await H.scratchNode();
  // Written on the scratch node's disk: the node refuses fs.save under spirit/, and its fs-watcher hears the disk.
  put = function (rel, text) { const f = path.join(node.root, 'spirit', 'run', rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  del = function (rel) { fs.rmSync(path.join(node.root, 'spirit', 'run', rel), { force: true }); };
  const p = node.up && node.debug ? await H.chromePage(chrome) : null;
  if (p && !p.error) page = p; else { if (p && p.kid) page = p; return p ? p.error : 'the scratch node did not come up with its DEBUG on'; }
  await page.send('Page.navigate', { url: node.base + '/DEBUG/spirit/element/search/file/test/rowElement-words.html' });
  await H.until(function () { return page.evaluate('typeof window.ready === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  await page.evaluate('window.ready()');
  row = async function (p, kind) { try { return JSON.parse(await page.evaluate('window.row(' + JSON.stringify(p) + ', ' + JSON.stringify(kind || 'folder') + ')')); } catch (e) { return { threw: String(e) }; } };
  return true;
}, test.limit.slow);
test.run('spirit/app: reserved, and the spirit object holds spirit.app: light blue', 0.2, async function () {
  if (!row) return NO_PAGE;
  const app = await row('spirit/app');
  return app.app === 'lightblue' ? true : 'spirit/app: ' + short(app);
}, test.limit.slow);
test.run('its path element spirit: always the colour of a word that holds, light blue', 0.2, async function () {
  if (!row) return NO_PAGE;
  const app = await row('spirit/app');
  return app.spirit === 'lightblue' ? true : 'spirit/app: ' + short(app);
}, test.limit.slow);
test.run('spirit/element: light blue', 0.2, async function () {
  if (!row) return NO_PAGE;
  const element = await row('spirit/element');
  return element.element === 'lightblue' ? true : 'spirit/element: ' + short(element);
}, test.limit.slow);
// Andy's commit d278c3e6, "identity": contact is no hard-coded word now.
test.run('spirit/contact: a word (word.js), and the page holds spirit.contact: light blue', 0.2, async function () {
  if (!row) return NO_PAGE;
  const contact = await row('spirit/contact');
  return contact.contact === 'lightblue' ? true : 'spirit/contact: ' + short(contact);
}, test.limit.slow);
test.run('a file inside: its path elements carry the colours too, the file api.js, a word with no spirit.app.api, light purple', 0.2, async function () {
  if (!row) return NO_PAGE;
  const inside = await row('spirit/app/api.js', 'file');
  return inside.app === 'lightblue' && inside.spirit === 'lightblue' && inside['api.js'] === 'lightpurple' ? true : 'spirit/app/api.js: ' + short(inside);
}, test.limit.slow);
// A folder no word names stays plain (goal/G43.32: spirit/jobs, plain before, is spirit/job, one of word.js's words, below).
test.run('spirit/client: not reserved: no colour', 0.2, async function () {
  if (!row) return NO_PAGE;
  const plain = await row('spirit/client');
  return plain.client === 'none' ? true : 'spirit/client: ' + short(plain);
}, test.limit.slow);
test.run('spirit/hub.js: not reserved: no colour', 0.2, async function () {
  if (!row) return NO_PAGE;
  const hub = await row('spirit/hub.js', 'file');
  return hub['hub.js'] === 'none' ? true : 'spirit/hub.js: ' + short(hub);
}, test.limit.slow);
test.run('outside spirit/ no word holds: shell/app has no colour', 0.2, async function () {
  if (!row) return NO_PAGE;
  const elsewhere = await row('shell/app', 'folder');
  return elsewhere.app === 'none' ? true : 'shell/app: ' + short(elsewhere);
}, test.limit.slow);
test.run('spirit/job: reserved, a folder, and no spirit.job: light purple, where red was', 0.2, async function () {
  if (!row) return NO_PAGE;
  put('spirit/job/keep.txt', 'a folder for the word job');
  const job = await row('spirit/job');
  del('spirit/job/keep.txt');
  return job.job === 'lightpurple' ? true : 'spirit/job: ' + short(job);
}, test.limit.slow);

// goal/G43.4: "the colors will follow word.json changes live."
test.run('the folder spirit/app/thing, no word: no colour', 0.2, async function () {
  if (!row) return NO_PAGE;
  put('spirit/app/thing/keep.txt', 'a folder');
  const before = await row('spirit/app/thing');
  return before.thing === 'none' ? true : 'spirit/app/thing: ' + short(before);
}, test.limit.slow);
test.run('word.json gains the word: the same row goes light purple, with no reload: no spirit.app.thing', 0.2, async function () {
  if (!row) return NO_PAGE;
  put('spirit/app/word.json', JSON.stringify({ thing: true }));
  const red = await row('spirit/app/thing');
  return red.thing === 'lightpurple' ? true : 'spirit/app/thing: ' + short(red);
}, test.limit.slow);
test.run('with spirit.app.thing on the object: light blue', 0.2, async function () {
  if (!row) return NO_PAGE;
  await page.evaluate('window.setObject(true); window.fresh("spirit/app/thing")');
  const blue = await row('spirit/app/thing');
  return blue.thing === 'lightblue' ? true : 'spirit/app/thing: ' + short(blue);
}, test.limit.slow);
test.run('word.json gone: the row loses its colour, with no reload', 0.2, async function () {
  if (!row) return NO_PAGE;
  await page.evaluate('window.setObject(false)');
  del('spirit/app/word.json');
  const gone = await row('spirit/app/thing');
  del('spirit/app/thing/keep.txt');
  return gone.thing === 'none' ? true : 'spirit/app/thing: ' + short(gone);
}, test.limit.slow);
