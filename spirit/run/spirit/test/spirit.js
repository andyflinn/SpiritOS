'use strict';

// spirit/run/spirit/test/spirit.js
// THE RED OF spirit/run/spirit/spirit.js (goal/G40.6; the module moved from the run root, goal/G43.18, and its test with it,
// goal/G43.27), and of no other module, every test of it in this one file. Its sections, after its own: the cache manager
// (goal/G43.27), the element move (goal/G43.5), the relay login (goal/G43.18) and the family finder (goal/G43.27).
// It asserts ./spirit.md, section by section: the
// rule, where it runs, the one instance, every member of it, its node, the one loader, and that a module not loading
// spirit.js first goes red. Everything is asked of the one instance, in node and on a page: there is nothing else.
//   - In node, the instance itself for what needs no node; and, for what talks to a node, the instance of a scratch
//     copy of the run root whose spirit/state/environment.json names a fake node this suite runs (and one that names
//     none), since "the port is fetched from \relay-state\environment.json" of the run root spirit.js sits in.
//   - On a page: spirit.js's own source run as face.html runs it, in a window of its own, with no module, no process and
//     no require, its node the page's own origin.
// Reported in the format of the current test system.

const fs = require('fs');
const vm = require('vm');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const RUN = path.join(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/spirit/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/spirit'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const SOURCE = fs.readFileSync(path.join(RUN, 'spirit', 'spirit.js'), 'utf8');
const COMPONENT = 'spirit/relayUrl.js';
const PAGE_COMPONENT = 'spirit/fieldRules.js';   // written for both node and a page, as the face's parts are
async function refusedWith(promise) { try { await promise; return null; } catch (e) { return e && e.code; } }

// A family's api.js as the node hands it: two verbs, one dotted, and a name of its own.
const DEMO = 'module.exports = { verbs: { hello: { name: "text" }, "line.write": { text: "text" } }, names: function (call) { return { hi: function (n) { return call("hello", { name: n }); } }; } };';
// WHAT A PEER MIGHT HAND BACK FOR ITS api.js (goal/G43.32; Andy: "clients don't run code from afar, they run their own
// FUCKING copy", "DO IT! WITH CODE FROM THE OWN NODE!"): code that marks the process it runs in and names a verb of its own.
const POISON = 'globalThis.peerCodeRan = true; module.exports = { verbs: { hello: { name: "text" }, peerOnly: { x: "text" } } };';
// A call as the node's door takes it (goal/G41.15): { call: "<family>.<verb>", args: { ... } }, nothing beside them.
// Anything else is refused 400 bad-request, as the door refuses it.
function isCall(b) {
  return !!b && typeof b === 'object' && typeof b.call === 'string' && !!b.args && typeof b.args === 'object' && !Array.isArray(b.args) &&
    Object.keys(b).every(function (k) { return k === 'call' || k === 'args'; });
}
const FLAT = [400, { ok: false, code: 'bad-request', error: 'a call is { call: "<family>.<verb>", args: { ... } }, nothing else beside them' }];
// The node's answers, the same at the loopback door and at a page's /api/spirit.
function answer(b) {
  if (!isCall(b)) return FLAT;
  const c = b.call;
  const a = b.args;
  if (c === 'api' && a.branch === 'demo') return [200, { interface: DEMO }];
  if (c === 'api' && a.branch) return [404, { ok: false, code: 'no-branch', error: 'no branch ' + a.branch }];
  if (c === 'api') return [200, { demo: { hello: {} }, gone: {} }];
  if (c === 'demo.hello' && a.name === 'held') return [409, { ok: false, code: 'held', error: 'held by bert' }];
  if (c === 'demo.hello' && a.name === 'slow') return [504, 'the app server did not answer'];
  if (c === 'demo.hello') return [200, { ok: true, said: 'hello ' + a.name }];
  if (c === 'demo.line.write') return [200, { ok: true, wrote: a.text }];
  return [400, { ok: false, code: 'no-such-verb', error: 'no verb ' + c }];
}
// It also serves the node's events family: event.subscribe is a stream, as the real node's (a snapshot and then a job
// update, for a page and for a server, which says X-Spirit-Reader: server and takes no packets); a peer.post is answered with its
// hash, and the peer's answer arrives on the stream as a packet carrying re, as a real node hands it.
const packet = require(path.join(RUN, 'spirit', 'client', 'packet.js'));
function fakeNode() {
  const asked = [];
  const streams = [];
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let b = {};
      try { b = JSON.parse(body || '{}'); } catch (e) { b = {}; }
      asked.push(b);
      if (!isCall(b)) { res.writeHead(FLAT[0], { 'Content-Type': 'application/json' }); res.end(JSON.stringify(FLAT[1])); return; }
      if (b.call === 'event.subscribe') {
        const reader = req.headers['x-spirit-reader'] || '';
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(': open\n\n');
        streams.push({ res: res, reader: reader });
        b.reader = reader;
        res.write('event: snapshot\ndata: ' + JSON.stringify({ jobs: [{ id: 'j1', status: 'running' }] }) + '\n\n');
        setTimeout(function () { res.write('event: job-updated\ndata: ' + JSON.stringify({ id: 'j1', status: 'done' }) + '\n\n'); }, 20);
        return;
      }
      if (b.call === 'peer.post') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, hash: 'h1' }));
        const reply = packet.encode('api', { said: 'answered by ' + b.args.to }, { re: 'h1' });
        setTimeout(function () { streams.forEach(function (st) { st.res.write('event: packet\ndata: ' + JSON.stringify({ from: b.args.to, text: reply.text }) + '\n\n'); }); }, 30);
        return;
      }
      if (b.call === 'event.publish') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); return; }
      const [status, out] = answer(b);
      res.writeHead(status, { 'Content-Type': typeof out === 'string' ? 'text/plain' : 'application/json' });
      res.end(typeof out === 'string' ? out : JSON.stringify(out));
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, asked: asked, streams: streams, close: function () { streams.forEach(function (st) { try { st.res.end(); } catch (e) { /* gone */ } }); server.close(); } }); });
  });
}
// A scratch run root: its spirit/ folder, spirit.js in it (goal/G43.18), and an environment.json naming port (or none).
function scratchRoot(port) {
  const root = ownTemp('spirit-root-');
  fs.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true, filter: function (src) { return src !== path.join(RUN, 'spirit', 'state'); } });
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  if (port) fs.writeFileSync(path.join(root, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
  // The demo branch's own api.js on this root's disc (goal/G43.32): a peer's demo is bound from it, never from the peer.
  fs.mkdirSync(path.join(root, 'spirit', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'spirit', 'demo', 'api.js'), DEMO + '\n');
  return root;
}
// What a node process sees through the instance of that root: run in a process of its own, its observations as JSON.
const OBSERVE = `
const s = require(process.argv[2] + '/spirit/spirit.js');
const out = {};
out.facts = s.node;
async function code(p) { try { await p; return null; } catch (e) { return e && e.code; } }
(async function () {
  out.keys = Object.keys(s).sort();
  out.same = require(process.argv[2] + '/spirit/spirit.js') === s && globalThis.spirit === s;
  if (process.argv[3] === 'none') {
    out.require = await code(s.require(s.branchPath('demo')));
    out.tree = await code(s.tree());
    out.noPort = !('port' in s);
  } else {
    const fams = await Promise.all([s.require(s.branchPath('demo')), s.require(s.branchPath('demo'))]);
    const two = await Promise.all([fams[0].hello({ name: 'bert' }), fams[1].hello({ name: 'carl' })]);
    out.two = two.map(function (r) { return r.said; });
    out.bound = fams[0] === fams[1] && fams[0] === s.demo && typeof s.demo.hello === 'function';
    // ONE PLACE FOR A BRANCH (goal/G49.6; Andy, of G40.6 beside G43.32/G49.5: "AND WHICH FUCKING RULING DO YOU THINK
    // APPLIES??????", the later: "spirit.require() places the loaded script at the exact same path"): its verbs stand at
    // spirit.required.spirit.<branch-path>.api, the require answers that, and nothing of it stands on spirit.<branch>.
    const placed = s.required && s.required.spirit && s.required.spirit.demo && s.required.spirit.demo.api;
    out.onePlace = !!placed && typeof placed.hello === 'function' && fams[0] === placed && !Object.prototype.hasOwnProperty.call(s, 'demo');
    out.hi = (await s.demo.hi('dave')).said;
    out.dotted = typeof s.demo.lineWrite === 'function' && s.demo.lineWrite === s.demo['line.write'] && (await s.demo.lineWrite({ text: 't' })).wrote;
    // No FS set on a family (goal/G43.20): its files are spirit.fs's, by the path its id names.
    out.fs = !('FS' in s.demo);
    out.noArg = await code(s.demo.hello({ nme: 'x' }));
    out.noVerb = typeof s.demo.nothing === 'undefined';
    out.noFamily = await code(s.require(s.branchPath('gone')));
    try { await s.demo.hello({ name: 'held' }); } catch (e) { out.held = [e.code, e.message, e.status]; }
    try { await s.demo.hello({ name: 'slow' }); } catch (e) { out.slow = [e.status, e.message]; }
    out.tree = Object.keys(await s.tree()).sort();
    out.viaRequire = (await s.require(s.branchPath('demo'))) === s.demo;
    out.outcome = [await s.outcome(s.demo.hello({ name: 'eve' })), await s.outcome(s.demo.hello({ nme: 1 })), await s.outcome(s.demo.hello({ name: 'held' })), await s.outcome(Promise.reject(new Error()))]
      .map(function (o) { return [o.status, o.body && (o.body.said || o.body.code)]; });
    // This process's job, published by event.publish with its own id, the one path.
    out.publish = s.event.publish({ x: 1 });
    out.tooBig = s.event.publish({ big: 'y'.repeat(30000) });
    out.noJobsPublish = !('publish' in s.job);
    // The node's events, subscribed: the snapshot, then an update; unsubscribed, nothing more.
    out.heard = await new Promise(function (r) {
      const heard = [];
      const off = s.event.subscribe({
        onConnection: function (up) { heard.push('up:' + up); },
        onSnapshot: function (jobs) { heard.push('snapshot:' + jobs.map(function (j) { return j.id; }).join(',')); },
        onUpdate: function (job) { heard.push('update:' + job.id + ':' + job.status); off(); r(heard); },
      });
      setTimeout(function () { r(heard); }, 2000);
    });
    await s.job.start('j1');
    out.startAgain = await code(s.job.start('j2'));
    await s.job.progress(1, 2, 'half');
    await s.job.end({ done: true });
    await new Promise(function (r) { setTimeout(r, 100); });
    // The peer's answer, through the node's event stream.
    out.peerAnswer = await s.peerPost('peerKey9', 'api', { demo: { hello: { name: 'p' } } }, { waitMs: 3000 });
    let asks = 0;
    s.peerPost = function (peer, app, body, how) {
      if (body && body.api) asks++;
      out.peerHow = how && how.waitMs;
      return new Promise(function (r) { setTimeout(function () { r(body && body.api ? { interface: '${POISON.replace(/'/g, "\\'")}' } : { said: 'hello from ' + peer }); }, 20); });
    };
    const both = await Promise.all([s.require(s.branchPath('demo'), 'peerKey1', { waitMs: 777 }), s.require(s.branchPath('demo'), 'peerKey1', { waitMs: 777 })]);
    out.peer = [both[0] === both[1], asks, (await both[0].hello({ name: 'x' })).said, s.demo !== both[0]];
    out.peerRan = globalThis.peerCodeRan === true;
    out.peerOwn = typeof both[0].hello === 'function' && typeof both[0].peerOnly === 'undefined';
    // THE STREAM'S AUTO-VERBS ON EVERY FAMILY (goal/G47.5; Andy: "both: \"publisher\" and \"listener\" belong in
    // spirit/server/app.js", "they're both auto-verbs. MUST BE."): demo's api.js names none, yet its branch has listener,
    // subscribe and unsubscribe, as it has remote, and a call of listener goes to the peer as demo.listener.
    out.peerAuto = ['listener', 'subscribe', 'unsubscribe', 'remote'].filter(function (v) { return typeof both[0][v] === 'function'; });
    let posted = null;
    s.peerPost = function (peer, app, body) { posted = body; return Promise.resolve({ heard: true }); };
    try { await both[0].listener({ json: '[]' }); } catch (e) { /* judged by what was posted */ }
    out.peerListener = !!(posted && posted.demo && posted.demo.listener && posted.demo.listener.json === '[]');
    // goal/G49.2 (Andy: "assert the \"branch\"", "yes on the two verbs"): subscribe takes {branch, run?, since?}, and goes out so.
    posted = null;
    try { await both[0].subscribe({ branch: 'zzBranch', since: 3 }); } catch (e) { /* judged by what was posted */ }
    out.peerSubscribe = !!(posted && posted.demo && posted.demo.subscribe && posted.demo.subscribe.branch === 'zzBranch' && posted.demo.subscribe.since === 3);
  }
  process.stdout.write(JSON.stringify(out));
}()).catch(function (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.stack || e) !== '' })); });
`;
function observe(root, mode, port) {
  const file = path.join(root, 'observe.js');
  fs.writeFileSync(file, OBSERVE);
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [file, root, mode || '', String(port || ''), '--node', JSON.stringify({ name: 'nodey', publicKey: 'K1', ownerKey: 'O1' })],
      { cwd: root, env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'job_7' }) });
    let said = '';
    let errs = false;
    kid.stdout.on('data', function (c) { said += c; });
    kid.stderr.on('data', function (c) { if (String(c) !== '') errs = true; });
    kid.on('close', function () { try { resolve(JSON.parse(said)); } catch (e) { resolve({ threw: said !== '' || errs }); } });
  });
}

// A page: spirit.js's own source run as face.html runs it. Its fetch answers as a node's door at the page's origin.
function page() {
  const fetched = [];
  const window = {
    fetch: function (url, init) {
      fetched.push({ url: url, body: init && init.body });
      if (url === '/api/spirit') {
        const b = JSON.parse(init.body);
        // peer.post as the node answers it: the packet read out of its envelope, the peer's reply in one (goal/G43.24: a
        // page's spirit.peerPost sends its body in the packet envelope, as a process's does).
        if (isCall(b) && b.call === 'peer.post') {
          const P = require(path.join(RUN, 'spirit', 'client', 'packet.js'));
          const inner = P.decode(String(b.args.text || '')).body;
          const reply = inner && inner.api ? { interface: DEMO } : { said: 'hello page peer' };
          const said = { ok: true, text: P.encode('api', reply).text, from: String(b.args.to || '') };
          return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(said)); } });
        }
        const [status, out] = answer(b);
        return Promise.resolve({ status: status, text: function () { return Promise.resolve(typeof out === 'string' ? out : JSON.stringify(out)); } });
      }
      // The node's addresses, each served from its file (goal/G43.18, Q25: serveCommon.pageFile).
      const file = path.join(RUN, require(path.join(RUN, 'spirit', 'server', 'serveCommon.js')).pageFile(String(url).replace(/^\/+/, '')));
      const there = fs.existsSync(file);
      return Promise.resolve({ status: there ? 200 : 404, headers: { get: function () { return ''; } }, arrayBuffer: function () { return Promise.resolve(there ? new Uint8Array(fs.readFileSync(file)).buffer : new ArrayBuffer(0)); } });
    },
    TextDecoder: TextDecoder, TextEncoder: TextEncoder, crypto: require('crypto').webcrypto, console: console, Promise: Promise, URL: URL, setTimeout: setTimeout,
  };
  window.window = window;
  // A page's document: a script appended runs in the page at once, as a browser runs it, an error in it the page's
  // own; a style appended is kept.
  window.styles = [];
  window.document = {
    readyState: 'complete',
    documentElement: { getAttribute: function () { return null; } },
    querySelector: function () { return null; },
    createElement: function (t) { return { tagName: String(t).toUpperCase(), textContent: '' }; },
    head: { appendChild: function (el) { window.styles.push(el.textContent); return el; } },
    body: { appendChild: function (el) { try { vm.runInContext(el.textContent, ctx); } catch (e) { window.scriptError = e; } return el; } },
  };
  const ctx = vm.createContext(window);
  vm.runInContext(SOURCE, ctx, { filename: 'spirit.js' });
  window.fetched = fetched;
  return window;
}

// What the tests share, made by the tests that first need it: the one instance in node, the pages, the fake node.
const T = {};
const s = require(path.join(RUN, 'spirit', 'spirit.js'));
// The source, its comments blanked, read once.
const code = SOURCE.replace(/\/\/[^\n]*/g, function (c) { return ' '.repeat(c.length); });

// ── 1. WHERE IT RUNS, THE ONE INSTANCE, THE GLOBAL FIRST ─────────────
// 1. spirit.js alone tells node from a page; one instance, the global first
test.run('in node, isNode() answers true and isBrowser() false', 0.2, function () {
  return (s.isNode() === true && s.isBrowser() === false) || false;
}, test.limit.quick);
test.run('in node, require answers the one instance, the global spirit, every time', 0.2, function () {
  return (globalThis.spirit === s && require(path.join(RUN, 'spirit', 'spirit.js')) === s) || false;
}, test.limit.quick);
test.run('a global spirit already there is the one it fills, not replaced', 0.2, function () {
  const kept = spawnSync(process.execPath, ['-e', 'globalThis.spirit = { mark: 1 }; const s = require(process.argv[1]); console.log(String(s === globalThis.spirit && s.mark === 1 && typeof s.require === "function"));', path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8' });
  return String(kept.stdout).trim() === 'true' || false;
}, test.limit.quick);
test.run('on a page, window.spirit is there at once, isBrowser() answers true and isNode() false', 0.2, function () {
  const w = T.w = page();
  return (!!w.spirit && w.spirit.isBrowser() === true && w.spirit.isNode() === false) || false;
}, test.limit.quick);
test.run('the source sets the global before its first require', 0.2, function () {
  const sets = code.search(/\broot\.spirit\s*=/);
  const firstRequire = code.search(/\brequire\(/);
  return (sets !== -1 && sets < firstRequire) || false;
}, test.limit.quick);
test.run('nothing in spirit.js but isNode() and isBrowser() asks where it runs', 0.2, function () {
  return !/typeof (window|module|process|require|TextDecoder|Buffer)/.test(code.replace(/function isNode\(\)[^\n]*\n|function isBrowser\(\)[^\n]*\n/g, '')) || false;
}, test.limit.quick);
// data: the cache, spirit.required.spirit.data (goal/G41.3); branchPath: the one family path function (goal/G41.12); readStream: the one reader of every stream a page has (goal/G47.1, the box, "Reload
// Problems with the face": "one place only manages the stream ... spirit.js").
const MEMBERS = ['DEFAULT_SPIRIT_PORT', 'MIME_TYPES', 'VERSION', 'branchPath', 'check', 'debug', 'error', 'escapeHtml', 'event', 'formatBytes', 'isBrowser', 'isLoopback', 'isNode', 'job', 'node', 'outcome', 'peerPost', 'readStream', 'require', 'rules', 'tree'];
test.run('in node the instance holds exactly its members, and the branches it binds', 0.2, function () {
  return JSON.stringify(Object.keys(s).filter(function (k) { return typeof s[k] !== 'object' || ['MIME_TYPES', 'event', 'job', 'node'].indexOf(k) !== -1 || Array.isArray(s[k]); }).sort()) === JSON.stringify(MEMBERS) || false;
}, test.limit.quick);
// BRANCH (goal/G49.2; Andy: "assert the \"branch\"", "yes on the two verbs. fix it all."): the instance finds a branch's
// path by branchPath, on a page as in node, and a bound branch's subscribe takes {branch, run?, since?}.
test.run('the instance holds branchPath, in node and on a page', 0.2, function () {
  if (!T.w || !T.w.spirit) return false;
  return (typeof s.branchPath === 'function' && typeof T.w.spirit.branchPath === 'function') || false;
}, test.limit.quick);
// goal/G49.2 (Andy: "decision, cw's approach to \"ask the node\". verb modification approved."): branchPath learns where a
// branch lives from its node's answer, never from the disc: its body, comments left out, holds no fs and no existsSync.
test.run('branchPath asks the disc for nothing', 0.2, function () {
  const at = SOURCE.indexOf('function branchPath(');
  if (at === -1) return false;
  const open = SOURCE.indexOf('{', at);
  let depth = 0, end = open;
  for (let i = open; i < SOURCE.length; i++) { if (SOURCE[i] === '{') depth++; else if (SOURCE[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
  const body = SOURCE.slice(open, end + 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  return (body.length > 2 && !/\bexistsSync\b|require\(\s*['"]fs['"]\s*\)|\bstatSync\b|\breaddirSync\b/.test(body)) || false;
}, test.limit.quick);
test.run('branchPath names the api.js of a branch in its own folder: spirit/desk/api.js for desk', 0.2, function () {
  return (typeof s.branchPath === 'function' && /^spirit\/(app\/)?desk\/api\.js$/.test(String(s.branchPath('desk')))) || false;
}, test.limit.quick);
test.run('no factory, no transport and no second object is handed out, in node or on a page', 0.2, function () {
  if (!T.w || !T.w.spirit) return false;
  const factories = ['createSpirit', 'assemble', 'forNode', 'forPeer', 'nodeTransport', 'pageTransport', 'peerTransport', 'loadInterface', 'spiritObject', 'call', 'port'];
  const left = factories.filter(function (k) { return k in s || k in T.w.spirit; });
  return !left.length || false;
}, test.limit.quick);
// THE NODE IN TWO PLACES, THE RELAY'S FACE ROUTES IN THREE (goal/G43.18, Q22: the link home moved into spirit.js; box v29: the
// login is spirit.login): post and get to the node; the login's /face/api, and the link's /face/call, whole and piece by piece.
// AND ONE STREAM BY ITS ADDRESS (goal/G47.1, the box, "Reload Problems with the face": boot.js "opens the face's stream through
// spirit.js, handing only the face's address"): readStream fetches the address it is handed, o.url().
test.run('one post and one get reach the node; three more are the relay\'s face routes, login and link; one is the stream reader\'s', 0.2, function () {
  const fetches = (code.match(/\bfetch\(/g) || []).length;
  const toFace = (code.match(/\bfetch\('\/face\/(api|call)'/g) || []).length;
  const byAddress = (code.match(/\bfetch\(o\.url\(\)/g) || []).length;
  return (fetches === 6 && toFace === 3 && byAddress === 1 && /function post\(verb, args(, how)?\)/.test(code) && /function get\(path\)/.test(code)) || false;
}, test.limit.quick);

// ── 2. IN NODE: spirit.js's OWN ──────────────────────────────────────
// 2. in node: the node's facts, the job and the tables are spirit.js's own
test.run('spirit.js hands out no spirit.core; spirit.MIME_TYPES is its own table', 0.2, function () {
  const mime = s.MIME_TYPES;
  return (!('core' in s) && !!mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json'])) || false;
}, test.limit.quick);
test.run('spirit.VERSION is 0.0.1 and spirit.DEFAULT_SPIRIT_PORT 65432', 0.2, function () {
  return (s.VERSION === '0.0.1' && s.DEFAULT_SPIRIT_PORT === 65432) || false;
}, test.limit.quick);
test.run('spirit.debug is off at start, is set by a boolean and answers the state, and anything else only reads it', 0.2, function () {
  const dbg = [s.debug(), s.debug(true), s.debug(), s.debug('yes'), s.debug(false), s.debug()];
  return JSON.stringify(dbg) === JSON.stringify([false, true, true, true, false, false]) || false;
}, test.limit.quick);

// ── 3. THE HELPERS ───────────────────────────────────────────────────
// 3. the helpers, in node and on a page alike
function helpers(where, o) {
  const e = o.error('boom');
  return (!!e && !!e.error && e.error.string === 'boom' && o.formatBytes(0) === '0 Bytes' && o.formatBytes(1024) === '1 KB' && o.formatBytes(1536) === '1.5 KB' && o.escapeHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;') || false;
}
test.run('in node, error, formatBytes and escapeHtml answer as specified', 0.2, function () { return helpers('node', s); }, test.limit.quick);
test.run('on a page, error, formatBytes and escapeHtml answer as specified', 0.2, function () { return T.w && T.w.spirit ? helpers('page', T.w.spirit) : false; }, test.limit.quick);

// ── 4. THE CHECK ─────────────────────────────────────────────────────
// 4. check: every argument against its verb's declaration, every rule
const KEY = 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
const rules = { text: ['a', 1], id: ['a', ''], flag: ['yes', 'no'], number: [1, Infinity], bool: [true, 'true'], object: [{}, []], list: [[], {}],
  key: [KEY, 'abc'], url: ['https://a.b', 'ftp://a.b'], path: ['a/b.js', '../a'], name: ['bert', 7], description: ['a line', 7], paragraph: ['a paragraph', 7] };
test.run('spirit.rules names exactly bool, description, flag, id, key, list, name, number, object, paragraph, path, text, url, both sides', 0.2, function () {
  if (!T.w || !T.w.spirit) return false;
  return (JSON.stringify(s.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort()) && JSON.stringify(T.w.spirit.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort())) || false;
}, test.limit.quick);
test.run('each rule passes a good value and refuses a bad one bad-request', 0.2, function () {
  const wrongRules = Object.keys(rules).filter(function (r) {
    const spec = { v: r };
    return s.check('t', spec, { v: rules[r][0] }) !== null || !s.check('t', spec, { v: rules[r][1] }) || s.check('t', spec, { v: rules[r][1] }).code !== 'bad-request';
  });
  return !wrongRules.length || false;
}, test.limit.quick);
test.run('an unnamed argument is no-such-argument; a missing one, a non-object or an unknown rule bad-request; one marked ? may be missing', 0.2, function () {
  const c1 = s.check('t', { a: 'text' }, { b: 'x' });
  const c2 = s.check('t', { a: 'text' }, {});
  const c3 = s.check('t', { a: 'text?' }, {});
  const c4 = s.check('t', { a: 'text' }, 'x');
  const c5 = s.check('t', { a: 'nosuchrule' }, { a: 'x' });
  return (!!c1 && c1.code === 'no-such-argument' && c1.argument === 'b' && !!c2 && c2.code === 'bad-request' && c3 === null && !!c4 && c4.code === 'bad-request' && !!c5 && c5.code === 'bad-request') || false;
}, test.limit.quick);

// ── 5. IN NODE: ITS NODE, ITS FAMILIES, ITS PEERS ────────────────────
// 5. in node: its node is 127.0.0.1 at the port of its run root's environment.json; it binds families on itself
test.run('the instance of a scratch run root that names a fake node answers what it saw', 0.2, async function () {
  T.node = await fakeNode();
  T.root = scratchRoot(T.node.port);
  T.bare = scratchRoot(0);
  const o = await observe(T.root);
  if (o.threw) return false;
  T.o = o;
  return true;
}, test.limit.slow);
function O() { return T.o || null; }
test.run('the scratch run root\'s instance is its process\'s one global', 0.2, function () {
  const o = O(); if (!o) return false;
  return o.same || false;
}, test.limit.quick);
// goal/G43.32: in node a branch is bound from the api.js on its own disc, so its node is never asked for it.
test.run('spirit.require of the demo interface binds spirit.demo once for two callers at once, from its own disc, never asking its node', 0.2, function () {
  const o = O(); if (!o) return false;
  const node = T.node;
  return (!!o.two && o.two[0] === 'hello bert' && o.two[1] === 'hello carl' && !!o.bound && node.asked.filter(function (b) { return b.call === 'api' && b.args && b.args.branch === 'demo'; }).length === 0) || false;
}, test.limit.quick);
// goal/G49.6: G43.32's decided 8 (verbs bound on spirit.<branch> as well) is reversed; the later ruling applies, one place.
test.run('in node, a branch\'s verbs stand at spirit.required.spirit.demo.api, the require answers it, and spirit.demo is not there', 0.2, function () {
  const o = O(); if (!o) return false;
  return o.onePlace === true;
}, test.limit.quick);
test.run('a bound branch has its own names, a dotted verb in camel case too (line.write as lineWrite), and no FS set', 0.2, function () {
  const o = O(); if (!o) return false;
  return (o.hi === 'hello dave' && o.dotted === 't' && o.fs === true) || false;
}, test.limit.quick);
test.run('an argument the verb does not name is refused before it leaves; a verb the branch lacks is not on it; no interface: no-interface', 0.2, function () {
  const o = O(); if (!o) return false;
  return (o.noArg === 'no-such-argument' && o.noVerb === true && o.noFamily === 'no-interface') || false;
}, test.limit.quick);
test.run('the node\'s refusal keeps its code, its words and its status; a plain-text answer keeps its text', 0.2, function () {
  const o = O(); if (!o) return false;
  return (!!o.held && o.held[0] === 'held' && o.held[1] === 'held by bert' && o.held[2] === 409 && !!o.slow && o.slow[0] === 504 && o.slow[1] === 'the app server did not answer') || false;
}, test.limit.quick);
test.run('spirit.tree() answers its node\'s api as it stands', 0.2, function () {
  const o = O(); if (!o) return false;
  return JSON.stringify(o.tree) === JSON.stringify(['demo', 'gone']) || false;
}, test.limit.quick);
test.run('spirit.require(spirit.branchPath(\'demo\')) answers the same member, spirit.demo', 0.2, function () {
  const o = O(); if (!o) return false;
  return !!o.viaRequire || false;
}, test.limit.quick);
test.run('spirit.outcome answers 200 and the body, 400 for a call the check refused, the node\'s own status, and 0 when nothing answered', 0.2, function () {
  const o = O(); if (!o) return false;
  const oc = o.outcome || [];
  return (!!oc[0] && oc[0][0] === 200 && oc[0][1] === 'hello eve' && oc[1][0] === 400 && oc[1][1] === 'no-such-argument' && oc[2][0] === 409 && oc[3][0] === 0) || false;
}, test.limit.quick);
test.run('spirit.node holds its port from environment.json, and the name, key and owner the node handed it as --node', 0.2, function () {
  const o = O(); if (!o) return false;
  const f = o.facts || {};
  return (f.port === T.node.port && f.name === 'nodey' && f.key === 'K1' && f.ownerKey === 'O1') || false;
}, test.limit.quick);
test.run('spirit.job start, progress and end publish by event.publish with the job\'s id; over the cap is dropped; a second start job-open', 0.2, function () {
  const o = O(); if (!o) return false;
  const node = T.node;
  const updates = node.asked.filter(function (b) { return b.call === 'event.publish'; }).map(function (b) { return b.args; });
  const states = updates.map(function (u) { return u.app && u.app.job && u.app.job.state; }).filter(Boolean);
  const dropped = updates.filter(function (u) { return u.app && u.app.dropped; });
  return (o.publish === true && o.tooBig === false && updates.length > 0 && updates.every(function (u) { return u.id === 'job_7'; }) && updates.some(function (u) { return u.app && u.app.x === 1; })
      && dropped.length === 1 && dropped[0].app.dropped.max > 0 && JSON.stringify(states) === JSON.stringify(['start', 'progress', 'end']) && o.startAgain === 'job-open'
      && o.noJobsPublish === true && !node.asked.some(function (b) { return b.call === 'job.update'; })) || false;
}, test.limit.quick);
test.run('spirit.event.subscribe hears the node\'s events as a stream: up, then the snapshot, then each update, until unsubscribed', 0.2, function () {
  const o = O(); if (!o) return false;
  return JSON.stringify(o.heard) === JSON.stringify(['up:true', 'snapshot:j1', 'update:j1:done']) || false;
}, test.limit.quick);
// goal/G43.3: a process that followed the stream as a page would take its node's owner's waiting lines.
test.run('in a process, every event.subscribe says it is a server, so it takes no packets', 0.2, function () {
  const o = O(); if (!o) return false;
  const subscribes = T.node.asked.filter(function (b) { return b.call === 'event.subscribe'; });
  return (subscribes.length > 0 && subscribes.every(function (b) { return b.reader === 'server'; })) || false;
}, test.limit.quick);
test.run('spirit.peerPost makes one post of peer.post and reads the answer off the node\'s events, through event.subscribe as a server', 0.2, function () {
  const o = O(); if (!o) return false;
  const node = T.node;
  const viaStream = node.streams.some(function (st) { return st.reader === 'server'; });
  return (!!o.peerAnswer && o.peerAnswer.said === 'answered by peerKey9' && viaStream && node.asked.some(function (b) { return b.call === 'peer.post' && b.args && b.args.to === 'peerKey9'; })) || false;
}, test.limit.quick);
test.run('spirit.require with a path, a key and how answers the peer\'s branch through spirit.peerPost, once for two callers, not its own', 0.2, function () {
  const o = O(); if (!o) return false;
  return (!!o.peer && o.peer[0] === true && o.peer[2] === 'hello from peerKey1' && o.peer[3] === true && o.peerHow === 777) || false;
}, test.limit.quick);
// goal/G43.32; Andy: "clients don't run code from afar, they run their own FUCKING copy", "DO IT! WITH CODE FROM THE
// OWN NODE!": the peer's family is made from this root's own spirit/demo/api.js; what the peer hands back is never run.
// Code from afar run here is a hole: 0.8.
test.run('a peer\'s branch is made without asking the peer for its api.js', 0.8, function () {
  const o = O(); if (!o) return false;
  return (!!o.peer && o.peer[1] === 0) || false;
}, test.limit.quick);
test.run('nothing the peer hands back is run: its code never ran here', 0.8, function () {
  const o = O(); if (!o) return false;
  return o.peerRan === false || false;
}, test.limit.quick);
test.run('the peer\'s branch has the verbs of its own copy, hello, and none the peer named (peerOnly)', 0.8, function () {
  const o = O(); if (!o) return false;
  return o.peerOwn === true || false;
}, test.limit.quick);
test.run('a peer\'s branch has listener, subscribe and unsubscribe, auto-verbs its api.js does not name, as it has remote', 0.8, function () {
  const o = O(); if (!o) return false;
  const p = o.peerAuto || [];
  return ['listener', 'subscribe', 'unsubscribe', 'remote'].every(function (v) { return p.indexOf(v) !== -1; }) || false;
}, test.limit.quick);
// goal/G49.2 (Andy: "assert the \"branch\"", "yes on the two verbs").
test.run('a bound branch\'s subscribe takes {branch, run?, since?} and sends it as given', 0.2, function () {
  const o = O(); if (!o) return false;
  return o.peerSubscribe === true || false;
}, test.limit.quick);
test.run('a call of the peer branch\'s listener goes to the peer as that branch\'s listener', 0.8, function () {
  const o = O(); if (!o) return false;
  return o.peerListener === true || false;
}, test.limit.quick);
test.run('with no port in its environment.json, require of an interface and tree refuse no-node; no port is guessed or placed on it', 0.2, async function () {
  if (!T.bare) return false;
  const n = await observe(T.bare, 'none');
  return (n.require === 'no-node' && n.tree === 'no-node' && n.noPort === true) || false;
}, test.limit.slow);

// ── 6. ON A PAGE: ITS NODE IS THE PAGE'S ORIGIN ──────────────────────
// 6. on a page: its node is the page's own origin, or the link set on it
// NO API CALL AT LOAD (goal/G43.27, Q1; Andy: "shouldn't it work without making a call, since the elements will trigger the
// necessary calls?", "Q1: clear"): start asks no api, whole or of a family. Any family named on what spirit.ready answers
// stands there and binds when first called; one with no interface is refused no-interface when called.
// The one family start calls is node, for node.card (goal/G41.28, Q10: "yes."): its api is asked as it is called. Never the
// whole api, and no other family's.
test.run('spirit.start() asks no api, spirit.ready answers the instance, a branch binds when first called; no interface: no-interface', 0.2, async function () {
  const wq = T.wq = page();
  const started = wq.spirit.start();
  const again = wq.spirit.start();
  const ps = T.ps = await started;
  const askedAtStart = wq.fetched.filter(function (f) {
    const b = f.url === '/api/spirit' ? JSON.parse(f.body) : null;
    return !!b && b.call === 'api' && !(b.args && b.args.branch === 'node');
  });
  const goneSaid = await Promise.resolve(ps.gone && typeof ps.gone.anything === 'function' ? ps.gone.anything({}) : null)
    .then(function () { return null; }, function (e) { return (e && e.code) || null; });
  return (started === again && wq.spirit.ready === started && !askedAtStart.length && ps.isBrowser === wq.spirit.isBrowser && !!ps.demo && goneSaid === 'no-interface') || false;
}, test.limit.quick);
test.run('on a page with no link, calls go to the page\'s own origin, /api/spirit, as a call with its args', 0.2, async function () {
  if (!T.ps) return false;
  const wq = T.wq;
  const pc = await T.ps.demo.hello({ name: 'hal' });
  const toDoor = wq.fetched.filter(function (f) { return f.url === '/api/spirit'; });
  return (pc.said === 'hello hal' && toDoor.length > 0 && isCall(JSON.parse(toDoor[toDoor.length - 1].body)) && JSON.parse(toDoor[toDoor.length - 1].body).call === 'demo.hello') || false;
}, test.limit.quick);
// goal/G49.6, the same one place on a page: once called, the branch's verbs stand at spirit.required.spirit.demo.api,
// and window.spirit holds no demo of its own.
test.run('on a page, a branch called has its verbs at spirit.required.spirit.demo.api, and window.spirit holds no demo', 0.2, async function () {
  if (!T.ps) return false;
  const wq = T.wq;
  const placed = wq.spirit.required && wq.spirit.required.spirit && wq.spirit.required.spirit.demo && wq.spirit.required.spirit.demo.api;
  return (!!placed && typeof placed.hello === 'function' && !Object.prototype.hasOwnProperty.call(wq.spirit, 'demo')) || false;
}, test.limit.quick);
test.run('on a page with window.spirit.transport set, every call goes through that link and nothing is fetched', 0.2, async function () {
  if (!T.ps) return false;
  const wq = T.wq;
  const linked = [];
  wq.spirit.transport = { ask: function (v) { linked.push(v); return { status: 200, body: { said: 'via link' } }; }, file: function (p) { linked.push('file ' + p); return { status: 200, bytes: new Uint8Array(fs.readFileSync(path.join(RUN, p))) }; } };
  const before = T.linkBefore = wq.fetched.length;
  const viaLink = await wq.spirit.demo.hello({ name: 'x' });
  return (viaLink.said === 'via link' && linked[0] === 'demo.hello' && wq.fetched.length === before) || false;
}, test.limit.quick);
// A face's events come down its link: spirit.event.subscribe hands the handlers to the link's events, fetching nothing.
test.run('on a face, spirit.event.subscribe hands its handlers to the link\'s events, its unsubscribe is the link\'s, and nothing is fetched', 0.2, function () {
  if (!T.ps || !T.wq.spirit.transport) return false;
  const wq = T.wq;
  const handed = [];
  wq.spirit.transport.events = function (h) { handed.push(h); return function () { handed.push('off'); }; };
  const mine = { onUpdate: function () {} };
  const offLink = wq.spirit.event.subscribe(mine);
  offLink();
  delete wq.spirit.transport;
  return (handed[0] === mine && handed[1] === 'off' && wq.fetched.length === T.linkBefore) || false;
}, test.limit.quick);
test.run('on a page the one instance is window.spirit, and nothing else is made', 0.2, function () {
  if (!T.wq) return false;
  const wq = T.wq;
  return (wq.spirit === wq.window.spirit && !('call' in wq.spirit)) || false;
}, test.limit.quick);

// ── 6a. LOOPBACK OR NOT ──────────────────────────────────────────────
// 6a. in a browser, loopback or not: its home node, or a face through a relay
test.run('isLoopback() answers true on 127.0.0.1, localhost and [::1], false on any other host, and false in node', 0.2, function () {
  const at = function (host) {
    const w2 = { location: { hostname: host }, TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL };
    w2.window = w2;
    vm.runInContext(SOURCE, vm.createContext(w2), { filename: 'spirit.js' });
    return w2.spirit.isLoopback();
  };
  const hosts = { '127.0.0.1': true, 'localhost': true, '[::1]': true, 'bert.spirit.example': false, '10.0.0.5': false };
  const wrongHosts = Object.keys(hosts).filter(function (h) { return at(h) !== hosts[h]; });
  return (!wrongHosts.length && s.isLoopback() === false) || false;
}, test.limit.quick);

// ── 6b. ON A FACE, spirit.js LOADS THE FACE ──────────────────────────
// 6b. on a face: face.html holds spirit.js alone, and spirit.js loads the face shell
// goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": one tag, /spirit.js, and nothing pasted in by a server.
test.run('face.html says it is a face (data-spirit="face") and loads spirit.js by one script tag, and no other script', 0.2, function () {
  const faceHtml = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'), 'utf8');
  const faceScripts = faceHtml.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b[^>]*>[\s\S]*?<\/script>/g) || [];
  return (/<html[^>]*data-spirit="face"/.test(faceHtml) && faceScripts.length === 1 && /^<script src="\/spirit\.js"><\/script>$/.test(faceScripts[0])) || false;
}, test.limit.quick);
test.run('the node serves face.html byte for byte as it is on disk', 0.2, async function () {
  const served = await new Promise(function (resolve) {
    const chunks = [];
    const res = { writeHead: function () {}, setHeader: function () {}, end: function (b) { if (b) chunks.push(Buffer.from(b)); resolve(Buffer.concat(chunks)); } };
    try { require(path.join(RUN, 'spirit', 'server', 'serveCommon.js')).sendFile(res, path.join(RUN, 'spirit', 'shell', 'face.html')); } catch (e) { resolve(Buffer.alloc(0)); }
  });
  return served.equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'))) || false;
}, test.limit.quick);
test.run('no server pastes spirit.js into a page, and serveCommon.inlineSpirit is gone from the node and the relay', 0.2, function () {
  const serverSrc = fs.readFileSync(path.join(RUN, 'spirit', 'server', 'serveCommon.js'), 'utf8') + fs.readFileSync(path.join(RUN, 'spirit', 'server', 'relay.js'), 'utf8');
  return !/inlineSpirit/.test(serverSrc) || false;
}, test.limit.quick);
test.run('on the home node\'s page spirit.js gets shell/boot.js alone and runs it, spirit.booted answering; the seal waits for a face', 0.2, async function () {
  const injected = T.injected = [];
  const faceWindow = T.faceWindow = {
    fetch: function (url) {
      // The node's addresses, each served from its file (goal/G43.18, Q25: serveCommon.pageFile).
      const file = path.join(RUN, require(path.join(RUN, 'spirit', 'server', 'serveCommon.js')).pageFile(String(url).replace(/^\/+/, '')));
      const there = fs.existsSync(file);
      return Promise.resolve({ status: there ? 200 : 404, headers: { get: function () { return ''; } }, arrayBuffer: function () { return Promise.resolve(there ? new Uint8Array(fs.readFileSync(file)).buffer : new ArrayBuffer(0)); } });
    },
    TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL, setTimeout: setTimeout,
    // The home node's own page, on loopback (goal/G43.18: a face on a relay logs in first, with spirit.login).
    location: { hostname: '127.0.0.1' },
    document: {
      readyState: 'complete',
      querySelector: function () { return null; },
      documentElement: { getAttribute: function (n) { return n === 'data-spirit' ? 'face' : null; } },
      createElement: function () { return { textContent: '' }; },
      body: { appendChild: function (el) { injected.push(el.textContent); } },
      addEventListener: function () {},
    },
  };
  faceWindow.window = faceWindow;
  vm.runInContext(SOURCE, vm.createContext(faceWindow), { filename: 'spirit.js' });
  let booted = null;
  try { await faceWindow.spirit.booted; booted = true; } catch (e) { booted = false; }
  // goal/G41.3: face/ moved into shell/; goal/G43.18: the files under spirit/shell/, at the addresses they had; the link, which
  // requires the seal, is spirit.js's own (Q22).
  const readRun = function (p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } };
  const seal = readRun('spirit/shell/seal.js');
  const shellSrc = readRun('spirit/shell/boot.js');
  return (booted === true && !!shellSrc && !!seal && injected.length === 1 && injected[0].indexOf(shellSrc) === 0 && injected[0].indexOf(seal) === -1 && SOURCE.indexOf("requireOne('shell/seal.js')") !== -1) || false;
}, test.limit.quick);

// ── 7. THE ONE LOADER, THE SAME IN NODE AND ON A PAGE ────────────────
// 7. spirit.require(path, key): the one loader, the same in node and on a page
test.run('in node, a component by its run-root path answers its module.exports', 0.2, async function () {
  const inNode = await s.require(COMPONENT);
  return inNode === require(path.join(RUN, COMPONENT)) || false;
}, test.limit.quick);
test.run('in node, a component that is not there refuses', 0.2, async function () {
  const missing = await refusedWith(s.require('spirit/noSuchComponent.js'));
  return (!!missing && missing !== 'answered') || false;
}, test.limit.quick);
// ON A PAGE A FILE RUNS AS A PLAIN SCRIPT (goal/G41.7; Andy: "script IS what codeMirror Is, use the require interfaces
// that exists in spirit.js or boot.js, NOTHING HAND-ROLLED"): no module box, so a file written for both takes its page
// branch and puts itself on the page, as every shell element does; a stylesheet is put on as a style.
// THE SAME PLACE ON BOTH SIDES (goal/G49.4; Andy: "have i NOT fucking specified, that on both, browser and node,
// spirit.require() places the loaded script at the exact same motherfucking location/path in the spirit object", "FUCKING
// FIX THAT!!"; G43.32: "helpers with no create are no fucking elements. they live in require."): on a page a required helper
// stands at spirit.required.<its path>, the real object as in node, and the require answers it.
test.run('on a page, spirit/fieldRules.js required stands at spirit.required.spirit.fieldRules, the real one, and the require answers it', 0.2, async function () {
  if (!T.wq) return false;
  const wq = T.wq;
  const onPage = await wq.spirit.require(PAGE_COMPONENT);
  const placed = wq.spirit.required && wq.spirit.required.spirit && wq.spirit.required.spirit.fieldRules;
  return (!!placed && typeof placed.problem === 'function' && onPage === placed && !wq.scriptError) || false;
}, test.limit.quick);
test.run('on a page, spirit/data.js required stands at spirit.required.spirit.data, the real one, and the require answers it', 0.2, async function () {
  if (!T.wq) return false;
  const wq = T.wq;
  let onPage = null;
  try { onPage = await wq.spirit.require('spirit/data.js'); } catch (e) { onPage = null; }
  const placed = wq.spirit.required && wq.spirit.required.spirit && wq.spirit.required.spirit.data;
  return (!!placed && typeof placed.makeFamily === 'function' && typeof placed.viewAt === 'function' && onPage === placed) || false;
}, test.limit.quick);
// A CodeMirror mode file, written for both node and a page: given no module box it finds CodeMirror on the page (here
// a stand-in, the library itself needs a real browser) and defines its mode on it.
test.run('on a page, a CodeMirror mode file, required, runs as the page script it is, finds CodeMirror and defines its mode', 0.2, async function () {
  const boxed = page();
  const defined = [];
  boxed.CodeMirror = { defineMode: function (name) { defined.push(name); }, defineMIME: function () {}, registerHelper: function () {}, resolveMode: function () { return {}; } };
  await boxed.spirit.require('spirit/element/codeMirror/mode/css/css.js');
  return (defined.indexOf('css') !== -1 && !boxed.scriptError) || false;
}, test.limit.quick);
test.run('on a page, a stylesheet required is put on the page as a style', 0.2, async function () {
  if (!T.wq) return false;
  const wq = T.wq;
  const sheet = await wq.spirit.require('spirit/element/codeMirror/lib/codemirror.css');
  return (!!sheet && wq.styles.length === 1 && /\.CodeMirror/.test(wq.styles[0])) || false;
}, test.limit.quick);
test.run('on a page, a component that is not there refuses not-found', 0.2, async function () {
  if (!T.wq) return false;
  return (await refusedWith(T.wq.spirit.require('spirit/noSuchComponent.js'))) === 'not-found' || false;
}, test.limit.quick);
test.run('on a page, an interface answers its member on window.spirit', 0.2, async function () {
  if (!T.wq) return false;
  const pf = await T.wq.spirit.require(T.wq.spirit.branchPath('demo'));
  return pf === T.wq.spirit.demo || false;
}, test.limit.quick);
test.run('on a page, a require with a key answers the peer\'s branch through the home node\'s peer.post, not its own node\'s', 0.2, async function () {
  if (!T.wq) return false;
  const wq = T.wq;
  const pp = await wq.spirit.require(wq.spirit.branchPath('demo'), 'peerKey2');
  const ppa = await pp.hello({ name: 'x' });
  return (wq.fetched.some(function (f) { return f.url === '/api/spirit' && JSON.parse(f.body).call === 'peer.post'; }) && ppa.said === 'hello page peer' && pp !== wq.spirit.demo) || false;
}, test.limit.quick);

// ── 7a. spirit.require DE-DUPES, AS NODE'S require DOES (goal/G41.3) ──
// Andy: "spirit.js require() require implementation MUST, like a node.js require, de-dupe the require, it a script was
// already loaded". A path required twice is fetched and run once, every caller getting the same answer; a script the
// boot already loaded counts as required.
// 7a. spirit.require de-dupes: a path is fetched and run once, a script the boot loaded counts as required
test.run('on a page, spirit/fieldRules.js required three times, two at once, is fetched once, and every caller gets the same answer', 0.2, async function () {
  const fetchesOf = function (w, p) { return w.fetched.filter(function (f) { return String(f.url).replace(/^\/+/, '') === p; }).length; };
  const dq = page();
  const twice = await Promise.all([dq.spirit.require(PAGE_COMPONENT), dq.spirit.require(PAGE_COMPONENT)]);
  const third = await dq.spirit.require(PAGE_COMPONENT);
  return (fetchesOf(dq, PAGE_COMPONENT) === 1 && twice[0] === twice[1] && twice[1] === third && !!twice[0]) || false;
}, test.limit.quick);
test.run('on a face, requiring shell/boot.js after the boot loaded it runs nothing again, and answers', 0.2, async function () {
  if (!T.faceWindow) return false;
  let bootAgain = null;
  const beforeBoot = T.injected.length;
  try { bootAgain = await T.faceWindow.spirit.require('shell/boot.js'); } catch (e) { bootAgain = e; }
  const refusedAgain = !bootAgain || bootAgain instanceof Error || (typeof bootAgain === 'object' && (bootAgain.code || bootAgain.ok === false));
  return (T.injected.length === beforeBoot && !refusedAgain) || false;
}, test.limit.quick);

// ── 7c. spirit.required, AND THE NODE ANSWERS AT ONCE (goal/G43.32) ──
// Andy: "spirit.require() both on the node, AND on the browser should simply install every script required, at the
// following point: spirit.required.<path.of.fucking.script>. - no name collisions - easily checkable if script is
// already loaded.", and "box that spirit.require() on the node is just a path-translating wrapper": on the node it
// answers the module at once, as require does; an interface is still bound by asking a node.
// 7c. spirit.required.<path>, and on the node spirit.require answers the module at once
function placeOf(sp, p) { return String(p).replace(/\.js$/, '').split('/').reduce(function (o, k) { return o == null ? undefined : o[k]; }, sp && sp.required); }
const real = require(path.join(RUN, COMPONENT));
test.run('on the node, spirit.require of spirit/relayUrl.js answers its module.exports at once, not a promise', 0.2, function () {
  const atOnce = s.require(COMPONENT);
  return atOnce === real || false;
}, test.limit.quick);
test.run('on the node, spirit/relayUrl.js asked again answers the same module at once', 0.2, function () {
  return s.require(COMPONENT) === real || false;
}, test.limit.quick);
test.run('on the node, spirit/relayUrl.js stands at spirit.required.spirit.relayUrl', 0.2, function () {
  return placeOf(s, COMPONENT) === real || false;
}, test.limit.quick);
// A FILE AND ITS FOLDER BOTH STAND (goal/G43.32): spirit/app.js takes spirit.required.spirit.app, a first level spirit.js
// makes ahead, and keeps spirit/app/api.js placed under it; the verifier's general rules found it standing nowhere.
test.run('on the node, spirit/app/script.js stands at spirit.required.spirit.app.script, and spirit/app/api.js beside it', 0.2, function () {
  const appJs = s.require('spirit/app/script.js');
  return (placeOf(s, 'spirit/app/script.js') === appJs && placeOf(s, 'spirit/app/api.js') === require(path.join(RUN, 'spirit/app/api.js'))) || false;
}, test.limit.quick);
test.run('on the node, an interface is still bound by asking a node, as a promise', 0.2, function () {
  const iface = s.require(s.branchPath('demo'));
  if (iface && typeof iface.then === 'function') { iface.then(null, function () {}); return true; }
  return false;
}, test.limit.quick);
test.run('on a page, once spirit/fieldRules.js is required it stands at spirit.required.spirit.fieldRules', 0.2, async function () {
  const rq = T.rq = page();
  await rq.spirit.require(PAGE_COMPONENT);
  return !!placeOf(rq.spirit, PAGE_COMPONENT) || false;
}, test.limit.quick);
test.run('on a page, a script never required has no place in spirit.required', 0.2, function () {
  if (!T.rq) return false;
  const rq = T.rq;
  return (!!rq.spirit.required && typeof rq.spirit.required === 'object' && !placeOf(rq.spirit, 'spirit/noSuchComponent.js')) || false;
}, test.limit.quick);

// ── 7b. spirit.js LOADS THE CACHE ITSELF (goal/G41.3, Q2) ──────────────
// Andy: spirit.js "on start of this client functionality ... AUTOMATICALLY caches ALL streamed datasets", "yes." The
// cache is spirit/data.js (spirit.required.spirit.data); spirit.js loads it when its client part starts, page and process alike.
// 7b. spirit.js loads the cache itself, on a page and in a process
function isCache(d) { return !!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'; }
test.run('on a page, once spirit.js has started, spirit.required.spirit.data is the cache, with nothing else loading it', 0.2, async function () {
  const cq = T.cq = page();
  try { await cq.spirit.start(); } catch (e) { /* the cache is the question here */ }
  return isCache(cq.spirit.required.spirit.data) || false;
}, test.limit.quick);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": the file tree's meaning is the files row element's, which
// loads with a files element (rule/26); spirit.js loads the cache and no data script.
test.run('on a page spirit.js loads no data script with the cache, and so no spirit/element/search/file/data.js', 0.2, function () {
  if (!T.cq) return false;
  const cq = T.cq;
  return !/data\.js/.test(JSON.stringify(cq.fetched).replace(/data\.js/g, '')) || false;
}, test.limit.quick);
// goal/G41.19, Andy: no preloading elements: the cache alone; an element comes with whoever draws with it.
test.run('on a page spirit.js loads the cache and no element, and so no files row element with it', 0.2, function () {
  if (!T.cq) return false;
  const preloaded = T.cq.fetched.map(function (f) { return String(f.url) + ' ' + String(f.body || ''); }).filter(function (u) { return !/data\.js/.test(u) && /shell\//.test(u); });
  return !preloaded.length || false;
}, test.limit.quick);
test.run('in a process, requiring spirit.js gives spirit.required.spirit.data, the cache', 0.2, function () {
  const inProcess = spawnSync(process.execPath, ['-e', "const s = require(process.argv[1]); const d = s.required.spirit.data; process.stdout.write(String(!!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'));", path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8', timeout: 20000 });
  return inProcess.stdout === 'true' || false;
}, test.limit.quick);

// ── 8. A MODULE THAT DOES NOT LOAD spirit.js FIRST GOES RED ──────────
// The module rules are in spirit-sibling-general.js (its generalRules part) since goal/G47.1, box v94, 2; their own test,
// a module whose first require is not spirit.js goes red, is that file's: spirit/test/test/spirit-sibling-general.js.

// ── 9. NO API UP FRONT, ON A REAL PAGE (goal/G43.27) ──────────
// Andy: "MAKE SURE spirit.js doesn't load every fucking api upfront!!!!!!!!!!!!!!", and (G41.3) "lazy-load, is a
// tree....". A real page (headless Chrome) of a scratch node, the home page loaded as a user opens it, every call to the
// node's door counted. Never a live node.
// 9. no api up front, on a real page
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const L = {};
// Every call to the node's door, as the page sends it: { call, args }.
function calls() {
  return L.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && m.params.request.postData; })
    .map(function (m) { try { return JSON.parse(m.params.request.postData); } catch (e) { return null; } }).filter(Boolean);
}
test.run('a scratch node comes up with a headless page on it', 0.2, async function () {
  L.node = await H.scratchNode();
  L.page = L.node.up ? await H.chromePage(H.findChrome()) : null;
  if (!L.node.up || !L.page || L.page.error) { L.page = null; return false; }
  return true;
}, test.limit.slow);
test.run('the page called verbs as it loaded', 0.2, async function () {
  if (!L.page) return false;
  // The home page as a user opens it, then a while for it to settle.
  await L.page.send('Page.navigate', { url: L.node.base + '/face.html' });
  await H.until(function () { return L.page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
  await H.sleep(6000);
  L.atLoad = calls();
  L.verbCalls = L.atLoad.filter(function (c) { return c.call !== 'api'; });
  L.used = new Set(L.verbCalls.map(function (c) { return String(c.call).split('.')[0]; }));
  L.asked = L.atLoad.filter(function (c) { return c.call === 'api' && c.args && c.args.branch; }).map(function (c) { return String(c.args.branch); });
  return L.verbCalls.length > 0 || false;
}, test.limit.slow);
test.run('on a real page, the page never asks for the whole api, an api call with no branch', 0.2, function () {
  if (!L.atLoad) return false;
  const whole = L.atLoad.filter(function (c) { return c.call === 'api' && !(c.args && c.args.branch); });
  return !whole.length || false;
}, test.limit.quick);
test.run('on a real page, no branch\'s api is asked that the page neither calls nor reads the data of', 0.2, function () {
  if (!L.atLoad) return false;
  // A FAMILY WHOSE DATA THE PAGE LOADED IS USED (goal/G47.1, Andy's rule: "every api.js requires it's companion data.js, and is
  // the only script to require that data.js"): requiring a branch's api.js is how a page gets that branch's data, so a family
  // whose data.js the page fetched was asked for it.
  const fetched = L.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && m.params.request.method === 'GET'; })
    .map(function (m) { return m.params.request.url.replace(L.node.base, '').replace(/^\//, '').replace(/[?#].*$/, ''); });
  const readData = function (f) { return fetched.indexOf('spirit/' + f + '/data.js') !== -1 || fetched.indexOf('spirit/app/' + f + '/data.js') !== -1; };
  const unused = Array.from(new Set(L.asked)).filter(function (f) { return !L.used.has(f) && !readData(f); });
  return !unused.length || false;
}, test.limit.quick);
// NO FILE IT DOES NOT NEED YET (Andy: "all, spirit.js still seems to be loading all sorts of shit that it doesn't need
// yet.", and "wsl, why didn't you make sure of this?"). Every file the page fetched as it loaded, with what asked for it.
test.run('the page fetched more than two scripts as it loaded', 0.2, function () {
  if (!L.atLoad) return false;
  L.gets = L.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && m.params.request.method === 'GET'; }).map(function (m) {
    const frames = (m.params.initiator && m.params.initiator.stack && m.params.initiator.stack.callFrames) || [];
    return { file: m.params.request.url.replace(L.node.base, '').replace(/^\//, '').replace(/[?#].*$/, ''), by: frames.length ? frames[0].url.replace(L.node.base, '').replace(/^\//, '') : '' };
  });
  L.scripts = L.gets.filter(function (g) { return /\.js$/.test(g.file); });
  return L.scripts.length > 2 || false;
}, test.limit.quick);
test.run('on a real page, no file is fetched twice as the page loads', 0.2, function () {
  if (!L.gets) return false;
  const counted = {};
  L.gets.forEach(function (g) { counted[g.file] = (counted[g.file] || 0) + 1; });
  const again = Object.keys(counted).filter(function (f) { return counted[f] > 1; });
  return !again.length || false;
}, test.limit.quick);
// A script comes when something requires it: spirit.require (spirit.js) loads it, never a list fetched up front.
// face.html asks for spirit.js, spirit.js for the shell's boot.js; every other script is spirit.require's.
test.run('on a real page, every script is loaded by spirit.require when something requires it, and none from a list up front', 0.2, function () {
  if (!L.scripts) return false;
  const listed = L.scripts.filter(function (g) { return g.file !== 'spirit.js' && g.file !== 'shell/boot.js' && g.by !== 'spirit.js'; });
  return !listed.length || false;
}, test.limit.quick);
// A dialog's parts come when it opens: the home page opens no app's detail, so none of its files is fetched.
test.run('on a real page, no detail is open, and none of an app detail\'s files is fetched', 0.2, function () {
  if (!L.gets) return false;
  const detail = L.gets.filter(function (g) { return /^spirit\/element\/search\/app\/detail\.js$|^spirit\/element\/appInstaller\.js$|^spirit\/element\/search\/app\/(serverDEBUG|changeAppIcon|changeAppLabel|rowFormSetShell)\.js$/.test(g.file); });
  return !detail.length || false;
}, test.limit.quick);
test.run('on a real page, no branch\'s api is asked twice', 0.2, function () {
  if (!L.atLoad) return false;
  const twice = Array.from(new Set(L.asked)).filter(function (f) { return L.asked.filter(function (x) { return x === f; }).length > 1; });
  return !twice.length || false;
}, test.limit.quick);
// A node family the page has not touched yet, called now through the spirit object: its api is asked once, at
// first use, and not again on the second call. Which family that is, the page decides as it loads (event, net, peer,
// owner or config, the first it has not used): its name is in the answer, never the title.
test.run('one of event, net, peer, owner and config is a branch the page has not used yet', 0.2, function () {
  if (!L.atLoad) return false;
  L.fresh = ['event', 'net', 'peer', 'owner', 'config'].filter(function (f) { return !L.used.has(f) && L.asked.indexOf(f) === -1; })[0] || '';
  return !!L.fresh || false;
}, test.limit.quick);
test.run('the branch the page has not used yet is bound on the page once it is required', 0.2, async function () {
  if (!L.fresh) return false;
  const fresh = L.fresh;
  L.before = calls().length;
  const reach = "Promise.resolve(window.spirit.require('spirit/" + fresh + "/api.js')).then(function () { return !!window.spirit." + fresh + "; }, function () { return false; })";
  const first = await L.page.evaluate(reach);
  const second = await L.page.evaluate(reach);
  await H.sleep(1000);
  L.reached = true;
  return (first === true && second === true) || false;
}, test.limit.slow);
test.run('on a real page, using the branch the page has not used yet for the first time asks its api once, and using it again asks nothing', 0.2, function () {
  if (!L.reached) return false;
  const later = calls().slice(L.before).filter(function (c) { return c.call === 'api' && c.args && c.args.branch === L.fresh; });
  return later.length === 1 || false;
}, test.limit.quick);

// AN APP SWITCHED ON AFTER THE PAGE LOADED WORKS, NO RELOAD (Andy, Q1: "shouldn't it work without making a call, since
// the elements will trigger the necessary calls?", and "wsl, make sure your reds assert that as well!"). desk, off when
// the page loaded, is switched on from the page; once its server answers, the Desk element is opened on that same page:
// it asks desk itself and draws its list, never "the desk server did not answer".
test.run('desk, off at load, is switched on from the page with app.active', 0.2, async function () {
  if (!L.atLoad) return false;
  L.on = await L.page.evaluate("window.spirit.ready.then(function (s) { return Promise.resolve(s.require(s.branchPath('app'))).then(function () { return s.app.activeApp({ key: 'desk', active: true }); }); }).then(function (r) { return !!(r && r.ok); }, function () { return false; })");
  return L.on === true || false;
}, test.limit.quick);
test.run('the desk server answers the page once switched on', 0.2, async function () {
  let up = '';
  if (L.on === true) {
    await H.until(async function () {
      up = await L.page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call: 'desk.items.search', args: { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false } }) }).then(function (r) { return String(r.status); })");
      return up === '200';
    }, 40000);
  }
  L.up = up;
  return up === '200' || false;
}, test.limit.long);
test.run('on a real page, the Desk element opens on the page that loaded before desk was on', 0.2, async function () {
  if (L.up !== '200') return false;
  const mark = L.page.heard.length;
  const drawn = await L.page.evaluate("(function () { var d = document.createElement('div'); document.body.appendChild(d);" +
    " return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.required.spirit.app.desk.element.create(d, {});" +
    " return new Promise(function (r) { setTimeout(function () { r(JSON.stringify({ text: d.innerText, nodes: d.querySelectorAll('*').length })); }, 8000); }); }," +
    " function () { return JSON.stringify({ refused: true }); }); })()");
  let got = {};
  try { got = JSON.parse(drawn); } catch (e) { got = { refused: String(drawn) !== '' }; }
  L.got = got;
  L.deskAsked = L.page.heard.slice(mark).filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && /"call":"desk\.items\.search"/.test(m.params.request.postData || ''); });
  return (!got.refused && got.nodes > 0) || false;
}, test.limit.long);
test.run('on a real page, the Desk element asks desk itself with desk.items.search, and no reload', 0.2, function () {
  if (!L.got) return false;
  return L.deskAsked.length > 0 || false;
}, test.limit.quick);
test.run('on a real page, the Desk list draws and never says "the desk server did not answer"', 0.2, function () {
  if (!L.got) return false;
  return (!L.got.refused && !/did not answer/.test(String(L.got.text))) || false;
}, test.limit.quick);

// The sections below, each folded in from a file of its own, run in order after the checks above.

// ── spirit.js ASKS FS.path NOWHERE (goal/G43.27, requirement 6) ──
// spirit.js read as it is, comments stripped.
function codeOf(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }
const C = {};
test.run('spirit.js asks FS.path nowhere', 0.2, function () {
  C.sj = codeOf(read('spirit/spirit.js'));
  return (C.sj.length > 1000 && !/\.FS\.path\s*\(|FS\.path\b/.test(C.sj)) || false;
}, test.limit.quick);

// ── THE PAGE'S STREAM COMES BACK AFTER ITS NODE RESTARTS (goal/G47.1, cleaning; Andy: "AND OF COURSE THE FUCKING SHELL NEVER
// EVER FUCKING RECONNECTS AFTER A FUCKING RESTART OF THE NODE..."). A face page on a lab node, a subscriber of spirit.event
// counting what the page's one stream hands it; the node restarted on the same port. The stream must come back by itself.
// On the file's own lab node and page (L, part 9 above): a test file holds lab nodes for its whole run, so asking another
// would wait for one of its own; the restart is the last thing done to L.node.
const RC = { before: 0 };
test.run('a face page opens, its stream handing a subscriber the node\'s snapshot', 0.2, async function () {
  if (!L.page || !L.node || !L.node.up) return false;
  await L.page.send('Page.navigate', { url: L.node.base + '/face.html' });
  await H.until(function () { return L.page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
  await L.page.evaluate('window.spirit.ready.then(function () { window.zzHeard = 0; window.spirit.event.subscribe({ onSnapshot: function () { window.zzHeard += 1; }, onUpdate: function () { window.zzHeard += 1; } }); return true; })');
  const ok = await H.until(function () { return L.page.evaluate('(window.zzHeard || 0) > 0'); }, 20000);
  RC.before = await L.page.evaluate('window.zzHeard || 0');
  return !!ok || false;
}, test.limit.slow);
test.run('after its node restarts on the same port, the page\'s stream comes back by itself: the node is heard again within 60 s', 0.8, async function () {
  if (!RC.before) return false;
  await L.node.restart();
  const back = await H.until(function () { return L.page.evaluate('(window.zzHeard || 0) > ' + RC.before); }, 60000);
  return !!back || false;
}, test.limit.slow);

// The element move's checks (goal/G43.5) judge the tree, not spirit.js: they are the general tests' now, spirit-sibling-general.js
// (no file names the old shell folder of the elements, none reaches an element through spirit.elements, none through spirit.required for one spirit/element/
// does not define) and spirit-sibling-browser.js (every element module loads on a page, its factory at spirit.required.<its path>).
// Andy, goal/G47.1: "1, 2 and 3 Belong in spirit/test/spirit.js", "the rest belong in motherfucking spirit-sibling-general/browser/node respectively".
const { execSync } = require('child_process');
const REPO = path.resolve(RUN, '../..');

// ── THE FACE LOGIN PART ──
// THE RELAY LOGIN (goal/G43.18, box v29, "The relay login"; spec: ./spirit.md, its section). Andy's box: "The relay serves a logged-out
// face one plain page, the one-field form, with spirit.js and seal.js only, which make the sealed link home. boot.js,
// shell.css, face.css and every other part of the shell come from the home node over that link.", and "The login is
// spirit.login, in spirit.js, no app. It holds the relay's own calls, state, login and logout on /face/api, and draws the one
// field when logged out. shell/login/ and its login.json go." A real scratch node, a real relay, a real face and its login,
// and a real Chrome on the face at <name>.localhost, a secure context as a face over https is. A step that could not run is
// red, never skipped.
const { scratchFaceRelay } = H;
const DOMAIN = 'localhost';
const NAME = 'login';
const MAIL = 'bert@example.org';
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function homeCall(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// A request as the face's page sends it, at the face's own host.
function atFace(relay, method, p, body, sid) {
  return new Promise(function (resolve) {
    const b = body === undefined ? '' : JSON.stringify(body);
    const host = NAME + '.' + DOMAIN + ':' + relay.port;
    const headers = { Host: host, Origin: 'http://' + host };
    if (b) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(b); }
    if (sid) headers.Cookie = 'spirit_face=' + sid;
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: method, headers: headers }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { resolve({ status: r.statusCode, type: String(r.headers['content-type'] || ''), text: text, cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function () { resolve({ status: 0, text: '' }); });
    q.end(b || undefined);
  });
}
// A real join, the star pressed at home (box v29: a face only on a starred relay), a real face, a real login.
async function faceOf(N, R) {
  await homeCall(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await homeCall(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return {};
  await homeCall(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  const star = await homeCall(N.base, 'contact.faceable', { key: R.relayKey, faceable: true });
  if (star.status !== 200) return {};
  let f = null;
  for (let i = 0; i < 10; i++) { f = await homeCall(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return {};
  await until(function () { return atFace(R, 'POST', '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await atFace(R, 'POST', '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return {};
  const done = await atFace(R, 'POST', '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : {};
}
// What the page shows: its visible fields, the scripts it loaded, by path, and whether a shell is drawn (Contacts, intrinsic,
// is on every shell's list).
const SEEN = '(function () { var f = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select")).filter(function (e) { return e.offsetParent !== null && e.type !== "hidden"; }); ' +
  'var loaded = performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); }); ' +
  'var L = window.spirit && window.spirit.login; ' +
  'return JSON.stringify({ fields: f.length, loaded: loaded, login: !!L && ["state", "login", "logout"].every(function (k) { return typeof L[k] === "function"; }), shell: /\\bContacts\\b/.test(document.body.innerText) }); }())';

const until = H.until;
const sleep = H.sleep;
// faceLogin: the relay login, a plain page, and the shell from the home node (goal/G43.18)
// "shell/login/ and its login.json go": gone since; a check of a fixed path gone from the tree is a migration's, dropped (goal/G47.1).
const FL = {};
test.run('a real node has a real face on a starred relay, logged in', 0.2, async function () {
  // The page of section 9 and its node are let go first.
  if (L.page && L.page.kid) L.page.kid.kill();
  if (L.node && L.node.child) L.node.child.kill();
  FL.N = await H.scratchNode();
  FL.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!FL.N.up || !FL.R.up) return false;
  const F = FL.F = await faceOf(FL.N, FL.R);
  return !!F.sid || false;
}, test.limit.long);
function faceUp() { return !!FL.F && !!FL.F.sid; }
// the box: "The relay serves a logged-out face one plain page ... with spirit.js and seal.js only"
test.run('the relay serves the face its page', 0.2, async function () {
  if (!faceUp()) return false;
  const pageGot = await atFace(FL.R, 'GET', '/');
  return (pageGot.status === 200 && /text\/html/.test(pageGot.type)) || false;
}, test.limit.quick);
async function relayServes(p) {
  if (!faceUp()) return false;
  const g = await atFace(FL.R, 'GET', p);
  return (g.status === 200 && g.text.length > 0) || false;
}
test.run('the relay serves /spirit.js', 0.2, function () { return relayServes('/spirit.js'); }, test.limit.quick);
test.run('the relay serves /shell/seal.js', 0.2, function () { return relayServes('/shell/seal.js'); }, test.limit.quick);
// "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link": logged out
// or in, the relay itself serves none of them.
async function relayKeeps(loggedIn, p) {
  if (!faceUp()) return false;
  const g = await atFace(FL.R, 'GET', p, undefined, loggedIn ? FL.F.sid : '');
  return g.status !== 200 || false;
}
test.run('logged out, the relay does not serve /shell/boot.js', 0.2, function () { return relayKeeps(false, '/shell/boot.js'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell.css', 0.2, function () { return relayKeeps(false, '/shell.css'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell/face.css', 0.2, function () { return relayKeeps(false, '/shell/face.css'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/boot.js', 0.2, function () { return relayKeeps(true, '/shell/boot.js'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell.css', 0.2, function () { return relayKeeps(true, '/shell.css'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/face.css', 0.2, function () { return relayKeeps(true, '/shell/face.css'); }, test.limit.quick);

// the box: "The login is spirit.login, in spirit.js, no app ... and draws the one field when logged out"
function faceUrl() { return 'http://' + NAME + '.' + DOMAIN + ':' + FL.R.port + '/'; }
test.run('spirit.login holds state, login and logout', 0.2, async function () {
  if (!faceUp()) return false;
  const where = H.findChrome();
  if (!where) return false;
  const chrome = FL.chrome = await H.chromePage(where);
  if (chrome.error) { FL.chrome = null; return false; }
  await chrome.send('Page.navigate', { url: faceUrl() });
  await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
  await sleep(3000);
  FL.out = parsed(await chrome.evaluate(SEEN)) || {};
  return FL.out.login === true || false;
}, test.limit.slow);
test.run('logged out, the page shows one field', 0.2, async function () {
  if (!FL.out) return false;
  return FL.out.fields === 1 || false;
}, test.limit.quick);
test.run('logged out, it loads nothing but spirit.js and seal.js', 0.2, function () {
  if (!FL.out) return false;
  const notThree = (FL.out.loaded || []).filter(function (n) { return !/^\/(spirit\.js|shell\/seal\.js|favicon\.ico|shell\/favicon\.svg)(\?|$)/.test(n) && !/^\/face\/api/.test(n); });
  return (Array.isArray(FL.out.loaded) && !notThree.length) || false;
}, test.limit.quick);

// logged in: the shell comes from the home node, over the link
test.run('the browser holds the login', 0.2, async function () {
  if (!FL.out) return false;
  const set = await FL.chrome.send('Network.setCookie', { name: 'spirit_face', value: FL.F.sid, url: faceUrl(), path: '/' });
  FL.cookie = !!(set.result && set.result.success);
  return FL.cookie || false;
}, test.limit.quick);
test.run('logged in, the face draws the home node\'s shell', 0.2, async function () {
  if (!FL.out) return false;
  const chrome = FL.chrome;
  await chrome.send('Page.navigate', { url: faceUrl() });
  FL.drew = await until(function () { return chrome.evaluate(SEEN).then(function (t) { const v = parsed(t) || {}; return v.shell === true; }); }, 30000);
  FL.inn = parsed(await chrome.evaluate(SEEN)) || {};
  return !!FL.drew || false;
}, test.limit.long);
test.run('logged in, none of boot.js, shell.css or face.css came as the relay\'s own file', 0.2, function () {
  if (!FL.inn) return false;
  const plainGets = (FL.inn.loaded || []).filter(function (n) { return /^\/shell\/(boot\.js|face\.css)|^\/shell\.css/.test(n); });
  return (!!FL.drew && !plainGets.length) || false;
}, test.limit.quick);

// the box: spirit.login "holds ... logout"
test.run('logged out by spirit.login.logout, the page shows the one field again', 0.2, async function () {
  if (!FL.out) return false;
  const chrome = FL.chrome;
  await chrome.evaluate('Promise.resolve(window.spirit.login.logout()).then(function () { return true; }, function () { return false; })');
  await chrome.send('Page.navigate', { url: faceUrl() });
  await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
  await sleep(3000);
  const after = parsed(await chrome.evaluate(SEEN)) || {};
  FL.loggedOut = true;
  return (after.fields === 1 && after.shell === false) || false;
}, test.limit.slow);
test.run('after the logout the relay holds the login no more', 0.8, async function () {
  if (!FL.loggedOut) return false;
  const st = await atFace(FL.R, 'POST', '/face/api', { call: 'state', args: {} }, FL.F.sid);
  return (st.status === 200 && !/"loggedIn":\s*true/.test(st.text)) || false;
}, test.limit.quick);

// ── THE FAMILY FINDER PART ──
// A FAMILY'S api.js, AND NO NAME TWICE (goal/G43.27; spec: ./spirit.md, its section). Andy: "duplicate <name>/api.js raise a
// red.", and "spirit/app/contact/ does NOT have an api.js". The tree read as it is; a second api.js planted into a scratch
// node's copy is seen. A branch file is loaded by its path (box v182), so no page looks a family up by its name.
// Every family interface under a run folder, by its name: <name>/api.js where a family lives (spirit/<name>/,
// spirit/app/<name>/, process/js/<name>/ and its family/ folder).
function interfaces(run, files) {
  const by = {};
  files.forEach(function (f) {
    const m = /^spirit\/(?:app\/)?([^/]+)\/api\.js$/.exec(f) || /^process\/js\/([^/]+)\/(?:family\/)?api\.js$/.exec(f);
    if (!m || m[1] === 'app' && f === 'spirit/app/api.js') { if (f === 'spirit/app/api.js') (by.app = by.app || []).push(f); return; }
    (by[m[1]] = by[m[1]] || []).push(f);
  });
  return by;
}
function walk(dir, base, out) {
  (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []).forEach(function (e) {
    if (e.name === 'state' || e.name === '.git' || e.name === 'test') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  });
  return out;
}

// familyFinder: an api.js where a family is, no name twice (goal/G43.27)
// the world
const FF = {};
test.run('ten or more branch names have an api.js in the tree, contact and relay among them', 0.2, function () {
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); }).map(function (f) { return f.slice('spirit/run/'.length); });
  const by = interfaces(RUN, files);
  return (Object.keys(by).length >= 10 && !!by.contact && !!by.relay) || false;
}, test.limit.quick);
test.run('spirit/app/contact/ is an app folder with no api.js', 0.2, function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact', 'api.js'))) || false;
}, test.limit.quick);
// That no branch's name has a second api.js in the tree is judged on each branch folder, as is an app's family found where
// its api.js is (./spirit-sibling-general.js (branchRules), goal/G43.32). Here, a duplicate planted on purpose is seen.

// A scratch node, then folders planted into its copy that break each rule.
test.run('a scratch node is up, on its own copy of the tree', 0.2, async function () {
  // The face of the part above is let go first.
  try { if (FL.chrome && FL.chrome.kid) FL.chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (FL.R) FL.R.stop(); } catch (e) { /* gone */ }
  try { if (FL.N && FL.N.child) FL.N.child.kill(); } catch (e) { /* gone */ }
  const node = FF.node = await H.scratchNode();
  if (!(node.up && node.root)) return false;
  const sRun = FF.sRun = path.join(node.root, 'spirit', 'run');
  const plant = function (rel, text) { const f = path.join(sRun, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  // Rule 3: the same name with an api.js one level deeper is a duplicate.
  plant('spirit/app/relay/api.js', 'module.exports = { verbs: {} };\n');
  return true;
}, test.limit.slow);
// 3. a duplicate is seen
test.run('the check sees the planted second relay/api.js, with both spirit/relay/ and spirit/app/relay/ there', 0.2, function () {
  if (!FF.sRun) return false;
  const planted = interfaces(FF.sRun, walk(FF.sRun, FF.sRun, []));
  if (FF.node && FF.node.child) FF.node.child.kill();
  return (!!planted.relay && planted.relay.length === 2) || false;
}, test.limit.quick);

// goal/G43.20, its box: "a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js, a job is named by its
// route, and nothing falls back to process/js/<name>". In a process: the path spirit.branchPath gives is the family's own
// api.js, a system family's in spirit/<name>/, an app's in spirit/app/<name>/, and none names process/js.
// goal/G43.20: in a process, a family's path is its own api.js, and nothing falls back to process/js
let paths = null;
function branchPaths() {
  if (paths) return paths;
  paths = JSON.parse(require('child_process').spawnSync(process.execPath, ['-e',
    "require('./spirit/spirit.js'); console.log(JSON.stringify({ fs: spirit.branchPath('fs'), desk: spirit.branchPath('desk'), agent: spirit.branchPath('agent'), none: spirit.branchPath('zzNoSuchFamily') }));"],
    { cwd: RUN, encoding: 'utf8' }).stdout || '{}');
  return paths;
}
test.run('a system branch\'s path is spirit/<name>/api.js, so fs is spirit/fs/api.js', 0.2, function () {
  return branchPaths().fs === 'spirit/fs/api.js' || false;
}, test.limit.quick);
test.run('an app\'s path is spirit/app/<name>/api.js, as for desk and agent', 0.2, function () {
  const p = branchPaths();
  return (p.desk === 'spirit/app/desk/api.js' && p.agent === 'spirit/app/agent/api.js') || false;
}, test.limit.quick);
test.run('no path names process/js, a name of no branch\'s included', 0.2, function () {
  const p = branchPaths();
  return (Object.keys(p).length === 4 && !/process\/js/.test(JSON.stringify(p))) || false;
}, test.limit.quick);

// The worlds above, freed once: by the last world before it takes a node of its own (the lab holds five, and these hold
// them all), or at the end, whatever ran.
// A node is freed by its release (it stops the node and hands its lab node back); killing its child alone keeps the lab
// node held.
let earlierFreed = false;
async function freeEarlierWorlds() {
  if (earlierFreed) return;
  earlierFreed = true;
  for (const x of [L, C, FF]) { if (x.page && x.page.kid) { try { x.page.kid.kill(); } catch (e) { /* gone */ } } }
  try { if (FL.chrome && FL.chrome.kid) FL.chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (FL.R) FL.R.stop(); } catch (e) { /* gone */ }
  for (const n of [L.node, C.node, FF.node, FL.N]) {
    if (!n) continue;
    try { if (typeof n.release === 'function') await n.release(); else if (n.child) n.child.kill(); } catch (e) { /* freed as this process ends */ }
  }
}
test.after(async function () {
  if (T.node) T.node.close();
  for (const r of [T.root, T.bare]) { if (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* scratch */ } } }
  await freeEarlierWorlds();
});


// ── A STREAM GONE SILENT IS RESET (goal/G47.1, box v148: "5 seconds without a spirit event, the stream resets: the page's
// stream reader stamps the time of every byte that comes in, beats included, and checks each second; after 5 s of nothing
// it cancels that stream first, so the dead one holds no connection, says the stream is down, and opens a new one at once.") ──
// A page on a scratch node, reached through a go-between of this test: once it goes quiet, it stops reading what the node
// sends, so the page's socket stays open and nothing comes, as on Andy's frozen tab (cw: "the node is sending and the
// socket is open, but your page stopped taking what arrives"). Within the 5 s and a second's grace, the page sends a new
// event.subscribe of its own; then the go-between passes bytes on again. A go-between, not a paused node, so the check
// judges on Windows as on Linux (Andy, goal/G47.1: "so you both FIX the red in spirit.js"; it judged nothing on Windows).
const SIL = {};
// A go-between: every request to it is sent on to the node, named as the node's own (a personal node answers only a host,
// origin and referer of its own address); quiet(true) stops reading what the node answers, on every answer open and to
// come, so the page's socket stays open and nothing arrives; quiet(false) reads again.
function goBetween(port) {
  const answers = [];
  const own = '127.0.0.1:' + port;
  let still = false;
  const server = http.createServer(function (req, res) {
    const headers = Object.assign({}, req.headers, { host: own });
    if (headers.origin) headers.origin = 'http://' + own;
    if (headers.referer) headers.referer = String(headers.referer).replace(/^http:\/\/[^/]+/, 'http://' + own);
    const out = http.request({ host: '127.0.0.1', port: port, method: req.method, path: req.url, headers: headers }, function (answer) {
      answers.push(answer);
      res.writeHead(answer.statusCode, answer.headers);
      if (still) answer.pause();
      answer.on('data', function (b) { res.write(b); });
      answer.on('end', function () { res.end(); });
      answer.on('error', function () { res.destroy(); });
    });
    out.on('error', function () { res.destroy(); });
    res.on('close', function () { if (!res.writableEnded) out.destroy(); });
    req.pipe(out);
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve({
        base: 'http://127.0.0.1:' + server.address().port,
        quiet: function (on) { still = !!on; answers.forEach(function (a) { if (still) a.pause(); else a.resume(); }); },
        stop: function () { answers.forEach(function (a) { a.destroy(); }); server.closeAllConnections(); server.close(); },
      });
    });
  });
}
test.run('a page on a scratch node has its stream open', 0.2, async function () {
  await freeEarlierWorlds();
  SIL.node = await H.scratchNode();
  if (!SIL.node.up) return false;
  SIL.gate = await goBetween(Number(new URL(SIL.node.base).port));
  SIL.page = await H.chromePage(H.findChrome());
  if (!SIL.page || SIL.page.error) return false;
  await SIL.page.send('Page.navigate', { url: SIL.gate.base + '/face.html' });
  if (!(await H.until(function () { return SIL.page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000))) return false;
  await SIL.page.evaluate('window.zzConn = []; window.spirit.event.subscribe({ onConnection: function (u) { window.zzConn.push(u); } }); true');
  return true;
}, test.limit.slow);
test.after(async function () {
  try { if (SIL.gate) SIL.gate.stop(); } catch (e) { /* gone */ }
  try { if (SIL.page && SIL.page.kid) SIL.page.kid.kill(); } catch (e) { /* gone */ }
  try { if (SIL.node && SIL.node.release) await SIL.node.release(); } catch (e) { /* gone */ }
});
const subscribeIds = function () { return SIL.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /event\.subscribe/.test(String(m.params.request.postData || '')); }).map(function (m) { return m.params.requestId; }); };
const subscribes = function () { return subscribeIds().length; };
// When a request of the page ended, by its id: finished or failed (a cancelled read fails it), in the order Chrome said them.
const endedAt = function (id) { let at = -1; SIL.page.heard.forEach(function (m, i) { if ((m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') && m.params.requestId === id && at < 0) at = i; }); return at; };
const sentAt = function (id) { let at = -1; SIL.page.heard.forEach(function (m, i) { if (m.method === 'Network.requestWillBeSent' && m.params.requestId === id && at < 0) at = i; }); return at; };
test.run('a stream with no event for 5 s is reset, and the page opens a new one by itself', 0.8, async function () {
  if (!SIL.page || !SIL.gate) return false;
  await H.sleep(1500);
  const before = subscribes();
  if (!before) return false;
  SIL.old = subscribeIds()[before - 1];
  SIL.conn = Number(await SIL.page.evaluate('window.zzConn.length'));
  SIL.gate.quiet(true);
  const reset = await H.until(function () { return Promise.resolve(subscribes() > before); }, 6500);
  SIL.fresh = subscribeIds()[before];
  SIL.saidDown = (await SIL.page.evaluate('window.zzConn.slice(' + SIL.conn + ')')) || [];
  SIL.gate.quiet(false);
  return !!reset || false;
}, test.limit.slow);
test.run('the page cancels the silent stream first, so the old one ended before the new one was sent', 0.8, function () {
  if (!SIL.old || !SIL.fresh) return false;
  const ended = endedAt(SIL.old), sent = sentAt(SIL.fresh);
  return (ended >= 0 && ended < sent) || false;
}, test.limit.quick);
test.run('the page says the stream is down, onConnection false, before the new one', 0.8, function () {
  if (!SIL.saidDown) return false;
  return SIL.saidDown.indexOf(false) !== -1 || false;
}, test.limit.quick);
