// spirit/run/shell/js/busyButton.js
// THE BUTTON THAT WAITS FOR ITS REQUEST (goal/G41.23). Andy, goal/G41.18: "i need a new shell element: busySpinnerButton
// or someting. it has an animated icon showing to the left of the buttons label, when the button is waiting for somekind
// of completion....", and "this is for all buttons that wait for potentially long requests, that have no progress bar
// ability...". Made the way armingButton is.
//
//   busyButton.attach(button, { run }) -> the button
//     A button already in the page made a busy one; its label is its own text. run() is the request a press makes: a
//     promise, a value, or a throw.
//   busyButton.create(container, { label, run, title, className }) -> a new <button type="button">, appended, attached
//
// Pressed, it is disabled and a turning mark (class shell-busy, its turn shell.css's, so every app spins the same) stands
// left of its label until run's answer comes: success, refusal or throw, it is a plain button again. A SECOND PRESS WHILE
// IT WAITS DOES NOTHING (Andy, goal/G41.23: "yes."), so no request is sent twice. A refusal goes no further than the
// button: saying it is the app's, in its own request.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};

  function attach(button, options) {
    var o = options || {};
    var busy = false;
    function done() {
      busy = false;
      var mark = button.querySelector('.shell-busy');
      if (mark) button.removeChild(mark);
      button.disabled = false;
    }
    button.addEventListener('click', function (e) {
      if (busy) { if (e && e.stopImmediatePropagation) e.stopImmediatePropagation(); return; }
      busy = true;
      button.disabled = true;
      var mark = document.createElement('span');
      mark.className = 'shell-busy';
      button.insertBefore(mark, button.firstChild);
      var answer;
      try { answer = typeof o.run === 'function' ? o.run() : null; } catch (err) { done(); return; }
      Promise.resolve(answer).then(done, done);
    });
    return button;
  }

  function create(container, options) {
    var o = options || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label == null ? '' : String(o.label);
    if (o.title) b.title = String(o.title);
    if (o.className) b.className = String(o.className);
    container.appendChild(b);
    return attach(b, o);
  }

  E.busyButton = { create: create, attach: attach };
}());
