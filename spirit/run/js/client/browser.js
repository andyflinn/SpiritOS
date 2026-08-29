(function (global) {
  'use strict';

  global.spirit = {
    post: function (data, callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        }

        if (typeof callback !== 'function') {
          return;
        }

        var response = null;
        try {
          response = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch (e) {
          response = xhr.responseText;
        }

        callback(response);
      };

      xhr.send(JSON.stringify(data || {}));
    }
  };
})(window);
