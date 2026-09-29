'use strict';

// spirit/test/appServer.js
// THE SERVER-SIDE REQUEST ROUTER — appPair/G1.2, written FIRST, red today.
//
//   Andy, 2026-09-28: "the appServer is the request-router server-side".
//   Decided in the design session (Desk, appPair/G1): an app hands the
//   helper its verbs; 'api' answers {verb: {request, reply}} (D3, D10);
//   a call is {verb: {args}}, key-matched against the verb's request
//   prototype (D8, D10); the reply is the verb's own, no wrapper (D11);
//   every error is {ok: false, code, error} with a code spiritErrors
//   knows (D12); 'api' and 'ok' are never verb names (D13, D14); the app
//   never names its pipe, the node hands it over as --pipe (D15).
//
// Every call goes over a real pipe, as the node's appClient sends it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const errors = require('../run/js/spiritErrors.js');
const { pipeRequest } = require('../run/js/relayRequest.js');
const appClient = require('../run/js/appClient.js');

test.startTest('appPair/G1.2: appServer.js, the server-side request router');

const OWED = 'OWED by appPair/G1.2: ';
const HELPER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');
const helper = fs.existsSync(HELPER) ? require(HELPER) : null;
const has = function (name) { return !!helper && typeof helper[name] === 'function'; };

// One sample app: two verbs, and a record of every handler call.
const calls = [];
const VERBS = {
  greet: { request: { name: '' }, reply: { text: '' },
    handler: function (args) { calls.push(Array.prototype.slice.call(arguments)); return { text: 'hello ' + args.name }; } },
  add: { request: { a: 0, b: 0, opts: { round: false } }, reply: { sum: 0 },
    handler: function (args) { calls.push(Array.prototype.slice.call(arguments)); return { sum: args.a + args.b }; } },
};

function ask(pipe, body) {
  return pipeRequest(pipe, 'POST', '/', JSON.stringify(body), { type: 'application/json', timeoutMs: 3000 }).then(function (a) {
    let parsed = null;
    try { parsed = JSON.parse(a.text); } catch (e) { parsed = null; }
    return { status: a.status, body: parsed, refused: a.refused };
  });
}
function isError(b, code) {
  return !!b && b.ok === false && b.code === code && typeof b.error === 'string' && !!errors.byCode(code);
}
function tmpPipe(name) { const p = appClient.pipePathFor(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appserver-')), name); try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) {} return p; }

(async function () {
  const pipe = tmpPipe('sample');
  let server = null;
  if (has('createAppServer')) {
    server = helper.createAppServer(VERBS);
    await new Promise(function (r) { server.listen(pipe, r); });
  }
  const up = !!server;
  const errs = [];

  test.subHeading('T1: api answers {verb: {request, reply}} and nothing else');
  const api = up ? await ask(pipe, 'api') : null;
  const want = { greet: { request: { name: '' }, reply: { text: '' } }, add: { request: { a: 0, b: 0, opts: { round: false } }, reply: { sum: 0 } } };
  if (api && api.status === 200 && JSON.stringify(api.body) === JSON.stringify(want)) test.check('api lists both verbs as {request, reply}, handlers left out');
  else test.fail(OWED + (up ? 'api answered ' + JSON.stringify(api) : 'there is no appServer.createAppServer(verbs)'));

  test.subHeading('T2: a call reaches its verb, and its answer comes back unchanged');
  calls.length = 0;
  const g = up ? await ask(pipe, { greet: { name: 'Andy' } }) : null;
  if (g && g.status === 200 && JSON.stringify(g.body) === JSON.stringify({ text: 'hello Andy' }) && calls.length === 1) {
    test.check('{greet: {name}} ran greet once and its reply arrived as it was returned');
  } else test.fail(OWED + 'greet answered ' + JSON.stringify(g) + ' after ' + calls.length + ' handler call(s)');

  test.subHeading('T3: a verb it does not have is refused as no-such-verb');
  const nv = up ? await ask(pipe, { shout: { name: 'x' } }) : null;
  if (nv) errs.push(nv.body);
  if (nv && isError(nv.body, 'no-such-verb')) test.check('{shout: ...} is refused as no-such-verb');
  else test.fail(OWED + 'an unknown verb answered ' + JSON.stringify(nv));

  test.subHeading('T4: nothing about the caller reaches the handler');
  calls.length = 0;
  if (up) await ask(pipe, { add: { a: 1, b: 2, opts: { round: true } } });
  const only = calls.length === 1 && calls[0].length === 1 &&
    JSON.stringify(calls[0][0]) === JSON.stringify({ a: 1, b: 2, opts: { round: true } });
  if (only) test.check('the handler got exactly one argument: the args, and nothing else');
  else test.fail(OWED + 'the handler was called with ' + JSON.stringify(calls));

  test.subHeading('T5: arguments that do not match the request prototype never reach the verb');
  calls.length = 0;
  const bad = [
    { add: { a: 1 } },                                      // missing
    { add: { a: 1, b: 2, opts: { round: true }, c: 3 } },   // extra
    { add: { a: '1', b: 2, opts: { round: true } } },       // wrong type
    { add: { a: 1, b: 2, opts: { round: 'yes' } } },        // wrong type, nested
    { add: { a: 1, b: 2, opts: {} } },                      // missing, nested
    { add: 5 },                                             // not an object
  ];
  const answers = [];
  for (const b of bad) { if (up) answers.push(await ask(pipe, b)); }
  answers.forEach(function (a) { errs.push(a.body); });
  if (up && answers.every(function (a) { return isError(a.body, 'no-such-argument'); }) && calls.length === 0) {
    test.check('missing, extra, wrongly typed (also nested) and non-object arguments are all no-such-argument, and add never ran');
  } else test.fail(OWED + 'mismatched arguments answered ' + JSON.stringify(answers.map(function (a) { return a.body; })) + ', handler ran ' + calls.length);

  test.subHeading('T6: an app server built on the helper names no pipe; the node hands it over as --pipe');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appserver-app-'));
  const sample = path.join(dir, 'sample.js');
  fs.writeFileSync(sample, "require(" + JSON.stringify(HELPER) + ").serve({\n" +
    "  echo: { request: { text: '' }, reply: { text: '' }, handler: function (a) { return { text: a.text }; } },\n});\n");
  const pipe6 = tmpPipe('echo');
  let t6 = false;
  let child = null;
  if (has('serve')) {
    child = spawn(process.execPath, [sample, '--pipe', pipe6], { stdio: 'ignore' });
    const until = Date.now() + 5000;
    let e = null;
    while (Date.now() < until) {
      e = await ask(pipe6, { echo: { text: 'hi' } });
      if (e.status === 200) break;
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    t6 = !!e && e.status === 200 && e.body && e.body.text === 'hi' && !/pipe/i.test(fs.readFileSync(sample, 'utf8'));
  }
  if (t6) test.check('a sample app of verbs only, started with --pipe, answered on that pipe');
  else test.fail(OWED + (has('serve') ? 'the sample app did not answer on the pipe it was handed' : 'there is no appServer.serve(verbs) that reads --pipe'));
  if (child) child.kill();

  test.subHeading('T7: every error it returns is {ok: false, code, error}, a code spiritErrors knows');
  const malformed = up ? await ask(pipe, { greet: { name: 'a' }, add: { a: 1, b: 2, opts: { round: true } } }) : null;
  if (malformed) errs.push(malformed.body);
  const shaped = errs.length > 0 && errs.every(function (b) {
    return b && b.ok === false && typeof b.code === 'string' && typeof b.error === 'string' && !!errors.byCode(b.code) &&
      Object.keys(b).every(function (k) { return ['ok', 'code', 'error', 'extra'].indexOf(k) !== -1; });
  });
  if (shaped && malformed && isError(malformed.body, 'bad-request')) test.check(errs.length + ' errors, every one {ok: false, code, error} with a known code; two verbs at once is bad-request');
  else test.fail(OWED + 'errors seen: ' + JSON.stringify(errs));

  test.subHeading('D13, D14: api and ok can never be verb names');
  let refusedNames = [];
  if (has('createAppServer')) {
    ['api', 'ok'].forEach(function (name) {
      const v = {}; v[name] = { request: {}, reply: {}, handler: function () { return {}; } };
      try { helper.createAppServer(v); } catch (e) { refusedNames.push(name); }
    });
  }
  if (refusedNames.join(',') === 'api,ok') test.check('declaring a verb named api or ok throws at once');
  else test.fail(OWED + 'reserved names refused: ' + JSON.stringify(refusedNames));

  // wsl-claude's review of 2e9e1850, Andy: "go for the proposed fix". A
  // reply is the verb's declared shape or nothing (D11), and 'ok' is the
  // reserved reply key (D12), so no reply can pass for an error.
  test.subHeading('T8: a reply prototype with an ok key is refused when the verb is declared');
  let okRefused = false;
  if (has('createAppServer')) {
    try { helper.createAppServer({ sneaky: { request: {}, reply: { ok: false }, handler: function () { return { ok: false }; } } }); }
    catch (e) { okRefused = true; }
  }
  if (okRefused) test.check('declaring a reply prototype that carries ok throws at once');
  else test.fail(OWED + 'a reply prototype with an ok key was accepted');

  test.subHeading('T9: a reply that does not match its prototype never reaches the caller');
  const pipe9 = tmpPipe('liar');
  let t9 = null;
  if (has('createAppServer')) {
    const liar = helper.createAppServer({
      claim: { request: {}, reply: { sum: 0 }, handler: function () { return { ok: false, code: 'no-such-verb', error: 'no such verb' }; } },
    });
    await new Promise(function (r) { liar.listen(pipe9, r); });
    t9 = await ask(pipe9, { claim: {} });
    liar.close();
  }
  if (t9 && isError(t9.body, 'handler-failed')) test.check('a reply shaped like an error, not like its prototype, became handler-failed');
  else test.fail(OWED + 'a mismatched reply answered ' + JSON.stringify(t9));

  if (server) server.close();
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
}());
