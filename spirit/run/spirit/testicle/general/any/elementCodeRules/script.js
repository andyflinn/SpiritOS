'use strict';
// spirit/run/spirit/testicle/general/any/elementCodeRules/script.js
// A RULE MODULE OF THE GENERAL TEST: what an element's code does (goal/G41.28, G43.24, G49.23): its rows from the branch it
// requires, its searches matching the whole row, what it changes it listens for, what it needs it requires itself; every
// file painting icons loading the icon element.
// goal/G49.27 (the box, Andy's Go: "the general file's seven parts ... each become such a module; generalRules is split
// further by topic"; "a new standard is a new folder, not a longer file"): its checks came from the one general rules
// module, spirit/testicle/general/any/generalRules/script.js, moved here unchanged in what they check and in their titles.
// Its runner is spirit/testicle/run/none/script.js. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: given no file, the tree; given a file, that file.
  return true;
}

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
// WHAT IS MOUNTED IS KNOWN BY ITS PATH (goal/G41.19, box v17; Andy: "the test knows bloody fucking well if a scripts is
// an app (from the path pattern), why the fuck would would it need manifests for standard patterns?",
// "the test knows fucking well, which are elements scripts in ./shell/js/"): an app is shell/<app>/<app>.js, an element any script
// under spirit/element/. Anything else in its reach is neither, and is not mounted.
// THE AGENT TABLES' PAGES (goal/G41.27; Andy, Q5: "it covers them, too"): the tables' shared element, its row editor
// (goal/G41.28) and each table's list and editor live in spirit/app/agent/table/ since goal/G43.12, which no pattern below
// matches; there they are neither, and are not mounted. spirit/app/agent/agent.js is an element by the new-folder rule.
// WHAT IS A PAGE MODULE (goal/G43.32; Andy: "helpers with no create are no fucking elements. they live in require.
// element scripts place their factories in spirit.required.<their path>"): a file is mounted when it is an element script;
// a switch (agent.js), a server or a helper is not.
// AN ELEMENT SCRIPT, BY ITS PLACE AND ITS EXPORTS (goal/G49.23: the loader places a script's module.exports, goal/G49.9): a
// script under spirit/element/, or an app's element.js or under its element/, whose module.exports has a create. Its exports
// are what it sets when it runs as the page's loader runs it (spirit/testicle/headLessChrome/script.js runAsPage), in a bare world of its
// own whose spirit answers no require; a script that throws there has none.
const ELEMENT_PLACE = /^spirit\/(?:element\/|app\/.+\/element(?:\/|\.js$))/;
function exportsCreate(f) {
  const vm = require('vm');
  const never = function () { return new Promise(function () {}); };
  const w = { console: { log: function () {}, error: function () {}, warn: function () {} }, setTimeout: function () { return 0; }, clearTimeout: function () {}, setInterval: function () { return 0; }, clearInterval: function () {} };
  w.window = w;
  // goal/G49.23: no spirit.required on the bare world's spirit; what the file sets is its module.exports.
  w.spirit = { requireScript: never, readyPromise: never() };
  vm.createContext(w);
  // The helper by its path, here: the parts run where the file's own const H does not reach (goal/G49.23: it threw 'H is not
  // defined', so no script was ever taken for an element and every element check judged none).
  try { const e = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js').runAsPage(f, w); return !!e && typeof e.create === 'function'; } catch (e) { return false; }
}
function isElementScript(rel) { const f = String(rel || ''); return /\.js$/.test(f) && ELEMENT_PLACE.test(f) && !/(^|\/)test\//.test(f) && fs.existsSync(path.join(RUN, f)) && exportsCreate(f); }
function kindOf(file) { return isElementScript(file) ? 'element' : ''; }
// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (spirit/testicle/testReport/script.js). This run records one line per file, named by its address.
// EVERY FILE THAT PAINTS AN ICON LOADS THE ICON ELEMENT (goal/G41.23; Q1, Andy: "plus the intrinsic apps, plus the
// icons app. all apps that use icons."; "wsl, Go" on: a second rule reads the code, so that it misses none). A bare mount
// draws no data, so most icons are seen only here. AN ICON STANDS ALONE (Andy: "isn't a glyph inside flowing text just
// like another inline character? ... glyphs are legal in labels and description true, and in that context they don't
// need special handling", then "narrow the rules so."): a shell script (no test, no vendor code) whose code, comments
// left out, holds a pictograph (Unicode Extended_Pictographic) alone in a string or alone between two tags, or that
// paints icons it is handed (named below, read by hand), loads spirit/element/icon/script.js. A glyph among words is text. Each is
// its own check, named by its path. painters() reads only the files git tracks under shell/, so the spirit/ entries of
// FROM_DATA and TEXT_ONLY are never read, and shell/boot.js (now spirit/shell/boot/script.js, goal/G43.18), shell/apps/apps.js
// and shell/icons/icons.js are no longer in the tree.
const FROM_DATA = ['shell/boot.js', 'shell/apps/apps.js', 'shell/icons/icons.js', 'spirit/app/contact/element.js', 'spirit/element/search/icon/list/script.js',
  'spirit/element/search/icon/row/script.js', 'spirit/element/search/icon/script.js', 'spirit/element/workBench/script.js'];
// A pictograph, its variation selectors and joiners with it, alone in quotes or alone between > and <.
const ALONE = /(['"`]|>)\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]*)+\s*(['"`]|<)/u;
// A glyph alone in a string that is drawn only among words, read by hand: a status or a mark put before a name
// (Andy: "glyphs are legal in labels and description true").
const TEXT_ONLY = {
  // its blocked mark is drawn before the person's name
  'spirit/element/search/contact/detail/script.js': true,
  // its filter icons are drawn before their words by the search element's chips
  'spirit/element/search/contact/list/script.js': true,
};
function painters() {
  const tracked = require('child_process').execFileSync('git', ['ls-files', 'shell'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    if (!/\.js$/.test(f) || /\/test\//.test(f) || VENDORED_FOLDERS.holds(f) || f ==='spirit/element/icon/script.js' || !fs.existsSync(path.join(RUN, f))) return false;
    if (FROM_DATA.indexOf(f) !== -1) return true;
    if (TEXT_ONLY[f]) return false;
    const code = fs.readFileSync(path.join(RUN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
    return ALONE.test(code);
  });
}

function every() {
  // every shell file that paints an icon loads the icon element
  // Said only when a file paints icons: painters() reads the files git tracks under shell/.
  let painting = [];
  try { painting = painters(); } catch (e) { painting = []; }
  if (painting.length) {
    // A WHOLE-TREE CHECK OVER THE PAINTERS (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a
    // testicle row for the failing script and itself as the suite?"): a red row under each that loads neither.
    test.over('it paints icons, and loads the icon element or hands them to one that does', 0.4, painting, function (f) {
      const src = fs.readFileSync(path.join(RUN, f), 'utf8');
      // A file that hands its glyphs to the one-row form (goal/G41.27) paints them through it: rowForm loads the icon element
      // itself (rule/26).
      return src.indexOf('spirit/element/icon/script.js') !== -1 || src.indexOf('spirit/element/rowForm/script.js') !== -1;
    }, test.limit.quick);
  }
}

function oneFile() {
  if (!kindOf(rel)) {
    test.run('it places no element (no create in its exports): a switch, a server or a helper, not mounted', 0.4, function () {
      return !kindOf(rel) || false;
    }, test.limit.quick);
    return;
  }
  const ownCode = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  // ITS ROWS FROM ITS BRANCH (goal/G49.23, box v21; Andy: "no spirit.dataStore"): an element reads a branch's rows from the
  // branch spirit.requireScript hands back, at its client; it reads no spirit.dataStore and asks for no client script.
  // <address>: it reads its rows from the branch it requires
  test.run('it reads no spirit.dataStore and asks for no client script: its rows come from the branch it requires', 0.4, function () {
    return (!/\.dataStore\b/.test(ownCode) && !/requireScript\(\s*['"][^'"]*\/client\/script\.js['"]/.test(ownCode)) || false;
  }, test.limit.quick);
  // THE WHOLE ROW, NEVER A FEW FIELDS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and
  // search the whole row, as cached in spirit.required.spirit.data."): no app or element hands a search a matched(row) of its own; the
  // search element itself matches the whole row.
  if (rel !== 'spirit/element/search/script.js') {
    // <address>: its searches match the whole row
    test.run('it hands no search a matched() of its own', 0.4, function () {
      return !/\bmatched\s*:/.test(ownCode) || false;
    }, test.limit.quick);
  }
  // WHAT IT CHANGES, IT LISTENS FOR, IN ITS CODE (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when
  // it changes shit it listens to fucking update via the spirit object"): judged without a page, since a bare mount
  // seldom has a row to change. A module whose code sends a write (an op that changes a row, or a verb that sets) watches
  // the store (spirit.client, goal/G49.23): a .watch( of its own, or a search made on a branch of the store (its data: option), the branch named as
  // text or by the one that keeps it (data: K.branch, the cache manager's own name for it).
  {
    const own = ownCode;
    // A write in code: an op that changes a row ({ op: 'set' }), a verb named as a string that changes one
    // ('spirit.setName', 'chat.add', 'box.write'), or a spirit family's setting verb called (spirit.relay.api.join(...)).
    const WRITE = /\bop\s*:\s*['"](add|set|delete|remove|grant|revoke|ask|claim|press)['"]|['"][a-z]\w*(?:\.[a-z]\w*)*\.(?:set[A-Z]\w*|set|add|delete|remove|grant|revoke|join|face|write|press|claim)['"]|\bspirit\.\w+\.(?:set[A-Z]\w*|join|face|grant|revoke)\s*\(|\.relay\.(?:join|face)\s*\(|\.(?:saveFile|grant|revoke)\s*\(\s*\w/;
    const writes = WRITE.exec(own);
    // <address>: what its code changes, it watches in the store
    if (!writes) {}
    else {
      // OR THROUGH A CHILD IT MOUNTS ON A BRANCH (goal/G47.1; wsl, of the model table: "the list it mounts (the shared agent
      // table, data: the model branch) is what shows the result, so it does listen, through its child"; cw: "A child it mounts
      // on a branch counts as its listening"): an element it requires whose own code makes a search on a branch of the store,
      // handed the branch's name (table: or branch:, a word). No watch of its own is added to pass.
      const ON_BRANCH = /\bdata\s*:\s*(?:['"][\w.\/-]+['"]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)/;
      const child = function () {
        if (!/\b(?:table|branch)\s*:\s*['"][\w.-]+['"]/.test(own)) return false;
        const asked = own.match(/require(?:Script)?\(\s*['"](spirit\/[^'"]+\.js)['"]/g) || [];
        return asked.some(function (r) {
          const p = /['"]([^'"]+)['"]/.exec(r)[1];
          let c = ''; try { c = fs.readFileSync(path.join(RUN, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); } catch (e) { return false; }
          // The child's branch may be worked out from the name it is handed (data: branchOf(o.table)): any data: option, in a
          // child that loads the search element.
          return /spirit\/element\/search\/script\.js/.test(c) && /\bdata\s*:\s*[\w$'"]/.test(c);
        });
      };
      test.run('it sends writes and watches the store', 0.4, function () {
        return (/\.watch\s*\(/.test(own) || ON_BRANCH.test(own) || child()) || false;
      }, test.limit.quick);
    }
  }
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves, (fast if an other element already required it), that way anybody can mount any element without knowing
  // what it actually needs...."): its code takes no interface from what it is handed, no api.verb or api.escapeHtml and
  // no api off its options; it reaches its verbs through spirit itself.
  // <address>: what it needs, it requires itself
  test.run('it takes no api from what it is handed', 0.4, function () {
    const own = ownCode;
    const handed = own.match(/\b(?:opts|options|o|op)\s*\.\s*api\b|(?<![.\w$])api\s*\.\s*(?:verb|escapeHtml)\b/g) || [];
    return !handed.length || false;
  }, test.limit.quick);
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
// shell/js: Andy's words it quotes name the old element home (cw's find: on Windows that quote read as a use of the name).
const FORBIDS_NAMES = ['shell/js'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
