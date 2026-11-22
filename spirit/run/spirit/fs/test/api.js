'use strict';

// spirit/run/spirit/fs/test/api.js
// The tests of spirit/fs/api.js's kernel names, and of no other module (spec: ./api.md). This file holds goal/G41.30: a
// refusal is not "nothing there" (Andy, of a face with no star: "not found (or empty) — you can still Save to create it").
// One test.run per test (goal/G47.2).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const api = require(path.join(RUN, 'spirit', 'fs', 'api.js'));

function refused(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
const names = function (answer) { return api.names(function () { return answer(); }, {}); };

// spirit/fs/api.js: a refusal is not "nothing there" (goal/G41.30)
test.run('loadFile, refused by the face\'s gate, rejects with the node\'s own code and words', 0.2, async function () {
  const off = refused(403, 'not-from-the-face', 'fs.load is off the face until a face can prove it is the owner');
  let got = null; let threw = null;
  try { got = await names(function () { return Promise.reject(off); }).loadFile('media/dummy.txt'); } catch (e) { threw = e; }
  return !!threw && threw.code === 'not-from-the-face' && /off the face/.test(threw.message) ? true : false;
}, test.limit.quick);
test.run('loading a file that is not there still answers null', 0.2, async function () {
  let missing = 'unset';
  try { missing = await names(function () { return Promise.reject(refused(404, 'not-found', 'no such file')); }).loadFile('media/none.txt'); } catch (e) { /* a throw leaves it unset */ }
  return missing === null ? true : false;
}, test.limit.quick);
test.run('loading a file that is there answers its text', 0.2, async function () {
  const text = await names(function () { return Promise.resolve({ text: 'hello' }); }).loadFile('media/a.txt');
  return text === 'hello' ? true : false;
}, test.limit.quick);

// GOAL/G43.20 (Andy: "ANNOTATIONS WILL BE NODE ONLY."): no caller reads or writes an annotation.
test.run('the branch has no fs.annotations and no fs.annotate', 0.2, function () {
  return !('annotations' in api.verbs) && !('annotate' in api.verbs) ? true : false;
}, test.limit.quick);
test.run('the branch has no getAnnotations among its kernel names', 0.2, function () {
  return !('getAnnotations' in names(function () { return Promise.resolve({}); })) ? true : false;
}, test.limit.quick);

// A FILE VERB NEVER CLIMBS OUT OF THE RUN FOLDER (goal/G47.6, box: "a peer asking a file verb for ../, a full path or a drive
// letter is refused by the spirit object's path rule at the door"). The node checks every call against the verbs declared
// here with spirit.check; each file verb's path, asked as one of these, is refused there and never reaches the disc.
const spirit = require(path.join(RUN, 'spirit', 'spirit.js'));
const CLIMBS = ['../x', 'a/../../x', '..\\x', '/etc/passwd', '\\x', 'C:/x', 'c:\\x', 'a\u0000b'];
const FILE_VERBS = ['stat', 'load', 'save', 'delete'];
test.run('every file verb asked for a path that climbs out, starts at the top or names a drive is refused by the path rule', 0.8, function () {
  const bad = [];
  FILE_VERBS.forEach(function (v) {
    CLIMBS.forEach(function (p) {
      const args = v === 'save' ? { path: p, content: 'x' } : { path: p };
      const r = spirit.check('fs.' + v, api.verbs[v], args);
      if (!r || !r.code) bad.push(v + ' ' + JSON.stringify(p));
    });
  });
  return bad.length === 0;
}, test.limit.quick);
test.run('a file verb asked for a plain path inside the run folder passes the path rule', 0.2, function () {
  return FILE_VERBS.every(function (v) { return !spirit.check('fs.' + v, api.verbs[v], v === 'save' ? { path: 'media/a.txt', content: 'x' } : { path: 'media/a.txt' }); });
}, test.limit.quick);

// ── spirit.fs in node reads its own disc (goal/G49.2) ──
// Andy: "THE REASON that spirit.fs was conceived in the first place was so many modules can live unchanged on both node
// and browser", "the old kernel.js ... would insert different versions of spirit.fs functions depending on isNode() and
// isBrowser()", the node versions async "like the are in the browser"; "agreed. fix spirit.fs NOW". In a node process
// whose run root names no node at all (no spirit/state/environment.json), spirit.fs.stat, load, save and delete still
// answer, from that process's own disc, as promises in the shapes the node's verbs answer: stat {size, mtimeMs,
// birthtimeMs}, load {path, text}; a file that is not there is refused with status 404, as the node refuses it. The files
// sit in media/, which the node's write rules let a caller write; spirit/ holds core files, refused alike on both sides.
const fsNode = require('fs');
const { spawnSync } = require('child_process');
const tempFolder = require(path.join(RUN, 'spirit', 'tempFolder.js'));
test.after(function () { try { fsNode.rmSync(tempFolder.path('spirit/fs/test/api'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const LOCAL = {};
test.run('the world: a run root with no node, and a process asking its spirit.fs', 0.2, function () {
  const root = tempFolder('spirit/fs/test/api/noNode');
  fsNode.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true, filter: function (src) { return src !== path.join(RUN, 'spirit', 'state'); } });
  fsNode.mkdirSync(path.join(root, 'media', 'zzLocal'), { recursive: true });
  fsNode.writeFileSync(path.join(root, 'media', 'zzLocal', 'hello.txt'), 'hello local');
  LOCAL.root = root;
  const script = `
    const s = require(${JSON.stringify(path.join(root, 'spirit', 'spirit.js'))});
    const out = {};
    function settle(p) { return Promise.resolve(p).then(function (v) { return { ok: v }; }, function (e) { return { no: { status: e && e.status, code: e && e.code } }; }); }
    (async function () {
      await settle(s.require('spirit/fs/api.js'));
      const f = s.fs || {};
      const st = f.stat ? f.stat({ path: 'media/zzLocal/hello.txt' }) : null;
      out.statIsPromise = !!st && typeof st.then === 'function';
      out.stat = await settle(st);
      out.load = await settle(f.load ? f.load({ path: 'media/zzLocal/hello.txt' }) : Promise.reject(new Error('none')));
      out.save = await settle(f.save ? f.save({ path: 'media/zzLocal/saved.txt', content: 'saved here' }) : Promise.reject(new Error('none')));
      out.del = await settle(f.delete ? f.delete({ path: 'media/zzLocal/hello.txt' }) : Promise.reject(new Error('none')));
      out.missing = await settle(f.stat ? f.stat({ path: 'media/zzLocal/hello.txt' }) : Promise.reject(new Error('none')));
      process.stdout.write(JSON.stringify(out));
      process.exit(0);
    })().catch(function (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.message) })); process.exit(0); });
  `;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 20000 });
  try { LOCAL.o = JSON.parse(r.stdout); } catch (e) { LOCAL.o = null; }
  return !!LOCAL.o && !LOCAL.o.threw;
}, test.limit.slow);
test.run('with no node, spirit.fs.stat answers a promise of {size, mtimeMs, birthtimeMs} from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  const v = o.stat && o.stat.ok;
  return (o.statIsPromise === true && !!v && v.size === Buffer.byteLength('hello local') && typeof v.mtimeMs === 'number' && typeof v.birthtimeMs === 'number') || false;
}, test.limit.quick);
test.run('with no node, spirit.fs.load answers {path, text} from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  const v = o.load && o.load.ok;
  return (!!v && v.text === 'hello local' && v.path === 'media/zzLocal/hello.txt') || false;
}, test.limit.quick);
test.run('with no node, spirit.fs.save writes the file on the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  let text = null;
  try { text = fsNode.readFileSync(path.join(LOCAL.root, 'media', 'zzLocal', 'saved.txt'), 'utf8'); } catch (e) { text = null; }
  return (!!o.save && 'ok' in o.save && text === 'saved here') || false;
}, test.limit.quick);
test.run('with no node, spirit.fs.delete removes the file from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  return (!!o.del && 'ok' in o.del && !fsNode.existsSync(path.join(LOCAL.root, 'media', 'zzLocal', 'hello.txt'))) || false;
}, test.limit.quick);
test.run('with no node, spirit.fs.stat of a file that is not there is refused with status 404', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  return (!!o.missing && !!o.missing.no && o.missing.no.status === 404) || false;
}, test.limit.quick);
