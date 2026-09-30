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
['appFaceApp', 'fixList'].forEach(function (a) {
  const src = code(path.join(RUN, 'shell', a, a + '.js'));
  if (!/api\.allows/.test(src)) test.check(a + '.js asks no allows()');
  else test.fail(OWED + a + '.js still asks api.allows');
});

// Removed, not opened: with an allow.json that lists the peer, the peer paths
// still do nothing. A copied tree, never a link, so the checkout is not touched.
test.subHeading('the two peer paths are removed, not opened');
const PEER = 'MCowBQYDK2VwAyEApeerpeerpeerpeerpeerpeerpeerpeerpeerpe=';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanupdead-'));
fs.cpSync(path.join(RUN, 'js'), path.join(root, 'js'), { recursive: true });
['appFaceApp', 'fixList'].forEach(function (a) {
  const dir = path.join(root, 'shell', a);
  fs.cpSync(path.join(RUN, 'shell', a), dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: [PEER] }) + '\n');
});
fs.writeFileSync(path.join(root, 'shell', 'appFaceApp', 'grants.json'), '{}\n');
const snapshot = function (a) {
  const dir = path.join(root, 'shell', a);
  const out = {};
  fs.readdirSync(dir).forEach(function (n) { try { out[n] = fs.readFileSync(path.join(dir, n), 'utf8'); } catch (e) { out[n] = null; } });
  return JSON.stringify(out);
};
const before = { appFaceApp: snapshot('appFaceApp'), fixList: snapshot('fixList') };
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
send('fixList', { verb: 'fix', text: 'PEER-FIX-REQUEST' });
setTimeout(function () {
  if (witnesses.length >= 2) test.check('both apps booted and took arrivals');
  else test.fail(OWED + 'no app subscribed to arrivals; the checks below would pass vacuously');
  if (snapshot('appFaceApp') === before.appFaceApp && !posts.length) test.check('appFaceApp: a listed peer asking for a name gets no grant and no answer');
  else test.fail(OWED + 'appFaceApp still grants to a peer: grants.json ' + fs.readFileSync(path.join(root, 'shell', 'appFaceApp', 'grants.json'), 'utf8').slice(0, 80) + ', ' + posts.length + ' posts');
  if (snapshot('fixList') === before.fixList) test.check('fixList: a listed peer\'s fix request files nothing');
  else test.fail(OWED + 'fixList still files a peer\'s request');
  fs.rmSync(root, { recursive: true, force: true });
  test.reportSuccessFailureCount();
  process.exit(0);
}, 300);
