'use strict';

// spirit/test/refusalCodes.js
// A REFUSAL SAYS WHAT IT MEANS — R36 phase B, cycle 7.
//
//   Andy: "centralize the meaning of errors of status codes" (R36). Grok's
//   review: "{ status, error, code }. Catalogue is the code. Old nodes still
//   read error. … Do not drop "not now" to a code-only body."
//
// The relay puts the catalogue's code beside the sentence; the node takes
// a code it knows as meant, and falls back to the sentence for one it does
// not. Proved on a real relay over HTTP, not only in process.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { rememberKeys, sealKeyFor } = require('./openReply');
const auth = require('../run/js/relayAuth');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const spiritErrors = require('../run/js/spiritErrors');
const serveCommon = require('../run/js/serveCommon');
const peerPost = require('../run/js/peerPost');
const { claimOwner } = require('./ownerClaim');
const { createRelay } = require('../run/js/relay');

const PORT = 48781;
let kid = null;
process.on('exit', function () { try { if (kid) kid.kill(); } catch (e) { /* gone */ } });
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('A refusal says what it means');

async function run() {
  test.subHeading('The node takes a known code as meant, and reads the sentence otherwise');

  {
    const byCode = spiritErrors.classify(503, 'something reworded next year', { code: 'target-busy' });
    const unknownCode = spiritErrors.classify(503, 'peer not reachable', { code: 'invented-by-a-newer-relay' });
    if (byCode.code === 'target-busy' && unknownCode.code === 'peer-unreachable') {
      test.check('a code in the catalogue wins over the sentence; a code it does not know falls back to the sentence');
    } else {
      test.fail('classify: ' + byCode.code + ' / ' + unknownCode.code);
    }
  }

  test.subHeading('The node carries the relay\'s code through to its answer');

  {
    const H = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-codes-'));
    auth.saveIdentity(H, auth.generateIdentity('sender'));
    const P = peerPost.createPeerPost({
      sealKeyFor: sealKeyFor,
      rootDir: H, waitMs: 2000,
      request: function () {
        return Promise.resolve({ status: 503, text: JSON.stringify({ error: 'peer not reachable', code: 'peer-unreachable' }) });
      },
    });
    // Their card is held, so the post is composed and the RELAY's refusal
    // is what comes back — which is what this suite is about.
    const a = await P.post('http://relay.example', rememberKeys(auth.generateIdentity('x')).publicKey, 'hello');
    if (!a.ok && a.code === 'peer-unreachable' && a.error === 'peer not reachable' &&
        spiritErrors.classifyAnswer(a).code === 'peer-unreachable') {
      test.check('a refusal keeps both: the sentence, and the code the relay sent');
    } else {
      test.fail('answer: ' + JSON.stringify(a));
    }
  }

  test.subHeading('The device refusal keeps its sentence');

  {
    let status = 0; let body = '';
    serveCommon.deviceRefusal({ writeHead: function (s) { status = s; }, end: function (b) { body = b; } }, 403);
    const parsed = JSON.parse(body);
    if (status === 403 && parsed.error === 'not now' && parsed.code === 'device-not-now') {
      test.check('"not now" stays, and "device-not-now" rides beside it — never a code-only body');
    } else {
      test.fail('deviceRefusal: ' + status + ' ' + body);
    }
  }

  test.subHeading('On a real relay, over HTTP');

  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-codes-relay-'));
    const box = createRelay(home);
    auth.saveIdentity(home, auth.generateIdentity('relay'));
    claimOwner(box, auth.generateIdentity('owner'), 'owner', 'fx-owner');
    const runDir = path.join(home, 'spirit', 'run');
    plantRun.plantRunTree(runDir);
    fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
    fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
    const stamp = buildStamp.fromGit(path.join(__dirname, '..', '..'));
    if (stamp) buildStamp.write(runDir, stamp);

    kid = spawn(process.execPath, ['js/relayServer.js', '--port', String(PORT)], { cwd: runDir, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + PORT;
    let up = false;
    for (let n = 0; n < 40 && !up; n += 1) {
      await sleep(200);
      try { up = (await hub.relayRequest(base, 'GET', '/api/relay/key', null)).status === 200; } catch (e) { /* not yet */ }
    }
    if (!up) { test.fail('the relay did not come up'); return; }

    const stranger = auth.generateIdentity('stranger');
    const post = await hub.relayRequest(base, 'POST', '/api/relay/post',
      { from: stranger.publicKey, to: stranger.publicKey, text: 'x', sig: 'y' });
    let pb = {}; try { pb = JSON.parse(post.text); } catch (e) { /* shown below */ }
    const expected = spiritErrors.classify(post.status, pb.error, {}).code;
    if (post.status >= 400 && pb.error && pb.code && pb.code === expected && pb.code !== 'unknown') {
      test.check('a refused post answers ' + post.status + ' with its sentence ("' + pb.error + '") and its code ("' + pb.code + '")');
    } else {
      test.fail('post refusal: ' + post.status + ' ' + post.text);
    }

    const reply = await hub.relayRequest(base, 'POST', '/api/relay/reply',
      { from: stranger.publicKey, hash: 'nope', text: '', sig: 'y' });
    let rb = {}; try { rb = JSON.parse(reply.text); } catch (e) { /* shown below */ }
    if (reply.status >= 400 && rb.error && rb.code && rb.code !== 'unknown') {
      test.check('a refused reply does the same: ' + reply.status + ', "' + rb.error + '", "' + rb.code + '"');
    } else {
      test.fail('reply refusal: ' + reply.status + ' ' + reply.text);
    }
  }
}

run().then(function () {
  try { if (kid) kid.kill(); } catch (e) { /* gone */ }
  test.reportSuccessFailureCount();
}, function (e) {
  try { if (kid) kid.kill(); } catch (x) { /* gone */ }
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
