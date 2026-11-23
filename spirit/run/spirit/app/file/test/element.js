'use strict';

// spirit/run/spirit/app/file/test/element.js
// The tests of spirit/app/file/element.js, and of Files as Andy sees it (spec: ./file.md; goal/G43.17). Andy: "file should be the
// same as files is. i don't want to loose all the nice stuff files has...". A real node on a scratch copy of the tracked files,
// with a folder of planted files, and real clicks in a real Chrome on /face.html, on the appSelector as the shell app makes it.
// Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fs', 'fileSystem.js')).VENDORED_FOLDERS;
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
// The box: "An element mounts over ALL of the one that mounts it, its title bar too", so one bar is in view, and it reads what it
// is told: "[✏️] "Text Editor:" + file-name; [icon] "Media Viewer:" + file-name, the icon the file's own".
function barIs(b, want) { return Array.isArray(b) && b.length === 1 && (want instanceof RegExp ? want.test(b[0]) : b[0] === want); }
// How often a word shows in a text: the box, "No name line: the file's name is in the panel's title bar", and "No title line".
function times(text, re) { return (String(text).match(re) || []).length; }
// A real picture, far bigger than any pane: 2400 by 1600, one colour, so the box has to shrink it both ways.
function png(w, h) {
  const zlib = require('zlib');
  const crc = function (buf) { let c, k = -1; for (let n = 0; n < buf.length; n++) { c = (k ^ buf[n]) & 0xff; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; k = (k >>> 8) ^ c; } return (k ^ -1) >>> 0; };
  const chunk = function (type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(td)); return Buffer.concat([len, td, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  const row = Buffer.alloc(1 + w * 3, 0x80); row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: h }, function () { return row; }));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// Every file under a folder.
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
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
  'zzFiles/pic.png': png(2400, 1600),
  'zzFiles/clip.mp4': 'not really a video',
  'zzFiles/song.mp3': 'not really a sound',
  'zzFiles/blob.zzq': 'of no kind',
  'zzFiles/inner/deep.txt': 'one zzquokka\n',
};
// The box: "text 📜, video 📹, image 🌇, audio 🔊; a folder 📁 shut and 📂 open; any other file, of unknown kind, ❔".
const ICON = { 'zzFiles/notes.txt': '📜', 'zzFiles/clip.mp4': '📹', 'zzFiles/pic.png': '🌇', 'zzFiles/song.mp3': '🔊', 'zzFiles/blob.zzq': '❔', 'zzFiles/inner': '📁' };

function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: '', body: null }; }
}
async function boot(run) {
  const port = await freePort();
  const child = LABH.startNodeOn(run, port);
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
  // A file picker is the files list as a dropdown (G43.16's box): its field, a button (spirit/element/search.js).
  '  pickers: function () { return all("button[id$=field]").length; },' +
  '  marked: function () { return all(".text-view-match").map(function (m) { return String(m.textContent); }); },' +
  // The box: "That row is a bubble of the same kind as rowForm uses": rowForm's root is .shell-bubble (spirit/element/rowForm.js).
  '  inBubble: function (word) { var b = all("button").filter(function (x) { return String(x.textContent).indexOf(word) !== -1; })[0]; return b ? !!b.closest(".shell-bubble") : null; },' +
  // The pane made w by h; then what sel draws, its rect against the pane's, and the one bar still in view inside it.
  '  sized: function (sel, w, h) { var b = box(); b.style.width = w + "px"; b.style.height = h + "px"; return new Promise(function (r) { setTimeout(r, 500); }).then(function () { var e = all(sel)[0], o = b.getBoundingClientRect(); if (!e) return { none: true }; var r = e.getBoundingClientRect(), x = all("button").filter(function (k) { return String(k.textContent).trim() === "✕" && !/clear$/.test(k.id || ""); })[0]; var xr = x ? x.getBoundingClientRect() : null; return { left: r.left - o.left, top: r.top - o.top, right: o.right - r.right, bottom: o.bottom - r.bottom, w: r.width, h: r.height, fit: getComputedStyle(e).objectFit, bar: !!xr && xr.top >= o.top - 1 && xr.bottom <= o.bottom + 1 }; }); },' +
  '  unsized: function () { var b = box(); b.style.width = "100%"; b.style.height = "100%"; return true; },' +
  // A row in a narrow pane: true when nothing of the bubble holding word goes past its edge or the pane's.
  '  folds: function (word, w) { var b = box(); b.style.width = w + "px"; return new Promise(function (r) { setTimeout(r, 500); }).then(function () { var k = all("button").filter(function (x) { return String(x.textContent).indexOf(word) !== -1; })[0]; var row = k && k.closest(".shell-bubble"); var out = !!row && !(row.scrollWidth > row.clientWidth + 1 || row.getBoundingClientRect().right > b.getBoundingClientRect().right + 1); b.style.width = "100%"; return out; }); },' +
  '  order: function (words) { var t = window.__t.text(); return words.map(function (w) { return t.indexOf(w); }); },' +
  '}; return "hands"; }())';

// file.js: Files in spirit/app/file/, as Andy sees it (goal/G43.17). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = { live: [] };
test.after(async function () {
  W.live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
  if (W.c && W.c.kid) { try { W.c.kid.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  if (W.s) { try { LABH.freeTree(W.s); } catch (e) { /* a door still closing; the temp folder keeps it */ } }
});
const OWN = function () { return readJson(path.join(APP, 'file.json')) || {}; };

// the box: "The old shell's Files app moves to spirit/app/file/, and its old shell folder goes"
test.run('shell/files/ is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'files')) || false;
}, test.limit.quick);
test.run('spirit/app/file/element.js is there', 0.2, function () {
  return fs.existsSync(path.join(APP, 'element.js')) || false;
}, test.limit.quick);
test.run('no code names shell/files', 0.2, function () {
  const oldApp = codeNaming(/shell\/files\b/);
  return !oldApp.length || false;
}, test.limit.quick);

// the box: "file.json: icon 📁, label "Files", intrinsic true, shell.mount true, shell.tile true, node.mount false"
// WHICH ICON IS ANDY'S, AND IT CHANGES (goal/G47.1, Andy: "I'm not sure if it's worth testing for specific icons.. hey will
// only settle slowly over the next while...", then "yes" to keeping 'it has an icon' and dropping which one).
test.run('it has an icon', 0.2, function () {
  const id = OWN().identity || {};
  return (typeof id.icon === 'string' && id.icon.trim() !== '') || false;
}, test.limit.quick);
test.run('its label is Files', 0.2, function () {
  const id = OWN().identity || {};
  return id.label === 'Files' || false;
}, test.limit.quick);
test.run('it is intrinsic', 0.2, function () {
  const id = OWN().identity || {};
  return id.intrinsic === true || false;
}, test.limit.quick);
test.run('it mounts on the shell, as a tile', 0.2, function () {
  const own = OWN();
  return !!own.shell && own.shell.mount === true && own.shell.tile === true ? true : false;
}, test.limit.quick);
test.run('it has no server: its node mount is false and it has no api folder', 0.2, function () {
  const own = OWN();
  return !!own.node && own.node.mount === false && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'file', 'api')) ? true : false;
}, test.limit.quick);

// the box: "New never requires old", and "The list of files stays where every app shares it (Q8)"
test.run('no script of spirit/app/file/ names the old shell or a shell/ path', 0.2, function () {
  const mine = filesUnder(APP).filter(function (f) { return /\.js$/.test(f) && f.split(path.sep).indexOf('test') === -1; });
  const old = mine.filter(function (f) { return /shell\/|spirit\.shell\b|\.shell\./.test(code(f)); }).map(function (f) { return path.relative(RUN, f); });
  return mine.length > 0 && !old.length ? true : false;
}, test.limit.quick);
test.run('file.js draws with the shared list, spirit/element/search/file.js, which stays where it is', 0.2, function () {
  return (/spirit\/element\/search\/file\.js/).test(code(path.join(APP, 'element.js'))) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'search', 'file.js'))
    ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up for this suite', 0.2, async function () {
  W.s = scratch();
  const N = await boot(W.s.run); W.live.push(N.child);
  W.N = N;
  return N.up || false;
}, test.limit.slow);
test.run('a Chrome page opens for this suite', 0.2, async function () {
  if (!W.N || !W.N.up) return false;
  const where = findChrome();
  if (!where) return false;
  W.c = await chromePage(where);
  if (W.c.error) { W.c = null; return false; }
  return true;
}, test.limit.quick);
test.run('the face shell opens in that page with its spirit ready', 0.2, async function () {
  if (!W.c) return false;
  await W.c.send('Page.navigate', { url: W.N.base + '/face.html' });
  W.page = !!(await until(function () { return W.c.evaluate('!!(window.spirit && window.spirit.readyPromise && window.spirit.eventStream)'); }, 20000));
  if (W.page) await W.c.evaluate(HANDS);
  return W.page || false;
}, test.limit.quick);
const T = function (expr) { return W.c.evaluate('window.__t.' + expr); };
// Every hand in expr is the page's, not only the first: "rows() ... && tiles()" asks both.
const waitFor = function (expr, ms) { return until(function () { return W.c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
const selector = function (face) {
  return W.c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function () { window.__sel = spirit.required.spirit.element.script.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
};

// the box: "file.js is an element, spirit.element.spirit.app.file.element.create(container) -> { destroy() }"
test.run('create(container) draws into it and answers { destroy }, and destroy leaves it empty', 0.2, async function () {
  if (!W.page) return false;
  const made = await W.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); return spirit.requireScript("spirit/app/file/element.js").then(function () { var E = spirit.required.spirit.app.file.element; if (!E || typeof E.create !== "function") return false; var m = E.create(b); if (!m || typeof m.destroy !== "function") return false; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var full = b.innerHTML.length > 0; m.destroy(); var empty = b.innerHTML === ""; b.remove(); return full && empty ? "ok" : false; }); }, function () { return false; }); }())');
  return made === 'ok' || false;
}, test.limit.slow);

// the box: intrinsic, so its tile is there with nothing pressed; the tile opens the list
test.run('the tiles show Files, with nothing pressed', 0.2, async function () {
  if (!W.page) return false;
  await selector('tiles');
  return await until(function () { return W.c.evaluate('(document.getElementById("zzBox").innerText || "").indexOf("Files") !== -1'); }, 8000) ? true : false;
}, test.limit.quick);
test.run('its tile opens the list of files, the planted folder in it', 0.2, async function () {
  if (!W.page) return false;
  await W.c.evaluate('(function () { var t = Array.prototype.slice.call(document.querySelectorAll("#zzBox .app-icon")).filter(function (e) { return String(e.innerText).indexOf("Files") !== -1; })[0]; if (t) t.click(); return !!t; }())');
  return await waitFor('rows().indexOf("zzFiles") !== -1', 10000) ? true : false;
}, test.limit.quick);
test.run('Files covers all of the tiles, with one bar in view reading 📁 Files', 0.2, async function () {
  if (!W.page) return false;
  return barIs(await T('bars()'), '📁 Files') || false;
}, test.limit.quick);
test.run('Files has no title line and is named only once, in its bar', 0.2, async function () {
  if (!W.page) return false;
  return times(await T('text()'), /\bFiles\b/g) === 1 || false;
}, test.limit.quick);

// the box: "the list of files as a pane, its Name, Size and Changed columns each sortable"
test.run('the pane has the Name, Size and Changed headers, each a sort', 0.2, async function () {
  if (!W.page) return false;
  const heads = await T('heads()');
  return ['Name*', 'Size*', 'Changed*'].every(function (h) { return heads.indexOf(h) !== -1; }) || false;
}, test.limit.quick);
test.run('pressing Name again turns the order round', 0.2, async function () {
  if (!W.page) return false;
  const before = await T('rows()');
  await T('head("Name")');
  await sleep(500);
  const after = await T('rows()');
  await T('head("Name")');
  await sleep(300);
  return before.length > 1 && short(after) === short(before.slice().reverse()) ? true : false;
}, test.limit.slow);

// the box: "the folder tree, a folder opening and closing while the search is empty"
test.run('with no words a folder starts shut, its files not shown', 0.2, async function () {
  if (!W.page) return false;
  return (await T('rows()')).indexOf('zzFiles') !== -1 && (await T('rows()')).indexOf('zzFiles/notes.txt') === -1 ? true : false;
}, test.limit.quick);
test.run('a shut folder is 📁', 0.2, async function () {
  if (!W.page) return false;
  return String(await T('rowText("zzFiles")')).indexOf('📁') !== -1 || false;
}, test.limit.quick);
test.run('a press opens it, and its files show', 0.2, async function () {
  if (!W.page) return false;
  await T('press("zzFiles")');
  return await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') ? true : false;
}, test.limit.quick);
test.run('an open folder is 📂', 0.2, async function () {
  if (!W.page) return false;
  return String(await T('rowText("zzFiles")')).indexOf('📂') !== -1 || false;
}, test.limit.quick);
test.run('a folder\'s press opens nothing over the list', 0.2, async function () {
  if (!W.page) return false;
  return barIs(await T('bars()'), '📁 Files') || false;
}, test.limit.quick);

// the box: "A file's icon is by its kind, in the pane and the tiles alike"
test.run('in the pane a text file shows 📜, a video 📹, an image 🌇, an audio file 🔊, a folder 📁 and any other file ❔', 0.2, async function () {
  if (!W.page) return false;
  const paneIcons = W.paneIcons = {};
  for (const k of Object.keys(ICON)) paneIcons[k] = String(await T('rowText(' + JSON.stringify(k) + ')'));
  const paneWrong = Object.keys(ICON).filter(function (k) { return paneIcons[k].indexOf(ICON[k]) === -1; });
  return !paneWrong.length || false;
}, test.limit.quick);
test.run('a file of unknown kind is no longer 📄', 0.2, function () {
  if (!W.paneIcons) return false;
  const blob = W.paneIcons['zzFiles/blob.zzq'];
  return blob !== 'null' && blob.indexOf('📄') === -1 ? true : false;
}, test.limit.quick);

// the box: "It gains a tiles mode, with the toggle between pane and tiles"
test.run('the list has the toggle', 0.2, async function () {
  if (!W.page) return false;
  W.toggled = await T('toggle()');
  return W.toggled || false;
}, test.limit.quick);
test.run('the toggle turns the rows into tiles', 0.2, async function () {
  if (!W.page) return false;
  return W.toggled && await waitFor('tiles().indexOf("zzFiles/notes.txt") !== -1') ? true : false;
}, test.limit.quick);
test.run('the tiles show the same icons as the pane', 0.2, async function () {
  if (!W.page) return false;
  const tileIcons = {};
  for (const k of Object.keys(ICON)) tileIcons[k] = String(await T('rowText(' + JSON.stringify(k) + ')'));
  const tileWrong = Object.keys(ICON).filter(function (k) { return tileIcons[k].indexOf(ICON[k]) === -1; });
  return !tileWrong.length || false;
}, test.limit.quick);
test.run('the toggle turns the tiles back into the pane', 0.2, async function () {
  if (!W.page) return false;
  return W.toggled && await T('toggle()') && await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1 && tiles().length === 0') ? true : false;
}, test.limit.quick);

// the box: "search in names or in contents, contents ranked by match"
test.run('a name is found while its folder is shut', 0.2, async function () {
  if (!W.page) return false;
  await T('type("deep")');
  return await waitFor('rows().indexOf("zzFiles/inner/deep.txt") !== -1') ? true : false;
}, test.limit.slow);
test.run('in contents both files holding the word are found, ranked above the files it misses', 0.2, async function () {
  if (!W.page) return false;
  await T('filter("in", "contents")');
  await T('type("zzquokka")');
  await T('search()');
  // Nothing is cut (probabilitySearch, G43.6), so both files are in the list before the node answers: found means ranked above
  // every file the word misses, which only the contents answer does.
  const hits = 'rows().indexOf("zzFiles/notes.txt") !== -1 && rows().indexOf("zzFiles/inner/deep.txt") !== -1 && rows().slice(0, 3).indexOf("zzFiles/notes.txt") !== -1 && rows().slice(0, 3).indexOf("zzFiles/inner/deep.txt") !== -1';
  return await waitFor(hits, 15000) ? true : false;
}, test.limit.slow);
test.run('the file with two matches ranks above the one with one', 0.2, async function () {
  if (!W.page) return false;
  const ranked = await T('rows()');
  return ranked.indexOf('zzFiles/notes.txt') !== -1 && ranked.indexOf('zzFiles/notes.txt') < ranked.indexOf('zzFiles/inner/deep.txt') ? true : false;
}, test.limit.quick);

// the box: "A contents match opens text at its line, the words marked"
test.run('the text opens with the words marked', 0.2, async function () {
  if (!W.page) return false;
  await T('press("zzFiles/notes.txt")');
  return await waitFor('marked().length > 0', 15000) ? true : false;
}, test.limit.quick);
test.run('what is marked is the word searched', 0.2, async function () {
  if (!W.page) return false;
  return (await T('marked()')).length > 0 && (await T('marked()')).every(function (m) { return /zzquokka/i.test(m); }) ? true : false;
}, test.limit.quick);
test.run('the opened text covers all of Files, with one bar in view reading ✏️ Text Editor: notes.txt', 0.2, async function () {
  if (!W.page) return false;
  return barIs(await T('bars()'), '✏️ Text Editor: notes.txt') || false;
}, test.limit.quick);
test.run('the list is out of view while the file is over it', 0.2, async function () {
  if (!W.page) return false;
  W.overList = barIs(await T('bars()'), /notes\.txt$/);
  return W.overList && (await T('rows()')).length === 0 ? true : false;
}, test.limit.quick);
test.run('the opened text shows its whole self, the file picker too, also when launched from Files', 0.2, async function () {
  if (!W.page) return false;
  return W.overList && (await T('pickers()')) === 1 ? true : false;
}, test.limit.quick);
test.run('its ✕ shows the list again', 0.2, async function () {
  if (!W.page) return false;
  await T('close("notes.txt")');
  return await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') ? true : false;
}, test.limit.quick);
test.run('the list is as it was left, its words kept', 0.2, async function () {
  if (!W.page) return false;
  return (await T('rows()')).indexOf('zzFiles/notes.txt') !== -1 && (await T('words()')) === 'zzquokka' ? true : false;
}, test.limit.quick);

// the box: "A press opens the file over all of file: text for text, media for video, image and audio, fstat only for a file of
// unknown kind (❔)". Each of the three media files: pressed, judged four ways, closed.
async function mediaOpens(file, tag) {
  if (!W.page) return false;
  if (!W.namesBack) { await T('type("")'); await T('filter("in", "names")'); await waitFor('rows().indexOf("zzFiles/pic.png") !== -1'); W.namesBack = true; }
  const name = file.split('/').pop();
  await T('press(' + JSON.stringify(file) + ')');
  W.shown = await waitFor('count(' + JSON.stringify(tag) + ') > 0', 10000);
  return W.shown ? true : false;
}
async function mediaBar(name, icon) {
  if (!W.page) return false;
  return W.shown && barIs(await T('bars()'), icon + ' Media Viewer: ' + name) ? true : false;
}
async function mediaWhole(name) {
  if (!W.page) return false;
  return W.shown && (await T('pickers()')) === 1 && (await T('count(".CodeMirror")')) === 0 ? true : false;
}
async function mediaApart(name) {
  if (!W.page) return false;
  const own = String(await T('text()'));
  const apart = W.shown && times(own, new RegExp(name.replace('.', '\\.'), 'g')) === 1 && own.indexOf('MIME type') === -1;
  await T('close(' + JSON.stringify(name) + ')');
  await waitFor('rows().length > 0');
  return apart ? true : false;
}
test.run('pic.png opens in the media viewer, as an img', 0.2, function () { return mediaOpens('zzFiles/pic.png', 'img'); }, test.limit.quick);
test.run('pic.png has one bar, 🌇 Media Viewer: pic.png, with the file\'s own icon', 0.2, function () { return mediaBar('pic.png', '🌇'); }, test.limit.quick);
test.run('pic.png shows its whole self, the file picker too, and no text', 0.2, function () { return mediaWhole('pic.png'); }, test.limit.quick);
test.run('pic.png is shown apart from fstat, its name only in the bar and no facts', 0.2, function () { return mediaApart('pic.png'); }, test.limit.quick);
test.run('clip.mp4 opens in the media viewer, as a video', 0.2, function () { return mediaOpens('zzFiles/clip.mp4', 'video'); }, test.limit.quick);
test.run('clip.mp4 has one bar, 📹 Media Viewer: clip.mp4, with the file\'s own icon', 0.2, function () { return mediaBar('clip.mp4', '📹'); }, test.limit.quick);
test.run('clip.mp4 shows its whole self, the file picker too, and no text', 0.2, function () { return mediaWhole('clip.mp4'); }, test.limit.quick);
test.run('clip.mp4 is shown apart from fstat, its name only in the bar and no facts', 0.2, function () { return mediaApart('clip.mp4'); }, test.limit.quick);
test.run('song.mp3 opens in the media viewer, as an audio', 0.2, function () { return mediaOpens('zzFiles/song.mp3', 'audio'); }, test.limit.quick);
test.run('song.mp3 has one bar, 🔊 Media Viewer: song.mp3, with the file\'s own icon', 0.2, function () { return mediaBar('song.mp3', '🔊'); }, test.limit.quick);
test.run('song.mp3 shows its whole self, the file picker too, and no text', 0.2, function () { return mediaWhole('song.mp3'); }, test.limit.quick);
test.run('song.mp3 is shown apart from fstat, its name only in the bar and no facts', 0.2, function () { return mediaApart('song.mp3'); }, test.limit.quick);

// the box: "A picture or video is constrained as list boxes are: it fills the room it is given, never wider or taller"
test.run('the 2400 by 1600 picture pic.png is opened and drawn', 0.2, async function () {
  if (!W.page) return false;
  await T('press("zzFiles/pic.png")');
  W.drawn = await until(function () { return W.c.evaluate('(function () { var i = document.querySelector("#zzBox img"); return !!i && i.complete && i.naturalWidth === 2400; }())'); }, 10000);
  return W.drawn ? true : false;
}, test.limit.quick);
// The pane made w by h, and what the picture does in it: inside it both ways, under its bar; and shrunk, not cropped.
async function sizedInside(w, h) {
  if (!W.page) return false;
  const m = W.m = W.drawn ? await T('sized("img", ' + w + ', ' + h + ')') : { none: true };
  const inside = !m.none && m.left >= -1 && m.top >= -1 && m.right >= -1 && m.bottom >= -1 && m.w > 0 && m.h > 0;
  return inside && m.bar ? true : false;
}
function sizedShrunk() {
  const m = W.m || { none: true };
  return !m.none && m.fit !== 'cover' ? true : false;
}
test.run('in a pane 300 by 200 the picture stays inside it both ways, under its bar, still in view', 0.2, function () { return sizedInside(300, 200); }, test.limit.quick);
test.run('in a pane 300 by 200 it is shrunk, not cropped', 0.2, function () { return sizedShrunk(300, 200); }, test.limit.quick);
test.run('in a pane 1200 by 300 the picture stays inside it both ways, under its bar, still in view', 0.2, function () { return sizedInside(1200, 300); }, test.limit.quick);
test.run('in a pane 1200 by 300 it is shrunk, not cropped', 0.2, function () { return sizedShrunk(1200, 300); }, test.limit.quick);
test.run('in a pane 300 by 900 the picture stays inside it both ways, under its bar, still in view', 0.2, function () { return sizedInside(300, 900); }, test.limit.quick);
test.run('in a pane 300 by 900 it is shrunk, not cropped', 0.2, async function () {
  const r = sizedShrunk(300, 900);
  if (W.page) { await T('unsized()'); await T('close("pic.png")'); await waitFor('rows().length > 0'); }
  return r;
}, test.limit.quick);

// the box: text "separate from fstat", "No title line in text", and its row "a bubble of the same kind as rowForm uses"
test.run('notes.txt opens in text, no media', 0.2, async function () {
  if (!W.page) return false;
  await T('press("zzFiles/notes.txt")');
  return await waitFor('count(".CodeMirror") > 0', 10000) && (await T('count("img, video, audio")')) === 0 ? true : false;
}, test.limit.quick);
test.run('notes.txt is named only in the bar, with no title line and no facts', 0.2, async function () {
  if (!W.page) return false;
  const textLayer = String(await T('text()'));
  return times(textLayer, /notes\.txt/g) === 1 && textLayer.indexOf('MIME type') === -1 ? true : false;
}, test.limit.quick);
test.run('Save sits in a bubble of the kind rowForm uses', 0.2, async function () {
  if (!W.page) return false;
  return (await T('inBubble("Save")')) === true || false;
}, test.limit.quick);
test.run('the Save row is inline and folds: in a pane 120px wide nothing of it goes past its edge', 0.2, async function () {
  if (!W.page) return false;
  const folded = await T('folds("Save", 120)');
  const r = folded === true ? true : false;
  await T('close("notes.txt")');
  await waitFor('rows().length > 0');
  return r;
}, test.limit.quick);

// the box: fstat, "the facts (MIME type, size, changed, created) ... No name line"; no annotations since goal/G43.20
test.run('blob.zzq opens in fstat, its facts shown', 0.2, async function () {
  if (!W.page) return false;
  await T('press("zzFiles/blob.zzq")');
  W.facts = await waitFor('text().indexOf("MIME type") !== -1', 10000);
  return W.facts ? true : false;
}, test.limit.quick);
test.run('blob.zzq is shown under one bar in view, ending in its name', 0.2, async function () {
  if (!W.page) return false;
  return W.facts && barIs(await T('bars()'), /blob\.zzq$/) ? true : false;
}, test.limit.quick);
test.run('blob.zzq shows in fstat alone, with no text and no media', 0.2, async function () {
  if (!W.page) return false;
  return W.facts && (await T('count(".CodeMirror, img, video, audio")')) === 0 ? true : false;
}, test.limit.quick);
test.run('fstat has no name line: blob.zzq is named once, in the bar', 0.2, async function () {
  if (!W.page) return false;
  return W.facts && times(await T('text()'), /blob\.zzq/g) === 1 ? true : false;
}, test.limit.quick);
test.run('the facts read top down as MIME type, size, changed and created', 0.2, async function () {
  if (!W.page) return false;
  await waitFor('text().indexOf("Created") !== -1', 10000);
  const fstatText = W.fstatText = String(await T('text()'));
  const order = ['MIME type', 'Size', 'Changed', 'Created'].map(function (w) { return fstatText.indexOf(w); });
  return order.every(function (n, i) { return n !== -1 && (!i || n > order[i - 1]); }) ? true : false;
}, test.limit.quick);
test.run('fstat shows no annotations', 0.2, function () {
  if (W.fstatText === undefined) return false;
  return W.fstatText.indexOf('More Information') === -1 || false;
}, test.limit.quick);
test.run('fstat has no Open with in it', 0.2, async function () {
  if (W.fstatText === undefined) return false;
  const r = W.facts && !/Open with/i.test(W.fstatText) ? true : false;
  await T('close("blob.zzq")');
  return r;
}, test.limit.quick);

// nothing threw on the page
test.run('the page throws no uncaught error, all the way through', 0.2, async function () {
  if (!W.c) return false;
  const thrown = W.c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
  await stop(W.N.child);
  return !thrown.length || false;
}, test.limit.quick);
