'use strict';

// spirit/run/shell/js/contacts/test/data.js
// The tests of shell/js/contacts/data.js, and of no other module: what it makes of the stream for data.contacts
// (spec: ./data.md). The browser file runs in node on a window of its own, over the faceless layer it registers with.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '../../../..'), 'test', 'testReport.js'));

const JS = path.join(__dirname, '..', '..');
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
global.window = { spirit: {} };
load(path.join(JS, 'spiritData.js'));
load(path.join(JS, 'contacts', 'data.js'));
const D = window.spirit.data;
const row = function (k) { return D.get('contacts/' + k); };

test.startTest('contacts/data.js: the stream into data.contacts');

test.subHeading('relay-presence sets present, by key');
D.take({ type: 'relay-presence', data: { presence: { KA: { present: true }, KB: { present: false } } } });
if (row('KA') && row('KA').present === true && row('KB') && row('KB').present === false) test.check('a present key reads present, an absent one absent');
else test.fail('presence: ' + JSON.stringify({ a: row('KA'), b: row('KB') }));
let writes = 0;
const stop = D.watch('contacts/KA', function () { writes += 1; });
D.take({ type: 'relay-presence', data: { presence: { KA: { present: true }, KB: { present: false } } } });
if (writes === 0) test.check('the same table again writes nothing');
else test.fail('an unchanged presence wrote ' + writes + ' times');
stop();
D.take({ type: 'relay-presence', data: { presence: { KB: { present: false } } } });
if (row('KA') && row('KA').present === undefined && row('KB').present === false) test.check('a key the table drops goes back to not known; the others stand');
else test.fail('a dropped key: ' + JSON.stringify(row('KA')));
D.take({ type: 'relay-presence', data: { presence: { KC: 'not a proof', KD: null } } });
if (row('KC') === undefined && row('KD') === undefined) test.check('an entry that is no proof writes nothing');
else test.fail('a bad entry wrote: ' + JSON.stringify({ c: row('KC'), d: row('KD') }));

test.subHeading('peer-search seats the row the network found');
D.take({ type: 'peer-search', data: { q: 'be', item: { key: 'KE', label: JSON.stringify({ name: 'bert', held: true }) } } });
if (row('KE') && row('KE').name === 'bert' && row('KE').held === true) test.check('the item\'s label is merged into its row, by key');
else test.fail('the network row: ' + JSON.stringify(row('KE')));
const seated = JSON.stringify(D.branch('contacts'));
D.take({ type: 'peer-search', data: { q: 'be' } });
if (JSON.stringify(D.branch('contacts')) === seated) test.check('a peer-search update with no item seats nothing');
else test.fail('rows after an empty update: ' + Object.keys(D.branch('contacts')).join(','));
D.take({ type: 'peer-search', data: { item: { key: 'KF', label: 'not json' } } });
if (row('KF') === undefined) test.check('a label that is not JSON seats nothing');
else test.fail('a bad label seated ' + JSON.stringify(row('KF')));

test.subHeading('a rename sets the name, and keeps the rest');
D.rename({ key: 'KE', caption: 'Bertie' });
if (row('KE').name === 'Bertie' && row('KE').held === true) test.check('contact.rename sets name on the row, its other fields kept');
else test.fail('after a rename: ' + JSON.stringify(row('KE')));
D.rename({ key: 'KG', caption: 7 });
if (row('KG') && row('KG').name === '7') test.check('a rename of a key never seen makes its row, the caption as text');
else test.fail('a rename of a new key: ' + JSON.stringify(row('KG')));

test.subHeading('other jobs are not contacts\' business');
const before = JSON.stringify(D.branch('contacts'));
D.take({ type: 'fs-watcher', data: { presence: { KZ: { present: true } }, item: { key: 'KZ', label: '{"name":"z"}' } } });
if (JSON.stringify(D.branch('contacts')) === before) test.check('a job of another type changes no contact');
else test.fail('another job changed contacts');

test.reportSuccessFailureCount();
