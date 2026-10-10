'use strict';

// spirit/test/bodiesJoinedOnce.js
// goal/G16.6: bytes copied, bytes counted (R1, R5, S10 and the proxy reply of the review of 2026-10-10). Written
// first, red on today's code; claude-windows wrote it and builds it. Andy's rule, 2026-10-10: "in a max_BYTE
// environment, BYTES must be copied. BYTES must be counted. that's a rule." His rulings on the readers: "4. yes. the
// relayRequest must copy raw bytes only. if it doesn't fix it. now."; "3. serveCommon. yes. one single piece of shared
// code must ensure that raw bytes are copied. precisely."; "2. same practise odered. ideally through a shared
// kernel.js utility or similar."; R5: "yes. just make sure it's fixed."
//
// WHAT IS ASSERTED
//   1. kernel.js carries readBody(stream, {max}): raw chunks collected, decoded once; a four-byte character split
//      across two writes comes back whole; past max it refuses by name (413, body-too-large) and stops reading.
//   2. relayRequest resolves a split answer whole, refuses an answer over its cap by name, and gives up by name on
//      a relay that never finishes (S10); serveCommon's readJsonBody parses a split request whole and still refuses a
//      body one byte over its cap; jobs.report hands back a split answer whole.
//   3. The proxy (net.fetch) passes an outside reply straight to the asker, unread and uncapped (Andy, 2026-10-11:
//      "agreed. no number at all."), and relayRequest's cap is limits.BODY_MAX ("and answer from a relay is ALWAYS
//      bounded by MAX_PAYLOAD").
//   4. The relay counts a routed text in bytes: no `.length` of a text is compared against MAX_ROUTED_TEXT, and no
//      reader in kernel.js, relayRequest.js or serveCommon.js glues chunks into a string.
// rule/11: through testSupport only; its own ports; never 65432.

const fs = require('fs');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G16.6: ';
const RUN = path.join(__dirname, '..', 'run');
const EMOJI = '\u{1F600}';                 // four bytes in UTF-8: F0 9F 98 80
const EMOJI_BYTES = Buffer.from(EMOJI, 'utf8');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
}

// A server that answers with a JSON string whose emoji is split across two writes, a pause between them.
function splitAnswer(res, prefix) {
  const head = Buffer.from(prefix, 'utf8');
  const tail = Buffer.from('"}', 'utf8');
  const whole = Buffer.concat([head, EMOJI_BYTES, tail]);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': whole.length });
  res.write(Buffer.concat([head, EMOJI_BYTES.slice(0, 2)]));
  setTimeout(function () { res.end(Buffer.concat([EMOJI_BYTES.slice(2), tail])); }, 60);
}

test.startTest('goal/G16.6: bytes copied, bytes counted');

async function suite() {
  const spirit = require('../run/js/kernel.js');

  // ── 1. THE SHARED UTILITY ───────────────────────────────────────────────
  test.subHeading('1. kernel.js readBody copies raw bytes and decodes once');
  const readBody = spirit.core && spirit.core.readBody;
  if (typeof readBody !== 'function') test.fail(OWED + 'kernel.js has no spirit.core.readBody');
  else {
    const { PassThrough } = require('stream');
    const s1 = new PassThrough();
    const p1 = readBody(s1);
    s1.write(Buffer.concat([Buffer.from('a'), EMOJI_BYTES.slice(0, 1)]));
    await sleep(10);
    s1.end(Buffer.concat([EMOJI_BYTES.slice(1), Buffer.from('b')]));
    const t1 = await p1.catch(function (e) { return 'threw ' + e.message; });
    if (t1 === 'a' + EMOJI + 'b') test.check('a four-byte character split across two chunks comes back whole');
    else test.fail(OWED + 'readBody gave ' + short(t1));
    const s2 = new PassThrough();
    const p2 = readBody(s2, { max: 10 });
    s2.write(Buffer.alloc(8, 120));
    s2.write(Buffer.alloc(8, 120));
    const e2 = await p2.then(function () { return null; }, function (e) { return e; });
    if (e2 && e2.statusCode === 413 && e2.code === 'body-too-large') test.check('past max it refuses by name, 413 body-too-large');
    else test.fail(OWED + 'readBody past max gave ' + short(e2 && { statusCode: e2.statusCode, code: e2.code, message: e2.message }));
  }

  // ── 2. THE THREE READERS ────────────────────────────────────────────────
  test.subHeading('2. relayRequest, readJsonBody and jobs.report read whole');
  let hang = null;
  const server = http.createServer(function (req, res) {
    const p = req.url.split('?')[0];
    if (p === '/split') return splitAnswer(res, '{"text":"x');
    if (p === '/sized') { const n = Number(req.url.split('n=')[1]) || 0; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(Buffer.alloc(n, 120)); return; }
    if (p === '/huge') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(Buffer.alloc(4 * 1024 * 1024, 120)); return; }
    if (p === '/hang') { hang = res; res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    if (p === '/echo') {
      require('../run/js/serveCommon.js').readJsonBody(req).then(function (body) {
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ got: body }));
      }, function (e) { res.writeHead(e.statusCode || 500); res.end(String(e.message)); });
      return;
    }
    if (p === '/api/spirit') return splitAnswer(res, '{"ok":true,"text":"y');
    res.writeHead(404); res.end();
  });
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const rr = require('../run/js/relayRequest.js');
  const a1 = await rr.relayRequest(base, 'GET', '/split', null).catch(function (e) { return { text: 'threw ' + e.message }; });
  if (a1 && a1.text === '{"text":"x' + EMOJI + '"}') test.check('relayRequest resolves an answer split mid-character whole');
  else test.fail(OWED + 'relayRequest gave ' + short(a1 && a1.text));
  // THE CAP IS BODY_MAX (Andy, 2026-10-11: "and answer from a relay is ALWAYS bounded by MAX_PAYLOAD. how the hell
  // could it be otherwise?"): exactly BODY_MAX bytes is accepted, one byte more is refused by name.
  const limitsMod = require('../run/js/limits.js');
  const atCap = await rr.relayRequest(base, 'GET', '/sized?n=' + limitsMod.BODY_MAX, null).then(function (a) { return { len: Buffer.byteLength(a.text) }; }, function (e) { return e; });
  const overCap = await rr.relayRequest(base, 'GET', '/sized?n=' + (limitsMod.BODY_MAX + 1), null).then(function (a) { return { len: Buffer.byteLength(a.text) }; }, function (e) { return e; });
  if (atCap && atCap.len === limitsMod.BODY_MAX && overCap && overCap.code === 'relay-answer-too-large') test.check('relayRequest\'s cap is limits.BODY_MAX: ' + limitsMod.BODY_MAX + ' bytes pass, one more is refused by name (relay-answer-too-large)');
  else test.fail(OWED + 'at BODY_MAX: ' + short(atCap && (atCap.len || atCap.code)) + ', one over: ' + short(overCap && (overCap.code || overCap.len)));
  const a2 = await rr.relayRequest(base, 'GET', '/huge', null).then(function (a) { return { resolved: a.text.length }; }, function (e) { return e; });
  if (a2 && a2.code === 'relay-answer-too-large') test.check('a 4 MB relay answer is refused by name, never held');
  else test.fail(OWED + 'a 4 MB relay answer gave ' + short(a2 && (a2.code || a2.message || a2)));
  const timeoutMs = rr.RELAY_ANSWER_DEADLINE_MS;
  if (typeof timeoutMs !== 'number') test.fail(OWED + 'relayRequest exports no RELAY_ANSWER_DEADLINE_MS');
  else {
    const t0 = Date.now();
    const a3 = await rr.relayRequest(base, 'GET', '/hang', null, null, { timeoutMs: 300 }).then(function () { return null; }, function (e) { return e; });
    if (a3 && a3.code === 'relay-did-not-answer' && Date.now() - t0 < 3000) test.check('relayRequest gives up by name on a relay that never finishes (relay-did-not-answer, deadline ' + timeoutMs + ' ms by default)');
    else test.fail(OWED + 'a hanging relay gave ' + short(a3 && (a3.code || a3.message)) + ' after ' + (Date.now() - t0) + ' ms');
  }
  if (hang) { try { hang.end('}'); } catch (e) { /* gone */ } }

  const sendSplit = function (pathname, json) {
    return new Promise(function (resolve, reject) {
      const whole = Buffer.from(json, 'utf8');
      const cut = whole.indexOf(EMOJI_BYTES) + 2;
      const req = http.request(base + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': whole.length } }, function (res) {
        const c = []; res.on('data', function (x) { c.push(x); }); res.on('end', function () { resolve({ status: res.statusCode, text: Buffer.concat(c).toString('utf8') }); });
      });
      req.on('error', reject);
      req.write(whole.slice(0, cut));
      setTimeout(function () { req.end(whole.slice(cut)); }, 60);
    });
  };
  const e1 = await sendSplit('/echo', JSON.stringify({ label: 'an ' + EMOJI + ' label' }));
  let echoed = null; try { echoed = JSON.parse(e1.text).got; } catch (e) { echoed = null; }
  if (echoed && echoed.label === 'an ' + EMOJI + ' label') test.check('readJsonBody parses a request split mid-character whole');
  else test.fail(OWED + 'readJsonBody gave ' + short(e1.text));
  const limits = require('../run/js/limits.js');
  const over = await new Promise(function (resolve) {
    const big = Buffer.alloc(limits.BODY_MAX + 1, 120);
    const req = http.request(base + '/echo', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, function (res) { res.resume(); resolve(res.statusCode); });
    req.on('error', function () { resolve('reset'); });
    req.end(big);
  });
  if (over === 413 || over === 'reset') test.check('readJsonBody still refuses a body one byte over its cap (' + over + ')');
  else test.fail('readJsonBody accepted a body over its cap: ' + over);

  process.env.SPIRIT_JOB_ID = 'job-split';
  process.env.SPIRIT_CALLBACK_URL = base + '/api/spirit';
  const j1 = await spirit.core.jobs.report({ logMessage: 'x' }).catch(function (e) { return 'threw ' + e.message; });
  if (j1 && j1.text === 'y' + EMOJI) test.check('jobs.report hands back an answer split mid-character whole');
  else test.fail(OWED + 'jobs.report gave ' + short(j1));

  // ── 3 and 4. THE PROXY AND THE TREE ─────────────────────────────────────
  test.subHeading('3. the proxy caps an outside reply; 4. no chunk glue, no length against the routed cap');
  const serverSrc = fs.readFileSync(path.join(RUN, 'js', 'server.js'), 'utf8');
  const proxy = (serverSrc.split('function handleGenericProxy')[1] || '').split('\nfunction ')[0];
  // NO NUMBER AT ALL (Andy, 2026-10-11: "agreed. no number at all."): the outside reply is passed straight to the
  // asker as it arrives, unread, so the node holds nothing and needs no cap.
  const proxyCode = stripComments(proxy);
  if (/\.pipe\(\s*res\s*\)/.test(proxyCode) && !/readBody\(|chunks\.push|Buffer\.concat|PROXY_REPLY_MAX/.test(proxyCode) && !/PROXY_REPLY_MAX/.test(stripComments(serverSrc))) test.check('handleGenericProxy pipes the outside reply straight to the asker, reads none of it and has no cap');
  else test.fail(OWED + 'handleGenericProxy still reads or caps the outside reply instead of passing it through');
  const relaySrc = stripComments(fs.readFileSync(path.join(RUN, 'js', 'relay.js'), 'utf8'));
  const lengths = relaySrc.split('\n').filter(function (l) { return /\.length\s*>\s*MAX_ROUTED_TEXT/.test(l); });
  if (!lengths.length && /byteLength\([^)]*\)\s*>\s*MAX_ROUTED_TEXT/.test(relaySrc)) test.check('relay.js compares bytes against MAX_ROUTED_TEXT, never a .length');
  else test.fail(OWED + 'relay.js still compares .length against MAX_ROUTED_TEXT in ' + lengths.length + ' place(s)');
  const glue = ['kernel.js', 'relayRequest.js', 'serveCommon.js'].filter(function (f) {
    return /(\+=\s*(chunk|c)\b)|(\+=\s*c\s*\))/.test(stripComments(fs.readFileSync(path.join(RUN, 'js', f), 'utf8')));
  });
  if (!glue.length) test.check('kernel.js, relayRequest.js and serveCommon.js glue no chunk into a string');
  else test.fail(OWED + 'chunks still glued into a string in ' + glue.join(', '));
  server.close();
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
