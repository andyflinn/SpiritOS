'use strict';

// spirit/run/spirit/app/icons/test/data.js
// The tests of spirit/app/icons/data.js, and of no other module (spec: ./data.md; goal/G43.19, box v16). The box: "it
// implements a database-table interface, also reflected in api.js and data.js", and 10: "data.js on every open page follows
// that one job", spirit.app.icons. The translator runs as it does: in a window of its own beside the real spirit.data
// (spirit/data.js), which it writes into; the runs' rows are handed in as the node's stream hands them, jobs of module
// spirit.app.icons.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// The sender's public key, base64 with a + and a / in it, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const D = win.spirit.data;
  let n = 0;
  const I = ((D || {}).icons || {}).data;
  return { D: D, I: I,
    // A run's publish as the stream hands it: a job of module spirit.app.icons whose app is the row.
    job: function (app, module) { D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.icons', data: {}, app: app }, SENDER); } };
}

test.startTest('data.js: what a page knows of the icon set, following the one job spirit.app.icons (goal/G43.19)');

(function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/icons/data.js is not there'); return; }
  const w = world();
  ok(!!w.I && typeof w.I.rows === 'function' && typeof w.I.row === 'function' && typeof w.I.watch === 'function', 'the world: spirit.data.icons.data answers rows, row and watch', 'spirit.data.icons.data: ' + short(w.I && Object.keys(w.I)));
  if (!w.I) return;

  test.subHeading('the box, 10: a run\'s publish, { icons: { row } }, is on the page');
  w.job({ icons: { row: { glyph: '🌀', keywords: ['cyclone', 'spin'] } } });
  const r1 = w.I.row('🌀');
  ok(!!r1 && r1.glyph === '🌀' && JSON.stringify(r1.keywords) === '["cyclone","spin"]', 'an added row is there, its glyph and keywords', 'row(🌀): ' + short(r1));
  ok(Object.keys(w.I.rows() || {}).indexOf('🌀') !== -1, 'and among rows()', 'rows(): ' + short(w.I.rows()));
  w.job({ icons: { row: { glyph: '🌀', keywords: ['storm'] } } });
  ok(JSON.stringify((w.I.row('🌀') || {}).keywords) === '["storm"]', 'a changed row replaces it', 'after a change: ' + short(w.I.row('🌀')));

  test.subHeading('a watch follows every change, and the row gone');
  const heard = [];
  const off = w.I.watch(function (g, v) { heard.push([g, v ? v.keywords : undefined]); });
  w.job({ icons: { row: { glyph: '🌁', keywords: ['fog'] } } });
  ok(heard.some(function (h) { return h[0] === '🌁' && JSON.stringify(h[1]) === '["fog"]'; }), 'it hears a new row by its glyph', 'heard: ' + short(heard));
  w.job({ icons: { glyph: '🌁', removed: true } });
  ok(w.I.row('🌁') === null, '{ icons: { glyph, removed: true } } takes the row away', 'after removed: ' + short(w.I.row('🌁')));
  ok(heard.some(function (h) { return h[0] === '🌁' && h[1] === undefined; }), 'and the watch hears it gone', 'heard: ' + short(heard));
  ok(typeof off === 'function', 'a watch answers its release', 'watch answered ' + short(typeof off));
  if (typeof off === 'function') off();
  const before = heard.length;
  w.job({ icons: { row: { glyph: '🌆', keywords: ['dusk'] } } });
  ok(heard.length === before, 'released, it hears nothing more', 'released, it still heard ' + short(heard.slice(before)));

  test.subHeading('the attacker: what is not the icons job\'s publish changes nothing');
  const snap = function () { return JSON.stringify(w.I.rows() || {}); };
  const was = snap();
  w.job({ icons: { row: { glyph: '🌌', keywords: ['galaxy'] } } }, 'spirit.app.desk');
  ok(w.I.row('🌌') === null && snap() === was, 'a row on another app\'s job, spirit.app.desk, is not taken', 'another job\'s row was taken: ' + short(w.I.row('🌌')));
  const crooked = function (app) {
    let threw = '';
    try { w.job(app); } catch (e) { threw = String(e && e.message || e); }
    return { fine: !threw && snap() === was, why: 'the publish ' + short(app) + (threw ? ' threw ' + threw : ' changed the rows to ' + snap()) };
  };
  let c;
  c = crooked(null); ok(c.fine, 'a crooked publish of null changes nothing', c.why);
  c = crooked('text'); ok(c.fine, 'a crooked publish of a string changes nothing', c.why);
  c = crooked(5); ok(c.fine, 'a crooked publish of a number changes nothing', c.why);
  c = crooked([]); ok(c.fine, 'a crooked publish of a list changes nothing', c.why);
  c = crooked({ icons: null }); ok(c.fine, 'a crooked publish of icons that are null changes nothing', c.why);
  c = crooked({ icons: 'x' }); ok(c.fine, 'a crooked publish of icons that are a string changes nothing', c.why);
  c = crooked({ icons: { row: null } }); ok(c.fine, 'a crooked publish of a row that is null changes nothing', c.why);
  c = crooked({ icons: { row: { keywords: ['no glyph'] } } }); ok(c.fine, 'a crooked publish of a row with no glyph changes nothing', c.why);
  c = crooked({ icons: { removed: true } }); ok(c.fine, 'a crooked publish of a removal with no glyph changes nothing', c.why);
  c = crooked({ other: { row: { glyph: '🌑' } } }); ok(c.fine, 'a crooked publish of a row under another name than icons changes nothing', c.why);
  w.job({ icons: { row: { glyph: '🌒', keywords: 'not a list' } } });
  const r2 = w.I.row('🌒');
  ok(!r2 || Array.isArray(r2.keywords), 'keywords that are no list are never kept as one', 'row(🌒): ' + short(r2));
  w.job({ icons: { glyph: '🌓', removed: true } });
  ok(snap() === was || !!r2, 'removing an icon that is not there changes nothing', 'removing a stranger changed the rows: ' + snap());
}());

test.reportSuccessFailureCount();
