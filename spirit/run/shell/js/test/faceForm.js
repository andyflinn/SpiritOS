'use strict';

// spirit/run/shell/js/test/faceForm.js
// The tests of shell/js/faceForm.js, and of no other module (spec: ./faceForm.md; goal/G41.27): its form, a rowForm.
// Asked of a real browser, the real rowForm composed: ./faceForm-laid.html, on a scratch node with its DEBUG on, mounts
// the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const H = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/shell/js/test/faceForm-laid.html';
test.startTest('faceForm.js: the face form, a rowForm');

(async function () {
  const code = fs.readFileSync(path.join(__dirname, '..', 'faceForm.js'), 'utf8').replace(/\/\/.*$/gm, '');
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  ok(/spirit\.require\(\s*['"]shell\/js\/rowForm\.js['"]/.test(code), 'it loads the rowForm itself (rule/26)', 'faceForm.js requires no shell/js/rowForm.js');
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
    // Andy, on G41.27: "faceForm:\n\n[❓] [Relay▾][Face-name-input][Ask-button]".
    [['its relays to pick', m.pane, ['wss://b.example', 'wss://c.example'], false], ['fixed to its one relay', m.fixed, ['wss://c.example'], true]].forEach(function (x) {
      const r = x[1] || {};
      test.subHeading(x[0]);
      ok(r.forms === 1 && r.icon === '❓' && r.button === 'Ask', 'one rowForm, its icon ❓ and its button Ask', 'forms ' + r.forms + ', icon ' + short(r.icon) + ', button ' + short(r.button));
      const sp = r.span || [];
      ok(sp.length === 2 && sp[0].tag === 'SELECT' && sp[1].tag === 'INPUT' && sp[1].type === 'text', 'its span holds the relay dropdown, then the face name input, and nothing else', 'span: ' + short(sp));
      ok(!!sp[0] && JSON.stringify(sp[0].options) === JSON.stringify(x[2]) && sp[0].disabled === x[3], x[3] ? 'the dropdown holds its one relay, fixed' : 'the dropdown offers the relays this node is seated on, to pick', 'dropdown: ' + short(sp[0]));
      ok(r.forms === 1 && !/\bRelay\b|Face name/.test(r.bubbleWords || ''), 'the words Relay and Face name are gone from the bubble', 'bubble says: ' + short(r.bubbleWords));
      ok(r.titleAbove, 'its title, A face name on one relay, stands above the bubble', 'title ' + short(r.title) + ', above ' + r.titleAbove);
      ok(r.holdsBelow, 'what this node holds on the relay stands below the bubble, not in it', 'holds ' + short(r.holds) + ', below ' + r.holdsBelow);
      ok(r.forms === 1 && r.others === 0, 'its Ask is the rowForm\'s button, the only one', 'other Asks: ' + r.others);
    });
    test.subHeading('no relay with a seat');
    // Andy: "doesn't show up if the user has zero verified emails anywhere" (a seat taken by email is a verified one, goal/G40.11).
    const n = m.none || {};
    ok(n.forms === 0 && n.text === '' && n.kids === 0, 'with no relay this node is seated on, it draws nothing', 'drew: ' + short(n));
    test.subHeading('a press, and the line below the bubble');
    // The box: "a line saying what a press did (a refusal, a result) is the mounter's, below the bubble, not in it."
    ok(/a face name is needed/.test(m.said || '') && m.saidBelow, 'pressed with no face name, it says so on a line below the bubble, not in it', 'said ' + short(m.said) + ', below ' + m.saidBelow);
  } finally {
    if (page && page.kid) page.kid.kill();
    if (node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    test.reportSuccessFailureCount();
  }
}());
