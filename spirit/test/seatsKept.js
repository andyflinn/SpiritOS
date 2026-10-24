'use strict';

// spirit/test/seatsKept.js
// goal/G19.1: seats kept on first connect; an evicted node told so in Natter.
//
// Asserts the item's SHAPE, item by item (Andy's record, v21):
//   1. relayKeys.accept merges: the seat a claim wrote survives the pin the
//      first stream writes, and the label reads back.
//   2. a 409 re-claim of this node's own key seats as a 2xx does; a claim
//      that succeeds clears a recorded refusal (the new invite brings it back).
//   3. peerPost, recognising a not-a-sender answer (on a post or on a reply),
//      writes the refusal and its time on that relay's row, closes exactly that
//      relay's stream, refuses every later post to it with a why, and streams
//      the refusal to the shell on the relay-presence job.
//   3c. the same, for a refused STREAM (granted 2026-10-12).
//   4. a start or restart opens no stream to a relay whose row holds a refusal.
//   5. Natter: the row says the relay refused this node, since when, that the
//      seat is gone and only a new invite brings it back, and offers Remove —
//      never on the last relay; relay.remove refuses the last public relay, and
//      a Remove gives up the seat (relayKeys.unseat).
//   6. an accepted rename writes the new label into that relay's seat row.
//   7. the relay refuses an unknown sender as "your id is not a valid sender
//      here", code not-a-sender, on the post, the reply and the stream.
//   8. natterDetails no longer reads c.peers or roll.roster.
//   9. the refusal and its time are two columns on node.db's relays row,
//      keyed by relay key (goal/G19.15's table), added to an older node.db.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const relayKeys = require('../run/spirit/relayKeys');
const ownerBadge = require('../run/spirit/ownerBadge');
const peerPost = require('../run/spirit/peerPost');
const spiritErrors = require('../run/spirit/spiritErrors');
const spirit = require('../run/spirit/kernel.js');

const OWED = 'OWED by goal/G19.1: ';
const RUN = path.join(__dirname, '..', 'run');
const WHY = 'your id is not a valid sender here';

function tmpHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seats-kept-')); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 20; i++) await settle(); }
function show(v) { return JSON.stringify(v); }
// The relay table is node.db's `relays`, keyed by relay key, read and
// written only through relayKeys (goal/G19.15); a url is passed for lookup.
function rowOf(home, url) { return relayKeys.listed(home).filter(function (r) { return r && r.url === url; })[0] || null; }
function keyRow(home, url) { return relayKeys.load(home)[relayKeys.normalizeUrl(url)] || null; }
function table() { return typeof relayKeys.refusal === 'function' ? relayKeys : null; }
function nodeRow(home, key) { return require('../run/spirit/nodeStore.js').open(home).relays.byKey(key); }
// A relay this node met at a claim: listed under its key, and seated.
function seated(home, url, label, relayKey, seatLabel) {
  relayKeys.list(home, url, label, relayKey);
  relayKeys.seat(home, url, seatLabel);
}
function signedKeyAnswer(rid, label) {
  return JSON.stringify({
    relayPublicKey: rid.publicKey, relaySealKey: rid.sealPublicKey, relayLabel: label,
    keySig: auth.sign(rid.privateKey, auth.relayKeyMessage(rid.publicKey, rid.sealPublicKey, label)),
  });
}
function stripComments(src) {
  return src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); }).join('\n');
}

test.startTest('goal/G19.1 — seats kept on first connect; an evicted node told so in Natter');

(async function () {
  // ── 1 ─────────────────────────────────────────────────────────────
  test.subHeading('1. accept merges: the seat survives the first stream\'s pin');
  {
    const home = tmpHome();
    const U = 'https://relay-one.example';
    const rid = auth.generateIdentity('relay-one');
    seated(home, U, 'one', rid.publicKey, 'jazz');
    // The first stream pins through answerRelay, exactly as presenceNode's pinRelay does.
    const answerer = require('../run/spirit/answerRelay').createAnswerer({
      rootDir: home,
      // The relay's card, as peerPost.relayKey resolves it (goal/G22.6).
      askKey: function () { return Promise.resolve(JSON.parse(signedKeyAnswer(rid, 'one'))); },
    });
    const key = await answerer.relayKey(U);
    const row = keyRow(home, U);
    if (key === rid.publicKey && row && row.publicKey === rid.publicKey && row.seat && row.seat.label === 'jazz') {
      test.check('the pin is written beside the seat, and the seat the claim wrote is still on the row');
    } else test.fail(OWED + 'after the first pin the row reads ' + show(row));
    if (relayKeys.seatLabel(home, U) === 'jazz') test.check('so the label the claim recorded still reads back');
    else test.fail(OWED + 'seatLabel after the first pin: ' + show(relayKeys.seatLabel(home, U)));
    // And what Natter's "You" row reads: the probe's myLabel and claimedLabel.
    const me = auth.generateIdentity('jazz');
    const summary = await ownerBadge.probe(home, function () {
      return Promise.resolve({ status: 200, text: signedKeyAnswer(rid, 'one') });
    }, me.publicKey);
    const b = summary.rows[0] || {};
    if (b.claimed && b.claimedLabel === 'jazz' && b.roll && b.roll.myLabel === 'jazz') {
      test.check('the probe reads the seat\'s label as myLabel and claimedLabel: no "You (unknown)"');
    } else test.fail(OWED + 'probe row after the first pin: ' + show(b));
  }

  // ── 2 ─────────────────────────────────────────────────────────────
  test.subHeading('2. a 409 re-claim of this node\'s own key seats; a claim that succeeds clears a refusal');
  {
    const home = tmpHome();
    const me = auth.generateIdentity('jazz');
    auth.saveIdentity(home, me);
    const rid = auth.generateIdentity('relay-two');
    let claimStatus = 409;
    // THE CLAIM GOES THROUGH THE NODE'S ROUTER (peerPost.claim, on the
    // relay's one door — goal/G22.6), so the relay is faked at that seam:
    // the answer it gives, and the key it is filed under.
    const router = {
      claim: function () {
        return Promise.resolve(claimStatus === 409
          ? { ok: false, status: 409, error: 'key already claimed', peer: { publicKey: me.publicKey, publicLabel: 'jazz' }, relayPublicKey: rid.publicKey }
          : { ok: true, status: 201, peer: { publicKey: me.publicKey, publicLabel: 'jazz' }, relayPublicKey: rid.publicKey });
      },
    };
    const server = { close: function () {} };
    const U = 'http://127.0.0.1:65009';
    const hub = require('../run/spirit/hub.js').createHub(home);
    function claim(name) {
      return new Promise(function (resolve) {
        const res = {
          status: 0, body: '',
          writeHead: function (s) { res.status = s; },
          end: function (b) { res.body = String(b || ''); resolve(res); },
          setHeader: function () {},
        };
        hub.handleClaim({}, res, function () { return Promise.resolve({ url: U, name: name }); }, { router: router });
      });
    }
    const first = await claim('jazz');
    await settled();
    if (first.status === 409 && relayKeys.seatLabel(home, U) === 'jazz') {
      test.check('a 409 for this node\'s own key records the seat, label and all, as a 2xx does');
    } else test.fail(OWED + 'after a 409 re-claim (status ' + first.status + ') the seat row reads ' + show(keyRow(home, U)));
    if (table() && typeof table().refuse === 'function') {
      table().refuse(home, rid.publicKey, 'not-a-sender', Date.parse('2026-10-12T10:00:00.000Z'));
      if (table().refusal(home, U)) test.check('a refusal is written on the row by the relay\'s key, and read back by its url');
      else test.fail(OWED + 'refuse by key wrote nothing: ' + show(keyRow(home, U)));
      claimStatus = 201;
      await claim('jazz');
      await settled();
      const after = table().refusal(home, U);
      if (!after) test.check('a claim that succeeds (a new invite) clears the refusal on that relay\'s row');
      else test.fail(OWED + 'the refusal survived a successful claim: ' + show(after));
    } else test.fail(OWED + 'relayKeys has no refuse/refusal/clearRefusal on the keyed table');
    server.close();
  }

  // ── 3, 4, 6 ───────────────────────────────────────────────────────
  test.subHeading('3. not-a-sender on a post: the row, exactly that stream, later posts, the shell');
  const A = 'https://relay-a.example';
  const B = 'https://relay-b.example';
  const C = 'https://relay-c.example';
  const home = tmpHome();
  const me = auth.generateIdentity('jazz');
  auth.saveIdentity(home, me);
  const rA = auth.generateIdentity('a'), rB = auth.generateIdentity('b'), rC = auth.generateIdentity('c');
  const peer = auth.generateIdentity('peer');
  const relayIds = {}; relayIds[A] = rA; relayIds[B] = rB; relayIds[C] = rC;
  [[A, 'a'], [B, 'b'], [C, 'c']].forEach(function (p) { seated(home, p[0], p[1], relayIds[p[0]].publicKey, 'jazz'); });
  const sealOf = {}; sealOf[peer.publicKey] = peer.sealPublicKey;
  [rA, rB, rC].forEach(function (r) { sealOf[r.publicKey] = r.sealPublicKey; });

  const sent = [];
  let renameAnswer = { ok: true, status: 200, label: 'jasmine' };
  function fakeRequest(url, method, pathname, body) {
    sent.push({ url: url, path: pathname, body: body });
    if (pathname === '/api/relay/post' && url === A) {
      return Promise.resolve({ status: 403, text: JSON.stringify({ error: WHY, code: 'not-a-sender' }) });
    }
    if (pathname === '/api/relay/reply' && url === C) {
      return Promise.resolve({ status: 403, text: JSON.stringify({ error: WHY, code: 'not-a-sender' }) });
    }
    if (pathname === '/api/relay/post' && url === B && body && body.to === rB.publicKey) {
      // The relay answers its own verb on the post itself, signed by its own key.
      const hash = auth.requestHash(auth.postMessage(body.from, body.to, body.text));
      const text = JSON.stringify({ v: 1, body: renameAnswer });
      return Promise.resolve({ status: 200, text: JSON.stringify({
        hash: hash, from: rB.publicKey, text: text, sig: auth.sign(rB.privateKey, auth.receiptMessage(hash, text)),
      }) });
    }
    return Promise.resolve({ status: 202, text: JSON.stringify({ ok: true, grantedMs: 50 }) });
  }
  function keyProbe(url) {
    return Promise.resolve({ status: 200, text: signedKeyAnswer(relayIds[url], 'r') });
  }
  function fakeJobs() {
    const j = { updates: [], job: null };
    j.createJob = function (kind, type, data) { j.job = { id: 'job_p', kind: kind, type: type, data: data }; return j.job; };
    j.updateJob = function (id, patch) { if (patch && patch.data) Object.assign(j.job.data, patch.data); j.updates.push(patch); return j.job; };
    return j;
  }
  function boot() {
    const jobs = fakeJobs();
    const opened = {};
    const closed = {};
    const P = peerPost.createPeerPost({
      rootDir: home, request: fakeRequest, waitMs: 200,
      sealKeyFor: function (k) { return sealOf[k] || ''; },
    });
    P.holdStreams({
      jobs: jobs,
      connectImpl: function (o) {
        const u = String(o.url).split('/api/relay/stream')[0];
        opened[u] = (opened[u] || 0) + 1;
        return { close: function () { closed[u] = (closed[u] || 0) + 1; } };
      },
    });
    return { P: P, jobs: jobs, opened: opened, closed: closed };
  }

  const n = boot();
  await n.P.startStreams(keyProbe);
  await settled();
  if (n.opened[A] === 1 && n.opened[B] === 1 && n.opened[C] === 1) test.check('the fixture holds a stream to each of three relays');
  else test.fail('fixture: streams opened ' + show(n.opened));

  const before = Date.now();
  const refused = await n.P.post(A, peer.publicKey, 'hello');
  await settled();
  if (refused && !refused.ok && refused.code === 'not-a-sender') test.check('the post is answered not-a-sender');
  else test.fail(OWED + 'the post to the refusing relay answered ' + show(refused));
  const recorded = table() && table().refusal ? table().refusal(home, A) : null;
  const atMs = recorded ? Date.parse(recorded.at) : NaN;
  if (recorded && recorded.code === 'not-a-sender' && atMs >= before - 1000 && atMs <= Date.now() + 1000) {
    test.check('the refusal and its time are written on that relay\'s row in the relay table');
  } else test.fail(OWED + 'the relay table holds for A: ' + show(recorded) + ' (listed row ' + show(rowOf(home, A)) + ')');
  const rowA = nodeRow(home, rA.publicKey);
  if (rowA && rowA.refusal === 'not-a-sender' && rowA.refusedAt === (recorded && recorded.at)) {
    test.check('both are two columns on node.db\'s relays row under A\'s key');
  } else test.fail(OWED + 'node.db row for A\'s key: ' + show(rowA));
  if (n.closed[A] === 1 && !n.closed[B] && !n.closed[C]) test.check('exactly that relay\'s stream is closed, and no other');
  else test.fail(OWED + 'streams closed: ' + show(n.closed));

  const sentToA = sent.filter(function (s) { return s.url === A; }).length;
  const again = await n.P.post(A, peer.publicKey, 'hello again');
  await settled();
  const sentToAAfter = sent.filter(function (s) { return s.url === A; }).length;
  if (again && !again.ok && sentToAAfter === sentToA && /refused this node/.test(String(again.error || '')) && /invite/.test(String(again.error || ''))) {
    test.check('a later post to that relay is refused before anything is sent, saying why: ' + again.error);
  } else test.fail(OWED + 'a later post to A: ' + show(again) + ', requests to A ' + sentToA + ' -> ' + sentToAAfter);
  const toB = await n.P.post(B, peer.publicKey, 'hello b');
  if (toB && toB.code !== 'not-a-sender' && sent.some(function (s) { return s.url === B && s.path === '/api/relay/post'; })) {
    test.check('a post to another relay still goes');
  } else test.fail(OWED + 'post to B: ' + show(toB));

  const streamed = n.jobs.updates.filter(function (u) { return u && u.data && u.data.refused && u.data.refused[A]; }).pop();
  if (streamed && streamed.data.refused[A].code === 'not-a-sender' && streamed.data.refused[A].at === (recorded && recorded.at)) {
    test.check('the refusal is streamed to the shell on the relay-presence job (data.refused, by relay url)');
  } else test.fail(OWED + 'job updates carry no refusal for A: ' + show(n.jobs.updates.map(function (u) { return u && u.data && Object.keys(u.data); })));

  test.subHeading('3b. not-a-sender on a reply: recognised the same way');
  {
    // A card ask arriving down C's stream; the node answers it, and C refuses the reply.
    const asker = auth.generateIdentity('asker');
    const text = JSON.stringify({ v: 1, body: { card: true } });
    const sig = auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, me.publicKey, text));
    await n.P.onRequest(C, { from: asker.publicKey, to: me.publicKey, text: text, sig: sig });
    await settled();
    const onC = table() && table().refusal ? table().refusal(home, C) : null;
    if (onC && onC.code === 'not-a-sender' && n.closed[C] === 1 && !n.closed[B]) {
      test.check('a reply refused not-a-sender writes C\'s row and closes C\'s stream, B untouched');
    } else test.fail(OWED + 'after C refused a reply: row ' + show(onC) + ', closed ' + show(n.closed));
  }

  test.subHeading('3c. not-a-sender on a STREAM: recognised the same way (the stream half, granted 2026-10-12)');
  {
    const D = 'https://relay-d.example', E = 'https://relay-e.example';
    const hS = tmpHome();
    auth.saveIdentity(hS, auth.generateIdentity('jazz'));
    const ids = {}; ids[D] = auth.generateIdentity('d'); ids[E] = auth.generateIdentity('e');
    seated(hS, D, 'd', ids[D].publicKey, 'jazz');
    seated(hS, E, 'e', ids[E].publicKey, 'jazz');
    function probeDE(url) { return Promise.resolve({ status: 200, text: signedKeyAnswer(ids[url], 'r') }); }
    function bootS() {
      const jobs = fakeJobs();
      const opened = {}, closed = {}, opts = {};
      const P = peerPost.createPeerPost({ rootDir: hS, request: fakeRequest, waitMs: 200, sealKeyFor: function () { return ''; } });
      P.holdStreams({
        jobs: jobs,
        connectImpl: function (o) {
          const u = String(o.url).split('/api/relay/stream')[0];
          opened[u] = (opened[u] || 0) + 1;
          opts[u] = o;
          return { close: function () { closed[u] = (closed[u] || 0) + 1; } };
        },
      });
      return { P: P, jobs: jobs, opened: opened, closed: closed, opts: opts };
    }
    const s = bootS();
    await s.P.startStreams(probeDE);
    await settled();
    if (s.opts[D] && typeof s.opts[D].onClose === 'function') {
      // What sseClient hands onClose when the relay refuses the stream.
      s.opts[D].onClose('refused: 403', { status: 403, code: 'not-a-sender', error: WHY });
      await settled();
    }
    const onD = relayKeys.refusal ? relayKeys.refusal(hS, D) : null;
    if (onD && onD.code === 'not-a-sender') test.check('a refused stream writes the refusal and its time on that relay\'s row');
    else test.fail(OWED + 'after D refused the stream: row ' + show(onD));
    if (s.closed[D] === 1 && !s.closed[E]) test.check('exactly that stream is closed, so sseClient does not redial it; E\'s stream untouched');
    else test.fail(OWED + 'streams closed after a refused stream: ' + show(s.closed));
    const told = s.jobs.updates.filter(function (u) { return u && u.data && u.data.refused && u.data.refused[D]; }).pop();
    if (told) test.check('and the shell is told on the relay-presence job');
    else test.fail(OWED + 'no refusal for D streamed to the shell');
    s.opts[E].onClose('refused: 503', { status: 503, code: '', error: 'full' });
    await settled();
    if (!s.closed[E] && !(relayKeys.refusal && relayKeys.refusal(hS, E))) test.check('a stream refused for another reason (503) is left to retry, and nothing is written');
    else test.fail('a 503 on E closed it or wrote a refusal: ' + show(s.closed));
    const s2 = bootS();
    await s2.P.startStreams(probeDE);
    await settled();
    if (!s2.opened[D] && s2.opened[E] === 1) test.check('a restart dials E and not D');
    else test.fail(OWED + 'streams opened after a restart: ' + show(s2.opened));

    // sseClient's half: the refusal's code and sentence reach onClose, and a close there stops the retry.
    const sse = require('../run/spirit/sseClient');
    let fetches = 0, detailSeen = null, handle = null;
    await new Promise(function (resolve) {
      handle = sse.connect({
        url: D + '/api/relay/stream?key=k',
        fetchImpl: function () {
          fetches += 1;
          return Promise.resolve({ ok: false, status: 403, body: null, headers: { get: function () { return null; } },
            text: function () { return Promise.resolve(JSON.stringify({ error: WHY, code: 'not-a-sender' })); } });
        },
        setTimeoutImpl: function (fn) { setImmediate(fn); return 1; }, clearTimeoutImpl: function () {},
        idleTimeoutImpl: function () { return 1; }, idleClearTimeoutImpl: function () {},
        onClose: function (reason, detail) { detailSeen = detail; handle.close(); resolve(); },
      });
    });
    await settled();
    if (detailSeen && detailSeen.status === 403 && detailSeen.code === 'not-a-sender' && detailSeen.error === WHY && fetches === 1) {
      test.check('sseClient hands onClose the relay\'s status, code and sentence; closed there, it does not dial again');
    } else test.fail(OWED + 'sseClient onClose detail ' + show(detailSeen) + ', fetches ' + fetches);
  }

  test.subHeading('4. a restart opens no stream to a relay whose row holds a refusal');
  {
    const m = boot();
    await m.P.startStreams(keyProbe);
    await settled();
    if (!m.opened[A] && !m.opened[C] && m.opened[B] === 1) test.check('after a restart only B is dialled; A and C are not');
    else test.fail(OWED + 'streams opened after a restart: ' + show(m.opened));
    const summary = await ownerBadge.probe(home, keyProbe, me.publicKey);
    const ra = summary.rows.filter(function (r) { return r.url === A; })[0] || {};
    if (summary.claimedUrls.indexOf(A) === -1 && ra.refused && ra.refused.code === 'not-a-sender' && !ra.claimed) {
      test.check('the probe lists A with its refusal, not as claimed, and leaves it out of claimedUrls');
    } else test.fail(OWED + 'probe of A: ' + show(ra) + ', claimedUrls ' + show(summary.claimedUrls));
  }

  test.subHeading('6. an accepted rename writes the new label into that relay\'s seat row');
  {
    const said = await n.P.post(B, rB.publicKey, JSON.stringify({ app: 'relay', v: 1, body: { rename: { label: 'jasmine' } } }));
    await settled();
    if (said && said.ok && relayKeys.seatLabel(home, B) === 'jasmine') {
      test.check('the relay said yes, and the seat on B\'s row now reads jasmine');
    } else test.fail(OWED + 'after an accepted rename: answer ' + show(said && { ok: said.ok, text: said.text }) + ', seat label ' + show(relayKeys.seatLabel(home, B)));
    renameAnswer = { ok: false, status: 409, error: 'name reserved by a live invite' };
    await n.P.post(B, rB.publicKey, JSON.stringify({ app: 'relay', v: 1, body: { rename: { label: 'other' } } }));
    await settled();
    if (relayKeys.seatLabel(home, B) === 'jasmine') test.check('a refused rename writes nothing');
    else test.fail(OWED + 'a refused rename moved the seat label to ' + show(relayKeys.seatLabel(home, B)));
  }

  // ── 5 ─────────────────────────────────────────────────────────────
  // NATTER RETIRED (goal/G30.7): natterDetails asks the remove rule itself (ownerBadge.removalRefusal over the rows
  // its probe brings) and performs a Remove through relay.remove; nobody hands it canRemove.
  test.subHeading('5. natterDetails: the refused row, and Remove');
  {
    const at = '2026-10-12T09:30:00.000Z';
    const refusedRow = { url: A, label: 'a', status: 200, owned: false, claimed: false,
      refused: { code: 'not-a-sender', why: WHY, at: at } };
    const another = { url: 'https://other.example', label: 'other', status: 200, owned: false, claimed: false };
    const shown = mountDetails(refusedRow, [refusedRow, another]);
    await settled();
    const html = shown.body().innerHTML;
    const says = {
      refused: /refused this node/.test(html),
      since: html.indexOf(new Date(at).toLocaleString()) !== -1 || html.indexOf(at.slice(0, 10)) !== -1,
      seatGone: /seat (here )?is gone/.test(html),
      invite: /new invite/.test(html),
      remove: /nd-remove/.test(html),
    };
    if (says.refused && says.since && says.seatGone && says.invite) {
      test.check('natterDetails says the relay refused this node, since when, that the seat is gone and only a new invite brings it back');
    } else test.fail(OWED + 'natterDetails on a refused row says ' + show(says));
    if (says.remove) test.check('and offers Remove while another public relay stays listed');
    else test.fail(OWED + 'no Remove offered on a refused row');
    const last = mountDetails(refusedRow, [refusedRow]);
    await settled();
    if (!/nd-remove/.test(last.body().innerHTML) && /public relay/.test(last.body().innerHTML)) {
      test.check('on the last relay there is no Remove, and the screen says why');
    } else test.fail(OWED + 'last relay: Remove offered ' + /nd-remove/.test(last.body().innerHTML));
    // Two presses, then relay.remove from the screen itself.
    const btn = removeTarget();
    shown.body().fire('click', { target: btn });
    shown.body().fire('click', { target: btn });
    await settled();
    const asked = shown.asked.filter(function (v) { return v && v.verb === 'relay.remove'; })[0];
    const closed = shown.answers.filter(function (x) { return x && x.removed; })[0];
    if (asked && asked.key === A && closed && closed.url === A) test.check('two presses send relay.remove for that relay and close the screen');
    else test.fail(OWED + 'Remove asked ' + show(shown.asked) + ', answered ' + show(shown.answers));

    // The node's half: relay.remove refuses the last public relay, and a Remove gives up the seat.
    const h2 = tmpHome();
    const ONLY = ownerBadge.KEPT_RELAY.url, OTHER = 'https://other.example';
    relayKeys.assertSeeds(h2, ownerBadge.SEED_RELAYS);
    seated(h2, OTHER, 'o', rA.publicKey, 'jazz');
    const hub2 = require('../run/spirit/hub.js').createHub(h2);
    const kept = hub2.relayRemove({ key: ONLY });
    if (!kept.ok) test.check('relay.remove refuses the relay a node must keep: ' + kept.error);
    else test.fail('relay.remove took the kept relay');
    // A seat the relay still honours blocks the removal (goal/G30.7, Andy: "you must remove yourself from this relay
    // before you can remove the relay from your contacts"); one it refused is gone already, and Remove clears its record.
    const held = hub2.relayRemove({ key: OTHER });
    if (!held.ok && held.error === 'you must remove yourself from this relay before you can remove the relay from your contacts')
      test.check('relay.remove refuses a relay this node holds a seat on, with the sentence');
    else test.fail(OWED + 'removing a seated relay answered ' + show(held));
    relayKeys.refuse(h2, OTHER, 'not-a-sender');
    const gone = hub2.relayRemove({ key: OTHER });
    const kr = keyRow(h2, OTHER);
    if (gone.ok && kr && !kr.seat && kr.publicKey === rA.publicKey) test.check('a relay that refused this node comes off the list: the seat record goes (relayKeys.unseat), the pin stays');
    else test.fail(OWED + 'after relay.remove: ' + show(gone) + ', relayKeys row ' + show(kr));
  }

  // ── 7 ─────────────────────────────────────────────────────────────
  test.subHeading('7. the relay names the sender, not the recipient: not-a-sender on post, reply and stream');
  {
    const world = require('./world');
    const scenario = require('./scenario');
    const made = world.build(scenario.OWNER_ONLY);
    const box = made.box;
    const stranger = auth.generateIdentity('stranger');
    // TO A KEY NOBODY HOLDS HERE. Since goal/G22.6 a relay carries posts to
    // its own members from any sender (Andy: "a relay carries posts to its
    // members from any relay"), so a stranger posting to the OWNER is read
    // and its signature checked; only a packet for somebody this relay does
    // not hold needs a known sender, and that one is refused by name.
    const p = box.routePost(stranger.publicKey, auth.generateIdentity('nobody').publicKey, 'x', 'sig');
    const r = box.routeReply(stranger.publicKey, 'HASH', 'x', 'sig');
    const s = box.streamOpen(stranger.publicKey, 'sig', function () {});
    [['post', p], ['reply', r], ['stream', s]].forEach(function (pair) {
      const out = pair[1] || {};
      if (!out.ok && out.status === 403 && out.error === WHY) test.check(pair[0] + ': 403 "' + WHY + '"');
      else test.fail(OWED + pair[0] + ' answered ' + show(out));
    });
    const c = spiritErrors.classify(403, WHY);
    if (c.code === 'not-a-sender' && !spiritErrors.byCode('no-such-identity')) {
      test.check('the catalogue reads it as not-a-sender, and no-such-identity is gone');
    } else test.fail(OWED + 'catalogue: ' + c.code + ', no-such-identity still defined ' + !!spiritErrors.byCode('no-such-identity'));
  }

  // ── 9 ─────────────────────────────────────────────────────────────
  test.subHeading('9. a node.db made before the refusal columns gains them, rows kept');
  {
    const h3 = tmpHome();
    fs.mkdirSync(path.join(h3, 'relay-state'), { recursive: true });
    const raw = new (require('node:sqlite').DatabaseSync)(path.join(h3, 'relay-state', 'node.db'));
    raw.exec(`CREATE TABLE relays (key TEXT PRIMARY KEY, url TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      listed INTEGER NOT NULL DEFAULT 0, pos INTEGER NOT NULL DEFAULT 0, firstSeen TEXT NOT NULL DEFAULT '',
      acceptedAt TEXT NOT NULL DEFAULT '', replaced TEXT NOT NULL DEFAULT '', seatLabel TEXT NOT NULL DEFAULT '',
      seatClaimedAt TEXT NOT NULL DEFAULT '')`);
    raw.prepare("INSERT INTO relays (key, url, label, listed, seatLabel, seatClaimedAt) VALUES (?, ?, 'old', 1, 'jazz', '2026-10-12T08:00:00.000Z')")
      .run('OLDKEY', 'https://old.example');
    raw.close();
    const kept = relayKeys.seatLabel(h3, 'https://old.example');
    const wrote = typeof relayKeys.refuse === 'function' && relayKeys.refuse(h3, 'OLDKEY', 'not-a-sender');
    const back = typeof relayKeys.refusal === 'function' ? relayKeys.refusal(h3, 'OLDKEY') : null;
    if (kept === 'jazz' && wrote && back && back.code === 'not-a-sender') {
      test.check('the old row reads back and takes a refusal');
    } else test.fail(OWED + 'old node.db: seat ' + show(kept) + ', refuse ' + show(wrote) + ', refusal ' + show(back));
  }

  // ── 8 ─────────────────────────────────────────────────────────────
  test.subHeading('8. natterDetails reads only what the probe sets');
  {
    const src = stripComments(fs.readFileSync(path.join(RUN, 'shell', 'natterDetails', 'natterDetails.js'), 'utf8'));
    const reads = { 'c.peers': /\bc\.peers\b/.test(src), roster: /\.roster\b/.test(src) };
    if (!reads['c.peers'] && !reads.roster) test.check('no c.peers and no roll.roster: neither is set by the probe');
    else test.fail(OWED + 'natterDetails still reads ' + show(reads));
  }
})().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(process.exitCode || 0); }, 20).unref();
});

// ── natterDetails, mounted on stubs (the way natterDetails.js mounts it) ──
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', className: '', style: {}, dataset: {}, children: [], listeners: {},
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    getAttribute: function () { return null; }, setAttribute: function () {}, querySelector: function () { return null; },
    appendChild: function (c) { el.children.push(c); return c; },
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function removeTarget() {
  const attrs = {};
  const node = {
    textContent: 'Remove', disabled: false,
    getAttribute: function (n) { return attrs[n] === undefined ? null : attrs[n]; },
    setAttribute: function (n, v) { attrs[n] = v; },
    removeAttribute: function (n) { delete attrs[n]; },
  };
  node.closest = function (sel) { return sel === '.nd-remove' ? node : null; };
  return node;
}
function mountDetails(row, rows) {
  const elements = Object.create(null);
  const asked = [];
  const doc = { getElementById: function (id) { return elements[id] || (elements[id] = fakeElement(id)); } };
  const fakeFetch = function (url, init) {
    let verb = '';
    try { verb = JSON.parse(String((init && init.body) || '{}')).verb || ''; } catch (e) { verb = ''; }
    asked.push(JSON.parse(String((init && init.body) || '{}')));
    const text = verb === 'relay.status' ? JSON.stringify({ rows: rows || [row], relayStatus: {} })
      : verb === 'relay.remove' ? JSON.stringify({ ok: true, key: row.url }) : '{}';
    return Promise.resolve({ status: 200, text: function () { return Promise.resolve(text); }, json: function () { return Promise.resolve(JSON.parse(text)); } });
  };
  let behavior = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; }, factRow: function () { return ''; } },
    core: {
      ask: test.browserAsk(fakeFetch), relays: test.browserRelays(test.browserAsk(fakeFetch)),
      util: { escapeHtml: spirit.core.util.escapeHtml }, const: { ICON: spirit.core.const.ICON },
    },
  };
  new Function('spirit', 'document', 'window', 'fetch', 'setInterval', 'clearInterval', 'navigator',
    fs.readFileSync(path.join(RUN, 'shell', 'natterDetails', 'natterDetails.js'), 'utf8'))(
    shellSpirit, doc, test.withSpirit({ 'spirit.ownerBadge': require('../run/spirit/ownerBadge') }), fakeFetch, function () { return 1; }, function () {}, {});
  const answers = [];
  const api = {
    verb: function (name, args) {
      const payload = Object.assign({ verb: String(name) }, args || {});
      return fakeFetch('/api/spirit', { body: JSON.stringify(payload) }).then(function (r) {
        return r.text().then(function (t) { return { status: r.status, text: t, body: JSON.parse(t) }; });
      });
    },
    escapeHtml: spirit.core.util.escapeHtml, isVisible: function () { return true; },
    peerPost: function () { return Promise.resolve({ ok: false }); },
    setDialogResult: function (r) { answers.push(r); }, closeDialog: function (r) { answers.push(r); },
    onRelayEvent: function () { return function () {}; }, setScreenTitle: function () {},
  };
  behavior.mount(fakeElement('container'), api);
  behavior.open({ url: row.url, label: 'jazz', relayLabel: row.label });
  return { body: function () { return doc.getElementById('nd-body'); }, answers: answers, asked: asked };
}
