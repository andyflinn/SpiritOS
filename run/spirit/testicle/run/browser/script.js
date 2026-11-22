'use strict';
// run/spirit/testicle/run/browser/script.js          node spirit/testicle/run/browser/script.js   (from repo://run/)
// THE BROWSER SIDE (goal/G50.1, box v24): every test whose state.json says it runs in the browser, run by the page beside
// this file in headless Chrome, served by a server of this tree on a free port; each result written back into that
// state.json as browser { green, ms, at, reason? }. Exit 0 when all are green.
const T = require('../../script.js');
const list = T.tests().filter(function (t) { return (T.readState(t).runsIn || []).indexOf('browser') !== -1; });
T.inBrowser(list).then(function (got) {
  if (got.missing) { console.log('no Chrome found: set CHROME to its path'); process.exit(1); }
  const rows = {};
  list.forEach(function (t) { rows[t] = got.rows[t] || { answered: false, green: false, ms: 0, reason: 'no-row' }; T.writeState(t, { browser: T.stamp(rows[t]) }); });
  T.report('browser', rows);
  process.exit(list.every(function (t) { return rows[t].green; }) ? 0 : 1);
});
