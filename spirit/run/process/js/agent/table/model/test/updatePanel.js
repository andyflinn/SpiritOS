'use strict';

// spirit/run/process/js/agent/table/model/test/updatePanel.js
// The tests of process/js/agent/table/model/updatePanel.js, and of no other module (spec: ./updatePanel.md;
// goal/G41.18). The browser file runs in node on a window of its own, over the real shared table element
// (../../tableElement.js) and the real spirit.data; the boxes, the probabilitySearch element and the agent server's
// interface are stubs that keep what was asked of them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'updatePanel.js');
const AGENT = familyPath('agent');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// A box: its markup makes a part per id, each with its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, parts: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) { const id = /\bid="([^"]+)"/.exec(m[0]); if (id) b.parts[id[1]] = part(m[0]); }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
    appendChild: function (c) { return c; },
    addEventListener: function () {},
  };
  return b;
}
function part(tag) {
  const heard = {};
  const n = { tag: tag, isConnected: true, children: [], style: {}, innerHTML: '', textContent: '',
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); } };
  return n;
}
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }
// Everything the panel shows: its markup and what it wrote into its parts since.
function shown(b) { return b.innerHTML + Object.keys(b.parts).map(function (k) { return String(b.parts[k].innerHTML || '') + String(b.parts[k].textContent || ''); }).join(''); }

test.startTest('model/updatePanel.js: the Update model list pane');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('process/js/agent/table/model/updatePanel.js is not there'); return; }
  const w = { calls: [], searches: [], required: [], answer: null };
  w.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    return function (args) {
      w.calls.push({ table: table, args: args });
      const a = w.answer ? w.answer(table, args) : {};
      return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
    };
  } });
  global.window = { spirit: { elements: {}, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  load(path.join(RUN, 'shell', 'js', 'spiritData.js'));
  global.window.spirit.require = function (p) {
    w.required.push(String(p));
    if (p === 'process/js/agent/table/tableElement.js' && !global.window.spirit.elements.agentDetail) load(path.join(__dirname, '..', '..', 'tableElement.js'));
    return Promise.resolve(p === AGENT ? w.family : true);
  };
  global.window.spirit.elements.probabilitySearch = { create: function (host, o) {
    const s = { host: host, o: o, refreshed: 0, destroyed: false, value: '', row: null,
      refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } };
    w.searches.push(s); return s;
  } };
  load(FILE);
  await settle();
  const E = global.window.spirit.elements;
  ok(E.modelUpdate && typeof E.modelUpdate.create === 'function', 'it registers spirit.elements.modelUpdate.create', 'elements: ' + short(Object.keys(E)));
  if (!E.modelUpdate || typeof E.modelUpdate.create !== 'function') return;

  test.subHeading('its title, and its form: from [provider] [Ask]');
  const api = { stub: true };
  const detail = { open: function () {}, look: function (t) { return { icon: '🧠', name: 'Model', title: 'Models', table: t }; } };
  const centre = box('centre');
  const pane = E.modelUpdate.create(centre, api, detail);
  await settle();
  ok(w.required.indexOf('process/js/agent/table/tableElement.js') !== -1 && w.required.indexOf('shell/js/probabilitySearch.js') !== -1,
    'it loads what it uses itself (rule/26): the shared table element and the search element', 'required: ' + short(w.required));
  // Andy, box v17: "the title of the new center-pane is: \"🧠 Update model list\"".
  ok(/class="agent-title"/.test(centre.innerHTML) && centre.innerHTML.indexOf('🧠') !== -1 && centre.innerHTML.indexOf('Update model list') !== -1,
    'its title row is the panes\' title row: 🧠 Update model list', 'centre: ' + short(centre.innerHTML));
  // "then a form row: from [provider-dropdown] [ask-Button]".
  const drop = w.searches.filter(function (s) { return s.o && s.o.verb === 'provider'; })[0];
  ok(/>\s*from\s*</.test(centre.innerHTML) && drop && drop.o.face === 'dropdown' && drop.o.data === 'agent.provider' && drop.o.server === 'agent',
    'from, then a dropdown search of the provider table, the pickers\' own (agentDetail.search)', 'dropdown: ' + short(drop && { face: drop.o.face, data: drop.o.data, verb: drop.o.verb }));
  const askBtn = the(centre, 'ask');
  ok(!!askBtn && /<button\b[^>]*id="[^"]*-ask"[^>]*>\s*Ask\s*</.test(centre.innerHTML), 'then the Ask button', 'centre: ' + short(centre.innerHTML));
  if (!drop || !askBtn) return;

  test.subHeading('Ask with no provider chosen asks nothing');
  askBtn.click(); await settle();
  ok(!w.calls.some(function (c) { return c.args && c.args.op === 'ask'; }), 'no provider picked: nothing is asked', 'calls: ' + short(w.calls));

  test.subHeading('Ask asks the provider table, and shows the list it answers');
  // "when a provider is selected. The ask button will ask the provider for a model-list, which is then shown below the
  // the ask form above, with a remark \"model list updated.\"".
  drop.value = 'KP';
  w.calls.length = 0;
  w.answer = function () { return { models: [{ modelName: 'claude-a', label: 'Claude A' }, { modelName: 'claude-b', label: 'Claude <B>' }], updated: true }; };
  askBtn.click(); await settle();
  ok(w.calls.length === 1 && w.calls[0].table === 'provider' && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'ask', id: 'KP' }),
    'it calls provider { op: ask, id } through the agent\'s interface, the provider picked', 'calls: ' + short(w.calls));
  const s1 = shown(centre);
  ok(s1.indexOf('Claude A') !== -1 && s1.indexOf('claude-a') !== -1 && s1.indexOf('claude-b') !== -1, 'the list answered is shown below the form, each model by its label and its model name', 'shown: ' + short(s1));
  ok(s1.indexOf('Claude <B>') === -1 && s1.indexOf('Claude &lt;B&gt;') !== -1, 'escaped', 'shown: ' + short(s1));
  ok(s1.indexOf('model list updated.') !== -1, 'with the remark model list updated.', 'shown: ' + short(s1));

  test.subHeading('an empty list, or a refusal, is said, and is no update');
  // The pane may draw itself again after an answer: its Ask button is found again before each press.
  const press = function () { (the(centre, 'ask') || askBtn).click(); };
  w.answer = function () { return { models: [], updated: false }; };
  press(); await settle();
  const s2 = shown(centre);
  ok(s2.indexOf('model list updated.') === -1, 'a list of no models has no remark model list updated.', 'shown: ' + short(s2));
  w.answer = function () { const e = new Error('refused'); e.body = { ok: false, error: 'provider-failed', extra: { why: 'provider: Unsloth did not answer' } }; return e; };
  press(); await settle();
  const s3 = shown(centre);
  ok(s3.indexOf('provider: Unsloth did not answer') !== -1 && s3.indexOf('model list updated.') === -1, 'a refused ask says the server\'s reason, and no remark', 'shown: ' + short(s3));
  ok(s3.indexOf('claude-a') === -1, 'and the list of an earlier ask is no longer shown', 'shown: ' + short(s3));

  test.subHeading('destroy');
  pane.destroy();
  ok(drop.destroyed === true && centre.innerHTML === '', 'destroy destroys the dropdown and empties the pane', 'destroyed ' + drop.destroyed + ', centre ' + short(centre.innerHTML));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
