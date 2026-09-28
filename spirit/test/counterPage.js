'use strict';

// spirit/test/counterPage.js
// THE TEST SERVER — processes/G1.1, written FIRST.
//
//   Andy, 2026-09-28: "the test server will be a dumb web server that serves
//   one page with a server-side counter, that increments every time the
//   server serves GET "/" and shows the increased counter on the page. the
//   page will be assembeled by the server in ram". His go on processes/G1.1,
//   under his rule: red before the implementation, green after.
//
// It is started the way the Processes app starts any process (index.html,
// the launch dialog): `node <script> <one JSON string of the declared args>`,
// here {"port": P} (processes/G1.2 declares that arg).
//
// "In RAM" is held by the operating system, not by reading the code: the
// server runs under Node's permission model, allowed to read its own script
// and to write nothing. Any file it touched would kill it with
// ERR_ACCESS_DENIED.

const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');

test.startTest('processes/G1.1: the counter page, served from RAM');

const OWED = 'OWED by processes/G1.1: ';
const SCRIPT = path.join(__dirname, '..', 'run', 'process', 'js', 'counterServer', 'counterServer.js');

function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function ask(port, method, url) {
  return new Promise(function (resolve) {
    const req = http.request({ host: '127.0.0.1', port: port, method: method, path: url, timeout: 2000 }, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (d) { body += d; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    });
    req.on('error', function (e) { resolve({ status: 0, body: '', error: e.code || e.message }); });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.end();
  });
}
function waitUp(port, child) {
  const until = Date.now() + 8000;
  return (function poll() {
    if (child.exitCode !== null) return Promise.resolve(false);
    return new Promise(function (r) { setTimeout(r, 150); }).then(function () {
      return new Promise(function (resolve) {
        const s = net.connect(port, '127.0.0.1', function () { s.destroy(); resolve(true); });
        s.on('error', function () { resolve(false); });
      });
    }).then(function (up) { return up || Date.now() > until ? up : poll(); });
  }());
}
// THE COUNT IS THE NUMBER THAT MOVED. The page may carry other numbers (a
// port, a date); the counter is the one place where two pages differ.
function moved(a, b) {
  const x = (a.match(/\d+/g) || []).map(Number);
  const y = (b.match(/\d+/g) || []).map(Number);
  if (x.length !== y.length) return null;
  const diff = x.map(function (v, i) { return [v, y[i]]; }).filter(function (p) { return p[0] !== p[1]; });
  return diff.length === 1 ? diff[0] : null;
}

if (!fs.existsSync(SCRIPT)) {
  ['T1 GET / twice shows 1 then 2', 'T2 any other path, and a non-GET, leaves the counter alone',
    'T3 it reads and writes no file: the page lives in RAM'].forEach(function (t) {
    test.fail(OWED + t + ': ' + path.relative(path.join(__dirname, '..', '..'), SCRIPT) + ' does not exist');
  });
  test.reportSuccessFailureCount();
} else {
  let child = null;
  let stderr = '';
  freePort().then(function (port) {
    child = spawn(process.execPath, ['--permission', '--allow-fs-read=' + SCRIPT, SCRIPT, JSON.stringify({ port: port })],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (d) { stderr += d; });
    return waitUp(port, child).then(function (up) { return { port: port, up: up }; });
  }).then(function (s) {
    let first = null;
    let second = null;
    return ask(s.port, 'GET', '/').then(function (r) { first = r; return ask(s.port, 'GET', '/'); })
      .then(function (r) {
        second = r;
        test.subHeading('T1: GET / twice shows 1 then 2');
        const m = first.status === 200 && second.status === 200 ? moved(first.body, second.body) : null;
        if (s.up && m && m[0] === 1 && m[1] === 2) {
          test.check('the first GET / shows 1 and the second shows 2');
        } else {
          test.fail(OWED + 'first GET / ' + first.status + ', second ' + second.status + ', counter moved ' + JSON.stringify(m) +
            (s.up ? '' : ' (the server never came up: ' + stderr.trim().slice(0, 160) + ')'));
        }
        return ask(s.port, 'GET', '/elsewhere');
      })
      .then(function () { return ask(s.port, 'POST', '/'); })
      .then(function () { return ask(s.port, 'GET', '/'); })
      .then(function (third) {
        test.subHeading('T2: any other path, and a non-GET, leaves the counter alone');
        const m = third.status === 200 ? moved(second.body, third.body) : null;
        if (m && m[0] === 2 && m[1] === 3) {
          test.check('after GET /elsewhere and POST /, the next GET / shows 3, not 5');
        } else {
          test.fail(OWED + 'after GET /elsewhere and POST /, GET / moved the counter ' + JSON.stringify(m));
        }
        test.subHeading('T3: it reads and writes no file: the page lives in RAM');
        const denied = /ERR_ACCESS_DENIED/.test(stderr);
        if (s.up && child.exitCode === null && !denied) {
          test.check('it served every request allowed to read only its own script and to write nothing');
        } else {
          test.fail(OWED + (denied ? 'it touched a file: ' + stderr.trim().slice(0, 160) : 'it did not stay up under the file-free rule'));
        }
      });
  }).catch(function (e) {
    test.fail(OWED + 'the run broke: ' + e.message);
  }).then(function () {
    if (child && child.exitCode === null) child.kill();
    test.reportSuccessFailureCount();
  });
}
