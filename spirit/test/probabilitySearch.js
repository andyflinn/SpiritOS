'use strict';

// spirit/test/probabilitySearch.js
// goal/G30.17: shell/js/probabilitySearch.js, the standard shell list-tool. Red on today's tree; claude-windows writes it
// and builds it (one agent). The box, in short:
//   - Taken from shell/shared/js/listSearch.js: rows kept by key in one unbounded probability bucket, a later answer
//     replacing a row with the same key; ranking as you type (probabilityStringObjectMatch times every filter's test),
//     best on top; the matched letters marked and the match bar; one call on the wire at a time, no typing pause; filters
//     declared by the app and drawn by the element.
//   - Added: a column mapping (which value field goes in which column), which defines the headers, a header being a sort
//     trigger. Column sort is client-side only, on the cached rows, combined with the filters. No count line. No
//     cut-off: a search never stops where only zero-probability rows are left.
//   - Configuration: api, server, verb; args(text, filters); columns [{ field, label, width, align, sort }]; element(row)
//     (the rowElement that draws a row); filters, matched, score, rows(), fold, empty as in listSearch. Returns
//     { refresh, redraw, words(), ask(verb, args), sort(field, direction), destroy }.
//   - Behaviour: the server's answers only feed the cache; with text in the field column sort is off and the ranking
//     orders the list; with the field empty, the cached rows stand in rows() order or the order they came, and a header
//     press sorts by its column's field, a second reverses, filters still applying. A row's field change redraws that row's
//     cells only. destroy drops every listener.
//   - Apps not yet ported keep using listSearch until none does.
// NAMED HERE where the box names none:
//   - window.spirit.elements.probabilitySearch = { create(container, options), order(entries, state) }. order is the pure
//     heart of the list: entries [{ key, row, at, gone }], state { words, values, filters, sort: { field, direction },
//     columns, matched, score } -> [{ key, row, rank }] in the order drawn. It is what the list draws from, so it is
//     what this suite holds to the box.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.17: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G30.17: probabilitySearch, the standard shell list-tool');

const window = test.withSpirit({ 'spirit.elements': {} });
const ctx = vm.createContext({ window: window, console: console, document: { addEventListener: function () {} } });
const loaded = {};
['js/probabilityStringMatch.js', 'js/probabilityStringObjectMatch.js', 'js/probabilityBucket.js', 'shell/js/probabilitySearch.js'].forEach(function (rel) {
  try { vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), ctx, { filename: rel }); loaded[rel] = true; }
  catch (e) { loaded[rel] = e.message; }
});
const PS = window.spirit.elements.probabilitySearch;

// Five files, in the order they came.
const entries = [
  { key: 'a', at: 0, row: { name: 'alpha.js', size: 300, modified: '2026-10-20T10:00:00Z', kind: 'file' } },
  { key: 'b', at: 1, row: { name: 'beta.md', size: 10, modified: '2026-10-21T09:00:00Z', kind: 'file' } },
  { key: 'c', at: 2, row: { name: 'gamma.js', size: 1200, modified: '2026-10-19T08:00:00Z', kind: 'file' } },
  { key: 'd', at: 3, row: { name: 'docs', size: 0, modified: '2026-10-18T07:00:00Z', kind: 'folder' } },
  { key: 'e', at: 4, row: { name: 'zeta.txt', size: 50, modified: '2026-10-21T11:00:00Z', kind: 'file' } },
];
const columns = [{ field: 'name', label: 'Name', sort: 'text' }, { field: 'size', label: 'Size', sort: 'number' }, { field: 'modified', label: 'Changed', sort: 'date' }];
const kindFilter = { name: 'kind', choices: [{ value: 'all' }, { value: 'file' }], test: function (row, v) { return v === 'file' && row.kind !== 'file' ? 0 : 1; } };
function keys(list) { return Array.isArray(list) ? list.map(function (x) { return x.key; }).join('') : short(list); }
function run(state) { try { return PS.order(entries, Object.assign({ words: '', values: { kind: 'all' }, filters: [kindFilter], columns: columns, sort: null }, state)); } catch (e) { return 'threw ' + e.message; } }

test.subHeading('1. with words: the ranking orders the list, column sort is off, nothing is cut at zero');
const ranked = run({ words: 'alpha', sort: { field: 'size', direction: 'asc' } });
const zeroes = Array.isArray(ranked) ? ranked.filter(function (x) { return x.rank === 0; }).length : -1;
if (PS && Array.isArray(ranked) && ranked[0] && ranked[0].key === 'a' && ranked.length === 5 && zeroes >= 1 && ranked[ranked.length - 1].rank === 0)
  test.check('"alpha" puts alpha.js first, ignores the size sort, and still lists every row that scored zero, last');
else test.fail(OWED + 'with words: ' + keys(ranked) + ' (zero-ranked ' + zeroes + '; loaded ' + short(loaded) + ')');

test.subHeading('2. with the field empty: the order rows came, or a column sort, with the filters');
const plain = run({});
const bySizeUp = run({ sort: { field: 'size', direction: 'asc' } });
const bySizeDown = run({ sort: { field: 'size', direction: 'desc' } });
const byName = run({ sort: { field: 'name', direction: 'asc' } });
const byDate = run({ sort: { field: 'modified', direction: 'desc' } });
const filesOnly = run({ values: { kind: 'file' }, sort: { field: 'size', direction: 'asc' } });
if (keys(plain) === 'abcde' && keys(bySizeUp) === 'dbeac' && keys(bySizeDown) === 'caebd' && keys(byName) === 'abdce'
    && keys(byDate) === 'ebacd' && keys(filesOnly) === 'beac')
  test.check('no sort keeps the order rows came; size sorts as numbers both ways, name as text, changed as dates; the files-only filter still applies under a sort');
else test.fail(OWED + 'plain ' + keys(plain) + ', size up ' + keys(bySizeUp) + ', size down ' + keys(bySizeDown) + ', name ' + keys(byName) + ', changed ' + keys(byDate) + ', files only ' + keys(filesOnly));

test.subHeading('3. the element, by its code');
const ps = code('shell/js/probabilitySearch.js');
const checks = {
  ownFile: !!ps,
  bucket: /createProbabilityBucket\(Infinity\)/.test(ps),
  headersSort: /data-sort/.test(ps) && /columns/.test(ps),
  noCountLine: !/match in all/.test(ps) && !/'count'/.test(ps),
  oneCall: /busy/.test(ps) && /again/.test(ps),
  elements: /\.mount\(/.test(ps) && /\.destroy\(\)/.test(ps) && /element/.test(ps),
  marksAndBar: /<mark>/.test(ps) && /spirit-match/.test(ps),
  oldStays: !!code('shell/shared/js/listSearch.js'),
  loaded: /shell\/js\/probabilitySearch\.js/.test(fs.readFileSync(path.join(RUN, 'index.html'), 'utf8')),
};
const missing = Object.keys(checks).filter(function (k) { return !checks[k]; });
if (!missing.length)
  test.check('its own file in shell/js, one unbounded bucket, headers that sort, no count line, one call on the wire, rowElements mounted and destroyed, marks and the match bar, listSearch kept, loaded by index.html');
else test.fail(OWED + 'missing: ' + missing.join(', '));

test.reportSuccessFailureCount();
process.exit(0);
