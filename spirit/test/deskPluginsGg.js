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
//   c. the plugin sees a call first: Done, Close and abandon on its goal are refused, the reason naming the plugin,
//      and it offers none of those buttons; the same presses on an ordinary goal's items still land.
//   d. SINCE goal/G27.2's D9 the goal has no rerun item: deskVerify reruns no stack check (it once held one whose
//      verify.again had deskVerify rerun oneDoorStacks.js).
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
//   h. THE PLUGIN RUNS THE SHOW (goal/G22.3). Andy, 2026-10-13, in the item's box: "I want this plugin to RUN the show,
//      so you give me the complete toolset. add/remove rows (add with validation) and you will give me a run
//      button/link for each one of them, or even better, a run-dialog", "with a way to modify a row as well." and "put
//      that in the dialog if you want." So on the server: make takes {gate, endpoint, paths, suites}, a node: endpoint
//      with its paths, each suite a file of spirit/test that is there; every door carries a stable id; update {id, gate,
//      endpoint, paths, suites} changes a door in place under the same validation and clears its last verdict; remove
//      {id} strikes it; an unknown id is refused by each. run {id} answers at once {started, runId}, a second run of the
//      same door while one runs is refused, runState {id} reports running, then the verdict (green, around, of, paths)
//      and the output's tail, stop {id} stops it; the last verdict per door is kept in the plugin's own folder under the
//      desk's --state, survives a restart, and each change is published. (The run half of this point is superseded by
//      deskVerify's runs, below.)
//   i. THE UI: the main list is the door list, one row per door (gate, endpoint, paths, suites, its last verdict) with
//      ONE button, Open, 1em after itself, that opens the door's dialog; the form adds a door with paths and suites
//      (data-field on each, a wrong suite name said as typed). The dialog holds the door's values as inputs, Save
//      (update), Remove, Run and Stop: Run shows running, then the verdict and each path around the gate on its own
//      line. The goal's items below the doors, the chat below them. Andy, 2026-10-13: "input fields will look less
//      crappy if arranged in a block, that itself act's like an inline element": each input, in the form and in the
//      dialog, sits in its own inline-block framed block, its name and what goes in it in words above the input; a
//      filled field's words read what its value means, updated as typed.
//   h, i SINCE goal/G27.2 (Andy, 2026-10-17, in its box), replacing goal/G22.3's runs through deskVerify: "i don't want
//      verifier to block the design-a-door process", "i don't mind if our test sends the verifier a result". So run
//      {id} starts the one-door suite in the plugin at once and answers {started}; it never asks deskVerify door.run;
//      runState and each door's last verdict are the plugin's own, kept under the desk's --state (runs/), surviving a
//      restart; the verdict is handed to deskVerify as door.record only. The door's detail is the shell dialog
//      shell/stackFrameCheckDetail, which Open on a row opens through ctx.callDialog: it holds the door's values in the
//      shared door fields, Save, Run (its note says the run is here), the verdict, and Remove, armed. The pane listens
//      to the plugin's own publishes, not deskVerify's stream. deskStacksDialog.js asserts the rest of goal/G27.2.
//   j. THE PLUGIN COMMITS ITS OWN LIST. Andy, 2026-10-13: "the commit function has to be there. it belongs to committing
//      reds." After make, update or remove writes stackFrameList.json, the plugin commits that one file in the repo it
//      lives in, "plugin/stackFrameChecks: <what changed>", and pushes; with other changes staged it refuses to commit
//      and says so; a push that fails is said in the reply and the commit stays local. Here the list lives in a scratch
//      work tree with a scratch bare remote, so no suite commits to a real repo.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
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
const DIALOG = path.join(RUN, 'shell', 'stackFrameCheckDetail', 'stackFrameCheckDetail.js');
// The shared elements the face, the pane and the dialog load on demand (goal/G27.2); a fake page cannot load a script,
// so the world puts them on its window first, as a page that loaded them holds them.
const SHARED = ['deskDoorFields.js', 'deskChat.js'].map(function (f) { return path.join(RUN, 'shell', 'shared', 'js', f); });
function withShared(doc, win) { SHARED.forEach(function (f) { if (fs.existsSync(f)) new Function('document', 'window', fs.readFileSync(f, 'utf8'))(doc, win); }); return win; }
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
  const win = withShared(doc, { spiritFieldRules: require('../run/js/fieldRules.js') });
  const asked = [];
  const published = [];
  const servers = [];
  const container = fakeElement('c');
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, win);
  b.mount(container, {
    escapeHtml: kernel.core.util.escapeHtml,
    // goal/G29.8: the plugin folder is read from the shell's one tree, handed over by api.onFiles as the shell does.
    onFiles: function (fn) { if (Array.isArray(answers.files)) fn(answers.files, { visible: true }); return function () {}; },
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) asked.push([v, ask[v]]);
      const a = answers[v];
      return Promise.resolve({ status: 200, body: (typeof a === 'function' ? a(ask[v]) : a) || { change: 1 } });
    },
    onPublished: function (fn, server) { published.push(fn); servers.push(String(server || '')); return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  doc.win = win; doc.asked = asked; doc.published = published; doc.servers = servers; doc.container = container;
  return doc;
}
function clickTab(el, tab) {
  el.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-tab' ? tab : null; }, closest: function () { return null; }, parentNode: null }, currentTarget: el });
}

(async function () {
  // What the desk publishes reaches this fake node as jobs.update {app: ...}: kept.
  // A FAKE deskVerify ON IT (h., since goal/G22.3's "every run here should report to deskVerify"): door.run queues a
  // run that is under way for 1.5 s and then holds its verdict; door.state reads it, as deskVerify keeps it.
  const reports = [];
  const verifyAsks = [];
  const fakeDoors = {};
  const doorState = function (id) {
    const d = fakeDoors[id];
    if (!d) return { id: id, running: false, queued: false, ran: false, green: false, around: 0, of: 0, paths: [], pathsLeft: 0, why: '', startedAt: '', endedAt: '', commit: '', stopped: false };
    const done = Date.now() - d.at >= 1500;
    return { id: id, running: !done, queued: false, ran: done, green: false, around: done ? 2 : 0, of: done ? 5 : 0,
      paths: done ? ['POST /x from spirit/run/js/a.js:1:f', 'POST /y from spirit/run/js/b.js:2:g'] : [], pathsLeft: 0, why: '',
      startedAt: new Date(d.at).toISOString(), endedAt: done ? new Date(d.at + 1500).toISOString() : '', commit: 'abc12345', stopped: false };
  };
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        reports.push(b);
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = j && j.ask === 'api' ? { desk: {} } : { ok: true };
        if (j && j.ask && j.ask.deskVerify) {
          const verb = Object.keys(j.ask.deskVerify)[0];
          const a = j.ask.deskVerify[verb] || {};
          verifyAsks.push([verb, a]);
          if (verb === 'door.run') { if (!fakeDoors[a.id] || doorState(a.id).ran) fakeDoors[a.id] = { at: Date.now() }; out = { queued: true, already: false }; }
          else if (verb === 'door.state') out = doorState(String(a.id));
          else if (verb === 'door.record') out = { recorded: true };
          else out = { ok: false, code: 'no-such-verb', error: 'no such verb' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  const more = path.join(scratch, 'plugins', 'js');
  // THE PLUGIN'S LIST OF DOORS, in scratch (g.): the tree's own stackFrameList.json is never written by a suite. Since j.
  // it lives in a scratch work tree with a scratch bare remote, since the plugin commits the list in the repo it lives in.
  const gitIn = function (cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); };
  const remote = path.join(scratch, 'remote.git');
  const work = path.join(scratch, 'work');
  fs.mkdirSync(work, { recursive: true });
  gitIn(scratch, ['init', '-q', '--bare', remote]);
  gitIn(work, ['init', '-q', '-b', 'master']);
  gitIn(work, ['config', 'user.email', 'gg@example.invalid']);
  gitIn(work, ['config', 'user.name', 'gg']);
  gitIn(work, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(work, 'README.md'), 'scratch work tree of deskPluginsGg.js\n');
  gitIn(work, ['add', 'README.md']);
  gitIn(work, ['commit', '-q', '--no-verify', '-m', 'start']);
  gitIn(work, ['remote', 'add', 'origin', remote]);
  gitIn(work, ['push', '-q', 'origin', 'master:master']);
  const headOf = function () { return String(gitIn(work, ['rev-parse', 'HEAD']).stdout || '').trim(); };
  const remoteHead = function () { return String(gitIn(work, ['--git-dir', remote, 'rev-parse', 'master']).stdout || '').trim(); };
  const lastCommit = function () {
    return { subject: String(gitIn(work, ['log', '-1', '--format=%s']).stdout || '').trim(),
      files: String(gitIn(work, ['show', '--name-only', '--format=', 'HEAD']).stdout || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean) };
  };
  const listFile = path.join(work, 'stackFrameList.json');
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

    // d. SINCE goal/G27.2's D9 (Andy, 2026-10-17: "the stacks plugin must drive the stack checks exclusively") the goal
    // has no rerun item: deskVerify reruns no stack check. deskStacksDialog.js asserts the old one is deleted.
    test.subHeading('d. no rerun item');
    const items0 = await members(GOAL);
    if (items0.length === 0) test.check('the plugin\'s fresh goal holds no item: no rerun item for deskVerify to rerun');
    else test.fail(OWED + 'the items of ' + GOAL + ': ' + short(items0.map(function (r) { return [r.id, r.title, pathsOf(r)]; })));

    test.subHeading('c. the plugin sees a call first');
    // An ordinary goal beside it, its items closed and done as they always are.
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'ord/G1', title: 'Ordinary' }, items: [
      { id: 'ord/G1.1', title: 'One', blocks: ['ord/G1'] }, { id: 'ord/G1.2', title: 'Two', blocks: ['ord/G1'] }] }) }, ANDY);
    await call('press', { id: 'ord/G1', what: 'end-design' }, ANDY);
    const tries = [[GOAL, 'close'], [GOAL, 'done'], [GOAL, 'abandon']];
    for (const t of tries) {
      const r = await call('press', { id: t[0], what: t[1] }, ANDY);
      if (!landed(r) && /stackFrameChecks/.test(why(r))) test.check(t[1] + ' on ' + t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[1] + ' on ' + t[0] + ' answered ' + short(r));
    }
    const g = await factsOf(GOAL);
    const shown = (g && g.buttons) || [];
    if (g && g.status !== 'closed' && !shown.some(function (b) { return ['close', 'done'].indexOf(b) !== -1; })) {
      test.check('the goal stays open and offers neither Close nor Done: ' + short(shown));
    } else test.fail(OWED + 'the goal reads ' + short(g && [g.status, g.buttons]));
    const sess = await call('session.set', { json: JSON.stringify({ goal: { id: GOAL, title: 'Stack-frame checks' }, items: [] }) }, A);
    if (!landed(sess) && /stackFrameChecks/.test(why(sess))) test.check('a session over its goal, which would close its door items as left out, is refused: ' + why(sess));
    else test.fail(OWED + 'a session.set over ' + GOAL + ' answered ' + short(sess));
    const oDone = await call('press', { id: 'ord/G1.1', what: 'done' }, ANDY);
    const oClose = await call('press', { id: 'ord/G1.2', what: 'close' }, ANDY);
    const oAbandon = await call('press', { id: 'ord/G1', what: 'abandon' }, ANDY);
    if (landed(oDone) && landed(oClose) && landed(oAbandon)) test.check('on an ordinary goal Done, Close and abandon still land');
    else test.fail('the ordinary presses answered ' + short([oDone, oClose, oAbandon]));

    test.subHeading('e. the dialog\'s verb makes a goal/G22.2-type item');
    const GATE = 'spirit/run/js/peerPost.js::post';
    const END = 'spirit/run/js/presenceNode.js';
    // Since h. make takes paths and suites as well (a request is exact: every key, every time).
    const head0 = headOf();
    const made = await call('stackFrameChecks.make', { gate: GATE, endpoint: END, paths: [], suites: [] }, ANDY);
    const headMade = headOf();
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
      const r = await call('stackFrameChecks.make', Object.assign({ paths: [], suites: [] }, t[1]), ANDY);
      if (!r.id && why(r) && (!t[2] || t[2].test(why(r)))) test.check(t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[0] + ' answered ' + short(r));
    }
    let listAfter = null;
    try { listAfter = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { listAfter = null; }
    if (Array.isArray(listAfter) && listAfter.length === 1) test.check('a refused make adds nothing to the list');
    else test.fail(OWED + 'after the refusals the list reads ' + short(listAfter));

    test.subHeading('j. the plugin commits its own list, and pushes');
    const c1 = lastCommit();
    if (headOf() !== head0 && /^plugin\/stackFrameChecks: /.test(c1.subject) && JSON.stringify(c1.files) === '["stackFrameList.json"]') test.check('make committed the list alone: "' + c1.subject + '"');
    else test.fail(OWED + 'after make the work tree\'s last commit is ' + short(c1) + (headOf() === head0 ? ' (HEAD did not move)' : ''));
    if (remoteHead() === headOf()) test.check('and pushed it: the remote holds the same commit');
    else test.fail(OWED + 'the remote holds ' + short(remoteHead()) + ', the work tree ' + short(headOf()));
    if (/push/i.test(String(made.commit || '')) && !/fail|not/i.test(String(made.commit || ''))) test.check('make\'s reply says it: ' + made.commit);
    else test.fail(OWED + 'make\'s reply carries no commit line: ' + short(made));
    if (headOf() === headMade) test.check('the refused makes committed nothing');
    else test.fail(OWED + 'a refused make moved HEAD');

    test.subHeading('h. the plugin runs the show: add, update, remove, run, runState, stop');
    const RUNVERBS = ['stackFrameChecks.update', 'stackFrameChecks.remove', 'stackFrameChecks.run', 'stackFrameChecks.runState'];
    const missing = RUNVERBS.filter(function (v) { return !tree[v]; });
    if (!missing.length) test.check('desk declares ' + RUNVERBS.join(', '));
    else test.fail(OWED + 'desk declares none of ' + short(missing));
    // ERADICATED (goal/G22.3, "it means this app here should launch the run through deskVerify"): the plugin's own
    // stop, its runner, its runs.json. deskVerify's Stop ends a door run as it ends any run.
    if (!tree['stackFrameChecks.stop']) test.check('the plugin has no stop verb of its own any more: deskVerify\'s Stop ends the run');
    else test.fail(OWED + 'desk still declares stackFrameChecks.stop');
    const pluginSrc = fs.readFileSync(PLUGIN_JS, 'utf8');
    // goal/G27.2: the plugin runs the one-door suite itself again, and asks deskVerify only to record the verdict.
    if (pluginSrc.indexOf("'door.run'") === -1 && pluginSrc.indexOf("'door.state'") === -1 && pluginSrc.indexOf("'door.record'") !== -1) test.check('the plugin asks deskVerify no door.run or door.state, only door.record');
    else test.fail(OWED + 'the plugin\'s source still asks deskVerify to run or read its doors');
    const idA = door && typeof door.id === 'string' && door.id ? door.id : '';
    if (idA) test.check('the made door carries a stable id in the list: ' + idA);
    else test.fail(OWED + 'the made door carries no id: ' + short(door));
    // A node: endpoint with its paths, and suites of spirit/test that are there.
    const RELAY = { gate: 'spirit/run/js/peerPost.js::onRequest', endpoint: 'node:http+https+fetch', paths: ['/api/relay/'], suites: ['deskServer.js'] };
    const badAdds = [
      ['a suite that is not in spirit/test', Object.assign({}, RELAY, { suites: ['noSuchSuiteHere.js'] }), /noSuchSuiteHere/],
      ['a suite outside spirit/test', Object.assign({}, RELAY, { suites: ['../run/js/hub.js'] }), /suite/],
      ['a node: endpoint without its paths', Object.assign({}, RELAY, { paths: [] }), /paths/],
      ['a path that is no request path', Object.assign({}, RELAY, { paths: ['api relay'] }), /path/],
      ['a node: endpoint of an unknown kind', Object.assign({}, RELAY, { endpoint: 'node:ftp' }), /ftp/],
      ['paths on a module endpoint', { gate: GATE, endpoint: 'spirit/run/js/postQueue.js', paths: ['/api/relay/'], suites: [] }, /paths/],
    ];
    for (const t of badAdds) {
      const r = await call('stackFrameChecks.make', t[1], ANDY);
      if (!r.id && why(r) && t[2].test(why(r))) test.check(t[0] + ' is refused: ' + why(r));
      else test.fail(OWED + t[0] + ' answered ' + short(r));
    }
    const madeB = await call('stackFrameChecks.make', RELAY, ANDY);
    const doorsB = await call('stackFrameChecks.doors', {}, A);
    const dB = (doorsB.doors || []).filter(function (x) { return x.endpoint === RELAY.endpoint; })[0];
    const idB = dB && dB.id ? dB.id : '';
    if (madeB.id && dB && idB && idB !== idA && JSON.stringify(dB.paths) === JSON.stringify(RELAY.paths) && JSON.stringify(dB.suites) === JSON.stringify(RELAY.suites)) {
      test.check('a node: endpoint with its paths and a suite that is there is added, under its own id ' + idB + ', its item ' + madeB.id);
    } else test.fail(OWED + 'the relay door made ' + short(madeB) + ', read back ' + short(dB));
    if ((doorsB.doors || []).every(function (x) { return x.last && typeof x.last.ran === 'boolean' && typeof x.last.running === 'boolean'; })) test.check('every door read back carries its last run: ' + short(dB && dB.last));
    else test.fail(OWED + 'the doors read back carry no last run: ' + short(doorsB));

    // update: the same validation as add; an unknown id refused.
    const upUnknown = await call('stackFrameChecks.update', Object.assign({ id: 'noSuchDoor' }, RELAY), ANDY);
    if (why(upUnknown) && /noSuchDoor/.test(why(upUnknown))) test.check('update of an unknown door is refused: ' + why(upUnknown));
    else test.fail(OWED + 'update of an unknown door answered ' + short(upUnknown));
    const upBad = await call('stackFrameChecks.update', Object.assign({ id: idB }, RELAY, { gate: 'spirit/run/js/peerPost.js' }), ANDY);
    if (why(upBad) && /cheating/.test(why(upBad))) test.check('update under the add rules: a whole module as the gate is refused: ' + why(upBad));
    else test.fail(OWED + 'update with a whole module as the gate answered ' + short(upBad));
    const upSuite = await call('stackFrameChecks.update', Object.assign({ id: idB }, RELAY, { suites: ['nopeSuite.js'] }), ANDY);
    if (why(upSuite) && /nopeSuite/.test(why(upSuite))) test.check('update with a suite that is not there is refused: ' + why(upSuite));
    else test.fail(OWED + 'update with a missing suite answered ' + short(upSuite));

    // run (goal/G27.2, D5): the plugin starts the door's run itself and answers at once; deskVerify gets the verdict as a
    // record only. Door A has no suites, so its verdict lands at once: an empty run, said so.
    const t0 = Date.now();
    const run1 = await call('stackFrameChecks.run', { id: idA }, ANDY);
    const took = Date.now() - t0;
    if (run1.started === true && took < 1200) test.check('run answers at once (' + took + ' ms): started here');
    else test.fail(OWED + 'run answered ' + short(run1) + ' in ' + took + ' ms');
    if (!/Verifier/.test(String(run1.said || ''))) test.check('its reply sends nobody to the Verifier tab: ' + run1.said);
    else test.fail(OWED + 'run\'s reply still points to the Verifier tab: ' + short(run1));
    let st2 = {};
    for (let i = 0; i < 60; i++) { st2 = await call('stackFrameChecks.runState', { id: idA }, A); if (st2.running === false && st2.endedAt) break; await sleep(250); }
    const v = st2.verdict || {};
    if (st2.running === false && st2.endedAt && /no suites/i.test(String(v.why || ''))) test.check('runState then reports the plugin\'s own verdict: ' + v.why);
    else test.fail(OWED + 'runState after the run answered ' + short(st2));
    if (Array.isArray(v.violators)) test.check('with the violator lines the plugin formats');
    else test.fail(OWED + 'the verdict carries no violator lines: ' + short(v));
    if (!verifyAsks.some(function (x) { return x[0] === 'door.run' || x[0] === 'door.state'; })) test.check('deskVerify was asked neither door.run nor door.state');
    else test.fail(OWED + 'deskVerify was asked ' + short(verifyAsks.map(function (x) { return x[0]; })));
    if (verifyAsks.some(function (x) { return x[0] === 'door.record' && x[1] && x[1].id === idA && x[1].verdict && x[1].verdict.endedAt; })) test.check('the verdict went to deskVerify as door.record {id: ' + idA + ', verdict}');
    else test.fail(OWED + 'deskVerify was asked ' + short(verifyAsks));
    const kept = path.join(state, 'plugins', 'stackFrameChecks', 'runs');
    if (fs.existsSync(path.join(kept, idA + '.json'))) test.check('the plugin keeps the run under the desk\'s --state: runs/' + idA + '.json');
    else test.fail(OWED + 'no runs/' + idA + '.json under ' + kept);
    const dA = ((await call('stackFrameChecks.doors', {}, A)).doors || []).filter(function (x) { return x.id === idA; })[0];
    if (dA && dA.last && dA.last.endedAt === st2.endedAt && dA.last.running === false) test.check('the door list carries that last run');
    else test.fail(OWED + 'the door read back after its run: ' + short(dA));

    // The other door runs too, driven by a real suite; while its run is under way it is not changed, and a second run of
    // it is said to be running already.
    const run3 = await call('stackFrameChecks.run', { id: idB }, ANDY);
    const again3 = await call('stackFrameChecks.run', { id: idB }, ANDY);
    const upRunning = await call('stackFrameChecks.update', Object.assign({ id: idB }, RELAY), ANDY);
    if (run3.started === true && again3.already === true && again3.started === false) test.check('a second run of ' + idB + ' while one runs is not started: ' + again3.said);
    else test.fail(OWED + 'run of ' + idB + ' answered ' + short(run3) + ', again ' + short(again3));
    if (why(upRunning) && /under way/.test(why(upRunning))) test.check('a door whose run is under way is not changed: ' + why(upRunning));
    else test.fail(OWED + 'update during the run answered ' + short(upRunning));
    let st3 = {};
    for (let i = 0; i < 240; i++) { await sleep(250); st3 = await call('stackFrameChecks.runState', { id: idB }, A); if (st3.running === false && st3.endedAt) break; }
    if (st3.endedAt && st3.verdict && typeof st3.verdict.ran === 'boolean') test.check('door ' + idB + ' ran here too: ' + short(st3.verdict.why || (st3.verdict.green ? 'green' : 'red')));
    else test.fail(OWED + 'runState of ' + idB + ' answered ' + short(st3));
    const asksBefore = verifyAsks.length;
    const runUnknown = await call('stackFrameChecks.run', { id: 'noSuchDoor' }, ANDY);
    if (!runUnknown.started && why(runUnknown) && verifyAsks.length === asksBefore) test.check('run of an unknown door is refused, and deskVerify is not asked: ' + why(runUnknown));
    else test.fail(OWED + 'run of an unknown door answered ' + short(runUnknown));

    // update lands and clears the door's last verdict; the other door keeps its own.
    const upOk = await call('stackFrameChecks.update', Object.assign({ id: idB }, RELAY, { suites: ['deskServer.js', 'oneDoorStacks.js'] }), ANDY);
    const after2 = (await call('stackFrameChecks.doors', {}, A)).doors || [];
    const dB2 = after2.filter(function (x) { return x.id === idB; })[0];
    const dA2 = after2.filter(function (x) { return x.id === idA; })[0];
    if (!why(upOk) && dB2 && JSON.stringify(dB2.suites) === '["deskServer.js","oneDoorStacks.js"]' && dB2.item === madeB.id) test.check('update changes the door in place, under its id and its item');
    else test.fail(OWED + 'update answered ' + short(upOk) + ', the door reads ' + short(dB2));
    if (dB2 && dB2.last && dB2.last.ran === false && dA2 && dA2.last && dA2.last.ran === true) test.check('an updated door\'s last verdict is cleared; the other door keeps its own');
    else test.fail(OWED + 'after the update the last runs read ' + short([dB2 && dB2.last, dA2 && dA2.last]));
    const cUp = lastCommit();
    if (/^plugin\/stackFrameChecks: /.test(cUp.subject) && /update|chang/i.test(cUp.subject) && JSON.stringify(cUp.files) === '["stackFrameList.json"]' && remoteHead() === headOf()) test.check('j. update committed the list alone and pushed it: "' + cUp.subject + '"');
    else test.fail(OWED + 'after update the last commit is ' + short(cUp) + ', remote ' + (remoteHead() === headOf() ? 'level' : 'behind'));

    // j. OTHER STAGED CHANGES: the plugin refuses to commit, and says so; what was staged stays staged.
    fs.writeFileSync(path.join(work, 'README.md'), 'somebody else\'s staged change\n');
    gitIn(work, ['add', 'README.md']);
    const headStaged = headOf();
    const upStaged = await call('stackFrameChecks.update', Object.assign({ id: idB }, RELAY, { suites: ['deskServer.js'] }), ANDY);
    const stagedNow = String(gitIn(work, ['diff', '--cached', '--name-only']).stdout || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!why(upStaged) && headOf() === headStaged && /staged/i.test(String(upStaged.commit || '')) && /not committed/i.test(String(upStaged.commit || ''))) test.check('with other changes staged the update lands but nothing is committed, and the reply says why: ' + upStaged.commit);
    else test.fail(OWED + 'update with README.md staged answered ' + short(upStaged) + (headOf() === headStaged ? '' : '; HEAD moved'));
    if (stagedNow.indexOf('README.md') !== -1 && stagedNow.indexOf('stackFrameList.json') === -1) test.check('README.md stays staged, and the list was not added');
    else test.fail(OWED + 'staged after the refusal: ' + short(stagedNow));
    gitIn(work, ['reset', '-q', '--', 'README.md']);
    gitIn(work, ['checkout', '--', 'README.md']);

    // remove: strikes the door; an unknown one refused. j. With its remote gone the push fails: said, the commit kept.
    const gone = path.join(scratch, 'remote.gone');
    fs.renameSync(remote, gone);
    const headRm = headOf();
    const rm = await call('stackFrameChecks.remove', { id: idB }, ANDY);
    fs.renameSync(gone, remote);
    const cRm = lastCommit();
    if (headOf() !== headRm && /^plugin\/stackFrameChecks: /.test(cRm.subject) && /remov/i.test(cRm.subject) && JSON.stringify(cRm.files) === '["stackFrameList.json"]') test.check('j. remove committed the list alone, locally: "' + cRm.subject + '"');
    else test.fail(OWED + 'after remove the last commit is ' + short(cRm) + (headOf() === headRm ? ' (HEAD did not move)' : ''));
    if (/push/i.test(String(rm.commit || '')) && /fail|not/i.test(String(rm.commit || '')) && remoteHead() !== headOf()) test.check('a push that fails is said in the reply, and the commit stays local: ' + rm.commit);
    else test.fail(OWED + 'remove with the remote gone answered ' + short(rm) + '; remote ' + (remoteHead() === headOf() ? 'level' : 'behind'));
    let listRm = null;
    try { listRm = JSON.parse(fs.readFileSync(listFile, 'utf8')); } catch (e) { listRm = null; }
    if (!why(rm) && Array.isArray(listRm) && !listRm.some(function (x) { return x.id === idB; }) && listRm.some(function (x) { return x.id === idA; })) test.check('remove strikes the door ' + idB + ' from the list, the other stays');
    else test.fail(OWED + 'remove answered ' + short(rm) + ', the list reads ' + short(listRm));
    const rm2 = await call('stackFrameChecks.remove', { id: idB }, ANDY);
    if (why(rm2) && rm2.ok === false) test.check('removing a door that is not there is refused: ' + why(rm2));
    else test.fail(OWED + 'a second remove answered ' + short(rm2));

    test.subHeading('b. a restart replays the same plugin goal');
    try { kid.kill(); } catch (e) { /* gone */ }
    await sleep(800);
    kid = start();
    if (!await waitUp()) { test.fail('the world: the desk did not start again'); return; }
    const goals2 = (await rows({ goalsOnly: true })).filter(function (r) { return r.plugin === 'stackFrameChecks'; });
    const after = (await members(GOAL)).map(function (r) { return r.id; });
    const expected = JSON.parse(before).concat(made.id ? [made.id] : []).concat(madeB.id ? [madeB.id] : []).sort();
    if (goals2.length === 1 && goals2[0].id === GOAL && JSON.stringify(after.slice().sort()) === JSON.stringify(expected)) {
      test.check('after the restart: the one goal ' + GOAL + ' and the same items, nothing minted again');
    } else test.fail(OWED + 'after the restart the goals ' + short(goals2.map(function (x) { return x.id; })) + ', the items ' + short(after) + ' against ' + short(expected));
    const stR = await call('stackFrameChecks.runState', { id: idA }, A);
    if (stR.running === false && stR.endedAt === st2.endedAt && stR.verdict && /no suites/i.test(String(stR.verdict.why || ''))) test.check('h. the last verdict of ' + idA + ' survives the restart');
    else test.fail(OWED + 'after the restart runState of ' + idA + ' answered ' + short(stR));
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
      // goal/G29.5: THE PLUGIN FOLDER, LISTED. Andy, 2026-10-17: "just search the plugin folder for subfolders, THAT's
      // the way you find them all." Since goal/G29.8 it is read from the shell's tree: two plugin folders and a stray file.
      files: ['shell', 'shell/desk', 'shell/desk/plugins', 'shell/desk/plugins/stackFrameChecks', 'shell/desk/plugins/zzLowRank'].map(function (p) { return { name: path.basename(p), relativePath: p, kind: 'folder' }; })
        .concat(['shell/desk/plugins/stackFrameChecks/stackFrameChecks.js', 'shell/desk/plugins/zzLowRank/zzLowRank.js', 'shell/desk/plugins/zzLowRank/other.js', 'shell/desk/plugins/readme.md'].map(function (p) { return { name: path.basename(p), relativePath: p, kind: 'file' }; })),
      'item.get': function (a) {
        if (a && a.id === GOAL) return { item: JSON.stringify({ id: GOAL, title: 'Stack-frame checks', goal: '', plugin: 'stackFrameChecks', pluginTab: 'Stacks', status: '', with: '', buttons: [], blocking: [], blocked: [] }) };
        if (a && a.id === 'plugin/zzLowRank') return { item: JSON.stringify({ id: 'plugin/zzLowRank', title: 'Low rank', goal: '', plugin: 'zzLowRank', pluginTab: 'LowRank', status: '', with: '', buttons: [], blocking: [], blocked: [] }) };
        return { ok: false, code: 'no-such-item' };
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

    // goal/G29.5: THE PLUGINS ARE FOUND BY THEIR FOLDER, never by a ranked search (a long chat ranked Fallout's goal out
    // of a capped answer, and its tab vanished). Andy, 2026-10-17: "just search the plugin folder for subfolders, THAT's
    // the way you find them all."
    // goal/G29.8: the plugin folder comes from the shell's tree; a plugin found asks its goal, plugin/<name>, once.
    const folderLists = function () { return doc.asked.filter(function (x) { return x[0] === 'item.get' && x[1] && String(x[1].id) === 'plugin/zzLowRank'; }).length; };
    const rankedPluginSearches = function () { return doc.asked.filter(function (x) { return x[0] === 'items.search' && x[1] && x[1].text === 'plugin/'; }).length; };
    const before0 = folderLists();
    clickTab(doc.getElementById('desk-tabs'), 'apps');
    await sleep(20);
    if (before0 === 0 && folderLists() === 1) test.check('the plugins are found when Apps opens, not at mount, from the shell\'s tree of shell/desk/plugins/, once');
    else test.fail('OWED by goal/G29.5: plugin folder listings before Apps opened ' + before0 + ', after ' + folderLists());
    if (rankedPluginSearches() === 0) test.check('no ranked items.search for plugin/ is made any more');
    else test.fail('OWED by goal/G29.5: the face still searches plugin/ ' + rankedPluginSearches() + ' time(s)');
    const innerLow = doc.getElementById('desk-app-tabs').innerHTML;
    if (/data-tab="app:zzLowRank"[^>]*>LowRank</.test(innerLow) && !/readme/.test(innerLow)) test.check('every plugin subfolder gets its tab, named from its goal, a plugin no search would rank included; files are not plugins');
    else test.fail('OWED by goal/G29.5: the inner row reads ' + short(innerLow));
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
    // goal/G27.9: Desk also loads the shared element on demand, so the plugin's script is found by its folder.
    const script = doc.appended.filter(function (e) { return e && e.tagName === 'SCRIPT' && String(e.src || '').indexOf('/shell/desk/plugins/') !== -1; })[0];
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
    // goal/G27.2: the run is the plugin's own, so the Stacks UI listens to the desk's stream alone.
    if (doc.servers.slice(subsBefore).indexOf('deskVerify') === -1) test.check('the Stacks UI does not subscribe to deskVerify\'s stream: the run is the plugin\'s');
    else test.fail(OWED + 'the Stacks UI still subscribes to deskVerify\'s stream');
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
    if (doc.appended.filter(function (e) { return e && e.tagName === 'SCRIPT' && String(e.src || '').indexOf('/shell/desk/plugins/') !== -1; }).length === 1) test.check('opening Stacks again loads nothing again');
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
    const win = withShared(doc, { spiritFieldRules: require('../run/js/fieldRules.js') });
    new Function('document', 'window', fs.readFileSync(PLUGIN_UI, 'utf8'))(doc, win);
    const ui = win.spiritDeskPlugins && win.spiritDeskPlugins.stackFrameChecks;
    if (!ui || typeof ui.open !== 'function') throw new Error('the UI registers no window.spiritDeskPlugins.stackFrameChecks.open');
    const asked = [];
    const box = fakeElement('box');
    const NEVER = { running: false, ran: false, green: false, around: 0, of: 0, startedAt: '', endedAt: '', stopped: false };
    const DOORS = [{ id: 'd1', gate: 'spirit/run/js/peerPost.js::holdStreams', endpoint: 'spirit/run/js/presenceNode.js', suites: ['serverSurface.js'], item: 'goal/G19.14',
      last: { running: false, ran: true, green: true, around: 0, of: 12, startedAt: '2026-10-13T10:00:00.000Z', endedAt: '2026-10-13T10:01:00.000Z', stopped: false } },
    { id: 'd2', gate: 'spirit/run/js/peerPost.js::sendAttempt', endpoint: 'node:http+https+fetch', paths: ['/api/relay/'], suites: [], item: 'goal/G22.2', last: NEVER }];
    // runState answers what the test sets: running first, then the verdict.
    let runState = { id: 'd2', running: true, startedAt: new Date(Date.now() - 3000).toISOString(), endedAt: '', stopped: false, tail: '',
      verdict: { ran: false, green: false, around: 0, of: 0, paths: [], why: '' } };
    const uiPublished = [];
    const dialogs = [];
    ui.open(box, { goal: GOAL, ask: function (verb, a) {
      asked.push([verb, a]);
      if (verb === 'stackFrameChecks.doors') return Promise.resolve({ doors: DOORS });
      if (verb === 'stackFrameChecks.run') return Promise.resolve({ queued: true, said: 'queued with deskVerify; its output is in the Verifier tab\'s console' });
      if (verb === 'stackFrameChecks.runState') return Promise.resolve(runState);
      return Promise.resolve({ id: GOAL + '.2', change: 9, items: [], more: false });
    }, onPublished: function (fn, server) { uiPublished.push({ fn: fn, server: String(server || '') }); return function () {}; },
      callDialog: function (app, params) { dialogs.push([app, params]); return new Promise(function () {}); } });
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

    test.subHeading('i. the door list, the add form, the door\'s dialog');
    const click = function (id, attrs) { box.fire('click', { target: { id: id || '', getAttribute: function (n) { return (attrs || {})[n] || null; } } }); };
    const typedAs = function (id, field, v) {
      doc.getElementById(id).value = v;
      box.fire('input', { target: { id: id, getAttribute: function (n) { return n === 'data-field' ? field : null; } } });
      return doc.getElementById(id + '-left').textContent;
    };
    const html2 = box.innerHTML;
    const atDoors = html2.indexOf('id="sfc-doors"');
    const atItems2 = html2.indexOf('id="sfc-items"');
    if (atDoors !== -1 && atItems2 > atDoors) test.check('the door list comes before the goal\'s items');
    else test.fail(OWED + 'the doors at ' + atDoors + ', the items at ' + atItems2);
    const rowsHtml = doorsEl.innerHTML;
    const opens = rowsHtml.match(/<button[^>]*data-open="[^"]+"[^>]*>/g) || [];
    if (opens.length === 2 && opens.every(function (b) { return /margin-right:1em/.test(b); }) && /data-open="d1"/.test(opens[0]) && /data-open="d2"/.test(opens[1])) test.check('each door row has one Open button, 1em after itself');
    else test.fail(OWED + 'the rows\' Open buttons: ' + short(opens));
    if ((rowsHtml.match(/<button/g) || []).length === 2) test.check('and no other button in the rows: the dialog holds the rest');
    else test.fail(OWED + 'the rows hold ' + (rowsHtml.match(/<button/g) || []).length + ' buttons');
    if (/green/.test(rowsHtml) && /12/.test(rowsHtml) && /never run/.test(rowsHtml) && /serverSurface\.js/.test(rowsHtml)) test.check('each row shows its suites and its last verdict (green, 12 calls; never run)');
    else test.fail(OWED + 'the rows show no last verdict: ' + short(rowsHtml));

    // The add form: paths and suites, each with its data-field, said as typed.
    const inputs2 = (box.innerHTML.match(/<input[^>]*>/g) || []);
    const pathsIn = inputs2.filter(function (i) { return /id="sfc-paths"/.test(i); })[0] || '';
    const suitesIn = inputs2.filter(function (i) { return /id="sfc-suites"/.test(i); })[0] || '';
    if (/data-field="paths"/.test(pathsIn) && /data-field="suites"/.test(suitesIn)) test.check('the add form has a paths and a suites input, data-field="paths" and data-field="suites"');
    else test.fail(OWED + 'the add form\'s inputs: ' + short(inputs2));
    // EACH INPUT IN ITS OWN FRAMED BLOCK (goal/G22.3). Andy, 2026-10-13: "input fields will look less crappy if arranged
    // in a block, that itself act's like an inline element". So each field is a block, display:inline-block with a
    // border and padding and its leading 1em: first its name and what goes in it in words, then the input.
    const blockOf = function (whole, pre, f) {
      const open = new RegExp('<div[^>]*data-block="' + pre + f + '"[^>]*>').exec(whole);
      if (!open) return null;
      const rest = whole.slice(open.index + open[0].length);
      const next = rest.search(/<div[^>]*data-block="/);
      return { open: open[0], body: next === -1 ? rest : rest.slice(0, next) };
    };
    const NAMES = { gate: 'Gate', endpoint: 'Endpoint', paths: 'Paths', suites: 'Suites' };
    const blocksRight = function (whole, pre) {
      return ['gate', 'endpoint', 'paths', 'suites'].filter(function (f) {
        const b = blockOf(whole, pre, f);
        if (!b) return true;
        const s = b.open;
        const atName = b.body.indexOf('<b>' + NAMES[f]);
        const atSays = b.body.indexOf('id="' + pre + f + '-says"');
        const atInput = b.body.search(new RegExp('<input[^>]*id="' + pre + f + '"'));
        const atLeft = b.body.indexOf('id="' + pre + f + '-left"');
        return !(/display:\s*inline-block/.test(s) && /border:/.test(s) && /padding:/.test(s) && /margin-top:\s*1em/.test(s) &&
          atName !== -1 && atSays > atName && atInput > atSays && atLeft > atInput);
      });
    };
    const addWrong = blocksRight(box.innerHTML, 'sfc-');
    if (!addWrong.length) test.check('the add form holds each of its four inputs in its own inline-block framed block: its name, what goes in it, then the input');
    else test.fail(OWED + 'the add form\'s blocks are not right for ' + short(addWrong) + ': ' + short(box.innerHTML));
    const emptySays = ['gate', 'endpoint', 'paths', 'suites'].filter(function (f) { return !doc.getElementById('sfc-' + f + '-says').textContent; });
    if (!emptySays.length) test.check('each empty field of the add form says in words what goes in it (gate: ' + doc.getElementById('sfc-gate-says').textContent + ')');
    else test.fail(OWED + 'the add form says nothing for ' + short(emptySays));
    typedAs('sfc-gate', 'gate', 'spirit/run/js/peerPost.js::post');
    typedAs('sfc-endpoint', 'endpoint', 'spirit/run/js/postQueue.js');
    let left2 = typedAs('sfc-suites', 'suites', 'serverSurface.js, ../hub.js');
    if (/\.\.\/hub\.js/.test(left2) && doc.getElementById('sfc-make').disabled === true) test.check('a suite that is no file name of spirit/test is said as typed (' + left2 + ') and Add is off');
    else test.fail(OWED + 'typed a bad suite: the note reads ' + short(left2) + ', Add disabled ' + doc.getElementById('sfc-make').disabled);
    typedAs('sfc-suites', 'suites', 'serverSurface.js, everyVerb.js');
    left2 = typedAs('sfc-endpoint', 'endpoint', 'node:http+https');
    if (doc.getElementById('sfc-make').disabled === true) test.check('a node: endpoint with no paths keeps Add off');
    else test.fail(OWED + 'a node: endpoint without paths left Add on');
    typedAs('sfc-paths', 'paths', '/api/relay/');
    if (doc.getElementById('sfc-make').disabled === false) test.check('with its paths Add is on');
    else test.fail(OWED + 'node: endpoint with paths: Add is still off, ' + short(doc.getElementById('sfc-paths-left').textContent));
    asked.length = 0;
    click('sfc-make');
    await sleep(20);
    const add = asked.filter(function (x) { return x[0] === 'stackFrameChecks.make'; })[0];
    if (add && add[1].endpoint === 'node:http+https' && JSON.stringify(add[1].paths) === '["/api/relay/"]' && JSON.stringify(add[1].suites) === '["serverSurface.js","everyVerb.js"]') test.check('Add sends make with the paths and the suites as lists');
    else test.fail(OWED + 'Add asked ' + short(asked));

    // THE DOOR'S DIALOG (goal/G27.2, D1): Open on a row opens the shell dialog shell/stackFrameCheckDetail with its id.
    click('', { 'data-open': 'd2' });
    await sleep(20);
    if (dialogs.some(function (d) { return d[0] === 'shell/stackFrameCheckDetail' && d[1] && d[1].id === 'd2'; })) test.check('Open on a row opens shell/stackFrameCheckDetail for d2');
    else test.fail(OWED + 'Open opened ' + short(dialogs));
    // The dialog app, mounted as the shell mounts it, its verbs answered as the plugin answers them.
    const ddoc = fakeDocument();
    const dwin = withShared(ddoc, { spiritFieldRules: require('../run/js/fieldRules.js') });
    let dApp = null;
    new Function('spirit', 'document', 'window', fs.readFileSync(DIALOG, 'utf8'))({ shell: { activateApp: function (x) { dApp = x; } }, core: kernel.core }, ddoc, dwin);
    const dAsked = [];
    const dPub = [];
    let closed = null;
    const dbox = fakeElement('dlg');
    dApp.mount(dbox, {
      escapeHtml: kernel.core.util.escapeHtml,
      verb: function (name, body) {
        const q = body && body.ask && body.ask.desk;
        const v = q && Object.keys(q)[0];
        dAsked.push([v, q && q[v]]);
        let out = { change: 1 };
        if (v === 'stackFrameChecks.doors') out = { doors: DOORS };
        if (v === 'stackFrameChecks.run') out = { started: true, already: false, said: 'Door d2 is running now, here; its verdict shows when it lands, and goes to deskVerify as a record.' };
        if (v === 'stackFrameChecks.runState') out = runState;
        if (v === 'item.chat') out = { chat: [], chatMore: false };
        return Promise.resolve({ status: 200, body: out });
      },
      onPublished: function (fn, server) { dPub.push({ fn: fn, server: String(server || '') }); return function () {}; },
      closeDialog: function (r) { closed = r || {}; }, armUntilElsewhere: function () {}, setDialogResult: function () {}, setScreenTitle: function () {},
    });
    await dApp.open({ id: 'd2' });
    await sleep(20);
    const dclick = function (id) { dbox.fire('click', { target: { id: id, getAttribute: function () { return null; } } }); };
    const dTyped = function (id, field, v) {
      ddoc.getElementById(id).value = v;
      dbox.fire('input', { target: { id: id, getAttribute: function (n) { return n === 'data-field' ? field : null; } } });
      return ddoc.getElementById(id + '-left').textContent;
    };
    const dHtml = dbox.innerHTML;
    const dInputs = dHtml.match(/<input[^>]*>/g) || [];
    const val = function (id) { return ddoc.getElementById(id).value; };
    if (/data-field="gate"/.test(dInputs.join('')) && /data-field="suites"/.test(dInputs.join('')) && val('sfcd-gate') === DOORS[1].gate && val('sfcd-endpoint') === DOORS[1].endpoint && val('sfcd-paths') === '/api/relay/') {
      test.check('the dialog holds the door\'s values in inputs carrying data-field');
    } else test.fail(OWED + 'the dialog after open: ' + short(dHtml) + ', gate ' + short(val('sfcd-gate')));
    const dWrong = blocksRight(dHtml, 'sfcd-');
    if (!dWrong.length) test.check('the dialog holds each of its four inputs in its own inline-block framed block: its name, what goes in it, then the input');
    else test.fail(OWED + 'the dialog\'s blocks are not right for ' + short(dWrong) + ': ' + short(dHtml));
    const dSays = function (f) { return ddoc.getElementById('sfcd-' + f + '-says').textContent; };
    if (dSays('endpoint') === 'Node\'s own network calls: http, https, fetch') test.check('the dialog\'s filled endpoint reads what it means: ' + dSays('endpoint'));
    else test.fail(OWED + 'the dialog\'s endpoint node:http+https+fetch reads ' + short(dSays('endpoint')));
    dTyped('sfcd-gate', 'gate', 'spirit/run/js/peerPost.js::createPeerPost');
    if (dSays('gate') === 'one function, createPeerPost, in spirit/run/js/peerPost.js') test.check('the dialog\'s gate block reads what its value means, as typed: ' + dSays('gate'));
    else test.fail(OWED + 'the dialog\'s gate spirit/run/js/peerPost.js::createPeerPost reads ' + short(dSays('gate')));
    dTyped('sfcd-gate', 'gate', DOORS[1].gate);
    const dButtons = ['sfcd-run', 'sfcd-save', 'sfcd-remove'].map(function (id) { return (new RegExp('<button[^>]*id="' + id + '"[^>]*>').exec(dHtml) || [''])[0]; });
    if (dButtons.every(function (b) { return b && /margin-right:1em/.test(b); }) && /margin-top:1em/.test((/<div[^>]*>/.exec(dHtml) || [''])[0])) test.check('the dialog has Run, Save and Remove, each 1em after itself, in a block with its leading 1em');
    else test.fail(OWED + 'the dialog\'s buttons: ' + short(dButtons));
    if (!/id="sfcd-stop"/.test(dHtml)) test.check('and no Stop of its own');
    else test.fail(OWED + 'the dialog has a Stop');
    if (dAsked.some(function (x) { return x[0] === 'stackFrameChecks.runState' && x[1].id === 'd2'; })) test.check('opening it reads the door\'s runState');
    else test.fail(OWED + 'open asked ' + short(dAsked));
    if (dAsked.some(function (x) { return x[0] === 'item.chat' && x[1].id === DOORS[1].item; })) test.check('its chat reads the chat of the door\'s item, ' + DOORS[1].item);
    else test.fail(OWED + 'its chat asked ' + short(dAsked.filter(function (x) { return x[0] === 'item.chat'; })));

    // Edit in the dialog, said as typed, saved through update.
    let dl = dTyped('sfcd-gate', 'gate', 'spirit/run/js/peerPost.js');
    if (/cheating/.test(dl) && ddoc.getElementById('sfcd-save').disabled === true) test.check('the dialog\'s gate is checked as typed (' + dl + ') and Save is off');
    else test.fail(OWED + 'typed a whole module in the dialog: ' + short(dl) + ', Save disabled ' + ddoc.getElementById('sfcd-save').disabled);
    dTyped('sfcd-gate', 'gate', 'spirit/run/js/peerPost.js::onRequest');
    dTyped('sfcd-suites', 'suites', 'agentOnboard.js,serverSurface.js');
    dAsked.length = 0;
    dclick('sfcd-save');
    await sleep(20);
    const up = dAsked.filter(function (x) { return x[0] === 'stackFrameChecks.update'; })[0];
    if (up && up[1].id === 'd2' && up[1].gate === 'spirit/run/js/peerPost.js::onRequest' && up[1].endpoint === 'node:http+https+fetch' && JSON.stringify(up[1].paths) === '["/api/relay/"]' && JSON.stringify(up[1].suites) === '["agentOnboard.js","serverSurface.js"]') test.check('Save sends update {id, gate, endpoint, paths, suites}');
    else test.fail(OWED + 'Save asked ' + short(dAsked));

    // Run: started here, said so; running and elapsed, then the verdict and each path, on the plugin's publish.
    dAsked.length = 0;
    dclick('sfcd-run');
    await sleep(30);
    if (dAsked.some(function (x) { return x[0] === 'stackFrameChecks.run' && x[1].id === 'd2'; })) test.check('Run sends run {id}');
    else test.fail(OWED + 'Run asked ' + short(dAsked));
    const runNote = ddoc.getElementById('sfcd-note').textContent;
    if (/running now/.test(runNote) && !/Verifier/.test(runNote)) test.check('the dialog says the run is under way here: ' + runNote);
    else test.fail(OWED + 'after Run the dialog\'s note reads ' + short(runNote));
    const runEl = ddoc.getElementById('sfcd-state');
    if (/running/.test(runEl.innerHTML) && /\d+ s/.test(runEl.innerHTML)) test.check('the dialog shows the run under way and its elapsed time: ' + short(runEl.innerHTML));
    else test.fail(OWED + 'while running the dialog shows ' + short(runEl.innerHTML));
    runState = { id: 'd2', running: false, startedAt: new Date(Date.now() - 9000).toISOString(), endedAt: new Date().toISOString(), stopped: false,
      verdict: { ran: true, green: false, around: 2, of: 7, paths: ['POST /api/relay/post from spirit/run/js/hub.js:5:post', 'GET /api/relay/key from spirit/run/js/offboard.js:9:main'], why: '' } };
    const fromDesk = dPub.filter(function (x) { return x.server === 'desk'; });
    fromDesk.forEach(function (x) { x.fn({ plugin: 'stackFrameChecks', data: { what: 'run', id: 'd2' } }); });
    await sleep(30);
    const vHtml = runEl.innerHTML;
    const pathLines = vHtml.match(/<div class="sfc-path"[^>]*>[^<]*<\/div>/g) || [];
    if (fromDesk.length && /2 path\(s\) around the gate, of 7/.test(vHtml) && pathLines.length === 2 && /hub\.js:5:post/.test(pathLines[0]) && /offboard\.js:9:main/.test(pathLines[1])) test.check('the plugin\'s publish of the run\'s end shows the verdict and each path around the gate on its own line');
    else test.fail(OWED + 'after the run the dialog shows ' + short(vHtml));
    asked.length = 0;
    uiPublished.forEach(function (x) { x.fn({ plugin: 'stackFrameChecks', data: { what: 'run', id: 'd2' } }); });
    await sleep(20);
    if (asked.some(function (x) { return x[0] === 'stackFrameChecks.doors'; })) test.check('and the pane reads the door list again, so its row shows the new verdict');
    else test.fail(OWED + 'a published run did not read the doors again');
    if (uiPublished.every(function (x) { return x.server !== 'deskVerify'; })) test.check('the pane subscribes to no deskVerify stream');
    else test.fail(OWED + 'the pane subscribed to ' + short(uiPublished.map(function (x) { return x.server; })));

    // Remove, from the dialog alone (D7): armed by the first press, sent by the second, and the dialog closes.
    dAsked.length = 0;
    dclick('sfcd-remove');
    await sleep(20);
    const armedText = ddoc.getElementById('sfcd-remove').textContent;
    if (!dAsked.some(function (x) { return x[0] === 'stackFrameChecks.remove'; }) && /sure/.test(armedText)) test.check('Remove\'s first press only arms it: ' + armedText);
    else test.fail(OWED + 'Remove\'s first press asked ' + short(dAsked) + ', the button reads ' + short(armedText));
    dclick('sfcd-remove');
    await sleep(20);
    if (dAsked.some(function (x) { return x[0] === 'stackFrameChecks.remove' && x[1].id === 'd2'; }) && closed) test.check('its second press sends remove {id}, and the dialog closes');
    else test.fail(OWED + 'Remove asked ' + short(dAsked) + ', closed ' + short(closed));
  } catch (e) { test.fail(OWED + 'the private UI: ' + (e && e.message)); }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
