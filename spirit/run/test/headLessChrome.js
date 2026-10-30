'use strict';

// spirit/run/test/headLessChrome.js
// WHAT A TEST NEEDS TO DRIVE A REAL BROWSER (goal/G41.22): a scratch node with its DEBUG on, and headless Chrome on a
// scratch profile, one page of it over the debugging protocol. Taken out of the shell's general rules
// (shell/test/boot-sibling-generalRules.js), so an element's own test can open its own pages, /DEBUG/<path>/test/<page>.html
// (spirit/DEBUG.md), in the same browser on the same kind of node. Never Andy's node nor an agent's.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, execSync } = require('child_process');

const RUN = path.join(__dirname, '..');
const REPO = path.join(RUN, '..', '..');
const WAIT = 20000;

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(250); } return false; }
function freePort() { return new Promise(function (resolve) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }

// Chrome where this machine keeps it: on Linux by its name, on Windows in its usual folders.
function findChrome() {
  const env = process.env.SPIRIT_CHROME;
  if (env && fs.existsSync(env)) return env;
  const win = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')];
  if (process.platform === 'win32') return win.filter(function (p) { return fs.existsSync(p); })[0] || '';
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const p = execSync('command -v ' + name, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (p) return p; } catch (e) { /* not this one */ }
  }
  return '';
}

// A scratch copy of the tracked files of spirit/run, its node started on a free port.
async function scratchNode() {
  // One node for a whole run of every file (below): the run that started this one hands its address on.
  if (process.env.SPIRIT_MOUNT_BASE) return { base: process.env.SPIRIT_MOUNT_BASE, child: null, root: '', up: true, debug: true, shared: true };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-shell-child-'));
  const files = execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  files.forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () {
    return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; });
  }, 60000);
  // ITS DEBUG ON, by the node's own verb: the DEBUG page is answered only then.
  const debug = up ? await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'node.debug', args: { debug: { on: true } } }) })
    .then(function (r) { return r.json(); }).then(function (b) { return !!(b && b.debug === true); }, function () { return false; }) : false;
  return { root: root, base: base, child: child, up: up, debug: debug };
}

// Headless Chrome on a scratch profile, and one page of it over the debugging protocol.
async function chromePage(chrome) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chrome-'));
  const kid = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,800', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  kid.stderr.on('data', function (d) { err += String(d); });
  let ws = '';
  await until(function () { const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) ws = m[1]; return !!ws; }, WAIT);
  if (!ws) return { kid: kid, profile: profile, error: 'Chrome gave no debugging address: ' + err.slice(-200) };
  const port = new URL(ws).port;
  let target = null;
  await until(function () {
    return fetch('http://127.0.0.1:' + port + '/json/list').then(function (r) { return r.json(); }).then(function (list) { target = list.filter(function (t) { return t.type === 'page'; })[0]; return !!target; });
  }, WAIT);
  if (!target) return { kid: kid, profile: profile, error: 'Chrome opened no page' };
  const sock = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function (resolve, reject) { sock.onopen = resolve; sock.onerror = reject; });
  let n = 0;
  const waiting = {};
  const heard = [];
  sock.onmessage = function (m) {
    const msg = JSON.parse(String(m.data));
    if (msg.id && waiting[msg.id]) { waiting[msg.id](msg); delete waiting[msg.id]; } else if (msg.method) heard.push(msg);
  };
  const send = function (method, params) { const id = ++n; sock.send(JSON.stringify({ id: id, method: method, params: params || {} })); return new Promise(function (r) { waiting[id] = r; }); };
  const evaluate = function (expr) {
    return send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(function (r) {
      return r.result && r.result.result ? r.result.result.value : undefined;
    });
  };
  await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable'); await send('Page.enable');
  return { kid: kid, profile: profile, send: send, evaluate: evaluate, heard: heard, sock: sock };
}

module.exports = { sleep: sleep, until: until, freePort: freePort, findChrome: findChrome, scratchNode: scratchNode, chromePage: chromePage, WAIT: WAIT };
