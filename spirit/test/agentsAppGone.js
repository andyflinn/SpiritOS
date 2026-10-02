'use strict';

// goal/G3.2: the agents app is gone, and nothing in spirit/ still loads, runs or reads it. Red on today's tree.
//   RULE (Andy, 2026-10-02, verbatim, the box of goal/G3): "the agents APP is no longer permitted in this REPO"
//   In the tree: Andy deleted spirit/run/process/js/agents/ himself (agents.js and deskEar.js, commit ef85bc1f).
//   What still names it in code: the suites that tested it (agentsApp, agentsDesk, agentsOutbox, agentsPatience,
//   agentsRecord, agentsSeal, agentsVerb), the suites that load or read it on the way to something else
//   (boardPostSuite, boardRankSuite, deskBucket, deskWriterKey, fileCore, oneDoor, sealedLayering, tools/say.js),
//   the two that run its listener (deskChanges, deskEarState), and process/js/monitorDrill/monitorDrill.js.
// The contract the builder follows (the box of goal/G3.2):
//   1. spirit/run/process/js/agents/ does not exist.
//   2. No .js file under spirit/run or spirit/test names the app's files in code: not as a path
//      ('process/js/agents', 'agents/agents.js', 'agents/deskEar.js'), and not as path.join segments
//      ('js', 'agents' or 'agents', 'agents.js'). A suite whose only subject was the app is deleted; one that
//      used it on the way to something else loses that use.
//   3. Comments are history and may keep the name: a line that is only a comment is not read.
// Not asserted: the prose files (AGENTS.md, CLAUDE.md, AGENT.md), which goal/G3.6 changes; the packet name
// 'agents' the Desk page still sends under (shell/desk/desk.js), which is a packet's name and not the app.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G3.2: ';
const SPIRIT = path.join(__dirname, '..');
const APP = path.join(SPIRIT, 'run', 'process', 'js', 'agents');
// Not walked: installed packages, Andy's vault, and the node's own state.
const SKIP = ['node_modules', 'brains', 'relay-state', 'app-state', '.git'];
const NAMES = [
  /process[\\/]+js[\\/]+agents\b/,
  /agents[\\/]+agents\.js/,
  /agents[\\/]+deskEar\.js/,
  /['"]js['"]\s*,\s*['"]agents['"]/,
  /['"]agents['"]\s*,\s*['"](agents|deskEar)\.js['"]/,
];

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    if (e.isDirectory()) { if (SKIP.indexOf(e.name) === -1) walk(path.join(dir, e.name), out); }
    else if (/\.js$/.test(e.name)) out.push(path.join(dir, e.name));
  });
  return out;
}

// The code lines of a file that name the app: 'relative/path:line'. A line that is only a comment is history.
function naming(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  const hits = [];
  text.split(/\r?\n/).forEach(function (line, i) {
    const t = line.trim();
    if (t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0) return;
    if (NAMES.some(function (re) { return re.test(line); })) hits.push(path.relative(SPIRIT, file).replace(/\\/g, '/') + ':' + (i + 1));
  });
  return hits;
}

test.startTest('goal/G3.2: the agents app is gone and nothing in spirit/ names it in code');

test.subHeading('1. the app itself');
if (!fs.existsSync(APP)) test.check('spirit/run/process/js/agents/ does not exist');
else test.fail(OWED + 'spirit/run/process/js/agents/ exists: ' + fs.readdirSync(APP).join(', '));

test.subHeading('2. nothing under spirit/run names it in code');
const inRun = walk(path.join(SPIRIT, 'run'), []).reduce(function (all, f) { return all.concat(naming(f)); }, []);
if (!inRun.length) test.check('no .js file under spirit/run loads, runs or reads the agents app');
else test.fail(OWED + inRun.length + ' line(s) under spirit/run still name it: ' + inRun.join(', '));

test.subHeading('3. nothing under spirit/test names it in code');
const inTest = walk(path.join(SPIRIT, 'test'), []).filter(function (f) { return f !== __filename; })
  .reduce(function (all, f) { return all.concat(naming(f)); }, []);
if (!inTest.length) test.check('no suite or test tool loads, runs or reads the agents app');
else test.fail(OWED + inTest.length + ' line(s) under spirit/test still name it: ' + inTest.join(', '));

test.reportSuccessFailureCount();
