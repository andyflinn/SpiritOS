if (true){
  var input = new Object();
  var a = zs4.string.split.separators(zs4.location.path,'./\\_-');
  var p = input;
  for (var i = 0 ; i < a.length ; i++){
    p[a[i]] = new Object();
    p = p[a[i]];
  }
  zs4.post(input,function(){
    zs4.loadtranslations(function(){
      zs4.throttle.job(function(){
        zs4.admin.type.object(null,zs4.location.get());
        zs4.style.refresh();
      });
    });

  },true);

}
