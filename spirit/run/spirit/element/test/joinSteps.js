'use strict';

// spirit/run/spirit/element/test/joinSteps.js
// The tests of spirit/element/joinSteps.js, and of no other module (spec: ./joinSteps.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// The Join app's steps, decided in one place (goal/G30.1). Pure: the browser file runs in node on a window of its own, and
// the steps are the Join app's own manifest, spirit/app/join/join.json, with the face steps its code still knows.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'joinSteps.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

let J = null;
const NO_J = 'joinSteps placed nothing: the world failed';
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'join', 'join.json'), 'utf8')).steps;
const FACE = [{ until: 'face', name: 'Your face' }, { until: 'opened', name: 'Open it' }];
const STEPS = MANIFEST.concat(FACE);
const facts = function (o) { return Object.assign({ seated: false, relayUrl: '', contact: false, face: '', faceUrl: '', opened: false }, o || {}); };
const nameOf = function (s) { return s ? s.name : null; };

test.run('the world: it runs on a window of its own and places itself at spirit.required.spirit.element.joinSteps', 0.2, function () {
  const win = { Array: Array, JSON: JSON, String: String };
  win.window = win;
  win.spirit = { required: {} };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  J = ((win.spirit.required.spirit || {}).element || {}).joinSteps;
  return (!!J && ['fromJob', 'done', 'current', 'linkRelay'].every(function (k) { return typeof J[k] === 'function'; })) || 'placed: ' + short(J && Object.keys(J));
}, test.limit.quick);

// fromJob
test.run('fromJob answers the job\'s facts, with whether the face link was opened', 0.2, function () {
  if (!J) return NO_J;
  const f = J.fromJob({ seated: 1, relayUrl: 'https://r.example', contact: 'yes', face: 'f1', faceUrl: 'https://r.example/f1', extra: 'no' }, true);
  return JSON.stringify(f) === JSON.stringify({ seated: true, relayUrl: 'https://r.example', contact: true, face: 'f1', faceUrl: 'https://r.example/f1', opened: true }) || 'facts: ' + short(f);
}, test.limit.quick);
test.run('fromJob of no job answers every fact false or empty', 0.2, function () {
  if (!J) return NO_J;
  const f = J.fromJob(null);
  return JSON.stringify(f) === JSON.stringify(facts()) || 'facts: ' + short(f);
}, test.limit.quick);

// done: "The node keeps no email since goal/G40.11 (box v24), so a seat is what step 1 ends on."
test.run('step 1 (until email) is done by a seat, the node keeping no email', 0.2, function () {
  if (!J) return NO_J;
  const one = MANIFEST[0];
  return (one.until === 'email' && J.done(one, facts({ seated: true })) === true && J.done(one, facts()) === false) || 'step 1 done: ' + short([J.done(one, facts({ seated: true })), J.done(one, facts())]);
}, test.limit.quick);
test.run('each step is done by its own fact: contact, face, opened', 0.2, function () {
  if (!J) return NO_J;
  const bad = [['contact', { contact: true }], ['face', { face: 'f' }], ['opened', { opened: true }]].filter(function (p) {
    const s = { until: p[0] };
    return J.done(s, facts(p[1])) !== true || J.done(s, facts()) !== false;
  });
  return !bad.length || 'not done by its fact: ' + short(bad);
}, test.limit.quick);
test.run('a step with an end it does not know is never done', 0.2, function () {
  if (!J) return NO_J;
  return J.done({ until: 'nothing' }, facts({ seated: true, contact: true, face: 'f', opened: true })) === false || 'done';
}, test.limit.quick);

// current: "Find someone is optional (box: "it never blocks the steps after it")"
test.run('current answers the first step not done', 0.2, function () {
  if (!J) return NO_J;
  return nameOf(J.current(STEPS, facts())) === 'Join' || 'current: ' + short(J.current(STEPS, facts()));
}, test.limit.quick);
test.run('Find someone is optional: never the open step, and it never blocks the steps after it', 0.2, function () {
  if (!J) return NO_J;
  const now = J.current(STEPS, facts({ seated: true }));
  return (MANIFEST[1].optional === true && nameOf(now) === 'Your face') || 'current once seated: ' + short(now);
}, test.limit.quick);
test.run('current answers null once every step that counts is done, Find someone left undone', 0.2, function () {
  if (!J) return NO_J;
  const now = J.current(STEPS, facts({ seated: true, face: 'f', opened: true }));
  return now === null || 'current: ' + short(now);
}, test.limit.quick);
test.run('current of no list answers null', 0.2, function () {
  if (!J) return NO_J;
  return J.current(null, facts()) === null || 'current: ' + short(J.current(null, facts()));
}, test.limit.quick);

// linkRelay: goal/G40.11, a relay a row keyed by its ID, its url on its label; goal/G40.10, never the first one listed
const ITEMS = [
  { key: 'first', label: JSON.stringify({ relay: true, url: 'https://first.example' }) },
  { key: 'named', label: JSON.stringify({ relay: true, url: 'https://named.example' }) },
  { key: 'person', label: JSON.stringify({ relay: false, url: 'https://person.example' }) },
  { key: 'broken', label: '{not json' },
];
test.run('linkRelay answers the url of the relay the link names by its key', 0.2, function () {
  if (!J) return NO_J;
  return J.linkRelay('named', ITEMS) === 'https://named.example' || 'answered ' + short(J.linkRelay('named', ITEMS));
}, test.limit.quick);
test.run('linkRelay answers \'\' for a key no relay is listed under, never the first one listed', 0.2, function () {
  if (!J) return NO_J;
  const got = [J.linkRelay('nobody', ITEMS), J.linkRelay('', ITEMS), J.linkRelay('named', null)];
  return JSON.stringify(got) === JSON.stringify(['', '', '']) || 'answered ' + short(got);
}, test.limit.quick);
test.run('linkRelay answers \'\' for a row that is no relay, or whose label is not JSON', 0.2, function () {
  if (!J) return NO_J;
  const got = [J.linkRelay('person', ITEMS), J.linkRelay('broken', ITEMS)];
  return JSON.stringify(got) === JSON.stringify(['', '']) || 'answered ' + short(got);
}, test.limit.quick);
