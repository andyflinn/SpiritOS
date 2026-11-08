'use strict';

// spirit/run/spirit/app.js
// THE app FAMILY'S CORE MODULE (goal/G43.2). Andy, box: "we build a skeleton core-api-family, not a separate server,
// precisely the OLD way, the new family is called "app"", and "it provides a probabilitySearch, over the list of it's
// "plugin" modules". Its contract and its test: ./test/app.md and ./test/app.js.
//
//   createApp({ rootDir, jobs }) -> { search(body), active(body), label(body), icon(body) }
//     search({ q })   the plugins the words fit, best first, as { key: the folder's name, label: the row as JSON }; no
//                     words is every plugin. "it's minimum, no filters, just a search string."
//     active({ key, active })  sets a plugin's active in spirit/state/<key>/node.json, publishes the rows, and the node starts or
//                     stops its server, if it has one (goal/G43.12).
//                     A key that is no plugin is refused, so no path can be written through it (goal/G43.9).
//     label({ key, label }), icon({ key, icon })  the same, for its label and its icon. <name>.json gives the default,
//                     node.json overrides it, and none writes <name>.json (Q4: "yes.", Q6: "that would apply to all changes").
//                     Whether it may mount as shell is its <name>.json's alone (goal/G43.18, Q10: app.shell went).
//
// A PLUGIN IS A FOLDER WITH ITS OWN <name>/<name>.json (Andy, G43.1's box: "the new "default" pattern in that module is:
// /<name>/<name>.json"), read from the disk at each search, so no list names one. appSelector/ and test/ are no plugins.
//
// WHO PAINTS, LISTENS (Andy, G41.32): the permanent job 'apps' holds every plugin's row, { apps: { key: row } }, published
// whole as a plugin's file changes, so a connect's snapshot is the whole push a cache forgets for (spirit/data.js's forget).
// The fs watcher hears the disk; nothing here watches it again. A face with no star keeps today's stream (goal/G41.33), so
// it hears no such job: it asks again when a connect forgets (./app/appSelector/rowFormAppActive.js).

const fs = require('fs');
const path = require('path');
const limits = require('./limits');
const probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
const createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;

const ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ ok: true, items: [], more: false }), 'utf8');
// A plugin's own file, or its folder: what changes the table.
const PLUGIN_PATH = /^spirit\/app\/([^/]+)(\/\1\.json)?$/;

// goal/G43.6, Andy, box: "spirit.app also holds the family's verb, search, so no app may take the name of a verb."
const VERBS = require('./app/api.js').verbs;

function createApp(opts) {
  const o = opts || {};
  const folder = path.join(o.rootDir, 'spirit', 'app');
  // goal/G43's box: "the file "repo://spirit/run/spirit/state/<name>/node.json" belongs to the node". No file is not active:
  // "must be set to true by the user".
  function stateFile(name) { return path.join(o.rootDir, 'spirit', 'state', name, 'node.json'); }
  function stateOf(name) {
    try { const s = JSON.parse(fs.readFileSync(stateFile(name), 'utf8')); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
  }

  // node.run, and neither node.mount nor shell.mount: an app that is started by Run and ends, with no face and no server to switch on.
  function runOnly(own) {
    return !!(own && own.node && own.node.run === true && own.node.mount !== true && !(own.shell && own.shell.mount === true));
  }
  // A plugin's row, or null when the folder has no file of its own, or one that says nothing readable.
  function rowOf(name) {
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(folder, name, name + '.json'), 'utf8')); } catch (e) { return null; }
    const i = own && own.identity && typeof own.identity === 'object' ? own.identity : {};
    const s = stateOf(name);
    // A SHELL BY ITS OWN <name>.json ALONE (goal/G43.18, box v29, Q10: the Allow row and app.shell went, "and the shell field it
    // writes into node.json"): no choice of the node's stands over it.
    const asShell = !!(own && own.shell && own.shell.true === true);
    // AN INTRINSIC APP IS ALWAYS ACTIVE (goal/G43.14; Andy, Q1: "intrinsic apps will be always on."), whatever node.json says.
    return { key: name, label: String(s.label || i.label || name), icon: String(s.icon || i.icon || ''), active: i.intrinsic === true || s.active === true, shell: asShell, intrinsic: i.intrinsic === true,
      // WHETHER IT RUNS ON THE NODE (goal/G43.18, Q6, Andy: "yes."): its <name>.json's node.mount, for the app search's server filter.
      nodeMount: !!(own && own.node && own.node.mount === true),
      // RUN, NOT MOUNTED (goal/G43.21; Andy, the box: "spirit app search will list these jobs (node:run) only in pane mode", "the
      // app detail will show a run button."): its <name>.json's node.run.
      run: !!(own && own.node && own.node.run === true),
      // ONLY RUN, NOTHING TO ACTIVATE (goal/G43.21; Andy: "an app that only has node:run and no node:mount or shell:mount cannot be
      // "activated"", "and the node should know it, too."): its rows and the node both read it here.
      runOnly: runOnly(own),
      // A FAMILY OF ITS OWN (goal/G43.27; Andy: "an app must have an api.js"): spirit/app/<name>/api.js is there, so a page
      // finds its data.js beside it; an app without one leaves the name to the system's spirit/<name>/.
      api: fs.existsSync(path.join(folder, name, 'api.js')) };
  }
  function names() {
    try {
      return fs.readdirSync(folder, { withFileTypes: true }).filter(function (d) { return d.isDirectory() && !VERBS[d.name]; }).map(function (d) { return d.name; });
    } catch (e) { return []; }
  }

  function search(body) {
    const q = String((body && body.q) || '').trim();
    const bucket = createProbabilityBucket(Infinity);
    names().forEach(function (name) {
      const row = rowOf(name);
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
    names().forEach(function (name) { const row = rowOf(name); if (row) all[name] = row; });
    return all;
  }
  let publish = function () {};
  function write(body, change) {
    const key = String((body && body.key) || '');
    if (names().indexOf(key) === -1 || !rowOf(key)) return { ok: false, status: 404, code: 'not-found', error: 'no app ' + key };
    const state = Object.assign(stateOf(key), change);
    fs.mkdirSync(path.dirname(stateFile(key)), { recursive: true });
    fs.writeFileSync(stateFile(key), JSON.stringify(state, null, 2) + '\n');
    publish();
    // active starts and stops its server (goal/G43.12).
    if (o.jobs && typeof o.jobs.followApp === 'function') o.jobs.followApp(o.rootDir, key);
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
    if (require('./coreFiles').appIntrinsic(path.resolve(o.rootDir, '..', '..'), key) === true && names().indexOf(key) !== -1) {
      return { ok: false, status: 409, code: 'app-intrinsic', error: 'app ' + key + ' is intrinsic: it is always active' };
    }
    // ONE THAT IS ONLY RUN HAS NOTHING TO ACTIVATE (goal/G43.21; Andy: "and the node should know it, too."): refused by name, and
    // nothing is written, the page's hidden row notwithstanding.
    if (names().indexOf(key) !== -1 && (rowOf(key) || {}).runOnly === true) {
      return { ok: false, status: 409, code: 'app-run-only', error: 'app ' + key + ' is only run: it has nothing to activate' };
    }
    const row = on && names().indexOf(key) !== -1 ? rowOf(key) : null;
    return write(body, row ? { active: true, label: row.label, icon: row.icon } : { active: on });
  }
  function label(body) { return write(body, { label: String((body && body.label) || '') }); }
  function icon(body) { return write(body, { icon: String((body && body.icon) || '') }); }
  if (o.jobs) {
    const job = o.jobs.createJob('permanent', 'apps', { apps: table() });
    publish = function () { o.jobs.updateJob(job.id, { data: { apps: table() } }); };
    o.jobs.events.on('job-updated', function (j) {
      const command = j && j.type === 'fs-watcher' && j.data ? j.data.command : null;
      if (!command || !command.path || !PLUGIN_PATH.test(String(command.path).replace(/\\/g, '/'))) return;
      try { o.jobs.updateJob(job.id, { data: { apps: table() } }); } catch (e) { /* the next change publishes again */ }
    });
  }

  return { search: search, active: active, label: label, icon: icon };
}

module.exports = { createApp: createApp };
