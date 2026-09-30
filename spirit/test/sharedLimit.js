'use strict';

// The shared layer refuses an oversized payload, at once and by name, for every app.
//   Andy: "the shared layer MUST instantly reject a payload, when the json exceeds the maximum size, that will make
//   this never happen again. where the fixing you're trying is only for desk", "would have been diagnosed in an
//   instant had the shell rejected the package. THE SHELL CHOKED", "and downstream who else didn't do their job.
//   think!", "and , like i said, this needs a test".
// The contract the builder follows (one limit, MAX_PAYLOAD, at every stage a payload passes):
//   1. appServer measures every reply before it leaves; one over the limit is refused by the server itself,
//      answer-too-large, with extra.bytes and extra.max. Checked on a throwaway server, raw on its pipe.
//   2. appServer.publish refuses an object over MAX_PAYLOAD (returns false) and says so on stderr, by name.
//   3. The node's jobs.update door refuses a body over its limit by name (4xx), and the job keeps its old app.
//   4. jobs.updateJob refuses an app object over MAX_PAYLOAD: the job is unchanged and no job-updated is emitted,
//      so nothing oversized is ever written into a page's stream.
//   (5, the shell handing on an oversized object, is in listeningApp.js.)

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const limits = require('../run/js/limits.js');
const appServer = require('../run/js/appServer.js');
const spirit = require('../run/js/kernel.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by the shared-layer limit: ';
const OVER = 'x'.repeat(limits.PAYLOAD_MAX + 1);
const MID = 'm'.repeat(limits.PAYLOAD_MAX + 2048);   // over MAX_PAYLOAD, under appServer's old 64 KB publish cap

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
// A raw request on a server's pipe, written by hand on a socket (as agentsVerb.js's stand-in is), so what comes
// back is the server's own answer, not a client's verdict, and this suite reaches for no http module.
function rawAsk(pipe, body) {
  return new Promise(function (resolve) {
    const payload = JSON.stringify(body);
    const sock = net.connect(pipe);
    let buf = '';
    sock.on('connect', function () {
      sock.write('POST / HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ' + Buffer.byteLength(payload) + '\r\nConnection: close\r\n\r\n' + payload);
    });
    sock.on('data', function (c) { buf += c; });
    sock.on('error', function (e) { resolve({ status: 0, error: e.message }); });
    sock.on('end', function () {
      const head = buf.indexOf('\r\n\r\n');
      const status = Number((/^HTTP\/1\.1 (\d+)/.exec(buf) || [0, 0])[1]);
      let text = head === -1 ? '' : buf.slice(head + 4);
      if (/transfer-encoding:\s*chunked/i.test(buf.slice(0, head))) {
        let out = ''; let rest = text;
        while (rest.length) { const nl = rest.indexOf('\r\n'); const n = parseInt(rest.slice(0, nl), 16); if (!n) break; out += rest.slice(nl + 2, nl + 2 + n); rest = rest.slice(nl + 2 + n + 2); }
        text = out;
      }
      let j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
      resolve({ status: status, body: j, bytes: Buffer.byteLength(text) });
    });
  });
}
const named = function (r, codeRe) {
  const b = r && r.body;
  return !!(b && b.ok === false && codeRe.test(String(b.code)) && b.extra && b.extra.bytes > b.extra.max);
};

test.startTest('The shared layer refuses an oversized payload, at once and by name, for every app');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-sharedlimit-'));

  // ── 1. a server's reply ──────────────────────────────────────────────
  test.subHeading('1. appServer refuses a reply over MAX_PAYLOAD itself');
  const pipe = process.platform === 'win32' ? '\\\\.\\pipe\\spirit-sharedlimit-' + process.pid : path.join(scratch, 'grow.sock');
  const srv = appServer.createAppServer({
    grow: { request: {}, reply: { text: '' }, handler: function () { return { text: OVER }; } },
    small: { request: {}, reply: { text: '' }, handler: function () { return { text: 'fine' }; } },
  }).listen(pipe);
  await sleep(200);
  const grown = await rawAsk(pipe, { grow: {} });
  if (grown.status >= 400 && named(grown, /answer-too-large$/) && grown.bytes < limits.PAYLOAD_MAX) test.check('the oversized reply never left: the server answered ' + grown.body.code + ' with its size and limit');
  else test.fail(OWED + 'the server sent ' + grown.bytes + ' bytes, status ' + grown.status + ', code ' + (grown.body && grown.body.code));
  const small = await rawAsk(pipe, { small: {} });
  if (small.status === 200 && small.body && small.body.text === 'fine') test.check('a small reply still passes');
  else test.fail('a small reply answered ' + JSON.stringify(small).slice(0, 160));
  srv.close();

  // ── 2. a server's published object ───────────────────────────────────
  test.subHeading('2. appServer.publish refuses an object over MAX_PAYLOAD, and says so');
  const probe = [
    "const appServer = require(" + JSON.stringify(path.join(__dirname, '..', 'run', 'js', 'appServer.js')) + ");",
    "const r = appServer.publish({ big: 'm'.repeat(" + (limits.PAYLOAD_MAX + 2048) + ") });",
    "process.stdout.write(JSON.stringify({ took: r }));",
  ].join('\n');
  const ran = spawnSync(process.execPath, ['-e', probe], { encoding: 'utf8', env: {} });
  let took = null;
  try { took = JSON.parse(ran.stdout).took; } catch (e) { took = null; }
  if (took === false && /too-large/.test(ran.stderr)) test.check('publish of ' + MID.length + ' bytes returned false and named it on stderr');
  else test.fail(OWED + 'publish of an object over MAX_PAYLOAD returned ' + JSON.stringify(took) + ', stderr ' + JSON.stringify(String(ran.stderr).slice(0, 120)));

  // ── 4. the job table ─────────────────────────────────────────────────
  test.subHeading('4. jobs.updateJob refuses an oversized app object, and emits nothing');
  const jobs = require('../run/js/jobs.js')(spirit, 1);
  const job = jobs.startServerJob(process.execPath, ['-e', 'setInterval(function(){},1000)'], { type: 'sharedlimit', operated: 'user' });
  jobs.updateJob(job.id, { app: { small: 1 } });
  let emitted = 0;
  const count = function (j) { if (j.id === job.id) emitted += 1; };
  jobs.events.on('job-updated', count);
  jobs.updateJob(job.id, { app: { big: MID } });
  jobs.events.removeListener('job-updated', count);
  const kept = jobs.getJob(job.id).app;
  if (kept && kept.small === 1 && !kept.big && emitted === 0) test.check('the job kept its old app object and no job-updated went to any page');
  else test.fail(OWED + 'after an oversized app the job holds ' + JSON.stringify(Object.keys(kept || {})) + ', job-updated emitted ' + emitted + ' time(s)');
  try { jobs.cancelJob(job.id); } catch (e) { /* gone */ }

  // ── 3. the node's jobs.update door ───────────────────────────────────
  test.subHeading('3. the node\'s jobs.update door refuses an oversized body by name');
  const root = setupRelayFakes('sharedLimit').andy;
  fs.writeFileSync(path.join(root, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  const post = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
      return { status: r.status, body: j };
    }, function (e) { return { status: 0, error: String(e && e.message || e) }; });
  };
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(200); up = (await post({ verb: 'node.info' })).status > 0; }
  if (!up) test.fail('the node did not boot');
  const door = await post({ verb: 'jobs.update', id: 'job_1', app: { big: OVER } });
  if (door.status >= 400 && door.status < 500 && door.body && /too-large$/.test(String(door.body.code || door.body.error))) test.check('jobs.update with an oversized body answered ' + door.status + ' ' + (door.body.code || door.body.error));
  else test.fail(OWED + 'jobs.update with an oversized body answered ' + JSON.stringify({ status: door.status, body: door.body }).slice(0, 200));
  node.kill();
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
