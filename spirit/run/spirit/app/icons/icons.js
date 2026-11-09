// spirit/run/spirit/app/icons/icons.js
// THE ICONS APP, ONE FILE FOR THE PAGE AND THE NODE (goal/G43.19, box v16, 7; Q6: "icons.js is the one file the node and the
// page load, as desk.js and agent.js are"). Its contract and its test: ./test/icons.md and ./test/icons.js.
// In a node it is a one-shot run (Andy: "the node must execute spirit/app/<name>/<name>.js with the request, instead of
// routing it to a server, like a cgi-script, and that process lives only as long as the request."): it requires
// ./nodeIcons.js, which answers the one call. On a page it is spirit.elements.icons.create(container, { open }), which the
// app selector's tile opens, open its panel stack (an icon opens over the app, Andy: "the icon detail panel is supposed to
// open overtop of the icon app..... like contact detail"): it brings ./browserIcons.js, the face, and draws it once that is
// loaded, so a tile pressed while the face is on its way waits for it.
(function () {
  var S = typeof window !== 'undefined' && window.spirit ? window.spirit : require('../../spirit.js');
  if (!S.isBrowser()) { require('./nodeIcons.js'); return; }
  var face = S.require('spirit/app/icons/browserIcons.js');
  S.elements = S.elements || {};
  S.elements.icons = {
    create: function (container, options) {
      var made = null;
      var gone = false;
      Promise.resolve(face).then(function () { if (!gone) made = S.elements.iconsFace.create(container, options); });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
