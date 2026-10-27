'use strict';

// spirit/run/shell/login/test/login.js
// The tests of shell/login/login.js, and of no other module (spec: ./login.md; goal/G41.9). The browser file runs in
// node on a window of its own: the shell's login api, the armingButton element and the page's fetch of login.json are
// stubs that keep what the app asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'login.js');
const SRC = fs.readFileSync(FILE, 'utf8');
const STEPS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'login.json'), 'utf8')).steps;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// A node whose markup makes a child per tag; an element with an id is found by getElementById, one with a class by
// querySelector('.class').
function world() {
  const byId = {};
  function node(open) {
    const heard = {}; const attrs = {}; let html = '';
    const n = { open: open || '', tagName: (/^<([a-z]+)/i.exec(open || '') || [, 'div'])[1].toUpperCase(), kids: [], textContent: '', value: '',
      classList: { add: function (c) { n.classes.push(c); }, remove: function (c) { n.classes = n.classes.filter(function (x) { return x !== c; }); } },
      classes: [],
      get innerHTML() { return html; },
      set innerHTML(v) { html = String(v); n.kids = []; parse(n, html); },
      insertAdjacentHTML: function (where, v) { html += String(v); parse(n, String(v)); },
      setAttribute: function (k, v) { attrs[k] = String(v); }, getAttribute: function (k) { return k in attrs ? attrs[k] : null; },
      removeAttribute: function (k) { delete attrs[k]; }, hasAttribute: function (k) { return k in attrs; },
      addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
      fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e || { type: t, target: n }); }); },
      contains: function () { return false; },
      querySelector: function (sel) {
        const c = /^\.([\w-]+)$/.exec(sel);
        const all = []; (function walk(x) { x.kids.forEach(function (k) { all.push(k); walk(k); }); }(n));
        return c ? all.filter(function (k) { return new RegExp('class="[^"]*\\b' + c[1] + '\\b').test(k.open); })[0] || null : null;
      },
    };
    return n;
  }
  function parse(parent, html) {
    const re = /<([a-z]+)\b([^>]*)>/gi; let m;
    while ((m = re.exec(html))) {
      const k = node(m[0]);
      const id = /\sid="([^"]*)"/.exec(m[2]);
      if (id) { byId[id[1]] = k; k.id = id[1]; }
      const text = new RegExp('^[^<]*').exec(html.slice(re.lastIndex));
      k.textContent = text ? text[0] : '';
      parent.kids.push(k);
    }
  }
  const w = { required: [], posts: [], reloads: 0, refreshes: 0, made: [], def: null, byId: byId, node: node };
  const shellApi = {
    post: function (verb, body) { w.posts.push({ verb: verb, body: body }); return Promise.resolve(verb === 'login' ? { loggedIn: true } : { ok: true }); },
    refresh: function () { w.refreshes += 1; },
    armUntilElsewhere: function (fn) { w.handedByApp = fn; },
  };
  const E = {
    armingButton: {
      attach: function (button, opts) { w.made.push({ how: 'attach', button: button, opts: opts || {} }); return button; },
      create: function (opts) { const b = node('<button type="button">'); b.textContent = (opts && opts.label) || ''; w.made.push({ how: 'create', button: b, opts: opts || {} }); return b; },
    },
  };
  const win = {
    document: { getElementById: function (id) { return byId[id] || null; }, createElement: function (t) { return node('<' + t + '>'); }, activeElement: { tagName: 'BODY' } },
    fetch: function () { return Promise.resolve({ json: function () { return Promise.resolve({ steps: STEPS }); } }); },
    location: { reload: function () { w.reloads += 1; } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  win.spirit = {
    elements: E,
    require: function (p) { w.required.push(String(p).replace(/^\/+/, '')); return Promise.resolve({}); },
    shell: { activateLogin: function (d) { w.def = d; }, activateApp: function () {} },
  };
  vm.createContext(win);
  vm.runInContext(SRC, win, { filename: FILE });
  w.shellApi = shellApi;
  return w;
}
// What the element was handed for Log out: its label as given or as the button says it.
function logoutOf(w) {
  return w.made.filter(function (m) { return (m.opts.label || m.button.textContent) === 'Log out'; })[0] || null;
}
function facts(home) { return { done: [true, true], open: '', facts: { face: 'andy', home: home, up: true, sealed: true } }; }

test.startTest('login.js: the face\'s Login app');

(async function () {
  test.subHeading('nothing of the hand-rolled confirm is left (goal/G41.9)');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/data-armed/.test(code), 'it sets no data-armed of its own', 'login.js still sets data-armed');
  ok(!/armUntilElsewhere/.test(code), 'it calls no armUntilElsewhere itself: the element does', 'login.js still calls armUntilElsewhere');
  ok(!/classList\.(add|remove)\(\s*['"]armed['"]/.test(code), 'it adds no armed class of its own', 'login.js still adds the armed class');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function' && typeof w.def.onSteps === 'function', 'it mounts through spirit.shell.activateLogin, with mount and onSteps', 'activateLogin got ' + short(w.def && Object.keys(w.def)));
  if (!w.def) return;

  test.subHeading('it loads armingButton itself (goal/G41.3)');
  ok(w.required.indexOf('shell/js/armingButton.js') !== -1, 'it requires shell/js/armingButton.js through spirit.require', 'required: ' + short(w.required));

  test.subHeading('Log out is an armingButton, on a face');
  const pane = w.node('<div>');
  w.def.mount(pane, w.shellApi); await settle();
  w.def.onSteps(facts(false)); await settle();
  ok(!!w.byId['face-logout'] || w.made.some(function (m) { return m.how === 'create'; }), 'on a face, logged in, Log out is drawn', 'no Log out drawn: ' + short(pane.innerHTML));
  const lo = logoutOf(w);
  ok(!!lo, 'it is made an armingButton (attach or create), saying Log out', 'armingButtons made: ' + short(w.made.map(function (m) { return m.opts.label || m.button.textContent; })));
  if (lo) {
    ok(lo.opts.api === w.shellApi, 'handed the shell\'s api, so a click elsewhere disarms it', 'api handed: ' + short(lo.opts.api && Object.keys(lo.opts.api)));
    ok(lo.opts.armedLabel === 'Log out? Press again', 'armed, it says Log out? Press again', 'armedLabel: ' + short(lo.opts.armedLabel));
    ok(w.posts.length === 0, 'making it asks nothing', 'posts: ' + short(w.posts));
    if (typeof lo.opts.run === 'function') { lo.opts.run(); await settle(); }
    ok(w.posts.length === 1 && w.posts[0].verb === 'logout', 'its run asks api.post(logout)', 'posts: ' + short(w.posts));
    ok(w.reloads === 1, 'and then reloads the page', 'reloads: ' + w.reloads);
  }
  if (w.byId['face-logout']) {
    const before = w.posts.length;
    w.byId['face-logout'].fire('click');
    await settle();
    ok(w.posts.length === before, 'a raw press on the drawn button logs nothing out by the app\'s own hand', 'posts after a raw press: ' + short(w.posts.slice(before)));
  }

  test.subHeading('no Log out on the home node');
  const h = world();
  h.def.mount(h.node('<div>'), h.shellApi); await settle();
  h.def.onSteps(facts(true)); await settle();
  ok(!h.byId['face-logout'] && !logoutOf(h), 'on the home node no Log out is drawn, and none is made', 'drawn ' + !!h.byId['face-logout'] + ', made ' + short(h.made.length));

  test.subHeading('the login step');
  const l = world();
  l.def.mount(l.node('<div>'), l.shellApi); await settle();
  l.def.onSteps({ done: [false, false], open: 'login', facts: { face: '', home: false, up: false, sealed: false } }); await settle();
  const field = l.byId['face-login-field'];
  const go = l.byId['face-login-go'];
  ok(!!field && !!go, 'the open login step draws its field and Log in', 'drawn: ' + short(Object.keys(l.byId)));
  if (field && go) {
    field.value = ' andy@example.org ';
    go.fire('click'); await settle();
    ok(l.posts[0] && l.posts[0].verb === 'login' && l.posts[0].body.text === 'andy@example.org', 'Log in asks api.post(login, { text }), trimmed', 'posts: ' + short(l.posts));
    ok(l.refreshes >= 2, 'logged in, it asks the shell to refresh', 'refreshes: ' + l.refreshes);
  }
}()).then(function () { test.reportSuccessFailureCount(); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
