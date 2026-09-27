'use strict';

// spirit/test/agentsRecord.js
// ANDY'S NODE HOLDS THE WHOLE RECORD OF WHAT THE AGENTS SAID.
//
//   Andy, 2026-09-27: "yeah, my node should contain the overall record of
//   our activities."
//
// A report used to be a 100-character gist, with the full message left in
// the SENDER's log. Now it is the message itself, as data, carrying the
// board row it belongs to — the `todo` — so Desk can show agent-to-agent
// discussion under that row. Decided in design/shell/AGENTS-UI.md.
//
// Same fake door as agentsApp.js, deliberately: a second shape of fake
// would be a second answer to "what does a node look like to this app".

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const agents = require('../run/process/js/agents/agents.js');

const OWN = 'KEY-OWN-NODE';
const CONTROL = 'KEY-ANDYS-NODE';
const PEER = 'KEY-OTHER-AGENT';

test.startTest('A report to Andy\'s node is the whole message, tied to its row');

function home() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agents-record-'));
  fs.mkdirSync(path.join(h, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(h, 'relay-state', 'identity.json'), JSON.stringify({ publicKey: OWN }));
  return h;
}

function cfgFor(root) {
  return agents.config({
    AGENTS_NODE: 'http://127.0.0.1:45440', AGENTS_ROOT: root, AGENTS_SELF: 'wsl-claude',
    AGENTS_PEERS: 'claude-windows=' + PEER, AGENTS_CONTROL: CONTROL, AGENTS_RETRY_MS: '0',
  });
}

function door() {
  const posts = [];
  const fn = function (url, init) {
    const body = JSON.parse(init.body);
    posts.push({ to: body.to, env: JSON.parse(body.text) });
    return Promise.resolve({ status: 200,
      text: function () { return Promise.resolve(JSON.stringify({ hash: 'H' + posts.length, receipt: true })); } });
  };
  fn.posts = posts;
  return fn;
}

(async function () {
  // ── THE REPORT IS THE MESSAGE ──────────────────────────────────────
  {
    const fetchFn = door();
    const said = 'a message long enough that a hundred-character gist would have cut it off, ' +
      'which is exactly what the old report did to every message worth reading in full later';
    const r = await agents.send(cfgFor(home()), 'claude-windows', 'note', said, 'RE-HASH',
      { fetch: fetchFn, todo: 'cycle-10/R13' });
    const sent = fetchFn.posts.filter(function (p) { return p.to === PEER; })[0];
    const rep = fetchFn.posts.filter(function (p) { return p.to === CONTROL; })[0];
    let data = null;
    try { data = JSON.parse(rep.env.body.text); } catch (e) { data = null; }

    if (r.ok && sent && sent.env.body.todo === 'cycle-10/R13') {
      test.check('the message itself carries its row: body.todo is the full id');
    } else {
      test.fail('sent ' + JSON.stringify(sent && sent.env));
    }
    if (rep && rep.env.body.kind === 'report' && data && data.text === said && data.text.length > 100) {
      test.check('the report to Andy\'s node carries the WHOLE text, ' + data.text.length +
        ' characters — the gist stopped at 100');
    } else {
      test.fail('report was ' + JSON.stringify(rep && rep.env.body));
    }
    if (data && data.from === 'wsl-claude' && data.to === 'claude-windows' && data.toKey === PEER
        && data.kind === 'note' && data.todo === 'cycle-10/R13' && data.re === 'RE-HASH'
        && data.id === sent.env.id && data.hash === 'H1' && data.outcome === 'delivered') {
      test.check('and every field Desk needs rides with it as data — from, to, kind, todo, re, the '
        + 'message id, the hash the node gave it, and how it ended');
    } else {
      test.fail('report fields ' + JSON.stringify(data));
    }
  }

  // ── A SHORT HANDLE IS NOT A THREAD KEY ─────────────────────────────
  {
    const fetchFn = door();
    const r = await agents.send(cfgFor(home()), 'claude-windows', 'note', 'hello', '',
      { fetch: fetchFn, todo: 'G10' }).catch(function (e) { return { ok: false, error: e.message, threw: true }; });
    if (!r.ok && /full to-do id/.test(r.error) && fetchFn.posts.length === 0) {
      test.check('a todo that is not a full id is refused before anything is sent — a handle is '
        + 'the shortest form unique TODAY, and a thread keyed on it would lose its row');
    } else {
      test.fail('a bare handle as todo gave ' + JSON.stringify(r) + ', posts ' + fetchFn.posts.length);
    }
  }

  // ── TOO LONG TO RECORD IS REFUSED AT THE SENDER ────────────────────
  //
  // The report carries the text escaped once more, so a message near the
  // limit makes a report that cannot travel. Refused before anything
  // leaves: nothing reaches a peer that could not also reach his record.
  {
    const fetchFn = door();
    const long = 'x"'.repeat(5000);
    const r = await agents.send(cfgFor(home()), 'claude-windows', 'note', long, '', { fetch: fetchFn });
    if (!r.ok && r.tooLong && fetchFn.posts.length === 0) {
      test.check('a message whose report could not reach Andy\'s node is refused before it is '
        + 'sent to anyone, with the sizes — never delivered to a peer and missing from his record');
    } else {
      test.fail('an oversized message gave ' + JSON.stringify(r) + ' after ' + fetchFn.posts.length + ' post(s)');
    }
  }

  // THE CONTROL: an ordinary message is not refused by that check. Without
  // it, a sender that refused everything would pass the case above.
  {
    const fetchFn = door();
    const r = await agents.send(cfgFor(home()), 'claude-windows', 'note', 'x"'.repeat(1000), '', { fetch: fetchFn });
    if (r.ok && fetchFn.posts.length === 2) {
      test.check('a message of ordinary length still goes, and so does its report');
    } else {
      test.fail('an ordinary message gave ' + JSON.stringify(r));
    }
  }

  // ── HIS DECISION ON A DEPENDENCY IS A LINE THE LEAD CANNOT MISS ────
  //
  //   Andy: "a re-shuffeling of the board triggers a reload of the board.
  //   (mostly cause by accepting dependencies)". The lead acts on his
  //   accept by writing edges.js and re-running; its listener is how it
  //   hears the press. Same fake stream as agentsApp.js's listen check.
  {
    const cfg = cfgFor(home());
    const dep = require('./boardRank.js').dependencyId([{ from: 'puppets/G7', to: 'puppets/G6' }]);
    const packet = function (from, env) {
      return 'event: packet\ndata: ' + JSON.stringify({ from: from, text: JSON.stringify(env) }) + '\n\n';
    };
    const chunks = [
      'event: snapshot\ndata: {}\n\n',
      packet(CONTROL, agents.makeEnvelope('andy', 'answer', 'accepted.', null, null, null, dep)),
      packet(PEER, agents.makeEnvelope('claude-windows', 'note', 'my view on this row', null, null, null, 'cycle-10/R13')),
      packet(CONTROL, agents.makeEnvelope('lead', 'board', JSON.stringify({ rows: [{}, {}, {}] }))),
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
    const decisions = out.filter(function (l) { return /^AGENTS DECISION /.test(l); });
    if (decisions.length === 1 && decisions[0] === 'AGENTS DECISION andy accepted. on ' + dep) {
      test.check('his accept on a dependency prints as its own DECISION line, naming the row — the '
        + 'press the lead has to act on');
    } else {
      test.fail('decision lines: ' + JSON.stringify(decisions) + ' of ' + JSON.stringify(out));
    }
    // THE CONTROL: an agent's note under an ordinary to-do is not a
    // decision, or every line would be one and the lead would learn to
    // skim them.
    const note = out.filter(function (l) { return / note todo cycle-10\/R13: my view on this row$/.test(l); });
    if (note.length === 1) {
      test.check('an agent\'s note under a to-do prints with its todo and is NOT a decision');
    } else {
      test.fail('note line missing or wrong: ' + JSON.stringify(out));
    }
    if (out.some(function (l) { return / board: the scoreboard, 3 rows$/.test(l); })) {
      test.check('a board arriving is one line, "the scoreboard, 3 rows", not kilobytes of JSON');
    } else {
      test.fail('board line: ' + JSON.stringify(out));
    }
  }

  test.reportSuccessFailureCount();
}());
