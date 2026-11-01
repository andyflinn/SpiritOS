// spirit/run/spirit/relay/clientCacheManager.js
// WHAT A CLIENT KNOWS OF ITS NODE'S RELAYS, IN THE relay FAMILY'S OWN FOLDER (goal/G41.28). Andy: "anything not using the
// new spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page or process
// loads it through spirit.cacheManager('relay'); it keeps what relay.get answered in that client's spirit.data, under
// the node that served it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader asks spirit.relayData (below), never a branch by
// name. A relay's row in the one table (people and relays) is the contact family's (spirit.contactData); this keeps
// what relay.get adds to it.
//   relayRows   the relay's key (its url) -> { relay, report } as relay.get last answered them
// The node publishes no relay.get answer, so it translates nothing: spirit.relay.status keeps each one it got (keep).
(function (root) {
  var ROWS = 'relayRows';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.relay.clientCacheManager') : '__relayClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.at !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).relayData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'relay');
    // THE READS AND THE ONE WRITE:
    //   keep(answer)   one relay.get answer { ok, key, relay, report }, kept by its key; a refusal keeps nothing
    //   relay(key)     that relay's row as relay.get answered it, or null;  report(key)  the report it carried, or null
    //   watch(fn)      fn(key, kept) on every relay kept or changed; answers its release
    //   branch         the rows' whole path
    var relayData = {
      keep: function (answer) {
        if (!answer || !answer.ok || !answer.key || !answer.relay) return;
        HOME.set(ROWS + '/' + answer.key, { relay: answer.relay, report: answer.report || null });
      },
      relay: function (key) { var k = key ? HOME.get(ROWS + '/' + key) : null; return (k && k.relay) || null; },
      report: function (key) { var k = key ? HOME.get(ROWS + '/' + key) : null; return (k && k.report) || null; },
      watch: function (fn) {
        return HOME.watch(ROWS, function (whole, v) { if (typeof fn === 'function') fn(String(whole || '').split('/').slice(3).join('/'), v || null); });
      },
      get branch() { return HOME.path(ROWS); },
    };
    try { Object.defineProperty(D, ATTACHED, { value: relayData }); } catch (e) { D[ATTACHED] = relayData; }
    (root.spirit = root.spirit || {}).relayData = relayData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
