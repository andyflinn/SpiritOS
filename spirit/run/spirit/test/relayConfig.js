'use strict';

// spirit/run/spirit/test/relayConfig.js
// The tests of spirit/relayConfig.js, and of no other module (spec: ./relayConfig.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The relay's configuration, bounded by the box: pure, text and a measured box in, { ok, config } or { ok: false, error }
// out. The box is planted as relayLimits.measure() answers it.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const C = require(path.join(RUN, 'spirit', 'relayConfig.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A box with 1 GB total, 600 MB available (ceiling 575), a disc of 20000 MB with 10000 free (ceiling 8976).
const BOX = { totalMB: 1024, availableMB: 600, hostAvailableMB: 600, discTotalMB: 20000, discFreeMB: 10000 };

// ── no file: the measured default, never an implicit figure ──
test.run('with no file, the figures are the measured defaults, said as source default', 0.2, function () {
  const r = C.parse(null, BOX);
  return (r.ok && r.config.ramLimitMB === 256 && r.config.discLimitMB === 256 && r.config.source === 'default') || short(r);
}, test.limit.quick);
test.run('a file\'s figures are taken, said as source file', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 128, "discLimitMB": 64 }', BOX);
  return (r.ok && r.config.ramLimitMB === 128 && r.config.discLimitMB === 64 && r.config.source === 'file') || short(r);
}, test.limit.quick);
test.run('a key the file omits takes the measured default rather than failing (a config.json from before disc was bounded)', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 100 }', BOX);
  return (r.ok && r.config.ramLimitMB === 100 && r.config.discLimitMB === 256) || short(r);
}, test.limit.quick);
test.run('a bare number is taken as the box\'s total and available memory (cycle 1\'s callers)', 0.2, function () {
  const r = [C.parse('{ "discLimitMB": 64 }', 400), C.parse('{ "ramLimitMB": 376, "discLimitMB": 64 }', 400)];
  return (r[0].ok && r[0].config.ramLimitMB === 200 && r[1].ok === false) || short(r);
}, test.limit.quick);

// ── refused, with a sentence an owner can act on ──
test.run('bad JSON, an array, or a non-object is refused, naming spirit/state/config.json', 0.2, function () {
  const got = [C.parse('{nope', BOX), C.parse('[1]', BOX), C.parse('7', BOX)];
  return got.every(function (r) { return r.ok === false && /spirit\/state\/config\.json/.test(r.error); }) || short(got);
}, test.limit.quick);
test.run('a figure that is not a positive number of megabytes is refused, by its name', 0.2, function () {
  const got = [C.parse('{ "ramLimitMB": 0 }', BOX), C.parse('{ "ramLimitMB": "256" }', BOX), C.parse('{ "discLimitMB": -1 }', BOX)];
  return (got[0].ok === false && /ramLimitMB must be a positive/.test(got[0].error) && got[1].ok === false && /ramLimitMB/.test(got[1].error) &&
    got[2].ok === false && /discLimitMB must be a positive/.test(got[2].error)) || short(got);
}, test.limit.quick);
test.run('a ceiling the box cannot supply is refused, not honoured (a level may narrow, never widen)', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 576, "discLimitMB": 64 }', BOX);
  const ok = C.parse('{ "ramLimitMB": 575, "discLimitMB": 64 }', BOX);
  return (r.ok === false && /ramLimitMB 576 is more than this box can give \(575 MB available, after the 25 MB safety margin\)/.test(r.error) && ok.ok === true) || short([r, ok]);
}, test.limit.quick);
test.run('a disc figure above what the disc can give is refused', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 100, "discLimitMB": 8977 }', BOX);
  return (r.ok === false && /discLimitMB 8977 is more than this disc can give/.test(r.error)) || short(r);
}, test.limit.quick);

// ── at boot an overflow clamps and keeps the relay up ──
test.run('at boot, a figure that no longer fits clamps to the ceiling and says what was asked (Andy: the relay comes up, says so)', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 4000, "discLimitMB": 90000 }', BOX, { atBoot: true });
  return (r.ok && r.config.ramLimitMB === 575 && r.config.discLimitMB === 8976 && r.config.overflow &&
    r.config.overflow.ramAsked === 4000 && r.config.overflow.discAsked === 90000) || short(r);
}, test.limit.quick);
test.run('at boot, a figure that fits carries no overflow', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 100, "discLimitMB": 64 }', BOX, { atBoot: true });
  return (r.ok && r.config.overflow === undefined && r.config.ramLimitMB === 100) || short(r);
}, test.limit.quick);

// ── a running relay's change is judged by its difference (goal/G40.4) ──
test.run('a running relay\'s raise is held against what the host has free, by its difference (Andy: "It needs to asses the difference")', 0.2, function () {
  // Running at 256, the host has 300 free: room 275. To 512 is 256 more and fits; judged whole against the ceiling (275)
  // it would be refused, since what the relay holds is already gone from what the box has free.
  const busy = Object.assign({}, BOX, { availableMB: 300, hostAvailableMB: 300 });
  const fits = C.parse('{ "ramLimitMB": 512, "discLimitMB": 64 }', busy, { runningRamMB: 256 });
  const bare = C.parse('{ "ramLimitMB": 512, "discLimitMB": 64 }', busy);
  return (fits.ok === true && fits.config.ramLimitMB === 512 && bare.ok === false) || short({ fits: fits, bare: bare });
}, test.limit.quick);
test.run('a raise by more than the host has free, after the margin, is refused naming the difference', 0.2, function () {
  const busy = Object.assign({}, BOX, { availableMB: 300, hostAvailableMB: 300 });
  const r = C.parse('{ "ramLimitMB": 600, "discLimitMB": 64 }', busy, { runningRamMB: 256 });
  return (r.ok === false && /from 256 to 600 needs 344 MB more, and this box has 275 MB free/.test(r.error)) || short(r);
}, test.limit.quick);
test.run('the raise is judged against the host\'s free memory, not the cgroup-cut availableMB', 0.2, function () {
  const capped = Object.assign({}, BOX, { availableMB: 30, hostAvailableMB: 1000 });
  const r = C.parse('{ "ramLimitMB": 512, "discLimitMB": 64 }', capped, { runningRamMB: 256 });
  return r.ok === true || short(r);
}, test.limit.quick);
test.run('a lowering always passes on a running relay', 0.2, function () {
  const full = Object.assign({}, BOX, { availableMB: 1, hostAvailableMB: 1 });
  const r = C.parse('{ "ramLimitMB": 64, "discLimitMB": 64 }', full, { runningRamMB: 256 });
  return (r.ok === true && r.config.ramLimitMB === 64) || short(r);
}, test.limit.quick);

// ── the return is a whitelist ──
test.run('a key the file holds beyond the two figures does not pass through (maxPerTarget is a limit, the code\'s)', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 100, "discLimitMB": 64, "maxPerTarget": 9 }', BOX);
  return (r.ok && short(Object.keys(r.config).sort()) === short(['discLimitMB', 'ramLimitMB', 'source'])) || short(r);
}, test.limit.quick);

// ── asked, fileText ──
test.run('asked: what the file says, not what the box allowed: a boot clamp is never written back', 0.2, function () {
  const r = C.parse('{ "ramLimitMB": 4000, "discLimitMB": 64 }', BOX, { atBoot: true });
  const a = C.asked(r.config);
  const plain = C.asked({ ramLimitMB: 100, discLimitMB: 64 });
  return (a.ramLimitMB === 4000 && a.discLimitMB === 64 && plain.ramLimitMB === 100 && plain.discLimitMB === 64) || short({ a: a, plain: plain });
}, test.limit.quick);
test.run('fileText: the two figures, two-space JSON, a trailing newline, and nothing else', 0.2, function () {
  const t = C.fileText({ ramLimitMB: 128, discLimitMB: 64, source: 'file', overflow: { ramAsked: 1 } });
  return t === '{\n  "ramLimitMB": 128,\n  "discLimitMB": 64\n}\n' || short(t);
}, test.limit.quick);
test.run('fileText reads back through parse as the same figures', 0.2, function () {
  const r = C.parse(C.fileText({ ramLimitMB: 128, discLimitMB: 64 }), BOX);
  return (r.ok && r.config.ramLimitMB === 128 && r.config.discLimitMB === 64) || short(r);
}, test.limit.quick);
