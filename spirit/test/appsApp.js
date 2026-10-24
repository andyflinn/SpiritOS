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
  const spirit = require('../run/spirit/kernel.js');
  const W = spirit.core.fs.fileWritable;
  const want = {
    'process/js/desk/desk.json': true, 'process/js/desk/desk.js': true, 'shell/contacts/contacts.json': true,
    'media/a.png': true, 'my-own-folder/notes.txt': true, 'preferences.json': true,
    'spirit/kernel.js': false, 'shell/js/spiritData.js': false, 'shell/contacts/contacts.js': false, 'index.html': false,
    'relay-state/identity.json': false, 'shell/files/files.js.sidecar.json': false,
  };
  const wrong = Object.keys(want).filter(function (p) { return !!W(p) !== want[p]; });
  if (!wrong.length) test.check('writable: every non-core file, server scripts and manifests among them; not: core, relay-state, a sidecar\'s own path');
  else test.fail(OWED + 'the gate answers wrongly for ' + wrong.map(function (p) { return p + '=' + !!W(p); }).join(', '));
  const kern = code('spirit/kernel.js');
  if (!/WRITABLE_ROOT_NAMES|'media'|'published'/.test(kern)) test.check('the core names no user folder: media/ and published/ have no special status');
  else test.fail(OWED + 'kernel.js still names media/ or published/');
  const core = require('../run/spirit/coreFiles.js');
  if (core.isCore('spirit/run/face/shell.js') && core.isCore('spirit/run/face/login/login.js') && core.isCore('spirit/run/face.html'))
    test.check('the face folder and face.html are core');
  else test.fail(OWED + 'coreFiles: face/shell.js ' + core.isCore('spirit/run/face/shell.js') + ', face.html ' + core.isCore('spirit/run/face.html'));
  if (core.isCore('spirit/run/shell/contacts/contacts.js') && !core.isCore('spirit/run/shell/contacts/contacts.json'))
    test.check('a manifest is never core, an intrinsic app\'s included');
  else test.fail(OWED + 'coreFiles: contacts.js ' + core.isCore('spirit/run/shell/contacts/contacts.js') + ', contacts.json ' + core.isCore('spirit/run/shell/contacts/contacts.json'));

  // Only the face part's intrinsic mark makes code core (box v16), for apps and servers; the .json's intrinsic counts
  // for nothing here. A scratch tree with one app marked each way.
  const os = require('os');
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-app-core-'));
  const put = function (rel, obj) { const f = path.join(tree, 'spirit', 'run', rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj)); };
  put('shell/marked/marked.js.sidecar.json', { face: { intrinsic: true } });
  put('shell/oldway/oldway.json', { intrinsic: true });
  put('process/js/srv/srv.js.sidecar.json', { face: { intrinsic: true } });
  const marks = { marked: core.isCore('spirit/run/shell/marked/marked.js', tree), data: core.isCore('spirit/run/shell/marked/notes.json', tree),
    oldway: core.isCore('spirit/run/shell/oldway/oldway.js', tree), srv: core.isCore('spirit/run/process/js/srv/srv.js', tree) };
  try { fs.rmSync(tree, { recursive: true, force: true }); } catch (e) { /* temp */ }
  if (marks.marked && !marks.data && !marks.oldway && marks.srv) test.check('only the face part\'s intrinsic mark makes code core, for an app and a server; data stays writable; a .json\'s intrinsic counts for nothing');
  else test.fail(OWED + 'coreFiles on a scratch tree: ' + short(marks));
  const fsSide = json('process/js/fileServer/fileServer.js.sidecar.json');
  if (fsSide && fsSide.face && fsSide.face.intrinsic === true && (json('shell/files/files.js.sidecar.json').face || {}).intrinsic === true)
    test.check('today\'s intrinsic apps and servers ship with the mark (fileServer, Files)');
  else test.fail(OWED + 'the intrinsic mark is not shipped in the face parts');

  test.subHeading('2. the face part of a sidecar');
  const asked = { annotateFace: [], call: [] };
  // The answer is signed and uploaded to the relay; a scratch identity signs it, and the upload to a relay that is not
  // there fails on its own without touching anything.
  const me = require('../run/spirit/relayAuth.js').generateIdentity('apps-app-test');
  let answered = null;
  try {
    const home = require('../run/spirit/faceHome.js').createFaceHome({
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
  if (/data: 'files'|fileList\.create\(|spirit\.data/.test(apps) && /\.fs\.annotate\(/.test(apps) && !/setAppOverride|appOverrides/.test(apps))
    test.check('Apps rides on the Files cache and edits the face annotation; the old overrides are gone');
  else test.fail(OWED + 'shell/apps/apps.js is not the new Apps app');

  // ── 6. The Icons app and glyphs as themselves (box v22) ──────────────────────────────────────────────────────────
  test.subHeading('6. the Icons app, and icons used as themselves on the face');
  const set = json('shell/icons/iconSet.json');
  const setKeys = set ? Object.keys(set) : [];
  const kernelGlyphs = Object.keys(spirit.core.const.ICON).map(function (k) { return spirit.core.const.ICON[k]; });
  if (setKeys.length > 50 && setKeys.every(function (g) { return Array.isArray(set[g]) && !/^[A-Z_]+$/.test(g); }) && kernelGlyphs.every(function (g) { return setKeys.indexOf(g) !== -1; }))
    test.check('shell/icons/iconSet.json: each key a glyph, its keywords an array, every glyph of the kernel\'s table in it');
  else test.fail(OWED + 'iconSet.json: ' + setKeys.length + ' keys' + (set ? '' : ' (missing)'));
  const iconsSide = json('shell/icons/icons.js.sidecar.json');
  const iconsMan = json('shell/icons/icons.json');
  if (iconsMan && raw('shell/icons/icons.js') && iconsSide && iconsSide.face && iconsSide.face.app === true && iconsSide.face.intrinsic === true)
    test.check('the Icons app: its folder, its manifest, its face part on the face and intrinsic');
  else test.fail(OWED + 'the Icons app is missing, or its face part does not say app and intrinsic');
  const idx = raw('index.html');
  const iconsList = code('shell/js/icons/listElement.js');
  if (iconsList && code('shell/js/icons/rowElement.js') && idx.indexOf('/shell/js/icons/listElement.js') !== -1 && idx.indexOf('/shell/js/icons/rowElement.js') !== -1
      && /iconList/.test(iconsList) && /iconList\.create\(/.test(code('shell/apps/apps.js')) && /iconList\.create\(/.test(code('shell/icons/icons.js')))
    test.check('shell/js/icons/ has its row and list, loaded by index.html; Apps\' icon field and the Icons app draw that list');
  else test.fail(OWED + 'the icons elements are missing, not loaded, or not drawn by Apps and Icons');
  const keyed = ['face/shell.js', 'shell/js/contacts/rowElement.js', 'shell/js/contacts/listElement.js', 'shell/js/files/rowElement.js',
    'shell/js/textViewer.js', 'shell/contacts/contacts.js'].filter(function (f) { return /const\.ICON|ICON\[|ICON\.[A-Z]/.test(code(f)); });
  const keyParts = ['contacts', 'files', 'mediaViewer', 'apps', 'icons'].filter(function (n) {
    const s2 = json('shell/' + n + '/' + n + '.js.sidecar.json');
    return !s2 || !s2.face || /^[A-Z_]+$/.test(String(s2.face.icon || ''));
  });
  if (!keyed.length && !keyParts.length) test.check('the face code and the face parts use glyphs as themselves, no key into a table');
  else test.fail(OWED + 'still by key: ' + keyed.concat(keyParts.map(function (n) { return n + ' face part'; })).join(', '));

  test.subHeading('5. core files seen');
  const row = code('shell/js/files/rowElement.js');
  if (/coreFiles/.test(code('spirit/jobs.js')) && /core/.test(code('shell/js/files/data.js')) && /core/.test(row) && /yellow|--spirit-core/.test(row))
    test.check('an fs-watcher command marks a core file; the files list paints it yellow');
  else test.fail(OWED + 'core files are not marked or not painted');

  // goal/G33.1. Andy: on the face every icon add says "not saved: refused"; at home the same save is taken. A refusal
  // on its way to the face kept only a code, and the relay's refusals ({ok: false, error}) and plain-text answers carry
  // none, so the words that said why were lost. A refusal now keeps its words, and the Icons app shows them.
  test.subHeading('7. a refusal says why, as far as the Icons app (goal/G33.1)');
  const S = require('../run/spirit.js');
  const answers = {
    relayJson: { status: 400, body: { ok: false, error: 'the body is not json' }, text: '{"ok":false,"error":"the body is not json"}' },
    plainText: { status: 504, body: null, text: 'the home node did not answer' },
  };
  let mode = 'relayJson';
  const transport = {
    ask: function (verb, args) {
      if (verb === 'api' && args && args.family) return Promise.resolve({ status: 200, body: { family: args.family, interface: raw('spirit/' + args.family + '/api.js') } });
      if (verb === 'api') return Promise.resolve({ status: 200, body: { fs: {} } });
      return Promise.resolve(answers[mode]);
    },
    file: function () { return Promise.resolve({ status: 404, bytes: new Uint8Array(0) }); },
  };
  let said = [];
  try {
    const s = await S.createSpirit(transport);
    for (const m of Object.keys(answers)) { mode = m; said.push(await s.fs.saveFile('shell/icons/iconSet.json', '{}')); }
  } catch (e) { said = [{ threw: e.message }]; }
  if (said.length === 2 && said[0].ok === false && /the body is not json/.test(said[0].reason) && said[1].ok === false && /the home node did not answer/.test(said[1].reason))
    test.check('saveFile refused by the relay or in plain text answers the words: "' + said[0].reason + '", "' + said[1].reason + '"');
  else test.fail('OWED by goal/G33.1: saveFile refused answered ' + JSON.stringify(said).slice(0, 240));
  if (/not saved: ' \+ \(\(r && r\.reason\)/.test(code('shell/icons/icons.js'))) test.check('the Icons app shows the reason beside Add');
  else test.fail('OWED by goal/G33.1: the Icons app does not show the reason');

  // goal/G33.1, the cause the words named. Andy: "not saved: Body too large: 23608 of 23552": the relay takes one face
  // request up to BODY_MAX, and the Icons app sends its whole set. A request too large for one trip goes in pieces,
  // each its own call through the relay; the home node puts them back together and runs the whole once.
  test.subHeading('8. a face request too large for one trip goes in pieces (goal/G33.1)');
  const big = { verb: 'fs.save', path: 'shell/icons/iconSet.json', content: 'x'.repeat(30000) };
  // A piece carries base64 of the request's bytes: nothing in it is escaped again, so its size is what it measures.
  const whole = Buffer.from(JSON.stringify(big), 'utf8').toString('base64');
  const cut = Math.floor(whole.length / 2);
  const ran = [];
  const sent = [];
  let pieceAnswer = null;
  try {
    const FH = require('../run/spirit/faceHome.js');
    const home2 = FH.createFaceHome({
      call: function (verb, args) { ran.push({ verb: verb, bytes: String((args && args.content) || '').length }); return Promise.resolve({ status: 204, body: null }); },
      annotateFace: function () { return { ok: true }; }, serveFile: function () {}, identity: function () { return me; }, relayKey: function () { return ''; },
      jobs: { subscribe: function () { return function () {}; } }, renames: null, log: function () {},
      upload: function (url, at, headers) { sent.push({ at: at, status: headers && headers['x-spirit-status'] }); return { on: function () {}, write: function () { return true; }, end: function () {} }; },
    });
    home2.request('http://relay.test', { id: 'c1', request: { piece: { id: 'P1', n: 0, of: 2, text: whole.slice(0, cut) } } });
    await new Promise(function (r) { setTimeout(r, 30); });
    pieceAnswer = ran.length;
    home2.request('http://relay.test', { id: 'c2', request: { piece: { id: 'P1', n: 1, of: 2, text: whole.slice(cut) } } });
    await new Promise(function (r) { setTimeout(r, 50); });
  } catch (e) { ran.push({ threw: e.message }); }
  if (pieceAnswer === 0 && ran.length === 1 && ran[0].verb === 'fs.save' && ran[0].bytes === 30000)
    test.check('the node runs nothing on the first piece, and the whole fs.save once the last is in (30000 bytes)');
  else test.fail('OWED by goal/G33.1: pieces ran ' + JSON.stringify(ran).slice(0, 200) + ' (after the first: ' + pieceAnswer + ')');
  const faceShellNow = code('face/shell.js');
  // A second declaration of the same name replaces the first without a word: the piece sender, named post, took the
  // place of post(verb, body), sent the face's state check to /face/call and showed Andy the login screen (G33.1).
  // The shell's own scope is its top level, two spaces in; a helper inside a function is that function's own.
  const declared = (faceShellNow.match(/^ {2}function\s+\w+\s*\(/gm) || []).map(function (d) { return d.replace(/^\s*function\s+|\s*\($/g, ''); });
  const twice = declared.filter(function (n, i) { return declared.indexOf(n) !== i; });
  if (!twice.length) test.check('face/shell.js declares every function name of its own scope once');
  else test.fail('OWED by goal/G33.1: face/shell.js declares twice: ' + twice.join(', '));
  if (/piece/.test(faceShellNow) && /BODY_MAX|PIECE_MAX|piece.*max/i.test(faceShellNow)) test.check('the face shell sends a request larger than one trip in pieces');
  else test.fail('OWED by goal/G33.1: face/shell.js sends every request whole');
}());

done.then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
