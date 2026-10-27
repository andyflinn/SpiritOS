'use strict';

// spirit/run/process/js/deskClient/test/agentReadme.js
// The tests of process/js/deskClient/agentReadme.js, and of no other module (spec: ./agentReadme.md; goal/G41.11). The
// module is required as publishData requires it; write() runs on a scratch agents/<agent>/ folder of the test's own,
// with a machine handed in, so what it writes is known. The relay's own rule (spirit/relay.js allowanceFor) is the real
// one, as the module's members figure is.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'agentReadme.js');
const TMP = path.join(RUN, 'test', '_tmp_agentReadme');
const relay = require(path.join(RUN, 'spirit', 'relay.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const MB = 1048576;

const MACHINE = { platform: 'win32', os: 'Windows_NT 10.0.26200', arch: 'x64', totalRamBytes: 32768 * MB, usedRamBytes: 1536 * MB,
  node: { release: 'node', version: 'v24.20.0', lts: 'Krypton', path: 'C:\\node\\node.exe' }, spiritNodes: 3, at: '2026-10-27T12:34:56.789Z' };
const CAP = { relayAtRestRss: 100 * MB, perReachablePeerBytes: 2048, measuredAt: '2026-10-26T08:00:00Z', commit: 'abcdef1234567' };

test.startTest('agentReadme.js: an agent\'s README in the measurement tree');

(function () {
  let R = null;
  try { R = require(FILE); } catch (e) { test.fail('agentReadme.js threw as it loaded: ' + e.message); }
  ok(R && typeof R.write === 'function' && typeof R.summaryOf === 'function' && typeof R.machineOf === 'function', 'it exports write, summaryOf and machineOf', 'exports ' + short(R && Object.keys(R)));
  if (!R) return;

  test.subHeading('summaryOf: the relay\'s own rule at 512 MB');
  const s = R.summaryOf(CAP);
  const allowance = relay.allowanceFor(512, 100);
  ok(s && s.members === Math.floor(allowance / relay.SEAT_STREAMS) && s.members > 0, 'members: relay.allowanceFor(512, rest at MB) in seats of SEAT_STREAMS (' + (s && s.members) + ')', 'got ' + short(s));
  ok(s && s.streams === s.members * relay.SEAT_STREAMS && s.perMember === relay.SEAT_STREAMS && s.ramMB === 512, 'streams are members times ' + relay.SEAT_STREAMS + ', the RAM 512 MB', 'got ' + short(s));
  ok(s && s.peers === Math.floor(512 * MB / 2048) && s.diskMB === 512, 'peers: 512 MB of disk over the measured bytes of a peer', 'got ' + short(s));
  ok(s && s.measuredAt === CAP.measuredAt && s.commit === CAP.commit, 'it carries when and at which commit capacity was measured', 'got ' + short(s));
  const less = R.summaryOf(Object.assign({}, CAP, { relayAtRestRss: 400 * MB }));
  ok(less && less.members < s.members, 'more memory at rest is fewer members', 'at 400 MB ' + short(less && less.members) + ', at 100 MB ' + (s && s.members));
  ok(R.summaryOf(Object.assign({}, CAP, { perReachablePeerBytes: 0 })).peers === 0, 'no measured peer bytes is 0 peers, not infinity', 'got ' + short(R.summaryOf(Object.assign({}, CAP, { perReachablePeerBytes: 0 }))));
  ok(R.summaryOf(null) === null && R.summaryOf({}) === null && R.summaryOf({ relayAtRestRss: 0 }) === null && R.summaryOf({ relayAtRestRss: 'x' }) === null, 'no capacity, or no memory at rest measured, is null', 'got ' + short([R.summaryOf({}), R.summaryOf({ relayAtRestRss: 0 })]));
  const noWhen = R.summaryOf({ relayAtRestRss: 10 * MB });
  ok(noWhen && noWhen.measuredAt === '' && noWhen.commit === '', 'when and commit left out are \'\'', 'got ' + short(noWhen));

  test.subHeading('write: the README, its three headings in order, and summary.json');
  fs.rmSync(TMP, { recursive: true, force: true });
  const out = path.join(TMP, 'agents', 'claude-windows');
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
  const ret = R.write(out, 'claude-windows', MACHINE);
  const md = fs.readFileSync(path.join(out, 'README.md'), 'utf8');
  const lines = md.split('\n');
  ok(lines[0] === '# claude-windows', 'its title is the agent\'s name', 'first line ' + short(lines[0]));
  const at = function (h) { return lines.indexOf(h); };
  ok(at('## Machine Description') > 0 && at('## Machine Description') < at('## Summary') && at('## Summary') < at('## Measurements') && at('## Measurements') < at('## Studies'),
    'Machine Description, then Summary, then Measurements (then Studies)', 'headings at ' + short([at('## Machine Description'), at('## Summary'), at('## Measurements'), at('## Studies')]));
  ok(md.indexOf('| OS / platform | Windows_NT 10.0.26200 (win32, x64) |') !== -1, 'the OS, platform and arch', short(md));
  ok(md.indexOf('| total RAM | 32,768 MB |') !== -1 && md.indexOf('| RAM used when this was written | 1,536 MB |') !== -1, 'total RAM and RAM used, in MB', short(md));
  ok(md.indexOf('| node.js | node v24.20.0 (LTS Krypton), `C:\\node\\node.exe` |') !== -1, 'the release and identity of node.js', short(md));
  ok(md.indexOf('| SpiritOS node processes running | 3 |') !== -1, 'the number of SpiritOS node processes', short(md));
  ok(md.indexOf('| written | 2026-10-27 12:34:56 UTC |') !== -1, 'when it was written', short(md));
  const sum = lines.slice(at('## Summary') + 2, at('## Measurements') - 1);
  const n = function (x) { return Number(x).toLocaleString('en-US'); };
  ok(sum.length === 3 && sum[0].indexOf('- **' + n(s.members) + ' members** can be served with a 512 MB allotment of RAM') === 0, 'first bullet: the members a 512 MB allotment serves', 'summary ' + short(sum));
  ok(/^- That is \*\*[\d,]+ live streams\*\*, 3 per member: its home node's stream, its face's stream, its home node's upload feeding that face\.$/.test(sum[1]) && sum[1].indexOf(n(s.streams)) !== -1, 'second: the streams, 3 per member, naming what each is for', 'summary ' + short(sum[1]));
  ok(sum[2] === '- **' + n(s.peers) + ' peers** can be remembered with 512 MB of disk, each a peer a node can reach.', 'third: the peers 512 MB of disk remembers', 'summary ' + short(sum[2]));
  ok(md.indexOf('| [the box](platform.md) | 2026-10-26, `abcdef12` |') !== -1, 'the box row is dated by capacity.json, its commit cut to 8', short(md));
  ok(md.indexOf('| [harness](harness.txt) | not measured yet |') !== -1, 'a row whose file is not there says not measured yet, even with its json there', short(md));
  ok(md.indexOf('| [capacity](capacity.md) | 2026-10-26, `abcdef12` |') !== -1 && md.indexOf('| [packets](packets.md) | 2026-10-25, `99998888` |') !== -1, 'capacity and packets rows dated by their own json', short(md));
  ok(md.indexOf('| [test state](testState.md) | not measured yet |') !== -1, 'a file there with an unreadable json says not measured yet', short(md));
  ok(md.indexOf('- [a-study](studies/a-study/)\n- [b-study](studies/b-study/)') !== -1 && md.indexOf('loose.txt') === -1, 'Studies lists each study folder, sorted; a file there is none', short(md.slice(md.indexOf('## Studies'))));
  const sj = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  ok(sj.agent === 'claude-windows' && sj.members === s.members && sj.peers === s.peers && sj.streams === s.streams, 'summary.json is the summary as data, with the agent', 'summary.json ' + short(sj));
  ok(ret && ret.members === s.members, 'write answers the summary', 'answered ' + short(ret));

  test.subHeading('write with nothing measured');
  const bare = path.join(TMP, 'agents', 'nobody');
  fs.mkdirSync(bare, { recursive: true });
  const none = R.write(bare, 'nobody', MACHINE);
  const md2 = fs.readFileSync(path.join(bare, 'README.md'), 'utf8');
  ok(none === null && md2.indexOf('## Summary\n\n- not measured yet\n') !== -1, 'the summary says not measured yet, and write answers null', 'answered ' + short(none) + ', ' + short(md2));
  ok(!fs.existsSync(path.join(bare, 'summary.json')), 'and no summary.json is written', 'summary.json written');
  ok(md2.indexOf('## Studies\n\nnone yet\n') !== -1, 'no studies folder: none yet', short(md2.slice(md2.indexOf('## Studies'))));
  ok(md2.split('\n').filter(function (l) { return /not measured yet \|$/.test(l); }).length === 5, 'every measurement row not measured yet', short(md2));
  R.write(bare, 'nobody', Object.assign({}, MACHINE, { node: Object.assign({}, MACHINE.node, { lts: '' }) }));
  ok(fs.readFileSync(path.join(bare, 'README.md'), 'utf8').indexOf('| node.js | node v24.20.0, `C:\\node\\node.exe` |') !== -1, 'a node.js with no LTS name says none', 'README ' + short(fs.readFileSync(path.join(bare, 'README.md'), 'utf8')));
  fs.rmSync(TMP, { recursive: true, force: true });

  test.subHeading('machineOf: this machine now');
  const m = R.machineOf();
  ok(m.platform === process.platform && m.arch === process.arch && m.os === os.type() + ' ' + os.release(), 'its platform, arch and OS are this process\'s', 'got ' + short(m));
  ok(m.totalRamBytes === os.totalmem() && m.usedRamBytes > 0 && m.usedRamBytes <= m.totalRamBytes, 'total RAM, and RAM used within it', 'got ' + short(m));
  ok(m.node.version === process.version && m.node.path === process.execPath, 'node.js by its version and its path', 'got ' + short(m.node));
  ok(Number.isInteger(m.spiritNodes) && m.spiritNodes >= 0, 'a count of SpiritOS node processes (' + m.spiritNodes + ' now)', 'got ' + short(m.spiritNodes));
  ok(!isNaN(Date.parse(m.at)) && Math.abs(Date.now() - Date.parse(m.at)) < 60000, 'and when it was asked', 'at ' + short(m.at));
}());

test.reportSuccessFailureCount();
