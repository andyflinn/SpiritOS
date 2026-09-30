'use strict';

// spirit/test/cleanupDead.js
// cleanup/G1.6: code we know is useless is gone, and removing it opens nothing.

const os = require('os');
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

test.subHeading('the per-app allow list: no file is read, no allows() is handed out');
const nodeApps = code(path.join(RUN, 'js', 'nodeApps.js'));
if (!/allow\.json/.test(nodeApps) && !/allowsIn/.test(nodeApps) && !/\ballows\s*:/.test(nodeApps)) test.check('nodeApps.js reads no allow.json and hands no allows() to an app');
else test.fail(OWED + 'nodeApps.js still has the per-app allow list');
if (!/api\.allows/.test(code(path.join(RUN, 'shell', 'appFaceApp', 'appFaceApp.js')))) test.check('appFaceApp.js asks no allows()');
else test.fail(OWED + 'appFaceApp.js still asks api.allows');

test.subHeading('fixList, whose only job was the peer path, is gone whole (Andy: "get rid of the whole thing")');
if (!fs.existsSync(path.join(RUN, 'shell', 'fixList'))) test.check('shell/fixList is gone');
else test.fail(OWED + 'shell/fixList is still there');
if (!/fixList/i.test(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8'))) test.check('.gitignore names no fixList');
else test.fail(OWED + '.gitignore still names fixList');

// Removed, not opened: with an allow.json that lists the peer, the peer paths
// still do nothing. A copied tree, never a link, so the checkout is not touched.
test.subHeading('appFaceApp\'s grant path is removed, not opened');
const PEER = 'MCowBQYDK2VwAyEApeerpeerpeerpeerpeerpeerpeerpeerpeerpe=';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanupdead-'));
fs.cpSync(path.join(RUN, 'js'), path.join(root, 'js'), { recursive: true });
fs.cpSync(path.join(RUN, 'shell', 'appFaceApp'), path.join(root, 'shell', 'appFaceApp'), { recursive: true });
fs.writeFileSync(path.join(root, 'shell', 'appFaceApp', 'allow.json'), JSON.stringify({ keys: [PEER] }) + '\n');
fs.writeFileSync(path.join(root, 'shell', 'appFaceApp', 'grants.json'), '{}\n');
const snapshot = function (a) {
  const dir = path.join(root, 'shell', a);
  const out = {};
  fs.readdirSync(dir).forEach(function (n) { try { out[n] = fs.readFileSync(path.join(dir, n), 'utf8'); } catch (e) { out[n] = null; } });
  return JSON.stringify(out);
};
const before = snapshot('appFaceApp');
const posts = [];
const witnesses = [];
const packet = require(path.join(root, 'js', 'client', 'packet.js'));
require(path.join(root, 'js', 'nodeApps.js')).mountAll({
  rootDir: root,
  arrivals: { witness: function (fn) { witnesses.push(fn); return function () {}; } },
  post: function (a, b, c) { posts.push([a, b, c]); return Promise.resolve({ ok: true }); },
  log: function () {},
});
function send(app, body) {
  const m = ({ fromKey: PEER, hash: 'H-' + Math.random().toString(16).slice(2), sentAt: new Date().toISOString(), text: packet.encode(app, body).text });
  witnesses.forEach(function (fn) { fn(m); });
}
send('appFaceApp', { verb: 'grant', name: 'peername', app: 'natter' });
setTimeout(function () {
  if (witnesses.length) test.check('appFaceApp booted and took arrivals');
  else test.fail(OWED + 'no app subscribed to arrivals; the checks below would pass vacuously');
  if (snapshot('appFaceApp') === before && !posts.length) test.check('appFaceApp: a listed peer asking for a name gets no grant and no answer');
  else test.fail(OWED + 'appFaceApp still grants to a peer: grants.json ' + fs.readFileSync(path.join(root, 'shell', 'appFaceApp', 'grants.json'), 'utf8').slice(0, 80) + ', ' + posts.length + ' posts');
  fs.rmSync(root, { recursive: true, force: true });
  test.reportSuccessFailureCount();
  process.exit(0);
}, 300);
