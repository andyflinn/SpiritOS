'use strict';
// spirit/run/spirit/element/monitor/task/script.js
// ONE RUN APP'S TASK, AS A ROW FORM (goal/G47.1). Andy: "new element spirit/element/monitor/task/script.js (to replace the run-job
// rowForm in app:detail) rowForm: <app-icon> "<app-name> + <status-message-while-running>" [run|cancel|delete]"; "yes make
// it an improvement on the current run-rowForm in app and isolate it as spirit/element/monitor/task/script.js". Its contract and
// its test: ./test/script.md and ./test/task.js.
//
//   spirit.required.spirit.element.monitor.task.create(container, { id }) -> { destroy() }
//     id   the app's job id, spirit.app.<name>: a run's job id is its app's route (spirit/job.js, goal/G43.20)
//
// IT SHOWS ONLY FOR A RUN APP: an app whose spirit/app/<name>/<name>.json says node.run; for any other it draws nothing, as
// the app detail's other rows hide themselves. The icon and the name are that manifest's identity.
// THE LINE: the name, and while its job runs, the text the app last published of its progress, {job: {state, name, done,
// total, text}} as its job's app object, the convention the job row's progress bar reads (goal/G29.14,
// spirit/element/search/job/row/script.js), else "running"; once ended, its status.
// THE BUTTON: Run while the app has no job; else Cancel or Delete, decided by the jobs detail's rule, the job row element's
// actionOf (wsl: "the Jobs detail already decides Cancel against Delete from a job's state, so task.js should take that rule
// from there, not write a second one"). A press is the rowForm's, so the button is busy until the node answers; a refusal is
// said below the bubble, the mounter's line. It follows its one job through the jobs family's cache (spirit/job/data.js).
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/job/row/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the row form, the jobs family's interface (which loads its cache), and the
  // job row element that holds the Cancel or Delete rule.
  var parts = Promise.all(['spirit/element/rowForm/script.js', 'spirit/job/api.js', 'spirit/element/search/job/row/script.js'].map(function (p) { return S.requireScript(p); }));
  var WORD = { run: 'Run', cancel: 'Cancel', 'delete': 'Delete' };
  var PREFIX = 'spirit.app.';

  function create(container, options) {
    var id = String((options && options.id) || '');
    var name = id.indexOf(PREFIX) === 0 ? id.slice(PREFIX.length) : '';
    var box = document.createElement('div');
    // It keeps what it holds inside (the general rules: overflow not visible), as the row form does.
    box.style.overflow = 'clip';
    container.appendChild(box);
    var gone = false;
    var off = null;
    var form = null;
    var said = null;
    var label = name;

    function cache() { return S.required.spirit.data && S.required.spirit.data.job && S.required.spirit.data.job.data ? S.required.spirit.data.job.data : null; }
    function job() { var J = cache(); return J && typeof J.job === 'function' ? J.job(id) : null; }
    function actionOf(j) { return j ? ANSWER['spirit/element/search/job/row/script.js'].actionOf(j) : 'run'; }
    function messageOf(j) {
      if (!j) return '';
      var a = actionOf(j);
      if (a === 'cancel') { var c = j.app && typeof j.app === 'object' ? j.app.job : null; return c && c.text ? String(c.text) : 'running'; }
      return String(j.status || '');
    }
    // The button's words, its last text: the busy mark stands left of them (busyButton.js), and stays.
    function word(b, text) {
      var t = null;
      for (var n = b.lastChild; n; n = n.previousSibling) if (n.nodeType === 3) { t = n; break; }
      if (t) { if (t.nodeValue !== text) t.nodeValue = text; } else b.appendChild(document.createTextNode(text));
    }
    function paint() {
      if (gone || !form) return;
      var j = job();
      var a = actionOf(j);
      var m = messageOf(j);
      var line = label + (m ? ': ' + m : '');
      if (form.span.textContent !== line) form.span.textContent = line;
      form.button.style.display = a ? '' : 'none';
      if (a) word(form.button, WORD[a]);
    }
    function press() {
      var a = actionOf(job());
      said.textContent = '';
      return S.readyPromise.then(function () { return S.requireScript('spirit/job/api.js'); }).then(function (j) {
        if (a === 'run') return j.create({ command: 'node', args: JSON.stringify(['spirit/app/' + name + '/' + name + '.js']) });
        if (a === 'cancel') return j.cancel({ id: id });
        if (a === 'delete') return j['delete']({ id: id });
        return null;
      }).then(function () { paint(); }, function (e) { if (!gone) said.textContent = String((e && e.message) || e); });
    }

    if (name) {
      Promise.all([parts, S.readyPromise.then(function () { return S.requireScript('spirit/fs/api.js'); }).then(function (s) { return s.loadFile('spirit/app/' + name + '/' + name + '.json'); })]).then(function (r) {
        var j = JSON.parse(String(r[1]));
        if (gone || !(j.node && j.node.run === true)) return;
        var identity = j.identity || {};
        label = String(identity.label || name);
        form = ANSWER['spirit/element/rowForm/script.js'].create(box, { icon: identity.icon || '▶️', button: 'Run', press: press });
        said = document.createElement('div');
        box.appendChild(said);
        var J = cache();
        if (J && typeof J.watch === 'function') off = J.watch(function (changed) { if (!changed || changed === id) paint(); });
        paint();
      }).then(null, function () { /* a face that may not read the file: nothing to run */ });
    }

    return {
      destroy: function () {
        gone = true;
        if (typeof off === 'function') off();
        off = null;
        if (box.parentNode) box.parentNode.removeChild(box);
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
