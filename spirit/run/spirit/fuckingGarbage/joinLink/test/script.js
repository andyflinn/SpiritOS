'use strict';

// spirit/run/spirit/fuckingGarbage/joinLink/test/script.js
// The tests of spirit/fuckingGarbage/joinLink/script.js, and of no other module. The caller's join link, moved off the
// hand-made spirit.shell (goal/G49.23, box v21: "joinLink to spirit/fuckingGarbage/joinLink/script.js, the join form
// requiring it by that path").

const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const SUBJECT = 'spirit/fuckingGarbage/joinLink/script.js';
const H = LOADER.requireScript('spirit/test/headLessChrome.js');

let out = null;
try {
  const w = { location: { origin: 'https://relay.example', pathname: '/face', search: '' } };
  w.window = w;
  w.spirit = { required: {}, requireScript: function () { return new Promise(function () {}); } };
  vm.createContext(w);
  out = H.runAsPage(SUBJECT, w);
} catch (e) { out = null; }

test.run('it puts out an object holding joinLink, a function (a function stands inside an object)', 0.2, function () {
  return (!!out && typeof out === 'object' && typeof out.joinLink === 'function') || false;
}, test.limit.quick);
test.run('joinLink answers this page opening Join: its origin and path, then ?app=join', 0.2, function () {
  if (!out || typeof out.joinLink !== 'function') return false;
  return out.joinLink() === 'https://relay.example/face?app=join' || false;
}, test.limit.quick);
test.run('it puts nothing on spirit.shell', 0.2, function () {
  return !/spirit\.shell\b/.test(require('fs').readFileSync(path.join(RUN, SUBJECT), 'utf8')) || false;
}, test.limit.quick);
