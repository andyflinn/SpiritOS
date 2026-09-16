'use strict';

// spirit/test/nodeInfo.js
// The Info app, and the two fields underneath it.
//
//   Andy: "i want an intrinsic app info, in which, for now the user can
//   maintain both fields in this file, more to come."
//
// ── THE APP IS DRIVEN AGAINST THE REAL NODE SIDE ─────────────────────
//
// `api.verb` here does not answer a fixture: it calls nodeCard against a
// real identity.json in a temp directory, which is what the three loopback
// verbs do. So "typing 200 characters and pressing Save leaves 128 on the
// screen" is proven by the code that trims rather than by a stub somebody
// remembered to make trim.
//
// That is worth the extra ten lines because the trim is the one behaviour
// here that is a SURPRISE — the node shortens prose rather than refusing
// it — and a fixture agreeing with the app about a surprise proves nothing
// at all.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const labelRule = require('../run/js/labelRule');
const nodeCard = require('../run/js/nodeCard');

const APP_SCRIPT = path.join(__dirname, '..', 'run', 'app', 'info', 'info.js');

function tmpHome(name) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-info-'));
  auth.saveIdentity(home, auth.generateIdentity(name));
  return home;
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id,
    value: '',
    textContent: '',
    className: '',
    listeners: {},
    addEventListener: function (event, fn) {
      (el.listeners[event] = el.listeners[event] || []).push(fn);
    },
    fire: function (event, arg) {
      (el.listeners[event] || []).forEach(function (fn) { fn(arg || {}); });
    },
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return html; },
    set: function (v) { html = String(v); },
    enumerable: true,
  });
  return el;
}

function fakeDocument() {
  const byId = {};
  return {
    byId: byId,
    getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); },
    createElement: fakeElement,
  };
}

// The app, wired to a real identity on disk.
function mountApp(home) {
  const doc = fakeDocument();
  const asked = [];

  const api = {
    verb: function (name, args) {
      asked.push(name);
      const body = args || {};
      let said;
      if (name === 'node.card') {
        const card = nodeCard.read(home);
        said = card ? Object.assign({ ok: true }, card) : { ok: false, error: 'no key' };
      } else if (name === 'node.setName') {
        said = nodeCard.setName(home, body.name);
      } else if (name === 'node.setDescription') {
        said = nodeCard.setDescription(home, body.description);
      } else {
        said = { ok: false, error: 'no such verb: ' + name };
      }
      return Promise.resolve({ status: said.ok ? 200 : (said.status || 400), body: said });
    },
  };

  let behavior = null;
  const shellSpirit = { shell: { activateApp: function (b) { behavior = b; } } };
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  // The browser's copy of the rule, which is the same file the node
  // requires — that is the whole point of labelRule being isomorphic.
  const win = { spiritLabelRule: labelRule };
  new Function('spirit', 'document', 'window', src)(shellSpirit, doc, win);

  const container = fakeElement('container');
  behavior.mount(container, api);
  return { doc: doc, asked: asked, api: api, container: container };
}

function el(app, id) { return app.doc.getElementById(id); }

// One turn of the microtask queue is all these promises need — every
// answer above resolves immediately.
function settle() {
  return Promise.resolve().then(function () {}).then(function () {}).then(function () {});
}

// ── 1. THE FIELDS ────────────────────────────────────────────────────

function theRules() {
  test.subHeading('What a node may call itself, and say about itself');

  const home = tmpHome('andy');

  const fresh = nodeCard.read(home);
  if (fresh && fresh.name === 'andy' && fresh.description === '') {
    test.check('a fresh node has the name it was minted with and no description');
  } else {
    test.fail('fresh: ' + JSON.stringify(fresh));
  }

  // EMPTY IS A LEGAL DESCRIPTION and an illegal name. The asymmetry is
  // not tidiness: deviceTick refuses enrolment outright when `id.name` is
  // empty, so a text box that could clear it would break phone attachment
  // from a screen that says nothing about phones.
  const cleared = nodeCard.setDescription(home, '');
  if (cleared.ok) {
    test.check('a description may be cleared — not having written one is an ordinary state');
  } else {
    test.fail('clearing refused: ' + JSON.stringify(cleared));
  }

  const noName = nodeCard.setName(home, '   ');
  if (!noName.ok && noName.status === 400 && /required/.test(noName.error)) {
    test.check('and a name may not, because a node with none cannot be enrolled to');
  } else {
    test.fail('empty name: ' + JSON.stringify(noName));
  }

  // THE INVISIBLE IS REFUSED IN BOTH, and for one reason: the two sit in
  // the same row of somebody else's list, and a bidi override reverses
  // that row just as well from either field.
  const bidi = nodeCard.setDescription(home, 'jazz \u202E and a synth');
  if (!bidi.ok && /invisible/.test(bidi.error)) {
    test.check('an invisible character is refused in a description');
  } else {
    test.fail('bidi: ' + JSON.stringify(bidi));
  }

  const bidiName = nodeCard.setName(home, 'andy\u200B');
  if (!bidiName.ok && /invisible/.test(bidiName.error)) {
    test.check('and in a name, by the same rule the relay enforces on a rename');
  } else {
    test.fail('bidi name: ' + JSON.stringify(bidiName));
  }

  // LENGTH IS NOT REFUSED. Prose slightly too long is shortened, not
  // rejected — and the caller is told what was STORED so it cannot draw
  // its own input back into the box.
  const long = 'x'.repeat(400);
  const trimmed = nodeCard.setDescription(home, long);
  if (trimmed.ok && Buffer.byteLength(trimmed.description, 'utf8') === labelRule.DESCRIPTION_MAX_BYTES) {
    test.check('prose too long is trimmed to fit rather than refused');
  } else {
    test.fail('trim: ' + JSON.stringify(trimmed).slice(0, 120));
  }

  if (trimmed.description !== long) {
    test.check('and what comes back is what was stored, not what was sent');
  } else {
    test.fail('the input was echoed');
  }

  // COUNTED IN BYTES, which is what the cap is in. A counter that counted
  // characters would let four emoji through where one fits and truncate
  // somebody mid-word with no warning.
  if (labelRule.describeRemaining('🎹') === labelRule.DESCRIPTION_MAX_BYTES - 4) {
    test.check('the countdown is in bytes, so an emoji costs four and not one');
  } else {
    test.fail('remaining: ' + labelRule.describeRemaining('🎹'));
  }

  // ── AND IT IS THE SAME CARD A STRANGER GETS ──────────────────────
  //
  // The screen and the wire read one function (nodeCard.read), so an
  // editor cannot show you something other than what is being sent. This
  // is the assertion that keeps that true.
  nodeCard.setName(home, 'Andy Flinn');
  nodeCard.setDescription(home, 'jazz, and a synth in the corner');
  const mine = nodeCard.read(home);
  const theirs = JSON.parse(nodeCard.describe(home)).body;
  if (mine.name === theirs.name && mine.description === theirs.description) {
    test.check('what the owner is shown is what a stranger is answered');
  } else {
    test.fail('drift: ' + JSON.stringify(mine) + ' vs ' + JSON.stringify(theirs));
  }
}

// ── 2. THE SCREEN ────────────────────────────────────────────────────

function theScreen() {
  test.subHeading('And the screen that maintains them');

  const home = tmpHome('sonny');
  nodeCard.setDescription(home, 'jazz, and a synth in the corner');
  const app = mountApp(home);

  return settle().then(function () {
    if (el(app, 'info-name').value === 'sonny' &&
        el(app, 'info-description').value === 'jazz, and a synth in the corner') {
      test.check('it opens on what this node currently says about itself');
    } else {
      test.fail('loaded: ' + el(app, 'info-name').value + ' / ' + el(app, 'info-description').value);
    }

    // THE KEY IS SHOWN AND IS NOT A FIELD. It is the identity and cannot
    // be edited, so §1 says do not build a control for it — but a screen
    // about your identity that hides the only part that IS the identity
    // is coy about the wrong half.
    if (el(app, 'info-key').textContent === nodeCard.read(home).publicKey) {
      test.check('with the key at the foot, where there is nothing to do to it');
    } else {
      test.fail('key: ' + el(app, 'info-key').textContent);
    }

    if (/info-name/.test(app.container.innerHTML) &&
        !/password/.test(app.container.innerHTML)) {
      test.check('and no password on it — that screen is device.info\'s and not this one');
    } else {
      test.fail('markup: ' + app.container.innerHTML.slice(0, 200));
    }

    // ── A SAVE REACHES DISK ────────────────────────────────────────
    el(app, 'info-description').value = 'no small talk, please';
    el(app, 'info-description-save').fire('click');

    return settle().then(function () {
      if (nodeCard.read(home).description === 'no small talk, please') {
        test.check('pressing Save puts it in identity.json');
      } else {
        test.fail('on disk: ' + JSON.stringify(nodeCard.read(home)));
      }

      // RETURN IS THE SAME GESTURE, for the hand that never leaves the
      // keyboard. Every other single-field form in the shell does this.
      el(app, 'info-name').value = 'Sonny Rollins';
      el(app, 'info-name').fire('keydown', { key: 'Enter', preventDefault: function () {} });

      return settle().then(function () {
        if (nodeCard.read(home).name === 'Sonny Rollins') {
          test.check('and so does Return in the field');
        } else {
          test.fail('after Return: ' + JSON.stringify(nodeCard.read(home)));
        }

        // ── THE TRIM IS VISIBLE, WHICH IS THE POINT ──────────────────
        //
        // The node shortens prose silently. A screen that kept showing
        // the long version would mean the first person to learn the
        // description had been cut is somebody ELSE, reading the card.
        el(app, 'info-description').value = 'y'.repeat(300);
        el(app, 'info-description-save').fire('click');

        return settle().then(function () {
          const shown = el(app, 'info-description').value;
          if (shown.length === labelRule.DESCRIPTION_MAX_BYTES && shown !== 'y'.repeat(300)) {
            test.check('an over-long description comes back trimmed, into the box');
          } else {
            test.fail('after trim: ' + shown.length + ' characters');
          }

          if (/trimmed/.test(el(app, 'info-description-error').textContent)) {
            test.check('and the screen says so rather than letting it be discovered later');
          } else {
            test.fail('said: ' + el(app, 'info-description-error').textContent);
          }

          // ── A REFUSAL LANDS UNDER THE FIELD THAT CAUSED IT ─────────
          // Counted from HERE, because a legitimate save above already
          // asked for one — the question is whether the REFUSED press
          // adds another.
          const askedBefore = app.asked.length;
          el(app, 'info-name').value = '   ';
          el(app, 'info-name-save').fire('click');

          return settle().then(function () {
            if (/required/.test(el(app, 'info-name-error').textContent) &&
                el(app, 'info-name-error').className === 'job-start-error') {
              test.check('an empty name is refused, in red, under the name');
            } else {
              test.fail('refusal: ' + el(app, 'info-name-error').textContent +
                ' [' + el(app, 'info-name-error').className + ']');
            }

            if (nodeCard.read(home).name === 'Sonny Rollins') {
              test.check('and nothing was written');
            } else {
              test.fail('the refusal wrote anyway: ' + JSON.stringify(nodeCard.read(home)));
            }

            // AND IT NEVER LEFT THE BROWSER. labelRule is the same rule
            // both sides, so a field that is already wrong is not a hop
            // (Andy: "an input field should validate before taxing the
            // wire"). The node still refuses it; this is the courtesy
            // half, and it is only a courtesy if it actually saves the
            // hop.
            if (app.asked.length === askedBefore) {
              test.check('without asking the node something it already knew the answer to');
            } else {
              test.fail('asked anyway: ' + app.asked.slice(askedBefore).join(', '));
            }

            // ── THE COUNTDOWN ──────────────────────────────────────
            el(app, 'info-description').value = 'short';
            el(app, 'info-description').fire('input');
            if (el(app, 'info-description-count').textContent ===
                (labelRule.DESCRIPTION_MAX_BYTES - 5) + ' left') {
              test.check('the counter says what is left while the cursor is in the box');
            } else {
              test.fail('counter: ' + el(app, 'info-description-count').textContent);
            }

            el(app, 'info-description').value = 'z'.repeat(200);
            el(app, 'info-description').fire('input');
            const over = el(app, 'info-description-count');
            if (/too many/.test(over.textContent) && over.className === 'job-start-error') {
              test.check('and goes red past the cap, because past there the node stops keeping it');
            } else {
              test.fail('over: ' + over.textContent + ' [' + over.className + ']');
            }
          });
        });
      });
    });
  });
}

// ── 3. NO TICK ───────────────────────────────────────────────────────

function noTick() {
  test.subHeading('And it is not driven by the job tick');

  const home = tmpHome('quiet');
  const doc = fakeDocument();
  let behavior = null;
  const shellSpirit = { shell: { activateApp: function (b) { behavior = b; } } };
  const src = fs.readFileSync(APP_SCRIPT, 'utf8');
  new Function('spirit', 'document', 'window', src)(
    shellSpirit, doc, { spiritLabelRule: labelRule }
  );

  // NOTHING HERE CHANGES ON ITS OWN — this app is the only writer of
  // either field — so a repaint could only ever arrive while somebody is
  // typing and take the cursor out of the box. Every app in the tree that
  // needed a focus guard needed one because it was being ticked; the way
  // not to need one is not to be.
  if (!behavior.render) {
    test.check('the app defines no render, so the shell repaints it on no tick');
  } else {
    test.fail('a render hook appeared — a form that repaints itself loses the cursor');
  }

  if (!behavior.open) {
    test.check('and no open, because it is an app and not a dialog');
  } else {
    test.fail('an open hook appeared');
  }

  fs.rmSync(home, { recursive: true, force: true });
}

test.startTest('Info — what this node says about itself');

theRules();
theScreen()
  .then(function () { noTick(); })
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
