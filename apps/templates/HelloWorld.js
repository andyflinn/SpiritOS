function(THIS, window) {
  var p = document.createElement('p');
  p.textContent = THIS._.name + ' (untitled) — edit ./apps/a/main.js';
  window.appendChild(p);
}