// spirit/run/shell/agent/chatPane.js
// THE CHAT WITH A PERSONA, IN THE AGENT APP'S CENTRE (goal/G41.26). The Agent app opens it when a persona is picked in its
// 💬 Select Persona panel (./agent.js). Its contract and its test: ./test/chatPane.md and ./test/chatPane.js.
// Andy, box: "the chat pane shows up in the center pane of workBench, titled: \"💬 Chat with <selected-persona-label>\".
// The title is pinned to the top of the center pane.", "pinned to the bottom or that pane is a input block, which
// contains, for now a chat input line, which sends when Enter is pressed, and adds \"\n\" when SHIFT.Enter is pressed, and
// a send button on the right edge of that row.", "the space between the Title row and the Chat input row is filled by an
// upward scrolling chat log.", and "how the chat will work, is oos for this item.": a send does nothing yet.
//
//   spirit.elements.chatPane.create(container, { persona }) -> { destroy() }   persona: the row picked, { id, label }
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var made = 0;

  function create(container, options) {
    var o = options || {};
    var persona = o.persona || {};
    var pre = 'cp' + (++made) + '-';
    // One column filling the centre: the title at its top, the input row at its bottom, the log between them taking
    // what is left and scrolling in itself.
    var root = document.createElement('div');
    root.style.cssText = 'flex:1 1 auto;min-height:0;height:100%;display:flex;flex-direction:column';
    root.innerHTML =
      '<div id="' + pre + 'title" style="flex:none;font-weight:bold">💬 Chat with ' + esc(persona.label || '') + '</div>' +
      '<div id="' + pre + 'log" style="flex:1 1 0;min-height:0;overflow-y:auto"></div>' +
      '<div id="' + pre + 'row" style="flex:none;display:flex;align-items:flex-end;gap:1em">' +
        '<textarea id="' + pre + 'line" rows="1" style="flex:1 1 0;min-width:0;resize:none"></textarea>' +
        '<button type="button" id="' + pre + 'send">Send</button>' +
      '</div>';
    container.appendChild(root);
    var line = root.querySelector('#' + pre + 'line');
    var sendButton = root.querySelector('#' + pre + 'send');
    // WHAT A SEND DOES IS OUT OF SCOPE (Andy, box: "how the chat will work, is oos for this item."): nothing yet.
    function send() {}
    // Enter is the send, its newline held back from the line; Shift+Enter is left to the line, which adds the newline.
    line.addEventListener('keydown', function (e) {
      if (!e || e.key !== 'Enter' || e.shiftKey) return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      send();
    });
    sendButton.addEventListener('click', function () { send(); });
    return {
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); },
    };
  }

  E.chatPane = { create: create };
}());
