'use strict';

// goal/G3.6: deskEar.js becomes the few lines that wait. Red on today's tree: there is no
// spirit/run/process/js/desk/deskEar.js in the repo (each agent runs an uncommitted listener of its own), and the
// prose still names the deleted agents app.
//   Andy, 2026-10-02 (goal/G3.2, before the plan): "you move deskEar to where it belongs, in the deskServer
//   folder. and adapt it for use with your personal node only". Then, of its form: "node deskEar.js <port>
//   <js-path-to-api-verb> \"request-string-in-json\"", and later "i don't care much about the command form or
//   js-based calling. i am ready to accept completely alternative design, if it achieves what todays deskEar
//   does". His Go on this item is his go-all on goal/G3 in Desk.
// The contract the builder follows (the box of goal/G3.6; the forms are the agents', as he left them to us):
//   1. spirit/run/process/js/desk/deskEar.js, one file, committed. Its first argument is the port of the agent's
//      own node; none, or one that is no number, ends it with exit 2 and its usage. No default: Andy's door is
//      never an agent's.
//   2. THE WAIT, node deskEar.js <port>: it asks its own node's deskClient.next again and again, each ask one
//      jobs.api through the kernel's ask ({verb: 'jobs.api', ask: {deskClient: {next: {}}}} to that port). An
//      answer with lines is printed, one line each, and it exits 0: the exit wakes the agent. An answer without
//      is asked again.
//   3. A wait that cannot go on ends: a refusal of its node's (deskClient not running, no desk set) or a node
//      that does not answer ends it with exit 1 and the reason on stderr. It does not ask on for ever.
//   4. ONE ASK OF THE DESK, node deskEar.js <port> <verb> [json]: deskClient.desk {verb, json} on its own node.
//      The desk's answer is printed as it came, exit 0; a refusal of the desk's, or of deskClient's (a slow desk:
//      no-answer with the record's id), is printed too and the exit is 1.
//   5. ONE ASK OF ITS OWN deskClient, node deskEar.js <port> deskClient.<verb> [json]: that verb with those
//      args (setDesk, history.search), the answer printed, exit 0.
//   6. Everything else of today's listeners is gone from it: no reading of the node's stream, no AGENTS_
//      environment variable, no file read or written, no fetch or http of its own. Under 80 lines of code.
//   7. The prose names this listener and no longer the deleted one: process/js/desk/AGENTS.md (the listener line
//      and the three lines that read and wrote Desk through agents.js), CLAUDE.md and AGENT.md (the one
//      listener line each).
// Not asserted, the builder's: a pause between two empty answers; the wording of the usage and of the reasons.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G3.6: ';
const ROOT = path.join(__dirname, '..', '..');
const EAR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk', 'deskEar.js');

// THE PRETEND NODE the listener asks: it answers each jobs.api from a script, and keeps what it was asked.
const asked = [];     // every request body it was handed
let script = [];      // the answers to give, in order: { status, body }; the last one repeats
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    asked.push({ method: req.method, url: req.url, body: b });
    const a = script.length > 1 ? script.shift() : script[0];
    res.writeHead((a && a.status) || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(a ? a.body : null));
  });
});

// The listener, run as an agent runs it, with nothing of the old settings in its environment.
function run(args) {
  const env = {};
  Object.keys(process.env).forEach(function (k) { if (!/^AGENTS_/.test(k) && k !== 'SPIRIT_CALLBACK_URL') env[k] = process.env[k]; });
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [EAR].concat(args), { env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    kid.stdout.on('data', function (c) { out += c; });
    kid.stderr.on('data', function (c) { err += c; });
    const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } resolve({ code: 'still running after 8 s', out: out, err: err }); }, 8000);
    kid.on('exit', function (code) { clearTimeout(timer); resolve({ code: code, out: out, err: err }); });
  });
}
const nextAsks = function () { return asked.filter(function (a) { return a.method === 'POST' && a.url === '/api/spirit' && a.body.verb === 'jobs.api' && JSON.stringify(a.body.ask) === JSON.stringify({ deskClient: { next: {} } }); }); };

test.startTest('goal/G3.6: deskEar.js is the few lines that wait');

async function main() {
  test.subHeading('1. the file, and its port');
  if (!fs.existsSync(EAR)) {
    test.fail(OWED + 'spirit/run/process/js/desk/deskEar.js does not exist');
    ['2. the wait', '3. a wait that cannot go on ends', '4. one ask of the desk', '5. one ask of its own deskClient', '6. the old parts are gone']
      .forEach(function (what) { test.fail(OWED + what + ': there is no committed deskEar.js to run'); });
  } else {
    await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
    const port = String(node.address().port);
    const noPort = await run([]);
    const badPort = await run(['claude-windows']);
    if (noPort.code === 2 && badPort.code === 2 && /usage/i.test(noPort.err + noPort.out) && asked.length === 0) test.check('with no port, or one that is no number, it exits 2 with its usage and asks nobody');
    else test.fail(OWED + 'with no port it exited ' + noPort.code + ', with a name for a port ' + badPort.code + ', saying ' + JSON.stringify((noPort.err + noPort.out).slice(0, 120)));

    test.subHeading('2. the wait: asked again while nothing comes, printed and ended when something does');
    asked.length = 0;
    script = [{ status: 200, body: { lines: [] } }, { status: 200, body: { lines: [] } },
      { status: 200, body: { lines: ['DESK andy chat.add {"id":"a/G1.1","text":"first"}', 'LINE andy note: second'] } }];
    const waited = await run([port]);
    const printed = waited.out.split(/\r?\n/).filter(Boolean);
    if (waited.code === 0 && printed.length === 2 && printed[0] === 'DESK andy chat.add {"id":"a/G1.1","text":"first"}' && printed[1] === 'LINE andy note: second' && nextAsks().length === 3 && asked.length === 3) {
      test.check('three jobs.api asks of deskClient.next; the two lines printed, one each; exit 0');
    } else test.fail(OWED + 'the wait exited ' + waited.code + ' after ' + nextAsks().length + ' next ask(s) of ' + asked.length + ', printing ' + JSON.stringify(waited.out.slice(0, 200)) + ' and ' + JSON.stringify(waited.err.slice(0, 120)));

    test.subHeading('3. a wait that cannot go on ends');
    asked.length = 0;
    script = [{ status: 404, body: { ok: false, code: 'no-such-peer', error: 'no such peer' } }];
    const refusedWait = await run([port]);
    const deadPort = await run(['1']);
    if (refusedWait.code === 1 && /no-such-peer/.test(refusedWait.err) && asked.length <= 2 && deadPort.code === 1 && deadPort.err) {
      test.check('a refusal of its node\'s ends the wait with exit 1 and the code on stderr; so does a node that does not answer');
    } else test.fail(OWED + 'a refused wait exited ' + refusedWait.code + ' after ' + asked.length + ' ask(s) saying ' + JSON.stringify(refusedWait.err.slice(0, 120)) + '; a dead port exited ' + deadPort.code + ' saying ' + JSON.stringify(deadPort.err.slice(0, 120)));

    test.subHeading('4. one ask of the desk, through deskClient.desk');
    asked.length = 0;
    const SEARCH = '{"text":"","currentGoalOnly":true,"goalsOnly":false}';
    const ANSWER = '{"items":[{"key":"a/G1","label":"x"}],"more":false}';
    script = [{ status: 200, body: { json: ANSWER } }];
    const read = await run([port, 'items.search', SEARCH]);
    const sent = asked[0] ? asked[0].body : {};
    if (read.code === 0 && read.out.trim() === ANSWER && asked.length === 1 && sent.verb === 'jobs.api' && JSON.stringify(sent.ask) === JSON.stringify({ deskClient: { desk: { verb: 'items.search', json: SEARCH } } })) {
      test.check('items.search went as deskClient.desk {verb, json}; the desk\'s answer was printed as it came, exit 0');
    } else test.fail(OWED + 'the ask exited ' + read.code + ', printed ' + JSON.stringify(read.out.slice(0, 160)) + ', having sent ' + JSON.stringify(sent).slice(0, 200));
    const NO = '{"ok":false,"code":"no-such-item","error":"no such item"}';
    script = [{ status: 200, body: { json: NO } }];
    const refusedAsk = await run([port, 'item.get', '{"id":"nope/G9"}']);
    script = [{ status: 504, body: { ok: false, code: 'no-answer', error: 'no answer yet', extra: { verb: 'desk', id: '41' } } }];
    const slowAsk = await run([port, 'chat.add', '{"id":"a/G1.1","text":"x"}']);
    if (refusedAsk.code === 1 && /no-such-item/.test(refusedAsk.out) && slowAsk.code === 1 && /no-answer/.test(slowAsk.out + slowAsk.err) && /"id":"41"/.test(slowAsk.out + slowAsk.err)) {
      test.check('a refusal of the desk\'s is printed and exits 1; a slow desk exits 1 naming no-answer and the record\'s id');
    } else test.fail(OWED + 'a refused ask exited ' + refusedAsk.code + ' printing ' + JSON.stringify(refusedAsk.out.slice(0, 120)) + '; a slow one exited ' + slowAsk.code + ' printing ' + JSON.stringify((slowAsk.out + slowAsk.err).slice(0, 160)));

    test.subHeading('5. one ask of its own deskClient');
    asked.length = 0;
    script = [{ status: 200, body: { set: true } }];
    const setDesk = await run([port, 'deskClient.setDesk', '{"key":"KEY="}']);
    const sentSet = asked[0] ? asked[0].body : {};
    script = [{ status: 200, body: { items: [], more: false } }];
    const hist = await run([port, 'deskClient.history.search', '{"text":""}']);
    const sentHist = asked[1] ? asked[1].body : {};
    if (setDesk.code === 0 && setDesk.out.trim() === '{"set":true}' && JSON.stringify(sentSet.ask) === JSON.stringify({ deskClient: { setDesk: { key: 'KEY=' } } })
      && hist.code === 0 && hist.out.trim() === '{"items":[],"more":false}' && JSON.stringify(sentHist.ask) === JSON.stringify({ deskClient: { 'history.search': { text: '' } } })) {
      test.check('deskClient.setDesk and deskClient.history.search went to its own deskClient as named, answers printed, exit 0');
    } else test.fail(OWED + 'setDesk exited ' + setDesk.code + ' having sent ' + JSON.stringify(sentSet.ask) + '; history.search exited ' + hist.code + ' having sent ' + JSON.stringify(sentHist.ask));

    test.subHeading('6. the old parts are gone, and it is a few lines');
    const lines = fs.readFileSync(EAR, 'utf8').split(/\r?\n/).filter(function (l) { return l.trim() && !/^\s*\/\//.test(l); });
    const code = lines.join('\n');
    const holds = [/\bfetch\s*\(/, /require\(\s*['"](node:)?https?['"]\s*\)/, /require\(\s*['"](node:)?fs['"]\s*\)/, /AGENTS_[A-Z]+/, /api\/events/, /relay-state/, /identity\.json/, /peerPost/]
      .filter(function (re) { return re.test(code); });
    if (/kernel\.js/.test(code) && /jobs\.api/.test(code) && !holds.length && lines.length < 80) test.check('deskEar.js asks through the kernel\'s jobs.api alone, in ' + lines.length + ' lines of code');
    else test.fail(OWED + 'deskEar.js is ' + lines.length + ' lines of code and holds ' + holds.map(String).join(', '));
  }

  test.subHeading('7. the prose names this listener, not the deleted one');
  const read = function (rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; } };
  const agentsMd = read('spirit/run/process/js/desk/AGENTS.md');
  const claudeMd = read('CLAUDE.md');
  const agentMd = read('AGENT.md');
  const stale = [];
  // The deleted app's folder, spelled in two halves: agentsAppGone.js (goal/G3.2) reads this file too, and a
  // suite that spelled the path whole would be the last thing in spirit/ still naming it.
  const OLD = 'process/js/' + 'agents';
  const NEW = 'process/js/desk/deskEar.js';
  if (/agents\.js/.test(agentsMd) || agentsMd.indexOf(OLD) !== -1 || agentsMd.indexOf(NEW) === -1) stale.push('process/js/desk/AGENTS.md');
  if (claudeMd.indexOf(OLD + '/') !== -1 || claudeMd.indexOf(NEW) === -1) stale.push('CLAUDE.md');
  if (agentMd.indexOf(OLD + '/deskEar.js') !== -1 || agentMd.indexOf(NEW) === -1) stale.push('AGENT.md');
  if (!stale.length) test.check('AGENTS.md, CLAUDE.md and AGENT.md name process/js/desk/deskEar.js and no longer the agents app\'s listener');
  else test.fail(OWED + 'still naming the deleted listener, or not naming the new one: ' + stale.join(', '));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 200);
});
