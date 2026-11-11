'use strict';

// spirit/run/spirit/app/monitor/test/element.js
// The tests of spirit/app/monitor/element.js, and of no other module (spec: ./monitor.md; goal/G43.6). Andy, box: "An app that
// reads and displays a stream, called "monitor". It resides in spirit.app.monitor". A real Chrome on a scratch node's page, the
// node's own server-stats job on the real stream; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'element.js');
const JSON_FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.json');
// The box: "its 11 numbers", as old Stats names them, and its groups of counts: "Jobs by status replaces Active jobs".
const NUMBERS = ['Memory (RSS)', 'Heap used', 'CPU', 'Uptime', 'Event loop mean', 'Event loop max', 'Event loop p99', 'Files', 'Folders', 'SSE connections', 'Requests total'];
const GROUPS = ['Jobs by status', 'Files by MIME type', 'Requests by method', 'Requests by status class'];


// element.js: the monitor, an app that reads and displays a stream (goal/G43.6). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = {};
test.after(function () {
  const chrome = W.chrome, node = W.node || {};
  if (chrome && chrome.kid) chrome.kid.kill();
  if (node.child) node.child.kill();
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
});
const NO_PAGE = 'no page: the world failed';
const NO_MONITOR = 'no monitor on the page: the tests before failed';
function readJson() { try { return JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); } catch (e) { return {}; } }
function readCode() { return fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '') : ''; }
const js = function (s) { return W.chrome.evaluate(s); };
const read = async function () {
  try {
    return JSON.parse(await js('(function () { var c = window.__box; if (!c) return "{}"; var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); var cells = [].map.call(c.querySelectorAll("tr, [data-row], .row"), function (r) { return r.innerText.replace(/\\s+/g, " ").trim(); }).filter(Boolean); var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); return JSON.stringify({ text: c.innerText, inputs: inputs.length, word: inputs[0] ? inputs[0].value : "", rows: cells, scroll: best ? best.scrollTop : -1, canScroll: !!best }); })()'));
  } catch (e) { return { threw: String(e) }; }
};
const lineOf = function (r, word) { return (r.rows || []).filter(function (l) { return l.indexOf(word) !== -1; })[0] || ''; };
// A probabilitySearch ranks, it does not filter (goal/G18.5): the row that fits comes first.
const uptimeRow = function (r) { return (r.rows || []).filter(function (l) { return /group|name value/i.test(l) === false; })[0] || ''; };

// monitor.json: "icon 🦻, label "Monitor", mount monitor.js, shell mount and tile true, node mount false." Since goal/G43.32 it mounts element.js (rule 4)
test.run('icon 🦻, label Monitor', 0.2, function () {
  const m = readJson();
  return m.identity && m.identity.icon === '🦻' && m.identity.label === 'Monitor' ? true : 'identity: ' + short(m.identity);
}, test.limit.quick);
test.run('it mounts element.js', 0.2, function () {
  const m = readJson();
  return m.mount && m.mount['element.js'] === true ? true : 'mount: ' + short(m.mount);
}, test.limit.quick);
test.run('shell mount and tile are true', 0.2, function () {
  const m = readJson();
  return m.shell && m.shell.mount === true && m.shell.tile === true ? true : 'shell: ' + short(m.shell);
}, test.limit.quick);
test.run('node mount is false', 0.2, function () {
  const m = readJson();
  return m.node && m.node.mount === false ? true : 'node: ' + short(m.node);
}, test.limit.quick);

// "It requires no old code: no spirit.shell." "It opens no other app"
test.run('monitor.js is there', 0.2, function () {
  return !!readCode() || 'spirit/app/monitor/element.js is not there: nothing below can pass';
}, test.limit.quick);
test.run('it names no spirit.shell and launches nothing', 0.2, function () {
  const code = readCode();
  return code && !/spirit\.shell|launchApp|data-launch-app/.test(code) ? true : 'monitor.js reaches the old shell or launches an app';
}, test.limit.quick);
test.run('it requires nothing under shell/', 0.2, function () {
  const code = readCode();
  return code && !/['"]\/?shell\//.test(code) ? true : 'monitor.js names a path under shell/';
}, test.limit.quick);
test.run('it reaches nothing through spirit.elements', 0.2, function () {
  const code = readCode();
  return code && !/\.elements\b/.test(code) ? true : 'monitor.js names spirit.elements';
}, test.limit.quick);
test.run('it loads and uses the valued element', 0.2, function () {
  const code = readCode();
  return code && /spirit\.element\.search.valued|element\.search.valued/.test(code) && /spirit\/element\/search\/valued\.js/.test(code) ? true : 'monitor.js does not load spirit/element/search/valued.js and use it';
}, test.limit.quick);

test.run('the world: a scratch node and a Chrome page on its face', 0.2, async function () {
  W.node = await scratchNode();
  W.chrome = await chromePage(findChrome());
  if (!W.chrome || W.chrome.error) return 'Chrome: ' + short(W.chrome && W.chrome.error);
  await W.chrome.send('Page.navigate', { url: W.node.base + '/face.html' });
  W.page = !!(await until(function () { return W.chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000));
  return W.page || 'the page has no spirit: nothing judged';
}, test.limit.slow);
test.run('monitor.js loads on a page', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const started = await js('window.spirit.ready.then(function () { return window.spirit.cacheManager("job"); }).then(function () { return window.spirit.require("spirit/app/monitor/element.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
  return started === 'loaded' || 'loading it: ' + short(started);
}, test.limit.quick);

// goal/G43.32, the box: "Monitor too: its createApp becomes its element.js, and appSelector's createApp path goes."
// the box (goal/G43.32): "its createApp becomes its element.js": spirit.element.spirit.app.monitor.element.create(container) -> { destroy() }
test.run('spirit.element.spirit.app.monitor.element.create is there', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const home = await js('(function () { var a = ((window.spirit.element || {}).spirit || {}).app || {}; return JSON.stringify({ create: typeof ((a.monitor || {}).element || {}).create, createApp: typeof ((window.spirit.app || {}).monitor || {}).createApp, old: typeof (window.spirit.elements || {}).monitor }); })()');
  let h = {}; try { h = JSON.parse(home); } catch (e) { h = {}; }
  W.h = h;
  W.create = h.create === 'function';
  return W.create || 'its places: ' + short(h);
}, test.limit.quick);
test.run('and no spirit.app.monitor.createApp, nor anything on spirit.elements', 0.2, function () {
  if (!W.h) return NO_PAGE;
  return W.h.createApp === 'undefined' && W.h.old === 'undefined' ? true : 'its places: ' + short(W.h);
}, test.limit.quick);

// "Until the first reading, it says it is waiting, as old Stats does."
test.run('with no reading it says it is waiting, before the first numbers', 0.2, async function () {
  if (!W.create) return NO_MONITOR;
  // No reading on the page: the job taken out of the page's data set; the next one the stream brings is its first.
  await js('(function () { var J = ((window.spirit.data || {}).job || {}).data; var job = J.find(function (j) { return j && j.id === "spirit"; }); if (job) window.spirit.data.viewAt(null, "job").del("jobs/" + job.id); window.__job = job ? job.id : ""; var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:240px;display:flex;flex-direction:column"; window.__box = d; window.__said = []; new MutationObserver(function () { var t = d.innerText; if (t) window.__said.push(/waiting/i.test(t) && !/Uptime/.test(t) ? "waiting" : "other"); }).observe(d, { childList: true, subtree: true, characterData: true }); window.__made = window.spirit.element.spirit.app.monitor.element.create(d); return true; })()');
  W.made = true;
  // WHAT IT SAID FIRST, watched as it is drawn: the stream's next reading can come at any moment after the job is taken out.
  await until(function () { return js('window.__said.length > 0'); }, 8000);
  const said = await js('window.__said[0] || ""');
  return said === 'waiting' || 'the first it showed was ' + short(said);
}, test.limit.quick);

// "It reads the node's server-stats job from the stream ... and shows its numbers."
test.run('the stream\'s reading brings its 11 numbers and four groups of counts', 0.2, async function () {
  if (!W.made) return NO_MONITOR;
  const came = await until(function () { return read().then(function (r) { return NUMBERS.every(function (n) { return String(r.text).indexOf(n) !== -1; }); }); }, 20000);
  const shown = W.shown = await read();
  const absent = NUMBERS.concat(GROUPS).filter(function (n) { return String(shown.text).indexOf(n) === -1; });
  return came && !absent.length ? true : 'missing: ' + short(absent) + ', it shows: ' + short(shown.text);
}, test.limit.slow);
test.run('and it no longer says waiting', 0.2, function () {
  if (!W.shown) return NO_MONITOR;
  return !/waiting/i.test(String(W.shown.text)) || 'it still says waiting';
}, test.limit.quick);
test.run('"Jobs by status replaces Active jobs"', 0.2, function () {
  if (!W.shown) return NO_MONITOR;
  return String(W.shown.text).indexOf('Active jobs') === -1 || 'it still shows Active jobs';
}, test.limit.quick);
test.run('one search field', 0.2, function () {
  if (!W.shown) return NO_MONITOR;
  return W.shown.inputs === 1 || W.shown.inputs + ' search fields';
}, test.limit.quick);
test.run('a count is a row of its own: group, name and value', 0.2, async function () {
  if (!W.made) return NO_MONITOR;
  const data = W.data = JSON.parse(await js('JSON.stringify(window.spirit.data.job.data.find(function (j) { return j && j.id === "spirit"; }).data.stats)'));
  const method = Object.keys((data.requests || {}).byMethod || {})[0];
  const live = W.live = await read();
  return !!lineOf(live, 'Requests by method') && !!method && (live.rows || []).some(function (l) { return l.indexOf('Requests by method') !== -1 && l.indexOf(method) !== -1; }) ? true : 'the rows: ' + short((live.rows || []).slice(0, 6)) + ', method ' + short(method);
}, test.limit.quick);
test.run('a number is a row of its own', 0.2, function () {
  if (!W.live) return NO_MONITOR;
  return !!lineOf(W.live, 'Memory (RSS)') || 'the rows: ' + short((W.live.rows || []).slice(0, 6));
}, test.limit.quick);
test.run('the world: the page formats bytes', 0.2, async function () {
  if (!W.data) return NO_MONITOR;
  const rss = await js('window.spirit.formatBytes(' + Number(W.data.memory.rss) + ')');
  return typeof rss === 'string' && rss.length > 0 ? true : 'formatBytes: ' + short(rss);
}, test.limit.quick);

// "Each new reading repaints the numbers. A repaint keeps the search words and the scroll."
test.run('a new reading changes the number on screen, with nothing asked', 0.2, async function () {
  if (!W.live) return NO_MONITOR;
  const uptime = lineOf(W.live, 'Uptime');
  const moved = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') && lineOf(r, 'Uptime') !== uptime; }); }, 20000);
  return moved ? true : 'Uptime stayed ' + short(uptime);
}, test.limit.slow);
test.run('the world: the list scrolls in its box', 0.2, async function () {
  if (!W.made) return NO_MONITOR;
  await js('(function () { var c = window.__box; var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); if (best) best.scrollTop = 40; return true; })()');
  const scrolled = W.scrolled = await read();
  return scrolled.canScroll && scrolled.scroll === 40 ? true : 'scroll: ' + short({ can: scrolled.canScroll, at: scrolled.scroll });
}, test.limit.quick);
test.run('a repaint keeps the scroll', 0.2, async function () {
  if (!W.scrolled) return NO_MONITOR;
  const up1 = lineOf(W.scrolled, 'Uptime');
  const again = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') !== up1; }); }, 20000);
  const after = await read();
  return again && after.scroll === 40 ? true : 'after a repaint the scroll is ' + short(after.scroll);
}, test.limit.slow);
test.run('words put the row that fits first, under the one search field', 0.2, async function () {
  if (!W.made) return NO_MONITOR;
  await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; if (i) { i.value = "Uptime"; i.dispatchEvent(new Event("input", { bubbles: true })); } return true; })()');
  await sleep(500);
  const narrowed = W.narrowed = await read();
  return narrowed.word === 'Uptime' && uptimeRow(narrowed).indexOf('Uptime') !== -1 ? true : 'searching: ' + short({ word: narrowed.word, first: uptimeRow(narrowed) });
}, test.limit.quick);
test.run('a repaint keeps the words, and the row that fits first', 0.2, async function () {
  if (!W.narrowed) return NO_MONITOR;
  const up2 = lineOf(W.narrowed, 'Uptime');
  const third = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') !== up2; }); }, 20000);
  const kept = await read();
  return third && kept.word === 'Uptime' && uptimeRow(kept).indexOf('Uptime') !== -1 ? true : 'after a repaint: ' + short({ word: kept.word, first: uptimeRow(kept) });
}, test.limit.slow);

// { destroy() }
test.run('destroy leaves its container empty', 0.2, async function () {
  if (!W.made) return NO_MONITOR;
  const count = await js('(function () { var before = window.__box.innerText.length; window.__made.destroy(); return JSON.stringify({ before: before, after: window.__box.innerText.length }); })()');
  let c = {}; try { c = JSON.parse(count); } catch (e) { c = {}; }
  W.destroyed = true;
  return c.before > 0 && c.after === 0 ? true : 'destroy: ' + short(c);
}, test.limit.quick);
test.run('and a later reading paints nothing', 0.2, async function () {
  if (!W.destroyed) return NO_MONITOR;
  const quiet = await read();
  await sleep(6000);
  const still = await read();
  return String(still.text) === String(quiet.text) ? true : 'after destroy it shows: ' + short(still.text);
}, test.limit.slow);
