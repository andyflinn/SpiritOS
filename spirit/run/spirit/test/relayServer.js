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
const http = require('http');
const net = require('net');
const { sleep, scratchRelay, scratchFaceRelay } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

const FILE = path.join(__dirname, '..', 'relayServer.js');

const src = fs.readFileSync(FILE, 'utf8');
const dirSrc = (/^const FACE_DIR = (path\.join\(__dirname, [^;]*\));/m.exec(src) || [])[1];
const mapSrc = (/^const FACE_FILES = (\{[^;]*\});/m.exec(src) || [])[1];
// goal/G43.18 (Q25, Andy: "the browser should see them the same."): an address is served from its file, serveCommon.pageFile.
const common = require(path.join(RUN, 'spirit', 'serveCommon.js'));
let dir = null; let map = null;
try { dir = dirSrc ? new Function('path', '__dirname', 'return ' + dirSrc + ';')(path, path.dirname(FILE)) : null; } catch (e) { dir = null; }
try { map = mapSrc ? new Function('common', 'return ' + mapSrc + ';')(common) : null; } catch (e) { map = null; }

// where its face files come from
test.run('the relay reads its face files from the run root, each by its file', 0.2, function () {
  return (!!dir && path.relative(RUN, dir) === '') || false;
}, test.limit.quick);

// the addresses it serves
// goal/G43.18, box v29: "The relay serves a logged-out face one plain page, the one-field form, with spirit.js and seal.js
// only": /spirit.js, face.html's one script tag, the seal, and the tab's icon. No boot.js, sheet or login app.
const WANT = ['/spirit.js', '/shell/seal.js', '/shell/favicon.svg'];
const keys = map ? Object.keys(map).sort() : [];
test.run('its map serves exactly /spirit.js, /shell/seal.js and /shell/favicon.svg', 0.2, function () {
  return (!!map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort())) || false;
}, test.limit.quick);
test.run('no address under /face/ serves a file any more', 0.2, function () {
  const old = keys.filter(function (k) { return k.indexOf('/face/') === 0; });
  return (!!map && !old.length) || false;
}, test.limit.quick);
test.run('every file the map names is there', 0.2, function () {
  const missing = map && dir ? keys.filter(function (k) { return !fs.existsSync(path.join(dir, map[k])); }) : keys;
  return (!!map && !!dir && !missing.length) || false;
}, test.limit.quick);
test.run('each address is served from its file, as the node serves it', 0.2, function () {
  const named = map ? keys.every(function (k) { return map[k] === common.pageFile(k); }) : false;
  return named || false;
}, test.limit.quick);

// goal/G41.19, Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!": the relay hands face.html and spirit.js over as they are on
// disk. Its faceSend is lifted out of the source and run on the real files.
// face.html and spirit.js, as they are on disk
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
// the face page logs nobody in from a token in its address
// Line ends either way, as a Windows checkout has them (CRLF), as the faceSend pattern above does.
const routeSrc = (/\r?\n(  if \(req\.method === 'GET' && \(pathname === '\/' \|\| pathname === '\/face\.html'\)\) \{[\s\S]*?\r?\n  \})\r?\n/.exec(src) || [])[1];
const asked = { logins: [], cookies: [], sent: [] };
let route = null;
try { route = routeSrc ? new Function('req', 'pathname', 'url', 'relay', 'faceSetCookie', 'faceSend', 'at', 'res', 'common', routeSrc + '\nreturn false;') : null; } catch (e) { route = null; }
let served = false;
test.run('the face page asked with a token in its address serves face.html', 0.2, function () {
  if (route) {
    const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWx';
    served = route({ method: 'GET' }, '/', new URL('https://harbour.relay.example/?' + TOKEN), { faceLogin: function (n, t) { asked.logins.push([n, t]); return { loggedIn: true, session: 'S' }; } },
      function (res, sid) { asked.cookies.push(sid); }, function (res, st, file) { asked.sent.push(file); }, { name: 'harbour' }, {}, common);
  }
  return (!!route && served === true && asked.sent[0] === common.pageFile('face.html')) || false;
}, test.limit.quick);
// A token in an address that logs in is a login by a link: 0.8.
test.run('the face page asked with a token in its address logs nobody in: no face login is asked and no login cookie is set', 0.8, function () {
  return (!!route && asked.logins.length === 0 && asked.cookies.length === 0) || false;
}, test.limit.quick);
test.run('the relay serves face.html byte for byte as it is on disk', 0.2, async function () {
  const got = await sent(common.pageFile('face.html'));
  return (!!got && got.equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html')))) || false;
}, test.limit.quick);
test.run('the relay serves /spirit.js, from spirit/spirit.js, byte for byte', 0.2, async function () {
  const got = await sent(map && map['/spirit.js'] || common.pageFile('spirit.js'));
  return (!!got && got.equals(fs.readFileSync(path.join(RUN, 'spirit', 'spirit.js')))) || false;
}, test.limit.quick);

// A PAGE ON ANOTHER MEMBER'S FACE CANNOT DRIVE A LOGGED-IN OWNER'S NODE (goal/G41.30, the review, RC2: "a page on any
// member's face can make a logged-in owner's face run verbs on his node, because all faces are same-site and /face/call
// has no Origin check"; its fix: "on every /face/* POST, require Origin equal to the face's own host, require the
// session's name to match faceAt(host).name, and require Content-Type: application/json"; Andy, Q3: "yes."). On a
// scratch relay with two members, each with a face, present and logged in. A refusal is a 4xx and no face event on any
// member's stream; the face's own page still reaches its node.
// POST /face/call and /face/api: only the face's own page
// A page of another face let in is an unauthorized caller driving the owner's node: each refusal 0.8.
const FP = { R: null };
function faceEvents(from) { return FP.R.lines.slice(from).filter(function (l) { return /^event: face\n/.test(l.line); }); }
// One POST as a browser sends it: answered, or still waiting after a moment, which is the call gone on to the node.
function facePost(p, o) {
  const R = FP.R; const H = R.members.harbour;
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
}
const JSONT = 'application/json';
function own() { return 'https://' + FP.R.members.harbour.host; }
async function faceRefused(o) {
  if (!FP.R || !FP.R.up) return false;
  const from = FP.R.lines.length;
  const r = await facePost('/face/call', o);
  await sleep(100);
  const ev = faceEvents(from);
  return (r.status >= 400 && r.status < 500 && !ev.length) || false;
}
test.run('a scratch relay comes up with two faces, present and logged in', 0.2, async function () {
  FP.R = await scratchFaceRelay();
  return (FP.R.up && !!FP.R.members.harbour && !!FP.R.members.quay) || false;
}, test.limit.slow);
test.run('a /face/call with an Origin of another face is refused with a 4xx and no face event', 0.8, function () {
  if (!FP.R || !FP.R.up) return false;
  return faceRefused({ origin: 'https://' + FP.R.members.quay.host, type: JSONT });
}, test.limit.quick);
test.run('a /face/call with no Origin is refused with a 4xx and no face event', 0.8, function () { return faceRefused({ type: JSONT }); }, test.limit.quick);
test.run('a /face/call sent as text/plain, a form a page sends with no preflight, is refused with a 4xx and no face event', 0.8, function () {
  if (!FP.R || !FP.R.up) return false;
  return faceRefused({ origin: own(), type: 'text/plain' });
}, test.limit.quick);
test.run('a /face/call with another member\'s session at this face\'s host is refused with a 4xx and no face event', 0.8, function () {
  if (!FP.R || !FP.R.up) return false;
  return faceRefused({ origin: own(), type: JSONT, sid: FP.R.members.quay.sid });
}, test.limit.quick);
test.run('the face\'s own page, its Origin and json, still reaches its node', 0.2, async function () {
  if (!FP.R || !FP.R.up) return false;
  const from = FP.R.lines.length;
  await facePost('/face/call', { origin: own(), type: JSONT, body: '{"call":"node.card","args":{}}' });
  const ev = faceEvents(from);
  return (ev.length === 1 && ev[0].stream === 'harbour') || false;
}, test.limit.slow);
test.run('a /face/api call with an Origin of another face is refused with a 4xx', 0.8, async function () {
  if (!FP.R || !FP.R.up) return false;
  const api = await facePost('/face/api', { origin: 'https://' + FP.R.members.quay.host, type: JSONT, body: '{"verb":"state"}' });
  return (api.status >= 400 && api.status < 500) || false;
}, test.limit.quick);
test.run('the face\'s own page still reaches /face/api', 0.2, async function () {
  if (!FP.R || !FP.R.up) return false;
  const apiOwn = await facePost('/face/api', { origin: own(), type: JSONT, body: '{"verb":"state"}' });
  return apiOwn.status === 200 || false;
}, test.limit.quick);

// ── THE GARBAGE PART ──
// THE ATTACKER AT THE RELAY'S DOOR (goal/G41.30; spec: ./relayServer.md, its section). The box: "all servers (node
// and relay, or serveCommon) are tested by throwing malformed paths at them, and malformed, invalid arguments", "an
// appserver api can be called outside a spirit object, and an attacker trying to crash our servers will throw ANYTHING at
// the api. Imitate that attacker", and "the server MUST not CRASH or HANG"; Andy, on the gap: "The relay's door is not
// tested yet: there is no scratch relay helper. - close this gap, dammit!". The node's doors are
// garbage.js; this section is the relay's, on a scratch relay of its own (spirit/test/headLessChrome.js
// scratchRelay), never a live one. Everything goes raw over a bare socket, as an attacker sends it.

const ASK_MS = 10000;
const PLAIN_MS = 3000;
const BATCH = 20;
const FACE_DOMAIN = 'relay.example';
let HOST = '';

// RAW OVER A BARE SOCKET: the request as written, nothing normalised. Answers { status, text } or { hung } or { error: true }.
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
    s.on('error', function (e) { clearTimeout(timer); finish(got ? answer() : { error: true }); });
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
// answered; any other 5xx is the relay breaking. True when it broke.
function broke(r) {
  if (!r || r.hung) return true;
  if (r.error) return true;
  if (!r.status) return true;
  if (r.status >= 500 && !(r.status === 503 && /retryAfterMs/.test(r.text))) return true;
  if (/handler-failed|the handler failed/.test(r.text)) return true;
  return false;
}

// garbage: the attacker's garbage at the relay's door (goal/G41.30)
const G = { relay: null, base: '', plain: null, list: null, verbs: {}, RAWS: [], ASKS: [], killer: false, hungAfter: [], thrown: false };
function signed(id, text) {
  const A = G.relay.auth;
  const m = A.postMessage(id.publicKey, '', text);
  return { from: id.publicKey, to: '', text: text, sig: A.sign(id.privateKey, m) };
}
test.run('a scratch relay comes up and hands its garbage list', 0.2, async function () {
  // The relay with faces is let go first.
  if (FP.R) { FP.R.stop(); FP.R = null; }
  const relay = G.relay = await scratchRelay({ debug: true, faceDomain: FACE_DOMAIN });
  if (!relay.up) return false;
  const base = G.base = relay.base;
  HOST = new URL(base).host;
  const FACE_HOST = 'harbour.' + FACE_DOMAIN;
  const A = relay.auth;
  G.plain = async function () { const r = await raw(base, getHead('/'), '', { ms: PLAIN_MS }); return !!(r && r.status); };

  // 1) INTROSPECT: the relay's own api, as its garbage list (its DEBUG route: spirit/DEBUG/garbageArguments.js over the
  // relay's api tree), each entry the ask's body { body: { <verb>: args } }.
  let list = null;
  try { list = await fetch(base + '/DEBUG/spirit/relay/garbageArguments.json').then(function (r) { return r.json(); }); } catch (e) { list = null; }
  if (!Array.isArray(list) || !list.length) return false;
  G.list = list;
  const verbs = G.verbs;
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
  const RAWS = G.RAWS;
  POSTS.forEach(function (p) {
    BODIES.forEach(function (b) { RAWS.push({ run: function () { return post(base, p, b[1]); } }); });
    RAWS.push({ run: function () { return raw(base, postHead(p, 2, null), '{}'); } });
    RAWS.push({ run: function () { return raw(base, postHead(p, 2, 'text/plain'), '{}'); } });
    RAWS.push({ run: function () { return raw(base, postHead(p, 100), '{"from":"x', { keepOpen: true }); }, waits: true });
    RAWS.push({ run: function () { return raw(base, postHead(p, BODY_MAX + 1), '{"t":"' + 'x'.repeat(BODY_MAX + 1 - 8) + '"}'); } });
    RAWS.push({ run: function () { return raw(base, postHead(p, 10000000), '{}', { keepOpen: true }); }, waits: true });
  });
  // The face's own routes, asked under a face's host (goal/G30.9), a face this relay does not serve.
  ['/face/api', '/face/call'].forEach(function (p) {
    BODIES.slice(0, 8).forEach(function (b) { RAWS.push({ run: function () { return post(base, p, b[1], FACE_HOST); } }); });
  });
  ['/face/allowed?domain=' + encodeURIComponent('\u0000'), '/face/allowed?domain=' + 'a'.repeat(9000), '/face/file?path=..%2f..%2frelay-state', '/face/stream'].forEach(function (p) {
    RAWS.push({ run: function () { return raw(base, getHead(p, FACE_HOST), ''); } });
  });
  // The members' stream, with garbage in its signature and key.
  ['/api/relay/stream', '/api/relay/stream?sig=garbage&key=%00', '/api/relay/stream?sig=' + 'a'.repeat(9000), '/api/relay/stream?key=__proto__'].forEach(function (p) {
    RAWS.push({ run: function () { return raw(base, getHead(p, null, 'X-Spirit-Sig: garbage\r\n'), '', { keepOpen: true }); }, waits: true });
  });
  RAWS.push({ run: function () { return raw(base, 'GARBAGE /api/relay/post NOPE\r\n\r\n', ''); } });
  RAWS.push({ run: function () { return raw(base, 'POST /api/relay/post HTTP/1.1\r\nHost 127.0.0.1\r\nContent-Length: 2\r\n\r\n', '{}'); } });
  // 3) MALFORMED PATHS, GET AND POST, at the relay's host and at a face's (the box, rule 2: "malformed paths").
  const PATHS = ['/..', '/../../../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/shell/%2f%2f..%2f..%2fetc', '/' + 'a'.repeat(9000), '/%', '/%zz',
    '/%E0%A4%A', '/api/%2e%2e/relay/post', '//api//relay//post', '/DEBUG/../../spirit/state/identity.json', '/shell/../../spirit/state/relay.db',
    '/\\..\\..\\relay-state', '/?%', '*',
    // A null byte last: it may kill the relay, and every path before it is still thrown.
    '/%00', '/face.html%00.js', '/shell/boot.js%00'];
  [HOST, FACE_HOST].forEach(function (h) {
    PATHS.forEach(function (p) {
      RAWS.push({ run: function () { return raw(base, getHead(p, h), ''); } });
      RAWS.push({ run: function () { return raw(base, postHead(p, 2, undefined, h), '{}'); } });
    });
  });
  // Each verb's garbage, signed by the relay's owner, so it passes the door and reaches the verb (the deepest a caller
  // gets); and by a stranger, as anybody may send it.
  list.forEach(function (e) { G.ASKS.push({ who: 'owner', id: relay.owner, e: e }); });
  list.forEach(function (e) { G.ASKS.push({ who: 'stranger', id: stranger, e: e }); });
  return true;
}, test.limit.slow);

// THE VERBS, BATCH BY BATCH.
// /api/relay/post: every relay verb takes bad arguments without crashing or hanging
test.run('the relay verbs took all their garbage at /api/relay/post without crashing or hanging', 0.2, async function () {
  if (!G.list) return false;
  const relay = G.relay; const base = G.base; const ASKS = G.ASKS;
  const broken = {}; const statuses = {};
  for (let i = 0; i < ASKS.length && !G.killer; i += BATCH) {
    const batch = ASKS.slice(i, i + BATCH);
    const got = await Promise.all(batch.map(function (a) { return post(base, '/api/relay/post', signed(a.id, JSON.stringify(Object.assign({ v: 1 }, a.e)))); }));
    got.forEach(function (r, j) {
      const a = batch[j];
      const name = Object.keys(a.e.body || {})[0] || '?';
      statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1;
      if (broke(r)) broken[name] = true;
    });
    if (relay.child.exitCode !== null) { G.killer = true; break; }
    if (!(await G.plain())) G.hungAfter.push(i);
  }
  G.thrown = true;
  // Each verb that broke named in the answer: the verbs are what the relay's garbage list names, so no title can be
  // written out per verb.
  const bad = Object.keys(G.verbs).filter(function (v) { return broken[v]; });
  return (!bad.length && !G.killer) || false;
}, test.limit.slow);
test.run('after every batch posted to /api/relay/post the relay answered a plain request in time', 0.2, function () {
  if (!G.thrown) return false;
  if (G.killer) return false;
  return !G.hungAfter.length || false;
}, test.limit.quick);

// THE RAW REQUESTS, ONE BY ONE.
// the relay's door: raw requests and malformed paths
// Each request written out, in the order thrown, so that each check has a plain title of its own. A request is thrown by
// its own test; once one killed the relay, the ones after it are not thrown, and say so.
async function door(ri) {
  if (!G.list) return false;
  const r0 = G.RAWS[ri];
  const relay = G.relay;
  if (G.killer) return false;
  const r = await r0.run();
  // A body cut off, or a held stream, may be held by the relay until its own time runs out: it must still answer
  // everybody else.
  let bad = r0.waits && r.hung ? false : broke(r);
  let alive = await G.plain();
  if (!alive) { await sleep(500); alive = await G.plain(); }
  if (!alive) bad = true;
  if (relay.child.exitCode !== null && !G.killer) { G.killer = true; bad = true; }
  return !bad || false;
}
test.run('a body that is not JSON posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(0); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(1); }, test.limit.slow);
test.run('a bare JSON string posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(2); }, test.limit.slow);
test.run('a JSON null posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(3); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(4); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(5); }, test.limit.slow);
test.run('a body with a constructor key posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(6); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(7); }, test.limit.slow);
test.run('a post whose from is a number, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(8); }, test.limit.slow);
test.run('a post with its sig missing, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(9); }, test.limit.slow);
test.run('a post with a forged sig, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(10); }, test.limit.slow);
test.run('a signed post whose text is not JSON, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(11); }, test.limit.slow);
test.run('a signed post whose text is a JSON array, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(12); }, test.limit.slow);
test.run('a signed post whose text holds a huge string, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(13); }, test.limit.slow);
test.run('a signed post whose text holds a NUL, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(14); }, test.limit.slow);
test.run('a body with no Content-Type posted to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(15); }, test.limit.slow);
test.run('a body sent as text/plain to /api/relay/post is answered, and the relay still answers', 0.2, function () { return door(16); }, test.limit.slow);
test.run('a body cut off half-way, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(17); }, test.limit.long);
test.run('a body one byte past the largest allowed, posted to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(18); }, test.limit.slow);
test.run('a post whose Content-Length is far past what is sent, to /api/relay/post, is answered, and the relay still answers', 0.2, function () { return door(19); }, test.limit.long);
test.run('a body that is not JSON posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(20); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(21); }, test.limit.slow);
test.run('a bare JSON string posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(22); }, test.limit.slow);
test.run('a JSON null posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(23); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(24); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(25); }, test.limit.slow);
test.run('a body with a constructor key posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(26); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(27); }, test.limit.slow);
test.run('a post whose from is a number, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(28); }, test.limit.slow);
test.run('a post with its sig missing, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(29); }, test.limit.slow);
test.run('a post with a forged sig, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(30); }, test.limit.slow);
test.run('a signed post whose text is not JSON, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(31); }, test.limit.slow);
test.run('a signed post whose text is a JSON array, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(32); }, test.limit.slow);
test.run('a signed post whose text holds a huge string, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(33); }, test.limit.slow);
test.run('a signed post whose text holds a NUL, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(34); }, test.limit.slow);
test.run('a body with no Content-Type posted to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(35); }, test.limit.slow);
test.run('a body sent as text/plain to /api/relay/reply is answered, and the relay still answers', 0.2, function () { return door(36); }, test.limit.slow);
test.run('a body cut off half-way, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(37); }, test.limit.long);
test.run('a body one byte past the largest allowed, posted to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(38); }, test.limit.slow);
test.run('a post whose Content-Length is far past what is sent, to /api/relay/reply, is answered, and the relay still answers', 0.2, function () { return door(39); }, test.limit.long);
test.run('a body that is not JSON posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(40); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(41); }, test.limit.slow);
test.run('a bare JSON string posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(42); }, test.limit.slow);
test.run('a JSON null posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(43); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(44); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(45); }, test.limit.slow);
test.run('a body with a constructor key posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(46); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(47); }, test.limit.slow);
test.run('a post whose from is a number, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(48); }, test.limit.slow);
test.run('a post with its sig missing, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(49); }, test.limit.slow);
test.run('a post with a forged sig, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(50); }, test.limit.slow);
test.run('a signed post whose text is not JSON, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(51); }, test.limit.slow);
test.run('a signed post whose text is a JSON array, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(52); }, test.limit.slow);
test.run('a signed post whose text holds a huge string, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(53); }, test.limit.slow);
test.run('a signed post whose text holds a NUL, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(54); }, test.limit.slow);
test.run('a body with no Content-Type posted to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(55); }, test.limit.slow);
test.run('a body sent as text/plain to /api/relay/face/answer is answered, and the relay still answers', 0.2, function () { return door(56); }, test.limit.slow);
test.run('a body cut off half-way, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(57); }, test.limit.long);
test.run('a body one byte past the largest allowed, posted to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(58); }, test.limit.slow);
test.run('a post whose Content-Length is far past what is sent, to /api/relay/face/answer, is answered, and the relay still answers', 0.2, function () { return door(59); }, test.limit.long);
test.run('a body that is not JSON posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(60); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(61); }, test.limit.slow);
test.run('a bare JSON string posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(62); }, test.limit.slow);
test.run('a JSON null posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(63); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(64); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(65); }, test.limit.slow);
test.run('a body with a constructor key posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(66); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(67); }, test.limit.slow);
test.run('a post whose from is a number, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(68); }, test.limit.slow);
test.run('a post with its sig missing, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(69); }, test.limit.slow);
test.run('a post with a forged sig, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(70); }, test.limit.slow);
test.run('a signed post whose text is not JSON, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(71); }, test.limit.slow);
test.run('a signed post whose text is a JSON array, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(72); }, test.limit.slow);
test.run('a signed post whose text holds a huge string, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(73); }, test.limit.slow);
test.run('a signed post whose text holds a NUL, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(74); }, test.limit.slow);
test.run('a body with no Content-Type posted to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(75); }, test.limit.slow);
test.run('a body sent as text/plain to /api/relay/face/stream is answered, and the relay still answers', 0.2, function () { return door(76); }, test.limit.slow);
test.run('a body cut off half-way, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(77); }, test.limit.long);
test.run('a body one byte past the largest allowed, posted to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(78); }, test.limit.slow);
test.run('a post whose Content-Length is far past what is sent, to /api/relay/face/stream, is answered, and the relay still answers', 0.2, function () { return door(79); }, test.limit.long);
test.run('a body that is not JSON posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(80); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(81); }, test.limit.slow);
test.run('a bare JSON string posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(82); }, test.limit.slow);
test.run('a JSON null posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(83); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(84); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(85); }, test.limit.slow);
test.run('a body with a constructor key posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(86); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /face/api under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(87); }, test.limit.slow);
test.run('a body that is not JSON posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(88); }, test.limit.slow);
test.run('a JSON body that is not an object posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(89); }, test.limit.slow);
test.run('a bare JSON string posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(90); }, test.limit.slow);
test.run('a JSON null posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(91); }, test.limit.slow);
test.run('a body nested 5000 levels deep posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(92); }, test.limit.slow);
test.run('a body with a __proto__ key posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(93); }, test.limit.slow);
test.run('a body with a constructor key posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(94); }, test.limit.slow);
test.run('a body of invalid UTF-8 bytes posted to /face/call under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(95); }, test.limit.slow);
test.run('a GET of /face/allowed with the domain %00, under a face\'s host, is answered, and the relay still answers', 0.2, function () { return door(96); }, test.limit.slow);
test.run('a GET of /face/allowed with a domain of 9000 a\'s, under a face\'s host, is answered, and the relay still answers', 0.2, function () { return door(97); }, test.limit.slow);
test.run('a GET of /face/file with the path ..%2f..%2frelay-state, under a face\'s host, is answered, and the relay still answers', 0.2, function () { return door(98); }, test.limit.slow);
test.run('a GET of /face/stream under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(99); }, test.limit.slow);
test.run('a GET of /api/relay/stream with a garbage signature header is answered, and the relay still answers', 0.2, function () { return door(100); }, test.limit.slow);
test.run('a GET of /api/relay/stream with the sig garbage and the key %00 is answered, and the relay still answers', 0.2, function () { return door(101); }, test.limit.slow);
test.run('a GET of /api/relay/stream with a sig of 9000 a\'s is answered, and the relay still answers', 0.2, function () { return door(102); }, test.limit.slow);
test.run('a GET of /api/relay/stream with the key __proto__ is answered, and the relay still answers', 0.2, function () { return door(103); }, test.limit.slow);
test.run('a request line that is not HTTP is answered, and the relay still answers', 0.2, function () { return door(104); }, test.limit.slow);
test.run('a header line with no colon is answered, and the relay still answers', 0.2, function () { return door(105); }, test.limit.slow);
test.run('a GET of the path /.. is answered, and the relay still answers', 0.2, function () { return door(106); }, test.limit.slow);
test.run('a POST to the path /.. is answered, and the relay still answers', 0.2, function () { return door(107); }, test.limit.slow);
test.run('a GET of the path /../../../../etc/passwd is answered, and the relay still answers', 0.2, function () { return door(108); }, test.limit.slow);
test.run('a POST to the path /../../../../etc/passwd is answered, and the relay still answers', 0.2, function () { return door(109); }, test.limit.slow);
test.run('a GET of the path /%2e%2e/%2e%2e/etc/passwd is answered, and the relay still answers', 0.2, function () { return door(110); }, test.limit.slow);
test.run('a POST to the path /%2e%2e/%2e%2e/etc/passwd is answered, and the relay still answers', 0.2, function () { return door(111); }, test.limit.slow);
test.run('a GET of the path /shell/%2f%2f..%2f..%2fetc is answered, and the relay still answers', 0.2, function () { return door(112); }, test.limit.slow);
test.run('a POST to the path /shell/%2f%2f..%2f..%2fetc is answered, and the relay still answers', 0.2, function () { return door(113); }, test.limit.slow);
test.run('a GET of a path of 9000 a\'s is answered, and the relay still answers', 0.2, function () { return door(114); }, test.limit.slow);
test.run('a POST to a path of 9000 a\'s is answered, and the relay still answers', 0.2, function () { return door(115); }, test.limit.slow);
test.run('a GET of the path /% is answered, and the relay still answers', 0.2, function () { return door(116); }, test.limit.slow);
test.run('a POST to the path /% is answered, and the relay still answers', 0.2, function () { return door(117); }, test.limit.slow);
test.run('a GET of the path /%zz is answered, and the relay still answers', 0.2, function () { return door(118); }, test.limit.slow);
test.run('a POST to the path /%zz is answered, and the relay still answers', 0.2, function () { return door(119); }, test.limit.slow);
test.run('a GET of the path /%E0%A4%A is answered, and the relay still answers', 0.2, function () { return door(120); }, test.limit.slow);
test.run('a POST to the path /%E0%A4%A is answered, and the relay still answers', 0.2, function () { return door(121); }, test.limit.slow);
test.run('a GET of the path /api/%2e%2e/relay/post is answered, and the relay still answers', 0.2, function () { return door(122); }, test.limit.slow);
test.run('a POST to the path /api/%2e%2e/relay/post is answered, and the relay still answers', 0.2, function () { return door(123); }, test.limit.slow);
test.run('a GET of the path //api//relay//post is answered, and the relay still answers', 0.2, function () { return door(124); }, test.limit.slow);
test.run('a POST to the path //api//relay//post is answered, and the relay still answers', 0.2, function () { return door(125); }, test.limit.slow);
test.run('a GET of the path /DEBUG/../../spirit/state/identity.json is answered, and the relay still answers', 0.2, function () { return door(126); }, test.limit.slow);
test.run('a POST to the path /DEBUG/../../spirit/state/identity.json is answered, and the relay still answers', 0.2, function () { return door(127); }, test.limit.slow);
test.run('a GET of the path /shell/../../spirit/state/relay.db is answered, and the relay still answers', 0.2, function () { return door(128); }, test.limit.slow);
test.run('a POST to the path /shell/../../spirit/state/relay.db is answered, and the relay still answers', 0.2, function () { return door(129); }, test.limit.slow);
test.run('a GET of the path /\\..\\..\\relay-state is answered, and the relay still answers', 0.2, function () { return door(130); }, test.limit.slow);
test.run('a POST to the path /\\..\\..\\relay-state is answered, and the relay still answers', 0.2, function () { return door(131); }, test.limit.slow);
test.run('a GET of the path /?% is answered, and the relay still answers', 0.2, function () { return door(132); }, test.limit.slow);
test.run('a POST to the path /?% is answered, and the relay still answers', 0.2, function () { return door(133); }, test.limit.slow);
test.run('a GET of the path * is answered, and the relay still answers', 0.2, function () { return door(134); }, test.limit.slow);
test.run('a POST to the path * is answered, and the relay still answers', 0.2, function () { return door(135); }, test.limit.slow);
test.run('a GET of the path /%00 is answered, and the relay still answers', 0.2, function () { return door(136); }, test.limit.slow);
test.run('a POST to the path /%00 is answered, and the relay still answers', 0.2, function () { return door(137); }, test.limit.slow);
test.run('a GET of the path /face.html%00.js is answered, and the relay still answers', 0.2, function () { return door(138); }, test.limit.slow);
test.run('a POST to the path /face.html%00.js is answered, and the relay still answers', 0.2, function () { return door(139); }, test.limit.slow);
test.run('a GET of the path /shell/boot.js%00 is answered, and the relay still answers', 0.2, function () { return door(140); }, test.limit.slow);
test.run('a POST to the path /shell/boot.js%00 is answered, and the relay still answers', 0.2, function () { return door(141); }, test.limit.slow);
test.run('a GET of the path /.. under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(142); }, test.limit.slow);
test.run('a POST to the path /.. under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(143); }, test.limit.slow);
test.run('a GET of the path /../../../../etc/passwd under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(144); }, test.limit.slow);
test.run('a POST to the path /../../../../etc/passwd under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(145); }, test.limit.slow);
test.run('a GET of the path /%2e%2e/%2e%2e/etc/passwd under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(146); }, test.limit.slow);
test.run('a POST to the path /%2e%2e/%2e%2e/etc/passwd under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(147); }, test.limit.slow);
test.run('a GET of the path /shell/%2f%2f..%2f..%2fetc under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(148); }, test.limit.slow);
test.run('a POST to the path /shell/%2f%2f..%2f..%2fetc under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(149); }, test.limit.slow);
test.run('a GET of a path of 9000 a\'s under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(150); }, test.limit.slow);
test.run('a POST to a path of 9000 a\'s under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(151); }, test.limit.slow);
test.run('a GET of the path /% under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(152); }, test.limit.slow);
test.run('a POST to the path /% under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(153); }, test.limit.slow);
test.run('a GET of the path /%zz under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(154); }, test.limit.slow);
test.run('a POST to the path /%zz under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(155); }, test.limit.slow);
test.run('a GET of the path /%E0%A4%A under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(156); }, test.limit.slow);
test.run('a POST to the path /%E0%A4%A under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(157); }, test.limit.slow);
test.run('a GET of the path /api/%2e%2e/relay/post under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(158); }, test.limit.slow);
test.run('a POST to the path /api/%2e%2e/relay/post under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(159); }, test.limit.slow);
test.run('a GET of the path //api//relay//post under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(160); }, test.limit.slow);
test.run('a POST to the path //api//relay//post under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(161); }, test.limit.slow);
test.run('a GET of the path /DEBUG/../../spirit/state/identity.json under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(162); }, test.limit.slow);
test.run('a POST to the path /DEBUG/../../spirit/state/identity.json under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(163); }, test.limit.slow);
test.run('a GET of the path /shell/../../spirit/state/relay.db under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(164); }, test.limit.slow);
test.run('a POST to the path /shell/../../spirit/state/relay.db under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(165); }, test.limit.slow);
test.run('a GET of the path /\\..\\..\\relay-state under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(166); }, test.limit.slow);
test.run('a POST to the path /\\..\\..\\relay-state under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(167); }, test.limit.slow);
test.run('a GET of the path /?% under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(168); }, test.limit.slow);
test.run('a POST to the path /?% under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(169); }, test.limit.slow);
test.run('a GET of the path * under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(170); }, test.limit.slow);
test.run('a POST to the path * under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(171); }, test.limit.slow);
test.run('a GET of the path /%00 under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(172); }, test.limit.slow);
test.run('a POST to the path /%00 under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(173); }, test.limit.slow);
test.run('a GET of the path /face.html%00.js under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(174); }, test.limit.slow);
test.run('a POST to the path /face.html%00.js under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(175); }, test.limit.slow);
test.run('a GET of the path /shell/boot.js%00 under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(176); }, test.limit.slow);
test.run('a POST to the path /shell/boot.js%00 under a face\'s host is answered, and the relay still answers', 0.2, function () { return door(177); }, test.limit.slow);

// the relay is still running at the end
test.run('the scratch relay is still running and answers', 0.2, async function () {
  if (!G.list) return false;
  const relay = G.relay;
  return (relay.child.exitCode === null && await G.plain()) || false;
}, test.limit.slow);

// ONE HEADER MUST NOT CRASH THE RELAY (goal/G41.30, the review, RH3: "any member with a face can crash a relay with one
// header"; its fix: "clamp the status to an integer from 100 to 599 (else 502), and wrap faceAnswer and faceFeed in
// try/catch"; Andy, Q3: "yes."). A member answers his own face's call, signed, with a bad x-spirit-status: the viewer
// gets 502 and the relay goes on. A dead relay is replaced, so each bad status is judged alone.
// /api/relay/face/answer: a bad status or type from a member never crashes the relay
const BA = { R: null, got: {} };
async function fresh() { if (BA.R) BA.R.stop(); BA.R = await scratchFaceRelay({ members: ['harbour'] }); return BA.R.up; }
// The viewer's call, waiting; the member's signed answer with these headers; what the viewer got.
async function answered(headers) {
  const R = BA.R;
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
}
// A dead relay is replaced, so each bad status is judged alone.
async function ready() { return !!BA.R && !!BA.R.up && (BA.R.child.exitCode === null || await fresh()); }
async function badStatus(status) {
  if (!BA.R || !BA.R.up) return false;
  if (!(await ready())) return false;
  BA.got[status] = await answered({ 'X-Spirit-Status': status, 'X-Spirit-Type': 'text/plain' });
  await sleep(100);
  return BA.R.child.exitCode === null || false;
}
function viewerGot(status) {
  const got = BA.got[status];
  if (!got) return false;
  return got.viewer === 502 || false;
}
test.run('a scratch relay comes up with one face, present and logged in', 0.2, async function () {
  // The garbage's relay is let go first.
  if (G.relay) { try { if (G.relay.child) G.relay.child.kill(); } catch (e) { /* gone */ } }
  return (await fresh()) || false;
}, test.limit.slow);
test.run('an answer with x-spirit-status 99 leaves the relay still running', 0.2, function () { return badStatus('99'); }, test.limit.slow);
test.run('an answer with x-spirit-status 99 gets the viewer a 502', 0.2, function () { return viewerGot('99'); }, test.limit.quick);
test.run('an answer with x-spirit-status 1000 leaves the relay still running', 0.2, function () { return badStatus('1000'); }, test.limit.slow);
test.run('an answer with x-spirit-status 1000 gets the viewer a 502', 0.2, function () { return viewerGot('1000'); }, test.limit.quick);
test.run('an answer with x-spirit-status abc leaves the relay still running', 0.2, function () { return badStatus('abc'); }, test.limit.slow);
test.run('an answer with x-spirit-status abc gets the viewer a 502', 0.2, function () { return viewerGot('abc'); }, test.limit.quick);
test.run('an answer with x-spirit-status -1 leaves the relay still running', 0.2, function () { return badStatus('-1'); }, test.limit.slow);
test.run('an answer with x-spirit-status -1 gets the viewer a 502', 0.2, function () { return viewerGot('-1'); }, test.limit.quick);
test.run('an answer with x-spirit-status 0 leaves the relay still running', 0.2, function () { return badStatus('0'); }, test.limit.slow);
test.run('an answer with x-spirit-status 0 gets the viewer a 502', 0.2, function () { return viewerGot('0'); }, test.limit.quick);
test.run('an answer with x-spirit-status 600 leaves the relay still running', 0.2, function () { return badStatus('600'); }, test.limit.slow);
test.run('an answer with x-spirit-status 600 gets the viewer a 502', 0.2, function () { return viewerGot('600'); }, test.limit.quick);
test.run('an answer with x-spirit-status 1.5 leaves the relay still running', 0.2, function () { return badStatus('1.5'); }, test.limit.slow);
test.run('an answer with x-spirit-status 1.5 gets the viewer a 502', 0.2, function () { return viewerGot('1.5'); }, test.limit.quick);
test.run('an answer with a bad x-spirit-type leaves the relay still running', 0.2, async function () {
  if (!BA.R || !BA.R.up) return false;
  if (!(await ready())) return false;
  await answered({ 'X-Spirit-Status': '200', 'X-Spirit-Type': 'text/\x7fbad' });
  await sleep(100);
  return BA.R.child.exitCode === null || false;
}, test.limit.slow);
test.run('a good status, 201, still reaches the viewer as it is', 0.2, async function () {
  if (!BA.R || !BA.R.up) return false;
  if (!(await ready())) return false;
  const good = await answered({ 'X-Spirit-Status': '201', 'X-Spirit-Type': 'text/plain' });
  return good.viewer === 201 || false;
}, test.limit.slow);

// ── THE ROUTE CACHING GOES ──
// goal/G47.1, the cycle "the route caching goes" (box v69; Andy: "the \"routes\" aren't read by anybody in the fucking
// system, node saves then, and passes routes to the relay?"): "A post carries no hints: the node sends none, the hint
// signature goes, and the relay takes a post with hints no more. A wire change: nodes and relays move together." A
// scratch relay of its own; a stranger's signed card ask to the relay itself, posted once as it is and once with hints and
// a hint signature beside it, as a node of before sent them.
// Each post on a relay of its own: a stranger's second post within its first minute is held by its address (429), which
// would read as a refusal of hints that is none.
const HN = { R: null, R2: null, plain: null, hinted: null };
const cardAsk = function (relay) {
  const A = relay.auth;
  const who = A.generateIdentity('hinter');
  const text = JSON.stringify({ v: 1, body: { card: true } });
  return { A: A, who: who, body: { from: who.publicKey, to: '', text: text, sig: A.sign(who.privateKey, A.postMessage(who.publicKey, '', text)) } };
};
test.run('two scratch relays come up, and a signed card ask is posted to one as it is and to the other with hints beside it', 0.2, async function () {
  HN.R = await scratchRelay({});
  HN.R2 = await scratchRelay({});
  if (!HN.R.up || !HN.R2.up) return false;
  HOST = new URL(HN.R.base).host;
  HN.plain = await post(HN.R.base, '/api/relay/post', cardAsk(HN.R).body);
  HOST = new URL(HN.R2.base).host;
  const c = cardAsk(HN.R2);
  const hints = ['MCowBQYDK2VwAyEAHINTHINTHINTHINTHINTHINTHINTHINTHINTHINTHINT='];
  const hintSig = typeof c.A.hintMessage === 'function' ? c.A.sign(c.who.privateKey, c.A.hintMessage(c.body.sig, hints)) : 'AAAA';
  HN.hinted = await post(HN.R2.base, '/api/relay/post', Object.assign({}, c.body, { hints: hints, hintSig: hintSig }));
  return (!!HN.plain && !!HN.hinted && !!HN.plain.status && !!HN.hinted.status) || false;
}, test.limit.slow);
test.run('a post with no hints is taken', 0.2, function () {
  if (!HN.plain) return false;
  return HN.plain.status === 200 || false;
}, test.limit.quick);
// Refused as a bad request (400): a hold of its address (429) or a busy relay (503) is no refusal of the hints.
test.run('a post with hints is taken no more: refused as a bad request', 0.2, function () {
  if (!HN.hinted) return false;
  return HN.hinted.status === 400 || false;
}, test.limit.quick);

test.after(function () {
  [HN.R, HN.R2].forEach(function (r) { if (r) { try { r.stop(); } catch (e) { /* gone */ } } });
  if (FP.R) { try { FP.R.stop(); } catch (e) { /* gone */ } }
  if (G.relay) {
    try { if (G.relay.child) G.relay.child.kill(); } catch (e) { /* gone */ }
    if (G.relay.root) try { require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(G.relay); } catch (e) { /* scratch */ }
  }
  if (BA.R) { try { BA.R.stop(); } catch (e) { /* gone */ } }
});
