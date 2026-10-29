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
// HOW: a scratch copy of spirit/run (the tracked files) on a node of its own, on a free port, so neither Andy's node nor
// an agent's is touched. Headless Chrome, driven over its debugging port with node's own WebSocket, opens the node's
// bare mount page, shell/mount.html?file=<file>: spirit.js alone, then the one app or element, mounted by itself into a
// box of the whole page. What the page reports, and the real layout it drew, are judged here.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, execSync } = require('child_process');
// The product test system's own reporter (goal/G40.13): nothing of spirit/run/ reaches into the old test system.
const test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const arg = String(process.argv[2] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
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
  return { root: root, base: base, child: child, up: up };
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

test.startTest('boot-sibling-generalRules: ' + (rel || '(no file given)'));

(async function () {
  if (!full) { test.fail('no shell app or element to judge: ' + JSON.stringify(arg)); return; }
  const chrome = findChrome();
  if (!chrome) { test.fail('no Chrome on this machine (set SPIRIT_CHROME to its path): the UI rules cannot be judged'); return; }
  const node = await scratchNode();
  let page = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: every rule here would blame the wrong thing'); return; }
    page = await chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }

    test.subHeading('it loads by itself');
    // THE BARE MOUNT PAGE: spirit.js alone, then this one file, mounted by itself (rule/26: "every element loads its own
    // parts via spirit.require; nothing is preloaded"). shell/mount.html is the node's own page for it.
    const mountPage = await fetch(node.base + '/shell/mount.html');
    ok(mountPage.status === 200, 'the node serves its bare mount page, shell/mount.html', 'shell/mount.html answered ' + mountPage.status);
    if (mountPage.status !== 200) return;
    await page.send('Page.navigate', { url: node.base + '/shell/mount.html?file=' + encodeURIComponent(rel) });
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

    test.subHeading('it draws, in the box it is given');
    const drew = await page.evaluate('(function () { var b = window.spiritMount.box; return !!b && b.childElementCount > 0 && b.getBoundingClientRect().height > 0; }())');
    ok(drew === true, 'it draws something into its box', 'its box is empty');

    test.subHeading('every list in a box of a stated size (rule/16)');
    // Every tool and tab it draws is pressed in turn, so each list it can show is made and judged.
    const pressed = await page.evaluate('(async function () { var bs = Array.prototype.slice.call(window.spiritMount.box.querySelectorAll("[data-tool],[data-tab]")); ' +
      'for (var i = 0; i < bs.length; i++) { bs[i].click(); await new Promise(function (r) { setTimeout(r, 400); }); } return bs.length; }())');
    test.comment('pressed ' + pressed + ' tool and tab buttons');
    // rule/16: every probabilitySearch in a box of class fill, inside a pane that fills its app; a dropdown stands inline
    // and is not asked. The page keeps the box of each list it made (window.spiritMount.panes); every box from it to the
    // mount box is fill, and the list lies inside the mount box, not below it.
    const panes = await page.evaluate('JSON.stringify((window.spiritMount.panes || []).map(function (h) {' +
      ' var box = window.spiritMount.box; var gaps = []; for (var n = h; n && n !== box; n = n.parentNode) { if (!n.classList || !n.classList.contains("fill")) gaps.push((n.tagName || "?").toLowerCase() + (n.id ? "#" + n.id : "")); }' +
      ' var r = h.getBoundingClientRect(), bx = box.getBoundingClientRect(); return { gaps: gaps, inside: r.bottom <= bx.bottom + 1 }; }))');
    const list = panes ? JSON.parse(panes) : [];
    const bad = list.filter(function (p) { return p.gaps.length || !p.inside; });
    ok(!bad.length, list.length ? 'each of its ' + list.length + ' lists stands in fill boxes up to its box, inside it' : 'it draws no list pane', 'not so: ' + short(bad));
    const spills = await page.evaluate('(function () { var b = window.spiritMount.box; return b.scrollHeight > b.clientHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1; }())');
    ok(spills === false, 'it never grows its box, and the page never scrolls sideways', 'its box overflows, or the page scrolls sideways');

    test.subHeading('destroy leaves its box empty');
    const destroyed = await page.evaluate('(function () { var m = window.spiritMount; if (typeof m.destroy !== "function") return "none"; m.destroy(); return m.box.childElementCount === 0 ? "empty" : "left"; }())');
    ok(destroyed === 'empty' || destroyed === 'none', destroyed === 'none' ? 'it has no destroy of its own (an app is closed by the face)' : 'destroyed, its box is empty', 'after destroy its box still holds what it drew');
  } finally {
    if (page && page.sock) try { page.sock.close(); } catch (e) { /* gone */ }
    if (page && page.kid) try { page.kid.kill(); } catch (e) { /* gone */ }
    try { node.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    [node.root, page && page.profile].forEach(function (d) { if (d) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
