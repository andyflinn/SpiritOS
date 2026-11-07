// spirit/run/spirit/element/armingButton.js
// THE ARE-YOU-SURE BUTTON (goal/G41.9; Andy: "create shell-element \"armingButton\" with test folders and all"): one
// element for every two-press confirm in the shell, in place of the copies each app hand-rolled. The rule it carries is
// the shell's, UI_DESIGN_STYLE.md: "An armed button disarms the moment attention moves" (Andy, 2026-09-17: "whenever i
// click anywhere else on the screen ... the button must reset, back to its original state, and the whole are-you-sure
// procedure must be done from scratch").
//
//   armingButton.attach(button, { label, armedLabel, run }) -> the button, carrying disarm() and armed()
//     A button already in the page made an arming one. label is what it says unarmed (by default its own text),
//     armedLabel what it says armed (by default "<label>? Press again"), run what the second press does.
//   armingButton.create(container, { label, armedLabel, run, title, className }) -> a new <button type="button">,
//     appended to the container, attached
//
// The first press arms it (data-armed, which shell.css paints red); the second disarms and runs. ONE LOADED AT A TIME is
// the element's: arming one disarms the one armed before it.
// A CLICK ELSEWHERE IS ITS OWN TO HEAR (goal/G43.24; Andy: "every element that accesses ANY api must require them
// themselves ... that way anybody can mount any element without knowing what it actually needs...."): armed, it listens
// for clicks on the document and disarms on any but the press that armed it; disarmed, it lets go. No shell hook is
// handed to it. Its own second press reaches its own handler first, so the confirming press still runs.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  var loaded = null;   // the one button armed now, if any

  function attach(button, options) {
    var o = options || {};
    var label = o.label != null ? String(o.label) : String(button.textContent || '');
    var armedLabel = o.armedLabel != null ? String(o.armedLabel) : label + '? Press again';
    var on = false;
    // IT SAYS WHAT IT DOES BEFORE IT IS PRESSED (goal/G41.30; Andy: "the button for that has nothing written on it").
    button.textContent = label;

    // A click anywhere but this button, and not the press that armed it (which bubbles to the document after arming).
    var armedBy = null;
    function elsewhere(e) {
      if (!on || e === armedBy) return;
      var t = e && e.target;
      if (t && (t === button || (typeof button.contains === 'function' && button.contains(t)))) return;
      disarm();
    }
    // Harmless twice.
    function disarm() {
      if (!on) return;
      on = false;
      armedBy = null;
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') document.removeEventListener('click', elsewhere);
      if (loaded === button) loaded = null;
      button.removeAttribute('data-armed');
      button.textContent = label;
    }
    function arm(e) {
      if (loaded && loaded !== button && typeof loaded.disarm === 'function') loaded.disarm();
      on = true;
      loaded = button;
      armedBy = e || null;
      button.setAttribute('data-armed', 'true');
      button.textContent = armedLabel;
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('click', elsewhere);
    }
    button.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!on) { arm(e); return; }
      disarm();
      if (typeof o.run === 'function') o.run();
    });
    button.disarm = disarm;
    button.armed = function () { return on; };
    return button;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself"): the button is
  // appended to the container it is given, inline.
  function create(container, options) {
    var o = options || {};
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(o.label == null ? '' : o.label);
    if (o.title) button.title = String(o.title);
    if (o.className) button.className = String(o.className);
    container.appendChild(button);
    return attach(button, o);
  }

  E.armingButton = { create: create, attach: attach };
}());
