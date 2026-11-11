'use strict';

// spirit/run/spirit/test/relayServer.js
// The tests of spirit/relayServer.js, and of no other module, in this one file (spec: ./relayServer.md; goal/G41.3). Its
// sections: the attacker's garbage at the relay's door (goal/G41.30), after its own: how it serves a
// face its files. Its map and its folder are lifted out of the source and asked, with no relay running; the /face/ posts
// at the end (goal/G41.30) go to a scratch relay with faces.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }

const FILE = path.join(__dirname, '..', 'relayServer.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('relayServer.js: the face\'s files, at the addresses they always had');

const src = fs.readFileSync(FILE, 'utf8');
const dirSrc = (/^const FACE_DIR = (path\.join\(__dirname, [^;]*\));/m.exec(src) || [])[1];
const mapSrc = (/^const FACE_FILES = (\{[^;]*\});/m.exec(src) || [])[1];
// goal/G43.18 (Q25, Andy: "the browser should see them the same."): an address is served from its file, serveCommon.pageFile.
const common = require(path.join(RUN, 'spirit', 'serveCommon.js'));
let dir = null; let map = null;
try { dir = dirSrc ? new Function('path', '__dirname', 'return ' + dirSrc + ';')(path, path.dirname(FILE)) : null; } catch (e) { dir = null; }
try { map = mapSrc ? new Function('common', 'return ' + mapSrc + ';')(common) : null; } catch (e) { map = null; }

test.subHeading('where its face files come from');
ok(dir && path.relative(RUN, dir) === '', 'its face files are read from the run root, each by its file (FACE_DIR)', 'FACE_DIR is ' + (dir ? path.relative(RUN, dir) : 'not found in the source'));

test.subHeading('the addresses it serves');
// goal/G43.18, box v29: "The relay serves a logged-out face one plain page, the one-field form, with spirit.js and seal.js
// only": /spirit.js, face.html's one script tag, the seal, and the tab's icon. No boot.js, sheet or login app.
const WANT = ['/spirit.js', '/shell/seal.js', '/shell/favicon.svg'];
const keys = map ? Object.keys(map).sort() : [];
ok(map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort()), 'its map serves exactly /spirit.js, /shell/seal.js and /shell/favicon.svg', 'its map serves ' + JSON.stringify(keys));
const old = keys.filter(function (k) { return k.indexOf('/face/') === 0; });
ok(map && !old.length, 'no address under /face/ serves a file any more', 'old addresses still served: ' + JSON.stringify(old));
const missing = map && dir ? keys.filter(function (k) { return !fs.existsSync(path.join(dir, map[k])); }) : keys;
ok(map && dir && !missing.length, 'every file the map names is there', 'files not there: ' + JSON.stringify(missing.map(function (k) { return k + ' -> ' + (map ? map[k] : '?'); })));
const named = map ? keys.every(function (k) { return map[k] === common.pageFile(k); }) : false;
ok(named, 'each address is served from its file, as the node serves it (serveCommon.pageFile)', 'an address and its file differ: ' + JSON.stringify(map));

// goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": the relay hands face.html and spirit.js over as they are on
// disk. Its faceSend is lifted out of the source and run on the real files.
test.subHeading('face.html and spirit.js, as they are on disk');
const sendSrc = (/^function faceSend\(res, status, file\) \{[\s\S]*?\r?\n\}\r?\n/m.exec(src) || [])[0];
const typesSrc = (/^const FACE_TYPES = (\{.*\});\r?$/m.exec(src) || [])[1];
let faceSend = null;
try { faceSend = sendSrc && typesSrc ? new Function('fs', 'path', 'FACE_DIR', 'FACE_TYPES', sendSrc + '\nreturn faceSend;')(fs, path, dir, new Function('return ' + typesSrc + ';')()) : null; } catch (e) { faceSend = null; }
function sent(file) {
  return new Promise(function (resolve) {
    const res = { writeHead: function () {}, setHeader: function () {}, end: function (b) { resolve(Buffer.from(b || '')); } };
    if (!faceSend) resolve(null); else faceSend(res, 200, file);
  });
}
// THE FACE PAGE TAKES NO TOKEN FROM ITS ADDRESS (goal/G41.29; the box: "The login-email must not carry a link", "So a
// real login-email never holds a link"): the page at / or /face.html, asked with /?<token>, logs nobody in and sets no
// login; the token is pasted into the Log in field only. Its route is lifted out of the source and run on stand-ins.
test.subHeading('the face page logs nobody in from a token in its address');
// Line ends either way, as a Windows checkout has them (CRLF), as the faceSend pattern above does.
const routeSrc = (/\r?\n(  if \(req\.method === 'GET' && \(pathname === '\/' \|\| pathname === '\/face\.html'\)\) \{[\s\S]*?\r?\n  \})\r?\n/.exec(src) || [])[1];
const asked = { logins: [], cookies: [], sent: [] };
let route = null;
try { route = routeSrc ? new Function('req', 'pathname', 'url', 'relay', 'faceSetCookie', 'faceSend', 'at', 'res', 'common', routeSrc + '\nreturn false;') : null; } catch (e) { route = null; }
let served = false;
if (route) {
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWx';
  served = route({ method: 'GET' }, '/', new URL('https://harbour.relay.example/?' + TOKEN), { faceLogin: function (n, t) { asked.logins.push([n, t]); return { loggedIn: true, session: 'S' }; } },
    function (res, sid) { asked.cookies.push(sid); }, function (res, st, file) { asked.sent.push(file); }, { name: 'harbour' }, {}, common);
}
ok(!!route && served === true && asked.sent[0] === common.pageFile('face.html'), 'asked with /?<token>, it serves face.html', route ? 'served ' + served + ', sent ' + JSON.stringify(asked.sent) : 'the face page\'s route was not found in the source');
ok(!!route && asked.logins.length === 0 && asked.cookies.length === 0, 'and logs nobody in: no faceLogin asked, no login cookie set', 'faceLogin asked ' + JSON.stringify(asked.logins) + ', cookies ' + JSON.stringify(asked.cookies));
Promise.all([sent(common.pageFile('face.html')), sent(map && map['/spirit.js'] || common.pageFile('spirit.js'))]).then(function (got) {
  ok(got[0] && got[0].equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html'))), 'the relay serves face.html byte for byte as it is on disk', 'the relay serves face.html changed, or its faceSend was not found');
  ok(got[1] && got[1].equals(fs.readFileSync(path.join(RUN, 'spirit', 'spirit.js'))), 'the relay serves /spirit.js, from spirit/spirit.js, byte for byte', 'the relay does not serve spirit/spirit.js as it is');
  return facePosts();
}).then(null, function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  // The section folded in from a file of its own, the garbage, runs after the checks of this file's own.
  .then(function () { return garbagePart().then(null, function (e) { test.fail('the garbage part threw ' + (e && e.stack || e)); }); })
  .then(function () { test.reportSuccessFailureCount(); process.exit(0); });

// A PAGE ON ANOTHER MEMBER'S FACE CANNOT DRIVE A LOGGED-IN OWNER'S NODE (goal/G41.30, the review, RC2: "a page on any
// member's face can make a logged-in owner's face run verbs on his node, because all faces are same-site and /face/call
// has no Origin check"; its fix: "on every /face/* POST, require Origin equal to the face's own host, require the
// session's name to match faceAt(host).name, and require Content-Type: application/json"; Andy, Q3: "yes."). On a
// scratch relay with two members, each with a face, present and logged in. A refusal is a 4xx and no face event on any
// member's stream; the face's own page still reaches its node.
async function facePosts() {
  const http = require('http');
  const { scratchFaceRelay, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const R = await scratchFaceRelay();
  try {
    test.subHeading('POST /face/call and /face/api: only the face\'s own page');
    ok(R.up && !!R.members.harbour && !!R.members.quay, 'a scratch relay with two faces, present and logged in', 'the scratch relay with faces did not come up: nothing judged');
    if (!R.up) return;
    const H = R.members.harbour; const Q = R.members.quay;
    const faceEvents = function (from) { return R.lines.slice(from).filter(function (l) { return /^event: face\n/.test(l.line); }); };
    // One POST as a browser sends it: answered, or still waiting after a moment, which is the call gone on to the node.
    const post = function (p, o) {
      return new Promise(function (resolve) {
        const headers = { Host: H.host, Cookie: 'spirit_face=' + (o.sid || H.sid) };
        if (o.origin) headers.Origin = o.origin;
        if (o.type) headers['Content-Type'] = o.type;
        const body = o.body || '{"call":"job.create","args":{"command":"sh","args":["-c","id"]}}';
        headers['Content-Length'] = Buffer.byteLength(body);
        const q = http.request({ host: '127.0.0.1', port: R.port, path: p, method: 'POST', headers: headers }, function (r) { r.resume(); clearTimeout(t); resolve({ status: r.statusCode }); });
        const t = setTimeout(function () { resolve({ status: 0 }); q.destroy(); }, 1200);
        q.on('error', function () { clearTimeout(t); resolve({ status: 0 }); });
        q.end(body);
      });
    };
    const OWN = 'https://' + H.host;
    const JSONT = 'application/json';
    const refused = async function (name, o) {
      const from = R.lines.length;
      const r = await post('/face/call', o);
      await sleep(100);
      const ev = faceEvents(from);
      return { fine: r.status >= 400 && r.status < 500 && !ev.length, why: '/face/call ' + name + ': answered ' + (r.status || 'nothing yet') + ', ' + ev.length + ' face event(s) sent to ' + short(ev.map(function (l) { return l.stream; })) };
    };
    let rf;
    rf = await refused('an Origin of another face', { origin: 'https://' + Q.host, type: JSONT }); ok(rf.fine, '/face/call refused, a 4xx and no face event: an Origin of another face', rf.why);
    rf = await refused('no Origin', { type: JSONT }); ok(rf.fine, '/face/call refused, a 4xx and no face event: no Origin', rf.why);
    rf = await refused('text/plain, a form a page sends with no preflight', { origin: OWN, type: 'text/plain' }); ok(rf.fine, '/face/call refused, a 4xx and no face event: text/plain, a form a page sends with no preflight', rf.why);
    rf = await refused('another member\'s session at this face\'s host', { origin: OWN, type: JSONT, sid: Q.sid }); ok(rf.fine, '/face/call refused, a 4xx and no face event: another member\'s session at this face\'s host', rf.why);
    const from = R.lines.length;
    await post('/face/call', { origin: OWN, type: JSONT, body: '{"call":"node.card","args":{}}' });
    const ev = faceEvents(from);
    ok(ev.length === 1 && ev[0].stream === 'harbour', 'the face\'s own page, its Origin and json, still reaches its node', 'its own page: ' + ev.length + ' face event(s), to ' + short(ev.map(function (l) { return l.stream; })));
    const api = await post('/face/api', { origin: 'https://' + Q.host, type: JSONT, body: '{"verb":"state"}' });
    ok(api.status >= 400 && api.status < 500, '/face/api refused, a 4xx: an Origin of another face', '/face/api with an Origin of another face answered ' + api.status);
    const apiOwn = await post('/face/api', { origin: OWN, type: JSONT, body: '{"verb":"state"}' });
    ok(apiOwn.status === 200, 'the face\'s own page still reaches /face/api', '/face/api from its own page answered ' + apiOwn.status);
  } finally { R.stop(); }
}

async function garbagePart() {
  // ── THE GARBAGE PART ──
  // THE ATTACKER AT THE RELAY'S DOOR (goal/G41.30; spec: ./relayServer.md, its section). The box: "all servers (node
  // and relay, or serveCommon) are tested by throwing malformed paths at them, and malformed, invalid arguments", "an
  // appserver api can be called outside a spirit object, and an attacker trying to crash our servers will throw ANYTHING at
  // the api. Imitate that attacker", and "the server MUST not CRASH or HANG"; Andy, on the gap: "The relay's door is not
  // tested yet: there is no scratch relay helper. - close this gap, dammit!". The node's doors are
  // garbage.js; this section is the relay's, on a scratch relay of its own (spirit/test/headLessChrome.js
  // scratchRelay), never a live one. Everything goes raw over a bare socket, as an attacker sends it.

  const fs = require('fs');
  const net = require('net');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..','..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { sleep, scratchRelay, scratchFaceRelay } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const limits = require(path.join(RUN, 'spirit', 'limits.js'));

  const ASK_MS = 10000;
  const PLAIN_MS = 3000;
  const BATCH = 20;
  const FACE_DOMAIN = 'relay.example';
  let HOST = '';

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

  // RAW OVER A BARE SOCKET: the request as written, nothing normalised. Answers { status, text } or { hung } or { error }.
  function raw(base, head, body, opts) {
    const u = new URL(base);
    const o = opts || {};
    return new Promise(function (resolve) {
      let got = '';
      let done = false;
      const s = net.connect(Number(u.port), u.hostname);
      const finish = function (r) { if (done) return; done = true; s.destroy(); resolve(r); };
      const timer = setTimeout(function () { finish(got ? answer() : { hung: true }); }, o.ms || ASK_MS);
      function answer() { const m = /^HTTP\/1\.[01] (\d{3})/.exec(got); return { status: m ? Number(m[1]) : 0, text: got.slice(got.indexOf('\r\n\r\n') + 4, got.indexOf('\r\n\r\n') + 304) }; }
      s.on('connect', function () { s.write(head); if (body) s.write(body); });
      s.on('data', function (d) { got += d.toString('latin1'); if (/\r\n\r\n/.test(got) && o.keepOpen) { clearTimeout(timer); finish(answer()); } });
      s.on('end', function () { clearTimeout(timer); finish(got ? answer() : { status: 0, text: '' }); });
      s.on('error', function (e) { clearTimeout(timer); finish(got ? answer() : { error: String(e && e.code || e) }); });
    });
  }
  function postHead(p, len, type, host) {
    return 'POST ' + p + ' HTTP/1.1\r\nHost: ' + (host || HOST) + '\r\nConnection: close\r\n' + (type === null ? '' : 'Content-Type: ' + (type || 'application/json') + '\r\n') + 'Content-Length: ' + len + '\r\n\r\n';
  }
  function getHead(p, host, extra) { return 'GET ' + p + ' HTTP/1.1\r\nHost: ' + (host || HOST) + '\r\nConnection: close\r\n' + (extra || '') + '\r\n'; }
  function post(base, p, body, host) {
    const b = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
    return raw(base, postHead(p, b.length, undefined, host), b);
  }
  // A crash or a hang, as the box says it: no answer, a server error, or a handler that failed. A relay that says it is
  // busy and when to come back (a 503 with retryAfterMs, its capacity refusal: "CAPACITY IS A REFUSAL, NEVER A DROP") has
  // answered; any other 5xx is the relay breaking.
  function broke(r) {
    if (!r || r.hung) return 'it hung: no answer in ' + (ASK_MS / 1000) + ' s';
    if (r.error) return 'the connection failed: ' + r.error;
    if (!r.status) return 'no status line';
    if (r.status >= 500 && !(r.status === 503 && /retryAfterMs/.test(r.text))) return 'it answered ' + r.status + ': ' + short(r.text);
    if (/handler-failed|the handler failed/.test(r.text)) return 'the handler failed: ' + short(r.text);
    return '';
  }

  // ONE HEADER MUST NOT CRASH THE RELAY (goal/G41.30, the review, RH3: "any member with a face can crash a relay with one
  // header"; its fix: "clamp the status to an integer from 100 to 599 (else 502), and wrap faceAnswer and faceFeed in
  // try/catch"; Andy, Q3: "yes."). A member answers his own face's call, signed, with a bad x-spirit-status: the viewer
  // gets 502 and the relay goes on. A dead relay is replaced, so each bad status is judged alone.
  async function badAnswers() {
    const http = require('http');
    let R = null;
    const fresh = async function () { if (R) R.stop(); R = await scratchFaceRelay({ members: ['harbour'] }); return R.up; };
    test.subHeading('/api/relay/face/answer: a bad status or type from a member never crashes the relay');
    try {
      ok(await fresh(), 'a scratch relay with a face, present and logged in', 'the scratch relay with a face did not come up: nothing judged');
      if (!R.up) return;
      // The viewer's call, waiting; the member's signed answer with these headers; what the viewer got.
      const answered = async function (headers) {
        const m = R.members.harbour;
        const from = R.lines.length;
        const viewer = new Promise(function (resolve) {
          const b = '{"call":"node.card","args":{}}';
          const q = http.request({ host: '127.0.0.1', port: R.port, path: '/face/call', method: 'POST', headers: { Host: m.host, Origin: 'https://' + m.host, Cookie: 'spirit_face=' + m.sid, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, function (r) { r.resume(); resolve(r.statusCode); });
          q.setTimeout(3000, function () { resolve(0); q.destroy(); });
          q.on('error', function () { resolve(0); });
          q.end(b);
        });
        await sleep(200);
        const line = R.lines.slice(from).filter(function (l) { return /^event: face\n/.test(l.line); })[0];
        const id = line ? (/"id":"([^"]+)"/.exec(line.line) || [])[1] : '';
        if (!id) return { viewer: 0, noCall: true };
        const sig = R.auth.sign(m.privateKey, R.auth.faceMessage(m.publicKey, R.relayKey, id));
        let head = 'POST /api/relay/face/answer?id=' + encodeURIComponent(id) + ' HTTP/1.1\r\nHost: ' + new URL(R.base).host + '\r\nConnection: close\r\nX-Spirit-From: ' + m.publicKey + '\r\nX-Spirit-Sig: ' + sig + '\r\n';
        Object.keys(headers).forEach(function (k) { head += k + ': ' + headers[k] + '\r\n'; });
        head += 'Content-Length: 1\r\n\r\n';
        await raw(R.base, head, 'x', { ms: 3000 });
        return { viewer: await viewer };
      };
      for (const status of ['99', '1000', 'abc', '-1', '0', '600', '1.5']) {
        if (R.child.exitCode !== null && !(await fresh())) { test.fail('a fresh scratch relay did not come up'); return; }
        const got = await answered({ 'X-Spirit-Status': status, 'X-Spirit-Type': 'text/plain' });
        await sleep(100);
        const dead = R.child.exitCode !== null;
        const deadWhy = 'x-spirit-status ' + status + ': IT KILLED THE RELAY (exit ' + R.child.exitCode + ')';
        if (status === '99') ok(!dead, 'x-spirit-status 99: the relay is still running', deadWhy);
        else if (status === '1000') ok(!dead, 'x-spirit-status 1000: the relay is still running', deadWhy);
        else if (status === 'abc') ok(!dead, 'x-spirit-status abc: the relay is still running', deadWhy);
        else if (status === '-1') ok(!dead, 'x-spirit-status -1: the relay is still running', deadWhy);
        else if (status === '0') ok(!dead, 'x-spirit-status 0: the relay is still running', deadWhy);
        else if (status === '600') ok(!dead, 'x-spirit-status 600: the relay is still running', deadWhy);
        else if (status === '1.5') ok(!dead, 'x-spirit-status 1.5: the relay is still running', deadWhy);
        const viewerWhy = 'x-spirit-status ' + status + ': the viewer got ' + (got.viewer || 'nothing') + (got.noCall ? ' (no call reached the member)' : '');
        if (status === '99') ok(got.viewer === 502, 'x-spirit-status 99: the viewer gets 502', viewerWhy);
        else if (status === '1000') ok(got.viewer === 502, 'x-spirit-status 1000: the viewer gets 502', viewerWhy);
        else if (status === 'abc') ok(got.viewer === 502, 'x-spirit-status abc: the viewer gets 502', viewerWhy);
        else if (status === '-1') ok(got.viewer === 502, 'x-spirit-status -1: the viewer gets 502', viewerWhy);
        else if (status === '0') ok(got.viewer === 502, 'x-spirit-status 0: the viewer gets 502', viewerWhy);
        else if (status === '600') ok(got.viewer === 502, 'x-spirit-status 600: the viewer gets 502', viewerWhy);
        else if (status === '1.5') ok(got.viewer === 502, 'x-spirit-status 1.5: the viewer gets 502', viewerWhy);
      }
      if (R.child.exitCode !== null && !(await fresh())) { test.fail('a fresh scratch relay did not come up'); return; }
      const type = await answered({ 'X-Spirit-Status': '200', 'X-Spirit-Type': 'text/\x7fbad' });
      await sleep(100);
      ok(R.child.exitCode === null, 'a bad x-spirit-type: the relay is still running', 'a bad x-spirit-type: IT KILLED THE RELAY (exit ' + R.child.exitCode + '), the viewer got ' + type.viewer);
      if (R.child.exitCode !== null && !(await fresh())) { test.fail('a fresh scratch relay did not come up'); return; }
      const good = await answered({ 'X-Spirit-Status': '201', 'X-Spirit-Type': 'text/plain' });
      ok(good.viewer === 201, 'a good status still reaches the viewer as it is: 201', 'x-spirit-status 201: the viewer got ' + (good.viewer || 'nothing'));
    } finally { if (R) R.stop(); }
  }

  test.subHeading('garbage: the attacker\'s garbage at the relay\'s door (goal/G41.30)');

  await (async function () {
    const relay = await scratchRelay({ debug: true, faceDomain: FACE_DOMAIN });
    try {
      if (!relay.up) { test.fail('the scratch relay did not come up: every check here would blame the wrong thing'); return; }
      const base = relay.base;
      HOST = new URL(base).host;
      const FACE_HOST = 'harbour.' + FACE_DOMAIN;
      const A = relay.auth;
      const plain = async function () { const r = await raw(base, getHead('/'), '', { ms: PLAIN_MS }); return !!(r && r.status); };
      const signed = function (id, text) {
        const m = A.postMessage(id.publicKey, '', text);
        return { from: id.publicKey, to: '', text: text, sig: A.sign(id.privateKey, m) };
      };

      // 1) INTROSPECT: the relay's own api, as its garbage list (its DEBUG route: spirit/DEBUG/garbageArguments.js over the
      // relay's api tree), each entry the ask's body { body: { <verb>: args } }.
      let list = null;
      try { list = await fetch(base + '/DEBUG/spirit/relay/garbageArguments.json').then(function (r) { return r.json(); }); } catch (e) { list = null; }
      if (!Array.isArray(list) || !list.length) { test.fail('/spirit/relay/garbageArguments.json: the relay gave no garbage list: nothing to introspect'); return; }
      const verbs = {};
      list.forEach(function (e) { Object.keys((e && e.body) || {}).forEach(function (v) { verbs[v] = true; }); });

      // 2) RAW BODIES AT EVERY POST ROUTE (the box, rule 2: "malformed, invalid arguments").
      const BODY_MAX = limits.BODY_MAX;
      const deep = '{"from":' + '['.repeat(5000) + ']'.repeat(5000) + '}';
      const stranger = A.generateIdentity('stranger');
      const BODIES = [
        ['not JSON', 'not json!'], ['JSON that is not an object', '[1,2,3]'], ['a bare JSON string', '"string"'], ['JSON null', 'null'],
        ['deep nesting, 5000 levels', deep], ['a __proto__ key', '{"__proto__":{"admin":1},"from":"x"}'], ['a constructor key', '{"constructor":{"x":1}}'],
        ['invalid UTF-8 bytes', Buffer.from([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d])],
        ['from as a number', { from: 12345, to: '', text: '{}', sig: 'x' }], ['sig missing', { from: stranger.publicKey, to: '', text: '{}' }],
        ['a forged sig', { from: stranger.publicKey, to: '', text: '{"v":1,"body":{"card":true}}', sig: 'AAAA' }],
        ['text not JSON, signed', signed(stranger, 'not json')], ['text a JSON array, signed', signed(stranger, '[1,2]')],
        ['text a huge string, signed', signed(stranger, JSON.stringify({ v: 1, body: { card: 'x'.repeat(15000) } }))],
        ['text with a NUL, signed', signed(stranger, '{"v":1,"body":{"card":"\u0000"}}')],
      ];
      const POSTS = ['/api/relay/post', '/api/relay/reply', '/api/relay/face/answer', '/api/relay/face/stream'];
      const RAWS = [];
      POSTS.forEach(function (p) {
        BODIES.forEach(function (b) { RAWS.push({ why: 'POST ' + p + ', ' + b[0], run: function () { return post(base, p, b[1]); } }); });
        RAWS.push({ why: 'POST ' + p + ', no Content-Type', run: function () { return raw(base, postHead(p, 2, null), '{}'); } });
        RAWS.push({ why: 'POST ' + p + ', Content-Type text/plain', run: function () { return raw(base, postHead(p, 2, 'text/plain'), '{}'); } });
        RAWS.push({ why: 'POST ' + p + ', a body cut off half-way', run: function () { return raw(base, postHead(p, 100), '{"from":"x', { keepOpen: true }); }, waits: true });
        RAWS.push({ why: 'POST ' + p + ', one byte past BODY_MAX (' + (BODY_MAX + 1) + ')', run: function () { return raw(base, postHead(p, BODY_MAX + 1), '{"t":"' + 'x'.repeat(BODY_MAX + 1 - 8) + '"}'); } });
        RAWS.push({ why: 'POST ' + p + ', a Content-Length far past what is sent', run: function () { return raw(base, postHead(p, 10000000), '{}', { keepOpen: true }); }, waits: true });
      });
      // The face's own routes, asked under a face's host (goal/G30.9), a face this relay does not serve.
      ['/face/api', '/face/call'].forEach(function (p) {
        BODIES.slice(0, 8).forEach(function (b) { RAWS.push({ why: 'POST ' + p + ' (face host), ' + b[0], run: function () { return post(base, p, b[1], FACE_HOST); } }); });
      });
      ['/face/allowed?domain=' + encodeURIComponent('\u0000'), '/face/allowed?domain=' + 'a'.repeat(9000), '/face/file?path=..%2f..%2frelay-state', '/face/stream'].forEach(function (p) {
        RAWS.push({ why: 'GET ' + short(p).slice(0, 60) + ' (face host)', run: function () { return raw(base, getHead(p, FACE_HOST), ''); } });
      });
      // The members' stream, with garbage in its signature and key.
      ['/api/relay/stream', '/api/relay/stream?sig=garbage&key=%00', '/api/relay/stream?sig=' + 'a'.repeat(9000), '/api/relay/stream?key=__proto__'].forEach(function (p) {
        RAWS.push({ why: 'GET ' + short(p).slice(0, 60), run: function () { return raw(base, getHead(p, null, 'X-Spirit-Sig: garbage\r\n'), '', { keepOpen: true }); }, waits: true });
      });
      RAWS.push({ why: 'a request line that is not HTTP', run: function () { return raw(base, 'GARBAGE /api/relay/post NOPE\r\n\r\n', ''); } });
      RAWS.push({ why: 'a header line with no colon', run: function () { return raw(base, 'POST /api/relay/post HTTP/1.1\r\nHost 127.0.0.1\r\nContent-Length: 2\r\n\r\n', '{}'); } });
      // 3) MALFORMED PATHS, GET AND POST, at the relay's host and at a face's (the box, rule 2: "malformed paths").
      const PATHS = ['/..', '/../../../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/shell/%2f%2f..%2f..%2fetc', '/' + 'a'.repeat(9000), '/%', '/%zz',
        '/%E0%A4%A', '/api/%2e%2e/relay/post', '//api//relay//post', '/DEBUG/../../spirit/state/identity.json', '/shell/../../spirit/state/relay.db',
        '/\\..\\..\\relay-state', '/?%', '*',
        // A null byte last: it may kill the relay, and every path before it is still thrown.
        '/%00', '/face.html%00.js', '/shell/boot.js%00'];
      [HOST, FACE_HOST].forEach(function (h) {
        PATHS.forEach(function (p) {
          RAWS.push({ why: 'GET ' + short(p).slice(0, 60) + (h === FACE_HOST ? ' (face host)' : ''), run: function () { return raw(base, getHead(p, h), ''); } });
          RAWS.push({ why: 'POST ' + short(p).slice(0, 60) + (h === FACE_HOST ? ' (face host)' : ''), run: function () { return raw(base, postHead(p, 2, undefined, h), '{}'); } });
        });
      });
      // Each verb's garbage, signed by the relay's owner, so it passes the door and reaches the verb (the deepest a caller
      // gets); and by a stranger, as anybody may send it.
      const ASKS = [];
      list.forEach(function (e) { ASKS.push({ who: 'owner', id: relay.owner, e: e }); });
      list.forEach(function (e) { ASKS.push({ who: 'stranger', id: stranger, e: e }); });
      test.comment('it will make ' + ASKS.length + ' signed asks of bad arguments over ' + Object.keys(verbs).length + ' relay verbs (' + Object.keys(verbs).join(', ') + '), ' +
        list.length + ' as the owner and ' + list.length + ' as a stranger, each batch of ' + BATCH + ' followed by a plain request; and ' + RAWS.length + ' raw requests');

      // THE VERBS, BATCH BY BATCH.
      test.subHeading('/api/relay/post: every relay verb takes bad arguments without crashing or hanging');
      const broken = {}; const hungAfter = []; const statuses = {};
      let killer = '';
      for (let i = 0; i < ASKS.length && !killer; i += BATCH) {
        const batch = ASKS.slice(i, i + BATCH);
        const got = await Promise.all(batch.map(function (a) { return post(base, '/api/relay/post', signed(a.id, JSON.stringify(Object.assign({ v: 1 }, a.e)))); }));
        got.forEach(function (r, j) {
          const a = batch[j];
          const name = Object.keys(a.e.body || {})[0] || '?';
          statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1;
          const why = broke(r);
          if (why) (broken[name] = broken[name] || []).push(a.who + ', ' + short(a.e.body[name]).slice(0, 60) + ': ' + why);
        });
        if (relay.child.exitCode !== null) { killer = 'the batch from ask ' + i + ' (' + short(batch.map(function (a) { return Object.keys(a.e.body || {})[0]; })) + ')'; break; }
        if (!(await plain())) hungAfter.push(i);
      }
      test.comment('by status: ' + JSON.stringify(statuses));
      Object.keys(verbs).forEach(function (v) {
        const b = broken[v];
        if (b) test.fail('/api/relay/post ' + v + ': ' + b.length + ' crashed or hung, first: ' + b[0]);
      });
      const okVerbs = Object.keys(verbs).filter(function (v) { return !broken[v]; }).length;
      test.check('/api/relay/post: the relay verbs took all their garbage without crashing or hanging');
      if (killer) test.fail('/api/relay/post: THE RELAY DIED (exit ' + relay.child.exitCode + ') at ' + killer);
      if (hungAfter.length) test.fail('/api/relay/post: after ' + hungAfter.length + ' batches the relay did not answer a plain request within ' + (PLAIN_MS / 1000) + ' s');
      else if (!killer) test.check('/api/relay/post: after every batch the relay answered a plain request in time');

      // THE RAW REQUESTS, ONE BY ONE.
      test.subHeading('the relay\'s door: raw requests and malformed paths');
      const notThrown = [];
      const doorAnswered = [];
      for (const [ri, r0] of RAWS.entries()) {
        if (killer) { notThrown.push(r0.why); continue; }
        const r = await r0.run();
        // A body cut off, or a held stream, may be held by the relay until its own time runs out: it must still answer
        // everybody else.
        let why = r0.waits && r.hung ? '' : broke(r);
        let alive = await plain();
        if (!alive) { await sleep(500); alive = await plain(); }
        if (!alive) why = (why ? why + '; ' : '') + 'the relay then did not answer a plain request within ' + (PLAIN_MS / 1000) + ' s';
        if (relay.child.exitCode !== null && !killer) { killer = r0.why; why = 'IT KILLED THE RELAY (exit ' + relay.child.exitCode + ')'; }
        if (why) test.fail('the relay\'s door, ' + r0.why + ': ' + why);
        else doorAnswered[ri] = true;
      }
      // Each request written out, in the order thrown, so that each check has a plain title of its own.
      if (doorAnswered[0]) test.check('POST /api/relay/post, not JSON: answered, and the relay still answers');
      if (doorAnswered[1]) test.check('POST /api/relay/post, JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[2]) test.check('POST /api/relay/post, a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[3]) test.check('POST /api/relay/post, JSON null: answered, and the relay still answers');
      if (doorAnswered[4]) test.check('POST /api/relay/post, deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[5]) test.check('POST /api/relay/post, a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[6]) test.check('POST /api/relay/post, a constructor key: answered, and the relay still answers');
      if (doorAnswered[7]) test.check('POST /api/relay/post, invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[8]) test.check('POST /api/relay/post, from as a number: answered, and the relay still answers');
      if (doorAnswered[9]) test.check('POST /api/relay/post, sig missing: answered, and the relay still answers');
      if (doorAnswered[10]) test.check('POST /api/relay/post, a forged sig: answered, and the relay still answers');
      if (doorAnswered[11]) test.check('POST /api/relay/post, text not JSON, signed: answered, and the relay still answers');
      if (doorAnswered[12]) test.check('POST /api/relay/post, text a JSON array, signed: answered, and the relay still answers');
      if (doorAnswered[13]) test.check('POST /api/relay/post, text a huge string, signed: answered, and the relay still answers');
      if (doorAnswered[14]) test.check('POST /api/relay/post, text with a NUL, signed: answered, and the relay still answers');
      if (doorAnswered[15]) test.check('POST /api/relay/post, no Content-Type: answered, and the relay still answers');
      if (doorAnswered[16]) test.check('POST /api/relay/post, Content-Type text/plain: answered, and the relay still answers');
      if (doorAnswered[17]) test.check('POST /api/relay/post, a body cut off half-way: answered, and the relay still answers');
      if (doorAnswered[18]) test.check('POST /api/relay/post, one byte past BODY_MAX: answered, and the relay still answers');
      if (doorAnswered[19]) test.check('POST /api/relay/post, a Content-Length far past what is sent: answered, and the relay still answers');
      if (doorAnswered[20]) test.check('POST /api/relay/reply, not JSON: answered, and the relay still answers');
      if (doorAnswered[21]) test.check('POST /api/relay/reply, JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[22]) test.check('POST /api/relay/reply, a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[23]) test.check('POST /api/relay/reply, JSON null: answered, and the relay still answers');
      if (doorAnswered[24]) test.check('POST /api/relay/reply, deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[25]) test.check('POST /api/relay/reply, a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[26]) test.check('POST /api/relay/reply, a constructor key: answered, and the relay still answers');
      if (doorAnswered[27]) test.check('POST /api/relay/reply, invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[28]) test.check('POST /api/relay/reply, from as a number: answered, and the relay still answers');
      if (doorAnswered[29]) test.check('POST /api/relay/reply, sig missing: answered, and the relay still answers');
      if (doorAnswered[30]) test.check('POST /api/relay/reply, a forged sig: answered, and the relay still answers');
      if (doorAnswered[31]) test.check('POST /api/relay/reply, text not JSON, signed: answered, and the relay still answers');
      if (doorAnswered[32]) test.check('POST /api/relay/reply, text a JSON array, signed: answered, and the relay still answers');
      if (doorAnswered[33]) test.check('POST /api/relay/reply, text a huge string, signed: answered, and the relay still answers');
      if (doorAnswered[34]) test.check('POST /api/relay/reply, text with a NUL, signed: answered, and the relay still answers');
      if (doorAnswered[35]) test.check('POST /api/relay/reply, no Content-Type: answered, and the relay still answers');
      if (doorAnswered[36]) test.check('POST /api/relay/reply, Content-Type text/plain: answered, and the relay still answers');
      if (doorAnswered[37]) test.check('POST /api/relay/reply, a body cut off half-way: answered, and the relay still answers');
      if (doorAnswered[38]) test.check('POST /api/relay/reply, one byte past BODY_MAX: answered, and the relay still answers');
      if (doorAnswered[39]) test.check('POST /api/relay/reply, a Content-Length far past what is sent: answered, and the relay still answers');
      if (doorAnswered[40]) test.check('POST /api/relay/face/answer, not JSON: answered, and the relay still answers');
      if (doorAnswered[41]) test.check('POST /api/relay/face/answer, JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[42]) test.check('POST /api/relay/face/answer, a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[43]) test.check('POST /api/relay/face/answer, JSON null: answered, and the relay still answers');
      if (doorAnswered[44]) test.check('POST /api/relay/face/answer, deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[45]) test.check('POST /api/relay/face/answer, a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[46]) test.check('POST /api/relay/face/answer, a constructor key: answered, and the relay still answers');
      if (doorAnswered[47]) test.check('POST /api/relay/face/answer, invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[48]) test.check('POST /api/relay/face/answer, from as a number: answered, and the relay still answers');
      if (doorAnswered[49]) test.check('POST /api/relay/face/answer, sig missing: answered, and the relay still answers');
      if (doorAnswered[50]) test.check('POST /api/relay/face/answer, a forged sig: answered, and the relay still answers');
      if (doorAnswered[51]) test.check('POST /api/relay/face/answer, text not JSON, signed: answered, and the relay still answers');
      if (doorAnswered[52]) test.check('POST /api/relay/face/answer, text a JSON array, signed: answered, and the relay still answers');
      if (doorAnswered[53]) test.check('POST /api/relay/face/answer, text a huge string, signed: answered, and the relay still answers');
      if (doorAnswered[54]) test.check('POST /api/relay/face/answer, text with a NUL, signed: answered, and the relay still answers');
      if (doorAnswered[55]) test.check('POST /api/relay/face/answer, no Content-Type: answered, and the relay still answers');
      if (doorAnswered[56]) test.check('POST /api/relay/face/answer, Content-Type text/plain: answered, and the relay still answers');
      if (doorAnswered[57]) test.check('POST /api/relay/face/answer, a body cut off half-way: answered, and the relay still answers');
      if (doorAnswered[58]) test.check('POST /api/relay/face/answer, one byte past BODY_MAX: answered, and the relay still answers');
      if (doorAnswered[59]) test.check('POST /api/relay/face/answer, a Content-Length far past what is sent: answered, and the relay still answers');
      if (doorAnswered[60]) test.check('POST /api/relay/face/stream, not JSON: answered, and the relay still answers');
      if (doorAnswered[61]) test.check('POST /api/relay/face/stream, JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[62]) test.check('POST /api/relay/face/stream, a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[63]) test.check('POST /api/relay/face/stream, JSON null: answered, and the relay still answers');
      if (doorAnswered[64]) test.check('POST /api/relay/face/stream, deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[65]) test.check('POST /api/relay/face/stream, a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[66]) test.check('POST /api/relay/face/stream, a constructor key: answered, and the relay still answers');
      if (doorAnswered[67]) test.check('POST /api/relay/face/stream, invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[68]) test.check('POST /api/relay/face/stream, from as a number: answered, and the relay still answers');
      if (doorAnswered[69]) test.check('POST /api/relay/face/stream, sig missing: answered, and the relay still answers');
      if (doorAnswered[70]) test.check('POST /api/relay/face/stream, a forged sig: answered, and the relay still answers');
      if (doorAnswered[71]) test.check('POST /api/relay/face/stream, text not JSON, signed: answered, and the relay still answers');
      if (doorAnswered[72]) test.check('POST /api/relay/face/stream, text a JSON array, signed: answered, and the relay still answers');
      if (doorAnswered[73]) test.check('POST /api/relay/face/stream, text a huge string, signed: answered, and the relay still answers');
      if (doorAnswered[74]) test.check('POST /api/relay/face/stream, text with a NUL, signed: answered, and the relay still answers');
      if (doorAnswered[75]) test.check('POST /api/relay/face/stream, no Content-Type: answered, and the relay still answers');
      if (doorAnswered[76]) test.check('POST /api/relay/face/stream, Content-Type text/plain: answered, and the relay still answers');
      if (doorAnswered[77]) test.check('POST /api/relay/face/stream, a body cut off half-way: answered, and the relay still answers');
      if (doorAnswered[78]) test.check('POST /api/relay/face/stream, one byte past BODY_MAX: answered, and the relay still answers');
      if (doorAnswered[79]) test.check('POST /api/relay/face/stream, a Content-Length far past what is sent: answered, and the relay still answers');
      if (doorAnswered[80]) test.check('POST /face/api (face host), not JSON: answered, and the relay still answers');
      if (doorAnswered[81]) test.check('POST /face/api (face host), JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[82]) test.check('POST /face/api (face host), a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[83]) test.check('POST /face/api (face host), JSON null: answered, and the relay still answers');
      if (doorAnswered[84]) test.check('POST /face/api (face host), deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[85]) test.check('POST /face/api (face host), a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[86]) test.check('POST /face/api (face host), a constructor key: answered, and the relay still answers');
      if (doorAnswered[87]) test.check('POST /face/api (face host), invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[88]) test.check('POST /face/call (face host), not JSON: answered, and the relay still answers');
      if (doorAnswered[89]) test.check('POST /face/call (face host), JSON that is not an object: answered, and the relay still answers');
      if (doorAnswered[90]) test.check('POST /face/call (face host), a bare JSON string: answered, and the relay still answers');
      if (doorAnswered[91]) test.check('POST /face/call (face host), JSON null: answered, and the relay still answers');
      if (doorAnswered[92]) test.check('POST /face/call (face host), deep nesting, 5000 levels: answered, and the relay still answers');
      if (doorAnswered[93]) test.check('POST /face/call (face host), a __proto__ key: answered, and the relay still answers');
      if (doorAnswered[94]) test.check('POST /face/call (face host), a constructor key: answered, and the relay still answers');
      if (doorAnswered[95]) test.check('POST /face/call (face host), invalid UTF-8 bytes: answered, and the relay still answers');
      if (doorAnswered[96]) test.check('GET /face/allowed?domain=%00 (face host): answered, and the relay still answers');
      if (doorAnswered[97]) test.check('GET /face/allowed?domain=<9000 a\'s> (face host): answered, and the relay still answers');
      if (doorAnswered[98]) test.check('GET /face/file?path=..%2f..%2frelay-state (face host): answered, and the relay still answers');
      if (doorAnswered[99]) test.check('GET /face/stream (face host): answered, and the relay still answers');
      if (doorAnswered[100]) test.check('GET /api/relay/stream: answered, and the relay still answers');
      if (doorAnswered[101]) test.check('GET /api/relay/stream?sig=garbage&key=%00: answered, and the relay still answers');
      if (doorAnswered[102]) test.check('GET /api/relay/stream?sig=<9000 a\'s>: answered, and the relay still answers');
      if (doorAnswered[103]) test.check('GET /api/relay/stream?key=__proto__: answered, and the relay still answers');
      if (doorAnswered[104]) test.check('a request line that is not HTTP: answered, and the relay still answers');
      if (doorAnswered[105]) test.check('a header line with no colon: answered, and the relay still answers');
      if (doorAnswered[106]) test.check('GET /..: answered, and the relay still answers');
      if (doorAnswered[107]) test.check('POST /..: answered, and the relay still answers');
      if (doorAnswered[108]) test.check('GET /../../../../etc/passwd: answered, and the relay still answers');
      if (doorAnswered[109]) test.check('POST /../../../../etc/passwd: answered, and the relay still answers');
      if (doorAnswered[110]) test.check('GET /%2e%2e/%2e%2e/etc/passwd: answered, and the relay still answers');
      if (doorAnswered[111]) test.check('POST /%2e%2e/%2e%2e/etc/passwd: answered, and the relay still answers');
      if (doorAnswered[112]) test.check('GET /shell/%2f%2f..%2f..%2fetc: answered, and the relay still answers');
      if (doorAnswered[113]) test.check('POST /shell/%2f%2f..%2f..%2fetc: answered, and the relay still answers');
      if (doorAnswered[114]) test.check('GET /<9000 a\'s>: answered, and the relay still answers');
      if (doorAnswered[115]) test.check('POST /<9000 a\'s>: answered, and the relay still answers');
      if (doorAnswered[116]) test.check('GET /%: answered, and the relay still answers');
      if (doorAnswered[117]) test.check('POST /%: answered, and the relay still answers');
      if (doorAnswered[118]) test.check('GET /%zz: answered, and the relay still answers');
      if (doorAnswered[119]) test.check('POST /%zz: answered, and the relay still answers');
      if (doorAnswered[120]) test.check('GET /%E0%A4%A: answered, and the relay still answers');
      if (doorAnswered[121]) test.check('POST /%E0%A4%A: answered, and the relay still answers');
      if (doorAnswered[122]) test.check('GET /api/%2e%2e/relay/post: answered, and the relay still answers');
      if (doorAnswered[123]) test.check('POST /api/%2e%2e/relay/post: answered, and the relay still answers');
      if (doorAnswered[124]) test.check('GET //api//relay//post: answered, and the relay still answers');
      if (doorAnswered[125]) test.check('POST //api//relay//post: answered, and the relay still answers');
      if (doorAnswered[126]) test.check('GET /DEBUG/../../spirit/state/identity.json: answered, and the relay still answers');
      if (doorAnswered[127]) test.check('POST /DEBUG/../../spirit/state/identity.json: answered, and the relay still answers');
      if (doorAnswered[128]) test.check('GET /shell/../../spirit/state/relay.db: answered, and the relay still answers');
      if (doorAnswered[129]) test.check('POST /shell/../../spirit/state/relay.db: answered, and the relay still answers');
      if (doorAnswered[130]) test.check('GET /\\..\\..\\relay-state: answered, and the relay still answers');
      if (doorAnswered[131]) test.check('POST /\\..\\..\\relay-state: answered, and the relay still answers');
      if (doorAnswered[132]) test.check('GET /?%: answered, and the relay still answers');
      if (doorAnswered[133]) test.check('POST /?%: answered, and the relay still answers');
      if (doorAnswered[134]) test.check('GET *: answered, and the relay still answers');
      if (doorAnswered[135]) test.check('POST *: answered, and the relay still answers');
      if (doorAnswered[136]) test.check('GET /%00: answered, and the relay still answers');
      if (doorAnswered[137]) test.check('POST /%00: answered, and the relay still answers');
      if (doorAnswered[138]) test.check('GET /face.html%00.js: answered, and the relay still answers');
      if (doorAnswered[139]) test.check('POST /face.html%00.js: answered, and the relay still answers');
      if (doorAnswered[140]) test.check('GET /shell/boot.js%00: answered, and the relay still answers');
      if (doorAnswered[141]) test.check('POST /shell/boot.js%00: answered, and the relay still answers');
      if (doorAnswered[142]) test.check('GET /.. (face host): answered, and the relay still answers');
      if (doorAnswered[143]) test.check('POST /.. (face host): answered, and the relay still answers');
      if (doorAnswered[144]) test.check('GET /../../../../etc/passwd (face host): answered, and the relay still answers');
      if (doorAnswered[145]) test.check('POST /../../../../etc/passwd (face host): answered, and the relay still answers');
      if (doorAnswered[146]) test.check('GET /%2e%2e/%2e%2e/etc/passwd (face host): answered, and the relay still answers');
      if (doorAnswered[147]) test.check('POST /%2e%2e/%2e%2e/etc/passwd (face host): answered, and the relay still answers');
      if (doorAnswered[148]) test.check('GET /shell/%2f%2f..%2f..%2fetc (face host): answered, and the relay still answers');
      if (doorAnswered[149]) test.check('POST /shell/%2f%2f..%2f..%2fetc (face host): answered, and the relay still answers');
      if (doorAnswered[150]) test.check('GET /<9000 a\'s> (face host): answered, and the relay still answers');
      if (doorAnswered[151]) test.check('POST /<9000 a\'s> (face host): answered, and the relay still answers');
      if (doorAnswered[152]) test.check('GET /% (face host): answered, and the relay still answers');
      if (doorAnswered[153]) test.check('POST /% (face host): answered, and the relay still answers');
      if (doorAnswered[154]) test.check('GET /%zz (face host): answered, and the relay still answers');
      if (doorAnswered[155]) test.check('POST /%zz (face host): answered, and the relay still answers');
      if (doorAnswered[156]) test.check('GET /%E0%A4%A (face host): answered, and the relay still answers');
      if (doorAnswered[157]) test.check('POST /%E0%A4%A (face host): answered, and the relay still answers');
      if (doorAnswered[158]) test.check('GET /api/%2e%2e/relay/post (face host): answered, and the relay still answers');
      if (doorAnswered[159]) test.check('POST /api/%2e%2e/relay/post (face host): answered, and the relay still answers');
      if (doorAnswered[160]) test.check('GET //api//relay//post (face host): answered, and the relay still answers');
      if (doorAnswered[161]) test.check('POST //api//relay//post (face host): answered, and the relay still answers');
      if (doorAnswered[162]) test.check('GET /DEBUG/../../spirit/state/identity.json (face host): answered, and the relay still answers');
      if (doorAnswered[163]) test.check('POST /DEBUG/../../spirit/state/identity.json (face host): answered, and the relay still answers');
      if (doorAnswered[164]) test.check('GET /shell/../../spirit/state/relay.db (face host): answered, and the relay still answers');
      if (doorAnswered[165]) test.check('POST /shell/../../spirit/state/relay.db (face host): answered, and the relay still answers');
      if (doorAnswered[166]) test.check('GET /\\..\\..\\relay-state (face host): answered, and the relay still answers');
      if (doorAnswered[167]) test.check('POST /\\..\\..\\relay-state (face host): answered, and the relay still answers');
      if (doorAnswered[168]) test.check('GET /?% (face host): answered, and the relay still answers');
      if (doorAnswered[169]) test.check('POST /?% (face host): answered, and the relay still answers');
      if (doorAnswered[170]) test.check('GET * (face host): answered, and the relay still answers');
      if (doorAnswered[171]) test.check('POST * (face host): answered, and the relay still answers');
      if (doorAnswered[172]) test.check('GET /%00 (face host): answered, and the relay still answers');
      if (doorAnswered[173]) test.check('POST /%00 (face host): answered, and the relay still answers');
      if (doorAnswered[174]) test.check('GET /face.html%00.js (face host): answered, and the relay still answers');
      if (doorAnswered[175]) test.check('POST /face.html%00.js (face host): answered, and the relay still answers');
      if (doorAnswered[176]) test.check('GET /shell/boot.js%00 (face host): answered, and the relay still answers');
      if (doorAnswered[177]) test.check('POST /shell/boot.js%00 (face host): answered, and the relay still answers');
      if (notThrown.length) test.fail('the relay\'s door: ' + notThrown.length + ' requests not thrown, the relay died at ' + killer + ': ' + short(notThrown));

      test.subHeading('the relay is still running at the end');
      ok(relay.child.exitCode === null && await plain(), 'the scratch relay is still running and answers', 'the scratch relay ' + (relay.child.exitCode !== null ? 'exited with ' + relay.child.exitCode : 'does not answer'));
    } finally {
      try { if (relay.child) relay.child.kill(); } catch (e) { /* gone */ }
      if (relay.root) try { fs.rmSync(relay.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
    await badAnswers();
  }());
}
