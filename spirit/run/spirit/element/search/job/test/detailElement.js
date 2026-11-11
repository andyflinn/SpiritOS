'use strict';

// spirit/run/spirit/element/search/job/test/detailElement.js
// The tests of spirit/element/search/job/detailElement.js, spirit/element/jobDetail.js until goal/G43.32, and of no other module (spec: ./detailElement.md; goal/G43.29, box v3): "The detail
// is today's shell/jobsDetails dialog, drawn by a spirit/element/ file of its own", and "Each works exactly as the old one".
// Written from reading the old module: its facts (Status, Id, Kind, Updated); Cancel for a process or a user-operated
// server, never a node's own job; Delete once the job is terminal, the screen going with the job; the job's last events,
// live, a click putting one into the Extract box as JSON.stringify(object, null, 2); a job no longer there said so.
// spirit.element.spirit.element.search.job.detailElement.create(host, { id, close }) mounted alone in a box of a real Chrome on a scratch node's face
// page; a running process from a planted node.run app, started as Run starts one. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// What the world and the tests make, for the tests after them.
let node, chrome, call, jobOf, loaded, mount, text, buttons, press, t1, heard;
const NO_PAGE = 'no page: the world failed';
const NO_LOAD = 'the detail did not load';

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
test.run('the world: a scratch node of its own, two planted apps, and Chrome on its face page', 0.2, async function () {
  node = await scratchNode();
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error || !node.root) return 'no scratch node of its own or no Chrome: nothing judged. ' + short(chrome.error || '');
  const run = path.join(node.root, 'spirit', 'run');
  const dir = path.join(run, 'spirit', 'app', 'zzSleep');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'zzSleep.json'), JSON.stringify({ identity: { icon: '🧪', label: 'zzSleep', intrinsic: false }, node: { run: true } }));
  fs.writeFileSync(path.join(dir, 'zzSleep.js'), 'setTimeout(function () {}, 60000);\n');
  const failDir = path.join(run, 'spirit', 'app', 'zzFail');
  fs.mkdirSync(failDir, { recursive: true });
  fs.writeFileSync(path.join(failDir, 'zzFail.json'), JSON.stringify({ identity: { icon: '🧪', label: 'zzFail', intrinsic: false }, node: { run: true } }));
  fs.writeFileSync(path.join(failDir, 'zzFail.js'), 'process.exit(3);\n');
  call = async function (name, args) {
    const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: name, args: args || {} }) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = null; }
    return { status: r.status, body: b, text: t };
  };
  jobOf = function (id) { return call('job.get', { key: id }).then(function (j) { return (j.body && j.body.job) || null; }); };
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
  return true;
}, 10000);
test.run('it loads through spirit.require: spirit.element.spirit.element.search.job.detailElement.create(host, { id, close })', 0.2, async function () {
  if (!call) return NO_PAGE;
  loaded = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search/job/detailElement.js"); }).then(function () { window.pageErrors = []; window.addEventListener("error", function (e) { window.pageErrors.push(String(e.message)); }); window.closes = []; var J = spirit.element.spirit.element.search.job.detailElement; return J && typeof J.create === "function" ? "loaded" : "spirit.element.spirit.element.search.job.detailElement.create is " + typeof (J && J.create); }, function (e) { return String(e && e.message || e); })');
  mount = function (id) { return chrome.evaluate('(function () { if (window.made) window.made.destroy(); var old = document.getElementById("box"); if (old) old.remove(); var c = document.createElement("div"); c.id = "box"; c.style.cssText = "position:fixed;left:0;top:0;width:1000px;height:760px;display:flex;flex-direction:column;background:#111;z-index:9"; document.body.appendChild(c); window.made = spirit.element.spirit.element.search.job.detailElement.create(c, { id: ' + JSON.stringify(id) + ', close: function (w) { window.closes.push(w === undefined ? null : w); } }); return true; }())'); };
  text = function () { return chrome.evaluate('String((document.getElementById("box") || {}).innerText || "")'); };
  buttons = function () { return chrome.evaluate('Array.prototype.filter.call(document.querySelectorAll("#box button"), function (b) { return b.getClientRects().length; }).map(function (b) { return String(b.textContent).trim(); })'); };
  press = function (w) { return chrome.evaluate('(function () { var b = Array.prototype.filter.call(document.querySelectorAll("#box button"), function (x) { return x.getClientRects().length && String(x.textContent).trim() === ' + JSON.stringify(w) + '; })[0]; if (b) b.click(); return !!b; }())'); };
  return loaded === 'loaded' ? true : 'it did not load: ' + short(loaded);
}, 5000);

// a node's own job, spirit.fs: its facts, and neither Cancel nor Delete ("never for a node-operated one")
test.run('it shows spirit.fs, running', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await mount('spirit.fs');
  const shown = await until(function () { return text().then(function (t) { return t.indexOf('spirit.fs') !== -1 && /running/.test(t); }); }, 10000);
  t1 = await text();
  return shown ? true : 'it shows: ' + short(t1);
}, 15000);
test.run('it shows its Status fact', 0.2, function () {
  if (t1 === undefined) return NO_LOAD;
  return t1.indexOf('Status') !== -1 ? true : 'no Status: ' + short(t1);
}, 1000);
test.run('it shows its Id fact', 0.2, function () {
  if (t1 === undefined) return NO_LOAD;
  return t1.indexOf('Id') !== -1 ? true : 'no Id: ' + short(t1);
}, 1000);
test.run('it shows its Kind fact', 0.2, function () {
  if (t1 === undefined) return NO_LOAD;
  return t1.indexOf('Kind') !== -1 ? true : 'no Kind: ' + short(t1);
}, 1000);
test.run('it shows its Updated fact', 0.2, function () {
  if (t1 === undefined) return NO_LOAD;
  return t1.indexOf('Updated') !== -1 ? true : 'no Updated: ' + short(t1);
}, 1000);
test.run('no Cancel and no Delete for it', 0.2, async function () {
  if (t1 === undefined) return NO_LOAD;
  const b1 = await buttons();
  return b1.indexOf('Cancel') === -1 && b1.indexOf('Delete') === -1 ? true : 'its buttons: ' + short(b1);
}, 3000);

// "A live monitor of what the job publishes": an event of spirit.fs, and the Extract box
test.run('its events box', 0.2, function () {
  if (t1 === undefined) return NO_LOAD;
  return /Events/.test(t1) ? true : 'no events box: ' + short(t1);
}, 1000);
// Through spirit.fs, as an agent changes a file ("an agent's file changes through spirit.fs"), in a folder of its own:
// fs.save refuses a file at the run folder's top. Judged by a line naming the file, never by the count: the window is
// full at 256 from the boot scan, so a new line pushes one off the top.
const touched = 'zzTouched/zz-touched-' + Date.now() + '.txt';
test.run('the world: a file saved through fs.save', 0.2, async function () {
  if (!call) return NO_PAGE;
  const saved = await call('fs.save', { path: touched, content: 'a change for spirit.fs to report\n' });
  return saved.status >= 200 && saved.status < 300 ? true : 'fs.save: ' + short(saved.text);
}, 5000);
test.run('a file change on the node shows as a new event line, no reload', 0.2, async function () {
  if (t1 === undefined) return NO_LOAD;
  heard = await until(function () { return chrome.evaluate('Array.prototype.some.call(document.querySelectorAll("#box [data-event]"), function (l) { return String(l.textContent).indexOf(' + JSON.stringify(path.basename(touched)) + ') !== -1; })'); }, 15000);
  return heard ? true : 'no new event line; the box: ' + short(await text());
}, 20000);
test.run('a click puts it into the Extract box, written out as JSON.stringify(object, null, 2)', 0.2, async function () {
  if (!heard) return 'no event line to click';
  await chrome.evaluate('(function () { var l = document.querySelectorAll("#box [data-event]"); l[l.length - 1].click(); return true; }())');
  const pretty = await until(function () { return chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); var v = cm && cm.CodeMirror ? cm.CodeMirror.getValue() : ""; return v.indexOf("\\n") !== -1 && /^\\s*[{\\[]/.test(v); }())'); }, 5000);
  return pretty ? true : 'the Extract box: ' + short(await chrome.evaluate('(function () { var cm = document.querySelector("#box .CodeMirror"); return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : "no CodeMirror"; }())'));
}, 10000);

// a running process: Cancel; the node then removes it (G29.16), and the screen stays and says so
test.run('the world: zzSleep started', 0.2, async function () {
  if (!call) return NO_PAGE;
  const started = await call('job.create', { command: 'node', args: ['spirit/app/zzSleep/zzSleep.js'] });
  return started.status >= 200 && started.status < 300 ? true : 'job.create zzSleep: ' + short(started.text);
}, 5000);
test.run('running, it offers Cancel and no Delete', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await until(function () { return jobOf('spirit.app.zzSleep').then(function (j) { return !!j && j.status === 'running'; }); }, 10000);
  await mount('spirit.app.zzSleep');
  return (await until(function () { return buttons().then(function (b) { return b.indexOf('Cancel') !== -1 && b.indexOf('Delete') === -1; }); }, 10000)) ? true : 'its buttons: ' + short(await buttons());
}, 30000);
// spirit/job.js: a process the owner cancels removes itself (goal/G29.16, "jobs cancelled by me are also removed").
test.run('Cancel ends the job on the node, which then removes it', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await press('Cancel');
  return (await until(function () { return jobOf('spirit.app.zzSleep').then(function (j) { return !j; }); }, 10000)) ? true : 'after Cancel the job is ' + short(await jobOf('spirit.app.zzSleep'));
}, 15000);
test.run('and the screen stays and says it is no longer listed, no reload', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  return (await until(function () { return text().then(function (t) { return /no longer listed/i.test(t); }); }, 10000)) ? true : 'after Cancel the screen: ' + short(await text());
}, 15000);
test.run('Cancel does not close the screen', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  return (await chrome.evaluate('window.closes.length === 0')) ? true : 'Cancel called close';
}, 3000);

// a failed process stays (G29.16): Delete and no Cancel; Delete, and the screen goes with the job
test.run('the world: zzFail started', 0.2, async function () {
  if (!call) return NO_PAGE;
  const failed = await call('job.create', { command: 'node', args: ['spirit/app/zzFail/zzFail.js'] });
  return failed.status >= 200 && failed.status < 300 ? true : 'job.create zzFail: ' + short(failed.text);
}, 5000);
test.run('the world: zzFail failed and stays listed', 0.2, async function () {
  if (!call) return NO_PAGE;
  return (await until(function () { return jobOf('spirit.app.zzFail').then(function (j) { return !!j && j.status === 'failed'; }); }, 10000)) ? true : 'zzFail is ' + short(await jobOf('spirit.app.zzFail'));
}, 15000);
test.run('terminal, it offers Delete and no Cancel', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await mount('spirit.app.zzFail');
  return (await until(function () { return buttons().then(function (b) { return b.indexOf('Delete') !== -1 && b.indexOf('Cancel') === -1; }); }, 10000)) ? true : 'its buttons: ' + short(await buttons());
}, 15000);
test.run('Delete deletes the job on the node', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await press('Delete');
  return (await until(function () { return jobOf('spirit.app.zzFail').then(function (j) { return !j; }); }, 10000)) ? true : 'after Delete the job is ' + short(await jobOf('spirit.app.zzFail'));
}, 15000);
test.run('and the screen goes with it: close is called', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  return (await until(function () { return chrome.evaluate('window.closes.length >= 1'); }, 5000)) ? true : 'close was not called after Delete';
}, 10000);

// "Deleted or never there: say so"
test.run('a job not there says it is no longer listed', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  await mount('spirit.app.zzNeverThere');
  return (await until(function () { return text().then(function (t) { return /no longer listed/i.test(t); }); }, 8000)) ? true : 'for a stranger it shows: ' + short(await text());
}, 12000);
test.run('with no button', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  const b3 = await buttons();
  return b3.indexOf('Cancel') === -1 && b3.indexOf('Delete') === -1 ? true : 'for a stranger its buttons: ' + short(b3);
}, 3000);

// destroy
test.run('destroy empties its host', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  const empty = await chrome.evaluate('(function () { window.made.destroy(); window.made = null; return document.getElementById("box").children.length === 0; }())');
  return empty === true ? true : 'destroy left ' + short(await text());
}, 3000);
test.run('and the page threw nothing', 0.2, async function () {
  if (loaded !== 'loaded') return NO_LOAD;
  const errors = JSON.parse(await chrome.evaluate('JSON.stringify(window.pageErrors)'));
  return errors.length === 0 ? true : 'page errors: ' + short(errors);
}, 3000);
