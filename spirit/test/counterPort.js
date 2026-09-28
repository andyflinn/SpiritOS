'use strict';

// spirit/test/counterPort.js
// THE TEST SERVER'S PORT COMES FROM THE LAUNCH DIALOG — processes/G1.2,
// written FIRST.
//
//   Andy, 2026-09-28: "the test server takes as argument a port number in
//   the process UI launch process that uses the dynamic launch arguments
//   dialog by providing argument introspection". His go on processes/G1.2,
//   under his rule: red before the implementation, green after.
//
// The dialog builds its fields from the manifest's `args` (index.html:1446)
// and gives a number field for type 'number' (index.html:1463), then starts
// `node <script> <JSON of the values>`. So the manifest declares the port,
// and a missing or bad port is refused by name instead of crashing on
// ERR_SOCKET_BAD_PORT (what Andy saw on 2026-09-28).
//
// T2 already holds since processes/G1.1 (its tests start the server that
// way); it stays as a GUARD, not as proof of this item.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { relayRequest } = require('../run/js/relayRequest.js');
const test = require('./testSupport.js');

test.startTest('processes/G1.2: the counter server declares its port, and refuses a bad one by name');

const OWED = 'OWED by processes/G1.2: ';
const DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'counterServer');
const SCRIPT = path.join(DIR, 'counterServer.js');
const MANIFEST = path.join(DIR, 'counterServer.json');

function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function run(args, ms) {
  return new Promise(function (resolve) {
    const child = spawn(process.execPath, [SCRIPT].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (d) { err += d; });
    const t = setTimeout(function () { child.kill(); resolve({ code: 'still running', err: err }); }, ms);
    child.on('exit', function (code) { clearTimeout(t); resolve({ code: code, err: err }); });
  });
}

// ── T1 ────────────────────────────────────────────────────────────────
test.subHeading('T1: the manifest declares one arg, port, of type number');
let manifest = null;
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
const args = manifest && Array.isArray(manifest.args) ? manifest.args : [];
if (args.length === 1 && args[0].name === 'port' && args[0].type === 'number') {
  test.check('counterServer.json declares exactly one arg: port, a number, so the dialog asks for it');
} else {
  test.fail(OWED + (manifest ? 'counterServer.json args are ' + JSON.stringify(args) : 'counterServer.json does not exist or does not parse'));
}

// ── T2 (guard) ────────────────────────────────────────────────────────
freePort().then(function (port) {
  test.subHeading('T2 (guard): started the dialog\'s way with port P, it answers on P');
  const child = spawn(process.execPath, [SCRIPT, JSON.stringify({ port: port })], { stdio: 'ignore' });
  return new Promise(function (r) { setTimeout(r, 800); })
    .then(function () { return relayRequest('http://127.0.0.1:' + port, 'GET', '/', null); })
    .then(function (r) { return r.status; }, function () { return 0; })
    .then(function (status) {
      if (status === 200) test.check('node counterServer.js \'{"port":' + port + '}\' serves on ' + port);
      else test.fail('the dialog\'s way did not serve on P (status ' + status + ')');
      child.kill();
    });
}).then(function () {
  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: with no port or a bad one, it refuses by name and does not start');
  const cases = [[], [JSON.stringify({})], [JSON.stringify({ port: 'abc' })], [JSON.stringify({ port: 70000 })], [JSON.stringify({ port: -1 })]];
  return Promise.all(cases.map(function (a) { return run(a, 3000); })).then(function (results) {
    const bad = results.map(function (r, i) {
      const named = /port/i.test(r.err) && !/ERR_SOCKET_BAD_PORT/.test(r.err);
      return (r.code !== 0 && r.code !== 'still running' && named) ? null : JSON.stringify(cases[i]) + ' -> ' +
        (r.code === 'still running' ? 'kept running' : 'exit ' + r.code + ', ' + (r.err.trim().split('\n').pop() || 'no reason').slice(0, 80));
    }).filter(Boolean);
    if (!bad.length) {
      test.check('no port, an empty object, "abc", 70000 and -1 each end it at once with a reason that names the port');
    } else {
      test.fail(OWED + 'not refused by name: ' + bad.join(' | '));
    }
  });
}).then(function () { test.reportSuccessFailureCount(); });
