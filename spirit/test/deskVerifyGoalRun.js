'use strict';

// goal/G14.3: the verifier runs by itself only for items and for a goal; the full harness is his button alone.
// Red on today's tree; claude-windows wrote it from G14.3's box (version 7).
//   Andy, 2026-10-12, the box: "the verifier must run only automatically for items and for a goal.", "only the desk
//   user can run the full harness using a [run the full harness button] (armable) in the verifier tab.", and "the
//   Buttons in the verifier then read: [run the full harness button] [stop the run][re- run:.....]".
//   Q1, "re-run:" names the item as today's "Verify <item> again": "yes." Q2, when a goal empties the verifier runs
//   only the suites of its items, the full harness being his button alone: "yes." And "[Verify <item> again] can be
//   left alone."
//
// WHAT IS TRUE TODAY (read at c084d78c): goal.emptied starts fullRun, which runs every suite in spirit/test - the
// hour; no verb starts the full harness by hand; the tab's Stop is disabled unless the run carries an item id, and a
// full run carries none, so Stop could never be pressed during the longest run there is; and the `stopped` flag is
// cleared only by an item check, so a full run stopped by hand leaves the next full run stopped at its first suite.
//
// THE SHAPE ASSERTED:
//   deskVerify: goal.emptied runs the test files on the file lists of the goal's items (done and closed ones too, they
//   are the goal's work), one line in the goal chat, verify.pass on the goal; no tolerated-reds grant, since every
//   suite it ran is the goal's own. A new verb of deskVerify's own, full.run {id} (the goal whose chat takes the
//   report), queues a run of every suite in its folder: one report line, and no pass and no grant - it brings no Done.
//   `now` names the suite during a full run, stop ends it, and the next run is not stopped by it.
//   The face: a "Run the full harness" button (#desk-verify-full) in the verifier tab, armed by the first click and
//   sent by the second as full.run on the current goal; Stop is pressable whenever something runs.
// NOT ASSERTED: the report line's words beyond the suite it names, layout and colours.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.3: ';
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const PROBES = path.join(__dirname, 'zzGoalProbes');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyGoalRunOwnerAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G14.3: the verifier runs a goal\'s suites by itself, the full harness only by his button');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifygoalrun-'));

async function serverHalf() {
  test.subHeading('1. deskVerify: an emptied goal runs its own suites; full.run runs them all, stoppable');
  fs.mkdirSync(PROBES, { recursive: true });
  const MARK = path.join(scratch, 'ran-out');
  fs.writeFileSync(path.join(PROBES, 'zzGoalIn.js'), "'use strict';\nconst test = require('../testSupport.js');\ntest.startTest('goal probe in');\ntest.check('in');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  fs.writeFileSync(path.join(PROBES, 'zzGoalOut.js'), "'use strict';\nrequire('fs').writeFileSync(" + JSON.stringify(MARK) + ", 'x');\nconst test = require('../testSupport.js');\ntest.startTest('goal probe out');\ntest.fail('out');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  fs.writeFileSync(path.join(PROBES, 'zzGoalSlow.js'), "'use strict';\nconst test = require('../testSupport.js');\ntest.startTest('goal probe slow');\nsetTimeout(function () { test.check('slow'); test.reportSuccessFailureCount(); process.exit(0); }, 4000);\n");
  const asks = []; const published = []; const records = [];
  const items = [
    { id: 'fe/G1', goal: '', status: 'goal run started', go: false, files: [] },
    { id: 'fe/G1.1', goal: 'fe/G1', status: 'done', go: true, files: [{ path: 'spirit/test/zzGoalProbes/zzGoalIn.js', by: 'claude-windows', core: false }] },
  ];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) published.push(j.app); out = { ok: true }; }
        else if (j && j.ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          const a = j.ask.desk[verb] || {};
          if (verb === 'changes') {
            const from = Number(a.n) || 0;
            const rest = records.filter(function (r) { return r.n > from; });
            out = { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
          } else {
            asks.push({ verb: verb, args: a });
            if (verb === 'items.search') out = { items: items.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
            else if (verb === 'item.get') out = { item: JSON.stringify(items.filter(function (i) { return i.id === a.id; })[0] || null), version: 1, change: 1 };
            else if (verb === 'item.checks') out = { checks: [] };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'desk', key: '', body: JSON.stringify(body) }); };
  const root = path.join(scratch, 'verify');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'verify-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' });
  const values = { db: path.join(root, 'verify.db'), watchMs: 300, suiteMs: 60000, suites: 'spirit/test/zzGoalProbes' };
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify(values), '--pipe', pipe, '--state', state], { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  const said = function (verb, id) { return asks.filter(function (x) { return x.verb === verb && (!id || x.args.id === id); }); };
  const lines = function () { return said('chat.add', 'fe/G1').map(function (x) { return String(x.args.text); }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(800);

    // THE GOAL RUN (Q2): the suites on its items' lists, and nothing else.
    rec('goal.emptied', { id: 'fe/G1' });
    await waitFor(function () { return said('verify.pass', 'fe/G1').length > 0; }, 20000);
    // Since goal/G21.3 a run publishes its pull first, before any suite, so an object with no suite named is not a suite.
    const ranSuites = published.filter(function (o) { return o && o.doing && o.doing !== 'idle' && o.suite; }).map(function (o) { return String(o.suite); });
    if (!fs.existsSync(MARK) && ranSuites.length && ranSuites.every(function (s) { return /zzGoalIn\.js$/.test(s); })) test.check('an emptied goal runs the suites on its items\' lists only, never the whole folder');
    else test.fail(OWED + 'the emptied goal ran ' + short(ranSuites) + (fs.existsSync(MARK) ? ', zzGoalOut.js among them' : ''));
    if (lines().length === 1 && said('verify.pass', 'fe/G1').length === 1) test.check('one report line in the goal chat, and the goal its verify.pass');
    else test.fail(OWED + 'goal chat ' + short(lines()) + ', passes ' + said('verify.pass', 'fe/G1').length);
    if (!said('check.add').length) test.check('no tolerated-reds grant: every suite it ran is the goal\'s own');
    else test.fail(OWED + 'check.add asked ' + short(said('check.add')));

    // HIS BUTTON (box point 2): the full harness, by hand only, bringing no Done.
    const full = await call('full.run', { id: 'fe/G1' });
    if (took(full)) test.check('full.run is a verb of deskVerify\'s and takes the run');
    else test.fail(OWED + 'full.run answered ' + full.status + ' ' + short(full.body));
    await waitFor(function () { return lines().length >= 2; }, 30000);
    const report = lines()[1] || '';
    if (fs.existsSync(MARK) && /zzGoalOut\.js/.test(report)) test.check('full.run runs every suite of the folder and names the red one in the goal chat');
    else test.fail(OWED + 'after full.run: out ran ' + fs.existsSync(MARK) + ', goal chat ' + short(lines()));
    if (said('verify.pass', 'fe/G1').length === 1 && !said('check.add').length) test.check('and it brings no Done: no verify.pass, no grant');
    else test.fail(OWED + 'after full.run: passes ' + said('verify.pass', 'fe/G1').length + ', checks ' + short(said('check.add')));

    // STOP DURING A FULL RUN (box point 3).
    await call('full.run', { id: 'fe/G1' });
    const atSlow = function () { const p = published[published.length - 1]; return !!(p && /zzGoalSlow\.js$/.test(String(p.suite)) && p.doing !== 'idle'); };
    await waitFor(atSlow, 20000);
    const busy = await call('now');
    const r = busy.body && busy.body.running;
    if (took(busy) && r && /zzGoalSlow\.js/.test(String(r.suite))) test.check('now names the suite a full run is on, so the tab can offer Stop');
    else test.fail(OWED + 'now during a full run answered ' + short(busy.body));
    const stop = await call('stop');
    await waitFor(function () { return lines().length >= 3; }, 3000);
    if (took(stop) && stop.body.stopped === true && /stop/i.test(lines()[2] || '')) test.check('stop ends a full run at once, and its line says it was stopped');
    else test.fail(OWED + 'stop answered ' + short(stop.body) + '; goal chat ' + short(lines()));
    await call('full.run', { id: 'fe/G1' });
    await waitFor(function () { return lines().length >= 4; }, 30000);
    if (lines().length >= 4 && !/stop/i.test(lines()[3])) test.check('and the next full run is not stopped by the last one\'s Stop');
    else test.fail(OWED + 'the run after a Stop reported ' + short(lines()[3]));
  } finally {
    await new Promise(function (res) { kid.once('exit', res); kid.kill(); setTimeout(res, 3000); });
    node.close();
    try { fs.rmSync(PROBES, { recursive: true, force: true }); } catch (e) { /* gone */ }
  }
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
async function mount(fake) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const container = fakeElement('container');
  behavior.mount(container, {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  return doc;
}

async function faceHalf() {
  test.subHeading('2. the face: [Run the full harness], armable; Stop pressable during a full run');
  const goal = { id: 'tg/G1', title: 'Tab', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };
  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  const at = new Date().toISOString();
  fake.verifier = {
    now: function () { return { running: { id: '', suite: 'spirit/test/zzFullRunning.js', since: at }, queued: [] }; },
    stop: function () { return { stopped: true }; },
    'full.run': function () { return { queued: true }; },
  };
  const doc = await mount(fake);
  const tabs = doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(50); await settled();
  const body = doc.getElementById('desk-verifier');
  const b = body.innerHTML;
  const fullAt = b.indexOf('id="desk-verify-full"');
  const stopAt = b.indexOf('id="desk-verify-stop"');
  if (fullAt !== -1 && stopAt !== -1 && fullAt < stopAt) test.check('the tab offers [Run the full harness] before [Stop the run]');
  else test.fail(OWED + '#desk-verifier reads ' + short(b));
  const stopTag = (/<button[^>]*id="desk-verify-stop"[^>]*>/.exec(b) || [''])[0];
  if (stopTag && !/disabled/.test(stopTag)) test.check('during a full run, which carries no item, Stop can be pressed');
  else test.fail(OWED + 'Stop during a full run: ' + short(stopTag || b));

  const before = fake.calls.length;
  body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
  await settled();
  const first = fake.calls.slice(before).filter(function (c) { return c.server === 'deskVerify' && c.verb === 'full.run'; });
  const armedHtml = body.innerHTML;
  if (!first.length && /id="desk-verify-full"[^>]*data-armed="1"/.test(armedHtml)) test.check('the first click arms it and runs nothing');
  else test.fail(OWED + 'after one click: calls ' + short(first) + ', button ' + short((/<button[^>]*id="desk-verify-full"[^>]*>[^<]*/.exec(armedHtml) || [''])[0]));
  body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
  await settled();
  const sent = fake.calls.slice(before).filter(function (c) { return c.server === 'deskVerify' && c.verb === 'full.run'; });
  if (sent.length === 1 && sent[0].args && sent[0].args.id === 'tg/G1') test.check('the second click asks deskVerify full.run on the current goal');
  else test.fail(OWED + 'after two clicks: ' + short(sent));
}

(async function () {
  await serverHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(PROBES, { recursive: true, force: true }); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
