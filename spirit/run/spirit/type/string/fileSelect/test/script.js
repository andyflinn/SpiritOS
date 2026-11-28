'use strict';

// spirit/run/spirit/type/string/fileSelect/test/script.js
// The tests of spirit/type/string/fileSelect/script.js, and of no other module (spec: ./script.md). goal/G48.4, Andy:
// "<type>Select.js requires <type>.js, when validating <type>Select.js FIRST checks for \"\", and returns true if the value
// is \"\", it otherwise it lets <type>.js handle the check". spirit.type.string.fileSelect: the file a search narrows to: empty for all, else a file as spirit.type.string.file is.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/fileSelect/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/fileSelect/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "spirit/app/desk/item.get.json"', 0.4, function () {
  if (!T) return false;
  try { return ["","spirit/app/desk/item.get.json"].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "/abs", "../up", a backslash path, 5, {}', 0.4, function () {
  if (!T) return false;
  return ['/abs', '../up', 'a' + String.fromCharCode(92) + 'b', 5, {}].every(throws) || false;
}, test.limit.quick);
test.run('its description says empty for all, then the description of its sibling', 0.2, function () {
  if (!T) return false;
  const sib = LOADER.requireScript('spirit/type/string/file/script.js');
  return T.ruleDescription() === 'empty for all, else ' + sib.ruleDescription() || false;
}, test.limit.quick);
