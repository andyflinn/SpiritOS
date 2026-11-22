'use strict';
// run/spirit/testicle/run/node/script.js             node spirit/testicle/run/node/script.js   (from repo://run/)
// THE NODE SIDE (goal/G50.1, box v24): every test whose state.json says it runs in node, run in this process through
// runTest; each result written back into that state.json as node { green, ms, at, reason? }. Exit 0 when all are green.
const T = require('../../script.js');
const list = T.tests().filter(function (t) { return (T.readState(t).runsIn || []).indexOf('node') !== -1; });
T.inNode(list).then(function (rows) {
  list.forEach(function (t) { T.writeState(t, { node: T.stamp(rows[t]) }); });
  T.report('node', rows);
  process.exit(list.every(function (t) { return rows[t].green; }) ? 0 : 1);
});
