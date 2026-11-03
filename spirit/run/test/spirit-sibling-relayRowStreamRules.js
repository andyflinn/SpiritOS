'use strict';

// spirit/run/test/spirit-sibling-relayRowStreamRules.js
// WHO PAINTS, LISTENS (goal/G41.32; Andy, Q13: "every row's data, wherever it's visible must update instantly: who paints,
// listens.", and "BEING INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"; the box:
// "natterDetails will become an shell element: relayPanel.js, it is configured with it's own contact row, and follows only
// that."; "the "⭐ Star this relay" section should be a folded block"). hub.js relaySummary builds a relay's owned, claimed,
// roll, services and status from what the node holds, and asks no relay, so the node publishes each as it changes, on the
// relay's row, under those names; the report goes on the relay event, which only a starred face hears (wsl, in the item's
// chat, cw's check of it). A real scratch node and relay, the node's own stream, and a real Chrome for the panel.

const fs = require('fs');
const path = require('path');
const test = require(path.join(__dirname, 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(__dirname, 'headLessChrome.js'));

const MAIL = 'bert@example.org';
const RUN = path.join(__dirname, '..');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 320); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function home(base, verb, args) {
  const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  return { status: r.status, text: text, body: parsed(text) };
}
// The node's own stream, as a page reads it: every event, kept.
function stream(base) {
  const kept = [];
  const c = new AbortController();
  const done = fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spirit-reader': 'server' }, body: JSON.stringify({ call: 'events.subscribe', args: {} }), signal: c.signal }).then(async function (r) {
    let held = '';
    const dec = new TextDecoder();
    for await (const chunk of r.body) {
      held += dec.decode(chunk, { stream: true });
      const parts = held.split('\n\n');
      held = parts.pop();
      parts.forEach(function (p) {
        const kind = (/^event: (.*)$/m.exec(p) || [])[1];
        const data = (/^data: (.*)$/m.exec(p) || [])[1];
        if (kind) kept.push({ kind: kind, data: parsed(data) });
      });
    }
  }).catch(function () { /* the stream ends with the test */ });
  return { kept: kept, stop: function () { c.abort(); return done; } };
}

test.startTest('spirit-sibling-relayRowStreamRules.js: who paints, listens: a relay\'s row and relayPanel (goal/G41.32)');

(async function () {
  const N = await scratchNode();
  const R = await scratchFaceRelay({ members: [] });
  let S = null;
  let chrome = null;
  try {
    if (!N.up || !R.up) { test.fail('the scratch node or relay did not come up: nothing judged'); return; }
    const me = (await home(N.base, 'node.card')).body.publicKey;
    S = stream(N.base);
    const rowsOf = function (key) { return S.kept.filter(function (e) { return e.kind === 'job-updated' && e.data && e.data.type === 'shadow' && e.data.data && e.data.data.row && e.data.data.row.publicKey === key; }).map(function (e) { return e.data.data.row; }); };
    const last = function (key) { const r = rowsOf(key); return r.length ? r[r.length - 1] : null; };
    const key = R.relayKey;

    test.subHeading('a seat taken: the row says so, with no one asking');
    await home(N.base, 'relay.add', { url: R.base, label: 'scratch' });
    await home(N.base, 'relay.join', { url: R.base, email: MAIL });
    await until(function () { return R.mailed.length > 0; }, 5000);
    const code = R.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(R.mailed[0].text)) || [])[1];
    ok(!!code, 'the relay mails a join code', 'no join code: nothing judged');
    if (!code) return;
    await home(N.base, 'relay.join', { url: R.base, email: MAIL, code: code });
    await until(function () { const r = last(key); return !!r && r.claimed === true && r.status === 200; }, 10000);
    const seated = last(key) || {};
    ok(seated.claimed === true, 'claimed is on the row', 'the last row: ' + short(seated));
    ok(seated.status === 200, 'status is on the row, the stream held', 'the last row: ' + short(seated));
    ok(!!seated.services && seated.services.sendMail === true, 'services are on the row, from the relay\'s card', 'the last row: ' + short(seated));
    ok(!!seated.roll && seated.roll.relayKey === key, 'the roll is on the row', 'the last row: ' + short(seated));
    ok(seated.owned === false, 'owned is on the row: false, no report has come', 'the last row: ' + short(seated));

    test.subHeading('the relay gone and back, and now naming this node its owner: the row follows');
    const report0 = S.kept.length;
    const back = await R.becomeOwned(me);
    ok(back, 'the relay comes back with this node as its owner', 'the relay did not come back: nothing judged');
    if (!back) return;
    const down = rowsOf(key).some(function (r) { return r.status === 0; });
    ok(down, 'while it was gone the row said status 0', 'no row said the stream dropped: ' + short(rowsOf(key).map(function (r) { return r.status; })));
    await until(function () { const r = last(key); return !!r && r.owned === true && r.status === 200; }, 20000);
    const ownedRow = last(key) || {};
    ok(ownedRow.status === 200 && ownedRow.owned === true, 'back: status 200 and owned true, on the row', 'the last row: ' + short(ownedRow));
    ok(!!ownedRow.roll && ownedRow.roll.ownerKey === me, 'and the roll names this node its owner', 'the last row: ' + short(ownedRow));

    test.subHeading('a report arrives: it is on the stream, whole, and not on the row');
    await until(function () { return S.kept.slice(report0).some(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }); }, 20000);
    const rep = S.kept.slice(report0).filter(function (e) { return e.kind === 'relay-event' && e.data && e.data.report; }).pop();
    ok(!!rep && rep.data.kind === 'status' && typeof rep.data.report === 'object' && Object.keys(rep.data.report).length > 0, 'the relay event carries the report', 'relay events: ' + short(S.kept.slice(report0).filter(function (e) { return e.kind === 'relay-event'; }).map(function (e) { return e.data; })));
    // Rows reach every face, starred or not, and a report lists invites.
    ok(rowsOf(key).every(function (r) { return r.report === undefined; }), 'no row carries a report', 'a row with a report: ' + short(rowsOf(key).filter(function (r) { return r.report !== undefined; })[0]));

    test.subHeading('a card that changes: the row\'s label follows');
    const LABEL = 'zzRenamed';
    const rn = await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: LABEL } } }) });
    ok(rn.status === 200, 'the owner renames the relay', 'relayLabel: ' + rn.status + ' ' + short(rn.text));
    await until(function () { const r = last(key); return !!r && !!r.roll && r.roll.relayLabel === LABEL; }, 8000);
    ok(((last(key) || {}).roll || {}).relayLabel === LABEL, 'the row says the new label', 'the last row: ' + short(last(key)));

    test.subHeading('relayPanel: an element, configured with its row');
    ok(fs.existsSync(path.join(RUN, 'shell/js/relayPanel.js')), 'shell/js/relayPanel.js is there', 'no shell/js/relayPanel.js');
    ok(!fs.existsSync(path.join(RUN, 'shell/js/natterDetails')), 'and natterDetails is gone', 'shell/js/natterDetails is still there');
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the panel is not judged'); return; }
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    await chrome.send('Page.navigate', { url: N.base + '/' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
    await sleep(3000);
    const mounted = await chrome.evaluate('Promise.resolve(window.spirit.require("shell/js/relayPanel.js")).then(function () { var E = window.spirit.elements.relayPanel; if (!E || typeof E.create !== "function") return "no create"; var h = document.createElement("div"); h.id = "zzPanel"; document.body.appendChild(h); window.__panel = E.create(h, { key: ' + JSON.stringify(key) + ' }); return "ok"; }, function (e) { return "refused: " + e.message; })');
    ok(mounted === 'ok', 'relayPanel.create(host, { key }) draws it', 'the panel: ' + short(mounted));
    if (mounted !== 'ok') return;
    const text = function () { return chrome.evaluate('document.getElementById("zzPanel").textContent').then(String); };
    await until(function () { return text().then(function (t) { return t.indexOf(LABEL) !== -1; }); }, 8000);
    ok((await text()).indexOf(LABEL) !== -1, 'it paints the relay\'s label', 'the panel says: ' + short(await text()));

    test.subHeading('the star is a folded block');
    const star = await chrome.evaluate('(function () { var d = Array.prototype.slice.call(document.querySelectorAll("#zzPanel details")).filter(function (x) { var s = x.querySelector("summary"); return s && s.textContent.indexOf("Star this relay") !== -1; })[0]; return d ? { open: d.open, button: !!d.querySelector(".nd-own, button") } : null; }())');
    ok(!!star && star.open === false, 'a closed block under "⭐ Star this relay"', 'the star block: ' + short(star));
    ok(!!star && star.button, 'holding its button', 'the star block: ' + short(star));

    test.subHeading('it listens, shown or hidden, and asks no one again');
    const asks = function () { return chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"relay\.(status|get)"/.test(String((m.params.request || {}).postData || '')); }).length; };
    const asked = asks();
    const NEW1 = 'zzNameOne';
    await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW1 } } }) });
    await until(function () { return text().then(function (t) { return t.indexOf(NEW1) !== -1; }); }, 8000);
    ok((await text()).indexOf(NEW1) !== -1, 'shown: the new label is painted', 'the panel says: ' + short(await text()));
    ok(asks() === asked, 'and no relay.status or relay.get was asked for it', (asks() - asked) + ' reads were asked for one change');
    await chrome.evaluate('document.getElementById("zzPanel").style.display = "none"; 1');
    const NEW2 = 'zzNameTwo';
    await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: NEW2 } } }) });
    await until(function () { return text().then(function (t) { return t.indexOf(NEW2) !== -1; }); }, 8000);
    ok((await text()).indexOf(NEW2) !== -1, 'hidden: the new label is painted all the same', 'hidden, the panel says: ' + short(await text()));
    await chrome.evaluate('document.getElementById("zzPanel").style.display = ""; 1');

    test.subHeading('it follows only its row');
    const before = await text();
    const other = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zz').publicKey;
    await home(N.base, 'contact.block', { publicKey: other });
    await sleep(1500);
    ok((await text()) === before, 'another contact\'s row changes nothing in it', 'it repainted for another row');

    test.subHeading('gone from the page, it stops');
    const mark = chrome.heard.length;
    const gone = await chrome.evaluate('(function () { if (!window.__panel || typeof window.__panel.destroy !== "function") return false; window.__panel.destroy(); return true; }())');
    ok(gone === true, 'it has a destroy', 'no destroy on the panel');
    await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: 'zzNameThree' } } }) });
    await sleep(1500);
    const threw = chrome.heard.slice(mark).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text; });
    ok(!threw.length && (await text()).indexOf('zzNameThree') === -1, 'a later change neither throws nor paints', 'after destroy: ' + short(threw) + ' ' + short(await text()));
  } finally {
    try { if (S) S.stop(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { R.stop(); } catch (e) { /* gone */ }
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
