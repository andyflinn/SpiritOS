// spirit/run/app/relayMonitor/relayMonitor.js
// THE OWNER WATCHES HIS RELAYS, AND MOVES ONE LEVER.
//
//   Andy: "console exchange is not something i like to see at all...
//   this sort of information could be streamed to the owner-node,
//   permitting a real-time monitor in shell for the relay memory status
//   etc...."
//   Andy: "i'm imagining a 'Relay monitor' intrinsic app, that features a
//   dropdown at the top, which allows to select which owned relay we
//   monitor."
//
// ── NO LEVER IS NAMED IN THIS FILE ───────────────────────────────────
//
// That is the whole claim, and `test/monitorApp.js` is what holds it: a
// lever invented on a relay next month is drawn by this app as it stands,
// because every lever describes itself (js/lever.js readOut) and this
// draws whatever the report carries. The moment a lever's label appears
// in this code, the generic promise is gone and the next lever needs an
// app release.
//
// ── IT ASKS FOR NOTHING NEW ──────────────────────────────────────────
//
// `relay.status` already answers rows with `owned`, and hands over the
// latest report per url under `relayStatus` — the same data natterDetails
// has been reading. Cycle 4.1 adds no node verb: this is a second reader
// of a report that already arrives on a stream this node already holds.
//
// ── WHAT IT DOES NOT DRAW ────────────────────────────────────────────
//
// A lever that is not live gets no control, rather than a control that
// would be refused. A report with no `at` is drawn without a capture
// time rather than with an invented one. A relay that has said nothing
// yet says so — "said nothing yet" and "said zero" are different things
// and must not look the same.

(function () {
  'use strict';

  // The lever rules, from the same file the relay uses. In the shell that
  // is the global index.html loads; in a suite it is the module, so the
  // pure half can be asserted without a browser. Same two-environment
  // shape as js/lever.js and js/labelRule.js, and for the same reason:
  // one implementation, so the app and the relay cannot drift.
  //
  // Absent only if the page was built wrong, in which case the app still
  // draws and simply says it could not read the lever.
  function leverLib() {
    if (typeof window !== 'undefined' && window.spiritLever) return window.spiritLever;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../../js/lever.js'); } catch (e) { return null; }
    }
    return null;
  }

  // ── THE PURE HALF ──────────────────────────────────────────────────
  //
  // Report in, rows out. No DOM, no api, no clock — so the claim "this
  // draws a lever it has never heard of" can be asserted without a
  // browser, which is the only way it gets asserted at all.
  function rmLeverRows(report) {
    var levers = (report && report.levers) || null;
    if (!levers) return [];
    return Object.keys(levers).sort().map(function (label) {
      var raw = levers[label] || {};
      var lib = leverLib();
      // `fromReport` refuses anything it could not SET — a label with no
      // iteration, bounds that are not numbers. That is the right rule
      // for a control and the wrong one for a picture, so it decides
      // whether there is a control and nothing else.
      var view = lib ? lib.fromReport(raw) : null;
      var last = raw.lastMove || null;

      // AN OLDER RELAY CARRIES ITS VALUE UNDER `allowed`. Cycle 1 reported
      // { position, allowed, floor, ceiling }; the lever's own readOut
      // calls it `value`. spirit-3 is on the older release, so reading
      // only `value` drew "undefined" beside a perfectly good number.
      var value = raw.value !== undefined ? raw.value
        : (raw.allowed !== undefined ? raw.allowed : undefined);

      var bounded = typeof raw.floor === 'number' && typeof raw.ceiling === 'number';

      return {
        label: label,
        value: value,
        floor: raw.floor,
        ceiling: raw.ceiling,
        // A CONTROL ONLY WHERE ONE WOULD BE ACCEPTED, and the RAW `live`
        // is what decides it. `fromReport` reads a missing `live` as
        // true, which is right for a relay building its own levers —
        // there live is the default. Here it is not: silence came from a
        // relay older than the field, and the honest reading of silence
        // is "I do not know", which draws no control.
        //
        // AGENT.md's chrome rule: prefer not drawing it to hiding it.
        settable: !!(view && raw.live === true),
        held: raw.held === true,
        // DRAWABLE IS NOT SETTABLE. An old-shape lever is perfectly
        // readable — a number between two bounds — and the owner is
        // entitled to watch it even though this app cannot move it.
        drawable: bounded && value !== undefined,
        lastMove: last ? {
          from: last.from, to: last.to, why: last.why,
          by: last.by || 'programme', at: last.at
        } : null
      };
    });
  }

  // The one line a person reads. Kept beside the row builder so the
  // wording is asserted with the shape.
  function rmLeverLine(row) {
    // Only a lever whose NUMBERS cannot be read gets nothing but a
    // complaint. Everything else shows where it stands first, because
    // that is what the owner came to see.
    if (!row.drawable) return row.label + ': this node cannot read that lever';

    var line = row.label + ': ' + String(row.value) +
      ' (floor ' + row.floor + ', ceiling ' + row.ceiling + ')';

    if (row.held) {
      line += ' — set by owner';
    } else if (!row.settable) {
      // The plan's own words for a relay older than the verb. Not an
      // error: this relay is working exactly as it was built to.
      line += ' — this relay does not take lever settings';
    }

    if (row.lastMove) {
      line += ' — last: ' + row.lastMove.from + ' → ' + row.lastMove.to;
      // THE OWNER'S OWN MOVE NEEDS NO EXPLANATION. Its `why` is the
      // constant the relay stamps on every owner setting, so printing it
      // beside a line that already says "set by owner" said the same
      // thing three times. The programme's reason is the one worth
      // reading, because it differs every move.
      line += row.lastMove.by === 'owner'
        ? ' (you)'
        : ' (' + row.lastMove.by + ': ' + row.lastMove.why + ')';
    }
    return line;
  }

  // ── THE ENVELOPE IS NOT THE ANSWER ─────────────────────────────────
  //
  // `api.verb` answers { status, text, body } — the envelope — and not
  // what the node said. natterDetails carries its own `ndAsk` that parses
  // `text` for exactly this reason.
  //
  // This cost a live run: reading `data.rows` straight off the envelope
  // finds undefined, and the app then said, truthfully and uselessly,
  // that it could see no owned relay while the node was holding two. It
  // lives out here rather than inside mount so the suite can reach it —
  // the pure/DOM split made the DRAWING assertable and left the WIRING
  // untested, and the wiring is what broke.
  function rmAnswerOf(r) {
    if (!r) return null;
    if (r.body && typeof r.body === 'object') return r.body;
    try { return JSON.parse(r.text); } catch (e) { return null; }
  }

  // ── WHERE A RELAY'S KEY ACTUALLY LIVES ─────────────────────────────
  //
  // Not on the row. `row.relayKey` is a field this app invented, and the
  // invention cost a live run: Apply answered "this node does not hold
  // that relay's key" about a relay the node owns.
  //
  // natterDetails' ndRelayKey has carried the real answer since cycle 3,
  // and the ORDER matters there for a reason that does not apply here but
  // is worth keeping anyway: `census.relayKey` comes off the public
  // census every probe already fetches, so a plain MEMBER has it, while
  // `report.key` is pushed to the owner alone. Reading the owner's copy
  // first would work for exactly one person and look fine.
  function rmRelayKey(row, report) {
    return (row && row.census && row.census.relayKey) ||
      (report && report.key) || '';
  }

  // "as of 14:02", or nothing. A missing capture time is drawn as missing:
  // the whole point of `at` is that a stale view reads as stale, and an
  // invented timestamp would defeat it.
  function rmAsOf(report) {
    var at = report && report.at;
    if (typeof at !== 'string' || !at) return '';
    return 'as of ' + at.slice(11, 19);
  }

  if (typeof window !== 'undefined') {
    window.spiritRelayMonitor = {
      leverRows: rmLeverRows,
      leverLine: rmLeverLine,
      asOf: rmAsOf,
      answerOf: rmAnswerOf,
      relayKey: rmRelayKey
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      leverRows: rmLeverRows, leverLine: rmLeverLine,
      asOf: rmAsOf, answerOf: rmAnswerOf, relayKey: rmRelayKey
    };
  }

  // ── THE SHELL HALF ─────────────────────────────────────────────────
  if (typeof window === 'undefined' || !window.spirit || !window.spirit.shell) return;

  spirit.shell.activateApp({
    mount: function (container, api) {
      var escapeHtml = api.escapeHtml;
      var rows = [];
      var chosen = '';
      var reports = {};
      var saying = '';

      function owned() {
        return rows.filter(function (r) { return r && r.owned; });
      }

      function render() {
        var mine = owned();
        if (!mine.length) {
          container.innerHTML = '<p>This node owns no relay, so there is nothing to watch. ' +
            'A relay you own appears here on its own.</p>';
          return;
        }
        if (!chosen || !mine.some(function (r) { return r.url === chosen; })) {
          chosen = mine[0].url;
        }
        var report = reports[chosen] || null;

        var html = '<label>Relay <select id="rm-pick">' +
          mine.map(function (r) {
            return '<option value="' + escapeHtml(r.url) + '"' +
              (r.url === chosen ? ' selected' : '') + '>' + escapeHtml(r.url) + '</option>';
          }).join('') + '</select></label>';

        if (!report) {
          html += '<p>This relay has not reported yet.</p>';
          container.innerHTML = html;
          wire();
          return;
        }

        var asOf = rmAsOf(report);
        if (asOf) html += '<p class="rm-asof">' + escapeHtml(asOf) + '</p>';

        var levers = rmLeverRows(report);
        if (!levers.length) {
          html += '<p>This relay reports no levers.</p>';
        } else {
          html += '<ul class="rm-levers">' + levers.map(function (row) {
            var li = '<li>' + escapeHtml(rmLeverLine(row));
            if (row.settable) {
              li += ' <input class="rm-set" data-lever="' + escapeHtml(row.label) +
                '" value="' + escapeHtml(String(row.value)) + '" size="10">' +
                '<button class="rm-apply" data-lever="' + escapeHtml(row.label) +
                '">Apply</button>';
            }
            return li + '</li>';
          }).join('') + '</ul>';
        }
        if (saying) html += '<p class="rm-say">' + escapeHtml(saying) + '</p>';
        container.innerHTML = html;
        wire();
      }

      function wire() {
        var pick = container.querySelector('#rm-pick');
        if (pick) {
          pick.onchange = function () { chosen = pick.value; saying = ''; render(); };
        }
        Array.prototype.forEach.call(container.querySelectorAll('.rm-apply'), function (btn) {
          btn.onclick = function () { apply(btn.getAttribute('data-lever')); };
        });
      }

      // BEFORE TAXING THE WIRE, and with the relay's own rule. `canSet`
      // comes from js/lever.js, which is the same file the relay applies
      // — so a refusal here and a refusal there cannot disagree.
      function apply(label) {
        var field = container.querySelector('.rm-set[data-lever="' + label + '"]');
        if (!field) return;
        var raw = String(field.value || '').trim();
        var lib = leverLib();
        var report = reports[chosen] || null;
        var view = lib && report && report.levers
          ? lib.fromReport(report.levers[label]) : null;
        var value = raw === (lib ? lib.DYNAMIC : 'dynamic') ? raw : Number(raw);
        if (view) {
          var no = view.canSet(value);
          if (no) { saying = no; render(); return; }
        }

        var row = owned().filter(function (r) { return r.url === chosen; })[0];
        var relayKey = rmRelayKey(row, report);
        if (!relayKey) { saying = 'this node does not hold that relay’s key'; render(); return; }

        saying = 'asking…';
        render();
        api.peerPost('relay', relayKey, { lever: { name: label, set: value } })
          .then(function (r) {
            var said = r && r.reply;
            if (r && r.ok && said && said.ok !== false) {
              // WHAT IT COST, in the relay's own number. 4.5's dialog does
              // not exist, so this line is where "closed 3" appears.
              saying = said.closed
                ? 'set — and closed ' + said.closed + ' stream' + (said.closed === 1 ? '' : 's')
                : 'set';
            } else if (said && said.error) {
              // THE RELAY'S OWN WORDS. An app inventing its own wording
              // for a refusal drifts from what the relay actually did.
              saying = said.error;
            } else {
              // NEITHER "failed" NOR "done" — the setting may have been
              // applied and the answer lost. The next report is the truth.
              saying = 'no answer — the relay may have applied it; watch the next report';
            }
            render();
          })
          .catch(function () {
            saying = 'no answer — the relay may have applied it; watch the next report';
            render();
          });
      }

      function load() {
        return api.verb('relay.status', { name: '' })
          .then(function (r) {
            var data = rmAnswerOf(r);
            rows = (data && data.rows) || [];
            reports = (data && data.relayStatus) || {};
            render();
          })
          .catch(function () { render(); });
      }

      // Already paced to one a second per relay by the shell, so this is
      // a repaint and not a poll.
      if (api.onRelayEvent) api.onRelayEvent(function () { load(); });
      load();
    }
  });
}());
