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
const PAGE = '/DEBUG/shell/js/workBench/headLessBrowser.html';
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

test.startTest('/spirit/DEBUG.js: the DEBUG test routes, for node and relay alike');

(async function () {
  test.subHeading('/spirit/DEBUG.js, /spirit/DEBUG/, /shell/mount.html: its files');
  ok(fs.existsSync(path.join(RUN, 'spirit', 'DEBUG.js')), 'spirit/run/spirit/DEBUG.js is there', 'spirit/run/spirit/DEBUG.js is not there');
  ['headLessBrowser', 'garbageArguments'].forEach(function (g) {
    ok(fs.existsSync(path.join(RUN, 'spirit', 'DEBUG', g + '.js')), 'its generator script spirit/run/spirit/DEBUG/' + g + '.js is there', 'spirit/run/spirit/DEBUG/' + g + '.js is not there');
  });
  ok(!fs.existsSync(path.join(RUN, 'shell', 'mount.html')), 'shell/mount.html is gone: the page is made from the address', 'shell/mount.html is still there');
  // A module's special needs for a generator sit beside its tests, named <module>-<generatorScript>.json.
  ok(fs.existsSync(path.join(RUN, 'shell', 'js', 'test', 'grantsPanel-headLessBrowser.json')) && !fs.existsSync(path.join(RUN, 'shell', 'js', 'test', 'grantsPanel-boot-sibling-generalRules.json')),
    'the grants panel\'s mount needs are grantsPanel-headLessBrowser.json, the old name gone', 'shell/js/test/grantsPanel-headLessBrowser.json is not there, or the old -boot-sibling-generalRules.json still is');
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
    judgePage(await ask('127.0.0.1', N, PAGE), 'shell/js/workBench', 'the node');

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
      const wrong = [];
      for (const entry of list) {
        const r = await ask('127.0.0.1', N, '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
        const b = json(r);
        if (!(r.status >= 400 && r.status < 500 && b && typeof b.code === 'string' && b.code && b.code !== 'handler-failed')) wrong.push({ entry: entry, status: r.status, answer: r.text.slice(0, 80) });
      }
      ok(!wrong.length, 'each of the ' + list.length + ' is refused with a code: a 4xx, never accepted, a 5xx or a handler failed', wrong.length + ' were not: ' + short(wrong));
      const still = await call(N, 'api');
      ok(still.status === 200, 'and the node still answers its api afterwards', 'afterwards its api answered ' + still.status);
    }

    const refused = async function (p, headers, why) {
      test.subHeading(named(p) + ', the node, DEBUG on: refused, ' + why);
      const r = await ask('127.0.0.1', N, p, { headers: headers });
      ok(r.status >= 400 && r.status < 500, 'refused: ' + why, why + ': answered ' + r.status + ' ' + short(r.text.slice(0, 120)));
    };
    await refused('/DEBUG/shell/js/noSuchModule/headLessBrowser.html', {}, 'no such module under spirit/run');
    await refused('/DEBUG/shell/js/../js/workBench/headLessBrowser.html', {}, 'a ".." in the address');
    await refused('/DEBUG/shell/js/workBench/noSuchGenerator.html', {}, 'no such generator script');
    await refused(PAGE, { 'X-Forwarded-For': '203.0.113.9' }, 'a request carrying X-Forwarded-For');
    await refused(PAGE, { 'Forwarded': 'for=203.0.113.9' }, 'a request carrying Forwarded');
    for (const p of ['/spirit/DEBUG.js', '/spirit/DEBUG/headLessBrowser.js', '/spirit/DEBUG/garbageArguments.js']) {
      test.subHeading(p + ', the node, DEBUG on');
      const r = await ask('127.0.0.1', N, p);
      ok(r.status >= 400, p + ' cannot be fetched', p + ' was fetched: ' + r.status);
    }
    await stop(node); node = null;

    test.subHeading('/shell/login/login/headLessBrowser.html, a relay, DEBUG off');
    relay = await startRelay(copy.run, false);
    if (!relay.up) { test.fail('the scratch relay did not come up'); return; }
    const rOff = await ask('127.0.0.1', relay.port, '/DEBUG/shell/login/login/headLessBrowser.html');
    const rNone = await ask('127.0.0.1', relay.port, '/NODEBUG/shell/login/login/headLessBrowser.html');
    ok(rOff.status === rNone.status && rOff.text === rNone.text, 'its DEBUG address answers as an address of no route (' + rNone.status + ')', 'DEBUG off the relay answered ' + rOff.status + ' ' + short(rOff.text));
    await stop(relay); relay = null;

    test.subHeading('/shell/login/login/headLessBrowser.html, a relay, DEBUG on');
    relay = await startRelay(copy.run, true);
    if (!relay.up) { test.fail('the scratch relay did not come up'); return; }
    const R = relay.port;
    const loginPage = '/DEBUG/shell/login/login/headLessBrowser.html';
    judgePage(await ask('127.0.0.1', R, loginPage), 'shell/login/login', 'the relay');
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
