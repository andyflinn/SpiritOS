'use strict';

// spirit/run/spirit/app/desk/element/ruleDetails/test/ruleDetails.js
// The tests of spirit/app/desk/element/ruleDetails/ruleDetails.js, and of no other module (spec: ./ruleDetails.md; goal/G41.9,
// goal/G41.28, goal/G43.30). goal/G43.30 moved it out of shell/ruleDetails/ into Desk's own elements (Andy: "I'm fucking
// disappointed that you didn't put ruleDetail into run://spirit/app/desk/element/ when we moved desk!!!!!!!!!!!!!!"); the
// box: "Desk opens it from there", and "every Delete and every Close press in Desk ... the rule dialog" is an armingButton,
// pressed once on the real page with nothing happening. The browser file runs in node
// on a window of its own: the app's api records every verb; armingButton is a stub that keeps every button made or
// attached with what it was handed, so each two-press button's run is driven here as its second press would. The page's
// one data set and the desk family's data.js, brought by its api.js, are the real ones (spirit/run/spirit/data.js, spirit/app/desk/data.js).

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
    // A branch's api.js brings its companion data.js, as the real api.js does (goal/G47.1: "every api.js requires it's
    // companion data.js"): the stand-in runs that data.js on this window over the real data set. A data.js asked for
    // directly is only recorded.
    require: function (p) {
      const at = String(p).replace(/^\/+/, '');
      w.required.push(at);
      const branch = (/^(spirit\/(?:app\/)?[^/]+)\/api\.js$/.exec(at) || [])[1];
      const data = branch ? path.join(RUN, branch, 'data.js') : '';
      if (data && fs.existsSync(data)) vm.runInContext(fs.readFileSync(data, 'utf8'), win, { filename: data });
      return Promise.resolve({});
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
const RULE = { ok: true, key: 'rule/7', label: 'a rule', type: 'desk', status: 'proposed', text: 'the text', draft: '' };
let CHAT = [{ by: 'andy', at: '2026-11-02T10:00:00.000Z', text: 'first line' }];
function answer(name) {
  if (name === 'desk.rule.get') return RULE;
  if (name === 'desk.item.chat') return { ok: true, chat: CHAT.slice(), chatMore: false };
  return { ok: true };
}

// What each step makes, for the tests after it, in order.
const W = {};
const calls = function (w, name) { return w.calls.filter(function (x) { return x.name === name; }); };
const noE = function () { return !W.E; };
const noK = function () { return !W.K; };

// spirit/app/desk/element/ruleDetails/ruleDetails.js: Desk's rule dialog, in Desk's own elements (goal/G43.30)
test.run('its element file is there', 0.2, function () { return SRC !== '' || false; }, test.limit.quick);

// nothing hand-rolled is left (goal/G41.9)
test.run('it has no data-armed of its own, because the arming button carries it', 0.2, function () { return (SRC !== '' && !/data-armed/.test(CODE)) || false; }, test.limit.quick);
test.run('it hands nothing to armUntilElsewhere itself, because the arming button does', 0.2, function () { return (SRC !== '' && !/armUntilElsewhere/.test(CODE)) || false; }, test.limit.quick);
test.run('it keeps no armed flag of its own', 0.2, function () { return (SRC !== '' && !/\brdArmed\b/.test(CODE)) || false; }, test.limit.quick);
test.run('it has no armed class and no armedButton helper of its own', 0.2, function () { return (SRC !== '' && !/classList\.(add|remove|toggle)\(\s*['"]armed['"]/.test(CODE) && !/armedButton/.test(CODE)) || false; }, test.limit.quick);

test.run('it is the element spirit.element.spirit.app.desk.element.ruleDetails.ruleDetails, whose create takes a container, a key and a via', 0.2, function () {
  if (SRC === '') return false;
  W.w = world(answer);
  const E = ((((W.w.win.spirit.element.spirit.app.desk || {}).element || {}).ruleDetails || {}).ruleDetails);
  W.E = !!E && typeof E.create === 'function' ? E : null;
  return !!W.E || false;
}, test.limit.quick);
test.run('it loads spirit/element/armingButton.js itself, through spirit.require', 0.2, async function () {
  if (noE()) return false;
  await W.w.make(node('container'), { key: 'rule/7', via: W.w.api });
  await settle();
  return W.w.required.indexOf('spirit/element/armingButton.js') !== -1 || false;
}, test.limit.quick);

// Activate and Delete are arming buttons, each driven as its second press would
const says = function (a, c) { const label = a.opts.label != null ? a.opts.label : a.button.textContent; return label === c.label && a.opts.armedLabel === c.armed; };
// Its run asks rule.version once, of this rule, with the status asked and the text as it stands.
const runAsks = async function (a, status) {
  const before = calls(W.w, 'desk.rule.version').length;
  await a.opts.run(); await settle();
  const v = calls(W.w, 'desk.rule.version').slice(before);
  return { good: v.length === 1 && v[0].args.key === 'rule/7' && v[0].args.status === status && v[0].args.text === 'the text' };
};
const ACT = { id: 'rd-activate', label: 'Activate', armed: 'Activate: sure?', status: 'active' };
const DEL = { id: 'rd-delete', label: 'Delete', armed: 'Delete: sure?', status: 'deleted' };
test.run('Activate is an arming button', 0.2, function () {
  if (noE()) return false;
  W.act = armingFor(W.w, ACT.id, ACT.label);
  return !!W.act || false;
}, test.limit.quick);
test.run('the Activate button says Activate, and once armed says Activate: sure?', 0.2, function () { if (!W.act) return false; return says(W.act, ACT) || false; }, test.limit.quick);
test.run('the Activate button is handed no api, because the arming button hears a click elsewhere itself', 0.2, function () { if (!W.act) return false; return !('api' in W.act.opts) || false; }, test.limit.quick);
test.run('the Activate button has a run', 0.2, function () { if (!W.act) return false; return typeof W.act.opts.run === 'function' || false; }, test.limit.quick);
test.run('the Activate button\'s run asks rule.version of this rule with the status active and the text as it stands', 0.2, async function () {
  if (!W.act || typeof W.act.opts.run !== 'function') return false;
  const r = await runAsks(W.act, ACT.status);
  return r.good || false;
}, test.limit.quick);
test.run('Delete is an arming button', 0.2, function () {
  if (noE()) return false;
  W.del = armingFor(W.w, DEL.id, DEL.label);
  return !!W.del || false;
}, test.limit.quick);
test.run('the Delete button says Delete, and once armed says Delete: sure?', 0.2, function () { if (!W.del) return false; return says(W.del, DEL) || false; }, test.limit.quick);
test.run('the Delete button is handed no api, because the arming button hears a click elsewhere itself', 0.2, function () { if (!W.del) return false; return !('api' in W.del.opts) || false; }, test.limit.quick);
test.run('the Delete button has a run', 0.2, function () { if (!W.del) return false; return typeof W.del.opts.run === 'function' || false; }, test.limit.quick);
test.run('the Delete button\'s run asks rule.version of this rule with the status deleted and the text as it stands', 0.2, async function () {
  if (!W.del || typeof W.del.opts.run !== 'function') return false;
  const r = await runAsks(W.del, DEL.status);
  return r.good || false;
}, test.limit.quick);
// Version and Auto-attach stay plain buttons
test.run('only Activate and Delete arm', 0.2, function () {
  if (noE()) return false;
  return (!armingFor(W.w, 'rd-version', 'Version') && !armingFor(W.w, 'rd-auto', 'Auto-attach')) || false;
}, test.limit.quick);

// Andy: "EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the
// spirit object" (goal/G41.28).
// the rule and its chat are the desk family's cache, and it draws from its watches (goal/G41.28)
test.run('it requires the desk family\'s interface, spirit/app/desk/api.js, and no data.js, and the desk data it brings stands at spirit.data.desk.data', 0.2, async function () {
  if (noE()) return false;
  // A dialog of its own, opened anew: no version pending from the runs above.
  W.v = world(answer);
  await W.v.make(node('container'), { key: 'rule/7', via: W.v.api });
  await settle();
  W.K = ((W.v.win.spirit.data || {}).desk || {}).data;
  return (W.v.required.indexOf('spirit/app/desk/api.js') !== -1 && !W.v.required.some(function (p) { return /data\.js$/.test(p); }) && !!W.K) || false;
}, test.limit.quick);
test.run('the answer of rule.get is kept in spirit.data.desk.data', 0.2, function () {
  if (noK()) return false;
  return (!!W.K.rule('rule/7') && W.K.rule('rule/7').text === 'the text') || false;
}, test.limit.quick);
test.run('item.chat\'s answer is kept there too, under the rule', 0.2, function () {
  if (noK()) return false;
  const part = W.K.part('rule/7');
  return (!!part && Array.isArray(part.chat) && part.chat.length === 1 && part.chat[0].text === 'first line') || false;
}, test.limit.quick);
test.run('the chat drawn is the chat kept', 0.2, function () {
  if (noK()) return false;
  return /first line/.test(byId['rd-chat'] ? byId['rd-chat'].innerHTML : '') || false;
}, test.limit.quick);
test.run('it has no listener of its own on the desk\'s publishes, because the cache is what it hears', 0.2, function () {
  if (noK()) return false;
  return !/onPublished/.test(CODE) || false;
}, test.limit.quick);

// a rule row changed in the cache repaints it, and refills the textbox only after his Version
test.run('a rule changed in the cache, from elsewhere, repaints its head', 0.2, async function () {
  if (noK()) return false;
  W.box = byId['rd-text'];
  W.box.value = 'his own typing';
  W.K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { label: 'renamed elsewhere', text: 'changed elsewhere' }) }); await settle();
  return /renamed elsewhere/.test(byId['rd-head'] ? byId['rd-head'].innerHTML : '') || false;
}, test.limit.quick);
test.run('his typing in the textbox stays when the head repaints', 0.2, function () {
  if (!W.box) return false;
  return W.box.value === 'his own typing' || false;
}, test.limit.quick);
test.run('Version sends the textbox as it stands', 0.2, async function () {
  if (!W.box) return false;
  W.asked = calls(W.v, 'desk.rule.get').length;
  byId['rd-body'].fire('click', { target: byId['rd-version'] }); await settle();
  const last = calls(W.v, 'desk.rule.version').pop();
  return (!!last && last.args.text === 'his own typing') || false;
}, test.limit.quick);
test.run('Version does not ask rule.get again, because the version comes back through the cache', 0.2, function () {
  if (W.asked === undefined) return false;
  return calls(W.v, 'desk.rule.get').length === W.asked || false;
}, test.limit.quick);
test.run('the version, once it comes back as the rule\'s row in the cache, refills the textbox', 0.2, async function () {
  if (!W.box) return false;
  W.K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned' }) }); await settle();
  return W.box.value === 'his own typing, versioned' || false;
}, test.limit.quick);
test.run('a draft that comes back never refills the textbox', 0.2, async function () {
  if (!W.box) return false;
  const box = W.box;
  box.value = 'a draft';
  byId['rd-body'].fire('change', { target: box }); await settle();
  W.K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned', draft: 'a draft' }) }); await settle();
  box.value = 'typing on';
  W.K.published({ rule: 'rule/7', row: Object.assign({}, RULE, { text: 'his own typing, versioned', draft: 'a draft, as kept' }) }); await settle();
  return box.value === 'typing on' || false;
}, test.limit.quick);

// a line said under the rule drops its chat kept, and it reads the chat again
test.run('Send says the line under this rule with chat.add', 0.2, async function () {
  if (noK()) return false;
  W.chats = calls(W.v, 'desk.item.chat').length;
  const say = byId['rd-say'];
  say.value = 'second line';
  CHAT = CHAT.concat([{ by: 'andy', at: '2026-11-02T10:01:00.000Z', text: 'second line' }]);
  byId['rd-body'].fire('click', { target: byId['rd-say-send'] }); await settle();
  const sent = calls(W.v, 'desk.chat.add').pop();
  return (!!sent && sent.args.id === 'rule/7' && sent.args.text === 'second line') || false;
}, test.limit.quick);
test.run('Send does not read the chat itself', 0.2, function () {
  if (W.chats === undefined) return false;
  return calls(W.v, 'desk.item.chat').length === W.chats || false;
}, test.limit.quick);
test.run('the rule.chat publish, once it comes into the cache, has it read the chat again', 0.2, async function () {
  if (W.chats === undefined) return false;
  W.K.published({ verb: 'rule.chat', rule: 'rule/7' }); await settle();
  return calls(W.v, 'desk.item.chat').length === W.chats + 1 || false;
}, test.limit.quick);
test.run('the chat drawn then holds the new line', 0.2, function () {
  if (noK()) return false;
  return /second line/.test(byId['rd-chat'] ? byId['rd-chat'].innerHTML : '') || false;
}, test.limit.quick);

// ── ON THE REAL PAGE (goal/G43.30) ─────────────────────────────────────────────────────────────────────────────────
// The box: "Desk opens it from there", and "A test presses each one once on the real page and finds that nothing
// happened." A scratch node with desk switched on and one rule; the Desk element on its face page; the rule opened from
// the Rules list as he opens it; its Delete pressed once.
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const ROW = "Array.prototype.slice.call(document.querySelectorAll('#zzDesk *')).filter(function (x) { return x.textContent.indexOf('zz rule to keep') !== -1 && !x.closest('.app-container') && !x.children.length; }).pop()";
const DELETE = "Array.prototype.slice.call(document.querySelectorAll('#zzDesk .app-container #rd-delete, #zzDesk .app-container button')).filter(function (b) { return b.getClientRects().length && (b.id === 'rd-delete' || /^Delete/.test(String(b.textContent).trim())); })[0]";
const noPage = function () { return !W.key; };
test.run('a rule is added on the scratch desk', 0.2, async function () {
  const chrome = H.findChrome();
  if (!chrome) return false;
  W.scratch = await H.scratchNode();
  W.page = W.scratch.up ? await H.chromePage(chrome) : null;
  if (!W.page || W.page.error) return false;
  const page = W.page;
  await page.send('Page.navigate', { url: W.scratch.base + '/face.html' });
  await H.until(function () { return page.evaluate('!!(window.spirit && window.spirit.require)').then(Boolean); }, H.WAIT);
  W.call = function (verb, args) {
    return page.evaluate("fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(" + JSON.stringify({ call: verb, args: args }) + ") }).then(function (r) { return r.text(); })")
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } });
  };
  await W.call('app.active', { key: 'desk', active: true });
  await H.until(function () { return W.call('desk.items.search', { text: '' }).then(function (r) { return r.ok !== false; }); }, 40000);
  const added = await W.call('desk.rule.add', { type: 'desk', label: 'zz rule to keep', text: 'a rule pressed once' });
  W.key = added.key || added.id;
  return !!W.key || false;
}, test.limit.long);
test.run('the rule\'s row is in Desk\'s Rules list', 0.2, async function () {
  if (noPage()) return false;
  const page = W.page;
  W.before = await W.call('desk.rule.get', { key: W.key });
  await page.evaluate("(function () { var d = document.createElement('div'); d.id = 'zzDesk'; d.style.height = '800px'; document.body.appendChild(d); return Promise.resolve(window.spirit.require('spirit/app/desk/element.js')).then(function () { window.spirit.element.spirit.app.desk.element.create(d, {}); return true; }); })()");
  await H.until(function () { return page.evaluate("!!document.querySelector('#zzDesk [data-tab=\"rules\"]')"); }, H.WAIT);
  await page.evaluate("document.querySelector('#zzDesk [data-tab=\"rules\"]').click()");
  return (await H.until(function () { return page.evaluate('!!' + ROW); }, H.WAIT)) || false;
}, test.limit.quick);
test.run('pressing the rule\'s row opens the rule dialog with its Delete button', 0.2, async function () {
  if (noPage()) return false;
  const page = W.page;
  await page.evaluate('(function () { var r = ' + ROW + '; if (r) r.click(); return !!r; })()');
  return (await H.until(function () { return page.evaluate('!!' + DELETE); }, H.WAIT)) || false;
}, test.limit.quick);
test.run('Desk opens it from spirit/app/desk/element/ruleDetails/ruleDetails.js, never from shell/ruleDetails/', 0.2, async function () {
  if (noPage()) return false;
  const from = JSON.parse(await W.page.evaluate('JSON.stringify(performance.getEntriesByType("resource").map(function (e) { return e.name; }).filter(function (n) { return /ruleDetails/.test(n); }))'));
  const fromShell = /\/shell\/ruleDetails\//;
  return (from.some(function (n) { return n.indexOf('/' + PLACE) !== -1; }) && !from.some(function (n) { return fromShell.test(n); })) || false;
}, test.limit.quick);
test.run('Delete pressed once deletes nothing, and the rule stands as before', 0.2, async function () {
  if (noPage()) return false;
  await W.page.evaluate('(function () { var b = ' + DELETE + '; if (b) b.click(); return !!b; })()');
  await new Promise(function (r) { setTimeout(r, 1500); });
  const after = await W.call('desk.rule.get', { key: W.key });
  const before = W.before;
  return (!!after && after.status === before.status && after.status !== 'deleted') || false;
}, test.limit.slow);
test.run('Delete pressed once stands armed, waiting for the second press', 0.2, async function () {
  if (noPage()) return false;
  return (await W.page.evaluate('(function () { var b = ' + DELETE + '; return !!b && b.hasAttribute("data-armed"); })()')) || false;
}, test.limit.quick);
test.after(function () {
  const page = W.page, scratch = W.scratch || {};
  if (page && page.kid) page.kid.kill();
  if (scratch.child) scratch.child.kill();
  try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
  try { if (scratch.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(scratch); } catch (e) { /* left */ }
});
