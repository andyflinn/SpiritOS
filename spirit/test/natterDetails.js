'use strict';

// spirit/test/natterDetails.js
// One mailbox, as its own screen.
//
// The panel that used to unfold inside a Natter row is a dialog now
// (app/natterDetails), pushed for the row it was opened from — the same
// move Contacts made when its expanding row became app/contactsDetails.
//
// Every check here was already passing somewhere else: the mint ones in
// natterBind, the device ones in natterIntrinsic. They followed the code
// rather than being rewritten, because a test that moves with the thing
// it describes is the only way a refactor can be shown not to have lost
// anything. What is new is the last section — what the screen RETURNS,
// which did not exist when the panel was a row.
//
// Driven the way contacts.js drives its dialog: the real script is
// loaded with small document/api/fetch stubs and its real handlers are
// fired, so "pressing Invite posts a mint at that URL" is a test rather
// than a screenshot.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN_DIR = path.join(__dirname, '..', 'run');
const APP_SCRIPT = path.join(RUN_DIR, 'app', 'natterDetails', 'natterDetails.js');

const OWNED = 'https://spirit.example';
const THEIRS = 'https://someone.example';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    children: [],
    listeners: {},
    addEventListener: function (event, fn) {
      (el.listeners[event] = el.listeners[event] || []).push(fn);
    },
    fire: function (event, arg) {
      (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); });
    },
    getAttribute: function () { return null; },
    setAttribute: function () {},
    querySelector: function () { return null; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); },
    enumerable: true,
  });
  return el;
}

// The button the click handler is handed, and the panel it sits in. Both
// questions the real element is asked: which control this is, and which
// block it belongs to.
function mintTarget(fields) {
  const panel = {
    querySelector: function (selector) { return fields[selector.replace('.', '')] || null; },
  };
  const node = { getAttribute: function () { return null; } };
  node.closest = function (selector) {
    if (selector === '.natter-inv-go') return node;
    if (selector === '.natter-mint') return panel;
    return null;
  };
  return node;
}

function copyTarget(out) {
  const panel = {
    querySelector: function (selector) {
      return selector === '.natter-dev-out' ? out : null;
    },
  };
  const node = { getAttribute: function () { return null; } };
  node.closest = function (selector) {
    if (selector === '.natter-dev-copy') return node;
    if (selector === '.natter-device') return panel;
    return null;
  };
  return node;
}

function forgetTarget() {
  const node = { getAttribute: function () { return null; } };
  node.closest = function (selector) {
    return selector === '.natter-forget-go' ? node : null;
  };
  return node;
}

// opts: { rows, device, label, canRemove }
function mountApp(opts) {
  opts = opts || {};
  const elements = Object.create(null);
  const doc = {
    getElementById: function (id) {
      if (!elements[id]) elements[id] = fakeElement(id);
      return elements[id];
    },
  };

  const log = [];
  const fakeFetch = function (url, init) {
    log.push({ url: url, body: init && init.body });
    let text = '{}';
    if (url.indexOf('/api/hub/status') === 0) {
      text = JSON.stringify({ rows: opts.rows || [] });
    } else if (url.indexOf('/api/hub/device') === 0) {
      text = JSON.stringify(opts.device || {});
    } else if (url.indexOf('/api/hub/invite') === 0) {
      text = JSON.stringify({ token: 'saint-bernard' });
    }
    return Promise.resolve({
      status: url.indexOf('/api/hub/invite') === 0 ? 201 : 200,
      text: function () { return Promise.resolve(text); },
      json: function () { return Promise.resolve(JSON.parse(text)); },
    });
  };

  let behavior = null;
  const shellSpirit = {
    shell: {
      activateApp: function (b) { behavior = b; },
      // The shared facts bubble (factRow, shell.js). Real output, not a
      // placeholder — the tests read what a panel actually renders.
      factRow: function (pairs) {
        return '<div class="fact-row">' + (pairs || []).map(function (pair) {
          return '<div class="fact">' +
            '<span class="fact-label">' + spirit.core.util.escapeHtml(String(pair[0])) + '</span>' +
            '<span class="fact-value">' + spirit.core.util.escapeHtml(String(pair[1])) + '</span>' +
            '</div>';
        }).join('') + '</div>';
      },
    },
    core: {
      util: { escapeHtml: spirit.core.util.escapeHtml },
      const: { ICON: spirit.core.const.ICON },
    },
  };

  // setInterval is injected, as natterBind did for the panel's poll. The
  // device panel re-asks the hub every two seconds, and a real interval
  // here keeps node's event loop alive after the assertions are done —
  // the suite passes and then hangs forever, which is a worse failure
  // than a red line because nothing says why.
  let intervalsStarted = 0;
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', 'fetch', 'setInterval', 'clearInterval', 'navigator', src)(
    shellSpirit, doc, {}, fakeFetch,
    function () { intervalsStarted += 1; return intervalsStarted; },
    function () {},
    { clipboard: { writeText: function () { return Promise.resolve(); } } }
  );

  const container = fakeElement('container');
  const answers = [];
  const api = {
    escapeHtml: spirit.core.util.escapeHtml,
    isVisible: function () { return true; },
    setDialogResult: function (result) { answers.push(result); },
  };

  behavior.mount(container, api);
  behavior.open({
    url: opts.url || OWNED,
    label: opts.label || 'andy',
    canRemove: opts.canRemove !== false,
  });

  return {
    doc: doc, log: log, behavior: behavior, answers: answers,
    body: function () { return doc.getElementById('nd-body'); },
    intervals: function () { return intervalsStarted; },
  };
}

function settle() {
  return new Promise(function (resolve) { setImmediate(resolve); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); })
    .then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

test.startTest('Natter details — one mailbox, as its own screen');

// ---------------------------------------------------------------------

function ownedMailbox() {
  test.subHeading('A mailbox this node owns');

  const app = mountApp({
    rows: [{
      url: OWNED, label: 'spirit', owned: true,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 },
    }],
  });

  return settle().then(function () {
    const panel = app.body().innerHTML;

    // Two blocks, and the facts are one line rather than four rows: the
    // title bar is the heading, and label-over-value stacked made a list
    // out of what is one reading.
    const facts = (panel.match(/class="fact"/g) || []).length;
    if (/class="fact-row"/.test(panel) && facts === 4 && panel.indexOf('file-info-row') === -1) {
      test.check('what the mailbox reports is one row of four facts');
    } else {
      test.fail('report layout: ' + panel);
    }

    if (/natter-inv-go/.test(panel)) {
      test.check('and an owned mailbox offers the mint');
    } else {
      test.fail('no mint on an owned mailbox: ' + panel);
    }

    // The mint is its own tile, so it carries its own space and a screen
    // without one leaves no gap behind.
    if (/stat-tile wide natter-mint/.test(panel)) {
      test.check('with the mint as a second block, spaced by itself');
    } else {
      test.fail('mint is not its own block: ' + panel);
    }

    // And it is the one block here that gets a heading: the facts above
    // are a reading of the mailbox the title already named, but this is
    // a thing to do. The mark is the shell's own ★ — the same one the
    // row carries for owning the mailbox.
    if (panel.indexOf(spirit.core.const.ICON.STAR + ' Invite someone to this relay') !== -1) {
      test.check('and says what it is, with the mark that means owned');
    } else {
      test.fail('mint heading: ' + panel);
    }

    // No picker, ever again: the screen is which mailbox. A question
    // nobody has to ask cannot be answered wrongly.
    //
    // And no data-mint-url either — that attribute existed so a button
    // inside a table could say which row it belonged to. On its own
    // screen the subject is the screen.
    if (panel.indexOf('natter-inv-pick') === -1 && panel.indexOf('data-mint-url') === -1) {
      test.check('and asks no "which mailbox", because the screen already is one');
    } else {
      test.fail('a picker or a row attribute survived: ' + panel);
    }
  });
}

function mintingNamesThisMailbox() {
  test.subHeading('Minting happens on the mailbox it was opened from');

  const app = mountApp({
    rows: [{
      url: OWNED, label: 'spirit', owned: true,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 },
    }],
  });

  return settle().then(function () {
    const out = { textContent: '', className: '' };
    app.body().fire('click', {
      target: mintTarget({
        'natter-inv-label': { value: 'saint' },
        'natter-inv-days': { value: '7' },
        'natter-inv-token': { value: '' },
        'natter-inv-out': out,
      }),
    });

    return settle().then(function () {
      const mints = app.log.filter(function (c) { return c.url.indexOf('/api/hub/invite') === 0; });
      const body = mints.length ? JSON.parse(mints[0].body) : null;
      if (body && body.label === 'saint' && body.days === 7 && body.url === OWNED) {
        test.check('minting names the mailbox this screen is, never relays.json[0]');
      } else {
        test.fail('mint body: ' + JSON.stringify(body));
      }

      // Printed, not copied: it is read off this screen onto a phone.
      if (/saint-bernard/.test(out.textContent)) {
        test.check('and the token the relay stored is shown to be read out');
      } else {
        test.fail('mint output: ' + out.textContent);
      }

      // Which of the two answers it is, said in the markup: a refusal
      // must not read as a token somebody might try to speak down a
      // phone.
      if (/is-token/.test(out.className) && !/is-error/.test(out.className)) {
        test.check('and it is marked as a token rather than as a refusal');
      } else {
        test.fail('answer class: ' + out.className);
      }

      // THE HALF THAT IS NEW. minted.json is Natter's file — this app's
      // api.fs is scoped to its own folder and cannot write it — so the
      // label goes back as the dialog's answer and the list records it.
      // That is the dialog contract doing what it is for.
      const said = app.answers[app.answers.length - 1] || {};
      if (said.minted === 'saint' && said.changed === true && said.url === OWNED) {
        test.check('and the label is RETURNED, for the list to remember');
      } else {
        test.fail('answer: ' + JSON.stringify(said));
      }

      // Never the token. That is the secret, and it does not leave this
      // screen — not even to the app that opened it.
      if (JSON.stringify(app.answers).indexOf('saint-bernard') === -1) {
        test.check('and the token is not, because that is the spoken secret');
      } else {
        test.fail('the token left the screen: ' + JSON.stringify(app.answers));
      }
    });
  });
}

function someoneElsesMailbox() {
  test.subHeading('A mailbox somebody else owns');

  const app = mountApp({
    url: THEIRS,
    rows: [{
      url: THEIRS, label: 'theirs', owned: false, claimed: true,
      census: { owner: 'carol', peers: 4, myLabel: 'bert' },
    }],
  });

  return settle().then(function () {
    const panel = app.body().innerHTML;

    // Not hidden — not built. A mailbox somebody else owns has no mint
    // markup at all to find.
    if (panel.indexOf('natter-inv-go') === -1) {
      test.check('offers no mint at all, rather than a disabled one');
    } else {
      test.fail('mint offered on a mailbox we do not own: ' + panel);
    }

    // Three facts from the PUBLIC census, not the owner-only report.
    // This used to print the 403 — "not the owner" — which is the app
    // telling somebody off for the ordinary case of being a member.
    if (panel.indexOf('carol') !== -1 && panel.indexOf('bert') !== -1 &&
        panel.indexOf('not the owner') === -1) {
      test.check('and says who runs it, how many are on it, and what YOU are called here');
    } else {
      test.fail('member view: ' + panel);
    }

    // B2: a mailbox this node HAS takes its device, owned or not. Gating
    // this on the star would keep the feature at the owner for want of
    // one word, which is exactly where it sat until B2.
    if (/natter-device/.test(panel)) {
      test.check('and still offers the device panel, because a member has a slot too');
    } else {
      test.fail('no device panel for a member: ' + panel);
    }

    // No star on it, though. ★ means owned everywhere in this app and in
    // Relay Chat's To list — one mark, one meaning — and a member seeing
    // it on a panel that has nothing to do with owning would be the mark
    // starting to mean two things.
    const device = panel.slice(panel.indexOf('natter-device'));
    if (device.indexOf(spirit.core.const.ICON.STAR) === -1 && device.indexOf('★') === -1) {
      test.check('and wears no star, which means owned and only that');
    } else {
      test.fail('the device panel wore the owned mark: ' + device.slice(0, 160));
    }
  });
}

function aStrangersMailbox() {
  const app = mountApp({
    url: THEIRS,
    rows: [{ url: THEIRS, label: 'theirs', owned: false, error: 'not the owner' }],
  });

  return settle().then(function () {
    const panel = app.body().innerHTML;
    // Neither owned nor claimed: this node cannot put a device there and
    // showing the panel would be chrome nobody can act on.
    if (panel.indexOf('natter-device') === -1 && panel.indexOf('natter-inv-go') === -1) {
      test.check('and a mailbox this node has no row on offers neither');
    } else {
      test.fail('chrome on a mailbox we are not on: ' + panel);
    }
  });
}

function theDevicePanel() {
  test.subHeading('Attaching one of my own devices');

  // A LONG KEY ON PURPOSE. The address is a host plus 58 characters of
  // base64url plus `/device`, and what this panel had to stop doing was
  // printing all of it — so a short fake key would test the wrong thing.
  const KEY = 'MCowBQYDK2VwAyEAbella+key/with+slashes+and+padding+to+be+long=';

  const app = mountApp({
    rows: [{
      url: OWNED, label: 'spirit', owned: true,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 },
    }],
    device: { password: 'p'.repeat(128), publicKey: KEY },
  });

  return settle().then(function () {
    const panel = app.body().innerHTML;

    // NOTHING TO SWITCH ON. Andy: "no backstop, no 'listening mode' on
    // the personal node. the ability to setup one-device-for-all-peers
    // just IS." The panel had a toggle, four moods and a two-second
    // repaint, all of them about a poll — and this is the check that
    // stops any of it coming back, because none of it would go red.
    const ICONS = spirit.core.const.ICON;
    if (panel.indexOf('data-device-toggle') === -1 &&
        panel.indexOf('data-mood') === -1 &&
        panel.indexOf(ICONS.BLUE_CIRCLE) === -1 &&
        panel.indexOf(ICONS.RED_CIRCLE) === -1 &&
        !/listen/i.test(panel)) {
      test.check('there is no switch, no state and no word about listening');
    } else {
      test.fail('the window came back: ' +
        panel.slice(panel.indexOf('natter-device'), panel.indexOf('natter-device') + 400));
    }

    // WHERE TO OPEN IT. `/<key>/device` names whose enrolment this is,
    // which is what lets a relay answer per identity rather than one for
    // the box. Base64url — the same bytes, `-` and `_` for `+` and `/` —
    // because a `/` in a path segment is not in the segment.
    const target = 'https://spirit.example/' +
      KEY.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '/device';
    if (panel.indexOf('href="' + target + '"') !== -1) {
      test.check('the link GOES to this identity in base64url, not to the bare /device');
    } else {
      test.fail('device link target: ' + (/href="https:\/\/spirit[^"]*/.exec(panel) || [''])[0]);
    }

    // AND DOES NOT SHOW IT. Andy asked for the URL hidden and its length
    // on the display controllable. The href and the title carry it whole
    // — it is a locator, not a credential — and the text is a label.
    const shown = />([^<]*…[^<]*)<\/a>/.exec(panel);
    if (shown && shown[1].length < target.length && shown[1].indexOf(KEY.slice(20, 40)) === -1) {
      test.check('and shows it shortened — ' + shown[1].length + ' characters, not ' +
        target.length + ', with the key elided');
    } else {
      test.fail('displayed link text: ' + JSON.stringify(shown && shown[1]));
    }

    // The whole address is still ONE hover away, and the check is that
    // the two differ: a title equal to the text would mean nothing was
    // hidden, and a missing title would mean it could not be recovered.
    const title = /title="(https:\/\/[^"]*)"/.exec(panel);
    if (title && title[1] === target && shown && title[1] !== shown[1]) {
      test.check('and the full address is on the title, so nothing is lost by hiding it');
    } else {
      test.fail('title: ' + JSON.stringify(title && title[1]));
    }

    // THE TWO REMINDERS, which are Andy's and are both about the OTHER
    // device — which is why they are the ones forgotten at the moment
    // they matter.
    if (/bookmark/i.test(panel) && /password manager/i.test(panel)) {
      test.check('and the panel below says to bookmark that page and save the password');
    } else {
      test.fail('the reminders are not both there');
    }

    // ONE BUTTON, and it copies. It used to also open the window, because
    // there were once two buttons and the copy was the one that opened it
    // — which nobody could guess.
    const out = { textContent: '' };
    app.body().fire('click', { target: copyTarget(out) });

    return settle().then(function () {
      if (/copied/.test(out.textContent)) {
        test.check('and the one button puts the password on the clipboard');
      } else {
        test.fail('clipboard word: ' + out.textContent);
      }

      // THE PASSWORD IS NOT ON THE PAGE. It goes to the clipboard and
      // from there into a password manager; 128 characters of hex printed
      // in a panel is a secret sitting on a screen for no reason.
      if (panel.indexOf('p'.repeat(64)) === -1) {
        test.check('and the password itself is nowhere in the markup');
      } else {
        test.fail('the password was printed on the page');
      }
    });
  });
}

// A panel that asks the hub once and never again. The poll it replaced
// re-asked every two seconds for as long as the screen was up, and the
// only reason it did was to keep a sentence about the poll true.
function thePanelAsksOnce() {
  test.subHeading('And asks once, because nothing it shows can change');

  const app = mountApp({
    rows: [{
      url: OWNED, label: 'spirit', owned: true,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 },
    }],
    device: { password: 'p'.repeat(128), publicKey: 'k' },
  });

  return settle().then(function () {
    return settle().then(function () {
      const asks = app.log.filter(function (c) {
        return c.url.indexOf('/api/hub/device') === 0;
      });
      if (asks.length === 1) {
        test.check('one ask for the password and the key, and no timer behind it');
      } else {
        test.fail('asked ' + asks.length + ' times');
      }
    });
  });
}

function openingAnotherMailboxLetsGoOfTheLast() {
  test.subHeading('Every call is a different mailbox');

  const app = mountApp({
    rows: [
      { url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } },
      { url: THEIRS, label: 'theirs', owned: false, claimed: true, census: { owner: 'carol', peers: 4, myLabel: 'bert' } },
    ],
  });

  return settle().then(function () {
    if (/natter-inv-go/.test(app.body().innerHTML)) {
      test.check('the owned one opens with its mint');
    } else {
      test.fail('no mint on the owned mailbox');
    }

    // The shell can promise that open() runs; it cannot know what is
    // stale inside. A screen that kept the last mailbox's badge would
    // offer a mint on somebody else's relay.
    app.behavior.open({ url: THEIRS, label: 'andy' });
    return settle().then(function () {
      if (!/natter-inv-go/.test(app.body().innerHTML)) {
        test.check('and opening a mailbox we do not own takes the mint away again');
      } else {
        test.fail('the mint survived a change of subject: ' + app.body().innerHTML);
      }
    });
  });
}

function takingAMailboxOffTheList() {
  test.subHeading('Taking this mailbox off the list');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
  });

  return settle().then(function () {
    // TWO PRESSES, like Block in app/contactsDetails. This is the one
    // control here that takes something away, and it sits at the end of
    // a screen somebody may have been tabbing down.
    app.body().fire('click', { target: forgetTarget() });
    if (app.answers.length === 0 && /Press again/.test(app.body().innerHTML)) {
      test.check('one press decides nothing, and the button says what the next one will do');
    } else {
      test.fail('first press: ' + JSON.stringify(app.answers) + ' | ' + app.body().innerHTML.slice(-200));
    }

    app.body().fire('click', { target: forgetTarget() });
    const said = app.answers[app.answers.length - 1] || {};
    if (said.removed === OWNED && said.changed === true) {
      test.check('and the second RETURNS it, for the list to perform');
    } else {
      test.fail('second press: ' + JSON.stringify(said));
    }

    // Nothing here writes relays.json. It is the list's file, and this
    // app's api.fs is scoped to its own folder — so there is no call to
    // make and no second place for the last-mailbox rule to live.
    const wrote = app.log.filter(function (c) { return /relays\.json/.test(c.url); });
    if (!wrote.length) {
      test.check('and this screen writes nothing — the file belongs to the list');
    } else {
      test.fail('the screen wrote: ' + JSON.stringify(wrote));
    }
  });
}

function theLastMailboxDoesNotComeOff() {
  const app = mountApp({
    canRemove: false,
    rows: [{ url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
  });

  return settle().then(function () {
    const panel = app.body().innerHTML;
    // Not a disabled button: no control at all, and a sentence saying
    // why. A node with no mailbox can neither claim, send nor read.
    if (panel.indexOf('natter-forget-go') === -1 && /keeps at least one/.test(panel)) {
      test.check('the last mailbox offers no control, and says why rather than greying one out');
    } else {
      test.fail('last mailbox: ' + panel.slice(-300));
    }
  });
}

function armingIsAboutONEMailbox() {
  const app = mountApp({
    rows: [
      { url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } },
      { url: THEIRS, label: 'theirs', owned: false, claimed: true, census: { owner: 'carol', peers: 4, myLabel: 'bert' } },
    ],
  });

  return settle().then(function () {
    app.body().fire('click', { target: forgetTarget() });
    // Armed for one mailbox, then opened on another. Two presses must
    // mean two presses about the SAME thing — the shell can promise
    // open() runs, it cannot know what is stale inside.
    app.behavior.open({ url: THEIRS, label: 'andy', canRemove: true });
    return settle().then(function () {
      app.body().fire('click', { target: forgetTarget() });
      const said = app.answers[app.answers.length - 1] || {};
      if (!said.removed) {
        test.check('and arming it for one mailbox does not half-arm the next');
      } else {
        test.fail('a single press removed ' + said.removed + ' after a change of subject');
      }
    });
  });
}

ownedMailbox()
  .then(mintingNamesThisMailbox)
  .then(someoneElsesMailbox)
  .then(aStrangersMailbox)
  .then(theDevicePanel)
  .then(thePanelAsksOnce)
  .then(openingAnotherMailboxLetsGoOfTheLast)
  .then(takingAMailboxOffTheList)
  .then(theLastMailboxDoesNotComeOff)
  .then(armingIsAboutONEMailbox)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('natterDetails threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
