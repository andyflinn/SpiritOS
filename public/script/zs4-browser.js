////////////////////////////////////////////////////////////////////////"+"
'use strict';
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
				if(cb!=null){
					cb(JSON.parse(d));
				}else{
					console.log("no data");
				}
			},JSON.stringify(o)
			);
			return ('this.ajax(\''+'/zs4'+'\',cb,'+JSON.stringify(o)+')');
		},
	},
	api:{
	},
	initialize:function(){
		// install stuff shared with server
		shared.install(shared,zs4);

		// attach to the zs4-initialize element
		var conn = zs4.ui.root = zs4.ui.id('zs4-initialize');
		conn.zs4 = zs4.ui.root = {ui:zs4.ui,e:conn,zc:[],uc:[]};

		// create header entities
		var header = zs4.ui.root.eHeader = zs4.ui.a(conn,'zs4-header');
				var brand = zs4.ui.a(header,'zs4-brand');
				var slogan = zs4.ui.a(header,'zs4-slogan');
				var userImage = zs4.ui.a(header,'img'); userImage.className = 'zs4user';
				var user = zs4.ui.a(header,'zs4-user');
				var options = zs4.ui.root.eUserOptions = zs4.ui.a(header,'zs4-user-options');
						options.textContent = '?';
						options.onclick = function(){zs4.options()};

		var error = zs4.ui.root.eError = zs4.ui.error(conn);
		var tabs = zs4.ui.root.zTabs = zs4.ui.tabs(conn,'main');

		// request more initialization data from server
		zs4.request.post({api:'initialize'},function(o){
			console.log(o);

			zs4.session.user = o.user;
			zs4.session.server = o.server;

			// populate header
			brand.textContent = o.server.name;
			slogan.textContent = o.server.slogan;
			if (o.user != null){
				user.textContent = o.user.name;
				userImage.src = o.user.pic;
			}

			delete zs4.initialize;

			zs4.options();
		});
	},
	options:function(){
			var options = zs4.ui.root.zTabs.zs4.addTab('options');

			zs4.ui.text(options,'h3','Introduction');
			zs4.ui.html(options,'p','You can get this information anytime by clicking on the question mark in the titlebar.');


			zs4.ui.text(options,'h3','Account');
			if (zs4.session.user == null)zs4.ui.html(options,'p','click <a href="/login">here</a> to log in.');
			else zs4.ui.html(options,'p','click <a href="/logout">here</a> to log out.');


			var h = zs4.ui.a(options,'h1');

	},
	ui:{
		a:function(p,n){
			var e = document.createElement(n);
			e.zs4 = {ui:zs4.ui,e:e,eParent:p,zc:[],uc:[]};
			p.zs4.uc.push(e);
			p.zs4.zc.push(e.zs4);
			p.appendChild(e);
			return e;
		},
		html:function(p,t,h){
			var e = zs4.ui.a(p,t);
			e.innerHTML = h;
			return e;
		},
		text:function(p,t,text){
			var e = zs4.ui.a(p,t);
			e.textContent = text;
			return e;
		},
		r:function(e){
			var p = e.zs4.eParent;
			p.removeChild(e);
			var found = false; var swap = null;
			for (var i = 0; i < p.zs4.uc.length;i++){
				if (p.zs4.uc[i]==e)found = true;
				if (found && i < (p.zs4.uc.length-1))
				{
					swap = p.zs4.uc[i]; p.zs4.uc[i]=p.zs4.uc[i+1];p.zs4.uc[i+1]=swap;
					swap = p.zs4.zc[i]; p.zs4.zc[i]=p.zs4.zc[i+1];p.zs4.zc[i+1]=swap;
				}
			}
			if (found){
					p.zs4.uc.pop();
					p.zs4.zc.pop();
			}
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
		tabs:function(p,n){
			var en = 'zs4-t-'+n;
			var t = zs4.ui.a(p,en);
			var arr = t.zs4.pane = [];
			var th = t.zs4.eHeaders = zs4.ui.a(t,en + '-th');
			var tp = t.zs4.ePanes = zs4.ui.a(t,en + '-tp');
			t.zs4.addTab = function(label){
				var tab = {
					h:zs4.ui.a(th,en + '-h'),
					p:zs4.ui.a(tp,en + '-p'),
					name:label,
					close:function(){
						var found = false; var found_idx = 0;
						for (var i = 0 ; i < arr.length ; i++){
							if (!found && arr[i] == this){
								found = true; found_idx = i;
							}

							if (found && i < (arr.length-1)){
								var swap = arr[i]; arr[i] = arr[i+1]; arr[i+1] = swap;
							}
						}
						zs4.ui.r(tab.h);
						zs4.ui.r(tab.p);
						arr.pop();

						if (found_idx >= arr.length)
							found_idx = arr.length - 1;

						if (found_idx >= 0)
						 	t.zs4.selectTab(arr[found_idx]);
					},
				}

				tab.h.onclick = function(){	t.zs4.selectTab(tab);	}

				tab.eLabel = zs4.ui.a(tab.h,en + '-tl');
				tab.eLabel.textContent = label;
				tab.eClose = zs4.ui.a(tab.h,en + '-tx');
				tab.eClose.textContent = 'x';
				tab.eClose.onclick = function(){tab.close();}

				t.zs4.pane.push(tab);
				t.zs4.selectTab(tab);
				return tab.p;
			}
			t.zs4.selectTab = function(tab){
				if (t.zs4.pane.indexOf(tab)== -1)
					return;

				for (var i = 0; i < t.zs4.pane.length ;i++){
					if (t.zs4.pane[i]==tab){
						t.zs4.pane[i].h.className = 'active';
						t.zs4.pane[i].p.style.display = 'block';
					}else{
						t.zs4.pane[i].h.className = '';
						t.zs4.pane[i].p.style.display = 'none';
					}
				}

			};
			return t;
		},
		error:function(p){
			var error = zs4.ui.a(p,'zs4-error');
					error.onclick = function(){
						this.zs4.clearError();
					};
					error.zs4.setError = function(text){
						error.zs4.errorText.textContent = text;
						error.className = 'zs4error';
					};
					error.zs4.clearError = function(text){
						error.zs4.errorText.textContent = '';
						error.className = '';
					};
					error.zs4.errorLabel = zs4.ui.a(error,'zs4-error-label');
							error.zs4.errorLabel.textContent = 'Error: ';
					error.zs4.errorText = zs4.ui.a(error,'zs4-error-text');
			return error;
		},
		id:function(i){
			return document.getElementById(i);
		},

	},
	session:{

	},

};

var exports = {};
