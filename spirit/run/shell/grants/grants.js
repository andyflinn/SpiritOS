// spirit/run/shell/grants/grants.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6).
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has
//   interactive access", "it will be the apiAuth module that provides the necessary loopback
//   interface for the shell app", "yes i find it by searching labels, then select one key, and
//   issue or revoke grand rows for that key.", "so we defer pruning to be triggered by the owners
//   auth app, who can report deprecated branches", and on the name: "YES to your name".
//
// Four jobs, nothing else:
//   - GIVE: a contact (createContactSelector) and a path (createApiBranchSelector), granted
//     through jobs.authGrant; a server's DEPENDENCIES bundle offered beside it, because an owner
//     granting an app should see what that app's peer users actually need.
//   - SEE: a key's grants (jobs.authPeer), found by label or path word (jobs.authSearch).
//   - REVOKE: each row's own button, jobs.authRevoke. Nothing here writes node.db; every change
//     goes through the loopback verbs apiAuth.js answers.
//   - REPORT: a grant whose path spiritApiTreeIndex.serves says is gone (the server suspended or
//     the verb dropped) is MARKED deprecated, never pruned — pruning is the owner's press, one
//     revoke at a time (Andy's ruling above).

var grApi = null;
var grTree = null;

function grEsc(text) { return grApi.escapeHtml(String(text == null ? '' : text)); }

// The owner's api tree, once per paint: what serves() judges against.
function grLoadTree() {
  return grApi.verb('jobs.api', { ask: 'api' }).then(function (a) {
    grTree = (a && a.body) || {};
    return grTree;
  });
}

function grSay(text, isError) {
  var out = document.getElementById('gr-said');
  if (!out) return;
  out.textContent = text;
  out.className = isError ? 'job-refusal' : 'job-manifest-note';
}

function grRefusal(body) {
  return (body && (body.error || body.code)) || 'refused';
}

// One key's rows, painted with the deprecation report beside each path.
function grPaintRows(rows) {
  var list = document.getElementById('gr-rows');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<div class="job-log-empty">no grants to show</div>';
    return;
  }
  list.innerHTML = rows.map(function (r, i) {
    var gone = grTree && !window.spiritApiTreeIndex.serves(grTree, r.path);
    return '<div class="card gr-row" data-i="' + i + '">' +
      '<span class="gr-label">' + grEsc(r.label) + '</span> ' +
      '<span class="gr-path">' + grEsc(r.path) + '</span>' +
      // Deprecated is a REPORT: the server is away or the verb is gone,
      // and the grant waits for the owner, intact (suspend/repair, G1.4).
      (gone ? ' <span class="gr-gone" title="no server serves this path today">deprecated</span>' : '') +
      ' <button type="button" class="gr-revoke" data-key="' + grEsc(r.key) + '" data-path="' + grEsc(r.path) + '">Revoke</button>' +
      '</div>';
  }).join('');
}

function grShowPeer(key) {
  return grApi.verb('jobs.authPeer', { key: key }).then(function (a) {
    if (a.status !== 200) { grSay('could not read the grants: ' + grRefusal(a.body), true); return; }
    grPaintRows((a.body && a.body.records) || []);
  });
}

function grSearch(text) {
  return grApi.verb('jobs.authSearch', { text: String(text || '') }).then(function (a) {
    if (a.status !== 200) { grSay('search refused: ' + grRefusal(a.body), true); return; }
    grPaintRows((a.body && a.body.records) || []);
    if (a.body && a.body.more) grSay('more rows than fit one answer — narrow the search');
  });
}

// The chosen server's bundle: its DEPENDENCIES, read through jobs.api,
// the way every owner question reaches a server.
function grLoadBundle(server) {
  var slot = document.getElementById('gr-bundle');
  if (!slot) return;
  if (!server) { slot.innerHTML = ''; return; }
  var ask = {};
  ask[server] = { DEPENDENCIES: {} };
  grApi.verb('jobs.api', { ask: ask }).then(function (a) {
    var paths = (a.body && a.body.paths) || [];
    slot.innerHTML = paths.length
      ? '<div class="job-manifest-note">' + grEsc(server) + ' says a peer user needs: ' +
        paths.map(grEsc).join(', ') +
        ' <button type="button" id="gr-grant-bundle">Grant the bundle</button></div>'
      : '';
    var all = document.getElementById('gr-grant-bundle');
    if (all) all.addEventListener('click', function () { grGrantMany(paths); });
  });
}

function grPickedKey() {
  var pick = document.querySelector('#gr-contact-slot .contact-selector');
  return (pick && pick.value) || '';
}

function grGrant(key, path) {
  if (!key) { grSay('pick a contact first', true); return Promise.resolve(); }
  if (!path) { grSay('pick a server or a verb first', true); return Promise.resolve(); }
  return grApi.verb('jobs.authGrant', { key: key, path: path }).then(function (a) {
    if (a.status !== 200) { grSay('grant refused: ' + grRefusal(a.body), true); return; }
    grSay('granted ' + ((a.body && a.body.label) || '') + ' ' + path);
    return grShowPeer(key);
  });
}

function grGrantMany(paths) {
  var key = grPickedKey();
  if (!key) { grSay('pick a contact first', true); return; }
  var left = paths.slice();
  (function next() {
    if (!left.length) { grShowPeer(key); return; }
    grGrant(key, left.shift()).then(next);
  })();
}

function grRevoke(key, path) {
  return grApi.verb('jobs.authRevoke', { key: key, path: path }).then(function (a) {
    if (a.status !== 200) { grSay('revoke refused: ' + grRefusal(a.body), true); return; }
    grSay('revoked ' + path);
    var searched = document.getElementById('gr-search');
    return grPickedKey() ? grShowPeer(grPickedKey()) : grSearch(searched ? searched.value : '');
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    grApi = api;
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div class="label">Who may call which api</div>' +
        '<div class="job-manifest-note">A member calls only what you have granted: a whole server, ' +
          'or one verb. Denial is the absence of a row, so an empty table means only you.</div>' +
        '<div class="start-job-form card">' +
          '<label class="field-label">Contact<span id="gr-contact-slot"></span></label>' +
          '<label class="field-label">Path<span id="gr-branch-slot"></span></label>' +
          '<button type="button" id="gr-grant">Grant</button>' +
          '<span id="gr-bundle"></span>' +
        '</div>' +
        '<div class="start-job-form card">' +
          '<label class="field-label grow">Find grants by label or path word' +
            '<input type="text" id="gr-search" placeholder="alice, desk, items…"></label>' +
        '</div>' +
        '<div id="gr-said" class="job-manifest-note"></div>' +
        '<div id="gr-rows"></div>' +
      '</div>';

    var contact = api.ui.elements.createContactSelector({ placeholder: 'whose access…' });
    document.getElementById('gr-contact-slot').appendChild(contact);
    var branch = api.ui.elements.createApiBranchSelector({});
    document.getElementById('gr-branch-slot').appendChild(branch);

    contact.addEventListener('change', function () {
      if (contact.value) grShowPeer(contact.value);
    });
    branch.addEventListener('change', function () {
      // The server half of the path names whose bundle to offer.
      var server = branch.value ? branch.value.split('.')[0] : '';
      grLoadBundle(server);
    });
    document.getElementById('gr-grant').addEventListener('click', function () {
      grGrant(grPickedKey(), branch.value);
    });
    document.getElementById('gr-search').addEventListener('input', function (event) {
      grSearch(event.target.value);
    });
    document.getElementById('gr-rows').addEventListener('click', function (event) {
      var b = event.target && event.target.closest ? event.target.closest('.gr-revoke') : null;
      if (b) grRevoke(b.getAttribute('data-key'), b.getAttribute('data-path'));
    });

    grLoadTree().then(function () { return grSearch(''); });
  },
});
