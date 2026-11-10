'use strict';

// spirit/run/spirit/element/search/grant/test/grantsPanel-authSource.js
// GRANTS' DATA SOURCE IS grantsPanel'S (goal/G43.24, requirement 6; spec: ./grantsPanel-authSource.md). The box: "Still its
// own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache (GR_GRANTS). It moves into
// grantsPanel." Andy: "no i want those apps to basically be wrappers for spirit/element/ things....". grantsPanel.js read as
// it is, comments stripped.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

test.startTest('grantsPanel-authSource.js: Grants\' data source is grantsPanel\'s (goal/G43.24)');

test.subHeading('the box, 6: Grants\' data source "moves into grantsPanel"');
const panel = code(path.join(RUN, 'spirit', 'element', 'search', 'grant', 'grantsPanel.js'));
ok(panel.length > 0, 'the world: spirit/element/search/grant/grantsPanel.js is there', 'no grantsPanel.js: nothing judged');
['search', 'grant', 'revoke'].forEach(function (v) {
  ok(new RegExp('\\bauth\\W{1,4}' + v + '\\b').test(panel), 'Grants\' data source moves into grantsPanel: it asks auth.' + v, 'grantsPanel.js asks no auth.' + v);
});
ok(/\bdata\.auth\b|cacheManager\s*\(\s*['"]auth['"]/.test(panel), 'grantsPanel holds the auth cache it reads (spirit.data.auth)', 'grantsPanel.js reads no auth cache');

test.reportSuccessFailureCount();
process.exit(0);
