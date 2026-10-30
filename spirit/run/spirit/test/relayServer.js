'use strict';

// spirit/run/spirit/test/relayServer.js
// The tests of spirit/relayServer.js, and of no other module (spec: ./relayServer.md; goal/G41.3): how it serves a
// face its files. Its map and its folder are lifted out of the source and asked, so no relay runs.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'relayServer.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('relayServer.js: the face\'s files, at their addresses in shell/');

const src = fs.readFileSync(FILE, 'utf8');
const dirSrc = (/^const FACE_DIR = (path\.join\(__dirname, [^;]*\));/m.exec(src) || [])[1];
const mapSrc = (/^const FACE_FILES = (\{[^;]*\});/m.exec(src) || [])[1];
let dir = null; let map = null;
try { dir = dirSrc ? new Function('path', '__dirname', 'return ' + dirSrc + ';')(path, path.dirname(FILE)) : null; } catch (e) { dir = null; }
try { map = mapSrc ? new Function('return ' + mapSrc + ';')() : null; } catch (e) { map = null; }

test.subHeading('where its face files come from');
ok(dir && path.relative(RUN, dir).split(path.sep).join('/') === 'shell', 'its face files come from shell/ (FACE_DIR)', 'FACE_DIR is ' + (dir ? path.relative(RUN, dir) : 'not found in the source'));

test.subHeading('the addresses it serves');
// goal/G41.19: /spirit.js, face.html's one script tag, from the run root.
const WANT = ['/spirit.js', '/shell.css', '/shell/boot.js', '/shell/seal.js', '/shell/face.css', '/shell/favicon.svg', '/shell/login/login.js', '/shell/login/login.json'];
const keys = map ? Object.keys(map).sort() : [];
ok(map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort()), 'its map serves exactly ' + WANT.join(', '), 'its map serves ' + JSON.stringify(keys));
const old = keys.filter(function (k) { return k.indexOf('/face/') === 0; });
ok(map && !old.length, 'no address under /face/ serves a file any more', 'old addresses still served: ' + JSON.stringify(old));
const missing = map && dir ? keys.filter(function (k) { return !fs.existsSync(path.join(dir, map[k])); }) : keys;
ok(map && dir && !missing.length, 'every file the map names is there', 'files not there: ' + JSON.stringify(missing.map(function (k) { return k + ' -> ' + (map ? map[k] : '?'); })));
const named = map && dir ? keys.every(function (k) { return path.posix.join('/shell', map[k]).replace('/shell/../', '/') === k || (k === '/shell.css' && map[k] === '../shell.css'); }) : false;
ok(named, 'each address names the moved file under the same name', 'an address and its file differ: ' + JSON.stringify(map));

// goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": the relay hands face.html and spirit.js over as they are on
// disk. Its faceSend is lifted out of the source and run on the real files.
test.subHeading('face.html and spirit.js, as they are on disk');
const sendSrc = (/^function faceSend\(res, status, file\) \{[\s\S]*?\r?\n\}\r?\n/m.exec(src) || [])[0];
const typesSrc = (/^const FACE_TYPES = (\{.*\});\r?$/m.exec(src) || [])[1];
let faceSend = null;
try { faceSend = sendSrc && typesSrc ? new Function('fs', 'path', 'FACE_DIR', 'FACE_TYPES', sendSrc + '\nreturn faceSend;')(fs, path, dir, new Function('return ' + typesSrc + ';')()) : null; } catch (e) { faceSend = null; }
function sent(file) {
  return new Promise(function (resolve) {
    const res = { writeHead: function () {}, setHeader: function () {}, end: function (b) { resolve(Buffer.from(b || '')); } };
    if (!faceSend) resolve(null); else faceSend(res, 200, file);
  });
}
Promise.all([sent('../face.html'), sent(map && map['/spirit.js'] || '../spirit.js')]).then(function (got) {
  ok(got[0] && got[0].equals(fs.readFileSync(path.join(RUN, 'face.html'))), 'the relay serves face.html byte for byte as it is on disk', 'the relay serves face.html changed, or its faceSend was not found');
  ok(got[1] && got[1].equals(fs.readFileSync(path.join(RUN, 'spirit.js'))), 'the relay serves /spirit.js, the run root\'s, byte for byte', 'the relay does not serve the run root\'s spirit.js as it is');
  test.reportSuccessFailureCount();
});
