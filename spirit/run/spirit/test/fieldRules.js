'use strict';

// spirit/run/spirit/test/fieldRules.js
// The tests of spirit/fieldRules.js, and of no other module (spec: ./fieldRules.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// What a text field may be, one definition for both sides of the wire (goal/G4.16): label, spoken word, lever name,
// description, paragraph, email, glyph, chat line, clip. Pure, so every check runs in process.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const F = require(path.join(RUN, 'spirit', 'fieldRules.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── the limits, in bytes (Andy: "64 bytes max for labels.", "description 128 bytes is alright.") ──
test.run('the limits are in bytes as decided: label 64, description 128, paragraph 2048, email 254, glyph 8, chat line 1024', 0.2, function () {
  const got = [F.MAX_BYTES, F.DESCRIPTION_MAX_BYTES, F.PARAGRAPH_MAX_BYTES, F.EMAIL_MAX_BYTES, F.GLYPH_MAX_BYTES, F.LINE_MAX_BYTES];
  return short(got) === short([64, 128, 2048, 254, 8, 1024]) || false;
}, test.limit.quick);
test.run('byteLength counts UTF-8 bytes, never characters', 0.2, function () {
  const got = [F.byteLength('a'), F.byteLength('é'), F.byteLength('€'), F.byteLength('😀')];
  return short(got) === short([1, 2, 3, 4]) || false;
}, test.limit.quick);

// ── normalize, problem: the public label ──
test.run('normalize applies NFC, collapses and trims whitespace, and makes a non-string empty', 0.2, function () {
  const got = [F.normalize('é'), F.normalize('  andy \t\n flinn  '), F.normalize(42)];
  return short(got) === short(['é', 'andy flinn', '']) || false;
}, test.limit.quick);
test.run('problem finds a person\'s name with spaces and punctuation fine, and no name "name required"', 0.2, function () {
  const got = [F.problem("Andy O'Flinn-Smith, Jr."), F.problem('   '), F.problem(null)];
  return short(got) === short(['', 'name required', 'name required']) || false;
}, test.limit.quick);
test.run('problem refuses the invisible: a control, a zero-width space, a bidi override, a soft hyphen', 0.2, function () {
  const got = ['a\u0001b', 'a​b', 'a‮b', 'a­b'].map(F.problem);
  return got.every(function (p) { return p === 'name has invisible or control characters'; }) || false;
}, test.limit.quick);
test.run('problem passes 64 bytes and refuses 65 as "name too long" without cutting, counting after normalizing', 0.2, function () {
  const got = [F.problem('x'.repeat(64)), F.problem('x'.repeat(65)), F.problem('é'.repeat(32)), F.problem('é'.repeat(33)), F.problem('  ' + 'x'.repeat(64) + '  ')];
  return short(got) === short(['', 'name too long', '', 'name too long', '']) || false;
}, test.limit.quick);

// ── spokenOk, leverOk ──
test.run('spokenOk accepts 1 to 32 letters, digits, dots, underscores and hyphens, and nothing else', 0.2, function () {
  const ok = ['dog', 'a.b_c-D9', 'x'.repeat(32)].map(F.spokenOk);
  const no = ['', 'x'.repeat(33), 'a b', 'a/b', 'é', null].map(F.spokenOk);
  return (ok.every(Boolean) && !no.some(Boolean)) || false;
}, test.limit.quick);
test.run('leverOk accepts a meaning of letters then an iteration with no leading zero (Andy: "better no leading zeros")', 0.2, function () {
  const ok = ['connections1', 'requestTimeout12', 'ipvFour1', 'ipv41'].map(F.leverOk);
  const no = ['connections', 'connections0', 'connections01', 'conn_1', '1conn', 'conn1a', 'x'.repeat(32) + '1'].map(F.leverOk);
  return (ok.every(Boolean) && !no.some(Boolean)) || false;
}, test.limit.quick);

// ── describeProblem, describeRemaining ──
// goal/G47.4, box v52: "that field rule will demand that desctiptions are NOT empty" (Andy: "since the rule-change for
// DESCRIPTION_MAX_BYTES won't wreck anything ... GO!"; a node describes itself at its first boot, server.js).
test.run('describeProblem refuses empty, blank and missing, passes 128 bytes, and calls 129 "description too long"', 0.2, function () {
  const empty = [F.describeProblem(''), F.describeProblem('   '), F.describeProblem(undefined)];
  const got = [F.describeProblem('y'.repeat(128)), F.describeProblem('y'.repeat(129))];
  return (empty.every(function (p) { return typeof p === 'string' && p.length > 0; }) && short(got) === short(['', 'description too long'])) || false;
}, test.limit.quick);
test.run('describeProblem refuses the invisible too', 0.2, function () {
  const p = F.describeProblem('hello ‮ world');
  return p === 'description has invisible or control characters' || false;
}, test.limit.quick);
test.run('describeRemaining counts down in bytes: an emoji costs four', 0.2, function () {
  const got = [F.describeRemaining(''), F.describeRemaining('abc'), F.describeRemaining('😀'), F.describeRemaining('y'.repeat(130))];
  return short(got) === short([128, 125, 124, -2]) || false;
}, test.limit.quick);

// ── the paragraph (goal/G5.5) ──
test.run('normalizeParagraph keeps line breaks, tabs and spaces as typed; CRLF becomes LF', 0.2, function () {
  const got = F.normalizeParagraph('a  b\r\n\tc\n\nd');
  return got === 'a  b\n\tc\n\nd' || false;
}, test.limit.quick);
test.run('paragraphProblem requires text, accepts newlines and tabs, refuses other controls, passes 2048 bytes and refuses 2049', 0.2, function () {
  const got = [F.paragraphProblem(' \n '), F.paragraphProblem('line\n\tline'), F.paragraphProblem('a\u0007b'), F.paragraphProblem('z'.repeat(2048)), F.paragraphProblem('z'.repeat(2049))];
  return short(got) === short(['text required', '', 'text has invisible or control characters', '', 'text too long']) || false;
}, test.limit.quick);

// ── emailProblem (goal/G40.10) ──
test.run('emailProblem passes an address and tells of each malformed one what is wrong', 0.2, function () {
  const got = ['andy@example.org', '', 'a b@c', 'abc', 'a@b@c', '@b', 'a@'].map(F.emailProblem);
  const want = ['', 'an email address is needed', 'an email address has no spaces', 'an email address has an @', 'an email address has one @, not 2', 'nothing before the @', 'nothing after the @'];
  return short(got) === short(want) || false;
}, test.limit.quick);
test.run('emailProblem allows an address of at most 254 bytes', 0.2, function () {
  const at254 = 'a'.repeat(250) + '@b.c';
  const got = [F.emailProblem(at254), F.emailProblem('a' + at254)];
  return short(got) === short(['', 'an email address is at most 254 bytes']) || false;
}, test.limit.quick);

// ── glyph (goal/G41.27: "max 1 char/glyph, 8-bytes maximum.") ──
test.run('glyphCount counts what the reader sees: a flag or a branch emoji is one', 0.2, function () {
  const got = [F.glyphCount(''), F.glyphCount('a'), F.glyphCount('ab'), F.glyphCount('\u{1F1E9}\u{1F1EA}'), F.glyphCount('é')];
  return short(got) === short([0, 1, 2, 1, 1]) || false;
}, test.limit.quick);
test.run('glyphProblem accepts one glyph of at most 8 bytes and refuses none, two, or one too heavy', 0.2, function () {
  const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
  const got = [F.glyphProblem('★'), F.glyphProblem('\u{1F1E9}\u{1F1EA}'), F.glyphProblem(''), F.glyphProblem('ab'), F.glyphProblem(family)];
  return short(got) === short(['', '', 'a glyph is needed', 'one glyph only', 'a glyph is at most 8 bytes']) || false;
}, test.limit.quick);

// ── clip (goal/G40.10: a field stops at its limit) ──
test.run('clip cuts at maxBytes, never through a character; under the limit it is untouched', 0.2, function () {
  const got = [F.clip('abcdef', 3), F.clip('ab€', 4), F.clip('ab€', 5), F.clip('😀😀', 5), F.clip(7, 3)];
  return short(got) === short(['abc', 'ab', 'ab€', '😀', '']) || false;
}, test.limit.quick);
