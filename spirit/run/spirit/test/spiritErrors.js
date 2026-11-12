'use strict';

// spirit/run/spirit/test/spiritErrors.js
// The tests of spirit/spiritErrors.js, and of no other module (spec: ./spiritErrors.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 10: spiritErrors
// was red in the garbage rule because it had none).
//
// What an error means, one place for the relay and the node: define, classify, classifyAnswer, byCode, all, UNKNOWN.
// Judged in a child process of its own where it defines, so the node's catalogue in this process is not grown.

const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'spiritErrors.js');
const E = require(FILE);

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── byCode and all: the catalogue ──
test.run('byCode answers the entry of a code it knows: peer-unreachable, 503, absent, the target\'s', 0.2, function () {
  const e = E.byCode('peer-unreachable');
  return (!!e && e.status === 503 && e.presence === false && e.fault === 'target' && e.texts.indexOf('peer not reachable') !== -1) || 'peer-unreachable: ' + short(e);
}, test.limit.quick);
test.run('byCode answers null for a code it does not know', 0.2, function () {
  return E.byCode('zz-no-such-code') === null || 'zz-no-such-code: ' + short(E.byCode('zz-no-such-code'));
}, test.limit.quick);
test.run('all answers every entry, each with its own id, none twice', 0.2, function () {
  const a = E.all();
  const ids = a.map(function (e) { return e.id; });
  const codes = a.map(function (e) { return e.code; });
  return (a.length > 50 && new Set(ids).size === ids.length && new Set(codes).size === codes.length && codes.indexOf('peer-unreachable') !== -1) || a.length + ' entries, ' + new Set(ids).size + ' ids, ' + new Set(codes).size + ' codes';
}, test.limit.quick);
test.run('all answers a copy: a caller emptying it empties nothing of the catalogue', 0.2, function () {
  const n = E.all().length;
  E.all().length = 0;
  return E.all().length === n || 'the catalogue went from ' + n + ' to ' + E.all().length;
}, test.limit.quick);

// ── classify: what arrives, mapped to a meaning ──
test.run('classify takes a code it knows as meant, whatever the sentence says', 0.2, function () {
  const e = E.classify(503, 'target is busy', { code: 'peer-unreachable' });
  return (!!e && e.code === 'peer-unreachable') || 'classified as ' + short(e && e.code);
}, test.limit.quick);
test.run('a code it does not know falls through to the sentence', 0.2, function () {
  const e = E.classify(503, 'peer not reachable', { code: 'zz-newer-relay-code' });
  return (!!e && e.code === 'peer-unreachable') || 'classified as ' + short(e && e.code);
}, test.limit.quick);
test.run('each marker means its condition: busy, tooLittleTime, gaveUp, queueFull, stillOpen', 0.2, function () {
  const got = [{ busy: true }, { tooLittleTime: true }, { gaveUp: true }, { queueFull: true }, { stillOpen: true }].map(function (b) { return (E.classify(503, '', b) || {}).code; });
  const want = ['target-busy', 'no-time-left', 'gave-up', 'node-queue-full', 'no-answer'];
  return JSON.stringify(got) === JSON.stringify(want) || 'markers mean ' + short(got);
}, test.limit.quick);
test.run('an exact sentence means its entry, spaces around it trimmed', 0.2, function () {
  const e = E.classify(503, '  target is busy  ');
  return (!!e && e.code === 'target-busy') || 'classified as ' + short(e && e.code);
}, test.limit.quick);
test.run('a sentence built at runtime is known by its prefix', 0.2, function () {
  const e = E.classify(429, 'too early — wait 12 s');
  return (!!e && e.code === 'address-too-early') || 'classified as ' + short(e && e.code);
}, test.limit.quick);
test.run('an uncatalogued sentence is unknown, says nothing about presence, and keeps its status and text', 0.2, function () {
  const e = E.classify(418, 'a sentence nobody catalogued');
  return (!!e && e.code === 'unknown' && e.presence === null && e.status === 418 && e.text === 'a sentence nobody catalogued') || 'classified as ' + short(e);
}, test.limit.quick);
test.run('UNKNOWN itself claims nothing: presence null, no retry', 0.2, function () {
  return (E.UNKNOWN.code === 'unknown' && E.UNKNOWN.presence === null && E.UNKNOWN.retry === 'no') || 'UNKNOWN: ' + short(E.UNKNOWN);
}, test.limit.quick);

// ── classifyAnswer: a post's answer ──
test.run('classifyAnswer of an answer that is ok is null', 0.2, function () {
  return E.classifyAnswer({ ok: true, status: 200 }) === null || 'classified as ' + short(E.classifyAnswer({ ok: true }));
}, test.limit.quick);
test.run('classifyAnswer of a refusal reads its status, its error and its markers', 0.2, function () {
  const byText = E.classifyAnswer({ ok: false, status: 503, error: 'peer not reachable' });
  const byMark = E.classifyAnswer({ ok: false, status: 503, error: 'whatever', busy: true });
  return ((byText || {}).code === 'peer-unreachable' && (byMark || {}).code === 'target-busy') || 'classified as ' + short([byText && byText.code, byMark && byMark.code]);
}, test.limit.quick);

// ── define: a process declaring its own refusals ──
let defined = null;
test.run('the world: in a process of its own, a refusal defined, then defined again', 0.2, function () {
  const src = [
    'const E = require(' + JSON.stringify(FILE) + ');',
    'const before = E.all().length, top = Math.max.apply(null, E.all().map(function (e) { return e.id; }));',
    "const e = E.define('zz-planted', { status: 409, texts: ['zz planted sentence'] });",
    "let again = ''; try { E.define('zz-planted', { status: 400 }); } catch (x) { again = String(x.message); }",
    "console.log(JSON.stringify({ e: e, top: top, after: E.all().length, before: before, again: again, found: (E.byCode('zz-planted') || {}).status, bySentence: (E.classify(409, 'zz planted sentence') || {}).code }));",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', src], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  try { defined = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { defined = null; }
  return !!defined || 'the child said ' + short(r.stdout) + ' ' + short(r.stderr);
}, test.limit.slow);
test.run('define adds an entry with the next id, its first sentence its text, the rest defaulted', 0.2, function () {
  if (!defined) return 'nothing defined: the world failed';
  const e = defined.e || {};
  return (e.code === 'zz-planted' && e.id === defined.top + 1 && e.status === 409 && e.text === 'zz planted sentence' && e.presence === null && e.retry === 'no' && e.fault === 'caller' && defined.after === defined.before + 1) || 'defined: ' + short(defined);
}, test.limit.quick);
test.run('a defined entry is found by its code and by its sentence', 0.2, function () {
  if (!defined) return 'nothing defined: the world failed';
  return (defined.found === 409 && defined.bySentence === 'zz-planted') || 'found ' + short(defined.found) + ', by sentence ' + short(defined.bySentence);
}, test.limit.quick);
test.run('a code defined twice is refused, the first kept', 0.2, function () {
  if (!defined) return 'nothing defined: the world failed';
  return (/already declared/.test(defined.again) && defined.found === 409) || 'the second define: ' + short(defined.again || 'taken');
}, test.limit.quick);
