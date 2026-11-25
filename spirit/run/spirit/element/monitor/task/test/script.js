'use strict';

// spirit/run/spirit/element/monitor/task/test/script.js
// The tests of spirit/element/monitor/task/script.js, and of no other module (spec: ./script.md; goal/G47.1). A real Chrome on a
// scratch node's face page, with three apps planted in the scratch tree; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

const FILE = path.join(RUN, 'spirit', 'element', 'monitor', 'task', 'script.js');
// zztask publishes its progress, as a run process does (goal/G29.14: {job: {state, name, done, total, text}}), and runs on
// until cancelled; zzfail fails at once; zznorun is no run app.
const APPS = {
  zztask: { label: 'Zz Task', icon: '🧪', run: true, script: ["'use strict';", "require('../../script.js');", "spirit.eventStream.publish({ job: { state: 'progress', name: 'zz', done: 1, total: 2, text: 'halfway there' } });", 'setTimeout(function () {}, 60000);', ''] },
  zzfail: { label: 'Zz Fail', icon: '💥', run: true, script: ["'use strict';", 'setTimeout(function () { process.exit(1); }, 300);', ''] },
  zznorun: { label: 'Zz No Run', icon: '🚫', run: false, script: ["'use strict';", ''] },
};
function plant(run) {
  Object.keys(APPS).forEach(function (k) {
    const a = APPS[k];
    const dir = path.join(run, 'spirit', 'app', k);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify({ identity: { icon: a.icon, label: a.label, intrinsic: false }, mount: { [k + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: false, run: a.run } }));
    fs.writeFileSync(path.join(dir, k + '.js'), a.script.join('\n'));
  });
}

let node, chrome, loaded;
test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});

// Mounted in a container of its own, #task-<app>; what it shows, read from the page.
const mount = function (app) { return chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "task-' + app + '"; document.body.appendChild(c); window["t_' + app + '"] = spirit.required.spirit.element.monitor.task.create(c, { id: "spirit.app.' + app + '" }); return true; }())'); };
const look = function (app) { return chrome.evaluate('(function () { var c = document.getElementById("task-' + app + '"); var b = c && c.querySelector("button"); var s = c && c.querySelector(".shell-row-form-span"); return JSON.stringify({ button: b && b.style.display !== "none" ? b.textContent.trim() : "", line: s ? s.textContent : "", form: !!(c && c.querySelector(".shell-row-form")), text: c ? c.innerText.trim() : "", html: c ? c.innerHTML : "" }); }())').then(JSON.parse); };
const press = function (app) { return chrome.evaluate('(function () { var b = document.querySelector("#task-' + app + ' button"); b.click(); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); }); }())').then(JSON.parse); };
const waitFor = function (app, fn, ms) { return until(function () { return look(app).then(fn); }, ms || 10000); };

test.run('a scratch node comes up with three apps planted, and Chrome opens its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode({ before: plant });
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
  // Slow, not quick: a scratch node booted, Chrome started and up to 20 s for the page cannot fit 10 s; on Andy's node,
  // loaded by his testicle run, it did not (2026-11-17, red at 0.7, every row after it with it).
}, test.limit.slow);
test.run('it loads through spirit.requireScript', 0.2, async function () {
  if (!chrome || chrome.error) return false;
  loaded = await chrome.evaluate('spirit.requireScript("spirit/element/monitor/task/script.js").then(function () { return spirit.required.spirit.element.monitor.task && typeof spirit.required.spirit.element.monitor.task.create === "function" ? "loaded" : "no create"; })');
  return loaded === 'loaded' || false;
}, test.limit.quick);

// Andy: "rowForm: <app-icon> "<app-name> + <status-message-while-running>" [run|cancel|delete]".
let shown;
test.run('for a run app it shows a row form with the app\'s icon, its name, and a Run button', 0.4, async function () {
  if (loaded !== 'loaded') return false;
  await mount('zztask');
  shown = await waitFor('zztask', function (l) { return l.button === 'Run'; });
  const l = await look('zztask');
  return !!shown && l.line === 'Zz Task' && l.html.indexOf(APPS.zztask.icon) !== -1 ? true : false;
}, test.limit.quick);
test.run('for an app that is no run app it shows nothing', 0.4, async function () {
  if (loaded !== 'loaded') return false;
  await mount('zznorun');
  await mount('zzwhatever');
  await new Promise(function (r) { setTimeout(r, 1500); });
  const a = await look('zznorun'), b = await look('zzwhatever');
  return !a.form && !a.button && a.text === '' && !b.form && !b.button && b.text === '' ? true : false;
}, test.limit.quick);

// goal/G47.1, Q20: a row form's button is busy from press until the node answers.
let ran;
test.run('pressed, Run is busy while the node is asked: disabled, with its turning mark', 0.4, async function () {
  if (!shown) return false;
  ran = await press('zztask');
  return ran.disabled === true && ran.mark === true ? true : false;
}, test.limit.quick);
let running;
test.run('while its job runs, the line shows the name and the text the app published, and the button is Cancel', 0.4, async function () {
  if (!ran) return false;
  running = await waitFor('zztask', function (l) { return l.button === 'Cancel' && l.line === 'Zz Task: halfway there'; }, 15000);
  return running ? true : false;
}, test.limit.long);
// spirit/job/script.js: a cancelled run is removed, so Run comes back.
test.run('Cancel ends its job, and the row offers Run again with the name alone', 0.4, async function () {
  if (!running) return false;
  await press('zztask');
  const back = await waitFor('zztask', function (l) { return l.button === 'Run' && l.line === 'Zz Task'; }, 15000);
  const gone = await chrome.evaluate('!window.spirit.required.spirit.data.job.data.job("spirit.app.zztask")');
  return back && gone === true ? true : false;
}, test.limit.long);
// Andy: "run-apps usually self-delete if they're successful, if they fail, they stay and offer "delete"".
let failed;
test.run('a run that fails stays: the line says failed, and the button is Delete', 0.4, async function () {
  if (loaded !== 'loaded') return false;
  await mount('zzfail');
  if (!(await waitFor('zzfail', function (l) { return l.button === 'Run'; }))) return false;
  await press('zzfail');
  failed = await waitFor('zzfail', function (l) { return l.button === 'Delete' && l.line === 'Zz Fail: failed'; }, 15000);
  return failed ? true : false;
}, test.limit.long);
test.run('Delete takes the failed job away, and the row offers Run again', 0.4, async function () {
  if (!failed) return false;
  await press('zzfail');
  const back = await waitFor('zzfail', function (l) { return l.button === 'Run' && l.line === 'Zz Fail'; }, 15000);
  const gone = await chrome.evaluate('!window.spirit.required.spirit.data.job.data.job("spirit.app.zzfail")');
  return back && gone === true ? true : false;
}, test.limit.long);
test.run('destroyed, it leaves its container empty', 0.2, async function () {
  if (!shown) return false;
  const html = await chrome.evaluate('(function () { window.t_zztask.destroy(); return document.getElementById("task-zztask").innerHTML; }())');
  return html === '' ? true : false;
}, test.limit.quick);
