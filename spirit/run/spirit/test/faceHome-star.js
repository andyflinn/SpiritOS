'use strict';

// spirit/run/spirit/test/faceHome-star.js
// THE STAR, END TO END (goal/G41.30; Andy: "why does no test assert the fix?", "wsl? do it."; "your face on a relay you
// own gets everything back, jobs, files, grants, puppets, under your login as it is now."; "so this button will put the star on relays and puppets. AND take it away."). spirit/test/
// faceHome.js stands in for "did this node set a face" and "is this relay starred"; here nothing of the node is stood in.
// A real scratch node joins real scratch relays by their mail, sets a face and logs in, and every call is what a page
// sends: POST /face/call with its cookie, its Origin and json. Only the relay's mailer keeps its mail. A step that could
// not run is red, never skipped.
// GOAL/G43.18, BOX V29, "A face is whole, or there is none" (Andy: "we remove ALL the star shit, like this,", "on the home
// node, NO face is offered (faceForm hides itself) for a relay without star."): "The home node answers a face only from a
// starred relay, one check; a face it answers is a full face.", "A star taken off a relay that has a face takes that face
// away (Q21).", "Starring is never asked from a face (contact.own)". So the half face of G41.30 and G41.33 is gone here:
// without the star the face gets no answer and no stream at all.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..','..');
const http = require('http');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

const WAIT_MS = 1500;
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

// The node's own loopback door, as the owner at home.
async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// One POST as a page sends it, at the face's own host.
function page(relay, name, p, body, sid) {
  return new Promise(function (resolve) {
    const b = JSON.stringify(body);
    const host = name + '.relay.example';
    const headers = { Host: host, Origin: 'https://' + host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) };
    if (sid) headers.Cookie = 'spirit_face=' + sid;
    const t = setTimeout(function () { q.destroy(); resolve({ status: 0, text: 'no answer in 15 s' }); }, 15000);
    const q = http.request({ host: '127.0.0.1', port: relay.port, path: p, method: 'POST', headers: headers }, function (r) {
      let text = ''; r.on('data', function (d) { text += d; });
      r.on('end', function () { clearTimeout(t); resolve({ status: r.statusCode, text: text, body: parsed(text), cookie: String(r.headers['set-cookie'] || '') }); });
    });
    q.on('error', function (e) { clearTimeout(t); resolve({ status: 0, text: String(e && e.message) }); });
    q.end(b);
  });
}
const MAIL = 'bert@example.org';

// A real join: the node asks, the relay mails, the node confirms with the mail's code.
async function join(N, R) {
  const added = await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
  if (added.status !== 200) return 'relay.add answered ' + added.status + ' ' + short(added.text);
  const asked = await home(N.base, 'relay.join', { url: R.base, email: MAIL });
  if (asked.status >= 300) return 'relay.join answered ' + asked.status + ' ' + short(asked.text);
  await until(function () { return R.mailed.length > 0; }, 5000);
  const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
  if (!code) return 'the relay mailed no join code';
  const done = await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
  if (done.status >= 300) return 'the confirm answered ' + done.status + ' ' + short(done.text);
  return '';
}
// relay.face at home; the first ask may still be waiting for the relay's card.
async function setFace(N, R, name) {
  let f = null;
  for (let i = 0; i < 10; i++) {
    f = await home(N.base, 'relay.face', { url: R.base, name: name });
    if (f.status === 200) return '';
    await sleep(2000);
  }
  return 'relay.face answered ' + f.status + ' ' + short(f.text);
}
// The face's login: the member's email, then the token the mail holds.
async function logIn(R, name) {
  let state = null;
  await until(function () { return page(R, name, '/face/api', { call: 'state', args: {} }).then(function (s) { state = s; return s.status === 200; }); }, 15000);
  if (!state || state.status !== 200) return { why: 'the face did not open: ' + (state ? state.status + ' ' + short(state.text) : 'no answer') };
  const from = R.mailed.length;
  await page(R, name, '/face/api', { call: 'login', args: { text: MAIL } });
  await until(function () { return R.mailed.length > from; }, 5000);
  const mail = R.mailed[from];
  const token = mail && String(mail.text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return /^[A-Za-z0-9_-]{16,}$/.test(l); })[0];
  if (!token) return { why: 'the relay mailed no login token' };
  const done = await page(R, name, '/face/api', { call: 'login', args: { text: token } });
  const sid = ((/spirit_face=([^;]+)/.exec(done.cookie)) || [])[1];
  return sid ? { sid: sid } : { why: 'the token logged nobody in: ' + short(done.text) };
}
// Refused: an answer that is no answer, whatever its code (box v29 names none).
const refused = function (a) { return a.status >= 400 && a.status < 500; };

test.startTest('faceHome-star.js: the star on a real node, a real relay and a real face (goal/G41.30)');

(async function () {
  const marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-star-marks-'));
  const relays = [];
  const N = await scratchNode();
  try {
    if (!N.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const run = path.join(N.root, 'spirit', 'run');
    const card = await home(N.base, 'node.card');
    const me = card.body && card.body.publicKey;
    ok(!!me, 'the node says its key', 'node.card: ' + short(card.text));
    if (!me) return;

    // A process this node includes: it leaves a mark only when started with the word a face call gives it.
    const mark = path.join(marks, 'ran');
    const script = path.join(run, 'process/js/zzStar/zzStar.js');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, 'if (process.argv[2] === "fromTheFace") require("fs").writeFileSync(' + JSON.stringify(mark) + ', "ran");\n');
    fs.writeFileSync(path.join(run, 'process/js/zzStar/zzStar.json'), JSON.stringify({ label: 'zz' }));
    const state = path.join(run, 'relay-state/process/zzStar');
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, 'zzStar.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
    const SAVED = 'process/js/zzStar/saved.txt';
    const savedAt = path.join(run, SAVED);
    const JOB = { call: 'jobs.create', args: { command: process.execPath, args: ['process/js/zzStar/zzStar.js', 'fromTheFace'] } };
    const SAVE = { call: 'fs.save', args: { path: SAVED, content: 'from the face' } };
    const nobody = 'MCowBQYDK2VwAyEA' + 'zzStarNobodyzzStarNobodyzzStarNobodyzzStarNob'.slice(0, 43) + '=';
    const OWNER = { call: 'owner.command', args: { to: nobody, command: 'zzNothing' } };

    // ── A RELAY OF SOMEBODY ELSE'S, A FACE THIS NODE ASKED FOR ──
    const R = await scratchFaceRelay({ members: [] });
    relays.push(R);
    ok(R.up, 'a real relay comes up', 'the scratch relay did not come up: nothing judged');
    if (!R.up) return;
    const why1 = await join(N, R) || await setFace(N, R, 'harbour');
    ok(!why1, 'the node joins it by its mail and sets a face', 'the join or the face failed, nothing judged: ' + why1);
    if (why1) return;
    const L = await logIn(R, 'harbour');
    ok(!!L.sid, 'the face logs in by the mailed token', 'the login failed, nothing judged: ' + L.why);
    if (!L.sid) return;
    const face = function (req) { return page(R, 'harbour', '/face/call', req, L.sid); };
    const starOf = async function (key) { const a = await home(N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === key; })); };

    test.subHeading('box v29: no star, no face: "The home node answers a face only from a starred relay"');
    ok(!(await starOf(R.relayKey)), 'the relay has no star', 'the relay has a star nobody pressed');
    // Not even the plainest read: there is no half face left to answer.
    for (const q of [{ call: 'node.card', args: {} }, { call: 'fs.FS.path', args: { path: 'data.js' } }, { call: 'contact.search', args: { q: '' } }, JOB, SAVE, OWNER]) {
      const a = await face(q);
      ok(refused(a), q.call + ' from the face is refused', q.call + ' from the face on a relay with no star: ' + a.status + ' ' + short(a.text));
    }
    await sleep(WAIT_MS);
    ok(!fs.existsSync(mark), 'the job did not run', 'jobs.create from the face RAN, with no star');
    ok(!fs.existsSync(savedAt), 'the file was not written', 'fs.save from the face WROTE a file, with no star');

    test.subHeading('the star on, pressed at home: everything is back');
    const on = await home(N.base, 'contact.own', { key: R.relayKey, own: true });
    ok(on.status === 200 && (await starOf(R.relayKey)), 'contact.own at home puts the star on the relay\'s row', 'contact.own at home: ' + on.status + ' ' + short(on.text));
    const o1 = await face(OWNER);
    test.comment('owner.command, starred, answered ' + o1.status + ' ' + short(o1.text));
    ok(o1.status !== 0 && !/not-from-the-face|no-face-here/.test(o1.text), 'owner.command from the face reaches the door', 'owner.command on a starred relay: ' + o1.status + ' ' + short(o1.text));
    const s1 = await face(SAVE);
    ok(s1.status >= 200 && s1.status < 300 && fs.existsSync(savedAt), 'fs.save from the face writes the file', 'fs.save on a starred relay: ' + s1.status + ' ' + short(s1.text) + ', file ' + fs.existsSync(savedAt));
    const j1 = await face(JOB);
    await until(function () { return fs.existsSync(mark); }, 5000);
    ok(j1.status === 201 && fs.existsSync(mark), 'jobs.create of an included process runs it', 'jobs.create on a starred relay: ' + j1.status + ' ' + short(j1.text) + ', ran ' + fs.existsSync(mark));
    const shMark = path.join(marks, 'sh');
    const sh = await face({ call: 'jobs.create', args: { command: '/bin/sh', args: ['-c', 'echo x > ' + shMark] } });
    await sleep(WAIT_MS);
    ok(sh.status >= 400 && sh.status < 500 && !fs.existsSync(shMark), 'and /bin/sh is still refused, starred or not', '/bin/sh from a starred face: ' + sh.status + ' ' + short(sh.text) + ', ran ' + fs.existsSync(shMark));
    const self = await face({ call: 'contact.own', args: { key: R.relayKey, own: false } });
    ok(self.status >= 400 && self.status < 500 && (await starOf(R.relayKey)), 'contact.own from the face is refused even here: the star stays', 'contact.own from a starred face: ' + self.status + ' ' + short(self.text) + ', star ' + (await starOf(R.relayKey)));

    test.subHeading('box v29: "A star taken off a relay that has a face takes that face away (Q21)"');
    fs.rmSync(savedAt, { force: true }); fs.rmSync(mark, { force: true });
    const faceName = async function (base) { const g = await home(N.base, 'relay.get', { key: base }); const r = g.body && g.body.relay; return r && r.face && typeof r.face === 'object' ? String(r.face.name || '') : String((r && r.face) || ''); };
    const before = await faceName(R.base);
    ok(!!before, 'the world: the node holds a face on the relay, ' + before, 'the node holds no face on the relay before the star comes off: nothing judged');
    const off = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
    ok(off.status === 200 && !(await starOf(R.relayKey)), 'contact.own at home takes the star away', 'contact.own false at home: ' + off.status + ' ' + short(off.text));
    ok(!!before && await until(function () { return faceName(R.base).then(function (n) { return n === ''; }); }, 8000), 'and the node holds no face on that relay any more', 'the star came off and the node still holds ' + short(await faceName(R.base)));
    for (const q of [{ call: 'node.card', args: {} }, JOB, SAVE, OWNER]) {
      const a = await face(q);
      ok(refused(a), q.call + ' through it is refused', q.call + ' after the star came off: ' + a.status + ' ' + short(a.text));
    }
    await sleep(WAIT_MS);
    ok(!fs.existsSync(mark) && !fs.existsSync(savedAt), 'nothing ran, nothing was written', 'after the star came off: ran ' + fs.existsSync(mark) + ', saved ' + fs.existsSync(savedAt));
    await home(N.base, 'contact.own', { key: R.relayKey, own: true });
    const back = await face({ call: 'node.card', args: {} });
    ok(refused(back), 'the star put back opens nothing: the face is gone, not hidden', 'the star back on, node.card through the old face: ' + back.status + ' ' + short(back.text));

    // ── GOAL/G41.33, ON THE REAL STREAM ──
    // "anything andy gets on his loopback screen, he can get on his face, if he "stars" any relay"; "NO RESTRICTIONS AT
    // ALL, except changing stars"; "Pressing the star sends no catch-up". Without the star the face gets nothing (box v29,
    // above). What a page reads from /face/stream, with its cookie, unsealed as a page that cannot seal.
    test.subHeading('the real stream: without the star it carries nothing; with it, a job, a bundle and the join steps');
    const S = await scratchFaceRelay({ members: [] });
    relays.push(S);
    const why4 = !S.up ? 'the relay did not come up' : (await join(N, S) || await setFace(N, S, 'stream'));
    ok(!why4, 'a relay for the stream: joined, a face set', 'nothing judged: ' + why4);
    const LS = why4 ? {} : await logIn(S, 'stream');
    if (!why4) ok(!!LS.sid, 'the face logs in', 'the login failed, nothing judged: ' + LS.why);
    if (LS.sid) {
      const got = [];
      let heldStream = '';
      const q = http.request({ host: '127.0.0.1', port: S.port, path: '/face/stream', method: 'GET', headers: { Host: 'stream.relay.example', Cookie: 'spirit_face=' + LS.sid } }, function (r) {
        r.setEncoding('utf8');
        r.on('data', function (d) { heldStream += d; const parts = heldStream.split('\n'); heldStream = parts.pop(); parts.filter(Boolean).forEach(function (l) { got.push(l); }); });
      });
      q.on('error', function () { /* the stream ends with the relay */ });
      q.end();
      const hears = function (word) { return got.some(function (l) { return l.indexOf(word) !== -1; }); };
      const heardEvent = function (kind, id) { return got.some(function (l) { const v = parsed(l); return !!v && v.event === kind && (kind === 'job-deleted' ? v.data === id : !!v.data && v.data.id === id); }); };
      await sleep(3000);
      // Box v29: no star, the node answers the face nothing, so no file tree, no presence, no job.
      ok(!hears('fs-watcher') && !hears('presence'), 'no star: the stream carries nothing of the node, not even its file tree', 'no star: the stream said ' + short(got.slice(0, 3)));

      // One failed job, to delete: a process that ends with an exit code of its own stays until it is deleted.
      const script2 = path.join(run, 'process/js/zzStream/zzStream.js');
      fs.mkdirSync(path.dirname(script2), { recursive: true });
      fs.writeFileSync(script2, 'setTimeout(function () { process.exit(4); }, 300);\n');
      fs.writeFileSync(path.join(run, 'process/js/zzStream/zzStream.json'), JSON.stringify({ label: 'zz' }));
      const st2 = path.join(run, 'relay-state/process/zzStream');
      fs.mkdirSync(st2, { recursive: true });
      fs.writeFileSync(path.join(st2, 'zzStream.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
      const runOne = async function () {
        const c = await home(N.base, 'jobs.create', { command: process.execPath, args: ['process/js/zzStream/zzStream.js'] });
        const id = c.body && c.body.id;
        if (!id) return { why: 'jobs.create at home: ' + c.status + ' ' + short(c.text) };
        await until(function () { return home(N.base, 'jobs.get', { key: id }).then(function (a) { const j = a.body && a.body.job; return !!j && j.status === 'failed'; }); }, 8000);
        const d = await home(N.base, 'jobs.delete', { id: id });
        return d.status < 300 ? { id: id } : { why: 'jobs.delete at home: ' + d.status + ' ' + short(d.text) };
      };
      const bundle = function (label) { return home(N.base, 'auth.bundle', { op: 'add', label: label, text: 'zz' }); };

      const j0 = await runOne();
      ok(!!j0.id, 'no star: a job runs and is deleted at home', 'nothing judged: ' + j0.why);
      const b0 = await bundle('zzBefore');
      ok(b0.status < 300, 'no star: a bundle is added at home', 'auth.bundle at home: ' + b0.status + ' ' + short(b0.text));
      await sleep(WAIT_MS);
      ok(!!j0.id && !hears(j0.id), 'no star: the job never reaches the face', 'no star: job ' + j0.id + ' reached the face');
      ok(!hears('zzBefore'), 'no star: the bundle never reaches the face', 'no star: the bundle reached the face');

      const sOn = await home(N.base, 'contact.own', { key: S.relayKey, own: true });
      ok(sOn.status === 200, 'the star on, at home, the stream still open', 'contact.own at home: ' + sOn.status + ' ' + short(sOn.text));
      await sleep(WAIT_MS);
      ok(!!j0.id && !hears(j0.id) && !hears('zzBefore'), 'no catch-up: what went before the star does not come', 'pressing the star sent what went before it');

      const j1b = await runOne();
      ok(!!j1b.id, 'starred: a job runs and is deleted at home', 'nothing judged: ' + j1b.why);
      await until(function () { return heardEvent('job-deleted', j1b.id); }, 5000);
      ok(!!j1b.id && heardEvent('job-updated', j1b.id), 'starred: the running job reaches the face', 'starred: job ' + j1b.id + ' never reached the face');
      ok(!!j1b.id && heardEvent('job-deleted', j1b.id), 'starred: the job deleted reaches the face', 'starred: job-deleted ' + j1b.id + ' never reached the face');
      const b1 = await bundle('zzAfter');
      await until(function () { return hears('zzAfter'); }, 5000);
      ok(b1.status < 300 && hears('zzAfter'), 'starred: the bundle reaches the face', 'starred: the bundle never reached the face: ' + b1.status + ' ' + short(b1.text));

      // The join steps are published only when their facts change (joinStepsJob.js): this node's first contact, here a key
      // it blocks, makes "contact" true.
      const someone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zz').publicKey;
      const blocked = await home(N.base, 'contact.block', { publicKey: someone });
      ok(blocked.status < 300, 'starred: a first contact appears at home', 'nothing judged: contact.block answered ' + blocked.status + ' ' + short(blocked.text));
      await until(function () { return hears('join-steps'); }, 5000);
      ok(hears('join-steps'), 'starred: the join steps reach the face', 'starred: the join-steps job never reached the face');

      test.subHeading('a starred face has no restrictions, except changing stars');
      const sface = function (req) { return page(S, 'stream', '/face/call', req, LS.sid); };
      const rOff = await home(N.base, 'contact.own', { key: R.relayKey, own: false });
      ok(rOff.status === 200, 'the world: the first relay\'s star off again', 'contact.own false at home: ' + rOff.status);
      const anotherStar2 = await sface({ call: 'contact.own', args: { key: R.relayKey, own: true } });
      ok(refused(anotherStar2) && !(await starOf(R.relayKey)), 'starring another relay from it is refused, and no star lands', 'contact.own of another relay from a starred face: ' + anotherStar2.status + ' ' + short(anotherStar2.text) + ', star ' + (await starOf(R.relayKey)));
      const ownOff = await sface({ call: 'contact.own', args: { key: S.relayKey, own: false } });
      ok(refused(ownOff) && (await starOf(S.relayKey)), 'taking its own star off from it is refused, and the star stays', 'contact.own false from a starred face: ' + ownOff.status + ' ' + short(ownOff.text) + ', star ' + (await starOf(S.relayKey)));

      // Last, since it takes the page's address away: the face you call through, renamed through it, on a star.
      const renamed = await sface({ call: 'relay.face', args: { url: S.base, name: 'renamed' } });
      ok(!/not-from-the-face/.test(renamed.text) && renamed.status < 400, 'starred: relay.face on the relay it is called through is not refused by the face\'s rule', 'relay.face through a starred face: ' + renamed.status + ' ' + short(renamed.text));
      const moved = await until(function () { return page(S, 'renamed', '/face/api', { call: 'state', args: {} }).then(function (a) { return a.status === 200; }); }, 8000);
      ok(!!moved, 'and the face has its new name on the relay', 'after relay.face through a starred face, renamed.relay.example does not answer');
      // The star off with the stream open: the face goes, so the next event stays home.
      const sOff = await home(N.base, 'contact.own', { key: S.relayKey, own: false });
      ok(sOff.status === 200, 'the star off, at home', 'contact.own false at home: ' + sOff.status + ' ' + short(sOff.text));
      const j2b = await runOne();
      await sleep(WAIT_MS);
      ok(!!j2b.id && !hears(j2b.id), 'the star off: the next job stays home', 'the star came off and job ' + j2b.id + ' still reached the face');
      ok(await until(function () { return faceName(S.base).then(function (n) { return n === ''; }); }, 8000), 'and the node holds no face on that relay any more', 'the star came off and the node still holds ' + short(await faceName(S.base)));

      try { q.destroy(); } catch (e) { /* gone */ }
    }

    // ── A RELAY THAT SAYS THIS NODE OWNS IT ──
    test.subHeading('a relay\'s claim changes nothing: it says this node owns it, and no star is pressed');
    // The face is set first, as a member, then the owner mark goes in: relay.face on a relay that already owns this node
    // answers no text today, so the node cannot read it (a fault of its own, reported, not this rule's).
    const O = await scratchFaceRelay({ members: [] });
    relays.push(O);
    let why2 = !O.up ? 'the relay did not come up' : (await join(N, O) || await setFace(N, O, 'mine'));
    if (!why2 && !(await O.becomeOwned(me))) why2 = 'the relay did not come back with this node as its owner';
    ok(!why2, 'a relay whose owner mark is this node\'s key: joined, a face set', 'nothing judged: ' + why2);
    if (!why2) {
      let report = null;
      await until(function () { return home(N.base, 'relay.get', { key: O.base }).then(function (a) { report = a.body && a.body.report; return !!(report && Object.keys(report).length); }); }, 20000);
      ok(!!(report && Object.keys(report).length), 'the relay has sent this node its owner\'s report', 'no owner\'s report came: the claim was never made, so nothing is judged');
      ok(!(await starOf(O.relayKey)), 'its report sets no star', 'the relay\'s own report put a star on its row');
      const L2 = await logIn(O, 'mine');
      ok(!!L2.sid, 'the face logs in there', 'the login failed, nothing judged: ' + L2.why);
      if (L2.sid) {
        const a = await page(O, 'mine', '/face/call', OWNER, L2.sid);
        ok(refused(a), 'owner.command from that face is refused: the relay\'s word opens nothing', 'owner.command on a relay that only claims this node: ' + a.status + ' ' + short(a.text));
      }
    }

    // ── A RELAY WHERE THIS NODE SET NO FACE ──
    test.subHeading('a relay where this node set no face gets nothing, whatever it does');
    const D = await scratchFaceRelay({ members: [] });
    relays.push(D);
    const why3 = !D.up ? 'the relay did not come up' : await join(N, D);
    ok(!why3, 'a third relay: joined, and no face asked for', 'nothing judged: ' + why3);
    if (!why3) {
      // The dishonest relay: it gives the member a face on its own, so it can send this node face events.
      D.setFace(me, 'forged', MAIL);
      await sleep(300);
      const L3 = await logIn(D, 'forged');
      ok(!!L3.sid, 'the relay has made a face this node never asked for, and logged in to it', 'the forged face could not log in, nothing judged: ' + L3.why);
      if (L3.sid) {
        for (const q of [{ call: 'node.card', args: {} }, JOB]) {
          const a = await page(D, 'forged', '/face/call', q, L3.sid);
          ok(a.status === 403 && a.body && a.body.code === 'no-face-here', q.call + ' through it is refused, no-face-here', q.call + ' on a relay where this node set no face: ' + a.status + ' ' + short(a.text));
        }
        const on3 = await home(N.base, 'contact.own', { key: D.relayKey, own: true });
        const a3 = await page(D, 'forged', '/face/call', JOB, L3.sid);
        ok(on3.status === 200 && a3.status === 403 && a3.body && a3.body.code === 'no-face-here', 'and a star does not open it: no face of mine, nothing', 'starred, no face set: ' + on3.status + ', ' + a3.status + ' ' + short(a3.text));
      }
    }
    await sleep(WAIT_MS);
    ok(!fs.existsSync(mark), 'no job ran through any of this', 'a job ran through a relay that had no right to it');
  } finally {
    relays.forEach(function (r) { try { r.stop(); } catch (e) { /* gone */ } });
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
