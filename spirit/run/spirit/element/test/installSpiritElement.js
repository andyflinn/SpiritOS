'use strict';

// spirit/run/spirit/element/test/installSpiritElement.js
// The tests of spirit/element/installSpiritElement.js, and of no other module (spec: ./installSpiritElement.md;
// goal/G43.32). Andy: "this can be done with ONE single helper function spirit/element/installSpiritElement(spirit,
// elementPath) - every element knows it's path, and if the helper is resident in the required they ALL autoinsert
// themselves without name-space-collision", and, since goal/G49.5, a factory stands where its script is loaded (Andy, of his G43.32 Q5: "that ruling is reversed, since
// the element factory is fine where it is loaded"; "spirit.require() places the loaded script at the exact same
// location/path in the spirit object", on both sides): at spirit.required.<path-of-element-script>. Asked of the real spirit object in node, its own spirit.require loading the
// helper; on a page, every element script's factory is asked at its place by the general rules
// (spirit/test/spirit-sibling-node.js and spirit-sibling-browser.js, everyScriptRequired).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const PLACE = 'spirit/element/installSpiritElement.js';
const FILE = path.join(RUN, PLACE);

function at(root, keys) { return keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, root); }

// What the tests make, shared by the tests after them.
let s, install, icon, back, app, outer, inner, outer2, inner2;
test.run('the helper\'s file is there', 0.2, function () {
  // the helper, resident in spirit.required
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('spirit.require answers the helper at once, and it is a function', 0.2, function () {
  s = require(path.join(RUN, 'spirit', 'spirit.js'));
  install = null;
  try { install = s.require(PLACE); } catch (e) { install = e; }
  return (typeof install === 'function') ? true : false;
}, test.limit.quick);
test.run('it is resident at spirit.required.spirit.element.installSpiritElement', 0.2, function () {
  return (typeof install === 'function' && at(s.required, ['spirit', 'element', 'installSpiritElement']) === install) ? true : false;
}, test.limit.quick);
test.run('spirit/element/zzIcon.js\'s factory stands at spirit.required.spirit.element.zzIcon', 0.2, function () {
  // a factory at spirit.required.<its path>
  icon = { create: function () { return { destroy: function () {} }; } };
  back = install(s, 'spirit/element/zzIcon.js', icon);
  return (at(s.required, ['spirit', 'element', 'zzIcon']) === icon) ? true : false;
}, test.limit.quick);
test.run('the helper answers the factory it placed', 0.2, function () {
  return (back === icon) ? true : false;
}, test.limit.quick);
test.run('an app\'s element.js stands at spirit.required.spirit.app.zzApp.element', 0.2, function () {
  app = { create: function () {} };
  install(s, 'spirit/app/zzApp/element.js', app);
  return (at(s.required, ['spirit', 'app', 'zzApp', 'element']) === app) ? true : false;
}, test.limit.quick);
test.run('zzSearch.js and zzSearch/zzFile.js both stand when the one in the folder is placed first', 0.2, function () {
  // no name-space collision
  outer = { create: function () {} };
  inner = { create: function () {} };
  install(s, 'spirit/element/zzSearch/zzFile.js', inner);
  install(s, 'spirit/element/zzSearch.js', outer);
  return (at(s.required, ['spirit', 'element', 'zzSearch']) === outer && at(s.required, ['spirit', 'element', 'zzSearch', 'zzFile']) === inner) ? true : false;
}, test.limit.quick);
test.run('zzList.js and zzList/zzRow.js both stand when the file beside the folder is placed first', 0.2, function () {
  outer2 = { create: function () {} };
  inner2 = { create: function () {} };
  install(s, 'spirit/element/zzList.js', outer2);
  install(s, 'spirit/element/zzList/zzRow.js', inner2);
  return (at(s.required, ['spirit', 'element', 'zzList']) === outer2 && at(s.required, ['spirit', 'element', 'zzList', 'zzRow']) === inner2) ? true : false;
}, test.limit.quick);
test.run('the factory placed before them still stands', 0.2, function () {
  return (at(s.required, ['spirit', 'element', 'zzIcon']) === icon) ? true : false;
}, test.limit.quick);
