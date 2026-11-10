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
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function read(p) { try { return fs.readFileSync(path.join(RUN, p), 'utf8'); } catch (e) { return null; } }
function code(p) { const t = read(p); return t == null ? null : t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

// THE SERVERS' PAGE TABLE, LOADED BEFORE THE FIRST CHECK: testReport loads spirit.js for its record with the global
// hidden, so a module that needs the spirit global (serveCommon.js) is required while it still stands.
const pages = require(path.join(RUN, 'spirit', 'serveCommon.js'));

test.startTest('boot.js: the face\'s boot');

(async function () {
  test.subHeading('where it lives, and what moved with it');
  const boot = code('spirit/shell/boot.js');
  ok(!!boot, 'spirit/shell/boot.js is there', 'spirit/shell/boot.js is not there');
  const left = ['face/shell.js', 'face/seal.js', 'face/face.css', 'face/favicon.svg', 'face/login/login.js', 'face/login/login.json'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  ok(!left.length, 'nothing of face/ is left: its files moved into shell/', 'still in face/: ' + left.join(', '));
  // goal/G43.18 (Andy: "i want all vital files under run://spirit/"): the boot, the page and their files are in spirit/shell/,
  // served at the addresses they always had (spirit/serveCommon.js, PAGE_FILES).
  const moved = ['spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/shell/face.html', 'spirit/shell/shell.css', 'spirit/shell/ghost.svg', 'spirit/spirit.js'].filter(function (p) { return !fs.existsSync(path.join(RUN, p)); });
  ok(!moved.length, 'the seal, the sheets, the icons and the pages are in spirit/shell/, spirit.js in spirit/', 'not there: ' + moved.join(', '));
  const leftBehind = ['face.html', 'index.html', 'shell.css', 'favicon.svg', 'spirit.js', 'shell/boot.js', 'shell/seal.js', 'shell/face.css', 'shell/favicon.svg', 'shell/tokens.css', 'shell/elements.css'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  ok(!leftBehind.length, 'nothing of them is left at the run root or in shell/', 'still there: ' + leftBehind.join(', '));
  ok(pages.pageFile('face.html') === 'spirit/shell/face.html' && pages.pageFile('spirit.js') === 'spirit/spirit.js' && pages.pageFile('shell/boot.js') === 'spirit/shell/boot.js' && pages.pageFile('favicon.svg') === 'spirit/shell/ghost.svg', 'the addresses stay: /face.html, /spirit.js, /shell/boot.js and /favicon.svg are served from their new files (Q25)', 'pageFile: ' + short(pages.PAGE_FILES));
  // goal/G43.18, box v29: "The login is spirit.login, in spirit.js, no app ... shell/login/ and its login.json go."
  ok(!fs.existsSync(path.join(RUN, 'shell', 'login')), 'shell/login/ is gone: the login is spirit.login (goal/G43.18)', 'shell/login/ is still there');
  const loader = code('spirit/spirit.js') || '';
  ok(/var FACE = \['shell\/boot\.js'\]/.test(loader) && !/face\/shell\.js/.test(loader), 'spirit.js loads shell/boot.js on a face page', 'spirit.js still names face/shell.js, or not shell/boot.js');
  const page = read('spirit/shell/face.html') || '';
  // Box v29: "boot.js, shell.css, face.css and every other part of the shell come from the home node over that link".
  ok(/\/shell\/favicon\.svg/.test(page) && !/rel="stylesheet"/.test(page) && !/\/face\/(face\.css|favicon\.svg)/.test(page), 'face.html links /shell/favicon.svg and no sheet', 'face.html still links a sheet or the old face/ files');
  if (boot) {
    const oldPaths = (boot.match(/face\/(shell\.js|seal\.js|face\.css|favicon\.svg|login\/[\w.]+)/g) || []);
    ok(!oldPaths.length && !/shell\/login\//.test(boot), 'boot names no old face/ path, and no login app', 'old paths in boot: ' + short(oldPaths));
  }

  test.subHeading('what it loads: only what it runs itself');
  if (boot) {
    const paths = (boot.match(/['"](?:spirit|shell)\/[\w/.-]+\.(?:js|css|json)['"]|['"]shell\.css['"]/g) || []).map(function (s) { return s.slice(1, -1); });
    const allowed = function (p) {
      return p === 'shell.css' || p === 'shell/face.css' || /^spirit\/[\w.-]+\.js$/.test(p) || /^spirit\/client\/[\w.-]+\.js$/.test(p) ||
        p === 'spirit/element/joinSteps.js' ||
        // goal/G41.19: the file tree's row element, which spirit.js does not load.
        p === 'spirit/element/search/file/rowElement.js';
    };
    const extra = paths.filter(function (p) { return !allowed(p); }).filter(function (p, i, all) { return all.indexOf(p) === i; });
    ok(!extra.length, 'boot names no component but its own: spirit\'s libraries, the sheets and the tree\'s row (' + paths.length + ' paths read)',
      'boot loads components that are no part of it: ' + short(extra));
    // JOIN IS AN APP (goal/G43.26; Andy: "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP, LIKE IT
    // ALWAYS WAS)"): spirit/app/join/, a tile beside the others; boot does not load it.
    ok(!/join\/join\.js/.test(boot), 'boot does not load Join: it is an app of spirit/app/join/ (goal/G43.26)', 'boot still names join/join.js');
    ok(!/join[\w.]*\.sidecar\.json/.test(boot), 'boot reads no sidecar of Join', 'boot reads the sidecar of Join');
  }
  const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));
  const mustCore = ['spirit/shell/boot.js', 'spirit/shell/seal.js', 'spirit/shell/face.css', 'spirit/shell/favicon.svg', 'spirit/app/join/join.js', 'spirit/app/join/join.json'];
  const notCore = mustCore.filter(function (p) { return core.isCore('spirit/run/' + p, REPO) !== true; });
  ok(!notCore.length, 'boot, the seal, the sheet, the icon and the Join app whole are core', 'not core: ' + notCore.join(', '));

  // GOAL/G43.18, BOX V29, "The shell": "boot.js does the link home and the face stream only, then loads the shell the node
  // names, spirit/app/<name>"; Q22: the link is spirit.js's; Q23: no desktop of boot's own; Q18: Join shows itself.
  test.subHeading('the shell the node names, and no desktop of its own (goal/G43.18)');
  if (boot) {
    ok(/node\.shell\(\{ at: at \}\)/.test(boot) && /'spirit\/app\/' \+ name \+ '\/' \+ name \+ '\.js'/.test(boot), 'boot asks node.shell and loads spirit/app/<name>/<name>.js', 'boot does not load the shell the node names');
    ok(!/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/.test(boot), 'no desktop of its own: no drawDesktop, readFace, listApps, openApp, loadApp or serverUp', 'boot still draws a desktop: ' + short((boot.match(/function (drawDesktop|readFace|listApps|openApp|loadApp|serverUp)\(/g) || [])));
    ok(!/function (postCall|uploadSave)\(/.test(boot) && !/'\/face\/api'/.test(boot), 'no link and no relay login of its own: spirit.link and spirit.login are spirit.js\'s', 'boot still holds the link or the login');
    ok(!/joinNow|joinOpenStep|handJoin/.test(boot), 'Join decides where it stands itself: boot works out no join step', 'boot still works out Join\'s steps');
  }

  // THE ICON SET IS THE ONLY SOURCE OF ICONS ON THE FACE (goal/G41.1, box v19-v20; Andy: iconIndex.js "MUST BE DELETED,
  // KILLED, ERADICATED"): iconIndex.js and chatLog.js are gone; boot loads neither and looks nothing up by key; every app
  // manifest names its icon as the glyph itself.
  test.subHeading('no icon table on the face');
  const gone = ['spirit/client/iconIndex.js', 'spirit/client/chatLog.js'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); });
  ok(!gone.length, 'spirit/client/iconIndex.js and chatLog.js are gone', 'still there: ' + gone.join(', '));
  if (boot) {
    ok(!/iconIndex|chatLog|\bICON\b/.test(boot), 'boot names neither, and no icon table', 'boot still names iconIndex, chatLog or ICON');
  }
  const keyed = [];
  ['shell', 'spirit/app'].forEach(function (dir) {
    let names = []; try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
    names.forEach(function (n) {
      let m = null; try { m = JSON.parse(fs.readFileSync(path.join(RUN, dir, n, n + '.json'), 'utf8')); } catch (e) { m = null; }
      const icon = m && (typeof m.icon === 'string' ? m.icon : (m.identity && m.identity.icon));
      if (typeof icon === 'string' && /^[A-Z_]+$/.test(icon)) keyed.push(dir + '/' + n + ':' + icon);
    });
  });
  ok(!keyed.length, 'every app manifest names its icon as the glyph itself', keyed.length + ' manifests name a key: ' + short(keyed));

}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
