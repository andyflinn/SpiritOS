'use strict';

// spirit/test/agentsApp.js
// THE AGENTS PROGRAM — step 1 of the plan both agents agreed.
//
//   Andy: "you guys just need to sent posts to each other ... it's A real-
//   non-shell app" — and on the plan's ruling (b): step 1 stays open until
//   a test proves it.
//
// The node is replaced by a function that answers as the node's door
// would; everything the program decides — the stop, the retries, the
// refusals, the reports, reading the log — is the real code.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const agents = require('../run/process/js/agents/agents.js');

const OWN = 'KEY-OWN-NODE';
const CONTROL = 'KEY-ANDYS-NODE';
const PEER = 'KEY-OTHER-AGENT';

function home() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agents-'));
  fs.mkdirSync(path.join(h, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(h, 'relay-state', 'identity.json'), JSON.stringify({ publicKey: OWN }));
  return h;
}

function cfgFor(root, extra) {
  return Object.assign(agents.config({
    AGENTS_ROOT: root, AGENTS_SELF: 'claude-windows',
    AGENTS_PEERS: 'wsl-claude=' + PEER, AGENTS_CONTROL: CONTROL, AGENTS_RETRY_MS: '60000',
  }), extra || {});
}

// A node door that answers each post from a script, and records them.
function door(script) {
  const posts = [];
  const fn = function (url, init) {
    const body = JSON.parse(init.body);
    const env = JSON.parse(body.text);
    posts.push({ to: body.to, env: env });
    const answer = script(body.to, env, posts.length) || { status: 200, body: { hash: 'H' + posts.length, receipt: true } };
    return Promise.resolve({ status: answer.status, text: function () { return Promise.resolve(JSON.stringify(answer.body)); } });
  };
  fn.posts = posts;
  return fn;
}

// A clock the retries can run against without waiting.
function clock() {
  let t = 0;
  return { now: function () { return t; }, sleep: function (ms) { t += ms; return Promise.resolve(); } };
}

test.startTest('The agents program — send, stop, report, read');

async function run() {
  test.subHeading('The envelope is protocol v1');

  {
    const env = agents.makeEnvelope('claude-windows', 'ask', 'hello', 'RE-HASH', function () { return 'ID1'; });
    if (env.app === 'agents' && env.v === 1 && env.id === 'ID1' && env.re === 'RE-HASH' &&
        env.body.from === 'claude-windows' && env.body.kind === 'ask' && env.body.text === 'hello') {
      test.check('app "agents", v 1, an id, the re, and a body saying who, what kind and what');
    } else {
      test.fail('envelope: ' + JSON.stringify(env));
    }
    let threw = false;
    try { agents.makeEnvelope('x', 'order', 'do it'); } catch (e) { threw = true; }
    if (threw) {
      test.check('there is no kind called "order" — a message is information, never an instruction');
    } else {
      test.fail('an unknown kind was accepted');
    }

    // ── DECLARED, NOT BUILT (cycle 10, R19) ──────────────────────────
    //
    //   Andy, 2026-09-23: "i do see the concept of writing tests
    //   beforehand as detailed statements of intent."
    //
    // So this is the intent, written where it can be run: an empty send
    // is refused the way a `blocked` with no `what` already is. The
    // defect that asked for it was real — wsl-claude piped a cleared
    // scratchpad into a send and spent a post and a receipt on nothing.
    //
    // IT ASKS WHETHER THE UNIT IS THERE, not whether it works: today
    // `makeEnvelope` accepts empty text, so the refusal does not exist to
    // be tested. That is the whole finding, and it classifies itself.
    //
    // It sits AWAITING rather than red — the run stays green, the count
    // says not-done-yet, and the moment the refusal appears this turns
    // into a failure telling whoever built it to write the real
    // assertion. See testSupport.awaiting.
    let refusesEmpty = false;
    try { agents.makeEnvelope('x', 'ask', '   '); } catch (e) { refusesEmpty = true; }
    test.awaiting('cycle-10/R19', 'agents.makeEnvelope refusing empty text', refusesEmpty,
      'a send with no text should be refused, as a `blocked` with no `what` already is');
  }

  test.subHeading('It sends, and a peer that is offline is retried, then reported');

  {
    const H = home();
    const c = clock();
    let calls = 0;
    const d = door(function (to) {
      if (to === PEER && ++calls < 3) return { status: 503, body: { error: 'peer not reachable', hash: 'HX' } };
      return null;
    });
    const r = await agents.send(cfgFor(H), 'wsl-claude', 'note', 'measure your box', '', { fetch: d, now: c.now, sleep: c.sleep });
    const toPeer = d.posts.filter(function (p) { return p.to === PEER; }).length;
    if (r.ok && toPeer === 3) {
      test.check('two 503s and then through — retried, because the core makes one attempt');
    } else {
      test.fail('send: ' + JSON.stringify(r) + ', posts to peer: ' + toPeer);
    }

    const H2 = home();
    const c2 = clock();
    const always = door(function (to) { return to === PEER ? { status: 503, body: { error: 'peer not reachable', hash: 'HY' } } : null; });
    const r2 = await agents.send(cfgFor(H2), 'wsl-claude', 'note', 'anyone?', '', { fetch: always, now: c2.now, sleep: c2.sleep });
    const report = always.posts.filter(function (p) { return p.to === CONTROL; })[0];
    if (!r2.ok && r2.status === 503 && c2.now() <= 60000 &&
        report && report.env.body.kind === 'report' && /undelivered: peer not reachable/.test(report.env.body.text)) {
      test.check('a peer offline past the retry window is given up on, and Andy gets an "undelivered" report');
    } else {
      test.fail('gave up: ' + JSON.stringify(r2) + ' at ' + c2.now() + ', report: ' + JSON.stringify(report));
    }
  }

  test.subHeading('A refusal by its own node is said out loud, not retried');

  {
    const H = home();
    const d = door(function (to) { return to === PEER ? { status: 413, body: { error: 'too big' } } : null; });
    const r = await agents.send(cfgFor(H), 'wsl-claude', 'note', 'x'.repeat(10), '', { fetch: d, now: function () { return 0; }, sleep: function () { return Promise.resolve(); } });
    const report = d.posts.filter(function (p) { return p.to === CONTROL; })[0];
    if (!r.ok && r.byNode && d.posts.filter(function (p) { return p.to === PEER; }).length === 1 &&
        report && /refused by my own node — not in any log/.test(report.env.body.text)) {
      test.check('a 413 from its own node is tried once and reported as the one refusal no log records');
    } else {
      test.fail('413: ' + JSON.stringify(r) + ' ' + JSON.stringify(report));
    }
  }

  test.subHeading('The stop: only Andy\'s node can halt or resume');

  {
    const H = home();
    const cfg = cfgFor(H);
    const halt = agents.makeEnvelope('andy', 'halt', 'enough for tonight');

    if (agents.obeyControl(cfg, PEER, halt) === 'ignored' && !agents.halted(cfg)) {
      test.check('a halt from the other agent is ignored — one agent cannot stop another');
    } else {
      test.fail('a peer halted this agent');
    }

    if (agents.obeyControl(cfg, CONTROL, halt) === 'halted' && agents.halted(cfg)) {
      test.check('a halt from Andy\'s node sets the stop');
    } else {
      test.fail('Andy\'s halt did not take');
    }

    const d = door(function () { return null; });
    const r = await agents.send(cfg, 'wsl-claude', 'note', 'still here?', '', { fetch: d });
    if (!r.ok && r.halted && d.posts.length === 0) {
      test.check('while halted, nothing is sent — not the message, not a report');
    } else {
      test.fail('sent while halted: ' + JSON.stringify(r) + ', ' + d.posts.length + ' posts');
    }

    const d2 = door(function () { return null; });
    const r2 = await agents.send(cfg, 'wsl-claude', 'halt', 'you too', '', { fetch: d2 });
    if (!r2.ok && r2.halted && d2.posts.length === 0) {
      test.check('a halted agent cannot send a halt or resume either — silent means silent');
    } else {
      test.fail('a halted agent posted a control kind: ' + JSON.stringify(r2));
    }

    agents.obeyControl(cfg, PEER, agents.makeEnvelope('wsl-claude', 'resume', ''));
    const stillHalted = !!agents.halted(cfg);
    agents.obeyControl(cfg, CONTROL, agents.makeEnvelope('andy', 'resume', ''));
    if (stillHalted && !agents.halted(cfg)) {
      test.check('only Andy\'s resume lifts it; the other agent\'s is ignored');
    } else {
      test.fail('resume: after peer ' + stillHalted + ', after Andy ' + !!agents.halted(cfg));
    }
  }

  test.subHeading('A halt handed over again is not obeyed again — and the clock decides nothing');

  {
    // The node holds packets that arrived while nobody listened and hands
    // them to the next listener. A halt Andy already lifted, replayed on a
    // restart, must not stop the agent again. Found by wsl-claude — who
    // then found that telling a replay by its TIME breaks the stop itself
    // when a clock steps back, so a replay is now known by its id.
    const H = home();
    const cfg = cfgFor(H);
    const halt = agents.makeEnvelope('andy', 'halt', '');
    agents.obeyControl(cfg, CONTROL, halt, '2026-09-22T01:00:00.000Z');
    agents.obeyControl(cfg, CONTROL, agents.makeEnvelope('andy', 'resume', ''), '2026-09-22T01:05:00.000Z');
    const replayed = agents.obeyControl(cfg, CONTROL, halt, '2026-09-22T01:00:00.000Z');
    if (replayed === 'stale' && !agents.halted(cfg)) {
      test.check('the same halt handed over again after a resume is reported stale, and the agent keeps running');
    } else {
      test.fail('replayed halt: ' + replayed + ', halted: ' + JSON.stringify(agents.halted(cfg)));
    }

    // THE CLOCK STEPPED BACK: a new halt carrying an EARLIER time than the
    // resume. Under the old rule it was "stale" and the agent ran on after
    // Andy stopped it. It is a new message, so it is obeyed.
    const behind = agents.obeyControl(cfg, CONTROL, agents.makeEnvelope('andy', 'halt', ''), '2026-09-22T00:30:00.000Z');
    if (behind === 'halted' && agents.halted(cfg)) {
      test.check('a new halt whose clock reads EARLIER than the last resume still stops the agent');
    } else {
      test.fail('a new halt with an earlier time was not obeyed: ' + behind);
    }

    // SAME MILLISECOND: the flake wsl-claude saw on Linux.
    const same = '2026-09-22T02:00:00.000Z';
    agents.obeyControl(cfg, CONTROL, agents.makeEnvelope('andy', 'halt', ''), same);
    const resumed = agents.obeyControl(cfg, CONTROL, agents.makeEnvelope('andy', 'resume', ''), same);
    if (resumed === 'resumed' && !agents.halted(cfg)) {
      test.check('a halt and a resume in the same millisecond are both obeyed, in the order they arrive');
    } else {
      test.fail('same-millisecond resume: ' + resumed);
    }
  }

  test.subHeading('A report that cannot land is kept, and sent when it can');

  {
    const H = home();
    const cfg = cfgFor(H);
    let andyDown = true;
    const d = door(function (to) { return to === CONTROL && andyDown ? { status: 503, body: { error: 'peer not reachable' } } : null; });
    await agents.send(cfg, 'wsl-claude', 'note', 'first', '', { fetch: d });
    const outbox = fs.readFileSync(path.join(H, 'relay-state', 'agents-outbox.jsonl'), 'utf8').split('\n').filter(Boolean);
    andyDown = false;
    await agents.send(cfg, 'wsl-claude', 'note', 'second', '', { fetch: d });
    const landed = d.posts.filter(function (p) { return p.to === CONTROL && p.env.body.kind === 'report'; });
    const lastTwo = landed.slice(-2).map(function (p) { return p.env.body.text; }).join(' | ');
    if (outbox.length === 1 && /"first"/.test(lastTwo) && /"second"/.test(lastTwo)) {
      test.check('with Andy\'s node down the report waits on disc, and both arrive once it is back');
    } else {
      test.fail('outbox ' + outbox.length + ', landed: ' + lastTwo);
    }
  }

  test.subHeading('Reading the log pairs a refusal with its attempt');

  {
    const env = JSON.stringify(agents.makeEnvelope('claude-windows', 'note', 'hello', '', function () { return 'I'; }));
    const lines = [
      JSON.stringify({ at: 't1', dir: 'out', kind: 'request', peer: PEER, hash: 'HA', outcome: 'sent', payload: env }),
      JSON.stringify({ at: 't2', dir: 'out', kind: 'request', peer: PEER, hash: 'HA', outcome: 'refused' }),
      JSON.stringify({ at: 't3', dir: 'out', kind: 'request', peer: PEER, hash: 'HB', outcome: 'sent', payload: env }),
      JSON.stringify({ at: 't4', dir: 'in', kind: 'reply', peer: PEER, hash: 'HB', outcome: 'receipted' }),
      // The mark the node writes when a listener collects a held packet:
      // same hash, no outcome, and no peer. It must not blank the outcome.
      JSON.stringify({ at: 't5', mark: 'taken', hash: 'HB' }),
    ];
    // Read UNFILTERED, as `read` does with no peer named — which is how the
    // 'taken' mark blanked a real outcome to "undefined".
    const conv = agents.conversation(lines, '');
    if (conv.length === 2 && conv[0].outcome === 'refused' && conv[1].outcome === 'receipted') {
      test.check('a post the relay refused reads "refused", not "sent" — the second row is not skipped');
    } else {
      test.fail('conversation: ' + JSON.stringify(conv));
    }
  }

  test.subHeading('Listening prints each message and obeys the stop');

  {
    const H = home();
    const cfg = cfgFor(H);
    const packet = function (from, env) {
      return 'event: packet\ndata: ' + JSON.stringify({ from: from, text: JSON.stringify(env) }) + '\n\n';
    };
    const chunks = [
      'event: snapshot\ndata: {}\n\n',
      packet(PEER, agents.makeEnvelope('wsl-claude', 'ask', 'ready?')),
      packet(CONTROL, agents.makeEnvelope('andy', 'halt', 'stop now')),
      packet(PEER, { app: 'relay-chat', v: 1, id: 'x', body: 'not ours' }),
    ];
    const enc = new TextEncoder();
    let i = 0;
    const fakeFetch = function () {
      return Promise.resolve({ body: { getReader: function () {
        return { read: function () {
          return Promise.resolve(i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true });
        } };
      } } });
    };
    const out = [];
    await agents.listen(cfg, function (l) { out.push(l); }, fakeFetch);
    const lines = out.filter(function (l) { return /^AGENTS/.test(l); });
    if (lines.length === 2 && /wsl-claude ask: ready\?/.test(lines[0]) && /\[halted\]/.test(lines[1]) && agents.halted(cfg)) {
      test.check('two agents packets printed, another app\'s ignored, and Andy\'s halt set the stop mid-stream');
    } else {
      test.fail('listen: ' + JSON.stringify(out));
    }
  }

  // ── `blocked` — WHAT STOPPED, SO THE LEAD CAN COLLATE IT ──────────
  //
  //   Andy, 2026-09-23, answering the bundle: "3 decisions above: 1. yes.
  //   2. yes. 3. yes." — the first being this.
  //
  // The fields are wsl-claude's, agreed over the wire and taken verbatim.
  // What this suite holds is the part that would rot quietly: that a bad
  // value is refused AT THE SENDER rather than sorted into the wrong pile
  // of Andy's digest, and that a block prints as one line and nothing
  // more, which is what makes the digest assembly rather than reading.
  test.subHeading('A block carries who can clear it, and is refused if it cannot say');

  {
    const env = agents.makeEnvelope('wsl-claude', 'blocked', '', 'abc123def456', function () { return 'id1'; }, {
      what: 'The vault gate asks you to approve wsl-claude writing his own compile.',
      needs: 'permission',
      who: 'andy',
    });
    const b = env.body.block;
    if (b.who === 'andy' && b.needs === 'permission' && b.state === 'parked' &&
        /^\d{4}-\d{2}-\d{2}T/.test(b.since) && env.re === 'abc123def456') {
      test.check('what, needs, who, a default state of parked, a timestamp — and `re`, so it lands on the task');
    } else {
      test.fail('the block was shaped wrongly: ' + JSON.stringify(env));
    }

    if (agents.blockLine(env) === 'andy | permission | The vault gate asks you to approve wsl-claude writing his own compile.') {
      test.check('and it prints as `who | needs | what`, nothing more');
    } else {
      test.fail('the one-line form drifted: ' + agents.blockLine(env));
    }
  }

  {
    const bad = [
      ['an unknown needs', { what: 'x', needs: 'vibes', who: 'andy' }],
      ['an unknown who', { what: 'x', needs: 'decision', who: 'the-relay' }],
      ['an unknown state', { what: 'x', needs: 'decision', who: 'andy', state: 'later' }],
      ['no sentence at all', { needs: 'decision', who: 'andy' }],
    ];
    const refused = bad.filter(function (c) {
      try {
        agents.makeEnvelope('x', 'blocked', '', null, function () { return 'i'; }, c[1]);
        return false;
      } catch (e) { return true; }
    });
    if (refused.length === bad.length) {
      test.check('a block nobody could sort is refused where it is written, not where it is read');
    } else {
      test.fail('these were accepted: ' + bad.filter(function (c) { return refused.indexOf(c) === -1; })
        .map(function (c) { return c[0]; }).join(', '));
    }
  }

  {
    // `worked-around` is a report, not an apology: the hour was still
    // spent, and the hour is the finding.
    const env = agents.makeEnvelope('claude-windows', 'blocked', '', null, function () { return 'id2'; }, {
      what: 'Every compound command asked Andy to approve it, for two days.',
      needs: 'permission', who: 'either', state: 'worked-around',
    });
    if (env.body.block.state === 'worked-around' && agents.STATES.indexOf('worked-around') !== -1) {
      test.check('a block that was got past can still be reported — the cost is the finding');
    } else {
      test.fail('worked-around did not survive: ' + JSON.stringify(env.body.block));
    }
  }

  {
    // Nothing else changed shape: the conversational kinds still carry
    // text and no block.
    const note = agents.makeEnvelope('claude-windows', 'note', 'the harness is green', null, function () { return 'id3'; });
    if (note.body.text === 'the harness is green' && note.body.block === undefined) {
      test.check('and a note is untouched by any of this');
    } else {
      test.fail('an ordinary note grew a block: ' + JSON.stringify(note));
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
