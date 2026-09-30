'use strict';

// desk/G2.8: agents.js and AGENTS.md: agents work with the new Desk.
// Andy: "lead: 1 and 2 agreed." The box: "A done claim, a design-complete claim, a box write or alteration, a check
// add or a T result are writes, not text lines like 'READY TO CLOSE' or 'VERIFIED'. Chat stays chat." "Agents read
// state over peerPost with the same verbs the List reads (apiDoor.answer)".
// The contract the builder follows (wsl-claude's picks where the box names no shape):
//   node agents.js desk <verb> [json]
//     sends Andy's node (AGENTS_CONTROL) one packet of app 'api' through its own node's peer.post, body
//     {desk: {<verb>: args}}, args being the json with `by` set to AGENTS_SELF (a `by` given is replaced);
//     then waits on its own node's /api/events for the 'api' packet answering that post's hash (re), prints its
//     body as JSON, and exits 0, or 1 when the body says ok: false.
//   The desk server's AGENTS.md (process/js/desk/AGENTS.md) tells agents this design: claims and box writes through
//   `agents.js desk`, the box's first text wins and a merge names its version, design complete per item after
//   reading code not comments, one agent's claim offers Done, abandoned goals are never cited. It no longer tells
//   them to claim with READY TO CLOSE or IN PLACE VERIFIED lines.
// The node here is a stand-in on a raw socket, as agentsVerb.js's is.

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const packet = require('../run/js/client/packet');

const OWED = 'OWED by desk/G2.8: ';
const AGENTS = path.join(__dirname, '..', 'run', 'process', 'js', 'agents', 'agents.js');
const AGENTS_MD = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'AGENTS.md');
const ANDY = 'MCowBQYDK2VwAyEAandyandyandyandyandyandyandyandyandya=';

// What Andy's desk server answers, by the verb asked.
let reply = { change: 5 };
const posts = [];
const streams = [];
function sendEvent(sock, name, data) { sock.write('event: ' + name + '\ndata: ' + JSON.stringify(data) + '\n\n'); }
const node = net.createServer(function (sock) {
  let buf = '';
  sock.on('error', function () {});
  sock.on('data', function (c) {
    buf += c;
    const head = buf.indexOf('\r\n\r\n');
    if (head === -1) return;
    const first = buf.slice(0, buf.indexOf('\r\n'));
    if (/^GET \/api\/events/.test(first)) {
      buf = '';
      sock.write('HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\n\r\n');
      streams.push(sock);
      return;
    }
    const len = Number((/content-length:\s*(\d+)/i.exec(buf.slice(0, head)) || [0, 0])[1]);
    if (buf.length - head - 4 < len) return;
    let body = {};
    try { body = JSON.parse(buf.slice(head + 4, head + 4 + len)); } catch (e) { body = {}; }
    buf = '';
    let out = { error: 'no such verb: ' + body.verb };
    let status = 400;
    if (body.verb === 'peer.post') {
      const hash = 'H' + (posts.length + 1);
      posts.push({ to: body.to, text: body.text, hash: hash });
      out = { ok: true, hash: hash, text: '' };
      status = 200;
      // Andy's node answers a moment later, down the asker's own event stream.
      setTimeout(function () {
        const answer = packet.encode('api', reply, { re: hash }).text;
        streams.forEach(function (s) { sendEvent(s, 'packet', { from: ANDY, hash: 'A-' + hash, text: answer, sentAt: new Date().toISOString() }); });
      }, 150);
    }
    const text = JSON.stringify(out);
    sock.end('HTTP/1.1 ' + status + ' X\r\nContent-Type: application/json\r\nContent-Length: ' + Buffer.byteLength(text) +
      '\r\nConnection: close\r\n\r\n' + text);
  });
});

function run(args, port) {
  return new Promise(function (resolve) {
    const env = Object.assign({}, process.env, { AGENTS_NODE: 'http://127.0.0.1:' + port, AGENTS_SELF: 'wsl-claude',
      AGENTS_CONTROL: ANDY, AGENTS_PEERS: 'andy=' + ANDY });
    const kid = spawn(process.execPath, [AGENTS].concat(args), { env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    kid.stdout.on('data', function (b) { out += b; });
    kid.stderr.on('data', function (b) { out += b; });
    const t = setTimeout(function () { kid.kill(); }, 10000);
    kid.on('exit', function (code) { clearTimeout(t); resolve({ code: code, out: out.trim() }); });
  });
}
function parsed(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function lastJson(out) { const lines = String(out).split('\n').filter(Boolean); return parsed(lines[lines.length - 1] || ''); }

test.startTest('desk/G2.8: agents work with the new Desk through agents.js desk and AGENTS.md');

node.listen(0, '127.0.0.1', async function () {
  const port = node.address().port;
  try {
    test.subHeading('a claim is a write to Andy\'s desk server, not a line');
    posts.length = 0;
    reply = { change: 5 };
    const a = await run(['desk', 'press', '{"id":"t/G1.2","what":"claim-done"}'], port);
    const p = posts[0] || {};
    let sent = null;
    try { sent = packet.decode(p.text); } catch (e) { sent = null; }
    const args = sent && sent.body && sent.body.desk && sent.body.desk.press;
    if (p.to === ANDY && sent && sent.app === 'api' && args && args.id === 't/G1.2' && args.what === 'claim-done' && args.by === 'wsl-claude') {
      test.check('it posted Andy\'s node an api packet {desk: {press: {id, what: claim-done, by: wsl-claude}}}');
    } else test.fail(OWED + 'it posted ' + JSON.stringify(posts).slice(0, 300) + ' — printed ' + JSON.stringify(a.out.slice(0, 200)));
    const printed = lastJson(a.out);
    if (printed && printed.change === 5 && a.code === 0) test.check('it waited for the answer to that post, printed {"change":5} and exited 0');
    else test.fail(OWED + 'it printed ' + JSON.stringify(a.out.slice(0, 200)) + ', exit ' + a.code);

    test.subHeading('`by` is always the agent\'s own name');
    posts.length = 0;
    await run(['desk', 'press', '{"id":"t/G1.2","what":"done","by":"andy"}'], port);
    let second = null;
    try { second = packet.decode((posts[0] || {}).text); } catch (e) { second = null; }
    const by = second && second.body && second.body.desk && second.body.desk.press && second.body.desk.press.by;
    if (by === 'wsl-claude') test.check('a by: andy in the args is replaced by wsl-claude');
    else test.fail(OWED + 'the by sent was ' + JSON.stringify(by));

    test.subHeading('a refusal is said, and exits 1');
    posts.length = 0;
    reply = { ok: false, code: 'box-moved', error: 'the box has changed since that version' };
    const r = await run(['desk', 'box.write', '{"id":"t/G1.2","text":"x","version":0}'], port);
    const refused = lastJson(r.out);
    if (posts.length === 1 && refused && refused.code === 'box-moved' && r.code === 1) test.check('a box-moved answer is printed and exits 1');
    else test.fail(OWED + 'a refusal: posts ' + posts.length + ', printed ' + JSON.stringify(r.out.slice(0, 200)) + ', exit ' + r.code);

    test.subHeading('the desk server\'s AGENTS.md tells agents this design');
    const md = fs.readFileSync(AGENTS_MD, 'utf8');
    const says = {
      'agents.js desk': /agents\.js desk/.test(md),
      'items.search / item.get': /items\.search/.test(md) && /item\.get/.test(md),
      'claim-done': /claim-done/.test(md),
      'design-complete': /design-complete/.test(md),
      'box version': /box\.write/.test(md) && /version/.test(md),
      'abandoned': /abandon/i.test(md),
    };
    const missing = Object.keys(says).filter(function (k) { return !says[k]; });
    if (!missing.length) test.check('AGENTS.md names agents.js desk, the reads, claim-done, design-complete, versioned box writes and abandoned goals');
    else test.fail(OWED + 'AGENTS.md does not say: ' + missing.join(', '));
    if (!/READY TO CLOSE|IN PLACE VERIFIED/.test(md)) test.check('AGENTS.md no longer asks for READY TO CLOSE or IN PLACE VERIFIED lines');
    else test.fail(OWED + 'AGENTS.md still asks for claim lines');
  } catch (e) {
    test.fail('the run broke: ' + e.message);
  }
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  node.close();
  test.reportSuccessFailureCount();
  process.exit(0);
});
