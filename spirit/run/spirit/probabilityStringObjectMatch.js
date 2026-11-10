'use strict';

// ONE SCOPE OF ITS OWN (goal/G27.14): loaded into a page as a plain script, its names stay its own.
(function () {

// spirit/run/spirit/probabilityStringObjectMatch.js
// HOW LIKELY A STRING IS WHAT AN OBJECT HOLDS, AS A PROBABILITY — goal/G18.3, the second of the probabilit* modules.
//
//   Andy, 2026-10-12, the item: "1. the input must be valid string and object, empty string will return 0", "2. We
//   "measure" the object ... extracts every valid string from the object and places it in a table", "3. ... the
//   shortest string in the object gets the highest weight, the longest string in the object gets the smallest weight,
//   and all the weights of the string in the table must add up to 1.0", "4. the overall input string is then matched
//   agains all strings in the object, using pobabilityStringMatch(). each of those results is then multiplied by the
//   weight of the corresponding object-string, and added to the overall result.", "5. the overall result is returned."
//   And, decided with him: empty strings stay out of the table; "nested objects will be searched for strings to put
//   into the table."; "if keys are string, they are included, this is supposed to be "dumb""; the weights his
//   (S - L) / S, divided by n - 1 so they add up to 1 ("you formula-correction is accepted"), one string alone 1.0.
//   SINCE goal/G41.28 (Andy, box v15): "probabilityStringObjectMatch can easily convert numbers in an object to strings,
//   for matching", "if a boolean is true, then it's key serves as string to be evaluated. if the boolean is false, it's
//   key will NOT be evaluated.", and "probabilityStringObjectMatch will scan arrays as well.": numbers go in as text, a
//   key whose value is false stays out, and every element of an array is a value of its own.
//
// A WEIGHTED SUM, NOT THE BEST FIELD, ON PURPOSE: a perfect hit on one field among many is diluted, and that is
// accepted: "when searching a table of objects, dilution doesn't matter because we look for the best matching contact
// not for the perfect one (this will become obvious in our 3rd item: probabilityBucket)".
//
// NO I/O, NO CLOCK, NO STATE.

// In node the module beside it; in a page the one on window.spirit.probability, read when it is called (goal/G41.18): a
// part that loads both itself may have this one run first, so nothing is read from the page as this file loads.
var nodeStringMatch = typeof require === 'function' && typeof module !== 'undefined' && module
  ? require('./spirit.js').require('spirit/probabilityStringMatch.js').probabilityStringMatch
  : null;
function probabilityStringMatch(a, b) {
  var f = nodeStringMatch || (window.spirit && window.spirit.probability && window.spirit.probability.probabilityStringMatch);
  return f(a, b);
}

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// MEASURE THE OBJECT: every key (but one whose value is false), every string value, every number as text, of it, of
// the plain objects inside it and of every array element, in the order met. Empty strings are left out. An object or an
// array met again (a cycle) is measured once.
// EACH STRING WITH ITS JS OBJECT PATH (goal/G43.6; Andy, box: "assembled by scanning the row without knowing its meaning, with the
// one scan probabilityStringObjectMatch uses"): stats.cpu, files[0].name. A key's own row says isKey, and flag when its value is true.
function measureObject(object) {
  var table = [];
  var seen = [];
  function value(v, path) {
    if (typeof v === 'string') { if (v !== '') table.push({ objectString: v, weight: 0.0, path: path }); }
    else if (typeof v === 'number') table.push({ objectString: String(v), weight: 0.0, path: path });
    else if (Array.isArray(v)) { if (seen.indexOf(v) === -1) { seen.push(v); v.forEach(function (e, i) { value(e, path + '[' + i + ']'); }); } }
    else if (isPlainObject(v)) walk(v, path);
  }
  function walk(o, at) {
    if (seen.indexOf(o) !== -1) return;
    seen.push(o);
    Object.keys(o).forEach(function (key) {
      var v = o[key];
      var path = at ? at + '.' + key : key;
      if (key !== '' && v !== false) table.push({ objectString: key, weight: 0.0, path: path, isKey: true, flag: v === true });
      value(v, path);
    });
  }
  walk(object, '');
  return table;
}

// THE WEIGHTS: the shortest heaviest, adding up to 1. S is the length of all strings added; a string of length L
// weighs (S - L) / S, and over n strings those add up to n - 1, so each is divided by n - 1. One string alone: 1.0.
function weigh(table) {
  if (table.length === 1) { table[0].weight = 1.0; return table; }
  var S = table.reduce(function (sum, row) { return sum + row.objectString.length; }, 0);
  var n = table.length;
  table.forEach(function (row) { row.weight = (S - row.objectString.length) / S / (n - 1); });
  return table;
}

function probabilityStringObjectMatch(string, object) {
  if (typeof string !== 'string' || string === '' || !isPlainObject(object)) return 0.0;
  var table = weigh(measureObject(object));
  if (!table.length) return 0.0;
  return table.reduce(function (sum, row) { return sum + probabilityStringMatch(string, row.objectString) * row.weight; }, 0);
}

// IN NODE AND IN A PAGE ALIKE (goal/G27.14): a page finds it on window.spirit.probability.
if (typeof module !== 'undefined' && module && module.exports) module.exports = { measureObject: measureObject, probabilityStringObjectMatch: probabilityStringObjectMatch };
if (typeof window !== 'undefined' && window) {
  (window.spirit = window.spirit || {}).probability = window.spirit.probability || {};
  window.spirit.probability.probabilityStringObjectMatch = probabilityStringObjectMatch;
  window.spirit.probability.measureObject = measureObject;
}
}());
