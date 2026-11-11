'use strict';

// spirit/run/spirit/app/publishData/test/agentReadme.js
// The tests of spirit/app/publishData/agentReadme.js, and of no other module (spec: ./agentReadme.md; goal/G41.11). The
// module is required as publishData requires it; write() runs on a scratch agents/<agent>/ folder of the test's own,
// with a machine handed in, so what it writes is known. The relay's own rule (spirit/relay.js allowanceFor) is the real
// one, as the module's members figure is.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'agentReadme.js');
const TMP = path.join(RUN, 'test', '_tmp_agentReadme');
const relay = require(path.join(RUN, 'spirit', 'relay.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const MB = 1048576;

const MACHINE = { platform: 'win32', os: 'Windows_NT 10.0.26200', arch: 'x64', totalRamBytes: 32768 * MB, usedRamBytes: 1536 * MB,
  node: { release: 'node', version: 'v24.20.0', lts: 'Krypton', path: 'C:\\node\\node.exe' }, spiritNodes: 3, at: '2026-10-27T12:34:56.789Z' };
const CAP = { relayAtRestRss: 100 * MB, perReachablePeerBytes: 2048, measuredAt: '2026-10-26T08:00:00Z', commit: 'abcdef1234567' };

// What the tests below make, each in order, read by the tests after it.
test.after(function () { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
let R, s, allowance, less, noWhen, out, ret, md, lines, at, sum, n, sj, bare, none, md2, m;
test.run('it exports write, summaryOf and machineOf', 0.2, function () {
  R = null;
  try { R = require(FILE); } catch (e) { return 'agentReadme.js threw as it loaded: ' + e.message; }
  return (R && typeof R.write === 'function' && typeof R.summaryOf === 'function' && typeof R.machineOf === 'function') ? true : 'exports ' + short(R && Object.keys(R));
}, 1000);

// summaryOf: the relay's own rule at 512 MB
test.run('the members are the seats the relay allows in 512 MB of RAM', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  s = R.summaryOf(CAP);
  allowance = relay.allowanceFor(512, 100);
  return (s && s.members === Math.floor(allowance / relay.SEAT_STREAMS) && s.members > 0) ? true : 'got ' + short(s);
}, 1000);
test.run('the streams are the members times the streams of a seat, in 512 MB of RAM', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (s && s.streams === s.members * relay.SEAT_STREAMS && s.perMember === relay.SEAT_STREAMS && s.ramMB === 512) ? true : 'got ' + short(s) + ', SEAT_STREAMS ' + relay.SEAT_STREAMS;
}, 1000);
test.run('peers: 512 MB of disk over the measured bytes of a peer', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (s && s.peers === Math.floor(512 * MB / 2048) && s.diskMB === 512) ? true : 'got ' + short(s);
}, 1000);
test.run('it carries when and at which commit capacity was measured', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (s && s.measuredAt === CAP.measuredAt && s.commit === CAP.commit) ? true : 'got ' + short(s);
}, 1000);
test.run('more memory at rest is fewer members', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  less = R.summaryOf(Object.assign({}, CAP, { relayAtRestRss: 400 * MB }));
  return (less && less.members < s.members) ? true : 'at 400 MB ' + short(less && less.members) + ', at 100 MB ' + (s && s.members);
}, 1000);
test.run('no measured peer bytes is 0 peers, not infinity', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (R.summaryOf(Object.assign({}, CAP, { perReachablePeerBytes: 0 })).peers === 0) ? true : 'got ' + short(R.summaryOf(Object.assign({}, CAP, { perReachablePeerBytes: 0 })));
}, 1000);
test.run('no capacity, or no memory at rest measured, is null', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (R.summaryOf(null) === null && R.summaryOf({}) === null && R.summaryOf({ relayAtRestRss: 0 }) === null && R.summaryOf({ relayAtRestRss: 'x' }) === null) ? true : 'got ' + short([R.summaryOf({}), R.summaryOf({ relayAtRestRss: 0 })]);
}, 1000);
test.run('when and commit left out are \'\'', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  noWhen = R.summaryOf({ relayAtRestRss: 10 * MB });
  return (noWhen && noWhen.measuredAt === '' && noWhen.commit === '') ? true : 'got ' + short(noWhen);
}, 1000);

// write: the README, its three headings in order, and summary.json
test.run('its title is the agent\'s name', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  fs.rmSync(TMP, { recursive: true, force: true });
  out = path.join(TMP, 'agents', 'claude-windows');
  fs.mkdirSync(path.join(out, 'studies', 'b-study'), { recursive: true });
  fs.mkdirSync(path.join(out, 'studies', 'a-study'), { recursive: true });
  fs.writeFileSync(path.join(out, 'studies', 'loose.txt'), 'not a study');
  fs.writeFileSync(path.join(out, 'capacity.json'), JSON.stringify(CAP));
  fs.writeFileSync(path.join(out, 'capacity.md'), '# capacity');
  fs.writeFileSync(path.join(out, 'platform.md'), '# platform');
  fs.writeFileSync(path.join(out, 'packets.md'), '# packets');
  fs.writeFileSync(path.join(out, 'packets.json'), JSON.stringify({ measuredAt: '2026-10-25T00:00:00Z', commit: '99998888aaaa' }));
  fs.writeFileSync(path.join(out, 'harness.json'), JSON.stringify({ at: '2026-10-24T00:00:00Z', commit: '1111' }));
  fs.writeFileSync(path.join(out, 'testState.md'), '# t');
  fs.writeFileSync(path.join(out, 'testState.json'), 'not json');
  ret = R.write(out, 'claude-windows', MACHINE);
  md = fs.readFileSync(path.join(out, 'README.md'), 'utf8');
  lines = md.split('\n');
  return (lines[0] === '# claude-windows') ? true : 'first line ' + short(lines[0]);
}, 1000);
test.run('Machine Description, then Summary, then Measurements (then Studies)', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  at = function (h) { return lines.indexOf(h); };
  return (at('## Machine Description') > 0 && at('## Machine Description') < at('## Summary') && at('## Summary') < at('## Measurements') && at('## Measurements') < at('## Studies')) ? true : 'headings at ' + short([at('## Machine Description'), at('## Summary'), at('## Measurements'), at('## Studies')]);
}, 1000);
test.run('the OS, platform and arch', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| OS / platform | Windows_NT 10.0.26200 (win32, x64) |') !== -1) ? true : short(md);
}, 1000);
test.run('total RAM and RAM used, in MB', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| total RAM | 32,768 MB |') !== -1 && md.indexOf('| RAM used when this was written | 1,536 MB |') !== -1) ? true : short(md);
}, 1000);
test.run('the release and identity of node.js', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| node.js | node v24.20.0 (LTS Krypton), `C:\\node\\node.exe` |') !== -1) ? true : short(md);
}, 1000);
test.run('the number of SpiritOS node processes', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| SpiritOS node processes running | 3 |') !== -1) ? true : short(md);
}, 1000);
test.run('when it was written', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| written | 2026-10-27 12:34:56 UTC |') !== -1) ? true : short(md);
}, 1000);
test.run('first bullet: the members a 512 MB allotment serves', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  sum = lines.slice(at('## Summary') + 2, at('## Measurements') - 1);
  n = function (x) { return Number(x).toLocaleString('en-US'); };
  return (sum.length === 3 && sum[0].indexOf('- **' + n(s.members) + ' members** can be served with a 512 MB allotment of RAM') === 0) ? true : 'summary ' + short(sum);
}, 1000);
test.run('second: the streams, 3 per member, naming what each is for', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (/^- That is \*\*[\d,]+ live streams\*\*, 3 per member: its home node's stream, its face's stream, its home node's upload feeding that face\.$/.test(sum[1]) && sum[1].indexOf(n(s.streams)) !== -1) ? true : 'summary ' + short(sum[1]);
}, 1000);
test.run('third: the peers 512 MB of disk remembers', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (sum[2] === '- **' + n(s.peers) + ' peers** can be remembered with 512 MB of disk, each a peer a node can reach.') ? true : 'summary ' + short(sum[2]);
}, 1000);
test.run('the box row is dated by capacity.json, its commit cut to 8', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| [the box](platform.md) | 2026-10-26, `abcdef12` |') !== -1) ? true : short(md);
}, 1000);
test.run('a row whose file is not there says not measured yet, even with its json there', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| [harness](harness.txt) | not measured yet |') !== -1) ? true : short(md);
}, 1000);
test.run('capacity and packets rows dated by their own json', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| [capacity](capacity.md) | 2026-10-26, `abcdef12` |') !== -1 && md.indexOf('| [packets](packets.md) | 2026-10-25, `99998888` |') !== -1) ? true : short(md);
}, 1000);
test.run('a file there with an unreadable json says not measured yet', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('| [test state](testState.md) | not measured yet |') !== -1) ? true : short(md);
}, 1000);
test.run('Studies lists each study folder, sorted; a file there is none', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md.indexOf('- [a-study](studies/a-study/)\n- [b-study](studies/b-study/)') !== -1 && md.indexOf('loose.txt') === -1) ? true : short(md.slice(md.indexOf('## Studies')));
}, 1000);
test.run('summary.json is the summary as data, with the agent', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  sj = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  return (sj.agent === 'claude-windows' && sj.members === s.members && sj.peers === s.peers && sj.streams === s.streams) ? true : 'summary.json ' + short(sj);
}, 1000);
test.run('write answers the summary', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (ret && ret.members === s.members) ? true : 'answered ' + short(ret);
}, 1000);

// write with nothing measured
test.run('the summary says not measured yet, and write answers null', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  bare = path.join(TMP, 'agents', 'nobody');
  fs.mkdirSync(bare, { recursive: true });
  none = R.write(bare, 'nobody', MACHINE);
  md2 = fs.readFileSync(path.join(bare, 'README.md'), 'utf8');
  return (none === null && md2.indexOf('## Summary\n\n- not measured yet\n') !== -1) ? true : 'answered ' + short(none) + ', ' + short(md2);
}, 1000);
test.run('and no summary.json is written', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (!fs.existsSync(path.join(bare, 'summary.json'))) ? true : 'summary.json written';
}, 1000);
test.run('no studies folder: none yet', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md2.indexOf('## Studies\n\nnone yet\n') !== -1) ? true : short(md2.slice(md2.indexOf('## Studies')));
}, 1000);
test.run('every measurement row not measured yet', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (md2.split('\n').filter(function (l) { return /not measured yet \|$/.test(l); }).length === 5) ? true : short(md2);
}, 1000);
test.run('a node.js with no LTS name says none', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  R.write(bare, 'nobody', Object.assign({}, MACHINE, { node: Object.assign({}, MACHINE.node, { lts: '' }) }));
  return (fs.readFileSync(path.join(bare, 'README.md'), 'utf8').indexOf('| node.js | node v24.20.0, `C:\\node\\node.exe` |') !== -1) ? true : 'README ' + short(fs.readFileSync(path.join(bare, 'README.md'), 'utf8'));
}, 1000);
test.run('its platform, arch and OS are this process\'s', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  fs.rmSync(TMP, { recursive: true, force: true });
  // machineOf: this machine now
  m = R.machineOf();
  return (m.platform === process.platform && m.arch === process.arch && m.os === os.type() + ' ' + os.release()) ? true : 'got ' + short(m);
}, 1000);
test.run('total RAM, and RAM used within it', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (m.totalRamBytes === os.totalmem() && m.usedRamBytes > 0 && m.usedRamBytes <= m.totalRamBytes) ? true : 'got ' + short(m);
}, 1000);
test.run('node.js by its version and its path', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (m.node.version === process.version && m.node.path === process.execPath) ? true : 'got ' + short(m.node);
}, 1000);
test.run('a count of SpiritOS node processes', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (Number.isInteger(m.spiritNodes) && m.spiritNodes >= 0) ? true : 'got ' + short(m.spiritNodes);
}, 1000);
test.run('and when it was asked', 0.2, function () {
  if (!R) return 'no agentReadme.js: the world failed';
  return (!isNaN(Date.parse(m.at)) && Math.abs(Date.now() - Date.parse(m.at)) < 60000) ? true : 'at ' + short(m.at);
}, 1000);
