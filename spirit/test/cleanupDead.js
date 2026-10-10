'use strict';

// spirit/test/cleanupDead.js
// cleanup/G1.6: code we know is useless is gone, and removing it opens nothing.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');
const OWED = 'OWED by cleanup/G1.6: ';

function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

test.startTest('cleanup/G1.6: the known-dead code is gone');

test.subHeading('js/client/browser.js, loaded by no page');
if (!fs.existsSync(path.join(RUN, 'js', 'client', 'browser.js'))) test.check('js/client/browser.js is gone');
else test.fail(OWED + 'js/client/browser.js is still there');

test.subHeading('the contacts book under its old name, who.json (D2)');
const contacts = code(path.join(RUN, 'js', 'contacts.js'));
if (!/who\.json/.test(contacts) && !/migrateOldName/.test(contacts)) test.check('contacts.js neither reads nor renames who.json');
else test.fail(OWED + 'contacts.js still handles who.json');
const d2 = (fs.readFileSync(path.join(REPO, 'design', 'DEPRECATIONS.md'), 'utf8').split('\n').filter(function (l) { return /^\| D2 \|/.test(l); })[0]) || '';
if (/\| eliminated \|/.test(d2)) test.check('design/DEPRECATIONS.md marks D2 eliminated');
else test.fail(OWED + 'D2 is not marked eliminated: ' + d2.slice(0, 80));

// The per-app allow list once lived in nodeApps.js and shell/appFaceApp; both are gone whole
// with goal/G13.2 (the loader of apps into the node, and the shell copy of the face), so what
// is held is that neither came back anywhere.
test.subHeading('the per-app allow list: no file is read, no allows() is handed out');
const jsFiles = fs.readdirSync(path.join(RUN, 'js')).filter(function (f) { return /\.js$/.test(f); });
const allowing = jsFiles.filter(function (f) { const c = code(path.join(RUN, 'js', f)); return /allow\.json/.test(c) || /allowsIn/.test(c) || /\ballows\s*:/.test(c); });
if (!allowing.length) test.check('no file in js/ reads allow.json or hands out allows()');
else test.fail(OWED + 'the per-app allow list is back in ' + allowing.join(', '));
if (!fs.existsSync(path.join(RUN, 'js', 'nodeApps.js')) && !fs.existsSync(path.join(RUN, 'shell', 'appFaceApp'))) test.check('nodeApps.js and shell/appFaceApp, where it lived, are gone (goal/G13.2)');
else test.fail(OWED + 'nodeApps.js or shell/appFaceApp is still there');

test.subHeading('fixList, whose only job was the peer path, is gone whole (Andy: "get rid of the whole thing")');
if (!fs.existsSync(path.join(RUN, 'shell', 'fixList'))) test.check('shell/fixList is gone');
else test.fail(OWED + 'shell/fixList is still there');
if (!/fixList/i.test(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8'))) test.check('.gitignore names no fixList');
else test.fail(OWED + '.gitignore still names fixList');

// Removed, not opened: the face answers a name only from grantFace's word (route), never from
// a list of keys beside it. The grant verb of the old shell app is gone with it.
test.subHeading('appFaceApp\'s grant path is removed, not opened');
const face = (function () { try { return code(path.join(RUN, 'process', 'js', 'appFaceApp', 'appFaceApp.js')); } catch (e) { return ''; } })();
if (face && !/grants\.json|allow\.json|'grant'|"grant"/.test(face) && /grantFace/.test(face)) test.check('the face reads no grants.json and no allow.json, and grants nothing: it asks grantFace');
else test.fail(OWED + 'the face still carries a grant path of its own');

test.reportSuccessFailureCount();
