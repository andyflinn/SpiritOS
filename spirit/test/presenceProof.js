'use strict';

// goal/G2.9, the second half: timestamped presence-proof per ID, the same record sent to the browser and persisted.
// Red on today's tree. This replaces the event half (the peer-seen event is dropped; nothing new on /api/events).
//   RULED (Andy, 2026-10-02, verbatim): "you seem to agree that presece data is (ID<->true) so there should be only
//   one type of event. you can keep calling that job (permanent / relay-presence) because that's what it seems to be
//   doing. but the events it emits, i assume timestamped presence-proof....", "a second event-type is superfluous,
//   rename the one event-type or not, nothing stops presence for relays and peers to be the exact same shape",
//   "i would expect the thing you update the shadow-roll with to be the thing that's sent to the browser?", "yes, my
//   OCD likes the idea of the same-data being persisted that is sent to the browser. and it's precisely :
//   timestamped presence by ID (not node, relays are not nodes)", "that i'd agree to."
// The contract the builder follows (the shape agreed in goal/G2.9's box):
//   1. The job's data stays `presence`, keyed by ID, but every value is a proof {present: true|false, at: <ms since
//      epoch, the moment of the latest word>} — relays and peers the exact same shape, the node's own key too. No
//      boolean value remains anywhere in the table (the old shape is gone, not kept beside the new one).
//   2. Every word lands the same way — a relay's broadcast, the open's seed and reconcile, heard() — and stamps `at`
//      with the time of that word; a later word replaces the proof, `at` moving forward. Across relays the merge is
//      as before (present anywhere wins), the proof carrying the at of the word that won.
//   3. One event type, as today: job-updated for the job, carrying the whole table; nothing new on /api/events.
//   4. The same record is persisted: every change to a drawn ID's proof is written to the shadow by presenceNode,
//      through the noteSeen it is handed, as {present, at} — the one writer; an ID not in the book (not drawn) is not
//      written by presenceNode (its caller noted the route already).
//   5. Contacts paints the dot from the proof: present true green, false red, no proof white; its title names the
//      state as before (the age may follow later — not asserted).
// Suites asserting the old shape (presence[key] === true: presenceNode, presenceReconcile, presenceFeeding,
// presenceWire and friends) go red on the build and are flipped to the proof by the builder — the handover.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const presenceNode = require('../run/js/presenceNode');
const relayKeys = require('../run/js/relayKeys');
const spirit = require('../run/js/kernel.js');
const hubModule = require('../run/js/hub.js');

const OWED = 'OWED by goal/G2.9: ';
const JOHN = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnjohnjohn=';
const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const ZOE = 'MCowBQYDK2VwAyEAzoezoezoezoezoezoezoezoezoezoezoezoe=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';
const DAVE = 'MCowBQYDK2VwAyEAdavedavedavedavedavedavedavedavedave=';
const RELAY = 'http://a';
const RELAY_B = 'http://b';
const RELAYKEY = 'MCowBQYDK2VwAyEArelayrelayrelayrelayrelayrelayrelayre=';
const APP_SCRIPT = path.join(__dirname, '..', 'run', 'shell', 'contacts', 'contacts.js');

function tmpHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-proof-')); }
function keyDoor() { return Promise.resolve({ status: 200, text: JSON.stringify({ relayPublicKey: RELAYKEY, relayLabel: 'lab' }) }); }
function fakeJobs() {
  const j = { updates: [], job: null };
  j.createJob = function (kind, type, data) { j.job = { id: 'job_1', kind: kind, type: type, data: data }; return j.job; };
  j.updateJob = function (id, patch) { if (patch.data) Object.assign(j.job.data, patch.data); j.updates.push(patch); return j.job; };
  return j;
}
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
function isProof(v) { return !!v && typeof v === 'object' && typeof v.present === 'boolean' && typeof v.at === 'number' && v.at > 1500000000000; }
function describe(v) { return JSON.stringify(v); }

// A node with john and bert in its book, pinned on two relays; the reconcile answers john at relay a.
function node() {
  const home = tmpHome();
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'a', url: RELAY }, { label: 'b', url: RELAY_B }]));
  [RELAY, RELAY_B].forEach(function (u) { relayKeys.seat(home, u, 'me'); relayKeys.accept(home, u, RELAYKEY); });
  const book = {}; book[JOHN] = true; book[BERT] = true;
  const noted = [];
  const router = {
    onRequest: function () {}, onReply: function () {},
    post: function (url, toKey, text) {
      let body = null; try { body = JSON.parse(text).body; } catch (e) { body = null; }
      if (body && body.search && url === RELAY) return Promise.resolve({ text: JSON.stringify({ body: { ok: true, matches: [{ publicKey: JOHN, publicLabel: 'John' }], more: false } }) });
      return Promise.resolve({ text: JSON.stringify({ body: { ok: true, matches: [], more: false } }) });
    },
  };
  const jobs = fakeJobs();
  const streams = {};
  const P = presenceNode.createPresence({
    rootDir: home, jobs: jobs, router: router,
    knows: function (key) { return book[key] === true; },
    noteSeen: function (key, what) { noted.push({ key: key, what: what }); },
    connectImpl: function (o) { streams[o.url.split('/api/')[0]] = o; return { close: function () {} }; },
  });
  return { me: me, P: P, jobs: jobs, noted: noted, streams: streams };
}

// The Contacts page, mounted as spirit/test/contactsFilter.js mounts it, its jobs subscription captured.
function mountContacts(people) {
  const byId = {};
  function fakeElement(id) {
    let html = '';
    const el = { id: id, value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {}, hidden: false,
      addEventListener: function (ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
      appendChild: function (c) { el.children.push(c); return c; }, focus: function () {} };
    Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
    return el;
  }
  const doc = { byId: byId, activeElement: null, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, createElement: fakeElement };
  const fakeFetch = function (url, init) {
    const sent = (function () { try { return JSON.parse((init && init.body) || '{}'); } catch (e) { return {}; } })();
    let answer;
    if (sent.verb === 'contact.search') { const r = hubModule.searchPeople(people, sent.q); answer = { ok: true, items: r.items, more: r.more, selfTail: null }; }
    else if (sent.verb === 'contact.senders') answer = { ok: true, policy: 'silent' };
    else answer = { ok: true, people: people, selfTail: null, matches: [] };
    const t = JSON.stringify(answer);
    return Promise.resolve({ status: 200, text: function () { return Promise.resolve(t); }, json: function () { return Promise.resolve(JSON.parse(t)); } });
  };
  let behavior = null;
  let subscriber = null;
  const shellSpirit = {
    shell: { activateApp: function (b) { behavior = b; }, fileInfoRow: function (l, v) { return '<div>' + l + v + '</div>'; }, factRow: function () { return ''; } },
    core: {
      ask: test.browserAsk(fakeFetch),
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      const: { ICON: spirit.core.const.ICON },
      jobs: { subscribe: function (s) { subscriber = s; return function () {}; } },
    },
  };
  new Function('spirit', 'document', 'window', 'fetch', fs.readFileSync(APP_SCRIPT, 'utf8'))(shellSpirit, doc, {}, fakeFetch);
  const api = {
    verb: function (name, args) {
      const payload = { verb: String(name) };
      if (args) Object.keys(args).forEach(function (k) { payload[k] = args[k]; });
      return fakeFetch('/api/spirit', { method: 'POST', body: JSON.stringify(payload) }).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t, body: JSON.parse(t) }; }); });
    },
    escapeHtml: spirit.core.util.escapeHtml, launchApp: function () {}, callDialog: function () { return Promise.resolve(null); },
    peerPost: function () { return Promise.resolve({ ok: false }); }, readProject: function () { return null; },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  };
  behavior.mount(fakeElement('container'), api, null);
  return { doc: doc, feed: function (job) { if (subscriber && subscriber.onUpdate) subscriber.onUpdate(job); } };
}
function person(key, label) { return { publicKey: key, publicLabel: label, caption: label, myLabel: '', choice: 'added', blocked: false, present: null }; }
// The presence cell of one row: the first icon cell after the row's opening tag.
function dotOf(doc, key) {
  const html = doc.getElementById('contacts-tbody').innerHTML;
  const i = html.indexOf('data-contact-row="' + key + '"');
  if (i === -1) return '';
  const row = html.slice(i, html.indexOf('</tr>', i));
  const m = row.match(/<td class="icon-cell" title="([^"]*)">([^<]*)<\/td>/);
  return m ? m[2] + ' | ' + m[1] : '';
}

test.startTest('goal/G2.9: timestamped presence-proof per ID, sent to the browser and persisted alike');

(async function () {
  test.subHeading('1, 2. every word is a proof {present, at}, relays and peers alike, the newest word winning');
  const n = node();
  await n.P.start(keyDoor);
  const sa = n.streams[RELAY], sb = n.streams[RELAY_B];
  if (!sa || !sb) { test.fail(OWED + 'streams were not opened to both relays — the fixture cannot drive them'); return; }
  const t0 = Date.now();
  sa.onOpen();
  await settled();
  const seeded = n.P.table();
  if (isProof(seeded[RELAYKEY]) && seeded[RELAYKEY].present === true && isProof(seeded[n.me.publicKey]) && isProof(seeded[JOHN]) && seeded[JOHN].present === true) {
    test.check('the open seeds the relay and this node as proofs, and the reconcile lands john as one — all {present, at}');
  } else test.fail(OWED + 'after the open the table reads relay ' + describe(seeded[RELAYKEY]) + ', self ' + describe(seeded[n.me.publicKey]) + ', john ' + describe(seeded[JOHN]));
  sa.onEvent({ event: 'presence', data: { key: BERT, present: true } });
  const b1 = n.P.table()[BERT];
  if (isProof(b1) && b1.present === true && b1.at >= t0 && b1.at <= Date.now()) test.check('a present broadcast is a proof stamped with the moment it was heard');
  else test.fail(OWED + 'bert after a present broadcast: ' + describe(b1));
  await new Promise(function (r) { setTimeout(r, 5); });
  sa.onEvent({ event: 'presence', data: { key: BERT, present: false } });
  const b2 = n.P.table()[BERT];
  if (isProof(b2) && b2.present === false && b1 && b2.at > b1.at) test.check('an absent broadcast replaces it: present false, at moved forward');
  else test.fail(OWED + 'bert after an absent broadcast: ' + describe(b2) + ' (was ' + describe(b1) + ')');
  await new Promise(function (r) { setTimeout(r, 5); });
  if (typeof n.P.heard === 'function') {
    n.P.heard(RELAY, BERT);
    const b3 = n.P.table()[BERT];
    if (isProof(b3) && b3.present === true && b3.at > b2.at) test.check('heard() lands the same shape, the newest word winning');
    else test.fail(OWED + 'bert after heard: ' + describe(b3));
  } else test.fail('presenceNode has no heard() — the feeding half (eaf52db2) is missing from this tree');
  sb.onOpen();
  await settled();
  sb.onEvent({ event: 'presence', data: { key: BERT, present: false } });
  const merged = n.P.table()[BERT];
  if (isProof(merged) && merged.present === true) test.check('across relays present still wins: a says present, b says absent — green, as a proof');
  else test.fail(OWED + 'bert merged across a (present) and b (absent): ' + describe(merged));
  const booleans = Object.keys(n.P.table()).filter(function (k) { return typeof n.P.table()[k] !== 'object'; });
  if (booleans.length === 0) test.check('no boolean value remains in the table: the old shape is gone');
  else test.fail(OWED + 'boolean values still in the table for ' + booleans.length + ' key(s): ' + describe(booleans.map(function (k) { return [k.slice(-8), n.P.table()[k]]; })));

  test.subHeading('3. one event type: the job carries the proofs, and only the job');
  const last = n.jobs.updates.filter(function (u) { return u.data && u.data.presence; }).pop();
  const jb = last && last.data.presence[BERT];
  if (isProof(jb) && jb.present === true) test.check('the latest job-updated carries bert\'s proof, present true with its stamp');
  else test.fail(OWED + 'the latest job update carries bert as ' + describe(jb));

  test.subHeading('4. the same record is persisted: presenceNode writes each drawn proof to the shadow');
  const johnNotes = n.noted.filter(function (x) { return x.key === JOHN && x.what && typeof x.what.present === 'boolean'; });
  const bertNotes = n.noted.filter(function (x) { return x.key === BERT && x.what && typeof x.what.present === 'boolean'; });
  const lastBert = bertNotes[bertNotes.length - 1];
  if (johnNotes.length >= 1 && bertNotes.length >= 3 && lastBert && typeof lastBert.what.at === 'number') {
    test.check('john once (the reconcile), bert on each word (present, absent, heard, ...), each note {present, at} — the record the browser got');
  } else test.fail(OWED + 'shadow notes with present: john ' + johnNotes.length + ', bert ' + bertNotes.length + ' (last ' + describe(lastBert && lastBert.what) + ')');
  sa.onEvent({ event: 'presence', data: { key: ZOE, present: true } });
  const zoeProof = n.noted.filter(function (x) { return x.key === ZOE && x.what && typeof x.what.present === 'boolean'; });
  if (zoeProof.length === 0 && n.P.table()[ZOE] === undefined) test.check('zoe, not in the book, is neither drawn nor written as a proof by presenceNode (her route is her caller\'s note)');
  else test.fail(OWED + 'zoe: proof notes ' + zoeProof.length + ', table ' + describe(n.P.table()[ZOE]));

  test.subHeading('5. Contacts paints the dot from the proof');
  const page = mountContacts([person(BERT, 'Bert'), person(CAROL, 'Carol'), person(DAVE, 'Dave')]);
  await settled();
  const now = Date.now();
  const table = {}; table[BERT] = { present: true, at: now }; table[CAROL] = { present: false, at: now };
  page.feed({ id: 'job_9', type: 'relay-presence', kind: 'permanent', data: { presence: table } });
  await settled();
  const ICON = spirit.core.const.ICON;
  const db = dotOf(page.doc, BERT), dc = dotOf(page.doc, CAROL), dd = dotOf(page.doc, DAVE);
  if (db.indexOf(ICON.GREEN_CIRCLE) === 0 && dc.indexOf(ICON.RED_CIRCLE) === 0 && dd.indexOf(ICON.WHITE_CIRCLE) === 0) {
    test.check('bert green, carol red, dave white — from proofs, not booleans');
  } else test.fail(OWED + 'dots from proofs: bert ' + describe(db) + ', carol ' + describe(dc) + ', dave ' + describe(dd));
  if (/present/.test(db) && /absent/.test(dc)) test.check('and the titles still name the state');
  else test.fail(OWED + 'titles: bert ' + describe(db) + ', carol ' + describe(dc));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
