'use strict';

// Exercises spirit.core.util.escapeHtml (kernel.js) — the one escaper the
// shell and every app share, via spirit.shell.escapeHtml and api.escapeHtml.
//
// The bug this covers: the original implementation lived in shell.js and
// was a DOM round-trip (`div.textContent = str; return div.innerHTML`),
// which escapes & < > and leaves BOTH quote marks untouched. That is
// correct for element text and wrong for an attribute value — and roughly
// thirty call sites across shell.js and index.html interpolate the result
// straight into one:
//
//   '<div class="file-row" data-name="' + escapeHtml(entry.name) + '">'
//   '<input ... value="' + escapeHtml(override.name || '') + '">'
//
// A filename or a custom app name containing a double quote closed the
// attribute early and everything after it was parsed as markup. The two
// reachable inputs were filenames (which arrive from the filesystem, not
// from the operator) and the app name/icon overrides, which persist to
// preferences.json.
//
// Being a DOM round-trip also made it untestable — no DOM in node, so no
// test could reach it at all. Moving it into the kernel's isomorphic half
// is what makes this file possible; that is half the fix.
const spirit = require('../run/js/kernel.js');
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
  ['a path', 'app/natter/relays.json'],
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
