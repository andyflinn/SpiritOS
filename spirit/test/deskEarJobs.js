'use strict';

// goal/G5.8: deskEar upgrades: arming the ear hands the agent a job, with the rules that apply; the rules pushed on
// every change; the agent's clone pulled when a commit lands. Red on today's tree; wsl-claude wrote it from G5.8's box
// and does not build it (claude-windows builds).
//   Andy, 2026-10-05 (the box holds every line verbatim): "will the deskEar return immediately with a job to do if one
//   is available?"; "is this all of it? you don't need the rules?"; "if a job involves ui, there are rules of that type
//   to considered"; "is there a mechanical way to attach applicable rules to an item before or when it's given a go?";
//   "then lets have deskServer push active rules upon every rule-change."; to Q1 (a repo file, an ear line, or both):
//   "agreed." and "both"; "when the reds  landed, why doesn't deskClient pull the changes automatically?" / "or when the
//   code lands?"; the desk server pulling his checkout: "oos"; "agreed." to the box as it stood; his Go (go-all).
//
// THE NAMES are wsl-claude's picks where the box names none; the builder may argue them in Desk first:
//   the ear's job line starts JOB, then the item and the phase, then the keys of the rules that apply; the item's facts
//   carry rules, [{ key, version }], recorded on his Go; the rules file is written in the desk's state folder (name
//   matching /rules/i), to be shared as currentGoal.json is; a rule change is said by a desk line naming the rule's key.
// THE SHAPES (the box's):
//   1  next hands a job at once: a code item in red, open to this agent, comes back as a JOB line without waiting.
//   2  on his Go the item records the active rules that apply: the desk rules always, plus the types its box's paths
//      fall in (spirit/run/js/ and process/js/: code; spirit/run/shell/: ui); the JOB line names those rules.
//   3  every rule change writes the active rules (only active ones) into the rules file, and puts a line before the
//      agents naming the rule.
//   4  a commit line landing while the agent listens and its clone is clean pulls the clone; with an unsaved edit the
//      clone is left alone and the agent is told.
// LEFT OPEN, not asserted: the rules file's way to the repo is goalShare's, as currentGoal.json's (asserted by
// deskGoalFile and goalShare's own suites); the pull once more before a job is handed (the commit-line pull stands for
// it here); the desk server never pulling his checkout is out of scope ("oos").

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');
const plantRun = require('./plantRun.js');

const OWED = 'OWED by goal/G5.8: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const POLL_MS = 400;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8', timeout: 120000 }); }

const SELF_KEY = 'MCowBQYDK2VwAyEAdeskEarJobsTestSelfAAAAAAAAAAAAAAAAAAAA=';
const OTHER_KEY = 'MCowBQYDK2VwAyEAdeskEarJobsTestOtherAAAAAAAAAAAAAAAAAAA=';
const DESK_KEY = 'MCowBQYDK2VwAyEAdeskEarJobsTestDeskNodeAAAAAAAAAAAAAAA=';
const OWNER = { owner: true, key: SELF_KEY, label: 'claude-ubuntu' };
const SELF_AT_DESK = { key: SELF_KEY, label: 'claude-ubuntu' };
const OTHER_AT_DESK = { key: OTHER_KEY, label: 'claude-windows' };
const ANDY = { owner: true, key: DESK_KEY, label: 'andy' };

test.startTest('goal/G5.8: the ear hands a job with its rules; rules pushed; the clone pulled');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskearjobs-'));
const deskState = path.join(scratch, 'desk-state');
const clientState = path.join(scratch, 'client-state');
fs.mkdirSync(deskState, { recursive: true });
fs.mkdirSync(clientState, { recursive: true });
const win = process.platform === 'win32';
const deskPipe = win ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const clientPipe = win ? appClient.pipePathFor(scratch, 'deskClient', 'win32', 'process') : path.join(scratch, 'deskClient.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
client.register('deskClient', clientPipe);
const kids = [];
const call = function (app, verb, args, caller) {
  const q = {}; q[verb] = args;
  const b = {}; b[app] = q;
  return client.ask(b, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const desk = function (verb, args, caller) { return call('desk', verb, args, caller); };

// THE PRETEND NODE deskClient runs on, as deskClientNext.js builds it: its peer.post goes into the real desk server as
// the agent's own ask, and the answer comes back down the event stream by re.
const streams = [];
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': open\n\n'); streams.push(res); return; }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    if (b.verb === 'jobs.update') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (b.verb === 'contact.get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, key: b.key, person: { publicKey: b.key, blocked: true } })); return; }
    if (b.verb !== 'peer.post') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); return; }
    const hash = 'H' + Date.now() + Math.random();
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const d = (ask && ask.body && ask.body.desk) || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    client.ask({ desk: d }, SELF_AT_DESK).then(function (r) {
      const made = packet.encode('api', r && r.body, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: DESK_KEY, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    }, function () { /* the asker waits it out */ });
  });
});

async function up(app) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
async function next() {
  const t0 = Date.now();
  const r = await call('deskClient', 'next', {}, OWNER);
  return { lines: (r.body && Array.isArray(r.body.lines)) ? r.body.lines : [], ms: Date.now() - t0, status: r.status };
}
async function facts(id) { const r = await desk('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
async function newRule(type, label) {
  const added = await desk('rule.add', { type: type, label: label, text: label + ', in force.' }, ANDY);
  const key = added.body && added.body.key;
  if (key) await desk('rule.version', { key: key, text: label + ', in force.', status: 'active' }, ANDY);
  return key || '';
}

// THE AGENT'S CLONE: the run tree planted into a scratch git clone with its own bare origin, so deskClient runs from a
// clone a pull can move, never from this checkout.
function plantClone() {
  const bare = path.join(scratch, 'origin.git');
  git(['init', '-q', '--bare', '--initial-branch=master', bare], scratch);
  const clone = path.join(scratch, 'clone');
  git(['clone', '-q', '-c', 'core.autocrlf=false', bare, clone], scratch);
  git(['checkout', '-q', '-b', 'master'], clone);
  plantRun.plantRunTree(path.join(clone, 'spirit', 'run'));
  git(['config', 'user.email', 'test@example'], clone);
  git(['config', 'user.name', 'test'], clone);
  git(['add', '-A'], clone);
  git(['commit', '-q', '-m', 'the planted tree'], clone);
  git(['push', '-q', 'origin', 'master'], clone);
  const other = path.join(scratch, 'other');
  git(['clone', '-q', '-c', 'core.autocrlf=false', bare, other], scratch);
  git(['config', 'user.email', 'o@example'], other);
  git(['config', 'user.name', 'other'], other);
  return { bare: bare, clone: clone, other: other };
}
function startClient(nodeUrl, clone) {
  const script = path.join(clone, 'spirit', 'run', 'process', 'js', 'deskClient', 'deskClient.js');
  const kid = spawn(process.execPath, [script, JSON.stringify({ pollMs: POLL_MS, historyMax: 50 }), '--pipe', clientPipe, '--state', clientState,
    '--node', JSON.stringify({ name: 'claude-ubuntu', publicKey: SELF_KEY })], {
    cwd: path.join(clone, 'spirit', 'run'), stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskclient-job', SPIRIT_CALLBACK_URL: nodeUrl + '/' }),
  });
  kids.push(kid);
  return kid;
}
function head(dir) { return git(['rev-parse', 'HEAD'], dir).stdout.trim(); }
function pushFromOther(w, file, msg) {
  fs.writeFileSync(path.join(w.other, file), msg + '\n');
  git(['add', file], w.other);
  git(['commit', '-q', '-m', msg], w.other);
  git(['push', '-q', 'origin', 'master'], w.other);
  return head(w.other);
}
// Waits that keep asking next while a condition is not yet met (a pull or a job may arrive on any of them).
async function untilLines(pred, ms) {
  const until = Date.now() + ms;
  const seen = [];
  while (Date.now() < until) {
    const n = await next();
    n.lines.forEach(function (l) { seen.push(l); });
    if (pred(seen)) return seen;
  }
  return seen;
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  if (!await up('desk')) { test.fail('the desk server did not start'); return; }

  // The rules: one of each type that matters here, all active.
  const deskRule = await newRule('desk', 'Desk rule');
  const codeRule = await newRule('code', 'Code rule');
  const uiRule = await newRule('ui', 'UI rule');
  if (!deskRule || !codeRule || !uiRule) { test.fail('the world: rules could not be made: ' + short([deskRule, codeRule, uiRule])); return; }

  // A code item whose box names a core path (code) and no shell path (not ui).
  await desk('session.set', { json: JSON.stringify({ goal: { id: 'j/G1', title: 'Jobs' }, items: [{ id: 'j/G1.1', title: 'A code job', blocks: ['j/G1'], code: true }] }) }, OTHER_AT_DESK);
  const box = await desk('item.box', { id: 'j/G1.1' }, ANDY);
  await desk('box.write', { id: 'j/G1.1', text: 'Change spirit/run/js/router.js so the route expires sooner.', version: (box.body && box.body.version) || 0 }, OTHER_AT_DESK);
  await desk('press', { id: 'j/G1', what: 'end-design' }, ANDY);
  const go = await desk('press', { id: 'j/G1.1', what: 'go' }, ANDY);
  if (go.status !== 200) { test.fail('the world: his Go answered ' + go.status + ' ' + short(go.body)); return; }

  test.subHeading('2. on his Go the item records the rules that apply');
  const f = await facts('j/G1.1');
  const recorded = Array.isArray(f.rules) ? f.rules.map(function (r) { return r && r.key; }) : [];
  const versioned = Array.isArray(f.rules) && f.rules.every(function (r) { return r && r.key && r.version !== undefined; });
  if (recorded.indexOf(deskRule) !== -1 && recorded.indexOf(codeRule) !== -1 && recorded.indexOf(uiRule) === -1 && versioned) test.check('the item holds the desk rule and the code rule, each with its version, and not the ui rule');
  else test.fail(OWED + 'on his Go the item recorded rules ' + short(f.rules));

  test.subHeading('1. the ear hands a job at once, naming its rules');
  const w = plantClone();
  startClient(nodeUrl, w.clone);
  if (!await up('deskClient')) { test.fail('the world: deskClient did not start from the planted clone'); return; }
  await call('deskClient', 'setDesk', { key: DESK_KEY }, OWNER);
  await next();
  // THE WORLD HANDS LINES: another agent's chat line reaches this agent today (deskClientNext section 5), so a section
  // that waits for a line fails for the build, not for the world.
  await desk('chat.add', { id: 'j/G1.1', text: 'probe from the other agent' }, OTHER_AT_DESK);
  const probe = await untilLines(function (seen) { return seen.some(function (l) { return String(l).indexOf('probe from the other agent') !== -1; }); }, 8000);
  if (!probe.some(function (l) { return String(l).indexOf('probe from the other agent') !== -1; })) { test.fail('the world: deskClient handed no line at all (' + short(probe) + ')'); return; }
  const t0 = Date.now();
  const jobLines = await untilLines(function (seen) { return seen.some(function (l) { return /^JOB\b/.test(String(l)); }); }, 8000);
  const job = jobLines.filter(function (l) { return /^JOB\b/.test(String(l)); })[0] || '';
  const fast = Date.now() - t0 < 5000;
  if (job && job.indexOf('j/G1.1') !== -1 && /\bred\b/.test(job) && fast) test.check('a JOB line for j/G1.1 in red came back within ' + (Date.now() - t0) + ' ms');
  else test.fail(OWED + 'no JOB line for the open red within 5 s; lines ' + short(jobLines));
  if (job && job.indexOf(deskRule) !== -1 && job.indexOf(codeRule) !== -1 && job.indexOf(uiRule) === -1) test.check('the JOB line names the desk rule and the code rule, not the ui rule');
  else test.fail(OWED + 'the JOB line reads ' + short(job));

  test.subHeading('3. a rule change writes the rules file and is said to the agents');
  const fresh = await newRule('code', 'Fresh rule');
  const proposed = (await desk('rule.add', { type: 'ui', label: 'Only proposed', text: 'not in force' }, ANDY)).body;
  await sleep(500);
  const ruleFiles = fs.readdirSync(deskState).filter(function (n) { return /rules/i.test(n); });
  const fileText = ruleFiles.map(function (n) { try { return fs.readFileSync(path.join(deskState, n), 'utf8'); } catch (e) { return ''; } }).join('\n');
  if (fileText.indexOf('Fresh rule') !== -1 && fileText.indexOf('Code rule') !== -1 && fileText.indexOf('Only proposed') === -1) test.check('the rules file (' + ruleFiles.join(', ') + ') holds the active rules, the fresh one included, and not the proposed one');
  else test.fail(OWED + 'rules files in the desk state ' + short(ruleFiles) + ' read ' + short(fileText));
  const told = await untilLines(function (seen) { return seen.some(function (l) { return String(l).indexOf(fresh) !== -1; }); }, 6000);
  if (fresh && told.some(function (l) { return String(l).indexOf(fresh) !== -1; })) test.check('a line naming ' + fresh + ' reached the agent');
  else test.fail(OWED + 'no line named the fresh rule ' + short(fresh) + '; lines ' + short(told) + '; proposed ' + short(proposed));

  test.subHeading('4. a commit landing pulls the clean clone; an unsaved edit is left alone');
  const landed = pushFromOther(w, 'landed.txt', 'a build landed');
  await desk('chat.add', { id: 'j/G1.1', text: 'commit ' + landed + ': a build landed' }, OTHER_AT_DESK);
  await untilLines(function () { return head(w.clone) === landed; }, 8000);
  if (head(w.clone) === landed) test.check('the commit line pulled the listening agent\'s clean clone to ' + landed.slice(0, 8));
  else test.fail(OWED + 'the clone stayed at ' + head(w.clone).slice(0, 8) + ' after ' + landed.slice(0, 8) + ' landed');
  const before = head(w.clone);
  const notes = path.join(w.clone, 'spirit', 'run', 'js', 'router.js');
  const original = fs.readFileSync(notes, 'utf8');
  fs.writeFileSync(notes, original + '\n// unsaved\n');
  const second = pushFromOther(w, 'second.txt', 'another build landed');
  await desk('chat.add', { id: 'j/G1.1', text: 'commit ' + second + ': another build landed' }, OTHER_AT_DESK);
  const heard = await untilLines(function (seen) { return seen.some(function (l) { return /pull/i.test(String(l)) && /unsaved|not pulled|skipp/i.test(String(l)); }); }, 8000);
  const kept = fs.readFileSync(notes, 'utf8') === original + '\n// unsaved\n';
  if (head(w.clone) === before && kept && heard.some(function (l) { return /pull/i.test(String(l)) && /unsaved|not pulled|skipp/i.test(String(l)); })) test.check('with an unsaved edit the clone is not pulled, the edit stays, and the agent is told');
  else test.fail(OWED + 'with an unsaved edit: head moved ' + (head(w.clone) !== before) + ', edit kept ' + kept + ', lines ' + short(heard));
}

main().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 400);
});
