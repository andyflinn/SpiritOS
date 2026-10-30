// spirit/run/shell/agent/agent.js
// THE AGENT FACE APP (goal/G41.1): the face of the agent server, built on the workBench element, on the face on
// loopback and through a relay alike. Its contract and its test: ./test/agent.md and ./test/agent.js.
//
// NO AGENTS TALK TO EACH OTHER THROUGH IT (goal/G41.1, Q1; the ruling of 2026-10-02, goal/G3.1, stands): each agent
// sees itself as the only agent and user of the node.
//
//   The left tool keeps this app's own state, relay-state/shell/agent/config.json: { showDebug }, whether the window's
//   title bar shows the agent server's DEBUG state (Andy, under G41.1).
//   The right tool sets the server's DEBUG state: it requires the server's interface through spirit and calls its
//   debug {on} (Andy, Q5: "the app is supposed to require it's components, then use them."), and draws only what the
//   server's stream says (rule/19: "the ui must propose all state changes to the server and only draw changes contained
//   in the servers update/change stream"), the state arriving as { agent: { debug } } on the server's job.
//   The title shows the bug while showDebug is true and the server's DEBUG state is on.
//   THE DATA SET'S TABLES (goal/G41.4; Andy, box v22: "every one of these tables will come with a left-edge icon that
//   puts up a panel in the left-side tool-display of the workBench UI used in this app"): one left tool per table of
//   agent.db, each mounting that table's own element, process/js/agent/table/<name>/elementTable.js. A row opened from
//   a list is edited in the workBench's centre, the one detail pane of the app.
//   NO GRANT TOOL (goal/G41.21, box v17: "agent.grant is removed altogether: its table, its server, and the Grants tool
//   in the left strip. A job's grant is its bundle"). THE BUNDLE EDITOR IN THE RIGHT STRIP ("The right strip gets its
//   first real tool: the bundle editor"): shell/js/bundleEditor.js, beside the agent server's DEBUG box.
(function () {
  var CONFIG = 'relay-state/shell/agent/config.json';
  var AGENT = spirit.familyPath('agent');
  var NAME = 'Agent';
  var BUG = '🐞';
  // one: the table's name as a detail pane's title row says it ("[Table-Icon] \"Add | Change\" [Table-name]").
  var TABLES = [
    { name: 'provider', icon: '🏢', title: 'Model providers', one: 'Provider' },
    { name: 'model', icon: '🧠', title: 'Models', one: 'Model' },
    { name: 'persona', icon: '🎭', title: 'Personas', one: 'Persona' },
    { name: 'job', icon: '📋', title: 'Jobs', one: 'Job' },
  ];

  spirit.shell.activateApp({
    mount: function (container, api) {
      var E = (api && api.ui && api.ui.elements) || (window.spirit && window.spirit.elements) || {};
      var showDebug = false;
      var debug = false;
      var serverBox = null;
      function title() { if (api && typeof api.setScreenTitle === 'function') api.setScreenTitle(NAME + (showDebug && debug ? ' ' + BUG : '')); }
      function drawServer() {
        var box = serverBox && serverBox.querySelector('input');
        if (box) box.checked = debug;
      }

      // Its whole app area is one workBench, in a box of a stated size (rule/16). THE APP BOOTSTRAPS ITS OWN COMPONENTS
      // (goal/G41.1; Andy: "the shell should not know that. every app needs to bootstrap its own components."): the
      // element is loaded here, through spirit.require, never put on the face's own list of parts.
      container.innerHTML = '<div id="agent-bench" class="fill"></div>';
      var benchBox = container.querySelector('#agent-bench');
      // goal/G41.23: its tools' glyphs are icons (Andy: "this element will replace icons painting all shell elements and
      // apps."), painted by the workBench's strip through shell/js/icon.js, loaded here with it.
      var loaded = Promise.all([E.workBench ? null : spirit.require('shell/js/workBench.js'), spirit.require('shell/js/icon.js')]);
      loaded.then(function () { E = (window.spirit && window.spirit.elements) || E; build(); }, function () { benchBox.textContent = 'The workbench could not be loaded.'; });
      // THE DETAIL PANE IS THE WORKBENCH'S CENTRE (Andy, on G41.4: "make the detail-panel take over the middle pane of the
      // workBench UI please"): a row opened from any table's list fills it, and what was there goes.
      var bench = null;
      var inCentre = null;
      var detail = {
        open: function (make) {
          if (!bench) return;
          if (inCentre && typeof inCentre.destroy === 'function') inCentre.destroy();
          bench.center.innerHTML = '';
          inCentre = make(bench.center);
        },
        // The centre emptied, what was in it destroyed.
        clear: function () {
          if (inCentre && typeof inCentre.destroy === 'function') inCentre.destroy();
          inCentre = null;
          if (bench) bench.center.innerHTML = '';
        },
        // A table's icon, its name (a detail pane's title row) and its title (a list pane's).
        look: function (table) {
          var t = TABLES.filter(function (x) { return x.name === table; })[0];
          return t ? { icon: t.icon, name: t.one, title: t.title } : { icon: '', name: table, title: table };
        },
      };
      function build() {
      bench = E.workBench.create(benchBox, {
        // ANOTHER LEFT TOOL, AN EMPTY CENTRE (Andy, on G41.4: "if the current \"icon\" is changed the content of a
        // left-strip icon should disappear from the middle workBench Pane").
        changed: function (side) { if (side === 'left') detail.clear(); },
        left: [{ name: 'app', icon: '⚙️', title: 'This app', mount: function (box) {
          box.innerHTML = '<label><input type="checkbox"> Show the server\'s DEBUG state in the title bar</label>';
          Promise.resolve(spirit.fs.loadFile(CONFIG)).then(function (text) {
            var c = null;
            try { c = JSON.parse(text); } catch (e) { c = null; }
            showDebug = !!(c && c.showDebug === true);
            box.innerHTML = '<label><input type="checkbox"' + (showDebug ? ' checked' : '') + '> Show the server\'s DEBUG state in the title bar</label>';
            title();
          }, function () { title(); });
          box.addEventListener('change', function (e) {
            showDebug = !!(e && e.target && e.target.checked);
            spirit.fs.saveFile(CONFIG, JSON.stringify({ showDebug: showDebug }) + '\n');
            title();
          });
        } }].concat(TABLES.map(function (t) {
          return { name: t.name, icon: t.icon, title: t.title, mount: function (box) {
            box.className = 'fill';
            Promise.resolve(spirit.require('process/js/agent/table/' + t.name + '/elementTable.js')).then(function () {
              window.spirit.elements[t.name + 'Table'].create(box, api, detail);
            }, function () { box.textContent = 'The ' + t.name + ' table could not be loaded.'; });
          } };
        })),
        right: [{ name: 'server', icon: '🐞', title: 'The agent server', mount: function (box) {
          serverBox = box;
          box.innerHTML = '<label><input type="checkbox"' + (debug ? ' checked' : '') + '> DEBUG on the agent server</label>';
          box.addEventListener('change', function (e) {
            var on = !!(e && e.target && e.target.checked);
            // Proposed to the server through its interface; the box shows what the stream then says, not this click.
            drawServer();
            Promise.resolve(spirit.require(AGENT)).then(function (agent) { return agent.debug({ on: on }); }).then(drawServer, drawServer);
          });
        } }, { name: 'bundles', icon: '📦', title: 'Bundles', mount: function (box) {
          // goal/G41.21: the shell's bundle editor, loaded when its tool is first shown (rule/26), with the app's api.
          box.className = 'fill';
          Promise.resolve(spirit.require('shell/js/bundleEditor.js')).then(function () {
            window.spirit.elements.bundleEditor.create(box, { api: api });
          }, function () { box.textContent = 'The bundle editor could not be loaded.'; });
        } }],
      });
      }

      // THE SERVER'S STATE, from its stream: its job's app, { agent: { debug } }. Read from the job that changed, or from
      // the whole set when none did (what a new reader is handed at once), so the state is there as the app opens.
      function stateOf(job) { var app = job && job.app; return app && app.agent && typeof app.agent.debug === 'boolean' ? app.agent.debug : null; }
      api.onJobs(function (all, job) {
        var now = stateOf(job);
        if (now === null) Object.keys(all || {}).forEach(function (id) { var s = stateOf(all[id]); if (s !== null) now = s; });
        if (now === null) return;
        debug = now;
        drawServer();
        title();
      });
      title();
    },
  });
}());
