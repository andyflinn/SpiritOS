var zs4 = module.exports;

//zs4.dummy = 'asdf';

zs4.createResponseFrame = function(req,res){
  var response = {zs4:{user:null,req:null,res:null,}};
  if (req.user){
    response.zs4.user = {name:req.user.displayName,pic:req.user.picture, email:false};
    if (req.user.emails != null && req.user.emails.length > 0)
      response.zs4.user.email = true;
  }
  return response;
}
