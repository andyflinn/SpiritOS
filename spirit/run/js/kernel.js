// the kernel
// this file 

'use strict';
{ // ******************************************************************

const isNode = () =>
  typeof process !== 'undefined' &&
  !!process.versions &&
  !!process.versions.node;

const isBrowser = function() { return !isNode(); }  

// these are the main constants for the SpiritOS kernel
const AUTHOR = 'Andy Flinn, from AndyFlinn.com';
const COPYRIGHT = 'Copyright (c) 2024 Andy Flinn, from AndyFlinn.com';
const VERSION = '0.0.1';
const SPIRIT_NAME = 'SpiritOS';

// constants
const DEBUG = true;

// these are used for base-26 conversion, where z=0, a=1, b=2, ..., y=25
const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxyz";
const POWERS_OF_26 = [1,26,26**2,26**3,26**4,26**5,26**6,26**7,26**8,26**9,26**10,26**11];

//const ICON = require('./constants/icons.js');

// this here is the main spirit object, which contains all the core functionality of the SpiritOS kernel 
const spirit = {
  type: SPIRIT_NAME,
  core: {
    const: {
      BASE26_DIGITS: BASE26_DIGITS,
      KERNEL_DEBUG: DEBUG,
      POWERS_OF_26: POWERS_OF_26,
      IS_NODE:isNode(),
      IS_BROWSER:isBrowser(),
    },
    info: {
      debug: DEBUG,
    },
    // the util object contains utility functions which do not rely
    // on a this context. they can be called directly, like spirit.core.util.isName("foo")
    util: {},
    call: {},
    fs:{},
    type:{},
  },
  value:{},
};


// use this for old fashioned console.log debugging, which can be turned on and off with the DEBUG constant
let print = spirit.core.util.print = function(str){
  if (DEBUG) {
    console.log(str);
  }
}

// use this for error messages, which will always be printed to the console
let error = spirit.core.util.error = function(str){
  console.error('ERROR: ' + str);
  return {
    error:{
      string:str,
    }
  }; 
}

let isName = spirit.core.util.isName = function(str) {
  if (str == null) return false;
  if (str == undefined) return false;
  return /^[a-z]+$/.test(str);
}

let numberToBase26 = spirit.core.util.numberToBase26 = function(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return null;
  if (n === 0) return 'z';

  let active = false;
  let result = '';
  let num = n;
  let remainder = 0;
  let index = 0;
  for (let i = POWERS_OF_26.length - 1; i >= 0; i--) {
    if (!active && num < POWERS_OF_26[i]) {
      continue;
    }
    else {
      active = true;
    }

    if (i > 0) {
      remainder = num % POWERS_OF_26[i];
      index = (num - remainder) / POWERS_OF_26[i];
    }else{ 
      remainder = num;
      index = remainder;
    }
  
    result += BASE26_DIGITS[index];
    num = remainder;
  }

  return result;
}

let base26ToNumber = spirit.core.util.base26ToNumber = function(str) {
  if (!isName(str)) return null;

  // Special case for zero
  if (str === 'z') return 0;

  // create a loop that iterates in reverse over each character in the string
  let num = 0; let power = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const ch = str[i];
    const digit = BASE26_DIGITS.indexOf(ch);
    const factor = 26**power;
    num += digit * factor;
    power++;
  }

  return num;
}

let isType = spirit.core.util.isType = function(typename){
  if (!isName(typename)) return false;
  if (!spirit.core.type.hasOwnProperty(typename)) return false;
  return true;
}

let createType = spirit.core.util.createType = function(name,parenttype){

  // check if input arguments are both valid names
  if (!isName(name)) {
    error("createType: name '" + name + "' is not a valid name");
    return null;
  }

  if (!isName(parenttype)) {
    error("createType: parenttype '" + parenttype + "' is not a valid name");
    return null;
  }

  // check if spirit.type already had a member
  // called with the key parenttype. if it does,
  // return null
  if (parenttype != "type"){
    if (!spirit.core.type.hasOwnProperty(parenttype)) {
      error("createType: parenttype '" + parenttype + "' does not exist");
      return null;
    }
  }

  // if the type already exists, fail as well
  if (spirit.core.type.hasOwnProperty(name)) {
    error("createType: the type '" + name + "' already exists");
    return null;
  }


  let ptyp = null;
  if (parenttype == "type"){
    ptyp = spirit.core.type;
  } else {
    if (!spirit.core.type.hasOwnProperty(parenttype)) {
      error("createType: parenttype '" + parenttype + "' does not exist");
      return null;
    }
    ptyp = spirit.core.type[parenttype];
  }

  // get shortcuts to type and parent objects
  let newtype = spirit.core.type[name] = {
    //name: name,
    parenttype: parenttype,
  };
  

  if (parenttype == "type") return newtype;
    
    // copy all properties from parenttype to name
    for (const key in ptyp){
      if (key == "name" || key == "parenttype"  || key == "abstract" ) continue;
      if (typeof ptyp[key] === 'function') continue; 
      //print("copying " + key + " from " + key + " to " + name);
      if (newtype.hasOwnProperty(key)) continue;
      newtype[key] = JSON.parse(JSON.stringify(ptyp[key]));
    }

  return newtype;
}

let isTypeEnheritedFrom = spirit.core.util.isTypeEnheritedFrom = function(typename,ancestortypename){
  if (!isType(typename)){
     return false;}
  if (!isType(ancestortypename)) {
    return false;
  }
  if (typename == ancestortypename) {return false;}

  while (   isName(typename)
        &&  typename != "type"
        &&  spirit.core.type.hasOwnProperty(typename)
        ){
          if (typename == ancestortypename) return true;
          typename = spirit.core.type[typename].parenttype;
    }

  return false;
}

let bool = createType("boolean","type");{
  bool.value = false;
  bool.validate = function(value){
    if (!(typeof value === 'boolean')) return false;
    return true;
  }
}

let flag = createType("flag","boolean");{
  flag.value = true;
}

let abstract = createType("abstract","flag");
let isarray = createType("isarray","flag");
let nostore = createType("nostore","flag");
let constant = createType("constant","flag");
let readonly = createType("readonly","flag");
let serveronly = createType("serveronly","flag");

let number = createType("number","type");{
  number.min = Number.MIN_VALUE;
  number.max = Number.MAX_VALUE;
  number.value = 0;
  number.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (value < this.min || value > this.max) return false;
    return true;
  };
}

let integer = createType("integer","number");{
  integer.min = Number.MIN_SAFE_INTEGER;
  integer.max = Number.MAX_SAFE_INTEGER;
  integer.validate = function(value){
    if (!Number.isInteger(value)) return false;
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (Math.round(value) !== value) return false;
    if (value < this.min || value > this.max) return false;
    return true;
  };
}

let counter = createType("counter","integer");{
  counter.min = 0;
}

let size = createType("size","integer");{
  size.min = 0;
}

let float = createType("float","number");{
}

let string = createType("string","type");{
  string.maxlength = 256;
  string.value = "";
  string.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'string')) return false;
    if (value.length > string.maxlength) return false;
    return true;
  }
}

let name = createType("name","string");{
  name.validate = function(value){
    if (!isName(value)) return false;
    return true;
  }
}

let text = createType("text","string");{
  text.maxlength = 65536;
}

let js = createType("js","text");{
  js.validate = function(value){
    try{
      let executeMe = new Function("object", codeString);
    } catch(e){
      return false;
    }
    return true;
  }
}

let object = createType("object","type");{
  object.abstract = true;
  object.value = {};
  object.members = {};
  object.validate = function(value){
    if (!(typeof value === 'object')) return false;
    return true;
  }
}

let defineTypeMember = spirit.core.util.defineTypeMember = function(typeobject,typeName,memberName){
  if (!isName(memberName)) {
    return null;
  }
 
  if (typeobject.members.hasOwnProperty(memberName)) return null;

  let type = spirit.core.type[typeName];
  let parenttype = spirit.core.type[typeobject.parenttype];
  
  typeobject.members[memberName] = typeName;
  
  let member = typeobject.value[memberName] = {
    type: typeName,
  };

  if (!isTypeEnheritedFrom(typeName,"object")){
    typeobject.value[memberName].value = spirit.core.type[typeName].value;
  } else {
    typeobject.value[memberName].value = JSON.parse(JSON.stringify(spirit.core.type[typeName].value));
  }

  return member;
}

let array = createType("array","object");{
  array.abstract = true;
  array.value = {};
}

let createArrayType = spirit.core.util.createArrayType = function(newtypename,memberType){
  if (!isType(memberType)){
    error("createArrayType: memberType '" + memberType + "' is not a valid type");
    return null;
  }

  let mType = spirit.core.type[memberType];
  
  if (isType(newtypename)){
    error('createArrayType: type ' + newtypename + ' already exists');
    return null;
  }

  let arraytype = createType(newtypename,'array');

  arraytype.membertype = memberType;

  return arraytype;
}

let create = createType("create","object");
defineTypeMember(create,"name","typename");
defineTypeMember(create,"name","membername");


// this function must allways be invoked
// using the call function, in order to
// set 'this'
let instantiateTypeName =
spirit.core.call.instantiateTypeName = function(typeName,instanceName){
  

  if (this == null) {
  error("instantiateTypeName: 'this' is null");
    return null;
  }
  if (this == undefined) {
    error("instantiateTypeName: 'this' is undefined");
    return null;
  }
  if (typeof this !== 'object') {
    error("instantiateTypeName: 'this' is not an object");
    return null;
  }
  if (!this.hasOwnProperty('type') && !this.hasOwnProperty('parenttype')) {
    error("instantiateTypeName: 'this' has no valid type property");
    return null;
  }
  if (!this.hasOwnProperty('value')) {
    error("instantiateTypeName: 'this' has no 'value' property");
    return null;
  }
  if (typeName === "object") {
    error("instantiateTypeName: typeName '" + typeName + "' is not a valid type");
    return null;
  }

  if (!isName(typeName) || !isName(instanceName)) {
    error("instantiateTypeName: invalid name '" + instanceName + "' provided");
    return null;
  }
  if (this.hasOwnProperty(instanceName)) {
    error("instantiateTypeName: instance '" + instanceName + "' already exists");
    return null;
  }
  if (!spirit.core.type.hasOwnProperty(typeName)) {
    error("instantiateTypeName: type '" + typeName + "' is not defined");
    return null;
  }

  let type = spirit.core.type[typeName];
  if (type.abstract) {
    error("instantiateTypeName: type '" + typeName + "' is abstract");
    return null;
  }

  let instance = this.value[instanceName] = {
    type: typeName,
  }

  // copy all properties from parenttype to name
  if (!isTypeEnheritedFrom(typeName,"object")){
    instance.value = type.value;
  } else {
    instance.value = JSON.parse(JSON.stringify(type.value));
  }

  return instance;
}

 // ******************************************************************
 // stuff for tree-walker, parocessing scan....

let createRequestScannerObject = spirit.core.util.createRequestScannerObject = function(){
  let requestScannerObject = new Object({
    mustSave: false,
    pathStack:[],
    objectStack:[],
  });

  return requestScannerObject;
}

let scanReqestObject = spirit.core.call.scanRequestObject = function(requestObject,requestScannerObject = null){

}

let transformJSON = spirit.core.util.transformJSON = function(jsonInput){
  let input = null;

  // try and catch any in an attempt to parse the jsonInput argument

  try {
    input = JSON.parse(jsonInput);
    if (!(typeof input === 'object')) {
      return JSON.stringify(error('the argument to transformJSON(' + jsonInput + ') is not an object.'));
    }

    if (!input.hasOwnProperty('value')){
      return JSON.stringify(spirit);
    }
  } catch(err) {
    return JSON.stringify(error('JSON.parse(jsonInput) failed.'));
  }
  
  return '{}';
}

 // ******************************************************************
 // functions that can only run in the node environment

if (isNode()) {
  // give the node environment a specific space in the kernel

  const fs = require('fs');
  const path = require('path');
  const http = require('http');
  const ROOT_DIR = process.cwd();
  const DEFAULT_SPIRIT_PORT = 65432;
  
  spirit.core.node = {
    const:{
      ROOT_DIR:ROOT_DIR,
      DEFAULT_SPIRIT_PORT:DEFAULT_SPIRIT_PORT,
    },
    util:{

    },
  };

  let fsPath = spirit.core.node.util.fsPath =
  function(baseDir, requestPath) {
    const safePath = path.normalize(requestPath).replace(/^\/+/, '');
    const joined = path.join(baseDir, safePath);
    const relative = path.relative(baseDir, joined);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }

    return joined;
  };

  let loadFile = spirit.core.fs.loadFile = 
  function(filePath){

    filePath = fsPath(ROOT_DIR,filePath);
  
    try {
      return fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    } catch (err) {
      return null;
    }
  };

  // saveFile/deleteFile are new write capability, so they get a tighter
  // boundary than loadFile: not just "inside ROOT_DIR" but "inside
  // ROOT_DIR/app/", since that's the only place apps are meant to persist.
  function isWithinAppRoot(resolvedPath) {
    const appRoot = path.join(ROOT_DIR, 'app');
    const relative = path.relative(appRoot, resolvedPath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  let saveFile = spirit.core.fs.saveFile = function(filePath, content){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved || !isWithinAppRoot(resolved)) return { ok: false, reason: 'forbidden' };
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf8');
      return { ok: true };
    } catch (err) {
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  let deleteFile = spirit.core.fs.deleteFile = function(filePath){
    const resolved = fsPath(ROOT_DIR, filePath);
    if (!resolved || !isWithinAppRoot(resolved)) return { ok: false, reason: 'forbidden' };
    try {
      fs.unlinkSync(resolved);
      return { ok: true };
    } catch (err) {
      if (err.code === 'ENOENT') return { ok: true }; // already gone — idempotent delete
      error(err);
      return { ok: false, reason: 'error' };
    }
  };

  let scanFolder = spirit.core.node.util.scanFolder = function(dirPath,result = []){
      //print('inside of scanFolder "' + dirPath + '"');

      try {
          // Returns an array of fs.Dirent objects
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });

          while (entries.length > 0){
              let entry = entries.shift();

              if (entry.isDirectory()) {

                  let subfolder = path.join(entry.parentPath, entry.name);
                  scanFolder(subfolder,result);
                  result.push(entry);

              } else if (entry.isFile()) {
                  result.push(entry);
              }

      }
          
      } catch (err) {
          error(err);
      }

      return result;
  } 

  let loadFolder = spirit.core.node.util.loadFolder = function(){

      let result = scanFolder('./');

      print('loadFolder is finished');
      print(JSON.stringify(result,null,2));

      for (let i = 0 ; i < result.length ; i++){
          let entry = result[i];
          if (entry.isDirectory()) {

              print(`📁 Folder: ${entry.parentPath}${entry.name}`);

          } else if (entry.isFile()) {

              print(`📄 File:   ${entry.parentPath}${entry.name}`);

          }
  }

      return result;
  }

  // spirit.core.jobs: the external caller's API for the jobs subsystem
  // (distinct from spirit.core.node.jobs, the server's own registry,
  // installed separately by jobs.js only inside the server process).
  // A spawned job process calls report()/log()/complete()/fail() to
  // talk back to the server that spawned it, using the SPIRIT_JOB_ID /
  // SPIRIT_CALLBACK_URL env vars the server provides.
  spirit.core.jobs = {
    report(patch) {
      const jobId = process.env.SPIRIT_JOB_ID;
      const url = process.env.SPIRIT_CALLBACK_URL;
      if (!jobId || !url) {
        return Promise.reject(new Error('spirit.core.jobs.report() called outside a spawned job context (SPIRIT_JOB_ID/SPIRIT_CALLBACK_URL unset)'));
      }
      return new Promise((resolve, reject) => {
        const body = JSON.stringify(patch);
        const req = http.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (err) {
              resolve(null);
            }
          });
        });
        req.on('error', reject);
        req.end(body);
      });
    },
    log(message) {
      return spirit.core.jobs.report({ logMessage: message });
    },
    complete(data) {
      return spirit.core.jobs.report({ status: 'completed', data });
    },
    fail(error) {
      return spirit.core.jobs.report({ status: 'failed', data: { error: String(error) } });
    },
  };

  module.exports = spirit;
}

 // ******************************************************************
 // functions that can only run in the browser environment

 if (isBrowser()) {
  spirit.core.fs.loadFile = function(filePath){
    let result = null;
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.send();
    if (xmlhttp.status==200) {
      result = xmlhttp.responseText;
    }
    return result;
  };

  spirit.core.fs.saveFile = function(filePath, content) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/save', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to save file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ path: filePath, content: content }));
    });
  };

  spirit.core.fs.deleteFile = function(filePath) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/fs/delete', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('failed to delete file: ' + xhr.status));
      };
      xhr.send(JSON.stringify({ path: filePath }));
    });
  };

  // Returns a load/save/delete handle scoped to app/<appName>/ — the app's
  // own code only ever supplies a bare filename (appRoot is baked in by this
  // closure), so it has no parameter through which to name a path outside
  // its own folder. This is an accident-prevention convenience, not a
  // security boundary: anything in the same page can still reach the raw
  // spirit.core.fs.* functions directly. The real boundary is server-side
  // (saveFile/deleteFile there reject anything outside ROOT_DIR/app/).
  spirit.core.fs.createScopedFs = function(appName) {
    let appRoot = 'app/' + appName + '/';

    function safeName(filename) {
      if (typeof filename !== 'string' || filename.indexOf('..') !== -1 || filename.charAt(0) === '/') {
        throw new Error('invalid filename for app "' + appName + '": ' + filename);
      }
      return appRoot + filename;
    }

    return {
      loadFile: function(filename) { return spirit.core.fs.loadFile(safeName(filename)); },
      saveFile: function(filename, content) { return spirit.core.fs.saveFile(safeName(filename), content); },
      deleteFile: function(filename) { return spirit.core.fs.deleteFile(safeName(filename)); },
    };
  };

  // spirit.core.jobs: browser-side API for the jobs subsystem — wraps
  // EventSource for live updates and XHR for the request/response calls,
  // so a page never has to hand-roll either.
  spirit.core.jobs = {
    subscribe: function(handlers) {
      handlers = handlers || {};
      let source = new EventSource('/api/events');
      source.addEventListener('snapshot', function(e) {
        if (handlers.onSnapshot) handlers.onSnapshot(JSON.parse(e.data).jobs);
      });
      source.addEventListener('job-updated', function(e) {
        if (handlers.onUpdate) handlers.onUpdate(JSON.parse(e.data));
      });
      source.addEventListener('job-deleted', function(e) {
        if (handlers.onDelete) handlers.onDelete(JSON.parse(e.data));
      });
      return function unsubscribe() { source.close(); };
    },
    start: function(options) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/jobs', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to start job: ' + xhr.status));
          }
        };
        xhr.send(JSON.stringify(options || {}));
      });
    },
    list: function() {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/jobs', true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to list jobs: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
    cancel: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/jobs/' + encodeURIComponent(id) + '/cancel', true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('failed to cancel job: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
    delete: function(id) {
      return new Promise(function(resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/api/jobs/' + encodeURIComponent(id), true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error('failed to delete job: ' + xhr.status));
          }
        };
        xhr.send();
      });
    },
  };

  // Self-starting: the moment kernel.js runs in a browser, connect and log
  // every event via the shared print() (gated by the DEBUG constant above)
  // so the live event stream is observable in the console with zero UI
  // built on top of it.
  spirit.core.jobs.subscribe({
    onSnapshot: function(jobs) { print('[jobs] snapshot: ' + JSON.stringify(jobs)); },
    onUpdate: function(job) {
      if (job.type === 'server-stats') return; // ticks every ~2s, too noisy for console auto-logging
      print('[jobs] updated: ' + JSON.stringify(job));
    },
    onDelete: function(id) { print('[jobs] deleted: ' + id); },
  });

  window.spirit = spirit;
}

 // ******************************************************************
 // functions that depend on environment specific other functions

spirit.core.util.loadSpiritModule = function(filePath){
  print('loading spirit module ' + filePath);
  let script = spirit.core.fs.loadFile(filePath);
  if (script==null) return;
  let foo = new Function("spirit",script);
  foo(spirit);
};


const ICON = spirit.core.const.ICON = {
    ANGRY: '😠',
    ARROWDOWN: '⬇️',
    ARROWLEFT: '⬅️',
    ARROWRIGHT: '➡️',
    ARROWUP: '⬆️',
    OK: '✅',
    DELETE: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    CHECKED: '☑️',
    UNCHECKED: '⬜',
    LOADING: '⏳',
    ERROR: '❌',
    POINTRIGHT: '▶️',
    POINTDOWN: '🔽',
    POINTLEFT: '◀️',
    POINTUP: '🔼',
    BACK: '⬅️',
    FORWARD: '➡️',
    REFRESH: '🔄',
    ADD: '➕',
    REMOVE: '➖',
    EDIT: '✏️',
    VIEW: '👁️',
    HIDDEN: '🙈',
    VISIBLE: '🙉',
    LOCKED: '🔒',
    UNLOCKED: '🔓',
    STAR: '⭐',
    HEART: '❤️',
    BROKENHEART: '💔',
    PURPLEHEART: '💜',
    THUMBSUP: '👍',
    THUMBSDOWN: '👎',
    FIRE: '🔥',
    WATER: '💧',
    EARTH: '🌍',
    AIR: '💨',
    SUN: '☀️',
    MOON: '🌙',
    CLOUD: '☁️',
    RAIN: '🌧️',
    SNOW: '❄️',
    LIGHTNING: '⚡',
    TREE: '🌳',
    FLOWER: '🌸',
    ANIMAL: '🐾',
    PERSON: '👤',
    GROUP: '👥',
    MUSIC: '🎵',
    VIDEO: '🎬',
    DOCUMENT: '📄',
    FILE: '📄',
    FOLDER: '📁',
    OPENFOLDER: '📂',
    LINK: '🔗',
    LOCATION: '📍',
    TIME: '⏰',
    CALENDAR: '📅',
    EMAIL: '✉️',
    PHONE: '📞',
    CHAT: '💬',
    CODE: '💻',
    BUG: '🐛',
    IDEA: '💡',
    UDLOAD: '⬆️',
    DOWNLOAD: '⬇️',
    EGGPLANT: '🍆',
    VICTORY: '✌️',
    COFFEE: '☕',
    SMOKE: '💨',
    NEEDLE: '🪡',
    THREAD: '🧵',
    NOTE: '📝',
    HOME: '🏠',
    WORK: '🏢',
    SCHOOL: '🏫',
    CAR: '🚗',
    BIKE: '🚲',
    BUS: '🚌',
    TRAIN: '🚆',
    PLANE: '✈️',
    SHIP: '🚢',
    ROCKET: '🚀',
    SATELLITE: '🛰️',
    GLOBE: '🌐',
    OBJECT: '🔲',
    BOX: '📦',
    PACKAGE: '📦',
    SPIRIT: '👻',
    GHOST: '👻',
    WIZARD: '🧙',
    WITCH: '🧙‍♀️',
    TABLE: '📊',
    CHART: '📈',
    GRAPH: '📉',
    BOOK: '📖',
    BATTERY: '🔋',
    KEY: '🔑',
    LOCK: '🔒',
    UNLOCK: '🔓',
    PAUSED: '⏸️',
    PLAY: '▶️',
    STOP: '⏹️',
    RECORD: '⏺️',
    REWIND: '⏪',
    FASTFORWARD: '⏩',
    PAUSE: '⏸️',
    VOLUMEUP: '🔊',
    VOLUMEDOWN: '🔉',
    MUTED: '🔇',
    UNMUTED: '🔈',
    PROTECT: '🛡️',
    SHIELD: '🛡️',
    SWORD: '⚔️',
    GUN: '🔫',
    BOMB: '💣',
    EXPLODE: '💥',
    PRAY: '🙏',
    THANKS: '🙏',
    SLEEP: '😴',
    PARTY: '🥳',
    CELEBRATE: '🎉',
    THINK: '🤔',
    CONFUSED: '😕',
    SAD: '😢',
    HAPPY: '😄',
    LOVE: '❤️',
    GROOVY: '😎',
    DEAD: '💀',
    BIRD: '🐦',
    CAT: '🐱',
    DOG: '🐶',
    MONKEY: '🐒',
    FISH: '🐟',
    MENU: '📋',
    LIST: '📋',
    OFF: '🔴',
    ON: '🟢',
    YES: '✅',
    NO: '❌',
    START: '🔵',
    STOP: '🟠',
    NUMBER: '🔢',
    STRING: '🔤',
    BOOLEAN: '🔘',
    TEXT: '🔤',
    TOGGLE: '🔘',
    SUCCESS: '✅',
    END: '🔚',
};

const MIME_TYPES = spirit.core.const.MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.py': 'text/x-python'
};

let discobject = createType('discobject','object');
discobject.abstract = true;

let file = createType('file','object');
defineTypeMember(file,'size','size');
defineTypeMember(file,'string','mimetype');

let folder = createArrayType('folder','object');


} // ******************************************************************
