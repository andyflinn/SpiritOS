'use strict';

// spirit/run/shell/shared/js/test/deskElement.js
// The tests of shell/shared/js/deskElement.js, and of no other module (spec: ./deskElement.md; goal/G41.11). The browser
// file runs in node on a window of its own; the stream is a recorder that hands the element's handler what the test
// publishes and counts its unsubscribes.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function world(spirit) {
  const win = { console: { log: function () {}, error: function () {} }, JSON: JSON, Object: Object };
  win.window = win;
  if (spirit) win.spirit = spirit;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  return win;
}
// A stream: subscribe keeps the handler, answers an unsubscribe that is counted.
function stream() {
  const s = { handlers: [], offs: 0, subscribes: 0 };
  s.subscribe = function (fn) { s.subscribes++; s.handlers.push(fn); return function () { s.offs++; s.handlers = s.handlers.filter(function (h) { return h !== fn; }); }; };
  s.publish = function (obj, from) { s.handlers.slice().forEach(function (h) { h(obj, from); }); };
  return s;
}

test.startTest('deskElement.js: the element that carries its own stream');

test.subHeading('it adds createDeskElement to window.spirit.elements');
const w0 = world();
ok(w0.spirit && w0.spirit.elements && typeof w0.spirit.elements.createDeskElement === 'function', 'on a bare window it makes spirit.elements and adds createDeskElement',
  'spirit: ' + short(w0.spirit && Object.keys(w0.spirit.elements || {})));
const kept = { other: 1 };
const w1 = world({ elements: kept, mark: 'mine' });
ok(w1.spirit.mark === 'mine' && w1.spirit.elements === kept && kept.other === 1 && typeof kept.createDeskElement === 'function',
  'on a page with spirit.elements it adds itself beside what is there', 'elements: ' + short(Object.keys(w1.spirit.elements)));
const make = w0.spirit.elements.createDeskElement;

test.subHeading('subscribed once, when made; it paints what it wants, and only that');
const s = stream(); const painted = []; const asked = [];
const e = make({ subscribe: s.subscribe, wants: function (obj, from) { asked.push([obj, from]); return obj.mine === true; }, paint: function (obj, from) { painted.push([obj, from]); } });
ok(s.subscribes === 1 && s.handlers.length === 1, 'subscribe is called once, at make', 'subscribes: ' + s.subscribes);
ok(e && typeof e.destroy === 'function' && Object.keys(e).length === 1, 'it answers { destroy } and keeps no state of its own on it', 'answered: ' + short(e && Object.keys(e)));
s.publish({ mine: false }, 'desk');
ok(asked.length === 1 && asked[0][1] === 'desk' && painted.length === 0, 'an object it does not want is asked about (with its sender) and not painted', 'asked ' + asked.length + ', painted ' + painted.length);
s.publish({ mine: true, n: 1 }, 'desk');
ok(painted.length === 1 && painted[0][0].n === 1 && painted[0][1] === 'desk', 'an object it wants is painted, with its sender', 'painted: ' + short(painted));

test.subHeading('a wants that throws paints nothing; no wants paints everything');
const s2 = stream(); const p2 = [];
make({ subscribe: s2.subscribe, wants: function () { throw new Error('boom'); }, paint: function (o) { p2.push(o); } });
let threw = null;
try { s2.publish({ a: 1 }); } catch (err) { threw = err; }
ok(!threw && p2.length === 0, 'a throwing wants is taken as not wanted: nothing painted, nothing thrown', 'threw ' + short(threw && threw.message) + ', painted ' + p2.length);
const s3 = stream(); const p3 = [];
make({ subscribe: s3.subscribe, paint: function (o) { p3.push(o); } });
s3.publish({ a: 1 }); s3.publish({ a: 2 });
ok(p3.length === 2, 'without wants every object is painted', 'painted ' + p3.length);
const s4 = stream();
make({ subscribe: s4.subscribe, wants: function () { return true; } });
let threw4 = null; try { s4.publish({ a: 1 }); } catch (err) { threw4 = err; }
ok(!threw4, 'without paint a wanted object is heard harmlessly', 'threw ' + short(threw4 && threw4.message));

test.subHeading('destroy unsubscribes once; nothing is painted after');
e.destroy();
ok(s.offs === 1, 'destroy calls the unsubscribe subscribe answered', 'offs: ' + s.offs);
e.destroy();
ok(s.offs === 1, 'a second destroy is harmless: the unsubscribe is not called again', 'offs: ' + s.offs);
// A stream that keeps calling an old handler after its unsubscribe: the element itself is dead.
const s5 = { h: null, offs: 0 }; const p5 = [];
const e5 = make({ subscribe: function (fn) { s5.h = fn; return function () { s5.offs++; }; }, paint: function (o) { p5.push(o); } });
s5.h({ a: 1 });
e5.destroy();
s5.h({ a: 2 });
ok(p5.length === 1 && s5.offs === 1, 'a handler called after destroy paints nothing', 'painted ' + p5.length + ', offs ' + s5.offs);

test.subHeading('without a subscribe it is made and destroyed harmlessly');
let e6 = null; let threw6 = null;
try { e6 = make({ paint: function () {} }); e6.destroy(); e6.destroy(); make(); make(null).destroy(); } catch (err) { threw6 = err; }
ok(!threw6 && e6 && typeof e6.destroy === 'function', 'no subscribe, no options, null options: made, destroyed, nothing thrown', 'threw ' + short(threw6 && threw6.message));
const e7 = make({ subscribe: function () { return 'not a function'; } });
let threw7 = null; try { e7.destroy(); } catch (err) { threw7 = err; }
ok(!threw7, 'a subscribe that answers no unsubscribe: destroy still harmless', 'threw ' + short(threw7 && threw7.message));

test.reportSuccessFailureCount();
