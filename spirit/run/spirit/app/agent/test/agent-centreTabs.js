'use strict';

// spirit/run/spirit/app/agent/test/agent-centreTabs.js
// THE AGENT APP'S CENTRE IS TABS (goal/G41.31; Andy, the box: "i need a tabContainer permanently situated in the center pane of
// the workBench."; "each panel, that the agent app placed into the center panel now becomes a closable tab in the
// tabContainer, activated if it already exists, created if it doesn't have a tab yet."; each tab's header, by kind; "any tab
// that hears (by listening) of it's own rows deletion will close itself."; "an unsaved add-tab will say: "new <row-type>*"";
// and Q1, the tabs stay open when the left tool changes). What a person sees is judged, by real clicks in a real Chrome on a
// scratch node, on the shell Andy uses, /face.html.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..','..','..','..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
const ICON = { provider: '🧪', model: '🧬', persona: '🧙', job: '🧰' };
const CHAT = '💬';

test.startTest('agent-centreTabs.js: the agent app\'s centre is closable tabs (goal/G41.31)');

(async function () {
  const N = await scratchNode();
  let c = null;
  try {
    if (!N.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const home = async function (verb, args) {
      const r = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    };
    // active is its one switch (goal/G43.13).
    await home('app.active', { key: 'agent', active: true });
    let P = null;
    await until(function () { return home('agent.provider', { op: 'add', icon: ICON.provider, label: 'zzProvider', url: 'http://192.0.2.1:9/' }).then(function (a) { P = a; return a.status === 200 && !!(a.body && a.body.id); }); }, 20000);
    ok(!!(P && P.body && P.body.id), 'the agent server answers, and a provider stands', 'nothing judged: ' + short(P && P.text));
    if (!(P && P.body && P.body.id)) return;
    const M = await home('agent.model', { op: 'add', icon: ICON.model, label: 'zzModel', providerId: P.body.id });
    const Pe = await home('agent.persona', { op: 'add', icon: ICON.persona, label: 'zzPersona', persona: 'zz', bundle: 'zz', provider: P.body.id });
    const J = await home('agent.job', { op: 'add', icon: ICON.job, label: 'zzJob', job: 'zz', bundle: 'zz', provider: P.body.id, persona: Pe.body && Pe.body.id });
    ok(M.status === 200 && Pe.status === 200 && J.status === 200, 'and a model, a persona and a job', 'nothing judged: ' + short([M.text, Pe.text, J.text]));
    const B = await home('auth.bundle', { op: 'add', label: 'zzNodeBundle' });
    ok(B.status === 200, 'and a bundle of the node\'s', 'auth.bundle: ' + short(B.text));
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return c.evaluate('!!(window.spirit && window.spirit.events)'); }, 20000);
    const LEAF = 'function leaf(w, within) { var root = within ? document.querySelector(within) : document; if (!root) return null; return Array.prototype.slice.call(root.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === w && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === w; }); })[0] || null; }';
    const press = function (words, within) { return c.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
    // The Agent opens from the appSelector's tiles, as the shell app makes them (goal/G43.13).
    await c.evaluate('(function () { var b = document.createElement("div"); b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { spirit.element.spirit.app.app.element.create(b, { face: "tiles" }); return 1; }); }())');
    await until(function () { return press('Agent'); }, 20000);
    await until(function () { return c.evaluate('!!document.querySelector("[data-tool=provider]")'); }, 10000);
    const appOpen = await c.evaluate('!!document.querySelector("[data-tool=provider]")');
    ok(appOpen, 'the Agent app opens', 'no Agent app, nothing judged: ' + short(await c.evaluate('document.body.innerText')));
    if (!appOpen) return;
    const CENTRE = '[id$="center"]';
    const tabs = function () { return c.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).map(function (b) { return { text: b.textContent.replace(/✕/g, "").replace(/\\s+/g, " ").trim(), on: b.getAttribute("aria-selected") === "true", close: !!b.querySelector("[data-tab-close]") }; }))').then(function (t) { return parsed(t) || []; }); };
    const tabOf = async function (words) { return (await tabs()).filter(function (t) { return t.text === words; }); };
    // A tool is opened, never toggled: a press on the one already shown collapses it (workBench.js, data-current).
    const tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("[data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };
    // A row of a tool's list, by its label, outside the centre.
    const pressRow = function (label) { return c.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && !e.closest(' + JSON.stringify(CENTRE) + ') && e.textContent.trim() === ' + JSON.stringify(label) + ' && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === ' + JSON.stringify(label) + '; }); }); if (!all[0]) return false; all[0].click(); return true; }())'); };
    const waitTab = function (words) { return until(function () { return tabOf(words).then(function (t) { return t.length > 0; }); }, 6000); };

    test.subHeading('a tabContainer stands in the centre, from the start');
    ok(await c.evaluate('!!document.querySelector(' + JSON.stringify(CENTRE + ' .tab-content') + ')'), 'with nothing opened, it is there', 'no tabContainer in the centre');
    ok((await tabs()).length === 0, 'with no tabs yet', 'tabs before anything was opened: ' + short(await tabs()));

    test.subHeading('each kind of row opens a closable tab, named by the box');
    for (const k of [['provider', 'zzProvider'], ['model', 'zzModel'], ['persona', 'zzPersona'], ['job', 'zzJob']]) {
      const words = ICON[k[0]] + ' ' + k[1];
      const shown = await tool(k[0]);
      await until(function () { return pressRow(k[1]); }, 6000);
      await waitTab(words);
      const t = await tabOf(words);
      ok(shown && t.length === 1 && t[0].on, k[0] + ': a tab reading "' + words + '" opens, and is active', k[0] + ': tabs ' + short(await tabs()));
      ok(t.length === 1 && t[0].close, 'and it has a close button', k[0] + ': no close button: ' + short(t));
    }

    test.subHeading('a row already open: its tab is made active, no second one');
    await tool('provider');
    await until(function () { return pressRow('zzProvider'); }, 6000);
    await sleep(500);
    const again = await tabOf(ICON.provider + ' zzProvider');
    ok(again.length === 1 && again[0].on, 'the provider\'s tab is active again, and alone', 'tabs ' + short(await tabs()));

    // Who listens, listens once: a press on a row that has its tab adds no second listener, and closing a tab lets go of its own.
    test.subHeading('a tab has one listener on its row, and lets go of it when it closes');
    // A row's listeners are counted where the tab and its editor ask for them: the agent family's cache, its table's watch(id, fn) (goal/G43.32:
    // a reader asks its family's cache, which alone names its addresses).
    await c.evaluate('(function () { var A = window.spirit.data.agent.data; window.__live = 0; window.__rowPath = ' + JSON.stringify('/' + P.body.id) + '; A.tables.forEach(function (t) { var B = A[t]; var made = B.watch; B.watch = function (id, fn) { var mine = typeof id === "string" && "/" + id === window.__rowPath; var off = made.call(B, id, fn); if (!mine) return off; window.__live++; var done = false; return function () { if (!done) { done = true; window.__live--; } return off(); }; }; }); return true; }())');
    for (let i = 0; i < 3; i++) { await pressRow('zzProvider'); await sleep(250); }
    const stacked = await c.evaluate('window.__live');
    ok(stacked === 0, 'three more presses on an open row add no listener', stacked + ' more listeners on that row after three presses');

    test.subHeading('the tabs stay when the left tool changes');
    const before = (await tabs()).length;
    await tool('job');
    await sleep(500);
    ok(before >= 4 && (await tabs()).length === before, 'all ' + before + ' are still there', 'before ' + before + ', after ' + short(await tabs()));

    test.subHeading('a chat is a tab of its own beside its persona\'s');
    await tool('chat');
    await until(function () { return pressRow('zzPersona'); }, 6000);
    const chatWords = CHAT + ' zzPersona';
    await waitTab(chatWords);
    const chat = await tabOf(chatWords);
    ok(chat.length === 1 && chat[0].on, 'a tab reading "' + chatWords + '" opens, and is active', 'tabs ' + short(await tabs()));
    ok((await tabOf(ICON.persona + ' zzPersona')).length === 1, 'and the persona\'s own tab is still there', 'tabs ' + short(await tabs()));

    test.subHeading('a bundle\'s tab: its name; not the node\'s: in brackets and italic');
    await tool('bundles');
    await until(function () { return pressRow('zzNodeBundle'); }, 6000);
    await waitTab('zzNodeBundle');
    ok((await tabOf('zzNodeBundle')).length === 1, 'a node\'s bundle: "zzNodeBundle" alone', 'tabs ' + short(await tabs()));
    const styleOf = function (words) { return c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(words) + ') !== -1; })[0]; if (!b) return null; var all = [b].concat(Array.prototype.slice.call(b.querySelectorAll("*"))); return all.some(function (e) { return e.textContent.indexOf(' + JSON.stringify(words) + ') !== -1 && getComputedStyle(e).fontStyle === "italic"; }); }())'); };
    ok((await styleOf('zzNodeBundle')) === false, 'in plain print', 'a node\'s bundle: italic ' + (await styleOf('zzNodeBundle')));

    test.subHeading('a label changed anywhere: its tab says so');
    await home('agent.model', { op: 'set', id: M.body.id, label: 'zzModelTwo' });
    await waitTab(ICON.model + ' zzModelTwo');
    ok((await tabOf(ICON.model + ' zzModelTwo')).length === 1 && (await tabOf(ICON.model + ' zzModel')).length === 0, 'the model\'s header follows its row', 'tabs ' + short(await tabs()));

    test.subHeading('the close button takes a tab away, and the row stays');
    const closed = await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf("zzModelTwo") !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (!k) return false; k.click(); return true; }())');
    await until(function () { return tabOf(ICON.model + ' zzModelTwo').then(function (t) { return !t.length; }); }, 4000);
    ok(closed === true && (await tabOf(ICON.model + ' zzModelTwo')).length === 0, 'its tab is gone', 'tabs ' + short(await tabs()));
    ok((await home('agent.model', { op: 'get', id: M.body.id })).status === 200, 'the model is still there', 'closing its tab deleted the model');

    test.subHeading('a closed tab listens no more');
    await c.evaluate('window.__rowPath = ' + JSON.stringify('/' + Pe.body.id) + '; window.__live = 0; 1');
    await tool('persona');
    const hadPersona = (await tabOf(ICON.persona + ' zzPersona')).length === 1;
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    await until(function () { return pressRow('zzPersona'); }, 6000);
    await waitTab(ICON.persona + ' zzPersona');
    const opened = await c.evaluate('window.__live');
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    const afterClose = await c.evaluate('window.__live');
    // Two, each once: the tab follows its row, and the row's own editor (agentRow) watches the same path to repaint itself.
    ok(hadPersona && opened === 2, "opened again, the listeners of the tab and of its editor, one each", 'it had a tab ' + hadPersona + ', then ' + opened + ' listeners');
    ok(afterClose === 0, 'closed, none', afterClose + ' listeners after its tab closed');

    test.subHeading('a row deleted elsewhere closes its tab');
    const hadJob = (await tabOf(ICON.job + ' zzJob')).length === 1;
    await home('agent.job', { op: 'delete', id: J.body.id });
    await until(function () { return tabOf(ICON.job + ' zzJob').then(function (t) { return !t.length; }); }, 5000);
    ok(hadJob && (await tabOf(ICON.job + ' zzJob')).length === 0, 'the job\'s tab closes itself', hadJob ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged');
    const hadBundle = (await tabOf('zzNodeBundle')).length === 1;
    await home('auth.bundle', { op: 'delete', id: B.body.id });
    await until(function () { return tabOf('zzNodeBundle').then(function (t) { return !t.length; }); }, 5000);
    ok(hadBundle && (await tabOf('zzNodeBundle')).length === 0, 'the bundle\'s too', hadBundle ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged');

    test.subHeading('Add: "new <row-type>*", until it is saved; then it is that row\'s tab');
    await tool('provider');
    await until(function () { return press('Add a provider'); }, 6000);
    await waitTab('new provider*');
    const fresh = await tabOf('new provider*');
    ok(fresh.length === 1 && fresh[0].on, 'a tab reading "new provider*" opens, and is active', 'tabs ' + short(await tabs()));
    const filled = await c.evaluate('(function () { var box = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-content > *') + ')).filter(function (x) { return !x.hidden; })[0]; if (!box) return "no box"; var inputs = Array.prototype.slice.call(box.querySelectorAll("input")); var set = function (word, v) { var i = inputs.filter(function (x) { return x.id.slice(-word.length - 1) === "-" + word.toLowerCase(); })[0]; if (!i) return false; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); return true; }; return set("Label", "zzSaved") && set("URL", "http://192.0.2.2:9/") ? "ok" : "fields: " + box.textContent.slice(0, 200); }())');
    ok(filled === 'ok', 'its fields are filled', 'the form: ' + short(filled));
    await press('Add new Provider');
    await until(function () { return tabs().then(function (ts) { return ts.some(function (t) { return t.text.indexOf('zzSaved') !== -1; }); }); }, 6000);
    const saved = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    ok(saved.length === 1 && saved[0].on, 'saved: its header is the row\'s', 'tabs ' + short(await tabs()));
    ok((await tabOf('new provider*')).length === 0, 'and "new provider*" is gone', 'tabs ' + short(await tabs()));
    await until(function () { return pressRow('zzSaved'); }, 6000);
    await sleep(600);
    const onlyOne = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    ok(onlyOne.length === 1 && onlyOne[0].on, 'pressing that row in the list activates it: no second tab', 'tabs ' + short(await tabs()));
    const threw = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
    ok(!threw.length, 'nothing threw in the page', 'the page threw: ' + threw.slice(0, 2).join(' | '));
  } finally {
    try { if (c && c.sock) c.sock.close(); if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    try { if (c && c.profile) fs.rmSync(c.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
