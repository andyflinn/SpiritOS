'use strict';

// spirit/run/spirit/app/publishData/test/measure.js
// The tests of spirit/app/publishData/measure.js, and of no other module (spec: ./measure.md; goal/G47.1, box v170). rssOf is
// asked of this process and of one that has ended; measure() runs once, whole, on lab nodes and a lab relay, as publishData
// runs it, and its answer is judged.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'measure.js');
const LAB_NODES = path.resolve(RUN, '..', '..', 'lab', 'node');

const M = { mod: null, got: null, said: [], threw: false };

test.run('it exports measure and rssOf', 0.2, function () {
  try { M.mod = require(FILE); } catch (e) { return false; }
  return (typeof M.mod.measure === 'function' && typeof M.mod.rssOf === 'function') || false;
}, test.limit.quick);

// rssOf: the operating system's figure for a process.
test.run('rssOf answers this running process\'s memory, near what node.js says of it', 0.2, function () {
  if (!M.mod) return false;
  const got = M.mod.rssOf(process.pid);
  const own = process.memoryUsage().rss;
  return (got > 0 && Math.abs(got - own) / own < 0.25) || false;
}, test.limit.quick);
test.run('rssOf answers 0 for a process that has ended', 0.2, function () {
  if (!M.mod) return false;
  const ended = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  const pid = Number(String(ended.stdout).trim());
  return (pid > 0 && M.mod.rssOf(pid) === 0) || false;
}, test.limit.quick);

// measure(): once, whole.
test.run('measure answers, run on lab nodes and a lab relay', 0.2, async function () {
  if (!M.mod) return false;
  try { M.got = await M.mod.measure(function () { M.said.push(true); }); } catch (e) { M.threw = true; }
  return (!!M.got && !M.threw) || false;
}, test.limit.long);
test.run('a node at rest is measured as a figure in MB, above 0 and below this machine\'s RAM', 0.2, function () {
  if (!M.got) return false;
  const mb = M.got.nodeAtRestMB;
  return (Number.isInteger(mb) && mb > 0 && mb < require('os').totalmem() / 1048576) || false;
}, test.limit.quick);
test.run('the relay at rest is measured as a figure in bytes, above 0', 0.2, function () {
  if (!M.got) return false;
  return Number(M.got.relayAtRestRss) > 1048576 || false;
}, test.limit.quick);
test.run('a call on its own machine has a median above 0, at most its worst', 0.2, function () {
  if (!M.got) return false;
  const l = M.got.loop || {};
  return (l.median > 0 && l.median <= l.max) || false;
}, test.limit.quick);
test.run('a card request through the relay has a median above 0, at most its worst', 0.2, function () {
  if (!M.got) return false;
  const r = M.got.relayed || {};
  return (r.median > 0 && r.median <= r.max) || false;
}, test.limit.quick);
test.run('sealing and signing take a share above 0, below the request it is a share of', 0.2, function () {
  if (!M.got) return false;
  const r = M.got.relayed || {};
  return (r.crypto > 0 && r.crypto < r.median) || false;
}, test.limit.quick);
test.run('its answer holds no raw numbers: no list of the iterations', 0.2, function () {
  if (!M.got) return false;
  const lists = function (v) { return Array.isArray(v) || (!!v && typeof v === 'object' && Object.keys(v).some(function (k) { return lists(v[k]); })); };
  return !lists(M.got) || false;
}, test.limit.quick);
test.run('the say it was handed heard its steps', 0.2, function () {
  if (!M.got) return false;
  return M.said.length >= 2 || false;
}, test.limit.quick);
test.run('every lab node and relay it took is free again', 0.2, function () {
  if (!M.got) return false;
  let held = [];
  try {
    held = fs.readdirSync(LAB_NODES).filter(function (f) { return /\.lock$/.test(f) && f !== '.lab.lock'; })
      .filter(function (f) { try { return fs.readFileSync(path.join(LAB_NODES, f), 'utf8').trim() === String(process.pid); } catch (e) { return false; } });
  } catch (e) { held = []; }
  return !held.length || false;
}, test.limit.quick);
