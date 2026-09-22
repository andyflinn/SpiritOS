'use strict';

// spirit/test/grokReview.js
// A GROK REVIEW SPENDS ONLY WHAT ANDY GRANTED, AND NEVER HIS VAULT.
//
//   Andy: "I have to approve a limited message exchange with grok, because
//   that hits my wallet." (2026-09-22)
//
// The script never calls Grok itself: it asks its NODE, through the
// loopback door's `net.fetch`, and names the key as ${ENV:GROK_API_KEY}
// for the node to fill in (Andy: "this is where the env-variable
// proxy-call in node should come in"). So the fake here stands in for the
// NODE, relaying a made-up Grok — this suite costs nothing and holds no
// key. That the node fills the key in only for api.x.ai is
// serverSurface.js's to prove, against a real node. What this proves:
//   - no thread without a cap, a goal and Andy's words for the cap
//   - the cap stops the send BEFORE the call
//   - raising the cap records the new words beside the number
//   - rounds chain by the previous reply's id; the brief goes only first
//   - the exact cost the API reports is summed, per message and in total
//   - a refused call does not count against the cap
//   - a file from Andy's vault is refused by path, before it is read
//   - the script sends only the placeholder, to its node, for api.x.ai

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const grok = require('../run/process/js/grokReview/grokReview.js');

const NODE = 'http://127.0.0.1:1';

// The node's door: it receives the `net.fetch` verb and relays Grok's
// status and body, as server.js's handleGenericProxy does.
function fakeGrok(log, opts) {
  const o = opts || {};
  let n = 0;
  return function (url, init) {
    n += 1;
    const verb = JSON.parse(init.body);
    log.push({ door: url, verb: verb.verb, target: verb.url, auth: verb.headers.Authorization, body: verb.body });
    if (o.status && n === 1) {
      return Promise.resolve({ ok: false, status: o.status, text: function () { return Promise.resolve(JSON.stringify({ error: { message: 'refused' } })); } });
    }
    const reply = {
      id: 'resp_' + n,
      output: [{ type: 'message', content: [{ type: 'output_text', text: '1. finding ' + n }] }],
      usage: { input_tokens: 1000, output_tokens: 100, cost_in_usd_ticks: 25000000 * n },
    };
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(reply)); } });
  };
}

test.startTest('A Grok review spends only what Andy granted');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grok-'));

  test.subHeading('A thread needs a goal, a cap, and Andy\'s words for it');

  let threw = '';
  try { grok.start(root, 'r1', { cap: 2, goal: 'check the checkpoint' }); } catch (e) { threw = e.message; }
  if (/Andy/.test(threw)) {
    test.check('no thread without Andy\'s words for the cap: ' + threw);
  } else {
    test.fail('started without a grant: ' + threw);
  }
  const t = grok.start(root, 'r1', { cap: 2, goal: 'check the checkpoint', grant: 'review, 2 messages', model: 'grok-test', commit: 'abc1234' });
  if (t.cap === 2 && t.grants[0].words === 'review, 2 messages' && t.used === 0) {
    test.check('started with cap 2 and his words beside it');
  } else {
    test.fail('thread: ' + JSON.stringify(t));
  }

  test.subHeading('Rounds chain, and the cost is the API\'s own figure');

  const log = [];
  const deps = { node: NODE, fetch: fakeGrok(log) };
  const first = await grok.send(root, 'r1', '', [], deps);
  const second = await grok.send(root, 'r1', 'round two', [], deps);
  if (log[0].body.input[0].role === 'system' && !log[0].body.previous_response_id &&
      log[1].body.previous_response_id === 'resp_1' && log[1].body.input.length === 1 && log[1].body.store === true) {
    test.check('the brief goes once, first; round two continues from the first reply\'s id');
  } else {
    test.fail('chaining: ' + JSON.stringify(log.map(function (l) { return l.body; })));
  }
  const opened = log[0].body.input[1].content;
  if (/abc1234/.test(opened) && /check the checkpoint/.test(opened) && /\*\*2 messages\*\*/.test(opened) &&
      !/\{(commit|goal|cap|since|pieces)\}/.test(opened) && !/<!--/.test(opened)) {
    test.check('the first message, sent with no text, is OPENING.md filled: commit, goal and cap, no placeholder left');
  } else {
    test.fail('opening: ' + opened.slice(0, 400));
  }
  const b = log[1].body;
  if (b.reasoning && b.reasoning.effort === 'high' && b.tools && b.tools[0].type === 'web_search' &&
      JSON.stringify(b.tools[0].filters.allowed_domains) === JSON.stringify(['github.com', 'raw.githubusercontent.com'])) {
    test.check('every message asks for high reasoning, and fences the web tool to GitHub');
  } else {
    test.fail('body: ' + JSON.stringify({ reasoning: b.reasoning, tools: b.tools }));
  }
  const after = grok.load(root, 'r1');
  if (after.used === 2 && after.costTicks === 75000000 && Math.abs(second.costUsd - 0.005) < 1e-9 &&
      /\$0\.0075/.test(grok.statusLine(after))) {
    test.check('2 of 2 used, $0.0075 spent — summed from cost_in_usd_ticks, not estimated');
  } else {
    test.fail('after two: ' + grok.statusLine(after) + ' / ' + second.costUsd);
  }
  if (fs.readFileSync(path.join(root, 'r1', '02-grok.md'), 'utf8').indexOf('finding 2') !== -1) {
    test.check('each reply is kept beside what was sent: 02-sent.md, 02-grok.md');
  } else {
    test.fail('reply not recorded');
  }

  test.subHeading('The cap stops the send before the call');

  const calls = log.length;
  threw = '';
  try { await grok.send(root, 'r1', 'one more', [], deps); } catch (e) { threw = e.message; }
  if (/cap reached/.test(threw) && log.length === calls) {
    test.check('a third message is refused and nothing is sent: ' + threw);
  } else {
    test.fail('past the cap: ' + threw + ', calls ' + log.length);
  }
  grok.grant(root, 'r1', { cap: 3, grant: 'one more then' });
  await grok.send(root, 'r1', 'one more', [], deps);
  const raised = grok.load(root, 'r1');
  if (raised.cap === 3 && raised.used === 3 && raised.grants[1].words === 'one more then') {
    test.check('raising the cap records his words beside the new number, and the next send goes');
  } else {
    test.fail('raise: ' + JSON.stringify(raised.grants));
  }

  test.subHeading('A refused call is not a message');

  grok.start(root, 'r2', { cap: 1, goal: 'g', grant: 'one', commit: 'abc1234' });
  threw = '';
  try { await grok.send(root, 'r2', 'x', [], { node: NODE, fetch: fakeGrok([], { status: 400 }) }); } catch (e) { threw = e.message; }
  const r2 = grok.load(root, 'r2');
  if (/refused \(400\)/.test(threw) && r2.used === 0 && r2.rounds[0].ok === false) {
    test.check('Grok refusing the call leaves the cap untouched, and the refusal is on the record');
  } else {
    test.fail('refused call: ' + threw + ' / ' + JSON.stringify(r2));
  }

  test.subHeading('Andy\'s vault never goes, and the script never holds the key');

  const vaultFile = path.join(__dirname, '..', 'run', 'brains', 'input', 'anything.md');
  grok.start(root, 'r3', { cap: 1, goal: 'g', grant: 'one', commit: 'abc1234' });
  const vlog = [];
  threw = '';
  try { await grok.send(root, 'r3', 'x', [vaultFile], { node: NODE, fetch: fakeGrok(vlog) }); } catch (e) { threw = e.message; }
  if (/vault/.test(threw) && vlog.length === 0) {
    test.check('a file under spirit/run/brains is refused by path, and nothing is sent');
  } else {
    test.fail('vault file: ' + threw + ', calls ' + vlog.length);
  }

  if (log.every(function (l) {
    return l.door === NODE + '/api/spirit' && l.verb === 'net.fetch' &&
      l.target === 'https://api.x.ai/v1/responses' && l.auth === 'Bearer ${ENV:GROK_API_KEY}';
  })) {
    test.check('every call goes to its own node as net.fetch, for api.x.ai, carrying only "${ENV:GROK_API_KEY}"');
  } else {
    test.fail('calls: ' + JSON.stringify(log.map(function (l) { return [l.door, l.verb, l.target, l.auth]; })));
  }
  if (!/process\.env\.GROK_API_KEY/.test(fs.readFileSync(require.resolve('../run/process/js/grokReview/grokReview.js'), 'utf8'))) {
    test.check('and the script never reads the key from its own environment');
  } else {
    test.fail('grokReview.js reads GROK_API_KEY itself');
  }

  grok.start(root, 'r4', { cap: 1, goal: 'g', grant: 'one', commit: 'abc1234' });
  threw = '';
  try { await grok.send(root, 'r4', 'x', [], { node: NODE, fetch: fakeGrok([], { status: 401 }) }); } catch (e) { threw = e.message; }
  if (/GROK_API_KEY set in the environment of the node/.test(threw) && grok.load(root, 'r4').used === 0) {
    test.check('a 401 is explained as the node lacking the key — a node started before it was set — and costs no message');
  } else {
    test.fail('401: ' + threw);
  }

  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* windows */ }
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
