// spirit/run/shell/agent/agent.js
// THE AGENT FACE APP (goal/G41.1): the face of the agent server, built on the workBench element, on the face on
// loopback and through a relay alike. Its contract and its test: ./test/agent.md and ./test/agent.js.
//
// NO AGENTS TALK TO EACH OTHER THROUGH IT (goal/G41.1, Q1; the ruling of 2026-10-02, goal/G3.1, stands): each agent
// sees itself as the only agent and user of the node.
//
//   The left tool keeps this app's own state, relay-state/shell/agent/config.json: { showDebug }, whether the window's
//   title bar shows the agent server's DEBUG state (Andy, under G41.1).
//   The right tool sets the server's DEBUG state: it proposes the change, agent.debug {on}, and draws only what the
//   server's stream says (rule/19: "the ui must propose all state changes to the server and only draw changes contained
//   in the servers update/change stream"), the state arriving as { agent: { debug } } on the server's job.
//   The title says DEBUG while showDebug is true and the server's DEBUG state is on.
(function () {
  var CONFIG = 'relay-state/shell/agent/config.json';
  var NAME = 'Agent';

  spirit.shell.activateApp({
    mount: function (container, api) {
      var E = (api && api.ui && api.ui.elements) || (window.spirit && window.spirit.elements) || {};
      var showDebug = false;
      var debug = false;
      var serverBox = null;
      function title() { if (api && typeof api.setScreenTitle === 'function') api.setScreenTitle(NAME + (showDebug && debug ? ' · DEBUG' : '')); }
      function drawServer() {
        var box = serverBox && serverBox.querySelector('input');
        if (box) box.checked = debug;
      }

      // Its whole app area is one workBench, in a box of a stated size (rule/16). THE APP BOOTSTRAPS ITS OWN COMPONENTS
      // (goal/G41.1; Andy: "the shell should not know that. every app needs to bootstrap its own components."): the
      // element is loaded here, through spirit.require, never put on the face's own list of parts.
      container.innerHTML = '<div id="agent-bench" class="fill"></div>';
      var benchBox = container.querySelector('#agent-bench');
      var loaded = E.workBench ? Promise.resolve() : Promise.resolve(spirit.require('shell/js/workBench.js'));
      loaded.then(function () { E = (window.spirit && window.spirit.elements) || E; build(); }, function () { benchBox.textContent = 'The workbench could not be loaded.'; });
      function build() {
      E.workBench.create(benchBox, {
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
        } }],
        right: [{ name: 'server', icon: '🐞', title: 'The agent server', mount: function (box) {
          serverBox = box;
          box.innerHTML = '<label><input type="checkbox"' + (debug ? ' checked' : '') + '> DEBUG on the agent server</label>';
          box.addEventListener('change', function (e) {
            var on = !!(e && e.target && e.target.checked);
            // Proposed to the server; the box shows what the stream then says, not this click.
            Promise.resolve(api.verb('agent.debug', { on: on })).then(drawServer, drawServer);
          });
        } }],
      });
      }

      // THE SERVER'S STATE, from its stream: its job's app, { agent: { debug } }.
      api.onJobs(function (all, job) {
        var app = job && job.app;
        if (!app || !app.agent || typeof app.agent.debug !== 'boolean') return;
        debug = app.agent.debug;
        drawServer();
        title();
      });
      title();
    },
  });
}());
