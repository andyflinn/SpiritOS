'use strict';

// spirit/test/counterLog.js
// THE TEST SERVER'S LOG — processes/G1.4, written FIRST, red on today's code.
//
//   Andy, 2026-09-28, go on processes/G1.4: the test server writes its log
//   to its Jobs console through existing interfaces. Nothing new on the wire:
//   a line on stdout is what jobs.js already turns into a job log entry.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/js/relayRequest.js');

test.startTest('processes/G1.4: the test server logs to its Jobs console');

const OWED = 'OWED by processes/G1.4: ';
const COUNTER = path.join(__dirname, '..', 'run', 'process', 'js', 'counterServer', 'counterServer.js');
const jobs = require('../run/js/jobs.js')(spirit, 65432);

function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function isOpen(port) {
  return new Promise(function (resolve) {
    const s = net.connect(port, '127.0.0.1', function () { s.destroy(); resolve(true); });
    s.on('error', function () { resolve(false); });
  });
}
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 8000);
  return (function poll() {
    return Promise.resolve(fn()).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return new Promise(function (r) { setTimeout(r, 150); }).then(poll);
    });
  }());
}
function get(port, method, p) {
  return relayRequest('http://127.0.0.1:' + port, method || 'GET', p || '/', null).catch(function () { return null; });
}
const pause = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  // A copy in a temp home, as serverKinds.js does, so the manifest is ours.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-counterlog-'));
  const dir = path.join(root, 'process', 'js', 'counterLog');
  fs.mkdirSync(dir, { recursive: true });
  const script = path.join(dir, 'counterLog.js');
  fs.copyFileSync(COUNTER, script);
  fs.writeFileSync(path.join(dir, 'counterLog.json'), JSON.stringify({ label: 'counterLog', kind: 'server', operated: 'user' }));

  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: each GET / writes one line to the job log, with the new count');
  const port = await freePort();
  const job = jobs.startJob('node', [script, JSON.stringify({ port: port })], { type: 'counterLog' });
  const up = await waitFor(function () { return isOpen(port); });
  const before = up ? jobs.getJob(job.id).log.length : 0;
  if (up) {
    await get(port); await get(port); await get(port, 'POST'); await get(port, 'GET', '/x'); await get(port);
  }
  await pause(400);
  const lines = up ? jobs.getJob(job.id).log.slice(before).map(function (e) { return e.message; }) : [];
  const counted = lines.filter(function (l) { return /GET \/ -> \d+/.test(l); })
    .map(function (l) { return Number(l.match(/GET \/ -> (\d+)/)[1]); });
  if (counted.join(',') === '1,2,3') test.check('three GET / gave three log lines, 1, 2 and 3');
  else test.fail(OWED + 'expected lines "GET / -> 1..3", got ' + JSON.stringify(lines));
  jobs.cancelJob(job.id);

  // ── T2 ──────────────────────────────────────────────────────────────
  test.subHeading('T2: the lines leave by stdout only; no file, no stderr, nothing but http');
  const p2 = await freePort();
  const child = spawn(process.execPath, [script, '--port', String(p2)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; let err = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { err += d; });
  if (await waitFor(function () { return isOpen(p2); })) { await get(p2); await get(p2); }
  await pause(300);
  child.kill();
  const files = fs.readdirSync(dir).sort().join(',');
  const src = fs.readFileSync(COUNTER, 'utf8');
  // Module names only, so this file never spells a require that oneDoor counts.
  const requires = (src.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || [])
    .map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); }).join(',');
  if (/GET \/ -> 2/.test(out) && err === '' && files === 'counterLog.js,counterLog.json' && requires === 'http') {
    test.check('stdout carried the lines, stderr stayed empty, no file was written, it requires only http');
  } else {
    test.fail(OWED + 'stdout ' + JSON.stringify(out) + ', stderr ' + JSON.stringify(err) + ', files ' + files + ', requires ' + requires);
  }

  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
}());
