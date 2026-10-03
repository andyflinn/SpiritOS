'use strict';

// spirit/test/fieldRules.js
// goal/G4.16: every label and description validated at one point, js/fieldRules.js. RED on today's tree: the file is
// js/labelRule.js, a label is capped at 256 bytes and 48 characters, a long description is cut, and your own name for
// a peer and a peer's label added or held by hand are checked nowhere.
//
//   Andy, 2026-10-03, his go-all on goal/G4; the rulings stand verbatim in the box of goal/G4.16: "labelRule.js should
//   be corrected to specify a max in term of bytes only."; "this rule applies for all text fields in node from now
//   on."; "all occurrences of label and description must validate at a central point, the already misnamed
//   labelRule.js is the place. this cleanup gets its own item, and the permission to touch the core relates to that
//   item alone."; "fieldRules.js  it becomes a bucket for field validation."; "In this context the shell may as well
//   rule that inputs themselves implement constraints in fieldRules.js."; "too-long refused"; "64 bytes max for
//   labels."; "description 128 bytes is alright."
//
// THE CONTRACT (the box of goal/G4.16).
//   1. THE NAME: js/labelRule.js becomes js/fieldRules.js; nothing under spirit/run or spirit/test names labelRule or
//      its browser global spiritLabelRule any more; index.html loads /js/fieldRules.js; in a browser the file sets
//      window.spiritFieldRules (the old global, renamed with the file).
//   2. A LABEL: at most 64 bytes, counted after normalising; no character count (MAX_GRAPHEMES gone). The invisible
//      stays refused, as now.
//   3. A DESCRIPTION: at most 128 bytes, refused when over, never cut: by the rule (describeProblem), by the node's
//      store (relayAuth.setDescription keeps nothing), and by the verb (node.setDescription answers a refusal).
//   4. YOUR OWN NAME FOR A PEER (contact.label, hub.js handlePeer): checked by the rule; a bad one is refused and
//      nothing changes. Empty stays allowed: clearing your own name for somebody is an ordinary edit.
//   5. A PEER'S LABEL GIVEN BY HAND: on contact.block of a key with no row, and on peer.acquire, a publicLabel the
//      rule refuses is refused, nothing written. Empty stays allowed (a pasted key has no label yet).
//   6. THE SHELL INPUT checks before it asks: contactsDetails' My Label field posts no contact.label for a name the
//      rule refuses.
// NOT ASSERTED, the builder's: the wording and codes of the refusals; how a screen shows one; the suites that name
// 48 or 256 (fileCap, labRefusals, playPopulate) move with the change.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'owed by goal/G4.16: ';
const RULE_FILE = path.join(RUN, 'js', 'fieldRules.js');
const OLD_FILE = path.join(RUN, 'js', 'labelRule.js');

const BIDI = '‮';
function ascii(n) { return 'a'.repeat(n); }

test.startTest('goal/G4.16: every label and description validated at one point, js/fieldRules.js');

function loadRule() {
  try { return require(RULE_FILE); } catch (e) { return null; }
}

// ── 1. THE NAME ──────────────────────────────────────────────────────

function walk(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules' || d.name === 'relay-state' || d.name === 'brains' || d.name.charAt(0) === '.') return;
      walk(p, out);
    } else if (/\.(js|html|json)$/.test(d.name)) out.push(p);
  });
  return out;
}

function theName() {
  test.subHeading('1. js/labelRule.js is js/fieldRules.js, and the old name is gone');
  if (fs.existsSync(RULE_FILE) && loadRule()) test.check('js/fieldRules.js exists and loads');
  else test.fail(OWED + 'there is no js/fieldRules.js');
  if (!fs.existsSync(OLD_FILE)) test.check('js/labelRule.js is gone');
  else test.fail(OWED + 'js/labelRule.js is still there');

  const me = path.resolve(__filename);
  // currentGoal.json is Desk's copy of the goal's chat, which quotes the old name; it is not code.
  const files = walk(RUN, []).concat(walk(__dirname, [])).filter(function (f) {
    return path.resolve(f) !== me && path.basename(f) !== 'currentGoal.json';
  });
  const naming = files.filter(function (f) { return /labelRule/.test(fs.readFileSync(f, 'utf8')); });
  if (naming.length === 0) test.check('no file under spirit/run or spirit/test names labelRule or spiritLabelRule');
  else test.fail(OWED + naming.length + ' files still name labelRule: ' + naming.map(function (f) { return path.relative(path.join(RUN, '..'), f); }).join(', '));

  const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  if (/<script src="\/js\/fieldRules\.js"><\/script>/.test(index)) test.check('index.html loads /js/fieldRules.js');
  else test.fail(OWED + 'index.html does not load /js/fieldRules.js');

  let win = {};
  try {
    new Function('window', 'process', 'module', fs.readFileSync(RULE_FILE, 'utf8'))(win, undefined, undefined);
  } catch (e) { win = {}; }
  if (win.spiritFieldRules && typeof win.spiritFieldRules.problem === 'function') test.check('in a browser it sets window.spiritFieldRules');
  else test.fail(OWED + 'in a browser the file sets no window.spiritFieldRules');
}

// ── 2. A LABEL ───────────────────────────────────────────────────────

function aLabel() {
  test.subHeading('2. a label is at most 64 bytes, and no character count');
  const rule = loadRule();
  if (!rule) { test.fail(OWED + 'no rule to ask (js/fieldRules.js)'); return; }
  if (rule.MAX_BYTES === 64) test.check('MAX_BYTES is 64');
  else test.fail(OWED + 'MAX_BYTES is ' + rule.MAX_BYTES);
  if (rule.MAX_GRAPHEMES === undefined) test.check('there is no MAX_GRAPHEMES');
  else test.fail(OWED + 'MAX_GRAPHEMES is still ' + rule.MAX_GRAPHEMES);
  if (rule.problem(ascii(64)) === '' && rule.problem(ascii(65)) !== '') test.check('64 plain letters pass, 65 are refused');
  else test.fail(OWED + '64 letters: "' + rule.problem(ascii(64)) + '"; 65 letters: "' + rule.problem(ascii(65)) + '"');
  if (rule.problem(ascii(49)) === '') test.check('49 letters pass (the 48-character cap is gone)');
  else test.fail(OWED + '49 letters refused: "' + rule.problem(ascii(49)) + '"');
  const emoji = '\u{1F600}';
  if (rule.problem(emoji.repeat(16)) === '' && rule.problem(emoji.repeat(17)) !== '') test.check('16 four-byte emoji pass, 17 are refused: bytes, not characters');
  else test.fail(OWED + '16 emoji: "' + rule.problem(emoji.repeat(16)) + '"; 17: "' + rule.problem(emoji.repeat(17)) + '"');
  if (rule.problem(ascii(64) + '   ') === '') test.check('counted after normalising: trailing spaces cost nothing');
  else test.fail(OWED + '64 letters and trailing spaces refused');
  if (rule.problem('bert' + BIDI) !== '') test.check('the invisible is still refused');
  else test.fail(OWED + 'a bidi override passed');
}

// ── 3. A DESCRIPTION ─────────────────────────────────────────────────

const auth = require('../run/js/relayAuth');

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fieldrules-'));
  auth.saveIdentity(home, auth.generateIdentity(name || 'owner'));
  return home;
}

function fakeRes() {
  const out = { status: 0, text: '', finished: false };
  out.writeHead = function (status) { out.status = status; };
  out.end = function (text) {
    out.text = String(text == null ? '' : text);
    out.finished = true;
    if (out.done) out.done(out);
  };
  out.wait = function () {
    return new Promise(function (resolve) {
      if (out.finished) { resolve(out); return; }
      out.done = resolve;
    });
  };
  return out;
}
function readBody(body) { return function () { return Promise.resolve(body); }; }
function within(p, ms) {
  return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]);
}

async function aDescription() {
  test.subHeading('3. a description is at most 128 bytes, refused when over, never cut');
  const rule = loadRule();
  if (rule) {
    if (rule.DESCRIPTION_MAX_BYTES === 128) test.check('DESCRIPTION_MAX_BYTES is 128');
    else test.fail(OWED + 'DESCRIPTION_MAX_BYTES is ' + rule.DESCRIPTION_MAX_BYTES);
    if (rule.describeProblem(ascii(128)) === '' && rule.describeProblem(ascii(129)) !== '' && rule.describeProblem('') === '') {
      test.check('the rule: 128 bytes pass, 129 are refused, empty passes');
    } else test.fail(OWED + 'describeProblem: 128 "' + rule.describeProblem(ascii(128)) + '", 129 "' + rule.describeProblem(ascii(129)) + '", empty "' + rule.describeProblem('') + '"');
  } else test.fail(OWED + 'no rule to ask (js/fieldRules.js)');

  const home = tmpHome();
  auth.setDescription(home, 'the one before');
  auth.setDescription(home, ascii(129));
  const kept = String((auth.loadIdentity(home) || {}).description || '');
  if (kept === 'the one before') test.check('the store: relayAuth.setDescription keeps nothing of 129 bytes');
  else test.fail(OWED + 'relayAuth.setDescription kept ' + kept.length + ' bytes of 129 (' + (kept === ascii(128) ? 'cut' : 'changed') + ')');
  auth.setDescription(home, ascii(128));
  if (String((auth.loadIdentity(home) || {}).description || '') === ascii(128)) test.check('and 128 bytes are kept whole');
  else test.fail(OWED + '128 bytes were not kept whole');

  const home2 = tmpHome();
  auth.setDescription(home2, 'the one before');
  const hub = require('../run/js/hub').createHub(home2);
  const res = fakeRes();
  hub.handleNodeDescription({}, res, readBody({ description: ascii(129) }));
  await within(res.wait(), 3000);
  const after = String((auth.loadIdentity(home2) || {}).description || '');
  if (res.status >= 400 && res.status < 500 && after === 'the one before') test.check('the verb: node.setDescription refuses 129 bytes, nothing changed');
  else test.fail(OWED + 'node.setDescription of 129 bytes answered ' + res.status + ', the description is now ' + after.length + ' bytes');
}

// ── 4. YOUR OWN NAME FOR A PEER ──────────────────────────────────────

const contactBook = require('../run/js/contacts');
const PEER = 'MCowBQYDK2VwAyEApeerpeerpeerpeerpeerpeerpeerpeerpeerp=';
const STRANGER = 'MCowBQYDK2VwAyEAstrangerstrangerstrangerstrangerstr=';
const OTHER = 'MCowBQYDK2VwAyEAotherotherotherotherotherotherother=';
const NEWCOMER = 'MCowBQYDK2VwAyEAnewcomernewcomernewcomernewcomernew=';
const FRIEND = 'MCowBQYDK2VwAyEAfriendfriendfriendfriendfriendfrien=';

async function ask(hub, action, body) {
  const res = fakeRes();
  hub.handlePeer({}, res, readBody(body), action);
  await within(res.wait(), 3000);
  return res;
}

async function yourOwnName() {
  test.subHeading('4. contact.label is checked by the rule; empty still clears');
  const home = tmpHome();
  contactBook.acquire(home, { publicKey: PEER, publicLabel: 'peer', relay: 'https://lab.example' }, 'handle');
  contactBook.setMyLabel(home, PEER, 'Pete');
  const hub = require('../run/js/hub').createHub(home);
  const mine = function () { return String((contactBook.byPublicKey(home, PEER) || {}).myLabel || ''); };

  const long = await ask(hub, 'label', { publicKey: PEER, myLabel: ascii(65) });
  if (long.status >= 400 && long.status < 500 && mine() === 'Pete') test.check('65 bytes are refused, the name stays');
  else test.fail(OWED + 'contact.label of 65 bytes answered ' + long.status + ', myLabel is now ' + mine().length + ' bytes');
  const hidden = await ask(hub, 'label', { publicKey: PEER, myLabel: 'Pe' + BIDI + 'te' });
  if (hidden.status >= 400 && hidden.status < 500 && mine() === 'Pete') test.check('a bidi override is refused, the name stays');
  else test.fail(OWED + 'contact.label with a bidi override answered ' + hidden.status + ', myLabel is now ' + JSON.stringify(mine()));
  const fine = await ask(hub, 'label', { publicKey: PEER, myLabel: ascii(64) });
  if (fine.status === 200 && mine() === ascii(64)) test.check('64 bytes are kept');
  else test.fail('contact.label of 64 bytes answered ' + fine.status);
  const cleared = await ask(hub, 'label', { publicKey: PEER, myLabel: '' });
  if (cleared.status === 200 && mine() === '') test.check('and empty clears it, an ordinary edit');
  else test.fail('contact.label with an empty name answered ' + cleared.status + ', myLabel ' + JSON.stringify(mine()));
}

// ── 5. A PEER'S LABEL GIVEN BY HAND ──────────────────────────────────

async function givenByHand() {
  test.subHeading('5. a publicLabel given by hand, on block and on acquire, is checked first');
  const home = tmpHome();
  const hub = require('../run/js/hub').createHub(home);

  const bad = await ask(hub, 'block', { publicKey: STRANGER, publicLabel: ascii(65) });
  if (bad.status >= 400 && bad.status < 500 && !contactBook.byPublicKey(home, STRANGER)) test.check('contact.block with a 65-byte label is refused, no row written');
  else test.fail(OWED + 'contact.block with a 65-byte label answered ' + bad.status + ', row ' + JSON.stringify(contactBook.byPublicKey(home, STRANGER)).slice(0, 120));
  const plain = await ask(hub, 'block', { publicKey: OTHER, publicLabel: '' });
  if (plain.status === 200 && contactBook.byPublicKey(home, OTHER)) test.check('with no label the block is kept, as now');
  else test.fail('contact.block with no label answered ' + plain.status);

  // A relay nobody listens on; today's peer.acquire keeps the row without reaching it (201).
  const NOWHERE = 'http://127.0.0.1:9';
  async function acquire(key, label) {
    const res = fakeRes();
    hub.handleContact({}, res, readBody({ publicKey: key, publicLabel: label, url: NOWHERE }));
    await within(res.wait(), 8000);
    return { status: res.status, row: contactBook.byPublicKey(home, key) };
  }
  const hidden = await acquire(NEWCOMER, 'new' + BIDI);
  const long = await acquire(PEER, ascii(65));
  const good = await acquire(FRIEND, 'newcomer');
  if (hidden.status >= 400 && hidden.status < 500 && !hidden.row && long.status >= 400 && long.status < 500 && !long.row) {
    test.check('peer.acquire refuses a label the rule refuses (bidi, 65 bytes), no row written');
  } else {
    test.fail(OWED + 'peer.acquire answered ' + hidden.status + ' (bidi, row ' + !!hidden.row + '), ' + long.status + ' (65 bytes, row ' + !!long.row + ')');
  }
  if (good.status >= 200 && good.status < 300 && good.row && good.row.publicLabel === 'newcomer') test.check('a good label is acquired, as now');
  else test.fail('peer.acquire with a good label answered ' + good.status);
}

// ── 6. THE SHELL INPUT ───────────────────────────────────────────────

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', style: {}, dataset: {}, children: [], listeners: {},
    addEventListener: function (event, fn) { (el.listeners[event] = el.listeners[event] || []).push(fn); },
    appendChild: function (child) { el.children.push(child); return child; },
    fire: function (event, arg) { (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); }); },
    focus: function () {}, select: function () {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); el.children.length = 0; },
    enumerable: true,
  });
  return el;
}

function mountDetails(rule) {
  const byId = {};
  const doc = {
    activeElement: null,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
    addEventListener: function () {},
  };
  const people = [{ publicKey: PEER, publicLabel: 'peer', caption: 'peer', myLabel: '', tail: 'peerp=', acquiredVia: 'handle' }];
  const sent = [];
  const fakeFetch = function (url, init) {
    let body = {};
    try { body = JSON.parse(String((init && init.body) || '{}')); } catch (e) { body = {}; }
    if (body.verb && body.verb !== 'contact.get') sent.push(body);
    let answer = { ok: true, people: people };
    if (body.verb === 'contact.get') answer = { ok: true, key: body.key, person: people[0] };
    const t = JSON.stringify(answer);
    return Promise.resolve({ status: 200, text: function () { return Promise.resolve(t); }, json: function () { return Promise.resolve(JSON.parse(t)); } });
  };
  let behavior = null;
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
      factRow: function (pairs) { return (pairs || []).map(function (p) { return '<span>' + p[0] + '</span><span>' + p[1] + '</span>'; }).join(''); },
    },
    core: {
      ask: test.browserAsk(fakeFetch),
      relays: test.browserRelays(test.browserAsk(fakeFetch)),
      util: { escapeHtml: spirit.core.util.escapeHtml, formatBytes: spirit.core.util.formatBytes },
      const: { ICON: spirit.core.const.ICON },
    },
  };
  const src = fs.readFileSync(path.join(RUN, 'shell', 'contactsDetails', 'contactsDetails.js'), 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', src)(shellSpirit, doc, { spiritFieldRules: rule }, fakeFetch);
  const api = {
    verb: function (name, args) {
      const payload = Object.assign({ verb: String(name) }, args || {});
      return fakeFetch('/api/spirit', { method: 'POST', body: JSON.stringify(payload) }).then(function (r) {
        return r.text().then(function (t) { return { status: r.status, text: t, body: JSON.parse(t) }; });
      });
    },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, body: { ok: true } }); },
    closeDialog: function () {}, setScreenTitle: function () {}, armUntilElsewhere: function () {},
    setScreenMark: function () {}, setDialogResult: function () {},
    launchApp: function () { throw new Error('a dialog cannot launch'); },
  };
  behavior.mount(fakeElement('container'), api);
  behavior.open({ key: PEER });
  return { doc: doc, sent: sent };
}

function settle() {
  return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

async function theShellInput() {
  test.subHeading('6. the My Label field checks against fieldRules.js before it asks');
  const rule = loadRule();
  if (!rule) { test.fail(OWED + 'no rule to hand the page (js/fieldRules.js)'); return; }
  const app = mountDetails(rule);
  await settle();
  const input = app.doc.getElementById('cd-label-input');
  input.value = ascii(65);
  app.doc.getElementById('cd-body').fire('change', { target: input });
  await settle();
  const labels = function () { return app.sent.filter(function (b) { return b.verb === 'contact.label'; }); };
  if (labels().length === 0) test.check('65 bytes typed: no contact.label is asked');
  else test.fail(OWED + 'the field asked contact.label with ' + String(labels()[0].myLabel).length + ' bytes');
  input.value = 'Pete';
  app.doc.getElementById('cd-body').fire('change', { target: input });
  await settle();
  if (labels().length === 1 && labels()[0].myLabel === 'Pete') test.check('a good name is asked, as now');
  else test.fail('a good name: contact.label asked ' + JSON.stringify(labels()));
}

async function main() {
  theName();
  aLabel();
  await aDescription();
  await yourOwnName();
  await givenByHand();
  await theShellInput();
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
