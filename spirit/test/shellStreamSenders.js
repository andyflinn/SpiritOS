'use strict';

// spirit/test/shellStreamSenders.js
// goal/G19.8: the shell delivers a streamed published object only from a sender it asked for.
//
//   Andy, 2026-10-12: "The shell takes only streams from ID's that it explicitly or implicitly asks for. Implicit
//   is: the own local node, and any puppet owned, including owned relays."
//
// A packet named published (a puppet's stream, goal/G14.5) used to reach every onPublished handler of its module
// whatever key sent it, so any contact could push objects into the master's apps: a change:1e12 freezes the desk
// view, a fake chat line names another peer. The shell now checks the sender ONCE, before any app sees it:
//
//   implicit   this node's own key (node.card), the key of every relay this node OWNS (relay rows with owned and
//              roll.relayKey), and every contact marked owned (contact.search with owned: 'yes', owned read
//              from each row's json label, goal/G29.6) - for every app;
//   explicit   a key an app names when it subscribes: api.onPublished(fn, server, { from: [key, ...] }) - for that
//              handler only;
//   anything else is dropped there, for every app, with one console line per dropped sender.
//
// THE OWNED PUPPET (Andy, 2026-10-12): "puppet is just a flag in the contact list", "or even better, with your
// damned ownerBadge", "so the relays owner code and the puppets owner code should be the same." A puppet's signed
// card names its owner (nodeCard, from owner.json); contacts.setCard marks the row owned through ownerBadge.ownedBy,
// the one comparison probe makes for a relay's answer; contact.search's json label carries the mark (goal/G29.6).
// Section 4 is the node side.
// deskAgentRemote named its puppets to the shell before this; that fallback is gone (section 3).
//
// Driven as listeningApp.js drives the real shell.js: small document, fs and jobs stubs, a fake ask.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel');
const packet = require('../run/spirit/client/packet');

const OWED = 'OWED by goal/G19.8: ';
const RUN = path.join(__dirname, '..', 'run');
const SHELL = path.join(RUN, 'spirit', 'client', 'shell.js');
const REMOTE = path.join(RUN, 'shell', 'deskAgentRemote', 'deskAgentRemote.js');

const OWN = 'OWN-NODE-KEY';
const RELAY = 'OWNED-RELAY-KEY';
const MEMBER_RELAY = 'MEMBER-RELAY-KEY';   // a relay this node merely sits on: not owned
const PUPPET = 'PUPPET-KEY';               // a contact whose card names this node: owned
const NOT_OWNED = 'NOT-OWNED-KEY';         // a contact found by the search whose card names another owner
const LATE = 'LATE-PUPPET-KEY';            // a puppet whose card the master fetches while the page is open
const NAMED = 'NAMED-KEY';                 // a key one handler asked to hear
const STRANGER = 'STRANGER-KEY';

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

function fakeElement(tag) {
  let html = '';
  const attrs = {};
  const el = {
    tag: tag, className: '', textContent: '', hidden: false, style: {}, children: [],
    appendChild: function (child) { el.children.push(child); return child; },
    addEventListener: function () {},
    querySelector: function () { return fakeElement('div'); },
    querySelectorAll: function () { return []; },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    remove: function () {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

const DESK_MANIFEST = { name: 'Desk', icon: 'THREAD', hidden: false, intrinsic: false, listens: ['agents'] };

function bootShell() {
  const byId = {};
  ['desktop', 'app-container', 'app-title', 'app-content', 'app-close', 'app-home']
    .forEach(function (id) { byId[id] = fakeElement('div'); });
  const doc = {
    body: fakeElement('body'),
    currentScript: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement('div')); },
    createElement: fakeElement,
    createDocumentFragment: function () { return fakeElement('fragment'); },
  };
  const asked = [];
  const searches = [];            // the args of every contact.search the shell sent
  const book = { late: false };   // LATE's card arrives later in the test
  function answer(body) { return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body }); }
  // The book as hub.js labels it since goal/G29.6: a JSON string {name, owned, blocked, held}, no words appended.
  function label(name, owned) { return JSON.stringify({ name: name, owned: owned, blocked: false, held: false }); }
  function rows() {
    return [{ key: PUPPET, label: label('pup', true) }, { key: NOT_OWNED, label: label('owned-by-someone', false) }]
      .concat(book.late ? [{ key: LATE, label: label('late', true) }] : []);
  }
  const subscribers = [];
  const shellSpirit = {
    core: {
      ask: function (verb, args) {
        asked.push(verb);
        if (verb === 'node.card') return answer({ ok: true, name: 'me', description: '', publicKey: OWN, descriptionMax: 0 });
        // goal/G29.6: contact.search honours the owned: 'yes' filter beside q, as hub.searchPeople does; no word
        // 'owned' to search for, and no contact.get to confirm a hit (this fake answers no contact.get at all).
        if (verb === 'contact.search') {
          searches.push(args || {});
          const owned = args && args.owned === 'yes';
          return answer({ ok: true, items: rows().filter(function (r) { return !owned || JSON.parse(r.label).owned === true; }), more: false });
        }
        return answer({ ok: false, code: 'no-such-verb' });
      },
      relays: {
        status: function () {
          asked.push('relays.status');
          return answer({ name: 'me', rows: [
            { url: 'https://owned.example', owned: true, claimed: true, roll: { relayKey: RELAY } },
            { url: 'https://member.example', owned: false, claimed: true, roll: { relayKey: MEMBER_RELAY } },
          ] });
        },
      },
      const: { ICON: kernel.core.const.ICON, MIME: {} },
      util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
      fs: {
        loadFile: function (rel) {
          if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
          if (rel === 'shell/natter/session.json') return JSON.stringify({ label: 'me', boundAt: '2026-09-13T00:00:00.000Z' });
          if (rel === 'shell/desk/desk.json') return JSON.stringify(DESK_MANIFEST);
          return null;
        },
        saveFile: function () { return Promise.resolve(); },
        statFile: function () { return null; },
        getAnnotations: function () { return {}; },
        createScopedFs: function () { return {}; },
      },
      jobs: { subscribe: function (handlers) { subscribers.push(handlers); } },
    },
  };
  new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(
    shellSpirit, doc, function () {}, test.withSpirit({ 'spirit.packet': packet, 'spirit.limits': require('../run/spirit/limits.js') }));
  subscribers.forEach(function (h) {
    if (typeof h.onSnapshot === 'function') h.onSnapshot([{ id: 'fs-watcher-1', type: 'fs-watcher', data: {} }]);
    if (typeof h.onUpdate === 'function') {
      ['shell', 'shell/desk'].forEach(function (p) { h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createDirectory', path: p, at: '' } } }); });
      h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { command: { op: 'createFile', path: 'shell/desk/desk.js', at: '' } } });
      h.onUpdate({ id: 'fs-watcher-1', type: 'fs-watcher', data: { treeComplete: true } });
    }
  });
  const wired = subscribers.filter(function (h) { return typeof h.onPacket === 'function'; })[0];
  const scripts = function () { return doc.body.children.filter(function (c) { return c.tag === 'script'; }); };
  let n = 0;
  return {
    asked: asked,
    searches: searches,
    book: book,
    scripts: scripts,
    // A puppet's stream as it reaches the page: a packet named published, {module, app}, from a key.
    stream: function (fromKey, module, app) {
      n += 1;
      wired.onPacket({ hash: 'h' + n, fromKey: fromKey, from: fromKey, text: packet.encode('published', { module: module, app: app }).text, sentAt: '2026-10-12T06:00:00Z' });
    },
    load: function (behavior) {
      const script = scripts()[0];
      doc.currentScript = script;
      shellSpirit.shell.activateApp(behavior);
      doc.currentScript = null;
      script.onload();
    },
  };
}

// The apps that took streamed objects without looking at the sender (chatter, desk, deskDetails, ruleDetails),
// each subscribed as it is in the tree, plus deskVerify's tab in desk, deskAgentRemote as it subscribes, and one
// handler that names a key.
function mountAll(page) {
  const got = [];
  function take(who) { return function (obj, meta) { got.push({ who: who, from: (meta && meta.from) || '', obj: obj }); }; }
  page.load({
    mount: function (el, api) {
      api.onPublished(take('chatter'), 'chatClerver');
      api.onPublished(take('desk'));
      api.onPublished(take('deskVerify'), 'deskVerify');
      api.onPublished(take('deskDetails'), 'desk');
      api.onPublished(take('ruleDetails'), 'desk');
      api.onPublished(take('deskAgentRemote'), 'deskAgent');
      api.onPublished(take('namer'), 'deskAgent', { from: [NAMED] });
    },
  });
  return got;
}

function names(list) { return list.map(function (g) { return g.who; }).sort().join(','); }

// THE NODE SIDE, in temp homes: a master, its puppet, and somebody else's.
async function nodeSide() {
  const auth = require('../run/spirit/relayAuth');
  const nodeCard = require('../run/spirit/nodeCard');
  const ownerBadge = require('../run/spirit/ownerBadge');
  const book = require('../run/spirit/contacts');
  const hub = require('../run/spirit/hub');
  const homes = [];
  function home(name) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-g198-'));
    const id = auth.generateIdentity(name);
    auth.saveIdentity(dir, id);
    homes.push(dir);
    return { dir: dir, id: id };
  }
  try {
    const master = home('master');
    const other = home('other');
    const puppet = home('puppet');
    const loose = home('loose');
    auth.writeOwner(puppet.dir, master.id.publicKey);

    // ONE COMPARISON for a relay's answer and a card.
    if (typeof ownerBadge.ownedBy === 'function' && ownerBadge.ownedBy('K', 'K') === true &&
        ownerBadge.ownedBy('K', 'L') === false && ownerBadge.ownedBy('', '') === false && ownerBadge.ownedBy('K', '') === false) {
      test.check('ownerBadge.ownedBy(said, mine): true only for the same non-empty key');
    } else test.fail(OWED + 'ownerBadge.ownedBy missing or wrong');
    const badgeSrc = fs.readFileSync(path.join(RUN, 'spirit', 'ownerBadge.js'), 'utf8');
    if (/owned: ownedBy\(said && said\.ownerKey, myKey\)/.test(badgeSrc)) test.check('probe marks a relay owned through ownedBy');
    else test.fail(OWED + 'probe does not use ownedBy');
    const contactsSrc = fs.readFileSync(path.join(RUN, 'spirit', 'contacts.js'), 'utf8');
    if (/ownerBadge\.ownedBy\(fields\.owner/.test(contactsSrc) && !/puppet/i.test(contactsSrc.replace(/\/\/.*$/gm, ''))) test.check('setCard marks a contact through the same ownedBy, with no puppet-only branch');
    else test.fail(OWED + 'setCard does not mark through ownerBadge.ownedBy');

    // The master's book: the puppet and a loose node, both added by invite, each card fetched (keepCard -> setCard).
    book.upsert(master.dir, { publicKey: puppet.id.publicKey, publicLabel: 'pup', acquiredVia: 'invite' });
    book.upsert(master.dir, { publicKey: loose.id.publicKey, publicLabel: 'loose', acquiredVia: 'invite' });
    const kept = book.setCard(master.dir, puppet.id.publicKey, nodeCard.describe(puppet.dir), 'reply');
    book.setCard(master.dir, loose.id.publicKey, nodeCard.describe(loose.dir), 'reply');
    const pRow = book.byPublicKey(master.dir, puppet.id.publicKey);
    const lRow = book.byPublicKey(master.dir, loose.id.publicKey);
    if (kept && kept.ok && pRow && pRow.owned === true && lRow && lRow.owned === false) test.check('a card naming this node marks the row owned; a card naming no owner marks it not owned');
    else test.fail(OWED + 'rows: puppet ' + JSON.stringify(pRow && pRow.owned) + ' (' + JSON.stringify(kept) + '), loose ' + JSON.stringify(lRow && lRow.owned));

    // Never flushed by a refresh: an upsert (a relabel, a roll sighting) keeps the mark.
    book.upsert(master.dir, { publicKey: puppet.id.publicKey, publicLabel: 'pup2' });
    book.setMyLabel(master.dir, puppet.id.publicKey, 'my puppet');
    const again = book.setCard(master.dir, puppet.id.publicKey, nodeCard.describe(puppet.dir), 'reply');
    const kept2 = book.byPublicKey(master.dir, puppet.id.publicKey);
    if (kept2 && kept2.owned === true && again && again.ok === false) test.check('a refresh, a relabel and the same card offered again leave the mark as it is');
    else test.fail(OWED + 'after a refresh owned is ' + JSON.stringify(kept2 && kept2.owned) + ', re-offer ' + JSON.stringify(again));

    // The contact as the page reads it (goal/G29.6): contact.search with owned: 'yes' answers the puppet alone, its
    // json label saying owned; the loose node is left out.
    const people = hub.buildPeople(master.dir);
    const pp = people.filter(function (p) { return p.publicKey === puppet.id.publicKey; })[0];
    const lp = people.filter(function (p) { return p.publicKey === loose.id.publicKey; })[0];
    const found = hub.searchPeople(people, '', { owned: 'yes' });
    const foundItems = found.items || [];
    let foundLabel = null;
    try { foundLabel = foundItems.length === 1 ? JSON.parse(foundItems[0].label) : null; } catch (e) { foundLabel = null; }
    if (pp && pp.owned === true && lp && lp.owned === false && foundItems.length === 1 && foundItems[0].key === puppet.id.publicKey &&
        foundLabel && foundLabel.owned === true) {
      test.check('buildPeople passes owned through, and searchPeople(people, \'\', { owned: \'yes\' }) answers the puppet only: ' + foundItems[0].label);
    } else test.fail('goal/G29.6: people: puppet ' + JSON.stringify(pp && pp.owned) + ', loose ' + JSON.stringify(lp && lp.owned) + ', owned: yes -> ' + JSON.stringify(foundItems));

    // A newer verified card naming a different owner clears it.
    auth.writeOwner(puppet.dir, other.id.publicKey);
    const moved = book.setCard(master.dir, puppet.id.publicKey, nodeCard.describe(puppet.dir), 'reply');
    const mRow = book.byPublicKey(master.dir, puppet.id.publicKey);
    if (moved && moved.ok && mRow && mRow.owned === false) test.check('a newer card naming another owner clears the mark');
    else test.fail(OWED + 'after the owner moved: ' + JSON.stringify(mRow && mRow.owned) + ' ' + JSON.stringify(moved));
  } finally {
    homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ } });
  }
}

test.startTest('goal/G19.8: the shell takes streamed objects only from senders it asked for');

(async function () {
  const realWarn = console.warn;
  const warned = [];
  console.warn = function () { warned.push(Array.prototype.join.call(arguments, ' ')); };
  try {
    test.subHeading('1. own node, owned relay, a named key: delivered; anything else dropped before any app');
    const page = bootShell();
    const got = mountAll(page);

    // (e) a stranger first, before the shell has learned anything: still never delivered.
    page.stream(STRANGER, 'process/js/desk', { change: 1e12 });
    page.stream(STRANGER, 'process/js/chatClerver', { lines: [{ from: OWN, text: 'fake' }] });
    page.stream(STRANGER, 'process/js/deskVerify', { verdict: 'green' });
    page.stream(STRANGER, 'process/js/deskAgent', { chat: { id: 'x', done: true, text: 'fake' } });
    page.stream(MEMBER_RELAY, 'process/js/desk', { change: 1e12 });
    await settled();
    page.stream(STRANGER, 'process/js/desk', { change: 2e12 });
    await settled();
    const fromStranger = got.filter(function (g) { return g.from === STRANGER || g.from === MEMBER_RELAY; });
    if (!fromStranger.length) test.check('(e) a stranger\'s objects, and a relay this node only sits on, reach no app: not desk (a change:1e12), chatter, deskDetails, ruleDetails, deskVerify or deskAgentRemote');
    else test.fail(OWED + 'a stranger reached ' + JSON.stringify(fromStranger.map(function (g) { return g.who + ' ' + JSON.stringify(g.obj); })));
    const strangerLines = warned.filter(function (w) { return w.indexOf(STRANGER) !== -1; });
    if (strangerLines.length === 1) test.check('one console line for the dropped sender, not one per object');
    else test.fail(OWED + 'console lines for the stranger: ' + strangerLines.length + ' ' + JSON.stringify(warned));

    // (a) own node.
    got.length = 0;
    page.stream(OWN, 'process/js/desk', { items: 1 });
    await settled();
    if (names(got) === 'desk,deskDetails,ruleDetails') test.check('(a) an object from this node\'s own key reaches every app of its module');
    else test.fail(OWED + 'own node: got ' + names(got));

    // (c) owned relay.
    got.length = 0;
    page.stream(RELAY, 'process/js/chatClerver', { lines: [] });
    await settled();
    if (names(got) === 'chatter') test.check('(c) an object from a relay this node owns reaches the apps of its module');
    else test.fail(OWED + 'owned relay: got ' + names(got));

    // (b) an owned puppet: a contact marked owned, heard by every app.
    got.length = 0;
    page.stream(PUPPET, 'process/js/desk', { items: 4 });
    page.stream(PUPPET, 'process/js/deskAgent', { server: { answers: true } });
    await settled();
    if (names(got) === 'desk,deskAgentRemote,deskDetails,namer,ruleDetails') test.check('(b) a contact marked owned (its card names this node) reaches every app of each module, with no app naming it');
    else test.fail(OWED + 'owned puppet: got ' + names(got));

    // A contact in the book whose card names another owner is a stranger.
    got.length = 0;
    page.stream(NOT_OWNED, 'process/js/desk', { change: 1e12 });
    await settled();
    if (!got.length) test.check('a contact whose card names another owner, or none, is dropped');
    else test.fail(OWED + 'a contact not owned reached ' + names(got));
    // goal/G29.6 (Andy: "why would owned not be a binary filter, owned or not?"): one contact.search with q '' and
    // owned: 'yes', owned read from each row's json label; no search for the word 'owned', no contact.get per hit.
    const ownedAsks = page.searches.filter(function (a) { return a.owned === 'yes' && String(a.q == null ? '' : a.q) === ''; });
    const wordAsks = page.searches.filter(function (a) { return /owned/.test(String(a.q || '')); });
    if (ownedAsks.length && !wordAsks.length && page.asked.indexOf('contact.get') === -1) test.check('the owned contacts are read through contact.search with owned: \'yes\', no word search, no contact.get, no new verb');
    else test.fail('goal/G29.6: contact.search args ' + JSON.stringify(page.searches) + ', asked ' + JSON.stringify(page.asked));

    // (d) a key an app named: that handler only.
    got.length = 0;
    page.stream(NAMED, 'process/js/deskAgent', { server: { answers: true } });
    await settled();
    if (names(got) === 'namer') test.check('(d) a key an app named reaches that handler, and not a handler of the same module that did not name it');
    else test.fail(OWED + 'named key: got ' + names(got));

    // The same named key on another module reaches no one there.
    got.length = 0;
    page.stream(NAMED, 'process/js/desk', { change: 3e12 });
    await settled();
    if (!got.length) test.check('a key named for one server is not heard on another');
    else test.fail(OWED + 'a key named for deskAgent reached ' + names(got));

    // A puppet whose card arrives after the shell asked: dropped until the ask is a minute old, then heard.
    got.length = 0;
    page.stream(LATE, 'process/js/desk', { items: 5 });
    await settled();
    page.book.late = true;
    page.stream(LATE, 'process/js/desk', { items: 6 });
    await settled();
    const realNow = Date.now;
    const later = realNow() + 61000;
    Date.now = function () { return later; };
    try {
      page.stream(LATE, 'process/js/desk', { items: 7 });
      await settled();
    } finally { Date.now = realNow; }
    if (got.map(function (g) { return g.obj.items; }).join(',') === '7,7,7') test.check('a puppet marked owned after the shell asked is heard once the ask is a minute old, and not before');
    else test.fail(OWED + 'late puppet: got ' + JSON.stringify(got.map(function (g) { return g.who + ' ' + JSON.stringify(g.obj); })));

    test.subHeading('2. a late subscriber is handed only what it may take');
    const late = [];
    const page2 = bootShell();
    page2.stream(STRANGER, 'process/js/desk', { change: 1e12 });
    page2.stream(OWN, 'process/js/desk', { items: 2 });
    await settled();
    page2.load({ mount: function (el, api) { api.onPublished(function (obj, meta) { late.push((meta && meta.from) + ' ' + JSON.stringify(obj)); }); } });
    await settled();
    if (late.length === 1 && late[0] === OWN + ' {"items":2}') test.check('an app opened later gets the own node\'s last object and never the stranger\'s');
    else test.fail(OWED + 'late subscriber got ' + JSON.stringify(late));

    // ERADICATED, NOT LEFT BESIDE (Andy, "eradicate what you replace"): the shell hears owned puppets itself now.
    test.subHeading('3. deskAgentRemote no longer names its puppets to the shell; its target check stays');
    const remote = fs.readFileSync(REMOTE, 'utf8').replace(/\r\n/g, '\n');
    if (!/deskAgentRemotePuppetKeys/.test(remote) && !/'deskAgent', \{ from:/.test(remote)) test.check('the naming-its-puppets fallback is gone from deskAgentRemote');
    else test.fail(OWED + 'deskAgentRemote still names its puppets to the shell');
    if (/function deskAgentRemoteTakesPublished\(target, meta\)/.test(remote) && /deskAgentRemoteTakesPublished\(deskAgentRemoteTarget, meta/.test(remote)) test.check('and it still takes only the chosen target\'s stream');
    else test.fail('deskAgentRemote lost its target check');

    test.subHeading('4. the node: the card names the owner, ownerBadge decides, the contact row carries it');
    await nodeSide();
  } finally {
    console.warn = realWarn;
  }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});

module.exports = test;
