'use strict';

// spirit/run/spirit/element/test/relayRowStream.js
// WHO PAINTS, LISTENS (goal/G41.32; Andy, Q13: "every row's data, wherever it's visible must update instantly: who paints,
// listens.", and "BEING INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"; the box:
// "natterDetails will become an shell element: relayPanel.js, it is configured with it's own contact row, and follows only
// that."; "the "⭐ Star this relay" section should be a folded block"). hub.js relaySummary builds a relay's owned, claimed,
// roll, services and status from what the node holds, and asks no relay, so the node publishes each as it changes, on the
// relay's row, under those names; the report goes on the relay event, which only a starred face hears (wsl, in the item's
// chat, cw's check of it). A real scratch node and relay, the node's own stream, and a real Chrome for the panel.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..','..','..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, scratchFaceRelay, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

const MAIL = 'bert@example.org';
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

test.startTest('relayRowStream.js: who paints, listens: a relay\'s row and relayPanel (goal/G41.32)');

(async function () {
  const N = await scratchNode();
  const R = await scratchFaceRelay({ members: [] });
  let S = null;
  const others = [];
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
    ok(fs.existsSync(path.join(RUN, 'spirit/element/search/contact/relayPanel.js')), 'spirit/element/search/contact/relayPanel.js is there', 'no spirit/element/search/contact/relayPanel.js');
    ok(!fs.existsSync(path.join(RUN, 'spirit/element/natterDetails')), 'and natterDetails is gone', 'spirit/element/natterDetails is still there');
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the panel is not judged'); return; }
    chrome = await chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    // The shell Andy uses, at home as on a relay: boot.js. The older page at / loads every element up front and would hide a
    // panel that forgets to load its own.
    await chrome.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
    await sleep(3000);
    const mounted = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/relayPanel.js")).then(function () { var E = window.spirit.element.search.contact.relayPanel; if (!E || typeof E.create !== "function") return "no create"; var h = document.createElement("div"); h.id = "zzPanel"; document.body.appendChild(h); window.__panel = E.create(h, { key: ' + JSON.stringify(key) + ' }); return "ok"; }, function (e) { return "refused: " + e.message; })');
    ok(mounted === 'ok', 'relayPanel.create(host, { key }) draws it', 'the panel: ' + short(mounted));
    if (mounted !== 'ok') return;
    const text = function () { return chrome.evaluate('document.getElementById("zzPanel").textContent').then(String); };
    await until(function () { return text().then(function (t) { return t.indexOf(LABEL) !== -1; }); }, 8000);
    ok((await text()).indexOf(LABEL) !== -1, 'it paints the relay\'s label', 'the panel says: ' + short(await text()));

    // Andy: "the folding panel "⭐ Star this relay" must use the same heading and style al all the other folding panels in relayPanel."
    test.subHeading('the star is a folding panel like the others');
    const FOLDS = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold"))';
    const star = await chrome.evaluate('(function () { var all = ' + FOLDS + '; var s = all.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; var o = all.filter(function (h) { return h !== s; })[0]; if (!s || !o) return { star: !!s, other: !!o }; return { star: true, other: true, sameHeading: s.className === o.className && s.tagName === o.tagName, sameTile: s.parentElement.className.split(" ").slice(0, 2).join(" ") === o.parentElement.className.split(" ").slice(0, 2).join(" "), mark: !!s.querySelector(".nd-fold-mark"), details: !!document.querySelector("#zzPanel details"), buttonWhileShut: !!document.querySelector("#zzPanel .nd-own") }; }())');
    ok(!!star && star.star && star.other, 'its heading stands among the others', 'the folds: ' + short(star));
    ok(!!star && star.sameHeading && star.sameTile && star.mark, 'with the same heading, tile and fold mark', 'the star: ' + short(star));
    ok(!!star && star.details === false, 'and no fold of its own', 'the star: ' + short(star));
    ok(!!star && star.buttonWhileShut === false, 'it arrives shut: its button is not shown', 'the star: ' + short(star));
    await chrome.evaluate('(function () { var s = ' + FOLDS + '.filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; })[0]; if (s) s.click(); }())');
    await sleep(500);
    const opened = await chrome.evaluate('(function () { var b = document.querySelector("#zzPanel .nd-own"); return !!b && b.closest(".stat-tile").textContent.indexOf("Star this relay") !== -1; }())');
    ok(opened === true, 'pressed, it opens and holds its button', 'the star opened: ' + short(opened));

    // Andy: "the folding panel "A face name" should actually show the faceForm, unless the relay is "starred"", "that's one bug,
    // and one design change.", "bug: "A face name" doesn't show the faceForm.", "change: don't show it if the relay is starred...".
    test.subHeading('"A face name" shows the faceForm, unless the relay is starred');
    const faceHead = 'Array.prototype.slice.call(document.querySelectorAll("#zzPanel .nd-fold")).filter(function (h) { return h.textContent.indexOf("A face name") !== -1; })[0]';
    const hasFaceHead = function () { return chrome.evaluate('!!(' + faceHead + ')'); };
    await until(hasFaceHead, 5000);
    ok(await hasFaceHead(), 'with no star, its fold stands', 'no "A face name" fold: ' + short(await text()));
    await chrome.evaluate('(function () { var h = ' + faceHead + '; if (h) h.click(); }())');
    await until(function () { return chrome.evaluate('!!document.querySelector("#zzPanel .nd-face-form input")'); }, 5000);
    const drawn = await chrome.evaluate('(function () { var f = document.querySelector("#zzPanel .nd-face-form"); return f ? { input: !!f.querySelector("input"), button: !!f.querySelector("button"), text: f.textContent.slice(0, 80) } : null; }())');
    ok(!!drawn && drawn.input && drawn.button, 'opened, it holds the faceForm: its field and its button', 'the fold holds: ' + short(drawn));
    const sOn = await home(N.base, 'contact.own', { key: key, own: true });
    ok(sOn.status === 200, 'the star on, at home', 'contact.own: ' + sOn.status + ' ' + short(sOn.text));
    await until(function () { return hasFaceHead().then(function (h) { return !h; }); }, 5000);
    ok(!(await hasFaceHead()), 'starred: the fold is gone, with no reload', 'starred, "A face name" is still there');
    const sOff = await home(N.base, 'contact.own', { key: key, own: false });
    ok(sOff.status === 200, 'the star off, at home', 'contact.own false: ' + sOff.status + ' ' + short(sOff.text));
    await until(hasFaceHead, 5000);
    ok(await hasFaceHead(), 'and it comes back', 'the star off, "A face name" did not come back');

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
    // Another relay's row, joined and not owned: a panel that listened to it would stop saying this relay is owned.
    const before = await text();
    const Other = await scratchFaceRelay({ members: [] });
    others.push(Other);
    ok(Other.up, 'a second relay comes up', 'the second relay did not come up: nothing judged');
    await home(N.base, 'relay.add', { url: Other.base, label: 'zzOtherRelay' });
    await home(N.base, 'relay.join', { url: Other.base, email: MAIL });
    await until(function () { return Other.mailed.length > 0; }, 5000);
    const code2 = Other.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Other.mailed[0].text)) || [])[1];
    await home(N.base, 'relay.join', { url: Other.base, email: MAIL, code: code2 });
    await until(function () { const r = last(Other.relayKey); return !!r && r.claimed === true && r.owned === false; }, 10000);
    const otherRow = last(Other.relayKey) || {};
    ok(otherRow.claimed === true && otherRow.owned === false, 'the other relay\'s row, seated and not owned, is on the stream', 'nothing judged: ' + short(otherRow));
    await sleep(1000);
    ok((await text()) === before, 'and nothing of it reaches this panel', 'it repainted for another relay\'s row: ' + short(await text()));

    test.subHeading('gone from the page, it stops');
    const mark = chrome.heard.length;
    const gone = await chrome.evaluate('(function () { if (!window.__panel || typeof window.__panel.destroy !== "function") return false; window.__panel.destroy(); return true; }())');
    ok(gone === true, 'it has a destroy', 'no destroy on the panel');
    await home(N.base, 'peer.post', { to: key, text: JSON.stringify({ app: 'relay', body: { relayLabel: { label: 'zzNameThree' } } }) });
    await sleep(1500);
    const threw = chrome.heard.slice(mark).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text; });
    ok(!threw.length && (await text()).indexOf('zzNameThree') === -1, 'a later change neither throws nor paints', 'after destroy: ' + short(threw) + ' ' + short(await text()));

    // THE FACE FORM OFFERS MEMBERS' RELAYS WITH NO STAR (goal/G41.32; Andy: "show only relays in the relay-dropdown that the node is
    // a member of AND are not starred.", "if there are no relays that satisfy the requirement, don't display the form at all.",
    // "faceForm provides that check as a function", "info-app: don't show the faceForm, if the faceForm says it shouldn't be
    // displayed"; and of following the rows with no read: "agreed."). This node sits on two relays here, neither starred.
    test.subHeading('the face form: its check, as a function');
    await chrome.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
    await sleep(3000);
    const check = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/faceForm.js")).then(function () { var F = window.spirit.element.faceForm; if (!F || typeof F.offers !== "function") return null; var u = "http://x"; return { member: F.offers([{ url: u, claimed: true, mine: false }]), owner: F.offers([{ url: u, owned: true, mine: false }]), starred: F.offers([{ url: u, claimed: true, mine: true }]), stranger: F.offers([{ url: u, claimed: false, owned: false, mine: false }]), none: F.offers([]), one: F.offers([{ url: u, claimed: true, mine: true }, { url: "http://y", claimed: true, mine: false }]) }; })');
    ok(!!check, 'faceForm.offers(relays) is there', 'no faceForm.offers');
    if (check) {
      ok(check.member === true && check.owner === true && check.one === true, 'true for a relay this node is a member of or owns, with no star', 'offers: ' + short(check));
      ok(check.starred === false && check.stranger === false && check.none === false, 'false for a starred relay, one it holds no seat on, and for none', 'offers: ' + short(check));
    }

    test.subHeading('Info: the form offers members\' relays with no star, and follows the star with no reload');
    await chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Info"; })[0]; if (e) e.click(); }())');
    const options = function () { return chrome.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("[data-info=\\"face\\"] .sp-face-relay option")).map(function (o) { return o.value; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
    const tileShown = function () { return chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null && !!b.querySelector(".sp-face-relay"); }())'); };
    const emptyTile = function () { return chrome.evaluate('(function () { var b = document.querySelector("[data-info=\\"face\\"]"); return !!b && b.offsetParent !== null; }())'); };
    await until(function () { return options().then(function (o) { return o.length >= 2; }); }, 8000);
    const both = await options();
    ok(both.indexOf(R.base) !== -1 && both.indexOf(Other.base) !== -1, 'neither starred: it offers both', 'it offers: ' + short(both));
    const reads = function () { return chrome.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent' && /"call":"(relay\.(status|get)|contact\.search)"/.test(String((m.params.request || {}).postData || '')); }).length; };
    const readsBefore = reads();
    await home(N.base, 'contact.own', { key: key, own: true });
    await until(function () { return options().then(function (o) { return o.indexOf(R.base) === -1; }); }, 5000);
    const oneLeft = await options();
    ok(oneLeft.indexOf(R.base) === -1 && oneLeft.indexOf(Other.base) !== -1, 'one starred, no reload: it is gone from the dropdown, the other stays', 'it offers: ' + short(oneLeft));
    ok(reads() === readsBefore, 'and the form followed the row, reading nothing', (reads() - readsBefore) + ' reads for one star');
    await home(N.base, 'contact.own', { key: Other.relayKey, own: true });
    await until(function () { return emptyTile().then(function (t) { return !t; }); }, 5000);
    ok(!(await tileShown()) && !(await emptyTile()), 'both starred: no form, and no empty tile left in Info', 'with both starred: form ' + (await tileShown()) + ', its tile ' + (await emptyTile()));
    await home(N.base, 'contact.own', { key: Other.relayKey, own: false });
    await until(tileShown, 5000);
    const offeredBack = await options();
    ok((await tileShown()) && offeredBack.indexOf(Other.base) !== -1 && offeredBack.indexOf(R.base) === -1, 'one star off: the form is back, offering that relay', 'form ' + (await tileShown()) + ', it offers ' + short(offeredBack));

    // A RELAY THIS NODE IS NOT A MEMBER OF CANNOT BE STARRED (goal/G41.32; Andy: "a relay I'm not a member of can not be starred
    // (relays i own automatically give me membership)"). At the node's own door, so no screen can get round it.
    test.subHeading('only a relay this node is a member of or owns can be starred');
    const starred = async function (k) { const a = await home(N.base, 'contact.search', { q: '', mine: 'yes' }); return !!(a.body && (a.body.items || []).some(function (i) { return i.key === k; })); };
    const Far = await scratchFaceRelay({ members: [] });
    others.push(Far);
    ok(Far.up, 'a third relay comes up', 'the third relay did not come up: nothing judged');
    await home(N.base, 'relay.add', { url: Far.base, label: 'zzFar' });
    await until(function () { return rowsOf(Far.relayKey).length > 0; }, 8000);
    const farNo = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
    ok(farNo.status >= 400 && farNo.status < 500 && !!(farNo.body && farNo.body.code), 'listed, no seat: contact.own is refused at home, with a code', 'contact.own of a relay with no seat: ' + farNo.status + ' ' + short(farNo.text));
    ok(!(await starred(Far.relayKey)), 'and no star lands', 'a relay with no seat has a star');
    const farOwnOff = await home(N.base, 'contact.own', { key: Far.relayKey, own: false });
    ok(!(await starred(Far.relayKey)), 'taking away a star it does not have changes nothing: ' + farOwnOff.status, 'after own false it has a star');
    const person = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('zzPuppet').publicKey;
    await home(N.base, 'contact.block', { publicKey: person });
    const personAns = await home(N.base, 'contact.own', { key: person, own: true });
    test.comment('a node that is no relay, contact.own answers ' + personAns.status + ': this rule is about relays alone');

    test.subHeading('its panel offers no star there');
    const farPanel = await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/search/contact/relayPanel.js")).then(function () { var h = document.createElement("div"); h.id = "zzFar"; document.body.appendChild(h); window.spirit.element.search.contact.relayPanel.create(h, { key: ' + JSON.stringify(Far.relayKey) + ' }); return "ok"; })');
    await until(function () { return chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0'); }, 8000);
    const farStar = await chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzFar .nd-fold")).filter(function (h) { return h.textContent.indexOf("Star this relay") !== -1; }).length');
    ok(farPanel === 'ok' && await chrome.evaluate('document.querySelectorAll("#zzFar .nd-fold").length > 0'), 'the panel draws for it', 'no panel for a relay with no seat');
    ok(farStar === 0, 'with no star fold', 'a relay with no seat offers a star');

    test.subHeading('a member can star it; leaving takes the star away');
    // Leaving: read from his ruling, and Q21 asks him outright (ubi: "a relay you have left keeps its star"); if he says no, these two checks go.
    await home(N.base, 'relay.join', { url: Far.base, email: MAIL });
    await until(function () { return Far.mailed.length > 0; }, 5000);
    const farCode = Far.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Far.mailed[0].text)) || [])[1];
    await home(N.base, 'relay.join', { url: Far.base, email: MAIL, code: farCode });
    await until(function () { const r = last(Far.relayKey); return !!r && r.claimed === true; }, 10000);
    const farYes = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
    ok(farYes.status === 200 && await starred(Far.relayKey), 'joined: the star goes on', 'contact.own of a member\'s relay: ' + farYes.status + ' ' + short(farYes.text));
    // The first ask may still be waiting for the relay's card, as relay.face's does.
    let left = null;
    for (let i = 0; i < 8; i++) { left = await home(N.base, 'relay.leave', { key: Far.base }); if (left.status < 300 || left.status === 404) break; await sleep(2000); }
    await until(function () { const r = last(Far.relayKey); return !!r && r.claimed === false; }, 8000);
    ok(((last(Far.relayKey) || {}).claimed) === false, 'it leaves the relay: its row holds no seat', 'relay.leave: ' + left.status + ' ' + short(left.text) + ', row ' + short(last(Far.relayKey)));
    await until(function () { return starred(Far.relayKey).then(function (x) { return !x; }); }, 5000);
    ok(!(await starred(Far.relayKey)), 'and the star is gone with the seat', 'it left the relay and the star stayed');
    const notAgain = await home(N.base, 'contact.own', { key: Far.relayKey, own: true });
    ok(notAgain.status >= 400 && notAgain.status < 500, 'and cannot be put back', 'contact.own after leaving: ' + notAgain.status + ' ' + short(notAgain.text));

    test.subHeading('a relay this node owns counts as membership');
    const Own = await scratchFaceRelay({ members: [], ownerKey: me });
    others.push(Own);
    ok(Own.up, 'a relay naming this node its owner comes up', 'it did not come up: nothing judged');
    await home(N.base, 'relay.add', { url: Own.base, label: 'zzOwned' });
    await home(N.base, 'relay.join', { url: Own.base, email: MAIL });
    await until(function () { return Own.mailed.length > 0; }, 5000);
    const ownCode = Own.mailed[0] && ((/[?&]join=([A-Za-z0-9_-]+)/.exec(Own.mailed[0].text)) || [])[1];
    if (ownCode) await home(N.base, 'relay.join', { url: Own.base, email: MAIL, code: ownCode });
    await until(function () { const r = last(Own.relayKey); return !!r && r.owned === true; }, 20000);
    const ownedRow2 = last(Own.relayKey) || {};
    ok(ownedRow2.owned === true, 'its report has come: owned', 'no report: nothing judged: ' + short(ownedRow2));
    const ownYes = await home(N.base, 'contact.own', { key: Own.relayKey, own: true });
    ok(ownYes.status === 200 && await starred(Own.relayKey), 'owned: the star goes on', 'contact.own of an owned relay: ' + ownYes.status + ' ' + short(ownYes.text));

    // Andy: "the contact list should do something to mark a relay, like print its label in bold-italic."
    test.subHeading('the contact list marks a relay: its label in bold italic');
    await home(N.base, 'contact.label', { publicKey: person, myLabel: 'zzPersonRow' });
    await home(N.base, 'contact.unblock', { publicKey: person });
    await home(N.base, 'contact.accept', { publicKey: person });
    await chrome.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.require)'); }, 20000);
    await sleep(3000);
    await chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === "Contacts"; })[0]; if (e) e.click(); }())');
    const styleOf = function (words) { return chrome.evaluate('(function () { var e = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (x) { return x.offsetParent !== null && !x.children.length && x.textContent.trim() === ' + JSON.stringify(words) + '; })[0]; if (!e) return null; var c = getComputedStyle(e); return { weight: Number(c.fontWeight), style: c.fontStyle }; }())'); };
    await until(function () { return styleOf('scratch'); }, 8000);
    const relayLook = await styleOf('scratch');
    ok(!!relayLook && relayLook.weight >= 700 && relayLook.style === 'italic', 'a relay\'s label is bold and italic', 'a relay\'s label: ' + short(relayLook));
    await until(function () { return styleOf('zzPersonRow'); }, 5000);
    const personLook = await styleOf('zzPersonRow');
    ok(!!personLook, 'a person is listed too', 'no person\'s row: the difference is not judged');
    ok(!!personLook && !(personLook.weight >= 700 && personLook.style === 'italic'), 'and a person\'s label is not', 'a person\'s label: ' + short(personLook));
  } finally {
    try { if (S) S.stop(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { R.stop(); } catch (e) { /* gone */ }
    others.forEach(function (o) { try { o.stop(); } catch (e) { /* gone */ } });
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
