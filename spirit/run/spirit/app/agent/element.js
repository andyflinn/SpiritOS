'use strict';
// spirit/run/spirit/app/agent/element.js
// THE AGENT FACE APP (goal/G41.1): the face of the agent server, built on the workBench element, on the face on
// loopback and through a relay alike. Its contract and its test: ./test/browserAgent.md and ./test/browserAgent.js. Loaded
// on a page by ./agent.js.
//
//   spirit.element.spirit.app.agent.element.create(container) -> { destroy() }
//
// AN ELEMENT (goal/G43.13): it reads only its container; the { title, open } the appSelector's launch hands it go unread. It keeps no state of its own: the tick
// box that showed the server's DEBUG in the old shell's title went with that title (Andy: "yes, delete the tick box.").
//
// NO AGENTS TALK TO EACH OTHER THROUGH IT (goal/G41.1, Q1; the ruling of 2026-10-02, goal/G3.1, stands): each agent
// sees itself as the only agent and user of the node.
//
//   The right tool, ⚙, shows the app's icon and label, then serverDEBUG (goal/G43.15): the DEBUG switch every server has.
//   THE DATA SET'S TABLES (goal/G41.4; Andy, box v22: "every one of these tables will come with a left-edge icon that
//   puts up a panel in the left-side tool-display of the workBench UI used in this app"): one left tool per table of
//   agent.db, each mounting that table's own element, spirit/app/agent/table/<name>/elementTable.js. A row opened from
//   a list is edited in the workBench's centre, the one detail pane of the app.
//   NO GRANT TOOL (goal/G41.21, box v17: "agent.grant is removed altogether: its table, its server, and the Grants tool
//   in the left strip. A job's grant is its bundle"). THE BUNDLE EDITOR IN THE RIGHT STRIP ("The right strip gets its
//   first real tool: the bundle editor"): spirit/element/bundleEditor.js, beside the agent server's DEBUG box.
(function () {
  // one: the table's name as a detail pane's title row says it ("[Table-Icon] \"Add | Change\" [Table-name]").
  var TABLES = [
    { name: 'provider', icon: '🏢', title: 'Model providers', one: 'Provider' },
    { name: 'model', icon: '🧠', title: 'Models', one: 'Model' },
    { name: 'persona', icon: '🎭', title: 'Personas', one: 'Persona' },
    { name: 'job', icon: '📋', title: 'Jobs', one: 'Job' },
  ];

  // ITS TABLES ASK FOR THEMSELVES (goal/G43.24; Andy: "every element that accesses ANY api must require them themselves"):
  // each table's list is a probabilitySearch that asks agent.<table> through the spirit object, the agent's own family
  // bound by spirit.require when it is not on spirit.ready. So the app hands its tables no api: their box and its detail pane.

  // An element by its place, spirit.element.<its path> (goal/G43.32): undefined while any part of the path is not there yet.
  function agentAt(place) {
    return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, window.spirit && window.spirit.element);
  }
  function create(container) {
      var E = (window.spirit && window.spirit.element) || {};
      var gone = false;
      var serverPanel = null;

      // Its whole app area is one workBench, in a box of a stated size (rule/16). THE APP BOOTSTRAPS ITS OWN COMPONENTS
      // (goal/G41.1; Andy: "the shell should not know that. every app needs to bootstrap its own components."): the
      // element is loaded here, through spirit.require, never put on the face's own list of parts.
      container.innerHTML = '<div id="agent-bench" class="fill"></div>';
      var benchBox = container.querySelector('#agent-bench');
      // goal/G41.23: its tools' glyphs are icons (Andy: "this element will replace icons painting all shell elements and
      // apps."), painted by the workBench's strip through spirit/element/icon.js, loaded here with it.
      var loaded = Promise.all([E.spirit.element.workBench ? null : spirit.require('spirit/element/workBench.js'), spirit.require('spirit/element/icon.js'), spirit.require('spirit/element/tabContainer.js')]);
      loaded.then(function () { if (gone) return; E = (window.spirit && window.spirit.element) || E; build(); }, function () { benchBox.textContent = 'The workbench could not be loaded.'; });
      // THE WORKBENCH'S CENTRE IS CLOSABLE TABS (goal/G41.31; Andy: "i need a tabContainer permanently situated in the center pane of
      // the workBench.", "each panel, that the agent app placed into the center panel now becomes a closable tab in the
      // tabContainer, activated if it already exists, created if it doesn't have a tab yet."). They stay when the left tool
      // changes (Q1: "yes, that is the point."), which replaced the G41.4 line that the centre empties.
      var bench = null;
      var tabs = null;
      var unsaved = 0;
      // What its tools made (the table lists, the persona search, the bundle editor), destroyed with it (rule/8: each
      // watches its branch); one made after destroy goes at once.
      var owned = [];
      function own(m) {
        if (!m || typeof m.destroy !== 'function') return m;
        if (gone) m.destroy(); else owned.push(m);
        return m;
      }
      // A tab's header (Andy: "<provider-icon> <provider Label>", "<chat-icon> <persona-label>", "new  <row-type>*").
      function header(spec, row) {
        var r = row || {};
        var icon = spec.chat ? '💬' : String(r.icon || (detail.look(spec.table).icon || ''));
        return (icon ? icon + ' ' : '') + String(r.label || '');
      }
      // WHO PAINTS, LISTENS (goal/G41.31; Andy: "any tab that hears (by listening) of it's own rows deletion will close itself."): the
      // tab follows its row where the stream writes it, its header as the label changes, closed when the row goes.
      function follow(spec, name) {
        // Asked of the agent family's cache, which alone names its addresses: its table's branch, watch(id, fn)
        // (spirit/app/agent/data.js).
        var B = (((window.spirit.data || {}).agent || {}).data || {})[spec.table];
        if (!B) return function () {};
        return B.watch(spec.id, function (value) {
          if (value === undefined) { tabs.close(name); return; }
          if (value && value.label) tabs.rename(name, { label: header(spec, value) });
        });
      }
      var detail = {
        // make(box) in the tab of spec { table, id, row, chat }; with no id, an add's tab, until its row is saved.
        open: function (make, spec) {
          if (!tabs) return;
          var s = spec || {};
          var adding = !s.id;
          var name = adding ? s.table + '/new' + (++unsaved) : (s.chat ? 'chat/' : s.table + '/') + s.id;
          var T = agentAt('spirit.app.agent.element.table.tableElement');
          var kept = !adding && T && window.spirit.data ? window.spirit.data.getPath(T.branchOf(s.table) + '/' + s.id) : null;
          var off = null;
          tabs.add({ name: name, label: adding ? 'new ' + s.table + '*' : header(s, Object.assign({}, s.row || {}, kept || {})), closable: true, mount: function (box) {
            // Once, with the tab: a press on a row already open adds nothing here.
            if (!adding) off = follow(s, name);
            var made = make(box);
            // Saved, an add's tab is that row's: its header, and a press on that row in the list finds it.
            if (adding) box.addEventListener('agent-row-added', function (e) {
              var d = (e && e.detail) || {};
              var was = name;
              var row = Object.assign({ id: d.id }, d.row || {});
              s = { table: s.table, id: d.id, row: row };
              name = s.table + '/' + d.id;
              tabs.rename(was, { name: name, label: header(s, row) });
              off = follow(s, name);
            });
            return { destroy: function () { if (off) off(); if (made && typeof made.destroy === 'function') made.destroy(); } };
          } });
        },
        // A table's icon, its name (a detail pane's title row) and its title (a list pane's).
        look: function (table) {
          var t = TABLES.filter(function (x) { return x.name === table; })[0];
          return t ? { icon: t.icon, name: t.one, title: t.title } : { icon: '', name: table, title: table };
        },
      };
      function build() {
      bench = E.spirit.element.workBench.create(benchBox, {
        left: TABLES.map(function (t) {
          return { name: t.name, icon: t.icon, title: t.title, mount: function (box) {
            box.className = 'fill';
            Promise.resolve(spirit.require('spirit/app/agent/element/table/' + t.name + '/elementTable.js')).then(function () {
              own(agentAt('spirit.app.agent.element.table.' + t.name + '.elementTable').create(box, detail));
            }, function () { box.textContent = 'The ' + t.name + ' table could not be loaded.'; });
          } };
        }).concat([{ name: 'chat', icon: '💬', title: 'Select Persona', mount: function (box) {
          // 💬 SELECT PERSONA (goal/G41.26; Andy, box: "the left site icon strip gains a [chat] icon, that opens the
          // following, NEW panel, titled: \"💬 Select Persona\"", "this new panel, below the title contains, for now, only a
          // personaSelector:pane", and "When the user clicks on a persona in the left hand \"💬 Select Persona\" pane, the chat
          // pane shows up in the center pane of workBench"). The personaSelector:pane is the persona table's search in pane
          // mode (rule/29), the agent tables' own; a persona picked opens its chat in the centre, in place of what was there.
          box.className = 'fill';
          Promise.resolve(spirit.require('spirit/app/agent/element/table/tableElement.js')).then(function () {
            var D = window.spirit.element.spirit.app.agent.element.table.tableElement;
            box.innerHTML = '<div class="fill">' + D.titleRow({ icon: '💬' }, ['Select Persona']) + '<div id="agent-personas" class="fill" style="margin-top:1em"></div></div>';
            own(D.search(box.querySelector('#agent-personas'), { table: 'persona' }, { face: 'pane', pick: function (row, key) {
              var picked = { id: String((row && row.id) || key || ''), label: String((row && row.label) || '') };
              // Its own tab beside its persona's, following that persona's row.
              detail.open(function (centre) {
                var pane = null;
                var closed = false;
                Promise.resolve(spirit.require('spirit/app/agent/element/chatPane.js')).then(function () {
                  if (!closed) pane = window.spirit.element.spirit.app.agent.element.chatPane.create(centre, { persona: picked });
                });
                return { destroy: function () { closed = true; if (pane) pane.destroy(); } };
              }, { table: 'persona', id: picked.id, row: picked, chat: true });
            } }));
          }, function () { box.textContent = 'The persona table could not be loaded.'; });
        } }]),
        // THE SERVER'S TOOL IS serverDEBUG (goal/G43.15; Andy: "agent will in the server-config, on the right icon strip the ⚙ icon
        // instead of 🐞, and that panel will show..."): the one DEBUG switch every server has, kept by the node. Above it the app's
        // icon and label, as the appSelector's detail shows them (Q4; Andy: "both above the debug thinggie...").
        right: [{ name: 'server', icon: '⚙', title: 'The agent server', mount: function (box) {
          var A = 'spirit/element/search/app/';
          Promise.all([spirit.require(A + 'changeAppIcon.js'), spirit.require(A + 'changeAppLabel.js'), spirit.require(A + 'serverDEBUG.js')]).then(function () {
            if (gone) return;
            var hosts = [0, 1, 2].map(function () { var d = document.createElement('div'); box.appendChild(d); return d; });
            var made = [
              window.spirit.element.spirit.element.search.app.changeAppIcon.create(hosts[0], { key: 'agent' }),
              window.spirit.element.spirit.element.search.app.changeAppLabel.create(hosts[1], { key: 'agent' }),
              window.spirit.element.spirit.element.search.app.serverDEBUG.create(hosts[2], { key: 'agent' }),
            ];
            serverPanel = { destroy: function () { made.forEach(function (m) { m.destroy(); }); } };
          }, function () { box.textContent = 'The server panel could not be loaded.'; });
        } }, { name: 'bundles', icon: '📦', title: 'Bundles', mount: function (box) {
          // goal/G41.21: the shell's bundle editor, loaded when its tool is first shown (rule/26). Its rows
          // open in this centre's tabs (goal/G41.31; Andy: "agent: <bundle-name>."; "if the bundle is not node-owned:
          // (<bundle-name>) in italic print.").
          box.className = 'fill';
          Promise.resolve(spirit.require('spirit/element/bundleEditor.js')).then(function () {
            own(window.spirit.element.spirit.element.bundleEditor.create(box, { tabs: tabs, tabLabel: function (row) {
              var label = String(row.label || '');
              return String(row.owner || 'node') === 'node' ? label : { label: '(' + label + ')', italic: true };
            } }));
          }, function () { box.textContent = 'The bundle editor could not be loaded.'; });
        } }],
      });
      tabs = E.spirit.element.tabContainer.create(bench.center, { tabs: [] });
      }

      return {
        destroy: function () {
          gone = true;
          if (serverPanel) serverPanel.destroy();
          owned.splice(0).forEach(function (m) { try { m.destroy(); } catch (e) { /* its own */ } });
          // The centre's tabs, each tab's detail and its row's follow with them (tabContainer's destroy).
          if (tabs) tabs.destroy();
          tabs = null;
          if (bench && typeof bench.destroy === 'function') bench.destroy();
          container.innerHTML = '';
        },
      };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element.js', { create: create }); });
}());
