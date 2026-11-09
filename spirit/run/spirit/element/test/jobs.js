'use strict';

// spirit/run/spirit/element/test/jobs.js
// The tests of spirit/element/jobs.js, and of no other module (spec: ./jobs.md; goal/G43.29, box v3): what the Job
// Monitor draws, moved out of shell/jobs/jobs.js. The box: "Each works exactly as the old one, merely placed where it now
// belongs", "What it draws is in separate files of spirit/element/, and the old apps' code moves there", and Q1: "a job row
// opens detail panel overtop of jobs." Written from reading the old module: every job of the node a row, its columns the
// green dot, Status, Name, Kind, Progress and Updated; the kind filter all, node, servers, transient and failed; one green
// dot on the job that changed last. Mounted alone in a box of a real Chrome on a scratch node's face page, the jobs as the
// node's stream hands them; a failed job and a running one come from two planted node.run apps, started as Run starts one.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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

test.startTest('jobs.js: the Job Monitor\'s list, an element of spirit/element/ (goal/G43.29)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error || !node.root) { test.fail('no scratch node of its own or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const run = path.join(node.root, 'spirit', 'run');
    plant(run);
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    const failed = await call('jobs.create', { command: 'node', args: ['spirit/app/zzFail/zzFail.js'] });
    ok(failed.status >= 200 && failed.status < 300, 'the world: zzFail started', 'jobs.create zzFail: ' + short(failed.text));
    await until(function () { return call('jobs.get', { key: 'spirit.app.zzFail' }).then(function (j) { return !!(j.body && j.body.job && j.body.job.status === 'failed'); }); }, 15000);

    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/jobs.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1100px;height:700px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.opened = []; var J = spirit.element.jobs; if (!J || typeof J.create !== "function") return "spirit.element.jobs.create is " + typeof (J && J.create); window.made = J.create(c, { open: function (k, spec) { window.opened.push({ key: String(k), spec: spec ? Object.keys(spec) : [], fill: !!(spec && typeof spec.fill === "function") }); return Promise.resolve(null); } }); return "made"; }, function (e) { return String(e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts with spirit.element.jobs.create(container, { open })', 'it did not mount: ' + short(made));
    if (made !== 'made') return;
    const rows = function () { return chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.getClientRects().length ? String(r.innerText || r.textContent || "") : ""; }).filter(Boolean)').then(function (x) { return Array.isArray(x) ? x : []; }); };
    const text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
    const rowOf = function (name) { return rows().then(function (r) { return r.filter(function (t) { return t.indexOf(name) !== -1; })[0] || ''; }); };

    test.subHeading('the old module: every job of the node a row, its columns Status, Name, Kind, Progress, Updated');
    ok(await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 10000), 'the node\'s own jobs are rows, spirit.fs among them', 'the rows: ' + short(await rows()));
    const t0 = await text();
    ['Status', 'Name', 'Kind', 'Progress', 'Updated'].forEach(function (h) { ok(t0.indexOf(h) !== -1, 'a column ' + h, 'no column ' + h + ': ' + short(t0)); });
    const fsRow = await rowOf('spirit.fs');
    ok(/\bnode\b/.test(fsRow) && /running/.test(fsRow), 'spirit.fs, the node\'s own, is of kind node, running', 'the spirit.fs row: ' + short(fsRow));
    const failRow = await rowOf('zzFail');
    ok(/failed/.test(failRow) && failRow.indexOf('❌') !== -1 || /failed/.test(failRow) && await chrome.evaluate('document.getElementById("box").innerHTML.indexOf("❌") !== -1'), 'a failed job shows ❌ failed', 'the zzFail row: ' + short(failRow));

    test.subHeading('the kind filter: all, node, servers, transient, failed ("the last filter in the jobs search should be failed")');
    const words = await chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box button"), function (b) { return String(b.textContent).trim(); })');
    const want = ['all', 'node', 'servers', 'transient', 'failed'];
    const at = want.map(function (w) { return (words || []).indexOf(w); });
    ok(at.every(function (i) { return i !== -1; }) && at.every(function (i, n) { return n === 0 || i > at[n - 1]; }), 'its choices, in order: ' + want.join(', '), 'the buttons: ' + short(words));
    const press = function (w) { return chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return String(x.textContent).trim() === ' + JSON.stringify(w) + '; })[0]; if (b) b.click(); return !!b; }())'); };
    await press('failed');
    ok(await until(function () { return rows().then(function (r) { return r.length >= 1 && r.every(function (t) { return /failed/.test(t); }); }); }, 5000), 'failed lists the failed jobs only', 'with failed: ' + short(await rows()));
    await press('node');
    ok(await until(function () { return rows().then(function (r) { return r.length >= 1 && r.every(function (t) { return /\bnode\b/.test(t); }) && !r.some(function (t) { return t.indexOf('zzFail') !== -1; }); }); }, 5000), 'node lists the node\'s own jobs only', 'with node: ' + short(await rows()));
    await press('all');
    ok(await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('zzFail') !== -1; }) && r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 5000), 'all lists them all again', 'with all: ' + short(await rows()));

    test.subHeading('"one green dot hops between rows, always showing the most recent update"');
    const started = await call('jobs.create', { command: 'node', args: ['spirit/app/zzSleep/zzSleep.js'] });
    ok(started.status >= 200 && started.status < 300, 'the world: zzSleep started', 'jobs.create zzSleep: ' + short(started.text));
    const dotted = function () { return chrome.evaluate('Array.prototype.map.call(document.querySelectorAll("#box tr, #box .list-row"), function (r) { return r.innerHTML.indexOf("●") !== -1 ? String(r.innerText || "") : ""; }).filter(Boolean)'); };
    ok(await until(function () { return dotted().then(function (d) { return d.length === 1 && d[0].indexOf('zzSleep') !== -1; }); }, 10000), 'the one dot is on zzSleep, the job that changed last', 'the dotted rows: ' + short(await dotted()));
    await call('jobs.cancel', { id: 'spirit.app.zzSleep' });
    ok(await until(function () { return rowOf('zzSleep').then(function (r) { return /cancelled|stopped/.test(r) || r === ''; }); }, 10000), 'a job cancelled on the node repaints its row, no reload', 'the zzSleep row after its cancel: ' + short(await rowOf('zzSleep')));

    test.subHeading('Q1: "a job row opens detail panel overtop of jobs": a press hands the row to the mounter\'s open');
    await chrome.evaluate('(function () { var r = Array.prototype.filter.call(document.querySelectorAll("#box tr, #box .list-row"), function (x) { return x.getClientRects().length && String(x.textContent).indexOf("spirit.fs") !== -1; })[0]; if (!r) return false; var leaf = Array.prototype.filter.call(r.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || r; leaf.click(); return true; }())');
    const opened = await until(function () { return chrome.evaluate('window.opened.length >= 1'); }, 5000);
    const o1 = JSON.parse(await chrome.evaluate('JSON.stringify(window.opened)'));
    ok(opened && o1[0].fill && /spirit\.fs/.test(o1[0].key), 'a press on spirit.fs calls open with its key and a fill', 'open was called with ' + short(o1));

    test.subHeading('with no open handed, its own panel over its box (as contact\'s)');
    await chrome.evaluate('(function () { window.made.destroy(); var c = document.getElementById("box"); c.innerHTML = ""; window.made = spirit.element.jobs.create(c, {}); return true; }())');
    await until(function () { return rows().then(function (r) { return r.some(function (t) { return t.indexOf('spirit.fs') !== -1; }); }); }, 10000);
    await chrome.evaluate('(function () { var r = Array.prototype.filter.call(document.querySelectorAll("#box tr, #box .list-row"), function (x) { return x.getClientRects().length && String(x.textContent).indexOf("spirit.fs") !== -1; })[0]; if (!r) return false; var leaf = Array.prototype.filter.call(r.querySelectorAll("*"), function (e) { return !e.children.length && e.getClientRects().length; })[0] || r; leaf.click(); return true; }())');
    const OVER = '(function () { var box = document.getElementById("box"); var b = box.getBoundingClientRect(); var l = Array.prototype.filter.call(box.querySelectorAll(".app-container"), function (c) { return c.offsetParent !== null; }).pop(); if (!l) return "no panel layer"; var r = l.getBoundingClientRect(); if (r.width < b.width - 4 || r.height < b.height - 4) return "a layer of " + Math.round(r.width) + "x" + Math.round(r.height); return String(l.textContent).indexOf("spirit.fs") !== -1 ? "over" : "the layer does not name spirit.fs"; }())';
    ok(await until(function () { return chrome.evaluate(OVER).then(function (v) { return v === 'over'; }); }, 5000), 'a press opens a panel over the whole list, spirit.fs on it', 'the press: ' + short(await chrome.evaluate(OVER)));
    await chrome.evaluate('(function () { var c = Array.prototype.filter.call(document.querySelectorAll("#box .app-container-close"), function (x) { return x.offsetParent !== null; }).pop(); if (c) c.click(); return !!c; }())');
    ok(await until(function () { return chrome.evaluate('!Array.prototype.some.call(document.querySelectorAll("#box .app-container"), function (c) { return c.offsetParent !== null; })'); }, 5000), 'its close brings the list back', 'the panel stayed after its close');

    test.subHeading('destroy');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); return document.getElementById("box").children.length === 0; }())');
    ok(empty === true, 'destroy empties its container', 'destroy left ' + short(await text()));
    ok(JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)')).length === 0, 'and the page threw nothing', 'page errors: ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors)')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
