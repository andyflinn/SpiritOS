'use strict';

// spirit/test/relayConfig.js
// Cycle 1, R1 — the relay's first configuration, bounded by the box.
// design/cycles/2026-09-19-relay-governor-cycle-1.md
//
// Cycle 9 (2026-09-22): two limits now, and the bound is what the box can
// GIVE rather than what it HAS. The 256 MB default is gone — Andy: "the
// default should be total RAM divided by 2" — so a missing file no longer
// means a constant, it means a measurement.

const test = require('./testSupport.js');
const relayConfig = require('../run/js/relayConfig');
const relayLimits = require('../run/js/relayLimits');

test.startTest('Relay configuration — bounded by the box');

// A box this suite invents, so nothing here depends on the machine it runs
// on: 1 GB total, 900 MB of it available, a 20 GB disc with 10 GB free.
const BOX = { totalMB: 1024, availableMB: 900, discTotalMB: 20480, discFreeMB: 10240 };

function run() {
  test.subHeading('A missing file is measured, not a constant');
  const none = relayConfig.parse(null, BOX);
  const want = relayLimits.defaults(BOX);
  if (none.ok && none.config.ramLimitMB === want.ramLimitMB &&
      none.config.discLimitMB === want.discLimitMB && none.config.source === 'default') {
    test.check('no file → ' + none.config.ramLimitMB + ' MB RAM and ' +
      none.config.discLimitMB + ' MB disc, marked as the default');
  } else {
    test.fail('missing file gave ' + JSON.stringify(none) + ', wanted ' + JSON.stringify(want));
  }

  test.subHeading('Half the box, never more than 256 MB, clamped to what the box can give');
  // Half of 1 GB is 512, and Andy's cap is 256 — "We never default to
  // more than 256 MB" — so the cap answers here.
  if (none.ok && none.config.ramLimitMB === 256) {
    test.check('a 1 GB box defaults to 256 MB, the ceiling on a default');
  } else {
    test.fail('half-the-box gave ' + JSON.stringify(none.config));
  }
  // A box with little to give: 200 available leaves 175 after the 25 MB
  // margin, which is under the cap, so availability decides.
  const busy = relayConfig.parse(null, { totalMB: 1024, availableMB: 200, discTotalMB: 20480, discFreeMB: 10240 });
  if (busy.ok && busy.config.ramLimitMB === 175) {
    test.check('on a busy box the default is clamped to availability (200 − 25 = 175)');
  } else {
    test.fail('the clamp did not bite: ' + JSON.stringify(busy));
  }

  test.subHeading('The file is read as written');
  const set = relayConfig.parse('{ "ramLimitMB": 64, "discLimitMB": 32 }', BOX);
  if (set.ok && set.config.ramLimitMB === 64 && set.config.discLimitMB === 32 && set.config.source === 'file') {
    test.check('{ 64, 32 } → read from the file, both keys');
  } else {
    test.fail('file gave ' + JSON.stringify(set));
  }

  test.subHeading('A file written before disc was bounded still starts');
  const old = relayConfig.parse('{ "ramLimitMB": 64 }', BOX);
  if (old.ok && old.config.ramLimitMB === 64 && old.config.discLimitMB === want.discLimitMB) {
    test.check('the owner\'s RAM figure is kept; the missing disc key takes the measured default');
  } else {
    test.fail('an old config was refused or rewritten: ' + JSON.stringify(old));
  }

  test.subHeading('The configuration may never exceed what the box can give');
  const big = relayConfig.parse('{ "ramLimitMB": 4096, "discLimitMB": 32 }', BOX);
  if (!big.ok && /more than this box can give/.test(big.error) && /25 MB safety margin/.test(big.error)) {
    test.check('4096 MB against 900 MB available is refused, and the reason names the margin');
  } else {
    test.fail('an over-box ceiling was accepted: ' + JSON.stringify(big));
  }
  // The ceiling is AVAILABILITY: a figure inside the box's total and past
  // what it can give is the case the old check let through.
  const past = relayConfig.parse('{ "ramLimitMB": 1000, "discLimitMB": 32 }', BOX);
  if (!past.ok && /more than this box can give/.test(past.error)) {
    test.check('1000 MB on a 1024 MB box with 900 available is refused — the old check allowed it');
  } else {
    test.fail('availability is not being enforced: ' + JSON.stringify(past));
  }

  const bigDisc = relayConfig.parse('{ "ramLimitMB": 64, "discLimitMB": 999999 }', BOX);
  if (!bigDisc.ok && /more than this disc can give/.test(bigDisc.error)) {
    test.check('a disc figure past the free space is refused');
  } else {
    test.fail('an over-disc ceiling was accepted: ' + JSON.stringify(bigDisc));
  }

  test.subHeading('At boot, a figure that stopped fitting clamps — it does not keep the relay down');

  // Found by presenceWire.js in cycle 9, and it was a real outage in
  // miniature: a relay wrote a figure while memory was free, the harness
  // filled the box, and the restart refused to start on its own file.
  // Andy's rule is that an overflow nobody asked for reports and runs.
  const tight = { totalMB: 1024, availableMB: 300, discTotalMB: 20480, discFreeMB: 1500 };
  const booted = relayConfig.parse('{ "ramLimitMB": 512, "discLimitMB": 900 }', tight, { atBoot: true });
  if (booted.ok && booted.config.ramLimitMB === 275 && booted.config.overflow &&
      booted.config.overflow.ramAsked === 512) {
    test.check('it starts on the 275 MB the box can give, and says 512 MB was asked for');
  } else {
    test.fail('a boot-time overflow did not clamp: ' + JSON.stringify(booted));
  }

  test.subHeading('…and what was asked for is what stays in the file');
  const keep = relayConfig.asked(booted.config);
  if (keep.ramLimitMB === 512 && keep.discLimitMB === 900) {
    test.check('a busy afternoon cannot shrink a relay\'s configuration for good');
  } else {
    test.fail('the clamp would have been written back: ' + JSON.stringify(keep));
  }

  test.subHeading('…but the owner typing a figure now is still refused');
  const typed = relayConfig.parse('{ "ramLimitMB": 512, "discLimitMB": 900 }', tight);
  if (!typed.ok && /more than this box can give/.test(typed.error)) {
    test.check('no atBoot, no clamp — a mistake being made now is caught now');
  } else {
    test.fail('the owner\'s own figure was clamped instead of refused: ' + JSON.stringify(typed));
  }

  test.subHeading('Nonsense is refused with a sentence an owner can act on');
  [
    ['not json', '{ ramLimitMB: 64 '],
    ['an array', '[64]'],
    ['zero', '{ "ramLimitMB": 0 }'],
    ['negative', '{ "ramLimitMB": -8 }'],
    ['a string', '{ "ramLimitMB": "64" }'],
    ['a string disc limit', '{ "ramLimitMB": 64, "discLimitMB": "32" }'],
    ['a zero disc limit', '{ "ramLimitMB": 64, "discLimitMB": 0 }'],
  ].forEach(function (c) {
    const r = relayConfig.parse(c[1], BOX);
    if (!r.ok && typeof r.error === 'string' && r.error.length > 10) {
      test.check(c[0] + ' → refused: ' + r.error.slice(0, 60));
    } else {
      test.fail(c[0] + ' was accepted: ' + JSON.stringify(r));
    }
  });

  test.subHeading('The file a relay writes for itself round-trips');
  const text = relayConfig.fileText({ ramLimitMB: 256, discLimitMB: 64 });
  const back = relayConfig.parse(text, BOX);
  if (back.ok && back.config.ramLimitMB === 256 && back.config.discLimitMB === 64 &&
      back.config.source === 'file' && /\n$/.test(text)) {
    test.check('fileText → parse gives the same two figures, and the file ends in a newline');
  } else {
    test.fail('the written file did not round-trip: ' + JSON.stringify(text) + ' → ' + JSON.stringify(back));
  }

  test.subHeading('A bare number is still accepted, as cycle 1 callers passed it');
  const legacy = relayConfig.parse('{ "ramLimitMB": 64, "discLimitMB": 32 }', 1024);
  if (legacy.ok && legacy.config.ramLimitMB === 64) {
    test.check('parse(text, 1024) reads as a box with 1024 MB');
  } else {
    test.fail('the old call shape broke: ' + JSON.stringify(legacy));
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
