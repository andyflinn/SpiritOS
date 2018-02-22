////////////////////////////////////////////////////////////////////////"+"
'use strict';

zs4.static = function(parentElement){
  var STATIC = new Object({
    p:parentElement,
    e:new Object(),
  });

  STATIC.e.container = document.createElement('zs4-static');
  STATIC.e.container.textContent = 'asdfasdfasdfd';
  STATIC.p.appendChild(STATIC.e.container);

};
