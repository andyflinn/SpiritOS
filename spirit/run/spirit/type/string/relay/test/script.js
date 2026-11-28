'use strict';

// spirit/run/spirit/type/string/relay/test/script.js
// The tests of spirit/type/string/relay/script.js, and of no other module (spec: ./script.md). goal/G48.4:
// spirit.type.string.relay, a relay: its ID, or its http or https address (a relay is named by its key or reached by its address). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/relay/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
let fresh = '';
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/relay/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for a key made just now, "https://example.com/a"', 0.4, function () {
  if (!T) return false;
  try { fresh = spirit.requireScript('spirit/relayAuth/script.js').generateIdentity('zz-type-test').publicKey; } catch (e) { return false; }
  try { return [fresh, "https://example.com/a"].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "", "example.com", "goal/G48", 5', 0.4, function () {
  if (!T || !fresh) return false;
  return ["", "example.com", "goal/G48", 5].every(throws) || false;
}, test.limit.quick);
