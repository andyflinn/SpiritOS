'use strict';

// spirit/run/spirit/test/relay.js
// The tests of spirit/relay.js, and of no other module (spec: ./relay.md). This file holds goal/G41.29: the join mail
// is sent only for a link to the asker's own computer, and the login mail carries a token and no link. A relay is made
// on a scratch folder of its own, its mailer a stand-in that keeps what it was handed; nothing is sent.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// A relay on a scratch folder: its identity planted as the relay keeps it (relayAuth beside it), its face domain
// relay.example, its mail kept.
function scratchRelay() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-'));
  const js = path.join(home, 'spirit');
  fs.mkdirSync(js, { recursive: true });
  // goal/G43.32: relayAuth.js takes the spirit object first and loads the rest through it, so the relay's home holds the
  // product's run://spirit/ (its tracked files) as a real install does, not two files of it.
  require('child_process').execFileSync('git', ['ls-files', '--', 'spirit'], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(RUN, f)); })
    .forEach(function (f) { const d = path.join(home, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RUN, f), d); });
  const planted = require(path.join(js, 'relayAuth.js'));
  planted.nameIdentity(home, 'relay');
  // Its owner, written at install as a relay's is: a relay with none seats nobody.
  planted.writeOwner(home, planted.generateIdentity('owner').publicKey);
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'spirit', 'state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
  const mails = [];
  let now = Date.now();
  const relay = require(path.join(RUN, 'spirit', 'relay.js')).createRelay(home, {
    now: function () { return now; },
    sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); },
  });
  return { home: home, relay: relay, mails: mails, auth: planted, later: function (ms) { now += ms; } };
}

test.startTest('relay.js: the join mail and the login mail (goal/G41.29)');

const R = scratchRelay();
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
let n = 0;
// Each ask by a key and a mail of its own, so no cap of a minute or an hour is what refuses it.
function ask(link) {
  n += 1;
  const who = auth.generateIdentity('asker' + n);
  const before = R.mails.length;
  let said = null;
  try { said = R.relay.join(who.publicKey, 'asker' + n + '@example.org', link, ''); } catch (e) { said = { ok: false, error: String(e && e.message || e) }; }
  return { said: said || {}, mail: R.mails.length > before ? R.mails[R.mails.length - 1] : null };
}

test.subHeading('the join mail goes only to a link on the asker\'s own computer');
// The box: "the relay must refuse to send a join-email, unless the link in it points to the asker's own computer, so
// senders cannot use the relay to send phishing emails. The relay reads the link as an address, the way a browser
// does, and sends the mail only when all of these hold: the scheme is exactly http, the host is exactly 127.0.0.1, the
// port is any port, or none, there is no user name or password (nothing before an @), the path starts with \"/\"".
const NODE = 'http://127.0.0.1:65432/face.html?app=join';
const a = ask(NODE);
ok(a.said.ok === true && !!a.mail && a.mail.text.indexOf(NODE) !== -1, 'the link a node sends, http://127.0.0.1:65432/face.html?app=join, is mailed', 'said ' + short(a.said) + ', mail ' + short(a.mail));
const b = ask('http://127.0.0.1/face.html?app=join');
ok(b.said.ok === true && !!b.mail, 'with no port, it is mailed', 'said ' + short(b.said) + ', mail ' + short(b.mail));
// Each link written out, so that each check has a plain title of its own.
const mailed = function (link) { const r = ask(link); return { fine: r.said.ok === false && !r.mail, why: link + ': said ' + short(r.said) + ', mail ' + (r.mail ? 'sent' : 'none') }; };
let m;
m = mailed('https://127.0.0.1:65432/face.html'); ok(m.fine, 'refused, and no mail sent: https://127.0.0.1:65432/face.html (the scheme is not exactly http)', m.why);
m = mailed('http://localhost:65432/face.html'); ok(m.fine, 'refused, and no mail sent: http://localhost:65432/face.html (the host is not exactly 127.0.0.1)', m.why);
m = mailed('http://evil.com/face.html'); ok(m.fine, 'refused, and no mail sent: http://evil.com/face.html (the host is another site)', m.why);
m = mailed('http://127.0.0.1.evil.com/face.html'); ok(m.fine, 'refused, and no mail sent: http://127.0.0.1.evil.com/face.html (a host that only begins with 127.0.0.1 (the box: "http://127.0.0.1.evil.com/"))', m.why);
m = mailed('http://127.0.0.1:1@evil.com/face.html'); ok(m.fine, 'refused, and no mail sent: http://127.0.0.1:1@evil.com/face.html (a user name and password before an @, the site evil.com (the box: "http://127.0.0.1:1@evil.com/"))', m.why);
m = mailed('http://user@127.0.0.1:65432/face.html'); ok(m.fine, 'refused, and no mail sent: http://user@127.0.0.1:65432/face.html (a user name before an @, even on 127.0.0.1)', m.why);
m = mailed('http://127.0.0.2:65432/face.html'); ok(m.fine, 'refused, and no mail sent: http://127.0.0.2:65432/face.html (another loopback address, not exactly 127.0.0.1)', m.why);
m = mailed('http://evil.com/?http://127.0.0.1:65432/'); ok(m.fine, 'refused, and no mail sent: http://evil.com/?http://127.0.0.1:65432/ (127.0.0.1 only in the query, the site evil.com)', m.why);

test.subHeading('the login mail carries the token, where to paste it, and no link');
// The box: "The login-email must not carry a link, so a fake login-email cannot lead the user to a look-alike site",
// "it carries the token only, on a line of its own, easy to copy.", "it carries a text that says where to paste it:
// \"Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into
// its Log in field.\"", and "it does not write out the face's address either".
const SAY = 'Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its Log in field.';
const bert = auth.generateIdentity('bert');
let login = null;
try {
  R.later(2 * 60 * 1000);
  const j = R.relay.join(bert.publicKey, 'bert@example.org', NODE, '');
  const code = ((/[?&]join=([A-Za-z0-9_-]+)/.exec((R.mails[R.mails.length - 1] || {}).text || '')) || [])[1] || '';
  R.relay.joinConfirm(bert.publicKey, code, '');
  require(path.join(RUN, 'spirit', 'relayStore.js')).open(R.home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
  R.later(2 * 60 * 1000);
  const before = R.mails.length;
  R.relay.faceLogin('harbour', 'bert@example.org');
  login = R.mails.length > before ? R.mails[R.mails.length - 1] : null;
  void j;
} catch (e) { login = null; test.comment('the face member could not be made: ' + (e && e.message || e)); }
const text = String((login && login.text) || '');
const lines = text.split(/\r?\n/).map(function (l) { return l.trim(); });
const token = lines.filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0] || '';
ok(!!login, 'asked with the member\'s own email, the relay mails a login', 'no login mail was sent');
ok(!!token, 'the token stands on a line of its own', 'no line holds the token alone: ' + short(text));
ok(text.indexOf(SAY) !== -1, 'it says where to paste the token: into the Log in field of the face, opened by its address and never from a link', 'the mail says: ' + short(text) + ', not ' + SAY);
ok(!!login && !/https?:\/\/|www\./i.test(text), 'it holds no link', 'the mail holds a link: ' + short(text));
ok(!!login && !/harbour\.relay\.example|relay\.example/i.test(text), 'it does not write out the face\'s address', 'the mail names the address: ' + short(text));
let pasted = null;
try { pasted = token ? R.relay.faceLogin('harbour', token) : null; } catch (e) { pasted = null; }
ok(!!pasted && pasted.loggedIn === true, 'the token, pasted into the Log in field, logs in', 'faceLogin with the token: ' + short(pasted));

try { fs.rmSync(R.home, { recursive: true, force: true }); } catch (e) { /* scratch */ }

// A LONG SEARCH MUST NOT STOP THE RELAY (goal/G41.30; the box: "the server MUST not CRASH or HANG", "an attacker trying
// to crash our servers will throw ANYTHING at the api. Imitate that attacker!"; Andy, on the report "A long search query
// stalls the relay's event loop for seconds": "fix this now. in this item"). A relay with MEMBERS connected members;
// one of them sends the longest search the wire carries, sealed to the relay as every ask is. While it is answered the
// relay's event loop is watched: a tick every 5 ms must never wait longer than GAP_MS, so every other request on the
// relay keeps being served, and the search must still be answered.
const MEMBERS = 500;
const GAP_MS = 250;
async function longSearch() {
  test.subHeading('a search as long as the wire carries does not stop the relay answering others');
  const limits = require(path.join(RUN, 'spirit', 'limits.js'));
  const seal = require(path.join(RUN, 'spirit', 'seal.js'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-search-'));
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(home, owner.publicKey);
  const box = require(path.join(RUN, 'spirit', 'relay.js')).createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  // Each member seated by an invite of the owner's and connected by its stream, as a node connects.
  const heard = [];
  let asker = null; let seated = 0;
  for (let i = 0; i < MEMBERS; i++) {
    const name = 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    if (!minted || !minted.invite) continue;
    const c = box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, null, minted.invite.token, name);
    if (!c || c.ok === false) continue;
    const sink = { write: function (chunk) { if (id === asker) heard.push(String(chunk)); return true; }, close: function () {} };
    if (!asker) asker = id;
    const s = box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), sink);
    if (s && s.ok === false) continue;
    seated += 1;
  }
  ok(seated === MEMBERS, '500 members seated and connected', 'only ' + seated + ' of ' + MEMBERS + ' members were seated and connected: the search would rank fewer rows than asked');
  const relayKey = box.relayPublicKey();
  // The longest sealed search the wire takes: from 3/4 of the payload down, until the relay takes the post.
  const sealedAsk = function (len) {
    const q = ('abcdefghij ').repeat(Math.ceil(len / 11)).slice(0, len);
    const sealed = seal.seal(box.relaySealKey(), asker.publicKey, relayKey, JSON.stringify({ v: 1, body: { search: { q: q } } }));
    return JSON.stringify(sealed);
  };
  let len = Math.floor(limits.PAYLOAD_MAX * 3 / 4); let text = sealedAsk(len);
  while (len > 1000 && Buffer.byteLength(text, 'utf8') > limits.PAYLOAD_MAX) { len -= 250; text = sealedAsk(len); }
  test.comment('the search: ' + len + ' characters, ' + Buffer.byteLength(text, 'utf8') + ' bytes sealed, over ' + seated + ' connected members (a longer one, as the report\'s 60,000, is refused 413 by the wire)');
  ok(len >= 12000, 'the search thrown is at least 12000 characters, near 3/4 of the payload', 'only ' + len + ' characters fit: the search judges too little');
  let last = Date.now(); let gap = 0;
  const tick = setInterval(function () { const n = Date.now(); gap = Math.max(gap, n - last); last = n; }, 5);
  const before = heard.length;
  const t0 = Date.now();
  const posted = box.routePost(asker.publicKey, relayKey, text, auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, relayKey, text)));
  const inPost = Date.now() - t0;
  let answered = false;
  for (let i = 0; i < 200 && !answered; i++) { await new Promise(function (r) { setTimeout(r, 25); }); answered = heard.length > before; }
  clearInterval(tick);
  const worst = Math.max(gap, inPost);
  ok(!!posted && posted.ok !== false, 'the relay takes the search', 'the relay refused the search: ' + short(posted));
  ok(worst <= GAP_MS, 'while it searches, the relay keeps answering: its event loop never waited more than 250 ms',
    'IT HANGS: one search of ' + len + ' characters over ' + seated + ' members held the relay\'s event loop for ' + worst + ' ms (more than ' + GAP_MS + '), every other request on the relay waiting');
  ok(answered, 'and the search is answered', 'the search was never answered within 5 s');
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
}

// THE FACE COMES BACK BY ITSELF (goal/G43.30; Andy: "ALL, I had to, several times, refresh my new face, because it
// doesn't seem to auto-reconnect.", "all, FIX IT, IN THIS ITEM, then we tag."). The face retries only once its stream ends
// (spirit/shell/boot.js), so when the home node's feed into it goes, the relay ends the face's stream: the face opens it
// again, and the node hears face-open once more and feeds it. A real relay on a scratch copy (spirit/test/headLessChrome.js
// scratchFaceRelay), a member seated with a face, its node present and its face logged in; the face's stream and the
// home node's feed over HTTP, as the face and the node send them.
const http = require('http');
async function faceReconnect() {
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const R = await H.scratchFaceRelay({ members: ['harbour'] });
  const opened = [];
  try {
    test.subHeading('a home node\'s feed gone: the relay ends its face\'s stream, so the face opens it again');
    ok(R.up, 'the world: a scratch relay, harbour seated with a face, its node present and its face logged in', 'the scratch relay did not come up');
    if (!R.up) return;
    const M = R.members.harbour;
    // The face's own stream, as its page opens it: GET /face/stream, its login cookie, on its own host.
    const openFace = function () {
      return new Promise(function (resolve) {
        const f = { lines: [], ended: false, status: 0 };
        const req = http.get({ host: '127.0.0.1', port: R.port, path: '/face/stream', headers: { host: M.host, cookie: 'spirit_face=' + M.sid } }, function (res) {
          f.status = res.statusCode;
          res.setEncoding('utf8');
          res.on('data', function (d) { f.lines.push(d); });
          res.on('end', function () { f.ended = true; });
          res.on('close', function () { f.ended = true; });
        });
        req.on('error', function () { f.ended = true; });
        f.req = req;
        opened.push(f);
        // Its headers come with its first line, face-open answered or a refusal: the face is handed back at once.
        resolve(f);
      });
    };
    // The home node's long upload of the face's updates: POST /api/relay/face/stream, signed for this relay and 'stream'.
    const feed = function () {
      const req = http.request({ host: '127.0.0.1', port: R.port, path: '/api/relay/face/stream', method: 'POST',
        headers: { 'x-spirit-from': M.publicKey, 'x-spirit-sig': R.auth.sign(M.privateKey, R.auth.faceMessage(M.publicKey, R.relayKey, 'stream')), 'transfer-encoding': 'chunked' } });
      req.on('error', function () { /* cut */ });
      req.flushHeaders();
      return req;
    };
    const faceOpens = function () { return R.lines.filter(function (l) { return l.stream === 'harbour' && /face-open/.test(l.line); }).length; };
    const wait = function (fn, ms) { return H.until(function () { return Promise.resolve(fn()); }, ms || 5000); };

    const opensBefore = faceOpens();
    const face = await openFace();
    ok(await wait(function () { return faceOpens() > opensBefore; }) && !face.ended, 'the face opens its stream, and the home node hears face-open', 'the face stream: ' + face.status + ', face-open heard ' + (faceOpens() - opensBefore) + ' times');
    const one = feed();
    one.write(JSON.stringify({ event: 'zz-first', data: {} }) + '\n');
    ok(await wait(function () { return face.lines.join('').indexOf('zz-first') !== -1; }), 'the world: the home node\'s feed reaches the face', 'the face heard ' + short(face.lines.join('')));

    test.subHeading('the attacker: a feed replaced by a newer one goes, and the face\'s stream stays');
    const two = feed();
    two.write(JSON.stringify({ event: 'zz-second', data: {} }) + '\n');
    await wait(function () { return face.lines.join('').indexOf('zz-second') !== -1; });
    one.destroy();
    await new Promise(function (r) { setTimeout(r, 1500); });
    two.write(JSON.stringify({ event: 'zz-third', data: {} }) + '\n');
    ok(!face.ended && await wait(function () { return face.lines.join('').indexOf('zz-third') !== -1; }), 'the old feed cut, the face\'s stream stays open and the newer feed still reaches it',
      'after the replaced feed went: ' + JSON.stringify({ ended: face.ended, heard: face.lines.join('').slice(-200) }));

    test.subHeading('the feed into the face goes, as when the home node goes away');
    two.destroy();
    ok(await wait(function () { return face.ended; }, 8000), 'the relay ends the face\'s stream: the face sees it end, and retries', 'the face\'s stream stayed open, silent, after its node\'s feed went: the face never retries');
    const opensNow = faceOpens();
    const again = await openFace();
    ok(await wait(function () { return faceOpens() > opensNow; }) && !again.ended, 'the face opens its stream again, and the home node hears face-open once more', 'the face\'s new stream: ' + again.status + ', face-open heard ' + (faceOpens() - opensNow) + ' times');
    const three = feed();
    three.write(JSON.stringify({ event: 'zz-back', data: {} }) + '\n');
    ok(await wait(function () { return again.lines.join('').indexOf('zz-back') !== -1; }), 'and its updates reach the face again, no reload', 'the face heard ' + short(again.lines.join('')));
    three.destroy();
  } finally {
    opened.forEach(function (f) { try { f.req.destroy(); } catch (e) { /* gone */ } });
    if (R && R.stop) R.stop();
  }
}

longSearch().then(faceReconnect).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
