'use strict';

// spirit/run/spirit/app/publishData/test/publishData.js
// PUBLISHDATA AS AN APP OF ITS OWN (goal/G43.21; spec: ./publishData.md). Andy: "spirit/app/publishData/publishData will be
// fixed to point at the correct files/folders", and "the Andy user on each box will run those scripts when he feels like
// it, that will take the running of those scripts out of the agents hands." The tree read as it is, and the script run
// once against a port nobody listens on, from a scratch git folder: it measures nothing and commits nothing.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
const HERE = path.join(RUN, 'spirit', 'app', 'publishData');
const FILE = path.join(HERE, 'publishData.js');
const OLD = path.join(RUN, 'process', 'js', 'deskClient');
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

test.startTest('publishData.js: an app of its own, run by Andy with Run (goal/G43.21)');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/publishData/publishData.js is not there'); return; }

  test.subHeading('the node port comes from the node that starts it');
  // A node that starts a job hands it SPIRIT_CALLBACK_URL, its own address (jobs.js); Run hands no argument. It is run from
  // a folder that is no git clone, so past its arguments it stops at once, before it asks any node anything.
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-publishdata-'));
  try {
    const env = Object.assign({}, process.env, { SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit' });
    const r = spawnSync(process.execPath, [FILE], { cwd: tmp, env: env, encoding: 'utf8', timeout: 30000 });
    const said = String(r.stdout || '') + String(r.stderr || '');
    ok(r.status !== 2 && !/usage:/.test(said), 'run with no argument it does not stop at its usage', 'it stopped at usage (exit ' + r.status + '): ' + short(said));
    ok(/not in a git clone/.test(said), 'it goes on past its arguments, to its first step', 'it said ' + short(said));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } }

  test.subHeading('its files and folders');
  // Where it looks for deskVerify's verify.db: its own line, worked out from where the script stands.
  const line = (/const\s+VERIFY_DB\s*=\s*([^;]+);/.exec(code(FILE)) || [])[1];
  let at = '';
  try { at = line ? new Function('path', '__dirname', 'return ' + line)(path, HERE) : ''; } catch (e) { at = 'threw ' + e.message; }
  const want = path.join(RUN, 'process', 'js', 'deskVerify', 'verify.db');
  ok(path.resolve(String(at)) === want, 'it reads deskVerify\'s verify.db where deskVerify keeps it, process/js/deskVerify/', 'it reads ' + short(at) + ', want ' + want);
  let readme = null;
  try { readme = require(path.join(HERE, 'agentReadme.js')); } catch (e) { readme = null; }
  ok(!!readme && typeof readme.write === 'function', 'agentReadme.js stands beside it and loads', 'no agentReadme.js beside it in spirit/app/publishData/');

  test.subHeading('Andy runs it; no agent starts it');
  ok(!fs.existsSync(path.join(OLD, 'publishData.js')), 'the old process/js/deskClient/publishData.js is gone', 'process/js/deskClient/publishData.js is still there');
  ok(!fs.existsSync(path.join(OLD, 'agentReadme.js')), 'the old process/js/deskClient/agentReadme.js is gone', 'process/js/deskClient/agentReadme.js is still there');
  const client = code(path.join(OLD, 'deskClient.js'));
  ok(!!client && !/publishData/.test(client), 'deskClient starts no publishData', 'deskClient.js still names publishData');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
