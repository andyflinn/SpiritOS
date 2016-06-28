var fs = require('fs');
fs.readFile('zs4/object.js','utf8', (err, data) => {
  if (err) {
    console.log(err);
    throw err;
  }
  console.log('constructing start function');
  var f = new Function(['input','output'],data);
  console.log(f);

  var zs4 = exports;
  zs4.event = f;
});
