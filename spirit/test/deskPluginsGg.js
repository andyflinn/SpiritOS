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
//   f. the face: SINCE goal/G22.3's second ruling (Andy, 2026-10-13, in the item's box: a main tab Apps whose inner tabs
//      are the special goals, Team first and Stacks, the stackFrameChecks plugin's private UI; Apps replaces the label
//      button), a top-level Apps tab and no top-level Team tab; inside Apps a Team inner tab holding what the Team tab
//      held, still drawn live from the stream, and one inner tab per mounted plugin, named by the tab field of its .json
//      (Stacks), which loads its private UI from shell/desk/plugins/<name>/ and hands it the stream; the List's
//      plugin-goal title is plain text again, and the label button, its pane and its Back to the List are gone. That
//      UI's gate and endpoint inputs carry data-field and validate as typed, and its Make sends stackFrameChecks.make.
//      Andy, 2026-10-13: "in Stack: the chat is missing, below the inputs, after what will be the list". So the Stacks
//      pane reads the inputs, its items, then the chat of plugin/stackFrameChecks: its lines, a say box and Send that
//      post chat.add to that goal, a published line drawn as it comes, and none of it in Team.
//   g. THE LIST OF DOORS (goal/G22.3, Andy's decision 2026-10-13 in the item's box): the plugin keeps the doors in
//      stackFrameList.json beside it, which the stack-frame test reads. The gate is narrow, one file::function, and a
//      whole module named as the gate is cheating; the endpoint is wide, a whole module. So stackFrameChecks.make
//      {gate: spirit/run/<file>.js::<function>, endpoint: spirit/run/<file>.js} refuses a gate without its function
//      (saying it is cheating), an endpoint naming a function, a file that is not there and a function its file does
//      not hold, and adds the door to the list with no suites (an empty run is its red) and the item that asked;
//      stackFrameChecks.doors reads the list back. Here the list is a scratch file, named by the suite-only value
//      stackFrameList, so the tree's own list is never written by a suite. The UI's inputs carry data-field="gate"
//      and data-field="endpoint", say a wrong form as typed with Make off, and the UI shows the doors.
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
// Since goal/G22.3's Apps ruling the fake document keeps what the face makes and appends (a plugin's pane, its script)
// and an element made with an id is found by it, as in a browser.
function fakeDocument() {
  const byId = {};
  const made = [];
  const appended = [];
  const body = fakeElement('body');
  const append = function (el) { appended.push(el); if (el && el.id) byId[el.id] = el; };
  body.appendChild = append;
  const byIdOrNew = function (id) {
    if (byId[id]) return byId[id];
    const el = byId[id] = fakeElement(id);
    el.appendChild = append;
    return el;
  };
  return { getElementById: byIdOrNew, all: byId, made: made, appended: appended,
    createElement: function (tag) {
      const el = fakeElement('');
      el.tagName = String(tag).toUpperCase();
      el.appendChild = append;
      made.push(el);
      return el;
    }, body: body };
}
// The face mounted with a window it shares with a plugin's UI, every desk ask kept, every stream subscriber kept.
function mountFace(answers) {
  const doc = fakeDocument();
  const win = { spiritFieldRules: require('../run/js/fieldRules.js') };
  const asked = [];
  const published = [];
  const container = fakeElement('c');
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, win);
  b.mount(container, {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) asked.push([v, ask[v]]);
      const a = answers[v];
      return Promise.resolve({ status: 200, body: (typeof a === 'function' ? a(ask[v]) : a) || { change: 1 } });
    },
    onPublished: function (fn) { published.push(fn); return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  doc.win = win; doc.asked = asked; doc.published = published; doc.container = container;
  return doc;
}
function clickTab(el, tab) {
  el.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-tab' ? tab : null; }, closest: function () { return null; }, parentNode: null }, currentTarget: el });
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
  // The plugin's list of doors, in scratch (g.): the tree's own stackFrameList.json is never written by a suite.
  const listFile = path.join(scratch, 'stackFrameList.json');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  plantFakePlugins(more);
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  const start = function () {
    return spawn(process.execPath, [DESK, JSON.stringify({ pluginsMore: more, stackFrameList: listFile }), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
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
    if (tree['stackFrameChecks.doors']) test.check('and stackFrameChecks.doors, the list of doors read back');
    else test.fail(OWED + 'desk declares no stackFrameChecks.doors');
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
    // Since goal/G22.3's Apps ruling: the goal's row names the plugin's inner tab under Apps, from the tab field of its .json.
    let manifestTab = '';
    try { manifestTab = String(JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')).tab || ''); } catch (e) { /* said below */ }
    if (manifestTab === 'Stacks' && goals1.length === 1 && goals1[0].pluginTab === 'Stacks') test.check('its .json names its tab under Apps, "Stacks", and its goal\'s row carries it as pluginTab');
    else test.fail(OWED + 'the .json\'s tab reads ' + short(manifestTab) + ', the goal row\'s pluginTab ' + short(goals1[0] && goals1[0].pluginTab));
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
    const GATE = 'spirit/run/js/peerPost.js::post';
    const END = 'spirit/run/js/presenceNode.js';
    const made = await call('stackFrameChecks.make', { gate: GATE, endpoint: END }, ANDY);
    const mf = made.id ? await factsOf(made.id) : null;
    const mb = made.id ? await call('item.box', { id: made.id }, ANDY) : {};
    if (mf && mf.goal === GOAL) test.check('the item ' + made.id + ' is in the plugin\'s goal');
    else test.fail(OWED + 'stackFrameChecks.make answered ' + short(made) + '; its facts ' + short(mf));
    if (mf && mf.title === 'Nobody but peerPost::post reaches presenceNode') test.check('its title, by the short names: ' + mf.title);
    else test.fail(OWED + 'its title reads ' + short(mf && mf.title));
    if (String(mb.box || '').indexOf('every production stack reaching ' + END + ' passes through ' + GATE) !== -1) test.check('its box states the rule');
    else test.fail(OWED + 'its box reads ' + short(mb.box));
    if (mf && JSON.stringify(pathsOf(mf)) === JSON.stringify(['spirit/test/stackFrameTestItems.js'])) test.check('its file list is [spirit/test/stackFrameTestItems.js]');
    else test.fail(OWED + 'its file list reads ' + short(mf && pathsOf(mf)));

    test.subHeading('g. the list of doors');
    let listed = null;
    try { listed = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { listed = null; }
    const door = Array.isArray(listed) ? listed.filter(function (x) { return x && x.gate === GATE && x.endpoint === END; })[0] : null;
    if (door && Array.isArray(door.suites) && door.suites.length === 0 && door.item === made.id) test.check('the door is added to the list, its suites empty (an empty run is its red), its item ' + door.item);
    else test.fail(OWED + 'the scratch list reads ' + short(listed));
    const back = await call('stackFrameChecks.doors', {}, A);
    if (Array.isArray(back.doors) && back.doors.some(function (x) { return x.gate === GATE && x.endpoint === END && x.item === made.id; })) test.check('stackFrameChecks.doors reads it back');
    else test.fail(OWED + 'stackFrameChecks.doors answered ' + short(back));
    const bad = [
      ['an empty gate', { gate: '', endpoint: END }],
      ['an empty endpoint', { gate: GATE, endpoint: '  ' }],
      ['a gate with a control character', { gate: 'spirit/run/js/peer\u0007Post.js::post', endpoint: END }],
      ['a whole module as the gate', { gate: 'spirit/run/js/peerPost.js', endpoint: 'spirit/run/js/postQueue.js' }, /cheating/],
      ['an endpoint naming a function', { gate: GATE, endpoint: 'spirit/run/js/postQueue.js::createQueue' }, /whole module/],
      ['a gate outside spirit/run', { gate: 'js/peerPost.js::post', endpoint: END }],
      ['a gate file that is not there', { gate: 'spirit/run/js/noSuchDoor.js::post', endpoint: END }, /not there|no such/],
      ['a gate function its file does not hold', { gate: 'spirit/run/js/peerPost.js::noSuchFunctionHere', endpoint: END }, /noSuchFunctionHere/],
      ['an endpoint file that is not there', { gate: GATE, endpoint: 'spirit/run/js/noSuchEndpoint.js' }, /not there|no such/],
      ['the gate in the endpoint\'s own file', { gate: 'spirit/run/js/postQueue.js::createQueue', endpoint: 'spirit/run/js/postQueue.js' }],
      ['the same gate and endpoint again', { gate: GATE, endpoint: END }],
    ];
    for (const t of bad) {
      const r = await call('stackFrameChecks.make', t[1], ANDY);
      if (!r.id && why(r) && (!t[2] || t[2].test(why(r)))) test.check(t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[0] + ' answered ' + short(r));
    }
    let listAfter = null;
    try { listAfter = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { listAfter = null; }
    if (Array.isArray(listAfter) && listAfter.length === 1) test.check('a refused make adds nothing to the list');
    else test.fail(OWED + 'after the refusals the list reads ' + short(listAfter));

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
  // SINCE goal/G22.3's APPS RULING (Andy, 2026-10-13): the label button these lines asserted is gone; Apps replaces it.
  try {
    const GROUP = 'desk/G0.0';
    const doc = mountFace({
      'items.search': { items: [
        { key: GOAL, label: JSON.stringify({ id: GOAL, title: 'Stack-frame checks', goal: '', plugin: 'stackFrameChecks', pluginTab: 'Stacks', status: '', with: '', buttons: [], blocking: [], blocked: [GOAL + '.1'] }) },
        { key: 'ord/G2', label: JSON.stringify({ id: 'ord/G2', title: 'Ordinary goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [] }) },
      ], more: false },
      'item.chat': function (a) {
        if (a && a.id === GROUP) return { chat: [{ by: 'andy', at: new Date(Date.now() - 1000).toISOString(), text: 'a team line held before', taken: '' }], chatMore: false };
        if (a && a.id === GOAL) return { chat: [{ by: 'claude-windows', at: new Date(Date.now() - 1000).toISOString(), text: 'a stacks line held before', taken: '' }], chatMore: false };
        return { chat: [], chatMore: false };
      },
    });
    await sleep(50);
    const top = doc.getElementById('desk-top').innerHTML;
    const tabs = doc.getElementById('desk-tabs').innerHTML;
    const shell = doc.container.innerHTML;
    const src = fs.readFileSync(FACE, 'utf8');

    if (/data-tab="apps"/.test(tabs) && />Apps</.test(tabs)) test.check('the tab row holds a top-level Apps tab');
    else test.fail(OWED + 'the tab row holds no Apps tab: ' + short(tabs));
    if (!/data-tab="team"/.test(tabs)) test.check('no top-level Team tab remains in the tab row');
    else test.fail(OWED + 'the tab row still holds a top-level Team tab');

    const apps = (/<div data-pane="apps"[\s\S]*$/.exec(shell) || [''])[0];
    if (apps && !/data-pane="team"/.test(shell)) test.check('the shell has an Apps pane and no Team pane of its own');
    else test.fail(OWED + 'the shell\'s panes: apps ' + !!apps + ', a team pane ' + /data-pane="team"/.test(shell));
    const teamApp = /<div data-app="team"[\s\S]*?id="desk-session"[\s\S]*?id="desk-team-say"[\s\S]*?id="desk-team-send"[\s\S]*?id="desk-team"/.test(apps);
    if (teamApp) test.check('inside Apps, a Team inner pane holds what the Team tab held: the goal bubble, Say, Send and the group chat');
    else test.fail(OWED + 'the Apps pane holds no Team inner pane with #desk-session, #desk-team-say, #desk-team-send and #desk-team');
    if (/margin-top:1em/.test((/<div id="desk-app-tabs"[^>]*>/.exec(apps) || [''])[0])) test.check('the inner tab row is a block with its leading 1em');
    else test.fail(OWED + 'no #desk-app-tabs block with margin-top:1em in the Apps pane');

    const pluginSearches = function () { return doc.asked.filter(function (x) { return x[0] === 'items.search' && x[1] && x[1].text === 'plugin/' && x[1].goalsOnly === true; }).length; };
    const before0 = pluginSearches();
    clickTab(doc.getElementById('desk-tabs'), 'apps');
    await sleep(20);
    if (before0 === 0 && pluginSearches() === 1) test.check('the plugin goals are searched for when Apps opens, not at mount: the List\'s one ask on open stays one');
    else test.fail(OWED + 'plugin searches before Apps opened ' + before0 + ', after ' + pluginSearches());
    const tabs2 = doc.getElementById('desk-tabs').innerHTML;
    const inner = doc.getElementById('desk-app-tabs').innerHTML;
    if (/data-tab="apps"[^>]*aria-selected="true"/.test(tabs2) && /data-tab="team"[^>]*aria-selected="true"[^>]*>Team</.test(inner)) test.check('Apps opens on its first inner tab, Team, both marked as showing');
    else test.fail(OWED + 'after Apps: the tab row ' + short(tabs2) + '; the inner row ' + short(inner));
    const stacks = /<button[^>]*data-tab="app:stackFrameChecks"[^>]*>Stacks<\/button>/.exec(inner);
    if (stacks) test.check('the mounted plugin has its inner tab, named Stacks from its .json');
    else test.fail(OWED + 'the inner row has no Stacks tab for stackFrameChecks: ' + short(inner));
    const innerButtons = inner.match(/<button[^>]*>/g) || [];
    if (innerButtons.length >= 2 && innerButtons.every(function (t) { return /margin-right:1em/.test(t); })) test.check('each inner tab button carries its 1em after itself');
    else test.fail(OWED + 'the inner tab buttons: ' + short(innerButtons));

    // Team inside Apps is still drawn live from the stream.
    const line = { by: 'claude-windows', at: new Date().toISOString(), text: 'a team line published while Apps shows Team', taken: '' };
    doc.published.forEach(function (fn) { try { fn({ change: 7000, verb: 'chat.add', item: { id: GROUP, title: '', goal: '', status: 'closed', with: '', buttons: [], blocking: [], blocked: [] }, listed: false, chat: line }); } catch (e) { /* not this subscriber's */ } });
    await sleep(20);
    if (/a team line published while Apps shows Team/.test(doc.getElementById('desk-team').innerHTML)) test.check('a published group-chat line is drawn in Team inside Apps as it comes');
    else test.fail(OWED + 'the published line did not reach #desk-team inside Apps: ' + short(doc.getElementById('desk-team').innerHTML));

    // Stacks loads the plugin's private UI from shell/desk/plugins/<name>/, into its own pane, and hands it the stream.
    clickTab(doc.getElementById('desk-app-tabs'), 'app:stackFrameChecks');
    await sleep(20);
    const script = doc.appended.filter(function (e) { return e && e.tagName === 'SCRIPT'; })[0];
    if (script && script.src === '/shell/desk/plugins/stackFrameChecks/stackFrameChecks.js') test.check('the Stacks tab loads ' + script.src);
    else test.fail(OWED + 'the Stacks tab appended no script from shell/desk/plugins/stackFrameChecks/: ' + short(doc.appended.map(function (e) { return e && (e.src || e.id || e.tagName); })));
    const subsBefore = doc.published.length;
    if (script && typeof script.onload === 'function') {
      new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, doc.win);
      script.onload();
      await sleep(20);
    }
    const pane = doc.all['desk-app-stackFrameChecks'];
    if (pane && /id="sfc-gate"/.test(pane.innerHTML) && /id="sfc-make"/.test(pane.innerHTML)) test.check('its private UI is opened in its own pane, #desk-app-stackFrameChecks');
    else test.fail(OWED + 'no #desk-app-stackFrameChecks holding the plugin\'s UI: ' + short(pane && pane.innerHTML));
    if (doc.published.length > subsBefore) {
      doc.asked.length = 0;
      doc.published.slice(subsBefore).forEach(function (fn) { fn({ change: 7001, verb: 'stackFrameChecks.make', rows: [{ id: GOAL + '.2', goal: GOAL, title: 'x' }] }); });
      await sleep(20);
      if (doc.asked.some(function (x) { return x[0] === 'items.search'; })) test.check('the Stacks UI subscribed to the stream itself and reads its items again when one of its goal is published');
      else test.fail(OWED + 'a publish naming the plugin\'s goal made the Stacks UI ask nothing');
    } else test.fail(OWED + 'the Stacks UI did not subscribe to the desk server\'s stream');

    // THE CHAT OF ITS GOAL, BELOW THE LIST (goal/G22.3). Andy, 2026-10-13: "in Stack: the chat is missing, below the
    // inputs, after what will be the list". Top to bottom: the inputs, the items, then the chat of plugin/stackFrameChecks,
    // the desk face's own chat (as Team's) taking the goal: its lines, a say box and Send posting chat.add to that goal,
    // drawn live from the stream.
    const paneHtml = (pane && pane.innerHTML) || '';
    // The chat may be drawn into a child of the pane: the pane's HTML with every child's drawn HTML put in its place.
    const drawn = function (html, depth) {
      return depth > 3 ? html : html.replace(/(<[a-z]+[^>]*\bid="([^"]+)"[^>]*>)/g, function (m, tag, id) {
        const el = doc.all[id];
        return el && el.innerHTML && html.indexOf(el.innerHTML) === -1 ? tag + drawn(el.innerHTML, depth + 1) : tag;
      });
    };
    const whole = drawn(paneHtml, 0);
    const atGate = whole.indexOf('id="sfc-gate"');
    const atItems = whole.indexOf('id="sfc-items"');
    const sayM = /<textarea[^>]*\bid="([^"]+)"/.exec(whole.slice(Math.max(0, atItems)));
    const sendM = /<button[^>]*\bid="([^"]+)"[^>]*>Send<\/button>/.exec(whole.slice(Math.max(0, atItems)));
    const atHeld = whole.indexOf('a stacks line held before');
    if (atGate !== -1 && atItems > atGate && sayM && sendM && atHeld > atItems) test.check('the Stacks pane reads top to bottom: the inputs, its items, then its goal\'s chat with a say box, Send and its lines');
    else test.fail(OWED + 'the Stacks pane in order: gate at ' + atGate + ', items at ' + atItems + ', a say box after them ' + !!sayM + ', a Send after them ' + !!sendM + ', the held line of ' + GOAL + ' at ' + atHeld);
    if (doc.asked.some(function (x) { return x[0] === 'item.chat' && x[1] && x[1].id === GOAL; }) || atHeld !== -1) test.check('the chat read its goal\'s lines: item.chat on ' + GOAL);
    else test.fail(OWED + 'nothing asked item.chat on ' + GOAL);
    if (!/a stacks line held before/.test(doc.getElementById('desk-team').innerHTML)) test.check('Team does not show the Stacks goal\'s lines');
    else test.fail(OWED + 'the Stacks goal\'s line reached #desk-team');
    const chatBlocks = (whole.slice(Math.max(0, atItems)).match(/<div[^>]*class="(?:stat-tile|start-job-form)[^"]*"[^>]*>/g) || []);
    if (chatBlocks.length && chatBlocks.every(function (t) { return /margin-top:1em/.test(t); }) && sendM && /margin-right:1em/.test((new RegExp('<button[^>]*id="' + sendM[1] + '"[^>]*>').exec(whole) || [''])[0])) {
      test.check('each chat block carries its leading 1em, and Send its 1em after itself');
    } else test.fail(OWED + 'the chat\'s blocks ' + short(chatBlocks) + ', Send ' + short(sendM && (new RegExp('<button[^>]*id="' + sendM[1] + '"[^>]*>').exec(whole) || [''])[0]));
    if (sayM && sendM) {
      doc.asked.length = 0;
      doc.getElementById(sayM[1]).value = 'said under Stacks';
      doc.getElementById(sendM[1]).fire('click', {});
      await sleep(20);
      const sent = doc.asked.filter(function (x) { return x[0] === 'chat.add'; });
      if (sent.length === 1 && sent[0][1].id === GOAL && sent[0][1].text === 'said under Stacks') test.check('Send posts chat.add to ' + GOAL + ', once, with what was typed');
      else test.fail(OWED + 'Send asked ' + short(sent));
      if (doc.getElementById(sayM[1]).value === '') test.check('a kept line leaves the say box');
      else test.fail(OWED + 'after a kept send the say box holds ' + short(doc.getElementById(sayM[1]).value));
    } else test.fail(OWED + 'no say box and Send in the Stacks chat to post with');
    const stacksLine = { by: 'claude-windows', at: new Date().toISOString(), text: 'a stacks line published while Stacks shows', taken: '' };
    doc.published.forEach(function (fn) { try { fn({ change: 7002, verb: 'chat.add', item: { id: GOAL, title: 'Stack-frame checks', goal: '', plugin: 'stackFrameChecks', pluginTab: 'Stacks', status: '', with: '', buttons: [], blocking: [], blocked: [] }, chat: stacksLine }); } catch (e) { /* not this subscriber's */ } });
    await sleep(20);
    const after = drawn(pane ? pane.innerHTML : '', 0);
    if (/a stacks line published while Stacks shows/.test(after) && after.indexOf('a stacks line published while Stacks shows') < after.indexOf('a stacks line held before')) test.check('a published line of ' + GOAL + ' is drawn in the Stacks chat as it comes, newest first');
    else test.fail(OWED + 'the published line of ' + GOAL + ' did not reach the Stacks chat: ' + short(after.slice(Math.max(0, after.indexOf('id="sfc-items"')))));
    if (!/a stacks line published while Stacks shows/.test(doc.getElementById('desk-team').innerHTML)) test.check('Team does not draw it');
    else test.fail(OWED + 'the Stacks goal\'s published line reached #desk-team');
    clickTab(doc.getElementById('desk-app-tabs'), 'app:stackFrameChecks');
    await sleep(20);
    if (doc.appended.filter(function (e) { return e && e.tagName === 'SCRIPT'; }).length === 1) test.check('opening Stacks again loads nothing again');
    else test.fail(OWED + 'the plugin\'s script was appended more than once');

    // The List's plugin-goal title is plain text again, and the label button's mechanism is gone.
    if (!/data-plugin/.test(top) && /<td title="Stack-frame checks">Stack-frame checks <span/.test(top)) test.check('the List draws the plugin goal\'s title as plain text');
    else test.fail(OWED + 'the List row of ' + GOAL + ' reads ' + short((/<tr data-row="plugin\/stackFrameChecks"[\s\S]*?<\/tr>/.exec(top) || [''])[0]));
    const gone = ['data-plugin', 'desk-plugin-back', 'Back to the List', 'data-pane="plugin"', 'deskLabelHtml', 'deskShowTab'].filter(function (w) { return src.indexOf(w) !== -1; });
    if (!gone.length) test.check('the label button, its pane and its Back to the List are gone from shell/desk/desk.js');
    else test.fail(OWED + 'shell/desk/desk.js still holds ' + short(gone));
  } catch (e) { test.fail(OWED + 'the face could not be mounted: ' + (e && e.stack || e)); }
  try {
    if (!fs.existsSync(PLUGIN_UI)) throw new Error('no ' + path.relative(RUN, PLUGIN_UI));
    const doc = fakeDocument();
    const win = { spiritFieldRules: require('../run/js/fieldRules.js') };
    new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
    const ui = win.spiritDeskPlugins && win.spiritDeskPlugins.stackFrameChecks;
    if (!ui || typeof ui.open !== 'function') throw new Error('the UI registers no window.spiritDeskPlugins.stackFrameChecks.open');
    const asked = [];
    const box = fakeElement('box');
    const DOORS = [{ gate: 'spirit/run/js/peerPost.js::holdStreams', endpoint: 'spirit/run/js/presenceNode.js', suites: ['serverSurface.js'], item: 'goal/G19.14' },
      { gate: 'spirit/run/js/peerPost.js::sendAttempt', endpoint: 'node:http+https+fetch', paths: ['/api/relay/'], suites: [], item: 'goal/G22.2' }];
    ui.open(box, { goal: GOAL, ask: function (verb, a) {
      asked.push([verb, a]);
      if (verb === 'stackFrameChecks.doors') return Promise.resolve({ doors: DOORS });
      return Promise.resolve({ id: GOAL + '.2', change: 9, items: [], more: false });
    }, onPublished: function () { return function () {}; } });
    await sleep(20);
    const html = box.innerHTML;
    const inputs = html.match(/<input[^>]*>/g) || [];
    const gateIn = inputs.filter(function (i) { return /id="sfc-gate"/.test(i); })[0] || '';
    const endIn = inputs.filter(function (i) { return /id="sfc-endpoint"/.test(i); })[0] || '';
    if (/data-field="gate"/.test(gateIn) && /data-field="endpoint"/.test(endIn)) test.check('the private UI\'s inputs carry data-field="gate" and data-field="endpoint"');
    else test.fail(OWED + 'the UI\'s inputs read ' + short(inputs));
    const doorsEl = doc.getElementById('sfc-doors');
    if (/peerPost\.js::holdStreams/.test(doorsEl.innerHTML) && /node:http\+https\+fetch/.test(doorsEl.innerHTML) && /\/api\/relay\//.test(doorsEl.innerHTML) && /goal\/G22\.2/.test(doorsEl.innerHTML)) {
      test.check('the UI shows the list of doors, read with stackFrameChecks.doors: each gate, endpoint, paths and item');
    } else test.fail(OWED + 'the doors drawn: ' + short(doorsEl.innerHTML));
    const typed = function (id, v) {
      doc.getElementById(id).value = v;
      box.fire('input', { target: { id: id, getAttribute: function (n) { return n === 'data-field' ? id.replace('sfc-', '') : null; } } });
      return doc.getElementById(id + '-left').textContent;
    };
    // A whole module typed as the gate: said as typed, and Make is off.
    let left = typed('sfc-gate', 'spirit/run/js/peerPost.js');
    if (/cheating/.test(left) && doc.getElementById('sfc-make').disabled === true) test.check('a whole module typed as the gate is said as typed (' + left + ') and Make is off');
    else test.fail(OWED + 'typed a whole module as the gate: the note reads ' + short(left) + ', Make disabled ' + doc.getElementById('sfc-make').disabled);
    typed('sfc-gate', 'spirit/run/js/peerPost.js::post');
    left = typed('sfc-endpoint', 'spirit/run/js/postQueue.js::createQueue');
    if (/whole module/.test(left) && doc.getElementById('sfc-make').disabled === true) test.check('an endpoint naming a function is said as typed (' + left + ') and Make is off');
    else test.fail(OWED + 'typed a function as the endpoint: the note reads ' + short(left) + ', Make disabled ' + doc.getElementById('sfc-make').disabled);
    left = typed('sfc-endpoint', 'spirit/run/js/postQueue.js');
    if (doc.getElementById('sfc-make').disabled === false) test.check('both forms right: Make is on (' + left + ')');
    else test.fail(OWED + 'both forms right, and Make is still off: ' + short(left));
    box.fire('click', { target: { id: 'sfc-make', getAttribute: function () { return null; } } });
    await sleep(20);
    const sent = asked.filter(function (x) { return x[0] === 'stackFrameChecks.make'; })[0];
    if (sent && sent[1].gate === 'spirit/run/js/peerPost.js::post' && sent[1].endpoint === 'spirit/run/js/postQueue.js') test.check('Make sends stackFrameChecks.make with the gate and the endpoint');
    else test.fail(OWED + 'Make asked ' + short(asked));
    if (asked.filter(function (x) { return x[0] === 'stackFrameChecks.doors'; }).length >= 2) test.check('a made door reads the list of doors again');
    else test.fail(OWED + 'after Make the doors were not read again');
  } catch (e) { test.fail(OWED + 'the private UI: ' + (e && e.message)); }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
