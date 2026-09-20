// spirit/run/app/relayMonitor/relayMonitor.js
// THE OWNER WATCHES HIS RELAYS. HE DOES NOT MOVE THEM.
//
//   Andy: "console exchange is not something i like to see at all...
//   this sort of information could be streamed to the owner-node,
//   permitting a real-time monitor in shell for the relay memory status
//   etc...."
//   Andy: "i'm imagining a 'Relay monitor' intrinsic app, that features a
//   dropdown at the top, which allows to select which owned relay we
//   monitor."
//   Andy, 2026-09-20 (decision 0015): "The monitor should allow the owner
//   to observe and see changes happening, not cause changes. see and
//   record changes, in fact. and from the recording-analysis, teach the
//   relay better effectiveness through program changes."
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
// Nothing gets a control. Decision 0015: the Governor is the result of
// programming, the owner watches, and the record of what he watched is
// what changes the programme. No lever in the tree declares itself
// settable — spirit/test/settableCensus.js holds that at zero — so the
// meter IS the policy rather than a control that has been disabled.
//
// A report with no `at` is drawn without a capture time rather than with
// an invented one. A relay that has said nothing yet says so: "said
// nothing yet" and "said zero" are different things and must not look
// the same.

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
        // Decision 0015: no lever in this tree is settable, so this is
        // false everywhere today. Kept because the property is what
        // decides it, not the app — and the day a lever declares itself,
        // this draws its control without an app release.
        settable: !!(view && raw.settable === true),
        locked: raw.locked === true,
        // DRAWABLE IS NOT SETTABLE. An old-shape lever is perfectly
        // readable — a number between two bounds — and the owner is
        // entitled to watch it even though this app cannot move it.
        drawable: bounded && value !== undefined,
        // WHICH END IS THE BAD ONE, declared by the lever because the
        // app cannot know. Absent means no claim, and the meter draws
        // without a direction rather than inventing one.
        worseAt: raw.worseAt === 'floor' || raw.worseAt === 'ceiling' ? raw.worseAt : null,
        // The Governor's own granularity, off the report. "4/12" means
        // twelve stops, which is few enough to tick; 2048 values are not.
        steps: (function () {
          var m = /^\s*\d+\s*\/\s*(\d+)\s*$/.exec(String(raw.position || ''));
          var n = m ? Number(m[1]) : 0;
          return n > 1 && n <= 24 ? n : 0;
        }()),
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

    // ONLY THE NOTABLE STATE IS SAID. Under 0015 no lever is settable,
    // so "this relay does not take lever settings" would appear on every
    // row of every relay and tell the owner nothing. The ABSENCE of a
    // control is the message; a lock is the exception worth a word.
    if (row.locked) line += ' — locked by owner';

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

  // ── THE METER ──────────────────────────────────────────
  //
  //   Andy: "i'd prefer horizontal potentiometers, with tooltips
  //   indicating their range, maybe ticks if the values have few enough
  //   options, in table form: name (connections) second column a 100%
  //   width horizontal level-meter, who's color kind is a gradient from
  //   green to red on the right"
  //
  // A meter cannot be clicked, so under 0015 the DISPLAY IS THE POLICY
  // rather than a control that has been disabled.
  //
  // Returned as data, not markup, for the reason today taught twice: the
  // pure/DOM split made the drawing assertable and left everything else
  // untested. The arithmetic is the part worth asserting.
  function rmMeter(row) {
    if (!row || !row.drawable) return null;
    var span = row.ceiling - row.floor;
    // A lever with one legal value is a constant wearing a range. Draw it
    // full rather than dividing by zero.
    var pct = span > 0
      ? Math.max(0, Math.min(100, ((row.value - row.floor) / span) * 100))
      : 100;

    // RED AT THE END THE LEVER CALLS WORSE. Absent, the meter makes no
    // claim — neutral rather than a guess, because the same gradient means
    // opposite things on connections1 and requestTimeout1.
    var redAt = row.worseAt === 'floor' ? 'left'
      : row.worseAt === 'ceiling' ? 'right' : null;

    var ticks = [];
    if (row.steps) {
      for (var i = 0; i <= row.steps; i += 1) ticks.push((i / row.steps) * 100);
    }

    return {
      pct: pct,
      redAt: redAt,
      ticks: ticks,
      tooltip: row.label + ': ' + row.value +
        ' — floor ' + row.floor + ', ceiling ' + row.ceiling +
        (redAt ? ' — worse at the ' + row.worseAt : '')
    };
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
      relayKey: rmRelayKey,
      meter: rmMeter
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      leverRows: rmLeverRows, leverLine: rmLeverLine,
      asOf: rmAsOf, answerOf: rmAnswerOf, relayKey: rmRelayKey,
      meter: rmMeter
    };
  }

  // ── THE SHELL HALF ────────────────────────────────────────
  if (typeof window === 'undefined' || !window.spirit || !window.spirit.shell) return;

  if (!document.getElementById('relay-monitor-styles')) {
    var st = document.createElement('style');
    st.id = 'relay-monitor-styles';
    st.textContent =
      '.rm-table{width:100%;border-collapse:collapse}' +
      '.rm-table td{padding:4px 6px;vertical-align:middle}' +
      '.rm-name{white-space:nowrap;font-family:monospace}' +
      '.rm-cell{width:100%}' +
      '.rm-track{position:relative;height:14px;border:1px solid #888;border-radius:7px;overflow:hidden}' +
      '.rm-mark{position:absolute;top:-2px;bottom:-2px;width:3px;background:#000}' +
      '.rm-tick{position:absolute;top:0;bottom:0;width:1px;background:rgba(0,0,0,.28)}' +
      '.rm-num{font-family:monospace;white-space:nowrap;text-align:right}' +
      '.rm-note{opacity:.75}';
    document.head.appendChild(st);
  }

  spirit.shell.activateApp({
    mount: function (container, api) {
      var escapeHtml = api.escapeHtml;
      var rows = [];
      var chosen = '';
      var reports = {};

      function owned() {
        return rows.filter(function (r) { return r && r.owned; });
      }

      // THE GRADIENT RUNS TOWARD THE END THE LEVER CALLS WORSE. With no
      // claim it is neutral grey — a colour that means nothing is better
      // than one that means the opposite of what the owner reads.
      function trackStyle(meter) {
        if (meter.redAt === 'right') return 'linear-gradient(to right,#2e7d32,#f9a825,#c62828)';
        if (meter.redAt === 'left') return 'linear-gradient(to right,#c62828,#f9a825,#2e7d32)';
        return 'linear-gradient(to right,#bdbdbd,#9e9e9e)';
      }

      function meterCell(row) {
        var meter = rmMeter(row);
        if (!meter) return '<td class="rm-cell rm-note">' + escapeHtml('cannot be read') + '</td>';
        var ticks = meter.ticks.map(function (t) {
          return '<span class="rm-tick" style="left:' + t.toFixed(3) + '%"></span>';
        }).join('');
        return '<td class="rm-cell"><div class="rm-track" title="' +
          escapeHtml(meter.tooltip) + '" style="background:' + trackStyle(meter) + '">' +
          ticks + '<span class="rm-mark" style="left:' + meter.pct.toFixed(3) + '%"></span>' +
          '</div></td>';
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
          container.innerHTML = html + '<p>This relay has not reported yet.</p>';
          wire();
          return;
        }

        var asOf = rmAsOf(report);
        if (asOf) html += '<p class="rm-note">' + escapeHtml(asOf) + '</p>';

        var levers = rmLeverRows(report);
        if (!levers.length) {
          html += '<p>This relay reports no levers.</p>';
        } else {
          html += '<table class="rm-table">' + levers.map(function (row) {
            return '<tr><td class="rm-name">' + escapeHtml(row.label) + '</td>' +
              meterCell(row) +
              '<td class="rm-num">' + escapeHtml(String(row.value)) + '</td></tr>' +
              '<tr><td></td><td colspan="2" class="rm-note">' +
              escapeHtml(rmLeverLine(row)) + '</td></tr>';
          }).join('') + '</table>';
        }
        container.innerHTML = html;
        wire();
      }

      function wire() {
        var pick = container.querySelector('#rm-pick');
        if (pick) pick.onchange = function () { chosen = pick.value; render(); };
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
