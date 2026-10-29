'use strict';

// spirit/run/process/js/agent/agent.js
// THE AGENT SERVER (goal/G41.1): the server process behind the agent face app. It keeps all of the app's state, in
// agent.db, an SQLite database in the folder the node hands it as --state (relay-state/process/agent/ on a node, never in
// git), and streams that state to its clients. In this item its state is its DEBUG state. Its contract and its test:
// ./test/agent.md and ./test/agent.js.
//
// NO AGENTS TALK TO EACH OTHER THROUGH IT (goal/G41.1, Q1, Andy: "the rules of this app will have no agents talking to
// each other either, each agent will see itself as the only agent/user of the node"; the ruling of 2026-10-02, goal/G3.1,
// stands). Nothing here carries one agent's words to another.
//
// agent.debug {on} MAINTAINS THE EXISTING DEBUG STATE (Q4, Andy: "the agent verb will simply maintain the existing debug
// state of the agent server", ".. and the agent persists that state across server restarts"): the one switch appServer's
// own DEBUG verb flips (spirit.debug), never a second one. It is kept in config.json there, read back at start, and
// streamed as { agent: { debug } }. There is no read verb (Q3): a page reads the state from the stream.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../spirit/appServer.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
if (!STATE) { console.error('agent: no --state; the node that starts a server names its state folder'); process.exit(2); }
fs.mkdirSync(STATE, { recursive: true });

// THE APP'S DATABASE, AND ITS DATA SET (goal/G41.4): the provider, model, persona, job and grant tables, each with its
// own folder, table/<name>/, whose server.js makes the table and serves its one verb. Built in this order, since a model
// names its provider and a grant its job.
const DB_FILE = path.join(STATE, 'agent.db');
const db = new DatabaseSync(DB_FILE);
db.exec('CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
const TABLES = ['provider', 'model', 'persona', 'job', 'grant'];
const tables = {};
const ctx = { db: db, dbFile: DB_FILE, tables: tables, publish: function (x) { appServer.publish(x); } };
TABLES.forEach(function (name) { tables[name] = require('./table/' + name + '/server.js')(ctx); });

// THE DEBUG STATE, across restarts: config.json is read at start, and written on every debug.
const CONFIG = path.join(STATE, 'config.json');
function readConfig() {
  try { const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); return c && typeof c === 'object' ? c : {}; } catch (e) { return {}; }
}
spirit.debug(readConfig().debug === true);

function stateOf() { return { agent: { debug: spirit.debug() === true } }; }

const verbs = {
  debug: {
    request: { on: false }, reply: { debug: false },
    accepts: function (a) { return !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 1 && typeof a.on === 'boolean'; },
    handler: function (a) {
      spirit.debug(a.on);
      const c = readConfig();
      c.debug = a.on;
      fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n', 'utf8');
      appServer.publish({ agent: { debug: a.on } });
      return { debug: a.on };
    },
  },
};
TABLES.forEach(function (name) { verbs[name] = tables[name].verb; });

appServer.serve(verbs, {
  // provider-failed: a provider's ask that got no model list (goal/G41.18); its extra.why says what the provider did. A
  // code the server does not declare reaches the page as "the handler failed", the reason lost (found live).
  codes: { 'no-such-row': { status: 404, text: 'no such row' }, 'provider-failed': { status: 502, text: 'the provider gave no model list' } },
  publisher: { family: 'agent', bootstrap: function () { return [stateOf()]; } },
});

// What a page opening now draws from: the state, once, on the server's job.
appServer.publish(stateOf());
