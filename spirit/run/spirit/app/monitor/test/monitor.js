'use strict';

// spirit/run/spirit/app/monitor/test/monitor.js
// The tests of spirit/app/monitor/monitor.js, and of no other module (spec: ./monitor.md; goal/G43.6). Andy, box: "An app that
// reads and displays a stream, called "monitor". It resides in spirit.app.monitor". A real Chrome on a scratch node's page, the
// node's own server-stats job on the real stream; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.js');
const JSON_FILE = path.join(RUN, 'spirit', 'app', 'monitor', 'monitor.json');
// The box: "its 11 numbers", as old Stats names them, and its groups of counts: "Jobs by status replaces Active jobs".
const NUMBERS = ['Memory (RSS)', 'Heap used', 'CPU', 'Uptime', 'Event loop mean', 'Event loop max', 'Event loop p99', 'Files', 'Folders', 'SSE connections', 'Requests total'];
const GROUPS = ['Jobs by status', 'Files by MIME type', 'Requests by method', 'Requests by status class'];

test.startTest('monitor.js: an app that reads and displays a stream (goal/G43.6)');

(async function () {
  test.subHeading('monitor.json: "icon 🦻, label "Monitor", mount monitor.js, shell mount and tile true, node mount false."');
  let m = {};
  try { m = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); } catch (e) { m = {}; }
  ok(m.identity && m.identity.icon === '🦻' && m.identity.label === 'Monitor', 'icon 🦻, label Monitor', 'identity: ' + short(m.identity));
  ok(m.mount && m.mount['monitor.js'] === true, 'it mounts monitor.js', 'mount: ' + short(m.mount));
  ok(m.shell && m.shell.mount === true && m.shell.tile === true, 'shell mount and tile are true', 'shell: ' + short(m.shell));
  ok(m.node && m.node.mount === false, 'node mount is false', 'node: ' + short(m.node));

  test.subHeading('"It requires no old code: no spirit.shell." "It opens no other app"');
  const code = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  ok(!!code, 'monitor.js is there', 'spirit/app/monitor/monitor.js is not there: nothing below can pass');
  ok(code && !/spirit\.shell|launchApp|data-launch-app/.test(code), 'it names no spirit.shell and launches nothing', 'monitor.js reaches the old shell or launches an app');
  ok(code && !/['"]\/?shell\//.test(code), 'it requires nothing under shell/', 'monitor.js names a path under shell/');
  ok(code && !/\.elements\b/.test(code), 'it reaches nothing through spirit.elements', 'monitor.js names spirit.elements');
  ok(code && /spirit\.element\.search.valued|element\.search.valued/.test(code) && /spirit\/element\/search\/valued\.js/.test(code), 'it loads and uses the valued element', 'monitor.js does not load spirit/element/search/valued.js and use it');

  const node = await scratchNode();
  const chrome = await chromePage(findChrome());
  try {
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    const js = function (s) { return chrome.evaluate(s); };
    const read = async function () {
      try {
        return JSON.parse(await js('(function () { var c = window.__box; if (!c) return "{}"; var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); var cells = [].map.call(c.querySelectorAll("tr, [data-row], .row"), function (r) { return r.innerText.replace(/\\s+/g, " ").trim(); }).filter(Boolean); var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); return JSON.stringify({ text: c.innerText, inputs: inputs.length, word: inputs[0] ? inputs[0].value : "", rows: cells, scroll: best ? best.scrollTop : -1, canScroll: !!best }); })()'));
      } catch (e) { return { threw: String(e) }; }
    };
    const started = await js('window.spirit.ready.then(function () { return window.spirit.cacheManager("jobs"); }).then(function () { return window.spirit.require("spirit/app/monitor/monitor.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
    ok(started === 'loaded', 'monitor.js loads on a page', 'loading it: ' + short(started));
    test.subHeading('"It resides in spirit.app.monitor": spirit.app.monitor.createApp(container) -> { destroy() }');
    const home = await js('(function () { return JSON.stringify({ app: typeof (window.spirit.app || {}).monitor, create: typeof ((window.spirit.app || {}).monitor || {}).createApp, search: typeof (window.spirit.app || {}).searchApp, word: typeof (window.spirit.app || {}).search, old: typeof (window.spirit.elements || {}).monitor, element: typeof (window.spirit.element || {}).monitor }); })()');
    let h = {}; try { h = JSON.parse(home); } catch (e) { h = {}; }
    ok(h.create === 'function', 'spirit.app.monitor.createApp is there', 'spirit.app: ' + short(h));
    ok(h.search === 'function' && h.word === 'undefined', 'and the function that implements the family\'s verb, spirit.app.searchApp, is beside it, and no spirit.app.search', 'spirit.app: ' + short(h));
    ok(h.old === 'undefined' && h.element === 'undefined', 'it is on neither spirit.elements nor spirit.element', 'spirit.app: ' + short(h));
    if (h.create !== 'function') return;

    test.subHeading('"Until the first reading, it says it is waiting, as old Stats does."');
    // No reading on the page: the job taken out of the page's data set; the next one the stream brings is its first.
    await js('(function () { var J = ((window.spirit.data || {}).jobs || {}).data; var job = J.find(function (j) { return j && j.id === "spirit"; }); if (job) window.spirit.data.viewAt(null, "jobs").del("jobs/" + job.id); window.__job = job ? job.id : ""; var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:240px;display:flex;flex-direction:column"; window.__box = d; window.__said = []; new MutationObserver(function () { var t = d.innerText; if (t) window.__said.push(/waiting/i.test(t) && !/Uptime/.test(t) ? "waiting" : "other"); }).observe(d, { childList: true, subtree: true, characterData: true }); window.__made = window.spirit.app.monitor.createApp(d); return true; })()');
    // WHAT IT SAID FIRST, watched as it is drawn: the stream's next reading can come at any moment after the job is taken out.
    await until(function () { return js('window.__said.length > 0'); }, 8000);
    const said = await js('window.__said[0] || ""');
    ok(said === 'waiting', 'with no reading it says it is waiting, before the first numbers', 'the first it showed was ' + short(said));

    test.subHeading('"It reads the node\'s server-stats job from the stream ... and shows its numbers."');
    const came = await until(function () { return read().then(function (r) { return NUMBERS.every(function (n) { return String(r.text).indexOf(n) !== -1; }); }); }, 20000);
    const shown = await read();
    const absent = NUMBERS.concat(GROUPS).filter(function (n) { return String(shown.text).indexOf(n) === -1; });
    ok(came && !absent.length, 'the stream\'s reading brings its 11 numbers and four groups of counts', 'missing: ' + short(absent) + ', it shows: ' + short(shown.text));
    ok(!/waiting/i.test(String(shown.text)), 'and it no longer says waiting', 'it still says waiting');
    ok(String(shown.text).indexOf('Active jobs') === -1, '"Jobs by status replaces Active jobs"', 'it still shows Active jobs');
    ok(shown.inputs === 1, 'one search field', shown.inputs + ' search fields');
    const data = JSON.parse(await js('JSON.stringify(window.spirit.data.jobs.data.find(function (j) { return j && j.id === "spirit"; }).data.stats)'));
    const rss = await js('window.spirit.formatBytes(' + Number(data.memory.rss) + ')');
    const method = Object.keys((data.requests || {}).byMethod || {})[0];
    const live = await read();
    const lineOf = function (r, word) { return (r.rows || []).filter(function (l) { return l.indexOf(word) !== -1; })[0] || ''; };
    ok(!!lineOf(live, 'Requests by method') && !!method && (live.rows || []).some(function (l) { return l.indexOf('Requests by method') !== -1 && l.indexOf(method) !== -1; }), 'a count is a row of its own: group, name and value', 'the rows: ' + short((live.rows || []).slice(0, 6)) + ', method ' + short(method));
    ok(!!lineOf(live, 'Memory (RSS)'), 'a number is a row of its own', 'the rows: ' + short((live.rows || []).slice(0, 6)));
    ok(typeof rss === 'string' && rss.length > 0, 'the world: the page formats bytes', 'formatBytes: ' + short(rss));

    test.subHeading('"Each new reading repaints the numbers. A repaint keeps the search words and the scroll."');
    const uptime = lineOf(live, 'Uptime');
    const moved = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') && lineOf(r, 'Uptime') !== uptime; }); }, 20000);
    ok(moved, 'a new reading changes the number on screen, with nothing asked', 'Uptime stayed ' + short(uptime));
    await js('(function () { var c = window.__box; var best = null; c.querySelectorAll("*").forEach(function (e) { if (e.scrollHeight - e.clientHeight > 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && (!best || e.scrollHeight > best.scrollHeight)) best = e; }); if (best) best.scrollTop = 40; return true; })()');
    const scrolled = await read();
    ok(scrolled.canScroll && scrolled.scroll === 40, 'the world: the list scrolls in its box', 'scroll: ' + short({ can: scrolled.canScroll, at: scrolled.scroll }));
    const up1 = lineOf(scrolled, 'Uptime');
    const again = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') !== up1; }); }, 20000);
    const after = await read();
    ok(again && after.scroll === 40, 'a repaint keeps the scroll', 'after a repaint the scroll is ' + short(after.scroll));
    await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; if (i) { i.value = "Uptime"; i.dispatchEvent(new Event("input", { bubbles: true })); } return true; })()');
    await sleep(500);
    const narrowed = await read();
    // A probabilitySearch ranks, it does not filter (goal/G18.5): the row that fits comes first.
    const uptimeRow = function (r) { return (r.rows || []).filter(function (l) { return /group|name value/i.test(l) === false; })[0] || ''; };
    ok(narrowed.word === 'Uptime' && uptimeRow(narrowed).indexOf('Uptime') !== -1, 'words put the row that fits first, under the one search field', 'searching: ' + short({ word: narrowed.word, first: uptimeRow(narrowed) }));
    const up2 = lineOf(narrowed, 'Uptime');
    const third = await until(function () { return read().then(function (r) { return lineOf(r, 'Uptime') !== up2; }); }, 20000);
    const kept = await read();
    ok(third && kept.word === 'Uptime' && uptimeRow(kept).indexOf('Uptime') !== -1, 'a repaint keeps the words, and the row that fits first', 'after a repaint: ' + short({ word: kept.word, first: uptimeRow(kept) }));

    test.subHeading('{ destroy() }');
    const count = await js('(function () { var before = window.__box.innerText.length; window.__made.destroy(); return JSON.stringify({ before: before, after: window.__box.innerText.length }); })()');
    let c = {}; try { c = JSON.parse(count); } catch (e) { c = {}; }
    ok(c.before > 0 && c.after === 0, 'destroy leaves its container empty', 'destroy: ' + short(c));
    const quiet = await read();
    await sleep(6000);
    const still = await read();
    ok(String(still.text) === String(quiet.text), 'and a later reading paints nothing', 'after destroy it shows: ' + short(still.text));
  } finally {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
