'use strict';

// spirit/run/spirit/test/spirit.js
// THE RED OF spirit/run/spirit/spirit.js (goal/G40.6; the module moved from the run root, goal/G43.18, and its test with it,
// goal/G43.27), and of no other module. It asserts ./spirit.md, section by section: the
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
// It also serves the node's events family: events.subscribe is a stream, as the real node's (a snapshot and then a job
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
      if (b.call === 'events.subscribe') {
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
      if (b.call === 'events.publish') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); return; }
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
    // This process's job, published by events.publish with its own id, the one path.
    out.publish = s.events.publish({ x: 1 });
    out.tooBig = s.events.publish({ big: 'y'.repeat(30000) });
    out.noJobsPublish = !('publish' in s.jobs);
    // The node's events, subscribed: the snapshot, then an update; unsubscribed, nothing more.
    out.heard = await new Promise(function (r) {
      const heard = [];
      const off = s.events.subscribe({
        onConnection: function (up) { heard.push('up:' + up); },
        onSnapshot: function (jobs) { heard.push('snapshot:' + jobs.map(function (j) { return j.id; }).join(',')); },
        onUpdate: function (job) { heard.push('update:' + job.id + ':' + job.status); off(); r(heard); },
      });
      setTimeout(function () { r(heard); }, 2000);
    });
    await s.jobs.start('j1');
    out.startAgain = await code(s.jobs.start('j2'));
    await s.jobs.progress(1, 2, 'half');
    await s.jobs.end({ done: true });
    await new Promise(function (r) { setTimeout(r, 100); });
    // The peer's answer, through the node's event stream.
    out.peerAnswer = await s.peerPost('peerKey9', 'api', { demo: { hello: { name: 'p' } } }, { waitMs: 3000 });
    let asks = 0;
    s.peerPost = function (peer, app, body, how) {
      if (body && body.api) asks++;
      out.peerHow = how && how.waitMs;
      return new Promise(function (r) { setTimeout(function () { r(body && body.api ? { interface: '${DEMO.replace(/'/g, "\\'")}' } : { said: 'hello from ' + peer }); }, 20); });
    };
    const both = await Promise.all([s.require(s.familyPath('demo'), 'peerKey1', { waitMs: 777 }), s.require(s.familyPath('demo'), 'peerKey1', { waitMs: 777 })]);
    out.peer = [both[0] === both[1], asks, (await both[0].hello({ name: 'x' })).said, s.demo !== both[0]];
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

test.startTest('spirit/run/spirit.js: the one spirit object, in node and on a page');

(async function () {
  // ── 1. WHERE IT RUNS, THE ONE INSTANCE, THE GLOBAL FIRST ─────────────
  test.subHeading('1. spirit.js alone tells node from a page; one instance, the global first');
  const s = require(path.join(RUN, 'spirit', 'spirit.js'));
  if (s.isNode() === true && s.isBrowser() === false) test.check('in node: isNode() true, isBrowser() false');
  else test.fail('in node: isNode() ' + s.isNode() + ', isBrowser() ' + s.isBrowser());
  if (globalThis.spirit === s && require(path.join(RUN, 'spirit', 'spirit.js')) === s) test.check('in node: require answers the one instance, the global spirit, every time');
  else test.fail('in node: the global and what require answered differ');
  const kept = spawnSync(process.execPath, ['-e', 'globalThis.spirit = { mark: 1 }; const s = require(process.argv[1]); console.log(String(s === globalThis.spirit && s.mark === 1 && typeof s.require === "function"));', path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8' });
  if (String(kept.stdout).trim() === 'true') test.check('a global spirit already there is the one it fills, not replaced');
  else test.fail('a global spirit already there was replaced or not filled: ' + short(kept.stdout + kept.stderr));
  const w = page();
  if (w.spirit && w.spirit.isBrowser() === true && w.spirit.isNode() === false) test.check('on a page: window.spirit at once, isBrowser() true, isNode() false');
  else test.fail('on a page: ' + short(w.spirit && { isBrowser: w.spirit.isBrowser && w.spirit.isBrowser(), isNode: w.spirit.isNode && w.spirit.isNode() }));
  const code = SOURCE.replace(/\/\/[^\n]*/g, function (c) { return ' '.repeat(c.length); });
  const sets = code.search(/\broot\.spirit\s*=/);
  const firstRequire = code.search(/\brequire\(/);
  if (sets !== -1 && sets < firstRequire) test.check('the source sets the global before its first require');
  else test.fail('the global is set at ' + sets + ', the first require at ' + firstRequire);
  if (!/typeof (window|module|process|require|TextDecoder|Buffer)/.test(code.replace(/function isNode\(\)[^\n]*\n|function isBrowser\(\)[^\n]*\n/g, '')))
    test.check('nothing in spirit.js but isNode() and isBrowser() asks where it runs');
  else test.fail('spirit.js asks where it runs outside isNode() and isBrowser()');
  // data: the cache, spirit.data (goal/G41.3); familyPath: the one family path function (goal/G41.12); cacheManager: a
  // family's data.js, found by the folder shape and loaded (goal/G43.27) (goal/G41.28, Andy: "the shell can introspect to find and
  // download their clientCacheManagers").
  const MEMBERS = ['DEFAULT_SPIRIT_PORT', 'MIME_TYPES', 'VERSION', 'cacheManager', 'check', 'data', 'debug', 'error', 'escapeHtml', 'events', 'familyPath', 'formatBytes', 'isBrowser', 'isLoopback', 'isNode', 'jobs', 'node', 'outcome', 'peerPost', 'require', 'rules', 'tree'];
  if (JSON.stringify(Object.keys(s).filter(function (k) { return typeof s[k] !== 'object' || ['MIME_TYPES', 'data', 'events', 'jobs', 'node'].indexOf(k) !== -1 || Array.isArray(s[k]); }).sort()) === JSON.stringify(MEMBERS))
    test.check('in node the instance holds exactly its members: ' + MEMBERS.join(', ') + ' (and the families it binds)');
  else test.fail('in node the instance holds ' + short(Object.keys(s).sort()));
  const factories = ['createSpirit', 'assemble', 'forNode', 'forPeer', 'nodeTransport', 'pageTransport', 'peerTransport', 'loadInterface', 'spiritObject', 'call', 'port'];
  const left = factories.filter(function (k) { return k in s || k in w.spirit; });
  if (!left.length) test.check('no factory, no transport and no second object handed out, in node or on a page');
  else test.fail('still handed out: ' + left.join(', '));

  // THE NODE IN TWO PLACES, THE RELAY'S FACE ROUTES IN THREE (goal/G43.18, Q22: the link home moved into spirit.js; box v29: the
  // login is spirit.login): post and get to the node; the login's /face/api, and the link's /face/call, whole and piece by piece.
  const fetches = (code.match(/\bfetch\(/g) || []).length;
  const toFace = (code.match(/\bfetch\('\/face\/(api|call)'/g) || []).length;
  if (fetches === 5 && toFace === 3 && /function post\(verb, args(, how)?\)/.test(code) && /function get\(path\)/.test(code))
    test.check('one post and one get reach the node, post(verb, args) and get(path); the other three are the relay\'s face routes, the login and the link');
  else test.fail('spirit.js reaches the network in ' + fetches + ' places, ' + toFace + ' of them the face routes, or has no post(verb, args) and get(path)');

  // ── 2. IN NODE: spirit.js's OWN ──────────────────────────────────────
  test.subHeading('2. in node: the node\'s facts, the job and the tables are spirit.js\'s own');
  const mime = s.MIME_TYPES;
  if (!('core' in s) && mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json']))
    test.check('spirit.js hands out no spirit.core; spirit.MIME_TYPES is its own table');
  else test.fail('spirit.js still holds spirit.core, or no MIME table of its own: ' + short(Object.keys(s)));
  if (s.VERSION === '0.0.1' && s.DEFAULT_SPIRIT_PORT === 65432) test.check('spirit.VERSION is ' + s.VERSION + ' and spirit.DEFAULT_SPIRIT_PORT ' + s.DEFAULT_SPIRIT_PORT);
  else test.fail('the version and the default port: ' + short([s.VERSION, s.DEFAULT_SPIRIT_PORT]));
  const dbg = [s.debug(), s.debug(true), s.debug(), s.debug('yes'), s.debug(false), s.debug()];
  if (JSON.stringify(dbg) === JSON.stringify([false, true, true, true, false, false])) test.check('spirit.debug: off at start, set by a boolean and answering the state, anything else only reads it');
  else test.fail('spirit.debug answered ' + short(dbg));

  // ── 3. THE HELPERS ───────────────────────────────────────────────────
  test.subHeading('3. the helpers, in node and on a page alike');
  for (const [where, o] of [['node', s], ['page', w.spirit]]) {
    const e = o.error('boom');
    if (e && e.error && e.error.string === 'boom' && o.formatBytes(0) === '0 Bytes' && o.formatBytes(1024) === '1 KB' && o.formatBytes(1536) === '1.5 KB' && o.escapeHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;')
      test.check(where + ': error, formatBytes and escapeHtml answer as specified');
    else test.fail(where + ': helpers answered ' + short([e, o.formatBytes(0), o.formatBytes(1024), o.escapeHtml('&<>"\'')]));
  }

  // ── 4. THE CHECK ─────────────────────────────────────────────────────
  test.subHeading('4. check: every argument against its verb\'s declaration, every rule');
  const KEY = 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
  const rules = { text: ['a', 1], id: ['a', ''], flag: ['yes', 'no'], number: [1, Infinity], bool: [true, 'true'], object: [{}, []], list: [[], {}],
    key: [KEY, 'abc'], url: ['https://a.b', 'ftp://a.b'], path: ['a/b.js', '../a'], name: ['bert', 7], description: ['a line', 7], paragraph: ['a paragraph', 7] };
  if (JSON.stringify(s.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort()) && JSON.stringify(w.spirit.rules.slice().sort()) === JSON.stringify(Object.keys(rules).sort()))
    test.check('spirit.rules names exactly ' + Object.keys(rules).sort().join(', ') + ', in node and on a page');
  else test.fail('spirit.rules: ' + short(s.rules));
  const wrongRules = Object.keys(rules).filter(function (r) {
    const spec = { v: r };
    return s.check('t', spec, { v: rules[r][0] }) !== null || !s.check('t', spec, { v: rules[r][1] }) || s.check('t', spec, { v: rules[r][1] }).code !== 'bad-request';
  });
  if (!wrongRules.length) test.check('each rule passes a good value and refuses a bad one bad-request');
  else test.fail('rules that judged wrong: ' + wrongRules.join(', '));
  const c1 = s.check('t', { a: 'text' }, { b: 'x' });
  const c2 = s.check('t', { a: 'text' }, {});
  const c3 = s.check('t', { a: 'text?' }, {});
  const c4 = s.check('t', { a: 'text' }, 'x');
  const c5 = s.check('t', { a: 'nosuchrule' }, { a: 'x' });
  if (c1 && c1.code === 'no-such-argument' && c1.argument === 'b' && c2 && c2.code === 'bad-request' && c3 === null && c4 && c4.code === 'bad-request' && c5 && c5.code === 'bad-request')
    test.check('an argument it does not name is no-such-argument; a missing one bad-request; one marked ? may be missing; arguments not an object, or a rule that does not exist, bad-request');
  else test.fail('check answered ' + short([c1 && c1.code, c2 && c2.code, c3, c4 && c4.code, c5 && c5.code]));

  // ── 5. IN NODE: ITS NODE, ITS FAMILIES, ITS PEERS ────────────────────
  test.subHeading('5. in node: its node is 127.0.0.1 at the port of its run root\'s environment.json; it binds families on itself');
  const node = await fakeNode();
  const root = scratchRoot(node.port);
  const bare = scratchRoot(0);
  try {
    const o = await observe(root);
    if (o.threw) test.fail('the instance in node threw: ' + short(o.threw));
    else {
      if (o.same) test.check('the scratch run root\'s instance is its process\'s one global');
      else test.fail('the scratch instance is not its process\'s global');
      if (o.two && o.two[0] === 'hello bert' && o.two[1] === 'hello carl' && o.bound && node.asked.filter(function (b) { return b.call === 'api' && b.args && b.args.family === 'demo'; }).length === 1)
        test.check('spirit.require of the demo interface binds it on the one instance as spirit.demo, from 127.0.0.1:<its port>, asked once by two callers at once');
      else test.fail('binding demo: ' + short([o.two, o.bound, node.asked.filter(function (b) { return b.call === 'api'; }).length]));
      // goal/G43.32, decided 8: "spirit.require of a branch's api.js places the api.js at spirit.required.spirit.<branch-path>.api and binds its verbs on spirit.<branch>.<verb>".
      if (o.bound && o.apiPlaced) test.check('in node: the api.js required also stands at spirit.required.spirit.demo.api, the verbs bound on spirit.demo');
      else test.fail('in node: spirit/demo/api.js, required, ' + (o.bound ? 'binds spirit.demo but stands nowhere at spirit.required.spirit.demo.api' : 'did not bind spirit.demo'));
      if (o.hi === 'hello dave' && o.dotted === 't' && o.fs === true) test.check('a bound family has its own names, a dotted verb in camel case too (line.write as lineWrite), and no FS set (goal/G43.20)');
      else test.fail('the bound family: ' + short([o.hi, o.dotted, o.fs]));
      const askedBefore = node.asked.length;
      if (o.noArg === 'no-such-argument' && o.noVerb === true && o.noFamily === 'no-interface') test.check('an argument the verb does not name is refused before it leaves; a verb the family lacks is not on it; a family with no interface refuses no-interface');
      else test.fail('refusals: ' + short([o.noArg, o.noVerb, o.noFamily, askedBefore]));
      if (o.held && o.held[0] === 'held' && o.held[1] === 'held by bert' && o.held[2] === 409 && o.slow && o.slow[0] === 504 && o.slow[1] === 'the app server did not answer')
        test.check('the node\'s refusal keeps its code, its words and its status; a plain-text answer keeps its text');
      else test.fail('the node\'s refusals: ' + short([o.held, o.slow]));
      if (JSON.stringify(o.tree) === JSON.stringify(['demo', 'gone'])) test.check('spirit.tree() answers its node\'s api as it stands');
      else test.fail('spirit.tree(): ' + short(o.tree));
      if (o.viaRequire) test.check('spirit.require(spirit.familyPath(\'demo\')) answers the same member, spirit.demo');
      else test.fail('spirit.require of an interface did not answer spirit.demo');
      const oc = o.outcome || [];
      if (oc[0] && oc[0][0] === 200 && oc[0][1] === 'hello eve' && oc[1][0] === 400 && oc[1][1] === 'no-such-argument' && oc[2][0] === 409 && oc[3][0] === 0)
        test.check('spirit.outcome: 200 and the body; 400 for a call the check refused; the node\'s own status; 0 when nothing answered');
      else test.fail('spirit.outcome: ' + short(oc));
      const f = o.facts || {};
      if (f.port === node.port && f.name === 'nodey' && f.key === 'K1' && f.ownerKey === 'O1') test.check('spirit.node: its port from environment.json, and the name, key and owner the node handed it as --node');
      else test.fail('spirit.node: ' + short(f));
      const updates = node.asked.filter(function (b) { return b.call === 'events.publish'; }).map(function (b) { return b.args; });
      const states = updates.map(function (u) { return u.app && u.app.job && u.app.job.state; }).filter(Boolean);
      const dropped = updates.filter(function (u) { return u.app && u.app.dropped; });
      if (o.publish === true && o.tooBig === false && updates.length && updates.every(function (u) { return u.id === 'job_7'; }) && updates.some(function (u) { return u.app && u.app.x === 1; })
          && dropped.length === 1 && dropped[0].app.dropped.max > 0 && JSON.stringify(states) === JSON.stringify(['start', 'progress', 'end']) && o.startAgain === 'job-open'
          && o.noJobsPublish === true && !node.asked.some(function (b) { return b.call === 'jobs.update'; }))
        test.check('spirit.events.publish and spirit.jobs start, progress and end publish by events.publish with the job\'s own id, the one path (no jobs.update, no spirit.jobs.publish); one over the payload cap is said as dropped; a second start while one is open refuses job-open');
      else test.fail('publishing: ' + short([o.publish, o.tooBig, updates.length, states, dropped.length, o.startAgain, o.noJobsPublish]));
      if (JSON.stringify(o.heard) === JSON.stringify(['up:true', 'snapshot:j1', 'update:j1:done']))
        test.check('spirit.events.subscribe: the node\'s events family as a stream, said up, then the snapshot, then each update, until unsubscribed');
      else test.fail('spirit.events.subscribe heard ' + short(o.heard));
      // goal/G43.3: a process that followed the stream as a page would take its node's owner's waiting lines.
      const subscribes = node.asked.filter(function (b) { return b.call === 'events.subscribe'; });
      if (subscribes.length && subscribes.every(function (b) { return b.reader === 'server'; })) test.check('in a process, every events.subscribe says it is a server, so it takes no packets');
      else test.fail('in a process, events.subscribe said: ' + short(subscribes.map(function (b) { return b.reader; })));
      const viaStream = node.streams.some(function (st) { return st.reader === 'server'; });
      if (o.peerAnswer && o.peerAnswer.said === 'answered by peerKey9' && viaStream && node.asked.some(function (b) { return b.call === 'peer.post' && b.args && b.args.to === 'peerKey9'; }))
        test.check('spirit.peerPost: one post of peer.post, the answer read off the node\'s events (events.subscribe) as a server, as it always worked');
      else test.fail('spirit.peerPost: ' + short([o.peerAnswer, viaStream]));
      if (o.peer && o.peer[0] === true && o.peer[1] === 1 && o.peer[2] === 'hello from peerKey1' && o.peer[3] === true && o.peerHow === 777)
        test.check('spirit.require(path, key, how): the peer\'s family through spirit.peerPost with how, two callers at once ask once, and it is not its own node\'s spirit.demo');
      else test.fail('a peer\'s family: ' + short([o.peer, o.peerHow]));
    }
    const n = await observe(bare, 'none');
    if (n.require === 'no-node' && n.tree === 'no-node' && n.noPort === true) test.check('with no port in its environment.json: require of an interface and tree refuse no-node; no default port is guessed, and none is placed on the instance');
    else test.fail('with no port: ' + short(n));
  } finally {
    node.close();
    for (const r of [root, bare]) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  }

  // ── 6. ON A PAGE: ITS NODE IS THE PAGE'S ORIGIN ──────────────────────
  test.subHeading('6. on a page: its node is the page\'s own origin, or the link set on it');
  const wq = page();
  const started = wq.spirit.start();
  const again = wq.spirit.start();
  const ps = await started;
  // NO API CALL AT LOAD (goal/G43.27, Q1; Andy: "shouldn't it work without making a call, since the elements will trigger the
  // necessary calls?", "Q1: clear"): start asks no api, whole or of a family. Any family named on what spirit.ready answers
  // stands there and binds when first called; one with no interface is refused no-interface when called.
  // The one family start calls is node, for node.card (goal/G41.28, Q10: "yes."): its api is asked as it is called. Never the
  // whole api, and no other family's.
  const askedAtStart = wq.fetched.filter(function (f) {
    const b = f.url === '/api/spirit' ? JSON.parse(f.body) : null;
    return !!b && b.call === 'api' && !(b.args && b.args.family === 'node');
  });
  const goneSaid = await Promise.resolve(ps.gone && typeof ps.gone.anything === 'function' ? ps.gone.anything({}) : 'no stand-in')
    .then(function (v) { return 'answered ' + short(v); }, function (e) { return (e && e.code) || 'refused'; });
  if (started === again && wq.spirit.ready === started && !askedAtStart.length && ps.isBrowser === wq.spirit.isBrowser && !!ps.demo && goneSaid === 'no-interface')
    test.check('spirit.start() asks no api: spirit.ready answers the instance, any family named on it stands there and binds when first called; a call to one with no interface is refused no-interface');
  else test.fail('spirit.start: ' + short([started === again, wq.spirit.ready === started, askedAtStart.length + ' api asks at start', ps.isBrowser === wq.spirit.isBrowser, !!ps.demo, goneSaid]));
  const pc = await ps.demo.hello({ name: 'hal' });
  const toDoor = wq.fetched.filter(function (f) { return f.url === '/api/spirit'; });
  if (pc.said === 'hello hal' && toDoor.length && isCall(JSON.parse(toDoor[toDoor.length - 1].body)) && JSON.parse(toDoor[toDoor.length - 1].body).call === 'demo.hello') test.check('on a page with no link: calls go to the page\'s own origin, /api/spirit, as { call, args } (goal/G41.15)');
  else test.fail('on a page: ' + short([pc, toDoor.length]));
  const linked = [];
  wq.spirit.transport = { ask: function (v) { linked.push(v); return { status: 200, body: { said: 'via link' } }; }, file: function (p) { linked.push('file ' + p); return { status: 200, bytes: new Uint8Array(fs.readFileSync(path.join(RUN, p))) }; } };
  const before = wq.fetched.length;
  const viaLink = await wq.spirit.demo.hello({ name: 'x' });
  if (viaLink.said === 'via link' && linked[0] === 'demo.hello' && wq.fetched.length === before) test.check('on a page with window.spirit.transport set: every call goes through that link, nothing fetched');
  else test.fail('with a link: ' + short([viaLink, linked, wq.fetched.length - before]));
  // A face's events come down its link: spirit.events.subscribe hands the handlers to the link's events, fetching nothing.
  const handed = [];
  wq.spirit.transport.events = function (h) { handed.push(h); return function () { handed.push('off'); }; };
  const mine = { onUpdate: function () {} };
  const offLink = wq.spirit.events.subscribe(mine);
  offLink();
  if (handed[0] === mine && handed[1] === 'off' && wq.fetched.length === before) test.check('on a face: spirit.events.subscribe hands its handlers to the link\'s events, and its unsubscribe is the link\'s; nothing fetched');
  else test.fail('spirit.events.subscribe on a face: ' + short([handed.length, wq.fetched.length - before]));
  delete wq.spirit.transport;
  if (wq.spirit === wq.window.spirit && !('call' in wq.spirit)) test.check('on a page the one instance is window.spirit, and nothing else is made');
  else test.fail('on a page: ' + short(Object.keys(wq.spirit)));

  // ── 6a. LOOPBACK OR NOT ──────────────────────────────────────────────
  test.subHeading('6a. in a browser, loopback or not: its home node, or a face through a relay');
  const at = function (host) {
    const w2 = { location: { hostname: host }, TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL };
    w2.window = w2;
    vm.runInContext(SOURCE, vm.createContext(w2), { filename: 'spirit.js' });
    return w2.spirit.isLoopback();
  };
  const hosts = { '127.0.0.1': true, 'localhost': true, '[::1]': true, 'bert.spirit.example': false, '10.0.0.5': false };
  const wrongHosts = Object.keys(hosts).filter(function (h) { return at(h) !== hosts[h]; });
  if (!wrongHosts.length && s.isLoopback() === false) test.check('isLoopback(): true on 127.0.0.1, localhost and [::1], false on any other host, and false in node');
  else test.fail('isLoopback judged wrong: ' + short(wrongHosts));

  // ── 6b. ON A FACE, spirit.js LOADS THE FACE ──────────────────────────
  test.subHeading('6b. on a face: face.html holds spirit.js alone, and spirit.js loads the face shell');
  const faceHtml = fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'), 'utf8');
  // goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": one tag, /spirit.js, and nothing pasted in by a server.
  const faceScripts = faceHtml.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b[^>]*>[\s\S]*?<\/script>/g) || [];
  if (/<html[^>]*data-spirit="face"/.test(faceHtml) && faceScripts.length === 1 && /^<script src="\/spirit\.js"><\/script>$/.test(faceScripts[0]))
    test.check('face.html says it is a face (data-spirit="face") and loads spirit.js by one script tag, and no other script');
  else test.fail('face.html\'s scripts: ' + short(faceScripts) + ', or it does not say it is a face');
  const served = await new Promise(function (resolve) {
    const chunks = [];
    const res = { writeHead: function () {}, setHeader: function () {}, end: function (b) { if (b) chunks.push(Buffer.from(b)); resolve(Buffer.concat(chunks)); } };
    try { require(path.join(RUN, 'spirit', 'serveCommon.js')).sendFile(res, path.join(RUN, 'spirit', 'shell', 'face.html')); } catch (e) { resolve(Buffer.from('threw ' + e.message)); }
  });
  if (served.equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html')))) test.check('the node serves face.html byte for byte as it is on disk');
  else test.fail('the node serves face.html changed: ' + served.length + ' bytes against ' + fs.statSync(path.join(RUN, 'spirit', 'shell', 'face.html')).size + ' on disk');
  const serverSrc = fs.readFileSync(path.join(RUN, 'spirit', 'serveCommon.js'), 'utf8') + fs.readFileSync(path.join(RUN, 'spirit', 'relayServer.js'), 'utf8');
  if (!/inlineSpirit/.test(serverSrc)) test.check('no server pastes spirit.js into a page: serveCommon.inlineSpirit is gone, from the node and the relay');
  else test.fail('inlineSpirit is still in serveCommon.js or relayServer.js');
  const injected = [];
  const faceWindow = {
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
  if (booted === true && shellSrc && seal && injected.length === 1 && injected[0].indexOf(shellSrc) === 0 && injected[0].indexOf(seal) === -1 && SOURCE.indexOf("requireOne('shell/seal.js')") !== -1)
    test.check('on the home node\'s page spirit.js gets shell/boot.js alone and runs it, spirit.booted answering; the seal waits for a face\'s link, which requires it');
  else test.fail('the face boot: ' + short([booted, injected.length, shellSrc ? 'shell/boot.js there' : 'no shell/boot.js', seal ? 'shell/seal.js there' : 'no shell/seal.js']));

  // ── 7. THE ONE LOADER, THE SAME IN NODE AND ON A PAGE ────────────────
  test.subHeading('7. spirit.require(path, key): the one loader, the same in node and on a page');
  const inNode = await s.require(COMPONENT);
  if (inNode === require(path.join(RUN, COMPONENT))) test.check('in node: a component by its run-root path answers its module.exports');
  else test.fail('in node, ' + COMPONENT + ' answered ' + short(inNode));
  const missing = await refusedWith(s.require('spirit/noSuchComponent.js'));
  if (missing && missing !== 'answered') test.check('in node: a component that is not there refuses (' + missing + ')');
  else test.fail('in node: a missing component answered');
  // ON A PAGE A FILE RUNS AS A PLAIN SCRIPT (goal/G41.7; Andy: "script IS what codeMirror Is, use the require interfaces
  // that exists in spirit.js or boot.js, NOTHING HAND-ROLLED"): no module box, so a file written for both takes its page
  // branch and puts itself on the page, as every shell element does; a stylesheet is put on as a style.
  const onPage = await wq.spirit.require(PAGE_COMPONENT);
  if (onPage && Object.keys(onPage).length === 0 && wq.spirit.fieldRules && typeof wq.spirit.fieldRules.problem === 'function' && !wq.scriptError)
    test.check('on a page: ' + PAGE_COMPONENT + ' runs as a plain script, puts itself on window.spirit, and the require answers an empty object');
  else test.fail('on a page, ' + PAGE_COMPONENT + ' answered ' + short(onPage) + ', fieldRules ' + short(!!wq.spirit.fieldRules) + ', error ' + short(wq.scriptError && wq.scriptError.message));
  // A CodeMirror mode file, written for both node and a page: given no module box it finds CodeMirror on the page (here
  // a stand-in, the library itself needs a real browser) and defines its mode on it.
  const boxed = page();
  const defined = [];
  boxed.CodeMirror = { defineMode: function (name) { defined.push(name); }, defineMIME: function () {}, registerHelper: function () {}, resolveMode: function () { return {}; } };
  await boxed.spirit.require('spirit/element/codeMirror/mode/css/css.js');
  if (defined.indexOf('css') !== -1 && !boxed.scriptError)
    test.check('on a page: a CodeMirror mode file, required, runs as the page script it is, finds CodeMirror and defines its mode');
  else test.fail('on a page a CodeMirror mode file did not run as a script: ' + short([defined, boxed.scriptError && boxed.scriptError.message]));
  const sheet = await wq.spirit.require('spirit/element/codeMirror/lib/codemirror.css');
  if (sheet && wq.styles.length === 1 && /\.CodeMirror/.test(wq.styles[0]))
    test.check('on a page: a stylesheet required is put on the page as a style');
  else test.fail('on a page a stylesheet was not put on as a style: ' + wq.styles.length + ' styles');
  if (await refusedWith(wq.spirit.require('spirit/noSuchComponent.js')) === 'not-found') test.check('on a page: a component that is not there refuses not-found');
  else test.fail('on a page: a missing component did not refuse not-found');
  const pf = await wq.spirit.require(wq.spirit.familyPath('demo'));
  if (pf === wq.spirit.demo) test.check('on a page: an interface answers its member on window.spirit');
  else test.fail('on a page: an interface answered another member');
  const pp = await wq.spirit.require(wq.spirit.familyPath('demo'), 'peerKey2');
  const ppa = await pp.hello({ name: 'x' });
  if (wq.fetched.some(function (f) { return f.url === '/api/spirit' && JSON.parse(f.body).call === 'peer.post'; }) && ppa.said === 'hello page peer' && pp !== wq.spirit.demo)
    test.check('on a page: with a key, the peer\'s family through the home node\'s peer.post, not its own node\'s');
  else test.fail('on a page: a peer\'s family answered ' + short(ppa));

  // ── 7a. spirit.require DE-DUPES, AS NODE'S require DOES (goal/G41.3) ──
  // Andy: "spirit.js require() require implementation MUST, like a node.js require, de-dupe the require, it a script was
  // already loaded". A path required twice is fetched and run once, every caller getting the same answer; a script the
  // boot already loaded counts as required.
  test.subHeading('7a. spirit.require de-dupes: a path is fetched and run once, a script the boot loaded counts as required');
  const fetchesOf = function (w, p) { return w.fetched.filter(function (f) { return String(f.url).replace(/^\/+/, '') === p; }).length; };
  const dq = page();
  const twice = await Promise.all([dq.spirit.require(PAGE_COMPONENT), dq.spirit.require(PAGE_COMPONENT)]);
  const third = await dq.spirit.require(PAGE_COMPONENT);
  if (fetchesOf(dq, PAGE_COMPONENT) === 1 && twice[0] === twice[1] && twice[1] === third && twice[0])
    test.check('on a page: ' + PAGE_COMPONENT + ' required three times, two at once, is fetched once, and every caller gets the same answer');
  else test.fail('on a page the require is not de-duped: ' + fetchesOf(dq, PAGE_COMPONENT) + ' fetches, same answer ' + (twice[0] === twice[1] && twice[1] === third));
  let bootAgain = null;
  const beforeBoot = injected.length;
  try { bootAgain = await faceWindow.spirit.require('shell/boot.js'); } catch (e) { bootAgain = e; }
  const refusedAgain = !bootAgain || bootAgain instanceof Error || (typeof bootAgain === 'object' && (bootAgain.code || bootAgain.ok === false));
  if (injected.length === beforeBoot && !refusedAgain) test.check('on a face: requiring shell/boot.js after the boot loaded it runs nothing again, and answers');
  else test.fail('on a face: shell/boot.js, already booted, was run again or refused: ' + short([injected.length - beforeBoot, bootAgain && bootAgain.code]));

  // ── 7c. spirit.required, AND THE NODE ANSWERS AT ONCE (goal/G43.32) ──
  // Andy: "spirit.require() both on the node, AND on the browser should simply install every script required, at the
  // following point: spirit.required.<path.of.fucking.script>. - no name collisions - easily checkable if script is
  // already loaded.", and "box that spirit.require() on the node is just a path-translating wrapper": on the node it
  // answers the module at once, as require does; an interface is still bound by asking a node.
  test.subHeading('7c. spirit.required.<path>, and on the node spirit.require answers the module at once');
  const placeOf = function (sp, p) { return String(p).replace(/\.js$/, '').split('/').reduce(function (o, k) { return o == null ? undefined : o[k]; }, sp && sp.required); };
  const atOnce = s.require(COMPONENT);
  const real = require(path.join(RUN, COMPONENT));
  if (atOnce === real) test.check('on the node: spirit.require(' + COMPONENT + ') answers its module.exports at once, not a promise');
  else test.fail('on the node spirit.require(' + COMPONENT + ') answered ' + (atOnce && typeof atOnce.then === 'function' ? 'a promise' : short(atOnce)) + ', not the module at once');
  if (s.require(COMPONENT) === real) test.check('on the node: asked again, the same module at once');
  else test.fail('on the node, asked again, spirit.require did not answer the same module at once');
  if (placeOf(s, COMPONENT) === real) test.check('on the node: it stands at spirit.required.' + COMPONENT.replace(/\.js$/, '').split('/').join('.'));
  else test.fail('on the node nothing stands at spirit.required.' + COMPONENT.replace(/\.js$/, '').split('/').join('.') + ': ' + short(s.required === undefined ? 'no spirit.required' : placeOf(s, COMPONENT)));
  const iface = s.require(s.familyPath('demo'));
  if (iface && typeof iface.then === 'function') { test.check('on the node: an interface is still bound by asking a node, a promise'); iface.then(null, function () {}); }
  else test.fail('on the node an interface answered at once: ' + short(iface));
  const rq = page();
  await rq.spirit.require(PAGE_COMPONENT);
  if (placeOf(rq.spirit, PAGE_COMPONENT)) test.check('on a page: once ' + PAGE_COMPONENT + ' is required it stands at spirit.required.' + PAGE_COMPONENT.replace(/\.js$/, '').split('/').join('.'));
  else test.fail('on a page nothing stands at spirit.required.' + PAGE_COMPONENT.replace(/\.js$/, '').split('/').join('.') + ' once it is required');
  if (rq.spirit.required && typeof rq.spirit.required === 'object' && !placeOf(rq.spirit, 'spirit/noSuchComponent.js')) test.check('on a page: a script never required has no place in spirit.required');
  else test.fail('on a page ' + (rq.spirit.required ? 'spirit.required holds a script never required' : 'there is no spirit.required to look in'));

  // ── 7b. spirit.js LOADS THE CACHE ITSELF (goal/G41.3, Q2) ──────────────
  // Andy: spirit.js "on start of this client functionality ... AUTOMATICALLY caches ALL streamed datasets", "yes." The
  // cache is spirit/data.js (spirit.data); spirit.js loads it when its client part starts, page and process alike.
  test.subHeading('7b. spirit.js loads the cache itself, on a page and in a process');
  const isCache = function (d) { return !!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'; };
  const cq = page();
  try { await cq.spirit.start(); } catch (e) { /* the cache is the question here */ }
  if (isCache(cq.spirit.data)) test.check('on a page: once spirit.js has started, spirit.data is the cache, nothing else loading it');
  else test.fail('on a page spirit.js does not load the cache: spirit.data is ' + short(cq.spirit.data && Object.keys(cq.spirit.data)));
  // goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": the file tree's meaning is the files row element's, which
  // loads with a files element (rule/26); spirit.js loads the cache and no data script.
  if (!/data\.js/.test(JSON.stringify(cq.fetched).replace(/data\.js/g, ''))) test.check('on a page spirit.js loads no data script with the cache: no spirit/element/search/file/data.js (goal/G41.16)');
  else test.fail('on a page spirit.js still loads a data script: ' + short(cq.fetched.map(function (f) { return f.url; }).filter(function (u) { return /data\.js/.test(u) && !/data/.test(u); })));
  // goal/G41.19, Andy: no preloading elements: the cache alone; an element comes with whoever draws with it.
  const preloaded = cq.fetched.map(function (f) { return String(f.url) + ' ' + String(f.body || ''); }).filter(function (u) { return !/data\.js/.test(u) && /shell\//.test(u); });
  if (!preloaded.length) test.check('on a page spirit.js loads the cache and no element: no files row element with it (goal/G41.19)');
  else test.fail('on a page spirit.js still loads elements with the cache: ' + short(preloaded));
  const inProcess = spawnSync(process.execPath, ['-e', "const s = require(process.argv[1]); const d = s.data; process.stdout.write(String(!!d && typeof d.getPath === 'function' && typeof d.setPath === 'function' && typeof d.addTranslator === 'function'));", path.join(RUN, 'spirit', 'spirit.js')], { encoding: 'utf8', timeout: 20000 });
  if (inProcess.stdout === 'true') test.check('in a process: require(spirit.js) gives spirit.data, the cache');
  else test.fail('in a process spirit.js does not load the cache: ' + short(inProcess.stdout + inProcess.stderr));

  // ── 8. A MODULE THAT DOES NOT LOAD spirit.js FIRST GOES RED ──────────
  test.subHeading('8. a module that does not load spirit.js first goes red');
  const rule = path.join(RUN, 'spirit', 'test', 'spirit-child-generalRules.js');
  const onSpirit = spawnSync(process.execPath, [rule, 'spirit/spirit.js'], { cwd: RUN, encoding: 'utf8' });
  if (/✅:2\b/.test(onSpirit.stdout) && !/❌/.test(onSpirit.stdout)) test.check('the general rules pass spirit.js itself');
  else test.fail('the general rules on spirit.js: ' + short(onSpirit.stdout.slice(-200)));
  const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-first-'));
  try {
    fs.writeFileSync(path.join(fx, 'late.js'), "const fs = require('fs');\nrequire(" + JSON.stringify(path.join(RUN, 'spirit', 'spirit.js')) + ");\n");
    const late = spawnSync(process.execPath, [rule, path.join(fx, 'late.js')], { cwd: RUN, encoding: 'utf8' });
    if (/does not require spirit\.js first/.test(late.stdout) && /❌/.test(late.stdout)) test.check('a module whose first require is not spirit.js goes red');
    else test.fail('a module requiring fs before spirit.js: ' + short(late.stdout.slice(-200)));
  } finally { try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

  // ── 9. NO API UP FRONT, ON A REAL PAGE (goal/G43.27) ──────────
  // Andy: "MAKE SURE spirit.js doesn't load every fucking api upfront!!!!!!!!!!!!!!", and (G41.3) "lazy-load, is a
  // tree....". A real page (headless Chrome) of a scratch node, the home page loaded as a user opens it, every call to the
  // node's door counted. Never a live node.
  test.subHeading('9. no api up front, on a real page');
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const ok = function (cond, good, bad) { if (cond) test.check(good); else test.fail(bad); };
  const lazyNode = await H.scratchNode();
  const lazyPage = lazyNode.up ? await H.chromePage(H.findChrome()) : null;
  if (!lazyNode.up || !lazyPage || lazyPage.error) {
    test.fail('no scratch node or no headless lazyPage: nothing judged (' + short(lazyPage && lazyPage.error) + ')');
  } else {
    try {
      // Every call to the node's door, as the page sends it: { call, args }.
      const calls = function () {
        return lazyPage.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && m.params.request.postData; })
          .map(function (m) { try { return JSON.parse(m.params.request.postData); } catch (e) { return null; } }).filter(Boolean);
      };
      // The home page as a user opens it, then a while for it to settle.
      await lazyPage.send('Page.navigate', { url: lazyNode.base + '/face.html' });
      await H.until(function () { return lazyPage.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
      await H.sleep(6000);
      const atLoad = calls();
      const verbCalls = atLoad.filter(function (c) { return c.call !== 'api'; });
      ok(verbCalls.length > 0, 'the world: the page called ' + verbCalls.length + ' verbs as it loaded (' + short(Array.from(new Set(verbCalls.map(function (c) { return c.call; })))) + ')', 'the page called no verb: nothing judged');
      const whole = atLoad.filter(function (c) { return c.call === 'api' && !(c.args && c.args.family); });
      ok(!whole.length, 'on a real page: the page never asks for the whole api (api with no family)', 'on a real page: the page asked for the whole api ' + whole.length + ' time(s)');
      const used = new Set(verbCalls.map(function (c) { return String(c.call).split('.')[0]; }));
      const asked = atLoad.filter(function (c) { return c.call === 'api' && c.args && c.args.family; }).map(function (c) { return String(c.args.family); });
      const unused = Array.from(new Set(asked)).filter(function (f) { return !used.has(f); });
      ok(!unused.length, 'on a real page: no family\'s api is asked that the page never calls (' + asked.length + ' asked, all used)', 'on a real page: ' + unused.length + ' families\' api asked and never called: ' + short(unused));

      // NO FILE IT DOES NOT NEED YET (Andy: "all, spirit.js still seems to be loading all sorts of shit that it doesn't need
      // yet.", and "wsl, why didn't you make sure of this?"). Every file the page fetched as it loaded, with what asked for it.
      const gets = lazyPage.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && m.params.request.method === 'GET'; }).map(function (m) {
        const frames = (m.params.initiator && m.params.initiator.stack && m.params.initiator.stack.callFrames) || [];
        return { file: m.params.request.url.replace(lazyNode.base, '').replace(/^\//, '').replace(/[?#].*$/, ''), by: frames.length ? frames[0].url.replace(lazyNode.base, '').replace(/^\//, '') : '' };
      });
      const scripts = gets.filter(function (g) { return /\.js$/.test(g.file); });
      ok(scripts.length > 2, 'the world: the page fetched ' + scripts.length + ' scripts as it loaded', 'the page fetched ' + scripts.length + ' scripts: nothing judged');
      const counted = {};
      gets.forEach(function (g) { counted[g.file] = (counted[g.file] || 0) + 1; });
      const again = Object.keys(counted).filter(function (f) { return counted[f] > 1; });
      ok(!again.length, 'on a real page: no file is fetched twice as the page loads', 'on a real page: fetched more than once: ' + short(again));
      // A script comes when something requires it: spirit.require (spirit.js) loads it, never a list fetched up front.
      // face.html asks for spirit.js, spirit.js for the shell's boot.js; every other script is spirit.require's.
      const listed = scripts.filter(function (g) { return g.file !== 'spirit.js' && g.file !== 'shell/boot.js' && g.by !== 'spirit.js'; });
      ok(!listed.length, 'on a real page: every script is loaded by spirit.require when something requires it, none from a list up front',
        'on a real page: ' + listed.length + ' scripts loaded up front, not required: ' + short(listed.map(function (g) { return g.file + ' (by ' + g.by + ')'; })));
      // A dialog's parts come when it opens: the home page opens no app's detail, so none of its files is fetched.
      const detail = gets.filter(function (g) { return /^spirit\/app\/appSelector\/detailElement\.js$|^spirit\/element\/appInstaller\.js$|^spirit\/app\/appSelector\/(serverDEBUG|changeAppIcon|changeAppLabel|rowFormSetShell)\.js$/.test(g.file); });
      ok(!detail.length, 'on a real page: no detail is open, and none of an app detail\'s files is fetched', 'on a real page: an app detail\'s files fetched with no detail open: ' + short(detail.map(function (g) { return g.file; })));
      const twice = Array.from(new Set(asked)).filter(function (f) { return asked.filter(function (x) { return x === f; }).length > 1; });
      ok(!twice.length, 'on a real page: no family\'s api is asked twice', 'on a real page: asked more than once: ' + short(twice));
      // A node family the page has not touched yet, called now through the spirit object: its api is asked once, at
      // first use, and not again on the second call.
      const fresh = ['events', 'net', 'peer', 'owner', 'config'].filter(function (f) { return !used.has(f) && asked.indexOf(f) === -1; })[0] || '';
      ok(!!fresh, 'the world: ' + (fresh || 'no family') + ' is a family the page has not used yet', 'every candidate family was already used: nothing judged');
      if (fresh) {
        const before = calls().length;
        const reach = "Promise.resolve(window.spirit.require('spirit/" + fresh + "/api.js')).then(function () { return !!window.spirit." + fresh + "; }, function (e) { return 'refused ' + (e && e.message); })";
        const first = await lazyPage.evaluate(reach);
        const second = await lazyPage.evaluate(reach);
        await H.sleep(1000);
        const later = calls().slice(before).filter(function (c) { return c.call === 'api' && c.args && c.args.family === fresh; });
        ok(first === true && second === true, 'the world: ' + fresh + ' is bound on the page once it is required', fresh + ': ' + short([first, second]));
        ok(later.length === 1, 'on a real page: using ' + fresh + ' for the first time asks its api once, and using it again asks nothing', 'on a real page: ' + fresh + '\'s api was asked ' + later.length + ' times');
      }

      // AN APP SWITCHED ON AFTER THE PAGE LOADED WORKS, NO RELOAD (Andy, Q1: "shouldn't it work without making a call, since
      // the elements will trigger the necessary calls?", and "wsl, make sure your reds assert that as well!"). desk, off when
      // the page loaded, is switched on from the page; once its server answers, the Desk element is opened on that same page:
      // it asks desk itself and draws its list, never "the desk server did not answer".
      const on = await lazyPage.evaluate("window.spirit.ready.then(function (s) { return Promise.resolve(s.require(s.familyPath('app'))).then(function () { return s.app.activeApp({ key: 'desk', active: true }); }); }).then(function (r) { return !!(r && r.ok); }, function (e) { return 'refused ' + (e && e.message); })");
      ok(on === true, 'the world: desk, off at load, is switched on from the page (app.active)', 'app.active desk: ' + short(on));
      let up = '';
      if (on === true) {
        await H.until(async function () {
          up = await lazyPage.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call: 'desk.items.search', args: { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false } }) }).then(function (r) { return String(r.status); })");
          return up === '200';
        }, 40000);
      }
      ok(up === '200', 'the world: the desk server answers the page once switched on', 'desk.items.search answered ' + short(up) + ': nothing judged');
      if (up === '200') {
        const mark = lazyPage.heard.length;
        const drawn = await lazyPage.evaluate("(function () { var d = document.createElement('div'); document.body.appendChild(d);" +
          " return Promise.resolve(window.spirit.require('spirit/app/desk/desk.js')).then(function () { window.spirit.element.spirit.app.desk.browserDesk.create(d, {});" +
          " return new Promise(function (r) { setTimeout(function () { r(JSON.stringify({ text: d.innerText, nodes: d.querySelectorAll('*').length })); }, 8000); }); }," +
          " function (e) { return JSON.stringify({ refused: String(e && e.message) }); }); })()");
        let got = {};
        try { got = JSON.parse(drawn); } catch (e) { got = { refused: String(drawn) }; }
        const asked = lazyPage.heard.slice(mark).filter(function (m) { return m.method === 'Network.requestWillBeSent' && /\/api\/spirit$/.test(m.params.request.url) && /"call":"desk\.items\.search"/.test(m.params.request.postData || ''); });
        ok(!got.refused && got.nodes > 0, 'on a real page: the Desk element opens on the page that loaded before desk was on', 'the Desk element did not open: ' + short(got));
        ok(asked.length > 0, 'on a real page: the Desk element asks desk itself (desk.items.search), no reload', 'the Desk element sent no desk.items.search: its family is not reachable on this page');
        ok(!got.refused && !/did not answer/.test(String(got.text)), 'on a real page: the Desk list draws, never "the desk server did not answer"', 'the Desk page says: ' + short(String(got.text || '').slice(0, 200)));
      }
    } finally {
      if (lazyPage.kid) lazyPage.kid.kill();
    }
  }
  if (lazyNode.child) lazyNode.child.kill();
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
