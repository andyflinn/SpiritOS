'use strict';

// spirit/run/spirit/test/server.js
// The tests of spirit/server.js, in this one file (spec: ./server.md). Its sections: the attacker's garbage at every door
// of a node (goal/G41.30), after its own. goal/G43.30: "/" is the face. Andy: "can we delete run://shell/,
// run://spirit/shell/index.html, and make face.html the default for "/" ???"; the box: "In spirit/server.js, the home page
// is face.html." A scratch node of its own (spirit/test/headLessChrome.js); its "/" asked over HTTP and opened in a real Chrome.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FACE = path.join(RUN, 'spirit', 'shell', 'face.html');
const net = require('net');
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const { sleep, scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));


// What the tests share: the scratch node of "/" and its Chrome page, then the garbage's nodes, made by "the world:" tests.
const W = { node: null, page: null, face: '', r: null, body: '', ready: false };
function letGo(node, page) {
  if (page && page.kid) { try { page.kid.kill(); } catch (e) { /* gone */ } }
  if (node && node.child) { try { node.child.kill(); } catch (e) { /* gone */ } }
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (node && node.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(node); } catch (e) { /* left */ }
}

// "/" answers face.html, byte for byte
test.run('the world: a scratch node comes up', 0.2, async function () {
  W.node = await H.scratchNode();
  W.face = fs.readFileSync(FACE, 'utf8');
  return W.node.up || false;
}, test.limit.slow);
test.run('"/" answers 200', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  W.r = await fetch(W.node.base + '/');
  W.body = await W.r.text();
  return W.r.status === 200 || false;
}, test.limit.quick);
test.run('as text/html', 0.2, function () {
  if (!W.r) return false;
  return /^text\/html/.test(String(W.r.headers.get('content-type'))) || false;
}, test.limit.quick);
test.run('its body is spirit/shell/face.html as it stands on the disc', 0.2, function () {
  if (!W.r) return false;
  return W.body === W.face || false;
}, test.limit.quick);

// opened in a real Chrome, "/" is the face: the spirit object, ready
test.run('the world: a Chrome page opens at "/"', 0.2, async function () {
  if (!W.node || !W.node.up) return false;
  const chrome = H.findChrome();
  if (!chrome) return false;
  W.page = await H.chromePage(chrome);
  if (!W.page || W.page.error) return false;
  await W.page.send('Page.navigate', { url: W.node.base + '/' });
  return true;
}, test.limit.quick);
test.run('the page at "/" has the spirit object', 0.2, async function () {
  if (!W.page || W.page.error) return false;
  W.ready = await H.until(function () { return W.page.evaluate('!!(window.spirit && window.spirit.ready)').then(Boolean); }, H.WAIT);
  return !!W.ready || false;
}, test.limit.long);
test.run('and spirit.ready settles, as on face.html', 0.2, async function () {
  if (!W.ready) return false;
  const settled = await W.page.evaluate('window.spirit.ready.then(function () { return "ready"; }, function () { return false; })');
  return settled === 'ready' || false;
}, test.limit.quick);
test.run('it loads face.html\'s own scripts first', 0.2, async function () {
  if (!W.page || W.page.error) return false;
  const scripts = JSON.parse(await W.page.evaluate('JSON.stringify(Array.prototype.map.call(document.scripts, function (s) { return s.getAttribute("src") || ""; }).filter(Boolean))'));
  const faceScripts = (W.face.match(/src="([^"]*)"/g) || []).map(function (m) { return m.slice(5, -1); });
  return JSON.stringify(scripts.slice(0, faceScripts.length)) === JSON.stringify(faceScripts) || false;
}, test.limit.quick);

// ── THE GARBAGE PART ──
// THE ATTACKER'S GARBAGE, AT EVERY DOOR (goal/G41.30; spec: ./server.md, its section). Andy, the box: "all
// servers (node and relay, or serveCommon) are tested by throwing malformed paths at them, and malformed, invalid
// arguments.", "all appServers are systematically tested for dealing with bad arguments.", "an appserver api can be
// called outside a spirit object, and an attacker trying to crash our servers will throw ANYTHING at the api. Imitate
// that attacker", and "what counts as passing: the server MUST not CRASH or HANG."
//
// HOW: a scratch copy of spirit/run on a node of its own (spirit/test/headLessChrome.js), its app servers turned on; neither
// Andy's node nor an agent's is touched. What the node says about itself (its api answer) names every family's verbs and
// the shape of their arguments; then garbage goes in raw, over HTTP and over a bare socket, never through spirit.js.

// The app servers turned on on the scratch node, by active in spirit/state/<name>/node.json, which scratchNode writes for
// each (goal/G43.12, G43.20).
const SERVERS = ['agent', 'desk', 'backup', 'chat'];
// A throw is answered within this, or it hung; the plain call after a batch within PLAIN_MS.
const ASK_MS = 10000;
const PLAIN_MS = 3000;
const BATCH = 20;
// The node's door takes only a Host naming this machine and its port: set once the scratch node is up.
let HOST = '127.0.0.1';

// THE KINDS (the box: "every argument is filled with every type JSON.parse can make: string, number, boolean, null,
// object, array", "missing or superfluous arguments"): the six JSON types, missing, extraneous.
const KINDS = {
  string: 'garbage', number: 12345, boolean: true, null: null, object: { garbage: 1 }, array: [1, 'x', null],
};
function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
// STRINGS IN A FEW SIZES, CONTAINING BAD CHARACTERS (the box): empty, one byte, control and odd characters, a path that
// climbs, a lone surrogate, and long ones near and at 3/4 of the payload.
const STRINGS = [
  '', 'x', '\u0000', '../../../../etc/passwd', '%2e%2e%2f%00', '\ud800', '‮\u0007\r\n\t', '<script>x</script>',
  '__proto__', 'x'.repeat(1024), '😀'.repeat(1000), 'x'.repeat(Math.floor(limits.PAYLOAD_MAX * 3 / 4)),
];
// VERBS THAT ACT, as a word in their name says (Andy, G41.30: "A verb that acts (deletes, rotates, stops, sends) gets
// only garbage that breaks the shape ... never meets a bad string. - fill this gap"): they get the whole garbage too, bad
// strings, missing and extraneous included, with their real handlers, on a throwaway scratch node of their own, so what
// they delete, rotate or stop spoils nothing the rest of the run stands on.
const ACTS = /delete|remove|rotate|stop|cancel|revoke|forget|leave|block|create|run|fetch|post|command|join|claim|add|push|pull|fill|write|save|set|publish|grant|relabel|rename|label|accept|take|release|done|signoff|draft|version|record|acquire|annotate|bundle|branch|chores|pushgoal|status|debug|DEBUG|subscribe|receive|line\.|chat\.add|check\.|box\.|phase\.|item\.|goal\.|rule\.|block|work\.|agent\.state|policy|senders/;
const READS = /search|get|load|stat|exists|read|query|card|now|annotations|path|targets|may|files|checks|chat$|box$|suites|claims|peer$|status\.get|console|senders$/;

// The garbage for one verb: each argument varied alone, the others as the verb's own example (one at a time, the box:
// "pairs, not every combination", one argument being the first of them), plus whole bodies that are no object.
function acting(name) { return ACTS.test(name) && !READS.test(name.split('.').pop()); }
function garbageFor(name, request) {
  const proto = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  const keys = Object.keys(proto);
  const acts = false;
  const out = [];
  const withOne = function (k, v) { const a = Object.assign({}, proto); a[k] = v; out.push({ args: a }); };
  keys.forEach(function (k) {
    Object.keys(KINDS).forEach(function (kind) {
      if (kind === kindOf(proto[k])) return;
      withOne(k, KINDS[kind]);
    });
    if (!acts && typeof proto[k] === 'string') STRINGS.forEach(function (s) { withOne(k, s); });
    if (!acts) { const a = Object.assign({}, proto); delete a[k]; out.push({ args: a }); }
  });
  if (!acts) { const a = Object.assign({}, proto); a.noSuchArgument = 'garbage'; out.push({ args: a }); }
  // Arguments that are no object at all break every shape.
  ['garbage', 12345, null, [1, 2]].forEach(function (v) { out.push({ args: v }); });
  return out.concat(pairsFor(proto));
}

// PAIRS, OVER THE WIRE (the box: "Pairs, not every combination"; Andy, G41.30: "Pairs run against the gate in memory, not
// over the wire. - close this gap!"). Eight kinds an argument can be given: a bad string, the five other JSON types, left
// out, or kept with an extraneous argument beside it. For a verb of two arguments or more, a set of asks such that, for
// any two of its arguments, every pair of their kinds is in at least one ask: made greedily, the first uncovered pair
// seeding each ask and every other argument given the kind that covers most pairs not yet covered.
const KIND8 = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing', 'extraneous'];
function pairRows(n) {
  const K = KIND8.length;
  const open = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) open.add(i + ',' + j + ',' + a + ',' + b);
  const rows = [];
  while (open.size) {
    const first = open.values().next().value.split(',').map(Number);
    const row = new Array(n).fill(-1);
    row[first[0]] = first[2]; row[first[1]] = first[3];
    for (let k = 0; k < n; k++) {
      if (row[k] !== -1) continue;
      let best = 0; let bestGain = -1;
      for (let v = 0; v < K; v++) {
        let gain = 0;
        for (let m = 0; m < n; m++) {
          if (m === k || row[m] === -1) continue;
          const key = m < k ? m + ',' + k + ',' + row[m] + ',' + v : k + ',' + m + ',' + v + ',' + row[m];
          if (open.has(key)) gain++;
        }
        if (gain > bestGain) { bestGain = gain; best = v; }
      }
      row[k] = best;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) open.delete(i + ',' + j + ',' + row[i] + ',' + row[j]);
    rows.push(row);
  }
  return rows;
}
function pairsFor(proto) {
  const keys = Object.keys(proto);
  if (keys.length < 2) return [];
  return pairRows(keys.length).map(function (row, r) {
    const a = Object.assign({}, proto);
    keys.forEach(function (k, i) {
      const kind = KIND8[row[i]];
      if (kind === 'missing') delete a[k];
      else if (kind === 'extraneous') a[k + 'Extraneous'] = 'garbage';
      else if (kind === 'string') a[k] = STRINGS[(r + i) % STRINGS.length];
      else a[k] = KINDS[kind];
    });
    return { args: a, pair: true };
  });
}

// RAW OVER A BARE SOCKET: the request as written, nothing normalised. Answers { status, text } or { hung } or { error: true }.
function raw(base, head, body, opts) {
  const u = new URL(base);
  const o = opts || {};
  return new Promise(function (resolve) {
    let got = '';
    let done = false;
    const s = net.connect(Number(u.port), u.hostname);
    const finish = function (r) { if (done) return; done = true; s.destroy(); resolve(r); };
    const timer = setTimeout(function () { finish(got ? answer() : { hung: true }); }, o.ms || ASK_MS);
    // The answer's body, a chunked one's first chunk without its size line.
    function answer() { const m = /^HTTP\/1\.[01] (\d{3})/.exec(got); const at = got.indexOf('\r\n\r\n') + 4; let body = got.slice(at, at + 400); if (/\r\ntransfer-encoding:\s*chunked/i.test(got.slice(0, at))) body = body.replace(/^[0-9a-fA-F]+\r\n/, ''); return { status: m ? Number(m[1]) : 0, text: body.slice(0, 300) }; }
    // The socket stays open for the answer: a half-closed one may be dropped before an asynchronous verb answers. The
    // request says Connection: close, so the server ends it once it has answered.
    s.on('connect', function () { s.write(head); if (body) s.write(body); });
    s.on('data', function (d) { got += d.toString('latin1'); if (/\r\n\r\n/.test(got) && o.keepOpen) { clearTimeout(timer); finish(answer()); } });
    s.on('end', function () { clearTimeout(timer); finish(got ? answer() : { status: 0, text: '' }); });
    s.on('error', function (e) { clearTimeout(timer); finish(got ? answer() : { error: true }); });
  });
}
function postHead(p, len, type) {
  return 'POST ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n' + (type === null ? '' : 'Content-Type: ' + (type || 'application/json') + '\r\n') + 'Content-Length: ' + len + '\r\n\r\n';
}
function call(base, body) {
  const b = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return raw(base, postHead('/api/spirit', b.length), b);
}
// A crash or a hang, as the box says it: no answer, a server error, or a handler that failed. true when it broke.
function broke(r) {
  if (!r || r.hung) return true;
  if (r.error) return true;
  if (!r.status) return true;
  // A 502 or 503 that says why (a relay or a peer not reachable on a scratch node) is an answer; a 500, a 504 (its own
  // time ran out) or a 5xx saying nothing is the server breaking.
  if (r.status >= 500 && !((r.status === 502 || r.status === 503) && /"(code|error)"\s*:/.test(r.text))) return true;
  if (/handler-failed|the handler failed/.test(r.text)) return true;
  return false;
}

// garbage: the attacker's garbage at every door (goal/G41.30)

// A scratch node up, its app servers named in its api: answers { node, base, plain } or null.
async function upNode() {
  const node = await scratchNode({ servers: SERVERS });
  if (!node.up) return { node: node, base: '', plain: null };
  const base = node.base;
  const host = new URL(base).host;
  const plain = async function () { const r = await raw(base, 'POST /api/spirit HTTP/1.1\r\nHost: ' + host + '\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: 24\r\n\r\n', '{"call":"api","args":{}}', { ms: PLAIN_MS }); return r && r.status === 200; };
  let t = null;
  for (let i = 0; i < 60; i++) {
    t = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
    if (t && SERVERS.every(function (s) { return t[s]; })) break;
    await sleep(500);
  }
  // A SERVER NOT UP JUDGES NOTHING: its verbs would answer "no such verb", which is no crash, and pass on nothing. So
  // every server it turned on must be in the api answer, or the run says which is not.
  const missing = SERVERS.filter(function (s) { return !(t && t[s]); });
  return { node: node, base: base, plain: plain, missing: missing };
}
const G = { node: null, base: '', plain: null, tree: null, asks: [], RAWS: [], readingAsks: [], actingAsks: [], actingVerbs: [], killer: false, made: [] };
test.run('the world: the garbage\'s scratch node comes up, every app server it turned on named in its api', 0.2, async function () {
  // The node and the page of "/" are let go first.
  letGo(W.node, W.page); W.node = null; W.page = null;
  const node = G.node = await scratchNode({ servers: SERVERS });
  if (!node.up) return false;
  const base = G.base = node.base;
  HOST = new URL(base).host;
  G.plain = async function () { const r = await raw(base, postHead('/api/spirit', 24), '{"call":"api","args":{}}', { ms: PLAIN_MS }); return r && r.status === 200; };
  // Its app servers come up after the node: wait until the api names them.
  let tree = null;
  for (let i = 0; i < 60; i++) {
    const r = await call(base, { call: 'api', args: {} });
    try { tree = JSON.parse(r.text.trim() ? r.text : '{}'); } catch (e) { tree = null; }
    if (!tree || !r.status) { await sleep(500); continue; }
    if (SERVERS.every(function (s) { return tree[s]; })) break;
    await sleep(500);
  }
  // The api answer can be longer than the first 300 bytes kept: ask it whole once.
  tree = G.tree = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
  if (!tree || typeof tree !== 'object') { G.tree = null; return false; }
  // 1) EVERY VERB, BAD ARGUMENTS (the box, rule 3 and "bad arguments").
  Object.keys(tree).forEach(function (fam) {
    Object.keys(tree[fam] || {}).forEach(function (verb) {
      const name = fam + '.' + verb;
      garbageFor(name, tree[fam][verb] && tree[fam][verb].request).forEach(function (g) { G.asks.push({ name: name, args: g.args, pair: !!g.pair, acts: acting(name) }); });
    });
  });
  // 2) RAW BODIES AT THE NODE'S DOOR (the box, rule 2: "malformed, invalid arguments").
  const BODY_MAX = limits.BODY_MAX;
  const deepJson = '{"call":"node.card","args":' + '['.repeat(5000) + ']'.repeat(5000) + '}';
  const RAWS = G.RAWS = [
    { head: null, type: undefined, body: 'not json!' },
    { head: null, type: undefined, body: '[1,2,3]' },
    { head: null, type: undefined, body: '"string"' },
    { head: null, type: undefined, body: 'null' },
    { head: postHead('/api/spirit', 100), body: '{"call":"node.ca', keepOpen: true },
    { head: postHead('/api/spirit', BODY_MAX + 1), body: '{"call":"node.card","args":{"x":"' + 'x'.repeat(BODY_MAX + 1 - 36) + '"}}' },
    { head: postHead('/api/spirit', 10000000), body: '{}' , keepOpen: true },
    { head: postHead('/api/spirit', Buffer.byteLength(deepJson)), body: deepJson },
    { head: null, type: undefined, body: '{"call":"node.card","args":{"__proto__":{"admin":1}}}' },
    { head: null, type: undefined, body: '{"call":"node.card","args":{"constructor":{"x":1}}}' },
    { head: null, type: undefined, body: '{"call":"__proto__","args":{}}' },
    { head: null, type: undefined, body: '{"call":"constructor.prototype","args":{}}' },
    { head: null, type: null, body: '{"call":"api","args":{}}' },
    { head: null, type: 'text/plain', body: '{"call":"api","args":{}}' },
    { head: null, type: 'multipart/form-data', body: '{"call":"api","args":{}}' },
    { head: null, type: undefined, body: Buffer.from([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d]) },
    { head: 'GARBAGE /api/spirit NOPE\r\n\r\n', body: '' },
    { head: 'POST /api/spirit HTTP/1.1\r\nHost 127.0.0.1\r\nContent-Length: 2\r\n\r\n', body: '{}' },
  ];
  // 3) MALFORMED PATHS, GET AND POST (the box, rule 2: "malformed paths").
  const PATHS = ['/..', '/../../../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/shell/%2f%2f..%2f..%2fetc', 
    '/' + 'a'.repeat(9000), '/%', '/%zz', '/%E0%A4%A', '/api/%2e%2e/spirit', '//api//spirit', '/DEBUG/../../spirit/state/node.json',
    '/spirit/element/../../../spirit/state/identity.json', '/api/spirit/../../spirit/state/node.json', '/\\..\\..\\relay-state', '/?%', '/#x', '*',
    // A null byte last: it may kill the node, and every path before it is still thrown.
    '/%00', '/index.html%00.js'];
  PATHS.forEach(function (p) {
    RAWS.push({ head: 'GET ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n', body: '' });
    RAWS.push({ head: postHead(p, 2), body: '{}' });
  });
  G.actingAsks = G.asks.filter(function (a) { return a.acts; });
  G.readingAsks = G.asks.filter(function (a) { return !a.acts; });
  G.actingVerbs = G.actingAsks.map(function (a) { return a.name; }).filter(function (n, k, l) { return l.indexOf(n) === k; });
  const missingServers = SERVERS.filter(function (s) { return !tree[s]; });
  return !missingServers.length || false;
}, test.limit.long);

// THROWN, BATCH BY BATCH: each ask judged; after each batch the node answers a plain call within PLAIN_MS.
const hungAfter = [];
let thrown = false;
// /api/spirit: every verb takes bad arguments without crashing or hanging
test.run('the verbs that do not act took all their garbage, pairs included, without crashing or hanging', 0.2, async function () {
  if (!G.tree) return false;
  const broken = {};   // name -> true, when it broke
  let refused = 0; let answered = 0; const statuses = {}; const mislabelled = {}; const tookIt = {};
  const t0 = Date.now();
  for (let i = 0; i < G.readingAsks.length; i += BATCH) {
    const batch = G.readingAsks.slice(i, i + BATCH);
    const got = await Promise.all(batch.map(function (a) { return call(G.base, { call: a.name, args: a.args }); }));
    got.forEach(function (r, j) {
      const a = batch[j];
      const why = broke(r);
      if ((r.status === 502 || r.status === 503) && !why) mislabelled[a.name] = (mislabelled[a.name] || 0) + 1;
      statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1;
      if (why) broken[a.name] = true;
      else if (r.status === 200 && !/"ok":false/.test(r.text)) { answered++; const fam = a.name.split('.')[0]; tookIt[fam] = (tookIt[fam] || 0) + 1; } else refused++;
    });
    if (!(await G.plain())) hungAfter.push(i);
  }
  thrown = true;
  return Object.keys(broken).length === 0;
}, test.limit.slow);
test.run('/api/spirit: after every batch the node answered a plain call in time', 0.2, function () {
  if (!thrown) return false;
  return hungAfter.length === 0;
}, test.limit.quick);

// the node's door: raw requests and malformed paths
// Each request written out, in the order thrown, so that each check has a plain title of its own. A request is thrown by
// its own test; once one killed the node, the ones after it are not thrown, and say so.
async function door(ri) {
  if (!G.tree) return false;
  const r0 = G.RAWS[ri];
  if (G.killer) return false;
  const node = G.node;
  const head = r0.head || postHead('/api/spirit', Buffer.byteLength(r0.body || ''), r0.type);
  const r = await raw(G.base, head, r0.body, { keepOpen: r0.keepOpen });
  // A body cut off, or longer than it says, is left waiting by any server until its own time runs out: the node may
  // hold it, but it must still answer everybody else.
  let why = r0.keepOpen && r.hung ? false : broke(r);
  let alive = await G.plain();
  if (!alive) { await sleep(500); alive = await G.plain(); }
  if (!alive) why = true;
  if (node.child && node.child.exitCode !== null && !G.killer) { G.killer = true; why = true; }
  return !why;
}
test.run('a body that is not JSON: answered, and the node still answers', 0.2, function () { return door(0); }, test.limit.slow);
test.run('JSON that is not an object: answered, and the node still answers', 0.2, function () { return door(1); }, test.limit.slow);
test.run('a bare JSON string: answered, and the node still answers', 0.2, function () { return door(2); }, test.limit.slow);
test.run('JSON null: answered, and the node still answers', 0.2, function () { return door(3); }, test.limit.slow);
test.run('a body cut off half-way: answered, and the node still answers', 0.2, function () { return door(4); }, test.limit.long);
test.run('a body one byte past BODY_MAX: answered, and the node still answers', 0.2, function () { return door(5); }, test.limit.slow);
test.run('a Content-Length far past what is sent: answered, and the node still answers', 0.2, function () { return door(6); }, test.limit.long);
test.run('deep nesting, 5000 levels: answered, and the node still answers', 0.2, function () { return door(7); }, test.limit.slow);
test.run('a __proto__ key: answered, and the node still answers', 0.2, function () { return door(8); }, test.limit.slow);
test.run('a constructor key: answered, and the node still answers', 0.2, function () { return door(9); }, test.limit.slow);
test.run('call as __proto__: answered, and the node still answers', 0.2, function () { return door(10); }, test.limit.slow);
test.run('call as constructor.prototype: answered, and the node still answers', 0.2, function () { return door(11); }, test.limit.slow);
test.run('no Content-Type: answered, and the node still answers', 0.2, function () { return door(12); }, test.limit.slow);
test.run('Content-Type text/plain: answered, and the node still answers', 0.2, function () { return door(13); }, test.limit.slow);
test.run('Content-Type multipart with no boundary: answered, and the node still answers', 0.2, function () { return door(14); }, test.limit.slow);
test.run('invalid UTF-8 bytes: answered, and the node still answers', 0.2, function () { return door(15); }, test.limit.slow);
test.run('a request line that is not HTTP: answered, and the node still answers', 0.2, function () { return door(16); }, test.limit.slow);
test.run('a header line with no colon: answered, and the node still answers', 0.2, function () { return door(17); }, test.limit.slow);
test.run('GET /..: answered, and the node still answers', 0.2, function () { return door(18); }, test.limit.slow);
test.run('POST /..: answered, and the node still answers', 0.2, function () { return door(19); }, test.limit.slow);
test.run('GET /../../../../etc/passwd: answered, and the node still answers', 0.2, function () { return door(20); }, test.limit.slow);
test.run('POST /../../../../etc/passwd: answered, and the node still answers', 0.2, function () { return door(21); }, test.limit.slow);
test.run('GET /%2e%2e/%2e%2e/etc/passwd: answered, and the node still answers', 0.2, function () { return door(22); }, test.limit.slow);
test.run('POST /%2e%2e/%2e%2e/etc/passwd: answered, and the node still answers', 0.2, function () { return door(23); }, test.limit.slow);
test.run('GET /shell/%2f%2f..%2f..%2fetc: answered, and the node still answers', 0.2, function () { return door(24); }, test.limit.slow);
test.run('POST /shell/%2f%2f..%2f..%2fetc: answered, and the node still answers', 0.2, function () { return door(25); }, test.limit.slow);
test.run('GET a path of 9001 letters: answered, and the node still answers', 0.2, function () { return door(26); }, test.limit.slow);
test.run('POST a path of 9001 letters: answered, and the node still answers', 0.2, function () { return door(27); }, test.limit.slow);
test.run('GET /%: answered, and the node still answers', 0.2, function () { return door(28); }, test.limit.slow);
test.run('POST /%: answered, and the node still answers', 0.2, function () { return door(29); }, test.limit.slow);
test.run('GET /%zz: answered, and the node still answers', 0.2, function () { return door(30); }, test.limit.slow);
test.run('POST /%zz: answered, and the node still answers', 0.2, function () { return door(31); }, test.limit.slow);
test.run('GET /%E0%A4%A: answered, and the node still answers', 0.2, function () { return door(32); }, test.limit.slow);
test.run('POST /%E0%A4%A: answered, and the node still answers', 0.2, function () { return door(33); }, test.limit.slow);
test.run('GET /api/%2e%2e/spirit: answered, and the node still answers', 0.2, function () { return door(34); }, test.limit.slow);
test.run('POST /api/%2e%2e/spirit: answered, and the node still answers', 0.2, function () { return door(35); }, test.limit.slow);
test.run('GET //api//spirit: answered, and the node still answers', 0.2, function () { return door(36); }, test.limit.slow);
test.run('POST //api//spirit: answered, and the node still answers', 0.2, function () { return door(37); }, test.limit.slow);
test.run('GET /DEBUG/../../spirit/state/node.json: answered, and the node still answers', 0.2, function () { return door(38); }, test.limit.slow);
test.run('POST /DEBUG/../../spirit/state/node.json: answered, and the node still answers', 0.2, function () { return door(39); }, test.limit.slow);
test.run('GET /spirit/element/../../../spirit/state/identity.json: answered, and the node still answers', 0.2, function () { return door(40); }, test.limit.slow);
test.run('POST /spirit/element/../../../spirit/state/identity.json: answered, and the node still answers', 0.2, function () { return door(41); }, test.limit.slow);
test.run('GET /api/spirit/../../spirit/state/node.json: answered, and the node still answers', 0.2, function () { return door(42); }, test.limit.slow);
test.run('POST /api/spirit/../../spirit/state/node.json: answered, and the node still answers', 0.2, function () { return door(43); }, test.limit.slow);
test.run('GET /\\..\\..\\relay-state: answered, and the node still answers', 0.2, function () { return door(44); }, test.limit.slow);
test.run('POST /\\..\\..\\relay-state: answered, and the node still answers', 0.2, function () { return door(45); }, test.limit.slow);
test.run('GET /?%: answered, and the node still answers', 0.2, function () { return door(46); }, test.limit.slow);
test.run('POST /?%: answered, and the node still answers', 0.2, function () { return door(47); }, test.limit.slow);
test.run('GET /#x: answered, and the node still answers', 0.2, function () { return door(48); }, test.limit.slow);
test.run('POST /#x: answered, and the node still answers', 0.2, function () { return door(49); }, test.limit.slow);
test.run('GET *: answered, and the node still answers', 0.2, function () { return door(50); }, test.limit.slow);
test.run('POST *: answered, and the node still answers', 0.2, function () { return door(51); }, test.limit.slow);
test.run('GET /%00: answered, and the node still answers', 0.2, function () { return door(52); }, test.limit.slow);
test.run('POST /%00: answered, and the node still answers', 0.2, function () { return door(53); }, test.limit.slow);
test.run('GET /index.html%00.js: answered, and the node still answers', 0.2, function () { return door(54); }, test.limit.slow);
test.run('POST /index.html%00.js: answered, and the node still answers', 0.2, function () { return door(55); }, test.limit.slow);

// the node is still running at the end
test.run('the scratch node is still running and answers', 0.2, async function () {
  if (!G.tree) return false;
  const node = G.node;
  return (node.child && node.child.exitCode === null && await G.plain()) || false;
}, test.limit.slow);

// THE VERBS THAT ACT, ON A THROWAWAY NODE OF THEIR OWN: node A is let go first. Verb by verb, each verb's garbage in
// batches, a plain call after each; a node that dies is judged and replaced by a fresh one, so the next verb is judged
// on a living node.
// /api/spirit: every verb that acts takes the whole garbage, on a throwaway node, without crashing or hanging
let B = null;
test.run('the world: the throwaway node for the verbs that act comes up, every app server it turned on named in its api', 0.2, async function () {
  if (!G.tree) return false;
  try { if (G.node.child) G.node.child.kill(); } catch (e) { /* gone */ }
  B = await upNode(); G.made.push(B.node);
  if (!B.plain) return false;
  HOST = new URL(B.base).host;
  return !B.missing.length || false;
}, test.limit.long);
test.run('the verbs that act took the whole garbage, bad strings, missing, extraneous and pairs, without crashing or hanging', 0.2, async function () {
  if (!B || !B.plain) return false;
  const actingAsks = G.actingAsks; const actingVerbs = G.actingVerbs;
  const broken = {}; const killedBy = []; const fresh = []; let n = 0; const t0 = Date.now();
  for (const name of actingVerbs) {
    const mine = actingAsks.filter(function (a) { return a.name === name; });
    for (let i = 0; i < mine.length; i += BATCH) {
      const batch = mine.slice(i, i + BATCH);
      const got = await Promise.all(batch.map(function (a) { return call(B.base, { call: a.name, args: a.args }); }));
      n += batch.length;
      got.forEach(function (r) { if (broke(r)) broken[name] = true; });
      let alive = await B.plain();
      if (!alive) { await sleep(500); alive = await B.plain(); }
      if (!alive) {
        broken[name] = true;
        killedBy.push(name);
        try { if (B.node.child) B.node.child.kill(); } catch (e) { /* gone */ }
        B = await upNode(); G.made.push(B.node);
        if (!B.plain) return false;
        if (B.missing.length) fresh.push(name);
        HOST = new URL(B.base).host;
        break;
      }
    }
  }
  // THE RELAY'S DOOR is thrown at by relayGarbage.js now; the comment line below, saying it is owed, is stale.
  const bad = actingVerbs.filter(function (name) { return broken[name]; });
  const fine = actingVerbs.length - bad.length;
  if (fine <= 0) return false;
  return !(bad.length || fresh.length);
}, test.limit.long);

test.after(function () {
  letGo(W.node, W.page);
  if (G.node) letGo(G.node, null);
  G.made.forEach(function (b) { letGo(b, null); });
});
