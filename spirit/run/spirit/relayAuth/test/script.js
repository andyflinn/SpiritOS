'use strict';

// spirit/run/spirit/relayAuth/test/script.js
// The tests of spirit/relayAuth/script.js, and of no other module (spec: ./script.md). Its keys, signatures and grants are
// judged where they are used (apiAuth, contacts, faceHome, relay); this file holds what is relayAuth's own.
//
// THE NODE'S IDENTITY IS KEPT IN MEMORY ONCE READ (goal/G47.1; Andy: "why is the tiny bit of memory to expensive to cache
// the identity of the node?", and of cw's fix: "we need a red so no fool takes your fix out again"): the node asked for it
// on every owner call, a disc read of identity.json and a parse of its key each time, on its one thread. saveIdentity, the
// one writer of identity.json, drops what is kept, so a new name or key is read on the next ask.
//
// In a child process of its own, on a scratch state folder: the reads of identity.json counted.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/relayAuth/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/relayAuth'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const AUTH = path.join(RUN, 'spirit', 'relayAuth', 'script.js');

let root = '', seen = null;
test.after(function () { try { if (root) fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

test.run('a scratch node identity is asked fifty times, saved anew and asked again, with every read of identity.json counted', 0.2, function () {
  root = ownTemp('spirit-relayAuth-');
  fs.mkdirSync(path.join(root, 'spirit', 'state'), { recursive: true });
  const src = [
    "const fs = require('fs'), path = require('path');",
    "const auth = require(" + JSON.stringify(AUTH) + ");",
    "const root = process.argv[1];",
    "const file = path.join(root, 'spirit', 'state', 'identity.json');",
    "const id = auth.generateIdentity('first');",
    "auth.saveIdentity(root, id);",
    "const read = fs.readFileSync; let reads = 0;",
    "fs.readFileSync = function (f) { if (path.resolve(String(f)) === path.resolve(file)) reads += 1; return read.apply(fs, arguments); };",
    "let first = null; for (let i = 0; i < 50; i++) { const got = auth.loadIdentity(root); if (!first) first = got; }",
    "const fifty = reads;",
    "first.label = 'changed by a caller'; first.name = 'changed by a caller';",
    "const after = auth.loadIdentity(root);",
    "const own = after.label !== 'changed by a caller' && after.name !== 'changed by a caller';",
    "auth.saveIdentity(root, Object.assign({}, id, { name: 'second', label: 'second' }));",
    "reads = 0;",
    "const renamed = auth.loadIdentity(root);",
    "fs.readFileSync = read;",
    "console.log(JSON.stringify({ fifty: fifty, own: own, renamedName: renamed && (renamed.name || renamed.label), readAfterSave: reads, firstName: id.name || id.label || '' }));",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', src, root], { cwd: RUN, encoding: 'utf8', timeout: 60000 });
  try { seen = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { seen = null; }
  return !!seen || false;
}, test.limit.slow);
test.run('asked fifty times, the identity is read from disc once', 0.2, function () {
  if (!seen) return false;
  return seen.fifty === 1 || false;
}, test.limit.quick);
test.run('each caller gets its own copy: a caller changing what it was given changes nothing the next caller gets', 0.2, function () {
  if (!seen) return false;
  return seen.own === true || false;
}, test.limit.quick);
test.run('after saveIdentity, the next ask reads identity.json again', 0.2, function () {
  if (!seen) return false;
  return seen.readAfterSave === 1 || false;
}, test.limit.quick);
test.run('after saveIdentity, the next ask has the new name', 0.2, function () {
  if (!seen) return false;
  return seen.renamedName === 'second' || false;
}, test.limit.quick);

// THE HINT SIGNATURE GOES (goal/G47.1, the cycle "the route caching goes", box v69: "A post carries no hints: the node
// sends none, the hint signature goes, and the relay takes a post with hints no more").
test.run('relayAuth hands out no hint signature: neither hintMessage nor hintsSigned', 0.2, function () {
  const auth = require(AUTH);
  const left = ['hintMessage', 'hintsSigned'].filter(function (n) { return typeof auth[n] === 'function'; });
  return (typeof auth.loadIdentity === 'function' && !left.length) || false;
}, test.limit.quick);
