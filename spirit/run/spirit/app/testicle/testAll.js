'use strict';
require('../../script.js');

// spirit/run/spirit/app/testicle/testAll.js
// THE PRODUCT TEST-ALL (goal/G47.6, box point 5: "npm test points at a product test-all: one command that runs every suite
// through testicle's queue on a fresh checkout and fails when anything is red."). Its test: ./test/testAll.js.
//
//   node spirit/run/spirit/app/testicle/testAll.js [<script> ...]      (npm test, from the repository's root)
//
// Given scripts, it runs each one's own suite, ./test/<name>.js beside it; given none, every suite of the tree, as
// testModule.js names them, each general test once with every file it judges (cw and wsl, 2026-11-18: "Given scripts, only
// their own suites; given none, every suite of the tree"). It runs them as testicle's runner does (./testicle.js, launch):
// one at a time, each its own process in the run folder, all handed one node and one Chrome from headLessChrome.js --world,
// and testModule.js run as a process, never loaded (no production module loads a test file). No live node is needed.
// Each suite prints one line, ✅ or ❌ and its name; it exits 1 when any suite failed, else 0.

const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const RUN = path.resolve(__dirname, '..', '..', '..');
const TEST_MODULE = 'spirit/testicle/testModule/script.js';
const WORLD_TOOL = 'spirit/testicle/headLessChrome/script.js';
// As testicle's own limits: a suite past its job limit is killed, and the world given up on past the time a scratch node takes.
const SUITE_LIMIT_MS = 120 * 60 * 1000;
const WORLD_WAIT_MS = 120000;

function posix(p) { return String(p).split(path.sep).join('/'); }
function rel(p) { return posix(path.isAbsolute(p) ? path.relative(RUN, p) : p).replace(/^\.\//, '').replace(/^spirit\/run\//, ''); }

// The runs: [{ suite, files }], a general test once with all the files it judges.
function plan(scripts) {
  if (scripts.length) {
    return scripts.map(rel).map(function (s) {
      return { suite: path.posix.join(path.posix.dirname(s), 'test', path.posix.basename(s)), files: [] };
    }).filter(function (r) { return fs.existsSync(path.join(RUN, r.suite)); });
  }
  const out = spawnSync(process.execPath, [TEST_MODULE], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true });
  if (out.status !== 0) throw new Error('testModule.js failed: ' + String(out.stderr || '').trim());
  const bySuite = new Map();
  String(out.stdout || '').split(/\r?\n/).forEach(function (line) {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const r = bySuite.get(parts[0]) || { suite: parts[0], files: [] };
    if (parts[1]) r.files.push(parts[1]);
    bySuite.set(parts[0], r);
  });
  return Array.from(bySuite.values());
}

// THE ONE NODE AND CHROME, as testicle hands its runs (SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN, SPIRIT_CHROME_PORT); none when the
// tool cannot give them, and a suite that needs them then boots its own or fails, as under testicle.
function world() {
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [WORLD_TOOL, '--world'], { cwd: RUN, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    let out = '';
    let said = false;
    const say = function (env) { if (said) return; said = true; clearTimeout(t); resolve({ kid: kid, env: env }); };
    const t = setTimeout(function () { say({}); }, WORLD_WAIT_MS);
    kid.stdout.on('data', function (d) {
      out += d;
      const m = /@@WORLD (.*)\r?\n/.exec(out);
      if (!m) return;
      let w = null; try { w = JSON.parse(m[1]); } catch (e) { w = null; }
      const env = {};
      if (w && w.base) { env.SPIRIT_MOUNT_BASE = w.base; env.SPIRIT_MOUNT_RUN = w.run; }
      if (w && w.chromePort) env.SPIRIT_CHROME_PORT = w.chromePort;
      say(env);
    });
    kid.on('error', function () { say({}); });
    kid.on('exit', function () { say({}); });
  });
}

function runOne(r, env) {
  return new Promise(function (resolve) {
    const kid = spawn(process.execPath, [r.suite].concat(r.files), { cwd: RUN, env: Object.assign({}, process.env, env), stdio: 'ignore', windowsHide: true });
    const t = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, SUITE_LIMIT_MS);
    const end = function (code) { clearTimeout(t); resolve(code === 0); };
    kid.on('error', function () { end(1); });
    kid.on('exit', end);
  });
}

async function main() {
  const runs = plan(process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; }));
  const w = runs.length ? await world() : { kid: null, env: {} };
  let failed = 0;
  try {
    for (const r of runs) {
      const ok = await runOne(r, w.env);
      if (!ok) failed += 1;
      console.log((ok ? '✅ ' : '❌ ') + r.suite + (r.files.length ? ' (' + r.files.length + ' file' + (r.files.length === 1 ? '' : 's') + ')' : ''));
    }
  } finally {
    // The world's tool lets its node and Chrome go when its input closes; waited for, so its lab node is released, not killed.
    if (w.kid && w.kid.exitCode === null) {
      await new Promise(function (r) { w.kid.once('exit', r); setTimeout(r, 15000); try { w.kid.stdin.end(); } catch (e) { r(); } });
    }
  }
  console.log('testAll: ' + runs.length + ' suites, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) { console.error('testAll: ' + ((e && e.stack) || e)); process.exit(1); });
