'use strict';

// goal/G8.2: deskVerify knows where it runs, and only the desk node's copy keeps the record. Red on today's tree;
// wsl-claude wrote it from G8.2's box and does not build it.
//   Andy, 2026-10-09: "The agent node should have it. but only to assess if it can consider it's coding task done. no
//   commit for deskVerify on an agents node. IE: deskVerify knows where it runs. and only the desk node has the right
//   to commit it's measurements (suite results)", "deskVerify belongs to my clone and is a companion to desk, it runs
//   on your clone only as a personal check (is my work done?)", and "deskVerify on an agent node exists only as block
//   for the agent claiming 'done', it will never commit."
//
// WHAT IS TRUE TODAY (read at b4a9eaff): deskVerify writes a row for every record it takes, wherever it runs, and it
// never asks its node anything.
//
// HOW THE MODE IS READ, and the one thing this suite pins that the box leaves loose: his words are "the existence of
// desk itself is the deciding factor", but an agent's node runs a desk server too - mine runs desk AND deskClient
// (asked of my own node, 2026-10-09: faceProof, appFaceAppServer, backup, desk, deskClient, fileServer, grantFace),
// because a deskClient's desk is in the node's include list since goal/G3.7. So the desk alone cannot tell the two
// apart, and the deskClient is what marks an agent: a node running one is an agent node whatever else it runs.
//   deskClient on the node -> 'agent'; else desk on the node -> 'desk'; neither -> 'none' (out of scope, his word).
// The node is asked with the verb every app server already has for its own node's port (appServer.js sets
// spirit.core.node.const.SPIRIT_PORT from relay-state/environment.json), so nothing is configured and nothing passed.
//
// THE SHAPE ASSERTED, names mine for the builder to argue:
//   mode {} -> {mode, apps}: what it read, and the app names it read it from.
//   record: in 'desk' mode it keeps rows as goal/G8.1 built it; in 'agent' and 'none' modes it answers the outcome it
//   was told and stores NOTHING - his "no commit for deskVerify on an agents node" - so an agent's copy can still
//   answer "is my work done" without a record existing anywhere but his clone.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.2: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G8.2: deskVerify knows where it runs, and only his clone keeps the record');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifymodes-'));

// A node that answers jobs.api 'api' with the app servers it runs, as a real one does.
function fakeNode(apps) {
  return new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let ask = null;
        try { ask = JSON.parse(b || '{}'); } catch (e) { ask = null; }
        const body = {};
        apps.forEach(function (a) { body[a] = {}; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ask && ask.ask === 'api' ? { status: 200, body: body } : { status: 200, body: {} }));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
}

// deskVerify, started as a node starts it, with the fake node's port in the environment file appServer reads.
async function start(name, apps) {
  const node = await fakeNode(apps);
  const root = path.join(scratch, name);
  const state = path.join(root, 'relay-state', 'process', 'deskVerify');
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const db = path.join(root, 'verify.db');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const kid = spawn(process.execPath, [SERVER, JSON.stringify({ db: db }), '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_ENVIRONMENT_FILE: path.join(root, 'relay-state', 'environment.json'), SPIRIT_NODE_PORT: String(node.port) }),
  });
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) break; } catch (e) { /* not yet */ }
  }
  return {
    db: db, port: node.port,
    ask: function (verb, args) { const q = {}; q[verb] = args || {}; return client.ask({ deskVerify: q }, { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyModesOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' }).then(function (r) { return r || {}; }, function () { return {}; }); },
    rows: function () {
      try {
        const { DatabaseSync } = require('node:sqlite');
        const conn = new DatabaseSync(db);
        const all = conn.prepare('SELECT suite, title, outcome FROM results').all();
        conn.close();
        return all;
      } catch (e) { return []; }
    },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); node.close(); setTimeout(r, 3000); }); },
  };
}

(async function () {
  // HIS CLONE: a desk server, no deskClient.
  const deskNode = await start('deskside', ['desk', 'fileServer', 'backup']);
  // AN AGENT'S CLONE: a deskClient beside a desk, as my own node runs it.
  const agentNode = await start('agentside', ['faceProof', 'desk', 'deskClient', 'fileServer']);
  // A NODE THAT IS NEITHER (his word: out of scope, so it keeps nothing and says so).
  const bare = await start('bareside', ['fileServer']);
  try {
    test.subHeading('1. it reads its mode from the node it runs on');
    const d = await deskNode.ask('mode');
    if (d.status === 200 && d.body && d.body.mode === 'desk') test.check('a node with a desk and no deskClient reads desk');
    else test.fail(OWED + 'mode on the desk node answered ' + short(d.body));
    const a = await agentNode.ask('mode');
    if (a.body && a.body.mode === 'agent') test.check('a node running a deskClient reads agent, though it runs a desk as well');
    else test.fail(OWED + 'mode on an agent node answered ' + short(a.body));
    const n = await bare.ask('mode');
    if (n.body && n.body.mode === 'none') test.check('a node with neither reads none');
    else test.fail(OWED + 'mode on a bare node answered ' + short(n.body));
    if (a.body && Array.isArray(a.body.apps) && a.body.apps.indexOf('deskClient') !== -1) test.check('it says which apps it read the mode from');
    else test.fail(OWED + 'apps read ' + short(a.body && a.body.apps));

    test.subHeading('2. his clone keeps the record');
    const kept = await deskNode.ask('record', { suite: 'mini.js', title: 'it holds', outcome: 'green' });
    if (kept.body && kept.body.written === true && deskNode.rows().length === 1) test.check('a record on the desk node is written, as goal/G8.1 has it');
    else test.fail(OWED + 'the desk node answered ' + short(kept.body) + ' with ' + deskNode.rows().length + ' rows');

    test.subHeading('3. an agent\'s clone keeps nothing, and still answers');
    const seen = await agentNode.ask('record', { suite: 'mini.js', title: 'it holds', outcome: 'red' });
    if (seen.status === 200 && seen.body && seen.body.ok !== false) test.check('an agent node takes the record without refusing it');
    else test.fail(OWED + 'the agent node answered ' + short(seen.body));
    if (seen.body && seen.body.written === false) test.check('and says it wrote nothing');
    else test.fail(OWED + 'written answered ' + short(seen.body && seen.body.written));
    if (!agentNode.rows().length) test.check('its database holds no row: no commit for deskVerify on an agent node');
    else test.fail(OWED + 'the agent node stored ' + short(agentNode.rows()));
    const bareRec = await bare.ask('record', { suite: 'mini.js', title: 'it holds', outcome: 'green' });
    if (bareRec.status === 200 && !bare.rows().length) test.check('a node that is neither stores nothing either');
    else test.fail(OWED + 'the bare node answered ' + short(bareRec.body) + ' with ' + bare.rows().length + ' rows');
  } finally {
    await deskNode.stop();
    await agentNode.stop();
    await bare.stop();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
