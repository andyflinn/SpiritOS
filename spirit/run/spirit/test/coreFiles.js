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
each(['spirit/run/shell/join/join.js', 'spirit/run/shell/join/join.json'], true, 'join, whole (the login app went, goal/G43.18)');
each(['spirit/run/shell/apps/apps.json', 'spirit/run/process/js/fileServer/fileServer.json', 'spirit/run/shell/desk/desk.json'], false, 'a manifest is never core');
each(['spirit/run/spirit/relay.js', 'spirit/run/spirit/test/relayServer.js', 'spirit/run/spirit/element/search/contact.js', 'spirit/run/shell/json/x.json', 'spirit/run/test/testReport.js'], true, 'the core folders');
// goal/G41.30, the review's H5: what index.html loads on every boot.
each(['spirit/run/spirit/element/codeMirror/lib/codemirror.js', 'spirit/run/spirit/element/codeMirror/lib/codemirror.css', 'spirit/run/spirit/element/progressBar.js'], true, 'loaded by index.html on every boot');
// Andy: "no \"core\" files should reside in shell/shared/ since that folder was meant to be a place where non-intrinsic
// apps could share modules".
each(['spirit/run/shell/shared/ask.js', 'spirit/run/shell/shared/js/deskChat.js', 'spirit/run/shell/shared/js/test/deskChat.js'], false, 'shell/shared, where apps share modules');
each(['spirit/run/index.html', 'spirit/run/spirit.js', 'spirit/run/shell/elements.css', 'spirit/run/shell/tokens.css'], true, 'the frame');
// goal/G41.30, Andy: "make the nav wrapper \"core\"": it moved out of spirit/element/ in G41.19, and no rule named it there.
each(['spirit/run/shell/navigationWrapper.js', 'spirit/run/shell/test/navigationWrapper.js', 'spirit/run/shell/test/navigationWrapper.md'], true, 'the navigation wrapper, and its tests');
each(['spirit/run/shell/apps/apps.js', 'spirit/run/shell/grants/grants.js', 'spirit/run/process/js/fileServer/fileServer.js'], true, 'an intrinsic app\'s code');
each(['spirit/run/shell/apps/notes.txt', 'spirit/run/shell/desk/desk.js', 'spirit/run/shell/chatter/chatter.js'], false, 'an intrinsic app\'s data, or an app not intrinsic');
ok(core.intrinsic('shell/apps') && core.intrinsic('spirit/run/shell/apps/apps.js') && !core.intrinsic('shell/desk'),
  'intrinsic answers for a folder or a path inside one, with or without spirit/run/', 'intrinsic answered wrongly for shell/apps or shell/desk');

test.subHeading('goal/G41.29: a core file\'s companion test files are core');
each(['spirit/run/shell/test/boot.js', 'spirit/run/shell/test/boot.md', 'spirit/run/shell/test/seal.js', 'spirit/run/shell/test/seal.md'], true, 'the boot\'s companions');
each(['spirit/run/shell/apps/test/apps.js', 'spirit/run/shell/apps/test/apps.md', 'spirit/run/shell/grants/test/grants.md', 'spirit/run/process/js/fileServer/test/fileServer.md'], true, 'an intrinsic app\'s companions');
each(['spirit/run/shell/desk/test/desk.js', 'spirit/run/shell/desk/test/desk.md', 'spirit/run/shell/chatter/test/chatter.md'], false, 'a test named after no core file');


// goal/G43.14: INTRINSIC FOR THE NEW APPS, in spirit/app/<name>/<name>.json (Andy: "i think in spirit/app/<name>/<name>.json
// (identity:intrinsic:true|false)"). The json is always core; the rest of the folder only while it says intrinsic true. "no
// dependency on git": the rule reads the json on disc, here a tree of this test's own, handed as the repo root.
test.subHeading('goal/G43.14: <name>.json says whether an app of spirit/app/ is intrinsic');
{
  const os = require('os');
  const fsx = require('fs');
  const root = fsx.mkdtempSync(path.join(os.tmpdir(), 'spirit-core-'));
  const plant = function (name, identity) {
    const dir = path.join(root, 'spirit', 'run', 'spirit', 'app', name);
    fsx.mkdirSync(path.join(dir, 'test'), { recursive: true });
    fsx.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: identity, shell: { mount: true }, node: { mount: false } }));
    [name + '.js', 'style.css', 'page.html', 'data.json', 'test/' + name + '.js'].forEach(function (f) { fsx.writeFileSync(path.join(dir, f), ''); });
  };
  plant('always', { label: 'Always', intrinsic: true });
  plant('free', { label: 'Free', intrinsic: false });
  // Q2, Andy: "anything in spirit/app/ is core unless spirit/app/<name>/<name>.json says it's not intrinsic."
  plant('plain', { label: 'Plain' });
  fsx.mkdirSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'bare', 'test'), { recursive: true });
  ['bare.js', 'test/bare.js'].forEach(function (f) { fsx.writeFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'bare', f), ''); });
  const at = function (name, f) { return 'spirit/run/spirit/app/' + name + '/' + f; };
  const is = function (p) { return core.isCore(p, root); };
  ['always.json', 'free.json'].forEach(function (f) {
    const n = f.replace('.json', '');
    ok(is(at(n, f)) === true, 'core: ' + at(n, f) + ', whatever it says', at(n, f) + ' is not core');
  });
  ['always.js', 'style.css', 'page.html'].forEach(function (f) {
    ok(is(at('always', f)) === true, 'core while intrinsic true: ' + at('always', f), at('always', f) + ' is not core, with intrinsic true');
  });
  ['free.js', 'style.css', 'page.html', 'data.json', 'test/free.js'].forEach(function (f) {
    ok(is(at('free', f)) === false, 'not core with intrinsic false: ' + at('free', f), at('free', f) + ' is core, with intrinsic false');
  });
  ['plain.js', 'style.css', 'page.html'].forEach(function (f) {
    ok(is(at('plain', f)) === true, 'core with no intrinsic in its json (Q2): ' + at('plain', f), at('plain', f) + ' is not core, its json saying nothing of intrinsic');
  });
  ['bare.js', 'test/bare.js'].forEach(function (f) {
    ok(is(at('bare', f)) === true, 'core in a folder with no <name>.json, as appSelector/ and test/ are (Q2): ' + at('bare', f), at('bare', f) + ' is not core, in a folder with no json');
  });
  // The json, rewritten on disc, is what counts: no copy kept from before.
  fsx.writeFileSync(path.join(root, 'spirit', 'run', 'spirit', 'app', 'free', 'free.json'), JSON.stringify({ identity: { intrinsic: true } }));
  ok(is(at('free', 'free.js')) === true, 'the json is read as it is on disc: turned true, the code is core', at('free', 'free.js') + ' is still not core');
  fsx.rmSync(root, { recursive: true, force: true });
}

test.subHeading('goal/G43.14: Contacts moved, so it comes off the coded list ("an app that moves comes off it in the same commit")');
ok(core.intrinsic('shell/contacts') === false, 'shell/contacts is not on the coded list', 'shell/contacts is still on it');
ok(core.isCore('spirit/run/spirit/app/contact/contact.json') === true && core.isCore('spirit/run/spirit/app/contact/contact.js') === true,
  'in this tree spirit/app/contact/ is core, its json saying intrinsic true', 'contact.json ' + core.isCore('spirit/run/spirit/app/contact/contact.json') + ', contact.js ' + core.isCore('spirit/run/spirit/app/contact/contact.js'));

test.reportSuccessFailureCount();
