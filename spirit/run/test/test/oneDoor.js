'use strict';

// spirit/run/test/test/oneDoor.js
// THE ONE-DOOR SUITE RUNS TO ITS END AND LEAVES THE MODEL PROVIDERS ALONE (goal/G43.23, item 2; spec: ./oneDoor.md). The
// box: "oneDoor.js crashes on the gone spirit/run/js and counts the model providers as violators.", and Andy, on those
// providers: "we're NOT going to fix some netFence thing for the model-provider urls in "agent"". Only Andy sets those
// urls and keys; netFence is for what others make the node fetch.
//
// spirit/test/oneDoor.js is run as its own process, by hand (no --verify-port, so it posts nothing), and its printed
// lines are read.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

const SUITE = path.join(REPO, 'spirit', 'test', 'oneDoor.js');
// The two model providers, as oneDoor.js names a file (its walk of spirit/run/spirit is prefixed spirit/).
const PROVIDERS = ['spirit/app/agent/provider/anthropic/anthropic.js', 'spirit/app/agent/provider/openai/openai.js'];
// A reach as oneDoor.js counts one: fetch( on a line that is not a comment.
function reaches(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l) && /\bfetch\s*\(/.test(l); }).length;
}

test.startTest('spirit/test/oneDoor.js runs to its end and does not count the model providers as violators (goal/G43.23 item 2)');

test.subHeading('the world');
ok(fs.existsSync(SUITE), 'the world: spirit/test/oneDoor.js is there', 'spirit/test/oneDoor.js is gone: nothing judged');
PROVIDERS.forEach(function (p) {
  const full = path.join(RUN, p);
  const n = fs.existsSync(full) ? reaches(full) : 0;
  ok(n > 0, 'the world: ' + p + ' is there and fetches (' + n + ' reach), so oneDoor.js has it to judge', p + ' is gone or fetches nothing: nothing judged');
});
const env = Object.assign({}, process.env);
Object.keys(env).forEach(function (k) { if (/^SPIRIT_/.test(k)) delete env[k]; });
const r = fs.existsSync(SUITE) ? spawnSync(process.execPath, [SUITE], { cwd: REPO, env: env, encoding: 'utf8', timeout: 120000 }) : { stdout: '', stderr: '' };
const out = String(r.stdout || '');
const err = String(r.stderr || '');
const lines = out.split('\n');
const at = lines.findIndex(function (l) { return /A file not in the tally reaches for nothing/.test(l); });
const verdict = at === -1 ? '' : (lines.slice(at + 1).filter(function (l) { return /(SUCCESS|FAILURE) #/.test(l); })[0] || '');
ok(!!verdict, 'the world: its section 1, a file not in the tally reaches for nothing, gave a verdict', 'section 1 gave no verdict: nothing judged. ' + short(out.slice(-400) + err.slice(-400)));

test.subHeading('it runs to its end');
ok(!/ENOENT|no such file or directory/.test(out + err) && !/^\s+at /m.test(err), 'it reads no missing folder: no ENOENT, no stack', 'it crashed: ' + short(err.split('\n').slice(0, 6).join(' | ')));
ok(/No module offers a way past its own front door/.test(out), 'it reaches its last section, no module offers a way past its own front door', 'it stopped before its last section');
ok(/Test completed\./.test(out), 'it prints its completion line', 'it ended without its completion line');

test.subHeading('the model providers are not violators');
const failures = lines.filter(function (l) { return /FAILURE #/.test(l); });
PROVIDERS.forEach(function (p) {
  const named = failures.filter(function (l) { return l.indexOf(p + ' (') !== -1 || l.indexOf(p + ':') !== -1 || l.indexOf(p + ',') !== -1; });
  ok(!named.length, p + ' is not counted as a violator', p + ' is counted as a violator: ' + short(named[0]));
});

test.reportSuccessFailureCount();
process.exit(0);
