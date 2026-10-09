'use strict';

// goal/G8.12, folded in: the full run when the goal empties. Red on today's tree; claude-windows wrote it from G8.12's
// box and does not build it.
//   Andy, 2026-10-09: "why, the run-all should be triggered by: \"no items left in the goal\", by the desk itself.",
//   "will this be fixed now or not?", and "i did not say: \"add an item\", add it to this one." Ruled before in
//   goal/G8.3's box: "When the last item of the goal closes, every copy starts its full run". And on goal/G8.7, that the
//   full run reports to the goal chat and sends deskVerify its results: "both".
//
// WHAT IS TRUE TODAY (read at c74a915e): nothing starts a full run; a goal offers Done as soon as its last item is done
// or closed and no grant is open.
//
// THE SHAPE ASSERTED, the red writer's reading, posted under goal/G8.12 for him to overrule:
//   THE DESK: when the last open item of a goal becomes done or closed, it writes ONE record, verb goal.emptied
//   {id: <goal>}. Where a deskVerify runs on its node (the G8.3 test), the goal's Done then waits for deskVerify's own
//   verify.pass on the GOAL id - the box's default, "the goal's Done waits until that pass has come back".
//   deskVerify: its watcher takes goal.emptied and runs every suite in its suites folder (the manifest value
//   `suites`, default spirit/test; a suite hands a folder of two probes), one at a time, publishing doing 'full' with
//   index/of as it goes; then it posts ONE report line in the goal's chat naming the reds, asks goal.check (so the reds
//   outside the goal become the G8.7 grant), and asks verify.pass on the goal. One pass per goal: a second goal.emptied
//   for the same goal runs nothing.
// NOT ASSERTED: the report line's exact words, and what a full run does when a suite hangs (the time limit already
// covers it).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.12 (full run): ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const PROBES = path.join(__dirname, 'zzFullProbes');
const CW = { key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

test.startTest('goal/G8.12: the full run when the goal empties');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyfull-'));

function apiNode(apps) {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        const out = j && j.ask === 'api' ? apps : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

function server(script, name, args, root) {
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const env = Object.assign({}, process.env, args.env || {});
  const kid = spawn(process.execPath, [script, JSON.stringify(args.values || {}), '--pipe', pipe, '--state', state], { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  return {
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    call: function (verb, a, caller) { const q = {}; q[verb] = a || {}; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

async function deskHalf() {
  test.subHeading('1. the desk: one goal.emptied when the last item goes, and the goal Done waits for deskVerify');
  const node = await apiNode({ desk: {}, deskVerify: {} });
  const root = path.join(scratch, 'desk');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const d = server(DESK, 'desk', {}, root);
  try {
    if (!await d.up()) { test.fail('the desk server did not start'); return; }
    await sleep(500);
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'fe/G1', title: 'Empties' }, items: [{ id: 'fe/G1.1', title: 'One', blocks: ['fe/G1'] }, { id: 'fe/G1.2', title: 'Two', blocks: ['fe/G1'] }] }) }, CW);
    await d.call('press', { id: 'fe/G1', what: 'end-design' }, ANDY);
    const emptied = async function () {
      const ch = (await d.call('changes', { n: 0, line: 0 }, ANDY)).body || {};
      return (ch.records || []).filter(function (r) { return r.verb === 'goal.emptied'; });
    };
    await d.call('press', { id: 'fe/G1.1', what: 'go' }, ANDY);
    await d.call('press', { id: 'fe/G1.1', what: 'claim-done' }, CW);
    await d.call('press', { id: 'fe/G1.1', what: 'done' }, ANDY);
    if (!(await emptied()).length) test.check('one item still open: no goal.emptied yet');
    else test.fail(OWED + 'goal.emptied written with an item open');
    await d.call('press', { id: 'fe/G1.2', what: 'close' }, ANDY);
    const e = await emptied();
    if (e.length === 1 && (parse(e[0].body) || {}).id === 'fe/G1') test.check('the last item closed: one goal.emptied record naming the goal');
    else test.fail(OWED + 'goal.emptied records: ' + short(e));
    const g = parse((await d.call('item.get', { id: 'fe/G1' }, ANDY)).body.item) || {};
    if ((g.buttons || []).indexOf('done') === -1) test.check('with a deskVerify on the node, the goal offers no Done before its pass');
    else test.fail(OWED + 'the goal offers Done before deskVerify has spoken: ' + short(g.buttons));
    // GROWN AFTER HIS WORD (claude-windows). Andy: "the desk should update status in every change it manages....", and
    // "yes" to its being the status word on the List rows.
    if (/full run/i.test(String(g.status))) test.check('the desk writes the goal\'s status itself: the full run is running');
    else test.fail(OWED + 'the emptied goal\'s status reads ' + short(g.status));
    const pass = await d.call('verify.pass', { id: 'fe/G1' }, ANDY);
    const g2 = parse((await d.call('item.get', { id: 'fe/G1' }, ANDY)).body.item) || {};
    if (took(pass) && (g2.buttons || []).indexOf('done') !== -1) test.check('deskVerify\'s verify.pass on the goal brings its Done');
    else test.fail(OWED + 'verify.pass on the goal answered ' + pass.status + ' ' + short(pass.body) + '; buttons ' + short(g2.buttons));
    if (g2.status && g2.status !== g.status && /pass/i.test(String(g2.status))) test.check('and its status moves on by itself: passed');
    else test.fail(OWED + 'after the goal\'s pass its status reads ' + short(g2.status));

    // The same for an item: an agent's verify pass, deskVerify's rejection and its pass each set the status word.
    await d.call('session.set', { json: JSON.stringify({ goal: { id: 'fs/G1', title: 'Status' }, items: [{ id: 'fs/G1.1', title: 'Code', blocks: ['fs/G1'], code: true }] }) }, CW);
    await d.call('press', { id: 'fs/G1', what: 'end-design' }, ANDY);
    await d.call('press', { id: 'fs/G1.1', what: 'go' }, ANDY);
    const WSLX = { key: 'MCowBQYDK2VwAyEAdeskVerifyFullTestWSLAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
    const round = async function () {
      await d.call('phase.take', { id: 'fs/G1.1', phase: 'build' }, WSLX); await d.call('phase.done', { id: 'fs/G1.1', phase: 'build' }, WSLX);
      await d.call('phase.take', { id: 'fs/G1.1', phase: 'verify' }, CW); await d.call('phase.done', { id: 'fs/G1.1', phase: 'verify', pass: true }, CW);
    };
    await d.call('phase.take', { id: 'fs/G1.1', phase: 'red' }, CW); await d.call('phase.done', { id: 'fs/G1.1', phase: 'red' }, CW);
    await round();
    const st = async function () { return String((parse((await d.call('item.get', { id: 'fs/G1.1' }, ANDY)).body.item) || {}).status); };
    const s1 = await st();
    if (/deskVerify/i.test(s1)) test.check('an agent\'s verify pass: the status says it waits for deskVerify');
    else test.fail(OWED + 'after the agent\'s verify pass the item status reads ' + short(s1));
    await d.call('verify.reject', { id: 'fs/G1.1', why: 'red' }, ANDY);
    const s2 = await st();
    if (/reject/i.test(s2)) test.check('deskVerify\'s rejection: the status says rejected');
    else test.fail(OWED + 'after verify.reject the item status reads ' + short(s2));
    await round();
    await d.call('verify.pass', { id: 'fs/G1.1' }, ANDY);
    const s3 = await st();
    if (/pass/i.test(s3) && s3 !== s1) test.check('deskVerify\'s pass: the status says passed');
    else test.fail(OWED + 'after verify.pass the item status reads ' + short(s3));
  } finally { await d.stop(); node.close(); }
}

async function verifyHalf() {
  test.subHeading('2. deskVerify: goal.emptied starts one full run, published, reported, granted, passed');
  fs.mkdirSync(PROBES, { recursive: true });
  fs.writeFileSync(path.join(PROBES, 'zzFullGreen.js'), "'use strict';\nconst test = require('../testSupport.js');\ntest.startTest('full probe green');\ntest.check('green one');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  fs.writeFileSync(path.join(PROBES, 'zzFullRed.js'), "'use strict';\nconst test = require('../testSupport.js');\ntest.startTest('full probe red');\ntest.fail('red one');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  // GROWN IN THE VERIFY (claude-windows, at 4c7fcb76): a suite is what runAll calls one - a file that calls startTest(
  // and is not on runAll's NOT_A_SUITE list. Taking every .js would run testSupport.js, deskFake.js and runAll.js
  // itself, a whole nested harness inside the full run. Each of these leaves a mark if it is ever run.
  const MARK = path.join(scratch, 'ran-');
  fs.writeFileSync(path.join(PROBES, 'zzFullHelper.js'), "'use strict';\nrequire('fs').writeFileSync(" + JSON.stringify(MARK + 'helper') + ", 'x');\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(PROBES, 'runAll.js'), "'use strict';\n// test.startTest( appears here as runAll's own does\nrequire('fs').writeFileSync(" + JSON.stringify(MARK + 'runAll') + ", 'x');\n");
  const asks = []; const published = []; const records = [];
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
            if (verb === 'items.search') out = { items: [{ key: 'fe/G1', label: JSON.stringify({ id: 'fe/G1', goal: '', files: [] }) }], more: false };
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
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const v = server(VERIFY, 'verify', {
    values: { db: path.join(root, 'verify.db'), watchMs: 300, suiteMs: 60000, suites: 'spirit/test/zzFullProbes' },
    env: { SPIRIT_JOB_ID: 'verify-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' },
  }, root);
  const waitFor = async function (fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(200); } return fn(); };
  const said = function (verb) { return asks.filter(function (x) { return x.verb === verb; }); };
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(800);
    rec('goal.emptied', { id: 'fe/G1' });
    await waitFor(function () { return said('verify.pass').some(function (x) { return x.args.id === 'fe/G1'; }); }, 15000);
    const full = published.filter(function (o) { return o && o.doing === 'full'; });
    if (full.length && full.every(function (o) { return o.of === 2; }) && full.some(function (o) { return o.index === 2; })) test.check('it ran every suite of its folder, publishing doing full, suite i of 2');
    else test.fail(OWED + 'published: ' + short(published.slice(0, 4)));
    if (!fs.existsSync(MARK + 'helper') && !fs.existsSync(MARK + 'runAll')) test.check('it ran suites only: no helper, and never runAll.js itself');
    else test.fail(OWED + 'the full run ran ' + [fs.existsSync(MARK + 'helper') ? 'a helper (no startTest)' : '', fs.existsSync(MARK + 'runAll') ? 'runAll.js' : ''].filter(Boolean).join(' and '));
    const report = said('chat.add').filter(function (x) { return x.args.id === 'fe/G1'; });
    if (report.length === 1 && /zzFullRed\.js/.test(String(report[0].args.text))) test.check('one report line in the goal chat, naming the red suite');
    else test.fail(OWED + 'the goal chat was asked ' + short(report));
    const grant = said('check.add').filter(function (x) { return x.args.id === 'fe/G1' && x.args.kind === 'G'; });
    if (grant.length === 1 && /zzFullRed\.js/.test(String(grant[0].args.words))) test.check('and the red outside the goal became the G8.7 grant');
    else test.fail(OWED + 'check.add asked ' + short(said('check.add')));
    if (said('verify.pass').some(function (x) { return x.args.id === 'fe/G1'; })) test.check('then it gave the goal its verify.pass');
    else test.fail(OWED + 'no verify.pass on the goal: ' + short(said('verify.pass')));
    const runs = full.filter(function (o) { return o.index === 1; }).length;
    rec('goal.emptied', { id: 'fe/G1' });
    await sleep(3000);
    const runs2 = published.filter(function (o) { return o && o.doing === 'full' && o.index === 1; }).length;
    if (runs > 0 && runs2 === runs) test.check('a second goal.emptied for the same goal runs nothing: one pass per goal');
    else test.fail(OWED + 'the full run started again: suite 1 published ' + runs + ' then ' + runs2 + ' times');
  } finally {
    await v.stop(); node.close();
    try { fs.rmSync(PROBES, { recursive: true, force: true }); } catch (e) { /* gone */ }
  }
}

(async function () {
  await deskHalf();
  await verifyHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(PROBES, { recursive: true, force: true }); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
