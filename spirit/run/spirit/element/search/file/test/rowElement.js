'use strict';

// spirit/run/spirit/element/search/file/test/rowElement.js
// The tests of spirit/element/search/file/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G30.18, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element and the page's data set are real, and so is the fs family's data.js (goal/G41.28), loaded as a
// page's spirit.cacheManager('fs') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.home); the node's fs family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'file', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

test.startTest('files/rowElement.js: one file or folder, as a row, and what the fs-watcher\'s stream means');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/file/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
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
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const D = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  D.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  const managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element;
  const F = ((global.window.spirit.data || {}).fs || {}).data;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(required.indexOf('spirit/element/rowElement.js') !== -1 && !required.some(function (p) { return /data\.js$/.test(p); }), 'it requires the shared row element, and no data script', 'required: ' + short(required));
  ok(managers.indexOf('fs') !== -1 && F && typeof F.file === 'function', 'it loads the fs family\'s cache manager, which puts ((spirit.data || {}).fs || {}).data on the page', 'managers: ' + short(managers));
  if (!F || typeof F.file !== 'function') return;
  ok(E.search.file.rowElement && typeof E.search.file.rowElement.create === 'function', 'it registers spirit.element.search.file.rowElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.search.file.rowElement || typeof E.search.file.rowElement.create !== 'function') return;

  test.subHeading('what the fs-watcher\'s stream means for data.files, in the type\'s own element (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": the file tree's
  // translation, spirit/element/search/file/data.js until G41.16, is this element's (G30.18), loaded with it.
  const cmd = function (c) { return { id: 'job-fs', type: 'fs-watcher', data: { command: c } }; };
  ok(F.ready() !== true, 'before the tree is whole, data.files is not ready', 'ready: ' + short(F.ready()));
  D.takeJob(cmd({ op: 'createDirectory', path: 'docs' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' }));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/core.js', size: 7, core: true }));
  ok(F.file('docs') && F.file('docs').kind === 'folder', 'a createDirectory is a folder at files/<path>', 'files/docs: ' + short(F.file('docs')));
  const a = F.file('docs/a.md');
  ok(a && a.kind === 'file' && a.size === 5 && a.modified === '2030-01-01T00:00:00Z' && a.core === false, 'a createFile is a file with its size and its time, core false', 'files/docs/a.md: ' + short(a));
  ok(F.file('docs/core.js') && F.file('docs/core.js').core === true, 'the node\'s word that a file is core is kept', 'files/docs/core.js: ' + short(F.file('docs/core.js')));
  D.takeJob({ id: 'job-fs', type: 'fs-watcher', data: { treeComplete: true } });
  ok(F.ready() === true, 'treeComplete: data.files is ready', 'ready: ' + short(F.ready()));
  D.takeJob(cmd({ op: 'changeFile', path: 'docs/a.md', size: 6 }));
  ok(F.file('docs/a.md').size === 6 && F.file('docs/a.md').kind === 'file', 'a change by path sets the file again, its kind kept', 'files/docs/a.md: ' + short(F.file('docs/a.md')));
  D.takeJob(cmd({ op: 'deleteFile', path: 'docs/a.md' }));
  ok(F.file('docs/a.md') === null && F.file('docs'), 'a deleteFile takes that file out', 'files: ' + short(Object.keys(F.files())));
  D.takeJob(cmd({ op: 'createFile', path: 'docs/sub/x.txt', size: 1 }));
  D.takeJob(cmd({ op: 'deleteDirectory', path: 'docs' }));
  ok(!Object.keys(F.files()).some(function (k) { return k === 'docs' || k.indexOf('docs/') === 0; }), 'a deleteDirectory takes the folder out, and everything under it', 'files: ' + short(Object.keys(F.files())));
  const before = JSON.stringify(F.files());
  D.takeJob({ id: 'j2', type: 'relay-presence', data: { command: { op: 'createFile', path: 'nope.txt' } } });
  D.takeJob(cmd({ op: 'createFile' }));
  ok(JSON.stringify(F.files()) === before, 'another job\'s command, or a command with no path, writes nothing', 'files: ' + short(Object.keys(F.files())));

  test.subHeading('one file or folder as a row');
  D.takeJob(cmd({ op: 'createFile', path: 'web/page<1>.html', size: 2048, modified: '2030-01-02T03:04:00Z', core: false }));
  const el = E.search.file.rowElement.create({ path: 'web/page<1>.html' });
  ok(el.kind === 'file' && el.key === 'web/page<1>.html' && el.row.size === 2048 && el.row.name === 'page<1>.html', 'a row element of kind file, keyed by its path, its facts from data.files', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  ok(JSON.stringify(Object.keys(cells)) === '["name","size","changed"]', 'its fields are name, size and changed', 'fields: ' + short(Object.keys(cells)));
  ok(/📜/.test(cells.name) && /page&lt;1>\.html/.test(cells.name) && /web\//.test(cells.name) && !/<1>/.test(cells.name), 'the name cell: a text file\'s icon 📜 (goal/G43.17), where it lives, and its name, escaped', 'name: ' + short(cells.name));
  ok(cells.size === '2048 Bytes' && cells.changed === '2030-01-02 03:04', 'its size through formatBytes, its time to the minute', 'cells: ' + short(cells));
  const folder = E.search.file.rowElement.create({ path: 'web', kind: 'folder' });
  const fc = {}; folder.cells().forEach(function (c) { fc[c.name] = c.html; });
  ok(/📁/.test(fc.name) && fc.size === '', 'a folder: its icon, and no size', 'folder: ' + short(fc));
  // goal/G43.17, the box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of unknown kind, ❔, in
  // place of today's 📄; a file gone stays ❌".
  await settle();
  const KINDS = { 'web/a.txt': '📜', 'web/a.png': '🌇', 'web/a.mp4': '📹', 'web/a.mp3': '🔊', 'web/a.zzq': '❔' };
  const wrong = Object.keys(KINDS).filter(function (p) { const k = {}; E.search.file.rowElement.create({ path: p }).cells().forEach(function (c) { k[c.name] = c.html; }); return k.name.indexOf(KINDS[p]) === -1 || /📄/.test(k.name); });
  ok(!wrong.length, 'a file\'s icon by its kind: text 📜, image 🌇, video 📹, audio 🔊, any other ❔, none 📄', 'wrong: ' + short(wrong));
  const core = E.search.file.rowElement.create({ path: 'spirit/kernel.js', core: true });
  const cc = {}; core.cells().forEach(function (c) { cc[c.name] = c.html; });
  ok(/spirit-core/.test(cc.name) && /core: write-protected/.test(cc.name), 'a core file\'s name in yellow, said core: write-protected', 'core: ' + short(cc.name));

  test.subHeading('it repaints from data.files');
  const hosts = { name: { innerHTML: '' }, size: { innerHTML: '' }, changed: { innerHTML: '' } };
  el.mount(hosts);
  D.takeJob(cmd({ op: 'changeFile', path: 'web/page<1>.html', size: 4096, modified: '2030-01-02T03:04:00Z', core: false }));
  await settle();
  ok(el.row.size === 4096 && hosts.size.innerHTML === '4096 Bytes', 'its path in data.files changed, the row repaints its size', 'row: ' + short(el.row) + ', size ' + short(hosts.size.innerHTML));
  D.takeJob(cmd({ op: 'deleteFile', path: 'web/page<1>.html' }));
  await settle();
  ok(el.row.gone === true && /❌/.test(hosts.name.innerHTML), 'its path gone from data.files, the row is marked gone', 'row: ' + short(el.row));

  test.subHeading('its actions ask, and paint nothing');
  const opened = [];
  await el.act('open', { open: function (p) { opened.push(p); } });
  ok(opened.length === 1 && opened[0] === 'web/page<1>.html', 'open hands its path to the viewer the page gave', 'opened: ' + short(opened));
  const launched = [];
  await el.act('open', { launchApp: function (app, a) { launched.push([app, a]); } });
  ok(launched.length === 1 && launched[0][0] === 'text-file-launcher' && launched[0][1].path === 'web/page<1>.html', 'with no viewer, the text launcher', 'launched: ' + short(launched));
  await el.act('remove', {});
  ok(asked.some(function (c) { return c.verb === 'fs.delete' && c.args.path === 'web/page<1>.html'; }), 'remove asks fs.delete { path } through the spirit object', 'asked: ' + short(asked));
  const info = await el.expandInfo();
  ok(info && info.stat && info.annotations && asked.some(function (c) { return c.verb === 'fs.stat'; }) && asked.some(function (c) { return c.verb === 'fs.annotations'; }), 'expandInfo asks fs.stat and fs.annotations', 'info: ' + short(info));

  // ── goal/G43.4: THE RESERVED WORDS IN COLOUR, IN A REAL BROWSER ───────────────────────────────────
  // Real rows on a scratch node (./rowElement-words.html), spirit/word.js and the node's own file stream under them.
  // goal/G43.18, Andy: "file app: please change the green colored paths/files in light blue instead.", and then "ALL, ONLY
  // REPLACE RED WITH LIGHT PURPLE, KEEP THE BLUE!!!!!!!!!!!!!!!!": a word that holds is light blue, one that does not is light
  // purple, and no red is left.
  test.subHeading('goal/G43.4 and G43.18: a path element is light blue where word and spirit object agree, red where they disagree');
  const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const node = await H.scratchNode();
  let page = null;
  // Written on the scratch node's disk: the node refuses fs.save under spirit/, and its fs-watcher hears the disk.
  const put = function (rel, text) { const f = path.join(node.root, 'spirit', 'run', rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const del = function (rel) { fs.rmSync(path.join(node.root, 'spirit', 'run', rel), { force: true }); };
  try {
    page = node.up && node.debug ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up with its DEBUG on'); return; }
    await page.send('Page.navigate', { url: node.base + '/DEBUG/spirit/element/search/file/test/rowElement-words.html' });
    await H.until(function () { return page.evaluate('typeof window.ready === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    await page.evaluate('window.ready()');
    const row = async function (p, kind) { try { return JSON.parse(await page.evaluate('window.row(' + JSON.stringify(p) + ', ' + JSON.stringify(kind || 'folder') + ')')); } catch (e) { return { threw: String(e) }; } };
    const app = await row('spirit/app');
    ok(app.app === 'lightblue', 'spirit/app: reserved, and the spirit object holds spirit.app: light blue', 'spirit/app: ' + short(app));
    ok(app.spirit === 'lightblue', 'its path element spirit: always the colour of a word that holds, light blue', 'spirit/app: ' + short(app));
    const element = await row('spirit/element');
    ok(element.element === 'lightblue', 'spirit/element: light blue', 'spirit/element: ' + short(element));
    // Andy's commit d278c3e6, "identity": contact is no hard-coded word now.
    const contact = await row('spirit/contact');
    ok(contact.contact === 'lightblue', 'spirit/contact: a word (word.js), and the page holds spirit.contact: light blue', 'spirit/contact: ' + short(contact));
    const inside = await row('spirit/app/api.js', 'file');
    ok(inside.app === 'lightblue' && inside.spirit === 'lightblue' && inside['api.js'] === 'lightpurple', 'a file inside: its path elements carry the colours too, the file api.js, a word with no spirit.app.api, light purple', 'spirit/app/api.js: ' + short(inside));
    const plain = await row('spirit/jobs');
    ok(plain.jobs === 'none', 'spirit/jobs: not reserved: no colour', 'spirit/jobs: ' + short(plain));
    const hub = await row('spirit/hub.js', 'file');
    ok(hub['hub.js'] === 'none', 'spirit/hub.js: not reserved: no colour', 'spirit/hub.js: ' + short(hub));
    const elsewhere = await row('shell/app', 'folder');
    ok(elsewhere.app === 'none', 'outside spirit/ no word holds: shell/app has no colour', 'shell/app: ' + short(elsewhere));
    put('spirit/job/keep.txt', 'a folder for the word job');
    const job = await row('spirit/job');
    ok(job.job === 'lightpurple', 'spirit/job: reserved, a folder, and no spirit.job: light purple, where red was', 'spirit/job: ' + short(job));
    del('spirit/job/keep.txt');

    test.subHeading('goal/G43.4: "the colors will follow word.json changes live."');
    put('spirit/app/thing/keep.txt', 'a folder');
    const before = await row('spirit/app/thing');
    ok(before.thing === 'none', 'the folder spirit/app/thing, no word: no colour', 'spirit/app/thing: ' + short(before));
    put('spirit/app/word.json', JSON.stringify({ thing: true }));
    const red = await row('spirit/app/thing');
    ok(red.thing === 'lightpurple', 'word.json gains the word: the same row goes light purple, with no reload: no spirit.app.thing', 'spirit/app/thing: ' + short(red));
    await page.evaluate('window.setObject(true); window.fresh("spirit/app/thing")');
    const blue = await row('spirit/app/thing');
    ok(blue.thing === 'lightblue', 'with spirit.app.thing on the object: light blue', 'spirit/app/thing: ' + short(blue));
    await page.evaluate('window.setObject(false)');
    del('spirit/app/word.json');
    const gone = await row('spirit/app/thing');
    ok(gone.thing === 'none', 'word.json gone: the row loses its colour, with no reload', 'spirit/app/thing: ' + short(gone));
    del('spirit/app/thing/keep.txt');
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
