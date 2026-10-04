'use strict';

// The fs-watcher only speaks when the file list says something new.
//
// SINCE goal/G4.25 it sends no list at all: one tree command per change (fsWatcherCommands.js holds that contract).
// What this suite guards stays: rewriting a file that already exists changes nothing in the tree, so it is at most a
// changeFile, never a create or a delete, and the tree is as it was (the shell then redraws no Files tree for it).
//
// It watches rootDir recursively, and rootDir is where the running node
// keeps its own state: Relay Chat polls its inbox every two seconds and
// every poll rewrites relay-state/who.json. Each of those woke the
// watcher, which rescanned and emitted a job-updated carrying a file
// list byte-identical to the one before it — the payload holds name,
// parentPath, fullPath, relativePath and kind, no mtime and no size, so
// rewriting a file that already existed changes nothing in it.
//
// Everything downstream repainted on that: the Files tree rebuilt its
// markup every two seconds, and a <details> built fresh is a <details>
// that is closed, so folders collapsed under the user while they read.
//
// A real watcher on real files, because the thing under test is
// fs.watch's behaviour as much as the code around it. It runs in its own
// folder under spirit/run rather than in os.tmpdir(): scanFolder filters
// every file through fileServable, which canonicalizes against ROOT_DIR
// and refuses anything outside it, so a watcher rooted in a temp
// directory reports no files at all. Its own folder, and not the whole
// of spirit/run, so a dev server writing view.json next door cannot make
// this pass or fail.

const fs = require('fs');
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

const jobs = require('../run/js/jobs.js')(spirit, 65432);

test.startTest('The fs-watcher is quiet when nothing changed');

const home = path.join(__dirname, '..', 'run', 'fswatch-test');
fs.rmSync(home, { recursive: true, force: true });
fs.mkdirSync(path.join(home, 'state'), { recursive: true });
fs.writeFileSync(path.join(home, 'state', 'who.json'), '[{"publicKey":"KEY"}]');
fs.writeFileSync(path.join(home, 'note.txt'), 'hello');

// Long enough for fs.watch to deliver plus the 150ms rescan debounce.
const SETTLE_MS = 900;

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, SETTLE_MS); });
}

const job = jobs.startFsWatcherJob(home);

let updates = 0;
let treeMoves = 0;
jobs.events.on('job-updated', function (updated) {
  if (updated.id !== job.id) return;
  updates += 1;
  const c = updated.data && updated.data.command;
  if (c && c.op !== 'changeFile') treeMoves += 1;
});

// The watcher's tree, by name.
function listed() {
  return jobs.fsTreeEntries().map(function (f) { return f.name; });
}

function done() {
  if (job._stop) job._stop();
  fs.rmSync(home, { recursive: true, force: true });
  test.reportSuccessFailureCount();
}

settle().then(function () {
  // The watcher found what is there before anything is asked of it.
  const names = listed();
  if (names.indexOf('note.txt') !== -1 && names.indexOf('who.json') !== -1) {
    test.check('the first scan lists what is on disk, folders and all');
  } else {
    test.fail('first scan: ' + JSON.stringify(names));
  }

  updates = 0;
  treeMoves = 0;
  // What Relay Chat does every two seconds: the same file, written
  // again, with content of its own that this list cannot see.
  fs.writeFileSync(path.join(home, 'state', 'who.json'), '[{"publicKey":"KEY","seen":2}]');
  return settle();
}).then(function () {
  if (treeMoves === 0 && updates <= 2) {
    test.check('rewriting a file that already existed moves nothing in the tree (' + updates + ' changeFile, no create or delete)');
  } else {
    test.fail('a no-op rewrite emitted ' + updates + ' update(s), ' + treeMoves + ' of them create or delete');
  }

  // And the shortcut did not empty what had already been published.
  if (listed().indexOf('note.txt') !== -1) {
    test.check('and the tree it already held is still there');
  } else {
    test.fail('files after a quiet rescan: ' + JSON.stringify(listed()));
  }

  // A real change is still news — the whole point of the watcher.
  updates = 0;
  fs.writeFileSync(path.join(home, 'arrived.txt'), 'new');
  return settle();
}).then(function () {
  if (updates >= 1 && listed().indexOf('arrived.txt') !== -1) {
    test.check('a new file is announced, and is in the tree');
  } else {
    test.fail('after create: ' + updates + ' update(s), list ' + JSON.stringify(listed()));
  }

  // Deleting is a change too — a list that only ever grows would start
  // lying the moment anything is thrown away.
  updates = 0;
  fs.unlinkSync(path.join(home, 'arrived.txt'));
  return settle();
}).then(function () {
  if (updates >= 1 && listed().indexOf('arrived.txt') === -1) {
    test.check('and so is a file that went away');
  } else {
    test.fail('after delete: ' + updates + ' update(s), list ' + JSON.stringify(listed()));
  }
}).then(done).catch(function (err) {
  test.fail('threw: ' + ((err && err.stack) || err));
  done();
});
