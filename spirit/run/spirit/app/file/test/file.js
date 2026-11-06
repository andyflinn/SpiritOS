'use strict';

// spirit/run/spirit/app/file/test/file.js
// The tests of spirit/app/file/file.js, and of Files as Andy sees it (spec: ./file.md; goal/G43.17). Andy: "file should be the
// same as files is. i don't want to loose all the nice stuff files has...". A real node on a scratch copy of the tracked files,
// with a folder of planted files, and real clicks in a real Chrome on /face.html, on the appSelector as appMigration makes it.
// Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
// Every file under a folder.
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}
// The code of the tree, its comments out, its tests out: what runs.
function codeNaming(re) {
  return filesUnder(RUN).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
    .filter(function (f) { return re.test(code(f).replace(/<!--[\s\S]*?-->/g, '')); })
    .map(function (f) { return path.relative(RUN, f); });
}

const APP = path.join(RUN, 'spirit', 'app', 'file');
// The planted folder: one file of each kind, a folder inside, and a word in the contents of two files, twice in one.
const PLANT = {
  'zzFiles/notes.txt': 'alpha\nbeta\nzzquokka and zzquokka\n',
  'zzFiles/pic.png': 'not really a png',
  'zzFiles/clip.mp4': 'not really a video',
  'zzFiles/song.mp3': 'not really a sound',
  'zzFiles/blob.zzq': 'of no kind',
  'zzFiles/inner/deep.txt': 'one zzquokka\n',
};
// The box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of unknown kind, ❔".
const ICON = { 'zzFiles/notes.txt': '📜', 'zzFiles/clip.mp4': '📹', 'zzFiles/pic.png': '🌇', 'zzFiles/song.mp3': '🔊', 'zzFiles/blob.zzq': '❔', 'zzFiles/inner': '📁' };

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-file-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function boot(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

// THE PAGE'S HANDS, put on the page once: everything judged is what shows in #zzBox, a hidden layer never counts.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  'window.__t = {' +
  '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
  '  rows: function () { return all("tr[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  rowText: function (k) { var r = all("tr[data-key], .app-icon[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; return r ? String(r.innerText || r.textContent || "") : null; },' +
  '  press: function (k) { var r = all("tr[data-key], .app-icon[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; if (!r) return false; (r.querySelector("td:last-child") || r).click(); return true; },' +
  '  head: function (label) { var h = all("th[data-sort]").filter(function (t) { return String(t.innerText).indexOf(label) === 0; })[0]; if (!h) return false; h.click(); return true; },' +
  '  heads: function () { return all("th").map(function (t) { return String(t.innerText).replace(/[▲▼]/g, "").trim() + (t.hasAttribute("data-sort") ? "*" : ""); }); },' +
  '  type: function (w) { var i = all("input[id$=text]")[0]; if (!i) return false; i.value = w; i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  words: function () { var i = all("input[id$=text]")[0]; return i ? i.value : null; },' +
  '  search: function () { var s = all("button[id$=search]")[0]; if (!s) return false; s.click(); return true; },' +
  '  filter: function (n, v) { var f = all("button[data-filter=\\"" + n + "\\"][data-value=\\"" + v + "\\"]")[0]; if (!f) return false; f.click(); return true; },' +
  '  toggle: function () { var t = all(".list-toggle")[0]; if (!t) return false; t.click(); return true; },' +
  '  bars: function () { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }).map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
  '  close: function (label) { var b = all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || "") && String(b.parentElement.innerText || "").indexOf(label) !== -1; }); if (!b.length) return false; b[b.length - 1].click(); return true; },' +
  '  count: function (sel) { return all(sel).length; },' +
  // A file picker is the files list as a dropdown (G43.16's box): its field, a button (spirit/element/probabilitySearch.js).
  '  pickers: function () { return all("button[id$=field]").length; },' +
  '  marked: function () { return all(".text-view-match").map(function (m) { return String(m.textContent); }); },' +
  '  order: function (words) { var t = window.__t.text(); return words.map(function (w) { return t.indexOf(w); }); },' +
  '}; return "hands"; }())';

test.startTest('file.js: Files in spirit/app/file/, as Andy sees it (goal/G43.17)');

(async function () {
  test.subHeading('the box: "The old shell\'s Files app moves to spirit/app/file/, and its old shell folder goes"');
  ok(!fs.existsSync(path.join(RUN, 'shell', 'files')), 'shell/files/ is gone', 'shell/files/ is still there');
  ok(fs.existsSync(path.join(APP, 'file.js')), 'spirit/app/file/file.js is there', 'no spirit/app/file/file.js');
  const oldApp = codeNaming(/shell\/files\b/);
  ok(!oldApp.length, 'no code names shell/files', 'naming it: ' + short(oldApp));

  test.subHeading('the box: "file.json: icon 📁, label "Files", intrinsic true, shell.mount true, shell.tile true, node.mount false"');
  const own = readJson(path.join(APP, 'file.json')) || {};
  const id = own.identity || {};
  ok(id.icon === '📁', 'its icon is 📁', 'identity.icon: ' + short(id.icon));
  ok(id.label === 'Files', 'its label is Files', 'identity.label: ' + short(id.label));
  ok(id.intrinsic === true, 'it is intrinsic', 'identity.intrinsic: ' + short(id.intrinsic));
  ok(!!own.shell && own.shell.mount === true && own.shell.tile === true, 'it mounts on the shell, as a tile', 'shell: ' + short(own.shell));
  ok(!!own.node && own.node.mount === false && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'file', 'api')), 'no server: node.mount false', 'node: ' + short(own.node));

  test.subHeading('the box: "New never requires old", and "The list of files stays where every app shares it (Q8)"');
  const mine = filesUnder(APP).filter(function (f) { return /\.js$/.test(f) && f.split(path.sep).indexOf('test') === -1; });
  const old = mine.filter(function (f) { return /shell\/|spirit\.shell\b|\.shell\./.test(code(f)); }).map(function (f) { return path.relative(RUN, f); });
  ok(mine.length > 0 && !old.length, 'no script of spirit/app/file/ names the old shell or a shell/ path', 'naming it: ' + short(old));
  ok(/spirit\/element\/files\/listElement\.js/.test(code(path.join(APP, 'file.js'))) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'files', 'listElement.js')),
    'file.js draws with the shared list, spirit/element/files/listElement.js, which stays where it is', 'file.js does not load spirit/element/files/listElement.js');

  const s = scratch();
  const live = [];
  let c = null;
  try {
    const N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face shell has its spirit', 'the page has no spirit: nothing judged');
    await c.evaluate(HANDS);
    const T = function (expr) { return c.evaluate('window.__t.' + expr); };
    const waitFor = function (expr, ms) { return until(function () { return c.evaluate('!!(' + 'window.__t.' + expr + ')'); }, ms || 8000); };
    const selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/appSelector.js").then(function () { window.__sel = spirit.elements.appSelector.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
    };

    test.subHeading('the box: "file.js is an element, spirit.elements.file.create(container) -> { destroy() }"');
    const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); return spirit.require("spirit/app/file/file.js").then(function () { var E = spirit.elements.file; if (!E || typeof E.create !== "function") return "no spirit.elements.file.create"; var m = E.create(b); if (!m || typeof m.destroy !== "function") return "create answered " + typeof m; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var full = b.innerHTML.length > 0; m.destroy(); var empty = b.innerHTML === ""; b.remove(); return full && empty ? "ok" : "drew " + full + ", emptied " + empty; }); }, function (e) { return "load: " + e; }); }())');
    ok(made === 'ok', 'create(container) draws into it and answers { destroy }, and destroy leaves it empty', 'the element: ' + short(made));

    test.subHeading('the box: intrinsic, so its tile is there with nothing pressed; the tile opens the list');
    await selector('tiles');
    ok(await until(function () { return c.evaluate('(document.getElementById("zzBox").innerText || "").indexOf("Files") !== -1'); }, 8000), 'the tiles show Files, with nothing pressed', 'tiles: ' + short(await T('text()')));
    await c.evaluate('(function () { var t = Array.prototype.slice.call(document.querySelectorAll("#zzBox .app-icon")).filter(function (e) { return String(e.innerText).indexOf("Files") !== -1; })[0]; if (t) t.click(); return !!t; }())');
    ok(await waitFor('rows().indexOf("zzFiles") !== -1', 10000), 'its tile opens the list of files, the planted folder in it', 'the app: ' + short(await T('text()')));

    test.subHeading('the box: "the list of files as a pane, its Name, Size and Changed columns each sortable"');
    const heads = await T('heads()');
    ok(['Name*', 'Size*', 'Changed*'].every(function (h) { return heads.indexOf(h) !== -1; }), 'the pane has the Name, Size and Changed headers, each a sort', 'headers: ' + short(heads));
    const before = await T('rows()');
    await T('head("Name")');
    await sleep(500);
    const after = await T('rows()');
    ok(before.length > 1 && short(after) === short(before.slice().reverse()), 'pressing Name again turns the order round', 'before ' + short(before) + ', after ' + short(after));
    await T('head("Name")');
    await sleep(300);

    test.subHeading('the box: "the folder tree, a folder opening and closing while the search is empty"');
    ok((await T('rows()')).indexOf('zzFiles') !== -1 && (await T('rows()')).indexOf('zzFiles/notes.txt') === -1, 'with no words a folder starts shut, its files not shown', 'rows: ' + short(await T('rows()')));
    ok(String(await T('rowText("zzFiles")')).indexOf('📁') !== -1, 'a shut folder is 📁', 'the folder row: ' + short(await T('rowText("zzFiles")')));
    await T('press("zzFiles")');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1'), 'a press opens it, and its files show', 'rows: ' + short(await T('rows()')));
    ok(String(await T('rowText("zzFiles")')).indexOf('📂') !== -1, 'an open folder is 📂', 'the folder row: ' + short(await T('rowText("zzFiles")')));
    ok(short(await T('bars()')) === short(['Files']), 'a folder\'s press opens nothing over the list', 'bars: ' + short(await T('bars()')));

    test.subHeading('the box: "A file\'s icon is by its kind, in the pane and the tiles alike"');
    const paneIcons = {};
    for (const k of Object.keys(ICON)) paneIcons[k] = String(await T('rowText(' + JSON.stringify(k) + ')'));
    const paneWrong = Object.keys(ICON).filter(function (k) { return paneIcons[k].indexOf(ICON[k]) === -1; });
    ok(!paneWrong.length, 'in the pane: text 📜, video 📹, image 🌇, audio 🔊, a folder 📁, any other file ❔', 'wrong: ' + short(paneWrong.map(function (k) { return k + ' ' + paneIcons[k]; })));
    ok(paneIcons['zzFiles/blob.zzq'] !== 'null' && paneIcons['zzFiles/blob.zzq'].indexOf('📄') === -1, 'a file of unknown kind is no longer 📄', 'blob.zzq: ' + short(paneIcons['zzFiles/blob.zzq']));

    test.subHeading('the box: "It gains a tiles mode, with the toggle between pane and tiles"');
    const toggled = await T('toggle()');
    ok(toggled, 'the list has the toggle', 'no toggle: ' + short(await T('text()')));
    ok(toggled && await waitFor('tiles().indexOf("zzFiles/notes.txt") !== -1'), 'the toggle turns the rows into tiles', 'the list: ' + short(await T('text()')));
    const tileIcons = {};
    for (const k of Object.keys(ICON)) tileIcons[k] = String(await T('rowText(' + JSON.stringify(k) + ')'));
    const tileWrong = Object.keys(ICON).filter(function (k) { return tileIcons[k].indexOf(ICON[k]) === -1; });
    ok(!tileWrong.length, 'in the tiles the same icons', 'wrong: ' + short(tileWrong.map(function (k) { return k + ' ' + tileIcons[k]; })));
    ok(toggled && await T('toggle()') && await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1 && tiles().length === 0'), 'and back to the pane', 'the list: ' + short(await T('text()')));

    test.subHeading('the box: "search in names or in contents, contents ranked by match"');
    await T('type("deep")');
    ok(await waitFor('rows().indexOf("zzFiles/inner/deep.txt") !== -1'), 'a name is found while its folder is shut', 'rows: ' + short(await T('rows()')));
    await T('filter("in", "contents")');
    await T('type("zzquokka")');
    await T('search()');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1 && rows().indexOf("zzFiles/inner/deep.txt") !== -1', 15000), 'in contents both files holding the word are found', 'rows: ' + short(await T('rows()')));
    const ranked = await T('rows()');
    ok(ranked.indexOf('zzFiles/notes.txt') < ranked.indexOf('zzFiles/inner/deep.txt'), 'the file with two matches ranks above the one with one', 'rows: ' + short(ranked));

    test.subHeading('the box: "A contents match opens text at its line, the words marked"');
    await T('press("zzFiles/notes.txt")');
    ok(await waitFor('marked().length > 0', 15000), 'the text opens with the words marked', 'the layer: ' + short(await T('text()')));
    ok((await T('marked()')).length > 0 && (await T('marked()')).every(function (m) { return /zzquokka/i.test(m); }), 'what is marked is the word searched', 'marked: ' + short(await T('marked()')));
    ok(short(await T('bars()')) === short(['Files', 'notes.txt']), 'it opens over the list, under its own title bar, notes.txt, below the Files bar', 'bars: ' + short(await T('bars()')));
    const overList = (await T('bars()')).length === 2;
    ok(overList && (await T('rows()')).length === 0, 'the list is out of view while the file is over it', 'rows: ' + short(await T('rows()')));
    ok(overList && (await T('pickers()')) === 0, 'the box: "text and media take a file when mounted: with one they show no file picker"', 'pickers: ' + (await T('pickers()')));
    await T('close("notes.txt")');
    ok(await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1'), 'its ✕ shows the list again', 'the app: ' + short(await T('text()')));
    ok((await T('rows()')).indexOf('zzFiles/notes.txt') !== -1 && (await T('words()')) === 'zzquokka', 'the list is as it was left, its words kept', 'words: ' + short(await T('words()')));

    test.subHeading('the box: "A press opens the file over the list: text for text, media for video, image and audio, fstat alone for anything else"');
    await T('type("")');
    await T('filter("in", "names")');
    await waitFor('rows().indexOf("zzFiles/pic.png") !== -1');
    const opens = [['zzFiles/pic.png', 'img'], ['zzFiles/clip.mp4', 'video'], ['zzFiles/song.mp3', 'audio']];
    for (const o of opens) {
      const name = o[0].split('/').pop();
      await T('press(' + JSON.stringify(o[0]) + ')');
      const shown = await waitFor('count(' + JSON.stringify(o[1]) + ') > 0', 10000);
      ok(shown && short(await T('bars()')) === short(['Files', name]), name + ' opens over the list in media, as ' + o[1], name + ': bars ' + short(await T('bars()')) + ', ' + o[1] + ' ' + (await T('count(' + JSON.stringify(o[1]) + ')')));
      ok(shown && (await T('pickers()')) === 0 && (await T('count(".CodeMirror")')) === 0, name + ': no file picker, and no text', name + ': pickers ' + (await T('pickers()')));
      await T('close(' + JSON.stringify(name) + ')');
      await waitFor('rows().length > 0');
    }
    await T('press("zzFiles/notes.txt")');
    ok(await waitFor('count(".CodeMirror") > 0', 10000) && (await T('count("img, video, audio")')) === 0, 'notes.txt opens in text, no media', 'notes.txt: ' + short(await T('text()')));
    // fstat, the box: "Top down: the file's name, a hidden pane, the facts (MIME type, size, changed, created), the annotations".
    // Every file has annotations to show: the node's face part always says intrinsic (spirit/fileSystem.js, getAnnotations).
    await waitFor('text().indexOf("More Information") !== -1', 10000);
    const layer = String(await T('text()'));
    const at = ['alpha', 'MIME type', 'Size', 'Changed', 'Created', 'More Information'].map(function (w) { return layer.lastIndexOf(w); });
    const nameAt = layer.lastIndexOf('notes.txt', at[0]);
    ok(nameAt !== -1 && at.every(function (n, i) { return n > (i ? at[i - 1] : nameAt); }), 'fstat, top down: the name, the text in its pane, MIME type, size, changed, created, the annotations', 'order ' + short([nameAt].concat(at)) + ' in ' + short(layer.slice(-300)));
    await T('close("notes.txt")');
    await waitFor('rows().length > 0');
    await T('press("zzFiles/blob.zzq")');
    const facts = await waitFor('text().indexOf("MIME type") !== -1', 10000);
    ok(facts, 'blob.zzq opens in fstat, its facts shown', 'blob.zzq: ' + short(await T('text()')));
    ok(facts && (await T('count(".CodeMirror, img, video, audio")')) === 0, 'fstat alone: no text and no media', 'blob.zzq: ' + short(await T('text()')));
    const bare = String(await T('text()'));
    const factsAt = bare.indexOf('MIME type');
    const between = bare.slice(bare.lastIndexOf('blob.zzq', factsAt) + 'blob.zzq'.length, factsAt).trim();
    ok(factsAt !== -1 && between === '', 'the box: "the pane stays invisible until filled": nothing shows between the name and the facts', 'between: ' + short(between));
    ok(await waitFor('text().indexOf("More Information") > text().indexOf("Created")', 10000), 'its annotations under the facts', 'blob.zzq: ' + short(await T('text()')));
    ok(facts && !/Open with/i.test(String(await T('text()'))), 'the box (Q9): no Open with in it', 'blob.zzq: ' + short(await T('text()')));
    await T('close("blob.zzq")');

    test.subHeading('nothing threw on the page');
    const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    ok(!thrown.length, 'no uncaught error on the page, all the way', 'thrown: ' + short(thrown));
    await stop(N.child);
  } finally {
    live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
