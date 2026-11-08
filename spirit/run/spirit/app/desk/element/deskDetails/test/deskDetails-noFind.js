'use strict';

// spirit/run/spirit/app/desk/element/deskDetails/test/deskDetails-noFind.js
// THE ITEM DETAIL HAS NO FIND FIELD AND NO CHAT SEARCH (goal/G43.22; spec: ./deskDetails-noFind.md): spirit/app/desk/element/deskDetails/deskDetails.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". "take out your search of the items text", "take out the chat-search do, it's not actually usable.". The tree read as it is, comments left out.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

test.startTest('deskDetails-noFind.js: the item detail has no find field over its box and no chat search (goal/G43.22)');

test.subHeading('Andy: "take out your search of the items text", "take out the chat-search do"');
const details = code(path.join(DESK, 'element', 'deskDetails', 'deskDetails.js'));
ok(!!details && !/data-box-find/.test(details), 'the item detail has no find field over its box', 'spirit/app/desk/element/deskDetails/deskDetails.js still draws data-box-find');
ok(!!details && !/dd-chat-find|ddMountChatFind/.test(details), 'the item detail has no chat search', 'spirit/app/desk/element/deskDetails/deskDetails.js still draws its chat search');

test.reportSuccessFailureCount();
process.exit(0);
