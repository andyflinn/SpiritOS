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

// The scratch relay of the join and login parts, made by the first "the world:" test.
const W = { R: null };
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
let n = 0;
// Each ask by a key and a mail of its own, so no cap of a minute or an hour is what refuses it.
function ask(link) {
  n += 1;
  const who = auth.generateIdentity('asker' + n);
  const before = W.R.mails.length;
  let said = null;
  try { said = W.R.relay.join(who.publicKey, 'asker' + n + '@example.org', link, ''); } catch (e) { said = { ok: false, error: String(e && e.message || e) }; }
  return { said: said || {}, mail: W.R.mails.length > before ? W.R.mails[W.R.mails.length - 1] : null };
}
const NO_RELAY = 'no scratch relay: the world failed';

test.run('the world: a scratch relay, its mail kept', 0.2, function () {
  W.R = scratchRelay();
  return !!(W.R && W.R.relay) || 'the scratch relay was not made';
}, 2000);

// the join mail goes only to a link on the asker's own computer
// The box: "the relay must refuse to send a join-email, unless the link in it points to the asker's own computer, so
// senders cannot use the relay to send phishing emails. The relay reads the link as an address, the way a browser
// does, and sends the mail only when all of these hold: the scheme is exactly http, the host is exactly 127.0.0.1, the
// port is any port, or none, there is no user name or password (nothing before an @), the path starts with \"/\"".
// A refusal not made is a relay that sends phishing mail for anyone: 0.8.
const NODE = 'http://127.0.0.1:65432/face.html?app=join';
test.run('the link a node sends, http://127.0.0.1:65432/face.html?app=join, is mailed', 0.2, function () {
  if (!W.R) return NO_RELAY;
  const a = ask(NODE);
  return (a.said.ok === true && !!a.mail && a.mail.text.indexOf(NODE) !== -1) || 'said ' + short(a.said) + ', mail ' + short(a.mail);
}, 1000);
test.run('with no port, it is mailed', 0.2, function () {
  if (!W.R) return NO_RELAY;
  const b = ask('http://127.0.0.1/face.html?app=join');
  return (b.said.ok === true && !!b.mail) || 'said ' + short(b.said) + ', mail ' + short(b.mail);
}, 1000);
// Each link written out, so that each check has a plain title of its own.
const mailed = function (link) {
  if (!W.R) return NO_RELAY;
  const r = ask(link);
  return (r.said.ok === false && !r.mail) || link + ': said ' + short(r.said) + ', mail ' + (r.mail ? 'sent' : 'none');
};
test.run('refused, and no mail sent: https://127.0.0.1:65432/face.html (the scheme is not exactly http)', 0.8, function () { return mailed('https://127.0.0.1:65432/face.html'); }, 1000);
test.run('refused, and no mail sent: http://localhost:65432/face.html (the host is not exactly 127.0.0.1)', 0.8, function () { return mailed('http://localhost:65432/face.html'); }, 1000);
test.run('refused, and no mail sent: http://evil.com/face.html (the host is another site)', 0.8, function () { return mailed('http://evil.com/face.html'); }, 1000);
test.run('refused, and no mail sent: http://127.0.0.1.evil.com/face.html (a host that only begins with 127.0.0.1 (the box: "http://127.0.0.1.evil.com/"))', 0.8, function () { return mailed('http://127.0.0.1.evil.com/face.html'); }, 1000);
test.run('refused, and no mail sent: http://127.0.0.1:1@evil.com/face.html (a user name and password before an @, the site evil.com (the box: "http://127.0.0.1:1@evil.com/"))', 0.8, function () { return mailed('http://127.0.0.1:1@evil.com/face.html'); }, 1000);
test.run('refused, and no mail sent: http://user@127.0.0.1:65432/face.html (a user name before an @, even on 127.0.0.1)', 0.8, function () { return mailed('http://user@127.0.0.1:65432/face.html'); }, 1000);
test.run('refused, and no mail sent: http://127.0.0.2:65432/face.html (another loopback address, not exactly 127.0.0.1)', 0.8, function () { return mailed('http://127.0.0.2:65432/face.html'); }, 1000);
test.run('refused, and no mail sent: http://evil.com/?http://127.0.0.1:65432/ (127.0.0.1 only in the query, the site evil.com)', 0.8, function () { return mailed('http://evil.com/?http://127.0.0.1:65432/'); }, 1000);

// the login mail carries the token, where to paste it, and no link
// The box: "The login-email must not carry a link, so a fake login-email cannot lead the user to a look-alike site",
// "it carries the token only, on a line of its own, easy to copy.", "it carries a text that says where to paste it:
// \"Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into
// its Log in field.\"", and "it does not write out the face's address either".
const SAY = 'Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its Log in field.';
const L = { login: null, text: '', token: '', why: '' };
test.run('asked with the member\'s own email, the relay mails a login', 0.2, function () {
  if (!W.R) return NO_RELAY;
  const R = W.R;
  const bert = auth.generateIdentity('bert');
  try {
    R.later(2 * 60 * 1000);
    R.relay.join(bert.publicKey, 'bert@example.org', NODE, '');
    const code = ((/[?&]join=([A-Za-z0-9_-]+)/.exec((R.mails[R.mails.length - 1] || {}).text || '')) || [])[1] || '';
    R.relay.joinConfirm(bert.publicKey, code, '');
    require(path.join(RUN, 'spirit', 'relayStore.js')).open(R.home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
    R.later(2 * 60 * 1000);
    const before = R.mails.length;
    R.relay.faceLogin('harbour', 'bert@example.org');
    L.login = R.mails.length > before ? R.mails[R.mails.length - 1] : null;
  } catch (e) { L.login = null; L.why = 'the face member could not be made: ' + (e && e.message || e); }
  L.text = String((L.login && L.login.text) || '');
  const lines = L.text.split(/\r?\n/).map(function (l) { return l.trim(); });
  L.token = lines.filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0] || '';
  return !!L.login || L.why || 'no login mail was sent';
}, 1000);
test.run('the token stands on a line of its own', 0.2, function () { return !!L.token || 'no line holds the token alone: ' + short(L.text); }, 1000);
test.run('it says where to paste the token: into the Log in field of the face, opened by its address and never from a link', 0.2, function () {
  return L.text.indexOf(SAY) !== -1 || 'the mail says: ' + short(L.text) + ', not ' + SAY;
}, 1000);
test.run('it holds no link', 0.8, function () { return (!!L.login && !/https?:\/\/|www\./i.test(L.text)) || 'the mail holds a link: ' + short(L.text); }, 1000);
test.run('it does not write out the face\'s address', 0.2, function () {
  return (!!L.login && !/harbour\.relay\.example|relay\.example/i.test(L.text)) || 'the mail names the address: ' + short(L.text);
}, 1000);
test.run('the token, pasted into the Log in field, logs in', 0.2, function () {
  if (!W.R) return NO_RELAY;
  let pasted = null;
  try { pasted = L.token ? W.R.relay.faceLogin('harbour', L.token) : null; } catch (e) { pasted = null; }
  return (!!pasted && pasted.loggedIn === true) || 'faceLogin with the token: ' + short(pasted);
}, 1000);

// A LONG SEARCH MUST NOT STOP THE RELAY (goal/G41.30; the box: "the server MUST not CRASH or HANG", "an attacker trying
// to crash our servers will throw ANYTHING at the api. Imitate that attacker!"; Andy, on the report "A long search query
// stalls the relay's event loop for seconds": "fix this now. in this item"). A relay with MEMBERS connected members;
// one of them sends the longest search the wire carries, sealed to the relay as every ask is. While it is answered the
// relay's event loop is watched: a tick every 5 ms must never wait longer than GAP_MS, so every other request on the
// relay keeps being served, and the search must still be answered.
const MEMBERS = 500;
const GAP_MS = 250;
// a search as long as the wire carries does not stop the relay answering others
const LS = { home: null, box: null, asker: null, heard: [], seated: 0, len: 0, posted: null, worst: 0, answered: false, ran: false };
test.run('500 members seated and connected', 0.2, function () {
  LS.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relay-search-'));
  fs.mkdirSync(path.join(LS.home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(LS.home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(LS.home, owner.publicKey);
  const box = LS.box = require(path.join(RUN, 'spirit', 'relay.js')).createRelay(LS.home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  // Each member seated by an invite of the owner's and connected by its stream, as a node connects.
  for (let i = 0; i < MEMBERS; i++) {
    const name = 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    if (!minted || !minted.invite) continue;
    const c = box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, null, minted.invite.token, name);
    if (!c || c.ok === false) continue;
    const sink = { write: function (chunk) { if (id === LS.asker) LS.heard.push(String(chunk)); return true; }, close: function () {} };
    if (!LS.asker) LS.asker = id;
    const st = box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), sink);
    if (st && st.ok === false) continue;
    LS.seated += 1;
  }
  return LS.seated === MEMBERS || 'only ' + LS.seated + ' of ' + MEMBERS + ' members were seated and connected: the search would rank fewer rows than asked';
}, 135000);
test.run('the search thrown is at least 12000 characters, near 3/4 of the payload', 0.2, function () {
  if (!LS.box || !LS.asker) return 'no relay with members: the world failed';
  const limits = require(path.join(RUN, 'spirit', 'limits.js'));
  const seal = require(path.join(RUN, 'spirit', 'seal.js'));
  const box = LS.box;
  const relayKey = box.relayPublicKey();
  // The longest sealed search the wire takes: from 3/4 of the payload down, until the relay takes the post.
  const sealedAsk = function (len) {
    const q = ('abcdefghij ').repeat(Math.ceil(len / 11)).slice(0, len);
    const sealed = seal.seal(box.relaySealKey(), LS.asker.publicKey, relayKey, JSON.stringify({ v: 1, body: { search: { q: q } } }));
    return JSON.stringify(sealed);
  };
  let len = Math.floor(limits.PAYLOAD_MAX * 3 / 4); let text = sealedAsk(len);
  while (len > 1000 && Buffer.byteLength(text, 'utf8') > limits.PAYLOAD_MAX) { len -= 250; text = sealedAsk(len); }
  LS.len = len; LS.text = text;
  test.comment('the search: ' + len + ' characters, ' + Buffer.byteLength(text, 'utf8') + ' bytes sealed, over ' + LS.seated + ' connected members (a longer one, as the report\'s 60,000, is refused 413 by the wire)');
  return len >= 12000 || 'only ' + len + ' characters fit: the search judges too little';
}, 1000);
test.run('the relay takes the search', 0.2, async function () {
  if (!LS.text) return 'no search made: the world failed';
  const box = LS.box; const asker = LS.asker; const relayKey = box.relayPublicKey(); const text = LS.text;
  let last = Date.now(); let gap = 0;
  const tick = setInterval(function () { const t = Date.now(); gap = Math.max(gap, t - last); last = t; }, 5);
  const before = LS.heard.length;
  const t0 = Date.now();
  LS.posted = box.routePost(asker.publicKey, relayKey, text, auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, relayKey, text)));
  const inPost = Date.now() - t0;
  for (let i = 0; i < 200 && !LS.answered; i++) { await new Promise(function (r) { setTimeout(r, 25); }); LS.answered = LS.heard.length > before; }
  clearInterval(tick);
  LS.worst = Math.max(gap, inPost);
  LS.ran = true;
  return (!!LS.posted && LS.posted.ok !== false) || 'the relay refused the search: ' + short(LS.posted);
}, 6000);
test.run('while it searches, the relay keeps answering: its event loop never waited more than 250 ms', 0.2, function () {
  if (!LS.ran) return 'the search was never posted: the world failed';
  return LS.worst <= GAP_MS || 'IT HANGS: one search of ' + LS.len + ' characters over ' + LS.seated + ' members held the relay\'s event loop for ' + LS.worst + ' ms (more than ' + GAP_MS + '), every other request on the relay waiting';
}, 1000);
test.run('and the search is answered', 0.2, function () {
  if (!LS.ran) return 'the search was never posted: the world failed';
  return LS.answered || 'the search was never answered within 5 s';
}, 1000);

// THE FACE COMES BACK BY ITSELF (goal/G43.30; Andy: "ALL, I had to, several times, refresh my new face, because it
// doesn't seem to auto-reconnect.", "all, FIX IT, IN THIS ITEM, then we tag."). The face retries only once its stream ends
// (spirit/shell/boot.js), so when the home node's feed into it goes, the relay ends the face's stream: the face opens it
// again, and the node hears face-open once more and feeds it. A real relay on a scratch copy (spirit/test/headLessChrome.js
// scratchFaceRelay), a member seated with a face, its node present and its face logged in; the face's stream and the
// home node's feed over HTTP, as the face and the node send them.
const http = require('http');
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const F = { R: null, M: null, opened: [], face: null, one: null, two: null, again: null, three: null, opensNow: 0 };
const NO_FACE_RELAY = 'no scratch face relay: the world failed';
// The face's own stream, as its page opens it: GET /face/stream, its login cookie, on its own host.
function openFace() {
  return new Promise(function (resolve) {
    const f = { lines: [], ended: false, status: 0 };
    const req = http.get({ host: '127.0.0.1', port: F.R.port, path: '/face/stream', headers: { host: F.M.host, cookie: 'spirit_face=' + F.M.sid } }, function (res) {
      f.status = res.statusCode;
      res.setEncoding('utf8');
      res.on('data', function (d) { f.lines.push(d); });
      res.on('end', function () { f.ended = true; });
      res.on('close', function () { f.ended = true; });
    });
    req.on('error', function () { f.ended = true; });
    f.req = req;
    F.opened.push(f);
    // Its headers come with its first line, face-open answered or a refusal: the face is handed back at once.
    resolve(f);
  });
}
// The home node's long upload of the face's updates: POST /api/relay/face/stream, signed for this relay and 'stream'.
function feed() {
  const R = F.R; const M = F.M;
  const req = http.request({ host: '127.0.0.1', port: R.port, path: '/api/relay/face/stream', method: 'POST',
    headers: { 'x-spirit-from': M.publicKey, 'x-spirit-sig': R.auth.sign(M.privateKey, R.auth.faceMessage(M.publicKey, R.relayKey, 'stream')), 'transfer-encoding': 'chunked' } });
  req.on('error', function () { /* cut */ });
  req.flushHeaders();
  return req;
}
function faceOpens() { return F.R.lines.filter(function (l) { return l.stream === 'harbour' && /face-open/.test(l.line); }).length; }
function wait(fn, ms) { return H.until(function () { return Promise.resolve(fn()); }, ms || 5000); }

// a home node's feed gone: the relay ends its face's stream, so the face opens it again
test.run('the world: a scratch relay, harbour seated with a face, its node present and its face logged in', 0.2, async function () {
  F.R = await H.scratchFaceRelay({ members: ['harbour'] });
  if (!F.R.up) return 'the scratch relay did not come up';
  F.M = F.R.members.harbour;
  return true;
}, 3000);
test.run('the face opens its stream, and the home node hears face-open', 0.2, async function () {
  if (!F.M) return NO_FACE_RELAY;
  const opensBefore = faceOpens();
  F.face = await openFace();
  return (await wait(function () { return faceOpens() > opensBefore; }) && !F.face.ended) || 'the face stream: ' + F.face.status + ', face-open heard ' + (faceOpens() - opensBefore) + ' times';
}, 6000);
test.run('the world: the home node\'s feed reaches the face', 0.2, async function () {
  if (!F.face) return NO_FACE_RELAY;
  F.one = feed();
  F.one.write(JSON.stringify({ event: 'zz-first', data: {} }) + '\n');
  return !!(await wait(function () { return F.face.lines.join('').indexOf('zz-first') !== -1; })) || 'the face heard ' + short(F.face.lines.join(''));
}, 6000);

// the attacker: a feed replaced by a newer one goes, and the face's stream stays
test.run('the old feed cut, the face\'s stream stays open and the newer feed still reaches it', 0.2, async function () {
  if (!F.one) return NO_FACE_RELAY;
  const face = F.face;
  F.two = feed();
  F.two.write(JSON.stringify({ event: 'zz-second', data: {} }) + '\n');
  await wait(function () { return face.lines.join('').indexOf('zz-second') !== -1; });
  F.one.destroy();
  await new Promise(function (r) { setTimeout(r, 1500); });
  F.two.write(JSON.stringify({ event: 'zz-third', data: {} }) + '\n');
  return (!face.ended && !!(await wait(function () { return face.lines.join('').indexOf('zz-third') !== -1; }))) ||
    'after the replaced feed went: ' + JSON.stringify({ ended: face.ended, heard: face.lines.join('').slice(-200) });
}, 12000);

// the feed into the face goes, as when the home node goes away
test.run('the relay ends the face\'s stream: the face sees it end, and retries', 0.2, async function () {
  if (!F.two) return NO_FACE_RELAY;
  F.two.destroy();
  return !!(await wait(function () { return F.face.ended; }, 8000)) || 'the face\'s stream stayed open, silent, after its node\'s feed went: the face never retries';
}, 9000);
test.run('the face opens its stream again, and the home node hears face-open once more', 0.2, async function () {
  if (!F.M) return NO_FACE_RELAY;
  const opensNow = faceOpens();
  F.again = await openFace();
  return (await wait(function () { return faceOpens() > opensNow; }) && !F.again.ended) || 'the face\'s new stream: ' + F.again.status + ', face-open heard ' + (faceOpens() - opensNow) + ' times';
}, 6000);
test.run('and its updates reach the face again, no reload', 0.2, async function () {
  if (!F.again) return NO_FACE_RELAY;
  F.three = feed();
  F.three.write(JSON.stringify({ event: 'zz-back', data: {} }) + '\n');
  const heard = await wait(function () { return F.again.lines.join('').indexOf('zz-back') !== -1; });
  F.three.destroy();
  return !!heard || 'the face heard ' + short(F.again.lines.join(''));
}, 6000);

test.after(function () {
  if (W.R) { try { fs.rmSync(W.R.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  if (LS.home) { try { fs.rmSync(LS.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  F.opened.forEach(function (f) { try { f.req.destroy(); } catch (e) { /* gone */ } });
  if (F.R && F.R.stop) F.R.stop();
});
