'use strict';

// spirit/run/spirit/test/coreFiles.js
// The tests of spirit/coreFiles.js, which files are core, and of no other module (spec: ./coreFiles.md). It asks isCore
// and intrinsic of repo paths; it reads no file and needs no node.

const path = require('path');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const core = require(path.join(RUN, 'spirit', 'coreFiles.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function each(paths, want, why) {
  paths.forEach(function (p) {
    const got = core.isCore(p);
    ok(got === want, (want ? 'core: ' : 'not core: ') + p + ' (' + why + ')', p + ' should ' + (want ? '' : 'not ') + 'be core (' + why + '), isCore said ' + got);
  });
}

test.startTest('coreFiles.js: which files are core');

test.subHeading('what was core before goal/G41.29');
each(['spirit/run/face.html', 'spirit/run/shell/boot.js', 'spirit/run/shell/seal.js', 'spirit/run/shell/face.css', 'spirit/run/shell/favicon.svg'], true, 'the face\'s boot');
each(['spirit/run/shell/login/login.js', 'spirit/run/shell/login/login.json', 'spirit/run/shell/join/join.json'], true, 'login and join, whole');
each(['spirit/run/shell/apps/apps.json', 'spirit/run/process/js/fileServer/fileServer.json', 'spirit/run/shell/desk/desk.json'], false, 'a manifest is never core');
each(['spirit/run/spirit/relay.js', 'spirit/run/spirit/test/relayServer.js', 'spirit/run/shell/js/contactSelector.js', 'spirit/run/shell/json/x.json', 'spirit/run/test/testReport.js'], true, 'the core folders');
// goal/G41.30, the review's H5: what index.html loads on every boot.
each(['spirit/run/shell/node_modules/codemirror/lib/codemirror.js', 'spirit/run/shell/node_modules/codemirror/lib/codemirror.css', 'spirit/run/shell/shared/js/progressBar.js', 'spirit/run/shell/shared/ask.js'], true, 'loaded by index.html on every boot');
each(['spirit/run/index.html', 'spirit/run/spirit.js', 'spirit/run/shell/elements.css', 'spirit/run/shell/tokens.css'], true, 'the frame');
// goal/G41.30, Andy: "make the nav wrapper \"core\"": it moved out of shell/js/ in G41.19, and no rule named it there.
each(['spirit/run/shell/navigationWrapper.js', 'spirit/run/shell/test/navigationWrapper.js', 'spirit/run/shell/test/navigationWrapper.md'], true, 'the navigation wrapper, and its tests');
each(['spirit/run/shell/apps/apps.js', 'spirit/run/shell/grants/grants.js', 'spirit/run/process/js/fileServer/fileServer.js'], true, 'an intrinsic app\'s code');
each(['spirit/run/shell/apps/notes.txt', 'spirit/run/shell/desk/desk.js', 'spirit/run/shell/chatter/chatter.js'], false, 'an intrinsic app\'s data, or an app not intrinsic');
ok(core.intrinsic('shell/apps') && core.intrinsic('spirit/run/shell/apps/apps.js') && !core.intrinsic('shell/desk'),
  'intrinsic answers for a folder or a path inside one, with or without spirit/run/', 'intrinsic answered wrongly for shell/apps or shell/desk');

test.subHeading('goal/G41.29: a core file\'s companion test files are core');
each(['spirit/run/shell/test/boot.js', 'spirit/run/shell/test/boot.md', 'spirit/run/shell/test/seal.js', 'spirit/run/shell/test/seal.md'], true, 'the boot\'s companions');
each(['spirit/run/shell/apps/test/apps.js', 'spirit/run/shell/apps/test/apps.md', 'spirit/run/shell/grants/test/grants.md', 'spirit/run/process/js/fileServer/test/fileServer.md'], true, 'an intrinsic app\'s companions');
each(['spirit/run/shell/desk/test/desk.js', 'spirit/run/shell/desk/test/desk.md', 'spirit/run/shell/chatter/test/chatter.md'], false, 'a test named after no core file');

test.reportSuccessFailureCount();
