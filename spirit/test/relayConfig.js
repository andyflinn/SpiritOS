'use strict';

// spirit/test/relayConfig.js
// Cycle 1, R1 — the relay's first configuration, bounded by the box.
// design/cycles/2026-09-19-relay-governor-cycle-1.md

const test = require('./testSupport.js');
const relayConfig = require('../run/js/relayConfig');

test.startTest('Relay configuration — bounded by the box');

function run() {
  test.subHeading('A missing file is the entry-level default, not "whatever the box has"');
  const none = relayConfig.parse(null, 1024);
  if (none.ok && none.config.ramLimitMB === 256 && none.config.source === 'default') {
    test.check('no file → 256 MB, marked as the default');
  } else {
    test.fail('missing file gave ' + JSON.stringify(none));
  }

  test.subHeading('The file is read as written');
  const set = relayConfig.parse('{ "ramLimitMB": 64 }', 1024);
  if (set.ok && set.config.ramLimitMB === 64 && set.config.source === 'file') {
    test.check('{ "ramLimitMB": 64 } → 64 MB from the file');
  } else {
    test.fail('file gave ' + JSON.stringify(set));
  }

  test.subHeading('The configuration may never exceed the box');
  const big = relayConfig.parse('{ "ramLimitMB": 4096 }', 1024);
  if (!big.ok && /larger than this machine/.test(big.error)) {
    test.check('4096 MB on a 1024 MB box is refused, and the reason names the box');
  } else {
    test.fail('an over-box ceiling was accepted: ' + JSON.stringify(big));
  }

  test.subHeading('Nonsense is refused with a sentence an owner can act on');
  [
    ['not json', '{ ramLimitMB: 64 '],
    ['an array', '[64]'],
    ['zero', '{ "ramLimitMB": 0 }'],
    ['negative', '{ "ramLimitMB": -8 }'],
    ['a string', '{ "ramLimitMB": "64" }'],
  ].forEach(function (c) {
    const r = relayConfig.parse(c[1], 1024);
    if (!r.ok && typeof r.error === 'string' && r.error.length > 10) {
      test.check(c[0] + ' → refused: ' + r.error.slice(0, 60));
    } else {
      test.fail(c[0] + ' was accepted: ' + JSON.stringify(r));
    }
  });

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
