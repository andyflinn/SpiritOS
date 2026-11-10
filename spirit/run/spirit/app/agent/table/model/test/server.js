'use strict';

// spirit/run/spirit/app/agent/table/model/test/server.js
// The tests of spirit/app/agent/table/model/, its server.js, elementTable.js and elementRow.js, and of no other module
// (spec: ./server.md; goal/G41.4, goal/G41.18, goal/G41.26). What the tables share is tested in ../../test/. The Update
// model list pane is gone (goal/G41.26): its Ask form sits at the top of the model list, tested here. The server is made on a scratch agent.db as nodeAgent.js
// makes it, beside the provider table it names; the page files run in node on a window of their own, the shared
// elements stubs that keep what they were handed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../../..');
require(path.join(RUN, 'spirit', 'spirit.js'));
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { DatabaseSync } = require('node:sqlite');

const DIR = path.join(__dirname, '..');
// The page's own node, as node.card answers it: a public key in base64, its + and / kept, so the data set names it in
// base64url (spirit.data.nodeId).
const HOME_KEY = 'MCowBQYDK2VwAyEA+home/node+key/for+the+page/test0000000=';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function call(verb, a) { try { return verb.handler(a); } catch (e) { return { refusal: e.refusal || 'threw', why: (e.extra && e.extra.why) || e.message }; } }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const AGENT = familyPath('agent');
// A box: its markup makes a part per id, each with its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, parts: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) { const id = /\bid="([^"]+)"/.exec(m[0]); if (id) b.parts[id[1]] = part(m[0], id[1]); }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
    appendChild: function (c) { return c; },
    addEventListener: function () {},
  };
  return b;
}
function part(tag, id) {
  const heard = {};
  const n = { tag: tag, id: id, isConnected: true, children: [], style: {}, innerHTML: '', textContent: '', className: '',
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    querySelector: function () { return null; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); } };
  return n;
}
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }
// Everything a box shows: its markup and what was written into its parts since.
function shown(b) { return b.innerHTML + Object.keys(b.parts).map(function (k) { return String(b.parts[k].innerHTML || '') + String(b.parts[k].textContent || ''); }).join(''); }

test.startTest('model/: the model table');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its files');
  const files = ['server.js', 'elementTable.js', 'elementRow.js'];
  ok(files.every(function (f) { return fs.existsSync(path.join(DIR, f)); }), 'it has server.js, elementTable.js and elementRow.js',
    'missing: ' + short(files.filter(function (f) { return !fs.existsSync(path.join(DIR, f)); })));
  if (!fs.existsSync(path.join(DIR, 'server.js'))) return;

  test.subHeading('server.js: the table in agent.db');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-model-'));
  const db = new DatabaseSync(path.join(scratch, 'agent.db'));
  const published = [];
  const ctx = { db: db, dbFile: path.join(scratch, 'agent.db'), tables: {}, publish: function (x) { published.push(x); } };
  ctx.tables.provider = require(path.join(DIR, '..', 'provider', 'server.js'))(ctx);
  const t = ctx.tables.model = require(path.join(DIR, 'server.js'))(ctx);
  ok(t && t.verb && typeof t.verb.handler === 'function' && typeof t.has === 'function', 'server.js(ctx) answers the table, its verb and has', 'answered: ' + short(t && Object.keys(t)));
  const cols = db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  // Andy, box v22: "with Label and Description, provider-key, and model-name and capabilities"; then, goal/G41.21: "i decided that model, does NOT need a name field, which i also NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the models UI."
  ['id', 'privateKey', 'sealPublicKey', 'sealPrivateKey', 'icon', 'label', 'providerId', 'capabilities'].forEach(function (c) {
    ok(cols.indexOf(c) !== -1, 'the model table has ' + c, 'columns: ' + short(cols));
  });
  ok(cols.length === 8 && cols.indexOf('modelName') === -1, 'and nothing else: no model name column, the label holds it', 'columns: ' + short(cols));

  test.subHeading('server.js: a model names a provider that is there');
  const provider = call(ctx.tables.provider.verb, { op: 'add', icon: '🏢', label: 'Anthropic', url: 'https://api.anthropic.example' });
  const added = call(t.verb, { op: 'add', label: 'claude-opus-5-5', providerId: provider.id, capabilities: ['text', 'tools'] });
  const got = added.id ? call(t.verb, { op: 'get', id: added.id }) : null;
  ok(got && got.providerId === provider.id && got.label === 'claude-opus-5-5', 'a model is added with its provider\'s id, its label the model name as the provider gives it', 'get: ' + short(got));
  ok(got && JSON.stringify(got.capabilities) === '["text","tools"]', 'its capabilities are a list', 'capabilities: ' + short(got && got.capabilities));
  const gone = require(path.join(RUN, 'spirit', 'relayAuth.js')).generateIdentity('').publicKey;
  const noProvider = call(t.verb, { op: 'add', label: 'Lost', providerId: gone });
  ok(noProvider.refusal === 'bad-request' && /no provider/.test(noProvider.why), 'a model naming a provider that is not there is refused, saying so', 'answer: ' + short(noProvider));
  ok(call(t.verb, { op: 'set', id: added.id, providerId: gone }).refusal === 'bad-request' && call(t.verb, { op: 'get', id: added.id }).providerId === provider.id,
    'and so is a set to one, the provider kept', 'set answered');

  test.subHeading('server.js: a model is shown with its provider\'s icon (goal/G41.18)');
  // Andy, box v17: "the model will [icon] \"model-name\", where the [icon] will be the provider-icon, associated with the
  // provider-key on the model row". The server says it with the row (rowTable's shows), so the
  // list draws only what the server sends (rule/19).
  call(ctx.tables.provider.verb, { op: 'set', id: provider.id, icon: '🅰' });
  const shownGet = call(t.verb, { op: 'get', id: added.id });
  ok(shownGet && shownGet.providerIcon === '🅰', 'a model\'s get carries providerIcon, the icon of its provider row', 'get: ' + short(shownGet));
  let found = null;
  try { found = JSON.parse((call(t.verb, { op: 'search', text: 'opus' }).items || [])[0].label); } catch (e) { found = null; }
  ok(found && found.providerIcon === '🅰', 'and so does each row a search finds', 'found: ' + short(found));
  // goal/G41.18, Andy: "only the ID and the fields shown in a table, that's all it needs": the model list shows the
  // provider's icon and the model name.
  ok(found && JSON.stringify(Object.keys(found).sort()) === '["id","label","providerIcon"]', 'a search answers the id and what the model list shows, the label (the model name) and the provider\'s icon, nothing else', 'found: ' + short(found && Object.keys(found)));
  published.length = 0;
  call(t.verb, { op: 'add', label: 'claude-sonnet-5-5', providerId: provider.id });
  const pub = published.filter(function (x) { return x.agent && x.agent.table === 'model' && x.agent.row; })[0];
  ok(pub && pub.agent.row.providerIcon === '🅰', 'and each model row the server publishes', 'published: ' + short(published));
  const bare = call(t.verb, { op: 'add', label: 'Bare' });
  ok(bare.id && call(t.verb, { op: 'get', id: bare.id }).providerIcon === '', 'a model with no provider has an empty providerIcon', 'get: ' + short(bare.id && call(t.verb, { op: 'get', id: bare.id })));
  const cols2 = db.prepare('PRAGMA table_info("model")').all().map(function (c) { return c.name; });
  ok(cols2.indexOf('providerIcon') === -1, 'it is shown, not kept: the model table has no providerIcon column', 'columns: ' + short(cols2));

  test.subHeading('the page: elementTable.js and elementRow.js');
  const made = { tables: [], rows: [], required: [], searches: [], busy: [], calls: [], answer: null, forms: [] };
  made.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    return function (args) { made.calls.push({ table: table, args: args }); const a = made.answer ? made.answer(table, args) : {}; return a instanceof Error ? Promise.reject(a) : Promise.resolve(a); };
  } });
  global.window = { spirit: { familyPath: familyPath, get element() { return this.elements; }, elements: nestSearch({
    // The providerSelector:dropdown and the busyButton, each tested in its own folder: stand-ins that keep what they were
    // handed, as the Update model list pane's test had them.
    'search': { create: function (host, o) { const s2 = { host: host, o: o, value: '', row: null, refresh: function () {}, destroy: function () { s2.destroyed = true; } }; made.searches.push(s2); return s2; } },
    // The one-row form (goal/G41.27), tested in its own folder: a stand-in answering { root, span, button } as the real
    // one does, its root appended to the container it is given.
    rowForm: { create: function (c, o) {
      const f = { container: c, opts: o || {}, root: part('<div>', ''), span: part('<span>', ''), button: part('<button>', '') };
      f.button.textContent = String((o && o.button) || ''); f.root.appendChild(f.span); f.root.appendChild(f.button);
      if (c && typeof c.appendChild === 'function') c.appendChild(f.root);
      made.forms.push(f); return f;
    } },
    busyButton: { attach: function (button, opts) { const a = { button: button, opts: opts || {}, answers: [] }; made.busy.push(a); button.addEventListener('click', function () { if (typeof a.opts.run === 'function') a.answers.push(a.opts.run()); }); return button; } },
    // The agent tables' shared search (../../tableElement.js, agentDetail.search), the providerSelector it makes: a
    // stand-in that hands the search element what the real one does (rule/29): its data the table's branch, as the agent
    // family's cache manager names it (spirit.data.agent.data.branch, goal/G41.28).
    agentDetail: { search: function (host, o2, more) { const E2 = global.window.spirit.element; const AD2 = ((global.window.spirit.data || {}).agent || {}).data; const s3 = E2.search.create(host, Object.assign({ server: 'agent', verb: o2.table, data: AD2 ? AD2.branch(o2.table) : '' }, more || {})); s3.refresh(); return s3; } },
    agentTable: { create: function (c, o) { made.tables.push({ c: c, o: o }); return { refresh: function () { made.refreshed = true; }, destroy: function () { made.destroyed = true; } }; } },
    agentRow: { create: function (c, o) { made.rows.push({ c: c, o: o }); return { destroy: function () {} }; } },
  }) } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { made.required.push(String(p)); return Promise.resolve(p === AGENT ? made.family : true); };
  // The page's one data set (spirit/data.js), which spirit.js brings with the client: the stream lands there, under
  // the node that served it (goal/G41.28), the page's own once node.card has answered, kept as spirit.node.key. A family's
  // cache manager is found by spirit.cacheManager(name), the real one, which in node reads it from its own disk.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  global.window.spirit.node = { key: HOME_KEY };
  global.window.spirit.data.homeNode(HOME_KEY);
  global.window.spirit.cacheManager = require(path.join(RUN, 'spirit', 'spirit.js')).cacheManager;
  ['elementTable.js', 'elementRow.js'].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(DIR, f), 'utf8'), { filename: path.join(DIR, f) }); });
  const E = global.window.spirit.elements;
  ok(E.modelTable && typeof E.modelTable.create === 'function' && E.modelRow && typeof E.modelRow.create === 'function',
    'they register spirit.elements.modelTable and modelRow', 'elements: ' + short(Object.keys(E)));
  if (!E.modelTable || !E.modelRow) return;
  const opened = [];
  const detail = { open: function (make) { opened.push(make); }, look: function (t2) { return { icon: '🧠', name: 'Model', title: 'Models', table: t2 }; } };
  const pane = box('models');
  const list = E.modelTable.create(pane, detail);
  await settle();
  ok(made.required.indexOf('spirit/app/agent/table/tableElement.js') !== -1 && made.required.indexOf('spirit/app/agent/table/model/elementRow.js') !== -1,
    'elementTable.js requires the shared element and its own row element', 'required: ' + short(made.required));
  const o = made.tables[0] && made.tables[0].o;
  ok(made.tables.length === 1 && !!made.tables[0].c && o.table === 'model' && !('api' in o) && o.detail === detail && o.add === false,
    'it builds on agentTable, in its box, for the model table, with the detail pane and no api, and no Add (Andy, on G41.18: "get RID of [Add a Model] button ... NOT required")', 'agentTable: ' + short(o && { table: o.table, add: o.add }));
  // goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon.
  const shownBy = ((o && o.columns) || []).map(function (c) { return c.from || c.field; });
  ok(JSON.stringify(shownBy) === '["providerIcon","label"]', 'its list shows each model by its provider\'s icon and its label, the model name (goal/G41.18, G41.21)', 'columns: ' + short(o && o.columns));

  test.subHeading('the Ask form at the top of 🧠 Models, the Update model list pane gone (goal/G41.26)');
  // Andy, box: "the middle pane (🧠 Update model list): The form \"from [Pick a provider ▾] [Ask]\" moves to the top of
  // the left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask]
  // button will no longer spit out a list, and simply update the agent.model table".
  ok(!((o && o.buttons) || []).some(function (b2) { return b2 && b2.label === 'provider models'; }), 'the list is handed no provider models button', 'buttons: ' + short(o && o.buttons));
  ok(!fs.existsSync(path.join(DIR, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.js')) && !fs.existsSync(path.join(__dirname, 'updatePanel.md')), 'the Update model list pane is gone: model/updatePanel.js and its test', 'still there: ' + short(['updatePanel.js', 'test/updatePanel.js', 'test/updatePanel.md'].filter(function (f) { return fs.existsSync(path.join(DIR, f)); })));
  ok(made.required.indexOf('spirit/app/agent/table/model/updatePanel.js') === -1 && !E.modelUpdate, 'and nothing loads it', 'required: ' + short(made.required));
  ok(made.required.indexOf('spirit/element/search.js') !== -1 && made.required.indexOf('spirit/element/busyButton.js') !== -1 && made.required.indexOf('spirit/element/rowForm.js') !== -1,
    'it loads what the form uses itself (rule/26): the search element, the busyButton and the rowForm', 'required: ' + short(made.required));
  // goal/G41.27, Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]": the form is a rowForm, ❓, the
  // providerSelector:dropdown in its span, Ask its button; the word from at its start goes, as new and grant did.
  const rf = made.forms[0];
  ok(made.forms.length === 1 && rf.opts.icon === '❓' && rf.opts.button === 'Ask', 'the Ask form is one rowForm, its icon ❓ and its button Ask', 'rowForms: ' + short(made.forms.map(function (f) { return f.opts; })));
  const drop = made.searches.filter(function (x) { return x.o && x.o.verb === 'provider'; })[0];
  const inSpan = !!rf && !!drop && (drop.host === rf.span || rf.span.children.indexOf(drop.host) !== -1) && rf.span.children.length <= 1;
  ok(!!drop && drop.o.face === 'dropdown' && drop.o.server === 'agent' && drop.o.data === global.window.spirit.data.nodeId(HOME_KEY) + '/agent/provider' && drop.o.placeholder === 'Pick a provider' && inSpan,
    'its span holds the providerSelector:dropdown, Pick a provider, and nothing else', 'dropdown ' + short(drop && { face: drop.o.face, verb: drop.o.verb, data: drop.o.data, placeholder: drop.o.placeholder }) + ', in the span ' + inSpan);
  ok(!/>\s*from\s*</.test(pane.innerHTML) && !/<button\b[^>]*>\s*Ask\s*</.test(pane.innerHTML), 'the word from is gone, and it draws no Ask button of its own', 'pane: ' + short(pane.innerHTML));
  const askBtn = rf ? rf.button : the(pane, 'ask');
  // At the top: the list is drawn into a part of the pane below the form, never over it.
  const listAt = made.tables[0] && made.tables[0].c && made.tables[0].c.id ? pane.innerHTML.indexOf('id="' + made.tables[0].c.id + '"') : -1;
  const formAt = rf && rf.container && rf.container.id ? pane.innerHTML.indexOf('id="' + rf.container.id + '"') : -1;
  ok(formAt !== -1 && listAt > formAt, 'the form is at the top of the pane, the model list below it', 'the form\'s box at ' + formAt + ', the list\'s box at ' + listAt);
  if (askBtn && drop) {
    askBtn.click(); await settle();
    ok(!made.calls.some(function (c) { return c.args && c.args.op === 'ask'; }), 'Ask with no provider chosen asks nothing', 'calls: ' + short(made.calls));
    drop.value = 'KP';
    made.calls.length = 0;
    made.answer = function () { return { models: [{ label: 'claude-alpha' }, { label: 'claude-beta' }], updated: true }; };
    askBtn.click(); await settle();
    ok(made.calls.length === 1 && made.calls[0].table === 'provider' && JSON.stringify(made.calls[0].args) === JSON.stringify({ op: 'ask', id: 'KP' }), 'Ask calls provider { op: ask, id } through the agent\'s interface, the provider chosen', 'calls: ' + short(made.calls));
    const after = shown(pane);
    ok(after.indexOf('claude-alpha') === -1 && after.indexOf('claude-beta') === -1 && after.indexOf('model list updated') === -1, 'and spits out no list: the model table it updated is the list below', 'shown: ' + short(after));
    const ab = made.busy.filter(function (x) { return x.button === askBtn; }).pop();
    ok(!!ab && typeof ab.opts.run === 'function', 'its Ask is a busyButton, the ask its request (goal/G41.23)', 'busyButtons: ' + made.busy.length);
    if (ab) {
      let letGo = null; let settled = false;
      made.answer = function () { return new Promise(function (r) { letGo = r; }); };
      const before = ab.answers.length;
      askBtn.click(); await settle();
      Promise.resolve(ab.answers[before]).then(function () { settled = true; }, function () { settled = true; });
      await settle();
      ok(!settled, 'the request it hands the button waits while the provider has not answered', 'settled before the answer');
      if (letGo) letGo({ models: [], updated: false });
      await settle();
      ok(settled, 'and settles once it answers', 'still waiting after the answer');
    }
  }
  list.refresh(); list.destroy();
  ok(made.refreshed && made.destroyed, 'its refresh and destroy are the shared element\'s', 'refreshed ' + made.refreshed + ', destroyed ' + made.destroyed);
  const into = { innerHTML: '' };
  o.row(into, 'KM', false);
  await settle();
  const r = made.rows[0] && made.rows[0].o;
  ok(made.rows.length === 1 && made.rows[0].c === into && r.table === 'model' && !('api' in r) && r.id === 'KM' && r.added === false,
    'a row it opens is a modelRow, built on agentRow, in the box it is handed, with its id and added, no api', 'agentRow: ' + short(r && { table: r.table, id: r.id, added: r.added }));
  ok(r && r.look && r.look.icon === '🧠' && r.look.table === 'model', 'its title row has the model table\'s look', 'look: ' + short(r && r.look));
  const provField = r && r.fields.filter(function (f) { return f.field === 'providerId'; })[0];
  // goal/G41.21, Andy: "In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for
  // that.............": the provider is shown (kind output, the provider table's row by its icon and label), never picked.
  ok(r && JSON.stringify(r.fields.map(function (f) { return [f.field, f.kind, f.pick || '']; })) === JSON.stringify([['label', 'output', ''], ['providerId', 'output', 'provider'], ['capabilities', 'output', '']]),
    'its fields are the label shown only (the model name as the provider gives it), the provider shown and never picked, and the capabilities shown only', 'fields: ' + short(r && r.fields));
  ok(provField && provField.pick === 'provider', 'the provider is picked from a search of the provider table', 'providerId: ' + short(provField));
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the scratch folder is the system's to clear */ }

  test.subHeading('elementRow.js loads the agent family\'s cache manager, which takes the model table\'s rows from the stream (goal/G41.16, G41.28)');
  // Andy: "get rid of thos FUCKING data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?": what the stream
  // means for this table, spirit/app/agent/table/data.js until G41.16, is the agent family's data.js's
  // (spirit/app/agent/data.js, goal/G41.28), loaded with the row element; it files the rows under the
  // node that served them, and is read through spirit.data.agent.data.
  {
    const DATA = global.window.spirit.data;
    const AD = ((global.window.spirit.data || {}).agent || {}).data;
    ok(!made.required.some(function (p) { return /data\.js$/.test(p); }), 'its page files require no data script', 'required: ' + short(made.required));
    const BRANCH = DATA.nodeId(HOME_KEY) + '/agent/model';
    ok(!!AD && typeof AD.branch === 'function' && AD.branch('model') === BRANCH, 'the agent family\'s cache manager is loaded: spirit.data.agent.data.branch(\'model\') is the home node\'s <node>/agent/model',
      'agentReads: ' + short(AD ? AD.branch('model') : AD));
    // With no manager loaded the check above is red; nothing below would judge anything.
    if (AD) {
      const job = function (agent, module) { return { id: 'job-agent', module: module || 'spirit.app.agent', data: {}, app: { agent: agent } }; };
      const heard = [];
      const off = DATA.watchPath(BRANCH, function (p) { heard.push(p); });
      DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'First', extra: 1 } }));
      ok(AD.row('model', 'KT') && AD.row('model', 'KT').label === 'First' && heard.indexOf(BRANCH + '/KT') !== -1, 'a model row on the stream lands at <node>/agent/model/<id>, and the branch\'s watcher hears it', 'model: ' + short(DATA.branchAt(BRANCH)));
      DATA.takeJob(job({ table: 'model', row: { id: 'KT', label: 'Renamed' } }));
      ok(AD.row('model', 'KT') && AD.row('model', 'KT').label === 'Renamed' && AD.row('model', 'KT').extra === 1, 'a changed row is merged: what it names changes, what it does not stays', 'row: ' + short(AD.row('model', 'KT')));
      DATA.takeJob(job({ table: 'model', id: 'KT', removed: true }));
      ok(!AD.row('model', 'KT') && !('KT' in DATA.branchAt(BRANCH)), 'a row removed, by its id, is gone', 'row: ' + short(AD.row('model', 'KT')));
      const before = JSON.stringify(DATA.branchAt(BRANCH));
      DATA.takeJob(job({ table: 'job', row: { id: 'KO', label: 'another table' } }));
      DATA.takeJob(job({ table: 'model', row: { id: 'KX', label: 'from the desk' } }, 'spirit.app.desk'));
      DATA.takeJob(job({ table: 'model', row: { label: 'no id' } }));
      ok(JSON.stringify(DATA.branchAt(BRANCH)) === before, 'another table\'s rows, another module\'s, and a row with no id write nothing here', 'model: ' + short(DATA.branchAt(BRANCH)));
      off();
    }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
