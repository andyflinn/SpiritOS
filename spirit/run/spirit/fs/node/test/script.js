'use strict';

// spirit/run/spirit/fs/node/test/script.js
// The tests of spirit/fs/node/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// The node half of spirit.fs (goal/G49.2): answer(verb, args) -> { status, body }, what the node's fs verbs answer, done on the
// process's own disc through spirit/fs/fileSystem/script.js; undefined for a verb it does not answer (search).
// The reads are asked of this tree. What writes is asked in a copy of the tree in this suite's temp folder, by a process of
// its own, so nothing of this tree is written: the file system it uses is pinned to the run folder it stands in.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/fs/node/script.js';
const tempFolder = LOADER.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/fs/node/test/script';
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
let N = {};
try { N = LOADER.requireScript(SUBJECT) || {}; } catch (e) { N = {}; }
const ask = function (verb, args) { try { return N.answer(verb, args); } catch (e) { return null; } };

test.run('spirit.requireScript of its path hands back answer, and nothing else', 0.2, function () {
  return (typeof N.answer === 'function' && same(Object.keys(N), ['answer'])) || false;
}, test.limit.quick);
test.run('stat of a file there answers 200 with its size, mtimeMs and birthtimeMs', 0.2, function () {
  const r = ask('stat', { path: SUBJECT });
  const size = fs.statSync(path.join(RUN, SUBJECT)).size;
  return (!!r && r.status === 200 && same(Object.keys(r.body).sort(), ['birthtimeMs', 'mtimeMs', 'size']) && r.body.size === size && typeof r.body.mtimeMs === 'number') || false;
}, test.limit.quick);
// Q18, Andy: "yes, it's no http failure when i ask a verb and it properly responds with an error that belongs to the api-protocol..."
// (goal/G49.25): a missing file is the protocol's no, answered 200.
test.run('stat of a file not there answers 200, ok false, code not-found', 0.2, function () {
  const r = ask('stat', { path: 'spirit/fs/node/test/zzNoSuchFile.txt' });
  return (!!r && r.status === 200 && !!r.body && r.body.ok === false && r.body.code === 'not-found') || false;
}, test.limit.quick);
test.run('load of a file there answers 200 with its path and text', 0.2, function () {
  const r = ask('load', { path: SUBJECT });
  return (!!r && r.status === 200 && same(r.body, { path: SUBJECT, text: fs.readFileSync(path.join(RUN, SUBJECT), 'utf8') })) || false;
}, test.limit.quick);
test.run('load of a file not there, or one never served, answers 404 not-found', 0.2, function () {
  const none = { status: 404, body: { code: 'not-found' } };
  return (same(ask('load', { path: 'spirit/fs/node/test/zzNoSuchFile.txt' }), none) && same(ask('load', { path: 'spirit/fs/fileSystem/script.js' }), none)) || false;
}, test.limit.quick);
test.run('load with no path, or no arguments, answers 404 not-found', 0.2, function () {
  const none = { status: 404, body: { code: 'not-found' } };
  return (same(ask('load', {}), none) && same(ask('load', undefined), none)) || false;
}, test.limit.quick);
test.run('a verb it does not answer, search among them, answers undefined', 0.2, function () {
  return (N.answer && N.answer('search', { q: 'x' }) === undefined && N.answer('nope', {}) === undefined) || false;
}, test.limit.quick);

// THE WRITES, IN A COPY: a run folder of the tree's spirit/ without its state, media/zzNode/ a folder a caller may write.
const W = {};
test.run('the world: a copy of the tree asks its own node half to save and delete', 0.2, function () {
  const root = tempFolder(ROUTE + '/copy');
  fs.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true, filter: function (src) { return src !== path.join(RUN, 'spirit', 'state'); } });
  fs.mkdirSync(path.join(root, 'media', 'zzNode', 'aFolder'), { recursive: true });
  fs.writeFileSync(path.join(root, 'media', 'zzNode', 'gone.txt'), 'to be deleted');
  W.root = root;
  const script = `
    const s = require(${JSON.stringify(path.join(root, 'spirit', 'script.js'))});
    const N = s.requireScript(${JSON.stringify(SUBJECT)});
    const out = {};
    out.save = N.answer('save', { path: 'media/zzNode/saved.txt', content: 'saved here' });
    out.saveRoot = N.answer('save', { path: 'zzRootLevel.txt', content: 'x' });
    out.saveCore = N.answer('save', { path: 'spirit/script.js', content: 'x' });
    out.saveFolder = N.answer('save', { path: 'media/zzNode/aFolder', content: 'x' });
    out.del = N.answer('delete', { path: 'media/zzNode/gone.txt' });
    out.delMissing = N.answer('delete', { path: 'media/zzNode/neverThere.txt' });
    out.delCore = N.answer('delete', { path: 'spirit/script.js' });
    out.delFolder = N.answer('delete', { path: 'media/zzNode/aFolder' });
    process.stdout.write(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 20000 });
  try { W.o = JSON.parse(r.stdout.slice(r.stdout.indexOf('{"save"'))); } catch (e) { W.o = null; }
  return !!W.o;
}, test.limit.slow);
test.run('save writes the file and answers 204', 0.2, function () {
  const o = W.o; if (!o) return false;
  let text = null;
  try { text = fs.readFileSync(path.join(W.root, 'media', 'zzNode', 'saved.txt'), 'utf8'); } catch (e) { text = null; }
  return (same(o.save, { status: 204, body: {} }) && text === 'saved here') || false;
}, test.limit.quick);
test.run('save of a root-level file or a core file answers 403 forbidden, and writes nothing', 0.2, function () {
  const o = W.o; if (!o) return false;
  const no = { status: 403, body: { code: 'forbidden' } };
  return (same(o.saveRoot, no) && same(o.saveCore, no) && !fs.existsSync(path.join(W.root, 'zzRootLevel.txt'))
    && fs.readFileSync(path.join(W.root, 'spirit', 'script.js'), 'utf8') !== 'x') || false;
}, test.limit.quick);
test.run('save onto a folder answers 400 bad-path', 0.2, function () {
  const o = W.o; if (!o) return false;
  return same(o.saveFolder, { status: 400, body: { code: 'bad-path' } }) || false;
}, test.limit.quick);
test.run('delete removes the file and answers 204, and a file not there answers 204 too', 0.2, function () {
  const o = W.o; if (!o) return false;
  return (same(o.del, { status: 204, body: {} }) && same(o.delMissing, { status: 204, body: {} }) && !fs.existsSync(path.join(W.root, 'media', 'zzNode', 'gone.txt'))) || false;
}, test.limit.quick);
test.run('delete of a core file answers 403 forbidden, and leaves it', 0.2, function () {
  const o = W.o; if (!o) return false;
  return (same(o.delCore, { status: 403, body: { code: 'forbidden' } }) && fs.existsSync(path.join(W.root, 'spirit', 'script.js'))) || false;
}, test.limit.quick);
test.run('delete that the disc refuses answers 500 failed', 0.2, function () {
  const o = W.o; if (!o) return false;
  return (same(o.delFolder, { status: 500, body: { code: 'failed' } }) && fs.existsSync(path.join(W.root, 'media', 'zzNode', 'aFolder'))) || false;
}, test.limit.quick);
