'use strict';

// spirit/test/presenceLearned.js
// WHAT A POST'S OUTCOME TEACHES ABOUT WHETHER SOMEBODY IS THERE (R30).
//
//   Andy: "when a request to stranger gets a reply from stranger, no
//   matter what reply stranger goes green; as soon as stranger cannot be
//   reached in a post stranger goes NOT-green."
//   Andy: "rule: presence is always last-known."
//
// And the refinement the error catalogue made possible (R36): "cannot be
// reached" is not one thing. A busy refusal proves the person is THERE.
// Only the relay saying "peer not reachable" is an absence. Running out
// of time says nothing — and writes nothing, so the last thing known stands.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const hub = require('../run/js/hub');

function home() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-learned-'));
}

const P = 'MCowBQYDK2VwAyEA' + 'p'.repeat(27) + '=';

test.startTest('Presence learned from how a post turned out');

test.subHeading('Any reply is presence, whatever it says');

{
  const H = home();
  hub.learnPresence(H, P, { ok: true, status: 200 });
  if (hub.shadow(H).get(P) && hub.shadow(H).get(P).present === true) {
    test.check('a post that was answered marks the person present');
  } else {
    test.fail('after a reply: ' + JSON.stringify(hub.shadow(H).get(P)));
  }
}

test.subHeading('A failure says what the catalogue says it says');

{
  const H = home();
  const S = hub.shadow(H);

  // THE CASE THAT MADE THE CATALOGUE NECESSARY. Busy is a refusal, and it
  // is PROOF of presence: the relay only reports busy for somebody whose
  // stream it holds.
  hub.learnPresence(H, P, { ok: false, status: 503, error: 'target is busy', busy: true });
  if (S.get(P).present === true) {
    test.check('a busy refusal marks the person PRESENT — they are there, and occupied');
  } else {
    test.fail('busy: ' + JSON.stringify(S.get(P)));
  }

  hub.learnPresence(H, P, { ok: false, status: 503, error: 'peer not reachable' });
  if (S.get(P).present === false) {
    test.check('"peer not reachable" marks them absent — the relay speaking about its own member');
  } else {
    test.fail('unreachable: ' + JSON.stringify(S.get(P)));
  }

  // RELAYED: the relay could not deliver, and said so down the chain in a
  // reply signed by itself. The sentence is still the relay's verdict.
  hub.learnPresence(H, P, { ok: true, status: 200 });
  hub.learnPresence(H, P, { ok: false, status: 503, error: 'peer not reachable', relayed: true });
  if (S.get(P).present === false) {
    test.check('and so does the same verdict carried back from a partner');
  } else {
    test.fail('relayed unreachable: ' + JSON.stringify(S.get(P)));
  }
}

test.subHeading('A failure that says nothing writes nothing');

{
  // LAST-KNOWN MEANS LEFT ALONE. Running out of time, this node giving
  // up, a partner leg failing: none of them is evidence about the person,
  // so the last thing actually known stands.
  const H = home();
  const S = hub.shadow(H);
  hub.learnPresence(H, P, { ok: true, status: 200 });

  const quiet = [
    { ok: false, status: 503, error: 'no time left', tooLittleTime: true },
    { ok: false, status: 504, error: 'gave up after 3 attempt(s)', gaveUp: true },
    { ok: false, status: 504, error: 'no answer yet', stillOpen: true },
    { ok: false, status: 502, error: 'target could not be reached' },
    { ok: false, status: 503, error: 'this node has too much waiting to send', queueFull: true },
  ];
  quiet.forEach(function (a) { hub.learnPresence(H, P, a); });

  if (S.get(P).present === true) {
    test.check('five failures that are about the waiting, not the person, leave "present" standing');
  } else {
    test.fail('a quiet failure changed presence: ' + JSON.stringify(S.get(P)));
  }

  // AND ONE NOBODY CATALOGUED. The rule above all the others in R36: an
  // unknown error cannot paint somebody red.
  hub.learnPresence(H, P, { ok: false, status: 503, error: 'a sentence nobody has written yet' });
  if (S.get(P).present === true) {
    test.check('while an error nobody catalogued changes nothing at all');
  } else {
    test.fail('an unknown error changed presence');
  }
}

test.subHeading('Learning presence never invents a person');

{
  // Somebody the node has never heard of, refused as unreachable: the
  // shadow gains a row that says only "absent" — which is true, dated, and
  // teaches the node that the key exists. It gains no name and no route.
  const H = home();
  hub.learnPresence(H, P, { ok: false, status: 503, error: 'peer not reachable' });
  const row = hub.shadow(H).get(P);
  if (row && row.present === false && row.label === '' && row.at === '') {
    test.check('a stranger refused as unreachable is recorded as absent, with no name or route made up');
  } else {
    test.fail('stranger: ' + JSON.stringify(row));
  }
}

test.reportSuccessFailureCount();
