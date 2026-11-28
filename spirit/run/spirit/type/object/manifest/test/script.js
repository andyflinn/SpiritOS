'use strict';

// spirit/run/spirit/type/object/manifest/test/script.js
// The tests of spirit/type/object/manifest/script.js, and of no other module (goal/G49.20, box v31: "A new type manifest
// type checks the actual manifest files in app for validity", "new spirit/type/object/manifest/script.js"; "it is valid when
// at least one of the following is true shell:mount:true|false, node:mount:true|false or node:run:true|false, where
// node:mount:true and node:run:true are mutually exclusive"). A type script.js is an object of static functions (goal/G48.4):
// defaultValue() passes its own check, isValid(v) answers true or throws.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const SUBJECT = 'spirit/type/object/manifest/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };
const valid = function (v) { try { return T.isValid(v) === true; } catch (e) { return false; } };

test.run('spirit/type/object/manifest/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object' && typeof T.isValid === 'function' && typeof T.defaultValue === 'function') || false;
}, test.limit.quick);
test.run('its defaultValue passes its own isValid', 0.2, function () {
  if (!T) return false;
  return valid(T.defaultValue()) || false;
}, test.limit.quick);
// "at least one of the following is true": each of the three alone, true, is a valid manifest.
test.run('a manifest with shell mount true is valid', 0.2, function () {
  return (!!T && valid({ shell: { mount: true } })) || false;
}, test.limit.quick);
test.run('a manifest with node mount true is valid', 0.2, function () {
  return (!!T && valid({ node: { mount: true } })) || false;
}, test.limit.quick);
test.run('a manifest with node run true is valid', 0.2, function () {
  return (!!T && valid({ node: { run: true } })) || false;
}, test.limit.quick);
test.run('a manifest with shell mount true and node mount true is valid', 0.2, function () {
  return (!!T && valid({ shell: { mount: true }, node: { mount: true } })) || false;
}, test.limit.quick);
test.run('a manifest where none of shell mount, node mount and node run is true is refused', 0.4, function () {
  if (!T) return false;
  return [{ shell: { mount: false }, node: { mount: false, run: false } }, { shell: {}, node: {} }, {}].every(throws) || false;
}, test.limit.quick);
// "node:mount:true and node:run:true are mutually exclusive"
test.run('a manifest with node mount true and node run true is refused', 0.4, function () {
  return (!!T && throws({ node: { mount: true, run: true } })) || false;
}, test.limit.quick);
test.run('what is no object is refused: null, a list, a string, a number', 0.4, function () {
  if (!T) return false;
  return [null, [], 'manifest', 5].every(throws) || false;
}, test.limit.quick);
