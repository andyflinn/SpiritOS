'use strict';

// spirit/run/spirit/app/desk/element/ruleDetails/test/ruleDetails.js
// The tests of spirit/app/desk/element/ruleDetails/ruleDetails.js, and of no other module (spec: ./ruleDetails.md; goal/G41.9,
// goal/G41.28, goal/G43.30). goal/G43.30 moved it out of shell/ruleDetails/ into Desk's own elements (Andy: "I'm fucking
// disappointed that you didn't put ruleDetail into run://spirit/app/desk/element/ when we moved desk!!!!!!!!!!!!!!"); the
// box: "Desk opens it from there", and "every Delete and every Close press in Desk ... the rule dialog" is an armingButton,
// pressed once on the real page with nothing happening. The browser file runs in node
// on a window of its own: the app's api records every verb; armingButton is a stub that keeps every button made or
// attached with what it was handed, so each two-press button's run is driven here as its second press would. The page's
// one data set and the desk family's cache manager are the real ones (spirit/run/spirit/data.js, spirit/app/desk/data.js).

const FILE = require('path').join(__dirname, '..', 'ruleDetails.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
const PLACE = 'spirit/app/desk/element/ruleDetails/ruleDetails.js';
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
let SRC = '';
try { SRC = fs.readFileSync(FILE, 'utf8'); } catch (e) { SRC = ''; }
const CODE = SRC.replace(/\/\/.*$/gm, '');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () {
  for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); });
  await new Promise(function (r) { setTimeout(r, 5); });
};

// A box whose markup makes a node per tag; a tag with an id is found by getElementById, a button keeps its own text.
const byId = {};
function node(tag) {
  const heard = {}; let html = ''; const attrs = {};
  const n = { tag: tag || '', kids: [], textContent: '', value: '', style: {}, className: '', disabled: false,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        const id = /\sid="([^"]*)"/.exec(m[2]);
        if (m[1].toLowerCase() === 'button') {
          const end = html.indexOf('</button>', re.lastIndex);
          c.textContent = end === -1 ? '' : html.slice(re.lastIndex, end).replace(/<[^>]*>/g, '');
        }
        if (id) { c.id = id[1]; byId[id[1]] = c; }
      }
    },
    setAttribute: function (k, v) { attrs[k] = String(v); }, getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
    removeAttribute: function (k) { delete attrs[k]; },
    appendChild: function (c) { n.kids.push(c); return c; }, replaceChild: function () {}, insertBefore: function (c) { return c; },
    get firstChild() { return null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  };
  return n;
}

// The world: the app's api records every verb; spirit.require records each path; armingButton is a stub that keeps
// every button made or attached with what it was handed.
function world(answer) {
  const w = { calls: [], required: [], arming: [], closed: [], def: null, handed: 0 };
  const stub = {
    create: function (opts) { const b = node('<button>'); w.arming.push({ how: 'create', button: b, opts: opts || {} }); return b; },
    attach: function (button, opts) { w.arming.push({ how: 'attach', button: button, opts: opts || {} }); return button; },
  };
  const api = {
    escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); },
    verb: function (name, args) { w.calls.push({ name: name, args: args }); return Promise.resolve({ status: 200, body: answer(name, args) }); },
    armUntilElsewhere: function () { w.handed += 1; },
    closeDialog: function (r) { w.closed.push(r); },
    setScreenTitle: function () {},
    ui: { elements: {} },
  };
  const win = {
    document: { getElementById: function (id) { return byId[id] || null; }, createElement: function (t) { return node('<' + t + '>'); }, body: null },
    setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // goal/G43.32: the arming button stands where ruleDetails.js reads it, spirit.element.spirit.element.armingButton.
  win.spirit = { element: { spirit: { element: { armingButton: stub }, app: {} } },
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
    cacheManager: function (name) {
      w.managers = (w.managers || []).concat(name);
      // An app's manager sits in its own folder, spirit/app/<name>/ (goal/G43.27), a server's too (goal/G43.20); a node
      // family's in spirit/<name>/.
      const app = path.join(RUN, 'spirit', 'app', String(name), 'data.js');
      vm.runInContext(fs.readFileSync(fs.existsSync(app) ? app : path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
      return Promise.resolve(true);
    } };
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+RULE/DETAILS==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so the element places itself by installSpiritElement as it runs.
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win;
  // THE ELEMENT (goal/G43.27, requirement 23): made in a layer over the Desk page, handed the page's way to the node.
  w.make = function (container, opts) { return win.spirit.element.spirit.app.desk.element.ruleDetails.ruleDetails.create(container, opts); };
  w.api = api;
  return w;
}
// The newest arming button for a button id (attached) or a label (made): what the page shows now.
function armingFor(w, id, label) {
  const found = w.arming.filter(function (a) {
    const said = a.opts.label != null ? a.opts.label : a.button && a.button.textContent;
    return (a.button && a.button.id === id) || said === label;
  });
  return found[found.length - 1] || null;
}
function nothingHandRolled(flag) {
  ok(!/data-armed/.test(CODE), 'no data-armed of its own: the arming button carries it', 'its code still writes data-armed');
  ok(!/armUntilElsewhere/.test(CODE), 'it hands nothing to armUntilElsewhere itself: the arming button does', 'its code still calls armUntilElsewhere');
  ok(!new RegExp('\\b' + flag + '\\b').test(CODE), 'no armed flag of its own (' + flag + ')', 'its code still keeps ' + flag);
  ok(!/classList\.(add|remove|toggle)\(\s*['"]armed['"]/.test(CODE) && !/armedButton/.test(CODE), 'no armed class and no armedButton helper of its own', 'its code still has an armed class or an armedButton helper');
}
function loadsArming(w) {
  ok(w.required.indexOf('spirit/element/armingButton.js') !== -1, 'it loads spirit/element/armingButton.js itself, through spirit.require', 'required: ' + short(w.required));
}

test.startTest('ruleDetails.js: one rule of the desk, its Activate and Delete on the arming button');

const RULE = { ok: true, key: 'rule/7', label: 'a rule', type: 'desk', status: 'proposed', text: 'the text', draft: '' };
let CHAT = [{ by: 'andy', at: '2026-11-02T10:00:00.000Z', text: 'first line' }];
function answer(name) {
  if (name === 'desk.rule.get') return RULE;
  if (name === 'desk.item.chat') return { ok: true, chat: CHAT.slice(), chatMore: false };
  return { ok: true };
}

(async function () {
  test.subHeading(PLACE + ': Desk\'s rule dialog, in Desk\'s own elements (goal/G43.30)');
  ok(SRC !== '', 'it is at ' + PLACE, PLACE + ' is not there');
  if (SRC === '') return;
  test.subHeading('nothing hand-rolled is left (goal/G41.9)');
  nothingHandRolled('rdArmed');

  const w = world(answer);
  const E = ((((w.win.spirit.element.spirit.app.desk || {}).element || {}).ruleDetails || {}).ruleDetails);
  ok(!!E && typeof E.create === 'function', 'it is the element spirit.element.spirit.app.desk.element.ruleDetails.ruleDetails, with create(container, { key, via })', 'spirit.element.spirit.app.desk.element.ruleDetails.ruleDetails is ' + short(E && Object.keys(E)));
  if (!E) return;
  await w.make(node('container'), { key: 'rule/7', via: w.api });
  await settle();
  loadsArming(w);

  const cases = [
    { id: 'rd-activate', label: 'Activate', armed: 'Activate: sure?', status: 'active' },
    { id: 'rd-delete', label: 'Delete', armed: 'Delete: sure?', status: 'deleted' },
  ];
  for (const c of cases) {
    test.subHeading(c.label + ' is an arming button');
    const a = armingFor(w, c.id, c.label);
    ok(!!a, c.label + ' is made or attached through window.spirit.element.spirit.element.armingButton', 'arming buttons: ' + short(w.arming.map(function (x) { return x.button && x.button.id || x.opts.label; })));
    if (!a) continue;
    const label = a.opts.label != null ? a.opts.label : a.button.textContent;
    ok(label === c.label && a.opts.armedLabel === c.armed, 'it says ' + c.label + ', and armed ' + c.armed, 'label ' + short(label) + ', armedLabel ' + short(a.opts.armedLabel));
    ok(!('api' in a.opts), 'it is handed no api: the arming button hears a click elsewhere itself (goal/G43.24)', 'handed: ' + short(Object.keys(a.opts)));
    const before = w.calls.filter(function (x) { return x.name === 'desk.rule.version'; }).length;
    ok(typeof a.opts.run === 'function', 'it has a run', 'no run');
    if (typeof a.opts.run !== 'function') continue;
    await a.opts.run(); await settle();
    const v = w.calls.filter(function (x) { return x.name === 'desk.rule.version'; }).slice(before);
    ok(v.length === 1 && v[0].args.key === 'rule/7' && v[0].args.status === c.status && v[0].args.text === 'the text',
      'its run asks rule.version of this rule, status ' + c.status + ', with the text as it stands', 'asked: ' + short(v));
  }
  test.subHeading('Version and Auto-attach stay plain buttons');
  ok(!armingFor(w, 'rd-version', 'Version') && !armingFor(w, 'rd-auto', 'Auto-attach'), 'only Activate and Delete arm', 'arming buttons: ' + short(w.arming.map(function (x) { return x.button && x.button.id || x.opts.label; })));

  // Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the
  // spirit object" (goal/G41.28).
  test.subHeading('the rule and its chat are the desk family\'s cache, and it draws from its watches (goal/G41.28)');
  // A dialog of its own, opened anew: no version pending from the runs above.
  const v = world(answer);
  await v.make(node('container'), { key: 'rule/7', via: v.api });
  await settle();
  const K = ((v.win.spirit.data || {}).desk || {}).data;
  ok((v.managers || []).indexOf('desk') !== -1 && !!K, 'it loads the desk family\'s cache manager (((spirit.data || {}).desk || {}).data)', 'managers: ' + short(v.managers));
  if (!K) return;
  ok(!!K.rule('rule/7') && K.rule('rule/7').text === 'the text', 'rule.get\'s answer is kept in ((spirit.data || {}).desk || {}).data', 'kept: ' + short(K.rule('rule/7')));
  const part = K.part('rule/7');
  ok(!!part && Array.isArray(part.chat) && part.chat.length === 1 && part.chat[0].text === 'first line', 'item.chat\'s answer is kept there too, under the rule', 'kept: ' + short(part));
  ok(/first line/.test(byId['rd-chat'] ? byId['rd-chat'].innerHTML : ''), 'the chat drawn is the chat kept', 'chat: ' + short(byId['rd-chat'] && byId['rd-chat'].innerHTML));
  ok(!/onPublished/.test(CODE), 'it has no listener of its own on the desk\'s publishes: the cache is what it hears', 'its code still calls onPublished');

  test.subHeading('a rule row changed in the cache repaints it, and refills the textbox only after his Version');
  const box = byId['rd-text'];
  box.value = 'his own typing';
  K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { label: 'renamed elsewhere', text: 'changed elsewhere' }) }); await settle();
  ok(/renamed elsewhere/.test(byId['rd-head'] ? byId['rd-head'].innerHTML : ''), 'a rule changed in the cache, from elsewhere, repaints its head', 'head: ' + short(byId['rd-head'] && byId['rd-head'].innerHTML));
  ok(box.value === 'his own typing', 'and his typing in the textbox stays', 'textbox: ' + short(box.value));
  const asked = v.calls.filter(function (x) { return x.name === 'desk.rule.get'; }).length;
  byId['rd-body'].fire('click', { target: byId['rd-version'] }); await settle();
  ok(v.calls.filter(function (x) { return x.name === 'desk.rule.version'; }).pop().args.text === 'his own typing', 'Version sends the textbox as it stands', 'asked: ' + short(v.calls.slice(-1)));
  ok(v.calls.filter(function (x) { return x.name === 'desk.rule.get'; }).length === asked, 'and does not ask rule.get again: the version comes back through the cache', 'rule.get asked ' + asked + ', then ' + v.calls.filter(function (x) { return x.name === 'desk.rule.get'; }).length);
  K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned' }) }); await settle();
  ok(box.value === 'his own typing, versioned', 'the version, come back as the rule\'s row in the cache, refills the textbox', 'textbox: ' + short(box.value));
  box.value = 'a draft';
  byId['rd-body'].fire('change', { target: box }); await settle();
  K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned', draft: 'a draft' }) }); await settle();
  box.value = 'typing on';
  K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned', draft: 'a draft, as kept' }) }); await settle();
  ok(box.value === 'typing on', 'a draft come back never refills the textbox', 'textbox: ' + short(box.value));

  test.subHeading('a line said under the rule drops its chat kept, and it reads the chat again');
  const chats = v.calls.filter(function (x) { return x.name === 'desk.item.chat'; }).length;
  const say = byId['rd-say'];
  say.value = 'second line';
  CHAT = CHAT.concat([{ by: 'andy', at: '2026-11-02T10:01:00.000Z', text: 'second line' }]);
  byId['rd-body'].fire('click', { target: byId['rd-say-send'] }); await settle();
  const sent = v.calls.filter(function (x) { return x.name === 'desk.chat.add'; }).pop();
  ok(!!sent && sent.args.id === 'rule/7' && sent.args.text === 'second line', 'Send says the line under this rule (chat.add)', 'asked: ' + short(sent));
  ok(v.calls.filter(function (x) { return x.name === 'desk.item.chat'; }).length === chats, 'and does not read the chat itself', 'item.chat asked ' + chats + ', then ' + v.calls.filter(function (x) { return x.name === 'desk.item.chat'; }).length);
  K.published({ verb: 'rule.chat', rule: 'rule/7' }); await settle();
  ok(v.calls.filter(function (x) { return x.name === 'desk.item.chat'; }).length === chats + 1, 'the rule.chat publish, come into the cache, has it read the chat again', 'item.chat asked ' + chats + ', then ' + v.calls.filter(function (x) { return x.name === 'desk.item.chat'; }).length);
  ok(/second line/.test(byId['rd-chat'] ? byId['rd-chat'].innerHTML : ''), 'and the chat drawn holds the new line', 'chat: ' + short(byId['rd-chat'] && byId['rd-chat'].innerHTML));

  // ── ON THE REAL PAGE (goal/G43.30) ─────────────────────────────────────────────────────────────────────────────────
  // The box: "Desk opens it from there", and "A test presses each one once on the real page and finds that nothing
  // happened." A scratch node with desk switched on and one rule; the Desk element on its face page; the rule opened from
  // the Rules list as he opens it; its Delete pressed once.
  test.subHeading(PLACE + ': opened from Desk on a real page; its Delete, pressed once, deletes nothing');
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
  const scratch = await H.scratchNode();
  let page = null;
  try {
    page = scratch.up ? await H.chromePage(chrome) : null;
    if (!page || page.error) { test.fail(page ? page.error : 'the scratch node did not come up'); return; }
    await page.send('Page.navigate', { url: scratch.base + '/face.html' });
    await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
    const call = function (verb, args) {
      return page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
        .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
    };
    await call('app.active', { key: 'desk', active: true });
    await H.until(function () { return call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
    const added = await call('desk.rule.add', { type: 'desk', label: 'zz rule to keep', text: 'a rule pressed once' });
    const key = added.key || added.id;
    ok(!!key, 'the world: a rule on the scratch desk', 'rule.add answered ' + short(added));
    if (!key) return;
    const before = await call('desk.rule.get', { key: key });
    await page.evaluate("(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {}); return true; }); })()");
    await H.until(function () { return page.evaluate("!!document.querySelector('#zzDesk [data-tab=\"rules\"]')"); }, H.WAIT);
    await page.evaluate("document.querySelector('#zzDesk [data-tab=\"rules\"]').click()");
    const row = "Array.prototype.slice.call(document.querySelectorAll('#zzDesk *')).filter(function (x) { return x.textContent.indexOf('zz rule to keep') !== -1 && !x.closest('.app-container') && !x.children.length; }).pop()";
    ok(await H.until(function () { return page.evaluate('!!' + row); }, H.WAIT), 'the world: the rule\'s row is in Desk\'s Rules list', 'no row for the rule');
    await page.evaluate('(function () { var r = ' + row + '; if (r) r.click(); return !!r; })()');
    const DEL = "Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container #rd-delete, #zzDesk .app-container button')).filter(function (b) { return b.getClientRects().length && (b.id === 'rd-delete' || /^Delete/.test(String(b.textContent).trim())); })[0]";
    ok(await H.until(function () { return page.evaluate('!!' + DEL); }, H.WAIT), 'pressing it opens the rule dialog, its Delete there', 'no rule dialog with a Delete: ' + short(await page.evaluate("String(document.getElementById('zzDesk').innerText).slice(0, 300)")));
    const from = JSON.parse(await page.evaluate('JSON.stringify(performance.getEntriesByType("resource").map(function (e) { return e.name; }).filter(function (n) { return /ruleDetails/.test(n); }))'));
    ok(from.some(function (n) { return n.indexOf('/' + PLACE) !== -1; }) && !from.some(function (n) { return /\/shell\/ruleDetails\//.test(n); }), 'Desk opens it from ' + PLACE + ', never from shell/ruleDetails/', 'the page loaded ' + short(from));
    await page.evaluate('(function () { var b = ' + DEL + '; if (b) b.click(); return !!b; })()');
    await new Promise(function (r) { setTimeout(r, 1500); });
    const after = await call('desk.rule.get', { key: key });
    ok(!!after && after.status === before.status && after.status !== 'deleted', 'Delete pressed once deletes nothing: the rule is ' + short(after && after.status) + ' as before',
      'after one press the rule is ' + short(after && after.status) + ', before ' + short(before && before.status));
    ok(await page.evaluate('(function () { var b = ' + DEL + '; return !!b && b.hasAttribute("data-armed"); })()'), 'and it stands armed, waiting for the second press', 'after one press its Delete is not armed');
  } finally {
    if (page && page.kid) page.kid.kill();
    if (scratch.child) scratch.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (scratch.root) fs.rmSync(scratch.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
