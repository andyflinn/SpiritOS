'use strict';

// spirit/run/spirit/element/test/joinForm.js
// The tests of spirit/element/joinForm.js, and of no other module (spec: ./joinForm.md; goal/G41.27): its form, a rowForm,
// in its modes. Asked of a real browser, the real rowForm composed: ./joinForm-laid.html, on a scratch node with its
// DEBUG on, mounts the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/spirit/element/test/joinForm-laid.html';
test.startTest('joinForm.js: the join form, a rowForm, in its modes');

(async function () {
  const chrome = H.findChrome();
  if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); test.reportSuccessFailureCount(); return; }
  const node = await H.scratchNode();
  let page = null;
  try {
    if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
    page = await H.chromePage(chrome);
    if (page.error) { test.fail(page.error); return; }
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    const s = await page.evaluate('window.laid()').catch(function () { return ''; });
    let m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    if (!m || !m.made) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
    // Andy, on G41.27: "joinForm? it has several modes:\n\nsuggestions?", then "wsl, agreed." to wsl's: Join (no seat)
    // [➕] [relay ▾] [email] [Join]; Change (seated) [✏️] [relay ▾] [email] [Change]; fixed (relay details) the same,
    // the dropdown fixed to its one relay; the icon following the mode, as the words do; the words Relay and Your email
    // gone; the title above the bubble, the sent line below.
    // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
    const code = fs.readFileSync(path.join(__dirname, '..', 'joinForm.js'), 'utf8').replace(/\/\/.*$/gm, '');
    ok(/spirit\.require\(\s*['"]spirit\/element\/rowForm\.js['"]/.test(code), 'it loads the rowForm itself (rule/26)', 'joinForm.js requires no spirit/element/rowForm.js');
    const MODES = [['Join, no seat', m.join, '➕', 'Join', 'Join a relay'], ['Change, a seat (another relay picked)', m.change, '✏️', 'Change', 'Change email address'], ['fixed to its one relay', m.fixed, '✏️', 'Change', 'Change email address']];
    MODES.forEach(function (x, i) {
      const r = x[1] || {};
      test.subHeading(x[0]);
      const one = r.forms === 1 && r.icon === x[2] && r.button === x[3];
      if (i === 0) ok(one, 'with no seat: one rowForm, its icon ➕ and its button Join', 'forms ' + r.forms + ', icon ' + short(r.icon) + ', button ' + short(r.button));
      else if (i === 1) ok(one, 'with a seat: one rowForm, its icon ✏️ and its button Change', 'forms ' + r.forms + ', icon ' + short(r.icon) + ', button ' + short(r.button));
      else ok(one, 'fixed to its one relay: one rowForm, its icon ✏️ and its button Change', 'forms ' + r.forms + ', icon ' + short(r.icon) + ', button ' + short(r.button));
      const sp = r.span || [];
      ok(sp.length === 2 && sp[0].tag === 'SELECT' && sp[1].tag === 'INPUT' && sp[1].type === 'email', 'its span holds the relay dropdown, then the email input, and nothing else', 'span: ' + short(sp));
      ok(r.forms === 1 && !/\bRelay\b|Your email|Email address/.test(r.bubbleWords || ''), 'the words Relay and Your email are gone from the bubble', 'bubble says: ' + short(r.bubbleWords));
      const above = r.title === x[4] && r.titleAbove;
      if (i === 0) ok(above, 'with no seat: its title, Join a relay, stands above the bubble', 'title ' + short(r.title) + ', above ' + r.titleAbove);
      else if (i === 1) ok(above, 'with a seat: its title, Change email address, stands above the bubble', 'title ' + short(r.title) + ', above ' + r.titleAbove);
      else ok(above, 'fixed to its one relay: its title, Change email address, stands above the bubble', 'title ' + short(r.title) + ', above ' + r.titleAbove);
      if (i === 0) ok(r.adds === 0, 'with no seat: its Join is the rowForm\'s button, the only one', 'other buttons: ' + r.adds);
      else if (i === 1) ok(r.adds === 0, 'with a seat: its Change is the rowForm\'s button, the only one', 'other buttons: ' + r.adds);
      else ok(r.adds === 0, 'fixed to its one relay: its Change is the rowForm\'s button, the only one', 'other buttons: ' + r.adds);
    });
    const f = (m.fixed && m.fixed.span) || [];
    ok(f[0] && f[0].disabled && JSON.stringify(f[0].options) === '["wss://b.example"]', 'fixed: the dropdown holds its one relay and is fixed', 'dropdown: ' + short(f[0]));
    test.subHeading('a press, and the line below the bubble');
    ok(!!m.said && m.saidBelow, 'pressed with no email, it says why on a line below the bubble, not in it', 'said ' + short(m.said) + ', below ' + m.saidBelow);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
