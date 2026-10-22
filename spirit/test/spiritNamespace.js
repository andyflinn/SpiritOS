'use strict';

// spirit/test/spiritNamespace.js
// goal/G32.2: the face code moves onto the spirit object, and the client interface into the spirit name space. Red on
// today's tree; claude-windows writes it and builds it (one agent). The box (v2), in short:
//   - The shell elements, Files, Contacts, Join, Media Viewer, Apps and Icons reach the node only through the spirit
//     object (goal/G32.1): no hand-made verb call is left in them.
//   - The client interface lives in the spirit name space, the data buckets included: window.spirit.data,
//     spiritElements, spiritTransport and the other window.spiritX globals become members of spirit (spirit.data,
//     spirit.elements ...), and no window.spiritX global is left (Andy: "we don't clutter public name spaces", "all
//     SpiritOS objects are internally references by one global only spirit.this.or.that").
//   - Their input fields refuse what their rule would refuse as it is typed: no characters past the limit.
// NAMED HERE: the members' names, spirit.<lowerCamel of what followed spirit>; shell/js/fieldInput.js gives
// spirit.elements.fieldInput { fits(value, rule), attach(input, rule) }.
// rule/11: through testSupport only; nothing reaches a node.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G32.2: ';
const RUN = path.join(__dirname, '..', 'run');
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
// Code only: the line comments and block comments dropped, so a comment naming an old global is not a use of it.
const code = function (text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(function (l) { return !/^\s*(\/\/|\*)/.test(l); }).join('\n'); };
function walk(dir, out) {
  let es = [];
  try { es = fs.readdirSync(path.join(RUN, dir), { withFileTypes: true }); } catch (e) { return out; }
  es.forEach(function (e) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'relay-state' && e.name !== '.git') walk(rel, out); }
    else if (/\.(js|html)$/.test(e.name)) out.push(rel);
  });
  return out;
}

test.startTest('goal/G32.2: the face code on the spirit object, the client interface in the spirit name space');

test.subHeading('1. no window.spiritX global is left');
const OLD = /\bspirit(Data|Elements|Transport|FieldRules|Probability|MatchRanges|ApiTreeIndex|Limits|Packet|IconIndex|DeskPlugins|Lever|RelayMonitor|PeerFile|OwnerBadge|ChatLog|Families)\b(?!\.js)/;
const left = walk('', []).filter(function (f) { return OLD.test(code(raw(f))); });
if (!left.length) test.check('no file under spirit/run names a spiritX global; they are members of spirit');
else test.fail(OWED + left.length + ' files still name one: ' + left.slice(0, 10).join(', '));

test.subHeading('2. the face code reaches the node only through the spirit object');
const FACE = walk('shell/js', []).concat(walk('shell/files', []), walk('shell/contacts', []), walk('shell/join', []), walk('shell/mediaViewer', []), walk('shell/apps', []), walk('shell/icons', []));
const NODE_VERB = /\b(api\.verb|core\(\)\.ask|spirit\.core\.ask|\.ask)\(\s*'(auth|config|contact|fs|jobs|net|node|owner|peer|relay)\.[a-zA-Z.]+'/;
const hand = FACE.filter(function (f) { return NODE_VERB.test(code(raw(f))); });
if (FACE.length > 15 && !hand.length) test.check('no hand-made node call is left in the ' + FACE.length + ' files of the face code');
else test.fail(OWED + 'hand-made node calls in: ' + hand.join(', '));

test.subHeading('3. an input stops at its limit');
let fits = null;
try {
  const g = globalThis;
  g.window = g.window || g;
  g.spirit = g.spirit || {};
  g.spirit.fieldRules = require('../run/js/fieldRules.js');
  delete require.cache[require.resolve('../run/shell/js/fieldInput.js')];
  require('../run/shell/js/fieldInput.js');
  const F = g.spirit.elements && g.spirit.elements.fieldInput;
  fits = F ? { name64: F.fits('x'.repeat(64), 'name'), name65: F.fits('x'.repeat(65), 'name'), desc128: F.fits('é'.repeat(64), 'description'), desc129: F.fits('é'.repeat(64) + 'x', 'description') } : { missing: true };
} catch (e) { fits = { threw: e.message }; }
if (fits && fits.name64 === true && fits.name65 === false && fits.desc128 === true && fits.desc129 === false)
  test.check('fieldInput.fits measures bytes by the field rules: 64 for a name, 128 for a description');
else test.fail(OWED + 'fieldInput.fits: ' + JSON.stringify(fits));
const attached = ['shell/apps/apps.js', 'shell/icons/icons.js'].filter(function (f) { return !/fieldInput\.attach\(/.test(code(raw(f))); });
if (!attached.length && /beforeinput/.test(code(raw('shell/js/fieldInput.js')))) test.check('the Apps and Icons inputs refuse past their limit as they are typed');
else test.fail(OWED + 'inputs without fieldInput.attach: ' + attached.join(', '));

test.reportSuccessFailureCount();
