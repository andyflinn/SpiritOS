'use strict';

// spirit/run/spirit/test/test/testReport.js
// The tests of spirit/test/testReport.js, and of no other module, in this one file (spec: ./testReport.md). Its sections:
// the name a test is sent to the verifier by (goal/G41.19), then a test's results reaching the verifier (goal/G43.23, item 3). Each case runs a child as if it were the test file named, under a stand-in spirit.js whose
// deskVerify.record prints what it was given.

const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const REPORTER = path.join(RUN, 'spirit', 'test', 'testReport.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// What the reporter sends when run as <file> (relative to spirit/run), with the arguments given: the records, or [].
// The stand-in is planted at spirit/run/spirit/spirit.js, where the reporter loads the spirit object.
function sent(file, args, verify) {
  const child = [
    'const path = require("path");',
    'const spiritJs = path.join(' + JSON.stringify(RUN) + ', "spirit", "spirit.js");',
    'require.cache[spiritJs] = { id: spiritJs, filename: spiritJs, loaded: true, exports: {',
    '  familyPath: function (n) { return n; },',
    '  require: function () { return Promise.resolve({ record: function (r) { console.log("REC " + JSON.stringify(r)); } }); },',
    '} };',
    'process.argv = [process.argv[0], ' + JSON.stringify(path.join(RUN, file)) + '].concat(' + JSON.stringify(args.concat(verify ? ['--verify-port', '45999'] : [])) + ');',
    'const t = require(' + JSON.stringify(REPORTER) + ');',
    't.startTest("a case"); t.check("one green"); t.fail("one red", "why");',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', child], { encoding: 'utf8', timeout: 20000 });
  return String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('REC ') === 0; }).map(function (l) {
    try { return JSON.parse(l.slice(4)); } catch (e) { return null; }
  }).filter(Boolean);
}
function suitesOf(recs) { return recs.map(function (r) { return r.suite; }).filter(function (s, i, a) { return a.indexOf(s) === i; }); }
function short(x) { return JSON.stringify(x).slice(0, 300); }

test.startTest('spirit/test/testReport.js: a test is sent by the module it tests, /<path>/<module>');

test.subHeading('a test of a module');
const CASES = [
  ['spirit/element/test/workBench.js', '/spirit/element/workBench'],
  ['spirit/app/agent/table/model/test/rowElement.js', '/spirit/app/agent/table/model/rowElement'],
  ['spirit/app/agent/table/provider/test/rowElement.js', '/spirit/app/agent/table/provider/rowElement'],
  ['spirit/test/DEBUG.js', '/spirit/DEBUG'],
  ['spirit/test/spirit.js', '/spirit/spirit'],
];
CASES.forEach(function (c) {
  const recs = sent(c[0], [], true);
  const names = suitesOf(recs);
  ok(recs.length && names.length === 1 && names[0] === c[1], c[0] + ' is sent as ' + c[1], c[0] + ' was sent as ' + short(names) + (recs.length ? '' : ' (nothing sent)'));
});
const twins = CASES.slice(1, 3).map(function (c) { return suitesOf(sent(c[0], [], true))[0]; });
ok(twins[0] && twins[1] && twins[0] !== twins[1], 'two test files of one name, rowElement.js, are two names', 'both rowElement.js tests went by ' + short(twins));

test.subHeading('a general test, by the file it judges');
const general = suitesOf(sent('spirit/test/spirit-sibling-generalRules.js', ['spirit/app/desk/element/desk/desk.js'], true));
ok(general.length === 1 && general[0] === '/spirit/app/desk/element/desk/desk', 'spirit-sibling-generalRules.js judging spirit/app/desk/element/desk/desk.js is sent as /spirit/app/desk/element/desk/desk', 'it was sent as ' + short(general));

test.subHeading('the rest of a record as before');
const recs = sent('spirit/element/test/workBench.js', [], true);
const green = recs.filter(function (r) { return r.outcome === 'green'; })[0];
const red = recs.filter(function (r) { return r.outcome === 'red'; })[0];
// EVERY TEST NAME STARTS WITH THE PATH (Andy, box v13: "EVERY MOTHERFUCKING TEST NAME in the product three STARTS WITH
// THE MUTHERCUCKING PATH!!!!!!!!!!"): the title is "/<path>/<module> <section> #<n>", so a title read alone names its
// module.
ok(green && green.title === '/spirit/element/workBench a case #1', 'a green\'s title starts with its path: "/<path>/<module> <section> #<n>"', 'the green record: ' + short(green));
ok(red && red.title === '/spirit/element/workBench a case #2' && /one red/.test(String(red.failure)), 'a red\'s title starts with its path, and it carries its failure', 'the red record: ' + short(red));
const twinTitles = CASES.slice(1, 3).map(function (c) { return (sent(c[0], [], true)[0] || {}).title; });
ok(twinTitles[0] && twinTitles[1] && twinTitles[0] !== twinTitles[1] && twinTitles.every(function (t, i) { return t.indexOf(CASES[i + 1][1] + ' ') === 0; }),
  'the titles of the two rowElement.js tests start with their own paths', 'their titles: ' + short(twinTitles));
ok(!sent('spirit/element/test/workBench.js', [], false).length, 'nothing is sent when the verifier did not start the run', 'a record was sent with no --verify-port');

// The section folded in from a file of its own, the verifier, runs after the checks above; then the one report.
verifierPart().then(null, function (e) { test.fail('the verifier part threw ' + (e && e.stack || e)); })
  .then(function () { test.reportSuccessFailureCount(); });

async function verifierPart() {
  // ── THE VERIFIER PART ──
  // A TEST'S RESULTS REACH THE VERIFIER (goal/G43.23, item 3; spec: ./testReport.md, its section). The box: "no test result
  // reaches the verifier: testReport.js requires the gone spirit/run/spirit.js and swallows the error."
  //
  // A scratch run tree under /tmp holds a copy of this tree's spirit/test/testReport.js and spirit/ files, its
  // spirit/state/environment.json naming the port of a fake verifier this suite stands up: it answers api {family:
  // deskVerify} with the real interface text and keeps every deskVerify.record it is sent. A probe test in the scratch tree
  // is run as the verifier runs a suite (--verify-port <port>), one green and one red. Neither Andy's node nor an agent's
  // is touched: the copy's environment.json names the fake's port alone.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const http = require('http');
  const { spawn } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

  // The scratch run tree: the spirit/ folder copied (its state and test folders left out), then spirit/test/testReport.js,
  // a port of our own.
  function scratchTree(port) {
    const root = fs.mkdtempSync(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'g4323v-'));
    const run = path.join(root, 'run');
    const SKIP = ['state', 'test'];
    (function copy(from, to) {
      fs.mkdirSync(to, { recursive: true });
      fs.readdirSync(from, { withFileTypes: true }).forEach(function (d) {
        const f = path.join(from, d.name);
        if (SKIP.indexOf(d.name) !== -1 || VENDORED_FOLDERS.holds(f)) return;
        if (d.isDirectory()) copy(f, path.join(to, d.name));
        else if (d.isFile() && /\.(js|json)$/.test(d.name)) fs.copyFileSync(f, path.join(to, d.name));
      });
    }(path.join(RUN, 'spirit'), path.join(run, 'spirit')));
    fs.mkdirSync(path.join(run, 'spirit', 'test'), { recursive: true });
    fs.copyFileSync(path.join(RUN, 'spirit', 'test', 'testReport.js'), path.join(run, 'spirit', 'test', 'testReport.js'));
    fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(run, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
    // The probe: a test of a module probe/probe.js, one green, one red.
    fs.mkdirSync(path.join(run, 'probe', 'test'), { recursive: true });
    fs.writeFileSync(path.join(run, 'probe', 'test', 'probe.js'), [
      "'use strict';",
      "const t = require(require('path').join(__dirname, '..', '..', 'spirit', 'test', 'testReport.js'));",
      "t.startTest('a probe'); t.check('one green'); t.fail('one red', 'why it went red'); t.reportSuccessFailureCount();",
    ].join('\n'));
    return { root: root, run: run, probe: path.join(run, 'probe', 'test', 'probe.js') };
  }

  // The fake verifier: the node's door, /api/spirit, answering the deskVerify family's interface and keeping its records.
  function fakeVerifier() {
    const records = [];
    const asked = [];
    const iface = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'deskVerify', 'api.js'), 'utf8');
    const server = http.createServer(function (req, res) {
      let body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        let msg = null;
        try { msg = JSON.parse(body); } catch (e) { msg = null; }
        asked.push(req.method + ' ' + req.url + ' ' + (msg && msg.call));
        const send = function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
        if (req.method !== 'POST' || req.url !== '/api/spirit' || !msg) return send(404, { ok: false, code: 'not-found' });
        if (msg.call === 'api' && msg.args && msg.args.family === 'deskVerify') return send(200, { family: 'deskVerify', interface: iface });
        if (msg.call === 'deskVerify.record') { records.push(msg.args); return send(200, { ok: true }); }
        return send(404, { ok: false, code: 'no-such-verb' });
      });
    });
    return new Promise(function (resolve) {
      server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, records: records, asked: asked, close: function () { server.close(); } }); });
    });
  }

  function runProbe(file, args) {
    return new Promise(function (resolve) {
      const env = Object.assign({}, process.env);
      Object.keys(env).forEach(function (k) { if (/^SPIRIT_/.test(k)) delete env[k]; });
      const kid = spawn(process.execPath, [file].concat(args), { cwd: path.dirname(file), env: env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      kid.stdout.on('data', function (c) { out += c; });
      kid.stderr.on('data', function (c) { out += c; });
      const timer = setTimeout(function () { kid.kill('SIGKILL'); }, 30000);
      kid.on('close', function (code) { clearTimeout(timer); resolve({ code: code, out: out }); });
    });
  }

  test.subHeading('verifier: a test run with --verify-port hands its results to the verifier (goal/G43.23 item 3)');

  await (async function () {
    const v = await fakeVerifier();
    const tree = scratchTree(v.port);
    try {
      test.subHeading('the world');
      ok(fs.existsSync(path.join(tree.run, 'spirit', 'spirit.js')) && fs.existsSync(path.join(tree.run, 'spirit', 'test', 'testReport.js')),
        'the world: the scratch run tree holds spirit/test/testReport.js and spirit/spirit.js, as this tree does', 'the scratch tree is missing its files: ' + tree.run);
      ok(JSON.parse(fs.readFileSync(path.join(tree.run, 'spirit', 'state', 'environment.json'), 'utf8')).PORT === v.port && v.port !== 45441 && v.port !== 65432,
        'the world: the scratch tree names the fake verifier\'s port ' + v.port + ', no live node', 'the scratch tree names another port');
      const r = await runProbe(tree.probe, ['--verify-port', String(v.port)]);
      ok(/SUCCESS #1\.1: one green/.test(r.out) && /FAILURE #1\.1: one red/.test(r.out) && /Test completed\./.test(r.out),
        'the world: the probe ran under --verify-port and printed its green, its red and its completion line', 'the probe did not run as a test: ' + short(r.out));

      test.subHeading('its results reach the verifier');
      const green = v.records.filter(function (x) { return x && x.outcome === 'green'; });
      const red = v.records.filter(function (x) { return x && x.outcome === 'red'; });
      ok(v.records.length > 0, 'the verifier was handed ' + v.records.length + ' records', 'no result reached the verifier (it was asked: ' + short(v.asked) + ')');
      ok(green.length === 1, 'the green reached the verifier as a green: ' + short(green[0]), 'the verifier holds ' + green.length + ' greens: ' + short(v.records));
      ok(red.length === 1 && /one red/.test(String(red[0].failure)), 'the red reached the verifier as a red, with its failure: ' + short(red[0]),
        'the verifier holds ' + red.length + ' reds: ' + short(v.records));
    } finally {
      v.close();
      try { fs.rmSync(tree.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
