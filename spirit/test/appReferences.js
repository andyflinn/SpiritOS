'use strict';

// spirit/test/appReferences.js
// EVERY APP NAMED SOMEWHERE IS AN APP THAT EXISTS.
//
// ── WHY ──────────────────────────────────────────────────────────────
//
// Decision 0008 deleted App Builder and Type Designer. Four places named
// them: two blocks in preferences.json, and two api.addTitlebarLink
// calls in AI Manager.
//
// None of those four would have failed anything. addTitlebarLink returns
// early on an unknown app id, and renderTitlebarLinks skips it again on
// every repaint — so a link to a deleted app is a silent no-op, and a
// preference for one is a row nobody reads. That is the good kind of
// failure mode at runtime and the bad kind for a tree: nothing goes red,
// nothing gets cleaned up, and the next reader believes the app is still
// there because the code still says so.
//
// So this is not a crash guard. It is a guard against the tree telling
// lies about itself, and it catches the NEXT deletion rather than this
// one — which is the only kind of check worth writing after the fact.
//
// ── FALSE NEGATIVES ONLY ─────────────────────────────────────────────
//
// A folder is matched by an exact literal — 'app/<name>' in a quoted
// string, or an "app/<name>" key. Anything assembled at runtime
// ('app/' + folder, which declareIntrinsicApps does) is invisible here.
// That is deliberate: a scanner that guessed at concatenation would
// invent app names out of string fragments, and one false accusation
// costs more than several missed ones.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_DIR = path.join(RUN_DIR, 'app');

test.startTest('App references — nothing names an app that is not there');

// AN APP IS ITS ENTRY SCRIPT, not its directory — which is the same
// definition every consumer already uses: discoverDynamicApps looks for
// app/<name>/<name>.js, and declareIntrinsicApps reads the manifest
// beside it. A folder with neither registers nothing and appears nowhere.
//
// The distinction is not academic. Deleting App Builder removed its code
// and left app/appBuilder/log.jsonl behind — 264KB of somebody's own
// generated history, which is theirs and not the repo's to sweep up. A
// check that counted directories would have called that app "still
// present" for as long as the data survived, which is a check reporting
// on the wrong thing.
function appFolders() {
  return fs.readdirSync(APP_DIR, { withFileTypes: true })
    .filter(function (e) { return e.isDirectory(); })
    .filter(function (e) {
      return fs.existsSync(path.join(APP_DIR, e.name, e.name + '.js'));
    })
    .map(function (e) { return e.name; });
}

const folders = appFolders();
const known = Object.create(null);
folders.forEach(function (name) { known[name] = true; });

test.subHeading(folders.length + ' app folder(s) on disk');

// Where an app gets named. Each entry says where to read and how to
// pull the names out, so a failure can point at a file rather than at
// "somewhere".
const SOURCES = [
  {
    label: 'preferences.json (per-app settings and group membership)',
    file: path.join(RUN_DIR, 'preferences.json'),
  },
  {
    label: 'index.html (the Spirit group\'s fixed member list)',
    file: path.join(RUN_DIR, 'index.html'),
  },
  {
    label: 'shell.js (INTRINSIC_APP_FOLDERS and the app id renames)',
    file: path.join(RUN_DIR, 'js', 'client', 'shell.js'),
  },
];

// Every app's own entry script too — that is where addTitlebarLink lives.
folders.forEach(function (name) {
  const script = path.join(APP_DIR, name, name + '.js');
  if (fs.existsSync(script)) {
    SOURCES.push({ label: 'app/' + name + '/' + name + '.js', file: script });
  }
});

// 'app/<name>' inside quotes. The quote is what makes this a literal
// rather than a fragment of a concatenation.
const NAMED = /['"]app\/([A-Za-z0-9_-]+)['"]/g;

const dangling = [];

SOURCES.forEach(function (source) {
  let src = '';
  try { src = fs.readFileSync(source.file, 'utf8'); }
  catch (e) { return; }

  let match;
  const seen = Object.create(null);
  NAMED.lastIndex = 0;
  while ((match = NAMED.exec(src)) !== null) {
    const name = match[1];
    if (seen[name]) continue;
    seen[name] = true;
    if (!known[name]) dangling.push(source.label + ' names app/' + name + ', which is not on disk');
  }
});

if (!dangling.length) {
  test.check('every app named in preferences, the shell, index.html or an app script exists on disk');
} else {
  dangling.forEach(function (d) { test.fail(d); });
}

// INTRINSIC_APP_FOLDERS is a bare list of folder names rather than
// 'app/<name>' strings, so the scan above cannot see it — and it is the
// one list where a missing folder is not merely untidy: declareIntrinsicApps
// walks it on every boot.
(function intrinsicFoldersExist() {
  const shellSrc = fs.readFileSync(path.join(RUN_DIR, 'js', 'client', 'shell.js'), 'utf8');
  const found = shellSrc.match(/INTRINSIC_APP_FOLDERS\s*=\s*\[([^\]]*)\]/);
  if (!found) {
    test.fail('INTRINSIC_APP_FOLDERS could not be found in shell.js — this check needs updating with it');
    return;
  }
  const names = found[1].split(',')
    .map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); })
    .filter(Boolean);
  const missing = names.filter(function (n) { return !known[n]; });
  if (!missing.length) {
    test.check('all ' + names.length + ' intrinsic app folders exist — ' + names.join(', '));
  } else {
    test.fail('INTRINSIC_APP_FOLDERS names folders that are gone: ' + missing.join(', '));
  }
})();

// The two 0008 deleted, asserted by name. A general rule is worth more
// than a specific one, but a specific one says out loud what happened
// and stops either coming back by accident.
(function theTwoAreGone() {
  // "Gone" means no entry script and no manifest. Leftover app DATA in
  // those folders is the owner's and is deliberately not this suite's
  // business — see appFolders above.
  const gone = ['appBuilder', 'typeDesigner'].filter(function (n) {
    return fs.existsSync(path.join(APP_DIR, n, n + '.js')) ||
           fs.existsSync(path.join(APP_DIR, n, n + '.json'));
  });
  if (!gone.length) {
    test.check('App Builder and Type Designer are gone — decision 0008, app-building is out of scope');
  } else {
    test.fail('still present: ' + gone.join(', '));
  }
})();

// AND THE SCANNER IS NOT ASLEEP. Every check above passes against a
// scanner that reads nothing — a bad regex, an empty source list, a
// folder listing that came back short.
(function theScannerWorks() {
  const planted = "api.addTitlebarLink('app/appBuilder');";
  NAMED.lastIndex = 0;
  const hit = NAMED.exec(planted);
  if (hit && hit[1] === 'appBuilder' && !known.appBuilder && SOURCES.length > 5) {
    test.check('and the scanner catches the exact line that was in aiManager, across ' + SOURCES.length + ' real sources');
  } else {
    test.fail('the scanner failed its own probe (hit=' + JSON.stringify(hit && hit[1]) + ', sources=' + SOURCES.length + ')');
  }
})();

test.reportSuccessFailureCount();
