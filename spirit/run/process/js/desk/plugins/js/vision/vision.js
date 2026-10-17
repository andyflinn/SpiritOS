'use strict';

// spirit/run/process/js/desk/plugins/js/vision/vision.js
// THE VISION PLUGIN (goal/G27.3): Andy's vision, item by item, in place of the musings tab.
//
// DECIDED BY ANDY, 2026-10-14 to 17, in goal/G27.3's box, not this file's to loosen:
//   R2. a simple standard desk plugin, not a bespoke app: its goal, plugin/vision, is made by the desk at its first
//       mount (R8), and its private UI is the Vision tab under Apps (shell/desk/plugins/vision/).
//   R3. "the special goal allocated automatically by the first mount of the plugin stays in design mode at all
//       times": put in design here when it is not, and end-design (and design-complete) on it refused.
//   R4. its items offer Rename, Close and Delete at all times; no Done, no Go, no code phases: "ideas go stale or are
//       superseded, and even 'delete' they are still 'history'".
//   R5. no new button logic: the desk draws no button its plugin refuses (desk.js, buttons), so refusing the presses
//       go, go-all, done, code and claim-done and the claim verb is all it takes.
//   R9. its items keep blocking, "what must turn into reality before this item could turn into reality": not refused.
//   R10. a plugin goal is never the current goal: the desk's own (goal/G27.2, D6).
// The goal itself is the plugin's data scope (R8), so it is never closed, finished or abandoned.

module.exports = function (desk) {
  const goal = desk.goal;

  // R3: in design from its first mount, and back in design should a replay find it out of it.
  const g = desk.state().goals[goal];
  if (g && !g.design) {
    try { desk.write('press', { id: goal, what: 'start-design' }); } catch (e) { console.error('vision: its goal could not be put in design: ' + ((e && e.message) || e)); }
  }

  const NO_PRESS = ['go', 'go-all', 'done', 'code', 'claim-done'];
  function refuses(verb, a, ids) {
    if (!ids.some(desk.inGoal)) return '';
    if (verb === 'claim') return 'a vision item takes no claim: it is a conversation, not code';
    if (verb !== 'press') return '';
    const what = String(a.what || '');
    if (a.id === goal) {
      if (what === 'end-design' || what === 'design-complete') return 'its goal stays in design mode at all times';
      if (what === 'close' || what === 'done' || what === 'abandon') return 'its goal is its data scope and always stays open, so ' + what + ' is refused';
    }
    if (what === 'abandon') return 'its goal is never abandoned';
    if (NO_PRESS.indexOf(what) !== -1) return 'a vision item takes no ' + what + ': it offers Rename, Close and Delete';
    return '';
  }

  return { refuses: refuses, verbs: {} };
};
