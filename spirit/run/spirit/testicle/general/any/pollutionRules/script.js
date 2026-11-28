'use strict';
// spirit/run/spirit/testicle/general/any/pollutionRules/script.js
// A RULE MODULE OF THE GENERAL TEST: no pollution (goal/G47.1): loaded in a node, a script adds nothing to the global object
// or to process but spirit; no script builds a temp path of its own.
// goal/G49.27 (the box, Andy's Go: "the general file's seven parts ... each become such a module; generalRules is split
// further by topic"; "a new standard is a new folder, not a longer file"): its checks came from the one general rules
// module, spirit/testicle/general/any/generalRules/script.js, moved here unchanged in what they check and in their titles.
// Its runner is spirit/testicle/run/node/script.js. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: given a file, that file; given no file, nothing (each script is judged when it is handed).
  return true;
}

// The module rules' code reader and their reading of a module (goal/G49.27: handed out by spirit/testicle/general/any/moduleRules/script.js).
const MODULE = SPIRIT.requireScript('spirit/testicle/general/any/moduleRules/script.js');
const codeOf = MODULE.codeOf;

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
const fs = require('fs');
const path = require('path');
const RUN = tools.run;
// A SCRIPT'S SOURCE WITH LF LINE ENDINGS (goal/G47.1, Andy's red on spirit/app/icons/element.js, 'its code reaches no element
// through spirit.elements', for a comment): a Windows checkout writes CRLF, a line split at LF keeps its CR, and the pattern
// dropping a line's comment (.*$, which stops at a CR) left the comment in, read as code. Read from the run judged.
function readSource(rel) { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\r\n?/g, '\n'); }
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
// Its arguments: the file it judges, if any.
const arg = String(ARGS[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
function moduleRules(full) { return MODULE.moduleRulesAt(RUN, full); }
// NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "no developer will want to use a system
// that pollutes global name-spaces.", "go on this"; judged in oneFile below). It took the place of requireOnNode, which
// nothing called. Never loaded, as the classifier never loads them (spirit/testicle/scriptClassify/script.js): the node and the relay
// themselves.
const NODE_NEVER_LOADED = ['spirit/server/script.js', 'spirit/server/relay/script.js'];
// The one door to a temp folder, and its own test (judged in oneFile below); and the lab's own test, which reads the system
// temp folder's top to find that no copy of the tree was made there ("no copy of the tree is made for the lab node in the
// temp folder"): it builds no temp path.
const TEMP_DOOR = ['spirit/tempFolder/script.js', 'spirit/tempFolder/test/script.js', 'spirit/testicle/headLessChrome/test/script.js'];
// The scratch run a script is loaded in: the one testicle hands (SPIRIT_MOUNT_RUN), else a tree of lab's with no node on it,
// taken for this one load and freed right after (handed a list, the rule runs this part once a script, so a tree kept here
// would be one more lab node each script, and the lab's six are gone by the seventh). The script as judged, the working copy,
// is put there first.
const NG_LAB = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
// Told from the exit handler, so a script that ends its process while it loads (a server handed no state) is judged on what
// it added before it ended; written synchronously, as an exit handler must.
const NODE_GLOBALS_PROBE = 'const path = require("path"); const fs = require("fs"); const g0 = Object.getOwnPropertyNames(globalThis), p0 = Object.getOwnPropertyNames(process); let err = "";' +
  'process.on("exit", function () { try { fs.writeSync(1, "\\n@@" + JSON.stringify({ err: err, g: Object.getOwnPropertyNames(globalThis).filter(function (k) { return g0.indexOf(k) === -1; }),' +
  ' p: Object.getOwnPropertyNames(process).filter(function (k) { return p0.indexOf(k) === -1; }) }) + "\\n"); } catch (e) { /* gone */ } });' +
  'try { const s = require(path.join(process.cwd(), "spirit", "script.js")); s.requireScript(process.argv[1]); } catch (e) { err = String(e && e.message || e); }' +
  'process.exit(0);';
// { err, leaks }: leaks the names this script's own code put on globalThis (global) or process; null when it could not be
// loaded at all.
async function nodeGlobalsOf(rel, full) {
  const n = await NG_LAB.scratchNode({ shared: true, start: false });
  try { return nodeGlobalsIn((n && n.run) || '', rel, full); } finally { if (n && !n.shared) { try { NG_LAB.freeTree(n); } catch (e) { /* freed when this process ends */ } } }
}
function nodeGlobalsIn(run, rel, full) {
  const NG = { run: run };
  if (!NG.run) return null;
  const there = path.join(NG.run, rel);
  try {
    const mine = fs.readFileSync(full);
    let had = null; try { had = fs.readFileSync(there); } catch (e) { had = null; }
    if (!had || !had.equals(mine)) { fs.mkdirSync(path.dirname(there), { recursive: true }); fs.writeFileSync(there, mine); }
  } catch (e) { return null; }
  const ran = require('child_process').spawnSync(process.execPath, ['-e', NODE_GLOBALS_PROBE, rel], { cwd: NG.run, encoding: 'utf8', timeout: 20000, windowsHide: true });
  const m = /\n@@(.*)\n/.exec(String(ran.stdout || ''));
  let r = null; try { r = m ? JSON.parse(m[1]) : null; } catch (e) { r = null; }
  if (!r) return null;
  let src = '';
  try { src = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { src = ''; }
  const esc = function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  const assigns = function (on, n) {
    const e = esc(n);
    return new RegExp('(^|[^.\\w$])(' + on + ')\\s*(\\.\\s*' + e + '(?![\\w$])|\\[\\s*[\'"]' + e + '[\'"]\\s*\\])\\s*=(?!=)').test(src) ||
      new RegExp('defineProperty\\s*\\(\\s*(' + on + ')\\s*,\\s*[\'"]' + e + '[\'"]').test(src);
  };
  const leaks = (r.g || []).filter(function (n) { return n !== 'spirit' && assigns('global|globalThis', n); }).map(function (n) { return 'globalThis.' + n; })
    .concat((r.p || []).filter(function (n) { return assigns('process', n); }).map(function (n) { return 'process.' + n; }));
  return { err: r.err, leaks: leaks };
}

function oneFile() {
  // Page code is no node script (moduleRules, spirit/testicle/general/any/moduleRules/script.js, says which is page code).
  const mr = moduleRules(full);
  // NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "the same rule MUST apply to both the
  // window object for isBrowser and what is it on node? the process object?", "no developer will want to use a system that
  // pollutes global name-spaces.", "go on this"). The page's side is spirit/testicle/general/browser/pageRules/script.js's. In a node every file has
  // its own scope, so only an assignment onto globalThis (global) or process leaks: the script is loaded alone, in a node of
  // its own, in a scratch run (the one testicle hands, else one of lab's), and what the global object and process hold after
  // that they did not before spirit.js is the script's when its own code assigns that name; spirit is the one name allowed.
  if (!mr.page && /^spirit\/.+\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && NODE_NEVER_LOADED.indexOf(rel) === -1 && !VENDORED_FOLDERS.holds(rel)) {
    test.run('loaded in a node, it adds nothing to the global object or to process but spirit', 0.7, async function () {
      const g = await nodeGlobalsOf(rel, full);
      return !!g && Array.isArray(g.leaks) && !g.leaks.length || false;
    }, test.limit.slow, { why: 'it loads the script in a node of its own' });
  }
  // ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box, no pollution: names and folders: "One helper on the spirit
  // object hands a process its temp folder, made empty when asked; nothing else builds a temp path. Guard: the general test
  // is red on a product script or test that calls the system temp folder directly."). Read in its code, strings and
  // comments left out: a call of tmpdir(). The helper itself, spirit/tempFolder/script.js, and its own test, which checks the
  // helper's paths against the system temp folder, are the two that may.
  if (/^spirit\/.+\.js$/.test(rel) && !VENDORED_FOLDERS.holds(rel) && TEMP_DOOR.indexOf(rel) === -1) {
    test.run('it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js', 0.4, function () {
      let src = '';
      try { src = codeOf(fs.readFileSync(full, 'utf8'), true); } catch (e) { return false; }
      return !/\btmpdir\s*\(/.test(src) || false;
    }, test.limit.quick);
  }
}

if (arg && full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'node', own: false, forbids: FORBIDS_NAMES, checks: checks };
