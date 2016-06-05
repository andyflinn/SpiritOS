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
			this.ajax('/zs4',function(d){
			if(cb!=null){cb(JSON.parse(d));}else{console.log("no data");}},JSON.stringify(o));
			return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
		},
	},
	api:{
			refresh:function(){
				return zs4.request.post({type:'refresh'},function(o){
				console.log(o);
				// create header


				if (o.zs4.user==null){
					zs4.user.eUser.textContent = 'welcomes you!';


					zs4.user.eLogin = zs4.user.eUserOptions.zs4.addOption('login');
					zs4.user.eLogin.onclick =  function(){window.location.href = '/login';};
				}else{
					zs4.user.eUser.textContent = o.zs4.user.name;


					zs4.user.eLogout = zs4.user.eUserOptions.zs4.addOption('logout');
					zs4.user.eLogout.onclick =  function(){window.location.href = '/logout';};
				}
			})
		},
	},
	connect:function(){

		var conn  = zs4.user.refresh = zs4.ui.id('zs4-refresh');
		conn.zs4 = zs4.ui.root = {ui:zs4.ui,e:conn,zc:[],uc:[]};

		var header = zs4.user.eHeader = zs4.ui.a(conn,'zs4-header');
		var brand = zs4.user.eBrand = zs4.ui.a(header,'zs4-brand')
				brand.textContent = 'zs4';
		var user = zs4.user.eUser = zs4.ui.a(header,'zs4-user')
		var options = zs4.user.eUserOptions = zs4.ui.options(header,'user');


		zs4.api.refresh();
	},
	ui:{
		a:function(p,n){
			var e = document.createElement(n);
			e.zs4 = {ui:zs4.ui,e:e,zc:[],uc:[]};
			p.zs4.uc.push(e);
			p.zs4.zc.push(e.zs4);
			p.appendChild(e);
			return e;
		},
		options:function(p,n){
			var en = 'zs4-o-'+n;
			var o = zs4.ui.a(p,en);
			var r = o.zs4.eOptRoot = zs4.ui.a(o,en + '-r');
			r.textContent = '?';
			var c = o.zs4.eOptions = zs4.ui.a(o,en + '-c');
			c.style.display = 'none';
			o.zs4.addOption = function(label){
				var x = zs4.ui.a(c,en + '-o');
				x.textContent = label;
				return x;
			}
			r.onclick = function(){
				if (c.style.display == 'none')c.style.display = 'inline-block';
				else c.style.display = 'none';
			};
			r.onblur = function(){c.style.display = 'none';};
			return o;
		},
		id:function(i){
			return document.getElementById(i);
		},

	},
	user:{

	},

};
