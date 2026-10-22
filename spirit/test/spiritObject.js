'use strict';

// spirit/test/spiritObject.js
// goal/G32.1: the spirit object, the node api for face apps. Red on today's tree; claude-windows writes it and builds it
// (one agent). The box (v6), in short:
//   - One hand-coded file, face/spirit.js: the relay serves it as the very first script, inline in face.html; the home
//     node's index.html loads it; it runs in node too, for server processes.
//   - Every family folder holds its api.js, written to the node's standard (one shape, the same checks); the object is
//     assembled from them, one member per family: spirit.fs., spirit.jobs., spirit.contact. ... each verb asynchronous.
//   - The fs family keeps the kernel's names (loadFile, loadDataUrl, statFile, getAnnotations, saveFile, deleteFile);
//     error(), formatBytes(), escapeHtml() are the object's own.
//   - The check is complete: every argument of every call checked before it goes out (shape and field rules, by
//     js/fieldRules.js); a malformed call never leaves; a reply not 2xx refuses.
// NAMED HERE: face/spirit.js exports createSpirit({ ask(verb, args) -> Promise<{status, body}> }) -> Promise<spirit>;
// since goal/G32.3 the families are api's names and each interface is api {family}; a family's api.js is module.exports =
// { verbs: { <verb>: { <arg>: '<rule>[?]' } },
// names(call) }; a refusal is an Error with .code ('no-such-argument', 'bad-request') and .status for a reply;
// serveCommon.inlineSpirit(html, runDir) puts face/spirit.js inline where face.html says <!-- spirit.js -->.
// rule/11: through testSupport only; nothing reaches a node.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G32.1: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const exists = function (rel) { return fs.existsSync(path.join(RUN, rel)); };
const FAMILIES = ['auth', 'config', 'contact', 'fs', 'jobs', 'net', 'node', 'owner', 'peer', 'relay'];

test.startTest('goal/G32.1: the spirit object, the node api for face apps');

const done = (async function () {
  test.subHeading('1. one core file, one api.js per family');
  const missing = ['face/spirit.js'].concat(FAMILIES.map(function (f) { return 'js/' + f + '/api.js'; })).filter(function (f) { return !exists(f); });
  if (!missing.length) test.check('face/spirit.js and every node family\'s api.js exist');
  else test.fail(OWED + 'missing: ' + missing.join(', '));

  // Every verb the node mounts has its function in its family's api.js.
  const server = raw('js/server.js');
  const declared = [];
  for (const b of server.matchAll(/loopbackVerbs\.mount\('([a-z][a-z0-9]*)',(?:(?!loopbackVerbs\.mount)[\s\S])*?\n {2}\}, \{ wire:/g)) {
    for (const m of b[0].matchAll(/^ {4}'([a-zA-Z0-9]+)':/gm)) declared.push([b[1], m[1]]);
  }
  const uncovered = declared.filter(function (fv) {
    let def = null;
    try { def = require(path.join(RUN, 'js', fv[0], 'api.js')); } catch (e) { def = null; }
    return !def || !def.verbs || !def.verbs[fv[1]];
  }).map(function (fv) { return fv[0] + '.' + fv[1]; });
  if (declared.length > 40 && !uncovered.length) test.check('every one of the node\'s ' + declared.length + ' verbs has its function in its family\'s api.js');
  else test.fail(OWED + 'no function for ' + uncovered.length + ' of ' + declared.length + ' verbs: ' + uncovered.slice(0, 12).join(', '));

  test.subHeading('2. the object in node: the calls, the kernel\'s names, the helpers');
  const sent = [];
  let replyStatus = 200;
  const transport = {
    ask: function (verb, args) {
      // The node's side of goal/G32.3: api answers the families, api {family} each one's interface.
      if (verb === 'api' && args && args.family) return Promise.resolve({ status: 200, body: { family: args.family, interface: fs.readFileSync(path.join(RUN, 'js', args.family, 'api.js'), 'utf8') } });
      if (verb === 'api') { const t = {}; FAMILIES.forEach(function (f) { t[f] = {}; }); return Promise.resolve({ status: 200, body: t }); }
      sent.push({ verb: verb, args: args }); return Promise.resolve({ status: replyStatus, body: { ok: true, path: args.path, text: 'hello' } });
    },
  };
  let spirit = null;
  try { spirit = await require(path.join(RUN, 'face', 'spirit.js')).createSpirit(transport); } catch (e) { spirit = { threw: e.message }; }
  const ok = spirit && spirit.fs && typeof spirit.fs.load === 'function';
  let good = null;
  try {
    const body = ok ? await spirit.fs.load({ path: 'shell/a.txt' }) : null;
    const text = ok ? await spirit.fs.loadFile('shell/a.txt') : null;
    good = { sent: sent.slice(), body: body, text: text };
  } catch (e) { good = { threw: e.message }; }
  if (good && good.sent.length === 2 && good.sent[0].verb === 'fs.load' && good.sent[0].args.path === 'shell/a.txt' && good.body && good.body.text === 'hello' && good.text === 'hello')
    test.check('spirit.fs.load({path}) asks fs.load and answers the reply; spirit.fs.loadFile(path) answers the text');
  else test.fail(OWED + 'the calls: ' + short(good || spirit));
  if (spirit && typeof spirit.formatBytes === 'function' && spirit.formatBytes(2048) === '2 KB' && typeof spirit.escapeHtml === 'function' && spirit.escapeHtml('<a>') === '&lt;a&gt;' && typeof spirit.error === 'function'
      && ['loadFile', 'loadDataUrl', 'statFile', 'getAnnotations', 'saveFile', 'deleteFile'].every(function (n) { return spirit.fs && typeof spirit.fs[n] === 'function'; }))
    test.check('the helpers are the object\'s own, and the fs family keeps the kernel\'s names');
  else test.fail(OWED + 'the helpers or the kernel\'s names are missing');

  test.subHeading('3. a malformed call never leaves');
  const refusals = {};
  async function refused(label, fn) {
    const before = sent.length;
    try { await fn(); refusals[label] = 'went out'; } catch (e) { refusals[label] = (sent.length === before ? 'kept: ' : 'sent: ') + (e && e.code); }
  }
  if (ok) {
    await refused('unknown key', function () { return spirit.fs.load({ path: 'a', bogus: 1 }); });
    await refused('missing path', function () { return spirit.fs.load({}); });
    await refused('wrong type', function () { return spirit.fs.load({ path: 7 }); });
    await refused('bad key', function () { return spirit.contact.label({ publicKey: 'not a key', myLabel: 'x' }); });
    await refused('label too long', function () { return spirit.node.setName({ name: 'x'.repeat(70) }); });
  }
  const wantKept = ['unknown key', 'missing path', 'wrong type', 'bad key', 'label too long'];
  if (ok && wantKept.every(function (k) { return /^kept: (no-such-argument|bad-request)$/.test(refusals[k] || ''); }))
    test.check('an unknown key, a missing or wrongly typed argument, a bad peer key and a label too long are refused in the page');
  else test.fail(OWED + 'refusals: ' + short(refusals));
  replyStatus = 404;
  let notFound = null;
  try { await spirit.fs.load({ path: 'shell/none.txt' }); notFound = 'resolved'; } catch (e) { notFound = e && e.status; }
  if (notFound === 404) test.check('a reply that is not 2xx refuses, with its status');
  else test.fail(OWED + 'a 404 reply: ' + short(notFound));

  test.subHeading('4. the pages: inline first on the face, loaded at home');
  const faceHtml = raw('face.html');
  let inlined = '';
  try { inlined = require(path.join(RUN, 'js', 'serveCommon.js')).inlineSpirit(faceHtml, RUN) || ''; } catch (e) { inlined = ''; }
  const firstScript = (/<script[^>]*>([\s\S]*?)<\/script>/.exec(inlined) || [])[1] || '';
  if (/<!-- spirit\.js -->/.test(faceHtml) && firstScript.indexOf('createSpirit') !== -1 && /inlineSpirit\(/.test(raw('js/relayServer.js')))
    test.check('face.html\'s first script is face/spirit.js, inline, as the relay serves it');
  else test.fail(OWED + 'face.html is not served with face/spirit.js inline as its first script');
  const idx = raw('index.html');
  if (idx.indexOf('/face/spirit.js') !== -1 && /window\.spirit/.test(raw('js/kernel.js')) && /Object\.keys\(window\.spirit\)/.test(raw('js/kernel.js')))
    test.check('index.html loads face/spirit.js, and the kernel keeps the object\'s members when it sets window.spirit');
  else test.fail(OWED + 'index.html does not load face/spirit.js, or the kernel overwrites the object');
}());

done.then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
