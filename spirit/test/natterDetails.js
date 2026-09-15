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
const packet = require('../run/js/packet.js');

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

// The claim panel's button, the same shape as mintTarget above.
function claimTarget(fields) {
  const panel = {
    querySelector: function (selector) { return fields[selector.replace('.', '')] || null; },
  };
  const node = { getAttribute: function () { return null; } };
  node.closest = function (selector) {
    if (selector === '.nd-claim-go') return node;
    if (selector === '.natter-claim') return panel;
    return null;
  };
  return node;
}

// The revoke button on one invite row. It carries the label in an
// attribute rather than the panel carrying an index, so the target has to
// answer getAttribute as the real one does.
function revokeTarget(label, out) {
  const panel = {
    querySelector: function (selector) {
      return selector === '.nd-inv-revoke-out' ? out : null;
    },
  };
  const attrs = { 'data-invite-label': label };
  const node = {
    textContent: 'Revoke',
    disabled: false,
    getAttribute: function (name) { return attrs[name] === undefined ? null : attrs[name]; },
    setAttribute: function (name, value) { attrs[name] = value; },
    removeAttribute: function (name) { delete attrs[name]; },
  };
  node.closest = function (selector) {
    if (selector === '.nd-inv-revoke') return node;
    if (selector === '.natter-invites') return panel;
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

// opts: { rows, device, label, canRemove }
// A click lands on the bar, and the app reads data-fold off it via
// closest(). The fake element answers both.
function foldTarget(id) {
  const el = fakeElement('div');
  el.className = 'panel-heading nd-fold';
  el.getAttribute = function (name) { return name === 'data-fold' ? id : null; };
  el.closest = function (sel) { return sel === '.nd-fold' ? el : null; };
  return el;
}

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
  const titles = [];
  const fakeFetch = function (url, init) {
    log.push({ url: url, body: init && init.body });
    let text = '{}';
    if (url.indexOf('/api/hub/status') === 0) {
      // `relayStatus` is a SECOND FIELD on this response, keyed by relay
      // url, and since R3 it is where the owner-only report lives.
      //
      // It used to ride on the badge row, because the badge WAS a signed
      // `GET /api/relay/status` and the report was that request's body.
      // The request is gone; the relay pushes the same report down the
      // stream unprompted, and `/api/hub/status` has been forwarding it
      // under this name all along.
      text = JSON.stringify({
        rows: opts.rows || [],
        relayStatus: opts.relayStatus || {},
      });
    } else if (url.indexOf('/api/hub/device') === 0) {
      text = JSON.stringify(opts.device || {});
    } else if (url.indexOf('/api/hub/post') === 0) {
      // What the node answers a post with: peerPost's own settle, whose
      // `text` is the packet envelope the far end replied in.
      text = JSON.stringify({
        ok: true, status: 200, hash: 'HASH0123456789abcdef', from: 'RELAYKEY',
        text: JSON.stringify({ app: 'relay', v: 1, body: opts.relayAnswer || { ok: true, revoked: 1 } }),
        sig: 'SIG', receipt: true,
      });
    } else if (url.indexOf('/api/hub/claim') === 0) {
      // The claim form moved onto this screen on 2026-09-15, because a
      // claim happens ON a relay and the old one on Natter's list could
      // not say which. See ndClaimHtml.
      text = JSON.stringify(opts.claimBody || { peer: { publicLabel: 'andy' } });
    }
    let status = 200;
    if (url.indexOf('/api/hub/claim') === 0) status = opts.claimStatus || 201;
    return Promise.resolve({
      status: status,
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
    // THE LOOPBACK CLIENT LAYER, as the shell hands it to every app.
    //
    // Modelled on shell.js's peerPost rather than stubbed to whatever
    // this screen happens to want: it posts to /api/hub/post, and the
    // answer arrives as a decoded BODY. spirit/test/clientLayer.js is
    // what proves the real one behaves this way; this is the shape it
    // proved, so the two cannot drift silently.
    peerPost: function (packetApp, toId, body) {
      return fakeFetch('/api/hub/post', {
        method: 'POST',
        body: JSON.stringify({ to: toId, app: packetApp, body: body, re: '' }),
      }).then(function (r) {
        return r.text().then(function (t) {
          let said = null;
          try { said = JSON.parse(t); } catch (e) { said = null; }
          const text = (said && typeof said.text === 'string') ? said.text : '';
          const decoded = text ? packet.decode(text) : null;
          return {
            ok: r.status === 200 && !!(said && said.ok),
            status: r.status,
            hash: (said && said.hash) || '',
            body: decoded ? decoded.body : null,
            reply: text,
            from: (said && said.from) || '',
            error: (said && said.error) || '',
          };
        });
      });
    },
    setDialogResult: function (result) { answers.push(result); },
    // Recorded rather than applied: this harness has no titlebar, and
    // what is being checked is what the screen ASKED for.
    setScreenTitle: function (text) { titles.push(String(text)); },
  };

  behavior.mount(container, api);
  behavior.open({
    url: opts.url || OWNED,
    label: opts.label || 'andy',
    relayLabel: opts.relayLabel,
    canRemove: opts.canRemove !== false,
  });

  return {
    doc: doc, log: log, behavior: behavior, answers: answers, titles: titles,
    // PANELS ARE CLOSED WHEN THE SCREEN ARRIVES, so a check about what a
    // panel says has to open it first — the same click a person makes.
    // Not a shortcut into the app's state: this fires the real handler.
    open: function (id) {
      doc.getElementById('nd-body').fire('click', { target: foldTarget(id) });
      return this;
    },
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
    rows: [{ url: OWNED, label: 'spirit', owned: true }],
    // THE REPORT ARRIVES SEPARATELY NOW (R3). It sat on the row while
    // the badge was a signed status GET and the report was that
    // request's body. The relay pushes it down the stream instead, and
    // it reaches the browser under `relayStatus`, keyed by url.
    //
    // The SHAPE moved with it: `peers` is a count here, where the
    // owner-only report carried the roster itself — and `messages` is
    // gone, because R8 deleted the ring and a row reading "Messages 0"
    // would suggest the question still applies.
    relayStatus: { [OWNED]: { owner: 'andy', mode: 'keys', peers: 3, present: 1, key: 'RELAYKEY' } },
  });

  return settle().then(function () {
    // ONE AT A TIME, because that is now the rule. Opening `invite`
    // would shut `relay`, so the facts are read while `relay` is the open
    // one and the mint is checked further down on its own.
    app.open('relay');
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

    // Its own read, after its own open: with one panel open at a time
    // the facts and the mint can never be on screen together, and
    // asserting them off one snapshot was the old always-open screen.
    app.open('invite');
    if (/natter-inv-go/.test(app.body().innerHTML)) {
      test.check('and an owned mailbox offers the mint');
    } else {
      test.fail('no mint on an owned mailbox: ' + app.body().innerHTML);
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

// ── CLAIM AND RENAME ARE THE TWO HALVES OF ONE QUESTION ──────────────
//
//   Andy: "the never-bound-to-any-relay form that shows up if I'm truly
//   not bound yet, it shows up in natter, instead of natterDetails for
//   spirit.andyflinn.com"
//
// The invariant worth holding: a relay's screen offers "you are X here"
// or "claim a seat here", and never both and never neither.
function claimAndRenameAreExclusive() {
  test.subHeading('A relay screen offers one of claim and rename, never both');

  const stranger = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, owned: false, claimed: false }],
  });
  const mine = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, claimed: true, claimedLabel: 'andy' }],
  });

  return settle().then(function () {
    const onStranger = stranger.open('claim').body().innerHTML;
    const onMine = mine.open('rename').body().innerHTML;

    if (/nd-claim-go/.test(onStranger) && !/nd-name-go/.test(onStranger)) {
      test.check('a relay holding no row for this key offers Claim and not Rename');
    } else {
      test.fail('unclaimed screen offered the wrong panels');
    }

    if (/nd-name-go/.test(onMine) && !/nd-claim-go/.test(onMine)) {
      test.check('a relay that holds our row offers Rename and not Claim');
    } else {
      test.fail('claimed screen offered the wrong panels');
    }
  });
}

// A claim posted at a relay that did not answer fails at the router with
// nothing learned. Offering the form is offering to waste somebody's
// time, and `status` is the same "did it answer" test the binding check
// uses.
function aRelayThatIsDownOffersNoClaim() {
  test.subHeading('A relay that did not answer is not offered a claim form');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 0, error: 'connect ECONNREFUSED' }],
  });

  return settle().then(function () {
    if (!/nd-claim-go/.test(app.open('claim').body().innerHTML)) {
      test.check('no Claim button on a relay that could not be reached');
    } else {
      test.fail('a down relay offered a claim form');
    }
  });
}

function claimingNamesThisMailbox() {
  test.subHeading('Claiming happens on the mailbox it was opened from');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, owned: false, claimed: false }],
  });

  return settle().then(function () {
    const out = { textContent: '', className: '' };
    app.body().fire('click', {
      target: claimTarget({
        'nd-claim-name': { value: 'andy' },
        'nd-claim-token': { value: 'saint-bernard' },
        'nd-claim-invite': { value: 'saint' },
        'nd-claim-out': out,
      }),
    });

    return settle().then(function () {
      const calls = app.log.filter(function (c) { return c.url.indexOf('/api/hub/claim') === 0; });
      const body = calls.length ? JSON.parse(calls[0].body) : null;

      // THE WHOLE REASON THE FORM COULD MOVE HERE. hub.handleClaim used
      // relays.json[0] whatever the caller meant, until it took a url
      // through ownerBadge.chooseUrl like invite and rename already did.
      if (body && body.url === OWNED) {
        test.check('the claim names the mailbox this screen is, never relays.json[0]');
      } else {
        test.fail('claim body: ' + JSON.stringify(body));
      }

      // Both halves of the invite travel, and the second is required —
      // the relay refuses a token without it and does not fall back (R1).
      if (body && body.name === 'andy' && body.invite === 'saint-bernard' &&
          body.inviteLabel === 'saint') {
        test.check('and carries the label, the token and the word on the invite');
      } else {
        test.fail('claim body: ' + JSON.stringify(body));
      }

      // RETURNED, NOT RECORDED. session.json is Natter's file and api.fs
      // here is scoped to this app's own folder.
      const said = app.answers[app.answers.length - 1] || {};
      if (said.claimed === 'andy' && said.changed === true && said.url === OWNED) {
        test.check('and the seat is RETURNED, for Natter to write down against this url');
      } else {
        test.fail('answer: ' + JSON.stringify(said));
      }
    });
  });
}

// Asked for here rather than discovered as a 400 from the relay: a token
// with no word is a half-copied invite, and the two arrive together down
// one phone call.
function aHalfCopiedInviteIsRefusedBeforeItTravels() {
  test.subHeading('A token with no name on the invite never leaves the screen');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, owned: false, claimed: false }],
  });

  return settle().then(function () {
    const out = { textContent: '', className: '' };
    app.body().fire('click', {
      target: claimTarget({
        'nd-claim-name': { value: 'andy' },
        'nd-claim-token': { value: 'saint-bernard' },
        'nd-claim-invite': { value: '' },
        'nd-claim-out': out,
      }),
    });

    return settle().then(function () {
      const calls = app.log.filter(function (c) { return c.url.indexOf('/api/hub/claim') === 0; });
      if (!calls.length && /invite/.test(out.textContent) && /is-error/.test(out.className)) {
        test.check('no request made, and the screen says which half is missing');
      } else {
        test.fail(calls.length + ' requests, status "' + out.textContent + '"');
      }
    });
  });
}

// ── THE PANEL THAT MAINTAINS INVITES ─────────────────────────────────
//
//   Andy: "The relay owner maintains invites through a panel in
//   natterDetail (not implemented yet, and a pre-enrolment label is of
//   great value for that."
//
// The data has been arriving in every pushed report since R3 and nothing
// drew it. These assert that it is drawn, that the token never is, and
// that revoking aims by label rather than by row.
const INVITE_REPORT = {
  owner: 'andy', mode: 'keys', peers: 3, present: 1,
  key: 'RELAYKEY',
  invites: [
    { label: 'adam', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: 'andy' },
    { label: 'bulb', expiresAt: '2000-01-01T00:00:00.000Z', invitedBy: 'andy' },
  ],
};

function invitesOutstandingAreShown() {
  test.subHeading('What is outstanding on this relay, and who it was for');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, owned: true }],
    relayStatus: { [OWNED]: INVITE_REPORT },
  });

  return settle().then(function () {
    const html = app.open('invites').body().innerHTML;

    if (/adam/.test(html) && /bulb/.test(html)) {
      test.check('every outstanding invite is listed by the name on it');
    } else {
      test.fail('invites panel: ' + html.slice(0, 400));
    }

    // WHY THE LABEL SURVIVED R1. It is what the owner wrote down to
    // remember who they meant, and the only handle on a keyless
    // reservation.
    if (/Name on the invite/.test(html) && /Invited by/.test(html)) {
      test.check('with who minted it, which is what makes the row actionable');
    } else {
      test.fail('columns: ' + html.slice(0, 400));
    }

    // Expiry in words, and a lapsed one says so rather than showing a
    // date a person has to subtract from today.
    if (/expired/.test(html)) {
      test.check('and a lapsed invite says "expired" rather than printing a timestamp');
    } else {
      test.fail('no expiry wording: ' + html.slice(0, 400));
    }

    // NEVER THE TOKEN. It is the spoken secret; it left on a phone call
    // and the relay does not report it either.
    if (html.indexOf('token') === -1 && html.indexOf('saint-bernard') === -1) {
      test.check('and no token appears, because that is not the relay’s to repeat');
    } else {
      test.fail('a token reached the panel: ' + html.slice(0, 400));
    }
  });
}

function invitesAreOwnerOnly() {
  test.subHeading('A relay somebody else owns shows no invite panel');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, claimed: true, claimedLabel: 'andy' }],
    relayStatus: { [OWNED]: INVITE_REPORT },
  });

  return settle().then(function () {
    if (!/nd-inv-revoke/.test(app.open('invites').body().innerHTML)) {
      test.check('a member sees no invite list, because invites are the owner’s business');
    } else {
      test.fail('a non-owner was shown the invite panel');
    }
  });
}

function revokingAimsByLabel() {
  test.subHeading('Revoking names the invite, and takes two presses');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', status: 200, owned: true }],
    relayStatus: { [OWNED]: INVITE_REPORT },
  });

  return settle().then(function () {
    app.open('invites');
    const out = { textContent: '', className: '' };
    const button = revokeTarget('adam', out);

    // ARMED FIRST. Revoking is not destructive of anything that cannot be
    // redone, but it breaks a phone call that has already happened.
    app.body().fire('click', { target: button });
    return settle().then(function () {
      const early = app.log.filter(function (c) { return c.url.indexOf('/api/hub/revoke') === 0; });
      if (!early.length && /adam/.test(button.textContent)) {
        test.check('the first press arms and names what it is about to take back');
      } else {
        test.fail('first press sent ' + early.length + ' requests, button says "' +
          button.textContent + '"');
      }

      app.body().fire('click', { target: button });
      return settle().then(function () {
        // ── THROUGH THE LOOPBACK CLIENT LAYER, NOT A DOOR OF ITS OWN ──
        //
        //   Andy: "all of natter really can and must go through the
        //   shell -> clientLayer -> node -> relay"
        //
        // This looked for a call to `/api/hub/revoke`. That door existed
        // for one day and is gone: what it did was build
        // `{revoke:{label}}` and hand it to router.post, which is what a
        // peerPost IS. The browser says it directly now.
        const calls = app.log.filter(function (c) { return c.url.indexOf('/api/hub/post') === 0; });
        const sent = calls.length ? JSON.parse(calls[0].body) : null;
        const body = sent && sent.body;

        // ADDRESSED BY KEY, NOT BY URL. `ndUrl` still says which relay
        // this screen is; it no longer aims the verb. The post goes to
        // the relay's own public key and the node picks the road — which
        // is why the relay had to start naming itself in every member's
        // roster.
        if (sent && sent.to === 'RELAYKEY' && sent.app === 'relay') {
          test.check('the verb travels as a packet addressed to the relay by key');
        } else {
          test.fail('post: ' + JSON.stringify(sent));
        }

        // BY LABEL, NOT BY INDEX. The list repaints from a report that
        // arrives on its own, so an index would aim at whatever had moved
        // into that position.
        if (body && body.revoke && body.revoke.label === 'adam') {
          test.check('and names the invite by label, in the relay’s own vocabulary');
        } else {
          test.fail('revoke body: ' + JSON.stringify(body));
        }

        const said = app.answers[app.answers.length - 1] || {};
        if (said.revoked === 'adam' && said.changed === true) {
          test.check('and the list behind this screen is told to repaint');
        } else {
          test.fail('answer: ' + JSON.stringify(said));
        }
      });
    });
  });
}

function mintingNamesThisMailbox() {
  test.subHeading('Minting happens on the mailbox it was opened from');

  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', owned: true }],
    // THE REPORT ARRIVES SEPARATELY NOW (R3). It sat on the row while
    // the badge was a signed status GET and the report was that
    // request's body. The relay pushes it down the stream instead, and
    // it reaches the browser under `relayStatus`, keyed by url.
    //
    // The SHAPE moved with it: `peers` is a count here, where the
    // owner-only report carried the roster itself — and `messages` is
    // gone, because R8 deleted the ring and a row reading "Messages 0"
    // would suggest the question still applies.
    relayStatus: { [OWNED]: { owner: 'andy', mode: 'keys', peers: 3, present: 1, key: 'RELAYKEY' } },
    // What relay.mint answers, inside the envelope answerSelf replies in.
    relayAnswer: {
      ok: true,
      status: 201,
      invite: { token: 'saint-bernard', label: 'saint', expiresAt: '2099-01-01T00:00:00.000Z', invitedBy: 'andy' },
    },
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
      // ── A PACKET, NOT A DOOR (2026-09-15) ────────────────────────
      //
      // This watched `/api/hub/invite`. That door is gone with the other
      // three: it built {invite:{…}} and handed it to router.post, which
      // is what a peerPost IS.
      //
      // `url` left the body with it — the post is addressed to the
      // relay's KEY — and so did `name`, which the relay never read: the
      // owner's name comes out of allow.json, because the only sender
      // who reaches that line is the owner.
      const mints = app.log.filter(function (c) { return c.url.indexOf('/api/hub/post') === 0; });
      const sent = mints.length ? JSON.parse(mints[0].body) : null;
      const body = sent && sent.body && sent.body.invite;
      if (sent && sent.to === 'RELAYKEY' && sent.app === 'relay' &&
          body && body.label === 'saint' && body.days === 7) {
        test.check('minting travels as a packet to the relay this screen is, by key');
      } else {
        test.fail('mint body: ' + JSON.stringify(sent));
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
    app.open('relay');
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
    app.open('relay');
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
    rows: [{ url: OWNED, label: 'spirit', owned: true }],
    // THE REPORT ARRIVES SEPARATELY NOW (R3). It sat on the row while
    // the badge was a signed status GET and the report was that
    // request's body. The relay pushes it down the stream instead, and
    // it reaches the browser under `relayStatus`, keyed by url.
    //
    // The SHAPE moved with it: `peers` is a count here, where the
    // owner-only report carried the roster itself — and `messages` is
    // gone, because R8 deleted the ring and a row reading "Messages 0"
    // would suggest the question still applies.
    relayStatus: { [OWNED]: { owner: 'andy', mode: 'keys', peers: 3, present: 1, key: 'RELAYKEY' } },
    device: { password: 'p'.repeat(128), publicKey: KEY },
  });

  return settle().then(function () {
    app.open('device');
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
    rows: [{ url: OWNED, label: 'spirit', owned: true }],
    // THE REPORT ARRIVES SEPARATELY NOW (R3). It sat on the row while
    // the badge was a signed status GET and the report was that
    // request's body. The relay pushes it down the stream instead, and
    // it reaches the browser under `relayStatus`, keyed by url.
    //
    // The SHAPE moved with it: `peers` is a count here, where the
    // owner-only report carried the roster itself — and `messages` is
    // gone, because R8 deleted the ring and a row reading "Messages 0"
    // would suggest the question still applies.
    relayStatus: { [OWNED]: { owner: 'andy', mode: 'keys', peers: 3, present: 1, key: 'RELAYKEY' } },
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
    app.open('invite');
    if (/natter-inv-go/.test(app.body().innerHTML)) {
      test.check('the owned one offers its mint');
    } else {
      test.fail('no mint on the owned mailbox');
    }

    // The shell can promise that open() runs; it cannot know what is
    // stale inside. A screen that kept the last mailbox's badge would
    // offer a mint on somebody else's relay.
    app.behavior.open({ url: THEIRS, label: 'andy' });
    return settle().then(function () {
      app.open('invite');
      if (!/natter-inv-go/.test(app.body().innerHTML)) {
        test.check('and opening a mailbox we do not own takes the mint away again');
      } else {
        test.fail('the mint survived a change of subject: ' + app.body().innerHTML);
      }
    });
  });
}

// THREE SECTIONS STOOD HERE until 2026-09-13, and they proved a control
// this screen no longer has: two presses to take a relay off the list,
// the last relay offering no control at all, and arming for one mailbox
// not half-arming the next.
//
//   Andy: "the 'Take this relay off the list' should be gone for now.
//   It's nothing that bites us until there is more than one known
//   satellite in space…."
//
// They are replaced rather than deleted, because a suite that merely
// loses checks records a smaller world. What is left to assert is that
// the surface is gone and the RULE is not:
//
//   natterCanRemove and natterRemoveAt still hold "a node keeps at least
//   one relay", and spirit/test/natterLast.js still proves it. When there
//   is a second satellite, the panel is rewritten against a rule that was
//   never lost.
// WHY THE CIRCLE IS NOT GREEN, which is now the dialog's job.
//
//   Andy: "every relay on the natter list must invoke the natterDetails
//   dialog, if nothing else, the dialog explains why the relay is
//   non-green."
//
// Every row in the list opens this screen now, including the ones that
// can do nothing — and those are the rows somebody is actually asking
// about. A red glyph had a tooltip and no way in; a tooltip has room for
// a state and none for a reason or a next move.
//
// The three reds are three different afternoons, and these are two of
// them. (The third, "somebody else runs it", is the claimed-not-owned
// case and already had its own member's view.)
// FOLDING, THE MARKS, AND THE TITLE OF THE SCREEN.
//
//   Andy: "All panels in natterDetails must be foldable, and the Titlebar
//   should have the current titles, ICON.LINK 'Add one of my own
//   devices', ICON.WARNING for any of the diagnostics, The Title of the
//   entire Dialog should say 'Relay Details for <relay label>'"
//
// A screen with a device panel, an invite form and two diagnostics was a
// page to scroll past to reach the thing you came for. The marks are part
// of the bar rather than decoration: a reader scanning FOLDED bars can
// tell a warning from a thing-to-do without opening either.
function panelsFoldAndAreMarked() {
  test.subHeading('Every panel folds, one at a time, and starts shut');

  const ICON = spirit.core.const.ICON;
  const app = mountApp({
    rows: [{ url: OWNED, label: 'spirit', owned: true, status: 200,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
    device: { password: 'hunter2', publicKey: 'KEY' },
  });

  return settle().then(function () {
    const shutAll = app.body().innerHTML;

    // ARRIVES AS A LIST OF WHAT IS HERE. Bars, no bodies — five lines
    // each saying what it is and whether it is a warning, and opening one
    // is choosing.
    const bars = (shutAll.match(/class="panel-heading nd-fold"/g) || []).length;
    const bodies = (shutAll.match(/class="nd-panel-body"/g) || []).length;
    if (bars >= 3 && bodies === 0) {
      test.check('the screen arrives with every panel shut — ' + bars + ' bars, no bodies');
    } else {
      test.fail('bars ' + bars + ' bodies ' + bodies);
    }

    // THE MARKS. One meaning each, which is the whole reason they are on
    // the bar: a column of SHUT bars is still readable.
    const deviceBar = shutAll.slice(shutAll.indexOf('Add one of my own devices') - 200,
      shutAll.indexOf('Add one of my own devices'));
    if (deviceBar.indexOf(ICON.LINK) !== -1) {
      test.check('the device panel wears ' + ICON.LINK + ' — a thing to do, not a warning');
    } else {
      test.fail('device bar: ' + deviceBar.slice(-120));
    }

    app.open('device');
    const oneOpen = app.body().innerHTML;
    if ((oneOpen.match(/class="nd-panel-body"/g) || []).length === 1 &&
        oneOpen.indexOf('natter-dev-copy') !== -1) {
      test.check('pressing a bar opens that one, and only that one');
    } else {
      test.fail('after opening device: ' +
        (oneOpen.match(/class="nd-panel-body"/g) || []).length + ' bodies');
    }

    // ONE AT A TIME. Opening another shuts the first — two open bodies
    // and the bars stop being a list.
    app.open('invite');
    const swapped = app.body().innerHTML;
    if ((swapped.match(/class="nd-panel-body"/g) || []).length === 1 &&
        swapped.indexOf('natter-inv-go') !== -1 &&
        swapped.indexOf('natter-dev-copy') === -1) {
      test.check('and opening another shuts the first — never two at once');
    } else {
      test.fail('after swapping: ' + swapped.slice(0, 300));
    }

    // AND THE OPEN ONE CLOSES. A bar that could only hand over to another
    // bar would be a screen with no way back to the list.
    app.open('invite');
    if ((app.body().innerHTML.match(/class="nd-panel-body"/g) || []).length === 0) {
      test.check('and pressing the open one shuts it, leaving the list again');
    } else {
      test.fail('the open panel would not close');
    }

    // THE MARK FOLLOWS. A shut panel must not look like an empty one.
    app.open('device');
    const marked = app.body().innerHTML;
    const openBar = marked.slice(marked.indexOf('Add one of my own devices') - 200,
      marked.indexOf('Add one of my own devices'));
    if (openBar.indexOf(ICON.POINTDOWN) !== -1) {
      test.check('an open bar points down and a shut one points right');
    } else {
      test.fail('open bar: ' + openBar.slice(-120));
    }

    // AND THE DEFAULT IS THE DEFAULT. Arriving at a relay with something
    // already open would be this screen deciding what the question is
    // before it has been asked.
    app.behavior.open({ url: OWNED, label: 'andy', relayLabel: 'spirit' });
    return settle().then(function () {
      if ((app.body().innerHTML.match(/class="nd-panel-body"/g) || []).length === 0) {
        test.check('and a fresh visit starts shut again, whatever was open last time');
      } else {
        test.fail('a panel survived the next open()');
      }
      return titleNamesTheRelay();
    });
  });
}

// The shell titles a dialog with the app's NAME, which here is the least
// useful word available: every one of these screens is "Relay Details",
// and the question is which relay.
function titleNamesTheRelay() {
  test.subHeading('The screen says which relay it is about');

  const named = mountApp({
    relayLabel: 'spirit',
    rows: [{ url: OWNED, label: 'spirit', owned: true, status: 200,
      report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
  });

  return settle().then(function () {
    if (named.titles.indexOf('Relay Details for spirit') !== -1) {
      test.check('the title names the relay the list calls it');
    } else {
      test.fail('titles: ' + JSON.stringify(named.titles));
    }

    // NO LABEL, so the url. A title reading "Relay Details for" and then
    // nothing is worse than a long one.
    const bare = mountApp({
      relayLabel: '',
      rows: [{ url: OWNED, label: '', owned: true, status: 200,
        report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
    });
    return settle().then(function () {
      if (bare.titles.some(function (t) { return t.indexOf(OWNED) !== -1; })) {
        test.check('and falls back to the address when the list has no caption for it');
      } else {
        test.fail('titles: ' + JSON.stringify(bare.titles));
      }
    });
  });
}

function theRedIsExplained() {
  test.subHeading('A relay that is not green says why');

  // 1. NOTHING ANSWERED. A box that is off and an address with a typo in
  //    it look identical from here, so the screen says that rather than
  //    picking one.
  const silent = mountApp({
    rows: [{ url: OWNED, label: 'spirit', owned: false, status: 0, error: 'connect ECONNREFUSED' }],
  });

  return settle().then(function () {
    silent.open('why-red');
    const html = silent.body().innerHTML;
    if (/did not answer/i.test(html) && html.indexOf('connect ECONNREFUSED') !== -1) {
      test.check('a relay that did not answer says so, and carries the reason it was given');
    } else {
      test.fail('silent relay: ' + html.slice(0, 400));
    }

    // AND IT DOES NOT BLAME THE NODE. The first thing somebody thinks
    // when a screen goes red is that they broke something.
    if (/Nothing is wrong with your node/i.test(html)) {
      test.check('and says the node is not the problem, which is the first thing anyone assumes');
    } else {
      test.fail('no reassurance: ' + html.slice(0, 400));
    }

    // 2. IT ANSWERED AND HAS NO ROW FOR YOU. The one red with an actual
    //    next move, so the next move is the paragraph.
    const stranger = mountApp({
      rows: [{ url: OWNED, label: 'spirit', owned: false, claimed: false, status: 403, error: 'not the owner' }],
    });
    return settle().then(function () {
      stranger.open('why-red');
      const said = stranger.body().innerHTML;
      if (/you are not on it/i.test(said) && /invite/i.test(said)) {
        test.check('a relay that answered but has no row for you says so, and names the way on');
      } else {
        test.fail('stranger relay: ' + said.slice(0, 400));
      }

      return labRelayIsExplained();
    });
  });
}

// A LOCAL RELAY IS EXPLAINED WHETHER IT IS GREEN OR NOT.
//
//   Andy: "another bubble that should automatically appear if the URL is
//   local to this machine… a lay person readable explanation"
//
// This started as a sentence inside the red explanation, and that was
// wrong in the case that matters most: a lab relay that is RUNNING shows
// a green circle and a perfectly good report, and is still useless for
// reaching anybody. Green answers "did it reply". It has never answered
// "can a peer get to me here", and those two come apart exactly here.
function labRelayIsExplained() {
  test.subHeading('A relay only this machine can reach says so');

  const LAB = 'http://127.0.0.1:65425';

  // DOWN: two bubbles, and they are about different things — one says
  // nothing answered, the other says it would not have helped.
  const down = mountApp({
    url: LAB,
    rows: [{ url: LAB, label: 'lab', owned: false, status: 0, error: 'ECONNREFUSED' }],
  });

  return settle().then(function () {
    down.open('local');
    const html = down.body().innerHTML;
    if (/Why this relay is not useful/.test(html) && /did not answer/.test(html)) {
      test.check('a local relay that is down gets both bubbles — what happened, and why it would not have mattered');
    } else {
      test.fail('down lab: ' + html.slice(0, 400));
    }

    // THE CASE THE SPLIT EXISTS FOR. Running, owned, green, a full
    // report — and still nobody else can reach it.
    const up = mountApp({
      url: LAB,
      rows: [{ url: LAB, label: 'lab', owned: true, status: 200,
        report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
    });
    return settle().then(function () {
      up.open('local');
      const green = up.body().innerHTML;
      if (/Why this relay is not useful/.test(green)) {
        test.check('and a lab relay that is UP and owned still says it — green means it replied, not that a peer can reach you');
      } else {
        test.fail('green lab: ' + green.slice(0, 400));
      }

      // PLAIN WORDS. "Loopback" and "publicly routable" are the correct
      // terms and neither of them tells anybody what to do next.
      //
      // Scoped to THIS bubble's own text. The first version of this check
      // read to the end of the panel and counted the relay's url, printed
      // further down by another bubble entirely, as jargon.
      const from = green.indexOf('Why this relay is not useful');
      const bubble = green.slice(from, green.indexOf('</div>', green.indexOf('class="muted"', from)));
      const jargon = /loopback|publicly routable|\bNAT\b|port forward/i.test(bubble);
      if (!jargon && /nobody else on the internet can/i.test(bubble)) {
        test.check('in words a person can act on, with none of the right technical terms in it');
      } else {
        test.fail('jargon or no explanation: ' + bubble.slice(0, 400));
      }

      // AND A PUBLIC RELAY DOES NOT GET IT, or the bubble would be
      // furniture rather than a warning.
      const pub = mountApp({
        rows: [{ url: OWNED, label: 'spirit', owned: true, status: 200,
          report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } }],
      });
      return settle().then(function () {
        if (!/Why this relay is not useful/.test(pub.body().innerHTML)) {
          test.check('while a public relay never shows it');
        } else {
          test.fail('the bubble appeared on a public relay');
        }
      });
    });
  });
}

function noRemovalSurfaceForNow() {
  test.subHeading('Taking a relay off the list is not offered');

  const app = mountApp({
    canRemove: true,
    rows: [
      { url: OWNED, label: 'spirit', owned: true, report: { owner: 'andy', mode: 'keys', peers: [], messages: 0 } },
      { url: THEIRS, label: 'theirs', owned: false, claimed: true, census: { owner: 'carol', peers: 4, myLabel: 'bert' } },
    ],
  });

  return settle().then(function () {
    app.open('relay');
    const panel = app.body().innerHTML;

    // EVEN WITH canRemove TRUE. The old screen showed the control when
    // the list said it could; this one shows it never, so a caller still
    // passing the flag cannot bring it back by accident.
    if (panel.indexOf('natter-forget-go') === -1 &&
        panel.indexOf('Take this relay off the list') === -1) {
      test.check('no removal control, even for a node that lists two relays');
    } else {
      test.fail('the panel came back: ' + panel.slice(-300));
    }

    // AND NO PARAGRAPH IN ITS PLACE. The version that could not remove
    // explained why instead, which is a sentence answering a question
    // nobody asked while there is one satellite.
    if (!/keeps at least one/.test(panel)) {
      test.check('and no paragraph explaining a control that is not there');
    } else {
      test.fail('the explanation outlived the control');
    }

    // Nothing this screen ever did wrote relays.json — it returned an
    // answer for the list to perform. With no answer to return, there is
    // still nothing written, and that is worth keeping said.
    const wrote = app.log.filter(function (c) { return /relays\.json/.test(c.url); });
    if (!wrote.length) {
      test.check('and this screen still writes nothing — the file belongs to the list');
    } else {
      test.fail('the screen wrote: ' + JSON.stringify(wrote));
    }
  });
}


ownedMailbox()
  .then(invitesOutstandingAreShown)
  .then(invitesAreOwnerOnly)
  .then(revokingAimsByLabel)
  .then(claimAndRenameAreExclusive)
  .then(aRelayThatIsDownOffersNoClaim)
  .then(claimingNamesThisMailbox)
  .then(aHalfCopiedInviteIsRefusedBeforeItTravels)
  .then(mintingNamesThisMailbox)
  .then(someoneElsesMailbox)
  .then(aStrangersMailbox)
  .then(theDevicePanel)
  .then(thePanelAsksOnce)
  .then(openingAnotherMailboxLetsGoOfTheLast)
  .then(panelsFoldAndAreMarked)
  .then(theRedIsExplained)
  .then(noRemovalSurfaceForNow)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('natterDetails threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });
