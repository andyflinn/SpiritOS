// spirit/run/spirit/element/joinList.js
// THE JOIN STEPS, AN ELEMENT (goal/G43.26; Andy: "JOIN IS A FUCKING APP and DOES NOT FUCKING DRAG HALF OF THE OLD SHIT INTO
// THE NEW!"). The Join app (spirit/app/join/join.js) is its wrapper. It walks a new user from joining a relay to opening
// his face, as one to-do list (goal/G30.1, box v39).
//
//   spirit.elements.joinList.create(container, {}) -> { destroy() }
//
// The steps are the Join app's manifest's (spirit/app/join/join.json, steps), each with its name, icon and the fact that
// ends it. Where the user stands is the node's join-steps job (spirit/joinStepsJob.js), heard in the jobs family's cache
// and worked out with joinSteps.js: nothing is asked for it, and the list draws again only when the job changes. Done steps
// are ticked; every open step up to the open one is expanded with its form, so the optional Find someone never stands in
// the way of the step after it. The forms are the shell elements: joinForm, the contact list, faceForm. Handed something
// new while a field in the list has focus, it waits until the focus leaves, so nothing he is typing is wiped.
//
// FACE OPENED IS THE NODE'S FACT (goal/G43.26, requirement 6): the node records it when its face opens (server.js, onFaceOpen,
// into spirit/state/join/data/) and the job carries it as opened. This element writes no state of its own.
// WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24, requirement 9): the spirit object's families, no api handed.
(function () {
  var S = window.spirit = window.spirit || {};
  var STEPS = 'spirit/app/join/join.json';
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all(['spirit/element/joinSteps.js', 'spirit/element/joinForm.js', 'spirit/element/faceForm.js',
    'spirit/element/search/contact/listElement.js', 'spirit/element/icon.js'].map(function (p) { return S.require(p); }));
  // ICONS ARE GLYPHS (goal/G41.1): a step names its own in join.json, and the marks are written here; no icon table.
  var DONE = '☑️';
  var OPEN = '⬜';

  function create(container, opts) {
    var gone = false;
    var steps = null;
    var job = null;
    var relays = [];
    var shown = '';
    var waiting = false;
    var offs = [];
    var made = [];
    container.innerHTML =
      '<div class="stack">' +
        '<div class="stat-tile wide"><div class="label">Becoming a SpiritOS participant</div>' +
          '<div class="job-manifest-note">A few steps, from joining a relay to opening your node from anywhere.</div></div>' +
        '<div class="join-list"><div class="job-manifest-note">Waiting for this node to say where you stand…</div></div>' +
      '</div>';
    var host = container.querySelector('.join-list');
    host.addEventListener('focusout', function () { setTimeout(function () { if (waiting) show(); }, 0); });

    function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }
    // A mark stands alone before its step's name, so it is an icon: a place naming its glyph, the icon element made there.
    function mark(glyph) { return '<span data-icon="' + glyph + '">' + glyph + '</span>'; }
    function icons() {
      var I = S.element && S.element.icon;
      if (!I || typeof I.create !== 'function') return;
      Array.prototype.forEach.call(host.querySelectorAll('[data-icon]'), function (p) {
        if (p.querySelector('.shell-icon')) return;
        p.textContent = '';
        I.create(p, { glyph: p.getAttribute('data-icon') });
      });
    }
    function where() {
      var J = S.element && S.element.joinSteps;
      if (!J || !job || !steps) return null;
      var facts = J.fromJob(job, job.opened === true);
      var open = J.current(steps, facts);
      return { facts: facts, open: open ? open.until : null, done: steps.map(function (st) { return J.done(st, facts); }) };
    }
    function show() {
      if (gone) return;
      var now = where();
      if (!now) return;
      var said = JSON.stringify(now);
      if (said === shown) return;
      if (host.contains(document.activeElement)) { waiting = true; return; }
      shown = said;
      waiting = false;
      draw(now);
    }
    function draw(now) {
      made.forEach(function (m) { try { if (m && m.destroy) m.destroy(); } catch (e) { /* its own */ } });
      made = [];
      var reached = false;
      host.innerHTML = '<ol class="join-steps">' + steps.map(function (s, i) {
        // Every open step up to and including the open one is expanded.
        var open = !now.done[i] && !reached;
        if (s.until === now.open) reached = true;
        return '<li class="stat-tile wide">' +
          '<div class="label">' + mark(now.done[i] ? DONE : OPEN) + ' ' + esc(s.icon || '') + ' ' + esc(s.name) +
            (s.optional ? ' <span class="job-manifest-note">(optional)</span>' : '') + '</div>' +
          (open ? '<div class="job-manifest-note">' + esc(s.text || '') + '</div><div data-step="' + i + '"></div>' : '') +
          '</li>';
      }).join('') + '</ol>' +
      (now.open ? '' : '<div class="job-manifest-note">' + DONE + ' Every step is done.</div>');
      icons();
      steps.forEach(function (s, i) {
        var box = host.querySelector('[data-step="' + i + '"]');
        if (box) form(s, box, now.facts);
      });
    }
    // THE RELAYS THE FORMS OFFER, read when a step is drawn (which is when the job changed): relay.status rows every relay
    // this node lists, its seat, email and face.
    function withRelays(then) {
      S.outcome(Promise.resolve(S.ready).then(function (s) { return s.relay.status(''); })).then(function (r) {
        relays = (r && r.body && Array.isArray(r.body.rows)) ? r.body.rows : [];
      }, function () { relays = []; }).then(function () { if (!gone) then(); });
    }
    // The form each step draws, from the shell elements.
    function form(step, box, facts) {
      var E = S.element || {};
      // Step 1 (box v41): the one join control, its words where the node stands: Join with no seat, Add on a seat taken
      // without a verified email (by invite), Change once verified. THE EMAIL FORM, THE SAME EVERYWHERE (goal/G40.10).
      if (step.until === 'email' && E.joinForm) { withRelays(function () { E.joinForm.mount(box, { relays: relays }); }); return; }
      // FIND SOMEONE: the same one list Contacts draws (goal/G30.19). The node republishes join-steps once the contact is in.
      var list = E.search && E.search.contact && E.search.contact.listElement;
      if (step.until === 'contact' && list) {
        box.innerHTML = '<div class="join-find-list"></div><div class="job-manifest-note join-find-said"></div>';
        made.push(list.create(box.querySelector('.join-find-list'), {
          say: function (text) { var s = box.querySelector('.join-find-said'); if (s) s.textContent = text; },
          empty: 'Nobody matches: the network is searched as you type.',
        }));
        return;
      }
      // THE FACE FORM, THE SAME EVERYWHERE (goal/G40.10). The node republishes join-steps once a face is accepted.
      if (step.until === 'face' && E.faceForm) {
        withRelays(function () { E.faceForm.mount(box, { relays: relays, reload: function () { return Promise.resolve(); }, none: 'Take the star off to name a face.' }); });
        return;
      }
      if (step.until === 'opened') {
        var url = facts.faceUrl;
        box.innerHTML = url
          ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + '</a>'
          : '<div class="job-manifest-note">No face name yet.</div>';
      }
    }

    // The steps, read once from the Join app's manifest; the job, from the jobs family's cache, watched.
    Promise.resolve(S.fs.loadFile(STEPS)).then(function (text) {
      try { steps = (JSON.parse(text) || {}).steps || []; } catch (e) { steps = []; }
    }, function () { steps = []; }).then(function () { return parts; }).then(function () {
      return S.cacheManager('jobs');
    }).then(function () {
      if (gone) return;
      var J = ((S.data || {}).jobs || {}).data;
      if (!J) return;
      var take = function (j) { if (j && j.type === 'join-steps') { job = j.data || {}; show(); } };
      take(J.find(function (j) { return !!j && j.type === 'join-steps'; }));
      var off = J.watch(function (id, j) { take(j); });
      if (typeof off === 'function') offs.push(off);
    }, function () { if (!gone) host.textContent = 'Join could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        offs.forEach(function (off) { off(); });
        offs = [];
        made.forEach(function (m) { try { if (m && m.destroy) m.destroy(); } catch (e) { /* its own */ } });
        made = [];
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.joinList = { create: create };
}());
