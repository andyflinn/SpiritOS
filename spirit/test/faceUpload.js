'use strict';

// spirit/test/faceUpload.js
// goal/G30.10, the gap left after its four steps: "The home node's face uploads go through relayRequest, the one
// outbound door, as a streamed upload; faceHome reaches for no http of its own." Andy, on the oneDoor red: "do that."
// Red on today's tree; claude-windows writes it and builds it (one agent).
// NAMED HERE where the box names none:
//   - relayRequest.relayUpload(relayUrl, pathname, headers) -> a writable request: what is written goes out as it is
//     written (no length known, so chunked), the relay's answer is read and dropped; an address assertRelayUrl refuses
//     is refused before any socket opens, said on the request's 'error'.
//   - faceHome's default upload is relayUpload, and faceHome holds no http, https or fetch of its own (oneDoor's
//     tally for it is zero; relayRequest's stays where it is).
// A loopback server stands in for the relay. rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.10: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('goal/G30.10: the face uploads through relayRequest, the one outbound door');

const relayRequest = require('../run/js/relayRequest');
const made = typeof relayRequest.relayUpload === 'function';

// The stand-in relay: it notes each chunk as it arrives, and when the upload ended.
const seen = { chunks: [], headers: null, endedAt: 0, firstAt: 0 };
const server = http.createServer(function (req, res) {
  seen.headers = req.headers;
  req.on('data', function (c) { if (!seen.firstAt) seen.firstAt = Date.now(); seen.chunks.push(c.toString('utf8')); });
  req.on('end', function () { seen.endedAt = Date.now(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
});

const done = new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); }).then(async function () {
  const base = 'http://127.0.0.1:' + server.address().port;

  test.subHeading('1. a streamed upload, sent as it is written');
  let req = null;
  let answered = null;
  try {
    req = relayRequest.relayUpload(base, '/api/relay/face/stream', { 'x-spirit-from': 'KEY', 'x-spirit-sig': 'SIG' });
    req.on('response', function (r) { answered = r.statusCode; });
    req.write('{"event":"a"}\n');
    await wait(150);
    req.write('{"event":"b"}\n');
    await wait(150);
    req.end();
    await wait(150);
  } catch (e) { answered = 'threw ' + e.message; }
  const streamed = seen.firstAt && seen.endedAt && seen.endedAt - seen.firstAt >= 200;
  if (made && answered === 200 && seen.chunks.join('') === '{"event":"a"}\n{"event":"b"}\n' && streamed
      && seen.headers && seen.headers['x-spirit-sig'] === 'SIG' && seen.headers['transfer-encoding'] === 'chunked')
    test.check('relayUpload sends each write as it happens, chunked, with the headers it was given, and reads the answer');
  else test.fail(OWED + 'relayUpload: answered ' + short(answered) + ', the relay saw ' + short({ chunks: seen.chunks, streamed: streamed, headers: seen.headers && { sig: seen.headers['x-spirit-sig'], te: seen.headers['transfer-encoding'] } }));

  let refused = null;
  try {
    const bad = relayRequest.relayUpload('http://example.com', '/api/relay/face/stream', {});
    refused = await new Promise(function (r) { bad.on('error', function (e) { r(e.message); }); setTimeout(function () { r(null); }, 1000); });
  } catch (e) { refused = 'threw ' + e.message; }
  if (made && refused && !/^threw/.test(refused))
    test.check('an address that is not a relay (plain http off loopback) is refused, said on the request\'s error');
  else test.fail(OWED + 'a plain-http upload off loopback got ' + short(refused));

  test.subHeading('2. faceHome uses it, and reaches for nothing itself');
  const fh = code('js/faceHome.js');
  const reaches = (fh.match(/\bfetch\s*\(|require\(\s*['"]https?['"]\s*\)|\bhttps?\.request\s*\(|\bnew\s+EventSource\b|\bnew\s+XMLHttpRequest\b/g) || []).length;
  if (reaches === 0 && /relayUpload/.test(fh))
    test.check('faceHome uploads through relayRequest.relayUpload and holds no http of its own (oneDoor tally zero)');
  else test.fail(OWED + 'faceHome still reaches ' + reaches + ' times, or does not use relayUpload');
}).catch(function (e) { test.fail('the suite threw ' + e.message); });

done.then(function () {
  server.close();
  test.reportSuccessFailureCount();
  process.exit(0);
});
