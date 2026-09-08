'use strict';

// Cycle — a node keeps at least one Natter relay.
//
// Natter with zero URLs is a personal node that cannot claim, cannot
// send, cannot read an inbox, and has nothing for an owner badge to sit
// on. So Remove is a two-or-more affair, and the last row has no working
// Remove: not a confirm that deletes anyway, not a disabled-looking
// button that still fires.
//
// The rule is one function in js/ownerBadge.js, whose isomorphic half the
// shell loads. This file checks it there, and then checks that the real
// app/natter/natter.js actually asks it — a rule nothing consults is not
// a rule. There is no DOM in node, so natter.js is evaluated here with
// small stubs (the same reason escapeHtml had to move into the kernel's
// isomorphic half before htmlEscaping.js could exist).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const ownerBadge = require('../run/js/ownerBadge');

const RUN_DIR = path.join(__dirname, '..', 'run');

// The browser half of ownerBadge.js, loaded the way the page loads it:
// no `process`, so the node branch never runs and nothing is required.
function browserBadge() {
  const src = fs.readFileSync(path.join(RUN_DIR, 'js', 'ownerBadge.js'), 'utf8');
  const win = {};
  new Function('window', 'process', 'module', 'require', src)(win, undefined, undefined, undefined);
  return win;
}

// The real app file, with the two globals it touches at load time stubbed
// out. Returns its module-level functions so they can be exercised.
function loadNatter(win) {
  const src = fs.readFileSync(path.join(RUN_DIR, 'app', 'natter', 'natter.js'), 'utf8');
  // The page always hands an app the kernel's shared halves; this stub
  // used to give only `shell`, which was enough until the app reached
  // for a mark (ICON.STAR) at load time.
  const kernel = require('../run/js/kernel.js');
  const spirit = {
    shell: { activateApp: function () {} },
    core: { const: { ICON: kernel.core.const.ICON }, util: { escapeHtml: kernel.core.util.escapeHtml } },
  };
  const tail = '\nreturn {' +
    ' canRemove: natterCanRemove,' +
    ' removeAt: natterRemoveAt,' +
    ' renderList: natterRenderList,' +
    ' reportHtml: natterReportHtml,' +
    // Setters rather than the variables themselves: these are module
    // state the app owns, and a test that could only read them would be
    // reduced to asserting the markup it had just written.
    ' badges: function (byUrl) { natterBadgeByUrl = byUrl; },' +
    ' expand: function (url) { natterExpandedUrl = url; }' +
    '};';
  return new Function('window', 'spirit', 'document', src + tail)(win, spirit, undefined);
}

function fakeContainer() {
  const tbody = { innerHTML: '' };
  return {
    tbody: tbody,
    querySelector: function () { return tbody; },
  };
}

const api = { escapeHtml: function (s) { return String(s == null ? '' : s); } };

function renderHtml(natter, relays) {
  const container = fakeContainer();
  natter.renderList(container, api, relays);
  return container.tbody.innerHTML;
}

function countRemoveButtons(html) {
  return (html.match(/data-remove-index=/g) || []).length;
}

test.startTest('Natter — the last public relay does not come off');

{
  if (ownerBadge.canRemoveMailbox(2) === true && ownerBadge.canRemoveMailbox(3) === true) {
    test.check('two or more mailboxes: a removal is allowed');
  } else {
    test.fail('two/three: ' + ownerBadge.canRemoveMailbox(2) + ' ' + ownerBadge.canRemoveMailbox(3));
  }

  if (ownerBadge.canRemoveMailbox(1) === false && ownerBadge.canRemoveMailbox(0) === false) {
    test.check('one or none: no removal');
  } else {
    test.fail('one/none: ' + ownerBadge.canRemoveMailbox(1) + ' ' + ownerBadge.canRemoveMailbox(0));
  }

  // The count arrives from a length, but it has arrived from worse before
  // — this must never be truthy by accident.
  const junk = [undefined, null, '', 'two', NaN, -1, {}, []].every(function (v) {
    return ownerBadge.canRemoveMailbox(v) === false;
  });
  if (junk) {
    test.check('a count that is not a number above one is not permission');
  } else {
    test.fail('junk counts were not all refused');
  }
}

test.subHeading('The browser is given the same rule, not a copy of it');

{
  const win = browserBadge();
  if (win.spiritOwnerBadge && typeof win.spiritOwnerBadge.canRemoveMailbox === 'function') {
    test.check('the isomorphic half publishes window.spiritOwnerBadge');
  } else {
    test.fail('no browser half: ' + JSON.stringify(Object.keys(win)));
  }

  if (win.spiritOwnerBadge.canRemoveMailbox(1) === false && win.spiritOwnerBadge.canRemoveMailbox(2) === true) {
    test.check('and it answers exactly as the node side does');
  } else {
    test.fail('browser rule disagrees with the node rule');
  }

  // Nothing that needs a filesystem may have run to get here — the page
  // has no fs, and a throw at load would take the whole shell with it.
  if (typeof win.spiritOwnerBadge.probe === 'undefined' && typeof win.spiritOwnerBadge.loadRelays === 'undefined') {
    test.check('the browser gets the rules only, not the node half');
  } else {
    test.fail('node functions leaked into the browser half');
  }
}

test.subHeading('Natter asks it, on the row and on the click');

{
  const natter = loadNatter(browserBadge());
  const two = [
    { label: 'kamatera', url: 'https://spirit.andyflinn.com' },
    { label: 'lab', url: 'http://127.0.0.1:65430' },
  ];

  if (countRemoveButtons(renderHtml(natter, two)) === 2) {
    test.check('two relays: both rows offer Remove');
  } else {
    test.fail('two rows: ' + renderHtml(natter, two));
  }

  const one = [two[0]];
  const lastHtml = renderHtml(natter, one);
  if (countRemoveButtons(lastHtml) === 0) {
    test.check('one relay: no Remove control is drawn at all');
  } else {
    test.fail('single row still offers Remove: ' + lastHtml);
  }

  if (lastHtml.indexOf('<button') === -1 && lastHtml.indexOf('spirit.andyflinn.com') !== -1) {
    test.check('the row is still listed, it just has no button');
  } else {
    test.fail('single row html: ' + lastHtml);
  }

  // The click path is the one that actually deletes, and it is not
  // allowed to trust the button it came from.
  const stubborn = [two[0]];
  if (natter.removeAt(stubborn, 0) === null && stubborn.length === 1) {
    test.check('a Remove clicked on the last row removes nothing');
  } else {
    test.fail('last row removed: ' + JSON.stringify(stubborn));
  }

  const pair = two.slice();
  const removed = natter.removeAt(pair, 1);
  if (removed && removed.label === 'lab' && pair.length === 1) {
    test.check('removing one of two leaves one');
  } else {
    test.fail('remove of two: ' + JSON.stringify({ removed: removed, pair: pair }));
  }

  if (countRemoveButtons(renderHtml(natter, pair)) === 0 && natter.removeAt(pair, 0) === null) {
    test.check('and the survivor cannot then be removed either');
  } else {
    test.fail('survivor: ' + JSON.stringify(pair));
  }

  const outOfRange = two.slice();
  if (natter.removeAt(outOfRange, 7) === null && outOfRange.length === 2) {
    test.check('an index off the end removes nothing');
  } else {
    test.fail('out of range: ' + JSON.stringify(outOfRange));
  }
}

test.subHeading('If the rule never loaded, nothing is removable');

{
  // The shell failing to serve js/ownerBadge.js must cost the button, not
  // the mailbox: no helper, no Remove, no way to empty the list.
  const natter = loadNatter({});
  const two = [
    { label: 'kamatera', url: 'https://spirit.andyflinn.com' },
    { label: 'lab', url: 'http://127.0.0.1:65430' },
  ];

  if (natter.canRemove(2) === false && countRemoveButtons(renderHtml(natter, two)) === 0) {
    test.check('without window.spiritOwnerBadge Natter draws no Remove at all');
  } else {
    test.fail('drew Remove with no helper present');
  }

  if (natter.removeAt(two, 0) === null && two.length === 2) {
    test.check('and the click path refuses too');
  } else {
    test.fail('removed without a helper: ' + JSON.stringify(two));
  }
}

test.subHeading('The shell actually loads the isomorphic half');

{
  const html = fs.readFileSync(path.join(RUN_DIR, 'index.html'), 'utf8');
  if (/<script src="\/js\/ownerBadge\.js"><\/script>/.test(html)) {
    test.check('index.html includes /js/ownerBadge.js');
  } else {
    test.fail('index.html does not load js/ownerBadge.js — Natter would find no rule');
  }

  const spirit = require('../run/js/kernel.js');
  if (spirit.core.fs.fileServable('js/ownerBadge.js')) {
    test.check('and the server will serve it');
  } else {
    test.fail('js/ownerBadge.js is not servable, so that script tag 404s');
  }
}


// ---------------------------------------------------------------------
// The ownership mark, and what a mailbox says about itself.
// ---------------------------------------------------------------------

test.subHeading('A star means owned, and opens what that mailbox says');

{
  const natter = loadNatter(browserBadge());
  const relays = [
    { label: 'mine', url: 'https://spirit.example' },
    { label: 'theirs', url: 'https://other.example' },
  ];

  // Before any probe answers, nothing is owned and nothing is starred.
  if (renderHtml(natter, relays).indexOf('natter-star') === -1) {
    test.check('a node that has not asked yet stars nothing');
  } else {
    test.fail('starred before the probe answered');
  }

  natter.badges({
    'https://spirit.example': {
      url: 'https://spirit.example',
      owned: true,
      report: { owner: 'andy', mode: 'keys', peers: [{ name: 'bert' }, { name: 'jim' }], messages: 12 },
    },
    'https://other.example': { url: 'https://other.example', owned: false, error: 'not owner' },
  });

  const listed = renderHtml(natter, relays);
  const stars = (listed.match(/natter-star/g) || []).length;
  if (stars === 1 && listed.indexOf('data-row-url="https://spirit.example"') !== -1) {
    test.check('the owned row gets the star, and the other does not');
  } else {
    test.fail('stars: ' + stars + ' in ' + listed);
  }

  // The star says the row can be opened; the row is what opens it, so
  // the whole width is the target and the star holds no click of its own.
  if (listed.indexOf('data-row-url="https://other.example"') === -1 &&
      listed.indexOf('<span class="natter-star">') !== -1) {
    test.check('the mark is a mark, and only an owned row is openable');
  } else {
    test.fail('row markup: ' + listed);
  }

  if (listed.indexOf('job-log-row') === -1) {
    test.check('and nothing is expanded until the star is pressed');
  } else {
    test.fail('a panel was open on first render');
  }

  natter.expand('https://spirit.example');
  const open = renderHtml(natter, relays);
  if ((open.match(/job-log-row/g) || []).length === 1 &&
      open.indexOf('andy') !== -1 && open.indexOf('keys') !== -1 && open.indexOf('>12<') !== -1) {
    test.check('pressing it shows what the mailbox reported');
  } else {
    test.fail('panel: ' + open);
  }

  // Peers by count, not by key (UI_DESIGN_STYLE.md) — and the panel shows
  // only what the probe returned, which is what keeps live invite tokens
  // off a screen anybody can glance at.
  if (open.indexOf('>2<') !== -1 && open.indexOf('bert') === -1) {
    test.check('peers are counted, not listed one key at a time');
  } else {
    test.fail('peers rendered as names or keys: ' + open);
  }

  // One at a time: what is expanded is a single value, so a second row
  // cannot also be open.
  natter.badges({
    'https://spirit.example': { url: 'https://spirit.example', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } },
    'https://other.example': { url: 'https://other.example', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 5 } },
  });
  natter.expand('https://other.example');
  const second = renderHtml(natter, relays);
  if ((second.match(/job-log-row/g) || []).length === 1 && second.indexOf('>5<') !== -1) {
    test.check('opening one closes the other');
  } else {
    test.fail('two panels open at once: ' + second);
  }

  // A row this node does not own says why, rather than showing a census
  // it never received.
  const plain = { escapeHtml: function (v) { return String(v == null ? '' : v); } };
  if (natter.reportHtml(plain, { owned: false, error: 'not owner' }).indexOf('not owner') !== -1 &&
      natter.reportHtml(plain, null).indexOf('asking') !== -1) {
    test.check('an unowned row says so, and an unanswered one says it is asking');
  } else {
    test.fail('unowned report: ' + natter.reportHtml(plain, { owned: false, error: 'not owner' }));
  }

  // Nomenclature: the field is captioned with the word the dictionary
  // uses for a caption that never leaves this node, not with an example
  // built from somebody's name.
  const src = fs.readFileSync(path.join(RUN_DIR, 'app', 'natter', 'natter.js'), 'utf8');
  // The hints, not the whole file: this app names the public mailbox in
  // its own copy now (spirit.andyflinn.com), and a domain is not a
  // person's name standing in for a field label.
  const hints = (src.match(/placeholder="[^"]*"/g) || []).join(' ').toLowerCase();
  if (src.indexOf('Private label') !== -1 && hints.indexOf('andy') === -1) {
    test.check('the label field is named, not exemplified with a person');
  } else {
    test.fail('a placeholder still names a person: ' + hints);
  }
}

test.reportSuccessFailureCount();
