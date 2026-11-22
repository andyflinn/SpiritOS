'use strict';
// run/spirit/testicle/script.js
// TESTICLE, THE TEST SYSTEM OF THE NEXT TREE (goal/G50.1, box v24): "testicle is the test system, apart from test/:
// spirit/testicle/run/all/, run/node/, run/browser/, run/classify/"; "results, classification and execution time land
// back beside the test, in test/<id>/state.json"; "a test never says where it runs: testicle's classifier finds out and
// writes it into test/<id>/state.json". Node only: what the four run/ folders share. A test itself runs through
// runTest/script.js, the same file on both sides.
//
// A TEST is any test/<id>/script.js in repo://run/spirit/, <id> a camelCase name, never below a files/ folder and never a
// general verdict folder (test/general/). ITS SUBJECT is the script.js two folders up: spirit/server/test/saysHallo/script.js
// tests spirit/server/script.js (box v24: "the subject is always the script.js two folders up from the test's own script.js").
//
// state.json, written beside each test, keeps what testicle learnt of it:
//   { runsIn: ['node', 'browser'], node: { green, ms, at, reason? }, browser: { green, ms, at, reason? } }
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const RUN = path.resolve(__dirname, '..', '..');           // repo://run/
const SPIRIT = path.join(RUN, 'spirit');
const ID = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const LIMIT_MS = 5000;

function rel(full) { return path.relative(RUN, full).split(path.sep).join('/'); }

// Every test of the tree, by its spirit path, in name order.
function tests() {
  const out = [];
  (function walk(dir) {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    names.sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (d) {
      if (!d.isDirectory() || d.name === 'files' || d.name === 'node_modules' || d.name.charAt(0) === '.') return;
      const full = path.join(dir, d.name);
      if (path.basename(dir) === 'test' && d.name !== 'general' && ID.test(d.name)) {
        if (fs.existsSync(path.join(full, 'script.js'))) out.push(rel(path.join(full, 'script.js')));
        return; // a test's own folder holds no further tests
      }
      walk(full);
    });
  }(SPIRIT));
  return out;
}

function subjectOf(testPath) { return path.posix.join(path.posix.dirname(path.posix.dirname(path.posix.dirname(testPath))), 'script.js'); }

function stateFile(testPath) { return path.join(RUN, path.posix.dirname(testPath), 'state.json'); }
function readState(testPath) { try { return JSON.parse(fs.readFileSync(stateFile(testPath), 'utf8')) || {}; } catch (e) { return {}; } }
function writeState(testPath, fields) {
  const s = Object.assign(readState(testPath), fields);
  fs.writeFileSync(stateFile(testPath), JSON.stringify(s, null, 2) + '\n');
  return s;
}

// In node: each test through runTest, one after another, in this process.
function inNode(list) {
  const spirit = require(path.join(SPIRIT, 'script.js'));
  return spirit.requireScript('spirit/testicle/runTest/script.js').then(function (runTest) {
    const rows = {};
    return list.reduce(function (p, t) {
      return p.then(function () { return runTest(t, subjectOf(t), LIMIT_MS).then(function (r) { rows[t] = r; }); });
    }, Promise.resolve()).then(function () { return rows; });
  });
}

// In a browser: the page run/browser/index.html, served by a server of this tree on a free port, in headless Chrome; the
// page runs the tests through the same runTest and writes their rows into its body, which Chrome hands back.
function chrome() {
  const at = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return at.filter(Boolean).find(function (p) { return fs.existsSync(p); }) || '';
}
function freePort() {
  return new Promise(function (ok) { const s = http.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { ok(p); }); }); });
}
function up(port, tries) {
  return new Promise(function (ok) {
    http.get('http://127.0.0.1:' + port + '/spirit/', function (r) { r.resume(); ok(true); })
      .on('error', function () { if (tries > 0) setTimeout(function () { up(port, tries - 1).then(ok); }, 100); else ok(false); });
  });
}
function inBrowser(list) {
  const browser = chrome();
  if (!browser || !list.length) return Promise.resolve({ rows: {}, missing: !browser });
  return freePort().then(function (port) {
    const server = spawn(process.execPath, [path.join(SPIRIT, 'server', 'script.js'), '--port', String(port)], { cwd: RUN, stdio: 'ignore' });
    return up(port, 50).then(function (ok) {
      if (!ok) return { rows: {}, missing: false };
      const url = 'http://127.0.0.1:' + port + '/spirit/testicle/run/browser/index.html#' + encodeURIComponent(JSON.stringify({ tests: list, limit: LIMIT_MS }));
      const budget = String((LIMIT_MS + 1000) * list.length + 2000);
      const got = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--virtual-time-budget=' + budget, '--dump-dom', url], { encoding: 'utf8', timeout: Number(budget) + 30000 });
      const m = /<pre id="rows">([\s\S]*?)<\/pre>/.exec(String(got.stdout || ''));
      let rows = {};
      try { rows = m ? JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : {}; } catch (e) { rows = {}; }
      return { rows: rows, missing: false };
    }).then(function (r) { try { server.kill(); } catch (e) { /* gone */ } return r; });
  });
}

function stamp(r) {
  const o = { green: r.green, ms: r.ms, at: new Date().toISOString() };
  if (r.reason) o.reason = r.reason;
  return o;
}
// One row per test, as every run/ script prints it: path, side, green or red, milliseconds.
function report(side, rows) {
  Object.keys(rows).forEach(function (t) {
    const r = rows[t];
    console.log((r.green ? 'green' : 'red  ') + '  ' + side.padEnd(7) + String(r.ms).padStart(6) + ' ms  ' + t + (r.reason ? '  (' + r.reason + ')' : ''));
  });
}

module.exports = { RUN: RUN, tests: tests, subjectOf: subjectOf, readState: readState, writeState: writeState,
  inNode: inNode, inBrowser: inBrowser, stamp: stamp, report: report };
