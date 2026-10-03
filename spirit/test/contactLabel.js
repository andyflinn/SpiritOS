'use strict';

// spirit/test/contactLabel.js
// goal/G4.13: the contact label, a shell element showing a contact's name by key, renamed where it appears and
// redrawn wherever a rename happens. RED on today's tree: there is no shell/js/contactLabel.js, and contact.label
// announces nothing on the node's event stream.
//
//   Andy, 2026-10-03, his go-all on goal/G4; the rulings stand verbatim in the box of goal/G4.13: "the element has two
//   modes, and it follows the style of its container / 1. display only, for insertion in a text flow, or labeling in a
//   table, etc... it cannot be clicked on or modified. / 2. in headings for panes and dialogs dedicated to that peer,
//   when clicked, it offers a text input with label-constraints which updates, if return is hit on the keyboard, and
//   the string is not empty."; "the label listens to changes in both modes."; "yes. core touch allowed for rename
//   event"; "leave node alone. give appServers their namespace."; "peer labels belong to node."; "so node owns
//   contact.rename".
//
// THE CONTRACT (the box of goal/G4.13; the shapes it left open named here, marked NAMED).
//   1. THE NODE: a contact.label that is kept writes one event on /api/events, named contact.rename, its data
//      {key, caption}: the contact's key and its caption as the book now gives it (the caption contact.label answers).
//      A refused contact.label writes none.
//   2. THE PAGE: the kernel's one stream hands contact.rename to the subscriber's handlers.onContactRename(data)
//      (NAMED, as onRelayEvent); the shell, on it, dispatches on document a CustomEvent 'contact.rename' with that data
//      as detail (NAMED), so any element can listen without a stream of its own.
//   3. THE ELEMENT: shell/js/contactLabel.js (NAMED, beside contactSelector.js), adding
//      window.spiritElements.createContactLabel({key, caption, editable}) (NAMED), handed to apps as
//      api.ui.elements.createContactLabel beside the other elements; it answers a root element.
//      - It shows the caption it is given, or, given none, asks contact.get {key} and shows person.caption.
//      - Display only (editable false): a click changes nothing and asks nothing.
//      - Editable: a click offers a text input; Return asks contact.label {publicKey, myLabel} with what was typed,
//        when it is not empty and js/fieldRules.js (window.spiritFieldRules) passes it; a refused name is not asked
//        and the rule's reason is shown; empty is not asked.
//      - Both modes listen: a contact.rename for its key redraws it with the new caption; another key's leaves it.
//   4. (goal/G4.10) NO KEY FLASHES: a label not yet answered shows no key; a name once known is kept for the page, so
//      a new label for that key shows it at once with no second contact.get; a rename updates what a new label shows.
// NOT ASSERTED, the builder's: the markup and classes, the style it takes from its container, how the input closes.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const packet = require('../run/js/client/packet');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'owed by goal/G4.13: ';
const OWED10 = 'owed by goal/G4.10: ';
const ELEMENT = path.join(RUN, 'shell', 'js', 'contactLabel.js');
const KERNEL = path.join(RUN, 'js', 'kernel.js');
const SHELL = path.join(RUN, 'js', 'client', 'shell.js');
const PEER = 'MCowBQYDK2VwAyEApeerpeerpeerpeerpeerpeerpeerpeerpeerp=';
const OTHER = 'MCowBQYDK2VwAyEAotherotherotherotherotherotherother=';

const kids = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-contactlabel-'));

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await fn()) return true; } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return false;
}

test.startTest('goal/G4.13: the contact label, by key, renamed where it appears, redrawn on every rename');

// ── 1. THE NODE ──────────────────────────────────────────────────────

function post(port, body) {
  return new Promise(function (resolve) {
    const data = JSON.stringify(body);
    const rq = http.request({ host: '127.0.0.1', port: port, path: '/api/spirit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, function (rs) {
      let t = '';
      rs.on('data', function (c) { t += c; });
      rs.on('end', function () { let b = null; try { b = JSON.parse(t); } catch (e) { b = null; } resolve({ status: rs.statusCode, body: b }); });
    });
    rq.on('error', function () { resolve({ status: 0, body: null }); });
    rq.end(data);
  });
}

async function theNode() {
  test.subHeading('1. a kept contact.label writes contact.rename {key, caption} on /api/events');
  const home = path.join(scratch, 'home', 'spirit', 'run');
  require('./plantRun.js').plantRunTree(home);
  require('../run/js/contacts').acquire(home, { publicKey: PEER, publicLabel: 'peer', relay: 'https://lab.example' }, 'handle');
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(node);
  let said = '';
  node.stderr.on('data', function (b) { said = (said + b).slice(-2000); });
  const up = await waitFor(function () { return post(port, { verb: 'contact.get', key: PEER }).then(function (r) { return r.status === 200; }); }, 15000);
  if (!up) { test.fail('the planted node did not answer contact.get' + (said.trim() ? ' — node said: ' + said.trim().slice(-300) : '')); return; }

  const events = [];
  let buf = '';
  const stream = http.get({ host: '127.0.0.1', port: port, path: '/api/events' }, function (rs) {
    rs.setEncoding('utf8');
    rs.on('data', function (c) {
      buf += c;
      let i;
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = /^event: (.*)$/m.exec(block); const da = /^data: (.*)$/m.exec(block);
        if (ev) events.push({ event: ev[1], data: da ? da[1] : '' });
      }
    });
  });
  stream.on('error', function () {});
  await waitFor(function () { return events.some(function (e) { return e.event === 'snapshot'; }); }, 5000);

  const renames = function () { return events.filter(function (e) { return e.event === 'contact.rename'; }); };
  const kept = await post(port, { verb: 'contact.label', publicKey: PEER, myLabel: 'Pete' });
  await waitFor(function () { return renames().length > 0; }, 3000);
  let first = null;
  try { first = renames()[0] ? JSON.parse(renames()[0].data) : null; } catch (e) { first = null; }
  if (kept.status === 200 && first && first.key === PEER && first.caption === 'Pete' && kept.body && first.caption === kept.body.caption) {
    test.check('contact.label Pete: one contact.rename {key, caption: "Pete"}, the caption contact.label answered');
  } else test.fail(OWED + 'contact.label answered ' + kept.status + ' ' + JSON.stringify(kept.body) + '; the stream carried ' + JSON.stringify(renames()));

  const cleared = await post(port, { verb: 'contact.label', publicKey: PEER, myLabel: '' });
  await waitFor(function () { return renames().length > 1; }, 3000);
  let second = null;
  try { second = renames()[1] ? JSON.parse(renames()[1].data) : null; } catch (e) { second = null; }
  if (cleared.status === 200 && second && second.key === PEER && second.caption === 'peer') test.check('cleared: contact.rename carries the caption the book falls back to, "peer"');
  else test.fail(OWED + 'clearing answered ' + cleared.status + '; the second contact.rename was ' + JSON.stringify(second));

  const before = renames().length;
  const refused = await post(port, { verb: 'contact.label', publicKey: PEER, myLabel: 'a'.repeat(65) });
  await sleep(600);
  if (refused.status >= 400 && renames().length === before) test.check('a refused contact.label writes none');
  else test.fail('a refused contact.label answered ' + refused.status + ', and the stream carried ' + (renames().length - before) + ' more');
  stream.destroy();
}

// ── 2. THE PAGE ──────────────────────────────────────────────────────

async function thePage() {
  test.subHeading('2. the kernel hands contact.rename to onContactRename; the shell dispatches it on document');
  const made = [];
  function FakeSource(url) {
    const self = this;
    self.url = url; self.readyState = 0; self.listeners = {};
    self.addEventListener = function (t, fn) { (self.listeners[t] = self.listeners[t] || []).push(fn); };
    self.close = function () { self.readyState = 2; };
    made.push(self);
  }
  const win = {};
  new Function('process', 'window', 'EventSource', 'XMLHttpRequest', 'document', fs.readFileSync(KERNEL, 'utf8'))(
    undefined, win, FakeSource, function () {}, { addEventListener: function () {} });
  const got = [];
  const base = made.length;
  win.spirit.core.jobs.subscribe({ onContactRename: function (d) { got.push(d); } });
  const src = made[base];
  (src && src.listeners['contact.rename'] || []).forEach(function (fn) { fn({ data: JSON.stringify({ key: PEER, caption: 'Pete' }) }); });
  if (got.length === 1 && got[0].key === PEER && got[0].caption === 'Pete') test.check('kernel: contact.rename on the one stream reaches handlers.onContactRename, parsed');
  else test.fail(OWED + 'the kernel handed onContactRename ' + JSON.stringify(got));

  const byId = {};
  function el(id) {
    let html = '';
    const e = { id: id, hidden: false, textContent: '', style: {}, className: '', children: [], listeners: {},
      appendChild: function (c) { e.children.push(c); return c; }, remove: function () {},
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      querySelector: function () { return el('q'); }, querySelectorAll: function () { return []; }, setAttribute: function () {}, removeAttribute: function () {} };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); } });
    return e;
  }
  const dispatched = [];
  const doc = { body: el('body'), getElementById: function (id) { return byId[id] || (byId[id] = el(id)); },
    createElement: el, createDocumentFragment: function () { return el('f'); },
    addEventListener: function () {}, dispatchEvent: function (ev) { dispatched.push(ev); return true; } };
  doc.getElementById('app-offline').hidden = true;
  let handlers = null;
  const fakeFetch = function () { return Promise.resolve({ status: 200, text: function () { return Promise.resolve('{}'); }, json: function () { return Promise.resolve({}); } }); };
  const shellSpirit = { core: {
    ask: test.browserAsk(fakeFetch), const: { ICON: kernel.core.const.ICON, MIME: {} },
    util: { escapeHtml: function (s) { return String(s); }, formatBytes: function () { return ''; } },
    fs: { loadFile: function (rel) {
      if (rel === 'preferences.json') return JSON.stringify({ apps: {}, groups: {} });
      return null; }, saveFile: function () { return Promise.resolve(); }, statFile: function () { return null; },
      getAnnotations: function () { return {}; }, createScopedFs: function () { return {}; } },
    jobs: { subscribe: function (h) { handlers = h; } } } };
  try {
    new Function('spirit', 'document', 'fetch', 'window', fs.readFileSync(SHELL, 'utf8'))(shellSpirit, doc, fakeFetch, { spiritPacket: packet });
  } catch (e) { test.fail('shell.js did not load in the harness: ' + e.message); return; }
  await settle();
  if (handlers && typeof handlers.onContactRename === 'function') handlers.onContactRename({ key: PEER, caption: 'Pete' });
  const ev = dispatched.filter(function (d) { return d && d.type === 'contact.rename'; })[0];
  if (ev && ev.detail && ev.detail.key === PEER && ev.detail.caption === 'Pete') test.check('shell: onContactRename dispatches CustomEvent contact.rename on document, the data as detail');
  else test.fail(OWED + 'the shell ' + (handlers && handlers.onContactRename ? 'dispatched ' + JSON.stringify(dispatched.map(function (d) { return d && d.type; })) : 'hands the stream no onContactRename'));
}

// ── 3. THE ELEMENT ───────────────────────────────────────────────────

function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), value: '', textContent: '', className: '', style: {}, dataset: {},
    children: [], listeners: {}, parentNode: null,
    appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); return c; },
    replaceChildren: function () { e.children = Array.from(arguments); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { (e.listeners[ev.type] || []).forEach(function (fn) { fn(ev); }); return true; },
    fire: function (t, arg) { const ev = Object.assign({ type: t, target: e, preventDefault: function () {}, stopPropagation: function () {} }, arg || {}); (e.listeners[t] || []).forEach(function (fn) { fn(ev); }); },
    setAttribute: function (k, v) { e[k] = v; }, getAttribute: function (k) { return e[k]; }, removeAttribute: function (k) { delete e[k]; },
    focus: function () {}, select: function () {}, blur: function () {},
  };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
function all(root) { return [root].concat(root.children.reduce(function (acc, c) { return acc.concat(all(c)); }, [])); }
function shown(root) { return all(root).map(function (n) { return (n.textContent || '') + ' ' + (n.innerHTML || '') + ' ' + (n.tagName === 'INPUT' ? '' : ''); }).join(' '); }
function inputOf(root) { return all(root).filter(function (n) { return n.tagName === 'INPUT'; })[0] || null; }

function mountElement() {
  const docListeners = {};
  const doc = {
    createElement: node, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; },
    addEventListener: function (t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { docListeners[t] = (docListeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { (docListeners[ev.type] || []).forEach(function (fn) { fn(ev); }); return true; },
  };
  const asked = [];
  const ask = function (verb, body) {
    asked.push({ verb: verb, body: body || {} });
    if (verb === 'contact.get') return Promise.resolve({ status: 200, body: { ok: true, key: body.key, person: { publicKey: body.key, caption: 'Fetched Name' } } });
    if (verb === 'contact.label') return Promise.resolve({ status: 200, body: { publicKey: body.publicKey, myLabel: body.myLabel, caption: body.myLabel } });
    return Promise.resolve({ status: 200, body: {} });
  };
  const win = { spiritFieldRules: require('../run/js/fieldRules.js') };
  const sp = { core: { ask: ask, util: { escapeHtml: kernel.core.util.escapeHtml }, const: { ICON: kernel.core.const.ICON } } };
  new Function('spirit', 'document', 'window', 'CustomEvent', fs.readFileSync(ELEMENT, 'utf8'))(sp, doc, win, CustomEvent);
  return { make: win.spiritElements && win.spiritElements.createContactLabel, asked: asked, doc: doc };
}

async function theElement() {
  test.subHeading('3. shell/js/contactLabel.js: two modes, and both listen');
  if (!fs.existsSync(ELEMENT)) { test.fail(OWED + 'there is no shell/js/contactLabel.js'); return; }
  let m = null;
  try { m = mountElement(); } catch (e) { test.fail(OWED + 'shell/js/contactLabel.js did not load: ' + e.message); return; }
  if (typeof m.make !== 'function') { test.fail(OWED + 'window.spiritElements.createContactLabel is missing'); return; }
  const indexHtml = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
  if (/<script src="\/shell\/js\/contactLabel\.js"><\/script>/.test(indexHtml)) test.check('index.html loads /shell/js/contactLabel.js with the other elements');
  else test.fail(OWED + 'index.html does not load /shell/js/contactLabel.js');
  const shellSrc = fs.readFileSync(SHELL, 'utf8').replace(/\n/g, ' ');
  if (/elements:\s*\{[^}]*createContactLabel:\s*spiritElements\.createContactLabel/.test(shellSrc)) test.check('the shell hands it to apps as api.ui.elements.createContactLabel');
  else test.fail(OWED + 'api.ui.elements has no createContactLabel');

  const plain = m.make({ key: PEER, caption: 'Pete', editable: false });
  if (/Pete/.test(shown(plain))) test.check('it shows the caption it is given');
  else test.fail(OWED + 'given caption Pete it shows ' + JSON.stringify(shown(plain)).slice(0, 120));
  const fetched = m.make({ key: OTHER, editable: false });
  await settle();
  if (m.asked.some(function (a) { return a.verb === 'contact.get' && a.body.key === OTHER; }) && /Fetched Name/.test(shown(fetched))) test.check('given no caption, it asks contact.get {key} and shows person.caption');
  else test.fail(OWED + 'with no caption it asked ' + JSON.stringify(m.asked) + ' and shows ' + JSON.stringify(shown(fetched)).slice(0, 120));

  const askedBefore = m.asked.length;
  plain.fire('click');
  await settle();
  if (!inputOf(plain) && m.asked.length === askedBefore) test.check('display only: a click offers no input and asks nothing');
  else test.fail(OWED + 'display only, a click ' + (inputOf(plain) ? 'offered an input' : 'asked ' + JSON.stringify(m.asked.slice(askedBefore))));

  const head = m.make({ key: PEER, caption: 'Pete', editable: true });
  head.fire('click');
  await settle();
  const input = inputOf(head);
  if (input) test.check('editable: a click offers a text input');
  else { test.fail(OWED + 'editable, a click offered no input'); return; }
  const labels = function () { return m.asked.filter(function (a) { return a.verb === 'contact.label'; }); };
  input.value = 'a'.repeat(65);
  input.fire('keydown', { key: 'Enter' });
  await settle();
  const reason = require('../run/js/fieldRules.js').problem('a'.repeat(65));
  if (labels().length === 0 && reason && shown(head).indexOf(reason) !== -1) test.check('65 bytes and Return: not asked, the rule\'s reason shown ("' + reason + '")');
  else test.fail(OWED + '65 bytes and Return: asked ' + labels().length + ' times; shown ' + JSON.stringify(shown(head)).slice(0, 160));
  input.value = '   ';
  input.fire('keydown', { key: 'Enter' });
  await settle();
  if (labels().length === 0) test.check('empty and Return: not asked');
  else test.fail(OWED + 'empty and Return asked contact.label ' + JSON.stringify(labels()));
  input.value = 'Peter';
  input.fire('keydown', { key: 'a' });
  await settle();
  const noKey = labels().length === 0;
  input.fire('keydown', { key: 'Enter' });
  await settle();
  if (noKey && labels().length === 1 && labels()[0].body.publicKey === PEER && labels()[0].body.myLabel === 'Peter') test.check('Return with a good name asks contact.label {publicKey, myLabel}; other keys ask nothing');
  else test.fail(OWED + 'Return with Peter asked ' + JSON.stringify(labels()));

  const a = m.make({ key: PEER, caption: 'Pete', editable: false });
  const b = m.make({ key: PEER, caption: 'Pete', editable: true });
  const c = m.make({ key: OTHER, caption: 'Olga', editable: false });
  m.doc.dispatchEvent(new CustomEvent('contact.rename', { detail: { key: PEER, caption: 'Renamed' } }));
  await settle();
  if (/Renamed/.test(shown(a)) && /Renamed/.test(shown(b))) test.check('a contact.rename for its key redraws it, in both modes');
  else test.fail(OWED + 'after contact.rename the labels show ' + JSON.stringify([shown(a), shown(b)]).slice(0, 160));
  if (/Olga/.test(shown(c)) && !/Renamed/.test(shown(c))) test.check('and another key\'s label is left as it was');
  else test.fail(OWED + 'another key\'s label shows ' + JSON.stringify(shown(c)).slice(0, 120));

  // goal/G4.10, Andy, 2026-10-03, trying chatter: "the pane and dropdown seem to still initialize with keys. this makes
  // the keys flashing briefly every time an update occurs". Every redraw makes new labels, and each showed its key
  // until contact.get answered.
  test.subHeading('4. (goal/G4.10) no key flashes: a name once known is shown at once');
  const m2 = mountElement();
  const THIRD = 'MCowBQYDK2VwAyEAthirdthirdthirdthirdthirdthirdthird=';
  const first = m2.make({ key: THIRD, editable: false });
  const beforeAnswer = shown(first);
  if (beforeAnswer.indexOf(THIRD) === -1) test.check('a label not yet answered shows no key');
  else test.fail(OWED10 + 'before contact.get answered the label shows ' + JSON.stringify(beforeAnswer).slice(0, 120));
  await settle();
  const asksBefore = m2.asked.filter(function (x) { return x.verb === 'contact.get' && x.body.key === THIRD; }).length;
  const second = m2.make({ key: THIRD, editable: false });
  const atOnce = shown(second);
  await settle();
  const asksAfter = m2.asked.filter(function (x) { return x.verb === 'contact.get' && x.body.key === THIRD; }).length;
  if (/Fetched Name/.test(atOnce) && atOnce.indexOf(THIRD) === -1 && asksAfter === asksBefore) test.check('a second label for a known key shows its name at once, with no second contact.get');
  else test.fail(OWED10 + 'a second label shows ' + JSON.stringify(atOnce).slice(0, 120) + ' at once, and asked contact.get ' + (asksAfter - asksBefore) + ' more times');
  m2.doc.dispatchEvent(new CustomEvent('contact.rename', { detail: { key: THIRD, caption: 'Third Renamed' } }));
  await settle();
  const third = m2.make({ key: THIRD, editable: false });
  if (/Third Renamed/.test(shown(third))) test.check('and a rename updates the name a new label shows');
  else test.fail(OWED10 + 'after a rename a new label shows ' + JSON.stringify(shown(third)).slice(0, 120));
  // Two labels made before the first answer share one ask (wsl-claude's note on bda37747: each asking passed).
  const FOURTH = 'MCowBQYDK2VwAyEAfourthfourthfourthfourthfourthfourt=';
  const f1 = m2.make({ key: FOURTH, editable: false });
  const f2 = m2.make({ key: FOURTH, editable: false });
  await settle();
  const fourthAsks = m2.asked.filter(function (x) { return x.verb === 'contact.get' && x.body.key === FOURTH; }).length;
  if (fourthAsks === 1 && /Fetched Name/.test(shown(f1)) && /Fetched Name/.test(shown(f2))) test.check('two labels made before the answer share one contact.get, and both show the name');
  else test.fail(OWED10 + 'two waiting labels asked contact.get ' + fourthAsks + ' times; they show ' + JSON.stringify([shown(f1), shown(f2)]).slice(0, 120));
}

async function main() {
  await thePage();
  await theElement();
  await theNode();
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
