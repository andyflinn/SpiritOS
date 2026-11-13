'use strict';

// spirit/run/spirit/test/relayLimits.js
// The tests of spirit/relayLimits.js, and of no other module (spec: ./relayLimits.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What the box can give and what a relay takes of it by default: pure arithmetic (ceilings, defaults, the parsers) and
// one probe (measure) whose every dependency is handed in, so a Linux box, a container and a Windows box are planted.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const L = require(path.join(RUN, 'spirit', 'relayLimits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const MB = 1024 * 1024;

// ── the margins and the cap, as Andy set them ──
test.run('the RAM margin is 25 MB (Andy: "minus a 25 MB or so safety margin")', 0.2, function () {
  return L.RAM_MARGIN_MB === 25 || 'RAM_MARGIN_MB ' + short(L.RAM_MARGIN_MB);
}, test.limit.quick);
test.run('a default is never more than 256 MB (Andy: "We never default to more than 256 MB.")', 0.2, function () {
  return L.DEFAULT_MAX_MB === 256 || 'DEFAULT_MAX_MB ' + short(L.DEFAULT_MAX_MB);
}, test.limit.quick);
test.run('the disc margin is larger than RAM\'s: a gigabyte, or a twentieth of what is free', 0.2, function () {
  return (L.DISC_MARGIN_MB === 1024 && L.DISC_MARGIN_SHARE === 0.05) || short({ mb: L.DISC_MARGIN_MB, share: L.DISC_MARGIN_SHARE });
}, test.limit.quick);

// ── ceilings: availability, not capacity ──
test.run('ceilings: the RAM ceiling is what is available less 25 MB, not the total', 0.2, function () {
  const c = L.ceilings({ totalMB: 4096, availableMB: 1000 });
  return c.ramMaxMB === 975 || 'ceilings ' + short(c);
}, test.limit.quick);
test.run('ceilings: a margin that would take the whole of a tiny box leaves 1 MB, never less', 0.2, function () {
  const c = L.ceilings({ availableMB: 10, discFreeMB: 1 });
  return (c.ramMaxMB === 1 && c.discMaxMB === 1) || 'ceilings ' + short(c);
}, test.limit.quick);
test.run('ceilings: on a big disc the margin is the larger of a gigabyte and a twentieth', 0.2, function () {
  const c = [L.ceilings({ discFreeMB: 10000 }).discMaxMB, L.ceilings({ discFreeMB: 100000 }).discMaxMB];
  return (c[0] === 10000 - 1024 && c[1] === 95000) || 'discMaxMB ' + short(c);
}, test.limit.quick);
test.run('ceilings: the disc margin never takes more than half of what is free', 0.2, function () {
  const c = L.ceilings({ discFreeMB: 400 });
  return c.discMaxMB === 200 || 'discMaxMB on 400 MB free ' + short(c);
}, test.limit.quick);
test.run('ceilings: a figure not measured is absent, not zero', 0.2, function () {
  const c = L.ceilings({});
  return (!('ramMaxMB' in c) && !('discMaxMB' in c)) || 'ceilings of nothing ' + short(c);
}, test.limit.quick);

// ── defaults: half the box, at most 256, clamped to the ceiling ──
test.run('defaults: half of what the box has (Andy: "total RAM divided by 2")', 0.2, function () {
  const d = L.defaults({ totalMB: 400, availableMB: 400, discTotalMB: 300, discFreeMB: 100000 });
  return (d.ramLimitMB === 200 && d.discLimitMB === 150) || 'defaults ' + short(d);
}, test.limit.quick);
test.run('defaults: never more than 256 MB, on a big box', 0.2, function () {
  const d = L.defaults({ totalMB: 131072, availableMB: 100000, discTotalMB: 1000000, discFreeMB: 500000 });
  return (d.ramLimitMB === 256 && d.discLimitMB === 256) || 'defaults ' + short(d);
}, test.limit.quick);
test.run('defaults: clamped to what the box can give, on a busy box', 0.2, function () {
  const d = L.defaults({ totalMB: 400, availableMB: 100, discTotalMB: 1000, discFreeMB: 100 });
  return (d.ramLimitMB === 75 && d.discLimitMB === 50) || 'defaults ' + short(d);
}, test.limit.quick);

// ── the parsers ──
test.run('parseMemAvailable: MemAvailable read in megabytes, null without the line', 0.2, function () {
  const got = [L.parseMemAvailable('MemTotal:  8000000 kB\nMemFree:  100 kB\nMemAvailable:    2097152 kB\n'), L.parseMemAvailable('MemFree: 100 kB\n'), L.parseMemAvailable(null)];
  return (got[0] === 2048 && got[1] === null && got[2] === null) || short(got);
}, test.limit.quick);
test.run('parseCgroupAvailable: the limit less the usage, in megabytes', 0.2, function () {
  const v = L.parseCgroupAvailable(String(512 * MB) + '\n', String(112 * MB));
  return v === 400 || 'available ' + short(v);
}, test.limit.quick);
test.run('parseCgroupAvailable: "max", the v1 sentinel and an empty file are no cap (null)', 0.2, function () {
  const got = [L.parseCgroupAvailable('max\n', '0'), L.parseCgroupAvailable('9223372036854771712', '0'), L.parseCgroupAvailable('', '0'), L.parseCgroupAvailable(null, null)];
  return got.every(function (x) { return x === null; }) || short(got);
}, test.limit.quick);
test.run('parseCgroupAvailable: a cgroup over its limit has nothing left, never a negative', 0.2, function () {
  const v = L.parseCgroupAvailable(String(100 * MB), String(200 * MB));
  return v === 0 || 'available ' + short(v);
}, test.limit.quick);
test.run('cgroupDirs: v2, from the leaf up to the root', 0.2, function () {
  const d = L.cgroupDirs('0::/system.slice/spirit-relay.service\n', false);
  return short(d) === short(['/sys/fs/cgroup/system.slice/spirit-relay.service', '/sys/fs/cgroup/system.slice', '/sys/fs/cgroup']) || short(d);
}, test.limit.quick);
test.run('cgroupDirs: v1 reads the memory controller\'s line, under its own root', 0.2, function () {
  const d = L.cgroupDirs('5:cpu,cpuacct:/x\n4:memory:/system.slice/a.service\n', true);
  return short(d) === short(['/sys/fs/cgroup/memory/system.slice/a.service', '/sys/fs/cgroup/memory/system.slice', '/sys/fs/cgroup/memory']) || short(d);
}, test.limit.quick);
test.run('cgroupDirs: no matching line is no directory', 0.2, function () {
  const d = [L.cgroupDirs('', false), L.cgroupDirs('4:cpu:/x\n', true)];
  return (d[0].length === 0 && d[1].length === 0) || short(d);
}, test.limit.quick);

// ── measure, on planted boxes ──
function box(files, extra) {
  return Object.assign({
    platform: 'linux',
    totalmem: function () { return 8192 * MB; },
    freemem: function () { return 100 * MB; },
    readFileSync: function (p) { if (Object.prototype.hasOwnProperty.call(files, p)) return files[p]; throw new Error('ENOENT ' + p); },
    statfsSync: function () { return { bsize: 4096, blocks: 256 * 1000, bavail: 256 * 400, bfree: 256 * 500 }; },
  }, extra || {});
}
test.run('measure: on Linux, availability is MemAvailable, not os.freemem()', 0.2, function () {
  const m = L.measure('/r', box({ '/proc/meminfo': 'MemAvailable: 3145728 kB\n' }));
  return (m.totalMB === 8192 && m.availableMB === 3072 && m.hostAvailableMB === 3072) || 'measured ' + short(m);
}, test.limit.quick);
test.run('measure: without MemAvailable it falls back to os.freemem(), as on Windows', 0.2, function () {
  const m = L.measure('/r', box({}, { platform: 'win32' }));
  return m.availableMB === 100 || 'measured ' + short(m);
}, test.limit.quick);
test.run('measure: a container is held to its own cgroup cap, read at its own cgroup, while hostAvailableMB stays the host\'s', 0.2, function () {
  const m = L.measure('/r', box({
    '/proc/meminfo': 'MemAvailable: 3145728 kB\n',
    '/proc/self/cgroup': '0::/system.slice/spirit-relay.service\n',
    '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.max': String(512 * MB),
    '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.current': String(12 * MB),
    '/sys/fs/cgroup/memory.max': 'max',
  }));
  return (m.availableMB === 500 && m.hostAvailableMB === 3072) || 'measured ' + short(m);
}, test.limit.quick);
test.run('measure: a slice\'s cap above the unit\'s counts, and the smallest wins', 0.2, function () {
  const m = L.measure('/r', box({
    '/proc/meminfo': 'MemAvailable: 3145728 kB\n',
    '/proc/self/cgroup': '0::/system.slice/a.service\n',
    '/sys/fs/cgroup/system.slice/a.service/memory.max': String(900 * MB),
    '/sys/fs/cgroup/system.slice/memory.max': String(300 * MB),
    '/sys/fs/cgroup/system.slice/memory.current': String(100 * MB),
  }));
  return m.availableMB === 200 || 'measured ' + short(m);
}, test.limit.quick);
test.run('measure: the disc is the partition of spirit/state, bavail as free', 0.2, function () {
  let asked = null;
  const m = L.measure('/r', box({}, { statfsSync: function (p) { asked = p; return { bsize: 4096, blocks: 256 * 1000, bavail: 256 * 400, bfree: 256 * 500 }; } }));
  return (asked === path.join('/r', 'spirit', 'state') && m.discTotalMB === 1000 && m.discFreeMB === 400) || short({ asked: asked, m: m });
}, test.limit.quick);
test.run('measure: a disc that will not say is absent, not guessed', 0.2, function () {
  const m = L.measure('/r', box({}, { statfsSync: function () { throw new Error('nope'); } }));
  return (!('discTotalMB' in m) && !('discFreeMB' in m)) || 'measured ' + short(m);
}, test.limit.quick);
