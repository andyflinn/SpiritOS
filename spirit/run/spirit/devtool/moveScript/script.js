'use strict';
// spirit/run/spirit/devtool/moveScript/script.js
// MOVESCRIPT (goal/G49.5, box v5; Andy: "just a little bit of an accelerator"): one command moves a script and fixes
// everything that names it, so a move is one command and never a sweep by hand again. A tool for the agents.
//
//   node spirit/devtool/moveScript/script.js <from.js> <to.js> [--dry]    one move
//   node spirit/devtool/moveScript/script.js --batch <folder> [--dry]      every ./<name>.js under <folder> to ./<name>/script.js
//
// Paths are run paths (spirit/element/busyButton/script.js). --dry prints what it would do and changes nothing.
//
// WHAT ONE MOVE COVERS (the box): the file itself, its own test (test/<name>.js to ./test/<new name>.js), its .md, and the page
// fixtures of its test named after it (test/<name>-<what>.html), each to its new place; the moved file's own relative
// requires; every reference to it, as a run path ('spirit/element/x.js', with or without a leading slash), as a path
// relative to the file naming it ('./x.js', '../x.js'), as path.join pieces, in its regex-escaped form. Its dotted name is
// never touched: a folder's script.js stands at the folder's name, so a move changes no dotted name (goal/G49.9; G49.5,
// tried: rewriting it left 56 of 78 moved elements' tests redder). Left alone: quoted words, generated reports, history, the vendored
// folders and every state folder. Refused: a target that already exists.
//
// WHERE IT FINDS THE REFERENCES (the box): the loaders by testicle's dependency table (script, requires), read once a batch
// into memory and never written (testicle stays its one writer; each move renames its copy, old path to new in both
// columns); everything the table never holds by a text search over the tree. A dependent the table names whose text the
// move did not change is printed, to be looked at by hand.
//
// A BATCH (the box): testicle off at its start, on at its end, so it does not test a tree half moved; every move changed
// the hashes of the files it edited, so testicle relearns and tests what changed by itself.
require('../../script.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// The run root is the folder it is run in (spirit/run of a checkout, or a scratch root its test plants).
const RUN = process.cwd();
const posix = function (p) { return String(p).split(path.sep).join('/'); };
const abs = function (rel) { return path.join(RUN, rel); };
const exists = function (rel) { return fs.existsSync(abs(rel)); };

// The files it reads and fixes: every file git keeps or would add, as text, the vendored, state and lab folders left out
// ("left alone: ... generated reports, history").
const TEXT = /\.(js|md|html|json|css|txt)$/;
const SKIP = /(^|\/)(node_modules|codeMirror|vendor|state|app-state|lab|\.git)\//;
function treeFiles() {
  let all = null;
  try { all = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n'); }
  catch (e) { all = null; }
  // No git there (a scratch root): every file under it.
  if (!all) {
    all = [];
    (function walk(d) {
      let names = [];
      try { names = fs.readdirSync(path.join(RUN, d), { withFileTypes: true }); } catch (e) { return; }
      names.forEach(function (e) { const rel = d ? d + '/' + e.name : e.name; if (e.isDirectory()) { if (!SKIP.test(rel + '/')) walk(rel); } else all.push(rel); });
    })('');
  }
  return all.filter(function (f) { return f && TEXT.test(f) && !SKIP.test(f) && exists(f); });
}

// TESTICLE'S DEPENDENCY TABLE, a copy in memory: script -> the files its load pulled in. Read only.
function readDependencies() {
  const file = path.join(RUN, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
  const rows = [];
  if (!fs.existsSync(file)) return rows;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file, { readOnly: true });
    db.prepare('SELECT script, requires FROM dependency').all().forEach(function (r) { rows.push({ script: r.script, requires: r.requires }); });
    db.close();
  } catch (e) { /* no table yet: the text search alone */ }
  return rows;
}

// TESTICLE OFF AND ON, by the node's own verb, as its owner turns an app off and on. No node: nothing to turn.
async function testicleActive(on) {
  try {
    const app = await spirit.requireScript('spirit/app/script.js');
    // The branch's own name for the verb active (its script's functions: activeApp); a bound branch keys no call by its wire name.
    await spirit.callOutcome(app.activeApp({ key: 'spirit.app.testicle', active: on }));
    return true;
  } catch (e) { return false; }
}

// NO RULE ON WHERE A SCRIPT MAY LAND BESIDE A BRANCH'S FILES (goal/G49.12; Andy: "DUMB RULES! ./api.js files will disappear
// into ./client/script.js or equivalent when we get to enforcing branch and app api standards....").

// What moves with a script: its test, its .md and its test's fixtures named after it.
function companions(from, to) {
  const fd = path.posix.dirname(from), fn = path.posix.basename(from, '.js');
  const td = path.posix.dirname(to), tn = path.posix.basename(to, '.js');
  const out = [[from, to]];
  [['.js', '.js'], ['.md', '.md']].forEach(function (x) {
    const a = fd + '/test/' + fn + x[0];
    if (exists(a)) out.push([a, td + '/test/' + tn + x[1]]);
  });
  let names = [];
  try { names = fs.readdirSync(abs(fd + '/test')); } catch (e) { names = []; }
  names.filter(function (n) { return n.indexOf(fn + '-') === 0 && /\.html$/.test(n); }).forEach(function (n) {
    out.push([fd + '/test/' + n, td + '/test/' + n]);
  });
  // The .md beside the script itself, where one stands there.
  if (exists(fd + '/' + fn + '.md')) out.push([fd + '/' + fn + '.md', td + '/' + tn + '.md']);
  return out;
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }

// A path relative to a file's folder, as the tree writes it: ./x.js beside it, ../x.js above.
function relFrom(dir, target) {
  let r = path.posix.relative(dir, target);
  if (r.indexOf('.') !== 0) r = './' + r;
  return r;
}

// ONE FILE'S TEXT FIXED for a set of moves (map old run path -> new). ownOld is the file's own old path (its relative
// references resolve against where it stood), ownNew where it stands now.
function fixText(text, ownOld, ownNew, map) {
  // CODE INSIDE A STRING IS LEFT AS IT IS (goal/G49.27, wsl's find in the test system's move: testReport's test plants suites in a
  // scratch tree as strings of code, whose '..' and __dirname pieces are relative to where they are planted, not to the test; the
  // rewrite below broke five of its checks). A string literal holding require(, __dirname or module.exports is code: it is
  // masked before the rewrite and put back after. A plain path string, require('../x.js')'s own '../x.js', holds none of them.
  const kept = [];
  let t = text.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, function (lit) {
    if (!/require\(|__dirname|module\.exports/.test(lit.slice(1, -1))) return lit;
    kept.push(lit);
    return '\u0000' + (kept.length - 1) + '\u0000';
  });
  const oldDir = path.posix.dirname(ownOld), newDir = path.posix.dirname(ownNew);
  // 1. Relative references, resolved against where the file stood: './x.js', '../a/b.md', '../../script.js'.
  t = t.replace(/(^|[\s'"`(=,\[])((?:\.\.?\/)(?:[\w@.-]+\/)*[\w@.-]+\.(?:js|md|html|json|css))(?=$|[\s'"`),;:\]#?])/gm, function (all, pre, ref) {
    const target = path.posix.normalize(path.posix.join(oldDir, ref));
    const moved = map[target];
    if (!moved && oldDir === newDir) return all;
    const now = moved || target;
    if (!exists(now) && !Object.values(map).includes(now)) return all;
    return pre + relFrom(newDir, now);
  });
  // 2. path.join / path.resolve pieces off __dirname: path.join(__dirname, '..', 'x.js'), and the same through
  // require('path') (the element batch, missed: tabContainer's test, require('path').resolve(__dirname, '../../..')).
  t = t.replace(/((?:require\('path'\)|path)\.)(join|resolve)\(\s*__dirname((?:\s*,\s*'[^'\n]*')+)\s*\)/g, function (all, via, fn, rest) {
    const pieces = rest.split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return s.replace(/^'|'$/g, ''); });
    const target = path.posix.normalize(path.posix.join.apply(null, [oldDir].concat(pieces)));
    const moved = map[target];
    if (!moved && oldDir === newDir) return all;
    const now = moved || target;
    if (!/\.\w+$/.test(now) && !moved) { if (oldDir === newDir) return all; }
    const r = path.posix.relative(newDir, now);
    const parts = r ? r.split('/') : [];
    // The script's own new folder (the flag-day moves, missed: DEBUG's and sendMail's folder beside them became their own).
    if (!parts.length) return '__dirname';
    return via + fn + '(__dirname, ' + parts.map(function (p) { return "'" + p + "'"; }).join(', ') + ')';
  });
  Object.keys(map).forEach(function (old) {
    const neu = map[old];
    // 3. The run path itself, with or without a leading slash or a run/ before it.
    t = t.replace(new RegExp('(^|[^\\w.-])' + escRe(old) + '(?![\\w-])', 'gm'), function (all, pre) { return pre + neu; });
    // 4. Its regex-escaped form: spirit\/element\/x\.js.
    const escOld = old.replace(/\//g, '\\/').replace(/\./g, '\\.');
    const escNew = neu.replace(/\//g, '\\/').replace(/\./g, '\\.');
    t = t.split(escOld).join(escNew);
    // 5. path.join pieces off any base: (RUN, 'spirit', 'element', 'x.js').
    const oldParts = old.split('/');
    if (oldParts.length > 1) {
      const piecesRe = new RegExp(oldParts.map(function (p) { return "'" + escRe(p) + "'"; }).join('\\s*,\\s*'), 'g');
      t = t.replace(piecesRe, neu.split('/').map(function (p) { return "'" + p + "'"; }).join(', '));
    }
  });
  return t.replace(/\u0000(\d+)\u0000/g, function (all, i) { return kept[Number(i)]; });
}

// ONE MOVE. Answers { moved: [[from, to]], edited: [files], unchanged: [dependents not touched] } or { refused: why }.
function moveOne(from, to, o) {
  const opts = o || {};
  from = posix(from).replace(/^\.?\//, ''); to = posix(to).replace(/^\.?\//, '');
  if (!exists(from)) return { refused: 'no such script: ' + from };
  if (exists(to)) return { refused: 'the target exists: ' + to };
  const pairs = companions(from, to);
  const blocked = pairs.filter(function (p) { return exists(p[1]); });
  if (blocked.length) return { refused: 'the target exists: ' + blocked[0][1] };
  const map = {};
  pairs.forEach(function (p) { map[p[0]] = p[1]; });
  const files = treeFiles();
  // Each file's text, read where it stands now.
  const texts = {};
  files.forEach(function (f) { texts[f] = fs.readFileSync(abs(f), 'utf8'); });
  // The moves first, so a file fixed after reads what is there.
  if (!opts.dry) pairs.forEach(function (p) {
    fs.mkdirSync(path.dirname(abs(p[1])), { recursive: true });
    fs.renameSync(abs(p[0]), abs(p[1]));
  });
  const edited = [];
  files.forEach(function (f) {
    const now = map[f] || f;
    const was = texts[f];
    const fixed = fixText(was, f, now, map);
    if (fixed !== was) {
      edited.push(now);
      if (!opts.dry) fs.writeFileSync(abs(now), fixed);
    }
  });
  // The dependents the table names, every one of which must have been fixed.
  const deps = (opts.requiresRows || []).filter(function (r) { return r.requires === from; }).map(function (r) { return map[r.script] || r.script; });
  const unchanged = deps.filter(function (d) { return edited.indexOf(d) === -1 && exists(d); });
  // The copy in memory renamed, old path to new, in both columns.
  (opts.requiresRows || []).forEach(function (r) { if (map[r.script]) r.script = map[r.script]; if (map[r.requires]) r.requires = map[r.requires]; });
  return { moved: pairs, edited: edited, unchanged: unchanged };
}

// THE FIRST BATCH (the box): every script under the folder not named script.js, ./<name>.js to ./<name>/script.js, its
// tests' folders and the vendored ones left out.
function batchOf(folder) {
  const root = posix(folder).replace(/^\.?\//, '').replace(/\/$/, '');
  return treeFiles().filter(function (f) {
    return f.indexOf(root + '/') === 0 && /\.js$/.test(f) && path.posix.basename(f) !== 'script.js' && !/(^|\/)test\//.test(f);
  }).map(function (f) { return [f, f.replace(/\.js$/, '') + '/script.js']; })
    // A loader whose new place would be inside a vendored folder stays (spirit/element/codeMirror.js beside codeMirror/).
    .filter(function (m) { return !SKIP.test(m[1]); })
    // The deepest first, so a folder's own scripts have moved out of it (search/api.js to search/api/script.js) before
    // the script beside that folder moves in (search.js to search/script.js).
    .sort(function (a, b) { return b[0].split('/').length - a[0].split('/').length || (a[0] < b[0] ? -1 : 1); });
}

async function main(argv) {
  const dry = argv.indexOf('--dry') !== -1;
  const args = argv.filter(function (a) { return a !== '--dry'; });
  let moves = [];
  if (args[0] === '--batch' && args[1]) moves = batchOf(args[1]);
  else if (args.length === 2) moves = [[args[0], args[1]]];
  else { console.log('usage: moveScript <from.js> <to.js> [--dry] | --batch <folder> [--dry]'); return 2; }
  const requiresRows = readDependencies();
  const off = !dry && moves.length > 1 ? await testicleActive(false) : false;
  let refused = 0;
  try {
    moves.forEach(function (m) {
      const r = moveOne(m[0], m[1], { dry: dry, requiresRows: requiresRows });
      if (r.refused) { refused += 1; console.log('refused  ' + m[0] + ': ' + r.refused); return; }
      console.log((dry ? 'would move ' : 'moved    ') + r.moved.map(function (p) { return p[0] + ' -> ' + p[1]; }).join(', ') + ' | ' + r.edited.length + ' files fixed');
      r.unchanged.forEach(function (d) { console.log('  look by hand: ' + d + ' needs ' + m[0] + ' by the table, and its text did not name it'); });
    });
  } finally { if (off) await testicleActive(true); }
  console.log(moves.length + ' moves, ' + refused + ' refused' + (dry ? ' (dry, nothing changed)' : ''));
  return refused ? 1 : 0;
}

module.exports = { moveOne: moveOne, batchOf: batchOf, fixText: fixText, companions: companions };
if (require.main === module) main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (e) { console.error(e && e.stack || e); process.exit(1); });
