// spirit/run/shell/js/joinSteps.js
// THE JOIN APP'S STEPS, DECIDED IN ONE PLACE (goal/G30.1, box v39 and v40). The Join app walks a new user from joining
// to his face link; its manifest lists the steps in order, each with its name, icon and the fact that ends it
// (`until`). The facts come from the node's join-steps job (js/joinStepsJob.js), which the shell's tile and the Join
// app hear on the jobs stream; nothing here asks the node anything.
//
//   fromJob(data, opened)  -> { seated, relayUrl, contact, face, faceUrl, opened }: the job's facts, with whether the
//                             face link was opened (the Join app's own override, faceOpened).
//   done(step, facts)      -> whether that step's fact holds.
//   current(steps, facts)  -> the first step not done and not optional, or null when every one that counts is done.
//       Find someone is optional (box: "it never blocks the steps after it"): open in the list, never the open step.
//   linkRelay(key, items)  -> the url of the relay the mailed link names by its key (&relay=), out of relay.search's
//                             items; '' when this node lists no relay under that key. The code goes to that relay, never
//                             to the first one listed (goal/G40.10, box v15).

(function () {
  function fromJob(data, opened) {
    var d = data || {};
    return {
      seated: !!d.seated, relayUrl: String(d.relayUrl || ''), email: String(d.email || ''), emailVerified: !!d.emailVerified,
      contact: !!d.contact,
      face: String(d.face || ''), faceUrl: String(d.faceUrl || ''), opened: !!opened,
    };
  }

  function done(step, f) {
    var until = step && step.until;
    // Step 1 (box v41): a seat with a verified email; a seat taken by invite still owes the email.
    if (until === 'email') return !!(f.seated && f.emailVerified);
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

  function linkRelay(key, items) {
    var k = String(key || '');
    if (!k) return '';
    var hit = (Array.isArray(items) ? items : []).filter(function (i) {
      var row = null;
      try { row = JSON.parse(i.label); } catch (e) { row = null; }
      return !!(row && row.relayKey === k);
    })[0];
    return hit ? String(hit.key || '') : '';
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.joinSteps = { fromJob: fromJob, done: done, current: current, linkRelay: linkRelay };
}());
