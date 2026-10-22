'use strict';

// spirit/test/appsApp.js
// goal/G30.21: a new Apps app, end to end from the shell to the face. Red on today's tree; claude-windows writes it and
// builds it (one agent). The box (v14), in short:
//   - The write gate protects core files only; every other file under the run folder is writable, server scripts and
//     manifests included; relay-state/ and the node's root files stay protected; no folder like media/ or published/
//     is special any more. A manifest (<name>/<name>.json) is never core.
//   - A sidecar has three parts, client, server and face: fs.annotate asked by the face (through faceHome) writes the
//     face part, asked at home the client part.
//   - The face finds its apps by fs.annotations on each shell/<app>/<app>.js; Contacts, Files, Media Viewer and Apps ship
//     with their face part set; a .json's runs is for home only.
//   - The Apps app rides on the Files cache and edits an app's face annotation space.
//   - The files list shows core files in a yellow typeface, by js/coreFiles.js's own rule.
// NAMED HERE: spirit.core.fs.annotateFace(path, payload) writes the face part; createFaceHome takes annotateFace; an
// fs-watcher command carries core: true for a core file; a face part says it is a face app by app: true.
// rule/11: through testSupport only; never 65432.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.21: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const code = function (rel) { return raw(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };
const json = function (rel) { try { return JSON.parse(raw(rel)); } catch (e) { return null; } };

test.startTest('goal/G30.21: the Apps app, end to end from the shell to the face');

const done = (async function () {
  test.subHeading('1. the write gate protects core files only');
  const spirit = require('../run/js/kernel.js');
  const W = spirit.core.fs.fileWritable;
  const want = {
    'process/js/desk/desk.json': true, 'process/js/desk/desk.js': true, 'shell/contacts/contacts.json': true,
    'media/a.png': true, 'my-own-folder/notes.txt': true, 'preferences.json': true,
    'js/kernel.js': false, 'shell/js/spiritData.js': false, 'shell/contacts/contacts.js': false, 'index.html': false,
    'relay-state/identity.json': false, 'shell/files/files.js.sidecar.json': false,
  };
  const wrong = Object.keys(want).filter(function (p) { return !!W(p) !== want[p]; });
  if (!wrong.length) test.check('writable: every non-core file, server scripts and manifests among them; not: core, relay-state, a sidecar\'s own path');
  else test.fail(OWED + 'the gate answers wrongly for ' + wrong.map(function (p) { return p + '=' + !!W(p); }).join(', '));
  const kern = code('js/kernel.js');
  if (!/WRITABLE_ROOT_NAMES|'media'|'published'/.test(kern)) test.check('the core names no user folder: media/ and published/ have no special status');
  else test.fail(OWED + 'kernel.js still names media/ or published/');
  const core = require('../run/js/coreFiles.js');
  if (core.isCore('spirit/run/shell/contacts/contacts.js') && !core.isCore('spirit/run/shell/contacts/contacts.json'))
    test.check('a manifest is never core, an intrinsic app\'s included');
  else test.fail(OWED + 'coreFiles: contacts.js ' + core.isCore('spirit/run/shell/contacts/contacts.js') + ', contacts.json ' + core.isCore('spirit/run/shell/contacts/contacts.json'));

  test.subHeading('2. the face part of a sidecar');
  const asked = { annotateFace: [], call: [] };
  // The answer is signed and uploaded to the relay; a scratch identity signs it, and the upload to a relay that is not
  // there fails on its own without touching anything.
  const me = require('../run/js/relayAuth.js').generateIdentity('apps-app-test');
  let answered = null;
  try {
    const home = require('../run/js/faceHome.js').createFaceHome({
      call: function (verb, args) { asked.call.push(verb); return Promise.resolve({ status: 200, body: { ok: true } }); },
      annotateFace: function (p, payload) { asked.annotateFace.push({ p: p, payload: payload }); return { ok: true }; },
      serveFile: function () {}, identity: function () { return me; }, relayKey: function () { return ''; },
      jobs: { subscribe: function () { return function () {}; } }, renames: null, log: function () {},
    });
    home.request('http://relay.test', { id: 'r1', request: { verb: 'fs.annotate', path: 'shell/files/files.js', payload: { app: true } } });
    await new Promise(function (r) { setTimeout(r, 50); });
    answered = asked;
  } catch (e) { answered = { threw: e.message }; }
  if (answered && answered.annotateFace && answered.annotateFace.length === 1 && answered.annotateFace[0].p === 'shell/files/files.js' && answered.call.indexOf('fs.annotate') === -1)
    test.check('fs.annotate from the face writes the face part, never the client part');
  else test.fail(OWED + 'faceHome on fs.annotate: ' + short(answered));
  if (typeof spirit.core.fs.annotateFace === 'function') test.check('the kernel writes a sidecar\'s face part (annotateFace)');
  else test.fail(OWED + 'no spirit.core.fs.annotateFace');

  test.subHeading('3. the face finds its apps by their face part');
  const shipped = ['contacts', 'files', 'mediaViewer', 'apps'].filter(function (n) {
    const side = json('shell/' + n + '/' + n + '.js.sidecar.json');
    const m = json('shell/' + n + '/' + n + '.json') || {};
    return !(side && side.face && side.face.app === true && !(Array.isArray(m.runs) && m.runs.indexOf('face') !== -1));
  });
  if (!shipped.length) test.check('Contacts, Files, Media Viewer and Apps ship with their face part set; no .json says face');
  else test.fail(OWED + 'not shipped as face apps: ' + shipped.join(', '));
  const faceShell = code('face/shell.js');
  if (/'fs\.annotations'/.test(faceShell) && !/runs\.indexOf\('face'\)/.test(faceShell)) test.check('the face reads each app\'s face part (fs.annotations), not its .json');
  else test.fail(OWED + 'face/shell.js does not find its apps by fs.annotations');

  test.subHeading('4. the Apps app');
  const apps = code('shell/apps/apps.js');
  if (/data: 'files'|fileList\.create\(|spiritData/.test(apps) && /'fs\.annotate'/.test(apps) && !/setAppOverride|appOverrides/.test(apps))
    test.check('Apps rides on the Files cache and edits the face annotation; the old overrides are gone');
  else test.fail(OWED + 'shell/apps/apps.js is not the new Apps app');

  test.subHeading('5. core files seen');
  const row = code('shell/js/files/rowElement.js');
  if (/coreFiles/.test(code('js/jobs.js')) && /core/.test(code('shell/js/files/data.js')) && /core/.test(row) && /yellow|--spirit-core/.test(row))
    test.check('an fs-watcher command marks a core file; the files list paints it yellow');
  else test.fail(OWED + 'core files are not marked or not painted');
}());

done.then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
