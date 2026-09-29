'use strict';

// spirit/run/js/shellMove.js
// A NODE CARRIES ITS OWN FILES FROM app/ INTO shell/ — slim/G1.1.
//
//   Andy, 2026-09-29: "shell replaces app", with the shell's own CSS at its
//   top. The rename is a git mv, and git moves only what it tracks. What a
//   live node keeps in app/ is gitignored (natter's relays, contacts'
//   files, appFaceApp's grants, fixList's fixes, the AI status), so a pull
//   leaves it behind in app/, where nothing reads it any more.
//
// So at start, before anything reads shell/, every file still in app/ moves
// to the same place under shell/, once, and each move is said. A file whose
// name shell/ already holds is KEPT where it is and said, never written over:
// the one in shell/ is the newer. Once app/ is empty it goes, and later
// starts find nothing to do and say nothing.

const fs = require('fs');
const path = require('path');

// Where the shell lived before slim/G1.1; read here and nowhere else.
const LEGACY_APP_DIR = 'app';

function filesUnder(dir) {
  const out = [];
  (function walk(d, rel) {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else out.push(r);
    });
  })(dir, '');
  return out.sort();
}
function removeEmptyDirs(dir) {
  let es = [];
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  es.forEach(function (e) { if (e.isDirectory()) removeEmptyDirs(path.join(dir, e.name)); });
  try { if (!fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch (e) { /* not empty, or gone */ }
}

function moveLeftovers(rootDir, say) {
  const tell = typeof say === 'function' ? say : function (line) { console.log(line); };
  const from = path.join(rootDir, LEGACY_APP_DIR);
  const to = path.join(rootDir, 'shell');
  if (!fs.existsSync(from)) return { moved: [], kept: [] };
  const moved = [];
  const kept = [];
  filesUnder(from).forEach(function (rel) {
    const src = path.join(from, ...rel.split('/'));
    const dest = path.join(to, ...rel.split('/'));
    if (fs.existsSync(dest)) {
      kept.push(rel);
      tell('shell: kept app/' + rel + ' where it is: shell/' + rel + ' already exists');
      return;
    }
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      moved.push(rel);
      tell('shell: moved app/' + rel + ' to shell/' + rel);
    } catch (e) {
      kept.push(rel);
      tell('shell: could not move app/' + rel + ': ' + ((e && e.message) || e));
    }
  });
  removeEmptyDirs(from);
  return { moved: moved, kept: kept };
}

module.exports = { moveLeftovers: moveLeftovers, LEGACY_APP_DIR: LEGACY_APP_DIR };
