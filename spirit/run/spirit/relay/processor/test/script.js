'use strict';

// spirit/run/spirit/relay/processor/test/script.js
// The tests of spirit/relay/processor/script.js, and of no other module (spec: ./script.md). This file holds goal/G41.29: the join mail
// is sent only for a link to the asker's own computer, and the login mail carries a token and no link. A relay is made
// on a scratch folder of its own, its mailer a stand-in that keeps what it was handed; nothing is sent.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/relay/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db or a relay.db at <root>/spirit/state) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore/script.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    // A relay's own store too (relay.db beside it), which relayStore keeps open the same way.
    // Through every copy of relayStore this process loaded (a relay made on a scratch tree loads that tree's own), so it is
    // the store that relay holds open.
    if (names.indexOf('relay.db') !== -1 && path.basename(dir) === 'state') {
      Object.keys(require.cache).filter(function (k) { return /[\\/]relayStore\.js$/.test(k); }).forEach(function (k) {
        try { require.cache[k].exports.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ }
      });
    }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
// Its folder goes last, below, once every relay of it is shut.

// A relay on a scratch folder: its identity planted as the relay keeps it (relayAuth beside it), its face domain
// relay.example, its mail kept.
function scratchRelay() {
  const home = ownTemp('spirit-relay-');
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
  const relay = S.requireScript('spirit/relay/processor/script.js').createRelay(home, {
    now: function () { return now; },
    sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); },
  });
  return { home: home, relay: relay, mails: mails, auth: planted, later: function (ms) { now += ms; } };
}

// The scratch relay of the join and login parts, made by the first "the world:" test.
const W = { R: null };
const auth = S.requireScript('spirit/relayAuth/script.js');
let n = 0;
// Each ask by a key and a mail of its own, so no cap of a minute or an hour is what refuses it.
function ask(link) {
  n += 1;
  const who = auth.generateIdentity('asker' + n);
  const before = W.R.mails.length;
  let said = null;
  try { said = W.R.relay.join(who.publicKey, 'asker' + n + '@example.org', link, ''); } catch (e) { said = { ok: false }; }
  return { said: said || {}, mail: W.R.mails.length > before ? W.R.mails[W.R.mails.length - 1] : null };
}
test.run('a scratch relay comes up with its mail kept', 0.2, function () {
  W.R = scratchRelay();
  return !!(W.R && W.R.relay);
}, test.limit.quick);

// the join mail goes only to a link on the asker's own computer
// The box: "the relay must refuse to send a join-email, unless the link in it points to the asker's own computer, so
// senders cannot use the relay to send phishing emails. The relay reads the link as an address, the way a browser
// does, and sends the mail only when all of these hold: the scheme is exactly http, the host is exactly 127.0.0.1, the
// port is any port, or none, there is no user name or password (nothing before an @), the path starts with \"/\"".
// A refusal not made is a relay that sends phishing mail for anyone: 0.8.
const NODE = 'http://127.0.0.1:65432/face.html?app=join';
test.run('the link a node sends, http://127.0.0.1:65432/face.html?app=join, is mailed', 0.2, function () {
  if (!W.R) return false;
  const a = ask(NODE);
  return (a.said.ok === true && !!a.mail && a.mail.text.indexOf(NODE) !== -1) || false;
}, test.limit.quick);
test.run('the same link with no port is mailed', 0.2, function () {
  if (!W.R) return false;
  const b = ask('http://127.0.0.1/face.html?app=join');
  return (b.said.ok === true && !!b.mail) || false;
}, test.limit.quick);
// Each link written out, so that each check has a plain title of its own.
const mailed = function (link) {
  if (!W.R) return false;
  const r = ask(link);
  return (r.said.ok === false && !r.mail) || false;
};
test.run('a link to https://127.0.0.1:65432/face.html is refused and no mail is sent, as the scheme is not exactly http', 0.8, function () { return mailed('https://127.0.0.1:65432/face.html'); }, test.limit.quick);
test.run('a link to http://localhost:65432/face.html is refused and no mail is sent, as the host is not exactly 127.0.0.1', 0.8, function () { return mailed('http://localhost:65432/face.html'); }, test.limit.quick);
test.run('a link to http://evil.com/face.html is refused and no mail is sent, as the host is another site', 0.8, function () { return mailed('http://evil.com/face.html'); }, test.limit.quick);
test.run('a link to http://127.0.0.1.evil.com/face.html is refused and no mail is sent, as its host only begins with 127.0.0.1', 0.8, function () { return mailed('http://127.0.0.1.evil.com/face.html'); }, test.limit.quick);
test.run('a link to http://127.0.0.1:1@evil.com/face.html is refused, no mail sent: a user and password before an @, the site evil.com', 0.8, function () { return mailed('http://127.0.0.1:1@evil.com/face.html'); }, test.limit.quick);
test.run('a link to http://user@127.0.0.1:65432/face.html is refused, no mail sent: a user name before an @, even on 127.0.0.1', 0.8, function () { return mailed('http://user@127.0.0.1:65432/face.html'); }, test.limit.quick);
test.run('a link to http://127.0.0.2:65432/face.html is refused, no mail sent: another loopback address, not exactly 127.0.0.1', 0.8, function () { return mailed('http://127.0.0.2:65432/face.html'); }, test.limit.quick);
test.run('a link to http://evil.com/?http://127.0.0.1:65432/ is refused, no mail sent: 127.0.0.1 only in the query, the site evil.com', 0.8, function () { return mailed('http://evil.com/?http://127.0.0.1:65432/'); }, test.limit.quick);

// the login mail carries the token, where to paste it, and no link
// The box: "The login-email must not carry a link, so a fake login-email cannot lead the user to a look-alike site",
// "it carries the token only, on a line of its own, easy to copy.", "it carries a text that says where to paste it:
// \"Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into
// its Log in field.\"", and "it does not write out the face's address either".
const SAY = 'Open your face by typing its address or from your bookmark, never from a link in a mail, and paste this token into its Log in field.';
const L = { login: null, text: '', token: '' };
test.run('asked with the member\'s own email, the relay mails a login', 0.2, function () {
  if (!W.R) return false;
  const R = W.R;
  const bert = auth.generateIdentity('bert');
  try {
    R.later(2 * 60 * 1000);
    R.relay.join(bert.publicKey, 'bert@example.org', NODE, '');
    const code = ((/[?&]join=([A-Za-z0-9_-]+)/.exec((R.mails[R.mails.length - 1] || {}).text || '')) || [])[1] || '';
    R.relay.joinConfirm(bert.publicKey, code, '');
    S.requireScript('spirit/relay/store/script.js').open(R.home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
    R.later(2 * 60 * 1000);
    const before = R.mails.length;
    R.relay.faceLogin('harbour', 'bert@example.org');
    L.login = R.mails.length > before ? R.mails[R.mails.length - 1] : null;
  } catch (e) { L.login = null; }
  L.text = String((L.login && L.login.text) || '');
  const lines = L.text.split(/\r?\n/).map(function (l) { return l.trim(); });
  L.token = lines.filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0] || '';
  return !!L.login;
}, test.limit.quick);
test.run('the token stands on a line of its own', 0.2, function () { return !!L.token; }, test.limit.quick);
test.run('the login mail says where to paste the token: into the Log in field of the face, opened by its address and never from a link', 0.2, function () {
  return L.text.indexOf(SAY) !== -1;
}, test.limit.quick);
test.run('the login mail holds no link', 0.8, function () { return (!!L.login && !/https?:\/\/|www\./i.test(L.text)); }, test.limit.quick);
test.run('the login mail does not write out the face\'s address', 0.2, function () {
  return (!!L.login && !/harbour\.relay\.example|relay\.example/i.test(L.text));
}, test.limit.quick);
test.run('the token, pasted into the Log in field, logs in', 0.2, function () {
  if (!W.R) return false;
  let pasted = null;
  try { pasted = L.token ? W.R.relay.faceLogin('harbour', L.token) : null; } catch (e) { pasted = null; }
  return (!!pasted && pasted.loggedIn === true);
}, test.limit.quick);

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
test.run('500 members are seated and connected', 0.2, function () {
  LS.home = ownTemp('spirit-relay-search-');
  fs.mkdirSync(path.join(LS.home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(LS.home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(LS.home, owner.publicKey);
  const box = LS.box = S.requireScript('spirit/relay/processor/script.js').createRelay(LS.home);
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
  return LS.seated === MEMBERS;
}, test.limit.long);
test.run('the search thrown is at least 12000 characters, near 3/4 of the payload', 0.2, function () {
  if (!LS.box || !LS.asker) return false;
  const limits = S.requireScript('spirit/limits/script.js');
  const seal = S.requireScript('spirit/seal/script.js');
  const box = LS.box;
  const relayKey = box.relayPublicKey();
  // The longest sealed search the wire takes: from 3/4 of the payload down, until the relay takes the post.
  const sealedAsk = function (len) {
    const q = ('abcdefghij ').repeat(Math.ceil(len / 11)).slice(0, len);
    // goal/G49.25, box v27 ("one shape for every request to a relay"): the relay's own search is its call, spirit.relay.search,
    // the text the same call { call, args } (was the ask { v: 1, body: { search } }).
    const sealed = seal.seal(box.relaySealKey(), LS.asker.publicKey, relayKey, JSON.stringify({ call: 'spirit.relay.search', args: { q: q } }));
    return JSON.stringify(sealed);
  };
  let len = Math.floor(limits.PAYLOAD_MAX * 3 / 4); let text = sealedAsk(len);
  while (len > 1000 && Buffer.byteLength(text, 'utf8') > limits.PAYLOAD_MAX) { len -= 250; text = sealedAsk(len); }
  LS.len = len; LS.text = text;
  return len >= 12000;
}, test.limit.quick);
test.run('the relay takes the search', 0.2, async function () {
  if (!LS.text) return false;
  const box = LS.box; const asker = LS.asker; const relayKey = box.relayPublicKey(); const text = LS.text;
  let last = Date.now(); let gap = 0;
  const tick = setInterval(function () { const t = Date.now(); gap = Math.max(gap, t - last); last = t; }, 5);
  const before = LS.heard.length;
  const t0 = Date.now();
  // Asked by its verb's own call, named as the relay's server names it (goal/G49.25; spirit/relay/server/script.js posted).
  LS.posted = box.routePost(asker.publicKey, relayKey, text, auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, relayKey, text)), undefined, undefined, 'spirit.relay.search');
  const inPost = Date.now() - t0;
  for (let i = 0; i < 200 && !LS.answered; i++) { await new Promise(function (r) { setTimeout(r, 25); }); LS.answered = LS.heard.length > before; }
  clearInterval(tick);
  LS.worst = Math.max(gap, inPost);
  LS.ran = true;
  return (!!LS.posted && LS.posted.ok !== false);
}, test.limit.slow);
test.run('while the relay searches, it keeps answering: its event loop never waited more than 250 ms', 0.2, function () {
  if (!LS.ran) return false;
  return LS.worst <= GAP_MS;
}, test.limit.quick);
test.run('the long search is answered', 0.2, function () {
  if (!LS.ran) return false;
  return LS.answered === true;
}, test.limit.quick);

// THE FACE COMES BACK BY ITSELF (goal/G43.30; Andy: "ALL, I had to, several times, refresh my new face, because it
// doesn't seem to auto-reconnect.", "all, FIX IT, IN THIS ITEM, then we tag."). The face retries only once its stream ends
// (spirit/shell/boot/script.js), so when the home node's feed into it goes, the relay ends the face's stream: the face opens it
// again, and the node hears face-open once more and feeds it. A real relay on a scratch copy (spirit/test/headLessChrome.js
// scratchFaceRelay), a member seated with a face, its node present and its face logged in; the face's stream and the
// home node's feed over HTTP, as the face and the node send them.
const http = require('http');
const H = S.requireScript('spirit/test/headLessChrome.js');
const F = { R: null, M: null, opened: [], face: null, one: null, two: null, again: null, three: null, opensNow: 0 };
// The face's own stream, as its page opens it (spirit/shell/boot/script.js): the call spirit.relay.faceEvents at the relay's one
// door, POST /spirit, its login cookie, on its own host, from its own page (goal/G49.25: GET /face/stream is gone).
function openFace() {
  return new Promise(function (resolve) {
    const f = { lines: [], ended: false, status: 0 };
    const body = JSON.stringify({ call: 'spirit.relay.faceEvents', args: {} });
    const req = http.request({ host: '127.0.0.1', port: F.R.port, path: '/spirit', method: 'POST', headers: { host: F.M.host, origin: 'https://' + F.M.host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), cookie: 'spirit_face=' + F.M.sid } }, function (res) {
      f.status = res.statusCode;
      res.setEncoding('utf8');
      res.on('data', function (d) { f.lines.push(d); });
      res.on('end', function () { f.ended = true; });
      res.on('close', function () { f.ended = true; });
    });
    req.on('error', function () { f.ended = true; });
    req.end(body);
    f.req = req;
    F.opened.push(f);
    // Its headers come with its first line, face-open answered or a refusal: the face is handed back at once.
    resolve(f);
  });
}
// The home node's long upload of the face's updates, as spirit/contact/faceHome/script.js sends it: the call spirit.relay.faceFeed named
// in its header at the one door, POST /spirit, signed for this relay and 'stream' (goal/G49.25: /spirit/relay/face/stream is gone).
function feed() {
  const R = F.R; const M = F.M;
  const req = http.request({ host: '127.0.0.1', port: R.port, path: '/spirit', method: 'POST',
    headers: { 'x-spirit-call': 'spirit.relay.faceFeed', 'x-spirit-from': M.publicKey, 'x-spirit-sig': R.auth.sign(M.privateKey, R.auth.faceMessage(M.publicKey, R.relayKey, 'stream')), 'transfer-encoding': 'chunked' } });
  req.on('error', function () { /* cut */ });
  req.flushHeaders();
  return req;
}
function faceOpens() { return F.R.lines.filter(function (l) { return l.stream === 'harbour' && /face-open/.test(l.line); }).length; }
function wait(fn, ms) { return H.until(function () { return Promise.resolve(fn()); }, ms || 5000); }

// a home node's feed gone: the relay ends its face's stream, so the face opens it again
test.run('a scratch relay comes up with harbour seated with a face, its node present and its face logged in', 0.2, async function () {
  F.R = await H.scratchFaceRelay({ members: ['harbour'] });
  if (!F.R.up) return false;
  F.M = F.R.members.harbour;
  return true;
}, test.limit.slow);
test.run('the face opens its stream, and the home node hears face-open', 0.2, async function () {
  if (!F.M) return false;
  const opensBefore = faceOpens();
  F.face = await openFace();
  return (await wait(function () { return faceOpens() > opensBefore; }) && !F.face.ended) || false;
}, test.limit.slow);
test.run('the home node\'s feed reaches the face', 0.2, async function () {
  if (!F.face) return false;
  F.one = feed();
  F.one.write(JSON.stringify({ event: 'zz-first', data: {} }) + '\n');
  return !!(await wait(function () { return F.face.lines.join('').indexOf('zz-first') !== -1; })) || false;
}, test.limit.slow);

// the attacker: a feed replaced by a newer one goes, and the face's stream stays
test.run('once the old feed is cut, the face\'s stream stays open and the newer feed still reaches it', 0.2, async function () {
  if (!F.one) return false;
  const face = F.face;
  F.two = feed();
  F.two.write(JSON.stringify({ event: 'zz-second', data: {} }) + '\n');
  await wait(function () { return face.lines.join('').indexOf('zz-second') !== -1; });
  F.one.destroy();
  await new Promise(function (r) { setTimeout(r, 1500); });
  F.two.write(JSON.stringify({ event: 'zz-third', data: {} }) + '\n');
  return (!face.ended && !!(await wait(function () { return face.lines.join('').indexOf('zz-third') !== -1; }))) || false;
}, test.limit.slow);

// the feed into the face goes, as when the home node goes away
test.run('the relay ends the face\'s stream: the face sees it end, and retries', 0.2, async function () {
  if (!F.two) return false;
  F.two.destroy();
  return !!(await wait(function () { return F.face.ended; }, 8000)) || false;
}, test.limit.slow);
test.run('the face opens its stream again, and the home node hears face-open once more', 0.2, async function () {
  if (!F.M) return false;
  const opensNow = faceOpens();
  F.again = await openFace();
  return (await wait(function () { return faceOpens() > opensNow; }) && !F.again.ended) || false;
}, test.limit.slow);
test.run('the home node\'s updates reach the face again, with no reload', 0.2, async function () {
  if (!F.again) return false;
  F.three = feed();
  F.three.write(JSON.stringify({ event: 'zz-back', data: {} }) + '\n');
  const heard = await wait(function () { return F.again.lines.join('').indexOf('zz-back') !== -1; });
  F.three.destroy();
  return !!heard || false;
}, test.limit.slow);

// THE ROUTE CACHING GOES (goal/G47.1, box v69; Andy: "the \"routes\" aren't read by anybody in the fucking system"): "The
// relay sends no route event after an exchange. Its announcement of a member stays for what the node still uses of it,
// the member's label and presence". Two members of a scratch relay, each on its stream as a node connects; A posts to B,
// B answers; what each stream hears from the answer on is kept.
const RX = { home: null, after: null, replied: null };
test.run('two members are on their streams, and one posts to the other, who answers', 0.2, async function () {
  RX.home = ownTemp('spirit-relay-route-');
  fs.mkdirSync(path.join(RX.home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(RX.home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(RX.home, owner.publicKey);
  const box = S.requireScript('spirit/relay/processor/script.js').createRelay(RX.home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  const heard = { A: [], B: [] };
  const ids = {};
  for (const n of ['A', 'B']) {
    const id = ids[n] = auth.generateIdentity(n);
    const minted = box.mint('owner', n, 7, '');
    if (!minted || !minted.invite) return false;
    const c = box.claim(n, auth.sign(id.privateKey, auth.claimMessage(n)), id.publicKey, null, minted.invite.token, n);
    if (!c || c.ok === false) return false;
    const st = box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, box.relayPublicKey())), { write: function (chunk) { heard[n].push(String(chunk)); return true; }, close: function () {} });
    if (st && st.ok === false) return false;
  }
  const text = 'hello B';
  const posted = await Promise.resolve(box.routePost(ids.A.publicKey, ids.B.publicKey, text, auth.sign(ids.A.privateKey, auth.postMessage(ids.A.publicKey, ids.B.publicKey, text)), 3000));
  if (!posted || !posted.hash) return false;
  const mark = { A: heard.A.length, B: heard.B.length };
  RX.replied = box.routeReply(ids.B.publicKey, posted.hash, 'ok', auth.sign(ids.B.privateKey, auth.receiptMessage(posted.hash, 'ok')));
  await new Promise(function (r) { setTimeout(r, 300); });
  RX.after = { A: heard.A.slice(mark.A).join(''), B: heard.B.slice(mark.B).join('') };
  return (!!RX.replied && RX.replied.ok === true && /event: reply/.test(RX.after.A)) || false;
}, test.limit.slow);
test.run('after an exchange the relay sends the asker no route event', 0.2, function () {
  if (!RX.after) return false;
  return !/event: route/.test(RX.after.A) || false;
}, test.limit.quick);
test.run('after an exchange the relay sends the answerer no route event', 0.2, function () {
  if (!RX.after) return false;
  return !/event: route/.test(RX.after.B) || false;
}, test.limit.quick);

test.after(function () {
  if (RX.home) { try { fs.rmSync(RX.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  if (W.R) { try { fs.rmSync(W.R.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  if (LS.home) { try { fs.rmSync(LS.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  F.opened.forEach(function (f) { try { f.req.destroy(); } catch (e) { /* gone */ } });
  if (F.R && F.R.stop) F.R.stop();
});

// THE FOLDER GOES LAST (goal/G48.4): registered after every other after hook, so the relays are shut and their stores
// closable before the folder is removed.
test.after(function () {
  const top = tempFolder.path('spirit/test/relay');
  closeStoresUnder(top);
  try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
