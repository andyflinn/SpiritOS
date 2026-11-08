// spirit/run/spirit/app/desk/browserDesk.js
// THE DESK ON A PAGE (goal/G43.27, requirement 23): the page half of ./desk.js, as spirit/app/agent/browserAgent.js is the
// agent's. Andy: "look at agent.js, that's how it's done...", "NO FUCKING HACKS.".
//
//   spirit.elements.desk.create(container, { title, open }) -> { destroy() }
//
// The shell's app selector launches it (spirit/app/appSelector.js). It draws the Desk page, spirit.elements.deskPage
// (./element/desk/desk.js), which it requires itself, so it is loaded once desk.js is (spirit.require answers once its tree
// has). A dialog the page opens goes in the mounter's stack through open.
(function () {
  var S = window.spirit;
  S.require('spirit/app/desk/element/desk/desk.js');
  S.elements = S.elements || {};
  S.elements.desk = {
    create: function (container, opts) {
      return S.elements.deskPage.create(container, opts || {});
    },
  };
}());
