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
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } }
function code(p) { const t = read(p); return t == null ? null : t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

// THE SERVERS' PAGE TABLE, LOADED BEFORE THE FIRST CHECK: testReport loads spirit.js for its record with the global
// hidden, so a module that needs the spirit global (serveCommon.js) is required while it still stands.
const pages = require(path.join(RUN, 'spirit', 'serveCommon.js'));

// boot.js: the face's boot. One test.run per test (goal/G47.2).
const NO_BOOT = 'spirit/shell/boot.js is not there';

// where it lives, and what moved with it
test.run('spirit/shell/boot.js is there', 0.2, function () {
  return !!code('spirit/shell/boot.js') || NO_BOOT;
}, test.limit.quick);
test.run('nothing of face/ is left: its files moved into shell/', 0.2, function () {
  const left = ['face/shell.js', 'face/seal.js', 'face/face.css', 'face/favicon.svg', 'face/login/login.js', 'face/login/login.json'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !left.length || 'still in face/: ' + left.join(', ');
}, test.limit.quick);
// goal/G43.18 (Andy: "i want all vital files under run://spirit/"): the boot, the page and their files are in spirit/shell/,
// served at the addresses they always had (spirit/serveCommon.js, PAGE_FILES).
test.run('the seal, the sheets, the icons and the pages are in spirit/shell/, spirit.js in spirit/', 0.2, function () {
  const moved = ['spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/shell/face.html', 'spirit/shell/shell.css', 'spirit/shell/ghost.svg', 'spirit/spirit.js'].filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  return !moved.length || 'not there: ' + moved.join(', ');
}, test.limit.quick);
test.run('nothing of them is left at the run root or in shell/', 0.2, function () {
  const leftBehind = ['face.html', 'index.html', 'shell.css', 'favicon.svg', 'spirit.js', 'shell/boot.js', 'shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/tokens.css', 'shell/elements.css'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !leftBehind.length || 'still there: ' + leftBehind.join(', ');
}, test.limit.quick);
test.run('the addresses stay: /face.html, /spirit.js, /shell/boot.js and /favicon.svg are served from their new files (Q25)', 0.2, function () {
  return pages.pageFile('face.html') === 'spirit/shell/face.html' && pages.pageFile('spirit.js') === 'spirit/spirit.js' && pages.pageFile('shell/boot.js') === 'spirit/shell/boot.js' && pages.pageFile('favicon.svg') === 'spirit/shell/ghost.svg' ? true : 'pageFile: ' + short(pages.PAGE_FILES);
}, test.limit.quick);
// goal/G43.18, box v29: "The login is spirit.login, in spirit.js, no app ... shell/login/ and its login.json go."
test.run('shell/login/ is gone: the login is spirit.login (goal/G43.18)', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'shell', 'login')) || 'shell/login/ is still there';
}, test.limit.quick);
test.run('spirit.js loads shell/boot.js on a face page', 0.2, function () {
  const loader = code('spirit/spirit.js') || '';
  return (/var FACE = \['shell\/boot\.js'\]/).test(loader) && !(/face\/shell\.js/).test(loader) ? true : 'spirit.js still names face/shell.js, or not shell/boot.js';
}, test.limit.quick);
// Box v29: "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link".
test.run('face.html links /shell/favicon.svg and no sheet', 0.2, function () {
  const page = read('spirit/shell/face.html') || '';
  return (/\/shell\/favicon\.svg/).test(page) && !(/rel="stylesheet"/).test(page) && !(/\/face\/(face\.css|favicon\.svg)/).test(page) ? true : 'face.html still links a sheet or the old face/ files';
}, test.limit.quick);
test.run('boot names no old face/ path, and no login app', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  const oldPaths = (boot.match(/face\/(shell\.js|seal\.js|face\.css|favicon\.svg|login\/[\w.]+)/g) || []);
  return !oldPaths.length && !(/shell\/login\//).test(boot) ? true : 'old paths in boot: ' + short(oldPaths);
}, test.limit.quick);

// what it loads: only what it runs itself
test.run('it reads no component but its own: spirit\'s libraries, the sheets and the tree\'s row', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  const paths = (boot.match(/['"](?:spirit|shell)\/[\w/.-]+\.(?:js|css|json)['"]|['"]shell\.css['"]/g) || []).map(function (s) { return s.slice(1, -1); });
  const allowed = function (p) {
    return p === 'shell.css' || p === 'shell/face.css' || /^spirit\/[\w.-]+\.js$/.test(p) || /^spirit\/client\/[\w.-]+\.js$/.test(p) ||
      p === 'spirit/element/joinSteps.js' ||
      // goal/G41.19: the file tree's row element, which spirit.js does not load.
      p === 'spirit/element/search/file/rowElement.js';
  };
  const extra = paths.filter(function (p) { return !allowed(p); }).filter(function (p, i, all) { return all.indexOf(p) === i; });
  return !extra.length || 'boot loads components that are no part of it, of ' + paths.length + ' paths read: ' + short(extra);
}, test.limit.quick);
// JOIN IS AN APP (goal/G43.26; Andy: "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP, LIKE IT
// ALWAYS WAS)"): spirit/app/join/, a tile beside the others; boot does not load it.
test.run('boot does not load Join: it is an app of spirit/app/join/ (goal/G43.26)', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/join\/join\.js/).test(boot) || 'boot still names join/join.js';
}, test.limit.quick);
test.run('boot reads no sidecar of Join', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/join[\w.]*\.sidecar\.json/).test(boot) || 'boot reads the sidecar of Join';
}, test.limit.quick);
test.run('boot, the seal, the sheet, the icon and the Join app whole are core', 0.2, function () {
  const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
  const mustCore = ['spirit/shell/boot.js', 'spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/app/join/element.js', 'spirit/app/join/join.json'];
  const notCore = mustCore.filter(function (p) { return core.isCore('spirit/run/' + p, REPO) !== true; });
  return !notCore.length || 'not core: ' + notCore.join(', ');
}, test.limit.quick);

// GOAL/G43.18, BOX V29, "The shell": "boot.js does the link home and the face stream only, then loads the shell the node
// names, spirit/app/<name>"; Q22: the link is spirit.js's; Q23: no desktop of boot's own; Q18: Join shows itself.
// the shell the node names, and no desktop of its own (goal/G43.18)
test.run('boot asks node.shell and loads spirit/app/<name>/element.js, the shell\'s main element (goal/G43.32, rule 4)', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return (/node\.shell\(\{ at: at \}\)/).test(boot) && (/'spirit\/app\/' \+ name \+ '\/element\.js'/).test(boot) ? true : 'boot does not load the shell the node names';
}, test.limit.quick);
test.run('no desktop of its own: no drawDesktop, readFace, listApps, openApp, loadApp or serverUp', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/).test(boot) || 'boot still draws a desktop: ' + short((boot.match(/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/g) || []));
}, test.limit.quick);
test.run('no link and no relay login of its own: spirit.link and spirit.login are spirit.js\'s', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/function (postCall|uploadSave)\(/).test(boot) && !(/'\/face\/api'/).test(boot) ? true : 'boot still holds the link or the login';
}, test.limit.quick);
test.run('Join decides where it stands itself: boot works out no join step', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/joinNow|joinOpenStep|handJoin/).test(boot) || 'boot still works out Join\'s steps';
}, test.limit.quick);

// THE ICON SET IS THE ONLY SOURCE OF ICONS ON THE FACE (goal/G41.1, box v19-v20; Andy: iconIndex.js "MUST BE DELETED,
// KILLED, ERADICATED"): iconIndex.js and chatLog.js are gone; boot loads neither and looks nothing up by key; every app
// manifest names its icon as the glyph itself.
// no icon table on the face
test.run('spirit/client/iconIndex.js and chatLog.js are gone', 0.2, function () {
  const gone = ['spirit/client/iconIndex.js', 'spirit/client/chatLog.js'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  return !gone.length || 'still there: ' + gone.join(', ');
}, test.limit.quick);
test.run('boot names neither, and no icon table', 0.2, function () {
  const boot = code('spirit/shell/boot.js');
  if (!boot) return NO_BOOT;
  return !(/iconIndex|chatLog|\bICON\b/).test(boot) || 'boot still names iconIndex, chatLog or ICON';
}, test.limit.quick);
test.run('every app manifest names its icon as the glyph itself', 0.2, function () {
  const keyed = [];
  ['shell', 'spirit/app'].forEach(function (dir) {
    let names = []; try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
    names.forEach(function (n) {
      let m = null; try { m = JSON.parse(fs.readFileSync(path.join(RUN, dir, n, n + '.json'), 'utf8')); } catch (e) { m = null; }
      const icon = m && (typeof m.icon === 'string' ? m.icon : (m.identity && m.identity.icon));
      if (typeof icon === 'string' && /^[A-Z_]+$/.test(icon)) keyed.push(dir + '/' + n + ':' + icon);
    });
  });
  return !keyed.length || keyed.length + ' manifests name a key: ' + short(keyed);
}, test.limit.quick);
