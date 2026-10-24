'use strict';

// spirit/run/test/spirit.js
// THE RED OF spirit/run/spirit.js (goal/G40.6), and of no other module. It asserts ./spirit.md, section by section: the
// rule, where it runs, the one instance, every member of it, its node, the one loader, and that a module not loading
// spirit.js first goes red. Everything is asked of the one instance, in node and on a page: there is nothing else.
//   - In node, the instance itself for what needs no node; and, for what talks to a node, the instance of a scratch
//     copy of the run root whose relay-state/environment.json names a fake node this suite runs (and one that names
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
const test = require(path.join(__dirname, '..', '..', 'test', 'testSupport.js'));

const RUN = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(RUN, 'spirit.js'), 'utf8');
const COMPONENT = 'spirit/relayUrl.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
async function refusedWith(promise) { try { await promise; return 'answered'; } catch (e) { return e && e.code; } }

// A family's api.js as the node hands it: two verbs, one dotted, and a name of its own.
const DEMO = 'module.exports = { verbs: { hello: { name: "text" }, "line.write": { text: "text" } }, names: function (call) { return { hi: function (n) { return call("hello", { name: n }); } }; } };';
// The node's answers, the same at the loopback door and at a page's /api/spirit.
function answer(b) {
  if (b.verb === 'api' && b.family === 'demo') return [200, { interface: DEMO }];
  if (b.verb === 'api' && b.family) return [404, { ok: false, code: 'no-family', error: 'no family ' + b.family }];
  if (b.verb === 'api') return [200, { demo: { hello: {} }, gone: {} }];
  if (b.verb === 'demo.hello' && b.name === 'held') return [409, { ok: false, code: 'held', error: 'held by bert' }];
  if (b.verb === 'demo.hello' && b.name === 'slow') return [504, 'the app server did not answer'];
  if (b.verb === 'demo.hello') return [200, { ok: true, said: 'hello ' + b.name }];
  if (b.verb === 'demo.line.write') return [200, { ok: true, wrote: b.text }];
  if (b.verb === 'demo.FS.loadFile') return [200, { text: 'x' }];
  return [400, { ok: false, code: 'no-such-verb', error: 'no verb ' + b.verb }];
}
function fakeNode() {
  const asked = [];
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let b = {};
      try { b = JSON.parse(body || '{}'); } catch (e) { b = {}; }
      asked.push(b);
      const [status, out] = answer(b);
      res.writeHead(status, { 'Content-Type': typeof out === 'string' ? 'text/plain' : 'application/json' });
      res.end(typeof out === 'string' ? out : JSON.stringify(out));
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, asked: asked, close: function () { server.close(); } }); });
  });
}
// A scratch run root: spirit.js and its spirit/ folder, and an environment.json naming port (or none).
function scratchRoot(port) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-root-'));
  fs.copyFileSync(path.join(RUN, 'spirit.js'), path.join(root, 'spirit.js'));
  fs.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true });
  fs.mkdirSync(path.join(root, 'relay-state'));
  if (port) fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: port }));
  return root;
}
// What a node process sees through the instance of that root: run in a process of its own, its observations as JSON.
const OBSERVE = `
const s = require(process.argv[2] + '/spirit.js');
const kernel = require(process.argv[2] + '/spirit/kernel.js');
const out = {};
async function code(p) { try { await p; return 'answered'; } catch (e) { return e && e.code; } }
(async function () {
  out.keys = Object.keys(s).sort();
  out.same = require(process.argv[2] + '/spirit.js') === s && globalThis.spirit === s;
  if (process.argv[3] === 'none') {
    out.require = await code(s.require('process/js/demo/demo.family/api.js'));
    out.tree = await code(s.tree());
    out.noPort = !('port' in s);
  } else {
    const fams = await Promise.all([s.require('process/js/demo/demo.family/api.js'), s.require('process/js/demo/demo.family/api.js')]);
    const two = await Promise.all([fams[0].hello({ name: 'bert' }), fams[1].hello({ name: 'carl' })]);
    out.two = two.map(function (r) { return r.said; });
    out.bound = fams[0] === fams[1] && fams[0] === s.demo && typeof s.demo.hello === 'function';
    out.hi = (await s.demo.hi('dave')).said;
    out.dotted = typeof s.demo.lineWrite === 'function' && s.demo.lineWrite === s.demo['line.write'] && (await s.demo.lineWrite({ text: 't' })).wrote;
    out.fs = (await s.demo.FS.loadFile({ path: 'x.txt' })).text;
    out.noArg = await code(s.demo.hello({ nme: 'x' }));
    out.noVerb = typeof s.demo.nothing === 'undefined';
    out.noFamily = await code(s.require('process/js/gone/gone.family/api.js'));
    try { await s.demo.hello({ name: 'held' }); } catch (e) { out.held = [e.code, e.message, e.status]; }
    try { await s.demo.hello({ name: 'slow' }); } catch (e) { out.slow = [e.status, e.message]; }
    out.tree = Object.keys(await s.tree()).sort();
    out.viaRequire = (await s.require('process/js/demo/demo.family/api.js')) === s.demo;
    out.outcome = [await s.outcome(s.demo.hello({ name: 'eve' })), await s.outcome(s.demo.hello({ nme: 1 })), await s.outcome(s.demo.hello({ name: 'held' })), await s.outcome(Promise.reject(new Error('gone')))]
      .map(function (o) { return [o.status, o.body && (o.body.said || o.body.code)]; });
    const posted = [];
    const real = kernel.peerPost;
    kernel.peerPost = function (peer, app, body, how) { posted.push({ peer: peer, app: app, node: how && how.node, waitMs: how && how.waitMs }); return Promise.resolve({ ok: true }); };
    await s.peerPost('k0', 'api', {}, {});
    out.peerPostNode = posted[0] && posted[0].node;
    kernel.peerPost = real;
    let asks = 0;
    s.peerPost = function (peer, app, body, how) {
      if (body && body.api) asks++;
      out.peerHow = how && how.waitMs;
      return new Promise(function (r) { setTimeout(function () { r(body && body.api ? { interface: '${DEMO.replace(/'/g, "\\'")}' } : { said: 'hello from ' + peer }); }, 20); });
    };
    const both = await Promise.all([s.require('process/js/demo/demo.family/api.js', 'peerKey1', { waitMs: 777 }), s.require('process/js/demo/demo.family/api.js', 'peerKey1', { waitMs: 777 })]);
    out.peer = [both[0] === both[1], asks, (await both[0].hello({ name: 'x' })).said, s.demo !== both[0]];
  }
  process.stdout.write(JSON.stringify(out));
}()).catch(function (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.stack || e) })); });
`;
function observe(root, mode, port) {
  const file = path.join(root, 'observe.js');
  fs.writeFileSync(file, OBSERVE);
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [file, root, mode || '', String(port || '')], { cwd: root });
    let said = '';
    kid.stdout.on('data', function (c) { said += c; });
    kid.stderr.on('data', function (c) { said += c; });
    kid.on('close', function () { try { resolve(JSON.parse(said)); } catch (e) { resolve({ threw: said.slice(-400) }); } });
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
        if (b.verb === 'peer.post') {
          const inner = JSON.parse(b.to ? b.text : '{}').body;
          const reply = inner && inner.api ? { interface: DEMO } : { said: 'hello page peer' };
          return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(reply)); } });
        }
        const [status, out] = answer(b);
        return Promise.resolve({ status: status, text: function () { return Promise.resolve(typeof out === 'string' ? out : JSON.stringify(out)); } });
      }
      const file = path.join(RUN, String(url).replace(/^\/+/, ''));
      const there = fs.existsSync(file);
      return Promise.resolve({ status: there ? 200 : 404, headers: { get: function () { return ''; } }, arrayBuffer: function () { return Promise.resolve(there ? new Uint8Array(fs.readFileSync(file)).buffer : new ArrayBuffer(0)); } });
    },
    TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL, setTimeout: setTimeout,
  };
  window.window = window;
  const ctx = vm.createContext(window);
  vm.runInContext(SOURCE, ctx, { filename: 'spirit.js' });
  window.fetched = fetched;
  return window;
}

test.startTest('spirit/run/spirit.js: the one spirit object, in node and on a page');

(async function () {
  // ── 1. WHERE IT RUNS, THE ONE INSTANCE, THE GLOBAL FIRST ─────────────
  test.subHeading('1. spirit.js alone tells node from a page; one instance, the global first');
  const s = require(path.join(RUN, 'spirit.js'));
  if (s.isNode() === true && s.isBrowser() === false) test.check('in node: isNode() true, isBrowser() false');
  else test.fail('in node: isNode() ' + s.isNode() + ', isBrowser() ' + s.isBrowser());
  if (globalThis.spirit === s && require(path.join(RUN, 'spirit.js')) === s) test.check('in node: require answers the one instance, the global spirit, every time');
  else test.fail('in node: the global and what require answered differ');
  const kept = spawnSync(process.execPath, ['-e', 'globalThis.spirit = { mark: 1 }; const s = require(process.argv[1]); console.log(String(s === globalThis.spirit && s.mark === 1 && typeof s.require === "function"));', path.join(RUN, 'spirit.js')], { encoding: 'utf8' });
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
  const MEMBERS = ['check', 'core', 'error', 'escapeHtml', 'formatBytes', 'isBrowser', 'isNode', 'outcome', 'peerPost', 'require', 'rules', 'tree'];
  if (JSON.stringify(Object.keys(s).filter(function (k) { return typeof s[k] !== 'object' || ['core'].indexOf(k) !== -1 || Array.isArray(s[k]); }).sort()) === JSON.stringify(MEMBERS))
    test.check('in node the instance holds exactly its members: ' + MEMBERS.join(', ') + ' (and the families it binds)');
  else test.fail('in node the instance holds ' + short(Object.keys(s).sort()));
  const factories = ['createSpirit', 'assemble', 'forNode', 'forPeer', 'nodeTransport', 'pageTransport', 'peerTransport', 'loadInterface', 'spiritObject', 'call', 'port'];
  const left = factories.filter(function (k) { return k in s || k in w.spirit; });
  if (!left.length) test.check('no factory, no transport and no second object handed out, in node or on a page');
  else test.fail('still handed out: ' + left.join(', '));

  const fetches = (code.match(/\bfetch\(/g) || []).length;
  if (fetches === 2 && /function post\(verb, args\)/.test(code) && /function get\(path\)/.test(code))
    test.check('one post and one get: spirit.js reaches the node in exactly two places, post(verb, args) and get(path)');
  else test.fail('spirit.js reaches the network in ' + fetches + ' places, or has no post(verb, args) and get(path)');

  // ── 2. IN NODE: THE KERNEL'S NAMES ───────────────────────────────────
  test.subHeading('2. in node: the kernel\'s names, on the one instance');
  const kernel = require(path.join(RUN, 'spirit', 'kernel.js'));
  const notKernel = ['jobs', 'node', 'util', 'fs'].filter(function (k) { return s.core[k] !== kernel.core[k]; });
  const mime = s.core.const.MIME_TYPES;
  if (!notKernel.length && typeof s.peerPost === 'function' && mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json']) && s.core.const.VERSION === kernel.core.const.VERSION)
    test.check('spirit.core.jobs, node, util and fs are the kernel\'s; spirit.core.const holds its constants and spirit.js\'s own MIME_TYPES; spirit.peerPost is there');
  else test.fail('not the kernel\'s: ' + notKernel.join(', ') + '; MIME ' + short(mime && mime['.js']));

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
      if (o.two && o.two[0] === 'hello bert' && o.two[1] === 'hello carl' && o.bound && node.asked.filter(function (b) { return b.verb === 'api' && b.family === 'demo'; }).length === 1)
        test.check('spirit.require of the demo interface binds it on the one instance as spirit.demo, from 127.0.0.1:<its port>, asked once by two callers at once');
      else test.fail('binding demo: ' + short([o.two, o.bound, node.asked.filter(function (b) { return b.verb === 'api'; }).length]));
      if (o.hi === 'hello dave' && o.dotted === 't' && o.fs === 'x') test.check('a bound family has its own names, a dotted verb in camel case too (line.write as lineWrite), and the folder verbs (FS.loadFile)');
      else test.fail('the bound family: ' + short([o.hi, o.dotted, o.fs]));
      const askedBefore = node.asked.length;
      if (o.noArg === 'no-such-argument' && o.noVerb === true && o.noFamily === 'no-interface') test.check('an argument the verb does not name is refused before it leaves; a verb the family lacks is not on it; a family with no interface refuses no-interface');
      else test.fail('refusals: ' + short([o.noArg, o.noVerb, o.noFamily, askedBefore]));
      if (o.held && o.held[0] === 'held' && o.held[1] === 'held by bert' && o.held[2] === 409 && o.slow && o.slow[0] === 504 && o.slow[1] === 'the app server did not answer')
        test.check('the node\'s refusal keeps its code, its words and its status; a plain-text answer keeps its text');
      else test.fail('the node\'s refusals: ' + short([o.held, o.slow]));
      if (JSON.stringify(o.tree) === JSON.stringify(['demo', 'gone'])) test.check('spirit.tree() answers its node\'s api as it stands');
      else test.fail('spirit.tree(): ' + short(o.tree));
      if (o.viaRequire) test.check('spirit.require(\'process/js/demo/demo.family/api.js\') answers the same member, spirit.demo');
      else test.fail('spirit.require of an interface did not answer spirit.demo');
      const oc = o.outcome || [];
      if (oc[0] && oc[0][0] === 200 && oc[0][1] === 'hello eve' && oc[1][0] === 400 && oc[1][1] === 'no-such-argument' && oc[2][0] === 409 && oc[3][0] === 0)
        test.check('spirit.outcome: 200 and the body; 400 for a call the check refused; the node\'s own status; 0 when nothing answered');
      else test.fail('spirit.outcome: ' + short(oc));
      if (o.peerPostNode === 'http://127.0.0.1:' + node.port) test.check('spirit.peerPost goes through its own node, 127.0.0.1:<its port>');
      else test.fail('spirit.peerPost went through ' + short(o.peerPostNode));
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
  if (started === again && wq.spirit.ready === started && ps === wq.spirit && wq.spirit.demo && !wq.spirit.gone)
    test.check('spirit.start() binds every family the node names on window.spirit, once; spirit.ready is that start; one with no interface is left off');
  else test.fail('spirit.start: ' + short([started === again, wq.spirit.ready === started, Object.keys(wq.spirit)]));
  const pc = await wq.spirit.demo.hello({ name: 'hal' });
  const toDoor = wq.fetched.filter(function (f) { return f.url === '/api/spirit'; });
  if (pc.said === 'hello hal' && toDoor.length && JSON.parse(toDoor[toDoor.length - 1].body).verb === 'demo.hello') test.check('on a page with no link: calls go to the page\'s own origin, /api/spirit, as {verb, ...args}');
  else test.fail('on a page: ' + short([pc, toDoor.length]));
  const linked = [];
  wq.spirit.transport = { ask: function (v) { linked.push(v); return { status: 200, body: { said: 'via link' } }; }, file: function (p) { linked.push('file ' + p); return { status: 200, bytes: new Uint8Array(fs.readFileSync(path.join(RUN, p))) }; } };
  const before = wq.fetched.length;
  const viaLink = await wq.spirit.demo.hello({ name: 'x' });
  if (viaLink.said === 'via link' && linked[0] === 'demo.hello' && wq.fetched.length === before) test.check('on a page with window.spirit.transport set: every call goes through that link, nothing fetched');
  else test.fail('with a link: ' + short([viaLink, linked, wq.fetched.length - before]));
  delete wq.spirit.transport;
  if (wq.spirit === wq.window.spirit && !('call' in wq.spirit)) test.check('on a page the one instance is window.spirit, and nothing else is made');
  else test.fail('on a page: ' + short(Object.keys(wq.spirit)));

  // ── 7. THE ONE LOADER, THE SAME IN NODE AND ON A PAGE ────────────────
  test.subHeading('7. spirit.require(path, key): the one loader, the same in node and on a page');
  const inNode = await s.require(COMPONENT);
  if (inNode === require(path.join(RUN, COMPONENT))) test.check('in node: a component by its run-root path answers its module.exports');
  else test.fail('in node, ' + COMPONENT + ' answered ' + short(inNode));
  const missing = await refusedWith(s.require('spirit/noSuchComponent.js'));
  if (missing && missing !== 'answered') test.check('in node: a component that is not there refuses (' + missing + ')');
  else test.fail('in node: a missing component answered');
  const onPage = await wq.spirit.require(COMPONENT);
  if (onPage && typeof onPage.assertRelayUrl === 'function' && JSON.stringify(Object.keys(onPage).sort()) === JSON.stringify(Object.keys(inNode).sort()))
    test.check('on a page: the same require, ' + COMPONENT + ', answers the same exports as in node');
  else test.fail('on a page, ' + COMPONENT + ' answered ' + short(onPage && Object.keys(onPage)));
  if (await refusedWith(wq.spirit.require('spirit/noSuchComponent.js')) === 'not-found') test.check('on a page: a component that is not there refuses not-found');
  else test.fail('on a page: a missing component did not refuse not-found');
  const pf = await wq.spirit.require('process/js/demo/demo.family/api.js');
  if (pf === wq.spirit.demo) test.check('on a page: an interface answers its member on window.spirit');
  else test.fail('on a page: an interface answered another member');
  const pp = await wq.spirit.require('process/js/demo/demo.family/api.js', 'peerKey2');
  const ppa = await pp.hello({ name: 'x' });
  if (wq.fetched.some(function (f) { return f.url === '/api/spirit' && JSON.parse(f.body).verb === 'peer.post'; }) && ppa.said === 'hello page peer' && pp !== wq.spirit.demo)
    test.check('on a page: with a key, the peer\'s family through the home node\'s peer.post, not its own node\'s');
  else test.fail('on a page: a peer\'s family answered ' + short(ppa));

  // ── 8. A MODULE THAT DOES NOT LOAD spirit.js FIRST GOES RED ──────────
  test.subHeading('8. a module that does not load spirit.js first goes red');
  const rule = path.join(__dirname, 'spirit-child-generalRules.js');
  const onSpirit = spawnSync(process.execPath, [rule, 'spirit.js'], { cwd: RUN, encoding: 'utf8' });
  if (/✅:2\b/.test(onSpirit.stdout) && !/❌/.test(onSpirit.stdout)) test.check('the general rules pass spirit.js itself');
  else test.fail('the general rules on spirit.js: ' + short(onSpirit.stdout.slice(-200)));
  const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-first-'));
  try {
    fs.writeFileSync(path.join(fx, 'late.js'), "const fs = require('fs');\nrequire(" + JSON.stringify(path.join(RUN, 'spirit.js')) + ");\n");
    const late = spawnSync(process.execPath, [rule, path.join(fx, 'late.js')], { cwd: RUN, encoding: 'utf8' });
    if (/does not require spirit\.js first/.test(late.stdout) && /❌/.test(late.stdout)) test.check('a module whose first require is not spirit.js goes red');
    else test.fail('a module requiring fs before spirit.js: ' + short(late.stdout.slice(-200)));
  } finally { try { fs.rmSync(fx, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
