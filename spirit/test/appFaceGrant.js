'use strict';

// spirit/test/appFaceGrant.js
// appFaceApp IS A PROCESS, AND THE NODE LOADS NOTHING — goal/G13.2.
//
// Until 2026-10-10 this suite held appFaceApp faceless: a shell app booted into the node, with
// nothing that listened, so that the packet exchange was its only door. The rule was written for
// that home, and it is why the visitors' door ended up in the node (puppetPost.js). Andy, under
// goal/G13: "why the fuck is that thing still in shell?", "a second door has NOTHING to do with
// being a puppet.", "no \"face\" crap belongs into node." So what is held now is the opposite
// half of the same honesty: the exchange is the api, on a pipe like every process; the app opens
// its own door for visitors from its own configuration; and the node has no second branch to
// load an app with. appFaceProcess.js drives the behaviour; this keeps the shape.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');
const OWED = 'OWED by goal/G13.2: ';

function code(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
  catch (e) { return ''; }
}

test.startTest('appFaceApp is a process, and the node loads nothing');

test.subHeading('the exchange is the api on a pipe, like every process');
{
  const server = code('process/js/appFaceApp/appFaceApp.js');
  if (!server) {
    test.fail(OWED + 'no process/js/appFaceApp/appFaceApp.js');
  } else {
    if (/appServer\.serve\(/.test(server) && /route:/.test(server) && /serve:/.test(server)) {
      test.check('it serves route and serve through appServer.serve: the api door and jobs.api are the ways in');
    } else test.fail(OWED + 'appFaceApp.js does not serve route and serve through appServer.serve');
    if (!/client\/packet/.test(server) && !/appServerReply|appServerPost/.test(server) && /spirit\.peerPost\(/.test(server)) {
      test.check('it hand-rolls no packets: the ask goes out as spirit.peerPost, and the answer is the api door\'s');
    } else test.fail(OWED + 'appFaceApp.js still rolls its own packets');
    const listens = (server.match(/http\.createServer\(/g) || []).length;
    if (listens === 1 && /face\.json/.test(server) && /127\.0\.0\.1/.test(server)) {
      test.check('one listener of its own, on loopback, on the port its own face.json names: the node is never told');
    } else test.fail(OWED + 'listeners ' + listens + ', reads face.json ' + /face\.json/.test(server) + ', loopback ' + /127\.0\.0\.1/.test(server));
    if (!/owner\.json/.test(server) || /loadOwner\(/.test(server)) {
      test.check('the owner\'s key is read as the puppet machinery reads it, relayAuth.loadOwner, never parsed by hand');
    } else test.fail(OWED + 'appFaceApp.js parses owner.json itself');
  }
}

test.subHeading('the shell holds no copy, and the node has no branch to load one');
{
  if (!fs.existsSync(path.join(RUN, 'shell', 'appFaceApp'))) test.check('shell/appFaceApp is gone');
  else test.fail(OWED + 'shell/appFaceApp is still there');
  const js = fs.readdirSync(path.join(RUN, 'js')).filter(function (f) { return /\.js$/.test(f); });
  const loaders = js.filter(function (f) { return /mountAll|boots\(manifest\)|"boots"|\.boots === true/.test(code('js/' + f)); });
  if (!loaders.length) test.check('no file in js/ loads an app into the node: no mountAll, no boots flag');
  else test.fail(OWED + 'still loading apps into the node: ' + loaders.join(', '));
  const manifests = [];
  ['shell', path.join('process', 'js')].forEach(function (dir) {
    let names = [];
    try { names = fs.readdirSync(path.join(RUN, dir)); } catch (e) { names = []; }
    names.forEach(function (n) {
      let m = null;
      try { m = JSON.parse(fs.readFileSync(path.join(RUN, dir, n, n + '.json'), 'utf8')); } catch (e) { m = null; }
      if (m && (m.boots === true || m.serves === true)) manifests.push(dir + '/' + n);
    });
  });
  if (!manifests.length) test.check('no manifest says boots or serves: a server is a process/js script, started one way');
  else test.fail(OWED + 'manifests still opting in: ' + manifests.join(', '));
}

test.reportSuccessFailureCount();
