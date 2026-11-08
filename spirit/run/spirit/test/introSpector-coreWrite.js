'use strict';

// spirit/run/spirit/test/introSpector-coreWrite.js
// A FAMILY'S FS MAY NOT WRITE A CORE FILE (goal/G43.23, item 1; spec: ./introSpector-coreWrite.md). The box: "core files unprotected: a
// family's FS.saveFile / deleteFile (introSpector.js) never asks fileWritable, so it can overwrite any api.js or app code
// (G30.21)." A real node on a scratch copy of the tracked files, asked as the owner at its own loopback door. Neither Andy's
// node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('introSpector-coreWrite.js: a family\'s FS.saveFile and FS.deleteFile are refused on a core file (goal/G43.23, item 1)');

// The core files asked: a node family's api.js, and an intrinsic server's family api.js. Each family's FS is rooted at its folder.
const CORE = [
  { family: 'contact', path: 'api.js', run: 'spirit/contact/api.js' },
  { family: 'app', path: 'api.js', run: 'spirit/app/api.js' },
  { family: 'fileServer', path: 'api.js', run: 'process/js/fileServer/family/api.js' },
];

(async function () {
  const N = await scratchNode();
  const post = function (call, args) {
    return fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
      .then(function (r) { return r.text().then(function (t) { let body = null; try { body = JSON.parse(t); } catch (e) { /* judged as text */ } return { status: r.status, body: body, text: t }; }); },
        function (e) { return { status: 0, body: null, text: String(e && e.message) }; });
  };
  try {
    ok(N.up && !!N.root, 'the world: a scratch node comes up on a copy of its own', 'the scratch node did not come up: nothing judged');
    if (!N.up || !N.root) return;
    const run = path.join(N.root, 'spirit', 'run');
    const gate = require(path.join(run, 'spirit', 'fileSystem.js'));

    test.subHeading('the box: "a family\'s FS.saveFile / deleteFile ... can overwrite any api.js or app code"');
    for (const c of CORE) {
      const disk = path.join(run, c.run);
      const before = fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
      ok(before !== null && gate.fileWritable(c.run) === false, 'the world: ' + c.run + ' is there and fileWritable refuses it', c.run + ': ' + (before === null ? 'missing' : 'writable by fileWritable') + ': nothing judged');
      if (before === null) continue;
      const read = await post(c.family + '.FS.loadFile', { path: c.path });
      ok(read.body && read.body.text === before, 'the world: ' + c.family + '.FS.loadFile reads ' + c.run, c.family + '.FS.loadFile does not read ' + c.run + ': ' + read.status + ' ' + short(read.text) + ': nothing judged');
      const saved = await post(c.family + '.FS.saveFile', { path: c.path, content: '// overwritten by familyCoreWrite.js\n' });
      const after = fs.existsSync(disk) ? fs.readFileSync(disk, 'utf8') : null;
      ok(!(saved.body && saved.body.saved === true) && after === before, c.family + '.FS.saveFile on ' + c.run + ' is refused (' + saved.status + '), the file unchanged',
        c.family + '.FS.saveFile overwrote the core file ' + c.run + ': ' + saved.status + ' ' + short(saved.text));
      if (after !== before) { try { fs.writeFileSync(disk, before); } catch (e) { /* scratch */ } }
      const deleted = await post(c.family + '.FS.deleteFile', { path: c.path });
      const still = fs.existsSync(disk);
      ok(!(deleted.body && deleted.body.deleted === true) && still, c.family + '.FS.deleteFile on ' + c.run + ' is refused (' + deleted.status + '), the file still there',
        c.family + '.FS.deleteFile deleted the core file ' + c.run + ': ' + deleted.status + ' ' + short(deleted.text));
      if (!still) { try { fs.writeFileSync(disk, before); } catch (e) { /* scratch */ } }
    }

    test.subHeading('a file that is not core still saves: Andy (G30.21) "any non-core file is fair game"');
    const name = 'familyCoreWrite-probe-' + process.pid + '.txt';
    const rel = 'process/js/fileServer/family/' + name;
    ok(gate.fileWritable(rel) === true, 'the world: fileWritable lets ' + rel + ' be written', rel + ' is not writable by fileWritable: nothing judged');
    const saved = await post('fileServer.FS.saveFile', { path: name, content: 'probe' });
    const there = fs.existsSync(path.join(run, rel)) && fs.readFileSync(path.join(run, rel), 'utf8') === 'probe';
    ok(saved.body && saved.body.saved === true && there, 'fileServer.FS.saveFile saves ' + rel, 'the writable probe did not save: ' + saved.status + ' ' + short(saved.text));
    const deleted = await post('fileServer.FS.deleteFile', { path: name });
    ok(deleted.body && deleted.body.deleted === true && !fs.existsSync(path.join(run, rel)), 'fileServer.FS.deleteFile deletes it again', 'the writable probe did not delete: ' + deleted.status + ' ' + short(deleted.text));
  } finally {
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
