'use strict';

// spirit/run/spirit/test/spirit-cacheManager.js
// A PAGE FINDS A FAMILY'S data.js BY THE FOLDER SHAPE, NEVER BY FS.path (goal/G43.27, requirement 6; spec:
// ./spirit-cacheManager.md): spirit.js's cacheManager. Andy: "spirit.js can be fixed, no? it knows the difference between an
// app and a system branch?". spirit.js read as it is, comments stripped, and a real page (headless Chrome) of a scratch node
// (headLessChrome.scratchNode), never a live one.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('spirit-cacheManager.js: a page finds a family\'s data.js by the folder shape, never by FS.path (goal/G43.27)');

(async function () {
  test.subHeading('6. a page finds a family\'s data.js by the folder shape, never by FS.path');
  const sj = code(read('spirit/spirit.js'));
  ok(sj.length > 1000 && /function cacheManager/.test(sj), 'the world: spirit.js and its cacheManager are read', 'no cacheManager in spirit.js: nothing judged');
  const cm = (sj.match(/function cacheManager[\s\S]*?\n  }\n/) || [''])[0];
  ok(cm && !/FS\.path|\.FS\b/.test(cm), 'cacheManager asks no FS.path, on a page or in node', 'cacheManager still asks the family\'s FS: ' + short((cm.match(/.*FS.*/) || [''])[0].trim()));
  ok(!/\.FS\.path\s*\(|FS\.path\b/.test(sj), 'spirit.js asks FS.path nowhere', 'spirit.js still asks FS.path');

  // ON A REAL PAGE: every family the node names whose data.js is in the tree is loaded by spirit.cacheManager, an app's and a
  // system family's alike, also where an app has a system family's name (contact). The agent app is switched on, so its
  // family is among them.
  const node = await H.scratchNode();
  ok(!!node.up, 'the world: a scratch node is up', 'the scratch node did not come up: nothing judged');
  const ask = function (call, args) {
    return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
      .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
  };
  if (node.up) {
    await ask('app.active', { key: 'agent', active: true });
    await H.until(function () { return ask('api', { family: 'agent' }).then(function (a) { return a.status === 200; }); }, 30000);
  }
  const chrome = H.findChrome();
  const page = chrome && node.up ? await H.chromePage(chrome) : null;
  let loaded = null;
  if (page && !page.error) {
    await page.send('Page.navigate', { url: node.base + '/' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.ready)'); }, 30000);
    loaded = await page.evaluate("Promise.resolve(window.spirit.ready).then(function (s) { return s.tree(); }).then(function (t) { return Promise.all(Object.keys(t || {}).map(function (n) { return window.spirit.cacheManager(n).then(function () { return [n, 'ok']; }, function (e) { return [n, String((e && e.message) || e)]; }); })); })");
  }
  const withData = function (n) { return ['spirit/' + n + '/data.js', 'spirit/app/' + n + '/data.js'].some(function (p) { return fs.existsSync(path.join(RUN, p)); }); };
  const judged = (loaded || []).filter(function (r) { return withData(r[0]); });
  ok(judged.length >= 5 && judged.some(function (r) { return r[0] === 'contact'; }), 'the world: a page asks the cache of ' + judged.length + ' families with a data.js, contact among them', 'a page asked ' + short(loaded) + ': nothing judged');
  judged.forEach(function (r) { ok(r[1] === 'ok', 'on a page, spirit.cacheManager("' + r[0] + '") loads its data.js', 'on a page, spirit.cacheManager("' + r[0] + '"): ' + r[1]); });
  if (page && page.kid) page.kid.kill();
  if (node.child) node.child.kill();

  test.reportSuccessFailureCount();
  process.exit(0);
})();
