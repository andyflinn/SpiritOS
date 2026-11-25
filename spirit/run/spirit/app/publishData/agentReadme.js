'use strict';
require('../../script.js');

// spirit/run/spirit/app/publishData/agentReadme.js
// THE PLATFORM'S README (goal/G47.1, box v170, "#### publishData"), written by publishData.js into platform/<platform>/,
// and the list of platforms, platform/README.md. In this order, as the box has it:
//   the title "# Info and Measurements on <platform-name>"
//   "Measurements were taken on **<Weekday>, <Month> <day-number-in-month>, <four-digit-year>, <hh:mm> UTC** for repository commit **<commit-id>**"
//   "## The Machine the Measurements come from", six bullets, each value node.js's system info
//   "## Summary": the members a 512 MB relay serves, a node at rest, a call on its own machine, a card request through a relay
//   "## Details": links to documents beside it, testState.md first
// No raw numbers: only these lines (the box: "no iteration of a measurement is published, only these lines").
//
// THE MEMBERS FIGURE IS THE RELAY'S OWN RULE (box v170: "<number-of-users> computed by the relay's own rule; no memory per
// stream is measured or shown"): spirit/relay/processor/script.js's allowanceFor at 512 MB, less the relay's memory at rest as publishData
// measured it on its lab relay (relayAtRestRss), in seats of SEAT_STREAMS streams.
//
//   write(out, platform, facts)   writes out/README.md; facts: { at (a Date), commit, machine?, summary }, summary
//                                 { members, nodeAtRestMB, loop: {median, max}, relayed: {median, max, crypto} }, details
//                                 [{ label, file }]; machine defaults to machineOf(), this machine now
//   writeList(platformDir)        writes platformDir/README.md: its title and one link per platform folder holding a README.md
//   summaryOf(capacity)           { members, ramMB, perMember, streams, peers, diskMB, measuredAt, commit } or null
//   machineOf()                   the facts of this machine

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RAM_MB = 512;
const DISK_MB = 512;
// The platforms a folder may be named after (goal/G47.1, box v104: "the platforms will be \"windows\", \"wsl\" and \"ubuntu\"").
const PLATFORMS = ['windows', 'wsl', 'ubuntu'];

function n(x) { return Number(x || 0).toLocaleString('en-US'); }
function mbOf(bytes) { return n(Math.round(Number(bytes || 0) / 1048576)) + ' MB'; }
function ms(x) { return String(Math.round(Number(x || 0) * 10) / 10); }

function summaryOf(cap) {
  if (!cap || !(Number(cap.relayAtRestRss) > 0)) return null;
  const relay = spirit.requireScript('spirit/relay/processor/script.js');
  const allowance = relay.allowanceFor(RAM_MB, Number(cap.relayAtRestRss) / 1048576);
  const members = allowance ? Math.floor(allowance / relay.SEAT_STREAMS) : 0;
  const perPeer = Number(cap.perReachablePeerBytes) || 0;
  return {
    members: members, ramMB: RAM_MB, perMember: relay.SEAT_STREAMS, streams: members * relay.SEAT_STREAMS,
    peers: perPeer > 0 ? Math.floor(DISK_MB * 1048576 / perPeer) : 0, diskMB: DISK_MB,
    measuredAt: String(cap.measuredAt || ''), commit: String(cap.commit || ''),
  };
}

// The SpiritOS node processes on this machine: node processes running spirit/server/script.js.
function spiritNodes() {
  const lines = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $_.CommandLine }"], { encoding: 'utf8', windowsHide: true }).stdout
    : spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' }).stdout;
  return String(lines || '').split(/\r?\n/).filter(function (l) { return /\bnode(\.exe)?["']?\s/i.test(l) && /spirit[\/\\]server\.js/.test(l); }).length;
}
function machineOf() {
  const cpus = os.cpus();
  return {
    platform: process.platform, os: os.type() + ' ' + os.release(), type: os.type(), release: os.release(), arch: process.arch,
    totalRamBytes: os.totalmem(), usedRamBytes: os.totalmem() - os.freemem(),
    cpu: { model: String((cpus[0] && cpus[0].model) || '').trim().replace(/\s+/g, ' '), cores: cpus.length },
    node: { release: String((process.release && process.release.name) || 'node'), version: process.version,
      lts: String((process.release && process.release.lts) || ''), path: process.execPath },
    spiritNodes: spiritNodes(), at: new Date().toISOString(),
  };
}

// "<Weekday>, <Month> <day-number-in-month>, <four-digit-year>, <hh:mm> UTC", the day and the minute of the run, in UTC
// (goal/G49.5; Andy: "README.md does not show the fucking time at all (UTC!!!)").
function dayOf(at) {
  var day = at.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return day + ', ' + at.toISOString().slice(11, 16) + ' UTC';
}

// THE OUTSTANDING ISSUES, THREE BULLETS OF THE SUMMARY (goal/G48.5, Andy: "The product tree, right now, has <number>
// outstanding issues in the test database.", "The leading module responsible for that count is <full-module-name>.", "The
// leading test suite contributing to the error count is <full-suite-name>."): from issues { count, module, suite }, each
// leader { name, count } or null; none when publishData read no test state; the two leaders left out when nothing is red.
// EACH LEADER WITH ITS OWN COUNT (Andy: "fix my bullets to also reflect the errors contributed by the leading script and
// suite."): "..., with <n> of them."
function issuesOf(issues) {
  if (!issues) return [];
  const out = ['- The product tree, right now, has ' + n(issues.count) + ' outstanding issues in the test database.'];
  if (issues.module) out.push('- The leading module responsible for that count is ' + issues.module.name + ', with ' + n(issues.module.count) + ' of them.');
  if (issues.suite) out.push('- The leading test suite contributing to the error count is ' + issues.suite.name + ', with ' + n(issues.suite.count) + ' of them.');
  return out;
}
function write(out, platform, facts) {
  const f = facts || {};
  const m = f.machine || machineOf();
  const s = f.summary || {};
  const lines = [
    '# Info and Measurements on ' + platform, '',
    'Measurements were taken on **' + dayOf(f.at || new Date()) + '** for repository commit **' + String(f.commit || 'unknown') + '**', '',
    '## The Machine the Measurements come from', '',
    '- **OS/Platform**: ' + m.type + ' (' + m.platform + ')',
    '- **OS Version**: ' + m.release,
    '- **Node.js Version**: ' + m.node.version,
    '- **Total RAM**: ' + mbOf(m.totalRamBytes),
    '- **CPU**: ' + m.cpu.model + ', ' + m.cpu.cores + ' cores',
    '- **Architecture**: ' + m.arch, '',
    '## Summary', '',
    '- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for ' + n(s.members) + ' simultaneously.',
    '- A SpiritOS node at rest uses ' + n(s.nodeAtRestMB) + ' MB of RAM.',
    '- A call to a node on its own machine answers in ' + ms(s.loop && s.loop.median) + ' ms, the slowest in ' + ms(s.loop && s.loop.max) + ' ms.',
    '- A card request through a relay takes ' + ms(s.relayed && s.relayed.median) + ' ms, the slowest ' + ms(s.relayed && s.relayed.max) +
      ' ms; sealing and signing take ' + ms(s.relayed && s.relayed.crypto) + ' ms of it.',
  ].concat(issuesOf(s.issues)).concat(['', '## Details', ''])
    .concat((f.details || []).map(function (d) { return '- [' + d.label + '](' + d.file + ')'; })).concat(['']);
  fs.writeFileSync(path.join(out, 'README.md'), lines.join('\n'));
}

// THE LIST OF PLATFORMS (box v170: "platform/README.md holds the title \"Measurements exists for the following platforms\"
// and one bullet per platform folder (windows, wsl, ubuntu), each a link to that folder's README.md, and nothing else"):
// written whole from the folders there, so a run on one machine keeps the others' lines.
function writeList(platformDir) {
  const have = PLATFORMS.filter(function (p) { return fs.existsSync(path.join(platformDir, p, 'README.md')); });
  const lines = ['# Measurements exists for the following platforms', ''].concat(have.map(function (p) { return '- [' + p + '](' + p + '/README.md)'; })).concat(['']);
  fs.writeFileSync(path.join(platformDir, 'README.md'), lines.join('\n'));
  return have;
}

module.exports = { write: write, writeList: writeList, summaryOf: summaryOf, machineOf: machineOf };
