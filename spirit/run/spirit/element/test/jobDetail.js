'use strict';

// spirit/run/spirit/element/test/jobDetail.js
// The tests of spirit/element/jobDetail.js, and of no other module (spec: ./jobDetail.md; goal/G43.29, box v3): "The detail
// is today's shell/jobsDetails dialog, drawn by a spirit/element/ file of its own", and "Each works exactly as the old one".
// Written from reading the old module: its facts (Status, Id, Kind, Updated); Cancel for a process or a user-operated
// server, never a node's own job; Delete once the job is terminal, the screen going with the job; the job's last events,
// live, a click putting one into the Extract box as JSON.stringify(object, null, 2); a job no longer there said so.
// spirit.element.spirit.element.jobDetail.create(host, { id, close }) mounted alone in a box of a real Chrome on a scratch node's face
// page; a running process from a planted node.run app, started as Run starts one.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('jobDetail.js: one job, the Job Monitor\'s detail, an element of spirit/element/ (goal/G43.29)');

(async function () {
  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    if (!node.up || chrome.error || !node.root) { test.fail('no scratch node of its own or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const dir = path.join(run, 'spirit', 'app', 'zzSleep');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'zzSleep.json'), JSON.stringify({ identity: { icon: '🧪', label: 'zzSleep', intrinsic: false }, node: { run: true } }));
    fs.writeFileSync(path.join(dir, 'zzSleep.js'), 'setTimeout(function () {}, 60000);\n');
    const failDir = path.join(run, 'spirit', 'app', 'zzFail');
    fs.mkdirSync(failDir, { recursive: true });
    fs.writeFileSync(path.join(failDir, 'zzFail.json'), JSON.stringify({ identity: { icon: '🧪', label: 'zzFail', intrinsic: false }, node: { run: true } }));
    fs.writeFileSync(path.join(failDir, 'zzFail.js'), 'process.exit(3);\n');
    const call = async function (name, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
      return { status: r.status, body: b, text: t };
    };
    const jobOf = function (id) { return call('job.get', { key: id }).then(function (j) { return (j.body && j.body.job) || null; }); };

    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/jobDetail.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); window.closes = []; var J = spirit.element.spirit.element.jobDetail; return J && typeof J.create === "function" ? "loaded" : "spirit.element.spirit.element.jobDetail.create is " + typeof (J && J.create); }, function (e) { return String(e && e.message || e); })');
    ok(loaded === 'loaded', 'it loads through spirit.require: spirit.element.spirit.element.jobDetail.create(host, { id, close })', 'it did not load: ' + short(loaded));
    if (loaded !== 'loaded') return;
    const mount = function (id) { return chrome.evaluate('(function () { if (window.made) window.made.destroy(); var old = document.getElementById("box"); if (old) old.remove(); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1000px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.made = spirit.element.spirit.element.jobDetail.create(c, { id: ' + JSON.stringify(id) + ', close: function (w) { window.closes.push(w === undefined ? null : w); } }); return true; }())'); };
    const text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
    const buttons = function () { return chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length; }).map(function (b) { return String(b.textContent).trim(); })'); };
    const press = function (w) { return chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return x.getClientRects().length && String(x.textContent).trim() === ' + JSON.stringify(w) + '; })[0]; if (b) b.click(); return !!b; }())'); };

    test.subHeading('a node\'s own job, spirit.fs: its facts, and neither Cancel nor Delete ("never for a node-operated one")');
    await mount('spirit.fs');
    ok(await until(function () { return text().then(function (t) { return t.indexOf('spirit.fs') !== -1 && /running/.test(t); }); }, 10000), 'it shows spirit.fs, running', 'it shows: ' + short(await text()));
    const t1 = await text();
    ['Status', 'Id', 'Kind', 'Updated'].forEach(function (f) { ok(t1.indexOf(f) !== -1, 'its fact ' + f, 'no ' + f + ': ' + short(t1)); });
    const b1 = await buttons();
    ok(b1.indexOf('Cancel') === -1 && b1.indexOf('Delete') === -1, 'no Cancel and no Delete for it', 'its buttons: ' + short(b1));

    test.subHeading('"A live monitor of what the job publishes": an event of spirit.fs, and the Extract box');
    ok(/Events/.test(t1), 'its events box', 'no events box: ' + short(t1));
    // Through spirit.fs, as an agent changes a file ("an agent's file changes through spirit.fs"), in a folder of its own:
    // fs.save refuses a file at the run folder's top. Judged by a line naming the file, never by the count: the window is
    // full at 256 from the boot scan, so a new line pushes one off the top.
    const touched = 'zzTouched/zz-touched-' + Date.now() + '.txt';
    const saved = await call('fs.save', { path: touched, content: 'a change for spirit.fs to report\n' });
    ok(saved.status >= 200 && saved.status < 300, 'the world: a file saved through fs.save', 'fs.save: ' + short(saved.text));
    const heard = await until(function () { return chrome.evaluate('Array.prototype.some.call(document.querySelectorAll("#box [data-event]"), function (l) { return String(l.textContent).indexOf(' + JSON.stringify(path.basename(touched)) + ') !== -1; })'); }, 15000);
    ok(heard, 'a file change on the node shows as a new event line, no reload', 'no new event line; the box: ' + short(await text()));
    if (heard) {
      await chrome.evaluate('(function () { var l = document.querySelectorAll("#box [data-event]"); l[l.length - 1].click(); return true; }())');
      const pretty = await until(function () { return chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); var v = cm && cm.CodeMirror ? cm.CodeMirror.getValue() : ""; return v.indexOf("\\n") !== -1 && /^\\s*[{\\[]/.test(v); }())'); }, 5000);
      ok(pretty, 'a click puts it into the Extract box, written out as JSON.stringify(object, null, 2)', 'the Extract box: ' + short(await chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : "no CodeMirror"; }())')));
    }

    test.subHeading('a running process: Cancel; the node then removes it (G29.16), and the screen stays and says so');
    const started = await call('job.create', { command: 'node', args: ['spirit/app/zzSleep/zzSleep.js'] });
    ok(started.status >= 200 && started.status < 300, 'the world: zzSleep started', 'job.create zzSleep: ' + short(started.text));
    await until(function () { return jobOf('spirit.app.zzSleep').then(function (j) { return !!j && j.status === 'running'; }); }, 10000);
    await mount('spirit.app.zzSleep');
    ok(await until(function () { return buttons().then(function (b) { return b.indexOf('Cancel') !== -1 && b.indexOf('Delete') === -1; }); }, 10000), 'running, it offers Cancel and no Delete', 'its buttons: ' + short(await buttons()));
    await press('Cancel');
    // spirit/job.js: a process the owner cancels removes itself (goal/G29.16, "jobs cancelled by me are also removed").
    ok(await until(function () { return jobOf('spirit.app.zzSleep').then(function (j) { return !j; }); }, 10000), 'Cancel ends the job on the node, which then removes it', 'after Cancel the job is ' + short(await jobOf('spirit.app.zzSleep')));
    ok(await until(function () { return text().then(function (t) { return /no longer listed/i.test(t); }); }, 10000), 'and the screen stays and says it is no longer listed, no reload', 'after Cancel the screen: ' + short(await text()));
    ok(await chrome.evaluate('window.closes.length === 0'), 'Cancel does not close the screen', 'Cancel called close');

    test.subHeading('a failed process stays (G29.16): Delete and no Cancel; Delete, and the screen goes with the job');
    const failed = await call('job.create', { command: 'node', args: ['spirit/app/zzFail/zzFail.js'] });
    ok(failed.status >= 200 && failed.status < 300, 'the world: zzFail started', 'job.create zzFail: ' + short(failed.text));
    ok(await until(function () { return jobOf('spirit.app.zzFail').then(function (j) { return !!j && j.status === 'failed'; }); }, 10000), 'the world: zzFail failed and stays listed', 'zzFail is ' + short(await jobOf('spirit.app.zzFail')));
    await mount('spirit.app.zzFail');
    ok(await until(function () { return buttons().then(function (b) { return b.indexOf('Delete') !== -1 && b.indexOf('Cancel') === -1; }); }, 10000), 'terminal, it offers Delete and no Cancel', 'its buttons: ' + short(await buttons()));
    await press('Delete');
    ok(await until(function () { return jobOf('spirit.app.zzFail').then(function (j) { return !j; }); }, 10000), 'Delete deletes the job on the node', 'after Delete the job is ' + short(await jobOf('spirit.app.zzFail')));
    ok(await until(function () { return chrome.evaluate('window.closes.length >= 1'); }, 5000), 'and the screen goes with it: close is called', 'close was not called after Delete');

    test.subHeading('"Deleted or never there: say so"');
    await mount('spirit.app.zzNeverThere');
    ok(await until(function () { return text().then(function (t) { return /no longer listed/i.test(t); }); }, 8000), 'a job not there says it is no longer listed', 'for a stranger it shows: ' + short(await text()));
    const b3 = await buttons();
    ok(b3.indexOf('Cancel') === -1 && b3.indexOf('Delete') === -1, 'with no button', 'for a stranger its buttons: ' + short(b3));

    test.subHeading('destroy');
    const empty = await chrome.evaluate('(function () { window.made.destroy(); window.made = null; return document.getElementById("box").children.length === 0; }())');
    ok(empty === true, 'destroy empties its host', 'destroy left ' + short(await text()));
    ok(JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)')).length === 0, 'and the page threw nothing', 'page errors: ' + short(await chrome.evaluate('JSON.stringify(window.pageErrors)')));
  } finally {
    try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
