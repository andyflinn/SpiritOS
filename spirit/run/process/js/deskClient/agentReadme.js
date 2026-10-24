'use strict';

// spirit/run/process/js/deskClient/agentReadme.js
// AN AGENT'S README IN THE MEASUREMENT TREE (goal/G33.5), written by publishData.js into agents/<agent>/. The box, Andy:
// "The title, the agents name is fine, then MUST come under the first sub-heading, 'Machine Description', a full account
// of the actual system the measurements were taken on, including OS/platform, total RAM and RAM used at the time the
// agents README.md was generated, the release and identity of the installed node.js, the number of node servers running
// on that system at the time of generating the agents README.md etc...", "under the second sub-heading 'Summary', in
// bullet points. first: bullet, the number of members that can be served with a 512MB allotment of RAM. second bullet,
// the number of streams that implies with 3 live streams per member, naming what the streams are for. third bullet: how
// many peers can be remembered with also 512 MB allotted disk-space.", and "Then under a third sub-heading,
// 'Measurements' comes that little table". "The number of node servers running" means the SpiritOS node processes on
// that machine, not every node.js process.
//
// THE MEMBERS FIGURE IS THE RELAY'S OWN RULE (Andy chose it, box v11): js/relay.js's allowanceFor at 512 MB, less the
// relay's memory at rest as this agent's set measured it (relayAtRestRss), in seats of SEAT_STREAMS streams. The peers
// figure is 512 MB of disk over the measured bytes of a peer a node can reach (perReachablePeerBytes).
//
//   write(out, agent, machine?)   writes out/README.md and out/summary.json from out/capacity.json and the files there;
//                                 machine defaults to machineOf(), this machine now
//   summaryOf(capacity)           { members, ramMB, streams, perMember, peers, measuredAt, commit } or null
//   machineOf()                   the facts of this machine for Machine Description

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RAM_MB = 512;
const DISK_MB = 512;
// What each of a member's streams is for (js/relay.js, SEAT_STREAMS: "a member with an open face holds its home node's
// stream, its face's stream and its home node's upload feeding that face").
const STREAM_NAMES = ['its home node\'s stream', 'its face\'s stream', 'its home node\'s upload feeding that face'];

function n(x) { return Number(x || 0).toLocaleString('en-US'); }
function mb(bytes) { return n(Math.round(Number(bytes || 0) / 1048576)) + ' MB'; }

function summaryOf(cap) {
  if (!cap || !(Number(cap.relayAtRestRss) > 0)) return null;
  const relay = require('../../../js/relay.js');
  const allowance = relay.allowanceFor(RAM_MB, Number(cap.relayAtRestRss) / 1048576);
  const members = allowance ? Math.floor(allowance / relay.SEAT_STREAMS) : 0;
  const perPeer = Number(cap.perReachablePeerBytes) || 0;
  return {
    members: members, ramMB: RAM_MB, perMember: relay.SEAT_STREAMS, streams: members * relay.SEAT_STREAMS,
    peers: perPeer > 0 ? Math.floor(DISK_MB * 1048576 / perPeer) : 0, diskMB: DISK_MB,
    measuredAt: String(cap.measuredAt || ''), commit: String(cap.commit || ''),
  };
}

// The SpiritOS node processes on this machine: node processes running js/server.js.
function spiritNodes() {
  const lines = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $_.CommandLine }"], { encoding: 'utf8', windowsHide: true }).stdout
    : spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' }).stdout;
  return String(lines || '').split(/\r?\n/).filter(function (l) { return /\bnode(\.exe)?["']?\s/i.test(l) && /js[\/\\]server\.js/.test(l); }).length;
}
function machineOf() {
  return {
    platform: process.platform, os: os.type() + ' ' + os.release(), arch: process.arch,
    totalRamBytes: os.totalmem(), usedRamBytes: os.totalmem() - os.freemem(),
    node: { release: String((process.release && process.release.name) || 'node'), version: process.version,
      lts: String((process.release && process.release.lts) || ''), path: process.execPath },
    spiritNodes: spiritNodes(), at: new Date().toISOString(),
  };
}

function write(out, agent, machine) {
  const m = machine || machineOf();
  const read = function (f) { try { return JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')); } catch (e) { return null; } };
  const cap = read('capacity.json');
  const s = summaryOf(cap);
  const when = function (j) { return j ? String(j.measuredAt || j.at || '').slice(0, 10) + ', `' + String(j.commit || '?').slice(0, 8) + '`' : 'not measured yet'; };
  const row = function (label, file, j) { return '| [' + label + '](' + file + ') | ' + (fs.existsSync(path.join(out, file)) ? when(j) : 'not measured yet') + ' |'; };
  const studiesDir = path.join(out, 'studies');
  let studies = [];
  try { studies = fs.readdirSync(studiesDir).filter(function (d) { return fs.statSync(path.join(studiesDir, d)).isDirectory(); }).sort(); } catch (e) { studies = []; }
  const lines = [
    '# ' + agent, '',
    '## Machine Description', '',
    '| | |', '|---|---|',
    '| OS / platform | ' + m.os + ' (' + m.platform + ', ' + m.arch + ') |',
    '| total RAM | ' + mb(m.totalRamBytes) + ' |',
    '| RAM used when this was written | ' + mb(m.usedRamBytes) + ' |',
    '| node.js | ' + m.node.release + ' ' + m.node.version + (m.node.lts ? ' (LTS ' + m.node.lts + ')' : '') + ', `' + m.node.path + '` |',
    '| SpiritOS node processes running | ' + m.spiritNodes + ' |',
    '| written | ' + String(m.at).slice(0, 19).replace('T', ' ') + ' UTC |', '',
    '## Summary', '',
  ].concat(s ? [
    '- **' + n(s.members) + ' members** can be served with a ' + s.ramMB + ' MB allotment of RAM (this relay\'s own rule, ' +
      'js/relay.js, applied to its measured memory at rest).',
    '- That is **' + n(s.streams) + ' live streams**, ' + s.perMember + ' per member: ' + STREAM_NAMES.join(', ') + '.',
    '- **' + n(s.peers) + ' peers** can be remembered with ' + s.diskMB + ' MB of disk, each a peer a node can reach.',
  ] : ['- not measured yet']).concat([
    '',
    '## Measurements', '',
    '| | measured |', '|---|---|',
    row('the box', 'platform.md', cap || read('packets.json')),
    row('harness', 'harness.txt', read('harness.json')),
    row('capacity', 'capacity.md', cap),
    row('packets', 'packets.md', read('packets.json')),
    row('test state', 'testState.md', read('testState.json')), '',
    '## Studies', '',
  ]).concat(studies.length ? studies.map(function (d) { return '- [' + d + '](studies/' + d + '/)'; }) : ['none yet']).concat(['']);
  fs.writeFileSync(path.join(out, 'README.md'), lines.join('\n'));
  // THE SUMMARY AS DATA, so the repo README quotes it (spirit/test/publishCapacity.js) without reading markdown.
  if (s) fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(Object.assign({ agent: agent }, s), null, 2) + '\n');
  return s;
}

module.exports = { write: write, summaryOf: summaryOf, machineOf: machineOf };
