'use strict';

// spirit/run/shell/js/test/appInstaller.js
// The tests of shell/js/appInstaller.js, and of no other module (spec: ./appInstaller.md; goal/G41.1, box v14). The
// browser file runs in node on a window of its own: the spirit object's fs, the stream and the face shell are stubs that
// keep what the element asked of them, and the test plays the node's answers and the stream.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'appInstaller.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// A host: its markup's one button, if any, as a node that hears clicks.
function host() {
  let html = '';
  const h = { button: null,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v);
      const m = /<button\b([^>]*)>([\s\S]*?)<\/button>/i.exec(html);
      if (!m) { h.button = null; return; }
      const heard = [];
      h.button = { attrs: m[1], text: m[2].replace(/<[^>]+>/g, '').trim(), addEventListener: function (t, fn) { if (t === 'click') heard.push(fn); },
        click: function () { const e = { stopped: false, stopPropagation: function () { e.stopped = true; }, preventDefault: function () {} }; heard.forEach(function (fn) { fn(e); }); return e; } };
    },
    querySelector: function (sel) { return /^button/.test(sel) ? h.button : null; },
    get text() { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); },
  };
  return h;
}
const onOf = function (h) { return !!h.button && /data-on="true"/.test(h.button.attrs); };

// A world: the node's annotations by path, what was written, the stream's subscribers, the face shell's word.
function world(faces) {
  const w = { faces: faces, writes: [], subs: [], faceApp: [], unsubscribed: 0 };
  const fsApi = {
    getAnnotations: function (p) { return Promise.resolve(JSON.parse(JSON.stringify(w.faces[p] || {}))); },
    annotate: function (a) { w.writes.push(JSON.parse(JSON.stringify(a))); w.faces[a.path] = Object.assign({}, w.faces[a.path] || {}, { face: a.payload }); return Promise.resolve({ ok: true }); },
  };
  const win = { spirit: {
    ready: Promise.resolve({ fs: fsApi }), fs: fsApi,
    events: { subscribe: function (h) { w.subs.push(h); return function () { w.unsubscribed += 1; w.subs = w.subs.filter(function (x) { return x !== h; }); }; } },
    shell: { faceApp: function (id) { w.faceApp.push(id); } },
    escapeHtml: function (s) { return String(s); },
  }, setTimeout: setTimeout, Promise: Promise, JSON: JSON, console: { log: function () {}, error: function () {} } };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.elements || {};
  w.job = function (module, status) { const j = { id: 'job-' + module, kind: 'server', module: module, status: status }; w.subs.slice().forEach(function (h) { if (h.onUpdate) h.onUpdate(j); }); };
  w.snapshot = function (jobs) { w.subs.slice().forEach(function (h) { if (h.onSnapshot) h.onSnapshot(jobs); }); };
  return w;
}

test.startTest('appInstaller.js: one activate/deactivate button for one app');

(async function () {
  test.subHeading('it is a standard shell element');
  if (!fs.existsSync(FILE)) { test.fail('shell/js/appInstaller.js is not there'); return; }
  const w0 = world({});
  ok(w0.E.appInstaller && typeof w0.E.appInstaller.create === 'function', 'it registers spirit.elements.appInstaller.create', 'elements: ' + short(Object.keys(w0.E)));
  if (!w0.E.appInstaller) return;

  test.subHeading('an appServer: on while it runs, by the stream');
  const SRV = 'process/js/agent/agent.js';
  const w = world({ [SRV]: { face: { home: false, name: 'Agent', description: 'keep me' } } });
  const h = host();
  const inst = w.E.appInstaller.create(h, { path: SRV });
  await settle();
  ok(h.button && h.button.text === 'Activate' && !onOf(h), 'with no server job it says Activate, off', 'button: ' + short(h.button && { text: h.button.text, attrs: h.button.attrs }));
  w.snapshot([{ id: 'x', kind: 'server', module: 'process/js/other', status: 'running' }, { id: 'y', kind: 'server', module: 'process/js/agent', status: 'failed' }]);
  await settle();
  ok(!onOf(h), 'another module\'s running job, or its own failed job, is not running', 'on after another module or a failed job');
  const e1 = h.button.click(); await settle();
  const wr1 = w.writes[w.writes.length - 1];
  ok(wr1 && wr1.path === SRV && wr1.payload.home === true && wr1.payload.name === 'Agent' && wr1.payload.description === 'keep me',
    'a press writes the whole face part with home turned on, every other field kept', 'wrote ' + short(wr1));
  ok(e1.stopped, 'the click stays its own: it does not reach the row around it', 'the click propagated');
  ok(!onOf(h) && h.button.text === 'Activate', 'until the stream says so, it stays off: it draws the stream, not the click', 'after the press: ' + short(h.button.text));
  w.job('process/js/agent', 'running'); await settle();
  ok(onOf(h) && h.button.text === 'Deactivate', 'its job running on the stream: Deactivate, on', 'after running: ' + short(h.button.text));
  w.job('process/js/agent', 'pending'); await settle();
  ok(onOf(h), 'pending (between restarts) counts as running', 'off while pending');
  h.button.click(); await settle();
  const wr2 = w.writes[w.writes.length - 1];
  ok(wr2 && wr2.payload.home === false && wr2.payload.name === 'Agent', 'pressed again it writes home turned off', 'wrote ' + short(wr2));
  w.job('process/js/agent', 'cancelled'); await settle();
  ok(!onOf(h) && h.button.text === 'Activate', 'its job cancelled: Activate, off', 'after cancelled: ' + short(h.button.text));
  inst.destroy();
  ok(w.unsubscribed === 1, 'destroy ends its stream subscription', 'unsubscribed ' + w.unsubscribed);
  w.job('process/js/agent', 'running'); await settle();
  ok(!onOf(h), 'and nothing is drawn after it', 'drew after destroy');

  test.subHeading('a shell app: on while its face mark says so, by the node\'s answer');
  const APP = 'shell/icons/icons.js';
  const ws = world({ [APP]: { face: { app: false, name: 'Icons', icon: '🔣' } } });
  const hs = host();
  ws.E.appInstaller.create(hs, { path: APP });
  await settle();
  ok(hs.button && hs.button.text === 'Activate' && !onOf(hs), 'its face mark off: Activate', 'button: ' + short(hs.button && hs.button.text));
  hs.button.click(); await settle();
  const ws1 = ws.writes[ws.writes.length - 1];
  ok(ws1 && ws1.path === APP && ws1.payload.app === true && ws1.payload.name === 'Icons' && ws1.payload.icon === '🔣', 'a press writes the whole face part with app turned on, every other field kept', 'wrote ' + short(ws1));
  ok(ws.faceApp.indexOf('shell/icons') !== -1, 'and tells the face shell, which shows or hides it at once', 'faceApp: ' + short(ws.faceApp));
  ok(onOf(hs) && hs.button.text === 'Deactivate', 'it draws what the node answers once the write is in: on', 'after: ' + short(hs.button.text));
  ws.faces[APP] = { face: { app: true, name: 'Icons', icon: '🔣' } };
  hs.button.click(); await settle();
  ok(ws.writes[ws.writes.length - 1].payload.app === false && !onOf(hs), 'pressed again: off', 'after the second press: ' + short(ws.writes[ws.writes.length - 1]));
  const wn = world({ [APP]: { face: { app: false } } });
  wn.faces[APP] = { face: { app: false } };
  const hn = host();
  wn.E.appInstaller.create(hn, { path: APP }); await settle();
  wn.E.appInstaller.create(host(), { path: APP });
  const annotate = wn.writes.length;
  ok(annotate === 0, 'drawing writes nothing', 'writes on draw: ' + annotate);

  test.subHeading('every button listens: a face part streamed redraws it (box v15)');
  const wl = world({ [APP]: { face: { app: false, name: 'Icons' } } });
  const hl = host();
  wl.E.appInstaller.create(hl, { path: APP }); await settle();
  const faceJob = function (p, face) { const j = { id: 'job-app-face', type: 'app-face', data: { path: p, face: face } }; wl.subs.slice().forEach(function (h) { if (h.onUpdate) h.onUpdate(j); }); };
  ok(wl.subs.length > 0, 'a shell app\'s button listens to the stream too', 'it subscribed to nothing');
  faceJob('shell/files/files.js', { app: true }); await settle();
  ok(!onOf(hl), 'another app\'s face part leaves it as it was', 'turned on by another app\'s face');
  faceJob(APP, { app: true, name: 'Icons' }); await settle();
  ok(onOf(hl) && hl.button.text === 'Deactivate' && wl.writes.length === 0, 'its own face part streamed with app on turns it on, with no press', 'after its face streamed on: ' + short(hl.button && hl.button.text));
  faceJob(APP, { app: false, name: 'Icons' }); await settle();
  ok(!onOf(hl), 'and streamed off, off', 'after its face streamed off: on');
  faceJob(APP, { app: true, intrinsic: true }); await settle();
  ok(!hl.button && /always on/i.test(hl.text), 'made intrinsic on the stream, it loses its button', 'after intrinsic: ' + short(hl.innerHTML));

  test.subHeading('exempt: an intrinsic app and the Apps app get no button');
  const we = world({ 'shell/files/files.js': { face: { app: true, intrinsic: true } }, 'shell/apps/apps.js': { face: { app: true } } });
  const hi = host(); we.E.appInstaller.create(hi, { path: 'shell/files/files.js' }); await settle();
  ok(!hi.button && /always on/i.test(hi.text), 'an intrinsic app: no button, a note that it is always on', 'intrinsic drew: ' + short(hi.innerHTML));
  const ha = host(); we.E.appInstaller.create(ha, { path: 'shell/apps/apps.js' }); await settle();
  ok(!ha.button && /always on/i.test(ha.text), 'the Apps app: no button, always on', 'apps drew: ' + short(ha.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
