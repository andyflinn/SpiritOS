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
const WANT = ['/shell.css', '/shell/boot.js', '/shell/seal.js', '/shell/face.css', '/shell/favicon.svg', '/shell/login/login.js', '/shell/login/login.json'];
const keys = map ? Object.keys(map).sort() : [];
ok(map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort()), 'its map serves exactly ' + WANT.join(', '), 'its map serves ' + JSON.stringify(keys));
const old = keys.filter(function (k) { return k.indexOf('/face/') === 0; });
ok(map && !old.length, 'no address under /face/ serves a file any more', 'old addresses still served: ' + JSON.stringify(old));
const missing = map && dir ? keys.filter(function (k) { return !fs.existsSync(path.join(dir, map[k])); }) : keys;
ok(map && dir && !missing.length, 'every file the map names is there', 'files not there: ' + JSON.stringify(missing.map(function (k) { return k + ' -> ' + (map ? map[k] : '?'); })));
const named = map && dir ? keys.every(function (k) { return path.posix.join('/shell', map[k]).replace('/shell/../', '/') === k || (k === '/shell.css' && map[k] === '../shell.css'); }) : false;
ok(named, 'each address names the moved file under the same name', 'an address and its file differ: ' + JSON.stringify(map));

test.reportSuccessFailureCount();
