'use strict';

// goal/G8.12: the live verifier tab, with the watcher fix and the BOARD.md removal folded in. Red on today's tree;
// claude-windows wrote it from G8.12's box and does not build it.
//   Andy, 2026-10-09: "it should refresh by itself", "the new tab in desk should listen to real events from verifier,
//   and what now is displayed as a log.. should be an updated status message underneath a progress bar, so i can see
//   what verifier is testing, if it's on a full run, and for that run a progress bar, with running status messages one
//   line at the time...", "and after all is done, it should count down idle time", "why can't you fold things into
//   items where it's convenient to do it in one go?", and "get rid of that damn BOARD.md".
//
// WHAT IS TRUE TODAY (read at fec1be3e): the tab asks deskVerify `now` when opened and draws records as a list; nothing
// is published; the watcher starts a read every watchMs without waiting for the last (one word gave four passes on his
// node); runAll rewrites BOARD.md at the end of every full run.
//
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.12 for him to overrule:
//   1 THE WATCHER went with goal/G33.3: deskVerify reads nothing of the desk; a run is handed to it (run {suites,
//     commit}), so its section here went too.
//   2 PUBLISH: deskVerify publishes (spirit.core.jobs.publish) one plain object every time its run changes:
//       {doing: 'run' | 'idle', suite, index, of, tests, expected, line, since}
//     index/of: which suite of how many; tests: assertions the running suite has printed so far; expected: how many
//     tests that suite had in the dataset last time (0 when never seen); line: one status sentence. When the run ends
//     it publishes doing 'idle', its since being when the last run was handed to it - what the countdown counts from.
//   3 THE FACE: the tab subscribes with api.onPublished(fn, 'deskVerify') and repaints from each object: a progress bar
//     and ONE status line under it, replaced by each event, never appended; idle, a countdown to idle time.
//   4 BOARD.md: runAll no longer writes it.
// NOT ASSERTED: layout, colours, the exact words of the line, the countdown's format beyond minutes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.12: ';
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const RUNALL = path.join(__dirname, 'runAll.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyLiveTestOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const SLOW = 'zzLiveA.js';
const FAST = 'zzLiveB.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G8.12: the live verifier tab, what deskVerify publishes as it runs, and no BOARD.md');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifylive-'));

// A node that runs a desk, answers item.get with each item's test files, takes the job's reports (what
// appServer.publish sends) and keeps every desk call. (Its pages of the desk's `changes` went with goal/G33.4: the verb
// is gone, and deskVerify never asked it.)
function fakeNode(opts) {
  return new Promise(function (resolve) {
    const st = { asks: [], published: [], files: opts.files };
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', async function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) st.published.push(j.app); out = { ok: true }; }
        else if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          const a = flatCall.desk[verb] || {};
          {
            st.asks.push({ verb: verb, args: a });
            if (verb === 'item.files') out = { files: (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: (st.files[a.id] || []).map(function (f) { return { path: 'spirit/test/' + f, by: 'claude-windows', core: false }; }) }) || {}).files ? (({ id: a.id, goal: 'goal/G100', code: true, go: true, files: (st.files[a.id] || []).map(function (f) { return { path: 'spirit/test/' + f, by: 'claude-windows', core: false }; }) }).files || []).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }) : [], filesMore: false }; // goal/G32.2: the file list is its own answer
            else if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'goal/G100', code: true, go: true, files: (st.files[a.id] || []).map(function (f) { return { path: 'spirit/test/' + f, by: 'claude-windows', core: false }; }) }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () {
      st.port = s.address().port;
      st.close = function () { s.close(); };
      resolve(st);
    });
  });
}

function startVerify(name, node, values) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'verify-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' });
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify(Object.assign({ db: path.join(root, 'verify.db') }, values)), '--pipe', pipe, '--state', state], { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

async function publishHalf() {
  test.subHeading('1. deskVerify publishes its run as it goes');
  const node = await fakeNode({ files: { 'goal/G100.1': [SLOW, FAST] } });
  // Since goal/G33.3 a run is handed to deskVerify with run {suites, commit}. No pull: the suite's own probes make the
  // tree dirty.
  const v = startVerify('publish', node, { suiteMs: 60000, pull: '' });
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    for (const t of ['a', 'b', 'c']) await v.call('record', { suite: SLOW, title: t, outcome: 'green' });
    await sleep(800);
    await v.call('run', { suites: ['spirit/test/' + SLOW, 'spirit/test/' + FAST], commit: '' });
    await sleep(300);
    for (let i = 0; i < 150 && ((await v.call('now')).body || {}).busy !== false; i++) await sleep(200);
    await sleep(500);
    const p = node.published.filter(function (o) { return o && typeof o === 'object' && o.doing; });
    const first = p.filter(function (o) { return o.doing === 'run' && /zzLiveA\.js/.test(String(o.suite)); });
    if (first.length && first[0].index === 1 && first[0].of === 2 && first[0].expected === 3) test.check('it publishes the run, suite 1 of 2, and the 3 tests that suite had last time');
    else test.fail(OWED + 'published: ' + short(p.slice(0, 3)));
    const counts = first.map(function (o) { return o.tests; }).filter(function (n) { return typeof n === 'number'; });
    if (counts.length >= 2 && Math.max.apply(null, counts) >= 2 && counts.every(function (n, i) { return !i || n >= counts[i - 1]; })) test.check('and again as its tests report, the count rising');
    else test.fail(OWED + 'tests counts published for zzLiveA.js: ' + short(counts));
    if (p.some(function (o) { return o.doing === 'run' && o.index === 2 && /zzLiveB\.js/.test(String(o.suite)); })) test.check('then suite 2 of 2');
    else test.fail(OWED + 'no publish for suite 2: ' + short(p.map(function (o) { return [o.doing, o.index, o.suite]; })));
    if (p.length && p.every(function (o) { return typeof o.line === 'string' && o.line.length; })) test.check('every object carries one status line');
    else test.fail(OWED + 'objects without a line: ' + short(p.filter(function (o) { return !o.line; }).slice(0, 2)));
    const last = p[p.length - 1] || {};
    if (last.doing === 'idle') test.check('and when the run ends it publishes idle');
    else test.fail(OWED + 'the last object published was ' + short(last));
  } finally { await v.stop(); node.close(); }
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

async function faceHalf() {
  test.subHeading('2. the tab listens and repaints: a bar, one line, an idle countdown');
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'goal/G100', title: 'Live', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = {
    now: function () { return { busy: false, running: { suite: '', since: '' }, stopAsked: false }; },
    // A record the tab must NOT show (Andy: "i want that damn log display gone. and only show the latest status.").
    'records.search': function () { return { items: [{ key: '1', label: JSON.stringify({ suite: 'zzLogRow.js', title: 'a logged title', outcome: 'red', commit: 'abc1234', at: new Date().toISOString() }) }], more: false }; },
    stop: function () { return { stopped: false }; },
  };
  const handlers = {};
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, server) { (handlers[server || 'desk'] = handlers[server || 'desk'] || []).push(fn); },
    onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled(); await sleep(50); await settled();
  if ((handlers.deskVerify || []).length) test.check('the page subscribes to what deskVerify publishes');
  else { test.fail(OWED + 'no onPublished(fn, "deskVerify"): subscribed to ' + short(Object.keys(handlers))); return; }
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled();
  const send = async function (o) { handlers.deskVerify.forEach(function (fn) { fn(o); }); await settled(); };
  const body = doc.getElementById('desk-verifier');
  // Before anything is published the bar is already there, gray, so the layout shows.
  if (/(<progress|role="progressbar")[^>]*data-phase="done"|data-phase="done"[^>]*(<progress|role="progressbar")/.test(body.innerHTML) || /<progress[^>]*data-phase="done"/.test(body.innerHTML)) test.check('with nothing published yet the bar is drawn, gray');
  else test.fail(OWED + 'before any publish the tab reads ' + short(body.innerHTML));
  const at = new Date().toISOString();
  await send({ doing: 'run', suite: 'spirit/test/zzLiveA.js', index: 1, of: 2, tests: 1, expected: 3, line: 'first status line', since: at });
  await send({ doing: 'run', suite: 'spirit/test/zzLiveA.js', index: 1, of: 2, tests: 2, expected: 3, line: 'second status line', since: at });
  const b = body.innerHTML;
  if (/<progress|role="progressbar"/.test(b)) test.check('a progress bar');
  else test.fail(OWED + '#desk-verifier has no progress bar: ' + short(b));
  if (/second status line/.test(b) && !/first status line/.test(b)) test.check('and one status line, replaced by each event, never appended');
  else test.fail(OWED + 'the status lines in #desk-verifier: ' + short(b));
  if (/zzLiveA\.js/.test(b) && /suite 1 of 2/.test(b)) test.check('it says what it is testing: the suite, 1 of 2');
  else test.fail(OWED + 'no item or suite in #desk-verifier: ' + short(b));
  // GROWN AFTER HIS LOOK (claude-windows): "i want that damn log display gone. and only show the latest status."
  if (!/zzLogRow\.js|a logged title|Records, newest first/.test(b)) test.check('no records list: the log display is gone');
  else test.fail(OWED + 'the tab still draws the records list: ' + short(b.slice(b.indexOf('Records'))));
  if (!fake.calls.some(function (c) { return c.server === 'deskVerify' && c.verb === 'records.search'; })) test.check('and the tab asks for no records at all');
  else test.fail(OWED + 'the tab asked deskVerify records.search');
  // GROWN AFTER HIS LOOK (claude-windows). Andy: "just gray out the progress bar so i can see the layout, and the
  // progress bar can show the countdown live, and only go gray when that's done. but the progress bar stays visible."
  // So ONE bar, always drawn, its phase readable as data-phase: run (a check running), countdown (idle, the hour not
  // yet over), done (the hour over, or nothing known yet): gray.
  const barOf = function (html) { const m = /<progress[^>]*>|<[^>]*role="progressbar"[^>]*>/.exec(html); return m ? m[0] : ''; };
  if (/data-phase="run"/.test(barOf(b))) test.check('during a run the bar says so: data-phase="run"');
  else test.fail(OWED + 'the bar during a run reads ' + short(barOf(b) || '(no bar)'));
  // SINCE goal/G33.6 the countdown shows only on a verifier with chores (hasChores), and idle the bar stands grey: idle is
  // no run (Andy: "The desk verifier still thinks 'idling' is a run").
  await send({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 18 * 60 * 1000).toISOString(), hasChores: true });
  const idle = body.innerHTML;
  if (/4[12]\s*min/.test(idle)) test.check('idle, it counts down to idle time: about 42 minutes left of the hour');
  else test.fail(OWED + 'no countdown when idle: ' + short(idle));
  const cd = barOf(idle);
  if (/data-phase="done"/.test(cd) && /value="0"/.test(cd)) test.check('and the bar stands grey and empty while it counts: idle is no run');
  else test.fail(OWED + 'the bar while counting down reads ' + short(cd || '(no bar)'));
  await send({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });
  const over = barOf(body.innerHTML);
  if (/data-phase="done"/.test(over)) test.check('once the hour is over the bar stays, gray: phase done');
  else test.fail(OWED + 'after the hour the bar reads ' + short(over || '(no bar)'));
}

function boardHalf() {
  test.subHeading('3. no BOARD.md');
  const src = fs.readFileSync(RUNALL, 'utf8');
  if (src.indexOf('BOARD.md') === -1) test.check('runAll no longer writes BOARD.md');
  else test.fail(OWED + 'runAll.js still names BOARD.md ' + (src.split('BOARD.md').length - 1) + ' time(s)');
}

(async function () {
  fs.writeFileSync(path.join(__dirname, SLOW), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('live probe A');\nlet i = 0;\nconst t = setInterval(function () { test.check(['a', 'b', 'c'][i]); i++; if (i === 3) { clearInterval(t); test.reportSuccessFailureCount(); process.exit(0); } }, 700);\n");
  fs.writeFileSync(path.join(__dirname, FAST), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('live probe B');\ntest.check('fast');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  await publishHalf();
  await faceHalf();
  boardHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  for (const f of [SLOW, FAST]) { try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) { /* gone */ } }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
