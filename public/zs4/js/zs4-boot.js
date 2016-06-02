////////////////////////////////////////////////////////////////////////"+"

var zs4 = {
	request:{
		ajax:function(u,cb){
			this.bindFunction=function(caller,o) {return function(){ return caller.apply(o,[o]);};};this.stateChange=function(o){if (this.request.readyState==4)this.cb(this.request.responseText);};this.getRequest=function(){if (window.ActiveXObject)return new ActiveXObject('Microsoft.XMLHTTP');else if(window.XMLHttpRequest)return new XMLHttpRequest();return false;};this.postBody=(arguments[2]||"");this.cb=cb;this.u=u;this.request=this.getRequest();if(this.request){var req=this.request;req.onreadystatechange=this.bindFunction(this.stateChange,this);if (this.postBody!==""){req.open("POST",u,true);req.setRequestHeader('Content-type','application/json');} else{req.open("GET",u,true);}req.send(this.postBody);}
		},
		get:function(u,cb){
			this.ajax(u,function(d){if(cb!=null)cb(d);});
			return ('this.ajax(\''+u+'\',cb)');
		},
		post:function(o,cb){
			this.ajax('/zs4request',function(d){
			if(cb!=null){cb(JSON.parse(d));}else{console.log("no data");}},JSON.stringify(o));
			return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
		},
	},
	api:{
		refresh:function(){
			return zs4.request.post({},function(o){
				console.log(o);
				if (o.zs4.user==null){
					zs4.user.connect.textContent = 'login';
					zs4.user.connect.onclick = (zs4.auth0.login)
				}else{
					zs4.user.connect.textContent = 'logout';
					zs4.user.connect.onclick = function(){window.location.href = '/logout';};

					zs4.user.name = zs4.ui.id('username');
					zs4.user.name.textContent = o.zs4.user.name;

					zs4.user.email = o.zs4.user.email;

					if (o.zs4.user.pic){
						zs4.user.pic = zs4.ui.id('userpic');
						zs4.user.pic.src = o.zs4.user.pic;
					}
				}
			})
		},
	},
	connect:function(){
		//zs4.ui.id('connect');
		zs4.user.connect = zs4.ui.z(zs4.ui.id('connect'));
		zs4.user.connect.style.display = 'inline-block';

		zs4.api.refresh();
	},
	ui:{
		e:function(n){
			var e = document.createElement(n);
			e.zs4 = {ui:zs4.ui,e:e};
			return zs4.ui.z(e);
		},
		id:function(i){
			return document.getElementById(i);
		},
		z:function(e){
			e.zs4 = {ui:zs4.ui,e:e};
			return e;
		},

	},
	user:{

	},

};
