'use strict';
// run/spirit/testicle/run/classify/script.js        node spirit/testicle/run/classify/script.js   (from repo://run/)
// THE CLASSIFIER (goal/G50.1, box v24: "a test never says where it runs: testicle's classifier finds out and writes it
// into test/<id>/state.json"): every test is tried on both sides; a side where it answers true or false in time is a side
// it runs on, whatever the answer, and a side where it cannot load, throws or hangs is not. The sides go into runsIn.
// A TEST THAT RUNS NOWHERE IS RED, never dropped: no side would run it again, so the classifier itself says so and exits 1.
const T = require('../../script.js');
const list = T.tests();
Promise.all([T.inNode(list), T.inBrowser(list)]).then(function (got) {
  const node = got[0];
  const browser = got[1];
  list.forEach(function (t) {
    const runsIn = [];
    if (node[t] && node[t].answered) runsIn.push('node');
    if (browser.rows[t] && browser.rows[t].answered) runsIn.push('browser');
    T.writeState(t, { runsIn: runsIn });
    console.log((runsIn.length ? '       ' : 'red    ') + (runsIn.join(' and ') || 'nowhere').padEnd(18) + t + (runsIn.length ? '' : '  (' + [(node[t] || {}).reason, (browser.rows[t] || {}).reason].filter(Boolean).join(', ') + ')'));
  });
  if (browser.missing) console.log('no Chrome found: the browser side was not tried (set CHROME to its path)');
  process.exit(list.every(function (t) { return (T.readState(t).runsIn || []).length > 0; }) ? 0 : 1);
});
