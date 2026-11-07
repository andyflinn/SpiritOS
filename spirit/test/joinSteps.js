'use strict';

// spirit/test/joinSteps.js
// goal/G30.1, box v39: the Join app walks a new user from joining to his face link. The box, in short:
//   - The app shows every step as a bullet in a to-do list, done ones ticked, the first open one expanded with its
//     form; the tile shows the first open step's name and icon. Its manifest lists the steps in order, each with its
//     name, icon and the fact that ends it. Join (until a seat); Find someone (until a first contact), optional, so it
//     never blocks; Configure your node's remote control (until the node holds a face name on the relay it joined);
//     the face link, https://<face name>.<relay host>, ticked once he has opened it (kept as the Join app's override),
//     which ends the steps and takes the tile away.
//   - The shell opens an app named in its address on load (?app=<folder>); the mail's link carries ?join=<code>&app=join.
//   - Find someone on the network and Info's face form are shell elements; Contacts, Info and the Join app draw them.
//   - THE ELEMENT CARRIES ITS OWN LISTENER (Andy, 2026-10-20: "does the fucking new element even carry its own
//     listener, that keeps the screen untouched until a streamed event actually affects it?", then "FIX IT RIGHT"): the
//     node keeps a permanent job, join-steps, with where the steps stand, and publishes it only when it changes; the
//     shell's tile and the Join app hear that job and draw only when it changes. Nothing is asked on a shell message.
// NAMED HERE where the box names none:
//   - spirit/joinStepsJob.js: create(rootDir, jobs) -> { job, facts(), refresh(why) }. facts() reads the node's own records:
//     seated (a relay row holds a seat), relayUrl (that relay, else the first listed), contact (the book holds anyone
//     but this node and its relays), face (the face name kept on that relay's row), faceUrl. refresh publishes the job
//     when the facts changed, and answers whether it did. server.js refreshes it after a relay, contact or peer verb.
//   - spirit.element.joinSteps = { fromJob(data, opened), current(steps, facts), done(step, facts) }.
//   - spirit.element.search.contact.listElement (spirit/element/search/contact/listElement.js) and spirit.element.faceForm
//     (spirit/element/faceForm.js).
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
  try { const win = {}; new Function('window', raw(rel))(win); return (win.spirit.element || {})[name] || null; } catch (e) { return null; }
}
const homes = [];

test.startTest('goal/G30.1: the Join app walks a new user from joining to his face link');

test.subHeading('1. the steps, in the manifest');
let manifest = null;
try { manifest = JSON.parse(raw('shell/join/join.json')); } catch (e) { manifest = null; }
const steps = (manifest && Array.isArray(manifest.steps)) ? manifest.steps : [];
const find = steps.filter(function (s) { return s.until === 'contact'; })[0] || {};
const face = steps.filter(function (s) { return s.until === 'face'; })[0] || {};
// Box v41: step 1's fact is until: 'email'; a seat alone ends it, since the node keeps no email (goal/G40.11).
if (steps.map(function (s) { return s.until; }).join(',') === 'email,contact,face,opened' && find.optional === true && /remote control/i.test(String(face.name || '')) && steps.every(function (s) { return s.name && s.icon; }))
  test.check('join.json lists Join, Find someone (optional), Configure your node\'s remote control and the face link, each with a name and an icon');
else test.fail(OWED + 'join.json steps read ' + short(steps));

test.subHeading('2. the node keeps where the steps stand as a job, published when it changes');
const joinSteps = element('spirit/element/joinSteps.js', 'joinSteps');
let nodeSide = null;
try {
  const plant = require('./plantIdentity.js');
  const relayKeys = require('../run/spirit/relayKeys');
  const contactBook = require('../run/spirit/contacts');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g301-job-'));
  homes.push(home);
  plant.ensureAt(home, 'carl');
  const published = [];
  let made = null;
  const jobs = {
    createJob: function (kind, type, data) { made = { id: 'job_1', kind: kind, type: type, data: data }; return made; },
    updateJob: function (id, patch) { published.push(JSON.parse(JSON.stringify(patch.data || {}))); Object.assign(made.data, patch.data || {}); return made; },
  };
  const J = require('../run/spirit/joinStepsJob').create(home, jobs);
  const at = function () { const s = joinSteps ? joinSteps.current(steps, joinSteps.fromJob(made.data, false)) : null; return s ? s.until : null; };
  const r = { kind: made && made.kind, type: made && made.type, start: at() };
  r.quiet = J.refresh('nothing') === false && published.length === 0;
  relayKeys.list(home, 'https://relay.example', 'relay', 'RELAYKEY-J');
  relayKeys.seat(home, 'https://relay.example');
  r.seatPublished = J.refresh('relay.join') === true && published.length === 1;
  // A SEAT ENDS STEP 1 (goal/G40.11): the node keeps no email (box v24), so the job carries none and step 1 is done
  // once a relay holds this node; the remote control is next.
  r.afterSeat = at();
  r.noEmailKept = !('email' in made.data) && !('emailVerified' in made.data);
  contactBook.acquire(home, { publicKey: 'BERTKEY-J', publicLabel: 'bert' }, 'handle');
  J.refresh('peer.acquire');
  r.contact = made.data.contact === true;
  r.afterContact = at();
  // THE FACE NAME IS KEPT ON THE RELAY'S ROW (relayKeys.keepFace(rootDir, url, name); Andy: "Face name: keep it, on
  // the relay's row, as the node's own fact, like myLabel.").
  if (typeof relayKeys.keepFace === 'function') relayKeys.keepFace(home, 'https://relay.example', 'harbour', 'carl@example.org', '{}');
  J.refresh('relay.face');
  r.faceUrl = made.data.faceUrl;
  r.afterFace = at();
  r.afterOpened = joinSteps ? (joinSteps.current(steps, joinSteps.fromJob(made.data, true)) || { until: null }).until : 'no element';
  nodeSide = r;
} catch (e) { nodeSide = { threw: e.message }; }
const n = nodeSide || {};
if (n.kind === 'permanent' && n.type === 'join-steps' && n.quiet === true) test.check('the node makes a permanent join-steps job, and a refresh with nothing changed publishes nothing');
else test.fail(OWED + 'the join-steps job: ' + short(n));
if (n.start === 'email' && n.seatPublished === true && n.afterSeat === 'face' && n.noEmailKept === true)
  test.check('a seat taken publishes the job and ends step 1 (the job carries no email), and the remote control is next');
else test.fail(OWED + 'after a seat: ' + short(n));
if (n.contact === true && n.afterContact === 'face') test.check('a contact added is in the job; Find someone is optional, so the open step stays');
else test.fail(OWED + 'after a contact: ' + short(n));
if (n.faceUrl === 'https://harbour.relay.example' && n.afterFace === 'opened' && n.afterOpened === null) test.check('a face kept moves the open step to the face link, https://harbour.relay.example; opened, no step is open');
else test.fail(OWED + 'after a face: ' + short(n));
const serverSrc = code('spirit/server.js');
if (/require\('\.\/joinStepsJob'\)\.create\(/.test(serverSrc) && /joinSteps(Job)?\.refresh\(/.test(serverSrc) && /relay\|contact\|peer/.test(serverSrc))
  test.check('server.js makes the job and refreshes it after a relay, contact or peer verb');
else test.fail(OWED + 'server.js does not keep the join-steps job');

test.subHeading('3. the shell: the tile hears the job, the address and the link in the mail');
const shell = code('spirit/client/shell.js');
const elementSrc = code('spirit/element/joinSteps.js');
if (/'join-steps'/.test(shell) && /fromJob\(/.test(shell) && /faceOpened/.test(shell) && !/askStepFacts/.test(shell) && !/ask\('relay\.search'|'contact\.search'|'relay\.get'/.test(elementSrc))
  test.check('the shell draws the Join tile from the join-steps job it hears; nothing asks the node for the steps');
else test.fail(OWED + 'the shell or joinSteps still asks the node for the steps, or does not hear the job');
if (/get\('app'\)/.test(shell) && /launchApp\(/.test((shell.split("get('app')")[1] || '').slice(0, 800)))
  test.check('the shell opens the app named by ?app= on load');
else test.fail(OWED + 'the shell does not open ?app=');

test.subHeading('4. the shell elements and who draws them');
if (/apps\[id\]\.onSteps = behavior\.onSteps/.test(shell) && /\.onSteps\(/.test(shell) && /function handSteps\(/.test(shell))
  test.check('the shell keeps the app\'s onSteps and hands it the steps (handSteps)');
else test.fail(OWED + 'the shell does not hand the steps to the app');
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
