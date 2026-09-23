'use strict';

// spirit/test/relayLimitsTool.js
// THE NODE-SIDE HALF OF CYCLE 9 — reading and setting a remote relay's
// limits from its owner's node.
//
//   Andy, 2026-09-22: "if we push now, can we address the node-side
//   support for adjusting remote relays limits?"
//
// The program is a client of the node's one door, like the shell and like
// a developer's app: `relay.status` to find the relays this key owns, and
// `peer.post` to send the owner-signed `{ config: … }` packet. It adds no
// verb and no route — hub.js: a verb "would have been a third place to
// shape one request".
//
// Everything that decides is driven here with the door injected, so no
// node, relay or network is needed to prove it.

const test = require('./testSupport.js');
const tool = require('../run/process/js/relayLimits/relayLimits.js');

test.startTest('Adjusting a remote relay\'s limits from its owner\'s node');

const ROWS = [
  { url: 'https://spirit.andyflinn.com', owned: true, label: 'Andy Flinn Music Relay', key: 'KEY-SPIRIT' },
  { url: 'https://lab.andyflinn.com', owned: true, label: 'lab', key: 'KEY-LAB' },
  { url: 'https://someone.else.example', owned: false, label: 'theirs', key: 'KEY-THEIRS' },
];

// A door that answers whatever it is handed, and records what it was
// asked — which is how the packet's shape is asserted without a relay.
function doorSaying(answer, seen) {
  return function (pathname, body) {
    if (seen) seen.push({ pathname: pathname, body: body });
    if (body && body.verb === 'relay.status') {
      return Promise.resolve({ rows: ROWS.map(function (r) {
        return { url: r.url, owned: r.owned, roll: { relayKey: r.key, relayLabel: r.label } };
      }) });
    }
    return Promise.resolve(answer);
  };
}

function relayAnswer(body) {
  return { ok: true, hash: 'h', text: JSON.stringify({ v: 1, body: body }) };
}

function run() {
  test.subHeading('Which relay a name picks — and which it refuses');

  if (tool.pick(ROWS, 'lab').key === 'KEY-LAB' && tool.pick(ROWS, 'spirit.andyflinn').key === 'KEY-SPIRIT') {
    test.check('a fragment of the url or the label finds the relay');
  } else {
    test.fail('picking by name did not work');
  }

  let refused = '';
  try { tool.pick(ROWS, 'someone.else'); } catch (e) { refused = e.message; }
  if (/no relay this node owns matches/.test(refused)) {
    test.check('a relay this node is only a MEMBER of is refused here, not at the far end');
  } else {
    test.fail('a member relay was offered for configuration: ' + refused);
  }

  let ambiguous = '';
  try { tool.pick(ROWS, 'andyflinn.com'); } catch (e) { ambiguous = e.message; }
  if (/matches 2/.test(ambiguous)) {
    test.check('a fragment matching both relays refuses rather than choosing one');
  } else {
    test.fail('an ambiguous name was resolved anyway: ' + ambiguous);
  }

  let none = '';
  try { tool.pick([], ''); } catch (e) { none = e.message; }
  if (/owns no relay/.test(none)) {
    test.check('a node that owns nothing says so');
  } else {
    test.fail('an ownerless node was given a relay: ' + none);
  }

  let unnamed = '';
  try { tool.pick(ROWS, ''); } catch (e) { unnamed = e.message; }
  if (/owns 2 relays; name one/.test(unnamed)) {
    test.check('two owned relays and no name refuses, and lists them');
  } else {
    test.fail('a relay was chosen for the owner: ' + unnamed);
  }

  test.subHeading('The packet it posts is an ordinary owner grant');

  const seen = [];
  return tool.askRelay({ url: 'https://lab.andyflinn.com', key: 'KEY-LAB' },
    { config: { ramLimitMB: 1 } }, doorSaying(relayAnswer({ ok: true, after: { ramLimitMB: 1 } }), seen))
    .then(function () {
      const posted = seen[seen.length - 1];
      const packet = JSON.parse(posted.body.text);
      if (posted.pathname === '/api/spirit' && posted.body.verb === 'peer.post' &&
          posted.body.to === 'KEY-LAB' && packet.app === 'relay' && packet.body.config.ramLimitMB === 1) {
        test.check('peer.post to the relay\'s own key, carrying { app: relay, body: { config } } — no new verb');
      } else {
        test.fail('the packet was shaped wrongly: ' + JSON.stringify(posted));
      }

      test.subHeading('An old relay is named as old, not as a routing failure');
      return tool.askRelay({ url: 'https://spirit.andyflinn.com', key: 'KEY-SPIRIT' }, { config: {} },
        doorSaying(relayAnswer({ ok: false, status: 404, error: 'no such peer' })))
        .then(function () { test.fail('an old relay\'s refusal was read as an answer'); })
        .catch(function (e) {
          if (/older than\s+cycle 9|older than cycle 9/.test(e.message) && /bash\/update/.test(e.message)) {
            test.check('"no such peer" is translated: the verb is unknown to it, and the fix is named');
          } else {
            test.fail('the old-relay case said: ' + e.message);
          }
        });
    })
    .then(function () {
      test.subHeading('A relay that receipts the post and answers nothing is not mistaken for silence');
      return tool.askRelay({ url: 'https://lab.andyflinn.com', key: 'KEY-LAB' }, { config: {} },
        function () { return Promise.resolve({ ok: true, hash: 'h', receipt: true }); })
        .then(function () { test.fail('an answerless post looked like an answer'); })
        .catch(function (e) {
          if (/said nothing back/.test(e.message) && /it is running/.test(e.message)) {
            test.check('it says the box is up and did not answer this verb');
          } else {
            test.fail('the answerless case said: ' + e.message);
          }
        });
    })
    .then(function () {
      test.subHeading('The flags mean what they say');
      const f = tool.flags(['lab', '--ram', '256', '--disc', '64', '--restart']);
      if (f._[0] === 'lab' && f.ram === '256' && f.disc === '64' && f.restart === true) {
        test.check('a relay name, two figures and a restart');
      } else {
        test.fail('flags parsed as ' + JSON.stringify(f));
      }
      // Andy: "the reducing configuration should restart the relay,
      // exactly to free up that RAM." So a bare `set` asks for one, and
      // only --no-restart holds it back.
      const off = tool.flags(['lab', '--ram', '1', '--no-restart']);
      if (off['no-restart'] === true && off.ram === '1') {
        test.check('--no-restart is a flag of its own, not a figure');
      } else {
        test.fail('--no-restart parsed as ' + JSON.stringify(off));
      }
      let bad = '';
      try { tool.number('ram', 'lots'); } catch (e) { bad = e.message; }
      if (/positive number of megabytes/.test(bad)) {
        test.check('a figure that is not a number is refused before anything is posted');
      } else {
        test.fail('a nonsense figure was accepted: ' + bad);
      }
      if (tool.mb(2048) === '2.0 GB' && tool.mb(256) === '256 MB' && tool.mb(undefined) === '—') {
        test.check('megabytes read as megabytes, gigabytes as gigabytes, and the unmeasured as a dash');
      } else {
        test.fail('the figures printed wrongly');
      }
      test.reportSuccessFailureCount();
    });
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
