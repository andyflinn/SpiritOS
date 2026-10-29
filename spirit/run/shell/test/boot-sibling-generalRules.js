'use strict';

// spirit/run/shell/test/boot-sibling-generalRules.js <file>
// THE GENERAL RULES OF A SHELL APP OR ELEMENT (goal/G41.18), run once per file it judges, the file its argument, as
// ../../test/spirit-child-generalRules.js is for a module (spec: ./boot-sibling-generalRules.md). ITS NAME IS ITS REACH
// (../../test/TEST_SYSTEM.md; Andy: "the NAME of the file should tell testModule.js which folder this it belongs to"): a
// -sibling- test beside shell/boot.js judges every module in shell/ and below that has its own test. Andy: "we may require a
// ./test/shell-child-generalRules.js with a test that catches all violators of this sort of thing, THAT's were a general
// test belongs"; "shell-child-generalRules.js can also run headless chrome test to assert UI standards..."; "who says it
// shouln't check general \"mountability\" of elements and apps?", "mount each element or app all by itself, to \"unit\"
// tests?"; "add that test: shell-child-generalRules.js". Each file is its own test id; a rule a file breaks fails that
// file's test.
//
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, its DEBUG switched on, so
// neither Andy's node nor an agent's is touched. Headless Chrome, driven over its debugging port with node's own
// WebSocket, opens the node's DEBUG page for the file (goal/G41.19, ../../spirit/test/DEBUG.md; Andy: "wsl's element
// mount tests must be the first user of this DEBUG feature"), /DEBUG/<path>/<module>/headLessBrowser.html: spirit.js
// alone, then the one app or element, mounted by itself into a box of the whole page. What the page reports, and the
// real layout it drew, are judged here.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, execSync } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
// Its arguments: the file it judges, if any; the verifier's --verify-port <n> is the reporter's, and passed on.
const ARGS = process.argv.slice(2);
const VERIFY = ARGS.indexOf('--verify-port') !== -1 ? ARGS.slice(ARGS.indexOf('--verify-port'), ARGS.indexOf('--verify-port') + 2) : [];
const arg = String(ARGS.filter(function (a) { return VERIFY.indexOf(a) === -1; })[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
// EVERY TEST NAME STARTS WITH THE PATH (goal/G41.19; Andy: "please start the test descriptions always with the exact URL
// to the server, without \"/DEBUG\" service", and, box v13, "EVERY MOTHERFUCKING TEST NAME in the product three STARTS
// WITH THE MUTHERCUCKING PATH"): each section is named by the address this file's page is opened at, /DEBUG left off.
const ADDRESS = '/DEBUG/' + rel.replace(/\.js$/, '') + '/headLessBrowser.html';
const NAMED = ADDRESS.slice('/DEBUG'.length);
const WAIT = 20000;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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

// GIVEN NO FILE, EVERY FILE IN ITS REACH (goal/G41.19): an item's suite row names no file, so a run of this test alone
// judges every shell module testModule.js gives it, on one scratch node, each file in a run of its own, so each is
// recorded under its own module (test/testReport.js). This run records one line per file, named by its address.
async function every() {
  const files = require(path.join(RUN, 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'shell/test/boot-sibling-generalRules.js' && t.file; }).map(function (t) { return t.file; });
  test.comment('every shell module in its reach: ' + files.length);
  if (!files.length) { test.fail('testModule.js gives it no file to judge'); return; }
  const node = await scratchNode();
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on: every file would blame the wrong thing'); return; }
    for (const f of files) {
      const out = await new Promise(function (resolve) {
        const kid = spawn(process.execPath, [__filename, f].concat(VERIFY), { cwd: RUN, env: Object.assign({}, process.env, { SPIRIT_MOUNT_BASE: node.base }), stdio: ['ignore', 'pipe', 'pipe'] });
        let text = '';
        kid.stdout.on('data', function (d) { text += d; });
        kid.stderr.on('data', function (d) { text += d; });
        kid.on('close', function () { resolve(text); });
      });
      const greens = Number((/✅:(\d+)/.exec(out) || [])[1] || 0);
      const reds = Number((/❌:(\d+)/.exec(out) || [])[1] || 0);
      const first = (/FAILURE #[\d.]+: ([^\n]*)/.exec(out) || [])[1] || '';
      const at = '/' + f.replace(/\.js$/, '') + '/headLessBrowser.html';
      test.subHeading(at);
      ok(reds === 0 && greens > 0, at + ': ' + greens + ' green', at + ': ' + reds + ' red, ' + greens + ' green; first: ' + first.slice(0, 200));
    }
  } finally {
    try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

test.startTest((full ? NAMED : 'every shell module') + ': the general rules of a shell app or element');

(async function () {
  if (!arg) return every();
  if (!full) { test.fail('no shell app or element to judge: ' + JSON.stringify(arg)); return; }
  const chrome = findChrome();
  if (!chrome) { test.fail('no Chrome on this machine (set SPIRIT_CHROME to its path): the UI rules cannot be judged'); return; }
  const node = await scratchNode();
  let page = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: every rule here would blame the wrong thing'); return; }
    if (!node.debug) { test.fail('the scratch node\'s DEBUG could not be switched on (node.debug)'); return; }
    page = await chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }

    test.subHeading(NAMED + ': ' + 'it loads by itself');
    // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
    // parts via spirit.require; nothing is preloaded"). The node's DEBUG page for it, made from its address.
    const address = ADDRESS;
    const mountPage = await fetch(node.base + address);
    ok(mountPage.status === 200, 'the node answers its DEBUG page for it, ' + address, address + ' answered ' + mountPage.status);
    if (mountPage.status !== 200) return;
    await page.send('Page.navigate', { url: node.base + address });
    let report = null;
    await until(function () {
      return page.evaluate('JSON.stringify(window.spiritMount ? { state: window.spiritMount.state, error: String(window.spiritMount.error || "") } : null)').then(function (s) {
        report = s ? JSON.parse(s) : null; return !!report && report.state !== 'loading';
      });
    }, WAIT);
    await sleep(500);
    const thrown = page.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    // A file asked for and not there is missing; the door's answers (a refusal answers 404 too) and the browser's own
    // favicon ask are not files the page asked for.
    const notFile = function (url) { return /\/api\/|\/favicon\.ico$/.test(String(url || '')); };
    const errors = page.heard.filter(function (m) { return (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') || (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !notFile(m.params.entry.url)); })
      .map(function (m) { return m.params.entry ? m.params.entry.text : (m.params.args || []).map(function (a) { return a.value || a.description; }).join(' '); });
    const missing = page.heard.filter(function (m) { return m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !notFile(m.params.response.url); }).map(function (m) { return m.params.response.status + ' ' + m.params.response.url.replace(node.base, ''); })
      .concat(page.heard.filter(function (m) { return m.method === 'Network.loadingFailed' && !m.params.canceled; }).map(function (m) { return 'failed ' + m.params.errorText; }));
    ok(report && report.state === 'mounted', 'it mounts by itself on a bare page: spirit.js, then this file alone', 'the page said: ' + short(report));
    ok(!thrown.length, 'nothing it runs throws', 'thrown: ' + short(thrown));
    ok(!missing.length, 'every file it asks for is there', 'missing: ' + short(missing));
    ok(!errors.length, 'and it says no error on the console', 'console: ' + short(errors));
    if (!report || report.state !== 'mounted') return;

    test.subHeading(NAMED + ': ' + 'it draws, in the box it is given');
    const drew = await page.evaluate('(function () { var b = window.spiritMount.box; return !!b && b.childElementCount > 0 && b.getBoundingClientRect().height > 0; }())');
    ok(drew === true, 'it draws something into its box', 'its box is empty');

    test.subHeading(NAMED + ': ' + 'every list in a box of a stated size (rule/16)');
    // rule/16: a list scrolls inside a box of a stated size. Judged by the layout itself, so the page names no element
    // (Andy: "why are there elements hard-coded in there?"): every box it drew that scrolls (overflow auto or scroll),
    // shown, is given far more than it can hold, and must keep its height, inside the mount box. A box only as tall as
    // its content, anywhere above a list, lets the list grow with it. A dropdown's list is hidden until it opens, and is
    // not asked. It is judged as drawn, and again after each tool and tab button it draws is pressed in turn, so each
    // list it can show is judged while it shows.
    const PROBE = '(function () { var box = window.spiritMount.box; var out = [];' +
      ' Array.prototype.forEach.call(box.querySelectorAll("*"), function (el) { var cs = getComputedStyle(el); if (!/auto|scroll/.test(cs.overflowY) || !el.getClientRects().length) return;' +
      '  var before = el.getBoundingClientRect().height; var tall = document.createElement("div"); tall.style.height = "5000px"; tall.style.flex = "none"; el.appendChild(tall);' +
      '  var after = el.getBoundingClientRect(); var bx = box.getBoundingClientRect(); var spilt = box.scrollHeight > box.clientHeight + 1; el.removeChild(tall);' +
      '  var name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""); for (var n = el.parentNode; n && n !== box && !el.id; n = n.parentNode) { if (n.id) { name = n.tagName.toLowerCase() + "#" + n.id + " " + name; break; } }' +
      '  out.push({ box: name, kept: Math.abs(after.height - before) <= 1, inside: after.bottom <= bx.bottom + 1, spilt: spilt }); }); return out; }())';
    const seen = {};
    const probe = async function () { const s = await page.evaluate('JSON.stringify(' + PROBE + ')'); (s ? JSON.parse(s) : []).forEach(function (p) { if (!seen[p.box] || seen[p.box].kept) seen[p.box] = p; }); };
    await probe();
    const count = await page.evaluate('window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]").length');
    for (let i = 0; i < count; i++) {
      await page.evaluate('(function () { var b = window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]")[' + i + ']; if (b) b.click(); }())');
      await sleep(400);
      await probe();
    }
    test.comment('pressed ' + count + ' tool and tab buttons');
    const list = Object.keys(seen).map(function (k) { return seen[k]; });
    const bad = list.filter(function (p) { return !p.kept || !p.inside || p.spilt; });
    ok(!bad.length, list.length ? 'each of its ' + list.length + ' scrolling boxes keeps its height when given too much, inside its box' : 'it draws no scrolling box', 'not so: ' + short(bad));
    const spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');
    ok(spills === false, 'it never grows its box, and the page never scrolls sideways', 'its box overflows, or the page scrolls sideways');

    test.subHeading(NAMED + ': ' + 'destroy leaves its box empty');
    const destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
    ok(destroyed === 'empty' || destroyed === 'none', destroyed === 'none' ? 'it has no destroy of its own (an app is closed by the face)' : 'destroyed, its box is empty', 'after destroy its box still holds what it drew');
  } finally {
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    if (!node.shared) try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [node.shared ? '' : node.root, page && page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
