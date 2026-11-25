'use strict';

// spirit/run/spirit/server/app/test/script.js
// The tests of spirit/server/app/script.js, and of no other module (spec: ./script.md; goal/G41.11, goal/G41.12). The real
// appServer serves one server on a pipe of its own in a temp folder, publishing a stream and following it: its client
// half subscribes to its own publisher half, and the publisher hands its rows back over the same pipe, to its own
// streamListener. The one spirit object is a stand-in, so nothing reaches a real node: the families answer by posting to
// that pipe, and a delivery can be held back, or refused, until the test says otherwise. A restart is a second process:
// this file run with --child <mode>, printing one RESULT line.
// The one test file of appServer.js: the agentsFile part (AGENTS.md through spirit.required.spirit.fs.api.loadFile), the mount part (the
// node starts a server from spirit/app/<name>/) and the stateCache part (its cache in spirit/state/<name>/cache/), once
// appServer-agentsFile.js, appServer-mount.js and appServer-stateCache.js, are sections of it, run after its own checks
// and never in a --child process.

const fs = require('fs');
const path = require('path');
const http = require('http');
const Module = require('module');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/server/app/script.js';
const FILE = path.join(RUN, SUBJECT);
const SELF_FILE = __filename;
const CHILD = process.argv[2] === '--child' ? String(process.argv[3] || '') : '';
// THE FAMILIES IT FOLLOWS ARE ITS OWN, PLANTED IN THE TREE FOR THE RUN AND REMOVED AFTER (goal/G47.4; Andy: "you make
// bloody well sure that such stupid hard-coded tests move"; wsl: the desk's own rules are judged in the desk's own test,
// "keep there only what is the app server's own, on your planted family"). zzstream: a translator filing each row's item
// by its id, and no cache rules, so the app server's own default sheds (the oldest rows first). zzshed: a cache rule of its
// own, a shed that drops the newest rows instead, so the family's own shed is seen to be the one asked.
const FAMILY = 'zzstream';
const SHED_FAMILY = 'zzshed';
const TRANSLATOR = path.join(RUN, 'spirit', 'app', FAMILY, 'data.js');
// The planted files' requires are relative to where each is planted, under spirit/app/<name>/ (the move tool of goal/G49.12
// rewrote them as if they stood beside this test; set right by hand).
function plantFamilies() {
  const at = function (n) { const d = path.join(RUN, 'spirit', 'app', n); fs.mkdirSync(d, { recursive: true }); return d; };
  const head = "'use strict';\n// Planted by spirit/server/app/test/script.js for its stream checks, and removed when it ends.\n";
  fs.writeFileSync(path.join(at(FAMILY), 'api.js'), head + 'module.exports = { verbs: {} };\n');
  fs.writeFileSync(path.join(at(FAMILY), 'data.js'), head + [
    "const D = require('../../script.js').requireScript('spirit/data/script.js');",
    "D.makeFamily('" + FAMILY + "', function () {",
    "  const HOME = D.viewAt(null, '" + FAMILY + "');",
    "  D.addTranslator({ onJob: function (job) {",
    "    if (!(job && job.module === 'spirit.app." + FAMILY + "' && job.app && job.app.item && job.app.item.id)) return;",
    "    D.viewAt(job.fromNode || null, '" + FAMILY + "').set('rows/' + job.app.item.id, job.app.item);",
    "  } });",
    "  return { item: function (id) { return id ? HOME.get('rows/' + id) || null : null; } };",
    "});",
    "module.exports = {};",
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(at(SHED_FAMILY), 'api.js'), head + 'module.exports = { verbs: {} };\n');
  fs.writeFileSync(path.join(at(SHED_FAMILY), 'data.js'), head + [
    "module.exports = { cache: { shed: function (rows, limit, bytes) {",
    "  const kept = rows.slice();",
    "  while (kept.length > 1 && bytes(kept) > limit) kept.pop();",
    "  return kept;",
    "} } };",
  ].join('\n') + '\n');
}
function removeFamilies() { [FAMILY, SHED_FAMILY].forEach(function (n) { try { fs.rmSync(path.join(RUN, 'spirit', 'app', n), { recursive: true, force: true }); } catch (e) { /* none */ } }); }
const test = CHILD ? null : LOADER.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends (by the parent; a child is handed its folder).
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/appServer/' + name + tempAsked); }
if (test) test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/appServer'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

const tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };

// The publisher's key, base64 as a node key is. It holds a + and a /, as real keys do (goal/G41.28), so only base64url
// names its cache file and its branch (cacheFile below).
const PUBLISHER = Buffer.from('KEY-DESK\xfb\xef\xbf\xfe', 'latin1').toString('base64');
const SELF = 'KEY-CLIENT';

const TMP = CHILD ? String(process.argv[4]) : ownTemp('appServer-test-');
// A server name of the test's own, so its cache folder (spirit/state/<name>/) is no real server's.
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
    req.on('error', function () { resolve({ status: 0, body: null }); });
    req.end(body);
  });
}
// Every delivery the publisher makes, parsed; held while gate.held, refused while gate.refuse.
const gate = { held: false, refuse: false, waiting: [] };
const posts = [];
// Every subscribe the flaky sibling was asked (goal/G47.5, reconnect).
const flaky = [];
function deliver(json) {
  let parsed = null;
  try { parsed = JSON.parse(json); } catch (e) { parsed = null; }
  posts.push(parsed);
  if (gate.refuse) return Promise.reject(new Error());
  // The listen verb is listener (goal/G47.5; Andy: "PLEASE call the damn thing jus \"listener\", we won't start using camelCase on
  // intrinsic verbs"), streamListener as it was.
  const go = function () { return post('listener', { json: json }, PUBLISHER).then(function (r) { return r.status === 200 ? r.body : Promise.reject(new Error()); }); };
  if (!gate.held) return go();
  return new Promise(function (resolve, reject) { gate.waiting.push(function () { go().then(resolve, reject); }); });
}
function release() { gate.held = false; const w = gate.waiting.splice(0); w.forEach(function (fn) { fn(); }); }
const asked = [];
// spirit.js loads the data set as it is required, onto the real spirit object; it is let go again, so appServer's own load of it
// puts it on the stand-in, where the planted family's translator finds it.
delete require.cache[require.resolve(path.join(RUN, 'spirit', 'data', 'script.js'))];
const fake = {
  requireScript: function (p, key) {
    const q = String(p);
    if (/spirit\/auth\/api\.js$/.test(q)) {
      return Promise.resolve({
        grant: function (a) { asked.push({ verb: 'auth.grant', args: a }); return Promise.resolve({ ok: true }); },
        search: function () { return Promise.resolve({ items: [], more: false }); },
      });
    }
    // A server family under a key (the publisher's, as the client subscribes; the client's, as the publisher delivers),
    // at its app's api.js path (appApiPath): routing only, this test writes no family path of its own.
    // The node's contacts, as the background check of remote asks them (goal/G47.5): one that lets this node in, one whose
    // server refuses it, one that stays silent.
    if (/spirit\/contact\/api\.js$/.test(q)) {
      return Promise.resolve({ search: function () { return Promise.resolve({ items: [{ key: 'KEY-PEER', name: 'Peer' }, { key: 'KEY-NOGRANT', name: 'No grant' }, { key: 'KEY-SILENT', name: 'Silent' }], more: false }); } });
    }
    if (key === 'KEY-SILENT' && /\/api\.js$/.test(q)) return Promise.reject(Object.assign(new Error('no answer'), { status: 0 }));
    if (key === 'KEY-NOGRANT' && /\/api\.js$/.test(q)) {
      const no = function () { return Promise.reject({ status: 403, body: { ok: false, code: 'not-granted' } }); };
      return Promise.resolve({ ping: no, subscribe: no, remote: no });
    }
    // A sibling down for a while (goal/G47.5, reconnect): its first subscribe is not taken, every later one is.
    if (key === 'KEY-FLAKY' && /\/api\.js$/.test(q)) {
      return Promise.resolve({
        subscribe: function (a) { flaky.push(a); return flaky.length === 1 ? Promise.reject({ status: 0, body: { ok: false, code: 'no-answer' } }) : Promise.resolve({ subscribed: true }); },
        listener: function (a) { return deliver(a.json); },
        ping: function () { return Promise.resolve({ pong: 'flaky' }); },
        remote: function () { return Promise.reject({ status: 403, body: { ok: false, code: 'owner-only' } }); },
      });
    }
    if (key && /^spirit\/(?:app\/)?[^/]+\/api\.js$/.test(q)) {
      return Promise.resolve({
        subscribe: function (a) { asked.push({ verb: 'subscribe', key: key, args: a }); return post('subscribe', a, SELF).then(function (r) { return r.body; }); },
        listener: function (a) { return deliver(a.json); },
        // The sibling's own verb, as a remote's client mode routes the owner's ask to it (goal/G47.5).
        ping: function () { asked.push({ verb: 'sibling.ping', key: key }); return Promise.resolve({ pong: 'sibling' }); },
        // A peer that lets this node in: its node's door passes, and its server refuses remote as owner-only, as a real one
        // does (goal/G47.5; cw: "counts it when the answer is owner-only (or an answer at all), never not-granted or silence").
        remote: function () { asked.push({ verb: 'sibling.remote', key: key }); return Promise.reject({ status: 403, body: { ok: false, code: 'owner-only' } }); },
      });
    }
    // goal/G43.32, decided 3: on the node spirit.requireScript is a path-translating wrapper, a script's module at once.
    if (!/\/api\.js$/.test(q)) return require(path.join(RUN, q));
    return Promise.resolve({});
  },
  // A refusal keeps its status and body, as spirit.callOutcome does (the code is what the remote check reads, goal/G47.5).
  callOutcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: (e && e.status) || 500, body: (e && e.body) || { ok: false } }; }); },
  // What the server publishes to its own pages, kept (goal/G47.5: remote is published to them).
  eventStream: { published: [], publish: function (e) { fake.eventStream.published.push(e); }, subscribe: function () {} },
  // A server reports its DEBUG on its job (goal/G43.15); the stand-in node takes the report and keeps nothing.
  processJob: { report: function () { return Promise.resolve({ ok: true }); } },
  // Its DEBUG flag, as spirit.js keeps one: read with no argument, set with a boolean.
  debugLog: (function () { let on = false; return function (v) { if (typeof v === 'boolean') on = v; return on; }; }()),
};
const realLoad = Module._load;
const SPIRIT_OBJECT_FILE = path.join(RUN, 'spirit', 'script.js');
Module._load = function (request, parent) {
  // The spirit object by the file a require resolves to, spirit/script.js since goal/G49.12 (a script asks for it as
  // '../script.js', '../../script.js' and so on, which no test of the request's own name can tell from another script.js).
  if (parent && String(parent.filename).indexOf(RUN) === 0 && /script\.js$/.test(request)) {
    let at = '';
    try { at = Module._resolveFilename(request, parent); } catch (e) { at = ''; }
    if (at === SPIRIT_OBJECT_FILE) { globalThis.spirit = fake; return fake; }
  }
  return realLoad.apply(this, arguments);
};
globalThis.spirit = fake;
if (process.platform === 'win32') PIPE = LOADER.requireScript('spirit/appClient/script.js').pipePathFor(TMP, NAME, 'win32');
const childArgv = process.argv.slice();
process.argv = [process.argv[0], path.join(TMP, NAME + '.js'), '--pipe', PIPE];

let bootstrap = [];
let bootstraps = 0;
// The planted family's rows: an item each, filed by its id. Group a (a1, a2 ...) and group b, for a cache holding two.
const GOAL = { id: 'head', title: 'the head row' };
const item = function (n, extra, group) { return Object.assign({ id: (group || 'a') + n, title: 'item ' + n }, extra || {}); };
const row = function (f) { return { item: f }; };
// The client's cache file for the publisher (goal/G41.28, box v19; Andy: "this way an appServer in client-mode can derive
// the name of it's ./relay-state/<appServerName>/<server-public-key-in-base64>.json"): in spirit/state/<client server>/cache/
// (goal/G43.20: "cache, which is written by spirit/server/app/script.js was ALWAYS supposed to go into spirit/state/<name>/cache/"),
// named by the sender's key in base64url (Andy, Q9 of Desk: "Shall the server key in spirit.required.spirit.data and in the cache file
// name be base64url (- for +, _ for /), since a plain base64 / splits both?" "yes"): no + and no /, and it reads back
// to the sender's key.
const SENDER = Buffer.from(PUBLISHER, 'base64');
const namesSender = function (n) { return /^[A-Za-z0-9_-]+=*$/.test(n) && Buffer.from(n, 'base64url').equals(SENDER); };
const cacheFile = function (name) {
  const dir = path.join(RUN, 'spirit', 'state', name, 'cache');
  let found = '';
  try { found = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f) && namesSender(f.slice(0, -5)); })[0] || ''; } catch (e) { found = ''; }
  return found ? path.join(dir, found) : path.join(dir, SENDER.toString('base64url') + '.json');
};

function start(streamOpts, publisherOpts) {
  const A = LOADER.requireScript(SUBJECT);
  // whoami answers what the server was told of its caller (goal/G47.5, Q8: the shared server code tells a server loopback beside owner).
  const s = A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } },
    whoami: { request: {}, reply: { owner: false, loopback: false }, handler: function (a, caller) { return { owner: !!(caller && caller.owner === true), loopback: !!(caller && caller.loopback === true) }; } } }, {
    stream: Object.assign({ module: 'spirit.app.' + FAMILY, translator: TRANSLATOR }, streamOpts || {}),
    publisher: Object.assign({ family: NAME, bootstrap: function () { bootstraps += 1; return bootstrap.slice(); }, waitMs: 5000 }, publisherOpts || {}),
  });
  return { A: A, s: s, D: A.data };
}
// What the client's cache holds, asked of the family's data.js, which alone names its branches (goal/G41.28; Andy:
// "the client manager should keep that cache"): spirit.required.spirit.data.<family>.data, attached by appServer to the process's spirit.
const kept = function () { return (globalThis.spirit && ((globalThis.spirit.required.spirit.data || {})[FAMILY] || {}).data) || null; };
const itemOf = function (id) { const K = kept(); return K ? K.item(id) : null; };
const hasIn = function (D, n, group) { return !!itemOf((group || 'a') + n); };

// A SUBSCRIBE UNDER THIS NODE'S OWN KEY IS ITS PAGES' (goal/G47.5, part 2; Andy: "the node forwards a loopback connect to the
// as server as a normal request, so that spirit/server/app/script.js knows a loopback client connected and then, if in client mode
// stream the cache as normal events to loopback", "it will reach the app server with the local node's ID"): this node
// subscribes, and the rows of the push it is answered with are published to its own pages (the stand-in's event.publish),
// and none goes out by peerPost (the stand-in's deliveries).
async function selfSubscribe() {
  const publishedAt = fake.eventStream.published.length;
  const postsAt = posts.length;
  const status = (await post('subscribe', { branch: NAME }, SELF)).status;
  await tick(800);
  const ids = function (list) { const out = []; list.forEach(function (e) { (Array.isArray(e) ? e : [e]).forEach(function (x) { const r = x && (x.row || x); if (r && r.item && r.item.id) out.push(r.item.id); }); }); return out; };
  return { selfStatus: status, toPages: ids(fake.eventStream.published.slice(publishedAt)), byPost: ids(posts.slice(postsAt)) };
}
const allOf = function (list) { return Array.isArray(list) && ['head', 'a1', 'a2'].every(function (id) { return list.indexOf(id) !== -1; }); };

// ── a child: one process of a restart, or of a cache switch ────────────────────────────────────────────────────────
async function child(mode) {
  const out = {};
  const FAM = childArgv[6] || FAMILY;
  if (mode === 'first') {
    // Cache on: the first run of a client, its push landed.
    const { s, D } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.one = hasIn(D, 1); out.two = hasIn(D, 2);
    // THE CACHE BY SERVER NODE (box v19: "The RAM-CACHE-is organized BY SERVER-NODE-ID at it's lowest level. IE:
    // spirit.required.spirit.data.<server-public-key-in-base64>.<api-family>...."): what the data set holds at its top, and under it.
    const kept = (D && D.allBranches()) || [];
    const top = kept.map(function (b) { return b.split('/')[0]; }).filter(function (n, i, all) { return all.indexOf(n) === i; });
    out.top = top;
    out.byNode = top.filter(namesSender);
    out.family = out.byNode.length === 1 ? kept.filter(function (b) { return b.split('/')[0] === out.byNode[0]; }).map(function (b) { return b.split('/')[1]; }).filter(function (f, i, all) { return all.indexOf(f) === i; }) : [];
  } else if (mode === 'restart') {
    // The same client again, a new process: the publisher in it a new run. Its cache read back before any subscribe.
    const { s, D } = start({ cache: true });
    await tick(300);
    out.readOne = hasIn(D, 1); out.readTwo = hasIn(D, 2);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, renamed', version: 2 }))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.title = itemOf('a1') && itemOf('a1').title;
    out.two = hasIn(D, 2);
  } else if (mode === 'off' || mode === 'nofamily') {
    // off: no cache switch; nofamily: the switch on, but the sender's branch has no folder on this node.
    const { s } = start(mode === 'off' ? {} : { cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
  } else if (mode === 'every') {
    // The default limit: two groups of rows, both kept, every row of each (box v15: "The cache keeps everything the
    // server sends, every goal, no filtering on the client side").
    const { A, s } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish(row(item(i)));
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish(row(item(i, {}, 'b')));
    await tick(800);
    out.a = []; out.b = [];
    for (let i = 1; i <= 3; i++) { if (itemOf('a' + i)) out.a.push(i); if (itemOf('b' + i)) out.b.push(i); }
  } else if (mode === 'limit') {
    // Ten rows of group a, then ten of group b: together past the limit, the newest alone within it. The family it follows
    // (FAM) sheds: zzstream has no cache rules, so the app server's own default sheds the oldest first; zzshed's own shed
    // drops the newest. What stays is read from the cache file, which holds the kept rows, the family's translator or not.
    const { A, s } = start({ cache: { limit: 3500 } });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    const long = function (n) { return 'a row long enough to fill a small cache quickly, number ' + n + ' '.repeat(140) + '.'; };
    for (let i = 1; i <= 10; i++) { await tick(10); A.publish(row(item(i, { title: long(i) }))); }
    await tick(300);
    for (let i = 1; i <= 10; i++) { await tick(10); A.publish(row(item(i, { title: long(i) }, 'b'))); }
    await tick(1500);
    let file = null;
    try { file = JSON.parse(fs.readFileSync(cacheFile(NAME), 'utf8')); } catch (e) { file = null; }
    out.kept = file && Array.isArray(file.rows) ? file.rows.map(function (r) { return r && r.item ? r.item.id : ''; }) : [];
  }
  if (mode === 'clientCache') {
    // A SERVER IN CLIENT MODE CACHES ITS SIBLING (goal/G47.5; its box: "the replies and reply stream data are cached as they
    // are now, but also published to its own faces"; Andy, 2026-11-21: "it was ALWAYS obvious the me that a
    // spirit/server/app/script.js in client mode automatically caches the servers's state the way it always did", "deskClient
    // produces the EXACT same cache file as your own desk in client-mode"). A server with a publisher alone, as the desk is,
    // named for a family with a folder here, switched by its owner to the sibling, then sent a push and a row by it.
    globalThis.spirit.nodeFacts = Object.assign({}, globalThis.spirit.nodeFacts || {}, { key: SELF, label: 'this node' });
    const A = LOADER.requireScript(SUBJECT);
    A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, { publisher: { family: NAME, bootstrap: function () { return []; }, waitMs: 5000 } });
    await tick(300);
    const owner = function (body) {
      return new Promise(function (resolve) {
        const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': SELF, 'X-Spirit-Owner': '1', 'X-Spirit-Loopback': '1' } }, function (res) {
          res.resume(); res.on('end', function () { resolve(res.statusCode); });
        });
        req.on('error', function () { resolve(0); });
        req.end(JSON.stringify(body));
      });
    };
    out.switched = await owner({ remote: { id: PUBLISHER } });
    await tick(300);
    const push = [{ run: 'r1', n: 1, full: true, row: row(GOAL) }, { run: 'r1', n: 2, full: true, row: row(item(1)) }, { run: 'r1', n: 2, end: true }];
    out.pushed = (await post('listener', { json: JSON.stringify(push) }, PUBLISHER)).status;
    out.streamed = (await post('listener', { json: JSON.stringify([{ run: 'r1', n: 3, row: row(item(2)) }]) }, PUBLISHER)).status;
    await tick(800);
    let file = null;
    try { file = JSON.parse(fs.readFileSync(cacheFile(NAME), 'utf8')); } catch (e) { file = null; }
    out.file = file ? { key: file.key, run: file.run, n: file.n, ids: Array.isArray(file.rows) ? file.rows.map(function (r) { return r && r.item ? r.item.id : ''; }) : [] } : null;
    Object.assign(out, await selfSubscribe());
  }
  if (mode === 'selfServer') {
    // The same in server mode: its push is its bootstrap.
    globalThis.spirit.nodeFacts = Object.assign({}, globalThis.spirit.nodeFacts || {}, { key: SELF, label: 'this node' });
    const A = LOADER.requireScript(SUBJECT);
    A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, { publisher: { family: NAME, bootstrap: function () { return [row(GOAL), row(item(1)), row(item(2))]; }, waitMs: 5000 } });
    await tick(300);
    Object.assign(out, await selfSubscribe());
  }
  if (mode === 'publisherOnly' || mode === 'streamOnly') {
    // A server of one side alone (goal/G47.5): a publisher with no stream, as the desk is, or a stream with no publisher, as
    // deskClient is. It reports the verbs its api tree names.
    const A = LOADER.requireScript(SUBJECT);
    const one = mode === 'publisherOnly'
      ? { publisher: { family: NAME, bootstrap: function () { return []; }, waitMs: 5000 } }
      : { stream: { module: 'spirit.app.' + FAM, translator: TRANSLATOR } };
    A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, one);
    await tick(300);
    out.verbs = await new Promise(function (resolve) {
      const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': SELF, 'X-Spirit-Owner': '1', 'X-Spirit-Loopback': '1' } }, function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve(b ? Object.keys(b).sort() : []); });
      });
      req.on('error', function () { resolve([]); });
      req.end(JSON.stringify('api'));
    });
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n');
  process.exit(0);
}
function runChild(mode, name, fam) {
  const r = spawnSync(process.execPath, [SELF_FILE, '--child', mode, TMP, name, fam || FAMILY], { encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('RESULT ') === 0; })[0];
  try { return JSON.parse(line.slice(7)); } catch (e) { return {}; }
}
function clearCache(name) { [path.join(RUN, 'spirit', 'state', name)].forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* none */ } }); }

// ── the tree: one family path, a folder per server (box v15, Family folders) ─────────────────────────────────────────────
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
  const VENDORED_FOLDERS = LOADER.requireScript('spirit/fs/fileSystem.js').VENDORED_FOLDERS;
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (VENDORED_FOLDERS.holds(p) || d.name === '.git' || p === path.join(RUN, 'brains') || p === path.join(RUN, 'spirit', 'state')) return;
      codeFiles(p, out);
    } else if (/\.(js|html)$/.test(d.name)) out.push(p);
  });
  return out;
}


// THE SHARED GATE, EVERY PERMUTATION, IN MEMORY (goal/G41.30, the box: "Test the shared gate once, in full. appServer's
// one check guards every verb with a request shape. Every permutation is thrown at that check directly, in memory:
// thousands a second, no network."). The check is appServer's matches(request, args), which route() asks for every verb
// without a check of its own. Each request shape below is given, key by key, each of the box's kinds ("EVERY ARGUMENT gets
// tested with EVERY javascript object type ... PLUS: \"missing\" and \"extraneous\""): JSON.parse's six types, the key
// missing, an extraneous key beside it. Then every pair of keys in every pair of kinds ("Pairs, not every combination"),
// and every combination where a shape has 3 keys or fewer. The value of the shape's own types passes; every other is refused.
function gateSection() {
  const SHAPES = {
    'one string': { name: '' },
    'a string and a number': { id: '', n: 0 },
    'three of three types': { id: '', on: false, n: 0 },
    'four, an array among them': { id: '', tags: [''], on: false, n: 0 },
    'five, an object among them': { id: '', text: '', version: 0, on: false, opts: { a: '' } },
    'one nested two deep': { id: '', where: { path: '', depth: 0 } },
  };
  const KINDS = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing', 'extraneous'];
  // A JSON value of a kind, as it arrives over the wire (JSON.parse makes no date: a date is a string).
  function valueOf(kind) {
    return kind === 'string' ? 'garbage' : kind === 'number' ? 12345 : kind === 'boolean' ? true : kind === 'null' ? null
      : kind === 'object' ? { x: 1 } : kind === 'array' ? ['x'] : undefined;
  }
  // The kind a shape's own value is.
  function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v; }
  // The shape's own value, which must pass: each key its own type ('' a string, 0 a number, [x] an array of x).
  function own(v) { return Array.isArray(v) ? [own(v[0])] : v && typeof v === 'object' ? Object.keys(v).reduce(function (o, k) { o[k] = own(v[k]); return o; }, {}) : v; }
  // The args with the keys in `set` given the kinds named; a kind the key already is, is not garbage.
  function made(shape, set) {
    const out = own(shape);
    Object.keys(set).forEach(function (k) {
      const kind = set[k];
      if (kind === 'missing') delete out[k];
      else if (kind === 'extraneous') out[k + 'Extra'] = 'garbage';
      else out[k] = valueOf(kind);
    });
    return out;
  }
  // An object of other keys is garbage for an object key: the gate wants exactly its keys.
  function garbage(shape, set) { return Object.keys(set).some(function (k) { return set[k] === 'missing' || set[k] === 'extraneous' || set[k] !== kindOf(shape[k]) || set[k] === 'object'; }); }
  let asks = 0;
  // One shape thrown at the gate: true, or what it got wrong.
  function judge(title) {
    const A = LOADER.requireScript(SUBJECT);
    const shape = SHAPES[title];
    const keys = Object.keys(shape);
    const wrong = [];
    let n = 0;
    function ask(set) {
      n += 1;
      const passed = A.matches(shape, made(shape, set));
      const should = !garbage(shape, set);
      if (passed !== should) wrong.push(set);
    }
    ask({});
    // Each key, each kind.
    keys.forEach(function (k) { KINDS.forEach(function (kind) { const s = {}; s[k] = kind; ask(s); }); });
    // Every pair of keys, every pair of kinds.
    keys.forEach(function (k1, i) { keys.slice(i + 1).forEach(function (k2) {
      KINDS.forEach(function (a) { KINDS.forEach(function (b) { const s = {}; s[k1] = a; s[k2] = b; ask(s); }); });
    }); });
    // Every combination, where a shape has 3 keys or fewer.
    if (keys.length <= 3) {
      (function every(i, s) {
        if (i === keys.length) { ask(Object.assign({}, s)); return; }
        KINDS.forEach(function (kind) { s[keys[i]] = kind; every(i + 1, s); });
        delete s[keys[i]];
      }(0, {}));
    }
    // A nested shape's inner keys, each kind.
    keys.filter(function (k) { return kindOf(shape[k]) === 'object'; }).forEach(function (k) {
      Object.keys(shape[k]).forEach(function (inner) { KINDS.forEach(function (kind) {
        n += 1;
        const args = own(shape);
        if (kind === 'missing') delete args[k][inner];
        else if (kind === 'extraneous') args[k][inner + 'Extra'] = 'garbage';
        else args[k][inner] = valueOf(kind);
        const should = kind !== 'missing' && kind !== 'extraneous' && kind === kindOf(shape[k][inner]);
        if (A.matches(shape, args) !== should) wrong.push(args);
      }); });
    });
    asks += n;
    return !wrong.length || false;
  }
  test.run('a request of one string (name): its own value passes and every garbage one is refused', 0.2, function () { return judge('one string'); }, test.limit.quick);
  test.run('a request of a string and a number (id, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('a string and a number'); }, test.limit.quick);
  test.run('a request of three of three types (id, on, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('three of three types'); }, test.limit.quick);
  test.run('a request of four, an array among them (id, tags, on, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('four, an array among them'); }, test.limit.quick);
  test.run('a request of five, an object among them (id, text, version, on, opts): its own value passes and every garbage one is refused', 0.2, function () { return judge('five, an object among them'); }, test.limit.quick);
  test.run('a request of one nested two deep (id, where): its own value passes and every garbage one is refused', 0.2, function () { return judge('one nested two deep'); }, test.limit.quick);
  test.run('every permutation of the listed argument kinds was thrown at it, in more than a thousand asks', 0.2, function () {
    return asks > 1000 || false;
  }, test.limit.quick);
  // A VERB WITH A CHECK OF ITS OWN SKIPS THE GATE (appServer.js route: its own accepts() if it has one, else matches):
  // its own check is the only one, so the gate's test does not cover it; the deep garbage goes to those verbs.
  const G = { seen: [], r: null };
  test.run('a verb with an accepts() of its own is asked that alone: garbage it lets through reaches its handler', 0.2, async function () {
    const A = LOADER.requireScript(SUBJECT);
    const s = A.createAppServer({
      own: { request: { id: '' }, reply: {}, accepts: function (a) { G.seen.push(a); return true; }, handler: function () { return {}; } },
      shared: { request: { id: '' }, reply: {}, handler: function () { return {}; } },
    });
    G.r = await Promise.all([s.route({ own: { garbage: 12345 } }), s.route({ shared: { garbage: 12345 } })]);
    return (G.seen.length === 1 && G.r[0].status === 200) || false;
  }, test.limit.quick);
  test.run('a verb with no check of its own is refused that garbage by the gate', 0.2, function () {
    if (!G.r) return false;
    return (!!G.r[1].body && G.r[1].body.code === 'no-such-argument') || false;
  }, test.limit.quick);
}

// The parts ran each in a process of its own before they were folded in: the stand-in spirit.js, the module loader and
// the argv this file set up for its own server are put back, so they find the real spirit object as they did. Done once,
// at the first test of the parts that needs it (the stream checks before them run on the stand-in).
let realPutBack = false;
function putBackTheRealSpirit() {
  if (realPutBack) return;
  realPutBack = true;
  Module._load = realLoad;
  globalThis.spirit = require(path.join(RUN, 'spirit', 'script.js'));
  process.argv = childArgv;
}

// THE AGENTSFILE PART, once appServer-agentsFile.js.
function agentsFilePart() {
  // Once spirit/run/spirit/test/appServer-agentsFile.js.
  // THE AGENT'S AGENTS.md THROUGH spirit.required.spirit.fs.api.loadFile AT ITS PATH (goal/G43.27, requirement 8; spec: ./script.md),
  // not through the family's FS: appServer.js's AGENTS paragraph. Andy: "easily changed, no?". appServer.js read as it is.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');

  // Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
  function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

  // appServer-agentsFile: the agent's AGENTS.md through spirit.required.spirit.fs.api.loadFile at its path (goal/G43.27), 8.
  let block = '';
  test.run('appServer.js\'s AGENTS paragraph is read', 0.2, function () {
    putBackTheRealSpirit();
    const as = read('spirit/server/app/script.js');
    block = (as.match(/AGENTS: AN APP'S RULES FOR AGENTS[\s\S]*?\n\n/) || [''])[0];
    return block.length > 100 || false;
  }, test.limit.quick);
  test.run('it says AGENTS.md is read with spirit.required.spirit.fs.api.loadFile at its path', 0.2, function () {
    return (/spirit\.fs\.loadFile/.test(block) && !/family's FS|FS\.loadFile \{path: "AGENTS\.md"\}/.test(block)) || false;
  }, test.limit.quick);
}

// The mount part, the node starting a server from spirit/app/<name>/, is job.js's: ./job.js (goal/G47.1).

// THE STATECACHE PART, once appServer-stateCache.js.
function stateCachePart() {
  // Once spirit/run/spirit/test/appServer-stateCache.js.
  // The tests of spirit/server/app/script.js by name: ITS CACHE IN spirit/state/<name>/cache/ (goal/G43.20, its box; spec:
  // ./script.md). Andy: "cache, which is written by spirit/server/app/script.js was ALWAYS supposed to go into
  // spirit/state/<name>/cache/", and "NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs." A throwaway
  // follower app, planted in a scratch copy of the tracked files, is run as the node runs a server: what it kept is read back
  // at its start, and its saveCaches (deskClient's cache.dump) writes it again. Never a live node.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, spawnSync, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  let until, sleep;

  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  const NAME = 'follower';
  // A sender whose family has a data.js on the node, so what is kept of it comes back: zzkept, planted in the scratch tree
  // beside the follower (goal/G47.4: a test names no app of the tree as its fixture).
  const SENDER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';
  const FAMILY = 'zzkept';

  // appServer-stateCache: appServer reads and writes its cache in spirit/state/<name>/cache/, and nowhere else (goal/G43.20)
  let root = '', run = '', id = '', state = '', cache = '';
  const kids = [];
  test.after(async function () {
    kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
    await new Promise(function (r) { setTimeout(r, 300); });
    if (root) { try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  });
  // One start of the follower over a kept file planted at where: what came back, and what it saved.
  const startWith = async function (where) {
    fs.rmSync(state, { recursive: true, force: true });
    fs.mkdirSync(where, { recursive: true });
    fs.writeFileSync(path.join(where, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: where }] }));
    const seen = path.join(root, 'seen-' + kids.length + '.json');
    const saved = path.join(root, 'saved-' + kids.length + '.json');
    const pipe = require(path.join(run, 'spirit', 'appClient', 'script.js')).pipePathFor(root, NAME, process.platform, 'app');
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
    kids.push(kid);
    await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
    await sleep(200);
    try { kid.kill(); } catch (e) { /* gone */ }
    return { seen: readJson(seen), saved: readJson(saved) };
  };
  const noTree = function () { return !id; };
  test.run('the sender\'s file name is its node id', 0.2, function () {
    putBackTheRealSpirit();
    ({ until, sleep } = LOADER.requireScript('spirit/test/headLessChrome.js'));
    root = ownTemp('spirit-state-cache-');
    execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
      .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    run = path.join(root, 'spirit', 'run');
    const app = path.join(run, 'spirit', 'app', NAME);
    fs.mkdirSync(app, { recursive: true });
    const fam = path.join(run, 'spirit', 'app', FAMILY);
    fs.mkdirSync(fam, { recursive: true });
    fs.writeFileSync(path.join(fam, 'api.js'), 'module.exports = { verbs: {} };\n');
    fs.writeFileSync(path.join(fam, 'data.js'), 'module.exports = {};\n');
    // The follower: a server of spirit/app/ following a stream with its cache on. Its translator says by a file what came
    // back; once read back, it saves its caches (saveCaches) and says which files it wrote.
    fs.writeFileSync(path.join(app, 'rows.js'), [
      "const D = require('../../data/script.js');",
      "D.addTranslator({ onJob: function (job) { if (job && job.app) require('fs').writeFileSync(process.env.ROW_SEEN, JSON.stringify(job.app)); } });",
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(app, NAME + '.js'), [
      "require('../../script.js');",
      "const path = require('path');",
      "const S = require('../../server/app/script.js');",
      "S.serve({}, { stream: { translator: path.join(__dirname, 'rows.js'), cache: true, module: 'a.test' } });",
      "setTimeout(function () { require('fs').writeFileSync(process.env.SAVED, JSON.stringify(S.saveCaches())); }, 1500);",
    ].join('\n') + '\n');
    const nodeId = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./spirit/data/script.js').nodeId(" + JSON.stringify(SENDER) + "))"], { cwd: run, encoding: 'utf8' }).stdout;
    state = path.join(run, 'spirit', 'state', NAME);
    cache = path.join(state, 'cache');
    if (nodeId.length > 10) id = nodeId;
    return nodeId.length > 10 || false;
  }, test.limit.quick);

  // "cache ... was ALWAYS supposed to go into spirit/state/<name>/cache/": read back from there
  let inCache = null;
  test.run('what it kept in spirit/state/follower/cache/ comes back at its start', 0.2, async function () {
    if (noTree()) return false;
    inCache = await startWith(cache);
    return (!!inCache.seen && inCache.seen.kept === cache) || false;
  }, test.limit.slow);
  test.run('its cache.dump writes the cache there again, as spirit/state/follower/cache/<id>.json', 0.2, function () {
    if (!inCache) return false;
    const wrote = Array.isArray(inCache.saved) ? inCache.saved.map(function (f) { return f.file; }) : [];
    return (wrote.indexOf(id + '.json') !== -1 && fs.existsSync(path.join(cache, id + '.json'))) || false;
  }, test.limit.quick);
  test.run('no cache file is written in spirit/state/follower/ itself', 0.2, function () {
    if (noTree()) return false;
    const top = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return /\.json$/.test(f) && f !== 'node.json'; }) : [];
    return !top.length || false;
  }, test.limit.quick);


  // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
  // startWith plants a good file; each case below then spoils cache/ before the follower starts again.
  const spoiled = async function (spoil) {
    fs.rmSync(state, { recursive: true, force: true });
    fs.mkdirSync(cache, { recursive: true });
    spoil();
    const seen = path.join(root, 'seen-x' + kids.length + '.json');
    const saved = path.join(root, 'saved-x' + kids.length + '.json');
    const pipe = require(path.join(run, 'spirit', 'appClient', 'script.js')).pipePathFor(root, NAME, process.platform, 'app');
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
    kids.push(kid);
    const up = await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
    await sleep(200);
    try { kid.kill(); } catch (e) { /* gone */ }
    return { up: !!up, seen: readJson(seen), saved: readJson(saved) };
  };
  const OTHER = 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ=';
  // the attacker: a file named for one sender, holding another's key
  test.run('a cache file named for one sender but holding another\'s key is not read, because a file is read only under its own sender\'s name', 0.8, async function () {
    if (noTree()) return false;
    const swapped = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: OTHER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'swapped' }] })); });
    return (swapped.up && !swapped.seen) || false;
  }, test.limit.slow);
  // the attacker: only a half-written .tmp, as a kill leaves it
  test.run('a .tmp is never read back', 0.2, async function () {
    if (noTree()) return false;
    const half = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json.tmp'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'half' }] })); });
    return (half.up && !half.seen) || false;
  }, test.limit.slow);
  // the attacker: a cache file that is no JSON, and one that is JSON of the wrong shape
  test.run('with a broken cache file the server still starts, reads nothing back, and saves', 0.2, async function () {
    if (noTree()) return false;
    const broken = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), '{"key": "' + SENDER + '", "rows": [ {"kept": '); });
    return (broken.up && !broken.seen && Array.isArray(broken.saved)) || false;
  }, test.limit.slow);
  test.run('with cached rows that are no list, nothing is read back and the server saves on', 0.2, async function () {
    if (noTree()) return false;
    const shape = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 7, n: -3, rows: 'not a list' })); });
    return (shape.up && !shape.seen && Array.isArray(shape.saved)) || false;
  }, test.limit.slow);
  test.run('after all of it spirit/state/follower/ holds nothing beside cache/ and its socket', 0.2, function () {
    if (noTree()) return false;
    const strays = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return ['cache', 'data', 'node.json', 'door.sock'].indexOf(f) === -1; }) : [];
    return !strays.length || false;
  }, test.limit.quick);
}

// ── its own checks: one stream protocol for every server (goal/G41.11, goal/G41.12) ─────────────────────────────────────
function ownPart() {
  // An app server's api.js by its path (goal/G49.6; Andy: "spirit.branchPath() must die."): appServer asks every server it
  // reaches by its app's api.js path, spirit/app/<name>/api.js.
  test.run('appServer exports appApiPath', 0.2, function () {
    const A0 = LOADER.requireScript(SUBJECT);
    return typeof A0.appApiPath === 'function' || false;
  }, test.limit.quick);
  test.run('the appApiPath of an app named <name> is spirit/app/<name>/api.js', 0.2, function () {
    const A0 = LOADER.requireScript(SUBJECT);
    // The planted family, an app of spirit/app/ for this run (goal/G47.4: no app of the tree named as a fixture).
    const fp = typeof A0.appApiPath === 'function' ? A0.appApiPath(FAMILY) : null;
    return fp === 'spirit/app/' + FAMILY + '/api.js' || false;
  }, test.limit.quick);
  // Apps of spirit/app/ since goal/G43.27: the family's interface at the top of the app folder, no family/ left. Every
  // app folder of the tree, read from the folder, so a new one is judged the day it lands.
  test.run('no app folder of spirit/app/ holds a branch/ folder', 0.2, function () {
    const apps = path.join(RUN, 'spirit', 'app');
    let names = [];
    try { names = fs.readdirSync(apps, { withFileTypes: true }).filter(function (d) { return d.isDirectory(); }).map(function (d) { return d.name; }); } catch (e) { names = []; }
    return (names.length > 0 && !names.some(function (n) { return fs.existsSync(path.join(apps, n, 'family')); })) || false;
  }, test.limit.quick);
  // Andy, goal/G41.28: "all, KILL deskAgent!". The server goes, its folder and every file that names it.
  test.run('no file names the deskAgent server', 0.2, function () {
    const namers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && /['"]deskAgent\/|deskAgent\.js\b/.test(fs.readFileSync(f, 'utf8')); });
    return namers.length === 0 || false;
  }, test.limit.quick);
  // No file but appServer writes a family path: no <name>.family, no family/api.js, no join onto 'family'. This file
  // routes by the pattern and is left out; so are appServer.js and spirit.js: the browser cannot load appServer, so
  // spirit.js holds the function and appServer hands out the same one (cw, goal/G41.12 Q3).
  // A join onto 'family' is a path; a bare 'family' is no path since goal/G41.14, where it names a column and a field
  // (Andy: "these four following NAMES will be used in SpiritOS: bundle > branch > family > verb").
  const FAMILY_PATH_WRITTEN = [/\.family(?=['"`\/\\]|$)/m, /(^|[^\\])\/?family\/api\.js/, /join\([^)]*['"`]family['"`]\s*[),]/];
  test.run('no file but appServer and spirit.js writes a family path', 0.2, function () {
    const SPIRIT_JS = path.join(RUN, 'spirit', 'script.js');
    const writers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && f !== SPIRIT_JS; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return FAMILY_PATH_WRITTEN.some(function (re) { return re.test(t); });
    });
    return writers.length === 0 || false;
  }, test.limit.quick);

  // goal/G41.24: DEPENDENCIES is gone
  // Andy, box: "DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder
  // itself." No code file names the verb or hands serve() a dependencies list; this file names it to look for it. The desk
  // folder's own part is desk's own test's (goal/G47.4, wsl at 2b6b8b30).
  test.run('no code file names DEPENDENCIES or hands serve() a dependencies list', 0.2, function () {
    // A test may name it to look for it, as this one and the desk's own do; product code may not.
    const named = codeFiles(RUN, []).filter(function (f) { return f !== SELF_FILE && !/[\\/]test[\\/]/.test(f); }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return /DEPENDENCIES/.test(t) || /\bdependencies\s*:/.test(t) || /opts\.dependencies|withDependencies|checkDependencies/.test(t);
    });
    return named.length === 0 || false;
  }, test.limit.quick);

  // goal/G43.20: no <name>Bundles.json is left
  // The box: "spirit/app/desk/deskBundles.json, deskClient/deskClientBundles.json and ... are
  // deleted. Bundles stay what they are, rows in node.db, made and changed through auth.bundle."
  test.run('no app folder holds a <name>Bundles.json', 0.2, function () {
    const bundleFiles = jsonFiles(path.join(RUN, 'spirit', 'app'), []).filter(function (f) { return /Bundles\.json$/.test(f); });
    return bundleFiles.length === 0 || false;
  }, test.limit.quick);

  // What went (box v15), the desk's bundled() and deskClient's own cache.json, is judged in those apps' own tests (goal/G47.4,
  // wsl at 2b6b8b30), not here.

  // ── one process: a client following its own publisher ──────────────────────────────────────────────────────────
  // goal/G41.24: a stream's translator is its family's data.js; the stream checks below follow the planted family's.
  const O = { A: null, s: null, D: null };
  const has = function (n) { return hasIn(O.D, n); };
  const noServer = function () { return !O.D || !O.s || typeof O.s.subscribe !== 'function'; };
  test.run('the app server serves, keeps a data set and has its client half, subscribe', 0.2, async function () {
    const { A, s, D } = start({}, { logMax: 5 });
    O.A = A; O.s = s; O.D = D;
    await tick(100);
    return (!!D && typeof D.getPath === 'function' && !!s && typeof s.subscribe === 'function') || false;
  }, test.limit.quick);

  // the first subscribe: a full push
  test.run('a subscribe follows the publisher\'s key and asks its branch to subscribe it', 0.2, async function () {
    if (noServer()) return false;
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    const first = await O.s.subscribe(PUBLISHER, NAME);
    await tick(300);
    return (first === true && asked.some(function (a) { return a.verb === 'subscribe' && a.key === PUBLISHER; }) && asked.some(function (a) { return a.verb === 'auth.grant'; }))
      || false;
  }, test.limit.quick);
  test.run('the bootstrap lands in the cache with both items', 0.2, function () {
    if (noServer()) return false;
    return (has(1) && has(2)) || false;
  }, test.limit.quick);
  test.run('every delivery is a bundle, one JSON array of rows in one peerPost', 0.2, function () {
    return (posts.length > 0 && posts.every(Array.isArray)) || false;
  }, test.limit.quick);

  // rows that back up go as bundles (box v15)
  let before = 0;
  test.run('twenty rows published, twenty landed', 0.2, async function () {
    if (noServer()) return false;
    before = posts.length;
    gate.held = true;
    O.A.publish(row(item(10)));
    await tick(50);
    for (let i = 11; i < 30; i++) O.A.publish(row(item(i)));
    await tick(300);
    release();
    await tick(800);
    const landed = []; for (let i = 10; i < 30; i++) if (has(i)) landed.push(i);
    return landed.length === 20 || false;
  }, test.limit.slow);
  test.run('nineteen rows backed up behind a held one went in a bundle, not one peerPost each', 0.2, function () {
    if (noServer()) return false;
    return posts.length - before <= 3 || false;
  }, test.limit.quick);

  // the position: a subscribe again is handed what came after it, no push (box v15)
  let again = null;
  test.run('dropped by a refused delivery, it subscribes again and is handed the rows it missed', 0.2, async function () {
    if (noServer()) return false;
    before = bootstraps;
    gate.refuse = true;
    O.A.publish(row(item(30)));
    await tick(300);
    gate.refuse = false;
    O.A.publish(row(item(31)));
    O.A.publish(row(item(32)));
    O.A.publish(Object.assign(row(item(33)), { to: ['KEY-SOMEONE-ELSE'] }));
    await tick(100);
    // The new bootstrap holds no item 2: a full push would sweep it.
    bootstrap = [row(GOAL), row(item(1))];
    again = await O.s.subscribe(PUBLISHER, NAME);
    await tick(500);
    return (again === true && has(30) && has(31) && has(32)) || false;
  }, test.limit.slow);
  // THE APP SERVER READS NO FIELD OF A ROW (goal/G48.8; Andy: "GET RID OF THAT FUCKING SHIT IN THE APPSERVER!", "GET RID OF
  // ANY TEST THAT ASSERTS THAT SHIT!"): a row naming keys in a to of its own is handed to every subscriber, as any row is.
  test.run('a row naming another key in its to is handed all the same, in the subscribe again\'s catch-up', 0.2, function () {
    if (noServer()) return false;
    return (again === true && has(32) && has(33)) || false;
  }, test.limit.quick);
  test.run('a row naming another key in its to is delivered all the same when it is published live', 0.2, async function () {
    if (noServer() || again !== true) return false;
    O.A.publish(Object.assign(row(item(34)), { to: ['KEY-SOMEONE-ELSE'] }));
    await tick(500);
    return has(34) || false;
  }, test.limit.slow);
  test.run('spirit/server/app/script.js reads no to of a row', 0.2, function () {
    let t = '';
    try { t = fs.readFileSync(FILE, 'utf8'); } catch (e) { t = ''; }
    return (t !== '' && !/\brow\.to\b|\.to\.map\(|function forKey\(/.test(t)) || false;
  }, test.limit.quick);
  test.run('the sender\'s log answers the subscribe again, with no bootstrap, and the cache is not replaced', 0.2, function () {
    if (noServer()) return false;
    return (bootstraps === before && has(2)) || false;
  }, test.limit.quick);
  test.run('the subscribe again carries the position the client holds', 0.2, function () {
    const subArgs = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; });
    const last = subArgs[subArgs.length - 1] || {};
    return (subArgs.length >= 2 && JSON.stringify(last) !== JSON.stringify(subArgs[0])) || false;
  }, test.limit.quick);

  // goal/G41.15, Andy: "make sure the deskClient doesn't loose cached info outside the current goal", Q1: "nothing
  // drops from the cache, unless the api.js from the server says so", and the box: "a goal pushed whole takes
  // precedence, and the client's place in the stream moves to that push".
  // older than the bounded log: a full push takes precedence and drops nothing (goal/G41.15)
  test.run('with nine rows missed past a log of five, the sender pushes in full', 0.2, async function () {
    if (noServer()) return false;
    before = bootstraps;
    gate.refuse = true;
    O.A.publish(row(item(40)));
    await tick(300);
    gate.refuse = false;
    for (let i = 41; i < 50; i++) O.A.publish(row(item(i)));
    await tick(100);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, pushed' }))];
    await O.s.subscribe(PUBLISHER, NAME);
    await tick(600);
    return bootstraps === before + 1 || false;
  }, test.limit.slow);
  test.run('the push takes precedence, so a row it carries replaces the one kept', 0.2, function () {
    if (noServer()) return false;
    const one1 = itemOf('a1');
    return (!!one1 && one1.title === 'item 1, pushed') || false;
  }, test.limit.quick);
  test.run('the push drops nothing it does not carry, so items the push leaves out stay kept', 0.2, function () {
    if (noServer()) return false;
    return (has(2) && has(30)) || false;
  }, test.limit.quick);
  test.run('a row never delivered is not invented by the push', 0.2, function () {
    if (noServer()) return false;
    return !has(45) || false;
  }, test.limit.quick);
  // The read-pointer: the push landed, so the client stands at the push's number; a subscribe again is answered from
  // the log, with no second push and nothing from before it.
  test.run('its place in the stream moved to the push, so subscribed again it is handed nothing older and pushed nothing again', 0.2, async function () {
    if (noServer()) return false;
    const pushedAt = bootstraps;
    const subsBefore = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    await O.s.subscribe(PUBLISHER, NAME);
    await tick(400);
    const lastSub = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; }).pop() || {};
    // The push's own end, as the sender sent it: { run, n, full, end }.
    const ends = [].concat.apply([], posts.filter(Array.isArray)).filter(function (e) { return e && e.full === true && e.end === true; });
    const pushEnd = ends[ends.length - 1] || {};
    return (asked.filter(function (a) { return a.verb === 'subscribe'; }).length === subsBefore + 1 && bootstraps === pushedAt && lastSub.since === pushEnd.n && lastSub.run === pushEnd.run)
      || false;
  }, test.limit.quick);

  // goal/G41.22, Andy: "take the 3 seconds out, appServer.js calls peerPost in the most basic way": a subscriber that
  // answers late, within the publisher's own wait, is no subscriber gone (traced 2026-10-30: the node's one sending slot
  // held deliveries 4 to 7 s, and a 3 s race dropped a live client every time).
  // a late answer is no drop: a delivery is a plain peerPost (goal/G41.22)
  const L = { subs: 0, boots: 0, posts: 0 };
  test.run('rows held 4 s, past the old 3 s, still land and none is dropped', 0.2, async function () {
    if (noServer()) return false;
    L.subs = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    L.boots = bootstraps;
    L.posts = posts.length;
    gate.held = true;
    O.A.publish(row(item(60)));
    await tick(50);
    O.A.publish(row(item(61)));
    O.A.publish(row(item(62)));
    await tick(4000);
    release();
    await tick(400);
    return (has(60) && has(61) && has(62)) || false;
  }, test.limit.slow);
  test.run('what piled up while the first was out goes in one bundle after it', 0.2, function () {
    if (noServer()) return false;
    const sentLate = posts.slice(L.posts).filter(Array.isArray);
    return (sentLate.length === 2 && sentLate[1].length === 2) || false;
  }, test.limit.quick);
  test.run('the subscriber was never dropped, so the next row comes with no subscribe again and no push', 0.2, async function () {
    if (noServer()) return false;
    O.A.publish(row(item(63)));
    await tick(300);
    const subs = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    return (has(63) && bootstraps === L.boots && subs === L.subs)
      || false;
  }, test.limit.quick);
  test.run('appServer.js races no delivery and no subscribe against a clock of its own', 0.2, function () {
    return !/FAST_MS|Promise\.race/.test(fs.readFileSync(FILE, 'utf8')) || false;
  }, test.limit.quick);

  // ── remote: one server, two modes (goal/G47.5, box v12; Andy: "for a always-on server it would always run in one of two
  // modes. by default it runs in server mode.", "go") ────────────────────────────────────────────────────────────
  // The auto-verb remote, asked of the server above on its pipe: by its owner over loopback, and by a peer. This node is
  // SELF; the sibling it switches to is PUBLISHER, whose family under its key answers ping as the sibling.
  const R = {};
  const asOwner = function (verb, args) {
    return new Promise(function (resolve) {
      const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': SELF, 'X-Spirit-Owner': '1', 'X-Spirit-Loopback': '1' } }, function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve({ status: res.statusCode, body: b }); });
      });
      req.on('error', function () { resolve({ status: 0, body: null }); });
      // The tree is asked as the bare word api (appServer.js route); a verb as { verb: args }.
      req.end(JSON.stringify(verb === 'api' ? 'api' : { [verb]: args }));
    });
  };
  const remoteFile = path.join(RUN, 'spirit', 'state', NAME, 'remote.json');
  // EACH SUBSCRIBER'S RETURN ADDRESS, KEPT (goal/G47.5; Andy: "so the \"subscribe\" verb needs to carry a return address.",
  // "it probably needs to be stored in the server-apps node-owned state? spirit/state/<server-app>/clientListeners.json",
  // "go!"): a subscribe's key and the branch it names are written there, so a restart delivers to the same branch; an
  // unsubscribe takes the key out. The file's shape is the builder's: the key and its branch are looked for in it.
  const listenersFile = path.join(RUN, 'spirit', 'state', NAME, 'clientListeners.json');
  const SUB_KEY = 'KEY-ZZSUBSCRIBER';
  const listenersText = function () { try { return fs.readFileSync(listenersFile, 'utf8'); } catch (e) { return ''; } };
  test.after(function () { try { fs.rmSync(listenersFile, { force: true }); } catch (e) { /* none */ } });
  test.run('a subscribe writes its key and the branch it names to spirit/state/<server>/clientListeners.json', 0.2, async function () {
    if (noServer()) return false;
    const r = await post('subscribe', { branch: 'zzbranch' }, SUB_KEY);
    if (!(r.status === 200 && r.body && r.body.subscribed === true)) return false;
    let j = null;
    try { j = JSON.parse(listenersText()); } catch (e) { j = null; }
    const t = JSON.stringify(j);
    return !!j && t.indexOf(SUB_KEY) !== -1 && t.indexOf('zzbranch') !== -1 || false;
  }, test.limit.quick);
  test.run('an unsubscribe takes its key out of clientListeners.json', 0.2, async function () {
    if (noServer()) return false;
    if (listenersText().indexOf(SUB_KEY) === -1) return false;
    await post('unsubscribe', {}, SUB_KEY);
    const t = listenersText();
    return t !== '' && t.indexOf(SUB_KEY) === -1 || false;
  }, test.limit.quick);
  // LOOPBACK BESIDE OWNER (goal/G47.5; Andy: "the checkmark in the agent-bubble that can only be set via loopback"; Q8): a call
  // the node's loopback door took carries its X-Spirit-Loopback mark, and the server is told loopback: true beside owner; an
  // owner's call without that mark, a puppeteered one, is owner alone.
  const asOwnerOnly = function (verb, args) {
    return new Promise(function (resolve) {
      const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': SELF, 'X-Spirit-Owner': '1' } }, function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve({ status: res.statusCode, body: b }); });
      });
      req.on('error', function () { resolve({ status: 0, body: null }); });
      req.end(JSON.stringify({ [verb]: args }));
    });
  };
  test.run('the owner\'s call through the loopback door reaches the server as owner and loopback', 0.2, async function () {
    if (noServer()) return false;
    const r = await asOwner('whoami', {});
    return r.status === 200 && !!r.body && r.body.owner === true && r.body.loopback === true || false;
  }, test.limit.quick);
  test.run('the owner\'s call without the loopback mark reaches the server as owner, not loopback', 0.2, async function () {
    if (noServer()) return false;
    const r = await asOwnerOnly('whoami', {});
    return r.status === 200 && !!r.body && r.body.owner === true && r.body.loopback === false || false;
  }, test.limit.quick);
  test.after(function () { try { fs.rmSync(remoteFile, { force: true }); } catch (e) { /* none */ } });
  test.run('remote is an auto-verb: the api tree names it', 0.2, async function () {
    if (noServer()) return false;
    globalThis.spirit.nodeFacts = Object.assign({}, globalThis.spirit.nodeFacts || {}, { key: SELF, label: 'this node' });
    const t = await asOwner('api', {});
    return (t.status === 200 && !!t.body && 'remote' in t.body) || false;
  }, test.limit.quick);
  test.run('remote called empty by the owner answers { current, items, more }, current this node in server mode', 0.2, async function () {
    if (noServer()) return false;
    const a = R.list = await asOwner('remote', {});
    const b = a.body || {};
    return (a.status === 200 && b.current === SELF && Array.isArray(b.items) && typeof b.more === 'boolean') || false;
  }, test.limit.quick);
  test.run('its list holds this node first, each row only a key and a label', 0.2, function () {
    const b = (R.list && R.list.body) || {};
    const items = Array.isArray(b.items) ? b.items : [];
    return (items.length > 0 && items[0].key === SELF && items.every(function (i) { return JSON.stringify(Object.keys(i).sort()) === '["key","label"]'; })) || false;
  }, test.limit.quick);
  test.run('a peer asking remote is refused', 0.2, async function () {
    if (noServer()) return false;
    const a = await post('remote', {}, 'KEY-OTHER');
    return (a.status >= 400 && a.status < 500) || false;
  }, test.limit.quick);
  test.run('remote with a peer id switches to client mode and answers { current } naming that peer', 0.2, async function () {
    if (noServer()) return false;
    const a = await asOwner('remote', { id: PUBLISHER });
    R.switched = a.status === 200 && !!a.body && a.body.current === PUBLISHER && JSON.stringify(Object.keys(a.body)) === '["current"]';
    return R.switched || false;
  }, test.limit.quick);
  test.run('the choice is kept in spirit/state/<appServerName>/remote.json', 0.2, function () {
    if (!R.switched) return false;
    let held = null; try { held = JSON.parse(fs.readFileSync(remoteFile, 'utf8')); } catch (e) { held = null; }
    return (!!held && JSON.stringify(held).indexOf(PUBLISHER) !== -1) || false;
  }, test.limit.quick);
  test.run('in client mode the owner\'s ask goes to the sibling, and its answer comes back', 0.2, async function () {
    if (!R.switched) return false;
    const at = asked.length;
    const a = await asOwner('ping', {});
    return (a.status === 200 && !!a.body && a.body.pong === 'sibling' && asked.slice(at).some(function (x) { return x.verb === 'sibling.ping' && x.key === PUBLISHER; })) || false;
  }, test.limit.quick);
  test.run('in client mode a peer\'s post is refused with a code saying it is in client mode', 0.2, async function () {
    if (!R.switched) return false;
    const a = await post('ping', {}, 'KEY-OTHER');
    return (a.status >= 400 && a.status < 500 && !!a.body && /client/i.test(String(a.body.code || ''))) || false;
  }, test.limit.quick);
  test.run('in client mode the chosen sibling\'s publishings still land', 0.2, async function () {
    if (!R.switched) return false;
    O.A.publish(row(item(70)));
    await tick(400);
    return has(70) || false;
  }, test.limit.quick);
  // Box v12: "the replies and reply stream data are cached as they are now, but also published to its own faces". A row
  // only the sibling sent (delivered to this server's listener, never published here) reaches this node's own pages.
  test.run('in client mode a row the sibling streams in is published to this node\'s own pages too', 0.2, async function () {
    if (!R.switched) return false;
    const last = posts.filter(Array.isArray).map(function (b) { return b[b.length - 1]; }).filter(function (e) { return e && e.run; }).pop();
    if (!last) return false;
    const before = (fake.eventStream.published || []).length;
    const sent = await post('listener', { json: JSON.stringify([{ run: last.run, n: Number(last.n) + 1, row: row(item(81)) }]) }, PUBLISHER);
    await tick(300);
    const heard = (fake.eventStream.published || []).slice(before).some(function (e) { return e && e.item && e.item.id === 'a81'; });
    return (sent.status === 200 && heard) || false;
  }, test.limit.quick);
  test.run('remote with this node\'s id switches home: { current } is this node and its own verb answers again', 0.2, async function () {
    if (!R.switched) return false;
    const a = await asOwner('remote', { id: SELF });
    const p = await asOwner('ping', {});
    return (a.status === 200 && !!a.body && a.body.current === SELF && p.status === 200 && !!p.body && p.body.pong === true) || false;
  }, test.limit.quick);
  // Box v12: "the appServer publishes \"remote\" on its stream whenever the background check changes a row or a switch changes
  // current", "only to its own loopback clients and its relay-face, never to the peers subscribed to it".
  test.run('a switch publishes remote to its own pages, with current and the list', 0.2, function () {
    if (!R.switched) return false;
    const seen = (fake.eventStream.published || []).map(function (e) { return e && e.remote; }).filter(Boolean);
    return (seen.some(function (r) { return r.current === PUBLISHER && Array.isArray(r.items); }) && seen.some(function (r) { return r.current === SELF; })) || false;
  }, test.limit.quick);
  test.run('remote is never delivered to the peers subscribed to it', 0.2, function () {
    if (!R.switched) return false;
    return !posts.some(function (p) { return JSON.stringify(p).indexOf('"remote"') !== -1; }) || false;
  }, test.limit.quick);
  // Box v12: "items: one row per peer that lets this node into this app", "the appServer then leisurely asks again in the
  // background whether the list is still current, and keeps the answer there".
  test.run('after an empty call the background check lists a contact that lets this node in', 0.2, async function () {
    if (noServer()) return false;
    await asOwner('remote', {});
    await tick(800);
    const a = R.later = await asOwner('remote', {});
    const keys = ((a.body && a.body.items) || []).map(function (i) { return i.key; });
    return (keys[0] === SELF && keys.indexOf('KEY-PEER') !== -1) || false;
  }, test.limit.slow);
  test.run('a contact whose server refuses this node is not listed, nor one that stays silent', 0.2, function () {
    const keys = ((R.later && R.later.body && R.later.body.items) || []).map(function (i) { return i.key; });
    return (keys.indexOf('KEY-PEER') !== -1 && keys.indexOf('KEY-NOGRANT') === -1 && keys.indexOf('KEY-SILENT') === -1) || false;
  }, test.limit.quick);
  test.run('the peers that let it in are kept in remote.json', 0.2, function () {
    let held = ''; try { held = fs.readFileSync(remoteFile, 'utf8'); } catch (e) { held = ''; }
    return (held.indexOf('KEY-PEER') !== -1 && held.indexOf('KEY-NOGRANT') === -1) || false;
  }, test.limit.quick);

  // IN CLIENT MODE IT STAYS CONNECTED (goal/G47.5; Andy: "while my server runs in client mode it sould make every effort to
  // stay connected...", "agreed. let's ensure a bit more stability by reconnecting if the server side goes down for a few
  // minutes..."): switched to a sibling whose first subscribe is not taken (down, or still restarting), the server asks it
  // again by itself until one is taken; it is not left waiting for the next switch or start.
  test.run('in client mode, a subscribe the sibling did not take is asked again by itself until one is taken', 0.2, async function () {
    if (noServer()) return false;
    const sw = await asOwner('remote', { id: 'KEY-FLAKY' });
    if (!(sw.status === 200 && sw.body && sw.body.current === 'KEY-FLAKY')) return false;
    for (let i = 0; i < 60 && flaky.length < 2; i++) await new Promise(function (r) { setTimeout(r, 500); });
    const again = flaky.length >= 2;
    await asOwner('remote', { id: SELF });
    return again || false;
  }, test.limit.long);

  // THE LISTENER AND THE PUBLISHER'S VERBS ARE AUTO-VERBS OF EVERY appServer (goal/G47.5; Andy: "the streamListener must be
  // an auto-verb of spirit/server/app/script.js!", "both: \"publisher\" and \"listener\" belong in spirit/server/app/script.js", "they're both
  // auto-verbs. MUST BE.", "PLEASE call the damn thing jus \"listener\""): a server of one side alone names both sides' verbs, and
  // remote, and no streamListener.
  const SIDES = ['listener', 'remote', 'subscribe', 'unsubscribe'];
  const sided = function (r) { return Array.isArray(r.verbs) && SIDES.every(function (v) { return r.verbs.indexOf(v) !== -1; }) && r.verbs.indexOf('streamListener') === -1; };
  test.run('a server with a publisher only, as the desk is, names listener, subscribe, unsubscribe and remote, and no streamListener', 0.2, function () {
    const r = runChild('publisherOnly', 'zzPubOnly');
    clearCache('zzPubOnly');
    return sided(r) || false;
  }, test.limit.slow);
  test.run('a server with a stream only, as deskClient is, names listener, subscribe, unsubscribe and remote, and no streamListener', 0.2, function () {
    const r = runChild('streamOnly', 'zzStreamOnly');
    clearCache('zzStreamOnly');
    return sided(r) || false;
  }, test.limit.slow);
  // goal/G47.5, the cache in client mode (see the child's clientCache): the same file a following server keeps, deskClient's,
  // in spirit/state/<server>/cache/<sender>.json, with the sibling's run, its place and every row it sent.
  const SELFSUB = {};
  test.run('a desk-shaped server in client mode keeps the sibling\'s rows as spirit/state/<server>/cache/<sibling>.json', 0.2, function () {
    clearCache(FAMILY);
    const r = SELFSUB.client = runChild('clientCache', FAMILY);
    clearCache(FAMILY);
    const f = r.file || {};
    return (r.switched === 200 && r.pushed === 200 && r.streamed === 200 && f.key === PUBLISHER && f.run === 'r1' && f.n === 3
      && Array.isArray(f.ids) && ['head', 'a1', 'a2'].every(function (id) { return f.ids.indexOf(id) !== -1; })) || false;
  }, test.limit.slow);
  // goal/G47.5, part 2 (see selfSubscribe): this node's own subscribe is its pages', in both modes.
  test.run('in client mode a subscribe under this node\'s own key publishes the cache to its pages, none by peerPost', 0.2, function () {
    const r = SELFSUB.client || {};
    return (r.selfStatus === 200 && allOf(r.toPages) && Array.isArray(r.byPost) && r.byPost.length === 0) || false;
  }, test.limit.quick);
  test.run('in server mode a subscribe under this node\'s own key publishes its bootstrap to its pages, none by peerPost', 0.2, function () {
    clearCache('zzSelfServer');
    const r = runChild('selfServer', 'zzSelfServer');
    clearCache('zzSelfServer');
    return (r.selfStatus === 200 && allOf(r.toPages) && Array.isArray(r.byPost) && r.byPost.length === 0) || false;
  }, test.limit.slow);

  // ── restarts and the cache switch: each a process of its own ───────────────────────────────────────────────────
  // the cache, per sender, saved and read back (box v15)
  const C = {};
  test.run('a client with the cache switch on takes the push', 0.2, function () {
    clearCache('cacheProbe');
    C.one = runChild('first', 'cacheProbe');
    return (C.one.subscribed === true && !!C.one.one && !!C.one.two) || false;
  }, test.limit.quick);
  test.run('it saves the cache as spirit/state/<client>/<sender key>.json', 0.2, function () {
    const file = cacheFile('cacheProbe');
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = ''; }
    return text.indexOf('item 2') !== -1 || false;
  }, test.limit.quick);
  test.run('its spirit.required.spirit.data holds the cache under the sender\'s key, and nothing beside it at the top', 0.2, function () {
    const one = C.one || {};
    return (!!one.byNode && one.byNode.length === 1 && !!one.top && one.top.length === 1) || false;
  }, test.limit.quick);
  test.run('under the sender\'s key its spirit.required.spirit.data holds the branch, as <key>.<branch>', 0.2, function () {
    const one = C.one || {};
    return (Array.isArray(one.family) && one.family.indexOf(FAMILY) !== -1) || false;
  }, test.limit.quick);
  test.run('started again, it reads its cache back before it subscribes', 0.2, function () {
    C.two = runChild('restart', 'cacheProbe');
    return (!!C.two.readOne && !!C.two.readTwo) || false;
  }, test.limit.slow);
  test.run('a sender of a new run pushes in full, its rows take precedence, and a kept row it does not carry stays', 0.2, function () {
    const two = C.two || {};
    return (two.subscribed === true && two.title === 'item 1, renamed' && !!two.two) || false;
  }, test.limit.quick);
  test.run('without the switch no cache file is kept', 0.2, function () {
    clearCache('cacheOff');
    runChild('off', 'cacheOff');
    return !fs.existsSync(cacheFile('cacheOff')) || false;
  }, test.limit.quick);
  test.run('a sender whose branch has no folder on this node is not cached', 0.2, function () {
    clearCache('cacheNoFam');
    runChild('nofamily', 'cacheNoFam', 'noSuchServer');
    return !fs.existsSync(cacheFile('cacheNoFam')) || false;
  }, test.limit.quick);
  test.run('within the limit the cache keeps every row the sender sends, no filtering on the client side', 0.2, function () {
    clearCache('cacheEvery');
    const every = runChild('every', 'cacheEvery');
    return (Array.isArray(every.a) && every.a.length === 3 && Array.isArray(every.b) && every.b.length === 3) || false;
  }, test.limit.slow);
  test.run('the cache keeps to the limit the client sets', 0.2, function () {
    clearCache('cacheLimit');
    C.full = runChild('limit', 'cacheLimit');
    let size = -1;
    try { size = fs.statSync(cacheFile('cacheLimit')).size; } catch (e) { size = -1; }
    return (size > 0 && size <= 3500) || false;
  }, test.limit.slow);
  // The family's own rules do the shedding (Andy, Q2: "it sits at the receiving end of the stream, it owns the cache ...
  // IT DOESN't HAVE ASK OR TELL ANYBODY HOW IT's JOB IS DONE"); the desk's are judged in the desk's own test (goal/G47.4).
  // A family with none: the oldest rows go first (appServer's shedOldest). The rows kept are the newest, in order, and
  // the last row sent is among them.
  const tail = function (kept, last) { return kept.length > 1 && kept.length < 21 && kept[kept.length - 1] === last && kept.indexOf('head') === -1; };
  test.run('past the limit, a branch with no cache rules of its own loses its oldest rows first, and the newest stay', 0.2, function () {
    const kept = Array.isArray((C.full || {}).kept) ? C.full.kept : [];
    return (tail(kept, 'b10') && kept.indexOf('b1') !== -1) || false;
  }, test.limit.quick);
  test.run('past the limit, a branch with a shed of its own is shed by it, never by the app server\'s default', 0.2, function () {
    clearCache('cacheShed');
    const shed = runChild('limit', 'cacheShed', SHED_FAMILY);
    const kept = Array.isArray(shed.kept) ? shed.kept : [];
    // zzshed drops the newest: what stays is the first rows sent, in order, from the head row on, and the last row sent is
    // not among them. The app server's default would have kept the last and lost the head.
    const sent = ['head'];
    for (let i = 1; i <= 10; i++) sent.push('a' + i);
    for (let i = 1; i <= 10; i++) sent.push('b' + i);
    const prefix = kept.length > 1 && kept.length < sent.length && kept.every(function (id, i) { return id === sent[i]; });
    return (prefix && kept.indexOf('b10') === -1) || false;
  }, test.limit.slow);
}

if (CHILD) {
  child(CHILD).catch(function () { process.stdout.write('RESULT ' + JSON.stringify({}) + '\n'); process.exit(1); });
} else {
  // appServer.js: one stream protocol for every server (goal/G41.11, goal/G41.12). Its own checks first, then the parts.
  plantFamilies();
  test.after(function () {
    removeFamilies();
    ['cacheProbe', 'cacheOff', 'cacheNoFam', 'cacheEvery', 'cacheLimit', 'cacheShed'].forEach(clearCache);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a temp folder left is no failure */ }
  });
  gateSection();
  ownPart();
  agentsFilePart();
  stateCachePart();
}
