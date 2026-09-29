'use strict';

// spirit/test/agentsVerb.js
// ONE STANDARD HELPER FOR AN AGENT'S OWN NODE — desk/G1.13, written FIRST,
// red on today's code.
//
//   Andy: "agents should use a standard helper script to access the
//   loopback api of their node and the resident app-servers, no?"
//
// THE CONTRACT (wsl-claude's tests, claude-windows' build):
//   node agents.js verb <verb> [arg]
//     posts to its own node's /api/spirit, through nodeFetch (the one
//     reach oneDoor counts for agents.js), a body {verb, ...}:
//       arg parses to a JSON object  -> its keys are merged in
//       any other arg                -> it is the body's 'ask', parsed as
//                                       JSON when it parses, else the text
//                                       (so 'agents.js verb jobs.api api'
//                                       asks jobs.api for 'api', Andy's check)
//     prints the answer's body as JSON on stdout; exits 0 on a 2xx, 1 else.
//
// The node here is a stand-in on a raw socket: this suite asks nothing of
// http itself, so its own count in oneDoor's tally stays zero.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by desk/G1.13: ';
const AGENTS = path.join(__dirname, '..', 'run', 'process', 'js', 'agents', 'agents.js');

// A node that answers /api/spirit with what each verb is given, and keeps
// every body it was sent.
const seen = [];
function answerFor(body) {
  if (body.verb === 'node.card') return { status: 200, body: { name: 'stand-in' } };
  if (body.verb === 'jobs.api' && body.ask === 'api') return { status: 200, body: { desk: { 'log.add': { request: { json: '' }, reply: { added: true } } } } };
  return { status: 400, body: { error: 'no such verb: ' + body.verb } };
}
const node = net.createServer(function (sock) {
  let buf = '';
  sock.on('data', function (c) {
    buf += c;
    const head = buf.indexOf('\r\n\r\n');
    if (head === -1) return;
    const len = Number((/content-length:\s*(\d+)/i.exec(buf.slice(0, head)) || [0, 0])[1]);
    if (buf.length - head - 4 < len) return;
    const first = buf.slice(0, buf.indexOf('\r\n'));
    let body = {};
    try { body = JSON.parse(buf.slice(head + 4, head + 4 + len)); } catch (e) { body = { unparsed: true }; }
    seen.push({ line: first, body: body });
    const a = answerFor(body);
    const text = JSON.stringify(a.body);
    sock.end('HTTP/1.1 ' + a.status + ' X\r\nContent-Type: application/json\r\nContent-Length: ' + Buffer.byteLength(text) +
      '\r\nConnection: close\r\n\r\n' + text);
  });
});

function run(args, port) {
  return new Promise(function (resolve) {
    const env = Object.assign({}, process.env, { AGENTS_NODE: 'http://127.0.0.1:' + port, AGENTS_SELF: 'wsl-claude' });
    const kid = spawn(process.execPath, [AGENTS].concat(args), { env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    kid.stdout.on('data', function (b) { out += b; });
    kid.stderr.on('data', function (b) { out += b; });
    const t = setTimeout(function () { kid.kill(); }, 10000);
    kid.on('exit', function (code) { clearTimeout(t); resolve({ code: code, out: out.trim() }); });
  });
}
function parsed(s) { try { return JSON.parse(s); } catch (e) { return null; } }

test.startTest('desk/G1.13: agents.js verb, one standard way to an agent\'s own node');

node.listen(0, '127.0.0.1', async function () {
  const port = node.address().port;
  try {
    test.subHeading('T1: agents.js verb <verb> <json> posts that verb to its own node and prints the answer');
    seen.length = 0;
    const a = await run(['verb', 'node.card', '{"full":true}'], port);
    const sent = seen[0];
    if (sent && /^POST \/api\/spirit /.test(sent.line) && sent.body.verb === 'node.card' && sent.body.full === true &&
        parsed(a.out) && parsed(a.out).name === 'stand-in' && a.code === 0) {
      test.check('POST /api/spirit {verb: "node.card", full: true}; printed {"name":"stand-in"}; exit 0');
    } else test.fail(OWED + 'sent ' + JSON.stringify(sent) + ', printed ' + JSON.stringify(a.out.slice(0, 200)) + ', exit ' + a.code);

    seen.length = 0;
    const bad = await run(['verb', 'no.such', '{}'], port);
    if (seen.length === 1 && bad.code === 1 && parsed(bad.out) && /no such verb/.test(parsed(bad.out).error)) test.check('a refused verb prints the node\'s answer and exits 1');
    else test.fail(OWED + 'a refused verb: sent ' + seen.length + ', printed ' + JSON.stringify(bad.out.slice(0, 160)) + ', exit ' + bad.code);

    test.subHeading('T2: jobs.api reaches a server process through it (Andy\'s check, as he typed it)');
    seen.length = 0;
    const j = await run(['verb', 'jobs.api', 'api'], port);
    const tree = parsed(j.out);
    if (seen[0] && seen[0].body.verb === 'jobs.api' && seen[0].body.ask === 'api' && tree && tree.desk && tree.desk['log.add'] && j.code === 0) {
      test.check('\'agents.js verb jobs.api api\' sent {verb: "jobs.api", ask: "api"} and printed the server\'s api tree');
    } else test.fail(OWED + 'sent ' + JSON.stringify(seen[0]) + ', printed ' + JSON.stringify(j.out.slice(0, 200)));
    seen.length = 0;
    await run(['verb', 'jobs.api', '{"ask":{"desk":{"state.get":{}}}}'], port);
    if (seen[0] && JSON.stringify(seen[0].body) === JSON.stringify({ verb: 'jobs.api', ask: { desk: { 'state.get': {} } } })) test.check('an object arg is merged: {verb: "jobs.api", ask: {desk: {state.get: {}}}}');
    else test.fail(OWED + 'object arg sent ' + JSON.stringify(seen[0]));

    test.subHeading('T3: it goes through nodeFetch; agents.js still has its one reach');
    const src = fs.readFileSync(AGENTS, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
    const reaches = (src.match(/\bfetch\s*\(|require\(\s*['"]https?['"]\s*\)|\bhttps?\.request\s*\(/g) || []);
    const bare = (src.match(/[^.\w]fetch\s*\(/g) || []).length;
    if (/'verb'/.test(src) && reaches.length === 1 && bare === 1) test.check('one reach in agents.js, the fetch inside nodeFetch; the verb command adds none');
    else test.fail(OWED + ('verb command ' + /'verb'/.test(src) + ', reaches ' + JSON.stringify(reaches)));
  } catch (e) {
    test.fail('the run broke: ' + e.message);
  }
  node.close();
  test.reportSuccessFailureCount();
});
