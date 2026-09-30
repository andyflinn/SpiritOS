'use strict';

// THE SHARED LAYER REFUSES AN OVERSIZED REPLY, FOR EVERY SERVER.
//   Andy, 2026-09-30: "the shared layer MUST instantly reject a payload, when the json exceeds the maximum size, that
//   will make this never happen again. where the fixing you're trying is only for desk".
// The contract: appServer, which every server process answers through, measures each answer before it leaves. One
// larger than one answer (appClient.ANSWER_MAX) is not sent: the server itself answers app-answer-too-large (502),
// with extra.bytes and extra.max, so no oversized reply leaves any server, whoever reads it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const appServer = require('../run/js/appServer.js');
const appClient = require('../run/js/appClient.js');
const relayRequest = require('../run/js/relayRequest.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('the shared layer refuses an oversized reply, for every server');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-replycap-'));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'grow', 'win32', 'process') : path.join(scratch, 'grow.sock');
  const big = 'g'.repeat(appClient.ANSWER_MAX + 100);
  const srv = appServer.createAppServer({
    grow: { request: {}, reply: { text: '' }, handler: function () { return { text: big }; } },
    small: { request: {}, reply: { text: '' }, handler: function () { return { text: 'ok' }; } },
  }).listen(pipe);
  await sleep(200);
  try {
    // Read with no answerMax: whatever the server sends arrives, so only the server can have refused.
    const got = await relayRequest.pipeRequest(pipe, 'POST', '/', JSON.stringify({ grow: {} }), { type: 'application/json', timeoutMs: 5000 });
    let body = null;
    try { body = JSON.parse(got.text); } catch (e) { body = null; }
    const sent = Buffer.byteLength(String(got.text || ''), 'utf8');
    if (got.status === 502 && body && body.code === 'app-answer-too-large' && sent <= appClient.ANSWER_MAX) test.check('the server itself refused its oversized answer, app-answer-too-large 502, and sent ' + sent + ' bytes');
    else test.fail('the server sent status ' + got.status + ', ' + sent + ' bytes, code ' + (body && body.code));
    const x = body && body.extra;
    if (x && typeof x.bytes === 'number' && typeof x.max === 'number' && x.bytes > x.max && x.max === appClient.ANSWER_MAX) test.check('the refusal says it was ' + x.bytes + ' bytes against ' + x.max);
    else test.fail('the refusal carries extra ' + JSON.stringify(x));
    const ok = await relayRequest.pipeRequest(pipe, 'POST', '/', JSON.stringify({ small: {} }), { type: 'application/json', timeoutMs: 5000 });
    if (ok.status === 200 && JSON.parse(ok.text).text === 'ok') test.check('an answer that fits still goes out');
    else test.fail('a small answer came back ' + ok.status);
  } catch (e) {
    test.fail('the run broke: ' + (e && e.stack || e));
  }
  srv.close();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 200);
})();
