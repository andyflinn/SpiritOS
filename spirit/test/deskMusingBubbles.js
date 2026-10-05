'use strict';

// spirit/test/deskMusingBubbles.js
// goal/G6.3: each musing in a bubble, 1em from the textarea.
//
// Andy, 2026-10-05, goal/G6: "prime goal with desk-portion of FACE.md"; split as proposed.
//   FACE.md: "each musing in the log should be in a separate bubble, possibly with the same
//   background color as the header area." / "vertical spacing between input text area and
//   each bubble in the log: 1em".
//   G5.5 note on Musings: "is pure ui".
//
// THE CONTRACT (claude-ubuntu's red, for whoever builds it):
//   M1 the empty state is unchanged: no bubble shows when nothing has been logged, and the
//      'Nothing logged yet.' line is still there.
//   M2 each musing is wrapped in its own bubble container (a div with inline styling that
//      makes it visually distinct — a background, and padding).
//   M3 three musings yield three bubbles, each carrying its own text.
//   M4 each bubble carries 1em of top margin, so the first sits 1em below the input
//      textarea area and consecutive bubbles are 1em apart.
//   M5 the muse textarea and send button are not themselves wrapped as bubbles: only the
//      logged musings are.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const OWED = 'OWED by goal/G6.3: ';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    offsetHeight: 40,
  };
  el.style.setProperty = function (k, v) { el.style[k] = v; };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
function clickTarget(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

let n = 0;
function musingRow(text) {
  n += 1;
  return {
    key: 'muse-' + n, at: new Date(Date.now() - 3600000 + n * 1000).toISOString(),
    dir: 'out', peer: '', outcome: 'sent', from: 'andy', kind: 'musing',
    text: 'note to self: ' + text, todo: '',
  };
}

function mount(musings) {
  const files = { 'log/log.json': JSON.stringify(musings) };
  const fake = require('./deskFake.js').fromFiles(files);
  fake.items = [];
  const doc = fakeDocument();
  const root = fakeElement('container');
  load(DESK, doc).mount(root, {
    fs: { loadFile: function (f) { return Object.prototype.hasOwnProperty.call(files, f) ? files[f] : null; }, saveFile: function (f, c) { files[f] = c; return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml,
    verb: fake.verb,
    onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  return { doc: doc, root: root };
}

function openMusingsTab(doc) {
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: clickTarget({ 'data-tab': 'musings' }), currentTarget: tabs });
}

// A musing bubble is any element wrapping one logged musing's text. The red lets the
// builder choose its tag and class; it only asks what the eye asks:
//   - the wrap carries inline styles (as deskLayout.js' peers do),
//   - a top margin of 1em (per FACE.md), AND
//   - padding (something inside the bubble, not flush), AND
//   - a visual mark that makes it a bubble: background, border, border-radius, or box-shadow.
//     FACE.md: "possibly with the same background color as the header area" — the colour is
//     optional; some visual mark is not.
function bubbleWrappers(html) {
  const wraps = [];
  const re = /<([a-z]+)([^>]*?\bstyle\s*=\s*"([^"]*)"[^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const style = m[3];
    const hasMargin = /(?:^|[;\s])(?:margin|margin-top)\s*:\s*1em\b/.test(style);
    const hasPad = /(?:^|[;\s])padding\s*:/.test(style);
    const hasMark = /(?:^|[;\s])(background(?:-color)?|border(?:-radius|-color|-width|-style)?|box-shadow)\s*:/.test(style);
    if (hasMargin && hasPad && hasMark) wraps.push({ tag: m[1], at: m.index, style: style });
  }
  return wraps;
}

test.startTest('goal/G6.3: each musing in a bubble, 1em from the textarea');

(async function () {
  // ── M1: empty state unchanged ────────────────────────────────────
  test.subHeading('M1: with nothing logged yet, the empty-state line still shows and no bubble appears');
  const empty = mount([]);
  await settle();
  openMusingsTab(empty.doc);
  await settle();
  const emptyHtml = empty.doc.getElementById('desk-musings').innerHTML;
  const emptySays = /Nothing logged yet/.test(emptyHtml);
  const emptyBubbles = bubbleWrappers(emptyHtml);
  if (emptySays && emptyBubbles.length === 0) test.check('the empty-state message is there, and no bubble is drawn');
  else test.fail(OWED + 'empty html: ' + emptyHtml.slice(0, 200) + ' (bubbles: ' + emptyBubbles.length + ')');

  // ── M2 and M3: three musings yield three bubbles ─────────────────
  const log = [musingRow('alpha'), musingRow('beta'), musingRow('gamma')];
  const three = mount(log);
  await settle();
  openMusingsTab(three.doc);
  await settle();
  const list = three.doc.getElementById('desk-musings');
  const html = list.innerHTML;

  test.subHeading('M2: each logged musing is wrapped in a bubble (inline style with background and padding)');
  const bubbles = bubbleWrappers(html);
  if (bubbles.length >= 3) test.check('three or more wrappers with background, padding and 1em of margin');
  else test.fail(OWED + 'bubble wrappers found: ' + bubbles.length + ' — html: ' + html.slice(0, 300));

  test.subHeading('M3: each of the three musings is drawn in its own bubble, carrying its text');
  const stripTags = function (s) { return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); };
  const texts = stripTags(html);
  const allPresent = /alpha/.test(texts) && /beta/.test(texts) && /gamma/.test(texts);
  const exactlyThree = bubbles.length === 3;
  if (allPresent && exactlyThree) test.check('alpha, beta and gamma each in a bubble (three bubbles exactly)');
  else test.fail(OWED + 'bubbles: ' + bubbles.length + ', texts: ' + JSON.stringify(texts.slice(0, 200)));

  // ── M4: 1em of top margin ────────────────────────────────────────
  test.subHeading('M4: each bubble carries margin-top:1em, so the first sits 1em below the input area and bubbles are 1em apart');
  const allMarginTop = bubbles.length === 3 && bubbles.every(function (b) { return /(?:^|[;\s])(?:margin|margin-top)\s*:\s*1em\b/.test(b.style); });
  if (allMarginTop) test.check('every bubble\'s inline style carries margin or margin-top: 1em');
  else test.fail(OWED + 'bubble styles: ' + JSON.stringify(bubbles.map(function (b) { return b.style; })));

  // ── M5: the textarea area is not itself a bubble ────────────────
  test.subHeading('M5: only logged musings are wrapped as bubbles; the input textarea and its button are not');
  const paneHtml = three.root.innerHTML;
  const paneStart = paneHtml.indexOf('data-pane="musings"');
  const paneEnd = paneHtml.indexOf('data-pane=', paneStart + 1);
  const pane = paneStart === -1 ? '' : paneHtml.slice(paneStart, paneEnd === -1 ? undefined : paneEnd);
  // The muse send button and textarea sit in `.start-job-form.card`; a bubble around them
  // would be a wrapping div with background+padding+1em margin NOT inside #desk-musings.
  const outsideBubbleBefore = (function () {
    const beforeMusings = pane.indexOf('id="desk-musings"');
    return beforeMusings === -1 ? '' : pane.slice(0, beforeMusings);
  })();
  const strayBubbles = bubbleWrappers(outsideBubbleBefore);
  // The input textarea itself (muse box) is not a bubble.
  const museId = pane.indexOf('id="desk-muse"') !== -1;
  if (museId && strayBubbles.length === 0) test.check('the muse textarea is there, and no bubble surrounds it');
  else test.fail(OWED + 'muse textarea present=' + museId + ', bubbles before #desk-musings: ' + strayBubbles.length);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
