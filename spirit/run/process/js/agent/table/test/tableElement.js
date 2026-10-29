'use strict';

// spirit/run/process/js/agent/table/test/tableElement.js
// The tests of process/js/agent/table/tableElement.js, and of no other module (spec: ./tableElement.md; goal/G41.4, goal/G41.18).
// The browser file runs in node on a window of its own, over the real spirit.data (shell/js/spiritData.js). The boxes,
// the probabilitySearch element, the icon selector and the agent server's interface are stubs that keep what was asked
// of them; the agent server answers as rowTable.js does.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const familyPath = require(path.join(RUN, 'spirit.js')).familyPath;

const FILE = path.join(__dirname, '..', 'tableElement.js');
const AGENT = familyPath('agent');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function load(file) { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A box: its markup makes a part per id, each with its tag's value and its own listeners; a new markup makes new parts.
function box(name) {
  let html = '';
  const b = { name: name, className: '', style: {}, parts: {}, isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); b.parts = {};
      const re = /<([a-z]+)\b[^>]*>/gi; let m;
      while ((m = re.exec(html))) {
        const id = /\bid="([^"]+)"/.exec(m[0]);
        if (id) b.parts[id[1]] = part(m[0]);
      }
    },
    get textContent() { return html.replace(/<[^>]*>/g, ''); },
    set textContent(v) { html = String(v); b.parts = {}; },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? b.parts[sel.slice(1)] || null : null; },
    appendChild: function (c) { return c; },
    addEventListener: function () {},
  };
  return b;
}
function part(tag) {
  const heard = {};
  const value = /\svalue="([^"]*)"/.exec(tag);
  const n = { tag: tag, value: value ? value[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '',
    checked: /\schecked(\s|>)/.test(tag), isConnected: true, textContent: '', children: [], className: '', style: {},
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    appendChild: function (c) { n.children.push(c); return c; },
    click: function () { (heard.click || []).slice().forEach(function (fn) { fn({}); }); } };
  return n;
}
// The parts of a box whose id ends in the given name.
function the(b, end) { const k = Object.keys(b.parts).filter(function (id) { return id.slice(-end.length - 1) === '-' + end; })[0]; return k ? b.parts[k] : null; }

// The world: the agent server's interface answering as rowTable.js does, the searches made, the icon selectors made.
function world() {
  const w = { calls: [], searches: [], icons: [], required: [], answer: null };
  // Not a thenable: Promise.resolve hands the interface itself on.
  w.family = new Proxy({}, { get: function (o, table) {
    if (table === 'then') return undefined;
    return function (args) {
      w.calls.push({ table: table, args: args });
      const a = w.answer ? w.answer(table, args) : { id: 'KNEW' };
      return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
    };
  } });
  return w;
}
function refused(why) { const e = new Error('no-such-argument'); e.body = { ok: false, error: 'no-such-argument', extra: { why: why } }; return e; }

test.startTest('tableElement.js: what the tables\' elements share');

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('process/js/agent/table/tableElement.js is not there'); return; }
  const w = world();
  global.window = { spirit: { elements: {}, familyPath: familyPath, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  load(path.join(RUN, 'shell', 'js', 'spiritData.js'));
  const D = global.window.spirit.data;
  global.window.spirit.require = function (p) {
    w.required.push(String(p));
    return Promise.resolve(p === AGENT ? w.family : true);
  };
  global.window.spirit.elements.probabilitySearch = { create: function (host, o) {
    const s = { host: host, o: o, refreshed: 0, destroyed: false, value: '', row: null,
      refresh: function () { s.refreshed += 1; }, destroy: function () { s.destroyed = true; } };
    w.searches.push(s); return s;
  } };
  global.window.spirit.elements.createIconSelector = function (o, opts) { const sel = { value: (opts && opts.value) || '', opts: opts }; w.icons.push(sel); return sel; };
  load(FILE);
  const E = global.window.spirit.elements;
  ok(E.agentTable && typeof E.agentTable.create === 'function' && E.agentRow && typeof E.agentRow.create === 'function',
    'it registers spirit.elements.agentTable and agentRow, each with create', 'elements: ' + short(Object.keys(E)));
  const AD = E.agentDetail || {};
  ok(['titleRow', 'fieldLine', 'search', 'branchOf', 'whyOf'].every(function (k) { return typeof AD[k] === 'function'; }) && typeof AD.stretch === 'string',
    'and spirit.elements.agentDetail { titleRow, fieldLine, stretch, search, branchOf, whyOf }, every pane\'s look in one place', 'agentDetail: ' + short(Object.keys(AD)));
  // goal/G41.16, Andy: "get rid of thos FUCKING data.js scripts": each table's row element takes its own rows from the
  // stream; the shared element loads no data script.
  ok(!w.required.some(function (p) { return /data\.js$/.test(p); }), 'it requires no data script: each table\'s row element takes its own rows from the stream (goal/G41.16)', 'required: ' + short(w.required));
  if (!E.agentTable || !E.agentRow || !AD.titleRow) return;

  test.subHeading('the shared pieces');
  const tr = AD.titleRow({ icon: '🏢' }, ['Add', 'Provider']);
  ok(/class="agent-title"/.test(tr) && tr.indexOf('🏢') !== -1 && /<b>Add<\/b>/.test(tr) && /<span>Provider<\/span>/.test(tr),
    'titleRow(look, words): the agent-title row, its icon, then the words, each in a part of its own', 'titleRow: ' + short(tr));
  ok(/font-size:1\.3em/.test(tr) && /font-weight:600/.test(tr), 'set as a title, bigger and semibold (Andy: "a bit more title-like a bit bigger")', 'titleRow: ' + short(tr));
  ok(AD.titleRow({ icon: '<x>' }, ['a&b']).indexOf('<x>') === -1, 'and escapes what it shows', 'titleRow: ' + short(AD.titleRow({ icon: '<x>' }, ['a&b'])));
  const fl = AD.fieldLine('L', '<input>');
  ok(/display:flex/.test(fl) && /gap:1em/.test(fl) && /flex:1 1 0/.test(fl), 'fieldLine(label, input): the label, 1em, then the input to the right edge', 'fieldLine: ' + short(fl));
  ok(AD.branchOf('job') === 'agent.job', 'branchOf(table) is agent.<table>', 'branchOf: ' + short(AD.branchOf('job')));
  ok(AD.whyOf(refused('job takes no argument verb')) === 'job takes no argument verb' && AD.whyOf(new Error('bad')) === 'bad' && AD.whyOf(null) === 'refused',
    'whyOf(refusal) is the server\'s own reason, else the refusal\'s words, else refused', 'whyOf: ' + short([AD.whyOf(refused('x')), AD.whyOf(new Error('bad')), AD.whyOf(null)]));

  test.subHeading('a table: its title row, its Add button, its list shown at once');
  const opened = [];
  const detail = {
    center: box('center'),
    open: function (make) { detail.center.innerHTML = ''; opened.push(make(detail.center)); },
    look: function (t) { return { icon: '🏢', name: 'Provider', title: 'Model providers' }; },
  };
  const rows = [];
  const left = box('left');
  const t = E.agentTable.create(left, { api: { stub: true }, table: 'provider', detail: detail, row: function (b, key, added, row) { rows.push({ box: b, key: key, added: added, row: row }); return { destroy: function () {} }; } });
  await settle();
  ok(left.innerHTML.indexOf('Model providers') !== -1 && left.innerHTML.indexOf('🏢') !== -1 && /class="agent-title"/.test(left.innerHTML),
    'its title row is the table\'s icon and its title, from the detail pane\'s look', 'left: ' + short(left.innerHTML));
  ok(the(left, 'add') && /Add a provider/.test(left.innerHTML), 'it has an Add button', 'left: ' + short(left.innerHTML));
  const list = w.searches[0];
  ok(list && list.host === the(left, 'list') && list.refreshed >= 1, 'its list is a probabilitySearch in its own box, searched as it is made (Andy: "must be immediately shown")',
    'searches: ' + w.searches.length + ', refreshed ' + (list && list.refreshed));
  if (!list) return;
  ok(list.o.server === 'agent' && list.o.verb === 'provider' && list.o.data === 'agent.provider', 'it searches the agent server\'s provider verb, seated in the branch agent.provider of spirit.data',
    'search: ' + short({ server: list.o.server, verb: list.o.verb, data: list.o.data }));
  ok(JSON.stringify(list.o.args('ab')) === JSON.stringify({ op: 'search', text: 'ab' }), 'its search asks { op: search, text }', 'args: ' + short(list.o.args('ab')));
  ok(JSON.stringify((list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]', 'every row is shown by its icon and its label alone (Andy: "will only show: icon and label")',
    'columns: ' + short(list.o.columns));
  ok(list.o.name({ icon: '🏢', label: 'One' }) === '🏢 One', 'a row\'s name is its icon and its label, as a picker shows it', 'name: ' + short(list.o.name({ icon: '🏢', label: 'One' })));

  test.subHeading('a row picked opens its editor in the detail pane');
  list.o.pick({ id: 'KP', label: 'One' }, 'KP');
  ok(rows.length === 1 && rows[0].box === detail.center && rows[0].key === 'KP' && rows[0].added === false && rows[0].row.label === 'One',
    'pick opens row(box, key, false, row) in the detail pane', 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; })));

  test.subHeading('Add asks the server, and opens the new row');
  w.calls.length = 0;
  w.answer = function () { return { id: 'KNEW' }; };
  the(left, 'add').click(); await settle();
  ok(w.calls.length === 1 && w.calls[0].table === 'provider' && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'add', icon: '🏢' }),
    'Add calls provider { op: add, icon } through the agent\'s interface, the new row taking its table\'s icon', 'calls: ' + short(w.calls));
  ok(rows.length === 2 && rows[1].key === 'KNEW' && rows[1].added === true, 'and opens the new row\'s editor, added', 'rows: ' + short(rows.map(function (r) { return { key: r.key, added: r.added }; })));
  w.answer = function () { return refused('provider: label must be a name'); };
  the(left, 'add').click(); await settle();
  ok(the(left, 'note').textContent === 'Not added: provider: label must be a name' && rows.length === 2, 'a refused Add says the server\'s reason, and opens nothing',
    'note: ' + short(the(left, 'note').textContent));

  test.subHeading('a table may make its own Add');
  w.calls.length = 0;
  const own = [];
  const left2 = box('left2');
  E.agentTable.create(left2, { api: {}, table: 'grant', detail: detail, add: function (open) { own.push(open); }, row: function () { return {}; } });
  await settle();
  the(left2, 'add').click(); await settle();
  ok(own.length === 1 && typeof own[0] === 'function' && w.calls.length === 0, 'given add(open), Add calls it and asks the server nothing', 'add called ' + own.length + ', calls ' + short(w.calls));

  test.subHeading('a table may hand its own buttons, and its own columns (goal/G41.18)');
  // The model table's button row holds "provider models" (box v17), and its list shows "[icon] \"model-name\"", the
  // provider's icon: what a table hands, the shared element draws.
  const pressed = [];
  const left3 = box('left3');
  const COLS = [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }];
  const n3 = w.searches.length;
  E.agentTable.create(left3, { api: {}, table: 'model', detail: detail, row: function () { return {}; }, columns: COLS,
    buttons: [{ label: 'provider models', press: function () { pressed.push('provider models'); } }] });
  await settle();
  const b0 = the(left3, 'button0');
  ok(!!b0 && left3.innerHTML.indexOf('provider models') !== -1 && !!the(left3, 'add'), 'each button is drawn on the Add line, by its label, Add kept', 'left3: ' + short(left3.innerHTML));
  if (b0) b0.click();
  ok(pressed.length === 1, 'a button pressed calls its press()', 'pressed: ' + short(pressed));
  const l3 = w.searches[n3];
  ok(l3 && l3.o.columns === COLS, 'the columns a table hands are the list\'s, in place of icon and label', 'columns: ' + short(l3 && l3.o.columns));
  ok(JSON.stringify((list.o.columns || []).map(function (c) { return c.field; })) === '["icon","label"]', 'a table that hands none keeps icon and label', 'columns: ' + short(list.o.columns));

  test.subHeading('a table may have no Add (goal/G41.18)');
  w.calls.length = 0;
  const left4 = box('left4');
  E.agentTable.create(left4, { api: {}, table: 'model', detail: detail, add: false, row: function () { return {}; },
    buttons: [{ label: 'provider models', press: function () {} }] });
  await settle();
  ok(!the(left4, 'add') && !/Add a model/.test(left4.innerHTML) && !!the(left4, 'button0') && /class="agent-title"/.test(left4.innerHTML),
    'given add false, no Add is drawn; its buttons and title row are', 'left4: ' + short(left4.innerHTML));

  test.subHeading('destroy');
  t.destroy();
  ok(list.destroyed && left.innerHTML === '', 'destroy destroys the list and empties the box', 'destroyed ' + list.destroyed + ', box ' + short(left.innerHTML));

  test.subHeading('a row\'s editor: from the server\'s get, put where the stream writes it');
  const FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'url', label: 'URL', kind: 'url' }, { field: 'apiKey', label: 'API key', kind: 'secret' },
    { field: 'on', label: 'On', kind: 'bool' }, { field: 'tags', label: 'Tags', kind: 'list' }];
  const ROW = { id: 'KR', icon: '', label: 'Row one', url: 'https://one.example', apiKeySet: true, on: true, tags: ['a', 'b'] };
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? Object.assign({}, ROW) : { id: 'KR' }; };
  const ed = box('editor');
  const look = { icon: '🏢', name: 'Provider' };
  const r = E.agentRow.create(ed, { api: {}, table: 'provider', id: 'KR', added: true, look: look, fields: FIELDS });
  await settle();
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'get', id: 'KR' }), 'with the row not in its branch, it asks provider { op: get, id }', 'calls: ' + short(w.calls));
  ok(D.get('agent.provider/KR') && D.get('agent.provider/KR').label === 'Row one', 'and puts the answer at agent.provider/<id>, where the stream writes it', 'branch: ' + short(D.get('agent.provider/KR')));
  ok(/<b>Add<\/b>/.test(ed.innerHTML) && ed.innerHTML.indexOf('Provider') !== -1, 'its title row says Add while the row is new', 'title: ' + short(ed.innerHTML.slice(0, 200)));
  const ids = Object.keys(ed.parts).map(function (k) { return k.replace(/^ar\d+-/, ''); });
  ok(ids.indexOf('icon') !== -1 && ids.indexOf('icon') < ids.indexOf('label'), 'the icon is its first field, before the ones the table names (Andy: "the detail panel\'s first input will be the icon")',
    'fields: ' + short(ids));
  ok(the(ed, 'label').value === 'Row one' && the(ed, 'url').value === 'https://one.example' && the(ed, 'on').checked === true && the(ed, 'tags').value === 'a, b',
    'each field shows the row: a line its value, a bool its tick, a list its words split by commas', 'fields: ' + short({ label: the(ed, 'label').value, url: the(ed, 'url').value, on: the(ed, 'on').checked, tags: the(ed, 'tags').value }));
  ok(/type="password"/.test(the(ed, 'apiKey').tag) && the(ed, 'apiKey').value === '' && /set; type to replace/.test(the(ed, 'apiKey').tag),
    'a secret is an empty password box that says only whether it is set', 'secret: ' + short(the(ed, 'apiKey').tag));
  const sel = w.icons[w.icons.length - 1];
  ok(sel && sel.value === '🏢', 'the icon chooser is the shell\'s icon selector, on the table\'s icon while the row has none', 'icon selector: ' + short(sel && sel.opts));

  test.subHeading('the editor follows its row in spirit.data');
  D.merge('agent.provider/KR', { label: 'From the stream' });
  await settle();
  ok(the(ed, 'label').value === 'From the stream', 'a row written to its path shows at once: nothing listens by hand', 'label: ' + short(the(ed, 'label').value));

  test.subHeading('Save proposes only what was changed');
  w.calls.length = 0;
  the(ed, 'label').value = 'Typed';
  the(ed, 'save').click(); await settle();
  // The row has no icon of its own, so the table's, which its chooser shows, is saved with it (Andy: "all table rows will
  // have an icon, by default the tables icon").
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'set', id: 'KR', icon: '🏢', label: 'Typed' }),
    'Save calls provider { op: set, id } with the changed label and the icon shown: an empty secret and an unchanged field are not sent', 'calls: ' + short(w.calls));
  ok(D.get('agent.provider/KR').label === 'From the stream', 'it draws nothing it typed into the row: the row changes only by the server\'s stream (rule/19)', 'branch: ' + short(D.get('agent.provider/KR')));
  ok(/Saved\./.test(ed.innerHTML) && /<b>Change<\/b>/.test(ed.innerHTML), 'a Save taken says Saved., and the title says Change from then on', 'editor: ' + short(ed.innerHTML.slice(-200)));
  w.calls.length = 0;
  the(ed, 'apiKey').value = 'sk-new';
  the(ed, 'save').click(); await settle();
  ok(w.calls.length === 1 && w.calls[0].args.apiKey === 'sk-new', 'a secret typed is sent', 'calls: ' + short(w.calls));
  w.calls.length = 0;
  w.answer = function () { return refused('provider: url must be a url'); };
  the(ed, 'url').value = 'not a url';
  the(ed, 'save').click(); await settle();
  ok(the(ed, 'note').textContent === 'Not saved: provider: url must be a url' || /Not saved: provider: url must be a url/.test(ed.innerHTML),
    'a refused Save says the server\'s reason', 'note: ' + short(ed.innerHTML.slice(-200)));

  test.subHeading('Delete proposes; the stream says it is gone');
  w.calls.length = 0;
  w.answer = function () { return { id: 'KR' }; };
  the(ed, 'delete').click(); await settle();
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'delete', id: 'KR' }), 'Delete calls provider { op: delete, id }', 'calls: ' + short(w.calls));
  D.del('agent.provider/KR'); await settle();
  ok(/Deleted\./.test(ed.innerHTML), 'and once the row is deleted from its branch, the editor says Deleted.', 'editor: ' + short(ed.innerHTML));

  test.subHeading('a row already in its branch is read whole by get (goal/G41.18)');
  // A search answers only what a list shows (Andy: "only the ID and the fields shown in a table"), so a row in the branch
  // may be that slim row: the editor asks get as it opens, whatever the branch holds (Andy: "that exactly what GET is
  // for, to bring in the rest for detail panels etc...").
  w.calls.length = 0;
  w.answer = function (table, a) { return a.op === 'get' ? { id: 'KS', icon: '🧪', label: 'Seated', url: 'https://whole.example', apiKeySet: false } : { id: 'KS' }; };
  D.set('agent.provider/KS', { id: 'KS', icon: '🧪', label: 'Seated' });
  const ed2 = box('editor2');
  const r2 = E.agentRow.create(ed2, { api: {}, table: 'provider', id: 'KS', added: false, look: look, fields: FIELDS });
  await settle();
  ok(w.calls.length === 1 && JSON.stringify(w.calls[0].args) === JSON.stringify({ op: 'get', id: 'KS' }), 'it asks provider { op: get, id }, though the branch holds a row', 'calls ' + short(w.calls));
  ok(D.get('agent.provider/KS') && D.get('agent.provider/KS').url === 'https://whole.example' && the(ed2, 'url') && the(ed2, 'url').value === 'https://whole.example',
    'and the whole row goes where the stream writes it, its fields shown', 'branch: ' + short(D.get('agent.provider/KS')));
  ok(the(ed2, 'label').value === 'Seated' && /<b>Change<\/b>/.test(ed2.innerHTML), 'it says Change when opened from the list', 'label ' + short(the(ed2, 'label') && the(ed2, 'label').value));
  ok(w.icons[w.icons.length - 1].value === '🧪', 'the icon chooser shows the row\'s own icon', 'icon: ' + short(w.icons[w.icons.length - 1].value));
  r2.destroy();
  D.merge('agent.provider/KS', { label: 'After' }); await settle();
  ok(ed2.innerHTML === '', 'destroyed, it empties its box and hears its row no more', 'editor2: ' + short(ed2.innerHTML));
  r.destroy();
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
