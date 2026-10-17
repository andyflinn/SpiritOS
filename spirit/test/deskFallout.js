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
const RED = { suite: 'zzFalloutA.js', title: 'the relay answers its key', outcome: 'red', commit: 'abc1234', at: '2026-10-17T09:00:00.000Z', failure: 'boom: no answer' };

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
          out = verb === 'search' ? { items: [{ key: '7', label: JSON.stringify(RED) }], more: false } : { ok: false, code: 'no-such-verb', error: 'no such verb' };
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
  if (a1[0] === 'search' && a1[1].over === 'tests' && a1[1].outcome === 'red' && a1[1].test === 'relay key') test.check('words ask deskVerify search {over: tests, outcome: red, test: the words}');
  else test.fail(OWED + 'deskVerify was asked ' + short(a1));
  if (rows.length === 1 && rows[0] && rows[0].title === RED.title && rows[0].failure === RED.failure) test.check('its answer carries deskVerify\'s rows as they came');
  else test.fail(OWED + 'fallout.reds answered ' + short(r1));
  await call('fallout.reds', { text: 'zzFalloutA.js' });
  const a2 = verifyAsks[verifyAsks.length - 1] || [];
  if (a2[1] && a2[1].suite === 'zzFalloutA.js' && !a2[1].test && a2[1].outcome === 'red') test.check('a suite\'s file name asks for that suite\'s reds');
  else test.fail(OWED + 'a suite name asked ' + short(a2));
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
  new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
  const ui = win.spiritDeskPlugins.fallout;
  if (!ui || typeof ui.open !== 'function') { test.fail(OWED + 'the UI registers no window.spiritDeskPlugins.fallout.open'); return; }
  const asked = [];
  const box = fakeElement('pane');
  ui.open(box, {
    goal: GOAL,
    ask: function (verb, a) { asked.push([verb, a]); return Promise.resolve(verb === 'fallout.reds' ? { items: [{ key: '7', label: JSON.stringify(RED) }], more: false } : {}); },
    onPublished: function () { return function () {}; }, chat: function () {}, callDialog: function () { return new Promise(function () {}); },
  });
  await sleep(20);
  const all = function () { return box.innerHTML + Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
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
  if (/zzFalloutA\.js/.test(table) && /the relay answers its key/.test(table) && /abc1234/.test(table) && /boom: no answer/.test(table)) test.check('each red is a table row: suite, test, commit, time and failure');
  else test.fail(OWED + 'the table reads ' + short(table));
  box.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-fallout-tab' ? 'items' : null; } } });
  await sleep(10);
  const items = doc.getElementById('fallout-items');
  if (items.hidden === false && /not yet|nothing yet|later/i.test(items.innerHTML) && doc.getElementById('fallout-pane-reds').hidden === true) test.check('Items shows, empty for now, saying so; Reds hides');
  else test.fail(OWED + 'after Items: items hidden ' + items.hidden + ', says ' + short(items.innerHTML) + ', reds hidden ' + doc.getElementById('fallout-pane-reds').hidden);
}

(async function () { await serverHalf(); await paneHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  try { node && node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
