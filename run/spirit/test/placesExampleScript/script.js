'use strict';
// goal/G50.1, the box: "spirit.requireScript('spirit/test/files/exampleScript.js') must place spirit/test/files/exampleScript.js
// exacty at spirit.test.files.exampleScript, both in the browser and node.js", and "if ... export a function, factory,
// object, string.. it must appear as that type". Since box v24 test data lives in the test's own files/, so the script is
// spirit/test/placesExampleScript/files/exampleScript.js and lands at spirit.test.placesExampleScript.files.exampleScript.
// It exports a function answering 'exampleScript answers'. In node the subject's spirit object holds that function there
// once requireScript has answered; in the browser a headless Chrome opens /spirit/ on the server, started on a free port,
// and asks the same of window.spirit. No Chrome, red.
// The shape is box v24's test contract: one exported function, handed the exact spirit path of its subject (the script.js
// two folders up), answering true or false or a promise of either; loaded by spirit.requireScript, which hands it the
// require of repo://run/spirit/script.js, so repo://run/ is one folder above what './script.js' resolves to.
module.exports = function (subject) {
  var fs = require('fs');
  var os = require('os');
  var path = require('path');
  var net = require('net');
  var http = require('http');
  var spawn = require('child_process').spawn;
  var run = path.join(path.dirname(require.resolve('./script.js')), '..');
  var DATA = 'spirit/test/placesExampleScript/files/exampleScript.js';
  var WANT = 'exampleScript answers';
  var children = [];
  var profile = '';
  function done(v) {
    children.forEach(function (c) { try { c.kill('SIGKILL'); } catch (e) { /* gone */ } });
    if (profile) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* left */ } }
    return v;
  }
  async function inNode() {
    var spirit = require(path.join(run, subject));
    await spirit.requireScript(DATA);
    var p = spirit.test && spirit.test.placesExampleScript && spirit.test.placesExampleScript.files && spirit.test.placesExampleScript.files.exampleScript;
    return typeof p === 'function' && p() === WANT;
  }
  function freePort() {
    return new Promise(function (resolve) {
      const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
    });
  }
  function getJson(url) {
    return new Promise(function (resolve, reject) {
      http.get(url, function (res) { let b = ''; res.on('data', function (c) { b += c; }); res.on('end', function () { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
    });
  }
  function until(test, ms) {
    return new Promise(function (resolve, reject) {
      const t0 = Date.now();
      (async function again() {
        let v = null;
        try { v = await test(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (Date.now() - t0 > ms) return reject(new Error('timeout'));
        setTimeout(again, 100);
      })();
    });
  }

  async function inBrowser() {
    const port = await freePort();
    children.push(spawn(process.execPath, [path.join(run, 'spirit', 'server', 'script.js'), '--port', String(port)], { stdio: 'ignore' }));
    await until(function () { return new Promise(function (r) { http.get('http://127.0.0.1:' + port + '/spirit/', function (res) { res.resume(); r(res.statusCode === 200); }).on('error', function () { r(false); }); }); }, 5000);
    profile = fs.mkdtempSync(path.join(os.tmpdir(), 'g50-chrome-'));
    const chrome = spawn('google-chrome', ['--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    chrome.on('error', function () { /* no Chrome: the DevTools port never comes, red */ });
    children.push(chrome);
    const debugPort = await until(function () { try { return fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) { return null; } }, 10000);
    const target = await until(async function () { const l = await getJson('http://127.0.0.1:' + debugPort + '/json/list'); return l.find(function (t) { return t.type === 'page'; }); }, 5000);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(function (r, j) { ws.onopen = r; ws.onerror = j; });
    let id = 0; const waiting = {};
    ws.onmessage = function (m) { const d = JSON.parse(m.data); if (d.id && waiting[d.id]) { waiting[d.id](d); delete waiting[d.id]; } };
    function send(method, params) { return new Promise(function (r) { const n = ++id; waiting[n] = r; ws.send(JSON.stringify({ id: n, method: method, params: params || {} })); }); }
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/spirit/' });
    await until(async function () { const r = await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && !!window.spirit', returnByValue: true }); return r.result && r.result.result && r.result.result.value === true; }, 10000);
    const r = await send('Runtime.evaluate', {
      expression: 'Promise.resolve(window.spirit.requireScript("spirit/test/placesExampleScript/files/exampleScript.js")).then(function () {' +
        ' var p = window.spirit.test && window.spirit.test.placesExampleScript && window.spirit.test.placesExampleScript.files && window.spirit.test.placesExampleScript.files.exampleScript;' +
        ' return typeof p === "function" && p() === ' + JSON.stringify(WANT) + '; })',
      awaitPromise: true, returnByValue: true
    });
    ws.close();
    return !!(r.result && r.result.result && r.result.result.value === true);
  }

  return (async function () {
    var node = false, browser = false;
    try { node = await inNode(); } catch (e) { node = false; }
    try { browser = await inBrowser(); } catch (e) { browser = false; }
    return done(node && browser);
  })().catch(function () { return done(false); });
};
