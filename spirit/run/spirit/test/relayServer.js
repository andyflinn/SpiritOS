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
test.run('its face files are read from the run root, each by its file (FACE_DIR)', 0.2, function () {
  return (!!dir && path.relative(RUN, dir) === '') || 'FACE_DIR is ' + (dir ? path.relative(RUN, dir) : 'not found in the source');
}, 1000);

// the addresses it serves
// goal/G43.18, box v29: "The relay serves a logged-out face one plain page, the one-field form, with spirit.js and seal.js
// only": /spirit.js, face.html's one script tag, the seal, and the tab's icon. No boot.js, sheet or login app.
const WANT = ['/spirit.js', '/shell/seal.js', '/shell/favicon.svg'];
const keys = map ? Object.keys(map).sort() : [];
test.run('its map serves exactly /spirit.js, /shell/seal.js and /shell/favicon.svg', 0.2, function () {
  return (!!map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort())) || 'its map serves ' + JSON.stringify(keys);
}, 1000);
test.run('no address under /face/ serves a file any more', 0.2, function () {
  const old = keys.filter(function (k) { return k.indexOf('/face/') === 0; });
  return (!!map && !old.length) || 'old addresses still served: ' + JSON.stringify(old);
}, 1000);
test.run('every file the map names is there', 0.2, function () {
  const missing = map && dir ? keys.filter(function (k) { return !fs.existsSync(path.join(dir, map[k])); }) : keys;
  return (!!map && !!dir && !missing.length) || 'files not there: ' + JSON.stringify(missing.map(function (k) { return k + ' -> ' + (map ? map[k] : '?'); }));
}, 1000);
test.run('each address is served from its file, as the node serves it (serveCommon.pageFile)', 0.2, function () {
  const named = map ? keys.every(function (k) { return map[k] === common.pageFile(k); }) : false;
  return named || 'an address and its file differ: ' + JSON.stringify(map);
}, 1000);

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
test.run('asked with /?<token>, it serves face.html', 0.2, function () {
  if (route) {
    const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWx';
    served = route({ method: 'GET' }, '/', new URL('https://harbour.relay.example/?' + TOKEN), { faceLogin: function (n, t) { asked.logins.push([n, t]); return { loggedIn: true, session: 'S' }; } },
      function (res, sid) { asked.cookies.push(sid); }, function (res, st, file) { asked.sent.push(file); }, { name: 'harbour' }, {}, common);
  }
  return (!!route && served === true && asked.sent[0] === common.pageFile('face.html')) || (route ? 'served ' + served + ', sent ' + JSON.stringify(asked.sent) : 'the face page\'s route was not found in the source');
}, 1000);
// A token in an address that logs in is a login by a link: 0.8.
test.run('and logs nobody in: no faceLogin asked, no login cookie set', 0.8, function () {
  return (!!route && asked.logins.length === 0 && asked.cookies.length === 0) || 'faceLogin asked ' + JSON.stringify(asked.logins) + ', cookies ' + JSON.stringify(asked.cookies);
}, 1000);
test.run('the relay serves face.html byte for byte as it is on disk', 0.2, async function () {
  const got = await sent(common.pageFile('face.html'));
  return (!!got && got.equals(fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'face.html')))) || 'the relay serves face.html changed, or its faceSend was not found';
}, 1000);
test.run('the relay serves /spirit.js, from spirit/spirit.js, byte for byte', 0.2, async function () {
  const got = await sent(map && map['/spirit.js'] || common.pageFile('spirit.js'));
  return (!!got && got.equals(fs.readFileSync(path.join(RUN, 'spirit', 'spirit.js')))) || 'the relay does not serve spirit/spirit.js as it is';
}, 1000);

// A PAGE ON ANOTHER MEMBER'S FACE CANNOT DRIVE A LOGGED-IN OWNER'S NODE (goal/G41.30, the review, RC2: "a page on any
// member's face can make a logged-in owner's face run verbs on his node, because all faces are same-site and /face/call
// has no Origin check"; its fix: "on every /face/* POST, require Origin equal to the face's own host, require the
// session's name to match faceAt(host).name, and require Content-Type: application/json"; Andy, Q3: "yes."). On a
// scratch relay with two members, each with a face, present and logged in. A refusal is a 4xx and no face event on any
// member's stream; the face's own page still reaches its node.
// POST /face/call and /face/api: only the face's own page
// A page of another face let in is an unauthorized caller driving the owner's node: each refusal 0.8.
const FP = { R: null };
const NO_FACES = 'no scratch relay with faces: the world failed';
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
async function faceRefused(name, o) {
  if (!FP.R || !FP.R.up) return NO_FACES;
  const from = FP.R.lines.length;
  const r = await facePost('/face/call', o);
  await sleep(100);
  const ev = faceEvents(from);
  return (r.status >= 400 && r.status < 500 && !ev.length) || '/face/call ' + name + ': answered ' + (r.status || 'nothing yet') + ', ' + ev.length + ' face event(s) sent to ' + short(ev.map(function (l) { return l.stream; }));
}
test.run('a scratch relay with two faces, present and logged in', 0.2, async function () {
  FP.R = await scratchFaceRelay();
  return (FP.R.up && !!FP.R.members.harbour && !!FP.R.members.quay) || 'the scratch relay with faces did not come up: nothing judged';
}, 3000);
test.run('/face/call refused, a 4xx and no face event: an Origin of another face', 0.8, function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  return faceRefused('an Origin of another face', { origin: 'https://' + FP.R.members.quay.host, type: JSONT });
}, 2000);
test.run('/face/call refused, a 4xx and no face event: no Origin', 0.8, function () { return faceRefused('no Origin', { type: JSONT }); }, 2000);
test.run('/face/call refused, a 4xx and no face event: text/plain, a form a page sends with no preflight', 0.8, function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  return faceRefused('text/plain, a form a page sends with no preflight', { origin: own(), type: 'text/plain' });
}, 2000);
test.run('/face/call refused, a 4xx and no face event: another member\'s session at this face\'s host', 0.8, function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  return faceRefused('another member\'s session at this face\'s host', { origin: own(), type: JSONT, sid: FP.R.members.quay.sid });
}, 2000);
test.run('the face\'s own page, its Origin and json, still reaches its node', 0.2, async function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  const from = FP.R.lines.length;
  await facePost('/face/call', { origin: own(), type: JSONT, body: '{"call":"node.card","args":{}}' });
  const ev = faceEvents(from);
  return (ev.length === 1 && ev[0].stream === 'harbour') || 'its own page: ' + ev.length + ' face event(s), to ' + short(ev.map(function (l) { return l.stream; }));
}, 4000);
test.run('/face/api refused, a 4xx: an Origin of another face', 0.8, async function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  const api = await facePost('/face/api', { origin: 'https://' + FP.R.members.quay.host, type: JSONT, body: '{"verb":"state"}' });
  return (api.status >= 400 && api.status < 500) || '/face/api with an Origin of another face answered ' + api.status;
}, 2000);
test.run('the face\'s own page still reaches /face/api', 0.2, async function () {
  if (!FP.R || !FP.R.up) return NO_FACES;
  const apiOwn = await facePost('/face/api', { origin: own(), type: JSONT, body: '{"verb":"state"}' });
  return apiOwn.status === 200 || '/face/api from its own page answered ' + apiOwn.status;
}, 2000);

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

function shortG(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

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
  if (r.status >= 500 && !(r.status === 503 && /retryAfterMs/.test(r.text))) return 'it answered ' + r.status + ': ' + shortG(r.text);
  if (/handler-failed|the handler failed/.test(r.text)) return 'the handler failed: ' + shortG(r.text);
  return '';
}

// garbage: the attacker's garbage at the relay's door (goal/G41.30)
const G = { relay: null, base: '', plain: null, list: null, verbs: {}, RAWS: [], ASKS: [], killer: '', hungAfter: [], thrown: false };
const NO_RELAY = 'no scratch relay for the garbage: the world failed';
function signed(id, text) {
  const A = G.relay.auth;
  const m = A.postMessage(id.publicKey, '', text);
  return { from: id.publicKey, to: '', text: text, sig: A.sign(id.privateKey, m) };
}
test.run('the world: a scratch relay comes up and hands its garbage list', 0.2, async function () {
  // The relay with faces is let go first.
  if (FP.R) { FP.R.stop(); FP.R = null; }
  const relay = G.relay = await scratchRelay({ debug: true, faceDomain: FACE_DOMAIN });
  if (!relay.up) return 'the scratch relay did not come up: every check here would blame the wrong thing';
  const base = G.base = relay.base;
  HOST = new URL(base).host;
  const FACE_HOST = 'harbour.' + FACE_DOMAIN;
  const A = relay.auth;
  G.plain = async function () { const r = await raw(base, getHead('/'), '', { ms: PLAIN_MS }); return !!(r && r.status); };

  // 1) INTROSPECT: the relay's own api, as its garbage list (its DEBUG route: spirit/DEBUG/garbageArguments.js over the
  // relay's api tree), each entry the ask's body { body: { <verb>: args } }.
  let list = null;
  try { list = await fetch(base + '/DEBUG/spirit/relay/garbageArguments.json').then(function (r) { return r.json(); }); } catch (e) { list = null; }
  if (!Array.isArray(list) || !list.length) return '/spirit/relay/garbageArguments.json: the relay gave no garbage list: nothing to introspect';
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
    RAWS.push({ why: 'GET ' + shortG(p).slice(0, 60) + ' (face host)', run: function () { return raw(base, getHead(p, FACE_HOST), ''); } });
  });
  // The members' stream, with garbage in its signature and key.
  ['/api/relay/stream', '/api/relay/stream?sig=garbage&key=%00', '/api/relay/stream?sig=' + 'a'.repeat(9000), '/api/relay/stream?key=__proto__'].forEach(function (p) {
    RAWS.push({ why: 'GET ' + shortG(p).slice(0, 60), run: function () { return raw(base, getHead(p, null, 'X-Spirit-Sig: garbage\r\n'), '', { keepOpen: true }); }, waits: true });
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
      RAWS.push({ why: 'GET ' + shortG(p).slice(0, 60) + (h === FACE_HOST ? ' (face host)' : ''), run: function () { return raw(base, getHead(p, h), ''); } });
      RAWS.push({ why: 'POST ' + shortG(p).slice(0, 60) + (h === FACE_HOST ? ' (face host)' : ''), run: function () { return raw(base, postHead(p, 2, undefined, h), '{}'); } });
    });
  });
  // Each verb's garbage, signed by the relay's owner, so it passes the door and reaches the verb (the deepest a caller
  // gets); and by a stranger, as anybody may send it.
  list.forEach(function (e) { G.ASKS.push({ who: 'owner', id: relay.owner, e: e }); });
  list.forEach(function (e) { G.ASKS.push({ who: 'stranger', id: stranger, e: e }); });
  test.comment('it will make ' + G.ASKS.length + ' signed asks of bad arguments over ' + Object.keys(verbs).length + ' relay verbs (' + Object.keys(verbs).join(', ') + '), ' +
    list.length + ' as the owner and ' + list.length + ' as a stranger, each batch of ' + BATCH + ' followed by a plain request; and ' + RAWS.length + ' raw requests');
  return true;
}, 3000);

// THE VERBS, BATCH BY BATCH.
// /api/relay/post: every relay verb takes bad arguments without crashing or hanging
test.run('/api/relay/post: the relay verbs took all their garbage without crashing or hanging', 0.2, async function () {
  if (!G.list) return NO_RELAY;
  const relay = G.relay; const base = G.base; const ASKS = G.ASKS;
  const broken = {}; const statuses = {};
  for (let i = 0; i < ASKS.length && !G.killer; i += BATCH) {
    const batch = ASKS.slice(i, i + BATCH);
    const got = await Promise.all(batch.map(function (a) { return post(base, '/api/relay/post', signed(a.id, JSON.stringify(Object.assign({ v: 1 }, a.e)))); }));
    got.forEach(function (r, j) {
      const a = batch[j];
      const name = Object.keys(a.e.body || {})[0] || '?';
      statuses[r.status || 0] = (statuses[r.status || 0] || 0) + 1;
      const why = broke(r);
      if (why) (broken[name] = broken[name] || []).push(a.who + ', ' + shortG(a.e.body[name]).slice(0, 60) + ': ' + why);
    });
    if (relay.child.exitCode !== null) { G.killer = 'the batch from ask ' + i + ' (' + shortG(batch.map(function (a) { return Object.keys(a.e.body || {})[0]; })) + ')'; break; }
    if (!(await G.plain())) G.hungAfter.push(i);
  }
  G.thrown = true;
  test.comment('by status: ' + JSON.stringify(statuses));
  // Each verb that broke named in the answer: the verbs are what the relay's garbage list names, so no title can be
  // written out per verb.
  const bad = Object.keys(G.verbs).filter(function (v) { return broken[v]; }).map(function (v) { return '/api/relay/post ' + v + ': ' + broken[v].length + ' crashed or hung, first: ' + broken[v][0]; });
  if (G.killer) bad.push('/api/relay/post: THE RELAY DIED (exit ' + relay.child.exitCode + ') at ' + G.killer);
  return !bad.length || bad.join('; ');
}, 6000);
test.run('/api/relay/post: after every batch the relay answered a plain request in time', 0.2, function () {
  if (!G.thrown) return 'no garbage thrown: the world failed';
  if (G.killer) return '/api/relay/post: THE RELAY DIED (exit ' + G.relay.child.exitCode + ') at ' + G.killer;
  return !G.hungAfter.length || '/api/relay/post: after ' + G.hungAfter.length + ' batches the relay did not answer a plain request within ' + (PLAIN_MS / 1000) + ' s';
}, 1000);

// THE RAW REQUESTS, ONE BY ONE.
// the relay's door: raw requests and malformed paths
// Each request written out, in the order thrown, so that each check has a plain title of its own. A request is thrown by
// its own test; once one killed the relay, the ones after it are not thrown, and say so.
async function door(ri) {
  if (!G.list) return NO_RELAY;
  const r0 = G.RAWS[ri];
  const relay = G.relay;
  if (G.killer) return 'the relay\'s door, ' + r0.why + ': not thrown, the relay died at ' + G.killer;
  const r = await r0.run();
  // A body cut off, or a held stream, may be held by the relay until its own time runs out: it must still answer
  // everybody else.
  let why = r0.waits && r.hung ? '' : broke(r);
  let alive = await G.plain();
  if (!alive) { await sleep(500); alive = await G.plain(); }
  if (!alive) why = (why ? why + '; ' : '') + 'the relay then did not answer a plain request within ' + (PLAIN_MS / 1000) + ' s';
  if (relay.child.exitCode !== null && !G.killer) { G.killer = r0.why; why = 'IT KILLED THE RELAY (exit ' + relay.child.exitCode + ')'; }
  return !why || 'the relay\'s door, ' + r0.why + ': ' + why;
}
test.run('POST /api/relay/post, not JSON: answered, and the relay still answers', 0.2, function () { return door(0); }, 17000);
test.run('POST /api/relay/post, JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(1); }, 17000);
test.run('POST /api/relay/post, a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(2); }, 17000);
test.run('POST /api/relay/post, JSON null: answered, and the relay still answers', 0.2, function () { return door(3); }, 17000);
test.run('POST /api/relay/post, deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(4); }, 17000);
test.run('POST /api/relay/post, a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(5); }, 17000);
test.run('POST /api/relay/post, a constructor key: answered, and the relay still answers', 0.2, function () { return door(6); }, 17000);
test.run('POST /api/relay/post, invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(7); }, 17000);
test.run('POST /api/relay/post, from as a number: answered, and the relay still answers', 0.2, function () { return door(8); }, 17000);
test.run('POST /api/relay/post, sig missing: answered, and the relay still answers', 0.2, function () { return door(9); }, 17000);
test.run('POST /api/relay/post, a forged sig: answered, and the relay still answers', 0.2, function () { return door(10); }, 17000);
test.run('POST /api/relay/post, text not JSON, signed: answered, and the relay still answers', 0.2, function () { return door(11); }, 17000);
test.run('POST /api/relay/post, text a JSON array, signed: answered, and the relay still answers', 0.2, function () { return door(12); }, 17000);
test.run('POST /api/relay/post, text a huge string, signed: answered, and the relay still answers', 0.2, function () { return door(13); }, 17000);
test.run('POST /api/relay/post, text with a NUL, signed: answered, and the relay still answers', 0.2, function () { return door(14); }, 17000);
test.run('POST /api/relay/post, no Content-Type: answered, and the relay still answers', 0.2, function () { return door(15); }, 17000);
test.run('POST /api/relay/post, Content-Type text/plain: answered, and the relay still answers', 0.2, function () { return door(16); }, 17000);
test.run('POST /api/relay/post, a body cut off half-way: answered, and the relay still answers', 0.2, function () { return door(17); }, 31000);
test.run('POST /api/relay/post, one byte past BODY_MAX: answered, and the relay still answers', 0.2, function () { return door(18); }, 17000);
test.run('POST /api/relay/post, a Content-Length far past what is sent: answered, and the relay still answers', 0.2, function () { return door(19); }, 31000);
test.run('POST /api/relay/reply, not JSON: answered, and the relay still answers', 0.2, function () { return door(20); }, 17000);
test.run('POST /api/relay/reply, JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(21); }, 17000);
test.run('POST /api/relay/reply, a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(22); }, 17000);
test.run('POST /api/relay/reply, JSON null: answered, and the relay still answers', 0.2, function () { return door(23); }, 17000);
test.run('POST /api/relay/reply, deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(24); }, 17000);
test.run('POST /api/relay/reply, a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(25); }, 17000);
test.run('POST /api/relay/reply, a constructor key: answered, and the relay still answers', 0.2, function () { return door(26); }, 17000);
test.run('POST /api/relay/reply, invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(27); }, 17000);
test.run('POST /api/relay/reply, from as a number: answered, and the relay still answers', 0.2, function () { return door(28); }, 17000);
test.run('POST /api/relay/reply, sig missing: answered, and the relay still answers', 0.2, function () { return door(29); }, 17000);
test.run('POST /api/relay/reply, a forged sig: answered, and the relay still answers', 0.2, function () { return door(30); }, 17000);
test.run('POST /api/relay/reply, text not JSON, signed: answered, and the relay still answers', 0.2, function () { return door(31); }, 17000);
test.run('POST /api/relay/reply, text a JSON array, signed: answered, and the relay still answers', 0.2, function () { return door(32); }, 17000);
test.run('POST /api/relay/reply, text a huge string, signed: answered, and the relay still answers', 0.2, function () { return door(33); }, 17000);
test.run('POST /api/relay/reply, text with a NUL, signed: answered, and the relay still answers', 0.2, function () { return door(34); }, 17000);
test.run('POST /api/relay/reply, no Content-Type: answered, and the relay still answers', 0.2, function () { return door(35); }, 17000);
test.run('POST /api/relay/reply, Content-Type text/plain: answered, and the relay still answers', 0.2, function () { return door(36); }, 17000);
test.run('POST /api/relay/reply, a body cut off half-way: answered, and the relay still answers', 0.2, function () { return door(37); }, 31000);
test.run('POST /api/relay/reply, one byte past BODY_MAX: answered, and the relay still answers', 0.2, function () { return door(38); }, 17000);
test.run('POST /api/relay/reply, a Content-Length far past what is sent: answered, and the relay still answers', 0.2, function () { return door(39); }, 31000);
test.run('POST /api/relay/face/answer, not JSON: answered, and the relay still answers', 0.2, function () { return door(40); }, 17000);
test.run('POST /api/relay/face/answer, JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(41); }, 17000);
test.run('POST /api/relay/face/answer, a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(42); }, 17000);
test.run('POST /api/relay/face/answer, JSON null: answered, and the relay still answers', 0.2, function () { return door(43); }, 17000);
test.run('POST /api/relay/face/answer, deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(44); }, 17000);
test.run('POST /api/relay/face/answer, a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(45); }, 17000);
test.run('POST /api/relay/face/answer, a constructor key: answered, and the relay still answers', 0.2, function () { return door(46); }, 17000);
test.run('POST /api/relay/face/answer, invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(47); }, 17000);
test.run('POST /api/relay/face/answer, from as a number: answered, and the relay still answers', 0.2, function () { return door(48); }, 17000);
test.run('POST /api/relay/face/answer, sig missing: answered, and the relay still answers', 0.2, function () { return door(49); }, 17000);
test.run('POST /api/relay/face/answer, a forged sig: answered, and the relay still answers', 0.2, function () { return door(50); }, 17000);
test.run('POST /api/relay/face/answer, text not JSON, signed: answered, and the relay still answers', 0.2, function () { return door(51); }, 17000);
test.run('POST /api/relay/face/answer, text a JSON array, signed: answered, and the relay still answers', 0.2, function () { return door(52); }, 17000);
test.run('POST /api/relay/face/answer, text a huge string, signed: answered, and the relay still answers', 0.2, function () { return door(53); }, 17000);
test.run('POST /api/relay/face/answer, text with a NUL, signed: answered, and the relay still answers', 0.2, function () { return door(54); }, 17000);
test.run('POST /api/relay/face/answer, no Content-Type: answered, and the relay still answers', 0.2, function () { return door(55); }, 17000);
test.run('POST /api/relay/face/answer, Content-Type text/plain: answered, and the relay still answers', 0.2, function () { return door(56); }, 17000);
test.run('POST /api/relay/face/answer, a body cut off half-way: answered, and the relay still answers', 0.2, function () { return door(57); }, 31000);
test.run('POST /api/relay/face/answer, one byte past BODY_MAX: answered, and the relay still answers', 0.2, function () { return door(58); }, 17000);
test.run('POST /api/relay/face/answer, a Content-Length far past what is sent: answered, and the relay still answers', 0.2, function () { return door(59); }, 31000);
test.run('POST /api/relay/face/stream, not JSON: answered, and the relay still answers', 0.2, function () { return door(60); }, 17000);
test.run('POST /api/relay/face/stream, JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(61); }, 17000);
test.run('POST /api/relay/face/stream, a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(62); }, 17000);
test.run('POST /api/relay/face/stream, JSON null: answered, and the relay still answers', 0.2, function () { return door(63); }, 17000);
test.run('POST /api/relay/face/stream, deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(64); }, 17000);
test.run('POST /api/relay/face/stream, a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(65); }, 17000);
test.run('POST /api/relay/face/stream, a constructor key: answered, and the relay still answers', 0.2, function () { return door(66); }, 17000);
test.run('POST /api/relay/face/stream, invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(67); }, 17000);
test.run('POST /api/relay/face/stream, from as a number: answered, and the relay still answers', 0.2, function () { return door(68); }, 17000);
test.run('POST /api/relay/face/stream, sig missing: answered, and the relay still answers', 0.2, function () { return door(69); }, 17000);
test.run('POST /api/relay/face/stream, a forged sig: answered, and the relay still answers', 0.2, function () { return door(70); }, 17000);
test.run('POST /api/relay/face/stream, text not JSON, signed: answered, and the relay still answers', 0.2, function () { return door(71); }, 17000);
test.run('POST /api/relay/face/stream, text a JSON array, signed: answered, and the relay still answers', 0.2, function () { return door(72); }, 17000);
test.run('POST /api/relay/face/stream, text a huge string, signed: answered, and the relay still answers', 0.2, function () { return door(73); }, 17000);
test.run('POST /api/relay/face/stream, text with a NUL, signed: answered, and the relay still answers', 0.2, function () { return door(74); }, 17000);
test.run('POST /api/relay/face/stream, no Content-Type: answered, and the relay still answers', 0.2, function () { return door(75); }, 17000);
test.run('POST /api/relay/face/stream, Content-Type text/plain: answered, and the relay still answers', 0.2, function () { return door(76); }, 17000);
test.run('POST /api/relay/face/stream, a body cut off half-way: answered, and the relay still answers', 0.2, function () { return door(77); }, 31000);
test.run('POST /api/relay/face/stream, one byte past BODY_MAX: answered, and the relay still answers', 0.2, function () { return door(78); }, 17000);
test.run('POST /api/relay/face/stream, a Content-Length far past what is sent: answered, and the relay still answers', 0.2, function () { return door(79); }, 31000);
test.run('POST /face/api (face host), not JSON: answered, and the relay still answers', 0.2, function () { return door(80); }, 17000);
test.run('POST /face/api (face host), JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(81); }, 17000);
test.run('POST /face/api (face host), a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(82); }, 17000);
test.run('POST /face/api (face host), JSON null: answered, and the relay still answers', 0.2, function () { return door(83); }, 17000);
test.run('POST /face/api (face host), deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(84); }, 17000);
test.run('POST /face/api (face host), a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(85); }, 17000);
test.run('POST /face/api (face host), a constructor key: answered, and the relay still answers', 0.2, function () { return door(86); }, 17000);
test.run('POST /face/api (face host), invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(87); }, 17000);
test.run('POST /face/call (face host), not JSON: answered, and the relay still answers', 0.2, function () { return door(88); }, 17000);
test.run('POST /face/call (face host), JSON that is not an object: answered, and the relay still answers', 0.2, function () { return door(89); }, 17000);
test.run('POST /face/call (face host), a bare JSON string: answered, and the relay still answers', 0.2, function () { return door(90); }, 17000);
test.run('POST /face/call (face host), JSON null: answered, and the relay still answers', 0.2, function () { return door(91); }, 17000);
test.run('POST /face/call (face host), deep nesting, 5000 levels: answered, and the relay still answers', 0.2, function () { return door(92); }, 17000);
test.run('POST /face/call (face host), a __proto__ key: answered, and the relay still answers', 0.2, function () { return door(93); }, 17000);
test.run('POST /face/call (face host), a constructor key: answered, and the relay still answers', 0.2, function () { return door(94); }, 17000);
test.run('POST /face/call (face host), invalid UTF-8 bytes: answered, and the relay still answers', 0.2, function () { return door(95); }, 17000);
test.run('GET /face/allowed?domain=%00 (face host): answered, and the relay still answers', 0.2, function () { return door(96); }, 17000);
test.run('GET /face/allowed?domain=<9000 a\'s> (face host): answered, and the relay still answers', 0.2, function () { return door(97); }, 17000);
test.run('GET /face/file?path=..%2f..%2frelay-state (face host): answered, and the relay still answers', 0.2, function () { return door(98); }, 17000);
test.run('GET /face/stream (face host): answered, and the relay still answers', 0.2, function () { return door(99); }, 17000);
test.run('GET /api/relay/stream: answered, and the relay still answers', 0.2, function () { return door(100); }, 17000);
test.run('GET /api/relay/stream?sig=garbage&key=%00: answered, and the relay still answers', 0.2, function () { return door(101); }, 17000);
test.run('GET /api/relay/stream?sig=<9000 a\'s>: answered, and the relay still answers', 0.2, function () { return door(102); }, 17000);
test.run('GET /api/relay/stream?key=__proto__: answered, and the relay still answers', 0.2, function () { return door(103); }, 17000);
test.run('a request line that is not HTTP: answered, and the relay still answers', 0.2, function () { return door(104); }, 17000);
test.run('a header line with no colon: answered, and the relay still answers', 0.2, function () { return door(105); }, 17000);
test.run('GET /..: answered, and the relay still answers', 0.2, function () { return door(106); }, 17000);
test.run('POST /..: answered, and the relay still answers', 0.2, function () { return door(107); }, 17000);
test.run('GET /../../../../etc/passwd: answered, and the relay still answers', 0.2, function () { return door(108); }, 17000);
test.run('POST /../../../../etc/passwd: answered, and the relay still answers', 0.2, function () { return door(109); }, 17000);
test.run('GET /%2e%2e/%2e%2e/etc/passwd: answered, and the relay still answers', 0.2, function () { return door(110); }, 17000);
test.run('POST /%2e%2e/%2e%2e/etc/passwd: answered, and the relay still answers', 0.2, function () { return door(111); }, 17000);
test.run('GET /shell/%2f%2f..%2f..%2fetc: answered, and the relay still answers', 0.2, function () { return door(112); }, 17000);
test.run('POST /shell/%2f%2f..%2f..%2fetc: answered, and the relay still answers', 0.2, function () { return door(113); }, 17000);
test.run('GET /<9000 a\'s>: answered, and the relay still answers', 0.2, function () { return door(114); }, 17000);
test.run('POST /<9000 a\'s>: answered, and the relay still answers', 0.2, function () { return door(115); }, 17000);
test.run('GET /%: answered, and the relay still answers', 0.2, function () { return door(116); }, 17000);
test.run('POST /%: answered, and the relay still answers', 0.2, function () { return door(117); }, 17000);
test.run('GET /%zz: answered, and the relay still answers', 0.2, function () { return door(118); }, 17000);
test.run('POST /%zz: answered, and the relay still answers', 0.2, function () { return door(119); }, 17000);
test.run('GET /%E0%A4%A: answered, and the relay still answers', 0.2, function () { return door(120); }, 17000);
test.run('POST /%E0%A4%A: answered, and the relay still answers', 0.2, function () { return door(121); }, 17000);
test.run('GET /api/%2e%2e/relay/post: answered, and the relay still answers', 0.2, function () { return door(122); }, 17000);
test.run('POST /api/%2e%2e/relay/post: answered, and the relay still answers', 0.2, function () { return door(123); }, 17000);
test.run('GET //api//relay//post: answered, and the relay still answers', 0.2, function () { return door(124); }, 17000);
test.run('POST //api//relay//post: answered, and the relay still answers', 0.2, function () { return door(125); }, 17000);
test.run('GET /DEBUG/../../spirit/state/identity.json: answered, and the relay still answers', 0.2, function () { return door(126); }, 17000);
test.run('POST /DEBUG/../../spirit/state/identity.json: answered, and the relay still answers', 0.2, function () { return door(127); }, 17000);
test.run('GET /shell/../../spirit/state/relay.db: answered, and the relay still answers', 0.2, function () { return door(128); }, 17000);
test.run('POST /shell/../../spirit/state/relay.db: answered, and the relay still answers', 0.2, function () { return door(129); }, 17000);
test.run('GET /\\..\\..\\relay-state: answered, and the relay still answers', 0.2, function () { return door(130); }, 17000);
test.run('POST /\\..\\..\\relay-state: answered, and the relay still answers', 0.2, function () { return door(131); }, 17000);
test.run('GET /?%: answered, and the relay still answers', 0.2, function () { return door(132); }, 17000);
test.run('POST /?%: answered, and the relay still answers', 0.2, function () { return door(133); }, 17000);
test.run('GET *: answered, and the relay still answers', 0.2, function () { return door(134); }, 17000);
test.run('POST *: answered, and the relay still answers', 0.2, function () { return door(135); }, 17000);
test.run('GET /%00: answered, and the relay still answers', 0.2, function () { return door(136); }, 17000);
test.run('POST /%00: answered, and the relay still answers', 0.2, function () { return door(137); }, 17000);
test.run('GET /face.html%00.js: answered, and the relay still answers', 0.2, function () { return door(138); }, 17000);
test.run('POST /face.html%00.js: answered, and the relay still answers', 0.2, function () { return door(139); }, 17000);
test.run('GET /shell/boot.js%00: answered, and the relay still answers', 0.2, function () { return door(140); }, 17000);
test.run('POST /shell/boot.js%00: answered, and the relay still answers', 0.2, function () { return door(141); }, 17000);
test.run('GET /.. (face host): answered, and the relay still answers', 0.2, function () { return door(142); }, 17000);
test.run('POST /.. (face host): answered, and the relay still answers', 0.2, function () { return door(143); }, 17000);
test.run('GET /../../../../etc/passwd (face host): answered, and the relay still answers', 0.2, function () { return door(144); }, 17000);
test.run('POST /../../../../etc/passwd (face host): answered, and the relay still answers', 0.2, function () { return door(145); }, 17000);
test.run('GET /%2e%2e/%2e%2e/etc/passwd (face host): answered, and the relay still answers', 0.2, function () { return door(146); }, 17000);
test.run('POST /%2e%2e/%2e%2e/etc/passwd (face host): answered, and the relay still answers', 0.2, function () { return door(147); }, 17000);
test.run('GET /shell/%2f%2f..%2f..%2fetc (face host): answered, and the relay still answers', 0.2, function () { return door(148); }, 17000);
test.run('POST /shell/%2f%2f..%2f..%2fetc (face host): answered, and the relay still answers', 0.2, function () { return door(149); }, 17000);
test.run('GET /<9000 a\'s> (face host): answered, and the relay still answers', 0.2, function () { return door(150); }, 17000);
test.run('POST /<9000 a\'s> (face host): answered, and the relay still answers', 0.2, function () { return door(151); }, 17000);
test.run('GET /% (face host): answered, and the relay still answers', 0.2, function () { return door(152); }, 17000);
test.run('POST /% (face host): answered, and the relay still answers', 0.2, function () { return door(153); }, 17000);
test.run('GET /%zz (face host): answered, and the relay still answers', 0.2, function () { return door(154); }, 17000);
test.run('POST /%zz (face host): answered, and the relay still answers', 0.2, function () { return door(155); }, 17000);
test.run('GET /%E0%A4%A (face host): answered, and the relay still answers', 0.2, function () { return door(156); }, 17000);
test.run('POST /%E0%A4%A (face host): answered, and the relay still answers', 0.2, function () { return door(157); }, 17000);
test.run('GET /api/%2e%2e/relay/post (face host): answered, and the relay still answers', 0.2, function () { return door(158); }, 17000);
test.run('POST /api/%2e%2e/relay/post (face host): answered, and the relay still answers', 0.2, function () { return door(159); }, 17000);
test.run('GET //api//relay//post (face host): answered, and the relay still answers', 0.2, function () { return door(160); }, 17000);
test.run('POST //api//relay//post (face host): answered, and the relay still answers', 0.2, function () { return door(161); }, 17000);
test.run('GET /DEBUG/../../spirit/state/identity.json (face host): answered, and the relay still answers', 0.2, function () { return door(162); }, 17000);
test.run('POST /DEBUG/../../spirit/state/identity.json (face host): answered, and the relay still answers', 0.2, function () { return door(163); }, 17000);
test.run('GET /shell/../../spirit/state/relay.db (face host): answered, and the relay still answers', 0.2, function () { return door(164); }, 17000);
test.run('POST /shell/../../spirit/state/relay.db (face host): answered, and the relay still answers', 0.2, function () { return door(165); }, 17000);
test.run('GET /\\..\\..\\relay-state (face host): answered, and the relay still answers', 0.2, function () { return door(166); }, 17000);
test.run('POST /\\..\\..\\relay-state (face host): answered, and the relay still answers', 0.2, function () { return door(167); }, 17000);
test.run('GET /?% (face host): answered, and the relay still answers', 0.2, function () { return door(168); }, 17000);
test.run('POST /?% (face host): answered, and the relay still answers', 0.2, function () { return door(169); }, 17000);
test.run('GET * (face host): answered, and the relay still answers', 0.2, function () { return door(170); }, 17000);
test.run('POST * (face host): answered, and the relay still answers', 0.2, function () { return door(171); }, 17000);
test.run('GET /%00 (face host): answered, and the relay still answers', 0.2, function () { return door(172); }, 17000);
test.run('POST /%00 (face host): answered, and the relay still answers', 0.2, function () { return door(173); }, 17000);
test.run('GET /face.html%00.js (face host): answered, and the relay still answers', 0.2, function () { return door(174); }, 17000);
test.run('POST /face.html%00.js (face host): answered, and the relay still answers', 0.2, function () { return door(175); }, 17000);
test.run('GET /shell/boot.js%00 (face host): answered, and the relay still answers', 0.2, function () { return door(176); }, 17000);
test.run('POST /shell/boot.js%00 (face host): answered, and the relay still answers', 0.2, function () { return door(177); }, 17000);

// the relay is still running at the end
test.run('the scratch relay is still running and answers', 0.2, async function () {
  if (!G.list) return NO_RELAY;
  const relay = G.relay;
  return (relay.child.exitCode === null && await G.plain()) || 'the scratch relay ' + (relay.child.exitCode !== null ? 'exited with ' + relay.child.exitCode : 'does not answer');
}, 4000);

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
const NO_FACE = 'no scratch relay with a face: the world failed';
// A dead relay is replaced, so each bad status is judged alone.
async function ready() { return !!BA.R && !!BA.R.up && (BA.R.child.exitCode === null || await fresh()); }
async function badStatus(status) {
  if (!BA.R || !BA.R.up) return NO_FACE;
  if (!(await ready())) return 'a fresh scratch relay did not come up';
  BA.got[status] = await answered({ 'X-Spirit-Status': status, 'X-Spirit-Type': 'text/plain' });
  await sleep(100);
  return BA.R.child.exitCode === null || 'x-spirit-status ' + status + ': IT KILLED THE RELAY (exit ' + BA.R.child.exitCode + ')';
}
function viewerGot(status) {
  const got = BA.got[status];
  if (!got) return 'x-spirit-status ' + status + ': not answered: the world failed';
  return got.viewer === 502 || 'x-spirit-status ' + status + ': the viewer got ' + (got.viewer || 'nothing') + (got.noCall ? ' (no call reached the member)' : '');
}
test.run('a scratch relay with a face, present and logged in', 0.2, async function () {
  // The garbage's relay is let go first.
  if (G.relay) { try { if (G.relay.child) G.relay.child.kill(); } catch (e) { /* gone */ } }
  return (await fresh()) || 'the scratch relay with a face did not come up: nothing judged';
}, 3000);
test.run('x-spirit-status 99: the relay is still running', 0.2, function () { return badStatus('99'); }, 7000);
test.run('x-spirit-status 99: the viewer gets 502', 0.2, function () { return viewerGot('99'); }, 1000);
test.run('x-spirit-status 1000: the relay is still running', 0.2, function () { return badStatus('1000'); }, 7000);
test.run('x-spirit-status 1000: the viewer gets 502', 0.2, function () { return viewerGot('1000'); }, 1000);
test.run('x-spirit-status abc: the relay is still running', 0.2, function () { return badStatus('abc'); }, 7000);
test.run('x-spirit-status abc: the viewer gets 502', 0.2, function () { return viewerGot('abc'); }, 1000);
test.run('x-spirit-status -1: the relay is still running', 0.2, function () { return badStatus('-1'); }, 7000);
test.run('x-spirit-status -1: the viewer gets 502', 0.2, function () { return viewerGot('-1'); }, 1000);
test.run('x-spirit-status 0: the relay is still running', 0.2, function () { return badStatus('0'); }, 7000);
test.run('x-spirit-status 0: the viewer gets 502', 0.2, function () { return viewerGot('0'); }, 1000);
test.run('x-spirit-status 600: the relay is still running', 0.2, function () { return badStatus('600'); }, 7000);
test.run('x-spirit-status 600: the viewer gets 502', 0.2, function () { return viewerGot('600'); }, 1000);
test.run('x-spirit-status 1.5: the relay is still running', 0.2, function () { return badStatus('1.5'); }, 7000);
test.run('x-spirit-status 1.5: the viewer gets 502', 0.2, function () { return viewerGot('1.5'); }, 1000);
test.run('a bad x-spirit-type: the relay is still running', 0.2, async function () {
  if (!BA.R || !BA.R.up) return NO_FACE;
  if (!(await ready())) return 'a fresh scratch relay did not come up';
  const type = await answered({ 'X-Spirit-Status': '200', 'X-Spirit-Type': 'text/\x7fbad' });
  await sleep(100);
  return BA.R.child.exitCode === null || 'a bad x-spirit-type: IT KILLED THE RELAY (exit ' + BA.R.child.exitCode + '), the viewer got ' + type.viewer;
}, 10000);
test.run('a good status still reaches the viewer as it is: 201', 0.2, async function () {
  if (!BA.R || !BA.R.up) return NO_FACE;
  if (!(await ready())) return 'a fresh scratch relay did not come up';
  const good = await answered({ 'X-Spirit-Status': '201', 'X-Spirit-Type': 'text/plain' });
  return good.viewer === 201 || 'x-spirit-status 201: the viewer got ' + (good.viewer || 'nothing');
}, 7000);

test.after(function () {
  if (FP.R) { try { FP.R.stop(); } catch (e) { /* gone */ } }
  if (G.relay) {
    try { if (G.relay.child) G.relay.child.kill(); } catch (e) { /* gone */ }
    if (G.relay.root) try { fs.rmSync(G.relay.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
  if (BA.R) { try { BA.R.stop(); } catch (e) { /* gone */ } }
});
