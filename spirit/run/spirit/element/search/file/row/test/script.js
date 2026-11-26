'use strict';

// spirit/run/spirit/element/search/file/row/test/script.js
// The tests of spirit/element/search/file/row/script.js, and of no other module (spec: ./script.md; goal/G30.18, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element and the page's data set are real, and so is the fs family's data.js (goal/G41.28), brought by the fs
// family's api.js the row requires, the page's node known as spirit.startPage makes it known (spirit.nodeFacts.key, then
// data.homeNode); the node's fs family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'row', 'script.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let asked, required, loaded, D, E, F, el, hosts, page, node, put, del, row;
const cmd = function (c) { return { id: 'spirit.fs', data: { command: c } }; };
const H = LOADER.requireScript('spirit/test/headLessChrome.js');
function cellsOf(x) { const c = {}; (x.cells() || []).forEach(function (k) { c[k.name] = k.html; }); return c; }
// True when there is no file tree on the page or no row element registered.
function noRow() { return !F || typeof F.file !== 'function' || !E.search.file.row || typeof E.search.file.row.create !== 'function'; }

test.run('the row runs on a bare window, with the page\'s real data set', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  asked = [];
  required = [];
  const fsFamily = {
    delete: function (a) { asked.push({ verb: 'fs.delete', args: a }); return Promise.resolve({ ok: true }); },
    stat: function (a) { asked.push({ verb: 'fs.stat', args: a }); return Promise.resolve({ size: 9 }); },
    annotations: function (a) { asked.push({ verb: 'fs.annotations', args: a }); return Promise.resolve({ note: 'n' }); },
  };
  // ITS PARTS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
  // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the real shared row element and the real fstat, each run as the page's loader runs it and its answer handed
  // on; any other part (the icon, word) answers an empty object.
  const STANDS = { 'spirit/element/row/script.js': function () { return PAGE_LOAD.runAsPage(path.join(RUN, 'spirit', 'element', 'row', 'script.js')); },
    // What says a file's kind (goal/G43.17), the real one, should the row ask it.
    'spirit/element/fstat/script.js': function () { const f = path.join(RUN, 'spirit', 'element', 'fstat', 'script.js'); return fs.existsSync(f) ? PAGE_LOAD.runAsPage(f) : {}; } };
  const made = {};
  // escapeHtml and formatBytes are the spirit object's own: spirit.js fills this object with them as the element helper
  // loads it, as on a page.
  // What readyPromise answers holds no branch (goal/G49.6); the fs branch is answered by its api.js path, below.
  global.window = { spirit: { readyPromise: Promise.resolve({}), element: {},
    // The page's table of types, as spirit.js puts it on the spirit object.
    MIME_TYPES: { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' } } };
  global.spirit = global.window.spirit;
  // Handed over from the real spirit object (goal/G47.1, Andy's red 'its size is shown through formatBytes'): spirit.js may be
  // loaded already in this process (the test reporter loads it), and then a later require of it hands back its cached copy
  // and fills nothing here, so the row fell back to "2048 B".
  (function () { const real = require(path.join(RUN, 'spirit', 'script.js')); ['formatBytes', 'escapeHtml'].forEach(function (k) { if (typeof global.window.spirit[k] !== 'function' && typeof real[k] === 'function') global.window.spirit[k] = real[k]; }); }());
  // goal/G43.32: every element places itself by installSpiritElement (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data', 'script.js'), 'utf8'), { filename: 'data.js' });
  D = global.window.spirit.required.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.nodeFacts = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // A branch's api.js brings its companion data.js, as the real api.js does (goal/G47.1: "every api.js requires it's
  // companion data.js"): the stand-in runs that data.js once, attaching itself to the data set. A data.js asked for
  // directly is only recorded.
  const ran = {};
  // A BRANCH OF THE NEW SHAPE (goal/G49.15, step 3): its script.js brings its client/script.js, the moved data.js, as fs does.
  const dataScript = function (p) {
    const old = (/^(spirit\/(?:app\/)?[^/]+)\/api\.js$/.exec(p) || [])[1];
    const neu = (/^(spirit\/(?:app\/)?[^/]+)\/script\.js$/.exec(p) || [])[1];
    const f = old ? path.join(RUN, old, 'data.js') : neu ? path.join(RUN, neu, 'client', 'script.js') : '';
    if (f && !ran[f] && fs.existsSync(f)) { ran[f] = true; PAGE_LOAD.runAsPage(f); }
  };
  global.window.spirit.requireScript = function (p) { required.push(String(p)); dataScript(String(p)); if (p === 'spirit/fs/script.js') return Promise.resolve(fsFamily); if (!STANDS[p]) return Promise.resolve({}); if (!(p in made)) made[p] = STANDS[p](); return Promise.resolve(made[p]); };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  F = ((global.window.spirit.required.spirit.data || {}).fs || {}).data;
  // What the file required as it ran, kept apart from what the runner asks of the page later.
  loaded = required.slice();
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
test.run('it requires the shared row element, and no data script', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/element/row/script.js') !== -1 && !loaded.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('it requires the fs branch\'s interface, spirit/fs/script.js, whose client/script.js puts the fs branch\'s data on the page', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/fs/script.js') !== -1 && F && typeof F.file === 'function' ? true : false;
}, test.limit.quick);
test.run('it registers its create on spirit.required at its own path', 0.2, function () {
  if (!F || typeof F.file !== 'function') return false;
  return E.search.file.row && typeof E.search.file.row.create === 'function' ? true : false;
}, test.limit.quick);

// what the fs-watcher's stream means for data.files, in the type's own element (goal/G41.16)
// Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": the file tree's
// translation, spirit/element/search/file/data.js until G41.16, was this element's (G30.18), and is since goal/G41.28 the
// fs family's data.js's, which the fs api.js it requires brings.
test.run('before the tree is whole, data.files is not ready', 0.2, function () {
  if (noRow()) return false;
  return F.ready() !== true ? true : false;
}, test.limit.quick);
test.run('a createDirectory is a folder at files/<path>', 0.2, function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'createDirectory', path: 'docs' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/core.js', size: 7, core: true }));
  return F.file('docs') && F.file('docs').kind === 'folder' ? true : false;
}, test.limit.quick);
test.run('a createFile is a file with its size and its time, core false', 0.2, function () {
  if (noRow()) return false;
  const a = F.file('docs/a.md');
  return a && a.kind === 'file' && a.size === 5 && a.modified === '2030-01-01T00:00:00Z' && a.core === false ? true : false;
}, test.limit.quick);
test.run('the node\'s word that a file is core is kept', 0.2, function () {
  if (noRow()) return false;
  return F.file('docs/core.js') && F.file('docs/core.js').core === true ? true : false;
}, test.limit.quick);
test.run('after treeComplete, data.files is ready', 0.2, function () {
  if (noRow()) return false;
  D.takeJob({ id: 'spirit.fs', data: { treeComplete: true } });
  return F.ready() === true ? true : false;
}, test.limit.quick);
test.run('a change by path sets the file again, its kind kept', 0.2, function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'changeFile', path: 'docs/a.md', size: 6 }));
  return F.file('docs/a.md') && F.file('docs/a.md').size === 6 && F.file('docs/a.md').kind === 'file' ? true : false;
}, test.limit.quick);
test.run('a deleteFile takes that file out', 0.2, function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'deleteFile', path: 'docs/a.md' }));
  return F.file('docs/a.md') === null && F.file('docs') ? true : false;
}, test.limit.quick);
test.run('a deleteDirectory takes the folder out, and everything under it', 0.2, function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'createFile', path: 'docs/sub/x.txt', size: 1 }));
  D.takeJob(cmd({ op: 'deleteDirectory', path: 'docs' }));
  return !Object.keys(F.files()).some(function (k) { return k === 'docs' || k.indexOf('docs/') === 0; }) ? true : false;
}, test.limit.quick);
test.run('another job\'s command, or a command with no path, writes nothing', 0.2, function () {
  if (noRow()) return false;
  const before = JSON.stringify(F.files());
  D.takeJob({ id: 'j2', type: 'relay-presence', data: { command: { op: 'createFile', path: 'nope.txt' } } });
  D.takeJob(cmd({ op: 'createFile' }));
  return JSON.stringify(F.files()) === before ? true : false;
}, test.limit.quick);

// one file or folder as a row
test.run('it makes a row element of kind file, keyed by its path, with its facts from data.files', 0.2, function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'createFile', path: 'web/page<1>.html', size: 2048, modified: '2030-01-02T03:04:00Z', core: false }));
  el = E.search.file.row.create({ path: 'web/page<1>.html' });
  return el.kind === 'file' && el.key === 'web/page<1>.html' && el.row.size === 2048 && el.row.name === 'page<1>.html' ? true : false;
}, test.limit.quick);
test.run('its fields are name, size and changed', 0.2, function () {
  if (!el) return false;
  return JSON.stringify(Object.keys(cellsOf(el))) === '["name","size","changed"]' ? true : false;
}, test.limit.quick);
test.run('the name cell shows a text file\'s icon 📜, where it lives, and its name, escaped', 0.2, function () {
  if (!el) return false;
  const cells = cellsOf(el);
  return /📜/.test(cells.name) && /page&lt;1&gt;\.html/.test(cells.name) && /web\//.test(cells.name) && !/<1>/.test(cells.name) ? true : false;
}, test.limit.quick);
test.run('its size is shown through formatBytes, and its time to the minute', 0.2, function () {
  if (!el) return false;
  const cells = cellsOf(el);
  return cells.size === '2 KB' && cells.size === global.window.spirit.formatBytes(2048) && cells.changed === '2030-01-02 03:04' ? true : false;
}, test.limit.quick);
test.run('a folder shows its icon and no size', 0.2, function () {
  if (noRow()) return false;
  const fc = cellsOf(E.search.file.row.create({ path: 'web', kind: 'folder' }));
  return /📁/.test(fc.name) && fc.size === '' ? true : false;
}, test.limit.quick);
// goal/G43.17, the box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of unknown kind, ❔, in
// place of today's 📄; a file gone stays ❌".
test.run('a file\'s icon follows its kind: text 📜, image 🌇, video 📹, audio 🔊, any other ❔, none 📄', 0.2, async function () {
  if (noRow()) return false;
  await settle();
  const KINDS = { 'web/a.txt': '📜', 'web/a.png': '🌇', 'web/a.mp4': '📹', 'web/a.mp3': '🔊', 'web/a.zzq': '❔' };
  const wrong = Object.keys(KINDS).filter(function (p) { const k = cellsOf(E.search.file.row.create({ path: p })); return k.name.indexOf(KINDS[p]) === -1 || /📄/.test(k.name); });
  return !wrong.length ? true : false;
}, test.limit.quick);
test.run('a core file\'s name is yellow and said to be core, write-protected', 0.2, function () {
  if (noRow()) return false;
  const cc = cellsOf(E.search.file.row.create({ path: 'spirit/script.js', core: true }));
  return /spirit-core/.test(cc.name) && /core: write-protected/.test(cc.name) ? true : false;
}, test.limit.quick);

// it repaints from data.files
test.run('when its path in data.files changes, the row repaints its size', 0.2, async function () {
  if (!el) return false;
  hosts = { name: { innerHTML: '' }, size: { innerHTML: '' }, changed: { innerHTML: '' } };
  el.mount(hosts);
  D.takeJob(cmd({ op: 'changeFile', path: 'web/page<1>.html', size: 4096, modified: '2030-01-02T03:04:00Z', core: false }));
  await settle();
  return el.row.size === 4096 && hosts.size.innerHTML === '4 KB' ? true : false;
}, test.limit.quick);
// goal/G47.1, Andy: "the file row does listen and DOES use the api, AND it fails to remove itself", then "all, go, fix
// the fucking file row.": a file deleted takes its row out of the list, with no search and no redraw. The row is mounted
// as the list mounts it (spirit/element/search/script.js rowNode): a cell per field, in one <tr>, in the list's body.
test.run('when its file is deleted, the row takes itself out of the list, with no search and no redraw', 0.2, async function () {
  if (noRow()) return false;
  D.takeJob(cmd({ op: 'createFile', path: 'web/gone.txt', size: 1 }));
  const body = { kids: [], removeChild: function (c) { const i = body.kids.indexOf(c); if (i !== -1) body.kids.splice(i, 1); c.parentNode = null; return c; } };
  const tr = { tagName: 'TR', parentNode: body, getAttribute: function (a) { return a === 'data-key' ? 'web/gone.txt' : null; },
    remove: function () { if (tr.parentNode) tr.parentNode.removeChild(tr); } };
  body.kids.push(tr);
  const td = function (field) { return { tagName: 'TD', innerHTML: '', parentNode: tr, getAttribute: function (a) { return a === 'data-field' ? field : null; },
    closest: function (s) { return /tr/i.test(s) ? tr : null; } }; };
  const row = E.search.file.row.create({ path: 'web/gone.txt' });
  row.mount({ name: td('name'), size: td('size'), changed: td('changed') });
  if (body.kids.indexOf(tr) === -1) return false;
  D.takeJob(cmd({ op: 'deleteFile', path: 'web/gone.txt' }));
  await settle();
  return body.kids.indexOf(tr) === -1 && tr.parentNode == null ? true : false;
}, test.limit.quick);

// its actions ask, and paint nothing
test.run('open hands its path to the viewer the page gave', 0.2, async function () {
  if (!el) return false;
  const opened = [];
  await el.act('open', { open: function (p) { opened.push(p); } });
  return opened.length === 1 && opened[0] === 'web/page<1>.html' ? true : false;
}, test.limit.quick);
test.run('with no viewer, open hands its path to the text launcher', 0.2, async function () {
  if (!el) return false;
  const launched = [];
  await el.act('open', { launchApp: function (app, a) { launched.push([app, a]); } });
  return launched.length === 1 && launched[0][0] === 'text-file-launcher' && launched[0][1].path === 'web/page<1>.html' ? true : false;
}, test.limit.quick);
test.run('remove asks fs.delete { path } through the spirit object', 0.2, async function () {
  if (!el) return false;
  await el.act('remove', {});
  return asked.some(function (c) { return c.verb === 'fs.delete' && c.args.path === 'web/page<1>.html'; }) ? true : false;
}, test.limit.quick);
test.run('expandInfo asks fs.stat, and no annotations, which are the node\'s only', 0.2, async function () {
  if (!el) return false;
  const info = await el.expandInfo();
  return info && info.stat && !('annotations' in info) && asked.some(function (c) { return c.verb === 'fs.stat'; }) && !asked.some(function (c) { return c.verb === 'fs.annotations'; }) ? true : false;
}, test.limit.quick);

// ── goal/G43.4: THE RESERVED WORDS IN COLOUR, IN A REAL BROWSER ───────────────────────────────────
// Real rows on a scratch node (./row-words.html), spirit/word/script.js and the node's own file stream under them.
// goal/G43.18, Andy: "file app: please change the green colored paths/files in light blue instead.", and then "ALL, ONLY
// REPLACE RED WITH LIGHT PURPLE, KEEP THE BLUE!!!!!!!!!!!!!!!!": a word that holds is light blue, one that does not is light
// purple, and no red is left.
// goal/G43.4 and G43.18: a path element is light blue where word and spirit object agree, red where they disagree
test.after(function () {
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* left */ }
});
test.run('a scratch node comes up with its DEBUG on, and Chrome opens the words page', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return false;
  node = await H.scratchNode();
  // Written on the scratch node's disk: the node refuses fs.save under spirit/, and its fs-watcher hears the disk.
  put = function (rel, text) { const f = path.join(node.root, 'spirit', 'run', rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  del = function (rel) { fs.rmSync(path.join(node.root, 'spirit', 'run', rel), { force: true }); };
  const p = node.up && node.debug ? await H.chromePage(chrome) : null;
  if (p && !p.error) page = p; else { if (p && p.kid) page = p; return false; }
  await page.send('Page.navigate', { url: node.base + '/DEBUG/spirit/element/search/file/row/test/row-words.html' });
  await H.until(function () { return page.evaluate('typeof window.ready === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
  await page.evaluate('window.ready()');
  // The families these rows are coloured by are on the page the normal way: spirit.app and spirit.contact, each by
  // requiring its api.js (which brings its data.js). This page requires nothing else, and a family no file required is
  // not on the spirit object.
  await page.evaluate('Promise.all([window.spirit.requireScript("spirit/app/script.js"), window.spirit.requireScript("spirit/contact/api.js")]).then(function () { return true; }, function () { return false; })');
  row = async function (p, kind) { try { return JSON.parse(await page.evaluate('window.row(' + JSON.stringify(p) + ', ' + JSON.stringify(kind || 'folder') + ')')); } catch (e) { return {}; } };
  return true;
}, test.limit.slow);
test.run('spirit/app, reserved and held by the spirit object as spirit.app, is light blue', 0.2, async function () {
  if (!row) return false;
  const app = await row('spirit/app');
  return app.app === 'lightblue' ? true : false;
}, test.limit.slow);
test.run('its path element spirit always has the colour of a word that holds, light blue', 0.2, async function () {
  if (!row) return false;
  const app = await row('spirit/app');
  return app.spirit === 'lightblue' ? true : false;
}, test.limit.slow);
test.run('spirit/element is light blue', 0.2, async function () {
  if (!row) return false;
  const element = await row('spirit/element');
  return element.element === 'lightblue' ? true : false;
}, test.limit.slow);
// Andy's commit d278c3e6, "identity": contact is no hard-coded word now.
test.run('spirit/contact, a word by its word.js that the page holds as spirit.contact, is light blue', 0.2, async function () {
  if (!row) return false;
  const contact = await row('spirit/contact');
  return contact.contact === 'lightblue' ? true : false;
}, test.limit.slow);
test.run('a file inside carries the colours on its path elements too, and the file api.js, a word with no spirit.app.api, is light purple', 0.2, async function () {
  if (!row) return false;
  const inside = await row('spirit/app/script.js', 'file');
  return inside.app === 'lightblue' && inside.spirit === 'lightblue' && inside['api.js'] === 'lightpurple' ? true : false;
}, test.limit.slow);
// A folder no word names stays plain (goal/G43.32: spirit/jobs, plain before, is spirit/job, one of word.js's words, below).
test.run('spirit/client is not reserved and has no colour', 0.2, async function () {
  if (!row) return false;
  const plain = await row('spirit/client');
  return plain.client === 'none' ? true : false;
}, test.limit.slow);
test.run('spirit/hub/script.js is not reserved and has no colour', 0.2, async function () {
  if (!row) return false;
  const hub = await row('spirit/hub/script.js', 'file');
  return hub['hub.js'] === 'none' ? true : false;
}, test.limit.slow);
test.run('outside spirit/ no word holds, so shell/app has no colour', 0.2, async function () {
  if (!row) return false;
  const elsewhere = await row('shell/app', 'folder');
  return elsewhere.app === 'none' ? true : false;
}, test.limit.slow);
test.run('spirit/job, a reserved folder with no spirit.processJob, is light purple where red was', 0.2, async function () {
  if (!row) return false;
  put('spirit/job/keep.txt', 'a folder for the word job');
  const job = await row('spirit/job');
  del('spirit/job/keep.txt');
  return job.job === 'lightpurple' ? true : false;
}, test.limit.slow);

// goal/G43.4: "the colors will follow word.json changes live."
test.run('the folder spirit/app/thing, no word, has no colour', 0.2, async function () {
  if (!row) return false;
  put('spirit/app/thing/keep.txt', 'a folder');
  const before = await row('spirit/app/thing');
  return before.thing === 'none' ? true : false;
}, test.limit.slow);
test.run('when word.json gains the word, the same row goes light purple with no reload, there being no spirit.app.thing', 0.2, async function () {
  if (!row) return false;
  put('spirit/app/word.json', JSON.stringify({ thing: true }));
  const red = await row('spirit/app/thing');
  return red.thing === 'lightpurple' ? true : false;
}, test.limit.slow);
test.run('with spirit.app.thing on the object, the row is light blue', 0.2, async function () {
  if (!row) return false;
  await page.evaluate('window.setObject(true); window.fresh("spirit/app/thing")');
  const blue = await row('spirit/app/thing');
  return blue.thing === 'lightblue' ? true : false;
}, test.limit.slow);
test.run('when word.json is gone, the row loses its colour with no reload', 0.2, async function () {
  if (!row) return false;
  await page.evaluate('window.setObject(false)');
  del('spirit/app/word.json');
  const gone = await row('spirit/app/thing');
  del('spirit/app/thing/keep.txt');
  return gone.thing === 'none' ? true : false;
}, test.limit.slow);
