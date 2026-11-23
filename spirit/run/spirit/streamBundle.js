'use strict';
require('./spirit.js');

// spirit/run/spirit/streamBundle.js
// A STREAM'S BUNDLE, BOTH HALVES, IN ONE PLACE (goal/G48.7; Andy: "spirit/server/app.js and console would need to share the
// module that unpacks the collated stream packages, i would NOT want that to be done in two places", "the module is
// spirit/streamBundle.js"). A delivery is one peerPost carrying a JSON array of entries, each { run, n, row }, a full push's
// marked full and closed by one { run, n, full, end }. This file knows that a bundle is an array of entries and how many fit
// one answer; what an entry means (full, end, the place) stays with its user. It names no app.
//
//   pack(entries)   -> the first of them that fit one delivery, at least one, in order (spirit/server/app.js, the publisher)
//   unpack(json)    -> the entries of a delivery's json, each a plain object, in order; null when it is no JSON array
//                      (both listeners of spirit/server/app.js, and the console's log wait once envelopeOf in
//                      spirit/arrivals.js has opened the envelope)

const limits = spirit.requireScript('spirit/limits.js');
const createProbabilityBucket = spirit.requireScript('spirit/listLimiter.js').createProbabilityBucket;

// One answer's room, as the desk's lists were cut (ANSWER_ROOM): half a sealed packet less 512 bytes for its envelope,
// less the bytes the bundle's JSON gains as the json string of its request.
const BUNDLE_ROOM = Math.floor(limits.SEALED_MAX / 2) - 512;

function isPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function pack(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return [];
  const bucket = createProbabilityBucket(rows.length);
  // Every entry at probability 0, so the queue's order stands; measured as it travels, a string inside the request.
  rows.forEach(function (e) { bucket.seatFor(0, e); });
  const room = BUNDLE_ROOM - Buffer.byteLength(JSON.stringify({ json: '' }), 'utf8');
  const fit = bucket.serialize(null, Math.floor(room / 2)).items.length;
  return rows.slice(0, Math.max(1, fit));
}

function unpack(json) {
  let bundle = null;
  try { bundle = JSON.parse(String(json)); } catch (e) { bundle = null; }
  if (!Array.isArray(bundle)) return null;
  return bundle.filter(isPlain);
}

module.exports = { pack: pack, unpack: unpack, BUNDLE_ROOM: BUNDLE_ROOM };
