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
const os = require('os');
const vm = require('vm');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const RUN = path.join(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SOURCE = fs.readFileSync(path.join(RUN, 'spirit', 'spirit.js'), 'utf8');
const COMPONENT = 'spirit/relayUrl.js';
const PAGE_COMPONENT = 'spirit/fieldRules.js';   // written for both node and a page, as the face's parts are
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
async function refusedWith(promise) { try { await promise; return 'answered'; } catch (e) { return e && e.code; } }

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
  if (c === 'api' && a.family === 'demo') return [200, { interface: DEMO }];
  if (c === 'api' && a.family) return [404, { ok: false, code: 'no-family', error: 'no family ' + a.family }];
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-root-'));
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
async function code(p) { try { await p; return 'answered'; } catch (e) { return e && e.code; } }
(async function () {
  out.keys = Object.keys(s).sort();
  out.same = require(process.argv[2] + '/spirit/spirit.js') === s && globalThis.spirit === s;
  if (process.argv[3] === 'none') {
    out.require = await code(s.require(s.familyPath('demo')));
    out.tree = await code(s.tree());
    out.noPort = !('port' in s);
  } else {
    const fams = await Promise.all([s.require(s.familyPath('demo')), s.require(s.familyPath('demo'))]);
    const two = await Promise.all([fams[0].hello({ name: 'bert' }), fams[1].hello({ name: 'carl' })]);
    out.two = two.map(function (r) { return r.said; });
    out.bound = fams[0] === fams[1] && fams[0] === s.demo && typeof s.demo.hello === 'function';
    // goal/G43.32, decided 8: the api.js required stands at spirit.required.spirit.<branch-path>.api as well.
    out.apiPlaced = !!(s.required && s.required.spirit && s.required.spirit.demo && s.required.spirit.demo.api !== undefined);
    out.hi = (await s.demo.hi('dave')).said;
    out.dotted = typeof s.demo.lineWrite === 'function' && s.demo.lineWrite === s.demo['line.write'] && (await s.demo.lineWrite({ text: 't' })).wrote;
    // No FS set on a family (goal/G43.20): its files are spirit.fs's, by the path its id names.
    out.fs = !('FS' in s.demo);
    out.noArg = await code(s.demo.hello({ nme: 'x' }));
    out.noVerb = typeof s.demo.nothing === 'undefined';
    out.noFamily = await code(s.require(s.familyPath('gone')));
    try { await s.demo.hello({ name: 'held' }); } catch (e) { out.held = [e.code, e.message, e.status]; }
    try { await s.demo.hello({ name: 'slow' }); } catch (e) { out.slow = [e.status, e.message]; }
    out.tree = Object.keys(await s.tree()).sort();
    out.viaRequire = (await s.require(s.familyPath('demo'))) === s.demo;
    out.outcome = [await s.outcome(s.demo.hello({ name: 'eve' })), await s.outcome(s.demo.hello({ nme: 1 })), await s.outcome(s.demo.hello({ name: 'held' })), await s.outcome(Promise.reject(new Error('gone')))]
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
    const both = await Promise.all([s.require(s.familyPath('demo'), 'peerKey1', { waitMs: 777 }), s.require(s.familyPath('demo'), 'peerKey1', { waitMs: 777 })]);
    out.peer = [both[0] === both[1], asks, (await both[0].hello({ name: 'x' })).said, s.demo !== both[0]];
    out.peerRan = globalThis.peerCodeRan === true;
    out.peerOwn = typeof both[0].hello === 'function' && typeof both[0].peerOnly === 'undefined';
  }
  process.stdout.write(JSON.stringify(out));
}()).catch(function (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.stack || e) })); });
`;
function observe(root, mode, port) {
  const file = path.join(root, 'observe.js');
  fs.writeFileSync(file, OBSERVE);
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [file, root, mode || '', String(port || ''), '--node', JSON.stringify({ name: 'nodey', publicKey: 'K1', ownerKey: 'O1' })],
      { cwd: root, env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'job_7' }) });
    let said = '';
    let errs = '';
    kid.stdout.on('data', function (c) { said += c; });
    kid.stderr.on('data', function (c) { errs += c; });
    kid.on('close', function () { try { resolve(JSON.parse(said)); } catch (e) { resolve({ threw: (said + errs).slice(-400) }); } });
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
      const file = path.join(RUN, require(path.join(RUN, 'spirit', 'serveCommon.js')).pageFile(String(url).replace(/^\/+/, '')));
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
test.run('in node: isNode() true, isBrowser() false', 0.2, function () {
  return (s.isNode() === true && s.isBrowser() === false) || 'in node: isNode() ' + s.isNode() + ', isBrowser() ' + s.isBrowser();
}, test.limit.quick);
test.run('in node: require answers the one instance, the global spirit, every time', 0.2, function () {
  return (globalThis.spirit === s && require(path.join(RUN, 'spirit', 'spirit.js')) === s) || 'in node: the global and what require answered differ';
}, test.limit.quick);
test.run('a global spirit already there is the one it fills, not replaced', 0.2, function () {
  const kept = spawnSync(process.execPath, ['-e', 'globalThis.spirit = { mark: 1 }; const s = require(process.argv[1]); console.log(String(s === globalThis.spirit && s.mark === 1 && typeof s.require === "function"));', path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8' });
  return String(kept.stdout).trim() === 'true' || 'a global spirit already there was replaced or not filled: ' + short(kept.stdout + kept.stderr);
}, test.limit.quick);
test.run('on a page: window.spirit at once, isBrowser() true, isNode() false', 0.2, function () {
  const w = T.w = page();
  return (!!w.spirit && w.spirit.isBrowser() === true && w.spirit.isNode() === false) || 'on a page: ' + short(w.spirit && { isBrowser: w.spirit.isBrowser && w.spirit.isBrowser(), isNode: w.spirit.isNode && w.spirit.isNode() });
}, test.limit.quick);
const NO_PAGE = 'no page: the world failed';
test.run('the source sets the global before its first require', 0.2, function () {
  const sets = code.search(/\broot\.spirit\s*=/);
  const firstRequire = code.search(/\brequire\(/);
  return (sets !== -1 && sets < firstRequire) || 'the global is set at ' + sets + ', the first require at ' + firstRequire;
}, test.limit.quick);
test.run('nothing in spirit.js but isNode() and isBrowser() asks where it runs', 0.2, function () {
  return !/typeof (window|module|process|require|TextDecoder|Buffer)/.test(code.replace(/function isNode\(\)[^\n]*\n|function isBrowser\(\)[^\n]*\n/g, '')) || 'spirit.js asks where it runs outside isNode() and isBrowser()';
}, test.limit.quick);
// data: the cache, spirit.data (goal/G41.3); familyPath: the one family path function (goal/G41.12); cacheManager: a
// family's data.js, found by the folder shape and loaded (goal/G43.27) (goal/G41.28, Andy: "the shell can introspect to find and
// download their clientCacheManagers").
const MEMBERS = ['DEFAULT_SPIRIT_PORT', 'MIME_TYPES', 'VERSION', 'cacheManager', 'check', 'data', 'debug', 'error', 'escapeHtml', 'event', 'familyPath', 'formatBytes', 'isBrowser', 'isLoopback', 'isNode', 'job', 'node', 'outcome', 'peerPost', 'require', 'rules', 'tree'];
test.run('in node the instance holds exactly its members, and the families it binds', 0.2, function () {
  return JSON.stringify(Object.keys(s).filter(function (k) { return typeof s[k] !== 'object' || ['MIME_TYPES', 'data', 'event', 'job', 'node'].indexOf(k) !== -1 || Array.isArray(s[k]); }).sort()) === JSON.stringify(MEMBERS) ||
    'in node the instance holds ' + short(Object.keys(s).sort());
}, test.limit.quick);
test.run('no factory, no transport and no second object handed out, in node or on a page', 0.2, function () {
  if (!T.w || !T.w.spirit) return NO_PAGE;
  const factories = ['createSpirit', 'assemble', 'forNode', 'forPeer', 'nodeTransport', 'pageTransport', 'peerTransport', 'loadInterface', 'spiritObject', 'call', 'port'];
  const left = factories.filter(function (k) { return k in s || k in T.w.spirit; });
  return !left.length || 'still handed out: ' + left.join(', ');
}, test.limit.quick);
// THE NODE IN TWO PLACES, THE RELAY'S FACE ROUTES IN THREE (goal/G43.18, Q22: the link home moved into spirit.js; box v29: the
// login is spirit.login): post and get to the node; the login's /face/api, and the link's /face/call, whole and piece by piece.
test.run('one post and one get reach the node, post(verb, args) and get(path); the other three are the relay\'s face routes, the login and the link', 0.2, function () {
  const fetches = (code.match(/\bfetch\(/g) || []).length;
  const toFace = (code.match(/\bfetch\('\/face\/(api|call)'/g) || []).length;
  return (fetches === 5 && toFace === 3 && /function post\(verb, args(, how)?\)/.test(code) && /function get\(path\)/.test(code)) ||
    'spirit.js reaches the network in ' + fetches + ' places, ' + toFace + ' of them the face routes, or has no post(verb, args) and get(path)';
}, test.limit.quick);

// ── 2. IN NODE: spirit.js's OWN ──────────────────────────────────────
// 2. in node: the node's facts, the job and the tables are spirit.js's own
test.run('spirit.js hands out no spirit.core; spirit.MIME_TYPES is its own table', 0.2, function () {
  const mime = s.MIME_TYPES;
  return (!('core' in s) && !!mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json'])) || 'spirit.js still holds spirit.core, or no MIME table of its own: ' + short(Object.keys(s));
}, test.limit.quick);
test.run('spirit.VERSION is 0.0.1 and spirit.DEFAULT_SPIRIT_PORT 65432', 0.2, function () {
  return (s.VERSION === '0.0.1' && s.DEFAULT_SPIRIT_PORT === 65432) || 'the version and the default port: ' + short([s.VERSION, s.DEFAULT_SPIRIT_PORT]);
}, test.limit.quick);
test.run('spirit.debug: off at start, set by a boolean and answering the state, anything else only reads it', 0.2, function () {
  const dbg = [s.debug(), s.debug(true), s.debug(), s.debug('yes'), s.debug(false), s.debug()];
  return JSON.stringify(dbg) === JSON.stringify([false, true, true, true, false, false]) || 'spirit.debug answered ' + short(dbg);
}, test.limit.quick);

// ── 3. THE HELPERS ───────────────────────────────────────────────────
// 3. the helpers, in node and on a page alike
function helpers(where, o) {
  const e = o.error('boom');
  return (!!e && !!e.error && e.error.string === 'boom' && o.formatBytes(0) === '0 Bytes' && o.formatBytes(1024) === '1 KB' && o.formatBytes(1536) === '1.5 KB' && o.escapeHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;') ||
    where + ': helpers answered ' + short([e, o.formatBytes(0), o.formatBytes(1024), o.escapeHtml('&<>"\'')]);
}
test.run('in node: error, formatBytes and escapeHtml answer as specified', 0.2, function () { return helpers('node', s); }, test.limit.quick);
test.run('on a page: error, formatBytes and escapeHtml answer as specified', 0.2, function () { return T.w && T.w.spirit ? helpers('page', T.w.spirit) : NO_PAGE; }, test.limit.quick);

// ── 4. THE CHECK ─────────────────────────────────────────────────────
// 4. check: every argument against its verb's declaration, every rule
const KEY = 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
const rules = { text: ['a', 1], id: ['a', ''], flag: ['yes', 'no'], number: [1, Infinity], bool: [true, 'true'], object: [{}, []], list: [[], {}],
  key: [KEY, 'abc'], url: ['https://a.b', 'ftp://a.b'], path: ['a/b.js', '../a'], name: ['bert', 7], description: ['a line', 7], paragraph: ['a paragraph', 7] };
test.run('spirit.rules names exactly bool, description, flag, id, key, list, name, number, object, paragraph, path, text and url, in node and on a page', 0.2, function () {
  if (!T.w || !T.w.spirit) return NO_PAGE;
  return (JSON.stringify(s.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort()) && JSON.stringify(T.w.spirit.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort())) || 'spirit.rules: ' + short(s.rules);
}, test.limit.quick);
test.run('each rule passes a good value and refuses a bad one bad-request', 0.2, function () {
  const wrongRules = Object.keys(rules).filter(function (r) {
    const spec = { v: r };
    return s.check('t', spec, { v: rules[r][0] }) !== null || !s.check('t', spec, { v: rules[r][1] }) || s.check('t', spec, { v: rules[r][1] }).code !== 'bad-request';
  });
  return !wrongRules.length || 'rules that judged wrong: ' + wrongRules.join(', ');
}, test.limit.quick);
test.run('an argument it does not name is no-such-argument; a missing one bad-request; one marked ? may be missing; arguments not an object, or a rule that does not exist, bad-request', 0.2, function () {
  const c1 = s.check('t', { a: 'text' }, { b: 'x' });
  const c2 = s.check('t', { a: 'text' }, {});
  const c3 = s.check('t', { a: 'text?' }, {});
  const c4 = s.check('t', { a: 'text' }, 'x');
  const c5 = s.check('t', { a: 'nosuchrule' }, { a: 'x' });
  return (!!c1 && c1.code === 'no-such-argument' && c1.argument === 'b' && !!c2 && c2.code === 'bad-request' && c3 === null && !!c4 && c4.code === 'bad-request' && !!c5 && c5.code === 'bad-request') ||
    'check answered ' + short([c1 && c1.code, c2 && c2.code, c3, c4 && c4.code, c5 && c5.code]);
}, test.limit.quick);

// ── 5. IN NODE: ITS NODE, ITS FAMILIES, ITS PEERS ────────────────────
// 5. in node: its node is 127.0.0.1 at the port of its run root's environment.json; it binds families on itself
const NO_O = 'the instance in node did not answer: the world failed';
test.run('the world: the instance of a scratch run root that names a fake node answers what it saw', 0.2, async function () {
  T.node = await fakeNode();
  T.root = scratchRoot(T.node.port);
  T.bare = scratchRoot(0);
  const o = await observe(T.root);
  if (o.threw) return 'the instance in node threw: ' + short(o.threw);
  T.o = o;
  return true;
}, test.limit.slow);
function O() { return T.o || null; }
test.run('the scratch run root\'s instance is its process\'s one global', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return o.same || 'the scratch instance is not its process\'s global';
}, test.limit.quick);
// goal/G43.32: in node a branch is bound from the api.js on its own disc, so its node is never asked for it.
test.run('spirit.require of the demo interface binds it on the one instance as spirit.demo, once for two callers at once, from its own disc: its node is never asked for its api.js', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const node = T.node;
  return (!!o.two && o.two[0] === 'hello bert' && o.two[1] === 'hello carl' && !!o.bound && node.asked.filter(function (b) { return b.call === 'api' && b.args && b.args.family === 'demo'; }).length === 0) ||
    'binding demo: ' + short([o.two, o.bound, node.asked.filter(function (b) { return b.call === 'api'; }).length]);
}, test.limit.quick);
// goal/G43.32, decided 8: "spirit.require of a branch's api.js places the api.js at spirit.required.spirit.<branch-path>.api and binds its verbs on spirit.<branch>.<verb>".
test.run('in node: the api.js required also stands at spirit.required.spirit.demo.api, the verbs bound on spirit.demo', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return (!!o.bound && !!o.apiPlaced) || 'in node: spirit/demo/api.js, required, ' + (o.bound ? 'binds spirit.demo but stands nowhere at spirit.required.spirit.demo.api' : 'did not bind spirit.demo');
}, test.limit.quick);
test.run('a bound family has its own names, a dotted verb in camel case too (line.write as lineWrite), and no FS set (goal/G43.20)', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return (o.hi === 'hello dave' && o.dotted === 't' && o.fs === true) || 'the bound family: ' + short([o.hi, o.dotted, o.fs]);
}, test.limit.quick);
test.run('an argument the verb does not name is refused before it leaves; a verb the family lacks is not on it; a family with no interface refuses no-interface', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return (o.noArg === 'no-such-argument' && o.noVerb === true && o.noFamily === 'no-interface') || 'refusals: ' + short([o.noArg, o.noVerb, o.noFamily, T.node.asked.length]);
}, test.limit.quick);
test.run('the node\'s refusal keeps its code, its words and its status; a plain-text answer keeps its text', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return (!!o.held && o.held[0] === 'held' && o.held[1] === 'held by bert' && o.held[2] === 409 && !!o.slow && o.slow[0] === 504 && o.slow[1] === 'the app server did not answer') || 'the node\'s refusals: ' + short([o.held, o.slow]);
}, test.limit.quick);
test.run('spirit.tree() answers its node\'s api as it stands', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return JSON.stringify(o.tree) === JSON.stringify(['demo', 'gone']) || 'spirit.tree(): ' + short(o.tree);
}, test.limit.quick);
test.run('spirit.require(spirit.familyPath(\'demo\')) answers the same member, spirit.demo', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return !!o.viaRequire || 'spirit.require of an interface did not answer spirit.demo';
}, test.limit.quick);
test.run('spirit.outcome: 200 and the body; 400 for a call the check refused; the node\'s own status; 0 when nothing answered', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const oc = o.outcome || [];
  return (!!oc[0] && oc[0][0] === 200 && oc[0][1] === 'hello eve' && oc[1][0] === 400 && oc[1][1] === 'no-such-argument' && oc[2][0] === 409 && oc[3][0] === 0) || 'spirit.outcome: ' + short(oc);
}, test.limit.quick);
test.run('spirit.node: its port from environment.json, and the name, key and owner the node handed it as --node', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const f = o.facts || {};
  return (f.port === T.node.port && f.name === 'nodey' && f.key === 'K1' && f.ownerKey === 'O1') || 'spirit.node: ' + short(f);
}, test.limit.quick);
test.run('spirit.event.publish and spirit.job start, progress and end publish by event.publish with the job\'s own id, the one path (no job.update, no spirit.job.publish); one over the payload cap is said as dropped; a second start while one is open refuses job-open', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const node = T.node;
  const updates = node.asked.filter(function (b) { return b.call === 'event.publish'; }).map(function (b) { return b.args; });
  const states = updates.map(function (u) { return u.app && u.app.job && u.app.job.state; }).filter(Boolean);
  const dropped = updates.filter(function (u) { return u.app && u.app.dropped; });
  return (o.publish === true && o.tooBig === false && updates.length > 0 && updates.every(function (u) { return u.id === 'job_7'; }) && updates.some(function (u) { return u.app && u.app.x === 1; })
      && dropped.length === 1 && dropped[0].app.dropped.max > 0 && JSON.stringify(states) === JSON.stringify(['start', 'progress', 'end']) && o.startAgain === 'job-open'
      && o.noJobsPublish === true && !node.asked.some(function (b) { return b.call === 'job.update'; })) ||
    'publishing: ' + short([o.publish, o.tooBig, updates.length, states, dropped.length, o.startAgain, o.noJobsPublish]);
}, test.limit.quick);
test.run('spirit.event.subscribe: the node\'s events family as a stream, said up, then the snapshot, then each update, until unsubscribed', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return JSON.stringify(o.heard) === JSON.stringify(['up:true', 'snapshot:j1', 'update:j1:done']) || 'spirit.event.subscribe heard ' + short(o.heard);
}, test.limit.quick);
// goal/G43.3: a process that followed the stream as a page would take its node's owner's waiting lines.
test.run('in a process, every event.subscribe says it is a server, so it takes no packets', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const subscribes = T.node.asked.filter(function (b) { return b.call === 'event.subscribe'; });
  return (subscribes.length > 0 && subscribes.every(function (b) { return b.reader === 'server'; })) || 'in a process, event.subscribe said: ' + short(subscribes.map(function (b) { return b.reader; }));
}, test.limit.quick);
test.run('spirit.peerPost: one post of peer.post, the answer read off the node\'s events (event.subscribe) as a server, as it always worked', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  const node = T.node;
  const viaStream = node.streams.some(function (st) { return st.reader === 'server'; });
  return (!!o.peerAnswer && o.peerAnswer.said === 'answered by peerKey9' && viaStream && node.asked.some(function (b) { return b.call === 'peer.post' && b.args && b.args.to === 'peerKey9'; })) || 'spirit.peerPost: ' + short([o.peerAnswer, viaStream]);
}, test.limit.quick);
test.run('spirit.require(path, key, how): the peer\'s family, its calls through spirit.peerPost with how, one for two callers at once, and not its own node\'s spirit.demo', 0.2, function () {
  const o = O(); if (!o) return NO_O;
  return (!!o.peer && o.peer[0] === true && o.peer[2] === 'hello from peerKey1' && o.peer[3] === true && o.peerHow === 777) || 'a peer\'s family: ' + short([o.peer, o.peerHow]);
}, test.limit.quick);
// goal/G43.32; Andy: "clients don't run code from afar, they run their own FUCKING copy", "DO IT! WITH CODE FROM THE
// OWN NODE!": the peer's family is made from this root's own spirit/demo/api.js; what the peer hands back is never run.
// Code from afar run here is a hole: 0.8.
test.run('a peer\'s family is made without asking the peer for its api.js', 0.8, function () {
  const o = O(); if (!o) return NO_O;
  return (!!o.peer && o.peer[1] === 0) || 'the peer was asked for its api.js ' + short(o.peer && o.peer[1]) + ' times';
}, test.limit.quick);
test.run('nothing the peer hands back is run: its code never ran here', 0.8, function () {
  const o = O(); if (!o) return NO_O;
  return o.peerRan === false || 'the peer\'s api.js text ran in this process (it marked it)';
}, test.limit.quick);
test.run('the peer\'s family has the verbs of its own copy, hello, and none the peer named (peerOnly)', 0.8, function () {
  const o = O(); if (!o) return NO_O;
  return o.peerOwn === true || 'the peer\'s family was made from what the peer sent: ' + short(o.peerOwn);
}, test.limit.quick);
test.run('with no port in its environment.json: require of an interface and tree refuse no-node; no default port is guessed, and none is placed on the instance', 0.2, async function () {
  if (!T.bare) return 'no scratch run root: the world failed';
  const n = await observe(T.bare, 'none');
  return (n.require === 'no-node' && n.tree === 'no-node' && n.noPort === true) || 'with no port: ' + short(n);
}, test.limit.slow);

// ── 6. ON A PAGE: ITS NODE IS THE PAGE'S ORIGIN ──────────────────────
// 6. on a page: its node is the page's own origin, or the link set on it
// NO API CALL AT LOAD (goal/G43.27, Q1; Andy: "shouldn't it work without making a call, since the elements will trigger the
// necessary calls?", "Q1: clear"): start asks no api, whole or of a family. Any family named on what spirit.ready answers
// stands there and binds when first called; one with no interface is refused no-interface when called.
// The one family start calls is node, for node.card (goal/G41.28, Q10: "yes."): its api is asked as it is called. Never the
// whole api, and no other family's.
test.run('spirit.start() asks no api: spirit.ready answers the instance, any family named on it stands there and binds when first called; a call to one with no interface is refused no-interface', 0.2, async function () {
  const wq = T.wq = page();
  const started = wq.spirit.start();
  const again = wq.spirit.start();
  const ps = T.ps = await started;
  const askedAtStart = wq.fetched.filter(function (f) {
    const b = f.url === '/api/spirit' ? JSON.parse(f.body) : null;
    return !!b && b.call === 'api' && !(b.args && b.args.family === 'node');
  });
  const goneSaid = await Promise.resolve(ps.gone && typeof ps.gone.anything === 'function' ? ps.gone.anything({}) : 'no stand-in')
    .then(function (v) { return 'answered ' + short(v); }, function (e) { return (e && e.code) || 'refused'; });
  return (started === again && wq.spirit.ready === started && !askedAtStart.length && ps.isBrowser === wq.spirit.isBrowser && !!ps.demo && goneSaid === 'no-interface') ||
    'spirit.start: ' + short([started === again, wq.spirit.ready === started, askedAtStart.length + ' api asks at start', ps.isBrowser === wq.spirit.isBrowser, !!ps.demo, goneSaid]);
}, test.limit.quick);
const NO_WQ = 'no started page: the world failed';
test.run('on a page with no link: calls go to the page\'s own origin, /api/spirit, as { call, args } (goal/G41.15)', 0.2, async function () {
  if (!T.ps) return NO_WQ;
  const wq = T.wq;
  const pc = await T.ps.demo.hello({ name: 'hal' });
  const toDoor = wq.fetched.filter(function (f) { return f.url === '/api/spirit'; });
  return (pc.said === 'hello hal' && toDoor.length > 0 && isCall(JSON.parse(toDoor[toDoor.length - 1].body)) && JSON.parse(toDoor[toDoor.length - 1].body).call === 'demo.hello') || 'on a page: ' + short([pc, toDoor.length]);
}, test.limit.quick);
test.run('on a page with window.spirit.transport set: every call goes through that link, nothing fetched', 0.2, async function () {
  if (!T.ps) return NO_WQ;
  const wq = T.wq;
  const linked = [];
  wq.spirit.transport = { ask: function (v) { linked.push(v); return { status: 200, body: { said: 'via link' } }; }, file: function (p) { linked.push('file ' + p); return { status: 200, bytes: new Uint8Array(fs.readFileSync(path.join(RUN, p))) }; } };
  const before = T.linkBefore = wq.fetched.length;
  const viaLink = await wq.spirit.demo.hello({ name: 'x' });
  return (viaLink.said === 'via link' && linked[0] === 'demo.hello' && wq.fetched.length === before) || 'with a link: ' + short([viaLink, linked, wq.fetched.length - before]);
}, test.limit.quick);
// A face's events come down its link: spirit.event.subscribe hands the handlers to the link's events, fetching nothing.
test.run('on a face: spirit.event.subscribe hands its handlers to the link\'s events, and its unsubscribe is the link\'s; nothing fetched', 0.2, function () {
  if (!T.ps || !T.wq.spirit.transport) return NO_WQ;
  const wq = T.wq;
  const handed = [];
  wq.spirit.transport.events = function (h) { handed.push(h); return function () { handed.push('off'); }; };
  const mine = { onUpdate: function () {} };
  const offLink = wq.spirit.event.subscribe(mine);
  offLink();
  delete wq.spirit.transport;
  return (handed[0] === mine && handed[1] === 'off' && wq.fetched.length === T.linkBefore) || 'spirit.event.subscribe on a face: ' + short([handed.length, wq.fetched.length - T.linkBefore]);
}, test.limit.quick);
test.run('on a page the one instance is window.spirit, and nothing else is made', 0.2, function () {
  if (!T.wq) return NO_WQ;
  const wq = T.wq;
  return (wq.spirit === wq.window.spirit && !('call' in wq.spirit)) || 'on a page: ' + short(Object.keys(wq.spirit));
}, test.limit.quick);

// ── 6a. LOOPBACK OR NOT ──────────────────────────────────────────────
// 6a. in a browser, loopback or not: its home node, or a face through a relay
test.run('isLoopback(): true on 127.0.0.1, localhost and [::1], false on any other host, and false in node', 0.2, function () {
  const at = function (host) {
    const w2 = { location: { hostname: host }, TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL };
    w2.window = w2;
    vm.runInContext(SOURCE, vm.createContext(w2), { filename: 'spirit.js' });
    return w2.spirit.isLoopback();
  };
  const hosts = { '127.0.0.1': true, 'localhost': true, '[::1]': true, 'bert.spirit.example': false, '10.0.0.5': false };
  const wrongHosts = Object.keys(hosts).filter(function (h) { return at(h) !== hosts[h]; });
  return (!wrongHosts.length && s.isLoopback() === false) || 'isLoopback judged wrong: ' + short(wrongHosts);
}, test.limit.quick);

// ── 6b. ON A FACE, spirit.js LOADS THE FACE ──────────────────────────
// 6b. on a face: face.html holds spirit.js alone, and spirit.js loads the face shell
// goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": one tag, /spirit.js, and nothing pasted in by a server.
test.run('face.html says it is a face (data-spirit="face") and loads spirit.js by one script tag, and no other script', 0.2, function () {
  const faceHtml = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'), 'utf8');
  const faceScripts = faceHtml.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b[^>]*>[\s\S]*?<\/script>/g) || [];
  return (/<html[^>]*data-spirit="face"/.test(faceHtml) && faceScripts.length === 1 && /^<script src="\/spirit\.js"><\/script>$/.test(faceScripts[0])) || 'face.html\'s scripts: ' + short(faceScripts) + ', or it does not say it is a face';
}, test.limit.quick);
test.run('the node serves face.html byte for byte as it is on disk', 0.2, async function () {
  const served = await new Promise(function (resolve) {
    const chunks = [];
    const res = { writeHead: function () {}, setHeader: function () {}, end: function (b) { if (b) chunks.push(Buffer.from(b)); resolve(Buffer.concat(chunks)); } };
    try { require(path.join(RUN, 'spirit', 'serveCommon.js')).sendFile(res, path.join(RUN, 'spirit', 'shell', 'face.html')); } catch (e) { resolve(Buffer.from('threw ' + e.message)); }
  });
  return served.equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'))) || 'the node serves face.html changed: ' + served.length + ' bytes against ' + fs.statSync(path.join(RUN, 'spirit', 'shell', 'face.html')).size + ' on disk';
}, test.limit.quick);
test.run('no server pastes spirit.js into a page: serveCommon.inlineSpirit is gone, from the node and the relay', 0.2, function () {
  const serverSrc = fs.readFileSync(path.join(RUN, 'spirit', 'serveCommon.js'), 'utf8') + fs.readFileSync(path.join(RUN, 'spirit', 'relayServer.js'), 'utf8');
  return !/inlineSpirit/.test(serverSrc) || 'inlineSpirit is still in serveCommon.js or relayServer.js';
}, test.limit.quick);
test.run('on the home node\'s page spirit.js gets shell/boot.js alone and runs it, spirit.booted answering; the seal waits for a face\'s link, which requires it', 0.2, async function () {
  const injected = T.injected = [];
  const faceWindow = T.faceWindow = {
    fetch: function (url) {
      // The node's addresses, each served from its file (goal/G43.18, Q25: serveCommon.pageFile).
      const file = path.join(RUN, require(path.join(RUN, 'spirit', 'serveCommon.js')).pageFile(String(url).replace(/^\/+/, '')));
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
  try { await faceWindow.spirit.booted; booted = true; } catch (e) { booted = e && e.code; }
  // goal/G41.3: face/ moved into shell/; goal/G43.18: the files under spirit/shell/, at the addresses they had; the link, which
  // requires the seal, is spirit.js's own (Q22).
  const readRun = function (p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } };
  const seal = readRun('spirit/shell/seal.js');
  const shellSrc = readRun('spirit/shell/boot.js');
  return (booted === true && !!shellSrc && !!seal && injected.length === 1 && injected[0].indexOf(shellSrc) === 0 && injected[0].indexOf(seal) === -1 && SOURCE.indexOf("requireOne('shell/seal.js')") !== -1) ||
    'the face boot: ' + short([booted, injected.length, shellSrc ? 'shell/boot.js there' : 'no shell/boot.js', seal ? 'shell/seal.js there' : 'no shell/seal.js']);
}, test.limit.quick);

// ── 7. THE ONE LOADER, THE SAME IN NODE AND ON A PAGE ────────────────
// 7. spirit.require(path, key): the one loader, the same in node and on a page
test.run('in node: a component by its run-root path answers its module.exports', 0.2, async function () {
  const inNode = await s.require(COMPONENT);
  return inNode === require(path.join(RUN, COMPONENT)) || 'in node, ' + COMPONENT + ' answered ' + short(inNode);
}, test.limit.quick);
test.run('in node: a component that is not there refuses', 0.2, async function () {
  const missing = await refusedWith(s.require('spirit/noSuchComponent.js'));
  return (!!missing && missing !== 'answered') || 'in node: a missing component answered';
}, test.limit.quick);
// ON A PAGE A FILE RUNS AS A PLAIN SCRIPT (goal/G41.7; Andy: "script IS what codeMirror Is, use the require interfaces
// that exists in spirit.js or boot.js, NOTHING HAND-ROLLED"): no module box, so a file written for both takes its page
// branch and puts itself on the page, as every shell element does; a stylesheet is put on as a style.
test.run('on a page: spirit/fieldRules.js runs as a plain script, puts itself on window.spirit, and the require answers an empty object', 0.2, async function () {
  if (!T.wq) return NO_WQ;
  const wq = T.wq;
  const onPage = await wq.spirit.require(PAGE_COMPONENT);
  return (!!onPage && Object.keys(onPage).length === 0 && !!wq.spirit.fieldRules && typeof wq.spirit.fieldRules.problem === 'function' && !wq.scriptError) ||
    'on a page, ' + PAGE_COMPONENT + ' answered ' + short(onPage) + ', fieldRules ' + short(!!wq.spirit.fieldRules) + ', error ' + short(wq.scriptError && wq.scriptError.message);
}, test.limit.quick);
// A CodeMirror mode file, written for both node and a page: given no module box it finds CodeMirror on the page (here
// a stand-in, the library itself needs a real browser) and defines its mode on it.
test.run('on a page: a CodeMirror mode file, required, runs as the page script it is, finds CodeMirror and defines its mode', 0.2, async function () {
  const boxed = page();
  const defined = [];
  boxed.CodeMirror = { defineMode: function (name) { defined.push(name); }, defineMIME: function () {}, registerHelper: function () {}, resolveMode: function () { return {}; } };
  await boxed.spirit.require('spirit/element/codeMirror/mode/css/css.js');
  return (defined.indexOf('css') !== -1 && !boxed.scriptError) || 'on a page a CodeMirror mode file did not run as a script: ' + short([defined, boxed.scriptError && boxed.scriptError.message]);
}, test.limit.quick);
test.run('on a page: a stylesheet required is put on the page as a style', 0.2, async function () {
  if (!T.wq) return NO_WQ;
  const wq = T.wq;
  const sheet = await wq.spirit.require('spirit/element/codeMirror/lib/codemirror.css');
  return (!!sheet && wq.styles.length === 1 && /\.CodeMirror/.test(wq.styles[0])) || 'on a page a stylesheet was not put on as a style: ' + wq.styles.length + ' styles';
}, test.limit.quick);
test.run('on a page: a component that is not there refuses not-found', 0.2, async function () {
  if (!T.wq) return NO_WQ;
  return (await refusedWith(T.wq.spirit.require('spirit/noSuchComponent.js'))) === 'not-found' || 'on a page: a missing component did not refuse not-found';
}, test.limit.quick);
test.run('on a page: an interface answers its member on window.spirit', 0.2, async function () {
  if (!T.wq) return NO_WQ;
  const pf = await T.wq.spirit.require(T.wq.spirit.familyPath('demo'));
  return pf === T.wq.spirit.demo || 'on a page: an interface answered another member';
}, test.limit.quick);
test.run('on a page: with a key, the peer\'s family through the home node\'s peer.post, not its own node\'s', 0.2, async function () {
  if (!T.wq) return NO_WQ;
  const wq = T.wq;
  const pp = await wq.spirit.require(wq.spirit.familyPath('demo'), 'peerKey2');
  const ppa = await pp.hello({ name: 'x' });
  return (wq.fetched.some(function (f) { return f.url === '/api/spirit' && JSON.parse(f.body).call === 'peer.post'; }) && ppa.said === 'hello page peer' && pp !== wq.spirit.demo) || 'on a page: a peer\'s family answered ' + short(ppa);
}, test.limit.quick);

// ── 7a. spirit.require DE-DUPES, AS NODE'S require DOES (goal/G41.3) ──
// Andy: "spirit.js require() require implementation MUST, like a node.js require, de-dupe the require, it a script was
// already loaded". A path required twice is fetched and run once, every caller getting the same answer; a script the
// boot already loaded counts as required.
// 7a. spirit.require de-dupes: a path is fetched and run once, a script the boot loaded counts as required
test.run('on a page: spirit/fieldRules.js required three times, two at once, is fetched once, and every caller gets the same answer', 0.2, async function () {
  const fetchesOf = function (w, p) { return w.fetched.filter(function (f) { return String(f.url).replace(/^\/+/, '') === p; }).length; };
  const dq = page();
  const twice = await Promise.all([dq.spirit.require(PAGE_COMPONENT), dq.spirit.require(PAGE_COMPONENT)]);
  const third = await dq.spirit.require(PAGE_COMPONENT);
  return (fetchesOf(dq, PAGE_COMPONENT) === 1 && twice[0] === twice[1] && twice[1] === third && !!twice[0]) ||
    'on a page the require is not de-duped: ' + fetchesOf(dq, PAGE_COMPONENT) + ' fetches, same answer ' + (twice[0] === twice[1] && twice[1] === third);
}, test.limit.quick);
test.run('on a face: requiring shell/boot.js after the boot loaded it runs nothing again, and answers', 0.2, async function () {
  if (!T.faceWindow) return 'no face page booted: the world failed';
  let bootAgain = null;
  const beforeBoot = T.injected.length;
  try { bootAgain = await T.faceWindow.spirit.require('shell/boot.js'); } catch (e) { bootAgain = e; }
  const refusedAgain = !bootAgain || bootAgain instanceof Error || (typeof bootAgain === 'object' && (bootAgain.code || bootAgain.ok === false));
  return (T.injected.length === beforeBoot && !refusedAgain) || 'on a face: shell/boot.js, already booted, was run again or refused: ' + short([T.injected.length - beforeBoot, bootAgain && bootAgain.code]);
}, test.limit.quick);

// ── 7c. spirit.required, AND THE NODE ANSWERS AT ONCE (goal/G43.32) ──
// Andy: "spirit.require() both on the node, AND on the browser should simply install every script required, at the
// following point: spirit.required.<path.of.fucking.script>. - no name collisions - easily checkable if script is
// already loaded.", and "box that spirit.require() on the node is just a path-translating wrapper": on the node it
// answers the module at once, as require does; an interface is still bound by asking a node.
// 7c. spirit.required.<path>, and on the node spirit.require answers the module at once
function placeOf(sp, p) { return String(p).replace(/\.js$/, '').split('/').reduce(function (o, k) { return o == null ? undefined : o[k]; }, sp && sp.required); }
const real = require(path.join(RUN, COMPONENT));
test.run('on the node: spirit.require of spirit/relayUrl.js answers its module.exports at once, not a promise', 0.2, function () {
  const atOnce = s.require(COMPONENT);
  return atOnce === real || 'on the node spirit.require(' + COMPONENT + ') answered ' + (atOnce && typeof atOnce.then === 'function' ? 'a promise' : short(atOnce)) + ', not the module at once';
}, test.limit.quick);
test.run('on the node: asked again, the same module at once', 0.2, function () {
  return s.require(COMPONENT) === real || 'on the node, asked again, spirit.require did not answer the same module at once';
}, test.limit.quick);
test.run('on the node: it stands at spirit.required.spirit.relayUrl', 0.2, function () {
  return placeOf(s, COMPONENT) === real || 'on the node nothing stands at spirit.required.' + COMPONENT.replace(/\.js$/, '').split('/').join('.') + ': ' + short(s.required === undefined ? 'no spirit.required' : placeOf(s, COMPONENT));
}, test.limit.quick);
// A FILE AND ITS FOLDER BOTH STAND (goal/G43.32): spirit/app.js takes spirit.required.spirit.app, a first level spirit.js
// makes ahead, and keeps spirit/app/api.js placed under it; the verifier's general rules found it standing nowhere.
test.run('on the node: spirit/app.js stands at spirit.required.spirit.app, and spirit/app/api.js under it', 0.2, function () {
  const appJs = s.require('spirit/app.js');
  return (placeOf(s, 'spirit/app.js') === appJs && placeOf(s, 'spirit/app/api.js') === require(path.join(RUN, 'spirit/app/api.js'))) ||
    'on the node spirit/app.js and its folder do not both stand: spirit.required.spirit.app is ' + short(placeOf(s, 'spirit/app.js') && Object.keys(placeOf(s, 'spirit/app.js')));
}, test.limit.quick);
test.run('on the node: an interface is still bound by asking a node, a promise', 0.2, function () {
  const iface = s.require(s.familyPath('demo'));
  if (iface && typeof iface.then === 'function') { iface.then(null, function () {}); return true; }
  return 'on the node an interface answered at once: ' + short(iface);
}, test.limit.quick);
test.run('on a page: once spirit/fieldRules.js is required it stands at spirit.required.spirit.fieldRules', 0.2, async function () {
  const rq = T.rq = page();
  await rq.spirit.require(PAGE_COMPONENT);
  return !!placeOf(rq.spirit, PAGE_COMPONENT) || 'on a page nothing stands at spirit.required.' + PAGE_COMPONENT.replace(/\.js$/, '').split('/').join('.') + ' once it is required';
}, test.limit.quick);
test.run('on a page: a script never required has no place in spirit.required', 0.2, function () {
  if (!T.rq) return NO_PAGE;
  const rq = T.rq;
  return (!!rq.spirit.required && typeof rq.spirit.required === 'object' && !placeOf(rq.spirit, 'spirit/noSuchComponent.js')) || 'on a page ' + (rq.spirit.required ? 'spirit.required holds a script never required' : 'there is no spirit.required to look in');
}, test.limit.quick);

// ── 7b. spirit.js LOADS THE CACHE ITSELF (goal/G41.3, Q2) ──────────────
// Andy: spirit.js "on start of this client functionality ... AUTOMATICALLY caches ALL streamed datasets", "yes." The
// cache is spirit/data.js (spirit.data); spirit.js loads it when its client part starts, page and process alike.
// 7b. spirit.js loads the cache itself, on a page and in a process
function isCache(d) { return !!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'; }
test.run('on a page: once spirit.js has started, spirit.data is the cache, nothing else loading it', 0.2, async function () {
  const cq = T.cq = page();
  try { await cq.spirit.start(); } catch (e) { /* the cache is the question here */ }
  return isCache(cq.spirit.data) || 'on a page spirit.js does not load the cache: spirit.data is ' + short(cq.spirit.data && Object.keys(cq.spirit.data));
}, test.limit.quick);
// goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": the file tree's meaning is the files row element's, which
// loads with a files element (rule/26); spirit.js loads the cache and no data script.
test.run('on a page spirit.js loads no data script with the cache: no spirit/element/search/file/data.js (goal/G41.16)', 0.2, function () {
  if (!T.cq) return NO_PAGE;
  const cq = T.cq;
  return !/data\.js/.test(JSON.stringify(cq.fetched).replace(/data\.js/g, '')) || 'on a page spirit.js still loads a data script: ' + short(cq.fetched.map(function (f) { return f.url; }).filter(function (u) { return /data\.js/.test(u) && !/data/.test(u); }));
}, test.limit.quick);
// goal/G41.19, Andy: no preloading elements: the cache alone; an element comes with whoever draws with it.
test.run('on a page spirit.js loads the cache and no element: no files row element with it (goal/G41.19)', 0.2, function () {
  if (!T.cq) return NO_PAGE;
  const preloaded = T.cq.fetched.map(function (f) { return String(f.url) + ' ' + String(f.body || ''); }).filter(function (u) { return !/data\.js/.test(u) && /shell\//.test(u); });
  return !preloaded.length || 'on a page spirit.js still loads elements with the cache: ' + short(preloaded);
}, test.limit.quick);
test.run('in a process: require(spirit.js) gives spirit.data, the cache', 0.2, function () {
  const inProcess = spawnSync(process.execPath, ['-e', "const s = require(process.argv[1]); const d = s.data; process.stdout.write(String(!!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'));", path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8', timeout: 20000 });
  return inProcess.stdout === 'true' || 'in a process spirit.js does not load the cache: ' + short(inProcess.stdout + inProcess.stderr);
}, test.limit.quick);

// ── 8. A MODULE THAT DOES NOT LOAD spirit.js FIRST GOES RED ──────────
// 8. a module that does not load spirit.js first goes red
// The module rules are in spirit-sibling-generalRules.js since goal/G47.1 (spirit-child-generalRules.js folded in).
const rule = path.join(RUN, 'spirit', 'test', 'spirit-sibling-generalRules.js');
test.run('the general rules pass spirit.js itself', 0.2, function () {
  const onSpirit = spawnSync(process.execPath, [rule, 'spirit/spirit.js'], { cwd: RUN, encoding: 'utf8' });
  return (/it sets the global spirit before its first require/.test(onSpirit.stdout) && /✅:\d+/.test(onSpirit.stdout) && !/❌/.test(onSpirit.stdout)) || 'the general rules on spirit.js: ' + short(onSpirit.stdout.slice(-200));
}, test.limit.quick);
test.run('a module whose first require is not spirit.js goes red', 0.2, function () {
  const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-first-'));
  try {
    fs.writeFileSync(path.join(fx, 'late.js'), "const fs = require('fs');\nrequire(" + JSON.stringify(path.join(RUN, 'spirit', 'spirit.js')) + ");\n");
    const late = spawnSync(process.execPath, [rule, path.join(fx, 'late.js')], { cwd: RUN, encoding: 'utf8' });
    return (/does not require spirit\.js first/.test(late.stdout) && /❌/.test(late.stdout)) || 'a module requiring fs before spirit.js: ' + short(late.stdout.slice(-200));
  } finally { try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}, test.limit.quick);

// ── 9. NO API UP FRONT, ON A REAL PAGE (goal/G43.27) ──────────
// Andy: "MAKE SURE spirit.js doesn't load every fucking api upfront!!!!!!!!!!!!!!", and (G41.3) "lazy-load, is a
// tree....". A real page (headless Chrome) of a scratch node, the home page loaded as a user opens it, every call to the
// node's door counted. Never a live node.
// 9. no api up front, on a real page
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const L = {};
const NO_LAZY = 'no scratch node or no headless page: the world failed';
// Every call to the node's door, as the page sends it: { call, args }.
function calls() {
  return L.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && m.params.request.postData; })
    .map(function (m) { try { return JSON.parse(m.params.request.postData); } catch (e) { return null; } }).filter(Boolean);
}
test.run('the world: a scratch node and a headless page on it', 0.2, async function () {
  L.node = await H.scratchNode();
  L.page = L.node.up ? await H.chromePage(H.findChrome()) : null;
  if (!L.node.up || !L.page || L.page.error) { const why = short(L.page && L.page.error); L.page = null; return 'no scratch node or no headless lazyPage: nothing judged (' + why + ')'; }
  return true;
}, test.limit.slow);
test.run('the world: the page called verbs as it loaded', 0.2, async function () {
  if (!L.page) return NO_LAZY;
  // The home page as a user opens it, then a while for it to settle.
  await L.page.send('Page.navigate', { url: L.node.base + '/face.html' });
  await H.until(function () { return L.page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
  await H.sleep(6000);
  L.atLoad = calls();
  L.verbCalls = L.atLoad.filter(function (c) { return c.call !== 'api'; });
  L.used = new Set(L.verbCalls.map(function (c) { return String(c.call).split('.')[0]; }));
  L.asked = L.atLoad.filter(function (c) { return c.call === 'api' && c.args && c.args.family; }).map(function (c) { return String(c.args.family); });
  return L.verbCalls.length > 0 || 'the page called no verb: nothing judged';
}, test.limit.slow);
const NOT_LOADED = 'the page did not load: the world failed';
test.run('on a real page: the page never asks for the whole api (api with no family)', 0.2, function () {
  if (!L.atLoad) return NOT_LOADED;
  const whole = L.atLoad.filter(function (c) { return c.call === 'api' && !(c.args && c.args.family); });
  return !whole.length || 'on a real page: the page asked for the whole api ' + whole.length + ' time(s)';
}, test.limit.quick);
test.run('on a real page: no family\'s api is asked that the page never calls', 0.2, function () {
  if (!L.atLoad) return NOT_LOADED;
  const unused = Array.from(new Set(L.asked)).filter(function (f) { return !L.used.has(f); });
  return !unused.length || 'on a real page: ' + unused.length + ' families\' api asked and never called: ' + short(unused);
}, test.limit.quick);
// NO FILE IT DOES NOT NEED YET (Andy: "all, spirit.js still seems to be loading all sorts of shit that it doesn't need
// yet.", and "wsl, why didn't you make sure of this?"). Every file the page fetched as it loaded, with what asked for it.
test.run('the world: the page fetched more than two scripts as it loaded', 0.2, function () {
  if (!L.atLoad) return NOT_LOADED;
  L.gets = L.page.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && m.params.request.method === 'GET'; }).map(function (m) {
    const frames = (m.params.initiator && m.params.initiator.stack && m.params.initiator.stack.callFrames) || [];
    return { file: m.params.request.url.replace(L.node.base, '').replace(/^\//, '').replace(/[?#].*$/, ''), by: frames.length ? frames[0].url.replace(L.node.base, '').replace(/^\//, '') : '' };
  });
  L.scripts = L.gets.filter(function (g) { return /\.js$/.test(g.file); });
  return L.scripts.length > 2 || 'the page fetched ' + L.scripts.length + ' scripts: nothing judged';
}, test.limit.quick);
test.run('on a real page: no file is fetched twice as the page loads', 0.2, function () {
  if (!L.gets) return NOT_LOADED;
  const counted = {};
  L.gets.forEach(function (g) { counted[g.file] = (counted[g.file] || 0) + 1; });
  const again = Object.keys(counted).filter(function (f) { return counted[f] > 1; });
  return !again.length || 'on a real page: fetched more than once: ' + short(again);
}, test.limit.quick);
// A script comes when something requires it: spirit.require (spirit.js) loads it, never a list fetched up front.
// face.html asks for spirit.js, spirit.js for the shell's boot.js; every other script is spirit.require's.
test.run('on a real page: every script is loaded by spirit.require when something requires it, none from a list up front', 0.2, function () {
  if (!L.scripts) return NOT_LOADED;
  const listed = L.scripts.filter(function (g) { return g.file !== 'spirit.js' && g.file !== 'shell/boot.js' && g.by !== 'spirit.js'; });
  return !listed.length || 'on a real page: ' + listed.length + ' scripts loaded up front, not required: ' + short(listed.map(function (g) { return g.file + ' (by ' + g.by + ')'; }));
}, test.limit.quick);
// A dialog's parts come when it opens: the home page opens no app's detail, so none of its files is fetched.
test.run('on a real page: no detail is open, and none of an app detail\'s files is fetched', 0.2, function () {
  if (!L.gets) return NOT_LOADED;
  const detail = L.gets.filter(function (g) { return /^spirit\/element\/search\/app\/detailElement\.js$|^spirit\/element\/appInstaller\.js$|^spirit\/element\/search\/app\/(serverDEBUG|changeAppIcon|changeAppLabel|rowFormSetShell)\.js$/.test(g.file); });
  return !detail.length || 'on a real page: an app detail\'s files fetched with no detail open: ' + short(detail.map(function (g) { return g.file; }));
}, test.limit.quick);
test.run('on a real page: no family\'s api is asked twice', 0.2, function () {
  if (!L.atLoad) return NOT_LOADED;
  const twice = Array.from(new Set(L.asked)).filter(function (f) { return L.asked.filter(function (x) { return x === f; }).length > 1; });
  return !twice.length || 'on a real page: asked more than once: ' + short(twice);
}, test.limit.quick);
// A node family the page has not touched yet, called now through the spirit object: its api is asked once, at
// first use, and not again on the second call. Which family that is, the page decides as it loads (event, net, peer,
// owner or config, the first it has not used): its name is in the answer, never the title.
test.run('the world: one of event, net, peer, owner and config is a family the page has not used yet', 0.2, function () {
  if (!L.atLoad) return NOT_LOADED;
  L.fresh = ['event', 'net', 'peer', 'owner', 'config'].filter(function (f) { return !L.used.has(f) && L.asked.indexOf(f) === -1; })[0] || '';
  return !!L.fresh || 'every candidate family was already used: nothing judged';
}, test.limit.quick);
test.run('the world: the family the page has not used yet is bound on the page once it is required', 0.2, async function () {
  if (!L.fresh) return 'no family left unused: the world failed';
  const fresh = L.fresh;
  L.before = calls().length;
  const reach = "Promise.resolve(window.spirit.require('spirit/" + fresh + "/api.js')).then(function () { return !!window.spirit." + fresh + "; }, function (e) { return 'refused ' + (e && e.message); })";
  const first = await L.page.evaluate(reach);
  const second = await L.page.evaluate(reach);
  await H.sleep(1000);
  L.reached = true;
  return (first === true && second === true) || fresh + ': ' + short([first, second]);
}, test.limit.slow);
test.run('on a real page: using the family the page has not used yet for the first time asks its api once, and using it again asks nothing', 0.2, function () {
  if (!L.reached) return 'the unused family was not required: the world failed';
  const later = calls().slice(L.before).filter(function (c) { return c.call === 'api' && c.args && c.args.family === L.fresh; });
  return later.length === 1 || 'on a real page: ' + L.fresh + '\'s api was asked ' + later.length + ' times';
}, test.limit.quick);

// AN APP SWITCHED ON AFTER THE PAGE LOADED WORKS, NO RELOAD (Andy, Q1: "shouldn't it work without making a call, since
// the elements will trigger the necessary calls?", and "wsl, make sure your reds assert that as well!"). desk, off when
// the page loaded, is switched on from the page; once its server answers, the Desk element is opened on that same page:
// it asks desk itself and draws its list, never "the desk server did not answer".
test.run('the world: desk, off at load, is switched on from the page (app.active)', 0.2, async function () {
  if (!L.atLoad) return NOT_LOADED;
  L.on = await L.page.evaluate("window.spirit.ready.then(function (s) { return Promise.resolve(s.require(s.familyPath('app'))).then(function () { return s.app.activeApp({ key: 'desk', active: true }); }); }).then(function (r) { return !!(r && r.ok); }, function (e) { return 'refused ' + (e && e.message); })");
  return L.on === true || 'app.active desk: ' + short(L.on);
}, test.limit.quick);
test.run('the world: the desk server answers the page once switched on', 0.2, async function () {
  let up = '';
  if (L.on === true) {
    await H.until(async function () {
      up = await L.page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call: 'desk.items.search', args: { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false } }) }).then(function (r) { return String(r.status); })");
      return up === '200';
    }, 40000);
  }
  L.up = up;
  return up === '200' || 'desk.items.search answered ' + short(up) + ': nothing judged';
}, test.limit.long);
const NO_DESK = 'the desk server did not answer the page: the world failed';
test.run('on a real page: the Desk element opens on the page that loaded before desk was on', 0.2, async function () {
  if (L.up !== '200') return NO_DESK;
  const mark = L.page.heard.length;
  const drawn = await L.page.evaluate("(function () { var d = document.createElement('div'); document.body.appendChild(d);" +
    " return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {});" +
    " return new Promise(function (r) { setTimeout(function () { r(JSON.stringify({ text: d.innerText, nodes: d.querySelectorAll('*').length })); }, 8000); }); }," +
    " function (e) { return JSON.stringify({ refused: String(e && e.message) }); }); })()");
  let got = {};
  try { got = JSON.parse(drawn); } catch (e) { got = { refused: String(drawn) }; }
  L.got = got;
  L.deskAsked = L.page.heard.slice(mark).filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && /"call":"desk\.items\.search"/.test(m.params.request.postData || ''); });
  return (!got.refused && got.nodes > 0) || 'the Desk element did not open: ' + short(got);
}, test.limit.long);
test.run('on a real page: the Desk element asks desk itself (desk.items.search), no reload', 0.2, function () {
  if (!L.got) return NO_DESK;
  return L.deskAsked.length > 0 || 'the Desk element sent no desk.items.search: its family is not reachable on this page';
}, test.limit.quick);
test.run('on a real page: the Desk list draws, never "the desk server did not answer"', 0.2, function () {
  if (!L.got) return NO_DESK;
  return (!L.got.refused && !/did not answer/.test(String(L.got.text))) || 'the Desk page says: ' + short(String(L.got.text || '').slice(0, 200));
}, test.limit.quick);

// The sections below, each folded in from a file of its own, run in order after the checks above.

// ── THE CACHE MANAGER PART ──
// A PAGE FINDS A FAMILY'S data.js BY THE FOLDER SHAPE, NEVER BY FS.path (goal/G43.27, requirement 6; spec:
// ./spirit.md, its section): spirit.js's cacheManager. Andy: "spirit.js can be fixed, no? it knows the difference between an
// app and a system branch?". spirit.js read as it is, comments stripped, and a real page (headless Chrome) of a scratch node
// (headLessChrome.scratchNode), never a live one.
function codeOf(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }
function shorter(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// cacheManager: a page finds a family's data.js by the folder shape, never by FS.path (goal/G43.27)
// 6. a page finds a family's data.js by the folder shape, never by FS.path
const C = {};
test.run('the world: spirit.js and its cacheManager are read', 0.2, function () {
  C.sj = codeOf(read('spirit/spirit.js'));
  return (C.sj.length > 1000 && /function cacheManager/.test(C.sj)) || 'no cacheManager in spirit.js: nothing judged';
}, test.limit.quick);
test.run('cacheManager asks no FS.path, on a page or in node', 0.2, function () {
  const cm = ((C.sj || '').match(/function cacheManager[\s\S]*?\n  }\n/) || [''])[0];
  return (!!cm && !/FS\.path|\.FS\b/.test(cm)) || 'cacheManager still asks the family\'s FS: ' + shorter((cm.match(/.*FS.*/) || [''])[0].trim());
}, test.limit.quick);
test.run('spirit.js asks FS.path nowhere', 0.2, function () {
  return !/\.FS\.path\s*\(|FS\.path\b/.test(C.sj || '') || 'spirit.js still asks FS.path';
}, test.limit.quick);
// ON A REAL PAGE: every family the node names whose data.js is in the tree is loaded by spirit.cacheManager, an app's and a
// system family's alike, also where an app has a system family's name (contact). The agent app is switched on, so its
// family is among them.
function cAsk(call, args) {
  return fetch(C.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
}
test.run('the world: a scratch node is up', 0.2, async function () {
  // The page of section 9 and its node are let go first.
  if (L.page && L.page.kid) L.page.kid.kill();
  if (L.node && L.node.child) L.node.child.kill();
  C.node = await H.scratchNode();
  return !!C.node.up || 'the scratch node did not come up: nothing judged';
}, test.limit.slow);
function withData(n) { return ['spirit/' + n + '/data.js', 'spirit/app/' + n + '/data.js'].some(function (p) { return fs.existsSync(path.join(RUN, p)); }); }
test.run('the world: a page asks the cache of five or more families with a data.js, contact among them', 0.2, async function () {
  const node = C.node;
  if (node && node.up) {
    await cAsk('app.active', { key: 'agent', active: true });
    await H.until(function () { return cAsk('api', { family: 'agent' }).then(function (a) { return a.status === 200; }); }, 30000);
  }
  const chrome = H.findChrome();
  const page = C.page = chrome && node && node.up ? await H.chromePage(chrome) : null;
  let loaded = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    loaded = await page.evaluate("Promise.resolve(window.spirit.ready).then(function (s) { return s.tree(); }).then(function (t) { return Promise.all(Object.keys(t || {}).map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); })");
  }
  C.judged = (loaded || []).filter(function (r) { return withData(r[0]); });
  if (page && page.kid) page.kid.kill();
  if (node && node.child) node.child.kill();
  return (C.judged.length >= 5 && C.judged.some(function (r) { return r[0] === 'contact'; })) || 'a page asked ' + shorter(loaded) + ': nothing judged';
}, test.limit.slow);
// The families come from the page's own tree, known only as it runs: each that does not load is named in the answer.
// spirit.cacheManager("<family>") on a page
test.run('on a page, it loads its family\'s data.js', 0.2, function () {
  if (!C.judged || !C.judged.length) return 'no family asked: the world failed';
  return listedFails(C.judged.filter(function (r) { return r[1] !== 'ok'; }).map(function (r) { return 'on a page, spirit.cacheManager("' + r[0] + '"): ' + r[1]; }));
}, test.limit.quick);
function listedFails(bad) { return !bad.length || bad.join('; '); }

// ── THE ELEMENT MOVE PART ──
// THE ELEMENT MOVE (spec: ./spirit.md, its section; goal/G43.5). Andy, the box: "We are ONLY moving the contents of
// "run://shell/js/" to "run://spirit/element/"", "all elements will keep their name during this move.", "on the browsers,
// spirit object, these elements will live in "spirit.element" (SINGLULAR)", and "all UI code in the product tree that
// references the moved element files, must be changed to correct those references. both file-location AND the home in
// spirit.element (singular)": "uncluding tests", "including the contents of shell/ that remains", "including, new code in
// spirit/app". "shell/shared/ will not be moved or touched." The lists below are what shell/js held when the item began.
const { execSync } = require('child_process');
const REPO = path.resolve(RUN, '../..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
function shortest(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600); }
// Every tracked file shell/js held, by its path under it.
const MOVED_FILES = [
  'apiFamilySelector.js', 'apiVerbSelector.js', 'appHeader/appHeader.js',
  'appHeader/test/appHeader-pinned.html', 'appHeader/test/appHeader.js', 'appHeader/test/appHeader.md',
  'appInstaller.js', 'appServerSelector.js', 'armingButton.js', 'branchEditor.js', 'branchSelector.js',
  'branchSelector/listElement.js', 'branchSelector/rowElement.js', 'branchSelector/test/listElement.js',
  'branchSelector/test/listElement.md', 'branchSelector/test/rowElement.js',
  'branchSelector/test/rowElement.md', 'bundleEditor.js', 'bundleSelector.js',
  'bundleSelector/listElement.js', 'bundleSelector/rowElement.js', 'bundleSelector/test/listElement.js',
  'bundleSelector/test/listElement.md', 'bundleSelector/test/rowElement.js',
  'bundleSelector/test/rowElement.md', 'busyButton.js', 'changeMyDescription.js', 'changeMyLabel.js',
  'codeMirror.js', 'contactDetails/contactDetails.js', 'contactDetails/test/contactDetails.js',
  'contactDetails/test/contactDetails.md', 'contactLabel.js', 'contactSelector.js',
  'contacts/listElement.js', 'contacts/rowElement.js', 'contacts/test/listElement.js',
  'contacts/test/listElement.md', 'contacts/test/rowElement.js', 'contacts/test/rowElement.md',
  'faceForm.js', 'fieldInput.js', 'fileViewer.js', 'files/listElement.js', 'files/rowElement.js',
  'files/test/listElement.js', 'files/test/listElement.md', 'files/test/rowElement-words.html',
  'files/test/rowElement.js', 'files/test/rowElement.md', 'grantSelector/listElement.js',
  'grantSelector/rowElement.js', 'grantSelector/test/listElement.js', 'grantSelector/test/listElement.md',
  'grantSelector/test/rowElement.js', 'grantSelector/test/rowElement.md', 'grantsPanel.js', 'icon.js',
  'iconSelector.js', 'icons/listElement.js', 'icons/rowElement.js', 'joinForm.js', 'joinSteps.js',
  'mediaViewer.js', 'probabilitySearch.js', 'progressBar.js', 'relayPanel.js', 'rowElement.js', 'rowForm.js',
  'tabContainer.js', 'test/apiFamilySelector.js', 'test/apiFamilySelector.md', 'test/apiVerbSelector.js',
  'test/apiVerbSelector.md', 'test/appInstaller.js', 'test/appInstaller.md', 'test/appServerSelector.js',
  'test/appServerSelector.md', 'test/armingButton.js', 'test/armingButton.md', 'test/branchEditor.js',
  'test/branchEditor.md', 'test/branchSelector.js', 'test/branchSelector.md', 'test/bundleEditor.js',
  'test/bundleEditor.md', 'test/bundleSelector.js', 'test/bundleSelector.md', 'test/busyButton-pressed.html',
  'test/busyButton.js', 'test/busyButton.md', 'test/changeMyDescription.js', 'test/changeMyDescription.md',
  'test/changeMyLabel.js', 'test/changeMyLabel.md', 'test/codeMirror.js', 'test/codeMirror.md',
  'test/contactLabel.js', 'test/contactLabel.md', 'test/contactSelector.js', 'test/contactSelector.md',
  'test/faceForm-laid.html', 'test/faceForm.js', 'test/faceForm.md', 'test/fileViewer.js',
  'test/fileViewer.md', 'test/grantsPanel.js', 'test/grantsPanel.md', 'test/icon-sized.html', 'test/icon.js',
  'test/icon.md', 'test/joinForm-laid.html', 'test/joinForm.js', 'test/joinForm.md',
  'test/probabilitySearch.js', 'test/probabilitySearch.md', 'test/probabilitySearchBubble-laid.html',
  'test/probabilitySearchBubble.js', 'test/probabilitySearchBubble.md', 'test/relayPanel.js',
  'test/relayPanel.md', 'test/relayRowStream.js', 'test/relayRowStream.md', 'test/rowElement.js',
  'test/rowElement.md', 'test/rowForm-laid.html', 'test/rowForm.js', 'test/rowForm.md',
  'test/tabContainer.js', 'test/tabContainer.md', 'test/textViewer.js', 'test/textViewer.md',
  'test/workBench-contained.html', 'test/workBench.js', 'test/workBench.md', 'textViewer.js', 'workBench.js',
];
// What each of those puts on the page, read from a real browser when the item began.
const MOVED_NAMES = [
  'apiFamilySelector', 'apiVerbSelector', 'appHeader', 'appInstaller', 'appServerSelector', 'armingButton',
  'branchEditor', 'branchElement', 'branchList', 'branchSelector', 'bundleEditor', 'bundleElement',
  'bundleList', 'bundleSelector', 'busyButton', 'changeMyDescription', 'changeMyLabel', 'codeMirror',
  'contactDetails', 'contactElement', 'contactLabel', 'contactList', 'contactSelector', 'faceForm',
  'fieldInput', 'fileElement', 'fileList', 'fileViewer', 'grantElement', 'grantList', 'grantsPanel', 'icon',
  'iconElement', 'iconList', 'iconSelector', 'joinForm', 'joinSteps', 'mediaViewer', 'probabilitySearch',
  'progressBar', 'relayPanel', 'rowElement', 'rowForm', 'tabContainer', 'textViewer', 'workBench',
];
// The modules among the files, each loaded on a real page below.
const MODULES = [
  'apiFamilySelector.js', 'apiVerbSelector.js', 'appHeader/appHeader.js', 'appInstaller.js',
  'appServerSelector.js', 'armingButton.js', 'branchEditor.js', 'branchSelector.js',
  'branchSelector/listElement.js', 'branchSelector/rowElement.js', 'bundleEditor.js', 'bundleSelector.js',
  'bundleSelector/listElement.js', 'bundleSelector/rowElement.js', 'busyButton.js', 'changeMyDescription.js',
  'changeMyLabel.js', 'codeMirror.js', 'contactDetails/contactDetails.js', 'contactLabel.js',
  'contactSelector.js', 'contacts/listElement.js', 'contacts/rowElement.js', 'faceForm.js', 'fieldInput.js',
  'fileViewer.js', 'files/listElement.js', 'files/rowElement.js', 'grantSelector/listElement.js',
  'grantSelector/rowElement.js', 'grantsPanel.js', 'icon.js', 'iconSelector.js', 'icons/listElement.js',
  'icons/rowElement.js', 'joinForm.js', 'joinSteps.js', 'mediaViewer.js', 'probabilitySearch.js',
  'progressBar.js', 'relayPanel.js', 'rowElement.js', 'rowForm.js', 'tabContainer.js', 'textViewer.js',
  'workBench.js',
];

const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const IN_RUN = tracked.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).map(function (f) { return f.slice('spirit/run/'.length); });

// A line as it stands in the tree, his own words aside: a double-quoted part of a comment or of a document is a quote, and
// "Andy's words are never rewritten"; everything else counts, code in full.
function judged(file, line) {
  if (/\.(md|txt)$/.test(file)) return line.replace(/"[^"]*"/g, '""');
  const cut = line.search(/(^|[^:'"])\/\//);
  if (cut === -1) return line;
  return line.slice(0, cut + 1) + line.slice(cut + 1).replace(/"[^"]*"/g, '""');
}
// Not the product: what the desk writes, what is published, and this suite's own lists (in this file, spirit/test/spirit.js,
// and its spec, since the fold), and codeMirror's own test.
function out(file) {
  return /^(agents|design)\//.test(file) ||
    /spirit\/test\/spirit\.(js|md)$|spirit\/element\/test\/codeMirror\.(js|md)$|shell\/shared\/js\/test\/deskRunStatus-home\.(js|md)$/.test(file) || VENDORED_FOLDERS.holds(file) || /(^|\/)brains\//.test(file) ||
    !/\.(js|json|html|md|css|txt)$/.test(file) || file.indexOf('spirit/') !== 0;
}
const OLD_PATH = /\bshell\/js\b|\bshell\/node_modules\b|['"]shell['"]\s*,\s*['"]js['"]/;
const NAMES = MOVED_NAMES.join('|');
const OLD_HOME = new RegExp('\\belements\\s*\\.\\s*(' + NAMES + ')\\b|\\belements\\s*\\[\\s*[\'"](' + NAMES + ')[\'"]');
const ALIAS = /\b([A-Za-z_]\w*)\s*=\s*[^;\n]*\.elements\b/;

// elementMove: shell/js into spirit/element, its elements on spirit.element (goal/G43.5)
// the files: "We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/""
test.run('shell/js holds no tracked file', 0.2, function () {
  const left = IN_RUN.filter(function (f) { return f.indexOf('shell/js/') === 0; });
  return !left.length || left.length + ' tracked files are still in shell/js, the first: ' + shortest(left.slice(0, 5));
}, test.limit.quick);
test.run('the folder shell/js is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'js')) || 'the folder shell/js still stands';
}, test.limit.quick);
test.run('all the moved files stand at spirit/element/, each under its own name and folder', 0.2, function () {
  const missing = MOVED_FILES.filter(function (f) { return IN_RUN.indexOf('spirit/element/' + f) === -1; });
  return !missing.length || missing.length + ' of ' + MOVED_FILES.length + ' are not at spirit/element/, the first: ' + shortest(missing.slice(0, 5));
}, test.limit.quick);
// The library, CodeMirror inside spirit/element/codeMirror/, is that element's own folder: spirit/element/test/codeMirror.js.

// the references: "both file-location AND the home in spirit.element (singular)", tests and documents too
const M = {};
function references() {
  if (M.oldPath) return;
  M.oldPath = []; M.oldHome = [];
  tracked.filter(function (f) { return !out(f); }).forEach(function (f) {
    const full = path.join(REPO, f);
    if (!fs.existsSync(full)) return;
    const text = fs.readFileSync(full, 'utf8');
    const alias = ALIAS.exec(text);
    const viaAlias = alias ? new RegExp('\\b' + alias[1] + '\\s*\\.\\s*(' + NAMES + ')\\b') : null;
    text.split('\n').forEach(function (raw, i) {
      const line = judged(f, raw);
      if (OLD_PATH.test(line)) M.oldPath.push(f + ':' + (i + 1));
      if (OLD_HOME.test(line) || (viaAlias && viaAlias.test(line))) M.oldHome.push(f + ':' + (i + 1));
    });
  });
}
test.run('no code, test or document names shell/js', 0.2, function () {
  references();
  return !M.oldPath.length || M.oldPath.length + ' lines name shell/js, the first: ' + shortest(M.oldPath.slice(0, 12));
}, test.limit.quick);
test.run('no code, test or document reaches a moved element through spirit.elements', 0.2, function () {
  references();
  return !M.oldHome.length || M.oldHome.length + ' lines do, the first: ' + shortest(M.oldHome.slice(0, 12));
}, test.limit.quick);
// THE OTHER WAY ROUND (found live: Andy, "contact detail don't load in contacts"): contactDetails reached navigation, which did
// not move, through spirit.element, so the page threw when a contact was opened. Nothing names an element there unless spirit/element/ defines it.
// What spirit/element/ defines today: what moved, and what has been added there since (goal/G43.6, valued).
test.run('no code reaches through spirit.element for an element spirit/element/ does not define', 0.2, function () {
  const DEFINED = new Set(MOVED_NAMES);
  IN_RUN.filter(function (f) { return /^spirit\/element\/.*\.js$/.test(f) && !/\/test\//.test(f) && f.indexOf('spirit/element/codeMirror/') !== 0; }).forEach(function (f) {
    const full = path.join(RUN, f);
    if (!fs.existsSync(full)) return;
    const re = /\b(?:E|element)\.([A-Za-z_]\w*)\s*=[^=]/g;
    const text = fs.readFileSync(full, 'utf8');
    let d = null;
    while ((d = re.exec(text))) DEFINED.add(d[1]);
  });
  const notMoved = [];
  tracked.filter(function (f) { return !out(f) && /\.(js|html)$/.test(f); }).forEach(function (f) {
    const full = path.join(REPO, f);
    if (!fs.existsSync(full)) return;
    fs.readFileSync(full, 'utf8').split('\n').forEach(function (raw, i) {
      const cut = raw.search(/(^|[^:'"])\/\//);
      const line = cut === -1 ? raw : raw.slice(0, cut + 1);
      const re = /\bspirit\.element\.([A-Za-z_]\w*)/g;
      let m = null;
      while ((m = re.exec(line))) { if (!DEFINED.has(m[1])) notMoved.push(f + ':' + (i + 1) + ' ' + m[1]); }
    });
  });
  return !notMoved.length || notMoved.length + ' lines do: ' + shortest(notMoved.slice(0, 12));
}, test.limit.quick);

// the page: "these elements will live in "spirit.element" (SINGLULAR) and not on spirit.elementS!!!!"
test.run('the page has spirit.element when it starts', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  const node = M.node = await H.scratchNode();
  const page = M.page = node.up ? await H.chromePage(chrome) : null;
  if (!page || page.error) { const why = page ? page.error : 'the scratch node did not come up'; M.page = null; return why; }
  await page.send('Page.navigate', { url: node.base + '/' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  await H.sleep(2500);
  let at = {};
  try { at = JSON.parse(await page.evaluate('JSON.stringify({ element: typeof window.spirit.element })')); } catch (e) { at = {}; }
  return at.element === 'object' || 'spirit.element is ' + shortest(at.element);
}, test.limit.slow);
test.run('every moved module loads from its new place', 0.2, async function () {
  if (!M.page) return 'no page: the world failed';
  const load = 'var fails = []; ' + JSON.stringify(MODULES.map(function (m) { return 'spirit/element/' + m; })) +
    '.reduce(function (p, f) { return p.then(function () { return Promise.resolve(window.spirit.require(f)).then(null, function (e) { fails.push(f + ": " + e); }); }); }, Promise.resolve())' +
    '.then(function () { return new Promise(function (r) { setTimeout(r, 1500); }); }).then(function () { var E = window.spirit.element || {}; var O = window.spirit.elements || {}; var N = ' + JSON.stringify(MOVED_NAMES) + ';' +
    ' return JSON.stringify({ fails: fails, absent: N.filter(function (n) { return !E[n]; }), onOld: N.filter(function (n) { return !!O[n]; }) }); })';
  let r = {};
  try { r = JSON.parse(await M.page.evaluate(load)); } catch (e) { r = { threw: String(e) }; }
  M.r = r;
  return (Array.isArray(r.fails) && !r.fails.length) || 'loading: ' + shortest(r.threw || r.fails);
}, test.limit.slow);
test.run('all the moved elements stand on spirit.element under their names', 0.2, function () {
  const r = M.r; if (!r) return 'no page: the world failed';
  return (Array.isArray(r.absent) && !r.absent.length) || 'not on spirit.element: ' + shortest(r.threw || r.absent);
}, test.limit.quick);
test.run('and none of them on spirit.elements', 0.2, function () {
  const r = M.r; if (!r) return 'no page: the world failed';
  return (Array.isArray(r.onOld) && !r.onOld.length) || 'still on spirit.elements: ' + shortest(r.onOld);
}, test.limit.quick);
// The element drawing from spirit/element/codeMirror/ is spirit/element/test/codeMirror.js; deskRunStatus staying on
// spirit.elements is judged in Desk's spirit/app/desk/element/deskRunStatus/test/deskRunStatus.js (goal/G43.30).

// ── THE FACE LOGIN PART ──
// THE RELAY LOGIN (goal/G43.18, box v29, "The relay login"; spec: ./spirit.md, its section). Andy's box: "The relay serves a logged-out
// face one plain page, the one-field form, with spirit.js and seal.js only, which make the sealed link home. boot.js,
// shell.css, face.css and every other part of the shell come from the home node over that link.", and "The login is
// spirit.login, in spirit.js, no app. It holds the relay's own calls, state, login and logout on /face/api, and draws the one
// field when logged out. shell/login/ and its login.json go." A real scratch node, a real relay, a real face and its login,
// and a real Chrome on the face at <name>.localhost, a secure context as a face over https is. A step that could not run is
// red, never skipped.
const { scratchFaceRelay } = H;
function short3(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
    q.on('error', function (e) { resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b || undefined);
  });
}
// A real join, the star pressed at home (box v29: a face only on a starred relay), a real face, a real login.
async function faceOf(N, R) {
  await homeCall(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  await homeCall(N.base, 'relay.join', { url: R.base, email: MAIL });
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return { why: 'the relay mailed no join code' };
  await homeCall(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  const star = await homeCall(N.base, 'contact.own', { key: R.relayKey, own: true });
  if (star.status !== 200) return { why: 'contact.own: ' + short3(star.text) };
  let f = null;
  for (let i = 0; i < 10; i++) { f = await homeCall(N.base, 'relay.face', { url: R.base, name: NAME }); if (f.status === 200) break; await sleep(2000); }
  if (!f || f.status !== 200) return { why: 'relay.face: ' + short3(f && f.text) };
  await until(function () { return atFace(R, 'POST', '/face/api', { call: 'state', args: {} }).then(function (s) { return s.status === 200; }); }, 15000);
  const from = R.mailed.length;
  await atFace(R, 'POST', '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const token = R.mailed[from] && String(R.mailed[from].text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await atFace(R, 'POST', '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the login: ' + short3(done.text) };
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
// the box: "shell/login/ and its login.json go"
const FL = {};
test.run('shell/login/ is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'login')) || 'shell/login/ is still there: ' + short3(fs.existsSync(path.join(RUN, 'shell', 'login')) ? fs.readdirSync(path.join(RUN, 'shell', 'login')) : []);
}, test.limit.quick);
test.run('the world: a real node has a real face on a starred relay, logged in', 0.2, async function () {
  // The pages of the parts above are let go first.
  if (M.page && M.page.kid) M.page.kid.kill();
  if (M.node && M.node.child) M.node.child.kill();
  FL.N = await H.scratchNode();
  FL.R = await scratchFaceRelay({ members: [], faceDomain: DOMAIN });
  if (!FL.N.up || !FL.R.up) return 'the scratch node or relay did not come up: nothing judged';
  const F = FL.F = await faceOf(FL.N, FL.R);
  return !!F.sid || 'nothing judged: ' + F.why;
}, test.limit.long);
const NO_FACE = 'no face logged in: the world failed';
function faceUp() { return !!FL.F && !!FL.F.sid; }
// the box: "The relay serves a logged-out face one plain page ... with spirit.js and seal.js only"
test.run('the relay serves the face its page', 0.2, async function () {
  if (!faceUp()) return NO_FACE;
  const pageGot = await atFace(FL.R, 'GET', '/');
  return (pageGot.status === 200 && /text\/html/.test(pageGot.type)) || 'GET /: ' + pageGot.status + ' ' + short3(pageGot.type);
}, test.limit.quick);
async function relayServes(p) {
  if (!faceUp()) return NO_FACE;
  const g = await atFace(FL.R, 'GET', p);
  return (g.status === 200 && g.text.length > 0) || 'GET ' + p + ': ' + g.status;
}
test.run('the relay serves /spirit.js', 0.2, function () { return relayServes('/spirit.js'); }, test.limit.quick);
test.run('the relay serves /shell/seal.js', 0.2, function () { return relayServes('/shell/seal.js'); }, test.limit.quick);
// "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link": logged out
// or in, the relay itself serves none of them.
async function relayKeeps(loggedIn, p) {
  if (!faceUp()) return NO_FACE;
  const g = await atFace(FL.R, 'GET', p, undefined, loggedIn ? FL.F.sid : '');
  return g.status !== 200 || (loggedIn ? 'logged in' : 'logged out') + ', the relay serves ' + p + ' itself: ' + g.status;
}
test.run('logged out, the relay does not serve /shell/boot.js', 0.2, function () { return relayKeeps(false, '/shell/boot.js'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell.css', 0.2, function () { return relayKeeps(false, '/shell.css'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell/face.css', 0.2, function () { return relayKeeps(false, '/shell/face.css'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell/login/login.js', 0.2, function () { return relayKeeps(false, '/shell/login/login.js'); }, test.limit.quick);
test.run('logged out, the relay does not serve /shell/login/login.json', 0.2, function () { return relayKeeps(false, '/shell/login/login.json'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/boot.js', 0.2, function () { return relayKeeps(true, '/shell/boot.js'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell.css', 0.2, function () { return relayKeeps(true, '/shell.css'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/face.css', 0.2, function () { return relayKeeps(true, '/shell/face.css'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/login/login.js', 0.2, function () { return relayKeeps(true, '/shell/login/login.js'); }, test.limit.quick);
test.run('logged in, the relay does not serve /shell/login/login.json', 0.2, function () { return relayKeeps(true, '/shell/login/login.json'); }, test.limit.quick);

// the box: "The login is spirit.login, in spirit.js, no app ... and draws the one field when logged out"
function faceUrl() { return 'http://' + NAME + '.' + DOMAIN + ':' + FL.R.port + '/'; }
test.run('spirit.login holds state, login and logout', 0.2, async function () {
  if (!faceUp()) return NO_FACE;
  const where = H.findChrome();
  if (!where) return 'no Chrome here: nothing judged';
  const chrome = FL.chrome = await H.chromePage(where);
  if (chrome.error) { FL.chrome = null; return 'Chrome: ' + chrome.error; }
  await chrome.send('Page.navigate', { url: faceUrl() });
  await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
  await sleep(3000);
  FL.out = parsed(await chrome.evaluate(SEEN)) || {};
  return FL.out.login === true || 'spirit.login: ' + short3(await chrome.evaluate('JSON.stringify(Object.keys((window.spirit && window.spirit.login) || {}))'));
}, test.limit.slow);
const NO_CHROME = 'no Chrome on the face: the world failed';
test.run('logged out, the page shows one field', 0.2, async function () {
  if (!FL.out) return NO_CHROME;
  return FL.out.fields === 1 || 'logged out, the page shows ' + FL.out.fields + ' fields: ' + short3(await FL.chrome.evaluate('document.body.innerText'));
}, test.limit.quick);
test.run('logged out, it loads nothing but spirit.js and seal.js', 0.2, function () {
  if (!FL.out) return NO_CHROME;
  const notThree = (FL.out.loaded || []).filter(function (n) { return !/^\/(spirit\.js|shell\/seal\.js|favicon\.ico|shell\/favicon\.svg)(\?|$)/.test(n) && !/^\/face\/api/.test(n); });
  return (Array.isArray(FL.out.loaded) && !notThree.length) || 'logged out, it loaded ' + short3(notThree);
}, test.limit.quick);

// logged in: the shell comes from the home node, over the link
test.run('the world: the browser holds the login', 0.2, async function () {
  if (!FL.out) return NO_CHROME;
  const set = await FL.chrome.send('Network.setCookie', { name: 'spirit_face', value: FL.F.sid, url: faceUrl(), path: '/' });
  FL.cookie = !!(set.result && set.result.success);
  return FL.cookie || 'the browser would not take the cookie: ' + short3(set);
}, test.limit.quick);
test.run('logged in, the face draws the home node\'s shell', 0.2, async function () {
  if (!FL.out) return NO_CHROME;
  const chrome = FL.chrome;
  await chrome.send('Page.navigate', { url: faceUrl() });
  FL.drew = await until(function () { return chrome.evaluate(SEEN).then(function (t) { const v = parsed(t) || {}; return v.shell === true; }); }, 30000);
  FL.inn = parsed(await chrome.evaluate(SEEN)) || {};
  return !!FL.drew || 'logged in, no shell drew: ' + short3(await chrome.evaluate('document.body.innerText'));
}, test.limit.long);
test.run('and none of boot.js, shell.css or face.css came as the relay\'s own file', 0.2, function () {
  if (!FL.inn) return NO_CHROME;
  const plainGets = (FL.inn.loaded || []).filter(function (n) { return /^\/shell\/(boot\.js|face\.css)|^\/shell\.css/.test(n); });
  return (!!FL.drew && !plainGets.length) || 'logged in, the page fetched from the relay: ' + short3(plainGets);
}, test.limit.quick);

// the box: spirit.login "holds ... logout"
test.run('logged out by spirit.login.logout, the page shows the one field again', 0.2, async function () {
  if (!FL.out) return NO_CHROME;
  const chrome = FL.chrome;
  await chrome.evaluate('Promise.resolve(window.spirit.login.logout()).then(function () { return true; }, function (e) { return String(e); })');
  await chrome.send('Page.navigate', { url: faceUrl() });
  await until(function () { return chrome.evaluate('!!window.spirit && document.readyState === "complete"'); }, 20000);
  await sleep(3000);
  const after = parsed(await chrome.evaluate(SEEN)) || {};
  FL.loggedOut = true;
  return (after.fields === 1 && after.shell === false) || 'after logout: ' + short3(after);
}, test.limit.slow);
test.run('and the relay holds the login no more', 0.8, async function () {
  if (!FL.loggedOut) return 'no logout: the world failed';
  const st = await atFace(FL.R, 'POST', '/face/api', { call: 'state', args: {} }, FL.F.sid);
  return (st.status === 200 && !/"loggedIn":\s*true/.test(st.text)) || 'after logout the relay says: ' + short3(st.text);
}, test.limit.quick);

// ── THE FAMILY FINDER PART ──
// HOW A FAMILY IS FOUND BY ITS NAME (goal/G43.27; spec: ./spirit.md, its section). Andy: "make sure there's a test for the module
// searching for api's that makes sure those rules are followed - less path elements get priority, - the target needs an
// api.js - and duplicate <name>/api.js raise a red.", and "spirit/app/contact/ does NOT have an api.js". The tree read as
// it is; the finding judged on a real page (headless Chrome) of a scratch node, folders planted into its copy that break
// each rule. Never a live node.
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
    if (e.name === 'node_modules' || e.name === 'state' || e.name === '.git' || e.name === 'test') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  });
  return out;
}

// familyFinder: a family found by its name: the fewest path elements, an api.js there, no name twice (goal/G43.27)
// the world
const FF = {};
test.run('the world: ten or more family names with an api.js in the tree, contact and relay among them', 0.2, function () {
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); }).map(function (f) { return f.slice('spirit/run/'.length); });
  const by = interfaces(RUN, files);
  return (Object.keys(by).length >= 10 && !!by.contact && !!by.relay) || 'only ' + shorter(Object.keys(by)) + ': nothing judged';
}, test.limit.quick);
test.run('the world: spirit/app/contact/ is an app folder with no api.js (Andy: "spirit/app/contact/ does NOT have an api.js")', 0.2, function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'contact', 'api.js'))) || 'spirit/app/contact/ is not as Andy said';
}, test.limit.quick);
// That no branch's name has a second api.js in the tree is judged on each branch folder, as are an app's family found
// where its api.js is and a page getting each branch's own data.js (./spirit-sibling-branchRules.js, goal/G43.32). Here,
// the finder itself, on folders planted to break each rule.

// A scratch node, then folders planted into its copy that break each rule.
test.run('the world: a scratch node is up, on its own copy of the tree', 0.2, async function () {
  // The face of the part above is let go first.
  try { if (FL.chrome && FL.chrome.kid) FL.chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (FL.R) FL.R.stop(); } catch (e) { /* gone */ }
  try { if (FL.N && FL.N.child) FL.N.child.kill(); } catch (e) { /* gone */ }
  const node = FF.node = await H.scratchNode();
  if (!(node.up && node.root)) return 'the scratch node did not come up: nothing judged';
  const sRun = FF.sRun = path.join(node.root, 'spirit', 'run');
  const plant = function (rel, text) { const f = path.join(sRun, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const MARK = function (where) { return '(window.__planted = window.__planted || []).push(' + JSON.stringify(where) + ');\n'; };
  // Rule 2: a folder of the name without api.js is never the target (spirit/app/contact/ has a data.js, no api.js).
  plant('spirit/app/contact/data.js', MARK('spirit/app/contact'));
  // Rule 1: the same name with an api.js one level deeper loses to spirit/relay/ (and is a duplicate, rule 3).
  plant('spirit/app/relay/api.js', 'module.exports = { verbs: {} };\n');
  plant('spirit/app/relay/data.js', MARK('spirit/app/relay'));
  return true;
}, test.limit.slow);
// 3. a duplicate is seen
test.run('the check sees the planted second relay/api.js (spirit/relay/ and spirit/app/relay/)', 0.2, function () {
  if (!FF.sRun) return 'no scratch copy: the world failed';
  const planted = interfaces(FF.sRun, walk(FF.sRun, FF.sRun, []));
  return (!!planted.relay && planted.relay.length === 2) || 'the check saw ' + shorter(planted.relay);
}, test.limit.quick);
// 1, 2. a page finds each family where the rules say
test.run('the world: the page asked contact and relay', 0.2, async function () {
  if (!FF.sRun) return 'no scratch node: the world failed';
  const node = FF.node;
  const page = FF.page = await H.chromePage(H.findChrome());
  let got = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    got = await page.evaluate("Promise.resolve(window.spirit.ready).then(function () { return Promise.all(['contact', 'relay'].map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); }).then(function (r) { return { said: r, planted: window.__planted || [] }; })");
  }
  FF.got = got;
  FF.asked = page && page.heard ? page.heard.filter(function (m) { return m.method === 'Network.responseReceived'; }).map(function (m) { return { url: m.params.response.url.replace(node.base, '').replace(/^\//, ''), status: m.params.response.status }; }) : [];
  FF.said = {}; ((got && got.said) || []).forEach(function (r) { FF.said[r[0]] = r[1]; });
  FF.ran = (got && got.planted) || [];
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();
  return !!got || 'the page asked nothing: ' + shorter(page && page.error);
}, test.limit.slow);
function fetched(p) { return (FF.asked || []).some(function (a) { return a.url === p && a.status === 200; }); }
test.run('2. contact is spirit/contact/: spirit/app/contact/ has no api.js, and its data.js never runs', 0.2, function () {
  if (!FF.got) return 'no page asked: the world failed';
  return (FF.said.contact === 'ok' && fetched('spirit/contact/data.js') && FF.ran.indexOf('spirit/app/contact') === -1) ||
    'contact: ' + shorter(FF.said.contact) + ', spirit/contact/data.js fetched ' + fetched('spirit/contact/data.js') + ', the planted spirit/app/contact/data.js ran ' + (FF.ran.indexOf('spirit/app/contact') !== -1);
}, test.limit.quick);
test.run('1. relay is spirit/relay/, the fewer path elements, over spirit/app/relay/', 0.2, function () {
  if (!FF.got) return 'no page asked: the world failed';
  return (FF.said.relay === 'ok' && fetched('spirit/relay/data.js') && FF.ran.indexOf('spirit/app/relay') === -1) ||
    'relay: ' + shorter(FF.said.relay) + ', spirit/relay/data.js fetched ' + fetched('spirit/relay/data.js') + ', spirit/app/relay/data.js ran ' + (FF.ran.indexOf('spirit/app/relay') !== -1);
}, test.limit.quick);
test.run('no data.js was asked that is not there (no 404)', 0.2, function () {
  if (!FF.got) return 'no page asked: the world failed';
  const missed = FF.asked.filter(function (a) { return /(^|\/)data\.js$/.test(a.url) && a.status === 404; });
  return !missed.length || missed.length + ' asked and missed: ' + shorter(missed);
}, test.limit.quick);

// goal/G43.20, its box: "a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js, a job is named by its
// route, and nothing falls back to process/js/<name>". In a process: the path spirit.familyPath gives is the family's own
// api.js, a system family's in spirit/<name>/, an app's in spirit/app/<name>/, and none names process/js.
// goal/G43.20: in a process, a family's path is its own api.js, and nothing falls back to process/js
let paths = null;
function familyPaths() {
  if (paths) return paths;
  paths = JSON.parse(require('child_process').spawnSync(process.execPath, ['-e',
    "require('./spirit/spirit.js'); console.log(JSON.stringify({ fs: spirit.familyPath('fs'), desk: spirit.familyPath('desk'), agent: spirit.familyPath('agent'), none: spirit.familyPath('zzNoSuchFamily') }));"],
    { cwd: RUN, encoding: 'utf8' }).stdout || '{}');
  return paths;
}
test.run('a system family\'s path is spirit/<name>/api.js: fs is spirit/fs/api.js', 0.2, function () {
  return familyPaths().fs === 'spirit/fs/api.js' || 'fs: ' + shorter(familyPaths().fs);
}, test.limit.quick);
test.run('an app\'s path is spirit/app/<name>/api.js: desk and agent', 0.2, function () {
  const p = familyPaths();
  return (p.desk === 'spirit/app/desk/api.js' && p.agent === 'spirit/app/agent/api.js') || 'desk: ' + shorter(p.desk) + ', agent: ' + shorter(p.agent);
}, test.limit.quick);
test.run('no path names process/js, a name of no family\'s included', 0.2, function () {
  const p = familyPaths();
  return (Object.keys(p).length === 4 && !/process\/js/.test(JSON.stringify(p))) || 'paths: ' + shorter(p);
}, test.limit.quick);

test.after(function () {
  if (T.node) T.node.close();
  for (const r of [T.root, T.bare]) { if (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* scratch */ } } }
  for (const x of [L, C, M, FF]) {
    if (x.page && x.page.kid) { try { x.page.kid.kill(); } catch (e) { /* gone */ } }
    if (x.node && x.node.child) { try { x.node.child.kill(); } catch (e) { /* gone */ } }
  }
  if (M.page && M.page.profile) { try { fs.rmSync(M.page.profile, { recursive: true, force: true }); } catch (e) { /* left */ } }
  if (M.node && M.node.root) { try { fs.rmSync(M.node.root, { recursive: true, force: true }); } catch (e) { /* left */ } }
  try { if (FL.chrome && FL.chrome.kid) FL.chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (FL.R) FL.R.stop(); } catch (e) { /* gone */ }
  try { if (FL.N && FL.N.child) FL.N.child.kill(); } catch (e) { /* gone */ }
  try { if (FL.N && FL.N.root) fs.rmSync(FL.N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
