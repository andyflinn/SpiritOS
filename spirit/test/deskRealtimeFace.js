'use strict';

// spirit/test/deskRealtimeFace.js
// goal/G27.9, slices S2 to S4: the faces repaint from the stream, element by element. The item's box:
//   B. "one client repaint path ... Each element subscribes to the keys it shows and repaints only its own part. The
//      face-wide deskDraw stays for layout only."
//   C. "No tab gate: changes are applied to the store whether or not the tab shows; the tab repaints on show."
//   D. "a new folder spirit/run/shell/shared/js ... one file per element, each named with the desk prefix ... each
//      adding itself to window.spirit.elements as the shell elements do. The element is made with the keys it shows and
//      a paint function and subscribes to the stream itself (desk rule 8); Desk rows, the remote switch, warnings and
//      pairs are all made from it."
//   S4: "every remote element listens for itself and redraws only itself."
//
// THE SHAPES ASSERTED (the box left them open):
//   - spirit/run/shell/shared/js/deskElement.js sets window.spirit.elements.createDeskElement({subscribe, wants, paint}):
//     subscribe(handler) is the stream (an app's onPublished) and answers its unsubscribe; the element subscribes
//     itself when made; a published object it wants is painted, any other is not; destroy() unsubscribes.
//   - a Desk row is its own element: <tr id="desk-row-<id>">, repainted alone when a publish changes that row.
// WHAT IS ASSERTED
//   1. the shared element: subscribes itself, paints only what it wants, unsubscribes on destroy.
// NOT ASSERTED: layout, words, the verifier tab and the musings (S3's rest), the reconnect pull (E, unchanged).
// rule/11: through testSupport only; no node, no port.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G27.9: ';
const RUN = path.join(__dirname, '..', 'run');
const ELEMENT = path.join(RUN, 'shell', 'shared', 'js', 'deskElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The shared element, loaded into a page's window as the shell would load it. Missing, the window has none.
function loadElement(win) {
  if (!fs.existsSync(ELEMENT)) return false;
  new Function('window', fs.readFileSync(ELEMENT, 'utf8'))(win);
  return !!(win.spirit.elements && typeof win.spirit.elements.createDeskElement === 'function');
}

test.startTest('goal/G27.9 S2 to S4: the faces repaint element by element');

async function elementHalf() {
  test.subHeading('1. the shared element');
  const win = {};
  if (!loadElement(win)) { test.fail(OWED + 'spirit/run/shell/shared/js/deskElement.js does not set window.spirit.elements.createDeskElement'); return; }
  let handler = null;
  let subscribed = 0;
  let unsubscribed = 0;
  const painted = [];
  const el = win.spirit.elements.createDeskElement({
    subscribe: function (fn) { handler = fn; subscribed++; return function () { unsubscribed++; handler = null; }; },
    wants: function (obj) { return !!(obj && obj.mine); },
    paint: function (obj) { painted.push(obj); },
  });
  if (subscribed === 1 && typeof handler === 'function') test.check('made, it subscribes itself once');
  else test.fail(OWED + 'made, it subscribed ' + subscribed + ' times');
  if (handler) { handler({ other: 1 }); handler({ mine: 1 }); }
  if (painted.length === 1 && painted[0].mine === 1) test.check('it paints what it wants and nothing else');
  else test.fail(OWED + 'it painted ' + short(painted));
  const before = handler;
  if (el && typeof el.destroy === 'function') el.destroy();
  if (unsubscribed === 1) test.check('destroy unsubscribes it');
  else test.fail(OWED + 'destroy unsubscribed ' + unsubscribed + ' times');
  if (before) before({ mine: 2 });
  if (painted.length === 1) test.check('after destroy it paints nothing');
  else test.fail(OWED + 'after destroy it painted ' + short(painted.slice(1)));
}

(async function () { await elementHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
