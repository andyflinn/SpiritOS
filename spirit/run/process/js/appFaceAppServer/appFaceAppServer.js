'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const appClient = require('../../../js/appClient.js');
const limits = require('../../../js/limits.js');
const pipeRequest = require('../../../js/relayRequest.js').pipeRequest;

const argv = process.argv;
const at = argv.indexOf('--pipe');
const PIPE = at !== -1 ? argv[at + 1] : '';
if (!PIPE) {
  console.error('appFaceAppServer: no --pipe; the node that starts this names its pipe');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..', '..', '..');
const TARGET = 'faceProof';
const TARGET_PIPE = appClient.pipePathFor(ROOT, TARGET, process.platform, 'process');
const WAIT_MS = 15000;

function answer(res, status, type, text) {
  res.writeHead(status, type ? { 'Content-Type': type } : {});
  res.end(text);
}

const server = http.createServer(function (req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', function (c) {
    size += c.length;
    if (size <= limits.BODY_MAX) chunks.push(c);
  });
  req.on('end', function () {
    if (size > limits.BODY_MAX) {
      answer(res, 413, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'app-request-too-large', app: TARGET }));
      return;
    }
    pipeRequest(TARGET_PIPE, req.method, req.url, Buffer.concat(chunks).toString('utf8'), {
      type: req.headers['content-type'] || '', timeoutMs: WAIT_MS,
    }).then(function (a) {
      if (!a || a.refused) {
        answer(res, 503, 'application/json; charset=utf-8', JSON.stringify({ ok: false, code: 'app-not-running', app: TARGET }));
        return;
      }
      answer(res, a.status, a.type, a.text);
    });
  });
});

if (process.platform !== 'win32') {
  try { fs.unlinkSync(PIPE); } catch (e) { /* none left */ }
}
server.listen(PIPE);
