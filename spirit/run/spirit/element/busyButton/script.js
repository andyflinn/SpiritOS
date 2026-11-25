'use strict';
// spirit/run/spirit/element/busyButton/script.js
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
// left of its label until run's answer comes: success, refusal or throw, it is a plain button again. A request that answers
// no promise, or throws as it is called, marks nothing at all. A SECOND PRESS WHILE
// IT WAITS DOES NOTHING (Andy, goal/G41.23: "yes."), so no request is sent twice. A refusal goes no further than the
// button: saying it is the app's, in its own request.
(function () {

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
      var answer;
      try { answer = typeof o.run === 'function' ? o.run() : null; } catch (err) { busy = false; return; }
      // ONLY AN ANSWER TO WAIT FOR MARKS IT BUSY (goal/G47.1, Q25; Andy: "sure.", every arming button busy after its confirming
      // press; wsl: "with no press given it still disables itself"): a request that answers no promise, or a rowForm handed no
      // press, leaves the button as it is, so it never wipes a mark another element put on the same button.
      if (!answer || typeof answer.then !== 'function') { busy = false; return; }
      button.disabled = true;
      var mark = document.createElement('span');
      mark.className = 'shell-busy';
      button.insertBefore(mark, button.firstChild);
      answer.then(done, done);
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
    // Its box keeps what it holds inside (script-sibling-browser.js: the box it puts into its container declares a constraint, overflow not visible).
    if (b.style) b.style.overflow = 'hidden';
    container.appendChild(b);
    return attach(b, o);
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create, attach: attach };
}());
