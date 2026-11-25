'use strict';
// spirit/run/spirit/app/testicle/element/test/statusBox.js
// The tests of spirit/app/testicle/element/statusBox.js, and of no other module (goal/G47.1, box v134-142). Asked of a real
// browser on a real testicle: a scratch node with testicle turned on, a Chrome page on the element's DEBUG page, the box
// mounted there alone, and two scripts planted in the scratch tree, one whose own test holds and one whose own test fails,
// each run by a press of testicle.run. What the box shows comes from that testicle's own stream; nothing is fed by hand
// (box v142: "the status element's own test runs on a scratch node with testicle on and a real run, nothing fed by hand").
// THE STATUS BAR (goal/G47.4, the box, ### status bar): the icons in an inline block on the left, then two rows on top of
// each other; row 1 "<suites owed>: <suite file name>", row 2 "<tests reported>: <script file name>", the classifier the same
// way with "of <total being classified>"; no test titles and no results; both rows empty when no run is active; suites owed
// and classifications owed sent to a page once as it connects. The numbers are judged against the scratch testicle's own
// database, read only.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const H = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const REL = 'spirit/app/testicle/element/statusBox.js';
const { DatabaseSync } = require('node:sqlite');

const W = {};
const OK = 'spirit/zzBox/zzOk.js', OKS = 'spirit/zzBox/test/zzOk.js', BAD = 'spirit/zzBox/zzBad.js', BADS = 'spirit/zzBox/test/zzBad.js';
const SUITE_HEAD = "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));\n";
const ev = function (expr) { return W.page.evaluate(expr).catch(function () { return null; }); };
const ask = function (verb, args) {
  return fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) })
    .then(function (r) { return r.json(); }, function () { return null; });
};
// Idle for good: testicle says it is not busy, and still says so three seconds later (it rests a quiet second between the
// steps of one classification, and is not busy then).
const idle = function (ms) {
  return H.until(function () {
    return ask('testicle.busy', {}).then(function (b) {
      if (b !== false) return false;
      return new Promise(function (r) { setTimeout(r, 3000); }).then(function () { return ask('testicle.busy', {}); }).then(function (c) { return c === false; });
    });
  }, ms);
};
// The page's hands: mount the box alone, record every pair of rows and every busy icon it shows, in order, and whether the
// monitor the stream fills ever held a doing text.
// While a row reads anything it records how the number heading it is drawn: the row's first element, its width against its
// own em, its alignment, its text and whether it can be seen; each way it was drawn kept once, however often it shows.
const HANDS = '(function () { window.zz = { rows: [], icons: [], doing: false, nums: [], numsSeen: {},' +
  ' mount: function () { var b = document.createElement("div"); b.id = "zzA"; b.style.cssText = "width:500px;height:60px"; document.body.appendChild(b);' +
  '   window.m_zzA = window.spirit.required.spirit.app.testicle.element.statusBox.create(b);' +
  '   var note = function () { var r = document.querySelectorAll("#zzA .testicle-rows > .testicle-row"), i = document.querySelector("#zzA .testicle-busy"), m = document.querySelector("#zzA .testicle-mode");' +
  '     var pair = Array.prototype.map.call(r, function (x) { return String(x.textContent || "").trim(); }); var last = window.zz.rows[window.zz.rows.length - 1];' +
  '     if (pair.length === 2 && (!last || last[0] !== pair[0] || last[1] !== pair[1])) window.zz.rows.push(pair);' +
  '     Array.prototype.forEach.call(r, function (x) { if (!String(x.textContent || "").trim()) return; var n = x.firstElementChild; var s = { none: !n };' +
  '       if (n) { var c = getComputedStyle(n); s = { w: n.getBoundingClientRect().width, em: parseFloat(c.fontSize), align: c.textAlign, txt: String(n.textContent || "").trim(), seen: c.visibility !== "hidden" && c.display !== "none" && c.opacity !== "0" }; }' +
  '       var k = JSON.stringify(s); if (!window.zz.numsSeen[k]) { window.zz.numsSeen[k] = true; window.zz.nums.push(s); } });' +
  '     var g = i ? String(i.innerText || i.textContent || "").trim() : ""; if (g && g !== window.zz.icons[window.zz.icons.length - 1]) window.zz.icons.push(g);' +
  '     window.zz.mode = m ? String(m.innerText || m.textContent || "").trim() : "";' +
  '     try { var mo = window.spirit.required.spirit.data.testicle.data.monitor.get(); if (mo && mo.doing) window.zz.doing = true; } catch (e) {} };' +
  '   note(); new MutationObserver(note).observe(b, { subtree: true, childList: true, characterData: true }); setInterval(note, 200); return true; },' +
  '}; return true; }())';
// What testicle's database says is owed, read only: suites marked needs running (a suite counted once, however many of its
// scripts are marked), and scripts marked for classification.
const owedInDb = function () {
  let db = null;
  try {
    db = new DatabaseSync(path.join(W.node.root, 'spirit', 'run', 'spirit', 'state', 'app', 'testicle', 'data', 'testicle.db'), { readOnly: true });
    db.exec('PRAGMA busy_timeout = 5000');
    const suites = db.prepare('SELECT COUNT(DISTINCT suite) AS n FROM suite WHERE test = 1 AND deleted = 0').get().n;
    const classifications = db.prepare('SELECT COUNT(*) AS n FROM script WHERE reClassify = 1 AND deleted = 0').get().n;
    return { suites: Number(suites), classifications: Number(classifications) };
  } catch (e) { return null; } finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
};
// "<n>: <file>"; a zero may be drawn as no digits at all (goal/G47.4, Andy: "invisible when zero").
const NUM_NAME = /^(\d*):? ?(\S+)$/;

test.run('spirit/app/testicle/element/statusBox.js exists', 0.2, function () {
  return fs.existsSync(path.join(RUN, REL)) || false;
}, test.limit.quick);
test.run('Chrome is on this machine', 0.2, function () {
  W.chrome = H.findChrome();
  return !!W.chrome || false;
}, test.limit.quick);
test.run('a scratch node comes up with its DEBUG on and testicle on', 0.2, async function () {
  W.node = await H.scratchNode({ servers: ['testicle'] });
  return (W.node.up && W.node.debug) || false;
}, test.limit.slow);
test.run('a page loads the box by itself and mounts it alone', 0.2, async function () {
  if (!W.chrome || !W.node || !W.node.up) return false;
  W.page = await H.chromePage(W.chrome);
  if (W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  W.ok = await H.until(function () { return ev('!!(window.spirit && window.spirit.required && window.spirit.required.spirit && window.spirit.required.spirit.app && window.spirit.required.spirit.app.testicle && window.spirit.required.spirit.app.testicle.element.statusBox)').then(function (v) { return v === true; }); }, H.WAIT);
  if (W.ok) { await ev(HANDS); W.ok = (await ev('window.zz.mount()')) === true; }
  return !!W.ok || false;
}, test.limit.slow);
test.after(function () {
  if (W.page && W.page.kid) W.page.kid.kill();
  if (W.node && W.node.child) W.node.child.kill();
  try { if (W.page && W.page.profile) fs.rmSync(W.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (W.node && W.node.root) SPIRIT.requireScript('spirit/test/headLessChrome.js').freeTree(W.node); } catch (e) { /* left */ }
});

test.run('when mounted, it puts one box into its container with the mode and the busy icon', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var b = document.getElementById("zzA"); return { kids: b.children.length, mode: !!b.querySelector(".testicle-mode"), busy: !!b.querySelector(".testicle-busy") }; }())');
  return (r && r.kids === 1 && r.mode && r.busy) || false;
}, test.limit.quick);
// The box: "the status icons in an inline block on the left edge; after it, a second inline block of two rows on top of each
// other, so the icons get the extra height."
test.run('its icons stand in a block on the left, and right of it a block of two rows, one above the other', 0.4, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var b = document.getElementById("zzA"); var ic = b.querySelector(".testicle-icons"), ro = b.querySelector(".testicle-rows"); if (!ic || !ro) return null;' +
    ' var rows = ro.querySelectorAll(":scope > .testicle-row"); if (rows.length !== 2) return null; var a = ic.getBoundingClientRect(), c = ro.getBoundingClientRect(), r1 = rows[0].getBoundingClientRect(), r2 = rows[1].getBoundingClientRect();' +
    ' return { icons: !!ic.querySelector(".testicle-mode") && !!ic.querySelector(".testicle-busy"), left: a.right <= c.left + 1, stacked: r2.top >= r1.bottom - 1 }; }())');
  return (!!r && r.icons && r.left && r.stacked) || false;
}, test.limit.quick);
// goal/G47.4, Andy: "status bar: the icons must be of size 2m." (taken as 2em: twice the font size of the box's container).
// goal/G47.4, Andy: "the whole status block in a bubble, the icons vertically centered in that bubble.", then "the two
// icons should be vertically centered": the box is the shared bubble, holding the icons and the rows; each icon's glyph
// stands with its middle at the middle of the bubble's inside, within a pixel and a half.
test.run('the whole status block is one shared bubble holding the icons and the two rows', 0.4, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var s = document.querySelector("#zzA .testicle-status"); return !!s && s.classList.contains("shell-bubble") && !!s.querySelector(".testicle-icons") && !!s.querySelector(".testicle-rows"); }())');
  return r === true || false;
}, test.limit.quick);
// Each icon glyph's distance from the middle of the bubble's inside, in pixels; 99 for one not drawn yet.
const CENTRED = '(function () { var s = document.querySelector("#zzA .testicle-status"); if (!s) return null; var b = s.getBoundingClientRect(), c = getComputedStyle(s);' +
    ' var top = b.top + parseFloat(c.borderTopWidth) + parseFloat(c.paddingTop), bottom = b.bottom - parseFloat(c.borderBottomWidth) - parseFloat(c.paddingBottom), mid = (top + bottom) / 2;' +
    ' return Array.prototype.map.call(s.querySelectorAll(".testicle-mode, .testicle-busy"), function (x) { var g = document.createRange(); g.selectNodeContents(x); var q = g.getBoundingClientRect(); return q.height > 0 ? Math.abs((q.top + q.bottom) / 2 - mid) : 99; }); }())';
test.run('its mode and busy icons stand vertically centred in the bubble', 0.4, async function () {
  if (!W.ok) return false;
  // Waited for: the icons are drawn once the icon element has loaded, a moment after the mount; measured before that, each
  // reads 99, not drawn.
  const ok = function (v) { return Array.isArray(v) && v.length === 2 && v.every(function (d) { return d <= 1.5; }); };
  let r = null;
  await H.until(function () { return ev(CENTRED).then(function (v) { r = v; return ok(v); }); }, H.WAIT);
  return ok(r) || false;
}, test.limit.slow);
test.run('its mode and busy icons are drawn at 2em, twice the font size of its container', 0.4, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var b = document.getElementById("zzA"), m = b.querySelector(".testicle-mode"), i = b.querySelector(".testicle-busy"); if (!m || !i) return null; var f = parseFloat(getComputedStyle(b).fontSize); return [m, i].every(function (x) { return Math.abs(parseFloat(getComputedStyle(x).fontSize) - 2 * f) < 0.5; }); }())');
  return r === true || false;
}, test.limit.quick);
test.run('it shows the mode the node\'s testicle stands at: 🖖, interactive, as the node answers it', 0.2, async function () {
  if (!W.ok) return false;
  const p = await ask('testicle.preferences', {});
  const want = p && (p.preferences || p).interactive === false ? '🤖' : '🖖';
  const ok = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === want; }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
test.run('testicle has classified the scratch tree and is idle', 0.2, async function () {
  if (!W.ok) return false;
  return (await idle(280000)) || false;
}, test.limit.long);
test.run('when testicle is idle, the box shows 🛌', 0.2, async function () {
  if (!W.ok) return false;
  const ok = await H.until(function () { return ev('window.zz.icons[window.zz.icons.length - 1]').then(function (g) { return /🛌/.test(String(g)); }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
// The box: "when no run is active, both rows are empty: no dangling info once testicle goes idle."
const EMPTY_ROWS = '(function () { var r = document.querySelectorAll("#zzA .testicle-rows > .testicle-row"); return r.length === 2 && Array.prototype.every.call(r, function (x) { return String(x.textContent || "").trim() === ""; }); }())';
test.run('once testicle is idle after classifying, both rows are empty', 0.4, async function () {
  if (!W.ok) return false;
  const ok = await H.until(function () { return ev(EMPTY_ROWS).then(function (v) { return v === true; }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
// A CLASSIFICATION WATCHED FROM ITS START: the scratch tree is classified before the box can be sure to be watching, so thirty
// scripts are planted at once while it watches, and classified as one batch; enough that it lasts seconds, not a blink a
// page's watch would see only the end of.
const CLS = Array.from({ length: 30 }, function (x, i) { return 'spirit/zzBox/zzC' + (i + 1) + '.js'; });
test.run('thirty scripts planted at once are classified while the box watches, and testicle is idle again', 0.2, async function () {
  if (!W.ok) return false;
  await idle(60000);
  W.fromClassify = await ev('window.zz.rows.length');
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzBox', 'test'), { recursive: true });
  CLS.forEach(function (f) { fs.writeFileSync(path.join(run, f), "'use strict';\n// " + f + "\n"); });
  W.walked = !!(await H.until(function () { return ev('(function () { var i = document.querySelector("#zzA .testicle-busy"); return i ? String(i.innerText || i.textContent || "") : ""; }())').then(function (g) { return /🚶/.test(String(g)); }); }, 60000));
  return (await idle(280000)) || false;
}, test.limit.long);
test.run('while testicle classified them, the box showed its walking icon', 0.2, async function () {
  return W.walked === true || false;
}, test.limit.quick);
// The box: "during classification: row 1 is suites owed, as it stands, then the classifier's file name; row 2 counts up with
// every file classified, then "of <total being classified>" and the script file name."
const CLASSIFYING = /^(\d+) of (\d+):? (\S+\.js)$/;
test.run('while classifying, row 1 read the suites owed and the classifier\'s file name', 0.4, async function () {
  if (!W.ok || W.fromClassify == null) return false;
  const rows = (await ev('window.zz.rows.slice(' + W.fromClassify + ')')) || [];
  return rows.some(function (p) { const m = NUM_NAME.exec(p[0]); return !!m && /(^|\/)scriptClassify\.js$/.test(m[2]); }) || false;
}, test.limit.quick);
test.run('while classifying, row 2 read "<n> of <total>" and a script file name, n counting up', 0.4, async function () {
  if (!W.ok || W.fromClassify == null) return false;
  const rows = (await ev('window.zz.rows.slice(' + W.fromClassify + ')')) || [];
  const ns = rows.map(function (p) { const m = CLASSIFYING.exec(p[1]); return m && Number(m[1]) <= Number(m[2]) ? Number(m[1]) : null; }).filter(function (n) { return n !== null; });
  const up = ns.every(function (n, i) { return i === 0 || n >= ns[i - 1]; });
  return (ns.length > 1 && ns[ns.length - 1] > ns[0] && up) || false;
}, test.limit.quick);
// A run whose test holds, and one whose test fails: what the box says comes from the scratch testicle's stream.
test.run('zzOk.js and zzBad.js are planted with their own tests, and testicle is idle again', 0.2, async function () {
  if (!W.ok) return false;
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzBox', 'test'), { recursive: true });
  fs.writeFileSync(path.join(run, OK), "'use strict';\n// zzOk\n");
  fs.writeFileSync(path.join(run, BAD), "'use strict';\n// zzBad\n");
  fs.writeFileSync(path.join(run, OKS), SUITE_HEAD + "test.run('zzOk holds', 0.2, function () { return true; }, test.limit.quick);\n");
  fs.writeFileSync(path.join(run, BADS), SUITE_HEAD + "test.run('zzBad fails', 0.2, function () { return false; }, test.limit.quick);\n");
  await H.until(function () { return ask('testicle.suite.search', { script: OK, text: '' }).then(function (r) { return !!(r && (r.items || []).length); }); }, 60000);
  return (await idle(280000)) || false;
}, test.limit.long);
// The box: "row 1: <suites owed>: <suite file name>", "row 2: <tests reported>: <script file name>", "no test titles and no
// results of suites or tests in the bar."
const runRows = async function (script, suite) {
  await idle(60000);
  const from = await ev('window.zz.rows.length');
  const r = await ask('testicle.run', { script: script, suite: suite });
  if (!r || r.started !== true) return null;
  await H.until(function () { return ev('window.zz.rows.slice(' + from + ')').then(function (rows) { return (rows || []).some(function (p) { const m = NUM_NAME.exec(p[1]); return !!m && Number(m[1]) >= 1; }); }); }, 120000);
  await idle(120000);
  // The rows drawn while the run was on: since goal/G48.4 the idle bar names the reds' leaders, so the pair it shows once idle,
  // the last one drawn, is left out with every copy of it at the end.
  const all = (await ev('window.zz.rows.slice(' + from + ')')) || [];
  const last = JSON.stringify(all[all.length - 1]);
  while (all.length && JSON.stringify(all[all.length - 1]) === last) all.pop();
  return all;
};
const names = function (row, file) { const m = NUM_NAME.exec(row); return !!m && (m[2] === file || m[2].endsWith('/' + file.slice(file.lastIndexOf('/') + 1))); };
test.run('while zzOk\'s own suite runs, row 1 reads a number and its suite\'s file name', 0.4, async function () {
  if (!W.ok) return false;
  W.okRows = await runRows(OK, OKS);
  return (W.okRows || []).some(function (p) { return names(p[0], OKS); }) || false;
}, test.limit.long);
test.run('while zzOk\'s own suite runs, row 2 reads the tests reported, 1, and the script\'s file name', 0.4, function () {
  return (W.okRows || []).some(function (p) { const m = NUM_NAME.exec(p[1]); return !!m && m[1] === '1' && names(p[1], OK); }) || false;
}, test.limit.quick);
const noTitleNoResult = function (rows, title) { return rows.length > 0 && !rows.some(function (p) { return p.join(' ').indexOf(title) !== -1 || /✅|❌|reported/.test(p.join(' ')); }); };
test.run('while zzOk\'s suite runs, neither row names its test title or a result', 0.4, function () {
  return noTitleNoResult(W.okRows || [], 'zzOk holds') || false;
}, test.limit.quick);
test.run('while zzBad\'s own suite runs, its rows read its suite and script, and neither names its title or a result', 0.4, async function () {
  if (!W.ok) return false;
  const rows = await runRows(BAD, BADS);
  return ((rows || []).some(function (p) { return names(p[0], BADS) && names(p[1], BAD); }) && noTitleNoResult(rows || [], 'zzBad fails')) || false;
}, test.limit.long);
// goal/G47.4, Andy: "the two numbers, starting the tow rows must be fixed width, 6em, right aligned, and invisible when zero.",
// then: "a width of 4em for the two numbers is likely enough."
// Judged on every row drawn through classifying and both runs.
const NUM_OF = function (s) { const m = /^(\d*)/.exec(s.txt || ''); return m[1] === '' ? 0 : Number(m[1]); };
test.run('through classifying and both runs, every row began with its number in an element of its own, 4em wide, right aligned', 0.4, async function () {
  if (!W.ok) return false;
  const nums = (await ev('window.zz.nums')) || [];
  return (nums.length > 0 && nums.every(function (s) { return !s.none && s.em > 0 && Math.abs(s.w - 4 * s.em) < 1 && (s.align === 'right' || s.align === 'end'); })) || false;
}, test.limit.quick);
test.run('through classifying and both runs, a number that was zero was never seen, and one that was not was', 0.4, async function () {
  if (!W.ok) return false;
  const nums = ((await ev('window.zz.nums')) || []).filter(function (s) { return !s.none; });
  const zero = nums.filter(function (s) { return NUM_OF(s) === 0; });
  const more = nums.filter(function (s) { return NUM_OF(s) > 0; });
  return (zero.length > 0 && more.length > 0 && zero.every(function (s) { return !s.seen || s.txt === ''; }) && more.every(function (s) { return s.seen; })) || false;
}, test.limit.quick);
// WHEN IDLE, THE LARGEST CONTRIBUTORS TO THE REDS (goal/G48.4; Andy: "when idle, the status bar could show the most relevant
// information regarding these priorities?", "would knowledge of the largest contributors to the reds help in prioritizing a
// fixing strategy?", then "agreed on the how of streaming the info... then go!"; cw, agreed: "Row 1 could show the test red for
// the most scripts, with its count and its suite; row 2 the script with the most reds, with its count"). Counted from
// testicle's database, read only: the current failed rows, by suite and title, and by script; a leader tied with another may
// be either.
const leadersInDb = function () {
  let db = null;
  try {
    db = new DatabaseSync(path.join(W.node.root, 'spirit', 'run', 'spirit', 'state', 'app', 'testicle', 'data', 'testicle.db'), { readOnly: true });
    db.exec('PRAGMA busy_timeout = 5000');
    const tests = db.prepare('SELECT suite, test, COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0 GROUP BY suite, test ORDER BY n DESC').all();
    const scripts = db.prepare('SELECT script, COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0 GROUP BY script ORDER BY n DESC').all();
    const top = function (l) { return l.filter(function (x) { return l.length && Number(x.n) === Number(l[0].n); }); };
    return { tests: top(tests), scripts: top(scripts) };
  } catch (e) { return null; } finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
};
const ROWS_NOW = '(function () { return Array.prototype.map.call(document.querySelectorAll("#zzA .testicle-rows > .testicle-row"), function (x) { return String(x.textContent || "").trim(); }); }())';
const holds = function (row, n, words) { return String(row).indexOf(String(n)) !== -1 && words.some(function (w) { return !!w && String(row).indexOf(w) !== -1; }); };
const fileOf = function (f) { return String(f).slice(String(f).lastIndexOf('/') + 1); };
// The stream carries them: monitor.get().leaders, { test: { suite, test, n }, script: { script, n } } (cw's field).
test.run('the stream carries the test red for the most scripts and the script with the most reds, as the database counts them', 0.4, async function () {
  if (!W.ok) return false;
  let got = null, L = null;
  const ok = await H.until(function () { return ev('(function () { try { return JSON.stringify(window.spirit.required.spirit.data.testicle.data.monitor.get().leaders || null); } catch (e) { return null; } }())').then(function (t) {
    got = t ? JSON.parse(t) : null; L = leadersInDb();
    return !!got && !!L && !!got.test && !!got.script && L.tests.some(function (x) { return x.suite === got.test.suite && x.test === got.test.test && Number(x.n) === Number(got.test.n); }) && L.scripts.some(function (x) { return x.script === got.script.script && Number(x.n) === Number(got.script.n); });
  }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
test.run('once the runs are over and reds are left, row 1 names the test red for the most scripts, with its count', 0.4, async function () {
  if (!W.ok) return false;
  let rows = null, L = null;
  await H.until(function () { return ev(ROWS_NOW).then(function (r) { rows = r; L = leadersInDb(); return !!L && L.tests.length > 0 && Array.isArray(r) && r.length === 2 && L.tests.some(function (t) { return holds(r[0], t.n, [t.test, fileOf(t.suite)]); }); }); }, H.WAIT);
  W.leaders = { rows: rows, L: L };
  return (!!L && L.tests.length > 0 && Array.isArray(rows) && L.tests.some(function (t) { return holds(rows[0], t.n, [t.test, fileOf(t.suite)]); })) || false;
}, test.limit.slow);
test.run('once the runs are over and reds are left, row 2 names the script with the most reds, with its count', 0.4, function () {
  const w = W.leaders;
  return (!!w && !!w.L && w.L.scripts.length > 0 && Array.isArray(w.rows) && w.L.scripts.some(function (x) { return holds(w.rows[1], x.n, [fileOf(x.script), x.script]); })) || false;
}, test.limit.quick);
// The box: "the doing text goes: nothing reads it."
test.run('through classifying and both runs, the stream never brought a doing text', 0.4, async function () {
  if (!W.ok) return false;
  return (await ev('window.zz.doing')) === false || false;
}, test.limit.quick);
test.run('its box keeps what it holds inside, with overflow hidden, each row one line, ellipsed', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { var s = document.querySelector("#zzA .testicle-status"), l = document.querySelectorAll("#zzA .testicle-rows > .testicle-row"); if (!s || l.length !== 2) return null; return { box: getComputedStyle(s).overflow, rows: Array.prototype.every.call(l, function (x) { var c = getComputedStyle(x); return c.whiteSpace === "nowrap" && c.textOverflow === "ellipsis"; }) }; }())');
  return (!!r && r.box === 'hidden' && r.rows) || false;
}, test.limit.quick);
// box v143: "all of testicle's elements must subscribe to the data they display": the mode set on the node after the
// box was drawn shows in it by itself, from the stream, with no new mount.
test.run('with the node set to auto the box shows 🤖 by itself, and set back to interactive it shows 🖖', 0.4, async function () {
  if (!W.ok) return false;
  await idle(60000);
  const a = await ask('testicle.preferences', { interactive: false });
  if (!a) return false;
  const auto = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🤖'; }); }, H.WAIT);
  const b = await ask('testicle.preferences', { interactive: true });
  if (!b) return false;
  const back = await H.until(function () { return ev('window.zz.mode').then(function (m) { return m === '🖖'; }); }, H.WAIT);
  return (!!auto && !!back) || false;
}, test.limit.long);
// SUITES OWED (the box: "suites owed is the number of suites marked needs running, in the current run or not; it counts
// down as suites report their final status and goes up as changes and classifications mark more. a general suite counts
// once"): two scripts planted while interactive, each with an own suite that takes 15 s; set to auto, row 1's number is the
// suites testicle's database holds marked, and as suites run it follows them down.
const W1 = 'spirit/zzBox/zzWait1.js', W1S = 'spirit/zzBox/test/zzWait1.js', W2 = 'spirit/zzBox/zzWait2.js', W2S = 'spirit/zzBox/test/zzWait2.js';
const ROW1 = '(function () { var r = document.querySelector("#zzA .testicle-rows > .testicle-row"); var m = r ? /^(\\d+): /.exec(String(r.textContent || "").trim()) : null; return m ? Number(m[1]) : null; }())';
test.run('in auto mode, row 1\'s number is the count of suites testicle\'s database holds marked needs running', 0.4, async function () {
  if (!W.ok) return false;
  await idle(60000);
  const run = path.join(W.node.root, 'spirit', 'run');
  fs.writeFileSync(path.join(run, W1), "'use strict';\n// zzWait1\n");
  fs.writeFileSync(path.join(run, W2), "'use strict';\n// zzWait2\n");
  [W1S, W2S].forEach(function (f) { fs.writeFileSync(path.join(run, f), SUITE_HEAD + "test.run('it waits a while', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 15000); }); }, test.limit.slow);\n"); });
  await H.until(function () { return ask('testicle.suite.search', { script: W2, text: '' }).then(function (r) { return !!(r && (r.items || []).length); }); }, 60000);
  const a = await ask('testicle.preferences', { interactive: false });
  if (!a) return false;
  let seen = null;
  await H.until(function () { return ev(ROW1).then(function (n) { const o = owedInDb(); if (n !== null && n >= 1 && o && n === o.suites) seen = n; return seen !== null; }); }, 60000);
  W.owedSeen = seen || 0;
  return seen !== null || false;
}, test.limit.long);
test.run('as suites report, row 1\'s number follows them down: still the count marked, and lower than before', 0.4, async function () {
  if (!W.owedSeen) return false;
  const first = W.owedSeen;
  let later = null;
  await H.until(function () { return ev(ROW1).then(function (n) { const o = owedInDb(); if (n !== null && o && n === o.suites && n < first) later = n; return later !== null; }); }, 240000);
  await ask('testicle.preferences', { interactive: true });
  return later !== null || false;
}, test.limit.long);
// THE NUMBER OF REDS (goal/G48.4; Andy: "what's the cost of streaming the number of reds, and displaying it in a large, RED box
// at the right windows edge of the status bar????", then "NOW! including test."; cw, as built: "a red that comes or goes
// changes the number in the box without a press"). The reds are the current rows testicle's database holds failed, read only.
const redsInDb = function () {
  let db = null;
  try {
    db = new DatabaseSync(path.join(W.node.root, 'spirit', 'run', 'spirit', 'state', 'app', 'testicle', 'data', 'testicle.db'), { readOnly: true });
    db.exec('PRAGMA busy_timeout = 5000');
    return Number(db.prepare('SELECT COUNT(*) AS n FROM testicle WHERE current = 1 AND verified = 0').get().n);
  } catch (e) { return null; } finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
};
// The box drawn in red: the element of the status bar whose text is a number alone and whose colour or background is red;
// where it stands against the status bar it is drawn in (that bar's inner right edge, inside its bubble's padding), how large its number is drawn against the bar's font, and how wide the box is in its own em.
const RED_BOX = '(function () { var b = document.getElementById("zzA"); if (!b) return null; var bar = b.getBoundingClientRect();' +
  ' var red = function (c) { var m = /rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/.exec(c || ""); return !!m && (m[4] === undefined || Number(m[4]) > 0) && Number(m[1]) >= 150 && Number(m[2]) <= 110 && Number(m[3]) <= 110; };' +
    ' var hit = Array.prototype.filter.call(b.querySelectorAll("*"), function (e) { if (e.children.length) return false; var t = String(e.textContent || "").trim(); if (!/^\\d+$/.test(t)) return false;' +
  '   if (!e.getClientRects().length) return false; var c = getComputedStyle(e); if (c.visibility === "hidden" || c.opacity === "0") return false;' +
  '   for (var x = e; x && x !== b; x = x.parentElement) { var s = getComputedStyle(x); if (red(s.color) || red(s.backgroundColor)) return true; } return false; })[0];' +
  ' if (!hit) return JSON.stringify({ none: true });' +
  ' var box = hit; for (var x = hit; x && x !== b; x = x.parentElement) { var s = getComputedStyle(x); if (red(s.backgroundColor) || red(s.borderTopColor) && parseFloat(s.borderTopWidth) > 0) box = x; }' +
  ' var r = box.getBoundingClientRect(); var sb = box.parentElement && box.parentElement !== b ? box.parentElement : b; var sr = sb.getBoundingClientRect(), sc = getComputedStyle(sb);' +
  ' var inner = sr.right - parseFloat(sc.paddingRight) - parseFloat(sc.borderRightWidth); return JSON.stringify({ n: Number(String(hit.textContent).trim()), right: r.right, barRight: inner, px: parseFloat(getComputedStyle(hit).fontSize), barPx: parseFloat(getComputedStyle(b).fontSize), w: r.width, boxPx: parseFloat(getComputedStyle(box).fontSize) }); }())';
const redBox = function () { return ev(RED_BOX).then(function (t) { return t ? JSON.parse(t) : null; }); };
const streamedReds = function () { return ev('(function () { try { var m = window.spirit.required.spirit.data.testicle.data.monitor.get(); return m && typeof m.reds === "number" ? m.reds : null; } catch (e) { return null; } }())'); };
test.run('the stream carries the number of reds, as testicle\'s database counts its current failed rows', 0.4, async function () {
  if (!W.ok) return false;
  await idle(120000);
  let got = null, want = null;
  await H.until(function () { return streamedReds().then(function (n) { got = n; want = redsInDb(); return n !== null && n === want && n > 0; }); }, H.WAIT);
  W.reds = got;
  return (got !== null && got === want && got > 0) || false;
}, test.limit.slow);
test.run('the status bar shows that number in a red box', 0.4, async function () {
  if (W.reds === undefined || W.reds === null) return false;
  let b = null;
  await H.until(function () { return redBox().then(function (x) { b = x; return !!x && x.n === W.reds; }); }, H.WAIT);
  W.box = b;
  return (!!b && !b.none && b.n === W.reds) || false;
}, test.limit.slow);
test.run('the red box stands at the right edge of the status bar', 0.4, function () {
  const b = W.box;
  return (!!b && !b.none && Math.abs(b.barRight - b.right) <= 2) || false;
}, test.limit.quick);
// Andy: "the box is at the right window edge or the status bar, double large, like the icons on the right side of the status bar,
// fixed width 3em".
test.run('the red box\'s number is double large: 2em, twice the font size of the bar, as its icons are', 0.4, function () {
  const b = W.box;
  return (!!b && !b.none && b.barPx > 0 && Math.abs(b.px - 2 * b.barPx) < 0.5) || false;
}, test.limit.quick);
test.run('the red box is a fixed 3em wide', 0.4, function () {
  const b = W.box;
  return (!!b && !b.none && b.boxPx > 0 && Math.abs(b.w - 3 * b.boxPx) < 1) || false;
}, test.limit.quick);
test.run('a red set on the node raises the number in the box, with no press', 0.4, async function () {
  if (!W.box || W.box.none) return false;
  const r = await ask('testicle.testicle.set', { script: OK, suite: OKS, test: 'zzOk holds', verified: false, severity: 0.2 });
  if (!r || r.ok === false) return false;
  const ok = await H.until(function () { return redBox().then(function (x) { return !!x && x.n === W.reds + 1 && x.n === redsInDb(); }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
test.run('the red cleared on the node lowers the number in the box again, with no press', 0.4, async function () {
  if (!W.box || W.box.none) return false;
  const r = await ask('testicle.testicle.set', { script: OK, suite: OKS, test: 'zzOk holds', verified: true, severity: 0.2 });
  if (!r || r.ok === false) return false;
  const ok = await H.until(function () { return redBox().then(function (x) { return !!x && x.n === W.reds && x.n === redsInDb(); }); }, H.WAIT);
  return !!ok || false;
}, test.limit.slow);
// The box: "on connect: a page that connects to testicle's stream is sent the current suites-owed and classifications-owed
// numbers once, so a page opened or reloaded while nothing changes shows them at once". A page loaded anew while testicle is
// idle and nothing is marked or unmarked holds both, as the database says them, with no change between.
test.run('a page loaded anew while nothing changes is sent suites owed and classifications owed, as the database holds them', 0.4, async function () {
  if (!W.ok) return false;
  await idle(240000);
  await W.page.send('Page.navigate', { url: W.node.base + '/DEBUG/' + REL.replace(/\.js$/, '') + '/headLessBrowser.html' });
  const up = await H.until(function () { return ev('!!(window.spirit && window.spirit.required && window.spirit.required.spirit && window.spirit.required.spirit.app && window.spirit.required.spirit.app.testicle && window.spirit.required.spirit.app.testicle.element.statusBox)').then(function (v) { return v === true; }); }, H.WAIT);
  if (!up) return false;
  await ev(HANDS); await ev('window.zz.mount()');
  let got = null;
  await H.until(function () { return ev('(function () { try { var o = window.spirit.required.spirit.data.testicle.data.monitor.get().owed; return o ? JSON.stringify(o) : null; } catch (e) { return null; } }())').then(function (t) { got = t ? JSON.parse(t) : null; return !!got; }); }, H.WAIT);
  const o = owedInDb();
  return (!!got && !!o && got.suites === o.suites && got.classifications === o.classifications) || false;
}, test.limit.long);
test.run('once the box is destroyed, its container is empty', 0.2, async function () {
  if (!W.ok) return false;
  const r = await ev('(function () { window.m_zzA.destroy(); return document.getElementById("zzA").innerHTML; }())');
  return r === '' || false;
}, test.limit.quick);
