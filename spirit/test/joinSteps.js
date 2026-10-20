'use strict';

// spirit/test/joinSteps.js
// goal/G30.1, box v39: the Join app walks a new user from joining to his face link. Red on today's tree; claude-windows
// writes it and builds it (one agent). The box, in short:
//   - The app shows every step as a bullet in a to-do list, done ones ticked, the first open one expanded with its
//     form; the tile shows the first open step's name and icon. Its manifest lists the steps in order, each with its
//     name, icon and the fact that ends it. Join (until a seat); Find someone (until a first contact), optional, so it
//     never blocks; Configure your node's remote control (until the node holds a face name on the relay it joined);
//     the face link, https://<face name>.<relay host>, ticked once he has opened it (kept in the shell's preferences),
//     which ends the steps and takes the tile away.
//   - The shell opens an app named in its address on load (?app=<folder>); the mail's link carries ?join=<code>&app=join.
//   - Find someone on the network and Info's face form are shell elements; Contacts, Info and the Join app draw them.
//   - THE ELEMENT CARRIES ITS OWN LISTENER (Andy, 2026-10-20: "does the fucking new element even carry its own
//     listener, that keeps the screen untouched until a streamed event actually affects it?", then "FIX IT RIGHT"): the
//     node keeps a permanent job, join-steps, with where the steps stand, and publishes it only when it changes; the
//     shell's tile and the Join app hear that job and draw only when it changes. Nothing is asked on a shell message.
// NAMED HERE where the box names none:
//   - js/joinStepsJob.js: create(rootDir, jobs) -> { job, facts(), refresh(why) }. facts() reads the node's own records:
//     seated (a relay row holds a seat), relayUrl (that relay, else the first listed), contact (the book holds anyone
//     but this node and its relays), face (the face name kept on that relay's row), faceUrl. refresh publishes the job
//     when the facts changed, and answers whether it did. server.js refreshes it after a relay, contact or peer verb.
//   - spiritElements.joinSteps = { fromJob(data, opened), current(steps, facts), done(step, facts) }.
//   - spiritElements.peerFind (shell/js/peerFind.js) and spiritElements.faceForm (shell/js/faceForm.js).
//   - The Join app keeps the opened link as its own override: setAppOverride('shell/join', { faceOpened: true }).
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.1: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
function element(rel, name) {
  try { const win = {}; new Function('window', raw(rel))(win); return (win.spiritElements || {})[name] || null; } catch (e) { return null; }
}
function settle() { return new Promise(function (r) { setTimeout(r, 5); }); }
const homes = [];

test.startTest('goal/G30.1: the Join app walks a new user from joining to his face link');

test.subHeading('1. the steps, in the manifest');
let manifest = null;
try { manifest = JSON.parse(raw('shell/join/join.json')); } catch (e) { manifest = null; }
const steps = (manifest && Array.isArray(manifest.steps)) ? manifest.steps : [];
const find = steps.filter(function (s) { return s.until === 'contact'; })[0] || {};
const face = steps.filter(function (s) { return s.until === 'face'; })[0] || {};
// Box v41: step 1 ends once the node holds a seat with a verified email (until: 'email').
if (steps.map(function (s) { return s.until; }).join(',') === 'email,contact,face,opened' && find.optional === true && /remote control/i.test(String(face.name || '')) && steps.every(function (s) { return s.name && s.icon; }))
  test.check('join.json lists Join, Find someone (optional), Configure your node\'s remote control and the face link, each with a name and an icon');
else test.fail(OWED + 'join.json steps read ' + short(steps));

test.subHeading('2. the node keeps where the steps stand as a job, published when it changes');
const joinSteps = element('shell/js/joinSteps.js', 'joinSteps');
let nodeSide = null;
try {
  const plant = require('./plantIdentity.js');
  const relayKeys = require('../run/js/relayKeys');
  const contactBook = require('../run/js/contacts');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g301-job-'));
  homes.push(home);
  plant.ensureAt(home, 'carl');
  const published = [];
  let made = null;
  const jobs = {
    createJob: function (kind, type, data) { made = { id: 'job_1', kind: kind, type: type, data: data }; return made; },
    updateJob: function (id, patch) { published.push(JSON.parse(JSON.stringify(patch.data || {}))); Object.assign(made.data, patch.data || {}); return made; },
  };
  const J = require('../run/js/joinStepsJob').create(home, jobs);
  const at = function () { const s = joinSteps ? joinSteps.current(steps, joinSteps.fromJob(made.data, false)) : null; return s ? s.until : null; };
  const r = { kind: made && made.kind, type: made && made.type, start: at() };
  r.quiet = J.refresh('nothing') === false && published.length === 0;
  relayKeys.list(home, 'https://relay.example', 'relay', 'RELAYKEY-J');
  relayKeys.seat(home, 'https://relay.example', 'carl');
  r.seatPublished = J.refresh('relay.join') === true && published.length === 1;
  // A seat with no verified email (joined by invite): step 1 is still open, its form reading Add.
  r.afterSeat = at();
  r.noEmail = made.data.emailVerified === false;
  relayKeys.keepEmail(home, 'https://relay.example', 'carl@example.org', true);
  J.refresh('relay.join');
  r.emailVerified = made.data.emailVerified === true && made.data.email === 'carl@example.org';
  r.afterEmail = at();
  contactBook.acquire(home, { publicKey: 'BERTKEY-J', publicLabel: 'bert' }, 'handle');
  J.refresh('peer.acquire');
  r.contact = made.data.contact === true;
  r.afterContact = at();
  relayKeys.keepFace(home, 'https://relay.example', 'harbour', 'carl@example.org', '{}');
  J.refresh('relay.face');
  r.faceUrl = made.data.faceUrl;
  r.afterFace = at();
  r.afterOpened = joinSteps ? (joinSteps.current(steps, joinSteps.fromJob(made.data, true)) || { until: null }).until : 'no element';
  nodeSide = r;
} catch (e) { nodeSide = { threw: e.message }; }
const n = nodeSide || {};
if (n.kind === 'permanent' && n.type === 'join-steps' && n.quiet === true) test.check('the node makes a permanent join-steps job, and a refresh with nothing changed publishes nothing');
else test.fail(OWED + 'the join-steps job: ' + short(n));
if (n.start === 'email' && n.seatPublished === true && n.afterSeat === 'email' && n.noEmail === true && n.emailVerified === true && n.afterEmail === 'face')
  test.check('a seat taken publishes the job; step 1 stays open until the email is verified (the job carries email and emailVerified), then the remote control is next');
else test.fail(OWED + 'after a seat: ' + short(n));
if (n.contact === true && n.afterContact === 'face') test.check('a contact added is in the job; Find someone is optional, so the open step stays');
else test.fail(OWED + 'after a contact: ' + short(n));
if (n.faceUrl === 'https://harbour.relay.example' && n.afterFace === 'opened' && n.afterOpened === null) test.check('a face kept moves the open step to the face link, https://harbour.relay.example; opened, no step is open');
else test.fail(OWED + 'after a face: ' + short(n));
const serverSrc = code('js/server.js');
if (/require\('\.\/joinStepsJob'\)\.create\(/.test(serverSrc) && /joinSteps(Job)?\.refresh\(/.test(serverSrc) && /relay\|contact\|peer/.test(serverSrc))
  test.check('server.js makes the job and refreshes it after a relay, contact or peer verb');
else test.fail(OWED + 'server.js does not keep the join-steps job');

test.subHeading('3. the shell: the tile hears the job, the address and the link in the mail');
const shell = code('js/client/shell.js');
const elementSrc = code('shell/js/joinSteps.js');
if (/'join-steps'/.test(shell) && /fromJob\(/.test(shell) && /faceOpened/.test(shell) && !/askStepFacts/.test(shell) && !/ask\('relay\.search'|'contact\.search'|'relay\.get'/.test(elementSrc))
  test.check('the shell draws the Join tile from the join-steps job it hears; nothing asks the node for the steps');
else test.fail(OWED + 'the shell or joinSteps still asks the node for the steps, or does not hear the job');
if (/get\('app'\)/.test(shell) && /launchApp\(/.test((shell.split("get('app')")[1] || '').slice(0, 800)))
  test.check('the shell opens the app named by ?app= on load');
else test.fail(OWED + 'the shell does not open ?app=');
const mails = [];
let link = '';
try {
  const auth = require('../run/js/relayAuth');
  const plant = require('./plantIdentity.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g301-steps-'));
  homes.push(home);
  plant.ensureAt(home, 'relay');
  auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
  const box = require('../run/js/relay').createRelay(home, { sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
  box.join(auth.generateIdentity('bert').publicKey, 'bert@example.org', 11112, '');
  link = ((/http:\/\/127\.0\.0\.1:\d+\/?\?[^\s]+/.exec((mails[0] || {}).text || '')) || [''])[0];
} catch (e) { link = 'threw ' + e.message; }
if (/^http:\/\/127\.0\.0\.1:11112\/?\?join=[A-Za-z0-9_-]+&app=join$/.test(link)) test.check('the mail\'s link carries ?join=<code>&app=join, so it opens the Join app');
else test.fail(OWED + 'the mail\'s link reads ' + short(link));

test.subHeading('4. the shell elements and who draws them');
const index = raw('index.html');
const contacts = code('shell/contacts/contacts.js');
const info = code('shell/info/info.js');
const joinApp = code('shell/join/join.js');
const peerFind = element('shell/js/peerFind.js', 'peerFind');
const faceForm = element('shell/js/faceForm.js', 'faceForm');
if (peerFind && typeof peerFind.create === 'function' && /'peer\.search'/.test(code('shell/js/peerFind.js')) && /'peer\.acquire'/.test(code('shell/js/peerFind.js'))
    && /spiritElements\.peerFind/.test(contacts) && /spiritElements\.peerFind/.test(joinApp)
    && !/function contactsSeenSource|function contactsSeenCells|function contactsAskCard|function contactsSeenAdd/.test(contacts))
  test.check('Find someone is the peerFind element (peer.search, its rows, Add by peer.acquire); Contacts and the Join app draw it, Contacts keeps no copy');
else test.fail(OWED + 'peerFind is missing, or Contacts keeps its own find panel, or the Join app does not draw it');
if (faceForm && typeof faceForm.mount === 'function' && /'relay\.face'/.test(code('shell/js/faceForm.js'))
    && /spiritElements\.faceForm/.test(info) && /spiritElements\.faceForm/.test(joinApp) && !/'relay\.face'/.test(info))
  test.check('the face form is the faceForm element (relay.face); Info and the Join app draw it, Info keeps no copy');
else test.fail(OWED + 'faceForm is missing, or Info keeps its own face form, or the Join app does not draw it');
if (['peerFind', 'faceForm', 'joinSteps'].every(function (nm) { return new RegExp('src="/shell/js/' + nm + '\\.js"').test(index); }))
  test.check('index.html loads peerFind, faceForm and joinSteps');
else test.fail(OWED + 'index.html does not load all three elements');
if (/spiritElements\.joinSteps/.test(joinApp) && /setAppOverride\('shell\/join',\s*\{\s*faceOpened:\s*true\s*\}\)/.test(joinApp) && /spiritElements\.joinForm/.test(joinApp))
  test.check('the Join app draws its steps from joinSteps, the join form, and keeps the opened link as its override');
else test.fail(OWED + 'the Join app does not draw joinSteps, the join form, or does not keep faceOpened');

test.subHeading('4b. one join control, and the face form on one line (box v41)');
// joinForm.words({seated, email, emailVerified}) picks the control's words, so natterDetails and the Join app draw the
// same control: no seat Join; a seat without a verified email Add; verified Change, prefilled.
const joinFormEl = element('shell/js/joinForm.js', 'joinForm');
let words = null;
try {
  words = [joinFormEl.words({ seated: false }), joinFormEl.words({ seated: true, email: '', emailVerified: false }), joinFormEl.words({ seated: true, email: 'carl@example.org', emailVerified: true })];
} catch (e) { words = { threw: e.message }; }
const nd = code('shell/natterDetails/natterDetails.js');
if (Array.isArray(words) && words[0].button === 'Join' && words[1].button === 'Add' && /Add email address/.test(words[1].title) && words[2].button === 'Change' && words[2].email === 'carl@example.org'
    && /ndJoinForm\(\)\.words\(/.test(nd) && /\.joinForm\.words\(/.test(joinApp) && !/'Add email address'|'Change email address'/.test(nd))
  test.check('joinForm picks Join, Add or Change by where the node stands, and natterDetails and the Join app both ask it');
else test.fail(OWED + 'joinForm.words answered ' + short(words) + ', or a caller keeps its own words');
let faceHtml = '';
try {
  const byId = {};
  const fakeEl = function (id) { return byId[id] || (byId[id] = { id: id, innerHTML: '', value: '', hidden: false, addEventListener: function () {} }); };
  const win = {};
  new Function('window', 'document', raw('shell/js/faceForm.js'))(win, { getElementById: fakeEl });
  const box = fakeEl('box');
  win.spiritElements.faceForm.mount(box, { seats: [{ url: 'https://relay.example', label: 'relay', emailVerified: true, email: 'a@b.c' }], ask: function () { return Promise.resolve({}); } });
  faceHtml = box.innerHTML;
} catch (e) { faceHtml = 'threw ' + e.message; }
if (/<\/select><\/label><label class="field-label grow">Face name<input[^>]*><\/label><button type="button" id="info-face-save">/.test(faceHtml))
  test.check('the face form draws relay, face name and Ask side by side in one row');
else test.fail(OWED + 'the face form row reads ' + short(faceHtml));

// 5. THE APP HEARS THE JOB AND NOTHING ELSE. The real join.js on a fake page with the real elements: it subscribes to
// the jobs stream, draws when the join-steps job arrives or changes, not when the same job comes again, not on render,
// not while a field inside the list has focus; and it asks the node nothing about the steps.
const holdsStill = (function () {
  const byId = {};
  function fakeEl(id) {
    let html = '';
    const el = { id: id, writes: 0, value: '', hidden: false, addEventListener: function () {}, querySelector: function () { return fakeEl('q'); }, contains: function (x) { return !!x && x.inside === id; } };
    Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); el.writes += 1; } });
    return el;
  }
  const doc = { activeElement: null, getElementById: function (id) { return byId[id] || (byId[id] = fakeEl(id)); } };
  const win = {};
  ['joinSteps', 'joinForm'].forEach(function (nm) { try { new Function('window', raw('shell/js/' + nm + '.js'))(win); } catch (e) { /* missing */ } });
  let app = null;
  const subscribers = [];
  const sp = { core: { const: { ICON: {} }, fs: { loadFile: function () { return raw('shell/join/join.json'); } },
    jobs: { subscribe: function (s) { subscribers.push(s); return function () {}; } } }, shell: { activateApp: function (d) { app = d; } } };
  try { new Function('spirit', 'document', 'window', raw('shell/join/join.js'))(sp, doc, win); } catch (e) { return Promise.resolve({ threw: e.message }); }
  if (!app) return Promise.resolve({ threw: 'no app' });
  const asked = [];
  const api = { escapeHtml: function (s) { return String(s); }, verb: function (v) { asked.push(v); return Promise.resolve({ status: 200, body: { ok: true, items: [] } }); },
    getAppOverride: function () { return {}; }, setAppOverride: function () {}, peerPost: function () { return Promise.resolve({}); }, callDialog: function () { return Promise.resolve(null); } };
  const job = function (data) { return { id: 'job_7', type: 'join-steps', kind: 'permanent', data: data }; };
  const feed = function (j, snapshot) { subscribers.forEach(function (s) { if (snapshot && s.onSnapshot) s.onSnapshot([j]); else if (s.onUpdate) s.onUpdate(j); }); };
  app.mount(doc.getElementById('container'), api);
  const list = function () { return doc.getElementById('join-list').writes; };
  const r = {};
  return settle().then(function () {
    r.subscribed = subscribers.length > 0;
    const before = list();
    feed(job({ seated: false, relayUrl: 'https://relay.example', contact: false, face: '', faceUrl: '' }), true);
    return settle().then(function () { r.drewOnJob = list() > before; });
  }).then(function () {
    const before = list();
    feed(job({ seated: false, relayUrl: 'https://relay.example', contact: false, face: '', faceUrl: '' }));
    for (let i = 0; i < 5; i += 1) app.render();
    return settle().then(function () { r.quietOnSame = list() === before; });
  }).then(function () {
    const before = list();
    doc.activeElement = { inside: 'join-list' };
    feed(job({ seated: true, relayUrl: 'https://relay.example', contact: false, face: '', faceUrl: '' }));
    return settle().then(function () { r.quietWhileTyping = list() === before; });
  }).then(function () {
    r.askedSteps = asked.filter(function (v) { return v === 'relay.search' || v === 'contact.search'; });
    return r;
  }, function (e) { return { threw: e.message }; });
}());
const stillDone = holdsStill.then(function (r) {
  test.subHeading('5. the Join app hears the job and nothing else');
  if (r && r.subscribed && r.drewOnJob) test.check('the Join app subscribes to the jobs stream and draws when the join-steps job arrives');
  else test.fail(OWED + 'the Join app does not draw from the join-steps job: ' + short(r));
  if (r && r.quietOnSame && r.quietWhileTyping && r.askedSteps && r.askedSteps.length === 0)
    test.check('the same job again, five renders, and a change while a field has focus redraw nothing; it asks the node nothing about the steps');
  else test.fail(OWED + 'the Join app redrew or asked: ' + short(r));
});

stillDone.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
