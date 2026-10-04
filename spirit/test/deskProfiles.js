'use strict';

// goal/G4.23: the agent profile Andy keeps in the desk — name and nick beside the scope — and his "<nick>:" line taken
// by that agent alone. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.23: "so two more fields for repo-root-agents: / name <agent-name> / nick: <wc | wsl
//   | ubi>"; "the nicks as trigger for them to take a question | job"; "use cw: / wc means water-closet"; to Q26 ("build
//   them now in G4.23, or with agent profiles?"): "build them now."; to Q27: "the profiles are for me, in desk. a
//   dataset that deskServer stores for me and let's you see. for your README.md, i trust that you keep them proper,
//   (no nick names etc...)".
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  desk verbs profile.set {agent: <key>, name, nick}, Andy alone (an agent is refused not-owner), and profile.get
//      {agent: <key>} answering {name, nick}, agent '' being the caller; any agent may read any profile ("let's you
//      see"). Unset fields answer ''. The scope stays scope.set/scope.get, one field (G4.23, already built).
//   2  A name passes fieldRules.problem (the label rule), else bad-request. A nick is 1-8 of a-z and 0-9, else
//      bad-request, and one agent's alone: a nick another agent holds is refused taken.
//   3  A line of Andy's that starts "<nick>:" (case ignored, under any item) is taken by the agent with that nick, as
//      its own line.take would take it: the line's taken is the label that agent writes with (the desk knows it from
//      the agent's writes, its key beside its label); another agent's line is refused taken until the nick's agent
//      answers. A nick nobody holds takes nothing.
//
// FOUND IN THE DRY RUN: deskServer.js's VERBS list names every desk verb, so it goes red until profile.get and
//   profile.set join it; the builder's to move.
// LEFT OPEN, not asserted: the pane's two fields (drawn on the agent's line, saved through profile.set) — a page red
// follows once these verbs stand; a nicked line for an agent that has never written (no label known yet).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.23: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskProfilesTestCWAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskProfilesTestWSLAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskProfilesTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.23: the agent profile — name and nick — and "<nick>:" taking his line');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskprofiles-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const codeOf = function (r) { return (r.body || {}).code || ''; };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    await call('session.set', { json: JSON.stringify({ goal: { id: 'p/G1', title: 'Profiles' }, items: [{ id: 'p/G1.1', title: 'Work', blocks: ['p/G1'] }] }) }, CW);
    await call('chat.add', { id: 'p/G1.1', text: 'wsl-claude says hello' }, WSL);

    test.subHeading('1. profile.set by Andy alone; profile.get for anyone');
    const unset = await call('profile.get', { agent: '' }, WSL);
    if (unset.status === 200 && (unset.body || {}).name === '' && (unset.body || {}).nick === '') test.check('an agent never profiled reads name \'\' and nick \'\'');
    else test.fail(OWED + 'profile.get for an unprofiled agent answered ' + unset.status + ' ' + short(unset.body));
    const byAgent = await call('profile.set', { agent: WSL.key, name: 'wsl-claude', nick: 'wsl' }, WSL);
    if (codeOf(byAgent) === 'not-owner') test.check('an agent setting a profile is refused not-owner');
    else test.fail(OWED + 'an agent\'s profile.set answered ' + byAgent.status + ' ' + short(byAgent.body));
    const set = await call('profile.set', { agent: WSL.key, name: 'wsl-claude', nick: 'wsl' }, ANDY);
    const own = await call('profile.get', { agent: '' }, WSL);
    const seen = await call('profile.get', { agent: WSL.key }, CW);
    if (set.status === 200 && (own.body || {}).nick === 'wsl' && (own.body || {}).name === 'wsl-claude' && (seen.body || {}).nick === 'wsl') test.check('Andy sets it; the agent reads its own, another agent reads it too');
    else test.fail(OWED + 'profile.set ' + set.status + ' ' + short(set.body) + '; own ' + short(own.body) + ', seen by another ' + short(seen.body));

    test.subHeading('2. the rules on name and nick');
    const badNick = await call('profile.set', { agent: CW.key, name: 'claude-windows', nick: 'Not A Nick' }, ANDY);
    const badName = await call('profile.set', { agent: CW.key, name: '', nick: 'cw' }, ANDY);
    if (codeOf(badNick) === 'bad-request' && codeOf(badName) === 'bad-request') test.check('a nick that is not 1-8 of a-z0-9, and an empty name, are refused bad-request');
    else test.fail(OWED + 'bad nick answered ' + short(badNick.body) + ', empty name ' + short(badName.body));
    const dup = await call('profile.set', { agent: CW.key, name: 'claude-windows', nick: 'wsl' }, ANDY);
    const okCw = await call('profile.set', { agent: CW.key, name: 'claude-windows', nick: 'cw' }, ANDY);
    if (codeOf(dup) === 'taken' && okCw.status === 200) test.check('a nick another agent holds is refused taken; its own nick is taken');
    else test.fail(OWED + 'a duplicate nick answered ' + short(dup.body) + '; cw answered ' + okCw.status + ' ' + short(okCw.body));

    test.subHeading('3. his "<nick>:" line is taken by that agent alone');
    await call('chat.add', { id: 'p/G1.1', text: 'WSL: please check the build' }, ANDY);
    await sleep(200);
    const chat = await call('item.chat', { id: 'p/G1.1' }, ANDY);
    const last = (((chat.body || {}).chat) || []).slice(-1)[0] || {};
    if (last.text === 'WSL: please check the build' && last.taken === 'wsl-claude') test.check('"WSL: ..." is taken by wsl-claude, case ignored');
    else test.fail(OWED + 'his nicked line reads ' + short(last));
    const other = await call('chat.add', { id: 'p/G1.1', text: 'claude-windows jumps in' }, CW);
    const answer = await call('chat.add', { id: 'p/G1.1', text: 'wsl-claude answers' }, WSL);
    if (codeOf(other) === 'taken' && answer.status === 200) test.check('meanwhile another agent is refused taken; the nick\'s agent answers');
    else test.fail(OWED + 'another agent answered ' + short(other.body) + ', the nick\'s agent ' + answer.status + ' ' + short(answer.body));
    await call('chat.add', { id: 'p/G1.1', text: 'zz: nobody holds this nick' }, ANDY);
    const free = await call('chat.add', { id: 'p/G1.1', text: 'claude-windows may speak' }, CW);
    if (free.status === 200) test.check('a nick nobody holds takes nothing');
    else test.fail('after "zz: ..." another agent was refused: ' + short(free.body));
  } catch (e) {
    test.fail('the suite threw: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
