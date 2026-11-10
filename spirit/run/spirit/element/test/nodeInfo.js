'use strict';

// spirit/run/spirit/element/test/nodeInfo.js
// The tests of spirit/element/nodeInfo.js, and of no other module (spec: ./nodeInfo.md; goal/G43.24, requirement 6; Q2,
// Andy: "nodeInfo is fine."). The browser file runs in node on a BARE window (rule/26): each part is put on the page only
// once nodeInfo requires it, a stand-in that keeps what it was handed (the two field elements, the two relay forms, the
// rowForm, panel.js and rotateKey, each tested in its own file). The page's data set and the node family's cache manager
// are the real ones. The node is the spirit object's node and relay families, stubs that record every call and answer as
// the node would. The rotate key dialog opening over Info on a real page is judged in ./nodeInfoRotate.js.

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
  const E = {
    changeMyLabel: field('label'),
    changeMyDescription: field('description'),
    joinForm: { mount: function (host, x) { w.forms.push({ form: 'join', host: host, o: x }); } },
    faceForm: { mount: function (host, x) { w.forms.push({ form: 'face', host: host, o: x }); } },
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
  const page = {};
  const els = {};
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
  S.elements = els;
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
    (FILES[p] || []).forEach(function (k) { page[k] = E[k]; });
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
  ok(!!NI && typeof NI.create === 'function', 'it sets spirit.elements.nodeInfo = { create }', 'elements: ' + short(Object.keys(w.els)));
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
    'its fill loads spirit/element/rotateKey.js and makes spirit.elements.rotateKey in the layer\'s pane, answering it to destroy', 'required ' + short(w.required.slice(-1)) + ', made ' + w.rotateKeys.length);
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
