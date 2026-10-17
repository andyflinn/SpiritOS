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
// goal/G29.5: Fallout talks to deskVerify only, its Reds list a shellCreateListSearch (goal/G29.4). Its box: "server
// deskVerify, verb search, its stream deskVerify's"; "The container lends its one slot to the app ... The summary line
// ... is two deskVerify searches"; "DELETED ... The desk-side wrapper verbs fallout.reds, fallout.summary and
// fallout.history"; deskVerify "keys each test row by the test's identity, its file and its key".
const OWED29 = 'OWED by goal/G29.5: ';
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

  // goal/G29.5: FALLOUT TALKS TO DESKVERIFY ONLY. The plugin keeps its goal and tab; its wrapper verbs are deleted.
  test.subHeading('G29.5. the plugin adds no verb to the desk');
  const wrappers = ['fallout.reds', 'fallout.summary', 'fallout.history'].filter(function (v) { return tree[v]; });
  if (!wrappers.length) test.check('fallout.reds, fallout.summary and fallout.history are gone from the desk');
  else test.fail(OWED29 + 'the desk still declares ' + short(wrappers));
  const r = await call('fallout.reds', { text: 'x' });
  if (r && r.ok === false) test.check('asking fallout.reds is refused: no such verb');
  else test.fail(OWED29 + 'fallout.reds still answers ' + short(r));
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
    // goal/G29.5: A TEST ROW KEYED BY ITS IDENTITY, its file and its key, so the list's cache replaces it, never doubles it.
    const keys = ((now && now.items) || []).map(function (i) { return i.key; });
    if (JSON.stringify(keys) === JSON.stringify(['zzCur.js\nS #2'])) test.check('each test row is keyed by its file and its key, not its record');
    else test.fail(OWED29 + 'test rows are keyed ' + short(keys));
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
    // ONE TEST'S HISTORY: a full key as the heading answers the flips of that one test.
    const one = await ask('search', { over: 'tests', suite: 'zzHist.js', heading: 'H #1', history: 'yes', slim: 'yes' });
    const ot = ((one && one.items) || []).map(function (i) { try { const x = JSON.parse(i.label); return x.title + ':' + x.outcome; } catch (e) { return ''; } });
    if (JSON.stringify(ot.slice().sort()) === JSON.stringify(['H #1:green', 'H #1:red'])) test.check('a full key as heading answers the flips of that one test');
    else test.fail(OWED + 'the history of H #1 reads ' + short(ot));
    // NO COLLATING (Andy, 2026-10-17: "STOP COLLATING SHIT I DIDN?T ASK FOR!"): fold is gone from deskVerify's search.
    let searchKeys = [];
    try { searchKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(RUN, 'process', 'js', 'deskVerify', 'search.json'), 'utf8')).request); } catch (e) { searchKeys = ['unreadable']; }
    const vsrc = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js'), 'utf8');
    if (searchKeys.indexOf('fold') === -1 && !/'fold'/.test(vsrc)) test.check('deskVerify\'s search takes no fold: nothing is collated');
    else test.fail(OWED + 'deskVerify still folds: search.json keys ' + short(searchKeys));
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
  test.subHeading('G29.5. the Fallout pane on shellCreateListSearch, talking to deskVerify only');
  if (!fs.existsSync(PLUGIN_UI)) { test.fail(OWED29 + 'no shell/desk/plugins/fallout/fallout.js'); return; }
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: function () { return fakeElement(''); }, body: fakeElement('body') };
  const win = { spiritFieldRules: require('../run/js/fieldRules.js'), spiritDeskPlugins: {} };
  // The shell's modules as index.html loads them, and the shared container as the pane loads it on demand; a fake
  // page cannot load a script, so the world puts it there and watches what the pane makes of it.
  ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].forEach(function (f) {
    new Function('window', 'module', fs.readFileSync(path.join(RUN, 'js', f), 'utf8'))(win, undefined);
  });
  const LIST = path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js');
  if (fs.existsSync(LIST)) new Function('document', 'window', fs.readFileSync(LIST, 'utf8'))(doc, win);
  const made = [];
  if (win.spiritElements && typeof win.spiritElements.shellCreateListSearch === 'function') {
    const real = win.spiritElements.shellCreateListSearch;
    win.spiritElements.shellCreateListSearch = function (el, cfg) { const l = real(el, cfg); made.push({ el: el, cfg: cfg, list: l }); return l; };
  }
  new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
  const ui = win.spiritDeskPlugins.fallout;
  if (!ui || typeof ui.open !== 'function') { test.fail(OWED29 + 'the UI registers no window.spiritDeskPlugins.fallout.open'); return; }
  const GREEN = { suite: 'zzFalloutB.js', title: 'a door stays shut #1', outcome: 'green', commit: 'abc1234', at: '2026-10-17T07:00:00.000Z', failure: '' };
  const desks = [];
  const asked = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const streams = [];
  const dialogs = [];
  let chatAt = null;
  const box = fakeElement('pane');
  ui.open(box, {
    goal: GOAL,
    ask: function (verb, a) { desks.push([verb, a]); return Promise.resolve({}); },
    // Desk's own call, handed to its plugins since goal/G29.5: verb('jobs.api', {ask: {<server>: {<verb>: args}}}).
    verb: function (name, body) {
      const ask = (body && body.ask) || {};
      const server = Object.keys(ask)[0];
      const v = server && Object.keys(ask[server])[0];
      const a = (v && ask[server][v]) || {};
      asked.push({ name: name, server: server, verb: v, args: a });
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise(function (resolve) {
        setTimeout(function () {
          inFlight -= 1;
          let out = { ok: false, code: 'no-such-verb' };
          if (server === 'deskVerify' && v === 'search') {
            if (a.slim !== 'yes') out = { items: [], more: false, total: a.outcome === 'green' ? 340 : 12 };
            else {
              const rows = [RED, GREEN].filter(function (x) { return !a.outcome || x.outcome === a.outcome; });
              out = { items: rows.map(function (x) { return { key: x.suite + '\n' + x.title, label: JSON.stringify({ suite: x.suite, title: x.title, outcome: x.outcome, at: x.at }) }; }), more: false, total: rows.length };
            }
          }
          resolve({ status: 200, body: out });
        }, 15);
      });
    },
    onPublished: function (fn, server) { streams.push(server); return function () {}; },
    chat: function (el) { chatAt = el; },
    callDialog: function (app, params) { dialogs.push([app, params]); return new Promise(function () {}); },
  });
  await sleep(200);
  const cfg = made[0] && made[0].cfg;
  if (made.length === 1 && cfg && cfg.server === 'deskVerify' && cfg.verb === 'search') test.check('the Reds list is one shellCreateListSearch over deskVerify\'s search');
  else { test.fail(OWED29 + 'the pane made ' + made.length + ' list(s): ' + short(made.map(function (m) { return { server: m.cfg.server, verb: m.cfg.verb }; }))); return; }
  if (!desks.length && asked.length && asked.every(function (x) { return x.name === 'jobs.api' && x.server === 'deskVerify'; })) test.check('Fallout talks to deskVerify only: ' + asked.length + ' requests, none to the desk');
  else test.fail(OWED29 + 'it asked the desk ' + short(desks) + ' and ' + short(asked.map(function (x) { return x.server + ' ' + x.verb; })));
  if (maxInFlight === 1 && asked.length >= 3) test.check('one request on the wire at a time, the summary\'s two included');
  else test.fail(OWED29 + maxInFlight + ' requests were in flight at once, of ' + asked.length);
  const sumText = doc.getElementById('fallout-summary').textContent;
  if (/12/.test(sumText) && /352/.test(sumText) && asked.some(function (x) { return x.args.outcome === 'red' && x.args.current === 'yes' && x.args.slim !== 'yes'; }) && asked.some(function (x) { return x.args.outcome === 'green' && x.args.current === 'yes' && x.args.slim !== 'yes'; })) test.check('the summary is two deskVerify searches, red and green totals: ' + sumText);
  else test.fail(OWED29 + 'the summary reads ' + short(sumText) + ' after ' + short(asked.map(function (x) { return x.args; })));
  if (streams.indexOf('deskVerify') !== -1 && streams.indexOf('desk') === -1) test.check('it hears deskVerify\'s stream, not the desk\'s');
  else test.fail(OWED29 + 'it hears ' + short(streams));

  test.subHeading('G29.5. the configuration');
  const a1 = cfg.args('relay key', { outcome: 'red' });
  const a2 = cfg.args('zzFalloutA.js', { outcome: 'red' });
  const a3 = cfg.args('', { outcome: '' });
  if (a1 && a1.over === 'tests' && a1.current === 'yes' && a1.slim === 'yes' && a1.outcome === 'red' && a1.test === 'relay key' && a1.fold === undefined) test.check('words ask {over: tests, current: yes, slim: yes, outcome, test: the words}');
  else test.fail(OWED29 + 'args for relay key read ' + short(a1));
  if (a2 && a2.suite === 'zzFalloutA.js' && !a2.test && a3 && a3.outcome === undefined) test.check('a suite\'s file name asks by suite; both outcomes ask none');
  else test.fail(OWED29 + 'args read ' + short([a2, a3]));
  const f = (cfg.filters || [])[0];
  const values = f ? f.choices.map(function (c) { return c.value; }) : [];
  if (f && f.name === 'outcome' && JSON.stringify(values) === '["red","green",""]' && f.test(RED, 'red') === 1 && f.test(GREEN, 'red') === 0 && f.test(GREEN, '') === 1) test.check('one filter, outcome: ❌ fail, ✅ success, both; its test passes a row whose outcome matches');
  else test.fail(OWED29 + 'the filter reads ' + short(f));
  const painted = cfg.paint({ suite: RED.suite, title: RED.title, outcome: 'red', at: RED.at });
  const order = [painted.indexOf('zzFalloutA.js'), painted.indexOf('the relay answers its key #3'), painted.indexOf('❌ fail'), painted.indexOf('2026-10-17 09:00:00')];
  if (order.every(function (i, n) { return i !== -1 && (n === 0 || i > order[n - 1]); }) && !/boom|abc1234/.test(painted)) test.check('a row reads test file | what is tested | status | since, no failure and no commit');
  else test.fail(OWED29 + 'a row paints ' + short(painted));
  cfg.press({ suite: RED.suite, title: RED.title, outcome: 'red', at: RED.at });
  if (dialogs.some(function (d) { return d[0] === 'shell/falloutHistory' && d[1].suite === RED.suite && d[1].heading === RED.title; })) test.check('a press opens shell/falloutHistory for that test');
  else test.fail(OWED29 + 'a press opened ' + short(dialogs));
  if (/No test matches/.test(String(cfg.empty || ''))) test.check('an empty list says no test matches');
  else test.fail(OWED29 + 'the empty sentence reads ' + short(cfg.empty));
  const deskFace = fs.readFileSync(path.join(RUN, 'shell', 'desk', 'desk.js'), 'utf8');
  if (/ui\.open\(el, \{[^]*?verb: function \(name, body\) \{ return deskApi\.verb\(name, body\); \}/.test(deskFace)) test.check('Desk hands its plugins its own call, verb(name, body)');
  else test.fail(OWED29 + 'Desk hands its plugins no verb');

  test.subHeading('G29.5. deleted, and what stays');
  const src = fs.readFileSync(PLUGIN_UI, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const left = ['wireBusy', 'typedTimer', 'TYPED_PAUSE_MS', 'testLines', 'probabilityStringMatch', 'createProbabilityBucket', 'fallout.reds', 'fallout.summary', 'fallout.history'].filter(function (w) { return src.indexOf(w) !== -1; });
  if (!left.length) test.check('the pane\'s own cache, wire slot, typing timer, ranking and the wrapper verbs are gone');
  else test.fail(OWED29 + 'the pane still holds ' + short(left));
  const all = box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (/data-fallout-tab="reds"[^>]*>Reds</.test(all) && /data-fallout-tab="items"[^>]*>Items</.test(all)) test.check('two inner tabs stay, Reds and Items');
  else test.fail(OWED29 + 'the tabs read ' + short(all));
  const markup = box.innerHTML;
  if (chatAt && chatAt.id === 'fallout-chat' && markup.indexOf('id="fallout-chat"') > markup.indexOf('id="fallout-items"')) test.check('the goal chat stays at the bottom');
  else test.fail(OWED29 + 'the chat mounted in ' + short(chatAt && chatAt.id));
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
      const ask = (body && body.ask) || {};
      const server = Object.keys(ask)[0];
      const q = server && ask[server];
      const v = q && Object.keys(q)[0];
      calls.push([server, v, q && q[v]]);
      return Promise.resolve({ status: 200, body: server === 'deskVerify' && v === 'search' ? { items: FLIPS.map(function (x, i) { return { key: String(i), label: JSON.stringify(x) }; }), more: false, total: 2 } : { ok: false, code: 'no-such-verb' } });
    },
    onPublished: function () { return function () {}; }, closeDialog: function () {}, setScreenTitle: function () {}, setDialogResult: function () {},
  });
  await app.open({ suite: 'zzFalloutA.js', heading: 'the relay answers its key' });
  await sleep(20);
  const page = box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  // goal/G29.5: Fallout talks to deskVerify only, its history dialog too.
  const hc = calls.filter(function (c) { return c[0] === 'deskVerify' && c[1] === 'search'; })[0];
  if (calls.length && calls.every(function (c) { return c[0] === 'deskVerify'; }) && hc && hc[2].over === 'tests' && hc[2].suite === 'zzFalloutA.js' && hc[2].heading === 'the relay answers its key' && hc[2].history === 'yes' && hc[2].slim === 'yes') test.check('it reads the flips with deskVerify\'s search itself, history: yes, slim');
  else test.fail(OWED29 + 'the dialog asked ' + short(calls));
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
