'use strict';

// spirit/run/spirit/app.js
// THE app FAMILY'S CORE MODULE (goal/G43.2). Andy, box: "we build a skeleton core-api-family, not a separate server,
// precisely the OLD way, the new family is called "app"", and "it provides a probabilitySearch, over the list of it's
// "plugin" modules". Its contract and its test: ./test/app.md and ./test/app.js.
//
//   createApp({ rootDir, jobs }) -> { search(body), active(body) }
//     search({ q })   the plugins the words fit, best first, as { key: the folder's name, label: the row as JSON }; no
//                     words is every plugin. "it's minimum, no filters, just a search string."
//     active({ key, active })  sets a plugin's active in spirit/state/<key>/node.json, and publishes the rows. It only writes.
//                     A key that is no plugin is refused, so no path can be written through it (goal/G43.9).
//
// A PLUGIN IS A FOLDER WITH ITS OWN <name>/<name>.json (Andy, G43.1's box: "the new "default" pattern in that module is:
// /<name>/<name>.json"), read from the disk at each search, so no list names one. appSelector/ and test/ are no plugins.
//
// WHO PAINTS, LISTENS (Andy, G41.32): the permanent job 'apps' holds every plugin's row, { apps: { key: row } }, published
// whole as a plugin's file changes, so a connect's snapshot is the whole push a cache forgets for (spirit/data.js's forget).
// The fs watcher hears the disk; nothing here watches it again. A face with no star keeps today's stream (goal/G41.33), so
// it hears no such job: it asks again when a connect forgets (./app/appSelector/listElement.js).

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

  // A plugin's row, or null when the folder has no file of its own, or one that says nothing readable.
  function rowOf(name) {
    let identity = null;
    try { identity = JSON.parse(fs.readFileSync(path.join(folder, name, name + '.json'), 'utf8')).identity; } catch (e) { return null; }
    const i = identity && typeof identity === 'object' ? identity : {};
    return { key: name, label: String(i.label || name), icon: String(i.icon || ''), active: stateOf(name).active === true };
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
  function active(body) {
    const key = String((body && body.key) || '');
    if (names().indexOf(key) === -1 || !rowOf(key)) return { ok: false, status: 404, code: 'not-found', error: 'no app ' + key };
    const state = stateOf(key);
    state.active = !!(body && body.active === true);
    fs.mkdirSync(path.dirname(stateFile(key)), { recursive: true });
    fs.writeFileSync(stateFile(key), JSON.stringify(state, null, 2) + '\n');
    publish();
    return { ok: true, status: 200 };
  }
  if (o.jobs) {
    const job = o.jobs.createJob('permanent', 'apps', { apps: table() });
    publish = function () { o.jobs.updateJob(job.id, { data: { apps: table() } }); };
    o.jobs.events.on('job-updated', function (j) {
      const command = j && j.type === 'fs-watcher' && j.data ? j.data.command : null;
      if (!command || !command.path || !PLUGIN_PATH.test(String(command.path).replace(/\\/g, '/'))) return;
      try { o.jobs.updateJob(job.id, { data: { apps: table() } }); } catch (e) { /* the next change publishes again */ }
    });
  }

  return { search: search, active: active };
}

module.exports = { createApp: createApp };
