'use strict';

// spirit/run/spirit/test/test/script-sibling-browser.js
// The test of spirit/test/script-sibling-browser.js, and of no other module (spec: ./script-sibling-browser.md): THE
// BROWSER TESTS ON ONE PAGE (goal/G47.1, box v144, "this cycle, first: the browser tests on one page"). The general test is
// run as testicle runs it, handed a list of scripts: six real elements and one planted script that never ends, a file of
// its own beside them for the run (a git-ignored file never reaches the node the general test takes). What it
// starts is counted from outside, among its own processes; its time is taken from its start to its end; what reaches
// testicle is read from the testicle of the node it reports to (spirit/test/testReport.js, reportToTesticle).
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const SUBJECT = path.join(RUN, 'spirit', 'test', 'script-sibling-browser.js');
const test = SPIRIT.requireScript('spirit/test/testReport.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const ELEMENTS = ['spirit/element/busyButton/script.js', 'spirit/element/progressBar/script.js', 'spirit/element/panel/script.js', 'spirit/element/icon/script.js',
  'spirit/element/fieldInput/script.js', 'spirit/element/armingButton/script.js'];
const HANG = 'spirit/element/zzBrowserHang.js';
// box v144: "measured before: script-sibling-browser.js ~10 s a script on cw's Windows ..., 3.7 s on wsl"; "the target: at
// least 80% less test time".
const BEFORE_S = process.platform === 'win32' ? 10 : 3.7;

// Every process descended from pid, with its command line (Linux: ps; elsewhere the counts are not judged). The run's own:
// a node it started is counted, what that node's servers start in their turn is not (the scratch node's testicle classifies
// at its start, with a node and a Chrome of its own).
// EVERY PROCESS UNDER pid, on Linux by ps, on Windows by its process table (Win32_Process: ProcessId, ParentProcessId,
// CommandLine), so the one node and the one Chrome are counted where testicle runs too, never left red for want of a way.
function processRows() {
  if (process.platform === 'linux') return execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n');
  if (process.platform === 'win32') {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.CommandLine)" }'], { encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true });
    return out.split(/\r?\n/).map(function (l) { return l.split('\\').join('/'); });
  }
  return [];
}
function descendants(pid) {
  let rows = [];
  try { rows = processRows(); } catch (e) { return []; }
  const kids = {};
  const args = {};
  rows.forEach(function (l) { const m = /^\s*(\d+)\s+(\d+)\s*(.*)$/.exec(l); if (!m) return; (kids[m[2]] = kids[m[2]] || []).push(m[1]); args[m[1]] = m[3]; });
  const out = [];
  const walk = function (p) { (kids[p] || []).forEach(function (k) { out.push({ pid: k, args: args[k] }); if (!/spirit\/server\/script\.js --port/.test(args[k])) walk(k); }); };
  walk(String(pid));
  return out;
}

// One run of the general test on a list, watched: the nodes and Chromes it started, its output, its time, and the first
// moment the first script's result stood in testicle.
const W = { nodes: new Set(), chromes: new Set(), out: '', ms: 0, firstAt: 0, endAt: 0, startAt: 0 };
function testicleBase() {
  // The node this checkout reports to: its environment, as spirit.js reads it.
  try { const env = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'state', 'environment.json'), 'utf8')); if (env && env.PORT) return "http://127.0.0.1:" + env.PORT; } catch (e) { /* none */ }
  return '';
}
async function newestTested(base, script) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ call: 'testicle.testicle.search', args: { script: script, suite: 'spirit/test/script-sibling-browser.js', text: '' } }) });
    const b = await r.json();
    return ((b && b.items) || []).map(function (i) { try { return Number(JSON.parse(i.label).tested) || 0; } catch (e) { return 0; } }).reduce(function (a, c) { return Math.max(a, c); }, 0);
  } catch (e) { return 0; }
}
test.after(function () { try { fs.rmSync(path.join(RUN, HANG), { force: true }); } catch (e) { /* scratch */ } });

test.run('a script that never ends is planted', 0.2, function () {
  const f = path.join(RUN, HANG);
  fs.writeFileSync(f, '\'use strict\';\n// planted by spirit/test/test/script-sibling-browser.js: it never ends\nfor (;;) { /* hang */ }\n');
  return fs.existsSync(f) || false;
}, test.limit.quick);
test.run('the general test runs on six elements with the hung script among them, watched from outside', 0.2, async function () {
  const list = ELEMENTS.slice(0, 2).concat([HANG]).concat(ELEMENTS.slice(2));
  const base = testicleBase();
  W.startAt = Date.now();
  const kid = spawn(process.execPath, [SUBJECT].concat(list), { cwd: RUN, stdio: ['ignore', 'pipe', 'pipe'] });
  kid.stdout.on('data', function (d) { W.out += d; });
  kid.stderr.on('data', function (d) { W.out += d; });
  let ended = false;
  const done = new Promise(function (r) { kid.on('close', function () { ended = true; W.endAt = Date.now(); r(); }); });
  // Watched four times a second until it ends, or for four minutes: a run still going then is ended, with all it started.
  while (!ended && Date.now() - W.startAt < 240000) {
    (descendants(kid.pid) || []).forEach(function (p) {
      if (/spirit\/server\/script\.js --port/.test(p.args)) W.nodes.add(p.pid);
      // One Chrome is its browser process; its zygotes, renderers and utilities carry --type=.
      if (/chrome/.test(p.args) && /--headless/.test(p.args) && /--user-data-dir=/.test(p.args) && !/--type=/.test(p.args)) W.chromes.add(p.pid);
    });
    if (base && !W.firstAt && (await newestTested(base, ELEMENTS[0])) > W.startAt) W.firstAt = Date.now();
    await sleep(250);
  }
  if (!ended) {
    W.hung = true;
    (descendants(kid.pid) || []).forEach(function (p) { try { process.kill(Number(p.pid), 'SIGKILL'); } catch (e) { /* gone */ } });
    try { kid.kill('SIGKILL'); } catch (e) { /* gone */ }
    await done;
  }
  W.ms = W.endAt - W.startAt;
  W.list = list;
  // What each element reported, read from testicle once the run is over: the newest of its rows, tested after the run began.
  W.tested = {};
  if (base) for (const f of ELEMENTS) W.tested[f] = await newestTested(base, f);
  return true;
}, test.limit.long);

// box v144: "spirit/test/script-sibling-browser.js and spirit/test/app-child-browser.js run on one node and one Chrome for
// the whole run"
test.run('the run ends by itself, within four minutes', 0.4, function () {
  return (!!W.list && !W.hung) || false;
}, test.limit.quick);
test.run('the whole run starts one node', 0.4, function () {
  return W.nodes.size === 1 || false;
}, test.limit.quick);
test.run('the whole run starts one Chrome', 0.4, function () {
  return W.chromes.size === 1 || false;
}, test.limit.quick);
// box v144: "only a hung page is reloaded: a main page that does not answer within 1 s is hung; a script's load waits as
// long as the page still answers."
test.run('every element after the hung script is judged, and its results stand in testicle from this run', 0.4, function () {
  if (!testicleBase()) return false;
  if (!W.tested) return false;
  const after = ELEMENTS.slice(2).filter(function (f) { return !(W.tested[f] > W.startAt); });
  return after.length === 0 || false;
}, test.limit.quick);
test.run('the hung script is judged red', 0.4, function () {
  // A red line (its title and ❌) under the hung script's heading (spirit/test/testReport.js).
  let under = false;
  return W.out.split('\n').some(function (l) { if (!/[✅❌]\s*$/.test(l)) { under = l.indexOf('zzBrowserHang') !== -1; return false; } return under && /❌\s*$/.test(l); });
}, test.limit.quick);
// box v144: "every result reaches testicle the moment the page knows it"
test.run('the first element\'s result stands in testicle while the run still goes', 0.4, function () {
  if (!testicleBase()) return false;
  return (W.firstAt > 0 && W.firstAt < W.endAt) || false;
}, test.limit.quick);
// box v144: "the target: at least 80% less test time"
test.run('the run takes at least 80% less than the time measured before', 0.4, function () {
  const most = 0.2 * BEFORE_S * 1000 * (ELEMENTS.length + 1);
  return (W.ms > 0 && W.ms <= most) || false;
}, test.limit.quick);
// box v144: "no fixed sleeps in the checks: each wait ends the moment the page has settled."
test.run('script-sibling-browser.js holds no fixed sleep', 0.4, function () {
  const bad = [];
  ['script-sibling-browser.js'].forEach(function (n) {
    const lines = fs.readFileSync(path.join(RUN, 'spirit', 'test', n), 'utf8').split('\n');
    lines.forEach(function (l, i) {
      const code = l.replace(/\/\/.*$/, '');
      if (/\bsleep\s*\(\s*\d/.test(code) || /setTimeout\s*\([^,]*,\s*\d+\s*\)/.test(code)) bad.push(true);
    });
  });
  return bad.length === 0 || false;
}, test.limit.quick);

// A ROW OF TRUE OR FALSE FIELDS ALONE IS PROBED TOO (goal/G47.1; wsl, of testicle's settings panel: "it rewrites only the
// text fields of a row, the preferences row holds only interactive, true or false, so it writes the same row back and
// nothing can redraw"). A planted element draws a row that holds one true or false field and nothing else; the probe
// flips it, so the element's redraw is seen.
const FLAG = 'spirit/element/zzBrowserFlag.js';
test.after(function () { try { fs.rmSync(path.join(RUN, FLAG), { force: true }); } catch (e) { /* scratch */ } });
test.run('a change written into a row of true or false fields alone redraws the element that draws it', 0.4, async function () {
  fs.writeFileSync(path.join(RUN, FLAG), [
    '\'use strict\';',
    '// planted by spirit/test/test/script-sibling-browser.js: it draws a row that holds one true or false field alone',
    '(function () {',
    '  var S = window.spirit;',
    '  function create(container) {',
    '    var D = S.required.spirit.data;',
    '    var V = (typeof D.viewAt === \'function\' ? D.viewAt : D.at)(null, \'zzflag\');',
    '    var el = document.createElement(\'div\'); container.appendChild(el);',
    '    try { V.set(\'zz/flag\', { on: false }); } catch (e) { /* kept */ }',
    // Redrawn only when what it shows changes, as a real panel is: the same row written back draws nothing.
    '    var paint = function () { var r = V.get(\'zz/flag\'); var t = r && r.on ? \'on\' : \'off\'; if (el.textContent !== t) el.textContent = t; };',
    '    var un = V.watch(\'zz/flag\', paint); paint();',
    '    return { destroy: function () { if (typeof un === \'function\') un(); el.remove(); } };',
    '  }',
    '  S.requireScript(\'spirit/element/installSpiritElement/script.js\').then(function () { S.required.spirit.element.installSpiritElement(S, \'' + FLAG + '\', { create: create }); });',
    '})();', ''].join('\n'));
  let out = '';
  const kid = spawn(process.execPath, [SUBJECT, FLAG], { cwd: RUN, stdio: ['ignore', 'pipe', 'pipe'] });
  kid.stdout.on('data', function (d) { out += d; });
  kid.stderr.on('data', function (d) { out += d; });
  await new Promise(function (r) { kid.on('close', r); });
  return out.split('\n').some(function (l) { return l.indexOf('a change written into what it watches redraws it \u2705') !== -1; }) || false;
}, test.limit.long);

// IT DOES NOT POLLUTE THE WINDOW NAMESPACE (goal/G47.1; Andy: "a test \"does NOT pullute the windows namespace\" NOW!!!!"):
// three planted elements, alike but for what they leave on the window: a top-level var, a top-level const, and the same
// code wrapped in one function. The first two are red, the wrapped one green.
const LEAK = 'spirit/element/zzBrowserLeak.js';
test.after(function () { try { fs.rmSync(path.join(RUN, LEAK), { force: true }); } catch (e) { /* scratch */ } });
const POLLUTE = 'it does not pollute the window namespace: no name of its own lands on the window';
function planted(top, wrapped) {
  const body = [
    '  var S = window.spirit;',
    '  function create(container) { var el = document.createElement(\'div\'); el.style.overflow = \'hidden\'; container.appendChild(el); return { destroy: function () { el.remove(); } }; }',
    '  S.requireScript(\'spirit/element/installSpiritElement/script.js\').then(function () { S.required.spirit.element.installSpiritElement(S, \'' + LEAK + '\', { create: create }); });'];
  return ['\'use strict\';', '// planted by spirit/test/test/script-sibling-browser.js: what it leaves on the window', top]
    .concat(wrapped ? ['(function () {'].concat(body, ['}());']) : ['(function () {'].concat(body, ['}());'])).concat(['']).join('\n');
}
async function judged(src) {
  fs.writeFileSync(path.join(RUN, LEAK), src);
  let out = '';
  const kid = spawn(process.execPath, [SUBJECT, LEAK], { cwd: RUN, stdio: ['ignore', 'pipe', 'pipe'] });
  kid.stdout.on('data', function (d) { out += d; });
  kid.stderr.on('data', function (d) { out += d; });
  await new Promise(function (r) { kid.on('close', r); });
  return out.split('\n').filter(function (l) { return l.indexOf(POLLUTE) !== -1; }).map(function (l) { return /✅\s*$/.test(l) ? 'green' : /❌\s*$/.test(l) ? 'red' : ''; })[0] || '';
}
test.run('an element that declares a var outside any function is judged red for polluting the window', 0.4, async function () {
  return (await judged(planted('var zzLeakVar = 1;', false))) === 'red' || false;
}, test.limit.long);
test.run('an element that declares a const outside any function is judged red for polluting the window', 0.4, async function () {
  return (await judged(planted('const zzLeakConst = 1;', false))) === 'red' || false;
}, test.limit.long);
test.run('the same element with every name inside its one function is judged green', 0.4, async function () {
  return (await judged(planted('', true))) === 'green' || false;
}, test.limit.long);
