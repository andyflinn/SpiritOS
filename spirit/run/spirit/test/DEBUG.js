'use strict';

// spirit/run/spirit/test/DEBUG.js
// The tests of spirit/DEBUG.js, and of no other module (spec: ./DEBUG.md; goal/G41.19): the DEBUG test routes, for node
// and relay alike. A scratch copy of the tracked files of spirit/run, a node and two relays of its own on free ports,
// asked over plain HTTP; Andy's node and an agent's are never touched.

const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const REPO = path.join(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(250); } return false; }
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

// One request, its path sent as it is (a ".." is not normalised away), to { status, type, text }.
function ask(host, port, p, opts) {
  const o = opts || {};
  return new Promise(function (resolve) {
    const rq = http.request({ host: host, port: port, path: p, method: o.method || 'GET', headers: o.headers || {} }, function (rs) {
      let text = '';
      rs.setEncoding('utf8');
      rs.on('data', function (d) { text += d; });
      rs.on('end', function () { resolve({ status: rs.statusCode, type: String(rs.headers['content-type'] || ''), text: text }); });
    });
    rq.on('error', function (e) { resolve({ status: 0, type: '', text: String(e && e.message) }); });
    rq.setTimeout(15000, function () { rq.destroy(new Error('timed out')); });
    if (o.body !== undefined) rq.write(o.body);
    rq.end();
  });
}
function call(port, verb, args) {
  return ask('127.0.0.1', port, '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
}
function json(r) { try { return JSON.parse(r.text); } catch (e) { return undefined; } }

// The scratch copy: the tracked files of spirit/run as they are in the working tree.
function scratchCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-debug-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  // deskVerify turned on, as its owner does: the server whose garbage is asked (GARBAGE, below).
  const state = path.join(root, 'spirit', 'run', 'spirit', 'state', 'deskVerify');
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'node.json'), JSON.stringify({ active: true }));
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
async function startNode(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const up = await until(function () { return call(port, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { port: port, child: child, up: up };
}
// A relay whose process has its spirit object switched on (debug) before the relay loads: a scratch relay has no owner
// to send its DEBUG verb.
async function startRelay(run, debug) {
  const port = await freePort();
  const code = 'require("./spirit/spirit.js").debug(' + (debug ? 'true' : 'false') + '); process.argv[1] = require("path").resolve("spirit/relayServer.js"); require("./spirit/relayServer.js");';
  const child = spawn(process.execPath, ['-e', code], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { PORT: String(port) }) });
  const up = await until(function () { return ask('127.0.0.1', port, '/').then(function (r) { return r.status > 0; }); }, 30000);
  return { port: port, child: child, up: up };
}
async function stop(server) { if (server && server.child) { try { server.child.kill(); } catch (e) { /* gone */ } await sleep(500); } }
function outsideAddress() {
  const all = os.networkInterfaces();
  for (const name of Object.keys(all)) for (const a of all[name] || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return '';
}

// EVERY TEST NAME STARTS WITH THE PATH (Andy: "please start the test descriptions always with the exact URL to the
// server, without \"/DEBUG\" service"; box v13: "EVERY MOTHERFUCKING TEST NAME in the product three STARTS WITH THE
// MUTHERCUCKING PATH"): each section is named by the address it asks, /DEBUG left off, or the file it reads.
function named(p) { return p.indexOf('/DEBUG/') === 0 ? p.slice('/DEBUG'.length) : p; }
const PAGE = '/DEBUG/spirit/element/workBench/headLessBrowser.html';
// A server whose api the node serves: deskVerify, an app of spirit/app/, turned on in the scratch copy (goal/G43.20: every
// server is an app, and none runs until its owner turns it on).
const GARBAGE = '/DEBUG/spirit/app/deskVerify/deskVerify/garbageArguments.json';

// THE GARBAGE ITSELF (goal/G41.30, the box v12): what the generator makes for one verb's request prototype, asked in
// memory of its make(), over a stand-in server whose api is that one verb. "EVERY ARGUMENT gets tested with EVERY
// javascript object type" (the box: "every type JSON.parse can make: string, number, boolean, null, object, array"),
// "PLUS: \"missing\" and \"extraneous\"", "every string argument is supplied in a few sizes, containing bad
// characters", and "Pairs, not every combination". Every entry breaks the shape (the gate's exact-key check,
// appServer.js matches, refuses it), or is a bad string alone: the shape kept, a string argument carrying a bad string,
// so the gate passes it to the handler (Andy, of the bad strings that travelled with an undeclared argument and never
// met a handler: "fill this gap, in this item").
const KINDS = ['string', 'number', 'boolean', 'null', 'object', 'array'];
function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
function fitsShape(proto, v) {
  if (proto !== null && typeof proto === 'object' && !Array.isArray(proto)) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const want = Object.keys(proto).sort();
    if (want.join('\n') !== Object.keys(v).sort().join('\n')) return false;
    return want.every(function (k) { return fitsShape(proto[k], v[k]); });
  }
  if (Array.isArray(proto)) return Array.isArray(v) && (proto.length === 0 || v.every(function (x) { return fitsShape(proto[0], x); }));
  if (proto === null) return v === null;
  return typeof v === typeof proto;
}
const PROTOS = [
  { a: '', b: 0 },
  { a: '', b: 0, c: true },
  { a: '', b: 0, c: true, d: [''] },
  { a: '', b: 0, c: true, d: [''], e: { x: '' } },
];
const P5 = PROTOS[3];

async function entries(proto) {
  const made = await gen.make({ ext: 'json', module: 'spirit/app/probe/probe', server: { kind: 'node', api: function () { return { probe: { verb: { request: proto, reply: {} } } }; } } });
  const list = made && typeof made.body === 'string' ? JSON.parse(made.body) : [];
  return list.filter(function (e) { return e && e.call === 'probe.verb' && !e.also; }).map(function (e) { return e.args; });
}

// For any two arguments, every pairing of their kinds (the six types and missing) appears in at least one entry; the one
// pairing left out is both arguments of their own type, which with nothing else wrong would be a call a handler acts on.
const PK = KINDS.concat(['missing']);
async function pairsMet(proto) {
  const list = (await entries(proto)).filter(function (a) { return a !== null && typeof a === 'object' && !Array.isArray(a); });
  const keys = Object.keys(proto);
  const of = function (a, k) { return Object.prototype.hasOwnProperty.call(a, k) ? kindOf(a[k]) : 'missing'; };
  const gaps = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (const x of PK) for (const y of PK) {
    if (x === kindOf(proto[keys[i]]) && y === kindOf(proto[keys[j]])) continue;
    if (!list.some(function (a) { return of(a, keys[i]) === x && of(a, keys[j]) === y; })) gaps.push(keys[i] + '=' + x + ' with ' + keys[j] + '=' + y);
  }
  return !gaps.length ? true : keys.length + ' arguments: ' + gaps.length + ' pairs never met, first ' + short(gaps.slice(0, 4));
}

// Every test's names, shared down the sequence: each test assigns what later ones read.
let gen, PAYLOAD_MAX, args5, plain, pairs0, pairs1, pairs2, pairs3, node, relay, pageR, pageTags, pageLoading, namedIn, wrong, lone, outside, far, STRING_KEYS, badString, badAlone, kindsOf, seen, lacking, strings, lens, big, sizes, alone, manifests, loaded, copy, N, off, none, offData, on, upNow, g, list, tree, verbs, unasked, sameShape, kept, keptCount, still, refused, PAGE_FILE, own, served, unfetched, rOff, rNone, R, loginPage, rg, rlist, fwd, ko, rd, uf;

test.run('every entry breaks the shape, or is a bad string alone in the shape kept', 0.2, async function () {
  gen = require(path.join(RUN, 'spirit', 'DEBUG', 'garbageArguments.js'));
  PAYLOAD_MAX = require(path.join(RUN, 'spirit', 'limits.js')).PAYLOAD_MAX;
  args5 = await entries(P5);
  plain = args5.filter(function (a) { return a !== null && typeof a === 'object' && !Array.isArray(a); });
  // The garbage itself, for one verb of five arguments (goal/G41.30).
  STRING_KEYS = Object.keys(P5).filter(function (k) { return typeof P5[k] === 'string'; });
  badString = function (x) { return typeof x === 'string' && (/[\u0000-\u001F]|[\uD800-\uDFFF]|\.\.\/|"[\s\S]*\\|\\[\s\S]*"/.test(x) || x.length > 1000); };
  badAlone = function (a) { return fitsShape(P5, a) && STRING_KEYS.some(function (k) { return badString(a[k]); }); };
  return (args5.length > 0 && args5.every(function (a) { return !fitsShape(P5, a) || badAlone(a); })) ? true : args5.length ? 'an entry fits the shape and carries no bad string, a call a handler could act on: ' + short(args5.filter(function (a) { return fitsShape(P5, a) && !badAlone(a); })[0]) : 'no garbage was made';
}, 1000);

// Each of the five arguments written out, so that each check has a plain title of its own.
test.run('argument a is filled with every type JSON.parse makes: string, number, boolean, null, object and array', 0.2, async function () {
  kindsOf = function (k) {
  seen = {}; plain.forEach(function (a) { if (Object.prototype.hasOwnProperty.call(a, k)) seen[kindOf(a[k])] = true; });
  lacking = KINDS.filter(function (t) { return !seen[t]; });
  return { lacking: lacking, left: plain.some(function (a) { return !Object.prototype.hasOwnProperty.call(a, k); }) };
  };
  ko = kindsOf('a');
  return (!ko.lacking.length) ? true : 'argument a is never a ' + ko.lacking.join(', ');
}, 1000);

test.run('argument a is left out ("missing")', 0.2, async function () {
  return (ko.left) ? true : 'no entry leaves argument a out';
}, 1000);

test.run('argument b is filled with every type JSON.parse makes: string, number, boolean, null, object and array', 0.2, async function () {
  ko = kindsOf('b');
  return (!ko.lacking.length) ? true : 'argument b is never a ' + ko.lacking.join(', ');
}, 1000);

test.run('argument b is left out ("missing")', 0.2, async function () {
  return (ko.left) ? true : 'no entry leaves argument b out';
}, 1000);

test.run('argument c is filled with every type JSON.parse makes: string, number, boolean, null, object and array', 0.2, async function () {
  ko = kindsOf('c');
  return (!ko.lacking.length) ? true : 'argument c is never a ' + ko.lacking.join(', ');
}, 1000);

test.run('argument c is left out ("missing")', 0.2, async function () {
  return (ko.left) ? true : 'no entry leaves argument c out';
}, 1000);

test.run('argument d is filled with every type JSON.parse makes: string, number, boolean, null, object and array', 0.2, async function () {
  ko = kindsOf('d');
  return (!ko.lacking.length) ? true : 'argument d is never a ' + ko.lacking.join(', ');
}, 1000);

test.run('argument d is left out ("missing")', 0.2, async function () {
  return (ko.left) ? true : 'no entry leaves argument d out';
}, 1000);

test.run('argument e is filled with every type JSON.parse makes: string, number, boolean, null, object and array', 0.2, async function () {
  ko = kindsOf('e');
  return (!ko.lacking.length) ? true : 'argument e is never a ' + ko.lacking.join(', ');
}, 1000);

test.run('argument e is left out ("missing")', 0.2, async function () {
  return (ko.left) ? true : 'no entry leaves argument e out';
}, 1000);

test.run('an argument the verb does not declare is added ("extraneous")', 0.2, async function () {
  return (plain.some(function (a) { return Object.keys(a).some(function (k) { return !Object.prototype.hasOwnProperty.call(P5, k); }); })) ? true : 'no entry carries an extraneous argument';
}, 1000);

// Every string argument, in a few sizes, containing bad characters (goal/G41.30).
test.run('the string argument a is supplied empty', 0.2, async function () {
  strings = plain.filter(function (a) { return typeof a.a === 'string'; }).map(function (a) { return a.a; });
  lens = strings.map(function (x) { return x.length; });
  big = Math.floor(PAYLOAD_MAX * 3 / 4);
  sizes = 'its string sizes: ' + short(lens.slice().sort(function (x, y) { return x - y; }));
  return (lens.some(function (n) { return n === 0; })) ? true : sizes;
}, 1000);

test.run('the string argument a is supplied as one character', 0.2, async function () {
  return (lens.some(function (n) { return n === 1; })) ? true : sizes;
}, 1000);

test.run('the string argument a is supplied in a mid size, 2 to 1000', 0.2, async function () {
  return (lens.some(function (n) { return n >= 2 && n <= 1000; })) ? true : sizes;
}, 1000);

test.run('the string argument a is supplied at about 3/4 of the payload, within a tenth', 0.2, async function () {
  return (lens.some(function (n) { return Math.abs(n - big) <= PAYLOAD_MAX / 10; })) ? true : sizes + ', wanted about ' + big + ' of PAYLOAD_MAX ' + PAYLOAD_MAX;
}, 1000);

test.run('the string argument a is supplied containing a NUL', 0.2, async function () {
  return (strings.some(function (x) { return /\u0000/.test(x); })) ? true : 'no string of argument a contains a NUL';
}, 1000);

test.run('the string argument a is supplied containing a lone surrogate', 0.2, async function () {
  return (strings.some(function (x) { return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(x); })) ? true : 'no string of argument a contains a lone surrogate';
}, 1000);

test.run('the string argument a is supplied containing control characters', 0.2, async function () {
  return (strings.some(function (x) { return /[\u0001-\u001F]/.test(x); })) ? true : 'no string of argument a contains control characters';
}, 1000);

test.run('the string argument a is supplied containing a quote and a backslash', 0.2, async function () {
  return (strings.some(function (x) { return /"[\s\S]*\\|\\[\s\S]*"/.test(x); })) ? true : 'no string of argument a contains a quote and a backslash';
}, 1000);

test.run('the string argument a is supplied containing a path piece, ../', 0.2, async function () {
  return (strings.some(function (x) { return /\.\.\//.test(x); })) ? true : 'no string of argument a contains a path piece, ../';
}, 1000);

// A bad string alone, so it reaches the handler (goal/G41.30; Andy: "fill this gap, in this item").
// The shape kept: every other argument of its declared type, no undeclared argument added. Then the gate passes it on,
// and the handler itself meets the bad string.
test.run('argument a carries a NUL alone, the shape kept, no undeclared argument', 0.2, async function () {
  alone = args5.filter(badAlone).map(function (a) { return a.a; });
  return (alone.some(function (x) { return typeof x === 'string' && /\u0000/.test(x); })) ? true : 'no entry keeps the shape with argument a carrying ' + 'a NUL' + ': the gate refuses every one before a handler sees it';
}, 1000);

test.run('argument a carries a lone surrogate alone, the shape kept, no undeclared argument', 0.2, async function () {
  return (alone.some(function (x) { return typeof x === 'string' && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(x); })) ? true : 'no entry keeps the shape with argument a carrying ' + 'a lone surrogate' + ': the gate refuses every one before a handler sees it';
}, 1000);

test.run('argument a carries control characters alone, the shape kept, no undeclared argument', 0.2, async function () {
  return (alone.some(function (x) { return typeof x === 'string' && /[\u0001-\u001F]/.test(x); })) ? true : 'no entry keeps the shape with argument a carrying ' + 'control characters' + ': the gate refuses every one before a handler sees it';
}, 1000);

test.run('argument a carries a quote and a backslash alone, the shape kept, no undeclared argument', 0.2, async function () {
  return (alone.some(function (x) { return typeof x === 'string' && /"[\s\S]*\\|\\[\s\S]*"/.test(x); })) ? true : 'no entry keeps the shape with argument a carrying ' + 'a quote and a backslash' + ': the gate refuses every one before a handler sees it';
}, 1000);

test.run('argument a carries a path piece, ../ alone, the shape kept, no undeclared argument', 0.2, async function () {
  return (alone.some(function (x) { return typeof x === 'string' && /\.\.\//.test(x); })) ? true : 'no entry keeps the shape with argument a carrying ' + 'a path piece, ../' + ': the gate refuses every one before a handler sees it';
}, 1000);

test.run('argument a carries a string of about 3/4 of the payload alone, the shape kept', 0.2, async function () {
  return (alone.some(function (x) { return typeof x === 'string' && Math.abs(x.length - big) <= PAYLOAD_MAX / 10; })) ? true : 'no entry keeps the shape with argument a about 3/4 of the payload long';
}, 1000);

// Pairs, not every combination (goal/G41.30).
// For any two arguments, every pairing of their kinds (the six types and missing) appears in at least one entry; the one
// pairing left out is both arguments of their own type, which with nothing else wrong would be a call a handler acts on.
test.run('two arguments: every pair of their kinds meets in at least one entry', 0.2, async function () {
  pairs0 = await pairsMet(PROTOS[0]);
  return (pairs0 === true) ? true : pairs0;
}, 1000);

test.run('three arguments: every pair of their kinds meets in at least one entry', 0.2, async function () {
  pairs1 = await pairsMet(PROTOS[1]);
  return (pairs1 === true) ? true : pairs1;
}, 1000);

test.run('four arguments: every pair of their kinds meets in at least one entry', 0.2, async function () {
  pairs2 = await pairsMet(PROTOS[2]);
  return (pairs2 === true) ? true : pairs2;
}, 1000);

test.run('five arguments: every pair of their kinds meets in at least one entry', 0.2, async function () {
  pairs3 = await pairsMet(PROTOS[3]);
  return (pairs3 === true) ? true : pairs3;
}, 1000);

test.run('and the garbage stays small: under 200 entries for five arguments, not every combination', 0.2, async function () {
  return (args5.length > 0 && args5.length < 200) ? true : 'five arguments make ' + args5.length + ' entries';
}, 1000);

// /spirit/DEBUG.js, /spirit/DEBUG/, /shell/mount.html: its files.
test.run('spirit/run/spirit/DEBUG.js is there', 0.2, async function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'DEBUG.js'))) ? true : 'spirit/run/spirit/DEBUG.js is not there';
}, 1000);

test.run('its generator script spirit/run/spirit/DEBUG/headLessBrowser.js is there', 0.2, async function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'DEBUG', 'headLessBrowser.js'))) ? true : 'spirit/run/spirit/DEBUG/headLessBrowser.js is not there';
}, 1000);

test.run('its generator script spirit/run/spirit/DEBUG/garbageArguments.js is there', 0.2, async function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'DEBUG', 'garbageArguments.js'))) ? true : 'spirit/run/spirit/DEBUG/garbageArguments.js is not there';
}, 1000);

test.run('shell/mount.html is gone: the page is made from the address', 0.2, async function () {
  return (!fs.existsSync(path.join(RUN, 'shell', 'mount.html'))) ? true : 'shell/mount.html is still there';
}, 1000);

// NO MOUNT FILES AT ALL (box v23: "no manifests at this point, because special cases can be handled by the elements
// own test script"): every element mounts with its container alone, so no <module>-headLessBrowser.json is left.
test.run('no mount file is left: every element mounts with its container alone', 0.2, async function () {
  manifests = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) { return /-headLessBrowser\.json$/.test(f) && fs.existsSync(path.join(REPO, f)); });
  return (!manifests.length) ? true : 'mount files still there: ' + short(manifests);
}, 1000);

// serveCommon requires it: loaded in a child, DEBUG.js is among the modules loaded.
test.run('serveCommon.js requires DEBUG.js', 0.2, async function () {
  loaded = '';
  try {
  // Started by its path as an argument, not through a shell: on Windows node lives under "Program Files".
  loaded = execFileSync(process.execPath, ['-e', 'require("./spirit/serveCommon.js"); console.log(Object.keys(require.cache).join("\\n"))'], { cwd: RUN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });
  } catch (e) { loaded = String(e.stdout || ''); }
  return (loaded.split('\n').some(function (f) { return path.resolve(f) === path.join(RUN, 'spirit', 'DEBUG.js'); })) ? true : 'serveCommon.js does not load DEBUG.js';
}, 1000);

test.run('the world: the scratch node comes up', 0.2, async function () {
  copy = scratchCopy();
  node = await startNode(copy.run);
  return (node.up) ? true : 'the scratch node did not come up: every check here would blame the wrong thing';
}, 4000);

test.run('on the node, DEBUG off, its DEBUG address answers as an address of no route', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  N = node.port;
  // PAGE, the node, DEBUG off.
  off = await ask('127.0.0.1', N, PAGE);
  none = await ask('127.0.0.1', N, PAGE.replace('/DEBUG/', '/NODEBUG/'));
  return (off.status === none.status && off.text === none.text) ? true : 'DEBUG off it answered ' + off.status + ' ' + short(off.text) + ', no route answers ' + none.status;
}, 1000);

test.run('and so does a garbage address', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  offData = await ask('127.0.0.1', N, GARBAGE);
  return (offData.status === none.status) ? true : 'DEBUG off the garbage address answered ' + offData.status;
}, 1000);

test.run('the scratch node\'s DEBUG is switched on, by node.debug', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  on = json(await call(N, 'node.debug', { debug: { on: true } }));
  return (on && on.debug === true) ? true : 'node.debug answered ' + short(on);
}, 1000);

// PAGE, the node, DEBUG on.
test.run('the node: the page is answered, 200, as HTML', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  pageR = await ask('127.0.0.1', N, PAGE);
  return (pageR.status === 200 && /text\/html/.test(pageR.type)) ? true : 'the node: it answered ' + pageR.status + ' ' + pageR.type + ' ' + short(pageR.text);
}, 1000);

test.run('the node: the page has no comments', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  return (pageR.status === 200 && pageR.text.indexOf('<!--') === -1) ? true : 'the node: the page has a comment, or is not answered';
}, 1000);

test.run('the node: one script tag loads a file, and it loads /spirit.js', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  pageTags = pageR.text.match(/<script\b[^>]*>/gi) || [];
  pageLoading = pageTags.filter(function (t) { return /\bsrc\s*=/.test(t); });
  return (pageR.status === 200 && pageLoading.length === 1 && /src\s*=\s*["']\/spirit\.js["']/.test(pageLoading[0])) ? true : 'the node: the script files it loads: ' + short(pageLoading);
}, 1000);

test.run('the node: /spirit.js comes before any other script', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  return (pageR.status === 200 && pageTags.length && /src\s*=\s*["']\/spirit\.js["']/.test(pageTags[0])) ? true : 'the node: its first script is ' + short(pageTags[0]);
}, 1000);

test.run('the node: it names the module it mounts, spirit/element/workBench', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  return (pageR.status === 200 && pageR.text.indexOf('spirit/element/workBench') !== -1) ? true : 'the node: spirit/element/workBench is not named in the page';
}, 1000);

// GARBAGE, the node, DEBUG on.
// deskVerify'S VERBS COME FROM ITS OWN SERVER (goal/G43.32, requirement 9: appServer loads the app's api.js), so its
// garbage is asked once the node's api names them, not while its server is still starting.
test.run('the world: the node\'s api names the deskVerify server\'s verbs', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  upNow = await until(function () { return call(N, 'api').then(function (r) { const t = json(r) || {}; return Object.keys(t.deskVerify || {}).length > 1; }); }, 30000);
  return (upNow) ? true : 'the deskVerify server never came up: nothing judged';
}, 1000);

test.run('the garbage is answered, 200, a JSON list', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  g = await ask('127.0.0.1', N, GARBAGE);
  list = json(g);
  return (g.status === 200 && /json/.test(g.type) && Array.isArray(list) && list.length > 0) ? true : 'it answered ' + g.status + ' ' + g.type + ' ' + short(g.text);
}, 1000);

test.run('the node\'s api lists the deskVerify server\'s verbs', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  tree = json(await call(N, 'api')) || {};
  verbs = Object.keys(tree.deskVerify || {});
  return (verbs.length > 0) ? true : 'the scratch node\'s api has no deskVerify: ' + short(Object.keys(tree));
}, 1000);

test.run('every verb of its api has garbage of its own', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  namedIn = function (v) { return Array.isArray(list) && list.some(function (e) { return e && typeof e === 'object' && e.call === 'deskVerify.' + v; }); };
  unasked = verbs.filter(function (v) { return !namedIn(v); });
  return (verbs.length && !unasked.length) ? true : 'verbs with no garbage: ' + short(unasked);
}, 1000);

// A LONE BAD STRING IS A REAL CALL (goal/G41.30; Andy: "fill this gap, in this item"; cw: "loadFile of the path
// \"x\" rightly answers 200 with nothing"): an entry that keeps its verb's shape whole is handed to the handler,
// which may answer it; its pass is the box's, "the server MUST not CRASH or HANG": answered, never a 5xx or a
// handler failed. An entry that breaks the shape is refused at the gate, a 4xx with a code.
test.run('each entry that breaks the shape is refused with a code: a 4xx, never accepted, a 5xx or a handler failed', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  sameShape = function (proto, v) {
    if (proto && typeof proto === 'object' && !Array.isArray(proto)) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      const a = Object.keys(proto).sort(), b = Object.keys(v).sort();
      return a.join('\n') === b.join('\n') && a.every(function (k) { return sameShape(proto[k], v[k]); });
    }
    if (Array.isArray(proto)) return Array.isArray(v);
    if (proto === null) return v === null;
    return typeof v === typeof proto;
  };
  kept = function (entry) { const verb = String(entry.call || '').replace(/^deskVerify\./, ''); const d = tree.deskVerify && tree.deskVerify[verb]; return !!d && sameShape(d.request, entry.args); };
  wrong = []; lone = [];
  keptCount = 0;
  for (const entry of (Array.isArray(list) ? list : [])) {
    const r = await ask('127.0.0.1', N, '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    const b = json(r);
    if (kept(entry)) {
      keptCount += 1;
      if (!r.status || r.status >= 500 || /handler-failed/.test(r.text)) lone.push({ entry: entry, status: r.status, answer: r.text.slice(0, 80) });
    } else if (!(r.status >= 400 && r.status < 500 && b && typeof b.code === 'string' && b.code && b.code !== 'handler-failed')) wrong.push({ entry: entry, status: r.status, answer: r.text.slice(0, 80) });
  }
  return (!wrong.length) ? true : wrong.length + ' were not: ' + short(wrong);
}, 5000);

test.run('each lone bad string, the shape kept, is answered by its handler: never a 5xx or a handler failed', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  return (keptCount > 0 && !lone.length) ? true : keptCount ? lone.length + ' broke it: ' + short(lone) : 'no entry keeps the shape: no lone bad string reached a handler, so nothing was judged';
}, 1000);

test.run('and the node still answers its api afterwards', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  still = await call(N, 'api');
  return (still.status === 200) ? true : 'afterwards its api answered ' + still.status;
}, 1000);

test.run('refused: no such module under spirit/run', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  refused = async function (p, headers, why) {
    const r = await ask('127.0.0.1', N, p, { headers: headers });
    return { fine: r.status >= 400 && r.status < 500, why: why + ': answered ' + r.status + ' ' + short(r.text.slice(0, 120)) };
  };
  rd = await refused('/DEBUG/spirit/element/noSuchModule/headLessBrowser.html', {}, 'no such module under spirit/run');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: a ".." in the address', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/spirit/element/../js/workBench/headLessBrowser.html', {}, 'a ".." in the address');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: no such generator script, and no such file', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/spirit/element/workBench/noSuchGenerator.html', {}, 'no such generator script, and no such file');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: a request carrying X-Forwarded-For', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused(PAGE, { 'X-Forwarded-For': '203.0.113.9' }, 'a request carrying X-Forwarded-For');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: a request carrying Forwarded', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused(PAGE, { 'Forwarded': 'for=203.0.113.9' }, 'a request carrying Forwarded');
  return (rd.fine) ? true : rd.why;
}, 1000);

// NO GENERATOR, THEN THE EXACT FILE OF THE ADDRESS, /DEBUG LEFT OFF (box v20-v23: "DEBUG.js will, if the generator
// implied by the URL does NOT exist, will attempt to serve the exact file implied by the URL"), and only a file
// inside a test/ folder: an element's own test pages, ./test/<element>-<case>.html.
test.run('a file inside a test/ folder is served as it is', 0.2, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  PAGE_FILE = 'spirit/element/test/workBench.md';
  own = fs.readFileSync(path.join(RUN, PAGE_FILE), 'utf8');
  // /PAGE_FILE, the node, DEBUG on: the file itself.
  served = await ask('127.0.0.1', N, '/DEBUG/' + PAGE_FILE);
  return (served.status === 200 && served.text === own) ? true : '/DEBUG/' + PAGE_FILE + ' answered ' + served.status + ' ' + short(served.text.slice(0, 120));
}, 1000);

test.run('refused: a file outside a test/ folder (the element\'s own script)', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/spirit/element/workBench.js', {}, 'a file outside a test/ folder (the element\'s own script)');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: a server script', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/spirit/serveCommon.js', {}, 'a server script');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: no such file in a test/ folder', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/spirit/element/test/noSuchPage.html', {}, 'no such file in a test/ folder');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('refused: a test file asked with X-Forwarded-For', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  rd = await refused('/DEBUG/' + PAGE_FILE, { 'X-Forwarded-For': '203.0.113.9' }, 'a test file asked with X-Forwarded-For');
  return (rd.fine) ? true : rd.why;
}, 1000);

test.run('/spirit/DEBUG.js cannot be fetched', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  unfetched = async function (p) {
    const r = await ask('127.0.0.1', N, p);
    return { fine: r.status >= 400, why: p + ' was fetched: ' + r.status };
  };
  uf = await unfetched('/spirit/DEBUG.js');
  return (uf.fine) ? true : uf.why;
}, 1000);

test.run('/spirit/DEBUG/headLessBrowser.js cannot be fetched', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  uf = await unfetched('/spirit/DEBUG/headLessBrowser.js');
  return (uf.fine) ? true : uf.why;
}, 1000);

test.run('/spirit/DEBUG/garbageArguments.js cannot be fetched', 0.8, async function () {
  if (!node || !node.up) return 'no scratch node: the world failed';
  uf = await unfetched('/spirit/DEBUG/garbageArguments.js');
  return (uf.fine) ? true : uf.why;
}, 1000);

test.run('the world: the scratch relay comes up, DEBUG off', 0.2, async function () {
  await stop(node); node = null;
  // A RELAY SERVES NO APP (goal/G43.18, box v29: the login is spirit.login, no app, and a relay serves a face spirit.js and the
  // seal alone), so its DEBUG answers are judged on its own api's garbage.
  // /spirit/relay/garbageArguments.json, a relay, DEBUG off.
  relay = await startRelay(copy.run, false);
  return (relay.up) ? true : 'the scratch relay did not come up';
}, 4000);

test.run('on the relay, DEBUG off, its DEBUG address answers as an address of no route', 0.8, async function () {
  if (!relay || !relay.up) return 'no scratch relay: the world failed';
  rOff = await ask('127.0.0.1', relay.port, '/DEBUG/spirit/relay/garbageArguments.json');
  rNone = await ask('127.0.0.1', relay.port, '/NODEBUG/spirit/relay/garbageArguments.json');
  return (rOff.status === rNone.status && rOff.text === rNone.text) ? true : 'DEBUG off the relay answered ' + rOff.status + ' ' + short(rOff.text);
}, 1000);

test.run('the world: the scratch relay comes up, DEBUG on', 0.2, async function () {
  await stop(relay); relay = null;
  relay = await startRelay(copy.run, true);
  return (relay.up) ? true : 'the scratch relay did not come up';
}, 3000);

test.run('the relay answers its own api\'s garbage, a JSON list', 0.2, async function () {
  if (!relay || !relay.up) return 'no scratch relay: the world failed';
  R = relay.port;
  loginPage = '/DEBUG/spirit/relay/garbageArguments.json';
  // /spirit/relay/garbageArguments.json, a relay, DEBUG on.
  rg = await ask('127.0.0.1', R, '/DEBUG/spirit/relay/garbageArguments.json');
  rlist = json(rg);
  return (rg.status === 200 && /json/.test(rg.type) && Array.isArray(rlist) && rlist.length > 0) ? true : 'it answered ' + rg.status + ' ' + rg.type + ' ' + short(rg.text);
}, 1000);

// loginPage, a relay, DEBUG on: refused.
test.run('refused: a request Caddy would pass on, carrying X-Forwarded-For', 0.8, async function () {
  if (!relay || !relay.up) return 'no scratch relay: the world failed';
  fwd = await ask('127.0.0.1', R, loginPage, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
  return (fwd.status >= 400 && fwd.status < 500) ? true : 'with X-Forwarded-For it answered ' + fwd.status;
}, 1000);

test.run('refused: a request not from loopback', 0.8, async function () {
  if (!relay || !relay.up) return 'no scratch relay: the world failed';
  outside = outsideAddress();
  far = outside ? await ask(outside, R, loginPage) : null;
  return (!!far && far.status >= 400 && far.status < 500) ? true : outside ? 'asked at ' + outside + ' it answered ' + far.status : 'this machine has no address but loopback: a request from outside cannot be tried';
}, 1000);

test.after(async function () {
  await stop(node); await stop(relay);
  try { if (copy) fs.rmSync(copy.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});
