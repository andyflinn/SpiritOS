'use strict';

// spirit/test/contactSearchTiers.js
// goal/G30.19: Contacts has one search, in two tiers. Red on today's tree; claude-windows writes it and builds it (one
// agent). The box, in short:
//   - Tier one, at once: contact.search answers from the book and from the shadow (seenPeers) together, one row shape.
//   - Tier two, streamed: the same call starts a network search across the relays; each result is written into the
//     shadow and streamed to the shell as one row. One network search at a time: a contact.search starts one only if
//     none is in flight; searches meanwhile are answered from the book and the shadow and start nothing.
//   - One list, cached by key; a filter book / network / all instead of two folds; a book row offers block, unblock and
//     remove, a network row offers Add (peer.acquire). Contacts' own presence painting is deleted.
//   - The network search is a job whose updates each carry one found row; the face stream carries it and contact.rename.
//   - peer.search and peerFind are deleted; Join's contact step shows the same list; the desk onboarding asks
//     contact.search.
// NAMED HERE where the box names none:
//   - hub.contactSearch(body, { jobs, walk }): walk(q, onRow) is the relay walk (default: every configured relay asked,
//     as peer.search did), resolving when the walk ends. A contact.search row label carries book: true or false.
//   - The job: one permanent job of type 'peer-search'; each update's data.item is { key, label } for one found row.
//   - createFaceHome({ ..., renames }): renames is hub.contactRenames; the face gets 'contact.rename' lines.
//   - shell/js/contacts/listElement.js: window.spiritElements.contactList.create(host, opts) -> { list, refresh, destroy },
//     on probabilitySearch with contactElement rows; contactElement gains the add action. Since goal/G30.16 the network
//     rows land in data.contacts (shell/js/spiritData.js, the faceless layer) and the list is a view of it.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const EventEmitter = require('events');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.19: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setTimeout(r, 15); }); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
const exists = function (rel) { return fs.existsSync(path.join(RUN, rel)); };

test.startTest('goal/G30.19: one contact search in two tiers');

const auth = require('../run/js/relayAuth');
const contactBook = require('../run/js/contacts');
const hubModule = require('../run/js/hub');

function tmpHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3019-'));
  auth.saveIdentity(home, auth.generateIdentity('owner'));
  return home;
}
function fakeJobs() {
  const events = new EventEmitter();
  const map = new Map();
  let n = 0;
  return {
    events: events,
    createJob: function (kind, type, data) { const j = { id: 'job_' + (++n), kind: kind, type: type, status: 'running', data: data || {} }; map.set(j.id, j); events.emit('job-updated', j); return j; },
    updateJob: function (id, patch) { const j = map.get(id); if (!j) return null; if (patch && patch.data) Object.assign(j.data, patch.data); events.emit('job-updated', j); return j; },
    listJobs: function () { return Array.from(map.values()); },
  };
}
function labelsOf(answer) {
  const b = (answer && answer.body) || answer || {};
  return (b.items || []).map(function (i) { let r = null; try { r = JSON.parse(i.label); } catch (e) { r = null; } return { key: i.key, row: r }; });
}

const done = (async function () {
  // ── 1. Tier one: the book and the shadow, at once ──────────────────────────────────────────────────────────────────
  test.subHeading('1. contact.search answers the book and the shadow at once');
  const home = tmpHome();
  const ann = auth.generateIdentity('ann').publicKey;
  const zed = auth.generateIdentity('zed').publicKey;
  const far = auth.generateIdentity('far').publicKey;
  contactBook.acquire(home, { publicKey: ann, publicLabel: 'annika', relay: 'https://lab.example' }, 'handle');
  hubModule.shadow(home).note(zed, { at: auth.generateIdentity('relay').publicKey, url: 'https://lab.example', label: 'annabel', present: true, rank: 1 });
  const hub = hubModule.createHub(home);
  const jobs = fakeJobs();
  let walks = [];
  const walk = function (q, onRow) { return new Promise(function (resolve) { walks.push({ q: q, onRow: onRow, end: resolve }); }); };
  let first = null;
  try { first = hub.contactSearch({ q: 'ann' }, { jobs: jobs, walk: walk }); } catch (e) { first = { threw: e.message }; }
  const rows = labelsOf(first);
  const annRow = rows.filter(function (r) { return r.key === ann; })[0];
  const zedRow = rows.filter(function (r) { return r.key === zed; })[0];
  if (annRow && annRow.row && annRow.row.book === true && zedRow && zedRow.row && zedRow.row.book === false && /annabel/.test(zedRow.row.name || ''))
    test.check('one answer: annika from the book (book: true) and annabel from the shadow (book: false), no relay waited for');
  else test.fail(OWED + 'contact.search for "ann" answered ' + short(rows));

  // ── 2. Tier two: one network search, streamed as rows, written to the shadow ──────────────────────────────────────
  test.subHeading('2. the same call starts the network search; its rows stream as a job and land in the shadow');
  if (walks.length === 1 && walks[0].q === 'ann') test.check('contact.search started one network search for its words');
  else test.fail(OWED + 'network searches started: ' + short(walks.map(function (w) { return w.q; })));
  try { hub.contactSearch({ q: 'anna' }, { jobs: jobs, walk: walk }); hub.contactSearch({ q: 'annab' }, { jobs: jobs, walk: walk }); } catch (e) { /* counted below */ }
  if (walks.length === 1) test.check('two more searches while it is in flight start nothing');
  else test.fail(OWED + 'searches while one is in flight started ' + (walks.length - 1) + ' more');
  const lines = [];
  jobs.events.on('job-updated', function (j) { if (j && j.type === 'peer-search' && j.data && j.data.item) lines.push(j.data.item); });
  if (walks[0]) {
    walks[0].onRow({ publicKey: far, publicLabel: 'annfar', relay: 'https://lab.example', atKey: auth.generateIdentity('r2').publicKey, present: true, viaPartner: false });
    walks[0].onRow({ publicKey: ann, publicLabel: 'annika', relay: 'https://lab.example', atKey: auth.generateIdentity('r3').publicKey, present: true, viaPartner: false });
  }
  await settle();
  const farLine = lines.filter(function (i) { return i.key === far; })[0];
  let farRow = null;
  try { farRow = JSON.parse(farLine.label); } catch (e) { farRow = null; }
  const annLine = lines.filter(function (i) { return i.key === ann; })[0];
  let annNet = null;
  try { annNet = JSON.parse(annLine.label); } catch (e) { annNet = null; }
  if (farRow && farRow.book === false && farRow.present === true && annNet && annNet.book === true && annNet.present === true)
    test.check('each network result is one peer-search job update: a stranger as book: false, a contact as its book row, present');
  else test.fail(OWED + 'peer-search job updates: ' + short(lines));
  const seen = hubModule.shadow(home).get(far);
  if (seen && seen.label === 'annfar') test.check('a network result is written into the shadow');
  else test.fail(OWED + 'the shadow holds for the stranger: ' + short(seen));
  if (walks[0]) walks[0].end();
  await settle();
  const after = labelsOf(hub.contactSearch({ q: 'annfar' }, { jobs: jobs, walk: walk }));
  if (walks.length === 2 && after.some(function (r) { return r.key === far; })) test.check('once it returned, the next search starts one, and tier one now finds what it learned');
  else test.fail(OWED + 'after the walk ended: walks ' + walks.length + ', tier one ' + short(after));

  // ── 3. peer.search is gone ─────────────────────────────────────────────────────────────────────────────────────────
  test.subHeading('3. peer.search and peerFind are deleted, their users moved');
  const server = code('js/server.js');
  const peerMount = (/loopbackVerbs\.mount\('peer'[\s\S]*?\}, \{ wire: true, by: 'hub\.js' \}\)/.exec(server) || [''])[0];
  if (peerMount && !/'search':/.test(peerMount) && !exists('js/peer/search.json') && typeof hub.handleSearch === 'undefined')
    test.check('the peer verbs have no search: no route, no declaration, no hub.handleSearch');
  else test.fail(OWED + 'peer.search still stands: route ' + /'search':/.test(peerMount) + ', declaration ' + exists('js/peer/search.json') + ', handleSearch ' + typeof hub.handleSearch);
  if (/hub\.contactSearch\(b, \{[^}]*jobs/.test(server)) test.check('server.js hands contact.search the jobs');
  else test.fail(OWED + 'server.js does not hand contact.search its jobs');
  if (!exists('shell/js/peerFind.js') && !/peerFind/.test(code('index.html')) && !/peerFind/.test(code('shell/contacts/contacts.js')) && !/peerFind/.test(code('shell/join/join.js')))
    test.check('peerFind is deleted and nothing loads or uses it');
  else test.fail(OWED + 'peerFind: file ' + exists('shell/js/peerFind.js') + ', index.html ' + /peerFind/.test(code('index.html')) + ', contacts ' + /peerFind/.test(code('shell/contacts/contacts.js')) + ', join ' + /peerFind/.test(code('shell/join/join.js')));
  const contacts = code('shell/contacts/contacts.js');
  if (!/function contactsWatchPresence/.test(contacts) && !/function contactsPaintPresence/.test(contacts) && !/createContactSelector/.test(contacts) && /spiritElements.contactList\.create\(/.test(contacts))
    test.check('Contacts draws the one list (contactSearch) and paints no presence itself');
  else test.fail(OWED + 'contacts.js: watch ' + /function contactsWatchPresence/.test(contacts) + ', paint ' + /function contactsPaintPresence/.test(contacts) + ', selector ' + /createContactSelector/.test(contacts) + ', contactSearch ' + /spiritElements.contactList\.create\(/.test(contacts));
  if (/spiritElements\.contactList/.test(code('shell/join/join.js')) && /\/shell\/js\/contacts\/listElement\.js/.test(code('index.html')))
    test.check('Join\'s contact step shows the same list, and index.html loads it');
  else test.fail(OWED + 'join.js or index.html does not use shell/js/contacts/listElement.js');

  // ── 4. The face stream carries the network search and renames ──────────────────────────────────────────────────────
  test.subHeading('4. the face gets the peer-search rows and contact renames');
  const me = auth.generateIdentity('home');
  const fjobs = fakeJobs();
  const renames = require('../run/js/arrivals').createFanOut();
  const written = [];
  let face = null;
  try {
    face = require('../run/js/faceHome').createFaceHome({
      call: function () { return Promise.resolve({ status: 200, body: {} }); }, serveFile: function () {},
      identity: function () { return me; }, relayKey: function () { return ''; }, jobs: fjobs, renames: renames, log: function () {},
      upload: function () { return { write: function (c) { written.push(String(c)); return true; }, end: function () {}, on: function () {}, once: function () {} }; },
    });
    face.open('https://relay.example');
    const job = fjobs.createJob('permanent', 'peer-search', {});
    fjobs.updateJob(job.id, { data: { item: { key: far, label: '{"name":"annfar","book":false}' } } });
    renames.note({ key: ann, caption: 'Annie' });
  } catch (e) { written.push('threw ' + e.message); }
  await settle();
  const out = written.join('\n').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return { raw: l }; } });
  const gotRow = out.some(function (e) { return e.event === 'job-updated' && e.data && e.data.type === 'peer-search' && e.data.data && e.data.data.item && e.data.data.item.key === far; });
  const gotRename = out.some(function (e) { return e.event === 'contact.rename' && e.data && e.data.key === ann && e.data.caption === 'Annie'; });
  if (gotRow && gotRename) test.check('the face stream carries a peer-search row and a contact.rename');
  else test.fail(OWED + 'face stream: row ' + gotRow + ', rename ' + gotRename + ' in ' + short(out));
  const faceShell = code('face/shell.js');
  if (/contact\.rename/.test(faceShell) && /onContactRename/.test(faceShell)) test.check('the face shell hands contact.rename to onContactRename');
  else test.fail(OWED + 'face/shell.js does not deliver contact.rename');

  // ── 5. The shell: one list fed twice, Add on a network row ─────────────────────────────────────────────────────────
  test.subHeading('5. a network row lands in data.contacts; Add; the list is a view of the tree');
  const asked = [];
  const subscribers = [];
  const window = { spiritElements: {}, spiritProbability: null };
  const spirit = { core: {
    ask: function (verb, args) { asked.push({ verb: verb, args: args }); return Promise.resolve({ status: 200, body: { ok: true } }); },
    jobs: { subscribe: function (h) { subscribers.push(h); return function () {}; } },
    util: { escapeHtml: function (s) { return String(s == null ? '' : s); } },
    const: { ICON: { GREEN_CIRCLE: 'G', WHITE_CIRCLE: 'W', RED_CIRCLE: 'R', NO: 'N', WAITING: 'H', STAR: 'S' } },
  } };
  window.spirit = spirit;
  const ctx = vm.createContext({ window: window, spirit: spirit, console: console, Promise: Promise, document: { addEventListener: function () {} } });
  const loaded = {};
  ['js/probabilityBucket.js', 'js/probabilityStringMatch.js', 'js/probabilityStringObjectMatch.js', 'js/fieldRules.js', 'shell/js/spiritData.js', 'shell/js/contacts/data.js', 'shell/js/rowElement.js', 'shell/js/contacts/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/contacts/listElement.js'].forEach(function (rel) {
    try { vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), ctx, { filename: rel }); loaded[rel] = true; }
    catch (e) { loaded[rel] = e.message; }
  });
  const E = window.spiritElements;
  let shell = null;
  try {
    subscribers.slice().forEach(function (h) { if (h.onUpdate) h.onUpdate({ id: 'job_9', type: 'peer-search', data: { item: { key: far, label: '{"name":"annfar","book":false}' } } }); });
    const net = E.contactElement.create({ key: far, name: 'annfar', book: false, relay: 'https://lab.example', publicLabel: 'annfar' });
    asked.length = 0;
    await net.act('add', {});
    const add = asked.filter(function (x) { return x.verb === 'peer.acquire'; })[0];
    const landed = window.spiritData && window.spiritData.get('contacts/' + far);
    shell = { found: landed && landed.book === false ? far : '', off: 'function', add: add ? add.args : null, contactSearch: !!(E.contactList && typeof E.contactList.create === 'function') };
  } catch (e) { shell = { threw: e.message, loaded: loaded }; }
  if (shell && shell.found === far && shell.off === 'function' && shell.add && shell.add.publicKey === far && shell.add.url === 'https://lab.example' && shell.contactSearch)
    test.check('a peer-search update lands in data.contacts; Add asks peer.acquire with the row\'s relay; contactSearch is an element');
  else test.fail(OWED + 'shell elements: ' + short(shell));
  if (/data: 'contacts'/.test(code('shell/js/contacts/listElement.js')) && /window\.spiritData\.seat\(o\.data/.test(code('shell/js/probabilitySearch.js')))
    test.check('the contact list is a view of data.contacts, its answers seated in the tree');
  else test.fail(OWED + 'the contact list is not a view of data.contacts');

  // ── 6. One row of filters, the network a toggle at its end (box v8) ────────────────────────────────────────────────
  // Andy: "KILL that [all] AND KILL [book], put [network] at the very and as a toggle, when its on then it shows peers
  // from the network ALSO." NAMED HERE: contactSearch.filters, the list's filter definitions in order; a filter with
  // toggle: true is one button, its value false until pressed (probabilitySearch draws and flips it).
  test.subHeading('6. one filter row: all, puppets, blocked, held, relays, then a network toggle, off at first');
  const F = (E.contactList && E.contactList.filters) || [];
  const names = F.map(function (f) { return f.name; }).join(',');
  const net6 = F.filter(function (f) { return f.name === 'network'; })[0];
  const P = E.probabilitySearch;
  const entries = [{ key: 'B', row: { name: 'bert', book: true }, at: 0 }, { key: 'N', row: { name: 'nina …x', book: false }, at: 1 },
    { key: 'R', row: { name: 'relay', kind: 'relay', relay: true }, at: 2 }];
  const shown = function (on) {
    try { return P.order(entries, { words: '', values: { show: 'all', network: on }, filters: F }).map(function (w) { return w.key; }).join(','); }
    catch (e) { return 'threw ' + e.message; }
  };
  if (names === 'show,network' && net6 && net6.toggle === true) test.check('the filters are show, then network as a toggle; no where, no book, no second all');
  else test.fail(OWED + 'the filters are ' + short(names) + ', network ' + short(net6 && { toggle: net6.toggle }));
  if (shown(false) === 'B,R' && shown(true) === 'B,N,R') test.check('off, the book and the relays; on, the network\'s peers as well');
  else test.fail(OWED + 'off shows ' + shown(false) + ', on shows ' + shown(true));
  const ps = code('shell/js/probabilitySearch.js');
  if (/f\.toggle/.test(ps) && /values\[f\.name\] = f\.toggle \? false/.test(ps)) test.check('probabilitySearch draws a toggle filter as one button, off until pressed');
  else test.fail(OWED + 'probabilitySearch has no toggle filter');
}());

done.then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
