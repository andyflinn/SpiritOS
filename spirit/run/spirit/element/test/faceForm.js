'use strict';

// spirit/run/spirit/element/test/faceForm.js
// The tests of spirit/element/faceForm.js, and of no other module (spec: ./faceForm.md; goal/G41.27): its form, a rowForm.
// Asked of a real browser, the real rowForm composed: ./faceForm-laid.html, on a scratch node with its DEBUG on, mounts
// the form in boxes, the rowForm's create kept as it is called.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const ADDRESS = '/DEBUG/spirit/element/test/faceForm-laid.html';
test.startTest('faceForm.js: the face form, a rowForm');

(async function () {
  const code = fs.readFileSync(path.join(__dirname, '..', 'faceForm.js'), 'utf8').replace(/\/\/.*$/gm, '');
  // The page loads the rowForm first, to keep what it makes; the form must still ask for it itself (rule/26).
  ok(/spirit\.require\(\s*['"]spirit\/element\/rowForm\.js['"]/.test(code), 'it loads the rowForm itself (rule/26)', 'faceForm.js requires no spirit/element/rowForm.js');
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
      const dropdown = !!sp[0] && JSON.stringify(sp[0].options) === JSON.stringify(x[2]) && sp[0].disabled === x[3];
      if (x[3]) ok(dropdown, 'the dropdown holds its one relay, fixed', 'dropdown: ' + short(sp[0]));
      else ok(dropdown, 'the dropdown offers the relays this node is seated on and starred, to pick, and not Delta, seated with no star', 'dropdown: ' + short(sp[0]));
      ok(r.forms === 1 && !/\bRelay\b|Face name/.test(r.bubbleWords || ''), 'the words Relay and Face name are gone from the bubble', 'bubble says: ' + short(r.bubbleWords));
      ok(r.titleAbove, 'its title, A face name on one relay, stands above the bubble', 'title ' + short(r.title) + ', above ' + r.titleAbove);
      ok(r.holdsBelow, 'what this node holds on the relay stands below the bubble, not in it', 'holds ' + short(r.holds) + ', below ' + r.holdsBelow);
      ok(r.forms === 1 && r.others === 0, 'its Ask is the rowForm\'s button, the only one', 'other Asks: ' + r.others);
    });
    test.subHeading('goal/G43.18: a face only on a starred relay');
    // Box v29: "At home, faceForm offers a face only on a starred relay (today it offers only relays not starred, G41.32: that
    // turns round)."
    const of = m.offers || {};
    ok(of.starred === true, 'offers: a seated relay with the star can be offered', 'offers of a starred seated relay: ' + short(of.starred));
    ok(of.unstarred === false, 'offers: a seated relay without the star cannot', 'offers of a seated relay with no star: ' + short(of.unstarred));
    test.subHeading('no relay with a seat and a star');
    // Andy: "doesn't show up if the user has zero verified emails anywhere" (a seat taken by email is a verified one, goal/G40.11).
    const n = m.none || {};
    ok(n.forms === 0 && n.text === '' && n.kids === 0, 'with no relay this node is seated on and starred, it draws nothing: Alpha starred with no seat, Delta seated with no star', 'drew: ' + short(n));
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
