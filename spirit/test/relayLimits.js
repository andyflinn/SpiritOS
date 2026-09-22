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

  test.subHeading('A box too small for its own margin is left something, never a negative');
  // RAM: 10 available, and a fixed 25 MB margin is more than all of it,
  // so the floor of 1 MB answers. DISC: the margin never takes more than
  // half of what is free, so 20 MB free leaves 10.
  const tiny = limits.ceilings({ availableMB: 10, discFreeMB: 20 });
  if (tiny.ramMaxMB === 1 && tiny.discMaxMB === 10) {
    test.check('10 MB available → the 1 MB floor; 20 MB free → 10 MB, half kept back');
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

  test.subHeading('The default is half the box, and never more than 256 MB');
  // Andy: "We never default to more than 256 MB." Half of a 1 GB box is
  // 512, so the cap is what answers here — and 256 is well under both
  // ceilings, so nothing else touches it.
  const d = limits.defaults({ totalMB: 1024, availableMB: 900, discTotalMB: 20480, discFreeMB: 10240 });
  if (d.ramLimitMB === 256 && d.discLimitMB === 256) {
    test.check('a 1 GB box defaults to 256 MB of RAM and 256 MB of disc, not to half of each');
  } else {
    test.fail('defaults gave ' + JSON.stringify(d));
  }

  test.subHeading('…and half the box when half the box is the smaller number');
  // RAM: half of 256 is 128, under the cap. DISC: half of 400 is 200,
  // but 380 free with the margin held to half leaves 190, so the ceiling
  // is the smallest of the three and answers.
  const small = limits.defaults({ totalMB: 256, availableMB: 240, discTotalMB: 400, discFreeMB: 380 });
  if (small.ramLimitMB === 128 && small.discLimitMB === 190) {
    test.check('a 256 MB box takes 128 MB — the cap is a ceiling on the default, not the default');
  } else {
    test.fail('a small box was given more than half of itself: ' + JSON.stringify(small));
  }

  test.subHeading('A workstation is not sized as though the relay owned it');
  // The case that prompted the rule: this machine measured 127.7 GB with
  // 58.5 GB available, and would have defaulted to an allowance near a
  // million streams for a lab fixture running beside an editor.
  const workstation = limits.defaults({ totalMB: 130767, availableMB: 59900, discTotalMB: 4769272, discFreeMB: 4442670 });
  if (workstation.ramLimitMB === 256 && workstation.discLimitMB === 256) {
    test.check('128 GB of RAM still defaults to 256 MB — an owner raises it on purpose or not at all');
  } else {
    test.fail('a workstation claimed itself: ' + JSON.stringify(workstation));
  }

  test.subHeading('…and is clamped to the ceiling, never the other way about');
  // A box with almost nothing to give: 200 available leaves 175 after the
  // margin, which is less than the 256 cap, so availability decides. The
  // disc is nearly full — 1200 free, the 1 GB margin leaves 176.
  // RAM: 200 available leaves 175 after the margin, under both half
  // (512) and the cap (256), so availability decides. DISC: 1200 free,
  // margin held to 600, ceiling 600 — so the 256 cap is still the
  // smallest and answers.
  const busy = limits.defaults({ totalMB: 1024, availableMB: 200, discTotalMB: 20480, discFreeMB: 1200 });
  if (busy.ramLimitMB === 175 && busy.discLimitMB === 256) {
    test.check('a busy box takes the smallest of the three: half, the cap, and what is available');
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

  test.subHeading('A unit\'s cap is at its OWN cgroup, not at the root');

  // wsl-claude, reviewing cycle 9 on Linux: "under systemd a unit's limit
  // is not there: it is at /sys/fs/cgroup/<path from /proc/self/cgroup>/
  // memory.max… the root file reads 'max'." Which is our own case, since
  // spirit-relay.service now sets MemoryMax.
  const v2dirs = limits.cgroupDirs('0::/system.slice/spirit-relay.service\n', false);
  if (v2dirs[0] === '/sys/fs/cgroup/system.slice/spirit-relay.service' &&
      v2dirs[1] === '/sys/fs/cgroup/system.slice' &&
      v2dirs[2] === '/sys/fs/cgroup') {
    test.check('the leaf first, then the slice, then the root — a cap may sit at any of them');
  } else {
    test.fail('the cgroup path was not walked: ' + JSON.stringify(v2dirs));
  }
  const v1dirs = limits.cgroupDirs('9:memory:/system.slice/spirit-relay.service\n4:cpu:/\n', true);
  if (v1dirs[0] === '/sys/fs/cgroup/memory/system.slice/spirit-relay.service') {
    test.check('and v1 reads the memory controller\'s own line, not whichever came first');
  } else {
    test.fail('the v1 path was wrong: ' + JSON.stringify(v1dirs));
  }
  if (limits.cgroupDirs('0::/init.scope\n', true).length === 0) {
    test.check('a box with no memory controller line answers nothing to walk');
  } else {
    test.fail('a v1 path was invented where there is none');
  }

  test.subHeading('…and the probe finds the cap there, where the root says "max"');

  const underUnit = limits.measure('/srv/spirit', {
    platform: 'linux',
    totalmem: function () { return 64000 * MB; },
    freemem: function () { return 60000 * MB; },
    readFileSync: function (p) {
      if (p === '/proc/self/cgroup') return '0::/system.slice/spirit-relay.service\n';
      if (p === '/proc/meminfo') return 'MemAvailable:     61000000 kB\n';
      // The root says no cap at all — the shape that hid the unit's cap.
      if (p === '/sys/fs/cgroup/memory.max') return 'max';
      if (p === '/sys/fs/cgroup/system.slice/memory.max') return 'max';
      if (p === '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.max') return String(384 * MB);
      if (p === '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.current') return String(100 * MB);
      throw new Error('ENOENT ' + p);
    },
    statfsSync: function () { return { bsize: 4096, blocks: 5 * 1024 * 1024, bavail: 2 * 1024 * 1024 }; },
  });
  if (Math.round(underUnit.availableMB) === 284) {
    test.check('a relay under MemoryMax=384M with 100 MB used sees 284 MB, not the 60 GB box');
  } else {
    test.fail('the unit\'s own cap was missed: ' + JSON.stringify(underUnit));
  }

  test.subHeading('…and the tightest cap wins when a slice caps its services');

  const undertSlice = limits.measure('/srv/spirit', {
    platform: 'linux',
    totalmem: function () { return 64000 * MB; },
    freemem: function () { return 60000 * MB; },
    readFileSync: function (p) {
      if (p === '/proc/self/cgroup') return '0::/system.slice/spirit-relay.service\n';
      if (p === '/proc/meminfo') return 'MemAvailable:     61000000 kB\n';
      if (p === '/sys/fs/cgroup/memory.max') return 'max';
      if (p === '/sys/fs/cgroup/system.slice/memory.max') return String(200 * MB);
      if (p === '/sys/fs/cgroup/system.slice/memory.current') return String(50 * MB);
      if (p === '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.max') return String(384 * MB);
      if (p === '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.current') return String(100 * MB);
      throw new Error('ENOENT ' + p);
    },
    statfsSync: function () { return { bsize: 4096, blocks: 5 * 1024 * 1024, bavail: 2 * 1024 * 1024 }; },
  });
  if (Math.round(undertSlice.availableMB) === 150) {
    test.check('the slice\'s 150 MB left beats the unit\'s 284 — the smallest cap decides');
  } else {
    test.fail('the slice cap was ignored: ' + JSON.stringify(undertSlice));
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
