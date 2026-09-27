'use strict';

// THE FACE'S ENTRY POINT ON THE VPS — public-app-server/G17, slice 1.
//
//   Andy, 2026-09-27: "confirm the reply path from app-server-process back
//   to the browser" (his title for G17), and "go." on this slice.
//
// puppetPost.js is a listener that exists only for face traffic: Caddy
// forwards to it, it hands each request to the one node app that claimed
// the face, and it sends that app's answer back. Checked here, from
// wsl-claude's review of the shape:
//
//   (a) it listens on loopback only;
//   (c) one request fails alone: a hang is 504, a throw or rejection is
//       502, a late rejection escapes nowhere, and the next request is
//       served;
//   (e) the face sees exactly { host, method, path, body };
//   and a body over BODY_MAX is refused by name with the handler not run,
//   the same app may claim again after a remount, and an app on a node
//   with no face is handed no `face` at all.
//
// Real sockets on 127.0.0.1, port 0.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');
const puppetPost = require('../run/js/puppetPost.js');
const nodeApps = require('../run/js/nodeApps.js');

function ask(port, method, reqPath, body, host) {
  return new Promise(function (resolve) {
    const req = http.request({ host: '127.0.0.1', port: port, method: method, path: reqPath,
      headers: { Host: host || 'join.spirit.example', 'X-Forwarded-For': '203.0.113.9', Cookie: 'secret=1' } },
    function (res) {
      let text = '';
      res.on('data', function (c) { text += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: text }); });
    });
    req.on('error', function (e) { resolve({ status: 0, text: String(e.message) }); });
    if (body) req.write(body);
    req.end();
  });
}

function started(opts) {
  const face = puppetPost.createPuppetPost(opts || {});
  return new Promise(function (resolve) {
    face.listen(0, function (server) { resolve({ face: face, server: server, port: server.address().port }); });
  });
}

const escaped = [];
process.on('unhandledRejection', function (e) { escaped.push(String((e && e.message) || e)); });

test.startTest('puppetPost — the face\'s entry point on the VPS puppet node');

test.subHeading('Switched on by relay-state/face.json, and nothing else');
(function () {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-face-'));
  const none = puppetPost.faceConfigIn(home);
  fs.mkdirSync(path.join(home, 'relay-state'));
  fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), '{"port":"eighty"}');
  const bad = puppetPost.faceConfigIn(home);
  fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), '{"port":8443}');
  const good = puppetPost.faceConfigIn(home);
  if (none === null && bad === null && good && good.port === 8443) {
    test.check('no face.json, or a port that is not a whole number, means no face; {"port": n} means one');
  } else {
    test.fail('faceConfigIn gave ' + JSON.stringify([none, bad, good]));
  }
  fs.rmSync(home, { recursive: true, force: true });
})();

function servesTheFace() {
  test.subHeading('A request reaches the face as four fields, and its answer goes back');
  return started().then(function (s) {
    let seen = null;
    s.face.claim('appFaceApp', function (req) {
      seen = req;
      return { status: 201, body: { ok: true, invite: 'abc' } };
    });
    if (s.server.address().address === '127.0.0.1') test.check('it listens on loopback only');
    else test.fail('bound to ' + s.server.address().address);
    return ask(s.port, 'POST', '/join?x=1', '{"name":"bert"}').then(function (r) {
      if (seen && Object.keys(seen).sort().join(',') === 'body,host,method,path' &&
          seen.host === 'join.spirit.example' && seen.method === 'POST' && seen.path === '/join?x=1' &&
          seen.body === '{"name":"bert"}') {
        test.check('the face sees exactly host, method, path and body: no headers, no forwarded address');
      } else {
        test.fail('the face saw ' + JSON.stringify(seen));
      }
      if (r.status === 201 && JSON.parse(r.text).invite === 'abc') test.check('and its answer reaches the browser, status and body');
      else test.fail('answer ' + JSON.stringify(r));
      s.server.close();
    });
  });
}

function failsAlone() {
  test.subHeading('One request fails alone');
  return started({ waitMs: 150 }).then(function (s) {
    let calls = 0;
    s.face.claim('appFaceApp', function (req) {
      calls += 1;
      if (req.path === '/hang') return new Promise(function () {});
      if (req.path === '/late') return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('too late')); }, 300); });
      if (req.path === '/throw') throw new Error('broken face');
      if (req.path === '/reject') return Promise.reject(new Error('rejected face'));
      return { body: 'fine' };
    });
    return ask(s.port, 'GET', '/hang').then(function (r) {
      if (r.status === 504 && JSON.parse(r.text).error === 'face-timeout') test.check('a face that never answers gets 504, by name');
      else test.fail('hang gave ' + JSON.stringify(r));
      return ask(s.port, 'GET', '/throw');
    }).then(function (r) {
      if (r.status === 502 && JSON.parse(r.text).error === 'face-failed') test.check('a face that throws gets 502');
      else test.fail('throw gave ' + JSON.stringify(r));
      return ask(s.port, 'GET', '/reject');
    }).then(function (r) {
      if (r.status === 502) test.check('a face that rejects gets 502');
      else test.fail('reject gave ' + JSON.stringify(r));
      return ask(s.port, 'GET', '/late');
    }).then(function (r) {
      if (r.status === 504) test.check('a face that rejects after its 504 was sent is cut off at the 504');
      else test.fail('late gave ' + JSON.stringify(r));
      return new Promise(function (res) { setTimeout(res, 400); });
    }).then(function () {
      if (!escaped.length) test.check('and its late rejection reached nothing: no unhandled rejection');
      else test.fail('escaped: ' + escaped.join(' | '));
      return ask(s.port, 'GET', '/ok');
    }).then(function (r) {
      if (r.status === 200 && r.text === 'fine') test.check('the next request is served as if nothing happened');
      else test.fail('after the failures ' + JSON.stringify(r));
      s.server.close();
    });
  });
}

function refusesBigBodies() {
  test.subHeading('A body over BODY_MAX is refused by name, and the face never runs');
  return started({ bodyMax: 64 }).then(function (s) {
    let ran = false;
    s.face.claim('appFaceApp', function () { ran = true; return { body: 'no' }; });
    return ask(s.port, 'POST', '/join', 'x'.repeat(200)).then(function (r) {
      if ((r.status === 413 && JSON.parse(r.text).error === 'face-body-too-large') || r.status === 0) {
        if (!ran) test.check('413 face-body-too-large, before the face is asked');
        else test.fail('the face ran on an oversized body');
      } else {
        test.fail('big body gave ' + JSON.stringify(r));
      }
      s.server.close();
    });
  });
}

function capsTheAnswer() {
  test.subHeading('The answer to the browser is capped too, and refused by name');
  // Andy, 2026-09-27, "go." on capping the face's answer at MAX_PAYLOAD.
  return started({ answerMax: 64 }).then(function (s) {
    s.face.claim('appFaceApp', function (req) {
      return req.path === '/big' ? { body: 'ü'.repeat(40) } : { body: 'ü'.repeat(20) };
    });
    return ask(s.port, 'GET', '/big').then(function (r) {
      if (r.status === 502 && JSON.parse(r.text).error === 'face-answer-too-large') {
        test.check('an answer over the cap in UTF-8 bytes (40 characters, 80 bytes) is refused by name, never cut');
      } else {
        test.fail('a big answer gave ' + JSON.stringify(r).slice(0, 120));
      }
      return ask(s.port, 'GET', '/fits');
    }).then(function (r) {
      if (r.status === 200 && r.text === 'ü'.repeat(20)) test.check('one that fits (40 bytes) goes through whole');
      else test.fail('a fitting answer gave ' + JSON.stringify(r));
      s.server.close();
    });
  });
}

function oneClaimant() {
  test.subHeading('One app holds the face');
  return started().then(function (s) {
    return ask(s.port, 'GET', '/').then(function (r) {
      if (r.status === 503 && JSON.parse(r.text).error === 'no-face') test.check('before any app claims it, a visitor gets 503 no-face');
      else test.fail('unclaimed gave ' + JSON.stringify(r));
      s.face.claim('appFaceApp', function () { return { body: 'first' }; });
      s.face.claim('appFaceApp', function () { return { body: 'second' }; });
      let refused = '';
      try { s.face.claim('otherApp', function () { return { body: 'stolen' }; }); } catch (e) { refused = e.message; }
      if (/already claimed by appFaceApp/.test(refused)) test.check('another app cannot take it');
      else test.fail('a second app claimed the face');
      return ask(s.port, 'GET', '/');
    }).then(function (r) {
      if (r.text === 'second') test.check('the same app claiming again (a remount) replaces its handler');
      else test.fail('after a re-claim the face answered ' + r.text);
      s.server.close();
    });
  });
}

function onlyWhereThereIsAFace() {
  test.subHeading('A booted app is handed `face` only on a node that has one');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-face-mount-'));
  const dir = path.join(home, 'app', 'faceProbe');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'faceProbe.json'), JSON.stringify({ name: 'faceProbe', boots: true }));
  fs.writeFileSync(path.join(dir, 'faceProbe.js'),
    'module.exports = { mount: function (api) { global.__faceProbe = typeof api.face; if (api.face) api.face(function () { return { body: "probe" }; }); } };');
  global.__faceProbe = 'not mounted';
  nodeApps.mountAll({ rootDir: home });
  const without = global.__faceProbe;
  delete require.cache[require.resolve(path.join(dir, 'faceProbe.js'))];
  const face = puppetPost.createPuppetPost();
  nodeApps.mountAll({ rootDir: home, face: face });
  const withFace = global.__faceProbe;
  if (without === 'undefined' && withFace === 'function' && face.claimedBy() === 'faceProbe') {
    test.check('no face on the node, no api.face; with one, the app claims it under its own name');
  } else {
    test.fail('api.face without: ' + without + ', with: ' + withFace + ', claimed by ' + face.claimedBy());
  }
  delete global.__faceProbe;
  fs.rmSync(home, { recursive: true, force: true });
}

servesTheFace()
  .then(failsAlone)
  .then(refusesBigBodies)
  .then(capsTheAnswer)
  .then(oneClaimant)
  .then(onlyWhereThereIsAFace)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('puppetPost threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
