'use strict';

// spirit/run/test/spirit.js
// THE RED OF spirit/run/spirit.js (goal/G40.6), and of no other module. It asserts ./spirit.md, section by section: the
// rule, where it runs, the global first, every function it hands out, the one interface for faces and node, the one
// loader, and that a module not loading spirit.js first goes red. In node AND on a page: the page is spirit.js's own
// source run as face.html runs it, in a window of its own, with no module and no process. Reported in the format of the
// current test system.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require(path.join(__dirname, '..', '..', 'test', 'testSupport.js'));

const RUN = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(RUN, 'spirit.js'), 'utf8');
const COMPONENT = 'spirit/relayUrl.js';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
async function refusedWith(promise) { try { await promise; return 'answered'; } catch (e) { return e && e.code; } }

// A fake node's loopback door: the api answer, one family "demo" with one verb, fs.load.
const DEMO = 'module.exports = { verbs: { hello: { name: "text" } }, names: function (call) { return { hi: function (n) { return call("hello", { name: n }); } }; } };';
function fakeNode() {
  const asked = [];
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let b = {};
      try { b = JSON.parse(body || '{}'); } catch (e) { b = {}; }
      asked.push(b);
      const send = function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (b.verb === 'api' && b.family === 'demo') return send(200, { interface: DEMO });
      if (b.verb === 'api' && b.family) return send(404, { ok: false, code: 'no-family', error: 'no family ' + b.family });
      if (b.verb === 'api') return send(200, { demo: { hello: {} } });
      if (b.verb === 'demo.hello') return send(200, { ok: true, said: 'hello ' + b.name });
      if (b.verb === 'fs.load') return send(200, { text: 'abc' });
      return send(400, { ok: false, code: 'no-such-verb', error: 'no verb ' + b.verb });
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ url: 'http://127.0.0.1:' + server.address().port, asked: asked, close: function () { server.close(); } }); });
  });
}
// A transport held in the hand: answers the api, the demo family, and records every ask.
function handTransport(answers) {
  const asked = [];
  return {
    asked: asked,
    ask: function (verb, args) {
      asked.push({ verb: verb, args: args });
      const a = answers(verb, args || {});
      return Promise.resolve(a);
    },
    file: function (p) { return Promise.resolve({ status: 200, type: '', bytes: new Uint8Array(fs.readFileSync(path.join(RUN, p))) }); },
  };
}
const DEMO_ANSWERS = function (verb, args) {
  if (verb === 'api' && args.family === 'demo') return { status: 200, body: { interface: DEMO } };
  if (verb === 'api' && args.family) return { status: 404, body: { ok: false } };
  if (verb === 'api') return { status: 200, body: { demo: {}, gone: {} } };
  if (verb === 'demo.hello') return { status: 200, body: { said: 'hello ' + args.name } };
  if (verb === 'demo.FS.loadFile') return { status: 200, body: { text: 'x' } };
  return { status: 409, body: { ok: false, code: 'refused-here', error: 'not here' } };
};

// A page: spirit.js's own source run in a window of its own, as face.html runs it. No module, no process, no require.
function page(fetchImpl) {
  const window = { fetch: fetchImpl || function () { return Promise.reject(new Error('no fetch on this page')); }, TextDecoder: TextDecoder, console: console, Promise: Promise, URL: URL };
  window.window = window;
  window.globalThis = window;
  const ctx = vm.createContext(window);
  vm.runInContext(SOURCE, ctx, { filename: 'spirit.js' });
  return window;
}

test.startTest('spirit/run/spirit.js: the one spirit object, in node and on a page');

(async function () {
  delete process.env.SPIRIT_CALLBACK_URL;

  // ── 1. WHERE IT RUNS, AND THE GLOBAL FIRST ───────────────────────────
  test.subHeading('1. spirit.js alone tells node from a page, and the global comes first');
  const s = require(path.join(RUN, 'spirit.js'));
  if (s.isNode() === true && s.isBrowser() === false) test.check('in node: isNode() true, isBrowser() false');
  else test.fail('in node: isNode() ' + s.isNode() + ', isBrowser() ' + s.isBrowser());
  if (globalThis.spirit === s && require(path.join(RUN, 'spirit.js')) === s) test.check('requiring it answers the global spirit, the same object every time');
  else test.fail('the global and what require answered differ');
  const kept = spawnSync(process.execPath, ['-e', 'globalThis.spirit = { mark: 1 }; const s = require(process.argv[1]); console.log(String(s === globalThis.spirit && s.mark === 1 && typeof s.require === "function"));', path.join(RUN, 'spirit.js')], { encoding: 'utf8' });
  if (String(kept.stdout).trim() === 'true') test.check('a global spirit already there is the one it fills, not replaced');
  else test.fail('a global spirit already there was replaced or not filled: ' + short(kept.stdout + kept.stderr));
  const w = page();
  if (w.spirit && w.spirit.isBrowser() === true && w.spirit.isNode() === false) test.check('on a page: window.spirit at once, isBrowser() true, isNode() false');
  else test.fail('on a page: ' + short(w.spirit && { isBrowser: w.spirit.isBrowser && w.spirit.isBrowser(), isNode: w.spirit.isNode && w.spirit.isNode() }));
  const sets = SOURCE.search(/\broot\.spirit\s*=/);
  const firstRequire = SOURCE.replace(/\/\/[^\n]*/g, function (c) { return ' '.repeat(c.length); }).search(/\brequire\(/);
  if (sets !== -1 && sets < firstRequire) test.check('the source sets the global before its first require');
  else test.fail('the global is set at ' + sets + ', the first require at ' + firstRequire);
  if (!/typeof (window|module|process|require|TextDecoder|Buffer)/.test(SOURCE.replace(/function isNode\(\)[^\n]*\n|function isBrowser\(\)[^\n]*\n/g, '').replace(/\/\/[^\n]*/g, '')))
    test.check('nothing in spirit.js but isNode() and isBrowser() asks where it runs');
  else test.fail('spirit.js asks where it runs outside isNode() and isBrowser()');

  // ── 2. WHAT A SCRIPT TOOK FROM kernel.js, IN NODE ────────────────────
  test.subHeading('2. in node: the kernel\'s names, on the spirit object');
  const kernel = require(path.join(RUN, 'spirit', 'kernel.js'));
  const same = ['jobs', 'node', 'util', 'fs'].filter(function (k) { return s.core[k] !== kernel.core[k]; });
  if (!same.length && s.peerPost === kernel.peerPost) test.check('spirit.core.jobs, node, util, fs and spirit.peerPost are the kernel\'s own');
  else test.fail('not the kernel\'s: ' + same.join(', ') + (s.peerPost === kernel.peerPost ? '' : ' peerPost'));
  const mime = s.core.const.MIME_TYPES;
  if (mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json']) && /html/.test(mime['.html']) && s.core.const.VERSION === kernel.core.const.VERSION)
    test.check('spirit.core.const holds the kernel\'s constants, VERSION among them, and its own MIME_TYPES');
  else test.fail('spirit.core.const: ' + short(Object.keys(s.core.const || {})));

  // ── 3. THE HELPERS ───────────────────────────────────────────────────
  test.subHeading('3. the helpers, in node and on a page alike');
  for (const [where, o] of [['node', s], ['page', w.spirit]]) {
    const e = o.error('boom');
    const okHelpers = e && e.error && e.error.string === 'boom' && o.formatBytes(0) === '0 Bytes' && o.formatBytes(1024) === '1 KB' && o.formatBytes(1536) === '1.5 KB'
      && o.escapeHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;';
    if (okHelpers) test.check(where + ': error, formatBytes and escapeHtml answer as specified');
    else test.fail(where + ': helpers answered ' + short([e, o.formatBytes(0), o.formatBytes(1024), o.escapeHtml('&<>"\'')]));
  }

  // ── 4. THE CHECK ─────────────────────────────────────────────────────
  test.subHeading('4. check: every argument against its verb\'s declaration, every rule');
  const KEY = 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
  const rules = { text: ['a', 1], id: ['a', ''], flag: ['yes', 'no'], number: [1, Infinity], bool: [true, 'true'], object: [{}, []], list: [[], {}],
    key: [KEY, 'abc'], url: ['https://a.b', 'ftp://a.b'], path: ['a/b.js', '../a'], name: ['bert', 7], description: ['a line', 7], paragraph: ['a paragraph', 7] };
  const names = Object.keys(rules).sort();
  if (JSON.stringify(Object.keys(s.rules).sort()) === JSON.stringify(names)) test.check('the rules are exactly ' + names.join(', '));
  else test.fail('the rules are ' + short(Object.keys(s.rules)));
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

  // ── 5. THE TRANSPORTS ────────────────────────────────────────────────
  test.subHeading('5. the transports: the node\'s loopback door, a page\'s door, a peer');
  const node = await fakeNode();
  try {
    const nt = s.nodeTransport(node.url);
    const r = await nt.ask('demo.hello', { name: 'bert' });
    const f = await nt.file('a.txt');
    if (r.status === 200 && r.body.said === 'hello bert' && typeof r.text === 'string' && node.asked.some(function (b) { return b.verb === 'demo.hello' && b.name === 'bert'; })
        && f.status === 200 && Buffer.from(f.bytes).toString() === 'abc')
      test.check('nodeTransport(url): ask posts {verb, ...args} to url/api/spirit and answers {status, text, body}; file reads through fs.load');
    else test.fail('nodeTransport answered ' + short([r, f && f.status]));
  } finally { node.close(); }
  const fetched = [];
  const wp = page(function (url, init) { fetched.push({ url: url, body: init && init.body }); return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{"ok":true}'); }, arrayBuffer: function () { return Promise.resolve(new Uint8Array([104, 105]).buffer); }, headers: { get: function () { return 'text/plain'; } } }); });
  const pt = wp.spirit.spiritObject.pageTransport();
  const pr = await pt.ask('demo.hello', { name: 'x' });
  const pf = await pt.file('/a.txt');
  if (pr.status === 200 && pr.body.ok === true && fetched[0].url === '/api/spirit' && JSON.parse(fetched[0].body).verb === 'demo.hello' && fetched[1].url === '/a.txt' && pf.bytes.length === 2)
    test.check('pageTransport() with no link set: the node\'s own door, /api/spirit, and files by their path');
  else test.fail('pageTransport answered ' + short([pr, fetched]));
  const linked = [];
  wp.spirit.transport = { ask: function (v, a) { linked.push(v); return { status: 201, body: { via: 'link' } }; }, file: function (p) { linked.push('file ' + p); return { status: 200, bytes: new Uint8Array([1]) }; } };
  const lr = await pt.ask('demo.hello', {});
  await pt.file('b.txt');
  if (lr.body.via === 'link' && linked.join(',') === 'demo.hello,file b.txt' && fetched.length === 2) test.check('pageTransport() with window.spirit.transport set: everything goes through that link, nothing fetched');
  else test.fail('with a link set: ' + short([lr, linked, fetched.length]));
  delete wp.spirit.transport;
  const posted = [];
  const peerT = s.peerTransport(function (b) { posted.push(b); return Promise.resolve(posted.length === 3 ? { ok: false, code: 'not-posted' } : posted.length === 4 ? { ok: false, code: 'nope' } : { ok: true }); });
  const p1 = await peerT.ask('api', {});
  const p2 = await peerT.ask('api', { family: 'demo' });
  const p3 = await peerT.ask('demo.hello', { name: 'n' });
  const p4 = await peerT.ask('demo.hello', {});
  if (posted[0] === 'api' && posted[1].api.family === 'demo' && posted[2].demo.hello.name === 'n' && p1.status === 200 && p3.status === 0 && p4.status === 409)
    test.check('peerTransport(post): api, api {family} and {family: {verb: args}} as the apiDoor takes them; ok false is 409, not reached is 0');
  else test.fail('peerTransport: ' + short([posted, p1.status, p2.status, p3.status, p4.status]));

  // ── 6. AN INTERFACE AND THE ASSEMBLING ───────────────────────────────
  test.subHeading('6. loadInterface, assemble, createSpirit: one member a family, every call checked');
  const def = s.loadInterface(DEMO, 'demo');
  if (def && def.verbs && def.verbs.hello && typeof def.names === 'function') test.check('loadInterface(source) runs a family\'s api.js and answers its module.exports');
  else test.fail('loadInterface answered ' + short(def));
  const ht = handTransport(DEMO_ANSWERS);
  const a = s.assemble(ht, { demo: def });
  const said = await a.demo.hello({ name: 'bert' });
  const viaName = await a.demo.hi('carl');
  const viaCall = await a.call('demo.hello', { name: 'dave' });
  const fsCall = await a.demo.FS.loadFile({ path: 'x.txt' });
  const badArg = await refusedWith(a.demo.hello({ nme: 'x' }));
  const noVerb = await refusedWith(a.call('demo.nothing', {}));
  const askedBefore = ht.asked.length;
  await refusedWith(a.demo.hello({ name: 7 }));
  if (said.said === 'hello bert' && viaName.said === 'hello carl' && viaCall.said === 'hello dave' && fsCall.text === 'x' && badArg === 'no-such-argument' && noVerb === 'no-such-verb' && ht.asked.length === askedBefore)
    test.check('assemble(transport, defs): each verb a checked call, the family\'s own names, spirit.call by name, the FS verbs; a refused call never leaves');
  else test.fail('assemble: ' + short([said, viaName, viaCall, fsCall, badArg, noVerb, ht.asked.length - askedBefore]));
  const dotted = s.assemble(handTransport(function () { return { status: 200, body: {} }; }), { chat: { verbs: { 'line.write': { text: 'text' } } } });
  if (typeof dotted.chat.lineWrite === 'function' && dotted.chat.lineWrite === dotted.chat['line.write']) test.check('a dotted verb is also there in camel case: line.write as lineWrite');
  else test.fail('no camel-case alias for line.write');
  const refusedT = handTransport(function (verb) { return verb === 'demo.hello' ? { status: 409, body: { ok: false, code: 'held', error: 'held by bert' } } : { status: 504, text: 'the app server did not answer', body: null }; });
  const ra = s.assemble(refusedT, { demo: def });
  let e1 = null; try { await ra.demo.hello({ name: 'x' }); } catch (e) { e1 = e; }
  let e2 = null; try { await ra.demo.FS.loadFile({ path: 'x' }); } catch (e) { e2 = e; }
  if (e1 && e1.code === 'held' && e1.message === 'held by bert' && e1.status === 409 && e2 && e2.status === 504 && e2.message === 'the app server did not answer')
    test.check('a refusal keeps the node\'s code, its own words, and its status; a plain-text answer keeps its text');
  else test.fail('refusals: ' + short([e1 && [e1.code, e1.message, e1.status], e2 && [e2.code, e2.message, e2.status]]));
  const tr = await a.tree();
  if (tr.demo && tr.gone) test.check('tree() answers the node\'s api as it stands');
  else test.fail('tree() answered ' + short(tr));
  const made = await s.createSpirit(handTransport(DEMO_ANSWERS));
  const mh = await made.demo.hello({ name: 'eve' });
  if (mh.said === 'hello eve' && !made.gone && typeof made.require === 'function' && typeof made.call === 'function') test.check('createSpirit(transport): every family the node names bound under the node\'s name; one with no interface is left off');
  else test.fail('createSpirit: ' + short(Object.keys(made)));

  // ── 7. A SERVER'S, AND A PEER'S, SPIRIT OBJECT ───────────────────────
  test.subHeading('7. forNode and forPeer: made once, a family bound when first asked for');
  const node2 = await fakeNode();
  try {
    const n1 = await s.forNode(node2.url);
    const n2 = await s.forNode(node2.url, 'demo');
    const n3 = await s.forNode(node2.url, 'missing');
    const nh = await n2.demo.hello({ name: 'fay' });
    if (n1 === n2 && n2 === n3 && nh.said === 'hello fay' && !n3.missing && node2.asked.filter(function (b) { return b.verb === 'api' && b.family === 'demo'; }).length === 1)
      test.check('forNode(url, family): one object per url, the family asked for once and bound, a family the node lacks left off');
    else test.fail('forNode: ' + short([n1 === n2, n2 === n3, nh]));
  } finally { node2.close(); }
  let peerAsks = 0;
  const post = function (b) { if (b && b.api) peerAsks++; return new Promise(function (r) { setTimeout(function () { r(b && b.api ? { interface: DEMO } : { said: 'hello peer' }); }, 20); }); };
  const both = await Promise.all([s.forPeer('k1', post, 'demo'), s.forPeer('k1', post, 'demo')]);
  const ph = await both[0].demo.hello({ name: 'x' });
  if (both[0] === both[1] && peerAsks === 1 && ph.said === 'hello peer') test.check('forPeer(key, post, family): one object per key, two callers at once ask once');
  else test.fail('forPeer: ' + short([both[0] === both[1], peerAsks, ph]));

  // ── 8. outcome ───────────────────────────────────────────────────────
  test.subHeading('8. outcome: a call\'s answer as the status it came with');
  const o1 = await s.outcome(Promise.resolve({ a: 1 }));
  const o2 = await s.outcome(a.demo.hello({ nme: 1 }));
  const o3 = await s.outcome(ra.demo.hello({ name: 'x' }));
  const o4 = await s.outcome(Promise.reject(new Error('gone')));
  if (o1.status === 200 && o1.body.a === 1 && o2.status === 400 && o2.body.code === 'no-such-argument' && o3.status === 409 && o4.status === 0)
    test.check('200 with the body; a call the check refused 400; the node\'s own status kept; no answer at all 0');
  else test.fail('outcome: ' + short([o1, o2, o3, o4]));

  // ── 9. THE ONE LOADER, THE SAME IN NODE AND ON A PAGE ────────────────
  test.subHeading('9. spirit.require(path, key): the one loader, the same in node and on a page');
  const inNode = await s.require(COMPONENT);
  if (inNode === require(path.join(RUN, COMPONENT))) test.check('in node: a component by its run-root path answers its module.exports');
  else test.fail('in node, ' + COMPONENT + ' answered ' + short(inNode));
  const missing = await refusedWith(s.require('spirit/noSuchComponent.js'));
  if (missing) test.check('in node: a component that is not there refuses (' + missing + ')');
  else test.fail('in node: a missing component answered');
  if (await refusedWith(s.require('process/js/desk/desk.family/api.js')) === 'no-node' && await refusedWith(s.require('spirit/fs/api.js')) === 'no-node')
    test.check('in node: an interface, a server\'s or a node family\'s, is refused no-node while SPIRIT_CALLBACK_URL names no node');
  else test.fail('in node: an interface with no node of its own was not refused no-node');
  const node3 = await fakeNode();
  try {
    process.env.SPIRIT_CALLBACK_URL = node3.url + '/callback';
    const bound = await s.require('process/js/demo/demo.family/api.js');
    const bh = await bound.hello({ name: 'gus' });
    if (s.demo === bound && bh.said === 'hello gus') test.check('in node: with its own node named, an interface binds as spirit.<name> and its calls reach that node');
    else test.fail('in node: binding an interface answered ' + short([bound === s.demo, bh]));
  } finally { delete process.env.SPIRIT_CALLBACK_URL; node3.close(); }
  const realPeerPost = s.peerPost;
  let viaPeerPost = null;
  s.peerPost = function (key, app, body) { viaPeerPost = [key, app]; return Promise.resolve(body && body.api ? { interface: DEMO } : { said: 'hello from peer' }); };
  try {
    const peerFam = await s.require('process/js/demo/demo.family/api.js', 'peerKey1');
    const pa = await peerFam.demo.hello({ name: 'x' });
    if (viaPeerPost && viaPeerPost[0] === 'peerKey1' && viaPeerPost[1] === 'api' && pa.said === 'hello from peer') test.check('in node: with a key, the peer\'s family through spirit.peerPost');
    else test.fail('in node: a peer\'s family answered ' + short([viaPeerPost, pa]));
  } finally { s.peerPost = realPeerPost; }

  const wq = page();
  const pageAsked = [];
  wq.spirit.transport = {
    ask: function (verb, args) {
      pageAsked.push(verb);
      if (verb === 'peer.post') return Promise.resolve({ status: 200, body: JSON.parse(args.text).body.api ? { interface: DEMO } : { said: 'hello page peer' } });
      return Promise.resolve(DEMO_ANSWERS(verb, args || {}));
    },
    file: function (p) { return Promise.resolve({ status: fs.existsSync(path.join(RUN, p)) ? 200 : 404, type: '', bytes: fs.existsSync(path.join(RUN, p)) ? new Uint8Array(fs.readFileSync(path.join(RUN, p))) : new Uint8Array(0) }); },
  };
  const started = wq.spirit.start();
  const again = wq.spirit.start();
  const ps = await started;
  if (started === again && wq.spirit.ready === started && ps === wq.spirit && wq.spirit.demo && typeof wq.spirit.require === 'function')
    test.check('on a page: spirit.start() binds the node\'s families on window.spirit, once; spirit.ready is that start');
  else test.fail('on a page: start answered ' + short([started === again, wq.spirit.ready === started, Object.keys(wq.spirit)]));
  const onPage = await wq.spirit.require(COMPONENT);
  if (onPage && typeof onPage.assertRelayUrl === 'function' && JSON.stringify(Object.keys(onPage).sort()) === JSON.stringify(Object.keys(inNode).sort()))
    test.check('on a page: the same require, ' + COMPONENT + ', answers the same exports as in node');
  else test.fail('on a page, ' + COMPONENT + ' answered ' + short(onPage && Object.keys(onPage)));
  if (await refusedWith(wq.spirit.require('spirit/noSuchComponent.js')) === 'not-found') test.check('on a page: a component that is not there refuses not-found');
  else test.fail('on a page: a missing component did not refuse not-found');
  const pf2 = await wq.spirit.require('process/js/demo/demo.family/api.js');
  const pfh = await pf2.hello({ name: 'hal' });
  if (wq.spirit.demo === pf2 && pfh.said === 'hello hal') test.check('on a page: an interface binds as spirit.<name> through api {family}');
  else test.fail('on a page: an interface answered ' + short(pfh));
  const pp = await wq.spirit.require('process/js/demo/demo.family/api.js', 'peerKey2');
  const ppa = await pp.demo.hello({ name: 'x' });
  if (pageAsked.indexOf('peer.post') !== -1 && ppa.said === 'hello page peer') test.check('on a page: with a key, the peer\'s family through the home node\'s peer.post');
  else test.fail('on a page: a peer\'s family answered ' + short(ppa));

  // ── 10. A MODULE THAT DOES NOT LOAD spirit.js FIRST GOES RED ─────────
  test.subHeading('10. a module that does not load spirit.js first goes red');
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
