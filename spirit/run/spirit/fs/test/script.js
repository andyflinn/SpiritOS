'use strict';

// spirit/run/spirit/fs/test/script.js
// The tests of spirit/fs/script.js's kernel names, and of no other module (spec: ./script.md). This file holds goal/G41.30: a
// refusal is not "nothing there" (Andy, of a face with no star: "not found (or empty) — you can still Save to create it").
// One test.run per test (goal/G47.2).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// THE BRANCH AS A CLIENT HAS IT (goal/G49.6; Andy: clients load their api.js from their own node's disc): bound by
// spirit.requireScript from the api.js on this disc, no node asked; it carries the file's own names, names() among them.
let api = null;

function refused(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
const names = function (answer) { return api.names(function () { return answer(); }, {}); };

test.run('spirit/fs/script.js is bound by spirit.requireScript from its own disc, and carries its names()', 0.2, async function () {
  try { api = await LOADER.requireScript('spirit/fs/script.js'); } catch (e) { api = null; }
  return (!!api && typeof api.names === 'function') || false;
}, test.limit.quick);

// spirit/fs/script.js: a refusal is not "nothing there" (goal/G41.30)
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
// here with spirit.checkArgs; each file verb's path, asked as one of these, is refused there and never reaches the disc.
const spirit = require(path.join(RUN, 'spirit', 'script.js'));
const CLIMBS = ['../x', 'a/../../x', '..\\x', '/etc/passwd', '\\x', 'C:/x', 'c:\\x', 'a\u0000b'];
const FILE_VERBS = ['stat', 'load', 'save', 'delete'];
test.run('every file verb asked for a path that climbs out, starts at the top or names a drive is refused by the path rule', 0.8, function () {
  const bad = [];
  FILE_VERBS.forEach(function (v) {
    CLIMBS.forEach(function (p) {
      const args = v === 'save' ? { path: p, content: 'x' } : { path: p };
      const r = spirit.checkArgs('fs.' + v, api.verbs[v], args);
      if (!r || !r.code) bad.push(v + ' ' + JSON.stringify(p));
    });
  });
  return bad.length === 0;
}, test.limit.quick);
test.run('a file verb asked for a plain path inside the run folder passes the path rule', 0.2, function () {
  return FILE_VERBS.every(function (v) { return !spirit.checkArgs('fs.' + v, api.verbs[v], v === 'save' ? { path: 'media/a.txt', content: 'x' } : { path: 'media/a.txt' }); });
}, test.limit.quick);

// ── spirit.fs in node reads its own disc (goal/G49.2) ──
// Andy: "THE REASON that spirit.fs was conceived in the first place was so many modules can live unchanged on both node
// and browser", "the old kernel.js ... would insert different versions of spirit.fs functions depending on isNode() and
// isBrowser()", the node versions async "like the are in the browser"; "agreed. fix spirit.fs NOW". In a node process
// whose run root names no node at all (no spirit/state/environment.json), the spirit.fs branch, as spirit.requireScript('spirit/fs/script.js') answers it, still has stat, load, save and delete
// answer, from that process's own disc, as promises in the shapes the node's verbs answer: stat {size, mtimeMs,
// birthtimeMs}, load {path, text}; a file that is not there is refused with status 404, as the node refuses it. The files
// sit in media/, which the node's write rules let a caller write; spirit/ holds core files, refused alike on both sides.
const fsNode = require('fs');
const { spawnSync } = require('child_process');
const tempFolder = LOADER.requireScript('spirit/tempFolder/script.js').tempFolder;
test.after(function () { try { fsNode.rmSync(tempFolder.path('spirit/fs/test/api'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const LOCAL = {};
test.run('the world: a run root with no node, and a process asking its spirit.fs', 0.2, function () {
  const root = tempFolder('spirit/fs/test/api/noNode');
  fsNode.cpSync(path.join(RUN, 'spirit'), path.join(root, 'spirit'), { recursive: true, filter: function (src) { return src !== path.join(RUN, 'spirit', 'state'); } });
  fsNode.mkdirSync(path.join(root, 'media', 'zzLocal'), { recursive: true });
  fsNode.writeFileSync(path.join(root, 'media', 'zzLocal', 'hello.txt'), 'hello local');
  LOCAL.root = root;
  const script = `
    const s = require(${JSON.stringify(path.join(root, 'spirit', 'script.js'))});
    const out = {};
    function settle(p) { return Promise.resolve(p).then(function (v) { return { ok: v }; }, function (e) { return { no: { status: e && e.status, code: e && e.code } }; }); }
    (async function () {
      // The branch as spirit.requireScript answers it (goal/G49.9: never read at a spirit.required place).
      const got = await settle(s.requireScript('spirit/fs/script.js'));
      const f = (got && got.ok) || {};
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
}, test.limit.slow, { why: 'it copies the tree and runs a child process' });
test.run('with no node, the spirit.fs branch\'s stat answers a promise of {size, mtimeMs, birthtimeMs} from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  const v = o.stat && o.stat.ok;
  return (o.statIsPromise === true && !!v && v.size === Buffer.byteLength('hello local') && typeof v.mtimeMs === 'number' && typeof v.birthtimeMs === 'number') || false;
}, test.limit.quick);
test.run('with no node, the spirit.fs branch\'s load answers {path, text} from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  const v = o.load && o.load.ok;
  return (!!v && v.text === 'hello local' && v.path === 'media/zzLocal/hello.txt') || false;
}, test.limit.quick);
test.run('with no node, the spirit.fs branch\'s save writes the file on the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  let text = null;
  try { text = fsNode.readFileSync(path.join(LOCAL.root, 'media', 'zzLocal', 'saved.txt'), 'utf8'); } catch (e) { text = null; }
  return (!!o.save && 'ok' in o.save && text === 'saved here') || false;
}, test.limit.quick);
test.run('with no node, the spirit.fs branch\'s delete removes the file from the process\'s own disc', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  return (!!o.del && 'ok' in o.del && !fsNode.existsSync(path.join(LOCAL.root, 'media', 'zzLocal', 'hello.txt'))) || false;
}, test.limit.quick);
// A MISSING FILE IS THE PROTOCOL'S NO, NOT AN HTTP FAILURE (goal/G49.25, Q18, Andy: "yes, it's no http failure when i ask a verb
// and it properly responds with an error that belongs to the api-protocol..."): the answer is ok false, code not-found.
test.run('with no node, the spirit.fs branch\'s stat of a file that is not there answers ok false, code not-found', 0.2, function () {
  const o = LOCAL.o; if (!o) return false;
  const v = o.missing && o.missing.ok;
  return (!!v && v.ok === false && v.code === 'not-found') || false;
}, test.limit.quick);

// ── THE fs BRANCH IN ITS NEW SHAPE (goal/G49.15, step 3, box v23; Andy: "go, upgrade the spirit.fs branch!") ──
// "spirit/fs/node.js --> spirit/fs/node/script.js"; "spirit/fs/fileSystem.js --> spirit/fs/fileSystem/script.js";
// "spirit/fs/script.js will move to spirit/fs/dataset/script.js"; "spirit/fs/client/script.js is essentially the moved
// spirit/fs/client/script.js"; spirit/fs/script.js "does what spirit/fs/script.js (defunct) did before": "one validator for every verb
// inside spirit/fs/script.js, that must correspond to a spirit/fs/<verb>.json file", "every value/arguments in this verb must
// be checked by a spirit/type/* field validator", "the node must use this same script as require to validate incoming
// requests"; "a folder ./ is a branch when it has ./script.js ./client/script.js".
const fsNew = require('fs');
const at = function (rel) { return fsNew.existsSync(path.join(RUN, rel)); };
// The old paths are written in pieces, so a move that rewrites every path to its new place leaves these as they are.
const OLD = function (name) { return 'spirit/fs/' + name; };
test.run('spirit/fs/ holds no api.js and no data.js any more', 0.2, function () { return (!at(OLD('api.js')) && !at(OLD('data.js'))) || false; }, test.limit.quick);
test.run('spirit/fs/client/script.js is there, the moved data.js', 0.2, function () { return at('spirit/fs/client/script.js') || false; }, test.limit.quick);
test.run('the fs dataset is spirit/fs/dataset/script.js', 0.2, function () { return at('spirit/fs/dataset/script.js') || false; }, test.limit.quick);
test.run('the node half is spirit/fs/node/script.js, and spirit/fs/node.js is gone', 0.2, function () { return (at('spirit/fs/node/script.js') && !at(OLD('node.js'))) || false; }, test.limit.quick);
test.run('the gate is spirit/fs/fileSystem/script.js, and spirit/fs/fileSystem.js is gone', 0.2, function () { return (at('spirit/fs/fileSystem/script.js') && !at(OLD('fileSystem.js'))) || false; }, test.limit.quick);
// The file cache's own conditions, asked of the tree as it stands.
const hasOnDisc = function (rel) { return at(rel); };
const flagOf = function (name) { try { const F = LOADER.requireScript('spirit/fs/filter/' + name + '/script.js'); return F[name]('spirit/fs', hasOnDisc); } catch (e) { return null; } };
test.run('the file cache marks spirit/fs a branch, and neither the old api nor an app', 0.2, function () {
  return (flagOf('branch') === true && flagOf('api') === false && flagOf('app') === false) || false;
}, test.limit.quick);
// spirit/fs/script.js: one validator per verb, each its <verb>.json's, each argument a type file.
const VERBS = ['search', 'stat', 'load', 'save', 'delete'];
let branchScript = null;
test.run('spirit/fs/script.js is required as the branch, an object holding a validator for each of its verbs', 0.2, async function () {
  try { branchScript = await LOADER.requireScript('spirit/fs/script.js'); } catch (e) { branchScript = null; }
  const v = branchScript && branchScript.verbs;
  return (!!v && typeof v === 'object' && VERBS.every(function (n) { return !!v[n] && typeof v[n] === 'object'; })) || false;
}, test.limit.quick);
test.run('every verb of spirit/fs/script.js has its spirit/fs/<verb>.json, and every <verb>.json its verb', 0.2, function () {
  const v = branchScript && branchScript.verbs;
  if (!v) return false;
  const files = fsNew.readdirSync(path.join(RUN, 'spirit', 'fs')).filter(function (f) { return /\.json$/.test(f); }).map(function (f) { return f.replace(/\.json$/, ''); });
  return (Object.keys(v).sort().join() === files.sort().join()) || false;
}, test.limit.quick);
test.run('each verb\'s arguments are its <verb>.json request, the same names and the same types', 0.2, function () {
  const v = branchScript && branchScript.verbs;
  if (!v) return false;
  return VERBS.every(function (n) {
    let req = null; try { req = JSON.parse(fsNew.readFileSync(path.join(RUN, 'spirit', 'fs', n + '.json'), 'utf8')).request; } catch (e) { req = null; }
    return !!req && JSON.stringify(Object.keys(req).sort().map(function (k) { return [k, req[k]]; })) === JSON.stringify(Object.keys(v[n]).sort().map(function (k) { return [k, v[n][k]]; }));
  }) || false;
}, test.limit.quick);
test.run('every argument of every verb names a spirit/type/<...>/script.js that is there', 0.2, function () {
  const v = branchScript && branchScript.verbs;
  if (!v) return false;
  return VERBS.every(function (n) {
    return Object.keys(v[n]).length > 0 && Object.keys(v[n]).every(function (a) { const t = String(v[n][a]).replace(/\?$/, ''); return /^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(t) && at(t); });
  }) || false;
}, test.limit.quick);
// The node validates an incoming fs call with that same script: it requires it, and a wrong argument is refused.
// goal/G49.25 (box v10: "serveCommon will load the spirit.fs branch explicitly"): the one server, spirit/server/script.js, requires
// it in loadFs, and the node boots through loadFs; spirit/server/node/script.js is gone.
test.run('the node requires spirit/fs/script.js', 0.2, function () {
  let c = ''; try { c = fsNew.readFileSync(path.join(RUN, 'spirit', 'server', 'script.js'), 'utf8'); } catch (e) { c = ''; }
  const loadFs = c.indexOf('function loadFs(');
  const body = loadFs === -1 ? '' : c.slice(loadFs, c.indexOf('\n}', loadFs));
  return (body.indexOf("requireScript('spirit/fs/script.js')") !== -1 && c.indexOf('common.loadFs(ROOT_DIR, jobs);') !== -1) || false;
}, test.limit.quick);
const NODE = { n: null };
const H = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');
test.after(async function () { try { if (NODE.n && NODE.n.release) await NODE.n.release(); } catch (e) { /* gone */ } });
function askNode(call, args) {
  return fetch(NODE.n.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
    .then(function (r) { return r.text().then(function (t) { let b = null; try { b = JSON.parse(t); } catch (e) { b = null; } return { status: r.status, body: b }; }); }, function () { return { status: 0, body: null }; });
}
test.run('a scratch node comes up', 0.2, async function () { NODE.n = await H.scratchNode(); return (!!NODE.n && NODE.n.up) || false; }, test.limit.long, { why: 'it starts a scratch node' });
test.run('the node answers spirit.fs.stat of spirit/script.js', 0.2, async function () {
  if (!NODE.n || !NODE.n.up) return false;
  const r = await askNode('spirit.fs.stat', { path: 'spirit/script.js' });
  return (r.status === 200 && !!r.body && typeof r.body.size === 'number') || false;
}, test.limit.quick);
// THE NAME ON THE WIRE IS THE BRANCH'S PATH IN DOTS (Andy, goal/G49.15: "THE NAME ON THE MOTHERCUKING WIRE IS "spirit.fs""):
// a call is spirit.fs.<verb>; the old word, fs.<verb>, is answered no more.
test.run('the node answers no call by the old word: fs.stat is refused', 0.8, async function () {
  if (!NODE.n || !NODE.n.up) return false;
  const r = await askNode('fs' + '.stat', { path: 'spirit/script.js' });
  return (r.status >= 400 && r.status < 500) || false;
}, test.limit.quick);
test.run('the node refuses spirit.fs.stat with a path that is no file path, a number, as a bad request', 0.8, async function () {
  if (!NODE.n || !NODE.n.up) return false;
  const r = await askNode('spirit.fs.stat', { path: 5 });
  return (r.status === 400 && !!r.body && r.body.code === 'bad-request') || false;
}, test.limit.quick);
test.run('the node refuses spirit.fs.stat with an argument its validator does not name', 0.8, async function () {
  if (!NODE.n || !NODE.n.up) return false;
  const r = await askNode('spirit.fs.stat', { path: 'spirit/script.js', zzExtra: 1 });
  return (r.status === 400 && !!r.body && r.body.code === 'no-such-argument') || false;
}, test.limit.quick);
test.run('the node refuses spirit.fs.save with no content', 0.8, async function () {
  if (!NODE.n || !NODE.n.up) return false;
  const r = await askNode('spirit.fs.save', { path: 'media/zzNoContent.txt' });
  return (r.status === 400 && !at('media/zzNoContent.txt')) || false;
}, test.limit.quick);
