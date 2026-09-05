'use strict';

// Phase C: mailbox.json survives stop + start. Do not Recycle (that recopies
// code; it must not be required to wipe mail).
//
//   node spirit/test/labMaster/relayPersist.test.js

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('../testSupport.js');

const MASTER = 'http://127.0.0.1:65420';
const RELAY_PORT = 65419;
const RELAY_NAME = 'persist-relay';
const ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;
const TEXT = 'persist ping ' + Date.now();

function request(urlString, method, bodyObj) {
  return new Promise(function (resolve, reject) {
    const url = new URL(urlString);
    const payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    const req = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Host': url.host,
      },
    }, function (res) {
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: chunks }); });
    });
    req.on('error', reject);
    req.setTimeout(8000, function () { req.destroy(new Error('timeout ' + urlString)); });
    req.end(payload);
  });
}

function json(urlString, method, bodyObj) {
  return request(urlString, method, bodyObj).then(function (r) {
    let parsed = null;
    try { parsed = r.text ? JSON.parse(r.text) : null; } catch (e) { parsed = null; }
    return { status: r.status, text: r.text, json: parsed };
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function waitUntil(fn, timeoutMs, label) {
  const started = Date.now();
  return (function poll() {
    return Promise.resolve()
      .then(fn)
      .then(function (ok) {
        if (ok) return true;
        if (Date.now() - started > timeoutMs) {
          throw new Error('timeout waiting for ' + label);
        }
        return sleep(200).then(poll);
      });
  }());
}

function masterUp() {
  return request(MASTER + '/api/nodes', 'GET', null)
    .then(function (r) { return r.status === 200; })
    .catch(function () { return false; });
}

function spawnMaster() {
  return spawn(
    process.execPath,
    [path.join(__dirname, 'labMaster.js')],
    { cwd: path.join(__dirname, '..', '..', '..'), stdio: 'inherit' }
  );
}

function ensureGone(id) {
  return json(MASTER + '/api/nodes/' + id + '/delete', 'POST', {})
    .catch(function () { return true; });
}

function waitWho() {
  return waitUntil(function () {
    return request(ORIGIN + '/api/relay/who', 'GET', null)
      .then(function (x) { return x.status === 200; })
      .catch(function () { return false; });
  }, 10000, 'who');
}

test.startTest('mailbox.json survives relay stop + start');

let weStartedMaster = false;
let masterChild = null;

Promise.resolve()
  .then(function () { return masterUp(); })
  .then(function (up) {
    if (up) return;
    masterChild = spawnMaster();
    weStartedMaster = true;
    return waitUntil(masterUp, 8000, 'labMaster');
  })
  .then(function () { return ensureGone(RELAY_NAME); })
  .then(function () {
    return json(MASTER + '/api/nodes', 'POST', {
      name: RELAY_NAME, type: 'relay', port: RELAY_PORT,
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('create relay row');
    else test.fail('create → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start relay');
    else test.fail('start → ' + r.status);
    return waitWho();
  })
  .then(function () {
    return json(ORIGIN + '/api/relay/claim', 'POST', { name: 'andy' });
  })
  .then(function (r) {
    if (r.status === 201 || r.status === 409) test.check('claim andy');
    else test.fail('claim → ' + r.status + ' ' + r.text);
    return json(ORIGIN + '/api/relay/send', 'POST', {
      from: 'andy', to: 'bert', text: TEXT,
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('send stored');
    else test.fail('send → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/stop', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('stop relay');
    else test.fail('stop → ' + r.status);
    return sleep(400);
  })
  .then(function () {
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start relay again');
    else test.fail('restart → ' + r.status);
    return waitWho();
  })
  .then(function () {
    return json(ORIGIN + '/api/relay/who', 'GET', null);
  })
  .then(function (r) {
    var names = ((r.json && r.json.peers) || []).map(function (p) { return p.name; });
    if (r.status === 200 && names.indexOf('andy') !== -1) test.check('andy still claimed after restart');
    else test.fail('who after restart → ' + r.status + ' ' + r.text);
    return json(ORIGIN + '/api/relay/inbox?name=bert', 'GET', null);
  })
  .then(function (r) {
    var hit = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === TEXT; });
    if (r.status === 200 && hit) test.check('inbox still has the line');
    else test.fail('inbox after restart → ' + r.status + ' ' + r.text);
    return json(ORIGIN + '/api/relay/claim', 'POST', { name: 'andy' });
  })
  .then(function (r) {
    if (r.status === 409) test.check('second claim still 409');
    else test.fail('reclaim → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/delete', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('delete relay');
    else test.fail('delete → ' + r.status);
  })
  .catch(function (err) {
    test.fail(String(err && err.message || err));
  })
  .then(function () {
    test.reportSuccessFailureCount();
    if (weStartedMaster && masterChild) {
      try { masterChild.kill(); } catch (e) { /* already gone */ }
    }
    process.exit(test.failureCount > 0 ? 1 : 0);
  });
