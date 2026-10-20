// spirit/run/shell/js/joinSteps.js
// THE JOIN APP'S STEPS, DECIDED IN ONE PLACE (goal/G30.1, box v39). The Join app walks a new user from joining to his
// face link; its manifest lists the steps in order, each with its name, icon and the fact that ends it (`until`). The
// shell draws the Join tile by the open step and the app draws its to-do list by the same answer, so both read it here.
//
//   facts(ask, opened) -> Promise of { seated, contact, face, faceUrl, relayUrl, opened }
//       ask is the node's door (api.verb or spirit.core.ask); opened is whether the face link was opened (the Join
//       app's own override, faceOpened). seated: a listed relay is owned or claimed (relay.search). contact: the book
//       holds anyone (contact.search). face: the face name this node holds on the relay it is seated on (relay.get),
//       faceUrl https://<face name>.<relay host>.
//   done(step, facts)      -> whether that step's fact holds.
//   current(steps, facts)  -> the first step not done and not optional, or null when every one that counts is done.
//       Find someone is optional (box: "it never blocks the steps after it"): open in the list, never the open step.

(function () {
  function bodyOf(r) {
    if (r && r.body) return r.body;
    try { return JSON.parse(r && r.text); } catch (e) { return null; }
  }
  function parsed(label) {
    try { return JSON.parse(label); } catch (e) { return null; }
  }

  function facts(ask, opened) {
    var out = { seated: false, contact: false, face: '', faceUrl: '', relayUrl: '', opened: !!opened };
    var relays = Promise.resolve(ask('relay.search', { q: '*' })).then(function (r) {
      var items = ((bodyOf(r) || {}).items) || [];
      var seat = items.filter(function (i) { var row = parsed(i.label); return !!(row && (row.owned || row.claimed)); })[0];
      out.seated = !!seat;
      out.relayUrl = seat ? String(seat.key || '') : (items[0] ? String(items[0].key || '') : '');
      if (!seat) return null;
      return Promise.resolve(ask('relay.get', { key: seat.key })).then(function (g) {
        var row = ((bodyOf(g) || {}).relay) || {};
        var name = row.face && row.face.name ? String(row.face.name) : '';
        out.face = name;
        if (name) {
          var host = '';
          try { host = new URL(out.relayUrl).host; } catch (e) { host = ''; }
          out.faceUrl = host ? 'https://' + name + '.' + host : '';
        }
      });
    }, function () { return null; });
    var book = Promise.resolve(ask('contact.search', { q: '*' })).then(function (r) {
      out.contact = (((bodyOf(r) || {}).items) || []).length > 0;
    }, function () { return null; });
    return Promise.all([relays, book]).then(function () { return out; });
  }

  function done(step, f) {
    var until = step && step.until;
    if (until === 'seated') return !!f.seated;
    if (until === 'contact') return !!f.contact;
    if (until === 'face') return !!f.face;
    if (until === 'opened') return !!f.opened;
    return false;
  }

  function current(steps, f) {
    var list = Array.isArray(steps) ? steps : [];
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i].optional && !done(list[i], f)) return list[i];
    }
    return null;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.joinSteps = { facts: facts, done: done, current: current };
}());
