'use strict';

// spirit/test/relayLimits.js
// Cycle 9, B1 — what the box can give, and what a relay takes of it.
//
// The arithmetic is pure, so every case here is a number in and a number
// out. The probe is driven with an invented box: a Linux host, a
// container under a cgroup, and Windows, none of them true of the machine
// running this.
//
//   Andy, 2026-09-22: "the default should be total RAM divided by 2, for
//   an environment where relay is the only server (safety overhead)."
//   Andy: "the upper bound is: total memory minus the memory not
//   available at startup/install time due to system overhead. minus a
//   25 MB or so safety margin."
//   Andy, on the disc margin: "larger, considering temp folder
//   accumulation etc".

const test = require('./testSupport.js');
const limits = require('../run/js/relayLimits');

test.startTest('Relay limits — half the box, bounded by what it can give');

const MB = 1024 * 1024;

function run() {
  test.subHeading('The margins are the figures Andy set');
  if (limits.RAM_MARGIN_MB === 25 && limits.DISC_MARGIN_MB === 1024 && limits.DISC_MARGIN_SHARE === 0.05) {
    test.check('25 MB of RAM; the larger of 1 GB or 5% of the partition for disc');
  } else {
    test.fail('the margins moved: ' + JSON.stringify([limits.RAM_MARGIN_MB, limits.DISC_MARGIN_MB, limits.DISC_MARGIN_SHARE]));
  }

  test.subHeading('The ceiling is availability minus the margin');
  const c = limits.ceilings({ availableMB: 900, discFreeMB: 10240 });
  // Disc: 5% of 10240 is 512, which is less than 1024, so the floor wins.
  if (c.ramMaxMB === 875 && c.discMaxMB === 10240 - 1024) {
    test.check('900 MB available → 875 MB; 10 GB free → 9 GB, the 1 GB floor beating 5%');
  } else {
    test.fail('ceilings gave ' + JSON.stringify(c));
  }
  const big = limits.ceilings({ availableMB: 64000, discFreeMB: 400000 });
  if (big.discMaxMB === 400000 - 20000) {
    test.check('on a 400 GB partition the 5% share beats the 1 GB floor');
  } else {
    test.fail('the share did not take over: ' + JSON.stringify(big));
  }

  test.subHeading('A box too small for its own margin is left 1 MB, never a negative');
  const tiny = limits.ceilings({ availableMB: 10, discFreeMB: 20 });
  if (tiny.ramMaxMB === 1 && tiny.discMaxMB === 1) {
    test.check('10 MB available and 20 MB free → 1 MB each, the floor in relay.js');
  } else {
    test.fail('a tiny box gave ' + JSON.stringify(tiny));
  }

  test.subHeading('What cannot be measured is absent, not zero');
  const nothing = limits.ceilings({});
  if (nothing.ramMaxMB === undefined && nothing.discMaxMB === undefined) {
    test.check('no measurement → no ceiling, so "unmeasurable" and "none left" cannot be confused');
  } else {
    test.fail('an unmeasured box was given a ceiling: ' + JSON.stringify(nothing));
  }

  test.subHeading('The default is half the box');
  // A half-empty 20 GB disc shows both halves of the rule at once: RAM
  // takes half of total because availability allows it, while half the
  // disc's TOTAL is more than its free space can give, so the ceiling
  // takes it down to 10240 − 1024.
  const d = limits.defaults({ totalMB: 1024, availableMB: 900, discTotalMB: 20480, discFreeMB: 10240 });
  if (d.ramLimitMB === 512 && d.discLimitMB === 9216) {
    test.check('1 GB of RAM → 512 MB; half a 20 GB disc, clamped to the free space, → 9 GB');
  } else {
    test.fail('defaults gave ' + JSON.stringify(d));
  }
  const roomy = limits.defaults({ totalMB: 1024, availableMB: 900, discTotalMB: 20480, discFreeMB: 20000 });
  if (roomy.discLimitMB === 10240) {
    test.check('on an empty disc half of total stands, unclamped');
  } else {
    test.fail('an empty disc was clamped anyway: ' + JSON.stringify(roomy));
  }

  test.subHeading('…and is clamped to the ceiling, never the other way about');
  const busy = limits.defaults({ totalMB: 1024, availableMB: 300, discTotalMB: 20480, discFreeMB: 2048 });
  // RAM: half is 512, availability allows 275. Disc: half is 10240, free
  // is 2048 and the margin is the 1 GB floor, so 1024 stands.
  if (busy.ramLimitMB === 275 && busy.discLimitMB === 1024) {
    test.check('a busy box takes the smaller number in both resources');
  } else {
    test.fail('the clamp did not bite: ' + JSON.stringify(busy));
  }

  test.subHeading('MemAvailable is read, because free memory is the wrong question');
  const meminfo = 'MemTotal:        1017800 kB\nMemFree:           82000 kB\nMemAvailable:     716000 kB\nBuffers: 1 kB\n';
  const avail = limits.parseMemAvailable(meminfo);
  if (Math.round(avail) === Math.round(716000 / 1024)) {
    test.check('716000 kB available is read, not the 82000 kB free');
  } else {
    test.fail('MemAvailable parsed as ' + avail);
  }
  if (limits.parseMemAvailable('MemTotal: 1017800 kB\n') === null) {
    test.check('a kernel too old to report it answers null, so the caller falls back');
  } else {
    test.fail('a missing MemAvailable was not null');
  }

  test.subHeading('A cgroup cap is the container\'s ceiling, not the host\'s');
  const inCgroup = limits.parseCgroupAvailable(String(512 * MB), String(200 * MB));
  if (Math.round(inCgroup) === 312) {
    test.check('512 MB cap with 200 MB used → 312 MB left inside the cgroup');
  } else {
    test.fail('cgroup arithmetic gave ' + inCgroup);
  }
  if (limits.parseCgroupAvailable('max', '0') === null) {
    test.check('v2 "max" is no cap');
  } else {
    test.fail('"max" was read as a cap');
  }
  if (limits.parseCgroupAvailable('9223372036854771712', '0') === null) {
    test.check('v1\'s unlimited sentinel is no cap');
  } else {
    test.fail('the v1 sentinel was read as a cap');
  }
  if (limits.parseCgroupAvailable(String(100 * MB), String(300 * MB)) === 0) {
    test.check('a cgroup already over its limit has nothing left, never a negative');
  } else {
    test.fail('an over-limit cgroup gave a negative');
  }

  test.subHeading('The probe on a Linux box reads /proc/meminfo and the partition');
  const linux = limits.measure('/srv/spirit', {
    platform: 'linux',
    totalmem: function () { return 1024 * MB; },
    freemem: function () { return 82 * MB; },
    readFileSync: function (p) {
      if (p === '/proc/meminfo') return meminfo;
      throw new Error('ENOENT ' + p);
    },
    statfsSync: function () { return { bsize: 4096, blocks: 5 * 1024 * 1024, bavail: 2 * 1024 * 1024 }; },
  });
  if (Math.round(linux.availableMB) === 699 && Math.round(linux.totalMB) === 1024 &&
      Math.round(linux.discTotalMB) === 20480 && Math.round(linux.discFreeMB) === 8192) {
    test.check('available is MemAvailable, and the disc figures come off the relay-state partition');
  } else {
    test.fail('the Linux probe gave ' + JSON.stringify(linux));
  }

  test.subHeading('…and takes the cgroup\'s answer when it is smaller');
  const contained = limits.measure('/srv/spirit', {
    platform: 'linux',
    totalmem: function () { return 64000 * MB; },
    freemem: function () { return 1000 * MB; },
    readFileSync: function (p) {
      if (p === '/proc/meminfo') return meminfo;
      if (p === '/sys/fs/cgroup/memory.max') return String(512 * MB);
      if (p === '/sys/fs/cgroup/memory.current') return String(200 * MB);
      throw new Error('ENOENT ' + p);
    },
    statfsSync: function () { return { bsize: 4096, blocks: 5 * 1024 * 1024, bavail: 2 * 1024 * 1024 }; },
  });
  if (Math.round(contained.availableMB) === 312) {
    test.check('a container is bounded by its cgroup, not by the host it sits on');
  } else {
    test.fail('the cgroup was ignored: ' + JSON.stringify(contained));
  }

  test.subHeading('Windows falls back to free memory, and still measures its disc');
  const win = limits.measure('D:\\SpiritOS\\spirit\\run', {
    platform: 'win32',
    totalmem: function () { return 8192 * MB; },
    freemem: function () { return 4096 * MB; },
    readFileSync: function () { throw new Error('no /proc here'); },
    statfsSync: function () { return { bsize: 4096, blocks: 1024 * 1024, bavail: 512 * 1024 }; },
  });
  if (Math.round(win.availableMB) === 4096 && Math.round(win.discFreeMB) === 2048) {
    test.check('os.freemem() where there is no /proc/meminfo, and statfs for the disc');
  } else {
    test.fail('the Windows probe gave ' + JSON.stringify(win));
  }

  test.subHeading('A box that will not say is left absent, not guessed');
  const silent = limits.measure('/nowhere', {
    platform: 'linux',
    totalmem: function () { return 1024 * MB; },
    freemem: function () { return 512 * MB; },
    readFileSync: function () { throw new Error('ENOENT'); },
    statfsSync: function () { throw new Error('ENOENT'); },
  });
  if (silent.discFreeMB === undefined && silent.discTotalMB === undefined &&
      Math.round(silent.availableMB) === 512) {
    test.check('no disc figures rather than zeroes, and free memory still answers for RAM');
  } else {
    test.fail('a silent box was guessed at: ' + JSON.stringify(silent));
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
