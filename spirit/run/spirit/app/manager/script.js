'use strict';
require('../../script.js');

// spirit/run/spirit/app/manager/script.js
// THE app FAMILY'S CORE MODULE (goal/G43.2). Andy, box: "we build a skeleton core-api-family, not a separate server,
// precisely the OLD way, the new family is called "app"", and "it provides a probabilitySearch, over the list of it's
// "plugin" modules". Its contract and its test: ./test/app.md and ./test/app.js.
//
//   createApp({ rootDir, jobs }) -> { search(body), active(body), label(body), icon(body) }
//     search({ q })   the plugins the words fit, best first, as { key: the folder's path in dots (spirit.app.desk), label: the
//                     row as JSON }; no words is every plugin. "it's minimum, no filters, just a search string."
//     active({ key, active })  sets a plugin's active in node.json in its state folder (spirit.statePath of its folder),
//                     publishes the rows, and the node starts or
//                     stops its server, if it has one (goal/G43.12).
//                     A key that is no plugin is refused, so no path can be written through it (goal/G43.9).
//     label({ key, label }), icon({ key, icon })  the same, for its label and its icon. <name>.json gives the default,
//                     node.json overrides it, and none writes <name>.json (Q4: "yes.", Q6: "that would apply to all changes").
//                     Whether it may mount as shell is its <name>.json's alone (goal/G43.18, Q10: app.shell went).
//
// A PLUGIN IS A FOLDER WITH ITS OWN <name>/<name>.json (Andy, G43.1's box: "the new "default" pattern in that module is:
// /<name>/<name>.json"), read from the disk at each search, so no list names one. test/, the app branch's own tests, is no plugin.
//
// WHO PAINTS, LISTENS (Andy, G41.32): the permanent job 'apps' holds every plugin's row, { apps: { key: row } }, published
// whole as a plugin's file changes, so a connect's snapshot is the whole push a cache forgets for (spirit/data/script.js's forget).
// The fs watcher hears the disk; nothing here watches it again. A face with no star keeps today's stream (goal/G41.33), so
// it hears no such job: it asks again when a connect forgets (./element/search/app/rowFormAppActive.js).

const fs = require('fs');
const path = require('path');
const limits = spirit.requireScript('spirit/limits/script.js');
const probabilityStringObjectMatch = spirit.requireScript('spirit/search/object.js').probabilityStringObjectMatch;
const createProbabilityBucket = spirit.requireScript('spirit/listLimiter/script.js').createProbabilityBucket;

const ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ ok: true, items: [], more: false }), 'utf8');
// A plugin's own manifest, or its folder: what changes the table. A folder is a plugin by the fs cache's app flag
// (spirit/fs/filter/app/script.js: dir/<its own name>.json), anywhere in the tree (goal/G49.19).
function isManifest(p) { const parts = String(p).split('/'); return parts.length > 1 && parts[parts.length - 1] === parts[parts.length - 2] + '.json'; }

// goal/G43.6, Andy, box: "spirit.app also holds the family's verb, search, so no app may take the name of a verb."
// The branch's interface through spirit.requireScript (goal/G43.32; since goal/G49.20 spirit/app/script.js, a branch of the new
// shape): in node placed at once at its folder's own name, spirit.required.spirit.app, the verbs read from there; the binding it
// also starts asks this node, which this file needs nothing of.
Promise.resolve(spirit.requireScript('spirit/app/script.js')).then(null, function () { /* the binding; the verbs are read below */ });
const VERBS = spirit.required.spirit.app.verbs;

function tree() { return spirit.requireScript('spirit/fs/dataset/script.js'); }
// AN APP IS KNOWN BY ITS FOLDER'S PATH (goal/G49.19, box: "ALL aspects of jobs/processes identify them by the full path of
// their branch, whereever they may be mounted"; "all translation from name to path or back is NOT PERMITTED"): its key is
// that path in dots, spirit.app.desk, the name it has on the wire; its folder, its manifest and its state follow from the path.
function idOf(dir) { return spirit.dottedPath(dir); }
function baseOf(dir) { const d = String(dir); return d.slice(d.lastIndexOf('/') + 1); }

function createApp(opts) {
  const o = opts || {};
  // goal/G43's box: "the file ... node.json belongs to the node". No file is not active: "must be set to true by the user".
  // In its state folder by spirit.statePath (goal/G49.17): spirit/state/app/desk/node.json for spirit/app/desk.
  function stateFile(dir) { return path.join(o.rootDir, ...spirit.statePath(dir).split('/'), 'node.json'); }
  function stateOf(dir) {
    try { const s = JSON.parse(fs.readFileSync(stateFile(dir), 'utf8')); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
  }

  // node.run, and neither node.mount nor shell.mount: an app that is started by Run and ends, with no face and no server to switch on.
  function runOnly(own) {
    return !!(own && own.node && own.node.run === true && own.node.mount !== true && !(own.shell && own.shell.mount === true));
  }
  // A plugin's row, or null when the folder has no file of its own, or one that says nothing readable.
  function rowOf(dir) {
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(o.rootDir, ...dir.split('/'), baseOf(dir) + '.json'), 'utf8')); } catch (e) { return null; }
    const i = own && own.identity && typeof own.identity === 'object' ? own.identity : {};
    const s = stateOf(dir);
    // AN INTRINSIC APP IS ALWAYS ACTIVE (goal/G43.14; Andy, Q1: "intrinsic apps will be always on."), whatever node.json says.
    return { key: idOf(dir), label: String(s.label || i.label || baseOf(dir)), icon: String(s.icon || i.icon || ''), active: i.intrinsic === true || s.active === true, intrinsic: i.intrinsic === true,
      // WHETHER IT RUNS ON THE NODE (goal/G43.18, Q6, Andy: "yes."): its <name>.json's node.mount, for the app search's server filter.
      nodeMount: !!(own && own.node && own.node.mount === true),
      // WHETHER IT TAKES CLIENT MODE (goal/G49.8, box v3; Andy: "node:remote is a new manifest entry"): false only where its
      // <name>.json's node.remote is false, so the shell draws no remote in its title bar and its server refuses remote.
      nodeRemote: !(own && own.node && own.node.remote === false),
      // RUN, NOT MOUNTED (goal/G43.21; Andy, the box: "spirit app search will list these jobs (node:run) only in pane mode", "the
      // app detail will show a run button."): its <name>.json's node.run.
      run: !!(own && own.node && own.node.run === true),
      // ONLY RUN, NOTHING TO ACTIVATE (goal/G43.21; Andy: "an app that only has node:run and no node:mount or shell:mount cannot be
      // "activated"", "and the node should know it, too."): its rows and the node both read it here.
      runOnly: runOnly(own),
      // A FACE ON THE SHELL (goal/G43.20; Andy: "MAKE SURE aN APP WITHOUT shell:mount NEVER SHOWS A FUCKING TILE!"): its <name>.json's shell.mount, the one thing
      // that gives it a tile.
      shellMount: !!(own && own.shell && own.shell.mount === true),
      // A FAMILY OF ITS OWN (goal/G43.27; Andy: "an app must have an api.js"): its folder's api.js is there, so a page finds its
      // data.js beside it. goal/G49.2, Q1 (Andy: "sure, retrofit that"): the folder's own api flag in the dataset.
      api: ((tree().file(dir) || {}).api) === true };
  }
  // THE APP FOLDERS FROM THE ONE FS DATASET, NEVER FROM THE DISC (goal/G49.2; goal/G49.19): every folder the dataset flags app,
  // wherever it stands. One directly in spirit/app/ may not take a verb's name (goal/G43.6).
  function dirs() {
    const files = tree().files();
    return Object.keys(files).filter(function (p) {
      if (files[p].kind !== 'folder' || files[p].app !== true) return false;
      return !(p.indexOf('spirit/app/') === 0 && p.split('/').length === 3 && VERBS[baseOf(p)]);
    }).sort();
  }
  // The folder of an app by its key: the one app folder whose path in dots is the key; '' for none.
  function dirOf(key) { const k = String(key || ''); return dirs().filter(function (d) { return idOf(d) === k; })[0] || ''; }

  function search(body) {
    const q = String((body && body.q) || '').trim();
    const bucket = createProbabilityBucket(Infinity);
    dirs().forEach(function (dir) {
      const row = rowOf(dir);
      if (!row) return;
      const p = q ? probabilityStringObjectMatch(q, row) : 0;
      if (q && !(p > 0)) return;
      bucket.seatFor(p, { key: row.key, label: JSON.stringify(row) });
    });
    const r = bucket.serialize(null, ROOM);
    return { ok: true, status: 200, items: r.items, more: !!r.more };
  }

  function table() {
    const all = {};
    dirs().forEach(function (dir) { const row = rowOf(dir); if (row) all[row.key] = row; });
    return all;
  }
  let publish = function () {};
  function write(body, change) {
    const key = String((body && body.key) || '');
    const dir = dirOf(key);
    if (!dir || !rowOf(dir)) return { ok: false, status: 404, code: 'not-found', error: 'no app ' + key };
    const state = Object.assign(stateOf(dir), change);
    fs.mkdirSync(path.dirname(stateFile(dir)), { recursive: true });
    fs.writeFileSync(stateFile(dir), JSON.stringify(state, null, 2) + '\n');
    publish();
    // active starts and stops its server (goal/G43.12).
    if (o.jobs && typeof o.jobs.followApp === 'function') o.jobs.followApp(o.rootDir, dir);
    return { ok: true, status: 200 };
  }
  // Andy: "on first activate, spirit/state/<name>/node.json should be initialized with the values from spirit/app/<name>/<name>.json",
  // so a first activate writes active, label and icon (the shell field went with goal/G43.18, Q10). What the node already
  // chose stays.
  function active(body) {
    const on = !!(body && body.active === true);
    const key = String((body && body.key) || '');
    // Its development team made it intrinsic, so no press switches it, and nothing is written for it (goal/G43.14). Refused by
    // name (goal/G43.15; Andy: "And what's even worse, the server allows it!!!!").
    const dir = dirOf(key);
    if (dir && spirit.requireScript('spirit/coreFiles/script.js').appIntrinsic(path.resolve(o.rootDir, '..', '..'), dir) === true) {
      return { ok: false, status: 409, code: 'app-intrinsic', error: 'app ' + key + ' is intrinsic: it is always active' };
    }
    // ONE THAT IS ONLY RUN HAS NOTHING TO ACTIVATE (goal/G43.21; Andy: "and the node should know it, too."): refused by name, and
    // nothing is written, the page's hidden row notwithstanding.
    if (dir && (rowOf(dir) || {}).runOnly === true) {
      return { ok: false, status: 409, code: 'app-run-only', error: 'app ' + key + ' is only run: it has nothing to activate' };
    }
    const row = on && dir ? rowOf(dir) : null;
    return write(body, row ? { active: true, label: row.label, icon: row.icon } : { active: on });
  }
  function label(body) { return write(body, { label: String((body && body.label) || '') }); }
  function icon(body) { return write(body, { icon: String((body && body.icon) || '') }); }
  if (o.jobs) {
    // THE APP LIST IS NEWS OF spirit.app (goal/G43.20, Q2): each event { apps }, nothing else in it.
    publish = function () { o.jobs.ownNews('spirit.app', 'apps', { apps: table() }); };
    publish();
    o.jobs.events.on('job-updated', function (j) {
      const command = j && j.id === 'spirit.fs' && j.data ? j.data.command : null;
      if (!command || !command.path) return;
      const p = String(command.path).replace(/\\/g, '/');
      if (!isManifest(p) && !(tree().file(p) || {}).app) return;
      try { publish(); } catch (e) { /* the next change publishes again */ }
    });
  }

  return { search: search, active: active, label: label, icon: icon };
}

module.exports = { createApp: createApp };
