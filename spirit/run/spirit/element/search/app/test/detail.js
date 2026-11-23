'use strict';

// spirit/run/spirit/element/search/app/test/detail.js
// The tests of spirit/element/search/app/detail.js, and of no other module (spec: ./detail.md; goal/G43.2). A real Chrome on a
// scratch node's face page; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode, chromePage, findChrome, until } = LOADER.requireScript('spirit/test/headLessChrome.js');

const FILE = path.join(RUN, 'spirit', 'element', 'search', 'app', 'detail.js');
const ROW = { key: 'zzapp', label: 'Zz App Label', icon: '🧩' };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let node, chrome, loaded, made, t;
const text = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerText || "")'); };
const html = function () { return chrome.evaluate('String((document.getElementById("under-test") || {}).innerHTML || "")'); };
const R = JSON.stringify(ROW);
// A RUN APP OF ITS OWN (goal/G43.21, goal/G47.1): an app whose <name>.json says node.run, planted in the scratch tree, its script
// doing nothing and ending, so a press of Run is pressed for real and starts nothing that reaches anywhere.
const RUN_ROW = { key: 'zzrun', label: 'Zz Run Label', icon: '🏃' };
function plantRunApp(run) {
  const dir = path.join(run, 'spirit', 'app', 'zzrun');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'zzrun.json'), JSON.stringify({ identity: { icon: RUN_ROW.icon, label: RUN_ROW.label, intrinsic: false }, mount: { 'zzrun.js': true }, shell: { true: false, mount: false, tile: false }, node: { mount: false, run: true } }));
  fs.writeFileSync(path.join(dir, 'zzrun.js'), ["'use strict';", 'setTimeout(function () {}, 200);', ''].join('\n'));
}
const runText = function () { return chrome.evaluate('String((document.getElementById("under-run") || {}).innerText || "")'); };

test.after(function () {
  try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LOADER.requireScript('spirit/test/headLessChrome.js').freeTree(node); } catch (e) { /* scratch */ }
});

test.run('a scratch node comes up, and Chrome opens its face page', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  node = await scratchNode({ before: plantRunApp });
  chrome = await chromePage(findChrome());
  if (!node.up || chrome.error) return false;
  await chrome.send('Page.navigate', { url: node.base + '/face.html' });
  return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) ? true : false;
}, test.limit.slow);
test.run('it loads through spirit.requireScript', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  loaded = await chrome.evaluate('window.spirit.readyPromise.then(function () { return spirit.requireScript("spirit/element/search/app/detail.js"); }).then(function () { var c = document.createElement("div"); c.id = "under-test"; document.body.appendChild(c); return "loaded"; }, function () { return ""; })');
  return loaded === 'loaded' ? true : false;
}, test.limit.quick);
test.run('spirit.required.spirit.element.search.app.detail.create, given a host and a row, makes a detail', 0.2, async function () {
  if (!node || !node.up || !chrome || chrome.error) return false;
  made = await chrome.evaluate('(function () { window.detail = spirit.required.spirit.element.search.app.detail.create(document.getElementById("under-test"), { row: ' + R + ' }); return !!window.detail; }())');
  return made === true ? true : false;
}, test.limit.quick);
test.run('the detail shows the label', 0.2, async function () {
  if (made !== true) return false;
  t = String(await text());
  return t.indexOf(ROW.label) !== -1 ? true : false;
}, test.limit.quick);
test.run('the detail shows the icon', 0.2, async function () {
  if (made !== true) return false;
  return (await html()).indexOf(ROW.icon) !== -1 || /<svg|<img/.test(await html()) ? true : false;
}, test.limit.quick);
test.run('destroy empties its host', 0.2, async function () {
  if (made !== true) return false;
  const empty = await chrome.evaluate('(function () { window.detail.destroy(); return document.getElementById("under-test").children.length === 0; }())');
  return empty === true ? true : false;
}, test.limit.quick);

// RUN (goal/G43.21; Andy, the box: "the app detail will show a run button."), in the panel, only for an app whose <name>.json
// says node.run. ITS BUTTON IS BUSY FROM PRESS UNTIL THE NODE ANSWERS (goal/G47.1, Q20; Andy: "mark the button busy from press
// until the mounter's answer comes").
let runMade, pressed;
test.run('in the panel, an app whose json says node.run shows its task row: its label and a Run button', 0.2, async function () {
  if (loaded !== 'loaded') return false;
  await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "under-run"; document.body.appendChild(c); window.runDetail = spirit.required.spirit.element.search.app.detail.create(c, { row: ' + JSON.stringify(RUN_ROW) + ', panel: true }); return true; }())');
  runMade = !!(await until(function () { return chrome.evaluate('[].some.call(document.querySelectorAll("#under-run button"), function (b) { return b.textContent.trim() === "Run"; })'); }, 8000));
  return runMade && String(await runText()).indexOf(RUN_ROW.label) !== -1 ? true : false;
}, test.limit.quick);
test.run('in the panel, an app with no node.run shows no Run button', 0.2, async function () {
  if (!runMade) return false;
  await chrome.evaluate('(function () { var c = document.createElement("div"); c.id = "under-norun"; document.body.appendChild(c); window.noRunDetail = spirit.required.spirit.element.search.app.detail.create(c, { row: ' + R + ', panel: true }); return true; }())');
  await new Promise(function (r) { setTimeout(r, 1500); });
  const any = await chrome.evaluate('[].some.call(document.querySelectorAll("#under-norun button"), function (b) { return b.textContent.trim() === "Run"; })');
  return any === false ? true : false;
}, test.limit.quick);
// Read once the press itself is done (a turn of the page's clock later), while the node is still asked: a button with no
// request of its own handed to it is a plain button again by then.
test.run('pressed, the Run button stays busy while the node is asked: disabled, with its turning mark', 0.2, async function () {
  if (!runMade) return false;
  pressed = JSON.parse(await chrome.evaluate('(function () { var b = [].filter.call(document.querySelectorAll("#under-run button"), function (x) { return x.textContent.trim() === "Run"; })[0]; b.click(); return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return JSON.stringify({ disabled: b.disabled, mark: !!b.querySelector(".shell-busy") }); }); }())'));
  return pressed.disabled === true && pressed.mark === true ? true : false;
}, test.limit.quick);
test.run('once the node answers, the button is a plain button again', 0.2, async function () {
  if (!pressed) return false;
  const plain = await until(function () { return chrome.evaluate('(function () { var b = document.querySelector("#under-run button"); return !!b && !b.disabled && !b.querySelector(".shell-busy"); }())'); }, 10000);
  return plain === true ? true : false;
}, test.limit.quick);
// A job's id is its route (spirit/job.js, goal/G43.20): an app's run is spirit.app.<name>.
test.run('the press started the app on the node: its job, spirit.app.zzrun, running its script', 0.2, async function () {
  if (!pressed) return false;
  const job = await until(function () { return chrome.evaluate('(function () { var j = window.spirit.required.spirit.data.job.data.job("spirit.app.zzrun"); return !!(j && j.data && (j.data.args || []).indexOf("spirit/app/zzrun/zzrun.js") !== -1); }())'); }, 10000);
  return job ? true : false;
}, test.limit.quick);
