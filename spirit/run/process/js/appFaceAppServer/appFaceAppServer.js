'use strict';

// spirit/run/process/js/appFaceAppServer/appFaceAppServer.js
// THE SLOT-OWNER'S FACE SERVER: every page request passed through to faceProof (cleanup/G1.10).
//
// THROUGH appServer (apiAuth/G1.1). Andy: "gruesome! fixed in this cycle, thanks!", his correction that it
// obeys every rule every appServer process obeys, and on its replies: "appServer will
// convert any oversized reply into an error and stream that error to the shell". So it serves through
// appServer.serve (api, DEBUG and every shared gate), and its pages go through appServer's pass-through, the
// fallback. A page answer that would not fit one answer is never streamed: it becomes app-answer-too-large, with
// its size and the limit, as a verb's oversized reply does. No grant names it (Andy: "appFaceAppServer needs no
// grant. it is run by the owner").

const appServer = require('../../../js/appServer.js');
const appClient = require('../../../js/appClient.js');
const errors = require('../../../js/spiritErrors.js');
const limits = require('../../../js/limits.js');
const pipeRequest = require('../../../js/relayRequest.js').pipeRequest;
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const TARGET = 'faceProof';
const TARGET_PIPE = appClient.pipePathFor(ROOT, TARGET, process.platform, 'process');
const WAIT_MS = appClient.DOOR_WAIT_MS - 2000;

function answer(res, status, type, text) {
  res.writeHead(status, type ? { 'Content-Type': type } : {});
  res.end(text);
}
// The one error shape (D12), as appServer writes its own.
function refused(res, code, extra) {
  const e = errors.byCode(code);
  const body = { ok: false, code: code, error: e ? e.text : code };
  if (extra) body.extra = extra;
  answer(res, e ? e.status : 500, 'application/json; charset=utf-8', JSON.stringify(body));
}

function passThrough(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', function (c) {
    size += c.length;
    if (size <= limits.BODY_MAX) chunks.push(c);
  });
  req.on('end', function () {
    if (size > limits.BODY_MAX) { refused(res, 'app-request-too-large', { bytes: size, max: limits.BODY_MAX }); return; }
    pipeRequest(TARGET_PIPE, req.method, req.url, Buffer.concat(chunks).toString('utf8'), {
      type: req.headers['content-type'] || '', timeoutMs: WAIT_MS, answerMax: appClient.ANSWER_MAX,
    }).then(function (a) {
      // Too big for one answer is its own refusal, never app-not-running: the conflation G1.1 ends.
      if (a && a.refused === 'app-answer-too-large') { refused(res, 'app-answer-too-large', { bytes: a.bytes, max: a.max }); return; }
      if (!a || a.refused) { refused(res, 'app-not-running', { app: TARGET }); return; }
      answer(res, a.status, a.type, a.text);
    });
  });
}

appServer.serve({}, { fallback: passThrough });
