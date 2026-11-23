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
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'nodeInfo.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

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
  // goal/G43.32: one place for every element, spirit.required.spirit.element, the parts it requires and itself.
  const page = { spirit: { element: {} } };
  const els = page.spirit.element;
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.startPage leaves it before any element runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  const S = win.spirit;
  Object.assign(S.required.spirit, page.spirit);
  S.nodeFacts = { key: 'NODEKEY+INFO==',
    card: function (args) { w.calls.push({ name: 'node.card', args: args });
      if (opt.cardHeld) return opt.cardHeld;
      const a = opt.card ? opt.card() : { status: 200, body: CARD };
      return a.status === 200 ? Promise.resolve(a.body) : Promise.reject({ status: a.status, body: a.body }); } };
  S.node = S.nodeFacts; S.required.spirit.data.homeNode(S.nodeFacts.key);
  S.relay = { status: function (arg) { w.statuses += 1; w.calls.push({ name: 'relay.status', args: arg });
    if (opt.relaysHeld) return opt.relaysHeld;
    if (opt.relaysRefused) return Promise.reject({ status: 503, body: { ok: false, error: 'no relay answered' } });
    // As the real one answers (spirit/relay/api.js): { status, text, body: { rows, ... } }.
    return Promise.resolve(answered((opt.rows || ROWS).slice())); } };
  S.readyPromise = Promise.resolve(S);
  S.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
  S.callOutcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
  S.requireScript = function (p) {
    w.required.push(String(p));
    if (opt.refuse && opt.refuse.indexOf(p) !== -1) return Promise.reject(new Error('not-found ' + p));
    // A family's cache (goal/G41.28): a branch's interface brings its data.js, as the real api.js does; it runs once on
    // this window over the real data set, from its path.
    const fam = /^spirit\/([^/]+)\/api\.js$/.exec(String(p));
    if (fam && !(S.required.spirit.data[fam[1]] && S.required.spirit.data[fam[1]].data)) vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', fam[1], 'data.js'), 'utf8'), win, { filename: 'spirit/' + fam[1] + '/data.js' });
    (FILES[p] || []).forEach(function (k) { els[k] = E[k]; });
    if (p === 'spirit/element/panel.js') els.panel = panel;
    if (p === 'spirit/element/rotateKey.js') els.rotateKey = rotateKey;
    return Promise.resolve({});
  };
  // goal/G43.32: nodeInfo.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = S.requireScript;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(S);
  const pageRequire = S.requireScript;
  S.requireScript = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.S = S; w.page = page; w.els = els;
  w.slot = function (host, name) { return host.querySelector('[data-info="' + name + '"]'); };
  w.rotate = function () { return w.rowForms.filter(function (f) { return /Rotate/.test(f.opts.button || ''); })[0] || null; };
  return w;
}

// What the tests make, shared by the tests after them.
let w, NI, host, made, said, label, desc, card, N, all, refused, h2, m2, N2, silent, h3, m3, join, face, nForms,
  letRelays, slow, h4, m4, none, h5, m5, rf, op, pane, filled, pane2, notFilled, wo, opened, ho, mo, letCard, late,
  h6, m6, letRel, late2, h7, m7, broken, h8;
test.run('spirit/element/nodeInfo.js is there', 0.2, function () {
  return (!!SRC) ? true : false;
}, test.limit.quick);
test.run('it places nodeInfo at spirit.required.spirit.element.nodeInfo, with a create', 0.2, function () {
  // an element mounted the new shell's way, that loads what it uses itself (rule/26)
  w = world();
  NI = w.els.nodeInfo;
  return (!!NI && typeof NI.create === 'function') ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/changeMyLabel.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/changeMyLabel.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/changeMyDescription.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/changeMyDescription.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/joinForm.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/joinForm.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/faceForm.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/faceForm.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/rowForm.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/rowForm.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires spirit/element/panel.js', 0.2, function () {
  return (w.required.indexOf('spirit/element/panel.js') !== -1) ? true : false;
}, test.limit.quick);
test.run('it requires the rotate key dialog only when the dialog is opened', 0.2, function () {
  return (w.required.indexOf('spirit/element/rotateKey.js') === -1) ? true : false;
}, test.limit.quick);
test.run('it uses neither spirit.shell.activateApp nor a dialog of the old shell', 0.2, function () {
  return (!/\bactivateApp\b|\bspirit\.shell\b|\bcallDialog\b/.test(CODE)) ? true : false;
}, test.limit.quick);
test.run('it asks through the spirit object\'s branches, never through an api, an api verb or peerPost', 0.2, function () {
  // Andy: "every fucking element gets the interfaces it needs": the spirit object's families, no api handed.
  // A branch's interface asked by its path (spirit/node/api.js) is the spirit object's family, no api object.
  return (!/\bapi\s*\.(?!js\b)|\.verb\s*\(|\bpeerPost\b/.test(CODE)) ? true : false;
}, test.limit.quick);
test.run('nothing in it ticks, because it sets no timer', 0.2, function () {
  // Nothing ticks (the file's own rule): nothing here changes without this element asking.
  return (!/\bsetInterval\b|\bsetTimeout\b/.test(CODE)) ? true : false;
}, test.limit.quick);
test.run('it has no relay table, no push of the name to every relay and no rename', 0.2, function () {
  // "What each relay calls you" is dropped (Andy, 2026-10-27), its code with it.
  return (!/What each relay calls you/.test(SRC) && !/infoDrawRelays|infoPush|infoPushed|rename\s*:/.test(SRC)) ? true : false;
}, test.limit.quick);
test.run('create, given a container and options, answers a ready promise and a destroy', 0.2, function () {
  host = node('<container>');
  made = NI.create(host, {});
  return (!!made && typeof made.destroy === 'function' && made.ready && typeof made.ready.then === 'function') ? true : false;
}, test.limit.quick);
test.run('its heading says What this node says about itself', 0.2, async function () {
  await made.ready;
  await settle();
  // the page: what it says first, a slot for each part
  said = text(host);
  return (/What this node says about itself/.test(said)) ? true : false;
}, test.limit.quick);
test.run('the one note before the boxes says these two are answered to anybody who asks', 0.2, function () {
  return (said.indexOf('Anybody who asks this node is told these two things, whether or not you have ever met. Nothing else about this box is answered to a stranger.') !== -1) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its name', 0.2, function () {
  return (!!w.slot(host, 'name')) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its description', 0.2, function () {
  return (!!w.slot(host, 'description')) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its said', 0.2, function () {
  return (!!w.slot(host, 'said')) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its email', 0.2, function () {
  return (!!w.slot(host, 'email')) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its face', 0.2, function () {
  return (!!w.slot(host, 'face')) ? true : false;
}, test.limit.quick);
test.run('it has a slot for its rotate', 0.2, function () {
  return (!!w.slot(host, 'rotate')) ? true : false;
}, test.limit.quick);
test.run('it empties its container and draws into one fill box', 0.2, function () {
  return (host.innerHTML === '' && host.kids.length === 1 && /\bfill\b/.test(host.kids[0].className)) ? true : false;
}, test.limit.quick);
test.run('the name is changeMyLabel, in the name slot', 0.2, function () {
  // its two fields are the two elements, handed nothing (goal/G41.6)
  label = w.made.filter(function (m) { return m.kind === 'label'; });
  desc = w.made.filter(function (m) { return m.kind === 'description'; });
  return (label.length === 1 && label[0].host === w.slot(host, 'name')) ? true : false;
}, test.limit.quick);
test.run('the description is changeMyDescription, in the description slot', 0.2, function () {
  return (desc.length === 1 && desc[0].host === w.slot(host, 'description')) ? true : false;
}, test.limit.quick);
test.run('each field is made with its container alone, handed no api, and gets what it needs itself', 0.2, function () {
  return (w.made.every(function (m) { return m.args === 1 && m.opts === undefined; })) ? true : false;
}, test.limit.quick);
test.run('it asks spirit.required.spirit.node.api.card once, with an empty object', 0.2, function () {
  // the card: node.card, kept in the node family's cache (goal/G41.28)
  card = w.calls.filter(function (c) { return c.name === 'node.card'; });
  return (card.length === 1 && JSON.stringify(card[0].args) === '{}') ? true : false;
}, test.limit.quick);
test.run('it requires spirit/node/api.js, no data.js, and keeps node.card\'s answer in spirit.required.spirit.data.node.data', 0.2, function () {
  N = ((w.S.required.spirit.data || {}).node || {}).data;
  return (w.required.indexOf('spirit/node/api.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); }) && !!N && !!N.card.get() && N.card.get().name === 'Andy' && N.card.get().description === 'a node') ? true : false;
}, test.limit.quick);
test.run('a card read says nothing', 0.2, function () {
  return (w.slot(host, 'said').textContent === '') ? true : false;
}, test.limit.quick);
test.run('no key is shown, neither the node\'s nor a relay\'s', 0.2, function () {
  // No key is shown (goal/G40.10, box v15; Andy: "remove ANY indication of keys from all user interfaces").
  all = host.kids.map(function (k) { return k.innerHTML; }).join('') + under(host).map(function (k) { return k.innerHTML + k.textContent; }).join('');
  return (!/NODEKEY|RELAYKEY/.test(all) && !/\bkey\b/i.test(said.replace(/cipher key/g, ''))) ? true : false;
}, test.limit.quick);
test.run('a card refused is said in the node\'s words, and nothing is kept', 0.2, async function () {
  refused = world({ card: function () { return { status: 403, body: { ok: false, error: 'owner only' } }; } });
  h2 = node('<container>');
  m2 = refused.els.nodeInfo.create(h2, {});
  await m2.ready;
  await settle();
  N2 = refused.S.required.spirit.data.node && refused.S.required.spirit.data.node.data;
  return (/owner only/.test(refused.slot(h2, 'said').textContent) && !(N2 && N2.card.get())) ? true : false;
}, test.limit.quick);
test.run('a node that does not answer is said as node.card did not answer', 0.2, async function () {
  silent = world({ card: function () { return { status: 0, body: null }; } });
  h3 = node('<container>');
  m3 = silent.els.nodeInfo.create(h3, {});
  await m3.ready;
  await settle();
  return (/node\.card did not answer/.test(silent.slot(h3, 'said').textContent)) ? true : false;
}, test.limit.quick);
test.run('it asks spirit.relay.status once, with an empty string', 0.2, function () {
  // the two forms: the email form always, the face form only for a starred relay (goal/G43.27)
  return (w.statuses === 1 && w.calls.filter(function (c) { return c.name === 'relay.status'; })[0].args === '') ? true : false;
}, test.limit.quick);
test.run('the email form (joinForm) stands above the face form (faceForm), each in its slot', 0.2, function () {
  join = w.forms.filter(function (f) { return f.form === 'join'; }).pop();
  face = w.forms.filter(function (f) { return f.form === 'face'; }).pop();
  return (!!join && !!face && join.host === w.slot(host, 'email') && face.host === w.slot(host, 'face')) ? true : false;
}, test.limit.quick);
const urls = function (f) { return f.o.relays.map(function (r) { return r.url; }).join(','); };
test.run('each is handed every relay relay.status lists (the email form always; the face form picks a seated, starred one itself)', 0.2, function () {
  return (urls(join) === ROWS.map(function (r) { return r.url; }).join(',') && urls(face) === urls(join)) ? true : false;
}, test.limit.quick);
test.run('the email form is not narrowed to the seated, so Join shows with no seat held; no form is handed an escape, each has its own', 0.2, function () {
  return (!('pick' in join.o) && !('escape' in join.o) && !('escape' in face.o)) ? true : false;
}, test.limit.quick);
test.run('the face form is handed a reload', 0.2, function () {
  return (typeof face.o.reload === 'function') ? true : false;
}, test.limit.quick);
test.run('its reload asks relay.status again and draws both forms again', 0.2, async function () {
  nForms = w.forms.length;
  await face.o.reload();
  await settle();
  return (w.statuses === 2 && w.forms.length === nForms + 2) ? true : false;
}, test.limit.quick);
test.run('the fields and the card do not wait for the relays', 0.2, async function () {
  // The relays are a probe of every mailbox and land when they land: the fields do not wait for them.
  letRelays = null;
  slow = world({ relaysHeld: new Promise(function (r) { letRelays = r; }) });
  h4 = node('<container>');
  m4 = slow.els.nodeInfo.create(h4, {});
  await m4.ready;
  await settle();
  return (slow.made.length === 2 && !!(slow.S.required.spirit.data.node && slow.S.required.spirit.data.node.data.card.get()) && slow.forms.length === 0) ? true : false;
}, test.limit.quick);
test.run('the forms are drawn when the relays land', 0.2, async function () {
  letRelays(answered(ROWS));
  await settle();
  return (slow.forms.length === 2) ? true : false;
}, test.limit.quick);
test.run('with relay.status refused, the forms are drawn over no relay and nothing is thrown', 0.2, async function () {
  none = world({ relaysRefused: true });
  h5 = node('<container>');
  m5 = none.els.nodeInfo.create(h5, {});
  await m5.ready;
  await settle();
  return (none.forms.length === 2 && none.forms.every(function (f) { return Array.isArray(f.o.relays) && f.o.relays.length === 0; })) ? true : false;
}, test.limit.quick);
test.run('one rowForm stands in the rotate slot, with the icon 🆘 and the button Rotate this node\'s cipher key', 0.2, function () {
  // the key rotation, a rowForm: 🆘 [Rotate this node's cipher key] (goal/G41.27)
  rf = w.rotate();
  return (!!rf && w.rowForms.filter(function (f) { return /Rotate/.test(f.opts.button || ''); }).length === 1 && rf.opts.icon === '🆘' && rf.opts.button === 'Rotate this node\'s cipher key' && rf.container === w.slot(host, 'rotate')) ? true : false;
}, test.limit.quick);
test.run('the rotate rowForm\'s span holds nothing', 0.2, function () {
  return (rf.span.kids.length === 0 && rf.span.nodes.length === 0 && !String(rf.span.innerHTML || '').trim()) ? true : false;
}, test.limit.quick);
test.run('it draws no button of its own', 0.2, function () {
  return (!/<button/.test(host.kids.map(function (k) { return k.innerHTML; }).join('') + under(host).map(function (k) { return k.innerHTML; }).join(''))) ? true : false;
}, test.limit.quick);
test.run('it makes one stack with panel.create over its box and its page, so a layer covers all of Info', 0.2, function () {
  // without a mounter's stack: the dialog opens over Info through its own panel.js stack (like fstat)
  return (w.panels.length === 1 && w.panels[0].host === host.kids[0] && !!w.panels[0].under && w.panels[0].under === host.kids[0].kids[0]) ? true : false;
}, test.limit.quick);
test.run('the rotate button opens rotateKey in that stack as 🆘 Rotate this node\'s cipher key, with a fill', 0.2, async function () {
  rf.button.fire('click');
  await settle();
  op = w.panels[0] && w.panels[0].opens[0];
  return (!!op && op.key === 'rotateKey' && op.spec.icon === '🆘' && op.spec.label === 'Rotate this node\'s cipher key' && typeof op.spec.fill === 'function') ? true : false;
}, test.limit.quick);
test.run('pressing the rotate button rotates nothing, since the dialog does that on its own two presses', 0.2, function () {
  return (w.calls.filter(function (c) { return /rotate/i.test(c.name); }).length === 0) ? true : false;
}, test.limit.quick);
test.run('its fill loads spirit/element/rotateKey.js and makes spirit.required.spirit.element.rotateKey in the layer\'s pane, to destroy', 0.2, async function () {
  pane = node('<pane>');
  filled = await op.spec.fill(pane, function () { return false; });
  return (w.required.indexOf('spirit/element/rotateKey.js') !== -1 && w.rotateKeys.length === 1 && w.rotateKeys[0].pane === pane && filled === w.rotateKeys[0]) ? true : false;
}, test.limit.quick);
test.run('a layer closed before the dialog loads gets nothing made', 0.2, async function () {
  pane2 = node('<pane>');
  notFilled = await op.spec.fill(pane2, function () { return true; });
  return (notFilled === null && w.rotateKeys.length === 1) ? true : false;
}, test.limit.quick);
test.run('handed a mounter\'s open, it makes no stack of its own', 0.2, async function () {
  // with the mounter's stack, opts.open: the dialog opens there, over all of Info
  wo = world();
  opened = [];
  ho = node('<container>');
  mo = wo.els.nodeInfo.create(ho, { open: function (k, spec) { opened.push({ key: k, spec: spec }); return Promise.resolve({}); } });
  await mo.ready;
  await settle();
  return (wo.panels.length === 0) ? true : false;
}, test.limit.quick);
test.run('then the rotate button opens rotateKey through the open it was handed', 0.2, async function () {
  wo.rotate().button.fire('click');
  await settle();
  return (opened.length === 1 && opened[0].key === 'rotateKey' && opened[0].spec.label === 'Rotate this node\'s cipher key' && typeof opened[0].spec.fill === 'function') ? true : false;
}, test.limit.quick);
test.run('destroy destroys both fields', 0.2, function () {
  // destroy
  made.destroy();
  return (w.destroyed.indexOf('label') !== -1 && w.destroyed.indexOf('description') !== -1) ? true : false;
}, test.limit.quick);
test.run('destroy destroys both forms, each made once by its create', 0.2, function () {
  // rule/8: each form holds a contact watch, let go only by its destroy.
  return (w.destroyed.indexOf('joinForm') !== -1 && w.destroyed.indexOf('faceForm') !== -1) ? true : false;
}, test.limit.quick);
test.run('destroy destroys its stack, the open dialog with it', 0.2, function () {
  return (w.panels[0].destroyed === true) ? true : false;
}, test.limit.quick);
test.run('destroy empties its container', 0.2, function () {
  return (host.innerHTML === '' && host.kids.length === 0) ? true : false;
}, test.limit.quick);
test.run('a card that lands after destroy is not kept', 0.2, async function () {
  letCard = null;
  late = world({ cardHeld: new Promise(function (r) { letCard = r; }), relaysHeld: new Promise(function () {}) });
  h6 = node('<container>');
  m6 = late.els.nodeInfo.create(h6, {});
  await settle();
  m6.destroy();
  letCard(CARD);
  await settle();
  return (!(late.S.required.spirit.data.node && late.S.required.spirit.data.node.data.card.get())) ? true : false;
}, test.limit.quick);
test.run('relays that land after destroy draw no form', 0.2, async function () {
  letRel = null;
  late2 = world({ relaysHeld: new Promise(function (r) { letRel = r; }) });
  h7 = node('<container>');
  m7 = late2.els.nodeInfo.create(h7, {});
  await m7.ready;
  m7.destroy();
  letRel(answered(ROWS));
  await settle();
  return (late2.forms.length === 0) ? true : false;
}, test.limit.quick);
test.run('a part refused is said as Info could not be loaded', 0.2, async function () {
  // a part that cannot be loaded is said
  broken = world({ refuse: ['spirit/element/changeMyLabel.js'] });
  h8 = node('<container>');
  broken.els.nodeInfo.create(h8, {});
  await settle();
  return (/Info could not be loaded/.test(broken.slot(h8, 'said').textContent)) ? true : false;
}, test.limit.quick);

// The parts that were once files of their own (nodeInfo-forms.js, nodeInfo-parts.js, nodeInfo-rotate.js): one test
// file per script (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, its tests run after these, in order.
formsPart();
partsPart();
rotatePart();

function formsPart() {
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
    // goal/G43.32: every element stands at its path, spirit.required.spirit.element.<name>, the stand-ins with them.
    Object.assign(S.required.spirit, { element: {} });
    const at = S.required.spirit.element;
    const field = { create: function () { return { destroy: function () {} }; } };
    at.changeMyLabel = field; at.changeMyDescription = field;
    at.rowForm = { create: function (c, x) {
      const f = { opts: x || {}, root: node('<div>'), span: node('<span>'), button: node('<button>') };
      f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      return f;
    } };
    S.nodeFacts = { key: 'NODEKEY+INFO==', card: function () { return Promise.resolve(CARD); } };
    S.node = S.nodeFacts; S.required.spirit.data.homeNode(S.nodeFacts.key);
    // As the relay family's status answers (spirit/relay/api.js, status): { status, text, body: { rows, ... } }.
    S.relay = { status: function () {
      const body = { name: '', rows: relayRows.slice(), ownedUrls: [], claimedUrls: [], mustPick: false, relayStatus: {}, more: false };
      return Promise.resolve({ status: 200, text: JSON.stringify(body), body: body });
    } };
    S.readyPromise = Promise.resolve(S);
    S.escapeHtml = function (s) { return String(s).replace(/</g, '&lt;'); };
    S.callOutcome = function (c) { return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; }, function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; }); };
    // The two forms are the real files, run on this window as a page runs them; every other part a stand-in.
    const real = { 'spirit/element/joinForm.js': 1, 'spirit/element/faceForm.js': 1 };
    // goal/G43.32: each element places itself by installSpiritElement, handed by the page stand-in
    // (spirit/test/headLessChrome.js pageSpirit).
    require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(S);
    const pageRequire = S.requireScript;
    S.requireScript = function (p) {
      if (/installSpiritElement\.js$/.test(p)) return pageRequire(p);
      if (real[p]) { vm.runInContext(fs.readFileSync(path.join(RUN, p), 'utf8'), win, { filename: p }); delete real[p]; }
      // A branch's interface brings its data.js, as the real api.js does: run once on this window from its path.
      const fam = /^spirit\/([^/]+)\/api\.js$/.exec(String(p));
      if (fam && !(S.required.spirit.data[fam[1]] && S.required.spirit.data[fam[1]].data)) vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', fam[1], 'data.js'), 'utf8'), win, { filename: 'spirit/' + fam[1] + '/data.js' });
      if (p === 'spirit/element/panel.js') at.panel = { create: function () { return { open: function () { return Promise.resolve({}); }, destroy: function () {} }; } };
      if (p === 'spirit/element/rotateKey.js') at.rotateKey = { create: function () { return { destroy: function () {} }; } };
      return Promise.resolve({});
    };
    vm.runInContext(fs.readFileSync(path.join(EL, 'nodeInfo.js'), 'utf8'), win, { filename: 'nodeInfo.js' });
    const host = node('<div>');
    const made = at.nodeInfo && typeof at.nodeInfo.create === 'function' ? at.nodeInfo.create(host, {}) : null;
    await settle();
    const slot = function (name) { return host.querySelector('[data-info="' + name + '"]'); };
    const shows = function (box, cls) { return !!box && box.style.display !== 'none' && !box.hidden && !!box.querySelector(cls); };
    return { made: made, email: slot('email'), face: slot('face'), shows: shows, S: S };
  }

  // What the tests make, shared by the tests after them.
  let plain, placed, starred, unseated, drawn, opts;
  test.run('Info is made, with its email and face slots', 0.2, async function () {
    // nodeInfo-forms: Info shows the email form always, the face form only for a starred relay (goal/G43.27, 9 and 10)
    // the world
    plain = await info(rows(''));
    return (!!plain.made && !!plain.email && !!plain.face) ? true : false;
  }, test.limit.quick);
  test.run('the real joinForm.js and faceForm.js ran on the page', 0.2, function () {
    // goal/G43.32: they stand at their paths.
    placed = plain.S.required.spirit.element;
    return (!!placed.joinForm && !!placed.faceForm) ? true : false;
  }, test.limit.quick);
  test.run('with seats on A and O and none starred, the email form shows', 0.2, function () {
    // 9. the email form always
    return (plain.shows(plain.email, '.sp-join-email')) ? true : false;
  }, test.limit.quick);
  test.run('with A starred, the email form shows', 0.2, async function () {
    starred = await info(rows('A'));
    return (starred.shows(starred.email, '.sp-join-email')) ? true : false;
  }, test.limit.quick);
  test.run('with no seat on any relay, the email form still shows', 0.2, async function () {
    unseated = await info(rows('').map(function (r) { return Object.assign({}, r, { claimed: false, owned: false }); }));
    return (unseated.shows(unseated.email, '.sp-join-email')) ? true : false;
  }, test.limit.quick);
  test.run('with no relay starred, no face form shows', 0.2, function () {
    // 10. the face form only for a starred relay
    return (!plain.shows(plain.face, '.sp-face-name')) ? true : false;
  }, test.limit.quick);
  test.run('with A faceable, the face form shows', 0.2, function () {
    return (starred.shows(starred.face, '.sp-face-name')) ? true : false;
  }, test.limit.quick);
  test.run('the face form offers one relays with with a faceable mark', 0.2, function () {
    drawn = starred.face ? [starred.face].concat(under(starred.face)).map(function (k) { return k.innerHTML; }).join(' ') : '';
    opts = (drawn.match(/<option value="([^"]*)"/g) || []).map(function (o) { return o.replace(/^<option value="|"$/g, ''); });
    return (opts.length === 1 && opts[0] === 'https://a.example') ? true : false;
  }, test.limit.quick);
}

function partsPart() {
  // The parts part (once nodeInfo-parts.js).
  // ALL OF INFO IS IN ONE ELEMENT, nodeInfo.js (goal/G43.24, requirement 6, Q2; spec: ./nodeInfo.md, its parts section). The box: "the page
  // layout, the relays ... (relay.status), the card ... (node.card), the rotate button ... They move into one new element,
  // spirit/element/nodeInfo.js (Q2)". Andy: "no i want those apps to basically be wrappers for spirit/element/ things....".
  // nodeInfo.js read as it is, comments stripped.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

  function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

  // What the tests make, shared by the tests after them.
  let nodeInfo;
  test.run('all of Info is in one element, spirit/element/nodeInfo.js, and its code is there', 0.2, function () {
    // nodeInfo-parts: all of Info is in one element, nodeInfo.js (goal/G43.24)
    // the box, 6: "They move into one new element, spirit/element/nodeInfo.js (Q2)"
    nodeInfo = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
    return (nodeInfo.length > 0) ? true : false;
  }, test.limit.quick);
  test.run('nodeInfo asks relay.status, the relays this node holds a seat on', 0.2, function () {
    return (/\brelay\W{1,4}status\b/.test(nodeInfo)) ? true : false;
  }, test.limit.quick);
  test.run('nodeInfo puts the card from node.card into the node cache', 0.2, function () {
    return (/\bnode\W{1,4}card\b/.test(nodeInfo)) ? true : false;
  }, test.limit.quick);
  test.run('nodeInfo draws the rotate button', 0.2, function () {
    return (/Rotate this node/.test(nodeInfo)) ? true : false;
  }, test.limit.quick);
}

function rotatePart() {
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
  const { spawn } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

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

  function scratch() {
    const root = LABH.scratchTree().root;
    return { root: root, run: path.join(root, 'spirit', 'run') };
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: '', body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = LABH.startNodeOn(run, port);
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

  // THE PAGE'S HANDS: what shows in #zzBox; a hidden layer never counts.
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

  // What the tests make, shared by the tests after them.
  let ni, s, N, c, card0, where, spy, shell, infoOpen, before,
    over, bars, layerButton, armed, closed, back, card1;
  // The old dialog's folder gone, its INTRINSIC line gone, its test moved, nothing opening it (the box, 8): the move is done
  // and shell/ is gone, so those checks are dropped (goal/G47.1); that a require names a file that is there is
  // spirit-sibling-general.js's. rotateKey.js itself, alone, is its own test's: spirit/element/test/rotateKey.js.
  test.run('nodeInfo opens no dialog of the old shell, through callDialog or otherwise', 0.2, function () {
    ni = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
    return (ni.length > 0 && !/\bcallDialog\b/.test(ni)) ? true : false;
  }, test.limit.quick);
  test.run('a scratch node comes up for this suite', 0.2, async function () {
    s = scratch();
    N = null;
    c = null;
    N = await boot(s.run);
    return (N.up) ? true : false;
  }, test.limit.slow);
  test.run('the scratch node answers its card', 0.2, async function () {
    if (!N || !N.up) return false;
    card0 = await call(N.base, 'node.card', {});
    return (card0.status === 200 && !!card0.body) ? true : false;
  }, test.limit.quick);
  test.run('Chrome is on this machine', 0.2, function () {
    if (!N || !N.up) return false;
    where = findChrome();
    return (!!where) ? true : false;
  }, test.limit.quick);
  test.run('a Chrome page opens', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    c = await chromePage(where);
    return (!c.error) ? true : false;
  }, test.limit.quick);
  test.run('the face page has its spirit', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    return (await until(function () { return c.evaluate('!!(window.spirit && window.spirit.readyPromise && window.spirit.eventStream)'); }, 20000)) ? true : false;
  }, test.limit.quick);
  test.run('the page\'s node.rotateCipher is replaced by a recorder that refuses', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    // NO KEY IS ROTATED: the page's node.rotateCipher records the ask and refuses it.
    spy = await c.evaluate('window.spirit.readyPromise.then(function () { var S = window.spirit; window.__rotations = 0; if (!S.nodeFacts || typeof S.required.spirit.node.api.rotateCipher !== "function") return false; S.required.spirit.node.api.rotateCipher = function () { window.__rotations += 1; return Promise.resolve({ status: 403, body: { ok: false, error: "refused by the test" } }); }; return "spied"; })');
    return (spy === 'spied') ? true : false;
  }, test.limit.quick);
  const T = function (expr) { return c.evaluate('window.__t.' + expr); };
  const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
  const rotations = function () { return c.evaluate('window.__rotations'); };
  test.run('the shell draws its tiles', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    // The page's hands (HANDS above), on #zzBox: the dialog is judged over Info, in its layer.
    await c.evaluate(HANDS);
    await c.evaluate('window.__in = "zzBox"');
    // the box, 8: "nodeInfo's rotate button opens it as a layer over Info through panel.js ... its ✕ shows Info again"
    shell = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function () { window.__shell = spirit.required.spirit.element.script.create(b); return "made"; }, function () { return false; }); }())');
    return (shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000)) ? true : false;
  }, test.limit.quick);
  test.run('Info opens from its tile, showing its name field and its rotate button', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    infoOpen = (await waitFor('tiles().indexOf("info") !== -1', 6000)) && (await T('tile("info")')) && await waitFor('count("[data-field=label]") === 1 && buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 10000);
    return (infoOpen) ? true : false;
  }, test.limit.quick);
  test.run('the rotate button opens the dialog, and its explanation shows', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    before = await T('bars()');
    await T('press("Rotate this node\'s cipher key")');
    over = await waitFor('says(' + JSON.stringify(EXPLAINED.slice(1)) + ').length === 0', 8000);
    return (over) ? true : false;
  }, test.limit.quick);
  test.run('with the dialog over Info, Info\'s fields are out of view', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    return (over && (await T('count("[data-field=label]")')) === 0 && (await T('count("[data-field=description]")')) === 0) ? true : false;
  }, test.limit.quick);
  test.run('like fstat, one layer of panel.js lies over all of Info, with one bar in view, its own', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    bars = await T('bars()');
    return (over && bars.length === 1 && short(bars) !== short(before) && (await T('count(".app-container-close")')) === 1) ? true : false;
  }, test.limit.quick);
  test.run('the layer shows its button Rotate the key', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    layerButton = over && await waitFor('buttons().indexOf(' + JSON.stringify(BUTTON) + ') !== -1', 4000);
    return (layerButton) ? true : false;
  }, test.limit.quick);
  test.run('in the layer, one press arms the button, which then says Rotate the key: press again', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    if (layerButton) await T('press(' + JSON.stringify(BUTTON) + ')');
    armed = layerButton && await waitFor('buttons().indexOf(' + JSON.stringify(ARMED) + ') !== -1', 4000);
    return (armed) ? true : false;
  }, test.limit.quick);
  test.run('in the layer, one press rotates nothing', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    await sleep(800);
    return (layerButton && (await rotations()) === 0) ? true : false;
  }, test.limit.slow);
  test.run('the layer\'s ✕ shows Info again, with the dialog out of view', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    closed = over && await T('closeLast()');
    back = closed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1 && says([' + JSON.stringify(EXPLAINED[1]) + ']).length === 1', 6000);
    return (back) ? true : false;
  }, test.limit.quick);
  test.run('after the ✕, Info\'s bar is the one in view again', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    return (back && short(await T('bars()')) === short(before)) ? true : false;
  }, test.limit.quick);
  test.run('the node\'s card is as it was', 0.2, async function () {
    if (!N || !N.up) return false;
    if (!where) return false;
    if (!c || c.error) return false;
    if (!infoOpen) return false;
    // no key was rotated
    card1 = await call(N.base, 'node.card', {});
    return (card0.status === 200 && card1.status === 200 && card1.text === card0.text) ? true : false;
  }, test.limit.quick);
  test.after(async function () {
    try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    if (N) await stop(N.child);
    try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
  });
}
