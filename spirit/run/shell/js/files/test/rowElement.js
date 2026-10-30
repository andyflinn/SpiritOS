'use strict';

// spirit/run/shell/js/files/test/rowElement.js
// The tests of shell/js/files/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G30.18, goal/G41.16).
// The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element and the page's data set are real; the node's fs family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'files', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

test.startTest('files/rowElement.js: one file or folder, as a row, and what the fs-watcher\'s stream means');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/files/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const fsFamily = {
    delete: function (a) { asked.push({ verb: 'fs.delete', args: a }); return Promise.resolve({ ok: true }); },
    stat: function (a) { asked.push({ verb: 'fs.stat', args: a }); return Promise.resolve({ size: 9 }); },
    annotations: function (a) { asked.push({ verb: 'fs.annotations', args: a }); return Promise.resolve({ note: 'n' }); },
  };
  const STANDS = { 'shell/js/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, formatBytes: function (n) { return n + ' Bytes'; },
    ready: Promise.resolve({ fs: fsFamily }), fs: fsFamily, elements: {} } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const D = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(required.indexOf('shell/js/rowElement.js') !== -1 && !required.some(function (p) { return /data\.js$/.test(p); }), 'it requires the shared row element, and no data script', 'required: ' + short(required));
  ok(E.fileElement && typeof E.fileElement.create === 'function', 'it registers spirit.elements.fileElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.fileElement || typeof E.fileElement.create !== 'function') return;

  test.subHeading('what the fs-watcher\'s stream means for data.files, in the type\'s own element (goal/G41.16)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": the file tree's
  // translation, shell/js/files/data.js until G41.16, is this element's (G30.18), loaded with it.
  const cmd = function (c) { return { id: 'job-fs', type: 'fs-watcher', data: { command: c } }; };
  ok(D.ready('files') !== true, 'before the tree is whole, data.files is not ready', 'ready: ' + short(D.ready('files')));
  D.take(cmd({ op: 'createDirectory', path: 'docs' }));
  D.take(cmd({ op: 'createFile', path: 'docs/a.md', size: 5, modified: '2030-01-01T00:00:00Z' }));
  D.take(cmd({ op: 'createFile', path: 'docs/core.js', size: 7, core: true }));
  ok(D.get('files/docs') && D.get('files/docs').kind === 'folder', 'a createDirectory is a folder at files/<path>', 'files/docs: ' + short(D.get('files/docs')));
  const a = D.get('files/docs/a.md');
  ok(a && a.kind === 'file' && a.size === 5 && a.modified === '2030-01-01T00:00:00Z' && a.core === false, 'a createFile is a file with its size and its time, core false', 'files/docs/a.md: ' + short(a));
  ok(D.get('files/docs/core.js') && D.get('files/docs/core.js').core === true, 'the node\'s word that a file is core is kept', 'files/docs/core.js: ' + short(D.get('files/docs/core.js')));
  D.take({ id: 'job-fs', type: 'fs-watcher', data: { treeComplete: true } });
  ok(D.ready('files') === true, 'treeComplete: data.files is ready', 'ready: ' + short(D.ready('files')));
  D.take(cmd({ op: 'changeFile', path: 'docs/a.md', size: 6 }));
  ok(D.get('files/docs/a.md').size === 6 && D.get('files/docs/a.md').kind === 'file', 'a change by path sets the file again, its kind kept', 'files/docs/a.md: ' + short(D.get('files/docs/a.md')));
  D.take(cmd({ op: 'deleteFile', path: 'docs/a.md' }));
  ok(D.get('files/docs/a.md') === undefined && D.get('files/docs'), 'a deleteFile takes that file out', 'files: ' + short(Object.keys(D.branch('files'))));
  D.take(cmd({ op: 'createFile', path: 'docs/sub/x.txt', size: 1 }));
  D.take(cmd({ op: 'deleteDirectory', path: 'docs' }));
  ok(!Object.keys(D.branch('files')).some(function (k) { return k === 'docs' || k.indexOf('docs/') === 0; }), 'a deleteDirectory takes the folder out, and everything under it', 'files: ' + short(Object.keys(D.branch('files'))));
  const before = JSON.stringify(D.branch('files'));
  D.take({ id: 'j2', type: 'relay-presence', data: { command: { op: 'createFile', path: 'nope.txt' } } });
  D.take(cmd({ op: 'createFile' }));
  ok(JSON.stringify(D.branch('files')) === before, 'another job\'s command, or a command with no path, writes nothing', 'files: ' + short(Object.keys(D.branch('files'))));

  test.subHeading('one file or folder as a row');
  D.set('files/web/page<1>.html', { kind: 'file', size: 2048, modified: '2030-01-02T03:04:00Z', core: false });
  const el = E.fileElement.create({ path: 'web/page<1>.html' });
  ok(el.kind === 'file' && el.key === 'web/page<1>.html' && el.row.size === 2048 && el.row.name === 'page<1>.html', 'a row element of kind file, keyed by its path, its facts from data.files', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  ok(JSON.stringify(Object.keys(cells)) === '["name","size","changed"]', 'its fields are name, size and changed', 'fields: ' + short(Object.keys(cells)));
  ok(/📄/.test(cells.name) && /page&lt;1>\.html/.test(cells.name) && /web\//.test(cells.name) && !/<1>/.test(cells.name), 'the name cell: a file\'s icon, where it lives, and its name, escaped', 'name: ' + short(cells.name));
  ok(cells.size === '2048 Bytes' && cells.changed === '2030-01-02 03:04', 'its size through formatBytes, its time to the minute', 'cells: ' + short(cells));
  const folder = E.fileElement.create({ path: 'web', kind: 'folder' });
  const fc = {}; folder.cells().forEach(function (c) { fc[c.name] = c.html; });
  ok(/📁/.test(fc.name) && fc.size === '', 'a folder: its icon, and no size', 'folder: ' + short(fc));
  const core = E.fileElement.create({ path: 'spirit/kernel.js', core: true });
  const cc = {}; core.cells().forEach(function (c) { cc[c.name] = c.html; });
  ok(/spirit-core/.test(cc.name) && /core: write-protected/.test(cc.name), 'a core file\'s name in yellow, said core: write-protected', 'core: ' + short(cc.name));

  test.subHeading('it repaints from data.files');
  const hosts = { name: { innerHTML: '' }, size: { innerHTML: '' }, changed: { innerHTML: '' } };
  el.mount(hosts);
  D.set('files/web/page<1>.html', { kind: 'file', size: 4096, modified: '2030-01-02T03:04:00Z', core: false });
  await settle();
  ok(el.row.size === 4096 && hosts.size.innerHTML === '4096 Bytes', 'its path in data.files changed, the row repaints its size', 'row: ' + short(el.row) + ', size ' + short(hosts.size.innerHTML));
  D.del('files/web/page<1>.html');
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
