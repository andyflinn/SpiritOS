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
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
  const code = 'require("./spirit.js").debug(' + (debug ? 'true' : 'false') + '); process.argv[1] = require("path").resolve("spirit/relayServer.js"); require("./spirit/relayServer.js");';
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
const GARBAGE = '/DEBUG/process/js/fileServer/fileServer/garbageArguments.json';

// What a page must be: the most minimal page for one module.
function judgePage(r, module, where) {
  ok(r.status === 200 && /text\/html/.test(r.type), where + ': the page is answered, 200, as HTML', where + ': it answered ' + r.status + ' ' + r.type + ' ' + short(r.text));
  if (r.status !== 200) return;
  ok(r.text.indexOf('<!--') === -1, where + ': the page has no comments', where + ': the page has a comment');
  const tags = r.text.match(/<script\b[^>]*>/gi) || [];
  const loading = tags.filter(function (t) { return /\bsrc\s*=/.test(t); });
  ok(loading.length === 1 && /src\s*=\s*["']\/spirit\.js["']/.test(loading[0]), where + ': one script tag loads a file, and it loads /spirit.js', where + ': the script files it loads: ' + short(loading));
  ok(tags.length && /src\s*=\s*["']\/spirit\.js["']/.test(tags[0]), where + ': /spirit.js comes before any other script', where + ': its first script is ' + short(tags[0]));
  ok(r.text.indexOf(module) !== -1, where + ': it names the module it mounts, ' + module, where + ': ' + module + ' is not named in the page');
}

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
async function garbageRules(gen, PAYLOAD_MAX) {
  async function entries(proto) {
    const made = await gen.make({ ext: 'json', module: 'process/js/probe', server: { kind: 'node', api: function () { return { probe: { verb: { request: proto, reply: {} } } }; } } });
    const list = made && typeof made.body === 'string' ? JSON.parse(made.body) : [];
    return list.filter(function (e) { return e && e.call === 'probe.verb' && !e.also; }).map(function (e) { return e.args; });
  }
  const PROTOS = [
    { a: '', b: 0 },
    { a: '', b: 0, c: true },
    { a: '', b: 0, c: true, d: [''] },
    { a: '', b: 0, c: true, d: [''], e: { x: '' } },
  ];
  const P5 = PROTOS[3];
  const args5 = await entries(P5);
  const plain = args5.filter(function (a) { return a !== null && typeof a === 'object' && !Array.isArray(a); });
  test.subHeading('the garbage itself, for one verb of five arguments ' + JSON.stringify(P5) + ' (goal/G41.30)');
  const STRING_KEYS = Object.keys(P5).filter(function (k) { return typeof P5[k] === 'string'; });
  const badString = function (x) { return typeof x === 'string' && (/[\u0000-\u001F]|[\uD800-\uDFFF]|\.\.\/|"[\s\S]*\\|\\[\s\S]*"/.test(x) || x.length > 1000); };
  const badAlone = function (a) { return fitsShape(P5, a) && STRING_KEYS.some(function (k) { return badString(a[k]); }); };
  ok(args5.length > 0 && args5.every(function (a) { return !fitsShape(P5, a) || badAlone(a); }), 'every entry breaks the shape, or is a bad string alone in the shape kept (' + args5.length + ' entries)',
    args5.length ? 'an entry fits the shape and carries no bad string, a call a handler could act on: ' + short(args5.filter(function (a) { return fitsShape(P5, a) && !badAlone(a); })[0]) : 'no garbage was made');
  Object.keys(P5).forEach(function (k) {
    const seen = {}; plain.forEach(function (a) { if (Object.prototype.hasOwnProperty.call(a, k)) seen[kindOf(a[k])] = true; });
    const lacking = KINDS.filter(function (t) { return !seen[t]; });
    ok(!lacking.length, 'argument ' + k + ' is filled with every type JSON.parse makes: ' + KINDS.join(', '), 'argument ' + k + ' is never a ' + lacking.join(', '));
    ok(plain.some(function (a) { return !Object.prototype.hasOwnProperty.call(a, k); }), 'argument ' + k + ' is left out ("missing")', 'no entry leaves argument ' + k + ' out');
  });
  ok(plain.some(function (a) { return Object.keys(a).some(function (k) { return !Object.prototype.hasOwnProperty.call(P5, k); }); }), 'an argument the verb does not declare is added ("extraneous")', 'no entry carries an extraneous argument');
  test.subHeading('every string argument, in a few sizes, containing bad characters (goal/G41.30)');
  const strings = plain.filter(function (a) { return typeof a.a === 'string'; }).map(function (a) { return a.a; });
  const lens = strings.map(function (x) { return x.length; });
  const big = Math.floor(PAYLOAD_MAX * 3 / 4);
  [['empty', function (n) { return n === 0; }], ['one character', function (n) { return n === 1; }], ['a mid size, 2 to 1000', function (n) { return n >= 2 && n <= 1000; }],
    ['about 3/4 of the payload (' + big + ' of PAYLOAD_MAX ' + PAYLOAD_MAX + ', within a tenth)', function (n) { return Math.abs(n - big) <= PAYLOAD_MAX / 10; }]].forEach(function (c) {
    ok(lens.some(c[1]), 'the string argument a is supplied ' + c[0], 'its string sizes: ' + short(lens.slice().sort(function (x, y) { return x - y; })));
  });
  [['a NUL', /\u0000/], ['a lone surrogate', /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/], ['control characters', /[\u0001-\u001F]/],
    ['a quote and a backslash', /"[\s\S]*\\|\\[\s\S]*"/], ['a path piece, ../', /\.\.\//]].forEach(function (c) {
    ok(strings.some(function (x) { return c[1].test(x); }), 'the string argument a is supplied containing ' + c[0], 'no string of argument a contains ' + c[0]);
  });
  test.subHeading('a bad string alone, so it reaches the handler (goal/G41.30; Andy: "fill this gap, in this item")');
  // The shape kept: every other argument of its declared type, no undeclared argument added. Then the gate passes it on,
  // and the handler itself meets the bad string.
  const alone = args5.filter(badAlone).map(function (a) { return a.a; });
  [['a NUL', /\u0000/], ['a lone surrogate', /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/], ['control characters', /[\u0001-\u001F]/],
    ['a quote and a backslash', /"[\s\S]*\\|\\[\s\S]*"/], ['a path piece, ../', /\.\.\//]].forEach(function (c) {
    ok(alone.some(function (x) { return typeof x === 'string' && c[1].test(x); }), 'argument a carries ' + c[0] + ' alone, the shape kept, no undeclared argument', 'no entry keeps the shape with argument a carrying ' + c[0] + ': the gate refuses every one before a handler sees it');
  });
  ok(alone.some(function (x) { return typeof x === 'string' && Math.abs(x.length - big) <= PAYLOAD_MAX / 10; }), 'argument a carries a string of about 3/4 of the payload alone, the shape kept', 'no entry keeps the shape with argument a about 3/4 of the payload long');
  test.subHeading('pairs, not every combination (goal/G41.30)');
  // For any two arguments, every pairing of their kinds (the six types and missing) appears in at least one entry; the one
  // pairing left out is both arguments of their own type, which with nothing else wrong would be a call a handler acts on.
  const PK = KINDS.concat(['missing']);
  for (const proto of PROTOS) {
    const list = (await entries(proto)).filter(function (a) { return a !== null && typeof a === 'object' && !Array.isArray(a); });
    const keys = Object.keys(proto);
    const of = function (a, k) { return Object.prototype.hasOwnProperty.call(a, k) ? kindOf(a[k]) : 'missing'; };
    const gaps = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (const x of PK) for (const y of PK) {
      if (x === kindOf(proto[keys[i]]) && y === kindOf(proto[keys[j]])) continue;
      if (!list.some(function (a) { return of(a, keys[i]) === x && of(a, keys[j]) === y; })) gaps.push(keys[i] + '=' + x + ' with ' + keys[j] + '=' + y);
    }
    ok(!gaps.length, keys.length + ' arguments: every pair of their kinds meets in at least one entry', keys.length + ' arguments: ' + gaps.length + ' pairs never met, first ' + short(gaps.slice(0, 4)));
  }
  ok(args5.length > 0 && args5.length < 200, 'and the garbage stays small: ' + args5.length + ' entries for five arguments, under 200, not every combination', 'five arguments make ' + args5.length + ' entries');
}

test.startTest('/spirit/DEBUG.js: the DEBUG test routes, for node and relay alike');

(async function () {
  await garbageRules(require(path.join(RUN, 'spirit', 'DEBUG', 'garbageArguments.js')), require(path.join(RUN, 'spirit', 'limits.js')).PAYLOAD_MAX);
  test.subHeading('/spirit/DEBUG.js, /spirit/DEBUG/, /shell/mount.html: its files');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'DEBUG.js')), 'spirit/run/spirit/DEBUG.js is there', 'spirit/run/spirit/DEBUG.js is not there');
  ['headLessBrowser', 'garbageArguments'].forEach(function (g) {
    ok(fs.existsSync(path.join(RUN, 'spirit', 'DEBUG', g + '.js')), 'its generator script spirit/run/spirit/DEBUG/' + g + '.js is there', 'spirit/run/spirit/DEBUG/' + g + '.js is not there');
  });
  ok(!fs.existsSync(path.join(RUN, 'shell', 'mount.html')), 'shell/mount.html is gone: the page is made from the address', 'shell/mount.html is still there');
  // NO MOUNT FILES AT ALL (box v23: "no manifests at this point, because special cases can be handled by the elements
  // own test script"): every element mounts with its container alone, so no <module>-headLessBrowser.json is left.
  const manifests = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) { return /-headLessBrowser\.json$/.test(f) && fs.existsSync(path.join(REPO, f)); });
  ok(!manifests.length, 'no mount file is left: every element mounts with its container alone', 'mount files still there: ' + short(manifests));
  // serveCommon requires it: loaded in a child, DEBUG.js is among the modules loaded.
  let loaded = '';
  try {
    // Started by its path as an argument, not through a shell: on Windows node lives under "Program Files".
    loaded = execFileSync(process.execPath, ['-e', 'require("./spirit/serveCommon.js"); console.log(Object.keys(require.cache).join("\\n"))'], { cwd: RUN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });
  } catch (e) { loaded = String(e.stdout || ''); }
  ok(loaded.split('\n').some(function (f) { return path.resolve(f) === path.join(RUN, 'spirit', 'DEBUG.js'); }), 'serveCommon.js requires DEBUG.js', 'serveCommon.js does not load DEBUG.js');

  const copy = scratchCopy();
  let node = null; let relay = null;
  try {
    node = await startNode(copy.run);
    if (!node.up) { test.fail('the scratch node did not come up: every check here would blame the wrong thing'); return; }
    const N = node.port;

    test.subHeading(named(PAGE) + ', the node, DEBUG off');
    const off = await ask('127.0.0.1', N, PAGE);
    const none = await ask('127.0.0.1', N, PAGE.replace('/DEBUG/', '/NODEBUG/'));
    ok(off.status === none.status && off.text === none.text, 'its DEBUG address answers as an address of no route (' + none.status + ')', 'DEBUG off it answered ' + off.status + ' ' + short(off.text));
    const offData = await ask('127.0.0.1', N, GARBAGE);
    ok(offData.status === none.status, 'and so does a garbage address', 'DEBUG off the garbage address answered ' + offData.status);

    const on = json(await call(N, 'node.debug', { debug: { on: true } }));
    ok(on && on.debug === true, 'the scratch node\'s DEBUG is switched on, by node.debug', 'node.debug answered ' + short(on));

    test.subHeading(named(PAGE) + ', the node, DEBUG on');
    judgePage(await ask('127.0.0.1', N, PAGE), 'spirit/element/workBench', 'the node');

    test.subHeading(named(GARBAGE) + ', the node, DEBUG on');
    const g = await ask('127.0.0.1', N, GARBAGE);
    const list = json(g);
    ok(g.status === 200 && /json/.test(g.type) && Array.isArray(list) && list.length > 0, 'the garbage is answered, 200, a JSON list of ' + (Array.isArray(list) ? list.length : 0), 'it answered ' + g.status + ' ' + g.type + ' ' + short(g.text));
    const tree = json(await call(N, 'api')) || {};
    const verbs = Object.keys(tree.fileServer || {});
    ok(verbs.length > 0, 'the node\'s api lists the file server\'s ' + verbs.length + ' verbs', 'the scratch node\'s api has no fileServer: ' + short(Object.keys(tree)));
    if (Array.isArray(list) && list.length) {
      const named = function (v) { return list.some(function (e) { return e && typeof e === 'object' && e.call === 'fileServer.' + v; }); };
      const unasked = verbs.filter(function (v) { return !named(v); });
      ok(verbs.length && !unasked.length, 'every verb of its api has garbage of its own', 'verbs with no garbage: ' + short(unasked));
      // A LONE BAD STRING IS A REAL CALL (goal/G41.30; Andy: "fill this gap, in this item"; cw: "loadFile of the path
      // \"x\" rightly answers 200 with nothing"): an entry that keeps its verb's shape whole is handed to the handler,
      // which may answer it; its pass is the box's, "the server MUST not CRASH or HANG": answered, never a 5xx or a
      // handler failed. An entry that breaks the shape is refused at the gate, a 4xx with a code.
      const sameShape = function (proto, v) {
        if (proto && typeof proto === 'object' && !Array.isArray(proto)) {
          if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
          const a = Object.keys(proto).sort(), b = Object.keys(v).sort();
          return a.join('\n') === b.join('\n') && a.every(function (k) { return sameShape(proto[k], v[k]); });
        }
        if (Array.isArray(proto)) return Array.isArray(v);
        if (proto === null) return v === null;
        return typeof v === typeof proto;
      };
      const kept = function (entry) { const verb = String(entry.call || '').replace(/^fileServer\./, ''); const d = tree.fileServer && tree.fileServer[verb]; return !!d && sameShape(d.request, entry.args); };
      const wrong = []; const lone = [];
      let keptCount = 0;
      for (const entry of list) {
        const r = await ask('127.0.0.1', N, '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
        const b = json(r);
        if (kept(entry)) {
          keptCount += 1;
          if (!r.status || r.status >= 500 || /handler-failed/.test(r.text)) lone.push({ entry: entry, status: r.status, answer: r.text.slice(0, 80) });
        } else if (!(r.status >= 400 && r.status < 500 && b && typeof b.code === 'string' && b.code && b.code !== 'handler-failed')) wrong.push({ entry: entry, status: r.status, answer: r.text.slice(0, 80) });
      }
      ok(!wrong.length, 'each of the ' + (list.length - keptCount) + ' that break the shape is refused with a code: a 4xx, never accepted, a 5xx or a handler failed', wrong.length + ' were not: ' + short(wrong));
      ok(keptCount > 0 && !lone.length, 'each of the ' + keptCount + ' lone bad strings, the shape kept, is answered by its handler: never a 5xx or a handler failed', keptCount ? lone.length + ' broke it: ' + short(lone) : 'no entry keeps the shape: no lone bad string reached a handler, so nothing was judged');
      const still = await call(N, 'api');
      ok(still.status === 200, 'and the node still answers its api afterwards', 'afterwards its api answered ' + still.status);
    }

    const refused = async function (p, headers, why) {
      test.subHeading(named(p) + ', the node, DEBUG on: refused, ' + why);
      const r = await ask('127.0.0.1', N, p, { headers: headers });
      ok(r.status >= 400 && r.status < 500, 'refused: ' + why, why + ': answered ' + r.status + ' ' + short(r.text.slice(0, 120)));
    };
    await refused('/DEBUG/spirit/element/noSuchModule/headLessBrowser.html', {}, 'no such module under spirit/run');
    await refused('/DEBUG/spirit/element/../js/workBench/headLessBrowser.html', {}, 'a ".." in the address');
    await refused('/DEBUG/spirit/element/workBench/noSuchGenerator.html', {}, 'no such generator script, and no such file');
    await refused(PAGE, { 'X-Forwarded-For': '203.0.113.9' }, 'a request carrying X-Forwarded-For');
    await refused(PAGE, { 'Forwarded': 'for=203.0.113.9' }, 'a request carrying Forwarded');
    // NO GENERATOR, THEN THE EXACT FILE OF THE ADDRESS, /DEBUG LEFT OFF (box v20-v23: "DEBUG.js will, if the generator
    // implied by the URL does NOT exist, will attempt to serve the exact file implied by the URL"), and only a file
    // inside a test/ folder: an element's own test pages, ./test/<element>-<case>.html.
    const PAGE_FILE = 'spirit/element/test/workBench.md';
    const own = fs.readFileSync(path.join(RUN, PAGE_FILE), 'utf8');
    test.subHeading('/' + PAGE_FILE + ', the node, DEBUG on: the file itself');
    const served = await ask('127.0.0.1', N, '/DEBUG/' + PAGE_FILE);
    ok(served.status === 200 && served.text === own, 'a file inside a test/ folder is served as it is', '/DEBUG/' + PAGE_FILE + ' answered ' + served.status + ' ' + short(served.text.slice(0, 120)));
    await refused('/DEBUG/spirit/element/workBench.js', {}, 'a file outside a test/ folder (the element\'s own script)');
    await refused('/DEBUG/spirit/serveCommon.js', {}, 'a server script');
    await refused('/DEBUG/spirit/element/test/noSuchPage.html', {}, 'no such file in a test/ folder');
    await refused('/DEBUG/' + PAGE_FILE, { 'X-Forwarded-For': '203.0.113.9' }, 'a test file asked with X-Forwarded-For');
    for (const p of ['/spirit/DEBUG.js', '/spirit/DEBUG/headLessBrowser.js', '/spirit/DEBUG/garbageArguments.js']) {
      test.subHeading(p + ', the node, DEBUG on');
      const r = await ask('127.0.0.1', N, p);
      ok(r.status >= 400, p + ' cannot be fetched', p + ' was fetched: ' + r.status);
    }
    await stop(node); node = null;

    // A RELAY SERVES NO APP (goal/G43.18, box v29: the login is spirit.login, no app, and a relay serves a face spirit.js and the
    // seal alone), so its DEBUG answers are judged on its own api's garbage.
    test.subHeading('/spirit/relay/garbageArguments.json, a relay, DEBUG off');
    relay = await startRelay(copy.run, false);
    if (!relay.up) { test.fail('the scratch relay did not come up'); return; }
    const rOff = await ask('127.0.0.1', relay.port, '/DEBUG/spirit/relay/garbageArguments.json');
    const rNone = await ask('127.0.0.1', relay.port, '/NODEBUG/spirit/relay/garbageArguments.json');
    ok(rOff.status === rNone.status && rOff.text === rNone.text, 'its DEBUG address answers as an address of no route (' + rNone.status + ')', 'DEBUG off the relay answered ' + rOff.status + ' ' + short(rOff.text));
    await stop(relay); relay = null;

    relay = await startRelay(copy.run, true);
    if (!relay.up) { test.fail('the scratch relay did not come up'); return; }
    const R = relay.port;
    const loginPage = '/DEBUG/spirit/relay/garbageArguments.json';
    test.subHeading('/spirit/relay/garbageArguments.json, a relay, DEBUG on');
    const rg = await ask('127.0.0.1', R, '/DEBUG/spirit/relay/garbageArguments.json');
    const rlist = json(rg);
    ok(rg.status === 200 && /json/.test(rg.type) && Array.isArray(rlist) && rlist.length > 0, 'the relay answers its own api\'s garbage, a JSON list of ' + (Array.isArray(rlist) ? rlist.length : 0), 'it answered ' + rg.status + ' ' + rg.type + ' ' + short(rg.text));
    test.subHeading(named(loginPage) + ', a relay, DEBUG on: refused');
    const fwd = await ask('127.0.0.1', R, loginPage, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
    ok(fwd.status >= 400 && fwd.status < 500, 'refused: a request Caddy would pass on, carrying X-Forwarded-For', 'with X-Forwarded-For it answered ' + fwd.status);
    const outside = outsideAddress();
    if (!outside) test.fail('this machine has no address but loopback: a request from outside cannot be tried');
    else {
      const far = await ask(outside, R, loginPage);
      ok(far.status >= 400 && far.status < 500, 'refused: a request not from loopback (asked at ' + outside + ')', 'asked at ' + outside + ' it answered ' + far.status);
    }
  } finally {
    await stop(node); await stop(relay);
    try { fs.rmSync(copy.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
