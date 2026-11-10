'use strict';

// spirit/run/spirit/app/info/test/info.js
// The tests of spirit/app/info/info.js, and of no other module (spec: ./info.md; goal/G43.24, requirements 6 and 7). Since
// G43.24 the app is a wrapper mounted the new shell's way: all of Info is nodeInfo (spirit/element/nodeInfo.js, tested in
// spirit/element/test/nodeInfo.js). The browser file runs in node on a BARE window (rule/26): nodeInfo is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it. Its manifest, its tile and its opening in a
// real Chrome are judged in spirit/app/info/test/info-wrapper.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/info/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'info.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function node(tag) {
  let html = '';
  const n = { tag: tag || '', kids: [], textContent: '',
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); n.kids = []; },
    appendChild: function (c) { n.kids.push(c); return c; },
  };
  return n;
}

function world(o) {
  const opt = o || {};
  const w = { required: [], made: [], destroyed: 0 };
  const els = {};
  const nodeInfo = { create: function (host, x) { const m = { host: host, opts: x, args: arguments.length, destroy: function () { w.destroyed += 1; } }; w.made.push(m); return m; } };
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  win.spirit = { elements: els,
    require: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error('not-found ' + p));
      const put = function () { if (p === 'spirit/element/nodeInfo.js') els.nodeInfo = nodeInfo; return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.els = els;
  return w;
}

test.startTest('info.js: the Info app, a wrapper of nodeInfo');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/app/info/info.js is there', 'there is no spirit/app/info/info.js');
  if (!SRC) return;

  test.subHeading('mounted the new shell\'s way (goal/G43.24, requirement 7)');
  const w = world();
  const I = w.els.info;
  ok(!!I && typeof I.create === 'function', 'it sets spirit.elements.info = { create }', 'elements: ' + short(Object.keys(w.els)));
  if (!I) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b/.test(CODE), 'no spirit.shell.activateApp, the old shell\'s way', 'info.js still mounts through spirit.shell');

  test.subHeading('a wrapper: it loads nodeInfo, and nothing of its own (requirement 6)');
  ok(JSON.stringify(w.required) === '["spirit/element/nodeInfo.js"]', 'it requires spirit/element/nodeInfo.js, and only that', 'required: ' + short(w.required));
  ok(!/\.verb\s*\(|\bapi\b|\boutcome\b|\bcacheManager\b|\brelay\b|\bnode\.card\b|\bcallDialog\b|\bfetch\s*\(/.test(CODE), 'it asks nothing itself: no verb, no api, no cache, no relay, no card', 'info.js still asks something of its own');
  ok(!/['"][^'"\n]*<(div|span|button|input|b)\b/.test(CODE) && !/createElement/.test(CODE), 'it draws no markup of its own', 'info.js draws markup of its own');

  test.subHeading('create(container, { open }): nodeInfo mounted into the container, handed the mounter\'s stack');
  const box = node('<container>');
  box.innerHTML = '<p>left over</p>';
  const open = function () {};
  const m = I.create(box, { open: open });
  ok(!!m && typeof m.destroy === 'function', 'create answers { destroy() }', 'create answered ' + short(m && Object.keys(m)));
  ok(box.innerHTML === '', 'it empties its container', 'left: ' + short(box.innerHTML));
  await settle();
  ok(w.made.length === 1 && w.made[0].host === box, 'it makes nodeInfo in its container', 'made: ' + w.made.length);
  ok(w.made[0] && w.made[0].opts && w.made[0].opts.open === open && Object.keys(w.made[0].opts).join() === 'open', 'handed { open }, the stack its mounter opens layers in, and nothing else', 'handed: ' + short(w.made[0] && w.made[0].opts));
  const w2 = world();
  const box2 = node('<container>');
  w2.els.info.create(box2);
  await settle();
  ok(w2.made.length === 1 && w2.made[0].opts && w2.made[0].opts.open === undefined, 'made with no opts, nodeInfo gets no open, and keeps its own stack', 'handed: ' + short(w2.made[0] && w2.made[0].opts));

  test.subHeading('destroy');
  m.destroy();
  ok(w.destroyed === 1 && box.innerHTML === '', 'destroy destroys nodeInfo and empties its container', 'destroyed ' + w.destroyed + ', left ' + short(box.innerHTML));
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  const box3 = node('<container>');
  const m3 = late.els.info ? late.els.info.create(box3, {}) : null;
  ok(!!m3, 'the world: made while nodeInfo is still loading', 'no info.create on a loading page');
  if (m3) { m3.destroy(); letGo(); await settle(); }
  ok(late.made.length === 0 && box3.innerHTML === '', 'destroyed before nodeInfo loads, nothing is made', 'made ' + late.made.length);

  test.subHeading('nodeInfo refused');
  const no = world({ refuse: true });
  const box4 = node('<container>');
  no.els.info.create(box4, {});
  await settle();
  ok(box4.textContent === 'Info could not be loaded.' && no.made.length === 0, 'it says Info could not be loaded.', 'said: ' + short(box4.textContent));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
