'use strict';
// spirit/run/spirit/element/fieldInput.js
// AN INPUT STOPS AT ITS LIMIT (goal/G32.2; Andy: "field rules is already badly applied in the UI, the input tell you how
// man characters you typed in excess of the limit instead of simply refusing to take more characters."), ITS LIMIT ITS
// TYPE'S (goal/G48.4, box v22: "ever input field in every element must validate the input with the new type checks."): a
// field names its type by its path, spirit.type.string.label, and the limit is that type file's MAX_BYTES, counted in bytes
// as the type counts them, never characters. attach(input, type) refuses a keystroke or a paste that would take the text past
// it, before it lands; deleting always works. It never says how far past the limit the text went: it simply does not get
// there. A glyph's field also holds to one character, as spirit.type.string.glyph's isValid does.
//
//   spirit.required.spirit.element.fieldInput.fits(value, type) -> true when the type's limit takes it
//   spirit.required.spirit.element.fieldInput.attach(input, type) -> the input, its maxlength the type's bytes and the bytes
//                                                     held as typed; type: a spirit.type.<...> path
(function (root) {
  var E = (root.spirit = root.spirit || {}).element = root.spirit.element || {};
  // A TYPE'S FILE, ITS PATH (goal/G48.4): spirit.type.string.label is spirit/type/string/label.js, loaded through
  // spirit.require (rule/26) and held where spirit.required puts it.
  function fileOf(type) { return /^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(String(type)) ? String(type).split('.').join('/') + '.js' : ''; }
  function typeOf(type) {
    var at = String(type).split('.').reduce(function (o, k) { return o && o[k]; }, root.spirit && root.spirit.required);
    return at && typeof at.isValid === 'function' ? at : null;
  }
  function load(type) {
    var f = fileOf(type);
    return f && root.spirit && typeof root.spirit.require === 'function' ? Promise.resolve(root.spirit.require(f)) : Promise.resolve();
  }
  function bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(s)).length;
    return unescape(encodeURIComponent(String(s))).length;
  }
  function limitOf(type) {
    if (!typeOf(type)) load(type);
    var T = typeOf(type);
    return T && typeof T.MAX_BYTES === 'number' ? T.MAX_BYTES : Infinity;
  }
  // A glyph's field takes one character: what its type refuses for more than one is refused while typing too.
  function fits(value, type) {
    var v = String(value);
    if (bytes(v) > limitOf(type)) return false;
    if (/\.glyph$/.test(String(type)) && v) { var T = typeOf(type); try { T && T.isValid(v); } catch (e) { return false; } }
    return true;
  }

  function attach(input, type) {
    if (!input || typeof input.addEventListener !== 'function') return input;
    // ITS maxlength, THE TYPE'S BYTES (goal/G47.1, the box: "every INPUT field must be checked for a length constraint", "a
    // maxlength on the input DOES count as its length constraint"): a character is at least one byte, so the type's bytes
    // are a ceiling on its characters; the bytes themselves are held below, as they are typed. Set once the type is in.
    var setMax = function () { var m = limitOf(type); if (isFinite(m)) input.maxLength = m; return isFinite(m); };
    if (!setMax()) load(type).then(setMax, function () {});
    input.addEventListener('beforeinput', function (e) {
      var kind = String((e && e.inputType) || '');
      if (kind.indexOf('insert') !== 0) return;   // a deletion always passes
      var added = e.data != null ? String(e.data) : (e.dataTransfer && typeof e.dataTransfer.getData === 'function' ? e.dataTransfer.getData('text/plain') : '');
      if (kind === 'insertLineBreak' || kind === 'insertParagraph') added = '\n';
      var v = String(input.value || '');
      var start = typeof input.selectionStart === 'number' ? input.selectionStart : v.length;
      var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : v.length;
      if (!fits(v.slice(0, start) + added + v.slice(end), type)) e.preventDefault();
    });
    return input;
  }

  window.spirit.required && ['spirit', 'element', 'fieldInput'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = { fits: fits, attach: attach }; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, window.spirit.required);
}(typeof window !== 'undefined' ? window : globalThis));
