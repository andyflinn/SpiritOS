// spirit/run/spirit/app/icons/icons.js
// THE ICONS APP, ONE FILE FOR THE PAGE AND THE NODE (goal/G43.19, box v16, 7; Q6: "icons.js is the one file the node and the
// page load, as desk.js and agent.js are"). Its contract and its test: ./test/icons.md and ./test/icons.js.
// In a node it is a one-shot run (Andy: "the node must execute spirit/app/<name>/<name>.js with the request, instead of
// routing it to a server, like a cgi-script, and that process lives only as long as the request."): it requires
// ./nodeIcons.js, which answers the one call. On a page it is spirit.app.icons.createApp(container), which the app
// selector's tile opens: it brings ./browserIcons.js, the face, and draws it once that is loaded, so a tile pressed while
// the face is still on its way waits for it instead of finding nothing.
(function () {
  var S = typeof window !== 'undefined' && window.spirit ? window.spirit : require('../../spirit.js');
  if (!S.isBrowser()) { require('./nodeIcons.js'); return; }
  var face = S.require('spirit/app/icons/browserIcons.js');
  (S.app = S.app || {}).icons = {
    createApp: function (container) {
      var made = null;
      var gone = false;
      Promise.resolve(face).then(function () { if (!gone) made = S.elements.icons.create(container); });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
