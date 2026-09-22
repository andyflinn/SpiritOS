'use strict';

// spirit/run/js/relayLimits.js
// WHAT THE BOX CAN ACTUALLY GIVE, AND WHAT A RELAY TAKES OF IT BY DEFAULT.
//
// ── WHY THIS IS A FILE AND NOT TWO LINES IN relayConfig ──────────────
//
//   Andy, 2026-09-22: "the default should be total RAM divided by 2, for
//   an environment where relay is the only server (safety overhead)."
//   Andy: "the upper bound is: total memory minus the memory not
//   available at startup/install time due to system overhead. minus a
//   25 MB or so safety margin."
//   Andy: "both, installer and relay-at-first-start will use those
//   boundaries, for default, and the installer computes the abuslute max
//   through those platform-specific formulas."
//
// TWO CALLERS, ONE ARITHMETIC. The installer proposes figures before a
// relay exists; a relay with no `config.json` writes its own. If each
// measured the box its own way they would disagree on the same machine,
// and the disagreement would show up as a relay refusing to start on the
// numbers its own installer suggested.
//
// ── TWO NUMBERS, AND THEY ARE NOT THE SAME NUMBER ────────────────────
//
//   the default   half of what the box HAS — the other half is the
//                 safety overhead for a box where the relay is the only
//                 server, which is the case this assumes
//   the ceiling   what the box can actually GIVE at this moment, minus a
//                 margin — availability, not capacity
//
// The default is clamped to the ceiling, never the other way about: on a
// box already running other services, half of total can be more than is
// available, and availability wins. `relayConfig.js` refuses anything
// above the ceiling; this file is what tells it where the ceiling is.
//
// ── PURE FIGURES, ONE PROBE ──────────────────────────────────────────
//
// `ceilings` and `defaults` are arithmetic on numbers handed in, so the
// margins and the clamping are testable without a machine. `measure` is
// the only thing that touches the box, and every dependency it uses is
// injectable for the same reason.

var fs = require('fs');
var os = require('os');
var path = require('path');

// ── THE MARGINS ──────────────────────────────────────────────────────
//
// RAM: Andy's figure, for the overhead between "available" as the kernel
// reports it and what a process can really take without the box starting
// to suffer.
var RAM_MARGIN_MB = 25;

// DISC: Andy, asked whether 25 MB would do here too — "larger,
// considering temp folder accumulation etc". It is the larger of a
// gigabyte and a twentieth of the partition, and it is defending against
// everything on the box EXCEPT the relay: journald, Caddy's access log,
// apt caches, /tmp. The relay's own database is members, invites and
// partners and is small; a full disc, by contrast, takes down journald,
// the access log and SQLite's rollback journal at once.
var DISC_MARGIN_MB = 1024;
var DISC_MARGIN_SHARE = 0.05;

// ── A DEFAULT IS NEVER MORE THAN 256 MB ──────────────────────────────
//
//   Andy, 2026-09-22: "We never default to more than 256 MB."
//
// Half the box is the rule for the machine a relay was PUT on; it is the
// wrong answer for the machine a relay merely happens to be on. A
// workstation with 128 GB would default to tens of gigabytes and an
// allowance near a million streams, for a box whose owner was running a
// lab fixture beside his editor and his models.
//
// So the cycle-1 figure survives, in the role it should always have had:
// not a fixed default, but the CEILING ON A DEFAULT. Half the box below
// it, 256 MB above it, and anything larger is a figure an owner types on
// purpose — which is the only way a relay should ever be big.
//
//   Andy, 2026-09-22: "when mom says: you're allowed to eat cake, she
//   doesn't mean the whole cake."
//
// The same sentence governs the margins above. Permission to take from a
// shared thing is not permission to take all of it, so the disc margin
// never exceeds half of what is free either: a margin that leaves nothing
// protects nothing.
var DEFAULT_MAX_MB = 256;

// A cgroup v1 file says "no limit" with a number so large it is a
// sentinel rather than a bound (LONG_MAX rounded down to a page). v2 says
// it in words. Both must read as "no cap" or a container would be told it
// has eight exabytes.
var CGROUP_V1_UNLIMITED = 9223372036854771712;

function mbOf(bytes) { return Number(bytes) / (1024 * 1024); }

// ── /proc/meminfo, AND WHY NOT os.freemem() ──────────────────────────
//
// `os.freemem()` on Linux reports memory that is FREE, which excludes the
// page cache the kernel would hand back the moment anybody asked. A warm
// box with 1 GB can report 80 MB free while 700 MB is available, and a
// ceiling built on that would refuse figures the machine can supply
// easily. `MemAvailable` is the kernel's own answer to exactly this
// question, and it has been there since 2014.
//
// Returns megabytes, or null when the line is absent — a caller that gets
// null falls back to `os.freemem()`, which is right everywhere else.
function parseMemAvailable(text) {
  var m = /^MemAvailable:\s+(\d+)\s*kB/m.exec(String(text || ''));
  if (!m) return null;
  return Number(m[1]) / 1024;
}

// ── A CONTAINER'S CEILING IS NOT ITS HOST'S ──────────────────────────
//
// Found by wsl-claude, 2026-09-22: "MemAvailable ignores cgroup limits:
// in a container or a systemd slice the node would read the host's memory
// and set a bound it cannot keep."
//
// `limitText` is memory.max (v2) or memory.limit_in_bytes (v1);
// `usageText` is memory.current or memory.usage_in_bytes. What is left
// inside the cgroup is the limit minus what the cgroup is already using —
// the same question MemAvailable answers for the host.
//
// ── WHERE A PROCESS'S OWN CAP ACTUALLY LIVES ─────────────────────────
//
// Found by wsl-claude, 2026-09-22, reviewing cycle 9 on Linux: "the
// cgroup cap is read at the root, not at the process's own cgroup…
// under systemd a unit's limit is not there: it is at
// /sys/fs/cgroup/<path from /proc/self/cgroup>/memory.max… the root file
// reads 'max'."
//
// Which is the exact case the branch exists for, and now our own case:
// `bash/systemd/spirit-relay.service` sets MemoryMax, so every relay on a
// real host runs under a cap the root file does not show.
//
// `/proc/self/cgroup` gives the path — v2 as `0::/system.slice/x.service`,
// v1 as `N:memory:/system.slice/x.service`. A limit may be set at any
// level above the leaf too (a slice caps its services), so this answers
// every directory from the leaf up to the root and the caller takes the
// smallest cap it finds.
function cgroupDirs(cgroupText, v1) {
  var lines = String(cgroupText || '').split('\n');
  var rel = null;
  for (var i = 0; i < lines.length; i += 1) {
    var parts = lines[i].split(':');
    if (parts.length < 3) continue;
    var controllers = parts[1];
    var isV2 = controllers === '';
    if (v1 ? /(^|,)memory(,|$)/.test(controllers) : isV2) { rel = parts.slice(2).join(':'); break; }
  }
  if (rel === null) return [];
  var base = v1 ? '/sys/fs/cgroup/memory' : '/sys/fs/cgroup';
  var segments = rel.split('/').filter(Boolean);
  var out = [];
  while (segments.length) {
    out.push(base + '/' + segments.join('/'));
    segments.pop();
  }
  out.push(base);
  return out;
}

// Returns megabytes available INSIDE the cgroup, or null when there is no
// cap. Never negative: a cgroup already over its limit has nothing left.
function parseCgroupAvailable(limitText, usageText) {
  var raw = String(limitText == null ? '' : limitText).trim();
  if (!raw || raw === 'max') return null;
  var limit = Number(raw);
  if (!isFinite(limit) || limit <= 0 || limit >= CGROUP_V1_UNLIMITED) return null;
  var used = Number(String(usageText == null ? '' : usageText).trim());
  if (!isFinite(used) || used < 0) used = 0;
  return Math.max(0, mbOf(limit - used));
}

// ── THE CEILINGS ─────────────────────────────────────────────────────
//
// `available` figures in, ceilings out. A margin that would take the
// whole of a tiny box leaves 1 MB rather than a negative number: the
// floor in relay.js is one stream, so one megabyte is the smallest thing
// a relay can honestly be told it may have.
function ceilings(measured) {
  var m = measured || {};
  var availableMB = Number(m.availableMB);
  var discFreeMB = Number(m.discFreeMB);
  var out = {};

  if (isFinite(availableMB) && availableMB > 0) {
    out.ramMaxMB = Math.max(1, Math.floor(availableMB - RAM_MARGIN_MB));
  }
  if (isFinite(discFreeMB) && discFreeMB > 0) {
    // NEVER MORE THAN HALF OF WHAT IS FREE. A gigabyte is the right
    // margin on a 25 GB VPS and absurd on a 400 MB volume, where it
    // would leave the floor of 1 MB and a relay that refuses its second
    // member. Found by the suite, cycle 9: the margin protects the box
    // from the relay, and a margin that takes everything protects
    // nothing.
    var margin = Math.min(discFreeMB / 2, Math.max(DISC_MARGIN_MB, discFreeMB * DISC_MARGIN_SHARE));
    out.discMaxMB = Math.max(1, Math.floor(discFreeMB - margin));
  }
  return out;
}

// ── THE DEFAULTS ─────────────────────────────────────────────────────
//
// Half of what the box HAS, clamped to what it can GIVE. Andy's rule for
// both resources; the clamp is what keeps it honest on a box that is
// already busy, where half of total is a number the machine cannot
// supply.
//
// It replaced `DEFAULT_RAM_LIMIT_MB = 256` — a placeholder from cycle 1
// that was the same figure on a 1 GB VPS and a 64 GB workstation.
function defaults(measured) {
  var m = measured || {};
  var caps = ceilings(m);
  var out = {};

  var totalMB = Number(m.totalMB);
  if (isFinite(totalMB) && totalMB > 0) {
    out.ramLimitMB = Math.max(1, Math.min(Math.floor(totalMB / 2), DEFAULT_MAX_MB));
    if (isFinite(caps.ramMaxMB)) out.ramLimitMB = Math.min(out.ramLimitMB, caps.ramMaxMB);
  }

  var discTotalMB = Number(m.discTotalMB);
  if (isFinite(discTotalMB) && discTotalMB > 0) {
    // THE SAME CEILING ON THE DISC DEFAULT, for the same reason: at about
    // a kilobyte a member, 256 MB is a quarter of a million of them, so
    // no relay is short of room by default and none of them reserves a
    // slice of somebody's workstation it will never use.
    out.discLimitMB = Math.max(1, Math.min(Math.floor(discTotalMB / 2), DEFAULT_MAX_MB));
    if (isFinite(caps.discMaxMB)) out.discLimitMB = Math.min(out.discLimitMB, caps.discMaxMB);
  }
  return out;
}

// ── THE PROBE ────────────────────────────────────────────────────────
//
// The only part that touches the box. Everything it uses is injectable,
// so the suites drive a Linux box, a container and a Windows box from one
// process without any of them being true.
//
//   totalMB      what the machine has
//   availableMB  what it can give now — the smaller of the host's answer
//                and the cgroup's, when there is a cgroup
//   discTotalMB  the partition holding `rootDir`
//   discFreeMB   what is free on it
//
// A figure that cannot be measured is ABSENT rather than zero, the same
// way `relayStatus` leaves out what a relay did not report: "not
// measurable here" and "none left" must not be read the same.
function measure(rootDir, deps) {
  var d = deps || {};
  var readFile = d.readFileSync || function (p) { return fs.readFileSync(p, 'utf8'); };
  var statfs = d.statfsSync || fs.statfsSync;
  var totalmem = d.totalmem || os.totalmem;
  var freemem = d.freemem || os.freemem;
  var platform = d.platform || process.platform;
  var out = {};

  out.totalMB = mbOf(totalmem());

  var hostAvailable = null;
  if (platform === 'linux') {
    try { hostAvailable = parseMemAvailable(readFile('/proc/meminfo')); } catch (e) { hostAvailable = null; }
  }
  if (hostAvailable == null) hostAvailable = mbOf(freemem());
  out.availableMB = hostAvailable;

  // WSL MOVES THE FLOOR (wsl-claude, 2026-09-22): "WSL2's memory is
  // elastic; a ceiling measured once at startup drifts as the VM grows or
  // is reclaimed." Nothing here can fix that — it is why the caller
  // re-measures rather than trusting a figure taken at boot for ever.
  if (platform === 'linux') {
    // THE LEAF FIRST, THEN EVERY SLICE ABOVE IT, and the smallest wins: a
    // service may be capped by its own unit, by the slice holding it, or
    // by both. The root is tried last so a box with no cgroup path still
    // reads whatever is there.
    var self = tryRead(readFile, '/proc/self/cgroup');
    var dirs = cgroupDirs(self, false).concat(cgroupDirs(self, true));
    if (!dirs.length) dirs = ['/sys/fs/cgroup', '/sys/fs/cgroup/memory'];
    var capped = null;
    dirs.forEach(function (dir) {
      var found = null;
      var v2 = tryRead(readFile, dir + '/memory.max');
      if (v2 != null) {
        found = parseCgroupAvailable(v2, tryRead(readFile, dir + '/memory.current'));
      } else {
        var v1 = tryRead(readFile, dir + '/memory.limit_in_bytes');
        if (v1 != null) found = parseCgroupAvailable(v1, tryRead(readFile, dir + '/memory.usage_in_bytes'));
      }
      if (found != null) capped = capped === null ? found : Math.min(capped, found);
    });
    if (capped != null) out.availableMB = Math.min(out.availableMB, capped);
  }

  // THE PARTITION THE RELAY ACTUALLY WRITES TO, not the one it was
  // started from: `relay-state/` is where the database, the keys and the
  // config live, and on a box with a mounted data volume that is a
  // different disc from the checkout.
  try {
    var st = statfs(path.join(rootDir || '.', 'relay-state'));
    if (st && st.bsize > 0) {
      out.discTotalMB = mbOf(st.bsize * st.blocks);
      out.discFreeMB = mbOf(st.bsize * (st.bavail === undefined ? st.bfree : st.bavail));
    }
  } catch (e) {
    try {
      var st2 = statfs(rootDir || '.');
      if (st2 && st2.bsize > 0) {
        out.discTotalMB = mbOf(st2.bsize * st2.blocks);
        out.discFreeMB = mbOf(st2.bsize * (st2.bavail === undefined ? st2.bfree : st2.bavail));
      }
    } catch (e2) { /* a box that will not say is left absent, not guessed */ }
  }

  return out;
}

function tryRead(readFile, p) {
  try { return readFile(p); } catch (e) { return null; }
}

module.exports = {
  RAM_MARGIN_MB: RAM_MARGIN_MB,
  DEFAULT_MAX_MB: DEFAULT_MAX_MB,
  DISC_MARGIN_MB: DISC_MARGIN_MB,
  DISC_MARGIN_SHARE: DISC_MARGIN_SHARE,
  parseMemAvailable: parseMemAvailable,
  parseCgroupAvailable: parseCgroupAvailable,
  cgroupDirs: cgroupDirs,
  ceilings: ceilings,
  defaults: defaults,
  measure: measure,
};
