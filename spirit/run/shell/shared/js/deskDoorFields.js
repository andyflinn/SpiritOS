// spirit/run/shell/shared/js/deskDoorFields.js
// A STACK-FRAME DOOR'S FOUR FIELDS, ONE COPY FOR EVERY FORM THAT HOLDS THEM (goal/G27.2).
//
// Moved here from the Stacks pane (shell/desk/plugins/stackFrameChecks) when its door dialog became a shell dialog of
// its own (shell/stackFrameCheckDetail): the pane's add form and the dialog's edit form both hold a door's fields, so
// both use this, loaded on demand (Andy, 2026-10-17: "it is ok for apps to know about other apps and their shared
// elements"). It adds itself to window.spiritElements as every shared element does.
//
// THE FORMS, DECIDED BY ANDY (goal/G22.3's box, 2026-10-13), not this file's to loosen: the gate is narrow, one
// spirit/run/<file>.js::<function>, and a whole module named as the gate is cheating; the endpoint is wide, a whole
// module, spirit/run/<file>.js, or Node's own, node:<http|https|fetch joined by +>, which takes its request paths.
// Every input carries its data-field (gate, endpoint, paths, suites) and is checked as typed, what is wrong said below
// it inside its framed block, the form's button off while any is wrong. The server half refuses what is wrong all the
// same; this only spares the wire.
//
//   deskDoorFields.FIELDS                       gate, endpoint, paths, suites
//   deskDoorFields.html(pre)                    the four framed blocks, ids pre + field
//   deskDoorFields.check(pre, buttonId)         says each field's meaning and what is wrong; the button off while wrong
//   deskDoorFields.why(pre, field)              what is wrong with one field, '' when it may be sent
//   deskDoorFields.door(pre)                    { gate, endpoint, paths, suites } as typed
//   deskDoorFields.fill(pre, door)              puts a door's values in the form

(function () {
  var FILE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js$/;
  var GATE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js::[A-Za-z_$][A-Za-z0-9_$]*$/;
  var SUITE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/;
  var PATH_RE = /^\/[A-Za-z0-9_.~%\/-]*$/;
  var KINDS = ['http', 'https', 'fetch'];
  var FIELDS = ['gate', 'endpoint', 'paths', 'suites'];
  var FORM_MAX = 256;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function value(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }
  function listOf(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function why(pre, field) {
    var v = value(pre + field).trim();
    var end = value(pre + 'endpoint').trim();
    var node = /^node:/.test(end);
    if (v.length > FORM_MAX) return v.length + ' characters, the limit is ' + FORM_MAX;
    if (field === 'gate') {
      if (!v) return '';
      if (FILE_RE.test(v)) return 'a whole module as the gate is cheating: name one function, ' + v + '::<function>';
      return GATE_RE.test(v) ? '' : 'a gate is spirit/run/<file>.js::<function>';
    }
    if (field === 'endpoint') {
      if (!v) return '';
      if (/::/.test(v)) return 'an endpoint is a whole module, spirit/run/<file>.js, not one function';
      if (node) {
        var kinds = v.slice(5).split('+');
        var bad = kinds.filter(function (k) { return KINDS.indexOf(k) === -1; });
        return bad.length ? 'Node\'s own are ' + KINDS.join(', ') + ', joined by +; not ' + bad.join(', ') : '';
      }
      return FILE_RE.test(v) ? '' : 'an endpoint is spirit/run/<file>.js, the whole module, or node:<kinds>';
    }
    var list = listOf(v);
    if (field === 'paths') {
      if (node && !list.length) return 'a node: endpoint needs its request paths, e.g. /api/relay/';
      if (!node && list.length) return 'paths belong to a node: endpoint; a module takes none';
      var p = list.filter(function (x) { return !PATH_RE.test(x); })[0];
      return p ? 'the path ' + p + ' is no request path: it starts with / and holds no space' : '';
    }
    var s = list.filter(function (x) { return !SUITE_RE.test(x); })[0];
    // Said without naming the harness's folder: nothing under spirit/run names it in code (runStandsAlone.js).
    if (s) return s + ' is not a suite\'s file name, <name>.js, with no folder';
    return list.some(function (x, i) { return list.indexOf(x) !== i; }) ? 'a suite is named twice' : '';
  }
  // What goes in a field, in words, on its block's first line: for an empty or wrong field what goes in it, for a right
  // one what its value means (goal/G22.3).
  var EMPTY = {
    gate: 'the one function every call must pass through: spirit/run/<file>.js::<function>',
    endpoint: 'what the gate guards: a whole module, spirit/run/<file>.js, or Node\'s own network calls, node:http+https+fetch',
    paths: 'the request paths a node: endpoint is watched on, comma-separated; a module takes none',
    suites: 'the test suites run while the probe watches, comma-separated file names',
  };
  function says(pre, field) {
    var v = value(pre + field).trim();
    if (!v || why(pre, field)) return EMPTY[field];
    if (field === 'gate') return 'one function, ' + v.split('::')[1] + ', in ' + v.split('::')[0];
    if (field === 'endpoint') return /^node:/.test(v) ? 'Node\'s own network calls: ' + v.slice(5).split('+').join(', ') : 'every function of ' + v;
    if (field === 'paths') return 'only the requests to ' + listOf(v).join(', ');
    return 'the test suites run while the probe watches: ' + listOf(v).join(', ');
  }
  function check(pre, buttonId) {
    var wrong = false;
    FIELDS.forEach(function (f) {
      var w = why(pre, f);
      if (w) wrong = true;
      var head = document.getElementById(pre + f + '-says');
      if (head) head.textContent = says(pre, f);
      var left = document.getElementById(pre + f + '-left');
      if (!left) return;
      left.textContent = w;
      left.className = 'job-start-error';
    });
    var b = buttonId ? document.getElementById(buttonId) : null;
    if (b) b.disabled = wrong;
    return !wrong;
  }
  // EACH INPUT IN ITS OWN FRAMED BLOCK (goal/G22.3). Andy, 2026-10-13: "input fields will look less crappy if arranged
  // in a block, that itself act's like an inline element".
  function html(pre) {
    var place = { gate: 'spirit/run/js/peerPost.js::createPeerPost', endpoint: 'spirit/run/js/presenceNode.js, or node:http+https+fetch',
      paths: '/api/relay/', suites: 'serverSurface.js, everyVerb.js' };
    var label = { gate: 'Gate', endpoint: 'Endpoint', paths: 'Paths', suites: 'Suites' };
    return FIELDS.map(function (f) {
      return '<div class="sfc-field" data-block="' + pre + f + '" style="display:inline-block;vertical-align:top;box-sizing:border-box;width:30em;max-width:100%;' +
          'margin-top:1em;margin-right:1em;padding:0.5em 0.75em;border:1px solid var(--spirit-line, #e2e5e9);border-radius:var(--spirit-radius, 8px)">' +
          '<div><b>' + label[f] + ':</b> <span id="' + pre + f + '-says" class="job-manifest-note">' + esc(EMPTY[f]) + '</span></div>' +
          '<input type="text" id="' + pre + f + '" data-field="' + f + '" placeholder="' + esc(place[f]) + '" style="box-sizing:border-box;width:100%;margin-top:0.5em">' +
          '<div id="' + pre + f + '-left" class="job-start-error"></div>' +
        '</div>';
    }).join('');
  }
  function door(pre) {
    return { gate: value(pre + 'gate').trim(), endpoint: value(pre + 'endpoint').trim(), paths: listOf(value(pre + 'paths')), suites: listOf(value(pre + 'suites')) };
  }
  function fill(pre, d) {
    var set = function (f, v) { var el = document.getElementById(pre + f); if (el) el.value = v; };
    set('gate', (d && d.gate) || '');
    set('endpoint', (d && d.endpoint) || '');
    set('paths', d && Array.isArray(d.paths) ? d.paths.join(', ') : '');
    set('suites', d && Array.isArray(d.suites) ? d.suites.join(', ') : '');
  }

  var win = typeof window !== 'undefined' ? window : {};
  win.spiritElements = win.spiritElements || {};
  win.spiritElements.deskDoorFields = { FIELDS: FIELDS, html: html, check: check, why: why, door: door, fill: fill };
}());
