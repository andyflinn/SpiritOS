'use strict';

// Exercises spirit.core.util.escapeHtml (kernel.js). spirit.js holds its own
// escapeHtml with the same five replacements (spirit.escapeHtml), which the
// shell (shell/boot.js) hands to a page as api.escapeHtml; this suite does
// not load that copy.
//
// It escapes both quote marks as well as & < >, because call sites
// interpolate the result straight into attribute values:
//
//   '<div class="file-row" data-name="' + escapeHtml(entry.name) + '">'
//   '<input ... value="' + escapeHtml(override.name || '') + '">'
//
// A DOM round-trip (`div.textContent = str; return div.innerHTML`) leaves
// both quotes untouched, so a filename or app name holding a double quote
// would close the attribute early and the rest would parse as markup. It
// lives in the kernel's isomorphic half, so it runs, and is tested, in node.
const spirit = require('../run/spirit/kernel.js');
const test = require('./testSupport.js');

const escapeHtml = spirit.core.util.escapeHtml;

test.startTest('HTML escaping (spirit.core.util.escapeHtml)');

test.subHeading('Every character that can break out is escaped');
[
  ['ampersand', '&', '&amp;'],
  ['less-than', '<', '&lt;'],
  ['greater-than', '>', '&gt;'],
  ['double quote', '"', '&quot;'],
  ['single quote', "'", '&#39;'],
].forEach(function (row) {
  const label = row[0];
  const input = row[1];
  const expected = row[2];
  const actual = escapeHtml(input);
  if (actual === expected) {
    test.check(label + ' ' + JSON.stringify(input) + ' becomes ' + expected);
  } else {
    test.fail(label + ' ' + JSON.stringify(input) + ' became ' + JSON.stringify(actual) +
      ', expected ' + expected);
  }
});

// The ampersand has to be replaced before the others, or the entities they
// introduce get their own & escaped a second time.
if (escapeHtml('<') === '&lt;' && escapeHtml('&lt;') === '&amp;lt;') {
  test.check('ampersand is escaped first — no double-escaping of new entities');
} else {
  test.fail('escape ordering is wrong: escapeHtml("&lt;") gave ' + JSON.stringify(escapeHtml('&lt;')));
}

test.subHeading('Real attribute-injection payloads come out inert');

// Each of these, unescaped, breaks out of an attribute and executes. The
// assertion is deliberately about the RESULT being quote-free rather than
// about matching an exact string: what matters is that nothing can close
// the attribute, whatever entity spelling is used to achieve it.
const ATTRIBUTE_PAYLOADS = [
  'x" onerror="alert(1)',                       // a filename on any POSIX box
  'x" autofocus onfocus="fetch(\'/api/fs/delete\')',
  "x' onmouseover='alert(1)",                   // single-quoted attributes too
  '"><script>alert(1)</script>',
  'legit.txt" data-app-id="other-app',           // attribute smuggling, no script needed
];

ATTRIBUTE_PAYLOADS.forEach(function (payload) {
  const escaped = escapeHtml(payload);
  const label = JSON.stringify(payload.length > 34 ? payload.slice(0, 34) + '…' : payload);

  if (escaped.indexOf('"') === -1 && escaped.indexOf("'") === -1) {
    test.check('no raw quote survives: ' + label);
  } else {
    test.fail('a raw quote survived escaping, so it can close an attribute: ' + label +
      ' → ' + JSON.stringify(escaped));
  }

  if (escaped.indexOf('<') === -1 && escaped.indexOf('>') === -1) {
    test.check('no raw angle bracket survives: ' + label);
  } else {
    test.fail('a raw angle bracket survived escaping: ' + label + ' → ' + JSON.stringify(escaped));
  }
});

test.subHeading('Ordinary content is left readable');

// Escaping must not mangle what apps and the shell actually render most of
// the time — emoji icons, plain filenames, human names.
[
  ['an emoji app icon', '📁'],
  ['a plain filename', 'holiday-photo-01.jpg'],
  ['a name with spaces', 'Andy Flinn'],
  ['a path', 'spirit/state/node.db'],
  ['an accented name', 'Bad Ragaz, Sankt Gallen'],
].forEach(function (row) {
  if (escapeHtml(row[1]) === row[1]) {
    test.check(row[0] + ' passes through unchanged');
  } else {
    test.fail(row[0] + ' was altered: ' + JSON.stringify(row[1]) + ' → ' + JSON.stringify(escapeHtml(row[1])));
  }
});

test.subHeading('Non-string input never throws');

// Call sites pass whatever a manifest, a sidecar or a job payload happened
// to hold — escapeHtml(a.defaultIcon), escapeHtml(override.name || '') —
// so undefined and friends reach it routinely.
[undefined, null, 0, 42, true, {}, [], NaN].forEach(function (value) {
  let result;
  try {
    result = escapeHtml(value);
  } catch (err) {
    test.fail('escapeHtml(' + JSON.stringify(value) + ') threw: ' + err.message);
    return;
  }
  if (typeof result === 'string') {
    test.check('escapeHtml(' + String(value) + ') returns a string (' + JSON.stringify(result) + ')');
  } else {
    test.fail('escapeHtml(' + String(value) + ') returned ' + typeof result + ', not a string');
  }
});

test.reportSuccessFailureCount();
