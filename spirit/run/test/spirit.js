'use strict';

// spirit/run/test/spirit.js
// THE TESTS OF spirit/run/spirit.js, and of no other module (goal/G40.6), against ./spirit.md. Reported in the format
// of the current test system (Andy: "same format as the current test system for now..."). Run in node; the page half
// is not exercised here.

const path = require('path');
const test = require(path.join(__dirname, '..', '..', 'test', 'testSupport.js'));

const RUN = path.join(__dirname, '..');

test.startTest('spirit/run/spirit.js: the one spirit object, in node');

(async function () {
  delete process.env.SPIRIT_CALLBACK_URL;
  const s = require(path.join(RUN, 'spirit.js'));

  test.subHeading('1. it is the global spirit');
  if (s && typeof s === 'object' && globalThis.spirit === s) test.check('requiring spirit.js answers the global spirit, the same object');
  else test.fail('requiring spirit.js answered ' + typeof s + ', and the global spirit is ' + (globalThis.spirit === s ? 'it' : 'another'));

  test.subHeading('2. what a script took from kernel.js, under the kernel\'s names');
  const kernelNames = ['jobs', 'node', 'util', 'fs', 'const'].filter(function (k) { return !(s.core && s.core[k]); });
  if (!kernelNames.length && typeof s.peerPost === 'function') test.check('spirit.core.jobs, node, util, fs and const, and spirit.peerPost');
  else test.fail('missing: ' + kernelNames.map(function (k) { return 'spirit.core.' + k; }).concat(typeof s.peerPost === 'function' ? [] : ['spirit.peerPost']).join(', '));
  const mime = s.core && s.core.const && s.core.const.MIME_TYPES;
  if (mime && /javascript/.test(mime['.js']) && /json/.test(mime['.json'])) test.check('spirit.core.const.MIME_TYPES, its own table');
  else test.fail('spirit.core.const.MIME_TYPES: ' + JSON.stringify(mime));

  test.subHeading('3. its helpers');
  if (s.formatBytes(1024) === '1 KB' && s.escapeHtml('<a href="x">') === '&lt;a href=&quot;x&quot;&gt;') test.check('formatBytes and escapeHtml answer as the kernel\'s do');
  else test.fail('formatBytes(1024) ' + s.formatBytes(1024) + ', escapeHtml ' + s.escapeHtml('<a href="x">'));

  test.subHeading('4. spirit.require: a component by its run-root path');
  let comp = null;
  try { comp = await s.require('spirit/limits.js'); } catch (e) { comp = e; }
  if (comp === require(path.join(RUN, 'spirit', 'limits.js'))) test.check('spirit.require(\'spirit/limits.js\') answers that module\'s exports');
  else test.fail('spirit.require(\'spirit/limits.js\') answered ' + String(comp && (comp.code || comp.message) || typeof comp));

  test.subHeading('5. spirit.require: an interface, from this process\'s own node only');
  for (const p of ['spirit/fs/api.js', 'process/js/desk/desk.family/api.js']) {
    let why = null;
    try { await s.require(p); why = 'bound'; } catch (e) { why = e && e.code; }
    if (why === 'no-node') test.check(p + ' is an interface, refused no-node while SPIRIT_CALLBACK_URL names no node');
    else test.fail(p + ' with no node of its own answered ' + why);
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
