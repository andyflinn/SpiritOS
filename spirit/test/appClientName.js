'use strict';

// spirit/test/appClientName.js
// THE NODE'S SIDE IS THE CLIENT — appPair/G1.1, written FIRST, red on the old name.
//
//   Andy, 2026-09-28: "first. we need to rename appServer to appClient. that
//   was a misnomer" — in the face-to-appServer chain the node is the one
//   asking. His yes on the rename: "my yes is hereby delivered". The verb
//   api.toLocalApp keeps its name ("not stuck on any name, keep it").

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

test.startTest('appPair/G1.1: the node side is renamed appClient.js');

const OWED = 'OWED by appPair/G1.1: ';
const SPIRIT = path.join(__dirname, '..');
// Spelled in two halves, so this file never counts itself.
const OLD = 'app' + 'Servers';

test.subHeading('T1: js/appClient.js exists and the old file does not');
const client = fs.existsSync(path.join(SPIRIT, 'run', 'js', 'appClient.js'));
const old = fs.existsSync(path.join(SPIRIT, 'run', 'js', OLD + '.js'));
if (client && !old) test.check('js/appClient.js is there, the old name is gone');
else test.fail(OWED + 'appClient.js ' + client + ', ' + OLD + '.js ' + old);

test.subHeading('T2: no ' + OLD + ' identifier is left in spirit/run or spirit/test');
// Desk's log records conversation, not code, and may name anything. So does process/js/desk/currentGoal.json, the
// desk's record of the goal in his and the agents' words (goal/G4.19, issue 7: "the two guards that trip on
// currentGoal.json skip that file").
const SKIP = /[\\/](node_modules|relay-state|app-state)[\\/]|[\\/]app[\\/]desk[\\/](log|voice)[\\/]|[\\/]process[\\/]js[\\/]desk[\\/]currentGoal\.json[\\/]$/;
const hits = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p + path.sep)) return;
    if (e.isDirectory()) return walk(p);
    if (!/\.(js|json|html|md)$/.test(e.name)) return;
    if (new RegExp('\\b' + OLD + '\\b').test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(SPIRIT, p));
  });
}(path.join(SPIRIT, 'run')));
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return;
    if (/\.js$/.test(e.name) && new RegExp('\\b' + OLD + '\\b').test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(SPIRIT, p));
  });
}(path.join(SPIRIT, 'test')));
if (!hits.length) test.check('no file under spirit/run or spirit/test names ' + OLD);
else test.fail(OWED + OLD + ' still named in ' + hits.join(', '));

test.subHeading('T3: its suite runs under the new name');
const suiteNew = fs.existsSync(path.join(SPIRIT, 'test', 'appClient.js'));
const suiteOld = fs.existsSync(path.join(SPIRIT, 'test', OLD + '.js'));
if (suiteNew && !suiteOld) test.check('test/appClient.js is the suite; the harness runs it');
else test.fail(OWED + 'test/appClient.js ' + suiteNew + ', test/' + OLD + '.js ' + suiteOld);

test.reportSuccessFailureCount();
