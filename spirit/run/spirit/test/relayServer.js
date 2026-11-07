'use strict';

// spirit/run/spirit/test/relayServer.js
// The tests of spirit/relayServer.js, and of no other module (spec: ./relayServer.md; goal/G41.3): how it serves a
// face its files. Its map and its folder are lifted out of the source and asked, with no relay running; the /face/ posts
// at the end (goal/G41.30) go to a scratch relay with faces.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
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
ok(map && JSON.stringify(keys) === JSON.stringify(WANT.slice().sort()), 'its map serves exactly ' + WANT.join(', '), 'its map serves ' + JSON.stringify(keys));
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
}).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });

// A PAGE ON ANOTHER MEMBER'S FACE CANNOT DRIVE A LOGGED-IN OWNER'S NODE (goal/G41.30, the review, RC2: "a page on any
// member's face can make a logged-in owner's face run verbs on his node, because all faces are same-site and /face/call
// has no Origin check"; its fix: "on every /face/* POST, require Origin equal to the face's own host, require the
// session's name to match faceAt(host).name, and require Content-Type: application/json"; Andy, Q3: "yes."). On a
// scratch relay with two members, each with a face, present and logged in. A refusal is a 4xx and no face event on any
// member's stream; the face's own page still reaches its node.
async function facePosts() {
  const http = require('http');
  const { scratchFaceRelay, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));
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
        const body = o.body || '{"call":"jobs.create","args":{"command":"sh","args":["-c","id"]}}';
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
      ok(r.status >= 400 && r.status < 500 && !ev.length, '/face/call refused, a 4xx and no face event: ' + name, '/face/call ' + name + ': answered ' + (r.status || 'nothing yet') + ', ' + ev.length + ' face event(s) sent to ' + short(ev.map(function (l) { return l.stream; })));
    };
    await refused('an Origin of another face', { origin: 'https://' + Q.host, type: JSONT });
    await refused('no Origin', { type: JSONT });
    await refused('text/plain, a form a page sends with no preflight', { origin: OWN, type: 'text/plain' });
    await refused('another member\'s session at this face\'s host', { origin: OWN, type: JSONT, sid: Q.sid });
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
