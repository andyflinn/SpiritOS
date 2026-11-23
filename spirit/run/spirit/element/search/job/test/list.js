'use strict';

// spirit/run/spirit/element/search/job/test/list.js
// The tests of spirit/element/search/job/list.js, spirit/element/job.js until goal/G43.32, and of no other module (spec: ./list.md; goal/G43.29, box v3): what the Job
// Monitor draws, moved out of shell/job/job.js. The box: "Each works exactly as the old one, merely placed where it now
// belongs", "What it draws is in separate files of spirit/element/, and the old apps' code moves there", and Q1: "a job row
// opens detail panel overtop of jobs." Written from reading the old module: every job of the node a row, its columns the
// green dot, Status, Name, Kind, Progress and Updated; the kind filter all, node, servers, transient and failed; one green
// dot on the job that changed last. Mounted alone in a box of a real Chrome on a scratch node's face page, the jobs as the
// node's stream hands them; a failed job and a running one come from two planted node.run apps, started as Run starts one.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Two apps of the test's own that say node run: one fails at once, one runs a minute.
function plant(run) {
  [['zzFail', 'process.exit(3);'], ['zzSleep', 'setTimeout(function () {}, 60000);']].forEach(function (a) {
    const dir = path.join(run, 'spirit', 'app', a[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, a[0] + '.json'), JSON.stringify({ identity: { icon: '🧪', label: a[0], intrinsic: false }, node: { run: true } }));
    fs.writeFileSync(path.join(dir, a[0] + '.js'), a[1] + '\n');
  });
}

// What the world and the tests make, for the tests after them.
let node, chrome, call, made, rows, text, rowOf, t0, press, dotted;

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* scratch */ }
});
test.run('a scratch node of its own comes up with two planted apps, and Chrome opens', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error || !node.root) return false;
  plant(path.join(node.root, 'spirit', 'run'));
  call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  return true;
}, test.limit.slow);
test.run('zzFail is started', 0.2, async function () {
  if (!call) return false;
  const failed = await call('job.create', { command: 'node', args: JSON.stringify(['spirit/app/zzFail/zzFail.js']) });
  return failed.status >= 200 && failed.status < 300 ? true : false;
}, test.limit.slow);
test.run('it loads through requireScript and mounts with spirit.required.spirit.element.search.job.list.create, given container and open', 0.2, async function () {
  if (!call) return false;
  await until(function () { return call('job.get', { key: 'spirit.app.zzFail' }).then(function (j) { return !!(j.body && j.body.job && j.body.job.status === 'failed'); }); }, 15000);
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
  made = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/job/list.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function () { window.pageErrors.push(1); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:700px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.opened = []; var J = spirit.required.spirit.element.search.job.list; if (!J || typeof J.create !== "function") return ""; window.made = J.create(c, { open: function (k, spec) { window.opened.push({ key: String(k), spec: spec ? Object.keys(spec) : [], fill: !!(spec && typeof spec.fill === "function") }); return Promise.resolve(null); } }); return "made"; }, function () { return ""; })');
  // The job rows: a header row (th, or under thead) is no job and is never judged as one.
  rows = function () { return chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length && !r.querySelector("th") && !r.closest("thead") ? String(r.innerText || r.textContent || "") : ""; }).filter(Boolean)').then(function (x) { return Array.isArray(x) ? x : []; }); };
  text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
  rowOf = function (name) { return rows().then(function (r) { return r.filter(function (t) { return t.indexOf(name) !== -1; })[0] || ''; }); };
  press = function (w) { return chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === ' + JSON.stringify(w) + '; })[0]; if (b) b.click(); return !!b; }())'); };
  return made === 'made' ? true : false;
}, test.limit.slow);

// the old module: every job of the node a row, its columns Status, Name, Kind, Progress, Updated
test.run('the node\'s own jobs are rows, spirit.fs among them', 0.2, async function () {
  if (made !== 'made') return false;
  const there = await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 10000);
  t0 = await text();
  return there ? true : false;
}, test.limit.slow);
test.run('it has a Status column', 0.2, function () {
  if (t0 === undefined) return false;
  return t0.indexOf('Status') !== -1 ? true : false;
}, test.limit.quick);
test.run('it has a Name column', 0.2, function () {
  if (t0 === undefined) return false;
  return t0.indexOf('Name') !== -1 ? true : false;
}, test.limit.quick);
test.run('it has a Kind column', 0.2, function () {
  if (t0 === undefined) return false;
  return t0.indexOf('Kind') !== -1 ? true : false;
}, test.limit.quick);
test.run('it has a Progress column', 0.2, function () {
  if (t0 === undefined) return false;
  return t0.indexOf('Progress') !== -1 ? true : false;
}, test.limit.quick);
test.run('it has a Updated column', 0.2, function () {
  if (t0 === undefined) return false;
  return t0.indexOf('Updated') !== -1 ? true : false;
}, test.limit.quick);
test.run('spirit.fs, the node\'s own, is of kind node, running', 0.2, async function () {
  if (made !== 'made') return false;
  const fsRow = await rowOf('spirit.fs');
  return /\bnode\b/.test(fsRow) && /running/.test(fsRow) ? true : false;
}, test.limit.slow);
test.run('a failed job shows ❌ failed', 0.2, async function () {
  if (made !== 'made') return false;
  const failRow = await rowOf('zzFail');
  return /failed/.test(failRow) && failRow.indexOf('❌') !== -1 || /failed/.test(failRow) && await chrome.evaluate('document.getElementById("box").innerHTML.indexOf("❌") !== -1') ? true : false;
}, test.limit.slow);

// the kind filter: all, node, servers, transient, failed ("the last filter in the jobs search should be failed")
test.run('its kind filter offers, in order, all, node, servers, transient and failed', 0.2, async function () {
  if (made !== 'made') return false;
  const words = await chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box button"), function (b) { return String(b.textContent).trim(); })');
  const want = ['all', 'node', 'servers', 'transient', 'failed'];
  const at = want.map(function (w) { return (words || []).indexOf(w); });
  return at.every(function (i) { return i !== -1; }) && at.every(function (i, n) { return n === 0 || i > at[n - 1]; }) ? true : false;
}, test.limit.slow);
test.run('failed lists the failed jobs only', 0.2, async function () {
  if (made !== 'made') return false;
  await press('failed');
  return (await until(function () { return rows().then(function (r) { return r.length >= 1 && r.every(function (t) { return /failed/.test(t); }); }); }, 5000)) ? true : false;
}, test.limit.slow);
test.run('node lists the node\'s own jobs only', 0.2, async function () {
  if (made !== 'made') return false;
  await press('node');
  return (await until(function () { return rows().then(function (r) { return r.length >= 1 && r.every(function (t) { return /\bnode\b/.test(t); }) && !r.some(function (t) { return t.indexOf('zzFail') !== -1; }); }); }, 5000)) ? true : false;
}, test.limit.slow);
test.run('all lists them all again', 0.2, async function () {
  if (made !== 'made') return false;
  await press('all');
  return (await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('zzFail') !== -1; }) && r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 5000)) ? true : false;
}, test.limit.slow);

// "one green dot hops between rows, always showing the most recent update"
test.run('zzSleep is started', 0.2, async function () {
  if (!call) return false;
  const started = await call('job.create', { command: 'node', args: JSON.stringify(['spirit/app/zzSleep/zzSleep.js']) });
  return started.status >= 200 && started.status < 300 ? true : false;
}, test.limit.slow);
test.run('the one dot is on zzSleep, the job that changed last', 0.2, async function () {
  if (made !== 'made') return false;
  dotted = function () { return chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.innerHTML.indexOf("●") !== -1 ? String(r.innerText || "") : ""; }).filter(Boolean)'); };
  return (await until(function () { return dotted().then(function (d) { return d.length === 1 && d[0].indexOf('zzSleep') !== -1; }); }, 10000)) ? true : false;
}, test.limit.slow);
test.run('a job cancelled on the node repaints its row, no reload', 0.2, async function () {
  if (made !== 'made') return false;
  await call('job.cancel', { id: 'spirit.app.zzSleep' });
  return (await until(function () { return rowOf('zzSleep').then(function (r) { return /cancelled|stopped/.test(r) || r === ''; }); }, 10000)) ? true : false;
}, test.limit.slow);

// Q1: "a job row opens detail panel overtop of jobs": a press hands the row to the mounter's open
const PRESS_FS = '(function () { var r = Array.prototype.filter.call(document.querySelectorAll("#box tr, #box .list-row"), function (x) { return x.getClientRects().length && String(x.textContent).indexOf("spirit.fs") !== -1; })[0]; if (!r) return false; var leaf = Array.prototype.filter.call(r.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || r; leaf.click(); return true; }())';
test.run('a press on spirit.fs calls open with its key and a fill', 0.2, async function () {
  if (made !== 'made') return false;
  await chrome.evaluate(PRESS_FS);
  const opened = await until(function () { return chrome.evaluate('window.opened.length >= 1'); }, 5000);
  const o1 = JSON.parse(await chrome.evaluate('JSON.stringify(window.opened)'));
  return opened && o1[0].fill && /spirit\.fs/.test(o1[0].key) ? true : false;
}, test.limit.slow);

// with no open handed, its own panel over its box (as contact's)
const OVER = '(function () { var box = document.getElementById("box"); var b = box.getBoundingClientRect(); var l = Array.prototype.filter.call(box.querySelectorAll(".app-container"), function (c) { return c.offsetParent !== null; }).pop(); if (!l) return false; var r = l.getBoundingClientRect(); if (r.width < b.width - 4 || r.height < b.height - 4) return false; return String(l.textContent).indexOf("spirit.fs") !== -1; }())';
test.run('a press opens a panel over the whole list, spirit.fs on it', 0.2, async function () {
  if (made !== 'made') return false;
  await chrome.evaluate('(function () { window.made.destroy(); var c = document.getElementById("box"); c.innerHTML = ""; window.made = spirit.required.spirit.element.search.job.list.create(c, {}); return true; }())');
  await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 10000);
  await chrome.evaluate(PRESS_FS);
  return (await until(function () { return chrome.evaluate(OVER).then(function (v) { return v === true; }); }, 5000)) ? true : false;
}, test.limit.slow);
test.run('its close brings the list back', 0.2, async function () {
  if (made !== 'made') return false;
  await chrome.evaluate('(function () { var c = Array.prototype.filter.call(document.querySelectorAll("#box .app-container-close"), function (x) { return x.offsetParent !== null; }).pop(); if (c) c.click(); return !!c; }())');
  return (await until(function () { return chrome.evaluate('!Array.prototype.some.call(document.querySelectorAll("#box .app-container"), function (c) { return c.offsetParent !== null; })'); }, 5000)) ? true : false;
}, test.limit.slow);

// destroy
test.run('destroy empties its container', 0.2, async function () {
  if (made !== 'made') return false;
  const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.slow);
test.run('the page threw nothing', 0.2, async function () {
  if (made !== 'made') return false;
  const errors = JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)'));
  return errors.length === 0 ? true : false;
}, test.limit.slow);
