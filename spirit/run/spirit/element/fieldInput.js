'use strict';
// spirit/run/spirit/element/fieldInput.js
// AN INPUT STOPS AT ITS LIMIT (goal/G32.2; Andy: "field rules is already badly applied in the UI, the input tell you how
// man characters you typed in excess of the limit instead of simply refusing to take more characters."). A field's
// limit is its rule's in spirit/fieldRules.js, counted in bytes as the rule counts them, never characters. attach(input,
// rule) refuses a keystroke or a paste that would take the text past it, before it lands; deleting always works. It
// never says how far past the limit the text went: it simply does not get there.
//
//   spirit.required.spirit.element.fieldInput.fits(value, rule) -> true when the rule takes it
//   spirit.required.spirit.element.fieldInput.attach(input, rule)   the input's maxlength set to the rule's bytes, and the bytes held
//                                                     as typed; rule: 'name' (64 bytes), 'description' (128), 'paragraph' (2048),
//                                                     'line' (1024, a chat line), 'glyph' (one glyph of at most 8 bytes)
(function (root) {
  var E = (root.spirit = root.spirit || {}).element = root.spirit.element || {};
  // THE RULES IT HOLDS TO, IT LOADS ITSELF (rule/26; goal/G41.27, found by the general UI test: on a bare page, without
  // the boot's list, it held nothing). Asked as this file runs, so whoever requires it is answered once they are in.
  if (root.spirit && typeof root.spirit.require === 'function') root.spirit.require('spirit/fieldRules.js');
  var LIMIT = { name: 'MAX_BYTES', description: 'DESCRIPTION_MAX_BYTES', paragraph: 'PARAGRAPH_MAX_BYTES', line: 'LINE_MAX_BYTES',
    glyph: 'GLYPH_MAX_BYTES' };

  function rules() { return (root.spirit && root.spirit.fieldRules) || null; }
  function bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(s)).length;
    return unescape(encodeURIComponent(String(s))).length;
  }
  function limitOf(rule) {
    var R = rules();
    var max = R && LIMIT[rule] ? R[LIMIT[rule]] : undefined;
    return typeof max === 'number' ? max : Infinity;
  }
  // The glyph rule also counts glyphs: one, as the reader sees one (fieldRules.glyphCount).
  function fits(value, rule) {
    if (bytes(value) > limitOf(rule)) return false;
    var R = rules();
    if (rule === 'glyph' && R && typeof R.glyphCount === 'function' && R.glyphCount(String(value)) > 1) return false;
    return true;
  }

  function attach(input, rule) {
    if (!input || typeof input.addEventListener !== 'function') return input;
    // ITS maxlength, THE RULE'S BYTES (goal/G47.1, the box: "every INPUT field must be checked for a length constraint", "a
    // maxlength on the input DOES count as its length constraint"): a character is at least one byte, so the rule's bytes
    // are a ceiling on its characters; the bytes themselves are held below, as they are typed. Set once the rules are in.
    var setMax = function () { var m = limitOf(rule); if (isFinite(m)) input.maxLength = m; return isFinite(m); };
    if (!setMax() && root.spirit && typeof root.spirit.require === 'function') Promise.resolve(root.spirit.require('spirit/fieldRules.js')).then(setMax, function () {});
    input.addEventListener('beforeinput', function (e) {
      var type = String((e && e.inputType) || '');
      if (type.indexOf('insert') !== 0) return;   // a deletion always passes
      var added = e.data != null ? String(e.data) : (e.dataTransfer && typeof e.dataTransfer.getData === 'function' ? e.dataTransfer.getData('text/plain') : '');
      if (type === 'insertLineBreak' || type === 'insertParagraph') added = '\n';
      var v = String(input.value || '');
      var start = typeof input.selectionStart === 'number' ? input.selectionStart : v.length;
      var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : v.length;
      if (!fits(v.slice(0, start) + added + v.slice(end), rule)) e.preventDefault();
    });
    return input;
  }

  window.spirit.required && ['spirit', 'element', 'fieldInput'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = { fits: fits, attach: attach }; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, window.spirit.required);
}(typeof window !== 'undefined' ? window : globalThis));
