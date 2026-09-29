'use strict';

// spirit/test/appApi.js
// THE NODE'S 'api' — appPair/G1.3, written FIRST, red on today's code.
//
//   Andy, 2026-09-29: go on appPair/G1.3, under his rule "they must be red
//   before wsl pulls the implementation, and green after".
//
// Decided (Desk, appPair/G1): only the node receives 'api' (D2); it asks
// every appServer at once, 12 s each (O3), and answers {app: tree} (D2, D3);
// a call is {app: {verb: {args}}} and the node hands {verb: {args}} to that
// app (D10); the reply arrives as the verb returned it (D11); every error is
// {ok: false, code, error} with a code the register knows (D12); a missing
// app's branch is that error itself (O2); the node refuses only what it
// cannot route (D9); no cache (D6).
//
// The contract tested (wsl-claude's, sent to claude-windows before the
// build): createAppClient(...) returns ask(body) -> Promise<{status, body}>.
// These drive ask() against real app servers built on appServer.js, on the
// pipes the node names. The member's side (over peerPost, and a
// non-member refused at the front door, T6) is added once the node's wiring
// is named.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const relay = require('../run/js/relayRequest.js');
const errors = require('../run/js/spiritErrors.js');

test.startTest('appPair/G1.3: the node answers api from its app servers, and routes a call');

const OWED = 'OWED by appPair/G1.3: ';
const HELPER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');

// A node's folder with three serving apps; gamma never starts.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appapi-'));
['alpha', 'beta', 'gamma'].forEach(function (name) {
  fs.mkdirSync(path.join(root, 'shell', name), { recursive: true });
  fs.writeFileSync(path.join(root, 'shell', name, name + '.json'), JSON.stringify({ name: name, serves: true }));
});

function appScript(name, verbsSrc) {
  const file = path.join(root, name + '-server.js');
  fs.writeFileSync(file, 'require(' + JSON.stringify(HELPER) + ').serve(' + verbsSrc + ');\n');
  return file;
}
const ALPHA = "{ greet: { request: { name: '' }, reply: { text: '' }, handler: function (a) { return { text: 'hi ' + a.name }; } } }";
const BETA1 = "{ add: { request: { a: 0, b: 0 }, reply: { sum: 0 }, handler: function (x) { return { sum: x.a + x.b }; } } }";
const BETA2 = "{ add: { request: { a: 0, b: 0 }, reply: { sum: 0 }, handler: function (x) { return { sum: x.a + x.b }; } }," +
  " mul: { request: { a: 0, b: 0 }, reply: { product: 0 }, handler: function (x) { return { product: x.a * x.b }; } } }";

const children = [];
function start(name, src) {
  const pipe = appClient.pipePathFor(root, name);
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const child = spawn(process.execPath, [appScript(name, src), '--pipe', pipe], { stdio: 'ignore' });
  children.push(child);
  return { child: child, pipe: pipe };
}
function up(pipe) {
  const until = Date.now() + 8000;
  return (function poll() {
    return Promise.resolve(relay.pipeRequest(pipe, 'POST', '/', JSON.stringify('api'), { timeoutMs: 1000 }))
      .then(function (a) { return !!(a && !a.refused && a.status === 200); }, function () { return false; })
      .then(function (ok) { return ok || Date.now() > until ? ok : new Promise(function (r) { setTimeout(r, 150); }).then(poll); });
  }());
}
function direct(pipe) {
  return Promise.resolve(relay.pipeRequest(pipe, 'POST', '/', JSON.stringify('api'), { timeoutMs: 3000 }))
    .then(function (a) { try { return JSON.parse(a.text); } catch (e) { return null; } });
}
function isError(b, code) {
  return !!b && b.ok === false && typeof b.code === 'string' && typeof b.error === 'string' &&
    !!errors.byCode(b.code) && (!code || b.code === code);
}
const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

// Every request that reaches an app server's pipe is counted: a refusal the
// node owns must reach none (T7).
let knocks = 0;
function counting(pipe, method, p, body, opts) { knocks += 1; return relay.pipeRequest(pipe, method, p, body, opts); }

const client = appClient.createAppClient({ rootDir: root, startServerJob: function () { return null; }, log: function () {}, request: counting });
const hasAsk = client && typeof client.ask === 'function';
const errs = [];
function ask(body) {
  if (!hasAsk) return Promise.resolve({ status: 0, body: null });
  return Promise.resolve(client.ask(body)).then(function (r) {
    if (r && r.body && r.body.ok === false) errs.push(r.body);
    // A down app's branch inside an api answer is an error too (O2).
    if (body === 'api' && r && r.body && typeof r.body === 'object') {
      Object.keys(r.body).forEach(function (k) { if (r.body[k] && r.body[k].ok === false) errs.push(r.body[k]); });
    }
    return r || { status: 0, body: null };
  }, function (e) { return { status: 0, body: null, threw: e.message }; });
}

const alpha = start('alpha', ALPHA);
let beta = start('beta', BETA1);

Promise.all([up(alpha.pipe), up(beta.pipe)]).then(function (ready) {
  if (!ready[0] || !ready[1]) test.fail('setup: the sample app servers did not come up on their pipes');
  client.startAll();
  return ask('api');
}).then(function (r) {
  test.subHeading('T1: api answers {app: tree}, one branch per running appServer');
  const b = r.body;
  if (hasAsk && r.status === 200 && b && b.alpha && b.alpha.greet && b.beta && b.beta.add) {
    test.check('api answered {alpha: {greet}, beta: {add}, ...}');
  } else {
    test.fail(OWED + (hasAsk ? 'api answered ' + r.status + ' ' + JSON.stringify(b) : 'createAppClient returns no ask()'));
  }

  test.subHeading('T3: an appServer that is down is named as missing, and the rest still answer');
  if (hasAsk && b && isError(b.gamma, 'app-not-running') && b.alpha && b.beta) {
    test.check('gamma, never started, is {ok: false, code: app-not-running, error}; alpha and beta still answered');
  } else {
    test.fail(OWED + 'the down app gamma shows as ' + JSON.stringify(b && b.gamma));
  }

  return Promise.all([direct(alpha.pipe), direct(beta.pipe)]).then(function (d) {
    test.subHeading('T2: each branch is exactly what that appServer answered');
    if (hasAsk && b && same(b.alpha, d[0]) && same(b.beta, d[1])) {
      test.check('the alpha and beta branches equal what each app server answers to api on its own pipe');
    } else {
      test.fail(OWED + 'branches differ from the app servers\' own answers');
    }
  });
}).then(function () {
  // T4: beta learns a verb; no cache means the very next ask shows it.
  beta.child.kill();
  return new Promise(function (r) { beta.child.on('exit', r); }).then(function () {
    beta = start('beta', BETA2);
    return up(beta.pipe);
  }).then(function () { return ask('api'); });
}).then(function (r) {
  test.subHeading('T4: a second ask after an appServer changes its verbs shows the change');
  if (hasAsk && r.body && r.body.beta && r.body.beta.mul) {
    test.check('after beta restarted with a new verb, the next api lists mul: nothing was cached');
  } else {
    test.fail(OWED + 'after beta gained mul, api answered ' + JSON.stringify(r.body && r.body.beta));
  }
  return ask({ alpha: { greet: { name: 'Andy' } } });
}).then(function (r) {
  test.subHeading('T8: a call\'s reply reaches the member exactly as the verb returned it');
  if (hasAsk && r.status === 200 && same(r.body, { text: 'hi Andy' })) {
    test.check('{alpha: {greet: {name: "Andy"}}} answered {text: "hi Andy"}, no wrapper');
  } else {
    test.fail(OWED + 'the call answered ' + r.status + ' ' + JSON.stringify(r.body));
  }
  return ask({ nope: { x: {} } });
}).then(function (r) {
  test.subHeading('T5: a request for an app the node does not run is refused as app-not-served');
  if (hasAsk && isError(r.body, 'app-not-served')) test.check('{nope: ...} is app-not-served, from the node');
  else test.fail(OWED + '{nope: ...} answered ' + JSON.stringify(r.body));

  test.subHeading('T7: a malformed request is refused as bad-request and reaches no appServer');
  const bad = [5, null, 'hello', {}, { alpha: { greet: { name: 'a' } }, beta: { add: { a: 1, b: 2 } } },
    { '../alpha': { greet: { name: 'a' } } }, { alpha: 'greet' }];
  const before = knocks;
  return Promise.all(bad.map(ask)).then(function (rs) {
    const wrong = rs.map(function (x, i) { return isError(x.body, 'bad-request') ? null : JSON.stringify(bad[i]) + ' -> ' + JSON.stringify(x.body); }).filter(Boolean);
    if (hasAsk && !wrong.length && knocks === before) {
      test.check('not an object, empty, two apps at once, a path for a name and a non-object call: all bad-request, no pipe touched');
    } else {
      test.fail(OWED + (wrong.length ? 'not bad-request: ' + wrong.join(' | ') : (knocks - before) + ' malformed request(s) reached an app server'));
    }
  });
}).then(function () {
  test.subHeading('T9: every error the node returned is {ok: false, code, error} with a known code');
  const odd = errs.filter(function (e) { return !isError(e); });
  if (hasAsk && errs.length >= 9 && !odd.length) {
    test.check(errs.length + ' errors, every one {ok: false, code, error} with a code spiritErrors knows');
  } else {
    test.fail(OWED + (hasAsk ? JSON.stringify(odd.slice(0, 3)) + ' among ' + errs.length + ' errors' : 'no errors to check: no ask()'));
  }
}).catch(function (e) {
  test.fail(OWED + 'the run broke: ' + e.message);
}).then(function () {
  children.forEach(function (c) { try { c.kill(); } catch (e) { /* gone */ } });
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* in use */ }
  test.reportSuccessFailureCount();
});
