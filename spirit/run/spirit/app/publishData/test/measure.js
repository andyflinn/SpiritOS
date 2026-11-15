'use strict';

// spirit/run/spirit/app/publishData/test/measure.js
// The tests of spirit/app/publishData/measure.js, and of no other module (spec: ./measure.md; goal/G47.1, box v170). rssOf is
// asked of this process and of one that has ended; measure() runs once, whole, on lab nodes and a lab relay, as publishData
// runs it, and its answer is judged.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'measure.js');
const LAB_NODES = path.resolve(RUN, '..', '..', 'lab', 'node');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const M = { mod: null, got: null, said: [], threw: '' };

test.run('it exports measure and rssOf', 0.2, function () {
  try { M.mod = require(FILE); } catch (e) { return 'measure.js threw as it loaded: ' + e.message; }
  return (typeof M.mod.measure === 'function' && typeof M.mod.rssOf === 'function') || 'exports ' + short(Object.keys(M.mod));
}, test.limit.quick);

// rssOf: the operating system's figure for a process.
test.run('rssOf: this running process\'s memory, near what node.js says of it', 0.2, function () {
  if (!M.mod) return 'no measure.js: the world failed';
  const got = M.mod.rssOf(process.pid);
  const own = process.memoryUsage().rss;
  return (got > 0 && Math.abs(got - own) / own < 0.25) || 'rssOf ' + got + ', node.js says ' + own;
}, test.limit.quick);
test.run('rssOf: 0 for a process that has ended', 0.2, function () {
  if (!M.mod) return 'no measure.js: the world failed';
  const ended = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  const pid = Number(String(ended.stdout).trim());
  return (pid > 0 && M.mod.rssOf(pid) === 0) || 'rssOf of ended ' + pid + ': ' + M.mod.rssOf(pid);
}, test.limit.quick);

// measure(): once, whole.
test.run('measure: it answers, on lab nodes and a lab relay', 0.2, async function () {
  if (!M.mod) return 'no measure.js: the world failed';
  try { M.got = await M.mod.measure(function (t) { M.said.push(t); }); } catch (e) { M.threw = String(e && e.message || e); }
  return (!!M.got && !M.threw) || 'it threw: ' + M.threw;
}, test.limit.long);
test.run('a node at rest: a figure in MB, above 0 and below this machine\'s RAM', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  const mb = M.got.nodeAtRestMB;
  return (Number.isInteger(mb) && mb > 0 && mb < require('os').totalmem() / 1048576) || 'nodeAtRestMB ' + short(mb);
}, test.limit.quick);
test.run('the relay at rest: a figure in bytes, above 0', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  return Number(M.got.relayAtRestRss) > 1048576 || 'relayAtRestRss ' + short(M.got.relayAtRestRss);
}, test.limit.quick);
test.run('a call on its own machine: a median above 0, at most its worst', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  const l = M.got.loop || {};
  return (l.median > 0 && l.median <= l.max) || 'loop ' + short(l);
}, test.limit.quick);
test.run('a card request through the relay: a median above 0, at most its worst', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  const r = M.got.relayed || {};
  return (r.median > 0 && r.median <= r.max) || 'relayed ' + short(r);
}, test.limit.quick);
test.run('sealing and signing: a share above 0, below the request it is a share of', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  const r = M.got.relayed || {};
  return (r.crypto > 0 && r.crypto < r.median) || 'crypto ' + short(r.crypto) + ' of ' + short(r.median);
}, test.limit.quick);
test.run('no raw numbers: no list of the iterations in its answer', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  const lists = function (v) { return Array.isArray(v) || (!!v && typeof v === 'object' && Object.keys(v).some(function (k) { return lists(v[k]); })); };
  return !lists(M.got) || 'it answered a list: ' + short(M.got);
}, test.limit.quick);
test.run('say heard its steps', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  return M.said.length >= 2 || 'it said ' + short(M.said);
}, test.limit.quick);
test.run('every lab node and relay it took is free again', 0.2, function () {
  if (!M.got) return 'no answer: the test before failed';
  let held = [];
  try {
    held = fs.readdirSync(LAB_NODES).filter(function (f) { return /\.lock$/.test(f) && f !== '.lab.lock'; })
      .filter(function (f) { try { return fs.readFileSync(path.join(LAB_NODES, f), 'utf8').trim() === String(process.pid); } catch (e) { return false; } });
  } catch (e) { held = []; }
  return !held.length || 'still held by this process: ' + short(held);
}, test.limit.quick);
