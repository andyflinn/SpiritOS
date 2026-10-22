// spirit/run/shell/js/fieldInput.js
// AN INPUT STOPS AT ITS LIMIT (goal/G32.2; Andy: "field rules is already badly applied in the UI, the input tell you how
// man characters you typed in excess of the limit instead of simply refusing to take more characters."). A field's
// limit is its rule's in js/fieldRules.js, counted in bytes as the rule counts them, never characters. attach(input,
// rule) refuses a keystroke or a paste that would take the text past it, before it lands; deleting always works. It
// never says how far past the limit the text went: it simply does not get there.
//
//   spirit.elements.fieldInput.fits(value, rule) -> true when the rule takes it
//   spirit.elements.fieldInput.attach(input, rule)   rule: 'name' (64 bytes), 'description' (128), 'paragraph' (2048)
(function (root) {
  var E = (root.spirit = root.spirit || {}).elements = root.spirit.elements || {};
  var LIMIT = { name: 'MAX_BYTES', description: 'DESCRIPTION_MAX_BYTES', paragraph: 'PARAGRAPH_MAX_BYTES' };

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
  function fits(value, rule) { return bytes(value) <= limitOf(rule); }

  function attach(input, rule) {
    if (!input || typeof input.addEventListener !== 'function') return input;
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

  E.fieldInput = { fits: fits, attach: attach };
}(typeof window !== 'undefined' ? window : globalThis));
