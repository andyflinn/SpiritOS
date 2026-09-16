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

// ── A RELAY, AS FAR AS THIS SCREEN IS CONCERNED ──────────────────────
//
//   { url, label, relayKey, calls, claimed, refuses }
//
// `calls` is what that relay currently calls this node, and a successful
// rename MOVES IT — so the next `relay.status` answers the new label and
// the test can tell "the table repainted from the relays" from "the table
// repainted from what was typed". A fixture that did not move would make
// those two indistinguishable, which is the one thing worth proving here.
//
// `refuses` is a string: what that relay says instead of yes. The real
// ones say "name reserved by a live invite"; a node with no stream to a
// relay never gets that far and hears "that peer is not reachable right
// now" from its own hub. Both arrive here as the same shape.
function relayFixture(over) {
  return Object.assign({
    url: 'https://a.example',
    label: 'a',
    relayKey: 'RELAYKEY-A',
    calls: 'andy',
    claimed: true,
    refuses: '',
  }, over || {});
}

// The app, wired to a real identity on disk and a set of fake relays.
function mountApp(home, relays) {
  const doc = fakeDocument();
  const asked = [];
  const posted = [];
  const boxes = relays || [];

  const api = {
    escapeHtml: function (t) {
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

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
      } else if (name === 'relay.status') {
        // The shape ownerBadge.probe answers with: one row per configured
        // relay, `claimed` where this key holds a seat, `claimedLabel`
        // read off the public census by key, and the relay's own key on
        // `census` — which is the address a rename is posted to.
        said = {
          ok: true,
          rows: boxes.map(function (b) {
            const row = { url: b.url, label: b.label, status: 200, owned: false, claimed: b.claimed };
            if (b.claimed) {
              row.claimedLabel = b.calls;
              // A relay that answered but said nothing about its key gets
              // no census — the real `censusFacts` returns null when the
              // census cannot be read, and this screen must cope.
              if (b.relayKey) row.census = { relayKey: b.relayKey, myLabel: b.calls };
            } else {
              row.error = 'no row here';
            }
            return row;
          }),
        };
      } else {
        said = { ok: false, error: 'no such verb: ' + name };
      }
      return Promise.resolve({ status: said.ok ? 200 : (said.status || 400), body: said });
    },

    // THE ONE CALL THAT PUTS ANYTHING ON THE WIRE. Addressed by KEY, like
    // any other peer — a relay is a peer to its members (relay.streamRoster)
    // — and answered by relay.renameSelf on the far side.
    peerPost: function (packetApp, toKey, body) {
      posted.push({ app: packetApp, to: toKey, body: body });
      const box = boxes.filter(function (b) { return b.relayKey === toKey; })[0];
      if (!box) {
        return Promise.resolve({ ok: false, status: 503, body: null,
          error: 'that peer is not reachable right now' });
      }
      if (box.refuses) {
        return Promise.resolve({ ok: false, status: 200,
          body: { ok: false, error: box.refuses } });
      }
      const was = box.calls;
      box.calls = body.rename.label;
      return Promise.resolve({ ok: true, status: 200,
        body: { ok: true, was: was, label: box.calls } });
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
  return { doc: doc, asked: asked, posted: posted, relays: boxes, api: api, container: container };
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

// ── 3. ONE NAME, SENT EVERYWHERE ─────────────────────────────────────
//
//   Andy: "when I'm on the phone with a friend to connect, i have no idea
//   which 'relay' contains which 'label' of mine. i want this app to
//   distribute my label to ALL relays I'm a member of."
//
// The screen could pass every check above while doing nothing at all on
// the wire, because the local write was the whole of it. This is the half
// that makes it a distribution.

function theFanOut() {
  test.subHeading('One name, sent to every relay this node has a seat on');

  const home = tmpHome('andy');
  const app = mountApp(home, [
    relayFixture({ url: 'https://a.example', label: 'lab', relayKey: 'KEY-A', calls: 'andy' }),
    relayFixture({ url: 'https://b.example', label: 'spirit', relayKey: 'KEY-B', calls: 'andy-old' }),
    // A relay this node merely LISTS. There is no row here to rename, and
    // posting to it would be asking a stranger's mailbox to change a name
    // it does not hold.
    relayFixture({ url: 'https://c.example', label: 'elsewhere', claimed: false }),
  ]);

  return settle().then(function () {
    // THE DRIFT IS ON THE SCREEN BEFORE ANYTHING IS PRESSED. That is the
    // complaint answered: the two relays disagree, and you can see which.
    const table = el(app, 'info-relays').innerHTML;
    if (/lab/.test(table) && /spirit/.test(table) && /andy-old/.test(table)) {
      test.check('it opens showing what each relay calls you');
    } else {
      test.fail('table: ' + table);
    }

    if (/out of step/.test(table)) {
      test.check('and marks the one that disagrees with the name above');
    } else {
      test.fail('drift not marked: ' + table);
    }

    if (/no seat here/.test(table)) {
      test.check('and says so for a relay this node merely lists');
    } else {
      test.fail('the seatless relay is unexplained: ' + table);
    }

    // ── ONE SAVE ─────────────────────────────────────────────────────
    el(app, 'info-name').value = 'andyflinn';
    el(app, 'info-name-save').fire('click');

    return settle().then(settle).then(settle).then(function () {
      if (nodeCard.read(home).name === 'andyflinn') {
        test.check('pressing Save writes the name here');
      } else {
        test.fail('local: ' + JSON.stringify(nodeCard.read(home)));
      }

      const sent = app.posted.filter(function (p) { return p.body && p.body.rename; });
      const to = sent.map(function (p) { return p.to; }).sort();
      if (to.length === 2 && to[0] === 'KEY-A' && to[1] === 'KEY-B') {
        test.check('and posts it to every relay it holds a seat on');
      } else {
        test.fail('posted to: ' + JSON.stringify(to));
      }

      if (sent.every(function (p) { return p.body.rename.label === 'andyflinn'; })) {
        test.check('as an ordinary rename packet, addressed to the relay by key');
      } else {
        test.fail('bodies: ' + JSON.stringify(sent.map(function (p) { return p.body; })));
      }

      // THE ONE IT MUST NOT ASK. A relay this key holds no row on has
      // nothing to rename.
      if (!app.posted.some(function (p) { return p.to === 'RELAYKEY-A'; })) {
        test.check('and asks nothing of a relay it has no seat on');
      } else {
        test.fail('posted to a relay with no seat: ' + JSON.stringify(app.posted));
      }

      const after = el(app, 'info-relays').innerHTML;
      if (!/andy-old/.test(after) && !/out of step/.test(after)) {
        test.check('the table repaints, and the relay that was out of step is not any more');
      } else {
        test.fail('after: ' + after);
      }

      if (/agree/.test(el(app, 'info-name-error').textContent)) {
        test.check('and the screen says how many relays took it');
      } else {
        test.fail('said: ' + el(app, 'info-name-error').textContent);
      }
    });
  });
}

// ── 4. AND A RELAY THAT SAYS NO ──────────────────────────────────────
//
// Partial failure is the NORMAL case here, not an error state: a relay can
// be down for days, and a live invite can hold the name you want. What
// this asserts is the rule that makes the feature usable at all — local is
// the intent, the relays catch up, and one refusal costs the others
// nothing.
function aRelayThatSaysNo() {
  test.subHeading('And a relay that refuses costs the others nothing');

  const home = tmpHome('andy');
  const app = mountApp(home, [
    relayFixture({ url: 'https://a.example', label: 'lab', relayKey: 'KEY-A', calls: 'andy' }),
    relayFixture({ url: 'https://b.example', label: 'spirit', relayKey: 'KEY-B', calls: 'andy',
      refuses: 'name reserved by a live invite' }),
  ]);

  return settle().then(function () {
    el(app, 'info-name').value = 'andyflinn';
    el(app, 'info-name-save').fire('click');

    return settle().then(settle).then(settle).then(function () {
      if (app.relays[0].calls === 'andyflinn') {
        test.check('the relay that accepted is renamed');
      } else {
        test.fail('relay A: ' + app.relays[0].calls);
      }

      if (app.relays[1].calls === 'andy') {
        test.check('and the one that refused is not');
      } else {
        test.fail('relay B: ' + app.relays[1].calls);
      }

      // LOCAL STANDS. Otherwise a node with one unreachable relay could
      // never record what it wants to be called — and the name here is the
      // INTENT, which is exactly what the relays have yet to catch up with.
      if (nodeCard.read(home).name === 'andyflinn') {
        test.check('the local name stands, because it is the intent and not a mirror');
      } else {
        test.fail('local was rolled back: ' + JSON.stringify(nodeCard.read(home)));
      }

      const table = el(app, 'info-relays').innerHTML;
      if (/reserved by a live invite/.test(table)) {
        test.check('and the row says WHY, not merely that it failed');
      } else {
        test.fail('table: ' + table);
      }

      const said = el(app, 'info-name-error').textContent;
      if (/1 of 2/.test(said) && el(app, 'info-name-error').className === 'job-start-error') {
        test.check('with the count in red, because this is not finished');
      } else {
        test.fail('said: ' + said + ' [' + el(app, 'info-name-error').className + ']');
      }

      // AND PRESSING SAVE AGAIN TRIES AGAIN. There is no background job
      // reconciling this: the row that disagrees is the prompt, and the
      // gesture that fixes it is the one already on the screen.
      app.relays[1].refuses = '';
      const before = app.posted.length;
      el(app, 'info-name-save').fire('click');

      return settle().then(settle).then(settle).then(function () {
        if (app.posted.length > before && app.relays[1].calls === 'andyflinn') {
          test.check('and pressing Save again asks the relay that refused, once more');
        } else {
          test.fail('retry: ' + app.posted.length + ' posts, B calls ' + app.relays[1].calls);
        }
      });
    });
  });
}

// ── 5. A NODE ON NO RELAY ────────────────────────────────────────────

function aNodeOnNoRelay() {
  test.subHeading('A node on no relay still has a name');

  const home = tmpHome('alone');
  const app = mountApp(home, []);

  return settle().then(function () {
    el(app, 'info-name').value = 'solo';
    el(app, 'info-name-save').fire('click');

    return settle().then(settle).then(settle).then(function () {
      if (nodeCard.read(home).name === 'solo') {
        test.check('it saves');
      } else {
        test.fail('local: ' + JSON.stringify(nodeCard.read(home)));
      }

      if (app.posted.length === 0) {
        test.check('and posts to nobody, because there is nobody to tell');
      } else {
        test.fail('posted anyway: ' + JSON.stringify(app.posted));
      }

      // NOTHING IS DRAWN. A heading over an empty table is a thing to read
      // and dismiss (UI_DESIGN_STYLE §1), and `#info-relays:empty`
      // collapses the panel so it takes no space either.
      if (el(app, 'info-relays').innerHTML === '') {
        test.check('and draws no relay table at all rather than an empty one');
      } else {
        test.fail('drew: ' + el(app, 'info-relays').innerHTML);
      }

      if (el(app, 'info-name-error').textContent === 'saved') {
        test.check('and says only that it saved, with no count of nobody');
      } else {
        test.fail('said: ' + el(app, 'info-name-error').textContent);
      }
    });
  });
}

// ── 6. A NODE THAT HAS NEVER BEEN DESCRIBED ──────────────────────────
//
//   Andy: "lots of empty node-descriptions right now ... on boot: the
//   node should fill the description 'this node described for the first
//   time [date / time string].' this gives likely different strings by
//   default."
//
// The property is SAMENESS, not emptiness — so the check that matters is
// that two nodes do not get one string.

function theFirstDescription() {
  test.subHeading('A node with nothing to say says when it first had nothing to say');

  const home = tmpHome('fresh');
  if (nodeCard.read(home).description === '') {
    test.check('a minted identity has no description at all');
  } else {
    test.fail('minted with: ' + JSON.stringify(nodeCard.read(home)));
  }

  const first = nodeCard.ensureDescription(home, new Date('2026-09-17T14:23:07.891Z'));
  if (/^this node described for the first time /.test(first)) {
    test.check('and boot fills one rather than leaving the gap');
  } else {
    test.fail('first: ' + JSON.stringify(first));
  }

  // TO THE SECOND, AND SPELLED OUT. It is read by a person off a screen
  // where it stands in for somebody's name, so it is not an ISO stamp
  // with a T and a Z in it — and not milliseconds either, which would buy
  // uniqueness nobody needs at the cost of a string with a decimal point.
  if (first.indexOf('2026-09-17 14:23:07 UTC') !== -1 && first.indexOf('891') === -1) {
    test.check('as a date and a time to the second, in UTC, with no machine punctuation');
  } else {
    test.fail('shape: ' + first);
  }

  if (nodeCard.read(home).description === first) {
    test.check('and it is on disk, not merely returned');
  } else {
    test.fail('not stored: ' + JSON.stringify(nodeCard.read(home)));
  }

  // ── THE POINT: TWO NODES, TWO STRINGS ───────────────────────────────
  const other = tmpHome('fresh');
  const second = nodeCard.ensureDescription(other, new Date('2026-09-17T14:23:09.000Z'));
  if (second !== first) {
    test.check('two nodes booting seconds apart do not read the same, which is the whole point');
  } else {
    test.fail('both said: ' + first);
  }

  // ── AND IT NEVER OVERWRITES ─────────────────────────────────────────
  //
  // It runs on EVERY boot. A description somebody typed must survive a
  // restart, or this would be a feature that eats the thing it exists to
  // encourage.
  nodeCard.setDescription(home, 'jazz, and a synth in the corner');
  nodeCard.ensureDescription(home, new Date('2027-01-01T00:00:00.000Z'));
  if (nodeCard.read(home).description === 'jazz, and a synth in the corner') {
    test.check('a description somebody wrote survives every later boot');
  } else {
    test.fail('overwritten: ' + JSON.stringify(nodeCard.read(home)));
  }

  // CLEARED IS EMPTY, AND EMPTY GETS FILLED AGAIN. That is the right way
  // round: blank is the state this exists to end, and somebody who wants
  // to say nothing has said nothing either way.
  nodeCard.setDescription(home, '');
  const again = nodeCard.ensureDescription(home, new Date('2027-01-01T00:00:00.000Z'));
  if (/2027-01-01 00:00:00 UTC/.test(again)) {
    test.check('and a cleared one is filled again, because blank is what this ends');
  } else {
    test.fail('after clearing: ' + JSON.stringify(again));
  }

  // IT GOES THROUGH THE ORDINARY SETTER, so the one thing written with
  // nobody present obeys every rule a person's would.
  if (Buffer.byteLength(again, 'utf8') <= labelRule.DESCRIPTION_MAX_BYTES) {
    test.check('and it fits the cap, like anything else that reaches this field');
  } else {
    test.fail('too long: ' + again.length);
  }

  // ── A NODE MINTED AFTER ITS OWN BOOT ────────────────────────────────
  //
  // The boot hook runs before a fresh node has a key: `ensureIdentity` is
  // called by the first CLAIM. So hub.signedClaim ensures too, or every
  // new node answers a blank card until somebody restarts it — which is
  // the window every new node passes through, and the one this feature is
  // for. Proven here as the sequence it actually is.
  const late = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-info-late-'));
  if (nodeCard.ensureDescription(late) === '') {
    test.check('a node booting before it has a key writes nothing, because there is nothing to describe');
  } else {
    test.fail('described a node with no identity');
  }
  auth.saveIdentity(late, auth.generateIdentity('newcomer'));
  if (/^this node described for the first time /.test(nodeCard.ensureDescription(late))) {
    test.check('and gets one the moment its key exists, which is when it is claimed');
  } else {
    test.fail('still blank after minting: ' + JSON.stringify(nodeCard.read(late)));
  }
  fs.rmSync(late, { recursive: true, force: true });

  // A NODE WITH NO KEY HAS NOTHING TO DESCRIBE, and must not be a crash
  // on the first line of boot.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-info-nokey-'));
  if (nodeCard.ensureDescription(empty) === '') {
    test.check('and a directory with no identity in it is left alone rather than thrown at');
  } else {
    test.fail('wrote into a keyless directory');
  }
  fs.rmSync(empty, { recursive: true, force: true });
}

// ── 7. NO TICK ───────────────────────────────────────────────────────

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
  .then(theFanOut)
  .then(aRelayThatSaysNo)
  .then(aNodeOnNoRelay)
  .then(function () { theFirstDescription(); })
  .then(function () { noTick(); })
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
