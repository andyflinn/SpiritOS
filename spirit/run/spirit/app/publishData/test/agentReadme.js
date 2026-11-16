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

const MB = 1048576;

const CAP = { relayAtRestRss: 100 * MB, perReachablePeerBytes: 2048, measuredAt: '2026-10-26T08:00:00Z', commit: 'abcdef1234567' };

// What the tests below make, each in order, read by the tests after it.
test.after(function () { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
let R, s, allowance, less, noWhen, m;
test.run('it exports write, summaryOf and machineOf', 0.2, function () {
  R = null;
  try { R = require(FILE); } catch (e) { return false; }
  return (R && typeof R.write === 'function' && typeof R.summaryOf === 'function' && typeof R.machineOf === 'function') ? true : false;
}, test.limit.quick);

// summaryOf: the relay's own rule at 512 MB
test.run('the members are the seats the relay allows in 512 MB of RAM', 0.2, function () {
  if (!R) return false;
  s = R.summaryOf(CAP);
  allowance = relay.allowanceFor(512, 100);
  return (s && s.members === Math.floor(allowance / relay.SEAT_STREAMS) && s.members > 0) ? true : false;
}, test.limit.quick);
test.run('the streams are the members times the streams of a seat, in 512 MB of RAM', 0.2, function () {
  if (!R) return false;
  return (s && s.streams === s.members * relay.SEAT_STREAMS && s.perMember === relay.SEAT_STREAMS && s.ramMB === 512) ? true : false;
}, test.limit.quick);
test.run('the peers are 512 MB of disk over the measured bytes of a peer', 0.2, function () {
  if (!R) return false;
  return (s && s.peers === Math.floor(512 * MB / 2048) && s.diskMB === 512) ? true : false;
}, test.limit.quick);
test.run('it carries when and at which commit capacity was measured', 0.2, function () {
  if (!R) return false;
  return (s && s.measuredAt === CAP.measuredAt && s.commit === CAP.commit) ? true : false;
}, test.limit.quick);
test.run('more memory at rest is fewer members', 0.2, function () {
  if (!R) return false;
  less = R.summaryOf(Object.assign({}, CAP, { relayAtRestRss: 400 * MB }));
  return (less && less.members < s.members) ? true : false;
}, test.limit.quick);
test.run('no measured peer bytes is 0 peers, not infinity', 0.2, function () {
  if (!R) return false;
  return (R.summaryOf(Object.assign({}, CAP, { perReachablePeerBytes: 0 })).peers === 0) ? true : false;
}, test.limit.quick);
test.run('no capacity, or no memory at rest measured, is null', 0.2, function () {
  if (!R) return false;
  return (R.summaryOf(null) === null && R.summaryOf({}) === null && R.summaryOf({ relayAtRestRss: 0 }) === null && R.summaryOf({ relayAtRestRss: 'x' }) === null) ? true : false;
}, test.limit.quick);
test.run('when and commit, left out, are empty strings', 0.2, function () {
  if (!R) return false;
  noWhen = R.summaryOf({ relayAtRestRss: 10 * MB });
  return (noWhen && noWhen.measuredAt === '' && noWhen.commit === '') ? true : false;
}, test.limit.quick);

// write's README is judged where publishData writes it, in ./publishData.js (goal/G47.1, box v170: the platform's README,
// its title, the machine, Summary and Details in that order); its old layout (the agent's name, Machine Description,
// Measurements, Studies) went with that box.
test.run('the machine\'s platform, arch and OS are this process\'s', 0.2, function () {
  if (!R) return false;
  fs.rmSync(TMP, { recursive: true, force: true });
  // machineOf: this machine now
  m = R.machineOf();
  return (m.platform === process.platform && m.arch === process.arch && m.os === os.type() + ' ' + os.release()) ? true : false;
}, test.limit.quick);
test.run('the machine carries its total RAM, and the RAM used within it', 0.2, function () {
  if (!R) return false;
  return (m.totalRamBytes === os.totalmem() && m.usedRamBytes > 0 && m.usedRamBytes <= m.totalRamBytes) ? true : false;
}, test.limit.quick);
test.run('the machine names node.js by its version and its path', 0.2, function () {
  if (!R) return false;
  return (m.node.version === process.version && m.node.path === process.execPath) ? true : false;
}, test.limit.quick);
test.run('the machine carries a count of SpiritOS node processes', 0.2, function () {
  if (!R) return false;
  return (Number.isInteger(m.spiritNodes) && m.spiritNodes >= 0) ? true : false;
}, test.limit.quick);
test.run('the machine carries when it was asked', 0.2, function () {
  if (!R) return false;
  return (!isNaN(Date.parse(m.at)) && Math.abs(Date.now() - Date.parse(m.at)) < 60000) ? true : false;
}, test.limit.quick);
