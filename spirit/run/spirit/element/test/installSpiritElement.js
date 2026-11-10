'use strict';

// spirit/run/spirit/element/test/installSpiritElement.js
// The tests of spirit/element/installSpiritElement.js, and of no other module (spec: ./installSpiritElement.md;
// goal/G43.32). Andy: "this can be done with ONE single helper function spirit/element/installSpiritElement(spirit,
// elementPath) - every element knows it's path, and if the helper is resident in the required they ALL autoinsert
// themselves without name-space-collision", and "element scripts themselves are who installs the element factory at
// spirit.element.<path-of-element-script>". Asked of the real spirit object in node, its own spirit.require loading the
// helper; on a page, every element script's factory is asked at its place by the general rules
// (spirit/test/spirit-sibling-generalRules.js, everyScriptRequired).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const PLACE = 'spirit/element/installSpiritElement.js';
const FILE = path.join(RUN, PLACE);

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function at(root, keys) { return keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, root); }

test.startTest('installSpiritElement.js: an element\'s factory placed at spirit.element.<its path> (goal/G43.32)');

(async function () {
  test.subHeading('the helper, resident in spirit.required');
  ok(fs.existsSync(FILE), PLACE + ' is there', PLACE + ' is not there');
  if (!fs.existsSync(FILE)) return;
  const s = require(path.join(RUN, 'spirit', 'spirit.js'));
  let install = null;
  try { install = s.require(PLACE); } catch (e) { install = e; }
  ok(typeof install === 'function', 'spirit.require(' + PLACE + ') answers the helper at once, a function', 'spirit.require answered ' + short(install && install.message || typeof install));
  ok(typeof install === 'function' && at(s.required, ['spirit', 'element', 'installSpiritElement']) === install, 'it is resident at spirit.required.spirit.element.installSpiritElement', 'spirit.required.spirit.element.installSpiritElement is ' + short(typeof at(s.required, ['spirit', 'element', 'installSpiritElement'])));
  if (typeof install !== 'function') return;

  test.subHeading('a factory at spirit.element.<its path>');
  const icon = { create: function () { return { destroy: function () {} }; } };
  const back = install(s, 'spirit/element/zzIcon.js', icon);
  ok(at(s.element, ['spirit', 'element', 'zzIcon']) === icon, 'spirit/element/zzIcon.js\'s factory stands at spirit.element.spirit.element.zzIcon', 'spirit.element.spirit.element.zzIcon is ' + short(at(s.element, ['spirit', 'element', 'zzIcon'])));
  ok(back === icon, 'and the helper answers the factory it placed', 'the helper answered ' + short(back));
  const app = { create: function () {} };
  install(s, 'spirit/app/zzApp/element.js', app);
  ok(at(s.element, ['spirit', 'app', 'zzApp', 'element']) === app, 'an app\'s element.js stands at spirit.element.spirit.app.zzApp.element', 'spirit.element.spirit.app.zzApp.element is ' + short(at(s.element, ['spirit', 'app', 'zzApp', 'element'])));

  test.subHeading('no name-space collision');
  const outer = { create: function () {} };
  const inner = { create: function () {} };
  install(s, 'spirit/element/zzSearch/zzFile.js', inner);
  install(s, 'spirit/element/zzSearch.js', outer);
  ok(at(s.element, ['spirit', 'element', 'zzSearch']) === outer && at(s.element, ['spirit', 'element', 'zzSearch', 'zzFile']) === inner,
    'zzSearch.js and zzSearch/zzFile.js both stand, the folder\'s placed first', 'one lost the other: ' + short([typeof at(s.element, ['spirit', 'element', 'zzSearch', 'create']), typeof at(s.element, ['spirit', 'element', 'zzSearch', 'zzFile'])]));
  const outer2 = { create: function () {} };
  const inner2 = { create: function () {} };
  install(s, 'spirit/element/zzList.js', outer2);
  install(s, 'spirit/element/zzList/zzRow.js', inner2);
  ok(at(s.element, ['spirit', 'element', 'zzList']) === outer2 && at(s.element, ['spirit', 'element', 'zzList', 'zzRow']) === inner2,
    'zzList.js and zzList/zzRow.js both stand, the file\'s placed first', 'one lost the other: ' + short([typeof at(s.element, ['spirit', 'element', 'zzList', 'create']), typeof at(s.element, ['spirit', 'element', 'zzList', 'zzRow'])]));
  ok(at(s.element, ['spirit', 'element', 'zzIcon']) === icon, 'and what stood before still stands', 'an earlier factory was lost');

}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
