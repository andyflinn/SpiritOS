'use strict';

// spirit/run/spirit/app/testicle/element/search/testicle/test/detail.js
// The tests of spirit/app/testicle/element/search/testicle/detail.js, and of no other module (spec: ./detail.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72). One test's detail: its
// history of flips, what testicle's face shows in a closable tab when a test row is clicked.
//
// The world of spirit/element/search/test/testicle.js, as it is: a real node on a scratch copy of the tracked files,
// testicle turned on there, the general suites stubbed, tests of planted scripts set through testicle.testicle.set, and
// the detail mounted alone in a real Chrome on / (spirit/shell/face.html). Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../../..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = S.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = S.requireScript('spirit/test/testReport.js');
const { freePort, until, sleep, chromePage, findChrome } = S.requireScript('spirit/test/headLessChrome.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'testicle', 'detail.js');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzTdetail/';
const A = Z + 'alpha.js';
const AS = Z + 'test/alpha.js';
const PLANT = {};
PLANT[A] = '\'use strict\';\n// alpha\n';
PLANT[AS] = '\'use strict\';\n// the test of alpha\n';
// The test whose history is shown, a long title, flipped three times; and another test of the same suite.
const FLIPS = 'alpha flips between passing and failing, and this long title of it is shown in full above its history';
const OTHER = 'alpha does something else';

function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'app', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  // THE GENERAL SUITES TAKEN AWAY, as spirit/element/search/test/testicle.js does: each keeps its name, so its reach, and
  // judges and reports nothing.
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return /(^|\/)test\/[^/]*-(sibling|child)-[^/]*\.js$/.test(f); })
    .forEach(function (f) { fs.writeFileSync(path.join(root, f), '\'use strict\';\n// a stub in this scratch tree: it judges nothing\n'); });
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
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
function base(p) { return p.slice(p.lastIndexOf('/') + 1); }

// What the tests share, made by the tests in order.
let s = null, N = null, c = null, made = '', planted = false;
const keys = [];
const live = [];
const mounted = function () { return !N || !N.up || !c || !!c.error || !c.evaluate || made !== 'made' || !planted; };
// What the box shows: its title line, its headers, and each row's key and cells.
const view = function (id) {
  return c.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); if (!b) return null; var t = b.querySelector("[data-history=\\"title\\"]");' +
    ' return { html: b.innerHTML, title: t ? t.textContent : null, heads: Array.prototype.map.call(b.querySelectorAll("th"), function (h) { return String(h.textContent || "").trim(); }),' +
    ' rows: Array.prototype.map.call(b.querySelectorAll("tbody tr"), function (r) { return { key: r.getAttribute("data-key"), cells: Array.prototype.map.call(r.querySelectorAll("td"), function (td) { return String(td.innerText || "").trim(); }) }; }) }; }())');
};
const mount = function (id, opts) {
  return c.evaluate('(function () { var E = (((((((window.spirit || {}).app || {}).testicle || {}).element || {}).search || {}).testicle || {}).detail); if (!E || typeof E.create !== "function") return false;' +
    ' var b = document.createElement("div"); b.id = ' + JSON.stringify(id) + '; document.body.appendChild(b); window[' + JSON.stringify(id) + '] = E.create(b, ' + JSON.stringify(opts) + ');' +
    ' return window[' + JSON.stringify(id) + '] && typeof window[' + JSON.stringify(id) + '].destroy === "function" ? "made" : false; }())');
};

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

test.run('spirit/app/testicle/element/search/testicle/detail.js is there', 0.2, function () {
  return fs.existsSync(MODULE) || false;
}, test.limit.quick);
test.run('a scratch node comes up with testicle on', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return false;
  // Its testicle answers once its app server runs, a moment after the node.
  N.up = !!(await until(function () { return call(N.base, 'spirit.app.testicle.busy').then(function (r) { return r.status === 200; }); }, 30000));
  return N.up || false;
}, test.limit.long);
test.run('the test flips three times, passing, failing and passing, and another test of its suite is set', 0.2, async function () {
  if (!N || !N.up) return false;
  const out = [];
  for (const v of [true, false, true]) { out.push(await call(N.base, 'spirit.app.testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: v, severity: 0.3 })); await sleep(1100); }
  out.push(await call(N.base, 'spirit.app.testicle.testicle.set', { script: A, suite: AS, test: OTHER, verified: false, severity: 0.5 }));
  planted = out.every(function (r) { return r.status === 200; });
  out.slice(0, 3).forEach(function (r) { if (r.body && r.body.key) keys.push(r.body.key); });
  return (planted && keys.length === 3 && new Set(keys).size === 3) || false;
}, test.limit.slow);
test.run('the face page has its spirit', 0.2, async function () {
  if (!N || !N.up) return false;
  const where = findChrome();
  if (!where) return false;
  c = await chromePage(where);
  if (c.error) return false;
  await c.send('Page.navigate', { url: N.base + '/' });
  return !!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) || false;
}, test.limit.long);
test.run('the test detail loads on its own and mounts for a given script, suite and test, answering destroy', 0.2, async function () {
  if (!N || !N.up) return false;
  if (!c || c.error || !c.evaluate) return false;
  const loaded = await c.evaluate('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/app/testicle/element/search/testicle/detail.js"); }).then(function () { return "loaded"; }, function () { return false; })');
  if (loaded !== 'loaded') return false;
  made = await mount('zzBox', { script: A, suite: AS, test: FLIPS });
  return made === 'made' || false;
}, test.limit.slow);

// the box: "The title line is the test's title in full"; goal/G47.4, Andy: "row 1: Title Bubble: presented as Row Form with a
// run button on the right side, like the ones in app for one-shot jobs".
test.run('the detail\'s title line is the test\'s title in full', 0.2, async function () {
  if (mounted()) return false;
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && v.title === FLIPS; }); }, 5000);
  return !!ok || false;
}, test.limit.slow);
test.run('row 1 is a row form holding the title, with its run button on the right', 0.4, async function () {
  if (mounted()) return false;
  const ok = await c.evaluate('(function () { var b = document.getElementById("zzBox"); var top = b && b.firstElementChild && b.firstElementChild.firstElementChild; var f = top && top.querySelector(".shell-row-form"); var t = f && f.querySelector("[data-history=title]"); var bs = f ? f.querySelectorAll("button") : []; var last = bs.length ? bs[bs.length - 1] : null; return !!t && t.textContent === ' + JSON.stringify(FLIPS) + ' && !!last && last.textContent === "run" && !f.querySelector("input"); }())');
  return ok === true || false;
}, test.limit.quick);
// goal/G47.4, Andy: "the list does NOT need to have a description/title column, that repeats the above information EVERY
// single time...."
// then: "give a row on top to the full script filename", "give a row on top to the full suite filename", "and eliminate those
// columns, too."
// goal/G48.4, Andy: "a run that doesn't flip needs to update the run date in any event.", then "who the fuck said it need two
// motherfucking dates?????": one date, the last run.
test.run('the detail\'s columns are Last run, then the test row\'s Result and Severity, with no Title, Script or Suite', 0.4, async function () {
  if (mounted()) return false;
  const v = await view('zzBox');
  return (!!v && JSON.stringify(v.heads) === JSON.stringify(['Last run', 'Result', 'Severity'])) || false;
}, test.limit.quick);
// the box: "given a valid test title ... it answers every row matching that script, suite and title, current or not, newest
// first. A test's history in its detail comes from that, no new verb."
test.run('below the title, every row of the test shows, current or not, the newest flip first', 0.2, async function () {
  if (mounted()) return false;
  const want = keys.slice().reverse();
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && JSON.stringify(v.rows.map(function (r) { return r.key; })) === JSON.stringify(want); }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
// goal/G47.4, Andy: "Column headings should always have the same horizontal alignment as their column content. In this
// horrendous example the column ceadings are centered, wher the column itself os left aligned... UNREADABLE!"
test.run('each column heading is aligned as the cells of its column', 0.4, async function () {
  if (mounted()) return false;
  const v = await c.evaluate('(function () { function a(e) { var s = getComputedStyle(e).textAlign; return s === "start" ? "left" : s === "end" ? "right" : s; } var t = document.querySelector("#zzBox table[data-history=rows]"); if (!t) return ""; var hs = t.querySelectorAll("thead th"); var rs = t.querySelectorAll("tbody tr"); if (!hs.length || !rs.length) return ""; var bad = 0; Array.prototype.forEach.call(rs, function (r) { Array.prototype.forEach.call(hs, function (h, i) { var d = r.children[i]; if (!d || a(d) !== a(h)) bad++; }); }); return JSON.stringify({ n: hs.length, bad: bad }); }())');
  const o = v ? JSON.parse(v) : null;
  return (!!o && o.n === 3 && o.bad === 0) || false;
}, test.limit.quick);
// goal/G47.4, Andy, of the history: "the one thing not instantly obbvious is the fact that the first row IS the \"current\"
// and the one that counts \"right now\"", then "current row in bold sound like the most simple approach. let's try it.":
// every cell of the current row bold, no cell of an older row.
const BOLDS = '(function () { return Array.prototype.map.call(document.querySelectorAll("#zzBox tbody tr"), function (r) { var d = r.querySelectorAll("td"); var b = Array.prototype.filter.call(d, function (x) { return Number(getComputedStyle(x).fontWeight) >= 600; }).length; return d.length && b === d.length ? "bold" : b === 0 ? "plain" : "mixed"; }); }())';
test.run('the current row, the newest flip, is drawn bold, and no older row is', 0.4, async function () {
  if (mounted()) return false;
  const b = await c.evaluate(BOLDS);
  return (Array.isArray(b) && b.length === 3 && b[0] === 'bold' && b.slice(1).every(function (x) { return x === 'plain'; })) || false;
}, test.limit.quick);
test.run('no row of another test of the same suite shows', 0.2, async function () {
  if (mounted()) return false;
  const v = await view('zzBox');
  return (!!v && v.rows.length > 0 && !v.rows.some(function (r) { return r.cells.indexOf(OTHER) !== -1; })) || false;
}, test.limit.quick);
test.run('each row is drawn by the test row, with its result as an icon and its severity, and no title or file names', 0.4, async function () {
  if (mounted()) return false;
  const v = await view('zzBox');
  const tail = (v && v.rows || []).map(function (r) { return r.cells.slice(1).join(' | '); });
  const want = ['✅', '❌', '✅'].map(function (i) { return [i, '0.30'].join(' | '); });
  return JSON.stringify(tail) === JSON.stringify(want) || false;
}, test.limit.quick);
// Each row's date is its last run, the row's tested, as the node answers the row.
test.run('each row shows the date it last ran', 0.2, async function () {
  if (mounted()) return false;
  const v = await view('zzBox');
  const got = await call(N.base, 'spirit.app.testicle.testicle.search', { script: A, suite: AS, test: FLIPS, text: '' });
  const ran = {};
  ((got.body && got.body.items) || []).forEach(function (it) { let row = null; try { row = JSON.parse(it.label); } catch (e) { row = null; } if (row && row.tested) ran[it.key] = Number(row.tested); });
  const bad = (v && v.rows || []).filter(function (r) { return !ran[r.key] || r.cells[0] !== new Date(ran[r.key]).toISOString().replace('T', ' ').slice(0, 19); });
  return (!!v && v.rows.length === 3 && !bad.length) || false;
}, test.limit.quick);
// "It asks again whenever testicle publishes a row of this test."
test.run('a flip set on the node shows at the top with no press', 0.2, async function () {
  if (mounted()) return false;
  const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: false, severity: 0.3 });
  if (r.status !== 200 || !r.body || !r.body.key) return false;
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && v.rows.length === 4 && v.rows[0].key === r.body.key && v.rows[0].cells[1] === '❌'; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('after that flip, its row is the bold one, and the row it replaced is no longer bold', 0.4, async function () {
  if (mounted()) return false;
  const ok = await until(function () { return c.evaluate(BOLDS).then(function (b) { return Array.isArray(b) && b.length === 4 && b[0] === 'bold' && b.slice(1).every(function (x) { return x === 'plain'; }); }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
// goal/G47.1, box v130: "the testicle detail has a 🏃 run button for its script and suite; a press stops the running suite
// and runs it first, as a top-10 fix does; the detail shows its full script and suite path" (Andy: "the testicle detail
// doesn't show the full script name"; "give me a run button on the testicle detail"). What the press does on the server is
// testicle's own test's; here, that it asks testicle.run for this script and suite.
test.run('the detail shows its full script path and its full suite path', 0.4, async function () {
  if (mounted()) return false;
  const text = await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")');
  return (text.indexOf(A) !== -1 && text.indexOf(AS) !== -1) || false;
}, test.limit.quick);
// goal/G47.4, Andy: "give a row on top to the full script filename", "give a row on top to the full suite filename", then
// "row 3: script file name - fow 4: suite file name then the list".
test.run('rows 3 and 4, under the rename form, are the full script path and then the full suite path', 0.4, async function () {
  if (mounted()) return false;
  const v = await c.evaluate('(function () { var b = document.getElementById("zzBox"); var f = b.querySelector("[data-history=titleForm]"); var s = f && f.nextElementSibling; var u = s && s.nextElementSibling; return JSON.stringify([s ? s.getAttribute("data-history") + "=" + s.textContent : "", u ? u.getAttribute("data-history") + "=" + u.textContent : ""]); }())');
  return v === JSON.stringify(['script=' + A, 'suite=' + AS]) || false;
}, test.limit.quick);
// goal/G47.4: the 🏃 is the run form's icon (a pictograph only in the icon element, the general rules), its button 'run'.
test.run('the detail has a 🏃 run form with a run button for its script and suite', 0.4, async function () {
  if (mounted()) return false;
  const n = await c.evaluate('Array.prototype.filter.call(document.getElementById("zzBox").querySelectorAll(".shell-row-form"), function (f) { var b = f.querySelector("button"); return /🏃/.test(f.textContent || "") && !!b && b.textContent === "run"; }).length');
  return n === 1 || false;
}, test.limit.quick);
// The call on the wire names the app by its id (goal/G49.19): spirit.app.testicle.run, spirit.app.testicle.testicle.title.
test.run('a press of the detail\'s run button asks spirit.app.testicle.run for its script and suite', 0.4, async function () {
  if (mounted()) return false;
  await c.evaluate('(function () { window.zzAsked = []; var f = window.fetch; window.fetch = function (u, o) { try { window.zzAsked.push(String(o && o.body || "")); } catch (e) {} return f.apply(this, arguments); };' +
    ' var s = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { window.zzAsked.push(String(b || "")); } catch (e) {} return s.apply(this, arguments); };' +
    ' var b = Array.prototype.filter.call(document.getElementById("zzBox").querySelectorAll("button"), function (x) { return (x.textContent || "") === "run"; })[0]; if (b) b.click(); }())');
  const ok = await until(function () { return c.evaluate('window.zzAsked.some(function (x) { return /"spirit\\.app\\.testicle\\.run"/.test(x); })'); }, 5000);
  const asked = await c.evaluate('JSON.stringify(window.zzAsked.filter(function (x) { return /testicle\\.run/.test(x); }))');
  let body = null; try { body = JSON.parse(JSON.parse(asked)[0]); } catch (e) { body = null; }
  return (!!ok && !!body && body.args && body.args.script === A && body.args.suite === AS) || false;
}, test.limit.slow);
// goal/G47.4, the box: "a second rowForm will allow me to change the tests title", "new titles and the corresponding ui INPUT
// must be bounded by DESCRIPTION_MAX_BYTES"; then Andy: "display the title in a bubble on top.", "a rowForm to change it below
// that.", then "row 1: Title Bubble: presented as Row Form with a run button ... row 2: rowForm for title change". What the
// rename does on the server is testicle's own test's; here, the two forms in that order, the bounded input, the ask and a
// refusal said.
test.run('row 2, right under the title\'s run form, is the row form holding the title input', 0.4, async function () {
  if (mounted()) return false;
  const f = await c.evaluate('(function () { var b = document.getElementById("zzBox"); var r = b.querySelector("[data-history=runForm]"); var fs = b.querySelectorAll(".shell-row-form"); return JSON.stringify({ next: !!(r && r.nextElementSibling && r.nextElementSibling.querySelector("input[data-history=newTitle]")), forms: Array.prototype.map.call(fs, function (x) { return { run: /🏃/.test(x.textContent || "") && Array.prototype.some.call(x.querySelectorAll("button"), function (b) { return b.textContent === "run"; }), input: !!x.querySelector("input[data-history=newTitle]") }; }) }); }())');
  let o = null; try { o = JSON.parse(f); } catch (e) { o = null; }
  const forms = (o && o.forms) || [];
  return (!!o && o.next && forms.length === 2 && forms[0].run && !forms[0].input && forms[1].input && !forms[1].run) || false;
}, test.limit.quick);
// Andy: "a row form for a field change should have: ✏️ (pinned to left edge) "text" [INPUT] [change button]".
test.run('row 2 reads ✏️, the word Title, the input, then its Change button', 0.4, async function () {
  if (mounted()) return false;
  const v = await c.evaluate('(function () { var f = document.querySelector("#zzBox [data-history=titleForm] .shell-row-form"); if (!f) return ""; var k = f.children; var span = f.querySelector(".shell-row-form-span"); var parts = span ? Array.prototype.map.call(span.childNodes, function (n) { return n.nodeType === 3 ? String(n.textContent).trim() : n.tagName.toLowerCase(); }).filter(Boolean) : []; return JSON.stringify({ icon: k[0] ? String(k[0].textContent).trim() : "", parts: parts, button: k.length ? k[k.length - 1].tagName.toLowerCase() + "=" + k[k.length - 1].textContent : "" }); }())');
  return v === JSON.stringify({ icon: '✏️', parts: ['Title', 'input'], button: 'button=Change' }) || false;
}, test.limit.quick);
test.run('the title input holds the test\'s title and takes no more than 128 bytes', 0.4, async function () {
  if (mounted()) return false;
  const v = await c.evaluate('(function () { var i = document.querySelector("#zzBox input[data-history=newTitle]"); return i ? JSON.stringify({ value: i.value, max: i.getAttribute("maxlength") }) : ""; }())');
  let o = null; try { o = JSON.parse(v); } catch (e) { o = null; }
  return (!!o && o.value === FLIPS && o.max === '128') || false;
}, test.limit.quick);
test.run('a press of Change asks spirit.app.testicle.testicle.title with the script, the suite, the old title and the typed one', 0.4, async function () {
  if (mounted()) return false;
  await c.evaluate('(function () { window.zzAsked = []; var i = document.querySelector("#zzBox input[data-history=newTitle]"); if (i) i.value = "alpha has a new name";' +
    ' var b = Array.prototype.filter.call(document.getElementById("zzBox").querySelectorAll("button"), function (x) { return (x.textContent || "") === "Change"; })[0]; if (b) b.click(); }())');
  const ok = await until(function () { return c.evaluate('window.zzAsked.some(function (x) { return /"spirit\\.app\\.testicle\\.testicle\\.title"|"spirit\\.app\\.testicle\\.title"/.test(x); })'); }, 5000);
  const asked = await c.evaluate('JSON.stringify(window.zzAsked.filter(function (x) { return /testicle\\.title/.test(x); }))');
  let body = null; try { body = JSON.parse(JSON.parse(asked)[0]); } catch (e) { body = null; }
  const a = (body && body.args) || {};
  return (!!ok && a.script === A && a.suite === AS && a.oldTitle === FLIPS && a.title === 'alpha has a new name') || false;
}, test.limit.slow);
// The planted suite file does not write the title, so the node refuses ("can not be found excatcly once as a literal").
test.run('a refused rename says why below the forms, and the title line stays', 0.4, async function () {
  if (mounted()) return false;
  const ok = await until(function () { return c.evaluate('String((document.querySelector("#zzBox [data-history=said]") || {}).textContent || "").length > 0'); }, 10000);
  const v = await view('zzBox');
  return (!!ok && !!v && v.title === FLIPS) || false;
}, test.limit.slow);
test.run('a test with no row says so', 0.2, async function () {
  if (mounted()) return false;
  const m = await mount('zzNone', { script: A, suite: AS, test: 'alpha never ran this' });
  if (m !== 'made') return false;
  const ok = await until(function () { return view('zzNone').then(function (v) { return !!v && /No row of this test\./.test(v.html); }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('destroy leaves its container empty', 0.2, async function () {
  if (mounted()) return false;
  const after = await c.evaluate('(function () { window.zzBox.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : null; }())');
  return after === '' || false;
}, test.limit.quick);
test.run('once the detail is destroyed, a flip set on the node draws nothing in its container', 0.2, async function () {
  if (mounted()) return false;
  const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: true, severity: 0.3 });
  if (r.status !== 200) return false;
  await sleep(2000);
  const after = await c.evaluate('(function () { var b = document.getElementById("zzBox"); return b ? b.innerHTML : null; }())');
  return after === '' || false;
}, test.limit.slow);
