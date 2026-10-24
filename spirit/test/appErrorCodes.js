'use strict';

// spirit/test/appErrorCodes.js
// goal/G16.11: app error codes leave the shared register (A3 of the review of 2026-10-10). Written first, red on
// today's code, by claude-windows; the build is the other agent's.
//
// THE HOLE: spiritErrors.js, loaded by node and relay alike, defines codes that belong to apps (the desk's taken,
// box-moved, not-offered, no-such-item; deskClient's unblocked; chatClerver's peer-blocked; fileServer's pool-full,
// no-such-file, already-exists), and an app cannot define its own because define throws 'already declared'.
//
// DECIDED (Andy, 2026-10-11): "yes. get the bloody app error codes out of the core." and "and make sure their codes
// start with \"appServerName: error text\" so the origin of the error is clear." The shape, as proposed and
// decided: an app declares its own codes to appServer beside its verbs, status and text per code; appServer maps a
// refusal by the app's declaration first and the register second; the name in front is put there by appServer, never
// typed by the app, so no app can wear another's name. Nothing on the wire changes: the same codes travel.
//
// THE DECLARATION THIS RED NAMES: appServer.serve(verbs, { codes: { '<code>': { status: <n>, text: '<text>' } } }).
// The app's name is the one appServer already knows when the node starts it: the server script's own name (a server
// at .../probeApp/probeApp.js is probeApp).
//
// WHAT IS ASSERTED
//   1. The register holds none of the nine app codes.
//   2. A code an app declares is refused by its own name, with its declared status, and the error text reads
//      "<app name>: <declared text>".
//   3. The name in front is appServer's: a declared text that already names another app still gets this app's name
//      first, so it cannot pass for that app's error.
//   4. The controls: a code neither declared nor registered stays handler-failed; a register code still passes
//      through as before.
//   5. The four apps declare their own codes: desk, deskClient, chatClerver and fileServer each hand serve() a codes
//      declaration naming every one of theirs.
// rule/11: through testSupport only; a temporary app server on its own pipe, started as the node starts one.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const errors = require('../run/spirit/spiritErrors.js');
const { pipeRequest } = require('../run/spirit/relayRequest.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G16.11: ';
const RUN = path.join(__dirname, '..', 'run');
const HELPER = path.join(RUN, 'spirit', 'appServer.js');

const APP_CODES = {
  desk: ['taken', 'box-moved', 'not-offered', 'no-such-item'],
  deskClient: ['unblocked'],
  chatClerver: ['peer-blocked'],
  fileServer: ['pool-full', 'no-such-file', 'already-exists'],
};

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function ask(pipe, body) {
  return pipeRequest(pipe, 'POST', '/', JSON.stringify(body), { type: 'application/json', timeoutMs: 3000 }).then(function (a) {
    let parsed = null;
    try { parsed = JSON.parse(a.text); } catch (e) { parsed = null; }
    return { status: a.status, body: parsed };
  }, function () { return { status: 0, body: null }; });
}
function tmpPipe(name) {
  const p = appClient.pipePathFor(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appcodes-')), name);
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) { /* the pipe's folder may exist */ }
  return p;
}

test.startTest('goal/G16.11: app error codes leave the shared register');

(async function () {
  // ── 1. THE REGISTER HOLDS NONE OF THEM ─────────────────────────────────
  test.subHeading('1. the shared register defines no app code');
  {
    const left = [];
    Object.keys(APP_CODES).forEach(function (app) {
      APP_CODES[app].forEach(function (code) { if (errors.byCode(code)) left.push(app + ' ' + code); });
    });
    if (!left.length) test.check('none of the nine app codes is in spiritErrors.js');
    else test.fail(OWED + left.length + ' app code(s) still in the register: ' + left.join(', '));
  }

  // ── 2, 3, 4. A REAL APP SERVER, STARTED AS THE NODE STARTS ONE ──────────
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appcodes-app-'));
  const appDir = path.join(dir, 'probeApp');
  fs.mkdirSync(appDir);
  const script = path.join(appDir, 'probeApp.js');
  fs.writeFileSync(script,
    'var appServer = require(' + JSON.stringify(HELPER) + ');\n' +
    'function refuse(code) { return function () { var e = new Error(code); e.refusal = code; throw e; }; }\n' +
    'appServer.serve({\n' +
    "  full:    { request: {}, reply: {}, handler: refuse('probe-full') },\n" +
    "  forged:  { request: {}, reply: {}, handler: refuse('probe-forged') },\n" +
    "  unknown: { request: {}, reply: {}, handler: refuse('probe-never-declared') },\n" +
    "  bad:     { request: {}, reply: {}, handler: refuse('bad-request') },\n" +
    '}, { codes: {\n' +
    "  'probe-full':   { status: 409, text: 'the probe is full' },\n" +
    "  'probe-forged': { status: 409, text: 'desk: taken by another agent' },\n" +
    '} });\n');
  const pipe = tmpPipe('probeApp');
  const child = spawn(process.execPath, [script, '--pipe', pipe], { stdio: 'ignore' });
  let up = false;
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    const a = await ask(pipe, 'api');
    if (a.status === 200) { up = true; break; }
    await new Promise(function (r) { setTimeout(r, 150); });
  }

  test.subHeading('2. a code the app declares is refused by its name, its status and "<app>: <text>"');
  {
    const a = up ? await ask(pipe, { full: {} }) : null;
    const b = a && a.body;
    if (b && a.status === 409 && b.ok === false && b.code === 'probe-full' && b.error === 'probeApp: the probe is full') {
      test.check('the declared probe-full arrives as 409 probe-full "probeApp: the probe is full"');
    } else {
      test.fail(OWED + (up ? 'a declared code answered ' + a.status + ' ' + short(b)
        : 'the probe app did not start; serve(verbs, {codes}) may refuse the declaration'));
    }
  }

  test.subHeading('3. the name in front is appServer\'s, so an app cannot wear another\'s');
  {
    const a = up ? await ask(pipe, { forged: {} }) : null;
    const b = a && a.body;
    if (b && b.code === 'probe-forged' && typeof b.error === 'string' && b.error.indexOf('probeApp: ') === 0) {
      test.check('a declared text naming another app still reads "probeApp: ..." first');
    } else {
      test.fail(OWED + 'a forged origin answered ' + (a ? a.status + ' ' + short(b) : 'nothing'));
    }
  }

  test.subHeading('4. the controls: undeclared stays handler-failed, a register code passes as before');
  {
    const u = up ? await ask(pipe, { unknown: {} }) : null;
    if (u && u.body && u.body.code === 'handler-failed') test.check('a code neither declared nor registered is handler-failed');
    else test.fail(OWED + 'an undeclared code answered ' + (u ? u.status + ' ' + short(u.body) : 'nothing'));
    const r = up ? await ask(pipe, { bad: {} }) : null;
    const reg = errors.byCode('bad-request');
    if (r && r.body && r.body.code === 'bad-request' && reg && r.status === reg.status) {
      test.check('a register code (bad-request) still passes through with its register status');
    } else {
      test.fail(OWED + 'a register code answered ' + (r ? r.status + ' ' + short(r.body) : 'nothing'));
    }
  }
  try { child.kill(); } catch (e) { /* already gone */ }

  // ── 5. THE FOUR APPS DECLARE THEIR OWN ─────────────────────────────────
  test.subHeading('5. desk, deskClient, chatClerver and fileServer declare their own codes');
  Object.keys(APP_CODES).forEach(function (app) {
    let src = '';
    try { src = fs.readFileSync(path.join(RUN, 'process', 'js', app, app + '.js'), 'utf8'); } catch (e) { src = ''; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
    const at = src.search(/\bcodes\s*:\s*\{/);
    const decl = at === -1 ? '' : src.slice(at, at + 4000);
    const missing = APP_CODES[app].filter(function (code) {
      return !new RegExp('[\'"]' + code.replace(/-/g, '\\-') + '[\'"]\\s*:\\s*\\{').test(decl);
    });
    if (at !== -1 && !missing.length) test.check(app + ' declares ' + APP_CODES[app].join(', ') + ' itself');
    else test.fail(OWED + app + (at === -1 ? ' hands serve() no codes declaration' : ' does not declare ' + missing.join(', ')));
  });

  test.reportSuccessFailureCount();
})();
