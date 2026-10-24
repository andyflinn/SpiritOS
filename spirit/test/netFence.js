'use strict';

// spirit/test/netFence.js
// goal/G29.20: net.fetch refuses this machine; agents may use it. Red on today's tree; claude-windows writes it and
// builds it (one agent). The item's box (v2):
//   - net.fetch refuses a target on this machine: a loopback address (127.0.0.0/8, ::1, localhost) or an unspecified
//     one (0.0.0.0, ::), which reach this machine when dialled. Refused by name, nothing sent. Checked on the address
//     the name resolves to, at connect, so a name that resolves to loopback is refused too.
//   - Link-local and the LAN stay open (a node binds 127.0.0.1 only, so no other box's node can be reached).
//   - Andy reversed goal/G19.9 and replaced it: "fetch will not be able to reach ports on this machine, and agents may
//     use it." So js/net/fetch.json and js/net/AGENTS.md describe it, deskAgent lists net among its tool namespaces
//     again, and netNoAgentTool.js (G19.9's suite) is retired.
// NAMED HERE where the box names none: js/netFence.js holds the rule, isThisMachine(address) and lookup(hostname,
// options, callback), a dns.lookup that refuses this machine; a refusal answers 403 with code 'this-machine'.
// rule/11: through testSupport only; its own node on its own port; never 65432.

const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/spirit/relayRequest.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by goal/G29.20: ';
const RUN = path.join(__dirname, '..', 'run');
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('goal/G29.20: net.fetch refuses this machine, and agents may use it');

(async function () {
  test.subHeading('1. the rule: which addresses are this machine');
  let fence = null;
  try { fence = require('../run/spirit/netFence.js'); } catch (e) { fence = null; }
  if (fence && typeof fence.isThisMachine === 'function' && typeof fence.lookup === 'function') test.check('spirit/netFence.js holds isThisMachine and lookup');
  else test.fail(OWED + 'no js/netFence.js with isThisMachine and lookup');
  const mine = ['127.0.0.1', '127.8.9.10', '::1', '0.0.0.0', '::', '::ffff:127.0.0.1', 'localhost'];
  const notMine = ['8.8.8.8', '192.168.1.5', '10.0.0.1', '169.254.169.254', '2001:db8::1'];
  const is = function (a) { try { return fence.isThisMachine(a); } catch (e) { return null; } };
  const wrongMine = fence ? mine.filter(function (a) { return is(a) !== true; }) : mine;
  const wrongNot = fence ? notMine.filter(function (a) { return is(a) !== false; }) : notMine;
  if (fence && !wrongMine.length) test.check('this machine: ' + mine.join(', '));
  else test.fail(OWED + 'not counted as this machine: ' + wrongMine.join(', '));
  if (fence && !wrongNot.length) test.check('not this machine, so open: ' + notMine.join(', ') + ' (the LAN and link-local stay open)');
  else test.fail(OWED + 'wrongly fenced: ' + wrongNot.join(', '));
  // "ports on this machine": its own LAN addresses reach them too, so they are this machine.
  const own = [];
  Object.values(os.networkInterfaces()).forEach(function (l) { (l || []).forEach(function (i) { if (i && i.family === 'IPv4' && !i.internal) own.push(i.address); }); });
  if (fence && own.length && own.every(function (a) { return is(a) === true; })) test.check('this machine\'s own interface addresses are this machine too: ' + own.join(', '));
  else if (fence && !own.length) test.check('(no external interface on this box to check)');
  else test.fail(OWED + 'this machine\'s own addresses not fenced: ' + own.filter(function (a) { return is(a) !== true; }).join(', '));
  const looked = fence ? await new Promise(function (resolve) {
    try { fence.lookup('localhost', {}, function (err) { resolve(err || null); }); } catch (e) { resolve(e); }
  }) : null;
  if (looked && looked.code === 'this-machine') test.check('lookup refuses a name that resolves to this machine (localhost), code this-machine');
  else test.fail(OWED + 'lookup of localhost answered ' + JSON.stringify(looked && { code: looked.code, message: looked.message }));

  test.subHeading('2. net.fetch on a running node refuses this machine, and sends nothing');
  let hit = 0;
  const bait = http.createServer(function (req, res) { hit += 1; res.end('reached'); });
  await new Promise(function (r) { bait.listen(0, '127.0.0.1', r); });
  const baitPort = bait.address().port;
  const root = setupRelayFakes('netFence').andy;
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const port = await freePort();
  const node = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const post = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
      return { status: r.status, body: j, text: r.text };
    }, function (e) { return { status: 0, error: String(e && e.message || e) }; });
  };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(200); up = (await post({ verb: 'node.info' })).status > 0; }
    if (!up) test.fail('the node did not boot');
    const fetch = function (url) { return post({ verb: 'net.fetch', url: url, method: 'GET', headers: {}, body: '', timeoutMs: 3000 }); };
    for (const url of ['http://127.0.0.1:' + baitPort + '/', 'http://localhost:' + baitPort + '/', 'http://[::1]:' + baitPort + '/', 'http://0.0.0.0:' + baitPort + '/', 'http://127.0.0.1:' + port + '/api/spirit']) {
      const r = await fetch(url);
      if (r.status === 403 && r.body && r.body.code === 'this-machine') test.check(url + ' refused 403, this-machine');
      else test.fail(OWED + url + ' answered ' + r.status + ' ' + String(r.text || r.error).slice(0, 120));
    }
    if (hit === 0) test.check('and nothing reached the port on this machine');
    else test.fail(OWED + 'the bait on this machine was reached ' + hit + ' time(s)');
  } finally {
    try { node.kill(); } catch (e) { /* gone */ }
    bait.close();
  }

  test.subHeading('3. agents may use it');
  const netDir = path.join(RUN, 'spirit', 'net');
  let described = null;
  try { described = JSON.parse(fs.readFileSync(path.join(netDir, 'fetch.json'), 'utf8')); } catch (e) { described = null; }
  if (described && typeof described.description === 'string' && /this machine/i.test(described.description)) test.check('spirit/net/fetch.json describes net.fetch, saying it cannot reach this machine');
  else test.fail(OWED + 'spirit/net/fetch.json missing, or not saying it cannot reach this machine');
  if (fs.existsSync(path.join(netDir, 'AGENTS.md'))) test.check('spirit/net/AGENTS.md opens the namespace to agents');
  else test.fail(OWED + 'no js/net/AGENTS.md');
  const agent = code('process/js/deskAgent/deskAgent.js');
  const namespaces = (/const TOOL_NAMESPACES = \[([^\]]*)\]/.exec(agent) || [])[1] || '';
  if (/'net'/.test(namespaces)) test.check('deskAgent lists net among its tool namespaces: ' + namespaces.trim());
  else test.fail(OWED + 'deskAgent\'s TOOL_NAMESPACES are ' + namespaces.trim());
  if (!fs.existsSync(path.join(__dirname, 'netNoAgentTool.js'))) test.check('goal/G19.9\'s netNoAgentTool.js is retired with the ruling it held');
  else test.fail(OWED + 'spirit/test/netNoAgentTool.js still asserts the reversed ruling');

  // ── 4. NO SECRETS IN NET.FETCH, AND THEIR USERS GO (box v4) ─────────────
  // Andy, 2026-10-18: "remove all the env logic and allow-list crap from it at well", "kill'em all, they will be replaced
  // with from-scratch conforming designs....", "the GROK API key stuff, it all goes....".
  test.subHeading('4. no env secrets, no allow list, no proxy verbs; grokReview and the caption processes gone');
  // And all the LM Studio stuff (Andy, 2026-10-18: "delete all LM studio stuff as well. it all goes.").
  const gone = ['spirit/envSecrets.js', 'spirit/proxyList.js', 'spirit/proxy', 'process/js/grokReview', 'process/js/imageCaptionClaude', 'process/js/imageCaptionClaudeBatch',
    'process/js/imageCaptionLmStudio', 'process/js/lmStudioLoadModel', 'process/js/lmStudioUnloadModel']
    .filter(function (rel) { return fs.existsSync(path.join(RUN, rel)); });
  if (!gone.length) test.check('gone: js/envSecrets.js, js/proxyList.js, js/proxy/, process/js/grokReview, imageCaptionClaude, imageCaptionClaudeBatch, and every LM Studio process');
  else test.fail(OWED + 'still there: ' + gone.join(', '));
  const lmCode = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === 'media' || e.name === 'currentGoal.json') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|json|html)$/.test(e.name) && /lm ?studio/i.test(fs.readFileSync(full, 'utf8').replace(/goal\/G29\.20/g, ''))) lmCode.push(path.relative(RUN, full).split(path.sep).join('/'));
    });
  })(RUN);
  const lmLeft = lmCode.filter(function (rel) { return !/LM Studio ones went, and every LM Studio process with them/.test(fs.readFileSync(path.join(RUN, rel), 'utf8')); });
  if (!lmLeft.length) test.check('no code under spirit/run names LM Studio but the one line saying it went');
  else test.fail(OWED + 'LM Studio still named in ' + lmLeft.join(', '));
  const suites = ['envSecrets.js', 'proxyList.js', 'grokReview.js'].filter(function (t) { return fs.existsSync(path.join(__dirname, t)); });
  if (!suites.length) test.check('their suites retire: envSecrets.js, proxyList.js, grokReview.js');
  else test.fail(OWED + 'suites still asserting them: ' + suites.join(', '));
  const server = code('spirit/server.js');
  const verbs = ['proxy.search', 'proxy.get', 'proxy.allow', 'proxy.remove', 'proxy.close', 'proxy.open'].filter(function (v) { return server.indexOf("'" + v + "'") !== -1; });
  if (!verbs.length && !/envSecrets|proxyList/.test(server) && !/\$\{ENV:/.test(server)) test.check('server.js: no proxy verbs, no envSecrets or proxyList, no ${ENV:...} fill');
  else test.fail(OWED + 'server.js still has ' + (verbs.length ? verbs.join(', ') : 'the env fill or the allow list'));
  const errors = code('spirit/spiritErrors.js');
  if (!/'proxy-closed'|'proxy-list-broken'/.test(errors)) test.check('the refusal codes proxy-closed and proxy-list-broken are gone');
  else test.fail(OWED + 'spiritErrors.js still defines the proxy codes');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
