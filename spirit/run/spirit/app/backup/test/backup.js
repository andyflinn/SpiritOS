'use strict';

// spirit/run/spirit/app/backup/test/backup.js
// The tests of spirit/app/backup/backup.js, and of no other module (spec: ./backup.md; goal/G48.5, the box, naming: "an app's server
// portion MUST be spirit/app/<name>/server/server.js ... spirit/app/<name>/<name>.js stays what the node starts and loads
// ./server/server.js on the node"; "each <name>.js loader keeps its own" test). The server's own tests: ../server/test/server.js.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const FILE = path.join(RUN, 'spirit', 'app', 'backup', 'backup.js');
const SERVER = 'spirit/app/backup/server/server.js';

function code() { let t = ''; try { t = fs.readFileSync(FILE, 'utf8'); } catch (e) { return ''; } return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
const W = { node: null };
test.after(function () { if (W.node) { try { if (W.node.child) W.node.child.kill(); } catch (e) { /* gone */ } try { H.freeTree(W.node); } catch (e) { /* freed when this process ends */ } } });

test.run('spirit/app/backup/backup.js is there and takes spirit.js first', 0.2, function () {
  const c = code();
  const first = c.search(/require(?:Script)?\(|spirit\.requireScript\(/);
  return (!!c && first !== -1 && c.slice(first).indexOf("require('../../manager/script.js')") === 0) || false;
}, test.limit.quick);
test.run('what it loads is its server, spirit/app/backup/server/server.js, and nothing else', 0.4, function () {
  const c = code();
  const loads = (c.match(/(?:spirit\.)?require(?:Script)?\(\s*['"][^'"]+['"]\s*\)/g) || []).filter(function (r) { return r.indexOf('spirit.js') === -1 && r.indexOf("'../../manager/script.js'") === -1; }); // the spirit object, spirit/script.js since goal/G49.12, is no second load
  return (loads.length === 1 && loads[0].indexOf(SERVER) !== -1) || false;
}, test.limit.quick);
test.run('on a node with backup switched on, the server it loads answers its DEBUG verb', 0.4, async function () {
  W.node = await H.scratchNode({ servers: ['spirit.app.backup'] });
  if (!W.node || !W.node.up) return false;
  // Its verb by the app's id, its folder's path in dots (goal/G49.19).
  const ok = await H.until(function () {
    return fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.app.backup.DEBUG', args: {} }) })
      .then(function (r) { return r.status === 200; }, function () { return false; });
  }, 60000);
  return !!ok || false;
}, test.limit.long, { why: 'it starts a scratch node with backup on' });
