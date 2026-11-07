'use strict';

// spirit/run/test/test/testSupport.js
// THE PRETEND NODE READS A FAMILY'S api.js WHERE THE FAMILY KEEPS IT (goal/G43.23, item 12; spec: ./testSupport.md). The
// box: "the pretend node in testSupport reads a family's api.js from the old place."
//
// spirit/test/testSupport.js's nodeApi, the pretend node's answer to api {family}, asked for every family of the tree:
// a node family keeps its api.js at spirit/run/spirit/<family>/api.js, a server's at the one family path,
// spirit.familyPath(<family>) (process/js/<family>/family/api.js). Read only; no node is asked.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const support = require(path.join(REPO, 'spirit', 'test', 'testSupport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function ask(f) { try { return support.nodeApi({ call: 'api', args: { family: f } }); } catch (e) { return { thrown: String(e && e.message || e) }; } }

// Where each family keeps its api.js today, found on disk, the path written as spirit.js's familyPath writes it.
const FAMILY_PATH = function (n) { return 'process/js/' + n + '/family/api.js'; };
const servers = fs.readdirSync(path.join(RUN, 'process', 'js')).filter(function (n) { return /^[A-Za-z]\w*$/.test(n) && fs.existsSync(path.join(RUN, FAMILY_PATH(n))); });
const nodes = fs.readdirSync(path.join(RUN, 'spirit')).filter(function (n) { return /^[A-Za-z]\w*$/.test(n) && fs.existsSync(path.join(RUN, 'spirit', n, 'api.js')); });

test.startTest('spirit/test/testSupport.js: the pretend node answers api {family} from where the family keeps its api.js (goal/G43.23 item 12)');

test.subHeading('the world');
ok(servers.length > 0, 'the world: ' + servers.length + ' servers keep their api.js at the family path: ' + servers.join(', '), 'no server keeps an api.js at process/js/<name>/family/api.js: nothing judged');
ok(nodes.length > 0, 'the world: ' + nodes.length + ' node families keep theirs at spirit/run/spirit/<name>/api.js', 'no node family found: nothing judged');
ok(typeof support.nodeApi === 'function', 'the world: testSupport.js has its pretend node\'s nodeApi', 'testSupport.js has no nodeApi: nothing judged');
const none = ask('noSuchFamilyAtAll');
ok(none && none.status === 404, 'the world: a family nobody keeps is answered 404', 'a family nobody keeps was answered ' + short(none));

test.subHeading('a server\'s family, from the family path');
servers.forEach(function (n) {
  const r = ask(n);
  const text = fs.readFileSync(path.join(RUN, FAMILY_PATH(n)), 'utf8');
  ok(r && r.status === 200 && r.body && r.body.interface === text, n + ' is answered with the text of ' + FAMILY_PATH(n), n + ' was answered ' + short(r));
});

test.subHeading('a node family, from spirit/run/spirit/<name>/');
nodes.forEach(function (n) {
  const r = ask(n);
  const text = fs.readFileSync(path.join(RUN, 'spirit', n, 'api.js'), 'utf8');
  ok(r && r.status === 200 && r.body && r.body.interface === text, n + ' is answered with the text of spirit/' + n + '/api.js', n + ' was answered ' + short(r));
});

test.reportSuccessFailureCount();
process.exit(0);
