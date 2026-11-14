'use strict';
// spirit/run/spirit/app/desk/element.js
// THE DESK ON A PAGE (goal/G43.27, requirement 23): the page half of ./desk.js, as spirit/app/agent/element.js is the
// agent's. Andy: "look at agent.js, that's how it's done...", "NO FUCKING HACKS.".
//
//   spirit.element.spirit.app.desk.element.create(container, { title, open }) -> { destroy() }
//
// The shell's app selector launches it (spirit/app/app/element.js). It draws the Desk page, spirit.element.spirit.app.desk.element.desk.desk
// (./element/desk/desk.js), which it requires itself, so it is loaded once desk.js is (spirit.require answers once its tree
// has). A dialog the page opens goes in the mounter's stack through open.
(function () {
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the
  // data they display", and spirit/test/app-child-browser.js for every element under spirit/app/; rule/26): desk's api.js and its
  // cache manager, data.js, which the page's one stream feeds; mounted alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.require === 'function') Promise.resolve(window.spirit.require('spirit/app/desk/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.cacheManager === 'function') Promise.resolve(window.spirit.cacheManager('desk')).catch(function () {});
  var S = window.spirit;
  S.require('spirit/app/desk/element/desk/desk.js');
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/desk/element.js', {
    create: function (container, opts) {
      return S.element.spirit.app.desk.element.desk.desk.create(container, opts || {});
    },
  }); });
}());
