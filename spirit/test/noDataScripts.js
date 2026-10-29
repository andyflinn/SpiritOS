'use strict';

// spirit/test/noDataScripts.js
// goal/G41.16: NO DATA SCRIPT. Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do
// this shit?", and "do all but desk, THAT app is deprecated and just needs to live a little longer.....". The proper way
// (G30.18, shell/js/rowElement.js): a data type's code is its row element, which takes its rows from the stream through
// its kind's index. A drift guard, as spiritErrors.js is: it reads the tree, so a data script added later goes red too.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
// The one left, by Andy's word: the desk's translator, while the desk lives.
const KEPT = ['shell/shared/js/deskData.js'];

function walk(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    if (d.name === 'node_modules' || d.name === 'relay-state' || d.name === 'brains' || d.name.charAt(0) === '.') return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out); else if (/\.js$/.test(d.name)) out.push(path.relative(RUN, p).split(path.sep).join('/'));
  });
  return out;
}
const isTest = function (rel) { return /(^|\/)test\//.test(rel); };

test.startTest('goal/G41.16: no data script; a data type\'s meaning lives in its row element');

const files = walk(RUN, []);
const scripts = files.filter(function (rel) { return !isTest(rel) && /(^|\/)data\.js$/.test(rel); });
test.subHeading('no file named data.js, but the desk\'s');
if (!scripts.length) test.check('no data.js under spirit/run, the tests aside');
else test.fail('data scripts left: ' + scripts.join(', '));
['shell/js/contacts/data.js', 'shell/js/files/data.js', 'process/js/agent/table/data.js'].forEach(function (rel) {
  if (!fs.existsSync(path.join(RUN, rel))) test.check(rel + ' is gone');
  else test.fail(rel + ' is still there');
});

test.subHeading('no stream translation outside a row element, but the desk\'s');
// A translator registers with the data set, spirit.data's translate({ onJob, onRename }), and writes what the stream means
// into it (set, merge, del, seat). Only a row element (rowElement.js in its kind's folder, or an agent table's
// elementRow.js) may, besides the data set itself and the one kept. A page that only hears the stream to read again (the
// grants panel re-reading the api tree when a server starts or ends) writes nothing, and is no translator.
const mayTranslate = function (rel) {
  return /(^|\/)rowElement\.js$/.test(rel) || /(^|\/)elementRow\.js$/.test(rel) || rel === 'shell/js/spiritData.js' || KEPT.indexOf(rel) !== -1;
};
const translators = files.filter(function (rel) {
  if (isTest(rel) || mayTranslate(rel)) return false;
  const src = fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\/\/.*$/gm, '');
  return /\.translate\(\s*\{/.test(src) && /\b(D|data|dataSet|spirit\.data)\.(set|merge|del|seat)\(/.test(src);
});
if (!translators.length) test.check('only row elements write the stream into the data set (and the data set itself, and the desk\'s, kept)');
else test.fail('stream translations outside a row element: ' + translators.join(', '));

test.subHeading('nothing loads a data script');
const loaders = files.filter(function (rel) {
  if (isTest(rel) || KEPT.indexOf(rel) !== -1) return false;
  const src = fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\/\/.*$/gm, '');
  return /['"`][^'"`]*\/data\.js['"`]/.test(src.replace(/deskData\.js/g, ''));
});
if (!loaders.length) test.check('no file requires or loads a data.js');
else test.fail('files that still load a data script: ' + loaders.join(', '));

test.reportSuccessFailureCount();
