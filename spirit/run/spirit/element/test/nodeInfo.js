'use strict';

// spirit/run/spirit/element/test/nodeInfo.js
// The tests of spirit/element/nodeInfo.js, and of no other module (spec: ./nodeInfo.md; goal/G43.24, requirement 6; Q2,
// Andy: "nodeInfo is fine."). The browser file runs in node on a BARE window (rule/26): each part is put on the page only
// once nodeInfo requires it, a stand-in that keeps what it was handed (the two field elements, the two relay forms, the
// rowForm, panel.js and rotateKey, each tested in its own file). The page's data set and the node family's cache manager
// are the real ones. The node is the spirit object's node and relay families, stubs that record every call and answer as
// the node would. The rotate key dialog opening over Info on a real page is judged in its rotate part, rotatePart below (once nodeInfo-rotate.js); Info's two relay forms with the real
// joinForm.js and faceForm.js in formsPart, and all of Info in one element in partsPart.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'nodeInfo.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// A node whose markup makes a child per tag; found by [attr="value"], anywhere below it.
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], kids: [], value: '', className: '', textContent: '', hidden: false, style: {},
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = []; n.kids = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) n.nodes.push(node(m[0]));
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) {
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      return a ? under(n).filter(function (c) { return c.getAttribute(a[1]) === a[2]; })[0] || null : null;
    },
    appendChild: function (c) { n.kids.push(c); c.parentNode = n; return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
  };
  return n;
}
function under(n) { const out = []; (function walk(x) { x.nodes.concat(x.kids).forEach(function (c) { out.push(c); walk(c); }); }(n)); return out; }
function text(n) { return under(n).map(function (k) { return k.innerHTML; }).join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '); }

// The relays relay.status answers: a seat claimed, a seat owned, one claimed whose own key is unknown, one merely listed.
const ROWS = [
  { url: 'https://a.example', label: 'A', claimed: true, roll: { relayKey: 'RELAYKEY+A==' } },
  { url: 'https://o.example', label: 'O', owned: true, roll: { relayKey: 'RELAYKEY+O==' } },
  { url: 'https://n.example', label: 'N', claimed: true },
  { url: 'https://b.example', label: 'B', claimed: false, roll: { relayKey: 'RELAYKEY+B==' } },
];
function answered(rows) { return { status: 200, text: '', body: { name: '', rows: rows, ownedUrls: [], claimedUrls: [], mustPick: false, relayStatus: {}, more: false } }; }
const CARD = { ok: true, name: 'Andy', description: 'a node', key: 'NODEKEY+INFO==' };

function world(o) {
  const opt = o || {};
  const w = { required: [], calls: [], made: [], destroyed: [], forms: [], rowForms: [], panels: [], opened: [], rotateKeys: [], statuses: 0 };
  function field(kind) {
    return { create: function (host, opts) {
      const el = { kind: kind, host: host, opts: opts, args: arguments.length, destroy: function () { w.destroyed.push(kind); } };
      w.made.push(el); return el;
    } };
  }
  function form(name) {
    const mount = function (host, x) { w.forms.push({ form: name, host: host, o: x }); };
    return { mount: mount, create: function (host, x) { mount(host, x); return { destroy: function () { w.destroyed.push(name + 'Form'); } }; } };
  }
  const E = {
    changeMyLabel: field('label'),
    changeMyDescription: field('description'),
    // The two forms, tested in their own folders: create(container, options) mounts and answers its destroy, as the real
    // ones do; mount(container, options) hands them the relays again.
    joinForm: form('join'),
    faceForm: form('face'),
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given, its button saying the words it was handed.
    rowForm: { create: function (c, x) {
      const f = { container: c, opts: x || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
      f.button.textContent = String((x && x.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      w.rowForms.push(f); return f;
    } },
  };
  // panel.js (goal/G43.17), tested in its own folder: a stand-in keeping the stack made and every layer opened in it.
  const panel = { create: function (host, under) {
    const s = { host: host, under: under, opens: [], destroyed: false,
      open: function (k, spec) { s.opens.push({ key: k, spec: spec }); return Promise.resolve({ key: k }); },
      destroy: function () { s.destroyed = true; } };
    w.panels.push(s); return s;
  } };
  const rotateKey = { create: function (pane, x) { const r = { pane: pane, opts: x, destroy: function () {} }; w.rotateKeys.push(r); return r; } };
  const FILES = { 'spirit/element/changeMyLabel.js': ['changeMyLabel'], 'spirit/element/changeMyDescription.js': ['changeMyDescription'],
    'spirit/element/joinForm.js': ['joinForm'], 'spirit/element/faceForm.js': ['faceForm'], 'spirit/element/rowForm.js': ['rowForm'] };
  // goal/G43.32: one place for every element, spirit.element.spirit.element, the parts it requires and itself.
  const page = { spirit: { element: {} } };
  const els = page.spirit.element;
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  const S = win.spirit;
  S.element = page;
  S.node = { key: 'NODEKEY+INFO==',
    card: function (args) { w.calls.push({ name: 'node.card', args: args });
      if (opt.cardHeld) return opt.cardHeld;
      const a = opt.card ? opt.card() : { status: 200, body: CARD };
      return a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: a.status, body: a.body }); } };
  S.data.homeNode(S.node.key);
  S.relay = { status: function (arg) { w.statuses += 1; w.calls.push({ name: 'relay.status', args: arg });
    if (opt.relaysHeld) return opt.relaysHeld;
    if (opt.relaysRefused) return Promise.reject({ status: 503, body: { ok: false, error: 'no relay answered' } });
    // As the real one answers (spirit/relay/api.js): { status, text, body: { rows, ... } }.
    return Promise.resolve(answered((opt.rows || ROWS).slice())); } };
  S.ready = Promise.resolve(S);
  S.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  S.outcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  S.require = function (p) {
    w.required.push(String(p));
    if (opt.refuse && opt.refuse.indexOf(p) !== -1) return Promise.reject(new Error('not-found ' + p));
    (FILES[p] || []).forEach(function (k) { els[k] = E[k]; });
    if (p === 'spirit/element/panel.js') els.panel = panel;
    if (p === 'spirit/element/rotateKey.js') els.rotateKey = rotateKey;
    return Promise.resolve({});
  };
  // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
  S.cacheManager = function (name) {
    w.managers = (w.managers || []).concat(String(name));
    vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  // goal/G43.32: nodeInfo.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = S.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(S);
  const pageRequire = S.require;
  S.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.S = S; w.page = page; w.els = els;
  w.slot = function (host, name) { return host.querySelector('[data-info="' + name + '"]'); };
  w.rotate = function () { return w.rowForms.filter(function (f) { return /Rotate/.test(f.opts.button || ''); })[0] || null; };
  return w;
}

test.startTest('nodeInfo.js: what this node says about itself, an element');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/element/nodeInfo.js is there', 'there is no spirit/element/nodeInfo.js');
  if (!SRC) return;

  test.subHeading('an element mounted the new shell\'s way, that loads what it uses itself (rule/26)');
  const w = world();
  const NI = w.els.nodeInfo;
  ok(!!NI && typeof NI.create === 'function', 'it sets spirit.element.spirit.element.nodeInfo = { create }', 'elements: ' + short(Object.keys(w.els)));
  if (!NI) return;
  ['spirit/element/changeMyLabel.js', 'spirit/element/changeMyDescription.js', 'spirit/element/joinForm.js', 'spirit/element/faceForm.js',
    'spirit/element/rowForm.js', 'spirit/element/panel.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  ok(w.required.indexOf('spirit/element/rotateKey.js') === -1, 'and the rotate key dialog only when it is opened', 'rotateKey.js required at load');
  ok(!/\bactivateApp\b|\bspirit\.shell\b|\bcallDialog\b/.test(CODE), 'no spirit.shell.activateApp, no dialog of the old shell', 'nodeInfo.js still mounts or opens the old shell\'s way');
  // Andy: "every fucking element gets the interfaces it needs": the spirit object's families, no api handed.
  ok(!/\bapi\s*\.|\.verb\s*\(|\bpeerPost\b/.test(CODE), 'it asks through the spirit object\'s families: no api, no api.verb, no peerPost', 'nodeInfo.js still asks through an api');
  // Nothing ticks (the file's own rule): nothing here changes without this element asking.
  ok(!/\bsetInterval\b|\bsetTimeout\b/.test(CODE), 'nothing ticks: no timer', 'nodeInfo.js runs a timer');
  // "What each relay calls you" is dropped (Andy, 2026-10-27), its code with it.
  ok(!/What each relay calls you/.test(SRC) && !/infoDrawRelays|infoPush|infoPushed|rename\s*:/.test(SRC), 'no relay table, no push of the name to every relay, no rename', 'nodeInfo.js still holds the relay table or the rename');

  const host = node('<container>');
  const made = NI.create(host, {});
  ok(!!made && typeof made.destroy === 'function' && made.ready && typeof made.ready.then === 'function', 'create(container, opts) answers { ready, destroy() }', 'create answered ' + short(made && Object.keys(made)));
  await made.ready; await settle();

  test.subHeading('the page: what it says first, a slot for each part');
  const said = text(host);
  ok(/What this node says about itself/.test(said), 'its heading: What this node says about itself', 'says: ' + short(said));
  ok(said.indexOf('Anybody who asks this node is told these two things, whether or not you have ever met. Nothing else about this box is answered to a stranger.') !== -1,
    'and the one note before the boxes: these two are answered to anybody who asks', 'says: ' + short(said));
  ['name', 'description', 'said', 'email', 'face', 'rotate'].forEach(function (k) {
    ok(!!w.slot(host, k), 'a slot ' + k, 'no data-info="' + k + '": ' + short(host.kids.map(function (k2) { return k2.innerHTML; }).join('').slice(0, 200)));
  });
  ok(host.innerHTML === '' && host.kids.length === 1 && /\bfill\b/.test(host.kids[0].className), 'it empties its container and draws into one fill box', 'container: ' + short({ html: host.innerHTML, kids: host.kids.length }));

  test.subHeading('its two fields are the two elements, handed nothing (goal/G41.6)');
  const label = w.made.filter(function (m) { return m.kind === 'label'; });
  const desc = w.made.filter(function (m) { return m.kind === 'description'; });
  ok(label.length === 1 && label[0].host === w.slot(host, 'name'), 'the name is changeMyLabel, in the name slot', 'made: ' + short(w.made.map(function (m) { return m.kind; })));
  ok(desc.length === 1 && desc[0].host === w.slot(host, 'description'), 'the description is changeMyDescription, in the description slot', 'made: ' + short(w.made.map(function (m) { return m.kind; })));
  ok(w.made.every(function (m) { return m.args === 1 && m.opts === undefined; }), 'each made with its container alone: no api handed, each gets what it needs itself', 'handed: ' + short(w.made.map(function (m) { return m.opts; })));

  test.subHeading('the card: node.card, kept in the node family\'s cache (goal/G41.28)');
  const card = w.calls.filter(function (c) { return c.name === 'node.card'; });
  ok(card.length === 1 && JSON.stringify(card[0].args) === '{}', 'it asks spirit.node.card({}) once', 'calls: ' + short(w.calls));
  const N = ((w.S.data || {}).node || {}).data;
  ok((w.managers || []).indexOf('node') !== -1 && !!N && !!N.card.get() && N.card.get().name === 'Andy' && N.card.get().description === 'a node',
    'it loads the node manager, and keeps node.card\'s answer in spirit.data.node.data\'s card, which each field draws itself from', 'managers ' + short(w.managers) + ', card ' + short(N && N.card.get()));
  ok(w.slot(host, 'said').textContent === '', 'a card read says nothing', 'said: ' + short(w.slot(host, 'said').textContent));
  // No key is shown (goal/G40.10, box v15; Andy: "remove ANY indication of keys from all user interfaces").
  const all = host.kids.map(function (k) { return k.innerHTML; }).join('') + under(host).map(function (k) { return k.innerHTML + k.textContent; }).join('');
  ok(!/NODEKEY|RELAYKEY/.test(all) && !/\bkey\b/i.test(said.replace(/cipher key/g, '')), 'no key is shown: not the node\'s, not a relay\'s', 'a key shows: ' + short(said));

  const refused = world({ card: function () { return { status: 403, body: { ok: false, error: 'owner only' } }; } });
  const h2 = node('<container>');
  const m2 = refused.els.nodeInfo.create(h2, {});
  await m2.ready; await settle();
  const N2 = refused.S.data.node && refused.S.data.node.data;
  ok(/owner only/.test(refused.slot(h2, 'said').textContent) && !(N2 && N2.card.get()), 'a card refused is said in the node\'s words, and nothing is kept', 'said ' + short(refused.slot(h2, 'said').textContent) + ', card ' + short(N2 && N2.card.get()));
  const silent = world({ card: function () { return { status: 0, body: null }; } });
  const h3 = node('<container>');
  const m3 = silent.els.nodeInfo.create(h3, {});
  await m3.ready; await settle();
  ok(/node\.card did not answer/.test(silent.slot(h3, 'said').textContent), 'a node that does not answer is said: node.card did not answer', 'said ' + short(silent.slot(h3, 'said').textContent));

  test.subHeading('the two forms: the email form always, the face form only for a starred relay (goal/G43.27)');
  ok(w.statuses === 1 && w.calls.filter(function (c) { return c.name === 'relay.status'; })[0].args === '', 'it asks spirit.relay.status(\'\') once', 'relay.status asked ' + w.statuses + ' times');
  const join = w.forms.filter(function (f) { return f.form === 'join'; }).pop();
  const face = w.forms.filter(function (f) { return f.form === 'face'; }).pop();
  ok(!!join && !!face && join.host === w.slot(host, 'email') && face.host === w.slot(host, 'face'), 'the email form (joinForm) above the face form (faceForm), each in its slot', 'forms: ' + short(w.forms.map(function (f) { return f.form; })));
  if (!join || !face) return;
  const urls = function (f) { return f.o.relays.map(function (r) { return r.url; }).join(','); };
  ok(urls(join) === ROWS.map(function (r) { return r.url; }).join(',') && urls(face) === urls(join), 'each is handed every relay this node lists, as relay.status answers them in its body (the email form always; the face form picks a seated, starred one itself)', 'join ' + urls(join) + ', face ' + urls(face));
  ok(!('pick' in join.o) && !('escape' in join.o) && !('escape' in face.o), 'the email form is not narrowed to the seated, so Join shows where no seat is held; neither form is handed an escape (each escapes with spirit.escapeHtml itself, goal/G43.24)', 'join ' + short({ pick: join.o.pick, escape: 'escape' in join.o }) + ', face escape ' + ('escape' in face.o));
  ok(typeof face.o.reload === 'function', 'the face form is handed a reload', 'face: ' + short(Object.keys(face.o)));
  const nForms = w.forms.length;
  await face.o.reload(); await settle();
  ok(w.statuses === 2 && w.forms.length === nForms + 2, 'its reload asks relay.status again and draws both forms again', 'relay.status ' + w.statuses + ', forms drawn ' + (w.forms.length - nForms));

  // The relays are a probe of every mailbox and land when they land: the fields do not wait for them.
  let letRelays = null;
  const slow = world({ relaysHeld: new Promise(function (r) { letRelays = r; }) });
  const h4 = node('<container>');
  const m4 = slow.els.nodeInfo.create(h4, {});
  await m4.ready; await settle();
  ok(slow.made.length === 2 && !!(slow.S.data.node && slow.S.data.node.data.card.get()) && slow.forms.length === 0, 'the fields and the card do not wait for the relays', 'fields ' + slow.made.length + ', forms ' + slow.forms.length);
  letRelays(answered(ROWS)); await settle();
  ok(slow.forms.length === 2, 'the forms are drawn when the relays land', 'forms ' + slow.forms.length);
  const none = world({ relaysRefused: true });
  const h5 = node('<container>');
  const m5 = none.els.nodeInfo.create(h5, {});
  await m5.ready; await settle();
  ok(none.forms.length === 2 && none.forms.every(function (f) { return Array.isArray(f.o.relays) && f.o.relays.length === 0; }), 'relay.status refused, the forms are drawn over no relay, nothing thrown', 'forms: ' + short(none.forms.map(function (f) { return f.o.relays; })));

  test.subHeading('the key rotation, a rowForm: 🆘 [Rotate this node\'s cipher key] (goal/G41.27)');
  const rf = w.rotate();
  ok(!!rf && w.rowForms.filter(function (f) { return /Rotate/.test(f.opts.button || ''); }).length === 1 && rf.opts.icon === '🆘' && rf.opts.button === 'Rotate this node\'s cipher key' && rf.container === w.slot(host, 'rotate'),
    'one rowForm in the rotate slot, its icon 🆘 and its button Rotate this node\'s cipher key', 'rowForms: ' + short(w.rowForms.map(function (f) { return f.opts; })));
  if (!rf) return;
  ok(rf.span.kids.length === 0 && rf.span.nodes.length === 0 && !String(rf.span.innerHTML || '').trim(), 'its span holds nothing', 'span: ' + short(rf.span.innerHTML));
  ok(!/<button/.test(host.kids.map(function (k) { return k.innerHTML; }).join('') + under(host).map(function (k) { return k.innerHTML; }).join('')), 'it draws no button of its own', 'markup holds a button');

  test.subHeading('without a mounter\'s stack: the dialog opens over Info through its own panel.js stack (like fstat)');
  ok(w.panels.length === 1 && w.panels[0].host === host.kids[0] && !!w.panels[0].under && w.panels[0].under === host.kids[0].kids[0],
    'one stack, panel.create(its box, its page): a layer covers all of Info', 'stacks: ' + short(w.panels.map(function (s) { return { host: s.host === host.kids[0], under: !!s.under }; })));
  rf.button.fire('click'); await settle();
  const op = w.panels[0] && w.panels[0].opens[0];
  ok(!!op && op.key === 'rotateKey' && op.spec.icon === '🆘' && op.spec.label === 'Rotate this node\'s cipher key' && typeof op.spec.fill === 'function',
    'its button opens rotateKey in that stack: 🆘 Rotate this node\'s cipher key, with a fill', 'opened: ' + short(op && { key: op.key, icon: op.spec.icon, label: op.spec.label }));
  if (!op) return;
  ok(w.calls.filter(function (c) { return /rotate/i.test(c.name); }).length === 0, 'pressing it rotates nothing: the dialog does, on its own two presses', 'calls: ' + short(w.calls));
  const pane = node('<pane>');
  const filled = await op.spec.fill(pane, function () { return false; });
  ok(w.required.indexOf('spirit/element/rotateKey.js') !== -1 && w.rotateKeys.length === 1 && w.rotateKeys[0].pane === pane && filled === w.rotateKeys[0],
    'its fill loads spirit/element/rotateKey.js and makes spirit.element.spirit.element.rotateKey in the layer\'s pane, answering it to destroy', 'required ' + short(w.required.slice(-1)) + ', made ' + w.rotateKeys.length);
  const pane2 = node('<pane>');
  const notFilled = await op.spec.fill(pane2, function () { return true; });
  ok(notFilled === null && w.rotateKeys.length === 1, 'a layer closed before the dialog loads gets nothing made', 'made ' + w.rotateKeys.length + ', answered ' + short(notFilled));

  test.subHeading('with the mounter\'s stack, opts.open: the dialog opens there, over all of Info');
  const wo = world();
  const opened = [];
  const ho = node('<container>');
  const mo = wo.els.nodeInfo.create(ho, { open: function (k, spec) { opened.push({ key: k, spec: spec }); return Promise.resolve({}); } });
  await mo.ready; await settle();
  ok(wo.panels.length === 0, 'it makes no stack of its own', 'stacks made: ' + wo.panels.length);
  wo.rotate().button.fire('click'); await settle();
  ok(opened.length === 1 && opened[0].key === 'rotateKey' && opened[0].spec.label === 'Rotate this node\'s cipher key' && typeof opened[0].spec.fill === 'function', 'its button opens rotateKey through opts.open', 'opened: ' + short(opened.map(function (x) { return x.key; })));

  test.subHeading('destroy');
  made.destroy();
  ok(w.destroyed.indexOf('label') !== -1 && w.destroyed.indexOf('description') !== -1, 'destroy destroys both fields', 'destroyed: ' + short(w.destroyed));
  // rule/8: each form holds a contact watch, let go only by its destroy.
  ok(w.destroyed.indexOf('joinForm') !== -1 && w.destroyed.indexOf('faceForm') !== -1, 'and both forms, each made once by its create', 'destroyed: ' + short(w.destroyed));
  ok(w.panels[0].destroyed === true, 'and its stack, the open dialog with it', 'stack destroyed: ' + w.panels[0].destroyed);
  ok(host.innerHTML === '' && host.kids.length === 0, 'and empties its container', 'left: ' + short({ html: host.innerHTML, kids: host.kids.length }));
  let letCard = null;
  const late = world({ cardHeld: new Promise(function (r) { letCard = r; }), relaysHeld: new Promise(function () {}) });
  const h6 = node('<container>');
  const m6 = late.els.nodeInfo.create(h6, {});
  await settle();
  m6.destroy();
  letCard(CARD); await settle();
  ok(!(late.S.data.node && late.S.data.node.data.card.get()), 'a card that lands after destroy is not kept', 'kept: ' + short(late.S.data.node && late.S.data.node.data.card.get()));
  let letRel = null;
  const late2 = world({ relaysHeld: new Promise(function (r) { letRel = r; }) });
  const h7 = node('<container>');
  const m7 = late2.els.nodeInfo.create(h7, {});
  await m7.ready; m7.destroy();
  letRel(answered(ROWS)); await settle();
  ok(late2.forms.length === 0, 'relays that land after destroy draw no form', 'forms drawn: ' + late2.forms.length);

  test.subHeading('a part that cannot be loaded is said');
  const broken = world({ refuse: ['spirit/element/changeMyLabel.js'] });
  const h8 = node('<container>');
  broken.els.nodeInfo.create(h8, {});
  await settle();
  ok(/Info could not be loaded/.test(broken.slot(h8, 'said').textContent), 'a part refused: Info could not be loaded.', 'said: ' + short(broken.slot(h8, 'said').textContent));
}()).catch(function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  .then(async function () {
    // The parts that were once files of their own (nodeInfo-forms.js, nodeInfo-parts.js, nodeInfo-rotate.js): one test
    // file per script (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, run in order.
    for (const [what, part] of [['forms', formsPart], ['parts', partsPart], ['rotate', rotatePart]]) {
      try { await part(); } catch (e) { test.fail('the ' + what + ' part threw ' + (e && e.stack || e)); }
    }
  })
  .then(function () { test.reportSuccessFailureCount(); process.exit(0); });

async function formsPart() {
  // The forms part (once nodeInfo-forms.js).
  // INFO'S TWO RELAY FORMS (goal/G43.27, requirements 9 and 10; spec: ./nodeInfo.md, its forms section). Andy: "setting a star on a relay is
  // what makes the face-form appear in \"info\", the email form must always show in \"info\"". nodeInfo.js runs in node on a
  // bare window with the REAL joinForm.js and faceForm.js (what each shows is theirs to decide), the rowForm a stand-in. The
  // node is the spirit object's node and relay families, stubs answering relay.status' rows as the node would. No node, no port.

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const RUN = path.resolve(__dirname, '../../..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const EL = path.join(RUN, 'spirit', 'element');

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  const settle = async function () { for (let i = 0; i < 40; i++) await new Promise(function (r) { setImmediate(r); }); };

  // A node whose markup makes a child per tag; found by [attr="value"] or .class, anywhere below it.
  function node(tag) {
    const heard = {}; let html = '';
    const n = { tag: tag || '', nodes: [], kids: [], value: '', defaultValue: '', className: '', textContent: '', hidden: false, style: {}, isConnected: true,
      get innerHTML() { return html; },
      set innerHTML(v) {
        html = String(v); n.nodes = []; n.kids = [];
        const re = /<([a-z]+)\b([^>]*)>/gi; let m;
        while ((m = re.exec(html))) n.nodes.push(node(m[0]));
      },
      getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
      querySelector: function (sel) {
        const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
        const c = /^\.([\w-]+)$/.exec(sel);
        const all = under(n);
        if (a) return all.filter(function (x) { return x.getAttribute(a[1]) === a[2]; })[0] || null;
        if (c) return all.filter(function (x) { return (' ' + (x.getAttribute('class') || x.className || '') + ' ').indexOf(' ' + c[1] + ' ') !== -1; })[0] || null;
        return null;
      },
      appendChild: function (k) { n.kids.push(k); k.parentNode = n; return k; },
      addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
      fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || {}); }); },
    };
    return n;
  }
  function under(n) { const out = []; (function walk(x) { x.nodes.concat(x.kids).forEach(function (c) { out.push(c); walk(c); }); }(n)); return out; }

  const CARD = { ok: true, name: 'Andy', description: 'a node', key: 'NODEKEY+INFO==' };
  // A seat on A (claimed, its relay known), one on O (owned), and B merely listed (no seat).
  function rows(starred) {
    return [
      { url: 'https://a.example', label: 'A', relay: true, claimed: true, mine: starred === 'A', roll: { relayKey: 'RELAYKEY+A==' } },
      { url: 'https://o.example', label: 'O', relay: true, owned: true, mine: false, roll: { relayKey: 'RELAYKEY+O==' } },
      { url: 'https://b.example', label: 'B', relay: true, claimed: false, mine: false, roll: { relayKey: 'RELAYKEY+B==' } },
    ];
  }

  async function info(relayRows) {
    const win = {
      document: { createElement: function (t) { return node('<' + t + '>'); } },
      setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
      console: { log: function () {}, error: function () {} },
    };
    win.window = win;
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
    const S = win.spirit;
    // goal/G43.32: every element stands at its path, spirit.element.spirit.element.<name>, the stand-ins with them.
    S.element = { spirit: { element: {} } };
    const at = S.element.spirit.element;
    const field = { create: function () { return { destroy: function () {} }; } };
    at.changeMyLabel = field; at.changeMyDescription = field;
    at.rowForm = { create: function (c, x) {
      const f = { opts: x || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
      f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      return f;
    } };
    S.node = { key: 'NODEKEY+INFO==', card: function () { return Promise.resolve(CARD); } };
    S.data.homeNode(S.node.key);
    // As the relay family's status answers (spirit/relay/api.js, status): { status, text, body: { rows, ... } }.
    S.relay = { status: function () {
      const body = { name: '', rows: relayRows.slice(), ownedUrls: [], claimedUrls: [], mustPick: false, relayStatus: {}, more: false };
      return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body });
    } };
    S.ready = Promise.resolve(S);
    S.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
    S.outcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
    // The two forms are the real files, run on this window as a page runs them; every other part a stand-in.
    const real = { 'spirit/element/joinForm.js': 1, 'spirit/element/faceForm.js': 1 };
    // goal/G43.32: each element places itself by installSpiritElement, handed by the page stand-in
    // (spirit/test/headLessChrome.js pageSpirit).
    require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(S);
    const pageRequire = S.require;
    S.require = function (p) {
      if (/installSpiritElement\.js$/.test(p)) return pageRequire(p);
      if (real[p]) { vm.runInContext(fs.readFileSync(path.join(RUN, p), 'utf8'), win, { filename: p }); delete real[p]; }
      if (p === 'spirit/element/panel.js') at.panel = { create: function () { return { open: function () { return Promise.resolve({}); }, destroy: function () {} }; } };
      if (p === 'spirit/element/rotateKey.js') at.rotateKey = { create: function () { return { destroy: function () {} }; } };
      return Promise.resolve({});
    };
    S.cacheManager = function (name) {
      if (!(S.data[name] && S.data[name].data)) vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
      return Promise.resolve(true);
    };
    vm.runInContext(fs.readFileSync(path.join(EL, 'nodeInfo.js'), 'utf8'), win, { filename: 'nodeInfo.js' });
    const host = node('<div>');
    const made = at.nodeInfo && typeof at.nodeInfo.create === 'function' ? at.nodeInfo.create(host, {}) : null;
    await settle();
    const slot = function (name) { return host.querySelector('[data-info="' + name + '"]'); };
    const shows = function (box, cls) { return !!box && box.style.display !== 'none' && !box.hidden && !!box.querySelector(cls); };
    return { made: made, email: slot('email'), face: slot('face'), shows: shows, S: S };
  }

  test.subHeading('nodeInfo-forms: Info shows the email form always, the face form only for a starred relay (goal/G43.27, 9 and 10)');

  await (async function () {
    test.subHeading('the world');
    const plain = await info(rows(''));
    ok(!!plain.made && !!plain.email && !!plain.face, 'the world: Info is made, with its email and face slots', 'Info made ' + !!plain.made + ', email slot ' + !!plain.email + ', face slot ' + !!plain.face + ': nothing judged');
    // goal/G43.32: they stand at their paths.
    const placed = plain.S.element.spirit.element;
    ok(!!placed.joinForm && !!placed.faceForm, 'the world: the real joinForm.js and faceForm.js ran on the page', 'joinForm ' + !!placed.joinForm + ', faceForm ' + !!placed.faceForm);

    test.subHeading('9. the email form always');
    ok(plain.shows(plain.email, '.sp-join-email'), 'seats on A and O, none starred: the email form shows', 'no email form: ' + short(plain.email && plain.email.innerHTML));
    const starred = await info(rows('A'));
    ok(starred.shows(starred.email, '.sp-join-email'), 'A starred: the email form shows', 'no email form: ' + short(starred.email && starred.email.innerHTML));
    const unseated = await info(rows('').map(function (r) { return Object.assign({}, r, { claimed: false, owned: false }); }));
    ok(unseated.shows(unseated.email, '.sp-join-email'), 'no seat on any relay: the email form still shows', 'no email form with no seat: ' + short(unseated.email && unseated.email.innerHTML));

    test.subHeading('10. the face form only for a starred relay');
    ok(!plain.shows(plain.face, '.sp-face-name'), 'no relay starred: no face form', 'a face form shows with no relay starred: ' + short(plain.face && plain.face.innerHTML));
    ok(starred.shows(starred.face, '.sp-face-name'), 'A starred: the face form shows', 'A starred, no face form: ' + short(starred.face && starred.face.innerHTML));
    const drawn = starred.face ? [starred.face].concat(under(starred.face)).map(function (k) { return k.innerHTML; }).join(' ') : '';
    const opts = (drawn.match(/<option value="([^"]*)"/g) || []).map(function (o) { return o.replace(/^<option value="|"$/g, ''); });
    ok(opts.length === 1 && opts[0] === 'https://a.example', 'it offers the starred relay alone', 'it offers ' + short(opts));

  })();
}

async function partsPart() {
  // The parts part (once nodeInfo-parts.js).
  // ALL OF INFO IS IN ONE ELEMENT, nodeInfo.js (goal/G43.24, requirement 6, Q2; spec: ./nodeInfo.md, its parts section). The box: "the page
  // layout, the relays ... (relay.status), the card ... (node.card), the rotate button ... They move into one new element,
  // spirit/element/nodeInfo.js (Q2)". Andy: "no i want those apps to basically be wrappers for spirit/element/ things....".
  // nodeInfo.js read as it is, comments stripped.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

  test.subHeading('nodeInfo-parts: all of Info is in one element, nodeInfo.js (goal/G43.24)');

  test.subHeading('the box, 6: "They move into one new element, spirit/element/nodeInfo.js (Q2)"');
  const nodeInfo = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
  ok(nodeInfo.length > 0, 'Q2: spirit/element/nodeInfo.js is there', 'no spirit/element/nodeInfo.js');
  ok(/\brelay\W{1,4}status\b/.test(nodeInfo), 'nodeInfo asks relay.status, the relays this node holds a seat on', 'nodeInfo.js asks no relay.status');
  ok(/\bnode\W{1,4}card\b/.test(nodeInfo), 'nodeInfo puts the card into the node cache (node.card)', 'nodeInfo.js asks no node.card');
  ok(/Rotate this node/.test(nodeInfo), 'nodeInfo draws the rotate button', 'nodeInfo.js draws no rotate button');
}

async function rotatePart() {
  // The rotate part (once nodeInfo-rotate.js).
  // THE ROTATE KEY DIALOG, DONE RIGHT (goal/G43.24, requirement 8; spec: ./nodeInfo.md, its rotate section). Andy, on "Info's rotate button
  // opens the old shell's dialog": "not good." "do it right!", "it's just a panel that opens exactly overtop of the calling
  // panel, new-shell-style.", "like fstat". The tree read as it is, then a real node on a scratch copy of the tree's files and
  // real clicks in a real Chrome on /face.html, Info opened from its tile in the shell app. No key is ever rotated: the page's
  // node.rotateCipher is replaced by a recorder that refuses, and the node's card is compared before and after. Neither Andy's
  // node nor an agent's is touched.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

  // The dialog's explanation and its button "as they are": shell/rotateKey/rotateKey.js at 4f01465b, as the page reads it.
  const EXPLAINED = [
    'Rotate this node\'s cipher key',
    'When to use it: you believe this node\'s cipher key has been copied or seen, for example because the box was broken into or a backup of its home went somewhere it should not.',
    'What it does: makes a new cipher key and throws the old one away. Your identity stays the same; only the key others seal to changes. The new card goes to every relay you are on at once, and peers pick it up the next time they post to you.',
    'What it costs: anything already sealed to the old key and still on its way cannot be opened. Peers who are offline catch up when they next post.',
    'What it does not do: protect what was sent before. Whoever holds the old key can still read anything they captured with it.',
    'It is a crisis measure, not a routine one.',
  ];
  const BUTTON = 'Rotate the key';
  const ARMED = 'Rotate the key: press again';
  const ELEMENT = path.join(RUN, 'spirit', 'element', 'rotateKey.js');

  function treeFiles() {
    return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
  }
  function scratch() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-rk-'));
    treeFiles().forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    return { root: root, run: path.join(root, 'spirit', 'run') };
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

  // THE PAGE'S HANDS: what shows in #zzBox (or #zzOwn, the element alone); a hidden layer never counts.
  const HANDS = '(function () {' +
    'function box() { return document.getElementById(window.__in || "zzBox"); }' +
    'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
    'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
    'window.__t = {' +
    '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
    '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
    '  tile: function (k) { var t = all(".app-icon[data-key]").filter(function (e) { return e.getAttribute("data-key") === k; })[0]; if (!t) return false; t.click(); return true; },' +
    '  bars: function () { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }).map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
    '  closeLast: function () { var b = all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); if (!b.length) return false; b[b.length - 1].click(); return true; },' +
    '  count: function (sel) { return all(sel).length; },' +
    '  buttons: function () { return all("button").map(function (b) { return String(b.textContent).replace(/\\s+/g, " ").trim(); }); },' +
    '  press: function (words) { var b = all("button").filter(function (x) { return String(x.textContent).replace(/\\s+/g, " ").trim() === words; })[0]; if (!b) return false; b.click(); return true; },' +
    '  says: function (lines) { var t = window.__t.text(); return lines.filter(function (l) { return t.indexOf(l) === -1; }); },' +
    '}; return "hands"; }())';

  test.subHeading('nodeInfo-rotate: the rotate key dialog, an element opened over Info through panel.js (goal/G43.24)');

  await (async function () {
    test.subHeading('the box, 8: "shell/rotateKey/ goes, its line in coreFiles.js\'s INTRINSIC list with it, and its test moves"');
    ok(!fs.existsSync(path.join(RUN, 'shell', 'rotateKey')), 'shell/rotateKey/ is gone', 'shell/rotateKey/ is still there');
    let core = null;
    try { core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { core = null; }
    // Since goal/G43.30 there is no coded INTRINSIC list at all, so none can list shell/rotateKey.
    ok(!!core && !('INTRINSIC' in core), 'no coded INTRINSIC list lists shell/rotateKey: coreFiles.js holds none (goal/G43.30)', 'coreFiles.js ' + (core ? 'still answers an INTRINSIC list' : 'did not load'));
    ok(fs.existsSync(path.join(RUN, 'spirit', 'element', 'test', 'rotateKey.js')) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'test', 'rotateKey.md')), 'its test is in the element\'s test folder: spirit/element/test/rotateKey.js and .md', 'no spirit/element/test/rotateKey.js and .md');
    // What runs, its comments out and its tests out: nothing opens the old dialog any more.
    const opening = treeFiles().filter(function (f) { return /\.(js|html)$/.test(f) && f.split('/').indexOf('test') === -1; })
      .filter(function (f) { return /shell\/rotateKey(?![\w-])/.test(code(path.join(REPO, f))); });
    ok(!opening.length, 'no code opens shell/rotateKey', 'still opening it: ' + short(opening));

    test.subHeading('the box, 8: "becomes an element, spirit/element/rotateKey.js, mounted the new shell\'s way (requirement 7)"');
    const el = code(ELEMENT);
    ok(el.length > 0, 'spirit/element/rotateKey.js is there', 'no spirit/element/rotateKey.js');
    ok(el.length > 0 && !/\bactivateApp\b/.test(el) && !/\bspirit\.shell\b/.test(el), 'rotateKey.js mounts through no spirit.shell.activateApp', el.length ? 'rotateKey.js calls spirit.shell.activateApp' : 'no rotateKey.js: nothing judged');
    const ni = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
    ok(ni.length > 0 && !/\bcallDialog\b/.test(ni), 'nodeInfo opens no dialog of the old shell (no callDialog)', ni.length ? 'nodeInfo.js calls callDialog' : 'no spirit/element/nodeInfo.js: nothing judged');

    const s = scratch();
    let N = null;
    let c = null;
    try {
      N = await boot(s.run);
      ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
      if (!N.up) return;
      const card0 = await call(N.base, 'node.card', {});
      ok(card0.status === 200 && !!card0.body, 'the world: the node answers its card', 'node.card: ' + card0.status + ' ' + short(card0.text));
      const where = findChrome();
      if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
      c = await chromePage(where);
      if (c.error) { test.fail('Chrome: ' + c.error); return; }
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
      // NO KEY IS ROTATED: the page's node.rotateCipher records the ask and refuses it.
      const spy = await c.evaluate('window.spirit.ready.then(function () { var S = window.spirit; window.__rotations = 0; if (!S.node || typeof S.node.rotateCipher !== "function") return "no spirit.node.rotateCipher"; S.node.rotateCipher = function () { window.__rotations += 1; return Promise.resolve({ status: 403, body: { ok: false, error: "refused by the test" } }); }; return "spied"; })');
      ok(spy === 'spied', 'the world: the page\'s node.rotateCipher is a recorder that refuses', 'the spy: ' + short(spy));
      await c.evaluate(HANDS);
      const T = function (expr) { return c.evaluate('window.__t.' + expr); };
      const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
      const rotations = function () { return c.evaluate('window.__rotations'); };

      test.subHeading('the box, 8: the element alone, "its explanation and its two-press arming button as they are"');
      await c.evaluate('window.__in = "zzOwn"');
      // goal/G43.32: rotateKey stands at its path, spirit.element.spirit.element.rotateKey; spirit.elements is no more.
      const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/element/rotateKey.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = ((spirit.element || {}).spirit || {}).element; E = E && E.rotateKey; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.element.rotateKey.create"; window.__rk = E.create(b, {}); return window.__rk && typeof window.__rk.destroy === "function" ? "made" : "create answered " + typeof window.__rk; }, function (e) { return "load: " + e; }); }())');
      ok(made === 'made', 'spirit.element.spirit.element.rotateKey.create(container, opts) answers { destroy() }', 'rotateKey: ' + short(made));
      const alone = made === 'made' && await waitFor('says(' + JSON.stringify(EXPLAINED) + ').length === 0', 6000);
      ok(alone, 'it draws the explanation as it is', made === 'made' ? 'missing: ' + short(await T('says(' + JSON.stringify(EXPLAINED) + ')')) : 'no element: nothing judged');
      const hasButton = made === 'made' && await waitFor('buttons().indexOf(' + JSON.stringify(BUTTON) + ') !== -1', 6000);
      ok(hasButton, 'it draws its button, ' + BUTTON, made === 'made' ? 'its buttons: ' + short(await T('buttons()')) : 'no element: nothing judged');
      if (hasButton) await T('press(' + JSON.stringify(BUTTON) + ')');
      const armedAlone = hasButton && await waitFor('buttons().indexOf(' + JSON.stringify(ARMED) + ') !== -1 && count("button[data-armed]") === 1', 4000);
      ok(armedAlone, 'one press arms it: ' + ARMED, hasButton ? 'after one press: ' + short(await T('buttons()')) : 'no button: nothing judged');
      ok(hasButton && (await rotations()) === 0, 'and one press rotates nothing', hasButton ? 'one press asked node.rotateCipher ' + (await rotations()) + ' times' : 'no button: nothing judged');
      await c.evaluate('(function () { try { if (window.__rk) window.__rk.destroy(); } catch (e) { /* judged above */ } var b = document.getElementById("zzOwn"); if (b) b.remove(); window.__in = "zzBox"; return true; }())');

      test.subHeading('the box, 8: "nodeInfo\'s rotate button opens it as a layer over Info through panel.js ... its ✕ shows Info again"');
      const shell = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
      ok(shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the shell draws its tiles', 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()')));
      const infoOpen = (await waitFor('tiles().indexOf("info") !== -1', 6000)) && (await T('tile("info")')) && await waitFor('count("[data-field=label]") === 1 && buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 10000);
      ok(infoOpen, 'the world: Info opens from its tile, its name field and its rotate button shown', 'Info did not open with its rotate button: ' + short(await T('text()')) + ' tiles ' + short(await T('tiles()')));
      if (!infoOpen) { test.fail('Info did not open: the rotate button was not judged'); return; }
      const before = await T('bars()');
      await T('press("Rotate this node\'s cipher key")');
      const over = await waitFor('says(' + JSON.stringify(EXPLAINED.slice(1)) + ').length === 0', 8000);
      ok(over, 'the rotate button opens the dialog: its explanation shows', 'after the press: ' + short(await T('text()')));
      ok(over && (await T('count("[data-field=label]")')) === 0 && (await T('count("[data-field=description]")')) === 0, 'over Info: Info\'s fields are out of view', over ? 'Info still shows its fields' : 'nothing opened: nothing judged');
      const bars = await T('bars()');
      ok(over && bars.length === 1 && short(bars) !== short(before) && (await T('count(".app-container-close")')) === 1, '"like fstat": one layer of panel.js over all of Info, one bar in view, its own (' + short(bars) + ')', over ? 'bars before ' + short(before) + ', now ' + short(bars) + ', panel.js closes in view ' + (await T('count(".app-container-close")')) : 'nothing opened: nothing judged');
      const layerButton = over && await waitFor('buttons().indexOf(' + JSON.stringify(BUTTON) + ') !== -1', 4000);
      ok(layerButton, 'the layer shows its button, ' + BUTTON, over ? 'its buttons: ' + short(await T('buttons()')) : 'nothing opened: nothing judged');
      if (layerButton) await T('press(' + JSON.stringify(BUTTON) + ')');
      const armed = layerButton && await waitFor('buttons().indexOf(' + JSON.stringify(ARMED) + ') !== -1', 4000);
      ok(armed, 'one press arms it: ' + ARMED, layerButton ? 'after one press: ' + short(await T('buttons()')) : 'no button: nothing judged');
      await sleep(800);
      ok(layerButton && (await rotations()) === 0, 'and one press rotates nothing', layerButton ? 'one press asked node.rotateCipher ' + (await rotations()) + ' times' : 'no button: nothing judged');
      const closed = over && await T('closeLast()');
      const back = closed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1 && says([' + JSON.stringify(EXPLAINED[1]) + ']).length === 1', 6000);
      ok(back, 'its ✕ shows Info again, the dialog out of view', closed ? 'after ✕: ' + short(await T('text()')) : 'no ✕ to press: nothing judged');
      ok(back && short(await T('bars()')) === short(before), 'and Info\'s bar is the one in view again', back ? 'bars: ' + short(await T('bars()')) : 'Info did not come back: nothing judged');

      test.subHeading('no key was rotated');
      const card1 = await call(N.base, 'node.card', {});
      ok(card0.status === 200 && card1.status === 200 && card1.text === card0.text, 'the node\'s card is as it was', 'card before ' + short(card0.text) + ', after ' + short(card1.text));
    } finally {
      try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
      try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
      if (N) await stop(N.child);
      try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
