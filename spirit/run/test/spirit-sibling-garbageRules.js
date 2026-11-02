'use strict';

// spirit/run/test/spirit-sibling-garbageRules.js
// THE ATTACKER'S GARBAGE, AT EVERY DOOR (goal/G41.30; spec: ./spirit-sibling-garbageRules.md). Andy, the box: "all
// servers (node and relay, or serveCommon) are tested by throwing malformed paths at them, and malformed, invalid
// arguments.", "all appServers are systematically tested for dealing with bad arguments.", "an appserver api can be
// called outside a spirit object, and an attacker trying to crash our servers will throw ANYTHING at the api. Imitate
// that attacker", and "what counts as passing: the server MUST not CRASH or HANG."
//
// HOW: a scratch copy of spirit/run on a node of its own (test/headLessChrome.js), its app servers turned on; neither
// Andy's node nor an agent's is touched. What the node says about itself (its api answer) names every family's verbs and
// the shape of their arguments; then garbage goes in raw, over HTTP and over a bare socket, never through spirit.js.

const fs = require('fs');
const net = require('net');
const path = require('path');
const RUN = path.join(__dirname, '..');
const test = require(path.join(__dirname, 'testReport.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const { sleep, scratchNode } = require(path.join(__dirname, 'headLessChrome.js'));

// The app servers turned on at home on the scratch node, as their owner turns them on (face.home).
const SERVERS = ['agent', 'desk', 'deskVerify', 'backup', 'chatClerver'];
// A throw is answered within this, or it hung; the plain call after a batch within PLAIN_MS.
const ASK_MS = 10000;
const PLAIN_MS = 3000;
const BATCH = 20;
// The node's door takes only a Host naming this machine and its port: set once the scratch node is up.
let HOST = '127.0.0.1';

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

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
// VERBS THAT ACT, as a word in their name says: given garbage only where the shape itself breaks (a wrong type), never a
// string into a string argument, an argument left out or one too many, which a lenient check could take as a real call.
const ACTS = /delete|remove|rotate|stop|cancel|revoke|forget|leave|block|create|run|fetch|post|command|join|claim|add|push|pull|fill|write|save|set|publish|grant|relabel|rename|label|accept|take|release|done|signoff|draft|version|record|acquire|annotate|bundle|branch|chores|pushgoal|status|debug|DEBUG|subscribe|receive|line\.|chat\.add|check\.|box\.|phase\.|item\.|goal\.|rule\.|block|work\.|agent\.state|policy|senders/;
const READS = /search|get|load|stat|exists|read|query|card|now|annotations|path|targets|may|files|checks|chat$|box$|suites|claims|peer$|status\.get|console|senders$/;

// The garbage for one verb: each argument varied alone, the others as the verb's own example (one at a time, the box:
// "pairs, not every combination", one argument being the first of them), plus whole bodies that are no object.
function garbageFor(name, request) {
  const proto = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  const keys = Object.keys(proto);
  const acts = ACTS.test(name) && !READS.test(name.split('.').pop());
  const out = [];
  const withOne = function (k, v, why) { const a = Object.assign({}, proto); a[k] = v; out.push({ args: a, why: k + ' ' + why }); };
  keys.forEach(function (k) {
    Object.keys(KINDS).forEach(function (kind) {
      if (kind === kindOf(proto[k])) return;
      withOne(k, KINDS[kind], 'as ' + kind);
    });
    if (!acts && typeof proto[k] === 'string') STRINGS.forEach(function (s, i) { withOne(k, s, 'as string #' + i + ' (' + s.length + ' chars)'); });
    if (!acts) { const a = Object.assign({}, proto); delete a[k]; out.push({ args: a, why: k + ' missing' }); }
  });
  if (!acts) { const a = Object.assign({}, proto); a.noSuchArgument = 'garbage'; out.push({ args: a, why: 'an extraneous argument' }); }
  // Arguments that are no object at all break every shape.
  ['garbage', 12345, null, [1, 2]].forEach(function (v) { out.push({ args: v, why: 'args as ' + kindOf(v) }); });
  return out;
}

// RAW OVER A BARE SOCKET: the request as written, nothing normalised. Answers { status, text } or { hung } or { error }.
function raw(base, head, body, opts) {
  const u = new URL(base);
  const o = opts || {};
  return new Promise(function (resolve) {
    let got = '';
    let done = false;
    const s = net.connect(Number(u.port), u.hostname);
    const finish = function (r) { if (done) return; done = true; s.destroy(); resolve(r); };
    const timer = setTimeout(function () { finish(got ? answer() : { hung: true }); }, o.ms || ASK_MS);
    function answer() { const m = /^HTTP\/1\.[01] (\d{3})/.exec(got); return { status: m ? Number(m[1]) : 0, text: got.slice(got.indexOf('\r\n\r\n') + 4, got.indexOf('\r\n\r\n') + 304) }; }
    // The socket stays open for the answer: a half-closed one may be dropped before an asynchronous verb answers. The
    // request says Connection: close, so the server ends it once it has answered.
    s.on('connect', function () { s.write(head); if (body) s.write(body); });
    s.on('data', function (d) { got += d.toString('latin1'); if (/\r\n\r\n/.test(got) && o.keepOpen) { clearTimeout(timer); finish(answer()); } });
    s.on('end', function () { clearTimeout(timer); finish(got ? answer() : { status: 0, text: '' }); });
    s.on('error', function (e) { clearTimeout(timer); finish(got ? answer() : { error: String(e && e.code || e) }); });
  });
}
function postHead(p, len, type) {
  return 'POST ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n' + (type === null ? '' : 'Content-Type: ' + (type || 'application/json') + '\r\n') + 'Content-Length: ' + len + '\r\n\r\n';
}
function call(base, body) {
  const b = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return raw(base, postHead('/api/spirit', b.length), b);
}
// A crash or a hang, as the box says it: no answer, a server error, or a handler that failed.
function broke(r) {
  if (!r || r.hung) return 'it hung: no answer in ' + (ASK_MS / 1000) + ' s';
  if (r.error) return 'the connection failed: ' + r.error;
  if (!r.status) return 'no status line';
  // A 502 or 503 that says why (a relay or a peer not reachable on a scratch node) is an answer; a 500, a 504 (its own
  // time ran out) or a 5xx saying nothing is the server breaking.
  if (r.status >= 500 && !((r.status === 502 || r.status === 503) && /"(code|error)"\s*:/.test(r.text))) return 'it answered ' + r.status + ': ' + short(r.text);
  if (/handler-failed|the handler failed/.test(r.text)) return 'the handler failed: ' + short(r.text);
  return '';
}

test.startTest('spirit-sibling-garbageRules.js: the attacker\'s garbage at every door (goal/G41.30)');

(async function () {
  const node = await scratchNode({ servers: SERVERS });
  try {
    if (!node.up) { test.fail('the scratch node did not come up: every check here would blame the wrong thing'); return; }
    const base = node.base;
    HOST = new URL(base).host;
    const plain = async function () { const r = await raw(base, postHead('/api/spirit', 24), '{"call":"api","args":{}}', { ms: PLAIN_MS }); return r && r.status === 200; };
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
    tree = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
    if (!tree || typeof tree !== 'object') { test.fail('the node\'s api answer could not be read: nothing to introspect'); return; }
    const missingServers = SERVERS.filter(function (s) { return !tree[s]; });
    test.comment('families: ' + Object.keys(tree).join(', ') + (missingServers.length ? '; not up: ' + missingServers.join(', ') : ''));

    // 1) EVERY VERB, BAD ARGUMENTS (the box, rule 3 and "bad arguments").
    const asks = [];
    Object.keys(tree).forEach(function (fam) {
      Object.keys(tree[fam] || {}).forEach(function (verb) {
        const name = fam + '.' + verb;
        garbageFor(name, tree[fam][verb] && tree[fam][verb].request).forEach(function (g) { asks.push({ name: name, args: g.args, why: g.why }); });
      });
    });
    // 2) RAW BODIES AT THE NODE'S DOOR (the box, rule 2: "malformed, invalid arguments").
    const BODY_MAX = limits.BODY_MAX;
    const deepJson = '{"call":"node.card","args":' + '['.repeat(5000) + ']'.repeat(5000) + '}';
    const RAWS = [
      { why: 'a body that is not JSON', head: null, type: undefined, body: 'not json!' },
      { why: 'JSON that is not an object', head: null, type: undefined, body: '[1,2,3]' },
      { why: 'a bare JSON string', head: null, type: undefined, body: '"string"' },
      { why: 'JSON null', head: null, type: undefined, body: 'null' },
      { why: 'a body cut off half-way', head: postHead('/api/spirit', 100), body: '{"call":"node.ca', keepOpen: true },
      { why: 'a body one byte past BODY_MAX (' + (BODY_MAX + 1) + ')', head: postHead('/api/spirit', BODY_MAX + 1), body: '{"call":"node.card","args":{"x":"' + 'x'.repeat(BODY_MAX + 1 - 36) + '"}}' },
      { why: 'a Content-Length far past what is sent', head: postHead('/api/spirit', 10000000), body: '{}' , keepOpen: true },
      { why: 'deep nesting, 5000 levels', head: postHead('/api/spirit', Buffer.byteLength(deepJson)), body: deepJson },
      { why: 'a __proto__ key', head: null, type: undefined, body: '{"call":"node.card","args":{"__proto__":{"admin":1}}}' },
      { why: 'a constructor key', head: null, type: undefined, body: '{"call":"node.card","args":{"constructor":{"x":1}}}' },
      { why: 'call as __proto__', head: null, type: undefined, body: '{"call":"__proto__","args":{}}' },
      { why: 'call as constructor.prototype', head: null, type: undefined, body: '{"call":"constructor.prototype","args":{}}' },
      { why: 'no Content-Type', head: null, type: null, body: '{"call":"api","args":{}}' },
      { why: 'Content-Type text/plain', head: null, type: 'text/plain', body: '{"call":"api","args":{}}' },
      { why: 'Content-Type multipart with no boundary', head: null, type: 'multipart/form-data', body: '{"call":"api","args":{}}' },
      { why: 'invalid UTF-8 bytes', head: null, type: undefined, body: Buffer.from([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d]) },
      { why: 'a request line that is not HTTP', head: 'GARBAGE /api/spirit NOPE\r\n\r\n', body: '' },
      { why: 'a header line with no colon', head: 'POST /api/spirit HTTP/1.1\r\nHost 127.0.0.1\r\nContent-Length: 2\r\n\r\n', body: '{}' },
    ];
    // 3) MALFORMED PATHS, GET AND POST (the box, rule 2: "malformed paths").
    const PATHS = ['/..', '/../../../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/shell/%2f%2f..%2f..%2fetc', 
      '/' + 'a'.repeat(9000), '/%', '/%zz', '/%E0%A4%A', '/api/%2e%2e/spirit', '//api//spirit', '/DEBUG/../../relay-state/node.json',
      '/shell/js/../../../relay-state/identity.json', '/api/spirit/../../relay-state/node.json', '/\\..\\..\\relay-state', '/?%', '/#x', '*',
      // A null byte last: it may kill the node, and every path before it is still thrown.
      '/%00', '/index.html%00.js'];
    PATHS.forEach(function (p) {
      RAWS.push({ why: 'GET ' + short(p).slice(0, 60), head: 'GET ' + p + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n', body: '' });
      RAWS.push({ why: 'POST ' + short(p).slice(0, 60), head: postHead(p, 2), body: '{}' });
    });
    test.comment('it will make ' + asks.length + ' asks of bad arguments over ' + Object.keys(tree).length + ' families, and ' + RAWS.length + ' raw requests, each batch of ' + BATCH + ' followed by a plain call');

    // THROWN, BATCH BY BATCH: each ask judged; after each batch the node answers a plain call within PLAIN_MS.
    const broken = {};   // name -> [why]
    const hungAfter = [];
    let refused = 0; let answered = 0; const statuses = {}; const sample = {}; const mislabelled = {}; const tookIt = {};
    const t0 = Date.now();
    for (let i = 0; i < asks.length; i += BATCH) {
      const batch = asks.slice(i, i + BATCH);
      const got = await Promise.all(batch.map(function (a) { return call(base, { call: a.name, args: a.args }); }));
      got.forEach(function (r, j) {
        const a = batch[j];
        const why = broke(r);
        if ((r.status === 502 || r.status === 503) && !why) mislabelled[a.name] = (mislabelled[a.name] || 0) + 1;
        statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1; if (!sample[r.status]) sample[r.status] = a.name + ' ' + a.why + ' -> ' + short(r.text).slice(0, 120);
        if (why) (broken[a.name] = broken[a.name] || []).push(a.why + ': ' + why);
        else if (r.status === 200 && !/"ok":false/.test(r.text)) { answered++; const fam = a.name.split('.')[0]; tookIt[fam] = (tookIt[fam] || 0) + 1; } else refused++;
      });
      if (!(await plain())) hungAfter.push(batch.map(function (a) { return a.name; }).filter(function (n, k, l) { return l.indexOf(n) === k; }).join(', '));
    }
    test.comment('bad arguments: ' + refused + ' refused, ' + answered + ' answered (a lenient verb may take garbage as a real call), in ' + Math.round((Date.now() - t0) / 1000) + ' s; by status ' + JSON.stringify(statuses));
    // Not a crash, so not red by the box's words; said, since a bad argument is no outage: 400 would name it.
    test.comment('garbage answered 200, by family (a lenient check, not a crash): ' + JSON.stringify(tookIt));
    if (Object.keys(mislabelled).length) test.comment('bad arguments answered 502 or 503 with a reason, not 400: ' + JSON.stringify(mislabelled));
    Object.keys(sample).forEach(function (st) { test.comment('a ' + st + ': ' + sample[st]); });
    test.subHeading('/api/spirit: every verb takes bad arguments without crashing or hanging');
    Object.keys(tree).forEach(function (fam) {
      Object.keys(tree[fam] || {}).forEach(function (verb) {
        const name = fam + '.' + verb;
        const b = broken[name];
        if (b) test.fail('/api/spirit ' + name + ': ' + b.length + ' crashed or hung, first: ' + b[0]);
      });
    });
    const okVerbs = Object.keys(tree).reduce(function (n, f) { return n + Object.keys(tree[f] || {}).filter(function (v) { return !broken[f + '.' + v]; }).length; }, 0);
    test.check(okVerbs + ' verbs took all their garbage without crashing or hanging');
    if (hungAfter.length) test.fail('/api/spirit: after ' + hungAfter.length + ' batches the node did not answer a plain call within ' + (PLAIN_MS / 1000) + ' s, first after: ' + short(hungAfter[0]));
    else test.check('/api/spirit: after every batch the node answered a plain call within ' + (PLAIN_MS / 1000) + ' s');

    test.subHeading('the node\'s door: raw requests and malformed paths');
    let killer = ''; const notThrown = [];
    for (const r0 of RAWS) {
      if (killer) { notThrown.push(r0.why); continue; }
      const head = r0.head || postHead('/api/spirit', Buffer.byteLength(r0.body || ''), r0.type);
      const r = await raw(base, head, r0.body, { keepOpen: r0.keepOpen });
      // A body cut off, or longer than it says, is left waiting by any server until its own time runs out: the node may
      // hold it, but it must still answer everybody else.
      let why = r0.keepOpen && r.hung ? '' : broke(r);
      let alive = await plain();
      if (!alive) { await sleep(500); alive = await plain(); }
      if (!alive) why = (why ? why + '; ' : '') + 'the node then did not answer a plain call within ' + (PLAIN_MS / 1000) + ' s';
      if (node.child && node.child.exitCode !== null && !killer) { killer = r0.why; why = 'IT KILLED THE NODE (exit ' + node.child.exitCode + ')'; }
      if (why) test.fail('the node\'s door, ' + r0.why + ': ' + why);
      else test.check(r0.why + ': answered ' + (r.status || 'later') + ', and the node still answers');
    }

    if (notThrown.length) test.fail('the node\'s door: ' + notThrown.length + ' requests not thrown, the node died at ' + killer + ': ' + short(notThrown));
    test.subHeading('the node is still running at the end');
    ok(node.child && node.child.exitCode === null && await plain(), 'the scratch node is still running and answers', 'the scratch node ' + (node.child && node.child.exitCode !== null ? 'exited with ' + node.child.exitCode : 'does not answer'));
    // RELAY: owed, see the spec.
    test.comment('the relay\'s door is not thrown at yet: owed, see spirit-sibling-garbageRules.md');
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    if (node.root) try { fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
