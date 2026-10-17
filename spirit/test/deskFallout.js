'use strict';

// spirit/test/deskFallout.js
// goal/G27.14, its reduced scope: the Fallout desk app searches the verifier's reds. Red on today's tree; claude-windows
// writes it and builds it (one agent). The item's box (v9), Andy's rulings, 2026-10-17:
//   F1. Fallout is a standard desk plugin with its own goal, plugin/fallout, and a Fallout tab under Apps.
//   F2. its tab holds two inner tabs, Reds and Items. Reds holds one search box and one table: the text is searched over
//       the verifier records of tests that are red now (deskVerify search, outcome red); each match is a row: suite,
//       test, the commit and time it went red, and its failure line.
//   F3. the search goes through the plugin's own verb, which asks this node's deskVerify; the page reads no database.
//   F4. Items stays empty for now, saying so; no items, no item form, no chat.
// The world is deskStacksDialog.js's: a real desk with the plugins as they are, and a fake node standing for deskVerify.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G27.14: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const PLUGIN_JS = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'fallout', 'fallout.js');
const PLUGIN_JSON = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'fallout', 'fallout.json');
const PLUGIN_UI = path.join(RUN, 'shell', 'desk', 'plugins', 'fallout', 'fallout.js');
const GOAL = 'plugin/fallout';
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskFalloutTestOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
// Keyed as testSupport keys a test since goal/G27.14: its sub-heading and its number under it.
const RED = { suite: 'zzFalloutA.js', title: 'the relay answers its key #3', outcome: 'red', commit: 'abc1234', at: '2026-10-17T09:00:00.000Z', failure: 'boom: no answer' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G27.14: the Fallout desk app searches the verifier\'s reds');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desk-fallout-'));

// ── THE FAKE NODE: deskVerify's search ──
const verifyAsks = [];
let node = null;
async function startNode() {
  node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = j && j.ask === 'api' ? { desk: {} } : { ok: true };
        if (j && j.ask && j.ask.deskVerify) {
          const verb = Object.keys(j.ask.deskVerify)[0];
          verifyAsks.push([verb, j.ask.deskVerify[verb] || {}]);
          out = verb === 'search' ? { items: [{ key: '7', label: JSON.stringify(RED) }], more: false, total: (j.ask.deskVerify.search || {}).outcome === 'green' ? 340 : 12 } : { ok: false, code: 'no-such-verb', error: 'no such verb' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

let kid = null;
let client = null;
const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, ANDY).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
async function factsOf(id) { const r = await call('item.get', { id: id }); try { return JSON.parse(r.item); } catch (e) { return null; } }

async function serverHalf() {
  test.subHeading('F1. a standard desk plugin with its own goal and tab');
  if (fs.existsSync(PLUGIN_JS) && fs.existsSync(PLUGIN_JSON)) test.check('the plugin sits in the plugin folder: fallout/fallout.js and fallout.json');
  else { test.fail(OWED + 'no process/js/desk/plugins/js/fallout/ with its .js and .json'); return; }
  await startNode();
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  kid = spawn(process.execPath, [DESK, JSON.stringify({ stackFrameList: path.join(scratch, 'stackFrameList.json') }), '--pipe', pipe, '--state', path.join(root, 'state')], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  let tree = null;
  for (let i = 0; i < 60 && !tree; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) tree = r.body.desk; } catch (e) { /* not yet */ } }
  if (!tree) { test.fail('the world: the desk did not start'); return; }
  await sleep(300);
  const g = await factsOf(GOAL);
  if (g && g.plugin === 'fallout' && /^fallout$/i.test(String(g.pluginTab || ''))) test.check('its first mount made the goal ' + GOAL + ', its tab Fallout');
  else test.fail(OWED + GOAL + ' reads ' + short(g));

  test.subHeading('F3. the search is the plugin\'s verb, asking deskVerify for tests that are red now');
  if (tree['fallout.reds']) test.check('the desk declares fallout.reds');
  else { test.fail(OWED + 'the desk declares no fallout.reds'); return; }
  const r1 = await call('fallout.reds', { text: 'relay key' });
  const a1 = verifyAsks[verifyAsks.length - 1] || [];
  const rows = ((r1 && r1.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } });
  // NOTHING SENT THAT IS NOT SHOWN (Andy, 2026-10-17: "don't return shit in the search that i don't want to see! WASTE
  // OF SPACE."): the list asks for folded lines (fold: yes) without commit or failure text (slim: yes).
  if (a1[0] === 'search' && a1[1].fold === 'yes' && a1[1].slim === 'yes') test.check('the list asks deskVerify for folded, slim lines');
  else test.fail(OWED + 'the list asked ' + short(a1));
  if (a1[0] === 'search' && a1[1].over === 'tests' && a1[1].outcome === 'red' && a1[1].test === 'relay key' && a1[1].current === 'yes') test.check('words ask deskVerify search {over: tests, outcome: red, current: yes, test: the words}');
  else test.fail(OWED + 'deskVerify was asked ' + short(a1));
  if (rows.length === 1 && rows[0] && rows[0].title === RED.title && rows[0].failure === RED.failure) test.check('its answer carries deskVerify\'s rows as they came');
  else test.fail(OWED + 'fallout.reds answered ' + short(r1));
  await call('fallout.reds', { text: 'zzFalloutA.js' });
  const a2 = verifyAsks[verifyAsks.length - 1] || [];
  if (a2[1] && a2[1].suite === 'zzFalloutA.js' && !a2[1].test && a2[1].outcome === 'red') test.check('a suite\'s file name asks for that suite\'s reds');
  else test.fail(OWED + 'a suite name asked ' + short(a2));
  // The ✅/❌ filter (Andy, 2026-10-17: "do i get a filter for ✅ or ❌?"): green, red, or both ('').
  await call('fallout.reds', { text: '', outcome: 'green' });
  const a3 = verifyAsks[verifyAsks.length - 1] || [];
  await call('fallout.reds', { text: '', outcome: '' });
  const a4 = verifyAsks[verifyAsks.length - 1] || [];
  if (a3[1] && a3[1].outcome === 'green' && a4[1] && !a4[1].outcome) test.check('the outcome asked is green, red, or both');
  else test.fail(OWED + 'outcome filter asked ' + short([a3, a4]));
  // THE SIZE OF THE PROBLEM (Andy, 2026-10-17: "i would like to know much more: how many red in total
  // (size-of-problem-info)"): how many tests are red now, and how many green, whatever the search.
  const before7 = verifyAsks.length;
  const sum = await call('fallout.summary', {});
  const asked7 = verifyAsks.slice(before7).map(function (x) { return x[1]; });
  if (tree['fallout.summary'] && sum.red === 12 && sum.green === 340 && asked7.some(function (a) { return a.outcome === 'red' && a.current === 'yes' && !a.test && !a.suite; }) && asked7.some(function (a) { return a.outcome === 'green' && a.current === 'yes'; })) test.check('fallout.summary answers how many tests are red and green now: ' + sum.red + ' and ' + sum.green);
  else test.fail(OWED + 'fallout.summary answered ' + short(sum) + ', asking ' + short(asked7));
  // F6: the history of one tested thing, through the plugin's verb.
  const h = await call('fallout.history', { suite: 'zzFalloutA.js', heading: 'the relay answers its key' });
  const a5 = verifyAsks[verifyAsks.length - 1] || [];
  if (tree['fallout.history'] && a5[0] === 'search' && a5[1].over === 'tests' && a5[1].suite === 'zzFalloutA.js' && a5[1].heading === 'the relay answers its key' && a5[1].history === 'yes' && a5[1].slim === 'yes' && Array.isArray(h.items)) test.check('fallout.history asks deskVerify for every flip under that heading, slim');
  else test.fail(OWED + 'fallout.history answered ' + short(h) + ', asking ' + short(a5));
}

// ── ONE TEST, ONE KEY, WHICHEVER WAY IT TIPS (goal/G27.14) ───────────────
//   Andy, 2026-10-17: "a passing test MUST BE stored under the same fucking name as a failing test, how the fuck are we
//   supposed to keep track of a tests tipping either way?", and "that was the POINT when we conceived the fucking
//   verifier?!?!??!". So testSupport keys each assertion by its place, its sub-heading and its number under it, and
//   deskVerify answers what is red NOW (current: yes), the reds of the suite's latest run, with a total.
function miniSuite(name, second) {
  const f = path.join(scratch, name);
  fs.writeFileSync(f, ["'use strict';", 'const test = require(' + JSON.stringify(path.join(__dirname, 'testSupport.js')) + ');',
    "test.startTest('mini');", "test.subHeading('S. the part');", "test.check('alpha holds');", second,
    'test.reportSuccessFailureCount();', 'process.exit(0);'].join('\n'));
  return f;
}
async function keysHalf() {
  test.subHeading('one test keeps one key, red or green');
  const bodies = [];
  const sink = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () { bodies.push(b); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"written":true}'); });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const runOne = function (file) {
    return new Promise(function (resolve) {
      const k = spawn(process.execPath, [file, '--verify-port', String(sink.port)], { stdio: 'ignore' });
      k.on('exit', function () { resolve(); });
    });
  };
  await runOne(miniSuite('zzKeyRed.js', "test.fail('OWED: beta answered 41', 'and more');"));
  await sleep(300);
  const reds = bodies.splice(0).map(function (b) { try { return JSON.parse(b).ask.deskVerify.record; } catch (e) { return null; } }).filter(Boolean);
  await runOne(miniSuite('zzKeyRed.js', "test.check('beta holds');"));
  await sleep(300);
  const greens = bodies.splice(0).map(function (b) { try { return JSON.parse(b).ask.deskVerify.record; } catch (e) { return null; } }).filter(Boolean);
  sink.close();
  const r2 = reds[1] || {};
  const g2 = greens[1] || {};
  if (r2.title && r2.title === g2.title && r2.outcome === 'red' && g2.outcome === 'green' && (reds[0] || {}).title === (greens[0] || {}).title) test.check('the second assertion keeps its key, ' + JSON.stringify(r2.title) + ', red then green');
  else test.fail(OWED + 'the keys were red ' + short(reds.map(function (r) { return r.title; })) + ', green ' + short(greens.map(function (r) { return r.title; })));
  if (/beta answered 41/.test(String(r2.failure || '')) && /and more/.test(String(r2.failure || ''))) test.check('the red carries its words as its failure text, beside the key');
  else test.fail(OWED + 'the red record reads ' + short(r2));
}

async function currentHalf() {
  test.subHeading('deskVerify answers what is red now, and how many');
  const VERIFY = path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js');
  const dir = path.join(scratch, 'verify');
  fs.mkdirSync(path.join(dir, 'run', 'relay-state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  const deskNode = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) { req.resume(); req.on('end', function () { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"desk":{}}'); }); })
      .listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  fs.writeFileSync(path.join(dir, 'run', 'relay-state', 'environment.json'), JSON.stringify({ PORT: deskNode.port }));
  const vpipe = process.platform === 'win32' ? appClient.pipePathFor(dir, 'deskVerify', 'win32', 'process') : path.join(dir, 'door.sock');
  const vc = appClient.createAppClient({ rootDir: dir });
  vc.register('deskVerify', vpipe);
  const vk = spawn(process.execPath, [VERIFY, JSON.stringify({ db: path.join(dir, 'verify.db'), suiteMs: 400 }), '--pipe', vpipe, '--state', path.join(dir, 'state')], { cwd: path.join(dir, 'run'), stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const ask = function (verb, a) { const q = {}; q[verb] = a; return vc.ask({ deskVerify: q }, ANDY).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await vc.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
  try {
    if (!up) { test.fail('the world: deskVerify did not start'); return; }
    // An old run: a red under a wording no later run reports again (what the old keys left behind).
    await ask('record', { suite: 'zzCur.js', title: 'old wording 41', outcome: 'red', failure: 'old' });
    await sleep(900);
    // The latest run of the same suite: one green, one red.
    await ask('record', { suite: 'zzCur.js', title: 'S #1', outcome: 'green' });
    await ask('record', { suite: 'zzCur.js', title: 'S #2', outcome: 'red', failure: 'now' });
    const now = await ask('search', { over: 'tests', outcome: 'red', current: 'yes' });
    const all = await ask('search', { over: 'tests', outcome: 'red' });
    const titles = function (r) { return ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label).title; } catch (e) { return ''; } }); };
    if (JSON.stringify(titles(now)) === '["S #2"]') test.check('current: yes answers only the reds of the suite\'s latest run');
    else test.fail(OWED + 'current reds read ' + short(titles(now)) + ' (all reds ' + short(titles(all)) + ')');
    if (now.total === 1 && all.total === 2) test.check('each answer carries its total: 1 current, 2 in all');
    else test.fail(OWED + 'totals read ' + short([now.total, all.total]));
    // F6, A TEST'S HISTORY (Andy, 2026-10-17: "so we'll add a dialog for test-history, that shows us the flips."):
    // every flip of every check under one sub-heading, not only the newest.
    await ask('record', { suite: 'zzHist.js', title: 'H #1', outcome: 'red', failure: 'first' });
    await ask('record', { suite: 'zzHist.js', title: 'H #1', outcome: 'green' });
    await ask('record', { suite: 'zzHist.js', title: 'H #2', outcome: 'red', failure: 'second' });
    await ask('record', { suite: 'zzHist.js', title: 'HX #1', outcome: 'red', failure: 'another heading' });
    const hist = await ask('search', { over: 'tests', suite: 'zzHist.js', heading: 'H', history: 'yes' });
    const ht = ((hist && hist.items) || []).map(function (i) { try { const x = JSON.parse(i.label); return x.title + ':' + x.outcome; } catch (e) { return ''; } });
    if (JSON.stringify(ht.slice().sort()) === JSON.stringify(['H #1:green', 'H #1:red', 'H #2:red'])) test.check('history: yes answers every flip under the heading H, and nothing of HX');
    else test.fail(OWED + 'the history of H reads ' + short(ht));
    // SLIM AND FOLDED (Andy: "don't return shit in the search that i don't want to see!").
    const slimHist = await ask('search', { over: 'tests', suite: 'zzHist.js', heading: 'H', history: 'yes', slim: 'yes' });
    const sl = ((slimHist && slimHist.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
    if (sl.length === 3 && sl.every(function (x) { return x.title && x.outcome && x.at && x.commit === undefined && x.failure === undefined; })) test.check('slim: yes leaves commit and failure text out of each row');
    else test.fail(OWED + 'slim rows read ' + short(sl));
    const folded = await ask('search', { over: 'tests', suite: 'zzHist.js', fold: 'yes', slim: 'yes' });
    const fl = ((folded && folded.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
    const fh = fl.filter(function (x) { return x.what === 'H'; })[0];
    if (fl.length === 2 && fh && fh.red === true && fh.suite === 'zzHist.js' && fh.at && fh.title === undefined && fh.failure === undefined && folded.total === 2) test.check('fold: yes answers one line per test file and heading, red while any check is, its total the lines');
    else test.fail(OWED + 'folded lines read ' + short(fl) + ', total ' + short(folded.total));
  } finally {
    await new Promise(function (r) { vk.once('exit', r); vk.kill(); setTimeout(r, 3000); });
    deskNode.close();
  }
}

// ── THE PRIVATE UI ──────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    getAttribute: function () { return null; }, setAttribute: function () {}, appendChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
async function paneHalf() {
  test.subHeading('F2, F4. the Fallout pane: Reds and Items, a search and its table');
  if (!fs.existsSync(PLUGIN_UI)) { test.fail(OWED + 'no shell/desk/plugins/fallout/fallout.js'); return; }
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); }, body: fakeElement('body') };
  const win = { spiritFieldRules: require('../run/js/fieldRules.js'), spiritDeskPlugins: {} };
  // THE SAME SEARCH CODE IN THE PAGE (Andy, 2026-10-17: "why down't the UI run the exact same search code in the shell?
  // ... any search can then easiliy accumulate a cache that can be expanded with every search? it's a pattern...."):
  // the probability modules load into a page's window as they load into node; a fake page cannot load a script, so
  // the world puts them there, and counts the matches the pane asks of them.
  const PROB = ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].map(function (f) { return path.join(RUN, 'js', f); });
  PROB.forEach(function (f) { if (fs.existsSync(f)) { try { new Function('window', 'module', fs.readFileSync(f, 'utf8'))(win, undefined); } catch (e) { /* node-only: the red below says so */ } } });
  let probCalls = 0;
  if (win.spiritProbability && typeof win.spiritProbability.probabilityStringMatch === 'function') {
    const real = win.spiritProbability.probabilityStringMatch;
    win.spiritProbability.probabilityStringMatch = function (a, b) { probCalls += 1; return real(a, b); };
  }
  // THE PANE'S BUCKET UNBOUNDED (Andy, 2026-10-17: "in probabilityBucket.js use serialize: function (map, maxBytes = 0)
  // where 0 means unbounded."): the buckets the pane makes, and the ceiling it serialized them with.
  const paneBuckets = [];
  if (win.spiritProbability && typeof win.spiritProbability.createProbabilityBucket === 'function') {
    const realBucket = win.spiritProbability.createProbabilityBucket;
    win.spiritProbability.createProbabilityBucket = function (capacity) {
      const b = realBucket(capacity);
      const seen = { capacity: capacity, serialized: false, ceiling: null };
      paneBuckets.push(seen);
      const realSerialize = b.serialize;
      b.serialize = function (map, maxBytes) { seen.serialized = true; seen.ceiling = maxBytes === undefined ? 0 : maxBytes; return realSerialize.apply(b, arguments); };
      return b;
    };
  }
  new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
  const ui = win.spiritDeskPlugins.fallout;
  if (!ui || typeof ui.open !== 'function') { test.fail(OWED + 'the UI registers no window.spiritDeskPlugins.fallout.open'); return; }
  const asked = [];
  let chatAt = null;
  const dialogs = [];
  const box = fakeElement('pane');
  ui.open(box, {
    goal: GOAL,
    // Three checks under one sub-heading (the RED among them, the newest) and one under another: two tested things.
    ask: function (verb, a) {
      asked.push([verb, a]);
      if (verb === 'fallout.summary') return Promise.resolve({ red: 12, green: 340 });
      if (verb !== 'fallout.reds') return Promise.resolve({});
      // A search whose answer brings nothing new: what shows comes from the cache.
      if (a && a.text === 'door') return Promise.resolve({ items: [], more: false, total: 0 });
      const more = [
        { suite: 'zzFalloutA.js', title: 'the relay answers its key #1', outcome: 'green', commit: 'abc1234', at: '2026-10-17T08:00:00.000Z', failure: '' },
        { suite: 'zzFalloutA.js', title: 'the relay answers its key #2', outcome: 'red', commit: 'abc1234', at: '2026-10-17T08:30:00.000Z', failure: 'older' },
        { suite: 'zzFalloutB.js', title: 'a door stays shut #1', outcome: 'green', commit: 'abc1234', at: '2026-10-17T07:00:00.000Z', failure: '' },
      ];
      return Promise.resolve({ items: [RED].concat(more).map(function (x, i) { return { key: String(i), label: JSON.stringify(x) }; }), more: false, total: 3 });
    },
    onPublished: function () { return function () {}; }, chat: function (el) { chatAt = el; }, callDialog: function (app, params) { dialogs.push([app, params]); return new Promise(function () {}); },
  });
  await sleep(20);
  const all = function () { return box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  // THE SIZE OF THE PROBLEM, shown on opening, whatever the search: how many red, of how many tests.
  const sumText = doc.getElementById('fallout-summary').textContent;
  if (asked.some(function (x) { return x[0] === 'fallout.summary'; }) && /12/.test(sumText) && /352/.test(sumText)) test.check('on opening it says how many are red now, of all: ' + sumText);
  else test.fail(OWED + 'the summary reads ' + short(sumText) + ', asked ' + short(asked.map(function (x) { return x[0]; })));
  if (/data-fallout-tab="reds"[^>]*>Reds</.test(all()) && /data-fallout-tab="items"[^>]*>Items</.test(all())) test.check('two inner tabs, Reds and Items');
  else test.fail(OWED + 'the pane shows ' + short(all()));
  if (/id="fallout-text"/.test(all()) && /id="fallout-search"/.test(all())) test.check('Reds holds a search box and its button');
  else test.fail(OWED + 'no #fallout-text and #fallout-search in ' + short(all()));
  doc.getElementById('fallout-text').value = 'relay key';
  box.fire('click', { target: { id: 'fallout-search', getAttribute: function () { return null; } } });
  await sleep(20);
  const sent = asked.filter(function (x) { return x[0] === 'fallout.reds'; })[0];
  if (sent && sent[1].text === 'relay key') test.check('its search sends fallout.reds with the words typed');
  else test.fail(OWED + 'the search asked ' + short(asked));
  const table = doc.getElementById('fallout-reds').innerHTML;
  // ONE NICE LINE PER TEST (Andy, 2026-10-17: "one nice line per failure / test-file-name | failure-description |
  // success or fail | since"): the description is the sentence of what is tested, its sub-heading; the raw failure a
  // suite printed is no row text (at most a hover title).
  const shown = table.replace(/\btitle="[^"]*"/g, '');
  const atSuite = shown.indexOf('zzFalloutA.js');
  const atWhat = shown.indexOf('the relay answers its key');
  const atStatus = shown.indexOf('❌', shown.indexOf('<tbody>'));
  const atSince = shown.indexOf('2026-10-17 09:00:00');
  if (atSuite !== -1 && atWhat > atSuite && atStatus > atWhat && atSince > atStatus) test.check('each row reads test file, description, status, since, in that order');
  else test.fail(OWED + 'the row order: file ' + atSuite + ', description ' + atWhat + ', status ' + atStatus + ', since ' + atSince + ' in ' + short(shown));
  // NOT EVEN ON HOVER (Andy, 2026-10-17: "i understand that you need to store commit-level and failure detail, it just
  // doesn't help me anything when looking at a list. I know you can read those details, so it doesn't need to be
  // on-screen."), and the ❌/✅ stay ("Keep the fucking fail/success icons").
  if (!/boom: no answer/.test(table) && !/older/.test(table) && !/abc1234/.test(table)) test.check('no failure text and no commit anywhere in the lines, not even on hover');
  else test.fail(OWED + 'the lines still carry detail: ' + short(table));
  if (!/boom: no answer/.test(shown) && !/#\d/.test(shown)) test.check('no raw failure text and no key number in the row');
  else test.fail(OWED + 'the row still shows ' + short(shown));
  // ONLY THE LATEST, ONE LINE PER TESTED THING (Andy, 2026-10-17: "i only want to see the latest, if you want to show
  // the history of one test, use a dialog."): one line per test file and sub-heading, ❌ while any check under it is
  // red, its newest time.
  const lines = (shown.match(/<tr[\s>]/g) || []).length - 1;
  const relayLine = (shown.match(/<tr[^>]*>(?:(?!<\/tr>).)*the relay answers its key(?:(?!<\/tr>).)*<\/tr>/) || [''])[0];
  if (lines === 2) test.check('one line per tested thing: two lines for two sub-headings');
  else test.fail(OWED + lines + ' lines in ' + short(shown));
  if (/❌/.test(relayLine) && /2026-10-17 09:00:00/.test(relayLine)) test.check('a line is ❌ while any check under it is red, and shows its newest time');
  else test.fail(OWED + 'the relay line reads ' + short(relayLine));
  // F6: a line opens the history dialog of its tested thing.
  box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-suite' ? 'zzFalloutA.js' : n === 'data-heading' ? 'the relay answers its key' : null; }, closest: function () { return null; } } });
  await sleep(20);
  if (dialogs.some(function (d) { return d[0] === 'shell/falloutHistory' && d[1] && d[1].suite === 'zzFalloutA.js' && d[1].heading === 'the relay answers its key'; })) test.check('a line opens shell/falloutHistory with its suite and heading');
  else test.fail(OWED + 'a click on a line opened ' + short(dialogs));
  if (/data-suite="zzFalloutA\.js"/.test(table) && /data-heading="the relay answers its key"/.test(table)) test.check('each line carries its suite and heading to open with');
  else test.fail(OWED + 'the lines carry no data-suite and data-heading: ' + short(table));
  // The ✅/❌ filter and the count (Andy, 2026-10-17: "how many red?" and "do i get a filter for ✅ or ❌?").
  if (/<select[^>]*id="fallout-outcome"/.test(all()) && /value="red"/.test(all()) && /value="green"/.test(all()) && /value=""/.test(all())) test.check('a ✅/❌ filter: red, green or both');
  else test.fail(OWED + 'no #fallout-outcome select with red, green and both in ' + short(all()));
  doc.getElementById('fallout-outcome').value = 'green';
  box.fire('click', { target: { id: 'fallout-search', getAttribute: function () { return null; } } });
  await sleep(20);
  const sentGreen = asked.filter(function (x) { return x[0] === 'fallout.reds'; }).pop();
  if (sentGreen && sentGreen[1].outcome === 'green') test.check('the filter goes with the search');
  else test.fail(OWED + 'the search with the filter asked ' + short(sentGreen));
  // THE SEARCH'S COUNT SAYS IT IS THE SEARCH'S (Andy, 2026-10-17: "what I want to know is TOTAL OF ALL FAILURES.
  // period, THAT's size of the problem, NOT searching for "zyx" and getting a size-of-problem from that."): the size of
  // the problem is the Now line; the count under the search says it counts what matches the search.
  const countText = doc.getElementById('fallout-count').textContent;
  if (/match/i.test(countText) && !/\bnow\b/i.test(countText)) test.check('the search count says it counts what matches the search: ' + countText);
  else test.fail(OWED + 'the search count reads ' + short(countText));
  if (/\b3\b/.test(doc.getElementById('fallout-count').textContent)) test.check('the tab says how many matched: ' + doc.getElementById('fallout-count').textContent);
  else test.fail(OWED + 'the count reads ' + short(doc.getElementById('fallout-count').textContent));
  // EVERY SEARCH RESULT CACHED, AND THE TERM MATCHED AMONG ALL OF IT (Andy, 2026-10-17: "and the UI still doesn't cache
  // every search result, and then display what matches the search term among all cached rows...."): a later search
  // whose answer brings nothing still shows the cached line its words match, and none other.
  doc.getElementById('fallout-outcome').value = '';
  doc.getElementById('fallout-text').value = 'door';
  box.fire('click', { target: { id: 'fallout-search', getAttribute: function () { return null; } } });
  await sleep(20);
  const cachedTable = doc.getElementById('fallout-reds').innerHTML;
  // SHELL-SIDE FOR EVERY ELEMENT (Andy, 2026-10-17: "they all can count on the probability stuff being available,
  // shell-side...."): the shell's page loads both modules itself.
  const indexHtml = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  // All three (Andy: "what about probabilityObject or whatever it's called?"), the object match after the string match
  // it needs.
  const atS = indexHtml.indexOf('<script src="/js/probabilityStringMatch.js"></script>');
  const atO = indexHtml.indexOf('<script src="/js/probabilityStringObjectMatch.js"></script>');
  const atB = indexHtml.indexOf('<script src="/js/probabilityBucket.js"></script>');
  if (atS !== -1 && atO > atS && atB !== -1) test.check('index.html loads the three probability modules, the object match after the string match, so every element can count on them');
  else test.fail(OWED + 'index.html loads string ' + atS + ', object ' + atO + ', bucket ' + atB);
  // THE UNBOUNDED MODE ITSELF: a bucket made with Infinity seats every row, and serialize() with maxBytes left out (0)
  // gives them all back, best first, with no byte ceiling (5000 rows of 200 bytes, far past any answer over the wire).
  const B = require('../run/js/probabilityBucket.js').createProbabilityBucket(Infinity);
  for (let i = 0; i < 5000; i++) B.seatFor((i % 100) / 100, { n: i, pad: 'x'.repeat(200) });
  const everyRow = B.serialize().items;
  if (everyRow.length === 5000 && everyRow[0].n % 100 === 99 && everyRow[4999].n % 100 === 0) test.check('a bucket made with Infinity seats all 5000 rows, and serialize() with no ceiling returns every one, best first');
  else test.fail(OWED + 'an Infinity bucket serialized ' + everyRow.length + ' rows');
  // SORT BY A COMPARE FUNCTION (Andy, 2026-10-17: "sort("search string") this way the bucket itself can be the cache
  // needed in shell apps.", then "SORT(probability = compareFunction())"): every held object gets compare(object) as its
  // new probability and the table re-orders, highest first; one scored outside 0 to 1 stays held but is not serialized
  // until a later sort scores it again. The bucket still knows nothing of strings: the caller's function does.
  const S = require('../run/js/probabilityBucket.js').createProbabilityBucket(Infinity);
  ['alpha', 'beta', 'gamma', 'delta'].forEach(function (w) { S.seatFor(0, { w: w }); });
  if (typeof S.sort === 'function') {
    S.sort(function (o) { return o.w.indexOf('a') === 0 ? 0.9 : o.w.indexOf('e') !== -1 ? 0.5 : -1; });
    const sorted = S.serialize().items.map(function (o) { return o.w; });
    S.sort(function () { return 0; });
    const back = S.serialize().items.map(function (o) { return o.w; });
    if (JSON.stringify(sorted) === JSON.stringify(['alpha', 'beta', 'delta']) && back.length === 4 && back.indexOf('gamma') !== -1) test.check('sort(compare) re-orders by compare(object), leaves an unscored one out of serialize, and keeps it held for the next sort');
    else test.fail(OWED + 'after sort the bucket serialized ' + short(sorted) + ', then ' + short(back));
  } else test.fail(OWED + 'the bucket has no sort(compare)');
  const bucketSrc = fs.readFileSync(path.join(RUN, 'js', 'probabilityBucket.js'), 'utf8');
  if (/serialize:\s*function\s*\(map,\s*maxBytes\s*=\s*0\)/.test(bucketSrc) && typeof B.all === 'undefined') test.check('serialize reads (map, maxBytes = 0), 0 meaning unbounded, and the bucket has no all()');
  else test.fail(OWED + 'serialize is not (map, maxBytes = 0), or all() is still there: ' + typeof B.all);
  if (win.spiritProbability && typeof win.spiritProbability.probabilityStringMatch === 'function' && typeof win.spiritProbability.probabilityStringObjectMatch === 'function' && typeof win.spiritProbability.createProbabilityBucket === 'function') test.check('the three probability modules load into a page\'s window');
  else test.fail(OWED + 'js/probabilityStringMatch.js and js/probabilityBucket.js give a page nothing: ' + short(win.spiritProbability && Object.keys(win.spiritProbability)));
  if (probCalls > 0) test.check('the pane ranks its cache with the same probabilityStringMatch the servers search with (' + probCalls + ' calls)');
  else test.fail(OWED + 'the pane matched its cache without probabilityStringMatch');
  if (paneBuckets.length > 0 && paneBuckets.every(function (b) { return b.capacity === Infinity && b.serialized && b.ceiling === 0; })) test.check('the pane ranks its cache in an unbounded bucket (Infinity), serialized with no ceiling');
  else test.fail(OWED + 'the pane made buckets ' + short(paneBuckets));
  if (/a door stays shut/.test(cachedTable) && !/the relay answers its key/.test(cachedTable)) test.check('a search shows what matches its term among every line any search brought');
  else test.fail(OWED + 'after searching door the table reads ' + short(cachedTable));
  // AS TYPED (Andy, 2026-10-17: "so why doesn't the fallout list update with each character typed or erased in the
  // search box?"): every character typed or erased redraws the list from the cache at once, no click, no wait.
  const typeIn = function (v) { doc.getElementById('fallout-text').value = v; box.fire('input', { target: { id: 'fallout-text', getAttribute: function () { return null; } } }); };
  typeIn('relay');
  const typedRelay = doc.getElementById('fallout-reds').innerHTML;
  typeIn('');
  const typedEmpty = doc.getElementById('fallout-reds').innerHTML;
  if (/the relay answers its key/.test(typedRelay) && !/a door stays shut/.test(typedRelay)) test.check('typing "relay" redraws the list at once to its cached matches');
  else test.fail(OWED + 'after typing relay the list reads ' + short(typedRelay));
  if (/the relay answers its key/.test(typedEmpty) && /a door stays shut/.test(typedEmpty)) test.check('erasing it redraws the list at once to every cached line');
  else test.fail(OWED + 'after erasing the list reads ' + short(typedEmpty));
  // ONE IN FLIGHT (Andy, 2026-10-17: "and make sure that only one typing update is in flight at the time...."): a
  // search asked while one is out waits, and runs once, with the latest words, when the first returns.
  let inFlight = 0;
  let maxInFlight = 0;
  const slowAsked = [];
  const box2 = fakeElement('pane2');
  ui.open(box2, {
    goal: GOAL,
    // MAX ONE OVER THE WIRE (Andy: "make SURE there's MAX one search in flight over the wire.... IMPORTANT."): every
    // request the pane makes is counted, the summary's too, each answering slowly.
    ask: function (verb, a) {
      if (verb === 'fallout.reds') slowAsked.push(a.text);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise(function (resolve) {
        setTimeout(function () { inFlight -= 1; resolve(verb === 'fallout.summary' ? { red: 0, green: 0 } : { items: [], more: false, total: 0 }); }, 60);
      });
    },
    onPublished: function () { return function () {}; }, chat: function () {}, callDialog: function () { return new Promise(function () {}); },
  });
  const enter = function (v) { doc.getElementById('fallout-text').value = v; box2.fire('keydown', { key: 'Enter', repeat: false, target: { id: 'fallout-text', getAttribute: function () { return null; } } }); };
  enter('a');
  enter('ab');
  enter('abc');
  await sleep(600);
  if (maxInFlight === 1) test.check('at most one request of the pane is on the wire at a time, its summary count included');
  else test.fail(OWED + maxInFlight + ' requests of the pane were in flight at once');
  // Those asked meanwhile fold into one, the latest words: "ab" is never asked, "abc" once and last.
  if (slowAsked.length >= 1 && slowAsked.length <= 2 && slowAsked[slowAsked.length - 1] === 'abc' && slowAsked.indexOf('ab') === -1 && slowAsked.filter(function (t) { return t === 'abc'; }).length === 1) test.check('those asked meanwhile run once, with the latest words: ' + short(slowAsked));
  else test.fail(OWED + 'the server was asked ' + short(slowAsked));
  // THE TABLE GROWS WITH EVERY SEARCH (Andy, 2026-10-17: "1. i search with empty string, i get let's say 20 rows. 2. a
  // search for 'y' or for releay, and if finds a row not previously displayed. 3. when clearing the search box (gimme
  // all) then the fucking table should be larger than after step 1."). The server answers the empty box with 20 lines,
  // "y" with one line it never gave before; clearing the box shows more lines than step 1 did, that one among them.
  const box3 = fakeElement('pane3');
  const twenty = []; for (let i = 0; i < 20; i++) twenty.push({ suite: 'zzGrow' + i + '.js', what: 'grows ' + i, red: true, at: '2026-10-17T10:00:' + String(10 + i) + '.000Z' });
  const yRow = { suite: 'zzGrowY.js', what: 'only y finds this', red: true, at: '2026-10-17T09:00:00.000Z' };
  ui.open(box3, {
    goal: GOAL,
    ask: function (verb, a) {
      if (verb === 'fallout.summary') return Promise.resolve({ red: 21, green: 0 });
      const rows = a && a.text === 'y' ? [yRow] : twenty;
      return Promise.resolve({ items: rows.map(function (x, i) { return { key: String(i), label: JSON.stringify(x) }; }), more: a && a.text === '', total: a && a.text === '' ? 21 : rows.length });
    },
    onPublished: function () { return function () {}; }, chat: function () {}, callDialog: function () { return new Promise(function () {}); },
  });
  const typeAt3 = function (v) { doc.getElementById('fallout-text').value = v; box3.fire('input', { target: { id: 'fallout-text', getAttribute: function () { return null; } } }); };
  const rowsShown = function () { return ((doc.getElementById('fallout-reds').innerHTML.match(/<tr[\s>]/g) || []).length - 1); };
  doc.getElementById('fallout-outcome').value = '';
  typeAt3('');
  await sleep(600);
  const step1 = rowsShown();
  typeAt3('y');
  await sleep(600);
  typeAt3('');
  await sleep(600);
  const step3 = rowsShown();
  const step3Table = doc.getElementById('fallout-reds').innerHTML;
  if (step3 > step1 && /only y finds this/.test(step3Table)) test.check('clearing the box after a search that found a new line shows more lines than before (' + step1 + ' then ' + step3 + ')');
  else test.fail(OWED + 'step 1 showed ' + step1 + ' lines, step 3 ' + step3 + ', the y line ' + (/only y finds this/.test(step3Table) ? 'among them' : 'missing'));
  box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-fallout-tab' ? 'items' : null; } } });
  await sleep(10);
  const items = doc.getElementById('fallout-items');
  if (items.hidden === false && /not yet|nothing yet|later/i.test(items.innerHTML) && doc.getElementById('fallout-pane-reds').hidden === true) test.check('Items shows, empty for now, saying so; Reds hides');
  else test.fail(OWED + 'after Items: items hidden ' + items.hidden + ', says ' + short(items.innerHTML) + ', reds hidden ' + doc.getElementById('fallout-pane-reds').hidden);
  // THE GOAL CHAT AT THE BOTTOM, NO FAILURE COLUMN (Andy, 2026-10-17: "drop the "Failure" column, it means nothing to
  // me, and add the goal chat at the bottom.").
  const markup = box.innerHTML;
  if (chatAt && chatAt.id === 'fallout-chat' && markup.indexOf('id="fallout-chat"') > markup.indexOf('id="fallout-items"') && markup.indexOf('id="fallout-chat"') > markup.indexOf('id="fallout-pane-reds"')) test.check('the goal chat is mounted at the bottom, below both inner tabs');
  else test.fail(OWED + 'the chat mounted in ' + short(chatAt && chatAt.id) + '; markup ' + short(markup.slice(-200)));
  if (!/<th>Failure<\/th>/.test(all())) test.check('no Failure column');
  else test.fail(OWED + 'a Failure column is still drawn');
}

// F6: THE HISTORY DIALOG, a hidden shell dialog that reads the flips through the plugin's verb.
async function historyHalf() {
  test.subHeading('F6. the history dialog of one tested thing');
  const DIR = path.join(RUN, 'shell', 'falloutHistory');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'falloutHistory.json'), 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.type === 'dialog' && manifest.hidden === true) test.check('shell/falloutHistory is a hidden dialog app');
  else { test.fail(OWED + 'no shell/falloutHistory manifest of type dialog, hidden: ' + short(manifest)); return; }
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let app = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(path.join(DIR, 'falloutHistory.js'), 'utf8'))({ shell: { activateApp: function (x) { app = x; } }, core: require('../run/js/kernel.js').core }, doc, { addEventListener: function () {} });
  const calls = [];
  const FLIPS = [
    { suite: 'zzFalloutA.js', title: 'the relay answers its key #2', outcome: 'red', commit: 'bbb2222', at: '2026-10-17T09:00:00.000Z', failure: 'boom again' },
    { suite: 'zzFalloutA.js', title: 'the relay answers its key #2', outcome: 'green', commit: 'aaa1111', at: '2026-10-16T09:00:00.000Z', failure: '' },
  ];
  const box = fakeElement('dlg');
  app.mount(box, {
    escapeHtml: require('../run/js/kernel.js').core.util.escapeHtml,
    verb: function (name, body) {
      const q = body && body.ask && body.ask.desk;
      const v = q && Object.keys(q)[0];
      calls.push([v, q && q[v]]);
      return Promise.resolve({ status: 200, body: v === 'fallout.history' ? { items: FLIPS.map(function (x, i) { return { key: String(i), label: JSON.stringify(x) }; }), more: false, total: 2 } : {} });
    },
    onPublished: function () { return function () {}; }, closeDialog: function () {}, setScreenTitle: function () {}, setDialogResult: function () {},
  });
  await app.open({ suite: 'zzFalloutA.js', heading: 'the relay answers its key' });
  await sleep(20);
  const page = box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (calls.some(function (c) { return c[0] === 'fallout.history' && c[1] && c[1].suite === 'zzFalloutA.js' && c[1].heading === 'the relay answers its key'; })) test.check('it reads the flips with fallout.history');
  else test.fail(OWED + 'the dialog asked ' + short(calls));
  if (/#2/.test(page) && /❌/.test(page) && /✅/.test(page) && page.indexOf('2026-10-17 09:00:00') !== -1 && page.indexOf('2026-10-17 09:00:00') < page.indexOf('2026-10-16 09:00:00')) test.check('it shows each flip: the check, ❌ or ✅, and when, newest first');
  else test.fail(OWED + 'the dialog shows ' + short(page));
  if (!/bbb2222|aaa1111/.test(page) && !/boom again/.test(page)) test.check('no commit and no failure text on screen, not even on hover');
  else test.fail(OWED + 'the dialog still carries detail: ' + short(page));
}

(async function () { await serverHalf(); await paneHalf(); await keysHalf(); await currentHalf(); await historyHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  try { node && node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
