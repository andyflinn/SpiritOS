// spirit/run/shell/js/armingButton.js
// THE ARE-YOU-SURE BUTTON (goal/G41.9; Andy: "create shell-element \"armingButton\" with test folders and all"): one
// element for every two-press confirm in the shell, in place of the copies each app hand-rolled. The rule it carries is
// the shell's, UI_DESIGN_STYLE.md: "An armed button disarms the moment attention moves" (Andy, 2026-09-17: "whenever i
// click anywhere else on the screen ... the button must reset, back to its original state, and the whole are-you-sure
// procedure must be done from scratch").
//
//   armingButton.attach(button, { label, armedLabel, run, api }) -> the button, carrying disarm() and armed()
//     A button already in the page made an arming one. label is what it says unarmed (by default its own text),
//     armedLabel what it says armed (by default "<label>? Press again"), run what the second press does, api the app's
//     api: its armUntilElsewhere is the shell's hook (spirit/client/shell.js, shell/boot.js).
//   armingButton.create(container, { label, armedLabel, run, api, title, className }) -> a new <button type="button">,
//     appended to the container, attached
//
// The first press arms it (data-armed, which shell.css paints red) and hands the shell its disarm; the second disarms
// and runs. ONE LOADED AT A TIME is the element's: arming one disarms the one armed before it.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var loaded = null;   // the one button armed now, if any

  function attach(button, options) {
    var o = options || {};
    var label = o.label != null ? String(o.label) : String(button.textContent || '');
    var armedLabel = o.armedLabel != null ? String(o.armedLabel) : label + '? Press again';
    var on = false;

    // Harmless twice, as the shell's hook requires.
    function disarm() {
      if (!on) return;
      on = false;
      if (loaded === button) loaded = null;
      button.removeAttribute('data-armed');
      button.textContent = label;
    }
    function arm() {
      if (loaded && loaded !== button && typeof loaded.disarm === 'function') loaded.disarm();
      on = true;
      loaded = button;
      button.setAttribute('data-armed', 'true');
      button.textContent = armedLabel;
      if (o.api && typeof o.api.armUntilElsewhere === 'function') o.api.armUntilElsewhere(disarm);
    }
    button.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!on) { arm(); return; }
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
