'use strict';

// spirit/run/spirit/app/agent/server/server.js
// THE AGENT SERVER (goal/G41.1): the server process behind the agent face app. It keeps all of the app's state, in
// agent.db, an SQLite database in the folder the node hands it as --state (spirit/state/agent/data/ on a node, goal/G43.10,
// never in git), and streams that state to its clients. Its contract and its test: ./server/test/server.md and ./server/test/server.js.
//
// NO AGENTS TALK TO EACH OTHER THROUGH IT (goal/G41.1, Q1, Andy: "the rules of this app will have no agents talking to
// each other either, each agent will see itself as the only agent/user of the node"; the ruling of 2026-10-02, goal/G3.1,
// stands). Nothing here carries one agent's words to another.
//
// NO DEBUG OF ITS OWN (goal/G43.15; Andy: "it belongs to the node, and should work like any other servers debug switch."):
// appServer's DEBUG switches it, the node keeps it across restarts, and its config.json and debug verb are gone.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../script.js');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = spirit.requireScript('spirit/server/app/script.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
if (!STATE) { console.error('agent: no --state; the node that starts a server names its state folder'); process.exit(2); }
fs.mkdirSync(STATE, { recursive: true });

// THE APP'S DATABASE, AND ITS DATA SET (goal/G41.4): the provider, model, persona and job tables, each with its own
// folder, table/<name>/, whose server.js makes the table and serves its one verb. Built in this order, since a model
// names its provider. NO GRANT TABLE (goal/G41.21, box v17: "agent.grant is removed altogether"; a job's grant is its
// bundle). No table made before is mended or dropped (Andy, goal/G47.1: "old files or tables should not be mended, THE
// SHOULD BE FUCKING KILLED AND ELIMINATED FOREVER!"); an old agent.db is deleted by hand, on his word.
const DB_FILE = path.join(STATE, 'agent.db');
const db = new DatabaseSync(DB_FILE);
const TABLES = ['provider', 'model', 'persona', 'job'];
const tables = {};
const ctx = { db: db, dbFile: DB_FILE, tables: tables, publish: function (x) { appServer.publish(x); } };
TABLES.forEach(function (name) { tables[name] = spirit.requireScript('spirit/app/agent/table/' + name + '/server.js')(ctx); });

const verbs = {};
TABLES.forEach(function (name) { verbs[name] = tables[name].verb; });

appServer.serve(verbs, {
  // provider-failed: a provider's ask that got no model list (goal/G41.18); its extra.why says what the provider did. A
  // code the server does not declare reaches the page as "the handler failed", the reason lost (found live).
  codes: { 'no-such-row': { status: 404, text: 'no such row' }, 'provider-failed': { status: 502, text: 'the provider gave no model list' } },
  // A PUBLISHER, ITS subscribe AND unsubscribe DECLARED IN ./api.js (goal/G43.32; Andy: "for now, it needs to declare them in
  // api.js"): agent moves toward being a client or a server, and a peer's agent subscribes here. Its rows also reach its own
  // pages on the node's job stream, appServer.publish's.
  // No branch named (goal/G47.5): each subscriber names its own, and appServer keeps it (clientListeners.json).
  publisher: { bootstrap: function () { return []; } },
});
