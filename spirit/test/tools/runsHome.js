'use strict';

// spirit/test/tools/runsHome.js
// A test node runs a server (goal/G30.20): where a module runs is its manifest's runs, so a suite that wants one of
// its scratch node's servers started writes 'home' into that manifest. It replaces includeList.add, deleted with the
// include list. Never the tree's own manifests: a scratch node whose folder is the checkout's spirit/run is refused,
// unless its manifest already says home.
//
//   runsHome(root, 'process/js/desk')

const fs = require('fs');
const path = require('path');

const TREE = fs.realpathSync(path.join(__dirname, '..', '..', 'run'));

module.exports = function runsHome(root, modulePath) {
  const name = String(modulePath).split('/').pop();
  const file = path.join(root, modulePath, name + '.json');
  let m = {};
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { m = {}; }
  if (Array.isArray(m.runs) && m.runs.indexOf('home') !== -1) return;
  let real = file;
  try { real = fs.realpathSync(file); } catch (e) { real = path.resolve(file); }
  if (real.indexOf(TREE + path.sep) === 0) throw new Error('runsHome: ' + modulePath + ' is the tree\'s own manifest; a suite never edits it');
  m.runs = ['home'];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
};
