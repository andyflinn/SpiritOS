'use strict';

// spirit/run/spirit/shell/test/boot.js
// The tests of spirit/shell/boot.js, and of no other module (spec: ./boot.md; goal/G41.3): where the face's boot lives and
// what moved with it, what it loads, and the shell it loads (goal/G43.18). The old shell's face apps it once loaded alone,
// each from shell/, went with shell/ (goal/G43.30).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'boot.js');
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } }
function code(p) { const t = read(p); return t == null ? null : t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

// THE SERVERS' PAGE TABLE, LOADED BEFORE THE FIRST CHECK: testReport loads spirit.js for its record with the global
// hidden, so a module that needs the spirit global (serveCommon.js) is required while it still stands.
const pages = require(path.join(RUN, 'spirit', 'server', 'serveCommon.js'));

// boot.js: the face's boot. One test.run per test (goal/G47.2).

// where it lives, and what moved with it
test.run('spirit/shell/boot.js is there', 0.2, function () {
  return !!code('spirit/shell/boot.js') || false;
}, test.limit.quick);
test.run('nothing of face/ is left: its files moved into shell/', 0.2, function () {
  const left = ['face/shell.js', 'face/seal.js', 'face/face.css', 'face/favicon.svg', 'face/login/login.js', 'face/login/login.json'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !left.length || false;
}, test.limit.quick);
// goal/G43.18 (Andy: "i want all vital files under run://spirit/"): the boot, the page and their files are in spirit/shell/,
// served at the addresses they always had (spirit/server/serveCommon.js, PAGE_FILES).
test.run('the seal, the sheets, the icons and the pages are in spirit/shell/, spirit.js in spirit/', 0.2, function () {
  const moved = ['spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/shell/face.html', 'spirit/shell/shell.css', 'spirit/shell/ghost.svg', 'spirit/spirit.js'].filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  return !moved.length || false;
}, test.limit.quick);
test.run('nothing of them is left at the run root or in shell/', 0.2, function () {
  const leftBehind = ['face.html', 'index.html', 'shell.css', 'favicon.svg', 'spirit.js', 'shell/boot.js', 'shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/tokens.css', 'shell/elements.css'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !leftBehind.length || false;
}, test.limit.quick);
test.run('the addresses stay: /face.html, /spirit.js, /shell/boot.js and /favicon.svg are served from their new files', 0.2, function () {
  return pages.pageFile('face.html') === 'spirit/shell/face.html' && pages.pageFile('spirit.js') === 'spirit/spirit.js' && pages.pageFile('shell/boot.js') === 'spirit/shell/boot.js' && pages.pageFile('favicon.svg') === 'spirit/shell/ghost.svg' ? true : false;
}, test.limit.quick);
// goal/G43.18, box v29: "The login is spirit.login, in spirit.js, no app ... shell/login/ and its login.json go."
test.run('shell/login/ is gone: the login is spirit.login', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'login')) || false;
}, test.limit.quick);
test.run('spirit.js loads shell/boot.js on a face page', 0.2, function () {
  const loader = code('spirit/spirit.js') || '';
  return (/var FACE = \['shell\/boot\.js'\]/).test(loader) && !(/face\/shell\.js/).test(loader) ? true : false;
}, test.limit.quick);
// Box v29: "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link".
test.run('face.html links /shell/favicon.svg and no sheet', 0.2, function () {
  const page = read('spirit/shell/face.html') || '';
  return (/\/shell\/favicon\.svg/).test(page) && !(/rel="stylesheet"/).test(page) && !(/\/face\/(face\.css|favicon\.svg)/).test(page) ? true : false;
}, test.limit.quick);
test.run('boot names no old face/ path, and no login app', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  const oldPaths = (boot.match(/face\/(shell\.js|seal\.js|face\.css|favicon\.svg|login\/[\w.]+)/g) || []);
  return !oldPaths.length && !(/shell\/login\//).test(boot) ? true : false;
}, test.limit.quick);

// what it loads: only what it runs itself
test.run('it reads no component but its own: spirit\'s libraries, the sheets and the tree\'s row', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  const paths = (boot.match(/['"](?:spirit|shell)\/[\w/.-]+\.(?:js|css|json)['"]|['"]shell\.css['"]/g) || []).map(function (s) { return s.slice(1, -1); });
  const allowed = function (p) {
    return p === 'shell.css' || p === 'shell/face.css' || /^spirit\/[\w.-]+\.js$/.test(p) || /^spirit\/client\/[\w.-]+\.js$/.test(p) ||
      p === 'spirit/element/joinSteps.js' ||
      // goal/G41.19: the file tree's row element, which spirit.js does not load.
      p === 'spirit/element/search/file/row.js' ||
      // THE ONE SHELL (goal/G49.4, box v15: "spirit/element/script.js becomes the hard-coded only shell there is in SpiritOS").
      p === 'spirit/element/script.js' ||
      // A FAMILY'S INTERFACE, which brings its data with it (goal/G47.1; Andy's rule: "every api.js requires it's companion
      // data.js, and is the only script to require that data.js"): boot reads the jobs it streams from the job family's.
      /^spirit\/[\w-]+\/api\.js$/.test(p);
  };
  const extra = paths.filter(function (p) { return !allowed(p); }).filter(function (p, i, all) { return all.indexOf(p) === i; });
  return !extra.length || false;
}, test.limit.quick);
// JOIN IS AN APP (goal/G43.26; Andy: "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP, LIKE IT
// ALWAYS WAS)"): spirit/app/join/, a tile beside the others; boot does not load it.
test.run('boot does not load Join: it is an app of spirit/app/join/', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/join\/join\.js/).test(boot) || false;
}, test.limit.quick);
test.run('boot reads no sidecar of Join', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/join[\w.]*\.sidecar\.json/).test(boot) || false;
}, test.limit.quick);
test.run('boot, the seal, the sheet, the icon and the Join app whole are core', 0.2, function () {
  const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
  const mustCore = ['spirit/shell/boot.js', 'spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/app/join/element.js', 'spirit/app/join/join.json'];
  const notCore = mustCore.filter(function (p) { return core.isCore('spirit/run/' + p, REPO) !== true; });
  return !notCore.length || false;
}, test.limit.quick);

// GOAL/G43.18, BOX V29, "The shell": "boot.js does the link home and the face stream only, then loads the shell the node
// names, spirit/app/<name>"; Q22: the link is spirit.js's; Q23: no desktop of boot's own; Q18: Join shows itself.
// THE ONE SHELL (goal/G49.4, box v15; Andy: "spirit/element/script.js becomes the hard-coded only shell there is in
// SpiritOS, and replaces whatever the fuck element is dynamically loaded via spirit/shell as shell", "the verb node.shell
// goes", "go!"): boot loads spirit/element/script.js, the one shell, and asks the node for no shell.
test.run('boot loads spirit/element/script.js, the one shell, and asks the node for none', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return (boot.indexOf('spirit/element/script.js') !== -1 && !/node\.shell\b/.test(boot)) || false;
}, test.limit.quick);
test.run('no desktop of its own: no drawDesktop, readFace, listApps, openApp, loadApp or serverUp', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/).test(boot) || false;
}, test.limit.quick);
test.run('no link and no relay login of its own: spirit.link and spirit.login are spirit.js\'s', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/function (postCall|uploadSave)\(/).test(boot) && !(/'\/face\/api'/).test(boot) ? true : false;
}, test.limit.quick);
test.run('Join decides where it stands itself: boot works out no join step', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/joinNow|joinOpenStep|handJoin/).test(boot) || false;
}, test.limit.quick);

// THE ICON SET IS THE ONLY SOURCE OF ICONS ON THE FACE (goal/G41.1, box v19-v20; Andy: iconIndex.js "MUST BE DELETED,
// KILLED, ERADICATED"): iconIndex.js and chatLog.js are gone; boot loads neither and looks nothing up by key; every app
// manifest names its icon as the glyph itself.
// no icon table on the face
test.run('spirit/client/iconIndex.js and chatLog.js are gone', 0.2, function () {
  const gone = ['spirit/client/iconIndex.js', 'spirit/client/chatLog.js'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !gone.length || false;
}, test.limit.quick);
test.run('boot names neither, and no icon table', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return false;
  return !(/iconIndex|chatLog|\bICON\b/).test(boot) || false;
}, test.limit.quick);
test.run('every app manifest names its icon as the glyph itself', 0.2, function () {
  const keyed = [];
  ['shell', 'spirit/app'].forEach(function (dir) {
    let names = []; try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
    names.forEach(function (n) {
      let m = null; try { m = JSON.parse(fs.readFileSync(path.join(RUN, dir, n, n + '.json'), 'utf8')); } catch (e) { m = null; }
      const icon = m && (typeof m.icon === 'string' ? m.icon : (m.identity && m.identity.icon));
      if (typeof icon === 'string' && /^[A-Z_]+$/.test(icon)) keyed.push(n);
    });
  });
  return !keyed.length || false;
}, test.limit.quick);

// ONE PLACE ONLY MANAGES THE STREAM (goal/G47.1, box v148: "spirit.js, which holds the page's one stream (spirit.event);
// spirit/shell/boot.js keeps no stream loop of its own and opens the face's stream through spirit.js, handing only the face's
// address and its line format"). Read as code, its comments left out.
test.run('boot.js keeps no stream loop of its own: it reads no stream body and fetches no /face/stream itself', 0.8, function () {
  const c = code('spirit/shell/boot.js');
  if (c == null) return false;
  return !/\.getReader\s*\(/.test(c) && !/fetch\s*\(\s*['"`]\/face\/stream/.test(c) ? true : false;
}, test.limit.quick);
