'use strict';

// spirit/run/spirit/test/appServer.js
// The tests of spirit/appServer.js, and of no other module (spec: ./appServer.md; goal/G41.11, goal/G41.12). The real
// appServer serves one server on a pipe of its own in a temp folder, publishing a stream and following it: its client
// half subscribes to its own publisher half, and the publisher hands its rows back over the same pipe, to its own
// streamListener. The one spirit object is a stand-in, so nothing reaches a real node: the families answer by posting to
// that pipe, and a delivery can be held back, or refused, until the test says otherwise. A restart is a second process:
// this file run with --child <mode>, printing one RESULT line.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const FILE = path.join(__dirname, '..', 'appServer.js');
const SELF_FILE = __filename;
const TRANSLATOR = path.join(RUN, path.dirname(require(path.join(RUN, 'spirit.js')).familyPath('desk')), 'clientCacheManager.js');
const CHILD = process.argv[2] === '--child' ? String(process.argv[3] || '') : '';
const test = CHILD ? null : require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };

// The publisher's key, base64 as a node key is; the cache file names it in hex (box v15: cache-<sender key in hex>.json).
const PUBLISHER = Buffer.from('KEY-DESK').toString('base64');
const PUBLISHER_HEX = Buffer.from(PUBLISHER, 'base64').toString('hex');
const SELF = 'KEY-CLIENT';
// The eight server families (box v15, Family folders).
const FAMILIES = ['agent', 'backup', 'chatClerver', 'desk', 'deskAgent', 'deskClient', 'deskVerify', 'fileServer'];

const TMP = CHILD ? String(process.argv[4]) : fs.mkdtempSync(path.join(os.tmpdir(), 'appServer-test-'));
// A server name of the test's own, so its cache folder (relay-state/process/<name>/) is no real server's.
const NAME = CHILD ? String(process.argv[5]) : 'streamProbe';
let PIPE = path.join(TMP, NAME + '.sock');
function post(verb, args, callerKey) {
  return new Promise(function (resolve) {
    const body = JSON.stringify({ [verb]: args });
    const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': callerKey } }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve({ status: res.statusCode, body: b }); });
    });
    req.on('error', function (e) { resolve({ status: 0, body: { error: e.message } }); });
    req.end(body);
  });
}
// Every delivery the publisher makes, parsed; held while gate.held, refused while gate.refuse.
const gate = { held: false, refuse: false, waiting: [] };
const posts = [];
function deliver(json) {
  let parsed = null;
  try { parsed = JSON.parse(json); } catch (e) { parsed = null; }
  posts.push(parsed);
  if (gate.refuse) return Promise.reject(new Error('refused by the test'));
  const go = function () { return post('streamListener', { json: json }, PUBLISHER).then(function (r) { return r.status === 200 ? r.body : Promise.reject(new Error('refused ' + short(r.body))); }); };
  if (!gate.held) return go();
  return new Promise(function (resolve, reject) { gate.waiting.push(function () { go().then(resolve, reject); }); });
}
function release() { gate.held = false; const w = gate.waiting.splice(0); w.forEach(function (fn) { fn(); }); }
const asked = [];
// The one family path function (goal/G41.12), spirit.js's own, read before the stand-in takes spirit.js's place. spirit.js
// loads the data set as it is required, onto the real spirit object; it is let go again, so appServer's own load of it
// puts it on the stand-in, where the desk's translator finds it.
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;
delete require.cache[require.resolve(path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js'))];
const fake = {
  familyPath: familyPath,
  require: function (p, key) {
    const q = String(p);
    if (/spirit\/auth\/api\.js$/.test(q)) {
      return Promise.resolve({
        grant: function (a) { asked.push({ verb: 'auth.grant', args: a }); return Promise.resolve({ ok: true }); },
        search: function () { return Promise.resolve({ items: [], more: false }); },
      });
    }
    // A server family under a key (the publisher's, as the client subscribes; the client's, as the publisher delivers),
    // by the old name or the new: routing only, this test writes no family path of its own.
    if (key && /(?:^|\/)([^/]+)\/(?:family|\1\.family)\/api\.js$/.test(q)) {
      return Promise.resolve({
        subscribe: function (a) { asked.push({ verb: 'subscribe', key: key, args: a }); return post('subscribe', a, SELF).then(function (r) { return r.body; }); },
        streamListener: function (a) { return deliver(a.json); },
      });
    }
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: 500, body: { ok: false, error: String(e && e.message || e) } }; }); },
  events: { publish: function () {}, subscribe: function () {} },
};
const realLoad = Module._load;
Module._load = function (request, parent) {
  if (/(^|[\\/])spirit\.js$/.test(request) && parent && String(parent.filename).indexOf(RUN) === 0) { globalThis.spirit = fake; return fake; }
  return realLoad.apply(this, arguments);
};
globalThis.spirit = fake;
if (process.platform === 'win32') PIPE = require(path.join(RUN, 'spirit', 'appClient.js')).pipePathFor(TMP, NAME, 'win32', 'process');
const childArgv = process.argv.slice();
process.argv = [process.argv[0], path.join(TMP, NAME + '.js'), '--pipe', PIPE];

let bootstrap = [];
let bootstraps = 0;
const GOAL = { id: 'goal/G9', goal: '', title: 'the goal', version: 1 };
const item = function (n, extra) { return Object.assign({ id: 'goal/G9.' + n, goal: 'goal/G9', title: 'item ' + n, version: 1 }, extra || {}); };
const row = function (f) { return { verb: 'goal.whole', goal: 9, item: f }; };
// The client's cache file for the publisher (box v15): relay-state/process/<client server>/cache-<sender key in hex>.json,
// under the run root, where spirit.js sits.
const cacheFile = function (name) { return path.join(RUN, 'relay-state', 'process', name, 'cache-' + PUBLISHER_HEX + '.json'); };

function start(streamOpts, publisherOpts) {
  const A = require(FILE);
  const s = A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, {
    stream: Object.assign({ module: 'process/js/desk', translator: TRANSLATOR }, streamOpts || {}),
    publisher: Object.assign({ family: NAME, bootstrap: function () { bootstraps += 1; return bootstrap.slice(); }, waitMs: 5000 }, publisherOpts || {}),
  });
  return { A: A, s: s, D: A.data };
}
const hasIn = function (D, n) { return !!(D && D.get('deskItems/goal/G9.' + n)); };

// ── a child: one process of a restart, or of a cache switch ────────────────────────────────────────────────────────
async function child(mode) {
  const out = {};
  const FAM = childArgv[6] || 'desk';
  if (mode === 'first') {
    // Cache on: the first run of a client, its push landed.
    const { s, D } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.one = hasIn(D, 1); out.two = hasIn(D, 2);
  } else if (mode === 'restart') {
    // The same client again, a new process: the publisher in it a new run. Its cache read back before any subscribe.
    const { s, D } = start({ cache: true });
    await tick(300);
    out.readOne = hasIn(D, 1); out.readTwo = hasIn(D, 2);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, renamed', version: 2 }))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.title = D.get('deskItems/goal/G9.1') && D.get('deskItems/goal/G9.1').title;
    out.two = hasIn(D, 2);
  } else if (mode === 'off' || mode === 'nofamily') {
    // off: no cache switch; nofamily: the switch on, but the sender's family has no folder on this node.
    const { s } = start(mode === 'off' ? {} : { cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
  } else if (mode === 'every') {
    // The default limit: two goals, both kept, every row of each (box v15: "every goal, no filtering on the client side").
    const { A, s, D } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish(row(item(i)));
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish({ verb: 'goal.whole', goal: 10, item: { id: 'goal/G10.' + i, goal: 'goal/G10', title: 'item ' + i, version: 1 } });
    await tick(800);
    out.g9 = []; out.g10 = [];
    for (let i = 1; i <= 3; i++) { if (D.get('deskItems/goal/G9.' + i)) out.g9.push(i); if (D.get('deskItems/goal/G10.' + i)) out.g10.push(i); }
  } else if (mode === 'items' || mode === 'chat') {
    // One goal (Andy, Q2: "when there is only one goal, then you shed the longest untouched item, LOCK, stock and
    // barrel, when there is only one goal with one item you shed the oldest chat line").
    const { A, s, D } = start({ cache: { limit: mode === 'items' ? 1500 : 2500 } });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    const long = function (n) { return 'a row long enough to fill a small cache quickly, number ' + n + ' '.repeat(140) + '.'; };
    const line = function (id, n) { return { table: 'chat', id: id, row: { at: '2026-10-28T05:00:' + String(n).padStart(2, '0') + '.000Z', by: 'andy', text: long(n) } }; };
    if (mode === 'items') {
      A.publish(row(item(1)));
      A.publish(line('goal/G9.1', 0));
      for (let i = 2; i <= 10; i++) { await tick(30); A.publish(row(item(i, { title: long(i) }))); }
    } else {
      A.publish(row(item(1)));
      for (let i = 1; i <= 30; i++) { await tick(10); A.publish(line('goal/G9.1', i)); }
    }
    await tick(1500);
    out.goal = !!D.get('deskItems/goal/G9');
    out.items = []; for (let i = 1; i <= 10; i++) if (D.get('deskItems/goal/G9.' + i)) out.items.push(i);
    const whole = D.get('deskItem/goal/G9.1');
    out.chat = whole && Array.isArray(whole.chat) ? whole.chat.map(function (l) { return Number(String(l.at).slice(17, 19)); }) : [];
  } else if (mode === 'limit') {
    // Two goals, ten rows each: goal/G9 first and untouched since, goal/G10 after. Together past the limit, either alone
    // within it: the desk's family api.js (Andy, Q2: "THE LONGEST UNTOUCHED GOAL GOES, LOCK, STOCK AND BARREL").
    const { A, s, D } = start({ cache: { limit: 3500 } });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    const long = function (n) { return 'a row long enough to fill a small cache quickly, number ' + n + ' '.repeat(140) + '.'; };
    for (let i = 1; i <= 10; i++) A.publish(row(item(i, { title: long(i) })));
    await tick(300);
    for (let i = 1; i <= 10; i++) A.publish({ verb: 'goal.whole', goal: 10, item: { id: 'goal/G10.' + i, goal: 'goal/G10', title: long(i), version: 1 } });
    await tick(1500);
    out.g9 = []; out.g10 = [];
    for (let i = 1; i <= 10; i++) { if (D.get('deskItems/goal/G9.' + i)) out.g9.push(i); if (D.get('deskItems/goal/G10.' + i)) out.g10.push(i); }
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n');
  process.exit(0);
}
function runChild(mode, name, fam) {
  const r = spawnSync(process.execPath, [SELF_FILE, '--child', mode, TMP, name, fam || 'desk'], { encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('RESULT ') === 0; })[0];
  try { return JSON.parse(line.slice(7)); } catch (e) { return { failed: short(r.stderr || r.stdout || r.error) }; }
}
function clearCache(name) { try { fs.rmSync(path.join(RUN, 'relay-state', 'process', name), { recursive: true, force: true }); } catch (e) { /* none */ } }

// ── the tree: one family path, eight folders (box v15, Family folders) ─────────────────────────────────────────────
function jsonFiles(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) jsonFiles(p, out);
    else if (/\.json$/.test(d.name)) out.push(p);
  });
  return out;
}
function codeFiles(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules' || d.name === '.git' || p === path.join(RUN, 'brains') || p === path.join(RUN, 'relay-state')) return;
      codeFiles(p, out);
    } else if (/\.(js|html)$/.test(d.name)) out.push(p);
  });
  return out;
}

if (CHILD) {
  child(CHILD).catch(function (e) { process.stdout.write('RESULT ' + JSON.stringify({ failed: String(e && e.stack || e) }) + '\n'); process.exit(1); });
} else {
  test.startTest('appServer.js: one stream protocol for every server (goal/G41.11, goal/G41.12)');
  (async function () {
    test.subHeading('the family path: one function, in appServer (box v15)');
    const A0 = require(FILE);
    ok(typeof A0.familyPath === 'function', 'appServer exports familyPath', 'appServer has no familyPath export: ' + typeof A0.familyPath);
    const fp = typeof A0.familyPath === 'function' ? A0.familyPath('desk') : null;
    ok(fp === 'process/js/desk/family/api.js', 'familyPath(name) is process/js/<name>/family/api.js', 'familyPath(\'desk\') is ' + short(fp));
    FAMILIES.forEach(function (n) {
      const moved = fs.existsSync(path.join(RUN, 'process', 'js', n, 'family', 'api.js')) && !fs.existsSync(path.join(RUN, 'process', 'js', n, n + '.family'));
      ok(moved, n + ': its family folder is process/js/' + n + '/family/, no ' + n + '.family is left',
        n + ': family/api.js ' + fs.existsSync(path.join(RUN, 'process', 'js', n, 'family', 'api.js')) + ', ' + n + '.family still there: ' + fs.existsSync(path.join(RUN, 'process', 'js', n, n + '.family')));
    });
    // No file but appServer writes a family path: no <name>.family, no family/api.js, no join onto 'family'. This file
    // routes by the pattern and is left out; so are appServer.js and spirit.js: the browser cannot load appServer, so
    // spirit.js holds the function and appServer hands out the same one (cw, goal/G41.12 Q3).
    const SPIRIT_JS = path.join(RUN, 'spirit.js');
    const writers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && f !== SPIRIT_JS; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      // A join onto 'family' is a path; a bare 'family' is no path since goal/G41.14, where it names a column and a field
      // (Andy: "these four following NAMES will be used in SpiritOS: bundle > branch > family > verb").
      return /\.family(?=['"`\/\\]|$)/m.test(t) || /(^|[^\\])\/?family\/api\.js/.test(t) || /join\([^)]*['"`]family['"`]\s*[),]/.test(t);
    }).map(function (f) { return path.relative(RUN, f); });
    ok(writers.length === 0, 'no file outside appServer\'s familyPath writes a family path', writers.length + ' files write one: ' + writers.join(', '));

    test.subHeading('goal/G41.24: DEPENDENCIES is gone');
    // Andy, box: "DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder
    // itself." No code file names the verb or hands serve() a dependencies list; this file names it to look for it.
    // The goal file the desk writes is his record, his box words in it, not code.
    const CURRENT_GOAL = path.join(RUN, 'process', 'js', 'desk', 'currentGoal.json');
    const named = codeFiles(RUN, []).concat(jsonFiles(path.join(RUN, 'process', 'js', 'desk'), [])).filter(function (f) { return f !== SELF_FILE && f !== CURRENT_GOAL; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return /DEPENDENCIES/.test(t) || /\bdependencies\s*:/.test(t) || /opts\.dependencies|withDependencies|checkDependencies/.test(t);
    }).map(function (f) { return path.relative(RUN, f); });
    ok(named.length === 0, 'no code file, and nothing in the desk folder, names DEPENDENCIES or hands serve() a dependencies list', named.length + ' still do: ' + named.join(', '));

    test.subHeading('goal/G41.24: the appServers\' Bundles.json');
    // Andy, box: "desk, deskClient, agent, deskVerify will receive their
    // \"process/js/<appServerName>/<appServerName>Bundles.json.\" files", and "the bundles":
    //   "desk: \"deskAgent\", \"remoteUser\", desk agent gets mostly full access, but no FS.* verbs, no item.rules.*, no
    //    rule.*, and no user-presses. the remoteUser gets all verbs except FS.*"
    //   "deskVerify: \"deskAgent\", \"remoteUser\". (both get only \"search\")"
    //   "deskClient: \"deskServer\", only the verbs desk currently uses."
    //   "agent: \"remoteUser\" the full agent family, minus FS.*"
    // A row is { label, branches: [{ family, verb }] } (spirit/test/apiAuth.md); a verb '' is the whole family, FS.* with it.
    const bundlesOf = function (app) { try { return JSON.parse(fs.readFileSync(path.join(RUN, 'process', 'js', app, app + 'Bundles.json'), 'utf8')); } catch (e) { return null; } };
    const familyVerbs = function (app) { try { return Object.keys(require(path.join(RUN, 'process', 'js', app, 'family', 'api.js')).verbs || {}).sort(); } catch (e) { return []; } };
    // What a row reaches, as verbs of one family: a whole-family branch reaches its FS.* verbs too (introSpector.js).
    const reach = function (row, fam) {
      const out = [];
      ((row && Array.isArray(row.branches)) ? row.branches : []).forEach(function (b) {
        if (!b || b.family !== fam) { out.push((b && b.family) + '.' + (b && b.verb)); return; }
        if (!b.verb) out.push.apply(out, familyVerbs(fam).concat(['FS.*']));
        else out.push(b.verb);
      });
      return out.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    };
    const rowOk = function (row) { return !!row && typeof row.label === 'string' && row.label.trim() !== '' && !('owner' in row) && Array.isArray(row.branches); };
    const deskB = bundlesOf('desk');
    const DESK = familyVerbs('desk');
    ok(!!deskB && JSON.stringify(Object.keys(deskB).sort()) === '["deskAgent","remoteUser"]' && rowOk(deskB.deskAgent) && rowOk(deskB.remoteUser),
      'process/js/desk/deskBundles.json holds deskAgent and remoteUser, each a row with a label, no owner, and its branches', 'deskBundles.json: ' + short(deskB));
    const dRemote = reach(deskB && deskB.remoteUser, 'desk');
    ok(DESK.length > 0 && JSON.stringify(dRemote) === JSON.stringify(DESK), 'desk\'s remoteUser gets every desk verb, and no FS.*', 'reaches ' + short(dRemote));
    const dAgent = reach(deskB && deskB.deskAgent, 'desk');
    // His presses (box: "desk user presses are: 'Done', 'Close', 'Reopen' 'Start|End design', 'Verify', 'Delete' and
    // 'Abandon'"): Delete is the verb item.delete; the others are values of press, the verb the agents' own presses
    // (claim-done, design-complete, bring-back) go through too, and refused to an agent by the desk itself
    // (OWNER_PRESSES). A branch is a whole verb, so press stays in and item.delete goes.
    const NOT_AGENT = function (v) { return /^FS\./.test(v) || v === 'FS.*' || /^item\.rules\./.test(v) || /^rule\./.test(v) || v === 'item.delete'; };
    // Q5, Andy: "just do the ones named in the box.": rule.* is rule.add, rule.draft, rule.get and rule.version;
    // rules.search is not among them, so it stays.
    const ASKED = [];
    const wantAgent = DESK.filter(function (v) { return !NOT_AGENT(v) && ASKED.indexOf(v) === -1; });
    ok(DESK.length > 0 && dAgent.length > 0 && !dAgent.some(NOT_AGENT) && wantAgent.every(function (v) { return dAgent.indexOf(v) !== -1; }) && dAgent.every(function (v) { return DESK.indexOf(v) !== -1; }),
      'desk\'s deskAgent gets the desk verbs but FS.*, item.rules.*, rule.* and his Delete (item.delete); press stays, its presses of his refused by the desk', 'reaches ' + short(dAgent) + '; missing ' + short(wantAgent.filter(function (v) { return dAgent.indexOf(v) === -1; })) + '; refused in it ' + short(dAgent.filter(NOT_AGENT)));
    const vB = bundlesOf('deskVerify');
    ok(!!vB && JSON.stringify(Object.keys(vB).sort()) === '["deskAgent","remoteUser"]' && ['deskAgent', 'remoteUser'].every(function (k) { return rowOk(vB[k]) && JSON.stringify(reach(vB[k], 'deskVerify')) === '["search"]'; }),
      'process/js/deskVerify/deskVerifyBundles.json: deskAgent and remoteUser, both only search', 'deskVerifyBundles.json: ' + short(vB));
    const cB = bundlesOf('deskClient');
    ok(!!cB && JSON.stringify(Object.keys(cB)) === '["deskServer"]' && rowOk(cB.deskServer) && JSON.stringify(reach(cB.deskServer, 'deskClient')) === '["streamListener"]',
      'process/js/deskClient/deskClientBundles.json: deskServer, the one deskClient verb desk uses, its stream\'s streamListener', 'deskClientBundles.json: ' + short(cB));
    const aB = bundlesOf('agent');
    const AGENT = familyVerbs('agent');
    ok(!!aB && JSON.stringify(Object.keys(aB)) === '["remoteUser"]' && rowOk(aB.remoteUser) && AGENT.length > 0 && JSON.stringify(reach(aB.remoteUser, 'agent')) === JSON.stringify(AGENT),
      'process/js/agent/agentBundles.json: remoteUser, the full agent family minus FS.*', 'agentBundles.json: ' + short(aB) + ', reaches ' + short(reach(aB && aB.remoteUser, 'agent')));

    test.subHeading('what goes (box v15)');
    const deskJs = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.js'), 'utf8');
    const clientJs = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js'), 'utf8');
    ok(!/function\s+bundled\s*\(/.test(deskJs), 'the desk has no bundled() of its own', 'desk.js still defines bundled()');
    ok(!/cache\.json/.test(clientJs), 'deskClient keeps no cache.json of its own', 'deskClient.js still names cache.json');

    // ── one process: a client following its own publisher ──────────────────────────────────────────────────────────
    // goal/G41.24: the desk's translator is its family's clientCacheManager.js; the stream checks below follow it.
    if (!fs.existsSync(TRANSLATOR)) { test.fail('the desk\'s translator, process/js/desk/family/clientCacheManager.js, is not there: the stream checks wait on it'); test.reportSuccessFailureCount(); process.exit(0); }
    const { A, s, D } = start({}, { logMax: 5 });
    await tick(100);
    ok(!!D && typeof D.get === 'function' && !!s && typeof s.subscribe === 'function', 'it serves, keeps a data set and has its client half (subscribe)', 'data ' + typeof (D && D.get) + ', subscribe ' + typeof (s && s.subscribe));
    if (!D || !s || typeof s.subscribe !== 'function') return;
    const has = function (n) { return hasIn(D, n); };

    test.subHeading('the first subscribe: a full push');
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    const first = await s.subscribe(PUBLISHER, NAME);
    await tick(300);
    ok(first === true && asked.some(function (a) { return a.verb === 'subscribe' && a.key === PUBLISHER; }) && asked.some(function (a) { return a.verb === 'auth.grant'; }),
      'a subscribe follows the publisher\'s key and asks its family to subscribe it', 'answered ' + short(first) + ', asked ' + short(asked));
    ok(has(1) && has(2), 'the bootstrap lands in the cache: both items', short({ one: D.get('deskItems/goal/G9.1'), two: D.get('deskItems/goal/G9.2') }));
    ok(posts.length > 0 && posts.every(Array.isArray), 'every delivery is a bundle: one JSON array of rows in one peerPost', 'deliveries: ' + short(posts));

    test.subHeading('rows that back up go as bundles (box v15)');
    let before = posts.length;
    gate.held = true;
    A.publish(row(item(10)));
    await tick(50);
    for (let i = 11; i < 30; i++) A.publish(row(item(i)));
    await tick(300);
    release();
    await tick(800);
    const landed = []; for (let i = 10; i < 30; i++) if (has(i)) landed.push(i);
    ok(landed.length === 20, 'twenty rows published, twenty landed', 'landed: ' + short(landed));
    ok(posts.length - before <= 3, 'nineteen rows backed up behind a held one went in a bundle, not one peerPost each', (posts.length - before) + ' peerPosts for 20 rows');

    test.subHeading('the position: a subscribe again is handed what came after it, no push (box v15)');
    before = bootstraps;
    gate.refuse = true;
    A.publish(row(item(30)));
    await tick(300);
    gate.refuse = false;
    A.publish(row(item(31)));
    A.publish(row(item(32)));
    A.publish(Object.assign(row(item(33)), { to: ['KEY-SOMEONE-ELSE'] }));
    await tick(100);
    // The new bootstrap holds no item 2: a full push would sweep it.
    bootstrap = [row(GOAL), row(item(1))];
    const again = await s.subscribe(PUBLISHER, NAME);
    await tick(500);
    ok(again === true && has(30) && has(31) && has(32), 'dropped by a refused delivery, it subscribes again and is handed the rows it missed', 'answered ' + short(again) + ', items 30-32: ' + [has(30), has(31), has(32)].join(' '));
    ok(again === true && has(32) && !has(33), 'a row addressed to another key is left out of what it is handed', 'item 33, addressed to another key: ' + has(33));
    ok(bootstraps === before && has(2),'the sender\'s log answers it: no bootstrap, and the cache is not replaced', 'bootstraps ' + before + ' -> ' + bootstraps + ', item 2 kept: ' + has(2));
    const subArgs = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; });
    const last = subArgs[subArgs.length - 1] || {};
    ok(subArgs.length >= 2 && JSON.stringify(last) !== JSON.stringify(subArgs[0]), 'the subscribe again carries the position the client holds', 'subscribes: ' + short(subArgs));

    // goal/G41.15, Andy: "make sure the deskClient doesn't loose cached info outside the current goal", Q1: "nothing
    // drops from the cache, unless the api.js from the server says so", and the box: "a goal pushed whole takes
    // precedence, and the client's place in the stream moves to that push".
    test.subHeading('older than the bounded log: a full push takes precedence and drops nothing (goal/G41.15)');
    before = bootstraps;
    gate.refuse = true;
    A.publish(row(item(40)));
    await tick(300);
    gate.refuse = false;
    for (let i = 41; i < 50; i++) A.publish(row(item(i)));
    await tick(100);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, pushed' }))];
    await s.subscribe(PUBLISHER, NAME);
    await tick(600);
    ok(bootstraps === before + 1, 'nine rows missed past a log of five: the sender pushes in full', 'bootstraps ' + before + ' -> ' + bootstraps);
    const one1 = D.get('deskItems/goal/G9.1');
    ok(one1 && one1.title === 'item 1, pushed', 'the push takes precedence: a row it carries replaces the one kept', 'item 1: ' + short(one1));
    ok(has(2) && has(30), 'and drops nothing it does not carry: items the push leaves out stay kept', 'item 2 ' + has(2) + ', item 30 ' + has(30));
    ok(!has(45), 'a row never delivered is not invented by the push', 'item 45 ' + has(45));
    // The read-pointer: the push landed, so the client stands at the push's number; a subscribe again is answered from
    // the log, with no second push and nothing from before it.
    const pushedAt = bootstraps;
    const subsBefore = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    await s.subscribe(PUBLISHER, NAME);
    await tick(400);
    const lastSub = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; }).pop() || {};
    // The push's own end, as the sender sent it: { run, n, full, end }.
    const ends = [].concat.apply([], posts.filter(Array.isArray)).filter(function (e) { return e && e.full === true && e.end === true; });
    const pushEnd = ends[ends.length - 1] || {};
    ok(asked.filter(function (a) { return a.verb === 'subscribe'; }).length === subsBefore + 1 && bootstraps === pushedAt && lastSub.since === pushEnd.n && lastSub.run === pushEnd.run,
      'its place in the stream moved to the push: subscribed again, it is handed nothing older and pushed nothing again', 'bootstraps ' + pushedAt + ' -> ' + bootstraps + ', subscribed with ' + short(lastSub) + ', the push ended at ' + short(pushEnd));

    // goal/G41.22, Andy: "take the 3 seconds out, appServer.js calls peerPost in the most basic way": a subscriber that
    // answers late, within the publisher's own wait, is no subscriber gone (traced 2026-10-30: the node's one sending slot
    // held deliveries 4 to 7 s, and a 3 s race dropped a live client every time).
    test.subHeading('a late answer is no drop: a delivery is a plain peerPost (goal/G41.22)');
    const subsLate = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    const bootsLate = bootstraps;
    const postsLate = posts.length;
    gate.held = true;
    A.publish(row(item(60)));
    await tick(50);
    A.publish(row(item(61)));
    A.publish(row(item(62)));
    await tick(4000);
    release();
    await tick(400);
    ok(has(60) && has(61) && has(62), 'held 4 s, past the old 3 s, the rows still land: none is dropped', 'items 60-62: ' + [has(60), has(61), has(62)].join(' '));
    const sentLate = posts.slice(postsLate).filter(Array.isArray);
    ok(sentLate.length === 2 && sentLate[1].length === 2, 'what piled up while the first was out goes in one bundle after it', 'bundles after the hold: ' + short(sentLate.map(function (b) { return b.length; })));
    A.publish(row(item(63)));
    await tick(300);
    ok(has(63) && bootstraps === bootsLate && asked.filter(function (a) { return a.verb === 'subscribe'; }).length === subsLate,
      'the subscriber was never dropped: the next row comes with no subscribe again and no push', 'item 63 ' + has(63) + ', subscribes ' + subsLate + ' -> ' + asked.filter(function (a) { return a.verb === 'subscribe'; }).length + ', bootstraps ' + bootsLate + ' -> ' + bootstraps);
    ok(!/FAST_MS|Promise\.race/.test(fs.readFileSync(FILE, 'utf8')), 'appServer.js races no delivery and no subscribe against a clock of its own', 'appServer.js still names FAST_MS or Promise.race');

    // ── restarts and the cache switch: each a process of its own ───────────────────────────────────────────────────
    test.subHeading('the cache, per sender, saved and read back (box v15)');
    clearCache('cacheProbe');
    const one = runChild('first', 'cacheProbe');
    const file = cacheFile('cacheProbe');
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = ''; }
    ok(one.subscribed === true && one.one && one.two, 'a client with the cache switch on takes the push', short(one));
    ok(text.indexOf('item 2') !== -1, 'it saves the cache as relay-state/process/<client>/cache-<sender key in hex>.json', path.relative(RUN, file) + ': ' + (text ? short(text) : 'no file'));
    const two = runChild('restart', 'cacheProbe');
    ok(two.readOne && two.readTwo, 'started again, it reads its cache back before it subscribes', short(two));
    ok(two.subscribed === true && two.title === 'item 1, renamed' && two.two, 'a sender of a new run pushes in full: its rows take precedence, and a kept row it does not carry stays (goal/G41.15)', short(two));
    clearCache('cacheOff');
    runChild('off', 'cacheOff');
    ok(!fs.existsSync(cacheFile('cacheOff')), 'without the switch no cache file is kept', 'cache file found: ' + path.relative(RUN, cacheFile('cacheOff')));
    clearCache('cacheNoFam');
    runChild('nofamily', 'cacheNoFam', 'noSuchServer');
    ok(!fs.existsSync(cacheFile('cacheNoFam')), 'a sender whose family has no folder on this node is not cached', 'cache file found: ' + path.relative(RUN, cacheFile('cacheNoFam')));
    clearCache('cacheEvery');
    const every = runChild('every', 'cacheEvery');
    ok(Array.isArray(every.g9) && every.g9.length === 3 && Array.isArray(every.g10) && every.g10.length === 3,
      'within the limit the cache keeps every goal the sender sends, no filtering on the client side', short(every));
    clearCache('cacheLimit');
    const full = runChild('limit', 'cacheLimit');
    let size = -1;
    try { size = fs.statSync(cacheFile('cacheLimit')).size; } catch (e) { size = -1; }
    ok(size > 0 && size <= 3500, 'the cache keeps to the limit the client sets', 'cache file of ' + size + ' bytes for a limit of 3500');
    ok(Array.isArray(full.g9) && full.g9.length === 0 && Array.isArray(full.g10) && full.g10.length === 10,
      'past the limit the goal untouched longest goes whole, the other is kept whole (Andy, Q2)', short(full));
    // One goal: the item untouched longest goes, its chat with it; the newest stay (Andy, Q2).
    clearCache('cacheItems');
    const items = runChild('items', 'cacheItems');
    const kept = Array.isArray(items.items) ? items.items : [];
    const prefixGone = kept.length > 0 && kept.length < 10 && kept.every(function (n, i) { return n === 10 - kept.length + 1 + i; });
    ok(items.goal && prefixGone, 'one goal past the limit: the items untouched longest go whole, the newest stay, the goal stays', short(items));
    ok(kept.indexOf(1) === -1 && Array.isArray(items.chat) && items.chat.length === 0, 'an item shed goes lock, stock and barrel: its chat with it', short(items));
    clearCache('cacheChat');
    const chat = runChild('chat', 'cacheChat');
    const lines = Array.isArray(chat.chat) ? chat.chat : [];
    const newest = lines.length > 0 && lines.length < 30 && lines.every(function (n, i) { return n === 30 - lines.length + 1 + i; });
    ok(chat.goal && Array.isArray(chat.items) && chat.items.length === 1 && newest, 'one goal with one item past the limit: the oldest chat lines go, the item and the newest lines stay', short(chat));
    ['cacheProbe', 'cacheOff', 'cacheNoFam', 'cacheEvery', 'cacheLimit', 'cacheItems', 'cacheChat'].forEach(clearCache);
  }()).then(function () {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a temp folder left is no failure */ }
    test.reportSuccessFailureCount(); process.exit(process.exitCode || 0);
  }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
}
