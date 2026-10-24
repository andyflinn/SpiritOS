'use strict';

// spirit/test/hygieneG19_11.js
// goal/G19.11: HYGIENE. Every point of the item's box, asserted, so the leftovers stay gone.
//   Andy: "The temp_loop/.js scratch file gotta go." He answered "yes." to the whole list as one item.
//
// Each section is one point of the box:
//   1 the scratch files at the repo root are gone
//   2 the localEar leftovers are gone
//   3 deskAgent's configuration.json is untracked (the file may stay on disk; .gitignore lists it)
//   4 the fileServer refuses a chunk-request over its chunk size, with a why, before it allocates anything
//   5 the dead verbs are gone: relay.who, hub's handleMatches / handleWho / withRelay, and deskVerify's verbs that only
//     tests called (mode, suites, loop.once, idle, chore.once, goal.check, records.search, claim.check)
//   6 the stale words: whoBook / who.json named only as history in the files the box lists, and no comment in the
//     node's own files leaning on the deleted GET /api/relay/who
//   7 the repo notes: .gitignore holds no pasted console.log line; notASuite.js names only files the runner sees, and
//     lists itself, so runAll does not take it for a suite; rollNarrow.js guards process/ and bash/ too
//   8 bash/README.md says what the box runs (/root/SpiritOS, root is spirit); bash/status asks the relay's key
//     (a card ask by bash/card-ask.js since goal/G22.6; it was GET /api/relay/key)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G19.11: ';
const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAhygieneG1911TestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function read(rel) { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return ''; } }
// Line comments and block comments out, so a tombstone that NAMES a deleted thing is not read as the thing. A `//`
// right after a colon is a url, not a comment.
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); }

test.startTest('goal/G19.11: hygiene - scratch files, leftovers, dead verbs and stale words gone');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hygiene-'));
const kids = [];

function startServer(script, name, values) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const app = path.basename(script, '.js');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, app, 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register(app, pipe);
  const kid = spawn(process.execPath, [script, JSON.stringify(values || {}), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  return {
    root: root,
    up: async function () {
      for (let i = 0; i < 60; i++) {
        await sleep(150);
        try { const r = await client.ask('api'); if (r.body && r.body[app] && r.body[app].ok !== false) return r.body[app]; } catch (e) { /* not yet */ }
      }
      return null;
    },
    call: function (verb, a, caller) { const q = {}; q[verb] = a; const o = {}; o[app] = q; return client.ask(o, caller).then(function (r) { return r || {}; }, function () { return {}; }); },
  };
}

function scratchFiles() {
  test.subHeading('1. the scratch files at the repo root are gone');
  const names = ['temp_loop.js', 'temp_loop2.js', 'temp_loop3.js', 'temp_loop4.js', 'temp_loop5.js', 'temp_loop6.js', 'temp_loop_clean.js', 'temp-desk-reply.js'];
  const left = names.filter(function (n) { return fs.existsSync(path.join(REPO, n)); });
  if (!left.length) test.check('no temp_loop*.js and no temp-desk-reply.js at the repo root');
  else test.fail(OWED + 'still at the root: ' + left.join(', '));
  const stray = fs.readdirSync(REPO).filter(function (n) { return /^temp[-_].*\.js$/.test(n); });
  if (!stray.length) test.check('and no other temp-*.js beside them');
  else test.fail(OWED + 'other scratch at the root: ' + stray.join(', '));
}

function localEar() {
  test.subHeading('2. the localEar leftovers are gone');
  const names = ['spirit/run/process/js/desk/reply.js', 'spirit/run/localEar.json', 'spirit/run/create-localEar.js'];
  const left = names.filter(function (n) { return fs.existsSync(path.join(REPO, n)); });
  if (!left.length) test.check('desk/reply.js, localEar.json and create-localEar.js are gone');
  else test.fail(OWED + 'still there: ' + left.join(', '));
}

function unslothConfiguration() {
  test.subHeading('3. deskAgent\'s configuration.json is not tracked');
  const rel = 'spirit/run/process/js/deskAgent/configuration.json';
  const r = spawnSync('git', ['ls-files', '--', rel], { cwd: REPO, encoding: 'utf8' });
  if (r.status === 0 && !String(r.stdout).trim()) test.check('git ls-files does not list it');
  else test.fail(OWED + 'git still tracks ' + rel + (r.status === 0 ? '' : ' (git said ' + short(r.stderr) + ')'));
  if (/^configuration\.json\s*$/m.test(read('.gitignore'))) test.check('and .gitignore names it, so it is not added back');
  else test.fail(OWED + '.gitignore no longer names configuration.json');
}

async function fileServerCap() {
  test.subHeading('4. the fileServer refuses a chunk-request over its chunk size, with a why');
  const fsrv = startServer(path.join(RUN, 'process', 'js', 'fileServer', 'fileServer.js'), 'fileServer', {});
  if (!await fsrv.up()) { test.fail('the world: the fileServer did not start'); return; }
  const file = path.join(scratch, 'twelve-k.bin');
  fs.writeFileSync(file, Buffer.alloc(12000, 7));
  const pushed = await fsrv.call('push', { path: file }, ANDY);
  const id = pushed.body && pushed.body.hash;
  if (!id) { test.fail('the world: push answered ' + pushed.status + ' ' + short(pushed.body)); return; }
  const ask = function (start, length) { const q = {}; q[id] = { command: 'chunk', data: JSON.stringify({ start: start, length: length }) }; return fsrv.call(id, q[id], ANDY); };
  const fits = await ask(0, 6000);
  const fitBytes = fits.body && fits.body.data ? Buffer.from(fits.body.data, 'base64').length : -1;
  if (fits.status === 200 && fitBytes === 6000) test.check('a chunk of 6000 bytes is answered whole');
  else test.fail('the world: a 6000-byte chunk answered ' + fits.status + ' ' + short(fits.body));
  const over = await ask(0, 6001);
  const said = JSON.stringify(over.body || {});
  if (over.status !== 200 && over.body && over.body.code === 'bad-request' && /6000/.test(said)) test.check('a chunk of 6001 is refused bad-request, the why naming the 6000-byte limit');
  else test.fail(OWED + 'a 6001-byte chunk answered ' + over.status + ' ' + short(over.body));
  const huge = await ask(0, 1e12);
  if (huge.status !== 200 && huge.body && huge.body.code === 'bad-request') test.check('a terabyte chunk is refused the same way, nothing allocated');
  else test.fail(OWED + 'a 1e12-byte chunk answered ' + huge.status + ' ' + short(huge.body));
  const still = await ask(6000, 6000);
  if (still.status === 200) test.check('and the server still answers after the refusals');
  else test.fail(OWED + 'after the refusals a chunk answered ' + still.status + ' ' + short(still.body));
}

async function deadVerbs() {
  test.subHeading('5. the dead verbs are gone');
  const relay = code(read('spirit/run/spirit/relay.js'));
  if (!/\bfunction\s+who\s*\(/.test(relay) && !/\bwho\s*:\s*who\b/.test(relay)) test.check('relay.js has no who() and does not export one');
  else test.fail(OWED + 'relay.js still has who()');
  const hub = code(read('spirit/run/spirit/hub.js'));
  const hubLeft = ['handleMatches', 'handleWho', 'withRelay'].filter(function (n) { return new RegExp('\\b' + n + '\\b').test(hub); });
  if (!hubLeft.length) test.check('hub.js has no handleMatches, handleWho or withRelay');
  else test.fail(OWED + 'hub.js still has ' + hubLeft.join(', '));
  const hubModule = require('../run/spirit/hub.js');
  if (!('handleMatches' in hubModule)) test.check('and hub.js exports no handleMatches');
  else test.fail(OWED + 'hub.js still exports handleMatches');

  // deskVerify asked for its verbs, as the node asks any server. No node behind it: it needs none to answer `api`.
  const v = startServer(path.join(RUN, 'process', 'js', 'deskVerify', 'deskVerify.js'), 'deskVerify', { db: path.join(scratch, 'verify.db'), pull: '' });
  const api = await v.up();
  if (!api) { test.fail('the world: deskVerify did not start'); return; }
  const DEAD = ['mode', 'suites', 'loop.once', 'idle', 'chore.once', 'goal.check', 'records.search', 'claim.check'];
  // full.run went with goal/G33.3 (the Verifier tab's run buttons are gone); run is how a run is handed over now.
  const KEPT = ['now', 'stop', 'run', 'record'];
  const served = DEAD.filter(function (n) { return Object.prototype.hasOwnProperty.call(api, n); });
  if (!served.length) test.check('deskVerify serves none of ' + DEAD.join(', '));
  else test.fail(OWED + 'deskVerify still serves ' + served.join(', '));
  const missing = KEPT.filter(function (n) { return !Object.prototype.hasOwnProperty.call(api, n); });
  if (!missing.length) test.check('and still serves ' + KEPT.join(', ') + ', which the desk face and the suites post to');
  else test.fail('deskVerify lost ' + missing.join(', ') + ', which have callers');
  const asked = await v.call('claim.check', { id: 'hy/G1.1' }, ANDY);
  if (asked.status !== 200 && asked.body && asked.body.code === 'no-such-verb') test.check('asked claim.check, it answers no-such-verb');
  else test.fail(OWED + 'claim.check answered ' + asked.status + ' ' + short(asked.body));
}

function staleWords() {
  test.subHeading('6. the stale words');
  // whoBook became contacts.js / relay-state/contacts.json on 2026-09-18 (contacts.js header). A line may still name
  // it as history: it then says so on the same line, with the date of the rename or the word historical.
  const BOX = ['DICTIONARY.md', 'AGENT.md', 'CLAUDE.md', 'spirit/run/spirit/relay.js', '.gitignore', 'UI_DESIGN_STYLE.md',
    'spirit/test/labMaster/BONES.md', 'spirit/test/peerPostWiring.js'];
  const bad = [];
  BOX.forEach(function (rel) {
    read(rel).split(/\r?\n/).forEach(function (line, i) {
      if (/whoBook|who\.json/.test(line) && !/2026-09-18|historical/i.test(line)) bad.push(rel + ':' + (i + 1));
    });
  });
  if (!bad.length) test.check('whoBook and who.json appear only as history in the ' + BOX.length + ' files the box lists');
  else test.fail(OWED + 'whoBook / who.json as if current: ' + bad.join(', '));

  const NODE = ['spirit/run/shell/natterDetails/natterDetails.js', 'spirit/run/spirit/hub.js', 'spirit/run/spirit/relay.js', 'spirit/run/spirit/relayStatus.js', 'spirit/run/spirit/server.js'];
  const leaning = [];
  NODE.forEach(function (rel) {
    read(rel).split(/\r?\n/).forEach(function (line, i) { if (/\/api\/(relay|hub)\/who\b/.test(line)) leaning.push(rel + ':' + (i + 1)); });
  });
  if (!leaning.length) test.check('no comment in natterDetails.js, hub.js, relay.js, relayStatus.js or server.js cites /api/relay/who or /api/hub/who');
  else test.fail(OWED + 'still citing the deleted route: ' + leaning.join(', '));
}

function repoNotes() {
  test.subHeading('7. the repo notes');
  const pasted = read('.gitignore').split(/\r?\n/).filter(function (l) { return /console\.log/.test(l); });
  if (!pasted.length) test.check('.gitignore holds no pasted console.log line');
  else test.fail(OWED + '.gitignore still holds ' + short(pasted));

  const list = require('./notASuite.js');
  const unseen = list.filter(function (n) { return !fs.existsSync(path.join(__dirname, n)); });
  if (!unseen.length) test.check('every name notASuite.js lists is a file beside the suites, where the runner looks');
  else test.fail(OWED + 'notASuite.js lists files the runner never sees: ' + unseen.join(', '));
  if (list.indexOf('notASuite.js') !== -1) test.check('and it lists itself');
  else test.fail(OWED + 'notASuite.js does not list itself');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'runAll.js'), '--list'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
  const listed = String(r.stdout || '').split(/\r?\n/).map(function (l) { return l.trim(); });
  if (r.status === 0 && listed.length > 10 && listed.indexOf('notASuite.js') === -1) test.check('runAll --list does not take notASuite.js for a suite (' + listed.filter(Boolean).length + ' listed)');
  else test.fail(OWED + 'runAll --list ' + (r.status === 0 ? 'lists notASuite.js' : 'failed: ' + short(r.stderr)));

  const narrow = code(read('spirit/test/rollNarrow.js'));
  if (!/===\s*'process'/.test(narrow) && /'bash'/.test(narrow) && !/replace\(\/\\\/\\\/\.\*\/g/.test(narrow)) test.check('rollNarrow.js walks process/ and bash/ too, and does not strip a url as a comment');
  else test.fail(OWED + 'rollNarrow.js still guards only part of the tree');
}

function bashNotes() {
  test.subHeading('8. bash/README.md and bash/status say what the box runs');
  const readme = read('bash/README.md');
  if (/\/root\/SpiritOS/.test(readme) && !/\/opt\b/.test(readme)) test.check('bash/README.md clones to /root/SpiritOS and never names /opt');
  else test.fail(OWED + 'bash/README.md still says ' + (/\/opt\b/.test(readme) ? '/opt' : 'no /root/SpiritOS'));
  if (!/SPIRIT_RELAY_USER|unprivileged|service account|spirit` account|spirit account/i.test(readme)) test.check('and names no unprivileged spirit account');
  else test.fail(OWED + 'bash/README.md still describes a spirit service account');
  const status = read('bash/status');
  // SINCE goal/G22.6 the key is a card ask on the relay's one door: Andy, "bash/status, which checked a relay with
  // curl, checks it with a small node script that sends the card ask instead". GET /api/relay/key is closed.
  if (/card-ask\.js/.test(status) && !/\/api\/relay\/(who|key)/.test(status) && /relayPublicKey/.test(status)) test.check('bash/status sends the card ask (bash/card-ask.js) and looks for relayPublicKey');
  else test.fail(OWED + 'bash/status still probes ' + (/\/api\/relay\/who/.test(status) ? '/api/relay/who' : /\/api\/relay\/key/.test(status) ? '/api/relay/key' : 'something else'));
}

// ANDY'S LATER RULINGS ON THE ITEM: "CLINE.md goes.", and of the other agents' files: "these. kell'em". RULES.md is
// folded into UI_DESIGN_STYLE.md first. agents/ stays: it is publishData's measurement data (goal/G4.33).
function agentFiles() {
  test.subHeading('9. the other agents\' files are gone, RULES.md lives on in UI_DESIGN_STYLE.md');
  const GONE = ['CLINE.md', 'GROK.md', 'GPT-OSS.md', 'AGENT_ONBOARDING.md', 'RULES.md', '.cursor', '.github/agents'];
  // A FOLDER COUNTS AS GONE WHEN NO FILE IS LEFT IN IT. A pull deletes the tracked files and can leave the empty
  // folders behind (it did on Andy's tree, .cursor/rules/, at 8b41dd27); an empty folder is nothing anyone reads.
  function holdsAFile(p) {
    let st = null;
    try { st = fs.statSync(p); } catch (e) { return false; }
    if (!st.isDirectory()) return true;
    return fs.readdirSync(p).some(function (n) { return holdsAFile(path.join(p, n)); });
  }
  const left = GONE.filter(function (n) { return holdsAFile(path.join(REPO, n)); });
  if (!left.length) test.check('CLINE.md, GROK.md, GPT-OSS.md, AGENT_ONBOARDING.md, RULES.md, .cursor/ and .github/agents/ are gone (no file left in them)');
  else test.fail(OWED + 'still there: ' + left.join(', '));
  if (fs.existsSync(path.join(REPO, 'agents', 'README.md'))) test.check('agents/ is kept: it is measurement data, not instructions');
  else test.fail('agents/ is gone, and publishData reads it');

  const ui = read('UI_DESIGN_STYLE.md');
  const rules = ['the label must contain a tooltip that explains the rules/constraints',
    'they should be displayed before the content to which it pertains'];
  const lost = rules.filter(function (r) { return ui.indexOf(r) === -1; });
  if (!lost.length && /moved from RULES\.md, goal\/G19\.11/i.test(ui)) test.check('UI_DESIGN_STYLE.md holds RULES.md\'s rules, marked as moved from it');
  else test.fail(OWED + 'UI_DESIGN_STYLE.md lacks ' + (lost.length ? short(lost) : 'the moved-from note'));

  // A live pointer is a name of a deleted file anywhere tracked outside design/ (history), agents/ (data) and the two
  // suites that use a name as quoted text. A line that says the file is gone, with this goal, is the record of it.
  const r = spawnSync('git', ['grep', '-nE', '(^|[^_A-Za-z])(CLINE|GROK|GPT-OSS|AGENT_ONBOARDING|RULES)\\.md|AGENT_ONBOARDING|\\.cursor/|\\.github/agents|gpt-oss\\.agent', '--',
    '.', ':!design', ':!agents', ':!spirit/test/deskLoop.js', ':!spirit/test/coreFilesMove.js', ':!spirit/test/hygieneG19_11.js',
    ':!spirit/run/process/js/desk/currentGoal.json'], { cwd: REPO, encoding: 'utf8' });
  const live = String(r.stdout || '').split(/\r?\n/).filter(Boolean)
    .filter(function (l) { return !/goal\/G19\.11/.test(l); })
    .filter(function (l) { const f = l.split(':')[0]; return fs.existsSync(path.join(REPO, f)); });
  if (!live.length) test.check('no live pointer to a deleted file outside design/ and quoted test text');
  else test.fail(OWED + 'still pointing at a deleted file: ' + short(live.map(function (l) { return l.split(':').slice(0, 2).join(':'); })));
}

(async function () {
  agentFiles();
  scratchFiles();
  localEar();
  unslothConfiguration();
  await fileServerCap();
  await deadVerbs();
  staleWords();
  repoNotes();
  bashNotes();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
