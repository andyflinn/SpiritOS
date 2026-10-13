'use strict';

// spirit/test/deskPluginsGg.js
// goal/G22.3: gg plugin, goal governance by a mounted plugin. Red on today's tree; claude-windows writes it and builds
// it (one agent). Andy's decision, in the item's box (2026-10-13): a gg plugin governs its type of goal and is the first
// to handle every desk event for it; desk mounts every plugin in its plugin folder; on its first mount a plugin gets its
// own private goal with a fixed key; the stackFrameChecks plugin keeps its goal and its rerun item (as goal/G22.1) open
// whatever is pressed, and its dialog takes a gate and an endpoint and makes a goal/G22.2-type item; in the List the
// label of a plugin's private goal is a button that opens the plugin's private UI. The folder: the server half at
// spirit/run/process/js/desk/plugins/js/<name>/<name>.js with its .json beside it, the private UI at
// spirit/run/shell/desk/plugins/<name>/.
//
// WHAT IS ASSERTED
//   a. desk mounts every plugin in its folder that has its .js and its .json: the real stackFrameChecks and a scratch
//      one named by the suite-only value pluginsMore; a folder without its .json is not mounted.
//   b. on the first mount each plugin's private goal exists under its fixed key, and a restart on the same state keeps
//      that key and mints nothing again (one goal, the same items).
//   c. the plugin sees a call first: Done, Close and abandon on its goal and its rerun item are refused, the reason
//      naming the plugin, and neither offers those buttons; the same presses on an ordinary goal's items still land.
//   d. the rerun item is in the plugin's goal, its file list exactly [spirit/test/oneDoorStacks.js], and an agent's
//      verify.again on it is taken (the record deskVerify reruns that suite from).
//   e. the dialog's verb stackFrameChecks.make {gate, endpoint} makes a goal/G22.2-type item in the plugin's goal: its
//      title, its box stating the rule, its file list [spirit/test/stackFrameTestItems.js]; empty, bad or repeated
//      input is refused with a why.
//   f. the face: shell/desk/desk.js draws the label of a plugin's goal as a button naming the plugin, which opens its
//      private UI from shell/desk/plugins/<name>/; that UI's gate and endpoint inputs carry data-field and validate as
//      typed, and its Make sends stackFrameChecks.make.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G22.3: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const PLUGIN_JS = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'stackFrameChecks', 'stackFrameChecks.js');
const PLUGIN_JSON = path.join(RUN, 'process', 'js', 'desk', 'plugins', 'js', 'stackFrameChecks', 'stackFrameChecks.json');
const PLUGIN_UI = path.join(RUN, 'shell', 'desk', 'plugins', 'stackFrameChecks', 'stackFrameChecks.js');
const GOAL = 'plugin/stackFrameChecks';
const FAKE_GOAL = 'plugin/ggEcho';
const A = { key: 'MCowBQYDK2VwAyEAdeskPluginsGgAgentAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskPluginsGgOwnerAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G22.3: gg plugin, goal governance by a mounted plugin');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskpluginsgg-'));

// A SCRATCH PLUGIN, written the way the real one is: its folder, its .js and its .json. Its verb proves it was mounted.
function plantFakePlugins(dir) {
  const one = path.join(dir, 'ggEcho');
  fs.mkdirSync(one, { recursive: true });
  fs.writeFileSync(path.join(one, 'ggEcho.json'), JSON.stringify({ label: 'Echo', description: 'a scratch plugin of deskPluginsGg.js', kind: 'deskPlugin', goal: 'Echo plugin' }));
  fs.writeFileSync(path.join(one, 'ggEcho.js'), "'use strict';\nmodule.exports = function (desk) {\n" +
    "  return { verbs: { 'ggEcho.ping': { request: {}, reply: { goal: '' }, handler: function () { return { goal: desk.goal }; } } } };\n};\n");
  // No .json beside it: not a plugin, so not mounted.
  const none = path.join(dir, 'ggNoManifest');
  fs.mkdirSync(none, { recursive: true });
  fs.writeFileSync(path.join(none, 'ggNoManifest.js'), "'use strict';\nmodule.exports = function () { return { verbs: { 'ggNoManifest.ping': { request: {}, reply: {}, handler: function () { return {}; } } } }; };\n");
}

// ── THE FACE, IN A FAKE DOM (as deskRows.js mounts it) ──────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, replaceChild: function () {}, firstChild: null, parentNode: null,
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId,
    createElement: function (tag) { return fakeElement(tag); }, body: fakeElement('body') };
}
function mountFace(answers) {
  const doc = fakeDocument();
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      return Promise.resolve({ status: 200, body: answers[v] || { change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return doc;
}

(async function () {
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const out = j && j.ask === 'api' ? { desk: {} } : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  const more = path.join(scratch, 'plugins', 'js');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  plantFakePlugins(more);
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  const start = function () {
    return spawn(process.execPath, [DESK, JSON.stringify({ pluginsMore: more }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  };
  let tree = {};
  const waitUp = async function () {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) { tree = r.body.desk; return true; } } catch (e) { /* not yet */ } }
    return false;
  };
  let kid = start();
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const landed = function (r) { return !!(r && r.change); };
  const why = function (r) { return r && r.ok === false && r.extra && typeof r.extra.why === 'string' ? r.extra.why : ''; };
  const rows = async function (q) {
    const r = await call('items.search', Object.assign({ text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: true }, q || {}), ANDY);
    return (r.items || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return null; } };
  const pathsOf = function (f) { return ((f && f.files) || []).map(function (e) { return e.path; }); };
  const members = async function (gid) { return (await rows()).filter(function (r) { return r.goal === gid; }); };
  try {
    if (!await waitUp()) { test.fail('the world: the desk did not start'); return; }
    await sleep(500);

    test.subHeading('a. desk mounts every plugin in its folder');
    if (fs.existsSync(PLUGIN_JS) && fs.existsSync(PLUGIN_JSON)) test.check('the stackFrameChecks plugin is at process/js/desk/plugins/js/stackFrameChecks/, its .js and its .json');
    else test.fail(OWED + 'no stackFrameChecks.js and .json under process/js/desk/plugins/js/stackFrameChecks/');
    if (tree['stackFrameChecks.make']) test.check('the real plugin is mounted: desk answers stackFrameChecks.make');
    else test.fail(OWED + 'desk declares no stackFrameChecks.make');
    if (tree['ggEcho.ping']) test.check('a scratch plugin in a further folder is mounted too: desk answers ggEcho.ping');
    else test.fail(OWED + 'desk declares no ggEcho.ping from the scratch plugin folder');
    if (!tree['ggNoManifest.ping']) test.check('a folder without its .json is no plugin and is not mounted');
    else test.fail(OWED + 'a plugin with no .json was mounted');
    const echo = await call('ggEcho.ping', {}, A);
    if (echo.goal === FAKE_GOAL) test.check('the scratch plugin is handed its private goal\'s key: ' + echo.goal);
    else test.fail(OWED + 'ggEcho.ping answered ' + short(echo));

    test.subHeading('b. the private goal, under its fixed key, kept across a restart');
    const goals1 = (await rows({ goalsOnly: true })).filter(function (r) { return r.plugin === 'stackFrameChecks'; });
    if (goals1.length === 1 && goals1[0].id === GOAL) test.check('one goal belongs to stackFrameChecks, keyed ' + GOAL);
    else test.fail(OWED + 'the goals marked for stackFrameChecks: ' + short(goals1.map(function (g) { return g.id; })));
    const fake1 = await factsOf(FAKE_GOAL);
    if (fake1 && fake1.plugin === 'ggEcho') test.check('the scratch plugin has its own private goal too, ' + FAKE_GOAL);
    else test.fail(OWED + FAKE_GOAL + ' reads ' + short(fake1));
    const before = JSON.stringify((await members(GOAL)).map(function (r) { return r.id; }).sort());

    test.subHeading('d. the rerun item');
    const items0 = await members(GOAL);
    const rerun = items0.filter(function (r) { const p = pathsOf(r); return p.length === 1 && p[0] === 'spirit/test/oneDoorStacks.js'; })[0];
    if (items0.length === 1 && rerun) test.check('the plugin\'s goal holds its rerun item ' + rerun.id + ', its file list exactly [spirit/test/oneDoorStacks.js]');
    else test.fail(OWED + 'the items of ' + GOAL + ': ' + short(items0.map(function (r) { return [r.id, pathsOf(r)]; })));
    const rerunId = rerun ? rerun.id : GOAL + '.1';
    const again = await call('verify.again', { id: rerunId }, A);
    if (landed(again)) test.check('an agent\'s verify.again on the rerun item is taken, so deskVerify reruns oneDoorStacks.js');
    else test.fail(OWED + 'verify.again on the rerun item answered ' + short(again));
    const filesTry = await call('item.files.add', { id: rerunId, paths: ['spirit/test/deskServer.js'] }, A);
    const rerunAfter = await factsOf(rerunId);
    if (!landed(filesTry) && JSON.stringify(pathsOf(rerunAfter)) === JSON.stringify(['spirit/test/oneDoorStacks.js'])) test.check('its file list stays exactly oneDoorStacks.js: ' + why(filesTry));
    else test.fail(OWED + 'a file added to the rerun item answered ' + short(filesTry) + '; its list ' + short(pathsOf(rerunAfter)));

    test.subHeading('c. the plugin sees a call first');
    // An ordinary goal beside it, its items closed and done as they always are.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'ord/G1', title: 'Ordinary' }, items: [
      { id: 'ord/G1.1', title: 'One', blocks: ['ord/G1'] }, { id: 'ord/G1.2', title: 'Two', blocks: ['ord/G1'] }] }) }, A);
    await call('press', { id: 'ord/G1', what: 'end-design' }, ANDY);
    const tries = [[GOAL, 'close'], [GOAL, 'done'], [GOAL, 'abandon'], [rerunId, 'close'], [rerunId, 'done']];
    for (const t of tries) {
      const r = await call('press', { id: t[0], what: t[1] }, ANDY);
      if (!landed(r) && /stackFrameChecks/.test(why(r))) test.check(t[1] + ' on ' + t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[1] + ' on ' + t[0] + ' answered ' + short(r));
    }
    const del = await call('item.delete', { id: rerunId }, ANDY);
    if (!landed(del) && /stackFrameChecks/.test(why(del))) test.check('his delete of the rerun item is refused: ' + why(del));
    else test.fail(OWED + 'item.delete on the rerun item answered ' + short(del));
    const g = await factsOf(GOAL);
    const ri = await factsOf(rerunId);
    const shown = [].concat((g && g.buttons) || [], (ri && ri.buttons) || []);
    if (g && ri && g.status !== 'closed' && ri.status !== 'closed' && ri.status !== 'done' && !shown.some(function (b) { return ['close', 'done', 'delete'].indexOf(b) !== -1; })) {
      test.check('both stay open and offer neither Close, Done nor Delete: ' + short(shown));
    } else test.fail(OWED + 'the goal reads ' + short(g && [g.status, g.buttons]) + ', the rerun item ' + short(ri && [ri.status, ri.buttons]));
    const sess = await call('session.set', { json: JSON.stringify({ goal: { id: GOAL, title: 'Stack-frame checks' }, items: [] }) }, A);
    if (!landed(sess) && /stackFrameChecks/.test(why(sess))) test.check('a session over its goal, which would close its rerun item as left out, is refused: ' + why(sess));
    else test.fail(OWED + 'a session.set over ' + GOAL + ' answered ' + short(sess));
    const oDone = await call('press', { id: 'ord/G1.1', what: 'done' }, ANDY);
    const oClose = await call('press', { id: 'ord/G1.2', what: 'close' }, ANDY);
    const oAbandon = await call('press', { id: 'ord/G1', what: 'abandon' }, ANDY);
    if (landed(oDone) && landed(oClose) && landed(oAbandon)) test.check('on an ordinary goal Done, Close and abandon still land');
    else test.fail('the ordinary presses answered ' + short([oDone, oClose, oAbandon]));

    test.subHeading('e. the dialog\'s verb makes a goal/G22.2-type item');
    const made = await call('stackFrameChecks.make', { gate: 'peerPost', endpoint: 'presenceNode' }, ANDY);
    const mf = made.id ? await factsOf(made.id) : null;
    const mb = made.id ? await call('item.box', { id: made.id }, ANDY) : {};
    if (mf && mf.goal === GOAL) test.check('the item ' + made.id + ' is in the plugin\'s goal');
    else test.fail(OWED + 'stackFrameChecks.make answered ' + short(made) + '; its facts ' + short(mf));
    if (mf && mf.title === 'Nobody but peerPost reaches presenceNode') test.check('its title: ' + mf.title);
    else test.fail(OWED + 'its title reads ' + short(mf && mf.title));
    if (/every production stack reaching presenceNode passes through peerPost/.test(String(mb.box || ''))) test.check('its box states the rule');
    else test.fail(OWED + 'its box reads ' + short(mb.box));
    if (mf && JSON.stringify(pathsOf(mf)) === JSON.stringify(['spirit/test/stackFrameTestItems.js'])) test.check('its file list is [spirit/test/stackFrameTestItems.js]');
    else test.fail(OWED + 'its file list reads ' + short(mf && pathsOf(mf)));
    const bad = [
      ['an empty gate', { gate: '', endpoint: 'presenceNode' }],
      ['an empty endpoint', { gate: 'peerPost', endpoint: '  ' }],
      ['a gate with a control character', { gate: 'peer\u0007Post', endpoint: 'presenceNode' }],
      ['an endpoint over the label limit', { gate: 'peerPost', endpoint: 'x'.repeat(65) }],
      ['the same gate and endpoint again', { gate: 'peerPost', endpoint: 'presenceNode' }],
    ];
    for (const t of bad) {
      const r = await call('stackFrameChecks.make', t[1], ANDY);
      if (!r.id && why(r)) test.check(t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[0] + ' answered ' + short(r));
    }

    test.subHeading('b. a restart replays the same plugin goal');
    try { kid.kill(); } catch (e) { /* gone */ }
    await sleep(800);
    kid = start();
    if (!await waitUp()) { test.fail('the world: the desk did not start again'); return; }
    const goals2 = (await rows({ goalsOnly: true })).filter(function (r) { return r.plugin === 'stackFrameChecks'; });
    const after = (await members(GOAL)).map(function (r) { return r.id; });
    const expected = JSON.parse(before).concat(made.id ? [made.id] : []).sort();
    if (goals2.length === 1 && goals2[0].id === GOAL && JSON.stringify(after.slice().sort()) === JSON.stringify(expected)) {
      test.check('after the restart: the one goal ' + GOAL + ' and the same items, nothing minted again');
    } else test.fail(OWED + 'after the restart the goals ' + short(goals2.map(function (x) { return x.id; })) + ', the items ' + short(after) + ' against ' + short(expected));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.close();
  }

  test.subHeading('f. the face');
  try {
    const doc = mountFace({ 'items.search': { items: [
      { key: GOAL, label: JSON.stringify({ id: GOAL, title: 'Stack-frame checks', goal: '', plugin: 'stackFrameChecks', status: '', with: '', buttons: [], blocking: [], blocked: [GOAL + '.1'] }) },
      { key: 'ord/G2', label: JSON.stringify({ id: 'ord/G2', title: 'Ordinary goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [] }) },
    ], more: false } });
    await sleep(50);
    const top = doc.getElementById('desk-top').innerHTML;
    const btn = /<button[^>]*data-plugin="stackFrameChecks"[^>]*>[^<]*Stack-frame checks/.exec(top);
    if (btn) test.check('the List draws the plugin goal\'s label as a button naming its plugin');
    else test.fail(OWED + 'the List row of ' + GOAL + ' reads ' + short((/<tr data-row="plugin\/stackFrameChecks"[\s\S]*?<\/tr>/.exec(top) || [''])[0]));
    if (!/<button[^>]*data-plugin[^>]*>[^<]*Ordinary goal/.test(top)) test.check('an ordinary goal\'s label stays plain text');
    else test.fail('an ordinary goal\'s label was drawn as a plugin button');
    const src = fs.readFileSync(FACE, 'utf8');
    if (/shell\/desk\/plugins\//.test(src) && /data-plugin/.test(src)) test.check('the button opens the plugin\'s private UI from shell/desk/plugins/<name>/');
    else test.fail(OWED + 'shell/desk/desk.js names no shell/desk/plugins/ UI to open');
  } catch (e) { test.fail(OWED + 'the face could not be mounted: ' + (e && e.message)); }
  try {
    if (!fs.existsSync(PLUGIN_UI)) throw new Error('no ' + path.relative(RUN, PLUGIN_UI));
    const doc = fakeDocument();
    const win = { spiritFieldRules: require('../run/js/fieldRules.js') };
    new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
    const ui = win.spiritDeskPlugins && win.spiritDeskPlugins.stackFrameChecks;
    if (!ui || typeof ui.open !== 'function') throw new Error('the UI registers no window.spiritDeskPlugins.stackFrameChecks.open');
    const asked = [];
    const box = fakeElement('box');
    ui.open(box, { goal: GOAL, ask: function (verb, a) { asked.push([verb, a]); return Promise.resolve({ id: GOAL + '.2', change: 9, items: [], more: false }); },
      onPublished: function () { return function () {}; } });
    const html = box.innerHTML;
    const inputs = html.match(/<input[^>]*>/g) || [];
    const gateIn = inputs.filter(function (i) { return /id="sfc-gate"/.test(i); })[0] || '';
    const endIn = inputs.filter(function (i) { return /id="sfc-endpoint"/.test(i); })[0] || '';
    if (/data-field="label"/.test(gateIn) && /data-field="label"/.test(endIn)) test.check('the private UI\'s gate and endpoint inputs carry data-field="label"');
    else test.fail(OWED + 'the UI\'s inputs read ' + short(inputs));
    // Typed past the label rule: the bytes are said and Make is refused.
    doc.getElementById('sfc-gate').value = 'x'.repeat(70);
    box.fire('input', { target: { id: 'sfc-gate', getAttribute: function (n) { return n === 'data-field' ? 'label' : null; } } });
    const left = doc.getElementById('sfc-gate-left').textContent;
    if (/bytes/.test(left) && doc.getElementById('sfc-make').disabled === true) test.check('a gate over the rule is said as typed (' + left + ') and Make is off');
    else test.fail(OWED + 'typed 70 bytes: the note reads ' + short(left) + ', Make disabled ' + doc.getElementById('sfc-make').disabled);
    doc.getElementById('sfc-gate').value = 'peerPost';
    doc.getElementById('sfc-endpoint').value = 'postQueue';
    box.fire('input', { target: { id: 'sfc-gate', getAttribute: function (n) { return n === 'data-field' ? 'label' : null; } } });
    box.fire('click', { target: { id: 'sfc-make', getAttribute: function () { return null; } } });
    await sleep(20);
    const sent = asked.filter(function (x) { return x[0] === 'stackFrameChecks.make'; })[0];
    if (sent && sent[1].gate === 'peerPost' && sent[1].endpoint === 'postQueue') test.check('Make sends stackFrameChecks.make with the gate and the endpoint');
    else test.fail(OWED + 'Make asked ' + short(asked));
  } catch (e) { test.fail(OWED + 'the private UI: ' + (e && e.message)); }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
