'use strict';

// spirit/test/callEnvelope.js
// goal/G41.15: A CALL KEEPS ITS VERB NAME APART FROM ITS ARGUMENTS (spec: ./callEnvelope.md). The box: "ONE ENVELOPE for
// every call to a node's door: { call: \"<family>.<verb>\", args: { ... } }", "The door ... reads the name from
// body.call and hands body.args to the verb as they came: it never looks inside args", "The flat form { verb, ...args }
// goes, everywhere, in the same item; the door refuses it bad-request", and "An argument named \"verb\" reaches its verb
// unchanged, by every path."
// The builders are run in node, each with fetch caught; the door is a scratch node of its own (setupRelayFakes), asked
// over HTTP as any caller asks it; the rest of the tree is read by a drift guard, as spiritErrors.js reads it.

const fs = require('fs');
const net = require('net');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/spirit/relayRequest.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(200); } return fn(); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
// The envelope, exactly: the name in call, the arguments in args, nothing else in the body.
const ARGS = { op: 'add', bundle: 7, family: 'desk', verb: 'chat.add' };
function isEnvelope(body, name) {
  return !!body && typeof body === 'object' && JSON.stringify(Object.keys(body).sort()) === '["args","call"]' &&
    body.call === name && JSON.stringify(body.args) === JSON.stringify(ARGS);
}
// A fetch that keeps what it was sent and answers {} at once.
function catcher() {
  const sent = [];
  const f = function (url, init) {
    let body = null; try { body = JSON.parse(init && init.body); } catch (e) { body = null; }
    sent.push({ url: String(url), body: body });
    return Promise.resolve({ status: 200, ok: true, text: function () { return Promise.resolve('{}'); }, json: function () { return Promise.resolve({}); } });
  };
  f.sent = sent;
  return f;
}

test.startTest('goal/G41.15: a call keeps its verb name apart from its arguments');

(async function () {
  test.subHeading('the builders send { call, args }');
  // The shell's kernel, spirit.core.ask, on the home node (no face transport).
  {
    const f = catcher();
    const win = { spirit: {} };
    const ctx = { window: win, spirit: win.spirit, fetch: f, console: { log: function () {}, error: function () {}, warn: function () {} },
      setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, JSON: JSON, Object: Object, document: { addEventListener: function () {} }, navigator: {} };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    let loaded = true;
    try { vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'kernel.js'), 'utf8'), ctx, { filename: 'kernel.js' }); } catch (e) { loaded = false; }
    const sp = ctx.window.spirit;
    const ask = sp && sp.core && sp.core.ask;
    if (loaded && typeof ask === 'function') { await ask('auth.branch', Object.assign({}, ARGS)); }
    const got = f.sent[0];
    ok(got && /\/api\/spirit$/.test(got.url) && isEnvelope(got.body, 'auth.branch'), 'kernel.js spirit.core.ask posts { call: auth.branch, args } to /api/spirit, args.verb kept',
      'kernel posted ' + short(got));
  }
  // spirit.js, on a node: spirit.tree() asks the api tree, through post, the one builder every verb goes through.
  {
    const f = catcher();
    const was = global.fetch;
    global.fetch = f;
    const file = require.resolve(path.join(RUN, 'spirit.js'));
    delete require.cache[file];
    const s = require(file);
    if (s && typeof s.tree === 'function') s.tree().then(null, function () { /* the caught fetch answers no tree */ });
    await sleep(50);
    global.fetch = was;
    const first = f.sent.filter(function (x) { return /\/api\/spirit$/.test(x.url); })[0];
    ok(first && first.body && JSON.stringify(Object.keys(first.body).sort()) === '["args","call"]' && first.body.call === 'api' && JSON.stringify(first.body.args) === '{}',
      'spirit.js on a node posts { call: api, args: {} } for spirit.tree(): post builds the envelope', 'spirit.js posted ' + short(first));
    void s;
  }
  // The shell's shared ask (an ES module, read as a script here).
  {
    const f = catcher();
    const src = fs.readFileSync(path.join(RUN, 'shell', 'shared', 'ask.js'), 'utf8').replace(/export\s+default\s+ask;?/, '').replace(/export\s+async\s+function/, 'async function');
    const ctx = { fetch: f, JSON: JSON, Object: Object, String: String, Promise: Promise };
    vm.createContext(ctx);
    vm.runInContext(src + '\nthis.__ask = ask;', ctx, { filename: 'ask.js' });
    await ctx.__ask('auth.branch', Object.assign({}, ARGS));
    ok(f.sent[0] && isEnvelope(f.sent[0].body, 'auth.branch'), 'shell/shared/ask.js posts { call, args }, args.verb kept', 'ask.js posted ' + short(f.sent[0]));
  }

  test.subHeading('the door reads call and hands args on, unread');
  const root = setupRelayFakes('callEnvelope').andy;
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const post = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
      return { status: r.status, body: j || {} };
    }, function () { return { status: 0, body: {} }; });
  };
  try {
    // Up, and its fileServer served, in whichever shape the door takes today: this waits, it judges nothing.
    const up = await until(function () { return post({ call: 'api', args: {} }).then(function (r) { return r.status > 0; }); }, 15000);
    const tree = function (r) { return !!(r.body && r.body.fileServer && r.body.fileServer.ok !== false); };
    const served = up && await until(function () {
      return Promise.all([post({ call: 'api', args: {} }), post({ verb: 'api' })]).then(function (rs) { return rs.some(tree); });
    }, 60000);
    if (!served) { test.fail('the scratch node did not come up with its fileServer: every door check would blame the wrong thing'); return; }
    const t = await post({ call: 'api', args: {} });
    ok(t.status === 200 && tree(t), 'and { call: api, args: {} } answers the tree', 'api answered ' + t.status + ' ' + short(t.body).slice(0, 120));
    // fileServer.status takes { hash } and refuses any other argument by name (appServer.js): an argument named verb that
    // reaches it is refused no-such-argument, which only happens if the door handed it on as it came.
    const plain = await post({ call: 'fileServer.status', args: { hash: '' } });
    ok(plain.body && plain.body.code === 'no-such-file', 'an app server\'s verb is reached by its envelope: fileServer.status answers its own refusal, no-such-file', 'answered ' + plain.status + ' ' + short(plain.body));
    const withVerb = await post({ call: 'fileServer.status', args: { hash: '', verb: 'chat.add' } });
    ok(withVerb.body && withVerb.body.code === 'no-such-argument', 'an argument named verb reaches the verb called, unchanged: fileServer.status sees it and refuses it as its own argument',
      'answered ' + withVerb.status + ' ' + short(withVerb.body));
    const flat = await post({ verb: 'api' });
    ok(flat.status === 400 && flat.body && flat.body.code === 'bad-request', 'the flat form { verb, ... } is refused 400 bad-request', 'flat answered ' + flat.status + ' ' + short(flat.body));
    ok(/call/.test(String(flat.body && flat.body.error || '')) && /args/.test(String(flat.body && flat.body.error || '')), 'and the refusal names the envelope it wants, call and args', 'error: ' + short(flat.body && flat.body.error));
    const loose = await post({ call: 'api', args: [] });
    const extra = await post({ call: 'api', args: {}, verb: 'api' });
    // Judged only beside an envelope the door takes: a door that refuses everything refuses these too, and proves nothing.
    ok(t.status === 200 && loose.status === 400 && extra.status === 400, 'args that are not an object, or anything beside call and args, is refused 400, where the plain envelope is taken',
      'plain ' + t.status + ', array args ' + loose.status + ', extra field ' + extra.status);
  } finally {
    child.kill();
    await sleep(500);
  }

  test.subHeading('no file builds or reads the flat form any more (the drift guard)');
  // Every file on G41.15's list that builds or reads a call to the door. deskClient.js is on the list but builds none (its
  // desk verb took name for its argument in goal/G30.6, for this same clash); its rows' own verb field is data, not a call.
  // Comments are not code.
  const FILES = ['spirit.js', 'spirit/kernel.js', 'spirit/server.js', 'spirit/verbTable.js', 'spirit/apiDoor.js', 'spirit/faceHome.js',
    'spirit/events/events.js', 'spirit/client/shell.js', 'shell/boot.js', 'shell/shared/ask.js'];
  const FLAT = [
    { re: /\b(?:payload|request)\s*=\s*\{\s*verb\s*:/, what: 'a payload built { verb: ... }' },
    // { verb: name, body } is the nested form of an owner command, not a call to the door, and is left alone.
    { re: /JSON\.stringify\(\s*(?:Object\.assign\(\s*)?\{\s*verb\s*:(?![^}]*\bbody\s*:)/, what: 'a body stringified { verb, ... }' },
    { re: /Object\.assign\(\s*\{\s*\}\s*,[^)]*\{\s*verb\s*:\s*verb\s*\}\s*\)/, what: 'arguments folded with { verb }' },
    { re: /\bbody\s*&&\s*body\.verb\b|\bbody\.verb\b/, what: 'the door reading body.verb' },
    { re: /delete\s+\w+\.verb\b/, what: 'an argument named verb dropped' },
    { re: /k\s*!==\s*'verb'/, what: 'an argument named verb skipped' },
    { re: /\br\.verb\b/, what: 'the face request read as r.verb', only: 'spirit/faceHome.js' },
  ];
  const found = [];
  FILES.forEach(function (rel) {
    let src = '';
    try { src = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { found.push(rel + ': missing'); return; }
    src.split('\n').forEach(function (line, i) {
      const code = line.replace(/\/\/.*$/, '');
      FLAT.forEach(function (p) { if ((!p.only || p.only === rel) && p.re.test(code)) found.push(rel + ':' + (i + 1) + ' ' + p.what); });
    });
  });
  ok(found.length === 0, 'none of the ten files builds { verb, ...args }, reads body.verb, or drops an argument named verb', 'still flat: ' + found.slice(0, 40).join('; '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
